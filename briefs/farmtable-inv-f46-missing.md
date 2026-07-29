# Brief: URGENT — Investigate Why Feature 46 Isn't Visible on Live Site

## Critical Constraints (read first)
- Use a dedicated git worktree: `git worktree add /workspace/farmtable-inv-f46 -b
  explore/f46-missing origin/main` (standing policy — farmtable-em-f48 is actively working
  in its own separate worktree right now, this is safe).
- Investigation only — don't fix anything yet, report findings first.
- ptone@google.com reports (2026-07-22 14:30, verbatim): "I'm not seeing Feature 46 on the
  live site? (no trash or add icons in relationships inspector)" — but
  farmtable-deploy-21 reported this feature (PR #123, commit 7a2e742, rev
  farmtable-00027-6hc) as fully verified and working via Playwright just minutes ago. This
  is a real discrepancy — treat the deploy agent's "PASS" as unconfirmed until you
  independently verify.

## Task
1. Confirm the CURRENTLY live Cloud Run revision: `gcloud run services describe farmtable
   --project deploy-demo-test --region us-central1 --format=json` — check it's actually
   `farmtable-00027-6hc` (or later) serving 100% traffic, and that its image was built from
   commit `7a2e742` or later. Rule out a revision/traffic-routing issue first (e.g. traffic
   not fully cut over, an old revision still serving some or all requests).
2. If the revision IS correct, open the live URL yourself and reproduce: open a task's
   Inspector, go to the Relationships tab, look for the trash-can icons and "+" button.
   Check browser console for JS errors that might prevent the new UI from rendering.
   Check if there's a browser caching issue (hard-check with cache disabled / incognito-
   style fresh Playwright context) vs. a genuine deploy/code issue.
3. If the code genuinely isn't there, check whether PR #123's actual diff includes the
   UI changes you'd expect (`gh pr diff 123` — check for the trash icon /
   add-relationship button in the relevant component) to rule out a merge issue (e.g. PR
   #123 merged cleanly but somehow the relevant file's changes got lost/reverted by a
   later commit, or deploy-21 built from a stale checkout).
4. Determine root cause: (a) deploy/traffic routing issue (old revision still serving), (b)
   browser cache on the user's end, (c) deploy-21's Playwright verification was a false
   positive (e.g. checked the wrong selector, or checked local instead of actually live),
   or (d) a genuine regression where the feature code isn't actually live despite the merge.

## Deliverables
1. A findings report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/f46-missing-investigation.md`
   with root cause and evidence (screenshots, gcloud output, console logs as relevant).
2. A message to the coordinator with the root cause and a clear recommendation (nothing
   needed / user should hard-refresh / needs a redeploy / needs a code fix).

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` with findings.
- Do not message ptone@google.com directly.

## Termination
You MUST determine the root cause and message the coordinator with a clear, evidence-backed
answer. Then signal task_completed.
