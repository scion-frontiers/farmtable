# BRIEF — hedge-sweep

## READ-ONLY. NO BUILD TOKEN. NO COMMITS. NO PUSH. NO PRODUCTION CODE.

You are auditing **this project's own written record** — not its source. Your subject
is `/scion-volumes/scratchpad/projects/farmtable/reports/` and `.../briefs/`:
**644 markdown files, 195,111 lines.** Nothing you do touches a repository.

---

## THE QUESTION

**THE THING THAT STOPS THE SEARCH IS THE THING THAT SURVIVED CHECKING.**

That sentence is the coordinator's unification of three failure shapes this project
keeps producing. Your job is to find its instances in our record, and to tell us
whether the shape actually recurs or whether we have talked ourselves into a pattern
from three memorable cases.

**Both answers are results. "It does not recur, and here is the base rate" is a
finding I will act on, and it is the answer I consider less likely but more
valuable.**

### The three passes

**PASS A — THE CONSERVATIVE-DIRECTION BOUND.** A bound stated in the safe direction
("at most N", "no more than", "worst case") which is *true*, and which therefore
nobody re-measures — while the number that mattered was on the other side of the
inequality. The defect is not that the bound is wrong. It is that being
unfalsifiable-in-the-safe-direction makes it a full stop.

**PASS B — THE TRUE-BUT-INCOMPLETE CAUSE.** A cause that is real, fits the evidence,
and accounts for *part* of the effect. A false cause gets tested and discarded. A
true-but-incomplete one gets **confirmed**, and the confirmation closes the question.
Verification is not the guard here — **verification is the step that fails, by
succeeding.**

**PASS C — NAME THE CHEAP THING IT READS AND THE EXPENSIVE THING IT MEANS.** For a
load-bearing claim, separate the *observable* (what a command actually returned) from
the *proposition* (what we concluded). Where those two are far apart, the gap is
carried by an unstated assumption. Report the pair explicitly: cheap thing / expensive
thing / what must hold to get from one to the other.

---

## METHOD — COLD FIRST, THEN RECONCILE

**Do a cold pass before you read section "WHAT I ALREADY TRIED".** Build your own
population, by your own instrument, and write down what you find. Only then read that
section and reconcile.

**Per-finding attribution is mandatory.** Every finding is tagged **[COLD]** (found
before reading my section) or **[RECONCILE]** (found after, or prompted by it). This
is how we measure whether my scaffolding helps or suppresses — and we have measured it
helping *and* suppressing, in different rounds, so the tag is real data.

### THREE INTEGERS, BINDING

Any count you report comes with what you enumerated and what you excluded, in the same
breath, and the arithmetic must close:

**ENUMERATED = FLAGGED + EXCLUDED, as three integers.**

Two cautions, both earned by me getting them wrong tonight:

- **A filter that matches nothing silently passes everything.** It is indistinguishable
  in output from a filter with nothing to remove. If you apply an exclusion, prove it
  matched something, or state that it matched zero and treat that zero as suspicious.
- **Three integers close per-instrument and say nothing about a union.** If you run two
  instruments, the union needs its own accounting. **A CENSUS IS AS BOUNDED AS ITS MOST
  BOUNDED INSTRUMENT.**

### A MEASURED FIELD IS PASTED FROM THE OUTPUT OF A COMMAND, WITH THE COMMAND SHOWN

If there is no command, there is no receipt. Do not fill a number in from expectation
and reconcile later — that is the exact defect that produced this rule tonight.

### PRE-REGISTER YOUR OWN FALSIFIER

Before you conclude anything, write down **what you would have to see to be wrong**,
and the mechanism by which you would see it. Then go and look for that. A falsifier
inherits the vocabulary of whoever registered it, so make it a *number you have not yet
checked*, not a feeling.

---

## WHAT I ALREADY TRIED — DO NOT READ THIS UNTIL YOUR COLD PASS IS ON DISK

<!-- COLD PASS BOUNDARY -->

**MY FIRST INSTRUMENT FAILED AND THE FAILURE IS INSTRUCTIVE.** I grepped for hedge
vocabulary. Results: conservative-bound words 255 lines; proxy words 174 lines; causal
words — `because|root cause|due to|which is why|caused by` — **3571 lines.**

3571 is not a population. It is the word "because". **AN INSTRUMENT THAT ENUMERATES A
SYNTAX CANNOT ENUMERATE A PROPERTY**, and I have made that exact error twice tonight
already.

**MY SECOND INSTRUMENT, offered as a starting point and not as a boundary.** The target
is *where a search stopped*, and stopping is more findable than hedging. Grepping for
closure language — `ruled out|no carrier|cannot be reached|unreachable|zero hits|no
readers|no consumers|refuted|falsified|nothing reads|nothing writes` — gives **1049
lines across 201 files**. Intersecting closure language with conservative-bound
language gives **12 lines**, which I believe is the sharpest cell.

**THIS INSTRUMENT IS ALSO A SYNTAX AND YOU SHOULD DISTRUST 1049 THE SAME WAY.** A search
can stop without any of those words in it. Finding a stopped search that my grep cannot
see is a better outcome than triaging one that it can.

Highest closure density, by file, if it helps you sample: `reports/preserve-bundle.md`
(29), `reports/review-194-r11.md` (28), `reports/test-194-r11.md` (22),
`reports/test-xss-r4.md` (19), `reports/review-xss-r4.md` (18),
`reports/audit-194-r11.md` (15), `reports/xss-r5-audit.md` (14).

**A NOTE ON `.preimage-*` FILES.** Several rank high. They are prior revisions of the
same report. Decide deliberately whether they are in your population — counting a claim
six times because it was edited six times would inflate every number you produce. State
the decision either way; do not let it happen silently.

**THE THREE CASES THE CLASS WAS BUILT FROM**, so you can exclude them from any base rate
you compute — they exhibit the class and therefore cannot test it:

1. A `/workspace` census gap of 15 entries attributed to dotfile exclusion. True — it
   accounted for 9. The other 6 were entries created between the two censuses.
2. A claim that one function was the sole producer of a particular object. True that it
   was *a* producer; there were three, and the most dangerous one was in neither the
   original claim nor its first correction.
3. A stash-shaped scoping proxy used to mean "contains no deliberate work". Fine across
   a population, and it failed on exactly the member worth keeping.

---

## WHAT YOU MAY AND MAY NOT DO

- **READ-ONLY.** No writes outside your two deliverable files. Do not edit any report or
  brief you are auditing — if one is wrong, say so in your report.
- **NO BUILD TOKEN.** No `go build ./...`, `go vet ./...`, `go test ./...`, `npm test`,
  `npm run build`, `make build`, `make test`. Another leg holds the only token. You
  should not need to run anything; this is a documentary audit.
- Do not contact any other agent. Report to `eng-manager` only.

## SHELL FACTS — THESE HAVE COST US HOURS

- The shell is **zsh 5.9, not bash.** An **unquoted glob matching nothing is a FATAL
  ERROR** that aborts the whole command and everything batched behind it. Write
  `--include='*.md'`, never `--include=*.md`.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus`, **1-indexed**.
- `grep` is **ugrep 7.5.0**. `grep -rn .` emits paths **without** a leading `./`.
- A check whose success condition is *no match* **exits 1 when clean.** Never wrap it in
  `|| true` — that destroys the signal.
- `cmd 2>&1 > file` sends only stdout to the file. The correct order is `cmd > file 2>&1`.
- **TAB is IFS-whitespace.** Watch your `cut -f` and `awk` assumptions.
- **Backticks in a `scion message` body EXECUTE.** Write your message to a file with a
  quoted heredoc and send it with `"$(cat file)"`. No backticks in messages to me.

---

## DELIVERABLE — NAMED EXACTLY

Write **`/scion-volumes/scratchpad/projects/farmtable/reports/hedge-sweep.md`**,
containing, in this order:

1. **POPULATION AND COMMANDS** — what you enumerated, with the commands pasted, and the
   three integers closing. Population before verdict, always. A verdict whose population
   arrives afterwards cannot be checked, and this project has produced several.
2. **YOUR PRE-REGISTERED FALSIFIER** and whether it fired.
3. **PASS A / PASS B / PASS C findings**, each tagged [COLD] or [RECONCILE], each citing
   file and line.
4. **DOES THE SHAPE RECUR?** — your actual answer, with a rate if you can defend one and
   an explicit refusal if you cannot. **A refusal with a reason outranks a number with a
   shrug.**
5. **WHAT I DID NOT CHECK** — a real section. It is read.
6. **WHERE THIS BRIEF WAS WRONG** — also real. Every leg tonight has found errors in my
   briefs, and the ones that found the most were the most useful. My framing is a claim
   like any other; if the framing is wrong, that is the finding.

Then write a project log entry to
**`/scion-volumes/scratchpad/projects/farmtable/reports/hedge-sweep-project-log.md`**
(NOT into any code repository).

## TERMINATION

**You MUST write both files, message `eng-manager` with your answer to section 4 and
your two sharpest findings, and then mark the task complete.** Do not stall after
finishing the analysis. Do not ask me whether to write the files — write them.
