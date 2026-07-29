# Prediction file 1 — the five pinned totals and the three gates

Written BEFORE running `npm test`, `npx tsc --noEmit` or `npm run build` on this tree.
Tree: /workspace, branch markdown-sanitize-r8, HEAD 3f6a695ed450718316b50303975621bbb725e4f8.
`npm ci` has been run (exit 0); no test/build has been run yet.

Every number below is derived from a STATIC READ of the source, not from the runner.

---

## 1. EXPECTED_CHECK_CALL_SITES

Derivation: the literal count of `check(` call sites in `src/util/markdown.test.ts`.

- `grep -nE '^\s+check\(' src/util/markdown.test.ts | wc -l` -> 77
- Every other occurrence of `check(` in the file is either the function
  DEFINITION (L50) or prose inside a comment/template string (L490, 491, 2490,
  2846, 3111, 3223, 3580, 3600, 3791, 3810). None is a call.
- Enclosing-function attribution of all 77:
  formControls 9, spoofingAttributes 5, scriptExecution 12, svgSurface 12,
  ordinaryMarkdown 10, inputContract 3, taskLists 3, sinkBinding 20,
  dependencyPolicy 2, sharedMarkedSingleton 1. Sum = 77.
- All ten of those functions are invoked unconditionally from `run()` (L3774-3785).
- Indentation census: 76 sites at indent 2 (function top level, executed once),
  1 site at indent 4 — L2673, inside `for (const rel of REQUIRED_SINKS)`.
  No `check(` sits inside a conditional.

**PREDICTION: EXPECTED_CHECK_CALL_SITES = 77.**

## 2. EXPECTED_CHECKS

Derivation: `EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)`.
`REQUIRED_SINKS` (L1020-1023) has 2 entries. The single looping call site emits
2 checks instead of 1, i.e. +1 over the call-site count.

77 + (2 - 1) = 78.

**PREDICTION: EXPECTED_CHECKS = 78, and the runtime `checks` counter reaches 78.**

## 3. EXPECTED_ASSERTIONS

Derivation: every `assert*` helper bumps `assertions` exactly once
(assertNoElement, assertElement, assertNotContains, assertContains, assertEqual,
assertNoEventHandlers — L65-110, one `assertions += 1` each; the nested `for`
loops at L103/104 are inside assertNoEventHandlers and do NOT bump). So the
total is the number of assert* CALLS EXECUTED.

Static call sites below L111 (i.e. excluding the helper definitions): **115**.
Indentation census: 114 at indent 4, 1 at indent 6. None sits inside an `if`.

Multiplicity corrections:
- L498, L499 sit in the arrow helper `assertSvgStyleStripped` (L496-500), which
  is called from THREE checks (L502 list, L506 blockquote, L510 table cell).
  2 sites x 3 calls = 6 executions, i.e. +4 over the static count.
- L711 sits in `for (const bad of [undefined, null, 42, {}, []])` (L700), 5
  iterations. 1 site x 5 = 5 executions, i.e. +4 over the static count.
- The two other loops in the region, L669 (ARITY_EVASIONS) and L679
  (ARITY_LEGITIMATE), contain NO assert* calls — they push onto `problems`.
- The 20 `sinkBinding()` checks and the 2 `dependencyPolicy()` checks throw
  directly and call no assert* helper at all.

115 + 4 + 4 = 123.

**PREDICTION: EXPECTED_ASSERTIONS = 123, and the runtime `assertions` counter
reaches 123.**

## 4. EXPECTED_SOURCE_FILES

Derivation: replicate `collectSourceFiles` + `isScannableSource` + the explicit
`EXTRA_SCANNED_FILES` push, over the on-disk tree.

- Recursive walk of `web/src/`, keeping a file iff
  NOT `/\.test\.[cm]?[jt]sx?$/` AND not ending in any INERT_EXTENSIONS entry
  (.css .scss .json .svg .md .txt .png .jpg .jpeg .gif .ico .webp .woff .woff2).
- Kept: **50** files.
- Excluded: 4 — `src/gen/farmtable.json`, `src/styles/theme.css`,
  `src/util/markdown.test.ts`, `src/utils/task-ready.test.ts`.
- EXTRA_SCANNED_FILES = ['index.html']; `web/index.html` exists, pushed by
  explicit path: +1.

50 + 1 = 51.

**PREDICTION: EXPECTED_SOURCE_FILES = 51 and `files.length` at runtime = 51.**

## 5. EXPECTED_REQUIRED_SINKS

Derivation: the literal length of the `REQUIRED_SINKS` array (L1020-1023), which
is deliberately NOT derived from it in the source. Two path strings:
`src/components/inspector/ft-inspector-comments.ts`,
`src/components/inspector/ft-inspector-desc.ts`. Both exist on disk (they appear
in the scannable set above).

**PREDICTION: EXPECTED_REQUIRED_SINKS = 2, REQUIRED_SINKS.length = 2.**

---

## Gates

- `npm test` -> exit 0, stdout `markdown sanitizer: 78 checks passed (123 assertions)`
- `npx tsc --noEmit` -> exit 0
- `npm run build` -> exit 0

## Meta-prediction on the tally sub-form

If all five literals in the source equal the five numbers derived above, the
"post-hoc tally" defect form is ABSENT on this tree for these five constants —
i.e. the totals were computed from the source, not read off a run. I predict
ABSENT (all five match), which would replicate round 7's clean negative.
