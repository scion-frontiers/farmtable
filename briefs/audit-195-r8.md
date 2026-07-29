# Brief — audit-195-r8: independent SECURITY AUDIT of #195 round 8

## Your working tree

**Your working tree is `/workspace`.** Confirm with `git rev-parse --show-toplevel`, then
verify BOTH branch and SHA:

- branch `markdown-sanitize-r8`, **HEAD `3f6a695ed450718316b50303975621bbb725e4f8`**
- base `7b4f6dd`

**Do NOT create any directory named in this brief.** If a path here does not exist, the
brief is wrong; tell me.

**[MEASURED by me]** `7b4f6dd` is an ancestor of `3f6a695`; negative control `1d4442f` is
not. Surface excluding `.design/`: 2 files, `markdown.ts` +79/−34, `markdown.test.ts`
+514/−59.

## What this is

`renderMarkdown` turns untrusted markdown into HTML in a Lit dashboard. Round 7 closed a
**HIGH severity XSS**. Round 8 is the fix round for round 7's findings, plus one live
bypass the dev leg found on its own.

A code reviewer and a test engineer are on this same SHA in parallel. **You will not see
their work and they will not see yours** — that is deliberate. Do not hedge toward what you
think they will cover.

## 1. Does the private DOMPurify instance actually close the class? (B3a)

`markdown.ts` now builds its own instance with `createDOMPurify(window)` instead of using
the process-global. The stated threat was **singleton poisoning**: any other module in the
bundle mutating the shared DOMPurify's config or hooks, and thereby reaching
`renderMarkdown`'s output.

**[MEASURED-BY-dev-195-r8, not by me]** The leg reproduced the pre-fix capture end to end,
including the poisoning payload appearing verbatim in the shipped Rollup bundle, and
`(await import('dompur'+'ify')).default === (await import('dompurify')).default` — i.e.
a split specifier resolves to the *same* singleton. It also reports that the private
instance closes **V23** (the `addHook` capture) as a bonus, previously closed only by a
name-guard, with a positive control showing the hooks *did* take on the singleton while
`renderMarkdown` was unaffected.

**Confirm or refute both, in the built bundle, not in source.** Then push further, because
this is the part nobody has done:

- Is the private instance genuinely unreachable from other modules? What holds a reference
  to it, and can anything obtain one?
- `createDOMPurify(window)` takes a **`window`**. Anything that can influence `window` —
  prototype pollution on `Node`, `Element`, `document.createElement`, `DOMParser`,
  `TrustedTypes` — is upstream of a private instance just as much as a shared one.
  **A private instance narrows ownership of the CONFIG. It does not narrow ownership of the
  DOM.** Is that distinction respected in the code and in the comments?
- Does anything else in the bundle still use the global DOMPurify? If so, a reader will
  reasonably assume the module is safe because "we use a private instance."

## 2. The architectural point I want your opinion on — I have already escalated it

**This is my ruling and I want it tested, not confirmed.** The pipeline made its *upstream*
dependency private and left the *terminal filter* a process-global. I argued the ownership
asymmetry is **backwards relative to risk**: poisoning the upstream one is filtered by the
terminal one anyway; the terminal one is the last line of defence and was the one left
shared. B3a moves in the right direction. **Does it go far enough, and is `marked` now the
weaker half?** If you think my framing is wrong, say so — it has been folded into a report
to the product owner and I would rather correct it now.

The general rule I drew from it, which you should also test against this code:
**bind a control to the narrowest thing every path must traverse; if you bind it to a
caller, you have bought protection only for the callers you enumerated — and the
enumeration will look complete, because the callers you were looking at are all covered.**

## 3. The scanner is a security control. Audit it as one.

**[MEASURED by me, independently reproduced with a positive control]** Round 7's arity pin
captured its parameter list with `/export function renderMarkdown\s*\(([^)]*)\)/g`.
`[^)]*` stops at the first `)` and **a parameter type may contain one**:

```ts
export function renderMarkdown(
  md: string | ((x: string) => string),
  opts: { inline?: boolean } = {},
): string
```
captured as `'\n  md: string | ((x: string'` → one parameter, no default, no rest → the
pin passes. **GREEN at 78 checks, `tsc` clean, against an implementation taking a real
second parameter** — the configuration channel into the sanitizer the pin exists to deny.
`Function.length` was blind too (defaulted second parameter), so **both halves missed the
same declaration.**

Round 8 replaces it with `balancedDeclarationParameterLists` (depth counting,
`markdown.test.ts:1700`). **Try to beat the new one.** String literals, template literals,
regex literals, comments containing parens, JSX, nested arrow types, `satisfies`. The
defect's own name is *a check that stops at the first thing it finds cannot see the
second*; a depth counter that miscounts a `)` inside a string has the same shape one level
down. A working evasion here is the highest-value finding available to you.

Same question for the tree-wide `R6b` promotion and the `stripImportStatements` fix
(`(?!\s*[.(])`, both `import(...)` productions): **these are regex-shaped controls over a
language regexes cannot parse.** I want the residual, stated concretely: name the spellings
that still get through, or state that you looked for them and found none — with the
positive control that shows your search could have found one.

## 4. Already tracked — assess impact, do not re-file

**F-4 is OPEN and was deliberately out of scope this round**: a Vite plugin can inject a
script into `dist/index.html`, and — this is the important part — **adding the build config
to `EXTRA_SCANNED_FILES` would NOT catch it.** Everything else in the sanitizer's static
scan is now closed. **So: what is F-4's severity now that it is the remaining hole, and
what would actually close it?** That is a genuine question I do not have an answer to, and
it is the most useful thing you could tell me beyond §1 and §3.

Also tracked, do not re-file the category: inverting `markdown.ts` to an allow-list; the
`#204` lint rule, rescoped to the regex-shaped subset only. **New instances are findings.**

## 5. One thing the leg took on trust — it is yours

The dev leg verified that the dompurify version floor's predicate is **string equality**
and retitled it accordingly, and confirmed **3.4.12 is installed**, not merely declared
(`node_modules/dompurify/package.json`). It did **not** audit the advisory list behind that
floor. Is 3.4.12 the right floor? Is string equality the right predicate for a security
floor at all — it fails open on *newer* versions as readily as older ones.

## Gates — exit codes from the child, never through a pipe

Run in `web/`. **`npm ci`, not `npm install`.**
`npm test` → 0 (**78 checks, 123 assertions**) · `npx tsc --noEmit` → 0 · `npm run build` → 0.

**There is no CI anywhere in this repo**; `make test` and `make web` do not run these
checks. Tracked and deferred — not a finding.

## Standing bars

- **Positive control before any negative claim.** "I could not evade it" means nothing from
  a harness never shown capable of reporting an evasion.
- **Any harness ABORTS on a failed prerequisite.** Fourteen void harnesses on this
  workstream. Every one printed a clean, confident, wrong number.
- Exit codes from the child process. **Quote every glob** (`--include='*.ts'`) — unquoted
  under zsh, `grep` returns empty with exit 0.
- **Do not push. Do not modify production code** — your independence depends on it.

## Deliverables

1. `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r8.md` — verdict,
   findings with severity and concrete exploitation paths (or an explicit statement that you
   could not construct one, and why), your §4 answer, **what you could not verify**,
   **your void runs**, and a **WHERE THIS BRIEF IS WRONG** section. The last leg found four
   errors in my brief. Assume there is one here.
2. A project-log entry committed in `.design/project-log/`.

**You MUST write the report file, commit the project-log entry, and then mark the task
complete.**
