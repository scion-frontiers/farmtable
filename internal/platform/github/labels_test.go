package github

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

func defaultMapper() *LabelMapper {
	return NewLabelMapper(DefaultConfig().GitHub.Labels)
}

// --- MapLabelsToStage ---

func TestMapLabelsToStage_ExactMatch(t *testing.T) {
	m := defaultMapper()

	tests := []struct {
		label string
		want  task.Stage
	}{
		{"working", task.StageWorking},
		{"triage", task.StageTriage},
		{"backlog", task.StageBacklog},
		{"ready", task.StageReady},
		{"in_review", task.StageInReview},
		{"in_qa", task.StageInQa},
		{"deploying", task.StageDeploying},
		{"blocked", task.StageBlocked},
		{"waiting_for_input", task.StageWaitingForInput},
		{"deferred", task.StageDeferred},
		{"scheduled", task.StageScheduled},
		{"completed", task.StageCompleted},
		{"wont_fix", task.StageWontFix},
		{"duplicate", task.StageDuplicate},
		{"cancelled", task.StageCancelled},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			got, ok := m.MapLabelsToStage([]string{tt.label})
			if !ok {
				t.Fatalf("MapLabelsToStage(%q) returned no match", tt.label)
			}
			if got != tt.want {
				t.Errorf("MapLabelsToStage(%q) = %q, want %q", tt.label, got, tt.want)
			}
		})
	}
}

func TestMapLabelsToStage_CaseInsensitive(t *testing.T) {
	m := defaultMapper()

	tests := []string{"Working", "WORKING", "Blocked", "IN_REVIEW", "Triage"}
	for _, label := range tests {
		t.Run(label, func(t *testing.T) {
			_, ok := m.MapLabelsToStage([]string{label})
			if !ok {
				t.Errorf("MapLabelsToStage(%q) returned no match, want case-insensitive match", label)
			}
		})
	}
}

func TestMapLabelsToStage_CustomMapping(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.Stages = map[string]string{
		"doing":     "working",
		"reviewing": "in_review",
	}
	m := NewLabelMapper(cfg)

	stage, ok := m.MapLabelsToStage([]string{"doing"})
	if !ok {
		t.Fatal("expected match for custom label 'doing'")
	}
	if stage != task.StageWorking {
		t.Errorf("stage = %q, want %q", stage, task.StageWorking)
	}

	stage, ok = m.MapLabelsToStage([]string{"reviewing"})
	if !ok {
		t.Fatal("expected match for custom label 'reviewing'")
	}
	if stage != task.StageInReview {
		t.Errorf("stage = %q, want %q", stage, task.StageInReview)
	}
}

func TestMapLabelsToStage_Precedence(t *testing.T) {
	m := defaultMapper()

	// blocked has higher precedence than ready.
	stage, ok := m.MapLabelsToStage([]string{"ready", "blocked"})
	if !ok {
		t.Fatal("expected match")
	}
	if stage != task.StageBlocked {
		t.Errorf("stage = %q, want %q (blocked has higher precedence)", stage, task.StageBlocked)
	}

	// working beats in_review.
	stage, ok = m.MapLabelsToStage([]string{"in_review", "working"})
	if !ok {
		t.Fatal("expected match")
	}
	if stage != task.StageWorking {
		t.Errorf("stage = %q, want %q", stage, task.StageWorking)
	}

	// deploying beats ready.
	stage, ok = m.MapLabelsToStage([]string{"ready", "deploying"})
	if !ok {
		t.Fatal("expected match")
	}
	if stage != task.StageDeploying {
		t.Errorf("stage = %q, want %q", stage, task.StageDeploying)
	}
}

func TestMapLabelsToStage_NoMatch(t *testing.T) {
	m := defaultMapper()

	_, ok := m.MapLabelsToStage([]string{"unrelated", "enhancement", "v2.0"})
	if ok {
		t.Error("expected no match for non-stage labels")
	}

	_, ok = m.MapLabelsToStage(nil)
	if ok {
		t.Error("expected no match for nil labels")
	}

	_, ok = m.MapLabelsToStage([]string{})
	if ok {
		t.Error("expected no match for empty labels")
	}
}

// --- MapLabelsToPriority ---

func TestMapLabelsToPriority(t *testing.T) {
	m := defaultMapper()

	tests := []struct {
		label string
		want  task.Priority
	}{
		{"urgent", task.PriorityUrgent},
		{"high", task.PriorityHigh},
		{"normal", task.PriorityNormal},
		{"low", task.PriorityLow},
		{"Urgent", task.PriorityUrgent},
		{"HIGH", task.PriorityHigh},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			got, ok := m.MapLabelsToPriority([]string{"unrelated", tt.label})
			if !ok {
				t.Fatalf("MapLabelsToPriority(%q) returned no match", tt.label)
			}
			if *got != tt.want {
				t.Errorf("MapLabelsToPriority(%q) = %q, want %q", tt.label, *got, tt.want)
			}
		})
	}

	// No match.
	_, ok := m.MapLabelsToPriority([]string{"medium", "unknown"})
	if ok {
		t.Error("expected no match for non-priority labels")
	}
}

func TestMapLabelsToPriority_CustomMapping(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.Priorities = map[string]string{
		"p0": "urgent",
		"p1": "high",
	}
	m := NewLabelMapper(cfg)

	got, ok := m.MapLabelsToPriority([]string{"p0"})
	if !ok {
		t.Fatal("expected match for 'p0'")
	}
	if *got != task.PriorityUrgent {
		t.Errorf("got %q, want %q", *got, task.PriorityUrgent)
	}
}

// --- MapLabelsToType ---

func TestMapLabelsToType(t *testing.T) {
	m := defaultMapper()

	tests := []struct {
		label string
		want  string
	}{
		{"bug", "bug"},
		{"feature", "feature"},
		{"task", "task"},
		{"design", "design"},
		{"Bug", "bug"},
		{"FEATURE", "feature"},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			got, ok := m.MapLabelsToType([]string{tt.label})
			if !ok {
				t.Fatalf("no match for %q", tt.label)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}

	_, ok := m.MapLabelsToType([]string{"docs", "infra"})
	if ok {
		t.Error("expected no match for non-type labels")
	}
}

func TestMapLabelsToType_CustomMapping(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.Types = map[string]string{
		"enhancement": "feature",
		"defect":      "bug",
	}
	m := NewLabelMapper(cfg)

	got, ok := m.MapLabelsToType([]string{"enhancement"})
	if !ok {
		t.Fatal("expected match")
	}
	if got != "feature" {
		t.Errorf("got %q, want %q", got, "feature")
	}
}

// --- StageToLabel ---

func TestStageToLabel(t *testing.T) {
	m := defaultMapper()

	tests := []struct {
		stage task.Stage
		want  string
	}{
		{task.StageWorking, "ft:stage/working"},
		{task.StageTriage, "ft:stage/triage"},
		{task.StageBlocked, "ft:stage/blocked"},
		{task.StageCompleted, "ft:stage/completed"},
		{task.StageInReview, "ft:stage/in_review"},
	}

	for _, tt := range tests {
		t.Run(string(tt.stage), func(t *testing.T) {
			got := m.StageToLabel(tt.stage)
			if got != tt.want {
				t.Errorf("StageToLabel(%q) = %q, want %q", tt.stage, got, tt.want)
			}
		})
	}
}

func TestStageToLabel_CustomPrefix(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "myapp:"
	m := NewLabelMapper(cfg)

	got := m.StageToLabel(task.StageWorking)
	if got != "myapp:stage/working" {
		t.Errorf("got %q, want %q", got, "myapp:stage/working")
	}
}

// --- PriorityToLabel ---

func TestPriorityToLabel(t *testing.T) {
	m := defaultMapper()

	tests := []struct {
		prio task.Priority
		want string
	}{
		{task.PriorityUrgent, "priority:urgent"},
		{task.PriorityHigh, "priority:high"},
		{task.PriorityNormal, "priority:normal"},
		{task.PriorityLow, "priority:low"},
	}

	for _, tt := range tests {
		t.Run(string(tt.prio), func(t *testing.T) {
			got := m.PriorityToLabel(tt.prio)
			if got != tt.want {
				t.Errorf("PriorityToLabel(%q) = %q, want %q", tt.prio, got, tt.want)
			}
		})
	}
}

// --- StageLabelSwap ---

func TestStageLabelSwap(t *testing.T) {
	m := defaultMapper()

	// Transition from working to in_review.
	add, remove := m.StageLabelSwap(
		[]string{"ft:stage/working", "bug", "priority:high"},
		task.StageInReview,
	)

	if len(add) != 1 || add[0] != "ft:stage/in_review" {
		t.Errorf("add = %v, want [ft:stage/in_review]", add)
	}
	if len(remove) != 1 || remove[0] != "ft:stage/working" {
		t.Errorf("remove = %v, want [ft:stage/working]", remove)
	}
}

func TestStageLabelSwap_NoExistingStage(t *testing.T) {
	m := defaultMapper()

	add, remove := m.StageLabelSwap(
		[]string{"bug", "priority:high"},
		task.StageWorking,
	)

	if len(add) != 1 || add[0] != "ft:stage/working" {
		t.Errorf("add = %v, want [ft:stage/working]", add)
	}
	if len(remove) != 0 {
		t.Errorf("remove = %v, want empty", remove)
	}
}

func TestStageLabelSwap_AlreadyPresent(t *testing.T) {
	m := defaultMapper()

	add, remove := m.StageLabelSwap(
		[]string{"ft:stage/working", "bug"},
		task.StageWorking,
	)

	if len(add) != 0 {
		t.Errorf("add = %v, want empty (label already present)", add)
	}
	if len(remove) != 0 {
		t.Errorf("remove = %v, want empty", remove)
	}
}

// --- PriorityLabelSwap ---

func TestPriorityLabelSwap(t *testing.T) {
	m := defaultMapper()

	add, remove := m.PriorityLabelSwap(
		[]string{"priority:low", "bug", "ft:stage/working"},
		task.PriorityHigh,
	)

	if len(add) != 1 || add[0] != "priority:high" {
		t.Errorf("add = %v, want [priority:high]", add)
	}
	if len(remove) != 1 || remove[0] != "priority:low" {
		t.Errorf("remove = %v, want [priority:low]", remove)
	}
}

// --- IssueToPhaseStage ---

func TestIssueToPhaseStage_ClosedNotPlanned(t *testing.T) {
	m := defaultMapper()

	phase, stage := m.IssueToPhaseStage("closed", "not_planned", nil)
	if phase != task.PhaseClosed {
		t.Errorf("phase = %q, want %q", phase, task.PhaseClosed)
	}
	if stage != task.StageWontFix {
		t.Errorf("stage = %q, want %q", stage, task.StageWontFix)
	}
}

func TestIssueToPhaseStage_ClosedCompleted(t *testing.T) {
	m := defaultMapper()

	phase, stage := m.IssueToPhaseStage("closed", "completed", nil)
	if phase != task.PhaseClosed {
		t.Errorf("phase = %q, want %q", phase, task.PhaseClosed)
	}
	if stage != task.StageCompleted {
		t.Errorf("stage = %q, want %q", stage, task.StageCompleted)
	}
}

func TestIssueToPhaseStage_LabelsOverride(t *testing.T) {
	m := defaultMapper()

	// Labels override the default closed mapping.
	phase, stage := m.IssueToPhaseStage("closed", "completed", []string{"cancelled"})
	if phase != task.PhaseClosed {
		t.Errorf("phase = %q, want %q", phase, task.PhaseClosed)
	}
	if stage != task.StageCancelled {
		t.Errorf("stage = %q, want %q (labels should override)", stage, task.StageCancelled)
	}

	// Open issue with labels.
	phase, stage = m.IssueToPhaseStage("open", "", []string{"working"})
	if phase != task.PhaseInProgress {
		t.Errorf("phase = %q, want %q", phase, task.PhaseInProgress)
	}
	if stage != task.StageWorking {
		t.Errorf("stage = %q, want %q", stage, task.StageWorking)
	}
}

func TestIssueToPhaseStage_Fallback(t *testing.T) {
	m := defaultMapper()

	// Open issue with no matching labels.
	phase, stage := m.IssueToPhaseStage("open", "", []string{"enhancement"})
	if phase != task.PhaseOpen {
		t.Errorf("phase = %q, want %q", phase, task.PhaseOpen)
	}
	if stage != task.StageTriage {
		t.Errorf("stage = %q, want %q (fallback)", stage, task.StageTriage)
	}
}

func TestIssueToPhaseStage_OpenBlocked(t *testing.T) {
	m := defaultMapper()

	phase, stage := m.IssueToPhaseStage("open", "", []string{"blocked"})
	if phase != task.PhaseOnHold {
		t.Errorf("phase = %q, want %q", phase, task.PhaseOnHold)
	}
	if stage != task.StageBlocked {
		t.Errorf("stage = %q, want %q", stage, task.StageBlocked)
	}
}

// --- Prefix Stripping ---

func TestPrefixStripping(t *testing.T) {
	m := defaultMapper()

	// "ft:stage/working" should match StageWorking.
	stage, ok := m.MapLabelsToStage([]string{"ft:stage/working"})
	if !ok {
		t.Fatal("expected match for prefixed label")
	}
	if stage != task.StageWorking {
		t.Errorf("stage = %q, want %q", stage, task.StageWorking)
	}

	// Case-insensitive prefix stripping.
	stage, ok = m.MapLabelsToStage([]string{"FT:stage/blocked"})
	if !ok {
		t.Fatal("expected match for case-insensitive prefixed label")
	}
	if stage != task.StageBlocked {
		t.Errorf("stage = %q, want %q", stage, task.StageBlocked)
	}

	// Priority prefix stripping.
	prio, ok := m.MapLabelsToPriority([]string{"ft:priority/urgent"})
	if !ok {
		t.Fatal("expected match for prefixed priority label")
	}
	if *prio != task.PriorityUrgent {
		t.Errorf("priority = %q, want %q", *prio, task.PriorityUrgent)
	}
}

func TestPrefixStripping_CustomPrefix(t *testing.T) {
	cfg := DefaultConfig().GitHub.Labels
	cfg.PushPrefix = "myapp:"
	m := NewLabelMapper(cfg)

	stage, ok := m.MapLabelsToStage([]string{"myapp:stage/working"})
	if !ok {
		t.Fatal("expected match with custom prefix")
	}
	if stage != task.StageWorking {
		t.Errorf("stage = %q, want %q", stage, task.StageWorking)
	}
}
