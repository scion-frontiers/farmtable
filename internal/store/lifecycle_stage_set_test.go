package store_test

import (
	"context"
	"errors"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/farmtable-io/farmtable/internal/testutil"
	"github.com/google/uuid"
)

// ── #194 round 6, B2 + B4: the lifecycle stage-set seam's fallbacks ──
//
// Two findings share one root here.
//
// B4 (review F7, raised by security audit A-3) — the fallback was fail-OPEN.
// LabelDeltaLifecycleStages required len(before) > 0 && len(after) > 0 and
// otherwise returned (current, current), i.e. "this label edit is not a
// lifecycle transition", which charges nothing. Every caller of these helpers
// is an authorization gate, so an implementation that returned an empty side
// bought a silently open gate. The direction of a wrong answer at an
// authorization gate must be denial.
//
// B2 (test review T-2) — the rule was written twice, in store.go and again in
// MultiStore, and the second copy would absorb the violation before the first
// could see it. Mutation evidence from round 5: MUT_DELTA_FALLBACK and
// MUT_NATIVE_SPURIOUS both survived with 0 failures on the store.go copy, while
// the control MUT_MS_NATIVE_SPURIOUS on the MultiStore copy killed 1 test —
// the store.go pair was unreachable duplicated code. Two copies of a rule is
// one copy plus a future bug.
//
// The tests below are the tripwire that replaces both. They are written against
// the observable contract, not against the line numbers.

// brokenStageSetStore implements store.LifecycleStageSetStager and violates its
// "never empty" contract. It is the input the round-5 fixtures could not
// express — which is why the fail-open branch went unmeasured for two rounds.
//
// store.Store is embedded as a nil interface: only the two seam methods are
// ever called, and any other call panics loudly rather than returning a
// plausible zero value.
type brokenStageSetStore struct {
	store.Store
	before, after []task.Stage
}

// Close is implemented because MultiStore.Close calls it on every registered
// platform store; the embedded nil interface would panic. Every OTHER method is
// deliberately left to panic.
func (b brokenStageSetStore) Close() error { return nil }

func (b brokenStageSetStore) LifecycleStages(context.Context, *ent.Task) []task.Stage {
	return b.before
}

func (b brokenStageSetStore) LabelDeltaLifecycleStages(
	context.Context, *ent.Task, []string, []string,
) (before, after []task.Stage) {
	return b.before, b.after
}

// healthyStageSetStore is the positive control for every negative claim below.
// Without it, a helper that returned ErrEmptyLifecycleStageSet unconditionally
// would satisfy all the error cases.
type healthyStageSetStore struct {
	store.Store
	before, after []task.Stage
}

func (h healthyStageSetStore) Close() error { return nil }

func (h healthyStageSetStore) LifecycleStages(context.Context, *ent.Task) []task.Stage {
	return h.before
}

func (h healthyStageSetStore) LabelDeltaLifecycleStages(
	context.Context, *ent.Task, []string, []string,
) (before, after []task.Stage) {
	return h.before, h.after
}

func TestLabelDeltaLifecycleStages_EmptySideFailsClosed(t *testing.T) {
	ctx := context.Background()
	tk := &ent.Task{Stage: task.StageAccepted}

	// POSITIVE CONTROL FIRST. A well-behaved implementer must come back with no
	// error and its own answer, untouched. If this row ever fails, every
	// "denied" row below is meaningless.
	t.Run("positive control: a healthy implementer is passed through", func(t *testing.T) {
		s := healthyStageSetStore{
			before: []task.Stage{task.StageAccepted},
			after:  []task.Stage{task.StageCompleted},
		}
		before, after, err := store.LabelDeltaLifecycleStages(ctx, s, tk, []string{"x"}, nil)
		if err != nil {
			t.Fatalf("healthy implementer returned an error: %v", err)
		}
		if !store.SameStageSet(before, []task.Stage{task.StageAccepted}) ||
			!store.SameStageSet(after, []task.Stage{task.StageCompleted}) {
			t.Fatalf("healthy implementer's answer was altered: before=%v after=%v", before, after)
		}
	})

	for _, tc := range []struct {
		name          string
		before, after []task.Stage
	}{
		{"both empty", nil, nil},
		{"before empty", nil, []task.Stage{task.StageCompleted}},
		{"after empty", []task.Stage{task.StageAccepted}, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := brokenStageSetStore{before: tc.before, after: tc.after}
			before, after, err := store.LabelDeltaLifecycleStages(ctx, s, tk, []string{"x"}, nil)
			if err == nil {
				t.Fatalf("a contract-violating store was accepted: before=%v after=%v. "+
					"An empty stage set means the gate charges for nothing and ALLOWS; "+
					"it must deny instead (F7 / A-3)", before, after)
			}
			if !errors.Is(err, store.ErrEmptyLifecycleStageSet) {
				t.Fatalf("got %v, want it to wrap ErrEmptyLifecycleStageSet", err)
			}
			// And it must not hand back a usable answer alongside the error, or
			// a caller that checks the slices before the error still fails open.
			if len(before) != 0 || len(after) != 0 {
				t.Errorf("returned before=%v after=%v with an error; want both nil so a "+
					"caller cannot proceed on them", before, after)
			}
		})
	}
}

func TestLifecycleStages_EmptyResultFailsClosed(t *testing.T) {
	ctx := context.Background()
	tk := &ent.Task{Stage: task.StageAccepted}

	t.Run("positive control: a healthy implementer is passed through", func(t *testing.T) {
		s := healthyStageSetStore{before: []task.Stage{task.StageWontFix}}
		got, err := store.LifecycleStages(ctx, s, tk)
		if err != nil {
			t.Fatalf("healthy implementer returned an error: %v", err)
		}
		if !store.SameStageSet(got, []task.Stage{task.StageWontFix}) {
			t.Fatalf("got %v, want [wont_fix]", got)
		}
	})

	t.Run("an empty set is an error, not a substituted t.Stage", func(t *testing.T) {
		s := brokenStageSetStore{before: nil}
		got, err := store.LifecycleStages(ctx, s, tk)
		if err == nil {
			t.Fatalf("a contract-violating store was accepted and answered %v. Substituting "+
				"t.Stage here is what let a broken store produce an unguarded gate", got)
		}
		if !errors.Is(err, store.ErrEmptyLifecycleStageSet) {
			t.Fatalf("got %v, want it to wrap ErrEmptyLifecycleStageSet", err)
		}
	})
}

// TestLifecycleStageHelpers_NonImplementerIsAnsweredNotRejected is the other
// half of the contract, and the row that stops the fix above from becoming a
// denial of service.
//
// A store that does NOT implement LifecycleStageSetStager has violated nothing.
// Its stage lives in its own column, no label can forge it, and "a label edit
// induces no stage transition" is the true answer. It must be answered, not
// errored — the error is reserved for implementers that break their promise.
func TestLifecycleStageHelpers_NonImplementerIsAnsweredNotRejected(t *testing.T) {
	ctx := context.Background()
	entStore, cleanup := testutil.NewTestStore(t)
	defer cleanup()
	tk := &ent.Task{Stage: task.StageAccepted}

	stages, err := store.LifecycleStages(ctx, entStore, tk)
	if err != nil {
		t.Fatalf("LifecycleStages on a native store errored: %v", err)
	}
	if !store.SameStageSet(stages, []task.Stage{task.StageAccepted}) {
		t.Errorf("got %v, want [accepted]", stages)
	}

	before, after, err := store.LabelDeltaLifecycleStages(
		ctx, entStore, tk, []string{"ft:stage/completed"}, nil)
	if err != nil {
		t.Fatalf("LabelDeltaLifecycleStages on a native store errored: %v", err)
	}
	if !store.SameStageSet(before, after) {
		t.Errorf("a native store reported a label-induced transition %v -> %v; no label "+
			"can move a stage that lives in its own column", before, after)
	}
}

// ── B2: the MultiStore copy of the fallback is gone, and stays gone ──

// TestMultiStore_PropagatesAnEmptyInnerAnswerVerbatim is the tripwire for B2.
//
// MultiStore used to repair an empty answer from the store it routes to by
// substituting the current stage. That was the second copy of the rule, and it
// ran FIRST — so the package-level helper's copy could never see a violation
// and was unreachable, which is exactly what round 5's mutation testing
// measured (MUT_DELTA_FALLBACK survived with 0 failures).
//
// Repairing it here is also wrong on its own terms: MultiStore cannot return an
// error, so the only way for a violation to reach a caller that CAN deny is to
// pass it up untouched.
//
// If someone reintroduces the fallback in MultiStore, this test fails. That is
// a tripwire rather than a comment saying "do not add this back".
func TestMultiStore_PropagatesAnEmptyInnerAnswerVerbatim(t *testing.T) {
	ctx := context.Background()
	primary, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	coll, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name: "routed", Platform: "github",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}

	ms := store.NewMultiStore(primary)
	defer func() { _ = ms.Close() }()
	ms.RegisterPlatform(coll.ID, brokenStageSetStore{})

	tk := &ent.Task{Stage: task.StageAccepted, CollectionID: coll.ID}

	if got := ms.LifecycleStages(ctx, tk); len(got) != 0 {
		t.Errorf("MultiStore.LifecycleStages repaired an empty inner answer into %v. It must "+
			"propagate the violation so the package-level helper can deny it (B2)", got)
	}
	if before, after := ms.LabelDeltaLifecycleStages(ctx, tk, []string{"x"}, nil); len(before) != 0 || len(after) != 0 {
		t.Errorf("MultiStore.LabelDeltaLifecycleStages repaired an empty inner answer into "+
			"(%v, %v). It must propagate the violation (B2)", before, after)
	}

	// End to end: routed through MultiStore, the package-level helper denies.
	// This is the pairing that matters — propagation is only useful because
	// something downstream turns it into a refusal.
	if _, _, err := store.LabelDeltaLifecycleStages(ctx, ms, tk, []string{"x"}, nil); !errors.Is(err, store.ErrEmptyLifecycleStageSet) {
		t.Errorf("through MultiStore, a contract-violating inner store produced err=%v; "+
			"want ErrEmptyLifecycleStageSet", err)
	}

	// POSITIVE CONTROL: the same routing with a healthy inner store must give a
	// clean answer, so the rows above are not passing because routing is broken.
	healthyColl, err := primary.CreateCollection(ctx, store.CreateCollectionParams{
		Name: "routed-healthy", Platform: "github",
	})
	if err != nil {
		t.Fatalf("CreateCollection: %v", err)
	}
	ms.RegisterPlatform(healthyColl.ID, healthyStageSetStore{
		before: []task.Stage{task.StageAccepted},
		after:  []task.Stage{task.StageCompleted},
	})
	healthyTask := &ent.Task{Stage: task.StageAccepted, CollectionID: healthyColl.ID}
	before, after, err := store.LabelDeltaLifecycleStages(ctx, ms, healthyTask, []string{"x"}, nil)
	if err != nil {
		t.Fatalf("healthy routed store errored: %v", err)
	}
	if !store.SameStageSet(before, []task.Stage{task.StageAccepted}) ||
		!store.SameStageSet(after, []task.Stage{task.StageCompleted}) {
		t.Fatalf("healthy routed answer was altered: before=%v after=%v", before, after)
	}
}

// TestMultiStore_UnroutedCollectionStillGetsTheOneElementAnswer pins the arm
// that legitimately remains in MultiStore: a collection routed to a store that
// does not implement the interface at all.
func TestMultiStore_UnroutedCollectionStillGetsTheOneElementAnswer(t *testing.T) {
	ctx := context.Background()
	primary, cleanup := testutil.NewTestStore(t)
	defer cleanup()

	ms := store.NewMultiStore(primary)
	defer func() { _ = ms.Close() }()

	tk := &ent.Task{Stage: task.StageInReview, CollectionID: uuid.New()}

	if got := ms.LifecycleStages(ctx, tk); !store.SameStageSet(got, []task.Stage{task.StageInReview}) {
		t.Errorf("got %v, want [in_review]", got)
	}
	before, after := ms.LabelDeltaLifecycleStages(ctx, tk, []string{"ft:stage/completed"}, nil)
	if !store.SameStageSet(before, after) ||
		!store.SameStageSet(before, []task.Stage{task.StageInReview}) {
		t.Errorf("got (%v, %v), want ([in_review], [in_review])", before, after)
	}
}
