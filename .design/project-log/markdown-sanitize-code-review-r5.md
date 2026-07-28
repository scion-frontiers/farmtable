# #195 `markdown-sanitize` — code-review leg, round 5 (final)

**SHA reviewed and tested:** `53296afe36b718a8664be5ab748879a18f289b66`
**Verdict:** REQUEST CHANGES (2 Required, both in the guard; production sanitizer approved as-is)
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r5.md`
**Salvaged harnesses:** `/scion-volumes/scratchpad/projects/farmtable/salvage/review-195-r5/`

One of three independent legs (code review / test review / security audit). No
coordination with the other two; other legs' reports not read.

## Gate

Run in `web/`, exit codes read directly from the child process, never through a pipe.

| command | exit | note |
|---|---|---|
| `npm ci` | 0 | |
| `npm test` | 0 | `markdown sanitizer: 61 checks passed` |
| `npx tsc --noEmit` | 0 | |
| `go build ./...` | 0 | zero Go changes on the branch |
| `go test ./...` | 0 | |
| `git status --porcelain` | empty | at start, after every mutation, and at end |

Pins independently recomputed: 50 scannable source files under `web/src`;
60 literal `check(` call sites; `60 + (REQUIRED_SINKS.length - 1) = 61`. The
arithmetic comment at `markdown.test.ts:1929` is correct.

## Method

Two controls established before any negative result was trusted (standing bar 3):
breaking R1's literal produced `3 of 61 failed`; deleting a `check()` call produced
`1 of 60 failed` via the total pin. All mutations were content-addressed, aborted
unless the anchor occurred exactly once, restored with `git checkout --`, and then
verified against **both** an empty `git status --porcelain` **and** byte-equality
with an out-of-repo backup taken before the first run.

Because `markdown.test.ts` exports nothing, the guard's own predicates were driven
by appending exports to a copy of the compiled output under `node_modules/.probe`
(gitignored) rather than by inference. That is what produced the F1 evidence.

## Findings

### F1 (Required) — `stripImportStatements` sweeps across statement boundaries
`markdown.test.ts:909-922`. `[^;]` matches newlines, so an import lacking its
semicolon extends the blanking region forward to the next `from '…';`, erasing any
statement in between — including a `const rawHtml = unsafeHTML` alias. Verified:
both mechanism (a) and mechanism (b) return zero violations on that input, while the
same file with semicolons is caught by both. The mirror case is a false positive: a
correct sink file written without semicolons is rejected with a message accusing it
of aliasing. The docblock's claim that "`[^;]` cannot cross a statement boundary" is
true only for the single same-line example it gives. The identical `[^;]` defect was
found and fixed for the re-export regex at line 1307 and never carried back here.
A replacement regex was validated by execution across seven cases.

### F2 (Required) — `BANNED_SINKS` is entirely untested detection logic
`markdown.test.ts:1035-1047`. Neutering one pattern, deleting one entry, and
rebinding the whole list to `[]` each left the suite green at 61/61. The only
fixtures touching `BANNED_SINKS` are negative controls. This is the same vacuity
failure the file diagnoses at lines 383-387, 1571-1573 and 1840-1845 and fixed for
`directiveIndirectionOffenders`, `sinkBindingViolations` and R8/R9 — the fourth
mechanism was missed. A positive fixture table is proposed.

### C1 (Consider) — the amended criterion: not defined down, but wrongly worded
The amendment is sound and the original criterion was genuinely unsatisfiable. The
decisive evidence that it was not narrowed to fit the solution is that **F1 is a
failure of the amended criterion**: "aliasing at the two enumerated sinks" is its
first named item, and the guard misses it. A criterion still violable by the artifact
it measures has not been defined down. The weakness is vocabulary — "innocent-looking
regression" describes author intent, which is not decidable from a diff. Restating it
in artifact terms (name / call shape / visible in the scanned view, with runtime
effect explicitly excluded) preserves the scope and makes F1 unarguable.

### C2 (Consider) — over-built, but split rather than replace wholesale
Measured: 1971 lines, 34% comment. Behavioural half (1-517): 18% comment, no
tokenizer, no vacuity risk — keep unconditionally, highest value per line in the
change. Guard half (519-1943): 41% comment and a hand-rolled JS/TS tokenizer plus
module resolver. R1/R5 are cheap and tokenizer-free — keep. R3/R4/R7,
`directiveIndirectionOffenders` and `BANNED_SINKS` are exactly what #204 subsumes and
where the defect rate is not converging. Recommend marking that subset for deletion
on #204 landing, in the file. Nothing currently schedules the removal of what #204
replaces.

### C3 (Consider) — third-sink cost, measured
Adding a correct third sink component produced three sequential red runs requiring
three constant edits plus a prose-arithmetic edit. The first two failure messages are
excellent. The third — "a check was added or silently removed" — is wrong for this
scenario. Deriving `EXPECTED_CHECKS` from `REQUIRED_SINKS.length` in code removes one
edit and the drift risk.

### C4 (Consider) — `id` not in `FORBID_ATTR`
`markdown.ts:31-37` argues for forbidding `class` because attacker class names resolve
against real component CSS in the shadow root. The argument is symmetric in `id`.
Currently inert (both components use class and tag selectors only, and DOMPurify
strips the custom elements their `querySelector` calls target), so this is an
asymmetry between rationale and list rather than a live issue.

## The three `markdown.ts` claims, adjudicated

| claim | verdict |
|---|---|
| private `Marked` instance keeps this off the shared singleton (`:56`) | TRUE, and mutual — verified in both directions at runtime and against `marked@15.0.12` source |
| checkbox output inert, `role`/`aria-label` survive `FORBID_ATTR` (`:47-54`) | TRUE — post-sanitize DOM walk shows `span` + those two attributes and nothing else; renderer signature matches `marked.cjs:1543` |
| U+FE0E rationale (`:48-53`) | TRUE for U+2611 (`Emoji=Yes, Emoji_Presentation=No`); inapplicable to U+2610, which is not an emoji character — the selector is a no-op there. "Tofu" clause is loose. |

## Also verified clean

`tsconfig.test.json` one-line `include` addition is correct and minimal. `package.json`
adds `jsdom` and `@types/jsdom` as devDependencies with a documented and sound version
skew. The lockfile diff is a pure addition of 46 packages, **all** `"dev": true`;
`marked@15.0.12` and `dompurify@3.4.12` were already on the base and were not bumped.
No production dependency delta.

## Disclosures

- The brief named the clone `/workspace/farmtable-review-195`, which does not exist;
  `/workspace` is the clone at the stated SHA and was used.
- The first mutation run reported a restore failure caused by my own scratch directory
  inside the repo, not by the driver. Probes were moved under `node_modules/.probe`
  and the control was re-run from a verified-clean tree before any result was trusted.
- My first attempt at the F1 experiment mutated the sound fixture in a way that also
  broke two `SINK_EVASIONS` anchors, producing a red run for the wrong reason that
  would have supported the opposite conclusion. It was discarded and the result
  re-derived by driving the predicates directly. A prose-only version of that first
  attempt would have been a confident false negative.
- No integration tests run (no live Postgres; zero Go delta).
