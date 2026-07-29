# dev-103-testlist — #103, a merge that deletes a test suite at exit 0

**To:** `farmtable-em-task-state-model-v2` · **2026-07-29 ~03:2xZ**
**Branch:** `test-list-reconcile-103` @ base `0b52dcd`, own worktree
`/workspace/farmtable-dev-103-testlist`. **Three commits, not pushed.**

**BUILD FENCE HONOURED.** No `npm test`, no `npm run build`, no `go` anything, no
`make`, not once. Every measurement is a `git show` of a blob or a run of a
script I wrote. The only things executed are my own guard, my own receipt
checker, and `node --check`. **I did not need a token and did not request one.**

---

## Headline

**The hazard is not symmetric, and the brief said it was.**

| Resolution | Suites that stop running | Presentation |
|---|---|---|
| **take-#195** | `util/assertions`, `util/safe-url`, `util/url-binding-scan` | **exit 0, silent** |
| take-XSS | **none** | RED, two independent reasons |
| naive union | none deleted, wiring incoherent | RED, runner aborts |

Exactly one of the three destroys anything, and only that one is quiet.

**The controlling file is `package.json` alone.** `tsconfig.test.json` only
decides whether the loss is *also* visible as uncompiled output. git merges the
two independently, so **the outcome is a property of a PAIR that no single
conflict resolution ever puts on screen.** That is the actual mechanism of #103,
and it is why resolving either file carefully, alone, does not help.

**Root cause:** both branches independently invented assertion-count pinning with
incompatible conventions. **A harness-protocol collision wearing a
`package.json` conflict's clothing.**

---

## Deliverables

- **D1** — both scripts measured at pinned SHAs, verbatim, with `pretest`/`posttest` checked (neither side has them). XSS glob membership marked **UNKNOWN**, not enumerated.
- **D2** — table above. Names, never counts.
- **D3** — reconciled wiring + a runner that learns the second receipt format. **Proposal; `package.json` and `tsconfig.test.json` untouched on this branch.**
- **D4** — membership guard, **nine arms**, all output captured verbatim.
- **D5** — below.
- **D6** — `.design/project-log/2026-07-29-dev-103-testlist-merge-deletes-test-suite.md`, every claim marked MEASURED / DERIVED / UNKNOWN.
- **D7** — three commits, one logical change each. **Not pushed.**

All artefacts: `.design/proposals/103-test-list-reconcile/` (`APPLY.md` first).

---

## Three things you should read even if you skip the rest

### 1. `EXPECTED_ASSERTIONS` is **131**, not 127 — and I am the source of the error

Your ruling said *"DO NOT REWRITE markdown.test.ts's 127 ASSERTIONS."* **MEASURED
at `0b52dcd`, line 5380: `const EXPECTED_ASSERTIONS = 131;`** The file itself says
`Moved 127 -> 131 in round 10`. 127 is the round-9 value. I reported 127; you
quoted it back as an instruction; it was wrong both times.

The mechanism matters more than the correction. **MEASURED:** in that one file the
literal `127` appears **30 times** and `131` **5 times** — all 30 are stale
historical notes (`GREEN at 79/127`). **A grep for the assertion count returns the
wrong number thirty times to five.** The live pin is outnumbered six to one by its
own changelog.

> **A NUMBER THAT ROUND-TRIPS THROUGH A DIRECTIVE COMES BACK WITH AUTHORITY IT
> NEVER EARNED.** I sent it up as an aside; it came back down as a constraint I
> was told not to violate. Nothing in that loop re-read the file.

Your instruction is unaffected in substance — I did not touch the suite's
assertions — but the number in it should be corrected before it propagates.

### 2. There is a **third** receipt convention, and it breaks your fail-closed rule

You ruled: teach the runner the second format, **fail closed on a suite reporting
neither.** Implemented. But **MEASURED**, `#195`'s `utils/task-ready.test.ts`:
162 lines, a local `assert` that only throws, and **no output whatsoever** on
success — no `#assertions`, no `console.`, no `writeSync`. It is not a bad suite;
it predates both conventions.

So the rule, applied literally, **reddens a working suite.** And this lands on
`utils/task-ready.test.ts` — **the one path present on both sides, with differing
blobs** (`9b4cd5b` XSS vs `ef6d702` #195). The XSS blob imports `assertions.js`
and reports fine. **Whether your rule is a no-op or a hard failure depends
entirely on which blob wins the one content conflict.**

I did **not** choose. Both resolutions are written up in `APPLY.md`: take the XSS
blob, or route #195's local helper through `assertions.ts`. I also refused to add
a `silent` protocol to the manifest — an exemption is how a suite stops reporting
and nobody notices.

### 3. My guard went RED FOR THE WRONG REASON, and red was what I expected

First run against the real `#195` tree: **exit 1** — correct for that tree —
reporting `src/util/markdown.test.test.ts`, **a path that exists nowhere.**
Internal stem `util/markdown`, hand-written pin `util/markdown.test`, nothing
normalised. All five names in that report were wrong, **including the two suites
that were running perfectly well.**

Six fixture arms had passed. They missed it because **every one of their pins was
machine-generated by `--write-pin`** — writer and reader shared a private
convention and always agreed. The untested path was the hand-written pin, which
is the only kind a human ever maintains.

> **A GUARD TESTED ONLY AGAINST ITS OWN GENERATED INPUT HAS TESTED ITS AGREEMENT
> WITH ITSELF.**
>
> And the part I nearly walked into: **a guard observed FAILING when you expected
> failure is no more verified than one observed passing.** I wanted red, I got
> red, exit code 1, on the correct tree. The only thing that caught it was reading
> the filenames in output I had already decided was correct.

Fixed by canonicalising both sides through one function; an unparseable pin entry
is now `UNDETERMINED`, never a reported missing suite, because a false accusation
against a live suite is indistinguishable in the output from the real defect.
ARM G is the regression arm.

---

## D4 in one line each

Nine arms, verbatim in `RED-PROOF.md`, zero mismatches.

**A** reconciled wiring → PASS (green control; without it, a guard that fails on
everything looks identical to a working one) · **B** take-#195 → FAIL, names 3 ·
**C** #195 script + XSS glob → FAIL, names 3 (compiled, never executed) ·
**D** XSS script + #195 include → UNDETERMINED 2 · **E** **count-neutral
substitution, 5 executed vs 5 pinned** → FAIL, names 1 · **F** unrecognised
invocation form → UNDETERMINED 2 · **G** hand-written pin, four spellings →
PASS (regression) · **H** the reconciled wiring itself → PASS · **I** reconciled
wiring reverted to the #195 hand list → FAIL, names 3.

**ARM E is the whole argument for membership over counts:** count fixed at five,
one identity swapped. **A `>= 5` floor and an `== 5` exact count are both GREEN
there.** Membership is red. Per your (b) ruling the aggregate count pin is
**stated and unset**, with the reason in the file.

Separately, `check-receipts.mjs` drives the real protocol module — not a copy —
**21/21**, and I **mutation-proved it red** by making a silent suite report zero,
then restored the module and verified it byte-identical.

I split the protocol logic into `scripts/test-receipts.mjs` for one reason worth
stating: `run-tests.mjs` does its work at import time, so nothing could exercise
it without running the whole suite. **The most delicate rule in this change was
sitting somewhere its only test was a full build** — which is precisely the
position that gets things shipped untested behind a fence like tonight's.

---

## D5 — not done, and my silence does not cover it

- **#100** (Go build/vet/test fail on fresh clone) — not mine. Not touched, not investigated.
- **#22** (no CI; task marked `completed`) — yours/the coordinator's. **I added no CI, so nothing runs any of this automatically.** The guards fire when a human types `npm test`. A membership pin with no CI is a seatbelt someone has to remember to fasten. **This is the composition finding still standing at the end of my task.**
- **The merge** — not performed. Neither head is final.
- **The `task-ready.test.ts` content conflict** — not resolved. Both options documented.
- **The aggregate pin's value, and any end-to-end behaviour** — UNVERIFIED, requires execution. Exact commands and the exact observation that settles each are in `APPLY.md`.

---

## Every place the brief was wrong

1. **§0 headline — the hazard is not symmetric.** "Take one side, or take both as git sees them, DELETES A WHOLE TEST SUITE AND REPORTS SUCCESS" is true of exactly one of three resolutions. take-XSS deletes nothing and goes red loudly, twice. *(You retracted this rather than softening it.)*
2. **§4 pointer to `briefs/_STANDING-RULES-2026-07-29.md` — the file is not there.** Only copy fleet-wide is `em-tooling/`. *(Confirmed; brief corrected.)*
3. **§5 `scion message eng-manager` — no such agent exists.** That is the template column. *(Confirmed; your ledger #186.)*
4. **No opening working-tree + SHA sentence**, required by BRIEF-RULES §3. I refused to guess and asked; you supplied `0b52dcd`.
5. **§4 `$pipestatus` guidance failed open** — `${rc:-MISSING}` guards a condition that cannot occur. *(Corrected in place by the coordinator mid-task; I audited all six of my exit-code reads and none were void.)*
6. **D4's own wording contradicts its last sentence.** It specifies "fails when the number of executed suites drops below a pinned figure" and then says pin membership, not a count. I built membership. **ARM E shows the count version would have been green on a real deletion.** The deliverable's headline sentence specifies the weaker guard.
7. **The 127 figure** — not in the brief but in the ruling that accompanied it. It is 131. *(My error originally; see above.)*

---

## Not asked for, but you should know

- **`grep` for `#assertions` in `markdown.test.ts` returns 0** — the suite that would have been *deleted* silently is also the one that cannot satisfy the surviving runner's gate. The two halves of this conflict are load-bearing against each other in both directions.
- **`url-binding-scan.test.ts` has no module under test** — it is a tree scanner, not a unit test of anything. It is in the union pin because it executes and asserts; flagging it in case that surprises someone.
- **`url-scheme-validation-r5` moved during my measurements** — two SHAs, 112 seconds apart. Everything is pinned to `refs/preserve/dev-103-testlist/*`.

**Awaiting your direction. Not pushing. No builds run.**
