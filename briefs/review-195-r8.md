# Brief — review-195-r8: independent CODE REVIEW of #195 round 8

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel`, then
verify BOTH branch and SHA:

- branch `markdown-sanitize-r8`, **HEAD `3f6a695ed450718316b50303975621bbb725e4f8`**
- base `7b4f6dd` — the round-7 head

**Do NOT create any directory named in this brief.** If a path here does not exist, the
brief is wrong; tell me.

**[MEASURED by me, in a repository no dev leg can write to]** `7b4f6dd` is an ancestor of
`3f6a695`; negative control `1d4442f` is not. Assert it yourself before using
`git diff 7b4f6dd 3f6a695` as a range.

**[MEASURED by me]** Surface excluding `.design/`: **2 files**,
`web/src/util/markdown.ts` **+79/−34** and `web/src/util/markdown.test.ts` **+514/−59**.

## Read this before you plan your review

**The central risk of this round is not a bug. It is a FALSE SENTENCE.**

Round 8 exists mostly to correct comments that stated measurements as properties. Round 7
did the same thing and shipped a *new* false sentence inside the commit that fixed the old
one. **My own brief for this round asked the dev leg to write a sentence that would have
been the fourth false claim in the chain** — I asked it to state that `.length === 1` is a
falsifier for three particular spellings; it is not the reporter for any of them, because
`renderMarkdownArityViolation` runs first and throws. The leg caught it, established the
real coverage by ablation instead, and wrote something true.

So: **your highest-value job is to check whether every NEW sentence in these comments is
true.** Not plausible — true. Where a comment states a measurement, ask what tree it was
measured on and whether it says so. Where a comment states a *property*, ask what would
falsify it and whether anything does. This codebase has a documented history of comments
being cited later as settled ground for deferring a fix.

The leg wrote the corrected arity sentence **in four places**. Check all four say the same
thing, and that the thing they say is right.

## What round 8 changed

| item | what |
|---|---|
| B1 | the arity rule, restated in both directions. `Function.length` stops counting at the first DEFAULTED-OR-REST parameter, not the first optional one |
| B2 | `fixtureTableViolation` — the single function guarding eleven fixture tables — given the positive control it never had |
| B3a | the sanitizer gets a **private** DOMPurify instance via `createDOMPurify(window)` instead of the process-global |
| B3b | `stripImportStatements` now models both remaining `import(...)` productions |
| B3c | the per-file `R6b` rule promoted **tree-wide** |
| B4 | a `Moved 69 -> 73` annotation on a constant of 74, corrected to `68 -> 74` |
| B5a/B5b | two rationale docblocks corrected |
| **C7-l / C7-m** | **a live bypass of the arity pin, not in my brief** — see below |
| six | non-blocking items from the round-7 reports |

## C7-l — verify the fix, and then try to beat it

**[MEASURED by me, independently, with a positive control]** The round-7 scanner captured
the parameter list with `/export function renderMarkdown\s*\(([^)]*)\)/g`
(`markdown.test.ts:1622` at `7b4f6dd`). `[^)]*` stops at the first `)`, **and a parameter
TYPE may contain one**. Against:

```ts
export function renderMarkdown(
  md: string | ((x: string) => string),
  opts: { inline?: boolean } = {},
): string
```

it captures `'\n  md: string | ((x: string'` → **one parameter, no default, no rest**.
Positive control: the same regex on a plain two-parameter declaration captures both, so
this is truncation, not a dead pattern. The suite was **GREEN at 78/122 with `tsc` clean
against an implementation taking a real, usable second parameter** — the configuration
channel into the sanitizer that this pin exists to deny. `Function.length` was blind too,
the second parameter being defaulted, so **both halves of the arity pin missed the same
declaration.**

The replacement is `balancedDeclarationParameterLists` (`markdown.test.ts:1700`), depth
counting rather than a character class. **Review it as parser code, because that is what it
is.** Strings, template literals, comments, nested parens, arrow types, generics — what
does it do with each? The whole finding is that *a scanner which stops at the first thing
it finds cannot see the second*; a depth counter that mishandles a `)` inside a string
literal has the identical shape one level down.

## Judgement calls I want, as questions

1. **The private DOMPurify instance (B3a).** Does `createDOMPurify(window)` change rendering
   behaviour in any way a user would see? Is `window` the right argument in every context
   this module loads in — including SSR, workers, and tests? A private instance that fails
   to construct somewhere is a worse outcome than the shared one.
2. **The tree-wide R6b promotion (B3c) was MY ruling**, made on the strength of a different
   leg's finding that `import()` is under-modelled at both layers. If promoting it
   tree-wide is wrong, or costs more than it buys, say so plainly. I would rather be
   overturned here than have it stand because I outrank the leg.
3. **A deviation the leg disclosed and I approved** — the round-6 `Moved 61 -> 69` line has
   a wrong endpoint. My brief said leave it alone and note it in the log. The leg left both
   numbers untouched but added a four-line parenthetical above it saying so. I ruled KEEP:
   an unmarked wrong number sitting immediately above a corrected one is precisely the
   defect this round is about. If you think a code comment is the wrong place for that, say
   so.

## Gates — exit codes from the child process, never through a pipe

Run in `web/`. **`npm ci`, not `npm install`** (the lockfile is present and authoritative).

| gate | expected |
|---|---|
| `npm test` | 0 — **78 checks passed, 123 assertions** |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |

**There is no CI anywhere in this repo** and `make test` / `make web` do **not** run these
checks. Nothing runs them but you. That is tracked and deferred, not something to report.

## Known-open — tracked, do not re-litigate

**F-4 is open and deliberately out of scope**: a Vite plugin can inject a script into
`dist/index.html`, and adding the build config to `EXTRA_SCANNED_FILES` would **not** catch
it. Also tracked: inverting `markdown.ts` to an allow-list; the `#204` lint rule, rescoped
to the regex-shaped subset only; the DOMPurify/marked ownership asymmetry. **New instances
are still findings — I want instances, not categories.**

## Standing bars

- Positive control before any negative claim.
- Any harness ABORTS on a failed prerequisite. Fourteen void harnesses on this workstream;
  every one printed a clean, confident, wrong number.
- **Quote every glob**: `--include='*.ts'`. Unquoted under zsh, `grep` returns empty, exit 0.
- **Do not push. Do not modify production code** — your independence depends on it.

## Deliverables

1. `/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r8.md` — **APPROVE** or
   **REQUEST CHANGES**; findings as Required / Important / Nice-to-have with `file:line`;
   gate results; **what you could not verify**; **your void runs**; and a
   **WHERE THIS BRIEF IS WRONG** section. The last leg found **four** errors in my brief,
   one of which would have installed a new false sentence. Assume there is one here.
2. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.**
