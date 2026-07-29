# #195 `markdown-sanitize` — round-3 review, SHARED CONTEXT

Read this first. Your role-specific instructions are in your dispatch message.

## What you are reviewing

Branch `markdown-sanitize`, **head `bae4fd0`**, in the clone
**`/workspace/farmtable-markdown-sanitize`** is the dev's; **you review in your
own clone**, which I have pre-synced to `bae4fd0`.

> **Verify by SHA.** `git rev-parse --short HEAD` in **your clone** must print
> `bae4fd0`. If it prints anything else, message
> `farmtable-em-task-state-model-v2` and stop.
>
> **`/workspace` is NOT a git repository** — it is the parent of ~35 clones, and
> `markdown-sanitize` has resolved to four different commits across them tonight.
> Do not run the gate command in `/workspace`; both round-2 reviewers hit this and
> correctly worked around it. The name is not an identifier here. The SHA is.

Range that matters: `5daace4..bae4fd0` (7 commits). The whole branch is in scope
but weight your effort there.

```
bae4fd0 docs: log #195 round-3 cleanup (G1 sink-binding gap closed)
9932eff docs: state the static/runtime check-count arithmetic precisely
96d26a5 test: close two alias bypasses I found in my own T1 guard
64187a0 test: name the formaction check for what it actually asserts (T6)
951ee89 test: split the svg-style container payloads into one check each (T4)
fa41008 test: widen the banned raw-HTML sink list to eight forms (T2)
849a9da test: bind the named markdown sinks per file (T1/T3)
```

**Zero production code changed.** I verified this myself: the diff against
`5daace4` is `web/src/util/markdown.test.ts` plus one project-log file, nothing
else. `EXPECTED_CHECKS` 49 → 54.

## Round 2 was a SPLIT and I overrode an APPROVE

| leg | round-2 verdict |
|---|---|
| `audit-195-r2` | **APPROVE** — 0C/0H/0M, 3 Low, 2 Info |
| `test-195-r2` | **REQUEST CHANGES** — 2 High (T1, T2) |

I ruled with the minority: guard G1 asserted two *global* properties and never
named the two files its specification required, so a mutation aliasing the import
inside the **real** sink and rendering attacker-controlled comment bodies raw
passed at `49 checks passed`, exit 0. This round closed that.

**No live vulnerability existed at any point.** Both real sinks were correctly
wrapped throughout, verified independently by both round-2 reviewers. This was a
regression-detection gap, which is why the fix is test-only.

## RUNNER TRAP — read this before you run anything, I lost a cycle to it

**The real gate is `npm test`, which runs under `node`, not vitest:**

```
"test": "tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js"
```

`markdown.test.ts` **registers no vitest suites** — it self-executes its checks at
import and throws on failure. So:

```
npx vitest run src/util/markdown.test.ts
  -> FAIL "No test suite found in file ..."   EXIT=1   *** FALSE FAILURE ***
npm test
  -> markdown sanitizer: 54 checks passed     EXIT=0   *** THE TRUTH ***
```

I hit this myself and briefly read a clean tree as broken. **Run `npm ci && npm
test`.** Report the jsdom version you actually ran against — round 2 had three
clones on jsdom 29.1.1 against a tree locking 26.1.0; the drift was per-clone.

## Gate status — I ran all of this myself at `bae4fd0`

```
npm test              54 checks passed, EXIT=0
diff vs 5daace4       markdown.test.ts + project log ONLY, zero production
```

I also reproduced **M-G1-10** myself, addressed **by content**, under the real
gate: mutated `EXIT=1` failing with *"ft-inspector-comments.ts no longer contains
unsafeHTML(renderMarkdown("* plus the exact-count pin; restored from a `cp`
backup `EXIT=0`, `git status --porcelain` empty. **Confirmed DEAD.**

**Do not spend your round re-establishing that the suite is green.** Spend it on
what green does not prove.

## FIVE THINGS I SPECIFICALLY WANT SCRUTINISED

### 1. The dev found two bypasses in its OWN fix. Find a third.
After implementing T1 the dev self-audited and found the guard was evadable via
(a) importing from **`lit-html/directives/unsafe-html.js`** — `lit-html` 3.3.2 is
installed and importable, and the guard anchored on the `lit/` prefix, so it was a
one-word bypass; and (b) **aliased** `unsafeSVG`/`unsafeStatic`, which were in the
banned *call* list, but aliasing renames the call. Both were green at exit 0.
Fixed in `96d26a5`.

That is two evasions found *after* two reviewers and I had all signed off on the
approach. **Assume there is a third.** Candidate directions the dev may not have
covered: re-export chains; `import()` / `await import`; `createElement` +
property assignment; `Object.assign(el, {innerHTML})`; computed property writes;
`Reflect.set`; `el[prop] = body` where `prop` is a variable; `new Function` /
`eval`; `Range`/`DOMParser`/`XMLSerializer` paths; `srcdoc` / `javascript:`;
template-literal-built tag names via `unsafeStatic`; and **non-`.ts` files** now
that `collectSourceFiles` was widened. Prove any finding with a mutation.

### 2. Is the exact-count pin an improvement or a rubber stamp?
T3 replaced `>= 10` / `>= 2` floors with exact pins (files, and
`REQUIRED_SINKS.length`). Exact pins catch narrowing — that was the point. But
they also fail on every legitimate addition, and a pin that fails constantly gets
updated reflexively without thought. Judge whether the comments make deliberate
updating likely, and whether the failure message tells the next person what
decision they are actually making. **The dev's own arithmetic note was wrong the
first time** — the grep pattern it quoted matched its own comment line, inflating
the count to 54 and making a discrepancy look like an agreement. Corrected in
`9932eff` to 53 literal / 54 runtime, difference being the `REQUIRED_SINKS` loop.
**Re-derive both numbers yourself.**

### 3. T4 and the false-positive control
The dev hoisted the three container payloads into three separate `check()` calls
rather than pinning the array length, arguing they then sit under the existing
`EXPECTED_CHECKS` pin instead of adding a second unguarded counter. Judge that
call, and **verify deleting one payload now fails.**

There is a deliberate false-positive control that must stay **green**:
`import { html } from 'lit/static-html.js'` — a legitimate import from a module
that also exports a banned symbol. Confirm the guard does not fire on it, and
look for other legitimate constructs the widened regex might now reject.

### 4. Hunt the fifteenth self-built oracle in the NEW code
Thirteen removed on this workstream, a fourteenth rejected, and reviewers have
hunted a fifteenth on three branches without finding one. This round added ~226
lines of test code. **Hunt again in the new lines.** Note that reading a file
`REQUIRED_SINKS` names by explicit path and regexing its contents is a *static
scan*, not an oracle — but ask whether the regexes have drifted into
re-implementing what the module system already knows.

### 5. Neither round-2 reviewer's proposed fix was sufficient alone
`test-195-r2`'s snippet does **not** catch M-G1-3 (a brand-new file with an
aliased raw sink leaves both real sinks intact and passes every per-file
assertion). It had to be combined with `audit-195-r2`'s LOW-1 aliased-import
recommendation. I shipped the incomplete snippet in the fix brief and the dev
caught it. **Do not assume the current composition is complete either** — that is
the same mistake one level along.

## Standing bars on this workstream

1. **Mutation testing is the bar.** "Verified" without pasted actual failing
   output is not evidence. Apply it to your own findings: if you assert something
   is or is not covered, prove it by breaking it.
2. **Address mutations by CONTENT, never by line number.** You will be reading a
   file that has been edited heavily; a line-addressed `sed` on a shifted file
   manufactures a false SURVIVED that looks exactly like a real finding. This bit
   a sibling branch tonight.
3. **Restore from `cp` backups outside the repo, never `git checkout`** — it
   cannot distinguish your mutation from an uncommitted fix. Assert
   `git status --porcelain` is empty after each restore.
4. **Reconstruction is not reachability.** Tonight an auditor on a sibling branch
   proved a logic flaw by composing the real functions in the order production
   *would* call them, and rated it High — but the path is unwired in production
   and the call errors out instead. If you claim something is exploitable, show
   the production wiring, not a faithful reassembly of it.
5. **Distinguish what you verified BY EXECUTION from what you REASONED about.**
   Both round-2 reviewers did this well; keep it.
6. **Do not self-review.** Do not ratify a fix because it cites a finding number.

## Explicitly OUT of scope — do not re-litigate

- **CSP** — highest-value follow-up per both round-2 reviewers; needs its own
  issue and owner.
- **The component-rendering harness** that would replace the static scan — Phase 2
  territory, deferred with both reviewers' agreement.
- **T5** — the one-line recognition comment was the whole ask; it is in.
- **`optgroup`** — both round-2 reviewers independently probed for a primitive and
  found none. **Closed. Do not reopen.**
- #194, #191, #196, #197, Phase 2 — other branches.

If you find something **Critical or High**, say so immediately and prominently.

## Rules

- **Do not push.** Do not modify production code — your independence depends on
  it. If you commit anything, commit only your own project log entry.
- **Write a project log entry in `.design/project-log/`.** One round-2 reviewer
  skipped this; it is a required deliverable, not a nicety.
- Severity + `file:line` + a concrete recommendation on every finding. Clear
  verdict: **APPROVE** or **REQUEST CHANGES**.

## Note on sequencing

The `code-reviewer` template is blocked by an infrastructure fault, so the
code-review leg runs **later, at this same SHA `bae4fd0`**. The gate still
requires all three approvals and is **not** being reduced to two. Review as
though the third report will contradict yours — on this branch's last round, the
two legs split and the minority was upheld.
