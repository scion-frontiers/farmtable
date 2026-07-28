package server_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	ghplatform "github.com/farmtable-io/farmtable/internal/platform/github"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── #194: the authorization gate must not read a label-derived value ──
//
// audit-194 F2 stopped a terminal stage label outranking an OPEN GitHub issue
// by demoting (open, terminal-label) to (open, accepted) in IssueToPhaseStage.
// That demotion is a DISPLAY decision, but FarmTableService.UpdateTask fed the
// very same field into the RBAC transition table, so a token holding
// task:write but deliberately NOT task:accept could move a wont_fix /
// duplicate / cancelled issue back into the active pipeline.
//
// Round 3 fixed that by routing the gate through store.LifecycleStage. Round 4
// fixed what round 3 missed: LifecycleStage was built on MapLabelsToStage,
// which collapses a label set to one highest-precedence winner, and
// stagePrecedence ranks every non-terminal stage above every terminal one. One
// extra ordinary label therefore hid the terminal label from the gate.
//
// THE ROUND-3 SUITE COULD NOT SEE THAT, AND THE REASON WAS ONE LINE:
//
//	"labels": {"nodes": [{"name": %q}]},
//
// The fixture took a single string. All 20 cells built an issue with exactly
// one label, so the table was structurally incapable of expressing the attack.
// It was not that the case was considered and skipped — the data shape
// foreclosed it. The fixture below takes a label SET for that reason, and the
// matrix varies the mask, because a count pin over a single-label schema would
// have laundered the blind spot as a verification.
//
// These tests drive a real GitHubPassThroughStore behind a real MultiStore
// behind the real FarmTableService. Nothing here re-implements the transition
// table; the oracle is the scope error the production gate actually returns.

// fixtureStages is every stage the mock repo publishes a label for. Built from
// the production mapper rather than hard-coded strings so that a push_prefix
// change cannot desynchronise fixture from production.
func fixtureStages() []task.Stage {
	return []task.Stage{
		task.StageTriage, task.StageAccepted, task.StageWorking,
		task.StageInReview, task.StageInQa, task.StageDeploying,
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}
}

// stageLabel returns the production label for a stage, e.g. "ft:stage/wont_fix".
func stageLabel(s task.Stage) string {
	return ghplatform.NewLabelMapper(ghplatform.DefaultConfig().GitHub.Labels).StageToLabel(s)
}

// terminalLabelIssueMock serves one OPEN issue whose label set actually
// mutates in response to the label mutations. Statefulness is load-bearing in
// three ways the round-3 inert mock could not manage:
//
//   - the resulting stage can be asserted, so a test cannot pass because
//     UpdateTask succeeded while doing nothing (audit item 5b);
//   - the repo label index genuinely resolves node IDs for the swap, so the
//     fixture's claim to be load-bearing is true (test-194-r3 F4);
//   - a two-call sequence behaves as it would against real GitHub, which is
//     what the self-service escalation needs to be reproducible.
type terminalLabelIssueMock struct {
	mu       sync.Mutex
	labels   []string
	idToName map[string]string
}

func newTerminalLabelIssueMock(t *testing.T, initial []string) (*httptest.Server, *terminalLabelIssueMock) {
	t.Helper()
	m := &terminalLabelIssueMock{
		labels:   append([]string(nil), initial...),
		idToName: make(map[string]string, len(fixtureStages())),
	}
	for _, s := range fixtureStages() {
		m.idToName["L_"+s.String()] = stageLabel(s)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("reading request body: %v", err)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		b := string(body)
		w.Header().Set("Content-Type", "application/json")

		m.mu.Lock()
		defer m.mu.Unlock()

		switch {
		case strings.Contains(b, "addLabelsToLabelable"):
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.add(name)
				}
			}
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))
		case strings.Contains(b, "removeLabelsFromLabelable"):
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.remove(name)
				}
			}
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))
		case strings.Contains(b, "updateIssue"):
			_, _ = w.Write([]byte(`{"data":{"updateIssue":{"issue":` + m.issueJSON() + `}}}`))
		case strings.Contains(b, "issues("):
			// Checked before the label-index case: the issue query selects a
			// nested labels(first:) of its own, so matching on that substring
			// first would swallow every issue list.
			_, _ = w.Write([]byte(`{"data":{"repository":{"issues":{"nodes":[` + m.issueJSON() +
				`],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
		case strings.Contains(b, "issue("):
			_, _ = w.Write([]byte(`{"data":{"repository":{"issue":` + m.issueJSON() + `}}}`))
		case strings.Contains(b, "labels(first:"):
			// The repo label index: name -> node ID, used to resolve mutation
			// targets. The mutations above only take effect for IDs listed
			// here, so emptying this response makes the swaps silently skip —
			// which the stage assertions now catch.
			nodes := make([]string, 0, len(m.idToName))
			for id, name := range m.idToName {
				nodes = append(nodes, fmt.Sprintf(`{"id":%q,"name":%q}`, id, name))
			}
			_, _ = w.Write([]byte(`{"data":{"repository":{"labels":{"nodes":[` +
				strings.Join(nodes, ",") + `],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
		case strings.Contains(b, "repository(owner:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"R_repo1"}}}`))
		default:
			t.Logf("unhandled GraphQL query: %s", b)
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}))
	t.Cleanup(srv.Close)
	return srv, m
}

func (m *terminalLabelIssueMock) add(name string) {
	for _, l := range m.labels {
		if l == name {
			return
		}
	}
	m.labels = append(m.labels, name)
}

func (m *terminalLabelIssueMock) remove(name string) {
	out := m.labels[:0]
	for _, l := range m.labels {
		if l != name {
			out = append(out, l)
		}
	}
	m.labels = out
}

// currentLabels snapshots the issue's live label set.
func (m *terminalLabelIssueMock) currentLabels() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.labels...)
}

func (m *terminalLabelIssueMock) issueJSON() string {
	nodes := make([]string, 0, len(m.labels))
	for _, l := range m.labels {
		nodes = append(nodes, fmt.Sprintf(`{"name":%q}`, l))
	}
	// OPEN + terminal label is exactly the state a GitHub reopen leaves
	// behind: state and closedAt are cleared, labels are not.
	return `{
		"id": "I_issue1", "number": 1, "title": "Abandoned work",
		"body": "A maintainer declined this", "state": "OPEN", "stateReason": null,
		"createdAt": "2026-01-15T10:00:00Z", "updatedAt": "2026-01-16T12:00:00Z",
		"url": "https://github.com/acme/widgets/issues/1",
		"labels": {"nodes": [` + strings.Join(nodes, ",") + `]},
		"assignees": {"nodes": []}, "milestone": null,
		"subIssues": {"nodes": [], "totalCount": 0},
		"subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
		"parent": null
	}`
}

// newTerminalLabelledService wires the production object graph — EntStore →
// MultiStore (+ the real GitHub PlatformResolver shape) → FarmTableService —
// around a single OPEN issue carrying the given label SET.
//
// The label set, not a single label, is the whole point: see the header.
func newTerminalLabelledService(t *testing.T, labels ...string) (*server.FarmTableService, *store.MultiStore, string, uuid.UUID, *terminalLabelIssueMock) {
	t.Helper()
	ctx := context.Background()

	entStore, storeCleanup := testutil.NewTestStore(t)
	t.Cleanup(storeCleanup)

	ms := store.NewMultiStore(entStore)
	t.Cleanup(func() { _ = ms.Close() })

	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "acme/widgets",
		Platform: string(collection.PlatformGithub),
		RemoteID: "acme/widgets",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	if _, err := ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID,
		Platform:     "github",
		AuthToken:    "ghp_mock_test_token",
		AuthMethod:   "pat",
		Scopes:       []string{"repo"},
	}); err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	mockGH, issue := newTerminalLabelIssueMock(t, labels)

	ms.SetResolver(func(platform collection.Platform, token string, rid string, cid uuid.UUID) (store.Store, error) {
		if platform != collection.PlatformGithub {
			return nil, nil
		}
		owner, repo, ok := store.ParseOwnerRepo(rid)
		if !ok {
			return nil, nil
		}
		return newPassThroughStoreWithMock(t, mockGH, owner, repo, cid), nil
	})

	svc := server.NewFarmTableService(ms, "test")

	collIDStr := coll.ID.String()
	list, err := svc.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: &collIDStr})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(list.GetItems()) != 1 {
		t.Fatalf("got %d tasks, want 1", len(list.GetItems()))
	}
	return svc, ms, list.GetItems()[0].GetId(), coll.ID, issue
}

// scopedCtx builds an auth-enforced context carrying an identity and scopes.
func scopedCtx(scopes []string) context.Context {
	ctx := server.ContextWithAuthEnforced(context.Background())
	ctx = server.ContextWithUserID(ctx, uuid.New())
	return server.ContextWithScopes(ctx, scopes)
}

// agentScopes mirrors DefaultScopesForUserType("agent"): task:write yes,
// task:accept and task:close deliberately absent.
func agentScopes() []string {
	return server.DefaultScopesForUserType("agent")
}

// reopenDestinations is every non-terminal stage UpdateTask will accept as a
// destination. StageWorking is excluded because UpdateTask rejects it up front
// with InvalidArgument ("use ClaimTask"), a different gate entirely.
func reopenDestinations() []struct {
	name  string
	stage pb.TaskStage
} {
	return []struct {
		name  string
		stage pb.TaskStage
	}{
		{"triage", pb.TaskStage_TASK_STAGE_TRIAGE},
		{"accepted", pb.TaskStage_TASK_STAGE_ACCEPTED},
		{"in_review", pb.TaskStage_TASK_STAGE_IN_REVIEW},
		{"in_qa", pb.TaskStage_TASK_STAGE_IN_QA},
		{"deploying", pb.TaskStage_TASK_STAGE_DEPLOYING},
	}
}

// terminalLabels is the set of terminal stage labels a maintainer can leave.
func terminalLabels() []string {
	return []string{
		stageLabel(task.StageWontFix),
		stageLabel(task.StageDuplicate),
		stageLabel(task.StageCancelled),
		stageLabel(task.StageCompleted),
	}
}

// maskLabels is every non-terminal stage label that could be added alongside a
// terminal one, plus the empty mask (the unmasked control).
func maskLabels() []string {
	return []string{
		"", // no mask: the round-3 schema, kept as the control
		stageLabel(task.StageTriage),
		stageLabel(task.StageAccepted),
		stageLabel(task.StageWorking),
		stageLabel(task.StageInReview),
		stageLabel(task.StageInQa),
		stageLabel(task.StageDeploying),
	}
}

// TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen is the
// blocking sink-binding for #194. It fails if the authorization gate goes back
// to reading a precedence-collapsed label projection.
//
// SCHEMA — what these rows can and cannot express. A count pin that does not
// say this is an assumption wearing a number, which is precisely how the
// round-3 blind spot would have been cemented:
//
//	CAN express: a terminal label alone, and a terminal label accompanied by
//	  exactly one non-terminal stage label, against every accepted reopen
//	  destination.
//	CANNOT express: two masks at once, non-stage labels, unprefixed labels
//	  (no longer honoured at this gate — see
//	  TestUpdateTask_UnprefixedTerminalLabelIsNoLongerHonoured),
//	  closed issues with a state_reason, or which terminal stage wins when
//	  several are present. The label-set predicate itself is covered on those
//	  axes in internal/platform/github/terminal_label_stage_test.go.
//
// NOTE ON THE triage MASK: those four rows passed even before round 4, but
// only by coincidence — with a triage mask the lifecycle stage became triage,
// and "triage → anything" independently requires task:accept
// (transitions.go). The terminal label was still invisible to the gate. They
// are kept because they must keep passing for the RIGHT reason now, and the
// reason is asserted sharply at the predicate level in the github package.
func TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen(t *testing.T) {
	dests := reopenDestinations()
	terminals := terminalLabels()
	masks := maskLabels()

	// 4 terminal labels x 5 destinations x 7 masks (6 non-terminal stages +
	// the empty mask) = 140 cells.
	const wantCells = 4 * 5 * 7
	if got := len(terminals) * len(dests) * len(masks); got != wantCells {
		t.Fatalf("matrix covers %d cells, want %d (%d terminal labels x %d destinations x "+
			"%d masks). A dimension was changed without updating the pin — and note that "+
			"pinning the count alone is not enough: the mask dimension is what lets these "+
			"rows express the multi-label bypass at all",
			got, wantCells, len(terminals), len(dests), len(masks))
	}

	executed := 0
	for _, dest := range dests {
		for _, label := range terminals {
			for _, mask := range masks {
				executed++
				labels := []string{label}
				name := label + "_to_" + dest.name
				if mask != "" {
					labels = append(labels, mask)
					name += "_masked_by_" + mask
				} else {
					name += "_unmasked"
				}

				t.Run(name, func(t *testing.T) {
					svc, _, taskID, _, issue := newTerminalLabelledService(t, labels...)
					stage := dest.stage
					_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
						Id:    taskID,
						Stage: &stage,
					})
					if err == nil {
						t.Fatalf("UpdateTask moved an OPEN issue labelled %v to %s with an agent "+
							"token (task:write, no task:accept). Reopening a terminal-labelled "+
							"issue is a re-accept and must require task:accept. Labels now: %v",
							labels, dest.name, issue.currentLabels())
					}
					st, _ := status.FromError(err)
					if st.Code() != codes.PermissionDenied {
						t.Fatalf("UpdateTask %v -> %s: got %v (%s), want PermissionDenied",
							labels, dest.name, st.Code(), st.Message())
					}
					if !strings.Contains(st.Message(), server.ScopeTaskAccept) {
						t.Fatalf("UpdateTask %v -> %s: denied for %q, want the denial to name %q",
							labels, dest.name, st.Message(), server.ScopeTaskAccept)
					}
					// The denial must not have been a no-op that also mutated
					// the issue: the terminal label must still be there.
					if got := issue.currentLabels(); !containsLabel(got, label) {
						t.Fatalf("UpdateTask %v -> %s was denied but the terminal label %q is "+
							"gone; labels now %v", labels, dest.name, label, got)
					}
				})
			}
		}
	}

	if executed != wantCells {
		t.Fatalf("executed %d cells, want %d", executed, wantCells)
	}
}

func containsLabel(labels []string, want string) bool {
	for _, l := range labels {
		if l == want {
			return true
		}
	}
	return false
}

// TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue is the
// positive control. Without it, a gate that denied everything would satisfy
// the test above.
//
// It is a DIFFERENTIAL on one fixture rather than a bare allow: the same
// request must be denied without task:accept and allowed with it. A bare allow
// could not distinguish "allowed because the caller holds task:accept on a
// terminal-labelled issue" from "allowed because the fixture never got its
// terminal label" — the round-3 version passed with no terminal label present
// at all (test-194-r3 F3).
//
// It also asserts the RESULTING STAGE. Checking only err == nil would pass if
// UpdateTask succeeded while doing nothing (audit item 5b).
func TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue(t *testing.T) {
	for _, mask := range maskLabels() {
		labels := []string{stageLabel(task.StageWontFix)}
		name := "unmasked"
		if mask != "" {
			labels = append(labels, mask)
			name = "masked_by_" + mask
		}

		t.Run(name, func(t *testing.T) {
			svc, _, taskID, _, issue := newTerminalLabelledService(t, labels...)
			stage := pb.TaskStage_TASK_STAGE_ACCEPTED
			req := &pb.UpdateTaskRequest{Id: taskID, Stage: &stage}

			// Precondition: without task:accept this exact request is denied.
			if _, err := svc.UpdateTask(scopedCtx(agentScopes()), req); err == nil {
				t.Fatalf("precondition failed: %v was reopened without task:accept, so this "+
					"control proves nothing", labels)
			}

			// The property: adding task:accept, and nothing else, flips it.
			if _, err := svc.UpdateTask(scopedCtx(append(agentScopes(), server.ScopeTaskAccept)), req); err != nil {
				t.Fatalf("UpdateTask with task:accept was rejected: %v; holding task:accept must "+
					"be sufficient to reopen a terminal-labelled issue", err)
			}

			// Permitted is not enough — assert the transition happened
			// (audit item 5b). Read it off the issue's labels rather than the
			// returned proto: the response is built from the issue as it stood
			// BEFORE the label swap, so its stage field is stale here.
			after := issue.currentLabels()
			if containsLabel(after, stageLabel(task.StageWontFix)) {
				t.Fatalf("reopen was permitted but the issue still carries the terminal label; "+
					"labels now %v", after)
			}
			if !containsLabel(after, stageLabel(task.StageAccepted)) {
				t.Fatalf("reopen was permitted but the issue did not gain the accepted label; "+
					"labels now %v. The call succeeded while doing nothing", after)
			}
		})
	}
}

// TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite pins the
// OTHER direction of the same regression, which round 2 let through unexamined.
//
// TransitionScope short-circuits to task:write when from == to: re-asserting a
// stage a task already holds is an ordinary write, not a lifecycle transition.
// The F2 demotion broke that no-op detection — it rewrote the source from
// completed to accepted, so "set stage=completed" on an already-completed
// issue stopped looking like a no-op and started looking like a fresh close,
// demanding task:close. That is a denial-of-work regression with no security
// benefit.
//
// Masked rows are included because the round-4 fix has to preserve this
// direction too: making the gate see the terminal label must not turn an
// ordinary restamp into a denial just because a second label is present.
//
// Asserts the resulting stage, not merely err == nil (audit item 5b).
func TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite(t *testing.T) {
	terminals := []struct {
		label string
		stage pb.TaskStage
	}{
		{stageLabel(task.StageCompleted), pb.TaskStage_TASK_STAGE_COMPLETED},
		{stageLabel(task.StageWontFix), pb.TaskStage_TASK_STAGE_WONT_FIX},
		{stageLabel(task.StageDuplicate), pb.TaskStage_TASK_STAGE_DUPLICATE},
		{stageLabel(task.StageCancelled), pb.TaskStage_TASK_STAGE_CANCELLED},
	}
	masks := maskLabels()

	// 4 terminal stages x 7 masks = 28 cells.
	const wantCells = 4 * 7
	if got := len(terminals) * len(masks); got != wantCells {
		t.Fatalf("matrix covers %d cells, want %d (%d terminal stages x %d masks)",
			got, wantCells, len(terminals), len(masks))
	}

	executed := 0
	for _, tc := range terminals {
		for _, mask := range masks {
			executed++
			labels := []string{tc.label}
			name := tc.label
			if mask != "" {
				labels = append(labels, mask)
				name += "_masked_by_" + mask
			}

			t.Run(name, func(t *testing.T) {
				svc, _, taskID, _, issue := newTerminalLabelledService(t, labels...)
				stage := tc.stage
				_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id:    taskID,
					Stage: &stage,
				})
				if err != nil {
					st, _ := status.FromError(err)
					t.Fatalf("re-asserting the stage %s that the issue already carries was "+
						"rejected (%v: %s); from == to is a no-op write and must not require "+
						"task:close. Labels: %v", tc.label, st.Code(), st.Message(), labels)
				}

				// "Permitted" is not enough: the call must have DONE something
				// (audit item 5b). The observable effect is on the issue's
				// labels, not on the returned proto — for an OPEN issue
				// carrying a terminal label the returned DISPLAY stage is
				// deliberately demoted to accepted, and the response is built
				// from the issue as it stood before the label swap ran.
				after := issue.currentLabels()
				if !containsLabel(after, tc.label) {
					t.Fatalf("restamp of %s was permitted but the terminal label is gone; "+
						"labels now %v", tc.label, after)
				}
				// The swap must have cleared the competing stage label, which
				// is the positive evidence that the write actually executed.
				if mask != "" && containsLabel(after, mask) {
					t.Fatalf("restamp of %s was permitted but the competing stage label %q is "+
						"still on the issue; labels now %v. The call returned success while "+
						"performing no label swap", tc.label, mask, after)
				}
			})
		}
	}

	if executed != wantCells {
		t.Fatalf("executed %d cells, want %d", executed, wantCells)
	}
}

// TestUpdateTask_SelfServiceLabelAdditionCannotUnlockAReopen is the regression
// test for what made the round-3 gap Critical rather than High.
//
// The bypass needed a second stage label on the issue, and both the brief and
// the audit initially assumed that required a second actor — a maintainer with
// GitHub triage rights, or a partially failed label swap. It did not.
// UpdateTaskRequest.add_labels is guarded only by the blanket task:write at the
// top of UpdateTask; the transition-scope gate fires only when req.Stage is
// set. So one token could add the masking label and then walk through the gate
// it had just opened, in two ordinary API calls with no GitHub access at all.
//
// This test is that exact chain with the assertion inverted. It requires a
// stateful fixture: step 1 must really change what step 2 reads.
func TestUpdateTask_SelfServiceLabelAdditionCannotUnlockAReopen(t *testing.T) {
	svc, _, taskID, _, issue := newTerminalLabelledService(t, stageLabel(task.StageWontFix))
	dest := pb.TaskStage_TASK_STAGE_ACCEPTED

	// Step 0 — the precondition. If the reopen is already allowed this test
	// proves nothing, so fail hard rather than silently measuring nothing.
	if _, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID, Stage: &dest,
	}); err == nil {
		t.Fatal("precondition failed: the reopen was allowed before any label was added, " +
			"so this probe is not exercising the gate")
	}

	// Step 1 — add the masking label with nothing but task:write. This is
	// expected to succeed: gating add_labels is a separate question (#194
	// deferred / audit F7's mirror). What must NOT happen is step 2.
	if _, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID, AddLabels: []string{stageLabel(task.StageAccepted)},
	}); err != nil {
		t.Fatalf("AddLabels with task:write failed (%v); if label addition became gated this "+
			"test needs rewriting, but the chain below must still be blocked", err)
	}
	labelsAfterAdd := issue.currentLabels()
	if !containsLabel(labelsAfterAdd, stageLabel(task.StageAccepted)) ||
		!containsLabel(labelsAfterAdd, stageLabel(task.StageWontFix)) {
		t.Fatalf("fixture is not stateful: after AddLabels the issue carries %v, want both the "+
			"terminal and the added label. Without the mask actually landing, step 2 below "+
			"would be testing the single-label case and passing for the wrong reason",
			labelsAfterAdd)
	}

	// Step 2 — the escalation. Must still be denied.
	_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID, Stage: &dest,
	})
	if err == nil {
		t.Fatalf("SELF-SERVICE ESCALATION: a token holding only task:write reopened an issue "+
			"still labelled %q, using two ordinary UpdateTask calls and no GitHub access. "+
			"Labels: %v", stageLabel(task.StageWontFix), issue.currentLabels())
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.PermissionDenied || !strings.Contains(st.Message(), server.ScopeTaskAccept) {
		t.Fatalf("step 2 denied with %v (%s), want PermissionDenied naming %q",
			st.Code(), st.Message(), server.ScopeTaskAccept)
	}
}

// TestComputeAvailability_MaskedTerminalLabelIsStillUnavailable pins the
// scheduling sink separately from the authorization one. They share a root
// cause but not an impact class, and this one needs no Farm Table token at
// all — GitHub triage rights are enough to add the mask.
//
// Asserts Reasons contains "terminal", not merely Available == false: the
// latter can pass for the wrong reason (a hold, a future start date, an open
// sub-issue would all make it false).
func TestComputeAvailability_MaskedTerminalLabelIsStillUnavailable(t *testing.T) {
	terminals := terminalLabels()
	masks := maskLabels()

	const wantCells = 4 * 7
	if got := len(terminals) * len(masks); got != wantCells {
		t.Fatalf("matrix covers %d cells, want %d", got, wantCells)
	}

	executed := 0
	for _, label := range terminals {
		for _, mask := range masks {
			executed++
			labels := []string{label}
			name := label
			if mask != "" {
				labels = append(labels, mask)
				name += "_masked_by_" + mask
			}

			t.Run(name, func(t *testing.T) {
				_, ms, _, collID, _ := newTerminalLabelledService(t, labels...)
				tasks, _, err := ms.ListTasks(context.Background(), store.ListTasksParams{
					CollectionID: &collID,
				})
				if err != nil {
					t.Fatalf("ListTasks: %v", err)
				}
				if len(tasks) != 1 {
					t.Fatalf("got %d tasks, want 1", len(tasks))
				}

				avail, err := ms.ComputeAvailability(context.Background(), tasks[0])
				if err != nil {
					t.Fatalf("ComputeAvailability: %v", err)
				}
				if !hasReason(avail.Reasons, store.AvailabilityReasonTerminal) {
					t.Fatalf("an OPEN issue labelled %v reports Available=%v Reasons=%v, want "+
						"Reasons to contain %q. A maintainer's terminal label must keep the "+
						"task out of the ready queue whatever else is labelled on it",
						labels, avail.Available, avail.Reasons, store.AvailabilityReasonTerminal)
				}
				if avail.Available {
					t.Fatalf("labels %v: Available=true despite reasons %v", labels, avail.Reasons)
				}
			})
		}
	}

	if executed != wantCells {
		t.Fatalf("executed %d cells, want %d", executed, wantCells)
	}
}

// sameLabels compares two label sets as sets.
func sameLabels(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for _, l := range a {
		if !containsLabel(b, l) {
			return false
		}
	}
	return true
}

func hasReason(reasons []store.AvailabilityReason, want store.AvailabilityReason) bool {
	for _, r := range reasons {
		if r == want {
			return true
		}
	}
	return false
}

// TestClaimTask_MaskedTerminalLabelIsNotClaimable pins the THIRD sink.
//
// LifecycleStage has three consumers, not two: authorization (UpdateTask),
// availability (advisory), and the claim gate (enforcement). The claim gate is
// the one that actually hands work to an agent — under the round-3 bug a
// masked wont_fix issue claimed successfully and got stamped
// ft:stage/working=true.
//
// The assertion is store.ErrUnavailable specifically, not "some error". A
// transport or fixture error also makes err != nil, and would launder a bypass
// as a denial — that happened to this author's own first probe, which reported
// the gate holding when in fact the claim had gone through and only failed
// afterwards on an unrelated mock gap.
//
// Do not prune the masks that look redundant. Measured against the round-3
// implementation, only 4 of these 28 cells actually bypassed, and all 4 were
// the ft:stage/accepted mask — because issueUnavailableForClaim's first arm is
// `lifecycleStage != task.StageAccepted`, a positive whitelist, so every other
// mask still resolves to a non-accepted stage and is refused for an unrelated
// reason. That makes the claim gate's exposure exactly one mask value today,
// narrower than the authorization sink's. It is a property of that arm's
// current shape, not a guarantee: rewrite it as an IsTerminalStage check and
// the other 24 cells become live. They are here to catch that.
func TestClaimTask_MaskedTerminalLabelIsNotClaimable(t *testing.T) {
	terminals := terminalLabels()
	masks := maskLabels()

	const wantCells = 4 * 7
	if got := len(terminals) * len(masks); got != wantCells {
		t.Fatalf("matrix covers %d cells, want %d", got, wantCells)
	}

	executed := 0
	for _, label := range terminals {
		for _, mask := range masks {
			executed++
			labels := []string{label}
			name := label
			if mask != "" {
				labels = append(labels, mask)
				name += "_masked_by_" + mask
			}

			t.Run(name, func(t *testing.T) {
				_, ms, _, collID, issue := newTerminalLabelledService(t, labels...)
				tasks, _, err := ms.ListTasks(context.Background(), store.ListTasksParams{
					CollectionID: &collID,
				})
				if err != nil || len(tasks) != 1 {
					t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
				}
				before := issue.currentLabels()

				_, claimErr := ms.ClaimTask(context.Background(), tasks[0].ID, uuid.New(), "")
				if !errors.Is(claimErr, store.ErrUnavailable) {
					t.Fatalf("ClaimTask on an OPEN issue labelled %v returned %v, want "+
						"store.ErrUnavailable from the claim gate. Anything else means the "+
						"gate did not fire — including a nil error (work a maintainer "+
						"declined was handed to an agent) and a transport error (the claim "+
						"proceeded past the gate and failed later). Labels now: %v",
						labels, claimErr, issue.currentLabels())
				}
				// A refused claim must have no side effects at all. Compared
				// against the pre-call snapshot rather than just looking for
				// the working label, because one of the masks IS the working
				// label and the fixture supplied it.
				if after := issue.currentLabels(); !sameLabels(before, after) {
					t.Fatalf("ClaimTask was refused for %v but mutated the issue's labels: "+
						"%v -> %v. A refused claim must not stamp anything", labels, before, after)
				}
			})
		}
	}

	if executed != wantCells {
		t.Fatalf("executed %d cells, want %d", executed, wantCells)
	}
}

// TestUpdateTask_UnprefixedTerminalLabelIsNoLongerHonoured is the INVERSION of
// TestUpdateTask_UnprefixedTerminalLabelIsHonouredToday, which pinned the
// opposite answer for exactly this input. It is rewritten rather than deleted:
// the old assertion was a deliberate deferral with a documented ruling attached,
// and a reader must be able to see the ruling land rather than find the pin
// gone. Its own failure message said so — "you are probably implementing that
// ruling — update it rather than working around it."
//
// WHAT IT USED TO ASSERT. stripForMatch removes the configured prefix before
// lookup and NewLabelMapper registers every bare stage name as a key, so an
// unprefixed "duplicate" — shipped in every new GitHub repository, appliable by
// anyone with triage rights — was indistinguishable from "ft:stage/duplicate"
// at all three gates, and reopening such an issue cost task:accept.
//
// WHAT CHANGED (#194 round 5, B6). A label may contribute to an authorization
// or terminal-stage determination only if it carries the configured push
// prefix; prefix-tolerant matching is a display affordance. Round 4 made this
// urgent rather than merely untidy: replacing the precedence collapse with a
// whole-set scan was correct, and it promoted the stock label from "usually
// masked by any other stage label" to "authoritative", changing 12 cells. A
// label with a lower permission bar than an explicit ft: one must not decide a
// Farm Table privilege question.
//
// The original ruling recorded here — key off closed state + state_reason
// instead of matching labels at all — is NOT what landed and is still open. B6
// is narrower: it says which labels may be read, not that labels should stop
// being read. Moving authoritative state off labels entirely is #203.
//
// The cost is real and accepted: a maintainer who declines work with only the
// stock label now gets no protection from Farm Table, so the task reads as
// live. Wrongly available is the safe direction; wrongly privileged is not.
func TestUpdateTask_UnprefixedTerminalLabelIsNoLongerHonoured(t *testing.T) {
	svc, _, taskID, _, _ := newTerminalLabelledService(t, "duplicate")
	stage := pb.TaskStage_TASK_STAGE_ACCEPTED

	if _, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID, Stage: &stage,
	}); err != nil {
		t.Fatalf("the bare stock label \"duplicate\" still raises the scope required to "+
			"reopen (%v). Since B6 only a prefixed label may feed an authorization "+
			"decision, so this must cost no more than task:write", err)
	}

	// POSITIVE CONTROL, and the load-bearing half: the prefixed spelling must
	// still be honoured. Without it, this test passes just as well if the
	// terminal scan were deleted outright.
	svcPrefixed, _, prefixedID, _, _ := newTerminalLabelledService(t, stageLabel(task.StageDuplicate))
	prefixedStage := pb.TaskStage_TASK_STAGE_ACCEPTED
	_, err := svcPrefixed.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: prefixedID, Stage: &prefixedStage,
	})
	if err == nil {
		t.Fatalf("CONTROL BROKEN: \"%s\" no longer raises the scope required to reopen "+
			"either. B6 was meant to narrow which labels are read, not to stop reading "+
			"them; this says the terminal scan is dead", stageLabel(task.StageDuplicate))
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.PermissionDenied || !strings.Contains(st.Message(), server.ScopeTaskAccept) {
		t.Fatalf("prefixed duplicate denied with %v (%s), want PermissionDenied naming %q",
			st.Code(), st.Message(), server.ScopeTaskAccept)
	}

	// Control: an ordinary non-stage label must NOT raise the requirement, so
	// the allow above cannot be an artefact of the gate allowing everything...
	// which it also cannot be, given the denial just measured.
	svc2, _, taskID2, _, _ := newTerminalLabelledService(t, "bug")
	stage2 := pb.TaskStage_TASK_STAGE_ACCEPTED
	if _, err := svc2.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: taskID2, Stage: &stage2,
	}); err != nil {
		t.Fatalf("CONTROL BROKEN: an issue labelled only \"bug\" could not be moved to accepted "+
			"with an agent token (%v); the gate is denying unrelated writes", err)
	}
}
