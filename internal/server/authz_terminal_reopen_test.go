package server_test

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
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ── #194 item 1: the authorization gate must not read a label-derived value ──
//
// audit-194 F2 stopped a terminal stage label outranking an OPEN GitHub issue
// by demoting (open, terminal-label) to (open, accepted) in IssueToPhaseStage.
// That demotion is a DISPLAY decision, but FarmTableService.UpdateTask feeds
// the very same field into the RBAC transition table:
//
//	server.go: TransitionScope(string(existing.Stage), string(st))
//
// transitions.go requires task:accept for any move out of a terminal stage
// ("reopening a closed task is a re-accept"). Rewriting the SOURCE stage from
// terminal to accepted stops that rule matching, and the transition falls
// through to the default task:write — so a token holding task:write but
// deliberately NOT task:accept could move a wont_fix / duplicate / cancelled
// issue back into the active pipeline.
//
// These tests are the sink-binding that was missing in round 2: before this
// round, reverting F2 produced failures only in internal/platform/github and
// ZERO in internal/server, one layer up from where the damage was.
//
// They drive a real GitHubPassThroughStore behind a real MultiStore behind the
// real FarmTableService. Nothing here re-implements the transition table; the
// oracle is the scope error the production gate actually returns.

// terminalLabelledIssuesResponse serves a single OPEN issue carrying the given
// stage label. OPEN + terminal label is exactly the state a GitHub reopen
// leaves behind: state and closedAt are cleared, labels are not.
func terminalLabelledIssuesResponse(label string) string {
	return fmt.Sprintf(`{
  "data": {
    "repository": {
      "issues": {
        "nodes": [
          {
            "id": "I_issue1",
            "number": 1,
            "title": "Abandoned work",
            "body": "A maintainer declined this",
            "state": "OPEN",
            "stateReason": null,
            "createdAt": "2026-01-15T10:00:00Z",
            "updatedAt": "2026-01-16T12:00:00Z",
            "url": "https://github.com/acme/widgets/issues/1",
            "labels": {"nodes": [{"name": %q}]},
            "assignees": {"nodes": []},
            "milestone": null,
            "subIssues": {"nodes": [], "totalCount": 0},
            "subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
            "parent": null
          }
        ],
        "pageInfo": {"hasNextPage": false, "endCursor": ""}
      }
    }
  }
}`, label)
}

// mockGitHubForStageUpdate serves the GraphQL surface an UpdateTask with a
// stage change touches: the issue list, the repo label index, and the update /
// label-swap mutations. The mutations are served so that a caller who passes
// the scope gate proceeds to a clean success — that way a failing assertion
// reports "the gate allowed this" rather than an unrelated transport error.
func mockGitHubForStageUpdate(t *testing.T, label string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("reading request body: %v", err)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
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
			// Checked before the label-index case: the issue query selects a
			// nested labels(first:) of its own, so matching on that substring
			// first would swallow every issue list.
			_, _ = w.Write([]byte(terminalLabelledIssuesResponse(label)))
		case strings.Contains(bodyStr, "labels(first:"):
			// The repo label index. Every stage label must resolve or the
			// swap silently skips writes.
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
			t.Logf("unhandled GraphQL query: %s", bodyStr)
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}))
}

// newTerminalLabelledService wires the production object graph — EntStore →
// MultiStore (+ real GitHub PlatformResolver shape) → FarmTableService — around
// a single OPEN issue carrying the given terminal stage label, and returns the
// service plus that issue's task ID.
func newTerminalLabelledService(t *testing.T, label string) (*server.FarmTableService, string) {
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

	mockGH := mockGitHubForStageUpdate(t, label)
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
	return svc, list.GetItems()[0].GetId()
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

// TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen is the
// blocking sink-binding for #194 item 1. It fails if the authorization gate
// goes back to reading the demoted display stage.
func TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen(t *testing.T) {
	// Every non-terminal destination is a reopen out of a terminal stage.
	for _, dest := range []struct {
		name  string
		stage pb.TaskStage
	}{
		{"triage", pb.TaskStage_TASK_STAGE_TRIAGE},
		{"accepted", pb.TaskStage_TASK_STAGE_ACCEPTED},
		{"in_review", pb.TaskStage_TASK_STAGE_IN_REVIEW},
		{"in_qa", pb.TaskStage_TASK_STAGE_IN_QA},
		{"deploying", pb.TaskStage_TASK_STAGE_DEPLOYING},
	} {
		for _, label := range []string{"ft:stage/wont_fix", "ft:stage/duplicate", "ft:stage/cancelled", "ft:stage/completed"} {
			t.Run(label+"_to_"+dest.name, func(t *testing.T) {
				svc, taskID := newTerminalLabelledService(t, label)
				stage := dest.stage
				_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id:    taskID,
					Stage: &stage,
				})
				if err == nil {
					t.Fatalf("UpdateTask moved an OPEN issue labelled %s to %s with an agent token "+
						"(task:write, no task:accept). Reopening a terminal-labelled issue is a "+
						"re-accept and must require task:accept; the F2 demotion must not reach "+
						"the authorization gate", label, dest.name)
				}
				st, _ := status.FromError(err)
				if st.Code() != codes.PermissionDenied {
					t.Fatalf("UpdateTask %s -> %s: got %v (%s), want PermissionDenied",
						label, dest.name, st.Code(), st.Message())
				}
				if !strings.Contains(st.Message(), server.ScopeTaskAccept) {
					t.Fatalf("UpdateTask %s -> %s: denied for %q, want the denial to name %q",
						label, dest.name, st.Message(), server.ScopeTaskAccept)
				}
			})
		}
	}
}

// TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue is the
// positive control. Without it, a gate that denied everything would satisfy the
// test above.
func TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue(t *testing.T) {
	svc, taskID := newTerminalLabelledService(t, "ft:stage/wont_fix")
	stage := pb.TaskStage_TASK_STAGE_ACCEPTED
	scopes := append(agentScopes(), server.ScopeTaskAccept)

	if _, err := svc.UpdateTask(scopedCtx(scopes), &pb.UpdateTaskRequest{
		Id:    taskID,
		Stage: &stage,
	}); err != nil {
		t.Fatalf("UpdateTask with task:accept was rejected: %v; holding task:accept must be "+
			"sufficient to reopen a terminal-labelled issue", err)
	}
}

// TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite pins the
// OTHER direction of the same regression, which round 2 let through unexamined.
//
// TransitionScope short-circuits to task:write when from == to: re-asserting a
// stage a task already holds is an ordinary write, not a lifecycle transition.
// The F2 demotion broke that no-op detection — it rewrote the source from
// completed to accepted, so "set stage=completed" on an already-completed issue
// stopped looking like a no-op and started looking like a fresh close,
// demanding task:close. That is a denial-of-work regression with no security
// benefit: the issue already carries the label the caller is asking for, so
// there is no privilege being newly exercised.
func TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite(t *testing.T) {
	for _, tc := range []struct {
		label string
		stage pb.TaskStage
	}{
		{"ft:stage/completed", pb.TaskStage_TASK_STAGE_COMPLETED},
		{"ft:stage/wont_fix", pb.TaskStage_TASK_STAGE_WONT_FIX},
		{"ft:stage/duplicate", pb.TaskStage_TASK_STAGE_DUPLICATE},
		{"ft:stage/cancelled", pb.TaskStage_TASK_STAGE_CANCELLED},
	} {
		t.Run(tc.label, func(t *testing.T) {
			svc, taskID := newTerminalLabelledService(t, tc.label)
			stage := tc.stage
			_, err := svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id:    taskID,
				Stage: &stage,
			})
			if err != nil {
				st, _ := status.FromError(err)
				t.Fatalf("re-asserting the stage %s that the issue already carries was rejected "+
					"(%v: %s); from == to is a no-op write and must not require task:close",
					tc.label, st.Code(), st.Message())
			}
		})
	}
}
