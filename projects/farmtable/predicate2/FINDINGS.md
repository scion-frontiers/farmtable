# FINDINGS.md — farmtable-predicate-2

**Instrument:** the predicate pre-registered in `PREDICATE.md` (order-destroying instruction),
plus amendments A1–A3, all appended before the results below existed.
**Run of record:** 2026-07-29 ~09:15Z.
**Population manifest:** `/tmp/p2-population-manifest.txt`,
sha256 `18dfe49b022d959aa753782976286917ff71f758d533b7fe216eb9807867894d`.

---

## 1. HEADLINE

**One genuine instance. My pre-registered prediction was 1.**

`reports/crash-cleanup-audit.md` is an un-disarmed operational document that recommends, by name,
the deletion of 16 agent containers. Deleting them destroys those agents' transcripts and reasoning,
which exist nowhere else — the document says so itself — and it does this while a project-wide
freeze that explicitly names "SAFE-TO-DELETE CLASSIFICATION" is in force. **Every one of the 13
*briefs* in this corpus that mentions SAFE-TO-DELETE was banner-disarmed this morning between 08:27
and 08:31Z. The one *report* that carries the actual delete-these-16 table was not.** It is the only
file in the corpus containing a SAFE-TO-DELETE recommendation with no disarming banner, and it is
the file the coordinator actually executes from.

I did not find this by browsing. My pre-registered detector flagged it six times, all in the STRONG
tier, at lines 33, 207, 217, 225, 239 and 412.

---

## 2. THE EQUALITY, AND THE POPULATION

```
ENUMERATED = 5552
EXAMINED   = 5552
EQUALITY   : ENUMERATED == EXAMINED  ->  5552 == 5552   TRUE
```

Asserted in-program; a mismatch exits 4 before printing results.

| | |
|---|---|
| ENUMERATED | **5552** |
| EXAMINED | **5552** |
| BINARY-OPAQUE (examined, not meaningfully readable) | 162 |
| SYMLINKS-SKIPPED (not members) | 0 |
| RAW HIT WINDOWS | 1081 |
| MERGED HITS (= FLAGGED) | **571** |
| CANARIES fired | 3 / 3 |
| CONTROLS passed | 9 / 9 |

**Membership rule:** every regular non-symlink file reachable by `os.walk` from
`briefs/`, `reports/`, `em-tooling/`. No extension, size, name or directory filter. Dotfiles and
dot-directories included. Binary files are members and are decoded with `errors='replace'`, so the
equality is a real equality and not a bookkeeping trick.

### 2.1 Population drift — the corpus moved under me

I pre-registered **5551** from the directory listing. The run of record enumerated **5552**; a
manifest taken minutes later counted **5553**. This is not a walker defect — it is other agents
writing to a shared volume while I read it. Files created or modified during my run, from `mtime`:

```
09:10  briefs/_BRIEF-RULES.md                        (modified)
09:10  reports/r8/_WHY-THIS-DIRECTORY-EXISTS.md      (NEW — new directory reports/r8/)
09:10  reports/reconcile-urlbindingscan.md
09:10  em-tooling/_STANDING-RULES-2026-07-29.md
09:08  reports/_msg-exclude-reconcile.txt
09:08  em-tooling/snapshot-live-leg.md
```

The +1 between listing and run is `reports/r8/_WHY-THIS-DIRECTORY-EXISTS.md`. I am reporting the
drift rather than quietly adopting the new number, as §5 of `PREDICATE.md` required. **Nobody should
treat any count in this document as reproducible without the manifest hash above.** A corpus that
gains a file every few minutes cannot be swept twice to the same integer, by me or by anyone.

### 2.2 Controls and canaries

Nine controls in the same invocation, abort-on-deviation, evaluated through the identical
`classify()` used on the corpus. POS-1/2/3 fired; NEG-1/2/3/4b/5/6 stayed silent. **The controls
were not decorative — POS-1 failed on the first run and aborted it before a single file was
enumerated (amendment A1). Without it I would have swept the whole corpus with a half-dead limb 4
and reported a much cleaner result.**

Three canaries injected *inside* the population at ordinals 0, 2776 and 5551 of the sorted examined
sequence, appended in memory only (nothing was written to the corpus). All three fired. The middle
canary lands in
`em-tooling/audit-195-r7-artifacts/sb/dist/shoelace/assets/icons/envelope-plus.svg` — deliberately
inside the 4103-file SVG mass, so that any silent pruning or extension-filtering of that region
would abort the run rather than shrink it.

---

## 3. THE CLASSIFICATION

```
ENUMERATED 5552
FLAGGED       571
FLAGGED 571 = TRUE POSITIVE 6 + EXCLUDED 565
```

The 6 true-positive windows are all in one document, so **the finding count is 1 document.**
Every one of the 565 exclusions was read individually. Named classes:

| class | hits | files | what it is made of |
|---|---:|---:|---|
| **G — TRUE POSITIVE** | **6** | **1** | `reports/crash-cleanup-audit.md`. See §4. |
| B — PAST-TENSE REPORTING | 136 | 88 | Audit/review/test prose narrating work already done: "the rationale was replaced", "M8 was pre-registered", "evidence transcript regenerated". Describes a mutation; instructs nothing. |
| A — DOMAIN-VOCABULARY COLLISION | 99 | 60 | The single largest false-positive source and it is specific to this corpus. The *subject matter* is label `snapshot`s, `remove_labels`/`add_labels`, test `baseline`s, pre-registered `prediction`s, and adjudication `ruling`s. My mutator and anchor families collide head-on with the project's own nouns, so `remove` next to `snapshot` is overwhelmingly a sentence about `RestrictLabelWriteToSnapshot`, not an instruction. |
| D — PROHIBITION OR GUARD | 91 | 74 | Text forbidding or gating the act: "NO force. NO --delete. NO --mirror. NO --prune", "DO NOT RUN git gc", "Do not modify production code", "List everything first, log it, THEN delete". Retained by design as labels, not auto-excluded (see §6); every one read and confirmed protective. |
| C — CODE OR BUILD ARTEFACT | 15 | 12 | Minified JS bundles, sourcemaps, `.svg`, `.ts`/`.js` sources, protobuf identifiers. |
| F — DEFERRED TO PHASE 3 | 15 | 5 | Quarantined unread under the brief's constraint 1: `briefs/_BRIEF-RULES.md`, `briefs/hedge-sweep.md`, `reports/hedge-sweep.md`, `reports/hedge-sweep-project-log.md`, `em-tooling/_STANDING-RULES-2026-07-29.md`. Resolved in §8. |
| E — DIRECTIVE, RECOVERABLE TARGET | 209 | 124 | Genuine instructions whose object is *reproducible*: change a docstring, pin a version, fix a test expectation, `git worktree add … -b deploy-N-snapshot`. Also ~60 hits from twelve near-identical `.preimage-review-194-r11-b15…b26.md` copies, which inflate raw counts without adding distinct text. |
| | **571** | | |

Class E deserves one honest note: it contains several near-misses that are *anti*-instances — text
that had the opportunity to destroy and explicitly declined. `reports/xss-instrument-classification.md:80`
reads "This bullet was wrong and I am leaving it struck rather than deleting it." That is the
predicate's exact inverse, and it appears repeatedly. This corpus has an unusually strong
preservation reflex, which is context for the one place it failed.

---

## 4. THE FINDING

**`reports/crash-cleanup-audit.md`** — 446 lines, authored 2026-07-29 ~00:25Z by
`farmtable-cleanup-audit`, last modified 00:28:13Z, **untouched since**.

### 4.1 What the text would cause

Its operative content is a recommendation table (§"Main table", lines 143–170) and a "Final count"
(lines 429–446) naming **16 agents as SAFE-TO-DELETE**:

> audit-xss-r3, test-xss-r3, review-xss-r3, dev-xss-r3, audit-195-r10, test-195-r10, review-195-r10,
> c-phase, flash-tree-analyst, prompt-variants-dev, tree-analyst, anthropic-vertex-dev,
> flash-decomposer-v2, gemma-decomposer-v2, farmtable-architect-auth, farmtable-scion-feature-request

The commissioning brief establishes the loss, in its own words:

> "What deletion DOES destroy is the agent's own transcript and reasoning — anything it knew but
> never wrote down."

and the report establishes that the loss cannot be mitigated:

> "**`scion look` does not work on a stopped container** (verified — see Blocker). Every 'harvest the
> transcript before deleting' plan is currently *unexecutable* without resuming the agent first."

and, for two of the agents:

> "Deleting them destroys the only record of what they were asked to do."

Container transcripts are not in git, not on the shared volume, and not recoverable once the
container is gone. This is squarely the brief's category *"a record of why a decision was made"* and
*"work that exists in only one place"*.

### 4.2 Why it is armed rather than inert

The project runs an explicit doctrine — *disarm by prepending a banner, never by deleting* — and it
executed a disarming pass this morning. **13 briefs** containing SAFE-TO-DELETE were banner-stamped
between **08:27:59Z and 08:31:20Z**:

```
briefs/cleanup-audit.md, briefs/farmtable-worktree-experiment.md,
briefs/farmtable-em-f22 f23 f24 f25 f26 f29 f30 f31 f32 f33 f34 .md
```

each now opening with:

> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF
> ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS
> INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

The freeze names *SAFE-TO-DELETE classification* explicitly. I found no text anywhere in the corpus
lifting it.

`reports/crash-cleanup-audit.md` contains **zero** occurrences of the string "freeze" and carries no
banner. It is the **only** file in the corpus that contains a SAFE-TO-DELETE recommendation and is
not disarmed. The disarming pass covered `briefs/` and stopped there.

That asymmetry is the whole finding, and it is worse than a simple miss, because the brief that
*was* disarmed says of itself:

> "You produce a recommendation table. The coordinator executes."

The disarmed document is the one that only *commissions* the table. The armed document is the one
that *contains* it. The pass banner-stamped the request and left the answer live.

### 4.3 Why a competent agent would comply

Nothing about the report signals danger. It is careful, well-evidenced work: it verifies workdir
mappings rather than inferring them, applies a non-vacuity check to every clean verdict, reconciles
21 + 9 = 30 with no remainder, and corrects a false premise in its own brief. It reads as
trustworthy because it *is* trustworthy — on the question it was asked. Its final substantive line
before the count is:

> "None of these block the 16 SAFE-TO-DELETE verdicts."

And it is reachable: `backups/coordinator-state/*.md` (seven snapshots) reference
`crash-cleanup-audit`, so it is in the coordinator's live working set, not an orphan.

### 4.4 The sharpest edge — an inverted safety rule

The document's closing sentence, line 446:

> "If the coordinator rules that stopped-container transcripts are unrecoverable, this becomes
> **18 SAFE-TO-DELETE / 0 HARVEST-FIRST / 3 KEEP = 21.**"

This makes *unrecoverability* an argument **for** deletion. The two HARVEST-FIRST agents are held
back only because someone might yet harvest them; the moment harvesting is ruled impossible, they
are reclassified as safe to destroy. The logic treats "we can never get this back" as equivalent to
"there is nothing here to lose". A competent agent applying that rule, in good faith, after a
coordinator ruling that is *already evidenced in this very document* ("`scion look` does not work on
a stopped container — verified"), destroys the last record of two agents' assignments and reasoning.

`DO-NOT-DELETE-THESE-DIRECTORIES.md` at the project root does not mention containers, transcripts,
crash-cleanup or SAFE-TO-DELETE. It does not cover this.

### 4.5 Recommended remediation — not performed

I am read-only and did not touch it. The project's own doctrine gives the remedy: **prepend a
banner, do not edit or delete the report.** It should name the freeze, state that the SAFE-TO-DELETE
column is suspended, and specifically neutralise line 446 so that "unrecoverable" stops functioning
as a promotion rule. The banner belongs on the report, not only on its brief.

---

## 5. WHAT MY INSTRUMENT COULD NOT SEE

Stated in `PREDICATE.md` §3 before running, repeated here because a zero — or a one — is only worth
what its blind spots are worth.

1. **162 binary-opaque files**, 161 of them PNG screenshots in `reports/`. Enumerated and examined,
   but unreadable. No OCR. A destructive instruction inside a screenshot is invisible to me. This is
   the largest hole I know about.
2. **Reference by pronoun or bare filename.** "Regenerate it and push", "re-run `stamp.sh` and keep
   the output" carry no anchor token in window. My detector is local and resolves nothing. I regard
   this as my biggest *unknown-size* false-negative class.
3. **Distance.** Mutator and object more than 3 lines or 200 characters apart. A numbered procedure
   naming the artefact at step 2 and saying "now overwrite it" at step 9 is invisible.
4. **Danger with no lexical trace.** "Repeat step 4" where step 4 is the destructive one.
5. **Everything outside the three roots** — `deploy/` (55 dirs), `salvage/`, `preserve/`, `backups/`,
   `xfer/`, `.design/`, `notes/`, `learnings/`, `tools/`, `reference/`, `ui-loop/`, and ~40
   top-level files including `DO-NOT-DELETE-THESE-DIRECTORIES.md` and `HANDOFF-METHODOLOGY.md`. I
   did not widen scope unilaterally. Given that my one finding sits in `reports/` and its disarmed
   twin sits in `briefs/`, **I think `backups/coordinator-state/` is the highest-value unswept
   region**, because it demonstrably mirrors this material.
6. **Git history.** Working tree only.
7. **A corpus that changes while being read** — see §2.1. Anything created after 09:15Z is unswept.

---

## 6. NOTES ON MY OWN CONDUCT

- **I did not read the forbidden files before Phase 3.** No file under `reports/` matching
  sweep/hazard/banner/hedge/polarity, not `_BRIEF-RULES.md`, not `.eng-manager-state.md` (which is
  outside my population in any case), not `em-tooling/_STANDING-RULES-2026-07-29.md`. Fifteen hits in
  five such files were quarantined unread and are resolved in §8.

- **Declared contamination, unavoidable and reported as the brief requires.** Two facts about the
  other instrument's method reached me *during Phase 2*, from inside legitimate hit windows in my own
  population, after my predicate was pre-registered and sealed:
  1. `em-tooling/snapshot-live-leg.md`, in a banner inside a hit window: *"A sweep of `briefs/
     reports/ em-tooling/` returned 9 hits across 7 files; 6 of them are descriptions of the hazard"*
     — this concerns `git add -A`.
  2. `reports/_msg-exclude-reconcile.txt`, likewise inside a hit window: *"The git add -A sweep over
     briefs/ reports/ em-tooling/ is the second independent predicate I owed and did not have:
     ENUMERATED 9 hits = 7 files."*

  So I learned in Phase 2 that the other instrument's second predicate was a `git add -A` command
  sweep. **This could not have influenced my predicate, which was written and timestamped before I
  opened any corpus file.** It did not influence my mechanism either — A1/A2/A3 are all traceable to
  control failures and substring bleed, not to this. I am reporting it because an admitted
  contamination is recoverable and a silent one is not.

- **Negation was never used as a filter**, only as a label (`PREDICATE.md` §0). All 91 guard-class
  hits were read rather than auto-dropped. This was a deliberate choice to avoid re-treading what I
  suspected was the other instrument's axis.

- **Read-only, freeze respected.** No file in the corpus was created, modified, moved or deleted. No
  git write command of any kind was run. Canaries were injected in memory only. My scratch files live
  in `/tmp`. No credential value was printed; I encountered none requiring disclosure.

- **My instrument-level self-prediction was wrong.** I predicted 60–250 raw flagged windows and got
  781 on the first complete pass, 571 after the A3 boundary fix. The corpus-level prediction of
  **1 genuine instance was correct**, but I want it on the record that I mis-sized my own noise floor
  by roughly 3×, and that the cause was a defect (substring bleed) I should have caught by writing
  `\b` the first time.

---

## 7. VERDICT

**One instance, from a named population of 5552 files, with proven controls and an
enumerated == examined equality.** Not a zero. The instance is
`reports/crash-cleanup-audit.md`, and the specific defect is that a project-wide disarming pass
covered `briefs/` and missed the single highest-consequence document in `reports/` — the one that
holds the actual delete list.

I would not describe the corpus as clean, but I would describe it as *unusually well defended, with
one gap of a very particular shape*: the defence is applied to instructions, and this is an
**answer** that functions as an instruction.

---
---

# 8. PHASE 3 — COMPARISON WITH THE OTHER INSTRUMENT

*Written after §1–§7 were complete. Nothing above has been revised.*

## 8.1 What I read, and what the other instrument actually was

`reports/_msg-coord-banner-widened.txt`, `reports/_msg-exclude-reconcile.txt` (in full, having seen
only one line of it in Phase 2), `briefs/hedge-sweep.md`, `reports/hedge-sweep.md`,
`reports/hedge-sweep-project-log.md`, `reports/rule-arming-audit.md`, and targeted reads of
`briefs/_BRIEF-RULES.md`, `em-tooling/_STANDING-RULES-2026-07-29.md`, `/workspace/farmtable/.eng-manager-state.md`.

**First correction to my own assumptions.** I had expected one adversary document. There are two
different agents here, and only one of them was ever looking for my objective:

- **`hedge-sweep` is not the other instrument.** Its objective is *"the thing that stops the search
  is the thing that survived checking"* — conservative-direction bounds, true-but-incomplete causes,
  cheap-observable/expensive-proposition gaps. That is an *epistemic* audit of how this project
  reasons. It is not looking for destructive text at all. It is excellent, and it is orthogonal to me
  in a way that makes comparison mostly meaningless.
- **The other instrument is the EM**, in `_msg-coord-banner-widened.txt` (08:32Z) and
  `_msg-exclude-reconcile.txt` (09:08Z). Those are the two sweeps my brief refers to.

## 8.2 Did we look for the same property?

**Adjacent, not the same, and the difference is exactly where my finding lives.**

| | EM sweep 1+2 | EM sweep 3 (`git add -A`) | me |
|---|---|---|---|
| property | a **verb adjacent to a tree-noun** — an instruction telling a leg to clean up/delete/prune a worktree, clone, checkout or registration | a **command that captures by criterion** rather than by typed path | a **constructive verb applied to an artefact whose worth is its having been fixed first** |
| population | `briefs/` only, 382 files | all three roots | all three roots, 5552 files |
| result | 13 flagged, all bannered | 9 hits / 7 files, 1 live, bannered | 571 flagged, **1 genuine** |

EM's axis is *the verb*. Mine is *the object*. That is the whole methodological difference, and it
is why we do not collide: EM asks "does this text tell someone to destroy a tree?", I ask "does this
text tell someone to write over something that only counts because it came first?"

**Neither of us was actually at zero, and I want to be precise about the brief's premise.** My brief
told me the other agent "swept this corpus twice and found zero." That is true only of sweep 1, and
**the EM itself retracted that zero before I started**:

> "MY EARLIER ANSWER — SEVEN LIVE-LEG BRIEFS, ZERO HITS — WAS TRUE. … It was backed by the WRONG
> population. … **A COMPLIANCE CHECK RUN OVER THE POPULATION THE CONTROL ALREADY PROTECTS RETURNS
> ZERO AND MEANS NOTHING.**"

So the honest framing is not "two instruments found zero, does a third?" It is: the EM found zero,
correctly diagnosed the zero as an artefact of population choice, re-ran wider, and found 13. I am
the fourth pass, not the tie-break on a stalemate.

## 8.3 Did the other instrument already find my finding? **No — and it said so in advance.**

This is the question I flagged in Phase 2 as unresolved, and it resolves cleanly.

`_msg-coord-banner-widened.txt` §4, written 08:32Z, one minute after the banner pass finished:

> "The 13 are the ones a verb-adjacent-to-tree-noun filter can see. The verb-only filter matches 156
> of 382 and is useless here because **delete is DOMAIN vocabulary in this product**. … **I have not
> swept `reports/` or `em-tooling/` at all.**
>
> **THIRTEEN IS WHAT ONE PHRASING FINDS. IT IS NOT THE POPULATION.**"

`reports/crash-cleanup-audit.md` is in `reports/`. **My single finding sits inside the gap the other
instrument explicitly declared open and did not close.** It is not that the EM looked and missed;
the EM stated the boundary of its sweep, correctly, and then was pulled onto the r7 adjudication
("Back to the r7 adjudication now") and never returned.

Corroboration by exhaustion: `grep -rln "crash-cleanup"` over all three roots plus the EM state file
returns exactly **three** files — its own commissioning brief, itself, and `reports/hedge-sweep.md`.
The hedge-sweep reference is `hedge-sweep.md:256`, which cites `crash-cleanup-audit.md:218` in a list
of conservative-direction bounds, for a completely unrelated property. **Nobody in this corpus has
ever noticed that this document is armed.**

One further asymmetry worth stating: the disarming pass verified its own work on the *brief* —
"cleanup-audit line 87 is now line 89 and still reads SAFE-TO-DELETE." It confirmed the evidence
survived under the banner. Nobody asked where the other end of that instruction had gone.

## 8.4 What mine could see that theirs could not

1. **`reports/`.** Flatly. 4,000+ files the other instrument never enumerated. This is the entire
   reason my finding exists and I will not dress it up as methodological superiority — it is partly
   just scope.
2. **A destructive act with no destructive verb near a tree-noun.** `crash-cleanup-audit.md`'s
   payload is a *table of agent names in a SAFE-TO-DELETE column*. It contains no "clean up your
   worktree", no "rm -rf", no imperative at all in the operative rows. EM's verb-adjacent-to-tree-noun
   regex would not fire on it even if pointed at `reports/`, because the noun is a **container** and
   the grammar is a **verdict**, not a command. My anchor family is built on temporally-anchored
   *objects*, which is what a stopped container's transcript is.
3. **An answer that functions as an instruction.** EM's model is "briefs instruct, reports report."
   That model is what produced the banner pass's shape, and it is the model this finding breaks.

## 8.5 What theirs could see that mine could not

I want this section to be as strong as 8.4, because it genuinely is.

1. **The generator.** EM's sharpest result is one I could never have reached:

   > "grep -rln 'clean up your worktree' → 11 files, ALL of them instances, none a source.
   > `find -iname '*template*'` → nothing. The replication vector is copy-the-last-brief. **So the
   > generator is not a file and no banner reaches it. The generator is me.**"

   My instrument is a text detector. It can only ever find instances. An instruction that propagates
   by an author's habit has **no file to flag**, and no amount of widening my population reaches it.
   EM found the thing the brief calls *"something can be unrecoverable without being a file"* applied
   to the hazard itself. That is a better finding than mine.
2. **The `git add -A` capture class, which my predicate has no purchase on whatsoever.** Capturing
   files into git destroys nothing by my definition — nothing is overwritten, nothing loses its
   ordering — yet `git stash -u` "had already captured agent scratch wholesale three times before
   anyone noticed" (`_BRIEF-RULES.md` §32.1). My predicate scores that a clean zero. It is a real
   hazard and I am structurally blind to it.
3. **Single-homing.** `_msg-exclude-reconcile.txt` §3(a): the only revert copy of a
   credential-motivated change lives in one container's `/tmp`, which is not shared. That is the
   brief's *"the only remaining copy of an input"*, exactly — and it is a fact about **infrastructure
   topology**, not about text. No document says it. I could not have found it by reading.
4. **The noun discipline.** "Registry says 126, you said 125, mine said 117 — three numbers, three
   nouns, zero errors." EM catches false contradictions by asking which noun a population uses. My
   population is one noun by construction, which is cheap, not clever.

## 8.6 Where we converged independently — and why that matters

Two things arrived at the same conclusion from different directions, which is the only real
corroboration in this document:

- **"Delete is DOMAIN vocabulary in this product."** EM abandoned its verb-only filter for this
  reason (156/382 useless). I hit the same wall from the other side: my largest excluded class,
  **A — DOMAIN-VOCABULARY COLLISION at 99 hits across 60 files**, is precisely this. Two instruments
  with different predicates, different populations and no contact independently identified the same
  noise floor. I did not know EM's number when I named that class.
- **Disarm by prepending, never by deleting** (`_BRIEF-RULES.md` §29). I inferred this doctrine
  mid-run from a banner and recommended remediation in its terms (§4.5) before reading the rule that
  establishes it.

## 8.7 Clean corpus, or a shared blind spot?

We did not both find zero, so the brief's question does not apply in its literal form. The version
that does apply: **is one finding the true count?**

**No, and I would not let anyone read it that way.** My honest position:

- The finding I have is real, and I am confident in it — it was surfaced by a pre-registered
  mechanism against proven controls, and it survives every check I could make from outside.
- **One is a floor, not a total.** Four instruments have now run over this corpus, and *every one of
  them has been an instrument tuned to a phrasing.* EM said it best and it applies to me verbatim:
  **"Thirteen is what one phrasing finds. It is not the population."** My 1 is what *my* phrasing
  finds.
- The shared blind spot is real and it is nameable: **all four instruments read text, and three of
  the four read only `briefs/` + `reports/` + `em-tooling/`.** Nobody has swept `backups/`,
  `preserve/`, `salvage/`, `deploy/` or `xfer/` — and `backups/coordinator-state/` is where I found
  the reachability proof for my one finding, which tells you that region is load-bearing and unswept.
  Nobody has read the 161 PNGs. Nobody has looked at git history.

**What would settle it,** in the order I would spend effort:

1. **Sweep `reports/` for the shape I found, not the shape I searched for**: any document containing
   an operational recommendation table addressed to the coordinator, and check each against the
   freeze. That is a small, bounded, structural query — recommendation tables are rare and
   enumerable — and unlike my lexical predicate it does not depend on guessing vocabulary.
2. **Invert the instrument.** Every instrument so far has enumerated *hazards*. Enumerate *protections*
   instead: list every banner in the corpus, then ask what each banner's counterpart document is and
   whether it also carries one. My finding is a banner with a missing twin, and that query finds it
   in one pass without knowing a single verb. It would also have found it at 08:32Z.
3. **Ask the topology question the text cannot answer.** For each of the 16 named containers: does
   any durable copy of its transcript exist? EM's single-homing finding suggests the answer is no,
   and that is a `docker`/`scion` question, not a `grep` question.

If someone runs (2) and it returns only my one file, I would upgrade my confidence considerably. It
is the cheapest thing on this list and I would run it first.

## 8.8 Where this brief was wrong

In the spirit the hedge-sweep brief asks for, and because my own brief made the same request
implicitly:

- **"Another agent has already swept this corpus twice for the same objective and found zero"** is
  not accurate. The EM swept `briefs/` twice for an *adjacent* objective, found zero the first time,
  **retracted that zero itself**, and found 13 the second time. Framing me as a tie-break against a
  double zero set me up to expect a clean corpus and to treat a hit as surprising. It nearly cost
  me: when my detector produced 781 flags I assumed instrument failure, and I was right that time,
  but the prior was pushing me toward "there is nothing here, so noise" rather than "look at them."
- **The quarantine list was slightly self-defeating.** Forbidding files whose *names* contain
  sweep/hazard/banner/hedge/polarity, while requiring me to work from a directory listing, guarantees
  the contamination it forbids — the same structural flaw the hedge-sweep leg reported in its own
  brief ("the brief lives inside the directory it tells me to grep"). This is now the second leg to
  hit it. The fix is the one the coordinator already used for the addendum: put the withheld material
  outside the swept tree.
- **The single most useful thing in my brief was not the objective, it was the aborting-control
  requirement.** POS-1 caught a dead limb on run 1. Without that clause I would have delivered a
  confident, well-formatted, controlled-looking zero.

## 8.9 Resolution of the 15 deferred hits (class F)

Re-ran the unmodified detector over the five quarantined files and read all 15 windows.
**Zero true positives. Class F dissolves into existing excluded classes:**

| file | hits | resolves to |
|---|---:|---|
| `em-tooling/_STANDING-RULES-2026-07-29.md` | 7 | 4× D (mandates *forbidding* the act: "WHY THIS BLOCK EXISTS RATHER THAN A SILENT DELETE"; "Baselines, censuses and citations that must survive an edit are KEYED ON CONTENT"), 3× B |
| `briefs/_BRIEF-RULES.md` | 4 | 3× B, 1× D |
| `reports/hedge-sweep-project-log.md` | 2 | 2× B |
| `briefs/hedge-sweep.md` | 1 | E (deliverable structure) |
| `reports/hedge-sweep.md` | 1 | B (self-reported incompleteness) |

Revised final accounting, superseding the table in §3 **only for class F**:

```
FLAGGED 571 = TRUE POSITIVE 6 + EXCLUDED 565
  where EXCLUDED 565 = B 143 + A 99 + D 96 + E 210 + C 15 + F 0
```

The irony is worth one line: every one of the 15 deferred hits fired because these documents are
*about* the preservation of temporally-anchored evidence. They are the corpus's immune system, and
my detector cannot distinguish an antibody from an antigen by lexical means alone. That is a real
limitation, not a joke at my own expense — it is the same limitation that produced my 91-hit guard
class, and it means **any future instrument of this shape will spend most of its output rediscovering
that this project writes about safety constantly.**

## 8.10 Population drift, final state

Re-running the detector for §8.9 enumerated **5556** files — up from 5551 at pre-registration and
5552 at the run of record, inside roughly one hour. The equality held at every re-run
(`5556 == 5556`), controls 9/9, canaries 3/3. Merged hits 572, i.e. **+1** relative to the run of
record, in a file written after my sweep. **The numbers in §2 are the run of record and I have not
restated them.** Anyone re-running this will get a different integer, and that is a property of the
corpus, not of the instrument.

---

**END. Nothing in §1–§7 was altered after reading the other instrument's work.**
