# importtrust-f7d — Is the collection-import path field-enumerated or invariant-based?

## 1. Commit SHA measured at

```
633f8f269bcf9225b62d3c7c119f8166eda9ae64
```

Repository: `/workspace/farmtable` (read-only for this leg).
`git log -1` → `633f8f2 Mon Jul 27 20:17:13 2026 +0000 docs: log the contract §10 attention view work`

Working-tree warrant, because a SHA is only a citation if the bytes I read are the bytes at
that SHA: `git status --porcelain | grep -cv '^??'` → **0**. Zero tracked files are modified,
added, deleted or renamed. Every `path:line` below is therefore the content at
`633f8f2`. (Untracked `??` entries exist — `.claude/worktrees/`, `tasks/`, `decomposer`, four
`.md`/state files — and none of them is a file I cite.)

Every grep below excludes `/.claude/worktrees/` by source, not by shape: those four worktrees
contain full second copies of `export_import.go`, `beads_import.go` and `entstore.go` at
*different* SHAs with *different* line numbers (e.g. `.claude/worktrees/anthropic-vertex/internal/store/entstore.go:1619`
vs the canonical `:2091`), and mixing them would corrupt every line citation in this report.

---

## 2. Q1 — one-line answer

**FIELD-ENUMERATED.**

---

## 2a. READ THIS BEFORE THE DETAIL — the create-side gap, and why a queued fix makes it a blocker

**(a) The gap, plainly.** Nothing validates a user type at the point it is created. This command
succeeds today:

```
ft user create "Build Bot" --type admn
```

`cli/user.go:44-48` puts the string straight into `store.CreateUserParams{Type: userType}`;
`schema/user.go:19` is a plain `field.String("type").Default("agent")` with no validator, so
`UserCreate.check()` validates `display_name` only (`ent/user_create.go:211`). The command prints
`"type":"admn"` (`cli/user.go:65`) and exits zero. The flag's help text is
`"User type: human, agent, service_account"` (`:77`) — it neither lists the four privileged values
it accepts nor rejects anything. `export_import.go:583` is a second producer of the same value
with the same absence.

**(b) The composition, and it is not comfortable.** *Relayed premise, see (c):* a read-side fix is
queued to merge that makes any unrecognised user type resolve to **no permissions, everywhere, with
no migration ramp**. Compose that with (a):

> **A single mistyped character at creation time silently produces an account that is born dead.
> The create succeeds, prints success, and the account has no permissions for any operation,
> forever, with nothing at creation time having said a word.**

The fix does not cause this — the typo was always accepted. **It changes the failure from a silent
escalation into a silent lockout, and *silent* is the part that survived.** The clause it fails is
the second half of the owner's ruling as relayed to me: that the denial be **discoverable**, on the
ground that a bug you cannot find is worse than one you can. A value accepted at create time and
punished at every later read is the least discoverable form this defect can take — and per §5.11
the account then renders as an ordinary AGENT and cannot be enumerated by its true type, so the
lockout has no operator-facing explanation either.

**(c) Provenance — mark this clearly.** *The read-side fix, the product owner's ruling, and its
discoverability requirement were **RELAYED TO ME BY THE COORDINATOR AND ARE UNVERIFIED**. I have
not read that diff, that ruling, or any artefact of it. Everything in (a) is my own measurement at
`633f8f2`; everything in (b) that depends on the fix existing is conditional on the relay being
accurate.* If the queued fix denies at a different point, or ramps, or validates at creation, (b)
weakens or dissolves and (a) still stands on its own.

**(d) No remedy proposed here.** §6.8 prices fix *shapes* for the vocabulary split without
recommending one, and that restraint extends to this section for the same reason given there: the
`reviewer`/`orchestrator` shared scope set means choosing a remedy requires deciding whether these
are types or roles, which is a data-model question above this leg's scope.

*Convergence caveat, applied to myself.* My framing in §6.8 — *the vocabulary defect, like the
field defect, is enumerated per consumer rather than established at the point of entry* — has been
described to me as close to a standing fleet rule (*enumerate at the chokepoint, not at the
source*). I did not open the standing-rules file in this session, but its contents were
characterised to me in relayed traffic more than once. **Treat the agreement as
possibly-shared-cause, not as independent corroboration.**

---

## 3. Q1(a)–(c) — the full field table

### 3.1 How I bounded the field set (the completeness argument, not an assertion)

Two bounds, each closed by a language/library-level argument rather than by a count of clean
searches.

**Bound 1 — the parse surface is closed by the Go type plus `DisallowUnknownFields`.**
The native arm decodes into `exportDocument` (`internal/server/export_import.go:22-32`) with
`decoder.DisallowUnknownFields()` (`:296`). `encoding/json` will therefore *reject* any key not
carrying a `json:"…"` tag on `exportDocument` or its five nested structs. The reachable field
set is exactly the tagged fields of those six structs — no reflection, no `map[string]any`
catch-all at document level, no embedded `any`. This is a closure, not a survey: an unlisted
key cannot enter, because the decoder errors out at `:297`.

Evidence the struct set is those six and no more:

```
$ grep -c 'json:"' internal/server/export_import.go
62
```

62 tagged fields across `exportDocument` (8), `exportCollection` (7), `exportUser` (5),
`exportTask` (25), `exportComment` (6), `exportRelationship` (4), `exportChange` (7) = 62. The
count reconciles exactly; there is no seventh struct.

```
$ grep -rn "DisallowUnknownFields" --include="*.go" . | grep -v "/.claude/worktrees/"
internal/server/export_import.go:296:		decoder.DisallowUnknownFields()
```

One occurrence in the canonical tree. It is inside `case "farmtable":` and **not** on the Beads
arm — see §4.

**Caveat, stated because it is the kind of thing this bound invites you to forget:** two of the
62 fields are themselves `map[string]any` (`exportCollection.RemoteData` `:39`,
`exportTask.RemoteData` `:76`) and one is `[]map[string]string` (`exportTask.PullRequests`
`:75`). *Inside* those three values `DisallowUnknownFields` does nothing — arbitrary keys and
arbitrary nesting pass. The document's *shape* is closed; three of its *values* are open. §5
grades that.

**Bound 2 — the write set is closed by lexical scope plus the absence of Ent hooks.**
Every persistent write on this path happens inside one function body,
`EntStore.ImportCollection` (`internal/store/entstore.go:2091-2246`), because the handler makes
exactly one store call:

```
$ awk 'NR>=264 && NR<=417 {printf "%d:%s\n", NR, $0}' internal/server/export_import.go | grep "s\.store\."
412:	coll, err := s.store.ImportCollection(ctx, importParams)
```

One line. The handler reads nothing and writes nothing else through the store between `:264`
and `:417`.

Inside that function, the writes are the Ent builder `Set*` calls:

```
$ awk 'NR>=2091 && NR<=2246' internal/store/entstore.go | grep -c "Set[A-Za-z]*("
54
```

54 `Set*` calls (listed in full in §3.2's citations). Ent's generated builders persist only
mutated fields plus schema defaults, and **no schema in this project declares `Hooks()`,
`Interceptors()` or `Policy()`**:

```
$ grep -rn "ent.Hook\|Hooks()\|Interceptors()\|Policy()" --include="*.go" internal/store/schema/ internal/store/ent/runtime.go
(no output)
```

`internal/store/ent/runtime.go` stitches only defaults and field validators. So there is no
mechanism by which a field outside those 54 calls can reach a row on this path. That is the
bounding argument; the 54 rows are its content, not its proof.

**What this bound does not cover, said plainly:** it covers *this* call path. It does not claim
`store.ImportCollection` is the only writer of these tables in the program — it obviously is not.

**Store-API implementations, all three, because "one caller" is a claim about today:**

```
$ grep -rn "ImportCollection(" --include="*.go" . | grep -v "/.claude/worktrees/" | grep -v "_test.go"
internal/store/store.go:318:                 (interface declaration)
internal/store/entstore.go:2091:             (the real implementation)
internal/store/multistore.go:374:            (delegates to m.primary — entstore)
internal/platform/github/passthrough.go:766: (returns ErrNotImplemented)
internal/server/export_import.go:264:        (the RPC handler)
internal/server/export_import.go:412:        (the sole call into the store API)
internal/cli/collection.go:250:              (gRPC client — goes through :264, not around it)
api/farmtable/v1/farmtable_grpc.pb.go:*      (generated stubs)
```

There is today exactly **one** caller of the store-side API. §6 addresses why that is a fact
about the present and not a property.

### 3.2 The table

Legend for the **Handling** column:

- **REMAPPED** — the caller's value is discarded and a server-generated value substituted.
- **VALIDATED** — parsed against a closed set; a value outside it aborts the import.
- **REPLACED** — checked, then overwritten by a server constant regardless.
- **UNTOUCHED** — the caller's bytes reach the Ent builder unchanged by any handler code.
- **UNTOUCHED (Ent NotEmpty)** — as above, except the generated builder rejects `""`. This is a
  length floor, not a content check: it constrains one value out of all possible strings.
- **PARSED, DISCARDED** — read from the document, used for nothing that is written.

#### Document level — `exportDocument` (`export_import.go:22-32`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `format_version` | no | VALIDATED to {1,2} (native arm only); then used as a *behaviour switch* | `:23` → `:300-302`; consumed `:365`, `:485`, `:668`, `:673`, `:679`, `:688`, `:697` |
| `exported_at` | no | PARSED, DISCARDED — no reader in the tree | `:24` |
| `generator` | no | VALIDATED to `""` or `"farmtable"` | `:25` → `:303-305` |

#### `exportCollection` (`export_import.go:34-42`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `collection.id` | no | PARSED, DISCARDED. New collection gets Ent's `Default(uuid.New)` — `collCreate` has no `SetID` | `:35`; `entstore.go:2112-2115`; `schema/collection.go:16` |
| `collection.name` | **yes** | **UNTOUCHED (Ent NotEmpty)** — overridable by `req.Name`; non-empty enforced | `:36` → `:330` → `entstore.go:2113`; override `:337-339`; check `:340-342`; `ent/collection_create.go:218` |
| `collection.description` | **yes** | **UNTOUCHED** | `:37` → `:330` → `entstore.go:2114` |
| `collection.platform` | no | **REPLACED** — validated `== "farmtable"` at `:306`, then the *constant* `collection.PlatformFarmtable` is written | `:38` → `:306-308`; `:331` → `entstore.go:2115` |
| `collection.remote_data` | **yes** | **UNTOUCHED** — arbitrary JSON object | `:39` → `:332` → `entstore.go:2116-2118` |
| `collection.created_at` | **yes** | **UNTOUCHED** (zero-value check only) | `:40` → `:333` → `entstore.go:2119-2121` |
| `collection.updated_at` | **yes** | **UNTOUCHED** (zero-value check only) | `:41` → `:334` → `entstore.go:2122-2124` |

#### `exportUser` (`export_import.go:44-50`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `users[].id` | no | **REMAPPED** — `uuid.Parse` twice, then `uuid.New()` | `:45` → `:475`, `:554` → `:576-577` |
| `users[].display_name` | **yes** | **UNTOUCHED (Ent NotEmpty)** | `:46` → `:580` → `entstore.go:2101`; `ent/user_create.go:211` |
| `users[].email` | **yes** | **UNTOUCHED** — used as a lookup key, then persisted verbatim. No format check, no case-folding, no uniqueness constraint | `:47` → `:557-558`, `:581` → `entstore.go:2104-2106` |
| `users[].type` | **yes** | **UNTOUCHED** ← **F7d** | `:48` → `:583` → `entstore.go:2102` |
| `users[].status` | **yes** | **UNTOUCHED** | `:49` → `:584` → `entstore.go:2103` |

**Answering the relayed normalisation question directly, on my own measurement:** the persisted
`users.type` is the **exact byte string carried in the import document**, with no normalisation,
no mapping and no validation anywhere between the wire and the row. The write path I followed,
end to end: `req.GetData()` `:271` → `json.Decoder.Decode(&doc)` `:297` → `doc.Users` `:348` →
`resolveImportUsers` `:544` → `store.ImportUser{Type: exported.Type}` `:583` →
`importParams.Users` `:352` → `s.store.ImportCollection` `:412` →
`tx.User.Create().SetType(imported.Type)` `entstore.go:2102` → `UserCreate.check()`. I stopped
at `check()`, having read it: it validates **`display_name` only** —

```
$ grep -n "Validator" internal/store/ent/user_create.go
211:		if err := user.DisplayNameValidator(v); err != nil {
```

one validator in the whole builder. The schema confirms why: `field.String("type").Default("agent")`
(`internal/store/schema/user.go:19`) is a plain string with no `.Values(...)`, no `.Validate(...)`,
no `.NotEmpty()`. `status` (`:20`) is likewise unconstrained. Contrast `task.phase`/`stage`/
`priority`/`ci_status`, which *are* `field.Enum(...)` (`schema/task.go:19-58`) and therefore
generate `PhaseValidator`/`StageValidator`/`PriorityValidator`/`CiStatusValidator` calls in
`ent/task_create.go:547,555,559,564,577`. **The store rejects an invalid task stage and accepts
any user type at all.** Backend note as requested: the Ent layer is dialect-independent here —
`type` is `field.String`, so neither the SQLite nor the Postgres path adds a CHECK constraint
that the other lacks; the validator set is generated once from the schema.

*Was I able to guess what depends on the answer?* Yes, and I am saying so because the sender
asked me to. By the time the relayed question reached me I had already traced `DefaultScopesForUserType`
(§5.1) and so I knew the answer's consequence before I answered it. The question was asked
blind but did not reach me blind. I have written the answer from the write path rather than
from the consequence, but a reader should discount my neutrality on this one field accordingly.

#### `exportTask` (`export_import.go:52-77`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `tasks[].id` | no | **REMAPPED** — `uuid.Parse` then `uuid.New()`; duplicates rejected | `:53` → `:315-318`; dup check `:601-603` |
| `tasks[].title` | **yes** | **UNTOUCHED (Ent NotEmpty)** | `:54` → `:724` → `entstore.go:2133`; `ent/task_create.go:537-541` |
| `tasks[].description` | **yes** | **UNTOUCHED** | `:55` → `:725` → `entstore.go:2134` |
| `tasks[].phase` | no | **VALIDATED then DISCARDED** — `parseTaskPhase` at `:481`, but the written phase is `phaseForStage(stage)`, derived from `stage` | `:56` → `:481` → `:878-885`; written value `:657`/`:715`/`:726` ← `convert.go:61-72` |
| `tasks[].stage` | **yes** | **VALIDATED** — closed switch, two of them | `:57` → `:484-488` → `:896-906`; `migrateTaskState` `:653-708` → `entstore.go:2137` |
| `tasks[].hold_reason` | **yes** | **VALIDATED** — `task.HoldReasonValidator` plus a stage/date consistency rule | `:58` → `:659-665`, `:719` → `:806-819` → `entstore.go:2144-2146` |
| `tasks[].native_label` | **yes** | **UNTOUCHED** | `:59` → `:728` → `entstore.go:2138` |
| `tasks[].type` | **yes** | **UNTOUCHED** — no handler check; `schema/task.go:36` is `field.String("type").Optional().Default("")` with no validator, and `ent/task_create.go:533-589` has no `Type` branch | `:60` → `:729` → `entstore.go:2139` |
| `tasks[].priority` | **yes** | **VALIDATED** — `parseTaskPriority`, twice | `:61` → `:489-493`, `:749-755` → `:908-915` → `entstore.go:2141-2143` |
| `tasks[].rank` | **yes** | **UNTOUCHED** — no range, sign or collision check | `:62` → `:746-748` → `entstore.go:2147-2149` |
| `tasks[].assignee_id` | **yes** | **REMAPPED** — membership-checked, then rewritten through `userMapping`. **The remap target may be a pre-existing real user** (§5.2) | `:63` → `:499-503`, `:756-762` → `entstore.go:2150-2152` |
| `tasks[].parent_task_id` | **yes** | **REMAPPED** — existence + cycle check, then rewritten | `:64` → `:618-626`, `:763-769` → `entstore.go:2153-2155` |
| `tasks[].start_date` | **yes** | **PARTIALLY CONSTRAINED** — rejected only in the single combination `hold_reason=deferred` + future date; otherwise untouched | `:65` → `:730` → `entstore.go:2156-2158`; partial rule `:815-817`; also read `:682`, `:691` |
| `tasks[].due_date` | **yes** | **UNTOUCHED** | `:66` → `:731` → `entstore.go:2159-2161` |
| `tasks[].closed_at` | **yes** | **UNTOUCHED** — no consistency check against `phase`/`stage` | `:67` → `:732` → `entstore.go:2162-2164` |
| `tasks[].created_at` | **yes** | **UNTOUCHED** — written despite `.Immutable()` in the schema (immutable forbids *update*, not *create*) | `:68` → `:733` → `entstore.go:2165-2167`; `schema/task.go:47` |
| `tasks[].updated_at` | **yes** | **UNTOUCHED** | `:69` → `:734` → `entstore.go:2168-2170` |
| `tasks[].acceptance_criteria` | **yes** | **UNTOUCHED** | `:70` → `:735` → `entstore.go:2171-2173` |
| `tasks[].labels` | **yes** | **UNTOUCHED** — no element count, element length or content limit | `:71` → `:736` → `entstore.go:2174-2176` |
| `tasks[].repo` | **yes** | **UNTOUCHED** | `:72` → `:737` → `entstore.go:2177-2179` |
| `tasks[].branch` | **yes** | **UNTOUCHED** | `:73` → `:738` → `entstore.go:2180-2182` |
| `tasks[].ci_status` | **yes** | **VALIDATED** — `parseTaskCIStatus`, twice | `:74` → `:494-498`, `:770-776` → `:917-924` → `entstore.go:2183-2185` |
| `tasks[].pull_requests` | **yes** | **UNTOUCHED** — arbitrary `[]map[string]string`, unbounded keys and count | `:75` → `:739` → `entstore.go:2186-2188` |
| `tasks[].remote_data` | **yes** | **UNTOUCHED** — arbitrary JSON object | `:76` → `:740` → `entstore.go:2189-2191` |
| *(`version`)* | **yes** | not a document field — hardcoded `"1"` | `:741` → `entstore.go:2140` |

#### `exportComment` (`export_import.go:79-86`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `comments[].id` | no | **REMAPPED** — parsed twice, then `uuid.New()` | `:80` → `:506-508`, `:822-824` → `:833` |
| `comments[].task_id` | **yes** | **REMAPPED** through `taskMapping` | `:81` → `:509-511`, `:825-828` → `entstore.go:2200` |
| `comments[].author_id` | **yes** | **REMAPPED** through `userMapping` — **target may be a pre-existing real user** (§5.2) | `:82` → `:512-514`, `:829-832` → `entstore.go:2201` |
| `comments[].body` | **yes** | **UNTOUCHED (Ent NotEmpty)** | `:83` → `:833` → `entstore.go:2202`; `ent/comment_create.go:140+`, `schema/comment.go:20` |
| `comments[].created_at` | **yes** | **UNTOUCHED** | `:84` → `:833` → `entstore.go:2203-2205` |
| `comments[].updated_at` | **yes** | **UNTOUCHED** | `:85` → `:833` → `entstore.go:2206-2208` |

#### `exportRelationship` (`export_import.go:88-93`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `relationships[].id` | no | **REMAPPED** | `:89` → `:517-519`, `:837-839` → `:852` |
| `relationships[].source_task_id` | **yes** | **REMAPPED** — membership-checked. **No self-loop check**: `source == target` is accepted | `:90` → `:520-522`, `:840-843` → `entstore.go:2217` |
| `relationships[].target_task_id` | **yes** | **REMAPPED** — same | `:91` → `:523-525`, `:844-847` → `entstore.go:2218` |
| `relationships[].type` | **yes** | **VALIDATED** — `parseRelationshipType`, twice | `:92` → `:526-528`, `:848-851` → `:926-933` → `entstore.go:2219` |

#### `exportChange` (`export_import.go:95-103`)

| Field | Reaches a write? | Handling | Citations |
|---|---|---|---|
| `changes[].id` | no | **REMAPPED** | `:96` → `:531-533`, `:856-858` → `:868` |
| `changes[].task_id` | **yes** | **REMAPPED** | `:97` → `:534-536`, `:859-862` → `entstore.go:2229` |
| `changes[].author_id` | **yes** | **REMAPPED** through `userMapping` — **target may be a pre-existing real user** (§5.2) | `:98` → `:537-539`, `:863-866` → `entstore.go:2230` |
| `changes[].field_name` | **yes** | **UNTOUCHED (Ent NotEmpty)** | `:99` → `:871` → `entstore.go:2231`; `schema/change.go:20` |
| `changes[].old_value` | **yes** | **UNTOUCHED** | `:100` → `:872` → `entstore.go:2232` |
| `changes[].new_value` | **yes** | **UNTOUCHED** | `:101` → `:873` → `entstore.go:2233` |
| `changes[].created_at` | **yes** | **UNTOUCHED** | `:102` → `:874` → `entstore.go:2234-2236` |

### 3.3 Q1(c) — the untouched list, in full

**Thirty-one fields reach a store write carrying the caller's bytes.** `users.type` is one of
thirty-one, not one of two or three. Grouped by container:

1. `collection.name` *(Ent NotEmpty)*
2. `collection.description`
3. `collection.remote_data`
4. `collection.created_at`
5. `collection.updated_at`
6. `users[].display_name` *(Ent NotEmpty)*
7. `users[].email`
8. **`users[].type`** ← the parked F7d finding
9. `users[].status`
10. `tasks[].title` *(Ent NotEmpty)*
11. `tasks[].description`
12. `tasks[].native_label`
13. `tasks[].type`
14. `tasks[].rank`
15. `tasks[].due_date`
16. `tasks[].closed_at`
17. `tasks[].created_at`
18. `tasks[].updated_at`
19. `tasks[].acceptance_criteria`
20. `tasks[].labels`
21. `tasks[].repo`
22. `tasks[].branch`
23. `tasks[].pull_requests`
24. `tasks[].remote_data`
25. `comments[].body` *(Ent NotEmpty)*
26. `comments[].created_at`
27. `comments[].updated_at`
28. `changes[].field_name` *(Ent NotEmpty)*
29. `changes[].old_value`
30. `changes[].new_value`
31. `changes[].created_at`

Plus one partial: `tasks[].start_date`, constrained in exactly one combination (`:815-817`).

**The protected set, for contrast — this is the hand-list:** five ID remaps (task `:318`, user
`:576`, comment `:833`, relationship `:852`, change `:868`), three reference remaps
(`assignee_id` `:757`, `parent_task_id` `:764`, and the `task_id`/`author_id` pairs on comments
and changes), one constant replacement (`platform` `:331`), and five closed-set validations
(`phase` — then discarded, `stage`, `hold_reason`, `priority`, `ci_status`, `relationship.type`).

### 3.4 Why this is the definition of FIELD-ENUMERATED, and not merely a long list

Four structural facts, each independently sufficient:

**(i) The protection is a per-field `if`, not a pass over the document.** There is no loop, no
reflection walk, no allowlist table, no "sanitize(doc)" step. `importedTask` (`:710-804`) is
thirty-odd hand-written assignments; a field added to `exportTask` tomorrow with a matching
`Set*` in the store gets no handling unless someone writes the branch. The default for a new
field is **pass-through**, and a default that fails open is the signature of enumeration.

**(ii) The same field is protected on one arm and not the other.** `tasks[].type` is UNTOUCHED
on the native arm (`:729`) and mapped through the closed set `beadsTypeToFarmtable`
(`beads_import.go:145-164`) on the Beads arm. If the handling were a property of the document,
it could not differ by which parser produced the document. It differs, so it is not.

**(iii) A validated field is thrown away and an unvalidated one is written.** `tasks[].phase` is
validated at `:481` and then never used — the written phase comes from `phaseForStage(stage)`
(`convert.go:61-72`). Meanwhile `tasks[].type`, structurally identical (free string, no schema
enum), has no check at all. That asymmetry has no invariant that explains it; it is the residue
of who was worried about what, and when.

**(iv) The one real invariant on this path is confined to identity, and even it leaks.** The
ID-remap at `:318`/`:576`/`:833`/`:852`/`:868` genuinely holds for every ID: nothing the caller
sends becomes a primary key. That is the closest thing to an invariant here, and it is exactly
what the earlier leg found protecting the store's `SetID` surface. But its sibling — the
*reference* remap through `userMapping` — is not safety-preserving at all (§5.2). An invariant
that says "the ID is fresh" says nothing about "the row the reference points at is one the
caller was entitled to name."

---

## 4. Q1(d) — the two arms and the join

### 4.1 The arms

**Arm A, native** — `case "farmtable":` at `export_import.go:294-308`. Decodes into
`exportDocument` with `DisallowUnknownFields` (`:295-299`), then three admission checks:
`format_version ∈ {1,2}` (`:300`), `generator ∈ {"", "farmtable"}` (`:303`),
`collection.platform == "farmtable"` (`:306`).

**Arm B, Beads** — `case "beads":` at `:276-293`. `parseBeadsJSONL(req.GetData())` (`:278` →
`beads_import.go:61-97`), then `convertBeadsToExportDocument` (`:287` → `beads_import.go:168-405`),
then `deduplicateRelationships` (`:292`), then `doc = converted` (`:293`).

Selection is by `detectImportFormat(req.GetData())` at `:271` (`beads_import.go:413-458`);
anything else falls to `default:` and is rejected at `:310`.

### 4.2 The join, and confirmation that handling is downstream of it

**The two arms converge on the single local variable `doc` (declared `:273`), and the join is
the closing brace of the `switch` at `:311`.** Arm A writes `doc` by decoding into it directly
(`:297`); Arm B writes it by assignment (`:293`).

Everything in Q1(a)–(c) happens after `:311`. Confirmed by position, in order:

| Handling | Line | After the join? |
|---|---|---|
| task ID remap (`uuid.New()`) | `:313-319` | yes |
| `orderImportTasks` (dup + cycle) | `:322` | yes |
| `platform` constant replacement | `:331` | yes |
| collection name required | `:340` | yes |
| `validateImportReferences` (all closed-set + reference checks) | `:344` | yes |
| `resolveImportUsers` (user ID remap, email match) | `:348` | yes |
| `importedTask` / `importedComment` / `importedRelationship` / `importedChange` | `:365`, `:376`, `:383`, `:390` | yes |
| the store write | `:412` | yes |

**Neither arm bypasses the post-join handling.** There is one store call (§3.1, Bound 2) and it
sits at `:412`, unconditionally downstream of both. So the answer to "do they converge before
the handling" is **yes, at `:311`, and the handling is downstream of the join.**

### 4.3 Three asymmetries that survive the join — and matter

The join is real, but it is a join of *values*, not of *treatment*. Three things differ by arm
and are not repaired afterwards:

**(a) Arm B is not subject to `DisallowUnknownFields`.** `parseBeadsJSONL` uses plain
`json.Unmarshal` per line (`beads_import.go:75`). Unknown keys in a Beads line are silently
dropped rather than rejected. This is *tolerance*, not injection — the dropped keys reach
nothing — but it means the closure argument in §3.1 Bound 1 covers Arm A only. Arm B's parse
surface is bounded instead by `beadsIssue`/`beadsDependency`/`beadsComment`
(`beads_import.go:16-55`), and everything outside it is discarded.

**(b) Arm B skips all three admission checks and then supplies safe constants for them itself.**
`format_version: 2`, `generator: "farmtable"`, `platform: PlatformFarmtable`
(`beads_import.go:386-393`). The checks at `:300`/`:303`/`:306` are inside `case "farmtable":`
and never run for Beads. The outcome is currently safe — but by *coincidence of two independent
sites agreeing*, not by a shared invariant. Change `convertBeadsToExportDocument` to emit
`FormatVersion: 1` and the v1 legacy-stage migration path (`:667-704`) silently activates for
Beads documents with nothing to catch it.

**(c) Arm B is strictly narrower on the dangerous fields — by omission, not by design.** It
never populates `RemoteData`, `Repo`, `Branch`, `PullRequests`, or any `Change`; it hardcodes
`Type: "human"` and `Status: "active"` for every user (`beads_import.go:210-215`, and again at
`:377-382`); it maps `issue_type` through a closed set (`:145-164`). But it passes
`issue.Status` straight into `NativeLabel` (`:300`) and `issue.Title`/`desc`/`AcceptanceCriteria`
straight through (`:295-296`, `:310`). So Arm B is safer on eight fields and identical on the
rest — and none of that safety is enforced anywhere; it is the current shape of one function.

### 4.4 Does `beads_import.go` reach a store write with caller-supplied values independently?

**No.** It has no route to the store at all, and the argument is at the language level rather
than a search: its entire import block is

```go
import (
	"bufio"; "bytes"; "encoding/json"; "fmt"; "time"
	".../internal/store/ent/collection"
	".../internal/store/ent/relationship"
	"github.com/google/uuid"
)
```
(`beads_import.go:3-13`)

It imports `ent/collection` and `ent/relationship` for their *enum constants* only. It does not
import `internal/store`, holds no `store.Store`, has no method on `*FarmTableService`, and
therefore has no receiver through which a store could be reached. Its three exported-to-package
entry points have exactly one caller each, all inside the handler:

```
$ grep -rn "parseBeadsJSONL\|convertBeadsToExportDocument\|detectImportFormat" --include="*.go" . \
    | grep -v "/.claude/worktrees/" | grep -v "_test.go"
internal/server/beads_import.go:61,168,413    (definitions)
internal/server/export_import.go:271,278,287  (the three call sites)
```

So: the second Beads implementation is **live and on the wire** — `req.GetData()` reaches
`parseBeadsJSONL` at `:278` with no prior validation of any kind — but it reaches a row only
through the same join at `:311` and the same single write at `:412`. It is a second *front end*,
not a second *back end*.

*(This agrees with the standing-rules entry on the Beads split. I reached it independently from
the import graph and the receiver set; I did not adopt it.)*

---

## 5. Q2 — blast radius, per untouched field

Grading rule I applied, stated up front so it can be checked: a field is graded on **the
consumer I could cite**, not on whether it is untouched. Several untouched fields below are
graded **inert** and one nominally "protected" field is graded **High** — because the grade
follows the sink, not the handling.

### 5.0 Who can do any of this

`ImportCollection` requires `RequireIdentity` (`:265`) and `ScopeCollectionAdmin` (`:268`). It
does **not** call `RequireCollectionAccess` — correctly, since it takes no collection ID and
creates one (`export_import.go:264` takes `req.Data`/`req.Name`/`req.DryRun` only; contrast
`ExportCollection` `:105-115`, which takes an ID and does enforce access). One consequence worth
recording: **a token confined to collection X can still create collection Y and populate it**,
because there is no ID to confine against.

Who holds `collection:admin`? Per `DefaultScopesForUserType` (`scopes.go:122-158`): `admin`,
`human`, `service_account` and *every unrecognised type* get `ScopeWildcard`; `agent`,
`reviewer`, `orchestrator`, `viewer` do **not** get `collection:admin`. So the reachable
population is wildcard holders, plus any token minted with an explicit
`--scope collection:admin` (`cli/token.go:145-150`), plus **any request at all when no auth
interceptor is configured** — `RequireScope` returns `nil` in open-access mode
(`scopes.go:76-78`) and `RequireIdentity` returns `uuid.Nil, nil` (`auth.go:46-51`). Also note
`scopes.go:83-85`: a token with an empty scope list is treated as wildcard.

### 5.1 `users[].type` — **HIGH.** The F7d finding, confirmed, and narrower than "privilege escalation" in one respect and wider in another

**The sink.** `DefaultScopesForUserType(userType string)` (`scopes.go:122-158`):

```go
case "admin":            return []string{ScopeWildcard}     // :124-125
case "agent":            return []string{task:read, task:write, task:claim, collection:read}   // :126-128
case "reviewer", "orchestrator": return []string{…6 scopes…} // :129-138
case "viewer":           return []string{task:read, collection:read}   // :139-140
case "human":            return []string{ScopeWildcard}     // :141-142
case "service_account":  return []string{ScopeWildcard}     // :143-144
default:                 return []string{ScopeWildcard}     // :145-157, with a log.Printf warning at :153
```

Two consumers, both reached:

- `internal/cli/token.go:152-161` — `ft token create <user-id>` with no `--scope` looks the user
  up and applies `DefaultScopesForUserType(u.Type)`.
- `internal/serverapp/provisioning.go:139-153` — `CreateSessionToken(..., userType)`, called on
  **every OAuth login** (`oauth.go:235`) and on **every IAP-proxied first request**
  (`unified.go:158`), with `result.User.Type` taken from the row found by `FindOrCreateByEmail`.

**The deception.** *(Original text, preserved verbatim; superseded by the correction immediately
below. Retained rather than overwritten so a later reader can see what was claimed and discount
accordingly.)*

> `userTypeToProto` (`convert.go:202-213`) renders any unrecognised type as
> `USER_TYPE_AGENT` at `:210-211`, and it is on the path of every user-returning RPC:
> `WhoAmI` (`server.go:1357`), `GetUser` (`server.go:1421`), `ListUsers` (`server.go:1397`), all via
> `userToProto` (`convert.go:245`). The dashboard consumes the same protos.

**CORRECTION, 2026-07-29 ~03:05Z — the sentence above is true and misdirects.** It scopes the
collapse to *unrecognised* types, which implies the recognised ones are safe. **Four recognised
ones are not.** Trigger, stated so the provenance is auditable: the coordinator challenged R2's
grade (§6.0) on the axis "hold the principal fixed and enumerate outcomes"; building that
enumeration required listing both type vocabularies side by side, which I had not done, and the
omission fell out. The challenge supplied a *method*, not a premise, and both enumerations below
are at `633f8f2` and involve no post-fix reasoning — but the reader should apply their own
discount, which is why this note exists.

```
$ grep -n 'case "' internal/server/scopes.go        # AUTHORITY vocabulary: 7
124: "admin"   126: "agent"   129: "reviewer", "orchestrator"
139: "viewer"  141: "human"   143: "service_account"

$ grep -n "USER_TYPE" proto/farmtable.proto          # DISPLAY vocabulary: 3
105: UNSPECIFIED  106: HUMAN  107: AGENT  108: SERVICE_ACCOUNT
```

**The authority vocabulary and the display vocabulary are different sets and nothing reconciles
them.** `admin`, `reviewer`, `orchestrator` and `viewer` have no `pb.UserType` value, so they hit
`convert.go:210-211` and render as `AGENT` — and those four are *the privileged and the
restricted ones*, i.e. precisely the types whose display matters. Consequences requiring **no
import, no attacker and no unrecognised string**:

- **`ft user create --type admin` is a documented, supported, unvalidated operator action
  (`cli/user.go:44-48`, `:77`) that mints an account receiving `ScopeWildcard`
  (`scopes.go:124-125`) and thereafter rendering as an ordinary AGENT** in `WhoAmI`, `GetUser`,
  `ListUsers`, `ft user get`, `ft user list` and the dashboard.
- The `--type` flag's own help string is `"User type: human, agent, service_account"`
  (`cli/user.go:77`) — it does not document the four privileged values it accepts.
- Combined with the unenumerability below: **the audit surface misreports precisely the most
  privileged accounts.** The one review that would catch every other finding on this path is the
  review that cannot see admins.
- The scope-default inversion (§6.0) does **nothing** for any of the four: they are recognised
  cases and never reach the `default:` branch.

These four strings occur in the entire non-test, non-worktree tree **only** as switch cases in
`scopes.go`:

```
$ grep -rn '"admin"\|"reviewer"\|"orchestrator"\|"viewer"' --include="*.go" internal/ cmd/ \
    | grep -v "/.claude/worktrees/" | grep -v "_test.go"
internal/server/scopes.go:124  :129  :139
```

No schema, no proto, no CLI validation, no web vocabulary. They exist only as authority.

This regrades nothing in §5.1 — `users.type` was already HIGH — but it moves the *root*: the
import path is one producer of a defect that has a non-adversarial producer sitting in the
documented CLI. See §5.11 for which surfaces, if any, can still tell the difference.

**Stronger than "invisible": the row is unenumerable by its true type.** `ListUsers`'s type
filter goes through `userTypeFromProto` (`server.go:1384-1387`), which can only produce
`"human"`, `"agent"`, `"service_account"` or `""`. There is no proto enum value for
`"wheelbarrow"`, so no API query can ask for it. An operator cannot list the anomalous rows even
if they suspect them.

**Proof of concept.**
1. Caller with `collection:admin` (or wildcard, or any caller at all against an open-access
   deployment) sends a minimal native document:
   ```json
   {"format_version":2,"generator":"farmtable",
    "collection":{"name":"m","platform":"farmtable"},
    "users":[{"id":"11111111-1111-1111-1111-111111111111","display_name":"build-bot",
              "email":null,"type":"agent ","status":"active"}],
    "tasks":[],"comments":[],"relationships":[],"changes":[]}
   ```
   Note `"agent "` — one trailing space. It misses every `case` in `scopes.go:123` and lands on
   `default:` → wildcard.
2. Row is created at `entstore.go:2098-2109` with `type = "agent "` verbatim.
3. Any operator later runs `ft user list` → the row renders as `AGENT` (`convert.go:211`), or
   `ft token create <that-id>` with no `--scope` → **wildcard token**, while every view they
   have says the user is an agent limited to four scopes.

**Where I make it narrower than the prior.** Two honest deflations:

- *The OAuth/IAP leg does not, by itself, escalate.* A freshly OAuth-provisioned user is created
  with `Type: "human"` (`provisioning.go:89`), and `"human"` already returns wildcard
  (`scopes.go:141-142`). Planting a row for an email that has not logged in yet and then having
  that person log in yields wildcard — but they would have got wildcard anyway. The
  import-specific gain there is *downgrade* (plant `type:"viewer"` to cripple a future user) and
  *display-name control*, not upgrade.
- *The CLI leg is not a silent deception end to end.* `ft token create` prints the granted
  scopes when non-empty (`cli/token.go:190-192`), so an operator who reads the output sees
  `["*"]`. The deception is in every *other* view, and in the expectation the operator formed
  before running the command.

**Where I make it wider than the prior.** The root is not only that `users.type` is unvalidated;
it is that **`DefaultScopesForUserType` fails open**. `default: → ScopeWildcard` (`:145-157`)
converts *any* unrecognised string — an import, an operator typo (`ft user create --type agnet`,
`cli/user.go:44-52`, which is equally unvalidated), a future migration that renames a type — into
full authority. The comment at `:146-152` shows this was a deliberate backward-compatibility
choice and that its author foresaw the typo case. **A point-fix on `users.type` leaves that
intact.** So does `"human" → wildcard`, which means the **Beads arm's hardcoded
`Type: "human"`** (`beads_import.go:213`, `:380`) creates wildcard-defaulted users on every
Beads import, with no attacker input required at all.

### 5.2 `comments[].author_id`, `changes[].author_id`, `tasks[].assignee_id` — **HIGH.** Audit-trail forgery. Not an untouched field; the *remap* is the vulnerability

I am reporting this under Q2 even though these fields are graded REMAPPED in §3.2, because it is
the sharpest available evidence for the Q1 answer and because grading it out would be the exact
move §4.1 of the standing rules warns about.

`resolveImportUsers` (`:544-596`) resolves each declared user **by email against the live
database**:

```go
matches, err := s.store.GetUserByEmail(ctx, *exported.Email)   // :558
if len(matches) == 1 {
    mapping[exported.ID] = matches[0].ID                        // :563
    matched++
    continue
}
```

So `userMapping` can point at a **pre-existing real user**. Every author/assignee reference is
then rewritten through it: `importedComment` `:829`, `importedChange` `:863`, `importedTask`
`:757`.

**Consequence.** A caller who knows a real user's email address can write, into the database:

- comments attributed to that user (`entstore.go:2201-2202`), with an arbitrary `body` and an
  arbitrary `created_at` (`:2203-2205`) — so they can be back-dated to before the attacker had
  access;
- **change-log rows attributed to that user** (`entstore.go:2230-2233`), with arbitrary
  `field_name`, `old_value`, `new_value` and `created_at`. The `changes` table is the audit
  history: it is rendered as the task's change log
  (`web/src/components/inspector/ft-inspector-changes.ts:127-138`, fields `field`, `oldValue`,
  `newValue`, `changedBy.name`). Normally these rows are produced by `UpdateTask` with a real
  `actorID`; the import path writes them directly with no actor binding whatsoever;
- tasks assigned to that user.

**Proof of concept.** Declare `users: [{"id":"<any-uuid>","display_name":"x",
"email":"ceo@corp.com","type":"human","status":"active"}]` plus one task and one change with
`author_id` set to that declared ID. If `ceo@corp.com` resolves to exactly one existing row, the
change is persisted as authored by the CEO, with attacker-chosen `field_name`/`old_value`/
`new_value` and an attacker-chosen timestamp.

**Why it is the strongest evidence for FIELD-ENUMERATED.** The remap is the handler's *most
deliberate* piece of protection, and it is only safe under the assumption "this document is my
own export coming home." Under that assumption, matching an author to a real user is the
*desired* behaviour. Under "this document is untrusted input," the same line is the attack. The
handler is not weak where nobody looked; it is **wrong where somebody looked, because the model
was re-import rather than untrusted input**. No amount of adding per-field checks fixes an
attacker-supplied *reference* into the existing identity space.

**One deflation, measured:** `resolveImportUsers` maps to an existing user only when
`len(matches) == 1` (`:562`). It cannot be used to *replace* an existing single-account user's
row — with one match, no row is created (`:563-565`). At `len(matches) > 1` it creates a
*duplicate* (`:567-573`, with a warning), and at zero matches it creates fresh. So this is
forgery-of-attribution, not account takeover. `GetUserByEmail` is exact-match
(`entstore.go:1744`, `user.EmailEQ`), and the import writes `email` without case-folding while
`FindOrCreateByEmail` lower-cases before lookup (`provisioning.go:54`) — so a case-variant row
is creatable but will not be selected at login.

### 5.3 `collection.remote_data` — **MEDIUM.** It is not data; it is configuration

`collectionSupportsGraph` (`internal/server/graph_support.go:25-37`) reads
`c.RemoteData["graph_queries"]` and, when it holds a bool, **returns it in preference to the
per-platform default** (`:26-31`). The import writes `collection.remote_data` verbatim
(`:332` → `entstore.go:2116-2118`). So an import document decides a server-side capability gate
for the collection it creates. Direction of harm is both ways: `false` disables critical-path
and blocking-graph analysis for that collection (a silent feature kill that looks like a data
problem), `true` forces it on for a platform where the default is off
(`PlatformAsana`/`PlatformBeads`, `graph_support.go:14-15`).

Graded Medium rather than High because the gate it flips is a feature-availability boolean, and
I did not measure a path from `graph_queries: true` on a farmtable-platform collection to
anything worse than a query running that would otherwise have been refused.

### 5.4 `tasks[].remote_data` — **MEDIUM.** Three keys are interpreted, not stored

`taskToProto` (`convert.go:256-324`) reads three keys out of the untouched blob:

- `remote_data["platform"]` (string) → the task's reported `Platform`, via `platformStringToProto`
  (`convert.go:258-261`, `:181-198`). An imported task can therefore claim to be a GitHub or
  Jira task inside a farmtable collection. The collection's own platform is pinned to
  `farmtable` by the constant at `:331`, so this is a **per-task** spoof that contradicts its
  own container.
- `remote_data["remote_id"]` → `pt.RemoteId` (`convert.go:318-320`).
- `remote_data["remote_url"]` → `pt.RemoteUrl` (`convert.go:321-323`), which the dashboard turns
  into a clickable external link.

The URL leg is **defended** — see §5.8. The platform-spoof leg is not defended and I found no
consumer that makes a security decision on `pb.Task.Platform`; graded Medium for the integrity
effect (a task badge that lies about its origin) rather than for a measured exploit.

Also `convert.go:324`: `pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)` — the error is
discarded. On failure the field is silently nil rather than an error to the caller.

### 5.5 `tasks[].description` and `comments[].body` — **LOW.** The only two raw-HTML sinks, and both are sanitized

These are the only fields in the whole document that reach an HTML-raw position in the
dashboard, and I verified the sanitizer myself rather than taking it on report:

```
$ cat -n web/src/util/markdown.ts
     1  import { marked } from 'marked';
     2  import DOMPurify from 'dompurify';
     3
     4  export function renderMarkdown(md: string): string {
     5    return DOMPurify.sanitize(marked.parse(md) as string);
     6  }

$ grep -rn "unsafeHTML(" web/src --include="*.ts" | grep -v test
web/src/components/inspector/ft-inspector-desc.ts:233:        ${unsafeHTML(renderMarkdown(this.description))}
web/src/components/inspector/ft-inspector-comments.ts:221:                        ${unsafeHTML(renderMarkdown(c.body))}

$ grep -rn "innerHTML\|insertAdjacentHTML" web/src --include="*.ts" | grep -v test
(no output)
```

Two raw sites, both routed through the one DOMPurify call. Everything else is Lit text
interpolation, which escapes. Graded Low as a **residual dependency**, not a live defect: the
protection for 31 untouched fields against stored XSS rests entirely on Lit's escaping plus one
6-line module, neither of which is on the import path or aware of it.

### 5.6 Fields I grade **INERT**, with the reason

Untouched, but no consumer I could cite makes a decision on them:

- `tasks[].native_label` — reaches the client as `nativeStatus` and, per the render sweep, has
  no render site; escaped anyway if one appears.
- `tasks[].acceptance_criteria` — transported, no render site found.
- `tasks[].type`, `tasks[].labels`, `tasks[].repo`, `tasks[].branch` — escaped text positions
  only.
- `collection.description` — reaches only form-control values.
- `changes[].field_name`/`old_value`/`new_value` as *content* — escaped text. Their danger is
  attribution (§5.2), not rendering.
- `users[].display_name`, `users[].email` as *content* — escaped text.

I am recording these as inert **on the sink I could find**, which is a weaker claim than inert.
See NOT REACHED (N4): "no render site found" is a statement that *the code does not say X*, and
I have not established that *the code does not depend on X*.

### 5.7 The timestamp and ordering fields — **LOW**, and one concrete effect

`created_at`/`updated_at` on collection, task, comment and change are all caller-set. Two
citable effects:

- Pagination cursors are built from `created_at`: `encodeCursor(last.ID.String(), last.CreatedAt…)`
  (`server.go:1403`). Rows with adversarial timestamps sort into positions that make cursor
  paging skip or repeat them.
- `FindOrCreateByEmail` returns the first *active* user ordered by `created_at, id`
  (`provisioning.go:71-76`; ordering at `entstore.go:1745`). With two rows sharing an email, the
  earlier `created_at` wins — and the import controls that value. I could not turn this into a
  takeover (§5.2's `len(matches)==1` deflation blocks the setup), so it is Low, not High.

`tasks[].rank` is unbounded and uncollided; `relationships[]` permits `source == target`
(no check anywhere in `:516-529` or `:836-853`), i.e. a task that blocks itself. I did not
measure what the graph traversals do with a self-edge — see NOT REACHED (N3).

### 5.8 Positive observations — things this path does right

- **The ID invariant genuinely holds.** No caller-supplied value becomes a primary key, on any
  of the five entity types, on either arm. `:318`, `:576`, `:833`, `:852`, `:868`.
- **`DisallowUnknownFields`** (`:296`) is a real closure and is what made §3.1's Bound 1
  possible. Most import parsers do not do this.
- **`platform` is replaced by a constant** (`:331`) rather than trusted after checking, which is
  the strictly stronger pattern.
- **The whole store side is one transaction** with `defer tx.Rollback()` (`entstore.go:2092-2096`,
  commit at `:2242`). A partial import cannot be left behind.
- **`safeExternalUrl`** (`web/src/util/safe-url.ts:45`) applies a scheme allowlist and rejects
  `user:pass@` forms, and is applied to exactly the two untrusted-URL sinks
  (`ft-inspector-code.ts:108` for `pull_requests[].url`, `ft-inspector-meta.ts:603` for
  `remoteUrl`). The comment at `ft-inspector-meta.ts:601` names import data as the threat by
  name. Somebody on the web side already understood this trust boundary.
- **Cycle and duplicate detection on `parent_task_id`** (`:598-638`) is thorough and correct.
- **`dry_run`** (`:408-410`) runs the entire validation pipeline and returns before the write,
  which makes the checks that *do* exist testable without side effects.
- **`scopes.go:146-157`** documents its own fail-open as a hazard and logs a warning. The comment
  is honest; it is the behaviour that is wrong.

### 5.9 Two defects found in passing that are not Q1 or Q2

Recorded here rather than escalated, per the composition rule.

- **`export_import.go:362, 396-404` — a fixed primary key on a repeatable path.** When any v1
  document triggers a state-migration note, the handler appends a user with the hardcoded ID
  `00000000-0000-0000-0000-000000000001`, `Type: "service_account"` (→ wildcard by default
  scopes), `DisplayName: "system:migration"`. `entstore.go:2100` does `SetID` on it. This UUID
  appears nowhere else in non-test code (`grep` for the literal returns only `:362` plus MCP
  test fixtures), so it is not a pre-seeded system row — it is created by the first such import.
  **The second such import must therefore fail** on a duplicate primary key, aborting the whole
  transaction at `entstore.go:2107-2109`. That is a functional bug; the security note is that it
  mints a well-known, guessable identity whose default scopes are wildcard.
- **`export_import.go:344-348, 551` — a filter that cannot filter.** `resolveImportUsers` skips
  users not in `requiredUserIDs` (`:551`), but `requiredUserIDs` is `userIDs` returned from
  `validateImportReferences`, which is built from `doc.Users` itself (`:473-479`). The set is
  derived from the list it filters, so the branch is vacuous and **every declared user is
  created**, referenced or not. This is what makes §5.1's PoC work with an empty `tasks` array.
  It reads like a defence and is not one.

### 5.10 Resource bound, for completeness

`grpcMaxMessageSize = 64 << 20` (`cmd/farmtable-server/main.go:27`, applied `:93-94`). There is
no import-specific size, entity-count or nesting limit — `grep` for `len(req.GetData())`,
`MaxImport`, `maxImport` returns nothing in the canonical tree. A 64 MiB document is held as
raw bytes, as a parsed `exportDocument`, and as `store.ImportCollectionParams` simultaneously,
then inserted row-by-row inside one transaction. Low, and out of scope, but it is the kind of
bound a reader will assume was checked.

### 5.11 Can an operator who is looking distinguish a `type:"admin"` user from a `type:"agent"` user?

Asked directly, so answered directly. **NO — not for any user other than themselves, on any
product surface.** Three surfaces do carry the raw string, and none of them is an audit surface;
each is listed with the reason it does not rescue the situation.

**The surfaces that show AGENT (i.e. lie).** Every RPC that returns a user goes through
`userToProto` → `userTypeToProto` (`convert.go:245`, `:202-213`):

| Surface | Path | Shows |
|---|---|---|
| `ft user get <id>` | `newClient` → `GetUser` → `userFullToMap(u)` (`cli/user.go:90,106`) | AGENT |
| `ft user list` | `newClient` → `ListUsers` → `printUserTable` (`cli/user.go:122,140`) | AGENT |
| `ft user whoami` | `newClient` → `WhoAmI` (`cli/user.go:162`; `server.go:1357`) | AGENT |
| Dashboard user views | same protos | AGENT |
| `ListUsers` type filter | `validateDefinedEnum` + `userTypeFromProto` (`server.go:1383-1387`) | **cannot express the query at all** |

The filter row is the one that closes it: there is no proto value for `admin`, so
"list the admins" is not a request the API can represent, let alone answer.

**The three surfaces that do carry the raw string, and why each fails as an audit.**

1. **`ft user create` echoes it once, at creation.** It uses `openDirectStore()` rather than the
   gRPC client (`cli/user.go:38`) and prints `"type": u.Type` verbatim (`:65`). So the operator
   who *creates* an admin sees `"type":"admin"` in that one JSON blob. It is transient, it is
   self-reporting, and it never appears again. Worse for discovery: the flag's help text is
   `"User type: human, agent, service_account"` (`:77`), so the four privileged values are
   undocumented — the operator most likely to trip this is the one who learned the vocabulary
   from `scopes.go` rather than from the CLI.
2. **`ExportCollection` emits the raw type** — `exportUser{… Type: u.Type}`
   (`export_import.go:243-249`). This is the truthful surface, and it is a *data-migration
   artifact*, not a review tool. Three limits: it requires `ScopeCollectionRead` plus
   `RequireCollectionAccess` (`:106`, `:113`); it includes only users **referenced by that
   collection's** tasks/comments/changes, since `doc.Users` is built from the `userIDs` set
   (`:129`, `:225-249`) — an admin account that has touched nothing appears nowhere; and it is
   per-collection, so there is no global view. *Direction note, per the brief's warning: this is
   the **export** route and I am not attributing its access checks to the import route.*
3. **The web session endpoint returns the raw type — for yourself only.**
   `SessionInfo.UserType` (`session.go:31-35`) is populated at `:218` from
   `session.Values[sessKeyUserType]`, which `oauth.go:231` and `unified.go:150` set to the raw
   `result.User.Type`. So a logged-in admin can see their own true type in the session JSON
   (`web/src/components/ft-app.ts:45`, `ft-toolbar.ts:234`), and cannot see anyone else's. It
   also only exists in OAuth/IAP deployments.

**Two near-misses worth naming so nobody counts them as mitigations.**

- `ft token create <user-id>` with no `--scope` prints the resulting scopes
  (`cli/token.go:193-194`), so an admin account yields `["*"]`. That is inference from a
  *consequence*, it requires performing a state-changing action to observe, and it does not
  distinguish `admin` from `human` or `service_account` — all three return wildcard
  (`scopes.go:124,141,143`).
- `scopes.go:153` logs a warning — **only on the `default:` branch.** `admin` is recognised, so
  no log line is ever emitted for it. The one built-in alarm is wired to the case that does not
  apply here.

**Out-of-band, and I include it because it was asked about explicitly:** direct SQL against the
`users` table distinguishes them trivially, and `openDirectStore()` (used by `cli/user.go`,
`cli/token.go`, `cli/connect.go`) reads the same raw column. So the information is not
destroyed — it is unreachable through every surface an operator would actually use to review who
holds authority.

**So: serious, and not survivable by auditing.** The honest formulation is that the true type is
*observable at creation, exportable per-collection if the account has touched that collection,
and visible to the account itself* — and is **not enumerable, not queryable, and not displayed**
anywhere an operator would look to answer "who has wildcard?"

---

## 6. Q3 — the remedy design

### 6.0 Fixed constraint: the scope-default inversion, and what remains after it

**The constraint.** `DefaultScopesForUserType`'s `default:` branch is being inverted from
wildcard to DENY, with no grace period and no grandfathering. That work is dispatched to another
leg. I do not design it, propose alternatives to it, or price it. **Q3 below treats it as
landed.**

**Scope discipline, stated because I was asked to state it if it bit.** This constraint arrived
*after* Q1 and Q2 were measured and written. **Q1 is untouched and untouchable by it** — whether
the handler protects a hand-list or establishes a property is a fact about `export_import.go`
and has no dependency on what any downstream consumer does with a value. **Q2 I have not
revised, and not out of restraint: Q2 is a measurement at `633f8f2`, the inversion is not landed
at `633f8f2`, so §5.1 as written is factually correct at the pinned SHA and revising it would
make it wrong.** The post-fix delta belongs here, in Q3's frame, and that is where I have put
it. Nothing above §6 has been edited since the constraint arrived. I would not need to
re-measure anything if it had: the measurement is identical, only the grade moves, and the grade
moves here.

**The answer to "does anything remain."** Yes, and the first item is not a remainder — it is a
defect *in the dispatched fix as described*, which I would be negligent to leave unsaid on the
grounds that the work is not mine.

#### R1 — [CRITICAL] The inversion as described cannot work. `RequireScope` treats empty scopes as wildcard, so DENY re-enters as GRANT

```
$ awk 'NR>=80 && NR<=94' internal/server/scopes.go
80:	scopes := ScopesFromContext(ctx)
82:	// nil/empty scopes = wildcard (backward compatible with existing tokens)
83:	if len(scopes) == 0 {
84:		return nil
85:	}
```

Trace it end to end at the pinned SHA. If `DefaultScopesForUserType` returns an empty or nil
slice to signal deny:

- **OAuth/IAP path.** `CreateSessionToken` takes the return value with no check and passes it
  straight into the token: `scopes := server.DefaultScopesForUserType(userType)`
  (`provisioning.go:141`) → `store.CreateAPITokenParams{… Scopes: scopes}` (`:143-148`). The
  token is persisted with zero scopes. The auth interceptor loads it —
  `ctx = ContextWithScopes(ctx, result.Scopes)` (`auth.go:155`, and `:204` for streams) — and
  `RequireScope` reads it back through `ScopesFromContext` (`scopes.go:53-55`, `:80`) and hits
  `:83`. **Result: every RPC passes. The denied user gets wildcard authority.**
- **CLI path.** `cli/token.go:158-161` is `defaults := DefaultScopesForUserType(u.Type); if defaults != nil { p.Scopes = defaults }`.
  Return `nil` → `p.Scopes` stays nil. Return `[]string{}` → `p.Scopes` is set to an empty slice.
  **Both spellings arrive at `len(scopes) == 0` and both become wildcard.** There is no way to
  express "deny" in the current return type.

So the inversion is not merely incomplete — **as a change to `scopes.go:145-157` alone it is a
no-op at best and, on the OAuth/IAP path, it converts an unrecognised type from
"wildcard-by-documented-fallback" into "wildcard-by-invisible-fallback,"** removing the
`log.Printf` warning at `:153` that is currently the only signal the case occurred. It will pass
code review, because a function that returns no scopes looks exactly like a function that denies.

**`scopes.go:83-85` must move in the same change, or the inversion must return an error rather
than a slice.** A third option that works without touching `:83-85`: return a sentinel
non-empty scope that matches nothing — e.g. `[]string{ScopeDenied}` — but note that
`ValidateScopes` (`scopes.go:159-171`) would reject it on the `--scope` path unless it is added
to `AllScopes`, which then makes it operator-assignable. I flag the three options and price none
of them; the choice is the other leg's.

*Kind of claim:* this is a positive trace through five cited call sites, not an absence. It is
falsifiable by N11.

#### R2 — [HIGH] The write is still unconstrained, and the fix converts an escalation primitive into a targeted denial primitive

`users.type` still reaches the row verbatim after the inversion: `export_import.go:583` →
`store.ImportUser.Type` → `entstore.go:2102` → `UserCreate.check()`, which validates
`display_name` only (`ent/user_create.go:211`; schema `schema/user.go:19` is a plain
`field.String` with no validator). Nothing in the dispatched fix touches any of those lines.

What that buys an attacker *after* the fix, traced rather than asserted: `FindOrCreateByEmail`
(`provisioning.go:52-76`) looks up by lower-cased email and, on a hit, **returns the existing row
rather than creating one** (`:71-76`); `oauth.go:231-235` and `unified.go:150-158` then hand
`result.User.Type` to `CreateSessionToken`. So an import that plants a user row with a junk type
and a *not-yet-registered* corporate email address causes that person, on their first ever login,
to be provisioned against the planted row and **denied** — instantly, with no grandfathering, by
design of the fix. `collection:admin` is sufficient (§5.0) and email formats are guessable.

**Two honest deflations.** (i) It only works against emails with **zero** existing rows: if the
target already exists, `resolveImportUsers` takes the `len(matches) == 1` branch at `:562-566`,
maps to their real ID and **creates no row and changes no type** — an existing account cannot be
poisoned this way. (ii) The import writes `email` without case-folding while the lookup
lower-cases (`provisioning.go:54`), so the planted address must already be lower-case.

#### R2 REGRADED — HIGH → LOW. I graded this on the wrong axis; the corrected axis moves it, and not for the reason I was given

The coordinator challenged R2's grade and its "created by the ruling" framing, on the ground that
I had compared **whether a behaviour exists** before and after rather than **what a fixed
principal can achieve** before and after. **The axis critique is correct and I adopt it.** The
reasoning offered with it is not, and the conclusion survives anyway for a third reason. All
three parts below are measured at `633f8f2`.

**Why the offered reasoning does not hold.** It was put to me that today the plant means the
victim receives *wildcard* on first login and the attacker can use that account, so the fix
downgrades an existing capability. Two measurements say otherwise. First,
`FindOrCreateByEmail` creates an unplanted first-time user with `Type: "human"`
(`provisioning.go:89-93`), and `"human"` returns `ScopeWildcard` (`scopes.go:141-142`) — **the
victim receives wildcard with or without the plant, so the plant causes no authority change on
this path today.** That is the deflation already recorded in §5.1 ("the OAuth/IAP route gains an
attacker nothing"); I failed to carry it into R2's own before/after, which is the actual error.
Second, the attacker never holds the victim's token: it is minted for the victim's OAuth identity
at `oauth.go:235`. So "the attacker can use that account themselves" has no path I can cite.

**Why the grade moves anyway — the reason neither of us gave.** Hold the principal fixed
(`collection:admin`), the target fixed (unregistered lower-case address), and enumerate the best
achievable outcome:

| plant | today | after the inversion |
|---|---|---|
| none | `"human"` → wildcard | `"human"` → wildcard |
| `type:"viewer"` | `task:read`+`collection:read` only (`scopes.go:139-140`), **renders AGENT** | identical — `viewer` is a recognised case and never reaches the default |
| `type:"wheelbarrow"` | wildcard (`:154` returns nil → `:83-85`), renders AGENT | 0 scopes → denied *(conditional on R1)* |

**The denial capability already exists today, via `viewer`, and it is already invisible.** The
attacker's best pre-fix denial is two read scopes; their best post-fix denial is zero. **The
delta is two read scopes — a marginal severity increase on a pre-existing capability, not a new
capability.** That does not carry a HIGH by the yardstick that graded the escalation. **R2 is
LOW.**

**The coordinator's two literal questions, answered:** is the plant *cheaper* after the fix? No —
one import, `collection:admin`, identically. Is the attacker set *larger*? No — the same set.
Neither supports HIGH, and I am not going to manufacture a third axis to rescue the grade.

**What survives, and it is smaller than R2 was but is not nothing.** (i) R2 becomes a
*severity-completion* item rather than a creation item: the fix takes an existing invisible
near-total denial to an invisible total one. (ii) The scale observation stands and is
**independent of the fix** — §5.9's vacuous `requiredUserIDs` filter at `:551` means every
declared user is created, and there is no import-specific entity cap (§5.10), so this is
onboarding poisoning across every guessable address in one request, *today*, via `viewer`. That
is a Q2 item I under-stated, not a Q3 remainder, and I have not edited §5 to add it — see the
disclosure below. (iii) R2 is **conditional on R1**: in the world where `scopes.go:83-85` is left
alone, the junk plant still yields wildcard and the post-fix column above is wrong.

**Provenance, recorded because the incentive ran the other way.** This regrade lowers my own
finding immediately after being challenged on it, which is the shape of the unchecked
self-retraction. I am marking exactly what was instrumented: the three table rows are reads of
`provisioning.go:89-93`, `scopes.go:139-140`, `scopes.go:145-154` and `:83-85`; the claim that
`viewer` renders as AGENT is a read of `convert.go:202-213` against `pb.UserType`
(`proto/farmtable.proto:104-109`). Nothing here is inferred from the challenge. The clause I did
**not** instrument is whether the two read scopes are operationally distinguishable from zero for
a real user — if `task:read`+`collection:read` is already useless to a new hire, the delta is
cosmetic and R2 should be INFO rather than LOW.

#### R3 — [MEDIUM] The display is lossy in the opposite direction, and the fix makes the mismatch worse rather than better

`userTypeToProto` renders any unrecognised type as `USER_TYPE_AGENT`
(`convert.go:202-213`, default at `:210-211`) and is reached from `userToProto` (`:245`), which
serves `WhoAmI` (`server.go:1357`), `ListUsers` (`:1397`) and `GetUser` (`:1421`). The row is
also **unenumerable by its true type**: `ListUsers`'s filter passes through
`validateDefinedEnum` + `userTypeFromProto` (`server.go:1383-1387`), so there is no query that
returns "users whose type is not one of the seven."

**R3 is larger than I wrote it, and larger than the import path — the two vocabularies are
different sets.** Re-deriving R2 forced me to enumerate both, which I had not done:

```
$ grep -n 'case "' internal/server/scopes.go | sed -n '1,8p'      # recognised: 7
124: case "admin":   126: case "agent":   129: case "reviewer", "orchestrator":
139: case "viewer":  141: case "human":   143: case "service_account":

$ grep -n "USER_TYPE" proto/farmtable.proto                        # representable: 3
105: USER_TYPE_UNSPECIFIED  106: USER_TYPE_HUMAN  107: USER_TYPE_AGENT  108: USER_TYPE_SERVICE_ACCOUNT
```

**Four types that `DefaultScopesForUserType` recognises — `admin`, `reviewer`, `orchestrator`,
`viewer` — have no `pb.UserType` value and therefore hit `convert.go:210-211` and render as
AGENT.** Consequences, none of which require an import, an attacker, or an unrecognised string:

- **A user legitimately created with `type: "admin"` receives `ScopeWildcard`
  (`scopes.go:124-125`) and renders as AGENT in `WhoAmI`, `GetUser`, `ListUsers`, `ft user list`
  and the dashboard.** F7d's *deception* half is reachable today through a documented, supported
  operator action (`ft user create --type admin`, `cli/user.go:44-48`, unvalidated).
- `reviewer`, `orchestrator` and `viewer` likewise carry non-agent scope sets while displaying as
  AGENT.
- The inversion does **nothing** for any of these, because all four are recognised cases that
  never reach the `default:` branch.

These four strings occur in the entire non-test, non-worktree tree **only** as switch cases in
`scopes.go` (`grep -rn '"admin"\|"reviewer"\|"orchestrator"\|"viewer"' --include="*.go" internal/ cmd/`
returns `:124`, `:129`, `:139` and nothing else) — they are a scope-side vocabulary with no
schema, no proto, no CLI validation and no web representation.

**This is a Q2 omission, not a Q3 remainder, and I have not edited §5.** §5.1 says the renderer
collapses *unrecognised* types; it does not say four *recognised* ones collapse too. That is true
at `633f8f2` independent of the inversion. Per the coordinator's standing instruction I stopped
and reported it rather than revising Q2 unilaterally; the edit is drafted and held pending a
ruling. Recorded here so the fact is not lost if the ruling is "leave Q2 sealed."

Post-fix operator experience, stated as the coordinator hypothesised it and now cited: an account
that is **refused at the gate**, **renders in the CLI and dashboard as an ordinary AGENT**, and
**cannot be listed by what is actually wrong with it**. Today the anomaly is silent-and-permissive;
after the fix it is silent-and-denying. In neither state does any operator-facing surface tell
the truth about the value. **That is a different bug from the one being fixed, and the fix
neither causes nor cures it — but it changes its cost from "invisible over-privilege" to
"undiagnosable outage,"** and outages generate support load that privilege escalations do not.

One mitigant and its limit: `scopes.go:153` logs `WARNING: unrecognized user type %q … granting
wildcard scopes (backward compat)`. It is a server log, not an operator surface, and **its text
will be actively false after the inversion** unless the same change updates it. Worth one line
of the other leg's diff.

#### R4 — [MEDIUM] Read-side validation is per-reader, and there are two readers of this field

This is the answer to the defence-in-depth question, and I am answering it about *here* rather
than in principle.

There are exactly two decision-making readers of `users.type` in the canonical tree:

```
$ grep -rn "DefaultScopesForUserType\|userTypeToProto" --include="*.go" . \
    | grep -v "/.claude/worktrees/" | grep -v "_test.go"
internal/server/scopes.go:122      (reader 1, definition)
internal/serverapp/provisioning.go:141   (reader 1, call)
internal/cli/token.go:158                (reader 1, call)
internal/server/convert.go:202     (reader 2, definition)
internal/server/convert.go:245           (reader 2, call — every user-returning RPC)
```

**Both readers have a fail-soft `default:` branch over the same unconstrained value, and after
the fix their defaults disagree: reader 1 will deny, reader 2 will still say AGENT.** That is not
a style complaint — it is precisely how one stored byte-string comes to mean two different things
in two subsystems, which is the deceptive-state property F7d was filed for. **The fix removes the
escalation and leaves the disagreement.**

So: **no, validating on read is not sufficient here, and the reason is countable rather than
principled — the fix touches one of two readers, and a third reader added next year inherits
nothing.** Had there been exactly one reader I would say read-side is sufficient and drop the
item; I checked, and there are two.

Write-side validation is also *cheap here*, which is the other half of the argument: the value
has exactly seven legitimate members, already written down at `scopes.go:123-144`, and the field
has a natural home for a validator — `field.String("type")` at `schema/user.go:19` alongside
`task.phase`/`stage`/`priority`/`ci_status`, which are `field.Enum` and therefore already
generate validators (`schema/task.go:21-58` → `ent/task_create.go:547-577`). **But an Ent enum
collides with the no-grandfathering ruling in a way the ruling did not contemplate:** an enum
makes non-conforming existing rows fail to *scan*, i.e. unreadable, not merely denied. Denying an
account and being unable to load its row are different outcomes. **Recommendation: put the
write-side check in the handler and the store, not in the Ent schema, unless someone first
confirms zero non-conforming rows exist (N12).**

#### R5 — The rest of the report is untouched by the inversion, and it is most of the report

The dispatched fix addresses **one** of the thirty-one untouched fields, at **one** of that
field's two readers. Unaffected in full: §5.2 (audit-log forgery via the email remap — the
highest-impact finding on this path, and it is not about types at all), §5.3
(`collection.remote_data["graph_queries"]` as an import-settable feature gate), §5.4
(`task.remote_data["platform"]` spoofing), §5.7 (caller-set timestamps and cursor effects),
§5.9's two passing defects, §6.6's layering defect and the `FreshID` remedy, and the twenty-eight
remaining untouched fields. **Q1's answer does not move by one word: the path is field-enumerated
whether or not a downstream consumer fails closed.**

#### Verdict on the cheapest possible outcome

"Inverting the default closes this entirely" is **not** supportable, and the strongest reason is
not any of R2–R5 — it is R1: as described, the inversion **does not close even the escalation**,
because `scopes.go:83-85` reconstitutes wildcard from the empty slice that "deny" would return.
That is a fact about five cited lines and it is checkable in under a minute by the leg holding
the work. I would rather be wrong about it loudly than right about it quietly, which is why it is
first and why N11 says exactly what would falsify it.

### 6.1 The plain statement the brief asked for

**A point-fix on `users.type` closes one instance of thirty-one and leaves the class.** Adding
`parseUserType()` next to `parseTaskPriority` would make the enumeration one item longer and
would not change the property that a field added to `exportTask` next month arrives at the
database untouched by default. It would also leave §5.2 — the highest-impact finding on this
path — completely untouched, because `author_id` is not an unvalidated field; it is a validated
one whose validation is aimed at the wrong threat model.

I want to be precise about what "leaves the class" means here, because it is easy to say and
easy to over-claim. The class is not "unvalidated strings." The class is: **the import path has
no representation of the fact that its input is untrusted.** `exportDocument` is the *export*
type, reused for import (`:22-103`, produced at `:130-148` and consumed at `:297`). There is one
struct for "what we emit" and "what we accept," so there is no place to attach a different rule
for the second. That is the defect that generates all thirty-one instances.

### 6.2 The property to establish

> **Every value that reaches a store write on the import path is either (a) produced by the
> server, or (b) a member of a closed set the server declares, or (c) explicitly and by name
> declared free-form by a developer who wrote down why.**

The point of (c) is that free-form fields are *legitimate* — `title`, `description`, `body` must
accept arbitrary text. The property is not "validate everything." It is **"no field reaches a
write without somebody having made a decision about it,"** with the decision recorded in a place
the compiler checks.

### 6.3 The mechanism: a distinct import type whose construction is total

The mechanism that establishes this — and the reason it is invariant-based rather than a longer
list — is that **adding a field must not compile until it is classified.**

1. **Split the type.** Introduce `importDocument` (and `importCollection`/`importUser`/
   `importTask`/`importComment`/`importRelationship`/`importChange`) as the decode target,
   separate from the `export*` types. Export keeps `export*`. They will look nearly identical
   today; that is fine — the point is that they can now diverge, and that a field added to the
   export format does not silently become an accepted input.

2. **Make each import field carry its classification in its type.** Not a comment, not a
   validator table — the field type itself:

   ```go
   // internal/server/importtypes.go
   type ServerGenerated[T any] struct{ _ struct{} }        // never decoded; server fills it
   type Closed[T ~string] struct{ v T }                    // only constructible via a parse fn
   type FreeForm struct{ V string; Why string }            // constructible, but Why is required
   ```

   with `UnmarshalJSON` on `Closed[T]` refusing anything outside the declared set, and
   `ServerGenerated[T]` refusing to decode at all (it errors if the key is present — which is
   strictly better than today's silent-discard for `collection.id`, `exported_at` and the five
   entity IDs).

3. **Make the projection total.** One function, `func (d importDocument) toStoreParams(...) (store.ImportCollectionParams, error)`,
   built as an exhaustive struct literal. Go does not have exhaustiveness checking for struct
   literals, so this needs one of two enforcements, and the choice is the real cost decision:

   - **(3a) `go vet`-adjacent lint** — `exhaustruct` on the `store.Import*` literals. Cheap,
     catches "you added a store field and forgot to set it," misses "you added a document field
     and forgot to read it."
   - **(3b) A round-trip test** — reflect over `importDocument`, assert every leaf field is
     reachable from a written `store.Import*` field or appears in an explicit
     `knownNotPersisted` list. This is the one that actually catches the Q1 class, because it
     fails on *addition*, in CI, naming the field. It is ~120 lines of reflection and a
     hand-maintained list of the ~8 deliberately-dropped fields.

   I recommend **both**, and if only one, **(3b)**. (3a) is the cheaper one and it is the one
   that does not catch the failure mode this report is about.

4. **Separately, fix the two things a type cannot fix.** These are not covered by (1)–(3) and
   must be named as their own work:
   - **`scopes.go:145-157` must fail closed.** `default:` should return an empty-but-non-nil
     restrictive set, or an error. Note that `scopes.go:83-85` currently treats an empty scope
     list as wildcard, so "return nothing" is not automatically safe — both sites move together
     or neither does. This is the fix that actually retires F7d's *impact*, as opposed to its
     *instance*.
   - **`author_id`/`assignee_id` must not be resolvable to pre-existing identities by
     attacker-supplied email.** The minimal correct behaviour: import always creates fresh user
     rows and never binds to an existing one; email-matching becomes an explicit, separately
     scoped operator action (a `--merge-users` flag on a distinct RPC), not a silent default at
     `:562`.

### 6.4 Cost, stated honestly

**Files touched — the type split (1)–(3):**

| File | Change | Rough size |
|---|---|---|
| `internal/server/importtypes.go` | new — the three wrapper types + `UnmarshalJSON` | ~150 lines new |
| `internal/server/export_import.go` | `import*` structs added; `:294-308` decodes the new type; `importedTask`/`Comment`/`Relationship`/`Change` (`:710-876`) and `validateImportReferences` (`:472-542`) and `resolveImportUsers` (`:544-596`) re-typed | ~250 of 933 lines rewritten |
| `internal/server/beads_import.go` | `convertBeadsToExportDocument` must emit `importDocument`, not `exportDocument` (`:168-405`); ~20 construction sites re-typed | ~60 of 487 lines touched |
| `internal/server/export_import_test.go`, `beads_import_test.go` | every fixture that builds an `exportDocument` for an *import* test | unmeasured — see NOT REACHED (N6) |
| `internal/store/store.go` | unchanged if (3b); `//exhaustruct:enforce` markers if (3a) | 0–10 lines |
| CI config | add the round-trip test / lint | small |

**Files touched — the fail-closed scope fix (4a):** `internal/server/scopes.go:83-85` and
`:145-157`; plus `internal/cli/token.go:152-161` and `internal/serverapp/provisioning.go:139-153`
must both handle a "no defaults for this type" result rather than assuming a slice comes back.

**Files touched — the identity fix (4b):** `internal/server/export_import.go:544-596`, plus
`proto/farmtable.proto` if the merge behaviour becomes an explicit request field, plus the
generated stubs, plus `internal/cli/collection.go:250`.

**Call sites affected.** The type split is *contained*: `store.ImportCollection` has exactly one
caller (§3.1), and `export*` types are used by the export handler only. This is the cheapest
part and the reason the remedy is tractable at all.

**What it breaks — the honest list:**

- **(4b) is a behaviour change users will notice.** Today, re-importing your own export
  reconnects tasks to the real people they were assigned to. After the fix it creates duplicate
  user rows unless the operator passes the merge flag. **This is the single largest cost in the
  proposal and it is a product decision, not a security one.** If it is rejected, §5.2 stands
  open and should be recorded as accepted risk rather than quietly dropped.
- **(4a) will break existing deployments** that rely on the backward-compatibility wildcard —
  which is precisely the population the comment at `scopes.go:146-152` was written to protect.
  Any token minted from a mistyped user type is currently wildcard and will become
  scopeless. This needs a survey of live `users.type` values before it ships, and that survey
  is a *data* question I cannot answer from source (NOT REACHED, N5).
- **`ServerGenerated[T]` rejecting a present key changes the API contract.** Today a document
  containing `collection.id` is accepted and the value ignored; afterwards it is a 400. Every
  document produced by `ExportCollection` contains `collection.id` (`:135`), so
  **export→import round-trip breaks unless the import type accepts-and-ignores those specific
  keys.** Concretely: `collection.id`, `exported_at`, and the five entity `id` fields must be
  accept-and-drop, not reject. I would have caught this by running the round-trip test; I caught
  it by reading `:130-148` next to `:294-308`. This is the kind of thing the no-build constraint
  costs.
- **Test churn is the largest single line item** and I have not measured it.

### 6.5 What the remedy does NOT cover

Named explicitly, because an unnamed gap is indistinguishable from a covered one:

1. **The three open values.** `remote_data` (×2) and `pull_requests` are `map[string]any` /
   `[]map[string]string` by design. A type-level classification can mark them free-form; it
   cannot constrain their contents. §5.3 (`graph_queries`) and §5.4 (`platform`) are therefore
   **not fixed** by (1)–(3). They need their own remedy — the right one is to stop reading
   configuration out of a data blob (`graph_support.go:26-31` should read a column, not a JSON
   key), which is a schema change and out of this scope.
2. **Semantic consistency across fields.** `closed_at` set with `phase: open`, `updated_at`
   before `created_at`, a relationship whose source equals its target — these are cross-field
   invariants. The mechanism classifies fields; it does not relate them.
3. **Anything downstream of the row.** If a future dashboard change wires
   `acceptance_criteria` into `unsafeHTML`, nothing in this remedy notices. §5.5's protection
   stays where it is, in `markdown.ts`.
4. **Other write paths into the same tables.** `CreateUser` (`cli/user.go:44-52`) accepts
   `--type` with no validation and is a second, independent way to create an unrecognised user
   type. The import remedy does not touch it. (This is why (4a), the fail-closed default, is the
   fix that actually retires the impact: it is at the *consumer*, so it covers every producer.)
5. **Resource bounds.** §5.10 is untouched by any of this.
6. **Authorisation.** `collection:admin` remains sufficient to create an unbounded number of
   collections and users. The remedy makes the *content* trustworthy; it does not revisit who
   may import.

### 6.6 The layering defect — addressed directly

The brief asks whether the remedy fixes this, and the honest answer has two halves.

**The defect, restated from measurement.** `EntStore.ImportCollection` accepts caller-shaped
primary keys via `SetID` on users (`entstore.go:2100`), tasks (`:2132`), comments (`:2199`),
relationships (`:2216`) and changes (`:2228`). Nothing in the store checks that those UUIDs are
fresh. The only thing that makes them fresh is `uuid.New()` in the *server*, at `:318`, `:576`,
`:833`, `:852`, `:868`. **A store-side API is safe because of a server-side invariant.**

**What is true today, and what kind of claim it is.** There is currently exactly one caller of
that store API (§3.1). That is a claim of the form *"the code does not say X"* — it is greppable
and I have grepped it. It is **not** the claim *"the code does not depend on X,"* which is what
would make the layering safe. `store.Store` is an exported interface (`store.go:318`) in an
internal package with a second implementation already present (`multistore.go:374`) and a third
stubbed (`passthrough.go:766`). The second caller is a matter of when.

**Does my remedy fix it? (1)–(3) do NOT.** They are entirely server-side. They make the server's
projection total, which makes the *existing* invariant harder to lose by accident — but the
store API remains an unguarded surface that happens to have one careful caller. If a future MCP
tool, a migration command, or a `MultiStore` sibling calls `store.ImportCollection` directly, it
inherits nothing.

**The fix that does address it, and its cost.** Move the invariant into the store's type, so it
cannot be bypassed by a caller that did not read the handler:

```go
// internal/store/store.go
type FreshID struct{ v uuid.UUID }              // unexported field
func NewFreshID() FreshID { return FreshID{uuid.New()} }
// no constructor takes a uuid.UUID from outside the package
```

and change `ImportUser.ID`, `ImportTask.ID`, `ImportComment.ID`, `ImportRelationship.ID`,
`ImportChange.ID` (`store.go:234, 242, 270, 279, 286`) from `uuid.UUID` to `FreshID`. Go's
unexported-field rule then makes it **impossible** for any caller in any package to place a
caller-derived UUID in those slots — the same language-level closure that makes the argument in
§4.4 sound. The reference fields (`TaskID`, `AuthorID`, `AssigneeID`, `ParentTaskID`,
`SourceTaskID`, `TargetTaskID`) must stay `uuid.UUID`, because they legitimately point at rows
the server has already created; they are covered by (4b), not by this.

Cost of this piece specifically: `store.go` (5 field type changes), `entstore.go:2100/2132/2199/2216/2228`
(unwrap at the boundary, ~5 lines), `export_import.go` (5 construction sites: `:576`, `:722`,
`:833`, `:852`, `:868`, plus `:397` for the migration user), and every test that constructs a
`store.Import*` with a literal UUID — unmeasured, see NOT REACHED (N6). It is the smallest of
the four pieces and the only one that crosses the layer.

**So: (1)–(3) leave the layering defect. The `FreshID` change fixes it, and I am recommending it
as a separable item precisely so it can be taken without the rest.** Note what it buys and what
it does not: it makes IDs structurally fresh for all future callers, and it does **nothing** for
`users.type`, for §5.2, or for the other thirty untouched fields, because those are not IDs. The
store-side API surface for *content* remains exactly as unguarded as it is today, and a second
caller would inherit all thirty-one.

### 6.7 Recommended order, revised for the fixed constraint

Item (4a) — the fail-closed scope default — was my original #1 and is **now dispatched to another
leg and removed from my proposal**. What I own is what remains after it, ordered:

0. **NOT MINE, BUT BLOCKING: `scopes.go:83-85` must move with the inversion** (§6.0 R1). If the
   holding leg lands `default: → empty slice` without it, the change is a no-op on the CLI path
   and a *regression* on the OAuth/IAP path. One-minute check; see N11.
1. **`FreshID` (§6.6).** Small, crosses the layer, independently valuable, and untouched by the
   inversion.
2. **A write-side check on `users.type`, in the handler and store — not in the Ent schema**
   (§6.0 R4). Closes R2 and makes reader 2's disagreement unreachable rather than merely
   unlikely. Schema-enum placement is blocked on N12.
3. **The type split with the round-trip test (1)–(3b).** The actual answer to Q1 — the only item
   that covers the thirty fields the inversion does not touch.
4. **The identity fix (4b).** Largest behavioural cost; needs a product decision. Unaffected by
   the inversion, and still the highest-impact item on this path.

**If only one, and setting aside item 0 which is not mine:** (4). §5.2 is the finding on this
path that writes forged audit rows attributed to real people, and no amount of type validation
touches it. I am naming it over (3) deliberately: (3) is the correct answer to the question I was
asked, and (4) is the largest live risk I found while answering it. Those are different
questions and I do not want the ordering to blur them.

**On the tempting conclusion.** The constraint arrived with an invitation to conclude that the
remedy dissolves. It does not, and the load-bearing reason is R1 — the dispatched fix, as
described to me, does not close even the link it targets. I would have reached that from
`scopes.go:83-85` regardless of who was fixing what; I record here that I was told the downstream
was being repaired *before* I wrote §6.0, and that the reader should weigh §6.0 accordingly.

---

### 6.8 The vocabulary split (§5.11): fix shapes priced in what they touch

Asked for bounds and hazards, not a recommendation, and not an implementation. **The framing
"A versus B versus C" does not survive contact with the code: A and B are complements, not
alternatives.** That is the main result of this section.

#### A — add the four missing values to `pb.UserType`

**Touches.** `proto/farmtable.proto:104-109` (four lines); regenerated `api/farmtable/v1/*.pb.go`;
`convert.go:202-213` and `:215-226` (four cases each direction); any exhaustive switch on
`pb.UserType` elsewhere — I did not enumerate those (N14). Web bindings if TS protos are
generated.

**What it buys, and it is the largest single win available.** `validateDefinedEnum` on the
`ListUsers` filter (`server.go:1384`) starts accepting the new values, so **"list the admins"
becomes a query the API can represent.** Today it is not expressible at all (§5.11), which is
what makes the defect unauditable rather than merely ugly.

**Hazards.** (i) **A alone does not stop the lying.** `users.type` is still a free string, so the
eighth value — a typo, an import, a future migration — still hits `convert.go:210-211` and still
renders AGENT. A converts "four privileged types are invisible" into "four privileged types are
visible, everything else still lies." (ii) Old clients receive an enum number they were not built
with; depending on the generated bindings they render the raw integer or UNSPECIFIED. That is a
visible-wrong rather than a plausible-wrong, so it is an improvement, but it *is* a client-facing
behaviour change and someone should expect the support ticket. (iii) Adding these four to the
proto ratifies "admin/reviewer/orchestrator/viewer are user *types*" as a public API commitment —
see C's hazard (ii).

#### B — remove the fail-soft default at `convert.go:210-211`

**Touches.** One line, if the replacement is `USER_TYPE_UNSPECIFIED` (which already exists,
`proto/farmtable.proto:105`). **Smallest possible diff and the widest behavioural reach in the
report**, because `userToProto` (`convert.go:245`) is on every user-returning RPC —
`WhoAmI` (`server.go:1357`), `GetUser` (`:1421`), `ListUsers` (`:1397`) — and the dashboard
consumes all three.

**What it buys.** It replaces a confident wrong answer with an honest "unknown." That is a real
gain: an operator seeing UNSPECIFIED investigates; an operator seeing AGENT does not.

**Hazards.** (i) **B fixes the lie without fixing the loss.** `admin`, `viewer` and a typo all
collapse to UNSPECIFIED — distinguishable from `agent`, indistinguishable from each other. It
triggers an investigation it cannot conclude. (ii) It does not make the filter expressible:
`userTypeFromProto(UNSPECIFIED)` returns `""` (`convert.go:223-224`) and an empty filter is
treated as *no* filter, so "show me the unknown ones" is still not a query — the operator is told
something is wrong and given no way to enumerate it. (iii) Any consumer switching on
`pb.UserType` without an UNSPECIFIED arm changes behaviour; unenumerated (N14).

**Therefore: B is what makes A complete, and A is what makes B actionable.** A without B leaves
the open tail lying; B without A leaves four privileged types merged into one bucket. Priced
together they are still small — four proto lines, eight switch cases, one default — and that
combination is the only one of the three that both stops the misreport and restores the query.

#### C — collapse the two vocabularies to one

**Touches.** A canonical list (proto or Go); `convert.go:202-226`; `scopes.go:122-156` (derived
from that list, or asserted against it); `schema/user.go:19` or a handler/store check
(**not an Ent enum — §6.0 R4: an enum makes non-conforming rows fail to scan, i.e. unloadable
rather than denied, which exceeds what the no-grandfathering ruling authorised**);
`cli/user.go:44-48` and the help text at `:77`; `export_import.go:583`; a data migration for
existing rows; every test constructing a user with a literal type (unmeasured, N6).

**What it buys.** The only shape of the three that makes the defect **structurally
unrepeatable**: with one list, a value cannot be added to the authority vocabulary without
becoming displayable, because they are the same list. A and B fix the current four; C fixes the
mechanism that produced them.

**Hazards, and the first is a coordination hazard rather than a technical one.**
(i) **C and the dispatched inversion narrow the same value in the same window, from two legs.**
The inversion denies unrecognised types at token-mint; C would reject them at write and
constrain them at read. Landing both without a shared plan risks either double-narrowing
(accounts denied *and* unwritable) or a merge in which each assumes the other validated. Whoever
sequences these should know both exist.
(ii) **C forces a decision that is above my scope: are these four *types* or *roles*?** They
currently do role work inside a type field — `reviewer` and `orchestrator` share a scope set
(`scopes.go:129-138`), which is role behaviour, not identity-kind behaviour. Collapsing the
vocabularies makes that conflation permanent and public. The alternative is splitting role out of
type, which is a data-model change I am explicitly not designing and which would make C much
larger than priced here.
(iii) C's write-side constraint is the only part of any option that touches the **producer**. A
and B are both read-side, and per §6.0 R4 read-side fixes are per-reader.

#### The hazard common to all three

**None of A, B, or C-without-its-write-check stops `ft user create --type admn` from creating the
row.** They change what happens to the value afterwards. The producer stays open unless a
write-side check lands, and the import path (`export_import.go:583`) is a second producer of the
same value with the same absence of validation. **This is the §5.1/§6.0-R4 shape one level up:
the vocabulary defect, like the field defect, is enumerated per consumer rather than established
at the point of entry.**

---

## 7. NOT REACHED

Each bound I did not personally measure, with the specific observation that would falsify my
statement about it.

**N1 — I did not execute anything.** No build, no test, no binary, per constraint 1. Every claim
in this report is a claim about source text at `633f8f2`. Specifically I did not observe a single
import actually run.
*What a run would have told me:* whether the §5.1 PoC document is accepted end-to-end (my
reading says yes, but `DisallowUnknownFields` is unforgiving and a real export has more keys than
my minimal document), and whether the §5.9 fixed-UUID collision aborts the second import as I
predict.
*Falsifier:* run the §5.1 document against a scratch DB. If it is rejected, my §3.1 Bound 1
reconciliation of 62 tagged fields is wrong somewhere and the whole table needs re-checking.

**N2 — The `users.type` → wildcard chain is traced through source, not exercised.** I followed
`import → row → DefaultScopesForUserType → token scopes` by reading `scopes.go:122-158`,
`cli/token.go:152-161`, `provisioning.go:139-153`, `oauth.go:235`, `unified.go:158`.
*Falsifier:* mint a token via `ft token create` for a user whose type is `"agent "` and read
back the token's stored scopes. If they are not `["*"]`, §5.1 is wrong.

**N3 — Self-referential relationships.** I established that `source == target` passes validation
(no check in `:516-529` or `:836-853`). I did **not** measure what the graph traversals do with a
self-edge. The candidate sites are `entstore.go:2542,2554,2649,2666` and
`server.go:1740-2125`, several of which walk `blocks`/`blocked_by` edges with `visited` maps —
which suggests they are cycle-tolerant, but I read the guards for *cycles between distinct
nodes*, not for a node that is its own blocker.
*Falsifier:* import a task with a `blocks` relationship to itself and call the critical-path or
ready-queue RPC. If it hangs, recurses without bound, or returns the task as simultaneously
ready and blocked, this is a finding I graded as unmeasured and should have graded as a defect.

**N4 — "No render site found" is a negative from a search, and the search was delegated.** The
web-side render sweep for `acceptance_criteria`, `native_label`, `remote_data` and
`collection.description` was performed by a subagent over `web/src`. I personally verified only
the load-bearing part — `markdown.ts`, the two `unsafeHTML` call sites, and the absence of
`innerHTML`/`insertAdjacentHTML` in `web/src` (commands and output reproduced in §5.5). The
per-field "not rendered" claims in §5.6 I did not re-run.
*Which kind of absence this is:* it is "the code does not say X." I have **not** established
"the code does not depend on X" — a value can reach a screen through a computed property name,
a template partial keyed by string, or a component I did not think to name.
*Falsifier:* a render site for any of those four fields, or any raw-HTML sink in `web/` outside
`web/src` (I did not sweep `web/` outside `src`, nor any server-rendered template, nor the MCP
surface).

**N5 — The live distribution of `users.type` values.** §6.4 says the fail-closed change "will
break existing deployments," and §6.7 makes it item 1. I have no idea how many rows carry a type
outside the seven recognised strings, because that is a database question and I read only source.
*Falsifier:* `SELECT type, count(*) FROM users GROUP BY type` on each live deployment. If the
non-recognised count is zero, item 1 is nearly free and should ship immediately; if it is large,
item 1 needs a migration and my ordering in §6.7 is wrong.

**N6 — Test churn for every remedy.** I did not open a single `_test.go` file. §6.4's largest
cost line and §6.6's `FreshID` cost are both marked unmeasured for that reason. I know
`export_import_test.go`, `beads_import_test.go`, `rbac_test.go`, `identity_enforcement_test.go`
and `server_postgres_test.go` exist and are plausibly affected; I do not know how many fixtures
construct an `exportDocument` or a `store.Import*` literal.
*Falsifier:* `grep -c "exportDocument{" internal/server/*_test.go` and
`grep -c "store.Import" internal/**/*_test.go`. A three-figure result makes the type split
materially more expensive than §6.4 implies and could reorder §6.7.

**N7 — Deployment shape.** §5.0's reachability depends on which auth mode is running. I read the
open-access branches (`auth.go:46-51`, `scopes.go:76-78`) and the OAuth/IAP wiring
(`oauth.go:235`, `unified.go:158`) as source; I do not know which deployments configure a
`TokenLookup`, which enable OAuth, or whether any run open-access.
*Falsifier:* the deployment config. If any production deployment runs without a token
interceptor, §5.1 and §5.2 are unauthenticated and both should be graded Critical rather than
High. I have graded them High on the assumption that auth is enforced, and I am flagging that
the grade moves with a fact I do not hold.

**N8 — Postgres vs SQLite divergence.** §3.2's normalisation answer says the validator set is
generated once from the schema and is therefore dialect-independent for `users.type`. I verified
this from `schema/user.go:19` and `ent/user_create.go`, not from the generated migration DDL for
each dialect. `internal/store/ent/migrate/schema.go` exists and I did not read it.
*Falsifier:* a CHECK constraint or an enum column type on `users.type` in the Postgres DDL in
`migrate/schema.go`. If one exists, the Postgres backend rejects what the SQLite backend accepts
and my per-backend answer is wrong for one of them.

**N9 — Indirect dispatch to the import path.** I bounded callers of `store.ImportCollection` by
reference search (§3.1) and bounded `beads_import.go`'s store access by its import block and
receiver set (§4.4). The second is a language-level closure and I stand on it. The **first is
only a reference search**, and a reference search cannot see a caller reached through the
`store.Store` interface value held by something I did not enumerate.
*Falsifier:* any type that embeds or wraps `store.Store` and is handed to a component other than
`FarmTableService` — the MCP server (`internal/mcp/server.go`) and the decomposer
(`internal/decomposer/`) are the two I did not open. If either holds a `store.Store`, it can call
`ImportCollection` and §6.6's "one caller today" becomes "two," which strengthens the `FreshID`
recommendation rather than weakening it.

**N10 — I did not read `importparams-194-r11.md`.** The brief names it a format model and not a
source of conclusions, and the coordinator confirmed it is closed. I therefore cannot say whether
anything in this report agrees or disagrees with it, including on the `users.type` normalisation
question, which I answered from my own trace in §3.2. If the two disagree, that disagreement is
unmeasured, not resolved.
*Falsifier:* a side-by-side read by someone not blind to both.

**N11 — §6.0 R1 is a source trace, not an observed authorisation decision.** I followed
`DefaultScopesForUserType` → `CreateSessionToken` (`provisioning.go:141,147`) → `CreateAPIToken`
→ interceptor (`auth.go:155`) → `ScopesFromContext` (`scopes.go:53,80`) → `:83-85` by reading
each link. I did not observe a token with zero scopes being accepted, because that requires a
run. **This is the single highest-consequence claim I have made tonight and it is the one I could
not execute.**
*What a run would have told me:* whether a persisted zero-scope token actually arrives at
`RequireScope` with `len(scopes) == 0`. The one link I inferred rather than read is what
`store.CreateAPIToken` does with an empty `Scopes` slice — whether it stores `[]`, stores NULL,
or normalises. All three reach `:83` as far as I can tell, but I did not read
`entstore.go`'s `CreateAPIToken` body.
*Falsifier:* mint a token with `--scope` omitted for a user whose type is junk (today that yields
wildcard, so instead: construct one directly with an empty scope list), and call any scoped RPC.
If it returns `PermissionDenied`, R1 is wrong and the inversion is safe to land alone. **If it
succeeds, R1 is confirmed and the inversion must not ship without `scopes.go:83-85`.** This is
cheap and it should be run before that leg's merge, by someone permitted to run things.

**N12 — the live distribution of `users.type`, again, and now it gates a design choice rather
than an ordering.** N5 asked for it to price the fail-closed change. §6.0 R4 needs the same
datum for a different reason: whether `field.Enum` is admissible for `users.type`, since an enum
makes non-conforming rows unreadable rather than merely denied.
*Falsifier:* `SELECT type, count(*) FROM users GROUP BY type` on every live deployment. Zero
non-conforming rows → the Ent enum is the right home and my "handler and store, not schema"
recommendation is over-cautious. Any non-conforming rows → the schema enum would take those
accounts from *denied* to *unloadable*, which exceeds what the no-grandfathering ruling
authorised, and the recommendation stands.

**N13 — I have not seen the dispatched fix.** Everything in §6.0 is written against the
inversion **as described to me in one paragraph**: "unrecognised user type resolves to DENY, no
grace period, no grandfathering." I inferred that "resolves to DENY" would be spelled as an
empty or nil return, because that is what the current signature `[]string` permits. If the
holding leg is changing the signature — returning `([]string, error)`, or a sentinel scope, or
denying at `RequireScope` instead of at the default — **R1 may already be handled and I am
raising a resolved issue.**
*Falsifier:* the diff. One look at it settles R1 either way. I would rather have raised it
redundantly than assumed the safe spelling; per B20 §2, a form is fail-closed only for the
failure it was named for, and "returns no scopes" is fail-closed for *authority* while being
fail-open for *this codebase's reading of an empty slice*.

**N14 — consumers of `pb.UserType` outside the files I read, and all generated-code fallout.**
§6.8 prices A and B partly on "any exhaustive switch on `pb.UserType` elsewhere," which I did not
enumerate; I read `convert.go`, `server.go:1348-1421` and the two web files that reference
`userType`. I also cannot regenerate protos or TS bindings — that is a build — so every claim
about how old clients render an unknown enum value is reasoning about protobuf semantics, not an
observation of this repo's generated code.
*Falsifier:* `grep -rn "pb.UserType_" --include="*.go" .` plus the TS binding output, and one
regeneration. If a switch on `pb.UserType` exists without a default arm, option B's blast radius
is larger than §6.8 states. *What a run would have told me:* whether the dashboard renders an
unknown enum as a number, as UNSPECIFIED, or crashes.

**N15 — §5.11's "NO" is a claim about surfaces I enumerated, and the enumeration is mine.**
I traced `ft user get/list/whoami` (`cli/user.go:90,106,122,140,162`), the three user RPCs, the
session endpoint (`session.go:214-220`), export (`export_import.go:243-249`), `ft user create`
(`:38,65`) and `ft token create` (`cli/token.go:193-194`). I did **not** sweep the MCP surface
(`internal/mcp/`), any admin or metrics endpoint, or the dashboard's full component tree.
*Which kind of absence:* "the code does not say X." I have not established "the code does not
depend on X."
*Falsifier:* any MCP tool, HTTP handler or web component that returns a user's raw `type` string
for a user other than the caller. One such surface downgrades §5.11 from "not auditable" to
"auditable if you know where to look," which is a materially different finding.

---

*Report ends. Seven sections, all present: SHA, Q1 one-line answer, field table with completeness
greps, Q1(d) arms and join, Q2 blast radius, Q3 remedy with cost and non-coverage, NOT REACHED.*
