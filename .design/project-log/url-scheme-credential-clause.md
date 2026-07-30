# Credential rejection in safeHref

Branch `hardening/cred-clause`, off main `7bb0c756`. Commit `830a5fbb`.

## The defect

`safeHref` accepted `https://github.com@evil.example/`. The scheme is `https:`
and the hostname is non-empty, so neither the `SAFE_SCHEMES` allow-list nor the
`hostname === ''` backstop refused it. WHATWG parses `github.com` as USERINFO
and `evil.example` as the host, so the string READS as github.com and LOADS
evil.example.

~~Both call sites render STATIC link text, so nothing on screen contradicts the
misreading.~~

**Correction, 2026-07-29.** The sentence above was false when written.
ft-inspector-code.ts renders `${id}` as the link text, which is
caller-supplied. See safe-url.ts for the corrected reading. The finding in this
log is unaffected; only its justification was wrong.

This is DESTINATION CONFUSION, not scheme escalation — no attacker-chosen
scheme is reachable through it.

## The fix

One line, after the `new URL()` try/catch and before the `SAFE_SCHEMES` check:

```ts
if (parsed.username || parsed.password) return undefined;
```

`undefined`, matching the existing contract. `SAFE_SCHEMES` is untouched:
`http:` and `https:` remain allowed unconditionally, which is a ruling by the
owner rather than an oversight.

Both fields are tested, not just `username`. `https://:pass@evil.example/`
parses with `username === ''` and `password === 'pass'`, so a check on
`username` alone would let it through. That shape is pinned in both the unit
table and the shared fixture precisely so the `||` cannot be simplified away.

## Blast radius — measured, and larger than believed

The brief expected one fixture row in `safe-url.test.ts`. That was correct **for
that file** and incomplete for the tree. Published as a set, not a count:

| Site | What it was |
|---|---|
| `web/src/util/safe-url.test.ts:130` | accepted-array row, the defect written down as expected behaviour |
| `testdata/url-scheme-cases.json:240` | pinned row `client: "accept"`, read by BOTH suites |
| `internal/server/urlvalidate_internal_test.go:78` | server-side row; **unaffected**, the server is not changing |

The second entry is the one that matters: it is a cross-language contract read
by `testSharedFixturesMatchClientColumn()` **and** Go's
`TestValidateURLFieldMatchesSharedFixtures`. The web suite could not go green
without flipping its `client` column to `reject`.

That failure was **masked** on first run. `safe-url.test.ts` fails fast, so the
line-130 assertion aborted the file before the shared-fixture test ever
executed. Predicting "two failures" and observing one would have read as the
JSON being fine. It was confirmed instead by evaluating `safeHref` directly over
the `cases` array: exactly one mismatch, `userinfo`.

## Flipping the row is not a one-character edit

A divergent row must carry a `note` satisfying six rules derived in
`divergenceNoteProblems`: non-empty, >= 80 chars, contains `server is more
permissive` (derived from the columns), must NOT contain the opposite
direction, must name a server mechanism (`net/url` / `validateURLField` /
`control-character`), must name a client mechanism (`WHATWG` / `new URL(`),
must not declare base-dependence unless marked, and must be unique verbatim
across the file. All four credential rows carry conforming, distinct notes.

## Server columns were derived, never assumed

A throwaway in-package Go probe ran `validateURLField` over each input and was
deleted before staging. Pre-registered prediction: every credential row comes
back **server accept / client reject**. Result:

| Row | Server |
|---|---|
| `https://user:pass@example.com/x` (the flip) | accept |
| `https://ok.example@evil.example/` | accept |
| `https://github.com@evil.example/` | accept |
| `https://:pass@evil.example/` | accept |

Prediction HIT on all four; no deviation, so no stop condition triggered.

The probe carried controls in both directions: a plain `https://example.com/x`
read `accept`, and `javascript:alert(1)` plus an embedded NUL read `reject`. The
first run returned `accept` for everything — true, but an instrument that can
only emit one value proves nothing. The negative controls were added before the
numbers were trusted.

## The cardinal

Re-derived ONCE, after all edits, from the `cases` array — never `_README`. The
file documents its own coverage inside itself, and the prose names example
shapes that are not pinned inputs, so a grep answers the wrong question.

Pre-registered 45 / 13 / 32; measured **45 cases, 32 agree, 13 diverge** (was
42 / 33 / 9). Direction split: 7 server-reject/client-accept (client looser,
the direction with teeth, not in scope here) and 6 server-accept/client-reject
(client stricter, now including all four credential rows). Go's
`TestSharedFixturesRecordRealDivergences` independently logs `45 cases, 32
agree, 13 diverge` — a second instrument, not a second reading of the first.

Nothing asserts that cardinal; it lives in prose in more places than expected.
All sites describing the CURRENT population were moved in the same commit:

- `web/src/util/safe-url.ts` — 2 sites
- `web/src/util/safe-url.test.ts` — 2 sites (one of them `42 assertions` at
  :462, found only on a second sweep — see below)
- `testdata/url-scheme-cases.json` `_README` — 4 sites (incl. `19` -> `23`
  known-divergent shapes: 13 pinned + the 10 still outside the file)
- `internal/server/urlvalidate_differential_test.go` — 3 sites

`urlvalidate_differential_test.go:322` was deliberately LEFT at "nine notes". It
is a historical record of a past mutation test performed when there were nine;
updating it would falsify the history it exists to preserve.

One sentence needed more than its number. "All 9 are http(s)-resolving" was
already imprecise before this change: two divergent rows (`empty`, `out of
range port`) do not parse at all. It now reads "All 13 are http(s)-resolving or
inert", matching the `_README`'s own existing phrasing. The safety claim — none
is a scheme escalation — holds either way.

## Gates

| Gate | Result |
|---|---|
| `npm test` (web) | enumerated 6, executed 6, **pass 6, fail 0** |
| `go build ./...` | exit 0 |
| `go test ./...` | exit 0 |
| `node scripts/ci-suite-manifest.mjs` | exit 0, positive control fired |

`npm ci` was used, never `npm install`; `git status` on `web/package-lock.json`
is clean, so the tracked lock is byte-identical.

## Controls, and the things that did not go as predicted

- **The zsh revision trap FIRED.** Unbraced `$REV:web/src/util/safe-url.ts`
  resolved to `b/src/util/safe-url.ts`. Every read used the braced form with a
  `git cat-file -t` type assertion in the same text, both returning `blob`.
- **Prediction MISSED:** two failing assertions were predicted after the fix;
  one surfaced. Cause was fail-fast ordering, not a wrong diagnosis. Recorded
  because the miss is what exposed the masking.
- **Mutation control, run before recommending:** commenting the clause out turns
  the new table red on **8 of 8** rows, reported by the summary assertion rather
  than by the first row. The summary-first ordering exists for exactly that: it
  distinguishes "one shape regressed" from "the clause is gone".
- **Positive arm in the table:** four normal URLs must still round-trip, so the
  suite cannot go green by rejecting everything.
- **A FALSE RED:** `go test ./...` and the manifest script both exited 1 when
  run with a working directory left at `web/`. Nothing was wrong with the tree.
  The inverse of the dead-instrument problem — a broken apparatus reading
  failure — and equally worth not believing on the first read.
- **`web/scripts/run-tests.mjs` is dead and its pin is unreachable.** It carries
  `EXPECTED_ASSERTIONS = 483` as an exact `!==` pin, but nothing invokes it:
  `npm test`, `make test-web` and `ci.yml` all route to `run-node-tests.mjs`.
  Run directly, it fails a `tsconfig.test.json` precheck before it ever counts,
  so 483 has not been evaluated in some time. Not touched — repairing it would
  require editing `tsconfig.test.json`, which is off-limits. **Filed, not
  fixed.**
- **A SIXTH cardinal site was missed on the first pass, and the miss was in the
  search pattern.** The first sweep used phrase patterns — `9 of`, `All 9`, `of
  these 42`, `nine notes` — built from the phrasings already seen. It cannot
  match `the loop above is 42 assertions` (`safe-url.test.ts:462`), which is a
  bare cardinal in a sentence of a different shape. Re-swept with a
  bare-number pattern (`42|33|9|nine`) across the four coupled files, which
  returns that site plus only the deliberately-retained historical one at
  `urlvalidate_differential_test.go:323`. **Generalising from a supplied list
  of four to "the population is four" is the same error as trusting a
  cardinal: the list was a sample.** The bare-number sweep is the one to run
  next time; phrase sweeps confirm what you already know.
  - That site is the justification for an anti-vacuity `marked > 0` assert, so
    a wrong number there specifically undermines the guard whose job is to
    prove the apparatus is not vacuous. Verified before editing that the loop
    really is one assertion per case over `loadSchemeCases()`, so 45 is derived
    and not inferred from the row count.
- **`MIN_TEST_FILES` stays at 6.** This commit adds fixture rows and test
  functions, no test FILES; population is unchanged at 6. Nothing to move.

## Not done, deliberately

No `safeExternalUrl` was created, aliased or re-exported (0 occurrences
repo-wide). The scheme policy was not narrowed. No DEV or build-time flag. No
manifest, lock, types-allowlist or dev-dependency change. `rank.test.ts` and
`task-state-utils.test.ts` were not ported — they belong to a separate commit
owned by another track.
