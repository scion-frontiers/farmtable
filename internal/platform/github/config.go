package github

import (
	"fmt"
	"os"
	"strings"

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

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config %s: %w", path, err)
	}

	return cfg, nil
}

// Validate rejects configurations that would silently disarm a control.
//
// Since #194 B6, push_prefix is a security parameter: a label may feed an
// authorization or terminal-stage determination only if it carries this
// prefix. resolvePushPrefix already falls back to the default rather than
// using an unusable prefix, so a whitespace-only value can no longer disarm
// anything — but silently substituting a value the operator did not write is
// still the wrong answer for a security parameter. Failing loud at startup
// beats falling back quietly, which beats the round-5 behaviour of silently
// disabling B1, B5 and B6 together (audit A-2).
//
// An EMPTY push_prefix is explicitly NOT an error: it is the documented
// spelling of "use the default", and DefaultConfig itself relies on the field
// being unset in a config file that omits it.
func (c *GitHubConfig) Validate() error {
	if raw := c.GitHub.Labels.PushPrefix; raw != "" && strings.TrimSpace(raw) == "" {
		return fmt.Errorf(
			"github.labels.push_prefix is %q: a whitespace-only prefix can never match a label, "+
				"because label matching trims whitespace before comparing. "+
				"Use a non-blank prefix such as %q, or omit the field to use the default",
			raw, defaultPushPrefix)
	}
	return nil
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
