# markdown-sanitize — security audit, round 2 (#195)

Branch: `markdown-sanitize`, head `5daace4`, base `7a0f220`.
Reviewed: `204af7e..5daace4` (the cleanup round) weighted, `7a0f220..5daace4`
(the whole branch) in scope. Round-1 verdict at `204af7e` was APPROVE.

**Verdict: APPROVE.** 0 Critical, 0 High, 0 Medium, 3 Low, 2 Info. Nothing
blocking. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r2.md`.

All mutation work was done in an isolated copy at `/tmp/mut/web`. No production
code was modified; `/workspace` verified clean at `5daace4` afterwards.

## What the round-2 changes actually do

Each security change was confirmed by breaking it, not by reading it.

- **`<svg><style>` (EM ruling).** The vector is genuinely closed, not merely
  tag-filtered. 20 container variants probed — every SVG allowlist element, the
  MathML namespace, uppercase, CDATA, nesting — and no `<style>` survived any of
  them. The CSS text is destroyed rather than orphaned, because `style` is in
  DOMPurify's default `FORBID_CONTENTS`; that is what stops Lit's `unsafeHTML`
  re-parse from re-materialising it. Removing `'style'` from `FORBID_TAGS` fails
  3 checks, one of them the remote-fetch-specific one.
- **`class` (EM ruling).** Closes audit LOW-1. The forgery target set is real —
  `ft-inspector-comments.ts` does carry `.comment-header`, `.comment-author` et al.
  in its shadow-root stylesheet. Removing `'class'` fails 2 checks, one security
  and one rendering. Independent re-grep confirms no live consumer.
- **`dialog` (M1).** Removing it fails 1 check.
- **U+FE0E as an escape (M2).** Runtime-identical, proven twice: the emitted
  codepoints are `U+2611 U+FE0E`, and substituting the literal character in
  source leaves the suite at 49 green. The departure from the reviewer's
  suggested diff was correct — an invisible load-bearing character in source is
  a latent defect.

## The process error — final state independently confirmed correct

The dev disclosed running `git checkout` on the test file with their own fix
uncommitted. Confirmed complete recovery three ways rather than on trust:
the only delta after `f202448` is the G7 pin (`markdown.ts` is untouched after
that commit); all 32 round-1 check names survive at HEAD with 17 added; and the
static count of `check()` call sites (49) matches both the runtime count and
`EXPECTED_CHECKS`, with no `check()` inside a loop or conditional so the two are
required to agree. No partial revert survived.

## Findings

- **LOW-1** `markdown.test.ts:556,582` — the sink guard is blind to three sink
  forms: an aliased `unsafeHTML`, `.innerHTML +=` (the regex requires `=`
  directly), and `setHTMLUnsafe`/`createContextualFragment`. Demonstrated by
  adding each as a *new* sink while leaving both real sinks intact, so the
  `sinks.length >= 2` pin does not save it — suite stayed green in all three
  cases; the plain-`unsafeHTML` control was caught. Defence-in-depth only; no
  such sink exists today. One-line regex widening recommended.
- **LOW-2** `markdown.test.ts:373` — **third instance of "tests that disappear
  instead of failing"** on this workstream. The container case list lives inside
  a single `check()`, so G7 counts the check, not the cases: emptying the array
  leaves the suite at "49 checks passed", exit 0. These are the payloads proving
  the `<svg><style>` fix is reachable without a top-level raw-HTML block. Pin the
  list length or split into three checks. Confirmed this is the only such loop.
- **LOW-3** `package.json:24` — the manifest and lock correctly say jsdom
  `26.1.0`, but the installed `node_modules` is `29.1.1`, so every green run
  tonight measured the undeclared tree. Settled by execution: an isolated
  `npm ci` on the locked tree gives 49 passed, `tsc` clean, 0 vulnerabilities,
  and my own 41-payload corpus is byte-identical across the two majors —
  independently corroborating the dev's differential. Artifacts are correct; make
  the gate `npm ci && npm test`.
- **INFO-1** `markdown.ts:22-24` — "reaches an attacker origin with no user
  interaction" is broader than what was closed; 10 payloads (img, srcset, video
  poster, audio, track, svg image/feImage, table background) still beacon. That
  is pre-existing and inherent to markdown images, explicitly **not** filed
  against #195. What `@import` uniquely added — arbitrary shadow-root rules and
  selector-based content exfiltration — is closed. Narrow the comment; `img-src`
  belongs to the CSP follow-up.
- **INFO-2** — 2 of 8 mXSS payloads are non-idempotent; the delta is marked's
  block-wrapping on a second pass, not sanitizer instability, and is unreachable
  in production. Recorded so it is not rediscovered as a finding.

## Hunts assigned by the EM

- **Fifteenth self-built oracle: none found.** Replacing `renderMarkdown` with a
  raw passthrough fails 44 of 49 checks. The 5 survivors are the 4 by-design
  static source scans plus `empty input renders empty`, which is vacuously true
  under passthrough. The suite binds to the real exported symbol and the helpers
  use jsdom's real DOM throughout.
- **Third disappearing test: found** — LOW-2. Specifically checked for the
  filtered-case-list variant as well and found none; every case list here is a
  hardcoded literal, and the sink scan's file list is all `.ts` under `src/`,
  not a filtered subset.

## Scope held

`optgroup` was probed rather than argued: outside a `<select>` the surviving
`label` attribute has no default rendering, so no attacker text becomes visible.
No primitive demonstrated — the EM's ruling stands and was not re-litigated.
#199 (`go vet`) and #196 (sourcemaps) not attributed here. Phase 2 untouched.

## Standing recommendation

CSP remains the highest-value follow-up and this round strengthens the case:
`style-src` would have blunted `<svg><style>` independently, `form-action 'self'`
makes the original #195 bug class structurally impossible, and `img-src` is the
only real answer to INFO-1.
