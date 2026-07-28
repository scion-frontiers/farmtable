# markdown-sanitize round 7 — code review leg

**Reviewed:** `86f30bc..7b4f6dd` (HEAD `7b4f6dd0fbe348742e14c7191a14bd3c82e9e4e5`),
1379 insertions / 69 deletions, 3 files.
**Verdict:** REQUEST CHANGES. Risk MEDIUM — no live vulnerability, no behavioural change.
**Full report:** `reports/review-195-r7.md` (scratchpad, not in-tree).

Ancestry verified before diffing, as the brief asked: `86f30bc` is an ancestor of
`7b4f6dd` (exit 0); `89306d0` (the r6 review leg's log) is not (exit 1), and
`merge-base(89306d0, 7b4f6dd) = 86f30bc`. The brief was right.

## Gate reproduced independently

`npm ci` exit 0 (no `node_modules` in the tree) · `npm test` exit 0 /
"markdown sanitizer: 75 checks passed (122 assertions)" · `npx tsc --noEmit` exit 0 ·
`npm run build` exit 0 · `go build ./...` exit 0 · `go test ./...` exit 0.
Every exit code read from the child process; all mutation work in a copy at `/tmp/mut/web`.
Nothing in `/workspace` was modified.

## The framing this round needs

The whole `markdown.ts` delta (+81/-13) is comments — `const parser`, the `FORBID_*`
arrays and `renderMarkdown` are byte-identical to `86f30bc`. There is no production change
to motivate. The round's deliverable is *claims that can be trusted*, so the review
question is whether the new prose is true. Two of the three blocking findings live in text
that reads as commentary.

## Blocking findings

- **R7-REQ-1 — `stripImportStatements` still swallows across `import(<non-literal>)`, and
  the new docblock claims otherwise (BY EXECUTION).** W2's `(?!\s*\.)` names two of the
  three `import` productions, not three. A dynamic import with a non-literal specifier
  still starts a statement match, `[^;'"]` finds no quote, and the match runs to the next
  `from '…'`. Measured on the real non-sink `src/util/format.ts`: a block containing
  `const dev = import(spec)` that hides `export const rawHtml = unsafeHTML` behind the
  swallow is **GREEN at 75/122 with `tsc` exit 0**. One-token attribution: the identical
  block with `import.meta.env.DEV` is RED (`format.ts:29`); the identical block in a
  `REQUIRED_SINKS` file is RED via **R6b**. So the per-file half already treats this as a
  violation and the tree-wide half does not — the same asymmetry W3 fixed for R7 this
  round, one rule over. **Pre-existing: r6's regex hides the same alias, so this round does
  not make it worse, and the brief's "escape made worse" trigger is NOT invoked.** The
  false completeness sentence is new in this diff. Measured fix: `(?!\s*[.(])` keeps the
  clean tree GREEN 75/122 and turns the laundering block RED; or promote R6b tree-wide as
  R7 was. Documentation-only is acceptable if mechanism (b)'s "tripwire, not proof"
  disclaimer is meant to cover it — but then the sentence must still be corrected and the
  case added to Residue. R8/R9 read the un-stripped `code` view, so INFO-2's mitigation
  argument is unaffected.

- **R7-REQ-2 — the replacement arity claim in `markdown.ts` is false (BY EXECUTION).**
  `markdown.ts:140-144` says there is no measured spelling for which `.length === 1` is the
  falsifier, because "every form that survives `tsc` leaves `.length` at 1 by definition."
  Measured: `(...md: string[])` → 0 and `(md: string = '')` → 0. Both are this round's own
  `ARITY_EVASIONS` C7-j and C7-k, both survive `tsc`. The same round's C7-k rejection
  message at `markdown.test.ts:672` says so explicitly. Harm path: a maintainer reads the
  sentence and deletes the assertion as redundant. Fix: narrow to "the only falsifier" and
  drop "by definition"; the identical sentence is in the r7 log entry.

- **R7-REQ-3 — the `EXPECTED_CHECK_CALL_SITES` provenance line is wrong (BY COUNT).**
  `markdown.test.ts:3221` says "Moved 69 -> 73 in round 7" above `= 74`. Measured
  (`grep -c "^ *check("`, same grep returns 68 at the base as a positive control): 68 → 74,
  six added, not four. The two omitted are both `dependencyPolicy()` checks — the dompurify
  floor (T-6) and the #204 sunset (O3). Note: round 6's "Moved 61 -> 69" line above it is
  inconsistent with the base constant of 68 by the same one; outside this delta, untraced.

## Non-blocking

The O3 sunset clause fires on bare `eslint` — measured RED on `"eslint": "^9.0.0"` alone
with the message "typescript-eslint tooling is now declared (eslint)", broader than both
its docblock and the log's `prettier` control, and enough to break a security test on an
ordinary lint-adoption commit · `splitTopLevelDefault` returns a boolean and returns `true`
for `md: (x: string) => string` (the `>` of `=>` closes depth), fail-closed and uncovered
by any `ARITY_LEGITIMATE` fixture · the T-8 check's "deliberately LAST in `taskLists()`"
ordering is the one invariant in this file held by a comment rather than a guard — move it
to its own function invoked last in `run()` · `assertContains(out, 'a', …)` at
`markdown.test.ts:263` is near-vacuous · `undeirvably` at `:3199` · the anchor count at
`:1168` is loop-invariant, and the `ARITY_LEGITIMATE` loop has no anchor guard at all.

## Confirmed good

Every red-on-revert this round claims, I reproduced independently: W1 (fires on a real
`(md, opts = {})` through the 150-line docblock), W3 (scope shrink names the scope pin),
W4, T-4 (hollowed body + reverted `slot` → RED at 120/122, the exact case green at 69),
T-6, T-8 (RED at exactly one check, as stated), audit LOW-2 · **T-8 is the first by-effect
rather than by-name check in this file**, and its `assertNotContains(out, '<img')` is
load-bearing — DOMPurify strips `onerror`, so the first assertion alone would have passed ·
INFO-2's sticky-`setConfig` measurement is byte-exact when reproduced, and is correctly
characterised as a policy bypass rather than script execution · **Correction 2 is right and
verified three ways** — `git log -S ALLOW_UNKNOWN_PROTOCOLS` on `markdown.ts` is empty
across all history (positive control: `-S FORBID_ATTR` returns three commits), the token
appears only in `fc2b947`'s test file, and `fc2b947`'s production diff is exactly the three
items named · W5's four call-site line references are all exact · the Residue and
Costly-disclosure sections are what let this review target its effort, and are the reason
the surrounding numbers are credible.

## Where the brief was wrong

Tree path `/workspace/farmtable-195-r7-review` does not exist in-container (EM corrected
mid-review; tree is `/workspace`) · the `[MEASURED]` "+94 / +1060" are total changed lines
mislabelled as insertions (numstat: `81 13` and `1004 56`) · **item 2 asks whether the
production changes are motivated by the tests, and there are no production changes** — a
leg that took it at face value would have searched for a behavioural change that does not
exist and read the comment block as background, which is where two of three blocking
findings came from.

## Disclosure

My first mutation harness aborted with `count=0` from a mis-escaped regex anchor, and the
`run.sh` invoked after it printed a confident GREEN — the void-harness failure the brief
names, produced on the first attempt. Only the abort message on the preceding line
distinguished it. Re-applied with a raw string and confirmed the edit with `grep -n` before
trusting any subsequent number. Separately, `PIPESTATUS` came back empty because the shell
here is zsh; the exit-code discipline was restored by reading `rc=$?` from the child inside
a bash script.
