#!/usr/bin/env python3
"""
test-194-r4-mutate.py — content-addressed mutation applier for the #194 round-4
test review.

Contract (standing bars 6 and 7 of the round-4 shared brief):
  * mutations are addressed BY CONTENT, never by line number;
  * the driver ABORTS if the anchor does not occur exactly once;
  * the pristine copy lives OUTSIDE the repository;
  * restore is byte-exact and verified by sha256, not by `git checkout`.

Usage:
    mutate.py apply  <mutation-name>
    mutate.py restore <mutation-name>
    mutate.py verify  <mutation-name>      # asserts file == pristine backup

Exit codes: 0 ok, 2 anchor not unique / not found, 3 verify mismatch.
"""
import hashlib
import os
import shutil
import sys

REPO = os.environ.get("FT194_REPO", "/workspace/farmtable-test-194")
BAK = os.environ.get("FT194_BAK", "/home/scion/ft194bak")

LABELS = "internal/platform/github/labels.go"
PASSTHROUGH = "internal/platform/github/passthrough.go"

# ---------------------------------------------------------------- mutations --

# M1: revert TerminalLabelStage to the round-3 delegation form.
M1_FROM = '''func (m *LabelMapper) TerminalLabelStage(labels []string) (task.Stage, bool) {
	if m == nil || !m.enabled {
		return "", false
	}

	present := make(map[task.Stage]bool, len(labels))
	for _, raw := range labels {
		if stage, ok := m.labelToStage[m.stripForMatch(raw)]; ok && store.IsTerminalStage(stage) {
			present[stage] = true
		}
	}

	// Resolve deterministically when an issue names several terminal stages.
	// Map iteration order is randomised, so returning "any of them" would make
	// an authorization answer differ run to run for one unchanged issue.
	for _, s := range terminalStagePrecedence {
		if present[s] {
			return s, true
		}
	}
	return "", false
}'''

M1_TO = '''func (m *LabelMapper) TerminalLabelStage(labels []string) (task.Stage, bool) {
	if m == nil {
		return "", false
	}
	stage, ok := m.MapLabelsToStage(labels)
	if !ok || !store.IsTerminalStage(stage) {
		return "", false
	}
	return stage, true
}'''

# M2: drop ONLY the !m.enabled half of the new guard, keeping the direct scan.
M2_FROM = "	if m == nil || !m.enabled {\n		return \"\", false\n	}\n\n	present := make(map[task.Stage]bool, len(labels))"
M2_TO = "	if m == nil {\n		return \"\", false\n	}\n\n	present := make(map[task.Stage]bool, len(labels))"

# M3: drop the deterministic tiebreak, return whichever terminal comes out of
# the map first. Kills determinism, keeps "is any terminal present".
M3_FROM = '''	// Resolve deterministically when an issue names several terminal stages.
	// Map iteration order is randomised, so returning "any of them" would make
	// an authorization answer differ run to run for one unchanged issue.
	for _, s := range terminalStagePrecedence {
		if present[s] {
			return s, true
		}
	}
	return "", false
}'''
M3_TO = '''	for s := range present {
		return s, true
	}
	return "", false
}'''

# M4: derive terminalStagePrecedence by FILTERING stagePrecedence -- the design
# the dev explicitly rejected. Behaviourally this REVERSES the tiebreak order
# (stagePrecedence's terminal tail is completed, wont_fix, duplicate, cancelled
# -- same order, so this should be behaviour-preserving; included as a control).
M4_FROM = '''var terminalStagePrecedence = []task.Stage{
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
}'''
M4_TO = '''var terminalStagePrecedence = []task.Stage{
	task.StageCancelled,
	task.StageDuplicate,
	task.StageWontFix,
	task.StageCompleted,
}'''

# M5: drop one terminal stage from the tiebreak table. TestTerminalStage
# PrecedenceCoversEveryTerminalStage claims to catch exactly this.
M5_FROM = '''var terminalStagePrecedence = []task.Stage{
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
	task.StageCancelled,
}'''
M5_TO = '''var terminalStagePrecedence = []task.Stage{
	task.StageCompleted,
	task.StageWontFix,
	task.StageDuplicate,
}'''

# M6: reorder stagePrecedence so a terminal stage ranks first (display rule
# violation). TestStagePrecedence_IsADisplayRuleTerminalStagesRankLast claims
# to catch this.
M6_FROM = '''var stagePrecedence = []task.Stage{
	task.StageWorking,
	task.StageInReview,'''
M6_TO = '''var stagePrecedence = []task.Stage{
	task.StageCompleted,
	task.StageWorking,
	task.StageInReview,'''

# M7: ComputeAvailability reads the display stage again.
M7_FROM = "	if store.IsTerminalStage(s.LifecycleStage(ctx, t)) || t.ClosedAt != nil {"
M7_TO = "	if store.IsTerminalStage(t.Stage) || t.ClosedAt != nil {"

# M8: claim gate reads the display stage again.
M8_FROM = "	if issueUnavailableForClaim(target, current, s.LifecycleStage(ctx, current)) {"
M8_TO = "	if issueUnavailableForClaim(target, current, current.Stage) {"

# M9: rewrite the claim gate's first arm from the positive `!= StageAccepted`
# whitelist to an IsTerminalStage check. This is the rewrite the dev's comment
# says would make the other 24 claim cells live.
M9_FROM = "	return lifecycleStage != task.StageAccepted ||"
M9_TO = "	return store.IsTerminalStage(lifecycleStage) ||"

SERVERGO = "internal/server/server.go"
AUTHZTEST = "internal/server/authz_terminal_reopen_test.go"

# M10: delete the lifecycleStage arm from the claim gate entirely. Proves the
# claim matrix's errors.Is(store.ErrUnavailable) assertion is bound to THIS
# gate and is not being laundered by some other ErrUnavailable source upstream
# (entstore.go returns the same sentinel in three places).
M10_FROM = "	return lifecycleStage != task.StageAccepted ||\n		t.ClosedAt != nil ||"
M10_TO = "	_ = lifecycleStage\n	return t.ClosedAt != nil ||"

# M11: neuter the UpdateTask transition-scope enforcement so every stage write
# is allowed. Tests whether the step-0 / precondition guards in the positive
# control and the self-service chain FAIL CLOSED rather than passing vacuously.
M11_FROM = """		if transitionScope := TransitionScope(string(authStage), string(st)); transitionScope != ScopeTaskWrite {
			if err := RequireScope(ctx, transitionScope); err != nil {
				return nil, err
			}
		}"""
M11_TO = """		if transitionScope := TransitionScope(string(authStage), string(st)); transitionScope != ScopeTaskWrite {
			_ = transitionScope
		}"""

# M12: make the mock fixture NON-STATEFUL -- addLabelsToLabelable silently does
# nothing. This is the round-3 fixture's defect reintroduced. The self-service
# chain test claims a self-check for exactly this; M12 tests that claim.
M12_FROM = """func (m *terminalLabelIssueMock) add(name string) {
	for _, l := range m.labels {
		if l == name {
			return
		}
	}
	m.labels = append(m.labels, name)
}"""
M12_TO = """func (m *terminalLabelIssueMock) add(name string) {
	_ = name
}"""

# M13: collapse the mask dimension back to the round-3 single-label schema.
# Every count pin in the server matrix should fire.
M13_FROM = """	return []string{
		"", // no mask: the round-3 schema, kept as the control
		stageLabel(task.StageTriage),
		stageLabel(task.StageAccepted),
		stageLabel(task.StageWorking),
		stageLabel(task.StageInReview),
		stageLabel(task.StageInQa),
		stageLabel(task.StageDeploying),
	}"""
M13_TO = """	return []string{
		"", // no mask: the round-3 schema, kept as the control
	}"""

# M14: delete the label-state-after-refusal assertion from the authz matrix.
# Tests whether that assertion is load-bearing or decorative.
M14_FROM = """					// The denial must not have been a no-op that also mutated
					// the issue: the terminal label must still be there.
					if got := issue.currentLabels(); !containsLabel(got, label) {
						t.Fatalf("UpdateTask %v -> %s was denied but the terminal label %q is "+
							"gone; labels now %v", labels, dest.name, label, got)
					}"""
M14_TO = """					_ = issue"""

# M15: reorder ClaimTask so the label swap runs BEFORE the availability gate.
# A realistic refactoring regression. It is the ONLY thing that can make the
# claim matrix's "a refused claim must not mutate the labels" assertion fire,
# so it is the test of whether that assertion is load-bearing or decorative.
M15_FROM = """	if issueUnavailableForClaim(target, current, s.LifecycleStage(ctx, current)) {
		return nil, store.ErrUnavailable
	}

	issueID := target.ID

	if err := s.ensureLabelIndex(ctx); err != nil {
		return nil, err
	}
	currentLabels := issueLabels(target)
	add, remove := s.mapper.StageLabelSwap(currentLabels, task.StageWorking)

	removeIDs := s.labelNamesToIDs(remove)
	if len(removeIDs) > 0 {
		_ = s.gql.removeLabels(ctx, issueID, removeIDs)
	}
	addIDs := s.labelNamesToIDs(add)
	if len(addIDs) > 0 {
		_ = s.gql.addLabels(ctx, issueID, addIDs)
	}
"""
M15_TO = """	issueID := target.ID

	if err := s.ensureLabelIndex(ctx); err != nil {
		return nil, err
	}
	currentLabels := issueLabels(target)
	add, remove := s.mapper.StageLabelSwap(currentLabels, task.StageWorking)

	removeIDs := s.labelNamesToIDs(remove)
	if len(removeIDs) > 0 {
		_ = s.gql.removeLabels(ctx, issueID, removeIDs)
	}
	addIDs := s.labelNamesToIDs(add)
	if len(addIDs) > 0 {
		_ = s.gql.addLabels(ctx, issueID, addIDs)
	}

	if issueUnavailableForClaim(target, current, s.LifecycleStage(ctx, current)) {
		return nil, store.ErrUnavailable
	}
"""

MUTATIONS = {
    "M15-claim-swap-before-gate": (PASSTHROUGH, M15_FROM, M15_TO),
    "M9-claim-arm-as-isterminalstage": (PASSTHROUGH, M9_FROM, M9_TO),
    "M10-claim-gate-drop-lifecycle-arm": (PASSTHROUGH, M10_FROM, M10_TO),
    "M11-neuter-updatetask-scope-gate": (SERVERGO, M11_FROM, M11_TO),
    "M12-nonstateful-mock-add": (AUTHZTEST, M12_FROM, M12_TO),
    "M13-collapse-mask-dimension": (AUTHZTEST, M13_FROM, M13_TO),
    "M14-drop-label-state-after-refusal": (AUTHZTEST, M14_FROM, M14_TO),
    "M1-revert-to-round3-delegation": (LABELS, M1_FROM, M1_TO),
    "M2-drop-enabled-guard": (LABELS, M2_FROM, M2_TO),
    "M3-nondeterministic-tiebreak": (LABELS, M3_FROM, M3_TO),
    "M4-reverse-terminal-precedence": (LABELS, M4_FROM, M4_TO),
    "M5-drop-cancelled-from-tiebreak": (LABELS, M5_FROM, M5_TO),
    "M6-terminal-first-in-stageprecedence": (LABELS, M6_FROM, M6_TO),
    "M7-availability-reads-display-stage": (PASSTHROUGH, M7_FROM, M7_TO),
    "M8-claimgate-reads-display-stage": (PASSTHROUGH, M8_FROM, M8_TO),
}


def sha(p):
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def pristine(rel):
    dst = os.path.join(BAK, os.path.basename(rel) + ".orig")
    if not os.path.exists(dst):
        raise SystemExit("no pristine backup at %s -- take it before mutating" % dst)
    return dst


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    cmd, name = sys.argv[1], sys.argv[2]
    if name not in MUTATIONS:
        raise SystemExit("unknown mutation %r; have %s" % (name, sorted(MUTATIONS)))
    rel, frm, to = MUTATIONS[name]
    path = os.path.join(REPO, rel)
    bak = pristine(rel)

    if cmd == "restore":
        shutil.copyfile(bak, path)
        if sha(path) != sha(bak):
            sys.exit(3)
        print("RESTORED %s sha=%s" % (rel, sha(path)))
        return

    if cmd == "verify":
        a, b = sha(path), sha(bak)
        print("verify %s: file=%s pristine=%s %s" % (rel, a, b, "MATCH" if a == b else "MISMATCH"))
        sys.exit(0 if a == b else 3)

    if cmd != "apply":
        raise SystemExit("unknown command %r" % cmd)

    # Always mutate from the pristine copy so mutations never stack.
    with open(bak) as f:
        src = f.read()
    n = src.count(frm)
    if n != 1:
        print("ABORT: anchor for %s occurs %d times in %s, want exactly 1" % (name, n, rel))
        sys.exit(2)
    out = src.replace(frm, to)
    if out == src:
        print("ABORT: replacement was a no-op for %s" % name)
        sys.exit(2)
    with open(path, "w") as f:
        f.write(out)
    print("APPLIED %s to %s (anchor unique) sha=%s" % (name, rel, sha(path)))


if __name__ == "__main__":
    main()
