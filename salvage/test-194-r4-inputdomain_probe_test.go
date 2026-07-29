//go:build ignore_in_salvage

// test-194-r4-inputdomain_probe_test.go — #194 round-4 TEST REVIEW probe.
//
// Salvage copy. To run: drop into internal/platform/github/ as
// zz_r4_inputdomain_probe_test.go, DELETE the build tag line above, then
//
//	go test ./internal/platform/github/ -run 'TestProbeR4' -v -count=1
//
// PURPOSE. The round-3 retraction established that mutation testing proves
// tests are bound to the CODE, and only input-domain variation proves they are
// bound to REALITY. The round-4 dev varied cardinality (0/1/2/conflicting),
// both label orders, and a four-terminal collision. This probe attacks the
// input classes it did NOT vary:
//
//	A. LABEL SURFACE FORM   — stripForMatch does ToLower + TrimSpace + prefix
//	                          stripping, so case, whitespace, and the bare
//	                          "stage/x" form are all live input classes and
//	                          none of them appears in any fixture.
//	B. MAPPER CONFIGURATION — every fixture in the round-4 suite is built from
//	                          DefaultConfig(). LabelConfig.Stages and
//	                          LabelConfig.PushPrefix are operator-supplied YAML.
//	                          That is a whole dimension held constant.
//	C. SCALE / DEGENERATE   — empty-string label, unknown stage name, a
//	                          terminal label buried at the end of a large set.
//	D. STOCK GITHUB LABELS  — the nine labels GitHub ships in a new repository.
//
// Every subtest states the answer it EXPECTS and why, so a surprising result is
// visibly a finding rather than a probe bug. Each block also carries a
// fail-closed self-check: if the control does not behave, the block reports
// PROBE-BROKEN rather than a clean pass (standing bar 3).

package github

import (
	"fmt"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

const maskLabel = "ft:stage/accepted"

func probeMapper(t *testing.T) *LabelMapper {
	t.Helper()
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)
	// Fail-closed self-check: the probe is worthless if the baseline is wrong.
	if s, ok := m.TerminalLabelStage([]string{"ft:stage/wont_fix"}); !ok || s != task.StageWontFix {
		t.Fatalf("PROBE-BROKEN: baseline TerminalLabelStage([ft:stage/wont_fix]) = (%q,%v)", s, ok)
	}
	if s, ok := m.TerminalLabelStage([]string{"ft:stage/accepted"}); ok {
		t.Fatalf("PROBE-BROKEN: baseline accepted-only returned (%q,true)", s)
	}
	return m
}

// ── A + C + D: label surface form, degenerate inputs, stock labels ──────────

func TestProbeR4_LabelSurfaceForm(t *testing.T) {
	m := probeMapper(t)

	cases := []struct {
		name   string
		label  string
		wantOK bool
		why    string
	}{
		{"canonical", "ft:stage/wont_fix", true, "the only form any fixture uses"},
		{"upper", "FT:STAGE/WONT_FIX", true, "stripForMatch lowercases first; GitHub label names are case-preserving and users type caps"},
		{"mixed", "Ft:Stage/Wont_Fix", true, "same"},
		{"leading-trailing-space", "  ft:stage/wont_fix  ", true, "stripForMatch TrimSpaces"},
		{"inner-space", "ft:stage/ wont_fix", false, "no inner-space normalisation exists"},
		{"no-ft-prefix", "stage/wont_fix", true, "stripForMatch strips a bare 'stage/' independently of the ft: prefix"},
		{"bare-stage-name", "wont_fix", true, "NewLabelMapper registers every bare stage name as a key"},
		{"github-stock-wontfix", "wontfix", false, "GitHub ships 'wontfix' with no underscore; it is NOT the stage key 'wont_fix'"},
		{"github-stock-duplicate", "duplicate", true, "GitHub ships 'duplicate', which IS the stage key -- the disclosed deferred item"},
		{"github-stock-invalid", "invalid", false, "not a stage name"},
		{"hyphen-variant", "wont-fix", false, "no hyphen/underscore normalisation exists"},
		{"empty-string", "", false, "the empty label must not resolve to anything"},
		{"prefix-only", "ft:stage/", false, "truncated label"},
		{"unknown-stage", "ft:stage/finished", false, "names a stage the data model does not have"},
		{"double-prefix", "ft:ft:stage/wont_fix", false, "only one prefix strip happens"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			alone, aOK := m.TerminalLabelStage([]string{tc.label})
			masked, mOK := m.TerminalLabelStage([]string{tc.label, maskLabel})
			maskedRev, rOK := m.TerminalLabelStage([]string{maskLabel, tc.label})

			t.Logf("label=%-24q alone=(%q,%v) +mask=(%q,%v) mask-first=(%q,%v)  expect ok=%v  [%s]",
				tc.label, alone, aOK, masked, mOK, maskedRev, rOK, tc.wantOK, tc.why)

			if aOK != tc.wantOK {
				t.Errorf("FINDING: TerminalLabelStage([%q]) ok=%v, expected %v (%s)", tc.label, aOK, tc.wantOK, tc.why)
			}
			// THE round-4 invariant, restated for every surface form: a mask
			// must never change the answer, in either order.
			if mOK != aOK || masked != alone {
				t.Errorf("FINDING: mask changed the answer for %q: alone=(%q,%v) masked=(%q,%v)",
					tc.label, alone, aOK, masked, mOK)
			}
			if rOK != aOK || maskedRev != alone {
				t.Errorf("FINDING: label ORDER changed the answer for %q: alone=(%q,%v) mask-first=(%q,%v)",
					tc.label, alone, aOK, maskedRev, rOK)
			}
		})
	}
}

// TestProbeR4_StockGitHubLabelSet is the realistic worst case for the deferred
// stock-label item: a brand-new GitHub repository's full default label set,
// with and without a real terminal stage label.
func TestProbeR4_StockGitHubLabelSet(t *testing.T) {
	m := probeMapper(t)

	stock := []string{
		"bug", "documentation", "duplicate", "enhancement", "good first issue",
		"help wanted", "invalid", "question", "wontfix",
	}

	got, ok := m.TerminalLabelStage(stock)
	t.Logf("GitHub stock label set %v -> (%q, %v)", stock, got, ok)
	if !ok || got != task.StageDuplicate {
		t.Errorf("expected the stock set to resolve to duplicate via the bare "+
			"'duplicate' label (deferred item); got (%q,%v)", got, ok)
	}

	// Remove the one colliding label and the set must go quiet.
	quiet := []string{"bug", "documentation", "enhancement", "good first issue",
		"help wanted", "invalid", "question", "wontfix"}
	if got, ok := m.TerminalLabelStage(quiet); ok {
		t.Errorf("FINDING: a stock set with no stage-name collision still resolved to (%q,true)", got)
	}
}

// TestProbeR4_ScaleAndBurial checks that a terminal label is found regardless
// of where it sits in a large set -- the scan is unbounded, but nothing in the
// suite states that.
func TestProbeR4_ScaleAndBurial(t *testing.T) {
	m := probeMapper(t)

	for _, n := range []int{1, 10, 100, 1000} {
		t.Run(fmt.Sprintf("n=%d", n), func(t *testing.T) {
			labels := make([]string, 0, n+1)
			for i := 0; i < n; i++ {
				labels = append(labels, fmt.Sprintf("noise-%d", i))
			}
			labels = append(labels, "ft:stage/cancelled") // buried last
			got, ok := m.TerminalLabelStage(labels)
			if !ok || got != task.StageCancelled {
				t.Errorf("FINDING: terminal label buried at index %d in a %d-label set was missed: (%q,%v)",
					n, n+1, got, ok)
			}
		})
	}
}

// ── B: the configuration dimension, held constant by the whole suite ────────

func TestProbeR4_ConfigDimension(t *testing.T) {
	t.Run("custom_push_prefix", func(t *testing.T) {
		cfg := DefaultConfig().GitHub.Labels
		cfg.PushPrefix = "farm:"
		m := NewLabelMapper(cfg)

		own := m.StageToLabel(task.StageWontFix)
		t.Logf("StageToLabel(wont_fix) with push_prefix=farm: -> %q", own)

		if s, ok := m.TerminalLabelStage([]string{own}); !ok || s != task.StageWontFix {
			t.Errorf("FINDING: mapper does not recognise the label it itself emits: %q -> (%q,%v)", own, s, ok)
		}
		if s, ok := m.TerminalLabelStage([]string{"wont_fix"}); !ok || s != task.StageWontFix {
			t.Errorf("FINDING: bare stage name stopped resolving under a custom prefix: (%q,%v)", s, ok)
		}
		// A label written by a DIFFERENT deployment's prefix.
		s, ok := m.TerminalLabelStage([]string{"ft:stage/wont_fix"})
		t.Logf("foreign-prefix label ft:stage/wont_fix under push_prefix=farm: -> (%q,%v)", s, ok)
		if ok {
			t.Logf("NOTE: foreign prefix still resolves (informational, not necessarily wrong)")
		}
	})

	t.Run("operator_remaps_a_terminal_label_to_a_non_terminal_stage", func(t *testing.T) {
		// This is the config an operator writes to say "in my workflow the
		// label wont_fix means the task is merely accepted". It is legal YAML
		// and NewLabelMapper accepts it. Nothing in the suite covers it.
		cfg := DefaultConfig().GitHub.Labels
		cfg.Stages = map[string]string{"wont_fix": "accepted"}
		m := NewLabelMapper(cfg)

		s, ok := m.TerminalLabelStage([]string{"ft:stage/wont_fix"})
		t.Logf("config Stages{wont_fix: accepted}: TerminalLabelStage([ft:stage/wont_fix]) -> (%q,%v)", s, ok)
		if ok {
			t.Logf("gate still sees a terminal stage")
		} else {
			t.Logf("FINDING-CANDIDATE: one line of operator YAML makes ft:stage/wont_fix " +
				"invisible to the authorization, availability and claim gates. " +
				"CloseTask still WRITES this label (StageToLabel is unaffected by " +
				"cfg.Stages for this stage), so the label a close emits is one the " +
				"gate no longer reads.")
		}

		// Does CloseTask still emit the now-unreadable label?
		t.Logf("StageToLabel(wont_fix) under that config -> %q", m.StageToLabel(task.StageWontFix))
	})

	t.Run("operator_maps_a_custom_label_to_a_terminal_stage", func(t *testing.T) {
		cfg := DefaultConfig().GitHub.Labels
		cfg.Stages = map[string]string{"abandoned": "cancelled"}
		m := NewLabelMapper(cfg)
		s, ok := m.TerminalLabelStage([]string{"abandoned", maskLabel})
		t.Logf("config Stages{abandoned: cancelled}: TerminalLabelStage([abandoned, mask]) -> (%q,%v)", s, ok)
		if !ok || s != task.StageCancelled {
			t.Errorf("FINDING: a custom operator label mapped to a terminal stage is not honoured by the gate")
		}
	})
}

// ── The closed-issue row the server matrix cannot express ───────────────────

// TestProbeR4_ClosedIssueMultiLabel. Every fixture in the round-4 server matrix
// is state=OPEN, stateReason=null; the SCHEMA comment discloses that closed
// issues are not expressible. This checks the closed branch of
// IssueToPhaseStage, which -- unlike the open branch -- has NO terminal check
// at all and returns the MapLabelsToStage winner directly.
func TestProbeR4_ClosedIssueMultiLabel(t *testing.T) {
	m := probeMapper(t)

	for _, tc := range []struct {
		state, reason string
		labels        []string
	}{
		{"OPEN", "", []string{"ft:stage/wont_fix"}},
		{"OPEN", "", []string{"ft:stage/wont_fix", maskLabel}},
		{"CLOSED", "not_planned", []string{"ft:stage/wont_fix"}},
		{"CLOSED", "not_planned", []string{"ft:stage/wont_fix", maskLabel}},
		{"CLOSED", "completed", []string{"ft:stage/completed", "ft:stage/working"}},
	} {
		phase, display := m.IssueToPhaseStage(tc.state, tc.reason, tc.labels)
		lifecycle, ok := m.TerminalLabelStage(tc.labels)
		t.Logf("state=%-7s reason=%-12s labels=%-46v display=(%s/%s) terminal=(%q,%v)",
			tc.state, tc.reason, tc.labels, phase, display, lifecycle, ok)
		if !ok {
			t.Errorf("FINDING: terminal label invisible for %v (state=%s)", tc.labels, tc.state)
		}
		if strings.Contains(string(display), "wont_fix") && tc.state == "OPEN" {
			t.Errorf("open issue displayed as terminal: %s", display)
		}
	}
}
