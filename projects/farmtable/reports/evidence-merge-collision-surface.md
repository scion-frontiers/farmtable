# Evidence — merge collision surface across the four-branch train

Written 2026-07-27 by eng-manager, **applying the export rule we agreed an hour
ago** and which I then immediately failed to apply: the coordinator could verify
Phase 2's `jsdom@^26.1.0` from the shared checkout but not #195's `^29.1.1`,
because `markdown-sanitize` is worktree-private. They accepted the reasoning
anyway. That is the second time in one session a decision has rested on a number
only I could see, which is exactly what the rule exists to prevent.

Exporting both halves here.

## Branch coordinates

| branch | worktree | head | base |
|---|---|---|---|
| `markdown-sanitize` (#195) | `/workspace/farmtable-markdown-sanitize` | `204af7e` | `7a0f220` |
| `terminal-predicate` (#191) | `/workspace/farmtable-terminal-predicate` | `d7314cf` | `7a0f220` |
| `close-label-swap` (#194) | `/workspace/farmtable-close-label-swap` | `c1ec1ba` | `d7314cf` |
| `task-state-web-ui-v2` (Phase 2) | `/workspace/farmtable-attention-view` | `633f8f2` | `7a0f220` |

`7a0f220` is `origin/main`, live in production.

## Collision matrix

```
$ git diff --name-only 7a0f220..204af7e          # #195
.design/project-log/markdown-sanitize.md
web/package-lock.json
web/package.json
web/src/util/markdown.test.ts
web/src/util/markdown.ts
web/tsconfig.test.json

$ git diff --name-only 7a0f220..633f8f2 | wc -l  # Phase 2
73
$ git diff --name-only 7a0f220..633f8f2 | grep -c '\.go$'
0
```

| pair | overlap | risk |
|---|---|---|
| #191 ↔ #194 | Go, same file | handled — #194 rebased onto `d7314cf` |
| #191/#194 ↔ Phase 2 | **none** (Phase 2 touches 0 `.go` files) | none |
| #195 ↔ Phase 2 | `package.json`, `package-lock.json`, `tsconfig.test.json` | below |

**`markdown.ts` and `markdown.test.ts` do not overlap Phase 2.** The sanitizer
lands uncontested; only its packaging collides.

## The unverifiable half, now verifiable

`git show 204af7e:web/package.json` — `devDependencies` in full:

```json
  "devDependencies": {
    "@types/jsdom": "^28.0.3",
    "jsdom": "^29.1.1",
    "typescript": "^5.5.0",
    "vite": "^6.0.0",
    "vite-plugin-static-copy": "^3.4.0"
  }
```

and its `test` script:

```json
"test": "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js"
```

Against Phase 2 (`633f8f2`, checkable from the shared tree):

```json
"jsdom": "^26.1.0",
"vitest": "^3.2.7"
"test": "npm run test:node && npm run test:components"
```

`^26.1.0` = `>=26.1.0 <27.0.0`. `^29.1.1` = `>=29.1.1 <30.0.0`. **Disjoint.**

Consumers differ too, which is why neither side is obviously the one to yield:

- #195 uses jsdom **directly** in `markdown.test.ts`, to give DOMPurify a DOM.
- Phase 2 uses it as vitest's `environment: 'jsdom'` for a 407-test harness
  (`web/vitest.config.ts:19`).

## The two overlaps that self-resolve

Recording these so nobody re-derives them under rebase pressure.

**`tsconfig.test.json`** — #195 adds an explicit path, Phase 2 replaces the
include with a glob that subsumes it:

```
#195:     "include": ["src/utils/task-ready.test.ts", "src/util/markdown.test.ts"]
Phase 2:  "include": ["src/**/*.test.ts"]
```

Take Phase 2's. `markdown.test.ts` still compiles.

**the `test` script** — Phase 2 replaces #195's appended-command style with
`scripts/run-node-tests.mjs`. Taking Phase 2's version is safe *because that
runner globs*, and its own docstring anticipates precisely this:

> The file list is a glob, not a hardcoded list, so a new `*.test.ts` under
> `src/` is picked up automatically — **including files that arrive from other
> branches at merge time.**

It also hard-fails when the source count and compiled count disagree, pointing
the reader at `tsconfig.test.json`. So the failure mode "sanitizer tests
silently stop running after the merge" is already defended against by the Phase 2
author, before the merge existed. Worth crediting explicitly.

**`package-lock.json`** will conflict and should **not** be hand-merged.
Resolve `package.json` first, then regenerate the lock with a clean install, then
re-run both suites.

## Status

Pushed upstream into `farmtable-dev-195-cleanup.md` item 4 as an empirical task:
does the markdown suite pass on `^26`? Adopt if yes; keep `^29` and paste the
failure if no. Explicitly not a "pick a number" decision.

If still unresolved when Phase 2 rebases: **stop and escalate.** Do not resolve
mechanically.

## Reproducing

```bash
git -C /workspace/farmtable-markdown-sanitize show 204af7e:web/package.json
git -C /workspace/farmtable-attention-view    show 633f8f2:web/package.json
git -C /workspace/farmtable-attention-view    show 633f8f2:web/scripts/run-node-tests.mjs
```
