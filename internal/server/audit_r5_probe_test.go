package server_test

// SALVAGED AUDIT PROBE — #194 round 6, item B7.
//
// Source: the round-5 security audit's internal/server probe, written at
// ea8ac390dad3d2401d65608684e5d6623ab15ac5, commit
// 00755260c42e14e9dac7d0f7041f60ea55085b32, 710 lines, 11 tests
// (sha256 7e36f5cd1f0153bfe323ef263366935f58296d4605f2d3f95d4f4c6810dda221).
//
// FOUR OF THE ELEVEN ARE KEPT. This is a selective salvage and the seven
// dropped tests are listed with reasons at the bottom of this file rather than
// deleted silently, so that a later round can disagree with the judgement
// instead of rediscovering the file.
//
// KEPT because nothing in the suite covers the shape:
//   - PositiveControl_TheProbeCanObserveAnAllow  (harness control for the below)
//   - Charge1_RemovalDirection                   (remove X from [X,Y], 12 cells)
//   - Charge4_FromEqualsToReachability           (where from == to still fires)
//   - Charge4_REV9PremiseAdversarially           (counter control + issue state)
//
// HARNESS PROVENANCE, carried over from the auditor unchanged because it is
// still true: this file reuses the fixture helpers declared in
// authz_label_write_scope_test.go (labelWriteFixture, openIssue, scopedCtx,
// agentScopes, stageLabel) because they are the production object graph, and
// rebuilding a second mock GitHub would measure the mock rather than the code.
// That reuse is a DEPENDENCY: if those helpers are wrong, so is this file. What
// is NOT reused is the expectation set — every cell states its own predicted
// outcome, and the terminal list below is written out rather than imported.

import (
	"fmt"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// issueState reads the mock issue's GitHub state under its own lock. Declared
// here rather than added to the mock so that the probe does not edit the file
// it is probing.
func (f *labelWriteFixture) issueState() string {
	f.issue.mu.Lock()
	defer f.issue.mu.Unlock()
	return f.issue.state
}

// auditTerminals is the audit's own list, written out rather than imported from
// the code under test. A check that derives its universe from the thing it is
// checking cannot falsify it.
func auditTerminals() []task.Stage {
	return []task.Stage{
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	}
}

// allAuditScopes is every scope the transition table can demand, so a request
// under it is limited only by what the code CHOOSES to write.
func allAuditScopes() []string {
	return append(agentScopes(),
		server.ScopeTaskClose, server.ScopeTaskAccept, server.ScopeTaskClaim)
}

// TestAuditR5_PositiveControl_TheProbeCanObserveAnAllow runs FIRST in reading
// order for a reason. The round-4 audit's first attempt at this class reported
// a clean sweep of denials that turned out to be a property of its request
// shape — it had picked dest=working, which UpdateTask rejects up front with
// InvalidArgument, so nothing it sent could ever have been allowed.
//
// If any arm here fails, every DENIED below is vacuous.
func TestAuditR5_PositiveControl_TheProbeCanObserveAnAllow(t *testing.T) {
	t.Run("add_labels_shape_can_succeed", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if err := f.addLabels(agentScopes(), "bug"); err != nil {
			t.Fatalf("CONTROL FAILED: add_labels[bug] on an accepted task was refused (%v); "+
				"the add_labels shape cannot express an ALLOW and every denial measured "+
				"through it is vacuous", err)
		}
	})

	t.Run("remove_labels_shape_can_succeed", func(t *testing.T) {
		// The removal matrix below is all denials, so it needs its own allow.
		f := openIssue(t, stageLabel(task.StageAccepted), "bug")
		if err := f.removeLabels(agentScopes(), "bug"); err != nil {
			t.Fatalf("CONTROL FAILED: remove_labels[bug] was refused (%v); the removal "+
				"matrix cannot express an ALLOW and its denials are vacuous", err)
		}
	})

	t.Run("stage_shape_can_succeed", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		inReview := pb.TaskStage_TASK_STAGE_IN_REVIEW
		if _, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
			Id: f.taskID, Stage: &inReview,
		}); err != nil {
			t.Fatalf("CONTROL FAILED: UpdateTask(stage=in_review) from accepted was refused "+
				"(%v); the stage-arm shape cannot express an ALLOW", err)
		}
	})

	t.Run("terminal_destinations_are_reachable_when_the_scope_is_held", func(t *testing.T) {
		// Proving this is the specific control the round-4 audit lacked.
		for _, dest := range auditTerminals() {
			f := openIssue(t, stageLabel(task.StageAccepted))
			d := protoStage(t, dest)
			if _, err := f.svc.UpdateTask(
				scopedCtx(withScope(server.ScopeTaskClose)),
				&pb.UpdateTaskRequest{Id: f.taskID, Stage: &d},
			); err != nil {
				t.Fatalf("CONTROL FAILED: dest=%s is not reachable via UpdateTask even with "+
					"task:close (%v); denials naming it would be a property of the "+
					"destination, not of the gate", dest, err)
			}
		}
	})
}

// TestAuditR5_Charge1_RemovalDirection covers the direction the suite's other
// matrices do not: remove_labels[X] on a task labelled [X, Y], two DIFFERENT
// terminals. This erases a maintainer's decline while LEAVING a terminal label
// in place, so the precedence winner may not move at all. It is the shape a
// winner-comparison gate is blindest to.
//
// KEPT because every other removal test in this package operates on a
// SINGLE-terminal issue (openIssue with one stage label), where removal always
// empties the terminal set. None of them exercises removal from a two-terminal
// issue, so without this the set-comparison gate's behaviour on the removal
// side of a multi-terminal task rests on the add-side matrices by analogy.
//
// READ THIS BESIDE TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday. The
// twelve cells here are the case where X and Y resolve to DIFFERENT stages, so
// the set really changes and the write is charged. The seam test is the case
// where two labels resolve to the SAME stage, the set does not change, and the
// identical-looking removal is free. The pair of them is the boundary.
func TestAuditR5_Charge1_RemovalDirection(t *testing.T) {
	var denied, ungated int
	for _, x := range auditTerminals() {
		for _, y := range auditTerminals() {
			if x == y {
				continue
			}
			t.Run(fmt.Sprintf("remove_%s_from_%s_and_%s", x, x, y), func(t *testing.T) {
				f := openIssue(t, stageLabel(x), stageLabel(y))

				// BASELINE: both labels really are on the issue. Otherwise the
				// row is a single-terminal removal wearing a two-terminal name.
				if start := f.issue.currentLabels(); !containsLabel(start, stageLabel(x)) ||
					!containsLabel(start, stageLabel(y)) {
					t.Fatalf("BASELINE BROKEN: issue carries %v, want both %s and %s",
						start, stageLabel(x), stageLabel(y))
				}

				err := f.removeLabels(agentScopes(), stageLabel(x))
				if err == nil {
					ungated++
					t.Errorf("REMOVAL UNGATED: remove_labels[%s] from a task labelled [%s,%s] "+
						"succeeded with task:write. labels now %v",
						stageLabel(x), x, y, f.issue.currentLabels())
					return
				}
				denied++

				// The label survived the refusal. A denial that still wrote is
				// the whole finding again.
				if !containsLabel(f.issue.currentLabels(), stageLabel(x)) {
					t.Errorf("denied but %s was removed anyway; labels %v",
						stageLabel(x), f.issue.currentLabels())
				}
			})
		}
	}
	t.Logf("MEASURED removal direction: %d/12 denied, %d/12 ungated", denied, ungated)
	if denied+ungated != 12 {
		t.Fatalf("PROBE DID NOT COVER 12 CELLS: denied=%d ungated=%d", denied, ungated)
	}
}

// TestAuditR5_Charge4_FromEqualsToReachability enumerates the label-set
// cardinalities under which the from == to short-circuit still fires, and for
// each one records what the request actually WROTE.
//
// The short-circuit was load-bearing for the round-4 bypass, so the question is
// not "does it still exist" (it does, in TransitionScope) but "can it still be
// reached with a state change behind it".
//
// KEPT because no other test in this package enumerates the short-circuit's
// reachable cardinalities, and because the assertion it makes on the ALLOWED
// cells — that terminal-ness was neither created nor destroyed, and no
// closeIssue mutation was issued — is a write-effect check, not a scope check.
// The rest of the suite measures who is refused; this measures what gets
// written when nobody is refused.
func TestAuditR5_Charge4_FromEqualsToReachability(t *testing.T) {
	type cell struct {
		name        string
		labels      []string
		restamp     task.Stage
		wantAllowed bool
	}
	cells := []cell{
		{
			name:        "cardinality0_no_stage_labels_restamp_accepted",
			labels:      []string{"bug"},
			restamp:     task.StageAccepted,
			wantAllowed: true,
		},
		{
			name:        "cardinality0_nonterminal_label_restamp_itself",
			labels:      []string{stageLabel(task.StageAccepted)},
			restamp:     task.StageAccepted,
			wantAllowed: true,
		},
		{
			name:        "cardinality1_restamp_the_same_terminal",
			labels:      []string{stageLabel(task.StageCompleted)},
			restamp:     task.StageCompleted,
			wantAllowed: true,
		},
		{
			name:        "cardinality1_terminal_masked_by_a_nonterminal_restamp_itself",
			labels:      []string{stageLabel(task.StageWontFix), stageLabel(task.StageWorking)},
			restamp:     task.StageWontFix,
			wantAllowed: true,
		},
		{
			// F7 / audit A-3: a bare stock label sits beside a prefixed one and
			// is invisible to authorizationStage, which is prefix-gated.
			name:        "cardinality1_terminal_beside_a_bare_stock_label",
			labels:      []string{stageLabel(task.StageWontFix), "duplicate"},
			restamp:     task.StageWontFix,
			wantAllowed: true,
		},
		{
			// The B5 case: with two terminals present, from == to can hold for
			// at most one, so the other must fall to any->terminal.
			name:        "cardinality2_restamp_one_of_two",
			labels:      []string{stageLabel(task.StageWontFix), stageLabel(task.StageCompleted)},
			restamp:     task.StageCompleted,
			wantAllowed: false,
		},
		{
			name: "cardinality4_restamp_one_of_four",
			labels: []string{
				stageLabel(task.StageCompleted), stageLabel(task.StageWontFix),
				stageLabel(task.StageDuplicate), stageLabel(task.StageCancelled),
			},
			restamp:     task.StageCancelled,
			wantAllowed: false,
		},
	}

	sawAllow, sawDeny := false, false
	for _, c := range cells {
		t.Run(c.name, func(t *testing.T) {
			f := openIssue(t, c.labels...)
			before := append([]string(nil), f.issue.currentLabels()...)
			dest := protoStage(t, c.restamp)

			_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
				Id: f.taskID, Stage: &dest,
			})
			allowed := err == nil
			if allowed {
				sawAllow = true
			} else {
				sawDeny = true
			}

			after := f.issue.currentLabels()
			t.Logf("MEASURED %s: allowed=%v closes=%d labels %v -> %v (err=%v)",
				c.name, allowed, f.issue.closes(), before, after, err)

			if allowed != c.wantAllowed {
				t.Errorf("%s: allowed=%v want %v (err=%v)", c.name, allowed, c.wantAllowed, err)
			}

			// The charge: whenever from == to DID fire, nothing a task:write
			// token should not be able to write may have been written.
			if allowed {
				if f.issue.closes() != 0 {
					t.Errorf("%s: from == to fired AND the issue was closed (%d closeIssue "+
						"calls). The short-circuit is writing lifecycle state.",
						c.name, f.issue.closes())
				}
				wasTerminal := labelSetNamesATerminal(before)
				isTerminal := labelSetNamesATerminal(after)
				if wasTerminal != isTerminal {
					t.Errorf("%s: a task:write request moved terminal-ness %v -> %v "+
						"(labels %v -> %v)", c.name, wasTerminal, isTerminal, before, after)
				}
			}
		})
	}
	if !sawAllow || !sawDeny {
		t.Fatalf("VACUOUS: sawAllow=%v sawDeny=%v", sawAllow, sawDeny)
	}
}

// labelSetNamesATerminal is the audit's own terminal test, spelled out rather
// than taken from the mapper, so this assertion does not derive from the code
// it is checking.
//
// NOTE FOR THE COMBINE: the "ft:" here is deliberately hardcoded and is NOT a
// call into the prefix resolution leg A is unifying. That is the point — it is
// an independent restatement. If leg A's change makes this wrong, the right
// response is to update this literal knowingly, not to route it through the
// resolver and lose the independence.
func labelSetNamesATerminal(labels []string) bool {
	for _, l := range labels {
		for _, s := range auditTerminals() {
			if equalFoldASCII(l, "ft:stage/"+s.String()) {
				return true
			}
		}
	}
	return false
}

func equalFoldASCII(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		x, y := a[i], b[i]
		if 'A' <= x && x <= 'Z' {
			x += 32
		}
		if 'A' <= y && y <= 'Z' {
			y += 32
		}
		if x != y {
			return false
		}
	}
	return true
}

// TestAuditR5_Charge4_REV9PremiseAdversarially attacks the premise REV9 rests
// on. REV9 asserts closeCalls == 0 after a from == to restamp and concludes
// that UpdateTask never closes or reopens an issue.
//
// closeCalls == 0 is only evidence if the counter CAN reach 1. A mock that
// never increments — because the mutation it matches on was renamed, or because
// the close travels as a field on updateIssue rather than as its own mutation —
// would report 0 for a real close, and REV9 would be green for the wrong
// reason. So: prove the counter works, then assert the stronger property the
// counter is a proxy for, namely that the ISSUE STATE did not move.
//
// KEPT, and it is the highest-value test in the salvage. It is the only place
// in the package that validates a mock counter before relying on it, and the
// issue-state assertion is strictly stronger than the counter it replaces: it
// would also catch a close carried as a field on updateIssue, which no counter
// on closeIssue can see. The pattern generalises beyond #194.
func TestAuditR5_Charge4_REV9PremiseAdversarially(t *testing.T) {
	t.Run("control_the_close_counter_can_reach_one", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if f.issue.closes() != 0 {
			t.Fatalf("fixture did not start at 0 closes")
		}
		closeStage := pb.TaskStage_TASK_STAGE_COMPLETED
		_, err := f.svc.CloseTask(scopedCtx(withScope(server.ScopeTaskClose)),
			&pb.CloseTaskRequest{Id: f.taskID, Stage: &closeStage})
		if err != nil {
			t.Fatalf("CONTROL FAILED: CloseTask errored (%v); the counter cannot be shown "+
				"to increment, so closeCalls == 0 elsewhere proves nothing", err)
		}
		if f.issue.closes() != 1 {
			t.Fatalf("CONTROL FAILED: CloseTask ran but closeCalls = %d, want 1. REV9's "+
				"assertion is vacuous: the mock cannot observe a close.", f.issue.closes())
		}
	})

	t.Run("update_task_never_moves_issue_state_on_any_stage_destination", func(t *testing.T) {
		dests := []task.Stage{
			task.StageTriage, task.StageAccepted, task.StageInReview,
			task.StageInQa, task.StageDeploying,
			task.StageCompleted, task.StageWontFix,
			task.StageDuplicate, task.StageCancelled,
		}
		for _, d := range dests {
			t.Run("open_to_"+d.String(), func(t *testing.T) {
				f := openIssue(t, stageLabel(task.StageAccepted))
				dest := protoStage(t, d)
				// Hand it every scope: the question is what UpdateTask WRITES
				// when it is allowed to proceed, not whether it is authorized.
				_, err := f.svc.UpdateTask(scopedCtx(allAuditScopes()),
					&pb.UpdateTaskRequest{Id: f.taskID, Stage: &dest})
				if err != nil {
					t.Fatalf("UpdateTask(stage=%s) errored with full scopes: %v", d, err)
				}
				if got := f.issue.closes(); got != 0 {
					t.Errorf("UpdateTask(stage=%s) issued %d closeIssue mutations", d, got)
				}
				if st := f.issueState(); st != "OPEN" {
					t.Errorf("UpdateTask(stage=%s) moved issue state to %q; REV9's premise "+
						"that UpdateTask never closes an issue is FALSE for this "+
						"destination", d, st)
				}
			})
		}
	})

	t.Run("update_task_never_reopens_a_closed_issue", func(t *testing.T) {
		for _, d := range []task.Stage{task.StageAccepted, task.StageInReview, task.StageTriage} {
			t.Run("closed_to_"+d.String(), func(t *testing.T) {
				f := newLabelWriteFixture(t, "CLOSED", "completed",
					stageLabel(task.StageCompleted))
				dest := protoStage(t, d)
				if _, err := f.svc.UpdateTask(scopedCtx(allAuditScopes()),
					&pb.UpdateTaskRequest{Id: f.taskID, Stage: &dest}); err != nil {
					t.Fatalf("UpdateTask(stage=%s) on a closed issue errored: %v", d, err)
				}
				if st := f.issueState(); st != "CLOSED" {
					t.Errorf("UpdateTask(stage=%s) REOPENED a closed issue (state now %q); "+
						"the closed-issue floor does not hold", d, st)
				}
			})
		}
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPPED FROM THE SALVAGE — seven of eleven, with reasons.
//
// Listed rather than deleted silently so a later round can overturn the
// judgement without re-reading commit 0075526.
//
//  1. Charge1_ShapeA_AddLabelSwap — DUPLICATE. Same 12 ordered pairs, same
//     add_labels[Y]-on-[X] shape, same task:close differential as the
//     pre-existing TestUpdateTask_AddingASecondTerminalLabelRequiresClose.
//     Landing it would double the runtime of the most expensive matrix in the
//     package for no new information.
//
//  2. Charge1_ShapeB_NoLabelWriteReAssertion — DUPLICATE of the pre-existing
//     TestUpdateTask_ReAssertingATerminalStageOnAMultiTerminalTaskRequiresClose,
//     which is also 12 cells and also asserts gated==12.
//
//  3. Charge5_CreateTaskResidualPrivilegeConsequence — SUPERSEDED AND NOW
//     FALSE. It asserts the CreateTask label hole is OPEN ("CreateTask via
//     labels was refused ... the residual may have been closed, in which case
//     this probe and the developer's pin both need updating"). Round 6 B1
//     closed it, so the test now fails by design. Its successor is
//     authz_create_task_label_scope_test.go. It also would not compile: it
//     calls store.LifecycleStages with the single-return signature that B4
//     replaced. The auditor predicted its own obsolescence in the failure
//     message, which is why this is a clean drop rather than a judgement call.
//
//  4. Charge5_CreateTaskUnprefixedAndCustomPrefix — MEASURES NOTHING, by its
//     author's own annotation. One subtest is named
//     "custom_prefix_deployment_FIXTURE_CANNOT_EXPRESS_THIS" because
//     labelNamesToIDs silently drops non-ft: labels; the other only t.Logf's.
//     Neither asserts. Importing a test that cannot fail is importing coverage
//     theatre.
//
//  5. Charge5_InsertTasksAfterIsTheSecondUnguardedCreationVerb — WITHDRAWN
//     FINDING, and the test body is a single t.Logf with no assertion. The
//     auditor filed this from a static read and withdrew it after measuring
//     Unimplemented on the pass-through store. The knowledge is worth keeping;
//     a test that cannot fail is not how to keep it, and re-landing it risks
//     reading as a re-file of a withdrawn finding. Recorded in the project log
//     instead.
//
//  6. Charge6_CustomPrefixEndToEnd — GOOD TEST, WRONG TREE. A real 12-cell
//     control proving the gate holds at a non-default push_prefix, which is
//     genuinely valuable now that push_prefix is a security parameter. But leg
//     A is unifying prefix resolution across reader and writer in this same
//     round, and this test asserts current prefix behaviour from
//     internal/server. Landing it here means my file would break their change
//     at combine time. RECOMMENDED FOR THE COMBINED TREE — see the project log.
//
//  7. Charge6_DefaultPrefixLabelsAreInertUnderACustomPrefix — same prefix-flux
//     problem as (6), and additionally asserts nothing: both observations are
//     t.Logf only.
//
// ─────────────────────────────────────────────────────────────────────────────
