package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/steveyegge/beads"
)

type mockStorage struct {
	beads.Storage
	mockSearchIssues func(ctx context.Context, query string, filter beads.IssueFilter) ([]*beads.Issue, error)
}

func (m *mockStorage) SearchIssues(ctx context.Context, query string, filter beads.IssueFilter) ([]*beads.Issue, error) {
	if m.mockSearchIssues != nil {
		return m.mockSearchIssues(ctx, query, filter)
	}
	return nil, nil
}

func TestPingMethod(t *testing.T) {
	// Set up output capture
	var buf bytes.Buffer
	outputWriter = &buf

	ctx := context.Background()
	req := Request{
		Method: "ping",
		ID:     42,
	}

	dispatchRequest(ctx, nil, req)

	var resp Response
	if err := json.Unmarshal(buf.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v. Output: %q", err, buf.String())
	}

	if resp.JSONRPC != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %s", resp.JSONRPC)
	}

	if resp.ID != 42 {
		t.Errorf("Expected ID 42, got %d", resp.ID)
	}

	if resp.Result != "pong" {
		t.Errorf("Expected Result 'pong', got %v", resp.Result)
	}
}

func TestGraphMethod(t *testing.T) {
	var buf bytes.Buffer
	outputWriter = &buf

	mockIssues := []*beads.Issue{
		{
			ID:        "issue-1",
			Title:     "Test Issue",
			Status:    "open",
			Priority:  1,
			IssueType: "task",
		},
	}

	storage := &mockStorage{
		mockSearchIssues: func(ctx context.Context, query string, filter beads.IssueFilter) ([]*beads.Issue, error) {
			if !filter.IncludeDependencies {
				t.Errorf("Expected IncludeDependencies to be true")
			}
			return mockIssues, nil
		},
	}

	ctx := context.Background()
	req := Request{
		Method: "graph",
		ID:     99,
	}

	dispatchRequest(ctx, storage, req)

	var resp Response
	if err := json.Unmarshal(buf.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v. Output: %q", err, buf.String())
	}

	if resp.ID != 99 {
		t.Errorf("Expected ID 99, got %d", resp.ID)
	}

	// Result should contain the issues
	resultBytes, err := json.Marshal(resp.Result)
	if err != nil {
		t.Fatalf("Failed to marshal result: %v", err)
	}

	var parsedIssues []beads.Issue
	if err := json.Unmarshal(resultBytes, &parsedIssues); err != nil {
		t.Fatalf("Failed to unmarshal result issues: %v", err)
	}

	if len(parsedIssues) != 1 {
		t.Fatalf("Expected 1 issue in result, got %d", len(parsedIssues))
	}

	if parsedIssues[0].ID != "issue-1" {
		t.Errorf("Expected issue ID 'issue-1', got %s", parsedIssues[0].ID)
	}
}

func TestSanitizeEnvValue(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"normal-actor", "normal-actor"},
		{"actor\nwith\nnewlines", "actorwithnewlines"},
		{"actor\rwith\rcarriage", "actorwithcarriage"},
		{"actor\x00with\x00nulls", "actorwithnulls"},
		{"actor\n\r\x00mixed", "actormixed"},
	}

	for _, tc := range tests {
		got := sanitizeEnvValue(tc.input)
		if got != tc.expected {
			t.Errorf("sanitizeEnvValue(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}

func TestCommentsFlagInjection(t *testing.T) {
	originalWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Failed to get working directory: %v", err)
	}
	defer func() {
		_ = os.Chdir(originalWd)
	}()

	err = os.Chdir("..")
	if err != nil {
		t.Fatalf("Failed to change directory to project root: %v", err)
	}

	var buf bytes.Buffer
	outputWriter = &buf

	ctx := context.Background()
	req := Request{
		Method: "get_comments",
		Params: json.RawMessage(`{"id": "--force"}`),
		ID:     123,
	}

	dispatchRequest(ctx, nil, req)

	var resp Response
	if err := json.Unmarshal(buf.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v. Output: %q", err, buf.String())
	}

	if resp.ID != 123 {
		t.Errorf("Expected ID 123, got %v", resp.ID)
	}

	if resp.Error == nil {
		t.Fatalf("Expected Error in response, got nil (Result: %v)", resp.Result)
	}

	expectedSub := `resolving --force`
	if !strings.Contains(resp.Error.Message, expectedSub) {
		t.Errorf("Expected error message to contain %q, got %q", expectedSub, resp.Error.Message)
	}

	// Double check that it did NOT report unknown flag
	unexpectedSub := "unknown flag"
	if strings.Contains(resp.Error.Message, unexpectedSub) {
		t.Errorf("Flag injection occurred! Error message contained %q, output: %q", unexpectedSub, resp.Error.Message)
	}
}

func TestCheckHealthCaching(t *testing.T) {
	// 1. Create a temporary directory
	tempDir, err := os.MkdirTemp("", "beads-test-")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create .beads subdirectory
	beadsDir := filepath.Join(tempDir, ".beads")
	if err := os.Mkdir(beadsDir, 0755); err != nil {
		t.Fatalf("failed to create .beads dir: %v", err)
	}

	// Create a dummy issues.jsonl
	jsonlPath := filepath.Join(beadsDir, "issues.jsonl")
	if err := os.WriteFile(jsonlPath, []byte(""), 0644); err != nil {
		t.Fatalf("failed to write dummy issues.jsonl: %v", err)
	}

	// Create a dummy config.yaml so FindBeadsDir recognizes it as a valid project
	configPath := filepath.Join(beadsDir, "config.yaml")
	if err := os.WriteFile(configPath, []byte("issue-prefix: \"watcher\""), 0644); err != nil {
		t.Fatalf("failed to write dummy config.yaml: %v", err)
	}

	// 2. Save original CWD and change to tempDir
	originalWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get wd: %v", err)
	}
	defer func() {
		_ = os.Chdir(originalWd)
	}()

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}

	// 3. Setup mock storage & mock response captures
	var buf bytes.Buffer
	outputWriter = &buf

	// We'll track how many times SearchIssues is called
	searchCallCount := 0
	mockIssues := []*beads.Issue{
		{
			ID:        "issue-1",
			Title:     "Test Issue",
			Status:    "open",
			Priority:  1,
			IssueType: "task",
		},
	}

	storage := &mockStorage{
		mockSearchIssues: func(ctx context.Context, query string, filter beads.IssueFilter) ([]*beads.Issue, error) {
			searchCallCount++
			return mockIssues, nil
		},
	}

	ctx := context.Background()

	// Clear/invalidate the cache before starting
	healthCacheMu.Lock()
	healthCacheValid = false
	healthCacheTime = time.Time{}
	healthCacheMu.Unlock()

	// 4. First call: Cache is invalid, should call SearchIssues (searchCallCount = 1)
	handleCheckHealth(ctx, storage, 1)

	var resp1 Response
	if err := json.Unmarshal(buf.Bytes(), &resp1); err != nil {
		t.Fatalf("failed to unmarshal resp1: %v", err)
	}
	if searchCallCount != 1 {
		t.Errorf("expected searchCallCount to be 1, got %d", searchCallCount)
	}

	buf.Reset()

	// 5. Second call: Cache should be valid, should NOT call SearchIssues (searchCallCount stays 1)
	handleCheckHealth(ctx, storage, 2)

	var resp2 Response
	if err := json.Unmarshal(buf.Bytes(), &resp2); err != nil {
		t.Fatalf("failed to unmarshal resp2: %v", err)
	}
	if searchCallCount != 1 {
		t.Errorf("expected searchCallCount to still be 1 (cached), got %d", searchCallCount)
	}

	buf.Reset()

	// 6. Modify the dummy issues.jsonl (update its mod time)
	// On some filesystems/OS, modification time resolution is coarse.
	// We should update the mod time to at least 10 seconds in the future
	futureTime := time.Now().Add(10 * time.Second)
	if err := os.Chtimes(jsonlPath, futureTime, futureTime); err != nil {
		t.Fatalf("failed to change mod time: %v", err)
	}

	// 7. Third call: Cache should detect change, call SearchIssues again (searchCallCount = 2)
	handleCheckHealth(ctx, storage, 3)

	var resp3 Response
	if err := json.Unmarshal(buf.Bytes(), &resp3); err != nil {
		t.Fatalf("failed to unmarshal resp3: %v", err)
	}
	if searchCallCount != 2 {
		t.Errorf("expected searchCallCount to be 2 (cache bypassed), got %d", searchCallCount)
	}
}
