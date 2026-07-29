# TestWatchTasks_NoInitial — cold flake: covered by faf1c8c

**Date:** 2026-07-29 · **Author:** farmtable-dev (mainred-fix leg) · **For:** farmtable-em-ci

## Answer

**`faf1c8c` already fixes it. No new fix is needed.** The population exposed to this
mechanism is **7 tests, all of them already covered**, and the bound is structural rather
than estimated.

## 1. What "cold" is — and three definitions that do NOT reproduce it

The failure was reported as "green warm, fails cold". Measured on unfixed `cc92735`:

| Operational definition of cold | Result |
|---|---|
| Empty `GOCACHE`, single test | **PASS** (99s wall, but compile finishes *before* the test runs) |
| Empty `GOCACHE`, full `go test ./...` | **PASS** (127s wall) |
| Empty `GOMODCACHE` + `GOPROXY=off` | Fails at `toolchain not available` — a download error, not a test failure |

**None of these reproduce it, and the first one explains why.** A cold *build* cache puts
the load in the compile phase, which completes before the test binary starts. By the time
the test executes, the machine is idle. Cold-as-in-uncompiled is the wrong variable.

**I did not identify the literal physical condition the original report meant.** That is
stated as a gap, not glossed over.

## 2. What actually reproduces it — and why that is sufficient

The defect is a **lost-event race**: `client.WatchTasks` returns before the handler reaches
`eventBus.Subscribe`, and `EventBus.Publish` has no replay, so an event published into that
gap is dropped and the test waits out its timeout.

Any "cold" condition can only act on this defect **one way: by widening that window.** So
the window can be widened directly, which is load-independent and does not require guessing
what cold physically was. Injecting a **500ms delay before `Subscribe`** in both arms,
interleaved, 10 pairs, loads matched:

| Arm | Result |
|---|---|
| unfixed (`cc92735`) + 500ms | **10 / 10 FAIL** |
| fixed (`faf1c8c`) + 500ms | **0 / 10 FAIL** |

The failure text is exactly the reported symptom:

```
--- FAIL: TestWatchTasks_NoInitial (5.01s)
    watch_test.go:118: timed out waiting for event
```

**The fix was seen to fail before being called fixed.** 500ms is ~2.5× the 200ms window
used in the original discriminator and far wider than any plausible scheduling delay.

**Why the fix is robust to window width in general:** `stream.SendHeader` after `Subscribe`
and `stream.Header()` in the test form a **causal barrier, not a timing margin**. The client
blocks until the subscription exists, however long that takes. A slower host makes the
barrier wait longer; it cannot make it wait insufficiently. This is also why the fix is not
a retry loop — a retry would hide the defect instead of removing it.

## 3. Population bound — by method, structurally

**The mechanism is confined to `WatchTasks`, and this is a hard bound:**

- `WatchTasks` is the **only** server-streaming RPC in the service
  (`grep grpc.ServerStreamingServer internal/server/*.go` → one RPC; `sendInitialSnapshot`
  is a helper, not an RPC).
- `eventBus.Subscribe` has **exactly one** non-test call site: `watch.go:60`.

No other code path can exhibit a subscribe-after-return race, because no other code path
subscribes.

**Within `WatchTasks`, 14 tests, classified by whether a mutation can precede the
subscription:**

| Exposed (7) — mutate after opening the stream, all carry `awaitSubscribed` |
|---|
| `_NoInitial`, `_CreatedEvent`, `_UpdatedEvent`, `_ClosedEvent`, `_ClaimEvent`, `_CollectionFilter`, `_Heartbeat` |

| Not exposed (7) — verified individually, two distinct reasons |
|---|
| `_PassThroughReturnsUnimplemented`, `_InvalidFilters`, `_ExternalCollectionReturnsUnimplemented` — no mutation after the stream opens |
| `_IncludeInitial`, `_SequenceNumbers`, `_FarmtableCollectionAllowed`, `_NoCollectionFilterAllowed` — the mutation precedes the stream, and the first successful `Recv` is itself proof the subscription exists |

Adding a barrier to the second group would be cargo-culting: it would wait for something
already guaranteed.

## 4. Verification

Measured in a **throwaway built tree**, `web/dist` = real, module cache warm:

- `go test ./internal/server -run TestWatchTasks -count=20`: exit 0,
  **14 distinct tests × 20 runs = 280 PASS / 0 FAIL.**
- `go test ./... -count=1`: exit 0, **32 packages = 10 ok + 22 no-test-files**,
  0 failing tests, 0 setup-failed.

The 32-package total matches the pristine-tree census (4 setup-failed + 8 ok + 20
no-test-files); building the frontend converts the 4 that embed `web/dist` into 2 ok and
2 no-test-files. `internal/server` is not among them and runs in either state.

## 5. Caveats

- **Tree coordinates:** throwaway copies under `/tmp`, `web/dist` = real (4,109 files),
  `node_modules` = present, module cache = warm. **Not the main working copy; not CI.**
- The tree labelled "fixed" is `cc92735` with the fix applied as working-tree changes, not
  a checkout of `faf1c8c`. It is **content-equivalent**, verified: `SendHeader` at
  `watch.go:79` and 7 `awaitSubscribed` call sites, matching the commit. Figures are
  reported against that tree, not against a checked-out `faf1c8c`.
- The cold-simulation arms differ from their baselines by exactly one injected `time.Sleep`
  line; they are diagnostic trees and are not part of any branch.
- The literal physical "cold" condition remains unidentified (§1). The claim proven here is
  narrower and stronger: **the fix holds for an arbitrarily widened window**, which is the
  only channel through which any cold condition could act.
