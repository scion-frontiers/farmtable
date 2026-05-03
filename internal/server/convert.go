package server

import (
	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/collection"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Phase/Stage enum conversions

func phaseToProto(p task.Phase) pb.TaskPhase {
	switch p {
	case task.PhaseOpen:
		return pb.TaskPhase_TASK_PHASE_OPEN
	case task.PhaseInProgress:
		return pb.TaskPhase_TASK_PHASE_IN_PROGRESS
	case task.PhaseOnHold:
		return pb.TaskPhase_TASK_PHASE_ON_HOLD
	case task.PhaseClosed:
		return pb.TaskPhase_TASK_PHASE_CLOSED
	default:
		return pb.TaskPhase_TASK_PHASE_UNSPECIFIED
	}
}

func phaseFromProto(p pb.TaskPhase) task.Phase {
	switch p {
	case pb.TaskPhase_TASK_PHASE_OPEN:
		return task.PhaseOpen
	case pb.TaskPhase_TASK_PHASE_IN_PROGRESS:
		return task.PhaseInProgress
	case pb.TaskPhase_TASK_PHASE_ON_HOLD:
		return task.PhaseOnHold
	case pb.TaskPhase_TASK_PHASE_CLOSED:
		return task.PhaseClosed
	default:
		return task.PhaseOpen
	}
}

func stageToProto(s task.Stage) pb.TaskStage {
	switch s {
	case task.StageTriage:
		return pb.TaskStage_TASK_STAGE_TRIAGE
	case task.StageBacklog:
		return pb.TaskStage_TASK_STAGE_BACKLOG
	case task.StageReady:
		return pb.TaskStage_TASK_STAGE_READY
	case task.StageWorking:
		return pb.TaskStage_TASK_STAGE_WORKING
	case task.StageInReview:
		return pb.TaskStage_TASK_STAGE_IN_REVIEW
	case task.StageInQa:
		return pb.TaskStage_TASK_STAGE_IN_QA
	case task.StageDeploying:
		return pb.TaskStage_TASK_STAGE_DEPLOYING
	case task.StageBlocked:
		return pb.TaskStage_TASK_STAGE_BLOCKED
	case task.StageWaitingForInput:
		return pb.TaskStage_TASK_STAGE_WAITING_FOR_INPUT
	case task.StageDeferred:
		return pb.TaskStage_TASK_STAGE_DEFERRED
	case task.StageScheduled:
		return pb.TaskStage_TASK_STAGE_SCHEDULED
	case task.StageCompleted:
		return pb.TaskStage_TASK_STAGE_COMPLETED
	case task.StageWontFix:
		return pb.TaskStage_TASK_STAGE_WONT_FIX
	case task.StageDuplicate:
		return pb.TaskStage_TASK_STAGE_DUPLICATE
	case task.StageCancelled:
		return pb.TaskStage_TASK_STAGE_CANCELLED
	default:
		return pb.TaskStage_TASK_STAGE_UNSPECIFIED
	}
}

func stageFromProto(s pb.TaskStage) task.Stage {
	switch s {
	case pb.TaskStage_TASK_STAGE_TRIAGE:
		return task.StageTriage
	case pb.TaskStage_TASK_STAGE_BACKLOG:
		return task.StageBacklog
	case pb.TaskStage_TASK_STAGE_READY:
		return task.StageReady
	case pb.TaskStage_TASK_STAGE_WORKING:
		return task.StageWorking
	case pb.TaskStage_TASK_STAGE_IN_REVIEW:
		return task.StageInReview
	case pb.TaskStage_TASK_STAGE_IN_QA:
		return task.StageInQa
	case pb.TaskStage_TASK_STAGE_DEPLOYING:
		return task.StageDeploying
	case pb.TaskStage_TASK_STAGE_BLOCKED:
		return task.StageBlocked
	case pb.TaskStage_TASK_STAGE_WAITING_FOR_INPUT:
		return task.StageWaitingForInput
	case pb.TaskStage_TASK_STAGE_DEFERRED:
		return task.StageDeferred
	case pb.TaskStage_TASK_STAGE_SCHEDULED:
		return task.StageScheduled
	case pb.TaskStage_TASK_STAGE_COMPLETED:
		return task.StageCompleted
	case pb.TaskStage_TASK_STAGE_WONT_FIX:
		return task.StageWontFix
	case pb.TaskStage_TASK_STAGE_DUPLICATE:
		return task.StageDuplicate
	case pb.TaskStage_TASK_STAGE_CANCELLED:
		return task.StageCancelled
	default:
		return task.StageTriage
	}
}

func phaseForStage(s task.Stage) task.Phase {
	switch s {
	case task.StageTriage, task.StageBacklog, task.StageReady:
		return task.PhaseOpen
	case task.StageWorking, task.StageInReview, task.StageInQa, task.StageDeploying:
		return task.PhaseInProgress
	case task.StageBlocked, task.StageWaitingForInput, task.StageDeferred, task.StageScheduled:
		return task.PhaseOnHold
	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
		return task.PhaseClosed
	default:
		return task.PhaseOpen
	}
}

func priorityToProto(p task.Priority) pb.TaskPriority {
	switch p {
	case task.PriorityUrgent:
		return pb.TaskPriority_TASK_PRIORITY_URGENT
	case task.PriorityHigh:
		return pb.TaskPriority_TASK_PRIORITY_HIGH
	case task.PriorityNormal:
		return pb.TaskPriority_TASK_PRIORITY_NORMAL
	case task.PriorityLow:
		return pb.TaskPriority_TASK_PRIORITY_LOW
	default:
		return pb.TaskPriority_TASK_PRIORITY_UNSPECIFIED
	}
}

func priorityFromProto(p pb.TaskPriority) task.Priority {
	switch p {
	case pb.TaskPriority_TASK_PRIORITY_URGENT:
		return task.PriorityUrgent
	case pb.TaskPriority_TASK_PRIORITY_HIGH:
		return task.PriorityHigh
	case pb.TaskPriority_TASK_PRIORITY_NORMAL:
		return task.PriorityNormal
	case pb.TaskPriority_TASK_PRIORITY_LOW:
		return task.PriorityLow
	default:
		return task.PriorityNormal
	}
}

func platformToProto(p collection.Platform) pb.Platform {
	switch p {
	case collection.PlatformFarmtable:
		return pb.Platform_PLATFORM_FARMTABLE
	case collection.PlatformGithub:
		return pb.Platform_PLATFORM_GITHUB
	case collection.PlatformLinear:
		return pb.Platform_PLATFORM_LINEAR
	case collection.PlatformJira:
		return pb.Platform_PLATFORM_JIRA
	case collection.PlatformAsana:
		return pb.Platform_PLATFORM_ASANA
	case collection.PlatformBeads:
		return pb.Platform_PLATFORM_BEADS
	default:
		return pb.Platform_PLATFORM_UNSPECIFIED
	}
}

// Entity → Proto conversions

func taskToProto(t *ent.Task) *pb.Task {
	pt := &pb.Task{
		Id:           t.ID.String(),
		Name:         t.Title,
		Phase:        phaseToProto(t.Phase),
		Stage:        stageToProto(t.Stage),
		CollectionId: t.CollectionID.String(),
		Platform:     pb.Platform_PLATFORM_FARMTABLE,
		CreatedAt:    timestamppb.New(t.CreatedAt),
		UpdatedAt:    timestamppb.New(t.UpdatedAt),
		Version:      t.Version,
	}

	if t.Description != "" {
		pt.Description = &t.Description
	}
	if t.AcceptanceCriteria != nil {
		pt.AcceptanceCriteria = t.AcceptanceCriteria
	}
	if t.NativeLabel != "" {
		pt.NativeStatus = &t.NativeLabel
	}
	if t.Type != "" {
		pt.Type = &t.Type
	}
	if t.Priority != nil {
		p := priorityToProto(*t.Priority)
		pt.Priority = &p
	}
	if t.AssigneeID != nil {
		pt.Assignees = []*pb.User{{Id: t.AssigneeID.String()}}
	}
	if t.ParentTaskID != nil {
		s := t.ParentTaskID.String()
		pt.ParentTaskId = &s
	}
	if t.StartDate != nil {
		pt.StartDate = timestamppb.New(*t.StartDate)
	}
	if t.DueDate != nil {
		pt.DueDate = timestamppb.New(*t.DueDate)
	}
	if t.ClosedAt != nil {
		pt.ClosedAt = timestamppb.New(*t.ClosedAt)
	}
	if t.RemoteData != nil {
		pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)
	}

	return pt
}

func collectionToProto(c *ent.Collection) *pb.Collection {
	pc := &pb.Collection{
		Id:        c.ID.String(),
		Name:      c.Name,
		Platform:  platformToProto(c.Platform),
		CreatedAt: timestamppb.New(c.CreatedAt),
		UpdatedAt: timestamppb.New(c.UpdatedAt),
	}
	if c.Description != "" {
		pc.Description = &c.Description
	}
	return pc
}

func commentToProto(c *ent.Comment) *pb.Comment {
	return &pb.Comment{
		Id:        c.ID.String(),
		TaskId:    c.TaskID.String(),
		Author:    &pb.User{Id: c.AuthorID.String()},
		Body:      c.Body,
		CreatedAt: timestamppb.New(c.CreatedAt),
		UpdatedAt: timestamppb.New(c.UpdatedAt),
	}
}

func changeToProto(c *ent.Change) *pb.Change {
	ch := &pb.Change{
		Id:        c.ID.String(),
		TaskId:    c.TaskID.String(),
		Field:     c.FieldName,
		ChangedBy: &pb.User{Id: c.AuthorID.String()},
		ChangedAt: timestamppb.New(c.CreatedAt),
	}
	if c.OldValue != "" {
		ch.OldValue, _ = structpb.NewValue(c.OldValue)
	}
	if c.NewValue != "" {
		ch.NewValue, _ = structpb.NewValue(c.NewValue)
	}
	return ch
}
