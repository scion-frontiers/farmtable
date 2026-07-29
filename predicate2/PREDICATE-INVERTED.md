# PREDICATE-INVERTED.md — the banner-with-missing-twin sweep

**Written before any banner search has been run.** Only directory listings and file *counts* have
been taken (§2). No banner has been read, no hazard term extracted, no candidate identified.

**Task:** *"Enumerate every banner in the corpus. For each one, identify its counterpart document and
determine whether that counterpart also carries one."* Adopted from my own §8.7 recommendation.

**Governing generalisation, from the coordinator:**
> A BANNER IS A CONFESSION THAT A HAZARD WAS FOUND. ITS COUNTERPART IS WHERE THE HAZARD ACTUALLY
> LIVES. Where a hazard is documented in one place and acted on in another, disarming has TWO SITES
> and the pass that produced the banner had eyes on only one.

---

## 0. A DISCLOSURE THAT WEAKENS THIS PRE-REGISTRATION, STATED FIRST

**I am not blind this time and it would be dishonest to present this document as if I were.**

For `predicate2` I had seen only a directory listing. Here I have already read several hundred files
in `briefs/`, `reports/` and `em-tooling/`, I know the text of the `FREEZE IN FORCE` banner verbatim,
I know 19 files carried a banner in the first 12 lines as of 09:15Z, and I know one true positive of
exactly the shape I am now about to search for. **The prediction in §5 is therefore a much weaker
instrument than my last one.** A pre-registration is worth what the author did not already know, and
I already know one of the answers.

What I have *not* done, and what keeps this worth writing:

- I have not read any banner's full text with hazard-term extraction in mind.
- I have not enumerated banners outside the three roots I previously swept — `backups/`, `deploy/`,
  `preserve/`, `salvage/`, `reference/`, `ui-loop/`, `xfer/`, `notes/`, `learnings/`, `tools/`,
  `web-test/`, `scion-reference/`, `pr-reviews/` and the scratchpad root are all unread by me.
- I have not looked at `/workspace` at all beyond a file count.
- I have committed to a number in §5 before running anything.

**Scoring rule I am binding myself to:** the known instance (`reports/crash-cleanup-audit.md`) is
reported separately and **excluded from the scored prediction**. Only findings I did not already have
count against §5. A prediction that scores itself on a fact already in hand is not a prediction.

---

## 1. WHAT I AM LOOKING FOR, AS A PROPERTY OF TEXT

**B — BANNER WITH A MISSING TWIN.** A pair of documents (D_b, D_c) such that:

1. **D_b carries a banner** — text placed by this project to suspend, retract, disarm or forbid
   something, rather than to describe it; and
2. **D_c shares the banner's hazard** — D_c contains the same operational subject the banner exists
   to neutralise; and
3. **D_c carries no banner of its own**; and
4. **D_c is reachable** — some route exists by which an agent reads D_c without reading D_b.

Condition 4 is what makes it a hazard rather than a curiosity. A twin nobody can reach is inert.

**And, per scope note (f), a strictly more valuable variant I am also searching for:**

**B′ — HAZARD WITH NO BANNER ON EITHER SIDE.** An operational subject that this corpus elsewhere
treats as requiring suspension, present in a document, where **no** document carrying that subject is
bannered. B is a disarming pass that hit one of two sites. B′ is one that never ran. I expect B′ to be
rarer and worse.

### 1.1 Why this is not another phrasing-tuned instrument

Every instrument that has run on this corpus, mine included, guessed a hazard vocabulary. **This one
does not.** It reads the hazard vocabulary *off the banners themselves*. The corpus tells me what it
was afraid of; I do not have to guess. If the project bannered something I would never have thought
to grep for, this instrument picks it up anyway.

The failure mode this leaves me with is the honest one, and I state it now: **I can only find hazards
somebody already noticed once.** A hazard that was never bannered anywhere is invisible to stage 2
entirely. B′ partially covers this and does not close it.

---

## 2. ROOTS — PUBLISHED AS PATHS, PER REQUIREMENT (b)

These are the literal arguments to `os.walk`. Nothing is implied, nothing is inferred from a phrase
like "the corpus" or "every working tree".

### 2.1 ROOT SET A — PRIMARY, FULL CENSUS, EVERY FILE

```
/scion-volumes/scratchpad
```

One root, walked entirely. Measured 2026-07-29 09:35Z: **18,151 files.**

This single path subsumes, and I list them explicitly so that nobody has to trust the word
"subsumes" — counts measured at 09:35Z by `find <path> -type f | wc -l`:

```
/scion-volumes/scratchpad/projects/farmtable/backups              63
/scion-volumes/scratchpad/projects/farmtable/briefs              384
/scion-volumes/scratchpad/projects/farmtable/deploy             1637
/scion-volumes/scratchpad/projects/farmtable/design-project-log    6
/scion-volumes/scratchpad/projects/farmtable/em-tooling         4675
/scion-volumes/scratchpad/projects/farmtable/learnings             2
/scion-volumes/scratchpad/projects/farmtable/notes                 7
/scion-volumes/scratchpad/projects/farmtable/predicate2            2
/scion-volumes/scratchpad/projects/farmtable/preserve            284
/scion-volumes/scratchpad/projects/farmtable/reference          2579
/scion-volumes/scratchpad/projects/farmtable/reports             503
/scion-volumes/scratchpad/projects/farmtable/salvage             428
/scion-volumes/scratchpad/projects/farmtable/tools                 3
/scion-volumes/scratchpad/projects/farmtable/ui-loop             369
/scion-volumes/scratchpad/projects/farmtable/xfer                 19
/scion-volumes/scratchpad/projects/farmtable/*        (top level)  52
/scion-volumes/scratchpad/pr-reviews                               6
/scion-volumes/scratchpad/scion-reference                       2673
/scion-volumes/scratchpad/web-test                              4338
/scion-volumes/scratchpad/*                           (top level) ~17
```

**This is a 3.27× widening on my last population (5,552 → 18,151)** and it closes all six roots I
named as unswept in `FINDINGS.md` §5.5. `backups/coordinator-state/`, which I called the
highest-value unswept region, is in.

### 2.2 ROOT SET B — SECONDARY, BOUNDED, BANNER-EXISTENCE PROBE

```
/workspace
```

Excluding, and these exclusions are the population rule, not a convenience:

```
*/.git/*          */node_modules/*      */dist/*
*.png *.jpg *.jpeg *.gif *.ico *.woff *.woff2 *.ttf *.svg
```

Measured 09:36Z: `/workspace` entire = **1,795,021 files**; after the above exclusions =
**98,871 files**, across **234 worktrees**.

**Why B is a probe and not a census, stated as a limit rather than sold as a decision.** The 234
worktrees are checkouts of the same product repository. Their content is near-identical by
construction, so a raw file count over B is the `.preimage` inflation problem at 234×. I therefore
run **only stage 1 (banner detection)** over B, and I **deduplicate by sha256** before reporting.
Its purpose is to answer one question with an integer: *does the banner carrier exist outside the
scratchpad at all?* If B yields zero banners, ROOT SET A is the complete banner population and I can
say so with a number instead of an assumption.

### 2.3 EXPLICITLY OUT, AND WHY

- **`/workspace/**/.git/`** — object stores. Excluded under the freeze; I will not walk them and
  will run no git command that reads them.
- **`node_modules/`, `dist/`** — vendored third-party and build output. Not authored by this project,
  cannot carry a banner this project placed. Named as an exclusion so it is auditable, per the
  hedge-sweep rule that a silent filter is indistinguishable from an empty one. **I will report the
  integer each exclusion removed.**
- **Other agents' containers, `/tmp` on other hosts, git history, message channels.** Unreachable.
  `_msg-exclude-reconcile.txt` §3(a) already established that `/tmp` is per-container. **A banner
  delivered by message and never landed in a file is invisible to me, and that is precisely the
  failure the EM already filed:** *"a control delivered by message protects the agents who were
  running when it was sent and nobody else."* My instrument can only see the file corpus, so I
  cannot distinguish "never disarmed" from "disarmed by a message I cannot read." **I will report
  candidates rather than verdicts where this matters.**

---

## 3. THE MECHANISM

Python 3, one program, run from `/tmp`. No writes to either root. Read-only `open()` only.

### 3.1 Membership and decoding

Identical rule to my last sweep, so the two are comparable: every **regular non-symlink** file
reachable by `os.walk` from the declared root, no extension/size/name filter, dotfiles and
dot-directories included, decoded UTF-8 `errors='replace'` so that **EXAMINED == ENUMERATED is a
true equality and not a filter in disguise.** Symlinks counted and reported, never followed.

### 3.2 STAGE 1 — BANNER DETECTION

A banner is text placed to **suspend**, not to **describe**. The detector:

```
MARKER = one of, case-sensitive where written in caps, \b-anchored:
  FREEZE IN FORCE | FREEZE IS IN FORCE | UNDER FREEZE
  SUSPENDED | SUSPENSION
  MUST NOT BE FOLLOWED | DO NOT FOLLOW | DO NOT RUN | DO NOT USE | DO NOT EXECUTE
  DISARMED | RETRACTED | WITHDRAWN | SUPERSEDED | OBSOLETE | VOID | RESCINDED
  NO LONGER VALID | NO LONGER APPLIES | ON HOLD | HALTED | STOP
  ⛔ | ⚠ | 🛑
```

`STRUCTURE` = the line is a markdown blockquote (`>`), a bold run (`**…**`), a heading (`#`), or
≥60% uppercase alphabetic characters. A MARKER alone is prose; a MARKER **in banner structure** is a
banner. Both conditions required.

Two classes, both enumerated, both carried into stage 2:

- **HEAD-BANNER** — satisfies MARKER+STRUCTURE within the **first 15 lines** of the file. This is the
  project's documented form (`_BRIEF-RULES.md` §29: *disarm by prepending*).
- **INLINE-BANNER** — satisfies MARKER+STRUCTURE anywhere else. Retraction blocks and superseded-text
  markers take this form.

**I am not filtering INLINE down to HEAD even though HEAD is the doctrinal form.** A hazard disarmed
mid-file is still a confession that the hazard was found, which is all stage 2 needs.

### 3.3 STAGE 2 — HAZARD-TERM EXTRACTION, READ OFF THE BANNER

For each banner, take the banner line ±2 lines. From that window extract candidate **hazard terms**:

1. Every ALL-CAPS token or hyphenated ALL-CAPS compound of length ≥ 4 (`SAFE-TO-DELETE`, `PRUNING`).
2. Every backticked literal (`` `git add -A` ``, `` `git worktree remove` ``).
3. Every quoted phrase.

Then **filter to terms that are operationally distinctive**, by a pre-declared frequency rule:
a term is a hazard term iff its corpus-wide document frequency is **≥ 1 and ≤ 200 documents**. The
lower bound is trivially met; **the upper bound is the whole discipline** — a term appearing in more
than 200 documents is corpus furniture (`THE`, `MUST`, `NOTE`) and cannot localise a twin. 200 is
~1.1% of ROOT SET A and I am fixing it now rather than tuning it to a result. **If I change it I will
append the change and the reason, not edit this line.**

### 3.4 STAGE 2 — TWIN IDENTIFICATION

For each hazard term H from banner document D_b, the **candidate twin set** is every document in
ROOT SET A containing H. For each candidate D_c, flag as **MISSING TWIN** iff:

- `D_c != D_b`, and
- D_c carries **no** banner of any class (stage 1 result on D_c is empty), and
- D_c is not a **prior revision** of D_b (`.preimage-*` and same-stem-different-round are recorded
  and excluded as a named class — the hedge-sweep leg measured this inflation at 17.7% of the corpus
  and I will not repeat it silently).

Every surviving pair is then **read individually by me** and classified. No pair is excluded by
machine.

### 3.5 STAGE 2 — REACHABILITY, CHECKED NOT ASSUMED

For each MISSING TWIN, I establish route-of-reading before calling it a finding:
`grep -rln` for D_c's basename across ROOT SET A (inbound references), plus whether D_c is named in
any coordinator-state snapshot, plus whether D_c is at a path a directory listing surfaces.
**A twin with zero inbound references and no listing route is downgraded and reported as such.**

### 3.6 ANTI-PIPELINE NOTE

No `grep | cut | awk` chain anywhere in the run of record. My last brief warned that *an anchor
evaluated against a line is not the same anchor evaluated against a field*; `grep -rn` emits
`path:lineno:text` and a `^`-anchored pattern then matches the **path**. In Python, `line` holds file
content and nothing else. Structural anchoring (§3.2) is `^`-heavy, so this matters more here than it
did last time.

---

## 4. CONTROLS — INCLUDING REQUIREMENT (e), DIFFERENTIAL ASSERTION

All controls run **in the same invocation**, through the **same functions** as the corpus, before any
root is walked. Any deviation → `sys.exit(2)`. **A dead detector must crash, never report clean.**

| id | input | must |
|---|---|---|
| BAN-POS-1 | `> **FREEZE IN FORCE 2026-07-29 — NO DELETION…**` at line 1 | detect HEAD-BANNER |
| BAN-POS-2 | `⛔ **SUSPENDED — DO NOT RUN THIS RUNBOOK**` at line 1 | detect HEAD-BANNER |
| BAN-POS-3 | same marker at line 400 | detect INLINE-BANNER, **not** HEAD |
| BAN-NEG-1 | `The coordinator suspended the leg and the freeze is in force.` (prose, no structure) | detect **nothing** |
| BAN-NEG-2 | `**The team retracted the estimate last week.**` (structure, past-tense report) | detect **nothing** |
| BAN-NEG-3 | `stopPropagation()` / `NO_LONGER_VALID_ENUM` (substring bleed regression) | detect **nothing** |
| TWIN-POS | synthetic D_b bannered w/ term `ZZQX-HAZARD`; synthetic D_c contains `ZZQX-HAZARD`, unbannered | **exactly 1** missing twin |
| TWIN-NEG | identical pair, but D_c **is** bannered | **exactly 0** missing twins |
| FREQ-POS | term with df 3 | retained as hazard term |
| FREQ-NEG | term with df 5000 | rejected as furniture |

### 4.1 DIFFERENTIAL ASSERTION — requirement (e), host-wide as of tonight

> *A control pair must be asserted to produce DIFFERENT output, not merely to run. A detector whose
> positive and negative results are the same shape is dead while passing every liveness test we have
> written.*

Adopted, and I am implementing it as a hard assertion rather than an inspection. For each pair the
program asserts **inequality of the actual returned objects**, not merely that each matched its own
expectation:

```
assert detect(BAN_POS_1) != detect(BAN_NEG_1),  "pair BAN-1 collapsed"
assert detect(BAN_POS_3) != detect(BAN_POS_1),  "HEAD/INLINE distinction collapsed"
assert twin(TWIN_POS)    != twin(TWIN_NEG),     "twin pair collapsed"
assert freq(FREQ_POS)    != freq(FREQ_NEG),     "frequency filter collapsed"
```

failing → `sys.exit(5)`, distinct from the per-control exit 2. **This catches the thing per-control
checks structurally cannot: a detector that returns the same value for both members and passes each
half by accident.** POS-1 fired *and* NEG-1 stayed silent is satisfiable by a function that returns a
constant only if the expectations were written carelessly; `POS != NEG` is not.

**Note on why I could have used this last night.** My A1 failure — DIRECTIVE compiled without `re.I`
— was caught by a positive control. A differential assertion would have caught it at the same moment.
But my NEG-4 problem, where a control was *miswritten* rather than the detector broken, is exactly
the case a differential assertion diagnoses faster: POS and NEG both fired, so the pair collapsed,
and the collapse points at the pair rather than at the limb.

### 4.2 CANARIES — in-population, per the standing requirement

Three synthetic bannered documents injected **in memory** at ordinals `{0, N//2, N-1}` of the sorted
examined sequence of ROOT SET A, plus three synthetic twins at `{1, N//2+1, N-2}`. All six must be
recovered, and the three pairs must resolve as missing twins. Failure → `sys.exit(3)`.
Nothing is written to either root. The middle ordinals fall inside the large `reference/` and
`web-test/` masses, so any silent pruning of those regions aborts the run instead of shrinking it.

### 4.3 EQUALITY

`ENUMERATED == EXAMINED` asserted per root set, both integers published. Mismatch → `sys.exit(4)`.

---

## 5. PREDICTION — A NUMBER, COMMITTED, BEFORE ANY SEARCH

Read with §0: I already hold one instance, so I score only what I did not already have.

| quantity | prediction |
|---|---|
| **B — banner-with-missing-twin, NEW (excludes `crash-cleanup-audit.md`)** | **3** |
| B — total including the known one | 4 |
| **B′ — hazard bannered nowhere on either side** | **1** |
| banners enumerated, ROOT SET A (HEAD + INLINE, all classes) | 120 |
| banners enumerated, ROOT SET B (`/workspace`) | 0 |
| distinct hazard terms surviving the df ≤ 200 filter | 25 |

**Reasoning for 3, so it can be argued with:** the disarming pass covered `briefs/` and stopped. The
13 bannered briefs commissioned work, and commissioned work produces reports. Eleven of the thirteen
(`farmtable-em-f22`…`f34`) carry the same verbatim worktree-cleanup instruction, so their reports are
the natural place for a restated live instruction. Most such reports will be past-tense ("I cleaned
up"), which is class B in my last taxonomy and not a hazard. I expect a small number to carry
forward-looking residue ("remaining: remove worktree X"). Three is my estimate of how many.

**I would be surprised by 0** — that would mean `crash-cleanup-audit.md` was a singleton, and
singletons are rare in a corpus whose replication vector is copy-the-last-brief.
**I would be surprised by more than 15**, and would suspect the df ≤ 200 threshold is admitting
furniture rather than that the corpus is that badly holed.

---

## 6. WHAT WOULD TELL ME MY INSTRUMENT IS BROKEN

1. **Banner count in the low single digits.** I have already seen 19 bannered files in the first 12
   lines of a 5,552-file subset. Fewer than 19 over 18,151 files means `STRUCTURE` is over-tight.
2. **Banner count above ~600.** MARKER is catching prose. `SUSPENDED`, `STOP` and `VOID` are the
   likely leaks (`stopPropagation`, `void 0`, `suspended animation`), which is why BAN-NEG-3 exists.
3. **A hazard term with df in the thousands surviving the filter** — threshold wrong or df computed
   over lines rather than documents.
4. **Zero missing twins with a healthy banner count** — twin matching is broken; TWIN-POS would
   normally catch this, so I would also distrust the control.
5. **Missing twins numbering in the hundreds** — almost certainly prior-revision families
   (`.preimage-*`, `-r4/-r7/-r9` rounds) not being excluded, i.e. the 17.7% inflation the hedge-sweep
   leg measured, reappearing in my numbers.
6. **`crash-cleanup-audit.md` not recovered.** It is a known positive of exactly this shape and it is
   inside the population. **If my inverted instrument does not independently rediscover the finding
   that motivated it, the instrument is wrong and the run is void** — regardless of what else it
   finds. I am designating this the run's strongest single check and I am stating it before I run,
   so that recovering it counts for something and failing to recover it cannot be explained away.

---

## 7. AMENDMENTS — APPEND ONLY

Nothing above is edited after a result exists. Changes land here, with the reason, in order.

*(pre-registration sealed 2026-07-29 09:40Z, before stage 1 was written)*

---

### A1 — BANNER OVER-DETECTION. My §6.2 broken-instrument signal fired. 09:52Z

**Stage 1 run 1 returned 255 bannered files / 977 banner instances.** §6.2 pre-declared that a count
above ~600 means MARKER is catching prose. It is. Marker frequency:

```
STOP 253 | RETRACTED 160 | GLYPH 133 | SUPERSEDED 133 | WITHDRAWN 129 | HALTED 63
VOID 35 | SUSPENDED 32 | FREEZE IN FORCE 16 | DO NOT RUN 10 | DISARMED 5 | (rest ≤2)
```

Samples that are plainly not banners:

```
_m-coord11.txt   "question WILL FIND A REPORT THAT ANSWERS IT CORRECTLY AND WILL STOP."
_m-coord10.txt   "I RETRACTED THAT FIGURE TO YOU AN HOUR AGO AND THEN DID NOT..."
coordinator-state "## fleet-wide restart risk - PRODUCTION HALTED pending host-level fix"
```

**Root cause, and it is a defect in my structural assumption, not in the marker list.** My
`STRUCTURE` test admitted any line ≥60% uppercase. I wrote that expecting capitals to be
exceptional. **In this corpus capitals are the house register** — the coordinator, the EM and most
legs write whole paragraphs in caps. So the caps clause is satisfied by nearly every emphatic line
and does no discriminating work at all. It is not a structure signal here; it is a style signal.

**Why this matters far more than a precision nuisance, and why I am fixing it rather than living
with it.** The asymmetry runs the dangerous way:

> A FALSE BANNER ON A DOCUMENT MAKES THAT DOCUMENT INELIGIBLE TO BE A TWIN.

Stage 2 flags D_c only if D_c carries **no** banner. So every spurious banner **suppresses a
finding**. Over-detection in stage 1 is not noise I can filter later by reading — it is silent
false-negatives in the result. This is the same shape as the failure that motivated the whole task:
a document that looks protected and is not, inverted.

**The change,** effective for the run of record, justified on grammar and not on any result:

1. **Delete the ≥60% uppercase clause from `STRUCTURE`.** Retain blockquote / bold / heading. Caps is
   not structure in this corpus.
2. **Split MARKER into two tiers**, because "suspend" and "describe" are different speech acts and my
   single list conflated them:
   - **TIER-1 SUSPENSION** — illocutionary, disarming on their face: `FREEZE IN FORCE`,
     `FREEZE IS IN FORCE`, `UNDER FREEZE`, `SUSPENDED`, `SUSPENSION`, `MUST NOT BE FOLLOWED`,
     `DO NOT FOLLOW`, `DO NOT RUN`, `DO NOT USE`, `DO NOT EXECUTE`, `DISARMED`, `RESCINDED`,
     `COUNTERMANDED`, `NO LONGER VALID`, `NO LONGER APPLIES`, `⛔ ⚠ 🛑`.
     → banner on STRUCTURE alone.
   - **TIER-2 STATUS** — can equally report a fact about the past: `RETRACTED`, `WITHDRAWN`,
     `SUPERSEDED`, `OBSOLETE`, `VOID`, `HALTED`, `STOP`, `ON HOLD`.
     → banner **only if additionally self-referential**: the same line names the artefact it is
     attached to — `THIS FILE|DOCUMENT|BRIEF|REPORT|RUNBOOK|SECTION|BLOCK|TABLE|RECOMMENDATION|
     CONDITIONAL|CLAIM|FIGURE|NUMBER|RULE|PARAGRAPH`, or `INSTRUCTIONS|BELOW|ABOVE|HEREIN|
     THAT FOLLOWS`.
3. **New controls,** both required to pass, and added to the differential set:
   - `BAN-NEG-4` = `"I RETRACTED THAT FIGURE TO YOU AN HOUR AGO AND THEN DID NOT"` → must **not**
     fire. This is a real line from `_m-coord10.txt`, taken from run 1's own false positives.
   - `BAN-POS-4` = `"> **This section is SUPERSEDED — do not follow the instructions below.**"` →
     must fire. Tier-2 marker rescued by self-reference.
   - `assert detect(BAN_POS_4) != detect(BAN_NEG_4)`.

**What I am NOT doing:** I am not dropping tier-2 markers. `VOID` and `SUPERSEDED` carry real
banners in this corpus and discarding them to buy a clean number would be exactly the move my last
run refused with NEG-4. Tier-2 is retained and gated, not deleted.

### A2 — THE KNOWN POSITIVE WAS REMEDIATED MID-RUN. §6.6 CANNOT BE EVALUATED AS WRITTEN. 09:55Z

I pre-registered §6.6 as the run's strongest check: *if the inverted instrument does not independently
rediscover `reports/crash-cleanup-audit.md`, the run is void.*

**It cannot, and not because the instrument failed. The EM fixed the file while I was writing the
predicate.**

```
mtime 2026-07-29 09:27:41Z   reports/crash-cleanup-audit.md   446 -> 517 lines
```

Seventy-one lines prepended, opening:

> `> # ⛔ VOID — EVERY DELETION RECOMMENDATION BELOW IS COUNTERMANDED. DO NOT ACT ON THIS FILE.`
> `> **A DURABILITY FREEZE IS IN FORCE PROJECT-WIDE, AND IT IS EXTENDED TO AGENT DELETION.**`

and closing at line 70 with `— end of banner; the original document begins below, unmodified —`.
My stage 1 detected it as HEAD-bannered, correctly. **It is no longer a missing twin because it is no
longer missing a banner.** The finding was actioned inside 26 minutes.

**This is a real methodological problem and I will not paper over it.** A known-positive control that
the world repairs between pre-registration and execution stops being a control. Declaring the run
void on §6.6 would be absurd; quietly dropping §6.6 would be worse, and would be precisely the
"silently revised prediction" my last brief called worthless.

**Substitution, which I think is strictly stronger than what it replaces:**

> **§6.6-bis — RECONSTRUCTED-PREIMAGE CONTROL.** The banner is exactly 71 lines and declares the
> original unmodified below. Reconstruct the pre-remediation file as `lines[71:]`, inject it into
> the population **in memory** under its real path, and require the full stage-1 + stage-2 pipeline
> to flag it as a MISSING TWIN of `briefs/cleanup-audit.md`. Failure → `sys.exit(6)`, run void.

This is better than the original §6.6 for a reason worth stating: it is a **known positive drawn from
the live corpus rather than synthesised by me**, so unlike TWIN-POS it cannot be accidentally
tailored to my own detector. It tests the pipeline against a document I did not write, at its real
path, with its real neighbours, in the exact state that made it dangerous.

**Scoring consequence, stated now:** §6.6-bis passing does **not** count toward the §5 prediction of
3 NEW instances. It is a control. The scored number remains new-and-previously-unknown only.

### A3 — SNAPSHOT-FAMILY INFLATION IN `backups/coordinator-state/`. 09:56Z

Fifty of run 1's 255 bannered files are `backups/coordinator-state/coordinator-state-2026-07-29T*`,
and the sampled lines are **verbatim identical across them** (`## fleet-wide restart risk -
PRODUCTION HALTED`, `## Ruling implemented + arbitration bar SUPERSEDED`, appearing 6+ times each).
These are periodic snapshots of one growing document — the `.preimage` inflation the hedge-sweep leg
measured at 17.7%, in a directory it never swept.

**Treatment, declared before the numbers:** snapshot families are **kept in the enumerated
population** (they are real files an agent can read) but **collapsed to one representative for
hazard-term extraction and for twin counting**, keyed by `(directory, filename-prefix-before-timestamp)`
and reported as a named class with its integer. Counting one hazard fifty times because a cron job
ran fifty times would inflate every number in my report, and I would rather state the rule than
discover the inflation afterwards.

### A4 — TWO OF MY FOUR INTERVAL QUANTIFIERS WERE UNEXERCISED BY CONTROLS. 10:05Z

Prompted by the coordinator's `mawk` bulletin (09:39Z): *"THE CONTROL MUST EXERCISE THE QUANTIFIER. A
positive control on a fixed literal passes happily while the interval next to it is inert."*

**I use no awk anywhere and nothing of mine is void** — full answer sent to the coordinator, verified
by `grep -ln awk` over every script and by confirming no `subprocess`/`os.system`/`popen` call exists
in any of them. Python honours intervals on this host (tested `{20,}` against 25 `a`s → True).

But audited against **rule 3** rather than rule 1, my controls were only partly compliant. My four
intervals and whether any control traversed them:

| pattern | interval | exercised by a control? |
|---|---|---|
| `CAPS` | `{3,}` and `[-/][A-Z0-9]{2,}` | **yes** — control asserts `SAFE-TO-DELETE` extracted |
| `TICK` | `{3,60}` | **yes** — control asserts `` `git add -A` `` extracted |
| `QUOTE` | `{4,60}` | **NO** — nothing touched the quoted-phrase branch |
| `TS` (family) | `{2,6}` | **NO** — nothing touched snapshot collapsing |

**Two of four quantifiers were inert under my own control set.** On a tool that degraded intervals
silently they would have returned empty and every downstream count would have looked healthy. The
tool does not degrade, so no number is affected — but the *control design* was wrong independently of
whether the tool was, and that is the part worth fixing.

**Added, both in the differential set:**

- `QUOTE-POS` — `He said "harvest the transcript before deleting" and left.` → must extract the
  quoted phrase. Paired with `QUOTE-NEG` (no quotes present) and asserted `!=`.
- `FAMILY-POS` — `coordinator-state-2026-07-29T0300Z.md` and `coordinator-state-2026-07-29T0415Z.md`
  → must collapse to **one** family key, and must **not** collapse with
  `em-state-2026-07-29T0300Z.md`. Asserted as an equality *and* an inequality, so a `family()` that
  returned a constant fails.

**The generalisation, which is mine and which I think outranks the awk instance:**

> A CONTROL PROVES THE BRANCH IT TRAVERSES AND NOTHING ELSE.

My A1 failure last night was the same shape — the DIRECTIVE limb passed every other control while
missing `re.I`, because no control traversed it with a capital letter. An inert interval and an
untraversed branch are the same defect: the program runs, the branch is live, the exit code is clean,
and the one input that would have exposed it was never supplied.

### A5 — ROOT SET B DEDUPLICATION MUST BE PATH-ATTRIBUTING, NOT PATH-COLLAPSING. 10:12Z

Ordered by the coordinator (09:42Z), from `relocate`'s excluded-region scan which hit exactly this:

> ATTRIBUTE EACH DISTINCT CONTENT BACK TO EVERY PATH THAT BEARS IT, NOT TO THE FIRST ONE FOUND, AND
> PROVE IT WITH A CANARY PLANTED AT TWO PATHS THAT MUST BE REPORTED AS BOTH.

Accepted, and the reasoning is one I had not made explicit in §2.2. My dedup is only sound because
`detect_banners` is a pure function of the bytes — same content, same verdict. But **soundness of the
verdict is not soundness of the report.** Reporting the first path per hash silently converts my
question from

> *is this hazard bannered **here**?* → *does this content exist bannered **somewhere**?*

and for a banner-twin question **the path set is the finding.** A hazard bannered in worktree 3 and
un-bannered at the same relative path in worktree 47 is precisely a missing twin; first-path-wins
reporting hides it by construction.

**Implementation, in the run of record for ROOT SET B:**
- `sha256(bytes) -> {all paths}`. Detection runs **once per distinct hash**; the verdict is then
  **fanned back out to every path in the set**, and the path set is what gets reported.
- Report three integers, not one: `PATHS`, `DISTINCT CONTENTS`, `PATHS PER BANNERED CONTENT`.
- **`DEDUP-CANARY`**: one synthetic bannered content injected in memory at **two** ordinals in the
  path list. The run asserts both paths appear in the recovered path set. Recovering one → the
  attribution is collapsing → `sys.exit(7)`.
- Paired negative: two *different* synthetic contents must **not** be reported at each other's paths
  (`hash collision / cross-attribution` check), asserted `!=`. Per A4, the canary exercises the
  fan-out branch itself, not merely the hashing.
