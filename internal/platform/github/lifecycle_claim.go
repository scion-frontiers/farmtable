package github

import (
	"strings"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// THE WRITE-SIDE PREDICATE (#194 round 10)
//
// This file exists because "which labels are lifecycle labels?" has two
// correct answers, and the codebase had been giving the READ answer to a WRITE
// question.
//
//	READ  — "which stage is this task in, according to the config this
//	        deployment is running today?"  Legitimately config-dependent.
//	        authorizationStage, MapLabelsToStage, TerminalLabelStage,
//	        AllTerminalLabelStages, IssueToPhaseStage all answer this.
//
//	WRITE — "could this label EVER be lifecycle-authoritative, under any
//	        configuration this deployment might adopt?"  Must not depend on
//	        today's config, because the label outlives the config that was in
//	        force when it was written.
//
// The write question is the one a scope gate has to ask. A label written today
// at a price of nothing, under a config that does not recognise it, becomes
// authoritative the moment the config changes — and nothing re-prices it. The
// config change is an ordinary operator edit, not an attack.
//
// MEASURED, round 10, at enabled=false, over eight label-delta shapes: every
// shape collapsed to "no transition", including the ones that cost task:claim
// and task:close at enabled=true. See the round-10 project log for the full
// four-arm causal decomposition; the short version is that THREE guards each
// independently suppress the pricing path, and unguarding any one or any two
// of them changes nothing observable.
//
// WHAT THIS CLOSES, AND WHAT IT DOES NOT. Round 10 was briefed to "close the
// class" over all five LabelConfig fields. That instruction is not literally
// satisfiable and the boundary is stated here rather than left for the next
// reader to discover:
//
//	axis 1  Enabled false->true          CLOSED — see lifecycleStageClaim.
//	axis 2  PushPrefix "ft:" -> "ft2:"   CLOSED — the claim is prefix-VALUE
//	                                     blind. It still requires a prefix
//	                                     delimiter, so GitHub's stock
//	                                     "duplicate" is still not captured and
//	                                     the round-4 fix is preserved.
//	axis 3  Stages gains an alias        NOT CLOSABLE HERE. Stages is
//	                                     map[string]string with arbitrary keys,
//	                                     so the set of labels that could become
//	                                     authoritative under SOME future alias
//	                                     is the set of ALL labels. Pricing every
//	                                     label as a stage assertion would deny
//	                                     legitimate work on every ordinary
//	                                     label edit. Current aliases ARE
//	                                     honoured; future ones need a
//	                                     config-CHANGE-time control, not a
//	                                     write-time one. Recorded as an open
//	                                     finding in the round-10 log.
//	axes 4/5 Priorities, Types           NOT APPLICABLE. Neither can make a
//	                                     label name a STAGE, which is the only
//	                                     thing the transition gate prices.
//	                                     checkLifecycleKeyCollisions already
//	                                     refuses a config that aims a priority
//	                                     or type key at a lifecycle label, so
//	                                     the crossover is closed at load time.
// ─────────────────────────────────────────────────────────────────────────────

// lifecycleStageClaim reports the stage a raw label could assert under any
// configuration this deployment might adopt, independent of the configuration
// in force right now.
//
// It is the WRITE-side counterpart to authorizationStage, and it differs in
// exactly two ways. Both differences are deliberate and both are fail-closed —
// this function can only ever claim MORE labels than authorizationStage, never
// fewer, so routing a gate through it can only ever charge more scope.
//
//  1. It ignores m.enabled. The mapping data is already toggle-blind:
//     labelToStage holds all ten stages at enabled=false (MEASURED, round 10 —
//     len(labelToStage)=10 with the toggle off). Only the accessors suppress
//     it. So "what could this label mean" is answerable with the toggle off,
//     and suppressing the answer is what let a stage assertion be written for
//     free and become authoritative later.
//
//  2. It is blind to the prefix VALUE, not merely to the toggle.
//     "ft2:stage/completed" is not authoritative under push_prefix "ft:", but
//     it becomes authoritative the moment an operator sets push_prefix to
//     "ft2:" — with no re-pricing of the labels already written.
//
// A NOTE ON WHAT REQUIREMENT 1 DOES *NOT* COST, because the first draft of
// this function got it wrong in the fail-open direction. It is tempting to
// exclude BARE stage names ("duplicate", "working") on the round-4 reasoning
// that a stock GitHub label must not decide a Farm Table privilege question.
// That reasoning is correct for authorizationStage and WRONG here, because the
// pricing path does not run only on authorizationStage: it falls through to
// IssueToPhaseStage -> MapLabelsToStage, which has never required a prefix. So
// bare names are ALREADY priced today. MEASURED at enabled=true, before this
// change:
//
//	add "duplicate" to a CLOSED issue    wont_fix -> duplicate    PRICED
//	add "working"   to an OPEN   issue   accepted -> working      PRICED
//	add "shipped"   (configured alias)   wont_fix -> completed    PRICED
//	add "ft2:stage/completed"            accepted -> accepted     NOT PRICED
//
// Excluding bare names would therefore have made the write claim NARROWER than
// what the read path already honours — a fail-open gap introduced by a fix
// aimed at closing one. Including them costs nothing new; the last row is the
// only genuine widening in this function, and it is a gap that exists at
// enabled=true as well, so axis 2 is not a toggle problem at all.
func (m *LabelMapper) lifecycleStageClaim(raw string) (task.Stage, bool) {
	if m == nil {
		return "", false
	}

	// Everything today's configuration honours. Keys in labelToStage are
	// already stripForMatch-normalised by NewLabelMapper, and stripForMatch is
	// the lookup every read path uses, so asking it here is asking the same
	// question the readers ask — not a reimplementation of it. This branch is
	// what keeps the claim a SUPERSET of the read side.
	if stage, ok := m.labelToStage[m.stripForMatch(raw)]; ok {
		return stage, true
	}

	// Prefix-VALUE-blind path: strip any namespace segment, then require what
	// remains to name a stage. This is the only branch that claims a label the
	// read side would refuse.
	bare, ok := stripAnyLifecyclePrefix(strings.ToLower(strings.TrimSpace(raw)))
	if !ok {
		return "", false
	}
	stage, ok := m.labelToStage[bare]
	return stage, ok
}

// stripAnyLifecyclePrefix removes one leading "<prefix>:" segment and one
// leading "stage/" segment from an already-lowercased, already-trimmed label,
// reporting whether the label was namespaced at all.
//
// The colon segment must not contain a slash, so "team/ft:x" is not read as a
// prefix — a slash before the colon means the colon is inside a path, not a
// namespace delimiter.
func stripAnyLifecyclePrefix(s string) (string, bool) {
	namespaced := false

	if i := strings.Index(s, ":"); i >= 0 && !strings.Contains(s[:i], "/") {
		s = s[i+1:]
		namespaced = true
	}
	if rest := strings.TrimPrefix(s, "stage/"); rest != s {
		s = rest
		namespaced = true
	}

	return s, namespaced
}

// writeViewMapper returns the mapper to use for WRITE-side stage computation:
// this one if label mapping is on, or an otherwise-identical mapper built with
// Enabled=true if it is off.
//
// This is the asIfEnabled idiom already established at
// checkLifecycleKeyCollisions (config.go), chosen over sprinkling toggle-blind
// variants across the accessors for the reason that comment gives: it is the
// SAME StageToLabel and the SAME IssueToPhaseStage, asked under the
// configuration whose consequences are in question, rather than a second
// implementation of them that can drift. One translation step and then the
// real functions, unchanged.
//
// Termination: the reconstructed config has Enabled=true, so the reconstructed
// mapper takes the first branch and never builds a third.
func (m *LabelMapper) writeViewMapper() *LabelMapper {
	if m == nil || m.enabled {
		return m
	}
	if m.writeView == nil {
		asIfEnabled := m.config
		asIfEnabled.Enabled = true
		m.writeView = NewLabelMapper(asIfEnabled)
	}
	return m.writeView
}

// canonicalLifecycleLabels rewrites every label carrying a lifecycle stage
// claim into the spelling THIS deployment would write for that stage, and
// passes everything else through untouched.
//
// This is the translation that lets the write path reuse IssueToPhaseStage
// rather than reimplement its demotion and closed-issue rules. A label that
// claims a stage under some other prefix is rewritten to the local prefix, so
// the fully-enabled view recognises it; a label that claims nothing is left
// exactly as it is, so nothing that was not a lifecycle assertion becomes one.
//
// Order is preserved and length is preserved, so a caller comparing two label
// sets before and after a delta compares like with like.
func (m *LabelMapper) canonicalLifecycleLabels(labels []string) []string {
	if m == nil || len(labels) == 0 {
		return labels
	}
	view := m.writeViewMapper()

	out := make([]string, len(labels))
	for i, raw := range labels {
		if stage, ok := m.lifecycleStageClaim(raw); ok {
			out[i] = view.StageToLabel(stage)
			continue
		}
		out[i] = raw
	}
	return out
}
