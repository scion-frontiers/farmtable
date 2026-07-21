package decomposer

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
)

// mockInferencer is a test double for the Inferencer interface.
type mockInferencer struct {
	mu        sync.Mutex
	responses []string // consumed in order
	callCount int
	calls     [][]Message // records all calls
}

func (m *mockInferencer) Complete(_ context.Context, messages []Message) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, messages)
	idx := m.callCount
	m.callCount++
	if idx >= len(m.responses) {
		return `{"terminal": true}`, nil
	}
	return m.responses[idx], nil
}

// mockWriter is a test double for the TaskWriter interface.
type mockWriter struct {
	mu          sync.Mutex
	tasks       []mockTask
	nextID      int
	collections map[string]string // name -> id
}

type mockTask struct {
	id           string
	name         string
	description  string
	parentTaskID string
	blockedByIDs []string
}

func newMockWriter() *mockWriter {
	return &mockWriter{
		collections: map[string]string{},
	}
}

func (w *mockWriter) CreateTask(_ context.Context, name, description, parentTaskID string, blockedByIDs []string) (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.nextID++
	id := fmt.Sprintf("task-%d", w.nextID)
	w.tasks = append(w.tasks, mockTask{
		id:           id,
		name:         name,
		description:  description,
		parentTaskID: parentTaskID,
		blockedByIDs: blockedByIDs,
	})
	return id, nil
}

func (w *mockWriter) ResolveCollection(_ context.Context, name string) (string, error) {
	if id, ok := w.collections[name]; ok {
		return id, nil
	}
	return "", fmt.Errorf("collection %q not found", name)
}

func (w *mockWriter) CreateCollection(_ context.Context, name string) (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	id := fmt.Sprintf("col-%d", len(w.collections)+1)
	w.collections[name] = id
	return id, nil
}

// makeDecompositionJSON creates a valid JSON decomposition response.
func makeDecompositionJSON(groups []Group) string {
	result := DecompositionResult{Groups: groups}
	data, _ := json.Marshal(result)
	return string(data)
}

func TestEngine_SingleLevelDecomposition(t *testing.T) {
	// LLM returns a single level of subtasks, all terminal.
	response := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "research", Title: "Research", Description: "Do research.", Terminal: true},
				{Slug: "audit", Title: "Audit", Description: "Audit code.", Terminal: true},
			},
		},
		{
			GroupNum: 1,
			Tasks: []Subtask{
				{Slug: "design", Title: "Design", Description: "Design the system.", Terminal: true},
			},
		},
	})

	llm := &mockInferencer{responses: []string{response}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Build a widget", "Build a widget")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should have created 4 tasks: 1 root + 3 subtasks.
	if len(writer.tasks) != 4 {
		t.Fatalf("expected 4 tasks, got %d", len(writer.tasks))
	}

	// Root task.
	root := writer.tasks[0]
	if root.name != "Build a widget" {
		t.Errorf("root name = %q, want %q", root.name, "Build a widget")
	}
	if root.parentTaskID != "" {
		t.Errorf("root parentTaskID = %q, want empty", root.parentTaskID)
	}

	// Group 0 tasks should be children of root with no blockers.
	for i := 1; i <= 2; i++ {
		task := writer.tasks[i]
		if task.parentTaskID != root.id {
			t.Errorf("task %d parentTaskID = %q, want %q", i, task.parentTaskID, root.id)
		}
		if len(task.blockedByIDs) != 0 {
			t.Errorf("task %d should have no blockers (group 0), got %v", i, task.blockedByIDs)
		}
	}

	// Group 1 task should be blocked by group 0 tasks.
	designTask := writer.tasks[3]
	if designTask.parentTaskID != root.id {
		t.Errorf("design task parentTaskID = %q, want %q", designTask.parentTaskID, root.id)
	}
	if len(designTask.blockedByIDs) != 2 {
		t.Fatalf("design task should have 2 blockers, got %d", len(designTask.blockedByIDs))
	}
	// Blocked by the two group-0 task IDs.
	expectedBlockers := map[string]bool{writer.tasks[1].id: true, writer.tasks[2].id: true}
	for _, bid := range designTask.blockedByIDs {
		if !expectedBlockers[bid] {
			t.Errorf("unexpected blocker %q", bid)
		}
	}

	total, terminal, _ := engine.Stats()
	if total != 4 {
		t.Errorf("total = %d, want 4", total)
	}
	if terminal != 3 {
		t.Errorf("terminal = %d, want 3", terminal)
	}
}

func TestEngine_RecursiveDecomposition(t *testing.T) {
	// First LLM call: root decomposition with a non-terminal subtask.
	level0Response := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "research", Title: "Research", Description: "Do research.", Terminal: true},
				{Slug: "design", Title: "Design", Description: "Design the system.", Terminal: false},
			},
		},
	})

	// Second LLM call: "design" decomposition.
	level1Response := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "schema", Title: "Schema", Description: "Define schema.", Terminal: true},
				{Slug: "endpoints", Title: "Endpoints", Description: "Define endpoints.", Terminal: true},
			},
		},
	})

	llm := &mockInferencer{responses: []string{level0Response, level1Response}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Build a system", "Build a system")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 1 root + 2 level-0 + 2 level-1 = 5 tasks.
	if len(writer.tasks) != 5 {
		t.Fatalf("expected 5 tasks, got %d", len(writer.tasks))
	}

	// Verify level-1 tasks are children of the "design" task.
	designTaskID := writer.tasks[2].id // "design" is 3rd task created
	for i := 3; i <= 4; i++ {
		if writer.tasks[i].parentTaskID != designTaskID {
			t.Errorf("task %d parentTaskID = %q, want %q (design)", i, writer.tasks[i].parentTaskID, designTaskID)
		}
	}

	// LLM should have been called exactly 2 times.
	if llm.callCount != 2 {
		t.Errorf("LLM call count = %d, want 2", llm.callCount)
	}
}

func TestEngine_MaxDepthEnforced(t *testing.T) {
	// Every LLM response has a non-terminal subtask, but max depth should cap recursion.
	nonTerminalResponse := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "child", Title: "Child", Description: "A child task.", Terminal: false},
			},
		},
	})

	llm := &mockInferencer{
		responses: []string{
			nonTerminalResponse,
			nonTerminalResponse,
			nonTerminalResponse, // Should not be reached with maxDepth=2.
		},
	}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    2,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Root", "Root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// maxDepth=2: depth 0 LLM call + depth 1 LLM call. Depth 2 is force-terminal.
	if llm.callCount != 2 {
		t.Errorf("LLM call count = %d, want 2", llm.callCount)
	}

	// 1 root + 1 child at depth 0 + 1 child at depth 1 = 3 tasks.
	if len(writer.tasks) != 3 {
		t.Errorf("task count = %d, want 3", len(writer.tasks))
	}
}

func TestEngine_TerminalFromLLM(t *testing.T) {
	// LLM returns terminal=true for the root decomposition.
	terminalResponse := `{"terminal": true}`

	llm := &mockInferencer{responses: []string{terminalResponse}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Simple task", "Simple task")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Only the root task should be created (LLM said it's terminal).
	if len(writer.tasks) != 1 {
		t.Fatalf("expected 1 task (root only), got %d", len(writer.tasks))
	}
}

func TestEngine_ContextChainPropagation(t *testing.T) {
	// Non-terminal at depth 0.
	level0Response := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "child", Title: "Child", Description: "Child task.", Terminal: false},
			},
		},
	})

	// Terminal at depth 1.
	level1Response := `{"terminal": true}`

	llm := &mockInferencer{responses: []string{level0Response, level1Response}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Root description", "Root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify the second LLM call includes the context chain.
	if len(llm.calls) < 2 {
		t.Fatalf("expected at least 2 LLM calls, got %d", len(llm.calls))
	}

	// The second call's user message should contain the root description as context.
	userMsg := llm.calls[1][1].Content // Index 1 = user message
	if !strings.Contains(userMsg, "Root description") {
		t.Errorf("second LLM call should contain parent context 'Root description', got:\n%s", userMsg)
	}
	if !strings.Contains(userMsg, "Child task.") {
		t.Errorf("second LLM call should contain child task text 'Child task.', got:\n%s", userMsg)
	}
}

func TestEngine_ConcurrentFanOut(t *testing.T) {
	// Test that multiple non-terminal subtasks are recursed concurrently.
	level0Response := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "a", Title: "A", Description: "Task A.", Terminal: false},
				{Slug: "b", Title: "B", Description: "Task B.", Terminal: false},
				{Slug: "c", Title: "C", Description: "Task C.", Terminal: false},
			},
		},
	})

	// All children are terminal.
	terminalResponse := `{"terminal": true}`

	llm := &mockInferencer{
		responses: []string{
			level0Response,
			terminalResponse, terminalResponse, terminalResponse,
		},
	}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Root", "Root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 1 root + 3 subtasks = 4 tasks.
	if len(writer.tasks) != 4 {
		t.Errorf("task count = %d, want 4", len(writer.tasks))
	}

	// LLM called 4 times: 1 root + 3 children.
	if llm.callCount != 4 {
		t.Errorf("LLM call count = %d, want 4", llm.callCount)
	}
}

func TestEngine_CorrectiveRetry(t *testing.T) {
	// First response is not valid JSON, second is valid.
	invalidResponse := "I cannot decompose this in JSON format, let me explain..."
	validResponse := makeDecompositionJSON([]Group{
		{
			GroupNum: 0,
			Tasks: []Subtask{
				{Slug: "task-a", Title: "Task A", Description: "Do task A.", Terminal: true},
			},
		},
	})

	llm := &mockInferencer{responses: []string{invalidResponse, validResponse}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Root", "Root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should succeed with corrective retry: 1 root + 1 subtask.
	if len(writer.tasks) != 2 {
		t.Errorf("task count = %d, want 2", len(writer.tasks))
	}
}

func TestEngine_ForcedTerminalOnDoubleParseFail(t *testing.T) {
	// Both responses are not valid JSON — should force terminal.
	llm := &mockInferencer{responses: []string{
		"not json at all",
		"still not json",
	}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(context.Background(), "col-1", "Root", "Root")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Only root task created (decomposition was force-terminal).
	if len(writer.tasks) != 1 {
		t.Errorf("task count = %d, want 1", len(writer.tasks))
	}
}

func TestEngine_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately.

	llm := &mockInferencer{responses: []string{`{"terminal": true}`}}
	writer := newMockWriter()

	engine := NewEngine(EngineConfig{
		LLM:         llm,
		Writer:      writer,
		MaxDepth:    3,
		Concurrency: 4,
	})

	err := engine.Run(ctx, "col-1", "Root", "Root")
	// Root task creation may or may not succeed depending on timing.
	// But the engine should not panic.
	_ = err
}
