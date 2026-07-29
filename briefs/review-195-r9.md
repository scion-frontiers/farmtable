# review-195-r9 — independent code review, #195 round 9

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `markdown-sanitize-r9` and commit **`13680c2b7d7fd64841573894e5bb1224924eefdd`**.
**Do NOT create any directory named in this brief.** `web/node_modules` and `web/dist` are
present — do not reinstall or rebuild them.

## How to treat this brief

Claims are tagged `[MEASURED]` (I ran it this session), `[MEASURED-BY-<x>]` (relayed, not mine),
`[BELIEVED]`, `[CARRIED]`.

**My briefs have contained at least one error in ten consecutive rounds.** The round-9
implementation report lists **eight** errors in the brief I gave the developer, including a
rationale of mine that was not merely false but *circular*. **Agreeing with a premise supplied
in this brief is worth ZERO, and from the outside it looks identical to genuine convergence. If
you confirm something I asserted, say that you are confirming MY claim and show your own
measurement.**

Reporting every place this brief is wrong is a **required deliverable**, not a courtesy.

## Known-good baseline `[MEASURED by me at 13680c2 this session]`

- `npm test` → exit 0, **79 checks passed (127 assertions)**
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0
- `git status --porcelain` → empty
- Files changed `3f6a695..13680c2`: `web/src/util/markdown.test.ts`,
  `web/src/util/markdown.ts`, and a new project-log entry. **`markdown.ts` is comment-only** —
  I verified at line granularity that every changed line in it is a comment or blank
  `[MEASURED]`. If you find an executable change there, that is a finding against *my*
  verification and I want it.
- **There is no CI on this project.** Nothing in this suite runs automatically on push.

## What to read

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r9.md` and the evidence directory
`reports/dev-195-r9-evidence/`. Both are **part of what you are reviewing** — check their
claims, do not inherit them.

---

# Your axis: is this actually a CLASS fix, or a class-shaped one?

Round 8 shipped what everyone called a class fix. Round 9 measured it and found that **three of
the five shared call sites had no unique coverage at all**: `renderMarkdownArityViolation`
blinded its input *once, at the caller*, so deleting the blinding inside three of the five
scanners changed nothing — they were handed an already-blinded string
`[MEASURED-BY-dev-195-r9]`. A fix can be perfectly class-shaped in the source and instance-shaped
in effect, and **the thing that hid it was a caller doing the work on the callees' behalf.**

**That is your primary question, applied to round 9's own fix.** The new shared helper is:

```ts
const literalBlindView = (code: string) =>
  stripInertText(code, { strings: true, templateText: true });
```

used by five counters: `balancedDeclarationParameterLists`, `splitTopLevelParameters`,
`hasTopLevelDefault`, `callArguments`, `sinkArgumentIsSanitized`.

Ask: does each of the five genuinely consume the shared helper on its own behalf, or has the
work migrated to some *other* common ancestor that would mask the same way? Is there a new
single point whose removal silently makes several downstream checks vacuous? **Look for the
next caller doing the callees' work, not for a repeat of the exact same caller.**

## 2. The structural decisions

`stripInertText` gained a `templateText` option that blanks template **text** while preserving
`${…}` interpolations, "because that is where the sinks live." Structural decisions read the
blinded view; slices and error messages read the original text.

That split — **decide on the blinded view, report from the raw view** — is elegant and is
exactly the kind of thing that rots. Where else does the code make a decision on one view and
act on another? Is the pairing correct at every site, or correct at the sites someone checked?

## 3. Two things the developer declined to close — judge the judgement

- **P10, a destructured single argument**: `sinkArgumentIsSanitized` does not reject it. Left
  open, documented in-tree, on the grounds that closing it needs a real expression parser and
  deserves its own review `[MEASURED-BY-dev-195-r9]`. **Is deferring it right?** Say so either
  way, and if you disagree say what the smallest safe closure would be.
- **C7-p**, the function-type evasion form, **does not compile when planted in `markdown.ts`**
  (`tsc` exit 2, TS2345), so it is a fixture-only shape and was recorded as such rather than
  presented as a closed hole. Check the reasoning.

Also: **P1, a trailing comma, was a live FALSE POSITIVE at r8 HEAD** — the second layer rejected
a legal, prettier-emitted `renderMarkdown(this.body,)`. The argument scanner was rewritten to
fix it. **A guard that rejects legal code is a defect in the opposite direction from the one
this workstream keeps hunting**, and the rewrite that fixed it is new logic. Review it as new
logic.

## 4. Ordinary code review

Readability, naming, dead code, and above all **comments that assert properties the code does
not guarantee.** This round corrected several such comments and the correction commits are
themselves in scope: `4341965` ("measured, not assumed"), `1ec4a7b` (a count recipe that counted
itself), `469694a` (the "narrower view" claim). **Verify that the replacement sentences are true**
— we have already shipped one commit whose message was "correct two false rationales" and which
introduced another.

## 5. Expected-clean checks (report the result either way)

I expect these clean, and **a clean result is a required reported outcome** — a ledger built
only from hits implies a 100% failure rate forever:

- nothing was pushed, no remote ref moved;
- no production behaviour changed (the comment-only claim above);
- no fixture table shrank.

---

# Verification bars

- **A negative claim needs a positive control drawn from a DIFFERENT axis than the one you
  searched.** A same-axis positive control is **non-evidence** for the failure that matters.
- **If a check mirrors a function F, the oracle must BE F, never a reimplementation of F.**
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts BEFORE measuring**, and report the prediction next to the result.
- **Exit codes come from the child process, never through a pipe.**
- **Compare SHAs, never counts.**
- **Commit or stash before running any mutation experiment**, and revert every mutation.

# Deliverables — you are not done until all four exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r9.md`**, with
   a clear **APPROVE / REQUEST CHANGES** verdict and each finding severity-rated with `file:line`
   and its evidence.
2. **A project log entry** in `.design/project-log/`, **committed** to `markdown-sanitize-r9`.
3. **An explicit list of every place this brief was wrong.** If nothing, say so and say what you
   checked.
4. **Do NOT push. Do NOT modify production code — your independence depends on it.** Mutations
   for measurement are fine; revert them and assert `git diff --quiet` afterwards.

**You MUST produce all four deliverables and then mark the task complete.**
