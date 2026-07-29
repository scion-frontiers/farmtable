# XSS Phase 2 — Round 6 fix leg — B1 through B11

**Branch:** `url-scheme-validation-r6` · **Base:** `d305391` · **HEAD:** `c108acb`
**Tree:** `/workspace/farmtable-xss-r6-fix` · **Pushed:** NO. Nothing on this branch has left this machine.
**Run log:** `reports/_run-queue-log.md`, entries R6-1 … R6-22, each pre-registered before its run.

Every claim below carries one of `[MEASURED]`, `[DERIVED]`, `[REASONED, NOT MEASURED]`, `[UNCHECKED]`.

### The scope-match pass, replacing the provisional marking

`PROVISIONAL PENDING INSTRUMENT READ` is **struck**. The instrument read landed and the hypothesis
behind that marking is dead: a rendering-keyed search is *not* structurally incapable of finding a
branched-on consumer — it found one eleven times, from round one. I had that wrong, and it is worth
naming because I asserted it confidently in three places, including inside the B11 guard's own
header comment.

The real mechanism is narrower and cheaper to check:

> **A negative's conclusion was written at a wider scope than its own evidence, inside the same
> document.** The consumer was present in the report's evidence and absent from its conclusion.

So each negative under B1–B10 has been re-read against one question only — *does the scope of the
conclusion match the scope of the evidence I actually gathered?* — and narrowed where it did not.
This was a reading pass over my own prose. **Nothing was re-derived and nothing was re-run for it.**
Results are marked `[SCOPE OK]` or `[SCOPE NARROWED]` at the sentence.

**B11 is not exempt from this pass, only from the old marking — and it failed.** See §2 B11 and
§4 item 5: R6-21 caught me doing exactly this, one round after being warned, in a claim about my
own guard.

---

## 1. Disposition

All eleven blocking findings are resolved and committed. Eleven commits:

| Commit | Item | Substance |
|---|---|---|
| `1362bed` | B4, B6, O2 | RemoteData write-site scanner rewritten over `go/ast` |
| `4f01ee1` | B1, B2, B10 | three false reason strings replaced with true ones |
| `85900f8` | B8, B10 | C-1 pinned at the producer, in the producer's own package |
| `428c27b` | B7, B9 | C-1's second carrier exercised end-to-end; false reason dropped |
| `ba09244` | B3 | dropped-remote_data log sampled, and pinned to exist |
| `1b29165` | B5 | ephemeral route pin given an actual route to test |
| `7cee4a6` | B11 | web-tree `remote_data` consumers pinned as a named allowlist |
| `2f62f63` | B11 | a false executor claim I shipped in `7cee4a6`, corrected |
| `b330096` | — | project log, in-tree |
| `6bbd056` | — | project log: the measured B11 hole, and the corrected miss mechanism |
| `c108acb` | — | project log: the deciding cell that bounds the hole |

`d305391..HEAD`: 9 code files, +1730 / −301, plus the project log. `[MEASURED]` — `git diff --stat`,
printed alongside `git rev-parse HEAD` in the same command. **No code changed after `7cee4a6`**;
`2f62f63` is a comment, and the last two are the in-tree log.

---

## 2. Findings, one by one

### B1 — `collectionToProto`'s reason string was false, and its citations resolved to the wrong thing

The old comment claimed no input path to a collection's `remote_data` could carry a
structpb-hostile Go type — **a claim about types.** `[MEASURED]` It is false: a review leg passed a
Go-native `map[string]string` into `CreateCollection` and fired the line. Nothing in the type
system prevents it.

The citations were worse than absent. `[MEASURED]` They pointed at `entstore.go:408` and `:898`,
which are the **task** `SetRemoteData` sites, not collection sites. **Both line numbers resolve, to
plausible-looking `SetRemoteData` calls** — so a reader who responsibly went and checked came back
with false confidence. This is the one item where line numbers are the subject, so they are cited
as numbers here by instruction.

Replaced with the true and weaker claim: the line has no caller **today**, for a **caller** reason,
not a type reason. `[MEASURED]` The real collection writers are `CreateCollection`
(`entstore.go:1366`), `UpdateCollection` (`:1399`) and `ImportCollection` (`:2117`); the three
in-tree call sites (`server.go:1057`, `server.go:1085`, `graph_routing.go:83`) all omit the field.
The invalidating event is named in the comment: **one field assignment on either param struct arms
this line**, by someone with no reason to read the comment.

**`[SCOPE NARROWED]`, and this is the most uncomfortable one in the pass, because it is the same
shape as the r1–r5 failure rather than merely similar to it.** My evidence is **three named call
sites that omit the field.** The sentence I wrote — and the one shipped in the comment — is *no
in-tree caller populates `CreateCollectionParams.RemoteData` or `UpdateCollectionParams.RemoteData`.*
That is a claim about **every** caller, and it holds only if my enumeration of callers is
exhaustive. **I did not establish exhaustiveness.** I found call sites and checked them; I did not
prove there is no fourth. Evidence about named sites, conclusion about the whole tree — the exact
pattern the instrument read identified.

The narrowed claim is: *the three call sites I found omit the field, and I did not find a fourth.*
The distinction is not pedantic here, because the whole comment rests on this being a reachability
precondition: if a fourth caller exists and sets the field, the line is already armed and the
comment is already false. `[UNCHECKED]` Exhaustiveness of the caller enumeration. Cheap to settle
with a type-directed search rather than a name search, and I am not doing it under the
no-new-work instruction — flagging it as the one place in B1 where a reader could still be misled
by my prose in the same way the old citations misled readers.

The capability consequence is stated in the EM's corrected wording, shipped verbatim, present-tense
and bounded to this tree: a nil makes the `writable` flag unreadable, the dashboard treats
unreadable as not-writable, **today that is indistinguishable from the status quo because no
in-tree writer ever sets the flag, and if anything ever sets it this line silently revokes it.**
`[MEASURED]` for the two reading sites (`capabilities.ts getCapabilities`, `ft-app.ts
isCollectionWritable`) — I verified the EM's line numbers myself rather than taking them.
`[UNCHECKED]` and explicitly out of scope: whether anything out of tree sets it. The comment says
so rather than implying a closed world.

### B2 — `structOrNilLoggingErr`'s doc oversold, and pointed at a symbol that no longer exists

Trimmed per O1. `[MEASURED]` It referenced `remoteDataAssignment`, which B4 deleted; now
`remoteDataWriteSites`. The collection paragraph was made consistent with B1 rather than left to
contradict it.

### B3 — the drop was silent, and the log line was untested while looking tested

Two defects, one cause. `[MEASURED]` Deleting the `log.Printf` from `structOrNilLoggingErr`
outright left the whole suite **green** — that mutant survived r5. The reason is worth keeping:
`TestMapStringStringStaysUnrepresentable_GuardsO1` **causes the line to print**, and a human running
with `-v` sees it. Nothing asserted it. Output a person observes while reading a test run is not
coverage, and it is the most convincing kind of non-coverage there is.

Fix: a sampled logger (`remoteDataLogInterval`, one line per minute, carrying a suppressed count)
plus `unrepresentableKeys`, which names **every** offending key and its Go type rather than the
first one structpb trips over. `[REASONED, NOT MEASURED]` — the reason for reporting all of them is
that an operator who fixes `labels`, redeploys, and finds the field still nil has learned nothing;
`sub_issues` is the second carrier and would be next.

Volume: `[MEASURED]` unsampled, a 50-task passthrough page produced 50 identical lines. Sampled, it
produces 1. `TestRemoteDataDropLogIsSampled` pins exactly that, including the suppressed count
(49 + 1 = 50), because that number is the only evidence of volume that survives sampling.

**`[SCOPE OK]`.** B3's claims are positives — a line is emitted, a count is correct, a representable
map emits nothing. The last of those looks like a negative but is a **controlled** one: it asserts
zero output from a call I made myself, under a pinned clock, with the buffer captured. The scope of
the conclusion and the scope of the evidence are the same single call. This is what a defensible
negative looks like, and it is the useful contrast with B9 and B1 above: **bounded to an event I
caused, not generalised to a tree I searched.**

Positive control: `TestRemoteDataRepresentableMapLogsNothing`. `[REASONED, NOT MEASURED]` Without
it every other assertion in the file still passes if the converter logs on **every** call — a worse
volume defect than the one being fixed.

`[MEASURED]` R6-12 re-ran r5's surviving mutant M2 against the new file: **it now dies.**

### B4 — the write-site scanner was a regex lexer, and it was blind

Replaced `remoteDataIdent`, `maskGoLiterals`, `remoteDataAssignment`, `firstTopLevelSeparator` and
the regex `remoteDataEnclosingFunc` with `go/ast`: `goSource`, `remoteDataSite`,
`isRemoteDataFieldWrite`, `remoteDataWriteSites`, and an AST-based `remoteDataFuncIdent`. The table
became 21 **compilable** `package p` snippets, so the fixture is checked by the parser rather than
by my eye.

A green from a rewritten instrument proves nothing, so liveness was proved with paired mutants, not
argument: `[MEASURED]` R6-4 (mutant → red) and R6-5 (mutant → green only after the rewrite, i.e.
the rewrite actually buys the previously-missed shapes). `[MEASURED]` R6-6 supplied per-row
execution evidence via `-v` test names for the four rows that the old lexer missed — hazard 4.2
requires that a "now caught" row prove it executed, and a row without execution evidence is
unresolved, not resolved.

**`[SCOPE NARROWED]` — the second of the two I nominated, and the narrowing is substantial.** The
evidence is that **four specific shapes**, each written by me as a `package p` snippet, are now
detected where the regex lexer missed them. The conclusion this invites — and which "the scanner is
no longer blind" would assert — is about the **space of write shapes**, not about four points in
it. I measured four points. **The four are shapes I thought of**, which makes them the shapes least
likely to be the blind spot that matters: the enumeration is mine, and a blind spot I could
enumerate is one I had already stopped having. `go/ast` gives a structural argument that the
*class* is covered — the old lexer failed on shapes it could not lex, and a parser does not have
that failure mode — but **that is `[REASONED, NOT MEASURED]`, not a finding, and it is a different
kind of claim from the four rows.** Corrected claim: *these four previously-missed shapes are now
detected, and the instrument is a parser rather than a lexer.* Not: *no write shape is missed.*

Parse failure is `t.Fatalf`, not a skip. `[REASONED, NOT MEASURED]` A scanner that silently treats
an unparseable file as "no sites here" is the exact failure mode of the thing it replaced.

**Disclosure, and it needs to be explicit.** The `"composite literal field"` row's expected `rhs`
changed from `"sanitizeRemoteData(c.RemoteData),"` to `"sanitizeRemoteData(c.RemoteData)"` — the
trailing comma was an artefact of the old line-splitting and is not part of the expression under
`go/ast`. `[DERIVED]` This is an interface consequence of the rewrite, not the hazard-4.1
re-baseline pattern. I am flagging it anyway because "an expected value in a test changed during a
fix" is precisely the shape I was told to stop and report on, and the distinction is mine to
justify rather than yours to assume.

### B6 — count floors replaced with membership

`[MEASURED]` Floors gone; replaced by a duplicate-body check plus a **15-name membership list**.
`[REASONED, NOT MEASURED]` A floor absorbs a deletion whenever a compensating addition lands in the
same run — count-neutral corruption passes it. A named-membership assertion absorbs nothing in
either direction.

O2: scan root widened to `"."`. `[MEASURED]`

**`[SCOPE OK]`** for B6 and B2. Neither carries a negative: B6 replaces a weaker assertion with a
stronger one and the claim is about the assertion's own properties, and B2 is a documentation edit
whose claim is that a symbol reference now resolves. Nothing here says "searched and not found."

### B5 — the ephemeral route pin tested a helper, not a route

`[MEASURED]` The old test exercised the params-copy helper only; it was renamed
`TestTaskToCreateParamsOmitsRemoteData` to say what it actually does, rather than deleted.

New `TestEphemeralGraphRouteDropsRemoteData` drives the real route through `newTestService(t, true)`,
`svc.loadEphemeralStore` and `ephemeralCollectionID`. Two controls included.

`[MEASURED]` R6-14 is the load-bearing measurement: a mutation that the copy-helper test cannot see
is caught by the route test, and the split is clean. Without that, "I added a route-level test"
would be an unfalsified claim about coverage.

**`[SCOPE NARROWED]`, mildly.** The evidence is **one** mutation distinguishing the two tests. The
conclusion that invites is *the route test covers what the helper test cannot* — a claim about the
difference between two coverage sets, from one point in it. Corrected: *one mutation is caught by
the route test and missed by the helper test, which establishes the two are not redundant.* Not
that the route test dominates the helper test.

`[MEASURED]` The fixture uses `[]any`, **not** `[]string` — deliberately, per hazard 4.1. A
`[]string` fixture here would have made the route test pass for the fail-closed reason rather than
for the routing reason, and would have quietly coupled this test to the accident.

### B7 / B9 — C-1's second carrier, and another false reason

`[MEASURED]` `issueNodeJSONWithSubIssues` plus a `withSubIssues` column in the unsafe table (8
rows), with a table guard on both counts so a row silently vanishing is a failure.

`[MEASURED]` R6-10 supplies the execution evidence: a counting probe on the `sub_issues` branch
fired **2** times, so the branch demonstrably ran end-to-end rather than being present-but-dead.

**Instrument error, disclosed rather than quietly replaced.** My first R6-10 probe used `panic`. It
was a bad instrument: it tore down the whole test binary, so all 8 rows died together and the
differential I was trying to measure was destroyed. Switched to a counting
`fmt.Fprintln(os.Stderr, …)`. Recorded in the run log at the point it happened. `[MEASURED]`

B9: the false reason in `TestPassthroughReadDropsUnsafeRemoteURL` corrected, and absence assertions
added looping over both `remote_url` and `html_url`.

**`[SCOPE NARROWED]` — and this is one of the two I nominated as load-bearing.** The evidence is a
loop over **two named keys** (`remote_url`, `html_url`) in the **converted proto struct** for the
rows in **one table**. The conclusion I was reaching for, and which the surrounding prose invited,
was the wider one: *the unsafe URL does not reach the client.* Those are not the same statement. The
narrow one is what I measured; the wide one would also require that no other key carries it, that no
other path converts it, and that nothing downstream reconstructs it — **none of which this
assertion touches.** The corrected claim is: *for these rows, these two keys are absent from the
converted struct.* Anyone wanting the wider claim needs a different instrument, and this test should
not be cited for it.

### B8 — C-1 pinned at the producer, in the producer's own package

New `internal/platform/github/remotedata_representability_test.go`. `[MEASURED]` First `structpb`
import in that package — the producer previously had no test that knew what its output would do
downstream.

`realisticIssueNode(t, withSubIssues)`; `TestIssueBuildRemoteDataIsNotStructpbRepresentable` is a
4-row 2×2 including a **both-carriers-deleted positive control** that must flip to representable —
without it the test passes for any reason at all, including the field being empty.
`TestGitHubBuilderRepresentabilityAsymmetry` (3 subtests) pins the asymmetry between the two
builders.

**`[SCOPE OK]`.** B8 and B10 are positives: they assert that a specific value **is** unrepresentable
and that two builders **do** differ. The 2×2's control asserts a presence (representable when both
carriers are removed), not an absence. No conclusion here reaches past its evidence, because there
is no "not found" in it — which is also why these two were the easiest items in the round, and
worth noting as the contrast case.

Hazard 4.3 was live here and I hit it: `issueBuildRemoteData` (graphql_queries.go, passthrough) and
`buildRemoteData` (github.go, sync) are near-identical names and a name search lands on both. The
test names the passthrough one explicitly.

### B10 — the differential test's scope qualifier overstated, twice

`[MEASURED]` Strengthened with a two-builder table, and a stale claim corrected: the comment
asserted `pt.RemoteData, _ = structpb.NewStruct(…)`, which is not what the code does.

### B11 — the web tree's `remote_data` consumers, pinned as a named allowlist

*(Exempt from provisional marking, by instruction.)*

**What it is.** `internal/webguard`, two tests. `TestWebRemoteDataConsumersAreDeclared` fails when a
mention of `remoteData`/`remote_data` appears in `web/` that is not in the allowlist, **and** when a
declared site disappears. `TestWebRemoteDataCensusIsNonVacuous` fails if the census sees nothing.

**Why it is not a render-sink scanner, which is the whole point.** Three review legs hunted for
places the dashboard *renders* `remote_data`, found none, and were all correct. `[MEASURED]` The
dashboard reads it in two places and never prints, interpolates or binds it — **it branches on it,**
to decide whether writes are allowed. A rendering-keyed search is structurally incapable of finding
a capability sink. So this guard does not enumerate sink kinds, because enumerating sink kinds is
exactly what failed. It keys on the field being mentioned at all.

**The baseline is not zero.** `[MEASURED]` 12 mentions across 6 files: 2 live capability consumers
(`capabilities.ts getCapabilities`, `ft-app.ts isCollectionWritable`), 2 comments, 8 generated
transport code. An absolute-zero pin would have been red on arrival.

**An allowlist of named sites, not a permitted category.** Each site is listed individually with its
reason, generated files included line by line rather than excluded by directory. `[REASONED, NOT
MEASURED]` A category grants the next consumer for free, which is how this one went five rounds
unnoticed. Counts are **exact multiplicities**, not floors — the opposite of what B6 removed
elsewhere.

**Why a census and not a parser,** given the standing ruling against a sixth hand-written scanner.
`[REASONED, NOT MEASURED]` That ruling is right because all five existing scanners tried to
*understand structure* and each got it wrong silently. This does not parse TypeScript, classify
statements, or decide what a line means. It is an occurrence census over two fixed identifiers and
it **over-approximates** — comments, strings, generated code, everything. Over-approximation cannot
produce the failure mode that killed the other five, because there is no shape it can fail to
recognise. Its errors are all in the noisy direction, and noisy fails closed. The cost is written
into the file: it goes red for renames, reworded comments and regenerations, none of which are
security events.

**POSITIVE CONTROL — R6-16, the required red, with the transcript.** `[MEASURED]`

Planted in `web/src/capabilities.ts`:

    const cacheKey = JSON.stringify(collection.remoteData);

Guard went **RED**, naming file, line and text under `UNDECLARED`:

    src/capabilities.ts:99: const cacheKey = JSON.stringify(collection.remoteData);

with the full "work out what it is used for first / do not relax to a category" diagnostic.
Reverted; green again.

**The planted sink was a *serialisation* sink — neither a render sink nor a capability branch, i.e.
a consumption class neither the EM nor I had enumerated — and it was caught anyway.** That is the
property that matters, and it is why the control was planted as an unenumerated class rather than
as one of the two known ones: a control that plants a class you already thought of only proves the
guard implements your taxonomy.

**SECOND CONTROL — R6-17, the other direction, and the more interesting one.** `[MEASURED]`
Replacing the `capabilities.ts` read with dynamic access `(collection as any)['remote'+'Data']`
also goes **RED**, on the stale branch: `want 1 occurrence(s) … found 0`.

This matters more than R6-16. Dynamic property access is a **documented blind spot** of the census —
the mutated line contains neither identifier and is invisible *as a mention*. It is caught as a
**disappearance** instead. `[DERIVED]` The stale-direction assertion is therefore not bookkeeping;
it is the only thing standing between this guard and the evasion an attacker-minded developer would
actually reach for.

**What executes this guard, by name.** `[MEASURED]` `go test ./...` — which is `make test-go`,
which is half of `make test`. That set is real and complete. It is also **not** universal, and §4
below records that I got this wrong in a committed comment before measuring it.

**THIRD MUTANT — R6-21, AND IT FOUND A HOLE IN MY OWN GUARD.** `[MEASURED]` Requested by the EM,
who pre-registered a prediction of GREEN. **The prediction was right.**

Both earlier mutants tested *substitution*. The evasion in its pure form is *addition*: a
dynamically-accessed read planted in a file that currently declares none. Planted in
`web/src/components/ft-collection-list.ts` (zero prior mentions):

    private canWrite(collection: Collection): boolean {
      const rd = (collection as any)['remote' + 'Data'];
      if (rd && rd.writable === true) { return true; }
      return false;
    }

Guard: **`ok` — GREEN.** Corroborating: `grep -c` for both identifiers on the mutated file returns
**0**. No mention added, none removed, so both directions are silent by construction. Reverted;
tree clean. **A live capability consumer of attacker-authored data, doing the same job as the two
declared ones, and my guard does not see it.**

**`[SCOPE NARROWED]` — B11 is not exempt from the scope pass, and it failed it.** I wrote that the
stale-direction assertion is *"the only thing standing between this guard and the evasion someone
would actually reach for."* My evidence was R6-17, a **substitution**. My conclusion was about
**dynamic access as a class**. Wider than the evidence by exactly one case — *addition* — and that
is the case that matters, because substitution is the only variant that makes a declared mention
disappear. Against pure addition the stale check is inert. The limit itself *was* documented in the
guard; what was overstated was the mitigation sitting next to it. Corrected claim: *the
stale-direction assertion defends against dynamic-access **substitution** and does nothing against
dynamic-access **addition**.*

**FOURTH MUTANT — R6-22, THE CELL THAT DECIDED THE ROUND. RED.** `[MEASURED]` The same consumer,
in the same file, written the way a developer would actually type it — plain literal member
access, no string arithmetic, no cast trick:

    const rd = collection.remoteData;

    --- FAIL: TestWebRemoteDataConsumersAreDeclared
        UNDECLARED remote_data MENTION(S) IN THE WEB TREE:
          src/components/ft-collection-list.ts:256: const rd = collection.remoteData;

Reverted; tree clean; green again. **My prediction was RED, pre-registered before the run**, on
the stated mechanism that `strings.Contains` sees the literal identifier and the file has no
allowlist entry.

**The 2×2 is now complete and every cell has execution evidence:**

| | file WITH declared entries | file with NONE |
|---|---|---|
| **literal spelling** | RED — R6-16, serialisation sink | **RED — R6-22** |
| **computed spelling** | RED as disappearance — R6-17 | GREEN — R6-21 |

**THE GUARD'S TRUE PROPERTY, measured rather than asserted: it catches the ACCIDENTAL addition
and is blind to the DELIBERATE one.** A developer adding a consumer normally is stopped by name at
the line. Someone who deliberately spells the field by concatenation to evade the census is not.
`[DERIVED]` That is the strongest property this kind of check can have without a TypeScript parse,
and it is worth shipping: the threat model that matters is the unwitting sixth consumer, not an
adversary with commit rights who is already inside every other boundary in this system.

**Why R6-16 did not already settle it, and why I should not have implied it did.** R6-16 landed in
`capabilities.ts`, which *already carries allowlist entries*. A file with none is a different path
through the undeclared check. Treating one as covering the other is the same scope drift this
round is about — a third instance, caught by the EM rather than by me.

**Stated limits, in the file rather than left to be discovered:** aliasing (uses of `rd` after
`const rd = coll.remoteData` are invisible), dynamic access, anything outside `web/`, and skipped
build directories. `[DERIVED]` The guard bounds where the field is **reached**, not where the value
**flows** — weaker than taint tracking, stronger than nothing, and the strongest thing checkable
without a TypeScript parse. R6-21 shows the dynamic-access limit is not theoretical: **it is
exploitable in four lines by anyone who reads the guard's own comment block.**

The ruling that `remote_data` is a security boundary is recorded in the file as **RULED, NOT
MEASURED** — a policy call, not a finding. The stated reason is *not* an empty sink set (it is not
empty) but that the bytes are attacker-authored and the sink set is open and unowned.

---

## 3. Hazards, as they actually played out

**Hazard 4.1 — the fail-closed accident.** Not triggered, and I want to be precise about why rather
than claim vigilance. `[MEASURED]` I did not normalise `[]string` to `[]any` in the sanitizer. I
never edited an expected number to make a test pass. The one place the temptation was real was B5's
fixture, where a `[]string` would have made the new route test pass — for the wrong reason. It uses
`[]any`, so the route test measures routing and the fail-closed accident stays measured where it is
measured. The red is the alarm, not the bug, and it is still armed.

**Hazard 4.2 — execution evidence for survived rows.** Honoured throughout. R6-6 (`-v` names),
R6-10 (2 probe hits), R6-12 (M2 dies), R6-14 (clean split), R6-16/R6-17 (both red directions).
`[MEASURED]` No row in this report is called resolved on the strength of a green alone.

**Hazard 4.3 — the near-identical builder names.** Hit, as predicted, and handled by naming the
passthrough builder explicitly in B8.

**Hazard 4.4 / B11 constraint 1 — no sixth hand-written scanner.** Honoured in both directions: B4
*removed* a hand-rolled Go lexer in favour of `go/ast`, and B11 declined to hand-roll a TypeScript
one. Net scanner count went **down**.

**The build fence.** `[MEASURED]` Held. Every run was `go test ./internal/<pkg>/ -run '^…' -count=1`,
each pre-registered in `_run-queue-log.md` before execution with ROOT and DIST populated, including
the runs I expected to pass. **No wide run was performed. The token is unspent.** §5 records what
that leaves unverified.

**zsh, not bash.** One live hit: `grep -rn 'loadEphemeralStore' --include=*.go .` died with `no
matches found: --include=*.go`, which briefly looked like evidence that `loadEphemeralStore` did not
exist. Quoted retry found it at `graph_routing.go:58`. `[MEASURED]` Worth recording because the
failure mode is a **fatal expansion error masquerading as a negative search result** — the same
false-negative shape this entire round is about, arriving through the shell instead of through an
instrument.

---

## 4. WHERE MY BRIEF WAS WRONG

**1. B11's central fact, and I am not the one who caught it.** The brief said "the reference count
in the web tree is, I believe, zero." `[MEASURED]` **False: 12 mentions, 2 live consumers.** The EM
caught this mid-flight and corrected it. Had I built to the brief as written, I would have shipped
an absolute-zero pin that was red the moment it ran, and the natural repair — relaxing it to
"web may read collection `remote_data`" — is precisely the category grant that lets consumer number
three in for free. **The wrong version of this guard was more dangerous than no guard**, because it
would have been relaxed rather than removed.

**2. I reproduced the exact defect I was sent to fix, in the same round, while fixing it.**
`[MEASURED]` `7cee4a6`'s `doc.go` claimed this package "buys it the one runner that is invoked by
every build, every CI job and every developer reflex in this project." Two thirds false: **there are
no CI jobs** (`.github` holds `ISSUE_TEMPLATE` and `PULL_REQUEST_TEMPLATE.md`, no workflows
directory) and **the image builds do not run it** (`Dockerfile:9` and `Dockerfile.server:9` are each
`RUN npm test`; neither runs `go test`).

B1, B2, B9 and B10 are all "a comment states a reason that is not true." I wrote a fresh one **in
the confident register that makes such prose survive review** — which is the actual mechanism, and I
now have first-hand evidence for it rather than a theory about other people. Corrected in `2f62f63`
as a separate commit rather than an amend, deliberately: the amend would have hidden the only
evidence in this branch that the defect class is not somebody else's.

The corrected version also drops a neighbouring claim — that this repo "already has a guard whose
executor is no path at all" — because **I did not independently measure it.** It may well be true. I
did not check it, so it is gone rather than restated.

**3. The brief framed placement as a straightforward win; it is a two-sided trade.** `[DERIVED]`
"It must be run by something that actually runs" is right, but there is no location in this
repository that satisfies it universally. A guard in `web/` is enforced by both image builds and
invisible to a Go-only workflow — CLAUDE.md warns about that case **by name**, telling agents not to
substitute a bare `go test ./...` because the URL-scheme guards in `web/src/util` are executed only
by `npm test`. A guard in Go is the mirror image. I chose Go because the person this guard needs to
stop is a Go developer changing `remote_data`'s server-side shape, and `go test ./...` is that
person's reflex. **That is a judgement about who trips the wire, not a safety ranking**, and if the
EM wants image-build enforcement the answer is a second copy in `web/`, not a move.

**5. I asserted the wrong mechanism for the r1–r5 failures, confidently, in three places.** I wrote
that a rendering-keyed search is *structurally incapable* of finding a branched-on consumer. The
instrument read measured otherwise: **it found one eleven times, from round one.** `[MEASURED]` by
the instrument-read leg, not by me. The real mechanism is scope drift inside a single document — a
negative's conclusion written wider than its own evidence. My version was more flattering to the
reviewers and more damning of the tooling, and it was wrong in both directions. It is baked into the
B11 guard's header comment, which I have not rewritten under the no-new-work instruction; **that
comment currently overstates the case and should be corrected when the guard is next touched.**

**6. And I committed the real defect while describing it.** R6-21, above. I claimed the
stale-direction assertion was "the only thing standing between this guard and the evasion someone
would actually reach for" on the strength of a **substitution** mutant, and the claim was about
dynamic access **as a class**. The pure-addition case walks straight through. That is the *second*
time in this round I generalised past my evidence — the first was the executor claim in §4 item 2 —
and both were in prose about my own work rather than about somebody else's code. `[MEASURED]` The
EM predicted the green before I ran it, which is the part I should have predicted myself.

**7. Where I did not follow the brief.** One place. The brief said to cite by content rather than
line number except in B1. In B1's own comment, and in item 2 above, I cite `Dockerfile:9`,
`entstore.go:1366` and similar as numbers. `[REASONED, NOT MEASURED]` In both cases the number *is*
the evidence — B1's whole finding is that a wrong line number resolved to a plausible wrong thing,
and "the Dockerfile runs npm test somewhere" is not checkable at a glance the way a line is.
Content-only citation would have made those two claims weaker to verify, so I did not obey it there.

---

## 5. WHAT I DID NOT CHECK

**1. Anything wider than a single test.** ~~`[UNCHECKED]`~~ **RESOLVED — the EM granted the token
and R6-19 spent it.** `go test ./... -count=1` at HEAD `b330096`: **EXIT 0, zero failures, zero
build errors, 11 test packages green plus 22 reporting `[no test files]` (which still compiled).**
`[MEASURED]` The risk I flagged here — cross-package compilation, after adding `fmt`, `sort`,
`strings`, `sync`, `structpb` into a package that had never imported it, plus a whole new package —
**was not real.** Compilation of packages I did not touch is now `[MEASURED]`, not `[DERIVED]`.

The pre-registered baseline was **falsified in the safe direction** and that deserves care rather
than celebration: I predicted reds from the EM's known set and got none. `TestListUsers` and
`TestWatchTasks_NoInitial` both ran and passed (R6-20, named `--- PASS` evidence). `[MEASURED]`
**I am not claiming they are fixed.** Five flakes at ~4.5% each gives P(≥1 spurious red) ≈ 20.6%,
so a clean run is the ~79% outcome and is weak evidence about flakiness. Nothing here speaks to
`main`, which I never ran.

**2. The web suite.** `[UNCHECKED]`, and now for a *measured* reason rather than an untested one:
**`web/node_modules` is absent in this container**, so `make test-web` (`cd web && npm test`) cannot
execute at all. `[MEASURED]` This is why the token bought the Go half only — `make test` would have
spent the grant on a guaranteed dependency-missing error. B11 adds no TypeScript; R6-16 and R6-17
edited `capabilities.ts` and reverted it, and `git diff d305391..HEAD -- web/` is **empty**, so the
reverts are `[MEASURED]` complete at the file level. That the web suite still passes remains
`[UNCHECKED]` and is not checkable from this container.

**3. Whether the negatives under B1–B10 are real.** This is the big one and it is why the
provisional marking exists. Every "searched and not found" sentence in §2 rests on an instrument
from the family currently under audit — and at least one member of that family was keyed on
rendering, which is structurally blind to the capability sink that B11 turned out to be about.
`[UNCHECKED]` **I did not re-derive any of them**, per instruction. If the instrument read comes
back badly, the items to re-open first are **B9's absence assertions** and **B4's four
previously-missed rows**, because those are the two places where a negative is doing the most work.

**4. Out-of-tree writers of `CreateCollectionParams.RemoteData` / `UpdateCollectionParams.RemoteData`.**
`[UNCHECKED]` B1's claim is bounded to this tree and says so in the comment.

**5. The nine GitHub write operations behind the unset `writable` flag.** `[UNCHECKED]`, routed to
the audit leg, and **not touched** — not resolved in a comment, not described as working, not
described as broken. B1 describes only the line in front of it.

**6. `docs/url-policy.md`.** `[MEASURED]` `ft-inspector-desc.ts` cites a file that does not exist.
Flagged as trivial-and-allowed; **I left it.** `[REASONED, NOT MEASURED]` It is a dangling doc
reference in a file otherwise untouched by this round, and adding an unrelated diff to a branch
under adversarial review costs more review attention than it saves.

**7. Depth-accounting divergence, CSP, `markdown.ts`, DOMPurify config, the server-side `writable`
gate, and `export_import.go`'s `map[string]string` normalisation.** `[UNCHECKED]` All declared out
of scope; none touched. The `export_import.go` one is the notable restraint — it is the same
unrepresentable-type shape as C-1 and it was tempting.

**8. THE DELIBERATE-EVASION HOLE IN B11 IS OPEN AND UNFIXED.** `[MEASURED]` by R6-21. A
dynamically-accessed read added to a file with no prior mention is invisible to the census.
Bounded by R6-22: the *literal* addition in the same file goes RED, so the guard's property is
**catches the accidental addition, blind to the deliberate one** — not "detects only removals and
renames", which was the live alternative until that cell was run. Not fixed, per the no-new-work
instruction. `[REASONED, NOT MEASURED]` The honest options are a TypeScript parse (which the
no-sixth-scanner ruling exists to prevent) or moving the check to where the value is *received*
rather than where it is *named*; I have not designed either and am not claiming one would work.

**9. Exhaustiveness of B1's caller enumeration.** `[UNCHECKED]`, newly flagged by the scope pass —
see B1 above. Three call sites found and checked; no proof there is no fourth.

**10. Whether the B11 allowlist's 8 entries are each individually *correct* about why their site is
allowed.** `[MEASURED]` that all 12 mentions are covered and the counts are exact. `[REASONED, NOT
MEASURED]` that each `reason` string accurately characterises its site. Given §4 item 2, I would
rather flag my own prose as unverified than assert it twice in one round.

---

## 6. Termination state

- Commits: 9, on `url-scheme-validation-r6`, HEAD `b330096`. `[MEASURED]` — branch confirmed with
  `git rev-parse --abbrev-ref HEAD` before every commit; it never read `url-scheme-validation-r5`.
- **Nothing pushed. No push was attempted.** `[MEASURED]`
- Project log: `.design/project-log/2026-07-29-dev-xss-r6.md`, in-tree and committed.
- This report: scratch volume only, never `git add`ed. `reports/` is not in the repository.
- Build token: **granted and spent, once**, on R6-19 — `go test ./... -count=1`, **EXIT 0, fully
  green**. Baseline pre-registered before execution per instruction. Follow-up R6-20 was a targeted
  single-test run, which the grant exempts and which did not consume the token. `[MEASURED]`
- The one green does **not** retire the flake set, and the targeted `TestListUsers` pass is close to
  vacuous — a `-run` filter runs it alone, which removes the cross-test row visibility that causes
  it to fail. The full-suite green is the load-bearing observation for that test; the targeted run
  proves only that it executed rather than being filtered away.
