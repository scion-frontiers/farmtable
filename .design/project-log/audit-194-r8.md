# Project log — independent security audit, #194 round 8

**Date:** 2026-07-28
**Branch:** `label-write-scope-r8`
**Audited commit:** `158c8ae963faa5eef032e0857ecbc40d6a7c681a`
**Role:** independent security auditor (no production code modified)
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r8.md`

## Verdict

**APPROVE — nothing blocks merge.** 0 Critical, 0 High, 2 Medium, 4 Low, 3 Informational.

The brief instructed me to treat *"the round-8 change is itself a round-9 defect"* as the default
hypothesis and to try to confirm it. **I could not confirm it.** Five independent attempts, all
negative; recorded in the report as green controls rather than as a pass.

## The invariant, restated

> For every label write the server causes a third-party tracker to perform, there must exist an
> authorization decision evaluated **against a named snapshot of that issue**, and the write must be
> a subset — **by match key, not by string** — of the edit that decision priced against that same
> snapshot. Separately, no path may write a **lifecycle-bearing** label unless the decision that
> authorised it priced a lifecycle transition, **whether or not the caller named the label**.

Two deltas from the brief's wording, both reported as findings: the brief scopes the invariant to
*caller-supplied* operations (which excludes the priority/type arms — the very arms round 8's
`assertStageWriteAllowed` exists to guard), and it is silent on *which state* the gate priced
against (which is exactly what made A-4 invisible).

## Findings

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| M-1 | Medium | `checkLifecycleKeyCollisions` builds its ownership set from `StageToLabel`, not from `authorizationStage`'s `labelToStage` — every **configured stage alias** is invisible to the check | `internal/platform/github/config.go:289-292` |
| M-2 | Medium | Stored `javascript:` XSS via caller-supplied `pull_requests[].url`, unvalidated at every layer, rendered into `href=${pr.url}` — **pre-existing, outside the round-8 diff** | `internal/server/server.go:922-928` → `web/src/components/inspector/ft-inspector-code.ts:106` |
| L-1 | Low | `assertStageWriteAllowed` panics on a nil mapper; both sibling readers and `LabelDeltaLifecycleStages` guard, this one does not; no gRPC recovery interceptor exists | `passthrough.go:290-313`, `terminal_label_stages.go:46` |
| L-2 | Low | `stageWritePolicy` is a bare named `bool`, so `writeLabelSwap(…, true)` compiles and means ALLOWED without naming the constant | `passthrough.go:261-279` |
| L-3 | Low | Label index cached for process lifetime and never refreshed; unresolvable names are dropped and the write returns `nil`. `AutoCreateLabels` has **zero readers** | `passthrough.go:146-152`, `config.go:44-46` |
| L-4 | Low | `strings.ToLower` is a simple case fold — U+0130 collides with `i`, so two coexisting GitHub labels share one `labelIndex` key (last writer wins) | `passthrough.go:167,201,1234` |
| I-1 | Info | Restrictor **under**-removes when the snapshot holds two labels sharing a match key (safe direction) | `passthrough.go:1217-1225` |
| I-2 | Info | CLI pass-through registers gRPC with **no interceptor** → every scope gate is inert. Not a privilege boundary, but a **measurement hazard**: a harness on that path cannot falsify a gate defect | `internal/cli/connect.go:301-306` |
| I-3 | Info | Residual risk of shape-only `req.Type` validation: control chars / ANSI / RTL reach the terminal and logs on the native path. GitHub path is closed (`TypeLabelSwap` returns `(nil,nil)`) | `internal/server/server.go:100-110` |

M-1 is not exploitable — round 8's own `assertStageWriteAllowed` backstops it structurally, because
*that* control does use `authorizationStage`. The cost is that the startup diagnostic never fires
and the operator gets a runtime failure instead. Notably, the dev's surviving mutant **M6c**
("hardcoded `ft:stage/` literal; equivalent by construction") is the evidence for M-1, read as
reassurance. Fixing M-1 makes M6c killable.

## Regression check — clean, as required

- **A-4 closed.** Probe: snapshot `["bug"]`, remove `["ft:stage/wont_fix"]`, add `["bug"]` →
  `(nil, nil)`. The free, blind, unbounded retryable primitive is gone.
- **C-1 closed.** `add=[X], remove=[X]` against a snapshot without X → `(nil, nil)`.
- **Derivation, not mirroring, verified structurally.** Adds ⊆ caller's adds because `after ⊆
  current ∪ add` and every `current` key is in `present`; removes ⊆ caller's removes
  unconditionally via the `removeKeys` belt at `:1220` — that belt is doing more work than its
  comment claims, it is the *only* thing making the remove side sound.
- **Error propagation.** All six `writeLabelSwap` call sites (`:583,:603,:614,:628,:636,:777`)
  `return nil, err`. `assertStageWriteAllowed` runs at `:339`, before any `gql` call.
- **Dashboard sanitizer intact.** Both `unsafeHTML` sinks route through
  `DOMPurify.sanitize(marked.parse(md))`; zero `innerHTML`/`eval`/`document.write` under `web/`.
  Caveat: `web/src/util/markdown.test.ts` **has never existed in this repository** — the control is
  unpinned here.

## Baseline (predictions written before measuring)

| check | predicted | measured |
|---|---|---|
| `go build ./...` | exit 0 | exit 0 |
| `go vet ./...` | exit 1, 4 copylocks at 1782/1892/2100/2277 | exit 1, exactly those 4, messages checked |
| `go test ./...` unloaded | exit 0, 0 FAIL | exit 0, 0 FAIL, 10 `ok` |

**`go build ./...` exits 0 without `-buildvcs=false`** — measured both while the object store was
broken and after repair. This **contradicts test-194-r8** in both states, so the broken-`.git`
theory does not rescue that claim either.

**`53edc46` → `158c8ae`:** `git diff --stat` = one file, `.design/project-log/label-write-scope-r8.md`,
+232. `git rev-parse 158c8ae^` = `53edc46`; `merge-base --is-ancestor` true. **Confirming the EM's
claim with my own measurement** — plain descendant, docs-only, no rebase or amend. The dev report's
verification at `53edc46` therefore covers all code at HEAD.

My *first* full-suite run (under subagent CPU load) went red on
`TestWatchTasks_NoInitial (5.01s) — timed out waiting for event`; serial re-run exit 0. Reproduces
the brief's flake characterisation without me trying.

## Where the brief was wrong (required deliverable)

1. **"This workstream has already shipped one HIGH-severity XSS"** and "earlier rounds closed A-4
   **and an XSS in the dashboard**" — **wrong for this branch.** Zero `web/` commits in
   `1d4442f..HEAD`; `markdown.ts` last touched at `7a218bd` (original scaffold, not remediation);
   no `xss` string anywhere in `.design/` or `docs/`. That work is **#195**, a different workstream.
   There is no closure event here to regress from.
2. **"if a future call site omits the argument, does it fail open or closed?"** — the premise is not
   expressible in Go; the parameter is positional and omission is a compile error. The zero value
   *does* fail closed, but for a different reason than asked, and the real hazard (an untyped `true`
   literal) is one the question could never surface.
3. **"Round 8's fix for C-1 is … nine commits"** — the C-1 fix is **one** commit, `f6b3f31`. The
   other eight are independent items plus a docs-only commit. The new attack surface is in items 3,
   5, 6 and 7; the C-1 rewrite is the cleanest thing in the round.
4. **§2(a) under-describes its own hazard.** The `strings.ToLower` / no-`TrimSpace` claim is correct
   (confirmed by my own read). But whitespace is not *the* defect — the index is keyed by a **lossy**
   function, and adding `TrimSpace` would not touch the case-fold collision (L-4).
5. **Baseline tension** (flagged, not scored): "exit 0, zero FAIL lines" and "genuinely flaky under
   contention" sit three lines apart and read as one guarantee.

**Checked and found correct:** the full `go build` / `go vet` / `go test` baseline including vet
messages and function names; §2(a)'s claim about `labelNameToID` and `labelIndex`; the dev's Ent
correction (`field.String("type").Optional().Default("")` at `internal/store/schema/task.go:36`);
and §2(d)'s `ConfigSource` concern — **traced and clean**: `Describe` has exactly one caller
(`main.go:89`, `log.Println`), the `AbsolutePath`-bearing errors have one consumer (`main.go:84`,
`log.Fatalf` before serving), and `internal/server`, `internal/serverapp`, `internal/mcp` contain
zero references. No information disclosure.

Also correct, against the brief: `CloseTask` does **not** route through `writeLabelSwap` (the brief
listed it as a call site); its `log.Printf`-swallowed errors are deliberate and correct for a
best-effort write after an already-completed close.

## Environment note

`/workspace/.git/objects/info/alternates` pointed at a host path invisible inside this container
(`git clone --shared`), leaving the repo with 0 local objects and every history command failing.
Repaired mid-audit by the EM. All git-dependent measurements above were taken **after** repair;
`go build` and the working-tree reads were taken in both states and agree.

## Cleanup

Probes lived in `internal/platform/github/zz_audit_probe_test.go` and `zz_audit_probe2_test.go`,
were run, and were deleted. `git diff --quiet` exits 0 and `git status --porcelain` is empty apart
from this log entry. Nothing pushed.
