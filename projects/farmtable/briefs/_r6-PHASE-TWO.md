# PHASE TWO — WHAT THE ROUND CLAIMS

## STOP. DO NOT OPEN THIS FILE UNTIL YOUR PHASE ONE OUTPUT IS WRITTEN TO DISK.

If you are reading this and your Phase One is not yet saved, **close it now and say so in your
report.** An honest breach is worth more than a claimed protocol. But you should not be here yet.

**WHY THIS IS A SEPARATE FILE, AND IT IS AN APOLOGY.** In round six this content sat as section 7
INSIDE the common brief, fenced with a heading that said "do not read until phase one is on disk"
— and the dispatch message told every leg to read that file, in full, first. All three legs
obeyed the dispatch, all three were contaminated identically, and the round lost the cold-pass
measurement that three independent legs exist to produce. In one leg's words:

> **AN EMBARGO ENFORCED BY A FILE BOUNDARY CANNOT BE VIOLATED BY AN OBEDIENT READER. AS WRITTEN,
> THE MORE COMPLIANT THE LEG, THE MORE THOROUGHLY IT IS CONTAMINATED.**

A heading is not an access control. A file is. That is the entire reason this file exists.

---

<!-- PHASE TWO CONTENT BEGINS -->

The round is the sixth on a single axis: **`remote_data` is an attacker-authored map, and the
question is what goes RED when somebody adds a consumer of it.** The round shipped work items
B1–B11. B11 is the enforcement guard.

**The guard** is `internal/webguard/remotedata_consumers_test.go`. It censuses mentions of the
field in the **web** tree and compares them against a hand-declared allowlist keyed on
**file + exact trimmed source text**, at an **exact multiplicity under strict equality** — a
count too high fails exactly as hard as a count too low. It has a companion non-vacuity test
that duplicates part of the allowlist on purpose, so that a bug emptying the allowlist cannot
make both tests pass.

**The measured properties of that guard, from four planted mutations in the developer's own
tree, each reverted with the green confirmed afterwards:**

| plant | file has declared entries | file has none |
|---|---|---|
| literal spelling, differing text | **RED / UNDECLARED** | **RED / UNDECLARED** |
| literal spelling, byte-identical duplicate | **RED / MULTIPLICITY** | n/a — nothing to duplicate |
| computed access (no literal identifier) | **GREEN** | **GREEN** |

**THE BOUND THAT SHIPS WITH IT, AND IT IS NARROWER THAN THE ROUND SET OUT TO EARN:**

> **CATCHES THE ACCIDENTAL ADDITION; NEVER OBSERVED CATCHING A DELIBERATE ONE.**

Mechanism: a computed access emits no census entry, so it never reaches the part of the guard
that knows which file it is in. The file-has-entries axis **does not exist** for that row.

**TWO IN-TREE INACCURACIES ARE KNOWN AND DELIBERATELY NOT FIXED**, because the SHA was frozen
before they were found. They are fix-round items, they are not defences, and **you should still
file them if you find them independently** — I want to know whether a cold read reaches them:

1. The project-log entry at `c108acb` contains an earlier version of the table above which
   includes a deletion result in a table about additions, and states a broader bound than the
   one now shipping.
2. The guard's failure header reads `SITE(S) NO LONGER MATCH`, which describes an absence, on a
   code path that fires when a site matches **twice**.

**ENVIRONMENTAL FACTS YOU WOULD OTHERWISE MEASURE AS FINDINGS:**

- **`main` is RED today** for reasons unrelated to this diff (`TestListUsers`: a detached
  goroutine on `context.Background()` that nothing can wait for).
- **Five tests flake at roughly 4.5%** per sequential full-suite run. A single-run matrix of ~27
  rows is about 71% likely to contain a spurious RED. **Repeat before you file a red as a
  property.**
- **The real `main` on the remote is `cc927355e5a23c45bfd983cd331eb540b0a61ad5`, twelve commits
  ahead of the `7a0f220` that most trees here call `main`, and it added
  `.github/workflows/ci.yml`.** Your tree's `main` ref is stale. ~~`git ls-remote` is the only
  cheap read in git that cannot be stale.~~
  > **CORRECTED 2026-07-29 07:12Z. THE STRUCK SENTENCE IS FALSE IN THIS TOPOLOGY AND ALL
  > THREE LEGS OF THIS ROUND CAUGHT IT INDEPENDENTLY — one of them PRE-REGISTERED the
  > refutation before measuring.** Your `origin` is **`/workspace/farmtable`**, a local clone
  > pinned at `7a0f220`. So `git ls-remote origin main` returns `7a0f220`, contradicting the
  > `cc92735` two lines above — **with high confidence, while obeying the brief.**
  >
  > **TRUE STATEMENT: `ls-remote` IS ONLY AS FRESH AS THE REMOTE IT NAMES. NAMING A STALE
  > INTERMEDIARY INHERITS ITS STALENESS.** To read the real thing, `ls-remote` the GitHub URL,
  > or resolve the SHA directly.
  >
  > This is the third instance tonight of one error of mine: **evidence gathered at the scope
  > of the instrument, a conclusion written at the scope of the question.** `ls-remote` cannot
  > be stale *about its remote*. I wrote it as a property of `ls-remote`.
- **There is a predicted merge blocker between this branch and real `main`**, unverified: real
  `main` kept a hand-written web test list and added `scripts/ci-suite-manifest.mjs` to check
  it; this branch replaced the hand-list with discovery via `web/scripts/run-tests.mjs`. The
  checker is expected to fail closed on the discovery runner. **Confirming or refuting this is
  in scope for whichever leg finds it natural.**
- `web/scripts/run-tests.mjs` is **not** this round's work. It is `5c65382` and `d92ae5e`
  (dev-xss-r2) and `d12f572` (dev-xss-r4). Verified on the path.

<!-- PHASE TWO CONTENT ENDS -->

