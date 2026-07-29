# REPORT — provision-writable

**ROOT:** `/workspace/farmtable-provision-writable`
**REVISION:** `cc927355e5a23c45bfd983cd331eb540b0a61ad5` (detached, clean working tree)
**VERIFIED:** `git rev-parse HEAD` = cc92735…; `git ls-files | wc -l` = **435**; HEAD =
Preston Holmes, 2026-07-28 21:07:20 -0700, "Merge PR #205: stand up CI on GitHub Actions".
All three match the brief's stated identity. No stale-tree substitution.

**COLD LEG COMPLIANCE:** I did not open `reports/writable-key-path.md`,
`briefs/audit-writable-path.md`, or any `briefs/ptone-*`. One incidental exposure to the
adjacent leg's shape is recorded in §5 as a brief defect, not as an excuse.

**READ-ONLY COMPLIANCE:** No file in the repository was modified. No commit, no push, no
build, no test run. `reports/_run-queue-log.md` was not appended to because I ran nothing
requiring it.

---

## 1. POPULATION AND COMMANDS

Every sweep below is unbounded in depth (no `-maxdepth`), case-insensitive (`-i`), and run
from ROOT. No `2>/dev/null`, no `head -N` on any count or absence, no `grep -c` over a
pipeline, no `|| true`. Where a redirect was needed the form was `> file 2>&1`.

### 1.1 Primary sweep — whole tree at the revision

```
git grep -n -i 'writable' cc927355e5a23c45bfd983cd331eb540b0a61ad5 -- .
```

**Bound:** all tracked files at that exact revision, every extension, no path filter, no
depth limit. Binary files skipped by git grep (none relevant).

**Result: 35 matching lines in exactly 5 files.** Population written out in full per §3a:

> **ERRATUM, 2026-07-29 07:47Z.** The per-file counts in the table below were originally
> published as 12 / 3 / 3 / 13 / 2. **Three of the five cells were wrong**, and the column
> summed to 33 against a stated total of 35 — a residue of 2 that went undetected until a
> coordinator query forced the arithmetic to close. The cells had been transcribed by eye
> from sweep output rather than computed, making them the one part of this report carrying
> no control — in a report whose §3b demands that every cell state its own provenance.
> Corrected values below are from `git grep -c -i 'writable' cc927355e5… ` per file and now
> sum to 35. **The total (35), the file list, the five filenames, and every conclusion in
> this report are unaffected**: the finding rests on the zero Go hits and on the identity of
> the five files, neither of which moves. Recorded rather than silently fixed.

| # | File | Matching lines | Role | How this cell was obtained |
|---|------|------|------|-----------------------------|
| 1 | `.design/project-log/passthrough-write-p1.md` | 11 | doc | `git grep -c` (was 12, wrong); lines 14–30 read |
| 2 | `.design/project-log/passthrough-write-p2.md` | 4 | doc | `git grep -c` (was 3, wrong); lines 18–30 read |
| 3 | `web/src/capabilities.ts` | 3 | **consumer** | `git grep -c` (unchanged); line 99 read |
| 4 | `web/src/components/ft-app.ts` | 15 | **consumer** | `git grep -c` (was 13, wrong); lines 254–258 read |
| 5 | `web/src/components/ft-toolbar.ts` | 2 | **consumer** | grepped; line 177 read |

Zero `.go`, zero `.proto`, zero `.json`, zero `.yaml`, zero `.sql`, zero test files, zero
seed/fixture/testdata files. Every one of the 5 is a **read** of the marker or prose about
it. None is a write.

The three consumer sites, quoted:
- `web/src/capabilities.ts:99` — `if (rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true) {`
- `web/src/components/ft-app.ts:257-258` — `if (rd && typeof rd === 'object' && 'writable' in rd) { return rd.writable === true;`
- `web/src/components/ft-toolbar.ts:177` — `externalWritable = false;` (Lit property default, value arrives by parent binding from `ft-app.ts:371`)

### 1.2 Controlled Go sweep — §4 strong form, positive control inside the same invocation

```
grep -rn -i -E 'writable|remotedata' --include='*.go' .
```
piped to an `awk` that partitions the *same* output stream into the two terms.

**Result, one invocation, one instrument:**
- `remotedata` hits in `.go`: **279**
- `writable` hits in `.go`: **0**

The tool demonstrably ran, demonstrably matched, and demonstrably could match inside `.go`
files at this root with this filter. **The Go-side zero is a real zero, not a dead tool.**
The bare confirmation run `grep -rn -i 'writable' --include='*.go' .` returned empty and
exited 1 — the clean signal, deliberately not wrapped in `|| true`.

### 1.3 Controlled proto sweep

```
grep -rn -i -E 'writable|remote_data' proto/
```
**Result:** `remote_data` **3** hits (`proto/farmtable.proto:347`, `:393`, `:506`),
`writable` **0** hits. Same invocation, control satisfied.

### 1.4 Controlled config sweep

```
grep -n -i -E 'writable|yaml:|json:|mapstructure:' internal/platform/github/config.go
```
**Result:** 10 struct-tag keys matched, `writable` 0. The full key population (≤10, so
listed per §3a): `owner`, `repo`, `labels`, `github`, `enabled`, `stages`, `priorities`,
`types`, `push_prefix`, `auto_create_labels`. **No writable key exists in GitHub config.**

### 1.5 Controlled web-test sweep

```
grep -rn -i -E 'writable|isReadOnly|getCapabilities' web/src --include='*.ts'
```
partitioned in-stream by `.test.ts` vs non-test.
**Result:** non-test `.ts` **32** hits; `*.test.ts` **0** hits. Control satisfied.

### 1.6 Data-file census

`git ls-files | grep -E '\.(json|yaml|yml|sql)$'` → **10 files**, listed in full per §3a:
`.claude/mcp.json`, `.github/workflows/ci.yml`, `DRAFT-schema.json`, `buf.gen.yaml`,
`proto/buf.yaml`, `web/package-lock.json`, `web/package.json`, `web/src/gen/farmtable.json`,
`web/tsconfig.json`, `web/tsconfig.test.json`.
No seed file, no fixture directory, no `testdata` directory exists in the tree
(`find` for `migrat*|seed*|fixture*|testdata` returned exactly one path:
`internal/store/ent/migrate`, which is Ent's generated runtime, not a backfill migration).
`DRAFT-schema.json` matched `remote_data` 3× and `writable` 0× in one invocation.

### 1.7 History sweep

```
git log --all --oneline -S'writable' --pickaxe-regex -i -- .
```
**14 commits**, all consumer-side, doc, or review commits. Named heads:
`b330096`, `7cee4a6`, `428c27b`, `4f01ee1`, `e211d2c`, `2095838`, `1e1b62f`, `cff93e4`,
`101a4d4`, `ab2f4c7`, `2ac0945`, `7dee6ff`, `ca8224c`, `c0d3e2e`.
No commit in any reachable history ever introduced a **setter**.

### 1.8 The write-path audit — the part a token search cannot do

`remote_data` is an untyped JSON blob, so a surface could set the marker **without the
string `writable` ever appearing**. Grep alone would return a correct zero for the wrong
reason. I therefore traced every path that can write the blob at all. All cells read, not
inferred:

| Surface | `remote_data` writable by it? | Evidence (how obtained) |
|---|---|---|
| `CreateCollectionRequest` (proto) | **No such field.** Only `name`, `description`, `platform`, `remote_id` | read `api/farmtable/v1/farmtable.pb.go:4404-4412` |
| `UpdateCollectionRequest` (proto) | **No such field.** Only `id`, `name`, `description` | read `farmtable.pb.go:4472-4480` |
| `FarmTableService.CreateCollection` | Populates Name/Description/Platform/RemoteID. **Never RemoteData** | read `internal/server/server.go:1026-1060` |
| `FarmTableService.UpdateCollection` | Populates Name/Description only | read `internal/server/server.go:1062-1097` |
| `store.CreateCollectionParams` | **Has** `RemoteData map[string]any` — plumbing present, unfilled | read `internal/store/store.go:149-155` |
| `store.UpdateCollectionParams` | **Has** `RemoteData map[string]any` — plumbing present, unfilled | read `internal/store/store.go:157-161` |
| `EntStore.Create/UpdateCollection` | *Would* write and merge if given data | read `internal/store/entstore.go:1353-1409` |
| GitHub passthrough `syntheticCollection()` | **Never sets `RemoteData` at all** → nil | read `internal/platform/github/passthrough.go:645-654` |
| Passthrough `UpdateCollection` | Returns `store.ErrNotImplemented` | read `internal/platform/github/passthrough.go:633-635` |
| Import (`ImportCollection`) | **Carries arbitrary `remote_data` from the uploaded JSON** — but platform-gated | read `internal/server/export_import.go:306, 326-334` |
| CLI `ft collection create` | Only flag is `--description`; sends Name + Description | read `internal/cli/collection.go:127-165` |
| Web collection settings dialog | Emits `{ id, name, description }` only | read `web/src/components/ft-collection-settings-dialog.ts:108-126` |
| Ent schema | `field.JSON("remote_data", map[string]any{}).Optional()` — no default, no backfill | read `internal/store/schema/collection.go:23` |
| HTTP routes / OAuth callbacks | 6 routes, all LinkedAccount; `collection` 16 hits, `writable`/`remoteData` **0**, same invocation | grepped `internal/serverapp/linkflows.go` |

HTTP route population (≤10, listed per §3a): `/api/link/github/install`,
`/api/link/github/callback`, `/api/link/jira/connect`, `/api/link/jira/callback`,
`/api/link/linear/connect`, `/api/link/linear/callback`. There is no grpc-gateway, no REST
collection endpoint, and no `/admin` route in the tree.

---

## 2. THE ANSWER

### The narrow, measurable claim — this is what I am asserting

> **At `cc927355e5a23c45bfd983cd331eb540b0a61ad5`, no line of code in this repository
> assigns a `writable` key inside a collection's `remote_data`, and no surface exposed to an
> operator — admin page, API field, config key, CLI flag, migration, seed file, or sync
> inference — can cause one to be written for a GitHub-backed collection.**

An operator with a GitHub-backed collection who wants editing turned on **has nothing to
do**. There is no supported action. The marker is read in three places and written in none.

### What that does and does not license (§6's central distinction)

- **Licensed:** the claim about the *code*, above. It rests on read-and-quoted source at a
  named SHA, with within-invocation controls.
- **NOT licensed:** "nothing sets it," a claim about the *world*. I cannot see the
  production or staging database. A row whose `remote_data` already contains
  `{"writable": true}` — placed there by a hand-run SQL statement, a psql session, an
  operator script outside this repo, or code that existed at a revision I did not
  enumerate — would be completely invisible to every measurement I made. Nothing in this
  report excludes that.
- **What would settle the world-claim:** a direct query against each live database, e.g.
  `SELECT id, name, platform, remote_data FROM collections WHERE remote_data ? 'writable';`
  (Postgres JSONB key-exists). That requires DB access I do not have and did not seek.

### Where the gap is, by owner (§6)

The gap is **not** in the schema. `field.JSON("remote_data", …).Optional()` accepts any key
today; `EntStore.UpdateCollection` (entstore.go:1384-1399) already implements read-modify-
merge semantics that would persist a `writable` key correctly the moment one arrived. The
storage layer is finished.

The gap is in **two** places with two different owners:

1. **The API surface (proto).** Neither `CreateCollectionRequest` nor
   `UpdateCollectionRequest` has a `remote_data` field or a `writable` field. `remote_data`
   exists in the proto only as an **output** field on the `Task` and `Collection` messages
   (`proto/farmtable.proto:347`, `:393`). There is no wire representation in which an
   operator could send this value. Fixing this requires a proto change and regeneration.
2. **The write path (server handlers).** This is the sharper finding.
   `store.CreateCollectionParams` and `store.UpdateCollectionParams` **both already declare
   `RemoteData map[string]any`** (store.go:154, 160). The parameter exists; the store
   honours it; **no caller anywhere populates it for a collection.** The plumbing was built
   from the storage end and stops one layer short of the API. That is a half-built feature,
   not a design that omitted the capability.

3. **Docs.** Per §5's prompt — the inverse of the case the brief anticipated. There is no
   design document specifying a provisioning path that nobody built. There is **no design
   document specifying a provisioning path at all.** The two project logs
   (`passthrough-write-p1.md`, `p2.md`) define consumption precisely — "Checks
   `coll.remoteData` for an explicit `writable: true` flag. Defaults to read-only for
   safety" — and are silent on origin. The feature was specified, built, and logged from the
   consumer side only.

### The near-miss worth naming

**`ImportCollection` is a genuine arbitrary-`remote_data` write surface.**
`internal/server/export_import.go:332` assigns `RemoteData: doc.Collection.RemoteData`
straight from operator-supplied JSON into `ImportCollectionParams`, and
`entstore.go:2116-2117` persists it via `collCreate.SetRemoteData(...)`. There is **no
allowlist, no key validation, and no schema check** on that map. An uploaded file
containing `{"remote_data": {"writable": true}}` would be stored verbatim.

It does **not** answer the operator's question, because of one line:

```go
// internal/server/export_import.go:306
if doc.Collection.Platform != string(collection.PlatformFarmtable) {
    return nil, status.Error(codes.FailedPrecondition, "import only supports farmtable platform collections")
}
```

Import can only produce `farmtable`-platform collections, and `getCapabilities()` gives
those `ALL_ENABLED` regardless of the marker — so the marker is inert on exactly the
platform that can receive it, and unreachable on the platform that reads it. The two halves
miss each other by one gate. This is why a pure token grep would have been the right answer
for the wrong reason: **this path writes the marker and contains no occurrence of the word.**

### Security note (surfaced, not escalated, per my composition rules)

`writable` is a security-relevant marker: it is the sole gate deciding whether the UI will
issue writes against a third-party GitHub repository. It currently lives as an untyped key
in an unvalidated JSON blob with silent merge semantics, and it is trusted by the client on
sight (`rd.writable === true`). The import path shows the shape of the risk: if that
platform gate is ever relaxed — a plausible future change, since import is otherwise
platform-agnostic in intent — an uploaded JSON file becomes a self-service grant of write
access to an external system. **Recommendation: whatever provisioning surface gets built,
validate `remote_data` against a key allowlist at the store boundary rather than trusting
the blob, and treat `writable` as a typed, authorized field rather than a free-form JSON
key.** I am not proposing this as a blocker; I am flagging it because the fix is far cheaper
before the provisioning path exists than after.

---

## 3. CONFIDENCE, PER CLAIM

| Claim | Basis | Confidence |
|---|---|---|
| Tree is cc92735, 435 files, clean | run: `rev-parse`, `ls-files`, `status` | **Certain** — direct |
| No `writable` in any `.go` at this revision | swept, strong within-invocation control (279 vs 0) | **Very high** |
| No `writable` in proto / config / tests / data files | swept, each with its own in-invocation control | **Very high** |
| 5 files total contain the token; all are reads or prose | swept, then each site read and quoted | **Very high** — read-and-quoted |
| Create/UpdateCollectionRequest have no `remote_data` field | read, quoted, generated struct + proto source agree | **Certain** — read |
| Server handlers never populate `RemoteData` | read both handlers end to end | **Certain** — read |
| `syntheticCollection()` leaves RemoteData nil → GitHub collections never writable | read the whole constructor | **Certain** — read |
| Store params already carry an unfilled `RemoteData` field | read `store.go:149-161` | **Certain** — read |
| Import writes arbitrary `remote_data` but is platform-gated | read both the assignment and the gate | **High** — read; I did not trace every caller of ImportCollection |
| No surface exists for an operator (the code claim) | composition of the above | **High** |
| The marker has never been set for anyone, anywhere | **not established** | **Not claimed** — see §2 |
| No test covers the writable/capability logic | swept, controlled (32 vs 0); one test file exists in web | **High** |

---

## 4. WHAT I DID NOT CHECK

- **Any database.** No production, staging, or local DB was queried. The world-claim is
  entirely open. This is the single largest hole and it is not closeable from a tree.
- **`node_modules`.** Excluded from sweeps. I judged a `writable` in a dependency to be
  irrelevant to a farmtable collection's `remote_data`; if a dependency injected the key
  that would be invisible to me. I regard this as very low risk but it is unmeasured.
- **Any other revision.** Every claim is scoped to cc92735 alone. My history sweep (§1.7)
  covers reachable commits for the *token*, but I did not audit older revisions' write paths.
- **Runtime behaviour.** I ran no tests and no binary. Everything is static reading. In
  particular I did not confirm by execution that a GitHub collection actually renders
  read-only — I inferred it from nil RemoteData plus the three consumer sites.
- **Deployment/infra config.** No Terraform, Helm, k8s manifest, or Cloud Run env review. If
  a deploy-time process mutates rows, I would not see it.
- **`web/src/gen/farmtable.json`.** Matched zero in the primary sweep, so it contains no
  `writable`; I did not otherwise inspect it.
- **Every caller of `ImportCollection`.** I read the gate and the assignment, not the full
  call graph into it.

---

## 5. WHERE YOUR BRIEF WAS WRONG

**5.1 — §4's worked example leaks the adjacent leg's result, and it reached me before I
measured.** §1 goes to real lengths to keep me cold, then §4 illustrates good control form
with: *"a single sweep covering both Go and TypeScript returned 11 TypeScript hits and 0 Go
hits."* That is not a neutral methodology example. It is the shape of the answer — Go zero,
TypeScript non-zero — delivered as an aside, and I had read it before running anything. I
then found a Go zero and TypeScript non-zero. **I cannot now prove my sweep was
uncontaminated by that anchor**, and by the mechanism §1 itself describes, that is exactly
the suppression effect you are trying to avoid. My counts (35 hits, 5 files, 279 vs 0)
differ from the example's, and I did widen scope well past the token, which is weak evidence
of independence — but the leak is real and you should discount my Go-zero accordingly when
you reconcile. **Fix: draw control-form examples from an unrelated question.** This is the
most important item in this report after the answer itself.

**5.2 — The brief's framing invites a token search, and a token search cannot answer this
question.** The question is posed throughout as "name the surface that sets the `writable`
marker," which directs the instrument at the string. But `remote_data` is an untyped JSON
blob, so **a surface can set the marker without the token appearing anywhere in the
repository** — which is precisely what `ImportCollection` does (§2, near-miss). A
disciplined agent could have run a perfectly controlled, fully compliant sweep, found zero,
and reported a correct answer while never discovering the one code path that writes
arbitrary `remote_data` keys. Your §5 bullet gestures at "whatever the API exposes of
`remote_data` as a whole," but it sits fifth in a list of starting points, whereas it is
actually the load-bearing part of the method. **For blob-valued fields, the question must be
posed as "what writes the container," not "what writes the key."** Your control requirement
in §4 defends against a dead instrument; it offers no defence at all against a live
instrument aimed at the wrong target.

**5.3 — §7's escape hatch is inapplicable, and the reason is itself a finding.** You permit
one targeted `go test -run` if it is the only way to settle the question. There is no such
test to run: the entire writable/capability surface has **zero test coverage** at this
revision (§1.5 — 32 hits in non-test `.ts`, 0 in `*.test.ts`; exactly one web test file
exists, `web/src/utils/task-ready.test.ts`, and it is unrelated). Worse, the artefact you
pointed me at asserts otherwise: `passthrough-write-p1.md:69-75` carries a verification
table marking *"isReadOnly returns false for writable GitHub collections — Done"* and
*"isReadOnly still returns true for non-writable GitHub collections — Done"*. **Those tests
do not exist in the tree.** A project log claiming Done for tests that are absent is the
same class of defect as the withdrawn artefact you describe in your dispatch, and it is
sitting in the primary document a reader would consult about this feature.

**5.4 — "A design document that specifies a provisioning path nobody built is a finding"
anticipated the wrong failure.** You primed me for spec-ahead-of-code. The actual state is
the reverse and is more interesting: the **storage layer ran ahead of the API**.
`CreateCollectionParams.RemoteData` and `UpdateCollectionParams.RemoteData` exist, are
honoured by `EntStore` with correct merge semantics, and are populated by nobody. The
feature was built from the bottom up and abandoned one layer below the wire. That is a
different diagnosis with a different fix and a different owner than the one your framing
pointed at, and an agent checking only your named failure mode would have filed "no design
doc exists" and missed the orphaned parameter.

**5.5 — Confirmed, not wrong.** §8's zsh warning is accurate and cost me one command: an
unquoted `api/farmtable/v1/*.proto` aborted with `no matches found` (the `.proto` source
lives at `proto/farmtable.proto`; only generated `.pb.go` sits under `api/`). §2's tree
identity is exactly right on all three of SHA, author/date, and the 435 file count.

---

## 6. ONE-LINE ANSWER

Nothing in this repository at cc92735 provisions it: the marker is read in three web files
and written by no surface at all, the proto has no field for it, and both store-layer
`RemoteData` parameters that would carry it are present but populated by no caller.
