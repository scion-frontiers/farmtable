# Phase 2 web UI — round-6 review, SHARED CONTEXT

Read this first. Your role-specific instructions are in your dispatch message.

## What you are reviewing

Branch `attention-view`, **head `bcd40a4`**, base `7a0f220` (`origin/main`, live
in production).

> **Verify by SHA, not by branch name.** `git rev-parse --short HEAD` must print
> `bcd40a4`. **If it prints anything else, do not review — message
> `farmtable-em-task-state-model-v2` with what it printed and stop.**
>
> This is not boilerplate. Tonight two separate branch names each resolved to
> **four different commits** across four clones. Worse, this worktree also
> contains a branch named `task-state-web-ui-v2` which is **three commits behind
> and missing the entire attention view** — merging it by name would ship Phase 2
> without its headline feature, on a green suite. The name is not an identifier
> here. The SHA is.

Two ranges matter:

```
7a0f220..bcd40a4    # all of Phase 2 — what actually merges to production
633f8f2..bcd40a4    # the round-5 fix pass — what is NEW since the last review
```

Weight your effort on `633f8f2..bcd40a4`; the whole branch is in scope. This is
the last gate before Phase 2 merges toward production.

```
bcd40a4 docs: log the Phase 2 web UI round-5 fix pass
8fa5762 test(web): cover embedded credentials in the safe-url contract table
9bc5e2c test(web): pin the error toast's HTML escaping
3b7ce98 test(web): bind the queue's partial-renumber emission
e67bae4 test(web): pin the cardinality of all four derived stage loops
d039810 fix(web): anchor the inspector's attention callout copy
```

Only `d039810` touches production source. The other four are test-only.

## Round 5 was a fix round against your own round-4 findings

At `633f8f2` the three-way gate returned:

| reviewer | verdict |
|---|---|
| `audit-phase2` | **APPROVE** — 0 Critical / 0 High / 0 Medium, 2 Low, 2 Info |
| `test-phase2` | **APPROVE** — 20 mutants applied, 4 survived |
| `review-phase2` | **REQUEST CHANGES** — 1 High blocker, 2 Medium |

The EM ruled **with the minority**, because `review-phase2` had run an experiment
the other two had not. Round 5 fixed five items. **Do not ratify a fix because it
cites a finding number.** The dev report is `reports/dev-phase2-fixes-r5.md` —
you may read it, ratify nothing on its say-so.

## Gate status — I ran all of this myself at `bcd40a4`

```
npm test                          422 passed (22 files), exit 0     # was 407
npx tsc --noEmit                  exit 0
npm run build                     exit 0
find dist -name '*.map' | wc -l   0        # sourcemap fix (#196) present
```

I also independently re-ran the `DUP-DROP` mutation, locating the line **by
content**: 2 failures, exit 1, tree restored clean. **Confirmed DEAD.**

**Do not spend your round re-establishing that the suite is green.** Spend it on
what green does not prove.

## FOUR THINGS I SPECIFICALLY WANT SCRUTINISED

### 1. The dev reinterpreted my acceptance criterion. Judge whether they were right.

I required the H-1 deliberate-rename simulation to go **RED** after the fix. The
dev showed it goes **green**, and argued that green is *correct*: the fix makes
the component **derive** from the constant, so a rename propagates and there is
no inconsistency left to detect. A red there would be a test asserting the rename
*didn't* propagate.

They ran drift **re-introduction** instead — rename, update the anchor, then
re-hardcode the inspector literals — and got **407/407 green pre-fix vs 10
failures post-fix**.

**I believe they are right and I have recorded my criterion as wrong.** But I am
one person and this is the blocker the whole round existed to close. **Reach your
own conclusion.** If the dev's reinterpretation is wrong, then H-1 is *not*
pinned and the round's headline fix is unverified. Specifically: is there any
drift the derive-from-constant approach still admits — a *third* surface that
neither derives nor is anchored?

### 2. The derived loops still shed cases. Is the membership assertion enough?

Under `DUP-DROP` the derived loops shed a case each rather than failing on the
missing case; the fix adds an explicit membership assertion beside each loop so
the shedding is no longer silent. That is the agreed design (the widening
protection is worth keeping). **Verify the assertion actually fires for all
four loops**, and that a *fifth* instance of the pattern was not missed —
the original grep found four across three files, and the code review had named
only two.

> **A number to not chase.** The report explains `DUP-DROP`'s post-fix total of
> `414` as loop shedding. At the final tree I measure `420` — shedding is **2**,
> not 8; the other 6 are tests that did not exist when that mutation was run.
> Number right, explanation wrong. Per-item mutation totals in that report are
> relative to the tree at that item, not the final tree.

### 3. `d039810` is the only production change — treat it as such

Everything else is test-only. This commit extends `ATTENTION` with
`calloutTitle` / `calloutBody(n)` and rebinds four call sites in
`ft-inspector-relationships.ts`. Check the rendered copy is actually correct for
users, not merely consistent with a constant — consistency with a *wrong* string
is still wrong. Contract §11 semantics matter here: `cancelled` / `wont_fix` /
`duplicate` prerequisites do **not** auto-unblock dependents, and the copy is
supposed to convey **permanence** ("nothing will clear these on its own"), not a
merely-current block. Check the pluralisation branch and `n === 1`.

### 4. Re-verify the five previously-dead mutants — and read this first

`CMP-02`, `F3-05`, `RANK-09`, `ATT-01`, `ATT-02` were dead before round 5 and
must still be dead. Three kill the **node** runner, which aborts `npm test`
before vitest runs, so run both halves separately.

> **`ATT-02` deserves special care, and it is the source of a new standing bar.**
> The dev's first sweep reported it SURVIVED. It had not — item 1 added ~25 lines
> to `task-state-utils.ts`, so a `sed '302s/...'` addressed a **stale** line and
> landed harmlessly inside a docblock. The mutation never applied. Re-run against
> the real function body, it is DEAD.
>
> **STANDING BAR, new tonight: address mutations by CONTENT, never by line
> number** — certainly never on a file that has been edited since you read it.
> A line-addressed mutation on a shifted file manufactures a false negative that
> looks exactly like a real finding. It is the same family as "tests that
> disappear instead of failing": the measurement silently stops measuring while
> still returning a clean-looking verdict.

## Standing bars on this workstream

1. **Mutation testing is the bar.** "Verified" without pasted actual failing
   output is not evidence. Apply it to your own findings: if you assert something
   is or is not covered, prove it by breaking it.
2. **Address mutations by content, not line number** (above).
3. **The self-built oracle defect class** — a test asserting against a local
   re-implementation instead of the real exported symbol. Thirteen removed on
   this workstream, a fourteenth rejected, and **three reviewers hunted a
   fifteenth on this very branch at `633f8f2` and found none**. Round 5 added 15
   tests. **Hunt again in the new ones.** Note the membership assertions name the
   three stages *literally* — that is deliberate and is not an oracle: a literal
   is the only thing that can detect narrowing.
4. **Tests that disappear instead of failing** — a case list built by filtering
   through the predicate under test protects against widening and is blind to
   narrowing; a suite that counts its own checks without asserting the total goes
   green when a check is deleted.
5. **Sink-binding** — tests exercise a function thoroughly while nothing proves
   production still calls it.
6. **Do not self-review.** This reviews fixes to your own findings.

## Explicitly OUT of scope — deferred to the cleanup branch, do not re-litigate

M-4 (containment fixture), M-5 (generic filtered empty state), L-1/L-3
(vocabulary anchor claim + grep lint), L-2 (`ft-tree-node` drifted stage labels),
L-4 (derive `BOARD_COLUMNS.label`), the `matchesTaskFilters` object-parameter
refactor, `REL_GROUP_LABEL`/`REL_GROUP_ORDER` unpinned in the anchor, audit I-1
(`onViewChange` cast), audit I-2 (**there is no CI on this project** — that
invariant was routed into the deploy plan instead), test F-3 (numeric availability
reasons), F-4 (queue+attention combination), `optgroup`, and the two pre-existing
Go-side items (`unified.go:83`, `ft-toolbar.ts:552` `rel`).

**Also out of scope, newly logged by the dev:** the pre-existing test named
*"rolls the whole band back when a renumber fails part way through"* rejects on
write **one**, so it does not exercise a genuine part-way failure despite its
name. The new multi-write test covers the real case. Logged as a follow-up.

**All three reviewers independently endorsed four deferred design decisions**
(required `store` param; no special-casing "All clear!"; the `ft-task-card` scope
exception; unanchored copy — the one escalated, now fixed). Do not revisit.

If you find something **Critical or High**, say so immediately and prominently.

## Rules

- **Do not push.** Do not modify production code — your independence depends on
  it. If you commit anything, commit only your own project log entry.
- Confirm `git rev-parse --short HEAD` = `bcd40a4` before anything else.
- Severity (Critical / High / Medium / Low / Info) + `file:line` + a concrete
  recommendation on every finding. Clear verdict: **APPROVE** or
  **REQUEST CHANGES**.
- **Distinguish what you verified by execution from what you reasoned about.**
  That distinction has repeatedly been the difference between a real finding and
  a wrong one on this workstream — including the ruling that created this round.

## Note on sequencing

The `code-reviewer` template is blocked by an infrastructure fault, so the
code-review leg runs **later, at this same SHA `bcd40a4`**. The gate still
requires all three approvals and is **not** being reduced to two. Review as
though the third report will contradict yours — on the last round, it did.
