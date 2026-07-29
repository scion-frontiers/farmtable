# 2026-07-29 — XSS / URL-scheme axis: the r8 ∪ r9 ∪ main union

Branch `xss-url-scheme-union`. Full evidence, every command and every
denominator: **`reports/dev-xss-union.md`**, committed alongside this file. This
entry records only what a future reader of the *project* needs, not the audit
trail.

Parents: `url-scheme-validation-r8` @ `07f12a3`, `url-scheme-validation-r9` @
`74d9db2`, `main` @ `faf1c8c`. All three are ancestors of the tip — merged, not
rebased. **`af9ea8c` is preserved deliberately**: that SHA is cited in fourteen
places across six tracked files, including inside a test's runtime failure
message. A rebase would have turned a working citation into a dangling one, and
the citation is the thing that tells the next editor why the guard exists.

---

## What the axis now guarantees

The write-authorization gate is a conjunction spanning two languages. The GitHub
capability set is reachable only by an object carrying platform GITHUB **and**
`remote_data.writable == true`, together:

- **Conjunct A (Go)** — an imported collection is always farmtable-platform.
  Import copies an uploaded document's `remote_data` into storage with no key
  validation, so any caller with `ScopeCollectionAdmin` can plant
  `writable: true`. The planted key is inert *only* because conjunct A holds.
- **Conjunct B (TypeScript)** — `getCapabilities` returns before reading
  `remote_data` on a farmtable collection.

**Either conjunct moving arms the other.** Both are now pinned by a test named
for the property rather than for the mechanism:

| conjunct | test | file |
|---|---|---|
| A | `TestConjunctA_ImportRejectsNonFarmtableCollection` + accepting control | `internal/server/export_import_conjunct_test.go` *(new)* |
| B | `pinTheAf9ea8cGuard()` + GITHUB control | `web/src/capabilities.test.ts` |

Conjunct A was previously exercised only by four unnamed lines inside
`TestRPC_ImportExportCollection_Errors` that assert a gRPC code among four other
`FailedPrecondition`s and never name the security property. Those lines are
**left in place** — they test the RPC's error contract, which is a different
thing — but they were never a message to a future editor about what breaks if
the check is relaxed. Now there is one.

Each conjunct test carries an **anti-vacuity control**, and the controls are not
ceremonial. Under a mutant that rejects every import, the *rejection* test still
passes — a dead import path satisfies it completely — and only the control goes
red. Without it the suite would certify a broken server as a working guard.

---

## Three findings that generalise past this axis

**1. A tip-to-tip diff is not a disagreement count.** Eight files differ between
the r8 and r9 tips; exactly **one** is two-sided. Since the common ancestor the
r8 branch changed one file — its own log — in all five of its commits. git
raised one conflict. Seven of the eight are one-sided additions with nothing to
adjudicate. `git diff A..B` answers "what differs", never "who moved"; only
`git diff $(git merge-base A B) X` does that. Planning an eight-way content
adjudication off the former costs seven reviews that have no second side.

**2. Naming a cardinality in a comment is a latent falsehood.** Three gate
comments said the GitHub set unlocks "nine" write operations. Measured,
`GITHUB_CAPABILITIES` has fifteen fields of which nine are `true` — so the
number is right today by coincidence, and one flag flip makes the prose false
with nothing red. All three now name the identifier and state explicitly that
they will not say how many. Same edit caught a **stale identifier citation**: a
comment pointed at `ft-app.ts isCollectionWritable` after that predicate moved
to `capabilities.ts`. An identifier citation decays like a line number, just
more slowly.

**3. Verifying that a command succeeded is not verifying that it did the work.**
Three separate times this round a green result meant nothing had happened:

- An eight-run interleaved differential where the clone predated the test. Every
  run printed `[no tests to run]` and `EXIT=0`. **Both arms green reads as "no
  difference" and meant "no measurement".** The schedule *declared* a population
  of 11 and asserted nothing. Now every run counts its own `=== RUN` lines and
  voids itself on a mismatch.
- `node … | tail` reporting `EXIT=0` for a command that exits `1` — `tail`'s
  status, not the checker's.
- A base arm labelled `COMMIT=d2cea9b (= faf1c8c, main)` that had silently
  stayed on the branch tip, because `git clone --shared` does not carry a custom
  `refs/*` namespace and the checkout failed. Caught only by printing the
  resolved SHA next to the label — **a label asserting an identity the command
  has already contradicted is worse than no label.**

The house rule that came out of the axis, now adopted track-wide: **put the
population next to the result.** Every build/test/vet figure carries its root,
its tree state, and its denominator.

---

## Resolved after this entry was first written: the suite-manifest collision

**The section below is kept for the reasoning, but the blocker is withdrawn.**
It was measured against `faf1c8c`, and six commits later main had changed the
very script being measured — `edc75b6` moved main's own web suite to discovery
(`node --test .tmp-test`), and main's analyser understands main's own runner.
Merging `7a2ad51` (merge `bbea1e5`) resolves it: `ci-suite-manifest.mjs` exits
**0**, `enumerated=5 executed=5 missing=0`.

**A control commit is itself a measurement, and it goes stale.** I had been
careful to name the tree, the command and the denominator for every figure, and
still reported a branch-vs-base comparison whose *base* had moved. Naming the
base is not enough; it has to be re-resolved when the finding is acted on.

Adopting main's runner costs the absolute assertion pin: `node --test` counts
`test()` calls (`# tests 5`), our runner counted work done (`483 assertions`)
and failed any file exiting 0 having evaluated zero. That is **parity with main,
not a regression against main**, so it did not block. It is owned by
`ci-22-setup` — and it is one defect with two customers, since the task-state
track's phase2-web-ui-r5 hits the same wall with its own glob runner.

The constraint attached to the fix is worth carrying anywhere else it applies:
**enumeration must stay independent of the thing being enumerated.** A tree scan
that derives `enumerated` from the runner's self-report asks the thing under
test to certify itself, and a runner that silently under-reports passes — the
same vacuous-pass shape the check exists to prevent.

## Open, and not fixed here

**`node scripts/ci-suite-manifest.mjs` exits 1 on this branch and 0 on
`faf1c8c`.** `main`'s new manifest analyser cannot map the XSS line's
glob-discovery test runner to files, so it reports **0 of 5** web test files
executed. All five run: `npm test` exits 0 with 483 assertions in the same tree,
minutes apart. The tool says `COULD NOT ANALYSE` in its own body and then
reaches the opposite conclusion in its headline.

Neither parent has this fault. `main` has exactly one web test file, named
explicitly in `package.json`, which the analyser resolves fine. The merge
creates the failure, so nobody could have seen it before the merge. **CI at
`ci.yml:85` will go red on this branch for a false reason.**

Two one-sided fixes; the second is better, because a manifest produced by the
thing that performs the discovery cannot drift from it:

1. Teach `scripts/ci-suite-manifest.mjs` the runner *(EM-CI's file)*.
2. Have `web/scripts/run-tests.mjs` emit its discovered file list and have the
   checker read that *(the XSS line's file)*.

Not touched here — shared CI infrastructure, unassigned.

Also open, **declined for this track and recorded so the next reader does not
re-file them**: four pre-existing `assignment copies lock value` vet findings at
`internal/server/server.go:1509,1619,1827,2004`. Not a regression; they become
visible only once a clean clone can build.

---

## Makefile

Main's version taken wholesale, verified byte-identical to `faf1c8c`. Its target
set is a strict superset of ours — confirmed by comparing target lists, not
assumed. One thing was genuinely lost: the comment recording *why* `test` was
split into `test-go`/`test-web` (an audit found `git grep "npm test"` returned
only prose, so CI running the obvious `make lint && make test && make build`
would still not have executed the web guard). **That rationale survives in
`url-scheme-validation-r4-fix-round.md` and in `CLAUDE.md` — checked before
accepting the deletion, not after.**
