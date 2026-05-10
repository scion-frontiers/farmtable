package github

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadConfig_ValidYAML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")

	yaml := `github:
  owner: myorg
  repo: myrepo
  labels:
    enabled: true
    push_prefix: "custom:"
    auto_create_labels: false
    stages:
      doing: working
      reviewing: in_review
    priorities:
      p0: urgent
      p1: high
    types:
      enhancement: feature
`
	if err := os.WriteFile(path, []byte(yaml), 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if cfg.GitHub.Owner != "myorg" {
		t.Errorf("Owner = %q, want %q", cfg.GitHub.Owner, "myorg")
	}
	if cfg.GitHub.Repo != "myrepo" {
		t.Errorf("Repo = %q, want %q", cfg.GitHub.Repo, "myrepo")
	}
	if cfg.GitHub.Labels.PushPrefix != "custom:" {
		t.Errorf("PushPrefix = %q, want %q", cfg.GitHub.Labels.PushPrefix, "custom:")
	}
	if cfg.GitHub.Labels.AutoCreateLabels {
		t.Error("AutoCreateLabels = true, want false")
	}
	if cfg.GitHub.Labels.Stages["doing"] != "working" {
		t.Errorf("Stages[doing] = %q, want %q", cfg.GitHub.Labels.Stages["doing"], "working")
	}
	if cfg.GitHub.Labels.Priorities["p0"] != "urgent" {
		t.Errorf("Priorities[p0] = %q, want %q", cfg.GitHub.Labels.Priorities["p0"], "urgent")
	}
	if cfg.GitHub.Labels.Types["enhancement"] != "feature" {
		t.Errorf("Types[enhancement] = %q, want %q", cfg.GitHub.Labels.Types["enhancement"], "feature")
	}
}

func TestLoadConfig_MinimalConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")

	yaml := `github:
  owner: minorg
  repo: minrepo
`
	if err := os.WriteFile(path, []byte(yaml), 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if cfg.GitHub.Owner != "minorg" {
		t.Errorf("Owner = %q, want %q", cfg.GitHub.Owner, "minorg")
	}
	if cfg.GitHub.Repo != "minrepo" {
		t.Errorf("Repo = %q, want %q", cfg.GitHub.Repo, "minrepo")
	}
	// Defaults should still be applied via DefaultConfig base.
	if !cfg.GitHub.Labels.Enabled {
		t.Error("Labels.Enabled = false, want true (default)")
	}
	if cfg.GitHub.Labels.PushPrefix != "ft:" {
		t.Errorf("PushPrefix = %q, want %q (default)", cfg.GitHub.Labels.PushPrefix, "ft:")
	}
}

func TestLoadConfig_DisabledMode(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")

	yaml := `github:
  owner: org
  repo: repo
  labels:
    enabled: false
`
	if err := os.WriteFile(path, []byte(yaml), 0644); err != nil {
		t.Fatal(err)
	}

	cfg, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if cfg.GitHub.Labels.Enabled {
		t.Error("Labels.Enabled = true, want false")
	}
}

func TestLoadConfig_MissingFile(t *testing.T) {
	cfg, err := LoadConfig("/nonexistent/path/config.yaml")
	if err != nil {
		t.Fatalf("expected no error for missing file, got: %v", err)
	}

	// Should return defaults.
	if !cfg.GitHub.Labels.Enabled {
		t.Error("Enabled = false, want true (default)")
	}
	if cfg.GitHub.Labels.PushPrefix != "ft:" {
		t.Errorf("PushPrefix = %q, want %q", cfg.GitHub.Labels.PushPrefix, "ft:")
	}
	if !cfg.GitHub.Labels.AutoCreateLabels {
		t.Error("AutoCreateLabels = false, want true (default)")
	}
}

func TestLoadConfig_EnvVarOverride(t *testing.T) {
	dir := t.TempDir()
	envPath := filepath.Join(dir, "env-config.yaml")

	yaml := `github:
  owner: envorg
  repo: envrepo
`
	if err := os.WriteFile(envPath, []byte(yaml), 0644); err != nil {
		t.Fatal(err)
	}

	t.Setenv("FARMTABLE_GITHUB_CONFIG", envPath)

	// Pass a bogus path — env var should override.
	cfg, err := LoadConfig("/bogus/path.yaml")
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	if cfg.GitHub.Owner != "envorg" {
		t.Errorf("Owner = %q, want %q (from env override)", cfg.GitHub.Owner, "envorg")
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if !cfg.GitHub.Labels.Enabled {
		t.Error("Enabled = false, want true")
	}
	if cfg.GitHub.Labels.PushPrefix != "ft:" {
		t.Errorf("PushPrefix = %q, want %q", cfg.GitHub.Labels.PushPrefix, "ft:")
	}
	if !cfg.GitHub.Labels.AutoCreateLabels {
		t.Error("AutoCreateLabels = false, want true")
	}
	if cfg.GitHub.Labels.Stages == nil {
		t.Error("Stages map is nil, want initialized")
	}
	if cfg.GitHub.Labels.Priorities == nil {
		t.Error("Priorities map is nil, want initialized")
	}
	if cfg.GitHub.Labels.Types == nil {
		t.Error("Types map is nil, want initialized")
	}
	if cfg.GitHub.Owner != "" {
		t.Errorf("Owner = %q, want empty", cfg.GitHub.Owner)
	}
	if cfg.GitHub.Repo != "" {
		t.Errorf("Repo = %q, want empty", cfg.GitHub.Repo)
	}
}
