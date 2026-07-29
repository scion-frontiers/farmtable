# PR Review: fix/passthrough-spinner

**Verdict:** APPROVE

**Overview:** This PR fixes a stuck-spinner bug on external-platform collections by replacing fragile string-matching gRPC error detection with type-safe numeric code inspection, and wiring the GitHub platform resolver into the production server. Both changes are clean, well-scoped, and correctly address the root causes described in the project log.

---

## Critical Issues

None.

## Important Issues

### 1. Duplicated `isUnimplementedError` function
**[web/src/store/stream-manager.ts:14]** and **[web/src/util/grpc-error.ts:20]**

The `isUnimplementedError` function is defined identically in both files. `grpc-error.ts` exports it, but `stream-manager.ts` defines its own local copy instead of importing the shared one. This duplication is benign today but creates a maintenance hazard — a future change to the logic in one place may miss the other.

**Recommended fix:** Import from the utility module:
```diff
-import { GrpcError } from '../util/grpc-error.js';
+import { GrpcError, isUnimplementedError } from '../util/grpc-error.js';
```
…and remove the local function definition and `grpc` import in `stream-manager.ts` (the `grpc` import is only used for `grpc.Code.Unimplemented` inside the local copy).

### 2. Import ordering style in `grpc-client.ts`
**[web/src/gen/grpc-client.ts:5-6]**

The `import` and bare `export` re-export are placed between third-party imports and the project type-imports block:
```ts
import { GrpcError } from '../util/grpc-error.js';
export { GrpcError } from '../util/grpc-error.js';
import {
  type Change,
  ...
```

The existing convention in this file groups all `import` statements together, then other declarations. Placing a bare `export { ... }` in the middle of imports is unusual. A minor style nit, but it could confuse linters or future contributors.

**Recommended fix:** Move the re-export below the import block, or combine into:
```ts
import { GrpcError } from '../util/grpc-error.js';
// ... other imports ...

export { GrpcError };
```

## Suggestions

### 1. `code` property typed as `number` — consider `grpc.Code`
**[web/src/util/grpc-error.ts:8,10]**

The `code` field is typed `number` rather than `grpc.Code`. Since `grpc.Code` is a numeric enum, `number` is not incorrect and avoids forcing consumers to import the enum for comparisons. However, typing it as `grpc.Code` would give stronger IDE autocompletion and self-document valid values. This is a judgment call — `number` is the more flexible choice and keeps the class usable outside gRPC contexts. Fine either way.

### 2. Unicode dash cleanup
**[web/src/store/stream-manager.ts:77,92,95,127]**

The PR replaces escaped unicode `—` (em-dash) with literal `—` in comments and console messages. This is a positive cleanup but tangential to the fix. No issue — just noting it's cosmetic.

## What's Done Well

- **Root cause analysis is excellent.** The project log clearly explains both failure modes (string-matching fragility + missing production wiring) with a specific reproduction case (collection 466c2baa). This is exactly the kind of documentation that prevents regressions.

- **The `GrpcError` class is well-designed.** It extends `Error` properly (setting `.name`, preserving `.message`), uses `readonly` for immutability, and provides a sensible default message. With `target: ES2021`, `class extends Error` works correctly without the `Object.setPrototypeOf` workaround.

- **The backend fix is minimal and correct.** `s.SetResolver(github.NewPlatformResolver())` is placed exactly where it should be — after `NewMultiStore()` and before `defer s.Close()`. The `NewPlatformResolver()` gracefully returns `(nil, nil)` for non-GitHub platforms, so this won't break non-GitHub collections.

- **All error paths in `grpc-client.ts` are covered.** Both the streaming `onEnd` and unary `onEnd` callbacks now use `GrpcError`, so any consumer (not just `stream-manager.ts`) can inspect the gRPC status code.

- **Build and tests pass clean** — `go build ./...`, `go test ./...`, and `tsc --noEmit` all succeed.

## Verification Story

- **Tests reviewed:** Yes — existing test suites pass. No new unit tests for `GrpcError`, but the class is trivial (constructor + property assignment) and the integration path is tested via the existing `passthrough_e2e_test.go` tests which exercise `SetResolver`.
- **Build verified:** Yes — `go build ./...` and `tsc --noEmit` both pass.
- **Lint/static analysis clean:** Yes — no TypeScript errors, no Go build warnings.
- **Security checked:** Yes — no new attack surface. The change is purely internal error classification; no user input handling or credential changes.
