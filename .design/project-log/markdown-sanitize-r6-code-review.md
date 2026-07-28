# markdown-sanitize round 6 — code review leg

**Reviewed:** `53296af..86f30bc` (HEAD `86f30bcdc699367681ccffbc4fde1e40006fd754`),
814 insertions / 95 deletions, 5 files.
**Verdict:** REQUEST CHANGES. Risk MEDIUM — no live vulnerability.
**Full report:** `reports/review-195-r6.md` (scratchpad, not in-tree).

## Gate reproduced independently

`npm test` exit 0 / "markdown sanitizer: 69 checks passed" · `npx tsc --noEmit` exit 0 ·
`npm run build` exit 0 · `go build ./...` exit 0 · `go test ./...` exit 0.
No lint tooling exists in `web/` (no eslint config, no `lint` script); `typecheck` is the
closest equivalent and passes.

## Blocking findings

- **R1 — the T1 arity pin is one-sided (BY EXECUTION).** A TypeScript overload signature
  plus a defaulted implementation parameter defeats both new sides at once:
  `Function.length` stops at the default, and the declaration scan's `.exec` returns the
  first match, which is the clean overload signature. A two-parameter `renderMarkdown`
  whose second parameter sets `ALLOWED_ATTR: ['href','src','onerror']` passes 69/69 with
  `tsc` clean. `markdown.ts:81` ("so adding a parameter here turns the suite red") is
  therefore false. Only `sinkArgumentIsSanitized` still holds, and it constrains call
  sites, not the declaration. The scan also reads raw `readFileSync` bytes rather than a
  `stripInertText` view, contradicting the file's own doctrine at `markdown.test.ts:899`.
  Fix: `matchAll` over a derived view, reject a top-level comma in any match, pin the
  match count.

- **R2 — F1's fix does not cover `import.meta` (BY EXECUTION).** `import.meta` is an
  `import` keyword with no specifier, so `[^;'"]` has no quote to stop at and the match
  runs to the next `from '…'`, blanking everything between. The complete two-file
  laundering bypass F1 was meant to close is still green: a non-sink scanned file exports
  `rawHtml = unsafeHTML` hidden behind the swallow, the sink file imports it and renders
  `${rawHtml(this.description)}` beside a byte-identical real sink — 69/69, `tsc` clean.
  Same class as V10 and V24b. Latent only: `import.meta.env` at `src/index.ts:54` blanks
  nothing today. Fix: `\bimport\b(?!\s*\.)`, plus an evasion fixture and a false-positive
  control.

- **R3 — the non-string guard's justification is unreachable at both call sites
  (BY EXECUTION).** `c.body` is coerced by `stringField()` (`gen/grpc-client.ts:660`);
  `this.description` is early-returned at `ft-inspector-desc.ts:209`. The guard is worth
  keeping as defence in depth, but `markdown.ts:86-91` asserts a live outage that cannot
  occur. Fix the comment; optionally widen to `md: unknown` so the test's
  `bad as unknown as string` cast disappears.

## Non-blocking

Declaration scan false-positives on prettier trailing commas, generic types with commas,
parameter comments and a default on the sole parameter · the `BANNED_SINKS` tripwire
message carries no line number and no successor pointer now that `IGNORE_MARKER` is gone ·
C2's sunset clause states a condition but arms no tripwire · "URI policy pinned" is logged
as a production change but is test-only (the production diff is three items, not four).

## Confirmed good

The `EXPECTED_CHECKS` derivation is a genuine invariant, not a tautology — the
`REQUIRED_SINKS.length` terms cancel exactly, leaving the pin sensitive only to the
call-site count, which is what it exists to pin · all three real production items fail
closed on revert · F1's fix is load-bearing and `febc655`'s ASI mirror is discriminating ·
the T3 marker sweep is clean · the `dompurify` range, lockfile and installed tree are
consistent at 3.4.12 · C1's amended criterion is genuinely adjudicable against a diff.

## Disclosure

My first F1 revert changed only the character class and left the `;` → `;?` half in place.
It stayed green and I nearly filed "F1's fix is untested and its mirror is a no-op."
Reverting both halves turns three checks red, including the mirror firing with its own
predicted message. Standing bar 6 caught a materially unfair finding.
