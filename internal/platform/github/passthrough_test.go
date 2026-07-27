package github

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
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

func TestComputeBlocked_DoesNotTreatAcceptedAsBlocked(t *testing.T) {
	nodes := map[int]*issueTreeNode{
		1: {Number: 1, Title: "accepted", State: "OPEN", Stage: task.StageAccepted},
		2: {Number: 2, Title: "parent", State: "OPEN", Stage: task.StageAccepted, Children: []*issueTreeNode{
			{Number: 3, Title: "accepted child", State: "CLOSED", Stage: task.StageAccepted},
		}},
	}

	got := computeBlocked(nodes)
	if len(got) != 0 {
		t.Fatalf("computeBlocked returned %d entries for plain accepted issues: %#v", len(got), got)
	}
}

func TestComputeBlocked_ExternalUnavailableLabelAndOpenChildren(t *testing.T) {
	child := &issueTreeNode{Number: 2, Title: "child", State: "OPEN", Stage: task.StageAccepted}
	nodes := map[int]*issueTreeNode{
		1: {Number: 1, Title: "label blocked", State: "OPEN", Stage: task.StageAccepted, Labels: []string{"blocked"}},
		3: {Number: 3, Title: "parent", State: "OPEN", Stage: task.StageAccepted, Children: []*issueTreeNode{child}},
	}

	got := computeBlocked(nodes)
	if len(got) != 2 {
		t.Fatalf("computeBlocked returned %d entries, want 2", len(got))
	}
}

func TestIssueUnavailableForClaim(t *testing.T) {
	openChild := subIssueNode{}
	openChild.State = githubv4.String("OPEN")
	withOpenChild := &issueNode{}
	withOpenChild.SubIssues.Nodes = []subIssueNode{openChild}

	closedAt := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name  string
		issue *issueNode
		task  *ent.Task
		want  bool
	}{
		{"accepted", &issueNode{}, &ent.Task{Stage: task.StageAccepted}, false},
		{"triage", &issueNode{}, &ent.Task{Stage: task.StageTriage}, true},
		{"legacy blocked label", &issueNode{}, &ent.Task{Stage: task.StageAccepted, Labels: []string{"blocked"}}, true},
		{"legacy deferred label", &issueNode{}, &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:stage/deferred"}}, true},
		{"open child", withOpenChild, &ent.Task{Stage: task.StageAccepted}, true},

		// review-194 H1. Unreachable through ClaimTask today — see
		// TestPassThroughClaimTask_ClosedIssueIsNotClaimable for why the arm is
		// here anyway, and for the end-to-end half of this case.
		{"closed", &issueNode{}, &ent.Task{Stage: task.StageAccepted, ClosedAt: &closedAt}, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := issueUnavailableForClaim(tc.issue, tc.task); got != tc.want {
				t.Fatalf("issueUnavailableForClaim = %v, want %v", got, tc.want)
			}
		})
	}
}
