package server

import (
	"github.com/google/uuid"

	"github.com/farmtable-io/farmtable/internal/store/ent/task"
)

// Stage groups used by the transition→scope table. Every task stage belongs to
// exactly one group; the groups mirror the phase grouping in phaseForStage.
var (
	// stagesTriage is the intake group: work that has not been accepted yet.
	stagesTriage = newStageSet(task.StageTriage)

	// stagesAccepted is work that has been accepted into the queue.
	stagesAccepted = newStageSet(task.StageBacklog, task.StageReady)

	// stagesWorking is active ownership of a task.
	stagesWorking = newStageSet(task.StageWorking)

	// stagesHandoff covers the post-working handoff stages.
	stagesHandoff = newStageSet(task.StageInReview, task.StageInQa, task.StageDeploying)

	// stagesOnHold covers stages where work is paused.
	stagesOnHold = newStageSet(
		task.StageBlocked,
		task.StageWaitingForInput,
		task.StageDeferred,
		task.StageScheduled,
	)

	// stagesTerminal covers the closed stages.
	stagesTerminal = newStageSet(
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	)

	// stagesReopen is the set of stages a closed task may be reopened into.
	stagesReopen = newStageSet(task.StageTriage, task.StageBacklog)
)

// stageSet is a membership set of task stages.
type stageSet map[task.Stage]struct{}

func newStageSet(stages ...task.Stage) stageSet {
	set := make(stageSet, len(stages))
	for _, s := range stages {
		set[s] = struct{}{}
	}
	return set
}

// contains reports whether the stage is in the set. A nil set matches any stage.
func (s stageSet) contains(stage task.Stage) bool {
	if s == nil {
		return true
	}
	_, ok := s[stage]
	return ok
}

// transitionRule is one row of the transition→scope table. A nil from/to set
// matches any stage.
type transitionRule struct {
	from  stageSet
	to    stageSet
	scope string
	// reason documents the policy intent of the row.
	reason string
}

// transitionTable maps stage transitions to the scope required to perform them.
// Rules are evaluated in order and the first match wins, so the more specific
// rows come first. Any transition that matches no row requires task:write,
// which is the pre-RBAC-extension baseline for every stage change.
//
// Policy (Stage 4 scope vocabulary extension):
//
//	any         → terminal              : task:close
//	triage      → backlog/ready         : task:accept  (accepting work out of triage)
//	triage      → working/handoff       : task:accept  (bypass of the accept gate)
//	terminal    → triage/backlog        : task:accept  (reopen = re-accept)
//	terminal    → any other non-terminal: task:accept  (reopen = re-accept)
//	any         → working               : task:claim
//	working     → handoff               : task:write
//	any         → on hold               : task:write
var transitionTable = []transitionRule{
	{
		// Closing always wins: it is the most privileged transition, and it
		// applies from every stage including the terminal ones.
		from:   nil,
		to:     stagesTerminal,
		scope:  ScopeTaskClose,
		reason: "closing a task",
	},
	{
		from:   stagesTriage,
		to:     stagesAccepted,
		scope:  ScopeTaskAccept,
		reason: "accepting a task out of triage",
	},
	{
		// A task cannot enter working or a handoff stage straight from triage
		// without being accepted first; doing so would bypass the accept gate
		// that ClaimTask enforces.
		from:   stagesTriage,
		to:     union(stagesWorking, stagesHandoff),
		scope:  ScopeTaskAccept,
		reason: "starting work on a task still in triage implies accepting it",
	},
	{
		from:   stagesTerminal,
		to:     stagesReopen,
		scope:  ScopeTaskAccept,
		reason: "reopening a closed task is a re-accept",
	},
	{
		// Any other way out of a terminal stage is also a reopen.
		from:   stagesTerminal,
		to:     nil,
		scope:  ScopeTaskAccept,
		reason: "reopening a closed task is a re-accept",
	},
	{
		from:   nil,
		to:     stagesWorking,
		scope:  ScopeTaskClaim,
		reason: "taking ownership of a task",
	},
	{
		from:   stagesWorking,
		to:     stagesHandoff,
		scope:  ScopeTaskWrite,
		reason: "handing off work in progress",
	},
	{
		from:   nil,
		to:     stagesOnHold,
		scope:  ScopeTaskWrite,
		reason: "pausing work",
	},
}

// TransitionScope returns the scope required for a stage transition.
// The optional collectionID parameter is reserved for future per-collection
// policy binding (unused today).
func TransitionScope(fromStage, toStage string, collectionID ...uuid.UUID) string {
	_ = collectionID // reserved for per-collection policy binding

	from := task.Stage(fromStage)
	to := task.Stage(toStage)

	// A no-op stage set is an ordinary write, not a lifecycle transition.
	if from == to {
		return ScopeTaskWrite
	}

	for _, rule := range transitionTable {
		if rule.from.contains(from) && rule.to.contains(to) {
			return rule.scope
		}
	}

	// Unrecognized transitions keep the pre-extension requirement.
	return ScopeTaskWrite
}

// union returns the combined membership of the given stage sets.
func union(sets ...stageSet) stageSet {
	out := stageSet{}
	for _, s := range sets {
		for stage := range s {
			out[stage] = struct{}{}
		}
	}
	return out
}
