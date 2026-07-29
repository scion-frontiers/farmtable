# test-xss-r2 — test review, url-scheme-validation-r2 @ 0bc9b72

Read `_xss-r2-baseline-block.md` in this directory first, in full. It is your tree, gates and rules.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r2.md`.

## Your axis, and it is the one that has produced the sharpest findings

**Can these tests fail?** Round 1 on this branch found that the headline JSDOM pin declared its own
copy of the render function, so replacing `safeHref(url)` with `url` in *either* production function
shipped green — a check derived from the thing it checks cannot falsify it. `dev-xss-r2` fixed that
and much else across 10 commits, `d4c4e6b..0bc9b72`.

Read `reports/dev-xss-r2.md`. It is unusually forthcoming — it reports its own misses and reverses
its own predictions. **Treat that as a reason to check it, not a reason to trust it.** Its claims
are the highest-value mutation targets on this branch precisely because they are the ones I am most
inclined to believe.

Verdict: APPROVE or REQUEST CHANGES.

## Two rules that are NEW as of today, and both bear directly on this branch

**RULE — a count-pin is not evidence of non-vacuity unless a COUNT-NEUTRAL corruption is also RED.**
Ruled today, retroactively. It came from a measurement on a sibling branch: replacing 8 of a
14-entry list with `.zz1`–`.zz8`, holding length and corpus count fixed, was **GREEN**; the
positive control that *changed* the count went RED with "found 52". So the pin's discriminating
power was exactly 6 of 14 entries and the other 8 were measurably decoration. A count-pin going RED
only tells you it reacts to *something*; it does not tell you it reacts to identity.

This branch has at least one assertion of exactly that shape. `TestSharedFixturesRecordRealDivergences`
is the anti-vacuity control on `web/testdata/url-scheme-cases.json`: it refuses a file with **zero
divergences** (someone "reconciling" the two guards by rewriting a column) and one with **zero
agreements** (a broken measurement), and requires every divergence to carry a written reason.
Measured population: 42 inputs, 33 agree, 9 diverge. **Apply the new bar to it.** Hold the counts
fixed at 33/9 and corrupt identity — swap which inputs are the diverging ones, or rewrite a
divergence's `reason` to a string that does not describe it — and report whether it goes RED.

**FORM — a check can pin DELIVERY without pinning CONSUMPTION.** Named today. A harness can prove a
loop was handed every entry and yielded every entry, and still be unable to observe whether the loop
*body* did anything. The demonstration on a sibling branch: inserting `if (label) continue;` as the
first statement of a loop body left 27 fixtures unexercised and the suite reported GREEN — a
*cheaper* mutation than the one the machinery was built to survive.

`scripts/run-tests.mjs` on this branch is a delivery mechanism. It discovers test files, cross-checks
the emitted tree against sources in both directions, and runs every file. **Does anything observe
that a discovered file's assertions ran?** A file that is discovered, compiled, executed, and
asserts nothing is exit 0 and indistinguishable from a passing one. The leg validated the runner by
dropping a deliberately-*failing* probe file in and seeing it caught — which proves the runner
delivers. It does not prove the runner would notice a silently-empty file.

## Specific mutation targets

The fix leg reports these as RED. Reproduce or refute each; a refutation is the more valuable result.

1. **The four MUST-2 allow-list fixtures** (`ftp://`, `ws://`, `wss://`, `httpx://evil.com/x`). Two
   mutations claimed RED: delete the scheme check; add `javascript:` to `SAFE_SCHEMES`.
2. **`testHostGuardIsAFailClosedBackstop()`.** The leg measured that the hostname check is
   **unreachable by any fixture** — both allow-listed schemes are WHATWG *special* schemes whose
   empty-host forms throw rather than yielding `hostname === ''` — so it pinned the *reachability
   precondition* instead: the loop asserts every entry of `SAFE_SCHEMES` is special, and carries its
   own positive control (`new URL('javascript://')` must parse with `hostname === ''`) without which
   the loop would pass if `new URL` threw for everything. Check both halves.
3. **The MUST-3 JSDOM pin now driving the real `renderPrLink` / `renderExternalSourceLink`.** The
   round-1 defect was a private copy. Verify the imports are real and the pin dies if either
   production function stops calling `safeHref`.
4. **`TestPassthroughReadDropsUnsafeRemoteURL`** — 6 payload classes through a mock GraphQL endpoint,
   a real ent store and a real gRPC server; each subtest carries a positive control (a second
   legitimate issue in the *same* response whose `remote_url` must survive) plus a `remote_id`
   populated check (degrade, not fail) plus an anti-vacuity guard on the table.
5. **`testGuardHoldsForEveryItemInAList`** renders the real `<ft-inspector-code>` with two PRs in
   **both** orderings. Its stated design: poisoned-first catches "the loop bails out after the first
   rejection", poisoned-second catches "only index 0 is guarded", and only one ordering goes red
   under the index-0 mutation — which is why both exist. Plus a positive control that the component
   rendered both list items, without which "exactly one href" is also satisfied by a component that
   dropped everything after the first. Check that all three parts do what they say.
6. **`TestURLBearingRemoteDataKeysCoversConvertReads`** and its positive control (hiding the key
   behind a `const` must make it fail with "it is not checking anything").
7. **The scanner's new rules** — 2 rules, 7 positive and 4 negative fixtures. The negatives exist so
   the new rules cannot over-fire. Can the negatives fail?
8. **`viaSafeHref` binding-scoping and `ALLOWED` uniqueness.** Both claimed RED with specific
   messages. These replaced file-scoped and location-free versions, so they are the round's genuine
   new machinery.

## Things the leg already reported against itself — verify, don't just accept

- **G7** (`strings.ToLower` in the Go validator) **survives and cannot be killed by any fixture**,
  because `net/url` already lowercases the scheme. Reported rather than papered over.
- **Its own miss:** it predicted disabling the control-character pre-check would fail several
  fixtures. It failed **exactly one** (`bare space in path`), which is not a security case, because
  `net/url` independently rejects every control-character scheme-confusion input it could construct.
  It kept the pre-check as instructed but flagged that my brief's claim ("the pre-check is what makes
  the allow-list sound") is **not supported by measurement**. I think it is right and it is charged
  against me; confirm or refute.

## Method

Everything in the shared block, plus: **predict before you measure and report every miss.** Last
round a leg predicted GREEN five times running and was wrong five times, and that run of misses *was*
its best finding — the asymmetry it exposed was invisible to anyone who guessed right. Report your
prediction accuracy as a fraction.

If a mutation looks RED, **check it is not a build failure.** A leg last round counted a mutant as
killed when it was actually an unused-import compile error: "a build failure counted as a kill is a
false positive in exactly the direction that flatters the code under review."

Report the number of mutation cells you left dirty after restore. It is a real number.

## Deliverables

1. Verdict, with findings by severity.
2. A mutation table: cell, prediction, result, hit/miss — and your prediction accuracy as a fraction.
3. Your answer on the two new rules: the count-neutral corruption of the shared fixture file, and
   whether `run-tests.mjs` pins consumption or only delivery.
4. A numbered list of everywhere this brief is wrong (see the shared block — required, and note the
   two failure modes; one is a fixture on *this branch* where I supplied both the input and a wrong
   expected result).

Do not push. Do not modify production code. You MUST write the report file and then mark the task
complete.
