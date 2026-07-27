package convert

import (
	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

func PhaseFromProto(p pb.TaskPhase) task.Phase {
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

func StageFromProto(s pb.TaskStage) task.Stage {
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

func PriorityFromProto(p pb.TaskPriority) task.Priority {
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
