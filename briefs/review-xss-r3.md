# review-xss-r3 — code review, `url-scheme-validation-r2` @ `6805daa`

Read `_xss-r3-baseline-block.md` in this directory **first, in full**, and do its
§0 open pass before you read the item list below.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r3.md`.

Verdict: **APPROVE** or **REQUEST CHANGES** on the diff `0bc9b72..6805daa`. If you
approve the diff while holding an open concern that is out of the diff's scope,
say both, clearly and separately.

## Your axis

Correctness, architecture, readability, and whether the code says true things
about itself. Mutation work is the test leg's axis; threat modelling and
exploitability are the audit leg's. Anything outside your lane: label it an
impression, not a finding — and still say it.

## Standing rule on this project

**Treat a confidently wrong comment as a defect, not a nit.** Six of ten findings
in a recent round on this branch were a false sentence sitting on top of a
correct measurement. The prevailing view here — which I share — is that in this
codebase a wrong comment is the raw material for the next round's real defect,
and comment text gets corrected *before* merge. Commit `b06121f` is entirely
this kind of work; hold it to that standard, including the new sentences it
writes.

---

## The items

Each is a **question**, not a finding. Several may have the answer "no problem,
and here is the measurement." Report those at equal weight.

### R1 — `sanitizeRemoteData`: is a word set a property?

`54c46cc` replaced `urlBearingRemoteDataKeys = []string{"remote_url"}` with a
predicate over the key's segments, matching a small word set
(`url`, `uri`, `href`, `link`, `permalink`, plurals) with an all-caps fallback
and a documented fail-closed false positive on `CURL`.

The fix leg describes this as *"fixed the mechanism, not the list."* **A word set
is a list.** So:

- Read the predicate and characterise exactly what it does and does not match.
  Do not take my summary of it; I have not read the code.
- The project has repeatedly been bitten by enumerate-where-a-property-was-needed.
  Is the right invariant *"the key names a URL"* or *"the value is a URL"*? These
  are different guards with different failure modes. Say which one is
  implemented, which one the surrounding code needs, and whether they coincide.
- **Does `sanitizeRemoteData` recurse?** The fix leg's own mutation table has a
  row about "top-level and nested buckets," which implies nesting exists on this
  data. If a nested map can carry a URL-bearing key, a non-recursive scrub
  misses it. I have **not** measured whether nesting is reachable — establish
  that first, then judge.
- What happens to a URL-bearing key whose value is not a string? The leg says
  dropped. Is *dropped* right, or is *dropped silently* the problem?

### R2 — the fix leg's own new finding, and what it does to the premise

The leg reports, in none of the three r2 reports:

> `remote_data` is silently `nil` on the entire GitHub passthrough path.
> `issueBuildRemoteData` writes `"labels": []string{...}`; `structpb.NewStruct`
> rejects `[]string`; and `convert.go` discards the error with `_`. So the whole
> map vanishes.

**Confirm or refute this, independently, before you use it.** Then the question
that actually matters:

- If it holds, **what was the original `html_url` carrier reachable through?**
  Is `54c46cc` closing a live leak, a latent one, or a leak on a different path
  entirely? The answer changes how the whole commit should be read, and I do not
  know it.
- The leg pinned the `nil` rather than fixing the `[]string`, on the grounds that
  fixing it is a visible behaviour change that belongs in its own commit. **Is
  that the right call?** Argue it either way, but argue it — a security round
  that leaves a data-loss bug in place with a test asserting the loss is a
  defensible choice and also an odd artefact to merge.
- `convert.go` discards an error with `_`. **Is that the only place?** Enumerate
  the discarded errors on the conversion path rather than grepping for the one
  you were told about.

### R3 — the assertion receipt: can the gate be satisfied without being obeyed?

`d92ae5e` adds `web/src/util/assertions.ts`, which counts evaluations and writes
`#assertions <n>` to fd 1 on exit. The runner fails a file that emits no receipt,
a file whose receipt is zero, and a suite whose total is zero.

- The receipt travels on **fd 1, interleaved with ordinary test output**. Can a
  test file emit a convincing receipt without importing the harness — a
  `console.log`, a stray string in a fixture, a payload in the scanner's own test
  data? If yes, how bad is that, given the gate's purpose is to catch a
  contributor gutting a test rather than an attacker?
- The runner reads the child's `status` from `spawnSync`. What happens if a test
  file throws *after* emitting a nonzero receipt? Before? What if it never
  reaches its exit handler — segfault, `process.exit()` inside a test, an
  unhandled rejection?
- The leg notes it lost an hour to `console.log` being dropped from an exit
  handler because `process.stdout` is async on a pipe, and switched to
  `fs.writeSync(1, …)`. Is `writeSync` on fd 1 reliable in **every** exit path
  the runner can produce, or only the one that was failing?
- The leg pinned `tsconfig.test.json`'s `include` to exactly
  `["src/**/*.test.ts"]` so the compiler and the runner cannot drift apart. Read
  that pin. Does it actually catch drift, or does it catch only the spelling of
  drift that was tried?

### R4 — `blankNonCode` and brace-depth scoping in a Lit codebase

`42d62a4` blanks `//` and `/* */` comment bodies and single/double-quoted string
bodies, preserving length and line count, then walks brace depth backwards to
the innermost opening `{` and forwards to its match.

- **Does `blankNonCode` handle template literals?** This is a Lit codebase.
  `` html`<a href=${x}>` `` is the dominant idiom, and template literals contain
  both `${` … `}` and arbitrary `{` inside string content. If template literals
  are not blanked, the brace walk is being fed brace characters that are not
  code structure. I have **not** read the function — establish what it does
  before judging whether it matters.
- Regex literals, division-vs-regex ambiguity, nested template literals,
  escaped quotes, template literals inside comments and vice versa. Which of
  these can the blanker get wrong, and does any of them produce a **false
  ACCEPT** (the dangerous direction) rather than a false reject?
- The leg's brief-error #4 says a backward walk alone yields a block running to
  EOF, so the laundering comes back through a *later* sibling — and it measured
  that. Verify the forward walk closes it, and then ask the next question: **is
  brace depth the right scope at all?** A guard and a bare binding in the same
  method still launder each other under any block-level scope.

### R5 — `MIN_FILES = 40`

`457886d` replaced `findings.length >= ALLOWED.length` with a file-count floor of
40 (52 measured) plus three named witness paths.

- 40 against 52 is a 23% margin. Is that a floor that will rot — either firing
  spuriously after a refactor, or sliding quietly as files are added so that a
  future 60-file tree with a 20-file walk still passes?
- The witness paths are the stronger half. Are three enough, and are those three
  the right three — do they cover the directories where a walk is most likely to
  silently stop?
- Is there a formulation that is not a magic number? Say so if there is; say so
  if there isn't and 40-plus-witnesses is the right pragmatic answer.

### R6 — the divergence-note rules

`b06121f` replaced `Note != ""` with rules derived from each case's own columns
and marker: stated direction must match the columns, both implementations named,
notes unique across cases, `base_dependent` reflected both ways, minimum length.

- The leg reports that its **first** version of the base-dependence rule used
  `strings.Contains(lower, "base-dependent")` and matched a note reading *"Not
  base-dependent."* It caught this only because a mutant survived on the Go side
  while the client-side test killed it — *"a rule that only fires when another
  test would have caught it anyway is not a rule."* **Read the corrected
  `noteDeclaresBaseDependence` and look for the same class of error elsewhere in
  the rule set.** Substring matching on prose is the mechanism; it may appear
  more than once.
- The rules have a control test with one positive case and eight negatives. Is
  the positive case load-bearing, or would the control pass with the rules
  disabled?
- **Minimum length** as a note-quality rule: does it measure anything, or is it a
  proxy that a bad note satisfies trivially?

### R7 — is the fix complete for what it confirmed?

The leg confirmed both halves of the reported scanner defect and fixed three
things where my brief named one. Independently: **is there a third fail-open
shape?** The two known ones are a defeated guard on the right-hand side
(`safeHref(url) ?? url`) and a laundering sibling. Assume there is a third and
go looking; report honestly if there isn't.

---

## Deliverables

1. §0 open pass, written first.
2. Findings, each attributed **OPEN PASS / ITEM LIST / BOTH**, with severity and
   file:line resolved against your own tree.
3. An explicit verdict on each of R1–R7, **including where you agree, stated at
   equal weight.**
4. Your independent answer on R2's premise — is `remote_data` always nil on the
   passthrough path, and what does that do to the commit's rationale?
5. A numbered list of everywhere this brief is wrong (§5 of the baseline block).
6. Overall APPROVE / REQUEST CHANGES on the diff.
7. Dirty cells at the end, and the `git status --porcelain` output proving it.

Do not push. Do not modify production code. You MUST write the report file and
then mark the task complete.
