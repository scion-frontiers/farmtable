# Addendum — `ci-suite-manifest.mjs` builds its population with a subtractable git instrument

**Leg:** read-ci-population (investigator) · **Date:** 2026-07-29
**Parent:** `reports/ci-population.md` · **Class:** `briefs/_BRIEF-RULES.md` §31
**Status:** READ-ONLY. Nothing implemented. `ci-suite-manifest.mjs` was not touched.
**Occasion:** the 09:01:15Z `info/exclude` edit by `farmtable-relocate-offhost`, which is a
declared instrument contamination and **not** the finding. The finding is what it exposed.

## 1. The mechanism, in one sentence

`scripts/ci-suite-manifest.mjs` — the shipped CI step whose entire purpose is to detect a test
file that exists but runs nowhere — builds its "files that exist" population with
`git ls-files --others --exclude-standard`, and that flag makes the population subtractable by
`.git/info/exclude`, an **uncommitted, host-local, unreviewable** file.

## 2. Command and output, pasted

The instrument, verbatim from `cc927355e5a23c45bfd983cd331eb540b0a61ad5:scripts/ci-suite-manifest.mjs`:

```
37	  const untracked = execFileSync(
38	    'git',
39	    ['ls-files', '--others', '--exclude-standard', pathspec],
40	    { encoding: 'utf8' },
41	  );
```

Subtractability demonstrated live, ROOT `/workspace/farmtable-passthrough-write-p1` (a **linked
worktree**: `git rev-parse --git-common-dir` → `/workspace/farmtable/.git`), against the file the
09:01:15Z edit newly excluded:

```
=== A: --others (no exclude logic) ===
8:test-writethrough.db
grep exit=0

=== B: --others --exclude-standard (what the CI checker uses) ===
grep exit=1

=== C: filesystem walk, same question ===
/workspace/farmtable-passthrough-write-p1/test-writethrough.db
find exit=0
```

A sees the file. **B does not.** C does. One line in an untracked file moved a real path out of a
git-built population and left a filesystem-built population unchanged — §31 exactly.

**Bound, stated with the finding:** this was demonstrated on `test-writethrough.db`, not on a test
file. I did not create a test file to prove it, because that would mean writing into a git tree.
The extrapolation to a `*.test.ts` rests on *identity of instrument* — the same flag, the same
repo-level exclude, and a pattern space that can name any path — not on a second experiment.

## 3. What is mitigating it TODAY — configuration, not design

Both mitigations are properties of today's configuration and neither is a property of the
mechanism. Both will read as "already checked, already fine" to whoever looks next.

- **The pattern is anchored and is a `.db`.** `/test-writethrough.db` cannot match the checker's
  `\.(test|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$`. A different line tomorrow can.
- **CI is a fresh checkout.** `actions/checkout@v4` on ephemeral `ubuntu-latest` produces a
  default `info/exclude` (comments only), so the hosted gate sees no host-local exclusions. This
  holds only while the runner is GitHub-hosted and ephemeral; a self-hosted or workspace-caching
  runner would end that silently.

**Polarity, and it is the same one that bit us elsewhere tonight:** the local run is the
reassuring one and the CI run is the true one. A developer who runs `make suite-manifest` before
pushing gets the answer that cannot see the problem.

## 4. WHERE I DISAGREE WITH THE EM'S FRAMING — the severity is narrower than "first shipped CI gate in the class"

The class membership is real and I agree it should be filed. **But the exploitable consequence is
much smaller than that phrasing implies, and filing it at full strength would itself be a
suppressive artefact.**

`candidateFiles()` is a **union of two halves**, and only one is subtractable:

- `git ls-files <pathspec>` — **tracked** files. Honours no ignore or exclude rule whatsoever. A
  committed test file can never be subtracted from the population by any exclude mechanism.
- `git ls-files --others --exclude-standard <pathspec>` — **untracked-and-not-ignored** files.
  Subtractable, as demonstrated.

So the subtractable half is exactly *"test files that exist on disk but have never been
committed."* The script's own comment already states that in CI that set is **always empty**.
Therefore:

- **The hosted gate cannot be blinded to anything in the repository.** Its effective population is
  the tracked set, which is not subtractable. My earlier phrasing "an exclude pattern matching a
  test file would silently shrink what that checker believes exists" is true *only of a local run*.
- The realistic failure is confined: a developer writes a new test file, a host-local exclude hides
  it, `make suite-manifest` locally prints `OK: every tracked JS/TS test file is executed`, and the
  developer is falsely reassured. On commit the file becomes tracked and CI sees it correctly —
  **CI is the backstop and the backstop works.**
- The residual case is nastier but self-limiting: if the file stays excluded it also cannot be
  committed (`git add` on an excluded path fails without `-f`), so it never enters the repository
  at all. Then no gate can see it — but neither can it ship, and nothing regressed.

One adjacent path is worth naming because it *is* CI-visible: `--exclude-standard` also honours
`.gitignore`, which **is** committed and **is** present in the fresh CI checkout. A `.gitignore`
entry is reviewable, so it is not the §31 shape — but it reaches CI, whereas `info/exclude` does
not. If anyone extends §31 to this checker, `.gitignore` is the arm that actually touches the
hosted gate.

**Net:** a guard that is safe by construction on its tracked half and safe by configuration on its
untracked half, where the untracked half is empty in the only environment that gates anything.
Worth fixing for hygiene and to remove the local/CI divergence. Not worth an urgent patch, and not
evidence that the shipped gate is currently blind.

## 5. Recommended fix — NOT implemented, and not mine to make

Make the population instrument unsubtractable by enumerating from the filesystem rather than from
git: replace the body of `candidateFiles(pathspec)` so the untracked half comes from a recursive
`readdirSync` walk of `web/` (skipping `node_modules/` and `dist/`) instead of
`git ls-files --others --exclude-standard`, keeping `git ls-files` for the tracked half.

A ready pattern already exists in this codebase: `walk()` in
`web/scripts/run-tests.mjs` at `c108acb` does exactly this recursive walk. Reusing it would also
converge the two branches' approaches, which §3/G5 of the parent report flags as a pending merge
collision.

**Routing:** this belongs to a leg working on **real main `cc92735`**, where the file lives. I am
not on real main, I hold no build token, and I have not modified `ci-suite-manifest.mjs` or any
other file in any git tree. Whoever takes it should re-run §2's A/B/C triple afterwards as the
verification, and should note that the fix changes local behaviour only — CI output will be
identical before and after, which is itself a reason the fix could be mistaken for a no-op.
