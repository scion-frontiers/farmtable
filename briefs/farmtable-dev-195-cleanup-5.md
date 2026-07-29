# #195 `markdown-sanitize` round 6 — three-leg findings, merged

**Your clone:** `/workspace/farmtable-markdown-sanitize`, branch
`markdown-sanitize`, at `53296af`, clean. All three review legs are finished and
nobody is pinned to that SHA any more, so you commit directly on the branch. No
rebase, no separate worktree.

Round 5's three-way came back **APPROVE / REQUEST CHANGES / REQUEST CHANGES**.
The security audit found **no XSS**: 69 vectors plus 10 mXSS vectors, zero routes
to script execution, all 10 round-trip stable, DOMPurify at the latest release
with a clean `npm audit` across 154 packages. **`markdown.ts` itself was approved
by the code-review leg as-is.** Everything blocking below is in the guard, plus
four small production items I am folding in because they are one or two lines
each and this is the sanitizer branch.

Two legs were asked independently whether my amended criterion had been defined
down to fit its solution. Both said no, and both gave the same reason without
having read each other: **a criterion narrowed to fit its solution cannot fail
that solution, and this one was falsified this round on its own named axes.**
Keep that in mind while you work — the criterion is doing its job, and your fixes
should keep it falsifiable rather than make it comfortable.

---

## BLOCKING

### T1 — HIGH — `renderMarkdown`'s arity is unconstrained and unreachable by any test

`markdown.test.ts:965` (`sinkArgumentIsSanitized`), `markdown.ts:66`.

`sinkArgumentIsSanitized` claims the `unsafeHTML` argument is "a single
`renderMarkdown(…)` call and NOTHING else" — but it only balances parentheses.
It places **no constraint on what is between them**, so
`renderMarkdown(this.description)` and
`renderMarkdown(this.description, { inline: true })` are indistinguishable to it.
Separately, all ~40 behavioural checks call `renderMarkdown` with exactly one
argument, so **no fixture in the suite can express a two-argument call.**

Those two facts together admit an ordinary-looking feature — "render inline
markdown for one-line fields" — that reopens the entire bug class. Verified by
execution through the compiled sanitizer under the suite's own jsdom bootstrap:

```
### mutation applied: G3-arity-inline
safe  renderMarkdown(XSS)                    [1 arg, the only shape tested]
        "<p><img src=\"x\"></p>\n"
RAW   renderMarkdown(XSS, { inline: true })  [2 args, unreachable by any fixture]
        "<img src=x onerror=alert(1)><script>alert(2)</script>"
### suite: 61 checks passed, exit 0
### tsc --noEmit: exit 0
```

An isolating control (extra argument at the sink only, `markdown.ts` untouched)
is also green, which pins the guard half independently of the production half.

**Why five rounds missed it, and this is the part worth internalising.** Every
one of V1–V25 mutates a *binding*, a *call-site spelling*, or a *module
specifier*. **Not one changes an arity.** A fixture that cannot express a
two-argument call cannot be mutated into failing on one. This was reachable only
by asking *"what inputs can these tests not express?"* — never by asking *"what
mutation survives?"*. For `renderMarkdown` the collection whose cardinality
matters is **the argument list**, and the suite tests cardinality one and nothing
else: not two (T1), not zero (T7 below).

**It is in scope, not a scope quibble.** It lands on two of the amended claim's
seven named axes: *argument-shape drift*, and *capture of the sanitizer's own
configuration* — a second parameter **is** a configuration channel into the
sanitizer, opened from the sink file. R8 was built to deny other files the
ability to reconfigure DOMPurify by taking away the module specifier; an options
parameter reconfigures it through the front door and R8 has nothing to match.

**Fix (both halves, they are independent):**
1. Pin the arity behaviourally — `renderMarkdown.length === 1` is a one-line
   check that turns any new parameter red.
2. In `sinkArgumentIsSanitized`, require the inner call to contain **no
   top-level comma**. That closes the sink half without an enumeration treadmill.

Add the two-argument case to the Phase 2 harness acceptance vectors as well — I
am tracking that; you do not have to build it.

### F1 — `stripImportStatements` sweeps real code across statement boundaries

`markdown.test.ts:909-922`. The docblock claims "`[^;]` cannot cross a statement
boundary." **`[^;]` matches newlines.** An import lacking its terminating
semicolon extends forward to the next `from '…';`, blanking everything in
between — **including a value alias.**

```
C0 all semicolons + alias     (want CAUGHT)   (a) CAUGHT  (b) CAUGHT
C1 no semicolons + alias      (want CAUGHT)   (a) MISSED  (b) MISSED   <-- FALSE NEGATIVE
C2 import no semi, alias semi (want CAUGHT)   (a) CAUGHT  (b) CAUGHT
C4 all semicolons, no alias   (want CLEAN)    (a) MISSED  (b) MISSED
C5 no semicolons, no alias    (want CLEAN)    (a) CAUGHT  (b) CAUGHT   <-- FALSE POSITIVE
```

C1 is **V3** — the evasion the docblock calls "the rule that generalises" —
defeated by deleting two semicolons. It defeats mechanism (a), the half round 5
declares **sound**, and mechanism (b), simultaneously.

C5 is the mirror and is arguably worse for the guard's survival: a **correct**
semicolon-less sink file is **rejected** with a message accusing it of aliasing.
Line 722 of your own file warns that *a guard that rejects correct code gets
deleted.*

**You already diagnosed this exact defect and fixed it elsewhere.** Line 1306
records it for the re-export regex — "`[^;]` matches newlines, so an adjacent
semicolon-less line used to be swept in" — and line 1307 applies `[^;\n]`. It was
never carried back to `stripImportStatements`, which feeds R3, R4 and the
tree-wide non-called-position rule.

Validated fix, verified on all seven cases including multi-line imports,
side-effect imports and the same-line-alias the docblock cites:

```ts
function stripImportStatements(code: string): string {
  const wipe = (m: string): string => m.replace(/[^\n]/g, ' ');
  return code
    // `[^;'"]` cannot cross a specifier, so one import can never swallow the next;
    // `;?` makes the terminator optional so an ASI-style import is still blanked.
    .replace(/\bimport\b[^;'"]*?\bfrom\b\s*(['"])[^'"]*\1\s*;?/g, wipe)
    .replace(/\bimport\s*(['"])[^'"]*\1\s*;?/g, wipe);
}
```

Add the case to `SINK_EVASIONS` as V10 so it is pinned, and correct the docblock:
the property is **"one import statement cannot swallow the next"**, not "`[^;]`
cannot cross a statement boundary."

### F2 + T4a — the whole `BANNED_SINKS` list can be emptied with the suite green

**Two legs found this independently.** `markdown.test.ts:1035-1047`.

```
[M1 neuter innerHTML sink pattern]     exit=0 :: 61 checks passed
[M2 delete insertAdjacentHTML entry]   exit=0 :: 61 checks passed
[M3 empty the whole BANNED_SINKS list] exit=0 :: 61 checks passed
```

The only fixtures touching `BANNED_SINKS` are `LEGITIMATE_SOURCE` and
`INERT_PROSE`, both **negative** controls. There is no positive table, so all
eight patterns are untested detection logic. The other leg's ablation
independently confirms the tripwire is *live but unfixtured*:
`MX-innerhtml` red, `MX-innerhtml+BANNED` green.

This is the vacuity class **your own file diagnoses three times** (1571-1573,
1840-1845, 383-387) and fixed everywhere else. `directiveIndirectionOffenders`
got `INDIRECTION_EVASIONS`; `sinkBindingViolations` got `SINK_EVASIONS`; R8/R9 got
`OWNERSHIP_EVASIONS`. `BANNED_SINKS` got nothing.

Fix: a `BANNED_SINK_POSITIVES` table plus one `check()`, mirroring
`OWNERSHIP_EVASIONS`. Concrete table in `reports/review-195-r5.md`.

### T2 — an unterminated `<!--` in a lit template blinds the tree-wide scan to EOF

`markdown.test.ts:827-833`. `const to = end === -1 ? src.length : end + 3;`
blanks to end of file, so in a non-sink scanned component R8, R9, the indirection
tripwire and `BANNED_SINKS` all see spaces.

The bar-3 self-check passed, so this is a **blind spot, not an inexpressible
input**: the same `el.innerHTML = body` write with the comment removed is caught,
and a *position* control — byte-identical write moved to **before** the comment —
is also caught.

**Worse than V14** (the unterminated `/*` already in the table): an unterminated
block comment is a TypeScript syntax error, so `tsc` catches it. An unterminated
`<!--` inside a template literal is **valid TypeScript and compiles clean.**
There is no second gate.

Fix, one line: treat an unterminated `<!--` as a **violation**, the way an
unterminated regex literal already returns `-1`.

### T3 — `IGNORE_MARKER` disarms the only rule protecting 48 of the 50 scanned files

`markdown.test.ts:889-906`. The docblock argues the marker is safe because it is
"deliberately NOT honoured by the per-file rules in `sinkBindingViolations`."
**That is true only for the two `REQUIRED_SINKS` files.** Mechanism (a) does not
run on the other 48 at all, so for them the tripwire **is** the whole guard — and
the tripwire honours the marker. Verified: two marker comments in
`inspector-shared-styles.ts` launder `unsafeHTML` into a `REQUIRED_SINKS` file
with every rule R1–R9 passing and `tsc` clean.

R6 is satisfied because the laundering file **does** resolve into the scanned set
— it is scanned, it is simply not *sounded*.

This is disclosed V7 **moved one file to the left**. V7 put the marker inside a
`REQUIRED_SINKS` file, where mechanism (a) caught it, and the prior art concluded
the marker was contained. **That conclusion is scoped to two files and the
docblock does not say so.** This is the workstream's signature defect — a
property that holds for one consumer, stated as if it held for all.

Fix: either honour `IGNORE_MARKER` nowhere, or say plainly in the docblock that
it disarms the tripwire for the 48 non-`REQUIRED_SINKS` files and that those
files are covered by review only. I lean to the first; your call, but if you pick
the second the docblock must say it in those words.

### T4b — the "cannot quietly reopen one" claim is false for the tree-wide checks

`markdown.test.ts:1576` claims the fixture tables mean "a future simplification
of the rules cannot quietly reopen one." **True for the nine closed-world rules,
false for four tree-wide checks and string blanking.** Ablation, by execution:

| check | deletion detected? | unique coverage? |
|---|---|---|
| R1 (required sink literal) | no | **no** — fully subsumed |
| R3 (local re-bind) | no | **no** — redundancy already documented at 1111 |
| tree arg-check (`:1536`) | no | **no** — fully subsumed |
| file-count pin (`:1441`) | no | yes — live, unfixtured |
| sink-count pin (`:1508`) | no | yes — live, unfixtured |
| `BANNED_SINKS` tripwire (`:1549`) | no | yes — live, unfixtured (= F2) |
| string blanking (`:865`) | no | yes — live, unfixtured |

`MX-sinkgone+R1+SINKCOUNT` is green, so neither R1 nor the sink-count pin is
individually load-bearing. And `opts.strings` blanking is genuinely protective —
ablating it turns `export const MSG = 'always call renderMarkdown before
unsafeHTML';` in a sink file red — yet **nothing in the suite exercises it**,
because neither production sink nor `SOUND_SINK_FILE` contains a string literal
naming either identifier.

Fix: **narrow the claim**, or give the tree-wide checks the same treatment R8
got — a four-entry table (`file-count changed`, `extra sink`, `banned pattern
present`, `string naming the identifier`) asserted against the predicates
directly. Same two-lines-per-entry pattern already in the file. Do **not** delete
the redundant rules; defence in depth is fine, an unbounded claim is not.

### C1 — restate the amended criterion in artifact terms, not intent terms

This one is mine to answer and I accept the correction. "Innocent-looking
regression" is a property of the author's **intent**, not of the artifact. It is
not decidable from a diff, which means it cannot adjudicate a future dispute —
the only job an exit criterion has. Concretely: is `const raw = unsafeHTML`
innocent-looking? Nobody writes that by accident either. Under the intent
wording, someone could argue F1 away as adversarial because it omits semicolons.

Replace with the reviewer's wording, which has the same coverage and is decidable
by reading a diff:

> For the two enumerated sink files, any change that leaves a raw-HTML directive
> reachable **under a different name or through a different call shape**, where
> that change is **visible in the scanned source view** (comments and string
> literals blanked, templates and regex literals resolved), must turn the suite
> red. Changes that preserve every name and call shape while altering runtime
> **effect** — prototype patching, global reconfiguration, runtime-assembled
> references — are out of scope and routed to the Phase 2 harness.

This makes "rules can own a NAME, they cannot own an EFFECT" the operative clause
rather than a footnote, and it makes F1 unambiguously a violation.

Two related corrections in the same docblock:
- **"capture of the sanitizer's own configuration" overclaims.** R8 defends
  capture only *by naming a module specifier the scanner can see*. It does not
  defend a bare specifier (R-bareSpecifier) or capture by effect (V25). Qualify
  it — and note T1 is a third way it does not hold.
- One leg pushed back usefully on the boundary statement itself: **T1 is inside
  the technique's stated reach, not beyond it.** R5 does not fail to own an
  *effect* there; it fails to own a *shape* it explicitly claims to own, since
  `sinkArgumentIsSanitized`'s own docstring says "the argument has to be the call
  and only the call" and an argument list is part of a call. Do not let the
  NAME/EFFECT boundary absorb T1.

### T7 — `renderMarkdown` throws on non-string input, taking down the whole component

```
THROW undefined -> marked(): input parameter is undefined or null
THROW null      -> marked(): input parameter is undefined or null
THROW number    -> marked(): input parameter is of type [object Number], string expected
```

Both sinks pass values that arrive over gRPC (`c.body`, `this.description`). A
throw inside `render()` takes down the **whole Lit component**, not one comment.
Availability, not XSS. One-line guard plus one-line test. The suite tests `''`
but never absent — cardinality zero on the input domain, the same axis as T1.

### Four cheap production items from the audit — take all four

1. **Add `'slot'` to `FORBID_ATTR`.** Not exploitable today — slot assignment
   considers only direct children of the host and the markdown lands two levels
   deeper inside `<sl-details>` — but exploitable the moment anyone flattens that
   nesting. One word, zero collateral (markdown never emits it), and it converts
   a nesting-dependent invariant into an unconditional one. This is exactly the
   argument the file already makes for `class`.
2. **Pin the URI policy.** The guard does not catch `ALLOW_UNKNOWN_PROTOCOLS:
   true`, which really does change behaviour — `<a href="evilproto:payload">`
   survives. Not XSS (`javascript:`, `vbscript:`, `data:` stay blocked), so the
   exposure is exotic scheme handlers. One check:
   ```ts
   check('unknown URL schemes are dropped', () => {
     assertNotContains(renderMarkdown('<a href="evilproto:payload">x</a>'), 'evilproto:',
       'unknown protocol survived — has ALLOW_UNKNOWN_PROTOCOLS been enabled?');
   });
   ```
3. **Tighten `"dompurify": "^3.0.0"` to `"^3.4.12"`** in `web/package.json`. The
   lockfile pins 3.4.12 and `npm ci` makes the artefact deterministic, but the
   declared range would accept 3.0.0, which has known bypasses.
4. **Pin `action`, and correct the disclosure at `markdown.test.ts:124-130`.**
   The disclosure says both `formaction` and `action` are untestable in
   isolation. Measured, that is **half wrong**: DOMPurify applies `ALLOWED_ATTR`
   per-attribute, not per-tag-and-attribute, and `action` is in its default
   allowlist, so `<div action="…">` survives and `action` **is** testable. Add the
   check. `formaction` genuinely is not testable — that half of the disclosure is
   exactly right. Security impact today is nil; the value is that
   `FORBID_ATTR`'s stated design property, *"neither rule is load-bearing on its
   own"*, currently has no test on the attribute side.

---

## NOT this round — do not do these

- **The allow-list inversion (audit M1).** Measured: 157 tags permitted, markdown
  emits 22, 138 excess including all of SVG and MathML; and 36 of 46 blocked
  vectors were blocked by DOMPurify's **defaults**, only 10 by the reviewed
  config. It is the right change and it is tracked — but it is a substantial
  production rewrite of the XSS boundary and it needs its own review round. The
  auditor explicitly did not block on it.
- **CSP / Trusted Types** (audit L3, and the compensating controls my amended
  claim leans on, which do not exist yet). Tracked separately.
- **The remaining surviving attributes** — `id`, `name`, `align`, `width`,
  `height`, `hidden`, `popover`, `draggable`, `tabindex`. Subsumed by M1, and
  adding them one at a time is precisely the enumerate-the-bad treadmill M1
  argues against.
- **#204**, the typescript-eslint AST rule.
- **T6** (the private `Marked` instance has no test) — take it only if it is
  genuinely one line; R8 contains the hazard statically so it is not live.
- **Deleting R1, R3 or the tree arg-check.** They are redundant, not harmful.

One thing I *do* want from C2, because it costs a comment and prevents a round 7:
**mark the tokenizer-dependent subset for sunset conditional on #204.** Right now
the docblock argues #204 is the correct technique but nothing schedules the
removal of what it replaces, and a 1425-line guard with no sunset clause becomes
permanent. Name the functions and rules #204 retires —
`stripInertText`/`stripImportStatements` and everything depending on them: R3,
R4, R7, `directiveIndirectionOffenders`, `BANNED_SINKS`. Keep the behavioural half
(lines 1-517) unconditionally; it is the highest value-per-line in the change and
pins the actual XSS boundary.

---

## Standing bars — these apply to your method

1. **Measure, do not assert.** Label every claim **BY EXECUTION** or **REASONED**.
2. **"Clean" is not "unchanged."** You lost a full set of verified edits last
   round to a restore that passed *correctly*, because a tree-cleanliness check
   measures agreement with HEAD and is structurally blind to work never in HEAD.
   **Commit before running any mutation driver; refresh backups immediately after
   every commit.** Both review legs also asserted **sha256 against an out-of-repo
   pristine copy** on top of `git status --porcelain` — adopt that.
3. **Content-addressed mutations only.** Abort if the anchor does not occur
   exactly once. Back up outside the repo.
4. **A harness that cannot express an input cannot test it — and that is where
   T1 came from.** Prove your harness can express the state change before you
   trust a negative, with a self-check that fails closed. Both legs did this and
   both reported it working: one deliberately broke `EXPECTED_CHECKS` before every
   run; the other's first three-path harness returned 42/69 INCONCLUSIVE and it
   treated that as the instrument working, not as a pass.
5. **Verify that a green mutation actually weakens the thing before filing it.**
   The audit found `ADD_ATTR: ['style']` is a genuine **security no-op** because
   `FORBID_ATTR` wins, so green was the *correct* answer — filing it would have
   been a false finding. Apply the same test to your own fixes.
6. **Capture exit codes from the child process, never through a pipe.**
7. **Costly disclosure is the signal we trust here.** Every leg this round
   disclosed something against itself: one reported that its first mutation run
   was red *for the wrong reason* and would have supported the opposite
   conclusion; one recorded a prediction it got wrong; one reported its own
   scratch-file hygiene failure. Lead with anything like that.

## Deliverables

1. All blocking items above, committed on `markdown-sanitize`.
2. `EXPECTED_CHECKS` and the arithmetic comment at `:1929` updated. Strongly
   consider the reviewer's suggestion of putting the arithmetic in code —
   `EXPECTED_CHECKS = EXPECTED_CHECK_CALL_SITES + (REQUIRED_SINKS.length - 1)` —
   which removes one of the three edits a new sink currently costs and removes
   the prose-drift risk entirely.
3. Also fix the misleading third failure message: adding a third sink currently
   ends with "a check was added or silently removed" when nothing of the kind
   happened — the `REQUIRED_SINKS` loop simply emitted one more.
4. Drop the load-bearing literal `61` from the V25 disclosure at `:1382`; say
   "the suite stays green" and keep the count only next to `EXPECTED_CHECKS`.
5. Full gate: `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run build` —
   each exit code captured from the child. Report the new check total.
6. **A project log entry** in `.design/project-log/`. Required, not optional.
7. Report the commit SHA, the gate results, what you fixed, and **where you
   disagreed with this brief or with a leg's finding.** Disagreement is welcome
   and has been right before on this workstream.

Prior art you should read rather than rediscover:
`reports/review-195-r5.md`, `reports/test-195-r5.md`, `reports/audit-195-r5.md`,
and the salvaged harnesses under `salvage/test-195-r5/`,
`salvage/review-195-r5/`, `salvage/audit-195-r5-*`.

**Do not push.** You MUST commit the work, write the project log entry, and then
mark the task complete.
