# F4 mutation arms — definitions and expected red targets

Leg `test-xss-r8`. Written out because **none of this is a ref and no bundle carries it.**

**NO ARM WAS EVER COMMITTED.** Every arm is a working-tree edit applied by
`mutate-tip.sh`, run, then reverted; the tree returns to 0 tracked diff lines between
arms. So there is nothing for `fsck`, the reflog sweep or `git bundle` to find — the
arms exist as *this prose and these scripts* or not at all. That is the whole reason
this file exists.

## Where it was run

- Subject commit: **`439b309`** (main `aa08f1a` + XSS union + pins `3006492`).
- ROOT: fresh clone, detached, porcelain `-uall` 0 before and after; `npm ci --offline`.
- Runner: `npm test` → `web/scripts/run-node-tests.mjs`, which **discovers** test files.
- **node v20.20.2. CI pins node 22. Every figure below is node 20, not CI.**
- Design: fixed N=2 per arm, interleaved by round, no arm re-run to agreement.

## The eight arms — target file, mutation, liveness anchor, expected red

All arms except M-F/M-G edit `web/src/util/markdown.ts`, whose pristine body is
`return DOMPurify.sanitize(marked.parse(md) as string);`.

| arm | mutation | liveness anchor (proves PRESENT, not that it CAUSED) | expected red |
|---|---|---|---|
| baseline | none | `DOMPurify.sanitize(marked.parse(md) as string);` present | **GREEN** |
| M-A | drop the `DOMPurify.sanitize` call entirely | `DOMPurify` absent from file | **4 of 7** |
| M-B | widen config: `ADD_TAGS:['script']`, `ADD_ATTR:['onerror','onload']` | `ADD_TAGS` present | **3 of 7** |
| M-C | reverse order → `marked.parse(DOMPurify.sanitize(md))` | `marked.parse(DOMPurify.sanitize` present | **2 of 7** |
| M-D | **negative control** — extract `const html`, semantics identical | `const html = marked.parse` present | **GREEN** |
| M-E | `ALLOWED_TAGS: []` — strip everything | `ALLOWED_TAGS` present | **3 of 7** |
| M-F | sink 1 → `unsafeHTML(this.description ?? "")` in `ft-inspector-desc.ts` | `renderMarkdown(this.description)` absent | **2 of 7** |
| M-G | delete jsdom global copy in the test itself | `const name of ([] as string[])` present | **6 of 7** |

`N of 7` is printed by the test's own harness as
`render-sink-xss: N of 7 test(s) FAILED`. That string is the oracle — **not** a regex
over rendered HTML, which produced three false leaks on correct code earlier in the day.

**M-D is what licenses causation.** It is 3 real diff lines (not vacuous) and green on
both rounds, so the other reds are attributable to the semantic change rather than to
the file having been touched. **A vacuous mutant — zero diff lines — is "control
unreachable", not a survivor.** Every arm's diff-line count is recorded in
`matrix-439b309-raw.txt`.

## Result at 439b309 — matched the pre-registration exactly

`baseline` GREEN/GREEN · M-A 4,4 · M-B 3,3 · M-C 2,2 · M-D GREEN/GREEN · M-E 3,3 ·
M-F 2,2 · M-G 6,6. Every run `enum=6 exec=6`. **No arm red-on-tree returned green.**

## The two board arms — property-level, not guard-level

Break the property, then ask which of the six discovered files reds.

| property broken | how | diff lines | which files red |
|---|---|---|---|
| markdown sink | delete `DOMPurify.sanitize` | 3 | **`render-sink-xss.test.js` ONLY** — other five green |
| URL scheme, behaviour | `safeHref` body → `return raw ?? undefined` | 64 | `safe-url.test.js` only |
| URL scheme, locality | a binding bypasses `safeHref` (`ft-inspector-meta.ts:21`) | 2 | `safe-url.test.js` **and** `url-binding-scan.test.js` |

**The finding:** the markdown sink is one file deep on one axis, and that file is one
commit old. URL-scheme is two files deep on two complementary axes. `url-binding-scan`
is a *static chokepoint scanner* — correctly indifferent to what `safeHref` does — and
its own header states it does not see `unsafeHTML`. The exclusion was documented; the
replacement never existed.

## Re-running this

`mutate-tip.sh` is self-contained apart from paths: it expects the clone at
`/tmp/tip439` with `web/node_modules` installed. Change `cd` at the top and the `S=`
backup dir. It restores the tree on exit and prints the porcelain check.
`mutate-union.sh` is the earlier equivalent for base `d7154a4`, kept because it is the
run that established the pre-registered table before the runner could settle it.
