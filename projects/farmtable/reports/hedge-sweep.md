# hedge-sweep — the shape that stops the search

**Status of this file:** sections 1–6 below marked **[COLD]** were written and saved to
disk BEFORE reading `briefs/hedge-sweep.md` lines 87–132 ("WHAT I ALREADY TRIED") and
BEFORE opening `briefs/_hedge-sweep-ADDENDUM.md`. A **RECONCILE** section is appended
after those were read. File mtime on the first write is the receipt.

**Scope:** documentary audit of `reports/` and `briefs/` only. No repository touched, no
build, no test, no writes outside this file and `hedge-sweep-project-log.md`.

---

## 1. POPULATION AND COMMANDS

### 1.1 The corpus, and a correction to the brief's figures

```
cd /scion-volumes/scratchpad/projects/farmtable
find reports briefs -type f -name '*.md' | wc -l          # 645
find reports briefs -type f -name '*.md' -print0 | xargs -0 cat | wc -l   # 195515
find reports briefs -type f -name '*.md' ! -path 'briefs/hedge-sweep.md' | wc -l  # 644
```

The brief says **644 files, 195,111 lines**. I measure **645 / 195,515**.

The file count reconciles exactly: **644 = 645 − the brief itself**. The brief is a member
of the population it describes, and was counted before it was written.

The line count does not reconcile, and the residual is real:

```
find reports briefs -type f -name '*.md' -newermt '2026-07-29 08:00' -printf '%TH:%TM %p\n' | sort
08:01 reports/relocate-offhost.md
08:02 briefs/_r7-PHASE-TWO.md
08:02 reports/dist-ignore-sweep.md
08:03 briefs/_BRIEF-RULES.md
08:04 reports/_run-queue-log.md
08:04 reports/preserve-bundle.md
08:05 briefs/hedge-sweep.md
```

**The corpus is being mutated by other legs while I audit it.** Six files changed in the
four minutes before my brief was written. The brief's line count was stale on arrival;
mine is stale as you read it. Any count in this report is a measurement of a moving
population, and I state it as such rather than presenting it as a fixed denominator.

Control that the newline-counting method is not itself losing lines:

```
find reports briefs -type f -name '*.md' -print0 | xargs -0 -I{} sh -c \
  'test -s "{}" && [ "$(tail -c1 "{}" | wc -l)" -eq 0 ] && echo "{}"' | wc -l   # 0
```

Zero files lack a trailing newline, so `cat | wc -l` is not undercounting. **This zero is
non-vacuous** — the pipeline emits a filename when it fires; it printed none.

### 1.2 THE INSTRUMENT WAS POISONED BEFORE I USED IT — 17.7% of the corpus is snapshots

```
find reports briefs -type f -name '.*.md' | wc -l                              # 13
find reports briefs -type f -name '.*.md' -print0 | xargs -0 wc -l | tail -1   # 34599
wc -l reports/.preimage-review-194-r11-b*.md reports/review-194-r11.md
```

```
2248 .preimage-review-194-r11-b15.md      3132 ...-b23.md
2472 ...-b16.md                           3233 ...-b24.md
2558 ...-b17.md                           3333 ...-b25.md
2640 ...-b18.md                           3430 ...-b26.md
2717 ...-b19.md                           4392 review-194-r11.md   <- the final document
2838 ...-b20.md
2946 ...-b21.md
3019 ...-b22.md
```

These twelve `.preimage-` files are **incremental save-snapshots of one document being
written**, monotonically growing 2248 → 3430 and culminating in the 4392-line
`review-194-r11.md`. `diff b15 b16` = 224 changed lines; `diff b15 b26` = 1182.

**34,599 lines — 17.7% of the entire corpus — are prior drafts of documents that also
exist in final form.** One authored sentence in that document is counted **thirteen
times** by any naive grep. Concretely, `at most one terminal label` appears at line 2040
of every snapshot and at 2051 of the final: one claim, thirteen hits.

This is the single most important thing I found about *measuring* this record, and it
poisons every frequency claim anyone has made or will make over `reports/` with a plain
`grep -r`.

### 1.3 THE THREE INTEGERS — Pass A instrument

Canonical Pass A instrument, run once, all counts below derive from this file:

```
grep -rnEi 'at most|no more than|worst[ -]case|upper bound|at worst|bounded (by|above)|cannot exceed|never exceeds?|fewer than|strictly less' \
  reports briefs --include='*.md' > /tmp/passA_raw.txt
```

| | count | proof the exclusion matched something |
|---|---|---|
| **ENUMERATED** | **81** | |
| − excluded: `.preimage-` snapshots | 22 | non-zero; 12 distinct files, listed in §1.2 |
| − excluded: the brief itself | 1 | `briefs/hedge-sweep.md:27`, the brief quoting its own vocabulary |
| − excluded: word-boundary false positives | 9 | listed below; non-zero |
| **FLAGGED** | **49** | |

**81 = 49 + 32.** The arithmetic closes.

**My own instrument had a defect and reading caught it, not counting.** `at most` with no
word boundary matches the substring in "th**at most**", "wh**at most**". All 9 are false
positives and all 9 are the same bug:

```
grep -rnEi '[a-z]at most' reports briefs --include='*.md' | grep -v '\.preimage-'
reports/dev-xss-r2.md:353          "what most people write from muscle memory"
reports/test-xss-r3.md:478         "sinks that most need it"
reports/linkauth-69.md:106         "The modifier that most affects severity"
reports/audit-195-r3.md:327        "...that most..."
briefs/audit-xss-r2.md:45          "The one that most"
reports/review-194-r6.md:129       "the code that most needs to"
briefs/test-xss-r4-checklist.md:38 "the environment that most needs it"
briefs/review-xss-r4-checklist.md:26 "environment that most needs it"
briefs/_r6-PHASE-TWO.md:68         "the 7a0f220 that most trees here call main"
```

I report this because the brief's caution is about filters that match *nothing*. The
symmetric failure — a filter that matches *too much* and inflates a rate — bit me, and it
would have inflated my headline number by 18% had I trusted the count instead of reading
the lines.

### 1.4 UNION ACCOUNTING, AND THE BOUND ON THIS CENSUS

I ran three instruments (Pass A vocabulary, Pass B incompleteness vocabulary, Pass C
absence-as-proof vocabulary). **They are not unioned into a single denominator and I am
not going to pretend they are.** All three are *vocabulary* instruments: they find
instances that happen to be phrased in the words I guessed. An instance of the shape
committed in different words is invisible to all three.

**A CENSUS IS AS BOUNDED AS ITS MOST BOUNDED INSTRUMENT, and mine is bounded by my
vocabulary.** Every rate in §4 is therefore a lower bound. See §4.3, where I turn that
observation on my own headline number.

---

## 2. MY PRE-REGISTERED FALSIFIER, AND WHETHER IT FIRED

Registered to disk after fixing the population, before classifying anything:

> Among the 49 genuine Pass-A hits, classify each as COMMITTED (a conservative-direction
> bound that terminates the inquiry) or CAUGHT (the document identifying this failure in
> itself or in prior work) or BENIGN.
>
> **I am wrong about recurrence if (a) COMMITTED ≤ 3 distinct instances AND (b) CAUGHT ≥
> COMMITTED.** Together those mean the vocabulary is dominated by the project's immune
> response rather than the disease, and the coordinator's three memorable cases *are* the
> population.
>
> Mechanism: read all 49 in context. The set is small enough for a census, so a sampling
> excuse is not available.
>
> **Second falsifier (instrument-level):** if the Pass-A vocabulary is largely absent from
> the documents where the memorable cases actually live, vocabulary search is the wrong
> instrument and any rate derived from it answers a different question.

**Result of the census — all 49 read in context:**

| class | n |
|---|---|
| BENIGN (definitional, policy, arithmetic, or a *correctly* exhaustive bound) | 23 |
| **COMMITTED** | **14** |
| **CAUGHT** | **12** |
| total | 49 |

**23 + 14 + 12 = 49.** Closes.

**THE FALSIFIER DID NOT FIRE.** Condition (a) fails decisively: COMMITTED = 14, not ≤ 3.
Condition (b) fails: CAUGHT = 12 < 14. On my own pre-registered terms, **the shape recurs
and I am obliged to say so.**

The second falsifier I cannot yet evaluate — it depends on which cases the coordinator has
in mind, which is in the section I have not read. Flagged for reconciliation.

---

## 3. FINDINGS

### PASS A — CONSERVATIVE-DIRECTION BOUNDS

**A1 [COLD] — The strongest evidence in the record: the shape committed inside the
correction to itself.**
`reports/audit-194-r7.md:667`

> "I committed, inside the addendum, the identical error I had just finished diagnosing in
> the main report — a conclusion silently bounded by a set I chose, presented as a general
> claim. Twice in one audit, on the same axis."

The author evaluated a property against two implementations, observed "P1=true in all 8
rows", and concluded the property never discriminates — a fact about *the implementation
set he enumerated*, not about the property. **This is the shape reproducing itself under
active surveillance by an author who had just written the diagnosis.** It is the single
best answer to "does awareness prevent it": no.

**A2 [COLD] — A load-bearing bound inherited from a brief, never verified, used to
downgrade a severity.**
`reports/audit-194-r11.md:2075`

> "'This surface is IAP-bounded in the deployed configuration.' Source: `briefs/audit-194-r11.md`,
> the EM's bounding fact. **I have never verified it, and it is load-bearing for my
> severity.** I rated AUDIT-194-R11-C1 HIGH rather than Critical partly because the
> reachable population is bounded by an identity-aware proxy."

Classified CAUGHT — he flagged it. But note the transmission path: **the bound entered
through a brief and propagated into a severity rating.** The mechanism is not individual
carelessness, it is inheritance. That matters for the remedy.

**A3 [COLD] — A measurement stopped short by a viewport bound, with the shortfall
re-described as a property of the system.**
`reports/perf-phase2-evidence/evidence-report.md:206` and `:142`

Target was 9,000+ tasks; 3,800 were created. The shortfall is closed with:

> "The visible node count is constant (~70) regardless of total graph size, since it's
> bounded by the viewport"

and the residual is attributed at `:142` to a **"pre-existing scalability limitation"**.
The bound is true. It is also the reason the 9,000-node measurement was never taken, and
the "pre-existing" attribution is a Pass B partial cause doing the same work in the same
document. This one is COMMITTED on both axes and nothing downstream re-opens it.

**A4 [COLD] — A bound substituted for a search, explicitly and on purpose.**
`reports/scopedeny-93.md:467`

> "the population of such points is argued **bounded by the type system rather than by a
> search**."

I flag this as the honourable form of the shape, and I want to be careful: the argument is
actually good (`scopesKey` is an unexported constant of an unexported type, so the
constructor set is closed by the compiler). **A type-level bound genuinely is stronger
than a grep.** I record it not as a defect but because it is the template that makes the
defective instances look respectable — the same sentence shape, with a weaker warrant, is
A5.

**A5 [COLD] — The same shape with a warrant that cannot bear it.**
`reports/audit-xss-r4.md:110`

> "the correct severity ceiling for a `remote_data` traversal gap is bounded by 'a future
> binding', and I have rated accordingly."

A bound whose warrant is *that something has not been built yet*. True today,
unfalsifiable in the safe direction, and it sets a severity ceiling. Disclosed, which is
why the author is not at fault — but nothing schedules a re-measurement when the future
binding arrives.

**Other COMMITTED instances, cited for the denominator:** `review-xss-r6.md:154`
(a census instrument that records "at most one mention per line" — a conservative
undercount used as a population); `decomposer-implementation-log.md:94`;
`review-194.md:183`; `audit-194-r9.md:485`; `crash-cleanup-audit.md:218`;
`review-task-state-core-r3.md:93`; `review-xss-r7.md:383`; `review-194-r6.md:191`;
`relocate-offhost.md:388`; `test-195-r8-evidence/predictions-02-mutations.md:184`.

**The immune response, for balance (CAUGHT):** `xss-r5-consumer-population.md:7` ("the
population is **not** bounded by the tree" — a prior bound actively refuted);
`test-xss-r4.md:1270-1271` (tested bound-removal in *both* directions and found one
**UNBOUNDED**); `audit-phase2.md:283`; `audit-194-r8.md:354`; `test-194-r9.md:311`.

### PASS B — TRUE-BUT-INCOMPLETE CAUSES

**B1 [COLD] — THE HEADLINE FINDING. The class is ninety minutes old, and most of its
occurrences in the record are the coordinator's own sentence being copied forward.**

```
grep -rlEi 'partial cause|true-but-incomplete|incomplete cause' reports briefs --include='*.md' | grep -v '\.preimage-'
briefs/_r7-COMMON.md              07:51
briefs/audit-writable-path.md     07:31
briefs/hedge-sweep.md             08:05
briefs/read-ci-population.md      07:31
reports/dist-ignore-sweep.md      08:10
reports/reconcile-urlbindingscan.md  07:29
```

Six files. **Four are briefs — coordinator-authored scaffolding.** Of the two reports, one
is from tonight at 08:10. And the sixth, `reconcile-urlbindingscan.md:826`, names its own
provenance:

> "#### 5.2.6.1 THE CLASS THIS BELONGS TO — **filed at the coordinator's direction, 07:28Z**"

**The aphorism was authored at 07:28Z tonight.** Every subsequent appearance postdates it
by minutes and descends from it. The corpus timeline:

```
find reports briefs -type f -name '*.md' ! -newermt '2026-07-29 07:28' | wc -l   # 627
find reports briefs -type f -name '*.md'  -newermt '2026-07-29 07:28' | wc -l   #  22
```

**627 of 649 files predate the class existing.** So when the record "keeps producing" this
shape, a large part of what makes it feel frequent is that it was named ninety minutes ago
and immediately propagated into four briefs. **Frequency in the record is not frequency in
the work.** This is the denominator the brief asked me to show, and it cuts against the
premise — though see §4, because it does not cut all the way.

**B2 [COLD] — The project already knows this, and stated it better than I just did.**
`briefs/read-ci-population.md:140`, duplicated at `briefs/audit-writable-path.md:113`

> "**THE MORE APT AN EXAMPLE IS, THE MORE IT CONTAMINATES, BECAUSE APTNESS IS PROXIMITY TO
> THE QUESTION.**"

I reached B1 independently and then found the project had the meta-insight already. That
is worth recording honestly: my contribution here is the *measurement* (six files, 07:28Z,
627 vs 22), not the idea.

**B3 [COLD] — The one clean, pre-existing instance, and its provenance is the finding.**
`reports/reconcile-urlbindingscan.md:837`

> "**Provenance, which weakens the credit and belongs with it:** I did not catch this by
> discipline. I asserted the dotfile cause, the coordinator began routing it onward as a
> worked example, and I measured it only because I saw it about to propagate. **The guard
> that fired was a claim becoming visible to someone else.** Caught in transit, not at
> authorship."

This is the most useful sentence in the corpus on this subject. The guard was not
verification, review, or a control — **it was publication**. No process step catches a
partial cause; being about to be quoted did.

**B4 [COLD] — Independent pre-aphorism instance.**
`briefs/farmtable-194-r3-review-context.md:43` — "There was a **second, opposite-direction**
consequence: `from == to` re-stamping became *stricter*." The first consequence was true
and fixed; the opposite-direction one was found only because the coordinator ruled that
both directions get equal scrutiny. Textbook partial cause, dated before the class was
named — so the class is not purely an artefact.

**B5 [COLD] — Independent pre-aphorism instance.**
`reports/dev-194-r9.md:362` — "Two errors, **one incomplete diagnosis that the ruling
inherited**, and one green control where I expected an error." Note again the verb:
*inherited*.

### PASS C — CHEAP OBSERVABLE / EXPENSIVE PROPOSITION

The record is markedly *better* at this than at Passes A and B, and I want to say so
plainly because it bears on where remediation effort should go.

**C1 [COLD] — The project has a working, named control for exactly this gap.** Repeatedly,
a zero is accompanied by a positive control proving the instrument fires:

- `reports/flakepop-81.md:159` — "`^func main()` → 3 hits. **So the pattern fires, and the
  zero is real.**"
- `reports/sweep-ftstage.md:269` — "`EXIT=1`, zero hits (**control:** `wc -l` → 21 + 21 lines)"
- `reports/xss-r5-audit.md:555` — "the zero is **not vacuous**: the raw diff has 24 [lines]"
- `reports/review-xss-r4.md:2032` — "**Positive control on that null**, because a `find`
  that is silently misaimed also prints nothing: I created `zz_reviewxssr4_emptydir_control`"
- `reports/test-xss-r3.md:633` — "so the zero is a [real zero]"
- `reports/sweep-ftstage.md:521` — "Three independent pathspec forms agree, against a
  demonstrably non-empty diff. **The zero is real.**"

**Pass C's failure mode is the one the project has actually solved.** Cheap-observable/
expensive-proposition gaps get controls; conservative-direction bounds do not. That
asymmetry is the actionable finding of this pass.

**C2 [COLD] — The residual Pass C exposure, stated as the brief asks.**
`reports/scopepath-61.md:117`

| | |
|---|---|
| **cheap thing the command returned** | the nearest `RequireScope` in the file is at `:1361`, inside `ListUsers` |
| **expensive thing concluded** | the path is unprotected |
| **what must hold to bridge them** | that protection is *lexically local* — no middleware, decorator, router-level guard, or caller-side check protects it from elsewhere in the tree |

The author labels this himself: "**absence of evidence**". Disclosed, not hidden — CAUGHT.

**C3 [COLD] — Same pair, different document, also self-labelled.**
`reports/test-194-r3.md:491` — "**Caveat, stated honestly:** absence of evidence. I
classified by reading every helper, not by [executing]." The observable is *reading*; the
proposition is *behaviour*; the bridge is that reading a helper reveals its runtime effect.

---

## 4. DOES THE SHAPE RECUR?

### 4.1 Yes for Pass A. I am obliged to say so by my own falsifier.

**14 COMMITTED instances across 13 distinct documents**, of which the strongest — A1,
`audit-194-r7.md:667` — is an author committing the error *inside the addendum correcting
that same error*. That is not three memorable cases. My falsifier was pre-registered, it
required COMMITTED ≤ 3, and COMMITTED = 14.

Rate I will defend, with its bound attached:

> **At least 13 of 632 visible documents (2.1%) contain a conservative-direction bound
> that terminated an inquiry.**

### 4.2 No for Pass B, at anything like the implied rate — and here is the denominator.

The Pass B *vocabulary* is 90 minutes old (§B1: authored 07:28Z, present in 6 files, 4 of
them briefs). **627 of 649 files predate the class.** Genuine independent pre-aphorism
instances I can defend: **two** (B4, B5), plus B3 which is the origin case itself. That is
three, which is *exactly the number of memorable cases the coordinator said he had*, and I
think that is the answer rather than a coincidence.

**For Pass B specifically: the record does not support the class at the rate the framing
implies, and the base rate is 3 in ~627 files.** You said that finding would be worth more
than a long list. It is the finding.

### 4.3 The refusal, and it applies to my own headline number

**I will not give you a single unified rate across the three passes.** All three
instruments are vocabulary searches; an instance phrased in words I did not guess is
invisible to all three. Unioning them would produce a number with a denominator I cannot
describe.

And the sharper point, which I would rather state than have you find:

> **"At least 13 of 632" is itself a conservative-direction bound.** It is stated in the
> safe direction, it is true, it is unfalsifiable by anything I ran — and if you accept it,
> it will stop the search. It is Pass A, committed by this report, in the section where
> this report answers the Pass A question.

The honest form: the true rate is unknown and **greater than** 2.1%. The instrument that
would settle it is not a grep — it is reading a random sample of documents end to end and
classifying them, which I did not do (§5).

### 4.4 What actually recurs, if I compress it to one sentence

Not "a bound that survived checking" but: **a bound that arrived from somewhere else.**
A2 inherited it from a brief. B5 says "one incomplete diagnosis that **the ruling
inherited**." B3's guard was *transit*, not authorship. The recurring object is an
unverified constraint crossing an authorship boundary and acquiring the local author's
credibility on arrival. **That reframing is falsifiable and the current one is not**, and
it points at a different remedy: mark inherited bounds at the boundary, rather than asking
authors to be more careful.

---

## 5. WHAT I DID NOT CHECK

- **I did not read a random sample of documents end to end.** Everything here came from
  vocabulary search plus context reads around hits. This is the gap that makes §4.3's
  number a lower bound, and it is the single thing most worth doing next.
- **I did not verify a single underlying technical claim.** When `audit-194-r11.md` says
  the surface is IAP-bounded, I recorded that it is unverified *by its own author*; I did
  not verify it either. No build token, and it is out of scope — but the report inherits
  that gap.
- **The 209 non-`.md` files** under `reports/`+`briefs/` (854 total files, 645 `.md`) were
  not examined at all. Evidence directories contain `.png`, `.txt`, `.json`. A bound
  asserted in a screenshot caption is invisible to me.
- **I did not de-duplicate near-identical *visible* documents.** I found and excluded the
  12 hidden snapshots, but `reports/` may contain visible rounds (`-r4`, `-r7`, `-r9`…) that
  restate one another's bounds. §1.2's correction is therefore itself incomplete — I fixed
  the case I could detect by filename.
- **`briefs/hedge-sweep.md` lines 87–132 and `briefs/_hedge-sweep-ADDENDUM.md`** — unread
  at the time of writing, by instruction. See the RECONCILE section.
- **Backup trees** (`backups/`, `salvage/`, `preserve/`, `xfer/` at project root) are
  outside `reports/`+`briefs/` and were not swept. If they mirror report content, the
  17.7% duplication figure is an underestimate for the project as a whole.

---

## 6. WHERE THIS BRIEF WAS WRONG

**6.1 — The ordering constraint is unenforceable against the instrument the brief
mandates, and it failed during this audit.**

The brief tells me to sweep `reports/` and `briefs/`. `briefs/hedge-sweep.md` is in
`briefs/`. Any `grep -r` over the mandated population returns hits from the section I was
told not to read. **This happened.** My Pass C sweep returned:

```
briefs/hedge-sweep.md:101:closure language — `ruled out|no carrier|cannot be reached|unreachable|zero hits|no
```

I saw that line. I did not seek it and I stopped there, but I cannot unsee it, and it is
withheld-section content — a fragment of your suggested search vocabulary. Disclosing it
because the tag is measuring your scaffolding and a silent leak would corrupt that
measurement.

Your ADDENDUM message shows you already understand this exact class — *"an ordering
announced inside the artefact it restricts is unfollowable"* — and you solved it correctly
for the addendum by putting the condition in a separate message. **The brief itself has the
identical defect and did not get the same fix.** The remedy is the one you already found:
the withheld section belongs in a separate file, not in the document the auditor must grep.

**6.2 — The stated population figures are wrong, and wrong in a way that hides that the
corpus is moving.** 644/195,111 vs measured 645/195,515 (§1.1). The file count reconciles
via off-by-the-brief-itself; the line residual is concurrent writes by other legs. Stating
a fixed population for a corpus that six other agents are actively appending to invites
every leg to report incomparable denominators. **A timestamp on the population would fix
this**: "644 files / 195,111 lines as of 08:05Z".

**6.3 — The brief's own caution is one-sided, and the other side is the one that bit me.**
You warn that a filter matching nothing silently passes everything. The symmetric failure —
a filter matching *too much* — is unmentioned, and it cost me 9 false positives out of 58
(§1.3) via a missing word boundary. **A filter that over-matches inflates a rate, which is
the more dangerous direction for a brief whose question is "does this recur?"**

**6.4 — "644 markdown files" implies 644 documents. It is 632 documents plus 12 drafts.**
Nothing in the brief flags that 17.7% of the corpus is snapshot duplicates (§1.2). Since
the brief demands base rates, and the duplication is concentrated in exactly the
long-analytical documents most likely to contain the target vocabulary, the corpus as
described would have systematically inflated any rate computed over it. This is the
brief's most consequential error.

**6.5 — Pass A's definition contains a hidden assumption that the census disproved.** The
brief says a conservative bound "is *true*, and which therefore nobody re-measures". In 12
of 49 cases somebody *did* re-measure, refute, or self-flag it (§2, CAUGHT). The word
"therefore" asserts a mechanism that fires about half the time. **The project's immune
response is real and the brief's framing does not allow for it** — which matters, because
A4/`scopedeny-93.md:467` shows the same sentence shape can be entirely sound.

**6.6 — The three passes are not independent, and the brief treats them as separate
sections.** `perf-phase2-evidence/evidence-report.md` (A3) is one episode that is
simultaneously a Pass A bound and a Pass B partial cause, in adjacent paragraphs. Reporting
per-pass splits single episodes across sections and double-counts them in any total.

**6.7 — A tasking error, minor but real.** The brief says "You should not need to run
anything beyond grep and file reads," and separately demands base rates with closing
arithmetic. Grep alone cannot detect the snapshot duplication that invalidates those rates;
I needed `md5sum`, `wc`, `diff`, and `find -printf '%T'`. **The permitted toolset was
narrower than the mandated analysis.** No harm done — all of those are read-only — but a
more literal leg would have produced a confidently wrong 17.7%-inflated number.

---

# RECONCILE — after reading brief lines 87–132 and `_hedge-sweep-ADDENDUM.md`

Cold pass on disk at **08:15:42Z**, 518 lines, before either was opened. Everything below
is **[RECONCILE]**.

## R1 — Where the scaffolding was REDUNDANT (found cold, and further)

Brief line 115 flags the `.preimage-*` files and says "decide deliberately… do not let it
happen silently." **I found this cold** (§1.2) and went past the warning: they are not
merely "prior revisions" but *monotonic incremental snapshots of one document*
(2248→3430→4392), 17.7% of the corpus, causing a single sentence to be counted 13×.

Scaffolding measurement: **neither helped nor suppressed here — it duplicated.** Had I
read it first I could not have claimed the finding as mine, and you could not have
measured that the record's biggest measurement hazard is independently discoverable. That
is an argument for the cold-pass protocol paying for itself on this run.

## R2 — Where the scaffolding CHANGED MY ANSWER (and tightened it)

Brief lines 120–129 name the three founding cases and instruct me to exclude them. **My
cold §4.2 said the independent Pass B instances were B3, B4, B5 — "three, which is exactly
the number of memorable cases the coordinator said he had."** I flagged that as suspicious
without being able to confirm it.

It is now confirmed. **B3 *is* founding case #1:**

```
reports/reconcile-urlbindingscan.md:785
"I attributed the 15-entry gap to `ls -1` excluding dotfiles. **That mechanism is real
 but partial,** [it accounted for 9]"
```

Matches case 1 exactly (gap of 15, dotfiles account for 9, other 6 created between
censuses). So B3 must be excluded from the base rate as instructed.

**Corrected Pass B base rate: 2 independent instances (B4, B5) in 627 pre-aphorism files.**
The cold estimate of 3 was inflated by one founding case I could not identify while blind.
The scaffolding **helped**, and it moved the number in the direction *against* your
hypothesis.

## R3 — [RECONCILE] THE BRIEF'S "SHARPEST CELL" DOES NOT REPRODUCE

Line 103: *"Intersecting closure language with conservative-bound language gives **12
lines**, which I believe is the sharpest cell."* You told me to consider starting there.

Running the vocabulary exactly as printed at line 101–102:

```
CL='ruled out|no carrier|cannot be reached|unreachable|zero hits|no readers|no consumers|refuted|falsified|nothing reads|nothing writes'
CB='at most|no more than|worst[ -]case|upper bound|bounded (by|above)|cannot exceed|fewer than|strictly less'
grep -rnEi "$CL" reports briefs --include='*.md' | wc -l                    #  615   (brief says 1049)
grep -rlEi "$CL" reports briefs --include='*.md' | wc -l                    #  176   (brief says  201)
grep -rnEi "$CL" reports briefs --include='*.md' | grep -Ei "$CB" | wc -l   #    1   (brief says   12)
```

The single intersection line is **my own report**, written at 08:15. Excluding it, the
sharpest cell is **empty**.

I tried to make your numbers reproduce and could not:

| reading | closure lines | files | intersection |
|---|---|---|---|
| `reports`+`briefs`, line-level | 615 | 176 | **1** |
| whole project dir | 3030 | 239 | — |
| file-level intersection, `reports`+`briefs` | — | — | **37** |
| file-level intersection, whole project | — | — | **88** |
| **brief's claim** | **1049** | **201** | **12** |

**No reading produces 12.** The per-file density list at lines 110–113 fails the same way:

| file | brief | measured | mtime |
|---|---|---|---|
| `reports/preserve-bundle.md` | 29 | **39** | 08:07 (still being written) |
| `reports/review-194-r11.md` | 28 | **26** | 03:45 |
| `reports/test-194-r11.md` | 22 | **15** | 03:47 |
| `reports/test-xss-r4.md` | 19 | **12** | 02:57 |
| `reports/review-xss-r4.md` | 18 | **12** | 02:56 |
| `reports/audit-194-r11.md` | 15 | 15 ✓ | 03:47 |
| `reports/xss-r5-audit.md` | 14 | **10** | 05:18 |

**Five of seven are wrong, and the direction rules out drift.** Four of those files have
not been modified since 03:47 or earlier — hours before the brief. **A static file cannot
shrink.** So the vocabulary printed in the brief is not the vocabulary that produced the
brief's numbers.

This is a §6 finding and I am adding it as **6.8**: the brief states *"A MEASURED FIELD IS
PASTED FROM THE OUTPUT OF A COMMAND, WITH THE COMMAND SHOWN"* and then supplies five
measured fields with a vocabulary but no command, all five of which are wrong. **The rule
was violated in the document that promulgates it**, and the violated field was labelled
"the sharpest cell" and offered as my starting point. Had I taken the offer, I would have
spent the run reconstructing a cell that does not exist.

## R4 — [RECONCILE] THE ADDENDUM'S CALIBRATION CHECK, ANSWERED HONESTLY

You asked: did my cold pass surface anything of that shape, and if not, is the shape rare
or is my instrument blind? **You named the two answers and said only one is reassuring. I
have the unreassuring one, with a receipt.**

The instance is **in my population.** It is `reports/preserve-bundle.md` §8 (lines 276–345):
the 348 unreachable commits, the 126 contained nowhere, `git fsck --unreachable`, the
reflog-roots undercount. My cold pass did not surface it. And:

```
grep -cFi -e 'absence of evidence' -e 'grep found no' -e 'zero hits' -e 'the zero is' reports/preserve-bundle.md   # 0
grep -cEi 'at most|no more than|worst[ -]case|upper bound|bounded (by|above)|cannot exceed' reports/preserve-bundle.md  # 0
```

**Zero hits from every instrument I ran, on the single best-attested instance in the
corpus.** That is a measured false-negative, not an estimated one.

**And it sharpens your hypothesis rather than confirming it.** You proposed the failure
axis was *finished reports vs. live work* — that a documentary sweep looks in the wrong
place. That is not what happened: the instance is in a finished report, in my population,
and I swept it. The actual axis is **epistemic vocabulary vs. domain vocabulary.**
`preserve-bundle.md` expresses the cheap/expensive gap perfectly at line 305 — *"can sit in
a store while being unreachable from its refs and therefore absent from the bundle"* — but
in the language of refs and bundles, not the language of evidence and inference. **My
instruments find authors who are *talking about* epistemics. They cannot find authors who
are simply *doing* it.**

That is the correction to your brief's method, and it is a worse problem than the one you
proposed, because moving the sweep to live workstreams would not fix it.

## R5 — [RECONCILE] THE MAGNITUDE-FIRST CORRECTION IS RIGHT, AND IT INVALIDATES PART OF MY §4

Addendum lines 83–95 are better than the brief's Pass B and better than anything I built.
Two consequences I must accept:

1. **My Pass B instrument only finds partial causes that were eventually *caught*.** B4 and
   B5 are both documents *reporting* an incompleteness. A partial cause never noticed
   leaves no trace in the vocabulary — it reads as a clean closed question. So my "2 in
   627" is not a rate of occurrence; **it is a rate of detection**, and the two differ by
   an unknown factor.

2. **Your selection effect (addendum line 100) is the decisive one:** *"The ones that fit
   are the ones still in the record."* Your save depended on 18-vs-9 being conspicuously
   the wrong size. Every partial cause with good arithmetic luck is, by construction,
   indistinguishable from a complete one — in the record and to me.

**Revised §4.2 verdict:** the claim "Pass B does not recur at the implied rate" is
**withdrawn as unsupportable in that form.** What I can defend is narrower and I will not
overstate it: *the Pass B **vocabulary** is 90 minutes old and mostly your own sentence
propagating; the detected independent instance count is 2 in 627 files; and the
undetected count is not estimable by any instrument in this report.* The honest answer to
"does Pass B recur" is **unknown, and my cold §4.2 was more confident than the evidence
allows.** Scaffolding verdict: **it suppressed nothing and corrected a real overreach.**

## R6 — [RECONCILE] WHERE I DISAGREE WITH THE ADDENDUM

Addendum lines 61–64: *"A set of examples selected by one person for being persuasive is
not a sample."* Agreed, and I applied it. But the caution is aimed only at the base rate.
**It applies equally to the class definition itself.** All four cases were selected for
fitting the sentence "the thing that stops the search is the thing that survived
checking." A class induced from four hand-picked instances and then confirmed by searching
for that class in the record is the Pass B failure at the level of the *investigation*: a
cause that is real, fits the evidence, accounts for part of the effect, and closes the
question. **Your unifying sentence is itself a true-but-incomplete cause**, and §4.4's
reframing — *a bound that arrived from somewhere else* — is my attempt to name the part it
does not cover.

## R7 — SCAFFOLDING VERDICT (the thing you are actually measuring)

| section | effect | evidence |
|---|---|---|
| `.preimage` warning (L115) | **redundant** | found cold, §1.2, and characterised further |
| three founding cases (L120) | **helped** | corrected Pass B base rate 3 → 2 (R2) |
| first instrument, "3571 is the word because" (L91) | **helped** | I independently refused a union denominator (§1.4); your framing confirms it |
| second instrument / sharpest cell (L99) | **would have suppressed** | 12 is unreproducible (R3); it would have consumed the run |
| density file list (L110) | **would have suppressed** | 5 of 7 wrong (R3); would have mis-aimed sampling |
| addendum Pass C instance | **helped, decisively** | exposed a measured false-negative in all three of my instruments (R4) |
| addendum magnitude-first (L83) | **helped** | forced withdrawal of an overconfident §4.2 (R5) |

**Net: the scaffolding helped more than it suppressed on this run — but the two items that
would have suppressed are the two quantitative ones, and both are numerically wrong.** The
prose in your scaffolding is reliable; the numbers in it are not. That is the actionable
form of tonight's measurement, and it is consistent with your own §6 request: my framing is
a claim like any other.

## 6.8 — ADDENDUM TO "WHERE THIS BRIEF WAS WRONG"

Added post-reconcile, detailed in R3: **five of the brief's seven per-file density figures
are wrong, the closure-line count (1049) and file count (201) do not reproduce (615/176),
and "the sharpest cell — 12 lines" is empty under the vocabulary the brief prints.** The
brief supplies these without the command, in violation of its own receipts rule stated at
line 73. This is the most consequential error in the brief because it was offered as a
starting point.
