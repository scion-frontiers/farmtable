package github

import (
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// TestPushPrefix_ResolutionIsSharedByReaderAndWriter pins the property that
// audit A-2 and review F5 are two halves of: the prefix the deployment WRITES
// and the prefix its authorization readers REQUIRE must be the same string.
//
// This is the invariant, stated so that it is falsifiable: for every
// configuration, the label StageToLabel emits for a terminal stage must be
// read back by authorizationStage as that same stage. A deployment whose own
// terminal labels do not authorize has all three of B1, B5 and B6 inert, and
// round 5 shipped four configurations in exactly that state.
//
// WHY THIS IS NOT SELF-SATISFYING. The obvious way to write this test is to
// ask authorizationStage about m.matchPrefix()+"stage/completed", which derives
// the expected input from the very function under test and therefore cannot
// fail. Instead the input comes from StageToLabel — the WRITER, the other side
// of the drift this is meant to detect — and the expected output is the enum
// constant. The two sides are only equal if reader and writer genuinely agree.
// TestPushPrefix_TheHarnessCanSeeADisagreement is the positive control that
// proves this harness goes red.
func TestPushPrefix_ResolutionIsSharedByReaderAndWriter(t *testing.T) {
	cases := []struct {
		name       string
		pushPrefix string
		why        string
	}{
		{"default", "ft:", "the shipped default"},
		{"empty_means_default", "", "documented: empty is the default, not 'no prefix required'"},
		{"custom", "acme:", "proves the config is read rather than a second hardcoded string"},
		{"uppercase", "FT:", "writer preserves case, reader lowercases; must still agree"},
		{"mixed_case_custom", "AcMe:", "same, on a custom prefix"},
		{"no_punctuation", "ft", "a prefix need not end in a colon"},

		// audit A-2: each of these silently disarmed B1+B5+B6 together at
		// ea8ac39, because matchPrefix defaulted only on "" while both readers
		// TrimSpace the label before HasPrefix.
		{"space", " ", "A-2: unusable prefix must fall back, writer included"},
		{"two_spaces", "  ", "A-2"},
		{"tab", "\t", "A-2"},
		{"newline", "\n", "A-2"},
		{"nbsp", " ", "A-2: TrimSpace is unicode-aware — verified, not assumed"},
		{"ogham_space", " ", "A-2: unicode space"},
		{"ideographic_space", "　", "A-2: unicode space"},
		{"mixed_whitespace", " \t  ", "A-2"},

		// Not whitespace-only, but whitespace-PADDED. At ea8ac39 this was also
		// disarmed and nobody had measured it: matchPrefix returned " acme:"
		// while the label, TrimSpace'd, began "acme:".
		{"padded_custom", " acme: ", "padded prefixes must normalise, not disarm"},

		// U+200B is NOT whitespace to TrimSpace, so it is deliberately NOT
		// defaulted away. It survives the label-side TrimSpace too, so it is a
		// perfectly usable prefix and must keep working.
		{"zero_width_space", "​", "not TrimSpace-whitespace: usable, must NOT be defaulted"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := NewLabelMapper(labelConfigWithStages(tc.pushPrefix, nil))

			for _, stage := range terminalStagePrecedence {
				written := m.StageToLabel(stage)

				// BASELINE: the writer must actually produce a label. Without
				// this, an empty string would trivially satisfy nothing below
				// for the wrong reason.
				if written == "" {
					t.Fatalf("StageToLabel(%s) = \"\" under push_prefix=%q; the fixture "+
						"produced no label to test (%s)", stage, tc.pushPrefix, tc.why)
				}

				got, ok := m.authorizationStage(written)
				if !ok || got != stage {
					t.Errorf("push_prefix=%q: the deployment's OWN label %q reads back as "+
						"(%q, %v), want (%q, true). Reader and writer disagree about the "+
						"prefix, which leaves B1, B5 and B6 inert for this configuration (%s)",
						tc.pushPrefix, written, got, ok, stage, tc.why)
				}
			}
		})
	}
}

// TestPushPrefix_TheHarnessCanSeeADisagreement is the positive control for the
// test above (standing bar: a green result from a harness never seen go red is
// worth nothing).
//
// It constructs the failure the test above is meant to catch — a label carrying
// a prefix the deployment does not use — and asserts the reader rejects it. If
// this ever passes vacuously, the test above is decorative.
func TestPushPrefix_TheHarnessCanSeeADisagreement(t *testing.T) {
	m := NewLabelMapper(labelConfigWithStages("acme:", nil))

	// The control: under acme:, our own label authorizes.
	own := m.StageToLabel(task.StageCompleted)
	if stage, ok := m.authorizationStage(own); !ok || stage != task.StageCompleted {
		t.Fatalf("CONTROL BROKEN: own label %q does not authorize under acme:; got (%q, %v). "+
			"The negative below proves nothing until this holds", own, stage, ok)
	}

	// The disagreement: a foreign prefix must not authorize. This is the shape
	// a reader/writer drift would produce, and the harness must see it.
	for _, foreign := range []string{
		"ft:stage/completed",
		"stage/completed",
		"completed",
		"acme:acme:stage/completed",
		" acme:stage/completed_typo",
	} {
		if stage, ok := m.authorizationStage(foreign); ok {
			t.Errorf("under push_prefix=%q, foreign label %q authorized as %q; the harness "+
				"cannot distinguish agreement from acceptance-of-everything",
				"acme:", foreign, stage)
		}
	}
}

// TestPushPrefix_DefaultIsSpelledOnce pins review F5 structurally rather than
// by comment: it asserts the resolution helper is the single definition by
// checking that every consumer agrees with it, including on a configuration
// where the default is what gets used.
//
// A future edit that reintroduces a private `if prefix == "" { prefix = "ft:" }`
// somewhere is caught by TestPushPrefix_ResolutionIsSharedByReaderAndWriter's
// whitespace rows, because a copy written that way defaults on "" only.
func TestPushPrefix_DefaultIsSpelledOnce(t *testing.T) {
	for _, blank := range []string{"", " ", "\t", " ", "  \n "} {
		if got := resolvePushPrefix(blank); got != defaultPushPrefix {
			t.Errorf("resolvePushPrefix(%q) = %q, want the single default %q",
				blank, got, defaultPushPrefix)
		}
	}
	for _, real := range []string{"ft:", "acme:", "FT:", "​"} {
		if got := resolvePushPrefix(real); got != real {
			t.Errorf("resolvePushPrefix(%q) = %q, want it used verbatim", real, got)
		}
	}
	if got := resolvePushPrefix("  acme:  "); got != "acme:" {
		t.Errorf("resolvePushPrefix(%q) = %q, want %q", "  acme:  ", got, "acme:")
	}

	// The reader is the writer, lowercased — not a second resolution.
	m := NewLabelMapper(labelConfigWithStages("AcMe:", nil))
	if m.pushPrefix() != "AcMe:" {
		t.Errorf("pushPrefix() = %q, want the configured case preserved for writing", m.pushPrefix())
	}
	if m.matchPrefix() != "acme:" {
		t.Errorf("matchPrefix() = %q, want the writer's prefix lowercased", m.matchPrefix())
	}
	if m.matchPrefix() != strings.ToLower(m.pushPrefix()) {
		t.Errorf("matchPrefix() and pushPrefix() are not the same resolution")
	}
}

// TestValidate_RejectsWhitespaceOnlyPushPrefix covers the second half of audit
// A-2's recommendation. resolvePushPrefix already makes such a config harmless,
// but a security parameter that silently becomes a value the operator did not
// write should fail loud at startup instead.
func TestValidate_RejectsWhitespaceOnlyPushPrefix(t *testing.T) {
	t.Run("rejected", func(t *testing.T) {
		for _, bad := range []string{" ", "  ", "\t", "\n", " ", " \t "} {
			cfg := DefaultConfig()
			cfg.GitHub.Labels.PushPrefix = bad
			err := cfg.Validate()
			if err == nil {
				t.Errorf("Validate() accepted push_prefix=%q, want an error", bad)
				continue
			}
			if !strings.Contains(err.Error(), "push_prefix") {
				t.Errorf("Validate() error for %q = %q, want it to name the field", bad, err)
			}
		}
	})

	t.Run("accepted", func(t *testing.T) {
		// Empty is the documented spelling of "use the default" and must NOT
		// be an error — DefaultConfig and every config file that omits the
		// field depend on it.
		for _, ok := range []string{"", "ft:", "acme:", "FT:", "​", " acme: "} {
			cfg := DefaultConfig()
			cfg.GitHub.Labels.PushPrefix = ok
			if err := cfg.Validate(); err != nil {
				t.Errorf("Validate() rejected push_prefix=%q: %v", ok, err)
			}
		}
	})
}
