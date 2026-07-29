# patchid-exposure — classification of the 126 unreachable commits

Investigator leg. Read-only. 2026-07-29.
Artefacts: this file + `preserve/PATCHID-CLASSIFICATION.tsv` (126 rows, one per commit).

---

## HEADLINE

**Of the 41 ordinary feature commits, 5 contain content that exists nowhere in published
history. The other 36 are safe: 14 are exact or containment duplicates, 22 are pre-merge
intermediate drafts whose substance is present in published main.**

**And none of the 5 is lost product work.** They are, in full:

| sha | what it is |
|---|---|
| `ba93de89684e18a6c5d075dd035e14cd3ea10541` | `internal/decomposer/llm_openai.go` (122 lines) — an **abandoned alternative LLM backend**. The decomposer feature itself IS published; main ships `internal/decomposer/llm_anthropic.go` instead. This is a superseded design choice, not lost work. |
| `b1124cf4fd8e67f05905df9c44b6ec8447888b08` | `internal/server/remotedata_depth_test.go` (81 lines, **a test**) + a project-log file. Main has 18 test files under `internal/server` but not this one. This is the only entry with arguable engineering value. |
| `6eca2ef45f273943dd6df135b29a263c0c7eb657` | `.design/project-log/2026-07-21-b7-read-only-mode.md` (36 lines) — **documentation** only. |
| `cc6d6239b5f6229836480f3a871242afb851a0de` | `.design/project-log/url-scheme-validation-r5-fix-round.md` (9 lines) — **documentation** only. |
| `a6c4219e688f83e4b5d52968b268af7386b73b08` | `WORKTREE_TEST.md`, **one line** — a **scratch experiment**. |

So: this is a curiosity, not an incident. The single item a human might want to look at is the
81-line test in `b1124cf`. Everything else is docs, scratch, or a deliberately-replaced backend.

**A negative stated plainly, as asked:** no published feature work is at risk of being lost.

---

## THE ACTION DID NOT BUY THE OUTCOME — AND THIS IS THE MOST IMPORTANT FINDING

The brief commissioned patch-id comparison. **Patch-id alone cannot settle this question, and
if I had reported its raw output it would have been wrong in exactly the dangerous direction
the brief warned about.**

Raw patch-id result, for the record:

- 54 of 126 commits have a computable patch-id. 36 are merges (stash envelopes, 2–3 parents),
  36 are empty relative to their first parent. Neither has a meaningful patch-id.
- Of those 54, **only 9 matched** a published patch-id. Taken at face value that reads as
  *45 commits of unpublished content* — an apparent incident.

That reading is false. **Published main coalesces multiple feature commits into single
commits, and its commit subjects are offset from the content they carry.** Worked example,
which I verified blob-by-blob:

- Unreachable `9f5dec3` "feat: add poll-on-interval refresh for external collections" —
  6 files, 377 insertions. Patch-id: no match.
- Published `7c5dbc8` carries the matching subject "…poll-on-interval refresh… (#103)" and is
  **empty** — its tree is byte-identical to its parent's.
- The actual content landed in published `2b2908e`, whose subject reads "test: add graph query
  integration tests (C4) (#102)". That commit is 9 files / 800 insertions: the C4 test work
  **plus the whole of the B8 poll-refresh work**.
- All 6 files of `9f5dec3` are present in `2b2908e` at **identical blob SHAs**.

A patch-id is a hash of a whole-commit diff. It cannot match a 6-file commit against a 9-file
commit that properly contains it. Against a history assembled this way, patch-id systematically
under-reports duplicates. It produced 9 true positives and **26 false "unique" verdicts**.

I therefore did not stop at patch-id. Patch-id results are retained in the TSV
(`match_method = "patch-id --stable exact"`) as the strongest evidence where it fired.

---

## THE INSTRUMENT I USED INSTEAD

**(path, blob) containment.** For each commit, the set of `(path, post-image blob)` pairs it
introduces relative to its first parent (or the empty tree if parentless), tested against the
set of every `(path, blob)` pair appearing in **any of the 295 trees** of published history —
not just the tip. 1,270 distinct published (path,blob) pairs; 455 distinct published paths.

This is store-independent: a blob SHA is content, so it compares correctly across repositories.

For pairs that do **not** match, I then asked whether the **path** is published in any version:

- path published, blob not → **SUPERSEDED_DRAFT** (an intermediate state of a file that did land)
- path never published at all → **UNIQUE** (candidate genuinely-absent content)

For SUPERSEDED_DRAFT I ran a third, independent corroboration: extract distinctive added
identifiers (≥12 chars) from the draft diff and test their presence in published main.
**21 of the 22 such commits among the 41 scored 100%** — every distinctive identifier they
introduced is in published main. The 22nd (`4acc02d8`) yielded no identifiers (a one-line CSS
change) and is treated separately below.

---

## PUBLISHED MAIN: SHA AND HOW OBTAINED

**Compared against `cc927355e5a23c45bfd983cd331eb540b0a61ad5`.**

Method:
1. `git -C /workspace/farmtable ls-remote origin` against
   `https://github.com/scion-frontiers/farmtable.git` → `refs/heads/main = cc92735`.
2. Fetched into a **throwaway clone at `/tmp/pubmain`** (cloned `--no-checkout --no-local` from
   `/workspace/farmtable`, remote then repointed at the GitHub URL, then
   `fetch --no-tags origin main`). No existing tree was written to. No ref was created,
   deleted or updated anywhere in `/workspace`.

**The staleness warning is real and I confirmed it.** Every local tree on this host has
`refs/heads/main = 7a0f220dbd9332cb8db62138c841777432b4eda4`. `7a0f220` is an ancestor of
`cc92735`, exactly **12 commits** behind. The 12 are all CI/build scaffolding (GitHub Actions
setup, PR #205) and none of them carries feature content, so in this instance the stale value
would not in fact have changed a single classification — but I compared against the server
value regardless and every number here is against `cc92735`.

**A trap worth flagging for the next leg:** a bare `git ls-remote origin` is *not* safe on this
host. Many clones have a **local path** as `origin` (e.g. `farmtable-em-verify195` →
`/workspace/farmtable-markdown-sanitize` → `/workspace/farmtable`). My first ls-remote ran in
such a clone and returned the stale `7a0f220` while looking exactly like a server answer.
Always resolve from a clone whose origin is the GitHub URL.

---

## BOUNDS ON THIS SEARCH (stated here, in the artefact that carries the finding)

- **History bound: NONE.** I did not bound by date or by depth. The published index covers all
  295 commits reachable from `cc92735`, from the root commit forward. Full history was cheap at
  this size, so no bound exists to caveat.
- Published index covers `cc92735` **only** — not other remote branches, not tags, not PR refs.
  Content living only on an unmerged remote branch would be scored UNIQUE here.
- Containment ignores **deletions**. A commit that only removes files introduces no blob and is
  scored NO_CONTENT. This affects the stash/index debris, not the 41.
- Rename detection **disabled** (`diff.renames=false`) on both sides, consistently. A pure
  rename appears as an unmatched path pair.
- Patch-id computed with `--stable`, with `--binary --no-ext-diff --no-textconv` and identical
  diff config on both sides.
- **All counts are deduped by commit SHA.** 126 distinct SHAs in, 126 rows out, no SHA appears
  twice in any bucket.
- `--no-auto-maintenance` is **not supported by this host's git** and was rejected. I used
  `-c gc.auto=0` (plus `-c maintenance.auto=false` where a write was possible) on every
  invocation instead. No `gc`, `prune`, `repack` or `reflog expire` was run. No ref was created,
  moved or deleted. `/workspace/farmtable-em-verify195` was read via `git -C` only.

---

## CLASSIFICATION — ALL 126

Deduped by SHA. Categories are exclusive.

| category | count | meaning |
|---|---|---|
| DUPLICATE | 36 | content already in published history (9 by exact patch-id, 27 by full (path,blob) containment) |
| SUPERSEDED_DRAFT | 45 | every touched path is published, but this exact file version is not — a pre-merge intermediate |
| NO_CONTENT | 36 | introduces no blob at all; empty relative to first parent |
| UNIQUE | 9 | introduces at least one path absent from all 295 published trees |

**SUPERSEDED_DRAFT and NO_CONTENT are the two categories the brief did not ask for, and
together they are 81 of 126.** Reporting them as UNIQUE — which is what a naive patch-id run
does — is what generates a false incident.

### The 41 ordinary feature commits

| category | count |
|---|---|
| DUPLICATE | 14 |
| SUPERSEDED_DRAFT | 22 |
| UNIQUE | 5 |

I reconstructed this population independently and it reconciles exactly with the brief:
82 TREE_UNIQUE = **41** ordinary feature + **39** stash-shaped + **2** negative controls.
The 39 stash-shaped are 28 `WIP on`, 4 `index on`, 2 `On `, and 5 `untracked files on`.
Those last 5 have ordinary-looking subjects and must be excluded to land on 41 — that is the
whole of the 46-vs-41 discrepancy, and I flag it because a classifier keying on subject prefix
alone will get 46 and quietly disagree with the brief.

### The 4 UNIQUE outside the 41

All stash debris, no product source:

- `b9de062d5d0d0762a3da47016d4af7216dcfb813` (stash untracked) — `.scratchpad/` review note,
  `.eng-manager-state.md`, one generated file `web/src/gen/grpc-error.ts`.
- `d6d91c26204d3cffae8f69e266e8a12e988e890a` (stash untracked) — 48 novel paths: 36 `.scratchpad/`,
  9 `.design/` agent notes, `.eng-manager-state.md`, and a root-level `package.json`/`package-lock.json`
  that is a 3-line Playwright dependency stub (published main has `web/package.json`, not a root one).
- `e60519fd850175bd6c8ab091132890b19c640c0c` (stash untracked) — same 48-path set as above.
- `e222bf59b01934fa92792e07b5f86acef4c756b1` (stash WIP) — `web/src/util/markdown.test.ts`,
  15 added lines, **a test**. `web/src/util/markdown.ts` itself is published; this test file
  is not. Second-most interesting item in the whole population after `b1124cf`.

### The 2 negative controls — classified and left alone, as instructed

- `d16632d9a240742adaf4b3bee2798978fe228f9c` — "NEGATIVE CONTROL for the #170 preserve-ref fetch"
- `46827eddd9e31d950071cd04e046c2e2f9412012` — "NEGATIVE CONTROL #2 … DO NOT FETCH THIS"

Both are **parentless commits with a genuinely empty tree** → NO_CONTENT. They carry no content
to lose. I did not fetch them, did not rescue them, and they are excluded from every
recommendation here.

### The one SUPERSEDED_DRAFT exception worth naming

`4acc02d8cfa3b3ad613002e476a519fc88974a19` "feat(web): add independent vertical scroll to main
content area" is a **single line** — `min-height: 0` in `ft-kanban-view.ts`. I checked directly:
that line is **not** present in the published version of the file (control in the same query:
5 occurrences of `display: flex` in the same file, so the query was live). The file was
substantially reworked on main and now solves the layout with `overflow: auto`. So this one line
genuinely did not land, but it is one CSS declaration against a rewritten file, not lost work.

---

## TWO CORRECTIONS I MADE TO MY OWN MEASUREMENT

Recording these because both produced clean-looking wrong answers first.

1. **Parentless-commit parse bug.** I derived parents with
   `git rev-list --parents -n1 <sha> | cut -d' ' -f2-`. For a commit with **no** parents there is
   no space, so `cut` returns the SHA itself — the commit was then diffed against itself and
   scored NO_CONTENT, i.e. "nothing here". This silently swallowed 7 commits (5 stash-untracked
   + both negative controls). Fixed by using `git log -1 --format=%P`, which is empty for a root
   commit. This moved 3 commits from NO_CONTENT to UNIQUE. It is precisely the coordinator's
   "the work was empty and success is what empty looks like" failure.

2. **Tab is IFS-whitespace in bash.** `while IFS=$'\t' read -r a b c …` **collapses consecutive
   tabs**, so empty fields vanish and every later column shifts left. My first
   `PATCHID-CLASSIFICATION.tsv` had subjects sitting in the `matched_published_sha` column for
   every row with an empty match. Caught by eyeballing a UNIQUE row; the file was regenerated
   entirely in awk. The delivered TSV is verified at 126 rows, 126 distinct SHAs, all 12 fields
   present on every row.

On the coordinator's Clause 2: the central claim here is a negative ("no published match"). Its
control is in the same invocation — the same join that returned 45 non-matches returned 9
matches, and the same path-presence query that returned 6 absent paths returned 3 present ones
plus a canary that correctly returned absent. No absence in this report rests on a command that
returned nothing.

---

## OPEN QUESTIONS

1. **CLOSED (Addendum 2, coordinator concurring 09:13Z).** The blob is REF-HELD in commit
   `26ca5b6` on refs `url-scheme-validation-r5`, `url-scheme-validation-r6` and
   `preserve/dev-103-testlist/xss-pin-0256Z`. It survives the freeze lifting, so no human needs
   to adjudicate whether it was abandoned deliberately. Original question retained below.

   ~~**`internal/server/remotedata_depth_test.go` (in `b1124cf`) — is it wanted?**~~ It is 81 lines
   of server test on a path main has never had, dated 2026-07-29 02:42, hours before the freeze.
   Its sibling commit `cc6d623` (02:43) edits the same project-log file and reads like the same
   working session. I cannot tell from the object graph whether this was abandoned deliberately
   or simply never pushed. A human who recognises the URL-scheme-validation R5 work could settle
   it in a minute. This is the one thing in the population I would ask about.

2. **CLOSED (Addendum 2, coordinator concurring 09:13Z).** Blob `1fcbf3e9` is REF-HELD in commit
   `7084880` on refs `test-list-reconcile-103` and `preserve/195/audit-195-r5/markdown-sanitize`.
   Not at risk.

   ~~**`web/src/util/markdown.test.ts` (in `e222bf5`)** — same question, smaller: 15 lines of test
   for a published module, sitting in a stash. Cheap to recreate; worth a glance.~~

3. **Was `llm_openai.go` dropped deliberately?** Published main ships `llm_anthropic.go` in the
   same package, so almost certainly yes. I did not find a decision record either way. If it was
   dropped by accident, 122 lines of working OpenAI backend are recoverable from `ba93de8`.

4. **Unmerged remote branches are outside my bound.** I compared against `main` only. If content
   scored UNIQUE here also lives on an open PR branch on the server, it is safer than I have
   said — never less safe. Resolving this needs `ls-remote` over all remote refs and a wider
   index; it would only ever move commits *out* of UNIQUE.

5. **I could not fully verify the 22 SUPERSEDED_DRAFT commits line-by-line.** The identifier
   landing check is strong corroboration (21/22 at 100%) but it is a heuristic: an identifier can
   be present in main for reasons unrelated to this draft. Proving these byte-exactly would mean
   a per-hunk containment test against the published file at merge time. Given 100% agreement
   across 21 commits and three independent instruments pointing the same way, I judged the
   marginal certainty not worth the cost — but that is a judgement, and it is the softest claim
   in this report.

---

## ADDENDUM 2026-07-29T09:0x — CREDENTIAL SWEEP OF THE RESCUE CANDIDATES

Prompted by `farmtable-relocate-offhost` adding `/test-writethrough.db` to
`/workspace/farmtable/.git/info/exclude` at 09:01:15Z, because that file was one `git add -A`
from publishing a live credential.

**That edit does not affect any number in this report.** Every figure here was derived from
committed objects (`cat-file`, `ls-tree`, `diff-tree`, `patch-id`) and no enumeration in this
leg ever consulted the working tree, `git status`, or `--exclude-standard`. The
untracked→ignored ±1 delta cannot appear in these populations. Nothing retracted.

The notice did raise a real question for the deliverable, since 3 of the 9 UNIQUE commits are
**stash-untracked** commits, which freeze untracked files into committed blobs. Checked:

- `test-writethrough.db` appears **0 times** across all 126 commit trees. Canary in the same
  loop: `go.mod` found 119 times, so the query was live.
- Broad sweep for `*.db`, `*.sqlite*`, `*.env`, `*.pem`, `*.key`, `*secret*`, `*credential*`,
  `token*.json|yaml` across all 126 trees returns exactly one path family:
  `.design/project-log/auth-stage6-credential-improvements.md`, in 12 of the trees. That is a
  **design document** matched on the word "credential" in its filename, and it is already
  published (present in `pub-paths`). Not a secret.

**Conclusion: the rescue candidates are clean.** Acting on the recommendation below carries no
credential-exposure risk. Contents of matched paths were never printed at any point.

Standing order noted and complied with: no `git add -A` or `git add .` was run by this leg, and
none could have been — this leg made no commit, staged nothing, and created no ref.

---

## ADDENDUM 2 — REF-REACHABILITY OF THE UNIQUE CONTENT: THERE IS NOTHING TO RESCUE

Prompted by the coordinator's 09:12Z amendment, whose stated lesson — *"I enumerated instances
where I should have named the property"* — applies to my own credential sweep above, which
matched on a list of file extensions I happened to think of. I replaced it with the property:
**every path any of the 126 trees could introduce that is absent from published history.**
That set is 76 paths, small enough to enumerate in full rather than pattern-match. The complete
list contains **no database, credential, key or env file** — the earlier CLEAN verdict holds,
now on a proper basis rather than a lucky pattern.

But the complete list surfaced something my per-commit classification had missed, because it
scored each commit by *what it introduces relative to its parent*, not by *what its tree holds*:
14 of the 76 novel paths are real source and test files (`internal/server/urlvalidate*.go` and
its four test files, `web/src/util/safe-url.ts`, `internal/decomposer/retry.go`,
`testdata/url-scheme-cases.json`, and others). None of these is on published main.

**Every one of them is ref-reachable.** `urlvalidate.go`, `safe-url.ts`, `retry.go` and
`assertions.ts` are each held by refs in 6–8 separate clones. They are in-flight unmerged work,
not GC exposure.

I then checked the exact blobs of the items I had recommended for rescue:

| item | exact blob | status |
|---|---|---|
| `internal/server/remotedata_depth_test.go` (`b1124cf`) | `ac0a5b70` | **REF-HELD** — in commit `26ca5b6`, on refs `url-scheme-validation-r5`, `url-scheme-validation-r6`, `preserve/dev-103-testlist/xss-pin-0256Z` |
| `web/src/util/markdown.test.ts` (`e222bf5`) | `1fcbf3e9` | **REF-HELD** — in commit `7084880`, on refs `test-list-reconcile-103`, `preserve/195/audit-195-r5/markdown-sanitize`, and others |
| `internal/decomposer/llm_openai.go` (`ba93de8`) | — | **REF-HELD** in `/workspace/farmtable` |

**So the recommendation in the section below is superseded: there is nothing to rescue.** All
three items with any engineering value are held by named refs and survive the freeze being
lifted. My earlier "two test files worth recovering" was correct that they are unpublished, but
wrong to imply they are at risk. This correction runs in the safe direction — less exposure,
not more. Open questions 1 and 2 are closed by it.

### THE ACTUAL LOSS EXPOSURE, QUANTIFIED — 48 AGENT-SCRATCH NOTE FILES

On the coordinator's instruction to keep this population visible rather than filed under
"scratch", it is measured rather than characterised. Of the 55 novel note-files across the 126
trees, **48 have no ref-reachable commit containing that path anywhere on this host** — they
exist only inside unreachable commits and are the real content cost of lifting the freeze:

| count | location | what it is |
|---|---|---|
| 33 | `.scratchpad/pr-reviews/` | PR review write-ups |
| 7 | `.design/reviews/` | PR review documents |
| 4 | `.scratchpad/` | task and fix-round notes |
| 3 | `.design/project-log/` | project logs |
| 1 | `.eng-manager-state.md` | engineering-manager state |

They are concentrated in two stash-untracked commits — `e60519fd` and `d6d91c26` carry 46 each
(largely the same set) — with the remainder spread across `cc6d623`, `b1124cf`, `e222bf5`,
`b9de062d`, `7de04f21` and `6eca2ef`.

This is reasoning and methodology, not product code: regenerable in the sense that someone could
write it again, unrecoverable in the sense that nobody will. It is the largest genuine loss in
the population and it is the only part of my loss list that is not trivial or machine-regenerable.

**A precision note that partly refines the list below.** The 7 remaining note-files *are*
ref-held at path level, but path-held is not revision-held: `.design/project-log/url-scheme-validation-r5-fix-round.md`
has its path on a ref while the specific blob in `cc6d623` (`1e5a1c2d`) is not on any ref. So the
file survives; that revision of it does not. The same distinction the coordinator filed as
"unpublished and at-risk are different predicates" recurses one level down —
*path-reachable* and *blob-reachable* are also different predicates, and the second does not
follow from the first.

Controls for the above, same invocation, producing visibly different output per Clause 4:
`go.mod` → `28d9f94`, `.design/project-log/markdown-sanitize.md` → `204af7e`, fabricated path →
`<EMPTY: no ref-reachable commit>`.

What is genuinely held *only* by unreachable commits, and would actually be lost, is exactly
four blobs plus the 48 note-files above:

- `.design/project-log/2026-07-21-b7-read-only-mode.md` (36 lines, docs)
- `.design/project-log/url-scheme-validation-r5-fix-round.md` (9 lines, docs)
- `WORKTREE_TEST.md` (1 line, scratch)
- `web/src/gen/grpc-error.ts` (generated code, regenerable)
- the `.scratchpad/` and `.design/` agent notes inside the three stash-untracked commits

Method note: the first pass of this check used `git rev-parse "<sha>:<path>"` as an existence
gate, which **echoes the unresolvable argument instead of returning empty**, so a missing path
fell through into the "not ref-held" branch and looked like a finding. Caught by a canary that
failed to discriminate. Re-run with `rev-parse --verify --quiet`; the four negatives above are
reported only from the corrected run, which carries a positive control (a known ref-held blob
returning REF-HELD) and a negative control (a fabricated path returning BLOB-LOOKUP-FAILED) in
the same invocation.

---

## RECOMMENDATION

*(Superseded in part by Addendum 2: the two test files named here are ref-held and need no
rescue. Retained as written for the record.)*

**No escalation.** This does not require a human decision as an incident.

Do not spend rescue effort on the 126 as a population: 81 of them carry no recoverable content
at all (36 empty, 45 superseded intermediates), 36 are duplicates of published work, and of the
9 UNIQUE, 3 are agent scratch directories, 2 are project-log docs, 1 is a one-line scratch file,
and 1 is a deliberately-replaced LLM backend.

The only items with any engineering value are **two test files** — `b1124cf`
(`remotedata_depth_test.go`, 81 lines) and `e222bf5` (`markdown.test.ts`, 15 lines). Both are
small enough to re-author from scratch if wanted. If a rescue is authorised, it needs to cover
those two commits only, and it must exclude the two negative controls.

**Scope: XS.** The measurement was the work. The remediation, if any is wanted at all, is
copying two test files out of an object store.
