# dev-195-cleanup-3 — close the G1 sink-binding gap before merge

## Status: round 2 came back split. APPROVE (audit) vs REQUEST CHANGES (test).

**I have ruled with `test-195-r2`.** Read why, because it shapes the work.

| reviewer | verdict |
|---|---|
| `audit-195-r2` | **APPROVE** — 0 Critical / 0 High / 0 Medium, 3 Low, 2 Info |
| `test-195-r2` | **REQUEST CHANGES** — 2 High (T1, T2) |

**Workspace:** `/workspace` · **Branch `markdown-sanitize`, head `5daace4`, clean.**
Confirm with `git rev-parse --short HEAD` before your first commit.

Read both reports in full first — they overlap but neither contains the whole
picture:
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-195-r2.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r2.md`

### Why the split, and why the minority wins again

Both reviewers found the **same** weakness in G1 and rated it differently. The
auditor rated it **Low** ("defence-in-depth only; no such sink exists today"),
and that reasoning is sound as far as it goes. I am overriding it for three
reasons:

1. **G1 does not do what its specification says.** I asked for "a static source
   scan proving `ft-inspector-comments.ts` and `ft-inspector-desc.ts` still route
   through `renderMarkdown`." It asserts two *global* properties instead and
   **never names either file**. That is an unmet deliverable, not a quality
   nice-to-have.
2. **The two reviewers' mutations are not equivalent, and the stronger one
   changes the severity.** Every audit mutation (MUT-H/I/J) *added a new file*.
   `test-195-r2`'s **M-G1-10** aliased the import inside the **real named sink**
   and rendered attacker-controlled `c.body` completely raw — the exact regression
   the guard's own header comment claims to catch — with the sink count preserved
   so the `>= 2` floor still passed. Result: `49 checks passed`, exit 0.
3. **A guard that is trusted and wrong is worse than no guard at a merge gate.**
   G1 has been cited as evidence by three reviewers and by me this round. The fix
   is ~11 lines of test-only code, so "it's only defence in depth" carries little
   weight against the cost.

**No live vulnerability exists.** Both real sinks are correctly wrapped today —
both reviewers verified this independently. This is a regression-detection gap.
That is why it is High and not Critical, and why the fix is test-only.

---

## Scope — five items, all test-file-only. No production code changes.

### 1. T1 (**BLOCKER**) — make G1 bind the named sinks per-file

`web/src/util/markdown.test.ts:553-577`

Replace the global assertion with an explicit per-file one. `test-195-r2` supplied
a working shape — take it, verify it, don't paste on trust:

```ts
const REQUIRED_SINKS = [
  'src/components/inspector/ft-inspector-comments.ts',
  'src/components/inspector/ft-inspector-desc.ts',
];
for (const rel of REQUIRED_SINKS) {
  check(`${rel} routes its markdown through renderMarkdown`, () => {
    const src = readFileSync(join(root, rel), 'utf8');
    if (!/unsafeHTML\(\s*renderMarkdown\(/.test(src)) {
      throw new Error(`${rel} no longer contains unsafeHTML(renderMarkdown(`);
    }
    if (!/import \{ unsafeHTML \} from/.test(src)) {
      throw new Error(`${rel} aliases or re-exports its unsafeHTML import`);
    }
  });
}
```

Reading each required file **by explicit path** also removes the narrowing
blindness in T3: a file that stops matching now throws on `readFileSync` instead
of silently vanishing from the case list.

**Acceptance — reproduce `M-G1-10` and show it now FAILS.** Alias the import in
`ft-inspector-comments.ts` to `unsafeHTML as rawHtml`, change the sink to
`${rawHtml(c.body)}`, and duplicate the `ft-inspector-desc.ts` sink so the count
floor of 2 is still met. Paste before (green) and after (red). Also reproduce
**M-G1-3** (a brand-new file with an aliased raw sink, both real sinks intact).

### 2. T2 (**BLOCKER**) — widen the banned raw-sink regex

`web/src/util/markdown.test.ts:582`

Six vectors currently pass. Two reviewers found overlapping subsets; **the union
is what matters** — fix all six:

| vector | found by |
|---|---|
| `el.innerHTML += body` | both (audit MUT-I, test M-G1-4) |
| `el["innerHTML"] = body` | test M-G1-5 |
| `unsafeSVG(body)` (`lit/directives/unsafe-svg.js`) | **test only** (M-G1-6) |
| `el.setHTMLUnsafe(body)` | both (audit MUT-J, test M-G1-7) |
| `unsafeStatic(body)` (`lit/static-html.js`) | **test only** (M-G1-8) |
| `range.createContextualFragment(body)` | both (audit MUT-J, test M-G1-9) |

> `.innerHTML +=` is **the same sink the regex was written to catch**, missed
> because `\.innerHTML\s*=` does not admit the `+`. And `unsafeSVG` / `unsafeStatic`
> are the two directives a developer in a **Lit** codebase would most plausibly
> reach for next — neither reviewer's regex nor the `unsafeHTML` scan sees them.
> The auditor missed both. Do not narrow this list to the audit's version.

Suggested (verify it, and prefer readable to clever):

```ts
const banned = /\.(inner|outer)HTML\s*\+?=|\[['"](inner|outer)HTML['"]\]\s*\+?=|insertAdjacentHTML\(|document\.write\(|setHTMLUnsafe\(|createContextualFragment\(|unsafeSVG\(|unsafeStatic\(/;
```

Add a comment stating plainly that this is an **allowlist of known sinks** that
must be revisited whenever a new raw-injection API is adopted — so its strength
is not over-read again. Also widen `collectSourceFiles` (`:536`) beyond `.ts`.

**Acceptance — all six mutants go from green to red, pasted individually.**

### 3. T3 — pin both case-list counts exactly, not as floors

`web/src/util/markdown.test.ts:547, 563`

Both lists are built by filtering through the predicate under test, so they are
blind to narrowing. The existing floors have the wrong headroom in both
directions:

| floor | pinned | actual | slack |
|---|---|---|---|
| `files.length` | `>= 10` | **50** | 40 files could vanish unnoticed |
| `sinks.length` | `>= 2` | **2** | zero — catches M-G1-2 only by luck |

Pin both **exactly**, with a comment saying to update them deliberately — the G7
rationale applied one level down. `sinks.length` should become exactly
`REQUIRED_SINKS.length` once item 1 lands.

### 4. T4 / audit LOW-2 — the container case list is invisible to G7

`web/src/util/markdown.test.ts:372-382`

**Both reviewers found this independently.** `check('svg style stripped inside
markdown containers')` loops over three payloads inside a *single* `check()`, so
`EXPECTED_CHECKS` cannot see a deleted payload. Emptying the list entirely leaves
`49 checks passed`, exit 0 — and these three payloads are what prove the
`<svg><style>` fix is reachable without a top-level raw-HTML block, i.e. the most
load-bearing cases of the round-2 security work.

Cheapest fix: hoist to three separate `check()` calls (`EXPECTED_CHECKS` → 51).
Or pin the array length inside the check. Your call; state which and why.

**Acceptance:** deleting one payload must now fail.

### 5. T6 — rename a check that passes for the wrong reason

`web/src/util/markdown.test.ts:124-128`

`formaction` and `action` can be deleted from `FORBID_ATTR` with the suite fully
green, because their host tags (`<button>`, `<form>`) are stripped first. That is
**correct defence in depth — do not change the config.** But
`check('formaction stripped')` asserts the *tag* rule, not the attribute rule.

Rename it honestly (e.g. `formaction cannot survive because its host tag is
stripped`) and add one line noting the attribute half is deliberately untestable
in isolation through `renderMarkdown`. A future reader must not infer coverage
that does not exist — which is what this whole workstream is about.

---

## MANDATORY — run the gate under the tree this branch actually ships

The auditor found (LOW-3) that reviewer clones were running **jsdom 29.1.1** while
this branch declares and locks **26.1.0**.

**I verified this myself and the auditor's conclusion is partly wrong**, which you
should know so you don't chase it: the drift is **per-clone**. Your clone and
`attention-view` have **26.1.0** installed (correct); the three reviewer clones
have 29.1.1. So the dev gate and my verification *did* run on the right major —
but both round-2 reviewers ran their behavioural checks on the wrong one.

Regardless, the recommendation stands and is now mandatory here:

```
npm ci && npm test
```

Use `npm ci`, not `npm install`, so the tree under test is the tree that ships.
Report the jsdom version you actually ran against.

---

## Explicitly OUT of scope — do not expand

- **T5 / audit INFO-1 / INFO-2** — recommendations only. T5 is a *recognition*
  note (the sink regex is a hand-rolled stand-in for the module graph); item 1's
  per-file import assertion closes the concrete gap. Add the one-line comment T5
  asks for at `:556` and nothing more.
- **CSP** — the highest-value follow-up per both reviewers, and it needs its own
  issue and owner. Not this round.
- **The component-rendering harness** that would replace the static scan — Phase 2
  territory, deferred with both reviewers' agreement.
- **`optgroup`** — both reviewers independently probed for a primitive and found
  none. **The ruling stands. Closed. Do not reopen.**
- **#199 `go vet`, #193, #196 sourcemaps, Phase 2** — other branches/issues.

If you find something **Critical or High**, stop and report rather than fixing it
quietly.

---

## Acceptance criteria

- **Every mutation goes green → red with real pasted output**: `M-G1-10`,
  `M-G1-3`, all six T2 vectors, the T4 payload deletion. This is the standing bar;
  unverified claims of "verified" get sent back.
- **The two cases G1 already caught must still be caught** (`M-G1-1`, `M-G1-2`).
- **Address every mutation by CONTENT, never by line number.** New standing bar
  tonight: on a sibling branch, a `sed '302s/...'` on a file that had shifted
  landed inside a docblock, never applied, and reported a false SURVIVED that
  looked exactly like a real finding. You will be editing this very file
  repeatedly — the hazard is live for you specifically.
- **Restore from `cp` backups outside the repo, never `git checkout`.** You hit
  this exact error last round. `git checkout` cannot distinguish your mutation
  from your uncommitted fix. `test-195-r2` used a harness that asserts
  `git status --porcelain` is empty after each restore — copy that pattern.
- **No self-built oracle.** Both reviewers hunted a fifteenth and found none.
  Do not add one.
- Update `EXPECTED_CHECKS` deliberately and state the new total.
- Full gate pasted: `npm ci && npm test`, `npx tsc --noEmit`, `npm run build`,
  `npm audit --audit-level=low`. Do not read build success off a pipeline's exit
  code — redirect to a file, then check `$?`.

## Deliverables — all required

1. Commits on `markdown-sanitize`. **Do not push.** Commit locally; the manager
   pushes. Hard rule on this project.
2. A project log entry in `.design/project-log/`, with a "Not done, and why"
   section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-cleanup-3.md`
   covering each item with its verification, all mutation output, and anything
   found but not fixed.

You MUST commit your work, write the project log entry, write the report at the
exact path above, and then mark the task complete.
