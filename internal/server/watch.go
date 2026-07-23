package server

import (
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/convert"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/streaming"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (s *FarmTableService) WatchTasks(req *pb.WatchTasksRequest, stream grpc.ServerStreamingServer[pb.TaskEvent]) error {
	if s.eventBus == nil {
		return status.Error(codes.Unimplemented, "streaming not available in pass-through mode")
	}
	// WatchTasks creates server-side state (subscriptions) so it requires
	// an authenticated identity, not just a valid token.
	if _, err := RequireIdentity(stream.Context()); err != nil {
		return err
	}
	if err := validateWatchTasksRequest(req); err != nil {
		return err
	}

	// Guard: WatchTasks is not supported for external platform collections.
	if req.CollectionId != nil {
		collID, err := uuid.Parse(*req.CollectionId)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
		}
		coll, err := s.store.GetCollection(stream.Context(), collID)
		if err != nil {
			return storeErr(err, "collection")
		}
		if coll.Platform != collection.PlatformFarmtable {
			return status.Errorf(codes.Unimplemented,
				"WatchTasks is not supported for external platform %q collections; use polling instead",
				coll.Platform)
		}
	}

	filter := buildFilter(req)

	sub := s.eventBus.Subscribe(filter)
	defer s.eventBus.Unsubscribe(sub.ID)

	var seq int64

	if req.GetIncludeInitial() {
		var err error
		seq, err = s.sendInitialSnapshot(req, filter, stream, seq)
		if err != nil {
			return err
		}
		seq++
		if err := stream.Send(&pb.TaskEvent{
			EventType: pb.TaskEventType_TASK_EVENT_TYPE_SNAPSHOT_COMPLETE,
			Timestamp: timestamppb.Now(),
			Sequence:  seq,
		}); err != nil {
			return err
		}
	}

	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case event, ok := <-sub.Events:
			if !ok {
				return nil
			}
			seq++
			event.Sequence = seq
			if err := stream.Send(event); err != nil {
				return err
			}
		case <-heartbeat.C:
			seq++
			if err := stream.Send(&pb.TaskEvent{
				EventType: pb.TaskEventType_TASK_EVENT_TYPE_HEARTBEAT,
				Timestamp: timestamppb.Now(),
				Sequence:  seq,
			}); err != nil {
				return err
			}
		case <-stream.Context().Done():
			return nil
		}
	}
}

func validateWatchTasksRequest(req *pb.WatchTasksRequest) error {
	if req.CollectionId != nil {
		if _, err := uuid.Parse(*req.CollectionId); err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid collection_id: %v", err)
		}
	}
	if req.Phase != nil && *req.Phase != pb.TaskPhase_TASK_PHASE_UNSPECIFIED {
		if err := validateDefinedEnum("phase", int32(*req.Phase), pb.TaskPhase_name); err != nil {
			return err
		}
	}
	for _, stage := range req.GetStages() {
		if stage == pb.TaskStage_TASK_STAGE_UNSPECIFIED {
			continue
		}
		if err := validateDefinedEnum("stages", int32(stage), pb.TaskStage_name); err != nil {
			return err
		}
	}
	if req.Assignee != nil && *req.Assignee != "none" {
		if _, err := uuid.Parse(*req.Assignee); err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid assignee: %v", err)
		}
	}
	if req.TaskId != nil {
		if _, err := uuid.Parse(*req.TaskId); err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid task_id: %v", err)
		}
	}
	if req.Priority != nil && *req.Priority != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
		if err := validateDefinedEnum("priority", int32(*req.Priority), pb.TaskPriority_name); err != nil {
			return err
		}
	}
	return nil
}

func (s *FarmTableService) sendInitialSnapshot(req *pb.WatchTasksRequest, filter streaming.SubscriptionFilter, stream grpc.ServerStreamingServer[pb.TaskEvent], seq int64) (int64, error) {
	if filter.TaskID != nil {
		resp, err := s.GetTask(stream.Context(), &pb.GetTaskRequest{Id: filter.TaskID.String()})
		if err != nil {
			st, ok := status.FromError(err)
			if ok && st.Code() == codes.NotFound {
				return seq, nil
			}
			return seq, err
		}
		seq++
		return seq, stream.Send(&pb.TaskEvent{
			EventType: pb.TaskEventType_TASK_EVENT_TYPE_INITIAL,
			Task:      resp.GetTask(),
			Timestamp: timestamppb.Now(),
			Sequence:  seq,
		})
	}

	listReq := filterToListRequest(req)
	pageToken := ""
	for {
		listReq.PageToken = pageToken
		resp, err := s.ListTasks(stream.Context(), listReq)
		if err != nil {
			return seq, err
		}
		for _, t := range resp.GetItems() {
			seq++
			if err := stream.Send(&pb.TaskEvent{
				EventType: pb.TaskEventType_TASK_EVENT_TYPE_INITIAL,
				Task:      t,
				Timestamp: timestamppb.Now(),
				Sequence:  seq,
			}); err != nil {
				return seq, err
			}
		}
		if !resp.GetHasMore() {
			break
		}
		pageToken = resp.GetNextPageToken()
	}
	return seq, nil
}

func buildFilter(req *pb.WatchTasksRequest) streaming.SubscriptionFilter {
	var f streaming.SubscriptionFilter

	if req.CollectionId != nil {
		id, err := uuid.Parse(*req.CollectionId)
		if err == nil {
			f.CollectionID = &id
		}
	}
	if req.Phase != nil && *req.Phase != pb.TaskPhase_TASK_PHASE_UNSPECIFIED {
		ph := convert.PhaseFromProto(*req.Phase)
		f.Phase = &ph
	}
	for _, s := range req.GetStages() {
		if s != pb.TaskStage_TASK_STAGE_UNSPECIFIED {
			f.Stages = append(f.Stages, convert.StageFromProto(s))
		}
	}
	if req.Assignee != nil {
		if *req.Assignee == "none" {
			f.Unassigned = true
		} else {
			id, err := uuid.Parse(*req.Assignee)
			if err == nil {
				f.AssigneeID = &id
			}
		}
	}
	if len(req.GetLabels()) > 0 {
		f.Labels = req.GetLabels()
	}
	if req.TaskId != nil {
		id, err := uuid.Parse(*req.TaskId)
		if err == nil {
			f.TaskID = &id
		}
	}
	if req.Priority != nil && *req.Priority != pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED {
		pr := convert.PriorityFromProto(*req.Priority)
		f.Priority = &pr
	}

	return f
}

func filterToListRequest(req *pb.WatchTasksRequest) *pb.ListTasksRequest {
	lr := &pb.ListTasksRequest{
		PageSize: 200,
	}
	if req.CollectionId != nil {
		lr.CollectionId = req.CollectionId
	}
	if req.Phase != nil {
		lr.Phase = req.Phase
	}
	if len(req.GetStages()) > 0 {
		lr.Stages = req.GetStages()
	}
	if req.Assignee != nil {
		lr.Assignee = req.Assignee
	}
	if len(req.GetLabels()) > 0 {
		lr.Labels = req.GetLabels()
	}
	if req.Priority != nil {
		lr.Priority = req.Priority
	}
	return lr
}
