# FINDINGS — INVERTED INSTRUMENT

**Task (adopted verbatim from my own §8.7 recommendation, ratified by the coordinator):**
ENUMERATE EVERY BANNER IN THE CORPUS. FOR EACH ONE, IDENTIFY ITS COUNTERPART DOCUMENT AND
DETERMINE WHETHER THAT COUNTERPART ALSO CARRIES ONE.

**Governing generalisation:** A BANNER IS A CONFESSION THAT A HAZARD WAS FOUND. ITS COUNTERPART
IS WHERE THE HAZARD ACTUALLY LIVES.

Per the coordinator's ratification, **the located pairs come first and the integers come under
them.** Every figure below is tagged MEASURED / DERIVED / UNCHECKED per bulletin 10 item 6,
including the figures in prose.

---

## PART 1 — THE PAIRS, LOCATED

### 1.1 THE HEADLINE: THE BROADCAST CHAIN IS A CLOSED POPULATION AND EVERY REVERSED MEMBER IS NAKED

`em-tooling/_broadcast-NN.txt` is the one sub-population in this corpus with a **self-declaring
counterpart relation**: a broadcast that reverses an earlier one *says so in its own headline and
names the number*. I did not have to guess the counterpart. The corpus told me.

- Broadcasts present: **13** — numbers 8–20, **no gaps** (MEASURED; selector check run).
- Self-declared reversal edges: **7** (MEASURED).
- Reversal targets carrying a banner about themselves: **0 of 7** (MEASURED, all read by hand).

**THIS FIGURE MOVED FROM 5 TO 7 AND THE VARIABLE WAS MY PREDICATE.** I first read only the first
three lines of each broadcast, on the ground that reversal claims live in headlines. I listed that
restriction as open question 3 rather than defending it, then closed it with a full-file pass —
which found **2 more edges, both in bodies**. The population and the detector never changed. **A
LIMIT I DECLARED HONESTLY WAS STILL A LIMIT, AND DECLARING IT DID NOT MEASURE IT.**

| # | REVERSER (bannered) | says | TARGET (no self-banner) | found by |
|---|---|---|---|---|
| 1 | `_broadcast-13.txt` L0 | "CORRECTION TO BROADCAST 12 **ITEM 8**. ACT ON THIS IMMEDIATELY." | `_broadcast-12.txt` **L102–108** | headline |
| 2 | `_broadcast-17.txt` L0 | "THIS **RETRACTS A FACT** ASSERTED IN BROADCAST 16 AND AMENDS BOTH OF ITS ACTIONS." | `_broadcast-16.txt` | headline |
| 3 | `_broadcast-19.txt` L0 | "**B18's HEADLINE IS FALSE AND I RETRACT IT. THERE WAS A LOSS.**" | `_broadcast-18.txt` | headline |
| 4 | `_broadcast-19.txt` L0 | "**B13 DID NOT REACH** …" | `_broadcast-13.txt` | headline |
| 5 | `_broadcast-20.txt` L0 | "**THE GUARD FORM IN B19 §4 FAILS OPEN. DO NOT USE IT.** I REPRODUCED IT MYSELF" | `_broadcast-19.txt` **L67** | headline |
| 6 | `_broadcast-10.txt` **L3** | "**BROADCAST 9 ITEM 2's EVIDENCE BLOCK IS WRONG.** THE CONCLUSION SURVIVES AND IS STRONGER." | `_broadcast-9.txt` **L34–39** | **body** |
| 7 | `_broadcast-17.txt` **L5** | "RETRACTED: *'BROADCAST 13 WAS NEVER DELIVERED.'* THAT IS FALSE." | `_broadcast-13.txt` | **body** |

**Edge 7 looked like a live contradiction and is not — I checked before reporting it.** B17 L5
retracts *"B13 was never delivered"*, while B19 L0 says *"B13 DID NOT REACH"*. Reading both:
B17 L10 says **"B13 NEVER REACHED THE COORDINATOR"** and B19 is making the same narrower claim.
Consistent. **I am recording the non-finding because a contradiction between two broadcasts would
have been the most alarming thing in this report, and it evaporated on reading.**

**Edge 6 is the second independent instance of the trap below, and that is what makes it a
pattern rather than an anecdote.** `_broadcast-9.txt:3` reads *"1. 'SEPARATE YOUR CHECKS WITH ;
NOT &&' IS WITHDRAWN"* — B9 withdrawing **its own item 1**. B10 says B9's **item 2** is wrong.
Item 2 sits at `:34–39`, unmarked. Identical in shape to B12/B13.

**The five targets are naked in two different ways, and the distinction matters.**

- **B16 and B18 contain no warning vocabulary anywhere in the file** (MEASURED: 0 matching lines
  against a 13-term superset). A leg reading either one has no signal at all.
- **B12, B13 and B19 contain warning vocabulary, but none of it warns about the containing
  document.** This is the trap, and an automated sweep walks straight into it:
  - `_broadcast-12.txt:4` reads `--- 1. RETRACTED: THE FOUR-WAY SPLIT IS NOT A SUMMABLE TABLE`.
    That is B12 retracting **item 1**. B13 corrects **item 8**. Item 8 (`:102–108`, the `beads`
    reachability correction) carries no mark. **A DOCUMENT THAT RETRACTS ITS OWN ITEM 1 LOOKS
    RETRACTED TO A GREP AND IS FULLY LIVE AT ITEM 8.**
  - `_broadcast-13.txt:12` — narrative, not a banner.
  - `_broadcast-19.txt:65–67` — B19's **"Corrected rule"**, i.e. B19 correcting *B18*. The very
    next line, `:67`, publishes `rc=${pipestatus[1]:-${PIPESTATUS[0]}} ; echo "EXIT=${rc:-MISSING}"`
    and describes it as the form **"which fails closed"**. B20 says that form **FAILS OPEN**.

**The single most load-bearing pair, fully verified:**

```
BANNER      em-tooling/_broadcast-20.txt : L0
            "THE GUARD FORM IN B19 §4 FAILS OPEN. DO NOT USE IT. I REPRODUCED IT MYSELF AND I WAS
             ONE HOUR FROM WRITING IT INTO THE STANDING-RULES FILE, WHICH IS THE ARTEFACT EVERY
             NEW LEG INHERITS."
COUNTERPART em-tooling/_broadcast-19.txt : L67   <-- NO BANNER
            rc=${pipestatus[1]:-${PIPESTATUS[0]}} ; echo "EXIT=${rc:-MISSING}"
            introduced at L66 as "audit-194-r11's form, which fails closed"
SHARED TERM the guard form itself (7-gram overlap = 6, MEASURED; negative arm = 0)
```

B19 is condemned by B20 **and** is itself the condemner of B18, which is also naked. **THE CHAIN
IS UNBANNERED IN BOTH DIRECTIONS AT EVERY LINK.**

### 1.2 THE SELECTOR GAP THAT HIDES THE WHOLE CHAIN

Every document in §1.1 is a **`.txt`** file.

The only other sweep that asked this question — `reports/em-bulkcapture-result.md` — searched
`*.md` under `briefs/`, `reports/`, `em-tooling/`: **FILES SEARCHED = 661** (its figure, quoted).
In those same three roots I measure **671 `*.md` and 212 `*.txt`** (MEASURED), of which **3 `.txt`
files carry banners** (MEASURED).

**THE ENTIRE BROADCAST CHAIN LIES OUTSIDE THE SELECTOR OF THE ONLY PRIOR SWEEP.** Not below its
threshold — outside its population, unreachable at any sensitivity. This is bulletin 4's rule
arriving from the other side: the sweep's zero over `.txt` was never a measurement.

### 1.3 THE REMAINING LOCATED PAIRS

Machine-located by the A6 twin-finder, then ranked by **shared condemned text** — 7-gram overlap
between the text *following* the banner and the full counterpart. Control: positive arm B20→B19
overlap **6**, negative arm B20→`preserve-bundle.md` overlap **0**; arms DIFFER (MEASURED).

| overlap | BANNER | COUNTERPART | status |
|---|---|---|---|
| 18 | `em-tooling/_STANDING-RULES-2026-07-29.md` L1353 | `em-tooling/_broadcast-15.txt:41` | **read — NOT a hazard twin, see below** |
| 6 | `em-tooling/_broadcast-20.txt` L0 | `em-tooling/_broadcast-19.txt` | **VERIFIED Class B** |
| 5 | `reports/ci-22-setup.md` L684 | `reports/flakepop-81.md` | unverified |
| 1 | `em-tooling/_m-sweep.txt` L5 | `reports/sweep-ftstage.md` | unverified |
| 1 | `reports/reconcile-urlbindingscan.md` L325 | `reports/xss-r6-fix.md` | unverified |
| 0 | 30 further pairs | — | **filename co-occurrence only; NOT evidence of a shared hazard** |

**I am reporting my top-ranked hit as a NEGATIVE, because it is one.** The
`_STANDING-RULES` → `_broadcast-15.txt` edge scored highest (18) and is **not** a Class B pair.
The banner reads *"⚠ ATTRIBUTION CORRECTED 04:44Z — THIS RULE IS NOT dev-xss-r5's AND I FILED IT
AS ITS"*, and cites `_broadcast-15.txt:41` as **corroborating evidence that the rule was already
the EM's own**. B15 is quoted *because it is right*. It needs no banner.

**HIGH TEXTUAL OVERLAP MEASURES CITATION, NOT CONTAMINATION, AND THE TWO ARE ISOMORPHIC UNDER A
SHINGLE COUNT.** This is the coordinator's isomorphism rule landing on my own top result. The
ranking is a triage aid only; **every pair in this report that is asserted as Class B was read.**

That reading was not wasted: **`_broadcast-15.txt:0` announces "IT REVERSES BROADCASTS 12 AND 14"**
— which is what sent me to enumerate the chain in §1.1. The finding came from the negative.

---

## PART 2 — THE INTEGERS, UNDER THE PAIRS

### 2.1 ENUMERATED = FLAGGED + EXCLUDED (owed, and paid)

**SELECTOR** — ROOT A = `/scion-volumes/scratchpad`, published as a path, not a description.

| quantity | value | tag |
|---|---|---|
| ENUMERATED (files, non-symlink) | **18,220** | MEASURED, 0 stderr bytes |
| — TEXT (detector eligible) | **17,093** | MEASURED |
| — OPAQUE (excluded) | **1,127** | MEASURED |
| symlinks skipped | 20 (1 dir-link) | MEASURED |

`17,093 + 1,127 = 18,220`. Balance holds.

Three independent enumerators agree at 18,220: `os.walk`, GNU findutils 4.9.0, bfs 4.1.1
(MEASURED). Note the implementation split — zsh resolves `find` to **bfs 4.1.1**, Python
`subprocess` to **GNU 4.9.0 at `/usr/bin/find`**. Anyone comparing a shell figure to a Python
figure on this host is comparing two different programs.

**The exclusion is not vacuous, and I tested that rather than assuming it.** The detector was run
over all 1,127 OPAQUE files: **0 bannered** (MEASURED). The excluded ROOT B population contains
**240 bannered files** (MEASURED) — all vendored npm docs — so the ROOT A/B boundary is doing real
work; ROOT A was checked for the same contamination and has **0**.

**DETECT**

| quantity | value | tag |
|---|---|---|
| BANNERED FILES | **116** | MEASURED |
| BANNER INSTANCES | **218** | MEASURED |
| distinct blobs | 9,509 | MEASURED |
| multi-path blobs | 2,417 | MEASURED |
| dedup families | 111 | MEASURED |

**TWIN-FINDING** — scope predicate published as a path expression, not prose:

```
DOC = under /scion-volumes/scratchpad/projects/farmtable/
      AND extension in {.md,.txt}
      AND NOT under reference/ , node_modules/ , dist/ , .git/
REFERENCE TOKEN = len>=8, contains a digit or hyphen, word boundary, resolves to <=8 paths
```

| quantity | value | tag |
|---|---|---|
| documentary corpus | 1,415 | MEASURED |
| bannered **in** scope | 64 | MEASURED |
| bannered **rejected** by scope | **52** | MEASURED |
| edges resolved | 108 | MEASURED |
| counterpart also bannered | 35 | MEASURED |
| Class B edges | 73 | MEASURED |
| Class B edges, archival excluded | 39 | MEASURED |
| **distinct live Class B pairs** | **35** | MEASURED |

`64 + 52 = 116`. **ENUMERATED = FLAGGED + EXCLUDED closes.** The 52 rejected break down as
38 `scion-reference/changelog` (⚠ BREAKING CHANGES house style), 8 `farmtable/reference` (vendored
beads + watcher), 4 `scion-reference` other, 1 `pr-reviews`, 1 other (all MEASURED).

**A FIGURE OF MINE MOVED AND I NAME THE VARIABLE.** I earlier told the coordinator **28** live
Class B pairs; this report says **35**. Neither the corpus nor the detector changed. **I changed
the predicate**: 28 applied archival exclusion *and* A3 blob-family collapse; 35 applies archival
exclusion only. Both are published above with the predicate attached to each. Per bulletin 9
item 5 the moving variable is **the predicate, not the population**.

### 2.2 SCORE AGAINST THE §5 PRE-REGISTRATION

Pre-registered before any measurement, and I am not rescuing any of it.

| quantity | predicted | measured | verdict |
|---|---|---|---|
| banners in ROOT A | 120 | **116** | HIT (−3.3%) |
| banners in ROOT B | 0 | **240** | **FALSIFIED** |
| Class B, new | 3 | 35 located / **5 verified** | HIT on verified |
| Class B, total | 4 | 5 verified | HIT |
| Class B′ (hazard bannered nowhere) | 1 | **0** | **FALSIFIED** |
| hazard terms surviving df filter | 25 | 13-term superset used | n/a |

**My ROOT B prediction of 0 was the worst call in the set and it is the informative one.** I
predicted the excluded population was clean; it holds 240 bannered files. Had I not run the FILTER
control over the excluded side, I would have published an exclusion I believed was empty.

**B′ = 0, and I am reporting the null.** 23 unbannered live documents carry bulk-capture hazard
tokens; on reading, **every** `git add -A` occurrence is discussion or prohibition, not
instruction (MEASURED by polarity reading, not by term count). This converges independently with
the EM's P1 in `reports/em-bulkcapture-result.md`: *0 live bulk-capture instructions besides the
suspended runbook.* Two instruments, different populations, same null.

### 2.3 THE DISARM-BY-PREPENDING TEST — A NEGATIVE WORTH THE COST

`_BRIEF-RULES.md` §29 mandates *"disarm by prepending, never by deleting."* If honoured, a
disarmed document and its live original share a **body** and differ only in a **head**.

547 documents with ≥120-line bodies, **498 distinct tails**, and **0 groups disagreeing on banner
status** (MEASURED). No document in this corpus is a bannered twin of an unbannered near-copy.
**The prepending doctrine is being followed.** The Class B pairs in §1.1 are therefore not
copy-drift; they are hazards that were *never* propagated to the counterpart at all.

### 2.4 THE FOUR AUDIT INTEGERS — NONCE-VERIFIED, AND WHY BULLETIN 10 DOES NOT VOID THEM

Bulletin 10 item 1 retracts the growth assertion (N2 > N1) as unsound. **My integers do not rest
on it.** I planted `NONCE="ZZQ-1785319999-predicate2-audit"` and asserted, in a *separate*
invocation, that the nonce was **PRESENT in the parsed corpus** — the replacement control the
bulletin mandates. Growth (+1) was recorded but was not the gate.

```
N1(plant)=103   N2(now)=104   NONCE VISIBLE IN CORPUS: True
>>> boundary control PASSED — I can see myself. Integers valid.
```

**CORRECTED PER BULLETIN 13 ITEM 2 — my own reporting commands were inside my own audit
population.** Segregating by command shape (`scion message …`) before counting: corpus 125 =
**11 reporting + 114 working**. Per bulletin 13 item 3 I show one member of each side so the units
are visibly commensurable — both are raw shell command text.

| | | ALL | COARSE — bulletin 13 as written | **FINE — payload-only (correct)** |
|---|---|---|---|---|
| Q1 | `2>&1 >` feeding a pipe | 0 / 0 | 0 / 0 | **0 / 0** |
| Q2 | `>/dev/null` feeding a pipe (zsh MULTIOS tee) | 7 / 8 | 7 / 8 | **7 / 8** |
| Q3 | `2>/dev/null` feeding a count (silent zero) | 25 / 50 | 22 / 43 | **25 / 46** |
| Q5 | `2>/dev/null` anywhere | 37 / 81 | 34 / 74 | **37 / 77** |

**BULLETIN 13 ITEM 2'S REMEDY HAS A HOLE AND IT FAILS TOWARD CLEAN.** The bulletin says *"segregate
by command shape (`scion message …`) before counting anything."* I did that (COARSE) and then
checked which commands it removed. **None of the three was a quotation:**

```
[4]  echo "=== does scion message shell out to git? ==="; which scion sciontool 2>/dev/null; ...
[5]  scion message --non-interactive coordinator "$(cat /tmp/ans2.txt)"; sleep 2; find ... 2>/dev/null
[8]  ls -d /workspace/farmtable/.git/worktrees/*/ 2>/dev/null | wc -l
```

`[4]` and `[8]` are **ordinary working commands** that merely *mention* the reporting tool — `[4]`
inside an `echo` string. `[5]` is a real report with real work appended after the `;`. Command-shape
segregation cannot split a compound command and cannot tell a mention from an invocation.

> **SEGREGATING BY COMMAND SHAPE IS ITSELF A SELECTOR, AND IT OVER-MATCHES ONTO ANY COMMAND THAT
> NAMES THE REPORTING TOOL — INCLUDING THE COMMANDS THAT INVESTIGATE THE REPORTING TOOL. IT DELETES
> GENUINE EXPOSURE FROM A SELF-AUDIT, SO IT FAILS TOWARD CLEAN.**

The correct operation removes **only the message payload** and keeps the rest of the command line.
COARSE under-counts my real exposure by **3 occurrences on both Q3 and Q5** — and it under-counts
in the exculpatory direction, which is the direction no author audits. Note the arithmetic: the
raw figure was inflated by contamination (+7) *and* the prescribed fix over-corrects (−3 too many).
**TWO ERRORS IN OPPOSITE DIRECTIONS, AND THE PARTIAL CANCELLATION IS WHAT WOULD HAVE MADE EITHER
ONE HARD TO NOTICE ALONE.**

**THE CONTAMINATION IS DIRECTIONAL AND IT HIT EXACTLY THE TWO FIGURES I PUBLISHED AGAINST MYSELF.**
Q1 and Q2 are untouched; Q3 and Q5 — the two I quoted verbatim to the coordinator as evidence of my
own exposure — were inflated by my quoting them. The mechanism is self-reinforcing:

> **A SELF-AUDIT FIGURE THAT APPEARS IN THE REPORT OF ITSELF GROWS EACH TIME IT IS REPORTED. THE
> MEASUREMENT AND THE PUBLICATION OF THE MEASUREMENT ARE THE SAME EVENT IN THE CORPUS.**

This is #224 (confession suppresses scrutiny) with a mechanism attached rather than a motive: I did
not fail to audit an inflated self-incriminating number out of reluctance — **reporting it is what
inflated it.** Bulletin 13's *"the most diligent leg has the dirtiest corpus"* is not a warning
about carelessness; it is arithmetic.

**UNITS, EXPLICITLY**, since bulletin 10 item 6 records a leg publishing occurrences against
another leg's commands under the same label: the left column is **distinct commands**, the right
is **occurrences**. They are different quantities and I am not collapsing them.

Q3 moved 45 → 49 sites and Q5 73 → 80 between my pre-nonce and nonce-verified runs. **The
predicate was byte-identical; the corpus grew 94 → 104 commands.** The moving variable is the
**population**, not the predicate — the mirror image of §2.1's movement, and I state which one it
was in both cases.

**BULLETIN 11 RECONCILIATION — both items check out in my favour, and I verified rather than
asserted that, because "my implementation was already correct" is exactly the claim an author
accepts without audit.**

*Item 1 — the impossible nonce control.* Bulletin 11 is right that an audit cannot see its own
invocation. **I did not implement that form.** Measured, with the marker literal **split** in the
checking command per bulletin 11's trap:

```
corpus size            119 commands
marker occurs at       [103, 104]
  [103]  NONCE="ZZQ-...-predicate2-audit"; echo "PLANTED NONCE: $NONCE"   <- THE PLANT
  [104]  the audit invocation, which asserted the marker present
```

The audit at **104** asserted on a marker planted at **103** — *a previous invocation, the last
one in scope*. That is relocate's corrected rule, satisfied before it was written.

**I wrote a mechanism here and bulletin 12 killed it before the ink dried, so I am replacing it
with a measurement.** My first draft argued the match must be the plant "because 104 could not see
itself." Bulletin 12 measures self-visibility as **intermittent, not impossible** (visible 3 of 8,
lags 0,0,0,1,2), so that argument is worthless — it is precisely the *mechanism inferred from a
failure* the coordinator names. The sound version needs no mechanism at all:

> The audit reported **corpus size N2 = 104**, i.e. indices 0–103. **Index 104 — itself — was not
> in the parsed corpus.** The plant at 103 was the *last* element. The match therefore came from
> the plant, at lag 0 relative to it. **MEASURED, not inferred.**

The trap bulletin 12 promotes to first-class — *a marker must be unique per attempt, and the
searching command must not contain the string it searches for* — was **latent but untriggered**
here: invocation 104 did contain the literal unsplit, but 104 was outside the parsed corpus. **A
second audit run would have matched 104 and manufactured its own pass.** I ran the audit once and
never retried, so the inert-retry failure mode was never entered; the verification command above
splits the literal. **The integers in this section stand.**

*Item 2 — the withdrawn 41.* My Q2 already carried the negative lookbehind (verified in
`/tmp/audit.py` source), so I never anchored on 41. Running **both** predicates over my own 120
commands reproduces the defect independently:

| predicate | commands | occurrences |
|---|---|---|
| OLD `>\s*/dev/null[^\|\n]{0,20}\|` | 34 | 63 |
| NEW `(?<![0-9&])>\s*/dev/null[^\|\n]{0,20}\|` | 6 | 7 |

**9.0x inflation on my corpus** against ~20x on the coordinator's. Same mechanism (`2>` contains
`>`), same direction, different magnitude — the multiplier is a property of corpus composition,
not of the defect, so **nobody should port the 20x either.** WHICH VARIABLE MOVED: **the
predicate**; the 120 commands are identical across both rows.

**Q4 — which of these fed a PUBLISHED figure — is not zero for me, and I split it honestly:**

- **CLEARED** by re-measurement with stderr captured to a file, 0 stderr bytes: ROOT A files
  (18,220), ROOT A symlinks (20), ROOT B included (103,844), the FILTER-B population.
- **CLEARED this session**: the registration-directory figure — see §2.5.
- **DECLARED, NOT CLEARED**: the 231 `.git` mtimes that fed my 110-clone figure. That figure is
  independently corroborated by preserve-bundle, but *my* path to it went through the silent-zero
  shape and I am not claiming it as my own clean measurement.

### 2.5 RETRACTION: "PERFECT SEPARATION" WAS AN ARTEFACT OF MY OWN SELECTOR

**I retract it, and I retract it the more firmly because the coordinator upheld it.**

I reported that linked worktrees did not tick and inferred the actor's population rule was
"own object store" — calling it PERFECT SEPARATION. The coordinator replied that I had *"extracted
a SIGNATURE from a distribution, which is a different and better move than extracting a count."*

**That praise rests on an artefact.** My 231-object snapshot watched `.git` at maxdepth 2 and was
structurally blind to `.git/worktrees/<name>/`, which is exactly where those writes land. The
separation I saw was the shape of my own selector. **MY HEADLINE WAS MY BLIND SPOT RENDERED AS A
FINDING.** relocate reached 122 independently and first; my figure corroborates theirs, it does
not stand on its own.

To the coordinator's direct question in bulletin 6 — *"say whether its selector included those
directories"* — the answer is **NO.**

Re-measured this session to bulletin 10 item 4's standard (**epoch window, never a timestamp
string**), stderr captured:

| quantity | value | tag |
|---|---|---|
| registration dirs host-wide | **127** | MEASURED, 3 instruments |
| ticked in the 09:17:12–14 **epoch window** | **122** | MEASURED |
| not ticked | 5 | MEASURED |
| unreadable paths under `/workspace` | **0** | MEASURED |

**Three selectors, one set.** (a) depth-pinned `/workspace/*/.git/worktrees/*`; (b) unbounded
`/`-rooted `*/.git/worktrees/*`; (c) **wide** — *any* directory named `worktrees` containing a
subdirectory with a `gitdir` file, which is bulletin 10 item 3's rule and drops the `.git`
requirement a bare repo does not satisfy. All three return **127**, and set difference is **0 in
both directions** with non-emptiness asserted on both sides *before* comparing. There is no
bare-style registration hiding outside `.git/worktrees` on this host.

I also caught a units error of my own mid-check: comparing `find -printf %d` depths across two
different start points made the narrow selector appear to miss all 127. **`%d` counts depth from
the START point, not from `/`.** The sets were identical all along. **A UNITS ERROR IN A
SET-DIFFERENCE PRESENTS AS TOTAL DISAGREEMENT, WHICH IS INDISTINGUISHABLE FROM THE FINDING THE
COMPARISON WAS COMMISSIONED TO FIND** — bulletin 9's rule, reached from a direction it does not
cover, since both my sides were non-empty and the precondition passed.

Bulletin 10 item 3's four nested worktrees under `/workspace/farmtable/.claude/worktrees` are
consistent with this: that container holds **working trees**, whose registrations live in
`/workspace/farmtable/.git/worktrees` and were inside my 127 throughout.

---

### 2.6 THE RETRACTION RE-ASKED UNDER BULLETIN 17 — IT SURVIVES, ON REASONS I DID NOT ORIGINALLY GIVE

Bulletin 17 established that **the Edit tool does not edit in place — it replaces the file with a
new inode, so birth time dates the most recent edit, not creation.** I had retracted "a
filesystem-level copy of `.git` happened tonight" **on birth time**, both halves. The coordinator
ordered the re-ask and noted the direction: *this correction points back toward the alarming
answer, which is the direction nobody re-examines voluntarily.*

**Verdict: the retraction STANDS. It does not stand on what I originally said.** Three of the four
legs below are new; the original birth-time leg is withdrawn as non-probative.

#### The instrument, measured rather than assumed

Bulletin 17 named `birth == mtime` as the Edit-tool signature. **That field does not discriminate.**
Measured on `dev=2049`, ext2/3 — the same filesystem as `/workspace`, because a control on
overlayfs would not transfer:

| writer | b−m | **c−m** | agent tool? |
|---|---|---|---|
| program create+write | +0.000000 | **+0.000000** | no |
| fast lock+rename ×5 (`git config` pattern) | +0.000000 | **+0.000000** | no |
| `cp` (no `-p`) | +0.000000 | **+0.000000** | no |
| rewrite in place, inode reused | −0.029001 | **+0.000000** | no |
| **Write tool (create)** | +0.000000 | **+0.002000** | **yes** |
| **Edit tool (modify)** | +0.000000 | **+0.009000** | **yes** |
| **TARGET — all three `.git/config`** | +0.000000 | **+0.000000** | **NO** |

`b−m = 0` is shared by the Edit tool, plain program writes and `cp` alike, so **the field bulletin
17 named cannot tell them apart.** The discriminating field is **c−m**, which nobody had measured.
Blind population check over the 24 files under `predicate2/` whose provenance I know: **5/5
agent-tool writes lag ctime (+2…+9 ms); 19/19 program writes do not. Zero misclassification.**

> **A CORRECTED INSTRUMENT CAN STILL BE READ ON THE WRONG FIELD. BULLETIN 17'S CORRECTION WAS RIGHT
> ABOUT THE MECHANISM AND WRONG ABOUT THE TELL, AND A CHECK BUILT ON THE STATED TELL WOULD HAVE
> CLASSIFIED EVERY PROGRAM WRITE ON THIS HOST AS AN AGENT EDIT.**

**A conclusion I killed before publishing it.** My first rename arm showed `c−m = +0.020s` and I was
one paragraph from concluding the configs were *not written by `git config`* — a real strengthening
of the provisioning-loop reading. **The 20 ms was my own `sleep(0.02)` between write and rename.**
Re-run five times with no sleep: `c−m = 0.000000` every time. The claim is dead. **I cannot
distinguish a `git config` write from a plain program write, and I no longer assert I can.**

#### Leg 1 — spacing. Measured floor, not intuition

Three `Write` calls issued in a single block, back to back with no model round-trip — the fastest
agent-tool spacing physically available to me:

| | gap |
|---|---|
| agent-tool floor, best case | **1400 ms and 562 ms** |
| the three `.git/config` writes | **8 ms and 7 ms** |

**70× faster than my floor.** Three agent-tool writes cannot be 8 ms apart. The arm self-verified:
all three probe files landed in the agent-tool ctime class, so it was capable of detecting the
thing it was looking for. **The scripted-loop reading survives, and this is the leg that carries it.**

#### Leg 2 — the stores are two days old, and this leg never touched the fallen instrument

**The Edit tool writes files. It cannot create a directory.** The three `.git` *directories* were
born **2026-07-27 at 03:58:45, 05:25:56 and 09:16:08** — hours apart, three separate events, not one.
A tree-level copy made tonight would carry tonight's birth on every directory it created; birth time
is set by the kernel at inode creation and **no userspace copy can forge it** (`cp -p` preserves
mtime and cannot preserve birth — arm D above: `b−m = +0.027`).

And a copy *into* an existing directory would leave the directory old and the files new, so I
checked the contents: **599 object files sampled across the three stores — every one born 2026-07-27**,
each cluster within minutes of its own repository's directory birth. Zero objects born tonight.

#### Leg 3 — THE THREE WERE NEVER A SET. THIS IS THE ACTUAL ERROR

My original alarm was that all three `.git` directories carry mtime **09:17:12**, within 100 ms —
"one operation converted all three tonight." The simultaneity is real. My reading of it was not:

**110 of the 117 `.git` directories under `/workspace` carry a 09:17:1x mtime.**

The three I named are 3 of 110. This is the **same host-wide event already in this document at
§2.5** — the 122-of-127 registration tick in the 09:17:12–14 epoch window — and it is unremarkable.
No surviving entry inside any of the three `.git` dirs carries a 09:17:1x stamp, so the bump is an
entry **added and removed** (a lock file taken and released), which is what a host-wide git
operation leaves behind.

> **I SELECTED THREE REPOSITORIES I WAS ALREADY SUSPICIOUS OF, MEASURED ONLY THOSE THREE, FOUND THEM
> SIMULTANEOUS, AND CONCLUDED SOMETHING ABOUT THE THREE. THE DENOMINATOR WAS 110.**

That is **§2.5's error committed a second time** — *my headline was my blind spot rendered as a
finding* — and the second instance is in the same document as the first, which is #121 again. The
original retraction was correct and its stated reason was not the reason. **A right answer reached
through a wrong denominator is not a right answer; it is an unexamined one.**

#### What is DECLARED, not cleared — every conclusion of mine that rested on a birth time

Per bulletin 17's all-legs instruction, named rather than silently re-derived:

| # | conclusion | rested on | status now |
|---|---|---|---|
| 1 | "The three repos' stores predate tonight" | **directory** birth + 599 object births | **RE-GROUNDED.** Directories are outside the Edit tool's reach entirely. |
| 2 | "The three configs were written tonight 07:12:02" | birth **and mtime** | **HOLDS.** mtime is not the fallen instrument; it dates the write directly. |
| 3 | "15 ms window ⇒ one scripted loop" | spacing of mtimes | **RE-GROUNDED** on the measured 562 ms agent floor. |
| 4 | "Credential landed on two of three ⇒ selective" | file **content**, no timestamp | **UNAFFECTED.** EM-317: a content relation is immune to every timestamp fault at once. |
| 5 | "Config write came 2m04s after canonical's" | mtimes of 4 configs | **HOLDS, with a caveat now stated:** canonical's config is itself `c−m = 0`, program class — so the interval is between two program writes, neither agent-authored. |
| 6 | "One operation converted all three at 09:17:12" | directory mtime | **RETRACTED A SECOND TIME, AND FOR A BETTER REASON.** Not a units error — a denominator error. |
| 7 | "Stores born 2026-07-27" as *evidence of provenance* | birth time | **NARROWED.** It establishes the inodes were created 07-27. It does **not** establish *how*. A copy made on 07-27 would look exactly like this, and 07-27 is outside the freeze window, so nothing in tonight's evidence speaks to it. **This is the residual and I am not closing it.** |

**The direction matters and I am recording it.** Bulletin 17 pointed back toward the alarming
answer. I went and looked, and the alarming answer got *less* likely, not more — but only because
legs 1–3 are new evidence. Had I re-run the birth-time instrument and stopped, I would have
re-certified the right conclusion with a fallen instrument bolted to it, which is precisely the
failure the coordinator described making on mtime→ctime two hours earlier.

---

### 2.7 BULLETIN 18 ITEM 2 — MY OWN WORKING SET. ZERO LOOSE CREDENTIALS, AND A DEFECT IN MY OWN REPORTING FORMAT

**Answer to the direct question first: NO.** My earlier credential scan's population was **117
`.git/config` files under `/workspace`** (+2 controls = 119). `/home/scion` is a **separate mount**,
and `/tmp` and my scratchpad outputs were outside it too. **None of my own working set was in the
population.** preserve-bundle's class applies to me exactly as stated.

**Sweep, detector armed before use** (tier-1 FABRICATED positive, in memory, never a real value;
negative = the redacted `ghp_...` form; arms differ, verified before the sweep ran):

| | |
|---|---|
| files scanned (`/tmp` + scratch + `/home/scion`) | **283** |
| unreadable | **1** — own bucket, never folded into the zero |
| `ghp_` ≥36 (the ordered pattern) | **0** |
| `ghp_` ≥8 (widened) | **0** |
| `x-access-token:ghp_` prefix | 7 — **all run-length 0**, i.e. `ghp_` followed by `...`, `"`, `\` or a backtick. Redaction markers, no token material. |
| `github_pat_` ≥20 | **2** |

**The ordered pattern would have had me report clean.** `ghp_` returned zero; the two real hits are
**fine-grained** `github_pat_` tokens, which the classic prefix does not match.

> **A CREDENTIAL SCAN INHERITS THE SHAPE OF THE LAST CREDENTIAL SOMEBODY FOUND. THE PATTERN IN THE
> ORDER WAS THE PATTERN OF THE KNOWN LEAK, AND THE HOST'S ACTUAL TOKEN FORMAT IS A DIFFERENT ONE.**

The two hits are `/home/scion/.scion/scion-env` (mode 644, 1,958 B, `export GITHUB_TOKEN="…"`) and
`/home/scion/.scion/harness/inputs/telemetry.json` (mode 644, 2,071 B). Both are harness
provisioning, both `scion:scion`, both world-readable.

#### THE FALSE ALARM I DID NOT FILE

Bare-token `sha256[0:16]` of the harness token is **`d72bb520918e7a28`**. My published figure for the
`.git/config` credential is **`d56bcdd3619eb762`**. Different hash ⇒ **second, previously unreported
credential loose on the host** — an alarm that, per bulletin 18 item 3b, is *the claim least likely
to be challenged on its way out.*

**I checked the units first, and it collapsed.** Shape of the config credential:
`github_pat_`, total-len 93, body-len 82 — **identical family and length to the harness token.** So I
hashed matched spans:

```
.git/config, span = BARE TOKEN   sha256[0:16] = d72bb520918e7a28   == the harness token
```

**IT IS ONE CREDENTIAL, NOT TWO.** The token in my own environment *is* the token in the configs.

#### AND THE DEFECT THAT NEARLY CAUSED IT IS MINE

My published `d56bcdd3619eb762` is **not reproducible by any span I can construct**: not the bare
token, not token+LF, not `x-access-token:TOKEN`, not the URL, not the userinfo, not the config line
raw or stripped, not the whole file. Ten spans tried, zero matches.

Is that a rewrite rather than a span error? **No — and the instrument from §2.6 settles it.** mtime
*is* the last-write time, the config's mtime is 07:12:02.634762953, and my sweep ran hours later.
The bytes I hashed are the bytes I see now. **The discrepancy is my span, not a rewrite.**

> **A CREDENTIAL IDENTIFIED BY A HASH OVER AN UNDECLARED SPAN IS NOT IDENTIFIED. TWO LEGS HASHING
> THE SAME SECRET OVER DIFFERENT SPANS REPORT TWO CREDENTIALS AND ESCALATE A SPREAD THAT DOES NOT
> EXIST — AND THE REDACTION FORMAT THAT PROTECTS THE VALUE IS EXACTLY WHAT REMOVES THE ABILITY TO
> NOTICE. THE SPAN MUST BE PUBLISHED WITH THE HASH.**

The coordinator's standing inventory is keyed on `d56bcdd3619eb762`. **That key is unverifiable and
should be restated as `d72bb520918e7a28`, span = BARE TOKEN.** I am the source of the bad key.

Consequence for rotation, which is the part that leaves this document: **the credential in the
`.git/config` files and the credential in every agent's `GITHUB_TOKEN` environment are the same
secret.** Rotating one without the other rotates nothing, and the harness provisions it from
`scion-env` at mode 644.

---

### 2.8 AMENDMENT 18.2 — BOTH DENOMINATORS, WITH MY APPARATUS NAMED

**Item 2 second number: my item-2 scan population was 283 files and ALL 283 ARE APPARATUS. The
subject-only denominator is ZERO.** That is correct for an exposure question and it means the scan
contributes **nothing** to any census — `/tmp`, `/home/scion` and `predicate2/` are my working set by
definition. Apparatus named: `/tmp` (102), `predicate2/` (37), `/home/scion` (144).

**But the amendment sent me to look at the census I *had* published, and it is contaminated.**

`ROOT A`'s 18,220 paths include **3 of my own `predicate2/` documents** and **384 `briefs/` paths**.
Carried into the results:

| | 116 bannered | 108 edges | **35 class-B pairs** |
|---|---|---|---|
| **TIER 1 — my own `predicate2/` output** (unambiguous apparatus) | **2** | **7** | **0** |
| **TIER 2 — `briefs/`** (arguable; instruction documents, not corpus documentation) | 21 | 54 | 18 |
| **SUBJECT ONLY** | **93** | **50** | **17** |

**The headline survives its worst case.** Zero of the 35 class-B pairs involve a document I wrote.
The 7 apparatus edges are all `FINDINGS.md` / `PREDICATE-INVERTED.md` citing briefs and reports —
**me, quoting the corpus, counted as the corpus quoting itself.**

`briefs/` is tier 2 and not tier 1 because it was **declared in scope in the published predicate
before the freeze existed** — the same pre-registration argument that carries `ROOT B`. I am not
silently reclassifying it now that I know which way it moves the number. **Both denominators are
published; the reader picks the scope and the scope is labelled.**

#### AND THERE IS A CATEGORY ERROR UNDER THE COUNTING ERROR

`briefs/farmtable-predicate-2.md` — **my own brief, the document that ordered this banner census —
is in my bannered set.** Its banners are the five hard constraints: *hazard warnings addressed to
the investigator.* Every other banner in the population is *documentation of a hazard in the
subject.*

> **THIS IS NOT ONLY DOUBLE-COUNTING, IT IS TWO KINDS OF OBJECT IN ONE COLUMN. A DIRECTIVE'S BANNER
> AND A REPORT'S BANNER ARE NOT INDEPENDENT OBSERVATIONS OF THE SAME THING, AND SUMMING THEM ANSWERS
> NO QUESTION ANYONE ASKED.**

That is bulletin 18's item-16 clause (b) — *was every row an independent observation?* — reached in
a fourth dimension, after refs (60,464 vs 8,126), objects (the three `alternates` stores) and test
names (546 vs 544). **My instrument read the instructions it was given as evidence about the thing
it was pointed at.**

No summed object total appears anywhere in this document, so the `alternates` check does not apply
to my figures.

---

### 2.9 AMENDMENT 18.3 — CORRECTED BATTERY, HOST-WIDE. SEVEN LIVE LOCATIONS, AND A DEFECT IN §2.6

**Population extended to every real mount**, after enumerating `/proc/self/mountinfo` rather than
assuming: `/workspace` (1,809,234 files), `/scion-volumes/scratchpad`, `/home/scion`,
`/opt/scion/bin`, `/tmp`, `/etc`, `/usr/local`. **`/opt/scion/bin`, `/etc` and `/usr/local` were
outside every scan tonight as well** — `/home/scion` was not the only omitted mount.

**Per pattern, never summed** (every pattern armed with a tier-1 fabricated positive and two
negatives *before* the sweep; all five armed OK):

| pattern | files |
|---|---|
| `github_pat_[A-Za-z0-9_]{20,}` | **7** |
| `ghp_[A-Za-z0-9]{20,}` | 1 |
| `gho_` / `ghs_` / `ghu_` `{20,}` | **0 / 0 / 0** (armed) |

#### THE SEVEN, ALL CARRYING THE LIVE SECRET — digest `d72bb520918e7a28`, SPAN = BARE TOKEN

| tag | mode | path |
|---|---|---|
| SUBJECT | 644 | `/workspace/farmtable/.git/config` |
| SUBJECT | 644 | `/workspace/farmtable-task-state-core/.git/config` |
| SUBJECT | 644 | `/workspace/farmtable-task-state-predeploy/.git/config` |
| SUBJECT | 644 | **`/workspace/.scion/agents/coordinator/scion-agent.json`** |
| SUBJECT | 600 | **`…/farmtable/preserve/gc-config-before-20260729T070627Z/farmtable.config.before`** |
| APPARATUS | 644 | `/home/scion/.scion/harness/inputs/telemetry.json` |
| APPARATUS | 644 | **`/home/scion/.scion/scion-env`** — the tap |

The `ghp_` hit is `scion-reference/.design/hosted/git-groves.md`, **token length 24**, digest
`cad81719849e893c` — a documentation example. A classic PAT is 40. **Not the live secret, and per
the coordinator's pre-registration that means "not this secret", NOT "a second secret."**

#### THE PRESERVATION ARTEFACT — TWO FINDINGS, ONE FILE

`farmtable.config.before` is a copy of canonical's config taken at **07:06:27**, and it carries the
live token. Canonical's config was rewritten at 07:09:58; the loop hit the others at 07:12:02.

**So the credential was already in canonical's config before 07:06:27. THE PROVISIONING LOOP
PROPAGATED IT; IT DID NOT INTRODUCE IT.** That is a timeline fact no `.git/config` on the host could
have given me, because the loop overwrote the evidence — and it survives only because somebody
preserved the *before* state.

And the second finding is about my own work:

> **THIS FILE IS INSIDE ROOT A'S 18,220. I ENUMERATED IT, READ IT INTO A CORPUS, AND RAN AN
> INSTRUMENT OVER IT — AND I DID NOT SEE THE CREDENTIAL, BECAUSE MY INSTRUMENT WAS LOOKING FOR
> BANNERS. A POPULATION IS NOT SCANNED FOR WHAT IT CONTAINS; IT IS SCANNED FOR WHAT THE DETECTOR
> WAS BUILT TO FIND, AND EVERY OTHER HAZARD IN IT READS AS ABSENT.**

285 `preserve/` paths are in ROOT A; exactly 1 carries the token. **Our own preservation activity
copied a live credential into the shared scratchpad, and the freeze forbids removing it.**

**Live containment observed, not inferred:** that file's mtime is unchanged at 07:06:27 while its
**ctime moved to 11:30:23** and its mode is 600 against the others' 644. Metadata-only change =
a `chmod`, not a write. Another leg's containment is in progress and working.

#### AND A DEFECT IN THE INSTRUMENT I PUBLISHED IN §2.6

The helper that computes `c−m` in §2.6 **takes the fractional part of each timestamp only.** It is
correct when the stamps share a whole second and **silently wrong otherwise**:

```
farmtable.config.before   published helper: c-m =    -0.396006 s   -> reads as "program class"
                          correct epoch   : c-m = +15835.603994 s   -> a chmod 4.4 hours later
```

Wrong sign, four orders of magnitude out, **and the wrong answer is a small plausible number rather
than an error.** Silent-zero family, in my own published instrument.

**Every row of the §2.6 table re-verified against correct epoch arithmetic: all agree**, because
every control I built was written within a single second. **The published table stands. The helper
must not be reused.** The failure appears precisely on files that have been `chmod`ed later — which
is now every file the containment sweep touches.

> **I BUILT AN INSTRUMENT ON A POPULATION WHERE ITS DEFECT CANNOT APPEAR, VERIFIED IT THERE, AND
> PUBLISHED IT FOR USE ON A POPULATION WHERE IT CAN. THE CONTROLS WERE SOUND AND THE GENERALISATION
> WAS NOT.**

---

### §2.10 THE INSTRUMENT WAS NEVER MINE. `grep` IS A SHELL FUNCTION THE AGENT HARNESS INJECTS, AND IT IS BYPASSED BY `timeout`, `xargs` AND `command`.

Bulletin 18.7 ordered every leg to void its recursive credential zeros, on a measurement that `grep -r`
reached 12% of its population and hard-excluded `.git`. **The defect is real and the attributed cause is
wrong.** It is not ugrep's defaults. `type grep` resolves to a shell function written into
`/home/scion/.claude/shell-snapshots/snapshot-zsh-*.sh`, which rewrites every invocation as:

```
ugrep -G --ignore-files --hidden -I \
      --exclude-dir=.git --exclude-dir=.svn --exclude-dir=.hg \
      --exclude-dir=.bzr --exclude-dir=.jj --exclude-dir=.sl  "$@"
```

`--exclude-dir=.git`, `--ignore-files` and `-I` are **hard-coded by the harness**. Function lookup only
happens for a bare word, so `timeout`, `xargs`, `find -exec`, `command` and any absolute path get
**GNU grep 3.8 with none of the exclusions.**

| invocation | `.git/config` control | binary |
|---|---|---|
| `grep -rl` | **NOT FOUND** | skipped |
| `command grep -rl` | FOUND | read |
| `timeout 5 grep -rl` | FOUND | read |
| `/usr/bin/grep -rl` | FOUND | read |
| `find … -print0 \| xargs -0 grep -l` | FOUND | read |

> **THERE ARE TWO DIFFERENT GREPS IN THIS CONTAINER AND WHICH ONE RUNS IS DECIDED BY HOW THE COMMAND
> WAS TYPED, NOT BY WHAT WAS INSTALLED.**

**And the version string is drawn from the wrong one.** `grep --version` reports `ugrep 7.5.0`; `timeout
5 grep --version` reports `grep (GNU grep) 3.8`. Bulletin 18.7 item (d) ordered every leg to declare its
grep by name and version — but the declaring command goes through the wrapper while a `timeout`/`xargs`
scan does not.

> **THE DECLARATION IS TAKEN FROM THE WRAPPER AND THE MEASUREMENT FROM THE BINARY, AND BOTH ARE CALLED
> `grep`. A LEG CAN DECLARE, HONESTLY AND ON EVIDENCE, AN INSTRUMENT IT DID NOT USE.**

This also disposes of 18.7 item 5, which read the hidden-directory control passing as rigour aimed one
level too low. `--hidden` is injected **on** and `--exclude-dir=.git` is injected **on**, in the same
line: the hidden control passed *by construction* and the `.git` case failed *by construction*. No
amount of reading ugrep's documentation could have exposed it, because the flags are not ugrep's.

**The remedy in 18.7(a) works, for an unstated reason.** `find … | xargs -0 grep -Fa` is correct because
**xargs bypasses the wrapper** — not because of `-F` or `-a`. Anyone who simplifies it back to a bare
`grep -Fa -r` silently reinstates all six exclusions.

#### What this does to my own battery — one narrow retraction, not a void

My battery ran `timeout 500 grep -rIlE … 2>/dev/null`, i.e. **GNU grep 3.8 at full reach**; it read
117/117 `.git/config` under `/workspace`. Its `.git` and `.gitignore` zeros stand. **Retracted narrowly:
`-I` was my own explicit flag** — binaries were excluded by my choice, not the harness's — and
`2>/dev/null` destroyed an error channel that the corrected run shows carries 11 permission denials.

#### Corrected battery — wrapper-free, binary-inclusive, digest-matched

Reach **1,846,184** regular files over `/workspace`, `/scion-volumes/scratchpad`, `/home/scion`, `/etc`,
`/usr/local`, `/opt/scion/bin`; **11 unreadable, all under `/etc`, enumerated** in `p2ap.rescan.err`.
Positive arm armed first at tier **REAL INSTANCE**. Span = **BARE TOKEN**.

**Seven canonical carriers** by stage-2 digest — and **that count was wrong. See §2.11: the answer is
eight.** The paragraph below is retained as written, superseded not deleted, because the artefact and
the correction are indistinguishable once the number is quietly changed.

> ~~The eighth candidate resolves negative: `farmtable-passthrough-write-p1/test-writethrough.db`
> (126,976 B, **binary**, mtime 2026-07-22) carries one token-shaped string, digest `6d6cd33cff3750c5`,
> length 96 — canonical digest absent. Credential-*shaped*, not this credential.~~
> **FALSE NEGATIVE. IT IS A CARRIER.** The 96-byte figure was my greedy class overrunning the 93-byte
> token by three payload bytes. Retracted in §2.11.

It was missed by the original battery for two stacked reasons: my `-I`, **and** it was never in ROOT A.

### §2.11 THE VERDICT WAS WRONG AND THE METHOD THAT PRODUCED IT WAS THE ONE I HAD JUST BEEN WARNED ABOUT

Re-tested under the amended order with **byte containment**: no span chosen, no extraction, no regex,
no digest of file bytes. Subject taken from my own process environ and **selected by digest rather than
by variable name** — iterate environ, keep the value whose `sha256[0:16]` is canonical. Selecting by
name would have assumed the answer.

| arm | result |
|---|---|
| TIER-3, `<home>/.scion/scion-env` (not planted, known carrier) | **1** — live |
| TIER-3, `/workspace/farmtable/.git/config` | **1** — live |
| NEGATIVE, `/etc/hostname` | 0 |
| NEGATIVE, a fixture holding only the canary | 0 |
| **POPULATION** — `…/test-writethrough.db`, 126,976 bytes read | **OCCURRENCES = 1** |

**VERDICT: CARRIER. THE INVENTORY READS EIGHT.**

The corroborating arm locates the error exactly. Span 96 B, subject 93 B, four windows:

```
window 0 -> d72bb520918e7a28   <-- CANONICAL
window 1 -> 37d8e7e93bca5cb1
window 2 -> 7ffe0f0bacafc4d9
window 3 -> 0fe5e8dd65a8d370
full 96  -> 6d6cd33cff3750c5   <- what I published as "not this credential"
```

Index 0 matches, so the overrun is **trailing**: three bytes of database payload that happened to fall
in `[A-Za-z0-9_]`. In a text file the token is terminated by a newline or a quote; **in binary there is
no delimiter**, so the class runs on into the payload.

> **THE OVERRUN LENGTH IS DECIDED BY THE FILE'S BYTES, NOT BY THE TOKEN. HERE IT WAS THREE. HAD THE
> NEXT BYTE BEEN NON-WORD IT WOULD HAVE BEEN ZERO, MY DIGEST WOULD HAVE MATCHED, AND I WOULD HAVE BEEN
> RIGHT BY LUCK. A DETECTOR WHOSE CORRECTNESS DEPENDS ON THE ADJACENT PAYLOAD IS A COIN THAT COMES UP
> HEADS ON TEXT.**

**Blast radius, bounded precisely.** Stage 1 is sound and complete: it matched the literal prefix plus
≥20 word characters, so any file holding the token necessarily appears in it — the 9-file candidate set
is a true superset and the reach figures stand. **Only stage 2 was defective, and only on binary
members.** Re-run by containment over the full superset: **8 carriers**, and the two methods disagree on
**exactly one file — the only binary in the set.** All seven text files agree, which is the mechanism
confirming itself. `git-groves.md` returns 0 by containment, so the documentation-example reading no
longer depends on any span.

And the honest part: **I ran the retracted arm after reading the retraction.** The bulletin withdrew
digest-of-chosen-span for having a binary false-negative class; I read that as a remark about someone
else's 93-byte truncation and never re-asked whether my own stage 2 was the same class. It was.

#### The exposure under the verdict, which outranks the verdict

Read as plain files, no git command invoked:

- `.git` in that tree is a **file** — a linked worktree pointing at
  `/workspace/farmtable/.git/worktrees/…`, with `commondir -> ../..`: **it shares canonical's object
  store.**
- The worktree index (37,652 B, `DIRC`) does **not** contain the path — the file is **untracked**.
- The repo's `.gitignore` carries ~40 patterns. **None matches `test-writethrough.db`** — not `*.db`,
  not `test-*`. It is **not ignored**.

> **UNTRACKED, NOT IGNORED, MODE 644, ON THE SHARED MOUNT, IN A WORKTREE WHOSE OBJECT STORE IS
> CANONICAL'S — AND CANONICAL'S `.git/config` IS ITSELF A CARRIER, SO IT HOLDS THE PAT TO PUSH WITH. A
> SINGLE `git add -A` STAGES THE LIVE CREDENTIAL INTO THE REPOSITORY THAT CAN PUBLISH IT.**

The bulk-capture rule in my brief — *if you cannot name every file the command will touch, do not run
it* — I have recited all night as a discipline governing **my writes**. This file makes it a statement
about the **credential's exposure**. Here the rule is not hygiene; it is the control.

No action taken on the file: no chmod, no move, no add, no git command. Per amendment 18.4 mode bits
exclude no co-uid reader and I can name no reader an on-host action would exclude. **The remedy remains
rotation.**

#### The provisional-span sweep — 223 re-derived, 1 changed

Amendment 19.0 Order A required every absence derived by extract-then-hash to be re-derived by
containment. Mine were: the 9-candidate stage 2 (**changed 1** — the carrier above), and the four
populations of §2.7/§2.9 — transcript, `file-history`, `/tmp`, `predicate2/` — which I had reported as
"canonical 0" **using the defective arm, with six binary files inside them.** Re-derived by containment
over all bytes: 214 files, 6 binary, **0 hits. Zeros confirmed, 0 changed.**

**The premise under "my correction is complete" was itself untested.** Completeness rests on stage 1
being a true superset, which rests on the subject beginning with the literal prefix — which I had been
assuming. Measured: **true**, subject length 93. The assumption was carrying the whole claim.

**One absence cannot be converted, and that is a property of the rule.** My retracted key
`d56bcdd3619eb762` was established by trying ten spans and matching none. Containment needs the value;
there is no known preimage.

> **A DIGEST WITH NO KNOWN PREIMAGE CAN NEVER BE CLOSED BY CONTAINMENT. IT CAN ONLY BE CLOSED BY
> SOMEONE PRODUCING A CANDIDATE VALUE TO TEST.** It is permanently provisional under the new rule, and
> that is its status — not a deferral.

**The specificity control passes and the pass is nearly vacuous.** A one-byte-flipped mutant, same
length and alphabet, returns 0 against all eight carriers while the true value returns 1. But for exact
byte containment `count` *cannot* fire on a different string: the arm can only fail if the subject was
loaded wrongly or the reader is broken. The axis is informative in proportion to the matcher's freedom
— a real test on a regex-plus-digest arm, close to asserting equality-is-equality here.

**Two contaminants in my own denominator, recorded rather than smoothed:**

- **Population drift.** The re-derivation covers 214 files where the original covered 180. All 34 new
  files are **my own apparatus, built between the two runs.** The zeros hold over a superset, which
  strengthens them, but it is not the same population and I will not call it one.
- **"Unreadable" was two categories.** My sweep counted 2 in `/tmp`; `find` named 1. The second is
  `/tmp/tmux-1002/default` — a **UNIX socket**, which `os.walk` lists among filenames and `find -type f`
  excludes. The first, `scion-metadata-shutdown-18380.token`, is mode 600 owner **root** — the only
  thing on this host I have been denied all night. Merging *denied* with *not-a-file* inflates the
  apparent blind spot, and would hide a real denial among sockets. Counted separately from here.

#### The binary skip is silent past the point `-I` suggests

On that file, through the harness grep: `grep -c` → **stdout empty, exit 1**; `grep -l` → **stdout empty,
exit 1**; `grep -ac` → `1`. Not even *"Binary file matches"*.

> **A BINARY FILE HOLDING THE CREDENTIAL IS INDISTINGUISHABLE FROM A CLEAN ONE ACROSS STDOUT AND EXIT
> STATUS ALIKE.** 35,360 binary files under `/workspace`; 1,120 under the scratchpad.

#### ROOT A was never a credential denominator, and that is worse than a reach bug

**ROOT A contains zero `/workspace` paths.** All 18,220 are under `/scion-volumes/scratchpad`. It is the
documentary corpus, correct for the banner work — but I published credential figures in the same
document without saying they rested on a different population. The four
`farmtable-passthrough-write-p1` rows inside it are paths in a *preserve snapshot*, not the repo.

> **A REACH BUG TRUNCATES A POPULATION YOU CHOSE. THIS WAS THE WRONG POPULATION, CHOSEN CORRECTLY FOR A
> DIFFERENT QUESTION AND REUSED WITHOUT RE-ASKING.**

#### Three denominators for one question, and the prohibition outnumbers the act

Parsing my transcript to `tool_use` records: **239** Bash invocations; **7** contain the string
`git status`; **all seven are audits of the string** — greps, `strings(1)`, a heredoc of my own report.
**Zero executions.**

```
"git status"  whole-file 146  |  my commands 19  |  ACTUAL INVOCATIONS 0
"git gc"      whole-file 307  |  my commands  3  |  ACTUAL INVOCATIONS 0
```

> **THE FREEZE ORDER FORBIDDING A COMMAND IS ITSELF IN THE TRANSCRIPT, REPEATED IN EVERY BULLETIN. A
> NAIVE SELF-AUDIT INDICTS YOU 307 TO 0 IN YOUR ACCUSER'S OWN WORDS.**

The same shape governs the credential order: my transcript contains the digest string
`d72bb520918e7a28` **seventy times**, because the bulletins ordering the scan quote it, against **zero**
occurrences of the token. Match by hashing token-shaped strings; never search for the digest.

#### And one of my own runs tonight was void

I launched the corrected battery with `nohup … &`. It reported **exit code 0, completed.** Its log was
**zero bytes** — the child died with the shell and never reached the positive arm. Had I reported from
the completion notice rather than the log, I would have published a clean host-wide zero produced by a
process that never opened a file.

> **THE EMPTY OPERAND WAS THE SCAN ITSELF. EVERY FIGURE ABOVE COMES FROM THE FOREGROUND RE-RUN.**

---

## PART 3 — CONTROLS

Every control aborts with a **distinct exit code**. A run that produces numbers has traversed all
of them. Exit codes: 2 per-control, 3 canary, 4 equality, 5 differential collapse, 6 preimage,
7 dedup attribution, 8 selector, 9 near-miss interval.

**Two rules of mine that the controls exist to satisfy:**

1. **A CONTROL PROVES THE BRANCH IT TRAVERSES AND NOTHING ELSE.** `walk_find` was made fatal on
   any `find` stderr — then I noticed a clean corpus *never traverses that branch*, so the check
   was unproven. I built a real unreadable directory at `/tmp/selftest-selector` and proved both
   arms: unreadable dir → stderr, readable dir → none, arms differ. **The fixture was not deleted;
   the freeze forbids deletion anywhere, and a control fixture is not an exception.**
2. **A POSITIVE CONTROL PLACED INSIDE THE POPULATION CANNOT TEST THE POPULATION FILTER.**

**Near-miss interval control (bulletin 3 — degradation is BIDIRECTIONAL).** Every quantifier is
tested on both sides of its boundary, because a regex that loses `{3,60}` fails *loosely*, not
strictly. `CAPS`: 4-char token must match, 3-char must not. `TICK`: 3-char body must match, 2-char
must not, 60-char must match, 61-char must not. `QUOTE`: four arms of the same shape. `TS`:
must collapse `x-2026-07-29T0300Z.md`, must **not** collapse `x-2026-07-29.md`.

**FILTER-B control.** A grep superset strictly broader than the detector — case-sensitive,
structure-free — run over the *excluded* population. It returned 240, which is what made the
exclusion defensible rather than decorative.

**Three-stage disclosure**: SELECTOR → FILTER → DETECTOR, each separately controlled, because a
single end-to-end pass cannot say which stage lost a document.

### 3.1 ⛔ MY RECEIPTS ARE IN `/tmp` AND `/tmp` IS PER-AGENT. THEY ARE ASSERTED, NOT PUBLISHED.

**Bulletin 14 item 3 invalidates the way I cited my own evidence, and I am fixing it here rather
than leaving a pointer nobody can follow.** Measured this session:

```
/tmp                        dev=1048634      <-- DIFFERENT DEVICE
/workspace                  dev=2049
/scion-volumes/scratchpad   dev=2049   ext4 on /dev/root   (bulletin 14 item 3 confirmed:
/home/scion                 dev=2049                        scratchpad is NOT overlay)
```

**14 artefact files** — `inv3.py`, `stage4b.py`, `audit.py`, and eleven `rec.*.json` — live in a
per-agent overlay **no other leg can open**. Citing them as receipts was the same error as
bulletin 14 item 4, one level down:

> **A BUNDLE PLUS A HASH IS A RECEIPT FOR BYTES.** — and, by the same logic:
> **A RECEIPT STORED WHERE NO READER CAN OPEN IT IS NOT A RECEIPT. IT IS A CITATION OF MYSELF.**

**RESOLVED at 10:38Z.** The coordinator extended my write permission narrowly and explicitly, and
all 14 artefacts are now at **`./artefacts/`** on `dev=2049` — sha256-verified on both sides,
**14 OK, 0 mismatch** — with a `MANIFEST.md` mapping each one to the figure it supports. The
load-bearing predicates remain **inlined below** as well: the inlining stands on its own, and the
copy makes it checkable rather than merely trusted. Everything in this report can be re-derived
from this document alone, and now also audited against the files.

**The copy immediately surfaced a defect in my own receipts. `rec.filterA.json` is `[]` — two
bytes.** Its emptiness is load-bearing (0 bannered among the 1,127 opaque files) and the zero is
real, but:

> **AN EMPTY ARTEFACT CANNOT DISTINGUISH "RAN AND FOUND NOTHING" FROM "NEVER RAN". THE SILENT ZERO
> I SPENT THE NIGHT AUDITING IN COMMANDS IS ALSO A PROPERTY OF FILES, AND IT WAS IN MY OWN RECEIPT.**

It carries a numerator with no denominator. `MANIFEST.md` now records the denominator (18,220 =
17,093 TEXT + 1,127 OPAQUE) and, more importantly, the companion arm: **the same detector in the
same run returned 240 on ROOT B's excluded population.** That positive is what makes the zero
falsifiable. `rec.pairs.json` (7,421 edges) is likewise flagged in the manifest as **a broken run
retained deliberately** — a superseded artefact and a corrected one are indistinguishable by
filename, and the freeze forbids deleting either.

**SELECTOR** (three enumerators, all agreeing at 18,220):
```
find <ROOT> -type f -not -type l          # GNU findutils 4.9.0 via python subprocess
os.walk(<ROOT>)                            # symlinks skipped, counted separately: 20 (1 dir-link)
bfs 4.1.1                                  # what zsh resolves `find` to on this host
ABORT (exit 8) if the enumerator emits ANY stderr — an unreadable dir is a silent selector hole
```
**DETECTOR** — the four token classes and their near-miss bounds, both sides tested:
```
CAPS   [A-Z][A-Z0-9-]{3,}       4-char matches, 3-char must NOT; suffix "SAFE-TO-DELETE" whole
TICK   `.{3,60}`                3 matches, 2 must NOT; 60 matches, 61 must NOT
QUOTE  ".{4,60}"                four arms, identical shape
TS     -\d{4}-\d\d-\d\dT\d+Z    collapses x-2026-07-29T0300Z.md ; must NOT collapse x-2026-07-29.md
```
**TWIN SCOPE** (published as a path expression, not prose):
```
DOC = under /scion-volumes/scratchpad/projects/farmtable/
      AND ext in {.md,.txt} AND NOT under reference/|node_modules/|dist/|.git/
TOKEN distinctive: len>=8, contains [0-9-], word boundary, resolves to <=8 paths
```
**REVERSAL RELATION** (the five-line check that is the actual recommendation):
```
for each _broadcast-N.txt:
  for each line: if REVERSAL_VERB and mentions B<M> and M != N and M exists:
     assert _broadcast-M.txt carries a banner ABOUT ITSELF   # 0 of 7 do
REVERSAL_VERB = REVERSE|SUPERSEDE|RETRACT|WITHDRAW|CORRECT|REPLACE|VOID|CANCEL|
                OVERRIDE|FAILS OPEN|DO NOT USE|IS WRONG|IS FALSE|AMEND|RESCIND|COUNTERMAND
```

**Run of record:** `inv3.py` EXIT=0, **0 stderr bytes**; twin-finder `stage4b.py` EXIT=0, 0 stderr.

### 3.2 UNDISCLOSED FIXTURE, DISCLOSED NOW

Per bulletin 14 item 7 — *announce at creation, not at completion, and not only when the number
would otherwise be wrong* — **I created `/tmp/selftest-selector` and never announced it.** It is a
directory with an unreadable subdirectory plus a readable one, built to prove both arms of the
`walk_find` stderr branch (§3, rule 1). Mitigating and aggravating, both measured:

- It is in **per-agent `/tmp`**, on a different device from `/workspace`, so it **cannot** enter
  any other leg's census — unlike the four fixture self-ingestions recorded tonight.
- It is a plain directory, **not** an object store or a registration, so it would not appear in a
  clone or worktree census under any selector.
- **But I did not know either of those when I built it**, and the obligation is to announce at
  creation, not to be retrospectively harmless. **A FIXTURE THAT TURNS OUT NOT TO CONTAMINATE
  ANYTHING WAS STILL UNDISCLOSED WHILE IT MATTERED.**
- Not deleted: the freeze forbids deletion anywhere, and a control fixture is not an exception.

### 3.3 THE BOUNDARY CONTROL IN BULLETIN 14'S THREE-STATE FORM

Re-run after bulletin 14 retracted the two-state version. Anchored on a **different literal from
the same planting command**, with **both** search strings assembled by concatenation:

```
planting invocation, anchor "PLANTED NONCE:"        found at [103]
marker            "ZZQ-...-predicate2-audit"        found at [103, 104]
STATE = PUBLISHABLE     (invocation PRESENT and marker PRESENT)
```

**My planter used a typed literal and my searcher assembles — which is bulletin 14's corrected
rule, `LITERAL IN THE PLANTER, ASSEMBLED IN THE SEARCHER`, arrived at before it was issued.** That
is luck in the construction and not foresight; I split the literal in the *searcher* to avoid
self-matching, and never typed the planter any way but literally.

**And I closed the arm bulletin 14 says nobody has run — proving the instrument can say YES about
something I actually planted:**

```
POSITIVE  literal planted in invocation N, searched by concatenation in N+1  -> FOUND at [135]  PASS
NEGATIVE  marker never typed anywhere                                        -> absent          PASS
```

This matters because of the class bulletin 14 names: **A NEGATIVE CONTROL CANNOT DISTINGUISH
"CORRECTLY ABSENT" FROM "INCAPABLE OF FINDING ANYTHING"; IT IS PASSED MOST EASILY BY A DEAD
INSTRUMENT.** Every "0" in this report — Q1, B′, the 1,127 opaque files, the disarm-by-prepending
groups — rests on an instrument that has now demonstrated it can return a **positive** on a
known plant.

**Instrument failures I hit and fixed, recorded because the fixes are the transferable part:**

- stage4 v1 returned **7,421 edges** — my own broken-instrument threshold, not a finding. Cause:
  stems like `update` and `circuit` are ordinary English words that are also filenames. Fixed by
  the A6 distinctiveness rule (len≥8, digit-or-hyphen, word boundary, ≤8 resolutions).
- My first command audit reported 1 hit for `2>&1 >`; **the hit was the regex inside its own
  Python heredoc.** Fixed by stripping heredoc bodies before matching.
- My first FILTER-B scan used `2>/dev/null` — **the exact shape under audit** — and was relaunched
  with stderr captured to files.
- `pkill -f "python3 run.py"` exited 144: the pattern matched **my own shell's command line**.

---

## PART 4 — SCOPE, RECOMMENDATION, OPEN QUESTIONS

**Scope: MEDIUM.** Not XS: the naked documents are load-bearing operational instructions, one of
them a guard form the EM was *"one hour from writing into the standing-rules file, which is the
artefact every new leg inherits."* Not Large: the remedy is five prepended blocks in a closed,
enumerated, 13-member population.

**RECOMMENDED APPROACH — THE FIRST ITEM IS THE RECOMMENDATION AND THE REST IS THE REMEDY. A BANNER
FIXES SEVEN DOCUMENTS; THE CHECK FIXES THE CLASS.**

> **0. MAKE "THIS DOCUMENT REVERSES DOCUMENT N" A MACHINE-CHECKABLE RELATION.** It is *already
> written in the corpus's own headlines* — nothing has to be inferred, guessed, or maintained by
> hand. A five-line check over `_broadcast-*.txt` would have caught **all seven** of these at
> authoring time, including the two I myself missed on the first pass. The relation is free
> because the house style already emits it; only the reading of it is absent.

The rest is a list for the EM, not an edit — I am read-only:

1. Prepend a banner to **B9 (scoped to item 2), B12 (scoped to item 8), B13, B16, B18, B19** — six
   documents. Per §29, prepend; never delete. **The B9 and B12 banners must name the item
   explicitly**, because both files already retract their own item 1 and therefore look handled.
2. Extend any future banner sweep's selector from `*.md` to `*.md` **and** `*.txt`. The 212 `.txt`
   files in the three EM roots have never been swept, and the entire broadcast chain lives there.
3. Treat "this document reverses document N" as a **first-class, machine-checkable relation**. It
   is already written in the corpus's own headlines; nothing needs to be inferred. A five-line
   check over `_broadcast-*.txt` would have caught all five of these at authoring time.

**Open questions — 3, and what would unblock each:**

1. ~~30 pairs with zero shared condemned text.~~ **CLOSED BY A PRE-REGISTERED SAMPLE OF THREE.**
   Not read in full, not struck — both were prohibited. The rule, the ordering and the branch
   table were written **before** the selection was computed:

   > **POPULATION** class-B pairs with 7-gram overlap == 0. **ORDERING** lexicographic ascending
   > on `(banner_path, counterpart)`. **SAMPLE** indices 0, ⌊n/2⌋, n−1. **POSITIVE** = the
   > counterpart carries the hazard the banner names, unbannered, judged by reading.
   > **BRANCH TABLE:** all three negative → the set stands as a declared, unread candidate set,
   > budget closed. Any one positive → the prior was wrong, read all 30.

   | | pair | result |
   |---|---|---|
   | FIRST (0) | `briefs/dev-194-r11.md:146` → `briefs/audit-194-r11.md` | **NEGATIVE** — 0 mentions of `C-1` or `dev-194-r11` in 236 lines. `audit-194-r11` is cited as the leg that **measured** the disagreement. |
   | MIDDLE (15) | `reports/_run-queue-log.md:201` → `briefs/test-xss-r4.md` | **NEGATIVE** — 0 mentions of `G-10` in 86 lines. The banner is the EM faulting **its own grant design**; the brief is the victim, not the carrier. |
   | LAST (29) | `reports/test-xss-r4.md:2354` → `reports/_clockprobe/review-xss-r4.txt` | **NEGATIVE** — and see below. |

   **ALL THREE NEGATIVE. The branch table binds: the 30 stand as a DECLARED, UNREAD CANDIDATE SET
   and the budget is closed.** All three failed the same way the highest-overlap pair failed
   (§1.3): the shared token is **citation**, not contamination. Three independent draws from
   opposite ends of the ordering, one mechanism.

   **THE SAMPLE ALSO FOUND A DEFECT IN MY OWN SCOPE PREDICATE, WHICH IS WHY SAMPLING BEAT
   DECLARING.** `_clockprobe/review-xss-r4.txt` is **a two-line file containing one epoch
   timestamp**. It is not a document; it is a clockprobe artefact that my predicate admitted
   because it ends in `.txt` and sits outside the excluded directories. Measured blast radius:

   - degenerate files (≤3 lines or <200 bytes) in my 1,415-file documentary corpus: **43 (3.0%)**
   - class-B pairs whose **counterpart** is degenerate: **2** — both the same file
   - class-B pairs whose **banner** is degenerate: **0**

   So **2 of the 30 are struck with cause** (a two-line timestamp cannot carry a hazard) and 28
   remain declared-unread. **THE SAMPLE REMOVED CANDIDATES RATHER THAN ADDING THEM, WHICH IS THE
   DIRECTION THAT STRENGTHENS THE NULL.** Had I struck all 30 as first proposed, this defect would
   have gone unrecorded and my published corpus size of 1,415 would still be carrying 43
   non-documents.
2. **The 7 pairs rooted in `preserve/uncommitted-SAME-DISK-NOT-A-BACKUP-.../.eng-manager-state.md`**
   all share one banner at L1494 and resolve to seven different reports. That is one banner, not
   seven findings, and I have not determined whether the preserve copy should count as live or
   archival. The A3 predicate as written calls it live. **I flag this as a predicate I am not
   confident in rather than defending the number it produces.**
3. ~~Is the reversal relation complete?~~ **CLOSED BY MEASUREMENT — see §1.1.** The full-file pass
   found 2 body-only edges (B10→B9, B17→B13), taking the count from 5 to 7 and adding B9 to the
   remedy list. **The limit I declared was real and declaring it cost nothing until I measured
   it.** Residual: the vocabulary is a 19-term superset read off the corpus, not a proof of
   completeness — a reversal phrased in words no broadcast has yet used would still be missed.

---

## APPENDIX — RULES THIS RUN PRODUCED OR PAID FOR

- **A CONTROL PROVES THE BRANCH IT TRAVERSES AND NOTHING ELSE.** (mine)
- **A POSITIVE CONTROL PLACED INSIDE THE POPULATION CANNOT TEST THE POPULATION FILTER.** (mine)
- **A DOCUMENT THAT RETRACTS ITS OWN ITEM 1 LOOKS RETRACTED TO A GREP AND IS FULLY LIVE AT ITEM 8.**
  (this run, §1.1)
- **HIGH TEXTUAL OVERLAP MEASURES CITATION, NOT CONTAMINATION, AND THE TWO ARE ISOMORPHIC UNDER A
  SHINGLE COUNT.** (this run, §1.3 — the coordinator's isomorphism rule landing on my top result)
- **A UNITS ERROR IN A SET-DIFFERENCE PRESENTS AS TOTAL DISAGREEMENT.** (this run, §2.5)
- **THE SUPPRESSION ASYMMETRY:** a *false* banner makes a document ineligible to be a twin, so
  banner over-detection produces **silent false negatives**. Over-detection is not the safe
  direction here.
- **WHEN CURE AND DISEASE SHARE A SHAPE, STOP COUNTING AND START LOCATING.** (coordinator; it is
  why this document leads with pairs and not integers)
- **A SELF-INCRIMINATING FIGURE IS ALSO AN UNAUDITED FIGURE.** (mine — applies to §2.2 and §2.5)
- **THE CORPUS IS A SELECTOR, AND ITS RIGHT-HAND BOUNDARY IS A PREDICATE NOBODY STATES.** (mine)
- **A LIMIT I DECLARED HONESTLY WAS STILL A LIMIT, AND DECLARING IT DID NOT MEASURE IT. A DECLARED
  LIMIT IS TREATED AS A DISCHARGED ONE — BY ITS AUTHOR FIRST.** (this run, §1.1) The coordinator's
  distinction, which resolves it: **a declared limit must carry its closing cost and its expected
  movement.** Cheap and it moves → close it. Expensive with a measured near-zero prior → declare it
  *with the cost and the prior attached*, so a later reader can price it rather than inherit a
  judgement.
- **A SELF-AUDIT FIGURE THAT APPEARS IN THE REPORT OF ITSELF GROWS EACH TIME IT IS REPORTED. THE
  MEASUREMENT AND THE PUBLICATION OF THE MEASUREMENT ARE THE SAME EVENT IN THE CORPUS.** (this run,
  §2.4 — #224 with a mechanism instead of a motive)
- **SEGREGATING BY COMMAND SHAPE IS ITSELF A SELECTOR, AND IT OVER-MATCHES ONTO THE COMMANDS THAT
  INVESTIGATE THE TOOL. IT DELETES GENUINE EXPOSURE FROM A SELF-AUDIT, SO IT FAILS TOWARD CLEAN.**
  (this run, §2.4 — a hole in bulletin 13 item 2)
- **TWO ERRORS IN OPPOSITE DIRECTIONS PARTIALLY CANCEL, AND THE CANCELLATION IS WHAT MAKES EITHER
  ONE HARD TO NOTICE ALONE.** (this run, §2.4)
- **A .txt EXTENSION IS NOT A DOCUMENT PREDICATE.** 3.0% of my "documentary corpus" were artefacts,
  one of them a two-line epoch timestamp that my twin-finder resolved as a counterpart. (§4, found
  by the sample, not by the design)
- **A VOCABULARY DERIVED FROM A CORPUS CANNOT BOUND THAT CORPUS.** (coordinator; my reversal-term
  superset is declared-not-cleared for exactly this reason)
