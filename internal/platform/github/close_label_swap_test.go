package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// fakeIssueRepo is a minimal stateful stand-in for a GitHub repository, served
// over the httptest GraphQL endpoint built by testGraphQLClient.
//
// What it simulates: the subset of the GraphQL surface CloseTask touches —
// listIssues, repository labels, closeIssue, addLabelsToLabelable,
// removeLabelsFromLabelable and a single-issue read — with real mutation of
// its own state, so a label written by one call is visible to the next.
//
// What it does NOT simulate: GraphQL validation, pagination, permissions,
// rate limits, partial-error responses, concurrency, or GitHub's own
// state_reason/label side effects. Requests are matched by substring on the
// request body, not parsed. It is a behavioural harness for CloseTask's call
// sequence, not a GitHub emulator.
type fakeIssueRepo struct {
	t *testing.T

	id          string
	number      int
	state       string
	stateReason string
	closedAt    string
	labels      []string

	// labelIDs maps a repo label name to its node ID. Only labels listed here
	// can be added or removed, mirroring labelNamesToIDs' behaviour.
	labelIDs map[string]string

	// failLabelWrites makes every add/remove label mutation return a GraphQL
	// error, standing in for a permissions failure or rate limit.
	failLabelWrites bool

	// failLabelIndex makes the repository-labels query return a GraphQL error,
	// standing in for a token that cannot read labels. This is the failure
	// ensureLabelIndex reports, distinct from a rejected label write.
	failLabelIndex bool

	// failIssueRead makes the single-issue query return a GraphQL error. Only
	// getIssue uses it, so this fails the post-swap re-read without disturbing
	// the listIssues lookup that finds the target.
	failIssueRead bool

	// failClose makes the closeIssue mutation return a GraphQL error.
	failClose bool

	closeCalls  int
	addCalls    int
	removeCalls int
	updateCalls int
}

func newFakeIssueRepo(t *testing.T, labels ...string) *fakeIssueRepo {
	t.Helper()
	return &fakeIssueRepo{
		t:      t,
		id:     "ISSUE1",
		number: 1,
		state:  "OPEN",
		labels: labels,
		// Mirrors the full production stage-label set. A narrower universe here
		// would silently no-op the swap for the stages it omits.
		labelIDs: map[string]string{
			"ft:stage/triage":    "L_TRIAGE",
			"ft:stage/accepted":  "L_ACCEPTED",
			"ft:stage/working":   "L_WORKING",
			"ft:stage/in_review": "L_INREVIEW",
			"ft:stage/in_qa":     "L_INQA",
			"ft:stage/deploying": "L_DEPLOYING",
			"ft:stage/completed": "L_COMPLETED",
			"ft:stage/wont_fix":  "L_WONTFIX",
			"ft:stage/duplicate": "L_DUPLICATE",
			"ft:stage/cancelled": "L_CANCELLED",
		},
	}
}

func (f *fakeIssueRepo) hasLabel(name string) bool {
	for _, l := range f.labels {
		if l == name {
			return true
		}
	}
	return false
}

func (f *fakeIssueRepo) addLabelByID(id string) {
	for name, lid := range f.labelIDs {
		if lid == id && !f.hasLabel(name) {
			f.labels = append(f.labels, name)
		}
	}
}

func (f *fakeIssueRepo) removeLabelByID(id string) {
	for name, lid := range f.labelIDs {
		if lid != id {
			continue
		}
		// Build into a fresh slice rather than aliasing f.labels' backing array
		// while ranging over it. The aliased form was correct but a trap to edit.
		kept := make([]string, 0, len(f.labels))
		for _, l := range f.labels {
			if l != name {
				kept = append(kept, l)
			}
		}
		f.labels = kept
	}
}

// issueJSON renders the current state as an issueNode payload.
func (f *fakeIssueRepo) issueJSON() string {
	labelNodes := make([]map[string]string, 0, len(f.labels))
	for _, l := range f.labels {
		labelNodes = append(labelNodes, map[string]string{"name": l})
	}
	encoded, err := json.Marshal(labelNodes)
	if err != nil {
		f.t.Fatalf("marshalling labels: %v", err)
	}

	stateReason := "null"
	if f.stateReason != "" {
		stateReason = `"` + f.stateReason + `"`
	}
	closedAt := "null"
	if f.closedAt != "" {
		closedAt = `"` + f.closedAt + `"`
	}

	return fmt.Sprintf(`{"id":%q,"number":%d,"title":"Task","body":"","state":%q,`+
		`"stateReason":%s,"closedAt":%s,`+
		`"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-02T00:00:00Z",`+
		`"url":"https://example.test/1","labels":{"nodes":%s},"assignees":{"nodes":[]},`+
		`"milestone":null,"subIssues":{"nodes":[],"totalCount":0},`+
		`"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}`,
		f.id, f.number, f.state, stateReason, closedAt, string(encoded))
}

func (f *fakeIssueRepo) repoLabelsJSON() string {
	nodes := make([]string, 0, len(f.labelIDs))
	for name, id := range f.labelIDs {
		nodes = append(nodes, fmt.Sprintf(`{"id":%q,"name":%q}`, id, name))
	}
	return `{"data":{"repository":{"labels":{"nodes":[` + strings.Join(nodes, ",") +
		`],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`
}

// labelIDsInBody extracts the label node IDs a mutation body references.
func (f *fakeIssueRepo) labelIDsInBody(body string) []string {
	var found []string
	for _, id := range f.labelIDs {
		if strings.Contains(body, `"`+id+`"`) {
			found = append(found, id)
		}
	}
	return found
}

func (f *fakeIssueRepo) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body := mustReadBody(f.t, r.Body)
		w.Header().Set("Content-Type", "application/json")

		switch {
		case strings.Contains(body, "closeIssue"):
			f.closeCalls++
			if f.failClose {
				_, _ = w.Write([]byte(`{"errors":[{"message":"close rejected"}]}`))
				return
			}
			f.state = "CLOSED"
			f.closedAt = "2026-01-02T00:00:00Z"
			if strings.Contains(body, "NOT_PLANNED") {
				f.stateReason = "NOT_PLANNED"
			} else {
				f.stateReason = "COMPLETED"
			}
			_, _ = fmt.Fprintf(w, `{"data":{"closeIssue":{"issue":%s}}}`, f.issueJSON())

		// updateIssue must be matched BEFORE the repository arms: UpdateTask
		// always calls it, and the mutation's selection set contains
		// labels(first: 20) like every other issue selection. It mutates
		// nothing here on purpose — UpdateTask passes nil title and body in the
		// label-only path — but it has to answer, or the label swap it guards
		// never runs and a test of that swap fails for a harness reason while
		// looking like a finding.
		case strings.Contains(body, "updateIssue"):
			f.updateCalls++
			_, _ = fmt.Fprintf(w, `{"data":{"updateIssue":{"issue":%s}}}`, f.issueJSON())

		case strings.Contains(body, "addLabelsToLabelable"):
			f.addCalls++
			if f.failLabelWrites {
				_, _ = w.Write([]byte(`{"errors":[{"message":"label write rejected"}]}`))
				return
			}
			for _, id := range f.labelIDsInBody(body) {
				f.addLabelByID(id)
			}
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))

		case strings.Contains(body, "removeLabelsFromLabelable"):
			f.removeCalls++
			if f.failLabelWrites {
				_, _ = w.Write([]byte(`{"errors":[{"message":"label write rejected"}]}`))
				return
			}
			for _, id := range f.labelIDsInBody(body) {
				f.removeLabelByID(id)
			}
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))

		case strings.Contains(body, "repository(owner:"):
			// Order matters: every issue selection also selects labels(first: 20),
			// so the single-issue and issue-list queries must be matched before
			// the repository-labels query.
			switch {
			case strings.Contains(body, "issue(number:"):
				if f.failIssueRead {
					_, _ = w.Write([]byte(`{"errors":[{"message":"issue read rejected"}]}`))
					return
				}
				_, _ = fmt.Fprintf(w, `{"data":{"repository":{"issue":%s}}}`, f.issueJSON())
			case strings.Contains(body, "issues("):
				_, _ = fmt.Fprintf(w,
					`{"data":{"repository":{"issues":{"nodes":[%s],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`,
					f.issueJSON())
			case strings.Contains(body, "labels("):
				if f.failLabelIndex {
					_, _ = w.Write([]byte(`{"errors":[{"message":"label index read rejected"}]}`))
					return
				}
				_, _ = w.Write([]byte(f.repoLabelsJSON()))
			default:
				f.t.Fatalf("unexpected repository query: %s", body)
			}

		default:
			f.t.Fatalf("unexpected GraphQL request: %s", body)
		}
	}
}

func (f *fakeIssueRepo) store() *GitHubPassThroughStore {
	return f.storeWithLabelConfig(DefaultConfig().GitHub.Labels)
}

// storeWithLabelConfig is store() with the mapper configuration as an INPUT
// rather than a constant.
//
// Until #194 round 6 every fixture in the repository inherited
// DefaultConfig().GitHub.Labels, so `grep -rn "Stages:" --include='*_test.go'
// internal/` returned zero and no test could construct a deployment with a
// configured terminal alias — the exact "fixture cannot express the input"
// shape that makes a green suite worthless (test review T-1, round-4 F-3).
// B6 made that configuration decide authorization, so it has to be a fixture
// input.
//
// Pair this with registerLabel for any label the config makes meaningful:
// labelNamesToIDs silently drops a label with no node ID, which is how an
// earlier custom-prefix probe measured nothing while appearing to pass.
func (f *fakeIssueRepo) storeWithLabelConfig(cfg LabelConfig) *GitHubPassThroughStore {
	return &GitHubPassThroughStore{
		gql:          testGraphQLClient(f.t, f.handler()),
		mapper:       NewLabelMapper(cfg),
		owner:        "acme",
		repo:         "repo",
		collectionID: uuid.New(),
	}
}

// registerLabel makes a label writable by the fake repository, mirroring a
// label that exists on the real repo. Without this, labelNamesToIDs drops the
// name and the mutation is a silent no-op.
func (f *fakeIssueRepo) registerLabel(name string) {
	f.t.Helper()
	if _, ok := f.labelIDs[name]; ok {
		return
	}
	f.labelIDs[name] = "L_" + strings.ToUpper(strings.NewReplacer(":", "_", "/", "_", " ", "_").Replace(name))
}

// labelConfigWithStages builds a LabelConfig that differs from the default
// ONLY in the fields given, so a test that varies Stages or PushPrefix varies
// exactly that and inherits nothing silently.
func labelConfigWithStages(pushPrefix string, stages map[string]string) LabelConfig {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = pushPrefix
	cfg.Stages = stages
	return cfg
}

// TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable is the reported
// scenario from issue #194: ClaimTask stamps ft:stage/working on the issue, the
// task is then closed, and on the next read the stale label makes the task
// report as available. After the fix the closed task must report
// available=false.
func TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable(t *testing.T) {
	ctx := context.Background()

	// The state ClaimTask leaves behind: an open issue labelled working.
	fake := newFakeIssueRepo(t, "ft:stage/working")
	s := fake.store()
	id := s.issueUUID(1)

	closed, err := s.CloseTask(ctx, id, task.StageCompleted, "", uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}

	if fake.hasLabel("ft:stage/working") {
		t.Errorf("issue still carries ft:stage/working after close; labels = %v", fake.labels)
	}
	if !fake.hasLabel("ft:stage/completed") {
		t.Errorf("issue missing ft:stage/completed after close; labels = %v", fake.labels)
	}
	if closed.Stage != task.StageCompleted {
		t.Errorf("CloseTask returned stage %s, want %s", closed.Stage, task.StageCompleted)
	}

	// The whole point: read the task back and compute availability.
	readBack, err := s.GetTask(ctx, id)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	availability, err := s.ComputeAvailability(ctx, readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("claimed-then-closed task reports available = true; stage = %s, reasons = %v",
			readBack.Stage, availability.Reasons)
	}
	if !availability.HasReason(store.AvailabilityReasonTerminal) {
		t.Fatalf("reasons = %v, want %s", availability.Reasons, store.AvailabilityReasonTerminal)
	}
}

// TestPassThroughCloseTask_WontFixSwapsToWontFixLabel covers the not-planned
// close path, so a mutation that hard-codes the completed label is caught.
func TestPassThroughCloseTask_WontFixSwapsToWontFixLabel(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/working")
	s := fake.store()

	closed, err := s.CloseTask(context.Background(), s.issueUUID(1), task.StageWontFix, "", uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask: %v", err)
	}
	if !fake.hasLabel("ft:stage/wont_fix") || fake.hasLabel("ft:stage/working") {
		t.Fatalf("labels after wont_fix close = %v, want ft:stage/wont_fix only", fake.labels)
	}
	if closed.Stage != task.StageWontFix {
		t.Fatalf("CloseTask returned stage %s, want %s", closed.Stage, task.StageWontFix)
	}
}

// TestPassThroughCloseTask_LabelWriteFailureStillCloses pins the ordering
// judgement in Part 1: the close is the primary effect and a failing label
// write must not turn a completed close into an error.
func TestPassThroughCloseTask_LabelWriteFailureStillCloses(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/working")
	fake.failLabelWrites = true
	s := fake.store()
	id := s.issueUUID(1)

	if _, err := s.CloseTask(ctx, id, task.StageCompleted, "", uuid.Nil); err != nil {
		t.Fatalf("CloseTask returned error when only the label write failed: %v", err)
	}
	if fake.closeCalls != 1 {
		t.Fatalf("closeIssue called %d times, want 1", fake.closeCalls)
	}
	if fake.state != "CLOSED" {
		t.Fatalf("issue state = %s, want CLOSED", fake.state)
	}
	// The residue this leaves behind is exactly what Part 2 has to absorb.
	if !fake.hasLabel("ft:stage/working") {
		t.Fatalf("expected the stale label to survive a failed swap; labels = %v", fake.labels)
	}

	readBack, err := s.GetTask(ctx, id)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	availability, err := s.ComputeAvailability(ctx, readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("closed task with failed label swap reports available = true; reasons = %v",
			availability.Reasons)
	}
}

// TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel is the Part 2
// invariant on its own: real GitHub closed state wins over a label-derived
// non-terminal stage. This test must fail if the ClosedAt arm is removed, even
// with the CloseTask label swap in place.
//
// The shape it constructs is reachable, not hypothetical. GetTask and ListTasks
// build the task through issueToTask, which sets ClosedAt for every CLOSED
// issue (passthrough.go, including the UpdatedAt fallback), while
// IssueToPhaseStage's closed branch lets a label override the stage without
// checking whether that label is terminal (labels.go). A CLOSED issue still
// carrying ft:stage/working therefore arrives here with exactly Phase=open,
// Stage=working, ClosedAt set. Two live producers: CloseTask's label swap
// failing after the close has already landed — the end-to-end case in the test
// directly above — and a maintainer closing an issue in the GitHub UI while it
// is labelled as in-flight, which in a pass-through collection is the normal
// way to close things. Only ClosedAt distinguishes them from live work, which
// is why the arm cannot be folded into the stage check.
//
// Note the zero-value store: no mapper is configured. ComputeAvailability is
// total on a zero-value GitHubPassThroughStore and must stay that way, which is
// what the nil-receiver guard in TerminalLabelStage protects.
func TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel(t *testing.T) {
	s := &GitHubPassThroughStore{}
	ctx := context.Background()
	closedAt := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)

	for _, stage := range []task.Stage{
		task.StageAccepted,
		task.StageWorking,
		task.StageInReview,
		task.StageInQa,
		task.StageDeploying,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			availability, err := s.ComputeAvailability(ctx, &ent.Task{
				// Phase and Stage are both label-derived and both wrong here;
				// only ClosedAt reflects real GitHub state.
				Phase:    task.PhaseOpen,
				Stage:    stage,
				ClosedAt: &closedAt,
			})
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
			if availability.Available {
				t.Fatalf("closed task with stale %s label reports available = true", stage)
			}
			if !availability.HasReason(store.AvailabilityReasonTerminal) {
				t.Fatalf("reasons = %v, want %s", availability.Reasons, store.AvailabilityReasonTerminal)
			}
		})
	}
}

// TestPassThroughComputeAvailability_ClosedAtDoesNotDuplicateTerminalReason
// guards against the ClosedAt arm being bolted on as a second append, which
// would report "terminal" twice for the ordinary closed-and-completed task.
func TestPassThroughComputeAvailability_ClosedAtDoesNotDuplicateTerminalReason(t *testing.T) {
	s := &GitHubPassThroughStore{}
	closedAt := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)

	availability, err := s.ComputeAvailability(context.Background(), &ent.Task{
		Phase:    task.PhaseClosed,
		Stage:    task.StageCompleted,
		ClosedAt: &closedAt,
	})
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if len(availability.Reasons) != 1 || availability.Reasons[0] != store.AvailabilityReasonTerminal {
		t.Fatalf("reasons = %v, want exactly [%s]", availability.Reasons, store.AvailabilityReasonTerminal)
	}
}

// TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal pins the
// premise Part 2 rests on: ClosedAt is never nil for a CLOSED issue, because
// issueToTask falls back to UpdatedAt when GitHub returns a null closedAt.
// Without that fallback the ClosedAt arm would silently not fire.
func TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/working")
	fake.state = "CLOSED"
	fake.stateReason = "COMPLETED"
	fake.closedAt = "" // renders as null, as a GitHub API race can return
	s := fake.store()

	readBack, err := s.GetTask(context.Background(), s.issueUUID(1))
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if readBack.ClosedAt == nil {
		t.Fatal("ClosedAt is nil for a CLOSED issue; the ClosedAt availability arm cannot fire")
	}
	if !readBack.ClosedAt.Equal(time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("ClosedAt = %v, want the UpdatedAt fallback 2026-01-02T00:00:00Z", readBack.ClosedAt)
	}

	availability, err := s.ComputeAvailability(context.Background(), readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("closed issue with null closedAt reports available = true; stage = %s, reasons = %v",
			readBack.Stage, availability.Reasons)
	}
}

// TestPassThroughComputeAvailability_OpenTaskStillAvailable pins the other
// side: an accepted, never-closed task must stay available. A mutation that
// makes ClosedAt-checking unconditional is caught here.
func TestPassThroughComputeAvailability_OpenTaskStillAvailable(t *testing.T) {
	s := &GitHubPassThroughStore{}

	availability, err := s.ComputeAvailability(context.Background(), &ent.Task{
		Phase: task.PhaseOpen,
		Stage: task.StageAccepted,
	})
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if !availability.Available {
		t.Fatalf("accepted open task reports available = false; reasons = %v", availability.Reasons)
	}
}

// TestPassThroughGetTask_OpenIssueStaysAvailable closes test-194's gap 1, the
// one with total-outage blast radius.
//
// Part 2 of #194 made issueToTask's ClosedAt assignment safety-critical for the
// first time: before it, ClosedAt had no effect on availability at all; after
// it, ClosedAt alone determines terminality. Only the CLOSED direction of that
// premise was pinned. Every inverse test constructed ent.Task by hand and so
// bypassed issueToTask entirely, which let a mutation setting ClosedAt for OPEN
// issues pass the whole suite while making every open task in the pass-through
// store unavailable.
//
// Parameterised across the stages rather than testing one, which also closes
// gap 6. Terminal stages are absent on purpose: an open issue cannot hold one
// any more (audit-194 F2), and reopen_test.go covers that.
func TestPassThroughGetTask_OpenIssueStaysAvailable(t *testing.T) {
	ctx := context.Background()

	for _, stage := range []task.Stage{
		task.StageTriage,
		task.StageAccepted,
		task.StageWorking,
		task.StageInReview,
		task.StageInQa,
		task.StageDeploying,
	} {
		t.Run(stage.String(), func(t *testing.T) {
			fake := newFakeIssueRepo(t, "ft:stage/"+stage.String())
			s := fake.store()

			readBack, err := s.GetTask(ctx, s.issueUUID(1))
			if err != nil {
				t.Fatalf("GetTask: %v", err)
			}
			if readBack.ClosedAt != nil {
				t.Errorf("ClosedAt = %v for an OPEN issue, want nil", readBack.ClosedAt)
			}
			if readBack.Stage != stage {
				t.Errorf("stage = %s, want %s", readBack.Stage, stage)
			}

			availability, err := s.ComputeAvailability(ctx, readBack)
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
			if availability.HasReason(store.AvailabilityReasonTerminal) {
				t.Fatalf("OPEN %s issue reports reason %s; reasons = %v",
					stage, store.AvailabilityReasonTerminal, availability.Reasons)
			}
			// Triage is unavailable for its own reason, which the assertion
			// above has already distinguished from terminal.
			if stage != task.StageTriage && !availability.Available {
				t.Fatalf("OPEN %s issue reports available = false; reasons = %v", stage, availability.Reasons)
			}
		})
	}
}

// TestPassThroughCloseTask_ReReadFailureStillReportsClosed closes test-194's
// gap 2. CloseTask re-reads the issue after the label swap and falls back to
// the closeIssue payload when that read fails, rather than returning an error
// for work that already succeeded. That deliberate divergence from ClaimTask
// was defended at length in the original report and enforced by nothing: a
// mutation turning the fallback into "return nil, err" survived the suite.
//
// It matters because CloseTask resolves its target from an IssueStateOpen
// filtered list. Once the close lands the issue is CLOSED, so a retry returns
// ErrNotFound — the user sees an error, retries, is told the task does not
// exist, and concludes the close failed when it did not.
func TestPassThroughCloseTask_ReReadFailureStillReportsClosed(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/working")
	fake.failIssueRead = true
	s := fake.store()

	closed, err := s.CloseTask(ctx, s.issueUUID(1), task.StageCompleted, "", uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask returned an error when only the post-swap re-read failed: %v", err)
	}
	if fake.state != "CLOSED" {
		t.Fatalf("issue state = %s, want CLOSED", fake.state)
	}

	// The fallback payload has to carry enough to stay correct. closeIssue
	// selects the full issueNode, so ClosedAt is populated and availability is
	// right even though the re-read never returned.
	if closed.ClosedAt == nil {
		t.Fatal("ClosedAt is nil on the fallback payload; availability would report the closed task available")
	}
	availability, err := s.ComputeAvailability(ctx, closed)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("closed task reports available = true off the fallback payload; reasons = %v", availability.Reasons)
	}
}

// TestPassThroughCloseTask_LabelIndexFailureStillCloses closes test-194's gap
// 3. This is a different failure from a rejected label write: the label index
// read is what fails, so the swap is skipped entirely rather than attempted and
// refused. CloseTask deliberately swallows it (err == nil guard) where
// UpdateTask and ClaimTask return; a mutation making it fatal survived the
// suite, with the same unretryable-close consequence as gap 2.
func TestPassThroughCloseTask_LabelIndexFailureStillCloses(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/working")
	fake.failLabelIndex = true
	s := fake.store()

	closed, err := s.CloseTask(ctx, s.issueUUID(1), task.StageCompleted, "", uuid.Nil)
	if err != nil {
		t.Fatalf("CloseTask returned an error when only the label index read failed: %v", err)
	}
	if fake.state != "CLOSED" {
		t.Fatalf("issue state = %s, want CLOSED", fake.state)
	}
	if fake.addCalls != 0 || fake.removeCalls != 0 {
		t.Errorf("label mutations attempted without a label index: add=%d remove=%d", fake.addCalls, fake.removeCalls)
	}
	// The stale label survives, and Part 2 has to absorb it.
	if !fake.hasLabel("ft:stage/working") {
		t.Errorf("expected the stale label to survive; labels = %v", fake.labels)
	}

	availability, err := s.ComputeAvailability(ctx, closed)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if availability.Available {
		t.Fatalf("closed task reports available = true after a skipped swap; reasons = %v", availability.Reasons)
	}
}

// TestPassThroughCloseTask_CloseFailureTouchesNoLabel pins the safety property
// the close-then-swap ordering exists to provide, which test-194 listed as gap
// 5: if the close itself fails, no label is written, so the issue is never left
// OPEN carrying a terminal stage label.
func TestPassThroughCloseTask_CloseFailureTouchesNoLabel(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/working")
	fake.failClose = true
	s := fake.store()

	if _, err := s.CloseTask(context.Background(), s.issueUUID(1), task.StageCompleted, "", uuid.Nil); err == nil {
		t.Fatal("CloseTask returned no error when the close itself failed")
	}
	if fake.addCalls != 0 || fake.removeCalls != 0 {
		t.Errorf("labels were touched after a failed close: add=%d remove=%d", fake.addCalls, fake.removeCalls)
	}
	if fake.hasLabel("ft:stage/completed") {
		t.Errorf("terminal label written to an issue that was never closed; labels = %v", fake.labels)
	}
	if fake.state != "OPEN" {
		t.Errorf("issue state = %s, want OPEN", fake.state)
	}
}

// TestPassThroughCloseTask_BestEffortFailuresAreLogged covers audit-194 F5.
//
// CloseTask discards four errors on purpose, because the close has already
// happened and returning any of them would read to the caller as a failed
// close. Discarding them silently is what makes a stale stage label
// indistinguishable from the outside: a rejected label write and a bug in the
// swap logic leave identical residue on the issue. The log line is the only
// thing that tells them apart, so it is asserted rather than assumed.
//
// The control flow is deliberately unchanged — each subtest re-asserts that the
// close still succeeds — so this test would also catch a future "improvement"
// that turned one of these into a returned error.
func TestPassThroughCloseTask_BestEffortFailuresAreLogged(t *testing.T) {
	ctx := context.Background()

	for _, tc := range []struct {
		name string
		fail func(*fakeIssueRepo)
		want string
	}{
		{"label index", func(f *fakeIssueRepo) { f.failLabelIndex = true }, "label index unavailable"},
		{"label writes", func(f *fakeIssueRepo) { f.failLabelWrites = true }, "removing stage labels"},
		{"post-close re-read", func(f *fakeIssueRepo) { f.failIssueRead = true }, "post-close re-read failed"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fake := newFakeIssueRepo(t, "ft:stage/working")
			tc.fail(fake)
			s := fake.store()

			logged := captureLog(t)
			got, err := s.CloseTask(ctx, s.issueUUID(1), task.StageCompleted, "", uuid.Nil)
			if err != nil {
				t.Fatalf("CloseTask returned %v; a best-effort failure must not fail the close", err)
			}
			if got.ClosedAt == nil {
				t.Errorf("CloseTask reported ClosedAt = nil after a successful close")
			}

			out := logged()
			if !strings.Contains(out, tc.want) {
				t.Errorf("log output %q does not mention %q; the swallowed error left no trace", out, tc.want)
			}
			if !strings.Contains(out, "acme/repo#1") {
				t.Errorf("log output %q does not identify the repo and issue", out)
			}
		})
	}

	// The add-label failure shares failLabelWrites with the remove above, so it
	// needs an issue with no stage label to remove for its line to be the only
	// one emitted.
	t.Run("add label", func(t *testing.T) {
		fake := newFakeIssueRepo(t)
		fake.failLabelWrites = true
		s := fake.store()

		logged := captureLog(t)
		if _, err := s.CloseTask(ctx, s.issueUUID(1), task.StageCompleted, "", uuid.Nil); err != nil {
			t.Fatalf("CloseTask: %v", err)
		}
		if out := logged(); !strings.Contains(out, "adding stage label") {
			t.Errorf("log output %q does not mention the failed label add", out)
		}
	})
}

// captureLog redirects the standard logger for the duration of a test and
// returns the accumulated output. Package log is what the rest of the codebase
// uses (internal/store/multistore.go does the same), so there is no logger to
// inject.
func captureLog(t *testing.T) func() string {
	t.Helper()

	var buf bytes.Buffer
	out, flags := log.Writer(), log.Flags()
	log.SetOutput(&buf)
	log.SetFlags(0)
	t.Cleanup(func() {
		log.SetOutput(out)
		log.SetFlags(flags)
	})
	return buf.String
}
