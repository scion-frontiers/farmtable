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
