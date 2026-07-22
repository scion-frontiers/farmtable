package server

import (
	"strings"
	"testing"
	"time"
)

func TestDetectImportFormat(t *testing.T) {
	tests := []struct {
		name string
		data string
		want string
	}{
		{
			name: "native farmtable JSON",
			data: `{"format_version":1,"generator":"farmtable","collection":{"platform":"farmtable"}}`,
			want: "farmtable",
		},
		{
			name: "beads JSONL with _type",
			data: `{"_type":"issue","id":"abc-123","title":"Test Issue","status":"open"}`,
			want: "beads",
		},
		{
			name: "beads JSONL with title only",
			data: `{"id":"abc-123","title":"Test Issue","status":"open"}`,
			want: "beads",
		},
		{
			name: "beads JSONL multi-line",
			data: `{"_type":"issue","id":"a","title":"First"}
{"_type":"issue","id":"b","title":"Second"}`,
			want: "beads",
		},
		{
			name: "empty data",
			data: "",
			want: "",
		},
		{
			name: "whitespace only",
			data: "   \n\n  ",
			want: "",
		},
		{
			name: "non-JSON data",
			data: "not json at all",
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := detectImportFormat([]byte(tt.data))
			if got != tt.want {
				t.Errorf("detectImportFormat() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseBeadsJSONL(t *testing.T) {
	t.Run("valid single issue", func(t *testing.T) {
		data := `{"_type":"issue","id":"test-1","title":"Fix bug","status":"open","priority":2,"issue_type":"bug","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-02T00:00:00Z"}`
		issues, warnings, err := parseBeadsJSONL([]byte(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 {
			t.Fatalf("got %d issues, want 1", len(issues))
		}
		if issues[0].Title != "Fix bug" {
			t.Errorf("title = %q, want %q", issues[0].Title, "Fix bug")
		}
		if issues[0].Status != "open" {
			t.Errorf("status = %q, want %q", issues[0].Status, "open")
		}
		if issues[0].Priority != 2 {
			t.Errorf("priority = %d, want 2", issues[0].Priority)
		}
		if len(warnings) != 0 {
			t.Errorf("unexpected warnings: %v", warnings)
		}
	})

	t.Run("multiple issues with blank lines", func(t *testing.T) {
		data := `{"_type":"issue","id":"a","title":"A","status":"open","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}

{"_type":"issue","id":"b","title":"B","status":"closed","closed_at":"2026-01-05T00:00:00Z","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-05T00:00:00Z"}
`
		issues, _, err := parseBeadsJSONL([]byte(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 2 {
			t.Fatalf("got %d issues, want 2", len(issues))
		}
	})

	t.Run("skips non-issue records", func(t *testing.T) {
		data := `{"_type":"event","id":"e1","title":"Event"}
{"_type":"issue","id":"i1","title":"Real Issue","status":"open","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}`
		issues, _, err := parseBeadsJSONL([]byte(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 {
			t.Fatalf("got %d issues, want 1", len(issues))
		}
		if issues[0].Title != "Real Issue" {
			t.Errorf("title = %q, want %q", issues[0].Title, "Real Issue")
		}
	})

	t.Run("skips lines with missing title", func(t *testing.T) {
		data := `{"_type":"issue","id":"no-title","status":"open"}
{"_type":"issue","id":"has-title","title":"Valid","status":"open","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}`
		issues, warnings, err := parseBeadsJSONL([]byte(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues) != 1 {
			t.Fatalf("got %d issues, want 1", len(issues))
		}
		if len(warnings) != 1 {
			t.Fatalf("got %d warnings, want 1", len(warnings))
		}
		if !strings.Contains(warnings[0], "missing title") {
			t.Errorf("warning = %q, want containing 'missing title'", warnings[0])
		}
	})

	t.Run("error on empty data", func(t *testing.T) {
		_, _, err := parseBeadsJSONL([]byte(""))
		if err == nil {
			t.Fatal("expected error for empty data")
		}
	})

	t.Run("parses dependencies", func(t *testing.T) {
		data := `{"_type":"issue","id":"child","title":"Child","status":"open","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","dependencies":[{"issue_id":"child","depends_on_id":"parent","type":"parent-child","created_at":"2026-01-01T00:00:00Z","created_by":"root","metadata":"{}"}]}`
		issues, _, err := parseBeadsJSONL([]byte(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues[0].Dependencies) != 1 {
			t.Fatalf("got %d dependencies, want 1", len(issues[0].Dependencies))
		}
		if issues[0].Dependencies[0].Type != "parent-child" {
			t.Errorf("dependency type = %q, want %q", issues[0].Dependencies[0].Type, "parent-child")
		}
	})

	t.Run("parses comments", func(t *testing.T) {
		data := `{"_type":"issue","id":"i1","title":"Issue","status":"open","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z","comments":[{"id":"c1","issue_id":"i1","author":"Alice","text":"hello","created_at":"2026-01-01T00:00:00Z"}]}`
		issues, _, err := parseBeadsJSONL([]byte(data))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(issues[0].Comments) != 1 {
			t.Fatalf("got %d comments, want 1", len(issues[0].Comments))
		}
		if issues[0].Comments[0].Author != "Alice" {
			t.Errorf("comment author = %q, want %q", issues[0].Comments[0].Author, "Alice")
		}
	})
}

func TestBeadsStatusToPhaseStage(t *testing.T) {
	tests := []struct {
		status    string
		wantPhase string
		wantStage string
	}{
		{"open", "open", "ready"},
		{"in_progress", "in_progress", "working"},
		{"hooked", "in_progress", "working"},
		{"blocked", "in_progress", "blocked"},
		{"deferred", "on_hold", "deferred"},
		{"closed", "closed", "completed"},
		{"pinned", "open", "backlog"},
		{"unknown_status", "open", "triage"},
		{"", "open", "triage"},
	}
	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			phase, stage := beadsStatusToPhaseStage(tt.status)
			if phase != tt.wantPhase || stage != tt.wantStage {
				t.Errorf("beadsStatusToPhaseStage(%q) = (%q, %q), want (%q, %q)",
					tt.status, phase, stage, tt.wantPhase, tt.wantStage)
			}
		})
	}
}

func TestBeadsPriorityToFarmtable(t *testing.T) {
	tests := []struct {
		priority int
		want     string
	}{
		{0, "urgent"},
		{1, "high"},
		{2, "normal"},
		{3, "low"},
		{4, "low"},
	}
	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := beadsPriorityToFarmtable(tt.priority)
			if got == nil {
				t.Fatalf("beadsPriorityToFarmtable(%d) = nil, want %q", tt.priority, tt.want)
			}
			if *got != tt.want {
				t.Errorf("beadsPriorityToFarmtable(%d) = %q, want %q", tt.priority, *got, tt.want)
			}
		})
	}
}

func TestBeadsTypeToFarmtable(t *testing.T) {
	tests := []struct {
		beadsType string
		want      string
	}{
		{"bug", "bug"},
		{"epic", "epic"},
		{"story", "story"},
		{"task", "task"},
		{"feature", "task"},
		{"chore", "task"},
		{"subtask", "subtask"},
		{"decision", "task"},
		{"spike", "task"},
		{"milestone", "task"},
		{"", "task"},
	}
	for _, tt := range tests {
		t.Run(tt.beadsType, func(t *testing.T) {
			got := beadsTypeToFarmtable(tt.beadsType)
			if got != tt.want {
				t.Errorf("beadsTypeToFarmtable(%q) = %q, want %q", tt.beadsType, got, tt.want)
			}
		})
	}
}

func TestConvertBeadsToExportDocument(t *testing.T) {
	t.Run("basic conversion", func(t *testing.T) {
		now := time.Now().UTC()
		issues := []beadsIssue{
			{
				ID:        "test-1",
				Title:     "Fix critical bug",
				Description: "Something is broken",
				Status:    "open",
				Priority:  1,
				IssueType: "bug",
				Assignee:  "Alice",
				Labels:    []string{"backend"},
				CreatedAt: now,
				UpdatedAt: now,
			},
		}

		doc, warnings, err := convertBeadsToExportDocument(issues, "Test Collection")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(warnings) != 0 {
			t.Errorf("unexpected warnings: %v", warnings)
		}
		if doc.FormatVersion != 1 {
			t.Errorf("format_version = %d, want 1", doc.FormatVersion)
		}
		if doc.Generator != "farmtable" {
			t.Errorf("generator = %q, want %q", doc.Generator, "farmtable")
		}
		if doc.Collection.Name != "Test Collection" {
			t.Errorf("collection name = %q, want %q", doc.Collection.Name, "Test Collection")
		}
		if len(doc.Tasks) != 1 {
			t.Fatalf("got %d tasks, want 1", len(doc.Tasks))
		}
		task := doc.Tasks[0]
		if task.Title != "Fix critical bug" {
			t.Errorf("title = %q, want %q", task.Title, "Fix critical bug")
		}
		if task.Phase != "open" {
			t.Errorf("phase = %q, want %q", task.Phase, "open")
		}
		if task.Stage != "ready" {
			t.Errorf("stage = %q, want %q", task.Stage, "ready")
		}
		if task.NativeLabel != "open" {
			t.Errorf("native_label = %q, want %q", task.NativeLabel, "open")
		}
		if task.Type != "bug" {
			t.Errorf("type = %q, want %q", task.Type, "bug")
		}
		if task.Priority == nil || *task.Priority != "high" {
			t.Errorf("priority = %v, want 'high'", task.Priority)
		}
		if task.AssigneeID == nil {
			t.Fatal("assignee_id is nil, want non-nil")
		}
		if len(task.Labels) != 1 || task.Labels[0] != "backend" {
			t.Errorf("labels = %v, want [backend]", task.Labels)
		}

		// Verify user was created for the assignee.
		if len(doc.Users) != 1 {
			t.Fatalf("got %d users, want 1", len(doc.Users))
		}
		if doc.Users[0].DisplayName != "Alice" {
			t.Errorf("user display_name = %q, want %q", doc.Users[0].DisplayName, "Alice")
		}
	})

	t.Run("parent-child dependency", func(t *testing.T) {
		now := time.Now().UTC()
		issues := []beadsIssue{
			{
				ID:        "parent-1",
				Title:     "Epic",
				Status:    "open",
				IssueType: "epic",
				CreatedAt: now,
				UpdatedAt: now,
			},
			{
				ID:        "child-1",
				Title:     "Task under epic",
				Status:    "open",
				IssueType: "task",
				CreatedAt: now,
				UpdatedAt: now,
				Dependencies: []beadsDependency{
					{
						IssueID:     "child-1",
						DependsOnID: "parent-1",
						Type:        "parent-child",
					},
				},
			},
		}

		doc, _, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(doc.Tasks) != 2 {
			t.Fatalf("got %d tasks, want 2", len(doc.Tasks))
		}

		// Find the child task.
		var child exportTask
		for _, task := range doc.Tasks {
			if task.Title == "Task under epic" {
				child = task
				break
			}
		}
		if child.ParentTaskID == nil {
			t.Fatal("child parent_task_id is nil, want non-nil")
		}

		// Verify parent UUID matches the parent task's ID.
		var parentUUID string
		for _, task := range doc.Tasks {
			if task.Title == "Epic" {
				parentUUID = task.ID
				break
			}
		}
		if *child.ParentTaskID != parentUUID {
			t.Errorf("child parent = %q, want %q", *child.ParentTaskID, parentUUID)
		}
	})

	t.Run("blocks dependency creates relationship", func(t *testing.T) {
		now := time.Now().UTC()
		issues := []beadsIssue{
			{
				ID:        "blocker",
				Title:     "Blocker task",
				Status:    "open",
				IssueType: "task",
				CreatedAt: now,
				UpdatedAt: now,
			},
			{
				ID:        "blocked",
				Title:     "Blocked task",
				Status:    "open",
				IssueType: "task",
				CreatedAt: now,
				UpdatedAt: now,
				Dependencies: []beadsDependency{
					{
						IssueID:     "blocked",
						DependsOnID: "blocker",
						Type:        "blocks",
					},
				},
			},
		}

		doc, _, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(doc.Relationships) != 1 {
			t.Fatalf("got %d relationships, want 1", len(doc.Relationships))
		}
		rel := doc.Relationships[0]
		if rel.Type != "blocks" {
			t.Errorf("relationship type = %q, want %q", rel.Type, "blocks")
		}
	})

	t.Run("description appends design and notes", func(t *testing.T) {
		now := time.Now().UTC()
		issues := []beadsIssue{
			{
				ID:          "notes-1",
				Title:       "Has notes",
				Description: "Main description",
				Design:      "Design notes here",
				Notes:       "Extra notes",
				Status:      "open",
				IssueType:   "task",
				CreatedAt:   now,
				UpdatedAt:   now,
			},
		}

		doc, _, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		desc := doc.Tasks[0].Description
		if !strings.Contains(desc, "Main description") {
			t.Errorf("description missing main text")
		}
		if !strings.Contains(desc, "## Design") {
			t.Errorf("description missing design section")
		}
		if !strings.Contains(desc, "## Notes") {
			t.Errorf("description missing notes section")
		}
	})

	t.Run("closed_at is preserved", func(t *testing.T) {
		now := time.Now().UTC()
		closedAt := now.Add(-time.Hour)
		issues := []beadsIssue{
			{
				ID:        "closed-1",
				Title:     "Closed issue",
				Status:    "closed",
				IssueType: "task",
				CreatedAt: now.Add(-24 * time.Hour),
				UpdatedAt: now,
				ClosedAt:  &closedAt,
			},
		}

		doc, _, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if doc.Tasks[0].ClosedAt == nil {
			t.Fatal("closed_at is nil, want non-nil")
		}
		if !doc.Tasks[0].ClosedAt.Equal(closedAt) {
			t.Errorf("closed_at = %v, want %v", doc.Tasks[0].ClosedAt, closedAt)
		}
		if doc.Tasks[0].Phase != "closed" {
			t.Errorf("phase = %q, want %q", doc.Tasks[0].Phase, "closed")
		}
		if doc.Tasks[0].Stage != "completed" {
			t.Errorf("stage = %q, want %q", doc.Tasks[0].Stage, "completed")
		}
	})

	t.Run("comments are converted", func(t *testing.T) {
		now := time.Now().UTC()
		issues := []beadsIssue{
			{
				ID:        "commented-1",
				Title:     "Issue with comment",
				Status:    "open",
				IssueType: "task",
				CreatedAt: now,
				UpdatedAt: now,
				Comments: []beadsComment{
					{
						ID:        "c1",
						IssueID:   "commented-1",
						Author:    "Bob",
						Text:      "This looks good",
						CreatedAt: now,
					},
				},
			},
		}

		doc, _, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(doc.Comments) != 1 {
			t.Fatalf("got %d comments, want 1", len(doc.Comments))
		}
		if doc.Comments[0].Body != "This looks good" {
			t.Errorf("comment body = %q, want %q", doc.Comments[0].Body, "This looks good")
		}
		// Verify the comment author was created as a user.
		foundBob := false
		for _, u := range doc.Users {
			if u.DisplayName == "Bob" {
				foundBob = true
				break
			}
		}
		if !foundBob {
			t.Error("expected a user named 'Bob' for comment author")
		}
	})

	t.Run("missing parent warns", func(t *testing.T) {
		now := time.Now().UTC()
		issues := []beadsIssue{
			{
				ID:        "orphan",
				Title:     "Orphan child",
				Status:    "open",
				IssueType: "task",
				CreatedAt: now,
				UpdatedAt: now,
				Dependencies: []beadsDependency{
					{
						IssueID:     "orphan",
						DependsOnID: "nonexistent-parent",
						Type:        "parent-child",
					},
				},
			},
		}

		doc, warnings, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if doc.Tasks[0].ParentTaskID != nil {
			t.Errorf("parent_task_id should be nil for orphan")
		}
		if len(warnings) != 1 {
			t.Fatalf("got %d warnings, want 1", len(warnings))
		}
		if !strings.Contains(warnings[0], "not found") {
			t.Errorf("warning = %q, want containing 'not found'", warnings[0])
		}
	})

	t.Run("started_at and due_at mapped", func(t *testing.T) {
		now := time.Now().UTC()
		started := now.Add(-48 * time.Hour)
		due := now.Add(48 * time.Hour)
		issues := []beadsIssue{
			{
				ID:        "dated-1",
				Title:     "Dated issue",
				Status:    "in_progress",
				IssueType: "task",
				CreatedAt: now,
				UpdatedAt: now,
				StartedAt: &started,
				DueAt:     &due,
			},
		}

		doc, _, err := convertBeadsToExportDocument(issues, "Test")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		task := doc.Tasks[0]
		if task.StartDate == nil || !task.StartDate.Equal(started) {
			t.Errorf("start_date = %v, want %v", task.StartDate, started)
		}
		if task.DueDate == nil || !task.DueDate.Equal(due) {
			t.Errorf("due_date = %v, want %v", task.DueDate, due)
		}
	})
}

func TestDeduplicateRelationships(t *testing.T) {
	rels := []exportRelationship{
		{ID: "1", SourceTaskID: "a", TargetTaskID: "b", Type: "blocks"},
		{ID: "2", SourceTaskID: "a", TargetTaskID: "b", Type: "blocks"},
		{ID: "3", SourceTaskID: "c", TargetTaskID: "d", Type: "relates_to"},
		{ID: "4", SourceTaskID: "d", TargetTaskID: "c", Type: "relates_to"},
	}
	result := deduplicateRelationships(rels)
	if len(result) != 2 {
		t.Errorf("got %d relationships, want 2", len(result))
	}
}
