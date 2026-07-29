package server_test

// AUDIT PROBE — #194 round 5 security audit, leg: security.
// Written by the audit leg at ea8ac390dad3d2401d65608684e5d6623ab15ac5.
//
// HARNESS PROVENANCE: this file reuses the fixture helpers declared in
// authz_label_write_scope_test.go (labelWriteFixture, openIssue, scopedCtx,
// agentScopes, stageLabel, requireDeniedFor) because they are the production
// object graph and rebuilding a second mock GitHub would measure my mock rather
// than the code. That reuse is a DEPENDENCY and is disclosed in the report: if
// those helpers are wrong, so is this file. What is NOT reused is the
// expectation set -- every cell below states its own predicted outcome, and
// every negative result is paired with a positive control that must observe an
// ALLOW through the identical request shape.

import (
	"context"
	"fmt"
	"testing"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
	"github.com/farmtable-io/farmtable/internal/server"
	"github.com/farmtable-io/farmtable/internal/store"
	"github.com/farmtable-io/farmtable/internal/store/ent"
	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// issueState reads the mock issue's GitHub state under its own lock. It is
// declared here rather than added to the mock so that this probe does not edit
// the file it is auditing.
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

// ── CHARGE 1: is the terminal->terminal class actually closed? ──

// TestAuditR5_PositiveControl_TheProbeCanObserveAnAllow runs FIRST in reading
// order for a reason. The round-4 audit's first attempt at this class reported
// a clean sweep of denials that turned out to be a property of its request
// shape -- it had picked dest=working, which UpdateTask rejects up front with
// InvalidArgument, so nothing it sent could ever have been allowed.
//
// This asserts the three allow-shapes the charge-1 tables depend on. If any of
// them fails, every DENIED below is vacuous and the report must say so.
func TestAuditR5_PositiveControl_TheProbeCanObserveAnAllow(t *testing.T) {
	t.Run("add_labels_shape_can_succeed", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		// A label edit that induces no lifecycle transition must be allowed on
		// the bare agent token, through the exact call the deny-cells use.
		if err := f.addLabels(agentScopes(), "bug"); err != nil {
			t.Fatalf("CONTROL FAILED: add_labels[bug] on an accepted task was refused (%v); "+
				"the add_labels shape cannot express an ALLOW and every denial measured "+
				"through it is vacuous", err)
		}
		t.Log("CONTROL OK: the add_labels request shape can be allowed")
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
		t.Log("CONTROL OK: the UpdateTask(stage=...) request shape can be allowed")
	})

	t.Run("terminal_destinations_are_reachable_when_the_scope_is_held", func(t *testing.T) {
		// The destinations charge 1 uses are not rejected up front the way
		// dest=working is. Proving that is the specific control the round-4
		// audit lacked.
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
		t.Log("CONTROL OK: all four terminal destinations are reachable via UpdateTask")
	})
}

// TestAuditR5_Charge1_ShapeA_AddLabelSwap reproduces, independently, the first
// shape the round-4 audit measured at 03ab6b6: a task labelled X, and
// add_labels[Y] for a different terminal Y. Round 4 measured 6 of 12
// converting. The developer claims 12 of 12 are now gated.
//
// Each cell is measured twice: once on the bare agent token (must DENY naming
// task:close) and once with task:close added (must ALLOW). The second run is
// the differential that stops a blanket denial -- a gate that refused
// everything, including the legitimate request -- from reading as a fix.
func TestAuditR5_Charge1_ShapeA_AddLabelSwap(t *testing.T) {
	var denied, allowedWithClose, converted int
	for _, from := range auditTerminals() {
		for _, to := range auditTerminals() {
			if from == to {
				continue
			}
			name := fmt.Sprintf("%s_to_%s", from, to)
			t.Run(name, func(t *testing.T) {
				// (1) bare task:write must be refused.
				f := openIssue(t, stageLabel(from))
				err := f.addLabels(agentScopes(), stageLabel(to))
				if err == nil {
					converted++
					t.Errorf("CONVERSION STILL OPEN %s: add_labels[%s] on a task labelled %s "+
						"succeeded with task:write alone. lifecycle=%v labels=%v",
						name, stageLabel(to), stageLabel(from),
						f.lifecycleStage(t), f.issue.currentLabels())
					return
				}
				requireDeniedFor(t, err, server.ScopeTaskClose, "add_labels "+name)
				denied++

				// (2) the same request with task:close must be ALLOWED, or the
				// denial above is a blanket refusal rather than a scope gate.
				g := openIssue(t, stageLabel(from))
				if err := g.addLabels(withScope(server.ScopeTaskClose), stageLabel(to)); err != nil {
					t.Errorf("DIFFERENTIAL FAILED %s: with task:close the same add_labels was "+
						"still refused (%v); the cell proves nothing about scope", name, err)
					return
				}
				allowedWithClose++
			})
		}
	}
	t.Logf("MEASURED shape A (add_labels[Y] on a task labelled X): %d/12 denied naming "+
		"task:close, %d/12 allowed once task:close is held, %d/12 converted with task:write",
		denied, allowedWithClose, converted)
	if denied+converted != 12 {
		t.Fatalf("PROBE DID NOT COVER 12 CELLS: denied=%d converted=%d", denied, converted)
	}
	if allowedWithClose == 0 {
		t.Fatalf("VACUOUS: no cell was ever allowed, so the denials measure the request "+
			"shape and not the gate")
	}
}

// TestAuditR5_Charge1_ShapeB_NoLabelWriteReAssertion reproduces the second and
// nastier shape: a task labelled [X, Y] and UpdateTask(stage=Y) -- the attacker
// writes NO label at all and merely re-asserts a stage the task already names.
// Round 4 measured 6 of 12 converting, three of which the brief spells out.
//
// The payload is not the stage field. It is that StageLabelSwap then STRIPS X:
// the maintainer's decline is erased. Each cell therefore also measures whether
// X survived, so an "allowed" cell is reported with its actual state change.
func TestAuditR5_Charge1_ShapeB_NoLabelWriteReAssertion(t *testing.T) {
	var denied, allowedWithClose, converted int
	for _, x := range auditTerminals() {
		for _, y := range auditTerminals() {
			if x == y {
				continue
			}
			name := fmt.Sprintf("labelled_%s_and_%s__restamp_%s", x, y, y)
			t.Run(name, func(t *testing.T) {
				f := openIssue(t, stageLabel(x), stageLabel(y))
				dest := protoStage(t, y)

				_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id: f.taskID, Stage: &dest,
				})
				if err == nil {
					converted++
					survived := containsLabel(f.issue.currentLabels(), stageLabel(x))
					t.Errorf("CONVERSION STILL OPEN %s: UpdateTask(stage=%s) with task:write "+
						"alone, writing no label. %s label survived=%v, labels now %v, "+
						"lifecycle=%v", name, y, x, survived,
						f.issue.currentLabels(), f.lifecycleStage(t))
					return
				}
				requireDeniedFor(t, err, server.ScopeTaskClose, "restamp "+name)
				denied++

				// Differential: with task:close the same call must go through.
				g := openIssue(t, stageLabel(x), stageLabel(y))
				d2 := protoStage(t, y)
				if _, err := g.svc.UpdateTask(
					scopedCtx(withScope(server.ScopeTaskClose)),
					&pb.UpdateTaskRequest{Id: g.taskID, Stage: &d2},
				); err != nil {
					t.Errorf("DIFFERENTIAL FAILED %s: still refused with task:close (%v)",
						name, err)
					return
				}
				allowedWithClose++
			})
		}
	}
	t.Logf("MEASURED shape B (UpdateTask(stage=Y) on a task labelled [X,Y], no label write): "+
		"%d/12 denied naming task:close, %d/12 allowed once task:close is held, "+
		"%d/12 converted with task:write", denied, allowedWithClose, converted)
	if denied+converted != 12 {
		t.Fatalf("PROBE DID NOT COVER 12 CELLS: denied=%d converted=%d", denied, converted)
	}
	if allowedWithClose == 0 {
		t.Fatalf("VACUOUS: no cell was ever allowed")
	}
}

// TestAuditR5_Charge1_RemovalDirection covers the direction the two tables
// above do not: remove_labels[X] on a task labelled [X, Y]. This erases a
// maintainer's decline while LEAVING a terminal label in place, so the
// precedence winner may not move at all. It is the shape a winner-comparison
// gate is blindest to.
func TestAuditR5_Charge1_RemovalDirection(t *testing.T) {
	var denied, converted int
	for _, x := range auditTerminals() {
		for _, y := range auditTerminals() {
			if x == y {
				continue
			}
			t.Run(fmt.Sprintf("remove_%s_from_%s_and_%s", x, x, y), func(t *testing.T) {
				f := openIssue(t, stageLabel(x), stageLabel(y))
				err := f.removeLabels(agentScopes(), stageLabel(x))
				if err == nil {
					converted++
					t.Errorf("REMOVAL UNGATED: remove_labels[%s] from a task labelled [%s,%s] "+
						"succeeded with task:write. labels now %v",
						stageLabel(x), x, y, f.issue.currentLabels())
					return
				}
				denied++
				t.Logf("MEASURED denied: %v", err)
			})
		}
	}
	t.Logf("MEASURED removal direction: %d/12 denied, %d/12 ungated", denied, converted)
}

// ── CHARGE 4: where can from == to still be reached, and does it write? ──

// TestAuditR5_Charge4_FromEqualsToReachability enumerates the label-set
// cardinalities under which the from == to short-circuit still fires, and for
// each one records what the request actually WROTE.
//
// The short-circuit was load-bearing for the round-4 bypass, so the question is
// not "does it still exist" (it does, in TransitionScope) but "can it still be
// reached with a state change behind it".
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
				// Terminal-ness must not have been created or destroyed by a
				// task:write request.
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
// than taken from the mapper, so that this assertion does not derive from the
// code it is checking.
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
// never increments -- because the mutation it matches on was renamed, or
// because the close travels as a field on updateIssue rather than as its own
// mutation -- would report 0 for a real close, and REV9 would be green for the
// wrong reason. So: prove the counter works, then assert the stronger property
// the counter is a proxy for, namely that the ISSUE STATE did not move.
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
		t.Log("CONTROL OK: closeCalls reaches 1 on a real close, so 0 is a measurement")
	})

	t.Run("update_task_never_moves_issue_state_on_any_stage_destination", func(t *testing.T) {
		// Drive EVERY destination UpdateTask accepts, from both an open and a
		// closed issue, and assert the issue state did not move. This is
		// stronger than closeCalls == 0: it would also catch a close carried as
		// a field on updateIssue, which the counter cannot see.
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
				t.Logf("MEASURED closed issue after UpdateTask(stage=%s): state=%q labels=%v",
					d, f.issueState(), f.issue.currentLabels())
			})
		}
	})
}

// allAuditScopes is every scope the transition table can demand, so that a
// request under it is limited only by what the code chooses to write.
func allAuditScopes() []string {
	return append(agentScopes(),
		server.ScopeTaskClose, server.ScopeTaskAccept, server.ScopeTaskClaim)
}

// ── CHARGE 5: the CreateTask residual, measured for privilege consequence ──

// TestAuditR5_Charge5_CreateTaskResidualPrivilegeConsequence takes the
// developer's disclosure past "the label lands" and measures whether the
// resulting task actually READS as terminal to the three consumers that matter.
//
// The classification under review is "residual, not blocker". A residual that
// reaches the same end state #194 was filed for, at creation time, with the
// same token, is not a residual.
func TestAuditR5_Charge5_CreateTaskResidualPrivilegeConsequence(t *testing.T) {
	f := openIssue(t, stageLabel(task.StageAccepted))
	ctx := context.Background()

	// Baseline: the task starts live, available and claimable.
	if av := f.availability(t); !av.Available {
		t.Fatalf("BASELINE BROKEN: the fixture task is not available to start with (%v)",
			av.Reasons)
	}
	t.Logf("BASELINE: lifecycle=%v available=%v", f.lifecycleStage(t), f.availability(t).Available)

	// The straight route is gated.
	completed := pb.TaskStage_TASK_STAGE_COMPLETED
	_, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
		CollectionId: f.collID.String(), Name: "direct", Stage: &completed,
	})
	requireDeniedFor(t, err, server.ScopeTaskClose, "BASELINE CreateTask(stage=completed)")

	// The label route.
	if _, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
		CollectionId: f.collID.String(), Name: "via labels",
		Labels: []string{stageLabel(task.StageCompleted)},
	}); err != nil {
		t.Fatalf("CreateTask via labels was refused (%v); the residual may have been closed, "+
			"in which case this probe and the developer's pin both need updating", err)
	}

	// THE MEASUREMENT the disclosure stops short of.
	lifecycle := f.lifecycleStage(t)
	avail := f.availability(t)
	t.Logf("MEASURED after CreateTask(labels=[%s]) with task:write only: labels=%v "+
		"lifecycle=%v available=%v reasons=%v",
		stageLabel(task.StageCompleted), f.issue.currentLabels(),
		lifecycle, avail.Available, avail.Reasons)

	terminalToAuthz := len(store.LifecycleStages(ctx, f.ms, mustSingleTask(t, f))) > 0 &&
		store.IsTerminalStage(lifecycle)

	if !terminalToAuthz {
		t.Logf("RESIDUAL IS NARROW: the created label does not read as terminal to the "+
			"authorization path (lifecycle=%v)", lifecycle)
		return
	}

	t.Logf("RESIDUAL REACHES THE #194 END STATE: lifecycle=%v (terminal), available=%v. "+
		"A task:write token has made a task read as finished.", lifecycle, avail.Available)

	// LIMIT OF THIS MEASUREMENT, disclosed rather than glossed. The mock is
	// SINGLE-ISSUE: its createIssue arm applies the requested labels to the one
	// issue it serves (see the comment on that arm). So the terminal reading
	// above was observed on the PRE-EXISTING task, not on a freshly created
	// one. In production createIssue makes a NEW issue, so what this actually
	// establishes is: (a) CreateTask attaches a caller-supplied terminal label
	// with task:write, and (b) a task carrying that label reads terminal and
	// unavailable and cannot be reverted without task:accept. It does NOT
	// establish that an attacker can terminal-ise a task they do not own. The
	// blast radius is a task the caller just created.

	// And the asymmetry that makes it an escalation rather than a wash: can the
	// same token undo it?
	undo := f.removeLabels(agentScopes(), stageLabel(task.StageCompleted))
	if undo == nil {
		t.Logf("MEASURED: the same token CAN undo it, so the residual is a round trip "+
			"rather than a one-way privilege gain")
	} else {
		t.Logf("MEASURED ONE-WAY: the token that created the terminal state CANNOT undo it "+
			"(%v). Creating costs task:write; reversing costs task:accept. That is the "+
			"exact asymmetry #194 was filed for.", undo)
	}
}

// TestAuditR5_Charge5_CreateTaskUnprefixedAndCustomPrefix checks whether the
// CreateTask residual is subject to B6 at all, and whether it follows a
// configured prefix.
func TestAuditR5_Charge5_CreateTaskUnprefixedAndCustomPrefix(t *testing.T) {
	t.Run("bare_stock_label_at_creation", func(t *testing.T) {
		f := openIssue(t, stageLabel(task.StageAccepted))
		if _, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
			CollectionId: f.collID.String(), Name: "stock", Labels: []string{"duplicate"},
		}); err != nil {
			t.Fatalf("CreateTask with a bare stock label errored: %v", err)
		}
		t.Logf("MEASURED bare stock label at creation: labels=%v lifecycle=%v available=%v",
			f.issue.currentLabels(), f.lifecycleStage(t), f.availability(t).Available)
	})

	// FIXTURE GAP, disclosed. The mock registers node IDs only for ft:-prefixed
	// stage labels plus whatever the fixture starts with, so a label spelled
	// "acme:stage/completed" is silently dropped by labelNamesToIDs and never
	// reaches the issue. The row below therefore measures NOTHING about B6 under
	// a custom prefix at creation time; it is retained with this note so the
	// gap is visible rather than read as a clean result.
	t.Run("custom_prefix_deployment_FIXTURE_CANNOT_EXPRESS_THIS", func(t *testing.T) {
		f := newLabelWriteFixtureWithPrefix(t, "acme:", "OPEN", "",
			prefixedStageLabel("acme:", task.StageAccepted))
		if _, err := f.svc.CreateTask(scopedCtx(agentScopes()), &pb.CreateTaskRequest{
			CollectionId: f.collID.String(), Name: "custom",
			Labels: []string{prefixedStageLabel("acme:", task.StageCompleted)},
		}); err != nil {
			t.Fatalf("CreateTask under a custom prefix errored: %v", err)
		}
		t.Logf("MEASURED custom prefix acme: at creation: labels=%v lifecycle=%v available=%v",
			f.issue.currentLabels(), f.lifecycleStage(t), f.availability(t).Available)
	})
}

// TestAuditR5_Charge5_InsertTasksAfterIsTheSecondUnguardedCreationVerb records
// that CreateTask is not the only write path to the value authorization reads.
//
// InsertTasksAfter takes only ScopeTaskWrite, hardcodes Stage: task.StageTriage
// (so it has no stage arm to gate at all), and passes step.GetLabels() straight
// through to the store, which by inspection makes it a second unguarded write
// path under invariant 1.
//
// MEASURED ANSWER: it is NOT reachable. The pass-through store returns
// Unimplemented for InsertTasksAfter, so on a GitHub-backed collection no label
// reaches an issue through this verb. On a native Ent collection the verb works
// but the stage lives in its own column and no label can forge it. So the
// static reading is right about the code and wrong about the exposure, and the
// finding is withdrawn rather than filed. Kept as the negative result, because
// "I checked this and it was not exploitable" is worth more to the next round
// than silence.
func TestAuditR5_Charge5_InsertTasksAfterIsTheSecondUnguardedCreationVerb(t *testing.T) {
	f := openIssue(t, stageLabel(task.StageAccepted))

	_, err := f.svc.InsertTasksAfter(scopedCtx(agentScopes()), &pb.InsertTasksAfterRequest{
		AnchorTaskId: f.taskID,
		CollectionId: f.collID.String(),
		Steps: []*pb.NewTaskSpec{{
			Name:   "inserted",
			Labels: []string{stageLabel(task.StageCompleted)},
		}},
	})
	t.Logf("MEASURED InsertTasksAfter(labels=[%s]) with task:write only: err=%v labels=%v "+
		"lifecycle=%v available=%v", stageLabel(task.StageCompleted), err,
		f.issue.currentLabels(), f.lifecycleStage(t), f.availability(t).Available)
}

// ── CHARGE 6: does the custom-prefix deployment get the same protection? ──

// TestAuditR5_Charge6_CustomPrefixEndToEnd runs the charge-1 shape A matrix
// again under a non-default push_prefix. B6 makes push_prefix load-bearing for
// security for the first time, so a control that only ever holds at "ft:" is
// a control whose security parameter is untested at every other value.
func TestAuditR5_Charge6_CustomPrefixEndToEnd(t *testing.T) {
	const prefix = "acme:"
	var denied, converted int
	for _, from := range auditTerminals() {
		for _, to := range auditTerminals() {
			if from == to {
				continue
			}
			t.Run(fmt.Sprintf("%s_to_%s", from, to), func(t *testing.T) {
				f := newLabelWriteFixtureWithPrefix(t, prefix, "OPEN", "",
					prefixedStageLabel(prefix, from))
				_, err := f.svc.UpdateTask(scopedCtx(agentScopes()), &pb.UpdateTaskRequest{
					Id: f.taskID, AddLabels: []string{prefixedStageLabel(prefix, to)},
				})
				if err == nil {
					converted++
					t.Errorf("CUSTOM-PREFIX CONVERSION OPEN %s->%s: add_labels[%s] allowed "+
						"with task:write. labels=%v lifecycle=%v", from, to,
						prefixedStageLabel(prefix, to), f.issue.currentLabels(),
						f.lifecycleStage(t))
					return
				}
				denied++
			})
		}
	}
	t.Logf("MEASURED custom prefix %q shape A: %d/12 denied, %d/12 converted",
		prefix, denied, converted)
	if denied+converted != 12 {
		t.Fatalf("PROBE DID NOT COVER 12 CELLS")
	}
}

// TestAuditR5_Charge6_DefaultPrefixLabelsAreInertUnderACustomPrefix is the
// exposure question stated positively: in a deployment configured with
// push_prefix "acme:", does a label spelled with the SHIPPED "ft:" prefix still
// feed an authorization answer? It must not -- and, symmetrically, it must not
// be silently honoured by one path and ignored by another.
func TestAuditR5_Charge6_DefaultPrefixLabelsAreInertUnderACustomPrefix(t *testing.T) {
	const prefix = "acme:"
	f := newLabelWriteFixtureWithPrefix(t, prefix, "OPEN", "",
		prefixedStageLabel(prefix, task.StageAccepted), "ft:stage/wont_fix")

	lifecycle := f.lifecycleStage(t)
	avail := f.availability(t)
	t.Logf("MEASURED deployment push_prefix=%q carrying a foreign \"ft:stage/wont_fix\": "+
		"labels=%v lifecycle=%v available=%v reasons=%v",
		prefix, f.issue.currentLabels(), lifecycle, avail.Available, avail.Reasons)

	// Removing the foreign label must not be gated as a lifecycle transition,
	// because under this configuration it never was one.
	err := f.removeLabels(agentScopes(), "ft:stage/wont_fix")
	t.Logf("MEASURED remove_labels[ft:stage/wont_fix] under push_prefix=%q: err=%v", prefix, err)
}

// mustSingleTask fetches the fixture's one task through the store, the way
// production readers see it.
func mustSingleTask(t *testing.T, f *labelWriteFixture) *ent.Task {
	t.Helper()
	tasks, _, err := f.ms.ListTasks(context.Background(), store.ListTasksParams{
		CollectionID: &f.collID,
	})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("ListTasks: err=%v n=%d", err, len(tasks))
	}
	return tasks[0]
}
