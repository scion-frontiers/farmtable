# SECURITY AUDIT — audit-xss-r6

- **Agent:** `audit-xss-r6` (security leg, one of three)
- **ROOT:** `/workspace/farmtable-audit-xss-r6` (mine alone; no other tree read, written or built in)
- **SHA:** `c108acbcfa2357862576092469828709bb6c4090`, detached. Verified `git rev-parse HEAD`.
- **Tree state at report time:** clean. `git status --short` empty, `git diff HEAD` empty.
- **DIST:** present, **copied** not built here. No finding below depends on `web/dist` provenance.
- **node_modules:** 79 top-level, installed from the lockfile at my own SHA. Nothing borrowed.

**VERDICT: APPROVE WITH CONDITIONS.** The security work in this round is real and the guard is
honest. I found no live, remotely exploitable defect. I did find that **the round's own new
reachability comment repeats the exact error class the round was convened to eliminate**, and
that the **merge blocker the EM listed as unverified is real** — I verified it. Neither blocks
the security ruling; the second blocks the merge.

---

## 0. CONTAMINATION DISCLOSURE — MY COLD PASS IS COMPROMISED, AND I AM NOT GOING TO PRETEND OTHERWISE

The dispatch message said: *"READ THESE TWO FILES, IN THIS ORDER, BEFORE YOU DO ANYTHING ELSE"*,
naming `_r6-COMMON.md`. Section 5 of that same file says: write Phase One to disk **before**
reading section 7. **Section 7 is inside the file I was ordered to read, first, in full.** The two
instructions are not jointly satisfiable. I followed the dispatch order and therefore read section
7 before Phase One existed on disk.

I cannot unread it. What I did instead was enumerate everything section 7 told me, in
`_prereg-audit-xss-r6.md`, **before** reading any code, and bind myself to this rule:

> Any finding section 7 or the role brief could plausibly have handed me is reported as **Phase
> Two**, regardless of when I actually found it. I claim a finding as cold only if it is outside
> that enumerated set.

This deliberately **under**-credits my cold pass. That is the correct direction for the error to
run. The mechanism section 5 warns about — an accurate upstream artefact suppressing the
independent search — is real and I was exposed to it. Treat my Phase One as *partially* protected
by the pre-registered enumeration, not as clean.

---

## 1. PHASE ONE — WHAT I FOUND READING THE DIFF

Attribution rule as above. `SEEDABLE-BY-S7` is my honest judgement of whether the briefs could
have handed me the finding.

### 1.1 The diff is one production file

`d305391..c108acb` is 11 commits, 1992 insertions. **The only non-test, non-doc file changed is
`internal/server/convert.go`.** Everything else is tests (`internal/server/*_test.go`,
`internal/platform/github/remotedata_representability_test.go`,
`internal/webguard/remotedata_consumers_test.go`), a doc (`internal/webguard/doc.go`) and a
project log. Authorship on the path is uniformly `Scion Agent`; I did not infer authorship from
the range.

### 1.2 The new production code is a log sampler, and it is careful

`logRemoteDataDropped` / `unrepresentableKeys` (convert.go:327–402). Shared state is fully
mutex-covered; `remoteDataLogNow` is read *inside* the lock, so the test clock seam is not a race
against the production path. The sampler's suppressed-count-carried-forward design is sound. The
"NewStruct refused but every value is individually representable" branch is a genuinely good
instinct. **No defect found here.** `SEEDABLE-BY-S7: no.`

One residue, filed as F4 below: the line formats **attacker-authored map keys** into
`log.Printf` unquoted.

### 1.3 The comment rewrite is the substance of the diff — and it has a hole

Most of the 203 changed lines in convert.go are **comment**, replacing a reachability claim the
round found to be false. The replacement is itself wrong, in the same class. This is F2 and it is
my headline. `SEEDABLE-BY-S7: no` — section 7 names two known in-tree inaccuracies and this is
neither of them.

### 1.4 remote_data is consumed server-side, in Go, today

`convert.go:411` branches on `t.RemoteData["platform"]` to set `pb.Task.platform`. `:470` and
`:473` read `remote_id` and `remote_url`. The `platform` read is a **classification** branch on
attacker-authored data — not a render sink and not a URL, so `sanitizeRemoteData` does not touch
it (`urlBearingRemoteDataKey("platform")` is false). This is F3.
`SEEDABLE-BY-S7: partially` — the briefs supplied "a capability sink is not a render sink"; the
*Go-side population* point and the demonstration are mine.

### 1.5 The import path is the only attacker write to collection remote_data

Traced cold: `ImportCollection` RPC (export_import.go:264) → `sanitizeRemoteData(doc.Collection.
RemoteData)` (:332) → `store.ImportCollection` → `collCreate.SetRemoteData(p.Collection.
RemoteData)` verbatim (entstore.go:2116–2117). **No key validation anywhere on that path.**
`SEEDABLE-BY-S7: yes` — the role brief handed me this lead. Re-measured at my SHA as instructed;
it holds. See F1.

---

## 2. PHASE TWO — RECONCILIATION WITH WHAT THE ROUND CLAIMS

### 2.1 Where I agree with section 7

- **The guard's measured arms are correct as stated.** I re-ran `TestWebRemoteDataConsumersAre
  Declared` at `c108acb`: **PASS**. The census logic, the exact-multiplicity keying, and the
  non-vacuity companion are all as described.
- **The two known in-tree inaccuracies are both real and I confirmed both**, but I confirmed them
  *after* reading section 7, so I claim **no cold credit**:
  1. Project log lines 138–139 carry the stale table. The cell *computed spelling / file WITH
     declared entries* reads **"RED, as a disappearance"** — a deletion result in a table about
     additions. Section 7's corrected table has that cell GREEN. Confirmed.
  2. `remotedata_consumers_test.go:355` — header `DECLARED remote_data SITE(S) NO LONGER MATCH`
     fires on the exact-multiplicity branch, which triggers when a site matches **twice**.
     "No longer match" describes an absence on a path that also fires for a surplus. Confirmed.
     Mitigating: the body text below it does explain both directions.
- **`web/scripts/run-tests.mjs` is not this round's work.** Not re-verified; no finding rests on it.

### 2.2 Where I exceeded the brief, and what it bought

Section 7 listed the merge blocker as **"predicted … unverified"** and said confirming it was in
scope for whichever leg found it natural. **I verified it. It is real.** See F5. The objects were
available in my tree the whole time — `cc9273` is a present commit object even though no ref
points at it. The brief's own maxim, *reachability is not presence*, applies here in the
direction the brief did not apply it to itself.

### 2.3 Where I disagree with the round — the disagreement is the result

The round's ruling is *"remote_data IS a security boundary, and the deliverable is the answer to
'what goes red when someone adds a sink'."* **The shipped artefact answers that question for the
web tree only.** Go-side sinks exist today and nothing censuses them. The guard's own limits
block declares this honestly ("Anything outside `web/`"); the **round's claim does not carry the
qualifier the artefact carries.** That gap is F3.

---

## 3. FINDINGS

Severity **and** measurement status on every row, per the role brief.

| # | Severity | Measurement status | Title |
|---|---|---|---|
| F1 | MEDIUM | **latent** | Attacker-planted keys reach collection remote_data via import; inert only by a two-file unannotated conjunction |
| F2 | MEDIUM | **live and derived** | The round's replacement reachability comment omits the one writer that is actually live |
| F3 | MEDIUM | **live and demonstrated** | B11's population is web-only; Go-side consumers of the same attacker data exist and are invisible |
| F4 | LOW | **latent** | Log injection: attacker-authored map keys are formatted unquoted into the new log line |
| F5 | MEDIUM (non-security) | **live and demonstrated** | Merge blocker vs real `main` confirmed, and its output is actively misleading |
| F6 | INFO | **live and derived** | Import validates task remote_data by rejecting, collection remote_data by silently dropping |
| R1 | — | **refuted** | No import→relink privilege escalation: collection platform is immutable after creation |

---

### [MEDIUM / latent] F1 — Attacker-planted keys reach collection `remote_data` via import, held inert by a conjunction nobody wrote down

**Location:** `internal/server/export_import.go:332`; `internal/store/entstore.go:2116-2117`;
inertness conjuncts at `internal/server/export_import.go:305,331` and `web/src/capabilities.ts:94`.

**Description.** `ImportCollection` copies an uploaded document's collection map into storage with
**no key validation**. `sanitizeRemoteData` is applied, but it only validates *values under
URL-bearing key names*; it neither filters nor allowlists keys. An authenticated caller with
`ScopeCollectionAdmin` can therefore place **any key, including `writable: true`**, into a
collection's `remote_data`.

Re-measured at my SHA per instruction: `writable` appears in Go in exactly **two** places,
`internal/server/convert.go:716` and `:718` — **both comments, both added by this round.** There
is no functional Go code that reads it. Confirmed: **there is no server-side notion of a
read-only collection.** The flag is enforced entirely client-side.

**Why it is latent and not live.** Two facts, in two files, neither annotated as a security
control:

- **Conjunct A** — `export_import.go:305` rejects any document whose `collection.platform` is not
  `farmtable`, and `:331` hardcodes `Platform: collection.PlatformFarmtable`. An imported
  collection is *always* farmtable-platform.
- **Conjunct B** — `web/src/capabilities.ts:94` returns `ALL_ENABLED` for `Platform.FARMTABLE`
  **before** reaching the `remote_data` read at `:99`. `ft-app.ts:227` and `:241` likewise return
  early on FARMTABLE.

So a planted `writable` lands on a collection whose capabilities are already fully enabled, and
is never consulted. **Inert today.**

**Impact if a conjunct moves.** Either "allow import of github-platform collections" or "consult
`writable` before the platform check" converts this to a live client-side authorization bypass.
Neither change looks like a security change to whoever makes it.

**Recommendation.** Allowlist keys at the deserialize boundary rather than relying on the
platform coincidence:

```go
// export_import.go, before building importParams
var importableCollectionRemoteDataKeys = map[string]bool{ /* explicitly enumerated */ }

func filterCollectionRemoteData(rd map[string]any) (map[string]any, []string) {
    out, dropped := make(map[string]any, len(rd)), []string(nil)
    for k, v := range rd {
        if !importableCollectionRemoteDataKeys[k] {
            dropped = append(dropped, k) // surfaced as an import warning
            continue
        }
        out[k] = v
    }
    return out, dropped
}
```

Minimum viable alternative: reject `writable` explicitly on import and annotate both conjuncts
with a comment naming the other one.

---

### [MEDIUM / live and derived] F2 — The round's replacement reachability comment omits the one collection writer that is actually live

**Location:** `internal/server/convert.go:697-706`.

**Description.** This round's central act was replacing a **false** reachability comment with a
true one. The replacement says (verbatim):

> *"The real collection writers are CreateCollection (entstore.go:1366), UpdateCollection (:1399)
> and ImportCollection (:2117). The reason this line does not fire is that NO IN-TREE CALLER
> POPULATES CreateCollectionParams.RemoteData OR UpdateCollectionParams.RemoteData."*

**It names three writers in the first sentence and accounts for two of them in the second.**
`ImportCollection` is dropped. And `ImportCollection` is precisely the writer that **does**
populate `RemoteData` — from an attacker-uploaded JSON document (F1).

I verified the two claims it *does* make: `server.go:1057` (CreateCollection RPC) builds
`store.CreateCollectionParams` with `Name`, `Description`, `Platform`, `RemoteID` and **no**
`RemoteData`; the UpdateCollection handler likewise. Those two are correct.

**Why this matters more than a comment nit.** The comment then states *"THE INVALIDATING EVENT,
NAMED: anyone setting RemoteData on either param struct arms this line."* That enumeration is
**incomplete**, and the omitted path is not hypothetical — it is live and attacker-reachable.

Worse, the true reason the log line does not fire on the import path is that imported values are
**JSON-decoded and therefore structpb-representable** — which is the **TYPE argument the same
comment explicitly disavows** four lines earlier as "FALSIFIED". The round replaced a type
argument with a caller argument; for the live path, the caller argument is wrong and the type
argument is the one actually doing the work.

**Impact.** A future reader who checks this comment — the round's whole design intent — comes away
believing collection `remote_data` has no live writer. It has one. This is the same failure the
round was convened to fix: *an enumeration that resolves, is checkable, and is incomplete.*

**Recommendation.** Amend to name the third path and its actual protection:

```go
// The real collection writers are CreateCollection (entstore.go:1366),
// UpdateCollection (:1399) and ImportCollection (:2117).
//
// CreateCollection and UpdateCollection: no in-tree caller populates the
// RemoteData field of either param struct (server.go:1057, :1085,
// graph_routing.go:83 all omit it). A CALLER property.
//
// ImportCollection DOES populate it, from an attacker-uploaded JSON document
// (export_import.go:332). That path does not fire this line for a TYPE reason:
// json.Decode yields only map[string]any/[]any/scalars, all structpb-
// representable. Both reasons are preconditions, neither is a guarantee.
```

---

### [MEDIUM / live and demonstrated] F3 — B11's population is the web tree; Go-side consumers of the same attacker data exist today and are invisible to it

**Location:** guard at `internal/webguard/remotedata_consumers_test.go:236` (census root);
uncovered live consumers at `internal/server/convert.go:411`, `:470`, `:473`.

**Demonstration — a controlled negative bounded to an event I caused, not generalised.** In my own
tree only, I planted a Go-side consumer of the field into `taskToProto`:

```go
if w, ok := t.RemoteData["writable"].(bool); ok && w {
    log.Printf("planted go-side consumer of remote_data: %v", w)
}
```

Plant verified present by `grep` on the file (not by an exit code). Result:

| arm | result |
|---|---|
| Go-side literal consumer of `t.RemoteData["writable"]`, planted in `internal/server/convert.go` | **GREEN / OUT-OF-POPULATION** — guard passes |
| same tree after `cp` revert, `git status` empty, `git diff HEAD` empty | **GREEN / BASELINE RESTORED** — both guard tests pass |

Both rows carry execution evidence; both are in `_run-queue-log.md` with ROOT and DIST.
**Bound: this is a statement about one plant I made in one file. It is not a claim about the Go
tree at large.**

**Description.** The census walks `web/` only (`webRoot()` returns `<module>/web`). Live Go
consumers of the identical attacker-authored field exist right now — most notably
`convert.go:411`, which branches on `t.RemoteData["platform"]` to set `pb.Task.platform`. That is
a **classification** read, not a render and not a URL, so `urlBearingRemoteDataKey("platform")` is
false and `sanitizeRemoteData` passes it through untouched.

**Scope, with both edges.** The guard's own limits block declares this: *"Anything outside `web/`.
Other clients of this API are not in this tree."* **I am not filing a defect against the guard.**
I am filing one against the **round's unqualified claim** that the deliverable is "what goes red
when someone adds a sink". The artefact answers that for `web/`. There is no Go-side analogue,
and Go is where the field is currently branched on most.

**Recommendation.** Either qualify the claim everywhere it appears — *"what goes red when someone
adds a sink **in the web tree**"* — or add a Go-side companion. A Go census is strictly easier
than the TypeScript one because `go/ast` is in the standard library and the no-sixth-scanner
ruling is about hand-written text scanners, which an AST walk is not. The round already built one
(`remoteDataWriteSites`, B4/B6) for **write** sites; the same walk over **read** sites would close
this.

---

### [LOW / latent] F4 — Attacker-authored map keys are formatted unquoted into the new log line

**Location:** `internal/server/convert.go:391` (`unrepresentableKeys`), emitted at `:371`/`:377`.

**Description.** New code this round:

```go
out = append(out, fmt.Sprintf("%s (%T)", k, v))
```

`k` is a key from `remote_data` — attacker-authored by the round's own threat model — and goes
into `log.Printf` with `%s`. A key containing a newline forges log records. The pre-existing code
logged only `err`; **this round widened what reaches the log to include attacker-controlled
strings.**

**Why latent, both conjuncts named.** Firing requires an attacker-named key *and* an
unrepresentable value in the same map:
- Every in-tree adapter key is a **static literal** (`graphql_queries.go:489-512`,
  `github.go:268-276`, `beads.go:394-418`). Verified.
- Import-derived keys are attacker-named but JSON-decoded, hence all representable, so
  `structpb.NewStruct` succeeds and the log never fires. Beads JSONL import sets no `remote_data`
  at all. Verified.

Not hypothetical drift: `urlvalidate.go:114` explicitly contemplates a runtime-built key
(`"field_"+name`), and `remote_data` is the documented escape hatch for out-of-tree adapters.

**Recommendation.** One character:

```go
out = append(out, fmt.Sprintf("%q (%T)", k, v))
```

`%q` escapes newlines and control characters and costs nothing in readability here.

---

### [MEDIUM, non-security / live and demonstrated] F5 — The predicted merge blocker is real, and its output is misleading in a way that invites the wrong fix

**Location:** `scripts/ci-suite-manifest.mjs` at `cc927355e5a23c45bfd983cd331eb540b0a61ad5`
(real `main`) vs `web/package.json` `"test"` at `c108acb`.

**Demonstrated.** `cc9273` is present as a commit object in my tree despite no ref pointing at it,
so I extracted the checker to `/tmp` and ran it read-only against my tree. Verbatim output tail:

```
TEST FILES PRESENT IN TREE (4):
  web/src/util/assertions.test.ts
  web/src/util/safe-url.test.ts
  web/src/util/url-binding-scan.test.ts
  web/src/utils/task-ready.test.ts

TEST FILES ACTUALLY EXECUTED BY `npm test` (0):
  (none)

NOT EXECUTED BY ANYTHING (4):
  ... the same four ...

COULD NOT ANALYSE (1):
  node scripts/run-tests.mjs -> cannot map 'scripts/run-tests.mjs' to a tracked test file

FAIL: ...
```

Population is four, so it is reported as **the list, not the number**, per COMMON §4.

**Mechanism.** `"test"` at my SHA is `rm -rf .tmp-test && tsc -p tsconfig.test.json && node
scripts/run-tests.mjs`. The checker skips the first two by its compile-step regex, then hits the
`node` branch and calls `mapArtefactToSource('scripts/run-tests.mjs')`, which strips the leading
path segment to `run-tests.mjs` and looks for it among files matching
`\.(test|spec)\.(ts|...)$`. A runner is not a test file, so it never matches → `unanalysable`,
`executed` stays empty → **both** `missing` and `unanalysable` are non-empty → exit 1.

**The part that matters more than the failure.** The checker's headline claim, *"NOT EXECUTED BY
ANYTHING (4)"*, is **false**. `web/scripts/run-tests.mjs` glob-discovers `src/**/*.test.ts`,
cross-checks each source against its compiled `.test.js`, and additionally sweeps for
test-shaped files that discovery would miss. All four files run. So the merge produces a
**confident, specific, wrong** report that the branch deleted its web test coverage — which
invites reverting the discovery runner, the stronger of the two mechanisms.

Both sides are solving the same problem (a suite silently ceasing to run) by opposite strategies:
real `main` by pinning a hand-list, this branch by discovery plus a compile cross-check. They are
not mergeable as-is.

**Recommendation.** Teach the checker the discovery runner *before* the merge, not after:

```js
// in the /^node\b/ branch, before mapArtefactToSource
if (/run-tests\.mjs/.test(a)) { discoveryRunner = t; present.forEach(p => executed.add(p)); continue; }
```

This is a **non-security** finding. I report it because section 7 put it in scope and because a
misleading green/red on the test-membership gate is the class of problem this project keeps paying
for.

---

### [INFO / live and derived] F6 — Import rejects bad URLs in task `remote_data` but silently drops them in collection `remote_data`

**Location:** `export_import.go:722` (`validateImportedTaskURLs`, **errors**) vs `:332`
(`sanitizeRemoteData`, **drops**).

Both directions fail closed, so **this is not exploitable** and I am not inflating it. It is noted
because the round's own history records that *"the write and read boundaries classifying keys
differently is how `html_url` came to be validated by neither"* — and this is the same shape:
two boundaries over the same field with different disposition. A caller importing a collection
whose `remote_data` carries a `javascript:` URL gets a success response with the value silently
removed, and no warning in `ImportCollectionResponse.Warnings`.

**Recommendation.** At minimum, append a warning when the collection sanitizer drops something,
so the asymmetry is visible to the caller.

---

### [REFUTED] R1 — There is no import → relink privilege-escalation chain

I predicted (prereg P4-adjacent) that an attacker might import a collection carrying
`writable: true` under the forced `farmtable` platform, then relink it to GitHub to arm the flag.
**Refuted.** `SetPlatform` on a Collection occurs at exactly two sites —
`entstore.go:1359` (CreateCollection) and `:2115` (ImportCollection). (`:2273` is
`linkedaccount.Platform`, a different entity.) **No update path mutates a collection's platform.**
Platform is immutable after creation, so the escalation does not exist. Reported rather than
deleted, per my pre-registration. This materially **strengthens** F1's inertness.

---

## 4. POSITIVE OBSERVATIONS

These are not padding; several are better than what I usually see.

- **The guard's correctness argument is the right one.** Choosing an over-approximating census
  over a sixth hand-written structural scanner, and *writing down why*, is the correct call. The
  reasoning at lines 50-77 — that every prior scanner failed by trying to understand structure and
  each "reported clean when it was blind" — is exactly right.
- **`filesScanned == 0` is checked.** The guard refuses to pass on an empty walk. That is the
  single most common way a census rots into a permanent green, and it is closed.
- **The non-vacuity test genuinely duplicates the allowlist** rather than deriving from it. The
  stated reason — a bug emptying the allowlist would otherwise make both tests pass — is correct
  and is the kind of thing usually got wrong.
- **`webRoot()` anchors on `go.mod`, not a relative path**, with an explicit fatal if `web/`
  is missing rather than a silent skip. The comment even cites the review nit that motivated it.
- **Exact multiplicities rather than floors**, with the reasoning stated: a floor absorbs a
  deletion via a compensating addition. Correct.
- **The allowlist refuses to grant a category.** "A category grants the next one for free" is the
  right instinct and is why this axis took five rounds.
- **The round corrected its own false comment and said so in the commit message**
  (`2f62f63 B11: correct a false executor claim I shipped one commit ago`). The old comment's
  citations resolved to plausible-but-wrong lines — the round noticed that the *resolvability* was
  what made them dangerous. That is a genuinely sophisticated observation.
- **`urlBearingRemoteDataKey` fails closed by name** and documents that `CURL` is a false positive
  in the safe direction. The read-path validation at `convert.go:498` — validating on the way out,
  not only at the write boundary — is correct defence in depth, and the comment explaining that
  omission makes the row *vanish* rather than render inert is more precise than most code gets.
- **The sampler's mutex discipline is correct**, including reading the clock seam under the lock.

---

## 5. WHAT I DID NOT CHECK

Stated so the scope has two edges.

- **I did not run the full Go suite, `go vet`, `go build`, `npm test` or a `web/dist` rebuild.**
  No token requested — nothing in my findings needed one. Consequently **I make no claim about
  whether this branch is green overall.** Section 7 states `main` is RED on `TestListUsers` and
  that five tests flake ~4.5%; I neither confirmed nor refuted either.
- **I did not re-verify the four planted-mutation arms in section 7's table.** I ran the guard
  clean (PASS) and ran one *additional* arm section 7 did not measure (F3). The three arms in the
  round's table are taken on report.
- **I did not audit authentication or scope enforcement generally.** I confirmed `ImportCollection`
  requires `RequireIdentity` + `ScopeCollectionAdmin` and stopped there. Whether
  `ScopeCollectionAdmin` is correctly granted is out of scope and unexamined.
- **I did not audit the GitHub passthrough token handling, TLS configuration, or HTTP client
  timeouts.** My question was `remote_data`; I did not sweep the standard client-security surface.
- **I did not do dependency vulnerability auditing.** No `npm audit` / `govulncheck` run — both
  would have needed the token and neither bears on this diff.
- **I did not verify F2's impact by execution.** It is `live and derived`: I read the call sites
  (`server.go:1057`, `:1085`) and confirmed they omit `RemoteData`, and I read the import path
  that does not. I did not run an import end-to-end.
- **I did not examine `web/dist`.** The census skips it; it is generated from `src`. If anyone
  hand-edits `dist`, the guard cannot see it and the result is `//go:embed`-ed into the binary.
  I flag the reasoning but did not measure it.
- **I did not check out real `main` or attempt the merge.** F5 is demonstrated by running `main`'s
  checker against *my* tree, which is the exact predicate the merge would evaluate, but it is not
  the merge.

---

## 6. WHERE THE BRIEF WAS WRONG

Mandatory section. Five items; the first two have operational consequences.

### 6.1 The reading order is self-contradictory, and it cost the cold pass

Dispatch: *"READ THESE TWO FILES, IN THIS ORDER, BEFORE YOU DO ANYTHING ELSE."* COMMON §5: write
Phase One to disk **before** reading §7. **§7 lives inside the file the dispatch orders read first
and in full.** No agent can satisfy both.

This is not a technicality — §5 argues at length that the suppression effect is *strongest* when
the upstream artefact is accurate, and §7 is accurate. The instruction designed to prevent the
failure is the vector for it. **Fix:** move §7 into a separate file,
`_r6-COMMON-PHASE-TWO.md`, and have §5 say "read this file only after your Phase One is on disk."
A section boundary inside a file is not an enforcement mechanism against an instruction to read
the file.

### 6.2 "`git ls-remote` is the only cheap read in git that cannot be stale" is false in this topology

§7 asserts this while telling me my `main` ref is stale and that real `main` is `cc9273`. From my
tree:

```
$ git remote -v
origin	/workspace/farmtable (fetch)
$ git ls-remote origin main
7a0f220dbd9332cb8db62138c841777432b4eda4	refs/heads/main
```

**My `origin` is a local clone, not a real remote, and it is itself pinned at `7a0f220`.**
`ls-remote` faithfully reported a stale answer. A leg that followed this instruction literally
would have reported `main = 7a0f220` with high confidence and contradicted you — and would have
been obeying the brief while doing it.

The true statement is: *`ls-remote` is only as fresh as the remote it names, and on this host every
tree's `origin` is a local clone.* This is, precisely, the error class in your own §2 correction:
evidence gathered at the scope of the instrument, conclusion written at the scope of the question.

### 6.3 The merge blocker was verifiable all along, and the brief's own maxim says why

§7 lists it as unverified. The objects were in my tree the entire time: `git cat-file -t cc9273`
returns `commit`, with no ref pointing at it. **Absence of a ref was read as absence of the
objects.** Your role brief states the corrective — *"PRESENCE IS NOT MODIFICATION AND REACHABILITY
IS NOT PRESENCE. Objects in a repository and files in the tree a gate checks out are two different
populations"* — and it applies to the brief as well as to the code. Cost: this could have been
settled hours ago by any leg. It is now settled (F5).

### 6.4 The role brief's `writable` lead was already stale at my SHA

The lead says `writable` "appears in **zero** Go files", measured at `7a0f220`. At `c108acb` it
appears in **two** — `convert.go:716` and `:718`. Both are comments added by this very round, so
the *conclusion* (no server-side read-only notion) survives intact. But the instruction was
"re-measure at your SHA before you rely on a word of it", and re-measuring changed the number. The
brief was right to demand it. Worth noting that a zero-count lead of this kind decays the moment
the round under review adds a comment.

### 6.5 §2's node_modules inference — already self-corrected mid-run

The "110 is not a superset of 79" framing was corrected by you before I relied on it: the two are
installs of two different manifests. Recorded for completeness. I borrowed nothing; my 79-entry
tree came from my own lockfile. Your correction was right and arrived in time.

### 6.6 One thing the brief got conspicuously right

"Never terminate a command with an echo of its own status." I verified the planted mutation by
`grep` on the file and the revert by `git status` / `git diff HEAD` emptiness, and verified the
merge blocker by its stdout artefact — never by a reported exit code. The harness reported "exit
0" on my guard runs, and I did not use that as evidence for anything.

---

## 7. ANSWER TO MY QUESTION

> **`remote_data` is an attacker-authored map. Is the harm closed, and is the boundary where this
> round thinks it is?**

**Is the harm closed?** For the sinks that exist today, yes — but by **coincidence in one place
and by design in the others.** The URL surface is genuinely well closed: fail-closed name
predicate, sanitize on read and on write, validate on the way out, recursion to depth. The
**capability** surface is closed only by the F1 conjunction — attacker keys do reach storage, and
the reason they do not matter is that import forces `farmtable` and the web gate returns early on
`farmtable`. Two files, neither annotated, both changeable by someone with no reason to look.

**Is the boundary where the round thinks it is?** **No — it is one tree short.** The round drew
the boundary at "consumers of `remote_data`" and built an artefact that enforces it across `web/`.
The field is branched on in **Go**, today, at `convert.go:411`, and I demonstrated that a Go-side
consumer is GREEN. The round's guard is honest about this in its own limits block; the round's
*claim* is not.

**And the question the round asked is the right one.** "What goes red when someone adds a sink" is
a materially better question than "where is it rendered", and the reasoning about capability sinks
versus render sinks is correct and hard-won. My criticism is of the *scope* of the answer, not the
question.

**Conditions on approval:**
1. Fix **F2** — the comment is the deliverable of this round and it is wrong in the same class it
   was written to correct. Cheap.
2. Qualify the **F3** claim, or add the Go-side census. Do not ship the unqualified sentence.
3. Resolve **F5** before merging to real `main`.
4. **F4** is a one-character fix; take it.
5. **F1** is a fix-round item. It is latent and I am not blocking on it, but the two conjuncts
   should at minimum be annotated with cross-references to each other.
