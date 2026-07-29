# EM verification tooling — Farm Table task-state-model workstream

These are the harnesses and pre-registered predictions the engineering manager used to
verify its own claims during the #191/#194/#195/Phase-2 rounds. The coordinator asked
that this be recorded as infrastructure the project keeps using, not a one-off save.

**Why this directory exists at all:** every one of these files was originally written to
`/workspace`, which is *not a git repository* and dies with the container. The tool built
to prevent artifact loss was itself an unpreserved artifact. Copied here (shared volume,
survives container GC) with per-file sha256 verification — 16/16 matched. Queued for
repo inclusion in the cleanup branch.

The prediction `.txt` files matter as much as the scripts: they are the **only evidence
that a prediction preceded its measurement**. A prediction reconstructed after the fact
is a post-hoc tally, which is one of the six failure forms catalogued below.

---

## `orphan-scan.sh` — detect reviewer commits one `rm -rf` from gone

**Problem it solves.** An agent's report file lives in the shared scratchpad, but its
project-log *commit* lives only inside that agent's clone. Deleting the agent is then
destructive. This was not hypothetical: the entire three-leg review record for #191
round 2 was found surviving only in three clones, for a task already marked COMPLETED.

**Design.**
- `SAFE` = project-log commits reachable from any ref in canonical `/workspace/farmtable`
  **or** from any `refs/preserve/**` in `/workspace/farmtable-em-verify195`.
- `RISK` = project-log commits reachable from some agent clone's refs, minus `SAFE`.
- Set arithmetic on SHAs, deliberately: **SHA sets are comparable across repositories;
  ancestry queries are not.** `git merge-base --is-ancestor` only works where both
  objects exist.

**Void-run guards — it ABORTS rather than printing a clean zero when:** there are 0
preserve refs (wrong glob or wrong repo), 0 canonical project-log commits (wrong path),
or 0 clones scanned (wrong glob). Each of those would otherwise yield a confident,
meaningless green.

**Positive control (`EXCLUDE_PRESERVE=1`) — the important part.** Drops the preserve refs
out of `SAFE`. Prediction registered in `orphan-scan-prediction.txt` *before* any run.

| run | at-risk | `89306d0` present? | what it proves |
|---|---|---|---|
| control (`EXCLUDE_PRESERVE=1`) | 41 | yes | the detector **can** say AT RISK |
| real | 7 | no | the preserve ref **actually rescues**, not merely exists |
| after preserving all 7 | 0 | n/a | genuine all-clear |

**A zero from this harness means something only because the same harness produced 41.**
That is the whole design. Re-run the control whenever the script changes.

**Standing rule: run before any agent GC, every round.**

### The selection predicate nobody was validating — found late, and right by luck

For its whole life this script chose trees with `[ -d "$d/.git" ]`. **Git worktrees have `.git`
as a FILE, not a directory**, so it silently skipped **114 of 172 trees** and reported
"clones scanned: 57" as though that were the population. Measured after the fact: all 114
point at the canonical repo, share its object store, and hold **0** project-log commits
outside canonical's `--all` — so the result was never wrong.

**It was right by luck, not by design.** The filter was asking "is this a git repo?" —
worktrees *are* git repos — and the answer only holds because worktree refs *are* canonical
refs, which the script never reasoned about and no output ever stated. Three things made it
invisible:

- **The void-run guard only fires at ZERO.** 57 looked healthy. A guard against emptiness
  cannot detect a population silently cut by two thirds.
- **The positive control is on a different axis entirely.** `EXCLUDE_PRESERVE=1` exercises
  the SAFE-set logic. **Nothing in the harness ever exercised the clone-selection logic.** It
  is the night's own oracle lesson turning up inside the tool built to enforce it: a control
  that fires tells you the detector is not dead, and nothing about the axis it doesn't touch.
- Nobody compared the scanned count to the population. `ls -d /workspace/farmtable-* | wc -l`
  said 174 all night.

Fixed: `-e` instead of `-d`, and the count now prints the split
(`171 (of which worktrees sharing the canonical object store: 114)`). Control re-run after the
change: **59 at-risk**, safe-set correctly collapsing to canonical-only.

> **Rule: a filter that excludes most of its population must SAY SO IN ITS OUTPUT, and the
> reason it is safe to exclude them must be stated where the filter is written.** "Scanned N"
> is not a measurement unless N is compared to the population it was drawn from. Print both.

*Prediction discipline note:* the fix was predicted to yield 172 scanned; it yielded 171. The
delta was the verify repo excluding itself — known, and forgotten when writing the prediction.
Recorded because a prediction that misses by a knowable amount is still a miss.

## `merge-verify.sh` — prove a merge lost nothing

Converts the *process* claim "the merge was clean, no conflicts" into a *content* claim:
every changed file's blob in the merge is byte-identical to its blob in the owning leg.
Checks ancestry, commit arithmetic, leg-overlap, union-vs-merged file sets, and
per-file blob identity. Includes a positive control comparing a merged blob against the
**base** blob, which must report a mismatch. Aborts if it examines 0 files.

"No conflicts" and "nothing was lost" are different claims. Only the second matters, and
only the second is checkable after the fact.

## `em-gate-194*.sh` — pre-merge build/test gates

Superseded but retained: `em-gate-194.sh` v1 is itself a **worked example of a void
harness** (`/usr/bin/time` exited 127; the gate reported success). Kept deliberately as
a specimen.

## Prediction files

`orphan-scan-prediction.txt`, `merge-completeness-prediction.txt`,
`combined-prediction.txt`, `prediction-195-r7.txt`. Written before the corresponding
measurement, each naming explicit falsifiers.

---

## The rules these encode

Learned expensively; each has a specific incident behind it.

1. **Positive control before any negative claim.** A detector that has never reported a
   problem cannot support "no problems."
2. **A harness must ABORT on a failed prerequisite**, never continue and report green.
3. **Exit codes come from the child process, never through a pipe.** `npm test | tail`
   reports `tail`'s status.
4. **Verify content, not exit status.** After `git fetch`, assert the SHA is reachable.
   A refspec silently mangled by zsh's `:r` parameter modifier
   (`$br:refs/...` → `refs/heads/<br>efs/preserve/...`) would otherwise have recorded
   seven preservations that never happened — **with a correct-looking count.**
   Always brace-quote: `${br}`.
5. **Compare SHAs, never counts.** One preserve attempt produced the *correct count* (29)
   with the *wrong commit*. The tally passed; only SHA equality failed.
6. **Predict counts BEFORE measuring**, from a source independent of the run itself.
7. **Content-address, never line-address.** Report line numbers drift; anchors don't.
   Abort if an anchor is not unique.
8. **Assert ancestry before using `git diff A B` as a range.** `git diff` will compare
   two *divergent tips* and present the difference as a change. That artifact fabricated
   a 68-line "deletion" — and, by luck, is how the first orphaned commit was found.
9. **"Clean" is not "unchanged."** Verify against an out-of-repo pristine copy.
10. **"Confirmed done" must include "its commits are reachable from somewhere durable."**
    A report file existing is not that.
11. **Quote every glob passed to a command.** `grep -rn foo dir/ --include=*.go` under zsh
    is glob-expanded by the shell before `grep` sees it, and returns **empty output with
    no error**. Three greps in a row returned nothing and the only reason it was caught is
    that the answer was already known. It will not always be. Write `--include='*.go'`.
    This is the same family as the `${br}` incident in rule 4: **the shell mangling an
    argument silently is the single most common source of confident wrong output here.**
12. **Unexpected *identical* output from sources that should not correlate is a check-bug
    signal, not a coincidence.** A content-verification pass over three independent review
    legs reported the same filename at the same 1899 bytes for all three — because it
    selected the alphabetically-last path rather than each commit's own new file, and would
    have printed those clean identical numbers whether or not the entries existed. Three
    independent legs cannot produce byte-identical output. Treat any unexplained agreement
    between things with no shared cause as evidence about *the instrument*, and go and find
    the shared cause before believing the result. (Rule 1's converse: a detector that
    reports the *same* thing about everything is as broken as one that never reports.)
13. **Capability-loss is not data-loss, and only one of them is scannable.** Every tool here
    protects *artifacts*: commits, reports, refs. Deleting a live agent loses something no
    preserved artifact restores — **the ability to produce an answer that was never asked
    for yet**. A review leg was GC'd with all its commits safely reachable and orphan-scan
    clean, and the loss was total anyway: its findings had been adjudicated, but adjudication
    is exactly what generates the *next* question, and there was no longer anybody to ask.
    The night's deepest methodological result (the oracle insight) came entirely out of
    post-report follow-up, not out of the report.
    **`orphan-scan.sh` catches the first kind and is structurally blind to the second.**
    Operating rule, ruled by the coordinator: *GC a review leg once its findings are
    adjudicated AND its fix leg has **landed**, not merely started* — with a resource-pressure
    override if agent/container counts become their own risk. Do not read a clean orphan-scan
    as clearance to delete; it answers a narrower question than the one being asked.
    (This is form (3): a correct check answering a question nobody meant to ask.)
14. **A filter must state the size of what it excluded, and why excluding it is safe.**
    See "The selection predicate nobody was validating" above — this tool skipped two thirds
    of its population for its entire life and printed a healthy-looking number throughout.
    "Scanned N" is not a measurement until N is compared to the population N was drawn from.
    **14a — and the population must be established by an instrument the filter does not
    share.** Immediately after writing rule 14 I "verified" the scanner's glob by comparing
    its output to `ls -d /workspace/farmtable-*` — *the identical glob the scanner uses*.
    That comparison could not have detected a clone living outside the glob no matter what
    was out there; it is **form (1)** in the population check I had just built to catch
    form-(1) errors. Re-measured against all of `/workspace/*/` instead: **177** dirs, 174
    matching, and the 3 non-matching are `downloads` (no git), `shared-dirs` (no git), and
    canonical `farmtable` itself (deliberately the SAFE-set source). A `find -maxdepth 3`
    for nested `.git` outside the glob returns only canonical. **The glob is correct — and
    for the second time in an hour I had confirmed it with an instrument that could not have
    contradicted me.** Getting the right answer twice from a blind check is not two
    successes; it is one unexamined habit.
15. **"The fix for the check was checked the same wrong way" is its own failure shape.**
    Distinct from the original bug and from the rule written to prevent it — three layers,
    and the middle one is the dangerous one because it *feels* like verification. The
    sequence here: (a) the glob bug; (b) the verification of the fix, which shared the
    fix's blind spot exactly; (c) rule 14a. Layer (b) happened **twenty minutes after**
    writing the rule against precisely that error, *while actively looking for it*. The
    coordinator's read: not a lapse in attention — evidence of how easy the trap is to fall
    into while staring straight at it. Which is why 14a is phrased structurally ("use an
    instrument the filter does not share") rather than as a reminder to be careful.
    **When you fix a check, the fix needs its own independent oracle. Inheriting the
    broken check's instrument to confirm its own repair is the default, and it is wrong.**
16. **A superseded script that still runs is not superseded.** A corrected copy existing
    somewhere does not protect you while the broken copy is still on disk, reachable and
    callable. `merge-verify-r7.sh` had carried the `--diff-filter=M` guard for hours;
    `merge-verify.sh` sat beside it without it, equally runnable, and would have been the
    obvious thing to reach for by name. Version drift between "the one I remembered to
    update" and "the one that is actually on disk" is a hazard **independent of whichever
    bug prompted the fix**. Either delete the old copy, or fix it, or make it refuse to run.
    *(Swept: the three `em-gate-194*.sh` copies differ only in the `R=` path on line 11 —
    md5s differ, logic identical, no drift. Recorded as a clean negative.)*
17. **A false rationale survives longer than a false result, because nobody re-derives a
    reason that reads as settled.** `merge-verify-r7.sh`'s header justified its own control
    fix with "in round 6 the first file was an ADDED file". **Measured false**: that file is
    status `M`, `rev-parse` returns a bare SHA, and it *is* `head -1`. The fix was correct
    anyway — `head -1` *can* select an added file — so this is a **right fix for a false
    reason**, and the danger is precisely that the right outcome retro-validates the wrong
    reasoning. Nobody checked whether the fix covered the *real* hazard, because the stated
    hazard looked handled. It happens to. That is the third "correct by luck" of the night.
    Same shape as the false-rationale comments the #195 legs keep finding in
    `markdown.test.ts` — one of which was written *in the commit whose message was "correct
    two false rationales"*. **Now confirmed in my own tooling, not just theirs.**

### Testing the generalization instead of accepting it — and finding it too strong

Three principles found in review legs turned up in this tooling within an hour of being
named: the oracle blind spot, the same-axis control, the false rationale. That invites the
generalization *"every principle from reviewing others' work shows up in my own tooling."*
It is flattering, it is a **prediction**, and it is falsifiable — so it was tested rather
than accepted, by deliberately running the remaining standing bars against these scripts
instead of waiting for the next one to surface by accident.

**It does not hold in the strong form. Two bars came back clean:**

- **"Exit codes from the child, never through a pipe."** All four `_EXIT=$?` lines in
  `em-gate-194*.sh` sit directly beneath a redirect-only command with no pipe. Clean.
- **`echo "RUN$i exit=$? dataraces=$(grep -c ...)"`** *looked* like the bug — `$?` sharing a
  word with a command substitution. **Measured:** shell expansion is left-to-right, so `$?`
  resolves before the substitution runs. Control `(exit 42)` → prints `42`; reversing the
  order prints `1` (grep's status), which confirms the mechanism rather than just the result.
  **Correct as written.**

**Recording clean results with the same weight as findings.** A sweep that reports only hits
is itself suspicious, and an unfounded worry that is never gone back to is an open question,
not a non-issue. The honest shape of the pattern: *several* shared blind spots, not all of
them — and the three that were found came from **accidental** collision during other work,
while the **deliberate** sweep of the exit-code bar found nothing. Same author, same
pressure, genuinely shared failure modes — but not universally shared, and the difference
is only visible if you go and look at the ones you expect to be clean.

> **Rule 18 — a report log is a hit-only instrument, so any rate computed from it is
> survivorship bias wearing a measurement's clothes.** The coordinator's own diagnosis of
> why their generalization was too strong: *"the population I generalized from was
> implicitly 'things that turned out to be findings', not 'things that were checked'."*
> The observation instrument was the message thread, which reports hits and never clean
> sweeps — so a summary of it necessarily looks like ~100%. **This is
> oracle-defines-the-search-space one level up**, applied to the record of the search
> rather than to the search. It generalises past this thread: **every artifact in this
> directory is hit-biased.** The taxonomy's "eleven confirmed instances" has no denominator
> — nobody has ever recorded how many checks were examined and found sound — which makes it
> **form (6): a confirmed lower bound reported as a count**, in the ledger of forms that
> names form (6). *Remedy adopted: record clean sweeps explicitly, with the same weight and
> in the same place as hits, so the denominator accumulates instead of evaporating.*

*Sub-finding, my own probe:* the first version of the expansion test used `/dev/null` and
returned an empty count, which briefly looked like a second defect. `grep -c` on `/dev/null`
prints nothing; on a real file it prints `0`. **The misleading value came from my test
fixture, not the code under test** — chased rather than assumed, which is the only reason it
did not become a false finding reported upward. Form (2): a fixture that cannot express the
input.

### 19–22. Four shapes from the round-8/round-9 boundary

> **Rule 19 — a principled-sounding error bypasses scrutiny that a factual error would
> trigger.** My brief told a developer that an existing test was "vacuous — it cannot fail",
> quoting the true general principle *a test that cannot fail is worse than no test*. The
> specific application was **false**: the test caught the defect it was written for. Had the
> developer complied, real coverage would have been deleted **on the authority of a true
> principle wrongly applied**. The coordinator's framing, adopted verbatim: *a false fact
> misinforms, and a competent reader can still catch it by checking the world; a false
> principle hands over permission to act.* The reader's skepticism gets spent checking whether
> the principle is true — which it is — rather than whether it **applies here**. *Remedy: when
> a brief invokes a principle to license destroying something, the principle and the
> application need separate evidence, and the application's evidence must be a measurement.*

> **Rule 20 — a check run on the host cannot falsify a defect that exists only in the guest.**
> I created three review clones with `git clone --shared`, verified each (HEAD, clean tree,
> assets present), and launched. All three legs immediately reported the object store as
> **empty**. `--shared` writes a **host path** into `.git/objects/info/alternates`; each leg
> bind-mounts its clone *at* `/workspace`, so that path does not exist inside the leg's
> namespace. The directory was never deleted — it was present from where I stood, which is
> exactly why my verification passed. **My standing rule R14 ("never put a host path in a
> brief") did not fire because git wrote the path, not me.** The rule was scoped to brief prose;
> the hazard is any host path in **anything the leg will read**, including files git generates.
> Form (1), in the launch procedure itself: the instrument shared the very property — a host
> filesystem view — whose absence was the defect. *Remedy: clone without `--shared`, and make
> "no `.git/objects/info/alternates` exists" an explicit launch check.* Sweep of all 180
> workspace directories afterwards: **0 remaining** — recorded per rule 18 as a clean sweep, and
> the affected population was exactly the three clones created that night.
>
> Note also what the legs got right and I would have got wrong: their inference *"that
> directory no longer exists"* was **correct from inside their namespace and false about the
> world.** Two containers can hold irreconcilable true beliefs about one filesystem, and neither
> is lying.

> **Rule 21 — a fix can be class-shaped in the source and instance-shaped in effect, when a
> caller does the callees' work.** Round 8 of #195 routed five scanners through one shared
> blinding helper: textbook class fix. Round 9 measured it and found **three of the five call
> sites had no unique coverage at all** — the caller pre-blinded its input once, so deleting the
> blinding *inside* three scanners changed nothing; they were handed an already-blinded string
> and their own logic was unreachable. Mutations of three of five scanners came back GREEN.
> *Remedy: for every shared helper, mutate each call site independently and require distinct
> attribution. "They all call the same function" is a claim about the source; "each one's use of
> it is load-bearing" is a claim about behaviour, and only the second is worth anything.*

> **Rule 22 — REFUTED BY MEASUREMENT AND REPLACED. See rule 22′ below.** The original text
> read: *a loop is non-vacuous exactly when something asserts its result for an input whose
> answer is known in advance*, inferred from emptying six tree-wide scans and finding five
> GREEN, with the single RED being the only loop compared against a known count. **Six data
> points, all loops, no denominator.** Kept here rather than deleted, because the way it failed
> is the lesson: it was a rule generalised from the only population that had been measured.

> **Rule 22′ (replaces 22) — a loop is non-vacuous exactly when some assertion REQUIRES A
> POSITIVE OUTCOME from it: a non-zero count, a named offender, a specific result. A loop whose
> assertion only ever PERMITS an empty result cannot fail when emptied.** Established by a
> census **with a denominator** — every loop and every fixture table in the file, not a sample:
> **49 loops, all mutated, 26 vacuous, 23 RED, 0 type-check failures; 25 fixture tables, all
> mutated, 0 vacuous — including all 8 that carry no explicit guard.**
>
> That split is what refuted the old rule. Under rule 22 the unguarded tables should have
> behaved like the unguarded loops and gone green; they went **25/25 RED**. Rule 22′ explains it
> for free: a fixture table's assertions each demand a *specific* result for a *specific* row, so
> emptying the table removes assertions that were required to produce something. A scan loop's
> assertion is typically `expect(violations).toEqual([])` — which an empty scan satisfies
> perfectly. **The old rule described a correlate of non-vacuity; the new one describes its
> cause.** A rule that explains a split it did not predict beats a rule that merely fits the
> cases it was drawn from.
>
> *Operational form, and the reason this is a design rule and not only a test:* if the only way
> your loop can fail is by finding something, and your suite never asserts that it found
> something, then the loop and its absence are indistinguishable to your suite. **Ask of every
> scan: what assertion would break if this scan silently scanned nothing?** If the answer is
> "none", the scan is decoration regardless of how correct its logic is.
>
> *Two corollaries measured alongside it.* (a) The filed list of instances was **19% complete**,
> not the 40% I had written — 5 of 26, not 2 of 5. I had rounded a guess into a brief and it
> stood for two rounds; form (6) again, mine. (b) A count-pin perturbation loop
> (`for (const delta of [-1,1])`) is itself emptiable, and emptying it **silently disables the
> control that proves the count pins fire** — a vacuity hazard living inside the anti-vacuity
> machinery.

### 23. The SCOPE of a defensive measure is itself an unchecked claim

The coordinator proposed that R14-scoped-to-prose and the `labelNameToID` normalization gap are
the same shape: *"a rule that's true as far as its own writer thought to apply it and silently
narrower than the hazard."* **Tested rather than banked, per the round-8 lesson.**

First I verified the underlying fact myself instead of relaying it — it had been
`[MEASURED-BY-dev-194-r8]` only. Confirmed `[MEASURED]`: `passthrough.go:166` builds the index
with `index[strings.ToLower(string(l.Name))] = l.ID`, and `:201` reads
`s.labelIndex[strings.ToLower(name)]`. No `TrimSpace` on either side.

**And the package contains a sharper fact that was not in the report:** `TrimSpace` *is* used
elsewhere in this same package — `push_prefix_resolution_test.go` even carries the comment
*"TrimSpace is unicode-aware — verified, not assumed"*, and deliberately reasons about U+200B
not being whitespace. So this is not a team that failed to think about whitespace folding. **The
same package normalizes carefully on one path and by case alone on another.** Inconsistent
normalization between two paths is a stronger finding than a uniformly missing one, because the
careful path is evidence the hazard was understood somewhere.

**Verdict on the generalization: the shared core is real, the "same shape" is slightly too
strong.**

- *Confirmed and worth a rule:* in both cases the measure's **domain of application** was never
  written down as a claim, so it was never tested. R14 said "briefs"; the hazard was any host
  path in anything the leg reads, including files a tool writes. `ToLower` said "case"; the
  hazard is any two spellings denoting one label. **Nobody ever writes "this applies to X and
  not to Y" — the scope is implicit in the implementation and therefore invisible to review.**
  This is distinguishable from **form (8)**: form (8) is an enumeration whose *contents* are
  incomplete; this is a rule whose *domain* is narrower than the hazard, and unstated.
- *Where the pairing breaks:* R14 had a reachable correct scope — "any artifact the leg reads"
  is finite and I simply failed to write it. **Normalization has no natural completion**: case,
  whitespace, NFC/NFKC, zero-width, homoglyphs, RTL overrides form an open set with no defensible
  stopping point. A rule that is *narrower than it should be* and a rule that *cannot be
  complete* fail differently and want different remedies — write the scope down, versus pick a
  canonical form and enforce it at one boundary.

*Remedy adopted: when writing any rule or guard, state its scope as an explicit sentence next to
it. An unstated scope is a claim nobody can review.*

**Discipline note, recorded because the temptation was real:** the inconsistent-normalization
finding above is live, unfiled, and directly on the axis I handed `audit-194-r8`. **I did not
relay it.** Injecting a fresh EM measurement into a running leg converts an independent
measurement into a confirmation exercise, which is precisely what the three-way round exists to
prevent (R13). It is held for adjudication after all three reports are in.

### 24. When a hazard is open-set, the fix is a chokepoint, not a checklist

The coordinator's sharpening of rule 23, and the reason refusing the analogy mattered more than
accepting it: **writing down the scope of an open-set hazard converts an unbounded problem into
a false sense of a bounded one**, which is worse than leaving it visibly unaddressed. The
written scope reads as complete, so the next unicode trick it does not mention arrives against a
defense everyone believes is finished.

Tested against tonight's record rather than accepted. **Three supporting instances:**

- **C-1 (#194 r8).** The mirror-correcting fix — make the restrictor agree with the gate — is a
  checklist. The shipped fix derives the restriction from `applyLabelDelta` itself, leaving one
  implementation of the rule: a chokepoint. The docblock asserting "the two must agree" became
  unnecessary rather than true.
- **`BANNED_SINKS` (#195).** A list of forbidden sink spellings, repeatedly found to miss
  spellings of sinks it already enumerates. A checklist against an open set, failing exactly as
  predicted.
- **The standing allow-list finding (#195, unactioned).** "Invert `markdown.ts` to an allow-list"
  *is* the chokepoint form of the same argument, filed rounds ago and still open. Rule 24 raises
  its priority: it is not a nice-to-have, it is the structural version of the fix.

**And one honest counterexample, which bounds the rule.** The taxonomy of forms in this document
is a checklist facing an open set, and no chokepoint exists for it — there is no single place
through which "ways a check can fail to falsify" must pass. **Chokepoints are available when you
control the code path; for classification of failure modes you do not control anything, and
enumeration is all there is.** The correct remedy there is not a chokepoint but **explicit
incompleteness** — rule 18's denominator discipline, and never reporting a lower bound as a
count. So: *prefer a chokepoint wherever a path exists to place one; where none does, say out
loud that the list is open.*

The coordinator's second point, worth keeping separately because it is the argument *for* the
remedy rather than against the alternative: **correctness at one boundary does not propagate to
another by default.** The `TrimSpace`-here-but-not-there finding shows care being reinvented file
by file and failing to arrive. A canonicalization boundary does not merely fix the immediate bug
— it is the mechanism by which care in one place reaches everywhere else.

### 25. "Will this actually run?" is a coordinator-level check, because no leg can answer it

The instance, and it is a good one because nobody was careless. A leg fixing a stored XSS built
exactly the right structural remedy for an open-set hazard: a **tree-wide chokepoint scanner**
that fails on any unapproved `href`/`src` binding anywhere in the tree — rule 24, applied
correctly and unprompted. They wired it into `npm test`. In the *same report*, section 8, they
diagnosed the "nothing invokes this" failure mode **for a different workstream's control**,
noting that its guard file is not in the production tree at all.

Measured from the coordinator's vantage: **the Makefile is untouched on their branch.**
`make test` is `go test ./...`; `make web` is `npm ci && npm run build`; nothing anywhere runs
`npm test`. **The fix for "a control nothing invokes" shipped as a control nothing invokes.**

The attribution matters and the coordinator's phrasing is kept: *competence is a property of a
leg, but cross-branch consistency is a property of the person coordinating branches, and no
amount of rigor inside one clone fixes a gap that only exists in the space between clones.* The
fact that would have told this leg "your scanner will never fire" lived on a **different branch
they had no access to**. There is no diligence they could have applied. Filing this against the
leg would be filing a coordination defect as an individual one, and would teach the next leg to
spend effort on a question it structurally cannot answer.

*Remedy, and it is a standing check rather than advice:* **for every new test artifact any leg
produces, the coordinator verifies that some invoked path actually runs it — naming the path.**
Not "is there a test", not "does it pass", but *what command, that someone or something actually
executes, causes this file to be evaluated?* The honest answer requires knowing the state of the
build tooling across branches, which is information only the coordinator has.

Note the relationship to rule 20. Rule 20 was one vantage point being unable to see a defect in
another (host vs. guest). This is one vantage point being unable to see a **precondition** in
another (branch vs. branch). Same structure — *a measurement is indexed to a tree* — but the
missing thing is not the defect, it is the fact that makes the defect a defect. **Generalised
form: whenever work is split across trees, the properties that span trees have no owner unless
someone is explicitly assigned them.**

### 26. Overlapping oracle arms mask each other — a probe must assert WHICH arm fired

**Rule: a multi-arm oracle read through a single-bit result is only as strong as the UNION of
its arms. Any arm whose triggering inputs are a subset of another arm's can be deleted
undetected.**

Measured, and the measurement is the whole argument. A property `P2` over a label-restriction
function has several arms — *the add was cancelled by the remove list*, *the remove names a
label the snapshot lacks*, and others. A probe drove a deliberately-broken restrictor at it and
asserted that the property objected. Extracting `P2`'s body so the probe could drive the real
definition looked sufficient. It was not: **with the probe still asking only "did something
object?", deleting `P2`'s entire cancelled-by-remove arm left the package at EXIT 0.** The
broken restrictor's output for that input tripped *two* arms at once, so the surviving arm kept
the row failing and the deletion was invisible.

The remedy has two halves and both are required:

1. **Return which arm, not whether.** `p2Violations(...) []string` instead of a `bool`, and
   assert on the violation **text**. Then one row per arm, each input chosen to trip **exactly
   one** arm — inputs that trip two arms are useless for both.
2. **Negative rows.** Assert the property stays *silent* on correct output. Without them, a
   `p2Violations` that objected to everything passes every positive row. This is rule 22′
   applied to an oracle rather than to a loop: the suite must contain an assertion that
   REQUIRES silence, or "always complain" is a passing implementation.

**Where this sits in the taxonomy.** It is not form (1) — the check does not derive from the
thing it checks. It is nearest form (8), but the mechanism is inverted: in form (8) the
enumeration of *cases* is incomplete; here the enumeration of *arms* is complete and the
enumeration of **discriminating inputs** is not. Every arm is present, every arm is tested, and
some arms are still unfalsifiable. Filed as a rule rather than a form because the remedy is a
concrete probe-construction discipline, not a new way of being wrong.

**Two companions from the same round, both cheap and both worth adopting:**

- **Reading the constructor is not reading the accessor.** A leg read `NewLabelMapper`, saw it
  populates every map regardless of the `enabled` flag, and concluded a downstream validation
  was already toggle-independent. Wrong: the *accessor* `StageToLabel` carries its own
  `!m.enabled` guard and returns `""` for every stage when the toggle is off. They caught it by
  **running** the test against the restored base file — exit 1, three subtests RED — after
  having concluded the opposite by reading. A conclusion reached by reading is a hypothesis.
- **Label a green control as a green control, in the source.** A test asserting a stable
  diagnostic over 200 runs *could not fail*, because the code path was order-independent in
  both the shipped and the mutated versions. Rather than delete it, the leg renamed the test
  around the assertion that does kill the mutant and **kept the 200-run half with an in-source
  comment marking it a green control**. A green control that announces itself cannot be
  mistaken by a later reader for protection.

### The vantage-point shape (from rule 20, kept as the coordinator phrased it)

> **Two containers, one filesystem, two irreconcilable true beliefs, neither lying.**

This is *not* a false-belief shape and should not be filed as one. Nobody was wrong about
anything they could see; the world was not uniform across vantage points, and the inference that
looked like an error was **correct reasoning from an incomplete but not mistaken premise**.
Blaming a correct inference for a shared-environment mismatch teaches the wrong lesson to
whoever reads the log later — which is the whole reason the log exists.

## The defect class all of this exists to catch

> **A check that derives from the thing it is checking cannot falsify it.**

**Twelve** confirmed instances in production/test code this phase. **Ten** forms:
(1) a check that cannot falsify what it checks; (2) a fixture that cannot express the
failing input; (3) a correct check answering a question nobody meant to ask; (4) a
transport that succeeds at delivering something nobody wrote; (5) a post-hoc tally;
(6) a confirmed lower bound reported as a count; (7) a comment that documents a
measurement as a property; (8) a fully-fixtured closed enumeration that is incomplete;
(10) the corrected count of an uninspected population; **(11) the oracle's target moves
after the oracle looks at it.**

**Form (11) is on a different axis from every other form in this list, and that is why it
earned a number.** Forms (1)–(10) are all about what a check CAN EXPRESS at the moment it
runs — a structural, permanent limit on the check itself. Form (11) is about WHEN a check
runs relative to the pipeline around it. The check is fully capable of expressing the right
answer and does express it; the artifact it examined is then regenerated by a later stage
before shipping, so a true result at check-time becomes a false guarantee at ship-time.
Every other form is answered by making the check smarter. This one is not answered by
making the check smarter at all.

**Numbering note:** there is no form (9). The ordinal was spent on a proposal that was
examined and **rejected** (see the form-(1) corollary below), and the rejection is part of
the record. Reusing the number would make every historical reference to "form (9)"
ambiguous — which is the same shared-name failure this document catalogues two sections
below. The gap is deliberate. **Burn the ordinal; it is cheaper than the collision.**

**Form (1), corollary — correlated blind spots.** Independent-looking checks built on the
same underlying parsing approach can share a blind spot; agreement between them is not
evidence of coverage unless you know the checks fail for *different reasons*. Measured
instance: an arity pin enforced by both a capture regex and `Function.length` missed the
same declaration — the regex's `[^)]*` truncated at the first `)` inside a parenthesized
parameter type, and `.length` is blind to a defaulted parameter. Two mechanisms, one
declaration, both green, and their agreement read as confirmation instead of as two draws
from a correlated distribution. Worse, each defect made the other's fix look unnecessary:
the fixture that would expose one was unreachable because of the other. **The only tell
that works is a control that fails to go RED.** A green control is a finding, not a pass.

*This was proposed as a ninth form and deliberately rejected.* Form (8) earned a number
because it asks a genuinely different question — not "can this fixture express this input"
but "is the universe of cases complete relative to the real threat surface," a different
axis. This asks no new question: each half is an ordinary form-(1) instance with an input
its mechanism structurally cannot express. What is new is a *composition* observation, not
a new failure mechanism. Eight forms that earn their place.

**Form (7) — a comment that documents a measurement as a property.** The measurement is
real; the generalisation is not; and the comment is then cited as settled ground for a
later decision. Two instances the same night in two different codebases, both written in
good faith by someone who tested one case and generalised, both caught only by
measurement and never by reading. In one of them the false sentence *was* the stated
justification for deferring the fix.

**Form (8) — a fully-fixtured closed enumeration that is incomplete.** One leg measured
all 8 patterns in a banned-sink list firing against the real tree, neutering any one going
red: "a closed enumeration that is fully fixtured." Another leg measured four unlisted
spellings of those same sinks passing green. Both correct — different questions. *Every
pattern fires and the set of patterns is too small.* There is no wrong fixture to point
at; the fixture set derives from the pattern set, so **100% coverage of a closed list is
indistinguishable from completeness, and coverage is the only thing anyone measures.**

**Form (10) — the corrected count of an uninspected population.** *Named by the coordinator;
the instance is mine.* Distinct from form (6) and worth the separate number for a precise
reason: **form (6) is a true statement about the wrong quantity — a lower bound presented as a
total. Form (10) is a true statement about the wrong population — a correctly-counted set of
things that isn't the set that mattered.**

The instance. Assigning a stored-XSS fix, I wrote that the proto declares `string.uri = true`
on **two** fields. A parallel audit independently also wrote "two" — **a different two**. That
much was form (6), and it produced its own lesson: *two independent partial enumerations
agreeing on a count is not corroboration.* So I measured properly and corrected the brief to
**four** (lines 241, 265, 343, 633) and instructed the leg to guard all four.

The leg then reported that one of the four, `Attachment.url`, is a **dead field** — no write
path, no read path, no renderer, proto-only, established with positive controls. My *corrected*
instruction would have delivered one real fix and one no-op, and the count that actually
governed the work was neither two nor four: **annotations (4) ≠ live fields (3) ≠
client-controlled ingress paths (3, and a different 3).** Three populations whose sizes were
close enough to blur together, and I had switched from a wrong number to a right number
**without ever asking which population I was counting.**

The trap is that correcting a count *feels* like completing the work — the visible error is
gone, the new number is defensible, and the arithmetic is now genuinely right. Nothing about
having fixed a count prompts the question *"of what?"* **Remedy: before reporting any
enumeration, name the population in a noun phrase that says what membership requires, and state
what you did to inspect members rather than merely count them.** "Four fields carry the
annotation" and "four fields need guarding" are different claims, and only the first was ever
measured.

**Cross-reference — the same disease, relocated from enumeration to ownership.** A sanitizer
ownership guard requires every file that renders markdown to own a private DOMPurify
instance, and **exempts the markdown module itself by construction**, since that module is
the thing doing the owning. Measured: reverting that module to the shared process-global
sanitizer is **green on the full suite with a clean type-check**, and the reverted tree
reproduces the exploit output quoted in that module's own comments. *The one file that must
own its sanitizer is the one file the ownership guard cannot police.* In form (8) the guard
draws its fixtures from its own list; here it draws its scope from its own definition. Both
are self-referential exemptions, and in both the metric that would reveal the gap is computed
over the very set the gap falls outside of. **Whenever a guard has an exemption, the exempted
case needs a pin of a different kind — never the same guard, and never an argument that the
exemption is self-evidently safe.**

**Form (11) — the oracle's target moves after the oracle looks at it.** *Named by the
coordinator; the instance and both measured arms are mine.* A check whose pass is only valid
for a snapshot the surrounding pipeline does not hold still.

The instance. A Content-Security-Policy pins the sha256 of the dashboard's one inline script.
A hash is invisible coupling — edit that script by one byte and the CSP stays syntactically
valid while the browser silently blocks it — so the author wrote exactly the right guard:
`TestCSPCoversInlineScriptsInEmbeddedIndex` recomputes the sha256 of every inline script in the
**embedded** `web/dist/index.html` and asserts each appears in `script-src`, printing the
correct replacement hash on mismatch. It `t.Fatal`s on finding zero inline scripts, so it
cannot pass by finding nothing. It is a good guard and it is **not vacuous** — proven below.

`web/dist` is gitignored and untracked (`dist/` at root, no negation, zero files in the tree).
It is a build artifact: a fresh clone of the production commit **cannot even compile** —
`assets.go:5:12: pattern all:web/dist: no matching files found`. So the guard's oracle is
whatever `web/dist` happens to be sitting on disk. And in the Makefile, `test:` runs
`go test ./...` then the web suite and **builds nothing**, while the release target `web:`
regenerates `dist` as its *last* step, after any Go test has run for the last time.

Measured, predictions recorded before running, both confirmed:

| arm | predicted | observed |
|---|---|---|
| edit the inline script in **source** `web/index.html`, do not rebuild, run the guard | GREEN | **GREEN**, exit 0 |
| `npm run build`, re-run the guard | RED | **RED**, `need: 'sha256-7w7ypNAs…' have: 'sha256-aOXoiAod…'` |

Second arm proves the guard works. First arm proves it cannot see the edit it exists to catch.
The shipping sequence straight from the committed Makefile is: edit `web/index.html` → `make
test` GREEN against stale `dist` → `make web` rebuilds `dist` → `make build` embeds the **new**
`dist` carrying the **old** hash → browser silently blocks the script. Every step passes.

**Why this is not form (1), and why the distinction is load-bearing.** Forms (1)–(10) describe
limits on what a check can *express*. The remedy for all of them is a better check. Here the
check expresses precisely the right property and returns a true answer about the artifact it
was handed. Nothing about making it smarter helps, because the defect is not in the check — it
is in the **edge between the check and the build step that invalidates it.** The remedy is
therefore always a pipeline ordering change, never a test change.

**The tell.** Ask of every guard: *what artifact is my oracle reading, who writes that
artifact, and does anything write it again between my check and the ship?* If the oracle reads
a generated file, the guard belongs downstream of the generator or the generator belongs
upstream of the guard. A guard that reads build output and runs before the build is a guard
whose green means "the last build was fine", stated as if it meant "this build is fine".

**Relationship to rule 25.** Rule 25 says *will this actually run?* is a coordinator-level
check because no leg can answer it. Form (11) is the sharper successor: **will this run
against the artifact that ships?** A leg verifying one target at a time cannot see it either —
this instance was invisible to its author precisely because they verified MUST 1 (the Makefile)
and MUST 2 (the CSP) separately, and each is correct alone. The defect lives only in the
composition, which is the coordinator's vantage point by construction.

## Coincidental equality at an origin — the shared-name failure

Distinct from the check-that-cannot-falsify family, and worth its own note because **nobody
has to make an error for it to happen.** The general law:

> **When two distinct things share a name and their values or referents coincide at the point
> a series begins, the shared name will produce true and false sentences that are
> indistinguishable by surface form the moment they diverge.**

Two measured instances, different substrate, identical shape:

- **A name shared by a defect and its fix.** Task title "M-1 server discards the operator's
  GitHub label config (LIVE IN PROD)" — the tag meant *the defect* is live. A brief repeated
  the phrasing; a security audit read it as *the fix* being live, hardened it into a premise,
  and made it load-bearing: "that interaction is the reason I rate it High rather than
  Medium." **A severity rating rested on a premise nobody had measured.** Measured against
  `origin/main`: the fix is unmerged. The auditor's own lesson, better than the correction:
  *a fact doing rating work has to be measured, not inherited.*
- **A name shared by two units.** A provenance series in a test file ran 49 → 54 → 59 → 61 →
  69 → 74 → 77. The first four are *checks run*; the last three are *`check()` call sites*.
  The two quantities were **equal at the first entry (49/49)** and silently diverged one
  commit later, because one call site loops over a 2-element list. Three competent readers
  reached three different verdicts on the same line — "an endpoint is wrong", "the line is
  correct", "it should read 68" — and **all three measured correctly.** The conflict was
  manufactured entirely by an unmarked unit change at one point in the series. The fix is a
  unit marker, not a number change.

The transferable part is not "names are ambiguous." It is: **watch for coincidental equality
at a series' origin masking a later unit or referent change.** Equality at the origin is what
makes the ambiguity invisible for exactly as long as it is harmless, and guarantees it will
surface as a disagreement between careful people rather than as an obvious error.

*Detection:* when two careful parties disagree about a fact and both can show their working,
suspect a shared name over a shared mistake. Ask what each is counting, in what unit, at
which revision — before adjudicating who is wrong. Often nobody is.

## The design principle both of the above are special cases of

> **Bind a control to the narrowest thing every path must traverse. If you bind it to a
> caller, you have bought protection only for the callers you enumerated — and the
> enumeration will look complete, because the callers you were looking at are all
> covered.**

Two instances found the same night, in different languages and different subsystems:

- A sanitizer pipeline made its *upstream* dependency private and left the *terminal
  filter* a process-global. The ownership asymmetry was backwards relative to risk:
  poisoning the upstream one is filtered by the terminal one anyway; the terminal one is
  the last line of defence and was the one left shared.
- An authorization narrowing was bound to two request fields in the one handler where the
  bug was reported. Measured: **8 paths reach the underlying mutation; the control is
  bound at 1 of them.** (Positive control: the same grep shape finds 34 handlers.)

In both, the metric everyone reports — coverage — is exactly the metric that cannot see
the gap. The tell is identical to form (8), one level up: there the enumeration is of
patterns, here it is of call paths.

It was first thought that this principle also covered *search strategies* — bind a search to
the axis where the last bug was found and the enumeration looks exhaustive. That framing was
measured and found wrong; the real mechanism is sharper and has its own section below.

*Corollary for reviewers:* "seven other paths are ungated" is usually **not** the finding,
and rounding up to it will get the real finding dismissed. Most other paths are typically
gated by something else. The measured claim is about the control's **blast radius** and
the **reason for it** — that it was bound where the bug was found rather than where every
path must cross.

## The oracle defines the search space

The deepest result of this workstream, and **not** a restatement of "know which axis you
varied." That rule says: state what your attempt list varies before reporting a negative.
This is stronger and prior to it:

> **An oracle is a hypothesis about what could go wrong. Exhausting inputs against a narrow
> oracle only stress-tests that hypothesis — it can never test whether the hypothesis is
> complete. A defect on an axis the oracle cannot draw a distinction along is invisible no
> matter how creatively you vary inputs, because the oracle throws that dimension away before
> comparison.**

The measured instance. A security audit attacked a new authorization narrowing with 19 label
spellings × 2 directions = 38 attempts — Turkish dotless ı, Kelvin sign, zero-width space,
trailing NUL — and reported "0 bypasses, from a harness that demonstrably reports bypasses."
Every one of the 38 was **one label, in one list**. The live Critical needed no exotic
spelling at all: the exact string, correctly spelled, in `add` and `remove` **simultaneously**.

**The obvious diagnosis — the enumeration could not express the input — is wrong, and the
auditor disproved it by measurement.** Its detector already accepted both lists. The
counterexample went in with *zero changes* and returned `exploit=false`. Substituting the real
gate as oracle fired immediately, on the same line, with the same input. **The input space was
adequate. The oracle was not.** "Widen the search" would have saved nobody.

The actual defect: **a hand-rolled proxy oracle that reimplemented the function under test.**
It encoded "what did the gate charge?" as a *per-label, per-list* predicate; the real gate
prices *jointly across both lists*. "Cross-list" is not a distinction that comparison is
capable of drawing, so a cross-list defect is invisible to it — **nineteen spellings or
nineteen thousand, same result.**

So the one-dimensionality of the search was a **symptom, not a cause**, and not a failure of
imagination about what to try: spellings were *the only dimension left visible* once the
oracle had discarded the other one. Turkish dotless ı and the Kelvin sign are what
thoroughness looks like when aimed down the only axis the instrument can read.

**Why the positive control fired and still told us nothing — this is the precise part.** A
positive control validates that the detector fires for *something*. It does **not** validate
that the detector's reachable space includes the class the real bug lives in. Here it could
not have: the control was drawn from inside the same narrow oracle's blind spot as everything
else tried, so it was another sample from the one visible axis — not independent evidence
about the axes that were invisible. **A same-axis positive control is not weak evidence; it is
non-evidence for exactly the failure that matters.** That is a real amendment to standing
bar 1, not a footnote on it.

Practice:
- **Where ground truth is executable, the ground truth IS the oracle.** When a control's
  contract is "mirrors function F", the oracle must **be** F, never a reimplementation. A
  reimplementation merely relocates the docblock's "the two must agree" contract into the test
  harness, and inherits the identical risk of disagreement.
- **Draw positive controls from a different axis than the one being searched**, or
  mutation-test the control itself (break it N ways, require the harness to catch all N).
- Still ask what the attempt list varies and holds constant — but ask **first** what the
  oracle is capable of discriminating, because that is what set the dimension.

The sharpest statement of it came from the leg that made the mistake, volunteered against
itself. The production docblock said *"It is exactly the complement of applyLabelDelta … The
two must agree."* The audit quoted that docblock — and then built a verification oracle that
independently reimplemented the very function the docblock said must agree. **"I committed
inside my harness the identical error the code committed."** The bug and the audit that missed
it had the same shape. With the real function as oracle, a *two-element* input space catches
the Critical.

Thirteen void harnesses have been produced on this workstream by agents *and by the EM*.
Every one printed a clean, confident, wrong number. **The only detector that has ever
caught one is a number contradicting something visible** — which is why predictions are
registered in advance and why positive controls are mandatory.
