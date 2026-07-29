package decomposer

import (
	"testing"
)

func boolPtr(b bool) *bool { return &b }

func TestExtractJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name:  "plain JSON",
			input: `{"terminal": true}`,
			want:  `{"terminal": true}`,
		},
		{
			name:  "JSON in markdown code fence",
			input: "Here is the result:\n```json\n{\"terminal\": true}\n```\n",
			want:  `{"terminal": true}`,
		},
		{
			name:  "JSON with surrounding text",
			input: "I'll decompose this task.\n\n{\"groups\": [{\"group\": 0, \"tasks\": []}]}\n\nHope that helps!",
			want:  `{"groups": [{"group": 0, "tasks": []}]}`,
		},
		{
			name:  "nested JSON objects",
			input: `{"groups": [{"group": 0, "tasks": [{"slug": "a", "title": "b", "description": "c", "terminal": true}]}]}`,
			want:  `{"groups": [{"group": 0, "tasks": [{"slug": "a", "title": "b", "description": "c", "terminal": true}]}]}`,
		},
		{
			name:    "no JSON",
			input:   "This is just plain text without any JSON.",
			wantErr: true,
		},
		{
			name:    "only opening brace",
			input:   "Some text { more text",
			wantErr: true,
		},
		{
			name:    "empty string",
			input:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := extractJSON(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseResult_Terminal(t *testing.T) {
	input := `{"terminal": true}`
	result, err := ParseResult(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Terminal == nil || !*result.Terminal {
		t.Error("expected terminal=true")
	}
	if len(result.Groups) != 0 {
		t.Errorf("expected no groups for terminal result, got %d", len(result.Groups))
	}
}

func TestParseResult_Decomposition(t *testing.T) {
	input := `{
		"groups": [
			{
				"group": 0,
				"tasks": [
					{
						"slug": "research-requirements",
						"title": "Research requirements",
						"description": "Review docs and gather requirements.",
						"terminal": true
					},
					{
						"slug": "audit-code",
						"title": "Audit existing code",
						"description": "Survey the codebase for reusable components.",
						"terminal": true
					}
				]
			},
			{
				"group": 1,
				"tasks": [
					{
						"slug": "design-api",
						"title": "Design the API",
						"description": "Design endpoints and data model.",
						"terminal": false
					}
				]
			}
		]
	}`

	result, err := ParseResult(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Terminal != nil {
		t.Error("expected terminal=nil for decomposition result")
	}
	if len(result.Groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(result.Groups))
	}
	if len(result.Groups[0].Tasks) != 2 {
		t.Errorf("expected 2 tasks in group 0, got %d", len(result.Groups[0].Tasks))
	}
	if len(result.Groups[1].Tasks) != 1 {
		t.Errorf("expected 1 task in group 1, got %d", len(result.Groups[1].Tasks))
	}
	if result.Groups[0].Tasks[0].Slug != "research-requirements" {
		t.Errorf("expected slug research-requirements, got %s", result.Groups[0].Tasks[0].Slug)
	}
	if !result.Groups[0].Tasks[0].Terminal {
		t.Error("expected first task to be terminal")
	}
	if result.Groups[1].Tasks[0].Terminal {
		t.Error("expected design-api to be non-terminal")
	}
}

func TestParseResult_InMarkdownFence(t *testing.T) {
	input := "Here is the decomposition:\n\n```json\n" +
		`{"groups":[{"group":0,"tasks":[{"slug":"a","title":"A","description":"Do A.","terminal":true}]}]}` +
		"\n```\n"

	result, err := ParseResult(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(result.Groups))
	}
}

func TestValidateResult_Errors(t *testing.T) {
	tests := []struct {
		name    string
		result  DecompositionResult
		wantErr string
	}{
		{
			name:    "no groups and not terminal",
			result:  DecompositionResult{},
			wantErr: "no groups",
		},
		{
			name: "empty group",
			result: DecompositionResult{
				Groups: []Group{{GroupNum: 0, Tasks: nil}},
			},
			wantErr: "has no tasks",
		},
		{
			name: "groups not ascending",
			result: DecompositionResult{
				Groups: []Group{
					{GroupNum: 1, Tasks: []Subtask{{Slug: "a", Title: "A", Description: "D"}}},
					{GroupNum: 0, Tasks: []Subtask{{Slug: "b", Title: "B", Description: "D"}}},
				},
			},
			wantErr: "not in ascending order",
		},
		{
			name: "duplicate slug",
			result: DecompositionResult{
				Groups: []Group{
					{GroupNum: 0, Tasks: []Subtask{
						{Slug: "a", Title: "A", Description: "D"},
						{Slug: "a", Title: "B", Description: "D"},
					}},
				},
			},
			wantErr: "duplicate slug",
		},
		{
			name: "empty slug",
			result: DecompositionResult{
				Groups: []Group{
					{GroupNum: 0, Tasks: []Subtask{{Slug: "", Title: "A", Description: "D"}}},
				},
			},
			wantErr: "empty slug",
		},
		{
			name: "empty title",
			result: DecompositionResult{
				Groups: []Group{
					{GroupNum: 0, Tasks: []Subtask{{Slug: "a", Title: "", Description: "D"}}},
				},
			},
			wantErr: "empty title",
		},
		{
			name: "empty description",
			result: DecompositionResult{
				Groups: []Group{
					{GroupNum: 0, Tasks: []Subtask{{Slug: "a", Title: "A", Description: ""}}},
				},
			},
			wantErr: "empty description",
		},
		{
			name:   "terminal true is valid",
			result: DecompositionResult{Terminal: boolPtr(true)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateResult(&tt.result)
			if tt.wantErr == "" {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
				return
			}
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if !contains(err.Error(), tt.wantErr) {
				t.Errorf("error %q does not contain %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestParseResult_InvalidJSON(t *testing.T) {
	_, err := ParseResult("not json at all")
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestParseResult_MalformedJSON(t *testing.T) {
	_, err := ParseResult(`{"groups": [{"group": 0, "tasks": [broken]}]}`)
	if err == nil {
		t.Error("expected error for malformed JSON")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchSubstring(s, substr)
}

func searchSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
