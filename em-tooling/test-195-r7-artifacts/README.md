# test-195-r7 mutation harness — preserved artifacts

Harness used for the round-7 independent test review of **#195 markdown-sanitize**
(`/workspace` at `7b4f6dd`, range `86f30bc..7b4f6dd`). 105 scored mutations,
103 caught. Report:
`/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r7.md`.
Project log: `.design/project-log/markdown-sanitize-test-review-r7.md` (commit `6e3aa53`).

Copied verbatim from `/tmp/mut/` before container GC. 37 files, verified by
per-file sha256 in both directions (37/37 source→dest, 37/37 dest→source, no
path present on one side only, no hash mismatch on any common path). No
`node_modules` was present in the source tree and none is here.

**These scripts assume `cwd = /workspace/web`** and hard-code absolute paths to
`/workspace/web/...` and `/tmp/mut/...`. They will need path edits to run
elsewhere. They mutate the working tree and restore it; do not run them against
a tree with uncommitted work you care about.

---

## Why the abort paths are the load-bearing part

A mutation harness that silently does nothing reports GREEN, and GREEN is read as
"no test catches this" — a **false negative finding**, which is the most expensive
kind of error a review leg can ship. This happened once in this round and was
caught only by an abort:

> **Void run 2 (C3).** The first attempt to strip the `U+FE0E` variation selector
> from the checkbox renderer used `"\\\\uFE0E"` inside a shell-quoted `node -e`,
> which is two literal backslashes plus `uFE0E` and matches nothing in the file.
> `mutate.mjs` aborted on prerequisite 1 (anchor not found) and wrote nothing.
> **Without that abort the run would have written an unchanged file, exited 0, and
> the report would have claimed "the U+FE0E variation selector is unpinned."** It
> is pinned: re-run with the anchor extracted programmatically from the file, C3
> is RED across four checks.

Two further aborts prevented the same class of error (T1/T2 v1, hand-typed
multi-line anchors that did not match byte-for-byte), and two RED-TSC results
prevented the opposite error — scoring a `tsc` rejection as "a test caught it"
when no test had run (I4, I10; re-done as shims I12/I13, both genuinely RED).

**ABORT is scored in its own column. It is never PASS and never FAIL.**

---

## What each script ABORTS on

### `mutate.mjs` — single content-addressed mutation (exit 3 = ABORT)

Aborts, touching nothing, on:

1. **Missing arguments** — usage error.
2. **Anchor not found** in the target file. *(This is the one that saved C3.)*
3. **Anchor is not unique** — occurs 2+ times. Prevents mutating a different
   occurrence than intended, which is how a line-addressed harness silently
   drifts.
4. **No-op mutation** — replacement is byte-identical to the anchor. Prevents
   "GREEN because nothing changed" being read as "GREEN because nothing caught it".
5. **`npm` could not be spawned** (`r.error`).
6. **No child exit status** (`status === null`).
7. **Restore failed** — the file is re-read after the `finally`-block restore and
   compared byte-for-byte against the in-memory original; a mismatch aborts and
   says the repository is dirty.

Verdict channel: `spawnSync('npm',['test']).status` — the **child process exit
status**, never a pipe, never parsed from stdout. stdout is used only to *name
the rule that fired*, after the colour has already been decided by the exit code.

Exit map: `3` = ABORT, `0` = GREEN (suite passed → mutation uncaught), `1` = RED.

### `run2.mjs` — multi-edit batches (`node run2.mjs spec.json`)

Same contract, plus:

- **Two-phase.** *Every* anchor in a spec is validated against the **pristine**
  file before **any** write happens. A batch with one bad anchor writes nothing at
  all, rather than half-applying.
- Anchor uniqueness is re-checked against the staged (partially-edited) buffer, so
  a second edit cannot land on text the first edit created.
- Restore is verified by re-read for every touched file; a failed restore is
  `process.exit(3)` for the **whole run**, not just the spec.
- Classifies **`RED-TSC`** separately from `RED`: if the child output contains
  `error TS\d+`, the compiler rejected the mutation and **no test was exercised**.
  These are void, not caught. This is what caught I4/I10.
- Marks `<<< UNEXPECTED` when the outcome differs from the `expect` field, which
  must be written into the spec **before** the run.

### `runfiles.mjs` — file create/delete plus edits

Everything `run2.mjs` does, plus:

- **Create target already exists** → ABORT (prevents clobbering a real file).
- **Delete target missing** → ABORT.
- Deleted files are restored from an in-memory byte-exact copy; created files are
  unlinked.
- **After every spec it runs `git status --porcelain` and exits 3 if the output
  is non-empty.** This is the backstop for the whole campaign: it never fired,
  which is the evidence that the tree was clean throughout, independent of any
  claim the harness makes about itself.

### `batch.mjs` — thin driver over `mutate.mjs`

No prerequisites of its own; it **shells out** to `mutate.mjs` and reads that
child's exit code (`3` → ABORT, `0` → GREEN, else RED). Superseded by `run2.mjs`
for anything multi-edit. Writes its anchor/replacement scratch to `/tmp/mut/.a`
and `/tmp/mut/.r`.

### `probediff.mjs` — equivalent-mutant discriminator

Answers "did this GREEN mutation change **behaviour** at all?", which is what
separates *a coverage hole* from *an equivalent mutant*. Aborts (exit 3) on:
anchor not found, anchor not unique, no-op replacement, probe process failure,
restore failure. Exits **4** — a distinct, non-scored code — when `tsc` rejects
the mutation. Recompiles the baseline in the `finally` block so the tree is left
buildable.

**Known unguarded prerequisite (disclosed):** it compares against
`probe.base.txt`, a *file on disk*. If that baseline is stale relative to the
working tree, the comparison is meaningless and nothing detects it. Regenerate it
(`node probe.mjs > probe.base.txt` on a pristine tree) before trusting any run.
This was done manually in the round; it is not enforced by the script.

**How its own trustworthiness was established:** it reported `BEHAVIOUR CHANGED`
for the `'slot'` mutation on the run immediately after reporting
`BEHAVIOUR UNCHANGED` for `'formaction'`. A probe that only ever says "unchanged"
proves nothing.

### `probe.mjs` — behaviour corpus (no aborts; it is a printer)

Renders 24 payloads through the current working-tree `renderMarkdown` under
JSDOM and prints `index<TAB>JSON(output)`, plus an `ARITY` line
(`renderMarkdown.length`) and a `NONSTR` line (`renderMarkdown(42)`).

**Limitation, stated plainly:** the corpus is a fixture, and *a fixture that
cannot express the failing input* is precisely the defect class this round was
hunting. "No change over this corpus" is not "no change". For the `formaction`
result the review therefore leaned on a corpus-independent fact — `formaction`
appears nowhere in `node_modules/dompurify/dist/purify.cjs.js` — rather than on
the probe. For `Y10` (`ADD_URI_SAFE_ATTR`) only the corpus was available, which
is why the report flags that classification as the weaker of the two.

### `predict.mjs` — static, source-only count prediction (no aborts)

Reads `markdown.test.ts` and prints, **without running the suite**:

- `check(` call sites at line-start indent → **74** (= `EXPECTED_CHECK_CALL_SITES`)
- `assert*` textual occurrences (**120**) minus definitions (**6**) → **114** static
  call sites
- every `for (` loop whose body contains an `assert*`, so loop multipliers can be
  applied by hand

The published derivation of `EXPECTED_ASSERTIONS`:

```
114 static assert call sites
 -2  the two asserts inside the local helper assertSvgStyleStripped
 +6  because three checks call that helper (3 x 2)
 +4  because `for (const bad of [undefined, null, 42, {}, []])` runs its
     single assertEqual five times, not once
----
122  == EXPECTED_ASSERTIONS
```

This is the executable form of the round's strongest single result: the pinned
totals in `markdown.test.ts` are **predictions reproducible from source**, not a
tally read off the run. `EXPECTED_SOURCE_FILES = 51` was derived the same way but
with shell (`find src -type f`, minus `INERT_EXTENSIONS`, minus `*.test.*` → 50,
plus `index.html` from `EXTRA_SCANNED_FILES`).

**Limitation:** the −2/+6/+4 adjustments are **not** computed by the script; it
reports the raw counts and the loop inventory, and a human applies the
multipliers. If a future round adds a second multi-assert helper or another
assert-bearing loop, the script will surface the loop but the arithmetic must be
redone. It is a prediction *aid*, not an oracle, and it has no abort path — a
moved or renamed source file makes `readFileSync` throw, which is the only
failure mode it has.

### `lib.sh` — shell wrapper

Sources a `mut()` helper. It **reports** `!!! ABORT (not scored)` on exit 3 but
deliberately `return 0`s so a batch loop continues. Retained for provenance;
`run2.mjs` is the better entry point.

---

## Spec files

Each is a JSON array of `{id, expect, edits:[{file, anchor, repl}]}` (plus
`creates`/`deletes` for `runfiles.mjs`). **`expect` was written before the run** —
that is the point of the field, and `<<< UNEXPECTED` in the summary is the only
honest way to record a wrong prediction (see `Y8` in the report, where the
prediction was wrong and the suite was right).

| Spec | Group | What it mutates |
|---|---|---|
| `specA.json` | A/B | each `FORBID_TAGS` / `FORBID_ATTR` entry, one at a time |
| `specCG.json` | C/E/F/G/W | checkbox renderer, non-string guard, arity spellings, the `sanitize` call |
| `specC3.json` | C3 | the `U+FE0E` escape — **the void-run-2 case**, re-done with a file-derived anchor |
| `specH.json` | H | sink binding R1–R9 against the real inspector components |
| `specK.json` | K | all 8 `BANNED_SINKS` patterns, incl. `web/index.html` (audit LOW-2) |
| `specI.json` | I | the test file's own rule predicates (`run2` shims) |
| `specI2.json` | I | **F-1**: `fixtureTableViolation` neutered, alone and combined — I11/I18/I19/I20, all GREEN |
| `specT.json` | T/Z | **F-3**: T1 (RED) vs T2 compensated evisceration (GREEN); count-pin firing |
| `specTJ.json` | J | dependency floor + sunset clause + the two negative controls |
| `specN.json` | N | tree-level: add/delete scanned files (`runfiles.mjs`) |
| `specW.json` | W | second unsanitized export, unused (W3) then wired to a sink (W4) |
| `specX.json` | X | **F-2**: blinded declaration scan isolating `Function.length` — X3/X1 GREEN, X2 RED |
| `specY.json` | Y | 10 DOMPurify config axes |

Scratch files `.a .r .rF1-.rF4 a0-a4 r0-r3` are anchor/replacement fragments left
in place so the corresponding runs are byte-reproducible. `probe.base.txt` is the
pristine-tree behaviour baseline for `probediff.mjs`.

---

## Reproducing the three findings

```bash
cd /workspace/web && npm install --no-audit --no-fund   # no node_modules in-container
npm test                                # exit 0, "75 checks passed (122 assertions)"
node <dir>/run2.mjs <dir>/specI2.json   # F-1: I11/I18/I19/I20 GREEN
node <dir>/run2.mjs <dir>/specX.json    # F-2: X3 GREEN, X1 GREEN, X2 RED
node <dir>/run2.mjs <dir>/specT.json    # F-3: T1 RED, T2 GREEN
node <dir>/predict.mjs                  # 74 check sites, 114 assert sites -> 122
```

Run the positive control (`PC1`, drop `'form'` from `FORBID_TAGS`, must be RED)
before trusting any GREEN from a modified harness.
