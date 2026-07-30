package cli

import (
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
)

func TestParsePhaseAcceptsValidPhases(t *testing.T) {
	tests := []struct {
		input string
		want  pb.TaskPhase
	}{
		{"OPEN", pb.TaskPhase_TASK_PHASE_OPEN},
		{"IN_PROGRESS", pb.TaskPhase_TASK_PHASE_IN_PROGRESS},
		{"CLOSED", pb.TaskPhase_TASK_PHASE_CLOSED},
		{"open", pb.TaskPhase_TASK_PHASE_OPEN},
		{"in_progress", pb.TaskPhase_TASK_PHASE_IN_PROGRESS},
		{"closed", pb.TaskPhase_TASK_PHASE_CLOSED},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := parsePhase(tt.input)
			if err != nil {
				t.Fatalf("parsePhase(%q) returned unexpected error: %v", tt.input, err)
			}
			if got != tt.want {
				t.Fatalf("parsePhase(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestParsePhaseRejectsOnHold(t *testing.T) {
	for _, input := range []string{"ON_HOLD", "on_hold", "On_Hold"} {
		t.Run(input, func(t *testing.T) {
			_, err := parsePhase(input)
			if err == nil {
				t.Fatalf("parsePhase(%q) succeeded, want error (ON_HOLD must be rejected)", input)
			}
		})
	}
}

func TestParsePhaseRejectsInvalidInput(t *testing.T) {
	_, err := parsePhase("INVALID")
	if err == nil {
		t.Fatal("parsePhase(\"INVALID\") succeeded, want error")
	}
}
