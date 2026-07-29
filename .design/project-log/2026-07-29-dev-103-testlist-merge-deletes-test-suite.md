# #103 — a merge that deletes a test suite at exit 0

**Agent:** `dev-103-testlist` · **2026-07-29, 02:52–03:2xZ**
**Branch:** `test-list-reconcile-103` from `0b52dcdd6a06f694378084ea3ebefa7d9c473f15`
**No build token. No suite was compiled or executed at any point.** Every finding
below is a `git show` of a blob or a run of a script written for this task.

Every claim is marked **MEASURED** (I ran a command and read its output),
**DERIVED** (reasoning over measurements) or **UNKNOWN**.

---

## The two sides, pinned

Both branch heads were pinned to immutable refs before anything was measured.
This was not ceremony: **MEASURED** — `url-scheme-validation-r5` resolved to two
different SHAs 112 seconds apart during this work. A branch name is not an
identifier.

| Side | SHA | preserve ref |
|---|---|---|
| `#195` | `0b52dcdd6a06f694378084ea3ebefa7d9c473f15` | `refs/preserve/dev-103-testlist/m195-pin-0256Z` |
| XSS | `d5e35a4869475cd79c3a46e791909a610d1ea8f2` | `refs/preserve/dev-103-testlist/xss-pin-0256Z` |

## D1 — the two test scripts

**MEASURED**, `git show <sha>:web/package.json`. Neither side defines `pretest`
or `posttest`.

- **XSS:** `rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs`
- **#195:** `tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js`

**MEASURED** — `tsconfig.test.json` `include`: XSS is `["src/**/*.test.ts"]`;
#195 is a two-entry hand list.

**MEASURED** — tracked `*.test.ts`: #195 has 2 (`util/markdown`,
`utils/task-ready`); XSS has 4 (`util/assertions`, `util/safe-url`,
`util/url-binding-scan`, `utils/task-ready`). Union = 5.

**UNKNOWN, and marked so deliberately:** the XSS side reaches its suites by glob
plus runner discovery. Its membership is *not readable from the script*. I
enumerated the tracked files at that SHA, which is a different fact from what
the glob resolves to at run time on a working tree.

## D2 — what each resolution deletes, by name

**DERIVED** from the above.

| Resolution | Suites that stop running | How it presents |
|---|---|---|
| take-#195 | `util/assertions`, `util/safe-url`, `util/url-binding-scan` | **exit 0, silent** |
| take-XSS | none | loudly RED, twice over |
| naive union | none deleted; wiring incoherent | RED, runner aborts |

**The controlling file is `package.json` alone.** `tsconfig.test.json` only
decides whether the loss is *also* visible as uncompiled output. git merges the
two independently, so the outcome is a property of a **pair** that no single
conflict resolution ever puts on screen.

**take-XSS deletes nothing and cannot be quiet**, for two independent measured
reasons: `markdown.test.ts` emits zero `#assertions` receipts
(`grep -c` = 0), so the consumption gate fails it *by name*; and
`EXPECTED_ASSERTIONS = 380` moves.

> **This overturned the brief's headline**, which described the hazard as
> symmetric. It is not. Exactly one of the three resolutions is destructive and
> silent. The EM retracted the headline rather than softening it.

**Root cause, DERIVED:** both sides independently invented assertion-count
pinning with incompatible conventions. This is **a harness-protocol collision
wearing a `package.json` conflict's clothing.**

## The third convention nobody had counted

**MEASURED**, and it changed the D3 design after the design had been agreed:

| Suite | Reports |
|---|---|
| 4 XSS suites | `#assertions N` via `src/util/assertions.ts` |
| `util/markdown` (#195) | private total in prose, self-checked; **`EXPECTED_ASSERTIONS = 131`** |
| `utils/task-ready` (#195) | **nothing at all** — 162 lines, one throw, no counter |

A rule of "fail closed on a suite reporting neither format" therefore reddens a
suite that is not broken. Recorded in APPLY.md with both resolutions named and
**neither chosen**, because it depends on which blob wins the one content
conflict, and that is not my decision.

### A number I got wrong, and how

**MEASURED: `EXPECTED_ASSERTIONS = 131`, not 127.** I reported 127 earlier; the
EM quoted 127 back to me in a directive; I then measured the blob and found 131.
The file records `Moved 127 -> 131 in round 10` — 127 is the round-9 value.

The mechanism is worth more than the correction. **MEASURED:** in that one file
the literal `127` appears **30 times** and `131` **5 times**. Every one of the 30
is a stale historical note ("GREEN at 79/127"). *A grep for the assertion count
returns the wrong number thirty times to five.* The live pin is outnumbered six
to one by its own changelog.

**A number that round-trips through a directive comes back with authority it
never earned.** It was wrong when I sent it and it was still wrong when it was
quoted at me as an instruction.

## D4 — the guard, and the bug that only the real tree found

`check-test-membership.mjs` derives the EXECUTED set from `package.json` +
`tsconfig.test.json`, **never from the file listing** — every suite this merge
deletes is still present as a *file*. Pins membership by name. Exit 0 / 1 / 2,
where 2 is `GUARD-UNDETERMINED`: it fails closed on any wiring it cannot model,
because the set of ways a test script can invoke a suite is open.

Nine arms, all captured verbatim in `RED-PROOF.md`. **ARM E** is the one that
justifies membership over counts: it holds the executed count fixed at five and
swaps one suite for another — a `>= 5` floor and an `== 5` exact count are
**both green** on that tree, and the membership pin is red.

### The guard was RED FOR THE WRONG REASON, and RED was what I expected

**MEASURED.** First run against the real `#195` tree: exit 1 — the correct
outcome for that tree — reporting `src/util/markdown.test.test.ts`, a path that
exists nowhere. Internal stem `util/markdown`; hand-written pin
`util/markdown.test`; nothing normalised. All five names in that report were
wrong, **including the two suites that were running perfectly well**.

The six original arms missed it because every one of their pins was generated by
`--write-pin`. Writer and reader shared a private convention and always agreed.
The only untested path was the **hand-written pin — the only kind a human ever
maintains.**

> **A guard tested only against its own generated input has tested its agreement
> with itself.**
>
> And the corollary that nearly cost me this: **a guard observed FAILING when you
> expected failure is no more verified than one observed passing.** I wanted red,
> I got red, and the exit code was the last thing that would have told me.

Fixed by canonicalising both sides through one function, and by making an
unparseable pin entry `UNDETERMINED` rather than a reported missing suite — a
false accusation against a live suite is indistinguishable in the output from
the real defect. ARM G is the regression arm.

## D3 — reconciled wiring

Delivered as a **proposal**; `package.json` and `tsconfig.test.json` are
deliberately untouched on this branch. Applying them here would be half a merge
on a base missing three of the five suites, unverifiable without a build.

Protocol is **declared per suite** in `test-receipts.manifest.json`, not sniffed
— a runner that sniffs treats an unrecognised format as absence, which is #103
one level up. The logic lives in `scripts/test-receipts.mjs` **specifically so it
can be tested without a build**: `run-tests.mjs` does its work at import time,
which had put the most delicate rule in the change somewhere the only test was a
full build. `check-receipts.mjs` drives the real module: 21/21, and
**mutation-proven red** by making a silent suite report zero.

`aggregateAssertionPin` is **`null`**, stated with reasoning, per ruling.
`380 + 131` is a guess wearing a measurement's clothes. The runner prints on
every run that the aggregate is unchecked and exactly what that leaves
unprotected — **an unset gate that is silent is indistinguishable from a gate
that is on and agreeing**, which is the whole of #103.

## D5 — not done, and not covered by my silence

- **#100 (Go build/vet/test fail on fresh clone, `//go:embed all:web/dist`)** — not mine, not touched, not investigated.
- **#22 (no CI anywhere in this repo, task marked `completed`)** — the coordinator's. **I did not add CI, so nothing runs any of this automatically.** The guards fire when a human types `npm test`. That closes the merge-time hole and leaves #22 exactly where it was.
- **The merge itself** — not performed. Neither head is final.
- **The `task-ready.test.ts` content conflict** — not resolved; both options documented, neither chosen.
- **Anything requiring execution** — the aggregate pin's value, and end-to-end behaviour of the reconciled wiring. Exact commands are in APPLY.md.

## Standing findings this produced

1. **A wrong pointer that happens to resolve is worse than one that 404s, because it resolves silently.** (Adopted fleet-wide.)
2. **A brief that names a recipient by template instead of by name has not named a recipient.** (Adopted verbatim.)
3. **zsh's `:` history modifier mangles a `git show` pathspec** — `"$VAR:web/package.json"` loses `:we`; use `"${VAR}:..."`. Exit 128, visible only because stderr was not silenced. With `2>/dev/null` it would have handed me a clean empty reading of a file that exists.
4. **A guard tested only against its own generated input has tested its agreement with itself.**
5. **`/workspace/farmtable-*` are 123 worktrees of ONE shared `.git`**, not clones. Refs are a single fleet-wide namespace.
