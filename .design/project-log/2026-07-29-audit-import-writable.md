# 2026-07-29 — Bounded trace: import path and the `writable` capability flag

Leg: `audit-xss-r5`, answering a routed read-only question (not a review round).
Tree: `/workspace/farmtable-xss-r5-audit` on `audit-leg-xss-r5`; subject ref `d305391`.
Full report: `reports/xss-r5-import-writable.md` on the scratchpad volume (untracked by design).
Pre-registration: `PREREG-2.md`, written before any file in the trace was opened.

## Question

Can an import document make the Lit dashboard's `remote_data["writable"]` capability gate
open? Premise supplied by the review leg: two Lit read sites branch on the key as a
write-authorization gate, and nothing in the tree writes it.

## Answer — pre-registered BRANCH B fired: **no**

**`writable` is not a security boundary. It is an inert UI affordance.** Highest severity LOW.

Four independent barriers, any one sufficient:

1. `ImportCollection` rejects any document whose `collection.platform` is not `farmtable`.
2. **`importParams.Collection.Platform` is a hardcoded server-side constant** — the document's
   platform value is validated and then discarded. Deleting barrier 1 changes nothing. The
   Beads branch never reaches barrier 1 and is safe purely because of this.
3. `entstore.ImportCollection` is `tx.Collection.Create()`; `ImportCollectionParams` has no
   collection-ID field. Import is create-only and cannot target an existing collection.
4. Platform is immutable after creation — `UpdateCollectionParams` has no `Platform` field.

The client-side short-circuit makes it decisive: `getCapabilities` returns `ALL_ENABLED` for
`FARMTABLE` **one branch before the line that reads `remoteData`**. An importer can set
`writable: true`; on the only collections an import can produce, nothing ever looks at it.

## The measurement that would have decided severity if Q1 had been yes

`GITHUB_CAPABILITIES` enables nine operations, reaching `CreateTask`, `UpdateTask`, `AddComment`.
All three require `RequireIdentity` + `RequireScope(ScopeTaskWrite)` + `RequireCollectionAccess`,
and `UpdateTask` derives the collection from the **stored** task, so the client cannot redirect
the access check. No handler consults any client-supplied capability; no Go reads `writable`.
So the escalation dies **twice, independently** — the flag is both unreachable and worthless.

I added a fourth branch to the three I was given (Q1 yes, Q2 yes, some capability ungated =
HIGH), because the given three omitted the only outcome that would have been serious. It is
refuted by measurement, not assumption.

## Findings

| # | Sev | Summary |
|---|---|---|
| F1 | INFO | The `writable` branch is dead — and dead **fail-closed**: an unwritten key selects `ALL_DISABLED` |
| F2 | LOW | **Latent coupling.** The store layer fully implements collection `remote_data` write+merge; `CreateCollection`/`UpdateCollection` simply never populate it. One line in a params literal is the whole safety margin |
| F3 | INFO | **Downgrade of my own r5 F5.** Its "unpinned input-type precondition" is now pinned on the import path |
| F4 | UNCHECKED | Possible convergence with the open "free row on an authorization path" item — import creates users with document-chosen UUIDs. Named, not chased |

**F2 is the one to remember.** `graph_support.go` already branches server-side on
`c.RemoteData["graph_queries"]`, so "the server would never trust collection remote_data" is
empirically unavailable in this codebase. Recommendation is a comment at both params literals,
and — if the read-only/read-write distinction is wanted for real — a typed column with a
server-side check, not a free-form JSON key.

## Corrections to the premise

Accurate on every point it asserted. Two gaps, neither changing its conclusion:
`GitHubPassThroughStore.ImportCollection` returns `ErrNotImplemented` (a *second* store
implementation, which strengthens the premise), and `CreateCollection`/`UpdateCollection` went
unmentioned — they are the paths that *can* address GitHub collections, so "import is the only
writer" needed verifying rather than accepting. That verification is F2.

## Process notes

- Read-only throughout. **No build, no test run, no token requested, no tree modification.**
- Zero-writer sweep is positive-controlled per §10.20: the same `SetRemoteData` search returns
  six non-generated hits, so the zero for `writable` is not an unproven zero.
- §10.25 gap declared in the report: the capability claim is an *enumeration*, not a plant. I
  ran nothing, so points 1–3 had nothing to attach to.
- Not checked, and listed as such: gRPC interceptors, the MCP and CLI surfaces, out-of-tree
  writers, `resolveImportUsers`, and the open HIGH on `ImportCollection` (excluded by instruction).
- Report written to the volume uncommitted; no `reports/` directory created in any working tree;
  branch verified with `git rev-parse --abbrev-ref HEAD` before committing this log.
