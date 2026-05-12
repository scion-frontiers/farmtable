package streaming

import (
	"log"
	"sync"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string]*Subscriber
}

type Subscriber struct {
	ID     string
	Filter SubscriptionFilter
	Events chan *pb.TaskEvent
	Done   chan struct{}
}

type SubscriptionFilter struct {
	CollectionID *uuid.UUID
	Phase        *task.Phase
	Stages       []task.Stage
	AssigneeID   *uuid.UUID
	Unassigned   bool
	Labels       []string
	TaskID       *uuid.UUID
	Priority     *task.Priority
}

func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string]*Subscriber),
	}
}

func (eb *EventBus) Subscribe(filter SubscriptionFilter) *Subscriber {
	sub := &Subscriber{
		ID:     uuid.New().String(),
		Filter: filter,
		Events: make(chan *pb.TaskEvent, 256),
		Done:   make(chan struct{}),
	}

	eb.mu.Lock()
	eb.subscribers[sub.ID] = sub
	eb.mu.Unlock()

	return sub
}

func (eb *EventBus) Unsubscribe(id string) {
	eb.mu.Lock()
	sub, ok := eb.subscribers[id]
	if ok {
		delete(eb.subscribers, id)
	}
	eb.mu.Unlock()

	if ok {
		close(sub.Done)
		close(sub.Events)
	}
}

func (eb *EventBus) Publish(event *pb.TaskEvent) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	for _, sub := range eb.subscribers {
		if !matchesFilter(sub.Filter, event) {
			continue
		}
		select {
		case sub.Events <- event:
		default:
			log.Printf("WARNING: dropping event for subscriber %s (channel full)", sub.ID)
		}
	}
}

func matchesFilter(f SubscriptionFilter, event *pb.TaskEvent) bool {
	t := event.GetTask()
	if t == nil {
		return true
	}

	if f.TaskID != nil {
		taskID, err := uuid.Parse(t.GetId())
		if err != nil {
			return false
		}
		return taskID == *f.TaskID
	}

	if f.CollectionID != nil {
		collID, err := uuid.Parse(t.GetCollectionId())
		if err != nil {
			return false
		}
		if collID != *f.CollectionID {
			return false
		}
	}

	if f.Phase != nil {
		taskPhase := phaseFromProto(t.GetPhase())
		if taskPhase != *f.Phase {
			return false
		}
	}

	if len(f.Stages) > 0 {
		taskStage := stageFromProto(t.GetStage())
		matched := false
		for _, s := range f.Stages {
			if taskStage == s {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	if f.AssigneeID != nil {
		assignees := t.GetAssignees()
		if len(assignees) == 0 {
			return false
		}
		matched := false
		for _, a := range assignees {
			aid, err := uuid.Parse(a.GetId())
			if err != nil {
				continue
			}
			if aid == *f.AssigneeID {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	if f.Unassigned {
		if len(t.GetAssignees()) > 0 {
			return false
		}
	}

	if len(f.Labels) > 0 {
		taskLabels := make(map[string]bool, len(t.GetLabels()))
		for _, l := range t.GetLabels() {
			taskLabels[l] = true
		}
		for _, required := range f.Labels {
			if !taskLabels[required] {
				return false
			}
		}
	}

	if f.Priority != nil {
		if t.Priority == nil {
			return false
		}
		taskPriority := priorityFromProto(*t.Priority)
		if taskPriority != *f.Priority {
			return false
		}
	}

	return true
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
