# #195 markdown-sanitize — round 7 cleanup (closing round 6, and correcting round 6's own log)

**Branch:** `markdown-sanitize` · **Base:** `86f30bc` · **Head:** `703c2de`
**Developer:** `dev-195-cleanup-7`
**Scope:** `web/src/util/markdown.test.ts`, `web/src/util/markdown.ts`. No other
files changed; `web/package.json` was read but not modified.

**Gate:** `npm test` exit **0** (**75 checks passed (122 assertions)**),
`npx tsc --noEmit` exit **0**, `npm run build` exit 0, `go build ./...` exit 0,
`go test ./...` exit 0. Every exit code read from the child process.

**No live vulnerability existed at any point in this round either.** All three
round-6 legs agreed on that and it is still true: both enumerated sinks are
correctly wrapped. Everything below is about whether the *guard* can falsify
what it claims to pin.

---

## Corrections to the round-6 log entry

Two claims in `markdown-sanitize-cleanup-r6.md` are wrong. They are corrected
here rather than edited in place, so the record shows both.

**1. The arity fix was NOT "closed from three sides."** The round-6 entry, line
42, says T1 was "Closed from three sides: `Function.length`, the declaration
text in `markdown.ts`, and `sinkArgumentIsSanitized` rejecting a top-level
comma." Round 6's review and test legs independently defeated two of those three
with one natural spelling, and the third never had the property claimed for it:

- `Function.length` **stops counting at the first defaulted parameter**, so
  `renderMarkdown(md, opts = {})` still reports 1. Green at 69/69.
- The declaration scan used `.exec`, which **returns the first match and stops**.
  An overload signature above the implementation satisfied it — and so did a
  mere *comment* quoting the old signature, because the scan read raw bytes
  rather than a comment-blanked view. Green at 69/69.
- `sinkArgumentIsSanitized` was and is real, but it guards the **sink files**,
  not the declaration.

So it was closed from *one* side, and that side was the weakest of the three.
The correct statement of what pins it now is in `markdown.ts` above
`renderMarkdown`, and it is narrower on purpose.

> **CORRECTED IN ROUND 8.** The paragraph that stood here said `.length === 1`
> covers *source/artifact divergence only*, because "every form that survives
> `tsc` leaves `.length` at 1 by definition". That was measured **false in both
> directions** and is retained struck-through rather than deleted, because two
> round-7 review legs falsified this same sentence in *opposite* ways and neither
> found the other's case.
>
> `Function.length` stops at the first **defaulted-or-rest** parameter, not at
> the first **optional** one. So `(...md: string[])` and `(md = '')` drive it
> **down to 0**, while `(md, opts?: T)` drives it **up to 2** — `tsc` erases `?`,
> emitting a real two-parameter function. Measured over all eleven
> `ARITY_EVASIONS` compiled and read back, three (C7-j, C7-k, C7-d) put `.length`
> off 1, so the assertion is a falsifier for three measured spellings, not zero.
>
> It is not the *reporter* for those three — the declaration scan runs first and
> throws. Its unique coverage, established by ablation in round 8: with the scan
> blinded and both arity tables emptied, `opts?: T` is caught by `.length === 1`
> and by nothing else, while `opts = {}` under the same ablation stays green.
> Source/artifact divergence plus a backstop for the UP direction.

Keeping it and saying so is worth more than keeping it and implying otherwise —
but the "saying so" has to be true, and in r7 it was not.

**2. Round 6 landed THREE production changes, not four.** The entry lists four
under its production heading. The fourth — "**URI policy pinned**" — is a
**test-only** change: the `ALLOW_UNKNOWN_PROTOCOLS` check, which at round-6 head
`86f30bc` sits at `web/src/util/markdown.test.ts:246-257` (the brief cited
253-259; verified by `git show 86f30bc:web/src/util/markdown.test.ts | grep -n`,
and it is at 298-309 after this round's insertions). No production line changed
for it. The three real production changes were: non-string input returning `''`,
`slot` added to `FORBID_ATTR`, and the `dompurify` range tightened
`^3.0.0` → `^3.4.12` (plus the lockfile refresh). This matters because "four
production changes" overstates the blast radius of a round whose value was
almost entirely in the guard.

---

## Blocking work

Every item below was **reproduced at `86f30bc` before being fixed**, with a
GREEN no-op control and a RED control passing first in the same batch. Specs and
raw results are out of repo at
`/scion-volumes/scratchpad/projects/farmtable/salvage/r7-dev-195/`.

**W1 — the arity pin, closed from the side that was actually open.** Commit
`538ce54`. The scan now uses `matchAll`, requires **exactly one** matching
declaration, reads a comment-and-string-blanked view, and counts **top-level**
parameters via `splitTopLevelParameters`. Made *fixturable* — a predicate over
text rather than a fixed path — because "a fixture that cannot express the
input" is this round's named defect class. `ARITY_EVASIONS` (11) and
`ARITY_LEGITIMATE` (6) are asserted in one check so positives and
false-positive controls move together.
*Established by:* `spec-w1.json` — C7-e2, C7-g, C7-h all RED, each naming the
arity rule; all six `ARITY_LEGITIMATE` spellings GREEN.

> **A hole in the brief's suggested fix, closed.** Counting top-level commas
> alone would newly *accept* a destructured sole parameter
> `({ md, inline }: …)` — one top-level parameter, still a configuration
> channel, and it hides its comma from `sinkArgumentIsSanitized`. A
> plain-identifier requirement was added.
>
> **A known false positive, kept deliberately.** C7-k (a default on the sole
> parameter) is rejected. The remedy is in the message. A narrower true claim
> over a silent inconsistency.

**W2 — `stripImportStatements` must treat `import` as a statement keyword.**
Commit `c98eb79`. F1's round-6 fix missed `import.meta`, which is one of three
grammatical productions of the token. `\bimport\b(?!\s*\.)` now excludes it.
Both halves the brief required were added: an `INDIRECTION_EVASIONS` positive
*and* a `LEGITIMATE_SOURCE` false-positive control.
*Established by:* `spec-w2.json`, 8 cases, 0 unexpected.

**W3 — the guard's SCOPE pinned independently, and R7 promoted tree-wide.**
Commit `7e758b6`. `EXPECTED_CHECKS` derives from `REQUIRED_SINKS.length`, so a
scope *shrink* moved both terms of the derivation and cancelled. Per the brief,
the derivation is kept and `EXPECTED_REQUIRED_SINKS = 2` is asserted **inside
the existing `sink scan actually reads the source tree` check** — no new
`check()` call site. The `check total pinned` message was corrected: its old
wording ("the total moves on its own and nothing here needs editing") was true
and read as reassurance, and is the reason the shrink was invisible.
*Established by:* `spec-w3.json`. C2-e (GREEN at 68 on `86f30bc`) now RED.
Attribution split two ways: `C2-e-scope-only` RED via the new scope pin,
`C2-e-escape-only` RED via R7.

R7 was promoted tree-wide because it was **the only per-file rule the shrink
removed that the tree-wide half did not already carry** — `C2-e-nonsink` (an
escaped alias in a non-sink file) is RED only because of the promotion, which
is what earns its line count. The `strings: true` view was **measured, not
asserted**: `ABL-r7-view` runs the promoted rule over the strings-kept view and
goes RED on `markdown.ts`'s own deliberate `\uFE0E` escape.

**W4 — fixture tables must fail closed.** Commit `7f382f0`. Every table was
emptyable with the suite green, because an emptied loop body simply stops
running and the check total does not move. `fixtureTableViolation` pins each
table's exact length (measured, not guessed — an earlier comma-counting script
mis-measured and was replaced by a probe run through the real suite). The
brief's preferred fix, the **quantifier inversion** in the raw-HTML sink
fixture, is in: the check now ranges over `BANNED_SINKS` and requires each
*pattern* to be exercised by some positive, rather than ranging over the
fixtures.
*Established by:* `spec-w4.json`, 14 cases. Every table emptied individually →
RED. `INVERT-1` (a 9th pattern no positive exercises) → RED; `INVERT-CTRL` (the
same pattern *with* a positive) → GREEN, which is what keeps the inversion from
degenerating into "no new patterns allowed."

**W5 — the non-string guard's rationale corrected, not the code.** Commit
`538ce54`. The comment claimed a live outage; neither call site can reach it —
`ft-inspector-comments.ts` passes `c.body`, already coerced by `stringField()`
at `gen/grpc-client.ts:660-662`, and `ft-inspector-desc.ts` passes
`this.description` below an `if (!this.description)` early return at
`ft-inspector-desc.ts:209`. Rewritten as defence in depth for a future third
caller, with the trade-off on the record: a future caller passing `42` gets a
blank field rather than a throw, which is harder to diagnose.

---

## Recommendations taken

**T-4 — assertion total pinned.** Commit `a162865`. `EXPECTED_ASSERTIONS = 122`,
bumped by each `assert*` helper, reported only when nothing else failed.
*Chose exact over the brief's suggested floor*, with the reasoning in the code: a
floor is satisfied by adding two assertions somewhere new and deleting two
somewhere load-bearing, which is the failure `EXPECTED_SOURCE_FILES` was already
converted from a floor to catch.
*Established by:* `spec-t4.json`, 6 cases. Hollowing out a check body (green at
69 before this) is RED.

**T-5 — arity docblock corrected.** Commit `538ce54`. See correction 1 above.

**T-7 / audit LOW-1 — `SANITIZE_DOM: false`.** Commit `6ddc93b`. The last
DOMPurify-config axis with no red-on-revert now has one, via a behavioural check
rendering clobbering `id`/`name` attributes.
*Established by:* `spec-t7.json`, 3 cases.

**T-8 — the private `Marked` instance.** Commit `6ddc93b`. The **first check in
this file that observes an effect rather than a name**: it installs a hostile
checkbox renderer on the shared `marked` singleton, **asserts the poisoning took
effect first** (positive control, inline), then asserts `renderMarkdown`'s output
is unaffected.
*Established by:* `spec-t8.json`. Swapping `new Marked({…})` for `marked.use({…})`
was GREEN at 69; it is now RED, and RED only there.

**Audit LOW-2 — `web/index.html` brought into the scanned set.** Commit
`8ffe01f`. Read by explicit path via `EXTRA_SCANNED_FILES` with a `statSync`
first, so a delete or rename throws rather than silently shortening the list.
*Established by:* `spec-low2.json` — `innerHTML`, `document.write` and a
`\u`-escaped identifier injected into its inline `<script>` are each RED naming
the relevant tripwire; the file as it ships and a benign edit to the same block
are GREEN. Deletion measured by hand (`mv index.html /tmp && npm test`) → exit 1,
`ENOENT`. Attribution: `spec-low2b.json/ABL-low2-innerHTML` — with
`EXTRA_SCANNED_FILES` emptied, the same injection is GREEN.

**Review O1 — arity scan false positives.** Closed by W1. All four spellings the
review named, prettier's default multi-line trailing comma included, are in
`ARITY_LEGITIMATE` and asserted to produce no violation.

**Review O2 — the post-T3 tripwire message.** Commit `476e956`. Three of the
rule's four branches reported a file and no position; the pattern can span
lines, so `matchLines` does not apply and a new `lineOf(code, index)` does. The
message now states the accepted shape and two routes forward (add the FILE to
`REQUIRED_SINKS` for a legitimate sink; use a comment or string for prose, both
blanked), and keeps the TRIPWIRE-NOT-PROOF caveat.
*Pinned, not just fixed:* the `INDIRECTION_EVASIONS` fixture now requires
`rel:line:` on **every** offender.
*Established by:* `spec-o23.json` — `O2-revert-lineno` RED; `O2-ablate-pin`
(same revert, assertion neutered) GREEN, proving the pin is what catches it.

**Review O3 — the sunset clause fired on nothing.** Commit `476e956`. It now has
an observable trigger: #204 is a typescript-eslint rule and cannot be enforcing
without typescript-eslint being declared in `web/package.json`. Deliberately the
**weaker direction** — it fires on the tooling appearing, not on the rule being
enforced, so a human confirms CI before deleting anything. The message names
what to delete and what to keep.
*Established by:* `spec-o23.json` — declaring `typescript-eslint` is RED; adding
an unrelated devDependency (`prettier`) stays GREEN.

**T-6 — the `^3.4.12` floor. The brief asked me to log this as uncovered; I
disagreed and covered it, narrowly.** Commit `476e956`. Round 6 concluded it
"has no red-on-revert and cannot get one in this suite." The first half is
right — the suite cannot observe a downgrade *behaviourally*, because the
behavioural checks pass against older DOMPurify too. The second half is not:
the **declared range** is in a file this suite already reads. So it now has a
pin whose docblock states exactly how narrow it is — it reads `package.json`,
not the lockfile and not `node_modules`, so a lockfile pinned below the floor
still passes.
*Established by:* `spec-o23.json` — loosening to `^3.0.0` RED; raising to
`^3.9.0` also RED, which is what confirms the rule reads the *value* rather than
merely checking the key exists.

**Audit INFO-2 — recorded, not fixed.** Commit `703c2de`. Measured, and narrower
than the audit's summary in both directions: after a sticky
`DOMPurify.setConfig({ FORBID_TAGS: [], FORBID_ATTR: [] })`, `renderMarkdown`
returns `<h1>hi <form><input></form></h1>` where it otherwise returns
`<h1>hi </h1>` — so the whole form-control and overlay policy is defeatable by
any module reaching the singleton. But **`<script>` is still stripped** in that
state (measured: returns `''`), so this is a policy bypass, not a
script-execution bypass. And nothing can reach the singleton today, because
R8/R9 deny every file but `markdown.ts` the ability to name `dompurify`.
**Deliberately not fixed:** `DOMPurify(window)` would close it the way
`new Marked({…})` closes the `marked` half, but it moves a `window` dependency
to module-load time in the security-critical path, to close an INFO finding with
the ownership guard already standing. Flagged for a follow-up round.

---

## Costly disclosure — my own errors this round

- **My mutation driver scored aborted cases as passes.** An `ANCHOR-ABORT` case
  dropped its `expect` field, so a case that *never ran at all* reported "0
  unexpected". It did so silently in a real run before I caught it. Fixed. This
  is the same "cannot falsify" shape as everything this round is filing, in the
  instrument doing the filing.
- **I reported a finding from a case that measured nothing.** `LOW2-delete` was
  written as a no-op substitution (`find` and `replace` identical) because the
  driver could only substitute, and I read its GREEN as a result before
  rechecking. The driver now supports whole-file creation and the deletion claim
  was measured by hand.
- **I read an exit code through a pipe.** `npm test | tail` reported `EXIT=0` on
  a failing run — standing bar 5, walked straight into, caught and re-measured.
- **A comment I wrote was refuted by the mutation written to confirm it.** I
  claimed `index.html` was invisible "twice over" and that fixing either half
  alone left it unscanned. `EXTRA_SCANNED_FILES` reads by explicit path and
  bypasses the extension filter entirely, so putting `.html` back on the inert
  list leaves `index.html` fully scanned — the halves are independent, not
  conjunctive. Rather than drop the extension change or keep a false comment, I
  measured what it *is* for: a `.html` under `src/`, of which there are none
  today. Created one with an inline `innerHTML` sink — RED with `.html` off the
  list, GREEN with it on, and GREEN **with no file-count signal either**,
  because the filter runs before `files` is built. That is the "no signal of any
  kind" case the denylist comment already describes, reproduced.
- **`mut.py` named the wrong rule.** `^\s+- ([^:]+):` truncated check names that
  contain a colon (`tripwire: no file reaches …` → `tripwire`), so two different
  rules reported the same name and standing bar 6 was not actually being met in
  earlier batches. Fixed before the W2 batch.
- Two harness errors produced false reproduction failures (`ABL-r7-view`
  compiled-error rather than demonstrating a false positive; a Python edit script
  aborting partway on a bad assertion so its earlier edits were never written).
  Both were my errors, not defects, and both were re-run to a real result.

## Residue — stated, not closed

- **`ABL-scope-callsite` is GREEN and nothing can see it.** Keep
  `requiredSinkScopeViolation` but drop it from the check body and no rule
  fires — `EXPECTED_CHECKS` does not move because no `check()` was removed. A
  fixture catches a *neutered predicate*, not a *deleted call site*.
- **The assertion pin covers behavioural checks only.** Rule fixtures throw
  directly rather than through `assert*`; they are covered by the table-size
  pins instead. Different mechanism, same defect.
- **T-6's pin does not reach the installed artifact.** `package.json` only.
- **The scanned set is still "`src/` plus a hand-maintained list."** Anything
  shipped from `public/`, from a Vite plugin, or from a second HTML entry point
  is outside it until someone adds it to `EXTRA_SCANNED_FILES`.
- **Mechanism (b) remains a tripwire, not proof.** Unchanged, and the sunset
  clause now says when to delete it.

## Not done, deliberately

M1 (allow-list inversion), CSP / Trusted Types, GitHub #204, V25 and the
V25-rationale survivor, and `govulncheck` were all out of scope per the brief
and were not started. **CI was not touched** — the audit is right that `npm test`
in CI is worth more than further hardening, and it is explicitly routed
elsewhere. The DOMPurify private-instance change (INFO-2) is the one item I
would nominate for a next round.

## Pinned constants at head

`EXPECTED_CHECK_CALL_SITES = 74` · `EXPECTED_CHECKS = 75` ·
`EXPECTED_ASSERTIONS = 122` · `EXPECTED_SOURCE_FILES = 51` ·
`EXPECTED_REQUIRED_SINKS = 2`
