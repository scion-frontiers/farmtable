package server_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── #194 round 5: the WRITE side of the label-derived lifecycle stage ──
//
// Round 4 closed the READ side. store.LifecycleStage now scans the label SET
// for a terminal stage instead of asking a precedence-collapsed projection, so
// the authorization gate, ComputeAvailability and the claim gate all see a
// maintainer's ft:stage/wont_fix even when another stage label is masking it.
//
// The attack moved to the write side. UpdateTaskRequest.add_labels and
// .remove_labels are guarded by nothing but the blanket task:write at the top
// of UpdateTask, and the transition-scope gate lives inside the
// `if req.Stage != nil` arm, so a label-only request never reached it. Two
// self-service chains followed, each needing one token holding only
// task:write, no second actor and no GitHub access:
//
//	DIRECTION 1 — removal, revoking a maintainer's decision:
//	  reopen                           -> DENIED (missing task:accept)
//	  remove_labels[ft:stage/wont_fix] -> ALLOWED
//	  reopen                           -> ALLOWED, and the transition stamps
//	                                      ft:stage/accepted itself, so the end
//	                                      state is byte-identical to a real
//	                                      accept.
//
//	DIRECTION 2 — addition, reaching ANY task and not only declined ones:
//	  close                              -> DENIED (missing task:close)
//	  add_labels[ft:stage/completed]     -> ALLOWED
//	  UpdateTask(stage=completed)        -> ALLOWED (from == to short-circuit)
//
// AND THE ROUND-4 FIX IS WHAT MADE DIRECTION 2 WORK. Before it,
// TerminalLabelStage collapsed [accepted, completed] to accepted and returned
// ("", false), so the attacker's own label was invisible and could not occupy
// the `from` slot. A CORRECT terminal scan is precisely what promotes an
// attacker-supplied label into the authorization source. That is not an
// argument against round 4; it is the argument that the label is the wrong
// place to read from in either direction, which is #203.
//
// THE PAYLOAD IS STEP 1, NOT THE LAUNDERING STEP. add_labels alone already
// flips Available=true -> false. The from == to short-circuit only tidies the
// label set afterwards. A control at the short-circuit would have intercepted
// the cosmetics; the control has to be at the label write, and
// TestLabelWriteScope_ThePayloadIsTheLabelWriteNotTheRestamp measures that
// claim rather than asserting it.
//
// WHAT THESE TESTS DO NOT COVER, stated here because a comment claiming a
// property held for every consumer when it held for one is the defect this
// whole workstream keeps rediscovering:
//
//   - `ft ready` scheduling. GetReadyTasks -> buildIssueTree -> computeReady
//     asks terminal-ness of MapLabelsToStage's precedence-collapsed winner and
//     never reaches TerminalLabelStage. That sink is downstream of any label
//     state, trustworthy or not, so this control neither helps nor harms it.
//     It is sequenced separately.
//   - Label writes that do not go through Farm Table. A maintainer with GitHub
//     triage rights edits labels directly. This guards one verb; the verb set
//     is open-ended, which is the argument for #203.
//   - Whether a terminal label means the GitHub ISSUE is closed. It does not,
//     and UpdateTask has never changed issue state. See REV9 below.

// ── fixture ──

// labelWriteIssueMock is the round-4 stateful mock generalised on issue STATE.
//
// The round-4 fixture hard-codes state:"OPEN", which is right for the read-side
// question it was built for and structurally incapable of expressing the floor
// this round has to protect: for a CLOSED issue, state:CLOSED is a real GitHub
// field rather than a label, so stripping ft:stage/wont_fix moves the stage
// wont_fix -> completed and stays terminal. An OPEN issue carrying a terminal
// label has no such second witness. A fixture that cannot be closed cannot tell
// those two cases apart, and this round turns on the difference.
//
// It is otherwise deliberately the same shape, including the statefulness that
// round 4 needed: the label mutations really mutate, so a two-call chain
// behaves as it would against real GitHub and a test cannot pass because
// UpdateTask succeeded while doing nothing.
type labelWriteIssueMock struct {
	mu          sync.Mutex
	labels      []string
	state       string
	stateReason string
	idToName    map[string]string

	// closeCalls counts closeIssue mutations. UpdateTask must never issue one,
	// and REV9's claim that the from == to short-circuit is a genuine no-op
	// rests on that. Counting it is what turns "we believe UpdateTask does not
	// close the issue" into a measurement.
	closeCalls int
}

func newLabelWriteIssueMock(t *testing.T, state, stateReason string, initial []string) (*httptest.Server, *labelWriteIssueMock) {
	t.Helper()
	m := &labelWriteIssueMock{
		labels:      append([]string(nil), initial...),
		state:       state,
		stateReason: stateReason,
		idToName:    make(map[string]string, len(fixtureStages())),
	}
	for _, s := range fixtureStages() {
		m.idToName["L_"+s.String()] = stageLabel(s)
	}
	// Non-stage labels the hygiene rows use. Without an entry here
	// labelNamesToIDs drops them and the mutation silently no-ops, which would
	// make a hygiene row pass for the wrong reason.
	for _, extra := range []string{"bug", "needs-info", "duplicate"} {
		m.idToName["L_extra_"+extra] = extra
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
		case strings.Contains(b, "createIssue"):
			// Matched before the label-index and issue cases: the create
			// mutation selects a nested labels(first:) of its own, and without
			// this arm it fell through to the repo label index and returned a
			// payload the client could not unmarshal. That surfaced as a
			// transport error, which the CreateTask disclosure row would have
			// read as "the write was rejected" — a false negative of exactly
			// the kind the harness self-check exists to prevent.
			//
			// The fixture stays single-issue: the requested labels are applied
			// to the one issue it serves, so "did the caller's label land?"
			// remains answerable.
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.add(name)
				}
			}
			_, _ = w.Write([]byte(`{"data":{"createIssue":{"issue":` + m.issueJSON() + `}}}`))
		case strings.Contains(b, "closeIssue"):
			m.closeCalls++
			m.state = "CLOSED"
			_, _ = w.Write([]byte(`{"data":{"closeIssue":{"issue":` + m.issueJSON() + `}}}`))
		case strings.Contains(b, "addLabelsToLabelable"):
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.add(name)
				}
			}
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(b, "removeLabelsFromLabelable"):
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.remove(name)
				}
			}
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(b, "updateIssue"):
			_, _ = w.Write([]byte(`{"data":{"updateIssue":{"issue":` + m.issueJSON() + `}}}`))
		case strings.Contains(b, "issues("):
			// Before the label-index case: the issue query nests its own
			// labels(first:) selection, so matching that first would swallow
			// every issue list.
			_, _ = w.Write([]byte(`{"data":{"repository":{"issues":{"nodes":[` + m.issueJSON() +
				`],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
		case strings.Contains(b, "issue("):
			_, _ = w.Write([]byte(`{"data":{"repository":{"issue":` + m.issueJSON() + `}}}`))
		case strings.Contains(b, "labels(first:"):
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

func (m *labelWriteIssueMock) add(name string) {
	for _, l := range m.labels {
		if strings.EqualFold(l, name) {
			return
		}
	}
	m.labels = append(m.labels, name)
}

func (m *labelWriteIssueMock) remove(name string) {
	out := m.labels[:0]
	for _, l := range m.labels {
		if !strings.EqualFold(l, name) {
			out = append(out, l)
		}
	}
	m.labels = out
}

func (m *labelWriteIssueMock) currentLabels() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.labels...)
}

func (m *labelWriteIssueMock) closes() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.closeCalls
}

func (m *labelWriteIssueMock) issueJSON() string {
	nodes := make([]string, 0, len(m.labels))
	for _, l := range m.labels {
		nodes = append(nodes, fmt.Sprintf(`{"name":%q}`, l))
	}
	reason := "null"
	if m.stateReason != "" {
		reason = fmt.Sprintf("%q", m.stateReason)
	}
	closedAt := "null"
	if strings.EqualFold(m.state, "CLOSED") {
		closedAt = `"2026-01-16T12:00:00Z"`
	}
	return `{
		"id": "I_issue1", "number": 1, "title": "Some work",
		"body": "body", "state": "` + m.state + `", "stateReason": ` + reason + `,
		"createdAt": "2026-01-15T10:00:00Z", "updatedAt": "2026-01-16T12:00:00Z",
		"closedAt": ` + closedAt + `,
		"url": "https://github.com/acme/widgets/issues/1",
		"labels": {"nodes": [` + strings.Join(nodes, ",") + `]},
		"assignees": {"nodes": []}, "milestone": null,
		"subIssues": {"nodes": [], "totalCount": 0},
		"subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
		"parent": null
	}`
}

// labelWriteFixture is one wired-up object graph: EntStore -> MultiStore (with
// the real GitHub resolver shape) -> FarmTableService, around a single issue.
type labelWriteFixture struct {
	svc    *server.FarmTableService
	ms     *store.MultiStore
	taskID string
	collID uuid.UUID
	issue  *labelWriteIssueMock
}

// newLabelWriteFixture builds the production object graph around one issue in
// the given state carrying the given labels.
func newLabelWriteFixture(t *testing.T, state, stateReason string, labels ...string) *labelWriteFixture {
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

	mockGH, issue := newLabelWriteIssueMock(t, state, stateReason, labels)

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
	return &labelWriteFixture{
		svc:    svc,
		ms:     ms,
		taskID: list.GetItems()[0].GetId(),
		collID: coll.ID,
		issue:  issue,
	}
}

// openIssue is the fixture the two attack directions run against.
func openIssue(t *testing.T, labels ...string) *labelWriteFixture {
	t.Helper()
	return newLabelWriteFixture(t, "OPEN", "", labels...)
}

// lifecycleStage reads the authoritative stage the way production does, through
// the store seam rather than off the proto. The proto carries the DISPLAY
// stage, which for an open terminal-labelled issue is deliberately demoted to
// accepted, so asserting on it would measure the wrong thing.
func (f *labelWriteFixture) lifecycleStage(t *testing.T) task.Stage {
	t.Helper()
	tasks, _, err := f.ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &f.collID})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
	}
	return store.LifecycleStage(context.Background(), f.ms, tasks[0])
}

func (f *labelWriteFixture) availability(t *testing.T) store.TaskAvailability {
	t.Helper()
	tasks, _, err := f.ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &f.collID})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
	}
	avail, err := f.ms.ComputeAvailability(context.Background(), tasks[0])
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	return avail
}

// addLabels / removeLabels issue the label-only UpdateTask under the given
// scopes. Nothing else is set on the request, so any denial they return came
// from the label-write control and not from the req.Stage arm.
func (f *labelWriteFixture) addLabels(scopes []string, labels ...string) error {
	_, err := f.svc.UpdateTask(scopedCtx(scopes), &pb.UpdateTaskRequest{
		Id: f.taskID, AddLabels: labels,
	})
	return err
}

func (f *labelWriteFixture) removeLabels(scopes []string, labels ...string) error {
	_, err := f.svc.UpdateTask(scopedCtx(scopes), &pb.UpdateTaskRequest{
		Id: f.taskID, RemoveLabels: labels,
	})
	return err
}

// requireDeniedFor asserts a PermissionDenied naming the scope.
//
// Naming the scope is not decoration. A bare "err != nil" would pass on a
// transport error, a fixture gap or a validation failure, and a probe that
// launders one of those as a denial is exactly the false pass that cost this
// workstream a round.
func requireDeniedFor(t *testing.T, err error, wantScope string, what string) {
	t.Helper()
	if err == nil {
		t.Fatalf("%s: allowed, want PermissionDenied naming %q", what, wantScope)
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.PermissionDenied {
		t.Fatalf("%s: got %v (%s), want PermissionDenied naming %q",
			what, st.Code(), st.Message(), wantScope)
	}
	if !strings.Contains(st.Message(), wantScope) {
		t.Fatalf("%s: denied with %q, want the denial to name %q", what, st.Message(), wantScope)
	}
}

// withScope is agentScopes() plus one. Used for the differential baselines:
// every denial below must flip to an allow when — and only when — the one
// scope the control names is added.
func withScope(scope string) []string {
	return append(agentScopes(), scope)
}

// ── REV0: prove the harness can express the state change ──

// TestLabelWriteScope_HarnessCanExpressTheStateChange is the self-check every
// negative result below depends on, and it fails closed.
//
// A harness that cannot express an input cannot test it, and this workstream
// has lost results to that four times: a fixture whose schema took a single
// label string; a mock whose state model could not express a two-call
// sequence; a PoC that fixed the destination and hid four bypass cells for a
// whole round; and a claim probe that reported a denial for a bypass that had
// actually gone through. So before any "the control denied it" is trusted,
// this asserts that the very same fixture CAN carry both writes out when the
// scope is present, and that the writes really move the authoritative stage.
//
// If this test fails, every denial in this file is vacuous.
func TestLabelWriteScope_HarnessCanExpressTheStateChange(t *testing.T) {
	t.Run("removal_moves_the_lifecycle_stage", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageWontFix))
		if got := f.lifecycleStage(t); got != task.StageWontFix {
			t.Fatalf("fixture did not start at wont_fix: lifecycle stage is %q, labels %v",
				got, f.issue.currentLabels())
		}
		if err := f.removeLabels(withScope(server.ScopeTaskAccept), stageLabel(task.StageWontFix)); err != nil {
			t.Fatalf("removal with task:accept failed: %v", err)
		}
		if got := f.issue.currentLabels(); containsLabel(got, stageLabel(task.StageWontFix)) {
			t.Fatalf("HARNESS BROKEN: the removal was permitted but the label is still there: %v", got)
		}
		if got := f.lifecycleStage(t); got != task.StageAccepted {
			t.Fatalf("HARNESS BROKEN: after stripping the terminal label the lifecycle stage is "+
				"%q, want accepted. The fixture cannot express the transition the control gates",
				got)
		}
	})

	t.Run("addition_moves_the_lifecycle_stage", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if got := f.lifecycleStage(t); got != task.StageAccepted {
			t.Fatalf("fixture did not start at accepted: %q", got)
		}
		if err := f.addLabels(withScope(server.ScopeTaskClose), stageLabel(task.StageCompleted)); err != nil {
			t.Fatalf("addition with task:close failed: %v", err)
		}
		if got := f.issue.currentLabels(); !containsLabel(got, stageLabel(task.StageCompleted)) {
			t.Fatalf("HARNESS BROKEN: the addition was permitted but the label did not land: %v", got)
		}
		if got := f.lifecycleStage(t); got != task.StageCompleted {
			t.Fatalf("HARNESS BROKEN: after adding the terminal label the lifecycle stage is %q, "+
				"want completed", got)
		}
	})

	t.Run("closed_state_is_expressible", func(t *testing.T) {
		f := newLabelWriteFixture(t, "CLOSED", "not_planned", stageLabel(task.StageWontFix))
		tasks, _, err := f.ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &f.collID})
		if err != nil || len(tasks) != 1 {
			t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
		}
		if tasks[0].ClosedAt == nil {
			t.Fatal("HARNESS BROKEN: the CLOSED fixture produced a task with a nil ClosedAt, so " +
				"the closed-issue floor rows below would be measuring an open issue")
		}
		if got, _ := tasks[0].RemoteData["state_reason"].(string); got != "not_planned" {
			t.Fatalf("HARNESS BROKEN: state_reason did not survive onto the task (%q), so the "+
				"wont_fix floor row cannot distinguish itself from the completed one", got)
		}
	})
}

// ── DIRECTION 1: removal must not revoke a maintainer's decision ──

// TestUpdateTask_RemovingATerminalLabelRequiresAcceptToReopen closes direction
// 1 at STEP 1.
//
// Stripping ft:stage/wont_fix off an OPEN issue moves the authoritative
// lifecycle stage from wont_fix to accepted, which is the terminal -> anything
// reopen row of the transition table and costs task:accept. Before this
// control it cost task:write, and the subsequent reopen then stamped
// ft:stage/accepted itself, leaving a state byte-for-byte identical to a
// legitimate accept.
//
// SCHEMA — what these rows can and cannot express:
//
//	CAN express: each terminal label alone and accompanied by exactly one
//	  non-terminal stage label, removed by exact name.
//	CANNOT express: two masks at once; removing several terminal labels in one
//	  call; unprefixed stage-named labels (F4, deferred); non-GitHub stores
//	  (covered separately by TestUpdateTask_LabelWritesAreInertOnNativeTasks).
//	  Case variation is covered by its own test rather than as a mask
//	  dimension, so it is visible instead of buried in a count.
func TestUpdateTask_RemovingATerminalLabelRequiresAcceptToReopen(t *testing.T) {
	terminals := terminalLabels()
	masks := maskLabels()

	// 4 terminal labels x 7 masks (6 non-terminal stages + the empty mask).
	const wantCells = 4 * 7
	if got := len(terminals) * len(masks); got != wantCells {
		t.Fatalf("matrix covers %d cells, want %d (%d terminal labels x %d masks)",
			got, wantCells, len(terminals), len(masks))
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
			} else {
				name += "_unmasked"
			}

			t.Run(name, func(t *testing.T) {
				f := openIssue(t, labels...)

				// BASELINE. If the lifecycle stage is not terminal to begin
				// with, removing the label induces no reopen and this row
				// measures nothing.
				if got := f.lifecycleStage(t); !store.IsTerminalStage(got) {
					t.Fatalf("BASELINE BROKEN: an issue labelled %v reports lifecycle stage %q, "+
						"so this row is not exercising a reopen at all", labels, got)
				}

				err := f.removeLabels(agentScopes(), label)
				requireDeniedFor(t, err, server.ScopeTaskAccept,
					fmt.Sprintf("remove_labels[%s] on an issue labelled %v", label, labels))

				// A denial must not have half-happened.
				if got := f.issue.currentLabels(); !containsLabel(got, label) {
					t.Fatalf("the removal was denied but %q is gone anyway; labels now %v",
						label, got)
				}

				// DIFFERENTIAL. The same call must succeed with task:accept, or
				// this row would also pass against a gate that denied
				// everything.
				if err := f.removeLabels(withScope(server.ScopeTaskAccept), label); err != nil {
					t.Fatalf("remove_labels[%s] with task:accept was rejected (%v); holding the "+
						"scope the denial named must be sufficient", label, err)
				}
				if got := f.issue.currentLabels(); containsLabel(got, label) {
					t.Fatalf("the removal was permitted but did nothing; labels now %v", got)
				}
			})
		}
	}

	if executed != wantCells {
		t.Fatalf("executed %d cells, want %d", executed, wantCells)
	}
}

// TestUpdateTask_RemovingATerminalLabelIsDeniedWhateverTheCase closes the
// case-folding hole in the prediction.
//
// GitHub label names are unique case-insensitively, and the pass-through store
// resolves remove targets through a LOWERCASED name -> node ID index, so
// remove_labels=["FT:STAGE/WONT_FIX"] really does strip "ft:stage/wont_fix"
// from the issue. A delta predicted with exact string equality — which is what
// the Ent store's mergeLabels does for native tasks — would report "no change"
// and wave the write through. applyLabelDelta folds case for exactly this
// reason; this row is why.
func TestUpdateTask_RemovingATerminalLabelIsDeniedWhateverTheCase(t *testing.T) {
	label := stageLabel(task.StageWontFix)
	for _, spelling := range []string{
		strings.ToUpper(label),
		strings.ToTitle(label),
		" " + label + " ",
	} {
		t.Run(fmt.Sprintf("%q", spelling), func(t *testing.T) {
			f := openIssue(t, label)

			// BASELINE: this spelling really does reach the label on GitHub.
			// Measured rather than assumed — if labelNamesToIDs dropped it the
			// write would be a no-op and a denial would prove nothing.
			probe := openIssue(t, label)
			if err := probe.removeLabels(withScope(server.ScopeTaskAccept), spelling); err != nil {
				t.Fatalf("BASELINE: remove %q with task:accept failed: %v", spelling, err)
			}
			reaches := !containsLabel(probe.issue.currentLabels(), label)

			err := f.removeLabels(agentScopes(), spelling)
			requireDeniedFor(t, err, server.ScopeTaskAccept,
				fmt.Sprintf("remove_labels[%q]", spelling))
			if !containsLabel(f.issue.currentLabels(), label) {
				t.Fatalf("denied but the label is gone; labels now %v", f.issue.currentLabels())
			}

			if !reaches {
				// Recorded rather than skipped. applyLabelDelta trims
				// surrounding whitespace and labelNamesToIDs does not, so this
				// spelling is predicted to remove a label the store would in
				// fact leave alone: the control charges task:accept for what
				// would have been a no-op. That is the fail-closed direction
				// and it is deliberate, but it is a divergence and should be
				// visible rather than absorbed by a skip.
				t.Logf("OVER-PREDICTION (fail-closed): the spelling %q does not reach the label "+
					"through labelNamesToIDs (probe labels still %v), yet the control denies it",
					spelling, probe.issue.currentLabels())
			}
		})
	}
}

// ── DIRECTION 2: addition must not mark any task terminal ──

// TestUpdateTask_AddingATerminalLabelRequiresClose closes direction 2 at
// STEP 1, and direction 2 reaches ANY task rather than only declined ones.
//
// THE ACCURATE IMPACT, which is narrower than "the task gets closed" and is
// stated precisely here because overclaiming is the failure mode B4 exists to
// prevent: adding ft:stage/completed marks the task terminal TO FARM TABLE —
// out of `ft ready`, unclaimable, Available=false Reasons=[terminal] — and
// reversing it then needs task:accept, which the caller does not hold. The
// GitHub issue is NOT closed; UpdateTask never issues a closeIssue mutation.
// So the damage is an unauthorized decline the attacker cannot itself undo,
// plus a false completion record, not a state:CLOSED write.
//
// Every row's baseline is a direct close attempt that must be DENIED, so no
// row can pass because the destination was reachable anyway.
func TestUpdateTask_AddingATerminalLabelRequiresClose(t *testing.T) {
	// Start stages an ordinary, never-declined task can be in. StageWorking is
	// included as a label even though UpdateTask refuses stage=working as a
	// destination: nothing stops an issue from CARRYING it, and that is the
	// state a claimed task is in.
	starts := []task.Stage{
		task.StageTriage, task.StageAccepted, task.StageWorking,
		task.StageInReview, task.StageInQa, task.StageDeploying,
	}
	destinations := []struct {
		stage task.Stage
		proto pb.TaskStage
	}{
		{task.StageCompleted, pb.TaskStage_TASK_STAGE_COMPLETED},
		{task.StageWontFix, pb.TaskStage_TASK_STAGE_WONT_FIX},
		{task.StageDuplicate, pb.TaskStage_TASK_STAGE_DUPLICATE},
		{task.StageCancelled, pb.TaskStage_TASK_STAGE_CANCELLED},
	}

	// 6 start stages x 4 terminal destinations.
	const wantCells = 6 * 4
	if got := len(starts) * len(destinations); got != wantCells {
		t.Fatalf("matrix covers %d cells, want %d", got, wantCells)
	}

	executed := 0
	for _, start := range starts {
		for _, dest := range destinations {
			executed++
			t.Run(string(start)+"_to_"+string(dest.stage), func(t *testing.T) {
				f := openIssue(t, stageLabel(start))

				// BASELINE. The straight route to this destination must be
				// closed for this token, or the label route is not a bypass of
				// anything.
				destStage := dest.proto
				_, directErr := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id: f.taskID, Stage: &destStage,
				})
				if directErr == nil {
					t.Fatalf("BASELINE BROKEN: UpdateTask(stage=%s) already succeeds with an "+
						"agent token from %s, so the label route bypasses nothing",
						dest.stage, start)
				}

				// STEP 1 — the payload. Must be denied.
				err := f.addLabels(agentScopes(), stageLabel(dest.stage))
				requireDeniedFor(t, err, server.ScopeTaskClose,
					fmt.Sprintf("add_labels[%s] on an issue labelled %s", stageLabel(dest.stage), start))

				if containsLabel(f.issue.currentLabels(), stageLabel(dest.stage)) {
					t.Fatalf("denied but the terminal label landed anyway; labels now %v",
						f.issue.currentLabels())
				}
				if got := f.lifecycleStage(t); store.IsTerminalStage(got) {
					t.Fatalf("denied but the lifecycle stage is %q; the task was marked terminal "+
						"anyway", got)
				}

				// DIFFERENTIAL. task:close, and nothing else, must permit it.
				if err := f.addLabels(withScope(server.ScopeTaskClose), stageLabel(dest.stage)); err != nil {
					t.Fatalf("add_labels[%s] with task:close was rejected (%v)",
						stageLabel(dest.stage), err)
				}
				if got := f.lifecycleStage(t); got != dest.stage {
					t.Fatalf("add_labels[%s] with task:close was permitted but the lifecycle "+
						"stage is %q; labels %v", stageLabel(dest.stage), got, f.issue.currentLabels())
				}
			})
		}
	}

	if executed != wantCells {
		t.Fatalf("executed %d cells, want %d", executed, wantCells)
	}
}

// TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose covers the
// terminal-start cells of the same matrix.
//
// A bypass occurs iff rank(dest) < rank(start) in terminalStagePrecedence, so
// completed sits at rank 0 and was reachable from every other terminal stage:
// add ft:stage/completed to a wont_fix issue and the tiebreak hands the
// authorization gate "completed". That is a property of ordered tiebreaking as
// such and not of the order chosen — every total order has a rank-0 element —
// so reordering the list cannot fix it and would only move which stage is
// free. The fix is here, at the write.
//
// This is a genuine privilege change and not bookkeeping: it rewrites a
// maintainer's "won't fix" into "completed", which is the record other tooling
// and any dependency rule keyed on completion will read.
func TestUpdateTask_SwappingOneTerminalLabelForAnotherRequiresClose(t *testing.T) {
	stages := []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}

	executed, bypassCandidates := 0, 0
	for _, start := range stages {
		for _, dest := range stages {
			if start == dest {
				continue
			}
			executed++
			t.Run(string(start)+"_to_"+string(dest), func(t *testing.T) {
				f := openIssue(t, stageLabel(start))
				if got := f.lifecycleStage(t); got != start {
					t.Fatalf("BASELINE BROKEN: fixture reports lifecycle stage %q, want %q",
						got, start)
				}

				err := f.addLabels(agentScopes(), stageLabel(dest))

				// Adding a LOWER-precedence terminal label leaves the tiebreak
				// answer unchanged, so it induces no transition and must stay
				// free — from != to is required, not optional.
				after := f.lifecycleStage(t)
				if err == nil {
					if after != start {
						t.Fatalf("add_labels[%s] was allowed with task:write and moved the "+
							"lifecycle stage %q -> %q", stageLabel(dest), start, after)
					}
					return
				}
				bypassCandidates++
				requireDeniedFor(t, err, server.ScopeTaskClose,
					fmt.Sprintf("add_labels[%s] on a %s issue", stageLabel(dest), start))
				if after != start {
					t.Fatalf("denied but the stage moved to %q anyway", after)
				}
			})
		}
	}

	if executed != 12 {
		t.Fatalf("executed %d cells, want 12 (4 terminal stages, ordered pairs)", executed)
	}
	// Six of the twelve ordered pairs raise the precedence winner and are the
	// cells that actually bypassed. Pinning the number keeps a future change
	// that quietly stops gating them visible; pinning it WITHOUT this sentence
	// would hide that the other six are free by design.
	if bypassCandidates != 6 {
		t.Fatalf("%d of 12 terminal->terminal pairs induced a stage change and were gated, "+
			"want 6. Either the tiebreak order moved or the control stopped firing",
			bypassCandidates)
	}
}

// ── the payload is the label write, not the restamp ──

// TestLabelWriteScope_ThePayloadIsTheLabelWriteNotTheRestamp measures the claim
// that decided WHERE this control goes.
//
// The reported chain ends with UpdateTask(stage=completed), which the from ==
// to short-circuit waves through, and it is tempting to put the control there.
// That would be wrong, and this is the measurement rather than the argument:
// the label write ALONE already flips Available=true -> false. The restamp only
// removes the leftover ft:stage/accepted, laundering the result into something
// that looks like a legitimate transition. A control at the short-circuit would
// have intercepted the cosmetics and left the payload intact.
func TestLabelWriteScope_ThePayloadIsTheLabelWriteNotTheRestamp(t *testing.T) {
	f := openIssue(t, stageLabel(task.StageAccepted))

	if avail := f.availability(t); !avail.Available {
		t.Fatalf("BASELINE BROKEN: an ordinary open accepted issue is already unavailable (%v)",
			avail.Reasons)
	}

	// The label write alone, granted the scope the control now demands, so that
	// what is being measured is the EFFECT of the write and not the gate.
	if err := f.addLabels(withScope(server.ScopeTaskClose), stageLabel(task.StageCompleted)); err != nil {
		t.Fatalf("add_labels with task:close: %v", err)
	}
	avail := f.availability(t)
	if avail.Available || !hasReason(avail.Reasons, store.AvailabilityReasonTerminal) {
		t.Fatalf("the label write alone left the task Available=%v Reasons=%v; the premise that "+
			"the label write IS the payload does not hold, and the control may be in the wrong "+
			"place", avail.Available, avail.Reasons)
	}
	if f.issue.closes() != 0 {
		t.Fatalf("add_labels issued %d closeIssue mutations; the impact statement says zero and "+
			"the whole 'terminal to Farm Table, not to GitHub' framing depends on it",
			f.issue.closes())
	}

	// And the control intercepts that payload for a task:write-only caller.
	g := openIssue(t, stageLabel(task.StageAccepted))
	requireDeniedFor(t, g.addLabels(agentScopes(), stageLabel(task.StageCompleted)),
		server.ScopeTaskClose, "add_labels[completed] with task:write only")
	if avail := g.availability(t); !avail.Available {
		t.Fatalf("the write was denied but the task is unavailable anyway: %v", avail.Reasons)
	}
}

// TestUpdateTask_BothSelfServiceChainsAreDeniedAtStepOne runs the two reported
// chains end to end.
//
// Each starts with the precondition that the straight route is denied, so
// neither can pass by measuring a gate that was never shut.
func TestUpdateTask_BothSelfServiceChainsAreDeniedAtStepOne(t *testing.T) {
	t.Run("direction_1_removal_revokes_a_decline", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageWontFix))
		accepted := pb.TaskStage_TASK_STAGE_ACCEPTED

		// Step 1 of the reported chain: the reopen is denied.
		_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
			Id: f.taskID, Stage: &accepted,
		})
		requireDeniedFor(t, err, server.ScopeTaskAccept, "PRECONDITION: direct reopen")

		// Step 2 of the reported chain — the step that used to be free.
		requireDeniedFor(t, f.removeLabels(agentScopes(), stageLabel(task.StageWontFix)),
			server.ScopeTaskAccept, "CHAIN STEP: remove the terminal label")

		// Step 3 must therefore still be unreachable.
		_, err = f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
			Id: f.taskID, Stage: &accepted,
		})
		if err == nil {
			t.Fatalf("SELF-SERVICE ESCALATION: a token holding only task:write reopened a "+
				"declined issue; labels now %v", f.issue.currentLabels())
		}
		if got := f.lifecycleStage(t); got != task.StageWontFix {
			t.Fatalf("the chain was blocked but the lifecycle stage is %q, want wont_fix; "+
				"labels %v", got, f.issue.currentLabels())
		}
	})

	t.Run("direction_2_addition_declines_an_ordinary_task", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		completed := pb.TaskStage_TASK_STAGE_COMPLETED

		_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
			Id: f.taskID, Stage: &completed,
		})
		requireDeniedFor(t, err, server.ScopeTaskClose, "PRECONDITION: direct close")

		requireDeniedFor(t, f.addLabels(agentScopes(), stageLabel(task.StageCompleted)),
			server.ScopeTaskClose, "CHAIN STEP: add the terminal label")

		if got := f.lifecycleStage(t); got != task.StageAccepted {
			t.Fatalf("the chain was blocked but the lifecycle stage is %q, want accepted", got)
		}
		if avail := f.availability(t); !avail.Available {
			t.Fatalf("the chain was blocked but the task is unavailable: %v", avail.Reasons)
		}
		if f.issue.closes() != 0 {
			t.Fatalf("%d closeIssue mutations were issued", f.issue.closes())
		}
	})
}

// ── from != to is required, not optional ──

// TestUpdateTask_LabelEditsThatInduceNoStageChangeStayTaskWrite is the
// denial-of-work guard.
//
// The control gates the transition an edit INDUCES, never "a stage label was
// touched". Without that distinction routine label hygiene starts demanding
// task:accept on every declined issue, which is a regression with no security
// benefit — the same shape as the from == to breakage round 2 introduced and
// round 3 had to undo.
func TestUpdateTask_LabelEditsThatInduceNoStageChangeStayTaskWrite(t *testing.T) {
	cases := []struct {
		name    string
		labels  []string
		add     []string
		remove  []string
		wantEnd task.Stage
	}{
		{
			name:    "add_an_ordinary_label_to_a_declined_issue",
			labels:  []string{stageLabel(task.StageWontFix)},
			add:     []string{"bug"},
			wantEnd: task.StageWontFix,
		},
		{
			name:    "remove_an_ordinary_label_from_a_declined_issue",
			labels:  []string{stageLabel(task.StageWontFix), "needs-info"},
			remove:  []string{"needs-info"},
			wantEnd: task.StageWontFix,
		},
		{
			name:    "re_add_the_terminal_label_the_issue_already_carries",
			labels:  []string{stageLabel(task.StageCompleted)},
			add:     []string{stageLabel(task.StageCompleted)},
			wantEnd: task.StageCompleted,
		},
		{
			name:    "add_a_non_terminal_stage_label_alongside_a_terminal_one",
			labels:  []string{stageLabel(task.StageWontFix)},
			add:     []string{stageLabel(task.StageInReview)},
			wantEnd: task.StageWontFix,
		},
		{
			name:    "remove_the_masking_stage_label_leaving_the_terminal_one",
			labels:  []string{stageLabel(task.StageWontFix), stageLabel(task.StageInReview)},
			remove:  []string{stageLabel(task.StageInReview)},
			wantEnd: task.StageWontFix,
		},
		{
			name:    "ordinary_hygiene_on_an_ordinary_task",
			labels:  []string{stageLabel(task.StageAccepted)},
			add:     []string{"bug"},
			remove:  []string{"needs-info"},
			wantEnd: task.StageAccepted,
		},
		{
			name:    "remove_a_label_the_issue_does_not_carry",
			labels:  []string{stageLabel(task.StageAccepted)},
			remove:  []string{stageLabel(task.StageWontFix)},
			wantEnd: task.StageAccepted,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := openIssue(t, tc.labels...)
			before := f.lifecycleStage(t)

			_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, AddLabels: tc.add, RemoveLabels: tc.remove,
			})
			if err != nil {
				st, _ := status.FromError(err)
				t.Fatalf("a label edit that induces no lifecycle transition (%q -> %q) was "+
					"rejected with %v: %s. The control must gate the transition an edit "+
					"induces, not the fact that a stage label was named",
					before, tc.wantEnd, st.Code(), st.Message())
			}
			if got := f.lifecycleStage(t); got != tc.wantEnd {
				t.Fatalf("lifecycle stage is %q after the edit, want %q; labels %v. If this "+
					"moved, the row was mislabelled and the allow above was a real bypass",
					got, tc.wantEnd, f.issue.currentLabels())
			}
		})
	}
}

// TestUpdateTask_LabelWritesAreInertOnNativeTasks is B1 requirement 6.
//
// A native Ent-backed task keeps its stage in its own column. No label can
// forge it, store.LabelDeltaLifecycleStages reports before == after for such a
// store by construction, and the control must therefore be a no-op rather than
// an accidental new restriction on the majority path.
//
// The rows deliberately include the exact label a GitHub-backed task would be
// denied for, so the test distinguishes "inert on native tasks" from "the
// control never fires".
func TestUpdateTask_LabelWritesAreInertOnNativeTasks(t *testing.T) {
	for _, stage := range []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	} {
		t.Run(string(stage), func(t *testing.T) {
			ctx := context.Background()
			entStore, cleanup := testutil.NewTestStore(t)
			t.Cleanup(cleanup)
			ms := store.NewMultiStore(entStore)
			t.Cleanup(func() { _ = ms.Close() })

			coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{Name: "native"})
			if err != nil {
				t.Fatalf("CreateCollection: %v", err)
			}
			svc := server.NewFarmTableService(ms, "test")

			created, err := ms.CreateTask(ctx, store.CreateTaskParams{
				Title:        "native task",
				CollectionID: coll.ID,
				Phase:        task.PhaseOpen,
				Stage:        task.StageAccepted,
				Labels:       []string{"bug"},
			})
			if err != nil {
				t.Fatalf("CreateTask: %v", err)
			}

			if _, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id:           created.ID.String(),
				AddLabels:    []string{stageLabel(stage)},
				RemoveLabels: []string{"bug"},
			}); err != nil {
				st, _ := status.FromError(err)
				t.Fatalf("a label edit on a NATIVE task was rejected with %v: %s. Labels do not "+
					"determine the stage on this store, so the label-write control must not "+
					"fire here", st.Code(), st.Message())
			}

			after, err := ms.GetTask(ctx, created.ID)
			if err != nil {
				t.Fatalf("GetTask: %v", err)
			}
			if after.Stage != task.StageAccepted {
				t.Fatalf("the native task's stage moved to %q on a label edit; the premise that "+
					"labels are inert here is false and the control has a real gap", after.Stage)
			}
		})
	}
}

// ── the closed-issue floor ──

// TestUpdateTask_ClosedIssueFloorSurvivesLabelStripping pins the floor the
// control must not break, and discloses the one place it tightens.
//
// For a CLOSED issue there IS a floor: state:CLOSED is a real GitHub field, not
// a label, and ClosedAt survives label stripping. So stripping every stage
// label off a closed issue leaves it terminal, and the reopen gate still holds.
// That floor is load-bearing and must not be refactored onto labels.
//
// For an OPEN issue carrying a terminal label there is no floor at all — the
// declined status exists only in a field the attacker can write, with no second
// witness. That asymmetry is why direction 1 is a finding and this is not.
//
// DISCLOSURE, because this is a behaviour change and burying it would be the
// exact failure B4 names. On a closed issue whose state_reason is "completed",
// stripping ft:stage/wont_fix moves the stage wont_fix -> completed, which is
// terminal -> terminal and now costs task:close where it used to cost
// task:write. That is the honest reading of the invariant — the recorded
// disposition really does change, and other tooling keys off completion — but
// it IS a new requirement on a previously free edit. The not_planned row below
// is the one that must stay free, and it does, because taskStateReason recovers
// the reason and both endpoints then resolve to wont_fix.
func TestUpdateTask_ClosedIssueFloorSurvivesLabelStripping(t *testing.T) {
	t.Run("not_planned_strip_is_a_no_op_and_stays_free", func(t *testing.T) {
		f := newLabelWriteFixture(t, "CLOSED", "not_planned", stageLabel(task.StageWontFix))
		if got := f.lifecycleStage(t); got != task.StageWontFix {
			t.Fatalf("BASELINE BROKEN: closed not_planned issue reports %q", got)
		}

		if err := f.removeLabels(agentScopes(), stageLabel(task.StageWontFix)); err != nil {
			st, _ := status.FromError(err)
			t.Fatalf("stripping the stage label off a closed not_planned issue was rejected "+
				"(%v: %s). GitHub's own state_reason still says wont_fix, so this induces no "+
				"transition and must stay a plain write", st.Code(), st.Message())
		}
		if got := f.lifecycleStage(t); got != task.StageWontFix {
			t.Fatalf("after stripping the label the closed issue reports %q, want wont_fix from "+
				"state_reason. The floor moved onto labels", got)
		}
	})

	t.Run("floor_holds_the_reopen_gate_after_stripping", func(t *testing.T) {
		for _, reason := range []string{"not_planned", "completed"} {
			t.Run(reason, func(t *testing.T) {
				f := newLabelWriteFixture(t, "CLOSED", reason, stageLabel(task.StageWontFix))
				// Strip with whatever scope it takes; the point is the state
				// AFTER stripping, not the price of stripping.
				if err := f.removeLabels(
					append(withScope(server.ScopeTaskClose), server.ScopeTaskAccept),
					stageLabel(task.StageWontFix),
				); err != nil {
					t.Fatalf("privileged strip failed: %v", err)
				}
				if got := f.issue.currentLabels(); containsLabel(got, stageLabel(task.StageWontFix)) {
					t.Fatalf("BASELINE BROKEN: the strip did not happen; labels %v", got)
				}

				if got := f.lifecycleStage(t); !store.IsTerminalStage(got) {
					t.Fatalf("a CLOSED issue with every stage label stripped reports lifecycle "+
						"stage %q. state:CLOSED is a real GitHub field and must keep the task "+
						"terminal without any label", got)
				}
				accepted := pb.TaskStage_TASK_STAGE_ACCEPTED
				_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id: f.taskID, Stage: &accepted,
				})
				requireDeniedFor(t, err, server.ScopeTaskAccept,
					"reopen of a closed issue with no stage labels")
			})
		}
	})

	t.Run("DISCLOSED_completed_reason_makes_the_strip_cost_close", func(t *testing.T) {
		f := newLabelWriteFixture(t, "CLOSED", "completed", stageLabel(task.StageWontFix))
		err := f.removeLabels(agentScopes(), stageLabel(task.StageWontFix))
		if err == nil {
			t.Skip("the strip is free here; the disclosure in this test's doc comment is stale " +
				"and should be removed rather than left claiming a restriction that is gone")
		}
		requireDeniedFor(t, err, server.ScopeTaskClose,
			"strip ft:stage/wont_fix off a closed completed issue")
		t.Log("DISCLOSED: this edit cost task:write before round 5 and costs task:close now. " +
			"It moves the recorded disposition wont_fix -> completed, so charging the close " +
			"scope is the honest reading of the invariant, but it is a new requirement.")
	})
}

// ── B2 / REV9: the from == to short-circuit is a genuine no-op TODAY ──

// TestUpdateTask_RestampingATerminalStageOnAnOpenIssueIsAGenuineNoOp is REV9,
// landed as a PASSING regression test rather than as a second control.
//
// UpdateTask(stage=wont_fix) on an OPEN issue already labelled ft:stage/wont_fix
// takes the from == to short-circuit in TransitionScope and costs only
// task:write. That is correct today, and the reason is narrow enough to be worth
// writing down:
//
//	THE LOAD-BEARING ASSUMPTION: the GitHub pass-through store's UpdateTask
//	acts on p.Stage by swapping LABELS and never reads p.Phase. UpdateTask has
//	therefore never closed or reopened a GitHub issue, so re-asserting a stage
//	the labels already name changes nothing at all.
//
// WHAT BREAKS WHEN IT FAILS. If a later change makes UpdateTask honour phase
// for GitHub-backed tasks — plausible under #203, or under any "make UpdateTask
// and CloseTask consistent" cleanup — then re-asserting a stage the labels
// already name becomes a real open -> closed transition costing only
// task:write. And it would go live with NO LABEL WRITE for the round-5 control
// to inspect, because the labels are already correct. There would be nothing in
// this file guarding it.
//
// If you are here because this test failed on the closeCalls assertion, that is
// the assumption breaking, and the fix is a control on the from == to
// short-circuit — not an edit to this test.
//
// No scope check belongs on a genuine no-op, so this asserts the no-op rather
// than a denial.
func TestUpdateTask_RestampingATerminalStageOnAnOpenIssueIsAGenuineNoOp(t *testing.T) {
	for _, tc := range []struct {
		stage task.Stage
		proto pb.TaskStage
	}{
		{task.StageWontFix, pb.TaskStage_TASK_STAGE_WONT_FIX},
		{task.StageCompleted, pb.TaskStage_TASK_STAGE_COMPLETED},
		{task.StageDuplicate, pb.TaskStage_TASK_STAGE_DUPLICATE},
		{task.StageCancelled, pb.TaskStage_TASK_STAGE_CANCELLED},
	} {
		t.Run(string(tc.stage), func(t *testing.T) {
			f := openIssue(t, stageLabel(tc.stage))

			tasks, _, err := f.ms.ListTasks(context.Background(),
				store.ListTasksParams{CollectionID: &f.collID})
			if err != nil || len(tasks) != 1 {
				t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
			}
			beforePhase := tasks[0].Phase
			beforeClosedAt := tasks[0].ClosedAt
			beforeLabels := f.issue.currentLabels()

			stage := tc.proto
			if _, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, Stage: &stage,
			}); err != nil {
				st, _ := status.FromError(err)
				t.Fatalf("re-asserting %s on an issue already labelled that way was rejected "+
					"(%v: %s); from == to is a no-op write", tc.stage, st.Code(), st.Message())
			}

			// THE ASSUMPTION, measured. Zero closeIssue mutations is what makes
			// this a no-op rather than a task:write-priced close.
			if got := f.issue.closes(); got != 0 {
				t.Fatalf("UpdateTask issued %d closeIssue mutations. The load-bearing assumption "+
					"in this test's doc comment has failed: UpdateTask now changes issue state, "+
					"so the from == to short-circuit is a real open -> closed transition priced "+
					"at task:write, with no label write for the round-5 control to inspect. "+
					"This needs a control on the short-circuit", got)
			}

			after, _, err := f.ms.ListTasks(context.Background(),
				store.ListTasksParams{CollectionID: &f.collID})
			if err != nil || len(after) != 1 {
				t.Fatalf("ListTasks: err=%v n=%d", err, len(after))
			}
			if after[0].Phase != beforePhase {
				t.Fatalf("phase moved %q -> %q on a from == to restamp", beforePhase, after[0].Phase)
			}
			if (after[0].ClosedAt == nil) != (beforeClosedAt == nil) {
				t.Fatalf("closedAt changed on a from == to restamp: %v -> %v",
					beforeClosedAt, after[0].ClosedAt)
			}
			if !sameLabels(beforeLabels, f.issue.currentLabels()) {
				t.Fatalf("labels changed on a from == to restamp: %v -> %v",
					beforeLabels, f.issue.currentLabels())
			}
		})
	}
}

// ── seam agreement ──

// TestLifecycleStageForLabels_AgreesWithLifecycleStageOnTheTasksOwnLabels is
// the consistency pin the passthrough doc comment promises.
//
// LabelDeltaLifecycleStages computes its "before" endpoint from a
// reconstruction of the issue's state and state_reason rather than from
// t.Stage, so that both endpoints are produced the same way. That
// reconstruction has to agree with the one round 4's LifecycleStage makes, or
// the control would report spurious transitions wherever the two merely
// disagree — and a spurious transition at this gate is a denial-of-work bug.
//
// The delta is empty on purpose: this measures the reconstruction, not the
// delta.
func TestLifecycleStageForLabels_AgreesWithLifecycleStageOnTheTasksOwnLabels(t *testing.T) {
	type fixture struct {
		state, reason string
		labels        []string
	}
	fixtures := []fixture{
		{"OPEN", "", nil},
		{"OPEN", "", []string{stageLabel(task.StageAccepted)}},
		{"OPEN", "", []string{stageLabel(task.StageWorking)}},
		{"OPEN", "", []string{stageLabel(task.StageTriage)}},
		{"OPEN", "", []string{stageLabel(task.StageWontFix)}},
		{"OPEN", "", []string{stageLabel(task.StageWontFix), stageLabel(task.StageWorking)}},
		{"OPEN", "", []string{stageLabel(task.StageCompleted), stageLabel(task.StageWontFix)}},
		{"OPEN", "", []string{"bug"}},
		{"CLOSED", "completed", nil},
		{"CLOSED", "not_planned", nil},
		{"CLOSED", "completed", []string{stageLabel(task.StageCompleted)}},
		{"CLOSED", "not_planned", []string{stageLabel(task.StageWontFix)}},
		{"CLOSED", "not_planned", []string{stageLabel(task.StageWorking)}},
		{"CLOSED", "completed", []string{stageLabel(task.StageWontFix), stageLabel(task.StageWorking)}},
	}

	for i, fx := range fixtures {
		t.Run(fmt.Sprintf("%d_%s_%s_%v", i, fx.state, fx.reason, fx.labels), func(t *testing.T) {
			f := newLabelWriteFixture(t, fx.state, fx.reason, fx.labels...)
			ctx := context.Background()
			tasks, _, err := f.ms.ListTasks(ctx, store.ListTasksParams{CollectionID: &f.collID})
			if err != nil || len(tasks) != 1 {
				t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
			}

			want := store.LifecycleStage(ctx, f.ms, tasks[0])
			before, after := store.LabelDeltaLifecycleStages(ctx, f.ms, tasks[0], nil, nil)
			if before != want {
				t.Fatalf("LabelDeltaLifecycleStages reports before=%q but LifecycleStage says "+
					"%q for the same task. The two readings of the issue must agree or the "+
					"control will charge a scope for a transition that is not happening",
					before, want)
			}
			if before != after {
				t.Fatalf("an EMPTY delta reported a transition %q -> %q", before, after)
			}
		})
	}
}

// ── disclosed residual: CreateTask is a fifth verb with the same root ──

// TestCreateTask_TerminalStageLabelAtCreationIsUngatedToday pins a residual
// this round's control does NOT close, found while building it.
//
// CreateTask passes req.labels straight through to the new GitHub issue
// (server.go sets p.Labels; the pass-through store resolves each name and
// attaches it), and nothing inspects them. So:
//
//	CreateTask(stage=completed)             -> DENIED, needs task:close
//	CreateTask(labels=[ft:stage/completed]) -> ALLOWED with task:write, and the
//	                                           new task's lifecycle stage is
//	                                           completed
//
// That is the same root as the finding this round fixes — a write path to the
// field authorization reads, guarded only by task:write — reached through a
// different verb. InsertTasksAfter takes labels the same way.
//
// IT IS NOT FIXED HERE, deliberately:
//
//   - The impact is materially lower. The attacker is fabricating a completion
//     record on a task it is creating, not overriding a maintainer's existing
//     decision and not making anyone else's work unclaimable. Nothing is
//     revoked and nothing needs task:accept to undo.
//   - It is a different verb, and verbs are being sequenced one at a time on
//     this branch (the `ft ready` tree-walk sink is out for the same reason).
//     Folding it in would collide.
//   - Most importantly it is the third instance of the point that matters:
//     every control here is a control over ONE VERB, and the verb set is
//     open-ended — UpdateTask today, CreateTask and InsertTasksAfter now, bulk
//     edit, sync, import or a webhook reconciler tomorrow. Enumerating verbs
//     loses against a single mutable field. #203 is the fix; this test is
//     evidence for it.
//
// Pinning CURRENT behaviour, like the unprefixed-label test in
// authz_terminal_reopen_test.go does, so the residual is visible and closing it
// is a deliberate act. If you are here because this test failed, you are
// probably closing it — update the test rather than working around it.
func TestCreateTask_TerminalStageLabelAtCreationIsUngatedToday(t *testing.T) {
	f := openIssue(t, stageLabel(task.StageAccepted))

	// BASELINE: the straight route to a terminal stage at creation is closed
	// for this token, so the label route is a bypass of a real gate.
	completed := pb.TaskStage_TASK_STAGE_COMPLETED
	_, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
		CollectionId: f.collID.String(), Name: "direct", Stage: &completed,
	})
	requireDeniedFor(t, err, server.ScopeTaskClose, "BASELINE: CreateTask(stage=completed)")

	// The label route.
	if _, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
		CollectionId: f.collID.String(), Name: "via labels",
		Labels: []string{stageLabel(task.StageCompleted)},
	}); err != nil {
		t.Fatalf("CreateTask with a terminal stage label was rejected (%v). That may well be "+
			"the intended change — see the doc comment — but it is a behaviour change at a "+
			"security gate and must be made deliberately, not as a side effect", err)
	}

	// And it really lands: the label is attached, so the residual is real
	// rather than a request the store quietly dropped.
	if !containsLabel(f.issue.currentLabels(), stageLabel(task.StageCompleted)) {
		t.Skipf("the terminal label did not reach the issue (labels %v), so CreateTask is not "+
			"in fact a live write path and this disclosure should be corrected",
			f.issue.currentLabels())
	}
	t.Log("DISCLOSED RESIDUAL: CreateTask attaches a caller-supplied terminal stage label with " +
		"task:write, while CreateTask(stage=completed) requires task:close. Same root, " +
		"different verb, not closed by round 5.")
}

// ── B3: can a native task hold a terminal stage with an open phase? ──

// TestNativeTask_TerminalStageAlwaysCarriesAClosedPhase answers B3 by
// execution rather than by reasoning.
//
// The question matters because the from == to short-circuit is not
// GitHub-specific. If a NATIVE, Ent-backed task could sit at stage=<terminal>
// with phase=open, then UpdateTask(stage=<that terminal>) would take the
// short-circuit, cost task:write, and effect a real close — with no label
// anywhere for the round-5 control to inspect and nothing in this file
// guarding it.
//
// MEASURED ANSWER: no. Every server-side write path that sets a stage derives
// the phase from it in the same expression, so the pair cannot be desynchronised
// through the API. The rows below drive each of those paths and assert that a
// terminal stage always arrives with phase=closed.
//
// WHAT THIS CANNOT EXPRESS, and it is the honest limit of the answer: the
// store layer itself. store.UpdateTaskParams has independent Phase and Stage
// pointers and EntStore.UpdateTask sets each only if its pointer is non-nil,
// so an INTERNAL caller that sets Stage without Phase would construct exactly
// the state this test says the API cannot reach. That is not reachable from any
// RPC today; it is a shape the store permits, not a bug being reported, and it
// is why this test drives the RPC surface rather than the store.
func TestNativeTask_TerminalStageAlwaysCarriesAClosedPhase(t *testing.T) {
	terminals := []struct {
		stage task.Stage
		proto pb.TaskStage
	}{
		{task.StageCompleted, pb.TaskStage_TASK_STAGE_COMPLETED},
		{task.StageWontFix, pb.TaskStage_TASK_STAGE_WONT_FIX},
		{task.StageDuplicate, pb.TaskStage_TASK_STAGE_DUPLICATE},
		{task.StageCancelled, pb.TaskStage_TASK_STAGE_CANCELLED},
	}

	newNative := func(t *testing.T) (*server.FarmTableService, uuid.UUID) {
		t.Helper()
		entStore, cleanup := testutil.NewTestStore(t)
		t.Cleanup(cleanup)
		ms := store.NewMultiStore(entStore)
		t.Cleanup(func() { _ = ms.Close() })
		coll, err := ms.CreateCollection(context.Background(),
			store.CreateCollectionParams{Name: "native"})
		if err != nil {
			t.Fatalf("CreateCollection: %v", err)
		}
		return server.NewFarmTableService(ms, "test"), coll.ID
	}

	// Every scope, so that a denial can never be mistaken for "unreachable".
	// The question is what state is CONSTRUCTIBLE, not who may construct it.
	privileged := []string{
		server.ScopeTaskRead, server.ScopeTaskWrite, server.ScopeTaskClaim,
		server.ScopeTaskAccept, server.ScopeTaskClose,
	}

	for _, tc := range terminals {
		t.Run("create_"+string(tc.stage), func(t *testing.T) {
			svc, collID := newNative(t)
			stage := tc.proto
			created, err := svc.CreateTask(scopedCtx(privileged), &pb.CreateTaskRequest{
				CollectionId: collID.String(), Name: "t", Stage: &stage,
			})
			if err != nil {
				t.Fatalf("CreateTask(stage=%s): %v", tc.stage, err)
			}
			if created.GetPhase() != pb.TaskPhase_TASK_PHASE_CLOSED {
				t.Fatalf("B3 ANSWERED YES: CreateTask produced a native task at stage=%s with "+
					"phase=%s. A terminal stage on an open phase makes the from == to "+
					"short-circuit a real close on the native path, with no label for the "+
					"round-5 control to see. STOP and report this",
					tc.stage, created.GetPhase())
			}
		})

		t.Run("update_"+string(tc.stage), func(t *testing.T) {
			svc, collID := newNative(t)
			created, err := svc.CreateTask(scopedCtx(privileged), &pb.CreateTaskRequest{
				CollectionId: collID.String(), Name: "t",
			})
			if err != nil {
				t.Fatalf("CreateTask: %v", err)
			}
			stage := tc.proto
			updated, err := svc.UpdateTask(scopedCtx(privileged), &pb.UpdateTaskRequest{
				Id: created.GetId(), Stage: &stage,
			})
			if err != nil {
				t.Fatalf("UpdateTask(stage=%s): %v", tc.stage, err)
			}
			if updated.GetPhase() != pb.TaskPhase_TASK_PHASE_CLOSED {
				t.Fatalf("B3 ANSWERED YES: UpdateTask produced a native task at stage=%s with "+
					"phase=%s. STOP and report this", tc.stage, updated.GetPhase())
			}
		})

		t.Run("close_"+string(tc.stage), func(t *testing.T) {
			svc, collID := newNative(t)
			created, err := svc.CreateTask(scopedCtx(privileged), &pb.CreateTaskRequest{
				CollectionId: collID.String(), Name: "t",
			})
			if err != nil {
				t.Fatalf("CreateTask: %v", err)
			}
			stage := tc.proto
			closed, err := svc.CloseTask(scopedCtx(privileged), &pb.CloseTaskRequest{
				Id: created.GetId(), Stage: &stage,
			})
			if err != nil {
				t.Fatalf("CloseTask(stage=%s): %v", tc.stage, err)
			}
			if closed.GetPhase() != pb.TaskPhase_TASK_PHASE_CLOSED {
				t.Fatalf("B3 ANSWERED YES: CloseTask left stage=%s on phase=%s. STOP and report "+
					"this", tc.stage, closed.GetPhase())
			}
		})
	}

	// The import path is the one that ACCEPTS a phase from the caller, so it is
	// the most likely place for the pair to be desynchronised. It is fed a
	// payload that deliberately claims phase=open with a terminal stage.
	t.Run("import_ignores_a_conflicting_phase", func(t *testing.T) {
		entStore, cleanup := testutil.NewTestStore(t)
		t.Cleanup(cleanup)
		svc := server.NewFarmTableService(entStore, "test")
		admin := append(append([]string(nil), privileged...), server.ScopeCollectionAdmin)

		for _, tc := range terminals {
			doc := minimalImportDoc("b3 "+string(tc.stage), nil, []map[string]interface{}{
				{
					"id": uuid.New().String(), "title": "imported " + string(tc.stage),
					"description": "",
					// The desynchronised pair, supplied deliberately: a
					// terminal stage claiming an OPEN phase. Import is the only
					// surface that takes a phase from the caller at all, so if
					// the pair can be split anywhere it is here.
					"phase": "open", "stage": string(tc.stage),
					"native_label": string(tc.stage), "type": "", "labels": []string{},
					"repo": "", "branch": "", "pull_requests": []map[string]string{},
					"remote_data": map[string]interface{}{},
				},
			}, nil, nil, nil)
			doc["format_version"] = 2
			data, err := json.Marshal(doc)
			if err != nil {
				t.Fatalf("marshalling import doc: %v", err)
			}

			resp, err := svc.ImportCollection(scopedCtx(admin), &pb.ImportCollectionRequest{
				Data: data,
			})
			if err != nil {
				t.Fatalf("ImportCollection(stage=%s, phase=open): %v. This row must be repaired "+
					"rather than skipped: import is the only surface that accepts a phase from "+
					"the caller", tc.stage, err)
			}

			collID := resp.GetCollectionId()
			list, err := svc.ListTasks(scopedCtx(admin), &pb.ListTasksRequest{CollectionId: &collID})
			if err != nil {
				t.Fatalf("ListTasks: %v", err)
			}
			if len(list.GetItems()) != 1 {
				t.Fatalf("BASELINE BROKEN: import produced %d tasks, want 1; the row is not "+
					"measuring the import path", len(list.GetItems()))
			}
			got := list.GetItems()[0]
			if got.GetStage() != tc.proto {
				t.Fatalf("BASELINE BROKEN: imported task is at stage %s, want %s",
					got.GetStage(), tc.stage)
			}
			if got.GetPhase() != pb.TaskPhase_TASK_PHASE_CLOSED {
				t.Fatalf("B3 ANSWERED YES: ImportCollection honoured a caller-supplied "+
					"phase=open alongside stage=%s, producing phase=%s. STOP and report this",
					tc.stage, got.GetPhase())
			}
		}
	})
}
