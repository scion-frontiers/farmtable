# dev-xss-r8-fix — BOUNDED FIX LEG. NOT A ROUND.

## 0. YOUR TREE, YOUR BASE, YOUR BRANCH — ALL THREE BY SHA

| | |
|---|---|
| tree | `/workspace/farmtable-xss-r8` — **yours alone, nobody else is in it** |
| base commit | **`e4e3d1352809428a5dfe386bb53c0b18a562332f`** (`e4e3d13`) |
| branch | `url-scheme-validation-r8`, already created and checked out |
| findings go to | **`reports/r8/dev-xss-r8.md`** — the `r8/` subdirectory, not `reports/` |

`e4e3d13` is also `refs/preserve/xss-r7-fix-e4e3d13` in canonical; both resolve to the same
object, verified. **EVERY ARTEFACT YOU PRODUCE IDENTIFIES A COMMIT BY SHA.** A branch tip is a
timestamped observation wearing a name.

## 1. READ THIS BEFORE YOU FIX ANYTHING: THE BIGGEST ITEM IN r8 IS MY FAULT, NOT r7's

Round 7 was reviewed three ways. Two said REQUEST CHANGES, one APPROVED WITH CONDITIONS. But
**zero Criticals and zero Highs across all three legs.** The round does not merge because its
*prose* asserts things its *code* does not do — which is the exact class this workstream exists
to stop. **r8 IS SMALL AND MUST STAY SMALL.**

The single largest blocking item — five stale line citations, found independently by all three
legs — **came from my own brief.** `dev-xss-r7-fix.md` AMENDMENT 1 §A2 told the r7 leg to
annotate a specific `file:NNN`. Those numbers were correct when I wrote them. The leg's
annotation was a 29-line comment inserted immediately above the cited line, which moved it —
**in the same commit, by the act of writing the citation.**

> **AN INSTRUCTION OF THE FORM "ADD A COMMENT AT `file:NNN`" IS SELF-INVALIDATING, AND THE MORE
> THOROUGH THE COMMENT THE MORE WRONG THE NUMBER.**

The r7 leg did exactly as instructed. It is not scored against it and neither is this.
**BINDING ON YOU (`_BRIEF-RULES.md` §30): ANCHOR BY IDENTIFIER, NEVER BY LINE NUMBER.** Name the
function, the constant, the test, the sentence. If you must cite a line in your *report*, that is
fine — a report describes a commit that does not move — but **state the SHA alongside it.**

## 2. THE FIVE ITEMS. THIS LIST IS CLOSED.

**1. THE FIVE STALE CITATIONS.** (review R1 / test B1 / audit F3.) Re-anchor them **by
identifier**. Do not re-cite a line number in production code. Provenance: I am taking the count
"five" from three independent reports, not from my own measurement — **verify it and tell me the
number you actually find.** If it is not five, the number is yours and mine was hearsay.

**2. THE B4 GUARD IS INERT.** (review R2 / test B2, **both by mutation**, independent routes.)
Revert the fix and the suite stays green. Two options:
- **PREFERRED:** make the test fail when the fix is reverted. Then **show me the red** — paste
  the failing output. A guard asserted to work, without the run that shows it failing, is the
  thing we are trying to eliminate.
- **ACCEPTABLE AND CHEAP:** the comment stops claiming to be the regression guard.

**A COMMENT THAT DESCRIBES A GUARD THE TEST DOES NOT IMPLEMENT IS THE DEFECT — the missing test
is the lesser half.** Either option closes it; do not do half of each.

**3. `doc` HAS TWO PRODUCERS AND THE PROSE DISCHARGES ONE.** (review R3 / test B3 / audit F8,
3 of 3.) Correct the prose in **`convert.go`** and in **`capabilities.ts`**. The r7 leg's
self-report #3 said this was done; it was **false as stated** — the audit measured
`grep -rn 'two producers'` returning **2 = 1 prohibiting + 1 committing**. Re-run that grep
yourself and paste it.

**4. THE FALSE LIMIT STATEMENT.** (test B4 / audit F10.) `doc.go` says "TWO LIMITS". There are at
least three. **State the real number or state none** — "at least three" in prose is also
acceptable and is honest. Do not write a number you have not counted.

**5. THE AUDIT'S SEVEN CONDITIONS**, all Medium-or-below. **Do F1 first**: the missing GITHUB
conjunct in `isCollectionWritable` in `ft-app.ts`. It is the only one of the seven with a
behavioural edge.

### NOT YOURS — ROUTED, DO NOT FIX, DO NOT SCOPE
`canEditRelationships` (audit F2 — declared, advertised, zero enforcement sites; latent, own
track). `EntStore.UpdateCollection` producer-census omission (audit F7). `graph_routing.go`
(audit F9). **These are real and none of them is this round's.** If you find yourself editing
them, stop and message me.

## 3. AND THEN AN OPEN PASS — BECAUSE MY TARGETING HAS STEERED A ROUND AWAY FROM A DEFECT BEFORE

Section 2 is a closed list of things already found. **It is not a description of the code and it
is not a bound on what is wrong.** My briefs have three times now pre-classified the decisive
evidence as noise, and a leg that checks only what I asked will report done and be wrong.

After the five items, spend a bounded pass looking at whatever the five made you notice, and
**report anything you find even if it is outside the list — especially then.** A finding you
surface and do not fix is worth more to me than a sixth fix.

## 4. THE BUILD FENCE — AMENDED TODAY, IN YOUR FAVOUR, READ CLAUSE (h)

**OP-1 IS CURRENT.** You do not need to ask me whether it is.

- **(a) TOKEN REQUIRED:** `go build ./...`, `go vet ./...`, `go test ./...`, `npm test`,
  `npm run build`, `make build`, `make test`. **Request it. I hold it. Exactly one exists
  project-wide.** Return it the moment your granted commands exit.
- **(b) NO TOKEN:** `go test ./internal/<pkg>/ -run '^TestName$' -count=1`.
- **(c)** Log every (b) run to `reports/_run-queue-log.md` **BEFORE** running it. **The ROOT/DIST
  column is mandatory, including on PASSING lines.**
- **(h) NEW TODAY, AND IT EXISTS BECAUSE OF THIS ROUND:** **MUTATION TESTING NEEDS NO TOKEN**
  when done against a **throwaway copy outside `/workspace`** (your own `/tmp` — it is
  per-container, so no two legs can collide there). The run must still be (b)-shaped. Mutation
  produced item 2 above by two independent routes, and produced r6's decisive result, and my
  fence had been forbidding it by accident since neither the word "mutation" nor any ruling on it
  appeared anywhere in the rules. **DO NOT DELETE THE COPY.** Report its path; disposition is mine.

### ⚠ ENVIRONMENT FACT THAT WILL COST YOU A TOKEN IF I DO NOT TELL YOU — MEASURED IN YOUR TREE

```
[ -d /workspace/farmtable-xss-r8/web/dist ]   ->   FALSE
```

**`web/dist` DOES NOT EXIST IN YOUR TREE, AND A `go:embed` REACHES IT, SO `go build ./...` WILL
FAIL IN YOUR TREE FOR REASONS THAT HAVE NOTHING TO DO WITH YOUR WORK.** This is EM-100, it is
pre-existing, repo-wide, and not yours to fix. **Do not spend a build token discovering it, and
do not report it as a regression you caused.** Record ROOT and DIST state on every run row.

## 5. HARD CONSTRAINTS — THESE ARE NOT STYLE NOTES

1. **DO NOT PUSH. EVER.** Commit locally with clear messages. Pushing is the eng-manager's and
   nobody else's.
2. **NO OPERATION THAT CAPTURES FILES INTO GIT BY ANY CRITERION OTHER THAN A PATH YOU TYPED IN
   FULL.** Covers, non-exhaustively, **and the non-exhaustiveness is the point**: `git add -A`,
   `git add .`, `git add -u`, `git add` with a glob or a directory, `git stash -u`, `git stash -a`,
   `git commit -a`, `git commit` with a pathspec broader than one file. **IF YOU CANNOT NAME EVERY
   FILE THE COMMAND WILL TOUCH BEFORE YOU RUN IT, DO NOT RUN IT.** No exceptions, no exemptions.
   Full statement, evidence and the reason it is a property rather than a list:
   `briefs/_BRIEF-RULES.md` §32.1 — read it before your first commit.

   Measured, so you know it is not superstition: `git add -A` stages ignored files **silently**;
   an explicit path **errors loudly and names the file**. **The dangerous outcome is the silent
   success, not the loud refusal.** The mandated form is the safer one, not merely the required
   one. If a refusal feels like an obstacle, you have the polarity backwards.
3. **DELETE NOTHING.** No `git gc`, no `prune`, no `git worktree remove`, no removing scratch
   dirs, not even ones you created, not even ones that look obviously stale. A durability freeze
   is active project-wide. If something needs removing, tell me and leave it.
4. **STAY IN YOUR TREE.** `/workspace/farmtable-xss-r8`. Do not edit any other worktree.
5. **`_BRIEF-RULES.md` §26 BINDS YOUR REPORT:** every measured field is **pasted from the output
   of a command, with the command shown.** If there is no command there is no receipt. A number
   you remember is not a measurement.
6. **THREE INTEGERS** on any population you enumerate: **ENUMERATED = FLAGGED + EXCLUDED**, in the
   same sentence. Any population of ten or fewer is reported **as the list, not as the number**.
7. Reach me at **`farmtable-em-task-state-model-v2`** — that is the resolvable name. `eng-manager`
   is a template column and 404s.
8. **Backticks in a `scion message` body EXECUTE.** Write your message to a file and send it with
   `"$(cat file)"`.

## 6. DELIVERABLES — ALL FOUR, OR THE TASK IS NOT DONE

1. **Commits** on `url-scheme-validation-r8`, base `e4e3d13`, explicit paths only.
2. **`reports/r8/dev-xss-r8.md`** — per item: what you changed, the command that shows it works,
   and anything you could not verify marked **UNVERIFIED** rather than omitted. Include the open
   pass from §3 even if it found nothing; **a measured zero is a result and I want it.**
3. **A project log entry**, in-tree, committed. Do not skip this. It is skipped every round.
4. **A message to me** naming the head SHA you produced.

**A SELF-REPORT IS A CLAIM AND INHERITS EVERY DUTY OF ONE.** If you correct yourself mid-task,
the correction is a new claim and needs its own receipt — a correction drafted in the posture of
having just been careful is indistinguishable from having been careful about the new claim.

**YOU MUST WRITE `reports/r8/dev-xss-r8.md`, COMMIT YOUR WORK AND THE PROJECT LOG ENTRY, MESSAGE
ME THE HEAD SHA, AND THEN MARK THE TASK COMPLETE.**
