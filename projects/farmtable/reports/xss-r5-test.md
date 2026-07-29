# XSS R5 — TEST REVIEW LEG

**Working tree: `/workspace/farmtable-xss-r5-test`, a fresh `git clone --no-hardlinks` of
`/workspace/farmtable-dev-xss-r5`. `git rev-parse HEAD` = `d305391ee6dc473f5e7bf202167221e15cf52e10`.
`git rev-list --count e6bda71..HEAD` = 13.** Nothing was written to the author's worktree; the
`url-scheme-validation-r5` ref still points at `d305391` (verified after I branched). My scratch
path did not exist when I was dispatched and contained no other agent's files.

**ROOT** = `/workspace/farmtable-xss-r5-test` · **DIST** = **ABSENT** (fresh clone; `git clone` does
not carry untracked/gitignored paths, so I did *not* inherit canonical's stale `web/dist`).
`assets.go`'s `//go:embed all:web/dist` is in the **root** package, which `internal/server` does not
import, so my single-package runs are unaffected. I attempted no full build and requested no token.

---

## VERDICT: **REQUEST CHANGES**

Not because the code is wrong. **I found no unsanitized path and no live XSS**, and the round's
headline property — recursion at every depth — is genuinely, measurably pinned. I am blocking on
three places where **this round asserts a property in prose that no instrument enforces**, one of
which is a factually false citation shipped in the same diff that repaired a different false
citation.

**8 mutants. 8 predictions pre-registered before running. 8/8 correct. 4 survived, 4 died.**

---

## 1. BASELINE — ESTABLISHED, NOT INHERITED

The brief warns that `main` is RED and that a local green is not a green against a healthy
baseline. I did not attempt to interpret anyone else's green. My baseline is narrow and stated:

- **T-R1** `[MEASURED]`: the 10 tests this round touches, at unmutated `d305391`, in
  `./internal/server/`: **10 PASS.**
- **T-R7b** `[MEASURED]`: identical alternation with `-shuffle=on`: **PASS.**

**What that baseline does and does not cover.** It covers ten named tests in one package. It says
nothing about `main`, nothing about the other ~500 tests in this package, and nothing about the web
suite (`npm test`), which `agents.md` states is the only executor of the client-side half of this
very security property. **Every "green" in this report means those ten tests, in that package, at
that SHA, from that ROOT.**

**On order dependence** `[MEASURED, bounded]`: the brief warns 165 tests can observe another test's
rows and 40 assert counts over shared state. Of the ten tests I ran, nine are pure functions over
literals or over source text read from disk, and the tenth
(`TestEphemeralGraphRouteDropsRemoteData`) constructs its **own** `store.NewEphemeralStorePool(1)`
and closes it. **None of them touch shared mutable state, so my greens are not a property of test
ordering.** The `-shuffle=on` run is corroboration, not proof — a shuffle that passes has not
demonstrated independence, it has merely failed to demonstrate dependence. The structural argument
above is the actual basis for the claim.

**I met none of the five `len < 1` floors.** `[MEASURED]` — `grep -rn 'len(...) < 1'` over
`internal/server/**/*_test.go` returned nothing, and none of the four files this diff touches
contains one. Wherever those five live, they are not in scope here.

---

## 2. PRE-REGISTERED FALSIFIERS AND THEIR OUTCOMES

Written down before I looked, per the brief. **Reported whichever way they came out.**

### F1 — "The two structpb carriers are pinned by hand-written literals, not by the builder."
**Refutation condition:** any test, anywhere in the tree, that calls `issueBuildRemoteData` or
`issueLabels` and asserts on the *type* of what comes out. **If refuted:** withdraw the finding and
report it as a negative result. **Search space stated:** `grep -rn` for both identifiers across
**every `.go` file in the repository**, not just `internal/server`.

**OUTCOME: NOT REFUTED.** `[MEASURED]` Both identifiers appear in test files **only inside comment
text**. The one non-comment occurrence is the string literal `"issueBuildRemoteData"` in
`remoteDataBuilderFuncs`, which is a *name* fed to an AST key-extractor — it reads the function's
map keys, never its value types. `internal/platform/github` has seven test files and none call the
builder.

### F2 — "The new log statement has no instrument."
**Refutation condition:** any test in `internal/` that redirects or captures `log` output.
**If refuted:** withdraw. **Search space:** `grep -rn 'log.SetOutput\|SetOutput('` across
`internal/`.

**OUTCOME: NOT REFUTED.** `[MEASURED]` Zero matches in the entire `internal/` tree.

### F3 — "The round's headline recursion property might be as unpinned as the carriers are."
**Refutation condition:** removing the `map[string]any` recursion arm from `sanitizeRemoteValue`
leaves the suite green. **If refuted (i.e. tests go red):** report it as a negative result and say
so plainly, because it is the single most load-bearing thing in the round and a reader deserves to
know it holds.

**OUTCOME: REFUTED — AND THIS IS THE MOST IMPORTANT RESULT IN MY REPORT.** `[MEASURED]` M8 killed
**four** tests. **The recursion is properly pinned.** I had a story forming about "prose everywhere,
instruments nowhere," and F3 is the result that stops that story from being told about the part of
the round that actually matters. The author did the hard half correctly. My blocking findings are
about the periphery, and I want that asymmetry on the record rather than flattened into a verdict.

---

## 3. THE CENTRAL DELIVERABLE — FOR EVERY PROPERTY, WHAT GOES RED?

| # | Property this round asserts | Instrument that goes red | Status |
|---|---|---|---|
| 1 | `sanitizeRemoteData` recurses to every depth | `TestSanitizeRemoteDataRecursesThroughEveryCarrier`, `TestNestedURLReachesTheWireWithoutRecursion`, `TestSanitizeAndImportAgreeAtEveryDepth`, `TestSanitizeRemoteDataStopsAtTheDepthBound` | **PINNED** (M8 killed 4) |
| 2 | The sanitizer is *wired in* on both wire paths | `TestTaskToProtoScrubsRemoteDataURLCarriers` + 3 others | **PINNED** (M6 killed 4) |
| 3 | Write-site membership, per direction, by name | `TestScannedServerPackageRemoteDataWriteSitesSanitize` | **PINNED** (M9 died naming `taskToProto` / OUTBOUND) |
| 4 | RemoteData does not travel the ephemeral graph route | `TestEphemeralGraphRouteDropsRemoteData` | **PINNED** (M5 died, correct message) |
| 5 | `map[string]string` stays unrepresentable (O1 mask) | `TestMapStringStringStaysUnrepresentable_GuardsO1` | PINNED `[REASONED, NOT MUTATED]` |
| 6 | **`labels` is an unconditional structpb carrier** | **NOTHING** | **UNPINNED — B-1** |
| 7 | **`sub_issues` is the second carrier** | **NOTHING** | **UNPINNED — B-1** |
| 8 | **The discarded structpb error is now audible** | **NOTHING** | **UNPINNED — B-2** |
| 9 | **The six shapes the old regex could not see stay covered** | count floor only, with slack | **UNPINNED — B-3** |
| 10 | Collection log is unreachable today | nothing, and the stated reason is false | **B-4** |

---

## 4. BLOCKING FINDINGS

### B-1 `[PASS-1]` `[MEASURED]` — THE CARRIER PINS DO NOT TOUCH THE BUILDER. BOTH CARRIERS ARE FREE TO DISAPPEAR SILENTLY.

> ## ⚠ **SUPERSEDED — SEE AMENDMENT A-2 AT THE END OF THIS FILE. DO NOT ACT ON THIS SECTION.**
> **The measurement below is correct. The conclusion drawn from it is WRONG and was withdrawn as a
> blocker at 05:30Z after the eng-manager challenged it and I re-measured.**
> `TestPassthroughReadDropsUnsafeRemoteURL` — which my `-run` filter excluded — executes
> `issueBuildRemoteData` at runtime and **goes red ×6 under M1.** The `labels` carrier IS pinned.
> The claim "the payload reaches the browser" below is **also wrong**: under M1 the sanitizer
> strips `remote_url` and `html_url` end-to-end. Text kept verbatim for the record.

`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` carries ~45 lines of doc comment
establishing that `issueBuildRemoteData` sets `"labels"` unconditionally in its map literal, that
`issueLabels` returns a never-nil `make([]string, ...)`, and that `sub_issues` is
`[]map[string]any`. It then asserts none of that. Every assertion in the body is over a
**hand-written literal**:

```
labels := []string{"bug"}                                    // not issueLabels(...)
subIssues := []map[string]any{{"number": 7, ...}}            // "shape copied from" the builder
```

The test measures `structpb.NewStruct`'s behaviour on literals the test itself wrote. **It is a test
of the protobuf library.** The connection to `issueBuildRemoteData` exists only in prose.

**MUTANT M1 — measured, survived.** I deleted `"labels": issueLabels(issue),` from
`internal/platform/github/graphql_queries.go`:

- `go test ./internal/server/ -run '<10-way>' -count=1` → **`ok`. GREEN.**
- `go test ./internal/platform/github/ -run '.' -count=1` → **`ok`. GREEN.**

The second run matters: after M1 survived `internal/server` I could have reported the carrier as
unpinned on a search space of one package. I widened it to the package that **owns** the builder,
and used `-run '.'` rather than my own guess at a test name — my first attempt,
`-run '^TestIssueBuildRemoteData$'`, returned *"no tests to run"*, which is **not** the same
result and would have been a weaker claim dressed as a stronger one.

`internal/server`'s test binary **does** import `internal/platform/github` (`passthrough_e2e_test.go`),
so M1 was inside the compilation closure and genuinely exercised. This is not a "the test didn't
recompile" artefact.

**Why this is blocking and not a nitpick.** With `labels` gone, `sub_issues` is only written
`if len(issue.SubIssues.Nodes) > 0`. For the ordinary case — a GitHub issue with no sub-issues —
**every remaining value in the map is a string or an int, `structpb.NewStruct` succeeds, and
passthrough `remote_data` starts reaching the browser.** That is precisely the outcome the test's
own name says cannot happen, and the suite stays green through it. This is Section 4 item 4's
failure mode exactly: the knowledge is in the artefact, the enforcement is nowhere.

**Fix:** one assertion calling the real builder —
`if _, err := structpb.NewStruct(issueBuildRemoteData(...)); err == nil { t.Fatal(...) }`. It needs
an `issueNode` fixture and it may belong in `internal/platform/github`. The two hand-literal
assertions are still worth keeping as the *mechanism* half; what is missing is the *reachability*
half that joins mechanism to the actual writer.

### B-2 `[PASS-1]` `[MEASURED]` — COMMIT `6ee08bf` SHIPS A LOG LINE WITH NO INSTRUMENT.

The round's stated deliverable for `structOrNilLoggingErr` is *"The only new thing is that it is
audible."* Nothing asserts audibility.

**MUTANT M2 — measured, survived.** I replaced the `log.Printf` body with `_ = field` (and dropped
the now-unused `"log"` import). **10-way run → `ok`. GREEN.** The commit's entire behavioural
delta can be reverted and the suite does not notice.

The sharpest evidence is in my own baseline output. `TestMapStringStringStaysUnrepresentable_GuardsO1`
**prints the log line**:

```
2026/07/29 05:05:30 task.remote_data dropped: sanitized remote_data is not structpb-representable: proto: invalid type: map[string]string
```

The one test that reaches the log **already triggers it and already has it in its output stream, and
does not look at it.** The instrument is one `log.SetOutput(&buf)` and one `strings.Contains` away.

The doc comment also carries a conditional maintenance instruction — *"If representability
normalisation is ever added to the sanitizer, THIS MESSAGE MUST CHANGE"* — which nothing can
enforce, because nothing reads the message.

### B-3 `[PASS-2]` `[MEASURED]` — THE NEW ANTI-VACUITY GUARDS REPRODUCE, IN THIS DIFF, THE EXACT DEFECT THIS DIFF SPENDS 40 LINES MEMORIALISING.

Tagging this **PASS-2**: §4.5 primed me for count pins. The *slack measurement* below is mine and is
not in the brief, but I will not claim independent discovery of the class.

`internalServerRemoteDataWriteRegistry`'s comment is an extended, genuinely excellent post-mortem of
a floor of 4 against a population of 6 — *"THE MARGIN ABSORBED THE LOSS EXACTLY... WE WERE SAVED
FROM NOTHING; WE WERE MISSED BY A UNIT."* Two hundred lines later, the same file adds:

| Assertion | Population | Floor | **Slack** |
|---|---|---|---|
| `if starred < 5` | 6 | 5 | **1** |
| `if sites < 6` | 8 | 6 | **2** |
| `if rejects < 5` | 7 | 5 | **2** |
| `if yes < 2` | 2 | 2 | 0 |
| `if no < 3` | 5 | 3 | **2** |
| `if changed < 5 \|\| unchanged < 3` | (not counted) | 5 / 3 | `[UNCHECKED]` |

**MUTANT M3 — measured, survived.** Deleted the `"* index target"` row (6 starred → 5).
`TestRemoteDataAssignmentSeesEveryShape` → **`ok`. GREEN.** The floor absorbed it, by one unit, in
the same file that says being missed by one unit is what happened last time.

**MUTANT M4 — measured, survived. This is the count-neutral one the brief asked for.** I did not
delete the `"* index target"` row; I **replaced its body with a duplicate of the `"* selector
target"` row**, leaving the name intact. Starred count unchanged at 6. Site and reject counts
unchanged. **→ `ok`. GREEN.**

So the *index-target shape* — one of the six shapes that motivated the entire scanner rewrite,
listed in the doc comment as a regression test for the blinding — **can be removed from the table
entirely, with the guard that exists to prevent exactly that staying green.** A guard fixed at five
suites is green when one of the five is swapped for something else; here it is a guard fixed at five
shapes, and I swapped one.

**What membership would catch that the count cannot:** assert the *set* of starred row names, or
better, assert that each starred `line` is distinct and that each produces a distinct
`(rhs, ok)` outcome path. A `map[string]bool` of required shape names — `"index target"`,
`"selector target"`, `"comma-ok target"`, `"blank second target"`, `"named error target"`,
`"short declaration"` — costs six lines and cannot be traded off. The file already knows this: it
argues it at length for the registry and then does not apply it one screen up.

### B-4 `[PASS-2]` `[MEASURED]` — A NEW FALSE CITATION SHIPPED IN THE SAME DIFF THAT REPAIRED THE OLD ONE.

§4.2 told me there may be more reason strings of the `metadata` shape. There is one, and it is
**new in this round**, in `collectionToProto`:

> *"Every writer of `Collection.RemoteData` feeds it a value that was decoded from JSON or from a
> structpb request (entstore.go:408, :898, :2117)"*

Resolved at `d305391` `[MEASURED]`:

| Cited | Enclosing function | Is it a Collection writer? |
|---|---|---|
| `entstore.go:408` | `(*EntStore).CreateTask` | **NO — task** |
| `entstore.go:898` | `(*EntStore).doUpdateTask` | **NO — task** |
| `entstore.go:2117` | `(*EntStore).ImportCollection` | yes |

The actual `Collection.RemoteData` writers are **`CreateCollection` (:1366)**, **`UpdateCollection`
(:1399)** and `ImportCollection` (:2117). **The citation names two task functions and omits both
dedicated collection constructors.**

**This is not line rot.** `internal/store/entstore.go` is **not in this diff** (`git diff
--name-only e6bda71..HEAD` lists seven files and that is not one of them), so the file is byte-identical
at `e6bda71` and `d305391`. The citations were wrong when they were written.

**The conclusion survives; only the evidence is false.** `[MEASURED]` The three callers of those
param structs — `server.go:1057`, `server.go:1085`, `graph_routing.go:83` — set no `RemoteData`
field, so nothing currently hands a collection a native Go map and the log line indeed cannot fire.
**That is exactly what makes it worth blocking on.** A correct-sounding justification is what stops
a careful reader looking further, and this one points the next reader at `CreateTask` when the
functions that would actually arm the line are the two the citation leaves out. The comment is the
sole reason there is no test on the collection half; it needs to be the *right* reason.

**Also:** the brief's own §1 says *"CITE BY CONTENT, NEVER BY LINE NUMBER — A LINE NUMBER IS A
POINTER INTO MUTABLE STATE."* This diff adds roughly a dozen new `file.go:NNN` citations
(`beads.go:421`, `graphql_queries.go:476-518`, `urlvalidate.go:316`, `ent/migrate/schema.go:87`,
`urlvalidate_rpc_test.go:102`, the three above). One of the new comments even articulates the rule —
*"THE BRANCH IS NOT AN IDENTIFIER; THE SHA IS, AND EVERY file:line CARRIES ITS SHA"* — and then the
adjacent comment cites three bare line numbers with no SHA. I resolved one such citation set and
two-thirds of it was wrong. **I did not resolve the other nine.**

---

## 5. MUTATION LOG — ALL EIGHT, WITH CHECKSUM-VERIFIED RESTORE

Baseline `md5sum` of all seven touched files taken **before** the first mutation
(`/tmp/xss-r5-test-baseline.md5`). Every mutant restored via `git checkout --` and verified.

| # | Mutation | Predicted | **Observed** | ✓ |
|---|---|---|---|---|
| M1 | remove `"labels"` from `issueBuildRemoteData` | survive | **SURVIVED** (both packages) | ✓ |
| M2 | remove `log.Printf` from `structOrNilLoggingErr` | survive | **SURVIVED** | ✓ |
| M3 | delete one `*`-starred table row | survive | **SURVIVED** | ✓ |
| M4 | count-neutral: swap a starred row for a duplicate | survive | **SURVIVED** | ✓ |
| M5 | `taskToCreateParams` assigns `RemoteData` | **die** | **DIED**, correct message | ✓ |
| M6 | `sanitizeRemoteData` → `return rd` | **die** | **DIED** ×4 | ✓ |
| M8 | remove `map[string]any` recursion arm | **die** | **DIED** ×4 | ✓ |
| M9 | behaviour-preserving extraction out of `taskToProto` | **die** | **DIED**, named `taskToProto` + OUTBOUND | ✓ |

**Final state `[MEASURED]`:** `git status --porcelain` empty, `git diff --stat` empty,
`md5sum -c` → all 7 **OK**, `url-scheme-validation-r5` still at `d305391`.

**On the author's three mutants.** The run-queue log records Mutants A/B/C against
`TestEphemeralGraphRouteDropsRemoteData`. **I independently reproduced Mutant A as my M5 and it
died with the message the test claims it will produce.** I did not take that on trust and I did not
stop at three. M9 and M8 are additional kills the author did not claim; M1–M4 are survivors the
author did not look for.

**M5 deserves explicit credit.** `TestEphemeralGraphRouteDropsRemoteData` is the best test in this
diff. It drives real code, has two controls that could genuinely have failed, pins the **value** and
not the spelling of an absent line, and its failure message tells the next maintainer not to "fix"
it. Section 4 item 1 told me to assume there is another persistence path and go look; **this test is
the author converting exactly that lesson into an instrument**, and it works.

---

## 6. NON-BLOCKING OBSERVATIONS

- **O-1 `[PASS-1]` `[MEASURED]` — M9's other half.** M9 was a *behaviour-preserving* refactor and the
  scanner failed it. That is correct fail-closed behaviour and I am not asking for a change. Record
  it as a known maintenance cost: any future extraction of the wire-path write, however safe, trips
  the guard, and the failure text says "Do not delete the expectation to make this pass" — which is
  right, but the person hitting it will be doing something legitimate.
- **O-2 `[PASS-1]` `[MEASURED]` — the "six `SetRemoteData` in entstore.go" claim is correct.** I
  counted them (`:408, :898, :1366, :1399, :2117, :2190`) and confirm six. Stated because I checked
  it expecting to find a seventh and did not — a negative result on a number I was ready to dispute.
- **O-3 `[PASS-2]` — the scanner does not read `_test.go` and the author knows.** Confirmed at the
  `strings.HasSuffix(name, "_test.go")` skip. Consistent with the brief; I add nothing. **I
  therefore treated its silence about everything in section 4 as NOT SCANNED, and none of my
  findings above rest on it.**
- **O-4 `[PASS-1]` — `if yes < 2` has zero slack** and is the one count floor in the diff that is
  currently exact. It will acquire slack the moment anyone adds an accept row. The fix in B-3
  applies here too.

---

## 7. WHERE MY BRIEF WAS WRONG

**7.1 — THE DISPATCH AND THE BRIEF GAVE CONTRADICTORY ORDERS, AND I OBEYED THE WRONG ONE.**

My dispatch message opened: *"READ THE BRIEF FIRST AND IN FULL."* The brief's §1 says:
*"PASS 1 — OPEN AND UNSCOPED. DO NOT READ SECTION 4 UNTIL YOU HAVE FINISHED IT."*

**These cannot both be obeyed.** Reading the brief in full *is* reading §4. I obeyed the dispatch —
it arrived as the operative instruction and it was emphatic — and so **I read the six disclosed
weaknesses before I had looked at a single line of the diff.**

**This damaged the deliverable in the specific way you designed the tags to detect, and you should
discount my attribution accordingly.** I have tagged honestly rather than flatteringly: B-3 and B-4
are marked `[PASS-2]` because §4.5 and §4.2 named those classes, even though I measured the
instances myself and the measurements are mine. Had I run Pass 1 clean I might have found them
independently — but I cannot know that now, and claiming it would be exactly the retrieval-dressed-
as-confirmation you are trying to eliminate. B-1 and B-2 I have tagged `[PASS-1]`: they came from
reading the diff and asking "what goes red," and although §4.4 primed the *question*, the specific
instruments — the builder never being called, the log never being captured — are findings I
generated and then falsified rather than classes I was handed. **That distinction is softer than the
tag system implies, and you should treat my PASS-1/PASS-2 split as lower-confidence than a leg who
got a clean Pass 1.**

Per your own correction message: an instruction that cannot be obeyed is a finding about the
instruction. **Fix: the dispatch template should say "READ SECTIONS 0–3 IN FULL AND STOP."**

**7.2 — `${PIPESTATUS[0]}` guidance was right but I did not need it, and the `grep`-is-ugrep warning
cost me one run.** §2 says `grep` is ugrep. My first census used `grep -n '^\+func\|^-func'`, which
ugrep rejected with *"error at position 5: invalid syntax"* on the `^+` alternation. Not wrong in the
brief — correctly warned — but worth noting that the failure is a hard error, not a silent empty
result, which is the safe direction and worked as advertised.

**7.3 — The brief said "five assertions are floors of the form `len < 1`". Not in this scope.**
`[MEASURED]` Zero such assertions exist in `internal/server/**/*_test.go`, and none in the four test
files this diff touches. The floors that *do* exist here are `< 5`, `< 6`, `< 3`, `< 2`. I flag this
because I was told "if you meet one, it is not evidence" — **I met none, so I never had to apply the
rule, and a leg searching for the literal string `< 1` will report a clean result that means
nothing.** The warning is probably about a different package.

**7.4 — Not wrong, but load-bearing and worth confirming: "plan your work so the token is the LAST
thing you need."** I followed this and **never needed the token at all.** Every finding in this
report came from single-package `-run`-filtered runs. Three legs queuing serially on one token, and
at least one of them (me) had no use for it. Consider telling the test leg up front that mutation
work is token-free by construction.

---

## 8. WHAT I DID NOT CHECK

Stated as gaps, not hedged into claims.

1. **`npm test` / the entire web half.** `[UNCHECKED]` `agents.md` states
   `web/src/util/url-binding-scan.test.ts` and `safe-url.test.ts` are the client-side half of this
   security property and that `npm test` is their only executor. **I ran none of it.** If the round
   touched the web guard, nothing in my report covers it.
2. **`main`'s actual red state.** `[UNCHECKED]` I never reproduced it. I established my own narrow
   baseline instead and scoped every claim to it.
3. **The other ~500 tests in `internal/server`.** `[UNCHECKED]` I only ever ran `-run`-filtered
   alternations. A mutant of mine could have killed a test outside my filter and I would not have
   seen it. **This weakens M1–M4 specifically:** I claim they survived *my ten tests*, not that they
   survived the package.
4. **Nine of the twelve new `file.go:NNN` citations.** `[UNCHECKED]` I resolved the three in the
   collection exemption and two-thirds were wrong. `beads.go:421`, `graphql_queries.go:476-518`,
   `urlvalidate.go:316`, `ent/migrate/schema.go:87`, `urlvalidate_rpc_test.go:102` and the rest are
   **unverified**. Given a 2-of-3 error rate on the set I did check, I would not assume these are sound.
5. **The `[REASONED, NOT MEASURED]` step in the repaired `metadata` comment** — that a persisted
   `json.RawMessage` decodes back to `map[string]any`. §4.2 asked me to measure it if I could. **I
   did not.** It needs a store round-trip fixture; it is a real gap and I ran out of margin before
   the report deadline, not before the token queue.
6. **Section 4 item 1's instruction to assume another persistence path exists.** `[PARTIAL]` I ran a
   tree-wide census of `RemoteData` writers including builder-suffix forms and found nothing beyond
   the documented set. **But my search was keyed on the identifier**, and the registry comment
   correctly points out that `map[string]any` is a reference type, so a mutation through an alias is
   a write in which the token `RemoteData` never appears. **My census cannot in principle close
   that, and I am not claiming it does.**
7. **`TestMapStringStringStaysUnrepresentable_GuardsO1` was not mutation-tested.** Its status in my
   table is `[REASONED, NOT MUTATED]` from reading its structure.
8. **Concurrency.** `[UNCHECKED]` No `-race` run.

---

*Leg: `xss-r5-test`. Report written to the scratchpad volume and deliberately NOT committed —
`reports/` is untracked at `d305391` and in `origin/main`, per the eng-manager's 05:04Z correction.
Project-log entry committed separately on branch `leg/xss-r5-test`, never on
`url-scheme-validation-r5`.*

---
---

# AMENDMENT — 2026-07-29 ~05:30Z. B-1 ADJUDICATED. **I WAS WRONG.**

Reopened by the eng-manager, who pre-registered a hypothesis that my B-1 conclusion did not survive
contact with a test I never ran. **It did not. The hypothesis was correct.** Original B-1 text above
is left standing and marked superseded rather than edited, per instruction and per the
supersede-never-erase rule this project keeps re-learning.

Measured at ROOT `/workspace/farmtable-xss-r5-test`, DIST=ABSENT, on `b9ada87`, which is `d305391`
plus exactly one markdown file — `git diff --name-only d305391 b9ada87` returns only
`.design/project-log/2026-07-29-test-xss-r5.md`. **No `.go` file differs.** (Noted because the
eng-manager discarded an accidental measurement taken at `b9ada87`; for any `.go` file that
measurement was valid and did not need discarding.)

## A-1 — THE ANSWER TO THE QUESTION THAT SETTLES IT

**The exact `-run` string my original M1 run used:**

```
'^(TestEphemeralGraphRouteDropsRemoteData|TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident|TestMapStringStringStaysUnrepresentable_GuardsO1|TestScannedServerPackageRemoteDataWriteSitesSanitize|TestRemoteDataAssignmentSeesEveryShape|TestRemoteDataWriteIsSanitized|TestRemoteDataFuncIdentSeparatesMethodsFromFunctions|TestRemoteDataKeyClassification|TestRemoteDataKeysWrittenByAdaptersAreClassified|TestSanitizeAndImportAgreeAtEveryDepth)$'
```

Ten names, **anchored `^(...)$`**. `TestPassthroughReadDropsUnsafeRemoteURL` is not among them and
could not have matched. **The eng-manager's hypothesis is confirmed exactly as stated.**

## A-2 — **B-1 IS SUPERSEDED. DOWNGRADED FROM BLOCKING TO NON-BLOCKING.**

**T-R11 `[MEASURED]`:** M1 re-applied, then
`go test ./internal/server/ -run 'TestPassthroughReadDropsUnsafeRemoteURL' -count=1`:

```
--- FAIL: TestPassthroughReadDropsUnsafeRemoteURL (0.03s)
    --- FAIL: .../javascript          --- FAIL: .../javascript_exfiltration
    --- FAIL: .../data_html           --- FAIL: .../vbscript
    --- FAIL: .../file                --- FAIL: .../backslash_host_confusion
```

**All six subtests red.** Anti-vacuity control run first, unmutated: the test genuinely executes
(8 `RUN`/`PASS` lines, not "no tests to run") — the check I failed to make at T-R2b.

**So the carrier IS pinned end-to-end.** `issueBuildRemoteData` executes at runtime through a mock
GraphQL server and a real gRPC `ListTasks`, and `len(GetRemoteData().GetFields()) != 0` catches the
change. **Reachability is not naming, and I conflated them.**

### What I actually did wrong, named precisely

My narrow claim was true and remains true: **no test in the repository references
`issueBuildRemoteData` or `issueLabels` outside a string literal.** I then restated that as the wide
claim *"nothing goes red if the carrier changes"* — **and never re-measured at the boundary between
the two.** My M1 run used a filter built for a different question and I read its green as an answer
to this one.

**That is the exact defect shape this entire round is about**, and I filed four findings against
other people for it while committing it in the same document. Worse: I *had* the disconfirming fact
in hand — item 3 of my own "WHAT I DID NOT CHECK" says my mutants were bounded to ten tests — and I
did not let it constrain the strength of B-1's headline. **A stated limitation that does not
propagate into the claim it limits is decoration.** Filed against myself.

## A-3 — THE THIRD THING, WHICH NEITHER OF US PREDICTED AND WHICH OUTRANKS THE ADJUDICATION

The eng-manager predicted "roughly 13 fields". I agreed. **The observed count is 7:**

```
remote_data unexpectedly carries 7 field(s) on the passthrough path:
[created_at node_id number platform remote_id sub_issues_summary updated_at]
```

**`remote_url` and `html_url` are ABSENT from that list.** Under M1, `remote_data` reaches the wire
— and `sanitizeRemoteData` has stripped **both** URL carriers, on a real decode path, end to end,
against six different hostile schemes.

Three consequences, and I think the third is the most useful thing in this amendment:

1. **M1 is not a live XSS.** Removing the labels carrier ships `remote_data` but ships it *scrubbed*.
   My original B-1 said the payload "reaches the browser". **That was wrong too**, and wrong in the
   alarming direction. The sanitizer this round built is what stops it.
2. **The "fail-closed accident" framing is weaker than the round presents it** for this path. The
   structpb rejection is not the only thing between passthrough `remote_data` and a client — the
   sanitizer independently holds. (O1's `map[string]string` case is genuinely different: there the
   walk *cannot* see inside, so unrepresentability really is the only guard. That distinction is
   real and `TestMapStringStringStaysUnrepresentable_GuardsO1` is right to exist.)
3. **`TestPassthroughReadDropsUnsafeRemoteURL`'s own doc comment understates it.** The comment says
   the scrub *"CANNOT be pinned end-to-end on this particular path"* and routes the reader to two
   weaker in-memory tests. T-R11 shows that under the one mutation that makes `remote_data` non-empty,
   **this test becomes exactly the end-to-end scrub pin the comment says is impossible here** — and
   its failure message already tells the next maintainer what to upgrade it to. **A test whose
   comment tells you it cannot prove something it can prove is a comment that will get the test
   deleted in the next cleanup.** Recommend: keep the test, correct the comment, and add the
   `remote_url`/`html_url` absence assertions *now*, guarded so they are meaningful whether or not
   the field is empty.

## A-4 — REVISED STATUS OF THE PROPERTY TABLE

| # | Property | Revised status |
|---|---|---|
| 6 | `labels` is an unconditional structpb carrier | **PINNED** by `TestPassthroughReadDropsUnsafeRemoteURL` (T-R11, red ×6). Was "UNPINNED — B-1". **Corrected.** |
| 7 | `sub_issues` is the second carrier | **STILL UNPINNED** `[MEASURED, bounded]` — see A-5 |

## A-5 — WHAT SURVIVES OF B-1, STATED NARROWLY THIS TIME

Not blocking. All three still worth doing:

- **`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident` remains a test of the protobuf
  library.** Every assertion is over a literal the test wrote. The eng-manager has not withdrawn
  this and the audit leg reached it independently; its `parent` non-carrier row *plants* an assumed
  dynamic type rather than measuring the decoded one. Rebuild against a decoded fixture.
- **The `sub_issues` carrier is still unpinned, and I am now confident of the bound.** T-R11's
  fixture has `subIssues.nodes: []`, so the conditional branch never executes and `sub_issues` never
  entered the map. The end-to-end test that rescued the `labels` carrier **cannot** rescue this one
  without a fixture that has sub-issues. `[MEASURED]` — the 7-key list contains
  `sub_issues_summary` but no `sub_issues`.
- **The doc comment's carrier enumeration is still unenforced prose**, and it is the artefact that
  would mislead the next reader, since it now over-claims in the direction of safety.

## A-6 — CORRECTION TO MY "WHERE MY BRIEF WAS WRONG" SECTION

Item 7.4 said I "never needed the token at all". Accurate as to the token. But it sat next to a
finding whose scope depended on a filter I chose for convenience, and the honest version is:
**I never needed the token, and I under-ran anyway.** Cheap runs do not automatically produce
well-bounded claims; a filter is a search space, and I did not state mine at the point where it
mattered.

**VERDICT AFTER AMENDMENT: still REQUEST CHANGES, on B-2, B-3 and B-4 only. B-1 is withdrawn as a
blocker.** Of my four blocking findings, one did not survive independent challenge. The three that
remain were each demonstrated by a mutant whose scope I have now re-checked: B-2 and B-3 are
mutations of code that only the tests I ran exercise, and B-4 is a static resolution of a citation,
not a test-scope claim.

---

# AMENDMENT 2 — B-1 ADJUDICATION HARDENED (T-R12 / T-R13 / T-R14)

The eng-manager's addendum and the audit leg's instrumentation proposal both arrived **after** T-R11
had already run. T-R11 produced a bare red/green; this amendment re-runs it with the instrumentation
requested and adds a self-audit the addendum provoked. Everything below is `[MEASURED]`.

## A2-1 — The file I mutated, confirmed by inspection and not from prose

M1 targeted **`internal/platform/github/graphql_queries.go`**, the line `"labels":     issueLabels(issue),`
inside the **unconditional** map literal of `issueBuildRemoteData`. I did **not** touch
`internal/platform/github/github.go`.

**The EM's trap is real and I want it on the record as a near miss, not a save.** `github.go`'s
`buildRemoteData` writes `rd["labels"] = labelNames` **guarded by `if len(labelNames) > 0`**. Against
a zero-label fixture, deleting that line removes code that never runs and reports green as though
something had been tested. I avoided it because the passthrough path was the one I was reasoning
about — **not because I checked for the hazard.** I had no rule that would have caught it.

## A2-2 — Recommended new rule for the project's mutation protocol

> **A mutant must be shown to be live before its survival is reported.** Delete-mutants on
> conditional branches are void unless the run demonstrates the branch executes under the fixture —
> by a printed side effect, a coverage line, or a positive control. A no-op is indistinguishable
> from a survivor in the exit code, and every mutation table this project has produced, including
> mine, is exposed to it.

## A2-3 — Self-audit of all eight of my mutants against that hazard: **0 no-ops**

Three survivors were safe by construction (M1 unconditional; M3/M4 are test-data edits whose effect
on the count I observed directly). **M2 was genuinely at risk** — `log.Printf` fires only on a
non-nil `NewStruct` error — so I measured it (T-R13) with the falsifier pre-registered: *absent log
line ⇒ M2 is a no-op and B-2 falls exactly as B-1 did.*

**The falsifier did not fire.** At baseline the line executes exactly once:
`task.remote_data dropped: ... proto: invalid type: map[string]string`, driven by
`TestMapStringStringStaysUnrepresentable_GuardsO1`. The line runs; no assertion observes it.
**B-2 stands, now on measured rather than assumed ground.**

Partial miss worth recording: I predicted the driver would be
`TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident`. It emits nothing. Right outcome, wrong
mechanism.

## A2-4 — All five candidate explanations eliminated

| # | candidate | how excluded |
|---|---|---|
| 1 | mutant did not take | `git diff` printed inside the run command |
| 2 | test cache | `-count=1` on every run |
| 3 | third carrier (`node_id`) | **no `invalid type` printed at all** — `NewStruct` returned nil |
| 4 | assertion never executed | `-v`, **6 named subtest FAIL lines**, 7 `=== RUN` lines |
| 5 | wrong tree | `pwd -P` + `git rev-parse HEAD` + `git diff --stat` in the **same command** as the run |

**Nothing remains but the plain reading: the mutant is caught.** The EM's branch 3 fired —
`NewStruct` succeeded, `remote_data` shipped, the assertion went red on all six hostile schemes.

## A2-5 — Convergence with the audit leg, to the field

The audit leg derived ~9 surviving fields from a static read of the `shurcooL/graphql` decoder, and
predicted that even with `remote_url` and `html_url` stripped the remainder is non-empty and the test
still reddens. Observed: **7 fields** = its 9 minus exactly those two. **Its derivation is confirmed
numerically, including the part that argued against its own position.** My A-3 "surprise" is not a
third explanation after all — it is the audit leg's prediction, and I should stop calling it mine.

## A2-6 — The standard applied in my direction

The measurement came back **RED**. I say it plainly: **my B-1 wide claim was wrong**, it drops to
non-blocking, and it was the EM's hypothesis and the audit leg's derivation — not my own re-check —
that caught it. Two legs agreeing with me by the same name-search method was one piece of evidence
wearing the clothes of two, and the leg that tested the boundary beat both of us.

**What survives, in its narrow form:** `TestPassthroughGraphQLRemoteDataIsNilByStructpbAccident`
asserts over hand-typed literals and never calls the builder; it is largely a test of the protobuf
library. That remains true and is already in fix scope. **What does not survive:** the claim that
nothing goes red if the carrier changes, and the claim that a `labels` change ships a live XSS.

**REVISED VERDICT: REQUEST CHANGES on B-2, B-3, B-4. B-1 withdrawn as a blocker, retained as a
non-blocking test-quality note.** `sub_issues` remains genuinely unpinned — the fixture sets
`subIssues.nodes: []`, so that branch never executes, and by A2-2's own rule I must label that
**UNMEASURED, not cleared.**
