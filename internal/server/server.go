package server

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type FarmTableService struct {
	pb.UnimplementedFarmTableServiceServer
	store store.Store
}

func NewFarmTableService(s store.Store) *FarmTableService {
	return &FarmTableService{store: s}
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

	offset := 0
	if req.GetPageToken() != "" {
		b, err := base64.StdEncoding.DecodeString(req.GetPageToken())
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page_token")
		}
		offset, err = strconv.Atoi(string(b))
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page_token")
		}
	}

	p := store.ListTasksParams{
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

	nextOffset := offset + len(tasks)
	if nextOffset < total {
		resp.HasMore = true
		resp.NextPageToken = base64.StdEncoding.EncodeToString(
			[]byte(strconv.Itoa(nextOffset)),
		)
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
	} else {
		existing, err := s.store.GetTask(ctx, id)
		if err != nil {
			return nil, storeErr(err, "task")
		}
		p.Version = existing.Version
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

	t, err := s.store.UpdateTask(ctx, id, p)
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

	// In a real system, assigneeID comes from auth context. Use a placeholder.
	assigneeID := uuid.New()

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

	t, err := s.store.CloseTask(ctx, id, stage, version)
	if err != nil {
		return nil, storeErr(err, "task")
	}
	return taskToProto(t), nil
}

func (s *FarmTableService) DeleteTask(ctx context.Context, req *pb.DeleteTaskRequest) (*pb.DeleteTaskResponse, error) {
	return nil, status.Error(codes.Unimplemented, "DeleteTask not implemented")
}

// ── Comments ──

func (s *FarmTableService) AddComment(ctx context.Context, req *pb.AddCommentRequest) (*pb.Comment, error) {
	taskID, err := uuid.Parse(req.GetTaskId())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
	}

	// Author comes from auth context in production.
	authorID := uuid.New()

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

	offset, err := decodePageToken(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	comments, total, err := s.store.ListComments(ctx, store.ListCommentsParams{
		TaskID: taskID,
		Limit:  pageSize,
		Offset: offset,
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
	nextOffset := offset + len(comments)
	if nextOffset < total {
		resp.HasMore = true
		resp.NextPageToken = encodePageToken(nextOffset)
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

	offset, err := decodePageToken(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	p := store.ListCollectionsParams{
		Limit:  pageSize,
		Offset: offset,
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
	nextOffset := offset + len(cols)
	if nextOffset < total {
		resp.HasMore = true
		resp.NextPageToken = encodePageToken(nextOffset)
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

	offset, err := decodePageToken(req.GetPageToken())
	if err != nil {
		return nil, err
	}

	changes, total, err := s.store.ListChanges(ctx, store.ListChangesParams{
		TaskID: taskID,
		Field:  req.GetField(),
		Limit:  pageSize,
		Offset: offset,
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
	nextOffset := offset + len(changes)
	if nextOffset < total {
		resp.HasMore = true
		resp.NextPageToken = encodePageToken(nextOffset)
	}
	return resp, nil
}

// ── Graph Queries (Phase 2D stubs) ──

func (s *FarmTableService) GetReadyTasks(ctx context.Context, req *pb.GetReadyTasksRequest) (*pb.GetReadyTasksResponse, error) {
	return nil, status.Error(codes.Unimplemented, "GetReadyTasks not implemented")
}

func (s *FarmTableService) GetBlockedTasks(ctx context.Context, req *pb.GetBlockedTasksRequest) (*pb.GetBlockedTasksResponse, error) {
	return nil, status.Error(codes.Unimplemented, "GetBlockedTasks not implemented")
}

func (s *FarmTableService) GetDependencyTree(ctx context.Context, req *pb.GetDependencyTreeRequest) (*pb.GetDependencyTreeResponse, error) {
	return nil, status.Error(codes.Unimplemented, "GetDependencyTree not implemented")
}

func (s *FarmTableService) GetCriticalPath(ctx context.Context, req *pb.GetCriticalPathRequest) (*pb.GetCriticalPathResponse, error) {
	return nil, status.Error(codes.Unimplemented, "GetCriticalPath not implemented")
}

func (s *FarmTableService) GetBottlenecks(ctx context.Context, req *pb.GetBottlenecksRequest) (*pb.GetBottlenecksResponse, error) {
	return nil, status.Error(codes.Unimplemented, "GetBottlenecks not implemented")
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
		return status.Errorf(codes.FailedPrecondition, "%s version conflict (CAS mismatch)", entity)
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
	return status.Errorf(codes.Internal, "%s: %v", entity, err)
}

func encodePageToken(offset int) string {
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%d", offset)))
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
	return offset, nil
}
