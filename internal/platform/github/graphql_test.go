package github

import (
	"testing"
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
