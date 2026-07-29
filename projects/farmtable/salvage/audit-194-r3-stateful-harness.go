// PROVENANCE: #194 close-label-swap, SECURITY AUDIT leg -- scoping measurement
// for round 5. Written and executed against clone /workspace/farmtable-audit-194
// at SHA 03ab6b63287b29b079afac30f7a0fb345052a521 (the LANDED round-4 fix,
// "Fix #194 multi-label terminal bypass at the root"). Earlier revisions of this
// same harness ran against 651da26 and against a candidate fix; the code below
// is byte-identical to what produced the output pasted into
// /scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r3.md.
//
// WHY THIS FILE EXISTS AS AN ARTIFACT AND NOT AS PROSE
// ----------------------------------------------------
// The mock is the load-bearing part. My first attempt at the multi-call chains
// reused a STATELESS mock -- one that acknowledged addLabelsToLabelable and then
// kept serving the original label set -- and BOTH tests PASSED, i.e. reported no
// bypass, exit code 0. That was a false negative on a true Critical finding. A
// harness that cannot express a state change makes multi-call attack chains
// INEXPRESSIBLE, not disproven, and every probe built on it passes.
//
// Three specific traps this mock exists to avoid:
//   1. removeLabelsFromLabelable must MUTATE. The test leg's sibling probe
//      (test-194-r3-selfservice-probe.go, same directory) leaves it a no-op
//      acknowledgement. REV3 -- direction 1 in its entirety -- silently reports
//      "DENIED" against that probe's mock.
//   2. issue(number:) needs its own case, tested BEFORE issues( and before the
//      bare repository(owner:) fallthrough. Without it ClaimTask dies on
//      `struct field for "labels" doesn't exist in any of 1 places to unmarshal`
//      before ever reaching the gate under test.
//   3. closeIssue must be COUNTED, not just answered. REV10 uses that counter to
//      establish that UpdateTask never closes a GitHub issue, which is what
//      converts "a task:write holder can close any task" from an assumption into
//      a measured and considerably narrower claim.
//
// TestAUDIT_REV0_HarnessIsStateful guards traps 1 and 2. It fails CLOSED and it
// MUST be run and seen to pass before any negative result below means anything.
//
// WHAT IT MEASURES, against the production object graph
// (EntStore -> MultiStore -> PlatformResolver -> bare *GitHubPassThroughStore,
// matching cmd/farmtable-server/main.go:39,60,61 and resolver.go:26):
//
//   REV0   harness self-check, add AND remove                     -> must PASS
//   REV1   DIRECTION 1, reopen via ADD    (add ft:stage/accepted)
//   REV3   DIRECTION 1, reopen via REMOVE (strip the terminal label)
//   REV4   ClaimTask sink, both spellings
//   REV5   ComputeAvailability sink, both spellings
//   REV6   floor check: CLOSED issue, strip the label, reopen
//   REV7   DIRECTION 2, close direction from an ORDINARY accepted task, x4 dests
//   REV8   DIRECTION 2, close direction from a terminal start (single case)
//   REV8b  DIRECTION 2, full 12-cell terminal-start matrix -- the ordering result
//   REV9   does from == to need SEPARATE hardening? (no label write at all)
//   REV10  what the close direction ACTUALLY does; counts closeIssue mutations
//
// MEASURED RESULT AT 03ab6b6 -- all BY EXECUTION:
//
//   DIRECTION 1 (reopen)   add spelling     CLOSED by the round-4 fix
//                          remove spelling  OPEN on all three sinks
//   DIRECTION 2 (close)    from accepted    OPEN for all 4 terminal destinations
//                          from terminal    OPEN for 6 of 12 cells, exactly when
//                                           rank(dest) < rank(start) in
//                                           terminalStagePrecedence
//   from == to alone       NOT exploitable without a label write (REV9)
//   actual effect          0 closeIssue mutations; the damage lands at the ADD,
//                          the short-circuit only tidies the label set (REV10)
//
// HOW TO ADOPT AS REGRESSION TESTS once the label-write scope control lands:
//   1. Drop in as internal/server/authz_label_write_scope_test.go (package
//      server_test).
//   2. INVERT the terminal assertions in REV3/REV4/REV5 (direction 1) and
//      REV7/REV8b (direction 2). Today those succeeding IS the bug.
//   3. KEEP every "BASELINE BROKEN" t.Fatalf. They are what make the suite fail
//      closed: if the gate is already open for the single-label case the probe
//      proves nothing and must not be allowed to pass.
//   4. KEEP REV0 verbatim and keep it first.
//   5. KEEP REV6 and REV9 as PASSING tests. They pin the two properties that
//      currently hold -- the CLOSED-issue floor, and from == to being a genuine
//      no-op. REV9 in particular holds only because passthrough.go:412-431 never
//      writes p.Phase; if a later change makes UpdateTask honour phase for
//      GitHub-backed tasks, REV9 goes red and the short-circuit becomes live.
//      That is the single most valuable early-warning test in this file.
//   6. KEEP REV8b as a matrix rather than a single case. The 6-of-12 pattern is
//      what proves the exposure is a property of ordered tiebreaking itself and
//      not of the particular order chosen.
//   7. Depends on in-repo helpers: testutil.NewTestStore, scopedCtx (from
//      authz_terminal_reopen_test.go), newPassThroughStoreWithMock (from
//      passthrough_e2e_test.go).
//
package server_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// STATEFUL GITHUB MOCK
//
// The load-bearing part. A STATELESS mock (one that acknowledges
// addLabelsToLabelable / removeLabelsFromLabelable and then keeps serving the
// original label set) makes every multi-call attack chain INEXPRESSIBLE, and
// therefore makes every such test PASS. That is a false negative, not a
// negative. See TestAUDIT_REV0_HarnessIsStateful.
// ---------------------------------------------------------------------------

var revLabelIDs = map[string]string{
	"L_triage": "ft:stage/triage", "L_accepted": "ft:stage/accepted",
	"L_working": "ft:stage/working", "L_in_review": "ft:stage/in_review",
	"L_completed": "ft:stage/completed", "L_wont_fix": "ft:stage/wont_fix",
	"L_duplicate": "ft:stage/duplicate", "L_cancelled": "ft:stage/cancelled",
}

type statefulGH struct {
	mu         sync.Mutex
	labels     []string
	state      string // "OPEN" / "CLOSED"
	closeCalls int    // how many closeIssue mutations the product actually issued
}

func (g *statefulGH) closes() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.closeCalls
}

func (g *statefulGH) snapshot() []string {
	g.mu.Lock()
	defer g.mu.Unlock()
	out := append([]string(nil), g.labels...)
	sort.Strings(out)
	return out
}

func (g *statefulGH) add(name string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	for _, l := range g.labels {
		if l == name {
			return
		}
	}
	g.labels = append(g.labels, name)
}

// remove is the handler the test leg's probe left as a no-op. Step 3 of this
// revision is meaningless without it.
func (g *statefulGH) remove(name string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	out := g.labels[:0]
	for _, l := range g.labels {
		if l != name {
			out = append(out, l)
		}
	}
	g.labels = out
}

func (g *statefulGH) issueJSON() string {
	nodes := make([]string, 0)
	for _, l := range g.snapshot() {
		nodes = append(nodes, fmt.Sprintf(`{"name":%q}`, l))
	}
	g.mu.Lock()
	st := g.state
	g.mu.Unlock()
	return fmt.Sprintf(`{
      "id":"I_issue1","number":1,"title":"Abandoned","body":"","state":%q,"stateReason":null,
      "createdAt":"2026-01-15T10:00:00Z","updatedAt":"2026-01-16T12:00:00Z",
      "url":"https://github.com/acme/widgets/issues/1",
      "labels":{"nodes":[%s]},"assignees":{"nodes":[]},"milestone":null,
      "subIssues":{"nodes":[],"totalCount":0},
      "subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}`,
		st, strings.Join(nodes, ","))
}

func (g *statefulGH) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		b := string(body)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(b, "addLabelsToLabelable"):
			for id, name := range revLabelIDs {
				if strings.Contains(b, `"`+id+`"`) {
					g.add(name)
					t.Logf("        [github] +%s -> %v", name, g.snapshot())
				}
			}
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(b, "removeLabelsFromLabelable"):
			for id, name := range revLabelIDs {
				if strings.Contains(b, `"`+id+`"`) {
					g.remove(name)
					t.Logf("        [github] -%s -> %v", name, g.snapshot())
				}
			}
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(b, "updateIssue"):
			_, _ = fmt.Fprintf(w, `{"data":{"updateIssue":{"issue":%s}}}`, g.issueJSON())
		case strings.Contains(b, "reopenIssue"):
			g.mu.Lock()
			g.state = "OPEN"
			g.mu.Unlock()
			_, _ = fmt.Fprintf(w, `{"data":{"reopenIssue":{"issue":%s}}}`, g.issueJSON())
		case strings.Contains(b, "closeIssue"):
			g.mu.Lock()
			g.state = "CLOSED"
			g.closeCalls++
			g.mu.Unlock()
			t.Logf("        [github] closeIssue -> state=CLOSED")
			_, _ = fmt.Fprintf(w, `{"data":{"closeIssue":{"issue":%s}}}`, g.issueJSON())
		case strings.Contains(b, "addAssignees"):
			_, _ = fmt.Fprintf(w, `{"data":{"addAssigneesToAssignable":{"assignable":{"id":"I_issue1"}}}}`)
		// NOTE: issue(number:) MUST be tested before issues(, and both before
		// the bare repository(owner:) fallthrough. Omitting this case is what
		// made my first REV2 attempt die on a GraphQL unmarshal error inside
		// ClaimTask, before it ever reached the gate under test.
		case strings.Contains(b, "issue(number:"):
			_, _ = fmt.Fprintf(w, `{"data":{"repository":{"issue":%s}}}`, g.issueJSON())
		case strings.Contains(b, "issues("):
			_, _ = fmt.Fprintf(w,
				`{"data":{"repository":{"issues":{"nodes":[%s],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`,
				g.issueJSON())
		case strings.Contains(b, "labels(first:"):
			nodes := make([]string, 0)
			for id, name := range revLabelIDs {
				nodes = append(nodes, fmt.Sprintf(`{"id":%q,"name":%q}`, id, name))
			}
			_, _ = w.Write([]byte(`{"data":{"repository":{"labels":{"nodes":[` +
				strings.Join(nodes, ",") + `],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
		case strings.Contains(b, "repository(owner:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"R_repo1"}}}`))
		default:
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}
}

// revRig builds the PRODUCTION object graph: EntStore -> MultiStore ->
// PlatformResolver -> bare *GitHubPassThroughStore, matching
// cmd/farmtable-server/main.go:39,60,61 and resolver.go:26.
func revRig(t *testing.T, initial []string) (*server.FarmTableService, *store.MultiStore, string, *statefulGH) {
	t.Helper()
	ctx := context.Background()
	gh := &statefulGH{labels: append([]string(nil), initial...), state: "OPEN"}

	entStore, cleanup := testutil.NewTestStore(t)
	t.Cleanup(cleanup)
	ms := store.NewMultiStore(entStore)
	t.Cleanup(func() { _ = ms.Close() })

	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name: "acme/widgets", Platform: string(collection.PlatformGithub), RemoteID: "acme/widgets"})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	if _, err := ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID, Platform: "github", AuthToken: "ghp_mock",
		AuthMethod: "pat", Scopes: []string{"repo"}}); err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}
	mock := httptest.NewServer(gh.handler(t))
	t.Cleanup(mock.Close)
	ms.SetResolver(func(p collection.Platform, tok, rid string, cid uuid.UUID) (store.Store, error) {
		owner, r, ok := store.ParseOwnerRepo(rid)
		if p != collection.PlatformGithub || !ok {
			return nil, nil
		}
		return newPassThroughStoreWithMock(t, mock, owner, r, cid), nil
	})
	svc := server.NewFarmTableService(ms, "test")

	cid := coll.ID.String()
	list, err := svc.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: &cid})
	if err != nil || len(list.GetItems()) != 1 {
		t.Fatalf("ListTasks: %v items=%d", err, len(list.GetItems()))
	}
	return svc, ms, list.GetItems()[0].GetId(), gh
}

func revAgent() context.Context { return scopedCtx(server.DefaultScopesForUserType("agent")) }

// ---------------------------------------------------------------------------
// REV0 -- HARNESS SELF-CHECK. Must run and pass before any negative result
// from REV1/REV3 means anything. Fails CLOSED.
// ---------------------------------------------------------------------------

func TestAUDIT_REV0_HarnessIsStateful(t *testing.T) {
	svc, _, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
	agent := revAgent()

	before := gh.snapshot()
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, AddLabels: []string{"ft:stage/accepted"}}); err != nil {
		t.Fatalf("HARNESS BROKEN: AddLabels errored: %v", err)
	}
	afterAdd := gh.snapshot()
	if len(afterAdd) != len(before)+1 {
		t.Fatalf("HARNESS NOT STATEFUL ON ADD: labels unchanged (%v -> %v); "+
			"any bypass result would be a false negative", before, afterAdd)
	}
	t.Logf("    add    : %v -> %v  OK", before, afterAdd)

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, RemoveLabels: []string{"ft:stage/wont_fix"}}); err != nil {
		t.Fatalf("HARNESS BROKEN: RemoveLabels errored: %v", err)
	}
	afterRemove := gh.snapshot()
	if len(afterRemove) != len(afterAdd)-1 {
		t.Fatalf("HARNESS NOT STATEFUL ON REMOVE: labels unchanged (%v -> %v); "+
			"REV3's result would be a false negative. This is exactly the no-op "+
			"removeLabelsFromLabelable handler the test leg's probe shipped with",
			afterAdd, afterRemove)
	}
	for _, l := range afterRemove {
		if l == "ft:stage/wont_fix" {
			t.Fatalf("HARNESS NOT STATEFUL ON REMOVE: terminal label survives: %v", afterRemove)
		}
	}
	t.Logf("    remove : %v -> %v  OK", afterAdd, afterRemove)
	t.Logf("    HARNESS PROVEN STATEFUL IN BOTH DIRECTIONS")
}

// ---------------------------------------------------------------------------
// REV1 -- does the F1 fix close the ADD-a-label spelling of the chain?
// ---------------------------------------------------------------------------

func TestAUDIT_REV1_AddLabelChain(t *testing.T) {
	svc, _, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
	agent := revAgent()
	accepted := pb.TaskStage_TASK_STAGE_ACCEPTED

	_, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted})
	if err == nil {
		t.Fatalf("BASELINE BROKEN: step 1 reopen already allowed; probe proves nothing")
	}
	t.Logf("  step 1  reopen                        -> DENIED (%v)   labels=%v", err, gh.snapshot())

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, AddLabels: []string{"ft:stage/accepted"}}); err != nil {
		t.Fatalf("step 2 AddLabels rejected: %v", err)
	}
	t.Logf("  step 2  add_labels[ft:stage/accepted] -> ALLOWED         labels=%v", gh.snapshot())

	_, err = svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted})
	if err != nil {
		t.Logf("  step 3  reopen                        -> DENIED (%v)   labels=%v", err, gh.snapshot())
		t.Logf("  RESULT: F1 FIX CLOSES THE ADD-LABEL CHAIN.")
		return
	}
	t.Errorf("  step 3  reopen                        -> ALLOWED  labels=%v\n"+
		"  *** ADD-LABEL CHAIN STILL OPEN AFTER THE FIX ***", gh.snapshot())
}

// ---------------------------------------------------------------------------
// REV3 -- THE QUESTION. Does removing the terminal label reopen the chain?
// ---------------------------------------------------------------------------

func TestAUDIT_REV3_RemoveLabelChain(t *testing.T) {
	svc, _, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
	agent := revAgent()
	accepted := pb.TaskStage_TASK_STAGE_ACCEPTED

	_, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted})
	if err == nil {
		t.Fatalf("BASELINE BROKEN: step 1 reopen already allowed; probe proves nothing")
	}
	t.Logf("  step 1  reopen                            -> DENIED (%v)   labels=%v", err, gh.snapshot())

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, RemoveLabels: []string{"ft:stage/wont_fix"}}); err != nil {
		t.Fatalf("step 2 RemoveLabels rejected: %v (escalation not available this way)", err)
	}
	t.Logf("  step 2  remove_labels[ft:stage/wont_fix]  -> ALLOWED         labels=%v", gh.snapshot())

	_, err = svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted})
	if err != nil {
		t.Logf("  step 3  reopen                            -> DENIED (%v)   labels=%v", err, gh.snapshot())
		t.Logf("  RESULT: remove-label chain is CLOSED too.")
		return
	}
	t.Errorf("  step 3  reopen                            -> ALLOWED  labels=%v\n"+
		"  *** CRITICAL -- THE F1 FIX RENAMES THE CHAIN, IT DOES NOT CLOSE IT ***\n"+
		"  A token holding only task:write STRIPPED the terminal label and then reopened.\n"+
		"  No terminal scan, however written, can see a label that is no longer there.",
		gh.snapshot())
}

// ---------------------------------------------------------------------------
// REV4 -- the F2b sink (ClaimTask) under both spellings.
// ---------------------------------------------------------------------------

func TestAUDIT_REV4_ClaimGateBothSpellings(t *testing.T) {
	claim := func(t *testing.T, mutate func(context.Context, *server.FarmTableService, string)) (error, []string) {
		svc, _, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
		agent := revAgent()
		if mutate != nil {
			mutate(agent, svc, id)
		}
		claimCtx := scopedCtx(append(server.DefaultScopesForUserType("agent"), "task:claim"))
		_, err := svc.ClaimTask(claimCtx, &pb.ClaimTaskRequest{Id: id})
		return err, gh.snapshot()
	}

	baseErr, baseLabels := claim(t, nil)
	t.Logf("  baseline  claim [wont_fix]                       -> err=%v  labels=%v", baseErr, baseLabels)
	if baseErr == nil {
		t.Fatalf("BASELINE BROKEN: claim already allowed on a bare wont_fix issue")
	}

	addErr, addLabels := claim(t, func(c context.Context, svc *server.FarmTableService, id string) {
		if _, err := svc.UpdateTask(c, &pb.UpdateTaskRequest{Id: id, AddLabels: []string{"ft:stage/accepted"}}); err != nil {
			t.Fatalf("AddLabels: %v", err)
		}
	})
	t.Logf("  add       claim [wont_fix + accepted]            -> err=%v  labels=%v", addErr, addLabels)

	remErr, remLabels := claim(t, func(c context.Context, svc *server.FarmTableService, id string) {
		if _, err := svc.UpdateTask(c, &pb.UpdateTaskRequest{Id: id, RemoveLabels: []string{"ft:stage/wont_fix"}}); err != nil {
			t.Fatalf("RemoveLabels: %v", err)
		}
	})
	t.Logf("  remove    claim [wont_fix stripped -> bare]      -> err=%v  labels=%v", remErr, remLabels)

	if addErr == nil {
		t.Errorf("  *** F2b ADD-SPELLING STILL OPEN AFTER FIX *** claim succeeded, labels=%v", addLabels)
	}
	if remErr == nil {
		t.Errorf("  *** F2b REMOVE-SPELLING OPEN *** a task:write holder stripped the terminal "+
			"label and then claimed a declined issue. labels=%v", remLabels)
	}
}

// ---------------------------------------------------------------------------
// REV5 -- the F2 sink (ComputeAvailability) under both spellings.
// ---------------------------------------------------------------------------

func TestAUDIT_REV5_AvailabilityBothSpellings(t *testing.T) {
	avail := func(t *testing.T, mutate func(context.Context, *server.FarmTableService, string)) (string, []string) {
		ctx := context.Background()
		svc, ms, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
		if mutate != nil {
			mutate(revAgent(), svc, id)
		}
		tid := uuid.MustParse(id)
		tk, err := ms.GetTask(ctx, tid)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		av, err := ms.ComputeAvailability(ctx, tk)
		if err != nil {
			t.Fatalf("ComputeAvailability: %v", err)
		}
		return fmt.Sprintf("Available=%v Reasons=%v stage=%v", av.Available, av.Reasons, tk.Stage), gh.snapshot()
	}

	base, baseL := avail(t, nil)
	t.Logf("  baseline  [wont_fix]                  -> %s  labels=%v", base, baseL)
	if !strings.Contains(base, "Available=false") {
		t.Fatalf("BASELINE BROKEN: declined issue already available")
	}

	add, addL := avail(t, func(c context.Context, svc *server.FarmTableService, id string) {
		if _, err := svc.UpdateTask(c, &pb.UpdateTaskRequest{Id: id, AddLabels: []string{"ft:stage/accepted"}}); err != nil {
			t.Fatalf("AddLabels: %v", err)
		}
	})
	t.Logf("  add       [wont_fix + accepted]       -> %s  labels=%v", add, addL)

	rem, remL := avail(t, func(c context.Context, svc *server.FarmTableService, id string) {
		if _, err := svc.UpdateTask(c, &pb.UpdateTaskRequest{Id: id, RemoveLabels: []string{"ft:stage/wont_fix"}}); err != nil {
			t.Fatalf("RemoveLabels: %v", err)
		}
	})
	t.Logf("  remove    [wont_fix stripped -> bare] -> %s  labels=%v", rem, remL)

	if strings.Contains(add, "Available=true") {
		t.Errorf("  *** F2 ADD-SPELLING STILL OPEN AFTER FIX *** %s", add)
	}
	if strings.Contains(rem, "Available=true") {
		t.Errorf("  *** F2 REMOVE-SPELLING OPEN *** a declined issue is back in the ready queue "+
			"after a task:write holder stripped its terminal label: %s", rem)
	}
}

// ---------------------------------------------------------------------------
// REV6 -- IS THERE A FLOOR? For a CLOSED issue, GitHub's state:CLOSED is a
// real field, not a label, and passthrough.go:818 checks t.ClosedAt != nil
// independently. So stripping the label should NOT be enough. Measure it.
// ---------------------------------------------------------------------------

func TestAUDIT_REV6_ClosedIssueFloor(t *testing.T) {
	ctx := context.Background()
	svc, ms, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
	gh.mu.Lock()
	gh.state = "CLOSED"
	gh.mu.Unlock()
	agent := revAgent()
	accepted := pb.TaskStage_TASK_STAGE_ACCEPTED
	tid := uuid.MustParse(id)

	show := func(tag string) {
		tk, err := ms.GetTask(ctx, tid)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		av, _ := ms.ComputeAvailability(ctx, tk)
		t.Logf("  %-34s phase=%v stage=%v closedAt=%v Available=%v Reasons=%v labels=%v",
			tag, tk.Phase, tk.Stage, tk.ClosedAt != nil, av.Available, av.Reasons, gh.snapshot())
	}
	show("initial (CLOSED + wont_fix)")

	_, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted})
	if err == nil {
		t.Fatalf("BASELINE BROKEN: reopen of a CLOSED wont_fix issue already allowed")
	}
	t.Logf("  step 1  reopen                     -> DENIED (%v)", err)

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, RemoveLabels: []string{"ft:stage/wont_fix"}}); err != nil {
		t.Fatalf("step 2 RemoveLabels rejected: %v", err)
	}
	t.Logf("  step 2  remove_labels[wont_fix]    -> ALLOWED  labels=%v", gh.snapshot())
	show("after strip (CLOSED, no labels)")

	_, err = svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted})
	if err != nil {
		t.Logf("  step 3  reopen                     -> DENIED (%v)", err)
		t.Logf("  RESULT: FLOOR EXISTS for a CLOSED issue -- state:CLOSED is not a label.")
		return
	}
	t.Errorf("  step 3  reopen                     -> ALLOWED  labels=%v\n"+
		"  *** NO FLOOR *** even the CLOSED state did not hold once the label was stripped.",
		gh.snapshot())
}

// ===========================================================================
// DIRECTION 2 -- the CLOSE direction. A correct terminal scan is precisely
// what puts an attacker-supplied label into TransitionScope's `from` position,
// where the from == to short-circuit (transitions.go:124) returns
// ScopeTaskWrite before the "closing always wins" rule is ever consulted.
// ===========================================================================

// revStageProto maps a terminal stage name to its proto enum.
var revStageProto = map[string]pb.TaskStage{
	"completed": pb.TaskStage_TASK_STAGE_COMPLETED,
	"wont_fix":  pb.TaskStage_TASK_STAGE_WONT_FIX,
	"duplicate": pb.TaskStage_TASK_STAGE_DUPLICATE,
	"cancelled": pb.TaskStage_TASK_STAGE_CANCELLED,
}

// REV7 -- the exact chain the EM reconstructed, from an ORDINARY accepted task.
func TestAUDIT_REV7_CloseDirectionFromAccepted(t *testing.T) {
	for _, dest := range []string{"completed", "wont_fix", "duplicate", "cancelled"} {
		t.Run(dest, func(t *testing.T) {
			ctx := context.Background()
			svc, ms, id, gh := revRig(t, []string{"ft:stage/accepted"})
			agent := revAgent()
			tid := uuid.MustParse(id)
			label := "ft:stage/" + dest
			to := revStageProto[dest]

			show := func(tag string) {
				tk, err := ms.GetTask(ctx, tid)
				if err != nil {
					t.Fatalf("GetTask: %v", err)
				}
				t.Logf("      %-28s phase=%v stage=%v closed=%v labels=%v",
					tag, tk.Phase, tk.Stage, tk.ClosedAt != nil, gh.snapshot())
			}
			show("step 0  ordinary open task")

			// BASELINE, fails closed: closing must cost task:close today.
			if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &to}); err == nil {
				t.Fatalf("BASELINE BROKEN: close to %s already allowed with task:write; probe proves nothing", dest)
			} else {
				t.Logf("      step 1  close directly       -> DENIED (%v)", err)
			}

			// Step 2: add the terminal label matching the intended destination.
			if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, AddLabels: []string{label}}); err != nil {
				t.Fatalf("step 2 AddLabels[%s] rejected: %v (chain unavailable)", label, err)
			}
			t.Logf("      step 2  add_labels[%s] -> ALLOWED  labels=%v", label, gh.snapshot())
			show("        after label add")

			// Step 3: the same close that was denied at step 1.
			if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &to}); err != nil {
				t.Logf("      step 3  close to %-9s    -> DENIED (%v)", dest, err)
				t.Logf("      RESULT: close direction CLOSED for %s.", dest)
				return
			}
			show("        after close")
			t.Errorf("      step 3  close to %-9s    -> ALLOWED\n"+
				"      *** CLOSE-DIRECTION BYPASS *** a token holding task:write and NOT task:close "+
				"marked an ordinary accepted task %s. labels=%v", dest, dest, gh.snapshot())
		})
	}
}

// REV8 -- does the same shape work from a TERMINAL starting state? i.e. can a
// task:write holder re-close / re-label an already-declined issue.
func TestAUDIT_REV8_CloseDirectionFromTerminal(t *testing.T) {
	ctx := context.Background()
	svc, ms, id, gh := revRig(t, []string{"ft:stage/wont_fix"})
	agent := revAgent()
	tid := uuid.MustParse(id)
	dup := revStageProto["duplicate"]

	show := func(tag string) {
		tk, _ := ms.GetTask(ctx, tid)
		t.Logf("    %-30s phase=%v stage=%v closed=%v labels=%v",
			tag, tk.Phase, tk.Stage, tk.ClosedAt != nil, gh.snapshot())
	}
	show("step 0  OPEN + wont_fix")

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &dup}); err == nil {
		t.Fatalf("BASELINE BROKEN: wont_fix -> duplicate already allowed with task:write")
	} else {
		t.Logf("    step 1  wont_fix -> duplicate  -> DENIED (%v)", err)
	}

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, AddLabels: []string{"ft:stage/duplicate"}}); err != nil {
		t.Fatalf("step 2 AddLabels rejected: %v", err)
	}
	t.Logf("    step 2  add_labels[duplicate]  -> ALLOWED  labels=%v", gh.snapshot())
	show("        after label add")

	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &dup}); err != nil {
		t.Logf("    step 3  wont_fix -> duplicate  -> DENIED (%v)", err)
		t.Logf("    RESULT: terminal-start close direction CLOSED.")
		return
	}
	show("        after transition")
	t.Errorf("    step 3  wont_fix -> duplicate  -> ALLOWED\n"+
		"    *** TERMINAL-START BYPASS *** relabelled a declined issue between terminal "+
		"stages with task:write only. labels=%v", gh.snapshot())
}

// REV9 -- does from == to need SEPARATE hardening? This chain adds and removes
// NOTHING. The attacker only re-asserts a stage the issue's labels already
// name. The post-mutation label-scope control the EM proposes would not fire,
// because there is no label mutation to inspect.
func TestAUDIT_REV9_FromEqualsToNeedsNoLabelWrite(t *testing.T) {
	ctx := context.Background()
	svc, ms, id, gh := revRig(t, []string{"ft:stage/wont_fix"}) // OPEN issue, terminal label
	agent := revAgent()
	tid := uuid.MustParse(id)
	wf := revStageProto["wont_fix"]

	before, err := ms.GetTask(ctx, tid)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	t.Logf("  step 0  OPEN issue carrying ft:stage/wont_fix")
	t.Logf("          phase=%v stage=%v closedAt=%v labels=%v",
		before.Phase, before.Stage, before.ClosedAt != nil, gh.snapshot())
	if before.ClosedAt != nil {
		t.Fatalf("BASELINE BROKEN: issue already closed; the probe measures an open->closed move")
	}

	// No AddLabels. No RemoveLabels. Just re-assert the stage the labels name.
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &wf}); err != nil {
		t.Logf("  step 1  UpdateTask(stage=wont_fix) -> DENIED (%v)", err)
		t.Logf("  RESULT: from == to is NOT exploitable without a label write.")
		return
	}
	after, err := ms.GetTask(ctx, tid)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	t.Logf("  step 1  UpdateTask(stage=wont_fix) -> ALLOWED (task:write, from==to short-circuit)")
	t.Logf("          phase=%v stage=%v closedAt=%v labels=%v",
		after.Phase, after.Stage, after.ClosedAt != nil, gh.snapshot())

	if after.ClosedAt == nil && after.Phase == before.Phase {
		t.Logf("  RESULT: genuinely a no-op. from == to is sound here.")
		return
	}
	t.Errorf("  *** from == to IS NOT A NO-OP *** the issue moved phase=%v -> %v (closedAt %v -> %v) "+
		"with NO label written by the attacker. A post-mutation label-scope control cannot see "+
		"this chain, so from == to needs separate hardening.",
		before.Phase, after.Phase, before.ClosedAt != nil, after.ClosedAt != nil)
}

// REV8b -- the ORDERING-SENSITIVE terminal-start matrix. The dev's claim is
// that under ANY fixed total order an attacker adds the terminal label matching
// their intended destination and wins the from == to short-circuit. From a
// TERMINAL start that is only true when the destination OUTRANKS the incumbent
// in terminalStagePrecedence, because the incumbent otherwise keeps the `from`
// slot and the transition stops being a no-op. Measure the whole matrix.
func TestAUDIT_REV8b_TerminalStartMatrix(t *testing.T) {
	terminals := []string{"completed", "wont_fix", "duplicate", "cancelled"}
	for _, start := range terminals {
		for _, dest := range terminals {
			if start == dest {
				continue
			}
			t.Run(start+"->"+dest, func(t *testing.T) {
				svc, _, id, gh := revRig(t, []string{"ft:stage/" + start})
				agent := revAgent()
				to := revStageProto[dest]

				if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &to}); err == nil {
					t.Fatalf("BASELINE BROKEN: %s -> %s already allowed with task:write", start, dest)
				}
				if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
					Id: id, AddLabels: []string{"ft:stage/" + dest}}); err != nil {
					t.Fatalf("AddLabels rejected: %v", err)
				}
				_, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &to})
				if err != nil {
					t.Logf("  %-11s + add[%-9s] -> stage=%-9s  DENIED   labels=%v", start, dest, dest, gh.snapshot())
					return
				}
				t.Errorf("  %-11s + add[%-9s] -> stage=%-9s  BYPASS   labels=%v",
					start, dest, dest, gh.snapshot())
			})
		}
	}
}

// REV10 -- what does the close direction ACTUALLY do to a GitHub-backed task?
// passthrough.go:412-431 shows UpdateTask swaps labels and never touches issue
// state; p.Phase is not consulted at all. So "the task is closed" may be an
// overstatement. Measure the real end state and count closeIssue mutations.
func TestAUDIT_REV10_CloseDirectionActualEffect(t *testing.T) {
	ctx := context.Background()
	svc, ms, id, gh := revRig(t, []string{"ft:stage/accepted"})
	agent := revAgent()
	tid := uuid.MustParse(id)
	done := revStageProto["completed"]

	show := func(tag string) {
		tk, err := ms.GetTask(ctx, tid)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		av, _ := ms.ComputeAvailability(ctx, tk)
		t.Logf("  %-26s phase=%-6v displayStage=%-9v closedAt=%-5v Available=%-5v Reasons=%v labels=%v",
			tag, tk.Phase, tk.Stage, tk.ClosedAt != nil, av.Available, av.Reasons, gh.snapshot())
	}

	show("step 0  ordinary task")

	// Step 2 ALONE: just the unguarded label add, no stage request at all.
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, AddLabels: []string{"ft:stage/completed"}}); err != nil {
		t.Fatalf("AddLabels: %v", err)
	}
	show("after add_labels ONLY")

	// Step 3: the short-circuited close.
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &done}); err != nil {
		t.Fatalf("step 3 unexpectedly denied: %v", err)
	}
	show("after short-circuit close")

	t.Logf("  closeIssue mutations issued by the product: %d", gh.closes())
	if gh.closes() != 0 {
		t.Errorf("  UNEXPECTED: product issued %d closeIssue mutations; revise the impact analysis", gh.closes())
	}
	t.Logf("  READ: UpdateTask never closes the GitHub issue (p.Phase unused at passthrough.go:412-431).")
	t.Logf("  READ: the damage lands at the ADD, not at the short-circuit. Step 3 only tidies the label set.")
}
