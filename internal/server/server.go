package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type FarmTableService struct {
	pb.UnimplementedFarmTableServiceServer
	store     store.Store
	version   string
	startedAt time.Time
}

func NewFarmTableService(s store.Store, version string) *FarmTableService {
	return &FarmTableService{store: s, version: version, startedAt: time.Now()}
}

const defaultPageSize = 50

// ── Tasks ──

func (s *FarmTableService) CreateTask(ctx context.Context, req *pb.CreateTaskRequest) (*pb.Task, error) {
	collID, err := uuid.Parse(req.GetCollectionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
	}

	stage := task.StageTriage
	phase := task.PhaseOpen
	if req.Stage != nil {
		stage = stageFromProto(*req.Stage)
		phase = phaseForStage(stage)
	}

	p := store.CreateTaskParams{
		Title:        req.GetName(),
		Description:  req.GetDescription(),
		CollectionID: collID,
		Phase:        phase,
		Stage:        stage,
		NativeLabel:  string(stage),
		Type:         req.GetType(),
	}

	if req.Priority != nil {
		pr := priorityFromProto(*req.Priority)
		p.Priority = &pr
	}
	if len(req.GetAssigneeIds()) > 0 {
		aid, err := uuid.Parse(req.GetAssigneeIds()[0])
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid assignee_id: %v", err)
		}
		p.AssigneeID = &aid
	}
	if req.ParentTaskId != nil {
		pid, err := uuid.Parse(*req.ParentTaskId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid parent_task_id: %v", err)
		}
		p.ParentTaskID = &pid
	}
	if req.AcceptanceCriteria != nil {
		p.AcceptanceCriteria = req.AcceptanceCriteria
	}
	if len(req.GetLabels()) > 0 {
		p.Labels = req.GetLabels()
	}
	if req.GetDueDate() != nil {
		d := req.GetDueDate().AsTime()
		p.DueDate = &d
	}
	if req.GetStartDate() != nil {
		d := req.GetStartDate().AsTime()
		p.StartDate = &d
	}
	for _, idStr := range req.GetBlocksTaskIds() {
		bid, err := uuid.Parse(idStr)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid blocks_task_id: %v", err)
		}
		p.BlocksTaskIDs = append(p.BlocksTaskIDs, bid)
	}
	for _, idStr := range req.GetBlockedByTaskIds() {
		bid, err := uuid.Parse(idStr)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid blocked_by_task_id: %v", err)
		}
		p.BlockedByTaskIDs = append(p.BlockedByTaskIDs, bid)
	}
	if req.Repo != nil {
		p.Repo = *req.Repo
	}
	if req.Branch != nil {
		p.Branch = *req.Branch
	}

	t, err := s.store.CreateTask(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "creating task: %v", err)
	}
	return taskToProto(t), nil
}

func (s *FarmTableService) GetTask(ctx context.Context, req *pb.GetTaskRequest) (*pb.GetTaskResponse, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task id: %v", err)
	}

	t, err := s.store.GetTask(ctx, id)
	if err != nil {
		return nil, storeErr(err, "task")
	}

	resp := &pb.GetTaskResponse{Task: taskToProto(t)}

	if req.GetIncludeComments() {
		comments, _, err := s.store.ListComments(ctx, store.ListCommentsParams{
			TaskID: id,
			Limit:  20,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "listing comments: %v", err)
		}
		for _, c := range comments {
			resp.Comments = append(resp.Comments, commentToProto(c))
		}
	}

	if req.GetIncludeChanges() {
		changes, _, err := s.store.ListChanges(ctx, store.ListChangesParams{
			TaskID: id,
			Limit:  50,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "listing changes: %v", err)
		}
		for _, c := range changes {
			resp.Changes = append(resp.Changes, changeToProto(c))
		}
	}

	return resp, nil
}

func (s *FarmTableService) ListTasks(ctx context.Context, req *pb.ListTasksRequest) (*pb.ListTasksResponse, error) {
	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	cursor, err := decodeCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	p := store.ListTasksParams{
		Limit:         pageSize,
		LastID:        cursor.LastID,
		LastSortValue: cursor.LastSortValue,
	}

	if req.CollectionId != nil {
		cid, err := uuid.Parse(*req.CollectionId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
		}
		p.CollectionID = &cid
	}
	if req.Phase != nil && *req.Phase != pb.TaskPhase_TASK_PHASE_UNSPECIFIED {
		ph := phaseFromProto(*req.Phase)
		p.Phase = &ph
	}
	if len(req.GetStages()) > 0 {
		st := stageFromProto(req.GetStages()[0])
		p.Stage = &st
	}
	if req.Assignee != nil {
		if *req.Assignee == "none" {
			p.Unassigned = true
		} else {
			aid, err := uuid.Parse(*req.Assignee)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid assignee: %v", err)
			}
			p.AssigneeID = &aid
		}
	}
	if req.Priority != nil && *req.Priority != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
		pr := priorityFromProto(*req.Priority)
		p.Priority = &pr
	}
	if req.Type != nil {
		p.Type = req.Type
	}
	if len(req.GetLabels()) > 0 {
		p.Labels = req.GetLabels()
	}
	if req.ParentTaskId != nil {
		pid, err := uuid.Parse(*req.ParentTaskId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid parent_task_id: %v", err)
		}
		p.ParentTaskID = &pid
	}
	if req.GetSortField() != pb.SortField_SORT_FIELD_UNSPECIFIED {
		p.SortField = sortFieldToString(req.GetSortField())
	}
	if req.GetSortOrder() != pb.SortOrder_SORT_ORDER_UNSPECIFIED {
		p.SortOrder = sortOrderToString(req.GetSortOrder())
	}

	tasks, total, err := s.store.ListTasks(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing tasks: %v", err)
	}

	resp := &pb.ListTasksResponse{
		TotalCount: int32(total),
	}
	for _, t := range tasks {
		resp.Items = append(resp.Items, taskToProto(t))
	}

	sortField := p.SortField
	if sortField == "" {
		sortField = "created"
	}
	if len(tasks) > 0 && len(tasks) == pageSize {
		last := tasks[len(tasks)-1]
		resp.HasMore = true
		resp.NextPageToken = encodeCursor(last.ID.String(), taskSortValue(last, sortField))
	}

	return resp, nil
}

func (s *FarmTableService) UpdateTask(ctx context.Context, req *pb.UpdateTaskRequest) (*pb.Task, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task id: %v", err)
	}

	p := store.UpdateTaskParams{}

	if req.Version != nil {
		p.Version = *req.Version
	}

	if req.Name != nil {
		p.Title = req.Name
	}
	if req.Description != nil {
		p.Description = req.Description
	}
	if req.AcceptanceCriteria != nil {
		p.AcceptanceCriteria = req.AcceptanceCriteria
	}
	if req.Stage != nil {
		st := stageFromProto(*req.Stage)
		p.Stage = &st
		ph := phaseForStage(st)
		p.Phase = &ph
	}
	if req.Priority != nil {
		pr := priorityFromProto(*req.Priority)
		p.Priority = &pr
	}
	if req.Type != nil {
		p.Type = req.Type
	}
	if req.GetClearAssignees() {
		p.ClearAssignee = true
	} else if len(req.GetAssigneeIds()) > 0 {
		aid, err := uuid.Parse(req.GetAssigneeIds()[0])
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid assignee_id: %v", err)
		}
		p.AssigneeID = &aid
	}
	if req.GetClearParent() {
		p.ClearParent = true
	} else if req.ParentTaskId != nil {
		pid, err := uuid.Parse(*req.ParentTaskId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid parent_task_id: %v", err)
		}
		p.ParentTaskID = &pid
	}

	if req.GetDueDate() != nil {
		d := req.GetDueDate().AsTime()
		p.DueDate = &d
	}
	if req.GetClearDueDate() {
		p.ClearDueDate = true
	}
	if req.GetStartDate() != nil {
		d := req.GetStartDate().AsTime()
		p.StartDate = &d
	}
	if req.GetClearStartDate() {
		p.ClearStartDate = true
	}

	if len(req.GetAddLabels()) > 0 {
		p.AddLabels = req.GetAddLabels()
	}
	if len(req.GetRemoveLabels()) > 0 {
		p.RemoveLabels = req.GetRemoveLabels()
	}

	for _, idStr := range req.GetAddBlocks() {
		bid, err := uuid.Parse(idStr)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid add_blocks id: %v", err)
		}
		p.AddBlocks = append(p.AddBlocks, bid)
	}
	for _, idStr := range req.GetAddBlockedBy() {
		bid, err := uuid.Parse(idStr)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid add_blocked_by id: %v", err)
		}
		p.AddBlockedBy = append(p.AddBlockedBy, bid)
	}
	for _, idStr := range req.GetRemoveRelationships() {
		rid, err := uuid.Parse(idStr)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid remove_relationships id: %v", err)
		}
		p.RemoveRelationships = append(p.RemoveRelationships, rid)
	}

	if req.Repo != nil {
		p.Repo = req.Repo
	}
	if req.Branch != nil {
		p.Branch = req.Branch
	}
	for _, pr := range req.GetAddPullRequests() {
		p.AddPullRequests = append(p.AddPullRequests, store.PullRequestParam{
			ID:     pr.GetId(),
			URL:    pr.GetUrl(),
			Status: prStatusFromProto(pr.GetStatus()),
		})
	}
	if req.CiStatus != nil && *req.CiStatus != pb.CIStatus_CI_STATUS_UNSPECIFIED {
		cs := ciStatusFromProto(*req.CiStatus)
		p.CIStatus = &cs
	}

	if req.Reason != nil {
		p.Reason = req.Reason
	}

	actorID, _ := UserIDFromContext(ctx)
	t, err := s.store.UpdateTask(ctx, id, p, actorID)
	if err != nil {
		return nil, storeErr(err, "task")
	}
	return taskToProto(t), nil
}

func (s *FarmTableService) ClaimTask(ctx context.Context, req *pb.ClaimTaskRequest) (*pb.ClaimTaskResponse, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task id: %v", err)
	}

	assigneeID, _ := UserIDFromContext(ctx)
	if req.AssigneeId != nil {
		parsed, err := uuid.Parse(*req.AssigneeId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid assignee_id: %v", err)
		}
		assigneeID = parsed
	}
	if assigneeID == uuid.Nil {
		assigneeID = uuid.New()
	}

	version := ""
	if req.Version != nil {
		version = *req.Version
	}

	t, err := s.store.ClaimTask(ctx, id, assigneeID, version)
	if err != nil {
		return nil, storeErr(err, "task")
	}

	return &pb.ClaimTaskResponse{
		Task:      taskToProto(t),
		ClaimedAt: timestamppb.Now(),
	}, nil
}

func (s *FarmTableService) CloseTask(ctx context.Context, req *pb.CloseTaskRequest) (*pb.Task, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task id: %v", err)
	}

	stage := task.StageCompleted
	if req.Stage != nil {
		stage = stageFromProto(*req.Stage)
	}

	version := ""
	if req.Version != nil {
		version = *req.Version
	}

	actorID, _ := UserIDFromContext(ctx)
	t, err := s.store.CloseTask(ctx, id, stage, version, actorID)
	if err != nil {
		return nil, storeErr(err, "task")
	}
	return taskToProto(t), nil
}

func (s *FarmTableService) DeleteTask(_ context.Context, _ *pb.DeleteTaskRequest) (*pb.DeleteTaskResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "delete is not supported; close tasks instead")
}

// ── Comments ──

func (s *FarmTableService) AddComment(ctx context.Context, req *pb.AddCommentRequest) (*pb.Comment, error) {
	taskID, err := uuid.Parse(req.GetTaskId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
	}

	authorID, _ := UserIDFromContext(ctx)
	if authorID == uuid.Nil {
		authorID = uuid.New()
	}

	c, err := s.store.AddComment(ctx, store.AddCommentParams{
		TaskID:   taskID,
		AuthorID: authorID,
		Body:     req.GetBody(),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "adding comment: %v", err)
	}
	return commentToProto(c), nil
}

func (s *FarmTableService) ListComments(ctx context.Context, req *pb.ListCommentsRequest) (*pb.ListCommentsResponse, error) {
	taskID, err := uuid.Parse(req.GetTaskId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
	}

	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	cursor, err := decodeCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	comments, total, err := s.store.ListComments(ctx, store.ListCommentsParams{
		TaskID:        taskID,
		Limit:         pageSize,
		LastID:        cursor.LastID,
		LastSortValue: cursor.LastSortValue,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing comments: %v", err)
	}

	resp := &pb.ListCommentsResponse{
		TotalCount: int32(total),
	}
	for _, c := range comments {
		resp.Items = append(resp.Items, commentToProto(c))
	}
	if len(comments) > 0 && len(comments) == pageSize {
		last := comments[len(comments)-1]
		resp.HasMore = true
		resp.NextPageToken = encodeCursor(last.ID.String(), last.CreatedAt.UTC().Format(time.RFC3339Nano))
	}
	return resp, nil
}

func (s *FarmTableService) GetComment(ctx context.Context, req *pb.GetCommentRequest) (*pb.Comment, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid comment id: %v", err)
	}

	c, err := s.store.GetComment(ctx, id)
	if err != nil {
		return nil, storeErr(err, "comment")
	}
	return commentToProto(c), nil
}

// ── Collections ──

func (s *FarmTableService) GetCollection(ctx context.Context, req *pb.GetCollectionRequest) (*pb.Collection, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid collection id: %v", err)
	}

	c, err := s.store.GetCollection(ctx, id)
	if err != nil {
		return nil, storeErr(err, "collection")
	}
	return collectionToProto(c), nil
}

func (s *FarmTableService) ListCollections(ctx context.Context, req *pb.ListCollectionsRequest) (*pb.ListCollectionsResponse, error) {
	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	cursor, err := decodeCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	p := store.ListCollectionsParams{
		Limit:         pageSize,
		LastID:        cursor.LastID,
		LastSortValue: cursor.LastSortValue,
	}

	if req.Platform != nil && *req.Platform != pb.Platform_PLATFORM_UNSPECIFIED {
		plat := platformFromProto(*req.Platform)
		p.Platform = &plat
	}

	cols, total, err := s.store.ListCollections(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing collections: %v", err)
	}

	resp := &pb.ListCollectionsResponse{
		TotalCount: int32(total),
	}
	for _, c := range cols {
		resp.Items = append(resp.Items, collectionToProto(c))
	}
	if len(cols) > 0 && len(cols) == pageSize {
		last := cols[len(cols)-1]
		resp.HasMore = true
		resp.NextPageToken = encodeCursor(last.ID.String(), last.CreatedAt.UTC().Format(time.RFC3339Nano))
	}
	return resp, nil
}

func (s *FarmTableService) CreateCollection(ctx context.Context, req *pb.CreateCollectionRequest) (*pb.Collection, error) {
	p := store.CreateCollectionParams{
		Name:        req.GetName(),
		Description: req.GetDescription(),
		Platform:    "farmtable",
	}

	c, err := s.store.CreateCollection(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "creating collection: %v", err)
	}
	return collectionToProto(c), nil
}

// ── Audit Trail ──

func (s *FarmTableService) ListChanges(ctx context.Context, req *pb.ListChangesRequest) (*pb.ListChangesResponse, error) {
	taskID, err := uuid.Parse(req.GetTaskId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
	}

	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	cursor, err := decodeCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	changes, total, err := s.store.ListChanges(ctx, store.ListChangesParams{
		TaskID:        taskID,
		Field:         req.GetField(),
		Limit:         pageSize,
		LastID:        cursor.LastID,
		LastSortValue: cursor.LastSortValue,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing changes: %v", err)
	}

	resp := &pb.ListChangesResponse{
		TotalCount: int32(total),
	}
	for _, c := range changes {
		resp.Items = append(resp.Items, changeToProto(c))
	}
	if len(changes) > 0 && len(changes) == pageSize {
		last := changes[len(changes)-1]
		resp.HasMore = true
		resp.NextPageToken = encodeCursor(last.ID.String(), last.CreatedAt.UTC().Format(time.RFC3339Nano))
	}
	return resp, nil
}

// ── Users ──

func (s *FarmTableService) WhoAmI(ctx context.Context, req *pb.WhoAmIRequest) (*pb.User, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok || userID == uuid.Nil {
		return nil, status.Error(codes.Unauthenticated, "not authenticated")
	}
	u, err := s.store.GetUser(ctx, userID)
	if err != nil {
		return nil, storeErr(err, "user")
	}
	return userToProto(u), nil
}

func (s *FarmTableService) ListUsers(ctx context.Context, req *pb.ListUsersRequest) (*pb.ListUsersResponse, error) {
	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	cursor, err := decodeCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	p := store.ListUsersParams{
		Limit:         pageSize,
		LastID:        cursor.LastID,
		LastSortValue: cursor.LastSortValue,
	}

	if req.Type != nil {
		p.Type = userTypeFromProto(*req.Type)
	}

	users, total, err := s.store.ListUsers(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "listing users: %v", err)
	}

	resp := &pb.ListUsersResponse{
		TotalCount: int32(total),
	}
	for _, u := range users {
		resp.Items = append(resp.Items, userToProto(u))
	}
	if len(users) > 0 && len(users) == pageSize {
		last := users[len(users)-1]
		resp.HasMore = true
		resp.NextPageToken = encodeCursor(last.ID.String(), last.CreatedAt.UTC().Format(time.RFC3339Nano))
	}
	return resp, nil
}

func (s *FarmTableService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user id: %v", err)
	}
	u, err := s.store.GetUser(ctx, id)
	if err != nil {
		return nil, storeErr(err, "user")
	}
	return userToProto(u), nil
}

// ── Status & Version ──

func (s *FarmTableService) GetVersion(ctx context.Context, req *pb.GetVersionRequest) (*pb.GetVersionResponse, error) {
	return &pb.GetVersionResponse{
		ServerVersion: s.version,
		Server:        "farmtable",
		ApiProtocol:   "grpc",
	}, nil
}

func (s *FarmTableService) GetStatus(ctx context.Context, req *pb.GetStatusRequest) (*pb.GetStatusResponse, error) {
	resp := &pb.GetStatusResponse{
		ServerVersion: s.version,
		Server:        "farmtable",
		ApiProtocol:   "grpc",
		Status:        "serving",
		ServerMode:    s.version,
		UptimeSeconds: int64(time.Since(s.startedAt).Seconds()),
	}

	_, _, err := s.store.ListCollections(ctx, store.ListCollectionsParams{Limit: 1})
	if err != nil {
		resp.Status = "unavailable"
	}

	tasks, _, listErr := s.store.ListTasks(ctx, store.ListTasksParams{Limit: 1})
	if listErr == nil {
		resp.TaskCount = int32(len(tasks))
	}

	if userID, ok := UserIDFromContext(ctx); ok && userID != uuid.Nil {
		if u, err := s.store.GetUser(ctx, userID); err == nil {
			resp.AuthenticatedAs = userToProto(u)
		}
	}

	return resp, nil
}

// ── Graph Queries ──

func (s *FarmTableService) GetReadyTasks(ctx context.Context, req *pb.GetReadyTasksRequest) (*pb.GetReadyTasksResponse, error) {
	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	offset, err := decodeOffsetCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	p := store.GetReadyTasksParams{
		IncludeUnblockedOpen: req.GetIncludeUnblockedOpen(),
		Limit:                pageSize,
		Offset:               offset,
	}

	if req.CollectionId != nil {
		cid, err := uuid.Parse(*req.CollectionId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
		}
		p.CollectionID = &cid
	}
	if req.Assignee != nil {
		if *req.Assignee == "none" {
			p.Unassigned = true
		} else {
			aid, err := uuid.Parse(*req.Assignee)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid assignee: %v", err)
			}
			p.AssigneeID = &aid
		}
	}
	if req.MinPriority != nil && *req.MinPriority != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
		pr := priorityFromProto(*req.MinPriority)
		p.MinPriority = &pr
	}

	results, total, err := s.store.GetReadyTasks(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "getting ready tasks: %v", err)
	}

	resp := &pb.GetReadyTasksResponse{
		TotalCount: int32(total),
	}
	for _, r := range results {
		resp.Items = append(resp.Items, &pb.ReadyTask{
			Task:             taskToProto(r.Task),
			BlockersResolved: int32(r.BlockersResolved),
		})
	}

	nextOffset := offset + len(results)
	if nextOffset < total {
		resp.HasMore = true
		resp.NextPageToken = encodeOffsetCursor(nextOffset)
	}

	return resp, nil
}

func (s *FarmTableService) GetBlockedTasks(ctx context.Context, req *pb.GetBlockedTasksRequest) (*pb.GetBlockedTasksResponse, error) {
	pageSize := int(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > 200 {
		pageSize = 200
	}

	offset, err := decodeOffsetCursor(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	p := store.GetBlockedTasksParams{
		Limit:  pageSize,
		Offset: offset,
	}

	if req.CollectionId != nil {
		cid, err := uuid.Parse(*req.CollectionId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
		}
		p.CollectionID = &cid
	}
	if req.Assignee != nil {
		if *req.Assignee == "none" {
			p.Unassigned = true
		} else {
			aid, err := uuid.Parse(*req.Assignee)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid assignee: %v", err)
			}
			p.AssigneeID = &aid
		}
	}

	results, total, err := s.store.GetBlockedTasks(ctx, p)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "getting blocked tasks: %v", err)
	}

	resp := &pb.GetBlockedTasksResponse{
		TotalCount: int32(total),
	}
	for _, r := range results {
		bt := &pb.BlockedTask{
			Task: taskToProto(r.Task),
		}
		for _, b := range r.Blockers {
			bt.BlockedBy = append(bt.BlockedBy, &pb.BlockerInfo{
				TaskId: b.TaskID.String(),
				Name:   b.Name,
				Phase:  phaseToProto(b.Phase),
				Stage:  stageToProto(b.Stage),
			})
		}
		resp.Items = append(resp.Items, bt)
	}

	nextOffset := offset + len(results)
	if nextOffset < total {
		resp.HasMore = true
		resp.NextPageToken = encodeOffsetCursor(nextOffset)
	}

	return resp, nil
}

func (s *FarmTableService) GetDependencyTree(ctx context.Context, req *pb.GetDependencyTreeRequest) (*pb.GetDependencyTreeResponse, error) {
	taskID, err := uuid.Parse(req.GetTaskId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
	}

	maxDepth := int(req.GetMaxDepth())
	if maxDepth <= 0 {
		maxDepth = 5
	}
	if maxDepth > 20 {
		maxDepth = 20
	}

	dir := req.GetDirection()
	if dir == pb.DependencyDirection_DEPENDENCY_DIRECTION_UNSPECIFIED {
		dir = pb.DependencyDirection_DEPENDENCY_DIRECTION_BOTH
	}

	visited := make(map[uuid.UUID]bool)
	root, err := s.buildDependencyNode(ctx, taskID, dir, maxDepth, 0, visited)
	if err != nil {
		return nil, err
	}

	return &pb.GetDependencyTreeResponse{Root: root}, nil
}

func (s *FarmTableService) buildDependencyNode(ctx context.Context, taskID uuid.UUID, dir pb.DependencyDirection, maxDepth, depth int, visited map[uuid.UUID]bool) (*pb.DependencyNode, error) {
	if visited[taskID] || depth > maxDepth {
		return nil, nil
	}
	visited[taskID] = true

	t, err := s.store.GetTask(ctx, taskID)
	if err != nil {
		return nil, storeErr(err, "task")
	}

	node := &pb.DependencyNode{
		Task: taskToProto(t),
	}

	if dir == pb.DependencyDirection_DEPENDENCY_DIRECTION_DOWN || dir == pb.DependencyDirection_DEPENDENCY_DIRECTION_BOTH {
		for _, rel := range t.Edges.SourceRelationships {
			if rel.Type == "blocks" {
				child, err := s.buildDependencyNode(ctx, rel.TargetTaskID, dir, maxDepth, depth+1, visited)
				if err != nil {
					return nil, err
				}
				if child != nil {
					node.Blocks = append(node.Blocks, child)
				}
			}
		}
		for _, rel := range t.Edges.TargetRelationships {
			if rel.Type == "blocked_by" {
				child, err := s.buildDependencyNode(ctx, rel.SourceTaskID, dir, maxDepth, depth+1, visited)
				if err != nil {
					return nil, err
				}
				if child != nil {
					node.Blocks = append(node.Blocks, child)
				}
			}
		}
	}

	if dir == pb.DependencyDirection_DEPENDENCY_DIRECTION_UP || dir == pb.DependencyDirection_DEPENDENCY_DIRECTION_BOTH {
		for _, rel := range t.Edges.SourceRelationships {
			if rel.Type == "blocked_by" {
				parent, err := s.buildDependencyNode(ctx, rel.TargetTaskID, dir, maxDepth, depth+1, visited)
				if err != nil {
					return nil, err
				}
				if parent != nil {
					node.BlockedBy = append(node.BlockedBy, parent)
				}
			}
		}
		for _, rel := range t.Edges.TargetRelationships {
			if rel.Type == "blocks" {
				parent, err := s.buildDependencyNode(ctx, rel.SourceTaskID, dir, maxDepth, depth+1, visited)
				if err != nil {
					return nil, err
				}
				if parent != nil {
					node.BlockedBy = append(node.BlockedBy, parent)
				}
			}
		}
	}

	return node, nil
}

func (s *FarmTableService) GetCriticalPath(ctx context.Context, req *pb.GetCriticalPathRequest) (*pb.GetCriticalPathResponse, error) {
	collID, err := uuid.Parse(req.GetCollectionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
	}

	var startTasks []*struct {
		id    uuid.UUID
		title string
		stage string
	}

	if req.RootTaskId != nil {
		rootID, err := uuid.Parse(*req.RootTaskId)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid root_task_id: %v", err)
		}
		t, err := s.store.GetTask(ctx, rootID)
		if err != nil {
			return nil, storeErr(err, "task")
		}
		startTasks = append(startTasks, &struct {
			id    uuid.UUID
			title string
			stage string
		}{t.ID, t.Title, string(t.Stage)})
	} else {
		const maxGraphTasks = 500
		var tasks []*ent.Task
		for _, ph := range []task.Phase{task.PhaseOpen, task.PhaseInProgress, task.PhaseOnHold} {
			p := ph
			remaining := maxGraphTasks - len(tasks)
			if remaining <= 0 {
				break
			}
			batch, _, err := s.store.ListTasks(ctx, store.ListTasksParams{
				CollectionID: &collID,
				Phase:        &p,
				Limit:        remaining,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "listing tasks: %v", err)
			}
			tasks = append(tasks, batch...)
		}
		if len(tasks) >= maxGraphTasks {
			return nil, status.Errorf(codes.ResourceExhausted, "collection has too many open tasks for critical path analysis (limit %d)", maxGraphTasks)
		}

		for _, t := range tasks {
			startTasks = append(startTasks, &struct {
				id    uuid.UUID
				title string
				stage string
			}{t.ID, t.Title, string(t.Stage)})
		}
	}

	var longestPath []criticalPathEntry
	for _, st := range startTasks {
		onStack := make(map[uuid.UUID]bool)
		path := s.findLongestBlocksChain(ctx, st.id, onStack, 0)
		if len(path) > len(longestPath) {
			longestPath = path
		}
	}

	resp := &pb.GetCriticalPathResponse{
		TotalDepth: int32(len(longestPath)),
	}
	var maxFanOut int32
	var bottleneck *pb.Bottleneck
	for i, entry := range longestPath {
		resp.Path = append(resp.Path, &pb.CriticalPathNode{
			Id:    entry.id.String(),
			Name:  entry.title,
			Stage: stageToProto(task.Stage(entry.stage)),
			Depth: int32(i),
		})
		if entry.fanOut > maxFanOut {
			maxFanOut = entry.fanOut
			bottleneck = &pb.Bottleneck{
				Id:     entry.id.String(),
				Name:   entry.title,
				FanOut: entry.fanOut,
				Reason: fmt.Sprintf("blocks %d tasks directly", entry.fanOut),
			}
		}
	}
	resp.Bottleneck = bottleneck

	return resp, nil
}

type criticalPathEntry struct {
	id     uuid.UUID
	title  string
	stage  string
	fanOut int32
}

const maxGraphDepth = 50

func (s *FarmTableService) findLongestBlocksChain(ctx context.Context, taskID uuid.UUID, onStack map[uuid.UUID]bool, depth int) []criticalPathEntry {
	if onStack[taskID] || depth >= maxGraphDepth {
		return nil
	}
	onStack[taskID] = true
	defer func() { onStack[taskID] = false }()

	t, err := s.store.GetTask(ctx, taskID)
	if err != nil {
		return nil
	}

	var blocksTargets []uuid.UUID
	for _, rel := range t.Edges.SourceRelationships {
		if rel.Type == "blocks" {
			blocksTargets = append(blocksTargets, rel.TargetTaskID)
		}
	}
	for _, rel := range t.Edges.TargetRelationships {
		if rel.Type == "blocked_by" {
			blocksTargets = append(blocksTargets, rel.SourceTaskID)
		}
	}

	entry := criticalPathEntry{
		id:     t.ID,
		title:  t.Title,
		stage:  string(t.Stage),
		fanOut: int32(len(blocksTargets)),
	}

	if len(blocksTargets) == 0 {
		return []criticalPathEntry{entry}
	}

	var longest []criticalPathEntry
	for _, targetID := range blocksTargets {
		child := s.findLongestBlocksChain(ctx, targetID, onStack, depth+1)
		if len(child) > len(longest) {
			longest = child
		}
	}

	return append([]criticalPathEntry{entry}, longest...)
}

func (s *FarmTableService) GetBottlenecks(ctx context.Context, req *pb.GetBottlenecksRequest) (*pb.GetBottlenecksResponse, error) {
	collID, err := uuid.Parse(req.GetCollectionId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
	}

	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 10
	}

	const maxGraphTasks = 500
	var allTasks []*struct {
		id    uuid.UUID
		title string
		stage string
		rels  []uuid.UUID
	}

	totalLoaded := 0
	for _, ph := range []task.Phase{task.PhaseOpen, task.PhaseInProgress, task.PhaseOnHold} {
		p := ph
		remaining := maxGraphTasks - totalLoaded
		if remaining <= 0 {
			break
		}
		tasks, _, err := s.store.ListTasks(ctx, store.ListTasksParams{
			CollectionID: &collID,
			Phase:        &p,
			Limit:        remaining,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "listing tasks: %v", err)
		}
		totalLoaded += len(tasks)
		for _, t := range tasks {
			var blocksTargets []uuid.UUID
			for _, rel := range t.Edges.SourceRelationships {
				if rel.Type == "blocks" {
					blocksTargets = append(blocksTargets, rel.TargetTaskID)
				}
			}
			if len(blocksTargets) > 0 {
				allTasks = append(allTasks, &struct {
					id    uuid.UUID
					title string
					stage string
					rels  []uuid.UUID
				}{t.ID, t.Title, string(t.Stage), blocksTargets})
			}
		}
	}
	if totalLoaded >= maxGraphTasks {
		return nil, status.Errorf(codes.ResourceExhausted, "collection has too many open tasks for bottleneck analysis (limit %d)", maxGraphTasks)
	}

	type bottleneckInfo struct {
		id              uuid.UUID
		title           string
		stage           string
		directCount     int
		downstreamCount int
	}

	var bottlenecks []bottleneckInfo
	for _, t := range allTasks {
		visited := make(map[uuid.UUID]bool)
		visited[t.id] = true
		downstream := s.countDownstream(ctx, t.id, visited, 0)
		bottlenecks = append(bottlenecks, bottleneckInfo{
			id:              t.id,
			title:           t.title,
			stage:           t.stage,
			directCount:     len(t.rels),
			downstreamCount: downstream,
		})
	}

	// Sort by downstream count descending
	for i := 0; i < len(bottlenecks); i++ {
		for j := i + 1; j < len(bottlenecks); j++ {
			if bottlenecks[j].downstreamCount > bottlenecks[i].downstreamCount {
				bottlenecks[i], bottlenecks[j] = bottlenecks[j], bottlenecks[i]
			}
		}
	}

	if limit < len(bottlenecks) {
		bottlenecks = bottlenecks[:limit]
	}

	resp := &pb.GetBottlenecksResponse{}
	for _, b := range bottlenecks {
		resp.Items = append(resp.Items, &pb.BottleneckTask{
			Id:               b.id.String(),
			Name:             b.title,
			Stage:            stageToProto(task.Stage(b.stage)),
			DownstreamCount:  int32(b.downstreamCount),
			DirectDependents: int32(b.directCount),
		})
	}

	return resp, nil
}

func (s *FarmTableService) countDownstream(ctx context.Context, taskID uuid.UUID, visited map[uuid.UUID]bool, depth int) int {
	if depth >= maxGraphDepth {
		return 0
	}

	t, err := s.store.GetTask(ctx, taskID)
	if err != nil {
		return 0
	}

	count := 0
	for _, rel := range t.Edges.SourceRelationships {
		if rel.Type == "blocks" && !visited[rel.TargetTaskID] {
			visited[rel.TargetTaskID] = true
			count += 1 + s.countDownstream(ctx, rel.TargetTaskID, visited, depth+1)
		}
	}
	for _, rel := range t.Edges.TargetRelationships {
		if rel.Type == "blocked_by" && !visited[rel.SourceTaskID] {
			visited[rel.SourceTaskID] = true
			count += 1 + s.countDownstream(ctx, rel.SourceTaskID, visited, depth+1)
		}
	}
	return count
}

// ── Helpers ──

func platformFromProto(p pb.Platform) collection.Platform {
	switch p {
	case pb.Platform_PLATFORM_FARMTABLE:
		return collection.PlatformFarmtable
	case pb.Platform_PLATFORM_GITHUB:
		return collection.PlatformGithub
	case pb.Platform_PLATFORM_LINEAR:
		return collection.PlatformLinear
	case pb.Platform_PLATFORM_JIRA:
		return collection.PlatformJira
	case pb.Platform_PLATFORM_ASANA:
		return collection.PlatformAsana
	case pb.Platform_PLATFORM_BEADS:
		return collection.PlatformBeads
	default:
		return collection.PlatformFarmtable
	}
}

func storeErr(err error, entity string) error {
	if errors.Is(err, store.ErrNotFound) {
		return status.Errorf(codes.NotFound, "%s not found", entity)
	}
	if errors.Is(err, store.ErrConflict) {
		return status.Errorf(codes.Aborted, "%s version conflict (CAS mismatch)", entity)
	}
	if errors.Is(err, store.ErrAlreadyClaimed) {
		return status.Errorf(codes.FailedPrecondition, "%s already claimed", entity)
	}
	if errors.Is(err, store.ErrAlreadyClosed) {
		return status.Errorf(codes.FailedPrecondition, "%s already closed", entity)
	}
	if errors.Is(err, store.ErrInvalidArgument) {
		return status.Errorf(codes.InvalidArgument, "%v", err)
	}
	log.Printf("internal error for %s: %v", entity, err)
	return status.Errorf(codes.Internal, "internal error for %s", entity)
}

func encodePageToken(offset int) string {
	return base64.StdEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

func decodePageToken(token string) (int, error) {
	if token == "" {
		return 0, nil
	}
	b, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return 0, status.Errorf(codes.InvalidArgument, "invalid page_token")
	}
	offset, err := strconv.Atoi(string(b))
	if err != nil {
		return 0, status.Errorf(codes.InvalidArgument, "invalid page_token")
	}
	if offset < 0 {
		return 0, status.Errorf(codes.InvalidArgument, "invalid page_token")
	}
	return offset, nil
}

type pageCursor struct {
	LastID        string `json:"last_id"`
	LastSortValue string `json:"last_sort_value"`
}

func encodeCursor(lastID, lastSortValue string) string {
	c := pageCursor{LastID: lastID, LastSortValue: lastSortValue}
	b, _ := json.Marshal(c)
	return base64.StdEncoding.EncodeToString(b)
}

func decodeCursor(token string) (pageCursor, error) {
	if token == "" {
		return pageCursor{}, nil
	}
	b, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return pageCursor{}, status.Errorf(codes.InvalidArgument, "invalid page_token")
	}
	var c pageCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return pageCursor{}, status.Errorf(codes.InvalidArgument, "invalid page_token")
	}
	if c.LastID == "" {
		return pageCursor{}, status.Errorf(codes.InvalidArgument, "invalid page_token: missing last_id")
	}
	return c, nil
}

func encodeOffsetCursor(offset int) string {
	return encodeCursor(strconv.Itoa(offset), "")
}

func decodeOffsetCursor(token string) (int, error) {
	if token == "" {
		return 0, nil
	}
	c, err := decodeCursor(token)
	if err != nil {
		return 0, err
	}
	offset, err := strconv.Atoi(c.LastID)
	if err != nil || offset < 0 {
		return 0, status.Errorf(codes.InvalidArgument, "invalid page_token")
	}
	return offset, nil
}

func taskSortValue(t *ent.Task, sortField string) string {
	switch sortField {
	case "updated":
		return t.UpdatedAt.UTC().Format(time.RFC3339Nano)
	case "priority":
		if t.Priority != nil {
			return string(*t.Priority)
		}
		return ""
	case "due_date":
		if t.DueDate != nil {
			return t.DueDate.UTC().Format(time.RFC3339Nano)
		}
		return ""
	default:
		return t.CreatedAt.UTC().Format(time.RFC3339Nano)
	}
}
