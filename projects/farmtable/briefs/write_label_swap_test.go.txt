package github

import (
	"context"
	"strings"
	"testing"

	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
	"github.com/google/uuid"
)

// ── #194 round 7 / test review: pinning writeLabelSwap in its OWN package ──
//
// writeLabelSwap is the shared helper the round-7 refactor routed all ten
// previously-discarded label-write error sites through. Its stated purpose is
// in its first line: it "applies a label swap to an issue and REPORTS its
// failures". Before it, every call site discarded the mutation error into `_`.
//
// MEASURED at 1d4442f, before these tests existed: swallowing BOTH of
// writeLabelSwap's error returns — restoring the exact pre-round-7 behaviour,
// while still performing the writes — left `go test ./...` GREEN, exit 0, zero
// failures repo-wide. The only behaviour the refactor actually introduced was
// unpinned everywhere.
//
// The reason is narrow and worth naming: `failLabelWrites`, the fake's only
// knob that makes a label mutation fail, is set at exactly four sites, all in
// close_label_swap_test.go, and all four drive CloseTask. CloseTask does NOT
// use writeLabelSwap — it kept its own inline swap that swallows errors ON
// PURPOSE, because the close has already succeeded and must not be reported as
// failed. So the one path that exercises a failing label write is the one path
// whose contract is to ignore it, and the two paths that must report it were
// never driven with a failing write at all.
//
// The server package cannot cover this either: its httptest mock always
// answers addLabelsToLabelable and removeLabelsFromLabelable with success, so
// no test there can observe a label-write error however the store behaves.
//
// These tests drive the two paths that DO report — UpdateTask and ClaimTask —
// with the write failing, and require the error to surface. Each has a positive
// control immediately beside it, because "the call returned an error" is worth
// nothing unless the same call without the injected failure returns none.

// requireSwapErrorSurfaces asserts an error came back, that it is the
// label-write error rather than some other failure, and that a mutation was
// really attempted.
//
// The attempt count is not decoration. The fake increments addCalls and
// removeCalls BEFORE it consults failLabelWrites, so "a write was attempted" is
// observable independently of whether it succeeded. Without that check this
// helper would accept a store that never issued the mutation at all and failed
// for an unrelated reason — the bypass shape this round's review was sweeping
// for.
func requireSwapErrorSurfaces(t *testing.T, err error, wantVerb string, attempts int) {
	t.Helper()

	if attempts == 0 {
		t.Fatalf("HARNESS BROKEN: no label mutation was attempted, so the injected "+
			"write failure never ran and %q proves nothing about error reporting", wantVerb)
	}
	if err == nil {
		t.Fatalf("the label write failed and the call returned nil. Every one of these "+
			"call sites used to discard the mutation error into `_`, which is the bug "+
			"writeLabelSwap exists to fix: the caller is told the swap landed, and the "+
			"event published from that answer describes a state GitHub was never put into")
	}
	if !strings.Contains(err.Error(), wantVerb) {
		t.Fatalf("got %v, want an error naming %q. A different error here means the call "+
			"failed for an unrelated reason and the label-write path was not measured",
			err, wantVerb)
	}
}

// TestWriteLabelSwap_UpdateTaskReportsALabelWriteFailure pins the UpdateTask
// half. Both arms of writeLabelSwap are covered separately, because they are
// two independent `return` statements and swallowing either one alone was
// measured GREEN.
func TestWriteLabelSwap_UpdateTaskReportsALabelWriteFailure(t *testing.T) {
	ctx := context.Background()
	stage := task.StageWorking

	t.Run("remove_half", func(t *testing.T) {
		// An issue that already carries a stage label, so the swap has a remove
		// side and writeLabelSwap reaches removeLabels first.
		fake := newFakeIssueRepo(t, "ft:stage/accepted")
		fake.failLabelWrites = true
		s := fake.store()

		_, err := s.UpdateTask(ctx, s.issueUUID(1), store.UpdateTaskParams{Stage: &stage}, uuid.New())
		requireSwapErrorSurfaces(t, err, "removing labels", fake.removeCalls)
	})

	t.Run("add_half", func(t *testing.T) {
		// No stage label to remove, so the remove side is empty and the first
		// mutation writeLabelSwap issues is the add.
		fake := newFakeIssueRepo(t)
		fake.failLabelWrites = true
		s := fake.store()

		_, err := s.UpdateTask(ctx, s.issueUUID(1), store.UpdateTaskParams{Stage: &stage}, uuid.New())
		requireSwapErrorSurfaces(t, err, "adding labels", fake.addCalls)
		if fake.removeCalls != 0 {
			t.Fatalf("removeCalls = %d, want 0: this row is meant to reach the ADD arm "+
				"first, and a remove attempt means it measured the other one", fake.removeCalls)
		}
	})

	// POSITIVE CONTROL. The same two calls must succeed when the write is
	// allowed. Without this, both rows above would pass against an UpdateTask
	// that returned an error unconditionally.
	t.Run("control_succeeds_when_the_write_is_allowed", func(t *testing.T) {
		for _, initial := range [][]string{{"ft:stage/accepted"}, nil} {
			fake := newFakeIssueRepo(t, initial...)
			s := fake.store()

			if _, err := s.UpdateTask(ctx, s.issueUUID(1),
				store.UpdateTaskParams{Stage: &stage}, uuid.New()); err != nil {
				t.Fatalf("CONTROL BROKEN: UpdateTask(stage=working) on an issue labelled %v "+
					"failed with the write allowed: %v", initial, err)
			}
			if !fake.hasLabel("ft:stage/working") {
				t.Fatalf("CONTROL BROKEN: the permitted swap did not stamp ft:stage/working; "+
					"labels = %v", fake.labels)
			}
		}
	})
}

// TestWriteLabelSwap_ClaimTaskReportsALabelWriteFailure pins the ClaimTask
// half. ClaimTask is the call site where a swallowed failure is worst: it
// returns the task as claimed, so the claim is recorded while the issue on
// GitHub never received ft:stage/working and stays claimable by the next agent.
func TestWriteLabelSwap_ClaimTaskReportsALabelWriteFailure(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/accepted")
	fake.failLabelWrites = true
	s := fake.store()

	_, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), "")
	requireSwapErrorSurfaces(t, err, "removing labels", fake.removeCalls)

	// POSITIVE CONTROL.
	ok := newFakeIssueRepo(t, "ft:stage/accepted")
	okStore := ok.store()
	if _, err := okStore.ClaimTask(ctx, okStore.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("CONTROL BROKEN: ClaimTask failed with the write allowed: %v", err)
	}
	if !ok.hasLabel("ft:stage/working") {
		t.Fatalf("CONTROL BROKEN: the permitted claim did not stamp ft:stage/working; "+
			"labels = %v", ok.labels)
	}
}

// TestWriteLabelSwap_RemovalHalfIsPinnedInThisPackage answers the round-7
// coverage-locality question directly.
//
// MEASURED at 1d4442f: killing writeLabelSwap's REMOVE half (`remove = nil`)
// produced 0 failures in internal/platform/github and 10 in internal/server.
// The repository does pin the removal path, but the coverage lives two packages
// away from the code, so a change to this helper is not answerable by running
// this package's tests.
//
// This test moves one pin next to the helper. It is not redundant with the
// server-side coverage: those ten tests reach the removal through the
// authorization gate, so they also fail for a dozen reasons that have nothing
// to do with this function, and a developer running `go test
// ./internal/platform/github/` while editing writeLabelSwap sees none of them.
func TestWriteLabelSwap_RemovalHalfIsPinnedInThisPackage(t *testing.T) {
	ctx := context.Background()

	fake := newFakeIssueRepo(t, "ft:stage/accepted")
	s := fake.store()

	if _, err := s.ClaimTask(ctx, s.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}

	// The add half. Pinned here too so the two halves are visible side by side.
	if !fake.hasLabel("ft:stage/working") {
		t.Errorf("the claim did not stamp ft:stage/working; labels = %v", fake.labels)
	}

	// THE REMOVE HALF, which nothing in this package pinned.
	if fake.hasLabel("ft:stage/accepted") {
		t.Errorf("ft:stage/accepted survived the claim; labels = %v.\n\nA stage swap that "+
			"only adds leaves the issue naming two stages at once, which is the input the "+
			"terminal-tiebreak defects in this file's neighbours all start from", fake.labels)
	}

	// The mutation really went out, rather than the label being absent because
	// nothing was attempted. This is the one-line check whose absence made
	// TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel unable to
	// distinguish "declined to delete" from "attempted no write at all".
	if fake.removeCalls == 0 {
		t.Errorf("removeCalls = 0: the label is absent because no removal was ever " +
			"attempted, not because the removal worked")
	}
}
