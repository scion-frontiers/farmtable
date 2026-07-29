package github

import (
	"context"
	"testing"
	"time"

	gh "github.com/google/go-github/v62/github"
	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

func TestIssueToCreateParams_OpenIssue(t *testing.T) {
	collectionID := uuid.New()
	issue := &gh.Issue{
		Number:  gh.Int(42),
		Title:   gh.String("Fix the login bug"),
		Body:    gh.String("Users can't log in when using SSO"),
		State:   gh.String("open"),
		HTMLURL: gh.String("https://github.com/acme/repo/issues/42"),
		Labels: []*gh.Label{
			{Name: gh.String("bug")},
			{Name: gh.String("critical")},
		},
		Assignee: &gh.User{
			Login: gh.String("alice"),
		},
		Milestone: &gh.Milestone{
			Title: gh.String("v2.0"),
		},
		CreatedAt: &gh.Timestamp{Time: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)},
	}

	remoteID := "acme/repo#42"
	params := IssueToCreateParams(issue, collectionID, remoteID, "acme", "repo")

	if params.Title != "Fix the login bug" {
		t.Errorf("Title = %q, want %q", params.Title, "Fix the login bug")
	}
	if params.Description != "Users can't log in when using SSO" {
		t.Errorf("Description = %q, want body text", params.Description)
	}
	if params.Phase != task.PhaseOpen {
		t.Errorf("Phase = %v, want PhaseOpen", params.Phase)
	}
	if params.Stage != task.StageTriage {
		t.Errorf("Stage = %v, want StageTriage", params.Stage)
	}
	if params.NativeLabel != "open" {
		t.Errorf("NativeLabel = %q, want %q", params.NativeLabel, "open")
	}
	if params.Type != "issue" {
		t.Errorf("Type = %q, want %q", params.Type, "issue")
	}
	if params.CollectionID != collectionID {
		t.Errorf("CollectionID = %v, want %v", params.CollectionID, collectionID)
	}
	if params.AssigneeID == nil {
		t.Fatal("AssigneeID is nil, want non-nil")
	}
	expectedAssignee := deterministicUUID("alice")
	if *params.AssigneeID != expectedAssignee {
		t.Errorf("AssigneeID = %v, want %v", *params.AssigneeID, expectedAssignee)
	}

	rd := params.RemoteData
	if rd["remote_id"] != "acme/repo#42" {
		t.Errorf("remote_data.remote_id = %v, want %q", rd["remote_id"], "acme/repo#42")
	}
	if rd["html_url"] != "https://github.com/acme/repo/issues/42" {
		t.Errorf("remote_data.html_url = %v, want URL", rd["html_url"])
	}
	if rd["number"] != 42 {
		t.Errorf("remote_data.number = %v, want 42", rd["number"])
	}
	if rd["milestone"] != "v2.0" {
		t.Errorf("remote_data.milestone = %v, want %q", rd["milestone"], "v2.0")
	}
	labels, ok := rd["labels"].([]string)
	if !ok || len(labels) != 2 {
		t.Fatalf("remote_data.labels = %v, want [bug critical]", rd["labels"])
	}
	if labels[0] != "bug" || labels[1] != "critical" {
		t.Errorf("remote_data.labels = %v, want [bug critical]", labels)
	}
}

func TestIssueToCreateParams_ClosedIssue(t *testing.T) {
	issue := &gh.Issue{
		Number:    gh.Int(7),
		Title:     gh.String("Done task"),
		Body:      gh.String(""),
		State:     gh.String("closed"),
		HTMLURL:   gh.String("https://github.com/acme/repo/issues/7"),
		CreatedAt: &gh.Timestamp{Time: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
	}

	params := IssueToCreateParams(issue, uuid.New(), "acme/repo#7", "acme", "repo")

	if params.Phase != task.PhaseClosed {
		t.Errorf("Phase = %v, want PhaseClosed", params.Phase)
	}
	if params.Stage != task.StageCompleted {
		t.Errorf("Stage = %v, want StageCompleted", params.Stage)
	}
	if params.AssigneeID != nil {
		t.Errorf("AssigneeID = %v, want nil", params.AssigneeID)
	}
}

func TestIssueToCreateParams_NoLabelsNoMilestone(t *testing.T) {
	issue := &gh.Issue{
		Number:    gh.Int(1),
		Title:     gh.String("Simple issue"),
		Body:      gh.String("desc"),
		State:     gh.String("open"),
		HTMLURL:   gh.String("https://github.com/acme/repo/issues/1"),
		CreatedAt: &gh.Timestamp{Time: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
	}

	params := IssueToCreateParams(issue, uuid.New(), "acme/repo#1", "acme", "repo")

	rd := params.RemoteData
	if _, ok := rd["milestone"]; ok {
		t.Errorf("remote_data.milestone should not be set")
	}
	if _, ok := rd["labels"]; ok {
		t.Errorf("remote_data.labels should not be set for empty labels")
	}
}

func TestIssueToUpdateParams(t *testing.T) {
	issue := &gh.Issue{
		Number:    gh.Int(42),
		Title:     gh.String("Updated title"),
		Body:      gh.String("Updated body"),
		State:     gh.String("closed"),
		HTMLURL:   gh.String("https://github.com/acme/repo/issues/42"),
		CreatedAt: &gh.Timestamp{Time: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)},
	}

	params := IssueToUpdateParams(issue, "acme/repo#42")

	if *params.Title != "Updated title" {
		t.Errorf("Title = %q, want %q", *params.Title, "Updated title")
	}
	if *params.Description != "Updated body" {
		t.Errorf("Description = %q, want %q", *params.Description, "Updated body")
	}
	if *params.Phase != task.PhaseClosed {
		t.Errorf("Phase = %v, want PhaseClosed", *params.Phase)
	}
	if *params.Stage != task.StageCompleted {
		t.Errorf("Stage = %v, want StageCompleted", *params.Stage)
	}
	if !params.ClearAssignee {
		t.Error("ClearAssignee should be true when no assignee")
	}
}

func TestIssueToUpdateParams_WithAssignee(t *testing.T) {
	issue := &gh.Issue{
		Number:  gh.Int(10),
		Title:   gh.String("Task"),
		Body:    gh.String(""),
		State:   gh.String("open"),
		HTMLURL: gh.String("https://github.com/acme/repo/issues/10"),
		Assignee: &gh.User{
			Login: gh.String("bob"),
		},
		CreatedAt: &gh.Timestamp{Time: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
	}

	params := IssueToUpdateParams(issue, "acme/repo#10")

	if params.ClearAssignee {
		t.Error("ClearAssignee should be false when assignee is set")
	}
	if params.AssigneeID == nil {
		t.Fatal("AssigneeID should not be nil")
	}
	expected := deterministicUUID("bob")
	if *params.AssigneeID != expected {
		t.Errorf("AssigneeID = %v, want %v", *params.AssigneeID, expected)
	}
}

func TestTaskToIssueRequest_OpenTask(t *testing.T) {
	tsk := &ent.Task{
		Title:       "My task",
		Description: "Some work",
		Phase:       task.PhaseOpen,
		RemoteData: map[string]any{
			"labels": []string{"enhancement", "frontend"},
		},
	}

	req := TaskToIssueRequest(tsk)

	if req.GetTitle() != "My task" {
		t.Errorf("Title = %q, want %q", req.GetTitle(), "My task")
	}
	if req.GetBody() != "Some work" {
		t.Errorf("Body = %q, want %q", req.GetBody(), "Some work")
	}
	if req.GetState() != "open" {
		t.Errorf("State = %q, want %q", req.GetState(), "open")
	}
	if req.Labels == nil || len(*req.Labels) != 2 {
		t.Fatalf("Labels = %v, want 2 labels", req.Labels)
	}
	if (*req.Labels)[0] != "enhancement" || (*req.Labels)[1] != "frontend" {
		t.Errorf("Labels = %v, want [enhancement frontend]", *req.Labels)
	}
}

func TestTaskToIssueRequest_ClosedTask(t *testing.T) {
	tsk := &ent.Task{
		Title: "Closed task",
		Phase: task.PhaseClosed,
	}

	req := TaskToIssueRequest(tsk)

	if req.GetState() != "closed" {
		t.Errorf("State = %q, want %q", req.GetState(), "closed")
	}
	if req.Body != nil {
		t.Errorf("Body = %v, want nil for empty description", req.Body)
	}
	if req.Labels != nil {
		t.Errorf("Labels = %v, want nil for no labels", req.Labels)
	}
}

func TestTaskToIssueRequest_InProgressIsMappedToOpen(t *testing.T) {
	tsk := &ent.Task{
		Title: "Working task",
		Phase: task.PhaseInProgress,
	}

	req := TaskToIssueRequest(tsk)

	if req.GetState() != "open" {
		t.Errorf("State = %q, want %q for in-progress task", req.GetState(), "open")
	}
}

func TestTaskToIssueRequest_OnHoldIsMappedToOpen(t *testing.T) {
	tsk := &ent.Task{
		Title: "On-hold task",
		Phase: task.PhaseOnHold,
	}

	req := TaskToIssueRequest(tsk)

	if req.GetState() != "open" {
		t.Errorf("State = %q, want %q for on-hold task", req.GetState(), "open")
	}
}

func TestSyncSubIssueLinksPaginatesAllTasks(t *testing.T) {
	ctx := context.Background()
	collID := uuid.New()
	s := &pagedTaskStore{
		pages: [][]*ent.Task{
			makeTasks(collID, 1000, 0),
			makeTasks(collID, 1, 1000),
		},
	}
	a := &GitHubAdapter{store: s}
	if err := a.syncSubIssueLinks(ctx, collID); err != nil {
		t.Fatalf("syncSubIssueLinks: %v", err)
	}
	if got, want := len(s.requests), 2; got != want {
		t.Fatalf("ListTasks calls = %d, want %d", got, want)
	}
	if s.requests[1].LastID == "" {
		t.Fatal("second ListTasks call did not include a cursor")
	}
}

type pagedTaskStore struct {
	store.Store
	pages    [][]*ent.Task
	requests []store.ListTasksParams
}

func (s *pagedTaskStore) ListTasks(ctx context.Context, p store.ListTasksParams) ([]*ent.Task, int, error) {
	s.requests = append(s.requests, p)
	page := len(s.requests) - 1
	if page >= len(s.pages) {
		return nil, 0, nil
	}
	return s.pages[page], 1001, nil
}

func makeTasks(collectionID uuid.UUID, count, offset int) []*ent.Task {
	tasks := make([]*ent.Task, 0, count)
	for i := 0; i < count; i++ {
		tasks = append(tasks, &ent.Task{
			ID:           uuid.New(),
			CollectionID: collectionID,
			CreatedAt:    time.Date(2026, 1, 1, 0, 0, offset+i, 0, time.UTC),
			RemoteData:   map[string]any{},
		})
	}
	return tasks
}

func TestExtractIssueNumber(t *testing.T) {
	tests := []struct {
		name       string
		remoteData map[string]any
		want       int
	}{
		{"int value", map[string]any{"number": 42}, 42},
		{"float64 value", map[string]any{"number": float64(42)}, 42},
		{"nil map", nil, 0},
		{"missing key", map[string]any{}, 0},
		{"wrong type", map[string]any{"number": "42"}, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractIssueNumber(tt.remoteData)
			if got != tt.want {
				t.Errorf("extractIssueNumber() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestDeterministicUUID(t *testing.T) {
	a := deterministicUUID("alice")
	b := deterministicUUID("alice")
	c := deterministicUUID("bob")

	if a != b {
		t.Errorf("same input should produce same UUID: %v != %v", a, b)
	}
	if a == c {
		t.Errorf("different inputs should produce different UUIDs: %v == %v", a, c)
	}
	if a == uuid.Nil {
		t.Error("UUID should not be nil")
	}
}

func TestExtractLabels(t *testing.T) {
	tests := []struct {
		name       string
		remoteData map[string]any
		want       int
	}{
		{"string slice", map[string]any{"labels": []string{"a", "b"}}, 2},
		{"any slice", map[string]any{"labels": []any{"a", "b", "c"}}, 3},
		{"nil map", nil, 0},
		{"no labels key", map[string]any{}, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractLabels(tt.remoteData)
			if len(got) != tt.want {
				t.Errorf("extractLabels() returned %d labels, want %d", len(got), tt.want)
			}
		})
	}
}
