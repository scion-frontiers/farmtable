# #195 markdown-sanitize — round 7

You are `dev-195-cleanup-7`. Your workspace is mounted at `/workspace`. Branch
`markdown-sanitize`, based on `86f30bcdc699367681ccffbc4fde1e40006fd754`.
Verify with `git rev-parse HEAD` before touching anything. If it does not match,
stop and tell me.

## Where round 6 landed

Three independent legs. **Code review: REQUEST CHANGES. Security audit: APPROVE
(0C/0H/0M/2L/3I). Test review: REQUEST CHANGES (1 High, 2 Medium).**

**There is no live vulnerability.** All three legs agree on that, and the audit
established it the expensive way — a positive control with two detectors against
a deliberately unsanitized module (`vectors=78 allowed=70 denied=8`, **28 real
`alert(1)` firings**), then the same battery at head (`allowed=26 denied=52`,
**zero canary firings**). Both real sinks are correctly wrapped. Nothing in this
round changes that.

Everything below is about whether the **guard** can still falsify what it claims
to pin. Read all three reports in full before you start:

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r6.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r6.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r6.md`

## Read this part twice

Round 6's headline fix was the arity pin — closing T1 from three sides. Your
predecessor **pushed back on my briefed one-liner** (`renderMarkdown.length === 1`)
because `Function.length` stops counting at the first defaulted parameter, and
they were right; the test leg re-measured it and upheld them
(`A21` + `(md, opts = {})` is GREEN). That was good work and the credit stands.

The security audit then tested three spellings — `(md, opts?)`, `(md, opts = {})`,
`(md, ...rest)` — found all three RED, and concluded in writing that the arity fix
is **"genuinely pinned from three sides."**

**Both other legs independently broke it.** The code review found that a
TypeScript overload signature defeats it; the test review found the same thing
plus two cheaper ones, and measured all of them:

```
C7-e2  two overload signatures + defaulted impl   GREEN, 69 checks, tsc 0
C7-g   a COMMENT naming the old signature         GREEN, 69 checks, tsc 0
C7-h   a string literal naming the old signature  GREEN, 69 checks, tsc 0
```

`C7-g` needs no overloads at all:

```ts
// Historical signature, kept for the changelog:
//   export function renderMarkdown(md: string): string
export function renderMarkdown(md: string, opts: Record<string, unknown> = {}): string {
```

Now hold those two facts together. `Function.length` stops at the first defaulted
parameter — so the developer replaced it with a regex that **stops at the first
match**. The audit's mutation battery could not express the overload spelling, so
it returned a clean table and an overgeneralized conclusion. Three layers, one
error:

> **A check that derives from the thing it is checking cannot falsify it** — and
> its close cousin, **a fixture that cannot express the input.**

This is the sixth and seventh instance on this branch. I have made this exact
mistake twice myself this week: a fact true of the inputs in front of me, written
down as a fact about the mechanism. The audit's sentence is not *false* — it is
true of the three inputs it tried. It is only wrong as a claim about the
mechanism.

So: **when you write a pin, ask what input would falsify it, then ask whether
your fixture can even construct that input.** If it can't, the pin is decorative
and you should say so in the log rather than count it.

There is a third instance in this same round, one level up: the remedy for F2
(`BANNED_SINKS` was emptyable with the suite green) was `BANNED_SINK_POSITIVES`
— **a table which is itself emptyable with the suite green.** See T-3.

## Blocking work

### W1 — the arity pin (review R1 + test T-1, converged independently) [HIGH]

`markdown.test.ts:559-577`, the declaration scan at `:566-576`. Two defects in
one line: `.exec` returns the first match and nothing rejects a second; and the
scan reads **raw bytes** rather than `stripInertText(src, { strings: true })` —
the comment-and-string blanking that this same file builds, documents at length
at `:899-916`, and applies to every other source scan in it. That second defect
is why a mere comment defeats it.

Both legs converged on the same fix:

```ts
const src = stripInertText(
  readFileSync(join(findWebRoot(), 'src', 'util', 'markdown.ts'), 'utf8'),
  { strings: true },
);
const decls = [...src.matchAll(/export function renderMarkdown\s*\(([^)]*)\)/g)];
if (decls.length !== 1) {
  throw new Error(
    `expected exactly one renderMarkdown declaration, found ${decls.length} — an overload ` +
    'signature satisfies a first-match scan while the implementation takes a second parameter',
  );
}
if (/[,=]/.test(decls[0][1])) { … }
```

Add `C7-e2`, `C7-g` and `C7-h` as acceptance vectors. The test leg flags a real
constraint: the scan reads a fixed path, so it cannot be fixtured as a string
table. **Preferred: parameterise the scan on its input text**, so it becomes
fixturable like every other rule in the file. If you decide against that, say
explicitly in the log that this one rule stays tree-only and why.

The sink-side half is intact — `sinkArgumentIsSanitized`'s top-level-comma
rejection does go red for a two-argument call at the live sink. Don't break it.

### W2 — review R2 [REQUIRED]: F1's fix misses `import.meta`

`import.meta` is an `import` keyword with no specifier, so `[^;'"]` has no quote
to stop at. The reviewer demonstrated a complete two-file laundering bypass,
green at 69/69: the laundering file prepends `const dev = import.meta.env.DEV`
above `export const rawHtml = unsafeHTML`, and the sink file renders
`${rawHtml(this.description)}` beside a byte-identical real sink. Same class as
V10/V24b. Latent only — `import.meta.env` at `src/index.ts:54` blanks nothing
today.

Fix: `/\bimport\b(?!\s*\.)[^;'"]*?\bfrom\b…/`, plus an `INDIRECTION_EVASIONS`
positive **and** a `LEGITIMATE_SOURCE` false-positive control. Both, not one.

### W3 — test T-2 [MEDIUM]: the `EXPECTED_CHECKS` derivation absorbs a scope shrink

This one deserves care, because two legs looked at the same arithmetic and drew
opposite conclusions, and **both were right about what they measured.**

I raised a suspicion about the derived `EXPECTED_CHECKS`. The code review
answered it with algebra: actual `= (C-1)+N`, expected
`= EXPECTED_CHECK_CALL_SITES+(N-1)`, the `N` terms cancel exactly — so the
formula is sound. Correct. The test leg then measured the **consequence** of that
cancellation: because the `N` terms cancel, the total no longer moves when
`REQUIRED_SINKS` shrinks, and `REQUIRED_SINKS` is the set the sound, closed-world
half of the guard is closed over.

`C2-e` — drop `ft-inspector-desc.ts` from `REQUIRED_SINKS`, alias the import,
render `${rawHtml(this.description)}` — gives **`npm test` exit 0, 68 checks
passed, `tsc` exit 0**, with the task description rendered raw into the
inspector's shadow root. Counterfactuals both measured: with round 5's hard
literal (`CF-1`) the identical mutation is **RED**; without the unicode escape
(`CF-2`) the tree-wide tripwire catches it. So R7 is the only per-file rule the
shrink removes that the tree-wide scan does not duplicate.

The same computation was the refutation and the finding, depending on which
question you thought you were asking. Note that and move on.

Fix: keep the derivation, restore the lost gate.

```ts
const EXPECTED_REQUIRED_SINKS = 2;   // never change merely to make a red suite go green
```

asserted **inside the existing `sink scan actually reads the source tree` check**
so no new `check()` call site is added. Also correct the failure message at
`:2408-2410`, which currently tells the reader that `REQUIRED_SINKS` changing
length needs no action. And consider promoting R7 to the tree-wide scan — it is a
two-line rule and `CF-2` shows it is the only per-file rule with no tree-wide
counterpart.

### W4 — test T-3 [MEDIUM]: every fixture table is emptyable

Measured GREEN at 69: emptying `BANNED_SINK_POSITIVES`, `SINK_EVASIONS`,
`INDIRECTION_EVASIONS`, `OWNERSHIP_EVASIONS`, `LEGITIMATE_SOURCE`, `INERT_PROSE`.
And `D5c` — neuter the `document.write` pattern **and** drop its single positive,
two one-line edits — restores F2 for that sink pattern with the suite green.
Either half alone is red; it is the pair that closes.

Two fixes, neither of which adds a `check()` call site:

1. Pin each table's length beside `EXPECTED_CHECKS` under the same doctrine, or
   at minimum assert every table is non-empty inside its own check.
2. In `fixture: every banned raw-HTML sink form is actually detected`
   (`:2000-2008`), **invert the quantifier**: assert that every `BANNED_SINKS`
   entry is matched by at least one positive, as well as that every positive is
   matched by at least one pattern. That makes the coverage relation itself the
   assertion and kills `D5c` without a length literal. Prefer this one.

### W5 — review R3 [REQUIRED]: the non-string guard's rationale is unreachable

Keep the guard — the audit found it airtight across 16 shapes, returning before
any coercion, and confirmed it **blanks nothing that previously rendered**. But
its stated justification is unreachable at both call sites: `c.body` is coerced
by `stringField()` at `gen/grpc-client.ts:660-662`, and `this.description`
early-returns at `ft-inspector-desc.ts:209`. Fix the comment, not the code.

## Recommendations — do these unless you have a reason not to

- **T-5**: correct the arity docblock. "Pinned from BOTH ends, because neither is
  sufficient alone" is not what the measurements show. There is **no** measured
  arity form for which `Function.length` is the falsifier — a *required* second
  parameter is rejected by `tsc` (14 × TS2554) before the check ever runs, and
  every form that survives `tsc` leaves `Function.length` at 1 by definition.
  Keep the assertion (it covers source/artifact divergence, which nothing else
  does); state the narrower true thing.
- **T-4**: `checks += 1` happens before `fn()`, so an eviscerated check body still
  counts (`E1b`: a production rule reverted *and* its test hollowed out, count
  unchanged, suite green). Minimum: record it in the `EXPECTED_CHECKS` docblock.
  Better: have the `assert*` helpers bump a counter and pin
  `assertions >= EXPECTED_ASSERTIONS` (113 today, measured). A floor is
  defensible here because the failure mode is removal, not addition.
- **T-6**: the `^3.4.12` floor has **no red-on-revert and cannot get one in this
  suite** (`P3` GREEN). Write it into the log as *explicitly uncovered*. Do not
  let it read as covered. The audit gave the floor a control that fails closed
  (3.0.0 = 1 high, 3.1.2 = 1 high, 3.2.3 = 1 moderate, 3.4.11 = 1 low
  GHSA-c2j3-45gr-mqc4, 3.4.12 clean), so the floor is *right* — it is just
  unenforced here.
- **T-7 + audit LOW-1, converged independently**: `SANITIZE_DOM: false` is the one
  DOMPurify-config widening with no signal — 12 of 13 weakenings turn red, this
  one doesn't. The audit's differential shows 8/10 DOM-clobbering vectors differ
  with a control that does not. Exploitability is low (`<form>`/`<input>` are
  both in `FORBID_TAGS`). Add a behavioural check if it is cheap; otherwise record
  it precisely.
- **T-8**: the private `Marked` instance is called a security property in
  `markdown.ts:66-73` and has no pin — swapping it for the shared singleton is
  GREEN. The test leg supplied an **effect-based** check (import `marked`,
  `marked.use` a malicious renderer, assert the sanitizer output is unaffected).
  Land it. It would be the first check in this file that observes an effect
  rather than a name, and that is worth more than its line count.
- **Audit LOW-2**: the scan root is `web/src` only and `.html` is in
  `INERT_EXTENSIONS`, so `web/index.html` — which ships and contains an inline
  `<script>` — is invisible to every tree-wide rule at once. Same shape as T2.
- **Review O1/O2/O3**: the scan false-positives on four correct one-parameter
  spellings including prettier's default trailing comma; the post-T3 tripwire
  message has no line number and no route forward; C2's sunset clause fires on
  nothing.
- **Audit INFO-2**: the shared singleton is measurable — a sticky `setConfig`
  turns 20 of 69 checks red.

## Explicitly out of scope — do not start these

M1 (allow-list inversion), CSP / Trusted Types, GitHub #204 (typescript-eslint
AST rule), V25 and the V25-rationale-can-rot survivor, `govulncheck`. They are
tracked. If you think one of them has become blocking, tell me — do not start it.

**Also not yours: CI.** The audit's top recommendation is *"put `npm test` in CI —
worth more than any further hardening,"* and it is right; there is no CI anywhere
in this repo. That is an infrastructure decision above this branch and I am
routing it separately. Do not build it here.

## Standing bars

1. **Positive control before any negative claim.** Round 6's auditor produced a
   complete, clean, entirely fictitious table of eight caught mutations because
   `guardmut.sh` ran `npm test` without `cd web` — every "RED (caught)" was an
   `npm ENOENT`. In their words: *"it agreed with what I expected to find, which
   is precisely why it was dangerous."* They caught it only when they went to
   quote a failure reason and found the logs empty. Use a **no-op control mutation
   that must come out GREEN** alongside your RED controls.
2. **Content-addressed mutations, never line-addressed.** Count occurrences of the
   anchor and **abort unless exactly 1.**
3. **"Clean" is not "unchanged."** sha256 against an out-of-repo pristine copy,
   not `git status`. Check both.
4. **Verify a green mutation actually weakens the thing** before filing it.
5. **Exit codes from the child, never through a pipe.** Where a mutation touches a
   file `tsc -p tsconfig.test.json` will not compile, run `npx tsc --noEmit` as a
   second child and fold in its code.
6. **Name the rule that fired**, not just the colour. "The suite went red" and
   "the right rule fired" are different claims and only the second is worth
   anything.
7. **Costly disclosure is the trust signal.** Round 6's reviewer disclosed that
   their first F1 revert was a *half*-revert that stayed green and nearly produced
   a false finding. That disclosure is why I trust the rest of their report.
8. **A narrower true claim beats a broader unverified one.** This is the round
   where that bar is the whole point.

## How to run the suite — read this or you will file a false finding

`npm test` is **not vitest**. It is:

```
tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js
```

`npx vitest` reports "No test suite found." That is the wrong runner, not a
defect. There is no lint tooling in `web/` at all.

## Your gate

```
cd web && npm test        # expect exit 0, "markdown sanitizer: 69 checks passed"
cd web && npx tsc --noEmit  # expect exit 0
```

The check count will change as you add checks — pin the new number deliberately
and say in the log what each new check is for.

## Deliverables — all four required

1. Code and tests committed to `markdown-sanitize`, in coherent commits.
2. **A project log entry** at `.design/project-log/`. Not optional. For every
   claim about coverage, give the command or execution that establishes it. Two
   things must be corrected there explicitly: the round-6 log says the arity fix
   is closed "from three sides" — it is not, and the entry should say what
   actually closed it; and the round-6 log lists **four** production items when
   the production diff is **three** (the "URI policy pinned" item is test-only,
   at `markdown.test.ts:253-259`; both the review and audit legs established this
   independently, and my own shared brief repeated the error).
3. A summary message to me (`scion message farmtable-em-task-state-model-v2`): both gate exit codes,
   the new check count, one line per item W1–W5 plus the recommendations, and
   anything you deliberately did not do.
4. **Do not push.** Commit locally only. I am the only agent permitted to push.

If any item is mis-scoped or wrong, say so rather than forcing it. Round 6's
developer improved my brief by refusing part of it; that is the standard, not an
exception.

You MUST commit your work, write the project log entry, send me the summary, and
then mark the task complete.
