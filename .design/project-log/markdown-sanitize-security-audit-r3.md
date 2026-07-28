# #195 markdown-sanitize — round 3 security audit

**Branch:** `markdown-sanitize` · **SHA reviewed:** `bae4fd0` · **Range weighted:** `5daace4..bae4fd0`
**Leg:** security audit (round 3) · **Verdict: REQUEST CHANGES**
**Gate:** `npm ci && npm test` → `markdown sanitizer: 54 checks passed`, exit 0
**jsdom measured in this clone: 26.1.0** (matches `package-lock.json`; no drift here — measured, not inferred, and only for this clone)
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r3.md`

## Outcome

0 Critical · **1 High** · 4 Medium · 2 Low · 2 Info.

No live vulnerability at `bae4fd0`. Both real sinks remain correctly wrapped and
the round is test-only — confirmed independently: `git diff --name-status
5daace4..bae4fd0` is `markdown.test.ts` plus one project-log file, zero
production code.

## The High finding: the third bypass, and it is in the half that was supposed to be sound

Round 3 was written to close G1's sink-binding gap. The new per-file check binds
`unsafeHTML` to an import but **never binds `renderMarkdown` to anything**. Its
own name and docstring promise the file "routes its markdown through
renderMarkdown"; the assertion cannot distinguish the sanitizer from any binding
in scope with that name.

Three mutations, all at the real production sink in
`ft-inspector-comments.ts`, all `54 checks passed` / exit 0, all rendering
attacker-controlled `c.body` completely raw with the sink count preserved and no
new file:

- **M-1** — `import { renderMarkdown as _rmUnused } ...` + `const renderMarkdown = (s) => s;`
- **M-1b** — sanitizer import deleted outright, local `const renderMarkdown` defined
- **M-1c** — the realistic one: a "helper moved" refactor re-homing `renderMarkdown`
  onto the existing `src/util/format.ts`, no new file, file count untouched

Wiring verified, not reconstructed: `index.ts:48` → `ft-inspector.ts:211` →
`listComments()` over gRPC → `Comment.body` → `unsafeHTML(renderMarkdown(c.body))`.

This is the M-G1-10 shape the EM upheld in round 2, recurring one level along —
exactly the mistake the brief warned against ("do not assume the current
composition is complete either").

Also noted: `tsconfig.test.json` includes only the two test files, so component
sources are never type-checked by the `npm test` gate. None of the above trips `tsc`.

## Four more survivors, and the false-positive problem

Beyond the High: assignment aliasing (`const raw = unsafeHTML`) defeats the
alias ban, which only matches import-clause `as`; `Object.assign(el, {innerHTML})`,
computed property writes and `||=` all slip `BANNED_SINKS`; and `.jsx` is missing
from `SCANNED_EXTENSIONS` — worse than a list gap, because a `.jsx` file is
invisible to the file-count pin too, where the equivalent `.ts` file is caught twice.

The finding likeliest to get the guard deleted is the opposite failure. The
indirection regexes are not anchored to import syntax, so they fire on a security
*comment* ("Never reach for unsafeHTML as a shortcut"), on a TS type assertion,
and on a legitimate re-export of the **safe** `html` symbol from `static-html.js`.
The guard's own comment at `markdown.test.ts:538` contains the banned string and
escapes only because `*.test.ts` is excluded from its own scan.

The required control does hold: `import { html } from 'lit/static-html.js'` stays
green. But it passes vacuously — nothing in the tree imports that module, so the
behaviour is unpinned.

## Verified working

The dev's two self-found evasions are genuinely closed (both controls fail
correctly). A new `.ts` file is caught twice over. Deleting one of the three split
svg payloads is caught by the check-total pin — T4's design call was right.
Check arithmetic re-derived independently: 53 literal (56 occurrences = 53 call
sites + 1 declaration + 2 prose mentions), 54 runtime via
`53 − 1 + REQUIRED_SINKS.length`. The corrected note is accurate and its quoted
grep does **not** self-match. `EXPECTED_SOURCE_FILES = 50` confirmed against `find`.

## Threat-model judgement

The guard is two mechanisms and should stop being cited as one. The **positive
per-file binding** is a closed-world claim over two named files — right shape,
can be made *correct*, currently is not (the High). The **tree-wide negative
claim** is an open-world blocklist that will always trail: 2 → 8 forms in one
commit, two evasions found by the dev in its own fix after three sign-offs, five
more found here from the brief's own candidate list.

But round 3 narrowed the blocklist half more than it has been credited for.
`EXPECTED_SOURCE_FILES` makes "add a file with a raw sink" a closed-world problem,
so the residual surface is modifications to the 50 existing files. **Adequate as a
tripwire until Phase 2** — on the condition the code already meets, namely the
`BANNED_SINKS` docstring refusing to overclaim ("none of these eight forms
exists"). That comment is doing more work than any of the patterns; keep it verbatim.

The diagnosis for Phase 2: `RAW_DIRECTIVES` is a hand-rolled, lossy module
resolver, losing to aliasing, assignment, destructuring, dynamic import and
re-export chains — all of which TypeScript resolves exactly. The answer is not
more regexes but type-aware lint (subsumes three findings and removes the false
positives) and, longer term, Trusted Types via the deferred CSP work. Not this
branch's job. The component-rendering harness is not re-proposed; it answers a
different question.

No fifteenth self-built oracle found in the ~226 new lines. Reasoning recorded in
the report so the next reviewer need not repeat it.

## Restated for the record

Every mutation was addressed by content, restored from `cp` backups outside the
repo, with `git status --porcelain` asserted empty after each. Tree left clean at
`bae4fd0`. Findings split explicitly into BY EXECUTION and REASONED in the report;
the `.jsx`-reaches-`dist` claim, the severity calibration and the Phase-2
recommendations are reasoned, not executed.
