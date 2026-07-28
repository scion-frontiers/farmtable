package github

import (
	"context"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/google/uuid"
)

// ── #194 round 8: an unrepresentable task type must strip nothing ──
//
// req.Type is an open-ended caller-supplied string and, unlike stage and
// priority, gets no enum validation — it cannot, because the Ent schema
// declares it field.String("type") so native collections can use arbitrary
// types, and on a GitHub collection the valid set is whatever the operator put
// in github.labels.types.
//
// TypeToLabel returns "" for a type the mapper has no label for, so nothing was
// added. But the remove loop ran anyway, so UpdateTask(type=<anything>) stripped
// every type label on the issue. Free, blind, repeatable, needing no operator
// config and reachable under DefaultConfig.

// TestTypeLabelSwap_AnUnknownTypeStripsNothing is the mapper-level assertion.
func TestTypeLabelSwap_AnUnknownTypeStripsNothing(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)
	current := []string{"bug", "ft:stage/accepted"}

	// PREREQUISITE: the harness must be able to see a strip at all, or the
	// assertion below passes for the wrong reason. A type the mapper DOES know
	// must produce a remove of the current type label.
	if _, remove := m.TypeLabelSwap(current, "feature"); !containsString(remove, "bug") {
		t.Fatalf("PREREQUISITE BROKEN: TypeLabelSwap(feature) remove = %v, and it does not "+
			"contain the issue's current type label. This harness cannot observe a strip, "+
			"so the assertion below would pass against a function that strips everything",
			remove)
	}

	add, remove := m.TypeLabelSwap(current, "totally-unknown-type")
	if len(add) != 0 || len(remove) != 0 {
		t.Errorf("TypeLabelSwap(%q) = add %v, remove %v, want both empty.\n\n"+
			"TypeToLabel has no label for this type, so nothing can be added. Removing the "+
			"issue's existing type labels anyway destroys triage metadata for a value that "+
			"names nothing, at the price of task:write.", "totally-unknown-type", add, remove)
	}
}

// TestTypeLabelSwap_TheEmptyTypeStillClears keeps the fix from over-reaching.
// "" is the documented spelling of "clear the type" and must go on working; it
// is the one case where having no label to add is what the caller asked for.
func TestTypeLabelSwap_TheEmptyTypeStillClears(t *testing.T) {
	m := NewLabelMapper(DefaultConfig().GitHub.Labels)

	add, remove := m.TypeLabelSwap([]string{"bug", "ft:stage/accepted"}, "")
	if len(add) != 0 {
		t.Errorf("add = %v, want empty: clearing the type adds no label", add)
	}
	if !containsString(remove, "bug") {
		t.Errorf("remove = %v, want it to contain \"bug\": clearing the type must still "+
			"strip the type label the issue carries", remove)
	}
	if containsString(remove, "ft:stage/accepted") {
		t.Errorf("remove = %v: clearing the type must not touch a lifecycle label", remove)
	}
}

// TestUpdateTask_AnUnknownTypeDoesNotDestroyTheIssuesTypeLabel drives the real
// RPC-facing path, because the mapper assertion above would still pass if
// UpdateTask stopped calling TypeLabelSwap and did something else.
func TestUpdateTask_AnUnknownTypeDoesNotDestroyTheIssuesTypeLabel(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "bug", "ft:stage/accepted")
	fake.registerLabel("bug")
	fake.registerLabel("feature")
	s := fake.storeWithLabelConfig(DefaultConfig().GitHub.Labels)

	typ := "totally-unknown-type"
	if _, err := s.UpdateTask(ctx, s.issueUUID(1),
		store.UpdateTaskParams{Type: &typ}, uuid.New()); err != nil {
		t.Fatalf("UpdateTask(type=%q): %v", typ, err)
	}
	if !fake.hasLabel("bug") {
		t.Errorf("UpdateTask(type=%q) deleted the issue's type label \"bug\"; labels = %v.\n\n"+
			"The type named nothing this store can represent, so nothing was added — and "+
			"the remove ran anyway.", typ, fake.labels)
	}
	if fake.removeCalls != 0 {
		t.Errorf("removeCalls = %d, want 0: no label mutation should have been issued at all",
			fake.removeCalls)
	}

	// CONTROL: the fake genuinely can delete "bug", so its survival above is a
	// decision by the code and not an inability of the harness.
	if _, ok := fake.labelIDs["bug"]; !ok {
		t.Fatal("CONTROL BROKEN: no node ID for \"bug\", so no removal was ever possible")
	}
	known := "feature"
	if _, err := s.UpdateTask(ctx, s.issueUUID(1),
		store.UpdateTaskParams{Type: &known}, uuid.New()); err != nil {
		t.Fatalf("CONTROL: UpdateTask(type=feature): %v", err)
	}
	if fake.hasLabel("bug") {
		t.Fatalf("CONTROL BROKEN: a KNOWN type did not strip the old type label either, so "+
			"the assertion above proves nothing about unknown types; labels = %v", fake.labels)
	}
}
