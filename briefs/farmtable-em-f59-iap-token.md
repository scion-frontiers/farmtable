# Brief: Engineering Manager — Feature 59: x-farmtable-token Fallback Header (IAP Auth Fix)

## Critical Constraints (read first)

- **Use a dedicated git worktree**, not the shared `/workspace/farmtable` checkout:
  `git worktree add /workspace/farmtable-f59 -b feat/f59-iap-token-header origin/main`
  (standing policy — farmtable-em-f58 is actively working in its own worktree, this is
  safe).
- **Use the local-first verification protocol** — read
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md` for the local
  side. For the LIVE/IAP-specific verification, you'll need to actually test against the
  deployed, IAP-protected Cloud Run service — use the forwarding proxy tools at
  `/scion-volumes/scratchpad/projects/farmtable/tools/` (proxy-gcloud.sh /
  proxy-forwarder.py) if useful, or find another way to genuinely prove this works through
  IAP, not just locally where there's no IAP in the way.
- **Design doc is final and ready to implement** — read
  `/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md` in full before
  starting. Follow its implementation checklist.
- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `--type developer` should work; fall back to `--type default` if
  you hit the workspace-trust/"Not logged in" bug.
- **Real evidence required**: this feature's entire purpose is enabling access through
  IAP — a local-only test (no IAP in front) does NOT prove the fix works. You must verify
  against the actual deployed, IAP-protected instance using the `x-farmtable-token` header
  successfully authenticating a request that would otherwise be blocked/broken by the
  Authorization-header collision.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Context

ptone@google.com put the Cloud Run `farmtable` service behind IAP. IAP consumes the
`Authorization: Bearer` header for its own OIDC token, colliding with the Farmtable app's
own use of that same header for its `ft_...` API token — meaning the `ft` CLI and the
decomposer binary currently cannot authenticate against the IAP-protected live instance at
all (this was blocking `farmtable-architect-decomposer`'s attempt to run the decomposer
against the deployed instance).

`farmtable-architect-auth` designed the fix: add support for an `x-farmtable-token` gRPC
metadata key as a fallback the auth interceptor checks when `Authorization` isn't the app
token (i.e. when IAP has consumed it). Full design + implementation checklist:
`/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md`.

## Task

Follow the design doc's implementation checklist precisely:
1. Server-side: add `x-farmtable-token` gRPC metadata support to the auth interceptor
   (~30 lines in `auth.go` per the design doc — find the actual file).
2. Client-side: update the `ft` CLI (`connect.go` per the design doc) to send the token via
   `x-farmtable-token` metadata (in addition to or instead of `Authorization`, per the
   design doc's exact recommendation — read it, don't guess).
3. Update the decomposer's client (`writer.go` per the design doc) the same way.
4. Optionally update the web client per the design doc if it recommends it — check.
5. Add the 3 unit tests the design doc calls for.
6. **Verify against the LIVE IAP-protected instance**: run `ft` (or the decomposer) against
   the deployed Cloud Run URL using the new `x-farmtable-token` header, and confirm it
   successfully authenticates where it previously failed. This is the real proof the fix
   works — don't skip it or substitute a local-only test.

## Key Locations

- Design doc (authoritative — follow its checklist):
  `/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md`
- Repo: base off current `main` — fresh feature branch, PR to merge.
- Backend: wherever `auth.go` lives (check `internal/`).
- CLI: wherever `connect.go` lives for the `ft` CLI.
- Decomposer: `cmd/decomposer/` / `internal/decomposer/` — `writer.go`.
- Local testing protocol:
  `/scion-volumes/scratchpad/projects/farmtable/local-test-protocol.md`
- Forwarding proxy tools (if useful for live testing):
  `/scion-volumes/scratchpad/projects/farmtable/tools/`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-59-iap-token-header.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real evidence of successful authentication against the LIVE IAP-protected instance using
   the new header (exact commands + output). Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-59-iap-token-header/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-59-iap-token-header.md`.
4. A message to the coordinator with PR URL, summary, review outcome, and confirmation the
   decomposer can now reach the deployed instance.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Design questions: `scion message farmtable-architect-auth "<question>"` — that agent
  designed this and is available for clarification.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/evidence
(including real live-IAP verification), and message the coordinator. Then signal
task_completed.
