package github

import (
	"context"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// ── #194 round 8: the writeLabelSwap ownership assertion ──
//
// These pin stageWritePolicy: the invariant that a code path which is not
// entitled to move the lifecycle stage cannot write a lifecycle label, whatever
// the operator's configuration says.
//
// The scenario is the round-7 security audit's finding, reproduced here rather
// than described: `duplicate` is simultaneously a Farm Table lifecycle stage
// and a label GitHub creates in every new repository, so an operator mapping
// their stock GitHub labels onto Farm Table types writes
//
//	github: {labels: {types: {duplicate: chore}}}
//
// mentioning no stage anywhere. stripForMatch normalises "ft:stage/duplicate"
// onto the bare key "duplicate", TypeLabelSwap then believes that label is its
// own to rewrite, and UpdateTask(type=...) — which costs bare task:write, has
// no transition-scope check, and does not pass through
// RestrictLabelWriteToSnapshot — destroyed a maintainer's decline for free.
//
// THESE TESTS DELIBERATELY BYPASS Validate. GitHubConfig.Validate also rejects
// this config now (see
// TestValidate_RejectsAPrioritiesOrTypesKeyThatCapturesALifecycleLabel),
// and that is the layer an operator will actually hit. This layer is what
// holds when the config arrives by a path nobody validated, or when a future
// normalisation change makes some other key reach a stage. Two layers, and the
// test for each must be able to fail with the other one present — which is why
// these construct the LabelMapper directly.

// collidingTypeConfig is the operator config from the audit finding, built
// without going through Validate.
func collidingTypeConfig() LabelConfig {
	cfg := DefaultConfig().GitHub.Labels
	cfg.Types = map[string]string{"duplicate": "chore"}
	return cfg
}

// TestStageWritePolicy_TypeArmCannotDestroyALifecycleLabel is the destructive
// direction of the audit finding.
func TestStageWritePolicy_TypeArmCannotDestroyALifecycleLabel(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/duplicate", "bug")
	fake.registerLabel("bug")
	fake.registerLabel("feature")
	s := fake.storeWithLabelConfig(collidingTypeConfig())

	// PREREQUISITE. Without this the swap short-circuits and the test measures
	// nothing — which is exactly how the audit nearly recorded a false kill of
	// this same finding.
	add, remove := s.mapper.TypeLabelSwap([]string{"ft:stage/duplicate", "bug"}, "feature")
	if !containsString(remove, "ft:stage/duplicate") {
		t.Fatalf("PREREQUISITE BROKEN: TypeLabelSwap(feature) returned add=%v remove=%v, and the "+
			"lifecycle label is not in the remove set. The colliding config no longer reaches "+
			"the mapper, so this test cannot observe the control it exists to pin", add, remove)
	}

	typ := "feature"
	_, err := s.UpdateTask(ctx, s.issueUUID(1), store.UpdateTaskParams{Type: &typ}, uuid.New())
	if err == nil {
		t.Fatalf("UpdateTask(type=feature) succeeded. It removed the lifecycle label "+
			"ft:stage/duplicate with no transition scope charged, which revokes a "+
			"maintainer's decline for the price of task:write. labels now %v", fake.labels)
	}
	if !strings.Contains(err.Error(), "ft:stage/duplicate") {
		t.Fatalf("got %v, want an error naming the refused lifecycle label. A different error "+
			"means the call failed for an unrelated reason and the control was not measured", err)
	}
	if !fake.hasLabel("ft:stage/duplicate") {
		t.Fatalf("the call errored but the label is gone anyway; labels now %v.\n\n"+
			"The assertion must run BEFORE any mutation is issued, or it reports a refusal "+
			"for a write that already happened", fake.labels)
	}
	if fake.removeCalls != 0 || fake.addCalls != 0 {
		t.Fatalf("addCalls=%d removeCalls=%d, want 0/0: the refusal must precede the write",
			fake.addCalls, fake.removeCalls)
	}
}

// TestStageWritePolicy_TypeArmCannotForgeALifecycleLabel is the constructive
// direction. Destroying a decline and manufacturing one are the same primitive
// pointed in opposite directions, and a control that only covers removal is
// half a control.
func TestStageWritePolicy_TypeArmCannotForgeALifecycleLabel(t *testing.T) {
	ctx := context.Background()

	cfg := DefaultConfig().GitHub.Labels
	// The table is label -> type, so this says "the label ft:stage/wont_fix
	// means the Farm Table type `bug`" — and TypeToLabel inverts it.
	cfg.Types = map[string]string{"ft:stage/wont_fix": "bug"}

	fake := newFakeIssueRepo(t)
	s := fake.storeWithLabelConfig(cfg)

	if got := s.mapper.TypeToLabel("bug"); got != "ft:stage/wont_fix" {
		t.Fatalf("PREREQUISITE BROKEN: TypeToLabel(bug) = %q, want ft:stage/wont_fix; the "+
			"forging config does not reach the mapper and this test measures nothing", got)
	}

	typ := "bug"
	_, err := s.UpdateTask(ctx, s.issueUUID(1), store.UpdateTaskParams{Type: &typ}, uuid.New())
	if err == nil {
		t.Fatalf("UpdateTask(type=bug) succeeded and stamped a terminal lifecycle label on a "+
			"clean issue for the price of task:write; labels now %v", fake.labels)
	}
	if fake.hasLabel("ft:stage/wont_fix") {
		t.Fatalf("the call errored but the terminal label landed anyway; labels %v", fake.labels)
	}
}

// TestStageWritePolicy_PriorityArmCannotTouchALifecycleLabel covers the second
// unpriced arm. Both arms are reachable with bare task:write and neither has a
// transition gate, so pinning only one leaves the other free.
func TestStageWritePolicy_PriorityArmCannotTouchALifecycleLabel(t *testing.T) {
	ctx := context.Background()

	cfg := DefaultConfig().GitHub.Labels
	cfg.Priorities = map[string]string{"completed": "high"}

	fake := newFakeIssueRepo(t, "ft:stage/completed")
	s := fake.storeWithLabelConfig(cfg)

	add, remove := s.mapper.PriorityLabelSwap([]string{"ft:stage/completed"}, task.PriorityLow)
	if !containsString(remove, "ft:stage/completed") {
		t.Fatalf("PREREQUISITE BROKEN: PriorityLabelSwap(low) returned add=%v remove=%v; the "+
			"colliding priorities key does not reach the mapper", add, remove)
	}

	prio := task.PriorityLow
	_, err := s.UpdateTask(ctx, s.issueUUID(1), store.UpdateTaskParams{Priority: &prio}, uuid.New())
	if err == nil {
		t.Fatalf("UpdateTask(priority=low) succeeded and erased ft:stage/completed; labels %v",
			fake.labels)
	}
	if !fake.hasLabel("ft:stage/completed") {
		t.Fatalf("the call errored but the label is gone; labels %v", fake.labels)
	}
}

// TestStageWritePolicy_StageMovingPathsAreStillAllowed is the positive control
// for all three tests above, and it is the assertion that stops the fix from
// being "make every label write fail".
//
// It matters more than a usual positive control here, because the natural
// over-application of this policy — setting stageWriteForbidden on UpdateTask's
// caller-supplied add_labels / remove_labels arms as well — is silently wrong.
// Those arms ARE priced: the server charges a transition scope for them at the
// label-delta gate and then narrows them against the authorized snapshot. A
// caller holding task:accept must still be able to remove ft:stage/wont_fix
// through remove_labels, and forbidding it would break that legitimate path
// while looking like extra safety.
func TestStageWritePolicy_StageMovingPathsAreStillAllowed(t *testing.T) {
	ctx := context.Background()

	t.Run("stage_arm", func(t *testing.T) {
		fake := newFakeIssueRepo(t, "ft:stage/accepted")
		s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

		stage := task.StageWontFix
		if _, err := s.UpdateTask(ctx, s.issueUUID(1),
			store.UpdateTaskParams{Stage: &stage}, uuid.New()); err != nil {
			t.Fatalf("CONTROL BROKEN: UpdateTask(stage=wont_fix) refused: %v", err)
		}
		if !fake.hasLabel("ft:stage/wont_fix") || fake.hasLabel("ft:stage/accepted") {
			t.Fatalf("CONTROL BROKEN: the stage swap did not land; labels %v", fake.labels)
		}
	})

	t.Run("claim_task", func(t *testing.T) {
		fake := newFakeIssueRepo(t, "ft:stage/accepted")
		s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

		if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err != nil {
			t.Fatalf("CONTROL BROKEN: ClaimTask refused: %v", err)
		}
		if !fake.hasLabel("ft:stage/working") {
			t.Fatalf("CONTROL BROKEN: the claim did not stamp ft:stage/working; labels %v", fake.labels)
		}
	})

	t.Run("caller_supplied_remove_labels", func(t *testing.T) {
		fake := newFakeIssueRepo(t, "ft:stage/wont_fix")
		s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

		if _, err := s.UpdateTask(ctx, s.issueUUID(1),
			store.UpdateTaskParams{RemoveLabels: []string{"ft:stage/wont_fix"}}, uuid.New()); err != nil {
			t.Fatalf("CONTROL BROKEN: remove_labels[ft:stage/wont_fix] refused: %v.\n\n"+
				"This arm is PRICED by the server's label-delta gate and narrowed against the "+
				"authorized snapshot, so it is a legitimate stage-moving path. Forbidding it "+
				"here breaks every task:accept-holding caller", err)
		}
		if fake.hasLabel("ft:stage/wont_fix") {
			t.Fatalf("CONTROL BROKEN: the priced removal did not land; labels %v", fake.labels)
		}
	})

	t.Run("caller_supplied_add_labels", func(t *testing.T) {
		fake := newFakeIssueRepo(t)
		s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

		if _, err := s.UpdateTask(ctx, s.issueUUID(1),
			store.UpdateTaskParams{AddLabels: []string{"ft:stage/completed"}}, uuid.New()); err != nil {
			t.Fatalf("CONTROL BROKEN: add_labels[ft:stage/completed] refused: %v", err)
		}
		if !fake.hasLabel("ft:stage/completed") {
			t.Fatalf("CONTROL BROKEN: the priced addition did not land; labels %v", fake.labels)
		}
	})

	t.Run("priority_and_type_arms_still_work_under_a_sane_config", func(t *testing.T) {
		fake := newFakeIssueRepo(t, "ft:priority/low", "bug")
		fake.registerLabel("ft:priority/low")
		fake.registerLabel("ft:priority/high")
		fake.registerLabel("bug")
		fake.registerLabel("feature")
		s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

		prio := task.PriorityHigh
		if _, err := s.UpdateTask(ctx, s.issueUUID(1),
			store.UpdateTaskParams{Priority: &prio}, uuid.New()); err != nil {
			t.Fatalf("CONTROL BROKEN: UpdateTask(priority=high) refused under DefaultConfig: %v.\n\n"+
				"The policy must bind only on lifecycle labels; if it refuses an ordinary "+
				"priority edit it is a availability bug, not a control", err)
		}
	})
}

func containsString(in []string, want string) bool {
	for _, s := range in {
		if s == want {
			return true
		}
	}
	return false
}
