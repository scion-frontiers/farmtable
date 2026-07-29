# RULE-ARMING AUDIT — `_STANDING-RULES-2026-07-29.md`

**Leg:** audit-rule-arming. **Read-only. No code tree. No build token requested. No commits. No push.**
**Object audited:** `/scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md`,
1751 lines, read in full in three passes (1–597, 598–1176, 1177–1752). **No SHA available — this file is
not in a git tree.** Per OP-6 that is a weakness in my own citation: my line numbers are pointers into
mutable state (§10.17) and are keyed to the file as read at **2026-07-29 ~06:45Z**. If the EM appended
while I read, my count is short and I cannot detect it.

**Scored under the 06:52Z addition** (executable trigger vs prose trigger, never summed). Rules scored
before it arrived were **rescored**, not annotated; the pre-addition scoring is preserved in §2.3 with
the reason it was wrong. **The 07:00Z armed rule on exit-status observation is answered in §5.0, where I
disclose one exposure of exactly its shape in this report's central claim.**

---

## 1. UNITISATION CRITERION — STATED BEFORE THE COUNT SO IT CAN BE DISAGREED WITH

**One rule = one distinct normative proposition, addressed to an identifiable actor, that a piece of
conduct could violate.**

Consequences of that choice, each of which moves the number:

- **Headings are not the unit.** The file has **140 headings** (77 `##`, 55 `###`, 8 `#`). Some headings
  carry no obligation at all (§8.6, §5.3, the beads narrative, Appendix 9.4-A). Some carry five (§7.0).
  Heading-count and rule-count are different censuses of different sets — §10.5, and the reason I state
  the unit before the number.
- **The finding is separated from the mandate.** Most sections are built as *incident → mechanism →
  MANDATE*. Only the mandate is a rule. "A count can be right for a reason it never measured" is a
  finding; "a census of guards present may not be reported as a census of paths covered" is the rule.
- **Compound mandates are split** where the halves are independently violable and independently
  checkable. §10.25's four plant conditions are one rule (one guard proof either has hostile context or
  does not); OP-5's six shell facts are five rules (each is a separate grep).
- **Excluded from N:** pure findings, taxonomy, definitions, incident narrative, retracted text
  (Appendix 9.4-A, the OP-3 flake figure), and preserved-superseded text.
- **Duplicates counted once.** "Every `file:line` carries its SHA" appears verbatim at §3.6 and again at
  OP-6; counted once.

**Granularity sensitivity, stated because it is the honest thing to state:** a reasonable person
splitting compound mandates more aggressively lands near 180; one merging by heading lands near 96. My
number is **±20%** on unitisation alone. **The ratio below is not sensitive to this at any plausible
granularity**, and that is the only reason the number is worth reporting.

---

## 2. THE COUNTS

**Rescored under the 06:52Z addition, which splits the trigger column into (a) executable and (b) prose.
The original wording is superseded, not deleted (§3.5); the pre-addition scoring is preserved in §2.3.**

### 2.1 COLUMN (a) — EXECUTABLE CHECK. THE ONLY COLUMN THAT IS NOT A FLOOR ON DISCLOSURE.

> ## **(a) = 0. Denominator = 153.**

**Command:**

```
grep -o -E '[a-zA-Z0-9_-]+\.(sh|py)' em-tooling/_STANDING-RULES-2026-07-29.md | sort -u
```

**Output: empty. Zero executable artefacts are named anywhere in 1751 lines.** No rule in the file names
a script, hook, lint rule, CI step or make target that runs and can go red. There is nothing to bind a
rule to.

*(The file is capable of naming artefacts — it cites `.go` paths freely, e.g. `passthrough_url_test.go:218`,
`graph_routing.go:72`. It names zero executable checks.)*

### 2.2 THE FOUR COUNTS, TWO COLUMNS, NEVER SUMMED

| column | count | denominator | is it a floor on disclosure? |
|---|---|---|---|
| **(a) executable check, named with a path, runs, can go red** | **0** | 153 | **NO — measured against the filesystem** |
| **(b) prose applicability clause** | **147** | 153 | **YES — this is the document describing itself** |
| **(a) and (b) both** | **0** | 153 | — |
| **neither (a) nor (b)** | **6** | 153 | YES |

Cross-foots: (b)-only 147 + (a)-only 0 + both 0 + neither 6 = 153.

### 2.3 THE SUPERSEDED COLUMN, PRESERVED — AND WHY IT WAS THE WRONG MEASUREMENT

Before the addition I scored a CHECK column and returned **6**. **Those 6 were never executable checks.**
They were human-run observations, and **5 of the 6 I scored from the file's own narrative that its own
instruments had run** — which is candour, not arming. The addition is right and it caught a real defect
in my scoring. The six, retained as a third category so the correction is visible:

| § | what it actually is |
|---|---|
| §7.10, §10.13 | a human reads `reports/_run-queue-log.md`. A log is not a check: it does not run and cannot go red |
| OP-3b | an ad-hoc grep, run once |
| OP-8, OP-8b | ad-hoc ref and credential sweeps, run once |
| §10.20 | a guard built and run once, by its author |

**None is wired to an occasion. None runs again unless a person decides to run it.** Under (a) they are
all **0**.

### 2.4 THE MEASUREMENT THAT MAKES THIS WORSE THAN A BARE ZERO

**Two purpose-built rule-enforcement instruments exist in this project. Neither is named in the rules
file.** This is not a capability gap.

| artefact | binds to | can it go red? | controls | execution evidence |
|---|---|---|---|---|
| `em-tooling/scope-check.py` (11985 b, **built 05:48Z today**) | §7.0, *"a true statement about a narrow thing, restated about a wider one"* — its docstring calls itself **"CONVERSION OF A JUDGMENT RULE INTO A PROCEDURE"** | **yes**, `exit 2` on scope words found | `--self-test`, `exit 3` if the instrument is broken | **ZERO.** `grep -rn 'scope-check\.py'` over all `*.md`/`*.txt` in the project → **0 hits.** Positive control: the same query shape finds 68 `.py` filenames in `*.md`. The zero is about the world |
| `em-tooling/orphan-scan.sh` (4626 b) | orphaned review records — the §10.1 never-push blind spot | **yes** | **an injected-fault positive control**, and the author wrote *"Found 89306d0 by chance tonight. Chance is not a control. This is the control."* | **it ran once**, 2026-07-28 05:29, and found a real defect: *"entire #191 r2 review record was orphaned"* |

`scope-check.py` is the single best-designed instrument I found: it names the judgment rule it replaces,
states plainly that it cannot do the naming half, and self-tests. **It has never been referenced by
anything.** It was written an hour before this audit.

`orphan-scan.sh` carries a binding occasion — *"New standing rule: `orphan-scan.sh` runs before any agent
GC, every round."* **That rule is not in `_STANDING-RULES-2026-07-29.md`.** It exists in the EM state
file and in 44 backup snapshots of it. The 359 raw hits for its filename resolve to **46 files, 44 of
them backups of one document** — §10.8's corpus vote, one document counted forty-four times.

**And its documented path is wrong in the way that does not announce itself.** The rule cites
`/workspace/orphan-scan.sh`. That path **resolves** — to a 3180-byte copy dated Jul 28 05:27. The
maintained copy is `em-tooling/orphan-scan.sh`, 4626 bytes, Jul 28 23:12. **A leg following the
documented path runs an older, smaller script and gets a clean-looking result from the wrong
instrument.** §8.4, except the failure does not even exit non-zero.

**So the axis is not uncovered for want of capability. It is uncovered with two working instruments
sitting beside it, one unwired and one pointed at a stale copy of itself.**

**The six with a check**, named so the claim is falsifiable:

| § | rule | why it counts |
|---|---|---|
| §7.10 | inline-fence exit trigger, counted in `_run-queue-log.md` | log exists (1611 lines, mtime 06:38Z); EM is the recipient of the question, so absence is observable to a non-author |
| §10.13 | diligence counter counts unprompted checks | same instrument, same owner |
| OP-3b | no leg may cite 4.5% / 2.39 / 8.33 / "five" | a retraction sweep was actually run (§10.20) and adjudicated its own false positive |
| OP-8 | no agent pushes | refs are observable and attributable to a non-author; ref sweeps were run (§10.1) |
| OP-8b | redact the PAT from every command echo | the 04:47Z credential sweep, with a validated instrument |
| §10.20 | token guard flattens first, carries four controls | the four controls were built and their outputs printed |

**Two adjacent rules I refused to count as armed, and why**, because these are the judgements most likely
to be wrong:

- **§1.1 (exit-code controls)** — the file's own best remedy, "multiple demonstrated in-flight catches."
  But that is the *mechanism* working. Nothing observes whether a leg **wrote** the guard clause. A leg
  that omits it is invisible. **The best-performing rule in the file is unchecked.**
- **§10.9 (ask a leg for provenance before crediting it)** — "VERIFIED THIS ROUND" is real, but the grep
  was run by the rule's author on the author's own file. That is trap 2 exactly. **NO.**

---

## 3. PER-RULE TABLE

**COLUMN (a) IS NOT PRINTED, BECAUSE IT IS `0` ON EVERY ROW WITHOUT EXCEPTION.** Printing 153 zeros
would make the reader hunt for the one that is not. There is not one. No rule below names an artefact,
so no row can carry an artefact and a path.

`(b)` = prose applicability clause — **per the discriminator this is not arming**, and it is printed only
so the 147 can be located and struck or armed.
`hum` = the superseded human-observer column (§2.3), retained so the correction is auditable.
Final column: **the cheapest thing that could observe a violation, or STRIKE.**

### PART 0 — THE FRAME

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 0.1a | record each failure as an (instrument, investigator) pair, two owners | Y | N | two mandatory columns in the incident log; EM refuses a one-cell record |
| 0.1b | never sum the refusal and unread-diagnostic columns | Y | N | forbid a TOTAL row in the tally schema; grep tallies for one |
| 0.2 | test every proposed remedy against the crossing criterion before building | Y | N | remedy proposals carry a "which axis does this cross?" line; adjudicator rejects if blank |
| 0.3 | nothing in the write-up may be phrased as a fraction | Y | N | grep write-ups for `\d+\s*/\s*\d+`; **exclude the ban's own sentence by line range, not by shape** (§4.2 will otherwise make every compliant report the only hit) |

### PART 1 — CONTROLS AND DETECTORS

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 1.1 | controls fail the command, never decorate it | Y | N | require every reported control to print its own rc beside its result; a control with no rc is not reported as a control |
| 1.1am | a control shares the invocation shape of what it controls | Y | N | report prints control command and controlled command adjacently; reviewer diffs the flags |
| 1.2 | adjudicate every detector hit by hand before any repair | Y | N | any change citing a detector attaches a per-hit adjudication table; no table, no merge |
| 1.3 | exclude by source, never by shape | Y | N | merge question "whose output is this line?" — weak alone, since its own author failed it (§6.3); arm via 1.3b |
| 1.3b | code-span exclusion only; never bold/italic | Y | N | grep sweep scripts for `\*[^*]+\*`. **One command. Highest yield-per-character in the file** |
| 1.4 | search only paths you affirmatively list | Y | N | grep logged commands for `--exclude`/`--exclude-dir`; any hit is a finding |
| 1.5 | `git clean -nxd` in every restore proof | Y | N | required section in the restore-proof template; absent = proof rejected |
| 1.5am | compare the ninth channel by ownership with a stated cut-off, not by count | Y | N | proof must print the cut-off timestamp and one mtime per entry; a bare count is rejected |
| 1.6 | session-unique unguessable sentinels | Y | N | grep transcripts for sentinels not matching `SENT-[0-9]{4,}-` |

### PART 2 — ASSERTIONS AND GUARDS

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 2.1 | anchor RHS; do not enumerate LHS shapes | Y | N | **STRIKE as a separate rule.** §6.7 states it supersedes §2.1 — but §2.1 is **unmarked at its own point of use**, which is a live §3.5 violation. Mark it superseded; enforce §6.7 alone |
| 2.2a | say membership, never exact or floor | Y | N | grep guard files for `at least` / count-pin idioms; each hit needs a membership set or a written waiver |
| 2.2b | layer membership AND the `sanitized == sites` equality | Y | N | the guard file must contain both assertions; binary check on one file |
| 2.3 | prefer a guard whose staleness fails closed | Y | N | every new guard states which direction it goes stale in; "silently, exonerating" is rejected |
| 2.4a | a deferral ships a test that goes RED when the accident is removed | Y | N | the deferral record names the alarm's `file:line`; no name, no deferral |
| 2.4b | key the alarm to the outcome, not the mechanism | Y | N | reviewer asks what the alarm asserts on; a library symbol fails |
| 2.5a | enumerate indirect-dispatch mechanisms and check each by name | Y | N | required enumeration section in any negative-reachability report |
| 2.5b | ask the capability question in domain vocabulary, not the import graph | Y | N | required second section naming the capability |
| 2.5c | a negative reachability claim is closed only by a bounded-search-space argument | Y | N | adjudicator refuses any negative claim whose closure is a count of clean searches. **Arm this one and 2.5a/2.5b become its inputs rather than three separate obligations** |

### PART 3 — THE RECORD

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 3.1 | a broadcast may not contain a remedy, only a pointer | Y | N | one author (EM); a second party greps each broadcast for imperatives not followed by a § pointer |
| 3.2 | on a third revision, re-specify from scratch | Y | N | count `AMENDED`/`v3` markers per artefact; three triggers a rewrite obligation |
| 3.3 | no instruction is final until the developer requests the token | N | N | **STRIKE.** A description of when rework starts, not conduct anyone can violate. Move it into OP-2's preamble |
| 3.4 | no mechanical rewrite of self-quotation; audit self-quotes first | Y | N | **free once §5.1 is armed** — make the inverse-and-diff a required attachment and 3.4 is checked as a side effect |
| 3.5 | mark superseded at point of use; never replace | Y | N | grep the file for sections named as superseded elsewhere but unmarked at their own heading. **Currently fails on §2.1 and §6.4** |
| 3.6a | qualify both namespaces in identifiers | Y | N | grep reports for `\bC-?\d\b` with no round/leg prefix |
| 3.6b | quoted spans excluded from every sweep | Y | N | sweeps declare their masking — but see §6.3, the mask must be re-justified per question; arm jointly or it arms the wrong thing |
| 3.6c | every `file:line` carries its SHA, and its path is a claim | Y | N | grep reports for `[a-z_]+\.go:\d+` with no 7-hex nearby. **One command, very high yield** |
| 3.7 | report incidents, not class totals | Y | N | tally schema forbids a class-total column; incident IDs required |
| 3.8 | remedy-induced incidents must be counted | Y | N | **self-declared OPEN, NOT YET INSTRUMENTED.** One column in the incident log — "caused by compliance work Y/N" — **filled by the EM, not by the leg**, or it is self-disclosure |
| 3.9 | check whether the first arrival was ever acted on before crediting convergence | Y | N | any "independently arrived" credit cites the first arrival's message ID and its disposition |
| 3.10 | legs sealed while finding; channel opens once all have filed | Y | N | **the orchestration message log already records sender, recipient and time.** Reconcile against filing times. Cheap, existing data, nobody looks |

### PART 4 — THE GRADE

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 4.1 | ask "can my severity grade fail for the reason it claims?" of every non-blocking grade | Y | N | **one required line under every non-blocking grade; a grade with a blank line is not a grade.** The file's own highest-value unarmed rule — it says grading is the only unreviewed artefact and then does not review it |
| 4.2 | a metric that rises with compliance is as broken as one that falls with care | N | N | **STRIKE as a rule.** True finding about metric design, no conduct to violate. Keep as a design note under §3.7 |
| 4.3 | declaration plus an enumeration of every scheme present | Y | N | any completeness declaration must carry its enumeration; declaration alone rejected on sight |

### PART 5 — ADDENDA

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 5.1 | invert and diff against the pre-image; never verify a rewrite by reading it back | Y | N | **require the diff output attached.** Best cost/benefit in the file: costs one `cp`, arms 3.4 for free, and the evidence is a byte count anyone can re-derive |
| 5.2 | a read refusal is not an incident | Y | N | tally schema puts refusals in a separate non-counting column |

### §6.1–§6.13 — THE beads HARVEST

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 6.1 | do not answer a dependency question with a mention search; enumerate the populations your findings generalise over | Y | N | required "populations this finding quantifies over" field in every report |
| 6.2 | require re-derivation for relays that shrink scope | Y | N | any downgrade cites its own re-derivation command; an unaccompanied downgrade is refused |
| 6.3 | a mask validated for one question must be re-justified for another | Y | N | the sweep states which question its mask was validated against |
| 6.4 | read the exit code | Y | N | **STRIKE as a separate rule.** Subsumed by §1.1 and OP-5's polarity clause, and §6.7 already claims to supersede it — **also unmarked at its point of use, §3.5 violation number two** |
| 6.5 | a file-scoped negative is not a path-scoped negative | Y | N | reachability claims state hops traversed, not files grepped; fold into §10.12-b's search-space field |
| 6.6 | a census of guards present is not a census of paths covered | Y | N | ban the word "coverage" adjacent to a count with no named join point |
| 6.7 | anchor on an invariant and argue the population bounded; never enumerate admissible forms | Y | N | every guard fix states its invariant; "I added the missing case" is refused. **The most-cited rule in the file and it has no observer** |
| 6.8 | assign a negative-result measurement to the party whose finding it would kill | Y | N | EM-side, one line per dispatch: name whose finding dies if the result comes back negative |
| 6.8a | a refused upgrade is stronger evidence than any self-produced measurement | N | N | **STRIKE.** Evidential weighting, no occasion, nothing to violate. Keep as a note under 6.8 |
| 6.9 | membership per direction: two fail-closed sets, inbound and outbound | Y | N | concrete and buildable — the guard file must contain two named sets. Binary check on one file |
| 6.10 | do not label an exact count "floor" | Y | N | grep guard failure strings for "at least"; compare the number to the measured population |
| 6.11 | pre-register the decision rule, never the search space | Y | N | apply the rule's own stated test to each pre-registration block; reviewer signs it |
| 6.12 | score the demand, not the forecast | N | N | **STRIKE.** A credit-assignment norm with no artefact and no observer. It is wise, it is unenforceable, and **it will be cited as covering the grading axis that §4.1 actually owns** |
| 6.13 | broadcasts carry sequence numbers; closed only when every running leg acks; an unacked running leg is an incident | Y | N | roster diff: running legs from `scion list` vs the ack list per sequence number |
| 6.13a | never resolve an unconfirmed non-idempotent side effect by re-running it | Y | N | verify at the receiver and quote the receiver-side confirmation |

### PART 6 — OPERATIONAL

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| OP-0 | ask "is OP-1 current?" before your first build | Y | N | **MEASURED: `_run-queue-log.md` contains the string "OP-1 current" ZERO times across 1611 lines.** The instrument exists and the rule is not firing. Arm: EM refuses the first token request from any leg that has not asked |
| OP-1a | token required for whole-module / whole-suite commands | Y | N | nothing reconciles executed commands against grants; require command text + rc in the log, EM-side diffed against the grant |
| OP-1c | log a selective run BEFORE running it | Y | N | **self-disclosure — the log cannot see an unlogged run. As written this is a form check.** Arm at the receiver: sample transcripts against the log |
| OP-1d | if you cannot tell whether it is (a) or (b), it is (a) | Y | N | **STRIKE.** Keys entirely on the subject's internal uncertainty — unobservable by construction. The fence's real safety is OP-1a + OP-2 |
| OP-1e | the fence binds every role, not just developers | Y | N | not separately checkable; it is a scope clause. **Fold into OP-1a** |
| OP-1f | if your brief is silent on (a)/(b), say so in your first message and do not build | Y | N | first messages are logged — grep them. One command, and it measures the exact population §7.10 cares about |
| OP-2a | request the token; do not assume it | Y | N | the grant record checks only legs that ask; same blind spot as OP-1a |
| OP-2b | return the token the moment your commands exit | Y | N | EM timestamps grant and return; a hold longer than the logged run is a finding |
| OP-2c | the grant names commands and the count is part of the grant | Y | N | diff executed commands against the grant; needs OP-1a armed first |
| OP-2d | run the pre-registered command even if uninformative; one reachable arm is not a pre-registration | Y | N | compare the pre-registration block against the run log |
| OP-3a | a lone `TestWatchTasks_*` failure is not a finding; re-run alone and say you did | Y | N | report must contain the isolated re-run command and its rc |
| OP-3b | no leg may cite 4.5% / 2.39 / 8.33 / "five" from this file | Y | **Y** | **ARMED** — a retraction sweep ran and adjudicated its own `D4.5` false positive. Harden with a standing false-positive discipline |
| OP-3c | check the first CI run for which suites executed, not for the exit code | Y | N | report must name the suites that ran; a bare exit code is rejected |
| OP-4 | read the error text, name the failing symbol; never report an exit code alone | Y | N | grep reports for a bare `exit 1` / `rc=1` with no adjacent symbol name |
| OP-5a | quote every pathspec and glob | Y | N | grep transcripts for unquoted globs in `git grep`/`--include` |
| OP-5b | use `${pipestatus[1]}`, never `${PIPESTATUS[0]}` | Y | N | grep for `PIPESTATUS`. Trivial, total |
| OP-5c | brace variables: `git show "${VAR}:path"` | Y | N | grep for `git show "$[A-Z]` without a brace |
| OP-5d | use `printf '%s\n'`, never `print` | Y | N | grep for `^\s*print ` |
| OP-5e | state polarity on the same line; never `\|\| true` on a no-match check | Y | N | grep for `\|\| true`. **Any hit is a finding, no adjudication needed** |
| OP-6a | cite `git show <SHA>:<path>`, not the working tree | Y | N | grep reports for `/workspace/` paths in citation position |
| OP-6b | mark every line `[MEASURED]` / `[DERIVED]` / `[UNCHECKED]` | Y | N | grep for claim lines lacking a marker; noisy but mechanical |
| OP-6c | state the command and the observed value, never the verdict | Y | N | reviewer question; semi-mechanical — a "verdict word" list is grep-able |
| OP-7 | quoted heredoc, Python backtick strip, print residual count, verify zero before sending | Y | N | **arm at the receiver:** EM greps inbound messages for backticks. Sender-side count is self-disclosure |
| OP-8 | no agent pushes, ever; only the EM | Y | **Y** | **ARMED** — refs are observable and attributable by a non-author. **But §9.8 records that a brief already granted an exception, which is the documented hole in this one** |
| OP-8b | redact the PAT from every command echo | Y | **Y** | **ARMED** — the 04:47Z sweep with a validated instrument |
| OP-9a | no two legs may ever share a scratch path | Y | N | EM compares allocated paths across legs at dispatch; one line |
| OP-9b | dedicated worktree per workstream; never a direct checkout in shared `/workspace/farmtable` | Y | N | `git worktree list` + branch state |
| OP-9c | nothing in `/workspace/farmtable-em-verify195` is to be touched | Y | N | mtime sweep on that one directory against a fixed cut-off. **Cheapest arm in Part 6** |
| OP-9d | report restore state as measured values | Y | N | required fields in the end-of-leg template |
| OP-end | Part 6 is not in force until a non-author confirms the fence text and reads it back | Y | N | **the confirmation is itself the artefact.** See §5 — I partially discharge this below, and by the clause's own terms **Parts OP-1..OP-9 have not been in force** |

### PART 7 — THE r11 HARVEST

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 7.0-1 | every reported search result carries its bound: SHA, path filter, root | Y | N | required field; reject the result, not just the report |
| 7.0-2 | a restore proof states its root | Y | N | required field |
| 7.0-3 | before filing a count discrepancy, re-run the other person's query | Y | N | the discrepancy filing must contain their command and your output of it |
| 7.0-4 | a confirming instance must name which clause it exercised | Y | N | reject any confirmation with no clause named. **Cheap, and it arms §9.6 for free** |
| 7.0-5 | a true sentence that licenses a false inference is the same artefact as a false one | N | N | **STRIKE.** It sits in a list headed "RULES, ALL MANDATORY" and contains no obligation. **A non-obligation inside a mandatory list is the receipt shape in miniature** |
| 7.1 | if a remedy cannot be handed over as a diff site and a change, label it a CONSTRAINT before comparing it with any remedy | Y | N | one required label on every proposal; the test is already written and applicable by a reviewer |
| 7.2 | state which attack closed which horn, or you have withdrawn, not conceded | Y | N | read the concession for a named attack; reject if absent |
| 7.3 | a "different species" exemption does not answer a rule written as a consequence | Y | N | reviewer checks whether the rule quantifies over mechanisms; mechanical enough |
| 7.4 | "the sort without RM-1 is a Critical" travels in the same sentence as the proposal | Y | N | **STRIKE — or archive.** Scoped to one unadopted proposal with five unmet preconditions. It is dead weight that will be cited as coverage of joint-remedy risk |
| 7.5 | oracle-first commit order; the oracle commit demonstrated RED before the behaviour commit exists | Y | N | git history + CI record. **Fully mechanical, genuinely strong, entirely unarmed** |
| 7.6a-1 | enumerate at the chokepoint, not at the source | Y | N | every enumeration guard names its door; "I enumerated the producers I found" is refused |
| 7.6a-2 | three-for-three new members per attempt means stop enumerating | Y | N | count patches per guard; the third triggers an obligation to find the door |
| 7.6b | a declined measurement is handed to a NAMED OWNER, not merely marked | Y | N | **grep reports for `[UNCHECKED]` with no owner within N characters.** Cheap, mechanical, and the file measured that this is exactly where things rot |
| 7.6c | a self-reported count of a file you just changed is not a measurement | Y | N | someone else re-runs it; requires an assignment, not a script |
| 7.7 | an attribution carries its measurement before it is relayed | Y | N | grep relays for attribution language with no adjacent command |
| 7.9 | an adjudicator may not route remedy selection into the review legs | Y | N | observable in the round record by an outside party: did reviewers author remedies? |
| 7.10 | inline-fence exit trigger, counted one line per leg | Y | **Y** | **ARMED** — and **measured firing at zero: the log has 1611 lines and 0 occurrences of the staleness question.** The instrument works; the behaviour it counts is not happening |
| 7.8a | an order requiring no change is discharged by reporting the check and its scope, not by silence | Y | N | EM tracks open orders; a closed order with no report is a finding |
| 7.11 | after a vacuity repair, measure population coverage, not row correctness | Y | N | the commit states the coverage number before and after |
| 7.12 | a behaviour change sweeps the justification sites citing the old behaviour, in the same commit | Y | N | grep the identifier across the tree, compare against the diff. **The rule itself says it is invisible to every gate — so it is exactly the one to arm** |
| 7.13 | a correction goes into the artefact at the line that is wrong | Y | N | diff placement check: does the change land at the defective line or at the end? |
| 7.14 | a leg reports *that it checked*, not only what it found | Y | N | required section; and it is the only propagation mechanism in the file that runs in the right direction |
| 7.15 | a continuation after a close order is justified only by a named line in a named file | Y | N | read the message for a `file:line`. **One of the cheapest checks available** |

### PART 8

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 8.1 | a hedge carries a measurement or a falsifier, the same as a claim | Y | N | grep for hedge phrases — "may not be", "plausibly", "possibly" — and require an adjacent measurement |
| 8.2 | before crediting a corroboration, ask whether the second leg would have got there without the first's artefact | Y | N | require the test's answer written next to every credited corroboration |
| 8.3 | every dispatch sends the brief path in the first message; every brief's §0 carries the stop-clause | Y | N | **one grep over `briefs/`. MEASURED BELOW AT 0 OF 10 POST-ADOPTION BRIEFS, INCLUDING THIS ONE** |
| 8.4 | any absence-check pairs with a positive control; read the exit code; never `\|\| true` | Y | N | the control's output must be in the report. **Strong, mechanical, unarmed** |
| 8.5 | an exit code that agrees with your hypothesis is the one you are least entitled to accept | Y | N | **STRIKE as stated** — it keys on the author's internal hypothesis. Salvageable as: *a confirming result carries one extra verification, reported*. Arm that, not this |

### PART 9

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 9.1 | on adoption, name the LARGEST object the rule applies to and check that one first | Y | N | **one required line per filed rule. Current compliance in this file: 0 of 153.** Cheap, and it is the rule that would have caught the two zeros in §4 below |
| 9.3 | a restore proof asserts file CONTENT at an expected value | Y | N | required field; an exit code or a directory listing is rejected |
| 9.4-1 | a debt is recorded as `file:line` plus a verbatim snippet in the source's own numbering | Y | N | inspect state-file entries for relay shorthand with no source pointer |
| 9.4-2 | a global zero means the token is wrong before it means the content is absent | Y | N | require the alternate-token attempt logged beside the zero |
| 9.4-3 | ask the counterparty before concluding loss | Y | N | message log; one round trip |
| 9.4b | a rule derived from an incident names the measurement, or is filed `[MECHANISM UNCONFIRMED]` | Y | N | **grep this file for rules carrying neither. The retroactive sweep of Parts 8 and 9 is recorded as owed and is still outstanding.** Highest-leverage single check available, because its object is this file |
| 9.5 | sweep for context percentage, not just phase; release a leg when its deliverable answers for it | Y | N | context % is not in `scion list`; requires asking each leg. Semi-armable, EM-owned |
| 9.6 | read clean self-audits as "aimed at the wrong clause" before "sound" | Y | N | **free once 7.0-4 is armed** — a self-audit that names no clause is rejected |
| 9.7 | check that a justification defends the line the finding names | Y | N | compare the two line numbers. Trivial, mechanical, and it caught a real one |
| 9.8 | a rule a brief can except is not a rule; resolution belongs in CLAUDE.md | Y | N | **binary: does CLAUDE.md contain it?** Marked OPEN and assigned; still open. One command |

### PART 10 — THE BACKLOG

| § | rule | (b) | hum | cheapest arming, or STRIKE |
|---|---|---|---|---|
| 10.1 | any refs sweep states whether it covered unpublished work; default NO; population in the same sentence as the result | Y | N | read the sentence; reject a result whose population is a paragraph away |
| 10.2a | a retraction lands in the artefact at the point of use, as a BLOCK not a DELETE | Y | N | grep for the retracted token; confirm every hit is inside a retraction block |
| 10.2b | name the forbidden tokens explicitly so a grep lands on the retraction | Y | N | same sweep; OP-3b is its one working instance |
| 10.3 | ask an interested party where the standard lives, never what it says | Y | N | message log: reject quotations sourced from the party being judged |
| 10.4 | an enumeration states WHERE IT STOPPED LOOKING | Y | N | required field. **Cheap and very high yield — trailing omissions are the class nothing else catches** |
| 10.5 | a brief states its unit; the deliverable restates the set in the same unit; exempt members carried and marked | Y | N | compare the two. **This brief complied; that is 1 of 3 brief-scoped rules, see §4** |
| 10.6a | two legs citing different lines for one defect means two ends before it means a mis-citation | Y | N | **STRIKE as a rule** — a hypothesis-ordering heuristic, no conduct to violate. Keep as a note |
| 10.6b | when a justification fails, check for a second support before withdrawing the conclusion | Y | N | any withdrawal states which supports were checked |
| 10.7 | prefer the instruction that is safe without the measurement | Y | N | reviewer question on every dispatched instruction; soft but real |
| 10.8 | a number that round-trips through a directive is re-read from the file before restatement | Y | N | require the re-read command beside any number sent down-channel as a constraint |
| 10.9 | ask a leg for its provenance before filing a rule credited to it | Y | N | **counted NO deliberately** — the verification was run by the author on the author's own file, which is trap 2. Arm by making provenance a required field on a filing, checked by the recipient |
| 10.10a | a guard must be tested against input it did not generate | Y | N | the control set must contain a hand-written arm; state which arm it is |
| 10.10b | a single measurement of a log has no error term | N | N | **STRIKE as a rule; PROMOTE as a finding.** It is one of the two sentences in this file that directly governs the question the EM is about to ask, and burying it in a rule list is why it did not fire tonight |
| 10.11 | a pin must cover every carrier of the property it certifies | Y | N | the pin names its carriers and states where the carrier enumeration stopped (§10.4) |
| 10.12 | a bound is a type- or ownership-level impossibility; two clean searches are not a bound | Y | N | **STRIKE as a duplicate** — this is §2.5c, and the file says so itself at 10.12's own attribution correction. Keep one |
| 10.12b | a reachability sweep states its SEARCH SPACE as well as its predicate; control = a known second entry point withheld from the inputs | Y | N | required field plus the withheld control. **Strong, and it subsumes 6.5** |
| 10.13 | count whether legs check, not whom they check with; count only unprompted checks | Y | **Y** | **ARMED** — same instrument as §7.10, same owner |
| 10.14 | when a composition feels sharp, measure the member carrying the sharpness first | Y | N | any two-instance class must show a measurement for both members |
| 10.15 | a write-up states, in the same sentence as its own count, that a primed-retrieval count is not a frequency | Y | N | read the sentence. **Directly governs this report; I comply in §4** |
| 10.16 | when a report names a property, ask "what goes red if this changes?" before filing it as coverage | Y | N | required column in every walk/audit report. **This rule is the parent of this entire audit, and it is unarmed** |
| 10.17 | baselines, censuses and citations that must survive an edit are keyed on CONTENT | Y | N | grep briefs for bare `:\d+` keys with no content anchor |
| 10.18 | do not report the self-catch rate as a health metric | Y | N | grep write-ups for trend language attached to a catch count |
| 10.19 | treat "the sharpest thing tonight" — received or written — as a flag to measure | Y | N | grep for the phrase family; require an adjacent measurement. Cheap and slightly funny |
| 10.20 | a token guard flattens whitespace first and carries four controls | Y | **Y** | **ARMED** — the four control outputs were printed |
| 10.20b | a retraction sweep needs its own false-positive discipline | Y | N | fold into §1.2 — adjudicate every hit |
| 10.21 | probe truncation by naming the last two items and requiring them quoted back; a bare "yes" is not confirmation | Y | N | the quoted-back content is the check, and **the receiver runs it** — one of the few rules whose natural checker is not the subject |
| 10.22 | phrase such a correction as an ADDITION, never as a retraction of the control; name the inferential step | Y | N | read the correction's form; reject "the control should be dropped" |
| 10.23a | any security-relevant clean result is one sentence containing both halves | Y | N | read the sentence. **Mechanical: a clean-result sentence with no "remains" clause is rejected** |
| 10.23b | a sweep not covering a ticket's population is not progress against that ticket | Y | N | compare sweep population to ticket population before any status change |
| 10.24 | every brief pre-registers hypothesis, falsifier, and action under each outcome; report either way | Y | N | **one grep over `briefs/`. MEASURED BELOW AT 1 OF 8, AND THE 1 IS THE RULE'S OWN SEED INSTANCE** |
| 10.25 | pad every planted positive with hostile adjacent context and state the plant's environment | Y | N | the stated environment is the check; a passing control with an unstated environment is rejected |
| 10.26 | prove the detector, sweep, destroy, re-sweep — in that order | Y | N | four timestamps. Mechanical |
| 10.23am | the one-sentence mandate carries "three trees" explicitly | Y | N | grep relays of #173 for the count. Cheap, and it is the detail §10.4 predicts will be dropped |

---

## 4. WHAT I THINK IT MEANS

Everything above this line is measurement. Everything below is interpretation.

### 4.0 WHICH OF MY OWN NUMBERS ARE FLOORS ON DISCLOSURE RATHER THAN COUNTS

Asked for directly, and the answer is: **all but one.**

| my number | what it actually measures |
|---|---|
| **(a) = 0 / 153** | **A COUNT.** Measured against the filesystem. It does not depend on the file's account of itself, on the EM's account, or on mine. This is the only number in this report that escapes |
| N = 153 | **FLOOR ON DISCLOSURE.** Propositions I extracted from prose. A rule the author holds but never wrote down is not in it. N is a count of what was *written*, and every use of it as a denominator inherits that |
| (b) = 147 | **FLOOR ON DISCLOSURE, and the purest case.** This is the document describing itself. It measures how well the prose announces its own occasions — i.e. writing quality |
| human-observer = 6 | **FLOOR ON DISCLOSURE, and the worst-founded number I am reporting.** 5 of the 6 rest on the file's author narrating that the author's own instruments ran. Trap 2, inside my own column |
| compliance: §8.3 = 0/10, §10.24 = 1/8 | **COUNTS**, over a stated population, with a positive control (§4.4). But they measure *3 rules*, not 153 |
| the 13 STRIKEs, the arming lines | **JUDGEMENT.** Not measurements at all, and should not be cited as any |

**So: the audit's headline finding is a count and its denominator is a floor.** (a)=0 is robust. 153 is
the softest number in the report and it is the one somebody wants to divide by.

### 4.1 The ratio, and the number nobody should compute

**Executable checks: 0 of 153.** Prose applicability clauses: 147 of 153, which per the discriminator is
not arming. Human-run observers that have ever returned a result: 6 of 153, and that 6 is a floor on
disclosure, not a count.

Per §10.15, and about my own count: **this is a census of one file at one moment, not a base rate for
anything.** I have no comparison file. "0% armed" is a property of `_STANDING-RULES-2026-07-29.md` at
06:45Z and I am making no claim about rule files in general.

### 4.2 The denominator is not merely uncertain — it is the wrong kind of object

The brief says somebody is about to use N as a denominator, and that the numerator is a floor. **Both are
true and the second problem is worse than stated.**

Two rules were observed failing. If that is divided by 153, the result is 1.3%. **That number is not a
rate, and making N more accurate cannot make it one.** A rate requires that every member of the
denominator could have appeared in the numerator. Here, **147 of 153 rules have no instrument capable of
producing a failure observation at all.** They are not in the sample frame. They cannot fail *observably*
— not because they are being followed, but because nothing is looking.

Nor is 2/6 the answer. **Neither of tonight's two observed failures was caught by any of the six armed
rules.** They were caught by a person noticing. So the observation process is not sampling the rule set
by any mechanism, armed or unarmed — it is sampling *what happened to be looked at*.

**Under the executable column it is starker.** 0 of 153 rules can produce a failure observation without a
person choosing to go and look. So the observation channel for the entire rule set is human attention,
and human attention is not a sample — it is drawn toward whatever is already suspicious. **A numerator
collected by that channel cannot be divided by anything.**

**There is no denominator available at any N. The correct move is not to count better; it is to stop.**
The honest sentence is: **two rules were observed failing tonight. That is a floor. We do not know the
rate and this file cannot tell us, because 96% of it cannot report.**

§10.10b already says this — *a single measurement of a log has no error term* — and it is sitting
unarmed in Part 10 while the fleet reaches for a rate. That is the receipt class operating on the very
rule that forbids the move.

### 4.3 The dangerous population is the 141, not the 6-with-neither

The brief's framing is that a rule with neither trigger nor check "is a sentence." I think the ordering
is backwards, and this is my main substantive disagreement.

**A rule with no trigger and no check is visibly a sentence.** A reader meets it as prose and is not
misled. There are only 6 of those.

**A rule with a trigger and no check is worse than a sentence, because the trigger makes it read as
operational.** "Before dispatching a leg, do X" sounds like a control. It has a moment, an actor, an
imperative. Nothing in its text discloses that no one will ever know whether X happened. **That is §8.1's
hedge with the sign flipped: it is procedurally responsible-looking, which is precisely why it is exempt
from the question "how would we know?"** A bare sentence invites that question. A triggered unchecked
rule forecloses it.

So the file's 141 trigger-only rules are its actual liability, and they are the population that gets
cited.

### 4.4 The measured evidence, which beats my judgement of it

I did not want to hand back only an opinion about arming, so I measured compliance on the three rules in
the file that govern briefs — because a brief was in front of me and the checks cost one command each.

| rule | mandate | population | compliant | instrument |
|---|---|---|---|---|
| §8.3 | every brief's §0 carries the "no brief path → stop and say so" clause | 10 briefs written since adoption (~04:00Z) | **0** | `grep -l -e 'brief path' -e 'did not receive'` |
| §10.24 | every brief pre-registers hypothesis, falsifier, action | 8 briefs written since adoption (04:53Z) | **1** — and it is `xss-r5-review.md`, the seed instance the rule names as its own example. **Beyond the seed: 0 of 7** | `grep -l falsifier` |
| §10.5 | a brief states its unit | this brief | **1** — it does, explicitly | read |

**Positive control, per §8.4:** the §8.3 query's zero is not an instrument artefact. `stop and say so`
returns **7 hits across 4 files** in `briefs/` — all of them SHA-verification clauses, none of them
§8.3's. The query can find text of that kind; the clause is genuinely absent. (I nearly filed the zero
without this. §9.4 — I searched for my own paraphrase of the mandate first and got a different zero.)

**This is the strongest result in the audit, and it is not a judgement call.** Two rules, both filed as
mandates, both with a check costing one command, both at approximately zero compliance hours after
adoption — **and nobody ran the one command.** §9.1's mandate ("name the largest object the rule applies
to and check that one first") would have caught both on the day they were filed. §9.1's own compliance in
this file is 0 of 153.

**The dispatch that commissioned this audit violates both.** That is not a gotcha; it is the cheapest
available evidence, and the EM asked for exactly this. The author of the file, writing a brief about the
file, complied with 1 of the 3 brief-scoped rules in it. **If the author cannot hold 3 rules across one
brief, 153 is not a set anyone is holding.**

### 4.5 Part 6 is, by its own terms, not in force

`END PART 6` states: *"THIS PART IS NOT IN FORCE UNTIL A PARTY WHO DID NOT WRITE IT HAS CONFIRMED THE
FENCE TEXT IS PRESENT AND READ IT BACK."* I find no record of that confirmation. **On the clause's own
terms, OP-1 through OP-9 — thirty rules including the entire build fence — have not been in force
tonight.** Meanwhile legs have been complying with them and citing them.

**Partial discharge, and I am precise about its limits.** I am a party who did not write it. I read OP-1
in full and read it back: the current fence is (a) token required for anything resolving `./...` or a
whole suite; (b) no token for a selective run scoped to changed code; (c) (b) is unrationed but must be
logged to `reports/_run-queue-log.md` **before** the run; (d) ambiguity resolves to (a); (e) the fence is
scoped to capability, not role; (f) a brief silent on (a)/(b) must be flagged in the first message. The
prior deny-all fence is superseded. **I confirm the text is PRESENT. I cannot confirm it is CURRENT** —
that is a question about the world, not about the file, and §OP-1's own staleness test routes it to the
EM. I did not build, so I did not need to ask it.

### 4.6 What I would actually do

**Do not arm 147 rules. Arm five instruments and strike what they cannot reach.**

**0. FIRST, AND IT COSTS TWO LINES: PUT THE TWO INSTRUMENTS YOU ALREADY BUILT INTO THE FILE.** Add
`em-tooling/scope-check.py` to §7.0 and `em-tooling/orphan-scan.sh` to the GC rule, **by path**, and
correct the stale `/workspace/orphan-scan.sh` citation to the maintained copy. This is the highest
ratio of arming to effort available anywhere in this audit, it moves (a) from 0 to 2 today, and **it is
the only recommendation here that requires no new work at all.** Then run `scope-check.py --self-test`
once and record the result, so its red is a measurement rather than a docstring (§5.0).

1. **A deliverable template with required fields, refused by the EM when a field is blank.** Arms roughly
   40 rules at one stroke: bound (7.0-1), root (7.0-2), unit (10.5), where-you-stopped-looking (10.4),
   search space (10.12b), populations generalised over (6.1), plant environment (10.25), MEASURED/DERIVED
   markers (OP-6b), the grade-falsification line (4.1), the both-halves security sentence (10.23a).
2. **One grep suite over `reports/` and `briefs/`, run by somebody who is not the author.** Arms roughly
   25: `|| true`, unquoted globs, `PIPESTATUS`, `print `, bare `file:line` with no SHA, `[UNCHECKED]` with
   no owner, unqualified `C-1`, forbidden numbers, fraction forms, hedge phrases with no measurement.
   **The non-author clause is the whole rule; without it this is trap 2.**
3. **Reconcile `_run-queue-log.md` against transcripts.** Arms the fence. The log already exists and is
   live; nothing currently reads it against reality.
4. **A brief lint.** Arms §8.3, §10.24, §10.5, §9.1 — the four measured above at near-zero.

**Then strike everything those four cannot reach.** My table names **13 STRIKEs**: §2.1, §3.3, §4.2,
§6.4, §6.8a, §6.12, §7.0-5, §7.4, §8.5, §10.6a, §10.10b, §10.12, OP-1d. Four are duplicates or superseded
text left live (§2.1, §6.4, §10.12 — and two of those are §3.5 violations in the file's own terms). Four
key on an actor's internal state and are unobservable by construction (§3.3, §8.5, §10.6a, OP-1d). Four
are findings wearing rule clothing (§4.2, §6.8a, §7.0-5, §10.10b) — and two of those, §6.12 and §10.10b,
are the ones most likely to be cited as covering an axis that is in fact uncovered.

**§10.10b should be struck as a rule and promoted to the top of the file as a finding**, because it is
the sentence that governs the question the EM is about to be asked.

---

## 5. WHAT I DID NOT CHECK

### 5.0 RESPONSE TO THE 07:00Z ARMED RULE ON EXIT-STATUS OBSERVATION

**Retrospective disclosure, per action ONE. I ran no builds and no tests — read-only, no token — so I
have reported no greens from the harness channel. But the rule generalises past builds, and on the
general property I have one exposure and one near-miss.**

**THE EXPOSURE — and it is on the central claim of §2.4.** I asserted that `scope-check.py` **"can go
red"** (`exit 2` on violation, `exit 3` on self-test failure). **I did not run it. I read its exit codes
out of its own docstring.** That is precisely *"you have not verified anything, you have read a status
line"* — worse, I read a comment describing a status line. The artefact that would settle it is the
script's own `--self-test`, which exists for this purpose. **I did not invoke it, deliberately: OP-1(d)
resolves ambiguity toward (a)-class and my brief denied build authority without saying which of (a)/(b)
it meant.** So the correct label is: `scope-check.py` is **[UNCHECKED] on the question of whether it can
actually go red.** This does not move (a), which is 0 because the *rules file* names no artefact — a
filesystem fact independent of whether any script works. It does bound §2.4's claim that the project has
two *working* instruments. **One of the two is verified working (`orphan-scan.sh` — it ran and returned a
real defect, an output artefact, not a status). The other is verified only to exist.**

**THE NEAR-MISS, which is the broadcast's property exactly.** My headline command is a **pipe**:

```
grep -o -E '[a-zA-Z0-9_-]+\.(sh|py)' _STANDING-RULES-2026-07-29.md | sort -u
```

In zsh a pipeline's status is its **last** element — `sort` — which succeeds on empty input. **Had I read
the exit code, this pipeline would have reported success in every possible world and told me nothing.**
I read the empty stdout instead, and ran a positive control against it. That was luck of habit, not
design: nothing in my method forced it. **Every negative in this report was read from output, not from
status** — I am asserting that deliberately now, because before the broadcast I had not checked that it
was true of all of them, and it is the kind of thing that is true until one command is written tiredly.

**One observation offered back, because it is the same class.** The remedy as filed says *verify a build
by the existence and mtime of its output artefact*. **Mtime is falsifiable by anything that touches the
file, and existence survives a partial write.** `web/dist` being absent caught this instance because the
failure was total. A build that fails after emitting a stale-but-touched artefact passes the new rule.
The stronger form is **content-keyed** — the file's own §10.17 says exactly this about length-keyed
staleness detection, and I flagged the same gap against my own read in §5. **The armed rule is the right
rule and it is armed at the weaker of the two available keys.**

### 5.1 THE REST

- **I did not verify a single factual claim in the file against the code tree.** Read-only, no tree, no
  token. Every `file:line`, SHA, and line count in the rules file is `[UNCHECKED]` by me.
- **I did not run `scope-check.py --self-test`.** §5.0. The one command that would have tested the audit's
  most load-bearing "can go red" claim, declined on fence grounds.
- **Two measurement errors I caught in myself, recorded because §7.14 says to report that you checked,
  not only what you found.** (i) I first searched `scope-check` unanchored and found hits in four files,
  read them as evidence of invocation, and inspected them: **all four are the unrelated phrase
  "scope-checked" about gRPC RPC scope.** That is §10.20's `D4.5` and §9.4's notation hazard, committed
  inside the audit that was looking for it. Re-run against the literal `scope-check\.py`: **0**. (ii) I
  searched `orphan-scan` under `reports/ briefs/`, got nothing, and was one keystroke from filing "never
  invoked." **Unbounded, the project returns 359.** §7.0 — an unstated bound on my own search — and the
  corrected reading **reversed the finding**: `orphan-scan.sh` was built, run, and found a real orphan.
  **Both errors ran in the direction of a cleaner-looking result.**
- **I did not verify that the six armed instruments actually run on a schedule.** For five of the six I
  inferred execution from the file's own narrative — **which is the file's author self-reporting that
  their own instruments ran. Trap 2 applies to my own CHECK column, and this is the weakest part of this
  audit.** The one exception is §7.10/§10.13, where I opened `_run-queue-log.md` myself and confirmed it
  exists, is 1611 lines, and was written 4 minutes before I looked. I did **not** read its contents for
  correctness, only for the presence of the staleness question.
- **I did not audit the 261 files in `reports/` or the other 355 briefs.** My compliance measurement
  covers 3 rules, not 153. **The 3.9% arming figure is my judgement; only the §8.3 / §10.24 / §10.5 rows
  are measured.** Do not let the measured rows lend their authority to the judged ones — that is §10.14.
- **I did not check whether any rule is *substantively correct*.** The brief did not ask and I did not
  look. A rule can be perfectly armed and wrong.
- **I did not detect appends during my read.** I read in three sequential passes over ~10 minutes. If the
  file grew, my N is short and nothing in my method would show it. Content-keyed, not length-keyed,
  would have fixed this (§10.17) and I did not do it.
- **I did not distinguish rules that are dead by scope.** Several (§7.4, §6.9, the beads sections) are
  about artefacts that may no longer exist. I struck §7.4 on those grounds but did not sweep for others.

---

## 6. WHERE THE BRIEF WAS WRONG

**0. THE ADDITION WAS RIGHT, IT CAUGHT A REAL DEFECT IN MY SCORING, AND IT IS STILL ONE STEP SHORT.**
Recorded first because it is the largest correction. Under the original wording I returned CHECK=6, and
**5 of those 6 I had scored from the file's own narrative that the file's own instruments had run.** The
addition's sentence — *every instrument that depends on self-report measures candour, not the axis* —
described my own column before it described the file. I would not have caught it.

**Where it is still short:** the addition asks whether a rule *has* an executable check, which is a
property of the rule's text. **The stronger question is whether an executable check that exists is
reachable from the rule**, and it is a different question with a different answer. Here they happened to
coincide at 0, but the *reason* is what matters and only the second question exposes it: the instruments
were built, and the rule file does not know their names. **A file could score (a)=0 because nobody built
anything, or because somebody built two good instruments an hour ago and nothing points at them. Those
are different failures and they want different fixes** — and this project is the second one. §10.16 has
the sentence: *the fix is not unknown here, it is unreachable*.

**And a hazard the addition introduced while removing a bigger one.** I was told the expected answer, and
told to treat that as a hazard. **It did not work as intended.** Being warned did not make me
neutral — it made me hunt for a non-zero, because the message also said a non-zero would be read as the
stronger output. **Both halves of the instruction pushed in a direction; they simply pushed in opposite
directions, which is not the same as not pushing.** What actually held the number to 0 was that the
command has one output and I could read it. **The disclosure of the expectation did not neutralise the
expectation; the artefact did.** That is the broadcast's own property (§5.0) arriving by a different
road: an instruction appended in order to correct an observation becomes part of what is observed.

**1. Trigger and check are not two comparable gates, and reporting them side by side is misleading.**
147 of 153 have a trigger; 6 have a check. **The trigger column carries almost no information** — prose
rules almost always name their occasion, because naming the occasion is how you write a readable
sentence. It costs nothing and it discriminates nothing. Asking for both counts implies the two filter
comparably. They do not. **I would replace TRIGGER with OWNER: is there a named party obliged to run the
check?** Among my six armed rules, the variable that predicted arming was a named owner plus a named
file — never the presence of a trigger. §7.6b already knows this ("a declined measurement must be handed
to a NAMED OWNER, not merely marked") and the brief did not use its own file's best idea.

**2. "A rule with neither is a sentence" gets the risk ordering backwards.** See §4.3. The 6 with neither
are honest prose. The 141 with a trigger and no check are the receipts, because the trigger is what makes
them read as controls. The brief's governing sentence — *an unarmed rule on the books is a receipt saying
the axis is covered* — is right, but it is **most true of the rules the brief's own criteria score
best**.

**3. The denominator problem is worse than the brief says, and the fix is different.** The brief frames
this as "we lack a denominator, so go count." **The counting does not help.** 147 rules cannot produce a
failure observation, so they are not in the sample frame; and neither of tonight's two failures was
caught by the six that can. **There is no rate here at any N.** The brief's instinct to get N was right
and its stated reason was wrong: N is worth having as a *scope measurement* — how much unenforced
material is on the books — not as a denominator. **Asking me for N in order to compute a rate would have
produced a more precise wrong number, and the precision would have made it more citable.** That is
§10.8: no new information, hedge stripped, authority added.

**4. The brief did not ask the question its own file says to ask.** §10.16 — *when a report names a
property, ask "what goes red if this changes?"* — is the parent of this whole audit and the brief did not
cite it. Worth noting because §10.16 also says the named-but-unpinned shape is *"the default output of
competent work"*, which is the correct diagnosis of this file and a kinder one than "140 good intentions."

**5. The dispatch violates §8.3 and §10.24 of the file it commissioned an audit of.** §4.4. The brief's
§0 carries no "if you did not receive a brief path, stop and say so" clause — 0 of 10 post-adoption
briefs do — and it pre-registers no falsifier, where 1 of 8 does and that one is the rule's own seed. It
does comply with §10.5. **1 of 3.**

**6. "A file of 140 unenforceable good intentions."** The file has **exactly 140 headings**. I assume
coincidence, but if the figure was reached by counting headings and then used as a rhetorical
hypothetical, that is §10.8 in one sentence — a number round-tripping into authority it never earned.
**Flagging it rather than resolving it: I do not know which it was, and the EM does.**

**7. One thing the brief got exactly right, recorded because §6.12 says to score the demand.** Requiring
the counts *before* any interpretation, with nothing in between, is what stopped this report opening with
the 3.9% figure and a conclusion. I reached for that opening and the ordering constraint blocked it. **The
constraint produced a better artefact than my judgement would have, and it did so by removing a choice
rather than asking me to make it well** — §10.24's own mechanism, applied to report structure.
</content>
