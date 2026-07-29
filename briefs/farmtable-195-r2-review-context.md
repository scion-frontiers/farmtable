# #195 markdown-sanitize — round-2 review, SHARED CONTEXT

Read this first. Your role-specific instructions are in your dispatch message.

## What you are reviewing

Branch `markdown-sanitize`, **head `5daace4`**, base `7a0f220` (`origin/main`,
live in production).

> **Verify by SHA, not by branch name.** `git rev-parse --short HEAD` must print
> `5daace4`. Tonight this branch name resolved to **four different commits**
> across four clones. The name is not a reliable identifier here; the SHA is.

Two ranges matter and you should look at both:

```
7a0f220..5daace4    # the whole branch — what actually merges
204af7e..5daace4    # the round-2 cleanup — what is NEW since the last review
```

## Round 1 was already reviewed and APPROVED by all three of you

`review-195`, `audit-195` and `test-195` all returned APPROVE at `204af7e`, with
a request for a short cleanup commit before merge. **This is the review of that
cleanup.** Weight your effort on `204af7e..5daace4`, but the whole branch is in
scope — this is the last gate before it merges to a branch that deploys to
production.

## What changed in round 2

Six items from your own round-1 reports, plus two EM rulings:

1. **M1** — `dialog` added to `FORBID_TAGS` (overlay-spoofing primitive that
   survives without a `style` attribute).
2. **M2** — checkbox accessibility restored: `role="img"` + `aria-label`, with
   VARIATION SELECTOR-15 (`U+FE0E`), also resolving L2.
3. **EM ruling** — `class` added to `FORBID_ATTR`, closing audit LOW-1
   (shadow-DOM CSS class forgery). Verified no live consumer exists.
4. **L1 / jsdom** — moved from `^29.1.1` to **`^26.1.0`**, resolving a disjoint
   range conflict with Phase 2. `@types/jsdom` stays `^28.0.3`.
5. **G1** — sink-binding guard: a static source scan proving
   `ft-inspector-comments.ts` and `ft-inspector-desc.ts` still route through
   `renderMarkdown`.
6. **G2** — SVG coverage added.
7. **EM ruling** — `<svg><style>` handling, including an `@import` remote-fetch
   case.
8. **G7 (reopened by the EM)** — the suite's check total is now pinned
   (`EXPECTED_CHECKS = 49`).

Checks went **32 → 49**.

## Gate status — I ran this myself at `5daace4`, independent of any dev claim

```
npm test  -> markdown sanitizer: 49 checks passed, exit 0
```

I also independently verified the G7 pin fires: commenting out the `svgSurface()`
group produced

```
- check total pinned: expected 49 checks to run, 39 did — a check was added or silently removed
exit 1
```

and the tree restored clean. **Do not spend your round re-establishing that the
suite is green.** Spend it on what green does not prove.

## Standing bars on this workstream

1. **Mutation testing is the bar.** "Verified" without pasted actual failing
   output is not evidence. Apply it to your own findings too: if you assert
   something is or is not covered, prove it by breaking it.
2. **The self-built oracle defect class** — a test asserting against a local
   re-implementation instead of the real exported symbol. Thirteen removed, a
   fourteenth rejected. Three reviewers hunted a fifteenth on Phase 2 and found
   none. Hunt here.
3. **Tests that disappear instead of failing** — a new named class from tonight,
   found independently on two branches within an hour. A case list derived by
   filtering through the predicate under test protects against widening and is
   blind to narrowing; and a suite that prints its own count without asserting it
   goes green when a check is deleted. G7 fixes the second instance on this
   branch. **Check whether any third instance remains.**
4. **Do not self-review.** You may read the dev report
   (`reports/dev-195-cleanup.md`), but ratify nothing on its say-so.

## Things that are NOT in scope

- **Phase 2** is a separate branch under separate review. Do not file against it.
- **`optgroup`** — the dev found that `option` is in `FORBID_TAGS` while its
  parent `optgroup` is not. I ruled it out of this round deliberately (inert:
  `option` is forbidden so `optgroup` renders nothing; and expanding
  `FORBID_TAGS` without a demonstrated primitive is scope creep at the gate). It
  is logged for the follow-up cleanup branch. **If you can demonstrate an actual
  primitive, that changes the ruling — say so. Otherwise do not re-litigate.**
- **`go vet` copylocks in `internal/server/server.go`** — pre-existing, already
  filed as **#199**. The dev verified it reproduces at base `7a0f220`. This
  branch touches no Go source. Do not attribute it here.
- **Production sourcemaps (#196)** — `find dist -name '*.map' | wc -l` returns
  **1** on this branch and that is **correct**. The fix (`b35f36e`) lives on the
  Phase 2 line and reaches main only when Phase 2 merges last. #195 forks from
  main and legitimately lacks it. **Do not "fix" this and do not file it.**

## Two disclosures the dev made — I want your independent judgement

1. **A process error, self-reported.** During the first mutation the dev ran
   `git checkout` on the test file to restore it while their own fix was still
   *uncommitted*, silently reverting their own work. They caught it, reapplied,
   verified, and committed before running further mutations. **I want one of you
   to confirm the final state is actually correct rather than taking the recovery
   on trust** — that is precisely the kind of error that can leave a partial
   revert behind.
2. **A deliberate departure from `review-195`'s suggested diff**: the dev wrote
   U+FE0E as the escape `︎` rather than the literal character, arguing the
   literal is invisible in source and would eventually be deleted by someone
   reflowing the line. I upheld it. Confirm it is runtime-identical.

## Rules

- **Do not push.** If you commit anything, commit only your own project log
  entry. Never modify production code — your independence depends on it.
- Confirm `git rev-parse --short HEAD` = `5daace4` before anything else.
- Give every finding a severity (Critical / High / Medium / Low / Info), a
  `file:line`, and a concrete recommendation. State a clear verdict:
  **APPROVE** or **REQUEST CHANGES**.
- **Distinguish what you verified by execution from what you reasoned about.**
  Say which is which. That distinction has repeatedly been the difference
  between a real finding and a wrong one on this workstream.
