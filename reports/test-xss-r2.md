# test-xss-r2 — test review, `url-scheme-validation-r2` @ `0bc9b72`

**Verdict: REQUEST CHANGES** (two MEDIUM findings; no live exploit, no wrong production behaviour)

Tree verified: `git rev-parse --show-toplevel` = `/workspace`,
`git rev-parse HEAD` = `0bc9b721475dfe2fb24c5eba1034a071b842c45c`. ✓

**Mutation cells left dirty after restore: 0 of 31.** Every cell restored by snapshot `cp` from
`/tmp/snap`; `git status --porcelain` verified empty after each block and at the end.

---

## Headline

The branch is in much better shape than round 1. **All 8 brief targets reproduce as claimed RED**,
the round-1 vacuity defect (the private `renderGuarded()` copy) is genuinely fixed, the list-ordering
asymmetry is real and both orderings are load-bearing, and the new `viaSafeHref` binding-scoping
machinery kills exactly the defect class the old file-scoped check permitted. I could not refute a
single one of the fix leg's positive claims about its own guards.

I am requesting changes on two things the leg asserted but did not measure:

1. **H1 — the "fail closed" property of the host backstop is false.** Asserted in production code
   (`safe-url.ts:96–103`) and repeated as the rationale of `testHostGuardIsAFailClosedBackstop`.
   Measured: it fails **open** for authority-bearing script URLs.
2. **H2 — `web/scripts/run-tests.mjs` pins delivery, not consumption.** Gutting every assertion out
   of the headline security test file is **exit 0**, and the output is byte-indistinguishable from a
   pass. This is the branch's own defect class, in the branch's own new machinery.

Neither is exploitable today. Both are cheap to fix.

---

## My baseline `[MEASURED]`, vs the relayed table

I ran every gate myself before attributing anything. One column does not reproduce.

| gate | relayed | **mine** | note |
|---|---|---|---|
| `npm ci` (in `web/`) | 0 | **0** | |
| `npm run build` | 0 | **0** | `tsc --noEmit && vite build`, 342 modules |
| `npm test` | 0 | **0** | 3 test files discovered |
| `go build ./...` | 0 | **0** | after `npm run build`; ordering trap confirmed |
| `go vet ./...` | 1 | **1** | 4 × `assignment copies lock value to ephReq` |
| `go test ./...` | 1 | **0** | **does not reproduce — see brief error 5** |

Copylocks matched **by message**, as instructed: exactly 4 occurrences of
`assignment copies lock value to ephReq`, at `internal/server/server.go:1509/1619/1827/2004`
(`GetReadyTasks`, `GetBlockedTasks`, `GetCriticalPath`, `GetBottlenecks`). `grep -c copylock` = **0**,
confirming the string does not appear. Same four request types as the sibling branch, different
lines — same four.

Fixture population independently confirmed: **42 cases, 33 agree, 9 diverge**, all 9 divergences
carrying a non-empty `note`, all 33 agreeing cases carrying none.

---

## Findings by severity

### H1 — MEDIUM — the host backstop does not fail closed; the comment and the test rationale both say it does

`web/src/util/safe-url.ts:96–103` states:

> It is NOT dead weight, because it is what makes widening SAFE_SCHEMES fail closed instead of fail
> open: **every script-bearing scheme (javascript:, data:, vbscript:, blob:, mailto:) is NON-special
> and parses with hostname === ''**, so if one is ever added to the allow-list by mistake this line
> still refuses it.

`testHostGuardIsAFailClosedBackstop`'s doc-comment repeats it verbatim. **Measured: false for every
one of the five schemes named.** The claim holds only for the *empty-authority* form.

```
$ node /tmp/backstop.mjs
scheme      input                                        hostname   backstop would
javascript  javascript://                                ""         REFUSE
javascript  javascript://evil.com/%0aalert(1)            "evil.com" *** ACCEPT ***
data        data://evil.com/%0aalert(1)                  "evil.com" *** ACCEPT ***
vbscript    vbscript://evil.com/%0aalert(1)              "evil.com" *** ACCEPT ***
blob        blob://evil.com/%0aalert(1)                  "evil.com" *** ACCEPT ***
mailto      mailto://evil.com/%0aalert(1)                "evil.com" *** ACCEPT ***
```

Same result under JSDOM's parser (the one the render path actually uses), Node v20.20.2.

End-to-end demonstration, with `javascript:` added to `SAFE_SCHEMES` and **the backstop left intact**
(cell M2):

```
"javascript:alert(1)"                      -> undefined          <- backstop works
"javascript://evil.com/%0aalert(1)"        -> "javascript://evil.com/%0aalert(1)"   <- ACCEPTED
```

`javascript://evil.com/%0aalert(1)` is a live payload shape: the `//evil.com/` is a JS line comment,
`%0a` decodes to the newline that terminates it, and `alert(1)` executes.

**Observation:** if `SAFE_SCHEMES` were ever widened to a script-bearing scheme, `safeHref` would
accept the authority-bearing form of it.
**Inference (separated):** the backstop reduces the blast radius of an accidental widening; it does
not eliminate it. The word "refuses" in the comment should be "refuses the empty-authority form of".

**Why the leg missed it, and it is an instructive miss:** `reports/dev-xss-r2.md:129–131` reports
"Measured across **15 empty-host shapes**: zero arrive at the check." The measurement was scoped
entirely to empty-host inputs, so it could not have observed the non-empty-host case. The sample was
selected by the same assumption the conclusion asserts.

**Mitigating, and it matters:** `testHostGuardIsAFailClosedBackstop` **does** go RED the moment a
non-special scheme is allow-listed (cell M2 is RED). The *test* does its job. It is the stated
**reason** the test exists that is wrong. Not a live vulnerability — `SAFE_SCHEMES` is `{http:,
https:}` and the test defends that.

**Suggested fix (comment only, no behaviour change):** correct both comments to say the guard catches
the empty-authority form only, and that widening `SAFE_SCHEMES` to any non-special scheme is unsafe
regardless of the guard.

---

### H2 — MEDIUM — `run-tests.mjs` pins delivery, never consumption

Answering the brief's FORM question directly: **it pins delivery only.** Nothing observes that a
discovered file's assertions ran.

Reading `web/scripts/run-tests.mjs`, the runner checks: `.tmp-test` exists; ≥1 source discovered;
every source compiled; no orphan compiled files; every file exits 0. There is no assertion count, no
minimum output, no per-file "did it do anything" signal.

**Reproduction (cell E1)** — replace the body of `run()` in the headline security file with nothing:

```python
p='/workspace/web/src/util/safe-url.test.ts'; s=open(p).read()
i=s.index("async function run(): Promise<void> {")
open(p,'w').write(s[:i]+"async function run(): Promise<void> {\n}\n\nawait run();\n")
```

```
$ cd /workspace/web && npm test; echo $?
Discovered 3 test file(s).

--- src/util/safe-url.test.ts

--- src/util/url-binding-scan.test.ts
url-binding-scan: ok

--- src/utils/task-ready.test.ts

PASS: 3 test file(s).
0
```

Every assertion protecting the stored-XSS fix deleted. File count unchanged. Exit 0.

**What makes this materially worse than the generic form of the defect:** the tree already contains a
passing test file that prints nothing — `src/utils/task-ready.test.ts` (it has 10 real assertions and
simply never logs). So a blank line under a discovered filename is **already normal-looking output on
this branch**. The gutted `safe-url.test.ts` above is not merely undetected by the runner; it is
visually indistinguishable to a human reading CI logs, because there is a legitimate precedent for it
two lines below.

The leg validated the runner by dropping in a deliberately *failing* probe. That proves delivery. It
cannot prove the runner notices a silently-empty file, and it does not.

**Suggested fix:** have each test file report a completion token (the two XSS files already print
`safe-url: ok` / `url-binding-scan: ok`) and have the runner **require** a token per file — or, more
robustly, have each file export an assertion count and require it to be non-zero and monotonic. Cost:
~10 lines in the runner plus one line in `task-ready.test.ts`.

---

### M1 — LOW/MEDIUM — the `note` field of the shared fixture file is unpinned beyond non-emptiness

Answering the brief's count-pin question. `TestSharedFixturesRecordRealDivergences` requires
`tc.Note != ""` and nothing more. Cell **F2** rewrote **all 9** divergence notes to
`"Bananas. This note does not describe anything about this fixture."` → **GREEN**, on both halves.

The notes are the only written record of *why* client and server disagree on 9 inputs, and they can
say anything. Not a security issue; a documentation-rot surface on the one artifact whose whole
purpose is to record measured reasons. Low cost to leave, worth knowing.

---

### M2 — LOW — scanner recall gaps (latent; no live instance)

Target 7's negatives are sound (see cell S3 — a deliberately over-broad `setAttribute` pattern **is**
caught by the `data-href` negative). But the rule set has bypasses. Probing the four live regexes:

```
MISSED bracket property write    el['href'] = attackerControlled;
MISSED bracket src write         img["src"] = raw;
MISSED Object.assign             Object.assign(a, { href: raw });
MISSED aliased setAttribute      const sa = el.setAttribute.bind(el); sa('href', raw);
MISSED formaction binding        html`<button formaction=${raw}>go</button>`
MISSED iframe srcdoc             html`<iframe srcdoc=${raw}></iframe>`
MISSED form action binding       html`<form action=${raw}>x</form>`
MISSED window.open / location.assign
FIRES  outerHTML / innerHTML / multiline binding
```

**Positive control for this negative claim:** the same probe harness reports `FIRES` for
`outerHTML`, `innerHTML` and the multiline binding, so the matcher is live and the `MISSED` rows are
real misses, not a broken probe.

**Verified none of these forms exists in the tree today** (`grep` over `web/src`, 51 non-test `.ts`
files): no bracket property writes, no `formaction`/`srcdoc`, no `window.open`/`location.assign`.
`el['href'] = raw` is the notable one — one character away from the covered `.href =` form.

Separately, the scanner does not fire on the two live `unsafeHTML(renderMarkdown(...))` call sites
(`ft-inspector-comments.ts:221`, `ft-inspector-desc.ts:233`). **Checked: not a live sink** —
`util/markdown.ts:5` is `DOMPurify.sanitize(marked.parse(md))`, which strips `javascript:` hrefs. The
file's own SCOPE NOTE defers markdown to the unmerged `markdown-sanitize` branch. Reporting only
because the module header claims the scanner "fails the build for ANY dynamic `href`/`src` binding",
which is broader than what it does.

---

### M3 — LOW — the `items.length === 2` positive control is not discriminating

See brief error 4. The stated justification for it is false. Keeping it is harmless (it is a
refactor tripwire); the comment claiming it is what stops a vacuous pass should go.

---

## Mutation table

31 cells. **Prediction accuracy on outcome: 28/28 (1.00)** for cells where I recorded a prediction;
**27/28 on mechanism** — see M2 below. Three additional cells (F1pair, F3, M9) were exploratory
follow-ups rather than predictions.

| # | cell | prediction | result | hit? |
|---|---|---|---|---|
| M1 | `safe-url.ts` delete scheme check | RED | **RED** — `ftp` fixture | ✓ |
| M2 | add `javascript:` to `SAFE_SCHEMES` | RED | **RED** — but via host-guard test, **not** the 4 fixtures | ✓ outcome / ✗ mechanism |
| M3 | scheme check → `startsWith('http')` | RED | **RED** — `httpx prefix not membership` | ✓ |
| M4 | delete `hostname === ''` backstop | GREEN | **GREEN** — unreachable, as leg reported | ✓ |
| M5 | `renderPrLink`: `safeHref(url)` → `url` | RED | **RED** — real assertion, not a build error | ✓ |
| M6 | `renderExternalSourceLink` unguarded | RED | **RED** — real assertion | ✓ |
| M7a | guard index 0 only | RED via *poisoned second* | **RED via poisoned second** | ✓ |
| M7b | bail out after first rejection | RED via *poisoned first* | **RED via poisoned first** | ✓ |
| M7c | drop every item after the first | RED | **RED** — via href assertion | ✓ |
| M7d | M7c **with `items.length` control deleted** | still RED (control not discriminating) | **RED, identical message** | ✓ |
| M8 | host-guard positive control premise → `https://` | RED | **RED** — control is live | ✓ |
| M9 | M2 + M4 combined | RED | **RED** — `javascript:` accepted; see H1 | – |
| F1 | fixture identity swap, counts held 33/9 | GREEN | **GREEN** — count-pin is identity-blind | ✓ |
| F1p | same, run against **both** differential halves | web RED / go GREEN | **web RED, go GREEN** | – |
| F2 | all 9 notes → nonsense, counts held | GREEN | **GREEN** | ✓ |
| F3 | flip a **server** column (pos. control for F1p) | go RED | **RED** — go half is live | – |
| E1 | gut `run()` in `safe-url.test.ts` | GREEN | **GREEN** — `PASS: 3 test file(s).` | ✓ |
| G1 | drop `strings.ToLower` | GREEN | **GREEN** — confirms leg's G7 | ✓ |
| G2 | drop control-char pre-check | RED, exactly 1 fixture | **RED — only `bare_space_in_path`** | ✓ |
| G3 | drop `u.Host == ""` check | RED | **RED** — 5 shared fixtures + 1 | ✓ |
| G4 | drop scheme check | RED | **RED** — `ftp/ws/wss/httpx/protocol_relative` | ✓ |
| G5 | drop `convert.go` read-path validation | RED | **RED** — all 6 payload classes | ✓ |
| G6 | hide `remote_url` behind a `const` | RED via positive control | **RED — exact "not checking anything" msg** | ✓ |
| S1 | delete quoted-binding rule | RED | **RED** — `double-quoted href binding` | ✓ |
| S2 | delete `setAttribute` rule | RED | **RED** — `setAttribute href` | ✓ |
| S3 | broaden `setAttribute` rule (over-fire) | RED via **negative** fixture | **RED — `data attribute containing href`** | ✓ |
| S4a | route `href` via a helper fn (file-scoped-legal) | RED | **RED** — binding-scope msg | ✓ |
| S4b | guard a *different* variable in the same block | RED | **RED** — binding-scope msg | ✓ |
| S5 | duplicate an allow-listed line | RED | **RED** — `ambiguous ALLOWED entry` | ✓ |

**Build-failure discipline.** Every "RED" above was checked to be an assertion failure, not a compile
error. `M5`/`M6`/`S4b` were written as `const href: string | undefined = url` precisely to keep the
`href === undefined` comparison type-valid; `G1` removes the now-unused `"strings"` import; `G4`
retains `_ = strings.ToLower`. The Go harness greps for `^# `/`cannot use`/`undefined:` and would have
printed `*** BUILD FAILURE, NOT A KILL ***`. It never did. One genuine harness failure occurred
(`s4a`/`s4b` first attempt: shell cwd reset made `npx` fetch `tsc@2.0.4`); I discarded it as a harness
bug and re-ran with `./node_modules/.bin/tsc`, which is how the RED above was obtained.

**On my 28/28.** A perfect run is weak evidence and I want to flag it rather than bank it. Almost
every prediction was derived by reading the implementation first, so they were closer to
short-horizon deductions than to guesses; the brief's warning about the value of a *wrong* prediction
is well-taken and I did not generate one. The two findings that matter here (H1, H2) came from
**exploration, not prediction** — H1 from asking "what else does `hostname` do?" after M2 killed
differently than I expected, and H2 from noticing an oddity in the *baseline* output before mutating
anything. The one place my model broke (M2's mechanism) is exactly where H1 came from.

---

## Answers to the two new rules

### Count-neutral corruption of the shared fixture file

**`TestSharedFixturesRecordRealDivergences` fails the new bar.** Holding 33/9 fixed:

- **Identity swap** (make an agreeing case divergent and a divergent case agreeing, counts
  unchanged): **GREEN**. Verified 33/9 preserved after mutation.
- **Note rewritten to a string that does not describe the fixture** (all 9): **GREEN**.

Read the test and it is clear why: it counts `divergent`/`agreeing` and checks `Note != ""`. It has no
access to identity at all. Its discriminating power is exactly the two degenerate cases in its own
error messages — "all agree" and "all diverge" — and nothing between them.

**But the branch is not exposed, and the distinction matters.** The identity swap is caught — by
`testSharedFixturesMatchClientColumn`, which asserts every `client` column against real `safeHref`
output:

```
[F1pair] GO  half exit=0
[F1pair] WEB half exit=1
Error: safeHref("javascript:alert(1)") = reject, but testdata/url-scheme-cases.json records
       accept for "javascript".
```

**Positive control for the "GO half exit=0" negative claim** (cell F3): flipping a **server** column
instead turns the Go half RED —
`--- FAIL: TestValidateURLFieldMatchesSharedFixtures/javascript`. So both halves are live; my F1 swap
only touched `client` columns, which is why only the web half fired.

**Net answer:** identity is pinned by the *pair of column-vs-implementation tests*, not by the
count-pin. `TestSharedFixturesRecordRealDivergences` contributes exactly one property the pair
lacks — "someone did not reconcile the file by rewriting both columns together" — and it is correct
to keep it for that. It should not be described as the anti-vacuity control; the pair is. The one
genuinely unguarded surface is the `note` text (finding M1).

### Does `run-tests.mjs` pin consumption?

**No. Delivery only.** Full detail and reproduction in H2 above. Cell E1: the entire headline
security file gutted of assertions is `PASS: 3 test file(s).`, exit 0, and — because
`task-ready.test.ts` is a legitimately silent passing file — the log output is indistinguishable from
a normal run to a human reader.

---

## Numbered list of everywhere this brief is wrong

1. **`web/testdata/url-scheme-cases.json` does not exist.** The file is `testdata/url-scheme-cases.json`
   at the repository root. `ls /workspace/web/testdata/` → `No such file or directory`. Both consumers
   resolve it from the repo root (`repoRoot()` in the Go half via `runtime.Caller`, and via `go.mod`
   discovery in the TS half). The brief states the wrong path twice.

2. **`scripts/run-tests.mjs` is `web/scripts/run-tests.mjs`.** There is a separate repo-root
   `scripts/` directory containing only `remap-github-sub-issues.sh`, so the path as written resolves
   to a real directory that does not contain the file — the failure mode is a confusing empty result
   rather than a clean "not found".

3. **Target 1 attributes the `javascript:` mutation to the wrong check.** The brief groups two
   mutations under "**The four MUST-2 allow-list fixtures** (`ftp://`, `ws://`, `wss://`,
   `httpx://evil.com/x`) … add `javascript:` to `SAFE_SCHEMES`". Measured: adding `javascript:` leaves
   all four MUST-2 fixtures GREEN **and leaves `testRejectsUnsafeSchemes` entirely GREEN** — because
   with the backstop intact, `safeHref('javascript:alert(1)')` still returns `undefined` (hostname is
   `''`). The mutation is killed *only* by `testHostGuardIsAFailClosedBackstop`. Two different
   mutations, two different killers; the brief credits both to the fixtures. This matters because it
   is the fixtures' adequacy that was in question, and this mutation says nothing about it.

4. **Target 5's justification for the `items.length === 2` positive control is false.** The brief:
   "*without which 'exactly one href' is also satisfied by a component that dropped everything after
   the first*." Measured (cell M7d): with the control **deleted**, a component that drops everything
   after the first is **still RED**, with a byte-identical message, from the preceding href assertion
   (`Got []`). In the other ordering it is caught by the `.pr-link-unsafe` assertion. I could
   construct no mutation killed only by that control. This is the same shape as the error the brief
   warned me about — a supplied claim about what a check catches, where the opposite is true.

5. **The `go test ./...` row does not reproduce.** Relayed as exit 1 with the `TestWatchTasks_NoInitial`
   flake. I measured **exit 0** on `go test ./...` and exit 0 on a second `go test ./internal/server/`
   run, with zero `--- FAIL` lines. The baseline itself says the gate is probabilistic and to read
   names not counts, which is right — but the table presents `1` as the branch's baseline value, and
   a leg that took it literally would go looking for a failure that is not there. The honest cell is
   "0 or 1, flaky".

6. **"requires every divergence to carry a written reason" overstates the check.** It requires
   `Note != ""`. Cell F2 replaced all 9 notes with `"Bananas. This note does not describe anything
   about this fixture."` → GREEN. "Non-empty" and "written reason" are very different bars, and the
   brief's own new rule is about exactly this gap.

7. **The brief endorses the false fail-closed claim.** Target 2 describes the host check as a
   "**fail-closed backstop**" whose reachability precondition is pinned, relaying the leg's framing
   without challenge. Measured (H1): it does not fail closed —
   `new URL('javascript://evil.com/%0aalert(1)').hostname === 'evil.com'` for all five script-bearing
   schemes the comment names. This is the round's second instance of an unmeasured security claim
   riding in behind a correct fact; the fact (the guard is unreachable today) is true, the inference
   (therefore widening fails closed) is false.

8. **Leading question in Target 7.** "*The negatives exist so the new rules cannot over-fire. **Can
   the negatives fail?***" supplies its own answer by pairing the question with the rationale. It
   happens to be right — cell S3 shows the `data-href` negative fires on an over-broad rule — but the
   framing invites confirming rather than testing it, and per the shared block's failure mode 1 that
   is a defect in the question. The question I could actually answer more usefully was the
   complementary one the brief did not ask: *what still slips past the rules?* — answered in M2.

9. **"3 test files discovered" is reported as a gate result without noting one produces no output.**
   The `npm test` row reads as three healthy files. One of the three (`src/utils/task-ready.test.ts`)
   prints nothing on success. That is benign in itself, but it is the precise fact that makes finding
   H2 dangerous rather than theoretical, and it was observable in the baseline the brief relayed.

10. **(Self-reported by the EM mid-run, not caught by me — logged for ledger completeness.)** The
    covering message gave the report path as the relative `reports/test-xss-r2.md`, which does not
    resolve from the repo root; the brief body had the correct absolute path. No impact here: I wrote
    to the absolute path from the brief body before the correction arrived. Worth noting that this is
    the mirror image of the path discipline the shared block gets right — the block refuses to assert
    the *tree* path and makes you measure it, but then hard-codes the *report* path in prose in two
    places that can disagree. The same fix applies: state it once, in one file.

Cross-checked against `reports/dev-xss-r2.md`: the dev report is *consistent* with the brief on items
4 and 7 — it is the origin of both claims (lines 411 and 137–141). Item 7's root cause is visible at
its line 129–131: "Measured across **15 empty-host shapes**". The sample was chosen by the hypothesis.

---

## What I did not test

- Postgres-backed integration tests (`-tags integration`) — no live instance; out of scope.
- Whether `enclosingBlock`'s documented widening (a binding inside a class widens scope to the whole
  class) is exploitable. **`[INFERENCE]`** both current `viaSafeHref` entries are module-level
  functions, so the tight branch of that function is what runs today; the hole is latent, not live. I
  judged constructing the class refactor to be lower value than H1/H2 and stopped.
- Any mutation of `internal/platform/github/testing.go` (`SetTestGraphQLClient` / `testing.TB`), which
  is in the diff but is test-only plumbing.

## Recommendations (not for me to implement)

| pri | action |
|---|---|
| **High** | Fix the `run-tests.mjs` consumption hole: require a per-file completion token or non-zero assertion count. New machinery on this branch, and it is the branch's own defect class. |
| **High** | Correct the fail-closed claim in `safe-url.ts:96–103` and in `testHostGuardIsAFailClosedBackstop`'s doc-comment. Comment-only; no behaviour change. Consider a fixture asserting `safeHref('javascript://evil.com/%0aalert(1)') === undefined` so the property is pinned rather than asserted in prose. |
| Medium | Drop or rewrite the claim that `items.length === 2` is what prevents a vacuous pass (M3). |
| Low | Consider adding `el['href'] =` (bracket notation) to the scanner rules — one character from a covered form (M2). |
| Low | Note that the fixture `note` text is unpinned (M1); accept or pin. |

Escalation note, per my role boundary: H1 is a security-relevant *documentation* defect rather than a
test defect, and the manager may want the security auditor's read on whether widening
`SAFE_SCHEMES` is a realistic enough future change to warrant a pinned fixture. I have not invoked
that agent.
