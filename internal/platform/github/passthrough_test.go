package github

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	githubv4 "github.com/shurcooL/githubv4"
)

func TestPassThroughStore_CheckSubIssueLimits_CountExceeded(t *testing.T) {
	s := &GitHubPassThroughStore{}
	parent := &issueNode{}
	parent.Number = 1
	parent.SubIssues.TotalCount = MaxSubIssuesPerParent

	err := s.checkSubIssueLimits(context.Background(), parent)
	if err == nil {
		t.Fatal("checkSubIssueLimits returned nil, want count limit error")
	}
	if !strings.Contains(err.Error(), "sub-issue count limit (100) exceeded") {
		t.Fatalf("error = %q, want count limit message", err)
	}
}

func TestPassThroughStore_IssueDepth(t *testing.T) {
	s := &GitHubPassThroughStore{}
	issues := make([]issueNode, MaxSubIssueDepth)
	for i := range issues {
		issues[i].Number = githubv4.Int(i + 1)
		if i > 0 {
			issues[i].Parent = &parentIssueNode{Number: githubv4.Int(i)}
		}
	}

	if got := s.issueDepth(&issues[MaxSubIssueDepth-1], issues); got != MaxSubIssueDepth {
		t.Fatalf("issueDepth = %d, want %d", got, MaxSubIssueDepth)
	}
}

func TestPassThroughStore_CreateTaskWithParentAddsSubIssue(t *testing.T) {
	var addSubIssueSeen bool

	client := testGraphQLClient(t, func(w http.ResponseWriter, r *http.Request) {
		body := mustReadBody(t, r.Body)
		w.Header().Set("Content-Type", "application/json")

		switch {
		case strings.Contains(body, "repository(owner:"):
			if strings.Contains(body, "issues(") {
				_, _ = w.Write([]byte(`{"data":{"repository":{"issues":{"nodes":[{"id":"PARENT","number":1,"title":"Parent","body":"","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/1","labels":{"nodes":[]},"assignees":{"nodes":[]},"subIssues":{"nodes":[],"totalCount":0},"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
				return
			}
			if strings.Contains(body, "labels(") {
				_, _ = w.Write([]byte(`{"data":{"repository":{"labels":{"nodes":[],"pageInfo":{"hasNextPage":false,"endCursor":""}}}}}`))
				return
			}
			_, _ = w.Write([]byte(`{"data":{"repository":{"id":"REPO"}}}`))
		case strings.Contains(body, "createIssue"):
			_, _ = w.Write([]byte(`{"data":{"createIssue":{"issue":{"id":"CHILD","number":2,"title":"Child","body":"Body","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/2","labels":{"nodes":[]},"assignees":{"nodes":[]},"subIssues":{"nodes":[],"totalCount":0},"subIssuesSummary":{"total":0,"completed":0,"percentCompleted":0},"parent":null}}}}`))
		case strings.Contains(body, "addSubIssue"):
			addSubIssueSeen = true
			if !strings.Contains(body, `"issueId":"PARENT"`) || !strings.Contains(body, `"subIssueId":"CHILD"`) {
				t.Fatalf("addSubIssue body missing IDs: %s", body)
			}
			_, _ = w.Write([]byte(`{"data":{"addSubIssue":{"issue":{"id":"PARENT","number":1,"title":"Parent","body":"","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/1"},"subIssue":{"id":"CHILD","number":2,"title":"Child","body":"Body","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/2"}}}}`))
		default:
			t.Fatalf("unexpected GraphQL request: %s", body)
		}
	})

	s := &GitHubPassThroughStore{
		gql:          client,
		mapper:       NewLabelMapper(DefaultConfig().GitHub.Labels),
		owner:        "acme",
		repo:         "repo",
		collectionID: uuid.New(),
	}
	parentUUID := s.issueUUID(1)

	created, err := s.CreateTask(context.Background(), store.CreateTaskParams{
		Title:        "Child",
		Description:  "Body",
		Stage:        task.StageTriage,
		ParentTaskID: &parentUUID,
	})
	if err != nil {
		t.Fatalf("CreateTask returned error: %v", err)
	}
	if !addSubIssueSeen {
		t.Fatal("CreateTask did not call addSubIssue")
	}
	if created.ParentTaskID == nil || *created.ParentTaskID != parentUUID {
		t.Fatalf("created ParentTaskID = %v, want %v", created.ParentTaskID, parentUUID)
	}
}
