# URL Scheme Validation — Independent Test-Engineering Review

Date: 2026-07-28
Branch: `url-scheme-validation`
Base: `7a0f220dbd9332cb8db62138c841777432b4eda4`
Commits reviewed: `4187910`, `80cab87`, `f0ab53f`, `d4c4e6b`
Verdict: `REQUEST CHANGES`

## Scope

Test-engineering leg of a three-way independent review of the stored-XSS URL
scheme fix. The axis of this review is **whether the added tests can fail**, not
whether they pass. The implementation itself was audited only insofar as
mutating it reveals what the tests do and do not pin.

Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-xss-r1.md`.

## Method

68 mutation cells (24 Go, 39 web, 5 loop-emptying census) plus a 33-input
Go↔TypeScript differential probe. Each cell: snapshot the affected files to
`/tmp`, apply an exact-string mutation through a harness that aborts if its
anchor text does not appear the predicted number of times, run the suite as a
child process (exit code read directly, never through a pipe), restore from the
snapshot, assert `git status --porcelain` is empty. All 68 cells reported a
clean tree after restore.

Reverts were done by snapshot restore, never by `git checkout`, so the result
does not depend on whether a file was committed at the time.

Flake control: the `TestWatchTasks` family (~8% failure rate per sequential
full-suite run; it fired on 1 of 3 unrestricted runs here,
`TestWatchTasks_NoInitial`, `watch_test.go:118: timed out waiting for event`)
cannot appear in the mutation matrix. Every Go cell runs a `-run` regex that
selects only the five URL-validation test functions; the baseline `-v` output
was checked to contain zero `TestWatchTasks` lines, and the runner carries a
tripwire that prints a warning if one ever appears. It never did. Every RED cell
was read by failing test **name**, never by a count of `FAIL` lines.

## Findings

Three defects are blocking. None is a hole in the fix; all three are holes in
the evidence that the fix will still be in place next month.

- **F1 (Critical).** The frontend test suite cannot run from a clean checkout.
  `jsdom`, `@types/jsdom` and `@types/node` are required by the new tests and
  appear in neither `web/package.json` nor `web/package-lock.json`; they are
  extraneous in `node_modules`. `make web` runs `npm ci`, which prunes them.
  Measured in isolation: jsdom missing → exit 1 at runtime; `@types/node`
  missing → exit 2 (7 TS errors); `@types/jsdom` missing → exit 2 (8 TS errors,
  because `@types/jsdom` is what pulls `@types/node` into the program under
  `"types": ["vite/client"]`). The reported green `npm test` is produced by
  state that is not under version control.

- **F2 (Critical).** `safeHref`'s scheme allow-list is pinned by nothing.
  It can be deleted outright, or widened to include `javascript:`, `data:` and
  `vbscript:`, with the whole suite green. Of the 21 rejection fixtures, 5 never
  reach either guard (the URL parse throws) and the other 16 are rejected
  independently by *both* the allow-list and the `hostname === ''` check —
  every script-bearing scheme is a non-special scheme, so it parses with an
  empty host. **0 of 21 fixtures isolate the allow-list.** Three rows
  (`ftp://`, `ws://`, `wss://` — special schemes that parse with a host) close
  the gap.

- **F3 (High).** No test exercises the real render path. `renderPrLink` and
  `renderExternalSourceLink` can each be edited to bypass `safeHref()` entirely
  with the suite green, because the JSDOM test asserts against `renderGuarded`,
  a copy of the render shape declared inside the test file. The copy has a
  correct positive control; it is controlling the copy.

Lower severity: the scanner's `viaSafeHref` claim is file-scoped, so an
allow-list entry can rubber-stamp a genuinely unguarded binding (demonstrated);
the scanner does not detect `setAttribute('href', …)`, multi-line bindings,
`location.assign`, `.js` files or `srcset`; the Go and TS allow-lists disagree
on 8 of 33 corpus inputs with no test comparing them, three of those in the
"server stores it, client refuses to link it" direction; and the Go
control-character, case-folding and prefix-vs-membership branches are each
fully shadowed by `net/url` for every fixture in the table.

## Results in the change's favour

- **All three ingress paths are individually pinned.** Unwiring each call site
  separately (`server.go:641`, `server.go:663`, `export_import.go:722`) produces
  a distinct, correctly-scoped RED. Both halves of the import guard are pinned
  separately, including the `urlBearingRemoteDataKeys` constant most likely to
  drift out of sync.

- **The happy-path tests are load-bearing, not decorative.** Eleven
  over-strictness mutations, eleven kills, no survivors. Four of them are killed
  by exactly one accept-table row each — the tables are thin, but no row in them
  is dead.

- **The tree-wide binding scanner has a genuine self-test.** Emptying its
  detector, its rule list, or its file walk all go RED with accurate named
  messages. Recorded here because a green control would have been a finding and
  this one is not: it is the strongest piece of engineering in the change. Its
  weakness is recall, not vacuity.

- **The Go rejection table has three independent oracles**, not one: the
  non-nil-error check, the `codes.InvalidArgument` check and the "message names
  the field" check were each isolated by a separate mutant.

## Reliability of the prior report

All five of the author's RED/GREEN experiments were re-measured from the
committed tree. Four reproduce exactly, one down to the reported line number.
The self-reported `git checkout` accident did not silently corrupt any
conclusion. Two qualifications:

1. The "24 failing tests" figure is stale. At `d4c4e6b` the neutralising mutant
   produces 26 distinct test identities (24 subtests + 2 standalone RPC tests,
   4 top-level parents, 28 `--- FAIL` lines). The two omitted items are the
   `ImportCollection` subtests, consistent with the measurement having been
   taken before commit `80cab87` added the import guard.

2. The side observation that "`safe-url` still passed, so the scanner is what
   catches this class" holds only for the exact regression shape tested. A
   neighbouring shape makes `safe-url` fail first (and, because `npm test` is
   `&&`-chained, the scanner never runs); a third shape is caught by nothing.

Methodology hazard worth recording for future work: `web/.tmp-test/` is a
persistent build directory that `npm test` overwrites but never cleans, so a
failed `tsc` leaves the previous build in place. An early differential run here
read a stale `safe-url.js` from a prior mutant and produced plausible-looking
but wrong results. Suggest prefixing the `test` script with `rm -rf .tmp-test`.

## Prediction accuracy

Predictions were recorded before each cell ran. Direction (GREEN vs RED) was
correct on 64 of 65 conclusive cells; 3 cells were inconclusive because the
mutation broke TypeScript's null-narrowing rather than an assertion, and were
superseded by equivalent cells. The killer set was mispredicted on 4 of 41 RED
cells — in each the mutant died, but a different assertion did the killing than
expected, which is how the assertion-ordering and redundancy facts above were
found.

The single direction miss (predicting that a `mailto:` fixture pinned the client
allow-list, when it does not) is what led to F2, the most serious finding in the
review. Noted because it is the argument for measuring rather than reading.

## State

No production code was modified and nothing was pushed. Working tree clean;
`go build ./...` and `go test ./...` green (10 ok packages), `npm test` green in
this container — see F1 for why that last result does not transfer.
