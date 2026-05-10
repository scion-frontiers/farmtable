package github

import (
	"strings"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// stagePrecedence defines conflict resolution order: earlier index wins.
// When multiple label-mapped stages appear on a single issue, the stage
// with the lowest index in this slice is selected.
var stagePrecedence = []task.Stage{
	task.StageBlocked,
	task.StageWorking,
	task.StageInReview,
	task.StageInQa,
	task.StageDeploying,
	task.StageReady,
	task.StageScheduled,
	task.StageWaitingForInput,
	task.StageBacklog,
	task.StageTriage,
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
	task.StageDeferred,
}

// allStages enumerates every valid Stage for default auto-mapping.
var allStages = []task.Stage{
	task.StageTriage,
	task.StageBacklog,
	task.StageReady,
	task.StageWorking,
	task.StageInReview,
	task.StageInQa,
	task.StageDeploying,
	task.StageBlocked,
	task.StageWaitingForInput,
	task.StageDeferred,
	task.StageScheduled,
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
	stageToLabel    map[task.Stage]string
	priorityToLabel map[task.Priority]string

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
		stageToLabel:    make(map[task.Stage]string),
		priorityToLabel: make(map[task.Priority]string),
		labelToStage:    make(map[string]task.Stage),
		labelToPriority: make(map[string]task.Priority),
		labelToType:     make(map[string]string),
	}

	prefix := cfg.PushPrefix
	if prefix == "" {
		prefix = "ft:"
	}

	// --- Stage mappings ---

	// Default: each stage string value maps to itself.
	for _, s := range allStages {
		label := strings.ToLower(s.String())
		m.labelToStage[label] = s
		m.stageToLabel[s] = prefix + "stage/" + s.String()
	}

	// Custom config overrides: label->stage (pull direction).
	// Also generates the push label using the same prefix convention.
	for label, stageStr := range cfg.Stages {
		stage := task.Stage(stageStr)
		if err := task.StageValidator(stage); err == nil {
			m.labelToStage[strings.ToLower(label)] = stage
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

	// Custom config overrides.
	for label, prioStr := range cfg.Priorities {
		p := task.Priority(prioStr)
		if err := task.PriorityValidator(p); err == nil {
			m.labelToPriority[strings.ToLower(label)] = p
			m.priorityToLabel[p] = "priority:" + p.String()
		}
	}

	// --- Type mappings ---

	// Defaults.
	for label, typ := range defaultTypeLabels {
		m.labelToType[label] = typ
	}

	// Custom config overrides.
	for label, typ := range cfg.Types {
		m.labelToType[strings.ToLower(label)] = typ
	}

	return m
}

// MapLabelsToStage scans labels for stage mappings and returns the
// highest-precedence match. Labels are matched case-insensitively.
// The push_prefix (e.g. "ft:") is stripped before matching, so both
// "working" and "ft:stage/working" will match StageWorking.
func (m *LabelMapper) MapLabelsToStage(labels []string) (task.Stage, bool) {
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
	if label, ok := m.stageToLabel[s]; ok {
		return label
	}
	prefix := m.config.PushPrefix
	if prefix == "" {
		prefix = "ft:"
	}
	return prefix + "stage/" + s.String()
}

// PriorityToLabel returns the GitHub label name for a given priority.
// Example: PriorityHigh -> "priority:high".
func (m *LabelMapper) PriorityToLabel(p task.Priority) string {
	if label, ok := m.priorityToLabel[p]; ok {
		return label
	}
	return "priority:" + p.String()
}

// StageLabelSwap computes the label add/remove sets needed to transition
// an issue from its current labels to a new stage. It removes any existing
// stage labels and adds the label for newStage.
func (m *LabelMapper) StageLabelSwap(currentLabels []string, newStage task.Stage) (add []string, remove []string) {
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

// IssueToPhaseStage determines the Farm Table phase and stage for a GitHub
// issue based on its state, stateReason, and labels.
//
// Logic:
//  1. If state is "closed", use stateReason to pick the stage:
//     - "not_planned" -> PhaseClosed, StageWontFix
//     - otherwise     -> PhaseClosed, StageCompleted
//  2. If labels map to a stage, use that stage with the appropriate phase.
//  3. Fallback: open -> (PhaseOpen, StageTriage), closed -> (PhaseClosed, StageCompleted).
func (m *LabelMapper) IssueToPhaseStage(state, stateReason string, labels []string) (task.Phase, task.Stage) {
	isClosed := strings.EqualFold(state, "closed")

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

	// Open issue: labels determine stage.
	if stage, ok := m.MapLabelsToStage(labels); ok {
		return phaseForStage(stage), stage
	}

	// Fallback for open issues.
	return task.PhaseOpen, task.StageTriage
}

// stripForMatch normalises a label for lookup: lowercase, strip push prefix,
// strip "stage/" or "priority:" path segments.
func (m *LabelMapper) stripForMatch(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))

	// Strip the push prefix (e.g. "ft:").
	prefix := strings.ToLower(m.config.PushPrefix)
	if prefix == "" {
		prefix = "ft:"
	}
	if strings.HasPrefix(s, prefix) {
		s = s[len(prefix):]
	}

	// Strip category path prefixes.
	s = strings.TrimPrefix(s, "stage/")
	s = strings.TrimPrefix(s, "priority/")

	return s
}

// phaseForStage maps a stage to its natural phase.
func phaseForStage(s task.Stage) task.Phase {
	switch s {
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		return task.PhaseClosed
	case task.StageBlocked, task.StageWaitingForInput, task.StageDeferred:
		return task.PhaseOnHold
	case task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying:
		return task.PhaseInProgress
	default:
		return task.PhaseOpen
	}
}
