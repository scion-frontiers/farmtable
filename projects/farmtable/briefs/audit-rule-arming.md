# BRIEF — audit-rule-arming

## READ-ONLY. NO CODE TREE NEEDED. NO BUILD TOKEN. NO COMMITS. NO PUSH.

## THE QUESTION, AND IT IS A COUNTING QUESTION BEFORE IT IS ANYTHING ELSE

**FOR EVERY RULE IN THE STANDING-RULES FILE: DOES IT HAVE A TRIGGER, AND DOES IT HAVE A
CHECK? YES OR NO, PER RULE.**

- A **TRIGGER** is a stated occasion on which the rule is supposed to fire. *"Before
  dispatching a leg." "When recording a negative." "At merge time."* Something that tells
  a reader **when** they are supposed to think of it.
- A **CHECK** is something that can observe whether it was followed. A script, a linter, a
  mandatory column in a log, a required section in a deliverable, a review question
  somebody is obliged to ask. Something that can come back **NO**.

A rule with neither is a sentence. It may be a true and even a wise sentence. It is not a
control.

## THE FILE

`/scion-volumes/scratchpad/projects/farmtable/em-tooling/_STANDING-RULES-2026-07-29.md`

Roughly 1751 lines, 124 KB, with heading structure at three levels. **Deciding what counts
as one rule is part of the job, not a preliminary to it.** Do not assume one heading is
one rule and do not assume it is not. State your unitisation criterion **before** you give
the count, so somebody can disagree with the criterion rather than only with the number.

You did not write this file. I did. That is why you have it.

## ORDER OF REPORTING — MANDATORY, AND IT IS THE POINT OF THE EXERCISE

**REPORT THE TWO COUNTS BEFORE YOU REPORT ANY OPINION ABOUT THE RATIO.**

Specifically, in this order and with nothing interpretive in between:

1. The unitisation criterion.
2. **N** — the total number of rules.
3. **N-with-trigger**, **N-with-check**, **N-with-both**, **N-with-neither**.
4. The per-rule table backing those numbers.
5. *Only then* anything you think it means.

The reason is exact. Somebody is about to use these numbers as a **denominator**. Two
rules were observed failing tonight and somebody called that a rate. A rate needs a
denominator and **nobody has counted the rules that did not fail.** Until this file
produces N, "two" is a number that feels like a trend.

**AND YOU SHOULD KNOW WHAT IS WRONG WITH THE NUMERATOR, BECAUSE IT AFFECTS HOW YOU WRITE
YOUR CONCLUSION.** We only observe a rule failing when somebody catches the failure. Rules
that were never armed and never tested are invisible; rules that failed uncaught are
invisible. So two is a **FLOOR**, not a rate. If your report implies otherwise it will
make things worse rather than better. Say floor where you mean floor.

## THE SECOND HALF, WHICH IS WHAT MAKES THIS WORTH DOING

Every **NO** you find is going to be either **armed on the spot or struck from the file.**
So for each rule with no check, give me, in one line each:

- **the cheapest thing that could observe a violation of it**, or
- **STRIKE** — that this rule cannot be armed at acceptable cost and should come off the
  books.

Recommending STRIKE is a real answer and I want you to use it. The governing sentence:

> **AN UNARMED RULE ON THE BOOKS IS A RECEIPT SAYING THE AXIS IS COVERED.**

A file of 140 unenforceable good intentions is worse than a file of 20 enforced ones,
because the 140 get cited.

## TRAPS THIS PROJECT HAS ALREADY WALKED INTO

- **A FORM CHECK IS ATTENTIONALLY EXPENSIVE AND FEELS LIKE DILIGENCE, SO IT DOES NOT
  MERELY FAIL TO CATCH THE CONTENT ERROR — IT CONSUMES THE PASS THAT WOULD HAVE CAUGHT
  IT.** Be alert for rules whose "check" is a form check standing in for a content
  question. Count those as **NO** and say why.
- **A CHECK THAT ONLY THE RULE'S AUTHOR CAN RUN, OR THAT KEYS ON THE SUBJECT'S OWN
  DISCLOSURE, IS NOT A CHECK.** One cell in an audit tonight could only ever have found
  the honest cases, because it fired on self-labelled claims. Its blind spot was exactly
  correlated with what it screened for. If a rule's check has that shape, count it **NO**
  and flag the shape by name.
- **A CHECK THAT CANNOT GO RED IS NOT A CHECK.** If nothing downstream of a rule can
  falsify it, it is decoration.
- **REACHABILITY IS NOT EXECUTION.** A script existing in a directory is not a check
  unless something invokes it and somebody takes that path.
- **A NEGATIVE WITH NO EXECUTION EVIDENCE IS UNRESOLVED, NOT CLEAN.**

## SPECIFY-THE-QUESTION, NOT-THE-INSTRUMENT

Adopted tonight, and it binds me more than you:

> **A BRIEF THAT SPECIFIES THE PREDICATE BOUNDS THE FINDING. SPECIFY THE QUESTION AND LET
> THE LEG CHOOSE THE INSTRUMENT — AND EXCEEDING THE BRIEF IS PERMITTED AND WILL BE READ AS
> COMPLIANCE.**

Everything above about traps is apparatus. The definitions of trigger and check are mine
and they are **claims, not axioms**. If a better unitisation or a better definition falls
out of actually reading the file, use yours and say why. That is a better outcome than
satisfying mine.

## SHELL FACTS — THESE HAVE COST US HOURS

- The shell is **zsh 5.9, not bash.** An **unquoted glob matching nothing is a FATAL
  ERROR** that aborts the whole command and everything batched behind it. Quote your
  globs.
- `${PIPESTATUS[0]}` is **empty**. The array is `$pipestatus` and it is **1-indexed**.
- `grep` is **ugrep 7.5.0**.
- A check whose success condition is *no match* **exits 1 when clean.** Never `|| true`.
- **Backticks in a `scion message` body EXECUTE.** Write your message to a file with a
  quoted heredoc and send it with a command substitution on `cat`. No backticks in
  messages to me.

## DELIVERABLE — NAMED EXACTLY

**`/scion-volumes/scratchpad/projects/farmtable/reports/rule-arming-audit.md`**, in the
order given above: criterion, counts, table, then interpretation, then:

- **WHAT YOU DID NOT CHECK** — a real section. It is read.
- **WHERE MY BRIEF WAS WRONG** — also real. Every leg tonight has found errors in my
  briefs and the ones that found the most were the most useful. My definitions above are
  the likeliest thing to be wrong.

Then a project log entry at
`/scion-volumes/scratchpad/projects/farmtable/reports/rule-arming-audit-project-log.md`.
Not into any code repository.

## TERMINATION

**You MUST write `reports/rule-arming-audit.md` and the project log entry, message me the
four counts and nothing else in the first paragraph, and then mark the task complete.** Do
not stall after the analysis. Do not ask me whether to write the file — write it.
