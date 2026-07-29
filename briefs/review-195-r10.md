# review-195-r10 — code review of `markdown-sanitize-r10` @ `0b52dcd`

**Read `/scion-volumes/scratchpad/projects/farmtable/briefs/_r10-baseline-block.md` FIRST and in
full.**

**You are one of three independent legs.** A test-engineering leg and a security-audit leg are
running in parallel, in their own clones, on the same commit, on different axes. **You will not see
their reports and they will not see yours.** Do not scope around what you assume they cover.

**Your axis is correctness and architecture — and this round makes that unusual.** The diff is
**+1187 / −98 across exactly two files** (`markdown.test.ts` +1071/−98, project log +116/−0), of
which one is the project log. **There is no production code in it. `markdown.ts` is byte-for-byte
unchanged** `[MEASURED — me]`. So the normal review question ("does the code do what the commit
message says") is nearly empty, and the real question is architectural:

> **A single test file is now 1071 lines longer and contains a bespoke generator-based fixture
> framework, two censuses, several magic-number totals and a self-test of its own detector. Is that
> the right structure — and will the next person to touch it be led true or false?**

The mutation work is the test leg's axis. **Where you suspect a test cannot fail, say so and move
on** rather than building a matrix.

The author's report is at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r10.md`.
Form your own view of the diff first, then read it, and treat every claim as unverified.

## What I most want from you

1. **Is `consumeFixtureTable` the right abstraction, or has it added a third source of truth?**
   Count them honestly: each table has a declared length, an `expected` argument at the call site,
   an entry in `EXPECTED_FIXTURE_LOOPS`, and a census in `run()`. The author says they **removed**
   the six now-redundant `fixtureTableViolation` entries "so the magic number stays in one place" —
   **verify that claim by counting the places the number now lives.** If it is more than one, the
   commit message is wrong about its own central design decision, and that is exactly the class of
   thing this project keeps shipping.

2. **The stopping point.** Six of twenty-nine loops wrapped; twenty-three left, explicitly, in the
   report *and* in an in-tree docblock as a filed remainder. Two questions, and they are different:
   (a) is leaving 23 defensible as engineering — the stated reason is that each wrap is a judgement
   call and doing 23 mechanically at the end of a round invites a silent regression, which I find
   credible; and (b) **is a partially-applied safety mechanism worse than none**, because the file
   now *looks* systematically protected to a reader who does not know six-of-twenty-nine? A reader
   who sees `consumeFixtureTable` on the first loop they open will assume it is the house style.
   Where does the code tell them otherwise, and is that the right place for it to be told?

3. **The self-refuted docblock.** The author's first draft claimed an early `break` would be caught
   by the trailing `yielded !== expected` arm; they measured, found `break` invokes the generator's
   `return()` so that arm is unreachable, corrected the comment, and made the self-test assert the
   real behaviour. **Read the corrected comment and tell me whether it is now true** — this project
   has a documented habit (form (7)) of replacing a false rationale with a *differently* false one,
   and a comment that has just been corrected is the one everybody stops checking.

4. **Does this file still read as a test, or has it become a program?** 1071 added lines, a
   generator framework, a census, a self-test of the detector, a tree-wide scanner with its own
   soundness assertion. At some point a test suite acquires enough machinery that it needs its own
   tests — and the author has in fact started writing those (MUST 4, "the vacuity detector had no
   self-test"). **Is that a healthy fixpoint or a warning sign?** I want your architectural judgement
   in plain terms: if you were the next contributor, could you add a rule to this suite without
   reading all 1071 added lines? If not, say what the extraction should be. Do not design it in detail —
   name it.

5. **Ten rounds.** This is round *ten* of a sanitizer-hardening sequence in which the production file
   has been stable for the last several. **Is the round-over-round yield still positive, or is this
   suite now being hardened against its own reviewers rather than against attackers?** You are the
   only leg positioned to say that, because the test leg is being asked to attack the evidence and
   the audit leg is being asked to attack the product. I would rather hear "this should stop" from
   you now than discover it in round twelve. Say it plainly if you think it.

6. **The commits.** 15 of them. Do the messages describe what the diffs do? The author claims each
   MUST was reproduced-then-fixed with a named RED assertion. Spot-check at least four commits
   against their messages, including `e510d40` ("assert tree-wide scan soundness BEFORE throwing on
   offenders") and `753cd78` (S1 partial), and tell me whether the ordering claim in `e510d40` is
   actually what the diff implements.

## A thing I got wrong last round, so that you can check whether I have over-corrected

I told the previous leg that certain tables were unpinned and that this was the problem. **It was
not.** Every one of those tables was already non-vacuous through its own fixtures — measured RED when
emptied. The real defect was one level up: **no loop was pinned to its table at all.** I was looking
at the data and the defect was in the plumbing.

I mention it because the correction may have over-rotated the round toward plumbing. **Check whether
anything in the actual sanitizer rules got worse, or was left unexamined, while all this
loop-integrity machinery was being built.** `[UNVERIFIED SUGGESTION — do not treat as a finding
until you have looked.]`

## Out of scope

Everything in the shared baseline block, plus: do not review the `url-scheme-validation` branch (it
is separately under review), and do not design the `markdown.ts` allow-list inversion (#18).

## Deliverables — you are not done until all five exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r10.md`**, verdict
   **APPROVE** or **REQUEST CHANGES**, findings numbered, severity-classified, each with file:line,
   evidence, impact, recommendation.
2. **Your count of how many places the fixture-size magic number now lives**, with method.
3. **A plain-language verdict on item 5** — should this sequence continue, and if so, on what axis.
4. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
5. **The numbered list of every place this brief is wrong.**

**You MUST produce all five deliverables and then mark the task complete. Do NOT push.**
