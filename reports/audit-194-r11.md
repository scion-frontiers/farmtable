# audit-194-r11 — security audit

> **CITATION FRAME (added 2026-07-29T01:26Z per Broadcast 8 item 9).**
> **Every `file:line` pointer in this report into `/workspace` source resolves against
> commit `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`**, on branch
> `label-write-scope-r11-audit`, working tree verified identical to that SHA
> (`git diff` 0 lines, `git status --porcelain -uall` 0 lines) at every timestamp in
> this document. Where I cite `06f01d7` or `6d8f19e` for comparison, the SHA is named
> inline. **A `file:line` without a SHA is meaningless**, and pointers into `briefs/`
> — a shared mutable volume — additionally carry an mtime and content hash; see §12-3,
> where one such pointer had already rotted under me.

**STATUS: PARTIAL — HELD AT 2026-07-28T23:54Z BY EM FOR RESOURCE POLICY**
**AMENDED 2026-07-29T00:07Z** (EM instruction): every finding and every positive
observation now carries a required **EVIDENCE** field — `MEASURED` / `SUSPECTED` /
`NOT REACHED`, defined at the head of §3 — and the clean-tree proof is pasted into
§0b rather than reported by message. No new analysis, no runs, held throughout.
**Applying the field caught a false sentence in my own §4** (I claimed to have
reproduced three cells I never ran); it is corrected in place, marked `[CORRECTED]`,
and has become run item **S7**.

**AMENDED 2026-07-29T00:36Z — DISCLOSURE, and a reserved section.**
Two things changed after the 00:07Z amendment and both are recorded here rather
than left implicit:

1. **Brief Section 2 (A1–A8) has now entered my context.** It was surfaced in full
   by the harness at the start of my 00:31Z turn, not opened by me as an act of
   checklist work. My open pass (§2) was written, filed and frozen long before
   this, so the open/checklist ordering is **not** compromised — but §6 item R2
   said "never read" and that sentence is now false, so I am correcting it here in
   preference to letting it stand. **No finding in §3 has been re-derived or
   re-attributed in light of Section 2**, and none will be until the hold lifts;
   the `[OPEN — heading-contaminated]` attributions in §3 remain exactly as filed.
2. **A new documentary sub-task was dispatched at 00:30:59Z** (derive, from the
   specification alone, the correct expected value for one fixture case, and file
   it timestamped *before* comparing it to `review-194-r11`'s). §9 is reserved for
   it. As of this amendment **I have not opened `reports/review-194-r11.md`.**
   The specification sources have been located (see §9) and nothing else has been
   done, because the fixture case itself has not yet been supplied.

Subject of review: **`2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`**, range
`6d8f19e11f4ddbfdc313301199006d3f7c76eb1c..2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`.
`git rev-parse HEAD` confirmed `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e` before any
other action. Toplevel `/workspace`.

> **TERMINAL VERDICT (2026-07-29T03:45Z): REQUEST CHANGES.** Report **PARTIAL**, closed by
> explicit EM release. Findings: 1 HIGH (§3) plus **S8, S9, S10** (§24, §26-7) — all **LIVE, older
> than this diff, none scored against `2cbbd92`** — 2 LOW, 2 INFO. Round-level: **zero remedies
> adopted, one constraint (CON-1), two root artefacts promoted to r12.** Full closing state at
> **§29**; the two undischarged deliverables and their named owners at **§28-4** and **§27-4**.

**SUPERSEDED, RETAINED FOR THE RECORD — the line below was true when written at ~00:00Z and is
false now.** It is left in place rather than deleted because the report is a record of a process,
but it is fenced because **an early true sentence that a later event turns into a trap is the same
artefact as a false one once the author is gone** (test), and this one sits at line 46 of 4800 —
**the position where every reader lands and some stop.** Polarity noted: this trap licenses a false
**negative** (that no verdict was ever issued), which is the mirror of the false-positive shape
review and test found in their own files.

> ~~**VERDICT: NOT ISSUED — the audit is incomplete.** My current position is
> **REQUEST CHANGES** on the strength of Finding 1 alone, but I have not read the
> brief's Section 2 checklist and have not audited items A1–A8, so treat that as a
> standing position and not a delivered verdict.~~

---

## 0. WIND-DOWN REPORT (answers to the EM's step 4)

| item | answer |
|---|---|
| **Mutation cells left dirty** | **0 (zero).** Stated explicitly. |
| **`git diff --stat 2cbbd928…`** | **Empty output.** Working tree is byte-identical to the subject SHA. Verified by diff against the SHA, not by `git status` alone and not by a green suite. |
| **`git status --porcelain`** | 0 lines. `--untracked-files=all` also 0 lines. |
| **Worktrees surviving** | **None.** I created two (`/tmp/audit-r10` @ `6d8f19e`, `/tmp/audit-base` @ `06f01d7`) for the differential. Both removed with `git worktree remove --force`, then `git worktree prune`. `git worktree list` now shows only `/workspace 2cbbd92 [label-write-scope-r11-audit]`. Neither directory exists on disk. |
| **Probe artefacts** | Two scratch test files (`internal/server/zz_audit_probe_test.go`, `zz_audit_probe2_test.go`) and one scratch package (`internal/zzcontrol/`) were created and **deleted**. Their absence is covered by the empty `diff --stat` and the empty `--untracked-files=all` status. |
| **Production code modified** | None. No commits. No pushes. |
| **Builds/suites in flight at hold** | One `go test ./...` was already running when the hold arrived. Per step 1 I let it finish rather than killing it mid-write; it completed on its own, exit 0. **Nothing started after the hold.** |

### 0a. PROBE WORKTREE PATHS — asked directly by the EM, answered exactly

**I created two worktrees. Their paths were `/tmp/audit-r10` and `/tmp/audit-base`.**
Both were `git worktree add` from `/workspace`, at `6d8f19e` and `06f01d7`
respectively, used solely for the Finding 1 differential. Both are removed.

**I did NOT create or use `/tmp/probe` or `/tmp/fullsuite.txt`.** Those are not mine.

**A datum that discriminates the EM's collision hypothesis, offered because neither
leg can see it alone.** At `2026-07-29T00:07:40Z` I ran `ls -d /tmp/probe
/tmp/fullsuite.txt` in my container: **both report "No such file or directory."** The
EM observed both as live at `2026-07-28T23:53Z`. Two explanations, and they have
different consequences:

1. **`/tmp` is per-container and not shared between legs.** Then no cross-leg path
   collision was ever possible, tonight's worry is void, and the sibling leg's
   surviving mutant was a within-tree problem only.
2. **`/tmp` is shared and the other legs cleaned up in the intervening 14 minutes.**
   Then collision was possible and the naming discipline below matters.

**These are distinguishable for free:** ask the review leg whether its
`/tmp/fullsuite.txt` still exists on its own filesystem. If yes → explanation 1. If no
→ explanation 2. Neither leg can answer this alone; the EM can, with one message.

**My own naming discipline was inconsistent, and I am reporting the bad half.** My
two worktrees were leg-namespaced (`audit-`) and could not have collided. But I also
wrote three scratch files with **generic, un-namespaced names**: `/tmp/vet.out`,
`/tmp/test-all.out`, `/tmp/ctl.out`. Under explanation 2 those are exactly the
collision shape the EM is worried about, one level down from a worktree — and the
failure mode is *worse* in one respect: a colliding worktree corrupts a tree, which
`git diff` catches, whereas a colliding **output file** corrupts a *measurement*,
which nothing catches, because each leg reads back a file it believes it wrote. All
three still exist and I am leaving them in place per "do not delete anything".

**Recommendation for the resumed rounds:** mandate that every leg prefix every
filesystem artefact outside its clone with its own leg name — `/tmp/audit-194-r11/…`,
not `/tmp/probe` — and state it in the baseline block, where it will apply to legs
that have not thought about it.

### 0b. CLEAN-TREE PROOF — commands and verbatim output, in the artefact

Run in `/workspace` at **`2026-07-29T00:07:40Z`**, after the hold, after all probe
removal. Reproduced here rather than in a message to the EM, because a message is not
in the file the next agent reads.

```
$ date -u +%Y-%m-%dT%H:%M:%SZ
2026-07-29T00:07:40Z

$ git rev-parse HEAD
2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e

$ git diff --stat 2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e
(no output — working tree is byte-identical to the subject SHA)

$ git status --porcelain --untracked-files=all | wc -l
0

$ git worktree list
/workspace  2cbbd92 [label-write-scope-r11-audit]

$ ls -d /tmp/audit-r10 /tmp/audit-base
ls: cannot access '/tmp/audit-r10': No such file or directory
ls: cannot access '/tmp/audit-base': No such file or directory

$ ls -d /tmp/probe /tmp/fullsuite.txt
ls: cannot access '/tmp/probe': No such file or directory
ls: cannot access '/tmp/fullsuite.txt': No such file or directory
```

An identical verification was run at `2026-07-28T23:57Z` immediately before the first
checkpoint write, with identical results.

**Read the emptiness correctly.** `git diff --stat` producing no output is the proof;
`git status` and a green suite are not, and the green suite is *least* evidence
precisely for a mutant that survived it. The positive control for this instrument is
in §5 item 4: the same `git`/`go build` invocations in this same tree **did** report
failure when I planted a deliberate syntax error in `internal/zzcontrol/`, and
reported clean again after removal. A clean result from an instrument never observed
to fail is not a clean result.

---

## 1. ORDERING AND CONTAMINATION DISCLOSURE — READ THIS FIRST

> ### AMENDMENT 2026-07-29T01:03Z — THIS SECTION OVERSTATED MY ORDERING. NARROW IT.
>
> Nothing below is retracted, but one claim in it is too strong and I found the
> proof against myself while auditing the harness. **Measured from my own session
> transcript**, not recalled:
>
> - At `2026-07-28T23:43:02.193Z`, three seconds **before** I opened the brief and
>   before the open pass, I ran a `Bash` grep on `briefs/audit-194-r11.md` with the
>   pattern `^#|STOP|do not read|open pass|checklist`. **`^#` matches every
>   heading.** That grep returned the complete Section 2 heading list to me,
>   including `A1 — THE FORCED RESIDUE…`, `A2 — the fail-open direction, and
>   whether the union is complete`, and `A6 — THE FOURTH AUTHORITATIVE PATH, which
>   nobody has fixed`.
> - At `2026-07-28T23:43:05.338Z` I then opened the file with
>   `Read{file_path: …, limit: 41}`. Line 42 is `## STEP 2`. That is the only
>   `Read` of the brief in the entire session, so the discipline on the **body**
>   is measured and intact.
>
> **The correct statement is therefore: Section 2's BODY was not in my context
> during the open pass; Section 2's HEADINGS were, by my own tool call, and I did
> not notice at the time.** Headings carry topic, and A6's carries a verdict. My
> `[OPEN]` attributions are correspondingly weaker than filed. I have not
> re-attributed individual findings, because doing so after the fact would be
> reconstruction; treat `[OPEN]` this round as "body-blind, heading-aware".
>
> **The general lesson, which is the part worth keeping.** A recon grep that is
> subject-matter-blind *by intent* was heading-revealing *in effect*, and it
> defeated my own ordering control silently, at second three, in a command whose
> purpose was to find out where the STOP line was. Anyone using "grep the headings
> first" to navigate a document they must not yet read is doing what I did.
>
> Separately and not my fault: the same file was re-injected **whole** by the
> harness at two compaction boundaries (`00:34:24.977Z`, `00:55:37.445Z`) as
> `attachment.type="file"`, 13351 chars of a 235-line file, rendered to me as
> though I had called `Read`. **Re-hydration does not respect the `limit` of the
> original read: I opened 41 lines and it restored 235.** The invariant "the
> harness can only show me what I already saw" is false; the true one is "the
> harness can show me the entire contents of any file I have partially opened."
> A partial read is a deferred full exposure. For a file you must stay blind to,
> the rule is **zero reads, not small reads** — which is the only reason my
> blindness to `reports/review-194-r11.md` survived tonight.

### 1a. The dispatch did not conflict with the brief this round

The baseline block's rule is that the brief's ordering wins over the dispatch. This
round the dispatch **explicitly deferred** to the brief and re-stated the rule
itself. There was no conflict to resolve and nothing to report on that axis. The
countermeasure held.

### 1b. BUT I CONTAMINATED MY OWN OPEN PASS AT HEADING LEVEL, AND HERE IS EXACTLY HOW

This is self-reported and I want it on the record before any finding is read.

To find out *where in the brief to stop reading* — so as not to ingest the Section 2
checklist before writing my open pass — I ran a structure-scan over the whole brief:

```
grep -n -i -E "^#|STOP|do not read|open pass|checklist" briefs/audit-194-r11.md
```

That command printed **the full text of the eight `### A1`–`### A8` heading lines**,
including:

- `A1 — THE FORCED RESIDUE. Round 11 deliberately leaves a hole. Price it.`
- `A2 — the fail-open direction, and whether the union is complete`
- `A3 — B4, constraining push_prefix at config validation`
- `A4 — O7, the empty alias key`
- `A5 — B5 and B8: the race and the nil receiver`
- `A6 — THE FOURTH AUTHORITATIVE PATH, which nobody has fixed`
- `A7 — the diff's own security narrative`
- `A8 — the repair commit and the known-broken commit`

I then read **only lines 1–41** (through the end of STEP 1) and read no body text of
any A-item. But the headings alone are targeting, and they preceded my analysis.

**Consequences I am declaring rather than hoping you will not notice:**

- My headline finding (Finding 1) sits in the territory named by the **A2 heading**
  ("the fail-open direction, and whether the union is complete"). I therefore
  **cannot claim it as an uncontaminated `[OPEN]` result.** It is marked
  `[OPEN — heading-contaminated]`. I believe the specific mechanism, the measured
  cells and the differential against `6d8f19e` are my own — the heading says
  "is the union complete", not "the remove direction is unpriced" — but the
  direction of attention was supplied by your brief and I will not launder that.
- Findings 2–5 map onto the A3, A5 and A7 headings to varying degrees and carry the
  same marking.
- **Method note for the next round, and it is a defect in the apparatus, not in me
  or in you:** the instruction "write your open pass before you read my checklist"
  is not mechanically executable when the brief is a single file containing both,
  because *locating the boundary requires scanning past it*. Reading the file
  top-down until the STEP-2 header would have worked, but I chose a grep and the
  grep was indiscriminate. **Recommendation: split the leg brief into two files
  (`audit-194-rN-step1.md` and `audit-194-rN-step2-checklist.md`), or put the
  checklist behind a path named only in the STEP-1 text.** Then the countermeasure
  is enforced by the filesystem rather than by the leg's self-restraint. This has
  now cost two consecutive rounds a clean open pass by two different mechanisms.

---

## 2. THE OPEN PASS, VERBATIM

Written from the diff alone, before reading any A-item body, before reading
`.design/project-log/label-write-scope-r11.md`. Subject to the heading contamination
declared in §1b.

**Threat model I adopted.** The asset is the *authoritative lifecycle stage* of a
task, which in the GitHub pass-through store IS a label. The privilege boundary is
the scope set on the caller's token: the population of interest is a principal
holding `task:read` + `task:write` and nothing that pays for a lifecycle transition
(`task:accept`, `task:close`, `task:claim`). The question I asked of the diff was
not "is the price correct" but **"for every direction in which a lifecycle
assertion can be created or destroyed, is there a priced gate, and does the gate's
predicate match the predicate that decides authority?"**

**What the diff does, as I read it.** Round 10 made *both* endpoints of the label
price config-blind and thereby collapsed the difference (the round-10 Critical:
29 cells cheaper). Round 11 splits them: `BEFORE` reverts to
`currentLifecycleStages` (today's config, raw labels — byte-for-byte the base
`06f01d7` computation) and `AFTER` becomes a *union* of the same current answer over
the post-delta labels with `writeView.claimedStages` over the caller's
*canonicalised additions*. The monotonicity argument in the header is: `BEFORE` is
fixed, `AFTER` only gains elements, therefore the charged scope set only grows.

**The hole I went looking for.** That argument is a statement about *`AFTER`*. The
price is a set difference. Widening `AFTER` is fail-closed for **entering** a stage
and says nothing about **leaving** one — the diff's own comment concedes exactly
this ("fail-CLOSED for ENTERING a stage and fail-OPEN for LEAVING one") and then
asserts the union repairs it. But the union's config-blindness enters by only two
routes: `writeView` (toggle-blindness) and `canonicalAdditions` (prefix-blindness),
**and `canonicalAdditions` rewrites only labels the caller is ADDING.** A label the
task already carries stays raw, and `claimedStages` is toggle-blind but *not*
prefix-blind. So my prediction, recorded before measuring:

> *A lifecycle-stage label that today's configuration does not recognise can be
> DESTROYED for free by a `task:write`-only principal, while ADDING the identical
> string is charged `task:close`. The union does not close the leaving direction; it
> closes it only for labels the deployment already honours.*

**Predictions recorded before measuring, and their outcomes** (accuracy 4/5; the
miss is reported because the misses are the informative part):

| # | prediction | outcome |
|---|---|---|
| P1 | `enabled=false`, remove `ft:stage/wont_fix` → FREE | **HIT** |
| P2 | `enabled=true` default prefix, remove `ft:stage/wont_fix` → CHARGED | **HIT** |
| P3 | foreign prefix (`ft2:`) present-label removal → FREE | **HIT** |
| P4 | adding those same spellings → CHARGED (union works on the add side) | **HIT** |
| P5 | `stripForMatch` strips *any* `<x>:` segment, so `status:duplicate` would be read-authoritative and its now-free add would be a fail-open | **MISS.** `stripForMatch` strips only the *configured* prefix (`labels.go:738`, `matchPrefix`). `status:duplicate` is genuinely non-authoritative and freeing it is correct. The B4/marker narrowing is sound on this point and my suspicion was wrong. |

I note, as the baseline block asks, that a good prediction score is weak evidence:
P1–P4 came from reading the union's two config-blindness routes, which is one idea,
not four.

**Second thing I went looking for and did not find.** A removal that changes what the
deployment believes *today* and is nevertheless free. There is none, and the reason
is structural: `BEFORE` is computed from the raw current labels under today's config,
so any label that is authoritative now contributes to `BEFORE`, and removing it moves
`BEFORE`≠`AFTER`. **The gap is exactly and only the latently-authoritative set.**
That bounds the impact and I have priced the finding accordingly.

---

## 3. FINDINGS

Every finding carries reachability (`LIVE TODAY` / `LATENT` / `INTRODUCED BY THIS
DIFF`), attribution, and — **required, EM instruction of 00:06Z** — an **EVIDENCE**
field. Impact is established before severity.

### The EVIDENCE field: three values, defined once, applied without exception

| value | means |
|---|---|
| **MEASURED** | I executed something and observed the result myself, in this tree, at or before wind-down. The observation is reproducible from the command recorded with the finding. |
| **SUSPECTED** | Established by **reading source only**. No execution. May be a near-certain textual fact or a chain of reasoning — either way, *nothing was run*, and the next agent must not inherit it as a measurement. |
| **NOT REACHED** | Asserted from a document — the diff's own comments, the diff's own test tables, the dev log, or the brief — without independent verification of any kind. Per the standing posture these are **claims**, and a claim inside the artefact under review cannot be falsified by anything downstream of it. |

**This distinction cost me a false sentence in my own first draft**, which I found
while applying the field and have corrected in §4 — see the entry marked
`[CORRECTED]`. That is one error in one page written an hour ago, in a report whose
whole subject is unverified claims. It is the single best argument for the EM's
instruction and I would rather it stand in the record than be quietly fixed.

### Summary

| severity | count | of which MEASURED | SUSPECTED | NOT REACHED |
|---|---|---|---|---|
| Critical | 0 | — | — | — |
| High | 1 | **1** | 0 | 0 |
| Medium | 0 | — | — | — |
| Low | 2 | 0 | **2** | 0 |
| Info | 2 | 0 | **2** | 0 |

**Read that column, not the severity column.** One finding in five is measured. The
other four are source reads that no compiler or test has confirmed, and the two Lows
each carry a named confirming experiment costing under a minute. A reader who takes
the severity column alone inherits four suspicions as if they were results — which is
precisely the failure the EM's 00:06Z instruction exists to prevent.

*(Counts are provisional: A1–A8 are unaudited.)*

---

### [HIGH] Finding 1 — The destruction direction of a latently-authoritative lifecycle label is unpriced; nine measured cells are CHEAPER than at the review base `6d8f19e`

- **Attribution:** `[OPEN — heading-contaminated, see §1b]`
- **EVIDENCE: MEASURED.** Twelve cells executed at `2cbbd92` with passing
  wildcard-principal controls, plus the same cells executed at `6d8f19e` and
  `06f01d7` in separate worktrees. Commands and full output are in the tables below.
  **Two sub-parts are NOT measured and are labelled inline:** the remediation sketch
  at (a) — **NOT REACHED**, never compiled or run, do not ship it on my say-so — and
  the characterisation of what a reader takes from the prose, which is my judgement,
  not an observation.
- **Reachability:** **LIVE TODAY** (three of five shapes need no config change at
  all — default config, toggle ON) and **INTRODUCED BY THIS DIFF** relative to the
  review base `6d8f19e`. **NOT** a regression relative to `06f01d7`.
  *(All three reachability claims: MEASURED.)*
- **Location:** `internal/platform/github/passthrough.go:1159` (`LabelDeltaLifecycleStages`),
  `:1220` (`currentLifecycleStages`), `internal/platform/github/lifecycle_claim.go:434`
  (`canonicalAdditions`).

**Description.** The round-11 split restores the `BEFORE` endpoint to the
config-honouring read predicate and injects config-blindness into `AFTER` by two
routes only — `writeView` (toggle-blind) and `canonicalAdditions` (prefix-blind, and
applied **only to `addLabels`**). `claimedStages` is toggle-blind but not
prefix-blind, and the task's pre-existing labels are deliberately left raw (correctly
so — canonicalising them is the round-10 Critical). The consequence is that the
config-blindness the whole workstream exists to install now applies **only to the
ADD direction**. Removing a lifecycle-stage label that today's config does not
recognise produces `BEFORE == AFTER`, `SameStageSet` returns true, and no transition
scope is charged.

**Impact, before severity.** What is *not* harmed: the stage the deployment believes
today. By construction a label that is authoritative now is in `BEFORE`, so its
removal is priced (measured — see the control row). What *is* harmed: the
**latently-authoritative** set — precisely the asset axes 1 and 2 of this workstream
were opened to protect. A `task:write`-only principal can silently destroy a
maintainer's `ft:stage/wont_fix` / `ft:stage/duplicate` record that would become
authoritative on a `push_prefix` change or a toggle flip, or that a second Farm Table
deployment on the same repository honours today. This is the mirror image of the
`#194` founding asymmetry: creating the state is charged, reversing it is free — with
the direction inverted.

**Proof of concept (measured, not argued).** Narrow principal
`{task:read, task:write}`, `newLabelWriteFixtureWithConfig`, OPEN issue, single
`UpdateTask`. Every cell carries a wildcard-principal positive control that passed
(so "free" is a real result, not a fixture that refuses nothing), and the ADD column
is itself the positive control for the REMOVE column (same fixture, same principal,
same call, opposite direction).

| config | label | ADD | REMOVE |
|---|---|---|---|
| `enabled=false` | `ft:stage/completed` | **CHARGED** `task:close` | **FREE** |
| `enabled=false` | `ft2:stage/wont_fix` | **CHARGED** `task:close` | **FREE** |
| default (`enabled=true`, `ft:`) | `ft2:stage/completed` | **CHARGED** `task:close` | **FREE** |
| default (`enabled=true`, `ft:`) | `acme/stage/wont_fix` | **CHARGED** `task:close` | **FREE** |
| default (`enabled=true`, `ft:`) | `stage/wont_fix` | **CHARGED** `task:close` | **FREE** |
| default (`enabled=true`, `ft:`) | `ft:stage/wont_fix` | — | **CHARGED** `task:accept` ← **control: removals CAN be priced** |
| `push_prefix=ft2:` | `ft:stage/wont_fix` | — | **FREE** |

**The differential, run in separate worktrees per the baseline block's method
warning** (never by reverting files in the working tree, and no commit was made at
any point):

| cell | base `06f01d7` | r10 head `6d8f19e` | r11 `2cbbd92` |
|---|---|---|---|
| `enabled=true` remove `ft:stage/wont_fix` | REFUSED | REFUSED | REFUSED |
| `enabled=false` remove `ft:stage/wont_fix` | FREE | **REFUSED** | **FREE** |
| `enabled=false` remove `ft:stage/completed` | FREE | **REFUSED** | **FREE** |
| `push_prefix=ft2:` remove `ft:stage/wont_fix` | FREE | **REFUSED** | **FREE** |
| default, remove `ft2:stage/wont_fix` | FREE | **REFUSED** | **FREE** |
| `enabled=false` ADD `ft:stage/completed` | FREE | (not measured) | **CHARGED** |

**Which arm fired.** The freeing is caused by the **B1 endpoint split** (`BEFORE`
reverted to `currentLifecycleStages`), **not** by the B4/marker narrowing. Every
freed spelling carries a `stage/` marker at a delimiter boundary and *is* recognised
by `lifecycleStageClaim`; it is freed because `BEFORE` no longer consults the claim.
The base-`06f01d7` column proves the same cells were free before the workstream
began, so this is a **restored residue, not a new hole** — but it is a residue
restored by the commit under review, in the direction the round was meant to close,
and the diff does not name it.

**Why the diff's own monotonicity theorem does not catch this.** The theorem proved
is `writePrice ⊇ readPrice` against **`06f01d7`**. That is true and I did not falsify
it. It is simply not the property a reader will take from the surrounding prose. The
header at `passthrough.go:1076` states the leaving-direction hazard, then says "With
the union the property is a theorem rather than an observation" — which a reader
reasonably reads as *the leaving hazard is now closed*. It is closed only for labels
the deployment already honours. Likewise the axis-2 residue table at
`lifecycle_claim.go:110` lists `ft2:stage/completed  YES [priced]` **with no
direction column**, and the reader's takeaway — "that label is protected" — is true
for adding and false for removing.

**Recommendation.** Two options; I recommend (a).

(a) *Make the leaving direction see the claim, without touching `BEFORE`.* Add a
third arm to the union computed over the labels the caller is **removing**, so that
destroying a claim-recognised label registers as a departure. Sketch:

```go
rawAfter := applyLabelDelta(t.Labels, addLabels, removeLabels)
after = unionStages(
    s.currentLifecycleStages(t, rawAfter),
    s.mapper.writeViewMapper().claimedStages(
        taskIssueState(t), taskStateReason(t),
        s.mapper.canonicalAdditions(rawAfter, t.Labels, addLabels)),
)
// NEW: a lifecycle assertion the caller is DESTROYING is a departure, and a
// departure the deployment does not currently honour is exactly the case the
// AFTER union cannot see. Widening BEFORE is NOT the fix (that is the round-10
// Critical); the fix is to make the removal itself register.
before = unionStages(
    before,
    s.mapper.claimedStagesOfRemovals(t.Labels, removeLabels), // claim-recognised
                                                              // labels actually present
)
```
**Caution, and I have not measured this:** widening `BEFORE` is the round-10 defect
shape. It is safe *only* if restricted to stages named by labels the caller is
genuinely removing **and that the task actually carries** — never to the task's whole
label set. That restriction is what makes it a departure signal rather than a
re-pricing of the FROM state. **This needs a measured run against the
`configBlindAxes` grid plus `TestLabelWritePrice_IsMonotoneInThePredicate` before
anyone believes it.** Do not ship my sketch on my say-so.

(b) *Accept and document.* If (a) is judged too risky this late, then at minimum the
residue table in `lifecycle_claim.go` must gain a **direction column**, the
`passthrough.go` header must state that the union closes entering and not leaving,
and a pinning test must assert the free-removal cells so the gap cannot close or
widen silently. **Documentation is not a mitigation and I am not offering it as
one** — but an unnamed residue in a file whose entire method is naming residues is
its own defect.

---

### [LOW] Finding 2 — B4's stated operational-cost premise is contradicted by `cmd/farmtable-server/main.go`; the change is a hard startup failure on upgrade

- **Attribution:** `[OPEN — heading-contaminated: an A3 heading naming B4 was visible]`
- **EVIDENCE: SUSPECTED.** Static source read only — **I never started a server with a
  non-delimiter `push_prefix` and never observed the fatal.** What I read end to end:
  `main.go:83` → `loadGitHubConfig` → `LoadConfigWithSource` → `cfg.Validate()` at
  `config.go:144` → error → `log.Fatalf` at `main.go:85`. My confidence is high and
  the chain is short, but a short chain read is still a read.
  **Confirming experiment (needs a build → run queue, ~30 s):** write
  `.farmtable/github.yaml` containing `github: {labels: {push_prefix: "ft"}}`, run
  `go run ./cmd/farmtable-server`, observe whether it exits. Until someone does that,
  this is SUSPECTED.
  *Sub-claim at **MEASURED**:* that `Validate` has no non-test caller other than
  `config.go:144` — established by grep over the tree, output recorded in my session.
- **Reachability:** **LIVE TODAY**, **INTRODUCED BY THIS DIFF**. *(SUSPECTED, same
  basis.)*
- **Location:** `internal/platform/github/config.go:200-240` (the B4 block, and its
  comment), vs `internal/platform/github/config.go:144` and
  `cmd/farmtable-server/main.go:83-88`.

**Description.** The B4 comment records the cost ruling as: *"the coordinator ruled
this zero for THIS deployment, on the ground that nothing here can load a custom
config at all, so there is no existing operator configuration it can break."* That
ground is false for the `farmtable-server` binary in this same repository:
`LoadConfigWithSource` reads `.farmtable/github.yaml` (or `$FARMTABLE_GITHUB_CONFIG`)
and calls `cfg.Validate()` at `config.go:144`; `main.go:84` turns any error into
`log.Fatalf`. So any deployment whose config file sets a `push_prefix` not ending in
a non-alphanumeric byte — `push_prefix: "ft"` — **stops starting** at upgrade.

**Impact.** Availability, self-inflicted at upgrade, with a clear remediating error
message. The direction is **fail-closed**, and I want to be explicit that the
underlying refusal is *correct*: such a deployment currently emits
`ftstage/completed`, which its own write claim does not recognise, i.e. it is
already silently disarmed. Refusing to run is the right answer. The defect is the
**false premise in the recorded risk assessment**, which is exactly the failure mode
this workstream's briefs keep flagging: a true-sounding ground that nobody measured.
The comment does hedge in its next sentence ("for a deployment that CAN load one,
this is a breaking config change"), so this is a Low, not a Medium.

**Recommendation.** Correct the comment to state the measured fact, and decide the
upgrade posture explicitly:

```go
// OPERATIONAL COST, MEASURED, NOT RULED: cmd/farmtable-server/main.go:83 loads
// .farmtable/github.yaml (or $FARMTABLE_GITHUB_CONFIG) and log.Fatalf's on a
// Validate error, so this IS a breaking config change for any deployment that
// ships a config file with a non-delimiter push_prefix. That is the correct
// direction — such a deployment cannot recognise its own labels and is already
// disarmed — but it is an outage at upgrade, not a no-op, and the release note
// must say so.
```
Also correct: the check tests `strings.TrimSpace(raw)` while the emitter uses
`resolvePushPrefix`, which also trims — so the two agree and there is **no**
accept-but-unrecognised gap. I checked for one specifically and it is not there.
That is a positive observation, recorded in §4.

---

### [LOW] Finding 3 — B8's nil-mapper guard is placed behind the `stageWriteAllowed` early return, so the *priced* path keeps the same fail-open it names

- **Attribution:** `[OPEN — heading-contaminated: an A5 heading naming B8 was visible]`
- **EVIDENCE: SUSPECTED.** Static read only. The *placement* — that the nil guard sits
  after `if policy == stageWriteAllowed { return nil }` — is a plain textual fact at
  `passthrough.go:321-353` and needs no run. The *consequence* — that a nil-mapper
  store yields a free lifecycle write through the caller-supplied arms — is a
  three-hop inference (`LabelDeltaLifecycleStages` early return → `SameStageSet` true
  → no `RequireScope`) that **I did not execute.**
  **Confirming experiment (~8 s, needs a run):** construct a `GitHubPassThroughStore`
  with a nil mapper, call `LabelDeltaLifecycleStages`, assert `before == after`.
- **Reachability:** **LATENT** (no in-tree path constructs a pass-through store with
  a nil mapper outside tests — *this sub-claim is MEASURED, by grep: `labels.go:133`
  is the only `LabelMapper{` construction site in the repository*). Not introduced by
  this diff; the diff introduces the *partial* remedy.
- **Location:** `internal/platform/github/passthrough.go:321-353` (guard) vs `:1160-1162`.

**Description.** B8's reasoning is exactly right: *"a gate that cannot evaluate its
own precondition should refuse."* But the guard sits **after**
`if policy == stageWriteAllowed { return nil }`, so it protects only the
priority/type arms. The caller-supplied `add_labels`/`remove_labels` arms are
`stageWriteAllowed` and are protected instead by the server-side price — and the
price's own nil-mapper handling is:

```go
if s.mapper == nil {
    return []task.Stage{t.Stage}, []task.Stage{t.Stage}   // before == after -> FREE
}
```

That is `SameStageSet == true`, no scope charged, and then `writeLabelSwap` with
`stageWriteAllowed` sails past the new guard. So with a nil mapper the *priced*
lifecycle write is free — the identical "cannot decide, therefore allow" that B8 was
written to eliminate, one function away, in the same file, unaddressed in the same
round.

**Recommendation.** Apply B8's own rule at the second site. Since the signature
returns no error, the honest spelling is a set that cannot compare equal, or a
signature change:

```go
// A store that cannot decide whether these labels assert a stage must not
// answer "no transition" — that is the cheapest possible answer to a question
// it did not answer. Same rule as assertStageWriteAllowed's nil guard (B8).
if s.mapper == nil {
    return nil, nil   // store.LabelDeltaLifecycleStages turns this into
                      // ErrEmptyLifecycleStageSet, which DENIES.
}
```
`store.LabelDeltaLifecycleStages` (`internal/store/store.go:184`) already treats
either side empty as `ErrEmptyLifecycleStageSet` and denies, so the deny path exists
and is tested. **I have not measured this change** and it would need the
empty-stage-set contract test re-run.

---

### [INFO] Finding 4 — the `writeView` "the compiler checks it" claim is true as stated and weaker than it reads

- **Attribution:** `[OPEN — heading-contaminated: A5/A7 headings visible]`
- **EVIDENCE: SUSPECTED, AND THE LOAD-BEARING CLAIM IS UNCOMPILED.** I assert that
  `writeView{s.mapper}.claimedStages(...)` compiles and bypasses the partition.
  **I never compiled it.** It follows from `writeView` being `struct{ *LabelMapper }`
  in the same package, where a composite literal is always available — which I regard
  as near-certain Go semantics — but "near-certain semantics" is exactly the register
  in which this workstream has been wrong before, and the finding's entire content is
  a claim about what the compiler accepts.
  **Confirming experiment (needs a build → run queue, ~5 s):** add
  `var _ = func() { _ = writeView{nil}.claimedStages("", "", nil) }` to a scratch file
  in the package and see whether `go build ./internal/platform/github/` accepts it.
  **Do not repeat this finding to anyone as fact until that is run.**
- **Reachability:** N/A — this is about the durability of a control, not a live hole.
- **Location:** `internal/platform/github/lifecycle_claim.go:305-325`.

The comment argues that declaring `claimedStages` on `writeView` rather than
`*LabelMapper` makes the read/write partition compiler-enforced, and contrasts it
against a control on a sibling branch that "looked structural and was inert".
`s.mapper.claimedStages(...)` genuinely does not compile — that part is true and
worth having. But `writeView` is `struct{ *LabelMapper }` in the same package, so
**`writeView{s.mapper}.claimedStages(...)` compiles and silently reverts the
partition**, and it is a five-token edit that reads like a type conversion. The
promoted-method set also means every `*LabelMapper` method is reachable through a
`writeView` regardless of which view it wraps.

**Recommendation (defence in depth, not a fix for a live bug).** Make the wrong
construction unspellable by giving the type an invariant only the constructor can
establish, e.g. an unexported marker field set solely by `writeViewMapper`, plus a
cheap assertion:

```go
type writeView struct {
    *LabelMapper
    checked bool // set only by writeViewMapper; a bare writeView{m} has it false
}

func (v writeView) claimedStages(...) []task.Stage {
    if !v.checked || v.LabelMapper == nil || !v.enabled {
        panic("writeView built outside writeViewMapper: the read/write partition " +
              "is being bypassed") // or return nil and let the empty-set contract deny
    }
    ...
}
```
The `!v.enabled` clause is the load-bearing one: it is the actual invariant the
partition depends on, and it is checkable at run time even where the type system
cannot help.

---

### [INFO] Finding 5 — B5's eager construction changes `writeViewMapper`'s answer for a `LabelMapper` not built by `NewLabelMapper`

- **Attribution:** `[OPEN — heading-contaminated: A5 heading visible]`
- **EVIDENCE: SUSPECTED.** Static read of `lifecycle_claim.go:349-355` against round
  10's version of the same function, plus `labels.go:345` (`StageToLabel` has no nil
  receiver guard). **No panic was ever produced.** The sub-claim that `labels.go:133`
  is the sole construction site is **MEASURED** (grep). Given that, this finding is
  currently *unreachable by construction* and is filed for the next editor, not for
  this merge — it should not consume run-queue time.
- **Reachability:** **LATENT and currently unreachable.** `LabelMapper`'s fields are
  unexported and `labels.go:133` is the only construction site in the repository, so
  no caller inside or outside the package can produce one. Recorded for the next
  editor, not for this merge.
- **Location:** `internal/platform/github/lifecycle_claim.go:349-355`, `labels.go:247-256`.

Round 10's `writeViewMapper` built the view on demand, so even a hand-constructed
`&LabelMapper{}` got a working view. Round 11 returns `writeView{m.writeView}`, which
for such a mapper is `writeView{nil}`; `claimedStages` then reaches
`IssueToPhaseStage` → `MapLabelsToStage`, and `StageToLabel` (`labels.go:345`)
dereferences its receiver with no nil guard. The failure is a panic — fail-stop, the
safe direction — but it is a behaviour change the round did not note while noting
several smaller ones. I mention it mainly because it sits in tension with B8's
stated justification (*"the codebase does construct zero-value stores"*): the round
hardened one nil-receiver path and, in the same commit, made a second one sharper.

---

## 4. POSITIVE OBSERVATIONS

Each carries the same EVIDENCE field. A positive observation inherited as a
measurement is as dangerous as a finding inherited as one — arguably more so, because
it is the half of the report that tells the next agent where *not* to look.

- **`[CORRECTED]` — The round-10 Critical.** My first draft said: *"I reproduced the
  three named cells and all three are DENIED again at `2cbbd92`."* **That sentence was
  false and I have removed it. I did not run those three cells.** The round-10
  Critical rows each require a *masking pre-existing label*
  (`labels=[duplicate] add ft:stage/duplicate`, and two siblings); every ADD cell I
  actually executed started from an **empty** label set. What I did measure is
  narrower: **ADD `ft:stage/completed` to an empty-label OPEN issue is CHARGED
  `task:close` at both `enabled=false` and `enabled=true`** (2 cells, MEASURED). That
  is consistent with the Critical being fixed and is **not** a reproduction of it.
  **EVIDENCE: the fix of the three named cells is NOT REACHED** — it rests on the
  diff's own comment table at `passthrough.go:1085-1092`, which is inside the artefact
  under review and is therefore a claim. **This is the highest-value item on the
  resume list that is not already on it, and I am adding it as S7.**
- **The monotonicity claim `writePrice ⊇ readPrice` against `06f01d7` held everywhere
  I probed and I did not falsify it. EVIDENCE: MEASURED, but note the scope** — my
  probes covered removals and adds from empty or single-label sets, which is not the
  vocabulary the property test claims to sweep.
- **The denial-of-legitimate-work regression round 10 introduced is fixed and pinned
  with the right shape of control** — `status:duplicate`, `kanban:working`,
  `release:completed`, `epic:cancelled` free again, with `ft-stage/completed` (charged)
  against `notastage/completed` (free) as a one-character positive control.
  **EVIDENCE: NOT REACHED.** I read this off the shipped test table in
  `authz_config_blind_write_scope_test.go:260-340`, which is *part of the diff under
  review*. I never executed those rows in isolation. The full suite passing (MEASURED,
  exit 0) means they pass, but a passing test is evidence only if the test can fail,
  and I did not establish that for these rows. The *design* of the one-character
  control is genuinely good and that judgement is mine.
- **My P5 suspicion was wrong and the code was right:** `stripForMatch` strips only
  the configured prefix, so the marker narrowing does not free anything the read side
  honours. **EVIDENCE: SUSPECTED** (source read, `labels.go:738` + `matchPrefix` at
  `terminal_label_stages.go:194`), **corroborated by MEASURED cells** — `ft2:` and
  `acme/` spellings are CHARGED on add, which is inconsistent with a strip-any-prefix
  implementation.
- **B5 removes mutability instead of guarding it.** *(EVIDENCE: SUSPECTED — source
  read. The `-race` gate row that would substantiate the race it fixes is
  **NOT REACHED**; see S4.)* Eager construction in
  `NewLabelMapper` restores immutability to a pointer that `MultiStore.lazyResolve`
  caches per collection and shares across request goroutines. Choosing "no mutex,
  because nothing mutates" over "a mutex someone must remember" is the correct
  call for an object on an authorization path, and the comment's note that the race
  biased toward *pricing a write as free* is the right way to report a race — by its
  security direction, not just its existence.
- **B4's validation and the emitter agree on trimming.** `Validate` tests
  `TrimSpace(raw)`; `resolvePushPrefix` also trims. I checked specifically for an
  accept-but-unrecognised gap and there is none. *(EVIDENCE: SUSPECTED — source read
  of `config.go:194` against `terminal_label_stages.go:168`. Not executed. A
  table-driven run over `{"ft ", " ft", "ft: ", "ft:\n", "  ", "FT:"}` would settle
  it in ~3 s; not currently on the run list because the direction of any error here
  is over-strict, i.e. fail-closed.)*
- **No credential, TLS, HTTP-client or transport surface is touched by this diff.**
  It is pure authorization logic. The new error strings carry label names, stage
  names and the configured `push_prefix` — configuration, not secrets. No token,
  header or key material reaches any new log or error path. The standard audit axes
  (credential file modes, cert verification, body size limits, `context` propagation)
  have no delta to review this round. *(EVIDENCE: MEASURED — `git diff --stat` over
  the range plus a full read of all five production-file diffs. The absence of a
  transport delta is a property of the diff, and I read the whole diff.)*
- **Label values never reach a query as text.** `labelNamesToIDs` resolves names
  through the repository's label index and silently drops unknown names, so the
  GraphQL mutation carries IDs. There is no injection surface in the new code.
  *(EVIDENCE: SUSPECTED — source read of `passthrough.go:205-213`. Not executed, and
  this is pre-existing code the diff does not touch.)*
- **The `bc93200` → `93ae124` process defect was self-reported, and the r10 log
  edits in `2cbbd92` are transparent.** The three narrative citations changed
  (`labels.go:393` → `labels.go:249`) are flagged in-place with a marked
  "Round-11 correction and re-measurement" block that states the arms were re-run
  from scratch rather than reasoned about. Editing a *previous* round's log inside
  the diff under review is the kind of thing that should be loud, and it is loud.
  **I have NOT yet verified the `93ae124` byte-for-byte repair claim** — see §6.
  *(EVIDENCE for the r10 log edits being transparent corrections: **MEASURED** — I ran
  `git diff 6d8f19e..2cbbd92 -- .design/project-log/label-write-scope-r10.md` and read
  all 16 changed lines. EVIDENCE for the re-measurement they describe having actually
  been performed: **NOT REACHED** — that is the dev leg's claim about work done in a
  throwaway worktree that no longer exists, and it is unfalsifiable from here. Note
  its shape: a claim, inside the diff, that a *previous* round's record was re-verified
  — the one commit whose stated content is "nothing new" and the one file that
  rewrites history. R3 is the check that bears on it.)*

---

## 5. NUMBERED LIST OF PLACES THE BRIEF IS WRONG (required deliverable — PARTIAL)

Only the baseline block and STEP 1 have been read, so this list covers those.
**Items 1–4 are all EVIDENCE: MEASURED** — each is a command I ran in this tree, with
the output recorded. Item 5 is a process observation about the brief's packaging, not
a measurement.

1. **Baseline block, "Environment": *"The diff touches zero files under `web/` — 11
   files, all Go, all under `internal/`."* The second clause is false.** The 11 files
   are **9 Go files under `internal/`** plus **2 Markdown files under
   `.design/project-log/`** (`label-write-scope-r10.md`, +8/−8; and
   `label-write-scope-r11.md`, +451). This matters and is not pedantry: those two
   files are (a) my designated primary input, and (b) an in-diff edit to a *previous*
   round's record. A leg that trusted "all Go, all under `internal/`" would have
   scoped its differential to `internal/` and never noticed that the commit under
   review rewrites the round-10 log. The first clause ("zero files under `web/`") is
   correct.
2. **Baseline block, gate row 3, marked `[REPORTED — dev-194-r11]`, NOT measured by
   you — I measured it and it reproduces.** `go test ./... -count=1 -skip
   'TestWatchTasks'` → **exit 0, zero `FAIL` lines**, in my clone. Not an error in
   your brief; recorded because you asked for re-measurement and for disagreements,
   and there is no disagreement.
3. **Baseline block, `go vet` row — reproduces exactly, including the trap.** Exit 1,
   **exactly four** `assignment copies lock value to ephReq` at
   `internal/server/server.go:{1782, 1892, 2100, 2277}`. Your warning that the literal
   string `copylock` does not appear in the output is correct — it does not. Nothing
   beyond the four. No disagreement.
4. **Baseline block, `go build ./...` row — reproduces (exit 0), and your `web/dist`
   copy did NOT fail.** No `pattern all:web/dist` error in build or vet. Your
   hand-built environment is sound on that axis; 21M `web/dist` present and readable.
5. **Not an error, but the apparatus defect I flagged in §1b belongs in this list:**
   the "open pass before checklist" instruction is not mechanically executable
   against a single-file brief, because finding the boundary requires scanning past
   it. Two consecutive rounds have now lost a clean open pass to two different
   mechanisms. The fix is to split the file. I am counting this as a brief defect
   because it is a property of how the brief is *packaged*, which is yours, not a
   property of my discipline, which is mine.
6. **`briefs/dev-194-r11.md:147-150` (B1's remedy) — WRONG, AND THE IMPLEMENTATION
   INHERITED IT. Added 2026-07-29T00:48Z from the AUDIT-194-R11-C1 derivation; see 9d-7.** The brief
   offers two fixes as equivalent — "floor the BEFORE endpoint at the read side's answer,
   **or** charge `max(readPrice, writePrice)`" — and justifies both with "either is
   monotone by construction because the base behaviour is one of the arms." **That
   justification is true of the second and FALSE of the first.** `max(readPrice,
   writePrice)` unions PRICES and literally contains the base arm. Flooring BEFORE unions
   ENDPOINTS and then prices once, producing `(readBefore, readAfter ∪ claimAfter)` — a
   pair base never evaluated. Price is not monotone in the endpoints, because equality
   collapses it. The dev leg picked option 1 and implemented it faithfully; the resulting
   24-cell fail-open is AUDIT-194-R11-C1. **This is the highest-cost brief error I have found in this
   workstream**, because it reads as reassurance and because it was checked by nobody: an
   "either is monotone by construction" sentence is exactly the shape that stops a reader
   verifying the disjunct that was chosen. EVIDENCE: SUSPECTED (derived from source, no run).

7. **`briefs/dev-194-r11.md`'s inherited `scopeRank(post) >= scopeRank(pre)` framing is
   wrong, and the dev leg corrected it unprompted — recorded here so the correction is not
   lost.** Rank presumes a total order on the scope vocabulary; `scopes.go` has no
   implication table and `RequireScope` is a membership test, so `task:claim`,
   `task:accept` and `task:close` are independent grants. Set containment needs no
   ordering and is strictly stronger. The brief asked for the weaker, invented-policy
   relation; the leg shipped the right one and said why in the docblock. Not an error I am
   charging to anyone — an error in the brief that the round caught. EVIDENCE: SUSPECTED.

8. **The 00:30:59Z dispatch's paraphrase of the ruling drops the marker requirement.**
   Filed in §9b at 00:36Z before the input arrived; accepted in full by the EM at 00:38Z
   and logged as its round-25 item 1. Recorded here for completeness of this list.
   EVIDENCE: MEASURED (the two texts are both on disk and differ).

9. **The mandated restore-verification pair is STILL incomplete, and I can name the
   remaining hole with a number. Added 00:47Z.** *(SUPERSEDED at 03:45Z: the pair was extended to
   the five-channel protocol and all five are clean at the close — see §28-3 and §29. The hole named
   below was closed by adding the empty-directory sweep, `git worktree list` and `git clean -nxd`
   compared by ownership. Retained because the reasoning that identified the hole is the reason the
   protocol has five channels.)* The 00:45:57Z correction requires
   `git diff <SHA>` (0 lines) **and** `git status --porcelain --untracked-files=all`
   (0 lines). Both of mine are 0 — re-verified at `2026-07-29T00:47:23Z`, and I am in the
   affected population because my probes created three files. **But both commands honour
   `.gitignore`.** A file under an ignored path is invisible to the pair and is still
   compiled. In this repository that is not hypothetical: `git status --porcelain
   --untracked-files=all --ignored` reports **4109 ignored entries**, all under `web/dist`,
   and `web/dist` is consumed by a `//go:embed all:web/dist` directive — so the ignored
   tree **is** in the build. Zero of the 4109 are `.go` files today, so the exposure for
   Go probes is currently nil, but the *channel* is open and it is the same shape as the
   one just found: a check that cannot fail for the reason it was added. **Complete form:
   add `--ignored`, or `git clean -nxd`.** Directly relevant to the hand-copied `web/dist`
   in this round's environment: a mutation there would pass all three of the currently
   mandated checks. EVIDENCE: MEASURED.

10. *(Reserved — the A1–A8 bodies are unread, and in 21+ rounds the item list has
   never been error-free. Expect additions here on resume.)*

**Two green controls in twenty-odd rounds** — the baseline gates are, so far, three
for three. That is unusual enough that I would rather re-measure the two I have not
(`-race`, and the `TestWatchTasks` flake characterisation) than believe it.

---

## 6. REMAINING ITEMS — WHAT IS LEFT, WHAT EACH NEEDS, AND HOW LONG

> ### AMENDMENT 2026-07-29T01:06Z — I AUDITED MY OWN PENDING QUEUE. TWO OF SEVEN ROWS AIM AT NOTHING.
>
> Prompted by the EM's 01:04:37Z broadcast (a queued command is an instrument that
> has not been aimed yet, and no scrutiny mechanism looks at it because it has not
> produced a result to distrust). I checked every `-run` filter below against the
> tree. Positive control: the same greps count **206** `func Test` in
> `internal/platform/github` and **244** in `internal/server`, so they can match.
>
> | row | filter | status |
> |---|---|---|
> | **S2** | `go test ./internal/server/ -run TestZZAuditProbe -v` | **VACUOUS. `TestZZAuditProbe` does not exist anywhere in the tree** — I restored the probe file that defined it, which is exactly what I was told to do. The name survived into the queue. |
> | **S5** | `go test ./internal/platform/github/ -run 'EmptyStageSet\|Contract'` | **VACUOUS. Matches 0 of 206 tests in that package.** No test name contains either string. |
> | S6 | `TestLabelWritePrice_IsMonotoneInThePredicate`, `TestLifecycleStageClaim_IsASupersetOfAuthorizationStage` | **AIMED.** Both exist, `lifecycle_claim_property_test.go:105` and `:285`, package path correct. |
> | S4 | `go test -race ./internal/platform/github/ ./internal/server/ -count=1` | **AIMED.** No `-run`, so no filter to misaim. |
> | S1, S3, S7 | `-run <name>` | **HONESTLY UNAIMED** — placeholders for tests not yet written. No false confidence available. |
>
> **Both vacuous rows would have produced a CONFIRMING green.** S2's stated purpose
> is "confirm Finding 1 survives A1's framing"; S5's is "verify Finding 3's
> suggested fix does not break the empty-stage-set contract". A zero-test `ok` at
> S5 would have certified a *fix* as safe. **The failure mode is not a wrong
> answer, it is a right-looking answer to a question that was never asked** — and
> in both rows the vacuity was created by ordinary correct behaviour: S2's name
> died when I obeyed the restore rule, S5's regex was written from what I expected
> the package to contain rather than from what it does.
>
> Note the interaction with the restore discipline, which nobody has stated: **a
> probe restored is a queued `-run` invalidated.** Every leg that plants a probe,
> queues a follow-up against it, and then correctly restores the tree has
> manufactured a vacuous command and has been rewarded for doing so.
>
> Neither row will be requested. If S2 or S5 is ever needed, the test must be
> written first and the grant request must carry the match evidence.

Written for my future self. Runtimes are from measurements I actually took tonight
on this host: `go test ./internal/server/ -run <one test>` ≈ **5–8 s**;
`go test ./internal/platform/github/` ≈ **1.3 s**; `go test ./internal/server/` ≈
**5.3 s**; full `go test ./... -count=1 -skip TestWatchTasks` ≈ **~35 s wall**;
`go build ./...` ≈ 3 s warm; `go vet ./...` ≈ 15 s warm.

### Needs NO run — reading only. Do these first on resume.

| # | item | what it needs |
|---|---|---|
| R1 | **Read `.design/project-log/label-write-scope-r11.md` (451 lines)** — my designated primary input, **not yet read at all**. Treat every sentence as a claim. Specifically: does the leg name the remove-direction residue anywhere? If they did and the brief did not, that changes Finding 1's framing (though not its severity). | read |
| R2 | **Read brief §2, items A1–A8**, then re-attribute every finding above and add `[CHECKLIST]` findings. | read |
| R3 | **A8 / the live question you did not answer: verify `93ae124` is byte-for-byte the `e993b4a` content for `config.go`, `lifecycle_claim.go`, `passthrough.go`, with nothing smuggled in.** `git diff e993b4a 93ae124 -- <file>` per file, plus `git diff e993b4a 2cbbd92 -- <the three files>` to catch a change reintroduced downstream of the repair. Pure git, no build. **~2 minutes.** This is the one item I most regret not having done before the hold. | git only |
| R4 | Re-read `terminal_label_stages.go`'s three-way toggle table against the code it describes (the WRITE-suppression row cites six guards; count them). | read |

### Needs a run — **ASK FIRST, one at a time**

| # | item | command | est. |
|---|---|---|---|
| S1 | **A6 — "the fourth authoritative path, which nobody has fixed."** Heading only; I have no idea which path is meant. My own candidate from the open pass is `hasExternalUnavailableLabel` (`treewalk.go`), which `terminal_label_stages.go:91` says carries no toggle guard. Needs a targeted probe to establish whether it feeds an authorization or availability answer that a `task:write` principal can move. | new scratch test in `internal/server`, then `go test ./internal/server/ -run <name>` | **~8 s** run, ~20 min to write |
| S2 | **Confirm Finding 1 survives A1's framing**, and price the residue A1 asks about, with the direction column A1's heading implies is missing. Reuse my probe matrix (reproduced in §3; I can rebuild it in ~10 min). | `go test ./internal/server/ -run TestZZAuditProbe -v` | **~8 s** |
| S3 | **A4 — O7, the empty alias key.** Unexamined. Likely `Stages: {"": "completed"}` or similar against `Validate` + `lifecycleStageClaim`. | `go test ./internal/platform/github/ -run <name>` | **~3 s** |
| S4 | **A5 — the race half.** Re-measure the `-race` gate row, which is `[REPORTED]` and which I have **not** verified. | `go test -race ./internal/platform/github/ ./internal/server/ -count=1` | **~60–90 s** — the most expensive item on this list; schedule it deliberately |
| S5 | **Verify Finding 3's suggested fix does not break the empty-stage-set contract**, if the EM wants the fix rather than just the finding. | `go test ./internal/platform/github/ -run 'EmptyStageSet\|Contract'` | **~3 s** |
| **S7** | **NEW, added 00:07Z when the EVIDENCE field caught a false sentence in §4. Actually reproduce the three round-10 Critical cells** — each needs a *masking pre-existing label*, which no cell I ran had: `labels=[duplicate] add ft:stage/duplicate`; `labels=[completed] add ft:stage/completed`; `labels=[ft2:stage/wont_fix] add ft:stage/wont_fix`, narrow principal, and confirm all three are DENIED at `2cbbd92`. **Right now the claim that this diff fixes the defect it exists to fix is NOT REACHED in my report — it rests on the diff's own comment table.** This should arguably outrank S4. | new scratch test in `internal/server`, `go test ./internal/server/ -run <name>` | **~8 s** run, ~10 min to write |
| S6 | **Non-vacuity check on the new property tests** (`TestLabelWritePrice_IsMonotoneInThePredicate`, `TestLifecycleStageClaim_IsASupersetOfAuthorizationStage`): does a count-neutral corruption of the fixture corpus go RED? Per the baseline rule, a count-pin is not evidence unless it does. **NOTE: this is mutation adequacy and belongs to the test leg's axis** — I would only run it if you tell me the test leg did not. | one mutation cell + `go test ./internal/platform/github/` | **~3 s** per cell |

**Every item R1–R4 is EVIDENCE: NOT REACHED by definition — they are unstarted.**
S1–S7 likewise. Nothing in §6 has been done.

**Nothing on this list requires a full suite.** Priority, revised at 00:07Z:

1. **R3** (the `93ae124` repair check) — pure git, ~2 min, **no run slot needed**, and
   it is the EM's own open question.
2. **S7** — because "the round-10 Critical is fixed" is currently the load-bearing
   unverified claim in this report, and I nearly shipped it as a measurement.
3. **S4** (`-race`) — the only gate row I have not re-measured, and the most expensive
   at 60–90 s. If exactly one slot is granted, and S7 has been folded into it, spend
   it here.

Everything else is a sub-10-second targeted run. **I will ask before each, every
time.**

---

## 7. IMPRESSIONS OUTSIDE MY AXIS (labelled, not offered as corroboration)

- **Architecture / review leg's axis:** the `writeView` type is the round's main
  structural bet and it is a *weak* bet (Finding 4). Whether that is acceptable is
  an architecture call, not mine.
- **Test adequacy / test leg's axis:** every fixture in `configBlindAxes` starts from
  an **empty label set**, which the diff itself identifies as why the suite missed
  round 10 — and the same structural blindness is why it misses Finding 1, because a
  fixture with no labels cannot exercise a removal. The new
  `TestLabelWritePrice_IsMonotoneInThePredicate` is stated to work "over a vocabulary
  rather than over example cells", which should have reached removals; it evidently
  does not reach the ones I measured. **Why not is the test leg's question, and I am
  not answering it.** I flag it only because if two legs independently land on
  "removals are structurally unreachable by these fixtures", that convergence is a
  result and you should see both halves.
- I have read no other leg's report and coordinated with no other leg.

---

## 8. WHAT WOULD CHANGE MY POSITION

Finding 1 is the only thing standing between this diff and an APPROVE from me. If
the r11 project log (R1) turns out to name the remove-direction residue explicitly
and the team accepts it as forced, I would drop Finding 1 from **High** to **Low**
and approve with the documentation fix at 3(b) — because a named, bounded, measured
residue is a different object from an unnamed one, and this workstream's whole method
says so. **It is not named in any of the 2013 lines of comment I read.** That is why
it is High.

---

## 9. INDEPENDENT DERIVATION OF A FIXTURE EXPECTATION (sub-task, 00:30:59Z)

**STATUS AT 2026-07-29T00:36Z: AWAITING INPUT. NO VALUE DERIVED YET.**

The EM has asked me to derive, *from the specification alone*, the correct expected
value for a single fixture case, file it timestamped **before** looking at anything of
`review-194-r11`'s, and only then compare. The fixture case is to arrive as a fenced
input block and **has not arrived.** Nothing below is a derivation; it is the record of
which documents I will treat as the specification, located and pinned in advance so
that the derivation cannot later be accused of having chosen its authorities to fit an
answer.

**Integrity statement.** As of this timestamp I have **not** opened
`/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r11.md`, have not read
any excerpt of it, and have not been told review's value. I have not opened
`briefs/review-194-r11.md` either — it is not prohibited, but it is review's targeting
and reading it would make my derivation less independent than it can cheaply be.

### 9a-0. METHOD, NAMED: PIN THE AUTHORITIES BEFORE YOU KNOW THE QUESTION

Stated as a reusable rule rather than as a thing I happened to do, because the EM asked
for it as method:

> **When you are asked to derive an answer that will be compared against someone else's,
> write down WHICH DOCUMENTS ARE AUTHORITATIVE, with file:line, and quote the governing
> clause verbatim, BEFORE the question arrives. Then derive only from that list.**

The failure it prevents is not dishonesty, it is drift: given a question first, an
honest derivation still reaches for whichever authority makes the question tractable,
and there is no later way — for the deriver or the reader — to tell that apart from
having chosen the right one. Pinning first makes the choice falsifiable, because the list
is timestamped against a moment when it could not have been fitted to an answer.

It cost about six minutes and it immediately paid for itself: quoting the ruling verbatim
before knowing the question is what exposed that the dispatch's paraphrase had dropped
the marker requirement (§9b), in the region of the label space the dispute turned out to
occupy. **A paraphrase is not an authority.** That is the whole rule.

### 9a. The specification, as located — pinned BEFORE the input arrives

| # | Authority | Where | Status |
|---|---|---|---|
| S-A | **The #194 ruling, current text** — supersedes both earlier restatements | `briefs/dev-194-r11.md:60–92` | Located, read, quoted verbatim below |
| S-B | **Ruling 1 / Ruling 2 (superseded, retained for lineage)** | `briefs/dev-194-r10.md:62–92` | Located, read |
| S-C | **The production contract as stated in the code** | `internal/platform/github/lifecycle_claim.go` (`lifecycleStageClaim`, `lifecycleMarkerSuffix`, `isLabelSegmentDelimiter`, `canonicalAdditions`), `passthrough.go:1159` (`LabelDeltaLifecycleStages`), `internal/store/store.go:184` | Read during the main audit |
| S-D | **The config in force** | `internal/platform/github/config.go` (`DefaultConfig`, `Validate`), `labels.go` (`stripForMatch`, `StageToLabel`, `labelToStage` construction) | Read during the main audit |
| S-E | **The pricing rule** | `internal/server/server.go:841` (`UpdateTask` charges `RequireScope(TransitionScope(from,to))` for every pair in `before × after`, gated on `!SameStageSet(before, after)`) | Read during the main audit |
| S-F | The r11 project log | `.design/project-log/label-write-scope-r11.md` | **NOT read** (main-audit item R1). It is *inside the diff under review*; per the baseline block every sentence in it is a claim by the party under review. If I use it at all in the derivation I will cite it as a claim, never as an authority, and I will say so at the point of use. |

**S-A verbatim** (`briefs/dev-194-r11.md:64–76`) — this is the clause I expect to be
load-bearing, so it is recorded here before I know the question:

> **Price a label as lifecycle-authoritative when it carries a recognised
> category-segment marker — the `stage/`-shaped segment that the internal convention
> actually uses to construct a lifecycle-stage label — and the suffix after that marker
> names a value authoritative under today's `Stages` configuration.**
>
> **Marker recognition must be delimiter-agnostic: recognise the category segment
> following either a colon or a slash.**
>
> **The prefix value remains irrelevant.** `ft:stage/completed`, `ft2:stage/completed`,
> `anything:stage/completed`, `ft/stage/completed` and `ft-stage/completed` price
> identically.
>
> **`Priorities` and `Types` are OUT.** Stages only.

### 9b. One correction to the dispatch, filed now rather than after the fact

The 00:30:59Z dispatch paraphrases the ruling as *"price by SUFFIX against today's
config, ANY prefix"*. That paraphrase **drops the marker requirement**, which is the
single most consequential change the ruling made this round — round 10 stripped any
bare `<x>:` prefix and matched the remainder, and that is precisely the behaviour the
ruling was rewritten to forbid (`briefs/dev-194-r11.md:78–83`). A derivation performed
against the paraphrase and a derivation performed against S-A **can differ**, and they
differ exactly on the marker-less spellings. **I will derive against S-A, the quoted
ruling, not against the paraphrase.** Flagging it rather than resolving it silently, per
the standing instruction.

**Clean-tree re-verification at the moment of this amendment**, `2026-07-29T00:35:54Z`:
`git rev-parse HEAD` = `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`;
`git diff --stat 2cbbd928…` = no output; `git status --porcelain --untracked-files=all`
= 0 lines; `git worktree list` = `/workspace 2cbbd92 [label-write-scope-r11-audit]` only.
No repository file has been touched by this sub-task; the only writes are to this report,
which lives outside the clone.

### 9c. What is reserved

The derivation itself, with the clause or line named for each step, and an explicit
verdict on whether the specification determines the answer at all. If it does not, that
is the result and I will say which question it leaves open, per the EM's method step 2.


---

## AUDIT-194-R11-C1 INDEPENDENT DERIVATION (Q1/Q2/Q3)

**FILED 2026-07-29T00:48:57Z.** Everything from here to the end of §9f was written
before I looked at anything of `review-194-r11`'s. I have not opened
`reports/review-194-r11.md`, `briefs/review-194-r11.md`, or any diff of
`lifecycle_claim_property_test.go`. My working tree is clean at the subject SHA, so no
seven-line comment (Block B) exists anywhere I could have encountered it; the file I
read is the committed one at `2cbbd92`.

**Derived against the ADOPTED ruling text** (`briefs/dev-194-r11.md:64–76`), per the
EM's binding instruction of 00:38:10Z, **not** against the dispatch paraphrase. Not
derived both ways.

### 9d-0. CONTAMINATION I MUST DISCLOSE BEFORE THE ANSWER, NOT AFTER

**I knew the number 24 before I derived anything.** The 00:30:59Z dispatch says review
"measured 24 failures confined entirely to that row." That is a count, and a count is a
stopping signal. A derivation that halts when it reaches a number it was told is not
independent, it is a search.

What I did about it, stated so you can discount it as you see fit:

- I enumerated the product **exhaustively and in a fixed order** — config by config,
  label set by label set, open then closed — rather than hunting for failures. Every one
  of the 6 × 10 × 2 = 120 behaviourally distinct combinations is tabled below, including
  the 96 that agree. The count fell out of the last table, not the first.
- I did **not** know, and was explicitly not told: which configs, which label sets,
  which direction the disagreement runs, which scope is at issue, or what review
  concluded. Those are the load-bearing parts and they are mine.
- **The count is therefore weak corroboration and I am not offering it as strong.** If
  you want the strong version, the discriminating data are the *identities* of the cells
  and the *mechanism*, both below. Compare those, not the number.

I also report the one place Block A leaks: the phrase *"the two shapes most likely to
break monotonicity"* is a comment already committed at `2cbbd92` above the two
`swap_local_for_*` entries, and review's row was appended immediately after them. That
tells a reader the author was working in the swap family. It is in the tree, not in
Block A, so it is not a defect in your forwarding — but it did tell me where to look
first, and I looked there first. I derived the whole product anyway.

**Per your 00:38:10Z instruction on A1–A8: no part of the checklist bears on Q1, Q2 or
Q3, and no cell below is derived through it.** A1 (forced residue), A2 (union
completeness), A3 (push_prefix validation), A4 (empty alias key), A5 (race/nil), A6
(fourth path), A7 (narrative), A8 (broken commit) are each about a different object than
the price of this delta. A2 is adjacent — it asks whether the union closes the fail-open
direction for every shape — but it asks it as a question, supplies no answer, and its
enumerated shapes do not include the one that decides this. Nothing marked CONTAMINATED.

### 9d-1. WHAT THE DELTA IS, RESTATED FROM THE SPEC SIDE

```
add    = ["wont_fix"]              -- a BARE stage name. No marker. No prefix.
remove = ["ft:stage/wont_fix"]     -- the LOCAL authoritative spelling under matchPrefix "ft:".
```

Two half-writes that name the **same stage** in **two different spellings**. That is the
whole point of the shape, and it is why it discriminates: any gate that compares stage
*sets* rather than stage *bases* is blind to it by construction.

### 9d-2. THE SPEC, CLAUSE BY CLAUSE, WITH THE LINE THAT DETERMINES EACH STEP

| Step | Question | Clause that determines it |
|---|---|---|
| S1 | Which labels are lifecycle-authoritative for pricing? | **Adopted ruling**, `briefs/dev-194-r11.md:64–76`: marker + suffix-in-today's-`Stages`, prefix-value irrelevant, `Priorities`/`Types` out. **Plus Ruling 1's floor**, `briefs/dev-194-r10.md:64–66`: the write set is computed from what could **ever** be authoritative, "not from the set that is authoritative under today's configuration" — *wider than*, therefore **inclusive of**, today's set. |
| S2 | Which reading applies to the FROM endpoint? | `passthrough.go:1226–1232` (the diff's own stated contract): *"Config-blindness belongs on the endpoint that models what the caller is about to WRITE, never on the endpoint that models what is already there: over-claiming the FROM state makes a transition look shorter and therefore cheaper."* FROM = today's config. |
| S3 | Which reading applies to the TO endpoint? | Ruling 1 + `lifecycle_claim.go:142–176`. TO = any config. |
| S4 | Given (FROM, TO), what scope? | `internal/server/transitions.go:74–112`, first match wins: **any → terminal = `task:close`**; triage → any = `task:accept`; terminal → non-terminal = `task:accept`; any → working = `task:claim`; `from == to` = `task:write`. |
| S5 | When is anything charged at all, and over what? | `internal/server/server.go:840–858` — charge iff `!SameStageSet(before, after)`, then **every** `(from, to)` pair, `task:write` filtered out. **Unchanged base→HEAD (verified, §9e).** |
| S6 | Why are the endpoints SETS and not single stages? | `internal/server/server.go:832–839`. Quoted in full at 9d-4, because **this clause alone decides the disputed cells.** |

### 9d-3. THE SPECIFICATION IS AMBIGUOUS AT S1, AND I AM REPORTING IT AS A FINDING

**The adopted ruling is written as a single "price a label when …" clause and never says
whether the condition is SUFFICIENT or NECESSARY.** Read as an iff, it excludes every
marker-less spelling — bare `wont_fix`, bare `duplicate`, `ft:completed`,
`ft:priority:completed` — from pricing entirely. Read as sufficient-only, those are
priced by the today's-config floor and the marker clause merely extends past it.

This is not academic. **It decides the majority of this very sweep:**

- Under the **sufficient-only** reading (the one I adopt): bare `wont_fix` is priceable,
  and **320 of the 480 cells** are correctly charged `task:close` for the addition alone.
- Under the **exhaustive/iff** reading: bare `wont_fix` is not a lifecycle claim, and
  **those same 320 cells are over-charges** — a live denial-of-legitimate-work defect of
  exactly the shape round 11 exists to remove.

**I adopt the sufficient-only reading, and the spec does determine that much**, for a
reason internal to the documents rather than to my preference: Ruling 1
(`dev-194-r10.md:64–66`) requires the write set to be a **superset** of today's set, and
`MapLabelsToStage` (`labels.go:279`) has never required a prefix or a marker, so bare
`wont_fix` **is** authoritative today on a closed issue. The iff reading would make the
write predicate narrower than the read predicate — the fail-open direction, and the
precise error `lifecycle_claim.go:54–79` records the round-11 first draft making.

**But the adopted text does not say this and a careful implementer could read it either
way.** The round's own code resolves it silently, in branch 1, with the resolution
recorded only in a comment. **RECOMMENDATION: amend the ruling to say so normatively** —
e.g. *"This clause EXTENDS the priced set beyond today's configuration; it does not
narrow it. Every label authoritative under today's configuration is priced regardless of
marker."* One sentence, and it removes a 320-cell ambiguity from the governing document.

**This ambiguity does not touch the disputed cells.** There the erased label is
`ft:stage/wont_fix`, which carries the marker **and** is authoritative today, so it is
priced under both readings — and I verified the disputed answer is `task:close` under
both. That is worth stating plainly: **the AUDIT-194-R11-C1 verdict below is robust to the one place
the specification is genuinely underdetermined.**

### 9d-4. THE CLAUSE THAT DECIDES IT — AND IT NAMES THIS EXACT EDIT

`internal/server/server.go:832–839`, the UpdateTask label arm. **Pre-existing
specification: not part of `6d8f19e..2cbbd92`, and verified byte-identical at
`06f01d7`** (§9e). Verbatim:

> Both endpoints are SETS, for the same reason the stage arm above reads one: a
> comparison between two tiebreak winners is blind to an edit that swaps one of several
> present terminal labels for another, and "nothing changed" is exactly the answer that
> costs nothing. **Removing `ft:stage/wont_fix` from an issue also carrying
> `ft:stage/completed` erases a maintainer's decline while leaving the winner
> untouched.** So compare the sets, and when they differ charge for every (from, to)
> pair — the strongest scope any pair implies is the one the caller must hold.

That worked example is, character for character, the `two_terminal` label set
(`{"ft:stage/wont_fix", "ft:stage/completed"}`) and the `remove` half of the delta under
derivation. **The set-valued endpoint was introduced specifically so that this edit could
not be free.** So the specification does not merely fail to bless a free answer here; it
names the free answer as the defect the mechanism exists to prevent.

### 9d-5. DERIVED REQUIRED SCOPE, ALL 480 CELLS

**The `stages` dimension is inert.** `LabelDeltaLifecycleStages` consults `t.Stage` only
in the `s.mapper == nil` branch (`passthrough.go:1160–1162`), which no cell reaches
(every config builds a mapper). All four stage values give identical results, so every
result below multiplies by 4. **120 distinct behaviours, 480 cells.**

**`enabled_noprfx` is not a no-prefix config.** `PushPrefix: " "` →
`resolvePushPrefix` (`terminal_label_stages.go:168`) → `TrimSpace` → empty → **defaults
to `"ft:"`**. It is byte-for-byte `enabled_ft` in every consulted behaviour. The sweep
believes it covers a sixth configuration and covers five. Reported as a coverage fact,
not a defect in the row under derivation.

Notation: `R` = read/today's reading (the FROM endpoint, and the reference arm's both
endpoints). `W` = the config-blind claim over `canonicalAdditions`. `CODE` = what
`2cbbd92` produces. `SPEC` = what I derive is required. `close` = `task:close`.

**A. `enabled_ft`, `enabled_noprfx`, `enabled_alias` (matchPrefix `ft:`) — identical
prices in all 20 combinations.**

| label set | closed | FROM (R) | CODE after | CODE | SPEC | agree? |
|---|---|---|---|---|---|---|
| none | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| inert | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| stock_duplicate | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| bare_completed | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| local_completed | no | [completed] | [completed, wont_fix] | close | close | ✔ |
| **two_terminal** | **no** | **[completed, wont_fix]** | **[completed, wont_fix]** | **FREE** | **close** | **✘** |
| foreign_wontfix | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| markerless | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| namespaced | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| alias | no | [accepted] | [accepted, wont_fix] | close | close | ✔ |
| none | yes | [completed] | [wont_fix] | close | close | ✔ |
| inert | yes | [completed] | [wont_fix] | close | close | ✔ |
| stock_duplicate | yes | [duplicate] | [wont_fix] | close | close | ✔ |
| bare_completed | yes | [completed] | [completed, wont_fix] | close | close | ✔ |
| local_completed | yes | [completed] | [completed, wont_fix] | close | close | ✔ |
| **two_terminal** | **yes** | **[completed, wont_fix]** | **[completed, wont_fix]** | **FREE** | **close** | **✘** |
| foreign_wontfix | yes | [completed] | [wont_fix] | close | close | ✔ |
| markerless | yes | [completed] | [completed, wont_fix] | close | close | ✔ |
| namespaced | yes | [completed] | [wont_fix] | close | close | ✔ |
| alias | yes | [completed] | [wont_fix] / [completed, wont_fix] | close | close | ✔ |

(The `alias`/closed row reaches `close` by two different routes: under `enabled_ft`
`"shipped"` is not a key so `R(after)` = [wont_fix] and the charge is the read side's;
under `enabled_alias` `"shipped"` → completed wins the precedence and `R(after)` =
[completed], so the charge comes from the claim arm. **Same price, different arm** — a
distinction the harness's relation cannot see and mine can.)

**B. `enabled_ft2` (matchPrefix `ft2:`)** — `ft:stage/*` is not authoritative here, so
the removal is a no-op against today's reading and `two_terminal` never reaches a
terminal FROM.

| label set | closed | FROM (R) | CODE | SPEC | agree? |
|---|---|---|---|---|---|
| all except foreign_wontfix | no | [accepted] | close | close | ✔ |
| foreign_wontfix | no | [wont_fix] | FREE | FREE | ✔ |
| none / inert / stock_duplicate / local_completed / two_terminal / namespaced / alias | yes | [completed] or [duplicate] | close | close | ✔ |
| bare_completed / markerless | yes | [completed] | close | close | ✔ |
| foreign_wontfix | yes | [wont_fix] | FREE | FREE | ✔ |

`foreign_wontfix` is correctly FREE in both directions: the issue already reads
`wont_fix` from `ft2:stage/wont_fix`, the removal names a label it does not carry, and
the addition asserts the stage it already has. **Nothing changes under any reading.**

**C. `enabled_slash` (matchPrefix `acme/`)** — no label in any set carries `acme/`, so
`AllTerminalLabelStages` is empty everywhere and every FROM comes from
`IssueToPhaseStage`. All 20 combinations: **CODE = close, SPEC = close, ✔.**

**D. `disabled_ft` (Enabled=false)** — the read side is silent
(`AllTerminalLabelStages` and `MapLabelsToStage` both return nothing at
`!m.enabled`), so FROM is [accepted] open / [completed] closed for every label set, and
the reference arm is FREE in all 20. The write arm still canonicalises through the
eager `writeView`, so all 20 charge `close`. **CODE = close, SPEC = close, ✔.**

**Worth flagging even though it agrees:** `disabled_ft/two_terminal` escapes the defect
**only because its FROM endpoint is blind.** Its BEFORE is [accepted]/[completed] rather
than the terminal pair, so the union cannot collapse onto it. If axis 1 were ever
"closed" on the FROM endpoint the way it is on TO, this configuration would acquire the
same 8-cell collapse. That is a latent coupling between two changes either of which looks
safe alone, and it is worth a comment in the code.

### 9d-6. THE ANSWER TO Q1

**24 of 480 cells disagree. Every one is the code being CHEAPER than the specification,
and every one drops exactly the same scope.**

```
CONFIGS   : enabled_ft, enabled_noprfx, enabled_alias   (the three whose matchPrefix is "ft:")
LABEL SET : two_terminal = {"ft:stage/wont_fix", "ft:stage/completed"}
CLOSED    : both false and true
STAGE     : all four (inert dimension)
          -> 3 x 1 x 2 x 4 = 24 cells

DERIVED REQUIRED SCOPE SET : { task:close }
SCOPE SET THE CODE DEMANDS : { }            (FREE)
DROPPED                    : task:close
```

The remaining **456 cells agree exactly**, under the sufficient-only reading of S1 that
9d-3 adopts and defends.

### 9d-7. THE MECHANISM, WHICH IS THE PART WORTH COMPARING

Not "a cell got cheaper." The specific structure, because it generalises and because it
is the thing a fix has to address:

1. FROM is the read reading of the task's own labels: both `ft:stage/*` labels are
   authoritative, so `AllTerminalLabelStages` → **`[completed, wont_fix]`**.
2. The raw delta removes `ft:stage/wont_fix` and adds bare `wont_fix`. The read reading
   of the result is **`[completed]`** — the maintainer's decline has been erased from
   what this deployment believes. `priceOf([completed,wont_fix], [completed])` pairs
   `wont_fix → completed`, which is *any → terminal*, so **`task:close`**.
3. `canonicalAdditions` (`lifecycle_claim.go:434`) correctly identifies bare `wont_fix`
   as a genuine addition and correctly rewrites it to the local spelling
   `ft:stage/wont_fix`. **Nothing is wrong with this step.**
4. `claimedStages` over that rewritten set therefore returns **`[completed, wont_fix]`**.
5. `unionStages` (`passthrough.go:1179`) merges it into AFTER, giving
   **`[completed, wont_fix]`** — which is now **elementwise equal to BEFORE**.
6. `SameStageSet` reports no change. **The gate never runs.** FREE.

**THE FALSE PREMISE IS WRITTEN DOWN IN THE DIFF**, at `passthrough.go:1140–1143`:

> *"SameStageSet follows too: if base found the endpoints equal and the union adds
> anything, they are no longer equal and the edit is priced rather than waved through.
> Nothing here can be cheaper than what shipped."*

The first sentence is true and covers **equal → unequal**. The second sentence does not
follow from it, because the union can also take **unequal → EQUAL**, and that is exactly
what happens here. Widening one endpoint of a set-difference gate is monotone only while
the other endpoint is not already at least that wide. **This is form (13) again — a TRUE
property of a predicate (`claim ⊇ read`) does not bound a gate that consumes a DIFFERENCE
of two evaluations — and it is the same form as the round-10 Critical, on the opposite
endpoint.** Round 10 widened BEFORE onto AFTER; round 11 widens AFTER onto BEFORE.

**AND THE GOVERNING BRIEF PRESCRIBED IT.** `briefs/dev-194-r11.md:147–150`:

> *"Fix: price against the strongest of the two readings, never a uniformly widened pair.
> Both legs converged on the same two shapes — floor the BEFORE endpoint at the read
> side's answer, **or** charge `max(readPrice, writePrice)`. **Either is monotone by
> construction because the base behaviour is one of the arms.** Pick one, say which and
> why."*

**The two options are not equivalent and only the second is monotone.**

- `max(readPrice, writePrice)` unions **PRICES**. `readPrice` is literally an arm, so the
  result contains it. Monotone, as claimed.
- "Floor the BEFORE endpoint" unions **ENDPOINTS** and then prices once. The resulting
  pair `(readBefore, readAfter ∪ claimAfter)` **is not an arm of anything** — base
  evaluated `(readBefore, readAfter)`. Price is not monotone in the endpoints, because
  equality collapses it. The justifying clause is false of option 1.

The dev leg picked option 1 and implemented it faithfully. **This is a defect in the
brief that the implementation inherited**, and it is item 6 of §5 below. I want that on
the record because it changes who owns the fix: this is not a leg misreading an
instruction, it is an instruction that was wrong in a way that reads as reassuring.

**The fix that the specification does support** is option 2 — union the SCOPE SETS, not
the stage sets:

```go
// Price both readings and demand both. The read arm is the base behaviour
// verbatim, so the result contains it by construction; the claim arm can only
// add. Neither endpoint is widened, so no widening can collapse a difference.
readBefore  := s.currentLifecycleStages(t, t.Labels)
readAfter   := s.currentLifecycleStages(t, rawAfter)
claimBefore := s.mapper.writeViewMapper().claimedStages(state, reason, t.Labels)
claimAfter  := s.mapper.writeViewMapper().claimedStages(state, reason,
                   s.mapper.canonicalAdditions(rawAfter, t.Labels, addLabels))
// required = priceOf(readBefore, readAfter) ∪ priceOf(claimBefore, claimAfter)
```

This needs the seam to return a **scope set** rather than a stage pair, which is a
signature change at `store.LabelDeltaLifecycleStages` and `server.go:841`. That is
larger than a patch and it is the EM's call, not mine. **What I will say as the security
opinion: a gate whose output is a set difference of two independently-computed readings
cannot be made monotone by adjusting either reading, and two rounds have now been spent
trying. The next attempt should move the union to the price.**

### 9e. Q2 — IS THE REFERENCE ARM A FAITHFUL RENDERING OF BASE `06f01d7`?

**YES. Measured by `git show`/`diff`, no build. This is the one question here I can
answer by pure comparison rather than by reasoning, and it does not go review's way.**

| Component of the reference arm | base `06f01d7` vs `2cbbd92` | Method |
|---|---|---|
| `currentLifecycleStages` body vs base `lifecycleStagesForLabels` body | **Byte-identical** (both: `AllTerminalLabelStages` first, else `IssueToPhaseStage(taskIssueState, taskStateReason, labels)`) | `git show 06f01d7:…passthrough.go` |
| Base `LabelDeltaLifecycleStages` shape | `before = f(t.Labels)`, `after = f(applyLabelDelta(…))` — exactly what lines 183–186 of the test reconstruct | `git show` |
| `AllTerminalLabelStages`, `authorizationStage`, `matchPrefix`, `pushPrefix`, `resolvePushPrefix` | **No code change.** The only non-comment change to `terminal_label_stages.go` + `labels.go` across `06f01d7..2cbbd92` is the `writeView` field and its eager construction, which the read path never reads | `git diff 06f01d7 2cbbd92 -- …` filtered to non-comment lines: **6 added lines, all `writeView`** |
| `IssueToPhaseStage`, `MapLabelsToStage`, `stripForMatch` | unchanged (same filtered diff) | as above |
| `applyLabelDelta`, `labelMatchKey`, `issueStateClosed` | **IDENTICAL** | function-body `diff` per function |
| `store.SameStageSet` | **IDENTICAL** | function-body `diff` |
| `server.TransitionScope`, `transitionTable`, scope constants | **unchanged** (`git diff --stat` empty for both files) | `git diff --stat` |
| `priceOf` vs the real consumer at `server.go:840–858` | same `SameStageSet` guard, same all-pairs walk, same `task:write` filter. One difference: the server **returns on the first** failing `RequireScope`, `priceOf` **collects the set**. That makes `priceOf` a superset-view of what is enforced, which is the right direction for a pin and does not affect any cell here | read both |
| The consumer itself, base vs HEAD | **IDENTICAL** modulo line numbers | `diff` of the extracted block |

**Verdict on Q2: the documented equivalence is TRUE at `2cbbd92`.** The reference arm is
base behaviour reached through a renamed function whose body did not change and whose
callees did not change. Review's own strongest objection to its own finding **does not
land**, and I record that it raised it — putting the best argument against your own
Critical into the auditor's input block is the correct move and it is the reason this
took me twenty minutes instead of two hours.

**And the load-bearing point: Q1 does not depend on Q2 at all.** My derivation goes from
the ruling, the transition table and `server.go:832–839` to `task:close`. It never
consults the reference arm. So even in the world where Q2 had gone against the harness,
**AUDIT-194-R11-C1 would survive on Q1 alone.** The two questions were not two chances at the same
answer; only one of them can decide, and it is Q1.

### 9f. Q3 — IS `writePrice ⊇ readPrice` THE RULING'S RELATION?

**No. It is the round's own restatement, it is SOUND but only NECESSARY, and the
docblock's argument for it is better than the brief's.** Three separate claims:

1. **The ruling does not state a relation between prices at all.** It states a predicate
   over labels (`dev-194-r11.md:64–76`). The relation is round 11's construction.
2. **`writePrice ⊇ readPrice` is sound as a necessary condition.** The read price is the
   price of the change this deployment will actually believe; that change really occurs,
   so its scope really is required. Nothing correct can charge less.
3. **It is not sufficient, and the gap is where axis 2 lives.** A cell can satisfy it and
   still be under-priced whenever the *config-blind* reading demands a scope the read
   reading does not — the entire latent-authority class Ruling 1 exists for. A pin on
   this relation is a **regression pin against round 10**, not a correctness pin against
   the ruling, and it should be described that way.

Two sub-findings, both in review's favour:

- **The docblock's rejection of `scopeRank(post) >= scopeRank(pre)` is correct and the
  brief was wrong.** `scopes.go` has no implication table and `RequireScope` is a
  membership test (`scopes.go:88`), so `task:claim`, `task:accept` and `task:close` are
  independent grants and any rank invents policy. Set containment additionally forbids
  *swapping* `task:close` for `task:accept`, which a rank permits. **This is a leg
  correcting its own governing brief and getting it right** — §5 item 7.
- **The harness under-states its own power in one direction and over-states it in
  another.** Under-states: because `priceOf` collects rather than short-circuits, it
  catches a swap the production gate would report as a single denial. Over-states: the
  `stages` dimension is inert (9d-5) and `enabled_noprfx` duplicates `enabled_ft`, so the
  declared 7200 cells are **1800 behaviourally distinct** ones sampled four times each,
  across five configurations rather than six. The count-pin at lines 220–225 pins the
  *walk*, not the *distinctness*. Test leg's axis; flagged, not adjudicated.

### 9g. WHAT I WOULD TELL THE EM IF I COULD ONLY SAY ONE THING

**AUDIT-194-R11-C1 is REAL, and it is real for a reason stronger than the property test it was
demonstrated with.** The specification does not merely decline to authorise the free
answer — `server.go:832–839` names *"removing `ft:stage/wont_fix` from an issue also
carrying `ft:stage/completed`"* as the erasure the set-valued endpoint was introduced to
price, and round 11 has made exactly that edit free again for a bare `task:write` holder
on the default configuration.

**Reachability: LIVE TODAY at `2cbbd92`, on `DefaultConfig`, `enabled=true`, default
`push_prefix`.** Precondition is an issue carrying two lifecycle labels — an ordinary
state produced by the codebase's own `CloseTask`/`UpdateTask` paths, requiring no
attacker setup and no config change. **INTRODUCED BY THIS DIFF**: at base `06f01d7` the
same edit priced `task:close` (the reference arm *is* base, per §9e). Severity **HIGH**
on my scale rather than Critical, and the reason is the bounding fact the brief supplies
and I accept: the surface is IAP-bounded in the deployed configuration, and the harm is
erasure of a maintainer's decline rather than credential compromise. **I am not
downgrading review's Critical — severity is the EM's to set with the deployment facts,
and review may hold facts about exposure that I do not. I am recording that on the
evidence I have, HIGH is where I land.**

**EVIDENCE: derived, not measured.** The 480-cell table above is a hand-derivation from
source at `2cbbd92`. Under the standing three-value scheme (§3) it is **SUSPECTED**, not
**MEASURED** — no build, no run, per the hold. Converting it costs one targeted run of
one test and I have not asked for the slot. **If any single cell of my table is wrong, the
first place to look is `enabled_alias`/`alias`/closed, where I derived the same price by a
different arm than the other two `ft:` configs.** That is the row I am least sure of, and
it is not one of the 24.

---

## 10. OPTION-2 MONOTONICITY — INDEPENDENT DERIVATION

**FILED 2026-07-29T01:03:29Z.** Answering the EM's 00:58:00Z question: is
`max(readPrice, writePrice)` — unioning the two independently-computed PRICE
SETS rather than the endpoint sets — always a superset of the price base
`06f01d7` charges for the same edit?

**EVIDENCE: SUSPECTED.** Hand-derivation from source. No build, no run. The 194
run is retired and I did not ask for one; nothing below needs execution.

**WHAT I WAS GIVEN AND WHAT I WAS NOT.** I was briefed on the PROPERTY and
explicitly not on the EM's justification for it. I have not read that
justification, and I have still not read `reports/review-194-r11.md`. I was
asked to attack rather than confirm, and told a negative result was preferred.
**I did not produce one on the property. I produced three on the SPECIFICATION
of the remedy and one on a consumer nobody has mentioned.** Read the verdict
before the reasoning: the property holds, and it holds for a reason strong
enough that I could not construct a counterexample — but the remedy AS WRITTEN
is not safe to hand a fix leg, for reasons that have nothing to do with
monotonicity.

### 10-1 — (c) FIRST, BECAUSE IT CHANGES WHAT THE QUESTION MEANS

`max` is **NOT WELL-DEFINED** over scope sets, and this is not pedantry.

`internal/server/scopes.go` declares `task:read`, `task:write`, `task:claim`,
`task:accept`, `task:close` as **independent membership constants**. There is
no implication table and no order. `RequireScope` is a membership test. There
is no sense in which `{task:close}` is greater than `{task:accept}`; a
principal may hold either, both, or neither.

So the remedy has exactly two readings:

| reading | behaviour | monotone vs base? |
|---|---|---|
| **UNION** — charge every scope either arm names | `P_read ∪ P_write` | **YES** (10-2) |
| **SELECTION** — pick the "greater" arm's set and charge it | `P_read` or `P_write`, not both | **NO — and I have a witness** |

**WITNESS AGAINST THE SELECTION READING, which is a direct answer to (a).**
Base's price is already multi-scope wherever a set-valued endpoint produces
pairs of different kinds. From `transitions.go:74-112`, first-match-wins:

```
before = {triage}          after = {working, completed}
  triage -> working     : row 2 (triage -> any)  = task:accept
  triage -> completed   : row 1 (any -> terminal) = task:close
  base charges           = { task:accept, task:close }
```

Any implementation that SELECTS one arm's set charges a strict subset of that.
**Under the literal name `max`, the answer to (a) is YES — there are cells
where the remedy is strictly smaller than base.** Under UNION, no.

This is a real hazard and not a hypothetical one, because the gate at
`server.go:846-856` does not build a set at all — it calls `RequireScope`
inside the loop and returns on the first failure. An implementer told to
"charge max(readPrice, writePrice)" has no existing set object to union and
must construct the notion from the name. **The name is the specification, and
the name is wrong.**

**REQUIRED CORRECTION TO THE REMEDY'S TEXT:** state it as
`requiredScopes = scopesOf(readArm) UNION scopesOf(writeArm)`, and say
explicitly that there is no ordering on scopes and no arm is ever discarded.
A remedy whose name presupposes an ordering that does not exist is a defect in
the remedy's specification even where the intended behaviour is right — the
EM's own framing, and I agree with it without reservation.

Everything below reads `max` as UNION.

### 10-2 — (a) UNDER THE UNION READING: NO CELL IS SMALLER THAN BASE

The proof is one line and that is the point:

```
base charges  P_base = Price(before_read, after_read)
option 2      P_2    = P_read UNION P_write,  where P_read = Price(before_read, after_read)
so            P_2 = P_base UNION P_write  ⊇  P_base   for every cell, unconditionally.
```

**Set union is never smaller than either operand.** This is not "monotone for
the 480 cells I enumerated" — it is monotone for every cell of every product,
including cells nobody has enumerated, because it does not depend on what
either predicate computes. That is a categorically stronger guarantee than
option 1 ever had, and it is why the distinction I filed in section 5 item 6
matters: **option 1's monotonicity was a claim about the code; option 2's is a
theorem about the combination rule.**

Contrast with option 1, restated so the difference is visible:

```
option 1   P_1 = Price(before_read, after_read UNION after_claim)
```

`P_1` is a single evaluation on a pair base never evaluated. It shares no
operand with `P_base`, so no containment follows, and AUDIT-194-R11-C1 is the cell where
containment fails. `P_2` literally contains `P_base` as a named operand.

**THE ONE CONDITION, AND IT IS A REAL ONE.** The theorem holds **iff the read
arm is base**. Two ways to violate it, both of which have already happened in
this codebase:

1. **The read arm is not base's function.** Not a live risk: I verified for Q2
   that `currentLifecycleStages` is byte-identical to base's
   `lifecycleStagesForLabels`, so a faithful arm exists in the tree today.
2. **The read arm is base's function fed non-base INPUTS.** This is live, it is
   the strongest attack I found, and it is 10-3.

### 10-3 — (b) THE COLLAPSE ANALOGUE. IT EXISTS. IT ENTERS THROUGH THE INPUTS, NOT THE GUARD.

The EM's distinction between "an arm returns an empty price set" and "an arm is
never evaluated" is exactly the right one and the answers differ.

**AN ARM RETURNING EMPTY IS HARMLESS.** Under option 2 each arm carries its own
`SameStageSet` guard over its own two endpoints. If the WRITE arm's guard fires,
`P_write = {}` and `{} UNION P_read = P_read = P_base`. Union absorbs it. The
identical event under option 1 — the single guard finding the widened endpoints
equal — is fatal, because there is only one guard and it gates the only
evaluation. **Option 2 converts the fatal case into the harmless one.** That is
the substantive difference between the two remedies and it is not a matter of
degree.

**AN ARM NEVER BEING EVALUATED IS FATAL — but only for the READ arm**, and only
via three concrete routes:

**ROUTE 1 — THE SIGNATURE. This is the one a fix leg will actually hit.**
`LabelDeltaLifecycleStages` returns `(before, after []task.Stage)`
(`passthrough.go:1159`, `store.go:128`, `store.go:184`,
`multistore.go:284`), and the caller does the pricing.
**A PAIR OF STAGE SETS CANNOT ENCODE A UNION OF TWO PRICE SETS.** There is no
`(before, after)` whose pairwise expansion equals `P_read ∪ P_write` in
general. Therefore:

> **Any implementation of option 2 that preserves the `(before, after)` return
> type has silently re-implemented option 1.**

That is not a slip a reviewer would catch by reading the diff for correctness,
because the diff would look like a *better* union. **It is the same failure that
produced AUDIT-194-R11-C1, reachable by a leg that has been told to implement option 2 and
is trying to keep the change small.** Option 2 REQUIRES the interface change —
return a scope set (or return both arms' pairs and price them separately at the
call site). If the signature does not change, the fix has not been applied.
Make this a merge precondition, not a review note.

**ROUTE 2 — LAUNDERED INPUTS, and this codebase has shipped it once already.**
If the read arm is fed `canonicalAdditions`-rewritten labels instead of raw
ones, it is no longer base. Trace the AUDIT-194-R11-C1 cell through that mistake:

```
labels = {ft:stage/wont_fix, ft:stage/completed}   delta: add[wont_fix] remove[ft:stage/wont_fix]
read arm on RAW after       -> [completed]      != before -> P_read = {task:close}   CORRECT
read arm on CANONICAL after -> [completed, wont_fix] == before -> P_read = {}
write arm (claim, both ends)-> [completed, wont_fix] == same  -> P_write = {}
                                                       P_2 = {}   FREE.  AUDIT-194-R11-C1 REPRODUCED EXACTLY.
```

So the answer to (b) is **YES, the collapse has an analogue, and it costs one
wrong argument.** It is not reachable through the guard — option 2 closes that
door — it is reachable through what the read arm is handed. And the laundering
function is already in the tree and already did this once: A7 /
`canonicalLifecycleLabels` rewrote a label the deployment does not honour into
the local spelling and handed it to the READ predicate, which is the identical
move at a different call site.

> **REQUIRED GUARD: the read arm MUST consume `applyLabelDelta(t.Labels, add,
> remove)` on RAW labels. Canonicalisation belongs to the write arm and must
> not cross into the read arm's inputs.** Pin it as a property, not a comment.

**ROUTE 3 — the shared outer condition.** Both arms sit under
`if len(add) > 0 || len(remove) > 0` (`server.go:840`). Base has the same
condition, so this is not a divergence — noted only so the enumeration is
complete rather than a summary of completeness.

**A FOURTH THING I CHECKED AND FOUND SOUND-BUT-FRAGILE, disclosed because it
cuts slightly against my own AUDIT-194-R11-C1.** `store.SameStageSet` (`store.go:252-262`)
is **not a set comparison**. It compares element-by-element at the same index
and returns false on any length difference. It is order-sensitive despite the
name. AUDIT-194-R11-C1's freeness therefore depends on `before` and `after` coming out in
the SAME ORDER, which they do — `AllTerminalLabelStages` sorts by stage name,
and `unionStages` (`passthrough.go:1185`) preserves primary-then-extra
insertion order, so both sides are `[completed, wont_fix]`. **AUDIT-194-R11-C1 holds. But it
holds by an ordering coincidence**, and if either producer's ordering changed,
those 24 cells would flip to over-charging rather than under-charging. Two
consequences: (i) an ordering change anywhere in the terminal scan is an
undeclared authorization change; (ii) the misnomer is a live trap — a future
reader who trusts the name will assume order-independence they do not have.
**Recommend renaming to `SameStageSequence` or making it an actual set
comparison.** Under option 2 this shrinks in importance, because each arm's
guard compares two outputs of the SAME producer, where the ordering assumption
is self-consistent.

### 10-4 — (d) THE 320-CELL AMBIGUITY DOES NOT REACH OPTION 2

Under the iff reading of the adopted ruling, the write predicate would decline
marker-less spellings, so the write arm's endpoints SHRINK and `P_write` shrinks
with them. But:

```
P_2 = P_base UNION P_write   and   P_write shrinking cannot shrink P_base.
```

**Option 2 is monotone under BOTH readings of the ambiguity, and its safety
property does not depend on resolving it at all.** That is a structural result
and it is the best argument for option 2 that I found:

> Under option 1, the ambiguity reaches the UNDER-CHARGE question, because the
> write predicate feeds the ENDPOINTS that feed the single guard, so a change in
> the predicate can flip `SameStageSet` and turn a priced edit free.
> Under option 2, the ambiguity is confined to the DOES-IT-CATCH-ENOUGH
> question. It can make the remedy less effective. It cannot make it unsafe.

Option 2 therefore also **de-risks the ruling amendment**: the coordinator can
adopt the sufficient-only sentence, or not, without that decision being able to
open an under-charge. It could not say that under option 1. The 320 cells
remain a correctness question about the predicate; they stop being an
authorization question about the gate.

### 10-5 — THE FINDING THE QUESTION DID NOT ASK FOR: THERE ARE THREE CONSUMERS, NOT ONE

**`[OPEN]` — found while grounding this derivation, not in any brief.**
`LabelDeltaLifecycleStages` + `SameStageSet` is consumed at **three** sites,
and every discussion of AUDIT-194-R11-C1 and of both remedies has been conducted as though
there were one:

| site | function | shape | effect of the r11 endpoint union | effect of option 2 |
|---|---|---|---|---|
| `server.go:199` | `CreateTask` | price, add-only, `before`=`[stage]` | fail-CLOSED: `before` has one element, union only grows `after`, so it cannot manufacture equality | fine; union of prices ⊇ base |
| `server.go:383` | `InsertTasksAfter` | **NOT A PRICE — a boolean REFUSAL** (`InvalidArgument`) | **behaviour change, see below** | **the remedy does not typecheck here** |
| `server.go:841` | `UpdateTask` | price, the AUDIT-194-R11-C1 site | **fail-OPEN, AUDIT-194-R11-C1** | fixed |

Two things follow and both are load-bearing:

1. **`InsertTasksAfter` has no price to union.** It asks "did the stages
   differ?" and refuses if so. Option 2's signature change (Route 1, which is
   mandatory) breaks its consumer contract: it would have to re-express its
   question as "is the price set non-empty?", **and that is a different
   question**, because the gate filters `task:write` out. A stage change whose
   only pair prices at `task:write` yields an EMPTY price set with a REAL stage
   change — under which `InsertTasksAfter` would start ACCEPTING a label that
   sets a stage. Today's mitigation is narrow and accidental: `from` is pinned
   to `triage` at that site, and every triage-origin transition prices at
   `accept` or `close`, never `write`. **So the gap is closed by a coincidence
   of the transition table, not by design.** A fix leg must either keep a
   stage-pair-shaped accessor for this site or pin the coincidence as a test.
2. **The r11 endpoint union ALREADY changed `InsertTasksAfter`'s behaviour, and
   this is not in any brief.** Its refusal now fires on the config-blind
   superset: it rejects labels that COULD name a stage under some configuration,
   not labels that DO name one today. That is round 10's over-denial complaint
   reappearing in a second endpoint. **LIVE TODAY. INTRODUCED BY THIS DIFF.**
   Impact is legitimate-work denial with a clear error message, not a privilege
   escape, so I rate it **LOW** — but it is unannounced, and the round's own
   narrative says the union is fail-closed-only "for the price", which is true
   of the two pricing sites and not of this one.

**RECOMMENDATION, and it outranks the choice between the remedies:** put the
combination rule in ONE place — the shared helper or a single `priceLabelDelta`
function — so three call sites cannot diverge. Right now the pricing loop is
duplicated at two sites with different shapes and the refusal at a third. AUDIT-194-R11-C1 is
a defect in a rule that is written down twice.

### 10-6 — WHAT OPTION 2 COSTS, STATED PLAINLY

Option 2 is **strictly more expensive than option 1 in every cell where the
arms differ**, by construction. Round 10 was reverted because it denied
legitimate work; option 2 re-imports exactly that cost on the write arm's axis,
because it charges the write arm's price in full and unconditionally.

That is not a monotonicity failure — it is the same property seen from the
other side, and it is unavoidable:

> **You cannot close AUDIT-194-R11-C1 and avoid round 10's over-denial by tuning the
> COMBINATION rule. Safety and cost are the same dial there.** The only place
> the two can be separated is the write PREDICATE, and the marker rule adopted
> at `dev-194-r11.md:64-76` is precisely the instrument that narrows it.

So the correct division of labour, and I would put this to the coordinator: use
option 2 for the combination because it is provably safe, and spend the
remaining effort on the predicate, because that is the only lever that reduces
cost without reopening the gate. Two rounds have now been spent trying to make a
DIFFERENCE-shaped gate safe by adjusting one of the two things it subtracts.
It cannot be done: the gate consumes a difference, and any widening of either
endpoint can collapse it.

### 10-7 — VERDICT, AND THE GUARDS A FIX LEG MUST CARRY

**(a) Is any cell strictly smaller than base?**
**NO under the UNION reading — for every cell of every product, not just the
480 — because `P_base` is a named operand of the union.
YES under the literal `max`/selection reading; witness in 10-1.**

**(b) Is there a collapse analogue?**
**YES, but it moved.** An arm evaluating to EMPTY is harmless (union absorbs it)
where the same event kills option 1. An arm not being EVALUATED is still fatal,
and there are two live routes to it: preserving the `(before, after)` signature
(which silently re-implements option 1), and feeding the read arm canonicalised
labels (which reproduces AUDIT-194-R11-C1 exactly, and which this codebase has shipped once
before at A7).

**(c) Is `max` well-defined?**
**NO.** Scopes are a membership set with no implication table. `max` must mean
UNION and the remedy's text must say so.

**(d) Interaction with the 320-cell ambiguity?**
**NONE on safety.** Monotone under both readings; the ambiguity is confined to
effectiveness. This is a positive result for option 2 and an argument for
adopting it independent of AUDIT-194-R11-C1.

**OVERALL: OPTION 2's PROPERTY IS SOUND AND I COULD NOT BREAK IT. OPTION 2's
SPECIFICATION AS WRITTEN IS NOT SAFE TO HAND A FIX LEG.** The three defects are
in the name, in the signature it does not mention, and in the input discipline
it does not state — and each has a concrete cell where it reproduces AUDIT-194-R11-C1 or
charges less than base.

Merge preconditions, all mechanical:

1. Text says **UNION**, never `max`, and says no arm is discarded.
2. `LabelDeltaLifecycleStages`' return type **changes**. If it still returns
   `(before, after []task.Stage)`, option 1 shipped.
3. The read arm consumes **RAW** `applyLabelDelta` output. Pin as a property.
4. The combination rule lives in **one** function; all three consumers call it.
5. `InsertTasksAfter` keeps a stage-pair question or pins the triage-only
   coincidence.
6. A property pinning `P_2 ⊇ P_base` **with the base arm computed
   independently**, not by calling the same helper — otherwise the pin is
   satisfied by construction and measures nothing.

**A NOTE ON WHAT THIS DERIVATION IS AND IS NOT.** I was asked to attack and I
did not break the property. That is a weaker result than breaking it would have
been, and I want it labelled: **absence of a counterexample from one leg in one
pass is not a proof of safety**, even where I have given a containment argument,
because the containment argument assumes the read arm is base and that
assumption is an implementation obligation rather than a fact about the remedy.
The three merge preconditions above are the assumption made checkable. If a fix
lands without them, this section does not cover it.


---

## 11. APPARATUS AND EXPOSURE AUDIT — SELF-DIRECTED, MEASURED

**FILED 2026-07-29T01:12:00Z**, answering Broadcasts 3–5. Everything here is measured
from my own session transcript (`bf592ba0-…jsonl`) or from disk, each null with a
positive control. Two of the five results go against me.

### 11-1 — THE WRITE ARM (Broadcast 5's corrected standard). CLEAN, AND NOW ENUMERATED.

The corrected rule is that the re-hydration set is *files touched by any tool,
read **or written***. My Hazard B answer enumerated reads only. The write arm:

| tool | target | count |
|---|---|---|
| `Edit` | `reports/audit-194-r11.md` (mine) | 21 |
| `Write` | `reports/audit-194-r11.md` (mine) | 1 |
| `Write` | `/workspace/internal/server/zz_audit_probe_test.go` (my probe, since restored) | 1 |
| Bash `>>` | `reports/audit-194-r11.md` (mine) | 1 |

**Zero writes to any sibling's report or brief.** Positive control: the same
redirection regex enumerates every `>`/`>>` target in the session, including
heredoc noise, so it is not silently empty.
**Both arms of the corrected standard are therefore clean for
`reports/review-194-r11.md`: zero reads AND zero writes.** I accept the EM's
framing that this does not amount to blindness — the third channel (proximity
inlining) is not under my control, and I am not claiming it.

### 11-2 — THE UNQUOTED-GLOB AUDIT. THREE INSTANCES. TWO FABRICATED A NULL, ONE DID NOT — AND THE DIFFERENCE MATTERS.

zsh aborts a command whose unquoted glob matches nothing. I ran three:

| # | command | verdict |
|---|---|---|
| 1 | `grep -rn "LabelDelta…\|assertStageWriteAllowed\|…" --include=*.go` (session start) | **FABRICATED NULL.** Aborted. No finding rests on it — I re-ran differently — but it produced nothing and could have been read as "these symbols do not exist." |
| 2 | `grep -rn --include=*.go -E "SameStageSet\|before, after\|…"` (the consumer sweep) | **FABRICATED NULL, AND IT IS THE VALUABLE ONE.** Re-run quoted, it returned **three** consumer sites. Under bash this aborts silently and §10-5 says "one gate". |
| 3 | `ls internal/server/zz_audit_probe*.go` (restore verification) | **SOUND — but not for the reason I thought.** |

**Instance 3 is worth separating out, because the naive reading is that all three
are the same bug and they are not.** For `ls zz_audit_probe*.go`, zsh's
"no matches found" fires *precisely because nothing matched*, and "nothing
matched" **is** the proposition I was asserting. The abort is logically
equivalent to the answer. For `--include=*.go`, the glob's failure to match is
unrelated to the question the command was asking, so the abort destroys the
measurement and leaves a plausible-looking nothing.

> **The rule: a nullglob abort is sound iff the glob's non-match is itself the
> proposition under test. Otherwise it fabricates.** In instance 3 the
> *conclusion* was right and my *stated reason* was wrong — I believed I was
> reading `ls`'s stderr. That is Broadcast 4's pattern in my own restore check,
> and the restore conclusion is independently carried by the mandated
> `git diff` / `git status --untracked-files=all` pair, which returned 0/0 and is
> not glob-dependent.

### 11-3 — ROUTE 6 (`reports/` recursive grep). ZERO, WITH A CONTROL.

- `Grep` tool calls with a path or glob touching `reports/`: **none.**
- Bash commands naming `review-194-r11`: **14 hits, every one inspected by hand.**
  All are prose inside `scion message` bodies or heredocs written into *my own*
  report. None is a read verb against that path.
- Every distinct file named under `reports/` across the whole session:
  `audit-194-r11.md` (19 commands, mine) and `review-194-r11.md` (5 commands, all
  prose).
- **No command in this session ever recursed over `reports/`.**

Positive control: the identical filters aimed at `audit-194-r11` return 2 Reads
and 5 Bash hits. And I note that I had to *read* the 14 hits rather than trust
the count — the regex spanned `|` boundaries inside long compound commands, so a
count-only null would have been right by luck.

### 11-4 — ORDERING TABLE (Broadcast 5's mandated method). MEASURED, NOT ASSERTED.

Record numbers are `input_line_number` in the session transcript. Per the EM's
own correction, these are **tool_use records, not first mentions**.

| record | time | event |
|---|---|---|
| **17** | 23:43:02.193Z | `grep '^#\|STOP\|do not read\|open pass\|checklist'` — **THE HEADING LEAK.** Section 2 titles enter context. |
| **20** | 23:43:05.338Z | `Read{briefs/audit-194-r11.md, limit:41}` — body read stops at line 41; line 42 is `## STEP 2`. |
| **191** | 23:57:25.331Z | **OPEN PASS WRITTEN** to the report. |
| **294** | 00:34:24.977Z | **HARNESS INJECTS THE WHOLE BRIEF**, section 2 body included. |
| **475** | 00:55:37.445Z | Same injection, again. |

**The open pass precedes the section-2 body by 103 records and 37 minutes, and
that is now evidence rather than a claim.** The ordering held. What did *not*
hold is the completeness of my ordering claim: record 17 precedes record 20 by
three seconds and put the headings in. Both facts are in the same table
deliberately — the table exonerates me on the body and convicts me on the
headings, and a table that could only do the first would not be worth producing.

### 11-5 — THE SHARED-VOLUME HYPOTHESIS: THE MUTATION HALF IS NOW MEASURED, AND IT HAS ALREADY BROKEN ONE OF MY CITATIONS

The EM offered, explicitly as an unmeasured hypothesis, that re-hydration reads
from disk *at compaction time*, so a leg could be shown a version of a file that
did not exist when it touched it. **I cannot measure the injection half. I can
measure the precondition, and it has fired.**

```
briefs/dev-194-r11.md   mtime 2026-07-29 01:06:03Z   — MUTATED AFTER I READ IT
I read it at offset 40, limit 120 (lines 40–159) earlier tonight.
The EM then corrected it AT SOURCE, twice, inserting ~107 lines above line 147.
```

**MEASURED CONSEQUENCE, AND IT IS A METHOD FINDING AGAINST MY OWN METHOD.**
The B1 remedy paragraph I cited throughout as `dev-194-r11.md:147-150` now begins
at **line 254**. My report cites those line numbers and **they no longer
resolve.** The §9a pin `dev-194-r11.md:64-76` still resolves — the insert landed
below it — but that is luck, not design.

> **Pinning your authorities by `file:line` does not survive a shared mutable
> volume.** That technique is mine, it was adopted this round, and it is
> defeated by any concurrent edit above the cited line. What saved the
> derivation is the *other* half of the method — §9a quotes the governing clause
> **verbatim**, so the argument stands even though the pointer rotted.
> **Corrected method: quote verbatim AND record a content hash or mtime
> alongside the line numbers.** A line number is a pointer into someone else's
> mutable state.

Two further consequences worth stating:

1. **A leg's own report is in its re-hydration set.** Mine is, confirmed — it
   appears as a `compact_file_reference` at both compactions. It is *pointered*
   rather than inlined only because it is large (1781 lines). **A small report on
   a shared volume would be inlined whole**, and if another party edited it, the
   edited version would arrive rendered as the leg's own read.
2. **`briefs/audit-194-r11.md` is the live instance of the precondition**: 13 KB,
   below the inline threshold, injected whole at *every* compaction, sitting in a
   directory the EM writes to. Its mtime is 23:41:07Z — unchanged tonight, so
   nothing has actually happened. **Falsifiable prediction:** if that file is
   edited and a compaction follows, the injected copy will show the *new* text,
   attributed to my 23:43:05Z read of 41 lines. That is checkable by anyone who
   diffs an injected payload against the bytes the leg actually read.

**EVIDENCE: MEASURED** for the mutation, the mtime, the 107-line shift and the
broken citation. **NOT MEASURED** for the injection of mutated content, which
remains the EM's hypothesis and should not be repeated as fact.

---

## 12. CAUSAL RESTORE PROOF, THE SIXTH CHANNEL, AND THE CLAIMS I INHERITED

**FILED 2026-07-29T01:15:34Z**, answering Broadcasts 6 and 7.

### 12-1 — RESTORE PROOF BY ENUMERATION, NOT BY INSPECTION

"0 dirty cells" as I have been reporting it is a statement about git state *now*.
The write arm is **causal**: it establishes that there was only ever a bounded
set of things in `/workspace` to clean, and names them. Every hit below was
hand-adjudicated, not counted.

**Every write verb this session aimed at `/workspace`:**

| # | operation | path | status now |
|---|---|---|---|
| 1 | `Write` tool | `internal/server/zz_audit_probe_test.go` | **absent** |
| 2 | `sed -i` (no `cd`; cwd was `/workspace`) | `internal/server/zz_audit_probe_test.go` | same file as #1 |
| 3 | Bash `cat >` | `internal/server/zz_audit_probe2_test.go` | **absent** |
| 4 | `mkdir -p` + `printf >` | `internal/zzcontrol/` and `internal/zzcontrol/c.go` | **absent** |
| — | `cp -r /workspace/web/dist /tmp/…` | reads `/workspace`, writes `/tmp` | not a mutation |

**Three files and one directory, ever.** `rm -f` accounts for #1–#3 and the
`internal/zzcontrol` removal for #4. Confirmed absent by `ls` just now.

Closing the ignored-file channel **by enumeration**:

```
git check-ignore -v internal/server/zz_audit_probe_test.go \
                   internal/zzcontrol/c.go internal/platform/github/zz.go
  -> exit 1, no output: NO ignore pattern covers internal/**/*.go
POSITIVE CONTROL: git check-ignore -v web/dist/index.html
  -> .gitignore:17:dist/   web/dist/index.html      (the instrument fires)
```

So the 4109 ignored entries cannot have hidden any of my writes: **none of my
write targets is coverable by any pattern in this repo's ignore set.** That is
the enumeration argument, and it is strictly stronger than the inspection
argument I gave in §5 item 9 — which remains valid as a general channel finding
for anyone whose writes *do* land under `web/dist`.

**One subtlety worth recording, because it nearly went the other way.** Operation
#2 ran `sed -i … internal/server/zz_audit_probe_test.go` with **no `cd`**, in a
sequence where the *previous* command had done `cd /tmp/audit-base`. The harness
resets cwd to `/workspace` between calls, so that `sed -i` edited the
**workspace** copy, not the detached worktree copy I was reasoning about. It
happened to be my own probe file and it was removed, so nothing escaped — but
**a relative path in a shell whose cwd silently resets is a write to a file you
did not name**, and that is a fifth way to strand a mutant. Use absolute paths
for every mutating command.

### 12-2 — THE SIXTH CHANNEL: AN EMPTY DIRECTORY IS INVISIBLE TO EVERY MANDATED CHECK

Found by enumerating my own writes rather than by inspecting the tree.
Operation #4 created a **directory**. Git does not track directories:

```
git status --porcelain --untracked-files=all            -> cannot report an empty dir
git status --porcelain --untracked-files=all --ignored  -> cannot report an empty dir
git diff <SHA>                                          -> cannot report an empty dir
```

**All three of tonight's mandated checks are structurally blind to it.** An
abandoned `mkdir` therefore leaves residue that no git instrument can see.

Harm is low for Go specifically — a directory with no `.go` files is not a
package and `./...` skips it — but it is not nil: a leftover directory can
shadow a future package path, and in other toolchains an empty directory is
load-bearing. More to the point, this is the **sixth** instance of the same
shape, and it was found the same way as the other five: *by asking what the
instrument cannot express*, not by running it again.

```
VERIFIED CLEAN: find . -type d -empty -not -path './.git/*'   -> no output
POSITIVE CONTROL: same command against a freshly-made /tmp dir -> fires
```

**Recommend adding `find . -type d -empty` to the restore procedure**, or
preferring `git clean -nxd`, which does enumerate empty directories.

### 12-3 — CITATION AUDIT. ONE OF ELEVEN IS BROKEN. THE TEXT IS PASTED BELOW.

Per Broadcast 7, every `file:line` pointer in this report into `briefs/` was
re-resolved against disk:

| citation | resolves? |
|---|---|
| `dev-194-r11.md:60` (`## The ruling`) | **YES** |
| `dev-194-r11.md:64-76` (S-A, the adopted ruling) — cited 6× | **YES**, and the text matches my verbatim quote byte for byte |
| `dev-194-r11.md:78` | **YES** |
| `dev-194-r11.md:147-150` (the B1 remedy) — cited 3× | **NO. BROKEN.** Now points at the EM's correction block. |
| `dev-194-r10.md:62`, `:64` (Ruling 1) | **YES** (that file's mtime is 10:13Z, untouched tonight) |

**THE BROKEN CITATION, PASTED IN FULL SO THE CLAIM NO LONGER RESTS ON A
POINTER.** This is the text §5 item 6 and §10 are about. It now lives at
`dev-194-r11.md:250-258`, struck through and superseded:

> **Fix:** price against the strongest of the two readings, never a uniformly
> widened pair. Both legs converged on the same two shapes — floor the BEFORE
> endpoint at the read side's answer, or charge `max(readPrice, writePrice)`.
> **Either is monotone by construction because the base behaviour is one of the
> arms.** Pick one, say which and why.

**Stability record, so this audit is repeatable:**

```
briefs/dev-194-r11.md   mtime 2026-07-29T01:06:03Z   sha256 e38ce20bd71f72a8…
briefs/dev-194-r10.md   mtime 2026-07-28T10:13:41Z   sha256 b010d3b2feda5a16…
briefs/audit-194-r11.md mtime 2026-07-28T23:41:07Z   sha256 4c6c0b13e247db99…
S-A block (lines 64-76 as quoted in §9a)             sha256 fe457f441d303e2b…
```

Note that the EM **retained** the original text struck through rather than
deleting it. That is why this recovery was possible at all, and it is the right
editing discipline for a shared authority document: **supersede, never erase**,
because someone downstream is mid-derivation against the old text.

### 12-4 — THE CLAIMS I INHERITED FROM ANOTHER PARTY'S SENTENCE

Broadcast 7: *every rule tonight hardens instruments you run; none touches a
claim you inherited from someone else's prose.* Mine, swept deliberately, worst
first:

1. **"This surface is IAP-bounded in the deployed configuration."**
   Source: `briefs/audit-194-r11.md`, the EM's bounding fact. **I have never
   verified it, and it is load-bearing for my severity.** I rated AUDIT-194-R11-C1 **HIGH**
   rather than Critical partly because the reachable population is bounded by an
   identity-aware proxy. If that bound is wrong or does not hold for the
   deployment that matters, **my severity is wrong in the direction that
   under-states risk.** This is the single most consequential inherited sentence
   in my report and I am flagging it as such rather than defending my rating.
   The severity reconciliation is going to the coordinator anyway; this belongs
   in that decision.
2. **"This diff fixes the round-10 Critical."** Source: the diff's own comment
   table. Neither derivation nor run. Already flagged (§6 S7). The fix is a
   derivation, not a run.
3. **"A review leg measured a `task:write` holder closing a task for free at
   `DefaultConfig`."** Source: the brief, describing round 10. I use it as the
   motivating fact for the whole round and I never re-measured it.
4. **"`hasExternalUnavailableLabel` is a fourth authoritative path, unpriced in
   both directions."** Source: the brief, as a standing open finding. §6 S1
   records that I could not even determine which path A6 meant with confidence.
5. **"`bc93200` is live-broken with the round-10 Critical."** Source: the dev
   leg's self-report. My A8 opinion is built on top of it.
6. **"Zero operational cost"** for the B4 config-validation change. Source: the
   coordinator's ruling, scoped in a comment. §5 records that I checked the
   default config but not any deployed one.

**What they have in common:** every one is a statement about *the world outside
the diff* — deployment topology, another round's measurement, another leg's
self-report. Nothing in the source tree can settle any of them, which is exactly
why no apparatus rule tonight reaches them. **They are not soft claims because
someone was careless; they are soft because they are the only claims a source
derivation cannot touch.** Rank them by how much of a severity they carry, and
item 1 carries mine.

---

## 13. BROADCAST-8 RE-AUDIT: MY POSITIVE CONTROLS DIED WITH THE INSTRUMENT THEY CONTROLLED

**FILED 2026-07-29T01:26:06Z.** Four retroactive mandates, run against my own transcript with
`jq` over `tool_use` records. One conclusion changed class; none reversed.

### 13-1 — REPORTING CHANNEL: CLEAN, BUT MY FIRST DETECTOR LIED TWICE

**8 real `scion message` sends this session. ZERO contain a backtick or `$(`.** Nothing
of mine executed in the reporting channel and nothing was spliced into what the EM
received.

Two instrument defects found on the way, both worth more than the null:

1. **The first detector was LINE-WISE, not COMMAND-WISE.** `jq -r … | grep 'scion message'`
   splits multi-line commands into lines, so it counted *lines* and reported "11 commands,
   2 backticked." Both "backticked" hits were prose inside a report heredoc. Fixed with
   `@json`, which collapses each command to one line: **12 matching commands, 9 sends.**
2. **The corrected detector then matched ITSELF.** Its own text contains the literal
   `scion message farmtable-em`, so the audit command appeared as a hit in its own output —
   and it is the *only* backticked "send." **A detector that searches the transcript is in
   the transcript.** Self-matching is not a curiosity; it inflated a clean null to a hit,
   and had I trusted the count I would have reported a contaminated send that never existed.

Net: **8 sends, 0 backticked.** Adopting the quoted-heredoc idiom for this and all
subsequent sends regardless, because the null is about *this* session, not the next one.

### 13-2 — THE NULLGLOB COUNT WAS FOUR, NOT THREE. THE FOURTH IS THE EXPENSIVE ONE.

Error census over every `tool_result` (`no matches found|parse error|command not found|(eval):`)
returned **four** aborts, not the three I classified in §11-2:

| # | command | glob count | 7(b)-sound? |
|---|---|---|---|
| 1 | consumer sweep, `--include=*.go` | 1 | **NO** — re-run quoted; revealed 3 consumers, not 1 |
| 2 | `ls internal/server/zz_audit_probe*.go` | **1** | **YES** — survives the corrected rule |
| 3 | A2 difference-gate sweep, `--include=*.go` | 1 | **NO** |
| 4 | A2 positive control #1, `--include=*.go` | 1 | **NO** |

Row 2 is the only one I had classified sound, and per Broadcast 8 item 2 the question is
now **glob count**: it carries exactly one glob, and that glob's non-match *is* the
proposition. **It survives the corrected rule.** I had also queued it behind `;`, not `&&`,
so nothing was truncated behind it.

Rows 3 and 4 are new, and they are the same command.

### 13-3 — THE FINDING: A CONTROL WRITTEN IN THE INSTRUMENT'S IDIOM IS NOT A CONTROL

The A2 sweep — **the highest-value item in my brief** ("are there other difference-shaped
gates in this codebase with the same defect?") — was structured exactly as Broadcast 2
demands. It carried **two positive controls**. Here is what actually ran:

> ### ⛔ CORRECTED 2026-07-29T01:38Z — THE BLOCK BELOW WAS A RECONSTRUCTION I PRESENTED AS A TRANSCRIPT QUOTE.
> It was broadcast verbatim by the EM to five legs before I caught it. **Superseded, not
> erased** — see §14-1 for the measured text and for what the error teaches. The *conclusion*
> of this section is unchanged and slightly strengthened; only the evidence block was wrong.

**[ORIGINAL — INACCURATE. RETAINED SO THE ERROR IS SUPERSEDED, NOT ERASED:]**

~~```~~
~~=== SWEEP: difference-shaped gates (before/after pairs) ===~~
~~(eval):1: no matches found: --include=*.go              <- instrument aborted~~
~~=== POSITIVE CONTROL: same pattern class CAN return hits ===~~
~~(eval):1: no matches found: --include=*.go              <- CONTROL #1 aborted~~
~~=== POSITIVE CONTROL 2: deliberately-matching pattern in same tree ===~~
~~(eval):1: no matches found: --include=*.go              <- CONTROL #2 aborted~~
~~=== unionStages ===~~
~~func unionStages(...)  <- the ONE sub-command with no --include RAN NORMALLY~~
~~```~~

**[MEASURED TEXT, read back from the transcript at 01:38Z:]**

```
=== SWEEP: difference-shaped gates (before/after pairs) ===
(eval):1: no matches found: --include=*.go     <- instrument aborted
=== POSITIVE CONTROL: same pattern class CAN return hits (sanity: known site) ===
(eval):1: no matches found: --include=*.go     <- CONTROL #1 aborted
        *** COMMAND LINE TERMINATED HERE ***
   "POSITIVE CONTROL 2" and the unionStages sub-command NEVER PRINTED
   AND NEVER RAN. The next line in the transcript belongs to a DIFFERENT,
   LATER COMMAND whose caption is near-identical.
```

**BOTH CONTROLS WERE WRITTEN IN THE SAME `--include=*.go` IDIOM AS THE INSTRUMENT, SO BOTH
DIED THE SAME DEATH.** I complied with the letter of "every null owes a positive control"
and got no protection whatsoever, because compliance is what put the failure mode into the
control.

> **This is a correction to Broadcast 2, not an application of it. A POSITIVE CONTROL MUST
> BE ABLE TO FAIL INDEPENDENTLY OF THE INSTRUMENT IT CONTROLS. A control that shares the
> instrument's idiom shares its failure mode, and therefore certifies nothing — it only
> makes the null look audited.**

Note the shape: the control is *more* dangerous than no control, because it converts an
unexamined null into an apparently-examined one. And note **why** it happened: writing the
control in the same idiom is the *natural* thing to do — you copy the line and change the
pattern. The idiom is what you are trying to test, and copying it is what guarantees you do
not test it.

And this is **the echo-header effect in my own transcript**, precisely as described:
three captions, three aborts beneath them, each caption telling my eye that the empty space
under it was an answer. The sub-command that had no glob is the only one that produced
output — which made the batch look *partially* successful, the most convincing possible
disguise.

### 13-4 — A2 RE-RUN CORRECTLY. THE CONCLUSION SURVIVES; ITS EVIDENCE CLASS CHANGES.

Re-ran with quoted includes **and a second idiom (`find -print0 | xargs -0 grep`) that
cannot share the nullglob failure mode**, plus a control in that second idiom:

- Both idioms return **the identical site set.**
- Repo-wide extension (not just `internal/`): the difference-shaped gate family is confined
  to exactly **four files** — `internal/server/server.go`, `internal/store/store.go`,
  `internal/store/multistore.go`, `internal/platform/github/passthrough.go`.
- The three consumer gates stand: `server.go:206` (CreateTask), `:391` (InsertTasksAfter,
  the boolean refusal), `:846` (UpdateTask, the AUDIT-194-R11-C1 site).
- Control fired: `transitions.go:1` for `func TransitionScope`.

**So A2's answer does not change — there is no fifth difference-shaped gate hiding
elsewhere in the repo.** What changes is its provenance: it was **recovered** by the later
quoted consumer sweep rather than established by the sweep I designed for it, and until
this re-run it rested on an instrument whose controls had aborted. **Now MEASURED, on two
independent idioms.** Had the quoted consumer re-run not happened for unrelated reasons,
I would have filed the brief's highest-value item off a silent triple abort.

### 13-5 — MY §12-1 WRITE CENSUS WAS INCOMPLETE. SEVENTH CHANNEL.

Broadcast 8 item 5 says a `Write`/`Edit` census is blind to the shell. Mine already went to
the shell — and it was **still incomplete**, for a different reason:

**I ran `git worktree add` TWICE** (`/tmp/audit-r10` at `6d8f19e`, `/tmp/audit-base` at
`06f01d7`). Both write **into `/workspace`**: `git worktree add` creates
`/workspace/.git/worktrees/<name>/` (HEAD, index, gitdir, commondir). My §12-1 table said
"three files and one directory, EVER." **That sentence is false**, and it was false because
I enumerated **write verbs** — `>`, `>>`, `cat >`, `sed -i`, `mkdir`, `cp` — and
`git worktree add` is not a write verb. It is a command that writes as a **side effect**.

> **A CENSUS OF WRITE VERBS MISSES EVERY COMMAND THAT WRITES AS A SIDE EFFECT.** The census
> must be over commands with **effects**, not over verbs that look like writing. Same class:
> `git stash`, `git config`, `go build -o`, anything with a cache, and any tool that
> initialises state on first use.

**Restoration is nonetheless intact, and by a control I did run at the time:**
```
ls -la /workspace/.git/worktrees   ->  No such file or directory
git -C /workspace worktree list    ->  /workspace 2cbbd92 [label-write-scope-r11-audit]   (only)
```
because I ran `git worktree remove --force` on both plus `git worktree prune`.

**But note what would have caught it had I not:** nothing I was mandated to run.
`.git/worktrees/<name>/` is inside `/workspace`, is **not** empty (so §12-2's
`find -type d -empty` misses it), and is under `.git` (so `git status`, `git diff` and
`--ignored` all miss it). **That is a seventh channel and it defeats all four checks,
including the one I added an hour ago.** The only instruments that see it are
`git worktree list` and `ls .git/worktrees`.

### 13-6 — PIPELINE EXIT-STATUS LAUNDERING (sibling of the echo-header effect)

The same command carried a second defect worth naming:
```
git worktree add /tmp/audit-r10 <sha> 2>&1 | tail -3 && cp -r /workspace/web/dist ...
```
**The `&&` gates on `tail`'s exit status, which is 0 whether or not `git worktree add`
succeeded.** Piping a command into a formatter to keep one-slot output readable **destroys
its exit status** and converts any failure into an apparent success for everything chained
behind it. It happened to succeed here. The idiom is one I used repeatedly tonight because
the one-slot policy rewards compact output — the same policy pressure Broadcast 8 item 3
identifies. `set -o pipefail`, or `${PIPESTATUS[0]}`, or do not chain behind a pipe.

### 13-7 — AND THE MITIGATION THAT IS NOT AVAILABLE

I checked whether the structured, non-shell search path would sidestep this entire bug
class. **It does not exist in this session:**
```
Grep -> "No such tool available: Grep. ... search file contents with `grep` via the Bash tool instead."
```
**So every search every leg runs tonight is forced through zsh, and the nullglob abort is
an ENVIRONMENT PROPERTY, not a discipline failure.** The mitigation cannot be "use the
structured tool"; it has to be quoting discipline plus independent-idiom controls, or a
shell-level fix (`unsetopt nomatch` / `setopt +o nomatch`) applied once at session start.

I nearly filed this the other way round — "I never used the immune path" as a lapse of
mine — before checking whether the path existed. **An absence of use and an absence of
availability look identical in a transcript.**

---

## 14. THE FALSIFICATION TEST, APPLIED TO ME — AND I FAIL IT ONCE, IN THE SECTION ABOUT INSTRUMENT DISCIPLINE

**FILED 2026-07-29T01:37:45Z**, answering Broadcast 9 items 1, 6 and 7.

### 14-1 — I FABRICATED A TRANSCRIPT QUOTE BY SPLICING TWO COMMANDS. THE EM BROADCAST IT.

Broadcast 9 quotes my §13-3 evidence block verbatim to five legs. **It is not what the
transcript says.** Read back at 01:38Z, the A2 sweep produced **two** aborts, not three,
and then **the command line terminated**: `POSITIVE CONTROL 2` and the `unionStages`
sub-command never printed and never ran. See §13-3, corrected in place.

**How I got it wrong, and this is the part worth keeping.** The line immediately after the
second abort in my scrollback reads:

```
=== SWEEP: difference-shaped gates ===                      <- a LATER, SEPARATE command
internal/platform/github/passthrough.go:1140: ...
```

against the aborted command's caption:

```
=== SWEEP: difference-shaped gates (before/after pairs) === <- the ABORTED command
```

> **THE FAILED RUN AND ITS RE-RUN CARRIED NEAR-IDENTICAL CAPTIONS, SO IN SCROLLBACK THEY
> READ AS ONE BATCH. I STITCHED THE ABORTED COMMAND'S HEAD ONTO THE RE-RUN'S BODY AND SAW A
> BATCH THAT PARTIALLY SUCCEEDED.** That is where "the one sub-command with no glob ran
> normally" came from. It never ran.

This is the caption hazard's worst form and it is **new**: not a caption that mislabels an
error, but **two captions similar enough that a reader splices a failure to a success**.
It is *created* by good practice — you re-run a failed check with the same descriptive
caption, because that is what makes scrollback navigable. **Re-runs must be captioned
DIFFERENTLY from the runs they replace** (`=== A2 SWEEP (RE-RUN 2, QUOTED) ===`), or the
record cannot be read back correctly by the person who wrote it.

**What survives, and it is strengthened.** Both positive controls still failed to control
anything: #1 aborted, and #2 **never executed at all** — which is worse, because an
unexecuted control leaves no trace whatsoever. The §13-3 conclusion stands unchanged:
*a control sharing the instrument's idiom certifies nothing.*

**What changes:** my §13-4 provenance claim was too pessimistic. The A2 conclusion was
**not** salvaged by an unrelated later sweep; it was salvaged by a **deliberate re-run of
A2 itself**, visible in the transcript, which returned the correct site set at the time.
A2 was measured when filed. I under-credited my own record because I had misread it.

### 14-2 — BROADCAST 9 ITEM 1: I HAVE ONE GENUINE COUNTER-EXAMPLE, AND IT IS NOT IN A SUBSHELL

The EM reconciles review-xss-r4's measurement D with my surviving `;`-separated abort by
proposing that `;` survives *when the abort is contained in a subshell*. **My instance
falsifies that reconciliation.** The command, verbatim, no subshell anywhere:

```
cd /workspace; date -u …; git diff <SHA> | wc -l; git status --porcelain -uall | wc -l;
echo "--- explicit hunt for probe artefacts ---"; ls -d internal/zzcontrol 2>&1;
ls internal/server/zz_audit_probe*.go 2>&1; find . -name 'zz*' … | head;
echo "--- any untracked go file anywhere ---"; git ls-files --others --exclude-standard '*.go' | head
```

and the measured output:

```
--- explicit hunt for probe artefacts ---
ls: cannot access 'internal/zzcontrol': No such file or directory
(eval):1: no matches found: internal/server/zz_audit_probe*.go   <- ABORT
--- any untracked go file anywhere ---                            <- TAIL RAN ANYWAY
4109
```

A top-level, `;`-separated, non-subshell abort whose tail **survived** — while my A2 sweep,
also top-level and `;`-separated, **died** (§14-1). **Two commands, same session, same
shell, same separator, opposite outcomes.** So the rule is neither "`;` protects you" nor
"`;` never protects you" nor the subshell reconciliation. **The mechanism is undetermined,
and that is the finding.**

> **YOU CANNOT PREDICT WHETHER YOUR TAIL RAN. THEREFORE THE SENTINEL IS NOT THE
> LOAD-BEARING HALF OF THE MITIGATION — IT IS THE ONLY HALF.**

And note the perverse ordering: **truncation is the SAFER failure.** When the tail dies you
lose your sentinel and you notice. When the tail *survives* an abort, the batch looks
complete, and only the two error lines buried mid-scrollback say otherwise. My surviving
case is the one I misfiled for over an hour; my dying case is the one I caught.

### 14-3 — ITEM 6, THE FALSIFICATION TEST. **I RETRACT THREE. ONE SURVIVES.**

For every error I attributed to apparatus tonight, the record where the instrument gave a
**wrong answer** — as opposed to a **loud error I failed to read**:

| # | attributed to apparatus | what the instrument actually did | verdict |
|---|---|---|---|
| 1 | consumer sweep null (result-line 1290) | **printed** `(eval):1: no matches found` | **RETRACTED — MINE** |
| 2 | A2 sweep null (result-lines 6394, 6396) | **printed** two aborts, then stopped | **RETRACTED — MINE** |
| 3 | §13-3 "three aborts, fourth ran" | transcript was **accurate**; I spliced two commands | **RETRACTED — MINE** |
| 4 | probe-hunt abort (result-line 5948) | printed; I read it correctly and classified it sound | never attributed |
| 5 | line-wise / self-matching backtick detectors | did exactly what I wrote | already owned as mine |
| 6 | route-6 detector's 14 false positives | regex was mine | already owned as mine |
| 7 | `git worktree add` census miss | no instrument involved | already owned as mine |
| 8 | `\| tail -3 &&` status laundering | shell behaved as specified | already owned as mine |
| 9 | `sed -i` on a reset cwd | harness **prints** `Shell cwd was reset to /workspace` in every result | **RETRACTED in part — the signal was there** |
| 10 | **compaction re-hydration** | **renders a `Read` the leg never issued, and restores 235 lines from a `limit:41`** | **APPARATUS. STANDS.** |

**Count retracted: three attributions (rows 1–3), plus row 9 in part. Row 10 is the only
one I defend**, and it meets the EM's own criterion exactly: it does not emit an error, it
emits a **confident wrong answer** — a tool call that did not happen, attributed to me, at
a size I did not request. Everything else was loud, and I did not read it.

**The self-indictment, stated plainly.** My §11-2 credited this environment for *failing
loudly* — "zsh fails loudly where bash would be silent" — and in the same document I filed
the output of those loud failures as apparatus-caused nulls. **Both cannot be true.** If it
failed loudly, the failure to read it is mine. I had the exculpation and the accusation in
one report and never put them next to each other.

> **A LEG THAT HAS SPENT AN HOUR CATALOGUING BROKEN INSTRUMENTS HAS BUILT A CATEGORY THAT
> WILL ACCEPT ANY ERROR IT IS HANDED.** The apparatus-failure narrative was, by the end of
> the night, the cheapest place in my report to file anything — and I filed my own reading
> failures there without noticing, in a document whose entire subject is that exact move.

### 14-4 — ITEM 7: SELF-EXCLUSION, BY RECORD NUMBER

My detectors appear in the transcript they search. Records naming the EM target: jsonl
lines `279 292 350 463 473 491 542 582 590 593 608 622 633 653 692 703 731 732 746 768 780
783 804 810`. Records containing an abort string: `47 426 557 582 622 624 625 651 692 709
724 725 732 746 780 783 791 795 799 804 810`. **The overlap — `582 622 692 732 746 780 783
804 810` — is precisely my own audit tooling**, commands that both name the target and
quote the abort string because they were written to hunt for them.

Applying the exclusion: the backtick census's single "hit" was its own command text
(§13-1b); **excluded, giving 8 real sends and zero backticked.** The route-6 census's 14
hits were all detector-authored prose; **excluded, giving zero.** The abort census's raw
count of error lines includes my own quotations of earlier errors at result-lines 6684,
6735–6739 and 7052–7061; **excluded, giving four genuine aborts across three commands.**

In every one of the three cases the self-match inflated the count **in the direction that
flattered me** — more contamination found, more diligence demonstrated. **A detector that
finds itself always finds itself working.**

---

## 15. BROKEN vs MISAIMED — AND THE THIRD CATEGORY THAT DOMINATED MY NIGHT

**FILED 2026-07-29T01:44:02Z**, answering Broadcast 10 items 4, 5 and 6.

### 15-1 — MY TALLY, SPLIT. AND THE BINARY IS MISSING A CATEGORY.

Applying the EM's vocabulary (BROKEN = wrong answer to the query you asked; MISAIMED =
right answer to the wrong query), most of my night lands in neither:

| class | count | remedy | self-announcing? |
|---|---|---|---|
| **BROKEN** | **1** — compaction re-hydration | none available to a leg | **NO** |
| **MISAIMED** | **4** — line-wise backtick detector; three self-matching censuses (backtick, route-6, abort); route-6 regex spanning `\|` boundaries | vary the QUERY | no |
| **REFUSED** | **4 events / 3 commands** — the nullglob aborts | quote the glob | **YES, loudly** |
| **READING FAILURE** | **5** — 3 retracted nulls, the §13-3 splice, the `sed -i` cwd misread | read the output | n/a (mine) |

> **A NULLGLOB ABORT IS NOT A BREAKAGE AND NOT A MISAIMING. IT IS A REFUSAL: THE INSTRUMENT
> DECLINED TO RUN AND SAID SO. Breakage is silent-and-wrong; refusal is loud-and-empty.
> They share a remedy (tooling) and have opposite epistemic status, so merging them is what
> let me file four loud refusals as if they were silent breakages.**

And the bridge to the echo-header effect: **a refusal only becomes a wrong answer when a
human captions it.** The instrument never asserted anything. I did, above the blank space.

### 15-2 — A WARNING ON THE BASE-RATE ARITHMETIC: THE TWO LEDGERS ARE NOT THE SAME LEDGER

Broadcast 10 item 3 totals the retractions to "roughly four genuine apparatus failures out
of twenty-four claimed." **My three retractions should not be read as three fewer tooling
defects.** The aborts were real tooling events and quoting genuinely fixes them. What I
retracted was the attribution of **my filing error** to the apparatus — a different ledger.

> **RETRACTING "THE APPARATUS CAUSED MY WRONG FILING" IS NOT THE SAME AS RETRACTING "THE
> APPARATUS MALFUNCTIONED." Both were true of the same event.** Collapsing them risks
> over-correcting to "the tooling is fine," which would retire the quoting mandate — the one
> mitigation tonight that is unambiguously load-bearing.

The honest summary of my share: **the tooling refused four times, loudly, exactly as it
should have; and I misread all four.**

### 15-3 — WHAT MY CONTROL DESIGN ASSUMED, STATED AT LAST

Broadcast 10: *every leg's control design silently encodes which disease it assumed.* Mine,
made explicit — my A2 controls were "same pattern class CAN return hits," which **varies the
query and preserves the idiom.** That is a **misaiming detector**. The disease I actually had
in that command was **refusal**. So the control was not merely idiom-blind (§13-3): it was
aimed at the wrong disease entirely, and would have been useless even had it run.

review-194-r11's controls, per the EM, caught misaiming twice and never an abort — same
design, and it worked because misaiming was the disease it had. **The design was identical;
only the disease differed. Neither of us stated the assumption, so neither of us could see
that the match was luck.**

test-194-r11's escape covers my case too: a **mixed named result** is self-controlling for
aim *and* for refusal, because a refusal produces no rows at all, so the absence is visible
in the same invocation. There is no line to copy, so the idiom trap cannot close on it.

### 15-4 — ITEM 5's STANDING RULE HAS A GAP FOR TRANSCRIPT CENSUSES, AND THE FIX IS ANCHORING

Measured on my own transcript:

```
abort census, unanchored : 38 matches   <- 34 of them contamination (89% false)
abort census, ANCHORED   :  4 matches   <- the genuine set
report-path mentions inside transcript RESULTS : 107
```

**The new standing rule — "censuses exclude `reports/` by path" — cannot reach this.** My
report's text is not being read from a file under `reports/`; it is *embedded in the
transcript* as heredoc bodies and echoed output. There is no path to exclude. The rule is
right for filesystem censuses and **inert for transcript censuses**, which is where three
legs' self-matches occurred tonight.

**What works instead: anchor on a property only a first-class emission has.** A genuine
abort begins the line; a quotation of one is always prefixed (`6735:1290:(eval):…`). Line
anchoring removed 34 of 38 contaminants mechanically, reproducing by construction the number
I had reached by hand-adjudication.

**AND THE CONTROL CAUGHT A DEFECT IN THE ANCHOR ITSELF — the first time all night a control
of mine did its job.** I generated a fresh abort rather than copying the census line, so it
could fail independently (§13-3's rule, applied):

```
zsh -c 'ls /tmp/zz_no_such_thing_*.xyz'   ->   zsh:1: no matches found: …
                                               ^^^^ NOT "(eval):1:"
```

**My anchor `^\(eval\):` was itself misaimed** — it keyed on an incidental prefix that varies
with how the shell was invoked, and would silently miss any abort raised outside `eval`.
Corrected to `^(\(eval\)|zsh|bash):[0-9]+: no matches found:`. The count is unchanged here
because all four of mine were eval-raised, **which is exactly how a misaimed detector earns
your trust: it agrees with the right answer on the sample you happen to have.**

### 15-5 — ITEM 6: THE IAP ANSWER, RECORDED WITHOUT ROUNDING

My §12-4 item 1 flagged "this surface is IAP-bounded in the deployed configuration" as an
inherited, unverified claim that was load-bearing for AUDIT-194-R11-C1's severity. ptone's answer,
verbatim:

> "cli would be guarded by IAP. MCP not sure and can defer for now. may be that IAP and MCP
> are not going to be supported together."

**Recorded as two facts, not one:**

- **CLI: CONFIRMED IAP-BOUNDED.** The inherited claim holds on this path. **AUDIT-194-R11-C1 remains
  HIGH; CRITICAL is off the table.** The bound I could not verify came back in my favour.
- **MCP: UNRESOLVED. Deferral authorised by ptone.** **A deferral is a decision about what
  to spend time on. It is not a negative finding**, and it is not a bound. I am not rating
  the MCP path on it in either direction.

The architectural conditional — that IAP and MCP may not be supported together — **would
close the question properly rather than by deferral**, because an unbounded caller would not
exist in an IAP deployment at all. I cannot derive that from the source tree and I am not
assuming it. Flagged, not consumed.

**Severity statement, final form:** AUDIT-194-R11-C1 is **HIGH on the CLI path, on a now-confirmed bound**;
its rating on the MCP path is **not established**, and the reason is a deferral rather than a
measurement. Anyone summarising this must not compress it to "the IAP question was resolved."

---

## 16. ID REWRITE, THE FOUR-WAY SPLIT, AND §10 UNDER PTONE'S RULING

**FILED 2026-07-29T01:57:04Z**, answering Broadcast 11 items 1, 3, 4, 5 and 8.

### 16-1 — THE ID REWRITE, DONE WITH QUOTED SPANS EXCLUDED

25 occurrences of the bare ID, all rewritten to **`AUDIT-194-R11-C1`**. Before touching
anything I enumerated the sites and classified each by **whose utterance it is**:

- 24 in my own prose, 1 in my own code-fenced derivation trace, 1 in my own callout
  blockquote. **Zero inside another party's quoted text.**
- Verified by `diff` against a pre-rewrite copy: **50 diff lines = 25 sites**, and *every*
  added line contains the new ID — no collateral edits.
- Quoted-span integrity re-checked afterwards: ptone's verbatim answer, the struck-through
  original B1 paragraph, and the S-A ruling block are all still present and unmodified.

**AND THE VERIFICATION ITSELF ALMOST COMMITTED THE EXACT OFFENCE ITEM 1 WARNS ABOUT.** My
integrity grep for the S-A quote returned **0** — apparently, the verbatim ruling had gone
missing. It had not. **The pattern was my own later paraphrase** (`recognised /
category-segment marker`) rather than the text, which wraps as `recognised` / newline /
`category-segment marker`. The quote is intact at report lines 1017–1022 and matches
`briefs/dev-194-r11.md:64–76` byte for byte.

> **A MISAIMED INTEGRITY CHECK IS WORSE THAN NO INTEGRITY CHECK, BECAUSE ITS REMEDY IS TO
> EDIT THE EVIDENCE.** Had I trusted the zero, the natural repair was to re-paste the
> governing quote from memory or from a paraphrase — **silently replacing an authentic
> quotation with a reconstructed one**, which is item 1's failure without a script involved.
> An automated rewrite is not required to destroy an archive; a false negative in a
> verification pass will do it, and it will feel like diligence.

Note the class: this is my §14-1 error (reconstruction presented as transcript) reappearing
as a *hazard* rather than an event, and the only thing that stopped it was checking the
authority on disk instead of acting on the null.

### 16-2 — THE FOUR-WAY SPLIT: **1 / 4 / 4 / 5**

| class | count |
|---|---|
| BROKEN (silent and wrong) | **1** — compaction re-hydration |
| MISAIMED (right answer, wrong query) | **4** |
| REFUSED / DECLINED (loud and empty) | **4** |
| UNREAD DIAGNOSTIC (evidence already in the record) | **5** |

The fourth number was already in my §15-1 under the name **READING FAILURE**. It is the same
class test-194-r11 named UNREAD DIAGNOSTIC, arrived at independently, and its formulation is
better than mine because it locates the failure in *the record* rather than in the reader.

### 16-3 — **THE FLEET TALLY IS DOUBLE-COUNTING, AND IT IS COUNTING ACROSS TWO LEDGERS**

The four classes **are not disjoint**, and mine demonstrate it: my three retracted nulls are
each simultaneously

- a **REFUSED** event — the shell declined and said so; and
- an **UNREAD DIAGNOSTIC** — the decline was in the record when I filed the zero.

My four numbers sum to **14 against roughly 11 distinct incidents.** The overlap is not
incidental: *a refusal that is read causes no error at all*, so **every refusal that appears
in anyone's tally is, necessarily, also an unread diagnostic.** The two classes co-occur by
construction in exactly the cases that get counted.

> **THIS IS §15-2'S TWO-LEDGER PROBLEM SURFACING IN THE TAXONOMY. BROKEN AND REFUSED DESCRIBE
> THE INSTRUMENT'S BEHAVIOUR; MISAIMED AND UNREAD DIAGNOSTIC DESCRIBE THE INVESTIGATOR'S USE
> OF IT. SUMMING ALL FOUR PRODUCES A NUMBER THAT IS NOT A COUNT OF INCIDENTS**, and comparing
> legs on that total rewards whoever classified least finely. Report the two ledgers
> separately, or report incidents with a class-pair per incident.

### 16-4 — ITEM 4 v3 ACCEPTED, AND MY ANCHORED 4 WAS CORRECT BY LUCK

review-194-r11 is right and it beats my v2: **a verbatim quotation of an abort is anchored
too**, so anchoring cannot separate live output from faithful prose. My anchored count of 4
was clean only because (a) I restricted the census to `tool_result` records, and (b) I never
happened to `cat` the section of my own report that quotes the abort string at line start
into a result. **Had I done so, anchoring would have passed it through.** Anchoring removed
34 sloppy-pattern false positives and would not have removed a single accurate one.

**Source-classification — did the *command* read the transcript or the report? — is the
durable discriminator.** Shape cannot work, because the contaminating text is *supposed* to
look identical: that is what makes it a good quotation.

### 16-5 — SENTINEL REUSE, MEASURED, AND I AM AN OFFENDER

```
distinct sentinel strings this session : 17
most-reused                            : "(S1)"  ->  8 OCCURRENCES
```

Eight commands closing with the same terminator, any one of which could be read in scrollback
as another's completion. Nothing materialised — the same luck the other two legs had. Adopted
immediately: a `$RANDOM`-suffixed marker per command (`CHK-<n>-a`), used for every command in
this section.

### 16-6 — THE SCRATCH CORPUS IS REAL, AND THE MANDATE CREATED IT

Item 4(b), confirmed on my own disk: **six files under `/tmp` contain abort strings
verbatim** — `audit-msg-13/14/15.txt`, `sm.txt`, `sends.txt`, `results.txt`. Five of the six
exist *because* Broadcast 8 mandated the quoted-heredoc idiom for messaging. A second
contamination corpus, per leg, outside `reports/`, in a directory no exclusion rule names.
This is the fourth time tonight a mitigation has manufactured the next hazard, and it argues
for test-xss-r4's formulation over all of them: **search only paths you affirmatively list.**

### 16-7 — §10 UNDER PTONE'S OPTION B RULING: THE DERIVATION HOLDS, THE VOCABULARY DOES NOT

The ruling — *required scopes are the **union over the arms that apply**, satisfied
conjunctively; `max`, flooring and any ordering on scopes are permanently dead* — lands on
§10 as follows.

**Confirmed, and derived before the ruling existed:**

- §10's finding **(c)**: `max` is not well-defined because `RequireScope` is a membership
  test and **there is no order on scope sets**. The ruling makes this permanent.
- §10's reading split: **UNION** (sound) versus **SELECTION** (not sound, with a witness).
  Option B *is* the UNION reading. The SELECTION reading is now dead by ruling rather than
  by my counterexample, which is a better death.

**The trap the EM names is the one §10 closes on, and §10 gives it a concrete mechanism.**
My §10 said, before any ruling: *you cannot close AUDIT-194-R11-C1 and avoid round 10's
over-denial by tuning the combination rule — safety and cost are the same dial there, and
the only lever is the write predicate.* The ruling fixes under-demand and is silent on
over-demand, exactly as stated. **§10's Route 2 is the concrete way to get the population
wrong:** feed the read arm `canonicalAdditions`-rewritten labels and the arm that "applies"
is computed from laundered inputs. That is *union over the wrong population* with the
ruling's authority behind it.

**And the population differs per site — this is the actionable part.** The three consumers
do not have the same set of applicable arms:

| site | applicable arms |
|---|---|
| `server.go:206` `CreateTask` | add-only, `before` is a single stage |
| `server.go:391` `InsertTasksAfter` | `from` pinned to `triage`; a boolean refusal, not a scope set |
| `server.go:846` `UpdateTask` | the general case, both endpoints sets |

> **A SINGLE SHARED HELPER THAT UNIONS OVER *EVERY* ARM WOULD OVER-DEMAND AT TWO OF THE THREE
> SITES WHILE LOOKING LIKE FAITHFUL COMPLIANCE WITH THE RULING.** "The arms that apply" is a
> per-call-site question, and nothing in the ruling's text forces an implementer to ask it.

**On the vocabulary strike — and I am deliberately NOT retro-editing.** "Price", "scopeRank",
"cheaper", "more expensive" are struck going forward, and they are load-bearing throughout
§10 and §§4–9. **I am not sweeping them**, for the reason item 1 gives: a correctness sweep
that rewrites a superseded derivation *makes the derivation unreadable and erases the record
of why the ruling was needed*. §10's argument is only intelligible in the vocabulary it was
conducted in. Marked as superseded terminology at point of use, not replaced.

**Surviving merge preconditions from §10, re-expressed in the ruling's vocabulary:** union
not selection *(now mandated)*; the `(before, after []task.Stage)` signature must change,
because a pair of stage sets cannot carry a union of two scope sets; **raw labels only, never
canonicalised** *(now the primary over-demand guard)*; one combination function, not one per
site; `InsertTasksAfter` keeps a stage-pair question rather than being re-expressed as
"is the scope set non-empty"; and the property must compute the base arm independently.

---

## 17. BROADCASTS 12 AND 13 — RE-PRESENTATION, RESIDUAL-ID COUNT, AND THREE SELF-APPLICATIONS

**FILED 2026-07-29T02:12Z.** Answering Broadcast 12 items 1, 2, 4, 5, 6, 7 and 8, and
Broadcast 13 in full. **No analysis was re-run.** Items 1 and 7 are re-presentations of
work already filed; items 5 and 8 are new measurements; item 2 is a vocabulary check.

### 17-1 — BROADCAST 13 / BEADS: NOTHING TO RE-RATE, MEASURED

`grep -c 'beads'` over this report returns **0**, with the pattern class positively
controlled in the same batch. **No finding of mine rests on beads reachability in either
direction**, so there is nothing to mark provisional and nothing to revert. The two
RemoteData carriers were never cited here as a worked example.

**But the standing rule out of Broadcast 13 lands on me, and I am applying it to my own
A2 sweep before anyone else does.**

> A NEGATIVE REACHABILITY CLAIM IS NOT ESTABLISHED BY AN ABSENCE OF DIRECT REFERENCES.

My A2 deliverable has two halves and only one of them is measured:

- **the positive half** — four files carry difference-shaped gates — is MEASURED, by two
  independent idioms.
- **the negative half** — *and no others do* — rests on a **source-pattern search**, which
  is the same evidentiary shape as "zero importers." A pattern search sees gates that
  *look* like a before/after comparison at the call site. It cannot see a gate that
  consumes a difference through an interface method, through a helper that receives two
  already-computed sets as parameters, or **behind a name that does not contain the
  shape**.

**And this project demonstrates the evasion in-tree.** `store.SameStageSet`
(`store.go:252`, at `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`) *is* a difference-shaped
comparison, and its name advertises a set comparison while its body is order-sensitive.
I did not find it by shape-searching; I found it by walking a caller. **A pattern search
for the shape would have missed it, and it is one of the four.** The negative half of A2
is therefore downgraded here to **PROVISIONAL**, on the same grounds the EM downgraded
item 8, and the mechanisms that would hide a fifth gate are enumerated above **by name**
rather than gestured at. I am not re-running the sweep — no slot — but the claim now
carries its true evidentiary weight.

### 17-2 — ITEM 1 ACCEPTED. RE-PRESENTED AS INCIDENTS WITH CLASS-PAIRS.

**DISTINCT INCIDENTS: 11.** The four numbers 1/4/4/5 are withdrawn as a summable row and
re-presented below as one row per incident with a **(instrument-axis, investigator-axis)**
pair. Nothing was re-analysed; this is the same population, re-tabulated.

| # | incident | instrument axis | investigator axis |
|---|---|---|---|
| 1 | compaction re-hydration (a `Read` never issued; 235 lines from a `limit:41`) | **BROKEN** | — |
| 2 | consumer-sweep null, result-line 1290 | **REFUSED** | **UNREAD DIAGNOSTIC** |
| 3 | A2-sweep null, result-lines 6394 + 6396 (two refusal *events*, one command, one filing) | **REFUSED ×2 events** | **UNREAD DIAGNOSTIC** |
| 4 | the §13-3 splice — two runs with near-identical captions merged in scrollback | — (transcript was accurate) | **UNREAD DIAGNOSTIC** |
| 5 | `sed -i` against a reset cwd | — (harness printed the notice) | **UNREAD DIAGNOSTIC** |
| 6 | line-wise backtick detector | — | **MISAIMED** |
| 7 | self-matching backtick census | — | **MISAIMED** |
| 8 | route-6 detector: self-matching **and** regex spanning a `\|` boundary | — | **MISAIMED ×2 defects, ONE RECORD** |
| 9 | self-matching abort census | — | **MISAIMED** |
| 10 | integrity grep for the S-A ruling: pattern was my own paraphrase | — | **MISAIMED** (see 17-3) |
| 11 | `^\(eval\):` abort anchor: keyed on an incidental invocation prefix | — | **MISAIMED** |

Row 4 is the one that matters most and it has **no instrument entry at all** — the record
was correct and I was not.

**Row 8 is audit-xss-r4's shape arriving in my own tally**: one record, two errors. I count
it as one incident and two defects, and those are different numbers on purpose.

**AND A FIFTH COUNT-PIN, IN MY OWN TABLE, FOUND WHILE RE-PRESENTING IT.** My §15-1 MISAIMED
cell reads **4**, and the parenthetical beside it **names five items**. I cannot tell from
the filed text whether two of the five were intended as one instrument or whether the number
is simply wrong, and **I am not re-running the classification to find out** — the discrepancy
is the finding. A count and a set sat in the same table cell disagreeing with each other for
an hour, and every consumer of that table read the number. **That is the count-pin defect
committed inside the row of the table that catalogues it.** Rows 10 and 11 above are also
absent from that cell of four, which is further evidence the number, not the set, was stale.

### 17-3 — ITEM 5: RESIDUAL BARE IDs = **0 OF MINE**, AND THE SELF-QUOTE AUDIT

Measured over this report, controlled, code-span exclusion only:

- **Bare `C-1`: 0 occurrences.** 28 occurrences of `AUDIT-194-R11-C1` across 27 lines.
  Under-application in the direction audit-xss-r4 hit — bare IDs surviving in the summary
  where emphasis is densest — **did not occur here**, and the reason is not virtue: my
  rewrite excluded by **enumerated site list**, not by regex, so there was no shape-matching
  exclusion to misfire.
- **Bare foreign IDs: 2**, both `O7`, both inside quotations of the brief's own heading
  (`:216` in a code span, `:910` in a table cell quoting the brief item). **Correctly left
  bare** — `O7` is the dev leg's label in the brief's namespace and is not mine to qualify.
- **No other party's utterance was modified.** Specifically checked: `STAYS HIGH` returns 0,
  so no quotation of Broadcast 10 carrying the bare ID was rewritten; ptone's verbatim block
  at `:2511-2512` contains no ID; the S-A ruling block and the struck B1 paragraph are
  unmodified.

**SELF-QUOTE AUDIT, RUN FIRST AS INSTRUCTED. TWO SITES, AND THE SECOND IS THE SHAPE
review-194-r11 FOUND.** `:1727` is my own §10 callout blockquote; `:2649` is §16 quoting
that callout in italics as *"My §10 said, before any ruling: …"*. **Both were rewritten,
consistently** — so the report is internally coherent and the quotation matches its source
today. What it no longer matches is **what §10 said when it was written**, and my earlier
messages to the EM quote the pre-rewrite wording. The corruption review-194-r11 describes
did not occur (no retracted wording was silently corrected), but **the mechanism was live
here**: I skimmed `:2649` as narration on read-back and it is a quotation. It survived only
because the change was cosmetic. Had that blockquote contained struck price vocabulary
rather than an ID, the sweep I declined in item 7 would have destroyed it and I would have
read past it twice.

**THE UNDER-APPLICATION I DO HAVE IS A NAMESPACE COLLISION, NOT A BARE ID.** `S1` denotes
**three different things** in this report: a held run-slot item (`:908`), a specification
question (`:1122`, `:1129`, `:1285`), and a sentinel string (`:2617`, the most-reused
marker at 8 occurrences). `A1`–`A8` are the brief's, `B1`–`B8` are the dev leg's, `R1`–`R4`
and `S1`–`S7` are mine, and **the last two circulate to the EM in messages while being
qualified by nothing.** This is item 5's failure mode exactly — a half-qualified scheme that
reads as a deliberate distinction and is visible to nobody — arriving through labels I never
classified as IDs. I am not renaming them mid-flight; I am recording that a reader who sees
`S1` in a message from me cannot tell which of three things I mean.

### 17-4 — ITEM 2: I PRESCRIBE NO COUNT FIX, BUT I OWN A COUNT-PIN, AND THERE IS A HOMONYM

**No remedy in this report is a floor or an exact count**, so there is nothing to convert
and nothing at risk of the exact-count trap. Two clarifications, one of which is a live
reading hazard in my own text:

- **THE HOMONYM. "Flooring" in this report is not a count-pin.** §5 item 6 and §10 use
  *floor* in the **endpoint** sense — "floor the BEFORE endpoint at the read side's answer"
  — which is the brief's B1 remedy, and which ptone's ruling struck. It has nothing to do
  with `>= N` assertion counts. **Anyone applying item 2's "convert floors to membership"
  to my §5/§10 text would be transforming a struck lattice argument with a testing rule.**
  Flagged because the two vocabularies now collide in the same fleet.
- **I DO OWN A COUNT-PIN FINDING, AND ITS REMEDY IS ALREADY IDENTITY-SHAPED.** §9 (`:1420-1425`)
  measures the r11 harness declaring **7200 cells** that are **1800 behaviourally distinct
  ones sampled four times each**, because the `stages` dimension is inert and
  `enabled_noprfx` duplicates `enabled_ft`. My filed wording is *"the count-pin pins the
  **walk**, not the **distinctness**"* — the same distinction item 2 draws between magnitude
  and identity, reached on a different corpus. **Stating the remedy in item 2's mandated
  vocabulary: assert MEMBERSHIP — that the named set of configurations and the named set of
  dimensions were each exercised — never a cell count, exact or otherwise.** Raising or
  pinning 7200 would be compensating substitution with extra steps: the harness would still
  pass with the inert dimension inert.

### 17-5 — ITEMS 4, 6 AND 7: ADOPTED, WITH ONE FRESH CONTROL DEFECT FROM THIS BATCH

- **Item 4 (the unverified null) is recorded as filed** and I have nothing to add to the
  EM's formulation, which is stronger than mine: the rule is not about automation, it is
  about **any repair triggered by an unverified absence**. Adopted as a standing precondition:
  no repair from a null until the null passes a positive control.
- **Item 6 adopted, and used for every measurement in this batch.** Every control in §17 is
  `[ "$ctl" -gt 0 ] || { echo "CONTROL FAILED — result below is void"; exit 3; }`, and each
  printed its number. **It immediately found a defect in itself, which is the point:** my
  ID control printed `27` for a population of **28** — `grep -c` counts *lines*, not
  *occurrences*, and one line carries the ID twice. The control **fired correctly** (it is a
  `>0` test and the population is non-empty), but **its number was wrong by one and I would
  have published it.** A control that fails the command still needs its statistic to answer
  the question asked; **making a control blocking fixes whether you read it, not whether it
  measures what you think.** That is the residue item 6 does not reach, and it is small.
- **Item 7 (no retro-sweep of struck vocabulary in reports) is the ruling I asked for**, and
  the code half is right and is not mine: `readPrice` / `writePrice` /
  `TestLabelWritePrice_IsMonotoneInThePredicate` are live identifiers in the diff.
  Cross-referencing to my own §14-1: **the name is the specification.** A report records a
  derivation; an identifier makes a claim every time it is read.

**Restore state after §17, all four channels:** `git diff 2cbbd928…` = 0 lines;
`git status --porcelain --untracked-files=all` = 0 lines; `find -type d -empty` = 0;
`git worktree list` = `/workspace` only. **Production files touched this section: zero.**

---

## 18. STANDING RULES 2026-07-29 — THE GRADE, THE beads SPLIT, AND AN INVERSE-AND-DIFF

**FILED 2026-07-29T02:20Z**, against
`em-tooling/_STANDING-RULES-2026-07-29.md` (19,489 bytes, 265 lines, read in full, not
implemented from any broadcast summary). Ordered as the file orders itself: **§4 first.**
**§17-1 is superseded in part by 18-1 below and is preserved unedited, per §3.5.**

### 18-1 — §6.1: MY §17-1 WAS THE NAMED INSTANCE. THE MENTION SEARCH WAS RIGHT AND THE QUERY WAS WRONG.

§6.1 describes a leg answering "nothing of mine rests on beads" with `grep -ci beads = 0`
and a live control. **That is me, filed at 02:12Z, eight minutes before the rule.** The
number was correct. The question was not the one asked. Re-answered properly — by
enumerating the **populations my findings generalise over** and checking the fact against
each:

| population my report quantifies over | contains beads? | consequence |
|---|---|---|
| "the three consumers of the combination rule" (`:1776`) | **YES — see below** | **claim narrowed, 18-1b** |
| difference-shaped gates (A2 negative half) | no — the import path is create-only, it has no before-state to difference | A2 unaffected |
| `LabelMapper` / pass-through label writes | no — import rejects any non-`farmtable` platform (`export_import.go:307-309`) | unaffected |
| "the adapters" | **the PACKAGE is dead; I never generalised over adapters anyway** | unaffected |

**And the capability is in MY tree, not just in `e6bda71`.** Measured at
`2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`: `internal/server/beads_import.go`,
`export_import.go:277 case "beads":`, `parseBeadsJSONL(req.GetData())`,
`store/helpers.go:19`, `convert.go:170/190/563/579`, `server.go:2429`. I had not looked.

#### 18-1b — [NEW FINDING] [LOW] `ImportCollection` sets lifecycle stages behind an INCOMPARABLE scope, not a stronger one

- **Attribution: `[OPEN]`** — reached only by §6.1's population enumeration, from a
  broadcast about a different package. It is not in the brief and I would not have found it
  on my own axis.
- **Reachability: LIVE TODAY. NOT INTRODUCED BY THIS DIFF.** Out of the r11 diff entirely.
- **EVIDENCE: MEASURED** for every line cited; **NOT REACHED** for the store-side
  `ImportCollectionParams` implementation, which I did not read.

`ImportCollection` (`export_import.go:264-268`) demands exactly `RequireIdentity` +
`ScopeCollectionAdmin`. The beads arm then sets `Stage:` for every imported task from
`beadsStatusToTaskState` (`beads_import.go:101-121`), so caller-supplied bytes choose the
stage — including `"closed"` → **`completed`**.

**The gate this sidesteps is the one my whole report is about**, and the reason it
sidesteps it is a fact I established in §10 and never carried here: **`RequireScope`
(`scopes.go:74-94`) is a membership test with NO implication table.** `collection:admin`
does not imply `task:close`. So a token minted with `["collection:admin"]` and no lifecycle
scope brings tasks into existence at `completed` — an outcome `UpdateTask` prices at
`task:close` and `CreateTask` prices at its own gate. **Two paths to the same outcome, one
priced in the lifecycle vocabulary and one priced in a vocabulary that does not intersect it.**

**Bounds, and they are why this is LOW and not higher** — each MEASURED: the import
**creates** (fresh `uuid.New()` per task, `export_import.go:314-320`), so no existing task
is moved; **farmtable platform only** (`:307-309`), so it never reaches a GitHub label and
never touches the r11 gate; and the status→stage map is a **closed switch with a
safe default** (unknown → `triage`), so the wire picks from four known stages, not an
arbitrary string. `collection:admin` is also plausibly *intended* to subsume this.
**Recommendation:** decide deliberately whether `collection:admin` subsumes lifecycle
authority, and if it does, **say so in an implication table rather than by two independent
gates that happen not to overlap** — that is the same "two oracles, one subject" shape as
`authorizationStage` vs `lifecycleStageClaim`, which is what this round exists to fix.

#### 18-1c — WHAT I GOT WRONG STRUCTURALLY, WHICH IS WORSE THAN THE QUERY

My §17-1 answered a **dependency** question with a **mention** search *in the same section
in which I self-applied §2.5 to my own A2 sweep and downgraded it*. I performed the general
rule correctly on one claim and, four paragraphs later, failed it on another — because on
the second one the clean answer arrived as **relief**. §6.2's incentive gradient, measured
on me: **the claim I checked was the one where checking created work.**

### 18-2 — §5.1: THE ID REWRITE, RE-VERIFIED BY INVERSION. CLEAN.

§5.1 is mandatory and retroactive, and my §16 verification was a read-back plus a forward
diff — the instrument §5.1 exists to replace. Re-done properly: reverse-substituted
`AUDIT-194-R11-C1` → `C-1` over the current 2,845-line report and diffed against the
pre-image (`/tmp/pre-rewrite-655016783.md`, 156,262 bytes, 01:55Z).

**Result: 316 diff lines, ZERO `<` lines, ZERO change or delete hunks — pure appends.**
Every line that existed before the rewrite is **byte-identical** under inversion, including
the two struck self-quotations and the three foreign quoted spans. The read-back reached the
same verdict; **the inversion is the one I would defend**, because it did not require me to
notice an absence in my own prose.

### 18-3 — §5.2 AND §3.7: MY TALLY, RE-PRESENTED. **11 INCIDENTS — 1 INSTRUMENT, 10 MINE.**

§5.2 removes read refusals from the count. **Mine were not read**, so they stay — but they
stay as *my* incidents, on the investigator axis, with the instrument's refusal as a tag
rather than a cause. The honest headline in the form §5.2 mandates:

> **11 DISTINCT INCIDENTS. 1 CAUSED BY AN INSTRUMENT (compaction re-hydration). 10 CAUSED
> BY ME.** The per-incident class-pairs are the table in §17-2, unchanged; only the
> presentation and the ownership line change. No re-analysis.

And §5.2's diagnosis holds against my own filing: my four nullglob refusals were the most
*vivid* thing in my night and the cheapest thing in it. **My tally was weighted by
memorability.** The expensive incident was row 1 of §17-2, which printed nothing at all.

### 18-4 — §3.6 AND §4.3: DECLARATION **PLUS** AN ENUMERATION OF EVERY SCHEME PRESENT

§4.3 says a declaration alone is unauditable and a sweep alone is dangerous, and mandates
both. My §17-3 was a declaration with a partial enumeration. Complete enumeration of
**every identifier scheme in this report**, measured, with the second namespace §3.6 names:

| scheme | example | count | whose namespace | action |
|---|---|---|---|---|
| my findings | `AUDIT-194-R11-C1` | 28 occ / 27 lines | mine | **qualified** |
| my severity-headed findings | `[HIGH] Finding 1` … `[INFO] Finding 5` | 5 | mine | **UNQUALIFIED — "Finding 3" is fleet-ambiguous** |
| **brief checklist items** | `A1`–`A8` | 68 occ | **the brief's — §3.6's second namespace** | should be `BRIEF-194-R11-A2` |
| dev-leg blocks | `B1`–`B8` | 33 occ | the dev leg's | should be `DEV-194-R11-B4` |
| dev-leg findings quoted from the brief | `O7` | 2 occ | the dev leg's | left bare, both in quotations |
| my held run-slot items | `S1`–`S7`, `R1`–`R4` | 44 occ | mine, **and they circulate in messages** | ambiguous fleet-wide |
| my specification questions | `S1`–`S3` | overlapping | mine | **collides with the row above** |
| my sentinel strings | `(S1)` | 8 | mine | **collides with both rows above** |
| other legs' findings | `XSS-R4-O1`, `REVIEW-194-R11-C1` | in quotations | theirs | untouched |

**`S1` denotes three different things in this document**, and `Finding 3` denotes nothing
outside it. **I am not sweeping any of them** — §3.4 forbids the mechanical rewrite of
self-quotation and my `S`/`R` labels appear inside quoted messages I sent the EM, so a sweep
would rewrite the record of what I said. Marked at point of use, per §3.5. **What §4.3
actually buys here is the row I would not have written unaided: the count of unmapped
schemes is not zero, and my §17-3 declaration asserted completeness while mapping two.**

### 18-5 — §4.1: THE GRADE INSTRUMENT, TURNED ON MY OWN NON-BLOCKING GRADES

*Can my severity grade fail for the reason it claims?* Asked of all four non-blocking
grades. **Two survive. Two rested on the same unmeasured fact, and it was not the fact I
cited.**

- **Finding 2 [LOW] — the B4 startup fatal. THE GRADE IS CONDITIONAL AND I DID NOT SAY SO.**
  LOW rests on "no deployed config carries a non-delimiter `push_prefix`," and I checked
  **the default config in the tree**, which is the only config I can see. The premise is
  about deployments I cannot enumerate. **A hard `log.Fatalf` on upgrade is an outage, and
  its grade depends on a fact only the operator holds.** Grade unchanged, **dependency now
  stated**: LOW *given* the in-tree default; unrated for any deployment that hand-edited
  the prefix. That is a materially different sentence and it is the one a reader needs.
- **Findings 3 [LOW] and 5 [INFO] — both rest on ONE sub-claim, and neither re-derives it:**
  *"`labels.go:133` is the only `LabelMapper{` construction site."* **That sub-claim was
  measured with a pattern that cannot see `new(LabelMapper)`, a `var` declaration, or a
  zero-value struct field** — the §2.5 error, in my own MEASURED cell, load-bearing for two
  grades. Re-measured all three shapes: **no `new(...)`, no `var` declaration**; the two
  hits are field *declarations* (`labels.go:126`, `passthrough.go:24`), not constructions.
  The sub-claim survives — **but it survived a check it should not have passed.**
- **AND I HAVE REPLACED IT WITH A BOUNDING ARGUMENT, WHICH IS WHAT §2.5-AMENDED DEMANDS.**
  A negative reachability claim is closed by an argument that the search space is bounded,
  not by clean searches within it. For the nil mapper the space **is** boundable:
  1. `s.mapper` is assigned at **exactly one** place, `passthrough.go:83`, from
     `NewLabelMapper(cfg.GitHub.Labels)`;
  2. `NewLabelMapper` has a **single `return m`** (`labels.go:129`) of the composite literal
     built at `:133` — **it cannot return nil**;
  3. the field is **unexported**, so no package outside `github` can assign it — *this* is
     the language-level step, the analogue of review-194-r11's unexported-method argument,
     and it is what bounds the space rather than sampling it;
  4. every non-test construction goes through `NewPassThroughStore` (`resolver.go:45`,
     `cli/connect.go:299`).
  **Residual, stated rather than swept:** a zero-value `github.GitHubPassThroughStore{}` is
  constructible from any package even with unexported fields — but it carries a nil client
  and no collection and cannot serve a request. **Findings 3 and 5 keep their grades and
  change their evidence class: from a pattern search to a closed argument.**
- **The general lesson, and it is §4.1's:** nothing else in this process would have caught
  either of these, because **nobody reviews a grade**. Both were visible only from inside
  the sentence that assigned them.

### 18-6 — §1.1 HAS NOW SCORED A SECOND HIT, AGAINST ME, AND IT ALSO SHOWS ITS EDGE

Two events this batch, both from the **blocking** form of the control:

- **HIT.** A control keyed on the phrase `gate site` returned 0 — the phrase is not the one
  my report uses. **The command aborted with `exit 3` and the search below it never
  printed.** Under the decorative form I would have read a genuine, correctly-executed
  search and had no reason to distrust it. **The result was not wrong; the control's own
  aim was, and the blocking form is what surfaced that.**
- **EDGE, and it is worth recording next to the rule.** In a later batch my control ran
  `grep -rn PATTERN /workspace` while the commands below it ran
  `grep -rn PATTERN /workspace --include=*.go` with an **unquoted** glob. The control passed;
  every command below it aborted on nullglob. **A CONTROL MUST SHARE THE COMMAND SHAPE OF
  WHAT IT CONTROLS, NOT MERELY THE PATTERN CLASS** — otherwise it certifies a command that
  was never run. Same defect as §17-5's line-vs-occurrence miscount, one level up. §1.1
  fixes *whether you read the control*; it cannot fix *what the control is a control of*.
  Offered as an addendum to §1.1, not as a weakening of it — it is still the only remedy
  tonight that has stopped anything of mine.

### 18-7 — §3.10 CONTACT SCHEDULE: A CONFLICT I AM NOT RESOLVING MYSELF

§3.10 opens the inter-leg channel for adjudication once every leg on the round has filed.
**I hold a standing instruction not to read the other legs' reports and not to coordinate
with the other legs, and a standing ordering rule that the brief wins and that I must
report contradictions rather than resolve them.** So: **reported, not resolved.** I am not
opening a channel to review-194-r11 or to any other leg, and `reports/review-194-r11.md`
remains unopened — zero reads, zero writes, both measured. If the EM wants me to use §3.10,
I need that as an explicit instruction that names the constraint it overrides.

**Restore state after §18, five channels (adding §1.5's `git clean -nxd`):**
`git diff 2cbbd928…` = 0; `git status --porcelain -uall` = 0; empty dirs = 0;
`git worktree list` = `/workspace` only; `git clean -nxd` — reported below.
**Production files touched: zero. Production files READ this section: seven, all read-only.**

### 18-8 — THE NINTH CHANNEL, MEASURED — AND A REFINEMENT §1.5 NEEDS BEFORE ANY LEG ADOPTS IT

Five-channel restore proof at `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`:
`git diff` **0** · `git status --porcelain -uall` **0** · empty dirs (no exclusions,
per §1.4) **0** · `git worktree list` = `/workspace` only · **`git clean -nxd` = 1 line.**

**That one line is `web/dist/`, and it is not mine** — 4,109 files, every one with mtime
`2026-07-28 11:30`, hours before this session opened; **zero files newer than 20:00**.

**THE REFINEMENT, AND IT MATTERS MORE THAN MY NUMBER.** §1.5 is right that this is the only
channel that sees into ignored directories, but **its baseline is not empty and never will
be** — a provisioned clone ships `web/dist/` and `web/node_modules/`. So:

> **A LINE COUNT IS NOT A RESTORE PROOF ON THE NINTH CHANNEL.** `git clean -nxd` answers
> "what is ignored here," not "what did I write." Any leg adopting it as *expect zero* gets
> a permanent false positive — and the predictable adaptation is to stop reading the
> output, **which restores exactly the blindness §1.5 was added to remove, inside the
> remedy for it.** The channel needs a *timestamp or content* comparison against a
> pre-session baseline, not a count. Mine is a timestamp comparison and I have stated the
> cut-off so it can be checked.

This is §4.2's disease in a new place: **a check whose compliant reading is a non-zero
number will be scored by whoever automates it, and the automation will be wrong in the
exonerating direction.** Recorded as an addendum to §1.5, with the EM's authorship of the
channel intact — the channel is real and it is the one I had missed.

### 18-9 — THE MERGE HAZARD, RECORDED BEFORE IT FIRES

The EM reports that a second leg reached the `ImportCollection` authorization surface from
the opposite direction and deliberately did **not** file it, and is now tracking the item in
its own right. Two notes, filed here so they survive the merge:

- **My [LOW] is load-bearing on three MEASURED bounds** — create-only, farmtable-platform
  only, closed status switch — and the other leg's quoted phrasing carries none of them.
  **MERGING TWO REPORTS OF ONE FINDING KEEPS THE UNION OF THE ALARM AND THE INTERSECTION OF
  THE BOUNDS.** That is §3.1's compression hazard aimed at a merge rather than a broadcast,
  and it drives severity *up* rather than down, so §6.2's self-policing does not apply.
- **The bound I did not establish, so that it cannot travel as if I had:** I never read the
  store-side `ImportCollectionParams` implementation. **EVIDENCE: NOT REACHED.** If that
  path can target an existing collection rather than create one, the first bound falls and
  the grade falls with it.
- **§3.9 on the arrival count.** Two arrivals here are genuinely independent of each other
  and **not** independent of whatever the EM counts as the first two sightings of this seam,
  which I have never seen. Redundant arrival is indistinguishable from robust arrival from
  outside; the discriminator is whether the first was acted on. Flagged to the EM, not
  resolved here.

---

## 19. #93 VERIFIED AT `2cbbd92`, AND WHAT IT DOES TO THIS ROUND'S THREAT MODEL

**FILED 2026-07-29T02:40Z.** The EM ran the §3.9 lookup I asked for and found the first
sighting: **#93, filed by `sec-verify-f7`, confirmed, broader than either of tonight's
arrivals, and NOT ACTED ON.** Tonight's two arrivals are therefore churn scored as
convergence — my own test, upheld against the merge. **#93 carries one element neither
tonight's report has, and it is squarely on my axis, so I verified it against my own tree
rather than adopting it.**

### 19-1 — [HIGH] The import RPC persists an unvalidated `user.type`, and an unrecognised type mints WILDCARD

- **Attribution `[OPEN]`** — reached from #93's summary, verified independently. **Credit
  for the finding is `sec-verify-f7`'s, not mine; this section is a verification.**
- **Reachability: LIVE TODAY. NOT INTRODUCED BY THIS DIFF.** Long-standing.
- **EVIDENCE: MEASURED** for links 1–4 and 6; **SUSPECTED** for link 5; **NOT REACHED** for
  the operator step.

The chain at `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`:

1. `export_import.go:264-268` — `ImportCollection` requires only `RequireIdentity` +
   `ScopeCollectionAdmin`. **MEASURED.**
2. `export_import.go:584` (`resolveImportUsers`) — `store.ImportUser{… Type: exported.Type …}`
   copies the type **verbatim from caller-supplied bytes, validated against nothing.** The
   injected user must be referenced by an imported task (`requiredUserIDs`), which the same
   document supplies. **MEASURED.**
3. `internal/store/schema/user.go:19` — `field.String("type").Default("agent")`. **A PLAIN
   STRING. NO ENUM CONSTRAINT.** Any value persists. **MEASURED.**
4. `scopes.go:146-155` — `DefaultScopesForUserType`'s **default branch returns `nil`**, and
   `RequireScope` treats nil/empty as wildcard (`scopes.go:83-85`). The code's own comment
   says it: *"empty is arguably the most dangerous case since an unset user type silently
   mints a wildcard session token."* **MEASURED.**
5. `cli/token.go:158-161` — `defaults := DefaultScopesForUserType(u.Type)`; `if defaults != nil`.
   **When defaults is nil the assignment is skipped and `p.Scopes` is left empty — which
   `RequireScope` also treats as wildcard.** Two independent routes to wildcard from one
   nil. **MEASURED as code; SUSPECTED as effect**, since I did not follow `p` to the
   persisted token.
6. `convert.go:201-212` — `userTypeToProto` maps any unrecognised type to
   **`USER_TYPE_AGENT`**. The escalated user therefore **renders as an ordinary agent in
   CLI, dashboard and MCP**. **MEASURED.** This is #93's element that neither of tonight's
   reports carries, and it is the one that makes the rest durable.

**Precondition, stated so the grade can be checked:** an operator must later mint a token
for the injected user. That is not a defect — it is the routine act. **The trap is link 6:
the operator sees an agent.** A type of `"reviewr"` is a typo the code's own comment
anticipates; a type of `""` is the case the comment calls the most dangerous; either yields
wildcard, and wildcard passes `RequireScope` unconditionally at `scopes.go:88`.

### 19-2 — WHAT THIS DOES TO #194, WHICH IS WHY I AM FILING IT IN A LABEL-SCOPE AUDIT

**Every pricing argument in this round — mine, the dev leg's, ptone's Option B ruling —
assumes that holding a scope set means something.** A wildcard principal satisfies
`RequireScope` for `task:close`, `task:accept` and every other arm without possessing any of
them. **The r11 gate is not weakened by this; it is bypassed by it**, and the bypass is
reachable from a scope (`collection:admin`) that the round never models as lifecycle-relevant.

**This does not change my verdict on the diff and must not be used to.** It is not a defect
in `6d8f19e..2cbbd92` and the round should not absorb it. What it changes is the **frame**:
a report that prices `task:write` against `task:close` is describing a boundary that a
second, unfixed path already crosses. **I am recording it as a bound on my own findings'
importance, not as an argument for widening them.**

### 19-3 — THE EFFECT ON MY OWN [LOW] AT 18-1b, WHICH IS NOT THE OBVIOUS ONE

18-1b's grade rested partly on *"`collection:admin` is plausibly intended to subsume
lifecycle authority."* **That premise is now true for a bad reason.** `collection:admin`
reaches wildcard through link 2, so it is effectively root — **by defect, not by design.**

**The grade does not move.** Per the standing rule, a finding does not migrate between
vocabularies because an adjacent finding got worse, and 18-1b's three measured bounds are
untouched. **What changes is the recommendation**: "decide whether `collection:admin`
subsumes lifecycle authority" is now the *wrong* question to ask first. The prior question
is whether `collection:admin` should be able to create principals at all.

### 19-4 — A MEASUREMENT I NEED AND WILL NOT GO GET, BECAUSE GETTING IT WOULD DESTROY A BLINDING

Link 5 and 18-1b's first bound both terminate in the store-side import implementation —
**the same file `importparams-194-r11` is currently measuring under a deliberately neutral
framing, told nothing about which finding depends on it or which answer is convenient.**

**Contacting that agent is now permitted by §3.10 and would be the fastest way to close two
of my own open sub-claims. I am not doing it.** An unsealed channel is exactly how a
deliberately blinded measurement gets contaminated, and the contamination would be invisible
in the result. **THE VALUE OF A BLINDED MEASUREMENT IS DESTROYED BY THE PERSON WHO MOST
WANTS IT** — which tonight is me. Routed through the EM as a request for a second neutral
question instead, so that whoever asks it does not have to know why.

**Restore: five channels clean. Production files modified this section: ZERO. Read: nine,
read-only.**

---

## §20 — ADJUDICATION WITH review-194-r11 AND test-194-r11 (unsealed 02:32Z, §3.10)

Filed 02:48Z. Every measurement below is source-only at `2cbbd9288c70dc81f9a07d1bdc4c1fc96e2d0c6e`
or a `git show` of a historical blob. No build, no suite, no production file touched.

### 20-1 — RETRACTION: "ordering coincidence" was wrong. AUDIT-194-R11-C1 holds BY CONSTRUCTION.

> **⚠ SUPERSEDED BY §21-1 AT 02:53Z. THE CONSTRUCTION ARGUMENT BELOW IS FALSE AND THE WORD IT
> RETRACTS — "COINCIDENCE" — WAS CORRECT.** `unionStages` dedupes `extra` against **primary**, while
> the comparison is against **before**, and those two are computed from different inputs. Falsified by
> review-194-r11. Section retained unedited because a report records a derivation; read §21-1 for the
> repaired result, which is stronger than either version.

I told review-194-r11 that the 24 free cells are free because the two operand orders happen to
match, and that an ordering change would flip them to over-charging. **The first half is false.**

MEASURED:

| site | fact |
|---|---|
| `passthrough.go:1163` | `before  = s.currentLifecycleStages(t, t.Labels)` |
| `passthrough.go:1170` | `primary = s.currentLifecycleStages(t, rawAfter)` — SAME PRODUCER |
| `passthrough.go:1237-1243` | terminal branch → `AllTerminalLabelStages`; else a ONE-element phase stage |
| `terminal_label_stages.go:263` | `sort.Slice(out, out[i] < out[j])` — one total order, both sides |
| `passthrough.go:1186-1196` | `unionStages` dedupes on `seen`, appends only stages ABSENT from primary |
| `store.go:252-262` | `SameStageSet` is length-first, then elementwise |

If `set(before) == set(after)` then `extra \ primary` is empty, so `after == primary`, and primary
and before are sorted by one comparator — elementwise identical. If extra contributes anything it is
by construction set-novel, so the sets genuinely differ and the inequality is CORRECT.
**No input at this site lets the order-sensitivity change the answer.**

- My C-1 is therefore **stronger** than I filed it: it holds by construction, not by coincidence.
- review's R6, as they reframed it on my input ("the diff coupled a rendering decision to an
  authorization outcome, LIVE inside the delta"), is at this site **LATENT, not LIVE**. Sent to them
  before they finalised.
- **The process defect is mine and it is the one worth keeping.** I supplied the reason their
  previous justification failed; they correctly abandoned it; the replacement reason I handed them
  was itself unmeasured, and it moved a grade upward in four minutes. **A CORRECTION CAN BE RIGHT
  ABOUT THE OLD REASON AND WRONG ABOUT THE NEW ONE, AND THE RELIEF OF THE FIRST BUYS THE SECOND A
  PASS.** §6.2's gradient operating through a second person.

**What survives, re-aimed:** the invariant that saves this site — both operands descend from one
sorted producer, and the union only appends set-novel elements — is UNSTATED, LOCAL and enforced by
nothing. `SameStageSet` has seven other non-test call sites (`server.go:206/:391/:846`,
`multistore.go:284`, `passthrough.go:1140/:1159/:1176`) and nothing pins their operands to a common
producer. Finding to carry: **an order-sensitive comparator whose NAME promises set semantics is
shared across eight authorization sites, and its correctness at each rests on a producer invariant
stated nowhere.**

> **SUPERSEDED TWICE — see §22-6. BOTH NUMBERS IN THAT SENTENCE ARE WRONG AND THE FINDING SURVIVES
> BOTH.** (a) The count is **THREE**, not eight: `server.go:206`, `:391`, `:846`. I merged a second
> sweep's hits and counted `passthrough.go:1140`, a COMMENT, as a call site. (b) "stated nowhere" is
> **FALSE**: `store.go:249-251` states it, and §22-2 dates it — it was TRUE at `6d8f19e` and this
> diff revoked it. The corrected finding is strictly stronger than the filed one.

Remedy (review's, better than their justification for it): let `unionStages` keep
its presentation order and give the COMPARISON path a canonical form. Renaming to
`SameStageSequence` makes the trap legible, not absent.

### 20-2 — A7 CLOSED, MEASURED AT THE BASE BLOB. And a SHA-less population claim nearly killed it.

`git show 6d8f19e:internal/platform/github/passthrough.go`:

```
1100 func (s *GitHubPassThroughStore) lifecycleStagesForLabels(t *ent.Task, labels []string) []task.Stage {
1101     view := s.mapper.writeViewMapper()
1102     canonical := s.mapper.canonicalLifecycleLabels(labels)
1104     if stages := view.AllTerminalLabelStages(canonical); len(stages) > 0 { return stages }
1107     _, stage := view.IssueToPhaseStage(taskIssueState(t), taskStateReason(t), canonical)
```

**A live caller, feeding canonicalised labels straight into the read-side endpoint.** A7's
"live-broken at `6d8f19e`" is now MEASURED, not inferred. **EVIDENCE: MEASURED → CLOSED.**

At `2cbbd92` the call site is GONE; the only non-test occurrences are the definition
(`lifecycle_claim.go:356/387`) and two comments (`passthrough.go:1158`, `:1230`). review-194-r11
measured "one non-test reference, its own definition" — **correct at HEAD, and if pointed one SHA
back it would have disproved a true finding.** Two SHAs, one identifier; the EM's direction-split
class (#213). Every population claim in this report now carries its SHA.

Two consequences:

1. The diff performs a real security fix it does not advertise in its log — `passthrough.go:1155-1158`
   says the task's existing labels stay raw "because canonicalising them is precisely the round-10
   defect."
2. **[LOW] LIVE TODAY, NOT INTRODUCED BY THIS DIFF, `[OPEN]` — `canonicalLifecycleLabels` is now dead
   non-test code with a green test suite certifying that it works.** A laundering primitive with zero
   callers and passing tests is a loaded weapon with a cleaning certificate; the next in-package
   caller inherits round 10's defect and the suite stays green. **My held item R3 ("constrain who may
   call it from outside the package") is the WRONG REMEDY and I am withdrawing it** — the r10 caller
   was IN-package. Upgraded recommendation: **delete the function and its tests.**

### 20-3 — INERTNESS PART-RETRACTED. The `stages` and `closed` dimensions split.

test-194-r11 reduced the 7200-vs-1800 question to one read. Done:

- **`t.Stage` is never read on the priced path.** Not by `currentLifecycleStages`, not by
  `claimedStages`. Its only reader is the nil-mapper early return at `passthrough.go:1160-1162`,
  unreachable with a real mapper. → the `stages` dimension IS inert, conditional on `mapper != nil`.
- **`t.ClosedAt` IS read** (`taskIssueState`, `:1279-1284`) — but only on the fallback branch, reached
  exactly when `AllTerminalLabelStages(labels)` is empty. → `closed` is **conditionally live**: a real
  dimension over label sets naming no terminal stage, a replay over every set that names one.
- **`t.RemoteData["state_reason"]`** (`taskStateReason`, `:1292-1298`) is a third input inside the
  same call. `:1286-1291` names what is lost if it is unexercised: stripping stage labels off a closed
  `not_planned` issue reads as `wont_fix → completed` and **charges `task:close` for a no-op**.

> **⚠ THE RETRACTION IN THE NEXT PARAGRAPH IS ITSELF WITHDRAWN — SEE §21-2. 1800 WAS CORRECT AS
> FILED.** I described my own derivation from memory instead of reading it; `audit-194-r11.md:1423`
> and `:2812` say "1800 behaviourally distinct, **sampled four times each**" = 7200/4, the `stages`
> dimension **alone**. I never divided out `closed`. The paragraph below is wrong about my own work.

**My 1800 divided out both dimensions; one survives, so my divisor is wrong in the direction that
made the harness look weaker than it is. 1800 is RETRACTED and I am not re-deriving it** — the
arithmetic needs dimension sizes out of `lifecycle_claim_property_test.go`, and the standing
prohibition on the comment block in that file means a scan by me is the one thing I must not do.
Code fact supplied to test-194-r11; multiplication is theirs.

General form, and the third instance tonight: **AN INERTNESS CLAIM IS A NEGATIVE-REACHABILITY CLAIM.**
I published one from the harness's shape without reading the consumer. Same class as my beads answer
(§6.1) and as test's F7 derivation.

### 20-4 — BRIEF DEFECT: the headline A2 cell is DefaultConfig, mislabelled as exotic.

The brief measures the fail-open at `push_prefix " "`. test-194-r11 found `Validate()` rejects
whitespace-only (`config.go:195-201`); I read the base and **the same check is at
`6d8f19e:config.go:195`** — not new this round. But `resolvePushPrefix(" ")` trims to `""` and returns
`defaultPushPrefix "ft:"` (`terminal_label_stages.go:168-173`, `:139`). **The exotic parameter is a
no-op: that cell is byte-identical to `DefaultConfig`.**

So the demonstration was never conditional on an unusual configuration — it is the DEFAULT
deployment, presented as though it needed a strange one. A defect of **reachability LABELLING**, not
of measurement, in the deflating direction, in the document instructing everyone else to get
reachability right. Added to the numbered brief-defect list (deliverable 9). Credit for the TrimSpace
chain: test-194-r11.

This retires the operator-held dependency I declared on Finding 2 [LOW]. Per Broadcast 11 the grade
does not migrate; the dependency statement is updated and the grade stands.

### 20-5 — review's Q1 sink-enumeration bound: frontier right, premise false, closes the converse.

Their proposal: bound the difference-shaped-gate population by enumerating the SINKS (scope charges),
since scope constants are a closed enum.

- **Premise false as measured.** `RequireScope`'s parameter is `scope string` (`scopes.go:74`), not a
  named type. Of **34** non-test call sites, **four pass a computed value**: `labelScope` ×2,
  `transitionScope` ×1, `required` ×1. A census keyed on the constants misses 12% of charges and
  misses precisely the dynamic ones. Second enforcement entry point: `RequireIdentity`
  (`auth.go:40`).
- **Frontier right once re-keyed.** Enumerate the CALLEE: exactly one definition, 34 non-test call
  sites. A caller cannot charge without naming the function, so this is immune to the alias problem
  (#214) — a bounded frontier, not a search.
- **And it closes the converse of the question.** Their premise is "a gate that compares two
  evaluations and charges nothing is not a gate." On this branch that is backwards: **A6**
  (`hasExternalUnavailableLabel`) is an authoritative path with NO enforcement call anywhere on it,
  and my own C-1 IS a skipped charge. **THE DEFECT CLASS IS AUTHORITY DECIDED BY OMISSION, AND A
  CHARGE-SITE CENSUS IS BLIND TO IT BY CONSTRUCTION: IT ANSWERS "ARE THE CHARGES RIGHT?" WHEN WE ARE
  ASKING "IS EVERYTHING AUTHORITATIVE CHARGED?"**

**A2's negative therefore stays PROVISIONAL**, and what would close it is now named: enumerate from
the EFFECT side — sinks that mutate a lifecycle stage or write a label — and ask of each whether an
enforcement call dominates it. Effects are finite and typed. **The converse census is unrun and I
hold no slot.** Filed as the named next measurement, not claimed as a negative.

Same residual applies to review's Q3 answer (arm sets derived from the operation's TYPE, which I
accept without reservation): it makes arm assignment mandatory for TYPED operations and silent for
any path that never becomes one. **Both of review's bounds are complete over things already inside
the priced structure, and the two worst items on my axis are outside it.**

### 20-6 — Adopted from test-194-r11.

- **The membership set must itself be validated.** Run every fixture config through `Validate()` and
  fail on rejection. Without it, "`enabled_noprfx` was exercised" certifies coverage of a deployment
  nobody can load. This is the missing half of my membership remedy.
- **There is no 7200 pinned today.** Both sides of the count assertion derive from the same maps;
  delete a config and both drop and the test stays green. Not a weak pin — **a tautology wearing a
  pin's clothes**, the same class as a guard that has only ever agreed.
- **C-1 is HALVED, not moved.** The Route-2 laundering trace is a defect in the struck B1 remedy and
  is re-filed against the BRIEF. The fail-open in the shipped gate at `server.go:846` on the default
  configuration is live code at `2cbbd92` and independent of B1; it stays filed against the code. No
  grade travels with the split (Broadcast 11).
- Impression, axis named (test + architecture, not mine): a rename of `TestLabelWritePrice_*` that
  leaves the uncalibrated guards under a new name is **a no-action commit that looks like the
  follow-up**, and the commit MESSAGE becomes the evidence a future reader uses to skip the guards.

### 20-7 — Census correction (EM Broadcast 17 item 3), recorded because it is a method defect.

Reported to the EM: **HELD 4, 8, 11, 12, 13, 14, 15, 16, 17 / ABSENT none / UNKNOWN 1, 2, 3, 5, 6, 7,
9, 10.** I had previously reported 13 as a gap. That census searched my RAW TRANSCRIPT; **my durable
record after compaction is the SUMMARY**, which carries B13's body under its own 02:05:50Z sender
timestamp with content B16's mention could not have supplied. **A COMPACTED LEG THAT SEARCHES ITS
TRANSCRIPT IS SEARCHING THE WRONG ARTEFACT** — a systematic false negative aimed exactly at the legs
whose UNKNOWN column was already suspect, and deflating. I produced the false negative the EM
predicted, by the mechanism they named, inside the message warning them about the mechanism.

Exit-code guard, observed FIRING and not merely agreeing: `( exit 7 ) | tail -1` → `pipestatus[1]` =
**7**; `false | head -1` → **1**; success → **0**. `PIPESTATUS[0]` = `''`; `$0` = `/bin/zsh`;
`ZSH_VERSION` 5.9; `BASH_VERSION` unset. Adopted guard form:
`rc=${pipestatus[1]:-${PIPESTATUS[0]}}; echo "EXIT=${rc:-MISSING}"; [ "${rc:-1}" -eq 0 ] || { echo "CONTROL FAILED — void"; exit 3; }`
— ABSENT prints as a word rather than as nothing, and an absent reading fails CLOSED.

---

## §21 — CORRECTIONS TO §20, FILED 02:55Z. TWO OF MY OWN RETRACTIONS WERE WRONG.

Evidence marks are stated per the EM's 02:49Z relay rule (MEASURED / DERIVED / UNCHECKED, in the
sentence). Nothing below was run: no build token, no slot.

### 21-1 — THE CONSTRUCTION ARGUMENT IS FALSE. C-1 IS AN ORDERING COINCIDENCE AFTER ALL, AND NOW THE SELECTION RULE IS NAMED.

**[MEASURED by review-194-r11 at 02:50:01Z, verified by me]** `unionStages` dedupes `extra` against
**primary**. The comparison is against **before**. `before` (`:1163`, from `t.Labels`) and `primary`
(`:1170`, from `rawAfter`) are computed from **different inputs**, so `extra` can restore a stage that
is novel to primary and *present in before* — landing as an APPEND rather than in sorted position.
My §20-1 step "if the sets are equal then extra is empty" is simply false. Withdrawn.

**[MEASURED]** Terminal stages and their sort key — `entstore.go:1093-1100`
(`StageCompleted, StageWontFix, StageDuplicate, StageCancelled`), `task/task.go:237-240`
(`"completed"`, `"wont_fix"`, `"duplicate"`, `"cancelled"`), sorted by name at
`terminal_label_stages.go:263`:

```
cancelled  <  completed  <  duplicate  <  wont_fix
```

**[DERIVED from measured reads; NOT run]** One mechanism, two branches, selected by the alphabetical
relation between the restored stage and the surviving ones:

| relation | union order | comparison | outcome |
|---|---|---|---|
| restored sorts **after** every survivor | append lands in sorted position | EQUAL | **FREE** — AUDIT-194-R11-C1, the privilege fail-open |
| restored sorts **before** any survivor | append lands out of order | UNEQUAL | **CHARGED for a set no-op** — review's R6, an over-charge |

**Witness for the second branch, obtained by changing one label in a cell already measured in §9:**
same issue `{ft:stage/wont_fix, ft:stage/completed}`, delta `add=[stage/completed]
remove=[ft:stage/completed]` → `before = [completed, wont_fix]`, `primary = [wont_fix]`, extra
restores `completed`, `after = [wont_fix, completed]`. Sets identical, sequences not, charge fires.

**SO MY C-1 IS FREE BECAUSE `"wont_fix"` HAPPENS TO SORT AFTER `"completed"`. AN AUTHORIZATION
OUTCOME IN THIS DIFF DEPENDS ON THE ALPHABETICAL ORDER OF TWO STAGE NAMES.** Rename a stage constant,
or change the comparator at `:263`, and cells move between FREE and CHARGED with nothing in the diff,
the tests, or the comments recording that anything authorization-relevant happened. Neither leg had
this sentence before the exchange.

**POLARITY — my axis, and the two branches must not merge into one grade.** `SameStageSet` returns
true only on elementwise equality, and elementwise equality implies set equality. **A FALSE *EQUALITY*
IS THEREFORE IMPOSSIBLE: ORDER-SENSITIVITY CAN ONLY EVER OVER-CHARGE.** review's branch is a DENIAL of
legitimate work — availability, round 10's failure mode, the thing round 11 exists to undo — and it is
**INTRODUCED BY THIS DIFF**, since `unionStages` is absent at `6d8f19e`. My branch is the privilege
fail-open. Different kinds, different axes; my view of the over-charge branch is an **impression** on
the review leg's axis.

**Disposition note.** The EM downgraded R6 from Required at 02:49:32Z *on the strength of my §20-1
retraction*; that premise was withdrawn twenty-nine seconds later. I have told the EM. A downgrade
resting on a withdrawn premise is not a downgrade, and it is the same four-minute ratification that
produced the upgrade, run in the direction that arrives as relief.

### 21-2 — I RETRACTED A CORRECT NUMBER BY MISREMEMBERING MY OWN FILED DERIVATION.

**[MEASURED — I read my own report instead of recalling it]** `audit-194-r11.md:1423` and `:2812`:
the declared 7200 cells are "**1800 behaviourally distinct ones sampled four times each**." 7200/4.
**The divisor is the `stages` dimension alone; I never divided out `closed`.** So §20-3's claim that
"my 1800 divided out both dimensions" was false about my own filed work, and my code read
(`t.Stage` never read on the priced path; `t.ClosedAt` read on the fallback branch) **supports 1800
exactly as filed and required no retraction**.

test-194-r11's 1500 is 1800 × 5/6 for the duplicate config (`enabled_noprfx == enabled_ft`). **The two
figures are one chain at two depths and we never disagreed.** 1500 is the tighter ceiling and it is
theirs; the declared 7200 overstates by ~4.8×. **DERIVED, not MEASURED — nobody has run it.**

Also confirmed for their arithmetic: **[MEASURED]** `terminal_label_stages.go:239-247`,
`if m == nil || !m.enabled { return nil }` — `AllTerminalLabelStages` returns nil for a *disabled*
mapper, so `disabled_ft` takes the fallback on every endpoint of every cell and `closed` is maximally
exercised there. And `stages` inertness survives it: the fallback calls
`IssueToPhaseStage(state, stateReason, labels)`, which **takes strings, not the task** (`labels.go:583`),
so `t.Stage` cannot enter. *(Impression, architecture axis: the comment at `:240-243` justifies the
early return with "the task's own Stage is already authoritative," but on this path the task's own
Stage is read by nothing — the comment describes a caller's semantics as though they were this
function's. Same genre as `SameStageSet`'s name.)*

### 21-3 — THE PROCESS RESULT: THE INCENTIVE GRADIENT HAS INVERTED AND NOBODY IS AUDITING THE NEW DIRECTION.

Three of my four contributions to R6's grade were wrong, in alternating directions, each ratified in
under five minutes by someone who did not ask what had been measured:

1. "coincidence" — right, **unchecked**. review upgraded to Required on it in 4 minutes.
2. "construction" — wrong, and marked **MEASURED**. The EM downgraded on it in 4 minutes.
3. the 1800 retraction — wrong, **unchecked**, and it destroyed a correct figure.
4. "coincidence, with the selection rule named" — **derived, witness exhibited** (§21-1).

**§6.2's deflation gradient has flipped and the new direction is invisible.** Until ~02:25 the
unaudited direction was deflation-by-relief. Since then the behaviour that earns credit in this fleet
is *self-correction*. **SO AN UNCHECKED SELF-RETRACTION IS NOW THE CHEAP MOVE: IT DESTROYS A TRUE
FINDING, ARRIVES DRESSED AS RIGOUR, IS APPLAUDED ON RECEIPT, AND CANNOT BE CHALLENGED WITHOUT THE
CHALLENGER APPEARING TO DEFEND HIMSELF.** I produced two within thirty minutes of being commended for
the honest kind. Whatever the reward points at, the cheap imitation of it appears within the hour, and
it is always the version that skips the measurement.

**And the durable lesson is about evidence marks themselves: AN EVIDENCE MARK IS A CLAIM ABOUT WHICH
SUB-CLAIM WAS INSTRUMENTED, AND MINE DID NOT SAY WHICH.** I marked "construction" MEASURED because I
had read the *producers*. I had not read the *dedupe target*, which is the clause that decided it. A
mark on a compound claim needs the boundary, or one measured clause launders cover onto an unmeasured
one — **taxonomy form (13) again, applied to my own evidence marks rather than to a predicate.**

### 21-4 — INSTRUMENT FACTS (command and observed value only, per §6.11).

| command | observed |
|---|---|
| `grep --version \| head -2` | `ugrep 7.5.0 x86_64-pc-linux-gnu` |
| `grep -rn PATTERN /tmp/gtest` (dot-dir, dot-file, plain file) | `3` |
| `grep -rn PATTERN --include="*.go" /tmp/gtest` | `3` |
| `grep -r PATTERN /nonexistent-dir \| head -1`, then `ps=("${pipestatus[@]}")` | `ps=(2 0)` |
| `${pipestatus[1]}` re-read one `echo` later | `0` |
| `( exit 7 ) \| tail -1` → `pipestatus[1]` | `7` |
| `false \| head -1` → guard | `1` |

**THE `grep` IN THIS ENVIRONMENT IS NOT GNU grep.** Every population census in this report was
executed by an interpreter I never identified, and a positive control cannot catch that, **because a
control validates the QUERY, not the INTERPRETER.** I then tested the two behaviours that would have
mattered — hidden-directory descent and `--include` — and both behave, so the censuses stand on
measurement rather than on the assumption they previously stood on.

**$pipestatus clobbering reproduces here**, and the discriminator is a command between the reads, not
the second read itself. Guard form in use, which fails CLOSED and prints a word rather than nothing:

```sh
rc=${pipestatus[1]:-${PIPESTATUS[0]}}; echo "EXIT=${rc:-MISSING}"
[ "${rc:-1}" -eq 0 ] || { echo "CONTROL FAILED — result void"; exit 3; }
```

Three distinct nonzeros observed on two kinds of command: `7` and `1` from shell constructs, **`2`
from a real external binary**. A guard validated only on `false` cannot be distinguished from one
wired to the constant 1.

### 21-5 — RESTORE VERIFICATION, FIVE CHANNELS, AT 02:55Z.

| channel | result |
|---|---|
| `git diff 2cbbd928…` | **0 lines** |
| `git status --porcelain --untracked-files=all` | **0 lines** |
| empty directories (excl. `.git`) | **0** |
| `git worktree list` | `/workspace 2cbbd92 [label-write-scope-r11-audit]` — one entry |
| `git clean -nxd` | **1**, `web/dist/` — pre-existing, 4,109 files, all mtime 2026-07-28 11:30, not mine |

**Probe cells left dirty: 0.** `reports/review-194-r11.md`, `briefs/review-194-r11.md` and the Block B
comment have never been opened; the EM confirmed at 02:37Z that this prohibition is NOT lifted by the
§3.10 unsealing, and both peer legs have accepted the sender-side obligation.

---

## §22 — THE ADJUDICATION'S RESULT, FILED 03:06Z. ONE NEW FINDING, ONE DEFECT DATED TO THIS DIFF, AND FOUR CORRECTIONS AGAINST ME.

Everything below is my own measurement unless a clause says otherwise. **Nothing in §22 was
executed.** No token was held, requested or taken; every "MEASURED" mark means a file or a git object
was read, never that a test ran.

### 22-1 — THE WITNESS. SIX LINKS, ATTACKED BY BOTH PEERS, STANDING — AND IT DIES UNDER THE PROPOSED REMEDY, WHICH IS THE CORRECT OUTCOME.

Cell: `labels = {ft:stage/wont_fix, ft:stage/completed}`, `add=[stage/completed]`,
`remove=[ft:stage/completed]`, **DefaultConfig, both views enabled**.

| # | link | file:line | result |
|---|---|---|---|
| a | `applyLabelDelta` is remove-wins on `labelMatchKey`, which is prefix-PRESERVING | `passthrough.go:1528-1534` | `rawAfter = [ft:stage/wont_fix, stage/completed]` |
| b | `authorizationStage` **gates** on the prefix BEFORE the lookup | `terminal_label_stages.go:120` vs `:123` | `primary = [wont_fix]` |
| c | `canonicalAdditions` rewrite survives the `current` deletion loop and re-emits canonically | `lifecycle_claim.go:445-447`, `:460` | `ft:stage/completed` |
| d | `claimedStages` under the write view reads the re-emitted spelling | `passthrough.go:1267-1272` | `extra ∋ completed` |
| e | `unionStages` appends, does not sort | `passthrough.go:1185-1198` | `after = [wont_fix, completed]` |
| f | `before` is sorted by `AllTerminalLabelStages` | `terminal_label_stages.go:263` | `before = [completed, wont_fix]` |

`SameStageSet` is elementwise (`store.go:252-262`) → **false → A SET NO-OP IS CHARGED.**

**Composition DERIVED. Links (a)–(f) each MEASURED at source.** review-194-r11 attacked (b) — claiming
`stripForMatch` normalises the prefix — and withdrew after re-measuring: the prefix at `:120` is a
**GATE, NOT A NORMALISATION**, and `stripForMatch`'s own comment says so (`labels.go:741-744`,
"matchPrefix is shared with authorizationStage, **which REQUIRES the prefix this strips**").
test-194-r11 independently re-read (b) and (c) and could not break a link.

**review's correction to my step (c) is ACCEPTED and it changed the finding, not just its prose.** I
attributed the claim to BRANCH 2, the config-blind marker path. It is **BRANCH 1**
(`lifecycle_claim.go:211-222`), because `stripForMatch` strips the `stage/` segment without needing
the `ft:` prefix. Branch 2 is this round's NEW machinery; branch 1 is pre-existing. **THE CELL
THEREFORE DEPENDS ON NONE OF THE ROUND'S NEW MARKER CONTROLS AND SURVIVES ANY TIGHTENING, NARROWING
OR DELETION OF THEM.** A right answer through the wrong branch would have left the finding's
dependency set wrong.

**AND IT DIES UNDER THE EM's SORT REMEDY, WHICH I CONFIRM AND ENDORSE.** Both operands are deduped
(`AllTerminalLabelStages` builds from a map; `unionStages` dedupes via `seen`) and `before` is sorted
or single-element, so sorted + deduped makes elementwise equality identical to set equality. **MY OWN
WITNESS IS CLOSED BY IT. §22-3 IS NOT.**

### 22-2 — [MEASURED, `git show 6d8f19e`] THE LICENCE AT `store.go:250-251` WAS MECHANICALLY TRUE AT BASE. THIS DIFF REVOKED IT, FROM ANOTHER PACKAGE, WITHOUT TOUCHING THE FILE.

```
6d8f19e:passthrough.go:1043-1044
    before = s.lifecycleStagesForLabels(t, t.Labels)
    after  = s.lifecycleStagesForLabels(t, applyLabelDelta(t.Labels, addLabels, removeLabels))
```

`store.go:250-251`: *"Both are produced in a deterministic order **by the same function**, so this
compares them elementwise."* **ONE FUNCTION, CALLED TWICE. THE SENTENCE WAS ACCURATE AT `6d8f19e` AND
IS FALSE AT `2cbbd92`.**

Zero-preimage at base, confirmed: `unionStages` **0**, `canonicalAdditions` **0**. Base
canonicalisation was **SYMMETRIC** — `lifecycleStagesForLabels` applied `canonicalLifecycleLabels`
to both sides (`6d8f19e:passthrough.go:1102`) — so **§22-1's cell COULD NOT DIVERGE AT BASE. THIS
ROUND OPENED IT; IT DID NOT FAIL TO CLOSE IT.** Classification moves from LATENT to **INTRODUCED BY
THIS DIFF**, and the only defence the comment had — that it was aspirational — is unavailable.

Two properties I did not supply and am recording as their authors':
- **review-194-r11: THE FALSIFICATION IS REMOTE.** The revoked sentence lives in a file that is not
  in the diff, so no reviewer reading the diff ever encounters it. That is the reachability
  explanation for why four readers walked past it.
- **[MEASURED, mine] The diff ADDED the pointer.** `lifecycle_claim.go:202-205` gains, in this diff,
  *"what changed in round 11 is that the BEFORE endpoint no longer sees them. See
  LabelDeltaLifecycleStages"* — absent from `6d8f19e:lifecycle_claim.go:105-110`. **THE AUTHOR
  DOCUMENTED THE EXACT ENDPOINT ASYMMETRY THAT BREAKS THE COMPARATOR AND POINTED AT THE FUNCTION.
  THE DOCUMENTATION WAS NOT A WARNING TO ANYONE, BECAUSE THE READER IT NEEDED WAS IN ANOTHER PACKAGE.**

### 22-3 — **NEW FINDING. [LATENT] MEDIUM — THE ASYMMETRIC UNION SURCHARGES AN ENTIRE CONFIGURATION, AND SORTING DOES NOT TOUCH IT.**

**There are TWO over-charge mechanisms and they have been conflated.**

- **(i) ORDER.** Same set, different sequence. §22-1. Closed by sorting.
- **(ii) THE UNION GENUINELY ADDS AN ELEMENT.** `before ⊊ after`. A set difference. **No amount of
  sorting repairs it, and the diff DOCUMENTS IT AS DESIRABLE.**

[MEASURED] `passthrough.go:1140-1142`: *"SameStageSet follows too: **if base found the endpoints
equal and the union adds anything, they are no longer equal and the edit is priced rather than waved
through. Nothing here can be cheaper than what shipped.**"* — the over-demand, written down as a
feature. *"Nothing can be cheaper"* is a pure fail-closed argument, silent on whether anything became
**dearer than it should be**, which is round 10's entire failure mode.

**THE CELL, and it fires on a delta that touches no lifecycle label at all.** Config
`labels.enabled = false`; an **OPEN** issue carrying `ft:stage/completed`; delta
`add=["priority/high"]`.

| # | link | file:line | result |
|---|---|---|---|
| a | `before` uses `s.mapper`, the DISABLED one; `AllTerminalLabelStages` returns nil when disabled | `:1163`, `:1238`, `terminal_label_stages.go:245-247` | falls through |
| b | `MapLabelsToStage` returns `("",false)` when `!enabled`; open-issue terminal demotion applies regardless | `labels.go:280-282`, `:621` | **`before = [accepted]`** |
| c | `writeViewMapper()` returns the eagerly-built **as-if-ENABLED** mapper | `lifecycle_claim.go:349-354`, `labels.go:257` | enabled view |
| d | `claimedStages` runs the terminal scan over the **WHOLE** label set, un-demoted | `passthrough.go:1268` | **`extra = [completed]`** |
| e | union | `:1166` | `after = [accepted, completed]` |

**LENGTHS DIFFER. SORTING IS IRRELEVANT. THE CLOSE PRICE IS DEMANDED FOR ADDING A PRIORITY LABEL.**
Closed-issue variant: `state_reason=not_planned` + `ft:stage/completed` → `before=[wont_fix]`,
`extra=[completed]` → charged `wont_fix → completed`. **At `enabled=false`, EVERY label edit on ANY
task carrying a lifecycle-shaped label is priced as entering that stage, whether or not the edit goes
near the lifecycle.** Not one cell — a standing surcharge on a whole configuration.

**WHY THIS IS THE BRIEF'S A2 AND NOT A NEW SPECIES: THE STATED MITIGATION DOES NOT REMOVE THE HARM IT
NAMES.** [MEASURED] `:1156-1158` — *"the task's existing labels **stay raw** because canonicalising
them is precisely the round-10 defect"* — and `:1109-1110` scopes the second arm to *"the CALLER'S
ADDITIONS canonicalised."* Both true; both about **THE STRING**. The round-10 defect was never
fundamentally that a string got rewritten — it was that **THE EXISTING LABELS WERE EVALUATED BY A
WIDER ORACLE ON ONE ENDPOINT ONLY.** `claimedStages` does not rewrite the existing labels; it hands
**all of them, raw**, to the fully-enabled view, on the AFTER arm alone. **SAME WIDENING, SAME
ONE-SIDEDNESS, DIFFERENT INSTRUMENT — AND THE MITIGATION IS WRITTEN IN TERMS OF THE INSTRUMENT THE
LAST ROUND HAPPENED TO USE.**

**ROUND 10 WIDENED THE BEFORE ARM AND MADE WRITES TOO CHEAP. ROUND 11 WIDENS THE AFTER ARM AND MAKES
THEM TOO DEAR. ONE CLASS, TWO SIGNS, AND THE FIX FOR THE FIRST SIGN PRODUCED THE SECOND.** The diff
cannot restore symmetry by widening BEFORE, because widening BEFORE **is** the round-10 Critical.
**THE TWO ENDPOINTS ARE ASYMMETRIC BY DESIGN AND THE ROUND CHOSE THE DENIAL SIDE OF A TRADE-OFF IT
NEVER STATES AS A TRADE-OFF** — `:1142` asserts there is no cost on that side at all.

[DERIVED] And it is why test-194-r11's F18 is structural rather than accidental. `:1131-1138` proves
monotonicity from *"AFTER contains the base AFTER **by construction, because the base AFTER is
literally one of the two things being unioned**."* **THE CONSTRUCTION THAT MAKES THE THEOREM TRUE IS
THE ASYMMETRY THAT CAUSES THE OVER-CHARGE. THE SAFETY ARGUMENT AND THE DEFECT ARE ONE OBJECT SEEN
FROM TWO SIDES.**

**CLASSIFICATION, DELIBERATELY LOWER THAN THE PROSE SOUNDS. [LATENT], MEDIUM, AVAILABILITY.**
[MEASURED] `config.go:456` sets `Enabled: true`, and at `enabled=true` the terminal scan fires on the
BEFORE arm too, so **this does NOT fire in the default configuration.** It requires
`labels.enabled=false`. What keeps it off the theoretical pile is that `enabled=false` is the exact
configuration the partition was built for: `:1261-1266` calls read and write answering differently at
`enabled=false` *"the intended end state, not an inconsistency."* **THE INTENDED END STATE IS THE ONE
THAT SURCHARGES EVERY EDIT.** Direction as in §22-4: over-demand only, no privilege path.

**ASK ON THE REMEDY, and it is the only one I make:** the sort must not be recorded as closing R6's
class. It closes (i). **(ii) survives it untouched, and a fix round that sorts, re-runs a green suite
and stops will have closed the mechanism that has a witness and left the one that has a
configuration.**

### 22-4 — IMPACT, ON MY AXIS, AND IT CUTS AGAINST THE ALARM.

[DERIVED, exhaustive on `store.go:252-262`] `SameStageSet` returns true only on equal length with
elementwise equality. Two DIFFERENT sets can therefore never compare equal; only two EQUAL sets can
compare unequal. **THE COMPARATOR'S ERROR IS ONE-DIRECTIONAL. IT CAN ONLY OVER-CHARGE. IT CANNOT
UNDER-CHARGE AND IT CANNOT ESCALATE PRIVILEGE.** Availability, not confidentiality or integrity;
IAP-bounded.

**That is what makes it serious, not what excuses it. ROUND 11 EXISTS BECAUSE ROUND 10 OVER-CHARGED
AND DENIED LEGITIMATE WORK.** Accepted by both peers and the EM in these words; per Broadcast 11 my
MEDIUM does not translate into their Required and theirs does not translate into mine.

### 22-5 — THE HARNESS. **DO NOT FILE "SameStageSet IS NOWHERE IN THE HARNESS." IT IS AT `priceOf:49`.**

I had that sentence queued for this report on test-194-r11's original filing and **it would have gone
in false.** review-194-r11 measured the two occurrences; test re-measured and retracted their own;
the EM struck it from Ruling v2 §5. The corrected reason is strictly stronger and needs no claim
about absence: **:191-194 iterates `ref` and errors only when `got` LACKS a scope. An over-charge
makes `got` a SUPERSET of `ref`, so every `ref` scope is present — GREEN. THE HARNESS COMPUTES THE
VERY INEQUALITY THAT CONSTITUTES THE BUG AND ASSERTS A PROPERTY MATHEMATICALLY INCAPABLE OF NOTICING
IT. A MISSING CALL IS AN OVERSIGHT A READER CAN SPOT; A PRESENT CALL FEEDING AN INSENSITIVE ASSERTION
LOOKS LIKE COVERAGE.** Recorded as review's mechanism, ratified by the EM at the object store.

test-194-r11's grid result — that the shipped suite already walks this exact cell under DefaultConfig
with the author's own comment calling it one of *"the two shapes most likely to break monotonicity"* —
is **THEIRS, MEASURED BY THEM, CONDITIONAL AS THEY STATED THE CONDITION (suite green, nothing run).**
I hold a read prohibition covering part of that file and am structurally unable to verify it. **I am
not laundering it through this report as mine.**

### 22-6 — FOUR CORRECTIONS AGAINST ME, AND THE CLASS THEY SHARE.

1. **"EIGHT authorization sites" → THREE.** `server.go:206`, `:391`, `:846`. I merged a second sweep's
   hits and counted `passthrough.go:1140`, a **COMMENT**, as a call. review had adopted the sentence
   verbatim before I caught it. **A WRONG NUMBER INSIDE A TRUE FINDING IS EXACTLY WHAT GETS THE
   FINDING DISMISSED.** Banner filed inline at §20-1.
2. **"stated nowhere" → `store.go:249-251`.** See §22-2; the correction makes the finding stronger.
3. **1800 → 1500, and my defence of 1800 is withdrawn.** My filed sentence at `:1422-1425` names
   **both** reductions — the inert `stages` dimension **and** the duplicate configuration — and
   reports the figure for only one (7200/4 keeps six configs; "across five configurations rather than
   six" demands 1500). **THE NUMBER WAS INCONSISTENT WITH ITS OWN STATED BASIS.** I went to check it,
   read the clause I was looking for, and stopped before the clause that contradicted it — **the
   sub-clause error, committed inside the correction that named the sub-clause error.** Tally: filed
   inconsistent → retracted for a wrong reason → un-retracted for a wrong reason → settled by a peer.
4. **My step (c) branch attribution.** §22-1.

**THE CLASS, four-for-four across three legs and the EM: a claim over a space small enough to exhaust
in one command, not exhausted.** My "eight" is the same class with the sign flipped — an unchecked
POSITIVE count. review's generalisation, adopted: **A BOUNDED NEGATIVE CLAIM IS THE CHEAPEST THING TO
CHECK AND THE LEAST OFTEN CHECKED, BECAUSE THE BOUND READS AS THE WORK.**

**Two rules of mine adopted fleet-wide this session:**
- **WHERE A READ PROHIBITION MAKES AN ATTESTATION UNVERIFIABLE, THE AUTHOR DISCHARGES IT BY QUOTING
  THE LINE. A PROHIBITION BLOCKS THE FILE, NOT A LINE THE AUTHOR HANDS YOU.** It cost one quotation
  and surfaced an inconsistency three unchecked moves had preserved — **the quoting is what forced me
  to read to the end of the sentence.**
- **OVER-DEBITING YOUR OWN WORK AND OVER-CREDITING IT ARE THE SAME MEASUREMENT FAILURE, AND THE
  PENITENT DIRECTION IS THE ONE NOBODY AUDITS.** Filed after test-194-r11 caught me attaching a
  true-of-one-number self-indictment to the most instrumented message of the night. The cost is real:
  a blanket self-discount invites a reader to discount the instrumented half.

### 22-7 — CORRECTED GUARD RULE (SUPERSEDES §21-4) AND THE PROCEDURAL RECORD.

**Broadcast 20: the form recorded at §21-4 FAILS OPEN.** `rc=${pipestatus[1]:-${PIPESTATUS[0]}}` — an
intervening command substitutes a **passing** 0 rather than erasing the value, so the `:-` sentinel is
unreachable in the failure case. **CAPTURE IMMEDIATELY AFTER THE PIPELINE, WITH NOTHING BETWEEN THE
PIPELINE AND THE READ.** My positive control observed three distinct nonzeros (`7`, `1`, and **`2`
from a real external binary**) and stands; the guard FORM it validated does not.

**Read-prohibition incident, RULED, no leak.** A peer quoted a comment from
`lifecycle_claim_property_test.go` at me at 02:59:14Z. I reported the arrival to the EM and **ruled on
nothing**, because my own reading is precisely the instrument that cannot be trusted about what I am
permitted to have read. EM ruling at 03:05Z: **it is not Block B; nothing is contaminated; no artefact
is void.** The standing principle: **A RECEIVER CANNOT UNREAD, SO THE RECEIVER IS THE WRONG PLACE TO
PUT THE JUDGEMENT.** `reports/review-194-r11.md`, `briefs/review-194-r11.md` and the Block B comment
remain unopened.

### 22-8 — RESTORE VERIFICATION, FIVE CHANNELS, AT 03:06Z.

| channel | result |
|---|---|
| `git diff 2cbbd928…` | **0 lines** |
| `git status --porcelain --untracked-files=all` | **0 lines** |
| empty directories (excl. `.git`) | **0** |
| `git worktree list` | one entry |
| `git clean -nxd` | **1**, `web/dist/` — pre-existing, not mine, unchanged since 02:55Z |

**Probe cells left dirty: 0.** No commits, no pushes, no production edits, no build, no test run, no
token held or requested. **Verdict unchanged: REQUEST CHANGES, PARTIAL, held.**

---

## §23 — [MEASURED] THE SECOND STATED LICENCE, IN THE AUTHORIZATION GATE, AND IT NAMES THE HARM. FILED 03:10Z.

### 23-1 — `server.go:184-189` IS A HAZARD NOTICE, NOT AN INCIDENTAL COMMENT. IT IS BYTE-IDENTICAL AT BASE AND HEAD, AND THE FILE IS NOT IN THE DIFF.

```
184  // The SameStageSet guard is what keeps ordinary labels free: it compares the
185  // stages a label-less task would name against the stages it names with these
186  // labels, BOTH FROM THE SAME FUNCTION, so a label that is not a lifecycle
187  // statement produces no difference and costs nothing. DERIVING THE TWO
188  // ENDPOINTS FROM DIFFERENT SOURCES WOULD INVENT TRANSITIONS HERE, AND A
189  // SPURIOUS TRANSITION IS A DENIAL OF LEGITIMATE WORK.
```

[MEASURED] `git diff --stat 6d8f19e..2cbbd92 -- internal/server/server.go` is **EMPTY**. The comment
is identical at both SHAs, at the same line numbers.

**It states the precondition, states what breaks it, and states the resulting harm.** This diff does
the named thing — `before` from `currentLifecycleStages` alone, `after` from
`unionStages(currentLifecycleStages, claimedStages)`, **two sources** — and produces the named harm.

**TALLY: TWO INDEPENDENT STATED LICENCES, IN TWO FILES, NEITHER IN THE DIFF, BOTH TRUE AT `6d8f19e`,
BOTH FALSE AT `2cbbd92`, IN THE SAME WORDS.** `store.go:250-251` — *"produced in a deterministic order
**by the same function**"* — and `server.go:186` — *"**both from the SAME function**"*. Two authors
independently thought the property worth writing down. **THE ONLY TWO DOCUMENTS THAT WOULD HAVE
STOPPED THIS ROUND ARE BOTH OUTSIDE THE DIFF, SO NO REVIEWER READING THE DIFF COULD MEET EITHER OF
THEM.** That is review-194-r11's REMOTE FALSIFICATION property generalised: not an oddity of one
comment, but the shape of the whole defect.

**Consequence for §22-3's grade: NONE, and that is deliberate.** I graded mechanism (ii) MEDIUM /
LATENT / availability on my own analysis and was concerned the prose oversold it. It does not: **the
codebase's own authorization gate calls the consequence "A DENIAL OF LEGITIMATE WORK", which is the
exact phrase round 11 was chartered to eliminate.** The grade is unchanged because **a corroborating
comment is not a reachability measurement**. What changed is that the impact language is now the
tree's rather than mine.

### 23-2 — POSITIVE OBSERVATION. **CreateTask's TWO FROM-SIDES ARE DELIBERATE AND SOUND. THE ONE CANDIDATE ESCALATION OF THE NIGHT IS CLOSED, AND CLOSED ON PURPOSE.**

test-194-r11 flagged, correctly marked UNCHECKED and declined to guess: `server.go:206` prices
`|after|` scopes from the **declared** `Stage` while the guard immediately above compares the
**computed** `before`. I measured it; **it is not a defect.**

[MEASURED] `server.go:154-159`, **above** the label arm:

```go
if required := TransitionScope(string(task.StageTriage), string(stage)); required != ScopeTaskWrite {
    if err := RequireScope(ctx, required); err != nil { return nil, err }
}
```

The declared stage is **already priced, `triage → stage`, before the label arm runs**, and `:180-183`
says so: *"The 'from' is the creation stage, not the label baseline. The caller has already been
authorized for triage → stage by the arm above, so what is left to charge is stage → whatever the
labels additionally name."* The composition is `triage → stage → labels`, priced in two segments.

**THE ATTACK I WENT LOOKING FOR — DECLARE `stage=completed` SO THAT `TransitionScope(completed,
completed)` IS FREE — FAILS AT `:155`, WHICH CHARGES `task:close` FOR THE DECLARATION ITSELF.** The
one place tonight where a defect would have been a **privilege escalation** rather than a **denial**
is closed deliberately. Filed as a positive observation.

**[UNCHECKED, named not asserted]** The second segment's from-side is `stage`; the guard's `before` is
the computed `[accepted]` (for `req.Stage=triage` those differ). Whether `TransitionScope(triage, X)`
ever differs from `TransitionScope(accepted, X)` I have **not** measured. If they coincide everywhere
the point is void; if not, there is a **third** from-side in the same gate. One table lookup settles
it. Handed to r12, not claimed.

### 23-3 — MECHANISM (ii) NOW HAS FOUR INDEPENDENT DOCUMENTS AND NONE OF THEM MET EACH OTHER.

| document | what it says about (ii) |
|---|---|
| `passthrough.go:1140-1142` | over-charge is **DESIRABLE** — "priced rather than waved through … nothing here can be cheaper than what shipped" |
| `server.go:187-189` | over-charge is **A HARM** — "a spurious transition is a denial of legitimate work" |
| test-194-r11's F21 (**theirs**, MEASURED on the harness, DERIVED on the arithmetic) | the cell is in the **480 vacuous cells** — `disabled_ft × local_completed × noop` executes **zero assertions**, because `ref` is empty by construction under the noop delta |
| EM Ruling v2 §3 sort remedy | closes mechanism **(i)** only; **(ii) is a set difference and survives it untouched** |

**DOCUMENTED AS DESIRABLE, DOCUMENTED AS A HARM, UNTESTABLE BY CONSTRUCTION, AND UNTOUCHED BY THE
PROPOSED REMEDY.** test-194-r11 reached (ii) independently from the test axis; neither of us has
executed anything, so the agreement is **two independent readings, not a confirmation**.

**STANDING ASK, now supported from two axes: the sort must not be recorded as closing R6's class.**

### 23-4 — PROCEDURAL: A CONFLICT IN THE R13 EXTENT RULING, REPORTED AND NOT RESOLVED.

The EM's 03:06:35Z extent ruling places **all source including comments** in category 4, NOT COVERED,
and adds that it would not have mattered had the quoted text been Block B, "because source comments
were never in scope." But at **02:37:43Z and again at 02:42:22Z** the same authority ruled the
seven-line Block B comment specifically in force for me, by name, twice, as *"unchanged, specifically
motivated, and NOT swept up by the unsealing."* **Block B is a source comment. Category 4 repeals it.**

**I have reported the conflict and am continuing to treat Block B as prohibited until it is ruled on**,
per the standing order that I surface contradictions rather than resolve them. It remains unread.

The general form, which is worth more than my case: **AN EXHAUSTIVE CATEGORY LIST SILENTLY REPEALS
EVERY SPECIFIC EXCEPTION THAT DOES NOT FIT ITS CATEGORIES, AND NOBODY DECIDES THE REPEAL.** "This list
is closed" was written to stop inference, and closure is precisely what makes it repeal by omission.
**IT IS THE SAME SHAPE AS THE TWO COMMENTS IN §23-1: A TRUE, LOCALLY CORRECT STATEMENT THAT
INVALIDATES SOMETHING IN A DOCUMENT IT NEVER MENTIONS.** Three instances tonight, in two different
media — code and process.

---

## §24 — THE CREATETASK FREE ROW, THE SORT RETRACTION, AND THE TWO ARTEFACTS AN ADVERSARIAL APPARATUS CANNOT SEE

All source citations in this section are `2cbbd92` unless marked. Nothing in this section was
executed. No token was held at any point. Evidence marks are per clause, not per sentence.

### §24-1 — FINDING S8. `CreateTask`'s label arm reaches `accepted` for free. **[HIGH] [LIVE TODAY] [NOT INTRODUCED BY THIS DIFF] [PROVISIONAL ON LINK (f)]**

**Location:** `internal/server/server.go:198-215`, with `internal/platform/github/passthrough.go:558-578`
and `internal/platform/github/labels.go:31-40, 298-303, 626-636`.

**Description.** The label-write gate prices `req.GetLabels()` against a BEFORE endpoint computed
from `&ent.Task{Stage: stage, CollectionID: collID}` — **a task with no `Labels` field at all**
(`server.go:200-201`, [MEASURED], independently confirmed by the EM at the object store). An empty
label set yields no terminal scan, so `IssueToPhaseStage` falls through to the open-issue fallback
and returns `StageAccepted` (`labels.go:626-632`, [MEASURED]). The BEFORE endpoint of this gate is
therefore **`[accepted]` for every unlabelled caller**, and `SameStageSet([accepted],[accepted])` is
true for any label naming `accepted`, so the pricing loop at `:206-215` — which sits **inside** the
`if !SameStageSet` block — **never runs**. Zero scopes are demanded. Meanwhile the declared spelling
`CreateTask(stage=accepted)` is charged `TransitionScope(triage, accepted)` at `:155`, which matches
row 2 of `transitionTable` and costs **`task:accept`**.

**Impact.** Same authoritative end state; one spelling costs `task:accept`, the other costs nothing.
This is the round-6 defect table printed verbatim in the comment at `server.go:171-177`, **one stage
lower than the row the fix was measured on**. The protected harm is availability: `task:accept` is
what stands between unvetted work and a task that is claimable and appears in `ft ready`.

**The root cause, and it is not the one I first published.** *(See §24-4 for the correction history.)*
**THE PRICING BASELINE IS A COUNTERFACTUAL THE STORE NEVER REALISES.** `server.go:185` describes the
BEFORE endpoint as "the stages a label-less task would name." [MEASURED] `passthrough.go:558` —
`stageLabel := s.mapper.StageToLabel(p.Stage)` — means **a label-less task does not exist on this
path**: the store writes the stage label itself on every create. The guard compares the request
against a state the system never produces, and the error is exactly one stage — `accepted` — which
is the free row. Accepted verbatim by the EM in Ruling 6 §4.

**Why `accepted` and not some other stage.** [MEASURED] The fallback returns `StageAccepted` because
`StageTriage` plus the auth-stage-4 accept gate would block *all* roles from claiming unlabelled
issues. **A DISPLAY-FALLBACK DECISION TAKEN FOR CLAIM AVAILABILITY, IN THE LABEL MAPPER, SUPPLIES THE
BASELINE OF AN AUTHORIZATION GUARD IN ANOTHER PACKAGE — AND THE STAGE IT PICKS IS THE FREE ROW.**
Third instance tonight of review's REMOTE FALSIFICATION, and the first where the remote decision was
not a comment but a returned value.

**The contested spelling — link six, closed by me.** test named it `[UNCHECKED]`: `:558` and `:574`
put **two** stage-shaped labels on one issue, so read-back is decided by whichever the mapper
resolves first. [MEASURED] `labels.go:31-40` `stagePrecedence` = `[working, in_review, in_qa,
deploying, accepted(4), triage(5), completed, wont_fix, duplicate, cancelled]`; `:298-303` returns
the first precedence hit among candidates. Candidates `{triage, accepted}` → **`accepted` wins by one
index.** [DERIVED, one step] Since `triage` is outranked by every stage above it and all of those are
also spellable as labels, **there is no `p.Stage` a caller can declare that beats a label they
attach, except by being the same stage.** `labels.go:15` says of that list: *"THIS ORDERING IS A
DISPLAY RULE. AUTHORIZATION MUST NOT DEPEND ON IT."* **FIFTH HAZARD NOTICE OF THE NIGHT, AND IT IS
NOW DECIDING THE OUTCOME OF A PRIVILEGE QUESTION.**

**The condition, and the two populations.** I named the open bound before anyone asked: `:574-578`
appends a caller label **only if `labelNameToID` resolves it**, so the attack needs `ft:stage/accepted`
to already exist in the repository's label index. review swept the identifier and the EM swept the
tree; **I closed it over the product's entire GitHub API surface instead of over an identifier.**
[MEASURED] Every GitHub call the product can issue is a method on `graphqlClient`, and there are
exactly fifteen: `listIssues :86, getIssue :144, listIssueComments :163, listSubIssues :210,
getRepositoryID :220, createIssue :240, updateIssue :268, closeIssue :293, addComment :311,
addSubIssue :331, removeSubIssue :350, addLabels :369, removeLabels :388, listRepoLabels :414,
updateIssueAssignees :449`. **THERE IS NO `createLabel`. THE PRODUCT CANNOT CREATE A GITHUB LABEL; IT
IS NOT THAT IT DECLINES TO.** `AutoCreateLabels` (`config.go:44-46`, defaulted `true` at `:461`) is
read nowhere outside tests. This is the positive-control form the brief demands: **the query that
found nothing also found fourteen things, so it was not eaten.**
[UNCHECKED] Whether an operator provisions `ft:stage/*` out of band. That is not a code question and
I decline to guess at it.

**And the condition does not bound the harm — review measured that, against their own attempt to
deflate it, and I confirm every link.** The same silent drop applies to the store's own stage label
at `:558-563`. So:

- **BRANCH A — `ft:stage/*` provisioned.** S8 fires exactly as derived above.
- **BRANCH B — `ft:stage/*` not provisioned.** `ft:stage/triage` does not resolve either, so the
  created issue carries **no stage label at all**, and the open-issue fallback renders it
  **`accepted`**. No label, no spelling, no attacker.

**A ∪ B is unconditional. That result is review's and is recorded as review's.**

**I split it, because the two branches are the same effect and two different harms.** BRANCH A is a
**bypass**: there is a differential act — spell the stage as a label — and it buys a state the priced
path refuses. BRANCH B is **gate vacuity**: `CreateTask(stage=triage)` and `CreateTask(stage=accepted)`
reach the same end state, the `:155` gate still *denies* the second, and the first is free. Nobody
does anything. Every task the deployment creates is `accepted`, **including the ones created by the
people who hold `task:accept`.**

> **ON THE AXIS THIS BRIEF ASSIGNED ME — "WHETHER A STATED MITIGATION ACTUALLY REMOVES THE HARM IT
> NAMES" — B IS THE WORSE FINDING AND A IS THE MORE REPORTABLE ONE, AND THAT IS EXACTLY BACKWARDS
> FROM HOW THEY WILL BE READ. A HAS AN EXPLOIT AND WILL BE FIXED. B HAS NO EXPLOIT, NO REPRODUCTION
> NARRATIVE AND NO VILLAIN — AND IT IS A6 ARRIVING BY A SECOND ROUTE: THE HARM `task:accept` EXISTS
> TO PREVENT IS UNVETTED WORK BECOMING AVAILABLE, AND IN BRANCH B EVERY TASK IS BORN AVAILABLE.**

**Recommendation.** Do not sort, do not widen, and do not add a stage to the fallback. Price the
endpoint the store will actually produce: build the BEFORE task from the labels the store will land
(`StageToLabel(p.Stage)` plus the resolvable subset of `p.Labels`), or price `CreateTask`'s label arm
against the **declared** stage rather than against a re-derived read of an empty label set —

```go
// server.go, CreateTask label arm: the BEFORE endpoint must be the state the
// store will actually create, not a label-less task the store never writes.
baseline := &ent.Task{Stage: stage, CollectionID: collID,
    Labels: []string{s.stageLabelFor(stage)}} // what passthrough.go:558 lands
before, after, err := store.LabelDeltaLifecycleStages(ctx, s.store, baseline, req.GetLabels(), nil)
```

and separately, **make an unresolvable label a failed write rather than a skipped one** — the drop at
`labelNamesToIDs:205-213` is what makes Branch B possible and it is silent by design.

### §24-2 — FINDING S9. Nothing leaving `triage` ever costs `task:claim`. **[MEDIUM] [LIVE TODAY] [NOT INTRODUCED] [CONDITIONAL ON PROVISIONING]**

[MEASURED] `server.go:147-150` hard-refuses `stage=working` with `codes.InvalidArgument` — not a
scope — "so availability and self-assignment are enforced" via `ClaimTask`. The label spelling
`labels=[ft:stage/working]` reaches the same end state (`working` is `stagePrecedence` index 0 and
beats the store's `triage` label), and is priced `TransitionScope(triage, working)`, which matches
**row 2** (`from: stagesTriage, to: nil` → `task:accept`) **before** row 4 (`to: stagesWorking` →
`task:claim`). `ClaimTask` is bypassed entirely and `task:claim` is never demanded.

`transitions.go:86-88` shows the ordering was deliberate — row 2 is placed high so no destination can
launder a task out of triage without `task:accept`. **A DELIBERATE PRIORITY ORDER IS A POLICY
STATEMENT ABOUT THE FIRST MATCH AND IS SILENT ABOUT EVERYTHING IT SHADOWS.**

This corrects one clause of EM Ruling 4 §4 — "it charges more, never less." **SCOPES ARE NOT
ORDERED.** `RequireScope` is a membership test over opaque strings with no implication table.
**A HOLDER OF `task:write` + `task:accept` WITHOUT `task:claim` PASSES A GATE THAT SHOULD HAVE
DEMANDED `task:claim`. THAT IS NOT MORE. IT IS ELSEWHERE.** Struck by the EM in Ruling 6 §3, who
named the mechanism precisely: *"I imported a lattice that does not exist onto a set of opaque
strings, and 'more' is the word that hid it."*

Branch B yields `accepted`, never `working`, so S9 needs the provisioned repo. review downgraded it
to CONDITIONAL and I accepted without argument.

### §24-3 — SCOPE. NEITHER S8 NOR S9 IS SCORED AGAINST THIS DELTA, AND THE DISPOSITION SENTENCE MUST CARRY THE LONG FORM

[MEASURED, three legs independently] `git diff --stat 6d8f19e..2cbbd92 -- internal/server/server.go`
is empty. Both rows behave identically at base. **They are an older, live, separate item; they do not
block r11 and they are not counted against `2cbbd92`.**

The EM published into the disposition: *"this round's entire confirmed defect surface is
ONE-DIRECTIONAL OVER-DEMAND, AVAILABILITY, NO PRIVILEGE PATH."* I contested that clause and nothing
else in the ruling. It was retracted in Ruling 5 and the split was adopted verbatim in Ruling 6 §4:

> **"THIS DIFF INTRODUCES NO PRIVILEGE PATH" IS TRUE. "NO PRIVILEGE PATH EXISTS" IS FALSE. A READER
> SIX MONTHS FROM NOW WILL TAKE THE SHORTER SENTENCE AS A CLEARANCE FOR THE ENDPOINT, NOT FOR THE
> DIFF.**

That is the whole class of harm this round has been cataloguing, committed by the document that
reports it.

### §24-4 — THE CORRECTION HISTORY OF S8, BECAUSE THE CONCLUSION IS UNCHANGED AND EVERY WORD OF THE DERIVATION IS NEW

I filed S8 at 03:13 with a derivation that asserted `before = [accepted]` and treated it as the
honest baseline. **I had not read `passthrough.go:558` and did not know what the store writes.**
Checking myself, I then formed the refutation *"the baseline genuinely IS accepted, so the label
confers nothing, S8 is dead"* — **also false, for the same missing fact.**

> **I WAS ONE READ AWAY FROM PUBLISHING A FINDING FOR A WRONG REASON AND ONE READ AWAY FROM
> RETRACTING A TRUE ONE FOR ANOTHER WRONG REASON. THE SAME UNMEASURED FACT WOULD HAVE PRODUCED BOTH
> ERRORS, IN OPPOSITE DIRECTIONS, NINETY SECONDS APART.**

review derived S8 and S9 independently and sent them before either of us had seen the other's.
**THAT IS ONE DERIVATION WITH TWO AUTHORS, NOT TWO WITNESSES, AND WE BOTH SAY SO.** Link (f) —
whether anything downstream re-derives the stage from `p.Stage` rather than from the label — was
named by me as the weakest link and explicitly not claimed. test measured that in pass-through the
stage has no storage of its own (`:558`, `:487-488`, `:637-642`) and refused to let that be read as a
closure. **(f) IS OPEN. WHOEVER CLOSES IT ENUMERATES THE CONSUMERS, NOT THE CREATE PATH.** The EM
graded the HIGH **provisional on (f), recorded as provisional rather than as HIGH-with-a-caveat**,
and declined to assign (f) to the leg that found it.

### §24-5 — R6(i) IS NOT CLOSED. I WITHDRAW MY CONCESSION TO THE SORT, AND THE WITHDRAWAL IS THE MORE IMPORTANT HALF

I had conceded: *"my own witness dies under your remedy and that is the correct outcome."*
**OVERTURNED.** review falsified the sort; the EM confirmed the deciding link and withdrew it from
all three rulings that carried it. Confirmed by me at source, since I am the one who conceded:
[MEASURED] `terminal_label_stages.go:263` `sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })`;
[MEASURED] `unionStages` `passthrough.go:1185-1198` emits **primary then novel, no sort**, and its
docblock gives error-message stability — not correctness — as the reason. At
`DefaultConfig × two_terminal × swap_local_for_markerless`: `before = [completed, wont_fix]`,
`primary = [wont_fix]`, `extra = [completed, wont_fix]`, `after = [wont_fix, completed]` — same set,
reversed sequence. **Sort it and `after == before` → free → `got` empty while `ref = {task:close}` →
the shipped assertion fires, and it would be right: the swap becomes free while the deployment's own
read predicate says the task left `completed`.**

> **THE SORT DOES NOT CLOSE R6(i). IT CONVERTS R6(i) INTO THE ROUND-10 CRITICAL AT THE SAME CELL.
> MY WITNESS DIES AND A WORSE ONE IS BORN IN ITS PLACE.**

review's root cause is the final form of R6 and I adopt it: `passthrough.go:1140-1142` reasons
*base-EQUAL → union adds → unequal → priced* and never considers *base-UNEQUAL → union adds the
missing element → EQUAL → FREE*, **the only direction in which widening AFTER lowers the price**.
The cross-product argument at `:1134-1138` is sound and irrelevant, because the `SameStageSet` guard
sits in front of the cross product and can zero it. **THE DIFF'S MONOTONICITY THEOREM IS TRUE AT HEAD
ONLY BECAUSE THE COMPARATOR IS ORDER-SENSITIVE. THE DEFECT IS LOAD-BEARING FOR THE PROOF.**

### §24-6 — THE PROCESS RESULT OF THE NIGHT, AND IT IS ABOUT MY OWN CONCESSION

The EM's Ruling 6 §1: *"a remedy proposed by the adjudicator is unaudited by construction, and it is
the one artefact guaranteed to be implemented."* True, and there is a second one, and it is mine.
I filed, hours earlier, that **over-debiting your own work and over-crediting it are the same
measurement failure, and the penitent direction is the one nobody audits.** I then conceded a remedy
that would have shipped the round-10 Critical, and **the concession passed three adversarial legs and
a ratification untouched, because it cost me something and therefore looked like rigour.**

> **THE TWO ARTEFACTS THAT PASS UNAUDITED THROUGH AN ADVERSARIAL APPARATUS ARE THE ADJUDICATOR'S
> REMEDY AND THE AUTHOR'S CONCESSION. NEITHER IS A CLAIM ABOUT THE CODE. ONE ARRIVES AS A DECISION
> AND ONE ARRIVES AS A CONFESSION, AND THE APPARATUS IS POINTED AT ASSERTIONS.**

This supersedes §22-7's framing and stands above it.

### §24-7 — THE DROP RUNS IN BOTH DIRECTIONS: THE TWO-SIDED FORM OF THE FOURTH HAZARD NOTICE

The EM found `server.go:196-197` — *"Nothing here observes the labels that actually land"* — and read
it correctly as a **disclaimer**, which invites the reader to stop where a warning would invite them
to check. review added that it describes both branches of S8. The complete statement is sharper,
because the gate and the store disagree in **opposite directions at the same time**:

- **PRICED AND NEVER WRITTEN.** [MEASURED] `:402-408` and `:937-947` route every label write through
  `labelNamesToIDs:205-213`, which appends on resolve and does nothing otherwise — no error, no log.
  The tree says so out loud at `:391` (*"Names that the repository has no label for are dropped by
  labelNamesToIDs"*) and again at `:1316`. **The gate can charge `task:close` for a label that never
  lands.** One-directional over-demand, availability, same class as R6.
- **WRITTEN AND NEVER PRICED.** [MEASURED] `:558` lands `ft:stage/<p.Stage>`, which appears in no
  `req.GetLabels()` and is therefore in neither pricing endpoint.

> **THE DISCLAIMER AT `:196-197` COVERS AN OVER-CHARGE AND AN UNDER-CHARGE SIMULTANEOUSLY, AND IT IS
> TRUE ABOUT BOTH. THAT IS WHY IT NEVER READS AS A WARNING: A SENTENCE THAT DESCRIBES A HAZARD IN
> BOTH DIRECTIONS AT ONCE DESCRIBES NO PARTICULAR HAZARD, AND SPECIFICITY IS WHAT MAKES A COMMENT
> BITE.**

Running tally of stated, load-bearing, locally-true preconditions this tree violates elsewhere:
`store.go:250-251`; `server.go:186`; `server.go:196-197`; `.design/github-graphql-integration.md:793`
(a manual test plan for a `createLabel` mutation that was never written); and now `labels.go:15`
("AUTHORIZATION MUST NOT DEPEND ON IT"), which decides S8's contested spelling. **FIVE. NONE OF THEM
IS WRONG. ALL FIVE MISLEAD, AND THEY MISLEAD BY BEING BELIEVED.**

### §24-8 — PEER RESULTS ACCEPTED THIS SESSION, ATTRIBUTED, NOT RELAYED AS MINE

- **review, R6 final form and the sort falsification** (§24-5). Accepted in full; it overturns my own
  concession.
- **review, `AutoCreateLabels` is a dead flag with a live default.** Confirmed by me over the closed
  API surface (§24-1). review flagged the shape of their own near-miss: *"I went looking for the fact
  that would deflate someone else's HIGH, found it, and it inflated it instead."*
- **review, `working` is reachable on the FROM side** via `namespaced: {status:duplicate,
  kanban:working}` — correcting test's F22 reason while keeping its conclusion. Not my axis; recorded.
- **test, F21** (480 zero-assertion cells), **F22** (two-element codomain, contingent),
  **F23** (no `accepted` label anywhere in the ten-set basis — *"the seventh config was never a
  config, it was an eleventh label set"*), **F24** (review's mirror delta is order-robust, so the
  prediction pins the control as well as the treatment). F23 composes directly with S8: **a basis
  whose every lifecycle spelling is terminal can never produce the cell where the baseline equals the
  target, and the baseline is `accepted` on every unlabelled path.**
- **EM, Ruling 5 §3**, the disclaimer-versus-warning result (§24-7), and **Ruling 6 §1**, the
  unaudited-remedy rule (§24-6).

### §24-9 — RESTORE VERIFICATION, FIVE CHANNELS

`git diff 2cbbd92` = 0 lines. `git status --porcelain --untracked-files=all` = 0. Empty-directory
sweep = 0. `git worktree list` = 1. `git clean -nxd` = 1 entry, `web/dist/`, pre-existing and not
mine — compared by ownership, not by count. **PROBE CELLS LEFT DIRTY: 0.** No commits, no pushes, no
production edits, no build, no test run, no token held.

---

## §25 — A6 DISCHARGED (required deliverable 5), THE A8 OPINION (deliverable 7), AND TWO NEW BRIEF ERRORS

### §25-1 — A6. `hasExternalUnavailableLabel` IS STILL UNPRICED IN BOTH DIRECTIONS AT `2cbbd92`, AND THIS DIFF DID NOT MOVE IT IN EITHER DIRECTION. **[MEASURED]**

**Still unpriced — with a positive control on the negative.** The function's vocabulary is four
words (`treewalk.go:235`): `blocked`, `waiting_for_input`, `deferred`, `scheduled`, matched after
stripping the configured prefix, the default prefix, or no prefix, and then `stage/`
(`treewalk.go:217-240`). A grep for those four literals across every non-test `.go` file in the tree
returns **twenty-five sites in seven files** — `internal/store/entstore.go`, `internal/server/export_import.go`,
`internal/server/beads_import.go`, `internal/platform/beads/beads.go`, `internal/cli/graph.go`, the
Ent schema, and `treewalk.go` itself. **The query was capable of a positive, and it found twenty-four
of them elsewhere.** Inside `internal/platform/github/`, the package that owns the authorization
predicates, **the only hit is `treewalk.go`.**

Therefore: `lifecycleStageClaim`, `authorizationStage`, `AllTerminalLabelStages` and
`assertStageWriteAllowed` **do not know these words exist**. Adding or removing `ft:blocked` moves no
lifecycle stage, so `before == after`, so `SameStageSet` is true, so the pricing loop at
`server.go:206` never runs. **A bare `task:write` still adds and still removes an operator's explicit
hold, for free, at `2cbbd92`. CONFIRMED LIVE.**

> **AND IT IS THE SAME MECHANISM AS S8, NOT A SECOND ONE: A GATE THAT DECIDES WHETHER TO PRICE AT
> ALL, BLIND TO AN ENTIRE VOCABULARY. S8's BLIND SPOT IS ONE STAGE (`accepted`); A6's IS FOUR WORDS
> THAT ARE NOT STAGES. A CENSUS OF CHARGE SITES FINDS NEITHER, BECAUSE IN BOTH CASES THERE IS NO
> SITE.**

**Did this diff move it? No, in both directions, and here is the only coupling that could have.**
[MEASURED] `git diff --stat 6d8f19e..2cbbd92 -- internal/platform/github/treewalk.go` is **empty**.
The function's one dependency on anything this round touched is `m.matchPrefix()`
(`terminal_label_stages.go:194-196`), and B4 this round added a `Validate()` constraint requiring
`push_prefix` to end with a separator (`config.go`, +41). That acts **at load time only**: it shrinks
the set of *legal configurations*, never the spellings honoured by a configuration that starts, and
the default prefix is honoured unconditionally regardless. **So no deployment that boots honours
fewer hold spellings than it did at `6d8f19e`, and none honours more. A6's reachability is exactly
where it was.** The brief said *"I do not know which and I have not measured it"* — that is now
measured, and the answer is neither.

**The docblock is the eighth hazard notice, and it is form (13) stated almost in the brief's own
words.** `treewalk.go:190-197`: *"There is no privilege to escalate by honouring one more spelling…
Adding a spelling is monotone: this function can only withhold, so a wider match can only withhold
more."* **EVERY WORD OF THAT IS TRUE AND IT DEFENDS THE WRONG THING.** It answers *"is it safe to
honour more spellings?"* The open question is *"who may write the label at all?"* The predicate can
only withhold; the **write** that removes the label is priced by a machine that has never heard of
the word.

> **A TRUE MONOTONICITY ARGUMENT ABOUT A PREDICATE, OFFERED WHERE THE DEFECT IS THAT NO GATE CONSUMES
> THE PREDICATE. THE BRIEF NAMED THIS FORM — "A TRUE PROPERTY OF A PREDICATE DOES NOT BOUND A GATE
> THAT CONSUMES A DIFFERENCE OF TWO EVALUATIONS" — AND HERE IS AN INSTANCE THAT PREDATES THE ROUND,
> WRITTEN BY SOMEONE REASONING CAREFULLY, IN THE FUNCTION THE BRIEF ASKED ABOUT.**

**This is also the A2 sweep result.** The brief calls A2 — *"are there other difference-shaped gates
in this codebase with the same defect?"* — the highest-value question it asks. **The highest-value
answer is A6, which the brief filed under a different heading.** See §25-3 item 10.

**Recommendation.** Do not widen the claim to cover hold labels — that would price the *addition* of
a hold, which is the direction the docblock is right about and would deny legitimate withholding.
**Price the removal only**, at the gate rather than in the predicate:

```go
// server.go, alongside the lifecycle arm: releasing a hold is a privilege
// question; applying one is not. The asymmetry is the point.
if releasesHold(t.Labels, req.GetRemoveLabels()) {   // was held, will not be
    if err := RequireScope(ctx, ScopeTaskAccept); err != nil { return nil, err }
}
```

### §25-2 — A8. THE LIVE-BROKEN COMMIT IN MERGED HISTORY. **MY SECURITY OPINION: A REAL EXPOSURE, BUT THE ROUTE PEOPLE ARGUE IS THE WEAKEST OF THE THREE.**

`bc93200` is live-broken with the round-10 Critical; `93ae124` repairs it. The squash decision is the
EM's; this is the security input.

1. **Checkout-and-run is the weakest route.** Nobody deploys a bisect landing point. Taken alone this
   would be bookkeeping.
2. **Branch-from-bisect and revert are real routes, and they are ordinary practice.** A hotfix
   branched from wherever a bisect stopped, or a `git revert` of a later commit that partially
   restores the broken state, reintroduces an authorization defect into a shipped artefact **without
   anyone deciding to**. Any per-commit CI or merge queue that builds every commit turns this from a
   human choice into machinery.
3. **The strongest objection is evidentiary, not exploitative, and it is the one I would weigh
   heaviest.** `bc93200`'s own message is *"Make the label-write harness able to fail"*; the repair
   at `93ae124` describes itself as restoring files *"a differential probe reverted."* **A HISTORY IN
   WHICH A SECURITY FIX IS BROKEN BY A MEASUREMENT ACCIDENT AND RESTORED BY ANOTHER COMMIT IS A
   HISTORY IN WHICH THE PROVENANCE OF THE FIX CANNOT BE READ OFF THE LOG.** For a control on its
   eleventh round, with four rounds of findings that turned on *when* a defect became live, **the
   audit trail is part of the control.** §22's dating of R6 to this diff was possible only because
   the base blob was clean; a history with self-inflicted breakage in it makes that kind of dating
   cost more every round.

**Opinion: squash, or keep the history and record the vulnerability in a commit trailer on
`bc93200` itself so that anything landing on it is self-announcing.** I am not recommending any
control be relaxed to make the history tidier. And note the direction of my own argument: **the
reason to squash is not that someone will run it. It is that in six months nobody will be able to
tell from the log whether round 11 ever shipped broken.**

### §25-3 — ADDITIONS TO §5, THE NUMBERED LIST OF PLACES THE BRIEF IS WRONG (discharging the reserved item 10)

10. **§A2 and §A6 are the same finding, and the brief does not know it.** A2 asks for a sweep for
    "other difference-shaped gates with the same form-(13) defect" and calls it the highest-value
    question in the brief. A6 hands me a gate with exactly that defect, already known, already live,
    filed 80 lines later under "the fourth authoritative path." [MEASURED, §25-1] The pricing
    machinery is blind to `hasExternalUnavailableLabel`'s vocabulary, so `before == after`,
    `SameStageSet` is true, and the difference-shaped gate never fires — **which is form (13) with
    the difference evaluating to zero instead of to the wrong value.** The brief split one item in
    two and then asked me to find the second half. **EVIDENCE: MEASURED. Cost: I nearly ran the A2
    sweep as a fresh search over an open set, which is the expensive way to rediscover something the
    brief was already holding.**
11. **§A6's phrase "a fourth authoritative path" points the reader at the wrong vocabulary, and that
    is plausibly why it has survived four rounds.** `hasExternalUnavailableLabel` is authoritative
    for **availability**; it never names a lifecycle stage and no stage predicate can see it. Every
    leg told to look for "authoritative paths" on this branch has looked in the stage machinery —
    `authorizationStage`, `lifecycleStageClaim`, `AllTerminalLabelStages`, `TerminalLabelStage` — and
    the fourth path is not there and never was. **A NAMING THAT PUTS A DEFECT IN THE WRONG DRAWER
    COSTS MORE THAN AN OMISSION, BECAUSE THE SEARCH THAT WOULD FIND IT IS THE ONE NOBODY RUNS.**
    EVIDENCE: MEASURED for the code claim (§25-1); DERIVED for the attribution of the four-round
    survival.

### §25-4 — WHAT REMAINS OWED, STATED PRECISELY RATHER THAN ESTIMATED

- **Deliverable 8, prediction accuracy as a fraction.** ~~Still owed.~~ **DISCHARGED at §27**
  (03:42Z), as three fractions rather than one: 4/5 micro-predictions (self-deflated to "one idea
  tested four times"), **2 of 9 brief sub-items anticipated open**, and four filed items with no
  brief entry at all. The refusal recorded here still stands and is why it was not produced earlier:
  **I did not produce a fraction from memory; a made-up denominator is exactly the failure this
  round has been cataloguing.**
- **A7's second half** (why the r10 three-way review missed the seam) needs
  `.design/project-log/label-write-scope-r11.md`, which is readable and unread.
- **(f)** — whether any consumer re-derives stage from `p.Stage` rather than from labels — is OPEN
  and, per the EM, not assigned to the leg that found it.

---

# §26 — THE CROSSED REMEDY EXERCISE: BOTH REMEDIES FALSIFIED, ONE CONSTRAINT SURVIVING, AND ONE NEW FINDING (S10)

Written after EM Ruling 7 (crossed assignment), Ruling 8 (link (f) ratified), and Ruling 9 (the
round adopts no remedy). Reasoning, reading and greps only throughout: **no token was issued, no
build was run, no test was run, no production file was modified.**

## §26-1 — WHAT THE EXERCISE WAS, AND THE HAZARD IT CARRIED

EM Ruling 7 §2 crossed the assignments: **review-194-r11 attacks RM-2 (mine); audit-194-r11
attacks RM-1 (review's).** The stated fear was a draw — mutual "survives scrutiny" — with the
warning "A DRAW IS NOT A PASS."

The structural hazard is not the draw. It is the **trade**: each leg holds a remedy the other has
been ordered to attack, so each has a standing incentive to pull its punch in exchange for a pulled
punch. I declared that conflict **before** filing my attack rather than after, flagged that two of
my four attacks converged on my own remedy's interests and told the EM to discount them, and wrote
the strongest counters to my own attacks into the same message rather than leaving review to find
them. Review did the same in the other direction. Neither of us took the trade.

**That is not a control. It is three parties behaving well inside a structure that did not require
it** — the EM's own words in Ruling 9 §4, and the correct reading. The record should not count
this exercise as evidence that crossed assignment is safe. It is evidence that crossed assignment
*was* safe *once*, with these three legs, and the mechanism that made it safe was disclosure, not
design.

## §26-2 — MY ATTACK ON RM-1: FOUR FILED, ONE LANDED

RM-1 (review's): the gate should charge **ref ∪ got** — the union of the read predicate's price and
the write seam's price.

| # | Attack | Outcome |
|---|--------|---------|
| (1) | RM-1 prices two AFTER endpoints and cannot reach the BEFORE endpoint, where S8 and A6 live | **Holds as a bound.** Review accepts it and accepts my own (c): RM-1 never claimed S8. Its live clause is that RM-1 **does not retire `server.go:186`'s licence — it doubles what the licence must cover.** One derivation, two authors; review handed me that clause before my message arrived and I record it as one, not two. |
| (2) | RM-1 is monotone in the price, and monotone in the price is monotone in the denial | **REFUTED. Withdrawn as an attack on RM-1.** |
| (3) | `ref` and `got` can name **disjoint** transitions, so the union demands scopes for a transition **no view believes occurs** | **LANDS. Conceded by its target.** |
| (4) | Two cells measured where the arms disagree; in both the read arm is right and the write arm is wrong; the measured case for unioning is 0-for-2 | **Fails as an attack — it is an argument *for* the term RM-1 adds.** |

**One for four.** The self-serving reading available to me is "the one that landed is the one review
cannot answer, so one was enough." That reading is available, it is not false, and I am declining to
lead with it. The EM's framing is the honest one: an adversarial exercise that lands 1-in-4 is
working; one that lands 4-in-4 was theatre.

### §26-2a — WHY (2) FAILED, AND WHY THAT MATTERS MORE THAN THE THREE THAT DIDN'T

I claimed RM-1 "converts every spurious transition either view can construct into an unconditional
charge," citing review's own §4 cell — read arm free, write arm inventing `accepted → completed` =
`task:close`.

[MEASURED] `server.go:205-215` prices **`after` and nothing else**: the loop runs over `after`, and
`after` at HEAD is already `unionStages(read, writeView)` (`passthrough.go:1159-1177`). So `got` at
HEAD **already contains the write arm's inventions.** In review's §4 cell, `ref = {}` and
`got = {task:close}`, so `ref ∪ got = {task:close}` — **exactly what ships today.** RM-1 changes
nothing in the cell I said killed it.

> **RM-1's entire delta over HEAD is `ref \ got`: charges the read view demands that the write view
> has dropped. That is the UNDER-charge direction — the round-10 Critical's direction — and it is
> the only direction in which RM-1 adds anything at all.**

Two consequences, and the second is the reason this is recorded at length:

1. **My (2) and my (4) point in opposite directions, and (2) is the wrong one.** RM-1 is monotone
   only in the added term; the added term is the **read** arm; and my (4) reports the read arm as
   right 2-for-2. I filed both in the same message and did not notice that one refutes the other.
   The failure mode is specific and I want it named: **when four attacks are assembled against one
   target, they are checked for strength against the target and not for consistency with each
   other. An attack set is not audited as a set.**
2. **(2) is not withdrawn, it is RELOCATED.** It is a correct finding **against the shipped diff**:
   `2cbbd92` unconditionally charges the write arm's invented transitions — that is R6(ii), it is
   LIVE in the artefact under audit, and `server.go:187-189` calls a spurious transition a denial of
   legitimate work. **That promotion is review's reading, not mine.** I am marking the attribution
   because a wrong attack of mine turning into a finding of mine is precisely the direction nobody
   audits.

This also **rescopes the measurement the EM queued.** Ruling 9 §1 held (2) as RM-1's deciding cost
and queued a token measurement of "the availability cost of RM-1." The correct measurement is
**the cardinality of `ref \ got` across the grid** — strictly smaller, differently shaped, and it
does not quantify over the write arm's inventions at all. I notified the EM that its ruling retained
the one of my four attacks that had just been refuted, **and that the error ran in my favour.**

### §26-2b — (3), THE ONE THAT LANDED, AND WHY IT IS A SECURITY FINDING AND NOT AN ERGONOMICS ONE

`passthrough.go:1179-1184` states the union's own rationale: these stage sets are **rendered into
authorization error messages.** Under RM-1, an operator can be denied and shown a transition set
that is not the price of any reachable state — a transition **neither** view believes occurs.

Soundness survives. Explainability does not. And the consequence is on my axis, not review's:

> **A CONTROL WHOSE DENIAL CANNOT BE EXPLAINED IS ONE AN OPERATOR ROUTES AROUND, AND THAT IS HOW A
> SOUND CONTROL BECOMES AN ABSENT ONE.**

That is the sentence review could not answer and the EM carried into the disposition. It is a
threat-model claim: the adversary in it is not an attacker, it is an operator with a deadline and
a scope-granting button, and the vulnerability is a denial message that gives them no way to
comply narrowly.

## §26-3 — MY ATTACK ON MY OWN REMEDY, AND RM-2's DEATH

I attacked RM-2 (mine) as well as RM-1, opening with the declared conflict and refusing to bank
test's F26 observation that favoured it. Four self-attacks; the fatal one was §1:

> **RM-2 says "price the state the store will actually produce." In Branch B — an unprovisioned
> repository — the store produces NO STAGE LABEL. Computed honestly, both endpoints from the
> produced label set: baseline renders `accepted`, result renders `accepted`, `before == after`,
> **STILL FREE. RM-2 DOES NOT CLOSE 1B.** The only way to make it close 1B is to define BEFORE as
> the declared stage (`triage`) and AFTER as what the labels will render (`accepted`) — and that is
> a comparison between endpoints derived from **DIFFERENT SOURCES**, which is precisely what
> `server.go:186-189` warns produces invented transitions, and precisely the sentence I used to
> date R6 and to convict this diff. **I CANNOT CONVICT THE DIFF WITH A RULE AND THEN EXEMPT MY OWN
> REMEDY FROM IT.**

I named the single link holding RM-2 up — the second horn's escape, "a request is not a belief,
so comparing a request to its effect is not comparing two beliefs" — and pre-committed: *if you can
break it, RM-2 is dead outright and I will say so in those words.*

### §26-3a — THE DISJUNCTION, COMPLETED BY THREE PARTIES, NONE OF WHOM HELD BOTH HALVES

| Horn | Definition of the endpoints | Result |
|------|------------------------------|--------|
| **1** | Both endpoints honestly from the produced label set | `before == after` in Branch B. **RM-2 inert; 1B not closed.** (mine) |
| **2** | BEFORE = declared stage, AFTER = rendered stage | Every create in an unprovisioned repo prices `triage → accepted` → row 2 → **`task:accept`. A holder of `task:write` alone cannot create a task at all.** (review's (D)) |

**There is no third way to define the endpoints. Horn 1 is inert, horn 2 breaks the endpoint, the
disjunction is complete, and RM-2 is falsified rather than weakened.**

Review then broke the escape twice:

- **(i)** `server.go:187-189` is **stated in terms of a harm, not a species of comparison.** It does
  not say "do not compare two beliefs"; it says deriving endpoints from different sources invents
  transitions, and a spurious transition is a denial of legitimate work. My distinction may even be
  true and it is still not an exemption. Generalised, and it is review's result:
  > **A RULE WRITTEN AS A CONSEQUENCE CANNOT BE ESCAPED BY RECLASSIFYING THE MECHANISM.**
- **(ii)** Horn 2 **prices the store's own defect against the caller.** The caller requested
  `triage`. `triage → accepted` is not an act the caller performed — it is the silent drop made
  visible and then billed to the party who did not cause it. **The more broken the repository is,
  the more scope the caller must hold, and neither caller nor operator can see why.** I did *not*
  bank this as an independent kill: it is my own self-attack (2) — the price depends on remote,
  attacker-influenceable state via `listRepoLabels` — arriving from the caller's side instead of the
  attacker's. One derivation, two authors, recorded as one.

**RM-2 IS DEAD OUTRIGHT.** Recorded in the words I pre-committed to.

### §26-3b — I OVER-CONCEDED, IN THE DIRECTION I HAD NAMED AS UNAUDITED, WITHIN ONE MESSAGE OF NAMING IT

My concession said "your (D) is decisive." **It is not, and review is the party who established
that.** (D) presupposes horn 2; on horn 1 there is no create to deny and (D) has nothing to stand
on. (D) is the measured harm **of** horn 2, not a property of RM-2.

Corrected attribution: **RM-2 is killed by my own §1 fork plus review's two breaks of the horn §1
left open — not by (D) standing alone.** I accepted a kill on grounds more generous to my opponent
than the record supports, ninety seconds after filing the observation that over-crediting is a
measurement failure.

> **METHOD RESULT (second half of the penitent-direction result): OVER-CREDITING THE ATTACK THAT
> BEAT YOU IS THE SAME MEASUREMENT FAILURE AS OVER-CREDITING YOUR OWN DEFENCE, AND IT IS FASTER,
> BECAUSE CONCEDING FEELS LIKE PAYING A DEBT AND NOBODY AUDITS A PAYMENT.** The conclusion did not
> move; the derivation was wrong; and this is the second time this round that a finding of mine has
> been correct in its conclusion and wrong in every word of its derivation (see §24, S8).

### §26-3c — THE RETREAT TOWARD UNFALSIFIABILITY, AND ITS RECONCILIATION

Review's form critique: **an outcome-shaped remedy names a result and no mechanism, so it cannot be
falsified until somebody picks a mechanism for it — it survives adversarial review by being
unimplementable as stated.** Correct, and I owe an aggravation against myself: when RM-2 came under
pressure I narrowed it to *"the gate must not price against a baseline no execution path produces."*
**That narrowing made it MORE outcome-shaped, not less. I retreated in the direction of
unfalsifiability and experienced it as rigour.**

Review filed, in the same minutes, that the same sentence **survives and is worth more than the
remedy was.** Both hold, and the reconciliation is the useful part:

> **THE FORM THAT IS FATAL IN A REMEDY IS THE CORRECT FORM FOR A CONSTRAINT. A REMEDY WITH NO
> MECHANISM IN IT CANNOT BE IMPLEMENTED OR FALSIFIED; A CONSTRAINT WITH NO MECHANISM IN IT IS DOING
> ITS JOB, BECAUSE ITS JOB IS TO RULE OUT MECHANISMS IT HAS NEVER SEEN. MY ERROR WAS NOT THE
> NARROWING. IT WAS KEEPING THE WORD "REMEDY" ON IT AFTER THE NARROWING — WHICH IS HOW A CONSTRAINT
> GETS COUNTED AS A FIX AND A ROUND CLOSES WITH NOTHING SHIPPED.**

Recorded as **CON-1, a constraint on remedies**, adopted as none of RM-1/RM-2/RM-3. The round scores
**zero remedies adopted**, not one.

## §26-4 — RM-3, WHICH I PRODUCED AND MUST NOT ASSESS

While attacking RM-1 I found its best defence and handed it over: in the cell that killed the EM's
sort, **`ref = {task:close}` independently of any ordering**, because `priceOf` prices *pairs* and
`completed → wont_fix` hits the wildcard row whatever order the slices arrive in. So the read arm
holds the price up while the write arm collapses, and **RM-1 + sort closes R6(i) and the Critical
direction together, which nothing else on the table does.** The EM named that RM-3 and routed it to
review — explicitly **not** to itself (half of it is the remedy it withdrew) and **not** to me.

**I decline to assess RM-3, and the routing is the call I would have made.** I produced it as a
concession inside an attack, which is the artefact class my own capstone names as passing unaudited,
and I do not get an exemption for having named it.

Two non-assessment notes:

- Review's precondition (2) — `store.go:250-251`'s licence must be rewritten in the same commit,
  because the sort makes the elementwise comparison **sound** without making *"produced in a
  deterministic order by the same function"* **true** — is the same false-licence object as my
  attack (1) on RM-1, and review's framing (a correct behaviour resting on a false explanation is
  R6's exact shape one layer up) is better than mine. **That the licence appears as a precondition
  of the only surviving candidate is the strongest evidence that it is the load-bearing falsehood in
  this subsystem and not a comment defect.**
- Test's F27 extension lands on the component **I** proposed: the sort is necessarily seam-side and
  the union server-side, so RM-3 is the hybrid and takes the bad horn of both — and **every cell the
  sort newly collapses is a cell where `got` empties while `ref` does not, which is the shape that
  fires the harness's assertion. The component added to rescue the price breaks the oracle in
  proportion to how well it works.** Recorded against my own contribution.

## §26-5 — INPUTS RECEIVED THIS PHASE THAT I DID NOT PRODUCE

- **Link (f) CLOSED in my favour** (test, ratified by the EM with an independent measurement: all
  four occurrences of `p.Stage` in `passthrough.go` — `:487, :558, :637, :642` — are conversions
  into a label). `issueToTask`'s **signature cannot see `CreateTaskParams`**, which is a scope
  argument and stronger than any enumeration. **Rows 1A and 1B therefore resolve from provisional
  HIGH to HIGH.** Test's own caveat is carried: its sweeps were corroboration, not the proof, and
  its (f) grep "sat unresolved for two hours and only moved because you assigned it — the refusal
  prevented a false filing; it did not produce a measurement."
- **F26 and F27, the inverted-pin class**: a test that goes **red on the fix and green on the
  defect**. Two instances, one aimed at the naive fix and one at the remedy most likely to be
  adopted. The EM's disposition names it as **the only failure class in the taxonomy that gets more
  dangerous the better the test is written, because the engineer who reverts on its evidence is
  behaving correctly.**
- **Binding for r12**: a pricing fix lands as **two commits, oracle first, with the oracle commit
  demonstrated RED against unfixed production before the behaviour commit exists.** Neither remedy
  can be validated by the suite this diff ships — server-side RM-1 makes it fail on the fix;
  seam-side RM-1 makes the assertion a tautology and the 7200 cells 7200 confirmations of an
  identity.
- **Test's OP-6 limitation, adopted by all three legs**: *"A DECLINED MEASUREMENT WITH NO OWNER
  DECAYS INTO EXACTLY THE SILENCE A FALSE NEGATIVE WOULD HAVE PRODUCED — MORE HONESTLY AND JUST AS
  QUIETLY. A DECLINED MEASUREMENT MUST BE ADDRESSED TO A NAMED OWNER, NOT MERELY MARKED
  [UNCHECKED]."* I have applied it below.

## §26-6 — A6, THE CONTROL-CLASS REPAIR (deliverable 5, discharge recorded)

My A6 negative — the hold vocabulary is unpriced in the github authorization path — was originally
licensed by a **vocabulary-bounded** positive control (four hold words, 24 sites, six packages)
while the negative itself was **region-bounded**. Different kinds of thing, so the control licensed
nothing. This is test's refinement — *"the control firing does not license the negative unless the
control is the same kind of thing"* — and it applied to me.

Repaired with a same-region, same-shape control across the three github authorization files:

| Probe | `terminal_label_stages.go` | `labels.go` | `passthrough.go` |
|---|---|---|---|
| stage vocabulary (`wont_fix|completed`) — **positive control** | 3 | 30 | 8 |
| hold vocabulary (`blocked|waiting_for_input|deferred|scheduled`) | **3, all comments** | 0 | 0 |

**The region is greppable, the stage vocabulary is all over it, and the hold vocabulary appears only
as a comment pointing elsewhere** — at `treewalk.go`, the file that owns the fourth path, saying it
carries no toggle guard. **A6 confirmed unpriced in both directions at `2cbbd92` on a same-kind
control**, and this diff moves it in neither direction; the only coupling is `matchPrefix()` via B4,
which acts at load time only.

## §26-7 — S10 [NEW, MEASURED, LIVE, NOT INTRODUCED BY THIS DIFF]

**Title: `writeLabelSwap`'s own docblock condemns the silent write failure in ¶2 and blesses it in
¶4, seven lines apart, for the identical observable consequence.**

**Location:** `internal/platform/github/passthrough.go:374-397`.

Paragraph two — the round-8 fix's rationale:

> *"A silently-swallowed write failure is also a correctness bug in its own right — UpdateTask
> returned the issue as if the swap had landed, so a caller acting on that answer, and the event
> this store's callers publish from it, both described a state GitHub was never put into."*

Paragraph four, **seven lines later** (`:380-384` condemns, `:391-394` blesses):

> *"Names that the repository has no label for are dropped by labelNamesToIDs and are NOT an error
> here. That is pre-existing behaviour and deliberately left alone: it fails closed for the gate,
> which models such a label as applied and so over-charges rather than under-charges."*

**Description.** The silent drop produces exactly the consequence ¶2 calls a correctness bug: the
store returns the issue as if the label landed, the caller acts on that answer, and the emitted
event describes a state GitHub was never put into. Same function, same docblock, same observable
consequence — **condemned in one paragraph and blessed in the other. The round-8 fix stopped at the
error return and never reached the case where there is no error to swallow.**

**And ¶4's justification is load-bearing and struck.** *"Over-charges rather than under-charges"* is
the lattice the EM repudiated in Ruling 6: scopes are unordered opaque strings, so an over-charge is
not a safety margin — it is a **denial**, and `server.go:187-189` says so in the tree. **The only
argument in the codebase for keeping the silent drop is that it denies.**

**Impact (impact before severity).** S10 is the **enabling condition** for S8/S9 and for review's
disposition-level result — *nothing can price a write that can silently fail to happen* — rather
than a distinct privilege path. Every pricing scheme proposed this round is downstream of it.

**S10's cost, corrected by test (F28) after this section was filed — accepted, and it makes S10 more
expensive than I filed it.** [MEASURED, test] `labelNamesToIDs`/`labelNameToID` are named at **29
line-sites across 6 test files, of which exactly ONE is executable code — the other 28 are prose.**
**Independently re-measured by review after this paragraph was filed: 29 sites, 6 files, per-file
3/5/7/2/1/11 — identical file for file — and `registerLabel` 28/10.** Review's refinement, which
strengthens the claim rather than weakening it: of the 29, the single executable call is
`concurrency_test.go:88`, and the four non-comment remainder sit inside **failure-message string
literals** — **prose that compiles.**
`registerLabel` has **28 call-sites across 10 files** and is called before every lifecycle write,
with a docblock stating the reason in those words: the drop is silent. So **Branch B is not merely
untested by this corpus — it is excluded by the fixture's construction, deliberately, and the
exclusion is documented in the helper that performs it.** Test also checked and *declined* the
tempting inference: erroring on the drop turns **zero assertions red** (the drop appears as the
stated harm inside failure messages, not as an oracle), so **F28 is not a third inverted pin.** What
it does is make **up to 28 stated reasons false while the suite stays green** — which is review's
precondition (2), a correct behaviour resting on a false explanation, at corpus scale.
**Consequence, folded into S10's mechanism and not counted beside it: S10's commit must sweep the 28
justification sites in the same commit.** My "not proposing a fix" stands; my implicit assumption
that the fix was cheap does not.

**Grade: HIGH, as the mechanism of row 1B, not as a fourth count.** I am not inflating a root cause
into an extra finding. **LIVE TODAY. Older than this diff. NOT scored against `2cbbd92`.**

**Recommendation — and I am explicitly NOT proposing a fix.** Making the drop an error is a
behaviour change for every deployment currently running unprovisioned, which is the availability
class I have spent this round charging others with; the population size is **[UNCHECKED]**, and per
the OP-6 refinement that unchecked is **addressed to the EM as routing owner, not merely marked**
(the EM has accepted the adjacent question by name). The load-time fail-closed polarity this round
established at B4 is the shape most likely to transfer, and whether it does is r12's question and
review's axis, not mine.

### §26-7a — TWO METHOD LINES ATTACHED TO F28's VERIFICATION, BOTH REVIEW'S

Review re-derived F28 before endorsing it, first got **17/4 and 22/7** against test's 29/6 and
28/10, and came within a message of filing a false falsification — after the close order, in the
direction that would have made another leg wrong. The cause was a path glob
(`internal/platform/github/*_test.go`) that excluded two files **the finding itself named**, both
under `internal/server/`.

> **A GLOB IS AN UNSTATED BOUND. THE DISCONFIRMING EVIDENCE WAS INSIDE THE CLAIM BEING CHECKED, AND
> IT WAS NOT READ BEFORE THE OBJECTION WAS FORMED.**

> **BEFORE FILING A COUNT DISCREPANCY, RE-RUN THE OTHER PERSON'S QUERY, NOT YOUR OWN. A PER-FILE
> BREAKDOWN IS A POSITIVE CONTROL THE AUTHOR HANDED YOU FOR FREE.**

Both are review's, recorded here because they are the same family as this report's own
positive-control discipline and because the second one is the cheapest of all of them: **the control
was already in the message being answered.**

## §26-8 — WHAT THE ROUND PRODUCED ON THE REMEDY QUESTION

> **RM-1: not adoptable alone. RM-2: dead outright. RM-3: not rescued. Zero remedies adopted, and
> that is a finding rather than a failure.** No author defended his own; the only candidate still
> upright at any point was produced by its opponent inside an attack.

The bound that survives, and it is the deliverable r12 should receive instead of a design:

> **THE DEFECT IS IN THE BEFORE ENDPOINT. RM-1 REACHES ONLY THE AFTER ENDPOINT. EVERY BEFORE-ENDPOINT
> REPAIR PROPOSED TONIGHT EITHER PREDICTS REMOTE STATE OR MIXES SOURCES. AND UPSTREAM OF ALL OF IT:
> `labelNamesToIDs` STILL DISCARDS THE STAGE LABEL WITH NO ERROR, NO LOG AND NO RETURN VALUE — SO
> NOTHING DOWNSTREAM OF THE WRITE CAN BE PRICED. FIX THE OBSERVABILITY BEFORE CHOOSING A PRICE.**

Attribution: the observability formulation is **review's**; the completed horn-1/horn-2 disjunction
is **mine and review's**, neither of us holding both halves; the oracle-ordering requirement is
**test's**; the disposition is the **EM's**. The tree-level evidence that the observability result
is not merely a preference — S10 — is mine.

**And the process ruling belongs in a security report because it is a control finding**: three
independent reviewers spent forty minutes acting as a design committee on remedies they then had to
review. The only reason it did not end in mutual ratification is that all three refused the trade
when it was offered. **A structure whose safety depends on the honesty of the parties it is meant to
check is not a control.**


---

# §27 — DELIVERABLE 8: PREDICTION ACCURACY, AS FRACTIONS, WITH THE MISSES

The brief asks for "your prediction accuracy as a fraction." **One fraction is the wrong shape for
this question and I am giving three, because the open pass and the brief were measured against each
other in both directions and a single number hides which direction is being reported.** Every
denominator below is a count of items that exist in a document, not an estimate.

## §27-1 — (a) The micro-predictions inside the open pass: **4/5**

P1–P4 HIT, P5 MISS (`stripForMatch` strips only the *configured* prefix, `labels.go:738`, so
`status:duplicate` is genuinely non-authoritative and freeing it is correct). Already recorded at
§2, and **already deflated there by me**: P1–P4 came from reading the union's two config-blindness
routes. **That is one idea tested four times, not four predictions. A 4/5 built from one idea is a
1/1 with a large denominator, and the large denominator is doing rhetorical work.**

## §27-2 — (b) The open pass as a control on the brief: **2/9 of the brief's sub-items**

This is the fraction the brief actually asked for — "my targeting has steered a round away from the
defect before; your open pass is the control on my brief."

| Brief sub-item | Anticipated in the open pass, body-blind? |
|---|---|
| A1 — the forced residue (`ft2:completed` vs `release:completed`) | **HIT on the defect** (open-pass P3: foreign-prefix present-label removal is FREE). **MISS on the framing** — I did not raise the impossibility claim, the reachability model, or the blast radius. |
| A2 first half — the union does not close the leaving direction | **HIT.** The open pass names the difference structure and predicts it before measuring. |
| A2 second half — **sweep for other difference-shaped gates** | **MISS.** The brief's own highest-value item, and it never occurred to me. |
| A3 — B4's polarity and availability cost | **MISS** (Finding 2 is checklist-sourced). |
| A4 — O7, the empty alias key | **MISS.** |
| A5 — B5 race, B8 nil receiver | **MISS** (Findings 3–5 checklist-sourced). |
| A6 — `hasExternalUnavailableLabel` | **MISS.** |
| A7 — the diff's own security narrative and the r10 seam | **MISS.** |
| A8 — the live-broken commit in history | **MISS.** |

**2 of 9. The brief out-covered my open pass by better than four to one on breadth, and it steered
most of my round.** That is the honest reading and it is the unflattering one.

## §27-3 — (c) The other direction, which the brief did not ask for and which the round turned on

Four substantive items I ultimately filed have **no corresponding brief item at all**: **S8** (the
`CreateTask` free row), **S9** (nothing leaving triage costs `task:claim`), **S10** (the docblock
that condemns and blesses the same consequence seven lines apart — accepted by the EM as r12's first
move, ahead of any price), and the **relocated attack (2)** (`2cbbd92` unconditionally charges the
write arm's invented transitions — R6(ii) from the availability side, and **not counted as a
separate finding**, per review).

> **THE CONTROL RESULT IS TWO-SIDED AND BOTH SIDES SHOULD BE READ TOGETHER: THE BRIEF OUT-COVERED MY
> OPEN PASS ON BREADTH, NINE TO TWO, AND MY OPEN PASS REACHED THE ITEM THAT ENDED THE ROUND, WHICH
> THE BRIEF DOES NOT MENTION. A CHECKLIST IS A BREADTH INSTRUMENT AND AN OPEN PASS IS A DEPTH ONE,
> AND SCORING EITHER ON THE OTHER'S AXIS PRODUCES A NUMBER THAT FLATTERS WHICHEVER YOU WROTE.**

## §27-4 — WHAT THE FRACTION CANNOT SAY, MARKED RATHER THAN ROUNDED

- **A2's second half was never completed**, so its denominator entry is scored as a miss on
  anticipation and remains **undischarged as a deliverable** (§26 does not repair this).
  **Ownership settled at release (EM, 03:44Z): deliverable 4 is owed to r12 with the EM's name on
  it, not mine — it was never funded and I held no token at any point this session.** It is
  therefore **addressed, not merely marked**, per the OP-6 refinement.
- **A7's second half** — why the r10 three-way review missed the seam — needs
  `.design/project-log/label-write-scope-r11.md`, readable, unread, and now out of scope on the
  EM's close instruction.
- Per §1b, this round's `[OPEN]` attributions are **"body-blind, heading-aware"**, not clean. The
  2/9 is therefore an **upper** bound on my open pass and I am not adjusting it downward by
  guesswork.

---

# §28 — FINAL DISPOSITION, ERRATA ABSORBED, AND RESTORE

## §28-1 — CORRECTIONS TO MY OWN FILED MATERIAL, ACCEPTED THIS PHASE

1. **S10's distance is SEVEN lines, not sixteen.** [MEASURED, review, re-confirmed by me against my
   own capture] The condemnation is `passthrough.go:380-384`; the blessing is `:391-394`. Sixteen
   was docblock-start to blessing. **The smaller number is the worse one: sixteen lines is a
   docblock you might lose your place in; seven is one screen, one paragraph break, one sitting.**
   Corrected throughout §26. It is quoted as sixteen in EM Rulings 10 and 11 and should be corrected
   there.
2. **S10's scoping independently confirmed** by review: zero ±lines for either paragraph in
   `6d8f19e..2cbbd92`; both present at base (`:344, :351, :354`); positive control four-and-four.
   **S10 is not scored against this diff, and that refusal now has two witnesses.**
3. **The constraint is filed here as `CON-1`, not `C-1`** — renamed at 03:39Z, **before** the EM's
   rename order arrived at 03:40Z, on review's collision report. Ruling 11 §3 had ratified `C-1`;
   the Ruling 11 errata supersede it and order `CON-1` everywhere. Review's collision report is
   correct and is a real defect in the record: **`C1` is already review's Critical finding.** Two artefacts of opposite force, one hyphen apart, in a document that
   will be read by somebody who was not here. **In a round whose entire subject is two sentences
   seven lines apart saying opposite things, shipping two identifiers one character apart meaning
   opposite things is the same failure at the record layer.** `CON-1 ≡ the EM's former C-1`; the content is unchanged and the
   identifier is the only difference. **Recorded because "complied, no change needed" and "ignored
   the order" produce byte-identical files, and only one of them is true** (review's rule): this
   file contained **one** occurrence of the constraint identifier and it was rewritten.

   **AND THE CHECK IMMEDIATELY FALSIFIED THE SENTENCE I WAS ABOUT TO WRITE.** I was going to record
   that `C-1` now appears here only in this erratum. It does not. **`C-1` is already this report's
   own shorthand for `AUDIT-194-R11-C1`, the sub-task cell derived at §9 and re-derived at §21** —
   seven live occurrences at `:3215, :3338, :3360, :3391, :3421` and in §19's rename note at
   `:2764, :2921`, where I had *deliberately* abbreviated the cell name to `C-1` for readability.
   So the collision is **three-way**, not two-way:

   | token | denotes | owner |
   |---|---|---|
   | `C1` | the round's **Critical finding** | review-194-r11 |
   | `C-1` | the sub-task **cell** `AUDIT-194-R11-C1` | this report, §9 and §21 |
   | `C-1` (as minted in Ruling 11 §3) | the **surviving constraint** | the EM |

   **I introduced the second one myself, in a rename I performed for readability, and then argued
   against a two-way collision without checking my own file for the token I was arguing about.**
   The constraint is `CON-1` here and nowhere else; the cell keeps `C-1` because seven prior
   sections depend on it; and **r12 should retire the bare token entirely.** This paragraph is the
   exact failure the EM named forty seconds before I committed it — *a self-reported count is a
   measurement of a file you have just changed, and it is the only measurement in a report nobody
   else will ever check* — caught only because I ran the grep instead of asserting the result.
4. **My concession over-credited (D)** — corrected in §26-3b, and adopted by the EM as the errata to
   Ruling 9 and as form 15's detection rule: **a concession is a claim about which argument won, and
   a claim about which argument won is measurable. State which attack closed which horn, or you have
   not conceded, you have withdrawn.**
5. **My attack (2) rested on a quantifier error that favoured me** — corrected in §26-2a, relocated
   rather than withdrawn, and the EM's queued measurement re-scoped to `|ref \ got|` accordingly.

## §28-2 — THE ROUND'S DISPOSITION, AS IT AFFECTS THIS REPORT

**Verdict unchanged: REQUEST CHANGES.** Findings as filed in §3, plus S8/S9 (§24) and S10 (§26-7),
all **LIVE, older than this diff, and not scored against `2cbbd92`.** The disposition sentence
travels in its long form and never in its short one:

> **THIS DIFF INTRODUCES NO PRIVILEGE PATH.** *(Not: "no privilege path." That is false.)*

Round-level: **zero remedies adopted; one constraint adopted (CON-1); two root artefacts promoted to
r12's opening scope — S10, and the `store.go:250-251` licence.** Binding for r12: **a pricing fix
lands as two commits, oracle first, the oracle commit demonstrated RED against unfixed production.**
And travelling with every mention of RM-3, verbatim: **the sort without RM-1 is a Critical.**

## §28-3 — RESTORE VERIFICATION, FIVE CHANNELS

Recorded at the close of this session; commands and output in §0b's format.

| Channel | Result |
|---|---|
| `git diff 2cbbd92` | **0 lines** |
| `git status --porcelain --untracked-files=all` | **0 lines** |
| empty-directory sweep | **0** |
| `git worktree list` | **1** (the clone itself; no probe worktrees survive) |
| `git clean -nxd`, compared by **OWNERSHIP not count** | **1 entry, `web/dist/`, pre-existing and not mine** |

**THE PROTOCOL'S OWN DEFECT, MEASURED TWICE ON MYSELF — and recorded here because until now it
existed only in an ephemeral message while the EM was turning it into a mandatory standing clause.
The report is the artefact r12 reads, and I fixed the copy that does not matter first** (review).

- **Instance 1 (03:42Z).** The five-channel check run from the scratchpad cwd reported **12,290
  dirty paths**; from `/workspace`, **0**. Same command, same instant, wrong root.
- **Instance 2 (03:47Z), after I had filed instance 1 and after the EM had adopted it as a rule.**
  A `cd` in a compound command persisted, and the *final* verification ran against the scratchpad
  repo again — returning HEAD `2c339df` and ~240 "would remove" entries, none of them in my clone.
  **I reproduced the failure inside the act of proving I had not failed, twenty minutes after
  naming it and minutes after it became a standing rule.**

> **THE ALARMING NUMBER AND THE CLEAN NUMBER WERE BOTH TRUE OF SOMETHING, AND NEITHER WAS TRUE OF
> THE THING I WAS ASKING ABOUT. FIVE-CHANNEL RESTORE IS ONLY A CONTROL IF THE CHANNELS ARE ROOTED
> WHERE YOU THINK THEY ARE — SO THE RESTORE PROOF STATES ITS ROOT, OR IT PROVES NOTHING.**

**And instance 2 is the more useful of the two, because it falsifies the sufficiency of the rule I
wrote.** Stating the root did not prevent recurrence in the author who wrote the clause; the root
was *reported* correctly each time and *established* incorrectly, because a `cd` from an earlier
command survived into a later one. **A rule that asks you to state a value cannot catch a value you
believe. The mechanical form is the one that works: `git -C <root>` and absolute paths, never `cd`
plus a bare `git`** — which is how the table above was finally measured. This is the round's
headline mechanism (*a true statement about a narrow thing, restated about a wider one, with no
re-measurement at the boundary*) committed by the leg that filed it, twice, on the instrument every
leg uses to prove it left no trace.

## §28-4 — WHAT "MARK THE TASK COMPLETE" RESOLVES TO IN THIS CLONE

The brief's closing instruction is to write the report and **then mark the task complete.**
[MEASURED, this clone, read-only] **There is no farmtable task record here to close:**
`/workspace/.farmtable` does not exist, there is no `ft` binary on `PATH`, `FARMTABLE_DB_PATH` is
unset, and there is no embedded DB. Consistent with never having been issued a token. Test reported
the same absence in its own clone independently, which makes it **environmental rather than
leg-specific** — two clones, same result.

**So the completion mark resolves to an agent status signal and nothing else, and I am recording
that instead of letting "marked complete" stand for a board operation that did not occur.** Review's
rule applies to a task board exactly as well as to a report: **"complied, no changes needed" and
"ignored the order" produce byte-identical outcomes, and only one of them is true.**

**Released explicitly by the EM at 03:44Z: "mark the task complete with the report PARTIAL."** The
hold is discharged by instruction, not by discharge of the deliverables. **Deliverable 4 was
reassigned to the EM in the same message** — unfunded, never token-backed, and the brief's own
highest-value item. Deliverable 6's second half needs the unread project log and stays owed to r12.

**The completion mark asserts exactly this and nothing more: the report file is written at the
required absolute path and the EM has released the hold. It does not assert that all nine
deliverables are discharged. Two are not, and both now have named owners.**

**Action actually taken, in the past tense, because "what the mark resolves to" is not a record of
having sent one:** `sciontool status task_completed` was signalled at 03:45Z. **No farmtable task
record was closed, because none exists in this clone.**

**And this section was audited against itself before being left alone.** Prompted by review's and
test's corrections, I grepped this report for board-operation language rather than assuming the
symmetry — *assuming the symmetry is the same error one level up.* **Four hits, all inside §28-4,
whose subject is precisely that no record exists.** The nearest match to test's line 4335 is the
release quotation above: **true as written, and it licenses the same false inference in isolation**
— it is disambiguated here only by the two paragraphs bracketing it, which is a weaker guarantee
than it looks, because **a grep hit arrives without its neighbours.** The repair is the past-tense
sentence above rather than a rewording of the quotation, since the defect was an **absent record of
the action**, not a false one.

> **A TRUE SENTENCE THAT LICENSES A FALSE INFERENCE IS THE SAME ARTEFACT AS A FALSE ONE ONCE THE
> AUTHOR IS GONE, AND EVERY READER OF THAT LINE WILL BE SOMEBODY WHO WAS NOT HERE** (test).
> Recorded explicitly because **"complied, no change needed" and "never checked" produce
> byte-identical files** (review).

**And the mechanism review named after four instances of its own is the one finding of the night
that all four of us committed, including me, at least four times:** *a true statement about a narrow
thing, restated about a wider one, with no re-measurement at the boundary.* My instances: the S8
derivation, the "eight authorization sites" that were three, the vocabulary-bounded control licensing
a region-bounded negative, and the restore proof rooted in the wrong directory. **If r12 takes one
methodological result from these three reports, it should be that one and not any finding.**

> **PROBE CELLS LEFT DIRTY: 0.** No commits, no pushes, no production edits, no build, no test run,
> no token taken or requested since the hold.


---

# §29 — CLOSING STATE

**Verdict: REQUEST CHANGES on `6d8f19e..2cbbd92`. Report PARTIAL, closed by explicit release.**

| Item | State |
|---|---|
| Findings | 1 HIGH (§3 Finding 1), 2 LOW, 2 INFO — plus **S8, S9, S10**, all **LIVE, older than the diff, none scored against `2cbbd92`** |
| Disposition sentence | **"THIS DIFF INTRODUCES NO PRIVILEGE PATH."** Long form only; the short form is false and must never travel |
| Round-level | **Zero remedies adopted. One constraint adopted (CON-1). Two root artefacts promoted to r12: S10, and the `store.go:250-251` licence.** |
| Binding on r12 | A pricing fix lands as **two commits, oracle first, the oracle commit demonstrated RED against unfixed production** (test's F27). **The sort without RM-1 is a Critical** — travels with every mention of RM-3. **S10 before any price.** |
| Owed, with named owners | Deliverable 4 (A2 sweep) → **EM**. Deliverable 6 second half (project log) → r12. The unprovisioned-population size → **EM**. `|ref \ got|` cardinality → **EM**, token-gated. |
| Execution | **Nothing compiled and nothing ran, at any point, in the entire session. No token was issued, taken, or requested after the hold.** |
| Restore (root stated: `/workspace`, HEAD `2cbbd92`) | `git diff` 0 · porcelain `-uall` 0 · empty-dir sweep 0 · `git worktree list` 1 · `git clean -nxd` 1 entry (`web/dist/`), **pre-existing, compared by OWNERSHIP not count** |
| **Probe cells left dirty** | **ZERO** |

**The round's record, and it is review's sentence rather than mine:** *three reviewers proposed
three prices for a write that cannot be observed, argued for an hour, and the thing that ended it
was already written in the function's own docblock, seven lines above the sentence that contradicts
it.*
