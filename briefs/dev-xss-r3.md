# dev-xss-r3 — fix round 3, url-scheme-validation-r2

Branch `url-scheme-validation-r2`, base `d4c4e6b`, current head `0bc9b72`.

Do not take a filesystem path from this brief. Confirm your tree with
`git rev-parse --show-toplevel` and `git rev-parse HEAD`; HEAD must be
`0bc9b721475dfe2fb24c5eba1034a071b842c45c`. If it is not, stop and say so.

Three independent legs reviewed `d4c4e6b..0bc9b72`. Read all three before you
touch anything:

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r2.md` — REQUEST CHANGES
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r2.md` — REQUEST CHANGES
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r2.md` — **APPROVE**

Read the audit's approval carefully rather than discounting it. It is the
exploitability verdict and it is the reason this round is not an emergency:
**zero Critical, zero High, nothing exploitable today, and the branch is a
strict security improvement over its base.** Three legs independently
reproduced the fix leg's measurements and found them accurate — the audit
reproduced all 42 fixture rows exactly, both columns, zero mismatches.

## What this round actually is, and it is different from round 2

Round 1 on this branch was "the tests cannot fail." Round 2 is not that. Round
2 is: **the measurements are right and the sentences written above them are
wrong.** Of the ten findings across the three reports, six are a true
measurement with a false claim sitting on top of it. The audit put it exactly:

> Every disagreement I have is with an inference sitting on top of a correct
> measurement — never with a measurement.

That is the defect class you are fixing. Treat a false comment as a defect of
the same seriousness as a false branch, because in this codebase it is the raw
material for the next round's real one. Two of the three legs independently
identified a comment as the load-bearing problem.

**Corollary you should hold onto:** three separate false claims on this branch
arose because the evidence set was drawn from the assumption the conclusion
asserts. The test leg diagnosed it for the host backstop ("the sample was
selected by the same assumption the conclusion asserts"); the audit found the
same shape in the fixture README's word "bounded." When you write a claim, ask
what evidence would have falsified it and whether that evidence was in the set
you looked at.

## Deliverable 1 — confirm or refute, BEFORE you fix anything

Audit F-3 is the only finding in this round that **one leg found and the other
two did not look at**. It is also the one I am most inclined to act on, which
is exactly why it gets checked first. Reproduce both halves, with your own
controls, and report the measurement before you write a fix:

**(a)** That `web/src/util/url-binding-scan.test.ts:322-330` accepts a defeated
guard. Audit measured all of these as ACCEPTED-as-guarded:

```
ACCEPTED  const href = safeHref(url);                            <- correct
ACCEPTED  const href = safeHref(url) ?? url;                     <- guard defeated
ACCEPTED  const href = safeHref(url) || url;                     <- guard defeated
ACCEPTED  const href = safeHref(url) ?? "javascript:alert(1)";   <- guard inverted
ACCEPTED  // const href = safeHref(url);                         <- commented out
rejected  const href = url;
```

**(b)** That `enclosingBlock` (`:170-187`) scopes to the enclosing **top-level**
block, which for a Lit component is the whole class, so a guarded sibling
method launders an unguarded binding:

```ts
class FtThing extends LitElement {
  renderGuarded() { const href = safeHref(this.a); return html`<a href=${href}>`; }
  renderBare()    { const href = this.b;           return html`<a href=${href}>`; }   // audit measured: PASSES
}
```

If either refutes, say so plainly and stop before fixing that item — a
refutation is the more valuable result and I would rather hear it than have
three items built on top of a finding that does not hold.

## Blocking — all of these before merge

**B1. `remote_data` still ships the URL that was just rejected.**
`internal/server/convert.go:341`. Found independently by review (R1, Required)
and audit (F-1, MEDIUM). The typed field is dropped, then
`pt.RemoteData, _ = structpb.NewStruct(t.RemoteData)` serialises the whole map
including the `remote_url` key.

The audit's version is strictly larger than the review's and you should fix the
audit's: there is a **second carrier**. The same GitHub adapter writes the
identical URL under `html_url` (`graphql_queries.go:482`, and `github.go:261`
in the non-passthrough adapter), which no validator has ever looked at, and
which is the more natural key for someone adding a "view on GitHub" link.

Note the structural point, because it is the interesting part:
`urlBearingRemoteDataKeys` (`urlvalidate.go:91`) is documented "Keep this in
sync with the RemoteData reads in convert.go" — but line 341 *is* a read of
every key, so **the list is out of sync by construction.** A sync comment
against an unbounded set is not satisfiable. Fix the mechanism, not the list.

Three statements in the diff are false because of this and must be corrected:
`passthrough_url_test.go:265-268`, `internal/platform/github/testing.go:39-41`,
`convert.go:334-336`.

Audit's suggested remedy (scrub the map copy, cover both keys, drop rather than
error) is in its §F-1. No test currently asserts anything about
`GetRemoteData()` on this path — it needs a pin, and per the count-neutral rule
below the pin must react to *identity*, not just to a count.

**B2. `run-tests.mjs` — two distinct defects, found by two legs with two
different mutations.** This is the only thing standing between a test file and
never running, so it is infrastructure and it is blocking.

- *Review R2:* `web/scripts/run-tests.mjs:89-90` and `web/tsconfig.test.json:7`
  both filter on the literal `.test.ts`. A `.spec.ts` file that calls
  `process.exit(9)` never runs; `npm test` prints `PASS: 3 test file(s)` and
  exits 0.
- *Test H2:* the runner pins **delivery, never consumption.** Gutting `run()` in
  `safe-url.test.ts` yields `PASS: 3 test file(s).`, exit 0. The test leg noted
  this is materially worse here than in general, because
  `src/utils/task-ready.test.ts` already prints nothing on success — so a gutted
  file is **visually indistinguishable in CI logs.**

The audit credits this file as "better than what it replaced" (F-8). That is
true and is not a contradiction: I fenced the audit out of mutation work, so
its credit is not corroboration of correctness. Do not read it as one.

For the naming half, prefer the chokepoint over the checklist: rather than
adding `.spec.ts` to the accept-list, have the runner scan a **broad**
test-shaped glob and **fail loudly** if it finds a file the narrow discovery
glob did not pick up. That makes the bad state unrepresentable instead of
enumerated, and it resolves the naming question for whatever convention lands
next. (Relevant: this file is the centre of the known merge collision, task
#103. Do not go look at the other branch. Just make the runner correct for an
arbitrary `src/**/*.test.ts` **and** loud about anything test-shaped it skips.)

For the consumption half — this is the genuinely hard one and I do not have a
preferred design. The property you need is that a discovered file which
executes but asserts nothing cannot be green. Report the option you chose and
what it costs.

**B3. `viaSafeHref` — pending deliverable 1.** Both fail-opens. A scanner that
green-lights `safeHref(url) ?? url` is worse than no scanner, because it
converts a defeated guard into a passing check. Audit supplied concrete
remedies for both halves in its §F-3; the scoping one (walk back accumulating
brace depth, stop at depth -1) is the right shape. Correct the comment too: the
diff says "scoped to the binding" and the code is not.

**B4. Scanner recall — the shapes that are not hypothetical.** Audit F-2,
test M2. The full set is open and a checklist over it will always be
incomplete; I am not asking you to close it. Three specific things:

- `Object.assign(el, {href: x})` is **already house style in this tree** —
  `ft-dependency-view.ts:1378`, `ft-toolbar.ts:701`, `ft-app.ts:766`. The audit
  predicted this would be hypothetical and measured that it is not; that miss
  is what moved F-2 to MEDIUM. Add the rule.
- Add the high-value attribute and imperative-navigation rules. Audit wrote the
  regexes in its §F-2 recommendation 1 (`srcdoc`, `formaction`, `action`,
  `ping`, `srcset`, `poster`, `data`; `window.open` / `location.assign` /
  `location.replace`). `srcdoc` is strictly worse than an `href` — it is full
  HTML injection.
- Ban `setAttribute` with a **non-literal** first argument outright. That shape
  is unanalysable by text, so detection is the wrong tool.

**B5. The scanner's anti-vacuity assertion is a count-pin that cannot detect
its own failure.** `findings.length >= ALLOWED.length` is satisfied by 4
findings for 4 allow-list entries, so it cannot notice a walk that only reached
the two inspector files. Audit F-2 recommendation 3. Assert the file count
instead.

This is an instance of a rule adopted today, and it applies to every new pin
you write in this round: **a count-pin is not evidence of non-vacuity unless a
COUNT-NEUTRAL corruption is also RED.** Holding a count fixed and corrupting
identity must go red. The test leg already applied it to
`TestSharedFixturesRecordRealDivergences` and found it wanting — see B6.

**B6. The false comments and the fixture notes.** Text changes, but blocking,
because on this branch a confidently wrong comment is the next round's defect.

- *Host backstop* (`safe-url.ts:89-111`) — test H1 and audit F-6, found
  independently, same payload. The comment claims every script-bearing scheme
  parses with `hostname === ''` so the line fails closed. **False for all five
  named schemes** in their authority-bearing spelling:
  `javascript://evil.com/%0aalert(1)` parses with hostname `evil.com`, and JSDOM
  confirms a real anchor reports `protocol === 'javascript:'` for it.

  The two legs split on severity and the audit's LOW is the better-informed
  call, because the audit measured one thing the test leg did not: the widening
  tripwire `testHostGuardIsAFailClosedBackstop()` **does** go red for any
  non-special scheme added to `SAFE_SCHEMES`. So the control works; only the
  stated reason for it is wrong. Fix the comment to say what actually makes
  widening fail closed, and add `javascript://evil.com/%0aalert(1)` as an
  explicit fixture so the authority-bearing spelling is pinned. Audit §F-6 has
  the replacement text.

- *Base-dependence* (`safe-url.ts:52-63`, and the fixture notes) — audit F-4.
  `safeHref` parses with no base; the sink always resolves against the document
  base. For four of the nine divergences the host differs, and on an **http**
  dashboard `http:/example.com` resolves to the dashboard's own origin, not to
  `example.com`. The code is sound — the base is always http(s), so a
  base-relative resolution can never escalate the scheme — but
  `testdata/url-scheme-cases.json` states those hosts as facts. Correct the
  notes, mark the four base-dependent fixtures, and add the sentence from audit
  §F-4 saying what the no-base parse does and does not guarantee.

- *"Bounded"* — audit F-5. The fixture README says the divergence set is
  "pinned and bounded." The audit ran 39 further inputs and found **10 more
  divergent shapes** outside the fixture set. All ten are inert, which is a
  good result for the security claim, but "bounded" is false. Change it to
  pinned-and-sampled and say the set is not closed.

- *Divergence reasons* — test M1. `TestSharedFixturesRecordRealDivergences`
  only checks `Note != ""`; rewriting all nine notes to "Bananas..." stays
  GREEN. Strengthen it so a note that does not describe its divergence fails.

## Not blocking — do not fix these, they are tracked

- **Review R3** — `web/tsconfig.json:18` `"types": ["vite/client", "node"]`
  lets `process.env` / `Buffer` / `__dirname` in a browser source file pass both
  `tsc --noEmit` and `vite build` at exit 0. Real, and a consequence of
  deviation 4, which review overturned. Leave it. Review already measured the
  counterfactual — reverting `"types"` alone does **not** restore the error,
  because `@types/jsdom` carries its own `/// <reference types="node" />` — so
  the fix is not one line and it does not belong in a security round. Recorded
  so the next person does not re-derive it.
- **The scanner's long tail** beyond B4 — CSS `url()`, `unsafeStatic` attribute
  names, `<object data>`, `<img srcset>`. Tracked.
- **The decode-boundary branded type** (audit R-1). This is the best
  forward-looking idea in the round and it is explicitly out of the audit's
  lane. It is a design task, not this round's. Do not start it. Two measured
  facts from it are worth knowing while you work: `gen/grpc-client.ts` has a
  single decode chokepoint (`toTask`, 4 call sites, watch stream included), and
  **`tsc` does not type-check tagged-template interpolations against the
  attribute they land in** — so a branded type applied at a lit `href=${…}`
  binding compiles happily with a plain `string` and buys nothing.

## Two corrections to my earlier briefs, charged against me

1. The shared fixture file is at **`testdata/url-scheme-cases.json`, repo
   root** — not `web/testdata/`, which does not exist. Two legs hit this.
2. My brief stated the `go test ./...` flake as `TestWatchTasks_NoInitial`. The
   audit measured `TestWatchTasks_ClosedEvent`. Same family, different member;
   treat the failing-test *name* as the thing to match, never the count.

## Method

Everything in `_xss-r2-baseline-block.md` still applies — read it. Beyond it:

- **Predict before you measure, and report every miss.** Across this round's
  three legs the misses were consistently more informative than the hits. The
  audit's four misses produced two of its findings; the test leg went 28/28 and
  flagged its own perfect run as *weak* evidence, correctly, because its two
  real findings came from exploration rather than prediction.
- **Every zero needs a positive control.** The audit's first Go gate run
  returned `go build ./...` **exit 0** with `matched no packages`, because it
  was issued from inside `web/`. Exit 0 on a build that compiled nothing. It
  caught this and discarded the run. That is now the fourth instance in this
  workstream of a zero that meant "the command did not run."
- If a mutation looks RED, check it is not a build failure. A build failure
  counted as a kill is a false positive in the direction that flatters the code.
- Commit in logical increments. If the scope balloons past what one branch
  should carry, stop and say so rather than pushing through.

## Deliverables

1. Deliverable 1's confirm-or-refute on audit F-3(a) and F-3(b), with controls,
   **reported before any fix for B3.**
2. B1–B6 fixed, committed locally in logical increments.
3. Your design choice for B2's consumption half and what it costs.
4. A mutation table for every new or strengthened pin, including the
   count-neutral corruption for each — count held fixed, identity corrupted,
   result. A pin that only reacts to counts does not land.
5. A numbered list of everywhere this brief is wrong. Required. Two of the three
   legs found errors in my briefs that changed what they measured; assume there
   are more here.
6. A project log entry at `.design/project-log/`.

Do not push. Commit locally only.

You MUST write the project log entry and commit your work, and then mark the
task complete.
