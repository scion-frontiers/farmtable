package server_test

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// TestEvidence_Stage4ScopeMatrix walks the task lifecycle against a real gRPC
// server (bufconn, real auth interceptor, real store, real tokens) and records
// the observed status code for every role/operation pair. Run with -v to get a
// readable transcript:
//
//	go test ./internal/server/ -run TestEvidence_Stage4ScopeMatrix -v
func TestEvidence_Stage4ScopeMatrix(t *testing.T) {
	s, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	client, _, cleanup := testutil.NewTestServerWithAuth(t, s)
	defer cleanup()

	_, adminToken := createTestUserAndToken(t, s, "admin", []string{server.ScopeWildcard}, nil)
	adminCtx := authCtx(adminToken)

	coll, err := client.CreateCollection(adminCtx, &pb.CreateCollectionRequest{Name: "evidence"})
	if err != nil {
		t.Fatalf("creating collection: %v", err)
	}
	collID := coll.GetId()

	roles := map[string]context.Context{}
	for _, role := range []string{"agent", "reviewer", "orchestrator"} {
		scopes := server.DefaultScopesForUserType(role)
		_, token := createTestUserAndToken(t, s, role, scopes, nil)
		roles[role] = authCtx(token)
		t.Logf("token role=%-13s scopes=%v", role, scopes)
	}

	// observe runs op and reports the resulting gRPC code against expectations.
	observe := func(t *testing.T, label string, wantCode codes.Code, op func() error) {
		t.Helper()
		err := op()
		got := status.Code(err)
		msg := ""
		if err != nil {
			msg = " msg=" + status.Convert(err).Message()
		}
		t.Logf("%-58s => %s%s", label, got, msg)
		if got != wantCode {
			t.Errorf("%s: code = %s, want %s (err=%v)", label, got, wantCode, err)
		}
	}

	newTriageTask := func(t *testing.T, name string) string {
		t.Helper()
		return createLifecycleTask(t, client, adminCtx, collID, name, nil).GetId()
	}

	t.Run("a_agent_cannot_accept_or_close", func(t *testing.T) {
		agentCtx := roles["agent"]

		id := newTriageTask(t, "evidence-agent-accept")
		observe(t, "agent  UpdateTask triage→ready       (needs task:accept)", codes.PermissionDenied, func() error {
			_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
				Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
			})
			return err
		})
		observe(t, "agent  UpdateTask triage→working     (needs task:accept)", codes.PermissionDenied, func() error {
			_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
				Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_WORKING),
			})
			return err
		})

		workingID := createLifecycleTask(t, client, adminCtx, collID, "evidence-agent-close",
			stageProtoPtr(pb.TaskStage_TASK_STAGE_WORKING)).GetId()
		observe(t, "agent  CloseTask                     (needs task:close)", codes.PermissionDenied, func() error {
			_, err := client.CloseTask(agentCtx, &pb.CloseTaskRequest{Id: workingID})
			return err
		})
		observe(t, "agent  UpdateTask working→completed  (needs task:close)", codes.PermissionDenied, func() error {
			_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
				Id: workingID, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_COMPLETED),
			})
			return err
		})
	})

	t.Run("b_lifecycle_roles_full_authority", func(t *testing.T) {
		for _, role := range []string{"reviewer", "orchestrator"} {
			roleCtx := roles[role]
			id := newTriageTask(t, "evidence-"+role)

			observe(t, role+" UpdateTask triage→ready       (task:accept)", codes.OK, func() error {
				_, err := client.UpdateTask(roleCtx, &pb.UpdateTaskRequest{
					Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
				})
				return err
			})
			observe(t, role+" ClaimTask ready→working       (task:claim)", codes.OK, func() error {
				_, err := client.ClaimTask(roleCtx, &pb.ClaimTaskRequest{Id: id})
				return err
			})
			observe(t, role+" UpdateTask working→in_review  (task:write)", codes.OK, func() error {
				_, err := client.UpdateTask(roleCtx, &pb.UpdateTaskRequest{
					Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_IN_REVIEW),
				})
				return err
			})
			observe(t, role+" CloseTask  in_review→completed (task:close)", codes.OK, func() error {
				_, err := client.CloseTask(roleCtx, &pb.CloseTaskRequest{Id: id})
				return err
			})
			observe(t, role+" UpdateTask completed→backlog  (task:accept)", codes.OK, func() error {
				_, err := client.UpdateTask(roleCtx, &pb.UpdateTaskRequest{
					Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
				})
				return err
			})
		}
	})

	t.Run("c_agent_can_still_claim_accepted_task", func(t *testing.T) {
		agentCtx := roles["agent"]
		id := createLifecycleTask(t, client, adminCtx, collID, "evidence-agent-claim",
			stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED)).GetId()

		observe(t, "agent  ClaimTask ready→working       (task:claim)", codes.OK, func() error {
			_, err := client.ClaimTask(agentCtx, &pb.ClaimTaskRequest{Id: id})
			return err
		})
		observe(t, "agent  UpdateTask working→in_review  (task:write)", codes.OK, func() error {
			_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
				Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_IN_REVIEW),
			})
			return err
		})
		observe(t, "agent  UpdateTask working→blocked    (task:write)", codes.OK, func() error {
			_, err := client.UpdateTask(agentCtx, &pb.UpdateTaskRequest{
				Id: id, Stage: stageProtoPtr(pb.TaskStage_TASK_STAGE_ACCEPTED),
			})
			return err
		})
	})

	t.Run("d_claim_from_triage_rejected_for_every_role", func(t *testing.T) {
		for role, roleCtx := range map[string]context.Context{
			"agent":        roles["agent"],
			"reviewer":     roles["reviewer"],
			"orchestrator": roles["orchestrator"],
			"admin":        adminCtx,
		} {
			id := newTriageTask(t, "evidence-triage-claim-"+role)
			observe(t, role+" ClaimTask from triage         (precondition)", codes.FailedPrecondition, func() error {
				_, err := client.ClaimTask(roleCtx, &pb.ClaimTaskRequest{Id: id})
				return err
			})

			resp, err := client.GetTask(adminCtx, &pb.GetTaskRequest{Id: id})
			if err != nil {
				t.Fatalf("GetTask: %v", err)
			}
			if resp.GetTask().GetStage() != pb.TaskStage_TASK_STAGE_TRIAGE {
				t.Errorf("%s: stage after rejected claim = %v, want TRIAGE", role, resp.GetTask().GetStage())
			}
			if len(resp.GetTask().GetAssignees()) != 0 {
				t.Errorf("%s: task was assigned despite rejected claim", role)
			}
		}
	})
}
