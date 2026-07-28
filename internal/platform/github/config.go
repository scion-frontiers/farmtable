package github

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
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

// DefaultConfigPath is where Farm Table looks for the GitHub configuration
// when no explicit path is given.
//
// It is a constant rather than a literal at each call site because since B6
// this file decides which labels may feed an authorization answer, so "where
// the config lives" is itself a security parameter. Two call sites that
// disagreed about the path would put the CLI and the server on different
// configurations, and M-1 is the bug that arises when the server is reading a
// configuration the operator did not write.
const DefaultConfigPath = ".farmtable/github.yaml"

// ConfigSource records where a configuration actually came from.
//
// It exists because "the config loaded" and "the config the operator wrote
// loaded" are different statements, and until #194 round 8 nothing told them
// apart (review R-1). DefaultConfigPath is RELATIVE, so the answer depends on
// the process's working directory; LoadConfig returns the defaults for a
// missing file, deliberately, because that is how an operator says "I want the
// defaults"; and the result is indistinguishable from a server started from
// the wrong directory. Since B6 the push_prefix in that file decides which
// labels may feed an authorization answer, so the silent case is a silently
// disarmed control (M-1 disarmed again by CWD alone).
//
// The remedy is a diagnostic, not an error: making a missing file fatal would
// break every default deployment. A caller that logs this at startup makes the
// difference visible in one line.
type ConfigSource struct {
	// Path is the path as resolved, after any env-var override.
	Path string

	// AbsolutePath is Path made absolute against the process's working
	// directory. This is the field that answers R-1: a relative Path plus an
	// unexpected CWD is the whole failure mode, and only the absolute form
	// shows it.
	AbsolutePath string

	// FromEnv reports that FARMTABLE_GITHUB_CONFIG overrode the caller's path.
	FromEnv bool

	// Found reports that a file was actually read. False means the returned
	// config is DefaultConfig — which is a legitimate outcome and also exactly
	// what a wrong working directory looks like.
	Found bool
}

// EffectivePushPrefix is the prefix this configuration actually uses, after
// defaulting. It is the configured value only when that value is usable; see
// resolvePushPrefix. Worth logging alongside a ConfigSource, because the
// configured and effective values differing is itself the A-2 failure.
func (c *GitHubConfig) EffectivePushPrefix() string {
	return resolvePushPrefix(c.GitHub.Labels.PushPrefix)
}

// LoadConfig reads a GitHubConfig from the given YAML file path.
// If the file does not exist, it returns DefaultConfig with no error.
// The FARMTABLE_GITHUB_CONFIG env var overrides the path argument.
func LoadConfig(path string) (*GitHubConfig, error) {
	cfg, _, err := LoadConfigWithSource(path)
	return cfg, err
}

// LoadConfigWithSource is LoadConfig plus an account of where the result came
// from, for callers that report their configuration at startup.
func LoadConfigWithSource(path string) (*GitHubConfig, ConfigSource, error) {
	src := ConfigSource{Path: path}

	// Env var override.
	if envPath := os.Getenv("FARMTABLE_GITHUB_CONFIG"); envPath != "" {
		src.Path = envPath
		src.FromEnv = true
	}

	// Resolve for reporting only. A failure here must not stop the load: the
	// path still works relative to the CWD, and refusing to start because the
	// CWD could not be named would be a new failure mode in a diagnostic.
	if abs, absErr := filepath.Abs(src.Path); absErr == nil {
		src.AbsolutePath = abs
	} else {
		src.AbsolutePath = src.Path
	}

	data, err := os.ReadFile(src.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return DefaultConfig(), src, nil
		}
		return nil, src, fmt.Errorf("reading config %s: %w", src.AbsolutePath, err)
	}
	src.Found = true

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, src, fmt.Errorf("parsing config %s: %w", src.AbsolutePath, err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, src, fmt.Errorf("invalid config %s: %w", src.AbsolutePath, err)
	}

	return cfg, src, nil
}

// Describe renders a ConfigSource as a one-line startup diagnostic.
//
// The "not found" wording names the working directory explicitly rather than
// saying "using defaults", because an operator who wrote a config file and does
// not see it loaded needs to be told WHERE the server looked, not merely that
// it gave up.
func (s ConfigSource) Describe(cfg *GitHubConfig) string {
	origin := "path"
	if s.FromEnv {
		origin = "FARMTABLE_GITHUB_CONFIG"
	}

	if !s.Found {
		return fmt.Sprintf(
			"GitHub config: no file at %s (%s), using built-in defaults; "+
				"effective push_prefix %q. If you wrote a config file, the server is not "+
				"running from the directory you expect — %s is relative",
			s.AbsolutePath, origin, cfg.EffectivePushPrefix(), DefaultConfigPath)
	}

	msg := fmt.Sprintf("GitHub config: loaded %s (%s); effective push_prefix %q",
		s.AbsolutePath, origin, cfg.EffectivePushPrefix())
	if configured := cfg.GitHub.Labels.PushPrefix; configured != "" &&
		configured != cfg.EffectivePushPrefix() {
		msg += fmt.Sprintf(" (configured %q was not usable and was defaulted)", configured)
	}
	return msg
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

	if err := checkLifecycleKeyCollisions(labels); err != nil {
		return err
	}
	return nil
}

// checkLifecycleKeyCollisions rejects a priorities or types key that captures
// one of this deployment's own lifecycle labels.
//
// The check above runs once per table and never compares ACROSS tables, so
// nothing stopped a key in one table from claiming a label another table owns.
// The one that matters is the lifecycle table, because in this store the stage
// IS a label: `types: {duplicate: chore}` puts "duplicate" in labelToType, and
// TypeLabelSwap's remove loop keys on stripForMatch, which maps this
// deployment's own "ft:stage/duplicate" to "duplicate" — so any UpdateTask that
// sets a type deletes the issue's lifecycle label. That is a stage change at
// the price of task:write, which is the whole class #194 exists to close.
//
// THE ORACLE IS THE FUNCTIONS THEMSELVES, not a model of them. The label side
// is StageToLabel — what this deployment actually writes for a stage. The
// normalisation is stripForMatch, the identical expression PriorityLabelSwap
// and TypeLabelSwap use to decide a label is theirs to remove. Reimplementing
// either as "strip 'ft:stage/' and compare" is how the round-7 audit missed a
// Critical: a check that mirrors F must BE F.
//
// STATED HONESTLY: that choice is not measurable today. The hardcoded form is
// equivalent by construction, because StageToLabel writes pushPrefix +
// "stage/" + stage and stripForMatch strips exactly those, so no config
// separates them and a mutant using the literal prefix survives every test.
// The choice is structural — it stays correct if either function's spelling
// changes. TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday pins
// the equivalence so that the day it stops holding is a test failure and not a
// silent divergence.
//
// Scope is deliberately narrow. Only priorities and types are checked, and only
// against lifecycle labels:
//
//   - A priorities/types collision with EACH OTHER is a display ambiguity, not
//     a privilege one, and rejecting it would break configs that work today.
//   - The `stages` table is not checked, because an operator aliasing one stage
//     spelling onto another stage is the documented purpose of that table:
//     `stages: {duplicate: wont_fix}` is a deliberate remapping, not a capture.
//     checkAliasKeyCollisions already catches the case where two keys
//     contradict. MEASURED: adding the stages table here rejects that config
//     and a redundant `{completed: completed}` self-mapping, both of which load
//     today, which is why TestValidate_StillAcceptsLegitimateConfigs carries a
//     row for each.
//
// Note that item 3 of this round (assertStageWriteAllowed) also closes this,
// structurally, at writeLabelSwap. Both ship: this one tells the operator at
// startup which line of their YAML is wrong, and that one is the backstop for
// every route into the writer that does not pass through Validate.
//
// ── #194 round 9, MUST 5: the enabled toggle ──
//
// CONFIG VALIDATION DOES NOT RESPECT github.labels.enabled, and the two halves
// of the round-9 ruling resolve in OPPOSITE directions on purpose. Runtime
// authority does respect the toggle (see authorizationStage). This check must
// not, because config correctness must not depend on a flag that could flip
// later without anyone re-validating: "it is fine because the feature happens
// to be off today" is exactly the state-dependent correctness this workstream
// has spent the night removing.
//
// So the oracle is the mapper this config WOULD produce with labels enabled,
// built here rather than taken from the caller. That is still "the functions
// themselves" and not a model of them — it is the same StageToLabel and the
// same stripForMatch, asked under the configuration whose validity is in
// question. Taking the caller's mapper was the bug: at enabled=false
// StageToLabel returns "" for every stage, so `owned` collapsed onto a single
// empty key, `types: {duplicate: chore}` validated clean, and
// `types: {"": chore}` was REJECTED with a fabricated error naming stage
// "cancelled" — a stage the operator never mentioned, and only the last of the
// ten to win the collapsed key.
func checkLifecycleKeyCollisions(labels LabelConfig) error {
	asIfEnabled := labels
	asIfEnabled.Enabled = true
	m := NewLabelMapper(asIfEnabled)

	// The labels this deployment claims as lifecycle assertions, normalised the
	// way the swap functions normalise them.
	//
	// TWO SOURCES, because either one alone leaves a capture unrejected:
	//
	//   - StageToLabel over every stage is the WRITE side: what this deployment
	//     stamps on an issue.
	//   - m.labelToStage is the READ side: every key authorizationStage will
	//     honour, which includes the operator's own `stages` aliases. Its keys
	//     are already stripForMatch-normalised by NewLabelMapper. Without it,
	//     `stages: {shipped: completed}` + `types: {shipped: chore}` loaded
	//     clean and every type change deleted the issue's stage label — the
	//     original finding, wearing a configured alias instead of a stage name
	//     (review R4 / audit M-1).
	//
	// The write side is inserted first and is never overwritten, so a key both
	// sources claim reports the deployment's own stage rather than whichever
	// one Go's randomised map iteration reached last. `stages: {completed:
	// wont_fix}` is such a key, and a diagnostic that names a different stage
	// on each run is worse than no diagnostic.
	owned := make(map[string]task.Stage, len(allStages)+len(m.labelToStage))
	claim := func(key string, stage task.Stage) {
		// An EMPTY key claims nothing. stripForMatch maps both a missing config
		// key and a whitespace-only one to "", so without this an operator who
		// wrote `types: {"": chore}` would be told they had captured a lifecycle
		// label they never named. That is real (test review F-4) rather than
		// theoretical: it is what the old code did at enabled=false.
		if key == "" {
			return
		}
		if _, taken := owned[key]; !taken {
			owned[key] = stage
		}
	}
	for _, stage := range allStages {
		claim(m.stripForMatch(m.StageToLabel(stage)), stage)
	}
	for key, stage := range m.labelToStage {
		claim(key, stage)
	}

	for _, table := range []struct {
		field   string
		noun    string
		entries map[string]string
	}{
		{"priorities", "priority", labels.Priorities},
		{"types", "type", labels.Types},
	} {
		for _, key := range sortedKeys(table.entries) {
			stage, collides := owned[m.stripForMatch(key)]
			if !collides {
				continue
			}
			return fmt.Errorf(
				"github.labels.%s: key %q captures this deployment's own lifecycle label %q "+
					"(stage %q). In this store the stage IS a label, and label matching strips "+
					"the push prefix and any stage/ segment before comparing, so those two are "+
					"the same key. Every %s change would then delete the issue's stage label, "+
					"moving the task's lifecycle stage at the price of task:write and with no "+
					"transition scope charged. Rename the key",
				table.field, key, m.StageToLabel(stage), stage, table.noun)
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
