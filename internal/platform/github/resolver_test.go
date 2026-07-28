package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// ── #194 round 7 / M-1: the server binary must honour the operator's config ──
//
// NewPlatformResolver passed a hardcoded nil config to NewPassThroughStore, so
// every store the SERVER built ran DefaultConfig(). github.LoadConfig was
// reached from internal/cli/connect.go and from nowhere else in the binary, so
// a deployed server could not read the operator's file at all.
//
// Since B6 the configured push_prefix decides which labels may feed an
// authorization or terminal-stage answer. An operator running push_prefix:
// "acme:" therefore had the round-6 label-write gate silently disarmed: their
// acme-prefixed labels were not recognised as lifecycle labels at all, so every
// terminal-label edit read as "no transition" and cost nothing.
//
// WHY THIS TEST IS AT THIS LAYER. The service-level coverage already exists —
// TestTerminalStageInput_RequiresTheConfiguredPrefix in the server package runs
// seven prefix/label cells. But it builds its store by calling
// NewPassThroughStore directly with a config it constructed, which is exactly
// the step the resolver was getting wrong. It injects BELOW the defect and so
// could not see it, and it stayed green throughout. The wiring itself is the
// thing under test here.
//
// These cases need no network: the label mapper's answer is a pure function of
// the configuration and the task's labels, and LifecycleStages reads it without
// touching GitHub. That is deliberate — a resolver test that needed a transport
// would be testing the transport.

// TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore is the M-1
// regression. It fails against a resolver that hardcodes nil.
func TestNewPlatformResolver_ThreadsTheConfiguredPrefixIntoTheStore(t *testing.T) {
	const customPrefix = "acme:"

	cases := []struct {
		name         string
		cfg          *GitHubConfig
		label        string
		wantTerminal bool
		why          string
	}{
		{
			name:         "custom_prefix_honours_the_operators_label",
			cfg:          configWithPrefix(customPrefix),
			label:        customPrefix + "stage/completed",
			wantTerminal: true,
			why: "this is M-1 itself: with a hardcoded nil config the store runs DefaultConfig, " +
				"the operator's own terminal label is not recognised as a lifecycle label, " +
				"and every edit to it reads as 'no transition' and is charged nothing",
		},
		{
			name:         "custom_prefix_rejects_the_default_spelling",
			cfg:          configWithPrefix(customPrefix),
			label:        "ft:stage/completed",
			wantTerminal: false,
			why: "the negative half. Without it the row above would also pass against a store " +
				"that treated EVERY stage-shaped label as terminal regardless of configuration",
		},
		{
			name:         "default_config_honours_the_default_spelling",
			cfg:          DefaultConfig(),
			label:        "ft:stage/completed",
			wantTerminal: true,
			why:          "positive control: the assertion can report terminal at all",
		},
		{
			name:         "default_config_rejects_a_custom_spelling",
			cfg:          DefaultConfig(),
			label:        customPrefix + "stage/completed",
			wantTerminal: false,
			why:          "the control's mirror: the assertion can report NOT terminal at all",
		},
		{
			name:         "nil_config_still_means_the_defaults",
			cfg:          nil,
			label:        "ft:stage/completed",
			wantTerminal: true,
			why: "nil is now something a caller asks for rather than the only option, and it " +
				"must keep meaning DefaultConfig rather than an empty config that matches nothing",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stager := resolveStager(t, tc.cfg)

			stages := stager.LifecycleStages(context.Background(), &ent.Task{
				Stage:  task.StageAccepted,
				Labels: []string{tc.label},
			})

			// The contract says never empty. An empty answer here would make
			// the terminal assertion below vacuous rather than false.
			if len(stages) == 0 {
				t.Fatalf("LifecycleStages returned an empty set for label %q, "+
					"which its contract forbids", tc.label)
			}

			gotTerminal := false
			for _, s := range stages {
				if store.IsTerminalStage(s) {
					gotTerminal = true
				}
			}
			if gotTerminal != tc.wantTerminal {
				t.Fatalf("label %q through the resolver: stages %v (terminal=%v), want "+
					"terminal=%v. %s", tc.label, stages, gotTerminal, tc.wantTerminal, tc.why)
			}
		})
	}
}

// TestNewPlatformResolver_DeclinesNonGitHubPlatforms pins the pre-existing
// fall-through, which the signature change must not disturb. A resolver that
// started claiming every platform would route native collections into a store
// that proxies to GitHub.
func TestNewPlatformResolver_DeclinesNonGitHubPlatforms(t *testing.T) {
	resolver := NewPlatformResolver(DefaultConfig())

	got, err := resolver(collection.PlatformFarmtable, "tok", "acme/widgets", uuid.New())
	if err != nil {
		t.Fatalf("resolving a farmtable collection: %v", err)
	}
	if got != nil {
		t.Fatalf("resolver claimed the farmtable platform (%T); it must return nil so the "+
			"primary store handles it", got)
	}
}

// TestNewPlatformResolver_RejectsAMalformedRemoteID pins the other
// pre-existing arm, so that "returns an error" cannot silently become "returns
// a store bound to the empty repository".
func TestNewPlatformResolver_RejectsAMalformedRemoteID(t *testing.T) {
	resolver := NewPlatformResolver(DefaultConfig())

	got, err := resolver(collection.PlatformGithub, "tok", "not-an-owner-repo", uuid.New())
	if err == nil {
		t.Fatalf("a malformed RemoteID resolved to %T, want an error", got)
	}
	if got != nil {
		t.Fatalf("resolver returned both a store (%T) and an error", got)
	}
}

// resolveStager runs the REAL resolver and returns the resulting store as the
// interface the authorization gate reaches it through.
//
// It goes through NewPlatformResolver rather than NewPassThroughStore because
// the resolver is the unit under test; constructing the store directly is the
// shortcut that let M-1 survive a prefix suite that already had seven cells.
func resolveStager(t *testing.T, cfg *GitHubConfig) store.LifecycleStageSetStager {
	t.Helper()

	resolver := NewPlatformResolver(cfg)
	resolved, err := resolver(collection.PlatformGithub, "tok", "acme/widgets", uuid.New())
	if err != nil {
		t.Fatalf("resolver returned an error for a well-formed github collection: %v", err)
	}
	if resolved == nil {
		t.Fatal("resolver declined a github collection; it must build a pass-through store")
	}

	stager, ok := resolved.(store.LifecycleStageSetStager)
	if !ok {
		t.Fatalf("resolved store %T does not implement LifecycleStageSetStager, so the "+
			"authorization gate would fall back to the single-stage reader", resolved)
	}
	return stager
}

// configWithPrefix is DefaultConfig with the push prefix replaced, which is how
// an operator customising their labels differs from the shipped default.
func configWithPrefix(prefix string) *GitHubConfig {
	cfg := DefaultConfig()
	cfg.GitHub.Labels.PushPrefix = prefix
	return cfg
}
