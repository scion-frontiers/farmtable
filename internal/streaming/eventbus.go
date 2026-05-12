package streaming

import (
	"log"
	"sync"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/convert"
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
		taskPhase := convert.PhaseFromProto(t.GetPhase())
		if taskPhase != *f.Phase {
			return false
		}
	}

	if len(f.Stages) > 0 {
		taskStage := convert.StageFromProto(t.GetStage())
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
		taskPriority := convert.PriorityFromProto(*t.Priority)
		if taskPriority != *f.Priority {
			return false
		}
	}

	return true
}

