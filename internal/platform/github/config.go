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

	// Alias-key collisions. This check exists because of a cost the round-6 A3
	// fix introduced, found by measuring rather than by review, and it is placed
	// AFTER the push_prefix check because the normalisation below depends on the
	// prefix being usable.
	//
	// A3 normalises configured alias keys through stripForMatch so that a key
	// works whether or not the operator spelled the prefix. stripForMatch is
	// many-to-one, so that also merged the key space: "shipped", "ft:shipped"
	// and "ft:stage/shipped" were three keys before A3 and are one afterwards.
	// Where they name the same value that is a harmless dedup and is allowed.
	// Where they name DIFFERENT values, one alias is silently discarded — and
	// pre-A3 the outcome was at least deterministic, because only the unprefixed
	// key was ever reachable. Trading a dead alias for a coin flip at an
	// authorization gate is not an improvement, so the config is rejected
	// instead. TestAliasKeyNormalisation_CollapsesDistinctKeys measures both
	// halves.
	labels := c.GitHub.Labels
	m := NewLabelMapper(labels)
	for _, table := range []struct {
		field   string
		entries map[string]string
	}{
		{"stages", labels.Stages},
		{"priorities", labels.Priorities},
		{"types", labels.Types},
	} {
		if err := checkAliasKeyCollisions(m, table.field, table.entries); err != nil {
			return err
		}
	}
	return nil
}

// checkAliasKeyCollisions reports configured keys that normalise to the same
// lookup key while naming different values.
//
// Keys are visited in sorted order so that the pair named in the error is the
// same pair on every run: a diagnostic that names a different key each time an
// operator re-runs the command is worse than no diagnostic.
func checkAliasKeyCollisions(m *LabelMapper, field string, entries map[string]string) error {
	type origin struct{ key, value string }

	seen := make(map[string]origin, len(entries))
	for _, key := range sortedKeys(entries) {
		normalised := m.stripForMatch(key)
		value := entries[key]

		if prev, ok := seen[normalised]; ok {
			if prev.value == value {
				continue
			}
			return fmt.Errorf(
				"github.labels.%s: keys %q and %q both normalise to %q but name "+
					"different values (%q and %q). Since #194 an alias key is matched "+
					"with the push prefix and any stage/ or priority: segment removed, "+
					"so those two keys are one entry and only one of the values can "+
					"survive. Spell the intended alias once",
				field, prev.key, key, normalised, prev.value, value)
		}
		seen[normalised] = origin{key: key, value: value}
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
