package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"strings"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type Server struct {
	mcp    *server.MCPServer
	client pb.FarmTableServiceClient
	closer io.Closer
	token  string
}

type ClientFactory func() (pb.FarmTableServiceClient, io.Closer, string, error)

const (
	maxMCPPageSize        int32 = 200
	maxMCPDependencyDepth int32 = 20
)

func NewServer(factory ClientFactory) (*Server, error) {
	client, closer, token, err := factory()
	if err != nil {
		return nil, fmt.Errorf("connecting to farm table: %w", err)
	}

	s := &Server{
		mcp:    server.NewMCPServer("farmtable", "0.2.0", server.WithToolCapabilities(false)),
		client: client,
		closer: closer,
		token:  token,
	}
	s.registerTools()
	return s, nil
}

func (s *Server) Close() error {
	if s.closer != nil {
		return s.closer.Close()
	}
	return nil
}

func (s *Server) MCPServer() *server.MCPServer {
	return s.mcp
}

func (s *Server) registerTools() {
	s.mcp.AddTool(mcp.NewTool("task_list",
		mcp.WithDescription("List tasks with optional filters. Returns paginated results."),
		mcp.WithString("phase", mcp.Description("Filter by phase: OPEN, IN_PROGRESS, ON_HOLD, CLOSED")),
		mcp.WithString("stage", mcp.Description("Filter by stage (comma-separated): triage, backlog, ready, working, in_review, in_qa, deploying, blocked, waiting_for_input, deferred, scheduled, completed, wont_fix, duplicate, cancelled")),
		mcp.WithString("assignee", mcp.Description("Filter by assignee name or ID. Use 'me' for self, 'none' for unassigned.")),
		mcp.WithString("priority", mcp.Description("Filter by priority: URGENT, HIGH, NORMAL, LOW")),
		mcp.WithString("type", mcp.Description("Filter by task type (e.g. bug, story, task, epic)")),
		mcp.WithString("labels", mcp.Description("Filter by labels (comma-separated)")),
		mcp.WithString("parent", mcp.Description("Filter by parent task ID")),
		mcp.WithString("collection", mcp.Description("Collection UUID or name to scope the query")),
		mcp.WithString("sort", mcp.Description("Sort field: created, updated, priority, due_date")),
		mcp.WithString("order", mcp.Description("Sort order: asc, desc")),
		mcp.WithBoolean("full", mcp.Description("Return complete task details instead of compact view")),
		mcp.WithNumber("limit", mcp.Description("Max results per page (default 50, max 200)")),
		mcp.WithString("cursor", mcp.Description("Pagination cursor from previous response")),
	), s.handleTaskList)

	s.mcp.AddTool(mcp.NewTool("task_get",
		mcp.WithDescription("Get full details for a single task by ID, including description, relationships, code context, and optionally comments and change history."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task UUID")),
		mcp.WithBoolean("with_comments", mcp.Description("Include comment thread")),
		mcp.WithBoolean("with_changes", mcp.Description("Include change audit trail")),
		mcp.WithString("collection", mcp.Description("Collection UUID or name")),
	), s.handleTaskGet)

	s.mcp.AddTool(mcp.NewTool("task_create",
		mcp.WithDescription("Create a new task. Returns the created task with its generated UUID."),
		mcp.WithString("name", mcp.Required(), mcp.Description("Task name/title")),
		mcp.WithString("description", mcp.Description("Task description (markdown supported)")),
		mcp.WithString("acceptance_criteria", mcp.Description("Completion criteria")),
		mcp.WithString("stage", mcp.Description("Initial stage (default: triage)")),
		mcp.WithString("priority", mcp.Description("Priority: URGENT, HIGH, NORMAL, LOW")),
		mcp.WithString("type", mcp.Description("Task type: bug, story, task, epic, etc.")),
		mcp.WithString("assignees", mcp.Description("Assignee IDs (comma-separated)")),
		mcp.WithString("labels", mcp.Description("Labels (comma-separated)")),
		mcp.WithString("parent", mcp.Description("Parent task ID for hierarchy")),
		mcp.WithString("due_date", mcp.Description("Due date (ISO 8601 or YYYY-MM-DD)")),
		mcp.WithString("start_date", mcp.Description("Start date (ISO 8601 or YYYY-MM-DD)")),
		mcp.WithString("blocks", mcp.Description("Task IDs this task blocks (comma-separated)")),
		mcp.WithString("blocked_by", mcp.Description("Task IDs blocking this task (comma-separated)")),
		mcp.WithString("collection", mcp.Description("Collection UUID or name")),
		mcp.WithString("reason", mcp.Description("Audit trail reason")),
	), s.handleTaskCreate)

	s.mcp.AddTool(mcp.NewTool("task_update",
		mcp.WithDescription("Update fields on an existing task. Only specified fields are modified."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task UUID")),
		mcp.WithString("name", mcp.Description("New task name")),
		mcp.WithString("description", mcp.Description("New description")),
		mcp.WithString("acceptance_criteria", mcp.Description("New acceptance criteria")),
		mcp.WithString("stage", mcp.Description("New stage")),
		mcp.WithString("priority", mcp.Description("New priority")),
		mcp.WithString("type", mcp.Description("New task type")),
		mcp.WithString("assignees", mcp.Description("Set assignees (comma-separated IDs); 'none' to clear")),
		mcp.WithString("add_labels", mcp.Description("Labels to add (comma-separated)")),
		mcp.WithString("remove_labels", mcp.Description("Labels to remove (comma-separated)")),
		mcp.WithString("add_blocks", mcp.Description("Task IDs to add BLOCKS relationship (comma-separated)")),
		mcp.WithString("add_blocked_by", mcp.Description("Task IDs to add BLOCKED_BY relationship (comma-separated)")),
		mcp.WithString("remove_relationships", mcp.Description("Relationship IDs to remove (comma-separated)")),
		mcp.WithString("due_date", mcp.Description("New due date; 'none' to clear")),
		mcp.WithString("start_date", mcp.Description("New start date; 'none' to clear")),
		mcp.WithString("parent", mcp.Description("New parent task ID; 'none' to clear")),
		mcp.WithString("reason", mcp.Description("Audit trail reason")),
		mcp.WithString("version", mcp.Description("Expected version for optimistic locking (CAS)")),
	), s.handleTaskUpdate)

	s.mcp.AddTool(mcp.NewTool("task_claim",
		mcp.WithDescription("Atomically claim a task and transition it to 'working' stage (or a specified stage). Assigns the task to the authenticated user."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task UUID")),
		mcp.WithString("stage", mcp.Description("Override target stage (default: working)")),
		mcp.WithString("reason", mcp.Description("Audit trail reason")),
		mcp.WithString("version", mcp.Description("Expected version for CAS")),
	), s.handleTaskClaim)

	s.mcp.AddTool(mcp.NewTool("task_close",
		mcp.WithDescription("Close a task, transitioning it to the CLOSED phase with the specified close stage (default: completed)."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task UUID")),
		mcp.WithString("stage", mcp.Description("Close stage: completed, wont_fix, duplicate, cancelled")),
		mcp.WithString("reason", mcp.Description("Audit trail reason")),
		mcp.WithString("duplicate_of", mcp.Description("Canonical task ID when stage is 'duplicate'")),
		mcp.WithString("version", mcp.Description("Expected version for CAS")),
	), s.handleTaskClose)

	s.mcp.AddTool(mcp.NewTool("task_search",
		mcp.WithDescription("Search tasks by name substring match. Returns matching tasks across all open phases by default."),
		mcp.WithString("query", mcp.Required(), mcp.Description("Search string to match against task names")),
		mcp.WithString("phase", mcp.Description("Filter by phase: OPEN, IN_PROGRESS, ON_HOLD, CLOSED")),
		mcp.WithString("collection", mcp.Description("Collection UUID or name")),
		mcp.WithNumber("limit", mcp.Description("Max results (default 20)")),
	), s.handleTaskSearch)

	s.mcp.AddTool(mcp.NewTool("task_tree",
		mcp.WithDescription("Get the dependency tree for a task, showing what it blocks and what blocks it."),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task UUID")),
		mcp.WithString("direction", mcp.Description("Traversal direction: up, down, both (default: both)")),
		mcp.WithNumber("max_depth", mcp.Description("Maximum tree depth (default 5, max 20)")),
	), s.handleTaskTree)

	s.mcp.AddTool(mcp.NewTool("task_ready",
		mcp.WithDescription("Get tasks ready to work on: open tasks whose blocking dependencies are all resolved."),
		mcp.WithString("assignee", mcp.Description("Filter by assignee")),
		mcp.WithString("min_priority", mcp.Description("Minimum priority: URGENT, HIGH, NORMAL, LOW")),
		mcp.WithBoolean("include_unblocked", mcp.Description("Include unblocked open tasks beyond ready stage")),
		mcp.WithString("collection", mcp.Description("Collection UUID or name")),
		mcp.WithNumber("limit", mcp.Description("Max results (default 50)")),
	), s.handleTaskReady)

	s.mcp.AddTool(mcp.NewTool("task_critical_path",
		mcp.WithDescription("Find the critical path (longest dependency chain) through task dependencies in a collection."),
		mcp.WithString("collection", mcp.Description("Collection UUID or name (required)")),
		mcp.WithString("root", mcp.Description("Optional root task UUID to start from")),
	), s.handleTaskCriticalPath)
}

// --- Tool handlers ---

func (s *Server) handleTaskList(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)
	collection := s.resolveCollection(grpcCtx, optString(req, "collection"))

	r := &pb.ListTasksRequest{
		Full:      optBool(req, "full"),
		PageToken: optString(req, "cursor"),
	}
	if collection != "" {
		r.CollectionId = &collection
	}
	if v := optString(req, "phase"); v != "" {
		p, err := parsePhase(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Phase = &p
	}
	if v := optString(req, "stage"); v != "" {
		for _, s := range splitCSV(v) {
			st, err := parseStage(s)
			if err != nil {
				return toolError(err.Error()), nil
			}
			r.Stages = append(r.Stages, st)
		}
	}
	if v := optString(req, "assignee"); v != "" {
		r.Assignee = &v
	}
	if v := optString(req, "priority"); v != "" {
		p, err := parsePriority(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Priority = &p
	}
	if v := optString(req, "type"); v != "" {
		r.Type = &v
	}
	if v := optString(req, "labels"); v != "" {
		r.Labels = splitCSV(v)
	}
	if v := optString(req, "parent"); v != "" {
		r.ParentTaskId = &v
	}
	if v := optString(req, "sort"); v != "" {
		sf, ok := sortFieldValues[v]
		if !ok {
			return toolError(fmt.Sprintf("invalid sort field %q; valid: created, updated, priority, due_date", v)), nil
		}
		r.SortField = sf
	}
	if v := optString(req, "order"); v != "" {
		so, ok := sortOrderValues[v]
		if !ok {
			return toolError(fmt.Sprintf("invalid sort order %q; valid: asc, desc", v)), nil
		}
		r.SortOrder = so
	}
	if v, ok, err := optBoundedPositiveInt32(req, "limit", maxMCPPageSize); err != nil {
		return toolError(err.Error()), nil
	} else if ok {
		r.PageSize = v
	}

	resp, err := s.client.ListTasks(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}

	items := make([]interface{}, 0, len(resp.GetItems()))
	for _, t := range resp.GetItems() {
		items = append(items, taskToMap(t, !r.Full))
	}
	return toolJSON(map[string]interface{}{
		"items":       items,
		"next_cursor": nilIfEmpty(resp.GetNextPageToken()),
		"has_more":    resp.GetHasMore(),
		"total_count": resp.GetTotalCount(),
	})
}

func (s *Server) handleTaskGet(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)
	collection := s.resolveCollection(grpcCtx, optString(req, "collection"))

	id, err := requiredString(req, "id")
	if err != nil {
		return toolError(err.Error()), nil
	}

	r := &pb.GetTaskRequest{
		Id:              id,
		IncludeComments: optBool(req, "with_comments"),
		IncludeChanges:  optBool(req, "with_changes"),
	}
	if collection != "" {
		r.CollectionId = &collection
	}

	resp, err := s.client.GetTask(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}

	m := taskToMap(resp.GetTask(), false)
	if r.IncludeComments && len(resp.GetComments()) > 0 {
		comments := make([]interface{}, 0, len(resp.GetComments()))
		for _, c := range resp.GetComments() {
			comments = append(comments, commentToMap(c))
		}
		m["comments"] = comments
	}
	if r.IncludeChanges && len(resp.GetChanges()) > 0 {
		changes := make([]interface{}, 0, len(resp.GetChanges()))
		for _, c := range resp.GetChanges() {
			changes = append(changes, changeToMap(c))
		}
		m["changes"] = changes
	}
	return toolJSON(m)
}

func (s *Server) handleTaskCreate(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)
	collection := s.resolveCollection(grpcCtx, optString(req, "collection"))
	if collection == "" {
		return toolError("collection is required; pass 'collection' parameter or set FARMTABLE_COLLECTION"), nil
	}

	name, err := requiredString(req, "name")
	if err != nil {
		return toolError(err.Error()), nil
	}

	r := &pb.CreateTaskRequest{
		Name:         name,
		CollectionId: collection,
	}
	if v := optString(req, "description"); v != "" {
		r.Description = &v
	}
	if v := optString(req, "acceptance_criteria"); v != "" {
		r.AcceptanceCriteria = &v
	}
	if v := optString(req, "stage"); v != "" {
		st, err := parseStage(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Stage = &st
	}
	if v := optString(req, "priority"); v != "" {
		p, err := parsePriority(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Priority = &p
	}
	if v := optString(req, "type"); v != "" {
		r.Type = &v
	}
	if v := optString(req, "assignees"); v != "" {
		r.AssigneeIds = splitCSV(v)
	}
	if v := optString(req, "labels"); v != "" {
		r.Labels = splitCSV(v)
	}
	if v := optString(req, "parent"); v != "" {
		r.ParentTaskId = &v
	}
	if v := optString(req, "due_date"); v != "" {
		ts, err := parseDate(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.DueDate = ts
	}
	if v := optString(req, "start_date"); v != "" {
		ts, err := parseDate(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.StartDate = ts
	}
	if v := optString(req, "blocks"); v != "" {
		r.BlocksTaskIds = splitCSV(v)
	}
	if v := optString(req, "blocked_by"); v != "" {
		r.BlockedByTaskIds = splitCSV(v)
	}
	if v := optString(req, "reason"); v != "" {
		r.Reason = &v
	}

	task, err := s.client.CreateTask(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}
	return toolJSON(taskToMap(task, false))
}

func (s *Server) handleTaskUpdate(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)

	id, err := requiredString(req, "id")
	if err != nil {
		return toolError(err.Error()), nil
	}

	r := &pb.UpdateTaskRequest{Id: id}

	if v := optString(req, "name"); v != "" {
		r.Name = &v
	}
	if v := optString(req, "description"); v != "" {
		r.Description = &v
	}
	if v := optString(req, "acceptance_criteria"); v != "" {
		r.AcceptanceCriteria = &v
	}
	if v := optString(req, "stage"); v != "" {
		st, err := parseStage(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Stage = &st
	}
	if v := optString(req, "priority"); v != "" {
		p, err := parsePriority(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Priority = &p
	}
	if v := optString(req, "type"); v != "" {
		r.Type = &v
	}
	if v := optString(req, "assignees"); v != "" {
		if strings.EqualFold(v, "none") {
			r.ClearAssignees = true
		} else {
			r.AssigneeIds = splitCSV(v)
		}
	}
	if v := optString(req, "add_labels"); v != "" {
		r.AddLabels = splitCSV(v)
	}
	if v := optString(req, "remove_labels"); v != "" {
		r.RemoveLabels = splitCSV(v)
	}
	if v := optString(req, "add_blocks"); v != "" {
		r.AddBlocks = splitCSV(v)
	}
	if v := optString(req, "add_blocked_by"); v != "" {
		r.AddBlockedBy = splitCSV(v)
	}
	if v := optString(req, "remove_relationships"); v != "" {
		r.RemoveRelationships = splitCSV(v)
	}
	if v := optString(req, "due_date"); v != "" {
		if strings.EqualFold(v, "none") {
			r.ClearDueDate = true
		} else {
			ts, err := parseDate(v)
			if err != nil {
				return toolError(err.Error()), nil
			}
			r.DueDate = ts
		}
	}
	if v := optString(req, "start_date"); v != "" {
		if strings.EqualFold(v, "none") {
			r.ClearStartDate = true
		} else {
			ts, err := parseDate(v)
			if err != nil {
				return toolError(err.Error()), nil
			}
			r.StartDate = ts
		}
	}
	if v := optString(req, "parent"); v != "" {
		if strings.EqualFold(v, "none") {
			r.ClearParent = true
		} else {
			r.ParentTaskId = &v
		}
	}
	if v := optString(req, "reason"); v != "" {
		r.Reason = &v
	}
	if v := optString(req, "version"); v != "" {
		r.Version = &v
	}

	task, err := s.client.UpdateTask(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}
	return toolJSON(taskToMap(task, false))
}

func (s *Server) handleTaskClaim(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)

	id, err := requiredString(req, "id")
	if err != nil {
		return toolError(err.Error()), nil
	}

	r := &pb.ClaimTaskRequest{Id: id}
	if v := optString(req, "stage"); v != "" {
		st, err := parseStage(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Stage = &st
	}
	if v := optString(req, "reason"); v != "" {
		r.Reason = &v
	}
	if v := optString(req, "version"); v != "" {
		r.Version = &v
	}

	resp, err := s.client.ClaimTask(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}

	m := taskToMap(resp.GetTask(), false)
	m["claimed_at"] = formatTimestamp(resp.GetClaimedAt())
	return toolJSON(m)
}

func (s *Server) handleTaskClose(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)

	id, err := requiredString(req, "id")
	if err != nil {
		return toolError(err.Error()), nil
	}

	r := &pb.CloseTaskRequest{Id: id}
	if v := optString(req, "stage"); v != "" {
		st, err := parseStage(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Stage = &st
	}
	if v := optString(req, "reason"); v != "" {
		r.Reason = &v
	}
	if v := optString(req, "duplicate_of"); v != "" {
		r.DuplicateOfTaskId = &v
	}
	if v := optString(req, "version"); v != "" {
		r.Version = &v
	}

	task, err := s.client.CloseTask(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}
	return toolJSON(taskToMap(task, false))
}

func (s *Server) handleTaskSearch(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)
	collection := s.resolveCollection(grpcCtx, optString(req, "collection"))

	query, err := requiredString(req, "query")
	if err != nil {
		return toolError(err.Error()), nil
	}
	queryLower := strings.ToLower(query)

	maxResults := 20
	if v := optFloat(req, "limit"); v > 0 {
		maxResults = int(v)
	}

	r := &pb.ListTasksRequest{
		Full:     true,
		PageSize: 200,
	}
	if collection != "" {
		r.CollectionId = &collection
	}
	if v := optString(req, "phase"); v != "" {
		p, err := parsePhase(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.Phase = &p
	}

	resp, err := s.client.ListTasks(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}

	items := make([]interface{}, 0)
	for _, t := range resp.GetItems() {
		if strings.Contains(strings.ToLower(t.GetName()), queryLower) {
			items = append(items, taskToMap(t, true))
			if len(items) >= maxResults {
				break
			}
		}
	}
	return toolJSON(map[string]interface{}{
		"items":       items,
		"total_count": len(items),
	})
}

func (s *Server) handleTaskTree(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)

	id, err := requiredString(req, "id")
	if err != nil {
		return toolError(err.Error()), nil
	}

	dir := pb.DependencyDirection_DEPENDENCY_DIRECTION_BOTH
	if v := optString(req, "direction"); v != "" {
		switch strings.ToLower(v) {
		case "up":
			dir = pb.DependencyDirection_DEPENDENCY_DIRECTION_UP
		case "down":
			dir = pb.DependencyDirection_DEPENDENCY_DIRECTION_DOWN
		case "both":
		default:
			return toolError(fmt.Sprintf("invalid direction %q; valid: up, down, both", v)), nil
		}
	}

	maxDepth := int32(5)
	if v, ok, err := optBoundedPositiveInt32(req, "max_depth", maxMCPDependencyDepth); err != nil {
		return toolError(err.Error()), nil
	} else if ok {
		maxDepth = v
	}

	resp, err := s.client.GetDependencyTree(grpcCtx, &pb.GetDependencyTreeRequest{
		TaskId:    id,
		Direction: dir,
		MaxDepth:  maxDepth,
	})
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}
	return toolJSON(dependencyNodeToMap(resp.GetRoot()))
}

func (s *Server) handleTaskReady(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)
	collection := s.resolveCollection(grpcCtx, optString(req, "collection"))

	r := &pb.GetReadyTasksRequest{
		IncludeUnblockedOpen: optBool(req, "include_unblocked"),
		PageSize:             50,
	}
	if collection != "" {
		r.CollectionId = &collection
	}
	if v := optString(req, "assignee"); v != "" {
		r.Assignee = &v
	}
	if v := optString(req, "min_priority"); v != "" {
		p, err := parsePriority(v)
		if err != nil {
			return toolError(err.Error()), nil
		}
		r.MinPriority = &p
	}
	if v, ok, err := optBoundedPositiveInt32(req, "limit", maxMCPPageSize); err != nil {
		return toolError(err.Error()), nil
	} else if ok {
		r.PageSize = v
	}

	resp, err := s.client.GetReadyTasks(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}

	items := make([]interface{}, 0, len(resp.GetItems()))
	for _, item := range resp.GetItems() {
		t := item.GetTask()
		items = append(items, map[string]interface{}{
			"id":                t.GetId(),
			"name":              t.GetName(),
			"phase":             phaseNames[t.GetPhase()],
			"stage":             stageNames[t.GetStage()],
			"priority":          nilIfZeroPriority(t.GetPriority()),
			"assignees":         usersToList(t.GetAssignees()),
			"blockers_resolved": item.GetBlockersResolved(),
			"updated_at":        formatTimestamp(t.GetUpdatedAt()),
		})
	}
	return toolJSON(map[string]interface{}{
		"items":       items,
		"total_count": resp.GetTotalCount(),
	})
}

func (s *Server) handleTaskCriticalPath(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	grpcCtx := s.authCtx(ctx)
	collection := s.resolveCollection(grpcCtx, optString(req, "collection"))
	if collection == "" {
		return toolError("collection is required for critical path analysis"), nil
	}

	r := &pb.GetCriticalPathRequest{
		CollectionId: collection,
	}
	if v := optString(req, "root"); v != "" {
		r.RootTaskId = &v
	}

	resp, err := s.client.GetCriticalPath(grpcCtx, r)
	if err != nil {
		return toolError(grpcErrMsg(err)), nil
	}

	path := make([]interface{}, 0, len(resp.GetPath()))
	for _, n := range resp.GetPath() {
		path = append(path, map[string]interface{}{
			"id":    n.GetId(),
			"name":  n.GetName(),
			"stage": stageNames[n.GetStage()],
			"depth": n.GetDepth(),
		})
	}

	result := map[string]interface{}{
		"path":        path,
		"total_depth": resp.GetTotalDepth(),
	}
	if b := resp.GetBottleneck(); b != nil {
		result["bottleneck"] = map[string]interface{}{
			"id":      b.GetId(),
			"name":    b.GetName(),
			"fan_out": b.GetFanOut(),
			"reason":  b.GetReason(),
		}
	}
	return toolJSON(result)
}

// --- auth helpers ---

func (s *Server) authCtx(ctx context.Context) context.Context {
	if s.token == "" {
		return ctx
	}
	return contextWithToken(ctx, s.token)
}

func (s *Server) resolveCollection(ctx context.Context, explicit string) string {
	if explicit != "" {
		return explicit
	}
	resp, err := s.client.ListCollections(ctx, &pb.ListCollectionsRequest{})
	if err != nil || len(resp.GetItems()) != 1 {
		return ""
	}
	return resp.GetItems()[0].GetId()
}

// --- proto enum parsing (mirrors internal/cli/enums.go) ---

var phaseNames = map[pb.TaskPhase]string{
	pb.TaskPhase_TASK_PHASE_OPEN:        "OPEN",
	pb.TaskPhase_TASK_PHASE_IN_PROGRESS: "IN_PROGRESS",
	pb.TaskPhase_TASK_PHASE_ON_HOLD:     "ON_HOLD",
	pb.TaskPhase_TASK_PHASE_CLOSED:      "CLOSED",
}

var stageNames = map[pb.TaskStage]string{
	pb.TaskStage_TASK_STAGE_TRIAGE:            "triage",
	pb.TaskStage_TASK_STAGE_BACKLOG:           "backlog",
	pb.TaskStage_TASK_STAGE_READY:             "ready",
	pb.TaskStage_TASK_STAGE_WORKING:           "working",
	pb.TaskStage_TASK_STAGE_IN_REVIEW:         "in_review",
	pb.TaskStage_TASK_STAGE_IN_QA:             "in_qa",
	pb.TaskStage_TASK_STAGE_DEPLOYING:         "deploying",
	pb.TaskStage_TASK_STAGE_BLOCKED:           "blocked",
	pb.TaskStage_TASK_STAGE_WAITING_FOR_INPUT: "waiting_for_input",
	pb.TaskStage_TASK_STAGE_DEFERRED:          "deferred",
	pb.TaskStage_TASK_STAGE_SCHEDULED:         "scheduled",
	pb.TaskStage_TASK_STAGE_COMPLETED:         "completed",
	pb.TaskStage_TASK_STAGE_WONT_FIX:          "wont_fix",
	pb.TaskStage_TASK_STAGE_DUPLICATE:         "duplicate",
	pb.TaskStage_TASK_STAGE_CANCELLED:         "cancelled",
}

var stageValues = map[string]pb.TaskStage{
	"triage":            pb.TaskStage_TASK_STAGE_TRIAGE,
	"backlog":           pb.TaskStage_TASK_STAGE_BACKLOG,
	"ready":             pb.TaskStage_TASK_STAGE_READY,
	"working":           pb.TaskStage_TASK_STAGE_WORKING,
	"in_review":         pb.TaskStage_TASK_STAGE_IN_REVIEW,
	"in_qa":             pb.TaskStage_TASK_STAGE_IN_QA,
	"deploying":         pb.TaskStage_TASK_STAGE_DEPLOYING,
	"blocked":           pb.TaskStage_TASK_STAGE_BLOCKED,
	"waiting_for_input": pb.TaskStage_TASK_STAGE_WAITING_FOR_INPUT,
	"deferred":          pb.TaskStage_TASK_STAGE_DEFERRED,
	"scheduled":         pb.TaskStage_TASK_STAGE_SCHEDULED,
	"completed":         pb.TaskStage_TASK_STAGE_COMPLETED,
	"wont_fix":          pb.TaskStage_TASK_STAGE_WONT_FIX,
	"duplicate":         pb.TaskStage_TASK_STAGE_DUPLICATE,
	"cancelled":         pb.TaskStage_TASK_STAGE_CANCELLED,
}

var priorityNames = map[pb.TaskPriority]string{
	pb.TaskPriority_TASK_PRIORITY_URGENT: "URGENT",
	pb.TaskPriority_TASK_PRIORITY_HIGH:   "HIGH",
	pb.TaskPriority_TASK_PRIORITY_NORMAL: "NORMAL",
	pb.TaskPriority_TASK_PRIORITY_LOW:    "LOW",
}

var priorityValues = map[string]pb.TaskPriority{
	"URGENT": pb.TaskPriority_TASK_PRIORITY_URGENT,
	"HIGH":   pb.TaskPriority_TASK_PRIORITY_HIGH,
	"NORMAL": pb.TaskPriority_TASK_PRIORITY_NORMAL,
	"LOW":    pb.TaskPriority_TASK_PRIORITY_LOW,
}

var sortFieldValues = map[string]pb.SortField{
	"created":  pb.SortField_SORT_FIELD_CREATED,
	"updated":  pb.SortField_SORT_FIELD_UPDATED,
	"priority": pb.SortField_SORT_FIELD_PRIORITY,
	"due_date": pb.SortField_SORT_FIELD_DUE_DATE,
}

var sortOrderValues = map[string]pb.SortOrder{
	"asc":  pb.SortOrder_SORT_ORDER_ASC,
	"desc": pb.SortOrder_SORT_ORDER_DESC,
}

var userTypeNames = map[pb.UserType]string{
	pb.UserType_USER_TYPE_HUMAN:           "HUMAN",
	pb.UserType_USER_TYPE_AGENT:           "AGENT",
	pb.UserType_USER_TYPE_SERVICE_ACCOUNT: "SERVICE_ACCOUNT",
}

func parsePhase(s string) (pb.TaskPhase, error) {
	switch strings.ToUpper(s) {
	case "OPEN":
		return pb.TaskPhase_TASK_PHASE_OPEN, nil
	case "IN_PROGRESS":
		return pb.TaskPhase_TASK_PHASE_IN_PROGRESS, nil
	case "ON_HOLD":
		return pb.TaskPhase_TASK_PHASE_ON_HOLD, nil
	case "CLOSED":
		return pb.TaskPhase_TASK_PHASE_CLOSED, nil
	default:
		return 0, fmt.Errorf("invalid phase %q; valid: OPEN, IN_PROGRESS, ON_HOLD, CLOSED", s)
	}
}

func parseStage(s string) (pb.TaskStage, error) {
	v, ok := stageValues[strings.ToLower(s)]
	if !ok {
		return 0, fmt.Errorf("invalid stage %q", s)
	}
	return v, nil
}

func parsePriority(s string) (pb.TaskPriority, error) {
	v, ok := priorityValues[strings.ToUpper(s)]
	if !ok {
		return 0, fmt.Errorf("invalid priority %q; valid: URGENT, HIGH, NORMAL, LOW", s)
	}
	return v, nil
}

func parseDate(s string) (*timestamppb.Timestamp, error) {
	for _, layout := range []string{
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	} {
		if t, err := parseTime(layout, s); err == nil {
			return timestamppb.New(t), nil
		}
	}
	return nil, fmt.Errorf("cannot parse date %q (use ISO 8601 or YYYY-MM-DD)", s)
}

// --- output conversion (mirrors internal/cli/output.go) ---

func taskToMap(t *pb.Task, compact bool) map[string]interface{} {
	m := map[string]interface{}{
		"id":            t.GetId(),
		"name":          t.GetName(),
		"phase":         phaseNames[t.GetPhase()],
		"stage":         stageNames[t.GetStage()],
		"priority":      nilIfZeroPriority(t.GetPriority()),
		"type":          nilIfEmpty(t.GetType()),
		"assignees":     usersToList(t.GetAssignees()),
		"collection_id": t.GetCollectionId(),
		"updated_at":    formatTimestamp(t.GetUpdatedAt()),
	}
	if !compact {
		m["description"] = nilIfEmpty(t.GetDescription())
		m["acceptance_criteria"] = nilIfEmpty(t.GetAcceptanceCriteria())
		m["native_status"] = nilIfEmpty(t.GetNativeStatus())
		m["creator"] = userToMap(t.GetCreator())
		m["start_date"] = formatTimestamp(t.GetStartDate())
		m["due_date"] = formatTimestamp(t.GetDueDate())
		m["parent_task_id"] = nilIfEmpty(t.GetParentTaskId())
		m["relationships"] = relationshipsToList(t.GetRelationships())
		m["labels"] = t.GetLabels()
		m["code_context"] = codeContextToMap(t.GetCodeContext())
		m["platform"] = platformNames[t.GetPlatform()]
		m["created_at"] = formatTimestamp(t.GetCreatedAt())
		m["closed_at"] = formatTimestamp(t.GetClosedAt())
		m["version"] = t.GetVersion()
	}
	return m
}

var platformNames = map[pb.Platform]string{
	pb.Platform_PLATFORM_FARMTABLE: "farmtable",
	pb.Platform_PLATFORM_GITHUB:    "github",
	pb.Platform_PLATFORM_LINEAR:    "linear",
	pb.Platform_PLATFORM_JIRA:      "jira",
	pb.Platform_PLATFORM_ASANA:     "asana",
	pb.Platform_PLATFORM_BEADS:     "beads",
}

func commentToMap(c *pb.Comment) map[string]interface{} {
	return map[string]interface{}{
		"id":         c.GetId(),
		"task_id":    c.GetTaskId(),
		"author":     userToMap(c.GetAuthor()),
		"body":       c.GetBody(),
		"created_at": formatTimestamp(c.GetCreatedAt()),
		"updated_at": formatTimestamp(c.GetUpdatedAt()),
	}
}

func changeToMap(c *pb.Change) map[string]interface{} {
	m := map[string]interface{}{
		"id":         c.GetId(),
		"task_id":    c.GetTaskId(),
		"field":      c.GetField(),
		"old_value":  nil,
		"new_value":  nil,
		"changed_by": userToMap(c.GetChangedBy()),
		"changed_at": formatTimestamp(c.GetChangedAt()),
		"reason":     nilIfEmpty(c.GetReason()),
	}
	if c.GetOldValue() != nil {
		m["old_value"] = c.GetOldValue().AsInterface()
	}
	if c.GetNewValue() != nil {
		m["new_value"] = c.GetNewValue().AsInterface()
	}
	return m
}

func userToMap(u *pb.User) interface{} {
	if u == nil {
		return nil
	}
	m := map[string]interface{}{
		"id":   u.GetId(),
		"name": u.GetName(),
		"type": userTypeNames[u.GetType()],
	}
	if u.GetEmail() != "" {
		m["email"] = u.GetEmail()
	}
	return m
}

func usersToList(users []*pb.User) []interface{} {
	result := make([]interface{}, 0, len(users))
	for _, u := range users {
		result = append(result, userToMap(u))
	}
	return result
}

func relationshipsToList(rels []*pb.Relationship) []interface{} {
	result := make([]interface{}, 0, len(rels))
	for _, r := range rels {
		result = append(result, map[string]interface{}{
			"type":           r.GetType().String(),
			"target_task_id": r.GetTargetTaskId(),
		})
	}
	return result
}

func codeContextToMap(cc *pb.CodeContext) interface{} {
	if cc == nil {
		return nil
	}
	m := map[string]interface{}{
		"repo":        nilIfEmpty(cc.GetRepo()),
		"branch":      nilIfEmpty(cc.GetBranch()),
		"ci_status":   nil,
		"commit_shas": cc.GetCommitShas(),
	}
	if cc.GetCiStatus() != pb.CIStatus_CI_STATUS_UNSPECIFIED {
		m["ci_status"] = strings.ToLower(strings.TrimPrefix(cc.GetCiStatus().String(), "CI_STATUS_"))
	}
	var prs []map[string]interface{}
	for _, pr := range cc.GetPullRequests() {
		prs = append(prs, map[string]interface{}{
			"id":     pr.GetId(),
			"url":    pr.GetUrl(),
			"status": strings.ToLower(strings.TrimPrefix(pr.GetStatus().String(), "PULL_REQUEST_STATUS_")),
		})
	}
	m["pull_requests"] = prs
	return m
}

func dependencyNodeToMap(n *pb.DependencyNode) map[string]interface{} {
	if n == nil {
		return nil
	}
	t := n.GetTask()
	m := map[string]interface{}{
		"id":    t.GetId(),
		"name":  t.GetName(),
		"phase": phaseNames[t.GetPhase()],
		"stage": stageNames[t.GetStage()],
	}
	if len(n.GetBlocks()) > 0 {
		blocks := make([]interface{}, 0, len(n.GetBlocks()))
		for _, child := range n.GetBlocks() {
			blocks = append(blocks, dependencyNodeToMap(child))
		}
		m["blocks"] = blocks
	}
	if len(n.GetBlockedBy()) > 0 {
		blockedBy := make([]interface{}, 0, len(n.GetBlockedBy()))
		for _, parent := range n.GetBlockedBy() {
			blockedBy = append(blockedBy, dependencyNodeToMap(parent))
		}
		m["blocked_by"] = blockedBy
	}
	return m
}

func formatTimestamp(ts *timestamppb.Timestamp) interface{} {
	if ts == nil || (ts.GetSeconds() == 0 && ts.GetNanos() == 0) {
		return nil
	}
	return ts.AsTime().UTC().Format("2006-01-02T15:04:05Z")
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nilIfZeroPriority(p pb.TaskPriority) interface{} {
	if p == pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
		return nil
	}
	return priorityNames[p]
}

// --- request param helpers ---

func optString(req mcp.CallToolRequest, key string) string {
	v, ok := req.GetArguments()[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

func optBool(req mcp.CallToolRequest, key string) bool {
	v, ok := req.GetArguments()[key]
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

func optFloat(req mcp.CallToolRequest, key string) float64 {
	v, ok := req.GetArguments()[key]
	if !ok {
		return 0
	}
	f, ok := v.(float64)
	if !ok {
		return 0
	}
	return f
}

func optBoundedPositiveInt32(req mcp.CallToolRequest, key string, max int32) (int32, bool, error) {
	v := optFloat(req, key)
	if v == 0 {
		return 0, false, nil
	}
	if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 || math.Trunc(v) != v {
		return 0, false, fmt.Errorf("%s must be a positive integer", key)
	}
	if v > float64(max) {
		return 0, false, fmt.Errorf("%s cannot exceed %d", key, max)
	}
	return int32(v), true, nil
}

func requiredString(req mcp.CallToolRequest, key string) (string, error) {
	v := optString(req, key)
	if v == "" {
		return "", fmt.Errorf("required parameter %q is missing", key)
	}
	return v, nil
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// --- result helpers ---

func toolJSON(v interface{}) (*mcp.CallToolResult, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return toolError(fmt.Sprintf("encoding result: %v", err)), nil
	}
	return mcp.NewToolResultText(string(data)), nil
}

func toolError(msg string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{
			mcp.NewTextContent(msg),
		},
	}
}

func grpcErrMsg(err error) string {
	return err.Error()
}
