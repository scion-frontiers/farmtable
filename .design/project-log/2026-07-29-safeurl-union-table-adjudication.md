# safe-url ADD/ADD adjudication — Phase 1 halted on a security-policy contradiction

Date: 2026-07-29
Scope: `web/src/util/safe-url.ts`, `web/src/util/safe-url.test.ts`
Full union table: `/scion-volumes/scratchpad/projects/farmtable/reports/safeurl-union-table.md`

## What this was

An ADD/ADD collision: two tracks independently wrote URL scheme validation.
Neither is the canonical version.

| Side | Commit | impl blob | test blob |
|---|---|---|---|
| MAIN | 439b309 | 659ef58 | c3e1b5c |
| BRANCH | 633f8f2 | d85bb5b | a9e49ff |

Adjudicated from a leg tree cloned from the local path
(`file:///workspace/farmtable`), never the network remote; every read was
`git show` against a named blob SHA rather than a working tree.

## Ordering

Tests were enumerated in full **before either implementation was opened**, on the
coordinator's ruling that each side's tests are the written record of what that
side knew about the attack surface. Blobs 659ef58 and d85bb5b remain unread. The
ruling paid for itself: the contradiction below is visible only in the tests, and
picking an implementation first would have silently retired one side's policy.

## The three integers

- MAIN rows: **49** (35 inline in c3e1b5c + 14 contributed only by fixture blob
  4a54328, `testdata/url-scheme-cases.json`)
- BRANCH rows: **45** (all inline in a9e49ff; BRANCH has no fixture)
- UNION rows: **82** (49 + 45 − 12 identical (input, verdict) pairs)

81 distinct inputs carry 82 rows: `http://[::1]/x` is asserted by both sides with
opposite verdicts, so it is two rows and is not deduplicated.

The union does **not** equal the MAIN count. BRANCH contributes 33 rows. The
"branch contributed nothing" alarm does not fire.

Row-number lists backing each integer are published in the report; a bare count
cannot distinguish a leak from growth.

## Finding: a MAIN-only third artefact

MAIN's test does not hold all its rows inline. It asserts against
`testdata/url-scheme-cases.json` (blob 4a54328), which **does not exist at
633f8f2**. That file is the client half of a server/client differential pin whose
other half is `TestValidateURLFieldMatchesSharedFixtures` in
`internal/server/urlvalidate_differential_test.go`. Dropping MAIN's test blob
leaves the Go half asserting against a fixture nothing on the client checks — and
it stays green while doing so.

## STOP: the two tables contradict

Halted per the stop condition. Not resolved in either direction; escalated as a
standalone question.

1. **`http://[::1]/x` — byte-identical input, opposite verdicts.** MAIN accepts
   (fixture blob 4a54328, case `"ipv6 host"`, `client: accept`, enforced at
   c3e1b5c:285). BRANCH rejects (a9e49ff:76). Unarguable.
2. **The `http:` scheme itself.** MAIN accepts `http://example.com/x`
   (c3e1b5c:126, asserted returned unchanged). BRANCH rejects
   `http://example.com/issues/1` (a9e49ff:39) and rejects loopback http in
   production too (a9e49ff:65), pinning the intent at a9e49ff:59–63 with
   `LOCAL_HTTP_LINKS_ENABLED === false`.
3. **Embedded credentials (userinfo).** MAIN accepts
   `https://user:pass@example.com/x` (c3e1b5c:130). BRANCH rejects the whole
   class (a9e49ff:49–52), reasoning that the call sites render static link text
   so the status bar is the user's only cue.
4. **Return contract (divergence, not admit/reject).** MAIN requires byte-identity
   (`safeHref(input) === input`, c3e1b5c:132–137). BRANCH requires normalisation
   — lowercased scheme, trimmed, trailing slash added (a9e49ff:84–98). These
   cannot both hold.

The underlying question is not a merge conflict: **is this helper a scheme
allow-list (MAIN) or a destination-trust gate (BRANCH), and is `http:` admissible
at all?** Two teams disagreeing about security policy, discovered by accident.

## Note on the disclosure

The requester disclosed that MAIN is their own track's work. Contradictions 1–3
all run against MAIN (it admits what BRANCH refuses). That is what the artefacts
say; it is recorded as measured, and it is not a quality judgement — BRANCH's
threat model is broader, MAIN's scope is narrower and its server counterpart
agrees with it. The ruling is the coordinator's.

## Correction made in place

A presentation row (line 82 of the report) double-counted BRANCH's IPv6
rejection, making the BRANCH column total 46 against a stated 45. Caught by
machine-checking the published columns rather than by re-reading. The row is
struck through in place, not deleted; the three integers were unaffected.

## Phase 2

Not started, and cannot start. Running both implementations against a union table
whose contested rows assert mutually exclusive verdicts would measure the
disagreement, not resolve it. Once the policy question is ruled on, the losing
side's contested rows are retired explicitly and the remaining uncontested rows
become the merged table.
