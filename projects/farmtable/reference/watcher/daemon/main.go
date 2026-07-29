package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/steveyegge/beads"
)

// migrationGateRe matches the error string emitted by the beads library when
// it refuses to auto-apply schema migrations to a remote-backed database.
// Example: "refusing to auto-apply 4 pending schema migrations to a
// remote-backed database (v49 -> v53): migrating clones independently forks
// the schema (#4259)"
var migrationGateRe = regexp.MustCompile(
	`refusing to auto-apply (\d+) pending schema migrations? to a remote-backed database \((\S+) -> (\S+)\)`,
)

// schemaMigrationNotification is the JSON-RPC notification emitted to the UI
// when the migration gate fires. The UI renders a purpose-built panel instead
// of the generic error box.
type schemaMigrationNotification struct {
	JSONRPC string                        `json:"jsonrpc"`
	Method  string                        `json:"method"`
	Params  schemaMigrationNotificationParams `json:"params"`
}

type schemaMigrationNotificationParams struct {
	Pending        int      `json:"pending"`
	CurrentVersion string   `json:"current_version"`
	TargetVersion  string   `json:"target_version"`
	// Ordered commands to run on the primary clone.
	Commands []string `json:"commands"`
}

// emitSchemaMigrationNotification writes a schema_migration_required
// notification to stdout so the Dart client can render MigrationGateView.
func emitSchemaMigrationNotification(pending int, current, target string) {
	notif := schemaMigrationNotification{
		JSONRPC: "2.0",
		Method:  "schema_migration_required",
		Params: schemaMigrationNotificationParams{
			Pending:        pending,
			CurrentVersion: current,
			TargetVersion:  target,
			Commands: []string{
				"BD_ALLOW_REMOTE_MIGRATE=1 bd migrate schema",
				"bd dolt push",
			},
		},
	}
	b, _ := json.Marshal(notif)
	fmt.Printf("%s\n", string(b))
}

// parseMigrationGateError checks whether err matches the beads remote-migrate
// gate message. Returns (pending, current, target, true) on match.
func parseMigrationGateError(err error) (int, string, string, bool) {
	if err == nil {
		return 0, "", "", false
	}
	m := migrationGateRe.FindStringSubmatch(err.Error())
	if m == nil {
		return 0, "", "", false
	}
	var pending int
	fmt.Sscanf(m[1], "%d", &pending)
	return pending, m[2], m[3], true
}

// appendDeveloperPath returns a copy of env with robust macOS developer paths
// appended to the existing PATH environment variable (SEC-03).
func appendDeveloperPath(env []string) []string {
	var pathVal string
	var pathIdx = -1
	for i, e := range env {
		if strings.HasPrefix(e, "PATH=") {
			pathVal = strings.TrimPrefix(e, "PATH=")
			pathIdx = i
			break
		}
	}

	const devPaths = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
	var newPath string
	if pathVal == "" {
		newPath = "PATH=" + devPaths
	} else {
		newPath = "PATH=" + pathVal + ":" + devPaths
	}

	if pathIdx != -1 {
		result := make([]string, len(env))
		copy(result, env)
		result[pathIdx] = newPath
		return result
	}
	return append(env, newPath)
}

// exportDebounce is how long the exporter waits after the last mutation before
// running `bd export`, so a burst of rapid mutations collapses into one export.
const exportDebounce = 400 * time.Millisecond

var outputWriter io.Writer = os.Stdout

// debouncedExporter serializes and coalesces background `bd export` runs
// (RACE-04). Every mutation used to spawn its own `bd export` inline; rapid UI
// actions therefore launched multiple concurrent exporter processes that
// collided on the Dolt file lock under .beads/backup/. This runs a single
// worker goroutine: mutation handlers call Request() (non-blocking), and the
// worker runs at most one export at a time, waiting exportDebounce after the
// most recent Request so a burst produces a single export.
type debouncedExporter struct {
	dir    string        // repo root to run `bd export` in
	notify chan struct{} // buffered(1): a coalescing "export needed" signal
}

func newDebouncedExporter(dir string) *debouncedExporter {
	e := &debouncedExporter{
		dir:    dir,
		notify: make(chan struct{}, 1),
	}
	go e.run()
	return e
}

// Request signals that an export is needed. Non-blocking and coalescing: if a
// signal is already pending, this is a no-op (the pending run will cover it).
func (e *debouncedExporter) Request() {
	select {
	case e.notify <- struct{}{}:
	default:
		// A signal is already queued; the worker will pick up the latest state.
	}
}

func (e *debouncedExporter) run() {
	for range e.notify {
		// Debounce: drain any additional signals that arrive within the window
		// so a burst of mutations results in exactly one export.
		timer := time.NewTimer(exportDebounce)
		draining := true
		for draining {
			select {
			case <-e.notify:
				// Another mutation arrived; extend the debounce window.
				if !timer.Stop() {
					<-timer.C
				}
				timer.Reset(exportDebounce)
			case <-timer.C:
				draining = false
			}
		}

		cmd := exec.Command("bd", "export")
		cmd.Env = appendDeveloperPath(os.Environ())
		if e.dir != "" {
			cmd.Dir = e.dir
		}
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("background bd export failed: %v\nOutput: %s", err, string(out))
		}
	}
}

// exporter is the process-wide single-worker exporter, initialized in main().
var exporter *debouncedExporter

// requestExport asks the shared exporter to run (coalesced/debounced). Safe to
// call from any handler; falls back to a no-op if the exporter is unset (e.g.
// in tests that don't start it).
func requestExport() {
	if exporter != nil {
		exporter.Request()
	}
}

// sanitizeEnvValue strips characters that would let a value break out of a
// single "KEY=VALUE" entry when placed in a process environment (SEC-03).
// Newlines (\n, \r) and null bytes are removed so an attacker-controlled actor
// name cannot inject additional environment variables such as LD_PRELOAD.
func sanitizeEnvValue(v string) string {
	return strings.NewReplacer(
		"\n", "",
		"\r", "",
		"\x00", "",
	).Replace(v)
}

type Request struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
	ID     int             `json:"id"`
}

type Response struct {
	JSONRPC string      `json:"jsonrpc"`
	Result  interface{} `json:"result,omitempty"`
	Error   *Error      `json:"error,omitempty"`
	ID      int         `json:"id"`
}

type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func sendError(id int, code int, message string) {
	resp := Response{
		JSONRPC: "2.0",
		Error: &Error{
			Code:    code,
			Message: message,
		},
		ID: id,
	}
	sendResponse(resp)
}

func sendResponse(resp Response) {
	bytes, err := json.Marshal(resp)
	if err != nil {
		log.Fatalf("Failed to marshal response: %v", err)
	}
	_, _ = fmt.Fprintln(outputWriter, string(bytes))
}

func handleAddPeer(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	type remoteStore interface {
		AddRemote(ctx context.Context, name, url string) error
	}

	if rs, ok := storage.(remoteStore); ok {
		if err := rs.AddRemote(ctx, params.Name, params.URL); err != nil {
			sendError(req.ID, -32000, fmt.Sprintf("failed to add peer: %v", err))
			return
		}
		sendResponse(Response{
			JSONRPC: "2.0",
			Result:  "ok",
			ID:      req.ID,
		})
		return
	}

	sendError(req.ID, -32601, "Storage backend does not support remotes")
}

func handleSyncPeer(ctx context.Context, storage beads.Storage, req Request) {
	// Execute 'bd federation sync' via shell to leverage the CLI's robust remote
	// handling (including GCS gs:// plugins and auth) without battling unexported Go interfaces.
	cmd := exec.CommandContext(ctx, "bd", "federation", "sync")

	// Inject standard macOS developer PATH environments so that GUI bundle context can locate Brew/System bin paths
	cmd.Env = appendDeveloperPath(os.Environ())

	// Ensure it runs in the correct directory. FindBeadsDir starts from CWD.
	beadsDir := beads.FindBeadsDir()
	if beadsDir != "" {
		cmd.Dir = filepath.Dir(beadsDir) // The repo root
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("bd federation sync failed: %v\nOutput: %s", err, string(out)))
		return
	}

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  "ok",
		ID:      req.ID,
	})
}

func handleGetPeers(ctx context.Context, storage beads.Storage, req Request) {
	type RemoteInfo struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}
	var peers []RemoteInfo

	if rs, ok := storage.(beads.RemoteStore); ok {
		if remotes, err := rs.ListRemotes(ctx); err == nil {
			for _, r := range remotes {
				peers = append(peers, RemoteInfo{
					Name: r.Name,
					URL:  r.URL,
				})
			}
		} else {
			sendError(req.ID, -32000, fmt.Sprintf("failed to list peers: %v", err))
			return
		}
	}

	if peers == nil {
		peers = []RemoteInfo{}
	}

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  peers,
		ID:      req.ID,
	})
}

func handleCreateIssue(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		Issue beads.Issue `json:"issue"`
		Actor string      `json:"actor"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	err := storage.CreateIssue(ctx, &params.Issue, params.Actor)
	if err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to create issue: %v", err))
		return
	}

	// Persist dependencies if any are provided on creation
	for _, dep := range params.Issue.Dependencies {
		dep.IssueID = params.Issue.ID
		if err := storage.AddDependency(ctx, dep, params.Actor); err != nil {
			sendError(req.ID, -32000, fmt.Sprintf("failed to add dependency: %v", err))
			return
		}
	}

	// RACE-04: request a coalesced background export (single-worker, debounced)
	// so .beads/backup/events.jsonl updates and the UI file watcher notices,
	// without spawning concurrent `bd export` processes that fight the Dolt lock.
	requestExport()

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  params.Issue.ID,
		ID:      req.ID,
	})
}

func handleGetComments(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	// Because beads/internal/types is internal, we shell out to bd comments --json.
	// SEC-03: place flags before "--" and pass the (untrusted) ID as a
	// positional after "--" so an ID beginning with "-" cannot be parsed
	// as a flag (flag injection).
	cmd := exec.Command("bd", "comments", "--json", "--", params.ID)
	cmd.Env = appendDeveloperPath(os.Environ())
	out, err := cmd.Output()
	if err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to get comments: %v", string(out)))
		return
	}

	var comments []interface{}
	if len(out) > 0 {
		if err := json.Unmarshal(out, &comments); err != nil {
			sendError(req.ID, -32000, "failed to parse comments JSON")
			return
		}
	}

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  comments,
		ID:      req.ID,
	})
}

func handleAddComment(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		ID      string `json:"id"`
		Actor   string `json:"actor"`
		Comment string `json:"comment"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	// SEC-03: terminate flag parsing with "--" so an ID or comment body
	// beginning with "-" is treated as a positional, not a flag.
	cmd := exec.Command("bd", "comments", "add", "--", params.ID, params.Comment)
	// SEC-03: strip newlines and null bytes from the actor before injecting
	// it into the process environment. cmd.Env is a []string of "KEY=VALUE"
	// entries; an embedded newline could otherwise smuggle in additional
	// environment variables (e.g. LD_PRELOAD, PATH) -> code execution.
	cmd.Env = appendDeveloperPath(append(os.Environ(),
		fmt.Sprintf("BD_ACTOR=%s", sanitizeEnvValue(params.Actor)),
	))

	if out, err := cmd.CombinedOutput(); err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to add comment: %v - %s", err, string(out)))
		return
	}

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  "ok",
		ID:      req.ID,
	})
}

// conflictErrorCode is returned by handleUpdateIssue when optimistic
// concurrency control detects that the issue changed since the client last read
// it (RACE-03). The Dart client maps this code to a "changed by someone else"
// alert + refresh rather than a generic failure.
const conflictErrorCode = -32001

func handleUpdateIssue(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		ID      string                 `json:"id"`
		Updates map[string]interface{} `json:"updates"`
		Actor   string                 `json:"actor"`
		// ExpectedUpdatedAt is the updated_at the client last saw (RFC3339).
		// When present, the daemon performs a compare-and-swap: if the stored
		// issue's updated_at differs, the write is rejected as a conflict.
		// Empty/absent => no check (backward compatible).
		ExpectedUpdatedAt string `json:"expected_updated_at"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	// RACE-03: optimistic concurrency control. Reject the write if the issue was
	// modified (by a background agent, teammate, or CLI) since the client read it.
	if params.ExpectedUpdatedAt != "" {
		expected, perr := time.Parse(time.RFC3339, params.ExpectedUpdatedAt)
		current, gerr := storage.GetIssue(ctx, params.ID)
		if perr == nil && gerr == nil && current != nil &&
			!current.UpdatedAt.Equal(expected) {
			sendError(
				req.ID,
				conflictErrorCode,
				fmt.Sprintf(
					"conflict: %s was modified since you loaded it "+
						"(expected updated_at %s, found %s)",
					params.ID,
					expected.UTC().Format(time.RFC3339),
					current.UpdatedAt.UTC().Format(time.RFC3339),
				),
			)
			return
		}
		// If we couldn't parse/fetch, fall through to a normal write rather than
		// blocking the user on an inconclusive check.
	}

	err := storage.UpdateIssue(ctx, params.ID, params.Updates, params.Actor)
	if err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to update issue: %v", err))
		return
	}

	// RACE-04: coalesced background export (see requestExport / debouncedExporter).
	requestExport()

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  "ok",
		ID:      req.ID,
	})
}

func handleAddDependency(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		IssueID   string `json:"issue_id"`
		DependsOn string `json:"depends_on"`
		Type      string `json:"type"`
		Actor     string `json:"actor"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}
	if params.Type == "" {
		params.Type = "blocks"
	}

	dep := &beads.Dependency{
		IssueID:     params.IssueID,
		DependsOnID: params.DependsOn,
		Type:        beads.DependencyType(params.Type),
	}
	if err := storage.AddDependency(ctx, dep, params.Actor); err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to add dependency: %v", err))
		return
	}

	// RACE-04: coalesced background export (see requestExport / debouncedExporter).
	requestExport()

	sendResponse(Response{JSONRPC: "2.0", Result: "ok", ID: req.ID})
}

func handleRemoveDependency(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		IssueID   string `json:"issue_id"`
		DependsOn string `json:"depends_on"`
		Actor     string `json:"actor"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}
	if err := storage.RemoveDependency(ctx, params.IssueID, params.DependsOn, params.Actor); err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to remove dependency: %v", err))
		return
	}

	// RACE-04: coalesced background export (see requestExport / debouncedExporter).
	requestExport()

	sendResponse(Response{JSONRPC: "2.0", Result: "ok", ID: req.ID})
}

func handleAddLabel(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		ID    string `json:"id"`
		Label string `json:"label"`
		Actor string `json:"actor"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	// bd's label store is a many-to-many join table (not a scalar field), so
	// unlike other mutations this shells out to the bd CLI rather than calling
	// storage directly, mirroring handleAddComment's approach for the same
	// reason (see AGENTS.md mutation-pattern conventions).
	// SEC-03: terminate flag parsing with "--" so an ID or label beginning
	// with "-" is treated as a positional, not a flag.
	cmd := exec.Command("bd", "label", "add", "--", params.ID, params.Label)
	// SEC-03: strip newlines/null bytes from the actor before injecting it
	// into the process environment (see appendDeveloperPath/sanitizeEnvValue
	// doc comments above).
	cmd.Env = appendDeveloperPath(append(os.Environ(),
		fmt.Sprintf("BD_ACTOR=%s", sanitizeEnvValue(params.Actor)),
	))

	if out, err := cmd.CombinedOutput(); err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to add label: %v - %s", err, string(out)))
		return
	}

	// RACE-04: coalesced background export (see requestExport / debouncedExporter).
	requestExport()

	sendResponse(Response{JSONRPC: "2.0", Result: "ok", ID: req.ID})
}

func handleRemoveLabel(ctx context.Context, storage beads.Storage, req Request) {
	var params struct {
		ID    string `json:"id"`
		Label string `json:"label"`
		Actor string `json:"actor"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		sendError(req.ID, -32602, "Invalid params")
		return
	}

	// SEC-03: terminate flag parsing with "--" so an ID or label beginning
	// with "-" is treated as a positional, not a flag.
	cmd := exec.Command("bd", "label", "remove", "--", params.ID, params.Label)
	cmd.Env = appendDeveloperPath(append(os.Environ(),
		fmt.Sprintf("BD_ACTOR=%s", sanitizeEnvValue(params.Actor)),
	))

	if out, err := cmd.CombinedOutput(); err != nil {
		sendError(req.ID, -32000, fmt.Sprintf("failed to remove label: %v - %s", err, string(out)))
		return
	}

	// RACE-04: coalesced background export (see requestExport / debouncedExporter).
	requestExport()

	sendResponse(Response{JSONRPC: "2.0", Result: "ok", ID: req.ID})
}

type Diagnostic struct {
	IssueID string `json:"issue_id"`
	Type    string `json:"type"` // e.g., "inverted_hierarchy", "dangling_ref", "cycle"
	Message string `json:"message"`
	Fix     string `json:"fix,omitempty"`
}

type HealthCheckResult struct {
	Status      string       `json:"status"` // "healthy" or "issues_found"
	Diagnostics []Diagnostic `json:"diagnostics"`
}

var (
	healthCacheMu    sync.RWMutex
	healthCache      HealthCheckResult
	healthCacheTime  time.Time
	healthCacheValid bool
)

// getLatestModificationTime returns the maximum modification time among
// issues.jsonl, dolt, and dolt-backup files inside beadsDir.
func getLatestModificationTime(beadsDir string) (time.Time, error) {
	var maxTime time.Time
	found := false

	// Check issues.jsonl
	jsonlPath := filepath.Join(beadsDir, "issues.jsonl")
	if info, err := os.Stat(jsonlPath); err == nil {
		found = true
		if info.ModTime().After(maxTime) {
			maxTime = info.ModTime()
		}
	}

	// Check dolt directory if it exists
	doltPath := filepath.Join(beadsDir, "dolt")
	if info, err := os.Stat(doltPath); err == nil {
		found = true
		if info.ModTime().After(maxTime) {
			maxTime = info.ModTime()
		}
		_ = filepath.Walk(doltPath, func(path string, fileInfo os.FileInfo, walkErr error) error {
			if walkErr == nil {
				if fileInfo.ModTime().After(maxTime) {
					maxTime = fileInfo.ModTime()
				}
			}
			return nil
		})
	}

	// Check dolt-backup directory if it exists
	doltBackupPath := filepath.Join(beadsDir, "dolt-backup")
	if info, err := os.Stat(doltBackupPath); err == nil {
		found = true
		if info.ModTime().After(maxTime) {
			maxTime = info.ModTime()
		}
		_ = filepath.Walk(doltBackupPath, func(path string, fileInfo os.FileInfo, walkErr error) error {
			if walkErr == nil {
				if fileInfo.ModTime().After(maxTime) {
					maxTime = fileInfo.ModTime()
				}
			}
			return nil
		})
	}

	if !found {
		return time.Time{}, fmt.Errorf("no database or jsonl files found")
	}

	return maxTime, nil
}

func handleCheckHealth(ctx context.Context, storage beads.Storage, id int) {
	beadsDir := beads.FindBeadsDir()
	var latestMod time.Time
	var cacheCheckErr error

	if beadsDir != "" {
		if latestMod, cacheCheckErr = getLatestModificationTime(beadsDir); cacheCheckErr == nil {
			healthCacheMu.RLock()
			if healthCacheValid && !latestMod.After(healthCacheTime) {
				// Cache is valid and nothing has changed since last cache update.
				res := healthCache
				healthCacheMu.RUnlock()
				sendResponse(Response{
					JSONRPC: "2.0",
					Result:  res,
					ID:      id,
				})
				return
			}
			healthCacheMu.RUnlock()
		}
	}

	// 1. Fetch all issues with dependencies
	filter := beads.IssueFilter{
		IncludeDependencies: true,
	}
	issues, err := storage.SearchIssues(ctx, "", filter)
	if err != nil {
		sendError(id, -32000, fmt.Sprintf("failed to search issues for health check: %v", err))
		return
	}

	diagnostics := make([]Diagnostic, 0)
	issueMap := make(map[string]*beads.Issue)
	for _, issue := range issues {
		issueMap[issue.ID] = issue
	}

	// 2. Perform structural checks
	for _, issue := range issues {
		// Check for inverted hierarchy (Epics having parents)
		if issue.IssueType == "epic" {
			for _, dep := range issue.Dependencies {
				if dep.Type == "parent-child" {
					diagnostics = append(diagnostics, Diagnostic{
						IssueID: issue.ID,
						Type:    "inverted_hierarchy",
						Message: fmt.Sprintf("Epic '%s' is incorrectly configured as a child of '%s'. Epics should be top-level containers.", issue.Title, dep.DependsOnID),
						Fix:     fmt.Sprintf("bd update %s --parent \"\"", issue.ID),
					})
				}
			}
		}

		// Check for dangling references
		for _, dep := range issue.Dependencies {
			if _, exists := issueMap[dep.DependsOnID]; !exists {
				diagnostics = append(diagnostics, Diagnostic{
					IssueID: issue.ID,
					Type:    "dangling_ref",
					Message: fmt.Sprintf("Issue '%s' depends on '%s', but that issue does not exist in the database.", issue.ID, dep.DependsOnID),
					Fix:     fmt.Sprintf("bd update %s --parent \"\"", issue.ID),
				})
			}
		}
	}

	status := "healthy"
	if len(diagnostics) > 0 {
		status = "issues_found"
	}

	res := HealthCheckResult{
		Status:      status,
		Diagnostics: diagnostics,
	}

	// Update cache if change detection was successful
	if beadsDir != "" && cacheCheckErr == nil {
		healthCacheMu.Lock()
		healthCache = res
		healthCacheTime = latestMod
		healthCacheValid = true
		healthCacheMu.Unlock()
	}

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  res,
		ID:      id,
	})
}

func handleGraph(ctx context.Context, storage beads.Storage, id int) {
	// Use SearchIssues to fetch everything (empty query, empty filter)
	// We include dependencies directly on the issue records via the hydration filter (beads 1.0).
	filter := beads.IssueFilter{
		IncludeDependencies: true,
	}
	nodes, err := storage.SearchIssues(ctx, "", filter)
	if err != nil {
		sendError(id, -32000, fmt.Sprintf("failed to search issues: %v", err))
		return
	}

	sendResponse(Response{
		JSONRPC: "2.0",
		Result:  nodes,
		ID:      id,
	})
}

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("Usage: %s <path-to-repo>", os.Args[0])
	}
	repoPath := os.Args[1]

	ctx := context.Background()

	// Initialize database connection
	// We just change into the repoPath so FindBeadsDir works contextually,
	if err := os.Chdir(repoPath); err != nil {
		log.Printf("Failed to chdir to %s: %v", repoPath, err)
		os.Exit(1)
	}

	beadsDir := beads.FindBeadsDir()
	if beadsDir == "" {
		// Output a clean JSON-RPC error instead of panic so Dart doesn't crash
		// We do this by printing a raw JSON response to stdout before exiting.
		fmt.Printf(`{"jsonrpc":"2.0","error":{"code":-32000,"message":"Directory is not a valid beads project: missing .beads folder"},"id":1}` + "\n")
		os.Exit(0)
	}

	// Emit a special bootstrapping notification so the UI knows we are
	// establishing the database connection and might be waiting for the Dolt server.
	mode := "server"
	if _, err := os.Stat(filepath.Join(beadsDir, "dolt-server.pid")); os.IsNotExist(err) {
		mode = "embedded"
	}
	fmt.Printf(`{"jsonrpc":"2.0","method":"boot_status","params":{"status":"connecting_to_database","mode":"%s"}}`+"\n", mode)

	// Proactively kill any orphaned dolt sql-server processes on the system
	// that might be holding a dead port or a dead file lock before we attempt to connect.
	// We shell out to 'bd dolt killall' since doltserver is an internal package.
	killCmd := exec.Command("bd", "dolt", "killall")
	killCmd.Env = appendDeveloperPath(os.Environ())
	killCmd.Dir = repoPath
	if out, err := killCmd.CombinedOutput(); err == nil {
		// Just log it internally; it's a helpful sanity check
		log.Printf("Cleaned up orphaned servers: %s", string(out))
	}

	storage, err := beads.OpenFromConfig(ctx, beadsDir)
	if err != nil {
		// Check whether the beads library refused to auto-migrate a remote-backed
		// database (schema version skew). If so, emit a structured notification
		// BEFORE the error response so the UI can render MigrationGateView with
		// actionable buttons instead of a raw error string.
		if pending, current, target, ok := parseMigrationGateError(err); ok {
			emitSchemaMigrationNotification(pending, current, target)
		}
		// Serialize the error properly so newlines in err.Error() don't break JSON structure
		errResp := Response{
			JSONRPC: "2.0",
			Error: &Error{
				Code:    -32000,
				Message: fmt.Sprintf("Failed to open beads database: %v", err),
			},
			ID: 1,
		}
		bytes, _ := json.Marshal(errResp)
		fmt.Printf("%s\n", string(bytes))
		os.Exit(0)
	}
	defer func() {
		if err := storage.Close(); err != nil {
			log.Printf("Error closing storage: %v", err)
		}
	}()

	// RACE-04: start the single-worker debounced exporter, rooted at the repo.
	exporter = newDebouncedExporter(repoPath)

	// Simple stdin/stdout JSON-RPC loop
	decoder := json.NewDecoder(os.Stdin)
	for {
		var req Request
		if err := decoder.Decode(&req); err != nil {
			if err.Error() == "EOF" {
				break
			}
			sendError(-1, -32700, "Parse error")
			continue
		}

		dispatchRequest(ctx, storage, req)
	}
}

func dispatchRequest(ctx context.Context, storage beads.Storage, req Request) {
	switch req.Method {
	case "graph":
		handleGraph(ctx, storage, req.ID)
	case "check_health":
		handleCheckHealth(ctx, storage, req.ID)
	case "create_issue":
		handleCreateIssue(ctx, storage, req)
	case "update_issue":
		handleUpdateIssue(ctx, storage, req)
	case "get_comments":
		handleGetComments(ctx, storage, req)
	case "add_comment":
		handleAddComment(ctx, storage, req)
	case "get_peers":
		handleGetPeers(ctx, storage, req)
	case "add_peer":
		handleAddPeer(ctx, storage, req)
	case "sync_peer":
		handleSyncPeer(ctx, storage, req)
	case "add_dependency":
		handleAddDependency(ctx, storage, req)
	case "remove_dependency":
		handleRemoveDependency(ctx, storage, req)
	case "add_label":
		handleAddLabel(ctx, storage, req)
	case "remove_label":
		handleRemoveLabel(ctx, storage, req)
	case "get_version":
		version := "unknown"
		if info, ok := debug.ReadBuildInfo(); ok {
			for _, dep := range info.Deps {
				if dep.Path == "github.com/steveyegge/beads" {
					version = dep.Version
					break
				}
			}
		}
		sendResponse(Response{JSONRPC: "2.0", Result: version, ID: req.ID})
	case "ping":
		sendResponse(Response{JSONRPC: "2.0", Result: "pong", ID: req.ID})
	default:
		sendError(req.ID, -32601, "Method not found")
	}
}
