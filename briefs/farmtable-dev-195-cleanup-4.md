# #195 `markdown-sanitize` — round-4 fix brief

**Branch:** `markdown-sanitize`, head **`bae4fd0`**, in **`/workspace/farmtable-markdown-sanitize`**.
Verify `git rev-parse --short HEAD` prints `bae4fd0` before you touch anything.
**`/workspace` is NOT a git repository.** Never run the gate there.

Round 3 was reviewed by two independent legs. **Both returned REQUEST CHANGES.**
Reports (read both in full, they are the specification for this round):

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r3.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r3.md`

**There is still no live vulnerability.** Both real sinks are correctly wrapped at
`bae4fd0`; both reviewers confirmed it independently and so did I. Everything in
this round is regression-detection. Zero production code should change.

---

## RUNNER TRAP — read before you run anything

The real gate is `npm test`, under **node**, not vitest:

```
npx vitest run src/util/markdown.test.ts   -> "No test suite found"  EXIT=1  *** FALSE FAILURE ***
npm ci && npm test                          -> 54 checks passed      EXIT=0  *** THE TRUTH ***
```

And capture exit codes correctly. `npm test 2>&1 | tail -3; echo $?` reports
**tail's** status, not npm's — it is always 0. I made exactly this mistake tonight.
Redirect to a file, capture `$?` on the next line, then read the file.

---

## What I measured myself before writing this

I reproduced both High findings at `bae4fd0` in my own clone, content-addressed,
restored from `cp` backups outside the repo, `git status --porcelain` empty after
each:

| vector | mutation | result at `bae4fd0` |
|---|---|---|
| **V1** identity-shadow the *sanitizer* | `import { renderMarkdown as _rmUnused } …` + `const renderMarkdown = (s: string): string => s;` | `54 checks passed`, EXIT=0 |
| **V3** value-alias the *directive* | `const rawHtml = unsafeHTML;` + `${rawHtml(c.body)}` beside the untouched real sink | `54 checks passed`, EXIT=0 |

Both render attacker-controlled comment bodies **completely raw at the live sink**
(`src/index.ts:48` → `ft-inspector.ts:211` → `ft-inspector-comments.ts:221`,
`Comment.body` from gRPC) while the suite reports full green and the
`unsafeHTML(` count pin still reads 2.

### The part that decides this round

Each leg proposed a fix. **I tested each fix against the other leg's mutation.**

| fix applied | vs V1 | vs V3 |
|---|---|---|
| audit's (bind `renderMarkdown`, forbid shadowing) | **RED** ✅ | **GREEN** ❌ |
| test-leg's (`\bunsafeHTML\b(?!\s*\()` outside imports) | **GREEN** ❌ | **RED** ✅ |
| **union of both** | **RED** ✅ | **RED** ✅ |

The union also kills **V1c** (the realistic "helper moved to `util/format.ts`"
re-home, no new file, file count untouched) with the message
`… does not import renderMarkdown from util/markdown.js`.

**Neither reviewer's fix is sufficient alone. Apply the union.**

This is the third consecutive round in which that has been true, and I want you to
notice why: in round 3 I shipped `test-195-r2`'s snippet alone, it did not catch
M-G1-3, and **you caught my error**. I warned about the same trap in the round-3
review brief as scrutiny item 5 — and it recurred one level along anyway. Do not
assume the union is complete either. See the exit criterion at the bottom.

---

## Severity arbitration you should know about

Audit's **MEDIUM-1** (`M-2`) and test's **HIGH-1** (`MUT-B9`) are *the same
construct* — `const raw = unsafeHTML;` at a real sink, count preserved, 54/54
green — rated a full severity band apart by the two legs.

**Ruling: it is HIGH.** The audit itself rated a structurally identical bypass —
same file, same sink, same green count, same root cause ("the regex proves a
spelling, not a binding") — as its own HIGH-1. Two constructs with an identical
exploit shape and an identical detection outcome cannot differ by a severity band
on the basis of which reviewer wrote them up. Take the higher.

Note also that the test leg's remedy is **strictly better** for this vector than
the audit's: audit's `(?:const|let|var)\s+\w+\s*=\s*NAME` misses the property-bag
form `const S = { raw: unsafeHTML }`, which the negative-lookahead catches. Use
the negative-lookahead formulation, not audit's assignment regex.

---

## The framing decision for this round — read this before coding

Both reviewers independently told me the regex approach is on a treadmill:

> audit: *"I flag deliberately that this recommendation is itself an instance of
> the treadmill… Apply it, but do not read it as closure."*
> test: *"state the fix as a rule about how the directive may be **used**, not as
> another list of forms to ban, or round 4 will find a sixth spelling."*

They are right, and the audit's split is the frame I am adopting:

- **(a) The closed-world half — the two files named in `REQUIRED_SINKS`.** This is
  a finite, enumerated problem. It **can** be made sound and it **must** be. This
  is where your effort goes.
- **(b) The tree-wide half — every other file.** This is open-world and will never
  be complete. Stop pretending otherwise: **narrow it, and relabel it honestly as
  a tripwire in its own docblock and failure messages.** It must stop claiming to
  establish a property it cannot establish.

Write fixes for (a) as **rules about permitted usage**, not as lists of banned
spellings. Do not attempt to enumerate every raw-write form in (b) — I am
explicitly capping that, see DEFERRED.

---

## BLOCKING — must be done this round

**B1. Make the per-file binding sound (the union).** Inside the `REQUIRED_SINKS`
loop, enforce as a rule: for each named sink file,
  - `renderMarkdown` **must** be imported from `util/markdown.js`, and
  - no local `const|let|var|function|class` binding of that name may exist, and
  - `unsafeHTML` must be imported from a lit directive module, and
  - `unsafeHTML` must **never appear in a non-called position** anywhere outside
    its own import statement.

  Must kill, each proven by your own mutation with pasted failing output: **V1**,
  **V1b** (import removed entirely), **V1c** (re-homed onto `util/format.ts`),
  **V3**, plus the four sibling forms in test-195-r3's table — destructuring
  rename `const { unsafeHTML: raw } = await import(…)`, property bag
  `const S = { raw: unsafeHTML }`, and the whitespace variant.

**B2. Widen the call scan to `unsafeHTML\s*\(`** at both `:686` and `:674`.
`unsafeHTML (b)` — one space — currently evades it.

**B3. Reword the `EXPECTED_SOURCE_FILES` failure message to name the decision**
(test HIGH-2). Today it says "update `EXPECTED_SOURCE_FILES` deliberately", which
for a developer who has just legitimately added a file reads as *instructions to
disarm the guard*. Say what they are actually deciding, e.g. *"before bumping this
number, confirm the added file contains no raw-HTML sink and no aliased raw
directive."* The word "deliberately" asks for care without naming the choice.

**B4. Stop the guard crying wolf** (test MEDIUM-2, audit MEDIUM-4). Today a source
comment saying `// SECURITY: never import unsafeHTML as something else` turns the
suite **red**. So does a string literal mentioning `innerHTML`. I am treating this
as blocking, not cosmetic: **the person most likely to trip it is the next
developer documenting this very guard, and a guard that rejects correct code gets
deleted.** Strip line/block comments and string literals before matching, or add
an explicit greppable opt-out marker (`// raw-sink-scan: ignore-line`) documented
in the `BANNED_SINKS` docblock. Either is acceptable; the opt-out is smaller.

**B5. Relabel the tree-wide scan.** Its docblock at `:536-542` already names the
hazard precisely ("a hand-rolled stand-in for the TypeScript module graph… it
disagrees with the real language semantics on aliasing, re-export and
indirection") and then closes only three import-syntax forms. Make the docblock
and the failure messages say plainly that the tree-wide half is a **tripwire, not
a proof**, and that soundness lives in the per-file half plus the follow-up issue.

---

## SHOULD DO — this round if cheap

**I6. Extensions.** `.mts`, `.cts`, `.jsx` are invisible, and worse than the
new-`.ts` case: because `isScannableSource` filters them before `files` is built,
the file count stays at 50 and **not even the count pin fires** — no signal of any
kind. **Invert the predicate**: denylist known-inert extensions
(`.css`, `.json`, `.svg`, `.md`) so "scanned" is the default for whatever the
project adopts next. That is the property the docblock already says it wants.

**I7. Pin the false-positive boundary in-suite** (test LOW-1). The control the
round-3 brief described — `import { html } from 'lit/static-html.js'` — **does not
exist in the repo**, so nothing exercises it. **Do not add production code to
create one.** Add a negative case: run the `RAW_DIRECTIVES` regexes over a table
of legitimate strings and assert zero offenders.

**I8.** `export\s+[^;]*from` spans newlines (`[^;]` matches `\n`). Use `[^;\n]*`
or apply the three indirection regexes per line.

---

## DEFERRED — do NOT do these, I am capping scope deliberately

- **Audit MEDIUM-2's raw-write treadmill** (`Object.assign(el,{innerHTML})`,
  computed keys, `||=`). Widen the operator class to `(?:\+|\|\||&&|\?\?)?=` if
  it is a one-line change; **do not** chase the general case. The auditor flagged
  its own recommendation as treadmill. Note the residue in your log.
- **CSP** — separate issue and owner.
- **The component-rendering harness** — Phase 2.
- **typescript-eslint / Trusted Types** — this is the real answer, and both
  reviewers converged on it: a rule over the actual TS AST resolves aliasing,
  shadowing and destructuring via the compiler's scope analysis instead of by
  regex. It needs a new dependency and changes the gate, so it needs its own
  branch and its own review. **I am filing it as a follow-up issue.** Do not start
  it here.

---

## Exit criterion — so this does not run forever

Round 4 succeeds when: **no mutation of the two `REQUIRED_SINKS` files can leave
them rendering unsanitized while the suite is green.** That is a closed-world
claim over two enumerated files and it is achievable.

If round 5 review finds only new *open-world spellings* in the tree-wide tripwire,
those are Low/Info against a scan now honestly documented as incomplete — **not
blockers**. New vectors against the *closed-world* half remain blocking.

---

## Standing bars

1. **Mutation testing is the bar.** "Verified" without pasted failing output is
   not evidence. Prove every fix by breaking it.
2. **Address mutations by CONTENT, never by line number.** You are editing a
   heavily-churned file; a line-addressed `sed` manufactures a false SURVIVED that
   looks exactly like a real finding. Abort if the anchor does not occur exactly
   once.
3. **Restore from `cp` backups outside the repo, never `git checkout`** — it
   cannot tell your mutation from an uncommitted fix. Assert
   `git status --porcelain` empty after every restore.
4. **Re-derive the check-count arithmetic.** `EXPECTED_CHECKS` is 54 today. My
   union added no new `check()` calls; B4/I6/I7 may. If the number moves, say why
   in the commit message. The dev's arithmetic note was wrong once already because
   the grep pattern matched its own comment line.
5. **Do not ratify the union because I measured it.** I tested four vectors. Hunt
   a fifth against your own implementation before you call it done.
6. **Do not push.** Commit locally. Pushing is mine alone.

## Deliverables

1. The fixes above, committed to `markdown-sanitize` with clear messages.
2. **A project log entry in `.design/project-log/`** — required, not a nicety.
3. A reply to me listing: each vector, the mutation you ran, and the pasted
   actual output proving it is dead — plus anything you found that this brief
   missed. You caught my error last round; do it again.

**You MUST complete the fixes, write the project log entry, commit, report back,
and then mark the task complete.**
