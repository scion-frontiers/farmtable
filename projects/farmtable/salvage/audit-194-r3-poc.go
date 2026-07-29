package server_test

// AUDIT SCRATCH FILE — audit-194-r3. Not for commit. Deleted after the run.
//
// Proof of concept: the round-3 LifecycleStage seam is defeated by adding a
// second, NON-TERMINAL stage label alongside the terminal one, because
// TerminalLabelStage is built on MapLabelsToStage, which returns only the
// single highest-precedence stage, and stagePrecedence ranks every
// non-terminal stage ABOVE every terminal one.

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// multiLabelIssuesResponse serves one OPEN issue carrying an arbitrary label set.
func multiLabelIssuesResponse(labels []string) string {
	nodes := make([]string, 0, len(labels))
	for _, l := range labels {
		nodes = append(nodes, fmt.Sprintf(`{"name":%q}`, l))
	}
	return fmt.Sprintf(`{
  "data": {"repository": {"issues": {
    "nodes": [{
      "id": "I_issue1", "number": 1, "title": "Abandoned work",
      "body": "A maintainer declined this", "state": "OPEN", "stateReason": null,
      "createdAt": "2026-01-15T10:00:00Z", "updatedAt": "2026-01-16T12:00:00Z",
      "url": "https://github.com/acme/widgets/issues/1",
      "labels": {"nodes": [%s]},
      "assignees": {"nodes": []}, "milestone": null,
      "subIssues": {"nodes": [], "totalCount": 0},
      "subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
      "parent": null
    }],
    "pageInfo": {"hasNextPage": false, "endCursor": ""}
  }}}
}`, strings.Join(nodes, ","))
}

func mockGHMultiLabel(t *testing.T, labels []string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		bodyStr := string(body)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(bodyStr, "updateIssue"):
			_, _ = w.Write([]byte(`{"data":{"updateIssue":{"issue":{
				"id":"I_issue1","number":1,"title":"Abandoned work","body":"",
				"state":"OPEN","stateReason":null,
				"createdAt":"2026-01-15T10:00:00Z","updatedAt":"2026-01-16T12:00:00Z",
				"url":"https://github.com/acme/widgets/issues/1",
				"labels":{"nodes":[]},"assignees":{"nodes":[]},"milestone":null,
				"subIssues":{"nodes":[],"totalCount":0},
				"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},
				"parent":null}}}}`))
		case strings.Contains(bodyStr, "addLabelsToLabelable"):
			_, _ = w.Write([]byte(`{"data":{"addLabelsToLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(bodyStr, "removeLabelsFromLabelable"):
			_, _ = w.Write([]byte(`{"data":{"removeLabelsFromLabelable":{"clientMutationId":null}}}`))
		case strings.Contains(bodyStr, "issues("):
			_, _ = w.Write([]byte(multiLabelIssuesResponse(labels)))
		case strings.Contains(bodyStr, "labels(first:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"labels":{"nodes":[
				{"id":"L_triage","name":"ft:stage/triage"},
				{"id":"L_accepted","name":"ft:stage/accepted"},
				{"id":"L_working","name":"ft:stage/working"},
				{"id":"L_in_review","name":"ft:stage/in_review"},
				{"id":"L_in_qa","name":"ft:stage/in_qa"},
				{"id":"L_deploying","name":"ft:stage/deploying"},
				{"id":"L_completed","name":"ft:stage/completed"},
				{"id":"L_wont_fix","name":"ft:stage/wont_fix"},
				{"id":"L_duplicate","name":"ft:stage/duplicate"},
				{"id":"L_cancelled","name":"ft:stage/cancelled"}
			],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
		case strings.Contains(bodyStr, "repository(owner:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"R_repo1"}}}`))
		default:
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}))
}

// newMultiLabelService is newTerminalLabelledService with an arbitrary label set.
// Same graph: EntStore -> MultiStore -> real *GitHubPassThroughStore -> service.
func newMultiLabelService(t *testing.T, labels []string) (*server.FarmTableService, *store.MultiStore, string, uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	entStore, storeCleanup := testutil.NewTestStore(t)
	t.Cleanup(storeCleanup)

	ms := store.NewMultiStore(entStore)
	t.Cleanup(func() { _ = ms.Close() })

	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name: "acme/widgets", Platform: string(collection.PlatformGithub), RemoteID: "acme/widgets",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	if _, err := ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: coll.ID, Platform: "github", AuthToken: "ghp_mock_test_token",
		AuthMethod: "pat", Scopes: []string{"repo"},
	}); err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	mockGH := mockGHMultiLabel(t, labels)
	t.Cleanup(mockGH.Close)

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
	return svc, ms, list.GetItems()[0].GetId(), coll.ID
}

// PoC 1 — AUTHORIZATION BYPASS.
// Baseline (single terminal label) must DENY. Attack (terminal + a
// non-terminal stage label) must also deny; if it ALLOWS, the gate is bypassed.
func TestAUDIT_PoC1_SecondLabelDefeatsAcceptGate(t *testing.T) {
	for _, mask := range []string{"ft:stage/accepted", "ft:stage/triage", "ft:stage/working", "ft:stage/in_review"} {
		for _, terminal := range []string{"ft:stage/wont_fix", "ft:stage/duplicate", "ft:stage/cancelled", "ft:stage/completed"} {
			t.Run(terminal+"+"+mask, func(t *testing.T) {
				// Baseline: single terminal label -> must be denied.
				svcB, _, idB, _ := newMultiLabelService(t, []string{terminal})
				dest := pb.TaskStage_TASK_STAGE_ACCEPTED
				_, errB := svcB.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{Id: idB, Stage: &dest})
				if errB == nil {
					t.Fatalf("BASELINE BROKEN: single %s already allowed; harness is not exercising the gate", terminal)
				}
				t.Logf("baseline  [%s]            -> DENIED (%v)", terminal, errB)

				// Attack: same issue, plus one non-terminal stage label.
				svcA, _, idA, _ := newMultiLabelService(t, []string{terminal, mask})
				dest2 := pb.TaskStage_TASK_STAGE_ACCEPTED
				_, errA := svcA.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{Id: idA, Stage: &dest2})
				if errA == nil {
					t.Fatalf("BYPASS: agent token (task:write, NO task:accept) reopened an OPEN issue "+
						"labelled [%s %s] to accepted. The terminal label is still on the issue; adding "+
						"%q defeated the round-3 accept gate.", terminal, mask, mask)
				}
				t.Logf("attack    [%s %s] -> denied (%v)", terminal, mask, errA)
			})
		}
	}
}

// PoC 2 — SCHEDULING BYPASS.
// A wont_fix issue must never be reported available. Adding a second label
// must not change that.
func TestAUDIT_PoC2_SecondLabelRestoresAvailability(t *testing.T) {
	ctx := context.Background()

	_, msB, _, collB := newMultiLabelService(t, []string{"ft:stage/wont_fix"})
	tasksB, _, err := msB.ListTasks(ctx, store.ListTasksParams{CollectionID: &collB})
	if err != nil {
		t.Fatalf("ListTasks baseline: %v", err)
	}
	if len(tasksB) != 1 {
		t.Fatalf("baseline: got %d tasks, want 1", len(tasksB))
	}
	availB, err := msB.ComputeAvailability(ctx, tasksB[0])
	if err != nil {
		t.Fatalf("ComputeAvailability baseline: %v", err)
	}
	if availB.Available {
		t.Fatalf("BASELINE BROKEN: single wont_fix label already available")
	}
	t.Logf("baseline  [ft:stage/wont_fix]                    -> Available=%v Reasons=%v stage=%s",
		availB.Available, availB.Reasons, tasksB[0].Stage)

	_, msA, _, collA := newMultiLabelService(t, []string{"ft:stage/wont_fix", "ft:stage/accepted"})
	tasksA, _, err := msA.ListTasks(ctx, store.ListTasksParams{CollectionID: &collA})
	if err != nil {
		t.Fatalf("ListTasks attack: %v", err)
	}
	if len(tasksA) != 1 {
		t.Fatalf("attack: got %d tasks, want 1", len(tasksA))
	}
	availA, err := msA.ComputeAvailability(ctx, tasksA[0])
	if err != nil {
		t.Fatalf("ComputeAvailability attack: %v", err)
	}
	t.Logf("attack    [ft:stage/wont_fix ft:stage/accepted]  -> Available=%v Reasons=%v stage=%s",
		availA.Available, availA.Reasons, tasksA[0].Stage)
	if availA.Available {
		t.Fatalf("SCHEDULING BYPASS: an OPEN issue still carrying ft:stage/wont_fix is reported "+
			"AVAILABLE (ready work) once ft:stage/accepted is also applied. Labels present: %v",
			tasksA[0].Labels)
	}
}

// PoC 3 — STOCK LABEL SWEEP. Which bare GitHub-stock label names collide with
// a Farm Table stage after prefix stripping? Fails closed: the sweep must
// observe at least one known-true control.
func TestAUDIT_PoC3_StockLabelSweep(t *testing.T) {
	stock := []string{
		"bug", "documentation", "duplicate", "enhancement", "good first issue",
		"help wanted", "invalid", "question", "wontfix",
		// near-miss probes
		"wont fix", "wont-fix", "wont_fix", "completed", "cancelled", "canceled",
		"accepted", "triage", "working", "in review", "in_review",
	}
	sawKnownTrue := false
	collisions := []string{}
	for _, name := range stock {
		_, ms, _, coll := newMultiLabelService(t, []string{name})
		tasks, _, err := ms.ListTasks(context.Background(), store.ListTasksParams{CollectionID: &coll})
		if err != nil || len(tasks) != 1 {
			t.Fatalf("sweep %q: ListTasks err=%v n=%d", name, err, len(tasks))
		}
		avail, err := ms.ComputeAvailability(context.Background(), tasks[0])
		if err != nil {
			t.Fatalf("sweep %q: ComputeAvailability: %v", name, err)
		}
		lifecycle := store.LifecycleStage(context.Background(), ms, tasks[0])
		verdict := "no-match"
		if string(lifecycle) != string(tasks[0].Stage) {
			verdict = "TERMINAL-COLLISION"
			collisions = append(collisions, name)
		} else if !avail.Available {
			verdict = "unavailable"
		}
		if name == "duplicate" && verdict == "TERMINAL-COLLISION" {
			sawKnownTrue = true
		}
		t.Logf("%-18q display=%-10s lifecycle=%-10s available=%-5v  %s",
			name, tasks[0].Stage, lifecycle, avail.Available, verdict)
	}
	t.Logf("COLLIDING STOCK/BARE LABELS: %v", collisions)
	if !sawKnownTrue {
		t.Fatalf("SWEEP DID NOT FAIL CLOSED: the known-true control \"duplicate\" did not register "+
			"as a collision; the sweep is not measuring what it claims. collisions=%v", collisions)
	}
}
