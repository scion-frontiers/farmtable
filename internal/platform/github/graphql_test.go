package github

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	githubv4 "github.com/shurcooL/githubv4"
)

func TestNewGraphQLClient(t *testing.T) {
	client := newGraphQLClient("test-token", "acme", "repo", &GitHubConfig{})

	if client == nil {
		t.Fatal("newGraphQLClient returned nil")
	}
	if client.v4 == nil {
		t.Error("v4 client is nil")
	}
	if client.owner != "acme" {
		t.Errorf("owner = %q, want %q", client.owner, "acme")
	}
	if client.repo != "repo" {
		t.Errorf("repo = %q, want %q", client.repo, "repo")
	}
	if client.config == nil {
		t.Error("config is nil")
	}
}

func TestNewWithConfig_WithConfig(t *testing.T) {
	cfg := &GitHubConfig{}
	adapter := NewWithConfig("test-token", "acme", "repo", nil, cfg)

	if adapter.gql == nil {
		t.Error("gql is nil, want non-nil when config is provided")
	}
	if adapter.config == nil {
		t.Error("config is nil, want non-nil when config is provided")
	}
}

func TestNewWithConfig_NilConfig(t *testing.T) {
	adapter := NewWithConfig("test-token", "acme", "repo", nil, nil)

	if adapter.gql != nil {
		t.Error("gql is non-nil, want nil when config is nil")
	}
	if adapter.config != nil {
		t.Error("config is non-nil, want nil when config is nil")
	}
}

func TestGraphQLClient_AddAndRemoveSubIssue(t *testing.T) {
	var requests []string
	client := testGraphQLClient(t, func(w http.ResponseWriter, r *http.Request) {
		body := mustReadBody(t, r.Body)
		requests = append(requests, body)
		w.Header().Set("Content-Type", "application/json")

		switch {
		case strings.Contains(body, "addSubIssue"):
			_, _ = w.Write([]byte(`{"data":{"addSubIssue":{"issue":{"id":"PARENT","number":1,"title":"Parent","body":"","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/1"},"subIssue":{"id":"CHILD","number":2,"title":"Child","body":"","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/2"}}}}`))
		case strings.Contains(body, "removeSubIssue"):
			_, _ = w.Write([]byte(`{"data":{"removeSubIssue":{"issue":{"id":"PARENT","number":1,"title":"Parent","body":"","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/1"},"subIssue":{"id":"CHILD","number":2,"title":"Child","body":"","state":"OPEN","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","url":"https://example.test/2"}}}}`))
		default:
			t.Fatalf("unexpected GraphQL request: %s", body)
		}
	})

	if err := client.addSubIssue(context.Background(), githubv4.ID("PARENT"), githubv4.ID("CHILD")); err != nil {
		t.Fatalf("addSubIssue returned error: %v", err)
	}
	if err := client.removeSubIssue(context.Background(), githubv4.ID("PARENT"), githubv4.ID("CHILD")); err != nil {
		t.Fatalf("removeSubIssue returned error: %v", err)
	}

	if len(requests) != 2 {
		t.Fatalf("got %d requests, want 2", len(requests))
	}
	for _, request := range requests {
		if !strings.Contains(request, `"issueId":"PARENT"`) || !strings.Contains(request, `"subIssueId":"CHILD"`) {
			t.Errorf("sub-issue variables missing parent/child IDs: %s", request)
		}
	}
}

func testGraphQLClient(t *testing.T, handler http.HandlerFunc) *graphqlClient {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return &graphqlClient{
		v4:     githubv4.NewEnterpriseClient(server.URL, server.Client()),
		owner:  "acme",
		repo:   "repo",
		config: DefaultConfig(),
	}
}

func mustReadBody(t *testing.T, r io.Reader) string {
	t.Helper()
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("reading request body: %v", err)
	}
	return string(data)
}
