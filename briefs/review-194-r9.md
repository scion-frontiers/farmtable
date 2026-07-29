# review-194-r9 — code review of `label-write-scope-r9` @ `06f01d7`

**Read `/scion-volumes/scratchpad/projects/farmtable/briefs/_r9-baseline-block.md` FIRST and in
full.** It contains your tree, your commit, the gate baseline, a baseline correction I got wrong for
many rounds, the flake, and the method rules. Everything there applies to you.

**You are one of three independent legs reviewing this change.** A test-engineering leg and a
security-audit leg are running in parallel, in their own clones, on the same commit, on different
axes. **You will not see their reports and they will not see yours.** Do not scope your work around
what you assume they cover, and do not defer a question to them.

**Your axis is correctness and architecture**: does each commit do what its message claims, is the
design right, and will the next person to touch this code be led true or false by what it says
about itself?

## The change

Round 9 of a long-running fix sequence on issue #194 (lifecycle label write authorization).
`158c8ae..06f01d7`, **+1663 / −97 across 12 files**. Six commits:

| commit | claim |
|---|---|
| `49c1c7e` | MUST 1 — give C-1 a server-layer pin beside the two A-4 ones |
| `94c0aa9` | MUST 2 — make the P2 probe drive P2 instead of a copy of P2 |
| `058a973` | MUST 3 — pin the snapshot-spelling rule with P3 and an end-to-end row |
| `a08addc` | MUST 4 — replace the removeKeys belt's false rationale with a proof and a property |
| `794bdce` | MUST 5 — make lifecycle-label authority follow the `enabled` toggle, and validation ignore it |
| `3675bb9` | SHOULD — make the startup banner, the policy type and `allStages` testable |

**Only four files are production code**: `internal/platform/github/config.go` (+78),
`internal/platform/github/passthrough.go` (+86), `internal/platform/github/terminal_label_stages.go`
(+26), `cmd/farmtable-server/main.go` (+26). Everything else is tests and the project log. **A round
that is 90% evidence deserves a reviewer who asks whether the evidence is load-bearing** — but the
mutation work is the test leg's axis, so where you suspect a test cannot fail, *say so and move on*
rather than building a matrix.

The author's report is at `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r9.md`.
**Form your own view of the diff first, then read it, and treat every claim in it as unverified.**

## Already ruled — do not re-litigate, but do tell me if the ruling is wrong

The author correctly stopped on an open question instead of guessing, and it has since been **ruled**
and is going into r10, so **do not design a fix for it**:

> With `github.labels.enabled=false`, the gate at `server.go:840-860` prices nothing. A bare
> `task:write` holder durably writes `ft:stage/completed`, which becomes authoritative when the
> toggle is later flipped on. Measured differential:
> `enabled=true` → PermissionDenied, labels stay `[bug]`; `enabled=false` → accepted, labels become
> `[bug ft:stage/completed]`, and after flip-on `stages=[completed]`, `available=false`.

**The ruling:** the scope required to WRITE a lifecycle-prefixed label must NEVER depend on
`enabled`. Only the read/authorization-derivation side varies with the toggle; the write side does
not vary at all. Rationale: a write creates durable state in GitHub, which never hears about the
toggle, so the write's future consequence is identical regardless of `enabled` at write time —
gating it by `enabled` just banks privilege now to be cashed out later on an unrelated config change.

**What I want from you on this:** MUST 5 (`794bdce`) moves *authority* onto the toggle. Check that
it does not make the ruled defect worse, harder to fix, or duplicated in a second place. If you think
the ruling is wrong, say so with reasoning — I would rather hear it now than after r10.

## Specific things I want established

1. **MUST 5 is the only real behavioural change in the round.** `config.go` +78,
   `terminal_label_stages.go` +26. Read it as a change to a *security-relevant* predicate, not a
   refactor. What is the complete set of call sites whose behaviour now varies with `enabled`?
   Enumerate them yourself and give me your denominator and your method. Is "authority follows the
   toggle, validation ignores it" actually the split that got implemented, or only the split that
   got described?

2. **The author self-corrected a real trap and I want it verified as fixed, not just described.**
   Their words: *"Reading the constructor is not reading the accessor."* They had read
   `NewLabelMapper`, and missed that `StageToLabel` carries its **own** `!m.enabled` guard at
   `labels.go:315-317`. They caught it by RUNNING the test. **Are there further accessors in this
   package with their own independent `enabled` guard that neither the constructor nor this round
   accounts for?** That is a bounded grep and it is exactly the shape of thing that hides a second
   instance.

3. **MUST 4 replaced a false rationale with "a proof and a property".** The previous comment
   asserted something untrue about `removeKeys`. Two questions: is the new rationale *itself* true,
   and is the "property" actually a property (holds for all inputs) rather than a re-spelling of the
   fixtures? This project has repeatedly shipped comments that document a measurement as a property
   — it is form (7) in our taxonomy. `passthrough.go` +86 is where to look.

4. **MUST 3's central claim.** The author writes: *"P1 and P2 both compare through `labelMatchKey` =
   `strings.ToLower(strings.TrimSpace(raw))`. Caller spelling and snapshot spelling can differ ONLY
   in case and padding — exactly the two things that oracle normalises away."* That is a strong and
   useful sentence. **Is it true?** Specifically: is case-and-padding really the only axis on which
   the two spellings can differ, or are there others (Unicode case folding, zero-width characters,
   NFC/NFD, empty string, duplicate keys) that the sentence quietly excludes? There is a known open
   item in this area (Unicode case-folding collision) — if you land on it, name it and stop.

5. **`3675bb9` made three things "testable".** Changes made purely to enable testing can leak test
   concerns into production shape. Did exporting/reshaping the startup banner, the policy type and
   `allStages` widen any production API, weaken any encapsulation, or create a second source of truth
   for something? `main.go` +26 is small enough to read completely.

6. **The round's own coherence.** Six commits, five of them evidence. Does the set actually close the
   r8 findings it claims to close, or does it close restatements of them? You do not have the r8
   reports; if you need a finding's original wording to answer that, say so in your report rather
   than guessing.

## Out of scope — do not fix, do not file as defects in this change

- The 4 pre-existing `go vet` copylocks; the `TestWatchTasks` flake; the `web/dist` clean-checkout
  condition (task #100, pre-existing and identical to production).
- The ruled `enabled=false` write finding above.
- Anything in `internal/server/server.go` outside the label-write gate.

## Deliverables — you are not done until all five exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r9.md`** with a
   verdict — **APPROVE** or **REQUEST CHANGES** — and findings numbered, severity-classified
   (Critical/High/Medium/Low/Informational), each with file:line, evidence, impact, recommendation.
2. **Your enumeration for item 1**, with the method you used and an explicit statement of what your
   method would miss.
3. **A verdict on whether the ruling above is right**, in one paragraph.
4. **A project log entry** in `.design/project-log/`, **committed** (the only thing you commit).
5. **An explicit list of every place this brief is wrong** — counts, line numbers, paths, claims,
   commit-to-scope mappings. At least fifteen consecutive rounds have contained one; assume this one
   does too.

**You MUST produce all five deliverables and then mark the task complete. Do NOT push.**
