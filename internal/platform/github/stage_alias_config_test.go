package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestConfiguredStageAliases_KeySpellingIsNormalised closes test review T-1
// and audit A-5, and — more importantly than either — closes the FIXTURE gap
// underneath them.
//
// Until round 6, `grep -rn "Stages:" --include='*_test.go' internal/` returned
// zero: every fixture in the repository inherited its alias map from
// DefaultConfig, so no test could construct a deployment with a configured
// terminal alias. B6 made that configuration decide authorization. A control
// whose harness cannot build the input it is meant to reject is decorative,
// which is why the four rows below are asserted end to end through the store
// rather than at the mapper seam.
//
// MEASURED AT ea8ac39, before the fix (test review T-1, reproduced by me):
//
//	key="shipped"    label="shipped"    | lifecycle=accepted  available=true  | display=("completed",true)
//	key="shipped"    label="ft:shipped" | lifecycle=completed available=false | display=("completed",true)
//	key="ft:shipped" label="ft:shipped" | lifecycle=accepted  available=true  | display=("",false)
//	key="ft:shipped" label="shipped"    | lifecycle=accepted  available=true  | display=("",false)
//
// Rows 3 and 4 are the trap: an operator who followed round 5's remediation
// literally, by writing the prefix into the config KEY, got an alias that was
// dead for display as well as authorization. buildLabelMapper stored the key
// verbatim while stripForMatch strips before the lookup, so the key could
// never be hit — except as a DOUBLE prefix, which is audit A-5.
//
// AFTER the fix, the config key is spelling-insensitive and only the LABEL's
// prefix decides authority. That is the property this test pins, and the two
// halves have to be pinned together: making the key insensitive must NOT make
// a bare label authoritative, or the fix would have silently reverted B6.
func TestConfiguredStageAliases_KeySpellingIsNormalised(t *testing.T) {
	cases := []struct {
		name string
		key  string // how the operator spelled it in config
		//nolint:revive // label is the GitHub label applied to the issue
		label string

		wantLifecycle task.Stage
		wantAvailable bool
		wantDisplay   task.Stage
		wantDisplayOK bool
		why           string
	}{
		{
			name: "bare_key_bare_label", key: "shipped", label: "shipped",
			wantLifecycle: task.StageAccepted, wantAvailable: true,
			wantDisplay: task.StageCompleted, wantDisplayOK: true,
			why: "B6 WORKING AS DESIGNED, not a defect: an unprefixed label is " +
				"not unambiguously ours, so it renders as completed but does not " +
				"authorize. The display/authorization split is deliberate.",
		},
		{
			name: "bare_key_prefixed_label", key: "shipped", label: "ft:shipped",
			wantLifecycle: task.StageCompleted, wantAvailable: false,
			wantDisplay: task.StageCompleted, wantDisplayOK: true,
			why: "the intended-working cell, and the one with NO coverage at all " +
				"before round 6. This is the spelling round 5's remediation meant.",
		},
		{
			name: "prefixed_key_prefixed_label", key: "ft:shipped", label: "ft:shipped",
			wantLifecycle: task.StageCompleted, wantAvailable: false,
			wantDisplay: task.StageCompleted, wantDisplayOK: true,
			why: "WAS ROW 3, the fully-dead alias. The key is now normalised the " +
				"same way the lookup normalises, so it behaves as the bare key does.",
		},
		{
			name: "prefixed_key_bare_label", key: "ft:shipped", label: "shipped",
			wantLifecycle: task.StageAccepted, wantAvailable: true,
			wantDisplay: task.StageCompleted, wantDisplayOK: true,
			why: "WAS ROW 4. Key normalisation revives DISPLAY; the label still " +
				"lacks the prefix so it still must not authorize. Both halves matter.",
		},
		{
			name: "stage_path_key", key: "ft:stage/shipped", label: "ft:shipped",
			wantLifecycle: task.StageCompleted, wantAvailable: false,
			wantDisplay: task.StageCompleted, wantDisplayOK: true,
			why: "the fullest spelling an operator might copy from a written label",
		},
		{
			name: "uppercase_key", key: "FT:Shipped", label: "ft:shipped",
			wantLifecycle: task.StageCompleted, wantAvailable: false,
			wantDisplay: task.StageCompleted, wantDisplayOK: true,
			why: "keys were already case-folded; normalisation must not lose that",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			cfg := labelConfigWithStages("ft:", map[string]string{tc.key: "completed"})

			fake := newFakeIssueRepo(t, tc.label)
			fake.registerLabel(tc.label)
			s := fake.storeWithLabelConfig(cfg)

			// BASELINE: the fixture must actually carry the label. Without this,
			// every "not terminal" answer below could be a fixture artefact
			// rather than a property of the code.
			if !fake.hasLabel(tc.label) {
				t.Fatalf("fixture lost the label %q; labels = %v", tc.label, fake.labels)
			}

			tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{tc.label}}

			if got := s.LifecycleStage(ctx, tk); got != tc.wantLifecycle {
				t.Errorf("LifecycleStage = %q, want %q\nkey=%q label=%q\nwhy: %s",
					got, tc.wantLifecycle, tc.key, tc.label, tc.why)
			}

			avail, err := s.ComputeAvailability(ctx, tk)
			if err != nil {
				t.Fatalf("ComputeAvailability: %v", err)
			}
			if avail.Available != tc.wantAvailable {
				t.Errorf("available = %v, want %v (reasons %v)\nkey=%q label=%q\nwhy: %s",
					avail.Available, tc.wantAvailable, avail.Reasons, tc.key, tc.label, tc.why)
			}

			gotDisplay, gotOK := s.mapper.MapLabelsToStage([]string{tc.label})
			if gotOK != tc.wantDisplayOK || (gotOK && gotDisplay != tc.wantDisplay) {
				t.Errorf("display MapLabelsToStage = (%q, %v), want (%q, %v)\nkey=%q label=%q\nwhy: %s",
					gotDisplay, gotOK, tc.wantDisplay, tc.wantDisplayOK, tc.key, tc.label, tc.why)
			}
		})
	}
}

// TestConfiguredStageAliases_DoublePrefixIsNotAWayIn is audit A-5's other half.
//
// A-5 observed that a configured "ft:shipped" key was reachable by writing the
// label "ft:ft:shipped", because stripForMatch strips exactly once. Key
// normalisation is claimed to subsume A-5; this asserts it rather than assuming
// it. After the fix the key is stored as "shipped", so "ft:ft:shipped" strips
// once to "ft:shipped" and matches nothing.
func TestConfiguredStageAliases_DoublePrefixIsNotAWayIn(t *testing.T) {
	ctx := context.Background()

	for _, key := range []string{"shipped", "ft:shipped"} {
		t.Run("key="+key, func(t *testing.T) {
			cfg := labelConfigWithStages("ft:", map[string]string{key: "completed"})
			fake := newFakeIssueRepo(t, "ft:ft:shipped")
			fake.registerLabel("ft:ft:shipped")
			s := fake.storeWithLabelConfig(cfg)

			// CONTROL: the single-prefix spelling DOES authorize, so a denial
			// below is a property of the double prefix and not of the fixture.
			control := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:shipped"}}
			if got := s.LifecycleStage(ctx, control); got != task.StageCompleted {
				t.Fatalf("CONTROL BROKEN: single-prefixed %q reads as %q, want %q; "+
					"the negative below proves nothing", "ft:shipped", got, task.StageCompleted)
			}

			tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:ft:shipped"}}
			if got := s.LifecycleStage(ctx, tk); got != task.StageAccepted {
				t.Errorf("double-prefixed %q reads as lifecycle %q; a double prefix must "+
					"not be a second spelling of a configured alias (audit A-5)",
					"ft:ft:shipped", got)
			}
			if stages := s.mapper.AllTerminalLabelStages([]string{"ft:ft:shipped"}); len(stages) != 0 {
				t.Errorf("AllTerminalLabelStages(ft:ft:shipped) = %v, want empty", stages)
			}
		})
	}
}

// TestConfiguredStageAliases_UnderACustomPushPrefix checks that alias handling
// is not accidentally coupled to the default prefix — the same reason the
// acme: cell exists in the B6 tests. The audit's own custom-prefix creation
// cell measured nothing because the fake repo had no node ID for the label;
// registerLabel is what makes this one real.
func TestConfiguredStageAliases_UnderACustomPushPrefix(t *testing.T) {
	ctx := context.Background()
	cfg := labelConfigWithStages("acme:", map[string]string{"acme:shipped": "wont_fix"})

	fake := newFakeIssueRepo(t, "acme:shipped")
	fake.registerLabel("acme:shipped")
	s := fake.storeWithLabelConfig(cfg)

	if !fake.hasLabel("acme:shipped") {
		t.Fatalf("fixture lost the label; labels = %v", fake.labels)
	}

	tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"acme:shipped"}}
	if got := s.LifecycleStage(ctx, tk); got != task.StageWontFix {
		t.Errorf("LifecycleStage = %q, want %q: a prefixed alias key must normalise "+
			"against the CONFIGURED prefix, not a hardcoded ft:", got, task.StageWontFix)
	}
	avail, err := s.ComputeAvailability(ctx, tk)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if avail.Available {
		t.Errorf("available = true for a configured terminal alias, want false (reasons %v)",
			avail.Reasons)
	}

	// A foreign deployment's prefix must remain inert under acme:.
	foreign := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:shipped"}}
	if got := s.LifecycleStage(ctx, foreign); got != task.StageAccepted {
		t.Errorf("under push_prefix=acme:, foreign label ft:shipped reads as %q, want %q",
			got, task.StageAccepted)
	}
}

// TestConfiguredStageAliases_DoNotBypassTheTerminalPredicate guards the
// direction that would be a real escalation: a configured alias must still go
// through store.IsTerminalStage to count as terminal, so an operator aliasing
// a label to a NON-terminal stage cannot make it withhold work, and aliasing
// to a terminal stage routes through the same predicate everything else does.
func TestConfiguredStageAliases_DoNotBypassTheTerminalPredicate(t *testing.T) {
	ctx := context.Background()
	cfg := labelConfigWithStages("ft:", map[string]string{"shipped": "working"})

	fake := newFakeIssueRepo(t, "ft:shipped")
	fake.registerLabel("ft:shipped")
	s := fake.storeWithLabelConfig(cfg)

	tk := &ent.Task{Stage: task.StageAccepted, Labels: []string{"ft:shipped"}}
	if got := s.LifecycleStage(ctx, tk); got != task.StageAccepted {
		t.Errorf("LifecycleStage = %q for an alias to a NON-terminal stage, want %q "+
			"(TerminalLabelStage returns only terminal stages; anything else must "+
			"fall through to t.Stage)", got, task.StageAccepted)
	}
	if stages := s.mapper.AllTerminalLabelStages([]string{"ft:shipped"}); len(stages) != 0 {
		t.Errorf("AllTerminalLabelStages = %v for an alias to working, want empty", stages)
	}
	if store.IsTerminalStage(task.StageWorking) {
		t.Fatal("precondition changed: StageWorking is now terminal, rewrite this test")
	}
}
