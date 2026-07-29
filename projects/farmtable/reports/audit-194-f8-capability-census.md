# F8 — CAPABILITY CENSUS, n=15

**Leg:** `audit-xss-r8` · **For:** `farmtable-em-hardening` · **Base: `faf1c8c2738ed40c2dfe5b31b45aef848a98138b`** ("Give each test store its own in-memory database", 2026-07-29 12:57:50 +0000).
Analysis only. No code changed, no branch touched, nothing built, nothing run.

---

## HEADLINE, BEFORE THE TABLE

The n=1 routing was wrong, but **not** in the direction the population size suggested. The census does not yield ten
authorization bypasses. It yields:

- **5 flags UNENFORCED-EXPOSED** — nothing consumes them and the operation they name is reachable and server-permitted.
- **4 more flags with the identical server-side gap**, differing only in that a client-side gate exists — and *a client-side
  gate is not an authorization control*. So the **exposed population by impact is 9, not 5**.
- **All 9 close with ONE server-side change.** I would scope **one** dev leg, not nine.
- The other **6 flags are ADVISORY-BY-DESIGN or ENFORCED** — the Go server independently prevents those operations. They are
  not findings however uncalled they look from the web tree. This is the trap you named and it caught six of fifteen.

The single load-bearing fact: **the string `writable` does not occur in one line of Go.** It occurs in exactly 5 files in the
whole tree — 3 under `web/`, 2 under `.design/`. There is no server-side writability check of any kind, no interceptor, no Ent
hook, no shared helper. The entire read-only model for external collections is client-side only.

---

## THE TABLE — all 15, denominator 15 on every count

`sites` cites the **enclosing identifier**, never a line number. `count` is enforcement sites for that flag outside
`capabilities.ts`.

| # | flag | enforcement sites (file → IDENTIFIER) | count | SERVER-SIDE ENFORCED? | verdict | tag |
|---|------|----------------------------------------|-------|----------------------|---------|-----|
| 1 | `canEditTitle` | *none* | 0 | **no** | **UNENFORCED-EXPOSED** | MEASURED |
| 2 | `canEditDescription` | *none* | 0 | **no** | **UNENFORCED-EXPOSED** | MEASURED |
| 3 | `canChangeStage` | `ft-kanban-column.ts` → `isStageChangeDragDisabled`; `ft-kanban-view.ts` → `onStageChange` | 2 | **no** | ENFORCED (client only) | MEASURED |
| 4 | `canChangePriority` | *none* | 0 | **no** | **UNENFORCED-EXPOSED** | MEASURED |
| 5 | `canChangeAssignee` | `ft-inspector-meta.ts` → `onAssigneeRemove`, `startAssigneePick`, `renderAssignees` | 4 | **no** | ENFORCED (client only) | MEASURED |
| 6 | `canChangeParent` | `ft-tree-view.ts` → `isReparentDisabled` | 1 | **no** | ENFORCED (client only) | MEASURED |
| 7 | `canAddComment` | *none* | 0 | **no** | **UNENFORCED-EXPOSED** | MEASURED |
| 8 | `canCloseTask` | *none* | 0 | **no** | **UNENFORCED-EXPOSED** | MEASURED |
| 9 | `canCreateTask` | `ft-kanban-column.ts` → `onAddTaskClick`, `render`; `ft-kanban-view.ts` → `onColumnAddTask`, `onTaskCreate`, `render` | 5 | **no** | ENFORCED (client only) | MEASURED |
| 10 | `canDeleteTask` | *none* | 0 | **yes** | ADVISORY-BY-DESIGN | MEASURED |
| 11 | `canEditDates` | `ft-inspector-meta.ts` → `startDateEdit`, `clearDateEdit`, `render` | 6 | **yes** | ENFORCED | MEASURED |
| 12 | `canEditAcceptance` | *none* | 0 | **yes** | ADVISORY-BY-DESIGN | MEASURED |
| 13 | `canEditRelationships` | *none* | 0 | **yes** | ADVISORY-BY-DESIGN | MEASURED |
| 14 | `canEditCodeContext` | *none* | 0 | **yes** | ADVISORY-BY-DESIGN | MEASURED |
| 15 | `canDragReorder` | *none* | 0 | **yes** | ADVISORY-BY-DESIGN | MEASURED |

**Population closure: ENUMERATED 15 = ENFORCED 5 + ADVISORY-BY-DESIGN 5 + UNENFORCED-EXPOSED 5 + UNENFORCED-INERT 0.**
My r8 claim of "10 with zero sites" **reproduces exactly** at `faf1c8c`: 10 zero-site + 5 with-site = 15. What changes under
the server column is the *meaning* of those ten, and it splits them 5/5.

---

## WHY THE SERVER COLUMN SPLITS THE TEN

`GITHUB_CAPABILITIES` sets exactly **6** flags false: `canDeleteTask, canEditDates, canEditAcceptance,
canEditRelationships, canEditCodeContext, canDragReorder`. Those 6 are the only flags carrying information beyond the
separate `readOnly` boolean — a flag true in both `ALL_ENABLED` and `GITHUB_CAPABILITIES` is false only in `ALL_DISABLED`,
which is precisely the case `isReadOnly` already covers.

For those 6, the Go server independently prevents the operation, which is why they are **not findings**:

- **`canDeleteTask`** — `(*FarmTableService).DeleteTask` in `internal/server/server.go` returns
  `codes.Unimplemented, "delete is not supported; close tasks instead"` for **everyone**, before any task or collection
  lookup. Read directly, not via tooling.
- **`canEditAcceptance` / `canEditRelationships` / `canEditCodeContext` / `canDragReorder` / `canEditDates`** —
  `(*GitHubPassThroughStore).UpdateTask` in `internal/platform/github/passthrough.go` consumes **only**
  `Title, Description, Stage, Priority, Type, AddLabels, RemoveLabels, AssigneeID, ParentTaskID, ClearParent`.
  `AcceptanceCriteria`, `AddBlocks`, `AddBlockedBy`, `RemoveRelationships`, `Repo`, `Branch`, `AddPullRequests`,
  `CIStatus`, `Rank`, `StartDate`, `DueDate` are never read. `(*GitHubPassThroughStore).InsertTasksAfter` returns
  `store.ErrNotImplemented`.

That enforcement is **by omission, not by rejection** — see the caveat below, which is an integrity bug, not an authz bypass.

---

## THE UNENFORCED-EXPOSED SHORTLIST — 5 of 15

Attacker model: an authenticated principal holding `task:write` scope and collection access — i.e. an ordinary user who is
*supposed* to have read-only visibility of an external collection — issuing the gRPC call directly instead of using the UI.
The three server gates (`RequireIdentity`, `RequireScope`, `RequireCollectionAccess`) all pass for such a principal; none of
them consults platform, `remote_data`, or writability. `(*FarmTableService).UpdateTask` never calls `GetCollection`, so it
**cannot** know the platform.

For all five, the passthrough store *does* implement the field and pushes it to the real GitHub issue **using the linked
account's stored token**. So the write lands in a third-party repository.

1. **`canEditTitle`** — attacker rewrites the title of a live GitHub issue in a repo the product presents as read-only.
2. **`canEditDescription`** — attacker rewrites the body of a live GitHub issue. *(Body is also the markdown render sink
   under F4 — cross-reference only; F4 is `test-xss-r8`'s and I have not touched it.)*
3. **`canChangePriority`** — priority is mapped onto GitHub **labels** by the passthrough, so the attacker mutates label
   state on the real repository. `DERIVED` — I confirmed `p.Priority` is consumed by passthrough `UpdateTask`; I did not
   trace the label mapping to its GraphQL mutation.
4. **`canAddComment`** — attacker posts a comment to a live GitHub issue, authored under the linked account's identity.
5. **`canCloseTask`** — attacker closes a live GitHub issue.

**The honest qualifier, stated plainly:** for these five the client *does* still block the UI path via the separate
`readOnly` property, which is true whenever the flag would be false. So the unconsumed flag adds **no additional
client-side** exposure. **The entire exposure is server-side**, and it is identical for the four flags I marked ENFORCED
(`canChangeStage`, `canChangeAssignee`, `canChangeParent`, `canCreateTask`) — their client gate stops a browser, not a
gRPC client. I am not inflating those four into the shortlist, but any fix must cover all nine.

---

## TWO SECONDARY ITEMS FOUND WHILE MEASURING (not part of the 15)

- **`writable` is set by nothing in the product.** Zero Go occurrences; `UpdateCollection` only ever writes `remote_id` and
  `remote_url` into `remote_data`; `ImportCollection` hard-rejects non-Farmtable docs and forces
  `Platform: PlatformFarmtable`. So `GITHUB_CAPABILITIES` is currently **dormant** — every GitHub collection evaluates to
  `ALL_DISABLED`, `isReadOnly === true`. This makes the shortlist *worse*, not better: **every** GitHub collection is
  nominally read-only, and the server enforces none of it.
- **Silent-drop integrity bug.** The passthrough returns **HTTP 200 and a task object** after discarding
  `AcceptanceCriteria`/`Rank`/relationships/code-context/dates. The client is told the edit succeeded when nothing changed.
  Not an authorization bypass — a data-integrity and UX defect. Recommend a distinct `FailedPrecondition`.
- **Prop-propagation gap.** `ft-inspector-relationships` and `ft-dependency-view` receive `?readOnly` but never
  `.capabilities`; `ft-inspector-code` receives neither. Any future `canEditRelationships` gate added there would be
  **inert on arrival**, because `this.capabilities?.canX === false` is `false` when `capabilities` is `undefined`. Worth
  fixing at the same time as the server gate so the flag can never silently no-op.

---

## RECOMMENDATION

**One dev leg, not nine.** Add a single mutation-path writability gate on the server — the natural seam is
`(*FarmTableService).UpdateTask` / `CloseTask` / `AddComment` / `CreateTask`, or better a shared helper alongside
`RequireScope`/`RequireCollectionAccess` in `internal/server/scopes.go`, since those handlers already load the task and can
load the collection. It must consult collection platform and `remote_data`, and it must be the *server's* decision. Closing
that closes all nine rows at once. The client flags can then stay exactly as they are — advisory UI hints, correctly labelled.

---

## METHOD

**Corpus.** Every measurement reads the **commit tree** `faf1c8c` out of the canonical object store via
`git --git-dir=/workspace/farmtable/.git show|grep|ls-tree faf1c8c -- <path>`. This is not a path filter; it is structural.
A commit tree **cannot** contain the five stale copies under `.claude/worktrees/` or a built `web/dist`, because neither is
tracked. Verified, not assumed: `ls-tree -r` at `faf1c8c` yields **435 tracked files**, of which `.claude/worktrees/` = **0**,
`web/dist/` = **0**, `node_modules/` = **0**, `web/src/*.ts` = **51**, `*.go` = **208**. No count in this report can be
quintupled. Nothing was cloned, fetched, checked out, built, or written to any tree.

**Population.** N=15 taken from `interface CollectionCapabilities` in `web/src/capabilities.ts` at `faf1c8c`, extracted
mechanically, not by eye. Denominator 15 carried on every aggregate.

**Second instrument, per the standing rule that grep is not an oracle.** Before writing UNENFORCED-anything I tested for a
*dynamic* gate that would enforce every flag while naming none — computed access (`caps[...]`, `capabilities[...]`) and
`Object.keys/entries/values` over a capabilities object. **Zero hits (exit 1).** There is no dynamic dispatch. The
zero-site finding is therefore not a naming artefact. The server column was answered by reading Go — the passthrough store,
the RPC handlers, the multistore routing — never by grepping the web tree, and I read `DeleteTask` and the passthrough
`UpdateTask` bodies myself rather than accepting a summary of them.

**Three errors caught in flight, recorded because they nearly became findings:**

1. I invoked `git` through a shell variable; under zsh it failed, and the pipeline printed **four confident zeroes** that
   would have read as my corpus proof. Caught because I printed the error stream. Re-ran with the command spelled out and
   an `exit=0` assertion. *A count from a command that did not run looks exactly like a count of zero.*
2. `ft-tree-view.ts` matched `/rank/` — the hit is **`rankdir`**, a dagre graph-layout option, not a task ordering field.
   Had I stopped at the file-level match I would have reported `canDragReorder` as having a live reorder surface.
3. `SORT_ORDER_ASC/DESC` in the proto is a **query sort direction**, not a drag rank. The real rank field is
   `UpdateTaskRequest.rank` (field 25), found by reading the message rather than by name-matching.

**Corroboration.** The Go-side authorization sweep was run twice by two instruments — my own reading and an independent
search agent given the same commit-tree-only constraint. They agree on the load-bearing negative (no `writable` in Go, no
interceptor, no Ent hook, no shared mutation guard). Where the agent reported handler internals I re-read the two decisive
bodies (`DeleteTask`, passthrough `UpdateTask`) directly before relying on them.

**Tagging.** Every table row is **MEASURED**. The one **DERIVED** claim in the whole document is the priority→GitHub-label
mapping in shortlist item 3, tagged in place. **UNCHECKED:** I did not execute anything, so no claim here rests on runtime
behaviour; the silent-drop and fallback-routing behaviours are read from source, not observed.

**Known limit.** `(*MultiStore).storeForCtx` falls back to `m.primary` when lazy resolution fails, which would write every
dropped field into the local Ent DB. I could not construct a reachable state where a GitHub-platform collection holds tasks
in the primary store — the import path forces `PlatformFarmtable` — so I am **not** claiming that fallback as exploitable.
It is noted as a fragility, not scored, and it does not affect any verdict above.
