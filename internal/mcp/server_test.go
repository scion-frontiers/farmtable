package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/mark3labs/mcp-go/mcp"
	"google.golang.org/grpc"
)

type fakeFarmTableClient struct {
	pb.FarmTableServiceClient

	listTasksCalled         bool
	getReadyTasksCalled     bool
	getDependencyTreeCalled bool
	readyTasksResponse      *pb.GetReadyTasksResponse
}

func (f *fakeFarmTableClient) ListCollections(context.Context, *pb.ListCollectionsRequest, ...grpc.CallOption) (*pb.ListCollectionsResponse, error) {
	return &pb.ListCollectionsResponse{}, nil
}

func (f *fakeFarmTableClient) ListTasks(context.Context, *pb.ListTasksRequest, ...grpc.CallOption) (*pb.ListTasksResponse, error) {
	f.listTasksCalled = true
	return &pb.ListTasksResponse{}, nil
}

func (f *fakeFarmTableClient) GetReadyTasks(_ context.Context, _ *pb.GetReadyTasksRequest, _ ...grpc.CallOption) (*pb.GetReadyTasksResponse, error) {
	f.getReadyTasksCalled = true
	if f.readyTasksResponse != nil {
		return f.readyTasksResponse, nil
	}
	return &pb.GetReadyTasksResponse{}, nil
}

func (f *fakeFarmTableClient) GetDependencyTree(context.Context, *pb.GetDependencyTreeRequest, ...grpc.CallOption) (*pb.GetDependencyTreeResponse, error) {
	f.getDependencyTreeCalled = true
	return &pb.GetDependencyTreeResponse{}, nil
}

func TestHandleTaskListRejectsLimitAboveMax(t *testing.T) {
	client := &fakeFarmTableClient{}
	server := &Server{client: client}

	result, err := server.handleTaskList(context.Background(), callToolRequest(map[string]any{
		"collection": "00000000-0000-0000-0000-000000000001",
		"limit":      float64(201),
	}))
	if err != nil {
		t.Fatalf("handleTaskList returned error: %v", err)
	}

	requireToolError(t, result, "limit cannot exceed 200")
	if client.listTasksCalled {
		t.Fatal("ListTasks was called for invalid limit")
	}
}

func TestHandleTaskReadyRejectsLimitAboveMax(t *testing.T) {
	client := &fakeFarmTableClient{}
	server := &Server{client: client}

	result, err := server.handleTaskReady(context.Background(), callToolRequest(map[string]any{
		"collection": "00000000-0000-0000-0000-000000000001",
		"limit":      float64(201),
	}))
	if err != nil {
		t.Fatalf("handleTaskReady returned error: %v", err)
	}

	requireToolError(t, result, "limit cannot exceed 200")
	if client.getReadyTasksCalled {
		t.Fatal("GetReadyTasks was called for invalid limit")
	}
}

func TestHandleTaskTreeRejectsHugeMaxDepthBeforeInt32Conversion(t *testing.T) {
	client := &fakeFarmTableClient{}
	server := &Server{client: client}

	result, err := server.handleTaskTree(context.Background(), callToolRequest(map[string]any{
		"id":        "00000000-0000-0000-0000-000000000001",
		"max_depth": float64(1e20),
	}))
	if err != nil {
		t.Fatalf("handleTaskTree returned error: %v", err)
	}

	requireToolError(t, result, "max_depth cannot exceed 20")
	if client.getDependencyTreeCalled {
		t.Fatal("GetDependencyTree was called for invalid max_depth")
	}
}

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

func TestHandleTaskReadyIncludesAvailability(t *testing.T) {
	client := &fakeFarmTableClient{
		readyTasksResponse: &pb.GetReadyTasksResponse{
			Items: []*pb.ReadyTask{
				{
					Task: &pb.Task{
						Id:   "task-001",
						Name: "Available task",
						Availability: &pb.TaskAvailability{
							Available: true,
						},
					},
					BlockersResolved: 2,
				},
				{
					Task: &pb.Task{
						Id:   "task-002",
						Name: "Blocked task",
						Availability: &pb.TaskAvailability{
							Available: false,
							Reasons: []pb.AvailabilityReason{
								pb.AvailabilityReason_AVAILABILITY_REASON_BLOCKED_BY_DEPENDENCY,
								pb.AvailabilityReason_AVAILABILITY_REASON_FUTURE_START_DATE,
							},
						},
					},
				},
				{
					Task: &pb.Task{
						Id:   "task-003",
						Name: "Nil availability task",
					},
				},
			},
			TotalCount: 3,
		},
	}
	server := &Server{client: client}

	result, err := server.handleTaskReady(context.Background(), callToolRequest(map[string]any{}))
	if err != nil {
		t.Fatalf("handleTaskReady returned error: %v", err)
	}
	if result.IsError {
		t.Fatalf("handleTaskReady returned tool error")
	}

	// Parse the JSON response
	text, ok := result.Content[0].(mcp.TextContent)
	if !ok {
		t.Fatalf("content type = %T, want mcp.TextContent", result.Content[0])
	}

	var resp struct {
		Items []struct {
			ID           string `json:"id"`
			Availability struct {
				Available bool     `json:"available"`
				Reasons   []string `json:"reasons"`
			} `json:"availability"`
		} `json:"items"`
	}
	if err := json.Unmarshal([]byte(text.Text), &resp); err != nil {
		t.Fatalf("failed to parse response JSON: %v", err)
	}
	if len(resp.Items) != 3 {
		t.Fatalf("got %d items, want 3", len(resp.Items))
	}

	// Task 1: available=true, no reasons
	if !resp.Items[0].Availability.Available {
		t.Errorf("task-001 availability.available = false, want true")
	}
	if len(resp.Items[0].Availability.Reasons) != 0 {
		t.Errorf("task-001 availability.reasons = %v, want empty", resp.Items[0].Availability.Reasons)
	}

	// Task 2: available=false, two reasons
	if resp.Items[1].Availability.Available {
		t.Errorf("task-002 availability.available = true, want false")
	}
	wantReasons := []string{"blocked_by_dependency", "future_start_date"}
	if len(resp.Items[1].Availability.Reasons) != len(wantReasons) {
		t.Fatalf("task-002 availability.reasons length = %d, want %d", len(resp.Items[1].Availability.Reasons), len(wantReasons))
	}
	for i, r := range wantReasons {
		if resp.Items[1].Availability.Reasons[i] != r {
			t.Errorf("task-002 availability.reasons[%d] = %q, want %q", i, resp.Items[1].Availability.Reasons[i], r)
		}
	}

	// Task 3: nil availability → available=false, empty reasons
	if resp.Items[2].Availability.Available {
		t.Errorf("task-003 availability.available = true, want false")
	}
	if len(resp.Items[2].Availability.Reasons) != 0 {
		t.Errorf("task-003 availability.reasons = %v, want empty", resp.Items[2].Availability.Reasons)
	}
}

func TestAvailabilityReasonsToStrings(t *testing.T) {
	tests := []struct {
		name    string
		reasons []pb.AvailabilityReason
		want    []string
	}{
		{"nil", nil, []string{}},
		{"empty", []pb.AvailabilityReason{}, []string{}},
		{"unspecified_skipped", []pb.AvailabilityReason{pb.AvailabilityReason_AVAILABILITY_REASON_UNSPECIFIED}, []string{}},
		{"single", []pb.AvailabilityReason{pb.AvailabilityReason_AVAILABILITY_REASON_HELD}, []string{"held"}},
		{"multiple", []pb.AvailabilityReason{
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

func callToolRequest(args map[string]any) mcp.CallToolRequest {
	return mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Arguments: args,
		},
	}
}

func requireToolError(t *testing.T, result *mcp.CallToolResult, want string) {
	t.Helper()
	if result == nil {
		t.Fatal("result is nil")
	}
	if !result.IsError {
		t.Fatalf("result IsError = false, want true")
	}
	if len(result.Content) != 1 {
		t.Fatalf("content length = %d, want 1", len(result.Content))
	}
	text, ok := result.Content[0].(mcp.TextContent)
	if !ok {
		t.Fatalf("content type = %T, want mcp.TextContent", result.Content[0])
	}
	if !strings.Contains(text.Text, want) {
		t.Fatalf("tool error = %q, want substring %q", text.Text, want)
	}
}
