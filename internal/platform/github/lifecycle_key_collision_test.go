package github

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// ── #194 round 8, item 6: cross-table config key collisions ──
//
// Validate ran checkAliasKeyCollisions once per table and never compared keys
// ACROSS stages/priorities/types. `types: {duplicate: chore}` therefore loaded
// clean, put "duplicate" in labelToType, and made every type change delete the
// issue's ft:stage/duplicate label — a lifecycle move charged as task:write.
//
// MERGE GATE (stated because the brief required it): this validation is
// meaningless unless operator config actually reaches the server store, which
// is M-1. M-1 is in this branch's history at 0570824, so the gate is satisfied
// and this is not shipping ahead of the thing that makes it load-bearing.
//
// This file measures the config layer. Item 3's assertStageWriteAllowed closes
// the same hole structurally at writeLabelSwap and is measured in
// stage_write_policy_test.go; the two are deliberately independent, so a
// regression in either is caught by the other's tests as well as its own.

// TestValidate_RejectsAPrioritiesOrTypesKeyThatCapturesALifecycleLabel is the
// core assertion. Every row is a config that loads clean before this change.
func TestValidate_RejectsAPrioritiesOrTypesKeyThatCapturesALifecycleLabel(t *testing.T) {
	rows := []struct {
		name       string
		mutate     func(*LabelConfig)
		wantInText string
	}{
		{
			// The audit's measured case, verbatim.
			name:       "types key is a bare terminal stage name",
			mutate:     func(c *LabelConfig) { c.Types = map[string]string{"duplicate": "chore"} },
			wantInText: "duplicate",
		},
		{
			name:       "types key is the fully prefixed lifecycle label",
			mutate:     func(c *LabelConfig) { c.Types = map[string]string{"ft:stage/wont_fix": "chore"} },
			wantInText: "wont_fix",
		},
		{
			// stripForMatch lowercases and trims, so neither dodges the check.
			name:       "types key differs only by case and padding",
			mutate:     func(c *LabelConfig) { c.Types = map[string]string{"  Duplicate  ": "chore"} },
			wantInText: "duplicate",
		},
		{
			name:       "priorities key is a lifecycle stage name",
			mutate:     func(c *LabelConfig) { c.Priorities = map[string]string{"completed": "high"} },
			wantInText: "completed",
		},
		{
			// A non-terminal stage is just as capturable; the finding was
			// demonstrated on a terminal one but is not limited to those.
			name:       "types key is a non-terminal stage",
			mutate:     func(c *LabelConfig) { c.Types = map[string]string{"in_review": "chore"} },
			wantInText: "in_review",
		},
		{
			// The check must follow the CONFIGURED prefix, not a hardcoded
			// "ft:". Under prefix "acme:" the deployment writes
			// acme:stage/duplicate, so "duplicate" still captures it.
			name: "custom push prefix",
			mutate: func(c *LabelConfig) {
				c.PushPrefix = "acme:"
				c.Types = map[string]string{"duplicate": "chore"}
			},
			wantInText: "acme:stage/duplicate",
		},
		{
			// #194 round 9, MUST 5 (review R4 / audit M-1). The capture does
			// not need to be spelled as a stage NAME. An operator's own
			// `stages` alias makes "shipped" an authoritative lifecycle
			// spelling — authorizationStage honours ft:shipped — so a types
			// key of "shipped" captures it exactly as "completed" would.
			// Before this round `owned` was built from StageToLabel alone and
			// this config loaded clean.
			name: "types key is the operator's own stage alias",
			mutate: func(c *LabelConfig) {
				c.Stages = map[string]string{"shipped": "completed"}
				c.Types = map[string]string{"shipped": "chore"}
			},
			wantInText: "shipped",
		},
		{
			name: "priorities key is the operator's own stage alias",
			mutate: func(c *LabelConfig) {
				c.Stages = map[string]string{"shipped": "completed"}
				c.Priorities = map[string]string{"shipped": "high"}
			},
			wantInText: "shipped",
		},
		{
			// A stages entry that REMAPS one lifecycle spelling onto another
			// stage is legitimate on its own (see the control below), but it
			// does not stop the key being a lifecycle label — so pairing it
			// with a types key of the same name is still a capture.
			name: "types key matches a remapped stage spelling",
			mutate: func(c *LabelConfig) {
				c.Stages = map[string]string{"completed": "wont_fix"}
				c.Types = map[string]string{"completed": "chore"}
			},
			wantInText: "completed",
		},
	}

	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			cfg := DefaultConfig()
			row.mutate(&cfg.GitHub.Labels)

			// PREREQUISITE: the config must be one the OLD single-table check
			// let through, or this row is measuring checkAliasKeyCollisions
			// rather than the new cross-table one.
			m := NewLabelMapper(cfg.GitHub.Labels)
			for field, entries := range map[string]map[string]string{
				"stages":     cfg.GitHub.Labels.Stages,
				"priorities": cfg.GitHub.Labels.Priorities,
				"types":      cfg.GitHub.Labels.Types,
			} {
				if err := checkAliasKeyCollisions(m, field, entries); err != nil {
					t.Fatalf("PREREQUISITE BROKEN: the pre-existing same-table check already "+
						"rejects this config (%v), so this row cannot measure the cross-table "+
						"check it was written for", err)
				}
			}

			err := cfg.Validate()
			if err == nil {
				t.Fatalf("Validate() = nil for a config whose key captures a lifecycle label.\n\n" +
					"This config loads, and then every priority/type change on any issue in the " +
					"repo deletes the stage label — a lifecycle move at the price of task:write.")
			}
			if !strings.Contains(err.Error(), row.wantInText) {
				t.Errorf("error does not mention %q, so it does not tell the operator which "+
					"line of their YAML is wrong: %v", row.wantInText, err)
			}
		})
	}
}

// TestValidate_StillAcceptsLegitimateConfigs is the positive control, and it is
// doing real work: the naive version of this check ("reject any key that
// stripForMatch-es to something in labelToStage") also rejects the stages table
// itself, and a version keyed on the bare stage vocabulary rather than on
// StageToLabel rejects ordinary type names that happen to resemble one.
func TestValidate_StillAcceptsLegitimateConfigs(t *testing.T) {
	rows := []struct {
		name   string
		mutate func(*LabelConfig)
	}{
		{"untouched default", func(c *LabelConfig) {}},
		{
			"ordinary priorities and types",
			func(c *LabelConfig) {
				c.Priorities = map[string]string{"p0": "urgent", "p1": "high"}
				c.Types = map[string]string{"enhancement": "feature", "defect": "bug"}
			},
		},
		{
			// The stages table's whole purpose is to alias a spelling onto a
			// stage. It must not be caught by a check aimed at the others.
			"stage aliases, which are the documented use of that table",
			func(c *LabelConfig) {
				c.Stages = map[string]string{"doing": "working", "shipped": "completed"}
			},
		},
		{
			// Same-table dedup: two spellings naming the SAME value are
			// explicitly allowed by checkAliasKeyCollisions and must stay so.
			"redundant but consistent stage aliases",
			func(c *LabelConfig) {
				c.Stages = map[string]string{"shipped": "completed", "ft:shipped": "completed"}
			},
		},
		{
			// ADDED AFTER MEASURING (#194 r8): the two rows above did not
			// actually pin the stages-table exemption. Their keys ("doing",
			// "shipped") do not normalise onto any stage, so a mutant that
			// added the stages table to checkLifecycleKeyCollisions SURVIVED
			// them. These rows are the ones that make the exemption load-
			// bearing, and they are legitimate configs: a redundant self-
			// mapping is harmless, and remapping one lifecycle spelling to a
			// different stage is precisely what the stages table is for.
			// checkAliasKeyCollisions permits both today.
			"a stages key that IS a stage name",
			func(c *LabelConfig) {
				c.Stages = map[string]string{"completed": "completed", "duplicate": "wont_fix"}
			},
		},
		{
			// #194 round 9, MUST 5 (test review F-4). An EMPTY key claims
			// nothing. Before this round, at enabled=false StageToLabel
			// returned "" for every stage, `owned` collapsed onto one empty
			// key, and this config was rejected with a fabricated error naming
			// stage "cancelled" — the last of the ten to win the collapsed key,
			// and a stage the operator never mentioned.
			"an empty types key",
			func(c *LabelConfig) { c.Types = map[string]string{"": "chore"} },
		},
		{
			// stripForMatch trims, so a whitespace-only key normalises to ""
			// as well and must be treated the same way.
			"a whitespace-only priorities key",
			func(c *LabelConfig) { c.Priorities = map[string]string{"   ": "high"} },
		},
		{
			// The same on both sides. Neither claims anything, so neither
			// captures the other.
			"empty keys in the stages and types tables at once",
			func(c *LabelConfig) {
				c.Stages = map[string]string{"": "completed"}
				c.Types = map[string]string{"": "chore"}
			},
		},
		{
			// A stages alias is a capture only when a priorities or types key
			// names the SAME thing. On its own it is the documented use of the
			// table and must keep loading, or MUST 5's widening would have
			// broken every deployment that uses stage aliases at all.
			"a stage alias with unrelated priorities and types",
			func(c *LabelConfig) {
				c.Stages = map[string]string{"shipped": "completed"}
				c.Types = map[string]string{"enhancement": "feature"}
				c.Priorities = map[string]string{"p0": "urgent"}
			},
		},
		{
			// A type whose name merely CONTAINS a stage word is fine; only an
			// exact normalised match captures the label.
			"type names that resemble a stage without matching it",
			func(c *LabelConfig) {
				c.Types = map[string]string{
					"duplicate-report": "chore",
					"work":             "chore",
					"reviewed":         "chore",
				}
			},
		},
	}

	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			cfg := DefaultConfig()
			row.mutate(&cfg.GitHub.Labels)
			if err := cfg.Validate(); err != nil {
				t.Fatalf("CONTROL BROKEN: Validate() rejected a legitimate config: %v", err)
			}
		})
	}
}

// TestValidate_LifecycleKeyCollisionIgnoresTheEnabledToggle is the round-9
// ruling stated as an assertion (#194 r9, MUST 5).
//
// The two halves of that ruling resolve in OPPOSITE directions and getting them
// backwards is the main risk, so both are pinned, in different files. RUNTIME
// AUTHORITY respects github.labels.enabled — TestAuthorizationStage_IsSilentWhen
// LabelMappingIsOff. CONFIG VALIDATION does not, which is this test: config
// correctness must not depend on a toggle that could flip later without anyone
// re-validating. "It is fine because the feature happens to be off today" is
// state-dependent correctness, and an operator who flips enabled to true does
// not re-run Validate against the config they wrote a year ago.
//
// It compares the two toggle settings against EACH OTHER rather than against a
// literal verdict per row. A row that hardcoded "want: rejected" would re-state
// the rule it is checking; comparing the two settings has no such shared source,
// and any future code that consults m.enabled from this path makes them differ.
func TestValidate_LifecycleKeyCollisionIgnoresTheEnabledToggle(t *testing.T) {
	rows := []struct {
		name   string
		mutate func(*LabelConfig)
	}{
		{"ordinary priorities and types", func(c *LabelConfig) {
			c.Priorities = map[string]string{"p0": "urgent"}
			c.Types = map[string]string{"enhancement": "feature"}
		}},
		{"a types key that is a bare stage name", func(c *LabelConfig) {
			c.Types = map[string]string{"duplicate": "chore"}
		}},
		{"a priorities key that is a bare stage name", func(c *LabelConfig) {
			c.Priorities = map[string]string{"completed": "high"}
		}},
		{"a types key that is the operator's stage alias", func(c *LabelConfig) {
			c.Stages = map[string]string{"shipped": "completed"}
			c.Types = map[string]string{"shipped": "chore"}
		}},
		{"an empty types key", func(c *LabelConfig) {
			c.Types = map[string]string{"": "chore"}
		}},
		{"a stage alias with no colliding key", func(c *LabelConfig) {
			c.Stages = map[string]string{"shipped": "completed"}
			c.Types = map[string]string{"other": "chore"}
		}},
	}

	// A row that agreed because BOTH settings accept everything would prove
	// nothing, so at least one row has to be a rejection under both.
	rejections := 0

	for _, row := range rows {
		t.Run(row.name, func(t *testing.T) {
			verdict := func(enabled bool) error {
				cfg := DefaultConfig()
				cfg.GitHub.Labels.Enabled = enabled
				row.mutate(&cfg.GitHub.Labels)
				return cfg.Validate()
			}
			on, off := verdict(true), verdict(false)

			switch {
			case (on == nil) != (off == nil):
				t.Fatalf("github.labels.enabled changed the verdict.\n"+
					"  enabled=true  -> %v\n  enabled=false -> %v\n\n"+
					"Config validation must not depend on the toggle. An operator who flips "+
					"enabled to true later does not re-run Validate, so a config accepted "+
					"while the feature was off becomes a live capture the moment it is "+
					"switched on.", on, off)
			case on != nil && on.Error() != off.Error():
				t.Fatalf("both settings reject but with DIFFERENT diagnostics, so one of them "+
					"is describing a config the operator did not write.\n"+
					"  enabled=true  -> %v\n  enabled=false -> %v", on, off)
			}
			if on != nil {
				rejections++
			}
		})
	}

	if rejections == 0 {
		t.Fatal("VACUOUS: no row was rejected under either setting, so the rows agree only " +
			"because nothing was checked")
	}
}

// TestLifecycleKeyCollision_AStageAliasIsAlsoALifecycleLabel measures the HARM
// behind the round-9 widening, for the same reason
// TestLifecycleKeyCollision_IsTheHarmTheCheckClaims does below: a validation
// rule justified only by its own error message is a rule nobody can check.
//
// The widened check refuses `stages: {shipped: completed}` next to
// `types: {shipped: chore}`, and that config loaded clean before round 9. This
// shows what it bought.
func TestLifecycleKeyCollision_AStageAliasIsAlsoALifecycleLabel(t *testing.T) {
	labels := DefaultConfig().GitHub.Labels
	labels.Stages = map[string]string{"shipped": "completed"}
	labels.Types = map[string]string{"shipped": "chore"}

	rejected := DefaultConfig()
	rejected.GitHub.Labels = labels
	if err := rejected.Validate(); err == nil {
		t.Fatal("PREREQUISITE BROKEN: this is supposed to be the rejected config")
	}

	m := NewLabelMapper(labels)

	// The alias really is authoritative: this is what makes deleting it a
	// privilege change rather than label hygiene.
	if stage, ours := m.authorizationStage("ft:shipped"); !ours || stage != task.StageCompleted {
		t.Fatalf("authorizationStage(ft:shipped) = (%q, %v), want (completed, true). "+
			"If the alias is not authoritative then destroying it is not a lifecycle move "+
			"and this whole row is misfiled", stage, ours)
	}

	// And a plain type change destroys it.
	_, remove := m.TypeLabelSwap([]string{"ft:shipped", "bug"}, "chore")
	if !containsString(remove, "ft:shipped") {
		t.Fatalf("remove = %v: a type change was supposed to delete the aliased lifecycle "+
			"label. If it no longer does, the widening needs re-justifying rather than "+
			"just re-running", remove)
	}
}

// TestLifecycleKeyCollision_DiagnosticNamesTheDeploymentsOwnStage pins what the
// round-9 merge could have got wrong quietly.
//
// `owned` is now built from two sources and a key can be claimed by both.
// `stages: {completed: wont_fix}` is such a key: the WRITE side calls it
// completed (that is the label this deployment stamps) and the READ side calls
// it wont_fix (that is what the operator's alias remaps it to). The merge
// inserts the write side first and refuses to overwrite, so the operator is
// told about the label their deployment actually writes.
//
// TWO CLAIMS, and only one of them is load-bearing today — said plainly because
// reporting a green control as a kill is how this project has produced fourteen
// confidently wrong harnesses:
//
//   - WHICH stage is named. This one bites: drop the "do not overwrite" rule
//     and the diagnostic starts naming wont_fix, a stage that is not what
//     ft:stage/completed means to this deployment.
//   - THAT it is the same on every run. This one is a GREEN CONTROL. Map keys
//     are unique within each source and the merge is order-independent either
//     way, so no iteration order can change the answer. It is here because
//     round 6 shipped exactly that defect once (500 mappers, one unchanged
//     config, two different authorization answers at 60/440) and the second
//     source added here is a map.
func TestLifecycleKeyCollision_DiagnosticNamesTheDeploymentsOwnStage(t *testing.T) {
	labels := DefaultConfig().GitHub.Labels
	labels.Stages = map[string]string{"completed": "wont_fix"}
	labels.Types = map[string]string{"completed": "chore"}

	seen := make(map[string]int)
	for i := 0; i < 200; i++ {
		cfg := DefaultConfig()
		cfg.GitHub.Labels = labels
		err := cfg.Validate()
		if err == nil {
			t.Fatal("PREREQUISITE BROKEN: this config is supposed to be rejected")
		}
		seen[err.Error()]++
	}
	if len(seen) != 1 {
		t.Fatalf("200 runs of one unchanged config produced %d distinct diagnostics: %v\n\n"+
			"An operator re-running the command must not be told a different stage each "+
			"time. Insert the StageToLabel-derived keys first and do not let the "+
			"labelToStage pass overwrite them.", len(seen), seen)
	}

	var only string
	for msg := range seen {
		only = msg
	}
	if !strings.Contains(only, `lifecycle label "ft:stage/completed" (stage "completed")`) {
		t.Fatalf("diagnostic names the wrong side of the collision:\n  %s\n\n"+
			"The key ft:stage/completed is what THIS DEPLOYMENT writes for stage completed, "+
			"and that is the label the operator's types key destroys. Naming wont_fix — what "+
			"their stages alias remaps the spelling to — sends them to the wrong YAML line.",
			only)
	}
}

// TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday records an
// honest limit of the tests above, and pins the condition that limit rests on.
//
// checkLifecycleKeyCollisions builds its key set as
// stripForMatch(StageToLabel(stage)) — the functions themselves rather than a
// model of them. MEASURED (#194 r8): replacing that with a hardcoded
// "strip ft:stage/ and lowercase" SURVIVES every test in this file, including
// the custom-push-prefix row. That row only pins the error MESSAGE, which calls
// StageToLabel separately.
//
// It survives because the two forms are equivalent by construction today:
// StageToLabel writes pushPrefix + "stage/" + stage, and stripForMatch removes
// exactly those two segments, so the round trip is the bare lowercased stage
// name for every prefix. There is no config that separates them, so no test
// can. Reporting a mutation-matrix row as killed when it is not is how this
// project has produced fourteen confidently wrong harnesses.
//
// What CAN be pinned is the equivalence itself. If either function's spelling
// changes so that the round trip stops being the bare stage name, the derived
// form stays correct and the hardcoded form silently stops matching — so this
// test failing is the signal that the structural choice has become a
// measurable one, and that anyone who "simplified" it back has broken the check.
func TestLifecycleKeyCollision_OracleIsStructurallyEquivalentToday(t *testing.T) {
	for _, prefix := range []string{"", "ft:", "acme:", "x"} {
		labels := DefaultConfig().GitHub.Labels
		labels.PushPrefix = prefix
		m := NewLabelMapper(labels)

		for _, stage := range allStages {
			got := m.stripForMatch(m.StageToLabel(stage))
			want := strings.ToLower(string(stage))
			if got != want {
				t.Errorf("push_prefix %q, stage %s: stripForMatch(StageToLabel(...)) = %q, "+
					"want the bare stage name %q.\n\n"+
					"The round trip that made the derived and hardcoded forms of "+
					"checkLifecycleKeyCollisions equivalent no longer holds. The derived form "+
					"— the one in the tree — is the correct one. Do not replace it with a "+
					"literal prefix; do add a test row that now distinguishes them.",
					prefix, stage, got, want)
			}
		}
	}
}

// TestLoadConfig_RejectsALifecycleCapturingKey drives the real entry point.
// Validate being right is worth nothing if the loader does not call it, and
// LoadConfig is the only path an operator's file travels.
func TestLoadConfig_RejectsALifecycleCapturingKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "github.yaml")
	body := "github:\n  owner: acme\n  repo: widgets\n  labels:\n    types:\n      duplicate: chore\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	// PREREQUISITE: the same file WITHOUT the offending key must load, so a
	// failure below is the key and not a YAML or path problem.
	clean := filepath.Join(t.TempDir(), "github.yaml")
	cleanBody := "github:\n  owner: acme\n  repo: widgets\n  labels:\n    types:\n      enhancement: feature\n"
	if err := os.WriteFile(clean, []byte(cleanBody), 0o600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if _, err := LoadConfig(clean); err != nil {
		t.Fatalf("PREREQUISITE BROKEN: the equivalent clean config does not load either: %v", err)
	}

	if _, err := LoadConfig(path); err == nil {
		t.Fatal("LoadConfig accepted a config whose types key captures ft:stage/duplicate")
	}
}

// TestLifecycleKeyCollision_IsTheHarmTheCheckClaims measures the consequence
// rather than the diagnostic, because a validation rule justified only by its
// own error message is a rule nobody can check.
//
// It builds the rejected config directly, bypassing Validate, and shows that a
// type change really does destroy the lifecycle label — which is what makes
// rejecting it at load time the right call, and what item 3's runtime
// assertion independently prevents.
func TestLifecycleKeyCollision_IsTheHarmTheCheckClaims(t *testing.T) {
	labels := DefaultConfig().GitHub.Labels
	labels.Types = map[string]string{"duplicate": "chore"}

	rejected := DefaultConfig()
	rejected.GitHub.Labels = labels
	if err := rejected.Validate(); err == nil {
		t.Fatal("PREREQUISITE BROKEN: this is supposed to be the rejected config")
	}

	// The mapper's own answer: with this config loaded, our stage label is a
	// type label, so a type swap removes it.
	m := NewLabelMapper(labels)
	_, remove := m.TypeLabelSwap([]string{"ft:stage/duplicate", "bug"}, "chore")
	if !containsString(remove, "ft:stage/duplicate") {
		t.Fatalf("remove = %v: this config was supposed to make a type change delete the "+
			"lifecycle label. If it no longer does, the harm this check prevents has moved "+
			"and the check needs re-justifying, not just re-running", remove)
	}
	if _, ours := m.authorizationStage("ft:stage/duplicate"); !ours {
		t.Fatal("ft:stage/duplicate is not read as a lifecycle assertion, so deleting it " +
			"would not be a privilege change and this whole finding is misfiled")
	}
	if stage := task.StageDuplicate; m.StageToLabel(stage) != "ft:stage/duplicate" {
		t.Fatalf("StageToLabel(%s) = %q, want ft:stage/duplicate", stage, m.StageToLabel(stage))
	}

	// And item 3 refuses the write even so, which is why both layers ship.
	fake := newFakeIssueRepo(t, "ft:stage/duplicate", "bug")
	fake.registerLabel("bug")
	fake.registerLabel("chore")
	s := fake.storeWithLabelConfig(labels)

	typ := "chore"
	if _, err := s.UpdateTask(context.Background(), s.issueUUID(1),
		store.UpdateTaskParams{Type: &typ}, uuid.New()); err == nil {
		t.Error("UpdateTask succeeded: with the config forced past Validate, the runtime " +
			"assertion at writeLabelSwap is the only thing left, and it did not fire")
	}
	if !fake.hasLabel("ft:stage/duplicate") {
		t.Errorf("the lifecycle label was destroyed anyway; labels = %v", fake.labels)
	}
}
