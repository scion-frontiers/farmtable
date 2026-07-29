# Shared baseline — `#195` round 10 review legs

Read this in full before your own brief. Everything here applies to all three legs.

## Provenance labelling — new this round, and it is about my errors, not yours

Every factual claim below carries a tag. **Treat them differently:**

- **`[MEASURED — me, this session]`** — I ran the command in the stated arm at the stated time.
  Still re-measure anything load-bearing, but you may plan around it.
- **`[REPORTED]`** — an agent told me. I did not verify it. Verify before relying on it.
- **`[UNVERIFIED SUGGESTION]`** — a remedy I am proposing without having run it. **Do not
  implement one of these without first reproducing the RED it is supposed to fix.**

This tagging exists because the previous round's leg found that **two of the concrete fixes I
suggested were wrong** — one would have shipped a fixture asserting the *opposite* of the measured
truth, and one would not have caught the mutation it was proposed for. A wrong fact in a brief is
mostly inert, because you re-measure it. A wrong suggested *remedy* is not inert, because
implementing it looks like success. If a suggestion of mine is untagged, treat it as
`[UNVERIFIED SUGGESTION]`.

## Your tree — run the command, do not trust my path

**Do not trust any sentence in a brief that tells you where you are.** I have shipped that sentence
wrong. Run:

```
git rev-parse --show-toplevel
git rev-parse HEAD
```

You should be at **`0b52dcdd6a06f694378084ea3ebefa7d9c473f15`** on branch **`markdown-sanitize-r10`**.
Your clone is `/workspace/farmtable-195-r10-<review|test|audit>` `[MEASURED — me, this session:
created, checked out, `git status --porcelain` empty]`. **The SHA is the identifier. The branch name
and the path are not** — several branches in this project share a name across clones.

Shell calls that `cd` may reset to `/workspace` afterwards in this environment. Use absolute paths.

**The reports and briefs directories are NOT inside the repository.** They are at
`/scion-volumes/scratchpad/projects/farmtable/reports/` and `.../briefs/`. Relative paths resolve to
nothing.

`origin/main` **does not resolve** in these clones. Do not write a command that depends on it; two
separate legs have now reported this and I have written it wrong three rounds running.

## The change

`13680c2..0b52dcd`, 15 commits. `[MEASURED — me, this session, `git diff --stat`]`:

```
$ git diff --numstat 13680c2..0b52dcd
116     0    .design/project-log/markdown-sanitize-cleanup-r10.md
1071    98   web/src/util/markdown.test.ts
```

**Note the figures are `--numstat` (added / deleted), deliberately.** An earlier version of this
brief quoted `--stat`'s `1169` for `markdown.test.ts` as if it were an addition count; it is the
*changed-line total* (1071 + 98). I made that same conflation four times in the parallel `#194`
round and a reviewer caught it there, which is how I found it here. If you see a `+N` in any brief
of mine, check whether it came from `--stat` before relying on it.

**Two files. Zero production code.** `web/src/util/markdown.ts` is byte-for-byte unchanged
`[MEASURED — me]`. This round is 100% evidence. Whatever you conclude, you are concluding it about a
test suite, not about a behaviour change — **which means the usual question "does the code do what
the message says" collapses into the harder one: does this evidence establish what it claims to
establish about code it did not touch?**

## Your clone is deliberately unbuilt — reconstruct, do not observe

There is **no `web/node_modules` and no `web/dist`** in your clone `[MEASURED — me]`. This is
deliberate and it is a change from previous rounds, where I pre-built dependencies into leg clones
and then discovered that all legs were inheriting one environment's quirks as if they were N
independent confirmations. **Anything you are handed rather than build yourself is provenance, not
evidence.** Run `cd web && npm ci` yourself.

Consequence you will hit if you run Go gates: **`go build ./...`, `go test ./...` and `go vet ./...`
all exit 1 on a clone with no `web/dist`**, with `assets.go:5:12: pattern all:web/dist: no matching
files found` `[MEASURED — me, two-arm control]`. This is **pre-existing, identical to production,
tracked as task #100, and out of scope**. It is also a trap: a *built* clone also exits 1 on `vet`,
for a completely different reason (4 copylocks in `internal/server/server.go`). **Both arms exit 1.
The exit code cannot tell you which one you are in — only the message can.** Nothing in this round is
Go code, so you should not need Go gates at all; this is here so you do not misread them if you run
them.

## Gate baseline

`[REPORTED by dev-195-r10 — I have NOT independently re-run these]`, in `web/`:

| gate | result |
|---|---|
| `npm test` | 0 — 83 checks / 131 assertions |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `git status --porcelain` | empty |

Note the check/assertion totals: the report also quotes **82** checks in one mutation cell and
`EXPECTED_CHECK_CALL_SITES` moving 81 → 82. If you cannot reconcile 82 with 83, that discrepancy is
itself worth a line in your report — do not smooth it over.

**`tsc --noEmit` type-checks the whole project, including `*.test.ts`.** On a parallel branch this
exact fact turned an undeclared test-only dependency into a **failure of the production container
build**, because `Dockerfile.server` runs `npm run build`. An unrun test file is not an inert test
file. Ask what *reads* a file, not what *runs* it.

## What runs this suite — a claim of mine you should check

`[MEASURED — me, this session, at `0b52dcd`]`: `web/package.json`'s `test` script **does** now invoke
`node .tmp-test/util/markdown.test.js`, and `tsconfig.test.json`'s `include` names
`src/util/markdown.test.ts`.

`[MEASURED — me]`: the `Makefile` contains exactly two `npm` invocations — `cd web && npm ci && npm
run build` and `cd web && npm run dev`. `Dockerfile.server` runs `npm ci` and `npm run build`. There
is **no CI anywhere in this repository**.

`[MY INFERENCE, not measured — check it]`: therefore **nothing automatically invokes `npm test`**, and
this entire suite runs only when a human types it. Being named in the list and being executed are
different claims. I have been burned this session by exactly this shape — a true fact carrying a
false inference — so please test the inference rather than the fact.

## Method requirements

- **Do not push. Do not modify production code.** `markdown.ts` in particular must end byte-identical.
- Probes are fine. **Revert by snapshot restore (`cp` from `/tmp`), never `git checkout`** — a
  previous leg lost uncommitted work that way. Assert `git status --porcelain` empty after every
  cell and report the count of cells where the tree was dirty after restore.
- **Never read an exit code through a pipe.** `cmd | tail` gives you `tail`'s status. I made this
  exact mistake this session. Redirect to a file and read `$?` from the child directly.
- **A negative claim needs a positive control.** "I grepped and found nothing" is not a result unless
  you also show the grep finding something it should find.
- **Read messages, not codes or counts.** Two arms returning the same value for different reasons is
  the recurring way this project has fooled itself.
- **Separate observation from inference in your own prose**, in those words.

## Out of scope

- Task #100 (`web/dist` clean checkout). The absent CSP (#85). Audit F7a–F7e. The Go workstreams
  (#194, Phase 2). The `url-scheme-validation` XSS branch — it is a **different branch** under
  separate review; do not review it here.
- **Do not invert `markdown.ts` to an allow-list.** That is tracked (#18) and is not this round.

## Deliverable common to all three legs

**An explicit, numbered list of every place your brief is wrong** — counts, SHAs, paths, line
numbers, claims, and especially any suggestion of mine. At least fifteen consecutive rounds have
contained at least one error; the previous round contained seven, two of them wrong remedies. Assume
yours does too, and note that "I found none" is a claim that will be read sceptically.
