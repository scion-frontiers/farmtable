# WHAT INSTRUMENT PRODUCED EACH RECORDED NEGATIVE ON THE `remote_data` AXIS

Read-only classification leg. **Nothing was built, run, or modified** outside this file and my
project-log entry. No build token was requested and none was needed.

Brief: `briefs/xss-instrument-audit.md`, plus two amendments received 06:12:02Z (two-axis
classification; population cut-off). Both are applied below.

---

## 0. HEADLINE, BEFORE THE TABLE

**The premise I was handed is wrong, and that is the finding.**

I was told: *six rounds searched for consumers of `remote_data` and recorded negatives; a
consumer was found last hour that every one of those searches was structurally incapable of
seeing, because they looked for the value being PRINTED and this one is BRANCHED ON.*

The consumer in question — `capabilities.ts:98` / `ft-app.ts:256` reading
`collection.remoteData.writable` as a capability gate — **was found, named, cited by
`file:line`, and correctly characterised as a capability gate in every round from round 1
onward, including by the round-5 audit leg 29 minutes before the report that presents it as
new.**

| when | artefact | what it says |
|---|---|---|
| r1 | `audit-xss-r1.md:495` | "its only two client consumers are `capabilities.ts:98` and `ft-app.ts:256`, both reading a `writable` boolean **for capability gating**" |
| r1 | `review-xss-r1.md:178-180` | "the only non-generated `remoteData` reads in `web/src` are `capabilities.ts:98` and `ft-app.ts:256`, both reading a `writable` boolean" |
| r2 | `audit-xss-r2.md:179-181` | "the two `remoteData` reads, `capabilities.ts:98` and `ft-app.ts:256`, are on `Collection`" |
| r3 | `audit-xss-r3.md:152-153` | "`ft-app.ts:255` and `capabilities.ts:98` both read `collection.remoteData`" |
| r3 | `review-xss-r3.md:90-92` | "I enumerated every consumer … There are exactly two" |
| r3 | `test-xss-r3.md:104-106` | "read `collection.remoteData` for a `writable` boolean" |
| r4 | `audit-xss-r4.md:101` | "`capabilities.ts:98` and `ft-app.ts:256` (both read a boolean writability flag)" |
| r4 | `review-xss-r4.md:318-322` | names both, "**I checked both and there is no regression**" |
| r4 | `audit-xss-r4.md:2661` | files **XSS-R4-C5 — "`remote_data` carries a behavioural capability flag, not just display data"** |
| r5 | `xss-r5-audit.md:401-402` | "I found this while establishing (for F1) that `remote_data` is never rendered — **the only two reads turned out to be a permission decision**" |
| r5 | `xss-r5-import-writable.md` | an entire dedicated leg tracing `writable` as a security question |
| r5 | `xss-r5-consumer-population.md:45-48` | "a search for render sinks is **structurally incapable** of finding it … **that is why three legs missed it**" |

The last row is the only artefact on this axis that makes a false statement about the prior
record. Timestamps: `audit-xss-r4.md` 03:00Z, `importtrust-f7d.md` 04:08Z, `xss-r5-audit.md`
05:18Z, `xss-r5-consumer-population.md` **05:47Z**.

Two further specifics, both checkable:

1. **The capability-gate reframing is not new either.** `audit-xss-r4.md:2661-2673` (03:00Z)
   filed the *general* lesson — "`remote_data` is documented as an untyped display escape
   hatch, and it is also a **policy input**. `sanitizeRemoteData` … would not look at a key
   like this" — off a *third*, server-side, branched-on consumer the 05:47Z report does not
   mention: `graph_support.go:26-27`, `c.RemoteData["graph_queries"]` as a bool override.
   `importtrust-f7d.md:704` (04:08Z) found the same one independently: "**it is not data; it
   is configuration**."
2. **"`decomposer`, which nobody had named" (`xss-r5-consumer-population.md:101-102`) is
   also false.** `audit-xss-r4.md:1731-1747` names `internal/decomposer` explicitly, in an
   amendment whose whole subject is that its own consumer enumeration was incomplete.

**So the coverage claim on this axis is in better shape than the trigger in §6 of my brief
anticipated — but not unblemished.** Three recorded negatives do rest on a rendering-keyed
instrument, and two rest on no stated instrument at all. Those are itemised in §3 and §5, and
I am not softening them.

---

## 1. POPULATION, WITH CUT-OFF

**Cut-off: 2026-07-29T06:12:38Z.** Enumeration commands run between 06:07Z and 06:12Z against
`/scion-volumes/scratchpad/projects/farmtable`.

```
$ ls -1 reports/ | wc -l                                    # 255
$ ls -1 reports/ | grep -iE 'xss|remote' | wc -l            # 24   <- reproduces the EM's count exactly
$ grep -rl 'remote_data\|remoteData\|RemoteData' reports/ | wc -l   # 52
$ grep -rl 'remote_data\|remoteData' briefs/                        # 17 files
$ grep -rln 'remote_data\|remoteData' /workspace/farmtable-xss-r6-fix/.design/project-log/
```

**The EM's population of 24 is right on its own terms and wrong in three ways, all of which I
widened for:**

- **~~`ls -1` does not list dotfiles.~~ — SEE CORRECTION C1 (§8). This bullet was wrong and I
  am leaving it struck rather than deleting it.** `ls -1` does not list dotfiles, and that is
  a true property, but it is **not** what excludes the ten `.preimage-review-194-r11-b*.md`
  files: those filenames contain neither "xss" nor "remote", so the **name pattern** excludes
  them and `ls -1a | grep -iE 'xss|remote'` returns the **identical** set. I inferred a cause
  from a count without checking the content. The files are still outside the name-matched
  population — I reached them by content grep — and they are the 194 task-state track,
  carrying no negative on this axis.
- **Two of the 24 mention `remote_data` nowhere** (`_xss-r4-baseline-measurement.md`,
  `test-xss-r2.md`). Name-matched, not axis-relevant.
- **The axis reaches outside `reports/`.** Two of the load-bearing negatives are in
  **project-log entries**, which are *in-tree* and not on this volume — and the scratchpad's
  own `.design/project-log/` (4 files) is **not** the same directory as the in-tree one (86
  files). Resolving these against the wrong tree was a live hazard: **`/workspace/farmtable`
  is on branch `task-state-web-ui-v2` at `633f8f2` and does not contain the xss project-log
  entries at all.** The correct tree for this axis is
  **`/workspace/farmtable-xss-r6-fix`, branch `url-scheme-validation-r6`**.

**Population I settled on: every recorded negative on "does anything consume `remote_data`",
wherever it lives** — 24 name-matched reports, 52 content-matched reports, 17 briefs, and the
5 in-tree `url-scheme-validation-*` project-log entries. I read for negatives, not for files.

### Open round — outside my read, UNCLASSIFIED

**The round-6 fix leg is running now and its negatives are NOT in this classification.** I
observed its worktree HEAD move while I was reading: `ba09244` (06:09Z) → `1b29165` (06:12Z).
Its B1–B10 negatives are outside my cut-off and **unclassified by me** — silence here must not
be read as coverage. Per the EM's amendment, its **B11 is exempt and lands signed**; I have not
inspected B11 and take no position on it. `reports/_run-queue-log.md` was also modified after my
enumeration began.

**All totals below are totals as of 06:12:38Z, not totals for the axis.**

---

## 2. THE TABLE

Axis A = do we know what was run. Axis B = what it was keyed on (plural permitted, blank when
A is not EXPLICIT). "Basis" = whether the report states its own method (**M**) or I inferred it
(**I**); per §4 of the brief I prefer the report's own statement wherever it gives one.

| # | round | negative (quoted) | `file:line` | A | B | basis |
|---|---|---|---|---|---|---|
| 1 | design | "**No code except convert.go inspects it**" | `reports/design-external-store-brainstorm.md:60` | **UNDETERMINABLE** | — | M |
| 2 | design | "Not covered, deliberately: `Collection.remote_data` (**reaches no `href`**)." | `.design/project-log/url-scheme-validation-stored-xss.md:63` | **UNDETERMINABLE** | — | M |
| 3 | r1 dev | "Client-controlled, but **it reaches no `href`** — the toolbar uses `collection.remoteId` through a regex, not this map." | `reports/dev-xss-url.md:98-100` | EXPLICIT | **RENDERING** | M — "**Where I stopped:** at `href`/`src`/navigation/loadable sinks in `web/src`" (`:149`) |
| 4 | r1 audit | "client-controlled, **reaches no href**, confirmed: its only two client consumers are `capabilities.ts:98` and `ft-app.ts:256`, both reading a `writable` boolean for capability gating" | `reports/audit-xss-r1.md:495` | EXPLICIT | **CONSUMPTION** | M — "sink-first … sink → TS type → proto field → `convert.go` → ent field → every writer" (`:470`) |
| 5 | r1 review | "**Nothing renders it today** (`[M-sub]`, re-verified: the only non-generated `remoteData` reads in `web/src` are `capabilities.ts:98` and `ft-app.ts:256`, both reading a `writable` boolean)" | `reports/review-xss-r1.md:178-180` | EXPLICIT | **CONSUMPTION**, **IDENTIFIER** | M |
| 6 | r2 audit | "**no `web/src` code reads task `remoteData`** (the two `remoteData` reads, `capabilities.ts:98` and `ft-app.ts:256`, are on `Collection`, and neither reaches a URL sink) **[MEASURED]**" | `reports/audit-xss-r2.md:178-181` | EXPLICIT | **CONSUMPTION** | M |
| 7 | r2 review | "**No web source reads `task.remoteData` at all** — `capabilities.ts:98` and `ft-app.ts:256` read `collection.remoteData`, **a different message**." | `reports/review-xss-r2.md:91-93` | EXPLICIT | **CONSUMPTION** | M |
| 8 | r2 review | "**no client renders `task.remoteData`**, and the client-side chokepoint would catch one that tried" | `reports/review-xss-r2.md:655-656` | EXPLICIT | **RENDERING** | I — restatement of #7; same leg, rendering-worded |
| 9 | r3 audit | "**none of them reads `collection.remoteData`**. Both current readers consume a `writable` capability flag, not a URL. **So there is no sink today**" | `reports/audit-xss-r3.md:156-159` | EXPLICIT | **RENDERING**, **CONSUMPTION** | M — "I enumerated every `href` binding in `web/src` rather than grepping for the ones I expected" |
| 10 | r3 audit | "**No web binding renders `remote_data` at all** (§0.4), so there is no sink." | `reports/audit-xss-r3.md:554` | EXPLICIT | **RENDERING** | M — §0.4 is the href-binding enumeration |
| 11 | r3 review | "**I enumerated every consumer of collection `remoteData` in the web tree rather than assuming.** There are exactly two … and **both read only the boolean `rd.writable`**. Neither renders it." | `reports/review-xss-r3.md:90-96` | EXPLICIT | **CONSUMPTION** | M |
| 12 | r3 review | "I enumerated **every consumer** of `remoteData`/`remote_data` in `web/src` (`capabilities.ts:98`, `ft-app.ts:256`, `gen/types.ts`, `gen/grpc-client.ts`, `store/task-store.ts` comment). The only reads are of the boolean `writable`." | `reports/review-xss-r3.md:157-161` | EXPLICIT | **CONSUMPTION**, **IDENTIFIER** | M |
| 13 | r3 test | "**Reachability to a sink: none today** — see O-9." | `reports/test-xss-r3.md:69` | EXPLICIT | **CONSUMPTION** | M — defers to O-9 (#15) |
| 14 | r3 test | "**Reachability to a sink: none today** — `capabilities.ts:98-101` and `ft-app.ts:256-259` read `collection.remoteData` for a `writable` boolean and nothing else." | `reports/test-xss-r3.md:104-106` | EXPLICIT | **CONSUMPTION** | M |
| 15 | r3 test | "`Task.remoteData` is **never read anywhere in `web/src`** **[MEASURED, independent full-tree sweep]** … **read by nothing**. No component, no store, no template." | `reports/test-xss-r3.md:399-405` | EXPLICIT | **CONSUMPTION** | M |
| 16 | r4 audit | "`grep -rn "remote_data\|remoteData" web/src` returns **five** non-generated hits … **Nothing in the web client renders `remote_data` into an `href`, or into markup at all.**" | `reports/audit-xss-r4.md:99-107` | EXPLICIT | **IDENTIFIER**, **CONSUMPTION** | M — grep is identifier-keyed; all five hits were then read and characterised |
| 17 | r4 audit | "N1 — nothing in `web/src` renders `remote_data` … the probe returns **8 hits** … **HOLDS**, self-attesting" | `reports/audit-xss-r4.md:1705` | EXPLICIT | **RENDERING**, **IDENTIFIER** | M — positive-control amendment, `:1690-1712` |
| 18 | r4 review | "The log states: *'`Task.remoteData` is read by nothing in `web/src` (test O-9).'* **Literally true, and I confirmed it.** But … **`Collection.remoteData`, which `web/src` reads in two places**" | `reports/review-xss-r4.md:314-322` | EXPLICIT | **CONSUMPTION** | M |
| 19 | r4 review | "'`Task.remoteData` is read by nothing in `web/src` (test O-9)' — **TRUE, and correctly scoped**" | `reports/review-xss-r4.md:891` | EXPLICIT | **CONSUMPTION** | M |
| 20 | r4 review | "`Task.remote_data` … is read by **nothing** in `web/src`. `Collection.remote_data` — read by `capabilities.ts:98` and `ft-app.ts:256`, **both gating write permissions**" | `reports/review-xss-r4.md:2114-2115` | EXPLICIT | **CONSUMPTION** | M |
| 21 | r4 dev | "`Task.remoteData` **claimed** to be read by nothing in `web/src`. **Every one of those is AUTHOR-CLAIM.**" | `reports/dev-xss-r4.md:597` | **NOTHING-RUN** | — | M — leg states it ran no instrument and relays |
| 22 | r4 log | "**The client-side scrub is not a compensating control.** `Task.remoteData` is read by nothing in `web/src` (**test O-9**)." | `.design/project-log/url-scheme-validation-r4-fix-round.md:245` | EXPLICIT | **CONSUMPTION** | M — cites test O-9 (#15) |
| 23 | r5 audit | "I traced `remote_data` all the way to the DOM and **it never gets there.** `[MEASURED]` — **the only non-generated reads of `remoteData` anywhere under `web/src` are** … Both are **boolean predicate reads of one key.**" | `reports/xss-r5-audit.md:215-221` | EXPLICIT | **CONSUMPTION**, **IDENTIFIER** | M — positive control given at `:616-618` |
| 24 | r5 audit | "`remote_data` **has no render sink in this application**" | `reports/xss-r5-audit.md:641` | EXPLICIT | **RENDERING** | I — rendering-worded restatement of #23's instrument |
| 25 | r5 import | "**No server handler consults any client-supplied capability, and no Go code reads `writable` at all.**" | `reports/xss-r5-import-writable.md:182` | EXPLICIT | **IDENTIFIER** | M — positive-controlled at `:195` |
| 26 | r5 pop. | "`task.remoteData` is decoded and **never read**." | `reports/xss-r5-consumer-population.md:18` | EXPLICIT | **CONSUMPTION** | M — transport-first + import-graph method, `:96-119` |
| 27 | adj. | "'**No render site found**' is a negative from a search, and **the search was delegated** … I have **not** established '*the code does not depend on X*'." | `reports/importtrust-f7d.md:1545-1552` | EXPLICIT | **RENDERING** | M — self-declared |

**Not counted, and why:** `test-xss-r1.md:397` ("`beads_import.go` … never sets `remote_data`,
so it carries no URL ingress") is a *writer*-side negative, not a consumer-side one. Different
sub-axis; I did not fold it in.

---

## 3. TOTALS AS OF 06:12:38Z

**Total recorded negatives on this axis: 27.** Absolute count over the population in §1, not a
floor for the axis — the open round will add to it.

**Axis A**

| | count |
|---|---|
| EXPLICIT | **24** |
| UNDETERMINABLE | **2** (#1, #2) |
| NOTHING-RUN | **1** (#21) |

**Axis B** — over the 24 EXPLICIT rows, plural, so the column sums past 24.

| | count | rows |
|---|---|---|
| CONSUMPTION-KEYED | **17** | 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18, 19, 20, 22, 23, 26 |
| RENDERING-KEYED | **7** | 3, 8, 9, 10, 17, 24, 27 |
| IDENTIFIER-KEYED | **6** | 5, 12, 16, 17, 23, 25 |

**`U` was pre-registered as the expected common answer. It is not: it is 2 of 27.** I record
that as a clean result, per §4 of the brief, and I did not upgrade either of the two — see §5.

**Rows resting *wholly* on a rendering-keyed instrument: #3, #8, #10, #24, #27** (five). Of
these, #8 and #24 are rendering-worded restatements of a consumption-keyed instrument in the
same report (#7, #23), so the leg's underlying evidence is not rendering-bound. **The negatives
that are genuinely rendering-bound and have no consumption-keyed sibling in the same leg are
#3 (r1 dev) and #10 (r3 audit, with #9 partially).** Those are the rows §6 of my brief bites on.
I am not applying the trigger; I am naming its inputs.

---

## 4. SIXTH CELL — `PREDICATE-NARROWED`

The two-axis amendment resolved the hybrid problem. One thing is still unrepresented, and it is
the mechanism that produced this whole episode, so I am naming it rather than forcing it.

> **`P` — PREDICATE-NARROWED.** The instrument was consumption- or identifier-keyed and *did*
> enumerate the consumers, but the negative was **recorded** against a rendering-keyed
> predicate — "no sink", "reaches no href", "never rendered". **The consumer is present in the
> report's evidence and absent from its conclusion.**

Axis B describes what the instrument looked at. Nothing on the form describes **what the
negative was written as**. That gap is exactly how a correct, narrow, well-measured finding
becomes a wrong, broad, remembered one.

**`P` applies to rows 4, 9, 16, 23** — and row 4 is `audit-xss-r1.md:495`, where the sentence
that names both capability-gate consumers *begins* with the words "reaches no href".

This is not a defect in those legs. Every one of them was answering the question it was asked.
`P` is a defect in **summarisation and in reading** — and I include this classification leg's
own brief in that, since the one-line version I was sent ("every one of those searches was
structurally incapable of seeing it") is itself a `P`-collapse of the record.

---

## 5. WHERE THE BRIEFS SET THE INSTRUMENT

The EM asked to be told when a leg was narrow because the brief made it narrow. **It happened
once, clearly, and it was corrected by the same author one round later.**

- **`briefs/audit-xss-r3.md:53-56` mandated a rendering-keyed instrument.** *"Do not grep for
  the ones named here. A round on this branch surfaced three carriers nobody had thought to
  look for by enumerating every attribute on rendered output rather than grepping for expected
  ones; **the analogue is enumerating every path by which server-held data reaches a rendered
  URL context**."* That instruction is the direct cause of #10 (`audit-xss-r3.md:554`, "No web
  binding renders `remote_data` at all … so there is no sink"). The leg did what it was told,
  did it well, and additionally volunteered the consumption evidence in #9 that the brief did
  not ask for.
- **`briefs/audit-xss-r1.md:107-108` set the rendering-keyed *predicate*** — *"`Collection.remote_data`
  … client-controlled, but **claimed to reach no `href`**. Verify."* The r1 audit answered with
  a consumer enumeration (#4) rather than the href check it was asked for. **The leg exceeded
  its brief**, which is why the capability gate is in the record from round 1.
- **`briefs/audit-xss-r4-checklist.md:40-48` corrected the axis, explicitly.** *"if nothing
  reads it, the client-side exposure is currently nil … but it also means the field is
  **unguarded by any consumer-side control** the moment someone writes a consumer … **MCP and
  gRPC-web are consumers too. `web/src` is not the only reader.**"* This is a
  consumption-keyed instruction, and round 4 is where the strongest consumer work on this axis
  was done (#16–#20, the positive-control amendment, and XSS-R4-C5).

**So the brief axis reads: narrow at r3, widened by the same author at r4.** I found no brief
that suppressed a consumption-keyed search after r3.

---

## 6. WHAT I COULD NOT DETERMINE — `[UNCHECKED]`

- **`[UNCHECKED]` — the open round's B1–B10 negatives.** Outside my cut-off (§1). Unclassified.
  B11 is exempt per the EM and I have not looked at it.
- **`[UNCHECKED]` — whether #1 (`design-external-store-brainstorm.md:60`, "No code except
  convert.go inspects it") was false *when written*.** It is false against both trees I read —
  `graph_support.go` reads `RemoteData["graph_queries"]`, and `capabilities.ts`/`ft-app.ts`
  read it client-side. Establishing whether those consumers existed at that document's date
  needs `git log`/`git blame` against a dated ref. **I judged that a "run" under §0 of my
  brief and stopped.** It is a two-command check for anyone holding the token.
- **`[UNCHECKED]` — I did not resolve any `file:line` into source.** Every classification is
  from what the reports state about their own method, per §3 of my brief. I did not open
  `capabilities.ts`, `ft-app.ts`, `graph_support.go` or `convert.go`. The consistency of eleven
  independent reports on `capabilities.ts:98` / `ft-app.ts:256` is my evidence, not the file.
- **`[UNCHECKED]` — whether "three legs missed it" (`xss-r5-consumer-population.md:48`) is
  false under *every* reading.** Under "the r5 review, test and dev legs" it is **accurate** —
  none of those three mentions the capability gate. Under "three legs of the project" it is
  false. What is false under every reading is the accompanying claim that a render-sink search
  is *structurally incapable* of finding it: `xss-r5-audit.md:401` records finding it **by**
  the render-sink hunt, in the same round.
- **`[UNCHECKED]` — the 194/195 task-state track.** Ten `.preimage-review-194-r11-b*.md` files
  and ~10 other 194-series reports mention `RemoteData`. I skimmed them for negatives on this
  axis and found none; I did not read them in full.
- **`[UNCHECKED]` — out-of-tree consumers.** `xss-r5-consumer-population.md:77-81` is right
  that this cannot be bounded from the tree. Nothing in my read changes that, and no round's
  negative should be read as covering it.

---

## 7. VERDICT ON THE COVERAGE CLAIM

**The instruments on this axis were, in the main, adequate — and the axis was not
under-searched.** 17 of 27 negatives rest on a consumption-keyed instrument; several carry
positive controls (`audit-xss-r4.md:1690-1712`, `xss-r5-audit.md:616-618`,
`xss-r5-import-writable.md:195`); three separate legs independently flagged their own blind
spots in writing before anyone audited them. `U` came in at 2 of 27 against a pre-registration
that expected it to dominate.

**What is not clean is narrower and different from what the trigger was written for.** It is
not that the searches could not see the consumer. It is that:

1. **Two negatives (#1, #2) have no stated instrument**, and one of them —
   `url-scheme-validation-stored-xss.md:63`, "Not covered, deliberately: `Collection.remote_data`
   (reaches no `href`)" — is the origin of the whole chain. *I am not upgrading it.* I note only
   that the **other half of that same sentence** was audited in r2 and found to "have been
   justified against dead code" (`:65-74`). The half that was checked did not survive. The half
   that seeded this axis has never been checked.
2. **One negative (#21) is a relayed AUTHOR-CLAIM** — and the leg labelled it as such itself,
   which is why it is classifiable at all.
3. **Two rounds' negatives are genuinely rendering-bound** (#3, #10), one of them because
   `briefs/audit-xss-r3.md:53-56` said so.
4. **The `P` failure (§4) is real and is the one that actually cost this project time** — a
   true narrow finding, restated broadly, believed at the broad scope for six rounds, then
   "rediscovered" at 05:47Z as a novel structural blind spot it was not.

**The sentence in §6 of my brief — *"some of what we recorded as looked-at-and-clean was never
looked at"* — is not supported for this axis.** It was looked at, repeatedly, and written down
accurately each time. The supported sentence is narrower:

> *Some of what we recorded as looked-at-and-clean was looked at, correctly, at a narrower
> scope than the words we filed it under — and we then read our own words at the wider scope.*

**Recommendation, not a finding:** the artefact that needs correcting is
`xss-r5-consumer-population.md`, whose §"The finding the render-sink hunt could not have
produced" attributes to three legs a miss the record does not show. Correcting it is cheap and
protects the very coverage claim this exercise exists to defend. That call is the EM's.

---

## 8. CORRECTIONS AND SELF-AUDIT — added 07:02Z under the armed exit-status rule

The armed rule (`em-tooling/_ARMED-RULE-exit-status.md`) asks retrospectively which reported
greens are receipts. **This leg ran no build and no test, so it reported no green of that
kind.** But the general property it states — *anything appended to a command in order to
observe it becomes the thing observed* — caught a real error in §1, and one of the two
instruments I criticised in others is the one I got wrong.

### C1 — my dotfile finding was an inference from a count, not from content. **RETRACTED.**

I wrote that the EM's population command was "blind to ten `.preimage-review-194-r11-b*.md`
files." I established that from `ls -1 reports/ | grep -c '^\.'` → **0** and stopped. Checked
properly:

```
$ ls -1a reports/ | grep '^\.' | grep -iE 'xss|remote'   # no output, exit 1
$ ls -1  reports/ | grep -iE 'xss|remote' | wc -l        # 26
$ ls -1a reports/ | grep -iE 'xss|remote' | wc -l        # 26   <- IDENTICAL
```

**The dotfiles do not match the name pattern at all.** `ls -1`'s dotfile behaviour is real and
is not the operative exclusion; the **name pattern** is. The population is unchanged and no
conclusion in this report moves — but the *diagnosis* was wrong, and it was wrong in exactly
the way this report criticises elsewhere: **a negative read off an instrument's summary output
instead of its content.** That is the `P` failure of §4 with my name on it. The parallel I drew
to "the same shape as the failure under audit" was itself the failure under audit.

### C2 — the population is now moving in real time, faster than §1 implies

Re-measured at 07:00Z, and it changed **between two invocations of the same command seconds
apart**:

| time | `ls -1 reports/ \| grep -iE 'xss\|remote' \| wc -l` |
|---|---|
| 06:12:38Z (my cut-off) | 24 |
| 07:00:18Z | 26 |
| 07:00:2xZ | 27 |
| 07:00:35Z | **28** |

New since cut-off: `xss-r6-fix.md` (06:39Z — **the open round's report has landed**),
`_prereg-review-xss-r6.md` (07:00:16Z), `_prereg-audit-xss-r6.md` (07:00:18Z), and this file.
**The r6 layer of negatives now exists on disk and is still outside my read and unclassified.**
§3's totals remain totals as of 06:12:38Z.

### C3 — my nulls, and which of them have no positive control

Holding myself to `audit-xss-r4.md:1690` ("a null result from an instrument is
indistinguishable from a misaimed instrument"):

- **The headline (§0) rests on positive content, not on nulls** — twelve quoted, line-cited
  passages I read directly. It is not exposed to this class of error.
- **Positive-controlled by construction:** the per-file `grep -icE` sweep for
  `capabilities.ts|ft-app.ts|...` returned **0** for six files and **non-zero** for the rest in
  the same invocation, so the pattern demonstrably fires. One of those zeros was a false null
  I caught mid-read: a case-sensitive grep missed `dev-xss-r4.md:597`, and only the `-i` rerun
  found it. That row (#21, the sole NOTHING-RUN) exists because the first instrument was wrong.
- **NO positive control, and I did not give them one:** (a) "the ten `.preimage` files carry no
  negative on this axis" — one skim; (b) "I found no brief that suppressed a consumption-keyed
  search after r3" (§5) — a null over `briefs/`; (c) "no negative on this axis in the 194/195
  series" — already marked `[UNCHECKED]` in §6. **Treat (a) and (b) as unproven zeros.**

### C4 — what I verified by artefact rather than by status

The commit is the only artefact this leg produced. Verified by content, not by exit code:
`git ls-tree -r --name-only xss-instrument-classification` lists both files, and
`git rev-parse --abbrev-ref HEAD` still prints `master` at `2c339df` — confirming the shared
checkout was not moved. Neither claim came from a wrapper's report of itself.

---

*Classification leg. No build token requested. No build or test run, so no green reported. No
tree modified outside this file and
`.design/project-log/2026-07-29-xss-instrument-classification.md`. Not pushed.*
