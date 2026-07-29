package streaming_test

import (
	"sync"
	"testing"
	"time"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/streaming"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func makeEvent(eventType pb.TaskEventType, t *pb.Task) *pb.TaskEvent {
	return &pb.TaskEvent{
		EventType: eventType,
		Task:      t,
		Timestamp: timestamppb.Now(),
	}
}

func makeTask(opts ...func(*pb.Task)) *pb.Task {
	t := &pb.Task{
		Id:           uuid.New().String(),
		CollectionId: uuid.New().String(),
		Phase:        pb.TaskPhase_TASK_PHASE_OPEN,
		Stage:        pb.TaskStage_TASK_STAGE_TRIAGE,
	}
	for _, o := range opts {
		o(t)
	}
	return t
}

func withCollectionID(id string) func(*pb.Task) {
	return func(t *pb.Task) { t.CollectionId = id }
}

func withPhase(p pb.TaskPhase) func(*pb.Task) {
	return func(t *pb.Task) { t.Phase = p }
}

func withStage(s pb.TaskStage) func(*pb.Task) {
	return func(t *pb.Task) { t.Stage = s }
}

func withLabels(labels ...string) func(*pb.Task) {
	return func(t *pb.Task) { t.Labels = labels }
}

func withAssignees(ids ...string) func(*pb.Task) {
	return func(t *pb.Task) {
		for _, id := range ids {
			t.Assignees = append(t.Assignees, &pb.User{Id: id})
		}
	}
}

func withPriority(p pb.TaskPriority) func(*pb.Task) {
	return func(t *pb.Task) { t.Priority = &p }
}

func withID(id string) func(*pb.Task) {
	return func(t *pb.Task) { t.Id = id }
}

func recvTimeout(ch <-chan *pb.TaskEvent, timeout time.Duration) (*pb.TaskEvent, bool) {
	select {
	case e, ok := <-ch:
		return e, ok
	case <-time.After(timeout):
		return nil, false
	}
}

func TestEventBus_SubscribeAndPublish(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{})
	defer eb.Unsubscribe(sub.ID)

	event := makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask())
	eb.Publish(event)

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("expected event, got nothing")
	}
	if got.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_CREATED {
		t.Errorf("event type = %v, want CREATED", got.GetEventType())
	}
}

func TestEventBus_Unsubscribe(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{})

	eb.Unsubscribe(sub.ID)

	_, ok := <-sub.Events
	if ok {
		t.Error("expected channel to be closed after unsubscribe")
	}
}

func TestEventBus_FilterByCollectionID(t *testing.T) {
	eb := streaming.NewEventBus()
	targetColl := uuid.New()
	sub := eb.Subscribe(streaming.SubscriptionFilter{CollectionID: &targetColl})
	defer eb.Unsubscribe(sub.ID)

	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withCollectionID(targetColl.String()))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withCollectionID(uuid.New().String()))))

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("expected matching event")
	}
	if got.GetTask().GetCollectionId() != targetColl.String() {
		t.Errorf("collection_id = %q, want %q", got.GetTask().GetCollectionId(), targetColl.String())
	}

	_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
	if ok {
		t.Error("should not receive non-matching event")
	}
}

func TestEventBus_FilterByPhase(t *testing.T) {
	eb := streaming.NewEventBus()
	phase := task.PhaseInProgress
	sub := eb.Subscribe(streaming.SubscriptionFilter{Phase: &phase})
	defer eb.Unsubscribe(sub.ID)

	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withPhase(pb.TaskPhase_TASK_PHASE_IN_PROGRESS))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withPhase(pb.TaskPhase_TASK_PHASE_OPEN))))

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("expected matching event")
	}
	if got.GetTask().GetPhase() != pb.TaskPhase_TASK_PHASE_IN_PROGRESS {
		t.Errorf("phase = %v, want IN_PROGRESS", got.GetTask().GetPhase())
	}

	_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
	if ok {
		t.Error("should not receive non-matching event")
	}
}

func TestEventBus_FilterByStages(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{
		Stages: []task.Stage{task.StageWorking, task.StageInReview},
	})
	defer eb.Unsubscribe(sub.ID)

	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withStage(pb.TaskStage_TASK_STAGE_WORKING))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withStage(pb.TaskStage_TASK_STAGE_IN_REVIEW))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withStage(pb.TaskStage_TASK_STAGE_TRIAGE))))

	for i := 0; i < 2; i++ {
		got, ok := recvTimeout(sub.Events, time.Second)
		if !ok {
			t.Fatalf("expected matching event %d", i)
		}
		s := got.GetTask().GetStage()
		if s != pb.TaskStage_TASK_STAGE_WORKING && s != pb.TaskStage_TASK_STAGE_IN_REVIEW {
			t.Errorf("unexpected stage %v", s)
		}
	}

	_, ok := recvTimeout(sub.Events, 100*time.Millisecond)
	if ok {
		t.Error("should not receive non-matching stage event")
	}
}

func TestEventBus_FilterByLabels(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{
		Labels: []string{"bug", "urgent"},
	})
	defer eb.Unsubscribe(sub.ID)

	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withLabels("bug", "urgent", "frontend"))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withLabels("bug"))))

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("expected event matching all labels")
	}
	if len(got.GetTask().GetLabels()) < 2 {
		t.Error("expected task with both labels")
	}

	_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
	if ok {
		t.Error("should not receive event missing required label")
	}
}

func TestEventBus_FilterByTaskID(t *testing.T) {
	eb := streaming.NewEventBus()
	targetID := uuid.New()
	sub := eb.Subscribe(streaming.SubscriptionFilter{TaskID: &targetID})
	defer eb.Unsubscribe(sub.ID)

	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_UPDATED, makeTask(withID(targetID.String()))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_UPDATED, makeTask(withID(uuid.New().String()))))

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("expected matching event")
	}
	if got.GetTask().GetId() != targetID.String() {
		t.Errorf("task id = %q, want %q", got.GetTask().GetId(), targetID.String())
	}

	_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
	if ok {
		t.Error("should not receive non-matching task id event")
	}
}

func TestEventBus_FilterByAssignee(t *testing.T) {
	eb := streaming.NewEventBus()
	assigneeID := uuid.New()

	t.Run("assigned", func(t *testing.T) {
		sub := eb.Subscribe(streaming.SubscriptionFilter{AssigneeID: &assigneeID})
		defer eb.Unsubscribe(sub.ID)

		eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withAssignees(assigneeID.String()))))
		eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withAssignees(uuid.New().String()))))

		got, ok := recvTimeout(sub.Events, time.Second)
		if !ok {
			t.Fatal("expected matching event")
		}
		if got.GetTask().GetAssignees()[0].GetId() != assigneeID.String() {
			t.Error("wrong assignee")
		}

		_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
		if ok {
			t.Error("should not receive non-matching assignee event")
		}
	})

	t.Run("unassigned", func(t *testing.T) {
		sub := eb.Subscribe(streaming.SubscriptionFilter{Unassigned: true})
		defer eb.Unsubscribe(sub.ID)

		eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask()))
		eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withAssignees(uuid.New().String()))))

		got, ok := recvTimeout(sub.Events, time.Second)
		if !ok {
			t.Fatal("expected unassigned event")
		}
		if len(got.GetTask().GetAssignees()) != 0 {
			t.Error("expected no assignees")
		}

		_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
		if ok {
			t.Error("should not receive assigned event")
		}
	})
}

func TestEventBus_FilterByPriority(t *testing.T) {
	eb := streaming.NewEventBus()
	prio := task.PriorityHigh
	sub := eb.Subscribe(streaming.SubscriptionFilter{Priority: &prio})
	defer eb.Unsubscribe(sub.ID)

	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withPriority(pb.TaskPriority_TASK_PRIORITY_HIGH))))
	eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withPriority(pb.TaskPriority_TASK_PRIORITY_LOW))))

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("expected matching priority event")
	}
	if got.GetTask().GetPriority() != pb.TaskPriority_TASK_PRIORITY_HIGH {
		t.Errorf("priority = %v, want HIGH", got.GetTask().GetPriority())
	}

	_, ok = recvTimeout(sub.Events, 100*time.Millisecond)
	if ok {
		t.Error("should not receive non-matching priority event")
	}
}

func TestEventBus_EmptyFilter(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{})
	defer eb.Unsubscribe(sub.ID)

	events := []*pb.TaskEvent{
		makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask(withPhase(pb.TaskPhase_TASK_PHASE_OPEN))),
		makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_UPDATED, makeTask(withPhase(pb.TaskPhase_TASK_PHASE_IN_PROGRESS))),
		makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CLOSED, makeTask(withPhase(pb.TaskPhase_TASK_PHASE_CLOSED))),
	}
	for _, e := range events {
		eb.Publish(e)
	}

	for i := range events {
		_, ok := recvTimeout(sub.Events, time.Second)
		if !ok {
			t.Fatalf("expected event %d", i)
		}
	}
}

func TestEventBus_SlowConsumer(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{})
	defer eb.Unsubscribe(sub.ID)

	for i := 0; i < 256; i++ {
		eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask()))
	}

	done := make(chan struct{})
	go func() {
		eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask()))
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Publish blocked on full channel — slow consumer should cause drop, not block")
	}
}

func TestEventBus_ConcurrentPublish(t *testing.T) {
	eb := streaming.NewEventBus()
	sub := eb.Subscribe(streaming.SubscriptionFilter{})
	defer eb.Unsubscribe(sub.ID)

	const goroutines = 10
	const eventsPerGoroutine = 50

	var wg sync.WaitGroup
	wg.Add(goroutines)
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < eventsPerGoroutine; i++ {
				eb.Publish(makeEvent(pb.TaskEventType_TASK_EVENT_TYPE_CREATED, makeTask()))
			}
		}()
	}
	wg.Wait()

	received := 0
	for {
		_, ok := recvTimeout(sub.Events, 100*time.Millisecond)
		if !ok {
			break
		}
		received++
	}
	if received == 0 {
		t.Error("expected at least some events")
	}
	if received > goroutines*eventsPerGoroutine {
		t.Errorf("received %d events, max possible %d", received, goroutines*eventsPerGoroutine)
	}
}

func TestEventBus_HeartbeatPassesFilter(t *testing.T) {
	eb := streaming.NewEventBus()
	collID := uuid.New()
	sub := eb.Subscribe(streaming.SubscriptionFilter{CollectionID: &collID})
	defer eb.Unsubscribe(sub.ID)

	heartbeat := &pb.TaskEvent{
		EventType: pb.TaskEventType_TASK_EVENT_TYPE_HEARTBEAT,
		Timestamp: timestamppb.Now(),
	}
	eb.Publish(heartbeat)

	got, ok := recvTimeout(sub.Events, time.Second)
	if !ok {
		t.Fatal("heartbeat (nil task) should pass any filter")
	}
	if got.GetEventType() != pb.TaskEventType_TASK_EVENT_TYPE_HEARTBEAT {
		t.Errorf("event type = %v, want HEARTBEAT", got.GetEventType())
	}
}
