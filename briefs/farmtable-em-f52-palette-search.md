# Brief: Engineering Manager — Feature 52: Fix Command Palette Search (Title/Label Only, Fuzzy, Case-Insensitive)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f52 -b fix/f52-palette-search origin/main`
  (standing policy).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`.
- **Reference screenshot from ptone@google.com** (the coordinator has NOT looked at this
  image — you should look at it, that's your job):
  `/workspace/downloads/discord_1784743727_Screenshot_2026-07-22_at_6.12.57_AM.png` — shows
  a search miss (a query that should have matched a task by partial title match, but
  didn't).
- **Investigate first, then fix** — this is explicitly an investigate+fix task per
  ptone@google.com's framing ("investigation/fix project").
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: (a) reproduce the exact miss from the screenshot (or an
  equivalent partial-title-match query) and show it now succeeds, (b) confirm the palette
  no longer matches on full task BODY/description text (only title + label), (c) confirm
  case-insensitivity, (d) confirm fuzzy matching (e.g. a query with a typo or non-
  contiguous substring still matches a reasonably close title).
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec (ptone@google.com, verbatim)

"we want to start another investigation/fix project related to the quick-action palette.
Currently I think it is searching all task text, as well as not properly finding items that
are clearly doing a partial match on doc title. Screenshot attached showing search miss. We
only want to search title and label - and it should be case insensitive and fuzzy"

## Task

1. **Investigate the current search implementation** — find the command palette component
   (Feature 31, PR #82 — `ft-command-palette.ts` or similar) and its search/filter logic.
   Determine:
   - What fields does it currently search against? (Confirm/refute "searching all task
     text" — likely includes description/body, not just title.)
   - Why did the exact query from the screenshot fail to match a title it should have
     matched? Is there no fuzzy matching at all (exact substring only), a case-sensitivity
     bug, or something else (e.g. searching the wrong field, or a tokenization issue)?
2. **Implement the fix**:
   - Scope search to ONLY task title and labels (remove description/body/other fields from
     the search index, if currently included).
   - Case-insensitive matching.
   - Fuzzy matching — doesn't need to be a heavyweight library if a lightweight approach
     works (e.g. a simple fuzzy-subsequence matcher, or check if a small library is already
     a dependency and reusable); use your judgment on approach, document your choice. The
     goal is that reasonably-close partial/typo'd queries against title or label text
     surface the right tasks, without being so loose that it returns irrelevant noise —
     balance precision and recall sensibly.
3. Verify Feature 46's add-relationship mode of the command palette (which reuses this same
   search) still works correctly after your changes — don't regress it.

## Key Locations

- Repo: base off current `main` (through Feature 51) — fresh feature branch, PR to merge.
- Frontend: `web/src/` — the command palette component and its search logic (Feature 31,
  extended by Feature 46 for add-relationship mode).
- Reference screenshot:
  `/workspace/downloads/discord_1784743727_Screenshot_2026-07-22_at_6.12.57_AM.png`
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-52-palette-search-fix.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence per the 4 verification points above. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-52-palette-search-fix/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-52-palette-search-fix.md`
   documenting the root cause found and your fuzzy-matching approach.
4. A message to the coordinator with PR URL, summary, review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence per
the spec above, and message the coordinator. Then signal task_completed.
