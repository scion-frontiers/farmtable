# dev-p2-assemble — put the Phase 2 web UI branch under CI

## Goal
Produce one branch containing all Phase 2 web UI work, rebased onto real main, so
that pushing it produces a real CI run.

## Facts you can rely on (measured, do not re-derive)
- Real main is `cc92735`. Canonical repo is `/workspace/farmtable`.
- The Phase 2 line is 39 commits ending at `633f8f2`.
- The round-5 fix pass added 5 more commits ending at `8fa5762`. These were
  UNREFERENCED objects in canonical until I anchored them at
  `refs/preserve/phase2-r5/attention-view-8fa5762`. The branch ref `attention-view`
  still points at `633f8f2` and is STALE. Start from the preserve ref, not the branch.
- `git rev-list --count 633f8f2..8fa5762` = 5.
- `.github/workflows/ci.yml` is PRESENT at `cc92735` and ABSENT at `8fa5762`. The 12
  commits you are missing are the entire CI stack. This is the whole point of the task:
  a branch without ci.yml produces NO CI run when pushed, and no run is
  indistinguishable from a green one.

## Your tree
Clone from the LOCAL PATH, never from the network remote:
  git clone --no-local /workspace/farmtable /tmp/p2/work
Work in `/tmp/p2/work`. Note `/tmp` is per-container, so nothing there survives you —
see Deliverables.

## Steps
1. Create branch `phase2-web-ui-r5` at `8fa5762`.
2. Rebase it onto `cc92735`.
3. Resolve conflicts. Expect them in `web/package.json`, `package-lock.json`,
   `tsconfig*.json` and possibly `Makefile`. For any test-list or script-list
   conflict, the resolution must be a UNION — this repo has previously lost a whole
   test suite to a conflict resolved by picking one side, and the suite stayed green
   while doing it. If you cannot form a union, stop and tell me rather than choosing.
4. Verify: `git rev-list --count phase2-web-ui-r5..cc92735` must be 0, and
   `git cat-file -e phase2-web-ui-r5:.github/workflows/ci.yml` must succeed.
5. Run the JS suite (`npm test` in `web/`). Report pass/fail counts as pasted output.
   Do NOT run `npm run build` — it is `tsc --noEmit && vite build` and vite build
   writes `web/dist`, which is forbidden. `npm test` is fine.
6. Report the rebase diff: `git diff 8fa5762..phase2-web-ui-r5 --stat`. If the rebase
   changed anything beyond conflict resolution, say so explicitly.

## Constraints
- NEVER stage with a directory or glob pathspec. Name every file. No `git add -A`,
  `git add .`, `git add -u`, `git commit -a`, `git stash -u`.
- Never print, log or commit a credential. No bare remote listing.
- Do not create `web/dist` anywhere. Do not delete `/workspace/farmtable/web/dist`.
- DO NOT PUSH to the network remote. I am the only one who does that.

## Deliverables — all three required
1. Branch `phase2-web-ui-r5` in your tree.
2. Because `/tmp` is per-container, PRESERVE your work into canonical before you
   finish, or it exists on exactly one disk:
     git push /workspace/farmtable phase2-web-ui-r5:refs/preserve/phase2/rebased-<sha>
   This is a push to a local filesystem path, not the network remote, and it is
   authorised. Then verify from the other side:
     git -C /workspace/farmtable cat-file -e <sha>
   Report the verification output, not just the push exit code.
3. A project log entry at `.design/project-log/phase2-rebase-onto-ci.md`, committed
   as a single named path, recording: the conflicts you hit, how you resolved each,
   and the test counts before and after.

## Termination
You MUST produce the branch, preserve it into canonical with a verified `cat-file -e`,
write the project log entry, and then mark the task complete. If the rebase is not
cleanly resolvable, that is a legitimate outcome — report exactly which files and stop.
Do not improvise a merge strategy I have not approved.
