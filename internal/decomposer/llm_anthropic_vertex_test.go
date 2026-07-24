package decomposer

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// newTestAnthropicVertexClient creates an AnthropicVertexClient backed by a
// test HTTP server. It constructs a plain Anthropic SDK client pointed at the
// test server — the Vertex URL-rewriting middleware is tested by the SDK
// itself; our tests focus on message mapping, response parsing, and error
// handling within the Complete method.
func newTestAnthropicVertexClient(t *testing.T, serverURL, model string) *AnthropicVertexClient {
	t.Helper()
	sdkClient := anthropic.NewClient(
		option.WithBaseURL(serverURL),
		option.WithAPIKey("fake-key"),
	)
	c := &AnthropicVertexClient{
		Project:  "test-project",
		Location: "us-east5",
		Model:    model,
	}
	// Fire sync.Once so getClient() won't overwrite our test client
	// with a real Vertex-authenticated one.
	c.once.Do(func() {
		c.client = &sdkClient
	})
	return c
}

// TestAnthropicVertexComplete verifies the AnthropicVertexClient returns text
// from a successful API response.
func TestAnthropicVertexComplete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify it's a POST to the messages endpoint.
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if !strings.HasSuffix(r.URL.Path, "/messages") {
			t.Errorf("expected path ending in /messages, got %q", r.URL.Path)
		}

		var reqBody map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}

		// System should be present as array of text blocks.
		if _, ok := reqBody["system"]; !ok {
			t.Error("system prompt should be present in request body")
		}

		// Model should be in the body.
		if reqBody["model"] != "claude-3-5-haiku@20241022" {
			t.Errorf("expected model claude-3-5-haiku@20241022, got %v", reqBody["model"])
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":   "msg_test123",
			"type": "message",
			"role": "assistant",
			"content": []map[string]interface{}{
				{"type": "text", "text": `{"terminal": true}`},
			},
			"model":       "claude-3-5-haiku@20241022",
			"stop_reason": "end_turn",
			"usage":       map[string]interface{}{"input_tokens": 10, "output_tokens": 5},
		})
	}))
	defer server.Close()

	client := newTestAnthropicVertexClient(t, server.URL, "claude-3-5-haiku@20241022")

	messages := []Message{
		{Role: "system", Content: "You are a decomposition engine."},
		{Role: "user", Content: "Break this into subtasks."},
	}

	result, err := client.Complete(context.Background(), messages)
	if err != nil {
		t.Fatalf("Complete() returned error: %v", err)
	}

	if !strings.Contains(result, "terminal") {
		t.Errorf("expected result containing 'terminal', got %q", result)
	}
}

// TestAnthropicVertexComplete_ErrorHandling verifies HTTP error codes are
// properly extracted and wrapped as LLMError.
func TestAnthropicVertexComplete_ErrorHandling(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"type": "error",
			"error": map[string]interface{}{
				"type":    "rate_limit_error",
				"message": "Rate limited",
			},
		})
	}))
	defer server.Close()

	client := newTestAnthropicVertexClient(t, server.URL, "claude-3-5-haiku@20241022")

	messages := []Message{
		{Role: "user", Content: "test"},
	}

	_, err := client.Complete(context.Background(), messages)
	if err == nil {
		t.Fatal("expected error for 429 response, got nil")
	}

	llmErr, ok := err.(*LLMError)
	if !ok {
		t.Fatalf("expected *LLMError, got %T: %v", err, err)
	}
	if llmErr.StatusCode != 429 {
		t.Errorf("expected status 429, got %d", llmErr.StatusCode)
	}
	if !llmErr.IsTransient() {
		t.Error("429 error should be transient")
	}
}

// TestAnthropicVertexComplete_ServerError verifies 500 errors are transient.
func TestAnthropicVertexComplete_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"type": "error",
			"error": map[string]interface{}{
				"type":    "api_error",
				"message": "Internal error",
			},
		})
	}))
	defer server.Close()

	client := newTestAnthropicVertexClient(t, server.URL, "claude-3-5-haiku@20241022")

	_, err := client.Complete(context.Background(), messages("test"))
	if err == nil {
		t.Fatal("expected error for 500 response, got nil")
	}

	llmErr, ok := err.(*LLMError)
	if !ok {
		t.Fatalf("expected *LLMError, got %T: %v", err, err)
	}
	if !llmErr.IsTransient() {
		t.Error("500 error should be transient")
	}
}

// TestAnthropicVertexClientDefaults verifies default model and location.
func TestAnthropicVertexClientDefaults(t *testing.T) {
	c := NewAnthropicVertexClient("my-project", "", "")
	if c.Model != defaultAnthropicVertexModel {
		t.Errorf("default model = %q, want %q", c.Model, defaultAnthropicVertexModel)
	}
	if c.Location != defaultAnthropicVertexLocation {
		t.Errorf("default location = %q, want %q", c.Location, defaultAnthropicVertexLocation)
	}
	if c.Project != "my-project" {
		t.Errorf("project = %q, want %q", c.Project, "my-project")
	}
}

// TestAnthropicVertexClientCustomValues verifies custom values are preserved.
func TestAnthropicVertexClientCustomValues(t *testing.T) {
	c := NewAnthropicVertexClient("custom-project", "europe-west1", "claude-3-5-haiku@20241022")
	if c.Model != "claude-3-5-haiku@20241022" {
		t.Errorf("model = %q, want %q", c.Model, "claude-3-5-haiku@20241022")
	}
	if c.Location != "europe-west1" {
		t.Errorf("location = %q, want %q", c.Location, "europe-west1")
	}
	if c.Project != "custom-project" {
		t.Errorf("project = %q, want %q", c.Project, "custom-project")
	}
}

// TestAnthropicVertexComplete_SystemInstructions verifies that system
// messages are correctly separated and sent as the system parameter.
func TestAnthropicVertexComplete_SystemInstructions(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":   "msg_test",
			"type": "message",
			"role": "assistant",
			"content": []map[string]interface{}{
				{"type": "text", "text": "response text"},
			},
			"model":       "claude-3-5-haiku@20241022",
			"stop_reason": "end_turn",
			"usage":       map[string]interface{}{"input_tokens": 1, "output_tokens": 1},
		})
	}))
	defer server.Close()

	client := newTestAnthropicVertexClient(t, server.URL, "claude-3-5-haiku@20241022")

	msgs := []Message{
		{Role: "system", Content: "You are a task decomposer."},
		{Role: "user", Content: "Decompose this."},
	}

	result, err := client.Complete(context.Background(), msgs)
	if err != nil {
		t.Fatalf("Complete() returned error: %v", err)
	}
	if result != "response text" {
		t.Errorf("expected 'response text', got %q", result)
	}

	// Verify system prompt was sent as the "system" field, not as a message.
	system, ok := receivedBody["system"]
	if !ok {
		t.Fatal("expected 'system' field in request body")
	}

	// System should be an array of text blocks.
	systemArr, ok := system.([]interface{})
	if !ok {
		t.Fatalf("expected system to be an array, got %T", system)
	}
	if len(systemArr) != 1 {
		t.Fatalf("expected 1 system block, got %d", len(systemArr))
	}
	block, ok := systemArr[0].(map[string]interface{})
	if !ok {
		t.Fatalf("expected system block to be object, got %T", systemArr[0])
	}
	if block["text"] != "You are a task decomposer." {
		t.Errorf("system text = %q, want %q", block["text"], "You are a task decomposer.")
	}

	// Verify that the system message is NOT in the messages array.
	msgArr, ok := receivedBody["messages"].([]interface{})
	if !ok {
		t.Fatal("expected 'messages' to be an array")
	}
	for _, m := range msgArr {
		msg, ok := m.(map[string]interface{})
		if !ok {
			continue
		}
		if msg["role"] == "system" {
			t.Error("system message should not appear in the messages array")
		}
	}
}

// TestAnthropicVertexComplete_MultiTurnConversation verifies proper handling
// of user and assistant turns.
func TestAnthropicVertexComplete_MultiTurnConversation(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":   "msg_test",
			"type": "message",
			"role": "assistant",
			"content": []map[string]interface{}{
				{"type": "text", "text": "final response"},
			},
			"model":       "claude-3-5-haiku@20241022",
			"stop_reason": "end_turn",
			"usage":       map[string]interface{}{"input_tokens": 1, "output_tokens": 1},
		})
	}))
	defer server.Close()

	client := newTestAnthropicVertexClient(t, server.URL, "claude-3-5-haiku@20241022")

	msgs := []Message{
		{Role: "system", Content: "System prompt."},
		{Role: "user", Content: "First question."},
		{Role: "assistant", Content: "First answer."},
		{Role: "user", Content: "Follow-up question."},
	}

	result, err := client.Complete(context.Background(), msgs)
	if err != nil {
		t.Fatalf("Complete() returned error: %v", err)
	}
	if result != "final response" {
		t.Errorf("expected 'final response', got %q", result)
	}

	// Verify messages array has 3 entries (no system).
	msgArr, ok := receivedBody["messages"].([]interface{})
	if !ok {
		t.Fatal("expected 'messages' to be an array")
	}
	if len(msgArr) != 3 {
		t.Fatalf("expected 3 messages (no system), got %d", len(msgArr))
	}

	// Verify roles.
	expectedRoles := []string{"user", "assistant", "user"}
	for i, m := range msgArr {
		msg := m.(map[string]interface{})
		if msg["role"] != expectedRoles[i] {
			t.Errorf("message %d role = %q, want %q", i, msg["role"], expectedRoles[i])
		}
	}
}

// TestAnthropicVertexComplete_EmptyResponse verifies empty response handling.
func TestAnthropicVertexComplete_EmptyResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":          "msg_test",
			"type":        "message",
			"role":        "assistant",
			"content":     []map[string]interface{}{},
			"model":       "claude-3-5-haiku@20241022",
			"stop_reason": "end_turn",
			"usage":       map[string]interface{}{"input_tokens": 1, "output_tokens": 0},
		})
	}))
	defer server.Close()

	client := newTestAnthropicVertexClient(t, server.URL, "claude-3-5-haiku@20241022")

	_, err := client.Complete(context.Background(), messages("test"))
	if err == nil {
		t.Fatal("expected error for empty response, got nil")
	}
	if !strings.Contains(err.Error(), "empty response") {
		t.Errorf("expected 'empty response' error, got: %v", err)
	}
}

// messages is a test helper that creates a single-message slice.
func messages(content string) []Message {
	return []Message{{Role: "user", Content: content}}
}
