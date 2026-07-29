# dev-xss-r3 — fix round 3, `url-scheme-validation-r2`

**Tree:** `/workspace`. Branch `url-scheme-validation-r2`.
Start `git rev-parse HEAD` = `0bc9b721475dfe2fb24c5eba1034a071b842c45c` [MEASURED] — matches the brief.
End HEAD = `b06121f`. Five commits, local only. **Nothing pushed.**

Tags: `[MEASURED]` = I ran it, this session, this tree. `[REPORTED — who]` =
relayed. `[INFERENCE]` = reasoned, not run.

Probes and mutants were reverted by snapshot restore (`cp` from `/tmp/r3/snap*`),
never `git checkout`. **Dirty cells left at the end: 0.** `git status --porcelain`
is empty at every commit boundary and at the end of every mutation round; the
restores are shown inline below.

---

## Deliverable 1 — audit F-3, confirm or refute

**Recorded before B3 was written.** Commit `42d62a4` (the B3 fix) has this
measurement in its message; the harness and its outputs are in `/tmp/r3/d1/`.

**Prediction, written down before running: (a) CONFIRM, (b) CONFIRM.** Both hit.
Two hits out of two is weak evidence about my judgement — I predicted confirm on
both because the audit quoted the regex, and reading the regex is most of the
work. The informative misses this round are in the mutation table (M-B2-6) and
in §"where the brief is wrong" #6.

### Method, and why the harness is not the scanner

I transcribed `enclosingBlock` (`:170-187`), `interpolatedIdentifier`
(`:196-199`) and the assignment check (`:322-330`) into a standalone Node
harness rather than driving `npm test`, because the scanner only reports
*findings* and I needed to score individual shapes. A transcription can drift
from its original, so the harness refuses to record anything until a **fidelity
control** passes: it scores both real allow-listed bindings in the tree and
requires ACCEPTED (the real scanner is green on them), and scores the same two
with the guard textually removed and requires rejected.

```
fidelity+ components/inspector/ft-inspector-code.ts:34 id=href -> ACCEPTED (want ACCEPTED)
fidelity- components/inspector/ft-inspector-code.ts:34 guard removed -> rejected (want rejected)
fidelity+ components/inspector/ft-inspector-meta.ts:27 id=href -> ACCEPTED (want ACCEPTED)
fidelity- components/inspector/ft-inspector-meta.ts:27 guard removed -> rejected (want rejected)
FIDELITY CONTROL: PASS
```
[MEASURED, re-run this session]

### F-3(a) — **CONFIRMED.** All five fail-open shapes accepted.

```
ACCEPTED  const href = safeHref(url);                          <- correct
ACCEPTED  const href = safeHref(url) ?? url;                   <- guard defeated
ACCEPTED  const href = safeHref(url) || url;                   <- guard defeated
ACCEPTED  const href = safeHref(url) ?? "javascript:alert(1)"; <- guard inverted
ACCEPTED  // const href = safeHref(url);                       <- commented out
rejected  const href = url;                                    <- no guard (negative control)
```
Exactly the audit's table, row for row. [MEASURED]

The negative control matters here more than usual: without it, "everything is
ACCEPTED" would be equally consistent with a harness whose scorer always returns
true.

### F-3(b) — **CONFIRMED.** Class-wide scope; a guarded sibling launders a bare one.

```
enclosingBlock(bare binding at :13) spans 11 lines:
  | export class FtThing extends LitElement {
  |   renderGuarded() {
  |     const href = safeHref(this.a);
  |     return html`<a href=${href}>g</a>`;
  |   }
  |
  |   renderBare() {
  |     const href = this.b;
  |     return html`<a href=${href}>b</a>`;
  |   }
  | }
bare binding -> ACCEPTED (laundered)
CONTROL, guarded sibling de-guarded -> rejected (want rejected)
```
[MEASURED]

The control is the second line: with `safeHref` removed from the *sibling*, the
bare binding is rejected. That is what proves the accept came from the sibling's
guard and not from the harness being blind.

### F-3 end-to-end through the real scanner, not the transcription

The harness could still be wrong in the same way twice. So I also dropped a real
`web/src/components/zz-probe-scope.ts` into the tree and ran `npm test`
unmodified:

| probe | `npm test` exit | scanner said |
|---|---|---|
| `href = safeHref(url) ?? url` on the real `renderPrLink` | **0** | `url-binding-scan: ok` — fail-open reproduced end to end |
| guarded + bare sibling methods in one class | **0** | `url-binding-scan: ok` — laundering reproduced end to end |
| control: the same file with the guard deleted from *both* methods | **1** | rejected the binding, with the intended message |

[MEASURED; `/tmp/r3/d1/e2e-*.txt`. Exit codes from the child process, not through
a pipe.]

Note the first row of that table: the `?? url` probe left `npm test` green while
`safe-url.test.ts` — a *different* file — was red for the same edit (it renders
the real `renderPrLink` and saw the payload reach an `href`). The scanner and
the behavioural test disagreed about the same line of code, and only the
behavioural one was right. [MEASURED, `/tmp/r3/d1/e2e-a-safeurl.txt`]

Probes reverted by snapshot restore. **0 dirty cells.**

---

## B1 — `remote_data` still shipped the rejected URL

**Commit `54c46cc`.**

Fixed the mechanism, not the list. `urlBearingRemoteDataKeys = []string{"remote_url"}`
is gone. In its place:

- `urlBearingRemoteDataKey(key)` — a predicate over the key's *segments*
  (split on `_ - . /` and space, plus two camelCase rules), matching a small
  word set (`url`, `uri`, `href`, `link`, `permalink`, plurals). An all-caps
  fallback catches `HTMLURL`. `CURL` is a fail-closed false positive and is
  documented as one.
- `sanitizeRemoteData(map)` — returns a copy with every URL-bearing key that
  does not pass `validateURLField` dropped, and every URL-bearing key whose
  value is not a string dropped. `convert.go` now serialises
  `sanitizeRemoteData(t.RemoteData)`.

This covers `html_url` without naming it, which was the point.

**The three false statements are corrected** — but two of the brief's three
citations are out of range; see §"where the brief is wrong" #1.

**A finding of my own, in none of the three r2 reports.** `remote_data` is
silently `nil` on the entire GitHub passthrough path. `issueBuildRemoteData`
writes `"labels": []string{...}`; `structpb.NewStruct` rejects `[]string`; and
`convert.go` discards the error with `_`. So the whole map vanishes.
[MEASURED — `TestGitHubPassthroughRemoteDataNeverSerialises` asserts it.]

Two consequences. First, **any e2e absence assertion on that path would have
been vacuous** — including the one B1 asks for. Second, this is a live
behavioural bug (a dropped map, not a dropped URL) and fixing it is a visible
change that belongs in its own commit, not inside a security round. I pinned it
instead, so that whoever fixes `[]string` → `[]any` is told by a red test that
the pin above it was resting on `nil`.

---

## B2 — the runner's naming and consumption gaps

**Commit `d92ae5e`.**

### Naming half — chokepoint, as the brief preferred

`run-tests.mjs` now walks **all** of `src/` and applies a deliberately broad
test-shaped predicate:

```js
const TEST_WORD = /(^|[.\-_])(tests?|specs?)([.\-_]|$)/i;   // foo.spec.ts, foo-test.ts, spec.ts
const TEST_DIR  = /^_{0,2}(tests?|specs?)_{0,2}$/i;          // __tests__/, spec/
```

Anything test-shaped that the narrow discovery glob (`src/**/*.test.ts`) did not
pick up is a **hard failure with the file listed**, not a silent skip. It also
pins `tsconfig.test.json`'s `include` to exactly `["src/**/*.test.ts"]`, because
the chokepoint's reasoning depends on the compiler and the runner agreeing about
what a test is; if one moves alone, you get the failure back in a new spelling.

### Consumption half — the design choice, and what it costs

**Chosen: a shared assertion harness that counts, plus a machine-readable
receipt the runner requires from every file.** `web/src/util/assertions.ts`
exports `assert`/`assertEqual`, counts every evaluation, and writes
`#assertions <n>` to fd 1 on exit. The runner fails a file that emits **no**
receipt (it never imported the harness) and a file whose receipt is **zero** (it
imported it and never used it), and fails the suite if the total is zero.

Options I rejected, and why:

- *Parse the test file for `assert` calls.* Static, so a call inside a function
  nobody invokes counts. That is precisely the failure mode being closed.
- *Require each file to print a success line and grep for it.* `console.log` is
  the thing a gutted `run()` stops doing, but it is also trivially re-added, and
  `src/utils/task-ready.test.ts` printed nothing on success — which is exactly
  what made the gutted file invisible in CI.
- *Adopt `node:test` / a real runner.* The right long-term answer. Out of scope
  for a security round, and it is the centre of the known merge collision (#103).

**What it costs, stated plainly:**

1. **A count is a weak signal.** `assert(true, 'ok')` a hundred times satisfies
   it. It is a floor on vacuity, not a measure of coverage, and the harness
   docblock says so.
2. **Every test file must now import the harness.** Three files each had their
   own local `assert`; those are gone. A new test file that rolls its own fails
   the gate — correctly, but it is a constraint on contributors that did not
   exist before.
3. **It needed a second file to defend itself.** See M-B2-6 below: a mutant that
   counts but never throws holds the receipt *exactly* fixed and passed. The
   gate reads the count, so the gate structurally cannot see it. That required
   `assertions.test.ts`, which checks the harness with a `must()` helper that
   throws directly and is deliberately **not** counted. A test that verified the
   harness *through* the harness would hide the mutant inside the instrument.
4. **`fs.writeSync(1, …)`, not `console.log`.** `process.stdout` is asynchronous
   when it is a pipe, so a `console.log` in an `exit` handler is dropped. I lost
   an hour to a receipt that existed interactively and vanished under the
   runner. [MEASURED]

`spawnSync().status` comes from `waitpid`, not from the pipe, so capturing
stdout to read receipts does not violate the exit-code rule.

---

## B3 — `viaSafeHref` fail-opens

**Commit `42d62a4`.** Three changes, of which the brief named one:

1. **Prefix match → whole-initialiser match.** The RHS must be exactly
   `safeHref(...)`: parens balanced, and only `[\s;,)]` after the close. Kills
   `?? url`, `|| url`, `?? "javascript:alert(1)"`.
2. **Comment and string blanking.** `blankNonCode()` replaces `//` and `/* */`
   comment bodies and single/double-quoted string bodies with spaces, preserving
   length and line count. Kills the commented-out guard.
3. **Brace-depth scoping.** `enclosingBlock` now walks *backwards* over
   character offsets accumulating depth, stops at depth −1 (the innermost
   opening `{`), and then walks *forward* to its match. Kills the sibling-method
   laundering.

The brief's remedy covers (3) only, and (3) alone needs a forward walk too;
see §"where the brief is wrong" #4.

The diff comment that said "scoped to the binding" when it was not is replaced
by a docblock with a "WHAT IT STILL DOES NOT SEE" paragraph.

---

## B4 — scanner recall

**Commit `457886d`.** Added: `Object.assign(el, {href: x})` as a whole-text,
paren-balanced scan reporting at the key's own line; the high-value attributes
(`srcdoc`, `formaction`, `action`, `ping`, `srcset`, `poster`, `data`) and the
matching properties; imperative navigation (`window.open`, `location.assign`,
`location.replace`); and a ban on `setAttribute`/`setAttributeNS` with a
non-literal first argument.

The brief's premise for the `Object.assign` rule does not hold as stated; see
§"where the brief is wrong" #6. I added the rule anyway, for the reason the
brief gives second (a `href:` key in that idiom is a natural next edit), not the
one it gives first.

---

## B5 — the scanner's anti-vacuity check

**Commit `457886d`.** `findings.length >= ALLOWED.length` is replaced by a file
count (`MIN_FILES = 40`; measured 52 files, 2 in `src/util`, 15 in
`src/components`) plus three named witness paths the walk must have reached.

**Positive control for the old check, which the brief understates.** With
`sourceFiles()` crippled to return only the three allow-listed files — so the
rest of `web/src` is never opened — the old assertion left `npm test` at
**exit 0** with `url-binding-scan: ok`. [MEASURED] The new one exits 1 with
"the scanner walked 3 source files, expected at least 40."

---

## B6 — the false comments and the fixture notes

**Commit `b06121f`.**

- **Host backstop.** Comment replaced. It now quotes the old claim, gives the
  two measurements side by side (`javascript:alert(1)` → hostname `''`;
  `javascript://evil.com/%0aalert(1)` → hostname `evil.com`), explains why the
  second executes, and says what actually makes widening fail closed. All five
  named schemes measured in the authority form; all five yield a non-empty
  hostname. Both `javascript://evil.com/%0aalert(1)` and `data://evil.com/x` are
  now rejection fixtures.
- **Base-dependence.** Six fixtures marked `"base_dependent": true`, and the
  marker is **measured, not annotated**: `testBaseDependenceMarkersAreAccurate()`
  sets every input as the `href` of a real anchor in two real JSDOM documents
  (one http-based, one https-based) and fails in **both** directions. Notes that
  stated hosts as flat facts now say whose parse the host came from. `safe-url.ts`
  carries the "safe for the SCHEME, not accurate for the HOST" paragraph.
  The count is six, not four; see §"where the brief is wrong" #2.
- **"Bounded" → "pinned and sampled."** README rewritten, the audit's ten extra
  shapes named in it, and "the set is NOT closed" stated.
- **Divergence reasons.** `TestSharedFixturesRecordRealDivergences` no longer
  checks `Note != ""`. It applies rules **derived from each case's own columns
  and marker**: the stated direction must match the columns, both
  implementations must be named, notes must be unique across cases, the
  `base_dependent` marker must be reflected in the note (both ways), and a
  minimum length. `divergenceNoteProblems` has its own control test with the
  positive case (a real fixture must pass) and eight negatives.

---

## Mutation table

Every row was run in this tree, this session. **Every mutation was reverted by
`cp` from a `/tmp` snapshot, and `git status --porcelain` was checked after each
round.** "Count-neutral" means the count that the pin might have been reacting
to was held exactly fixed and only identity was corrupted. Exit codes are the
child process's.

### B1 — remote_data scrubbing

| # | mutation | count held fixed | result |
|---|---|---|---|
| M-B1-1 | `sanitizeRemoteData` returns `rd` unchanged | — | **KILLED** (4 assertions: both carriers, both at the function and at the wire) |
| M-B1-2 | **count-neutral:** invert which keys survive — URL-bearing kept, non-URL dropped | map size unchanged | **KILLED** |
| M-B1-3 | **count-neutral:** predicate matches exactly 2 adapter keys, the *wrong* 2 | number of URL-bearing keys = 2 | **KILLED** (every non-URL key reported) |
| M-B1-4 | **count-neutral:** extractor swaps top-level and nested buckets | total key count unchanged | **KILLED** by the extractor's own positive control ("found no top-level `remote_url` … this test can no longer see the adapters' writes") |
| M-B1-5 | `convert.go` serialises `RemoteData` raw again | — | **KILLED** |
| M-B1-6 | **count-neutral e2e:** swap which of two tasks carries the payload | 2 tasks, 1 payload, unchanged | **KILLED**, and its positive control fired too |

### B2 — the runner

| # | mutation | count held fixed | result |
|---|---|---|---|
| M-B2-1 | add `src/util/orphan.spec.ts` | — | **KILLED**: "these files under src/ look like tests but are not named `*.test.ts`" |
| M-B2-2 | add `src/util/__tests__/stray.ts` | — | **KILLED**, same chokepoint |
| M-B2-3 | gut `run()` in `safe-url.test.ts` | file count = 3 | **KILLED**: "exited 0 having evaluated 0 assertions" |
| M-B2-4 | file stops importing the harness, keeps a local `assert` | file count = 3 | **KILLED**: "emitted no `#assertions` receipt" |
| M-B2-5 | **count-neutral:** widen `tsconfig.test.json` `include` to `src/**/*.ts` | same array length | **KILLED** |
| M-B2-6 | **count-neutral:** `assert` counts but never throws | receipt exactly 200, 3 files | **SURVIVED** → see below |
| M-B2-6b | same mutation, after `assertions.test.ts` existed | receipt fixed | **KILLED**: "assert(false) must throw" |
| M-B2-7 | **count-neutral:** `assertEqual` stops comparing | receipt fixed | **KILLED** |
| M-B2-8 | **count-neutral:** counter frozen at a plausible non-zero constant | receipt non-zero | **KILLED**: "assertionCount must advance by one per assertion; went 45 -> 42" |

**M-B2-6 is the most useful result in this round.** The consumption gate reads a
count, so a mutant that holds the count exactly fixed while disabling every
check underneath it is invisible to the gate *by construction*. It shipped green
at "PASS: 3 test file(s), 200 assertions." The brief's count-neutral rule found
a defect in the fix written to satisfy the brief's other half. The instrument
had to be checked by something outside itself.

### B3 — viaSafeHref

| # | mutation | count held fixed | result |
|---|---|---|---|
| M-B3-1 | the D1(a) fail-open (`?? url`) on the real `renderPrLink` | binding count unchanged | **KILLED** |
| M-B3-2 | **count-neutral:** guard present but applied to a *different* identifier | one `safeHref(` call, same line count | **KILLED** |
| M-B3-3 | **count-neutral:** guard demoted to a comment | same tokens, same line count | **KILLED** |
| e2e | the three real-probe rows in Deliverable 1, re-run against the fixed scanner | — | all three now behave correctly |

### B4 — recall

| # | mutation (a real file added to `web/src`) | result |
|---|---|---|
| M-B4-1 | `html\`<iframe srcdoc=${this.raw}>\`` | **KILLED**: `[dynamic URL attribute binding]` |
| M-B4-2 | `Object.assign(createElement('a'), { href: raw })` | **KILLED**: `[URL property set via Object.assign (href)]` |
| M-B4-3 | `window.open(raw, '_blank')` | **KILLED**: `[imperative navigation with a non-literal URL]` |
| M-B4-4 | `el.setAttribute(k, v)` in a loop | **KILLED**: `[setAttribute with a computed attribute name]` |

These are recall mutants, so the count-neutral question is inverted: what
matters is that adding a binding while the *finding count from existing files*
stays at zero still goes red. It does — each probe is the only finding.

### B5 — the scanner's walk

| # | mutation | count held fixed | result |
|---|---|---|---|
| M-B5-1 | walk stops descending into subdirectories | — | **KILLED**: "walked 2 source files, expected at least 40" |
| M-B5-2 | **count-neutral:** walk reads 52 files, but the *wrong* 52 (one directory skipped, padded back to 52) | file count = 52 | **KILLED** by the witness paths: "never reached components/inspector/ft-inspector-meta.ts" |
| control | the **old** `findings.length >= ALLOWED.length` with the walk crippled to 3 files | — | **exit 0, green.** The check the brief asked me to replace passes on a walk that never opens the tree. |

### B6 — the fixture notes and markers

| # | mutation | count held fixed | result |
|---|---|---|---|
| M-B6-1 | **count-neutral:** swap the notes of `backslash host confusion` (client-permissive) and `out of range port` (server-permissive) | 9 notes, same 9 texts | **KILLED**, 5 failures: both cases fail the direction rule in both halves ("the note claims *server is more permissive*, which contradicts server=reject client=accept") |
| M-B6-2 | **count-neutral:** clone one note over all seven client-direction cases | 9 notes | **KILLED**, 9 failures (uniqueness + base-dependence) |
| M-B6-3 | **count-neutral:** move a `base_dependent` marker from `single slash host` to `backslash host confusion` | 6 markers | **KILLED** by the client-side marker test *and* — after the fix below — by the Go note rule in both directions |
| M-B6-4 | **count-neutral:** `SAFE_SCHEMES = {'http:', 'javascript:'}` | set size = 2 | **KILLED**, and the *first* failing assertion is the fixture B6 added: `safeHref("javascript://evil.com/%0aalert(1)")` returned the input |
| M-B6-5 | **control, expected survivor:** delete the `hostname === ''` guard entirely | — | **SURVIVED**, exit 0, 315 assertions. This is the measurement behind the comment: the guard really is unreachable today, so no fixture can pin it, and the comment now says exactly that instead of claiming the guard is what makes widening safe. |
| M-B6-6 | **count-neutral:** the direction rule ignores the columns and always expects "client" | rule count unchanged | **KILLED** by `empty` and `out of range port`, and by the rule's own positive control |
| M-B6-7 | **count-neutral:** the JSDOM probe ignores its `base` argument | 45 assertions unchanged | **KILLED** by positive control 1 ("a root-relative href must resolve against the document base; got dash.internal.test and dash.internal.test") |
| M-B6-8 | disable the uniqueness rule, then run M-B6-2 | — | still red, but only via the base-dependence rule — so M-B6-2 alone does not prove uniqueness earns its place |
| M-B6-9 | **count-neutral:** clone one note over two *same-direction, non-base-dependent* cases, uniqueness ON then OFF | 9 notes | **ON → KILLED. OFF → exit 0.** Uniqueness is the only rule that sees this; it earns its place. |

### A mutant that survived, was diagnosed, and closed the rule that missed it

M-B6-3 originally **survived on the Go side**. My first base-dependence rule was
`strings.Contains(lower, "base-dependent")`, and the note it was moved onto reads
*"Not base-dependent — measured evil.com under both bases."* The substring
matched. The client-side marker test still killed the mutant, which is why the
round would have shipped green with a broken rule — a rule that only fires when
another test would have caught it anyway is not a rule.

Fixed with `noteDeclaresBaseDependence`, which strips `"not base-dependent"`
before looking, and extended to fire in **both** directions (a note that claims
base-dependence for an unmarked case is as wrong as a marked case that stays
silent). Both that mutant and its mirror are now negatives in the rule's own
control test. [MEASURED: `/tmp/r3/b6/go-move-marker.txt` before,
`/tmp/r3/b6/go2-move-marker.txt` after.]

This is the second time in this round that the count-neutral rule found a defect
in a fix written to satisfy the brief.

---

## Gates [MEASURED, this session, at `b06121f`, from the repo root]

| gate | exit | notes |
|---|---|---|
| `go build ./...` | 0 | run from `/workspace`, not `web/` |
| `go vet ./...` | 1 | exactly **4** `copies lock value`, `internal/server/server.go:1509,1619,1827,2004`. Control: `copylock` appears **0** times. Pre-existing, unchanged. |
| `go test ./...` | **0** | see brief-error #3 |
| `npm run build` (in `web/`) | 0 | |
| `npm test` (in `web/`) | 0 | `PASS: 4 test file(s), 315 assertions.` (was 3 files, no assertion count) |

`gofmt -l internal/server/` reports `scopes.go`. Not mine — untouched by this
branch, last modified in `381900a`. Not filed, not fixed.

`web/dist` is #100 and out of scope; not filed.

---

## Where this brief is wrong

Numbered, as required. Each one is measured.

**1. Two of B1's three "false statement" citations are out of range.** The brief
says correct `passthrough_url_test.go:265-268` and
`internal/platform/github/testing.go:39-41`. At `0bc9b72` those files are **215**
and **36** lines long [MEASURED]. The statements exist — the `buildRemoteData`
"no production caller" claim is at `passthrough_url_test.go:78`, and the "no
longer load-bearing" paragraph is at `testing.go:30-32` — but neither line range
does. I fixed the statements, not the lines. (`convert.go:334-336` and
`convert.go:341` are both exact.)

**2. B6's "four of the nine divergences" is wrong under every definition I could
construct.** I measured base-dependence by setting each fixture as the `href` of
a real anchor at two document bases:

| definition | count | which |
|---|---|---|
| divergent, and the note states a host that is base-dependent | **2** | `single slash host`, `opaque no slash` |
| divergent, and the resolved host differs between an http and an https base | **3** | + `empty` |
| any fixture whose resolved host differs between the two bases | **6** | + `javascript embedded DEL`, `absolute path`, `bare word` |

Never four. The audit's own §F-4 table has six rows of which four are marked
base-dependent — but two of those four, `https:/example.com` and
`https:example.com`, **are not in the fixture file at all** [MEASURED: the file
has `http:/example.com` and `http:example.com`, no `https:` variants]. The audit
recommended marking "the four affected fixtures" while its evidence table mixed
fixtures with its own extra probes; the brief relayed the number. I marked six,
under the third definition, and made the marker a measured fact so the next
person does not have to re-derive which definition was meant.

I also used the field name `base_dependent` rather than the audit's
`note_base_dependent`, because it is a property of the input, not of the note.

**3. The relayed `go test ./...` = 1 does not reproduce.** I measured exit **0**
on the full suite three separate times this session, and
`go test ./internal/server/ -run TestWatchTasks -count=5` exits 0 [MEASURED].
The brief's own correction #2 says to match the failing test *name* rather than
the count — good advice, and here there is no name to match because there is no
failure. Both the brief and the audit list this gate as red; on this machine it
is green. If a reviewer sees exit 1, the flake is real but it is not reliable
enough to be a baseline.

**4. B3's remedy is a third of the fix.** "Walk back accumulating brace depth,
stop at depth −1" is the right shape for the *scoping* half, and it is
incomplete twice over. (i) A backward walk alone gives you the block's start;
you also need a forward walk to its matching close, or the block runs to end of
file and the laundering comes back through a *later* sibling instead of an
earlier one. [MEASURED, `/tmp/r3/b6/backward-only.mjs`: with the bare method
first and the guarded method second, a backward-only depth walk yields an
11-line "block" running to EOF and the bare binding is still **ACCEPTED**;
control — the same walk with `safeHref` removed from the sibling — rejects.]
(ii) F-3(a), the prefix-match fail-open, is a
separate defect that brace depth does not touch at all — and it is the more
serious of the two, because `safeHref(url) ?? url` is a shape someone writes on
purpose. The brief bundles them under one remedy sentence.

**5. B5 understates the old check.** "Cannot notice a walk that only reached the
two inspector files" is true and too weak. Measured: with the walk crippled to
**three** files — the three allow-listed ones, so the rest of `web/src` is never
opened — the old assertion passes and `npm test` exits **0**. The check is not
merely insensitive to a partial walk; it is satisfied by a walk that reads only
the files it has already decided are fine.

**6. `Object.assign(el, {href: x})` is not "already house style in this tree."**
The three cited sites are real and the line numbers are right, but all three are
the same statement:

```ts
const alert = Object.assign(document.createElement('sl-alert'), {
  variant, closable: true, duration: 5000,
});
```

Zero URL-bearing properties at any of the three [MEASURED — full-tree grep:
those three are the *only* `Object.assign` call sites in `web/src` outside the
scanner's own fixtures]. What is house style is the
`Object.assign(createElement(...), {...})` idiom; the URL binding is still
hypothetical. That distinction is what F-2's severity was moved on, so it is
worth being exact about. I added the rule regardless — the idiom is there and a
`href:` key is a plausible next edit — but on the weaker of the two arguments.

**7. Path slip.** `ft-dependency-view.ts:1378` is
`web/src/components/dependency/ft-dependency-view.ts`, not
`web/src/components/`. Trivial, and the brief's own instruction ("do not take a
filesystem path from this brief") anticipates it.

**8. B1's implied e2e pin is not constructible on the path it names.** The brief
asks for a pin on `GetRemoteData()` on the passthrough path. On that path
`remote_data` is *always* `nil`, because `issueBuildRemoteData` writes a
`[]string` that `structpb.NewStruct` rejects and `convert.go` swallows the error
[MEASURED]. Any absence assertion written there would have been vacuous — green
for the wrong reason, which is this branch's signature failure. I pinned the
`nil` instead and wrote the scrub pins against `sanitizeRemoteData` and
`taskToProto` directly. Not a wrong instruction so much as one that could not
have been followed as written.

---

## Not fixed, deliberately

Per the brief: review R3 (`web/tsconfig.json` `"types"`), the scanner's long
tail beyond B4 (CSS `url()`, `unsafeStatic`, `<object data>`, `<img srcset>` —
the last two are now partially covered by B4's attribute list, but not as a
class), and the decode-boundary branded type (audit R-1, not started).
`web/dist` (#100) and `gofmt` on `scopes.go` are pre-existing and untouched.

Also not fixed, and newly filed here rather than acted on: the `[]string` in
`issueBuildRemoteData` that silently nils `remote_data` on the passthrough path.
It is a behaviour change and it belongs in its own commit.
