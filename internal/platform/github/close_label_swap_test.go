package github

import (
	"context"
	"encoding/json"
	"fmt"
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

	closeCalls  int
	addCalls    int
	removeCalls int
}

func newFakeIssueRepo(t *testing.T, labels ...string) *fakeIssueRepo {
	t.Helper()
	return &fakeIssueRepo{
		t:      t,
		id:     "ISSUE1",
		number: 1,
		state:  "OPEN",
		labels: labels,
		labelIDs: map[string]string{
			"ft:stage/triage":    "L_TRIAGE",
			"ft:stage/accepted":  "L_ACCEPTED",
			"ft:stage/working":   "L_WORKING",
			"ft:stage/completed": "L_COMPLETED",
			"ft:stage/wont_fix":  "L_WONTFIX",
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
		kept := f.labels[:0]
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
			f.state = "CLOSED"
			f.closedAt = "2026-01-02T00:00:00Z"
			if strings.Contains(body, "NOT_PLANNED") {
				f.stateReason = "NOT_PLANNED"
			} else {
				f.stateReason = "COMPLETED"
			}
			_, _ = fmt.Fprintf(w, `{"data":{"closeIssue":{"issue":%s}}}`, f.issueJSON())

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
				_, _ = fmt.Fprintf(w, `{"data":{"repository":{"issue":%s}}}`, f.issueJSON())
			case strings.Contains(body, "issues("):
				_, _ = fmt.Fprintf(w,
					`{"data":{"repository":{"issues":{"nodes":[%s],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`,
					f.issueJSON())
			case strings.Contains(body, "labels("):
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
	return &GitHubPassThroughStore{
		gql:          testGraphQLClient(f.t, f.handler()),
		mapper:       NewLabelMapper(DefaultConfig().GitHub.Labels),
		owner:        "acme",
		repo:         "repo",
		collectionID: uuid.New(),
	}
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
