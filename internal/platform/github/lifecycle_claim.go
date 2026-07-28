package github

import (
	"strings"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// ─────────────────────────────────────────────────────────────────────────────
// THE WRITE-SIDE PREDICATE (#194, round 10, narrowed in round 11)
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
// ── WHAT ROUND 11 MEASURED BEFORE CHANGING ANYTHING ─────────────────────────
//
// Round 10 stripped ANY leading "<x>:" segment and matched the remainder
// against bare stage names. Stage names are ordinary English words, so that
// denied ordinary work. MEASURED, default config, toggle ON, narrow principal,
// base 06f01d7 vs round-10 HEAD 6d8f19e vs here:
//
//	label added          base 06f01d7   round 10        round 11 (here)
//	status:duplicate     allowed        DENIED          allowed
//	kanban:working       allowed        DENIED          allowed
//	release:completed    allowed        DENIED          allowed
//	epic:cancelled       allowed        DENIED          allowed
//
// The remedy is to require a recognised CATEGORY-SEGMENT MARKER rather than
// merely a namespace delimiter. The marker is not guessed. MEASURED: for every
// stage and for every push_prefix tried (ft: ft2: "" "  " FT: acme/ ft- ft.
// ft_ a:b: team/ft: U+200B), StageToLabel emits exactly
//
//	pushPrefix + "stage/" + stage.String()
//
// so "stage/" IS the segment the internal convention uses to construct a
// lifecycle-stage label. See lifecycleMarker below.
//
// ── THE MEASUREMENT THAT DECIDED WHERE THE MARKER RULE MAY BE APPLIED ───────
//
// It may NOT be applied to the whole claim, and that is the round-11 finding
// that matters most here.
//
// authorizationStage honours far more than StageToLabel emits, because
// stripForMatch strips the prefix and then trims "stage/", "priority/" and
// "priority:" SEQUENTIALLY — eight accepted segment sequences, only four of
// which contain "stage/" at all. MEASURED, DefaultConfig:
//
//	|labelToStage| = 10 keys  x  8 segment sequences  =  80 authoritative cells
//	of those 80, 40 carry NO "stage/" segment, e.g.
//	  ft:completed            authorizationStage -> (completed, true)
//	  ft:priority:completed   authorizationStage -> (completed, true)
//	  ft:priority/completed   authorizationStage -> (completed, true)
//	and only 10 of the 80 are spellings StageToLabel ever emits.
//	With one configured alias the count is 88. At enabled=false it is 0.
//
// So requiring the marker EVERYWHERE would make this predicate NARROWER than
// the read side — a fail-open gap opened by a fix aimed at closing one, which
// is the exact failure mode round 10 hit from the other direction. The marker
// requirement is therefore applied ONLY to the prefix-VALUE-blind branch. The
// today's-config branch is untouched and is what holds the superset invariant
// up. TestLifecycleStageClaim_IsASupersetOfAuthorizationStage pins it over the
// whole grid, so a future edit that moves the marker rule into the first branch
// fails there rather than in production.
//
// ── WHAT THIS CLOSES, AND WHAT IT DOES NOT ──────────────────────────────────
//
// Round 10 was briefed to "close the class" over all five LabelConfig fields.
// That instruction is not literally satisfiable and the boundary is stated here
// rather than left for the next reader to discover:
//
//	axis 1  Enabled false->true          CLOSED — see lifecycleStageClaim.
//	axis 2  PushPrefix "ft:" -> "ft2:"   NARROWED, NOT CLOSED. The round-10
//	                                     comment here said "CLOSED — the claim
//	                                     is prefix-VALUE blind"; that was false
//	                                     as written. Residue named below.
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
//	                                     write-time one. NOTHING IN THIS FILE
//	                                     CLAIMS TO COVER AXIS 3.
//	axes 4/5 Priorities, Types           NOT APPLICABLE, and for a plainer
//	                                     reason than round 10 gave. Neither can
//	                                     make a label name a STAGE, which is the
//	                                     only thing the transition gate prices,
//	                                     and both are already writable with
//	                                     task:write via UpdateTask(priority=…).
//
// AXIS-2 RESIDUE, NAMED. MEASURED at round-11 HEAD, default push_prefix "ft:",
// narrow principal, OPEN issue at accepted:
//
//	spelling                 priced?  becomes authoritative when...
//	ft2:stage/completed      YES      push_prefix -> "ft2:"
//	ft2/stage/completed      YES      push_prefix -> "ft2/"
//	acme/stage/completed     YES      push_prefix -> "acme/"
//	ft-stage/completed       YES      push_prefix -> "ft-"
//	ft.stage/completed       YES      push_prefix -> "ft."
//	ft_stage/completed       YES      push_prefix -> "ft_"
//	a:b:stage/completed      YES      push_prefix -> "a:b:"
//	ft2:completed            NO   <-- push_prefix -> "ft2:"     RESIDUE
//	ft2/completed            NO   <-- push_prefix -> "ft2/"     RESIDUE
//
// The residue is FORCED, not an oversight. "ft2:completed" and
// "release:completed" are the SAME STRING SHAPE — <namespace><delimiter><bare
// stage name> — because "release:" is itself a legal push_prefix. No predicate
// can price the first and free the second. Round 10 priced both and denied
// legitimate work; round 11 frees both and leaves the residue. Reaching the
// residue requires an operator to change push_prefix to the exact foreign
// prefix already planted.
// ─────────────────────────────────────────────────────────────────────────────

// lifecycleMarker is the category segment that constructs a lifecycle-stage
// label in this codebase. It is not a convention someone remembered: MEASURED,
// StageToLabel emits pushPrefix + lifecycleMarker + stage.String() for every
// stage under every push_prefix tried, and
// TestLifecycleMarker_IsWhatStageToLabelActuallyEmits fails if that stops being
// true.
const lifecycleMarker = "stage/"

// lifecycleStageClaim reports the stage a raw label could assert under any
// configuration this deployment might adopt, independent of the configuration
// in force right now.
//
// It is the WRITE-side counterpart to authorizationStage, and it differs in
// exactly two ways. Both differences are deliberate and both are fail-closed
// AS A FILTER OVER LABELS: this function can only ever claim MORE labels than
// authorizationStage, never fewer.
//
// THAT PROPERTY IS ABOUT THIS FUNCTION, NOT ABOUT THE PRICE, and round 10's
// comment here drew the wrong conclusion from it. It said "so routing a gate
// through it can only ever charge more scope". The premise is true — verified
// independently at 8400 cells and 204 pairs, zero violations, and pinned again
// here. The conclusion was FALSE and cost round 10 a Critical: a wider
// predicate charges more only where it appears ONCE. In
// LabelDeltaLifecycleStages the predicate appeared on BOTH SIDES of a set
// difference, so widening the BEFORE endpoint collapsed it onto AFTER and the
// write priced at nothing — 29 measured cells, including stock GitHub
// "duplicate" masking a task:close. The monotone-in-the-price statement now
// belongs to LabelDeltaLifecycleStages, which is where it is enforced and where
// TestLabelWritePrice_IsMonotoneInThePredicate pins it. Here the claim is
// scoped to what this function actually is: a filter over labels, consumed by
// assertStageWriteAllowed, where refusing more IS charging more.
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
// IssueToPhaseStage -> MapLabelsToStage, which has never required a prefix.
//
// ROUND 10 JUSTIFIED THAT WITH TWO ROWS THAT BOTH AVOID THE CASE THAT CHANGED,
// and the corrected table is below. Its rows were `add "duplicate" to a CLOSED
// issue` and `add "working" to an OPEN issue`; the case that actually changed
// is a bare TERMINAL name on an OPEN issue, where IssueToPhaseStage's rule-2
// demotion applies. MEASURED at enabled=true, base 06f01d7, narrow principal:
//
//	add "duplicate" to a CLOSED issue    wont_fix -> duplicate    PRICED
//	add "working"   to an OPEN   issue   accepted -> working      PRICED
//	add "shipped"   (configured alias)   wont_fix -> completed    PRICED
//	add "duplicate" to an OPEN   issue   accepted -> accepted     NOT PRICED  <-- the case
//	add "ft2:stage/completed"            accepted -> accepted     NOT PRICED
//
// So bare names are priced today in three of five shapes, not all of them, and
// the fourth row is precisely the input the round-10 Critical exploited: the
// demotion makes a bare terminal name invisible to the price, while
// canonicalising the task's EXISTING labels made it visible to the BEFORE
// endpoint. Excluding bare names here would still make the write claim
// narrower than what the read path honours, so they stay in; what changed in
// round 11 is that the BEFORE endpoint no longer sees them. See
// LabelDeltaLifecycleStages.
func (m *LabelMapper) lifecycleStageClaim(raw string) (task.Stage, bool) {
	if m == nil {
		return "", false
	}

	// BRANCH 1 — everything today's configuration honours. Keys in labelToStage
	// are already stripForMatch-normalised by NewLabelMapper, and stripForMatch
	// is the lookup every read path uses, so asking it here is asking the same
	// question the readers ask — not a reimplementation of it. This branch is
	// what keeps the claim a SUPERSET of the read side, and it is deliberately
	// NOT subject to the marker requirement: 40 of the 80 spellings
	// authorizationStage honours under DefaultConfig carry no "stage/" segment
	// (measured; see the file header), so a marker requirement here would open
	// a fail-open gap.
	if stage, ok := m.labelToStage[m.stripForMatch(raw)]; ok {
		return stage, true
	}

	// BRANCH 2 — prefix-VALUE-blind path, and the only branch that claims a
	// label the read side would refuse. Requires a recognised category-segment
	// marker; the prefix value in front of it is irrelevant.
	suffix, ok := lifecycleMarkerSuffix(strings.ToLower(strings.TrimSpace(raw)))
	if !ok {
		return "", false
	}
	stage, ok := m.labelToStage[suffix]
	return stage, ok
}

// lifecycleMarkerSuffix reports the text following a recognised lifecycleMarker
// segment in an already-lowercased, already-trimmed label.
//
// DELIMITER-AGNOSTIC, AND WIDER THAN "COLON OR SLASH". The governing ruling's
// normative sentence says "recognise the category segment following either a
// colon or a slash", but its own worked examples require more than that: it
// lists "ft-stage/completed" as pricing identically to "ft:stage/completed",
// and the review's spelling list adds "ft.stage/completed" and
// "ft_stage/completed". Colon-or-slash cannot recognise those three. So the
// delimiter class implemented here is "any byte that is not an ASCII letter or
// digit", a strict superset of the normative sentence that covers every example
// either document gives. Choosing the superset is the fail-CLOSED direction: it
// claims more labels, and a claim only ever refuses a write.
//
// THE BOUNDARY TEST IS THE POINT. Requiring a delimiter is what stops
// "notastage/completed" — which contains the six characters "stage/" — from
// being read as namespaced, and so stops the marker rule from re-creating the
// denial-of-legitimate-work bug it exists to fix. Position 0 counts as a
// boundary, so bare "stage/completed" is recognised.
//
// The LAST qualifying occurrence wins, so "ft:stage/stage/completed" resolves
// to "completed" rather than to "stage/completed". Fail-closed again: the
// alternative reads a nested spelling as unclaimed.
//
// Non-ASCII is handled by byte, not by rune. The byte preceding the marker in a
// multi-byte sequence is a UTF-8 continuation byte, which is not an ASCII
// alphanumeric and therefore counts as a delimiter. That errs toward claiming
// more, which is the safe direction, and it is why this need not decode runes.
func lifecycleMarkerSuffix(s string) (string, bool) {
	for i := len(s) - len(lifecycleMarker); i >= 0; i-- {
		if !strings.HasPrefix(s[i:], lifecycleMarker) {
			continue
		}
		if i == 0 || isLabelSegmentDelimiter(s[i-1]) {
			return s[i+len(lifecycleMarker):], true
		}
	}
	return "", false
}

// isLabelSegmentDelimiter reports whether b can end a namespace segment. Input
// is always already lowercased, so upper case needs no case here.
//
// TestPushPrefixDelimiterClass_MatchesWhatTheClaimRecognises pins that this is
// the SAME class GitHubConfig.Validate constrains push_prefix to. That is what
// makes "every push_prefix a deployment can legally hold is recognised by the
// claim" true by construction rather than by review.
func isLabelSegmentDelimiter(b byte) bool {
	switch {
	case b >= 'a' && b <= 'z':
		return false
	case b >= '0' && b <= '9':
		return false
	default:
		return true
	}
}

// writeView is a LabelMapper that has been asked the WRITE question. It is a
// distinct TYPE, not a differently-named variable, and that is the whole
// mechanism.
//
// The read/write partition rests on the write-side pricing path calling the
// fully-enabled view rather than the mapper it was handed. Spelled as two
// *LabelMapper values, BOTH SPELLINGS COMPILE AND BOTH TYPE-CHECK, so a future
// edit that writes s.mapper where it means the write view silently reverts this
// whole workstream at enabled=false, with no test failing in a way that names
// the cause.
//
// WHAT MAKES THIS BITE, stated explicitly because a standing "make it
// unrepresentable" preference was measured on a sibling branch to have produced
// a control that looked structural and was inert: the pricing method is
// declared on writeView and NOT on *LabelMapper. `s.mapper.claimedStages(...)`
// is therefore not a weaker spelling of the same thing — it does not exist, and
// the compiler rejects it as undefined. The receiver type is genuinely checked;
// this is not a naming convention wearing a struct.
//
// Same move stageWritePolicy made when it was converted from a named bool to a
// struct so the authorization-relevant parameter could not be spelled without
// naming a policy (passthrough.go).
type writeView struct{ *LabelMapper }

// writeViewMapper returns the mapper to use for WRITE-side stage computation:
// this one if label mapping is on, or the otherwise-identical Enabled=true
// mapper NewLabelMapper built alongside it if it is off.
//
// This is the asIfEnabled idiom already established at
// checkLifecycleKeyCollisions (config.go), chosen over sprinkling toggle-blind
// variants across the accessors for the reason that comment gives: it is the
// SAME StageToLabel and the SAME IssueToPhaseStage, asked under the
// configuration whose consequences are in question, rather than a second
// implementation of them that can drift.
//
// IT DOES NOT BUILD ANYTHING, AND THAT IS A FIX. Round 10 built the view lazily
// and cached it in a field, which made LabelMapper mutable for the first time
// and put an unlocked write on a pointer that MultiStore.lazyResolve caches per
// collection and hands to every request goroutine. Two -race reports followed,
// and the worse one was a read of that new field racing NewLabelMapper's
// construction with no happens-before edge: an observer could see
// enabled=false, an empty labelToStage or an empty PushPrefix, EVERY ONE of
// which biases toward refusing to recognise a label and therefore toward
// pricing a lifecycle write as FREE. Building eagerly in NewLabelMapper removes
// the concept instead of guarding it — LabelMapper is immutable again, so there
// is nothing to lock and no termination argument to keep correct.
func (m *LabelMapper) writeViewMapper() writeView {
	if m == nil || m.enabled {
		return writeView{m}
	}
	return writeView{m.writeView}
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
// APPLY THIS TO LABELS BEING WRITTEN, NEVER TO LABELS ALREADY PRESENT. That
// restriction IS the round-10 Critical, stated as a rule. Canonicalisation
// turns a non-authoritative label into an authoritative one, so applying it to
// a task's existing labels re-prices the state the caller is transitioning
// FROM — and a stronger FROM makes the transition CHEAPER, not dearer.
// MEASURED at round-10 HEAD, with it applied to the existing set: an OPEN issue
// carrying stock GitHub "duplicate" priced `add ft:stage/duplicate` at NOTHING
// for a task:write holder, and the same edit cost task:close without the
// masking label. LabelDeltaLifecycleStages enforces the restriction.
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
