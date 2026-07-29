package server_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	ghplatform "github.com/farmtable-io/farmtable/internal/platform/github"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	githubv4 "github.com/shurcooL/githubv4"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// cannedIssuesResponse returns a JSON response that the shurcooL/githubv4
// client will accept when listing issues via the repository(owner:,name:)
// query. It contains two sample issues.
const cannedIssuesResponse = `{
  "data": {
    "repository": {
      "issues": {
        "nodes": [
          {
            "id": "I_issue1",
            "number": 1,
            "title": "Fix login bug",
            "body": "Login is broken on mobile",
            "state": "OPEN",
            "stateReason": null,
            "createdAt": "2026-01-15T10:00:00Z",
            "updatedAt": "2026-01-16T12:00:00Z",
            "url": "https://github.com/acme/widgets/issues/1",
            "labels": {"nodes": [{"name": "bug"}]},
            "assignees": {"nodes": [{"login": "alice"}]},
            "milestone": null,
            "subIssues": {"nodes": [], "totalCount": 0},
            "subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
            "parent": null
          },
          {
            "id": "I_issue2",
            "number": 2,
            "title": "Add dark mode",
            "body": "Users want dark mode support",
            "state": "OPEN",
            "stateReason": null,
            "createdAt": "2026-01-17T08:00:00Z",
            "updatedAt": "2026-01-18T09:00:00Z",
            "url": "https://github.com/acme/widgets/issues/2",
            "labels": {"nodes": [{"name": "enhancement"}]},
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
}`

// mockGitHubGraphQL creates an httptest server that handles the GitHub
// GraphQL queries used by the passthrough store.
func mockGitHubGraphQL(t *testing.T) *httptest.Server {
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
		case strings.Contains(bodyStr, "repository(owner:") && strings.Contains(bodyStr, "issues("):
			_, _ = w.Write([]byte(cannedIssuesResponse))
		case strings.Contains(bodyStr, "repository(owner:"):
			// Repo ID query
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"R_repo1"}}}`))
		default:
			t.Logf("unhandled GraphQL query: %s", bodyStr)
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}))
}

// newPassThroughStoreWithMock creates a GitHubPassThroughStore backed by a
// mock HTTP server. It constructs the store using the test graphql client
// pattern from the github package tests.
func newPassThroughStoreWithMock(t *testing.T, mockServer *httptest.Server, owner, repo string, collectionID uuid.UUID) store.Store {
	t.Helper()
	httpClient := mockServer.Client()
	gqlClient := githubv4.NewEnterpriseClient(mockServer.URL, httpClient)

	cfg := ghplatform.DefaultConfig()
	s := ghplatform.NewPassThroughStore("mock-token", owner, repo, cfg, &collectionID)

	// Inject the mock GraphQL client via the exported test helper.
	ghplatform.SetTestGraphQLClient(s, gqlClient)

	return s
}

// TestPassthroughE2E exercises the full external store passthrough flow:
//
//  1. Create a GitHub-platform collection in the primary store
//  2. Create a linked account with a mock token
//  3. Wire up a MultiStore with a PlatformResolver
//  4. ListTasks via gRPC → verifies lazy registration and passthrough
//  5. Verify task fields (platform, remote_id)
//  6. Verify WatchTasks returns Unimplemented for external collections
func TestPassthroughE2E(t *testing.T) {
	ctx := context.Background()

	// 1. Set up the primary EntStore (SQLite in-memory).
	entStore, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	// 2. Create a GitHub-platform collection in the primary store.
	ghPlatform := pb.Platform_PLATFORM_GITHUB
	remoteID := "acme/widgets"

	ms := store.NewMultiStore(entStore)
	defer ms.Close()

	// Use MultiStore for collection creation so data is in the primary store.
	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name:        "acme/widgets",
		Description: "GitHub Issues for acme/widgets",
		Platform:    string(collection.PlatformGithub),
		RemoteID:    remoteID,
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	collID := coll.ID

	// 3. Create a linked account so lazy resolution can find a token.
	_, err = ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
		CollectionID: collID,
		Platform:     "github",
		AuthToken:    "ghp_mock_test_token",
		AuthMethod:   "pat",
		Scopes:       []string{"repo"},
	})
	if err != nil {
		t.Fatalf("CreateLinkedAccount: %v", err)
	}

	// 4. Start mock GitHub GraphQL server.
	mockGH := mockGitHubGraphQL(t)
	defer mockGH.Close()

	// 5. Configure PlatformResolver to create passthrough stores using the mock.
	ms.SetResolver(func(platform collection.Platform, token string, rid string, cid uuid.UUID) (store.Store, error) {
		if platform != collection.PlatformGithub {
			return nil, nil // unsupported
		}
		owner, repo, ok := store.ParseOwnerRepo(rid)
		if !ok {
			return nil, nil
		}
		return newPassThroughStoreWithMock(t, mockGH, owner, repo, cid), nil
	})

	// 6. Create gRPC test server with the MultiStore.
	client, grpcCleanup := testutil.NewTestServerWithMultiStore(t, ms)
	defer grpcCleanup()

	// ── Test: ListTasks triggers lazy registration and returns GitHub issues ──
	t.Run("ListTasks_returns_github_issues", func(t *testing.T) {
		collIDStr := collID.String()
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
			CollectionId: &collIDStr,
		})
		if err != nil {
			t.Fatalf("ListTasks: %v", err)
		}
		if len(resp.GetItems()) != 2 {
			t.Fatalf("got %d tasks, want 2", len(resp.GetItems()))
		}

		// Verify each task's fields.
		for _, task := range resp.GetItems() {
			if task.GetPlatform() != ghPlatform {
				t.Errorf("task %q platform = %v, want GITHUB", task.GetName(), task.GetPlatform())
			}
			if task.GetRemoteId() == "" {
				t.Errorf("task %q has empty remote_id", task.GetName())
			}
			if !strings.Contains(task.GetRemoteId(), "acme/widgets#") {
				t.Errorf("task %q remote_id = %q, want to contain 'acme/widgets#'", task.GetName(), task.GetRemoteId())
			}
			if task.GetRemoteUrl() == "" {
				t.Errorf("task %q has empty remote_url", task.GetName())
			}
			if task.GetCollectionId() != collIDStr {
				t.Errorf("task %q collection_id = %q, want %q", task.GetName(), task.GetCollectionId(), collIDStr)
			}
		}

		// Verify specific tasks.
		taskNames := make(map[string]*pb.Task)
		for _, task := range resp.GetItems() {
			taskNames[task.GetName()] = task
		}
		if _, ok := taskNames["Fix login bug"]; !ok {
			t.Error("missing task 'Fix login bug'")
		}
		if _, ok := taskNames["Add dark mode"]; !ok {
			t.Error("missing task 'Add dark mode'")
		}

		// Verify labels are present.
		if loginTask, ok := taskNames["Fix login bug"]; ok {
			found := false
			for _, l := range loginTask.GetLabels() {
				if l == "bug" {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("task 'Fix login bug' labels = %v, want to contain 'bug'", loginTask.GetLabels())
			}
		}
	})

	// ── Test: GetCollection returns correct platform ──
	t.Run("GetCollection_returns_github_platform", func(t *testing.T) {
		collIDStr := collID.String()
		resp, err := client.GetCollection(ctx, &pb.GetCollectionRequest{Id: collIDStr})
		if err != nil {
			t.Fatalf("GetCollection: %v", err)
		}
		if resp.GetPlatform() != pb.Platform_PLATFORM_GITHUB {
			t.Errorf("collection platform = %v, want GITHUB", resp.GetPlatform())
		}
		if resp.GetRemoteId() != "acme/widgets" {
			t.Errorf("collection remote_id = %q, want %q", resp.GetRemoteId(), "acme/widgets")
		}
	})

	// ── Test: LinkedAccount is correctly stored ──
	t.Run("LinkedAccount_retrievable", func(t *testing.T) {
		collIDStr := collID.String()
		resp, err := client.ListLinkedAccounts(ctx, &pb.ListLinkedAccountsRequest{
			CollectionId: &collIDStr,
		})
		if err != nil {
			t.Fatalf("ListLinkedAccounts: %v", err)
		}
		if len(resp.GetItems()) == 0 {
			t.Fatal("expected at least one linked account")
		}
		la := resp.GetItems()[0]
		if la.GetPlatform() != pb.Platform_PLATFORM_GITHUB {
			t.Errorf("linked account platform = %v, want GITHUB", la.GetPlatform())
		}
		if la.GetCollectionId() != collIDStr {
			t.Errorf("linked account collection_id = %q, want %q", la.GetCollectionId(), collIDStr)
		}
	})

	// ── Test: WatchTasks returns Unimplemented for external collection ──
	t.Run("WatchTasks_returns_unimplemented", func(t *testing.T) {
		collIDStr := collID.String()
		stream, err := client.WatchTasks(ctx, &pb.WatchTasksRequest{
			CollectionId: &collIDStr,
		})
		if err != nil {
			t.Fatalf("WatchTasks: %v", err)
		}

		_, err = stream.Recv()
		if err == nil {
			t.Fatal("expected Unimplemented error for GitHub collection WatchTasks")
		}
		st, ok := status.FromError(err)
		if !ok {
			t.Fatalf("expected gRPC status error, got %v", err)
		}
		if st.Code() != codes.Unimplemented {
			t.Errorf("WatchTasks code = %v, want Unimplemented", st.Code())
		}
	})

	// ── Test: Subsequent ListTasks uses cached store (no re-resolution) ──
	t.Run("ListTasks_cached_store", func(t *testing.T) {
		collIDStr := collID.String()
		// Call ListTasks a second time — should use the cached platform store.
		resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
			CollectionId: &collIDStr,
		})
		if err != nil {
			t.Fatalf("ListTasks (cached): %v", err)
		}
		if len(resp.GetItems()) != 2 {
			t.Fatalf("got %d tasks on second call, want 2", len(resp.GetItems()))
		}
	})
}

// TestPassthroughE2E_NativeCollectionUnaffected verifies that native farmtable
// collections still work normally when MultiStore has a PlatformResolver set.
func TestPassthroughE2E_NativeCollectionUnaffected(t *testing.T) {
	ctx := context.Background()

	entStore, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ms := store.NewMultiStore(entStore)
	defer ms.Close()

	// Set a resolver (even though it won't be used for farmtable collections).
	ms.SetResolver(func(platform collection.Platform, token string, rid string, cid uuid.UUID) (store.Store, error) {
		return nil, nil
	})

	client, grpcCleanup := testutil.NewTestServerWithMultiStore(t, ms)
	defer grpcCleanup()

	// Create a native farmtable collection.
	coll, err := client.CreateCollection(ctx, &pb.CreateCollectionRequest{
		Name: "native-collection",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	collID := coll.GetId()

	// Create a task in the native collection.
	created, err := client.CreateTask(ctx, &pb.CreateTaskRequest{
		CollectionId: collID,
		Name:         "native-task",
		Description:  strPtr("A regular farmtable task"),
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if created.GetPlatform() != pb.Platform_PLATFORM_FARMTABLE {
		t.Errorf("native task platform = %v, want FARMTABLE", created.GetPlatform())
	}

	// ListTasks on native collection works.
	resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collID,
	})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}
	if len(resp.GetItems()) != 1 {
		t.Fatalf("got %d tasks, want 1", len(resp.GetItems()))
	}
	if resp.GetItems()[0].GetName() != "native-task" {
		t.Errorf("task name = %q, want %q", resp.GetItems()[0].GetName(), "native-task")
	}
}

// TestPassthroughE2E_LazyResolutionWithoutLinkedAccount verifies that ListTasks
// falls back to the primary store when no linked account exists for a GitHub
// collection (lazy resolution returns nil).
func TestPassthroughE2E_LazyResolutionWithoutLinkedAccount(t *testing.T) {
	ctx := context.Background()

	entStore, storeCleanup := testutil.NewTestStore(t)
	defer storeCleanup()

	ms := store.NewMultiStore(entStore)
	defer ms.Close()

	resolverCalled := false
	ms.SetResolver(func(platform collection.Platform, token string, rid string, cid uuid.UUID) (store.Store, error) {
		resolverCalled = true
		return nil, nil
	})

	// Create a GitHub collection but NO linked account.
	coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
		Name:     "no-token-repo",
		Platform: "github",
		RemoteID: "acme/empty",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	client, grpcCleanup := testutil.NewTestServerWithMultiStore(t, ms)
	defer grpcCleanup()

	collIDStr := coll.ID.String()
	resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{
		CollectionId: &collIDStr,
	})
	if err != nil {
		t.Fatalf("ListTasks: %v", err)
	}

	// Without a linked account, lazy resolution cannot construct a passthrough
	// store; the primary store is used and returns no tasks.
	if len(resp.GetItems()) != 0 {
		t.Errorf("got %d tasks, want 0 (no linked account → primary store)", len(resp.GetItems()))
	}

	// The resolver should NOT have been called because there are no linked accounts.
	if resolverCalled {
		t.Error("resolver was called despite no linked account existing")
	}
}

// helper to avoid unused import of time in this file
var _ = time.Second
