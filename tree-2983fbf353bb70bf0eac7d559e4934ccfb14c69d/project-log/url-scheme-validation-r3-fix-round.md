# URL Scheme Validation — R3 Fix Round

Date: 2026-07-28
Branch: `url-scheme-validation-r2`
Base: `0bc9b72`
Commits: `54c46cc`, `d92ae5e`, `42d62a4`, `457886d`, `b06121f`
Verdict: `FIXED`

Follow-up to `url-scheme-validation-r2-fix-round.md`. Three independent legs
reviewed `d4c4e6b..0bc9b72`: two REQUEST CHANGES, one APPROVE. Zero Critical,
zero High, nothing exploitable. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r3.md`.

## What this round was

Round 1 was "the tests cannot fail." Round 2 was **"the measurements are right
and the sentences written above them are wrong."** Six of the ten findings were
a correct measurement carrying a false claim. That is a defect class worth
naming, because the false claim is the raw material for the next round's real
bug: someone relaxes a control on the strength of a comment that was never true.

Three of the false claims on this branch shared one shape — **the evidence set
was drawn from the assumption the conclusion asserts.**

- The host-guard comment claimed every script-bearing scheme parses with
  `hostname === ''`. Every probe behind it was in the opaque-path spelling. The
  authority spelling, `javascript://evil.com/%0aalert(1)`, parses with hostname
  `evil.com` and **executes** (`//evil.com/` is a JS line comment, `%0a` ends
  it). Not exploitable — `javascript:` is not allow-listed — but the guard was
  credited with a property it does not have.
- The fixture README called the divergence set "pinned and **bounded**." The
  bound was the file itself. 39 further inputs found 10 more divergent shapes.
- `urlBearingRemoteDataKeys` was documented "keep in sync with the RemoteData
  reads in convert.go" — while `convert.go`'s last act was
  `structpb.NewStruct(RemoteData)`, a read of *every* key. **A sync comment
  against an unbounded set is not satisfiable.** The list was out of sync by
  construction, and the second URL carrier (`html_url`) had never been looked at
  by any validator.

The fix for the third was to replace the list with a predicate over key
*segments* plus a sanitising copy, so a new URL-named key is covered without
anyone remembering to add it.

## The rule that earned its keep: count-neutral corruption

A count-pin is not evidence of non-vacuity unless a mutation that **holds the
count exactly fixed and corrupts identity** also goes red. Applied to all 30
mutations this round. It found two defects in fixes written to satisfy the same
brief:

1. **The consumption gate could not see its own instrument.** The new runner
   requires every test file to emit an assertion-count receipt, so a gutted
   `run()` fails. Mutating the harness so `assert` **counts but never throws**
   held the receipt at exactly 200 and shipped green. The gate reads the count,
   so it is structurally blind to this. Closing it needed a separate file that
   checks the harness with a helper that throws directly and is deliberately
   *not* counted — a test that verified the harness *through* the harness would
   hide the mutant inside the instrument.
2. **A new rule matched the negation of what it was checking for.** The fixture
   base-dependence rule used `Contains("base-dependent")`, which the phrase
   *"Not base-dependent"* satisfies. The mutation that moves a marker between
   fixtures survived it. Another test still caught the mutant — which is the
   danger, because a rule that only fires when something else would have caught
   it anyway reads as working.

## A pin that would have been vacuous, and why

`remote_data` is silently `nil` on the entire GitHub passthrough path:
`issueBuildRemoteData` writes `"labels": []string{...}`, `structpb.NewStruct`
rejects `[]string`, and `convert.go` discards the error with `_`. So an
end-to-end "the poisoned URL is absent from `remote_data`" assertion on that path
passes because the *map* is absent — green for the wrong reason, this branch's
signature failure mode.

Pinned rather than fixed (`TestGitHubPassthroughRemoteDataNeverSerialises`): the
`[]string` is a live behavioural bug and repairing it is a visible change that
belongs in its own commit. Whoever fixes it gets a red test telling them what
their fix just un-vacuumed.

## Static scanners: two failure modes, one lesson

`url-binding-scan.test.ts` scans `web/src` for URL bindings not covered by
`safeHref`. Two independent holes:

- **It approved defeated guards.** `safeHref(url) ?? url`, `|| url`,
  `?? "javascript:alert(1)"`, and a *commented-out* guard were all accepted,
  because the check was a prefix match on the initialiser. A scanner that
  green-lights a defeated guard is worse than no scanner.
- **Its scope was the whole class.** A guarded sibling method laundered an
  unguarded binding.

Both fixed (whole-initialiser match with balanced parens, comment/string
blanking, character-offset brace-depth walk in *both* directions). The lesson is
in the failure the round nearly repeated: the scanner and the behavioural JSDOM
test disagreed about the same line of code, and only the behavioural one was
right. **A text scanner is a recall net, not a proof.** Its docblock now carries
a "WHAT IT STILL DOES NOT SEE" paragraph, and its anti-vacuity check asserts how
many files the walk *opened* — the old `findings.length >= ALLOWED.length` was
satisfied by a walk that read only the three files it had already decided were
fine.

## Documentation as a checked artefact

The base-dependence problem was that fixture notes stated hosts as facts.
`safeHref` parses with no base; the sink always resolves against the document
base; under WHATWG an input whose scheme equals the base's is a *relative*
reference. So `http:/example.com` is host `example.com` to `safeHref` and the
dashboard's own host in the browser. No scheme escalation — the base is always
http(s) — but anyone reasoning about open-redirect risk from a note reasons from
the wrong host.

Rather than fix the prose, the six affected fixtures are marked
`"base_dependent": true` and **the marker is measured**: a test resolves every
input at an http and an https base through a real JSDOM anchor and fails in both
directions. Likewise the divergence notes: instead of `Note != ""`, the rules are
derived from each case's own columns — the direction the note states must match
the columns, both implementations must be named, notes must be unique. Rewriting
all nine to "Bananas." was green before and is red now; swapping two notes
between opposite-direction cases is red with the count and every text unchanged.

## Gates at `b06121f`

`go build ./...` 0 · `go vet ./...` 1 (4 pre-existing `copies lock value`) ·
`go test ./...` **0** · `npm run build` 0 · `npm test` 0
(`PASS: 4 test file(s), 315 assertions.`)

The relayed `go test` = 1 (a `TestWatchTasks` flake) did not reproduce in this
session, across the full suite three times and `-count=5` on the named tests.

## Carried forward, not started

Review R3 (`web/tsconfig.json` `"types"` — the counterfactual is already
measured: reverting it alone does not restore the error, because `@types/jsdom`
carries its own node reference). The scanner's long tail: CSS `url()`,
`unsafeStatic` attribute names. The decode-boundary branded type (audit R-1) —
a design task; note that `tsc` does **not** type-check tagged-template
interpolations against the attribute they land in, so a branded type at a lit
`href=${…}` binding buys nothing on its own. `web/dist` build ordering is #100.
And the `[]string` in `issueBuildRemoteData`, newly filed above.
