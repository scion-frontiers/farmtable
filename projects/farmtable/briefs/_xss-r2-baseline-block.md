# SHARED BASELINE BLOCK — url-scheme-validation-r2 @ 0bc9b72

Included verbatim in all three r2 review briefs, kept as one file so a correction lands once.

**This block is deliberately short.** Last round I put three confident claims into a shared block and
all three were false, and because they were *shared* each one cost three legs instead of one. The
things I am most sure of are the things that have burned me, so this block now carries facts that
are cheap for you to re-derive and almost nothing else. Anything I would have to argue for is in
your individual brief, where it can only cost one leg.

## Your tree

**I am not telling you your filesystem path.** I have gotten that sentence wrong in four briefs by
measuring it in my container and asserting it about yours. Run these:

```
git rev-parse --show-toplevel
git rev-parse HEAD     # must be 0bc9b721475dfe2fb24c5eba1034a071b842c45c
```

- Head **`0bc9b72`** — the project-log commit, docs only.
- Last **code** commit **`cedef7b`**. The diff between them touches one markdown file under
  `.design/project-log/` and no input to any gate.
- Base **`d4c4e6b`**. Review range is `d4c4e6b..0bc9b72`.
- **`origin/main` does not resolve in these clones.** Do not write a command that depends on it.
  `origin/HEAD` and branch refs do resolve.

Reports and briefs are at `/scion-volumes/scratchpad/projects/farmtable/{reports,briefs}/` —
absolute, outside the repo, same in every container.

## Gates — `[REPORTED — dev-xss-r2, in its own fresh clone]`, NOT measured by me

I have **not** run these myself on this branch. That is not laziness, it is the tag being honest:
the fix leg measured them, I am relaying, and relaying is provenance rather than evidence.
**Establish your own baseline before you attribute any failure to the diff.**

| gate | exit | note |
|---|---|---|
| `npm ci` (in `web/`) | 0 | |
| `npm run build` | 0 | was **2** at base `d4c4e6b`, 8 TS errors, `vite build` never reached |
| `npm test` | 0 | 3 test files discovered |
| `go build ./...` | 0 | **only after `npm run build`** — see ordering |
| `go vet ./...` | 1 | 4 pre-existing copylocks in `internal/server/server.go` |
| `go test ./...` | 1 | single failure, the known `TestWatchTasks_NoInitial` flake; 5 clean re-runs after |

**Ordering, and the trap in it.** `assets.go:5` is `//go:embed all:web/dist`. `web/dist` is
gitignored (by the bare pattern `dist/` at `.gitignore:17`, so grepping `.gitignore` for `web/dist`
finds nothing — `git check-ignore -v web/dist` shows it) and has zero tracked files. Without
`npm run build` first, every Go gate exits 1 with:

```
assets.go:5:12: pattern all:web/dist: no matching files found
```

That is task **#100**, pre-existing, out of scope, **do not file it**. The trap: a *built* clone
**also** exits 1 on vet, for a completely unrelated reason. **Both arms exit 1. The exit code cannot
tell them apart. Only the message can.**

**Match the copylocks by MESSAGE, not by count and not by line number.** All four read
`assignment copies lock value to ephReq`. The string `copylock` does **not** appear in the output —
I grepped for it, got 0, and nearly wrote "zero copylocks" into a brief. And the line numbers differ
between branches: `1509/1619/1827/2004` here versus `1782/1892/2100/2277` on another branch, same
four request types, same message. A different four is not the same four; the same four at different
lines still is.

`go test ./...` is **probabilistic, not a flat 0.** `internal/server` has a
`TestWatchTasks_NoInitial`/`_Heartbeat`/`_ClosedEvent` flake (`watch_test.go:118: timed out waiting
for event`). I have quoted "~8%" before with no confidence interval and that was unearned; treat the
rate as unknown and above zero. **Read failing test NAMES, never counts.** If you run a matrix,
exclude `TestWatchTasks` by name and add a tripwire that greps every RED for it rather than trusting
the exclusion.

## Rules

- **Do not push. Do not modify production code.** Your independence depends on it. Probes and
  harnesses are fine — revert them and assert `git status --porcelain` is empty afterwards, and
  **report the number of cells you left dirty** (it is a real number; one leg reported 0 of 4).
- **Revert by snapshot restore (`cp` from `/tmp`), not `git checkout`.** A leg lost uncommitted work
  to `git checkout`. Snapshot restore is immune regardless of what is committed.
- **Exit codes come from the child process, never through a pipe.** `cmd > f 2>&1; echo $?`, not
  `cmd | tail`. I made this exact mistake and got an empty exit code, and I made the sibling mistake
  (a failed command reporting 0 matches) again today.
- **A negative claim needs a positive control. Every one.** "I grepped and found nothing" is not a
  result unless you also show the grep finding something it should find.
- **Predict before you measure, and report your misses.** The single sharpest finding in each of the
  last four rounds came from someone chasing a prediction that turned out wrong. One leg predicted
  GREEN five times in a row and was wrong five times, and that run of misses *was* the finding.
- **Separate observation from inference, in those words.** A correct fact carrying a wrong inference
  is more dangerous than a wrong fact, because the fact survives verification and the inference
  rides in behind it.
- Tags: `[MEASURED]` = you ran it, this session, in your tree. `[REPORTED — <who>]` = relayed,
  re-measure before relying on it. `[INFERENCE]` = reasoned, not run.

## Required deliverable in every report: a numbered list of everywhere this brief is wrong

Every round for at least sixteen consecutive rounds has contained at least one brief error; the last
three contained eight, eleven and ten. **"I found none" will be read sceptically.**

Two specific things to look for, because they are my established failure modes:

1. **A question can carry a false premise exactly the way a claim can.** Three of my errors last
   round were *leading questions* that supplied the answer I expected. My tagging scheme covers
   facts and remedies and does not cover questions. If a question in your brief looks like it
   already knows its answer, that is a defect — say so, and answer the question you were actually
   able to measure rather than the one I framed.
2. **My suggested remedies are frequently wrong in a way that would ship a false test.** In the
   previous round on *this* branch I supplied a fixture *and* its expected result and both were
   wrong: I claimed `safeHref` rejects `http:/\/\evil.com`; it **accepts** it, because WHATWG reads
   the backslashes as slashes and yields `hostname === "evil.com"`. A leg that had reasoned from my
   brief instead of measuring would have shipped a fixture asserting the opposite of the truth.
   Reproduce the RED before implementing anything I suggest.
