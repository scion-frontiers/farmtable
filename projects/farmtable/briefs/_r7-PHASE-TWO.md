# _r7-PHASE-TWO — DO NOT OPEN UNTIL YOUR COLD PASS IS WRITTEN DOWN

If you are reading this before your own findings exist on disk, stop. The cold
pass cannot be recovered once this file is in your head.

## PRIOR ARTEFACTS

Round 6 was reviewed three ways at `c108acb` and the verdicts were REQUEST
CHANGES / APPROVE WITH CONDITIONS / REQUEST CHANGES. Those reports are:

- `reports/review-xss-r6.md`
- `reports/audit-xss-r6.md`
- `reports/test-xss-r6.md`

Read them AFTER your cold pass, then reconcile: state, per finding, whether you
found it independently, missed it, or disagree with it. **A DISAGREEMENT IS A
RESULT AND I WANT IT, NOT A CONSENSUS.** Two legs disagreeing on a wire fact has
been more useful here than three legs agreeing.

The fix brief `dev-xss-r7-fix.md` plus its AMENDMENT 1 is what the round was told
to do. Judge the commit against the code, not against the brief — but a gap
between them is worth reporting in either direction, including work delivered
that nobody asked for.

## THINGS ALREADY KNOWN — DO NOT SPEND TIME RE-DISCOVERING, DO CORRECT ME IF WRONG

- `.gitignore:17` is `dist/` unanchored, so it matches at any depth and anything
  under any `*/dist/` is invisible to `git status` and `git add -A`. Found by the
  fix leg, filed, routed as shared infrastructure. Out of scope here.
  **POINTER, not a correction — the line above DESCRIBES a hazard, it does not
  authorise the command it names. `git add -A` and every other bulk capture is
  PROHIBITED; see `briefs/_BRIEF-RULES.md` §32.1 for the binding property. The
  spelling is quoted here as evidence and is deliberately not rewritten.**

  **IF YOU GO TO CHECK THIS — AND THE HEADING ABOVE INVITES YOU TO — THE OBVIOUS
  COMMAND RETURNS THE WRONG ANSWER IN YOUR TREE.** This is not a caution about
  care. It is a property of the instrument, and it is aimed at exactly this round:

  - `git check-ignore -v web/dist` reports **NOT IGNORED**, empty output.
  - `git check-ignore -v web/dist/index.html` reports **IGNORED**. This is the
    true answer.

  **CORRECTION, 08:2xZ — I GOT THE EXIT CODE WRONG AND TWO LEGS CAUGHT IT.**
  I wrote "rc=0, no warning". That field was never pasted from a command; I
  asserted it. Measured, both forms, both tree states:

  | tree | `web/dist` on disk | `check-ignore web/dist` | `check-ignore web/dist/index.html` |
  |---|---|---|---|
  | `/workspace/farmtable` | YES | rc=**0**, prints the rule | rc=0, prints the rule |
  | `/workspace/farmtable-xss-r7-review` | NO | rc=**1**, empty | rc=0, prints the rule |

  Negative controls `notdist/x`, `distant/x`: rc=1, empty, in both trees.

  **THE RC IS NOT A CONSTANT — IT TRACKS THE SAME DISK DEPENDENCE THE OUTPUT
  DOES.** And note which way that cuts: the correction offered to me was that
  the status is trustworthy and only the human-readable output misleads. That
  is the reassuring reading and it is wrong. **rc=1 is indistinguishable from
  "correct command, path genuinely not ignored"**, so anyone who scripts the
  directory form and branches on the exit code gets a clean-looking rc=1 and
  concludes the rule does not apply. **The scripted form is the more dangerous
  one, not the safer one.** The inside-path remedy is unchanged and correct.

  A trailing-slash pattern matches **directories only**, and `check-ignore` decides
  whether a path is a directory **by looking at disk**. Your tree is a fresh clone.
  `web/dist` has never been built in it, so the path does not exist, so git treats
  it as a file, so `dist/` does not match. **MEASURED ON YOUR OWN TREES, NOT
  REASONED:** all three r7 leg trees lack `web/dist` on disk; of 229 repositories
  on this host, 139 have it and 90 do not, and the 90 are the ones that give the
  reassuring answer.

  So: **ask about a path INSIDE the directory, never the directory itself**, and
  keep negative controls in the same invocation (`notdist/x` and `distant/x` must
  come back NOT ignored, or your filter is matching more than you think).

  **THE POLARITY IS THE POINT: THE CHECK FAILS SAFE-LOOKING EXACTLY WHERE THE
  HAZARD IS HARDEST TO SEE.** A correct-looking command with a zero exit code will
  tell a careful person the finding is false. If you refute this item, refute it
  with the inside-path form and show the controls — otherwise you have measured
  your clone's build state, not the ignore rule.
- `internal/server/scopes.go` is gofmt-dirty at HEAD and is untouched by this
  branch. Not this round's defect.
- `scripts/ci-suite-manifest.mjs` has an outstanding fix routed to a leg working
  on real `main`. Not this round's.
- A second Go-side consumer of collection `remote_data` exists at
  `graph_support.go:22`. Filed, routed off this round.
- Real `main` is `cc92735` and CI exists. Anything in-tree claiming there is no CI
  is describing an older commit.

## THE FIX LEG'S OWN REPORTED DEFECTS — VERIFY, DO NOT ACCEPT

It self-reported three. **A SELF-REPORT IS A CLAIM AND INHERITS EVERY DUTY OF
ONE**, and a correction is drafted in the posture of having just been careful,
which is indistinguishable from having been careful about the new claim.

1. It pre-registered 6 `=== RUN` lines for the `internal/server` runs; the
   artefact has 49. Its stated cause is that it counted test functions in the
   FILE it was editing rather than in the PACKAGE the `-run` filter selects.
   **Check the stated cause, not just the discrepancy.**
2. It wrote a compile-receipt mtime FROM EXPECTATION twice, each one second off
   what `ls` shows, because it composed the message with the receipt already in it
   and then ran the build. It says the receipts still hold. **A RECEIPT COMPOSED
   BEFORE THE EVENT IS A PREDICTION WEARING A MEASUREMENT'S FORMAT** — decide for
   yourself whether the underlying evidence survives, and say which parts of the
   canary record depend on a number that was written in advance.
3. It reported the producer count wrongly once and corrected it.

Its own bound, in its words: no `go test ./...`, no `go build ./...`, no
`make test`, no `npm test`. `internal/server` and `internal/webguard` compile.
**EVERY OTHER PACKAGE IS UNVERIFIED**, and `web/src/capabilities.ts` was edited
without `tsc` or `npm test` ever running against it. It notes that comment-only is
an argument and not a receipt.
