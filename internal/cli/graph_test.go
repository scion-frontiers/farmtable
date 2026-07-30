package cli

import (
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
)

func TestReadyTaskToMapIncludesAvailability(t *testing.T) {
	tests := []struct {
		name          string
		task          *pb.ReadyTask
		wantAvailable bool
		wantReasons   []string
	}{
		{
			name: "available_task",
			task: &pb.ReadyTask{
				Task: &pb.Task{
					Id:   "task-001",
					Name: "Available",
					Availability: &pb.TaskAvailability{
						Available: true,
					},
				},
			},
			wantAvailable: true,
			wantReasons:   []string{},
		},
		{
			name: "unavailable_with_reasons",
			task: &pb.ReadyTask{
				Task: &pb.Task{
					Id:   "task-002",
					Name: "Blocked",
					Availability: &pb.TaskAvailability{
						Available: false,
						Reasons: []pb.AvailabilityReason{
							pb.AvailabilityReason_AVAILABILITY_REASON_HELD,
							pb.AvailabilityReason_AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY,
						},
					},
				},
			},
			wantAvailable: false,
			wantReasons:   []string{"held", "blocked_by_dependency"},
		},
		{
			name: "nil_availability",
			task: &pb.ReadyTask{
				Task: &pb.Task{
					Id:   "task-003",
					Name: "No availability",
				},
			},
			wantAvailable: false,
			wantReasons:   []string{},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := readyTaskToMap(tc.task)

			avail, ok := m["availability"]
			if !ok {
				t.Fatal("readyTaskToMap missing 'availability' key")
			}

			availMap, ok := avail.(map[string]interface{})
			if !ok {
				t.Fatalf("availability type = %T, want map[string]interface{}", avail)
			}

			gotAvailable, _ := availMap["available"].(bool)
			if gotAvailable != tc.wantAvailable {
				t.Errorf("available = %v, want %v", gotAvailable, tc.wantAvailable)
			}

			gotReasons, ok := availMap["reasons"].([]string)
			if !ok {
				t.Fatalf("reasons type = %T, want []string", availMap["reasons"])
			}
			if len(gotReasons) != len(tc.wantReasons) {
				t.Fatalf("reasons = %v, want %v", gotReasons, tc.wantReasons)
			}
			for i := range gotReasons {
				if gotReasons[i] != tc.wantReasons[i] {
					t.Errorf("reasons[%d] = %q, want %q", i, gotReasons[i], tc.wantReasons[i])
				}
			}
		})
	}
}

func TestAvailabilityReasonsToStrings(t *testing.T) {
	tests := []struct {
		name    string
		reasons []pb.AvailabilityReason
		want    []string
	}{
		{"nil_input", nil, []string{}},
		{"empty_input", []pb.AvailabilityReason{}, []string{}},
		{"skips_unspecified", []pb.AvailabilityReason{
			pb.AvailabilityReason_AVAILABILITY_REASON_UNSPECIFIED,
		}, []string{}},
		{"all_reasons", []pb.AvailabilityReason{
			pb.AvailabilityReason_AVAILABILITY_REASON_TRIAGE,
			pb.AvailabilityReason_AVAILABILITY_REASON_TERMINAL,
			pb.AvailabilityReason_AVAILABILITY_REASON_HELD,
			pb.AvailabilityReason_AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY,
			pb.AvailabilityReason_AVAILABILITY_REASON_FUTURE_START_DATE,
		}, []string{"triage", "terminal", "held", "blocked_by_dependency", "future_start_date"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := availabilityReasonsToStrings(tc.reasons)
			if len(got) != len(tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("got[%d] = %q, want %q", i, got[i], tc.want[i])
				}
			}
		})
	}
}
