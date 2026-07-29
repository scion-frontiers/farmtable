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
	stagesAccepted = newStageSet(task.StageAccepted)

	// stagesWorking is active ownership of a task.
	stagesWorking = newStageSet(task.StageWorking)

	// stagesHandoff covers the post-working handoff stages.
	stagesHandoff = newStageSet(task.StageInReview, task.StageInQa, task.StageDeploying)

	// stagesTerminal covers the closed stages.
	stagesTerminal = newStageSet(
		task.StageCompleted,
		task.StageWontFix,
		task.StageDuplicate,
		task.StageCancelled,
	)
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
//	triage      → anything non-terminal : task:accept  (leaving triage is an accept)
//	terminal    → anything non-terminal : task:accept  (reopen = re-accept)
//	any         → working               : task:claim
//	working     → handoff               : task:write
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
		// Leaving triage in any direction other than closing is an accept.
		// Placed above the on-hold and claim rules so no destination stage can
		// be used to launder a task out of triage without task:accept.
		from:   stagesTriage,
		to:     nil,
		scope:  ScopeTaskAccept,
		reason: "any move out of triage is an accept",
	},
	{
		// Any way out of a terminal stage is a reopen.
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
