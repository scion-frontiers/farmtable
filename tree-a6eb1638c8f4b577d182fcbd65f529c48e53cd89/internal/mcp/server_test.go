package mcp

import (
	"context"
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
}

func (f *fakeFarmTableClient) ListTasks(context.Context, *pb.ListTasksRequest, ...grpc.CallOption) (*pb.ListTasksResponse, error) {
	f.listTasksCalled = true
	return &pb.ListTasksResponse{}, nil
}

func (f *fakeFarmTableClient) GetReadyTasks(context.Context, *pb.GetReadyTasksRequest, ...grpc.CallOption) (*pb.GetReadyTasksResponse, error) {
	f.getReadyTasksCalled = true
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
