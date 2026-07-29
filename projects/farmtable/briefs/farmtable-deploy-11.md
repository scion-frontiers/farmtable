# Brief: Deploy latest `main` to Cloud Run (deploy-11)

## Critical Constraints (read first)
- Do this in a dedicated git worktree, NOT the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-deploy-11 -b deploy-11-snapshot origin/main`
  (standing policy — avoids branch collisions with any other in-flight workstream).
- Do not merge/modify any code. This is a build+deploy+verify task only.
- **Use the new local-first protocol as your baseline reference** for what "Inspector
  scroll" and "main scroll" verification should look like — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md` and Feature 40's
  screenshots at
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-40-inspector-scroll/`
  for reference — but this deploy's verification must be against the LIVE Cloud Run URL
  (that's the whole point of this deploy: confirming what only live infra can prove, plus
  giving the user something to click on immediately).
- The coordinator will NOT independently re-read your diff or re-open your screenshots —
  your own verification is what stands. Be rigorous and honest.

## Context
Last deploy was rev `farmtable-00016-m5w` (commit `8dfd5b8`, includes Feature 39's main-
scroll fix). Since then, PR #112 (commit `8ac4bc0`) merged Feature 40: gives the Inspector
panel its own independent vertical scroll (it previously had none at all). This is the 4th
iteration of the scroll feature overall (F36 → F38 → F39 → F40) — the user has been testing
each one live, so get this deployed and verified promptly.

## Task
1. Confirm `git log --oneline origin/main` shows only PR #112 as new since `8dfd5b8`.
2. Build and deploy `main` HEAD to the existing `farmtable` Cloud Run service, project
   `deploy-demo-test`, region `us-central1` — same `gcloud builds submit` / `gcloud run
   deploy` pattern as prior deploys (check `deploy/2026-07-21-deploy-10.md` for exact
   commands/flags).
3. Verify the new revision is live and serving 100% traffic (`gcloud run services describe`
   + `curl`).
4. **Specifically verify Feature 40 on the LIVE site** with Playwright:
   - Open a collection with a task that has enough content in the Inspector to overflow
     vertically (long description, comments, expanded sections — check what Feature 40's
     dev used locally for reference, likely needs `ft task create`/similar to seed enough
     content if the live collection's tasks are too sparse).
   - Confirm the Inspector panel itself scrolls (real wheel/scroll event) and previously
     cut-off content becomes reachable.
   - Confirm `main`'s scroll (Feature 39) still works independently — scrolling `main`
     doesn't move the Inspector, scrolling the Inspector doesn't move `main`.
   - Confirm the toolbar/header stays fixed throughout (Feature 38).
   - Real screenshots for each of the above.
5. Report honestly if anything doesn't work as expected — this feature has needed several
   redos, don't rubber-stamp it.

## Deliverables
1. New Cloud Run revision live, 100% traffic, independently verified (gcloud + curl).
2. Real Playwright screenshots proving Feature 40's Inspector scroll AND Feature 39's main
   scroll both work correctly and independently on the LIVE deployed site. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-11/`
3. A deploy log at
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-22-deploy-11.md` (revision
   ID, commit SHA, what was verified, screenshot links).
4. A message to the coordinator with revision ID, commit SHA, and pass/fail on each item.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination
You MUST deploy, verify Feature 40 (and Feature 39 non-regression) live with real
screenshots, produce the log, and message the coordinator. Then signal task_completed.
