// PROVENANCE: #194 close-label-swap, round-3 TEST REVIEW leg. Written, executed, and deleted
// against clone /workspace/farmtable-test-194 at SHA 651da26. Salvaged here because /tmp is
// container-local. Code below this header is byte-identical to what produced the pasted output.
//
// WHAT IT PROVES (Critical, finding F7): a token holding only task:write escalates BY ITSELF.
// No second actor, no maintainer, no GitHub UI access. UpdateTaskRequest.add_labels is guarded
// only by the blanket task:write at the top of UpdateTask; the transition-scope gate fires ONLY
// when req.Stage is set. So the attacker adds its own non-terminal label, which then masks the
// terminal one in TerminalLabelStage, and reopens.
//
// OBSERVED OUTPUT at 651da26 (go test ./internal/server/ -run TestProbe_SelfServiceEscalationViaAddLabels -v):
//
//   step 0  baseline reopen with agent token      -> DENIED (rpc error: code = PermissionDenied
//                                                    desc = missing required scope "task:accept")
//           [github] label ft:stage/accepted added -> set is now [ft:stage/wont_fix ft:stage/accepted]
//   step 1  AddLabels[ft:stage/accepted], task:write  -> ALLOWED. labels=[ft:stage/wont_fix ft:stage/accepted]
//   --- FAIL: TestProbe_SelfServiceEscalationViaAddLabels (0.01s)
//       SELF-SERVICE ESCALATION CONFIRMED: a token holding only task:write reopened an issue
//       still labelled ft:stage/wont_fix, using two ordinary UpdateTask calls and no GitHub
//       access. Final labels: [ft:stage/wont_fix ft:stage/accepted]
//
// HOW TO ADOPT AS A REGRESSION TEST once F7 lands:
//   1. Drop in as internal/server/authz_multilabel_escalation_test.go (package server_test).
//   2. INVERT the terminal assertion: after the fix, step 2's reopen must be DENIED with
//      PermissionDenied naming task:accept. Today it succeeds; that success is the bug.
//      Concretely: the final t.Errorf becomes the pass path, and reaching it via a nil error
//      becomes the t.Errorf.
//   3. KEEP the step-0 baseline t.Fatal. It is what makes this fail closed: if the gate is
//      already open for the single-label case, the probe proves nothing and must not pass.
//   4. It depends on in-repo test helpers testutil.NewTestStore, scopedCtx, and
//      newPassThroughStoreWithMock. The stateful mock is the load-bearing part -- the
//      addLabelsToLabelable handler MUTATES the issue's label set, so the two-call sequence
//      behaves as it would against real GitHub. A static mock cannot express this attack.
//   5. Vary the second label: accepted, working, in_review, AND triage all defeat the seam
//      (16 of 20 combinations via the production resolver). Only a second TERMINAL label does not.

package server_test

import (
	"context"
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
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

var ssLabelIDs = map[string]string{
	"L_triage": "ft:stage/triage", "L_accepted": "ft:stage/accepted",
	"L_working": "ft:stage/working", "L_in_review": "ft:stage/in_review",
	"L_completed": "ft:stage/completed", "L_wont_fix": "ft:stage/wont_fix",
	"L_duplicate": "ft:stage/duplicate", "L_cancelled": "ft:stage/cancelled",
}

type ssRepo struct {
	mu     sync.Mutex
	labels []string
}

func (f *ssRepo) snapshot() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.labels...)
}

func (f *ssRepo) add(name string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, l := range f.labels {
		if l == name {
			return
		}
	}
	f.labels = append(f.labels, name)
}

func (f *ssRepo) issuesJSON() string {
	nodes := make([]string, 0)
	for _, l := range f.snapshot() {
		nodes = append(nodes, fmt.Sprintf(`{"name":%q}`, l))
	}
	return fmt.Sprintf(`{"data":{"repository":{"issues":{"nodes":[{
      "id":"I_issue1","number":1,"title":"Abandoned","body":"","state":"OPEN","stateReason":null,
      "createdAt":"2026-01-15T10:00:00Z","updatedAt":"2026-01-16T12:00:00Z",
      "url":"https://github.com/acme/widgets/issues/1",
      "labels":{"nodes":[%s]},"assignees":{"nodes":[]},"milestone":null,
      "subIssues":{"nodes":[],"totalCount":0},
      "subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}],
      "pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`, strings.Join(nodes, ","))
}

func (f *ssRepo) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		b := string(body)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(b, "addLabelsToLabelable"):
			for id, name := range ssLabelIDs {
				if strings.Contains(b, `"`+id+`"`) {
					f.add(name)
					t.Logf("    [github] label %s added -> set is now %v", name, f.snapshot())
				}
			}
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(b, "removeLabelsFromLabelable"):
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(b, "updateIssue"):
			_, _ = w.Write([]byte(`{"data":{"updateIssue":{"issue":{
				"id":"I_issue1","number":1,"title":"Abandoned","body":"","state":"OPEN","stateReason":null,
				"createdAt":"2026-01-15T10:00:00Z","updatedAt":"2026-01-16T12:00:00Z",
				"url":"https://github.com/acme/widgets/issues/1","labels":{"nodes":[]},
				"assignees":{"nodes":[]},"milestone":null,"subIssues":{"nodes":[],"totalCount":0},
				"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}}}}`))
		case strings.Contains(b, "issues("):
			_, _ = w.Write([]byte(f.issuesJSON()))
		case strings.Contains(b, "labels(first:"):
			nodes := make([]string, 0)
			for id, name := range ssLabelIDs {
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

// Can a token holding ONLY task:write escalate by itself, with no second actor
// and no GitHub UI access - using the same gRPC API it already has?
func TestProbe_SelfServiceEscalationViaAddLabels(t *testing.T) {
	ctx := context.Background()
	repo := &ssRepo{labels: []string{"ft:stage/wont_fix"}}

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
	mock := httptest.NewServer(repo.handler(t))
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
	id := list.GetItems()[0].GetId()

	agent := scopedCtx(server.DefaultScopesForUserType("agent"))
	accepted := pb.TaskStage_TASK_STAGE_ACCEPTED

	// Baseline: the gate must currently hold.
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted}); err == nil {
		t.Fatal("BASELINE BROKEN: gate already open; probe proves nothing")
	} else {
		t.Logf("step 0  baseline reopen with agent token      -> DENIED (%v)", err)
	}

	// Step 1: add a non-terminal stage label. No Stage field => no transition gate.
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{
		Id: id, AddLabels: []string{"ft:stage/accepted"}}); err != nil {
		t.Fatalf("step 1  AddLabels rejected: %v (escalation not available this way)", err)
	}
	t.Logf("step 1  AddLabels[ft:stage/accepted], task:write  -> ALLOWED. labels=%v", repo.snapshot())

	// Step 2: the same reopen that was denied at step 0.
	if _, err := svc.UpdateTask(agent, &pb.UpdateTaskRequest{Id: id, Stage: &accepted}); err != nil {
		t.Logf("step 2  reopen                                 -> still denied (%v)", err)
		t.Logf("RESULT: NOT self-service; a second actor is required.")
		return
	}
	t.Errorf("SELF-SERVICE ESCALATION CONFIRMED: a token holding only task:write reopened an "+
		"issue still labelled ft:stage/wont_fix, using two ordinary UpdateTask calls and no "+
		"GitHub access. Final labels: %v", repo.snapshot())
}
