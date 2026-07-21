# PR #68 Review — Add Inspector Comment Submission

**Branch:** `feat/inspector-add-comment` (3 commits)
**Reviewer:** Code Review Agent (R3)
**Date:** 2026-07-19

---

## Executive Summary

This PR adds a comment submission form to the Inspector panel's comments component, wiring `AddComment` through the gRPC and mock clients with proper validation, error handling, and optimistic-prepend ordering. The change is low-risk — the new code is well-structured, follows existing patterns precisely, and all builds and tests pass cleanly.

---

## Review Summary

**Verdict:** APPROVE

**Overview:** The PR adds three cohesive changes: (1) `addComment` to the `FarmTableServiceClient` interface and both implementations, (2) a textarea form with Ctrl/Cmd+Enter submission and empty-input validation in the LitElement component, and (3) closable `sl-alert` error feedback. The implementation is consistent with existing patterns (e.g., `createTask`, `updateTask`) and handles edge cases well.

### Critical Issues

None.

### Important Issues

1. **[web/src/gen/service.ts:479] Mock `addComment` appends instead of prepending**

   The `GrpcFarmTableClient.listComments` fetches with `SortOrder.DESC` (newest first), and `submitComment` prepends the new comment to the local array with `[comment, ...this.comments]`. However, `MockFarmTableClient.addComment` *appends* to `MOCK_COMMENTS[taskId]`, and `MockFarmTableClient.listComments` returns the array as-is (no reverse). This means after adding a comment in mock mode and then re-expanding the panel (triggering a fresh `listComments`), the order will be oldest-first — contradicting the production behavior and the component's prepend assumption.

   **Impact:** Mock/dev mode only; production gRPC path is correct. Could confuse developers testing locally.

   **Suggested Fix:**
   ```typescript
   // In MockFarmTableClient.addComment, line 479:
   MOCK_COMMENTS[taskId] = [comment, ...(MOCK_COMMENTS[taskId] ?? [])];
   ```
   Or alternatively reverse the array in `MockFarmTableClient.listComments`.

### Suggestions

1. **[ft-inspector-comments.ts:127] `as unknown as { value: string }` cast is brittle**

   The cast `(e.currentTarget as unknown as { value: string }).value` works but loses type safety. Shoelace's `SlTextarea` has a typed `value` property. A slightly cleaner approach:
   ```typescript
   private onDraftInput(e: Event) {
     const target = e.currentTarget as HTMLElement & { value: string };
     this.draft = target.value;
     ...
   }
   ```
   This is a minor style nit — the current version compiles and works correctly.

2. **[ft-inspector-comments.ts:214] Placeholder text is platform-specific**

   The placeholder says `"Ctrl+Enter to submit"` but the `onKeyDown` handler also accepts `metaKey` (Cmd on macOS). Consider `"Ctrl/Cmd+Enter to submit"` or detecting the platform:
   ```typescript
   placeholder=${navigator.platform?.includes('Mac') ? 'Cmd+Enter to submit' : 'Ctrl+Enter to submit'}
   ```
   This is a UX polish item, not a blocker.

3. **[ft-inspector-comments.ts:173] Comment count in summary only reflects locally-held list**

   After adding a comment, the count increments via optimistic prepend. If the server-side list has grown (e.g., another user added a comment), the count will be stale until the panel is collapsed and re-expanded. This is acceptable behavior for the current architecture (no live-reload on comments), but worth noting for future work.

4. **[ft-inspector-comments.ts:164] `authorName` could handle missing `author` defensively**

   The `authorName` method accesses `comment.author.name` directly. The `Comment` type guarantees `author: User`, but if the server ever returns a comment with a missing/null author (e.g., deleted user), this would throw. Consider:
   ```typescript
   private authorName(comment: Comment) {
     return comment.author?.name?.trim() || comment.author?.id || 'Unknown author';
   }
   ```
   Low probability issue given the typed interface, but cheap insurance.

### What's Done Well

- **Follows existing patterns precisely.** The `addComment` in `GrpcFarmTableClient` mirrors `createTask`/`updateTask` exactly — direct `toComment(response)` on the unary result, matching the `Comment` return type from the proto RPC. No redundant wrapping.

- **Correct optimistic update strategy.** Prepending `[comment, ...this.comments]` aligns with the `SortOrder.DESC` fetch order, avoiding a full refetch. Setting `this.loaded = true` after the first successful add is a nice touch — it ensures the empty-state message disappears even if the panel was opened on a task with no prior comments.

- **Robust error handling.** Three distinct error paths are covered: (a) empty-input validation before hitting the network, (b) `listComments` load errors, and (c) `addComment` submission errors. The `sl-alert` dismissal correctly clears `errorMessage` via `@sl-after-hide`, and typing in the textarea also clears errors — preventing stale error states.

- **Good keyboard handling.** `Ctrl/Cmd+Enter` submits, `e.preventDefault()` prevents a newline on submit, and Shift+Enter naturally inserts a newline (textarea default). Focus returns to the textarea after successful submission via `await this.updateComplete` — correctly waiting for Lit's render cycle.

- **State cleanup on task switch.** The `updated` lifecycle clears `draft` and `errorMessage` when `taskId` changes, preventing stale drafts from bleeding between tasks.

- **Double-submit guard.** The `this.submitting` flag prevents concurrent submissions, and the button's `?disabled` and `?loading` bindings give clear visual feedback.

### Verification Story

- **Tests reviewed:** No new tests added; this is a UI component without an existing test harness. The existing Go test suite passes — no server-side changes in this PR.
- **Build verified:** Yes. `tsc --noEmit && vite build` succeeds with zero errors. `go build ./...` succeeds.
- **Go tests:** All pass (`go test ./...`).
- **Lint/static analysis clean:** Yes. TypeScript strict mode passes via `tsc --noEmit`.
- **Security checked:** Yes. The `unsafeHTML(renderMarkdown(c.body))` path is safe — `renderMarkdown` uses `DOMPurify.sanitize(marked.parse(md))`. The `body` sent to `addComment` is a plain string trimmed client-side; server-side proto validation enforces `min_len = 1`. No credentials or secrets exposed. Comment body is rendered through the existing sanitized markdown pipeline — no new XSS surface.
