package server_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
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
	"github.com/shurcooL/githubv4"
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

	// creates records one entry per createIssue mutation, holding the labels
	// that mutation asked for.
	//
	// The round-5 audit declared this fixture's inability to tell CREATE from
	// UPDATE as a limit on its own CreateTask probe: the create arm applies the
	// requested labels to the single issue the mock serves, so afterwards
	// currentLabels() cannot say whether a label arrived through createIssue or
	// through a later addLabelsToLabelable. A #194 round-6 test that asserted on
	// currentLabels() alone would therefore be pinning the mock, not the server.
	//
	// Recording the create separately is what makes "the caller's label was
	// attached AT CREATION" an answerable question. See B1 / audit A-1.
	creates [][]string

	// interleave, if set, runs exactly ONCE when the updateIssue mutation
	// arrives, and models a SECOND ACTOR editing the issue's labels
	// concurrently with the request under test (#194 round 7, audit A-4).
	//
	// updateIssue is the trigger because it is the one point that is provably
	// after the authorization decision and provably before the label writes:
	// the server's gate runs entirely on the snapshot it read before calling
	// the store, and GitHubPassThroughStore.UpdateTask issues updateIssue
	// before it touches any label mutation. Triggering on a read instead would
	// leave the ordering dependent on how many reads each layer happens to
	// make, which is exactly the kind of incidental coupling that makes a
	// concurrency test pass for the wrong reason.
	//
	// It is called with m.mu already held, so it must use m.add / m.remove
	// directly and must not re-enter the locking accessors.
	interleave func(m *labelWriteIssueMock)

	// interleaveRuns counts the interleaves that actually fired. A test whose
	// second actor never ran would observe the label in exactly the state the
	// fix produces, and would pass without measuring anything.
	interleaveRuns int
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
	// Every label the fixture starts with, so a repository whose labels are
	// spelled with a non-default prefix is expressible. Same reason as above:
	// an unregistered name is silently dropped by labelNamesToIDs, and a B6 row
	// that could not write its own label would pass without measuring anything.
	for _, l := range initial {
		if !mockKnowsLabel(m.idToName, l) {
			m.idToName["L_initial_"+l] = l
		}
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
			//
			// The labels this particular mutation asked for are ALSO recorded
			// separately, because applying them to the shared issue is exactly
			// what makes create and update indistinguishable afterwards. See
			// the `creates` field.
			asked := []string{}
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.add(name)
					asked = append(asked, name)
				}
			}
			sort.Strings(asked)
			m.creates = append(m.creates, asked)
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
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))
		case strings.Contains(b, "removeLabelsFromLabelable"):
			for id, name := range m.idToName {
				if strings.Contains(b, `"`+id+`"`) {
					m.remove(name)
				}
			}
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"labelable":{"labels":{"nodes":[]}}}}}`))
		case strings.Contains(b, "updateIssue"):
			if m.interleave != nil {
				m.interleave(m)
				m.interleave = nil
				m.interleaveRuns++
			}
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

func mockKnowsLabel(idToName map[string]string, name string) bool {
	for _, known := range idToName {
		if strings.EqualFold(known, name) {
			return true
		}
	}
	return false
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

// interleaveAtUpdateIssue arms a one-shot second-actor edit. See the
// interleave field for why updateIssue is the trigger.
func (m *labelWriteIssueMock) interleaveAtUpdateIssue(f func(m *labelWriteIssueMock)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.interleave = f
}

// interleaves reports how many armed second-actor edits actually ran.
func (m *labelWriteIssueMock) interleaves() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.interleaveRuns
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

// createdIssues returns, per createIssue mutation, the labels that mutation
// requested. Unlike currentLabels() this cannot be satisfied by a later
// addLabelsToLabelable, so it distinguishes the create path from the update
// path.
func (m *labelWriteIssueMock) createdIssues() [][]string {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([][]string, 0, len(m.creates))
	for _, c := range m.creates {
		out = append(out, append([]string(nil), c...))
	}
	return out
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
	return newLabelWriteFixtureWithPrefix(t, defaultPushPrefix, state, stateReason, labels...)
}

// defaultPushPrefix is the shipped push_prefix. It is named rather than
// inlined because since B6 this string decides which labels may feed an
// authorization answer, so "the default" and "no prefix configured" are two
// different statements and the tests below need to make both.
const defaultPushPrefix = "ft:"

// prefixedStageLabel spells a stage label under an arbitrary configured prefix,
// the way StageToLabel would.
func prefixedStageLabel(prefix string, s task.Stage) string {
	if prefix == "" {
		prefix = defaultPushPrefix
	}
	return prefix + "stage/" + s.String()
}

// newLabelWriteFixtureWithPrefix is newLabelWriteFixture with the repository's
// configured push_prefix as an input.
//
// No test anywhere in the repository varied the label mapper's configuration
// before this: push_prefix was a constant every fixture inherited from
// DefaultConfig, so it was a dimension nobody treated as an input. B6 makes it
// load-bearing for SECURITY — it decides which labels may feed an authorization
// answer — and a security parameter that only ever takes one value in the tests
// is an untested one.
func newLabelWriteFixtureWithPrefix(t *testing.T, pushPrefix, state, stateReason string, labels ...string) *labelWriteFixture {
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
		return newPassThroughStoreWithPrefix(t, mockGH, owner, repo, cid, pushPrefix), nil
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

// newPassThroughStoreWithPrefix is newPassThroughStoreWithMock with the
// repository's configured push_prefix as an input. It is spelled out here
// rather than added as a parameter to the shared helper so that the dozens of
// existing call sites keep asserting against the shipped default.
func newPassThroughStoreWithPrefix(t *testing.T, mockServer *httptest.Server, owner, repo string, collectionID uuid.UUID, pushPrefix string) store.Store {
	t.Helper()
	cfg := ghplatform.DefaultConfig()
	cfg.GitHub.Labels.PushPrefix = pushPrefix
	s := ghplatform.NewPassThroughStore("mock-token", owner, repo, cfg, &collectionID)
	ghplatform.SetTestGraphQLClient(s, githubv4.NewEnterpriseClient(mockServer.URL, mockServer.Client()))
	return s
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

// lifecycleStages reads the whole authoritative stage SET, not the tiebreak
// winner. A swap is the case where the winner and the set disagree about
// whether anything happened: replacing one terminal label with another can
// leave the winner in place while the set changes, and it can equally move the
// winner while the set stays the same size. Asserting on lifecycleStage alone
// would reintroduce the tiebreak dependency that round 5 removed.
func (f *labelWriteFixture) lifecycleStages(t *testing.T) []task.Stage {
	t.Helper()
	tasks, _, err := f.ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &f.collID})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
	}
	stages, err := store.LifecycleStages(context.Background(), f.ms, tasks[0])
	if err != nil {
		t.Fatalf("LifecycleStages: %v", err)
	}
	sorted := append([]task.Stage(nil), stages...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	return sorted
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

// swapLabels issues ONE UpdateTask that both adds and removes labels.
//
// This is the input the round-5 suite could not construct. Its swap test was
// named for a swap and every cell called addLabels alone, so what it actually
// measured was an issue ACQUIRING a second terminal label — after which the
// label set is {start, dest}, not {dest}. A real swap produces a different
// "after" set and therefore a different set of (from, to) pairs at the gate,
// and no test anywhere in the suite exercised it (test review T-3).
//
// The distinction is not cosmetic: with add-only, before={start} and
// after={start,dest}, so the pair (start,start) is present and free and the
// charge rests entirely on (start,dest). With a real swap, after={dest} and
// (start,start) is gone. A gate that only ever saw the add-only shape could
// depend on the from==to pair being present without anyone noticing.
func (f *labelWriteFixture) swapLabels(scopes []string, add, remove []string) error {
	_, err := f.svc.UpdateTask(scopedCtx(scopes), &pb.UpdateTaskRequest{
		Id: f.taskID, AddLabels: add, RemoveLabels: remove,
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

// deniedScope extracts the scope name a PermissionDenied names, so two gates
// can be compared against EACH OTHER instead of against a literal.
//
// A test that writes `want: "task:close"` re-states the configuration it is
// meant to be checking: weaken TransitionScope and you would update the literal
// in the same edit, and the test would stay green. Comparing the scope the
// stage door demands with the scope the label door demands has no such shared
// source — closing one door without the other makes them differ.
//
// Fails rather than returning "" on anything that is not a scope denial: a
// transport error or a validation failure laundered into this comparison would
// make two unrelated errors compare equal.
func deniedScope(t *testing.T, err error, what string) string {
	t.Helper()
	if err == nil {
		t.Fatalf("%s: allowed, want PermissionDenied", what)
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.PermissionDenied {
		t.Fatalf("%s: got %v (%s), want PermissionDenied", what, st.Code(), st.Message())
	}
	const marker = `missing required scope "`
	msg := st.Message()
	i := strings.Index(msg, marker)
	if i < 0 {
		t.Fatalf("%s: denial %q does not name a scope in the expected form", what, msg)
	}
	rest := msg[i+len(marker):]
	j := strings.Index(rest, `"`)
	if j < 0 {
		t.Fatalf("%s: denial %q has an unterminated scope name", what, msg)
	}
	return rest[:j]
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

// TestUpdateTask_AddingASecondTerminalLabelRequiresClose covers the
// terminal-start cells of the same matrix.
//
// RENAMED. Through round 5 this was called
// ...SwappingOneTerminalLabelForAnotherRequiresClose, and it never swapped:
// every cell called addLabels alone, so the issue ended up carrying BOTH
// terminal labels and the "for another" in the name described an input the
// fixture could not construct (test review T-3). The name is now what the test
// measures. The swap it was named for is measured in
// TestUpdateTask_RealSingleRequestTerminalSwapRequiresClose, which is new.
//
// This test is kept rather than replaced. Acquiring a second terminal label is
// a distinct and reachable input, and it is the one where the tiebreak and the
// set disagree most sharply.
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
//
// ALL TWELVE ORDERED PAIRS ARE GATED, and an earlier revision of this test
// pinned SIX. That count was correct against a control that compared two
// tiebreak WINNERS: for the six pairs where the added label ranked below the
// existing one the winner did not move, the gate saw from == to, and the write
// was free — while the issue really did acquire a second terminal label. The
// number six was therefore a measurement of the tiebreak, not of the control.
// Comparing stage SETS removes the dependency (#194 round 5, B5), so every pair
// that changes the label set is now charged. The pin is kept as a count so that
// a regression to winner-comparison shows up as 6, not as a silent pass.
func TestUpdateTask_AddingASecondTerminalLabelRequiresClose(t *testing.T) {
	stages := []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}

	executed, gated := 0, 0
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
				before := f.issue.currentLabels()

				err := f.addLabels(agentScopes(), stageLabel(dest))
				if err == nil {
					t.Fatalf("add_labels[%s] on a %s issue was allowed with task:write. "+
						"The issue now names two terminal stages; whether the tiebreak "+
						"winner moved is not the question", stageLabel(dest), start)
				}
				gated++
				requireDeniedFor(t, err, server.ScopeTaskClose,
					fmt.Sprintf("add_labels[%s] on a %s issue", stageLabel(dest), start))

				// The label state after refusal, not just the error: a denial
				// that still wrote the label would be the whole finding again.
				if after := f.issue.currentLabels(); !sameLabels(before, after) {
					t.Fatalf("denied but the labels changed %v -> %v", before, after)
				}
				if after := f.lifecycleStage(t); after != start {
					t.Fatalf("denied but the stage moved to %q anyway", after)
				}

				// DIFFERENTIAL. task:close, and nothing else, must permit it —
				// otherwise this test passes just as well if the gate denied
				// every label write.
				if err := f.addLabels(withScope(server.ScopeTaskClose), stageLabel(dest)); err != nil {
					t.Fatalf("add_labels[%s] with task:close was rejected (%v)",
						stageLabel(dest), err)
				}
				if !containsLabel(f.issue.currentLabels(), stageLabel(dest)) {
					t.Fatalf("add_labels[%s] with task:close was permitted but the label is "+
						"not on the issue; labels %v", stageLabel(dest), f.issue.currentLabels())
				}
			})
		}
	}

	if executed != 12 {
		t.Fatalf("executed %d cells, want 12 (4 terminal stages, ordered pairs)", executed)
	}
	if gated != 12 {
		t.Fatalf("%d of 12 terminal->terminal pairs were gated, want 12. Six is the "+
			"signature of a control that compares tiebreak winners instead of stage sets",
			gated)
	}
}

// ── the swap the suite could not previously express (#194 round 6, B6) ──

// TestUpdateTask_RealSingleRequestTerminalSwapRequiresClose measures a genuine
// swap: ONE UpdateTask carrying both add_labels=[dest] and
// remove_labels=[start].
//
// Until now no test anywhere in this package issued a request that both added
// and removed, so the swap arm of the gate had never been executed by anything.
// That is not the same shape as the add-only approximation it replaced:
//
//	add-only:   before={start}  after={start,dest}   pairs (start,start), (start,dest)
//	real swap:  before={start}  after={dest}         pair  (start,dest)
//
// MEASURED RESULT: the real swap behaves exactly like the add-only
// approximation. All twelve ordered pairs are denied on task:write, all twelve
// are permitted by task:close, and the denial scope matches the add-only cell
// of the same pair. That was the round-5 gate's intent, but it was a prediction
// until this test ran, because the input did not exist to run.
//
// AND THIS CONTROL IS WEAKER THAN ITS SIZE SUGGESTS. Read the mutation results
// before trusting it. Three mutations were applied to the UpdateTask label gate
// in server.go and the whole package was run against each:
//
//	M1  gate removed entirely           add-only RED   swap RED   reopen RED
//	M2  gate ignores remove_labels      add-only green swap GREEN reopen RED
//	M4  gate always charges task:close  add-only green swap GREEN reopen RED
//
// The only mutation these twelve cells detect is M1, and the add-only test
// detects M1 too. So as a detector this matrix adds NOTHING the test it was
// named after did not already provide. Its value is narrower and worth stating
// plainly rather than dressing up: the named input is now executable, its
// behaviour is measured instead of assumed, and the post-success assertions
// below can check that the remove side actually removed — the add-only shape
// leaves both labels on by construction and structurally cannot observe a
// remove that silently no-ops.
//
// M2 and M4 are caught by TestUpdateTask_SingleRequestReopenSwapCostsAccept and
// by three or four pre-existing remove-side tests. If this matrix is ever the
// only thing standing between a change and review, that is not enough.
func TestUpdateTask_RealSingleRequestTerminalSwapRequiresClose(t *testing.T) {
	stages := []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}

	executed, gated := 0, 0
	for _, start := range stages {
		for _, dest := range stages {
			if start == dest {
				continue
			}
			executed++
			t.Run(string(start)+"_to_"+string(dest), func(t *testing.T) {
				f := openIssue(t, stageLabel(start))
				if got := f.lifecycleStages(t); len(got) != 1 || got[0] != start {
					t.Fatalf("BASELINE BROKEN: fixture stage set is %v, want [%s]", got, start)
				}
				before := f.issue.currentLabels()

				err := f.swapLabels(agentScopes(),
					[]string{stageLabel(dest)}, []string{stageLabel(start)})
				if err == nil {
					t.Fatalf("SWAP %s -> %s in one request was allowed with task:write. "+
						"The add-only approximation of this case IS gated, so the swap arm "+
						"is a hole the previous test could not see", start, dest)
				}
				gated++
				requireDeniedFor(t, err, server.ScopeTaskClose,
					fmt.Sprintf("swap %s -> %s", start, dest))

				if after := f.issue.currentLabels(); !sameLabels(before, after) {
					t.Fatalf("denied but the labels changed %v -> %v. A swap has two write "+
						"sides and a partially-applied denial is worse than an allowed one",
						before, after)
				}
				if after := f.lifecycleStages(t); len(after) != 1 || after[0] != start {
					t.Fatalf("denied but the stage set moved to %v", after)
				}

				// DIFFERENTIAL against the add-only cell of the same pair: the
				// two shapes must charge the SAME scope. If the swap were
				// cheaper, the add-only test would be reporting a control that
				// a caller can sidestep by phrasing the same change as a swap.
				addOnly := openIssue(t, stageLabel(start))
				addErr := addOnly.addLabels(agentScopes(), stageLabel(dest))
				if addErr == nil {
					t.Fatalf("BASELINE BROKEN: add-only %s -> %s was not gated", start, dest)
				}
				if swapScope, addScope := deniedScope(t, err, "swap"),
					deniedScope(t, addErr, "add-only"); swapScope != addScope {
					t.Fatalf("SHAPE-DEPENDENT PRICE: swapping %s -> %s costs %q but adding "+
						"%s costs %q. The same label-set change must cost the same however "+
						"it is phrased", start, dest, swapScope, dest, addScope)
				}

				// task:close, and nothing weaker, permits it.
				if err := f.swapLabels(withScope(server.ScopeTaskClose),
					[]string{stageLabel(dest)}, []string{stageLabel(start)}); err != nil {
					t.Fatalf("swap %s -> %s with task:close was rejected (%v)", start, dest, err)
				}

				// The remove side actually removed. Only a real swap can check
				// this; the add-only test leaves both labels on by construction.
				labels := f.issue.currentLabels()
				if !containsLabel(labels, stageLabel(dest)) {
					t.Fatalf("swap permitted but %s is not on the issue; labels %v",
						stageLabel(dest), labels)
				}
				if containsLabel(labels, stageLabel(start)) {
					t.Fatalf("swap permitted but %s is STILL on the issue; labels %v. "+
						"The remove side no-oped and this was an add in disguise",
						stageLabel(start), labels)
				}
				if got := f.lifecycleStages(t); len(got) != 1 || got[0] != dest {
					t.Fatalf("swap permitted but the stage set is %v, want the singleton [%s]",
						got, dest)
				}
			})
		}
	}

	if executed != 12 {
		t.Fatalf("executed %d cells, want 12 (4 terminal stages, ordered pairs)", executed)
	}
	if gated != 12 {
		t.Fatalf("%d of 12 single-request terminal swaps were gated, want 12", gated)
	}
}

// TestUpdateTask_SingleRequestReopenSwapCostsAccept is the direction the
// terminal-to-terminal matrix cannot reach, and it only becomes expressible
// once the fixture can swap.
//
// Reopening is removing the terminal label and adding a live one. As two
// requests it is already covered, but as two requests the intermediate state is
// observable and each half is priced on its own. In ONE request there is no
// intermediate state: before={terminal}, after={accepted}, and the gate sees a
// single pair it must price correctly in one shot.
//
// It must cost task:accept and NOT task:close. Charging close here would be the
// wrong answer arrived at safely — the caller is not closing anything, and a
// gate that charges the strongest scope it can find for any label write would
// pass every denial-side assertion in the terminal-to-terminal matrix while
// being useless.
//
// This is the sensitive one. It is the only NEW test in B6 that detects any
// mutation the round-5 suite did not already detect in some other shape: it
// goes red both when the gate ignores remove_labels and when the gate charges
// task:close unconditionally, and both of those leave all twelve
// terminal-to-terminal swap cells green. It is not the sole detector of either
// — pre-existing remove-only tests catch them as well — so the honest claim is
// that it covers the single-request shape of a hole that was already covered in
// its two-request shape, not that it found something new.
func TestUpdateTask_SingleRequestReopenSwapCostsAccept(t *testing.T) {
	for _, start := range []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	} {
		t.Run(string(start)+"_to_accepted", func(t *testing.T) {
			f := openIssue(t, stageLabel(start))
			if got := f.lifecycleStages(t); len(got) != 1 || got[0] != start {
				t.Fatalf("BASELINE BROKEN: fixture stage set is %v, want [%s]", got, start)
			}

			err := f.swapLabels(agentScopes(),
				[]string{stageLabel(task.StageAccepted)}, []string{stageLabel(start)})
			if err == nil {
				t.Fatalf("reopening a %s issue in one request was free on task:write", start)
			}
			if got := deniedScope(t, err, "reopen swap"); got != server.ScopeTaskAccept {
				t.Fatalf("reopening a %s issue was denied for %q, want %q. Undoing a "+
					"terminal decision is an accept, not a close; charging close would be "+
					"a correct-looking refusal to the wrong question",
					start, got, server.ScopeTaskAccept)
			}

			if err := f.swapLabels(withScope(server.ScopeTaskAccept),
				[]string{stageLabel(task.StageAccepted)}, []string{stageLabel(start)}); err != nil {
				t.Fatalf("reopening a %s issue with task:accept was rejected (%v)", start, err)
			}
			if got := f.lifecycleStages(t); len(got) != 1 || got[0] != task.StageAccepted {
				t.Fatalf("reopen permitted but the stage set is %v, want [accepted]", got)
			}
		})
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

			// The read-side set (t.Stage fallback) and the delta's before-set
			// (IssueToPhaseStage fallback) are two different reconstructions of
			// the same issue, and the gates sit next to each other in
			// UpdateTask. They must give the same answer.
			want, err := store.LifecycleStages(ctx, f.ms, tasks[0])
			if err != nil {
				t.Fatalf("LifecycleStages: %v", err)
			}
			before, after, err := store.LabelDeltaLifecycleStages(ctx, f.ms, tasks[0], nil, nil)
			if err != nil {
				t.Fatalf("LabelDeltaLifecycleStages: %v", err)
			}
			if !store.SameStageSet(before, want) {
				t.Fatalf("LabelDeltaLifecycleStages reports before=%v but LifecycleStages says "+
					"%v for the same task. The two readings of the issue must agree or the "+
					"control will charge a scope for a transition that is not happening",
					before, want)
			}
			if !store.SameStageSet(before, after) {
				t.Fatalf("an EMPTY delta reported a transition %v -> %v", before, after)
			}
		})
	}
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

// ── B5: the authorization source is a SET, not a tiebreak winner ──

// TestUpdateTask_ReAssertingATerminalStageOnAMultiTerminalTaskRequiresClose is
// the conversion class that needs NO LABEL WRITE AT ALL.
//
// Every other probe in this file attacks through add_labels or remove_labels.
// This one does not touch a label: it calls UpdateTask(stage=X) on a task that
// already names X, which the transition table waves through as a no-op because
// from == to. The trick is that the task also names a SECOND terminal stage,
// and the write really does erase it — the pass-through store's stage change
// runs StageLabelSwap, which removes every other stage label. So:
//
//	before: [ft:stage/wont_fix, ft:stage/completed]
//	call:   UpdateTask(stage=completed)     with task:write only
//	after:  [ft:stage/completed]            — the maintainer's decline is gone
//
// Measured against round 4: 12 ordered pairs, 6 converted, 6 denied, and the
// converting six were exactly those where the destination outranked the source
// in terminalStagePrecedence — wont_fix/duplicate/cancelled -> completed,
// duplicate/cancelled -> wont_fix, cancelled -> duplicate. The tiebreak handed
// the gate the destination as the source, so from == to held and the check
// short-circuited to task:write.
//
// Reordering the precedence list cannot fix this. A conversion exists exactly
// when rank(dest) < rank(start), the rank-0 element is therefore reachable from
// every other terminal stage, and every total order has a rank-0 element — so
// a reorder only changes WHICH stage is free. The fix is to stop selecting:
// with the whole set in hand, from == to can hold for at most one member, and
// the other member falls to "any -> terminal costs task:close".
//
// All 12 pairs are now gated. Both halves are asserted — denied with
// task:write, allowed with task:close — because a control that denied
// everything would satisfy the first half alone.
func TestUpdateTask_ReAssertingATerminalStageOnAMultiTerminalTaskRequiresClose(t *testing.T) {
	stages := []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	}

	executed, gated := 0, 0
	for _, start := range stages {
		for _, dest := range stages {
			if start == dest {
				continue
			}
			executed++
			t.Run(string(start)+"_plus_"+string(dest)+"_ask_"+string(dest), func(t *testing.T) {
				f := openIssue(t, stageLabel(start), stageLabel(dest))

				// BASELINE. Both labels must actually be on the issue, or the
				// row is measuring a single-terminal task and proves nothing.
				before := f.issue.currentLabels()
				if !containsLabel(before, stageLabel(start)) || !containsLabel(before, stageLabel(dest)) {
					t.Fatalf("BASELINE BROKEN: fixture labels %v do not carry both %s and %s",
						before, stageLabel(start), stageLabel(dest))
				}
				// And the tiebreak must genuinely report ONE of them, which is
				// the condition that made this reachable in the first place.
				if got := f.lifecycleStage(t); !store.IsTerminalStage(got) {
					t.Fatalf("BASELINE BROKEN: lifecycle stage %q is not terminal", got)
				}

				destProto := protoStage(t, dest)
				_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id: f.taskID, Stage: &destProto,
				})
				if err == nil {
					t.Fatalf("UpdateTask(stage=%s) on a task naming both %s and %s was allowed "+
						"with task:write. Labels now %v — re-asserting a stage the task already "+
						"names must not be free when it erases another terminal stage",
						dest, start, dest, f.issue.currentLabels())
				}
				gated++
				requireDeniedFor(t, err, server.ScopeTaskClose,
					fmt.Sprintf("UpdateTask(stage=%s) on a [%s %s] task", dest, start, dest))

				// The label state AFTER the refusal, not just the error. A
				// denial that had already swapped the labels would leave the
				// finding open while reporting it closed.
				if after := f.issue.currentLabels(); !sameLabels(before, after) {
					t.Fatalf("denied but the labels changed %v -> %v; the maintainer's %s "+
						"was erased anyway", before, after, stageLabel(start))
				}

				// DIFFERENTIAL: task:close permits it, and the swap then does
				// exactly what the attack wanted — which is fine, because the
				// caller holds the scope that says so.
				if _, err := f.svc.UpdateTask(scopedCtx(withScope(server.ScopeTaskClose)),
					&pb.UpdateTaskRequest{Id: f.taskID, Stage: &destProto}); err != nil {
					t.Fatalf("UpdateTask(stage=%s) with task:close was rejected (%v)", dest, err)
				}
				if got := f.lifecycleStage(t); got != dest {
					t.Fatalf("allowed with task:close but the lifecycle stage is %q, want %q; "+
						"labels %v", got, dest, f.issue.currentLabels())
				}
			})
		}
	}

	if executed != 12 {
		t.Fatalf("executed %d cells, want 12 (4 terminal stages, ordered pairs)", executed)
	}
	// SCHEMA — what these rows can and cannot express.
	//
	//	CAN express: exactly two terminal stage labels, both prefixed, on an
	//	  OPEN issue, with the request naming one of them as the destination.
	//	CANNOT express: three or more terminal labels; a terminal label the
	//	  mapper does not recognise; the same conversion reached through
	//	  add_labels (that is the swap test above); or any non-terminal
	//	  destination (a terminal source with a non-terminal destination is the
	//	  reopen matrix in authz_terminal_reopen_test.go).
	if gated != 12 {
		t.Fatalf("%d of 12 ordered pairs were gated, want 12. Six is the signature of a "+
			"control that reads the tiebreak winner as the transition source", gated)
	}
}

// TestUpdateTask_SingleTerminalRestampIsStillJustTaskWrite is the positive
// control for the test above, and it is the reason that test cannot be
// satisfied by refusing everything.
//
// A task naming ONE terminal stage, re-asserted, is a genuine no-op: the label
// set does not change, no other maintainer statement is erased, and the
// transition table's from == to row is correct about it. Charging task:close
// here would break every legitimate restamp — and
// TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite in
// authz_terminal_reopen_test.go pins the same property from round 4 and is
// deliberately left untouched.
func TestUpdateTask_SingleTerminalRestampIsStillJustTaskWrite(t *testing.T) {
	for _, stage := range []task.Stage{
		task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled,
	} {
		t.Run(string(stage), func(t *testing.T) {
			f := openIssue(t, stageLabel(stage))
			if got := f.lifecycleStage(t); got != stage {
				t.Fatalf("BASELINE BROKEN: lifecycle stage %q, want %q", got, stage)
			}
			before := f.issue.currentLabels()

			destProto := protoStage(t, stage)
			if _, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, Stage: &destProto,
			}); err != nil {
				t.Fatalf("UpdateTask(stage=%s) on a task already at %s was refused (%v). "+
					"Re-asserting the one stage a task names changes nothing and must stay "+
					"a plain write", stage, stage, err)
			}
			if after := f.issue.currentLabels(); !sameLabels(before, after) {
				t.Fatalf("a no-op restamp changed the labels %v -> %v", before, after)
			}
		})
	}
}

// TestUpdateTask_StockLabelBesideATerminalLabelIsDeniedButNotByB5 is the
// no-write conversion cell reported with GitHub's own stock label as the second
// terminal signal: [ft:stage/cancelled, duplicate], asking for duplicate.
//
// It is DENIED, and the honest reason is not the one the report predicted.
// B6 removed the bare "duplicate" from the authorization input entirely, so the
// task names one terminal stage (cancelled), the set has a single member, and
// TransitionScope(cancelled, duplicate) charges task:close by the ordinary
// "any -> terminal" row. B5 never sees a second member. Reporting this as "B5
// closed it" would be a claim about a code path that did not run.
//
// Both prefixed cells from the same report ARE closed by B5 and live in the
// 12-pair test above; they are re-stated here so the three reported cells sit
// in one place with their true causes attached.
func TestUpdateTask_StockLabelBesideATerminalLabelIsDeniedButNotByB5(t *testing.T) {
	cases := []struct {
		name     string
		labels   []string
		ask      task.Stage
		closedBy string
	}{
		{
			name:   "cancelled_plus_stock_duplicate_ask_duplicate",
			labels: []string{stageLabel(task.StageCancelled), "duplicate"},
			ask:    task.StageDuplicate,
			// Not B5: since B6 the stock label is not an authorization input,
			// so the source set is {cancelled} and this is an ordinary
			// any -> terminal charge.
			closedBy: "B6 + the pre-existing any->terminal rule",
		},
		{
			name:     "cancelled_plus_completed_ask_completed",
			labels:   []string{stageLabel(task.StageCancelled), stageLabel(task.StageCompleted)},
			ask:      task.StageCompleted,
			closedBy: "B5",
		},
		{
			name:     "duplicate_plus_wont_fix_ask_wont_fix",
			labels:   []string{stageLabel(task.StageDuplicate), stageLabel(task.StageWontFix)},
			ask:      task.StageWontFix,
			closedBy: "B5",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := openIssue(t, tc.labels...)
			before := f.issue.currentLabels()

			askProto := protoStage(t, tc.ask)
			_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, Stage: &askProto,
			})
			requireDeniedFor(t, err, server.ScopeTaskClose,
				fmt.Sprintf("UpdateTask(stage=%s) on %v [%s]", tc.ask, tc.labels, tc.closedBy))
			if after := f.issue.currentLabels(); !sameLabels(before, after) {
				t.Fatalf("denied but the labels changed %v -> %v", before, after)
			}
			t.Logf("DENIED by %s", tc.closedBy)
		})
	}

	// CONTROL for the first row's stated reason. If the stock label were still
	// an authorization input, a task carrying ONLY it would read as terminal
	// and reopening it would cost task:accept. It must now be free.
	f := openIssue(t, "duplicate")
	accepted := pb.TaskStage_TASK_STAGE_ACCEPTED
	if _, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
		Id: f.taskID, Stage: &accepted,
	}); err != nil {
		t.Fatalf("CONTROL BROKEN: a task carrying only the stock \"duplicate\" label still "+
			"costs more than task:write to move (%v), so the first row above may be denied "+
			"for the reason B5 would give rather than the one it claims", err)
	}
}

// ── B6: only a prefixed label may feed an authorization answer ──

// TestTerminalStageInput_RequiresTheConfiguredPrefix is the test that makes
// push_prefix an input rather than a constant.
//
// THE INVARIANT: a label may contribute to an authorization or terminal-stage
// determination only if it carries the configured push prefix. Prefix-tolerant
// matching is a display affordance and must not reach a security decision.
//
// Round 4 introduced the exposure by fixing something else. Its whole-set
// terminal scan is correct, and it promoted every bare stage-named label —
// notably GitHub's stock "duplicate", present in every new repository and
// appliable with triage rights — from "hidden behind any other stage label" to
// "authoritative". 12 combinations changed answer.
//
// The four cells below are the ones that distinguish a real read of the
// configuration from a hardcoded second string:
//
//	default prefix, ft:stage/completed   -> terminal    (positive control)
//	default prefix, bare completed       -> NOT terminal
//	acme: prefix,   acme:stage/completed -> terminal
//	acme: prefix,   ft:stage/completed   -> NOT terminal
//
// The last one is the important one: under a custom prefix OUR OWN default
// spelling stops being authoritative, because it is no longer what this
// repository's Farm Table writes.
func TestTerminalStageInput_RequiresTheConfiguredPrefix(t *testing.T) {
	cases := []struct {
		name         string
		pushPrefix   string
		label        string
		wantTerminal bool
		why          string
	}{
		{
			name: "default_prefix_prefixed_label", pushPrefix: "ft:",
			label: "ft:stage/completed", wantTerminal: true,
			why: "the positive control: without it, B6 passing would only prove the scan is dead",
		},
		{
			name: "default_prefix_bare_stock_label", pushPrefix: "ft:",
			label: "duplicate", wantTerminal: false,
			why: "GitHub ships this label in every repository; triage rights must not decide privilege",
		},
		{
			name: "default_prefix_bare_stage_name", pushPrefix: "ft:",
			label: "completed", wantTerminal: false,
			why: "an independently created label with a stage-shaped name is not a Farm Table assertion",
		},
		{
			name: "custom_prefix_custom_label", pushPrefix: "acme:",
			label: "acme:stage/completed", wantTerminal: true,
			why: "the configured prefix is read from configuration, not hardcoded",
		},
		{
			name: "custom_prefix_default_label", pushPrefix: "acme:",
			label: "ft:stage/completed", wantTerminal: false,
			why: "under a custom prefix our own default spelling is somebody else's label",
		},
		{
			name: "empty_prefix_default_label", pushPrefix: "",
			label: "ft:stage/completed", wantTerminal: true,
			why: "an empty push_prefix means the default ft:, matching what StageToLabel writes",
		},
		{
			name: "empty_prefix_bare_label", pushPrefix: "",
			label: "completed", wantTerminal: false,
			why: "empty configuration means the default prefix, NOT 'no prefix required'",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newLabelWriteFixtureWithPrefix(t, tc.pushPrefix, "OPEN", "", tc.label)

			// BASELINE. The label must be on the issue, or "not terminal" is
			// just a fixture that lost it.
			if !containsLabel(f.issue.currentLabels(), tc.label) {
				t.Fatalf("BASELINE BROKEN: fixture labels %v do not carry %q",
					f.issue.currentLabels(), tc.label)
			}

			gotStage := f.lifecycleStage(t)
			gotTerminal := store.IsTerminalStage(gotStage)
			if gotTerminal != tc.wantTerminal {
				t.Fatalf("push_prefix=%q label=%q: lifecycle stage %q (terminal=%v), want "+
					"terminal=%v. %s", tc.pushPrefix, tc.label, gotStage, gotTerminal,
					tc.wantTerminal, tc.why)
			}

			// The reading must be consistent across the sinks that share it,
			// not merely at the seam. Availability is the one a scheduler
			// reads and the claim gate enforces.
			avail := f.availability(t)
			if gotTerminal && avail.Available {
				t.Fatalf("push_prefix=%q label=%q reads terminal but the task is available",
					tc.pushPrefix, tc.label)
			}
			if !gotTerminal && avail.HasReason(store.AvailabilityReasonTerminal) {
				t.Fatalf("push_prefix=%q label=%q does not read terminal but availability "+
					"says %v", tc.pushPrefix, tc.label, avail.Reasons)
			}

			// And the authorization sink: reopening must cost task:accept if
			// and only if the label counted.
			accepted := pb.TaskStage_TASK_STAGE_ACCEPTED
			_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, Stage: &accepted,
			})
			if tc.wantTerminal {
				requireDeniedFor(t, err, server.ScopeTaskAccept,
					fmt.Sprintf("reopen with push_prefix=%q label=%q", tc.pushPrefix, tc.label))
			} else if err != nil {
				t.Fatalf("push_prefix=%q label=%q: reopen cost more than task:write (%v), "+
					"but the label is not an authorization input. %s",
					tc.pushPrefix, tc.label, err, tc.why)
			}
		})
	}
}

// TestLabelWriteScope_StockLabelBesideAnAcceptedTaskStaysReadyWork is the cell
// the audit measured as CHANGED by round 4 and reverted by B6:
// [duplicate, ft:stage/accepted]. Round 3 read it as accepted, round 4 as
// duplicate/TERMINAL, and B6 puts it back — deliberately this time, with the
// reason recorded rather than as a side effect of a precedence collapse.
//
// This asserts the full consequence, not just the stage: the task is available,
// it is claimable, and reopening it is free. A task wrongly unavailable is the
// safe direction of this bug, but it is still a bug — it silently removes work
// from every agent's queue.
func TestLabelWriteScope_StockLabelBesideAnAcceptedTaskStaysReadyWork(t *testing.T) {
	f := openIssue(t, "duplicate", stageLabel(task.StageAccepted))

	if got := f.lifecycleStage(t); store.IsTerminalStage(got) {
		t.Fatalf("lifecycle stage %q is terminal; a stock GitHub label beside an accepted "+
			"task must not mark it finished", got)
	}
	if avail := f.availability(t); !avail.Available {
		t.Fatalf("task is unavailable (%v); the stock label removed real work from the queue",
			avail.Reasons)
	}

	tasks, _, err := f.ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &f.collID})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
	}
	if _, err := f.ms.ClaimTask(context.Background(), tasks[0].ID, uuid.New(), ""); err != nil {
		t.Fatalf("ClaimTask was refused (%v); the enforcement gate still reads the stock label",
			err)
	}

	// CONTROL: the prefixed spelling in the same position must still withhold
	// the task, so this test cannot pass because the terminal rule is gone.
	g := openIssue(t, stageLabel(task.StageDuplicate), stageLabel(task.StageAccepted))
	if got := g.lifecycleStage(t); got != task.StageDuplicate {
		t.Fatalf("CONTROL BROKEN: [%s %s] reads as %q, want duplicate; the masked-terminal "+
			"rule from round 4 has been lost", stageLabel(task.StageDuplicate),
			stageLabel(task.StageAccepted), got)
	}
}

// protoStage converts a stage to its proto enum for a request, failing the test
// on an unmapped value rather than sending TASK_STAGE_UNSPECIFIED — which
// UpdateTask rejects as InvalidArgument and which a denial assertion could
// mistake for a refusal.
func protoStage(t *testing.T, s task.Stage) pb.TaskStage {
	t.Helper()
	byStage := map[task.Stage]pb.TaskStage{
		task.StageTriage:    pb.TaskStage_TASK_STAGE_TRIAGE,
		task.StageAccepted:  pb.TaskStage_TASK_STAGE_ACCEPTED,
		task.StageWorking:   pb.TaskStage_TASK_STAGE_WORKING,
		task.StageInReview:  pb.TaskStage_TASK_STAGE_IN_REVIEW,
		task.StageInQa:      pb.TaskStage_TASK_STAGE_IN_QA,
		task.StageDeploying: pb.TaskStage_TASK_STAGE_DEPLOYING,
		task.StageCompleted: pb.TaskStage_TASK_STAGE_COMPLETED,
		task.StageWontFix:   pb.TaskStage_TASK_STAGE_WONT_FIX,
		task.StageDuplicate: pb.TaskStage_TASK_STAGE_DUPLICATE,
		task.StageCancelled: pb.TaskStage_TASK_STAGE_CANCELLED,
	}
	p, ok := byStage[s]
	if !ok {
		t.Fatalf("no proto stage for %q", s)
	}
	return p
}

// ── #194 round 7 / audit A-4: the free retryable label-destruction primitive ──
//
// Round 6 charged the label write for the transition it INDUCES, computed
// against the snapshot the server read. That is the right rule and it closes
// the common case. What it does not close is the case where the edit induces
// NOTHING against that snapshot.
//
// Three facts compose:
//
//  1. The gate compares lifecycle stage SETS derived from the snapshot
//     `existing`. Removing a label ABSENT from that snapshot leaves
//     before == after, SameStageSet is true, and no scope is charged at all.
//  2. The write was unconditional and blind. labelNamesToIDs resolves against
//     the REPO-WIDE label index, not against the labels this issue carries, so
//     the removal mutation went out whether or not the label was ever there.
//  3. p.Version is not consulted on this path, so nothing detects that the
//     issue changed between the decision and the write.
//
// Composed, a token holding nothing but task:write gets a primitive it can
// retry indefinitely at zero cost: fire remove_labels[ft:stage/wont_fix] in a
// loop, and the first iteration that lands after some other actor applies that
// label destroys it. The gate never charged for the destruction because at
// every decision point there was nothing there to destroy.
//
// WHAT THE FIX IS. The write is narrowed to the part of the request that was
// meaningful against the very snapshot authorization evaluated: a removal of a
// label that was already absent, and an addition of a label that was already
// present, are no-ops BY DEFINITION at decision time, so they are dropped
// rather than sent. Anything the gate actually reasoned about is untouched.
//
// WHAT THIS IS NOT. It is not a general cure for the TOCTOU window between the
// snapshot and the write — an edit the gate DID authorize can still land on an
// issue that has moved underneath it. It removes the free, unbounded,
// retryable primitive, which is the part that turns a race into an exploit.
// The general cure is #203, moving the authoritative stage off labels.

// TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw is the
// composed-bypass reproduction. It is RED before the fix.
//
// It exercises the REAL gate and the REAL write path — FarmTableService.
// UpdateTask over MultiStore over GitHubPassThroughStore over the GraphQL
// mock — rather than restating either half, because the whole defect lives in
// the seam between them and neither half is wrong on its own.
func TestUpdateTask_FreeRemovalCannotDestroyALabelTheGateNeverSaw(t *testing.T) {
	label := stageLabel(task.StageWontFix)

	// The issue starts WITHOUT the label, which is what makes the request free
	// at the gate.
	f := openIssue(t)
	if got := f.issue.currentLabels(); containsLabel(got, label) {
		t.Fatalf("BASELINE BROKEN: the issue already carries %q; labels %v", label, got)
	}

	// A maintainer declines the task concurrently: after the gate has decided,
	// before the label write goes out.
	f.issue.interleaveAtUpdateIssue(func(m *labelWriteIssueMock) { m.add(label) })

	// The attacker holds task:write and nothing else. This call is EXPECTED to
	// succeed — against the snapshot it is a no-op, and denying no-ops would
	// make ordinary label hygiene cost task:accept. Succeeding cheaply is the
	// premise of the attack, not the defect. The defect is what the write then
	// does.
	if err := f.removeLabels(agentScopes(), label); err != nil {
		t.Fatalf("remove_labels[%s] on an issue that does not carry it was rejected (%v); "+
			"a no-op removal must stay a plain task:write", label, err)
	}

	// HARNESS SELF-CHECK, before any conclusion is drawn. If the second actor
	// never ran, the label would be absent for a reason that has nothing to do
	// with the control, and this test would pass while measuring nothing.
	if got := f.issue.interleaves(); got != 1 {
		t.Fatalf("HARNESS BROKEN: the concurrent maintainer edit ran %d times, want 1", got)
	}

	// THE MEASUREMENT. The maintainer's decline must still be there.
	if got := f.issue.currentLabels(); !containsLabel(got, label) {
		t.Fatalf("a task:write-only caller destroyed %q, which the gate never authorized "+
			"and never charged for; labels now %v", label, got)
	}
	if got := f.lifecycleStages(t); !containsStage(got, task.StageWontFix) {
		t.Fatalf("the lifecycle stage set is %v, want it to still name wont_fix", got)
	}

	// DIFFERENTIAL. The fix must narrow the write, not disable it. Now that the
	// label IS in the snapshot the gate reads, the same removal must go through
	// — at the price the gate names, which the caller now pays.
	if err := f.removeLabels(withScope(server.ScopeTaskAccept), label); err != nil {
		t.Fatalf("remove_labels[%s] with task:accept, on an issue that really carries it, "+
			"was rejected (%v); the fix has disabled legitimate removals", label, err)
	}
	if got := f.issue.currentLabels(); containsLabel(got, label) {
		t.Fatalf("the authorized removal did nothing; labels now %v", got)
	}
}

// TestUpdateTask_FreeAdditionCannotRestoreALabelTheGateNeverSaw is A-4 in the
// other direction, and it is the same defect rather than a second one.
//
// Re-adding a label the issue already carries is free at the gate for the same
// reason removing an absent one is: before == after. The blind write then
// re-applies it regardless. So a task:write-only caller can revert another
// actor's authorized REMOVAL of a terminal label — re-marking a task terminal,
// out of `ft ready` and unclaimable — as cheaply as it could destroy an
// addition. Both halves are closed by the same narrowing, and pinning only the
// removal half would leave a fix that could be half-reverted silently.
func TestUpdateTask_FreeAdditionCannotRestoreALabelTheGateNeverSaw(t *testing.T) {
	label := stageLabel(task.StageCompleted)

	// The issue starts WITH the label, which is what makes re-adding it free.
	f := openIssue(t, label)
	if got := f.issue.currentLabels(); !containsLabel(got, label) {
		t.Fatalf("BASELINE BROKEN: the issue does not carry %q; labels %v", label, got)
	}

	// Another actor reopens the task concurrently, after the gate has decided.
	f.issue.interleaveAtUpdateIssue(func(m *labelWriteIssueMock) { m.remove(label) })

	if err := f.addLabels(agentScopes(), label); err != nil {
		t.Fatalf("add_labels[%s] on an issue that already carries it was rejected (%v); "+
			"a no-op restamp must stay a plain task:write", label, err)
	}

	if got := f.issue.interleaves(); got != 1 {
		t.Fatalf("HARNESS BROKEN: the concurrent reopen ran %d times, want 1", got)
	}

	if got := f.issue.currentLabels(); containsLabel(got, label) {
		t.Fatalf("a task:write-only caller restored %q after another actor removed it, "+
			"forging a terminal stage the gate never charged for; labels now %v", label, got)
	}
	if got := f.lifecycleStages(t); containsStage(got, task.StageCompleted) {
		t.Fatalf("the lifecycle stage set is %v, want it to no longer name completed", got)
	}

	// DIFFERENTIAL. Adding the label when it is genuinely absent from the
	// snapshot is a real transition and must still work at the gate's price.
	if err := f.addLabels(withScope(server.ScopeTaskClose), label); err != nil {
		t.Fatalf("add_labels[%s] with task:close, on an issue that does not carry it, "+
			"was rejected (%v); the fix has disabled legitimate additions", label, err)
	}
	if got := f.issue.currentLabels(); !containsLabel(got, label) {
		t.Fatalf("the authorized addition did nothing; labels now %v", got)
	}
}

// containsStage reports whether a lifecycle stage set names a stage.
func containsStage(stages []task.Stage, want task.Stage) bool {
	for _, s := range stages {
		if s == want {
			return true
		}
	}
	return false
}
