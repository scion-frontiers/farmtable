# _r8-COMMON — APPARATUS. READ ALL OF IT BEFORE YOU RUN ANYTHING.

This file contains NO findings and NO targeting. It is safe to read before your cold pass, and you
must. The findings file is `briefs/_r8-PHASE-TWO.md` and **you may not open it until your own cold
pass is written to disk.** That split is deliberate: in an earlier round I put targeting inside the
file the dispatch ordered read first, and it cost the cold pass. If anything in this file reads like
a hint about where the defects are, THAT IS A DEFECT IN MY BRIEF AND I WANT IT REPORTED.

## 1. WHAT YOU ARE REVIEWING

Branch `url-scheme-validation-r8`, HEAD **`901670e3f09ad57386cafb8359017d8d61a75070`**.
The round under review is the **10 commits in `e4e3d13..901670e`**. `e4e3d13` is an ancestor.

[MEASURED] `git diff --stat e4e3d13..HEAD` -> 7 files, 476 insertions, 40 deletions:

```
 .design/project-log/2026-07-29-dev-xss-r8-fix.md | 103 +++++++++
 internal/server/convert.go                       |  69 ++++--
 internal/server/export_import.go                 |  56 ++++--
 internal/webguard/doc.go                         |  35 +++-
 internal/webguard/remotedata_consumers_test.go   | 171 +++++++++++++-
 web/src/capabilities.ts                          |  56 ++++-
 web/src/components/ft-app.ts                     |  26 ++
```

**JUDGE THE COMMIT AGAINST THE CODE, NOT AGAINST THE BRIEF.** A gap between them is worth reporting
in either direction, INCLUDING work delivered that nobody asked for.

**R6 AND R7 REMAIN DO NOT MERGE. r8 does not change that.** You are not deciding whether this ships
tonight. You are deciding what is true about it.

## 2. YOUR TREE. IT IS YOURS ALONE.

| leg | tree |
|---|---|
| `review-xss-r8` | `/workspace/farmtable-review-r8` |
| `audit-xss-r8` | `/workspace/farmtable-audit-r8` |
| `test-xss-r8` | `/workspace/farmtable-test-r8` |

Each is a standalone clone with its OWN object store, already checked out at `901670e`.
**NO TWO LEGS MAY EVER SHARE A SCRATCH PATH.** Stay in yours. Do not read, write, cd into, or measure
another leg's tree, and do not touch `/workspace/farmtable` (canonical) at all.

**DO NOT CREATE ANY NEW CLONE, WORKING TREE, WORKTREE OR OBJECT STORE.** Four independent instruments
are currently taking a census of every git object on this host, and three legs have already had to
retract findings that turned out to be their own fixtures. If you genuinely need another tree, ASK ME
FIRST and I will create and announce it. An unannounced creation is indistinguishable from a
discovery.

Scratch files: use `/tmp` inside your own container, or a path under your own tree. `/tmp` is
PER-CONTAINER — you cannot read another leg's `/tmp` and they cannot read yours.

## 3. HARD PROHIBITIONS

1. **DO NOT PUSH. EVER.** Only the eng-manager pushes, and not tonight.
2. **DO NOT MODIFY PRODUCTION CODE.** Your independence depends on it. This includes "obvious" fixes,
   gofmt, and typo corrections. Report them; do not make them. (`test-xss-r8` see §4.)
3. **NO BULK CAPTURE INTO GIT, BY ANY CRITERION OTHER THAN A PATH YOU TYPED IN FULL.** Covers,
   non-exhaustively, and the non-exhaustiveness is the point: `git add -A`, `git add .`, `git add -u`,
   `git add` with a glob or a directory, `git stash -u`, `git stash -a`, `git commit -a`, `git commit`
   with a pathspec broader than one file. **IF YOU CANNOT NAME EVERY FILE THE COMMAND WILL TOUCH
   BEFORE YOU RUN IT, DO NOT RUN IT.**
4. **DURABILITY FREEZE.** No `gc`, no `prune`, no `repack`, no `reflog expire`, no gc config writes,
   no `git worktree prune`. **DO NOT DELETE OR TIDY ANYTHING ANYWHERE ON THIS HOST** — no tree, no
   clone, no scratch checkout, no worktree registration directory under any `.git`, however stale it
   looks, including ones you created yourself. Fetches are permitted.
5. **NO FILESYSTEM-LEVEL COPY OF A `.git` DIRECTORY OR WORKING TREE.** No `cp -a`, `rsync`, `tar`,
   `mv` of a repo or its `.git`. Prohibited outright, not gated.
6. **DO NOT CONTACT ANYONE OUTSIDE THIS PROJECT.** Route everything through me.

## 4. THE BUILD TOKEN — READ THIS BEFORE YOU TYPE ANY BUILD OR TEST COMMAND

**EXACTLY ONE BUILD TOKEN EXISTS, PROJECT-WIDE. I HOLD IT. AT MOST ONE AGENT MAY EXECUTE A BUILD OR A
SUITE AT ANY MOMENT.** This is a binding resource policy, not a suggestion.

Covered: `go build`, `go test`, `go vet`, `make` anything, `npm test`, `npm run build`, `tsc`,
`vite`, and anything that transitively invokes them.

**Not covered** (run freely): reading source, `git log`/`diff`/`show`/`grep`, `grep`/`find` over the
tree, `git ls-files`, static inspection of any kind.

To get it: message me with **(a) the exact commands you intend to run, (b) in which tree, (c) your
expected outcome BEFORE running them, and (d) roughly how long.** I grant, you run, **you hand it
back explicitly when done.** Do not hold it while you write prose.

**NO INSTRUCTION IS FINAL UNTIL YOU REQUEST THE TOKEN** — if my brief implies a build and you think
the build is wrong or unnecessary, say so instead of running it.

**A NOTE THAT COSTS ME SOMETHING TO WRITE.** Last round I granted the token on a stated premise that
was FALSE — I told the leg that `npm test` runs Vitest and does not typecheck, and there is no Vitest
in that package. The leg executed the construction anyway, found my premise false, and told me. The
ruling happened to be right for a reason I had not given. So:

> **ANY VERIFICATION CONSTRUCTION I PUT IN A BRIEF IS A PROPOSAL, NOT A MANDATE, UNTIL YOU HAVE
> EXECUTED IT AND REPORTED THE RESULT. A FALSE PREMISE YOU FIND IN MY BRIEF IS A RESULT I RECORD
> AGAINST THE BRIEF, AND I WANT IT MORE THAN I WANT AGREEMENT.**

**IF A RULE OF MINE CANNOT BE SATISFIED, SAY SO AND STOP. Do not implement it and declare yourself
blind.**

**NO WHOLE-TREE GO BUILD HAS HAPPENED TONIGHT.** No `go build ./...`, no `go vet ./...`, no
`go test ./...`, no `make test` against this branch, by anyone. Do not assume the tree compiles. Do
not assume it does not. **IT IS UNMEASURED, AND "UNMEASURED" IS THE FINDING UNTIL SOMEBODY MEASURES
IT.** I will route that build deliberately; do not race for it.

`test-xss-r8` only: you may add test files in your own tree to run an experiment. **Do not commit
them, do not modify any production file, and state in your report which experiments required a code
change and what it was.**

## 5. THE ENVIRONMENT WILL LIE TO YOU. THESE ARE MEASURED.

- The shell is **zsh 5.9, NOT bash.**
- **`MULTIOS` IS ON.** `cmd | thing >/dev/null` **TEES**, it does not suppress. This includes
  `>/dev/null 2>&1`, the universal idiom for "silence this". A suppression you believe you wrote may
  be duplicating output into your pipeline.
- **The obvious check for that is broken**: `setopt | grep -c multios` returns 0 whether the option
  is on-by-default-and-on, or off. Two opposite states, one observable. Use `$options[multios]`.
- **`bareglobqual` IS OFF.** `(N)` is **four literal characters appended to your pattern**, not a
  glob qualifier. It converts a working sweep into a fatal one. **PROHIBITED HOST-WIDE.** Use
  `find ... -print` and iterate.
- **An unquoted glob that matches nothing is a FATAL EXPANSION ERROR**, and it aborts every batched
  command behind it in the same invocation.
- **`grep -c` PRINTS `0` AND EXITS 1 WHEN THERE ARE NO MATCHES.** Never `|| true`, never `|| echo 0`
  — you will convert a real failure into a clean-looking zero.
- **`awk` is mawk.** Interval expressions like `{2,}` **SILENTLY NEVER MATCH** — rc=0 and empty
  output, which IS A PASSING RESULT. Do not use them.
- **`${PIPESTATUS[0]}` IS EMPTY.** The array is `$pipestatus` and it is **1-INDEXED**.
- `grep` is ugrep 7.5.0. **`file` is NOT INSTALLED.** TAB is IFS-whitespace.
- **NEVER BUILD A FILE LIST IN A SCALAR.** `for x in $(cat f)` word-splits on spaces. Use an array or
  `while read -r`.
- **THE SILENT ZERO:** `cmd 2>/dev/null | wc -l` reports 0 when `cmd` FAILS, and **ZERO READS AS
  CLEAN**. Check the exit status of the producer, not the count.

## 6. MEASUREMENT DISCIPLINE — THIS IS THE PART THAT GETS REPORTS REJECTED

**§26. A MEASURED FIELD IS PASTED FROM THE OUTPUT OF A COMMAND, WITH THE COMMAND SHOWN.** Not
recalled, not recomposed from memory, not predicted. **§28: no number appears in your report without
the command that produced it.**

**TAG EVERY FIGURE IN PROSE, not just the ones in tables: `[MEASURED]` / `[DERIVED]` / `[UNCHECKED]`.**
`[UNCHECKED]` is a respectable answer and I would rather have it than a clean claim.
**DECLARED-NOT-CLEARED IS ACCEPTABLE. A CLEARED CLAIM WITHOUT A RE-MEASUREMENT IS NOT.**

**§30. CITE BY IDENTIFIER, NEVER BY LINE NUMBER.** `convert.go` `func taskToProto` — not
`convert.go:211`. Line numbers are falsified by the next commit, and an annotation instruction citing
`file:NNN` is falsified by obeying it. If you must give a line number, give the identifier too.

**THE THREE-INTEGER RULE: ENUMERATED = FLAGGED + EXCLUDED.** For any re-verification, **FOUR**:
CHECKED = MATCHED + MISMATCHED + UNCHECKABLE. Publish the arithmetic; if it does not balance, the
imbalance is the finding.

**ANY POPULATION OF TEN OR FEWER IS REPORTED AS THE LIST, NOT THE NUMBER.** I violated this tonight:
I had a four-member list on screen, used it to close an arithmetic gap, and published the integer 4.
Another leg then rediscovered the four objects independently. **A NUMBER THAT BALANCES FEELS
FINISHED. THE GAP WAS THE FINDING.**

**A RESULTS TABLE IS A CLAIM THAT ITS CELLS ARE COMMENSURABLE.** State that claim where it can be
checked, or do not build the table.

**BEFORE COMPARING TWO SETS: assert they are in the SAME UNITS** — same start point, same
normalisation, same absolute-or-relative form — **and PRINT ONE MEMBER FROM EACH SIDE** so a human can
see they are the same kind of string. Non-emptiness is necessary and not sufficient: a units error in
a set-difference presents as TOTAL DISAGREEMENT with both sides populated.

**WHEN YOU RE-RUN A COUNT WITH AN AMENDED PREDICATE, RUN THE OLD AND THE NEW OVER THE SAME CORPUS AND
PUBLISH BOTH ROWS PLUS WHICH VARIABLE MOVED.** Never publish a revised figure without the figure it
revises, measured at the same time. I nearly shipped a 38x inflation tonight under the banner
"re-run under a proven boundary", and the banner is precisely why it would not have been audited.

> **A REMEDIATION BANNER IS THE LOWEST-SCRUTINY CONTEXT IN WHICH A NUMBER CAN APPEAR.**

**CHECK THE NUMBERS THAT DAMAGE YOU AS HARD AS THE ONES THAT ACQUIT YOU.** Four legs tonight
published inflated counts AGAINST THEMSELVES and **NOT ONE WAS FOUND BY ITS AUTHOR.**
**CONFESSION SUPPRESSES SCRUTINY AS EFFECTIVELY AS DENIAL DOES.**

**SELECT ON AN EPOCH WINDOW, NEVER ON A TIMESTAMP STRING PREFIX.** A string selector truncates in
traversal order and systematically drops the most deeply nested members — exactly the ones an
enumeration already under-counts. And note the compounding: **DEFECTS ARE NOT INDEPENDENT. THEY
CLUSTER ON THE OBJECTS THAT ARE HARD TO REACH. WHEN TWO OF YOUR INSTRUMENTS AGREE, ASK WHETHER THEY
FAIL ON THE SAME MEMBERS BEFORE TREATING THE AGREEMENT AS EVIDENCE.**

## 7. CONTROLS — EVERY CLAIM OF ABSENCE NEEDS ONE, AND MOST CONTROLS TONIGHT WERE BROKEN

**CONTROLS COME IN PAIRS.** A **POSITIVE** arm (something that MUST be admitted, and is) and a
**NEAR-MISS** arm (one character below the bound, which MUST be rejected, and is). **A CONTROL PROVES
THE BRANCH IT TRAVERSES AND NOTHING ELSE.** A positive-only control tells you your filter is not
totally dead; it tells you nothing about whether it over-matches.

**A CONTROL ADDED AFTER A CLEAN RESULT IS A RECEIPT.** Arm it first.

**A CONTROL WHOSE PASS CONDITION IS AN EMPTY RESULT CANNOT DISTINGUISH "RAN AND FOUND NOTHING" FROM
"DID NOT RUN".** Make the pass condition a discrimination, never an absence.

**THE INSTRUMENT MATCHING ITSELF** is the commonest failure here and it has three faces:

1. Your `grep` for `2>` contains a `>`, so it matches its own command text.
2. Auditing your transcript for a defect INSERTS that defect's signature into the corpus, and **THE
   CONTAMINATION GROWS WITH REPORTING DILIGENCE — THE MOST DILIGENT LEG HAS THE DIRTIEST CORPUS.**
   **EXCLUDE YOUR OWN REPORTING COMMANDS** before counting anything, not just my brief text.

   > **CORRECTION 10:35Z — THE PARENTHETICAL THAT USED TO BE HERE SAID "segregate by command
   > shape, e.g. `scion message ...`". THAT IS WITHDRAWN AND IT FAILED TOWARD CLEAN.** Segregating
   > by command shape over-matches onto *any* command that names the reporting tool — including the
   > commands that **investigate** it, and including a real report with real work appended after a
   > `;`. It deletes genuine exposure from a self-audit. Measured by `farmtable-predicate-2`, which
   > implemented the rule and then checked *which* commands it removed: **none of the three was a
   > quotation.** Retracted by the coordinator in bulletin 14 item 2, ninety minutes after he
   > mandated it.
   >
   > **RECOMMENDED, NOT MANDATED (n=1, one corpus): REMOVE ONLY THE MESSAGE PAYLOAD. KEEP THE REST
   > OF THE COMMAND LINE.** If that is not cleanly separable in your corpus, **say so and publish
   > both figures** rather than picking one.
   >
   > The *substance* stands — contamination is real, measured at 15% of one leg's corpus. But note
   > the arithmetic that hid the defect, because it is the general lesson:
   > **THE RAW FIGURE WAS INFLATED BY CONTAMINATION AND THE FIX OVER-CORRECTED. TWO ERRORS IN
   > OPPOSITE DIRECTIONS, AND THE PARTIAL CANCELLATION IS WHAT MAKES EITHER ONE HARD TO SEE ALONE.**
   > And: **A SELF-AUDIT FIGURE THAT APPEARS IN THE REPORT OF ITSELF GROWS EACH TIME IT IS
   > REPORTED. THE MEASUREMENT AND THE PUBLICATION OF THE MEASUREMENT ARE THE SAME EVENT IN THE
   > CORPUS.**
3. A near-miss control that names its own absent token inside the invocation it controls WILL FIND
   IT. Where an instrument reads a record of itself, **EVERY CONTROL STRING IS AN INTERVENTION.**

### IF YOU PLANT A MARKER — REWRITTEN 10:35Z. THE PREVIOUS VERSION GUARANTEED A CONTROL THAT COULD NEVER PASS.

> **WHAT THIS PARAGRAPH USED TO SAY, PRESERVED BECAUSE THE WITHDRAWN REASONING IS THE PART NOBODY
> EVER KEEPS:** *"it must be UNIQUE PER ATTEMPT, and the SEARCHING COMMAND MUST NOT CONTAIN THE
> STRING IT SEARCHES FOR — build it by concatenation, split across two literals."*
>
> **THE SECOND CLAUSE, APPLIED TO THE PLANTER, IS FATAL.** `farmtable-relocate-offhost` measured
> the cause: **THE CORPUS STORES WHAT WAS TYPED, NOT WHAT RAN. A marker assembled at runtime —
> variable expansion, command substitution, anything — NEVER ENTERS THE CORPUS AT ALL.** So a
> planter that "builds it by concatenation" plants nothing findable, and its control can only ever
> report BLIND. Seven of that leg's nine markers were **unfindable by construction**; every
> DECLARED BLIND published tonight used an assembled marker; the retry demonstration is
> **withdrawn as measured** and survives only as an argument.
>
> If you have already cited a self-visibility figure of **n=8** anywhere, **STOP** — the defensible
> population is three observations (visible 2, blind 1), all literal-marker, and "lag reaches 2" is
> DERIVED from a single pair.

**BOTH HALVES ARE LOAD-BEARING IN OPPOSITE DIRECTIONS, WHICH IS WHY ONE SENTENCE PRODUCED FIVE WRONG
ANSWERS. THE CORRECTED FORM:**

> ### *** LITERAL IN THE PLANTER. ASSEMBLED IN THE SEARCHER. ***

**MANDATED — THE THREE-STATE CONTROL, replacing the two-state one.** Anchor the invocation check on
a **DIFFERENT LITERAL FROM THE SAME COMMAND** than the marker itself:

| state | condition | meaning |
|---|---|---|
| **PUBLISHABLE** | planting invocation PRESENT **and** marker PRESENT | figure may be published |
| **BLIND** | planting invocation **ABSENT** | retry is meaningful |
| **INSTRUMENT BROKEN** | invocation PRESENT, marker **ABSENT** | assembled marker. **RETRYING WILL NEVER FIX IT AND WILL LOOK LIKE PATIENCE.** |

Keep unique-per-attempt: a retry that re-uses its marker is guaranteed to pass on the second
attempt, because failing once is what puts the marker in the corpus. **THE CONTROL GOES INERT AT THE
EXACT MOMENT IT FIRST FIRES.** Uniqueness must come from a **typed literal you change by hand**, not
from `$RANDOM` or a command substitution — those are exactly the constructions that never land.

### AND THE CLASS BENEATH ALL OF IT — `relocate-offhost`'s, and it indicts our whole control discipline

> **A NEGATIVE CONTROL CANNOT DISTINGUISH "CORRECTLY ABSENT" FROM "INCAPABLE OF FINDING ANYTHING".
> IT IS PASSED MOST EASILY BY A DEAD INSTRUMENT.**

Proving your comparison can say **NO** is necessary and **NOT SUFFICIENT**. **BEFORE YOU PUBLISH ANY
ZERO IN THIS ROUND, PROVE YOUR INSTRUMENT CAN SAY YES ABOUT SOMETHING YOU ACTUALLY PLANTED.** Nobody
on this project has been asked for that until now. Do it first.

**A TRUE ANSWER TO A NARROW QUESTION READS AS A CLEAN ANSWER TO THE WIDE ONE.** When you answer a
scoped question with a zero, state the scope in the same sentence as the zero.

**AN IMPOSSIBILITY CLAIM IS AN ABSENCE CLAIM ABOUT THE WHOLE FUTURE.** Two failures is not "never".
**A MECHANISM INFERRED FROM A FAILURE EXPLAINS THE FAILURE WHETHER OR NOT IT IS TRUE — THAT IS
EXACTLY WHY IT FEELS LIKE AN EXPLANATION.**

## 8. INDEPENDENCE

**DO THE COLD PASS FIRST.** Read the diff and the code, form your own findings, and **WRITE THEM TO
DISK** before you open `_r8-PHASE-TWO.md` or any prior report. The cold pass cannot be recovered once
another leg's findings are in your head.

Then, and only then, reconcile: **per finding, state whether you found it independently, missed it,
or DISAGREE with it.**

> **A DISAGREEMENT IS A RESULT AND I WANT IT, NOT A CONSENSUS.** Two legs disagreeing on a wire fact
> has been more useful on this project than three legs agreeing.

**DO NOT MESSAGE THE OTHER TWO LEGS.** You do not know who they are and you do not need to. I read
all three reports before I decide anything.

**A SELF-REPORT FROM THE FIX LEG IS A CLAIM AND INHERITS EVERY DUTY OF ONE.** So is a correction. So
is this brief. **VERIFY, DO NOT ACCEPT** — including things I tell you I have measured myself.

**A THIRD FAILURE DIRECTION, after fails-toward-clean and fails-toward-alarm: FAILS TOWARD THE LAST
THING AUTHORITY BROADCAST.** Agreement with authority does not present as a result needing a control.
It presents as convergence. **NOTHING IN THIS BRIEF IS LOAD-BEARING UNTIL YOU HAVE MEASURED IT.**

## 9. DELIVERABLES — NAMED EXACTLY. YOU ARE NOT DONE UNTIL ALL THREE EXIST.

1. **Your report**, at the exact path in your role brief, under
   `/scion-volumes/scratchpad/projects/farmtable/reports/`. It must open with an explicit
   **VERDICT: APPROVE / APPROVE WITH CONDITIONS / REQUEST CHANGES**, and every finding must carry a
   severity, an identifier-based citation, and a MEASURED/DERIVED/UNCHECKED tag.
2. **A project log entry**, at
   `/scion-volumes/scratchpad/projects/farmtable/reports/<your-leg-name>-project-log.md`. Write it
   even if it feels redundant. Legs skip this unless told explicitly, and then the reasoning is lost.
3. **An INSTRUMENT section inside your report**: for every sweep, count or search you ran, the exact
   command, the tool, the flags, and **what its controls were**. If a control was absent, say so.
   **IF YOUR LEG HALTS OR IS REFUSED, THE INSTRUMENT DESCRIPTION IS PRESERVED VERBATIM ANYWAY.**

**EVERY ARTEFACT IDENTIFIES A COMMIT BY SHA.**

**SEPARATE YOUR VERDICT FROM YOUR SUPPORT FOR IT.** State what would have changed your verdict.

**YOU MUST WRITE ALL THREE DELIVERABLES TO DISK, MESSAGE ME A SHORT SUMMARY WITH YOUR VERDICT AND THE
COUNT OF FINDINGS BY SEVERITY, AND THEN MARK YOUR TASK COMPLETE.** Do not stop after the analysis.
Cognitive work that never reaches disk did not happen.

If you are blocked, or a rule here cannot be satisfied, message me and signal blocked. Do not guess
and do not proceed unsupervised.
