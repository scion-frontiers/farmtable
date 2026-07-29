# Brief: Architect — Design Fix for Passthrough Stuck-Spinner Bug

## Critical constraints (read first)
- This is a DESIGN task, not implementation. Produce a fix design + a ready-to-dispatch EM
  brief. Do not write application code or open a PR.
- Read the full investigation report first — don't re-investigate from scratch.

## Context
An investigator diagnosed a live bug (collection
`466c2baa-334e-439c-b9f9-abbe89eb8aae` stuck on a loading spinner on the deployed
service). Full findings:
`/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-stuck-spinner-investigation.md`

Summary of root cause and secondary issues found:
1. **Primary bug (XS fix)**: `web/src/store/stream-manager.ts:12-21` — `isUnimplementedError()`
   checks for the string `'Unimplemented'`/`'code 12'` in the gRPC-Web error, but the
   server's `codes.Unimplemented` error for external-platform `WatchTasks` calls carries a
   custom status message (`'WatchTasks is not supported for external platform "github"
   collections; use polling instead'`) that doesn't contain those substrings. The frontend
   misclassifies this as a generic stream error, loops on reconnect forever, and never
   calls `snapshotComplete()` — so the loading spinner never clears and it never falls back
   to polling (which Feature B8, PR #103, already built for exactly this case).
2. **Secondary issue A (Small)**: `PlatformResolver` (from B3, PR #96) is defined but never
   wired into the production server's `main.go` via `SetResolver` — so even once the
   spinner issue is fixed, the passthrough mechanism may not actually resolve/route
   correctly in production.
3. **Secondary issue B (XS)**: this specific collection has no `LinkedAccount` — even with
   both above fixed, this collection specifically would need one created (via the CLI from
   PR #97, `ft collection link`) before it would show real GitHub data instead of an empty
   board.

## Task
1. Read the investigation report fully.
2. Design the fix for the primary bug: the correct approach is almost certainly to check
   the actual gRPC status CODE (not a string match on the message text) — investigate how
   the gRPC-Web client surfaces the numeric status code (should be accessible on the error
   object, not just its message) and design the corrected `isUnimplementedError()` (or
   equivalent) check. Confirm this doesn't just paper over the message-matching bug by
   special-casing this one message string — it needs to be robust to any future
   custom-message `Unimplemented` error.
3. Design the fix for wiring `PlatformResolver` into `main.go` (secondary issue A) — this
   is required for the passthrough feature to actually work in production, not just to fix
   the spinner.
4. Decide whether secondary issue B (creating a `LinkedAccount` for this specific
   collection) is in scope for the EM to do via CLI as a one-time data-fix, or whether it's
   out of scope (a follow-up for whoever owns this specific GitHub integration) — make an
   explicit call and justify it.
5. Write ONE EM-ready brief (following this project's established brief format/conventions
   — look at recent briefs under
   `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-em-f*.md` for the
   structure to mirror) covering all in-scope fixes as a single feature. Given the small
   size (XS + Small), this doesn't need to be split into multiple EM dispatches — one EM
   managing one PR (or a couple of small commits) is appropriate.
6. Note the `developer` template's known intermittent issue (see
   `/workspace/.coordinator-state.md` Standing Directives) in the brief you write, same as
   other recent briefs have.

## Deliverables
1. A design note (can be brief — this doesn't need a full design doc given the small
   scope) explaining your fix approach for the primary bug and the PlatformResolver wiring,
   plus your decision on the LinkedAccount question.
2. An EM-ready brief file at
   `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-em-passthrough-fix.md`.
3. A message to the coordinator with a summary and the brief file path.

## Direct contact
- Coordinator: `scion message coordinator "..."` when done, or if blocked.
- Do not message ptone@google.com directly — this is being shepherded through the
  coordinator per their request.

## Termination
Produce the design note and EM-ready brief at the paths above, message the coordinator, then
mark the task complete.
