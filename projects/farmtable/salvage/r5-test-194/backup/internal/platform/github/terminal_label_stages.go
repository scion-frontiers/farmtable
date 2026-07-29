package github

import (
	"sort"
	"strings"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// authorizationStage maps one raw label to the stage it asserts, for readers
// that feed an authorization or terminal-stage determination.
//
// THE INVARIANT: a label may contribute to an authorization or terminal-stage
// determination only if it carries the configured push prefix. Prefix-tolerant
// matching is a display affordance and must not reach a security decision.
//
// The difference from stripForMatch, which is the display spelling of the same
// lookup, is the prefix REQUIREMENT. stripForMatch strips the prefix if present
// and matches the bare stage name either way, so "duplicate" — a label GitHub
// ships in every new repository, and which any triager can apply — maps to
// StageDuplicate exactly as "ft:stage/duplicate" does. That is right for a
// queue rendering and wrong for a gate: it lets a label with a lower permission
// bar, and no Farm Table meaning at all, decide a Farm Table privilege
// question. "duplicate" on an issue is a human's triage note; "ft:stage/
// duplicate" is an assertion that Farm Table's own close path wrote, or that
// someone deliberately impersonated.
//
// This was a REGRESSION INTRODUCED BY #194 round 4, not a pre-existing gap:
// round 3 collapsed the label set through stagePrecedence, which ranks every
// non-terminal stage above every terminal one, so a stock "duplicate" was
// invisible next to any ordinary stage label. Fixing the collapse — correctly —
// made it visible and authoritative in the same step. 12 cells changed answer.
// Measured narrowing: stock "wontfix" (no underscore) does NOT map, so the
// exposure is "duplicate" plus independently created labels, not all four.
//
// The 12 cells lose their terminal reading and become available again. That
// direction is the safe one — a task wrongly shown as live, not a privilege
// wrongly granted — and it is the accepted interim cost of closing the hole.
//
// An empty configured prefix means the default "ft:", not "no prefix required".
// Anything else would be incoherent: StageToLabel WRITES "ft:stage/..." under
// an empty config, so treating empty as "accept anything" would make the
// deployment that pushes our own labels the one deployment that also honours
// everyone else's.
func (m *LabelMapper) authorizationStage(raw string) (task.Stage, bool) {
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), m.matchPrefix()) {
		return "", false
	}
	stage, ok := m.labelToStage[m.stripForMatch(raw)]
	return stage, ok
}

// matchPrefix is the configured push prefix, lowercased, defaulting to "ft:".
//
// It is shared with stripForMatch rather than duplicated because the two must
// not drift: authorizationStage requires exactly the prefix stripForMatch
// strips, and if one of them changed its defaulting the requirement would stop
// lining up with the lookup — either rejecting our own labels or accepting
// everyone's. Since B6 this string is a security parameter, not a formatting
// preference.
func (m *LabelMapper) matchPrefix() string {
	if prefix := strings.ToLower(m.config.PushPrefix); prefix != "" {
		return prefix
	}
	return "ft:"
}

// AllTerminalLabelStages reports EVERY terminal stage a label set names, not
// the one a tiebreak selects.
//
// TerminalLabelStage answers "which terminal stage is this?" and has to pick
// one, because its callers want a single stage. That question is the wrong one
// to put in an authorization path, and the reason is not the order the tiebreak
// uses:
//
//	A bypass occurs iff rank(dest) < rank(start), so the rank-0 element is
//	reachable from every other terminal stage. Every total order has a rank-0
//	element, so reordering terminalStagePrecedence only moves WHICH stage is
//	free — it cannot remove the property. Measured: 6 of the 12 ordered
//	terminal->terminal pairs converted with task:write alone, and the
//	prediction encoded before the run missed none of them.
//
// So the tiebreak order is not a neutral display detail in this path; it is an
// access-control parameter. The fix is to stop selecting: evaluate the
// transition against every terminal stage present and demand the strongest
// scope. With two distinct terminal labels on an issue, from == to can hold for
// at most one of them, so the other necessarily falls to the "any -> terminal
// costs task:close" row and the whole conversion class closes — including the
// variant where the attacker writes no label at all and merely re-asserts a
// stage the issue already carries.
//
// TWO PROPERTIES THIS DELIBERATELY DOES NOT SHARE WITH TerminalLabelStage:
//
//   - Membership is decided by store.IsTerminalStage, the single source of
//     truth for terminality, and NOT by presence in terminalStagePrecedence.
//     That tiebreak loop fails open — a stage IsTerminalStage calls terminal
//     but that is missing from the list is silently dropped and reported
//     non-terminal, which is the exact value the seam exists to avoid. Making
//     that loop total is a separate, safe change and is sequenced separately;
//     this function is built so that it never inherits the defect.
//   - Ordering is by stage name, which is total by construction and cannot
//     drop an element. Callers need determinism only for reproducibility —
//     they consume the whole slice — so nothing here depends on which stage
//     comes first, and no future reorder of terminalStagePrecedence can change
//     an authorization answer through this function.
//
// TerminalLabelStage's signature and callers are untouched; the other sinks
// that read it are being sequenced separately.
func (m *LabelMapper) AllTerminalLabelStages(labels []string) []task.Stage {
	// Mirrors TerminalLabelStage's guard: with label mapping off,
	// IssueToPhaseStage declines to map labels too, so no demotion happens and
	// the task's own Stage is already authoritative. Scanning anyway would make
	// a disabled mapper start honouring labels it is configured to ignore. The
	// nil check is because callers reach this from a zero-value store.
	if m == nil || !m.enabled {
		return nil
	}

	present := make(map[task.Stage]bool, len(labels))
	for _, raw := range labels {
		if stage, ok := m.authorizationStage(raw); ok && store.IsTerminalStage(stage) {
			present[stage] = true
		}
	}
	if len(present) == 0 {
		return nil
	}

	out := make([]task.Stage, 0, len(present))
	for stage := range present {
		out = append(out, stage)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}
