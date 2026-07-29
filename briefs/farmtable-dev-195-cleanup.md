# dev-195-cleanup — pre-merge cleanup round on `markdown-sanitize` (#195)

## Status: this branch is APPROVED by all three reviewers

You are **not** fixing a rejected branch. `review-195`, `audit-195` and
`test-195` all returned **APPROVE**. The code review's verdict was literally
*"APPROVE — with two Medium findings recommended for a short cleanup commit on
this branch **before merge**."* This is that commit. Nothing here is a
repudiation of the original work, which was good: the reviewers independently
reproduced its mutation counts and found no self-built oracle.

Your job is a tight, well-tested cleanup. Do not redesign the sanitizer.

Workspace: `/workspace/farmtable-markdown-sanitize`, branch `markdown-sanitize`,
currently at `204af7e`, clean. Base `7a0f220`.

## Read these first — all three, in full

- `/scion-volumes/scratchpad/projects/farmtable/reports/review-195.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-195.md`

The reviewers wrote and *verified* most of the fixes below. Where they supplied
a diff, prefer theirs over inventing your own — but verify it yourself, do not
paste on trust.

---

## Scope — six items, all in scope, nothing else

### 1. M1 (review-195) — add `dialog` to `FORBID_TAGS`

`<dialog>` is in DOMPurify's default allowlist and survives, and the HTML
Standard's default rendering gives a non-modal `dialog` `position: absolute` with
an opaque `background-color: Canvas`. That is precisely the overlay-spoofing
primitive that forbidding `style` was added to deny — obtainable with no `style`
attribute. One word. Add the reviewer's assertion to the spoofing section of
`markdown.test.ts`.

### 2. M2 (review-195) — restore assistive-technology semantics to the checkbox

Pre-change, marked emitted a real `<input type=checkbox checked disabled>`, which
survived sanitization and is announced with a checked/unchecked state. The glyph
`<span>` has no role and no accessible name — a regression introduced by this PR.
Apply the reviewer's `role="img"` + `aria-label` fix, including the
VARIATION SELECTOR-15 (`U+FE0E`) which also resolves **L2** (U+2610 renders as
tofu on some Linux font stacks while U+2611 may render as a colour emoji —
visually inconsistent side by side). Update the two task-list assertions and
extend one to pin the `aria-label`.

### 3. **EM ruling** — add `class` to `FORBID_ATTR`, closing audit LOW-1

This one is mine, so here is the full reasoning; push back if you find it wrong.

`audit-195` LOW-1 shows that because both sinks inject sanitized markdown *inside
the Lit shadow root that carries the component's own stylesheet*, attacker-chosen
class names resolve against real component CSS. The audit's verified PoC produces
a pixel-accurate forged comment header — fake author, fake timestamp — inside a
real comment body, with no inline `style`. Forbidding `style` does not close it.

The audit rated it Low and did not require a fix, because the payoff is only a
link-out. I am asking for it anyway, because I checked the cost and it is
approximately zero:

- `grep -rn "ft-task-checkbox"` across `src/` and `test/` returns exactly one
  hit: the literal in `markdown.ts` itself. No stylesheet consumes it.
  `review-195` L2 reached the same conclusion independently.
- No syntax highlighter exists in this codebase, so marked's `class="language-js"`
  on code blocks is also consumed by nothing. The only reference to it is an
  *expected-output assertion* in `markdown.test.ts:249` — a fixture, not a
  consumer.

So `class` is dead weight in our own pipeline and a live forgery primitive in the
attacker's. Forbid it. Note this is compatible with item 2: DOMPurify will strip
`class` from our own renderer output too, but `role` and `aria-label` — the parts
that actually matter — survive. Drop the now-guaranteed-to-be-stripped
`ft-task-checkbox` class from the renderer rather than leaving misleading dead
code, and update the `language-js` assertion to match the new reality.

**Verify before you commit**, do not assume: confirm DOMPurify actually strips
`class` under this exact config, and re-run the grep yourself across `src/`,
`test/` and any `.css`/`.svg`. **If you find a live consumer of any class name
that flows through `renderMarkdown`, stop and report — do not force it through.**

### 4. L1 (review-195) — `@types/jsdom@^28` vs `jsdom@^29`, **and a merge collision I found**

Check whether `@types/jsdom@29` exists on the registry. If it does, take it. If
it does not, add a one-line comment recording the deliberate skew so a future
reader does not "fix" it blindly.

**Expanded 2026-07-27 — please read, this is now the highest-risk item in the
round despite being labelled Low.**

I checked #195 against the Phase 2 branch that merges after it, and the two
declare **disjoint** jsdom ranges:

| branch | declares | used by |
|---|---|---|
| #195 (this one) | `jsdom@^29.1.1` | `markdown.test.ts`, directly, to give DOMPurify a DOM |
| Phase 2 | `jsdom@^26.1.0` | vitest `environment: 'jsdom'` for a **407-test** component harness |

`^26.1.0` is `>=26 <27`; `^29.1.1` is `>=29 <30`. No overlap, so npm installs
exactly one and **one of the two suites runs on a jsdom major it was never
tested against.** Neither outcome is comfortable:

- Resolve to **29** → Phase 2's whole component harness jumps three majors, and
  `vitest@3.2.7`'s support for jsdom 29 is unverified.
- Resolve to **26** → the *sanitizer* suite runs on a different DOM engine.
  DOMPurify's behaviour is downstream of the DOM implementation, so this is the
  single worst suite in the repo to quietly re-host.

`#195 merges first, so it lands clean and the conflict surfaces later, when Phase
2 rebases — at which point whoever is resolving a 73-file rebase has to make a
security-relevant dependency judgement under pressure. I would rather it be
decided here, deliberately, on a 6-file branch.

**What I want from you — empirical, not a judgement call:**

1. Determine whether the markdown suite passes on **`jsdom@^26.1.0`**. Install
   it, run the full suite, paste the result.
2. **If it passes**: declare `^26.1.0` here. The conflict then evaporates
   entirely and Phase 2 rebases clean. This is the outcome I am hoping for.
3. **If it fails**: do **not** force it. Paste the failure, keep `^29.1.1`, and
   say precisely what breaks. That failure is itself valuable — it tells us the
   sanitizer's behaviour is jsdom-version-sensitive, which is worth knowing
   before we let a rebase silently pick a version.
4. Either way, re-check `@types/jsdom` against whichever jsdom you land on. The
   L1 skew flips direction if you move to 26.

Do not touch Phase 2 or its package.json — it is a different branch under review
and not yours to edit. Report; I will handle the other side.

### 5. G1 (test-195, High gap) — bind the sinks

`test-195`'s strongest finding: **nothing in the suite proves that
`ft-inspector-comments.ts` and `ft-inspector-desc.ts` actually route their
`unsafeHTML` content through `renderMarkdown`.** Every test exercises
`renderMarkdown` directly, so a future refactor could bypass the sanitizer at the
sink and the entire 32-check suite would stay green. Add a guard test that fails
if either sink stops going through `renderMarkdown`. The reviewer describes what
it needs to catch — pick the mechanism, and say why you picked it.

### 6. G2 (test-195, High gap) — SVG coverage

Zero SVG coverage today. SVG is a well-known sanitizer bypass surface
(`<svg><foreignObject>`, `<use href="#...">`, animation elements). Add coverage
for the DOMPurify configuration as it actually is.

---

## Explicitly OUT of scope

Do not act on `review-195` L3 (unreachable `action`/`formaction` entries), the
audit's INFO items, or anything else you find interesting. If you find something
new and real, put it in the report under "Found but not fixed" and leave it. If
you think you have found something **High or Critical**, stop and report
immediately rather than fixing it quietly.

---

## Acceptance criteria

- **Mutation tests with pasted real output.** This is the standing bar on this
  workstream and unverified claims of "verified" get sent back. For each of items
  1, 3, 5: break it, paste the ACTUAL failing output, restore, confirm green.
  For item 5 specifically the mutation is the point — make a sink bypass
  `renderMarkdown` and show your new guard test fails.
- The two mutation counts the original branch established still reproduce, and
  `review-195`'s additional mutations 3 and 4 still fail.
- Every new test binds to the real exported `renderMarkdown`. **No self-built
  oracle** — this workstream has removed thirteen and rejected a fourteenth. Do
  not add the fifteenth.
- Full gate, run and pasted: `npm test`, `npx tsc --noEmit`,
  `npx tsc -p tsconfig.test.json --noEmit`, `npm run build`,
  `npm audit --audit-level=low`.
- `find dist -name '*.map' | wc -l` — report the **truthful** number.

  **CORRECTED 2026-07-27 23:20Z. This criterion originally said "Expected `0` on
  this branch." That was my error.** `1` is the correct and expected number
  here. The sourcemap fix (`b35f36e`) is **not** on `origin/main`; it lives on
  the Phase 2 line and reaches main only when Phase 2 merges last. #195 forks
  from main, so it legitimately lacks the fix — and `audit-195` and `test-195`
  both recorded `1` at this same commit. My own notes elsewhere said exactly
  this; I contradicted myself when writing this brief.

  So: report `1`, change nothing, do **not** edit `vite.config.ts` to force a
  `0`. The instruction to stop-and-report on a `1` was meant to catch a real
  regression, and this is not one. `dev-195-cleanup` correctly reported the
  truthful number against my mistaken expectation — that is the behaviour this
  criterion exists to produce.

## Deliverables — all required

1. Commits on branch `markdown-sanitize`. **Do not push.** Commit locally; the
   manager pushes. This is a hard rule on this project.
2. A project log entry appended to `.design/project-log/` for this branch,
   including a "Not done, and why" section.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-cleanup.md`
   covering: each of the six items with its verification, the mutation output,
   your G1 mechanism choice and reasoning, the result of the `class` consumer
   re-grep, and anything found but not fixed.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
