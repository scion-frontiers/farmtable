package github

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store"
)

// TestPassThroughClaimTask_ClosedIssueIsNotClaimable is the end-to-end half of
// review-194 H1: the ClosedAt arm in issueUnavailableForClaim.
//
// That arm is a behaviour-preserving no-op against real GitHub, because
// ClaimTask lists with states: [OPEN] and so never resolves a closed issue —
// see TestPassThroughClaimTask_ListsOnlyOpenIssues, which pins that premise. A
// test that only drove the real filtered path could therefore never distinguish
// the arm being present from it being absent, which is precisely the kind of
// test that lets a guard be deleted as dead code.
//
// So this test changes the enforcement path, which is the second half of the
// condition the guard exists for. The fake matches GraphQL requests by
// substring and ignores the states variable entirely, so pointing it at a
// CLOSED issue reproduces exactly what a widened filter, an added caller, or a
// stale cache in front of the API would deliver: a closed issue arriving at the
// claim gate. Remove the arm and this test fails by handing a closed task to an
// agent — with ErrAlreadyClaimed not firing either, because a closed issue need
// not carry an assignee.
//
// The label is deliberately ft:stage/accepted: on the closed branch of
// IssueToPhaseStage labels still win, so Stage reads accepted and the Stage arm
// of the gate waves it through. ClosedAt is the only signal left that says no.
func TestPassThroughClaimTask_ClosedIssueIsNotClaimable(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/accepted")
	fake.state = "CLOSED"
	fake.stateReason = "COMPLETED"
	fake.closedAt = "2026-01-02T00:00:00Z"
	s := fake.store()

	_, err := s.ClaimTask(context.Background(), s.issueUUID(1), uuid.New(), "")
	if !errors.Is(err, store.ErrUnavailable) {
		t.Fatalf("ClaimTask on a closed issue returned %v, want %v", err, store.ErrUnavailable)
	}
	if fake.hasLabel("ft:stage/working") {
		t.Errorf("a rejected claim still stamped ft:stage/working; labels = %v", fake.labels)
	}
}

// TestPassThroughClaimTask_ListsOnlyOpenIssues pins the premise that makes the
// ClosedAt arm a no-op today. It is asserted rather than assumed so that
// widening the filter fails here, next to the comment explaining what the arm
// then starts doing, instead of silently promoting dead code to live code.
func TestPassThroughClaimTask_ListsOnlyOpenIssues(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/accepted")

	var listBody string
	inner := fake.handler()
	s := fake.store()
	s.gql = testGraphQLClient(t, func(w http.ResponseWriter, r *http.Request) {
		body := mustReadBody(t, r.Body)
		if strings.Contains(body, "issues(") && !strings.Contains(body, "issue(number:") {
			listBody = body
		}
		// mustReadBody consumed the request body; hand the fake a fresh reader
		// over the same bytes so the observation is transparent to it.
		r.Body = io.NopCloser(strings.NewReader(body))
		inner(w, r)
	})

	if _, err := s.ClaimTask(context.Background(), s.issueUUID(1), uuid.New(), ""); err != nil {
		t.Fatalf("ClaimTask: %v", err)
	}

	if listBody == "" {
		t.Fatal("ClaimTask issued no issue-list query")
	}
	if !strings.Contains(listBody, `"states":["OPEN"]`) {
		t.Fatalf("ClaimTask's issue-list query does not filter to OPEN only.\n"+
			"If that is intentional, the ClosedAt arm of issueUnavailableForClaim "+
			"is no longer a no-op — it is now the gate stopping closed issues from "+
			"being claimed. Query was:\n%s", listBody)
	}
}
