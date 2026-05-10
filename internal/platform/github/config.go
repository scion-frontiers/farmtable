package github

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// GitHubConfig holds configuration for the GitHub integration, including
// repository coordinates and label mapping rules.
type GitHubConfig struct {
	GitHub struct {
		Owner  string      `yaml:"owner"`
		Repo   string      `yaml:"repo"`
		Labels LabelConfig `yaml:"labels"`
	} `yaml:"github"`
}

// LabelConfig controls how Farm Table maps labels to/from GitHub.
type LabelConfig struct {
	// Enabled turns label mapping on or off. Default true.
	Enabled bool `yaml:"enabled"`

	// Stages maps a label name to a Farm Table stage value.
	// Example: "doing": "working"
	Stages map[string]string `yaml:"stages"`

	// Priorities maps a label name to a Farm Table priority value.
	// Example: "p0": "urgent"
	Priorities map[string]string `yaml:"priorities"`

	// Types maps a label name to a Farm Table task type.
	// Example: "enhancement": "feature"
	Types map[string]string `yaml:"types"`

	// PushPrefix is prepended to auto-generated labels when pushing to GitHub.
	// Default "ft:".
	PushPrefix string `yaml:"push_prefix"`

	// AutoCreateLabels controls whether missing labels are created on GitHub
	// during push. Default true.
	AutoCreateLabels bool `yaml:"auto_create_labels"`
}

// LoadConfig reads a GitHubConfig from the given YAML file path.
// If the file does not exist, it returns DefaultConfig with no error.
// The FARMTABLE_GITHUB_CONFIG env var overrides the path argument.
func LoadConfig(path string) (*GitHubConfig, error) {
	// Env var override.
	if envPath := os.Getenv("FARMTABLE_GITHUB_CONFIG"); envPath != "" {
		path = envPath
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			cfg := DefaultConfig()
			return cfg, nil
		}
		return nil, fmt.Errorf("reading config %s: %w", path, err)
	}

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parsing config %s: %w", path, err)
	}

	return cfg, nil
}

// DefaultConfig returns a GitHubConfig with sensible defaults:
// labels enabled, push prefix "ft:", auto-create on, empty custom maps.
func DefaultConfig() *GitHubConfig {
	cfg := &GitHubConfig{}
	cfg.GitHub.Labels = LabelConfig{
		Enabled:          true,
		Stages:           make(map[string]string),
		Priorities:       make(map[string]string),
		Types:            make(map[string]string),
		PushPrefix:       "ft:",
		AutoCreateLabels: true,
	}
	return cfg
}
