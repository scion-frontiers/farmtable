# em-ci state

Updated 2026-07-29 14:35Z

## Mandate
Green CI on main from a clean clone. Ten-item list in
/scion-volumes/scratchpad/projects/farmtable/briefs/em-ci.md
Deliverable 2 = /scion-volumes/scratchpad/projects/farmtable/status-ci.md (rewritten @43bd206).

## Where main is
- main = 43bd206. Run 30460294525 SUCCESS, all 15 steps, 43s.
- History: cc92735 -> faf1c8c (mainred) -> 7a2ad51 (manifest guards, WENT RED) -> 43bd206 (build+workflow+node22, GREEN).
- All ten items done. F10 done. Coordinator A/B/C/D done. F14 parked (false premise).

## Facts that cost something to learn
- Canary in the dev env does NOT prove the gate on the runner. Branch-first, always.
  Agent containers = node 20. ci.yml pins NODE_VERSION 22. That gap reddened main.
- node --test <dir>: 20 PASS / 22 FAIL. <glob>: 20 FAIL / 22 PASS. explicit files: both PASS.
- A positive control validates the tool, never the referent.
- Every fact states the SHA it was measured at (coordinator standing order).
- Canonical repo /workspace/farmtable is on task-state-web-ui-v2; do NOT switch its branch.
  Update main via git update-ref then git push origin main. Never force-push main.
- Legs cannot see /workspace/farmtable. Transfer via git bundle into
  /scion-volumes/scratchpad/projects/farmtable/transfer/.
- scion start: use PROJECT-RELATIVE -w, and pass prompts via -- "$(cat /tmp/file)".

## Constraints (standing)
- No directory/glob pathspec staging, ever. add -A/./-u, commit -a, stash -u forbidden.
- No credential values printed/logged/committed; no bare git remote listing.
- Do not delete web/dist; do not build a frontend in any other tree.
- Do not delete agents without coordinator sign-off.
- architect-reviewer IS OFF LIMITS - owner's independent advisor. No contact, no delete.
- AUTH ARCHITECTURE OUT OF SCOPE PROJECT-WIDE. Test: does it alter WHO IS AUTHENTICATED,
  WHAT THEY MAY DO, or HOW THAT IS DECIDED? If yes, stop and report to coordinator.
  Verified: cc92735..43bd206 touches no Dockerfile and no auth code.

## Legs
- farmtable-ci-workflow -> IN FLIGHT: 6 runner red-arm canary branches (canary/g1..g6)
  + close the tracked-dist hole (ci.yml:140 allows anything git tracks; git add -f defeats it).
  Hands me refs; I push, collect run IDs, hand back.
- ci-22-setup -> IN FLIGHT: rebase fix/ci-manifest-glob-runner onto 43bd206;
  land ONE shared node-20/22-safe web test runner (explicit file list, hard-fail on zero,
  manifest reconciles runner claim against independent enumeration).
- farmtable-ci-release -> IN FLIGHT: clean-clone verification at 43bd206 from the bundle.
  Must assert HEAD == 43bd206 before measuring.
- farmtable-ci-build -> done, idle. farmtable-mainred-fix -> done, idle. Do not delete either.

## Next
1. Push the six canary branches when ci-workflow hands refs; return run IDs; delete branches after.
2. Merge glob-runner + shared runner branch-first (runner canary), then FF main.
3. ci-release report -> only then is the clean-clone claim independently verified.
4. code-reviewer on cc92735..43bd206.
5. Update status-ci.md with the six run IDs, then task_completed.

## Peers
- farmtable-em-hardening: holding its legs pending the shared runner. Told them (a) is broken on 22.
- farmtable-em-task-state-model-v2: wrote web/scripts/run-node-tests.mjs; must re-rebase onto 43bd206.
- Push hold lifted for other tracks on this green (coordinator is telling them).
