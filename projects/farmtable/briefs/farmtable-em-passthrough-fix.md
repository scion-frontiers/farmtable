# Brief: Engineering Manager — Passthrough Stuck-Spinner Fix

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total. If round 5 still has significant
    findings, stop anyway and report the unresolved findings honestly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-passthrough-fix-dev --type default <task>`
    — use `--type default` (NOT `--type developer` — the `developer` template
    is currently broken; hits a workspace-trust dialog then permanent
    "Not logged in" dead end regardless of harness flags).
  - Reviewer: `scion start farmtable-passthrough-fix-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
  - **Intermittent Hub timeout:** `scion start` calls currently hit a
    "context deadline exceeded" timeout on roughly 50% of first attempts.
    Always retry once immediately before concluding something is broken.
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **Verify, don't assume.** Check the developer's actual git diff/commits
  before reporting done.

## Context

A live bug: collection `466c2baa-334e-439c-b9f9-abbe89eb8aae` (platform:
`github`) shows an infinite loading spinner on the deployed dashboard. Full
investigation:
`/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-stuck-spinner-investigation.md`

Design note (read this — it explains why each fix is shaped the way it is and
what alternatives were considered):
`/scion-volumes/scratchpad/projects/farmtable/design-passthrough-fix.md`

**Root cause summary:** The server correctly returns gRPC `codes.Unimplemented`
(code 12) for `WatchTasks` on external-platform collections, but the frontend's
`isUnimplementedError()` in `stream-manager.ts` tries to detect this by
string-matching the error message rather than checking the numeric gRPC status
code. The server's custom status message doesn't contain any of the expected
substrings, so the error is misclassified as generic, the stream manager enters
an infinite reconnect loop, and the polling fallback (already built in PR #103)
never activates.

A secondary issue: `PlatformResolver` (built in PR #96) is never wired into the
production server's `main.go`, so lazy resolution of external platform stores is
dead code in production.

## Feature Spec

Two fixes in one PR (XS + Small scope):

### Fix 1: Typed gRPC errors (frontend — XS)

**Goal:** Make `isUnimplementedError()` check the numeric gRPC code, not the
message text.

**What to do:**

1. Create a `GrpcError` class that extends `Error` and carries a `code`
   property (the numeric `grpc.Code` value). This can live in `grpc-client.ts`
   or a new `grpc-error.ts` file — developer's choice.

   ```typescript
   // Illustrative — not copy-paste production code
   export class GrpcError extends Error {
     readonly code: grpc.Code;
     constructor(code: grpc.Code, message: string) {
       super(message);
       this.name = 'GrpcError';
       this.code = code;
     }
   }
   ```

2. Update `web/src/gen/grpc-client.ts` to use `GrpcError` instead of plain
   `Error` in both error-construction sites:
   - **Streaming** `onEnd` callback (line ~321-324): the `code` parameter is
     already available — pass it to `GrpcError`.
   - **Unary** `onEnd` callback (line ~369-370): `output.status` is the code —
     pass it to `GrpcError`.

3. Replace `isUnimplementedError()` in `web/src/store/stream-manager.ts`
   (lines 12-21) to check the code:

   ```typescript
   function isUnimplementedError(err: unknown): boolean {
     if (err instanceof GrpcError) {
       return err.code === grpc.Code.Unimplemented;  // === 12
     }
     return false;
   }
   ```

   **Remove all string-matching.** The fix must be robust to any future
   custom-message `Unimplemented` error — no `msg.includes(...)` patterns.

4. (Recommended) Add a small unit test for `isUnimplementedError` covering:
   - `GrpcError` with code 12 and a custom message → `true`
   - `GrpcError` with a different code (e.g. 13) → `false`
   - Plain `Error` → `false`
   - Non-Error value → `false`

### Fix 2: Wire PlatformResolver into production server (backend — Small)

**Goal:** Make `MultiStore` in the production server actually resolve
external-platform collections via `PlatformResolver`.

**What to do:**

1. In `cmd/farmtable-server/main.go`:
   - Add import: `"github.com/farmtable-io/farmtable/internal/platform/github"`
   - After line 47 (`s := store.NewMultiStore(entStore)`), add:
     `s.SetResolver(github.NewPlatformResolver())`

That's it. The resolver function already exists at
`internal/platform/github/resolver.go` and is tested in
`internal/server/passthrough_e2e_test.go`. This is a one-line wiring fix.

### NOT in scope: LinkedAccount creation

The specific collection `466c2baa-...` has no `LinkedAccount`, so even with
both fixes, it will show an empty board (no GitHub issues) instead of a spinner.
This is **correct behavior** — no credentials means no data. Creating the
LinkedAccount is an operational task requiring a GitHub PAT decision from the
project owner, not a code change. The architect explicitly scoped this out —
see the design note for rationale.

After this PR is deployed, a follow-up `ft collection link` command with an
appropriate PAT will make this collection work end-to-end.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` — use a fresh feature
  branch (e.g. `fix/passthrough-spinner`), PR to merge.
- **Frontend files to modify:**
  - `web/src/gen/grpc-client.ts` — lines ~321-324 (streaming `onEnd`) and
    ~369-370 (unary `onEnd`): replace `new Error(...)` with `new GrpcError(...)`
  - `web/src/store/stream-manager.ts` — lines 12-21: rewrite
    `isUnimplementedError()` to check numeric code
  - `web/node_modules/@improbable-eng/grpc-web/dist/typings/Code.d.ts` — for
    reference only (shows the `grpc.Code` enum, `Unimplemented = 12`)
- **Backend file to modify:**
  - `cmd/farmtable-server/main.go` — add import + `SetResolver` call after
    MultiStore creation
- **Reference files (read, don't modify):**
  - `internal/platform/github/resolver.go` — the resolver implementation
  - `internal/store/multistore.go` — `SetResolver` and `PlatformResolver` type
  - `internal/server/watch.go` — the two `codes.Unimplemented` return sites
  - `internal/server/passthrough_e2e_test.go` — shows resolver wiring in tests
- Investigation report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-stuck-spinner-investigation.md`
- Design note:
  `/scion-volumes/scratchpad/projects/farmtable/design-passthrough-fix.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions.

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Build and test evidence: `go test ./...` passes, frontend builds cleanly
   (`npm run build` or equivalent in `web/`).
3. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

Get the PR opened and pushed, verify build/tests pass, and message the
coordinator with the summary. Then signal task_completed. Do not delete your
developer agent until the coordinator confirms the merge landed or explicitly
tells you to clean up.
