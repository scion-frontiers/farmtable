# PROJECT LOG — `audit-xss-r8`

**Leg:** `audit-xss-r8` (security audit axis)
**Commit audited:** `901670e3f09ad57386cafb8359017d8d61a75070`
**Branch:** `url-scheme-validation-r8` · **Range:** `e4e3d13..901670e`
**Tree:** `/workspace/farmtable-audit-r8` — never left it
**Report:** `reports/audit-xss-r8.md`
**Verdict:** REQUEST CHANGES — **0 Critical, 0 High, 3 Medium, 3 Low, 3 Info** *(revised 13:32Z:
F1 MEDIUM→LOW after I retracted its central claim as false — see §4 item 6. Verdict unchanged; it
now rests on F3 and F8 alone.)*

Written because the brief says legs skip this unless told, and then the reasoning is lost. This is
the reasoning, including the parts that did not work.

---

## 1. ORDER OF WORK

1. Read `_r8-COMMON.md` in full before running anything, as ordered.
2. Verified the apparatus claims myself before trusting them (§5). All confirmed: zsh 5.9,
   `multios=on`, `bareglobqual=off`, ugrep 7.5.0, mawk 1.3.4. Used `$options[multios]` rather than
   the `setopt | grep -c` form the brief documents as broken.
3. Read the role brief.
4. Cold pass. Written to disk **before** opening `_r8-PHASE-TWO.md` or any r7 artefact.
5. Opened Phase Two, reconciled, revised two findings downward, added two new ones.

The split worked exactly as the EM intended. Concrete evidence that it worked: my cold pass
produced F1 (executor absence), which Phase Two then **corrected** — and my cold pass independently
produced r7's F9 (`graph_support.go`) without having read r7. Neither of those happens if I read
the findings file first.

## 2. HOW I CHOSE WHERE TO LOOK

The role brief's framing did the work: *"a capability sink is not a render sink."* That told me the
diff's subject was authorization, not rendering, and that a render-sink sweep would come back clean
for structurally uninteresting reasons. So I ran two passes deliberately:

- **the axis the diff is on** — capability/write-authorization: `writable`, `getCapabilities`,
  `isCollectionWritable`, `graph_queries`, the import path.
- **the axis the branch is named for** — stored XSS render sinks, which nobody was assigned and
  which the diff does not touch. That is where F4 came from.

The single highest-yield question was the brief's first one — *what goes RED tomorrow?* — because
it is a question about **executors**, and executors are cheap to measure and almost never measured.
Three of my nine findings (F1, F3, F8) are executor-absence findings. **None of them required
understanding the diff.** That is worth generalising: the fastest route to a real finding on this
project has been to ask what runs a guard, not what the guard says.

## 3. THE FINDINGS, AND WHICH ONES I RATE

- **F8 (10 of 15 capability flags enforced nowhere)** is the best thing in the report and I did not
  have it at cold pass. It came from following up a **routed** item (r7 F2, `canEditRelationships`)
  instead of accepting the routing. r7 found one unenforced flag; the population is ten. The
  routing decision was taken against n=1.
  **Lesson: a routed finding is a claim about scope, and scope claims are as checkable as any
  other. Nobody had counted.**
- **F4 (markdown/DOMPurify unpinned)** is the only *render-sink* finding, is pre-existing, and is
  the one thing on this branch's nominal subject. Eight rounds of URL-scheme work have built a
  serious apparatus around `href` bindings while the two `unsafeHTML` sinks sit behind one unpinned
  line that the tree-wide scanner **documents itself as not covering**. The exclusion is honest and
  written down; it has just never been closed.
- **F1** was my cold-pass headline and reconciliation **weakened it**. See §5.
- **F5** (`graph_queries`) I rate as a *verification* rather than a discovery: the diff makes a
  falsifiable inertness claim, I tried to falsify it, and it held. I also closed a sub-question the
  r7 note left open (`CreateCollection` does not wire `RemoteData`, so the two halves cannot meet).
  A verified claim is a result and I logged it as one.

## 4. WHAT I GOT WRONG

**Recorded in full because a log that only contains successes is not evidence of anything.**

1. **A false-clean sweep I nearly published.**
   `git log --all --oneline --diff-filter=A -- '.github/workflows'` returned empty, and I read it as
   *"a workflow file has never existed in this repository."* **False.** `cc92735` contains
   `.github/workflows/ci.yml`; it is simply unreachable from any ref in my clone
   (`git rev-list --all | grep -c` → 0). `git log --all` walks refs, so it fails **silently toward
   clean** on unreferenced objects. Caught only because I checked the cited SHA directly rather than
   trusting my own negative. Had I published it, F1 would have been *overstated* — I would have
   claimed CI never existed when it exists and is simply not on this branch.

2. **I over-read F2 and had to withdraw its central accusation.** I measured "unreachable from refs
   in my clone" and let it drift into "not a real thing" while writing the finding. The measurement
   was sound; the interpretation was not. `doc.go`'s sentence is correct and correctly scoped, and
   my proposed rewrite would have made it worse. **The drift happened between measuring and writing,
   not at either end** — which is why re-reading my own instrument output during reconciliation
   caught it and re-reading my prose would not have.

3. **My pre-registered withdrawal condition was badly specified.** I pre-registered that F1 falls if
   shown an executor "reachable from `901670e`." The true answer — CI exists on main, this branch
   has diverged from it — does not satisfy that phrasing, so a correct rebuttal could not fire my
   own withdrawal. **A withdrawal condition that the true answer cannot satisfy is not a control, it
   is a ratchet.** Anchor it to the question, not to the artefact in hand.

4. **I nearly manufactured a disagreement out of a units error.** The adjudication says "two
   producers"; r8's comment says "three". Different populations — import `doc` producers vs
   GITHUB-platform *collection* producers. Both correct. I caught it by asking what each number
   counted before writing it up, but I had already drafted the accusation. Given the EM explicitly
   prizes disagreements, **the incentive gradient here runs toward publishing them, and that is
   exactly why a units check has to come first.**

5. **My mutation-arm builder corrupted a second line, and my own diff caught it.** Re-staging the
   two arms at 12:45Z I used `perl -pi -e 's/skipDirs\[rel\]/skipDirs[d.Name()]/'`, which is
   unanchored and also rewrote a **comment** 231 lines away, leaving the arms differing in **two**
   lines rather than one. Caught because I diffed the arms before running them instead of after.
   **The original I17 was NOT affected** — it used an exact-match single-line edit, verified unique.
   But the claim I was about to publish, "the arms differ in exactly one line," would have been
   FALSE, and the corrupted line was inert comment text, so **nothing in the test result would have
   looked wrong.** Lesson, and it is the same one this project keeps relearning: *a substitution is
   a selector, and an unanchored selector over a file that discusses its own code will match the
   discussion.* Test files that document their own mutation are exactly where this bites.

6. **THE BIG ONE: I CLOSED A POPULATION ON MY OWN HEADLINE FINDING AND IT WAS OPEN.** F1 said the
   Go-side guards have no automated executor. I enumerated executors as
   `{Dockerfile, Dockerfile.server}`, measured correctly that neither runs `go test`, and treated
   that as the population. **`ci.yml` was a third member, it runs `go test ./... -v` directly, and
   I HAD ALREADY READ AND QUOTED THAT FILE IN §R.6 OF MY OWN REPORT.** The falsifying evidence sat
   inside my own document for three hours. F1 downgraded MEDIUM→LOW; my sentence *"the instrument
   is good and it is wired to nothing"* retracted as false — after the EM had told me it was being
   carried verbatim into the adjudication.
   **Three things went wrong at once and only one is about CI.**
   (a) I applied my own OPEN-UNTIL-PROVEN-CLOSED rule to the round's census claims and **never once
   to my own findings.** The rule was pointed outward the entire time.
   (b) **The finding I was most confident in got the least scrutiny.** F1 was my cold-pass headline,
   it survived reconciliation, the EM praised it, and I then *escalated* it twice — each escalation
   reasoning further from a premise I had never gone back to test.
   (c) **My ADDENDUM A "sharpening" was a valid argument from a false premise**, and it read as more
   rigorous than the plain claim it replaced. *Sophistication in the inference is not evidence for
   the premise, and it disguises the absence of it.*
   **What actually caught it: a rule about something else entirely.** The coordinator's tree-state
   labelling rule forced me to re-open a held figure. Nothing in my own process was ever going to
   catch this, because my process had already marked F1 as settled.

7. **Five r7 findings missed** (F5a, F5b, F6, F7, and F2 at cold pass). Four cluster on the
   `%q`/logging/sampler path, which I never opened. A coherent blind spot, not bad luck: I chose
   reachability and executors and got the depth I paid for.

## 5. WHERE PHASE TWO CORRECTED ME, AND WHY I DID NOT JUST FOLD

Phase Two §4: *"Real main is `cc92735` and CI EXISTS."* That is consistent with every measurement I
took and contradicts none — but it changes what two of them mean. I downgraded F1 (HIGH→MEDIUM) and
F2 (MEDIUM→LOW, accusation withdrawn).

**I did not withdraw F1 entirely, and the reason is a wire fact.** The workflow triggers on
`pull_request` and `push: branches: ['**']`. For a **push**, Actions reads the workflow from the
pushed commit — and `901670e` does not contain the file. Measured: 67 ahead / 12 behind `cc92735`,
`git cat-file -e HEAD:.github/workflows/ci.yml` → does not exist.

The sharp part is that the workflow's own comment says the push trigger exists because *"a gate
that only watches the default branch silently ignores every branch where work actually happens…
a long-lived branch 39 commits ahead of main that nothing has ever compiled."* **That is this
lineage, now 67 ahead.** So the branch the push trigger was written to catch is precisely the branch
it cannot catch, because catching it requires containing the file it does not contain.
**The mitigation and the gap have the same root**, and that only becomes visible if you decline to
fold the moment authority says "CI exists."

This is the failure direction `_r8-COMMON.md` §8 names: *fails toward the last thing authority
broadcast*. Agreement with authority does not present as a result needing a control; it presents as
convergence. I flagged it in my own report rather than trusting myself to remember.

## 6. THE 10:35Z SECTION 7 CORRECTION

Re-read §7 in place before my next control, as instructed.

- **Withdrawn marker rule: cost me zero minutes.** I had planted no markers — none of my zeros were
  over a corpus that records my own commands; they were over source and git objects. I am reporting
  zero rather than inventing a cost. The EM says the ledger has never come back zero on *some* item;
  it is not zero overall (see the report's ledger, item 3, the path conflict), but it is zero here.
- **The new three-state / planted-positive rule was right and did cost me ~10 minutes of rework.**
  I had four published zeros whose positive arms came from *real* tree objects rather than *planted*
  ones. I re-armed all four with `/tmp` fixtures (CTL-A…CTL-D). **CTL-C earned its keep**: its
  near-miss arm (`wrongext.ts` — right token, wrong extension) proved the `--include` bound is real
  and simultaneously exposed that my selector is blind to `*.spec.ts`, a limitation I then had to
  state. I had assumed that bound rather than tested it.
- **Three of the four are receipts, not controls** — added after the clean result they justify,
  which §7 explicitly calls out as weaker. The §7 correction landed after my cold pass was on disk,
  so arming-first was not available for those three. I labelled them receipts rather than dressing
  them as controls.
- **I planted in `/tmp`, never in the tree.** §4 permits adding test files only to `test-xss-r8`.

## 7. PROHIBITIONS — COMPLIANCE

No push. **No file in the tree modified, created or deleted** — I ran no mutating git command at all
(no `add`, `commit`, `stash`, `checkout`, `reset`). No bulk capture of any kind, so the "name every
file" rule never had to bind. No clone, worktree or object store created. Nothing deleted or tidied
anywhere. No `gc`/`prune`/`repack`/`reflog expire`. No filesystem-level copy of a repo or `.git`.
Never read another leg's tree, never touched `/workspace/farmtable`, no contact with the other two
legs. Scratch confined to `/tmp` in my own container.

**CORRECTED 12:40Z.** This paragraph previously ended *"Build token never requested, never held,
never used — nothing compiled, typechecked or executed."* True at delivery, **false after 12:38Z.**
The build token was never requested **because the rationing was lifted at 12:33Z**, and I then ran
`go test ./internal/webguard/` plus a two-arm mutation in `/tmp`. Both are in **ADDENDUM A** of the
report. Verified no environment contamination: `web/dist` ABSENT before and after,
`git status --porcelain` empty, both webguard files still at 10:23 clone mtime. The `/tmp` mutation
copy is **left in place, not deleted** — the freeze says do not tidy anything anywhere, and it is
evidence.

## 7b. THE LESSON FROM THE POST-DELIVERY MEASUREMENT

I marked the task complete with my largest `[UNCHECKED]` still open and a pre-registered condition
hanging off it. Twenty minutes later the constraint that created it was lifted. **Completion is not
the same as closure, and a lifted constraint should re-open every finding that was shaped by it.**
Nothing prompted me to go back — the r9 message even said "no action required from you." The prompt
had to come from my own report.

The substantive lesson is about **which direction a measurement is allowed to move a finding.** The
green could have been read as relief on F1. It is the opposite: I17 proves the unrun guard actually
catches a real defect, so the missing executor now discards something of proven value. **A result
that acquits the artefact can still aggravate the finding, and I nearly filed it as good news.**

And: **I did not stop at the green.** A green only proves the test agrees with the current code. The
round's claim was that it *goes red*, which is a different claim needing a different arm — so I
mutated. **Green is agreement; red-on-revert is discrimination.** That distinction is the whole
content of the brief's "a guard nothing runs is not a guard", one level down.

Two clones (`farmtable-build-r8`, `farmtable-build-base`) were announced mid-pass at 10:41Z.
**Classified as announced; not visited; not a finding.**

## 7c. HANDOVER, 13:47Z — FOUR ITEMS BECAME UNOWNED IN ONE MESSAGE

Reassigned from `farmtable-em-task-state-model-v2` to `farmtable-em-hardening`; the outgoing EM is
re-scoped to the task-state refactor and stated he *"is adjudicating nothing further on this axis."*
**Items travel as-is — but four of them were things HE owned, not things I owed**, and a handover
converts an owed ruling into an orphan silently:

1. **The `reports/` split** (3 leg reports flat, `dev-xss-r8.md` only in `reports/r8/`). He ruled the
   flat path stands and said **correcting the adjudication document was his**. He has stood down
   without doing it.
2. **F8's routing**, to be re-taken with n=10 rather than n=1.
3. **F10**, filed 13:42Z, **never adjudicated by anyone.**
4. **D.3's attribution correction**, sent 13:44Z, three minutes before the handover — **almost
   certainly never read.**

**The observation worth keeping is about timing, not about anyone's diligence.** Items 3 and 4 were
sent in the five minutes before reassignment. **A handover is at its most lossy exactly where the
work is most recent**, because the outgoing owner's last few inputs are the ones they never
processed and the incoming owner never saw. Nothing in the process marks them — they look identical
to items that were considered and closed.

**And the split finding chose its moment.** It is worst precisely at handover: a new owner's first
act is to read the reports directory, a glob returns 3 of 4 with no error, and the missing one is
the **fix leg's** — the single most load-bearing report on the axis. **I led the handover with it
for that reason** rather than filing it in order of severity.

## 8. OPEN, AND WHAT I HAND BACK

- **A ruling on the deliverable path.** `_ADJUDICATION-xss-r7.md` says r8 legs write to
  **[RESOLVED 12:44Z — flat path stands; do not create `reports/r8/`. Report not moved.]**
  `reports/r8/`; my dispatch and role brief name the flat path. I followed the dispatch (§9:
  deliverables "NAMED EXACTLY") and flagged the conflict rather than inventing a directory.
- **F8's routing** should be re-taken with n=10 rather than n=1. Not r8's work.
- **OP-2 is not reproducible at 17.** I get 16 (filename form) / 7 (bare `:NNN` form) / 21 (union of
  distinct lines), and the count of *citations* is higher than the count of *lines*. The noun needs
  fixing before the number does.
- **Tree compilability remains UNMEASURED by me.** ~~routed to the build clones~~ — **that routing
  is VOID (bulletin 19.1 §4: the EM stubbed `web/dist` in both build clones and those greens are
  withdrawn).** ~~Superseded by EM-100, which makes the whole-tree build not pending but impossible~~
  — **also wrong, corrected 13:32Z.** EM-100 is a **pristine-tree** figure: `ci.yml` asserts
  `web/dist` absent, runs `make build`, asserts it was produced, and only then runs `go test ./...`.
  The whole-tree build **is** dischargeable — build the frontend first, as CI does. See ADDENDUM C.
- **Not escalated, surfaced only** (composition rules bar me from calling in other specialists):
  `web/src/util/` and `web/src/utils/` both exist and both hold test files. That is a trip hazard
  for exactly the path-anchored sweeps this project keeps getting wrong.

## 9. THE ONE THING I WOULD TELL THE NEXT LEG

**REWRITTEN 13:32Z. The advice this section used to give was drawn from the finding I later had to
retract, and I am not leaving that standing for the next leg to inherit.**

~~Measure the executors before you read the code… that asymmetry sat in two Dockerfiles in plain
sight the whole time.~~ The Dockerfile asymmetry is real and it was **not the whole population.**
`ci.yml` runs `go test ./... -v` directly. Executor-measurement is still the highest-yield move I
made — but I did it *once*, early, and then never re-opened it while building two escalations on
top.

**So the one thing, and it is not the one I expected to write:**

> **ENUMERATE YOUR OWN FINDINGS' POPULATIONS WITH THE SAME RULE YOU ENUMERATE THE CODE'S.**
> My brief said a population is OPEN until proven closed. I enforced that on the round's census
> claims all night and never once turned it on F1. **A finding is a claim about a population —
> "nothing runs this" is a claim that the set of runners is empty — and it inherits every duty of
> one.** I never wrote down `ENUMERATED = FLAGGED + EXCLUDED` for my own executor set, which is the
> single artefact that would have exposed the gap, because it would have forced me to say where I
> looked.

**The confidence gradient runs the wrong way.** F1 was my cold-pass headline, it survived
reconciliation, the EM praised it and carried a sentence of it verbatim. Every one of those made
me *less* likely to re-open it. **The finding most likely to be wrong in a way nobody catches is
the one everybody has already agreed with** — and by then the cost of being wrong is highest,
because it has propagated.

**And what actually caught it was a rule about something else.** A coordinator bulletin on
*tree-state labelling* made me re-open a held figure; the retraction fell out of that. My own
process had marked F1 settled and would never have returned to it. **Cross-cutting rules that force
you to touch old results are worth more than they look, and their value is invisible to the person
following them.**

Kept from the original, because it survived and is the reason I found the push-path gap at all:
**when the EM tells you a premise, measure it anyway.** Phase Two's "CI exists" is true, and
checking *which trigger* and *against which commit* found a real gap. **But measure it in both
directions** — I checked the premise hard enough to find what CI *misses* and never checked it hard
enough to find what CI *does*. **A one-directional check on authority's premise is how you end up
more confident and still wrong.**
