package github

import (
	"fmt"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ── #194 round 4: TerminalLabelStage must see a terminal label in ANY set ──
//
// Round 3 built TerminalLabelStage on MapLabelsToStage, which collapses a
// label set to a single highest-precedence winner. stagePrecedence ranks every
// non-terminal stage above every terminal one, so one extra ordinary label hid
// the terminal label from the gate: 12 of 16 combinations bypassed the accept
// gate, availability reported declined work as ready, and the claim gate
// stamped ft:stage/working on a wont_fix issue.
//
// The round-3 test suite could not see any of it because every fixture it
// built carried exactly one label. Mutation testing did not catch it either,
// on either review leg, across three rounds: mutating the code asks "is this
// line load-bearing for the tests I already have?", and no mutation of correct
// code invents an input nobody wrote.
//
// So these tests vary the INPUT DOMAIN rather than the code. For a predicate
// over a collection the axis that matters is CARDINALITY: zero, one, two, and
// conflicting. This file is the sharp instrument for that axis — it calls the
// predicate directly, so it can assert WHICH stage came back rather than only
// that some gate said no. The end-to-end sink binding lives in
// internal/server/authz_terminal_reopen_test.go.

// nonTerminalStages is every stage a maintainer could add alongside a terminal
// label — i.e. every mask that could hide it. Derived from allStages so a new
// stage in the data model joins the matrix automatically.
func nonTerminalStages(t *testing.T) []task.Stage {
	t.Helper()
	out := make([]task.Stage, 0, len(allStages))
	for _, s := range allStages {
		if !store.IsTerminalStage(s) {
			out = append(out, s)
		}
	}
	return out
}

func terminalStages(t *testing.T) []task.Stage {
	t.Helper()
	out := make([]task.Stage, 0, len(allStages))
	for _, s := range allStages {
		if store.IsTerminalStage(s) {
			out = append(out, s)
		}
	}
	return out
}

// TestTerminalLabelStage_MaskedByEveryNonTerminalLabel is the blocking
// regression test for the round-3 bypass. It asserts the property directly:
// adding ANY non-terminal stage label to a terminal-labelled issue must not
// change the terminal answer.
//
// What these rows CAN express: a terminal label accompanied by exactly one
// non-terminal stage label, in both label orders, plus the unmasked control.
// What they CANNOT express: interaction with GitHub issue state (closed +
// state_reason), non-stage labels, or the authorization decision itself — that
// is the server-side matrix's job. A count pin over rows that cannot vary the
// defect is an assumption wearing a number, so the schema is stated here
// rather than left to the reader.
func TestTerminalLabelStage_MaskedByEveryNonTerminalLabel(t *testing.T) {
	m := defaultMapper()
	terminals := terminalStages(t)
	masks := nonTerminalStages(t)

	if len(terminals) != 4 {
		t.Fatalf("expected 4 terminal stages, got %d (%v); the data model changed "+
			"and this matrix no longer covers it", len(terminals), terminals)
	}
	if len(masks) != 6 {
		t.Fatalf("expected 6 non-terminal stages, got %d (%v); a new stage must be "+
			"added to this matrix or it silently stops masking-testing it", len(masks), masks)
	}

	// terminals x masks x {terminal-first, mask-first}, plus one unmasked
	// control per terminal. Label ORDER is part of the schema because the
	// implementation iterates the caller's slice; if it ever became
	// order-sensitive the two orders would disagree.
	const wantCells = 4*6*2 + 4
	cells := 0

	for _, terminal := range terminals {
		terminalLabel := m.StageToLabel(terminal)

		// Control: the terminal label alone must be seen.
		cells++
		if got, ok := m.TerminalLabelStage([]string{terminalLabel}); !ok || got != terminal {
			t.Fatalf("CONTROL BROKEN: TerminalLabelStage([%s]) = (%q, %v), want (%q, true). "+
				"The single-label case must hold or the masked rows below prove nothing",
				terminalLabel, got, ok, terminal)
		}

		for _, mask := range masks {
			maskLabel := m.StageToLabel(mask)
			for _, labels := range [][]string{
				{terminalLabel, maskLabel},
				{maskLabel, terminalLabel},
			} {
				cells++
				t.Run(fmt.Sprintf("%s/%s", strings.Join(labels, "+"), terminal), func(t *testing.T) {
					got, ok := m.TerminalLabelStage(labels)
					if !ok || got != terminal {
						t.Fatalf("TerminalLabelStage(%v) = (%q, %v), want (%q, true). "+
							"Adding %q hid the terminal label %q from the gate — this is the "+
							"round-3 bypass: authorization, availability and the claim gate all "+
							"read this answer, and %q is what lets a task:write token reopen, "+
							"schedule and claim work a maintainer declined",
							labels, got, ok, terminal, maskLabel, terminalLabel, got)
					}
				})
			}
		}
	}

	if cells != wantCells {
		t.Fatalf("matrix executed %d cells, want %d (4 terminal x 6 non-terminal masks x 2 "+
			"label orders, + 4 unmasked controls). A row was added or deleted without "+
			"updating the pin", cells, wantCells)
	}
}

// TestTerminalLabelStage_Cardinality pins the whole input-domain axis: zero,
// one, two, and conflicting members. The conflicting rows matter because the
// answer feeds TransitionScope as the "from" stage, where from == to
// short-circuits to task:write — so WHICH terminal stage is returned is a
// privilege-relevant answer, not merely a cosmetic one.
func TestTerminalLabelStage_Cardinality(t *testing.T) {
	m := defaultMapper()

	cases := []struct {
		name      string
		labels    []string
		wantStage task.Stage
		wantOK    bool
	}{
		{"zero/nil", nil, "", false},
		{"zero/empty", []string{}, "", false},
		{"one/non-stage", []string{"needs-design"}, "", false},
		{"one/non-terminal", []string{"ft:stage/accepted"}, "", false},
		{"one/terminal", []string{"ft:stage/wont_fix"}, task.StageWontFix, true},
		{"two/terminal+mask", []string{"ft:stage/wont_fix", "ft:stage/accepted"}, task.StageWontFix, true},
		{"two/mask+terminal", []string{"ft:stage/accepted", "ft:stage/wont_fix"}, task.StageWontFix, true},
		{"two/non-stage+terminal", []string{"bug", "ft:stage/cancelled"}, task.StageCancelled, true},
		{"two/terminals", []string{"ft:stage/wont_fix", "ft:stage/cancelled"}, task.StageWontFix, true},
		// Order-independence: the same SET must give the same answer whichever
		// order GitHub happens to return the labels in.
		{"two/terminals/reversed", []string{"ft:stage/cancelled", "ft:stage/wont_fix"}, task.StageWontFix, true},
		{"two/terminals/completed-wins", []string{"ft:stage/cancelled", "ft:stage/completed"}, task.StageCompleted, true},
		{"two/terminals/completed-wins-reversed", []string{"ft:stage/completed", "ft:stage/cancelled"}, task.StageCompleted, true},
		{"four/all-terminals", []string{
			"ft:stage/duplicate", "ft:stage/wont_fix", "ft:stage/completed", "ft:stage/cancelled",
		}, task.StageCompleted, true},
		{"many/all-stages", []string{
			"ft:stage/triage", "ft:stage/accepted", "ft:stage/working", "ft:stage/in_review",
			"ft:stage/in_qa", "ft:stage/deploying", "ft:stage/cancelled",
		}, task.StageCancelled, true},
		{"duplicates/same-label-twice", []string{"ft:stage/wont_fix", "ft:stage/wont_fix"}, task.StageWontFix, true},
	}

	if len(cases) != 15 {
		t.Fatalf("cardinality table has %d rows, want 15; a row was deleted silently", len(cases))
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := m.TerminalLabelStage(tc.labels)
			if got != tc.wantStage || ok != tc.wantOK {
				t.Fatalf("TerminalLabelStage(%v) = (%q, %v), want (%q, %v)",
					tc.labels, got, ok, tc.wantStage, tc.wantOK)
			}
		})
	}
}

// TestTerminalLabelStage_DisabledMapperDeclines confirms the !m.enabled guard
// is correct rather than inheriting the claim from audit F6.
//
// With mapping off the scan MUST decline, and the reason it is safe to decline
// is symmetry: IssueToPhaseStage also declines to map, so no demotion happens
// and the task's own Stage is what it always was. Producer and consumer are
// gated by one flag. Scanning anyway would make a mapper that is configured to
// ignore labels start granting them authority — note the scan reads
// m.labelToStage, which NewLabelMapper populates regardless of Enabled, so
// this guard is load-bearing in a way the old MapLabelsToStage delegation made
// automatic.
func TestTerminalLabelStage_DisabledMapperDeclines(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.Enabled = false
	m := NewLabelMapper(cfg)

	labels := []string{"ft:stage/wont_fix", "ft:stage/accepted"}

	if stage, ok := m.TerminalLabelStage(labels); ok {
		t.Fatalf("TerminalLabelStage(%v) = (%q, true) with mapping disabled, want declined", labels, stage)
	}
	// The symmetry that makes declining correct.
	if stage, ok := m.MapLabelsToStage(labels); ok {
		t.Fatalf("MapLabelsToStage(%v) = (%q, true) with mapping disabled: the producer "+
			"still maps, so the consumer declining would be asymmetric", labels, stage)
	}
	phase, stage := m.IssueToPhaseStage("OPEN", "", labels)
	if stage == task.StageWontFix {
		t.Fatalf("IssueToPhaseStage demoted nothing to undo but returned %s/%s; the "+
			"no-demotion premise behind the disabled fallback does not hold", phase, stage)
	}

	// Control: the same mapper with Enabled restored must see the label, so
	// this test cannot pass because the labels were malformed.
	cfg.Enabled = true
	if stage, ok := NewLabelMapper(cfg).TerminalLabelStage(labels); !ok || stage != task.StageWontFix {
		t.Fatalf("CONTROL BROKEN: enabled mapper returned (%q, %v) for %v, want (wont_fix, true)",
			stage, ok, labels)
	}
}

// TestTerminalLabelStage_NilReceiver keeps ComputeAvailability total on a
// zero-value store. MapLabelsToStage dereferences m.enabled and panics on a
// nil receiver, so this guard must come first.
func TestTerminalLabelStage_NilReceiver(t *testing.T) {
	var m *LabelMapper
	if stage, ok := m.TerminalLabelStage([]string{"ft:stage/wont_fix"}); ok {
		t.Fatalf("nil mapper returned (%q, true), want declined", stage)
	}
}

// TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast pins the ordering
// stagePrecedence has always had, because it is load-bearing for a security
// property and nothing asserted it before round 4.
//
// The ordering itself is a DISPLAY rule: it exists so live work is never
// rendered as finished. That is why every terminal stage ranks last, and that
// is exactly what made MapLabelsToStage the wrong basis for a privilege check.
// Authorization must not depend on this order — it now goes through
// TerminalLabelStage, which does not consult stagePrecedence at all. This test
// fails if a terminal stage is ever moved above a non-terminal one, so that
// such a reorder is a deliberate act with a failing test attached rather than
// a silent change to what the display shows.
func TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast(t *testing.T) {
	seenTerminal := false
	for i, s := range stagePrecedence {
		if store.IsTerminalStage(s) {
			seenTerminal = true
			continue
		}
		if seenTerminal {
			t.Fatalf("stagePrecedence[%d] = %q is non-terminal but ranks below a terminal "+
				"stage. The ordering is a display rule and every terminal stage must rank "+
				"last, so an issue is never rendered as finished while a live label is on "+
				"it. Full order: %v", i, s, stagePrecedence)
		}
	}
	if !seenTerminal {
		t.Fatalf("stagePrecedence contains no terminal stage at all (%v); this test would "+
			"pass vacuously", stagePrecedence)
	}

	// Completeness: every stage in the data model must be ranked, or
	// MapLabelsToStage silently falls through to its map-iteration fallback,
	// which is non-deterministic.
	ranked := make(map[task.Stage]bool, len(stagePrecedence))
	for _, s := range stagePrecedence {
		ranked[s] = true
	}
	for _, s := range allStages {
		if !ranked[s] {
			t.Errorf("stage %q is not ranked in stagePrecedence; MapLabelsToStage would "+
				"resolve it by random map iteration", s)
		}
	}
}

// TestTerminalStagePrecedence_CoversEveryTerminalStage guards the tiebreak
// table TerminalLabelStage actually uses. A terminal stage missing from it is
// invisible to the gate — the round-3 bug in a new costume.
func TestTerminalStagePrecedence_CoversEveryTerminalStage(t *testing.T) {
	ranked := make(map[task.Stage]bool, len(terminalStagePrecedence))
	for _, s := range terminalStagePrecedence {
		if !store.IsTerminalStage(s) {
			t.Errorf("terminalStagePrecedence contains %q, which is not a terminal stage", s)
		}
		ranked[s] = true
	}
	for _, s := range terminalStages(t) {
		if !ranked[s] {
			t.Errorf("terminal stage %q is missing from terminalStagePrecedence, so a label "+
				"naming it can never be returned by TerminalLabelStage: the authorization, "+
				"availability and claim gates would all be blind to it", s)
		}
	}
}
