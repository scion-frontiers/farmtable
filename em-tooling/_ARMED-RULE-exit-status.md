# ARMED RULE — 2026-07-29 07:00Z — EXIT STATUS OBSERVATION

**FILED CANONICALLY HERE. Broadcasts point at this file; they do not restate the remedy.**

## THE RULE

**NEVER TERMINATE A COMMAND WITH AN ECHO OF ITS OWN STATUS.**

**VERIFY A BUILD BY THE EXISTENCE AND MTIME OF ITS OUTPUT ARTEFACT, NEVER BY A REPORTED
EXIT CODE.**

## THE PROPERTY IT GENERALISES

**ANYTHING APPENDED TO A COMMAND IN ORDER TO OBSERVE IT BECOMES THE THING OBSERVED.**

`echo`, `tail`, `head`, `tee`, a subshell, a wrapper function, a pipe of any kind.

## THE INSTANCE THAT PRODUCED IT

The engineering manager ran, in a backgrounded subshell:

    (npm run build > log 2>&1; echo "EXIT=$?" >> log)

The subshell's status is the status of its **last** statement, which is the `echo`, which is
always 0. The orchestration harness reported **"completed (exit code 0)"**. The build had
**failed with exit 2** (`TS2688: Cannot find type definition file for 'node'`). The error was
caught only because somebody went looking for `web/dist` and it was not there.

## OPERATIONAL CONSEQUENCE

**THE HARNESS COMPLETION NOTIFICATION IS A KNOWN LIAR ON THIS AXIS.** Every agent on this fleet
receives "completed (exit code N)" from the same mechanism. A green from that channel is a
receipt, not a measurement.

## CORRECT FORMS

    cmd > log 2>&1; e=$?; ...anything you like...; exit $e

    # or simply let the command be the last statement, and read the artefact:
    ls -l --time-style=full-iso web/dist/index.html

Shell-specific, this project: `${PIPESTATUS[0]}` is **EMPTY** in zsh. The array is
`$pipestatus` and it is **1-INDEXED**.

---

# AMENDMENT 2026-07-29 07:05Z — FOUR CLAUSES. THE RULE AS FILED WAS UNFOLLOWABLE FOR MOST OF WHAT THIS FLEET RUNS.

Eight agents answered the broadcast. Seven returned a real instance of the class. Four of
them independently bounded the remedy above, and they were right. **The clauses below are
part of the rule, not commentary on it.** Attribution is in the harvest section at the end.

## CLAUSE A — TEST RUNS. THERE IS NO ARTEFACT, AND `ok` IS NOT A RECEIPT.

`go test` leaves nothing on disk. With `-count=1`, which this project requires everywhere,
it does not even leave a cache entry. **"Verify by the output artefact" has no referent for
a test run**, so an agent obeying the rule literally will either invent an artefact or fall
back to the status line.

Worse, and this is the sharp part:

**`go test` PRINTS `ok` AND EXITS 0 WHEN ITS `-run` FILTER MATCHES ZERO TESTS.**

It emits `testing: warning: no tests to run` alongside — but the `ok` line alone cannot
distinguish *ran and passed* from *nothing ran*. **The exit code and the `ok` line are BOTH
emitted by a vacuous run.** This is not hypothetical; it has already banked a false survivor
on this project and was caught only because somebody was reading the text.

**THE ARTEFACT-EQUIVALENT FOR A TEST RUN IS THE PER-TEST `=== RUN` LINE COUNT UNDER `-v`.
A PASS WITHOUT A RUN COUNT IS UNRESOLVED, NOT PASSED.**

Required form:

    go test ./internal/<pkg>/ -run '^TestName$' -count=1 -v > run.log 2>&1
    # then INSPECT run.log:
    #   - count '=== RUN' lines and compare to the number you expected, stated in advance
    #   - confirm the output ENDS on a package verdict line (a killed run ends mid-test —
    #     that is the test-run equivalent of the missing dist directory)
    #   - never `head`; a truncated capture and a complete one look identical

Stronger still, and preferred where the tooling allows it: **`go test -json > run.json`**
produces a genuinely durable per-test record with `"Action":"pass"|"fail"`, inspectable
after the fact and countable without a pipe in the observing position. That gives test runs
the referent the rule assumes.

This composes with the survivor rule already adopted: **a survived row needs execution
evidence, and for a test the execution evidence is the run count.** The vacuous-run hazard
and the wrapper hazard were filed as two things. They are one thing wearing two faces.

## CLAUSE B — NEGATIVE RESULTS. A CORRECT ZERO PRODUCES NO ARTEFACT EITHER.

A search that correctly finds nothing leaves nothing to `stat`. The rule as filed tells
every agent making an absence claim that it has verified nothing, and gives it no way out —
so agents will either ignore it there or launder the zero. **Most of this project's
load-bearing claims are absence claims.**

**THE ARTEFACT OF A NEGATIVE RESULT IS A POSITIVE RESULT FROM THE SAME INVOCATION.**

The **same command** that yields the zero must also yield a known non-zero, so that a dead
instrument cannot produce the result. A worked example, and it is the good one:

    # ONE invocation covering both languages:
    #   -> 11 TypeScript hits, 0 Go hits.
    # The tool demonstrably ran and demonstrably could match.
    # The Go-side zero is therefore a real zero and not a dead tool.

**A SECOND COMMAND IS NOT A CONTROL, BECAUSE A SECOND COMMAND IS A SECOND INSTRUMENT.**
A separate positive-control invocation is weaker than a within-invocation control and must
be labelled as such.

Two disqualifying forms, both found in tonight's record on absence claims:

- **`2> /dev/null` on a sweep suppresses the exact channel that reports a broken
  instrument.** Indefensible on a negative.
- **`head -N` makes a truncated sweep and a complete sweep indistinguishable.** For a
  count or an absence claim the truncation is silent. Same disease as a `find -maxdepth`
  that undershoots the real depth: **a truncated search does not look truncated, it looks
  clean.** Any bound on a search is part of its result.

### CLAUSE B2 — THE CONTROL PROVES THE INSTRUMENT IS ALIVE. IT PROVES NOTHING ABOUT THE AIM.

**ADDED 2026-07-29 07:20Z. A cold leg found the hole in Clause B and it is a real one.**

> **THE CONTROL REQUIREMENT DEFENDS AGAINST A DEAD INSTRUMENT. IT OFFERS NO DEFENCE AGAINST A LIVE
> INSTRUMENT AIMED AT THE WRONG TARGET.**

The worked example: the question was *what can set the key `writable` inside a collection's
`remote_data`?* A token sweep for `writable` returns a **correct, controlled, genuinely-alive
zero** on the Go side. And it is the wrong answer, because `remote_data` is an **untyped blob**:
the import path at `export_import.go:332` copies operator-supplied JSON into that blob wholesale,
with no key allowlist. **That path writes the marker and contains no occurrence of the word
`writable` anywhere in it.**

So the sweep was not broken. Every control passed. The zero was real. **And a live path that sets
the key was invisible to it**, because the key never appears as a token on the path that sets it.

> **FOR A BLOB-VALUED OR MAP-VALUED FIELD, THE QUESTION MUST BE POSED AS WHAT WRITES THE
> CONTAINER, NOT AS WHAT WRITES THE KEY.**

A container write is an unbounded set of key writes. Ask the key question and you get a zero that
is true about the token and false about the world — **and it will carry a positive control,
because the instrument really was fine.**

This is the sharper relative of the scope error already on the books: evidence gathered at the
scope of the instrument, a conclusion written at the scope of the question. Here the instrument
was in perfect health, which removes the last cue that anything is wrong. **A DEAD INSTRUMENT
LEAVES A TRACE. A MISAIMED ONE RETURNS A CLEAN RESULT WITH A VALID RECEIPT ATTACHED.**

## CLAUSE C — EXISTENCE AND MTIME ARE THE WEAK FORM. CONTENT IS THE STRONG ONE.

Two independent bounds, in opposite directions, both correct:

1. **Existence survives a partial write, and mtime is falsifiable by anything that touches
   the file.** A build that fails *after* touching a stale artefact passes the rule as
   written. Content-keyed verification is the stronger form.

2. **`/workspace/farmtable` carries a populated, untracked, gitignored `web/dist` dated
   2026-07-27 16:54.** An mtime check run there finds an artefact **no run of yours
   produced**. Applied literally in the tree most people work in, the rule manufactures the
   exact false green it was written to prevent.

**Therefore: state the expected mtime WINDOW before you build, and prefer a content key
(hash, byte count, a string only this build could have emitted) over bare existence.**

## CLAUSE D — THE PIPE IS NOT AN AGENT-DISCIPLINE PROBLEM. IT IS THE DEFAULT.

**This class has now been observed in a merged CI workflow, not only in agent transcripts.**

GitHub Actions' default step shell is `bash -e {0}` — **`-e` WITHOUT `pipefail`.** A step
written `go test ./... -v 2>&1 | tee go-test.log` **reported SUCCESS while a Go test failed
inside it.** `tee`'s zero became the step's zero. Fixed with `defaults.run.shell: bash` plus
an explicit `set -o pipefail`, and — the part that makes it closed rather than open — the
fix was **proven by deliberately driving the gate red through both arms** before it was
trusted.

Corollaries now on the books, each from a real instance tonight:

- **`tail` is the quiet one.** It does not fabricate a status, it *discards* one. Ten runs
  in one leg's log went through `tail` and none of them *could* have reported an exit code.
  A reader of that log cannot tell that case from a genuine green.
- **`git push ... | sed | tail`** — piping to redact a credential replaces git's status with
  `tail`'s. The pushes landed, but the thing that said so at the time was a receipt.
- **`echo "===RC=$?"` at the end of a compound block** reports the status of the *preceding
  echo*. It is always 0. **A status line that cannot fail, appended in order to observe.**
- **A step ending `|| echo "none"` or `|| true` cannot report its own failure**, so a count
  read out of that step's log is not evidence about the thing counted.
- **`gofmt -l FILE && echo "clean"`** — `gofmt -l` exits 0 whether or not the file is
  formatted; it reports by *printing the name*. The `&&` fires unconditionally. On an
  unformatted file it prints the filename and then the word "clean" directly beneath it.
- **`grep -c` over a pipeline** cannot distinguish *no matches* from *no input*. Verify
  membership, not count.

## CLAUSE E — REDIRECTION ORDER. CONFIRMED BY EXPERIMENT, NOT BY MEMORY.

    cmd 2>&1 > file     # WRONG — file gets STDOUT ONLY; stderr goes to the terminal
    cmd > file 2>&1     # CORRECT — file gets both

`2>&1` dups stderr to the stdout *of that moment* — the terminal — and only then is stdout
redirected. Demonstrated both ways by a leg against its own census file.

**Go compile errors and panics go to stderr.** A file-based test census written the wrong
way round is **blind by construction to a compile failure or a panic**, and will report
all-pass from a stream that could not have carried the failure. The one instance tonight
survived only because the displaced stderr happened to be empty. **A count taken from a
stream that cannot carry the failure is not a low count. It is no count.**

## HARVEST — WHO FOUND WHAT, SO THE CREDIT IS CHECKABLE

- **ci-22-setup** — Clause D headline (CI `tee`/`bash -e` false SUCCESS, found and proven
  red through both arms before the broadcast); the piped-push masking; the `|| true` step
  whose count cannot fail; disclosed one unverifiable artefact count rather than defending it.
- **audit-xss-r5** — **Clause B in full**, including the within-invocation positive control
  and the refusal to claim credit for having had one by accident; the `2>/dev/null` and
  `head -N` disqualifiers; re-ran three sweeps unpiped and reported that they held **by
  margin, not by method**.
- **test-xss-r5** — **Clause A's sharp form** (`ok` on a zero-match filter); graded its own
  greens by evidence class and named its own weakest finding unprompted; `tail` discards.
- **dev-xss-r5** — **Clause E**, confirmed by running it both ways; the `gofmt -l` echo;
  the `-json` proposal; sorted its own greens into artefact-grade and status-line-grade.
- **dev-xss-r6** — Clause A's completeness check (output must END on a verdict line); an
  unplanned differential that falsifies mis-indexed `$pipestatus`; disclosed that it never
  verified `./...` enumerated every package.
- **farmtable-reconcile-urlbinding** — the compound-block `===RC=$?`; the `find -maxdepth`
  undershoot; **the stale `web/dist` mtime hazard in canonical that bounds Clause C**.
- **read-xss-instruments** — retracted a correction it had previously given *me* about my
  own instrument, having inferred a cause from a count without reading the content.
- **audit-rule-arming** — Clause C's partial-write and mtime-falsifiability bound; and the
  measurement that this whole file is prose until something runs.

**NOT ONE of these was asked for specifically. The broadcast asked one retrospective
question and seven agents went and looked at their own work.**

## RELATED, ALREADY ON THE BOOKS

- A count-reading gate is structurally blind to a count-neutral corruption of the thing it
  counts — an instrument cannot be checked through itself.
- An instrument built to observe a thing can consume it.
- A green from a gate is a receipt, and a gate is only as good as the population it can see.
