# Security audit — XSS round 7 — commit `e4e3d13`

Leg: `audit-xss-r7`. Tree (ROOT): `/workspace/farmtable-xss-r7-audit`, detached at
`e4e3d1352809428a5dfe386bb53c0b18a562332f` (verified with `git rev-parse HEAD`).
Round base `c108acb`; branch base `d305391`; merge target referenced by the diff
`cc92735` (resolves in this clone: `git cat-file -t cc92735` → `commit`).

Diff audited: `c108acb..e4e3d13`, 7 commits, 7 files, +931/-81.

**VERDICT: APPROVE WITH CONDITIONS** — 7 conditions (5 in §7 from the cold pass,
2 added in §8.10 after reconciliation). Each is a one-line documentation change or
a named follow-up; none blocks on production code.

**Findings: 10 numbered, 11 items (5 splits into 5a/5b). Critical 0 · High 0 ·
Medium 3 · Low 5 · Info 3 — 11 = 0+0+3+5+3.** Nothing in this
diff is exploitable at `e4e3d13`. Every finding is about the accuracy of a
security *argument* the round placed in the tree, which this report treats as a
control because the round intends it to be relied on.

Order of work followed: unscoped cold pass first (§3), then the brief's two axes
(§4), then verdict (§7), then `_r7-PHASE-TWO.md` and reconciliation (§8). Every
finding is attributed to the pass that produced it. Phase two was not opened
until §§1–7 were on disk, and nothing in §§1–7 has been edited since.

**Read §8.0 first if you are scoring this leg: a contamination disclosure.**

---

## 1. POPULATION BEFORE VERDICT

Six censuses. Each carries three integers, and each states its instrument and
its bound. All commands were run with ROOT `/workspace/farmtable-xss-r7-audit`
at revision `e4e3d13` unless stated.

### CENSUS 1 — files changed by the round

    ENUMERATED 7 = FLAGGED 4 + EXCLUDED 3

Instrument: `git diff --stat c108acb..e4e3d13`.

FLAGGED (carry at least one finding): `internal/server/convert.go`,
`internal/server/export_import.go`, `web/src/capabilities.ts`,
`internal/server/remotedata_log_test.go`.
EXCLUDED (read in full, no finding): `internal/webguard/doc.go` (every factual
claim checked and correct — see §6), `internal/webguard/remotedata_consumers_test.go`,
`.design/project-log/2026-07-29-dev-xss-r7-fix.md` (read, not audited as a
control; see §8).
The excluded count is non-zero and each member was opened.

### CENSUS 2 — line citations introduced by the diff

    ENUMERATED 27 = FLAGGED 5 + EXCLUDED 22

("FLAGGED" = does not resolve to the thing the prose says is there. "EXCLUDED" =
resolves correctly, verified by printing the cited line.)

Instrument, two of them, and they overlap:
1. `git diff c108acb..e4e3d13 -- internal/server/convert.go internal/server/export_import.go internal/webguard/doc.go web/src/capabilities.ts | grep '^+' | grep -oE '[A-Za-z_./]*\.(go|ts)?:[0-9]+(-[0-9]+)?|:[0-9]{3,4}'`
2. Manual attribution of the bare `:NNN` forms to their subject file by reading
   the surrounding prose (a regex cannot do this).

Bound on the instrument: instrument 1 does not match citations to extensionless
files, so `Dockerfile:9` and `Dockerfile.server:9` were added by hand after
reading `doc.go`; a citation to some other extensionless path would have been
missed. Instrument 1 also cannot see name-only references — those form a
separate population of ~15 (`convert.go` `collectionToProto`, `ft-app.ts`
`isCollectionWritable`, `capabilities.ts` `getCapabilities`, `urlvalidate.go`
`sanitizeRemoteData`, `.github/workflows/ci.yml`), all of which I resolved by
identifier; all correct, and they are deliberately outside the 27.

Every one of the 27 was resolved by `sed -n "${line}p" "$file"`. The five
failures are Finding 3.

### CENSUS 3 — capability flags and their enforcement sites

    ENUMERATED 15 = FLAGGED 1 + EXCLUDED 14

Instrument: for each field of `CollectionCapabilities`,
`grep -rn "<flag>" --include='*.ts' web/src | grep -v 'web/src/capabilities.ts' | wc -l`,
plus `grep -rn 'capabilities\[|Object.entries(.*capab|Object.keys(.*capab|keyof CollectionCapabilities' --include='*.ts' web/src`
(no matches → there is no generic, flag-agnostic enforcement loop; that negative
is what makes the per-flag count meaningful).

FLAGGED: `canEditRelationships` — `false` in `GITHUB_CAPABILITIES`, carries a
user-visible tooltip, has **zero** enforcement sites, and has two live write
paths. Finding 2.
EXCLUDED: 9 flags that are `true` under `GITHUB_CAPABILITIES` (nothing to
enforce); `canEditDates` (enforced, 6 sites, `ft-inspector-meta.ts`);
`canDeleteTask`, `canEditAcceptance`, `canEditCodeContext` (no write UI exists
at all — `grep -rn 'deleteTask|DeleteTask' --include='*.ts' web/src | grep -v gen/`
returns only `capabilities.ts` declarations); `canDragReorder` (no rank-write UI:
`grep -rni '\brank\b' --include='*.ts' web/src | grep -v 'gen/'` → no matches).

### CENSUS 4 — readers of the `writable` key

    ENUMERATED 2 = FLAGGED 1 + EXCLUDED 1

Instrument: `grep -rn 'writable' --include='*.ts' web/src | grep -v 'gen/'` and
`grep -rn --include='*.go' '"writable"' .`.

TypeScript: `web/src/capabilities.ts:115` and
`web/src/components/ft-app.ts:257-258`. FLAGGED: `ft-app.ts` (Finding 1).
Go: exactly one hit, `internal/server/export_import.go:312`, which is inside a
comment. **The negative "nothing in Go reads this key" therefore holds**, with
the bound that the grep also matches comments and I disposed of the single hit
by eye.

### CENSUS 5 — store-layer writers of collection `remote_data`

    ENUMERATED 3 = FLAGGED 1 + EXCLUDED 2

Instrument: `grep -rn 'SetRemoteData|SetNillableRemoteData' --include='*.go' . | grep -v '/ent/'`,
then filtering the six hits to the three on the collection entity
(`entstore.go:1366` create, `:1399` update, `:2117` import); the other three
(`:408`, `:898`, `:2190`) are task writes.

FLAGGED: `EntStore.UpdateCollection` (`entstore.go:1385-1399`), which the round's
producer census does not list and which is the only path with **merge**
semantics. Finding 7.
EXCLUDED: create and import, both named in the round's census.

Separately, `grep -rn '&ent\.Collection{' --include='*.go' . | grep -v '_test.go' | grep -v '/store/ent/'`
returns exactly one hit, `internal/platform/github/passthrough.go:646` — the
round's `syntheticCollection` claim is complete on that axis.

### CENSUS 6 — producers of `remote_data` KEYS (falsifier evidence for §4 axis 2)

    ENUMERATED 5 = FLAGGED 0 + EXCLUDED 5

Instrument: every in-tree site that constructs a `remote_data` map —
`internal/platform/github/graphql_queries.go:476` (`issueBuildRemoteData`),
`internal/platform/github/github.go:257`, `internal/platform/beads/beads.go:383`,
`internal/server/server.go:660-669` (`UpdateTask`, keys `remote_id`/`remote_url`),
and the JSON decode of an uploaded document
(`internal/server/export_import.go:295`, `beads_import.go:75`).

All four Go builders use **string-literal keys only** — read line by line, no
key is derived from a remote value. The fifth (upload) does produce
attacker-authored keys, but a map decoded by `encoding/json` is always
`structpb`-representable (values are `nil|bool|float64|string|[]any|map[string]any`;
`grep -rn 'UseNumber' --include='*.go' .` → matches only in comments) and its
keys are always valid UTF-8 (Go's decoder coerces invalid bytes to U+FFFD), so
such a map never reaches the drop log at all. FLAGGED 0 — and that zero is the
finding, see Finding 5b.

---

## 2. PRE-REGISTERED FALSIFIER

Written before Findings 1 and 2 were drafted, and then hunted:

> **Falsifier.** If every browser write path that becomes reachable when
> `isReadOnly === false` is *also* gated by a `CollectionCapabilities` flag —
> because `getCapabilities` is the only source of those flags and it does require
> `platform === GITHUB` — then the round's invariant is complete, the second
> reader of the key is harmless, and Findings 1 and 2 both collapse.

I looked for it in three places, and it did not survive:

- `web/src/components/ft-app.ts:452-462` renders `ft-dependency-view` with
  `?readOnly=${this.isReadOnly}` and **no** `.capabilities` binding; the file
  contains no reference to `capabilities` at all.
- `ft-app.ts:1117` `onDependencyDrop` and `:1092` `onRelationshipAdd` are gated
  by `if (this.isReadOnly) return;` and nothing else.
- `web/src/components/inspector/ft-inspector-relationships.ts:131,145,224` gate
  add/remove on `this.readOnly` alone; `ft-inspector.ts:226-230` passes it
  `?readOnly` without `.capabilities`.
- The generic-loop escape hatch does not exist (Census 3 instrument, no matches).

So the falsifier failed and the findings stand. Where it *did* bite: I initially
suspected that `.capabilities` was passed to children that never read it, which
would have been a much larger finding. That was wrong —
`grep -rn 'capabilities' --include='*.ts' web/src` (recursing into
`components/kanban`, `components/inspector`, `components/tree`, which my first
top-level-only glob missed) shows the pattern
`this.readOnly || this.capabilities?.canX === false` in five components. My first
glob was the bounded instrument the COMMON brief warns about; the second one
decided the question.

---

## 3. FINDINGS FROM THE COLD PASS

### Finding 1 — [MEDIUM] The stated invariant is not the predicate that governs the second reader

**Pass:** cold. **Location:** `web/src/components/ft-app.ts:226-262`, against the
invariant written at `internal/server/convert.go:819-836`.

The round writes the load-bearing sentence as:

> The GitHub capability set is reachable only by a collection object that carries
> platform GITHUB *and* a remote_data map containing writable=true, TOGETHER, IN
> ONE OBJECT. […] That conjunction failing is the entire gate.

That is accurate for `getCapabilities`. It is **not** accurate for the other
reader, which the same comment names one line later as "ft-app.ts
isCollectionWritable branches on the same key". Same key, weaker predicate:

```ts
private get isReadOnly(): boolean {
  if (!this.currentCollection) return false;
  if (this.currentCollection.platform === Platform.FARMTABLE) return false;
  return !this.isCollectionWritable(this.currentCollection);   // no GITHUB check
}
```

`isCollectionWritable` tests only `rd.writable === true`. The effective predicate
on this path is `platform !== FARMTABLE ∧ writable === true`, over six platform
values (`Platform` enum: UNSPECIFIED, FARMTABLE, GITHUB, LINEAR, JIRA, ASANA,
BEADS — `web/src/gen/types.ts:4-12`).

**Impact.** The set of arming edits is larger than the three the comment
enumerates, and the extra members are *more* ordinary than the ones listed. The
comment ranks "support importing a GitHub collection export" as arming edit #1.
But **any** non-farmtable platform arms `isReadOnly` — "support importing a
Linear/Jira/Beads export" does it too, and a Beads import path *already exists*
(`export_import.go:274-292`), reaches the same `importParams` struct, and does
**not** pass through the `doc.Collection.Platform` check at all (that check lives
only in the `case "farmtable":` arm). Today it is still inert, because
`export_import.go:361` hardcodes `PlatformFarmtable` for both arms and because
the beads converter never populates collection `remote_data`
(`grep -n 'RemoteData' internal/server/beads_import.go` → no matches). But a
reader who arms the beads path by taking the platform from the document will
have satisfied himself against a comment that told him GITHUB was required.

**Exactly what makes it live, as an edit somebody might plausibly make:** change
`export_import.go:361` from the hardcoded `collection.PlatformFarmtable` to a
platform read from the uploaded document, for *any* platform value, and relax or
extend the `:335` check accordingly. One line. `getCapabilities` still returns
`ALL_DISABLED` for LINEAR/JIRA/ASANA/BEADS, so the capability half of the gate
looks untouched and green — while `isReadOnly` flips to `false` and the write
paths in Finding 2 open.

**Bound.** Browser-side only; the server enforces nothing either way (Census 4),
so this changes what the UI offers, not what the API permits. I did not run the
web suite.

**Recommendation.** Make the second reader carry the same conjunct, and say so in
the invariant:

```ts
private isCollectionWritable(coll: Collection): boolean {
  // The conjunct is part of the gate, not a formality: see the
  // WRITE-AUTHORIZATION GATE block in internal/server/convert.go.
  if (coll.platform !== Platform.GITHUB) return false;
  const rd = coll.remoteData;
  return !!rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true;
}
```

and amend the invariant sentence in `convert.go` to quantify over *both* readers,
or to say explicitly that `isCollectionWritable` uses a weaker one.

### Finding 2 — [MEDIUM, latent] `canEditRelationships` is declared, advertised, and unenforced

**Pass:** cold. **Location:** `web/src/capabilities.ts:53` and `:84`; write paths
at `ft-app.ts:1092`, `ft-app.ts:1117`,
`web/src/components/inspector/ft-inspector-relationships.ts:131,145,224`.

`GITHUB_CAPABILITIES.canEditRelationships = false`, with the tooltip "GitHub only
supports parent-child, not blocks/blocked-by". Census 3: the identifier has
**zero** occurrences anywhere in `web/src` outside `capabilities.ts`. Meanwhile
both relationship write paths are gated by `isReadOnly` alone, and `isReadOnly`
is `false` in exactly the state the capability set exists to describe (a writable
GitHub collection).

**Impact.** The round's document says arming the gate grants "nine write
operations". In the armed state the browser actually offers ten: the nine, plus
relationship add/remove and dependency drag-drop, which the same constant
declares impossible on GitHub and for which the UI shows a tooltip saying so.
For a *persisted* github-platform collection (creatable today via the
`CreateCollection` RPC with caller-chosen platform, `server.go:1043-1046`) those
writes are ordinary database writes that succeed.

**Exactly what makes it live:** any of the three arming edits the round already
names, or the one in Finding 1. It needs no additional edit of its own — the gap
is already in the tree and is currently masked only by the unreachability of the
armed state.

**Bound.** Static reading of the TS sources at `e4e3d13`; no build, no browser,
no suite run. I did not check `web/dist`, which is not in this checkout.

**Recommendation.** Either plumb `.capabilities` into `ft-dependency-view` and
`ft-inspector-relationships` and gate on
`this.readOnly || this.capabilities?.canEditRelationships === false` (the pattern
already used five times elsewhere), or add the two missing checks in `ft-app.ts`:

```ts
private async onDependencyDrop(e: CustomEvent) {
  if (this.isReadOnly || this.capabilities?.canEditRelationships === false) return;
```

Whichever is chosen, the "nine write operations" sentence in `convert.go:837`
should name the enforced set rather than the declared one.

### Finding 3 — [MEDIUM] Five of the round's 27 new line citations do not resolve, and all five are the cross-references between the two conjuncts

**Pass:** cold. **Location:** `export_import.go:309,314,323,331` and
`convert.go:782,790,872,877`; `capabilities.ts:95`.

| Citation | Prose says it is | Actually at `e4e3d13` | Truth |
|---|---|---|---|
| `export_import.go:306` (×4) | the `doc.Collection.Platform` check | line 335 | 306 = `// SECURITY CONTROL, CONJUNCT A OF TWO…` |
| `export_import.go:331` (×3) | `Platform: collection.PlatformFarmtable` | line 361 | 331 = a comment line |
| `export_import.go:332` (×2) | `RemoteData: sanitizeRemoteData(...)` | line 367 | 332 = a comment line |
| `export_import.go:412` | "reaches the store at :412" | line 447 | 412 = `if err != nil {` |
| `web/src/capabilities.ts:94` | the FARMTABLE early return | line 110 | 94 = the new comment's first line |

Cause is mechanical and worth stating because it will recur: the citations were
written against the pre-insertion file, and the comment blocks themselves
displaced everything below them by 29–35 lines. The other 22 citations — all of
which point at files this diff did not touch — are correct, including the range
`entstore.go:2112-2118` and the four `passthrough.go` line cites.

**Why this is rated MEDIUM rather than cosmetic.** Two of the five resolve to
*plausible-looking* text: a reader who follows "see `export_import.go:306`" from
`capabilities.ts` lands on the line reading `SECURITY CONTROL, CONJUNCT A OF TWO`
and will reasonably conclude he has arrived. That is the identical failure mode
this round documents at `convert.go:756-757` ("Both line numbers RESOLVE, to
plausible-looking `SetRemoteData` calls, so a reader who responsibly went and
checked came back with false confidence"). And the `export_import.go` block that
carries three of the five says, in its own text, *"Cited by name, not line: this
round spent most of itself on citations that resolved to the wrong thing."*
The remedy was written down and then not applied in the same paragraph.

**Recommendation.** Replace all five with identifier-relative references
("the `doc.Collection.Platform` check above", "the FARMTABLE early return in
`getCapabilities`"). Line numbers in a comment that lives in the file it cites
are a self-invalidating construct; the round has now demonstrated that twice.

### Finding 4 — [LOW] A browser-only check is labelled "SECURITY CONTROL" in the two files that do not carry the "nothing in Go enforces this" caveat

**Pass:** cold. **Location:** `export_import.go:306-334`, `capabilities.ts:94-109`.

`convert.go:838-843` is exemplary about this: "AND NOTHING IN GO ENFORCES ANY OF
IT… A caller with a token and curl is not subject to this gate at all… the fix is
a server-side check, and this comment is the notice that there is not one."

Neither conjunct file repeats it. `export_import.go` instead says the pair, if
broken, "turns an unvalidated user-supplied map into a privilege grant" — but the
grant is only over UI affordances, for a principal that already holds
`ScopeCollectionWrite` and can call the same RPCs directly. `capabilities.ts`
calls itself "SECURITY CONTROL — CONJUNCT B OF TWO" with no statement that it is
client-side and therefore advisory.

**Impact, and the reason it is a finding rather than a style note:** the risk runs
in the direction of a future reviewer *declining* the server-side check that
`convert.go` asks for, on the grounds that a documented two-conjunct security
control already covers it. Overstating a control's strength is how controls stop
getting built.

**Exactly what makes it live:** the next reviewer of a "make external collections
writable" change reads `capabilities.ts` (the file they are editing) and not
`convert.go` (a file 900 lines into a different language).

**Recommendation.** One sentence in each: "This is a browser-side check. The
server does not enforce read-only collections; anyone with a token can call the
RPCs directly. This gate exists to keep the UI honest, not to stop an attacker."

### Finding 5a — [LOW] The `%q` hardening does not cover the one channel that actually carries the offending key in the branch that reasons about it

**Pass:** cold, then confirmed under axis 2. **Location:** `convert.go:405-412`
and `convert.go:441-458`.

The no-unrepresentable-value branch reasons carefully:

> The keys are not printed here: if one of them is invalid UTF-8, that is exactly
> the byte sequence that should not be pasted into a log line unescaped.

But the same `log.Printf` interpolates `err` with `%v`, and in precisely that
branch `err` **is** `structpb`'s key error — i.e. the offending byte sequence
goes to the log line anyway, via the other verb. The decision not to print the
keys does not achieve what the comment says it achieves.

It is safe **today**, and I checked rather than assumed: `go.mod:22` pins
`google.golang.org/protobuf v1.36.11`; the module cache is absent in this
container so I fetched the tagged source
(`curl -sS https://raw.githubusercontent.com/protocolbuffers/protobuf-go/v1.36.11/types/known/structpb/struct.pb.go`,
HTTP 200) and read all four error sites: line 205 `"invalid UTF-8 in string: %q"`
(the key), 347 `"invalid number format %q, expected a float64: %v"`, 352
`"invalid UTF-8 in string: %q"` (a string value), 371 `"invalid type: %T"`.
Every one is `%q` or `%T`. No raw interpolation reaches the log.

**Exactly what makes it live:** a `protobuf-go` bump in which any of those four
format verbs becomes `%s`/`%v` — nothing in this repo would notice, because
`TestRemoteDataLogQuotesAttackerKeys` (`remotedata_log_test.go:329-357`) asserts
the escaping of the *keys list* only, and
`TestRemoteDataUnrepresentableKeyIsNotAParadox` (`:264-296`) asserts on the word
`KEY` and on the absence of "should not happen", never on the raw bytes. Adding
any second error source into that `%v` does it too.

**Recommendation.** Cheap and total:
`log.Printf(..., field, strconv.Quote(err.Error()), ...)`, plus one assertion in
the existing invalid-UTF-8 test that `\xff\xfe` never appears unescaped in the
captured buffer. Then the guarantee is this repository's rather than upstream's.

### Finding 5b — [INFO] The `%q` justification names a vector no in-tree path realizes

**Pass:** cold. **Location:** `convert.go:429-437`.

> These keys are attacker-authored — they arrive from an uploaded import document
> or a platform API response — and they go straight into `log.Printf`.

Census 6 says otherwise, for both named sources. All four Go `remote_data`
builders use literal keys only. And an uploaded document's keys cannot reach this
function at all: a map decoded by `encoding/json` is always representable and its
keys are always valid UTF-8, so `NewStruct` does not fail on it — which is
argument (2) of the round's own authorization discharge, applied one function
over. The same holds for anything loaded back out of the database, since ent
round-trips the field through JSON.

The change itself is right and I would not undo it (a future carrier — a Go-native
map, a non-JSON transport, a platform client that keys by a remote field — makes
it live immediately, and that is the same class of carrier the round already
documents for the *values*). The defect is that the justification is stated at a
wider scope than its evidence, which is the specific defect class this round was
convened to remove and explicitly names at `convert.go:762-765`.

**Recommendation.** Narrow the sentence: "no in-tree producer keys a
`remote_data` map by a remote value today (four builders, all literal keys); this
is hardening against the first one that does."

### Finding 6 — [LOW] Per-field keying fixes cross-field masking; intra-field masking remains, and the noisy field is the one that stays saturated

**Pass:** cold, inside axis 2. **Location:** `convert.go:385-412`.

The new keying is correct and the reasoning behind it is sound. But the sampler
still names the keys of the **first** drop in each interval and reduces every
later drop to `+N suppressed`. The round's own reachability argument says
`task.remote_data` drops on every task of every page whenever anybody browses a
passthrough collection — so on the task field the first drop in any minute is
almost certainly the benign `labels` one, and an anomalous key arriving during
that minute is counted but never named. The diagnostic value the comment defends
at length ("removing the sample leaves an undiagnosable counter") is, on the task
field, already close to zero for exactly the reason the fix identifies — one level
down.

**Exactly what makes it live:** it is live now, in any deployment with a
passthrough collection in use; it becomes *material* the first time someone tries
to diagnose a task-side carrier change from these logs.

**Bound.** Reasoned from the code and from the round's own rate claim; I did not
run the server or measure real log output.

**Recommendation.** Key the sampler by `field` plus a cheap digest of the sorted
offending-key list, so a *new* key shape always produces a line while a repeating
one stays sampled. Or, minimally, note the limitation where the trade is
described, so the next reader does not over-trust the line.

### Finding 7 — [LOW] The producer census omits the one collection writer with merge semantics

**Pass:** cold. **Location:** `convert.go:846-877` (the census) vs
`internal/store/entstore.go:1385-1399`.

The census lists four bullets and discharges Create, Import and
`syntheticCollection`. `EntStore.UpdateCollection` appears only inside argument
(1) as a *param struct* that nobody populates — it is never listed as a producer,
and its distinguishing property is never stated: it is the only path that
**merges** into the existing map (`old.RemoteData` copied, then `p.RemoteData`
overlaid, `:1392-1398`).

That matters for the ranking of arming edits. Arming edit #2 as written requires
the RPC to populate `CreateCollectionParams.RemoteData` — i.e. control at
*creation* time. The update path is strictly easier: it allows planting a single
key onto a collection that already exists and already has platform GITHUB
(creatable today, `server.go:1043-1046`, platform caller-controlled, `remote_id`
never validated against GitHub), without touching any other key. The two halves
of the conjunction can be supplied by two separate calls at two separate times,
which is not the shape the census's per-producer discharge describes.

**Exactly what makes it live:** adding `remote_data` to `UpdateCollectionRequest`
and copying it at `server.go:1085` — plumbing that is *more* ordinary than the
create-side equivalent, because "let the user edit collection metadata" is a
routine feature request.

**Recommendation.** Add the fifth bullet, and say that the platform half and the
remote_data half need not be supplied by the same call.

### Finding 8 — [INFO] The count the Go comment forbids was reintroduced in the TypeScript half of the same round

**Pass:** cold. **Location:** `web/src/capabilities.ts:106-109`.

`convert.go:840-846` spends a paragraph on this:

> WHY THERE IS NO NUMBER IN THE PARAGRAPH ABOVE, AND PLEASE DO NOT ADD ONE. An
> earlier draft of this comment said "the two producers". A count is a population
> claim with nothing guarding it […] The count is the part that rots.

`capabilities.ts`, added at `6a48b86`, says: "see the WRITE-AUTHORIZATION GATE
block in `collectionToProto` […] for **the two producers** of a GITHUB-platform
collection object and why both currently yield null." The Go count was removed at
`0420f7c` ("B2 rewrite … drop the count"); the TypeScript copy was written one
commit earlier and never revisited. `git log --oneline c108acb..e4e3d13 -- web/src/capabilities.ts`
returns exactly one commit, which is how I found it.

It is also already inaccurate under the census's own unit: the block a reader is
sent to lists four bullets, not two.

**Recommendation.** Delete the number: "…for the producers of a GITHUB-platform
collection object and why each currently yields null."

---

## 4. THE BRIEF'S TWO AXES

### Axis 1 — the authorization argument, audited as a control

- **Is the stated invariant actually invariant?** As written, no — see Finding 1.
  The conjunction is real for `getCapabilities` and I could not break it: platform
  is immutable after creation (`UpdateCollectionParams`, `store.go:157-161`, has
  no `Platform` field), so the obvious composition attack — import a farmtable
  collection with `writable: true` planted, then flip its platform to GITHUB —
  does not exist. `ImportCollection` always creates a fresh row
  (`entstore.go:2112`), so it cannot merge a planted key into an existing GitHub
  collection either. Those two negatives are the strongest part of the round's
  argument and they hold.
- **Is the set of arming edits complete, or merely plausible?** Merely plausible.
  Three named; Findings 1 and 7 add two more, and one of them (any non-farmtable
  import platform, not only GitHub) is at least as likely as the ranked #1.
- **What is enforced in Go, what only in the browser?** Nothing is enforced in Go
  (Census 4: the identifier appears in Go source exactly once, in a comment). The
  round states this correctly and forcefully — in `convert.go`. It does not state
  it in either of the two files a future editor of this control will actually have
  open (Finding 4).
- Argument (2), the type argument discharging Import, checks out: no `UseNumber`
  anywhere, `exportDocument.Collection.RemoteData` is `map[string]any`
  (`export_import.go:39`), and `sanitizeRemoteData` (`urlvalidate.go:250-262`)
  preserves types and keeps every non-URL-bearing key — so `writable` does pass
  through untouched, exactly as claimed. One completeness gap: the argument names
  only the `case "farmtable":` decoder, while a second decoder (the Beads arm,
  `beads_import.go:75`) also feeds the same params struct. Harmless today only
  because that arm never populates collection `remote_data` — which the round does
  not say, because it does not mention the arm.

### Axis 2 — the sampler and the logging path

- **What an attacker controls that reaches it:** the *rate* (any authenticated
  user browsing a passthrough collection saturates `task.remote_data`), and the
  *values* only as `%T`. Not the keys, in any current path (Census 6).
- **What it emits, and where it lands:** `log.Printf` to the standard logger →
  process stderr → the Phase-1 log pipeline. Field name, `structpb`'s error,
  quoted key list with Go types, suppressed count. No credentials, no task
  content, no URLs, no user identifiers. Nothing here needs redaction.
- **Is anything logged that was not before?** Yes: `collection.remote_data` drop
  lines that a task-side drop in the same minute previously swallowed. That is the
  point of the change and it is the right direction — the suppressed line was the
  one bearing on the write-authorization gate. The additional content is bounded
  at two lines per minute (two literal call sites, `convert.go:570` and `:921`,
  both string literals — so the "closed key space" claim guarding the unbounded
  map is verified, and the map cannot grow past two entries).
- Residual issues: Findings 5a, 5b, 6.
- One note on the test seam: `remoteDataLogNow` is read inside the mutex but
  assigned outside it by `withRemoteDataLogClock`. Test-only, `-race`-visible if a
  future test ever runs in parallel with another that logs. Not a finding; noted
  so it is on the record.

---

## 5. WHAT I TRIED THAT DID NOT PRODUCE A FINDING

Stated so the negatives are on the record with their commands (ROOT
`/workspace/farmtable-xss-r7-audit`, rev `e4e3d13`):

- Platform mutation after create: `grep -n 'type UpdateCollectionParams' -A 6 internal/store/store.go`
  — no `Platform` field. Composition attack does not exist.
- A second collection-object literal: `grep -rn '&ent\.Collection{' --include='*.go' . | grep -v '_test.go' | grep -v '/store/ent/'`
  — one hit. The `syntheticCollection` discharge is complete.
- A Go reader of `writable`: `grep -rn --include='*.go' '"writable"' .` — one hit,
  a comment.
- A generic capability-enforcement loop in the web tree: the Census 3 command —
  no matches. (This check's success condition was *no match*; it was not wrapped
  in `|| true`.)
- Attacker-controlled keys in any `remote_data` builder: all four read line by
  line — literals only.
- The doc.go CI claims: `git show cc92735:.github/workflows/ci.yml` — `on: push:
  branches: ['**']` and `pull_request` (lines 14-17), `go test ./... -v` as its
  own step (line 144), `make test` afterwards as a separate self-check (line 185),
  and the web/dist absent-then-produced assertions (lines 102-126). Every claim in
  the rewritten `doc.go` paragraph is accurate, including the `pipefail` rationale
  and the `Dockerfile:9` / `Dockerfile.server:9` / `assets.go:5` citations.
- The six directories `TestWebCensusDescendsIntoShippedSource` requires all exist,
  and `web/tsconfig.json:25` is `"include": ["src"]` as claimed.

---

## 6. POSITIVE OBSERVATIONS

- The `%q` change is the correct fix, in the correct place, with a test that
  asserts the failure mode rather than the output format
  (`TestRemoteDataLogQuotesAttackerKeys` checks both that the raw newline is gone
  *and* that the line count is still 1).
- The per-field sampler fix is a genuine security-relevant defect repair: the
  previous shared limiter let a high-volume, low-value event silence the one line
  bearing on write authorization, and the shared counter hid even the number. It
  fails in the concealing direction, and the new test is written against the
  concealment, not against the mechanism.
- The unbounded-map question is answered in advance and the answer is verifiable
  in one grep. That is the right way to pre-empt a review comment.
- `doc.go` correcting rather than deleting a paragraph that became false —
  including naming the commit where it became false — is a better artefact than a
  clean rewrite, and every fact in it survived checking.
- `TestWebCensusDescendsIntoShippedSource` is the right shape of test: it asserts
  the guard's *reach* separately from the guard's result, because a walk that never
  opens a file cannot fail. It also asserts the prune still prunes, which stops the
  fix from silently disabling the thing it fixed.
- The invariant is stated as a conjunction with the producers listed *below* it
  under a SHA, as an observation rather than a law. That is the correct structure
  and Findings 1 and 7 are about the contents of that list, not about the structure.

---

## 7. VERDICT — APPROVE WITH CONDITIONS

No finding is exploitable at `e4e3d13`. The behavioural change is a net security
improvement, the authorization argument is materially better than what it
replaced, and I found nothing that should stop this merging. The conditions are
documentation and one small code gap; each is independently checkable.

1. **Fix the five broken citations** (Finding 3), preferably by replacing them
   with identifier-relative references. *Checkable:* every `:NNN` in the four
   changed source files resolves to what its prose says.
2. **State the second reader's weaker predicate**, or make it match (Finding 1).
   *Checkable:* `isCollectionWritable` either tests `platform === GITHUB`, or the
   invariant paragraph in `convert.go` says in terms that it does not.
3. **Add one sentence to `export_import.go` and `capabilities.ts`** recording that
   conjunct B is browser-side and that the server enforces nothing (Finding 4).
   *Checkable:* both files contain the caveat.
4. **Delete "the two producers" from `capabilities.ts:108`** (Finding 8).
   *Checkable:* no cardinal number in that sentence.
5. **Raise `canEditRelationships` as a tracked follow-up** (Finding 2) — not
   necessarily fixed in this round, but it must not be closed by this round's
   documentation, which currently implies the flag is effective. *Checkable:* an
   issue exists, or the two call sites gate on the flag.

Findings 5a, 5b, 6 and 7 are recommended, not required.

> **This verdict was written before `_r7-PHASE-TWO.md` was opened.** It is left
> exactly as it stood. Two further findings and two further conditions were added
> after reconciliation; see §8.10, which supersedes the condition list above
> without changing the verdict.

---

## 8. PHASE TWO — RECONCILIATION

Everything above this line was on disk before I opened `_r7-PHASE-TWO.md`. Nothing
above has been edited since, including the two places where reconciliation showed
me to be incomplete. Everything in this section is attributed to the pass that
produced it.

### 8.0 CONTAMINATION DISCLOSURE — read this before scoring this leg

**During the cold pass I ran a grep across `reports/*.md` and two lines of
`review-xss-r7.md` — a concurrent leg's report on this same commit — landed in my
context.** I stopped, did not open that file, and did not open `test-xss-r7.md`.
The two lines were: a census result stating that a word-boundary search for
`writable` over the Go tree returns 9 hits, and one sentence stating a bound on
that census.

What it could have affected: my **Census 4** (readers of the `writable` key). My
instrument was the quoted literal `'"writable"'` and returned 1 hit, a comment.
The two instruments measure different populations — bare identifier including
prose in comments, versus the quoted map key — and they are consistent: the
9 include comment prose, the 1 is the subset that is a quoted key, and neither
contains a functional Go reader. Census 4's conclusion (`writable` has no
functional Go reader) was written before the leak and is unchanged by it. No
other finding of mine touches that population.

**I flag this as a defect in shared-directory layout, not in anybody's conduct.**
Three legs writing current-round reports into one flat directory that every leg
must also read for prior-round artefacts makes leakage a matter of when. A
`reports/r7/` subdirectory per round, or prior-round artefacts under
`reports/archive/`, removes it entirely.

### 8.1 THE FIX LEG'S THREE SELF-REPORTED DEFECTS — verified, one of them fails

PHASE-TWO is right that a self-report is a claim. I checked all three.

---

#### Self-report 1 — "I pre-registered 6 `=== RUN` lines and the run produced 49." — **STATED CAUSE VERIFIED, AND THE LOOP IT LEFT OPEN IS NOW CLOSED**

Its stated cause: it counted `^func TestRemoteData` in the file it was editing
(6) rather than in the package the `-run '^TestRemoteData'` filter selects (13),
and `=== RUN` also counts subtests.

I derived 49 independently and statically, at `e4e3d13`, without running anything:

```
ROOT=/workspace/farmtable-xss-r7-audit  rev=e4e3d13
grep -rn '^func TestRemoteData' --include='*_test.go' internal/server/
grep -n 't\.Run(' internal/server/remotedata_log_test.go \
                 internal/server/remotedata_depth_test.go \
                 internal/server/urlvalidate_differential_test.go
```

| source of `=== RUN` lines | count |
|---|---|
| `^func TestRemoteData` in `remotedata_log_test.go` | 6 |
| `^func TestRemoteData` in `remotedata_depth_test.go` | 4 |
| `^func TestRemoteData` in `urlvalidate_differential_test.go` | 3 |
| subtests: `TestRemoteDataTraversalsTerminateOnACycle` table (`:266-271`) | 2 |
| subtests: `TestRemoteDataWriteSitesSeesEveryShape` table (`:769-848`) | 21 |
| subtests: `TestRemoteDataKeyClassification` table | 6 |
| subtests: `TestRemoteDataLiteralKeysIn` table | 7 |
| **total** | **49** |

`ENUMERATED = FLAGGED + EXCLUDED` → **49 = 49 + 0**: every `=== RUN` line the
filter can emit is accounted for by a named function or a named table, and no
row is discarded. `remotedata_log_test.go` contains **zero** `t.Run` calls, which
is why its six functions contribute exactly six — the fix leg's parenthetical
("there are no `t.Run` subtests") is true *of that file* and was the trap.
"Several are table tests with up to 21 rows" is exact: 21 is the shapes table.

**The stated cause holds, and the arithmetic closes to the observed number.**

**But verifying it exposed something the self-report does not say, and it is the
larger half.** After the correction, the fix leg wrote: *"Corrected expectation
for R7-11 .. R7-14: 49 `=== RUN` lines, derived from the artefact rather than
from a fresh count."* R7-16/R7-17 then reuse the same 49 and the same 3, also
"derived from artefacts earlier in this section rather than from a fresh count."
**So six pre-registrations in this round — R7-11, R7-12, R7-13, R7-14, R7-17 and
the webguard R7-16 — are anchored to one earlier run rather than to an
independent derivation.** A pre-registration whose number comes from a previous
execution of the same command is a *reproducibility* check, not an
*anti-vacuity* check: if R7-10's filter had selected the wrong population, all
six later cells would have agreed with each other and all six would have been
wrong, and the instrument that exists to catch exactly that would have reported
six consecutive matches.

The static derivation above is the independent count that chain was missing. It
agrees. The webguard 3 likewise: `internal/webguard/remotedata_consumers_test.go`
has exactly three `^func Test` and zero `t.Run` at `e4e3d13` → **3 = 3 + 0**.
Both numbers now rest on something other than the artefacts that used them.

*Bound:* I counted source at `e4e3d13`; the runs happened at `6a48b86` and later
from `ROOT=/workspace/farmtable-xss-r6-fix`. If any `_test.go` file in
`internal/server` changed between `6a48b86` and `e4e3d13` the counts could in
principle differ; `git diff --stat 6a48b86 e4e3d13` shows the later commits touch
`convert.go`, `export_import.go`, `webguard/doc.go`, `capabilities.ts` and the
project log only. I executed nothing.

---

#### Self-report 2 — "I wrote a compile-receipt mtime from expectation, twice." — **UNFALSIFIABLE HERE, AND THE NUMBER WAS NEVER LOAD-BEARING**

Both wrong numbers are in the tree and I read them:

- `d025390` message: `Compile receipt: /tmp/r7-b5.a, 07:43:45, one second after the pre-build stamp.` Correction says `ls` showed `07:43:44`.
- `0420f7c` message: `Compile receipt: /tmp/r7-b2.a exists at 07:44:53, pre-build stamp 07:44:52.` Correction says `ls` showed `07:44:52`.

`/tmp/r7-b5.a` and `/tmp/r7-b2.a` live in another container's `/tmp` and do not
exist here. **I therefore cannot verify either the original number or the
correction** — the correction is itself a self-report about an artefact nobody
outside that container can see, and I decline to treat it as verified. What I can
check is internal consistency, and there are two results:

1. **In both corrected readings the artefact mtime equals the pre-build stamp to
   the second.** That is precisely the case in which an mtime comparison cannot
   discriminate — a stale artefact written in the same second is indistinguishable
   from a fresh one. So the mtime was doing no work *before* the correction
   (`one second after` was a false discriminator) and does no work *after* it
   (`same second` is no discriminator at all). **The load-bearing element of that
   receipt design was always the `rm -f` immediately preceding the build plus the
   file's existence afterwards.** That element is unaffected by either wrong
   number.
2. **Which parts of the canary record depend on a number written in advance —
   the honest answer is broader than the fix leg's.** The two receipt lines are
   the *smaller* surface. The larger one is the pre-registration chain in
   self-report 1: five cells and one final confirmation whose "stated in advance"
   numbers were copied from a prior artefact. The fix leg named the receipts and
   changed its order of operations for them; it did not notice that its
   *correction* to defect 1 installed the same epistemic shape — a number
   asserted ahead of a run, sourced from expectation rather than from an
   independent measurement of the population — in the instrument that exists to
   catch that.

**What survives regardless:** compilation of `internal/server` and
`internal/webguard` is established by the targeted runs, not by the receipts. A
`go test` artefact ending on `ok <pkg> 0.0Ns` with 49 `=== RUN` lines cannot be
produced unless the package and its test files compile. That evidence is
independent of both mtimes. The receipts are redundant, and the two wrong numbers
therefore cost nothing but the record's credibility — which, in a round convened
about citations that resolve and are wrong, is the cost that matters.

---

#### Self-report 3 — "I reported the producer count wrongly once and corrected it." — **THE CORRECTION WAS APPLIED IN ONE FILE AND NOT IN ITS COUNTERPART. THIS SELF-REPORT IS FALSE AS STATED.**

`internal/server/convert.go:846-853` does not merely drop the count, it prohibits
it:

> `WHY THERE IS NO NUMBER IN THE PARAGRAPH ABOVE, AND PLEASE DO NOT ADD ONE. An earlier draft of this comment said "the two producers". A count is a population claim with nothing guarding it...`

`web/src/capabilities.ts:107-109`, in the same seven-commit range, says:

> `see the WRITE-AUTHORIZATION GATE block in collectionToProto, in internal/server/convert.go, for the two producers of a GITHUB-platform collection object and why both currently yield null.`

**The forbidden sentence is still in the tree, in the file that cross-references
the block forbidding it, pointing at that very block.** The commit order explains
the mechanism — `6a48b86` (A1+A2) wrote the TypeScript comment, and `0420f7c`
(B2 rewrite) dropped the count two commits later in the Go file only — but the
delivered artefact at `e4e3d13` contains the defect the self-report says was
corrected, and a reader following the pointer arrives at a paragraph that
contradicts the sentence that sent them there.

This is my **Finding 8**, filed independently in the cold pass. What
reconciliation adds is the attribution: it is not a stray count, it is a *failed
correction*, and the self-report asserting otherwise is the only place a reader
would learn it was ever an issue.

*Bound:* `grep -rn 'two producers' --include='*.ts' --include='*.go' .` from
`ROOT=/workspace/farmtable-xss-r7-audit` at `e4e3d13` returns exactly the two
sites quoted above — one prohibiting, one committing. **2 = 1 + 1.**

### 8.2 Finding 9 — [LOW, latent] A THIRD FARMTABLE EARLY RETURN, IN GO, HOLDING A DIFFERENT PLANTED KEY INERT — AND THE ROUND'S "TWO CONJUNCTS" MODEL DOES NOT CONTAIN IT

*Attribution: the site was handed to me by `_r7-PHASE-TWO.md` ("a second Go-side
consumer of collection `remote_data` exists at `graph_support.go:22`. Filed,
routed off this round"). **The implication below is mine and it is not what was
filed.** PHASE-TWO routes it off as a scoping question; it is also a fact about
the correctness of the argument this round shipped.*

```go
// internal/server/graph_support.go:25-38
func collectionSupportsGraph(c *ent.Collection) bool {
	if c.RemoteData != nil {
		if v, ok := c.RemoteData["graph_queries"]; ok {
			if b, isBool := v.(bool); isBool {
				return b
			}
		}
	}
	if def, ok := platformGraphDefaults[c.Platform]; ok {
		return def
	}
	return false
}
```

Its **sole** caller:

```go
// internal/server/graph_routing.go:38-45
if coll.Platform == collection.PlatformFarmtable {
	return coll, graphRouteDirect, nil          // <-- returns BEFORE the read
}
if !collectionSupportsGraph(coll) {
	return nil, graphRouteDirect, status.Errorf(codes.Unimplemented, ...)
}
return coll, graphRouteEphemeral, nil
```

```
ROOT=/workspace/farmtable-xss-r7-audit  rev=e4e3d13
grep -rn 'collectionSupportsGraph' --include='*.go' internal/ | grep -v '_test.go'
  -> graph_support.go:25 (definition), graph_routing.go:42 (one call)
```
**Callers ENUMERATED = 1 = FLAGGED 1 + EXCLUDED 0.**

**Why this matters to the argument, not just to the scope.** The round's model is
"CONJUNCT A OF TWO" (Go: import forces farmtable) and "CONJUNCT B OF TWO" (TS:
farmtable returns before the `remote_data` read). Both comments generalise from
`writable` to *the planted key*: `capabilities.ts:101-103` says "a caller with
admin scope can plant `writable: true`... this early return means the FARMTABLE
path never consults the planted key." **`graph_queries` is a planted key on an
imported collection that IS consulted in Go — and it is inert only because
`graph_routing.go:38` is a third farmtable early return that no comment in this
round mentions and no test in this round pins.** The universal ("a planted key on
a farmtable collection is never consulted") is true at `e4e3d13` only by an
accident the round does not name, in a file the round never opened.

**The arming edit, named as something somebody would plausibly do:** *"let
farmtable collections opt out of graph queries too"* — delete or narrow the
farmtable early return at `graph_routing.go:38-40` so every platform goes through
`collectionSupportsGraph`. That is a natural feature request (large farmtable
collections where critical-path analysis is expensive) and it is one `if` block.
At that moment an uploaded document's `remote_data` becomes the input to the
routing decision for a **persisted** collection:

- `{"graph_queries": false}` → every graph query on that collection returns
  `Unimplemented`. A `ScopeCollectionAdmin` import silently disables a feature.
  Availability, low.
- `{"graph_queries": true}` on a farmtable collection → `graphRouteEphemeral`,
  which builds an in-memory SQLite mirror (`graph_routing.go:80-92`) and answers
  from a **copy** rather than from the persisted store. Correctness/consistency,
  and it is the branch a reviewer would least expect a farmtable collection to
  take.

Neither is privilege escalation, hence LOW. The finding is not the severity, it
is that **the round's own reachability universal is one conjunct short and the
missing conjunct is in Go, where the comment says nothing enforces anything.**

**Recommendation.** One sentence in the `WRITE-AUTHORIZATION GATE` block:
*"`writable` is not the only plantable key. `graph_queries` is read in Go by
`collectionSupportsGraph` and is inert only because `resolveGraphRoute` returns
early for farmtable. Any statement here about `the planted key` is a statement
about `writable`."* And a note at `graph_routing.go:38` that the early return is
load-bearing for an unvalidated map.

### 8.3 Finding 10 — [INFO] `doc.go` SAYS "TWO LIMITS", THERE ARE AT LEAST THREE, AND THE THIRD IS THE ONE THE BRIEF EXPLICITLY ASKED TO BE ACTED ON OR LOGGED

*Attribution: the underlying limit is `review-xss-r6` PO-7, which I did not find
independently. That it survives at `e4e3d13`, that it is inside a cardinal-number
population claim, and that the brief's instruction about it went unanswered — all
three are from this pass.*

`internal/webguard/doc.go:52` opens **"TWO LIMITS ON THE CENSUS, stated here
because the guard's whole correctness argument is that it over-approximates."**
The two are the line-census unit (`:56`) and the invisibility of `web/dist`
(`:63`). Both are new this round, both are correct, and both were asked for.

The same file, unchanged at `:43-45`, still says the guard exists because *"the
reader it most needs to stop is a Go developer changing the server-side shape of
`remote_data`."* The census reads `web/` only. A Go developer who adds a key to
the payload — in `issueBuildRemoteData`, or in `sanitizeRemoteData` — changes
nothing under `web/` and the guard stays green. It fires for that developer only
if they change the `.proto` and regenerate `web/src/gen/*`. **So the guard covers
proto-shape changes and not payload-shape changes, and the payload is where the
attacker-authored bytes are.** That is a third limit of exactly the kind the
block enumerates, in a block that states its count.

Compounding, and still true: the producer-side pin
`internal/platform/github/remotedata_representability_test.go` has two test
functions and **zero** occurrences of `Collection` or `writable`
(`grep -c 'Collection\|writable'` → `0`, `ROOT=/workspace/farmtable-xss-r7-audit`,
`e4e3d13`). The consumer guard cannot see a producer change; the producer test
does not cover collections. The collection capability gate is pinned at neither
end.

**This is the second cardinal number in this round's comments guarding a
population claim, and unlike "the two producers" it is demonstrably an
undercount.** The instruction the round wrote for itself — *a count is the part
that rots* — applies to its own limits block, and the rot is already visible in
the delivered artefact.

**Recommendation.** Delete the word "TWO", add the payload-shape limit, and state
the producer-test gap beside it.

### 8.4 GAP BETWEEN `dev-xss-r7-fix.md` + AMENDMENT 1 AND WHAT WAS DELIVERED

Instructions **ENUMERATED = 14** (B1–B5, A2, three A3 items, three NON-BLOCKING
items, the canary requirement, the HELD question). **DELIVERED-AS-ASKED = 13.
GAP = 1.** 14 = 13 + 1.

| item | asked | at `e4e3d13` |
|---|---|---|
| B1 reachability comment | rewrite | done (`convert.go:815-905`) |
| B2 `syntheticCollection` | restore the dropped path | done, enumerated at `:870` with `passthrough.go:645` and its three return sites |
| B3 `doc.go` CI claim | false on merge target | done (`6f967c7`), now cites `cc92735` |
| B4 `skipDirs` basename prune | anchor to top level | done, plus `TestWebCensusDescendsIntoShippedSource` — **more than was asked; the descent assertion was not in the brief** |
| B5 sampler | key by field | done |
| A2 annotate both conjuncts | comment naming the other | done, both sides |
| A3 doc overstates population | say so in the limits block | done (`doc.go:63`) |
| A3 "line census" | name the unit | done (`doc.go:56`) |
| A3 `withRemoteDataLogClock` | register its own restore | done (`remotedata_log_test.go:71-78`), with the rationale |
| A3 import asymmetry (INFO) | act or log | logged (project log `:249-255`) — compliant |
| NB `%s` → `%q` | do it | done |
| NB "should not happen" branch | fix the message, test welcome | done + `TestRemoteDataUnrepresentableKeyIsNotAParadox` |
| NB **proto-shape vs payload-shape; producer test has zero collection coverage — "Note in the log if you do not act"** | act **or** log | **NEITHER.** `grep -in 'payload\|proto-shape\|representability\|producer test\|zero collection'` over `.design/project-log/2026-07-29-dev-xss-r7-fix.md` returns one hit, at `:253`, and it is the word "payload" inside the *import-asymmetry* entry. **GAP.** |
| canary requirement | every guard observed firing | done, and the R7-04 and R7-11 pass/pass discriminators are the strongest evidence in the round |

**And the project log asserts completeness over the gap.** Line 8:
*"Verdict: `FIXED` — all five blocking findings resolved, both amendment items
done, all non-blocking items done."* Two of three non-blocking items were done;
the third was neither done nor logged, and it is the one whose omission produced
Finding 10. A summary line claiming a population it did not enumerate is the
round's own defect class, in the round's own verdict line.

*Bound:* I judged delivery by reading the tree at `e4e3d13`, not by executing
anything. "Done" above means the artefact exists and says what was asked; it does
not mean it is correct — Findings 1, 3, 4 and 8 are all about items in the
"done" column.

### 8.5 RECONCILIATION WITH `audit-xss-r6.md` (my own leg's prior round)

| r6 | disposition |
|---|---|
| **F1** planted keys inert only by an unwritten conjunction | **Addressed by the round; I re-audited the fix rather than the finding.** The conjunction is now written down in both files. My Findings 1, 3, 4, 9 are all about *the wording of the fix for F1*, which is the correct posture: r6 asked for the argument, r7 supplied it, and an in-tree argument is a control. |
| **F2** the reachability comment omits the live writer | **Addressed.** `syntheticCollection` is enumerated at `convert.go:870`. Verified the three return sites (`passthrough.go:630/638/642`) and the constructor (`:645`) all resolve. |
| **F3** the web-only census misses Go-side consumers | **Addressed as a bound, not as a fix — and my Finding 9 is the sharp edge of it.** `doc.go` now states its limits, but "Go-side consumers exist" turned out to include one that reads a *different* attacker-plantable key. r6's F3 was more right than r6 knew. |
| **F4** unquoted attacker keys in the log line | **Addressed (`%q`), and I disagree with the round's framing rather than the fix.** See Findings 5a/5b: the `%q` is correct, the threat model given for it is unreachable by any in-tree path, and the residual channel — `err` interpolated with `%v` on the same line — was not closed and is not tested. r6's own bound (in-tree adapter keys are static literals) already said the vector was closed; the round shipped the fix with a wider justification than its own prior evidence supports. |
| **F5** merge blocker (`ci-suite-manifest.mjs`) | **Not mine this round.** PHASE-TWO states it is routed to a leg on real `main`. I did not re-execute it. |
| **F6** import URL-drop asymmetry | **Logged, not fixed, per the brief.** Compliant. I agree with the deferral: both paths fail closed. |
| **R1** platform-relink escalation | **Refuted again, independently, before I read r6.** `UpdateCollectionParams` has no `Platform` field and `ImportCollection` always creates a fresh row, so platform is immutable after creation. Two legs, two rounds, same negative. |

### 8.6 RECONCILIATION WITH `review-xss-r6.md`

| r6 | disposition |
|---|---|
| **PO-1** argument discharges two of three writers | Addressed by the round. **I found the *successor* defect independently:** the enumeration is now complete for creators but omits `UpdateCollection`'s merge semantics — my **Finding 7**. PO-1 named the writer; nobody named what makes it different, which is that it is the only one that can add a key to a row it did not create. |
| **PO-2** `syntheticCollection` dropped | Addressed; see F2 above. |
| **PO-3** `doc.go` CI rationale stale | Addressed (`6f967c7`). |
| **PO-4** population excludes shipped bytes | Addressed (`doc.go:63`). |
| **PO-5** "occurrence census" is a line census | Addressed (`doc.go:56`). |
| **PO-6** helper ordering contract | Addressed, and well — the helper now registers its own restore *and* explains why (`remotedata_log_test.go:58-70`). |
| **PO-7** the guard does not fire for the change `doc.go` says it exists to catch | **MISSED IN MY COLD PASS. NOT ADDRESSED BY THE ROUND. Now my Finding 10**, upgraded by the fact that the unaddressed limit sits outside a comment that states there are two. |
| **PO-8** every GitHub passthrough task's `remote_data` is dropped today | **Confirmed independently in my cold pass** as the reason the task-side sampler is saturated — my **Finding 6** (intra-field masking) rests on it. I did not re-derive the `[]string`/`structpb` mechanism; I took the r6 verification and the round's own comment. |

### 8.7 RECONCILIATION WITH `test-xss-r6.md`

| r6 | disposition |
|---|---|
| **F1** `skipDirs` basename prune | Addressed (B4), and the fix is better than the ask: the anchoring rationale is written into the source at `remotedata_consumers_test.go:95-108` with the falsifying plants named. **This is the best work in the round.** |
| **F2** global sampler | Addressed (B5). My **Finding 6** is the residue: cross-field masking is fixed, intra-field masking is not, and the field that stays saturated is the one PO-8 explains. |
| **F3** merge blocker | Routed off; not re-executed here. |
| **F4** `.tmp-test` | Addressed, and the *reason* it is skipped is now distinguished in the source from the build-output reason (`:110-118`), including the non-idempotency prediction. Good. |
| **F5** "should not happen" branch reachable | Addressed, with a test. **I disagree with nothing here and want to record that the r7 canary (R7-13) is the right shape:** the artefact shows structpb's real error printed beside a message telling the operator the state is impossible. |
| **F6** `doc.go` stale executor claim | Addressed (`6f967c7`). |
| **F7** `EXPECTED_ASSERTIONS` | Out of scope, untouched, not mine. |

**Where I disagree with a prior leg, stated plainly, since PHASE-TWO asks for
disagreement rather than consensus:** `test-xss-r6` F2's remedy — "key the sampler
state by `field`" — was adopted verbatim and it is correct, but it was adopted
*as if it closed the masking problem*. It closes the cross-field case only. The
one drop the whole gate cares about (`collection.remote_data`) is now visible past
`task.remote_data` traffic, and remains invisible past *its own* prior drop inside
the interval, with only a suppressed-count as a signal. Naming the fix by the
mechanism it repairs (`per-field`) made the remaining case hard to see, in both
the r6 report and the r7 fix. That is the same "partial cause stops the search"
failure `_r7-COMMON.md` §"PRE-REGISTER YOUR OWN FALSIFIER" describes, and it
happened across two rounds and three legs.

### 8.8 THE `.gitignore:17` ITEM — CONFIRMED WITH THE INSTRUMENT PHASE-TWO SPECIFIES, INCLUDING CONTROLS

PHASE-TWO invites a check and warns that the obvious command lies. It is right.

```
ROOT=/workspace/farmtable-xss-r7-audit  rev=e4e3d13
sed -n '17p' .gitignore                                  -> dist/
ls -d web/dist                                           -> No such file or directory
for p in web/dist web/dist/index.html web/src/util/dist/x.ts \
         notdist/x distant/x internal/store/ent/build/x.go; do
    git check-ignore -v "$p" || echo "NOT IGNORED"; done
```

| path | result |
|---|---|
| `web/dist` (the directory itself) | **NOT IGNORED** — the trap, exactly as described |
| `web/dist/index.html` (inside form) | IGNORED, `.gitignore:17:dist/` |
| `web/src/util/dist/x.ts` (nested, arbitrary depth) | IGNORED, `.gitignore:17:dist/` |
| `notdist/x` (control) | NOT IGNORED |
| `distant/x` (control) | NOT IGNORED |
| `internal/store/ent/build/x.go` (control for the fix leg's `build` warning) | NOT IGNORED |

**CONFIRMED, not refuted.** Both negative controls come back clean, so the
pattern is not over-matching, and the nested positive proves the depth behaviour.
`web/dist` is absent from this clone, which is precisely the condition that makes
the directory-form query reassuring and wrong.

One consequence worth adding to the routed item, since it is security-adjacent:
after B4 the census walks the **filesystem** and no longer prunes nested `dist`,
so a consumer at `web/src/util/dist/deep.ts` is now *censused* while remaining
invisible to `git status` and `git add -A`. The two instruments now disagree about
the same file in opposite directions. That is fail-closed for accidental commits
and fail-open for review of a force-added one, and it means **the guard's
population and the reviewer's population are no longer the same set** — which is
the exact framing that made B4 a finding in the first place.

### 8.9 WHAT RECONCILIATION CHANGED ABOUT MY OWN PASS — measured, not narrated

- **My cold pass asked the wrong question, and I can name it.** I asked *"who
  reads `writable`?"* and built Census 4 around that identifier. The question that
  would have found `graph_support.go` is *"who reads **any** key out of collection
  `remote_data`?"* — one level more general, same cost. Census 4 closes its own
  arithmetic perfectly and is blind to the member that decides the more
  interesting question. **This is `_r7-COMMON.md`'s "A CENSUS IS AS BOUNDED AS ITS
  MOST BOUNDED INSTRUMENT", and the bounded instrument was my choice of noun.**
- **Findings the cold pass produced: 8. Findings PHASE-TWO produced: 2 (9, 10),
  one from a pointer and one from a prior leg's unaddressed FYI. Findings the two
  briefed axes produced on their own: 1 (5a).** 10 = 8 + 2. The unscoped pass
  remains the yield, which is what the role brief predicted; but both
  reconciliation findings are ones no amount of further unscoped reading by me was
  going to produce, because both required a *different* population, not more
  effort on mine.
- **Nothing in the prior artefacts contradicted a cold-pass finding of mine.** No
  retractions.

### 8.10 VERDICT AFTER RECONCILIATION — **APPROVE WITH CONDITIONS** (unchanged)

Findings 9 and 10 are LOW and INFO. Neither is exploitable at `e4e3d13`; both are
about the accuracy of arguments the round put in the tree, which is the same class
as Findings 1, 3, 4 and 8 and the same reason this is not an APPROVE. Two
conditions are added to the five in §7:

6. **Name `graph_queries` and the third early return** (Finding 9). *Checkable:*
   `convert.go`'s gate block distinguishes "the planted key" from "`writable`", and
   `graph_routing.go:38` carries a note that its early return is load-bearing.
7. **Answer the non-blocking item that went unanswered** (§8.4, Finding 10):
   either add the payload-shape limit to `doc.go` — deleting the word "TWO" — or
   record in the project log that it was declined, which is what the fix brief
   asked for. *Checkable:* the word "TWO" is gone from `doc.go:52` and a third
   limit is listed, **or** the project log names the item.

Additionally, and not as a condition: **the project log's line 8 should not say
"all non-blocking items done."** It is the round's own summary and it overstates a
population by one. Correcting it costs a word and preserves the only thing that
makes a self-report worth reading.

---

## 9. WHAT I DID NOT CHECK

- **I ran no tests and no build.** I hold no build token, and it would not have
  helped: this container has no populated Go module cache
  (`ls $(go env GOMODCACHE)/google.golang.org` → absent), so even the permitted
  single targeted `go test -run` would have had to download the dependency graph.
  I therefore did **not** verify that `e4e3d13` compiles, that the new
  `internal/webguard` tests pass, that `TestWebCensusDescendsIntoShippedSource`
  is green, or that the four new tests in `remotedata_log_test.go` actually pass.
  Every claim I make about test behaviour is from reading the test source. I did
  not append to `_run-queue-log.md` because I ran nothing.
- **The web suite, and any browser behaviour.** Findings 1 and 2 are static
  reasoning over Lit templates. I did not confirm that the relationship
  affordances actually render in the armed state — only that nothing in the code
  path prevents them.
- **`web/dist`.** Not present in this checkout; the shipped bytes are outside
  everything I looked at, which is the same gap `doc.go` names.
- **The project log** (`.design/project-log/2026-07-29-dev-xss-r7-fix.md`, 306
  lines). I read it for orientation but did not audit its claims as a control,
  because it is not code and nothing branches on it. If a later leg is relying on
  it as a record of what was checked, it has not been checked by me.
- **The five test files changed only between `d305391` and `c108acb`** — outside
  this round's diff and outside my scope.
- **Out-of-tree writers of collection `remote_data`** — direct database access,
  migrations, restores, or any operator tooling. Same bound the round declares for
  itself; I did not widen it.
- **`multistore` routing.** I confirmed the collection methods delegate to
  `primary` (`multistore.go:377-387`) but did not trace which store serves a
  persisted github-platform row versus a passthrough one. If that routing can hand
  the dashboard a *persisted* GitHub collection object under some configuration,
  the reachability picture in Finding 2 gets slightly worse; I did not establish
  either way.
- **`gRPC`/auth layer, TLS, timeouts, dependency CVEs.** Nothing in this diff
  touches them and I did not audit them this round. I did read `go.mod` only far
  enough to pin the `protobuf` version.

**Added after PHASE TWO:**

- **The two concurrent r7 leg reports.** `review-xss-r7.md` and `test-xss-r7.md`
  were not read; see the contamination disclosure at §8.0 for the two lines that
  reached me anyway and why they change nothing.
- **The fix leg's build and test artefacts.** `/tmp/r7-*.txt`, `/tmp/r7-b5.a` and
  `/tmp/r7-b2.a` live in another container. Every statement in §8.1 about what
  those artefacts contain is taken from the fix leg's transcription of them into
  `_run-queue-log.md`. **The `49` and the `3` I verified statically from source;
  the `--- FAIL` counts, the arm attributions and the two mtimes I did not and
  cannot verify from here.** If the canary record matters to the merge decision,
  somebody with the artefacts should confirm that R7-11's failure count is 1 and
  that the failing test is the named one — that single row carries the round's
  central claim (that the old suite was blind rather than quiet).
- **The ephemeral graph path.** Finding 9 names `graphRouteEphemeral` and reads
  `loadEphemeralStore`'s collection mirror at `graph_routing.go:80-92`, but I did
  not trace what a graph query actually returns from the mirror, so my
  "answers from a copy" characterisation is a reading of the construction, not of
  the results.
- **Whether anything else in the tree reads a key out of collection
  `remote_data`.** I found `graph_support.go` only because PHASE-TWO pointed at
  it. I did not then run the general census that would close the population —
  "every subscript or range over `.RemoteData` on a collection value in Go" — and
  I am not claiming `graph_queries` is the last one. **This is the largest open
  set in the report** and it is the one I would run first with more time.
- **`beads_import.go:393` and `graph_routing.go:85`**, the two other hardcoded-
  farmtable sites the gate comment lists. I confirmed they exist and are
  hardcoded; I did not audit what either does with `remote_data` afterwards.

---

## 10. WHERE THIS BRIEF WAS WRONG

Three things from the cold pass, in ascending order of how much they cost, then
three added after reconciliation.

1. **The role brief's scope line under-describes the diff.** It says "mostly
   comments and tests, one behavioural change in how a drop-log sampler is keyed."
   The `%q` change in `unrepresentableKeys` (`d025390`) is a *second* behavioural
   change, and it is the more directly security-relevant of the two — it changes
   what bytes reach a log pipeline. Reading the brief first, I nearly filed it
   under "comments". A brief that counts the behavioural changes is making a
   population claim, and this one is off by one.

2. **`_r7-COMMON.md` §"THE OBJECT UNDER REVIEW" tells every leg to cite by SHA,
   and this round's central finding is that citing by *line* is what failed.** The
   two rules are adjacent in spirit and the brief only gives one of them. A line
   number inside the file it cites is invalidated by the act of writing the
   citation — the fix leg hit this five times in one commit and the brief, which
   otherwise warns about exactly this genre of decay, does not name it. Suggested
   addition: *a citation into a file your own patch shifts is stale before you
   commit it; cite identifiers, not lines.*

3. **The strongest instruction in the COMMON brief is also the one it undercuts.**
   "A CENSUS IS AS BOUNDED AS ITS MOST BOUNDED INSTRUMENT" is exactly right, and it
   caught a real error of mine (the top-level-only glob in §2 that made me briefly
   believe the whole capability system was inert). But the brief asks for
   `ENUMERATED = FLAGGED + EXCLUDED` on "every count", and for several of my
   populations the natural partition is three-way — enumerated, flagged,
   *verified-correct*, plus a fourth set that is out of the instrument's reach
   entirely. I forced each census into the two-way split and defined the terms per
   census, which works, but the definitions are doing load-bearing work that the
   integers then hide. The rule as stated would accept a census whose EXCLUDED set
   is "everything my grep could not see", which is the very failure it exists to
   prevent. Suggested repair: require the *instrument's blind set* as a fourth
   named quantity, even when it is asserted to be empty.

**Added after PHASE TWO — and item 4 is the one I would most like read.**

4. **The stale line citations did not originate with the fix leg. They came from
   `dev-xss-r7-fix.md` AMENDMENT 1 §A2, and the mechanism is now provable with
   two SHAs.** The amendment says: *"Conjunct A — `export_import.go:305` rejects
   any non-`farmtable` document and `:331` hardcodes `Platform:`"* and cites
   `:332` for the `remote_data` copy. At `c108acb` those numbers were **right**:

   ```
   git show c108acb:internal/server/export_import.go | grep -n 'doc.Collection.Platform != string'
     -> 306:		if doc.Collection.Platform != string(collection.PlatformFarmtable) {
   ```

   The fix leg was told to *annotate that line*. Its annotation is a 29-line
   comment inserted immediately above it, which moved the line it cites from
   `306` to `335` — **in the same commit, by the act of writing the citation.**
   `:331`→`361` and `:332`→`367` the same way, and `capabilities.ts` and
   `convert.go` then copied the pre-shift numbers across file boundaries.

   So my Finding 3 lands on the fix leg's artefact but the numbers are the EM's,
   and the failure is structural rather than careless: **an instruction of the
   form "add a comment at `file:NNN` naming this control" is self-invalidating,
   and the more thorough the comment, the more wrong the number.** A brief that
   asks for an annotation should ask for it *by identifier* — "annotate the
   platform check in the `farmtable` arm of `ImportCollection`" — and should say
   so explicitly, because the leg receiving a line number will use it. This is the
   corollary to §"THE OBJECT UNDER REVIEW"'s cite-by-SHA rule that the brief does
   not carry, and this round is the demonstration of why it needs one.

5. **`_r7-PHASE-TWO.md` states a routing decision as a scope fact.** *"A second
   Go-side consumer of collection `remote_data` exists at `graph_support.go:22`.
   Filed, routed off this round."* Routing the *fix* off the round is correct and
   above me. But the item is listed under "THINGS ALREADY KNOWN — DO NOT SPEND
   TIME RE-DISCOVERING", next to the gofmt and CI items, which are genuinely
   inert. It is not inert: it falsifies a universal the round shipped in a
   security comment (§8.2, Finding 9). Had I obeyed the heading I would not have
   opened the file. **A pointer that says "known, out of scope" suppresses the
   question of whether the known thing contradicts the artefact under review** —
   and the brief's own §"WORKED EXAMPLES" principle, that aptness is proximity to
   the question, says this item was the aptest thing in the file. Suggested
   repair: split that heading into "known and inert" and "known, routed, **and it
   bears on what you are reviewing**".

6. **The shared `reports/` directory makes cold-pass contamination a scheduling
   accident.** Three legs write current-round reports into the same flat
   directory that every leg must read for prior-round artefacts, and the COMMON
   brief simultaneously forbids reading peers and requires reading predecessors,
   with the two sets distinguished only by a filename suffix. One `grep` over
   `reports/*.md` — an entirely ordinary way to find a prior finding — put two
   lines of a peer's live report in front of me (§8.0). The embargo is a rule
   where a directory boundary would do. `reports/r7/` per round, or peers' current
   reports written to a per-leg path the others cannot glob, costs nothing and
   removes the failure mode rather than asking three agents to be careful in
   parallel.

One thing the brief got exactly right and I want on the record: the instruction to
attribute findings to the pass that produced them. Every finding above except one
came from the cold pass. The two axes produced one finding of their own (5a,
which the cold pass had opened and axis 2 closed) and otherwise served to confirm
things I had already written down. On this diff, the brief's checklist was a
floor and the unscoped read was the whole yield — which is what §"OPEN AXIS"
predicted, and it is now measured rather than assumed.
