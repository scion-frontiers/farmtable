# PROJECT LOG — provision-writable (cold leg)

**Date:** 2026-07-29
**Agent:** security-auditor, cold leg
**ROOT:** `/workspace/farmtable-provision-writable`
**REVISION:** `cc927355e5a23c45bfd983cd331eb540b0a61ad5` (detached; 435 tracked files;
Preston Holmes 2026-07-28; merge of PR #205) — identity verified against the brief on all
three of SHA, author/date, and file count.
**Full report:** `reports/provision-writable.md`

---

## Question

What, in this product, sets the `writable` marker inside a collection's `remote_data`? An
operator has a GitHub-backed collection and wants editing on — what do they do?

## Answer

**Nothing. There is no supported action.** No line of code at this revision assigns a
`writable` key inside a collection's `remote_data`, and no operator-facing surface — admin
page, API field, config key, CLI flag, migration, seed file, or sync inference — can cause
one to be written for a GitHub-backed collection.

Scoped precisely: this is a claim about the **code**, not about the **world**. Stored rows
in a live database could contain the key by routes invisible to a tree. Settling that needs
`SELECT id, name, platform, remote_data FROM collections WHERE remote_data ? 'writable';`
against each live DB.

## Evidence, in brief

- Whole-tree sweep at the revision: **35 hits, exactly 5 files** — two project logs plus
  `web/src/capabilities.ts`, `web/src/components/ft-app.ts`,
  `web/src/components/ft-toolbar.ts`. All reads or prose. No writes.
- Go, one invocation, in-stream control: **279 `remotedata` hits vs 0 `writable` hits.**
  Real zero, live instrument.
- Proto: `remote_data` 3, `writable` 0 (same invocation). It is an **output-only** field on
  Task and Collection; `CreateCollectionRequest` has only name/description/platform/remote_id,
  `UpdateCollectionRequest` only id/name/description.
- GitHub passthrough `syntheticCollection()` (passthrough.go:645-654) never sets
  `RemoteData` at all → GitHub collections are nil-blob → never writable, by construction.

## Findings worth carrying forward

1. **Orphaned plumbing (the real diagnosis).** `store.CreateCollectionParams` and
   `store.UpdateCollectionParams` both already declare `RemoteData map[string]any`
   (store.go:154, 160), and `EntStore.UpdateCollection` implements correct read-modify-merge
   for it (entstore.go:1384-1399). **No caller populates either.** The feature was built
   bottom-up and stops one layer below the wire. The gap is the API surface and the server
   handlers — not the schema, which is finished.

2. **Import is an unvalidated arbitrary-`remote_data` write path, gated off by one line.**
   `export_import.go:332` copies operator-supplied JSON straight into the blob with no key
   allowlist; `export_import.go:306` restricts import to `farmtable`-platform collections.
   The marker is therefore writable only on the platform that ignores it and unreachable on
   the platform that reads it. **Note: this path writes the marker and contains no
   occurrence of the word "writable"** — a token-only search would have missed it.

3. **Security shape.** `writable` is the sole gate on issuing writes to a third-party GitHub
   repo, yet it is an untyped key in an unvalidated blob, trusted by the client on sight. If
   the import platform gate is ever relaxed, an uploaded JSON file becomes a self-service
   grant of external write access. Recommend a store-boundary key allowlist and a typed,
   authorized field **before** any provisioning path is built — much cheaper now than after.

4. **Documented tests that do not exist.** `passthrough-write-p1.md:69-75` marks
   *"isReadOnly returns false for writable GitHub collections — Done"* and its negative
   counterpart. The tree has **one** web test file (`web/src/utils/task-ready.test.ts`) and
   it is unrelated. Controlled sweep: 32 hits in non-test `.ts`, **0** in `*.test.ts`. The
   whole writable/capability surface is untested, and the primary document says otherwise.

5. **No design doc specifies a provisioning path at all.** Not the anticipated
   "spec-ahead-of-code" case — the inverse. Consumption is specified precisely; origin is
   never mentioned.

## ERRATUM, 07:47Z — my own population table did not close

Published per-file counts were 12 / 3 / 3 / 13 / 2 = **33**, against my own stated total of
**35**. Three of five cells were wrong (p1 11 not 12, p2 4 not 3, ft-app 15 not 13);
corrected they sum to 35. Total, file list, filenames and all conclusions unaffected — the
finding rests on the zero Go hits and the identity of the five files.

**How it survived a heavily controlled report:** every *sweep* carried a within-invocation
control; the *table cells* carried none. They were transcribed by eye from sweep output. I
wrote §3b demanding each cell state its own provenance and then filled that table by reading
numbers off a screen. **A control on the instrument is not a control on the transcription.**

**What caught it:** not a demand for integers — I had already published integers and they
were wrong — but a demand that the column *sum*. Closure is a redundancy check; it forces
one figure to be derivable from its neighbours, so a miscopied cell has to be consistent to
survive. Recommend future population tables always publish the sum next to the parts.

**Possible downstream consequence:** the only "12" in the report was that erroneous p1 cell.
A coordinator has been chasing a "twelve" attributed to provision-writable. If it was
harvested from here, it was harvested from a miscount of grep hits in a markdown file, not
from any commit census. Hypothesis, not measurement.

## Method notes for future legs

- For **blob-valued fields**, pose the question as *what writes the container*, not *what
  writes the key*. A fully controlled token sweep can return a correct zero for the wrong
  reason. §4-style controls prove the instrument is alive; they prove nothing about whether
  it is aimed correctly.
- Confirmed: zsh unquoted glob is fatal (`api/farmtable/v1/*.proto` aborted; the source is
  `proto/farmtable.proto`).
- Cold-leg hygiene held: `reports/writable-key-path.md`, `briefs/audit-writable-path.md`,
  and `briefs/ptone-*` were not opened. **However** — the brief's own §4 worked example
  ("11 TypeScript hits and 0 Go hits") disclosed the shape of the adjacent result before I
  measured. Reconciliation should discount my Go-zero accordingly. Future briefs should draw
  control-form examples from an unrelated question.

## Compliance

Read-only throughout. No production code modified, no commit, no push, no build, no test
run, no run-queue append (nothing was run that required one). Reported to eng-manager only.
