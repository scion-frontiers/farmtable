package github

import (
	"strings"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// stagePrecedence defines conflict resolution order: earlier index wins.
// When multiple label-mapped stages appear on a single issue, the stage
// with the lowest index in this slice is selected.
//
// THIS ORDERING IS A DISPLAY RULE. AUTHORIZATION MUST NOT DEPEND ON IT.
//
// It answers "which single stage should this issue show in a queue?", and it
// answers it by ranking every non-terminal stage above every terminal one so
// that live work is never rendered as finished. That bias is correct for a
// display and catastrophic for a privilege check: any function that asks
// MapLabelsToStage "is this issue terminal?" is told "no" the moment one
// ordinary non-terminal label is present, because the collapse hid the
// terminal label before the question was asked (#194 round 3, audit F1 —
// 12 of 16 label combinations bypassed the accept gate that way).
//
// A check that derives from a projection built to answer a different question
// inherits that question's bias. TerminalLabelStage below therefore scans the
// label set directly and resolves ties with terminalStagePrecedence, which is
// declared separately for exactly this reason.
// TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast pins the ordering.
var stagePrecedence = []task.Stage{
	task.StageWorking,
	task.StageInReview,
	task.StageInQa,
	task.StageDeploying,
	task.StageAccepted,
	task.StageTriage,
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
}

// terminalStagePrecedence resolves which terminal stage TerminalLabelStage
// reports when one issue names more than one of them. Earlier index wins.
//
// It is declared separately from stagePrecedence rather than derived by
// filtering it, and that is deliberate. Filtering would leave the privilege
// decision coupled to the display rule: reordering stagePrecedence's terminal
// tail would silently change which stage the authorization gate sees as the
// transition source, and the guard test for stagePrecedence only forbids
// moving a terminal stage above a non-terminal one — it says nothing about the
// order *among* the terminals. Two orderings that answer two different
// questions must be two declarations, or the next reorder re-couples them.
//
// Every terminal stage must appear here or a label naming it becomes invisible
// to the gate; TestTerminalStagePrecedence_CoversEveryTerminalStage pins that.
var terminalStagePrecedence = []task.Stage{
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
}

// allStages enumerates every valid Stage for default auto-mapping.
var allStages = []task.Stage{
	task.StageTriage,
	task.StageAccepted,
	task.StageWorking,
	task.StageInReview,
	task.StageInQa,
	task.StageDeploying,
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
}

// defaultPriorityMap maps lowercase label text to priority values.
var defaultPriorityMap = map[string]task.Priority{
	"urgent": task.PriorityUrgent,
	"high":   task.PriorityHigh,
	"normal": task.PriorityNormal,
	"low":    task.PriorityLow,
}

// defaultTypeLabels lists label names that map directly to task types.
var defaultTypeLabels = map[string]string{
	"bug":     "bug",
	"feature": "feature",
	"task":    "task",
	"design":  "design",
}

// LabelMapper provides bidirectional mapping between GitHub labels and
// Farm Table stage/priority/type values.
type LabelMapper struct {
	config          LabelConfig
	enabled         bool
	stageToLabel    map[task.Stage]string
	priorityToLabel map[task.Priority]string
	typeToLabel     map[string]string

	// Pull-direction lookup tables (label -> value), built from defaults
	// plus custom config overrides. Keys are lowercased for case-insensitive matching.
	labelToStage    map[string]task.Stage
	labelToPriority map[string]task.Priority
	labelToType     map[string]string
}

// NewLabelMapper builds a LabelMapper from the given LabelConfig.
// It constructs forward (value->label) and reverse (label->value) maps,
// applying custom config mappings on top of defaults.
func NewLabelMapper(cfg LabelConfig) *LabelMapper {
	m := &LabelMapper{
		config:          cfg,
		enabled:         cfg.Enabled,
		stageToLabel:    make(map[task.Stage]string),
		priorityToLabel: make(map[task.Priority]string),
		typeToLabel:     make(map[string]string),
		labelToStage:    make(map[string]task.Stage),
		labelToPriority: make(map[string]task.Priority),
		labelToType:     make(map[string]string),
	}

	// One resolution, shared with the reader (matchPrefix). See
	// resolvePushPrefix for why the writer and the reader must not each carry
	// their own defaulting rule.
	prefix := m.pushPrefix()

	// --- Stage mappings ---

	// Default: each stage string value maps to itself.
	for _, s := range allStages {
		label := strings.ToLower(s.String())
		m.labelToStage[label] = s
		m.stageToLabel[s] = prefix + "stage/" + s.String()
	}

	// Custom config overrides: label->stage (pull direction).
	// Also generates the push label using the same prefix convention.
	//
	// The key is normalised with stripForMatch — the SAME function every lookup
	// goes through — rather than with a bare ToLower. Storing the key one way
	// and looking it up another is why a configured alias could be dead
	// (test review T-1, audit A-5):
	//
	//	Stages: {"ft:shipped": "completed"}   -- an operator following round 5's
	//	                                         remediation literally
	//	  label "ft:shipped"  -> stripForMatch -> "shipped" -> MISS (key is "ft:shipped")
	//	  label "shipped"     -> stripForMatch -> "shipped" -> MISS
	//	  label "ft:ft:shipped" -> stripForMatch -> "ft:shipped" -> hit (!)
	//
	// So the alias was reachable only as a DOUBLE prefix, and was dead for
	// display as well as for authorization. Normalising the key on the way in
	// means a key works whether or not the operator wrote the prefix, and A-5's
	// double-prefix spelling stops resolving because "ft:ft:shipped" strips
	// exactly once to "ft:shipped", which is no longer any key.
	//
	// This does NOT make a bare label authoritative: B6's prefix REQUIREMENT
	// lives in authorizationStage and is applied to the label, not to the key.
	// A configured alias still has to be spelled with the prefix ON THE LABEL
	// to reach a privilege decision — it is only the config key that is now
	// spelling-insensitive. TestConfiguredStageAliases_KeySpellingIsNormalised
	// pins both halves.
	for label, stageStr := range cfg.Stages {
		stage := task.Stage(stageStr)
		if err := task.StageValidator(stage); err == nil {
			m.labelToStage[m.stripForMatch(label)] = stage
			// Custom mappings also set the push label for that stage.
			m.stageToLabel[stage] = prefix + "stage/" + stage.String()
		}
	}

	// --- Priority mappings ---

	// Default priority map.
	for label, p := range defaultPriorityMap {
		m.labelToPriority[label] = p
		m.priorityToLabel[p] = "priority:" + p.String()
	}

	// Custom config overrides. Keys are normalised with stripForMatch for the
	// same reason cfg.Stages' are: the lookup strips, so a key stored unstripped
	// can never be hit. Measured in round 6 — a configured "ft:p0" was dead in
	// both spellings, exactly as "ft:shipped" was. Not a security surface (no
	// prefix requirement applies on the priority path), but the same operator
	// trap, and leaving two of the three maps on the old rule would be the
	// duplicated-rule defect this round is otherwise removing.
	for label, prioStr := range cfg.Priorities {
		p := task.Priority(prioStr)
		if err := task.PriorityValidator(p); err == nil {
			m.labelToPriority[m.stripForMatch(label)] = p
			m.priorityToLabel[p] = "priority:" + p.String()
		}
	}

	// --- Type mappings ---

	// Defaults: each type value maps to itself as a label.
	for label, typ := range defaultTypeLabels {
		m.labelToType[label] = typ
		m.typeToLabel[typ] = label
	}

	// Custom config overrides. Pull key normalised as above; the PUSH label
	// keeps the operator's literal spelling, because that is the label they
	// want written on GitHub and nothing requires a prefix on it.
	for label, typ := range cfg.Types {
		m.labelToType[m.stripForMatch(label)] = typ
		m.typeToLabel[typ] = strings.ToLower(label)
	}

	return m
}

// MapLabelsToStage scans labels for stage mappings and returns the
// highest-precedence match. Labels are matched case-insensitively.
// The push_prefix (e.g. "ft:") is stripped before matching, so both
// "working" and "ft:stage/working" will match StageWorking.
func (m *LabelMapper) MapLabelsToStage(labels []string) (task.Stage, bool) {
	if !m.enabled {
		return "", false
	}

	candidates := make(map[task.Stage]bool)

	for _, raw := range labels {
		key := m.stripForMatch(raw)
		if stage, ok := m.labelToStage[key]; ok {
			candidates[stage] = true
		}
	}

	if len(candidates) == 0 {
		return "", false
	}

	// Return highest-precedence stage.
	for _, s := range stagePrecedence {
		if candidates[s] {
			return s, true
		}
	}

	// Shouldn't happen, but return the first candidate found.
	for s := range candidates {
		return s, true
	}
	return "", false
}

// MapLabelsToPriority scans labels for priority mappings and returns the
// first match found. Labels are matched case-insensitively with prefix stripping.
func (m *LabelMapper) MapLabelsToPriority(labels []string) (*task.Priority, bool) {
	if !m.enabled {
		return nil, false
	}

	for _, raw := range labels {
		key := m.stripForMatch(raw)
		if p, ok := m.labelToPriority[key]; ok {
			return &p, true
		}
	}
	return nil, false
}

// MapLabelsToType scans labels for type mappings and returns the first match.
// Labels are matched case-insensitively with prefix stripping.
func (m *LabelMapper) MapLabelsToType(labels []string) (string, bool) {
	if !m.enabled {
		return "", false
	}

	for _, raw := range labels {
		key := m.stripForMatch(raw)
		if t, ok := m.labelToType[key]; ok {
			return t, true
		}
	}
	return "", false
}

// StageToLabel returns the GitHub label name for a given stage, using
// the push_prefix. Example: StageWorking -> "ft:stage/working".
func (m *LabelMapper) StageToLabel(s task.Stage) string {
	if !m.enabled {
		return ""
	}

	if label, ok := m.stageToLabel[s]; ok {
		return label
	}
	// Same resolution as NewLabelMapper's table build and as the reader's
	// matchPrefix: this fallback fires for a stage absent from stageToLabel,
	// and it must spell the prefix the readers will require of it.
	return m.pushPrefix() + "stage/" + s.String()
}

// PriorityToLabel returns the GitHub label name for a given priority.
// Example: PriorityHigh -> "priority:high".
func (m *LabelMapper) PriorityToLabel(p task.Priority) string {
	if !m.enabled {
		return ""
	}

	if label, ok := m.priorityToLabel[p]; ok {
		return label
	}
	return "priority:" + p.String()
}

// StageLabelSwap computes the label add/remove sets needed to transition
// an issue from its current labels to a new stage. It removes any existing
// stage labels and adds the label for newStage.
func (m *LabelMapper) StageLabelSwap(currentLabels []string, newStage task.Stage) (add []string, remove []string) {
	if !m.enabled {
		return nil, nil
	}

	newLabel := m.StageToLabel(newStage)

	for _, raw := range currentLabels {
		key := m.stripForMatch(raw)
		if _, isStage := m.labelToStage[key]; isStage {
			if raw != newLabel {
				remove = append(remove, raw)
			}
		}
	}

	// Check if the new label is already present.
	found := false
	for _, raw := range currentLabels {
		if raw == newLabel {
			found = true
			break
		}
	}
	if !found {
		add = append(add, newLabel)
	}

	return add, remove
}

// PriorityLabelSwap computes the label add/remove sets needed to transition
// an issue to a new priority.
func (m *LabelMapper) PriorityLabelSwap(currentLabels []string, newPriority task.Priority) (add []string, remove []string) {
	if !m.enabled {
		return nil, nil
	}

	newLabel := m.PriorityToLabel(newPriority)

	for _, raw := range currentLabels {
		key := m.stripForMatch(raw)
		if _, isPrio := m.labelToPriority[key]; isPrio {
			if raw != newLabel {
				remove = append(remove, raw)
			}
		}
	}

	found := false
	for _, raw := range currentLabels {
		if raw == newLabel {
			found = true
			break
		}
	}
	if !found {
		add = append(add, newLabel)
	}

	return add, remove
}

// TypeToLabel returns the GitHub label name for a given task type.
// Unlike StageToLabel/PriorityToLabel (which return generated fallback labels
// for unknown enum values), TypeToLabel returns "" for unknown types because
// types are open-ended strings — generating a label for an arbitrary string
// would create orphaned labels on GitHub. The caller (TypeLabelSwap) guards
// against the empty return with a newLabel != "" check.
func (m *LabelMapper) TypeToLabel(typ string) string {
	if !m.enabled {
		return ""
	}

	if label, ok := m.typeToLabel[typ]; ok {
		return label
	}
	return ""
}

// TypeLabelSwap computes the label add/remove sets needed to transition
// an issue from its current labels to a new type.
func (m *LabelMapper) TypeLabelSwap(currentLabels []string, newType string) (add []string, remove []string) {
	if !m.enabled {
		return nil, nil
	}

	newLabel := m.TypeToLabel(newType)

	for _, raw := range currentLabels {
		key := m.stripForMatch(raw)
		if _, isType := m.labelToType[key]; isType {
			if raw != newLabel {
				remove = append(remove, raw)
			}
		}
	}

	if newLabel != "" {
		found := false
		for _, raw := range currentLabels {
			if raw == newLabel {
				found = true
				break
			}
		}
		if !found {
			add = append(add, newLabel)
		}
	}

	return add, remove
}

// IssueToPhaseStage determines the Farm Table phase and stage for a GitHub
// issue based on its state, stateReason, and labels.
//
// Logic:
//  1. If state is "closed", use stateReason to pick the stage:
//     - "not_planned" -> PhaseClosed, StageWontFix
//     - otherwise     -> PhaseClosed, StageCompleted
//  2. If labels map to a stage, use that stage with the appropriate phase.
//  3. Fallback: open -> (PhaseOpen, StageAccepted), closed -> (PhaseClosed, StageCompleted).
//
// GitHub's own issue state is authoritative in both directions, and that
// symmetry is the point. Labels are advisory metadata that anything can write
// and nothing keeps in sync; state is not. So a closed issue is closed however
// its labels are stamped, and — rule 2's exception below — an open issue is
// open however its labels are stamped.
func (m *LabelMapper) IssueToPhaseStage(state, stateReason string, labels []string) (task.Phase, task.Stage) {
	isClosed := issueStateClosed(state)

	// For closed issues, labels can still override the stage, but we default
	// based on stateReason.
	if isClosed {
		// Check labels first for a more specific stage.
		if stage, ok := m.MapLabelsToStage(labels); ok {
			return phaseForStage(stage), stage
		}
		// Default closed mapping based on stateReason.
		if strings.EqualFold(stateReason, "not_planned") {
			return task.PhaseClosed, task.StageWontFix
		}
		return task.PhaseClosed, task.StageCompleted
	}

	// Open issue: labels determine stage, except that a terminal stage label
	// may not outrank GitHub saying the issue is open.
	//
	// A terminal label on an open issue is reachable three ways, and none of
	// them means the work is finished:
	//
	//   - Reopen. CloseTask writes a terminal stage label; reopening an issue
	//     is an ordinary GitHub operation that clears state and closedAt but
	//     leaves labels alone. In a pass-through collection GitHub is the UI,
	//     so this happens outside Farm Table entirely (audit-194 F2).
	//   - UpdateTask. ft update --stage completed relabels the issue without
	//     closing it, because updateIssue never changes issue state
	//     (audit-194 F7).
	//   - A partially failed close, the case the ordering comment in CloseTask
	//     already reasons about.
	//
	// Treating those as terminal reports live work as finished to every agent
	// and human reading the queue. That is worse than the reverse error, not
	// better: availability is advisory in the pass-through store, so nothing
	// downstream re-checks it, and the failure is silent. Demote to accepted —
	// the same stage an unlabelled open issue gets — and let a real close be
	// what closes a task.
	if stage, ok := m.MapLabelsToStage(labels); ok && !store.IsTerminalStage(stage) {
		return phaseForStage(stage), stage
	}

	// Fallback for open issues: use StageAccepted, not StageTriage.
	// An unlabelled GitHub issue was never explicitly triaged — it was
	// never placed in triage, so treating it as accepted-but-unprioritized
	// keeps ClaimTask working.  StageTriage + the auth-stage4 accept gate
	// would block ALL roles (including admin) from claiming unlabelled issues
	// on pass-through collections.
	return phaseForStage(task.StageAccepted), task.StageAccepted
}

// TerminalLabelStage reports the terminal stage a label set names, if any.
//
// This is the un-demoted counterpart to the rule-2 exception in
// IssueToPhaseStage above. That exception deliberately hides a terminal label
// on an OPEN issue, reporting "accepted" instead, so live work is never
// presented as finished. Hiding it is right for DISPLAY and wrong for anything
// that grants privilege or schedules work: a maintainer's wont_fix must still
// cost task:accept to undo, and must not be offered to an agent as ready work.
//
// Callers that need the authoritative lifecycle stage go through
// GitHubPassThroughStore.LifecycleStage, which is built on this. Deliberately
// returns only TERMINAL stages: a non-terminal label is never demoted, so for
// every other stage the task's own Stage field is already the right answer.
//
// It scans the label set directly and MUST NOT be reimplemented on top of
// MapLabelsToStage. That is how round 3 got this wrong: MapLabelsToStage
// collapses the set to a single highest-precedence winner, and stagePrecedence
// ranks every non-terminal stage above every terminal one, so one extra
// ordinary label made the terminal label invisible here and returned ("",
// false) — the exact value the seam exists to avoid. 12 of 16 label
// combinations bypassed the accept gate, and the same root cause reopened the
// availability and claim gates (#194 round 3, audit F1/F2, test F7). The
// attacker did not even need a second actor: add_labels is guarded only by the
// blanket task:write, so one token could add the masking label and then walk
// through the gate it had just opened.
//
// Terminal-ness is a property of the SET, not of the precedence winner. The
// question here is "does this label set name a terminal stage at all?", and
// the answer must not depend on what else the issue happens to be labelled.
//
// The scan goes through authorizationStage, not stripForMatch, so only a label
// carrying the configured push prefix counts. A label may contribute to an
// authorization or terminal-stage determination only if it is unambiguously
// ours; prefix-tolerant matching is a display affordance. See
// authorizationStage for why, and for the twelve cells that changed answer.
//
// This function still picks ONE stage and its callers still need that, but an
// authorization decision must not depend on which of several equally present
// values a tiebreak selects. Callers on a privilege path use
// AllTerminalLabelStages instead; the remaining single-answer sinks are
// sequenced separately (#194 round 5).
//
// !m.enabled returns false rather than scanning: with label mapping off,
// IssueToPhaseStage also declines to map labels, so no demotion happens and
// the task's own Stage is already authoritative. Scanning anyway would make a
// disabled mapper start honouring labels it is configured to ignore. Note this
// cannot be delegated to MapLabelsToStage's own !m.enabled check any more —
// the scan below reads m.labelToStage, which is populated regardless.
// A nil receiver means no label mapping is configured, so no label can name a
// stage. Guarded because callers reach this from ComputeAvailability, which is
// total on a zero-value store and must stay that way.
func (m *LabelMapper) TerminalLabelStage(labels []string) (task.Stage, bool) {
	if m == nil || !m.enabled {
		return "", false
	}

	present := make(map[task.Stage]bool, len(labels))
	for _, raw := range labels {
		if stage, ok := m.authorizationStage(raw); ok && store.IsTerminalStage(stage) {
			present[stage] = true
		}
	}

	// Resolve deterministically when an issue names several terminal stages.
	// Map iteration order is randomised, so returning "any of them" would make
	// an authorization answer differ run to run for one unchanged issue.
	for _, s := range terminalStagePrecedence {
		if present[s] {
			return s, true
		}
	}
	return "", false
}

// stripForMatch normalises a label for lookup: lowercase, strip push prefix,
// strip "stage/" or "priority:" path segments.
func (m *LabelMapper) stripForMatch(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))

	// Strip the push prefix (e.g. "ft:"). matchPrefix is shared with
	// authorizationStage, which REQUIRES the prefix this strips; the two must
	// resolve the configured value identically or the requirement stops lining
	// up with the lookup.
	if prefix := m.matchPrefix(); strings.HasPrefix(s, prefix) {
		s = s[len(prefix):]
	}

	// Strip category path prefixes (both slash and colon variants).
	s = strings.TrimPrefix(s, "stage/")
	s = strings.TrimPrefix(s, "priority/")
	s = strings.TrimPrefix(s, "priority:")

	return s
}

// phaseForStage maps a stage to its natural phase.
func phaseForStage(s task.Stage) task.Phase {
	switch s {
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		return task.PhaseClosed
	case task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying:
		return task.PhaseInProgress
	default:
		return task.PhaseOpen
	}
}
