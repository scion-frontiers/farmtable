# Project log — audit-writable-path

**Date:** 2026-07-29
**Leg:** audit-writable-path (security-auditor)
**ROOT:** `/workspace/farmtable-writable-path`
**SHA:** `7a0f220dbd9332cb8db62138c841777432b4eda4` (detached HEAD; clean tree, zero
untracked files per `git status --porcelain --untracked-files=all`)
**Mode:** read-only. No build token used. No commits, no push, no test run, no database
opened. `_run-queue-log.md` not appended to, because nothing was run.
**Full report:** `reports/writable-key-path.md`

---

## Question

What path can cause the key `writable` to be present and set to `true` in the
`remote_data` map on a stored collection — including ingest, sync, import, migration,
fixture and seed data? (Not "what code sets it.")

## Cell

**CELL 7** — a compound that no single pre-registered cell states.

## One-line answer

`ImportCollection` copies the uploaded document's `collection.remote_data` map verbatim
into the stored collection row (`internal/server/export_import.go:332` →
`internal/store/entstore.go:2117`) with **no key validation**, so `writable: true` can be
present; but the same path hard-codes `platform = farmtable`, and both dashboard read
sites short-circuit on `FARMTABLE`, so the key is currently **inert** — and the flag was
never an authorization control anyway, because **no Go code enforces read-only at all**.

## What was established

1. **The premise in the original product question is false at the presence layer.**
   "Nothing anywhere in the product ever sets that marker, so it is always no" measured
   only that no Go line assigns the key. `export_import.go:332` copies an
   attacker-authored `map[string]any` straight through. `decoder.DisallowUnknownFields()`
   at line 296 does **not** help: it constrains struct decoding only, and
   `exportCollection.RemoteData` is a map.
2. **Exactly three persistence write sites exist for a collection's `remote_data`**
   (`entstore.go:1365`, `:1384-1399`, `:2116`). Only the third is reachable with
   caller-controlled keys. The `CreateCollection` and `UpdateCollection` RPCs never
   populate `RemoteData`, and `remote_data` is **not a field on either request message in
   `proto/farmtable.proto`**.
3. **The closure is a conjunction, not a control, and it is unowned.** What prevents
   `platform=github` + `writable=true` on one row is (a) import hard-coding
   `PlatformFarmtable` and (b) the proto having no `remote_data` input — two unrelated
   facts in two files, neither annotated as security-relevant.
   `git grep 'import only supports farmtable' -- '*_test.go'` → **no match**. A one-line
   change to either file opens the path with CI fully green.
4. **Adjacent latent defect: one key, two disagreeing predicates.**
   `capabilities.ts:97` consults `writable` only when `platform === GITHUB`;
   `ft-app.ts:229/239` consult it for **every** non-farmtable platform. The Ent enum
   admits `linear`, `jira`, `asana`, `beads`. A Linear collection with `writable: true`
   would show `isReadOnly === false` and the `↔ GitHub` badge while `getCapabilities`
   returns `ALL_DISABLED`. Latent today for the same conjunction reason.
5. **The finding that outranks the question — and it is outside the brief.**
   `grep -rni 'read_only\|readonly\|read-only' --include='*.go' internal/ cmd/` →
   **exit 1, zero matches**. No Go code reads `writable`; there is no server-side notion
   of a read-only collection. The nine operations are gated only by gRPC scopes, which do
   not consult `platform` or `remote_data`. **The read-only badge advertises an
   enforcement that does not exist.** Planting the key grants an attacker nothing they
   did not already have — the exposure is the inverse of the one anticipated.

## Severity

| Finding | Severity |
|---|---|
| No server-side enforcement behind a UI advertising it | **High** |
| Unvalidated attacker-authored map persisted verbatim (`export_import.go:332`) | **Medium** |
| Closed-but-unowned conjunction, zero tests | **Medium** |
| `writable` can be present and true (the literal question) | **Low** |

Note on the Medium: the same unvalidated copy also carries `graph_queries`, which **is**
read server-side at `graph_support.go:27` and changes query routing. The defect is the
copy, not the key.

## Recommended remediation (not applied — read-only leg)

1. Put the gate server-side, next to the existing `RequireScope` calls, or stop
   advertising it in the UI. Do not remediate by filtering the `writable` key — that
   closes the cosmetic path, leaves the substantive gap, and makes the tree look audited.
2. Bound the import copy: allowlist or reject unknown top-level keys in
   `collection.remote_data`, and add a test that pins it.
3. Add a test pinning `export_import.go:331` (import forces `farmtable`), so the
   conjunction has an owner and something goes red.
4. Give `isCollectionWritable` the same platform test `getCapabilities` has, or route both
   through one predicate.

## Explicitly NOT established

- **Whether the key is already present in any real stored data.** No database was opened.
  The repo grep is a statement about this tree at this SHA, not about the world. Settle
  with `SELECT id, name, platform, remote_data FROM collections WHERE json_extract(remote_data,'$.writable') IS NOT NULL;`
  (SQLite) / `... WHERE remote_data ? 'writable';` (Postgres) per environment.
- **Behavioural confirmation.** The import chain is a static read of a straight-line
  assignment, not an observed run.
- **Phase 2 (`633f8f2`, `/workspace/farmtable`) — not read at all.** If Phase 2 adds
  `remote_data` to `CreateCollectionRequest` or honours `doc.Collection.Platform` on
  import, the conjunction breaks and the Low becomes serious. Someone must re-run the
  proto and caller checks against that SHA; this report does not cover it.
- `git log -S writable` was not run; would sharpen the fixture/seed question cheaply.

## Errors found in the dispatching brief

1. The brief's contingency ("if the path exists it becomes an authorization finding") has
   a true antecedent and a false consequent. The real authorization finding is the one it
   did not ask about.
2. "`remote_data` is a security boundary" points one step short — the boundary is the
   single unvalidated copy at line 332, not the map, and framing it as a key question
   invites the wrong fix.
3. Cell 3's ownership question was conditioned on landing in cell 3. There was no
   allowlist, so by the brief's routing the highest-yield question would never have been
   asked. Un-condition it.
4. Cell 5 is a **data** question assigned to a **repo-only, no-run** leg — a structural
   invitation to write an instrument-scoped negative as a question-scoped conclusion.
   Split it into a leg with database access.
5. SHELL FACTS: `grep` is ugrep 7.5.0, but the binary is not on `PATH` as `ugrep`
   (`command not found`). Worth adding.

## Process note

Three brief instructions changed the result: `ls -a` (dotfile population), "report the
bound with the finding" (which forced the cell-5 honesty in §4.1 rather than letting a
repo grep pose as a data answer), and "exceeding the brief reads as compliance" — the
High-severity finding and the ownership analysis are both outside the suggested surface
and outside the question as posed.
