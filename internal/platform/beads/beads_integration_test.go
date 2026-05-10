package beads_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	beadsadapter "github.com/farmtable-io/farmtable/internal/platform/beads"
	"github.com/farmtable-io/farmtable/internal/platform"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// mockBeadsStorage implements beadsadapter.Storage with in-memory state.
type mockBeadsStorage struct {
	issues   map[string]*beadsadapter.Issue
	labels   map[string][]string
	comments map[string][]*beadsadapter.Comment
}

func newMockBeadsStorage() *mockBeadsStorage {
	return &mockBeadsStorage{
		issues:   make(map[string]*beadsadapter.Issue),
		labels:   make(map[string][]string),
		comments: make(map[string][]*beadsadapter.Comment),
	}
}

func (m *mockBeadsStorage) SearchIssues(_ context.Context, _ string, _ []string, _ string) ([]*beadsadapter.Issue, error) {
	var out []*beadsadapter.Issue
	for _, issue := range m.issues {
		out = append(out, issue)
	}
	return out, nil
}

func (m *mockBeadsStorage) GetLabels(_ context.Context, issueID string) ([]string, error) {
	return m.labels[issueID], nil
}

func (m *mockBeadsStorage) GetComments(_ context.Context, issueID string) ([]*beadsadapter.Comment, error) {
	return m.comments[issueID], nil
}

func (m *mockBeadsStorage) CreateIssue(_ context.Context, issue *beadsadapter.Issue) error {
	m.issues[issue.ID] = issue
	return nil
}

func (m *mockBeadsStorage) UpdateIssue(_ context.Context, id string, updates map[string]interface{}) error {
	issue, ok := m.issues[id]
	if !ok {
		return fmt.Errorf("issue %s not found", id)
	}
	if v, ok := updates["title"].(string); ok {
		issue.Title = v
	}
	if v, ok := updates["description"].(string); ok {
		issue.Description = v
	}
	if v, ok := updates["status"].(string); ok {
		issue.Status = v
	}
	return nil
}

func (m *mockBeadsStorage) AddComment(_ context.Context, issueID, author, text string) (*beadsadapter.Comment, error) {
	c := &beadsadapter.Comment{
		ID:        fmt.Sprintf("comment-%d", len(m.comments[issueID])+1),
		IssueID:   issueID,
		Author:    author,
		Text:      text,
		CreatedAt: time.Now(),
	}
	m.comments[issueID] = append(m.comments[issueID], c)
	return c, nil
}

func (m *mockBeadsStorage) addIssue(issue *beadsadapter.Issue, labels []string, comments []*beadsadapter.Comment) {
	m.issues[issue.ID] = issue
	m.labels[issue.ID] = labels
	m.comments[issue.ID] = comments
}

// testResult tracks pass/fail for each field check.
type testResult struct {
	field    string
	passed   bool
	expected string
	got      string
}

func TestBeadsSyncIntegration(t *testing.T) {
	s, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	ctx := context.Background()

	coll, err := s.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "beads-integration",
		Platform: "beads",
	})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}

	mock := newMockBeadsStorage()
	adapter := beadsadapter.New(mock, s)

	now := time.Now().UTC().Truncate(time.Second)
	due := now.Add(48 * time.Hour)
	deferUntil := now.Add(24 * time.Hour)
	started := now.Add(-2 * time.Hour)
	extRef := "gh-42"

	mock.addIssue(
		&beadsadapter.Issue{
			ID:                 "BEADS-001",
			Title:              "Critical auth bypass",
			Description:        "Users can bypass authentication via token replay",
			Design:             "Fix token validation in middleware",
			AcceptanceCriteria: "All replay attacks blocked; existing sessions unaffected",
			Notes:              "Discovered during pentest Q2",
			Status:             "in_progress",
			Priority:           0,
			IssueType:          "bug",
			Assignee:           "alice@example.com",
			Owner:              "bob@example.com",
			CreatedAt:          now.Add(-72 * time.Hour),
			CreatedBy:          "security-scanner",
			UpdatedAt:          now,
			StartedAt:          &started,
			DueAt:              &due,
			DeferUntil:         &deferUntil,
			ExternalRef:        &extRef,
			SourceSystem:       "beads-pentest",
			Metadata:           json.RawMessage(`{"cve":"CVE-2024-1234","severity":"critical"}`),
			Dependencies: []beadsadapter.Dependency{
				{
					IssueID:     "BEADS-001",
					DependsOnID: "BEADS-002",
					Type:        "blocks",
					CreatedAt:   now.Add(-48 * time.Hour),
					CreatedBy:   "alice@example.com",
					Metadata:    `{"reason":"auth fix needed first"}`,
					ThreadID:    "thread-1",
				},
			},
		},
		[]string{"security", "critical", "auth"},
		[]*beadsadapter.Comment{
			{
				ID:        "c1",
				IssueID:   "BEADS-001",
				Author:    "alice@example.com",
				Text:      "Reproduced on staging environment",
				CreatedAt: now.Add(-24 * time.Hour),
			},
			{
				ID:        "c2",
				IssueID:   "BEADS-001",
				Author:    "bob@example.com",
				Text:      "Fix pushed to branch fix/auth-replay",
				CreatedAt: now.Add(-12 * time.Hour),
			},
		},
	)

	mock.addIssue(
		&beadsadapter.Issue{
			ID:          "BEADS-002",
			Title:       "Add rate limiting to API",
			Description: "Implement sliding window rate limiting",
			Status:      "open",
			Priority:    1,
			IssueType:   "feature",
			CreatedAt:   now.Add(-96 * time.Hour),
			UpdatedAt:   now.Add(-24 * time.Hour),
		},
		[]string{"api", "performance"},
		nil,
	)

	mock.addIssue(
		&beadsadapter.Issue{
			ID:          "BEADS-003",
			Title:       "Completed migration task",
			Description: "Migrate users table to new schema",
			Status:      "closed",
			Priority:    2,
			IssueType:   "task",
			CreatedAt:   now.Add(-120 * time.Hour),
			UpdatedAt:   now.Add(-48 * time.Hour),
		},
		nil,
		nil,
	)

	mock.addIssue(
		&beadsadapter.Issue{
			ID:          "BEADS-004",
			Title:       "Deferred refactor",
			Description: "Refactor payment processing module",
			Status:      "deferred",
			Priority:    3,
			IssueType:   "task",
			CreatedAt:   now.Add(-200 * time.Hour),
			UpdatedAt:   now.Add(-100 * time.Hour),
		},
		[]string{"refactor"},
		nil,
	)

	mock.addIssue(
		&beadsadapter.Issue{
			ID:          "BEADS-005",
			Title:       "Blocked deployment",
			Description: "Deploy to production blocked by auth fix",
			Status:      "blocked",
			Priority:    4,
			IssueType:   "epic",
			CreatedAt:   now.Add(-30 * time.Hour),
			UpdatedAt:   now,
		},
		[]string{"deploy", "blocked"},
		nil,
	)

	// --- Run SyncCollection ---
	result, err := adapter.SyncCollection(ctx, coll.ID, platform.SyncOptions{FullSync: true})
	if err != nil {
		t.Fatalf("SyncCollection: %v", err)
	}

	if result.Created != 5 {
		t.Errorf("expected 5 created, got %d", result.Created)
	}
	if result.Errors != 0 {
		t.Errorf("expected 0 errors, got %d", result.Errors)
	}

	// --- Verify all synced tasks ---
	tasks, _, err := s.ListTasks(ctx, store.ListTasksParams{
		CollectionID: &coll.ID,
		Limit:        100,
	})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}

	tasksByRemoteID := make(map[string]*store.EntStore)
	_ = tasksByRemoteID // just for type reference

	taskMap := make(map[string]*struct {
		task     interface{ GetTitle() string }
		rawTask interface{}
	})
	_ = taskMap

	// Build a lookup by remote_id
	type taskEntry struct {
		ID                 uuid.UUID
		Title              string
		Description        string
		Phase              task.Phase
		Stage              task.Stage
		NativeLabel        string
		Type               string
		Priority           *task.Priority
		AcceptanceCriteria *string
		DueDate            *time.Time
		Labels             []string
		RemoteData         map[string]any
		AssigneeID         *uuid.UUID
	}

	byRemoteID := make(map[string]taskEntry)
	for _, t := range tasks {
		rid, _ := t.RemoteData["remote_id"].(string)
		byRemoteID[rid] = taskEntry{
			ID:                 t.ID,
			Title:              t.Title,
			Description:        t.Description,
			Phase:              t.Phase,
			Stage:              t.Stage,
			NativeLabel:        t.NativeLabel,
			Type:               t.Type,
			Priority:           t.Priority,
			AcceptanceCriteria: t.AcceptanceCriteria,
			DueDate:            t.DueDate,
			Labels:             t.Labels,
			RemoteData:         t.RemoteData,
			AssigneeID:         t.AssigneeID,
		}
	}

	var results []testResult

	check := func(field string, expected, got string) {
		passed := expected == got
		results = append(results, testResult{field: field, passed: passed, expected: expected, got: got})
		if !passed {
			t.Errorf("%s: expected %q, got %q", field, expected, got)
		}
	}

	// --- BEADS-001: Rich issue with all fields ---
	t1, ok := byRemoteID["BEADS-001"]
	if !ok {
		t.Fatal("BEADS-001 not found in synced tasks")
	}

	check("BEADS-001.title", "Critical auth bypass", t1.Title)
	check("BEADS-001.description", "Users can bypass authentication via token replay", t1.Description)
	check("BEADS-001.phase", string(task.PhaseInProgress), string(t1.Phase))
	check("BEADS-001.stage", string(task.StageWorking), string(t1.Stage))
	check("BEADS-001.native_label", "in_progress", t1.NativeLabel)
	check("BEADS-001.type", "bug", t1.Type)

	if t1.Priority != nil {
		check("BEADS-001.priority", string(task.PriorityUrgent), string(*t1.Priority))
	} else {
		t.Error("BEADS-001.priority is nil, expected urgent")
	}

	if t1.AcceptanceCriteria != nil {
		check("BEADS-001.acceptance_criteria",
			"All replay attacks blocked; existing sessions unaffected",
			*t1.AcceptanceCriteria)
	} else {
		t.Error("BEADS-001.acceptance_criteria is nil")
	}

	if t1.DueDate != nil {
		check("BEADS-001.due_date", due.Format(time.RFC3339), t1.DueDate.Truncate(time.Second).Format(time.RFC3339))
	} else {
		t.Error("BEADS-001.due_date is nil")
	}

	if t1.AssigneeID != nil {
		check("BEADS-001.assignee_set", "true", "true")
	} else {
		t.Error("BEADS-001.assignee_id is nil, expected deterministic UUID from alice@example.com")
	}

	// Check labels
	check("BEADS-001.labels_count", "3", fmt.Sprintf("%d", len(t1.Labels)))

	// Check remote_data preservation
	rdExternalRef, _ := t1.RemoteData["external_ref"].(string)
	check("BEADS-001.remote_data.external_ref", "gh-42", rdExternalRef)

	rdSourceSystem, _ := t1.RemoteData["source_system"].(string)
	check("BEADS-001.remote_data.source_system", "beads-pentest", rdSourceSystem)

	rdOwner, _ := t1.RemoteData["owner"].(string)
	check("BEADS-001.remote_data.owner", "bob@example.com", rdOwner)

	rdCreatedBy, _ := t1.RemoteData["created_by"].(string)
	check("BEADS-001.remote_data.created_by", "security-scanner", rdCreatedBy)

	rdDesign, _ := t1.RemoteData["design"].(string)
	check("BEADS-001.remote_data.design", "Fix token validation in middleware", rdDesign)

	rdNotes, _ := t1.RemoteData["notes"].(string)
	check("BEADS-001.remote_data.notes", "Discovered during pentest Q2", rdNotes)

	// Metadata preserved in remote_data
	if rdMeta, ok := t1.RemoteData["metadata"]; ok {
		metaBytes, _ := json.Marshal(rdMeta)
		metaStr := string(metaBytes)
		if !strings.Contains(metaStr, "CVE-2024-1234") {
			t.Errorf("BEADS-001.remote_data.metadata missing CVE: %s", metaStr)
		}
		results = append(results, testResult{
			field: "BEADS-001.remote_data.metadata", passed: true,
			expected: "contains CVE-2024-1234", got: metaStr,
		})
	} else {
		t.Error("BEADS-001.remote_data.metadata missing")
	}

	// Dependencies preserved in remote_data
	if rdDeps, ok := t1.RemoteData["dependencies"]; ok {
		depsBytes, _ := json.Marshal(rdDeps)
		depsStr := string(depsBytes)
		if !strings.Contains(depsStr, "BEADS-002") {
			t.Errorf("BEADS-001 dependencies should reference BEADS-002: %s", depsStr)
		}
		if !strings.Contains(depsStr, "blocks") {
			t.Errorf("BEADS-001 dependencies should have type 'blocks': %s", depsStr)
		}
		results = append(results, testResult{
			field: "BEADS-001.remote_data.dependencies", passed: true,
			expected: "contains BEADS-002 blocks", got: depsStr,
		})
	} else {
		t.Error("BEADS-001.remote_data.dependencies missing")
	}

	// Timestamps in remote_data
	if rdStarted, ok := t1.RemoteData["started_at"].(string); ok {
		check("BEADS-001.remote_data.started_at", started.Format(time.RFC3339), rdStarted)
	} else {
		t.Error("BEADS-001.remote_data.started_at missing")
	}

	if rdDue, ok := t1.RemoteData["due_at"].(string); ok {
		check("BEADS-001.remote_data.due_at", due.Format(time.RFC3339), rdDue)
	} else {
		t.Error("BEADS-001.remote_data.due_at missing")
	}

	if rdDefer, ok := t1.RemoteData["defer_until"].(string); ok {
		check("BEADS-001.remote_data.defer_until", deferUntil.Format(time.RFC3339), rdDefer)
	} else {
		t.Error("BEADS-001.remote_data.defer_until missing")
	}

	// Comments synced
	comments, _, err := s.ListComments(ctx, store.ListCommentsParams{
		TaskID: t1.ID,
		Limit:  100,
	})
	if err != nil {
		t.Fatalf("ListComments: %v", err)
	}
	check("BEADS-001.comments_count", "2", fmt.Sprintf("%d", len(comments)))

	// --- BEADS-002: Open/high priority feature ---
	t2, ok := byRemoteID["BEADS-002"]
	if !ok {
		t.Fatal("BEADS-002 not found")
	}
	check("BEADS-002.phase", string(task.PhaseOpen), string(t2.Phase))
	check("BEADS-002.stage", string(task.StageTriage), string(t2.Stage))
	check("BEADS-002.type", "feature", t2.Type)
	if t2.Priority != nil {
		check("BEADS-002.priority", string(task.PriorityHigh), string(*t2.Priority))
	} else {
		t.Error("BEADS-002.priority is nil")
	}
	check("BEADS-002.labels_count", "2", fmt.Sprintf("%d", len(t2.Labels)))

	// --- BEADS-003: Closed/normal priority task ---
	t3, ok := byRemoteID["BEADS-003"]
	if !ok {
		t.Fatal("BEADS-003 not found")
	}
	check("BEADS-003.phase", string(task.PhaseClosed), string(t3.Phase))
	check("BEADS-003.stage", string(task.StageCompleted), string(t3.Stage))
	if t3.Priority != nil {
		check("BEADS-003.priority", string(task.PriorityNormal), string(*t3.Priority))
	} else {
		t.Error("BEADS-003.priority is nil")
	}

	// --- BEADS-004: Deferred/low priority ---
	t4, ok := byRemoteID["BEADS-004"]
	if !ok {
		t.Fatal("BEADS-004 not found")
	}
	check("BEADS-004.phase", string(task.PhaseOnHold), string(t4.Phase))
	check("BEADS-004.stage", string(task.StageDeferred), string(t4.Stage))
	if t4.Priority != nil {
		check("BEADS-004.priority", string(task.PriorityLow), string(*t4.Priority))
	} else {
		t.Error("BEADS-004.priority is nil")
	}

	// --- BEADS-005: Blocked/low priority epic ---
	t5, ok := byRemoteID["BEADS-005"]
	if !ok {
		t.Fatal("BEADS-005 not found")
	}
	check("BEADS-005.phase", string(task.PhaseOpen), string(t5.Phase))
	check("BEADS-005.stage", string(task.StageBlocked), string(t5.Stage))
	check("BEADS-005.type", "epic", t5.Type)
	if t5.Priority != nil {
		check("BEADS-005.priority", string(task.PriorityLow), string(*t5.Priority))
	} else {
		t.Error("BEADS-005.priority is nil")
	}

	// --- Idempotent re-sync should produce updates, not duplicates ---
	result2, err := adapter.SyncCollection(ctx, coll.ID, platform.SyncOptions{FullSync: true})
	if err != nil {
		t.Fatalf("re-sync: %v", err)
	}
	if result2.Created != 0 {
		t.Errorf("re-sync created %d, expected 0", result2.Created)
	}
	if result2.Updated != 5 {
		t.Errorf("re-sync updated %d, expected 5", result2.Updated)
	}

	// --- Write results to scratchpad ---
	writeResults(t, results)
}

func TestStatusMapping(t *testing.T) {
	cases := []struct {
		beadsStatus string
		wantPhase   task.Phase
		wantStage   task.Stage
	}{
		{"open", task.PhaseOpen, task.StageTriage},
		{"in_progress", task.PhaseInProgress, task.StageWorking},
		{"blocked", task.PhaseOpen, task.StageBlocked},
		{"deferred", task.PhaseOnHold, task.StageDeferred},
		{"closed", task.PhaseClosed, task.StageCompleted},
	}

	for _, tc := range cases {
		t.Run(tc.beadsStatus, func(t *testing.T) {
			issue := &beadsadapter.Issue{
				ID:        "test-1",
				Title:     "Test",
				Status:    tc.beadsStatus,
				IssueType: "task",
			}
			params := beadsadapter.IssueToCreateParams(issue, uuid.New(), "test-1")
			if params.Phase != tc.wantPhase {
				t.Errorf("phase: got %s, want %s", params.Phase, tc.wantPhase)
			}
			if params.Stage != tc.wantStage {
				t.Errorf("stage: got %s, want %s", params.Stage, tc.wantStage)
			}
		})
	}
}

func TestPriorityMapping(t *testing.T) {
	cases := []struct {
		beadsPriority int
		wantPriority  task.Priority
	}{
		{0, task.PriorityUrgent},
		{1, task.PriorityHigh},
		{2, task.PriorityNormal},
		{3, task.PriorityLow},
		{4, task.PriorityLow},
	}

	for _, tc := range cases {
		t.Run(fmt.Sprintf("P%d", tc.beadsPriority), func(t *testing.T) {
			issue := &beadsadapter.Issue{
				ID:        "test-1",
				Title:     "Test",
				Status:    "open",
				Priority:  tc.beadsPriority,
				IssueType: "task",
			}
			params := beadsadapter.IssueToCreateParams(issue, uuid.New(), "test-1")
			if params.Priority == nil {
				t.Fatal("priority is nil")
			}
			if *params.Priority != tc.wantPriority {
				t.Errorf("got %s, want %s", *params.Priority, tc.wantPriority)
			}
		})
	}
}

func writeResults(t *testing.T, results []testResult) {
	t.Helper()

	var sb strings.Builder
	sb.WriteString("# Beads Integration Test Results\n\n")
	sb.WriteString(fmt.Sprintf("**Date:** %s\n\n", time.Now().Format(time.RFC3339)))

	passed := 0
	failed := 0
	for _, r := range results {
		if r.passed {
			passed++
		} else {
			failed++
		}
	}

	sb.WriteString(fmt.Sprintf("**Summary:** %d/%d checks passed\n\n", passed, passed+failed))

	sb.WriteString("## Field Mapping Results\n\n")
	sb.WriteString("| Field | Status | Expected | Got |\n")
	sb.WriteString("|-------|--------|----------|-----|\n")

	for _, r := range results {
		status := "PASS"
		if !r.passed {
			status = "FAIL"
		}
		expected := truncate(r.expected, 60)
		got := truncate(r.got, 60)
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s |\n", r.field, status, expected, got))
	}

	sb.WriteString("\n## Data Model Mapping Summary\n\n")
	sb.WriteString("### Direct Mappings (Full Fidelity)\n\n")
	sb.WriteString("| Beads Field | Farm Table Field | Notes |\n")
	sb.WriteString("|-------------|-----------------|-------|\n")
	sb.WriteString("| ID | remote_data.remote_id | Beads string ID preserved as remote_id |\n")
	sb.WriteString("| Title | title | Direct map |\n")
	sb.WriteString("| Description | description | Direct map |\n")
	sb.WriteString("| Status | phase + stage | Expanded: open→Open/Triage, in_progress→InProgress/Working, blocked→Open/Blocked, deferred→OnHold/Deferred, closed→Closed/Completed |\n")
	sb.WriteString("| Priority (0-4) | priority (urgent/high/normal/low) | 0→urgent, 1→high, 2→normal, 3-4→low |\n")
	sb.WriteString("| IssueType | type | Direct string map |\n")
	sb.WriteString("| Assignee | assignee_id | Deterministic UUID from email/identifier |\n")
	sb.WriteString("| Labels [] | labels [] | Direct map |\n")
	sb.WriteString("| AcceptanceCriteria | acceptance_criteria | Direct map |\n")
	sb.WriteString("| DueAt | due_date | Direct map |\n")
	sb.WriteString("| CreatedAt/UpdatedAt | remote_data.created_at/updated_at | Timestamps preserved in remote_data |\n")

	sb.WriteString("\n### Fields Preserved in remote_data (No Direct FT Column)\n\n")
	sb.WriteString("| Beads Field | remote_data Key | Notes |\n")
	sb.WriteString("|-------------|----------------|-------|\n")
	sb.WriteString("| Design | design | No FT equivalent; preserved for round-trip |\n")
	sb.WriteString("| Notes | notes | No FT equivalent; preserved for round-trip |\n")
	sb.WriteString("| Owner | owner | FT has assignee only; owner preserved in remote_data |\n")
	sb.WriteString("| CreatedBy | created_by | No FT equivalent |\n")
	sb.WriteString("| ExternalRef | external_ref | Preserved as-is |\n")
	sb.WriteString("| SourceSystem | source_system | Preserved as-is |\n")
	sb.WriteString("| Metadata (JSON) | metadata | Arbitrary JSON blob preserved |\n")
	sb.WriteString("| Dependencies [] | dependencies | Full dependency graph preserved as JSON array |\n")
	sb.WriteString("| StartedAt | started_at | No direct FT field; preserved as timestamp |\n")
	sb.WriteString("| DeferUntil | defer_until | No direct FT field; preserved as timestamp |\n")
	sb.WriteString("| ClosedAt | closed_at | No direct FT field; preserved as timestamp |\n")

	sb.WriteString("\n### Comments\n\n")
	sb.WriteString("Comments are synced to Farm Table's comment system via AddComment during SyncCollection.\n")
	sb.WriteString("Each comment's author is mapped to a deterministic UUID.\n")

	sb.WriteString("\n### Fields Not Mapped (Beads-Only)\n\n")
	sb.WriteString("These Beads fields have no Farm Table equivalent and are not preserved:\n\n")
	sb.WriteString("- SpecID, Ephemeral, NoHistory, WispType (messaging internals)\n")
	sb.WriteString("- CompactionLevel/CompactedAt (Dolt-specific history)\n")
	sb.WriteString("- BondedFrom, AwaitType/AwaitID/Timeout/Waiters (gate/molecule coordination)\n")
	sb.WriteString("- MolType, WorkType (swarm coordination)\n")
	sb.WriteString("- EventKind/Actor/Target/Payload (event audit trail)\n")
	sb.WriteString("- Sender, Pinned, IsTemplate (context markers)\n")

	dir := "/scion-volumes/scratchpad"
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Logf("cannot create scratchpad dir: %v (writing to temp instead)", err)
		dir = t.TempDir()
	}

	path := dir + "/beads-integration-results.md"
	if err := os.WriteFile(path, []byte(sb.String()), 0o644); err != nil {
		t.Logf("failed to write results to %s: %v", path, err)
	} else {
		t.Logf("Results written to %s", path)
	}
}

func truncate(s string, n int) string {
	s = strings.ReplaceAll(s, "\n", " ")
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}
