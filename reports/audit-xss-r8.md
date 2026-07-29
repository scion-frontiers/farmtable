# SECURITY AUDIT — audit-xss-r8

**Commit under review:** `901670e3f09ad57386cafb8359017d8d61a75070`
**Branch:** `url-scheme-validation-r8`
**Range:** `e4e3d13..901670e`
**Tree:** `/workspace/farmtable-audit-r8` (mine alone; never left it)
**Leg:** `audit-xss-r8` (security axis)

---

# VERDICT: REQUEST CHANGES

> ## ⚠ SECOND REVISION, 13:32Z — READ BEFORE THE BODY. F1 IS DOWNGRADED AGAIN AND ONE OF MY
> ## HEADLINE SENTENCES IS RETRACTED AS FALSE.
>
> **RETRACTED:** *"The r8 leg built a genuinely good instrument and wired it to nothing."* That
> sentence is **FALSE.** `cc92735:.github/workflows/ci.yml` contains a step **`Go tests (invoked
> directly)`** running **`go test ./... -v`**. `internal/webguard` therefore **DOES** have an
> automated executor via the CI `pull_request` path. See **ADDENDUM C**, which supersedes
> ADDENDUM B and the ADDENDUM A sharpening.
>
> **HOW I GOT IT WRONG:** I enumerated the executor population as `{Dockerfile, Dockerfile.server}`,
> measured correctly that neither runs `go test`, and then **treated that population as CLOSED.**
> `ci.yml` was a third member **that I had already read and quoted elsewhere in this very report.**
> My own brief says a population is OPEN until proven closed; I applied that rule to the round's
> code and not to my own strongest finding.
>
> **F1: MEDIUM → LOW.** **REVISED COUNTS: 0 Critical / 0 High / 3 Medium / 3 Low / 3 Info.**
> **VERDICT UNCHANGED** — REQUEST CHANGES now rests on **F3 and F8 alone**, both untouched.
>
> **THIRD REVISION, 13:42Z — ADDENDUM D adds F10 [MEDIUM, PRE-EXISTING, LIVE ON `main`]:** Go test
> membership is **reported but never asserted**, while the JS side of the same workflow **does**
> assert. A Go test that silently stops running leaves CI **green**. **F10 is NOT graded against
> this branch and the round's counts above are unchanged.** It is the question F1's false premise
> was hiding: the executor exists — nothing checks that it still runs the guard.

> **REVISION NOTICE (post-reconciliation).** Everything from here to the line marked
> `=== END OF COLD PASS ===` was written to disk **before** I opened `_r8-PHASE-TWO.md` or any r7
> artefact, and is preserved **verbatim and uncorrected**, including the parts reconciliation
> proved wrong. **F1 is downgraded HIGH→MEDIUM and F2 is downgraded MEDIUM→LOW; F2's central
> accusation is WITHDRAWN — the claim I called misleading is in fact correct.** Two new findings
> (F8, F9) were added after reconciliation. **The revised severity table and the corrected verdict
> support are in §RECONCILIATION at the bottom; the cold-pass table below is superseded.** The
> verdict itself, REQUEST CHANGES, is unchanged — but it now rests on different findings than the
> ones I opened with, and per the common brief I am showing both rather than quietly restating.

**This verdict is about guard integrity, not about a new exploitable hole introduced by the
diff.** The one production behaviour change in this round is correct, non-regressive, and I could
not break it. I am requesting changes because the round's *stated* deliverable — a guard that goes
red when the property regresses — is, on this branch, executed by nothing automatic, and the round
did not add a guard for the one thing it actually fixed.

**Separating the verdict from its support:** if F1 and F3 were both false, this would be
APPROVE WITH CONDITIONS. Nothing in the diff made the product less safe. The diff is
overwhelmingly comment.

## PRE-REGISTERED WITHDRAWAL CONDITION (written before I went looking, per role brief)

> **F1 (my headline) is WITHDRAWN if anyone shows me an automated executor of `go test ./...`, or of
> `internal/webguard` specifically, that is reachable from `901670e`.** Any one of: a workflow file
> present in the tree at HEAD; a `go test` invocation in either Dockerfile; a CI commit that is an
> ancestor of HEAD; or a documented external runner pointed at this branch. I looked for all four.
> Three are measured absent below; the fourth is UNCHECKED and I say so.

I did NOT find a way to withdraw it. I did find, and report below, that the *web* half of the
guard apparatus **does** have a real automated executor — that is the acquitting evidence, and I
went looking for it deliberately because it is the number that damages my own headline.

---

## SUMMARY

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 1 |
| INFO | 2 |

**Total: 7 findings (F1..F7).** F4 and F5 are PRE-EXISTING and NOT caused by this diff; per role
brief §4 they are reported separately and are not graded against this branch.

Reachability legend, per role brief §2: **LIVE** / **LATENT** / **UNREACHABLE**.

---

## FINDINGS

### F1 — [HIGH] The Go-side guard apparatus has no automated executor on this branch. r8's headline deliverable is a test nothing runs.

- **Reachability:** LATENT (guard-integrity defect; not itself an attacker path)
- **Tag:** [MEASURED]
- **Location:** `internal/webguard/remotedata_consumers_test.go`, `func TestWebCensusAnchoringIsTopLevelOnly` (added this round); executor absence measured at repository root.

**Description.** The role brief asks: *"what goes RED when someone adds a new sink tomorrow?"* On
this branch, for the Go half: **nothing, unless a human types it.**

Three measurements, all at `901670e`:

1. **No CI configuration exists at HEAD.** `.github/` contains exactly two tracked files, and
   neither is a workflow:
   ```
   $ git ls-files '.github'
   .github/ISSUE_TEMPLATE/bug_report.md
   .github/PULL_REQUEST_TEMPLATE.md
   ```
2. **Neither container build runs `go test`.** Both Dockerfiles run `npm test`, then `go build`.
   `go test` appears in neither:
   ```
   $ grep -n -e 'npm' -e 'test' -e 'RUN' Dockerfile
   4:RUN npm ci
   9:RUN npm test
   10:RUN npm run build
   16:RUN go mod download
   19:RUN CGO_ENABLED=1 go build -o /ft ./cmd/ft
   ```
   (`Dockerfile.server` is identical in this respect — measured, same command.)
3. **The Makefile itself says so.** `Makefile` header comment, verbatim: *"An audit measured the
   break here rather than at the **absent CI** … independently of the CI item (#22)."* The project
   knows CI is absent and is tracking it as an open item.

**The asymmetry, which is the actual finding.** The *web* guards
(`safe-url.test.ts`, `url-binding-scan.test.ts`) **do** have an automated executor: `RUN npm test`
at `Dockerfile:9`, with an in-file comment stating *"The URL-binding guard runs here or nowhere."*
That is true and it is good. But `internal/webguard` is a **Go test package**, and the release path
that runs the web guard deliberately does not run the Go one. So this round's headline artefact —
a regression guard whose entire justification is that "nothing else did" go red — landed on the
side of the seam that has no runner.

**Impact.** The basename-pruning defect that `TestWebCensusAnchoringIsTopLevelOnly` exists to catch
can be reintroduced, and the container image will still build and ship green. The test's own
docstring states the stakes: under the basename form, *"a live undeclared consumer planted in
`web/src/util/dist/` was invisible to all of them."*

**Recommendation.** Add `go test ./...` to the builder stage of both Dockerfiles, mirroring the
existing web-side precedent and its comment:

```dockerfile
FROM golang:1.26-bookworm AS builder
...
COPY . .
COPY --from=frontend /app/web/dist ./web/dist
# The remote_data consumer census lives in internal/webguard and is a GO test.
# The web guard runs in the frontend stage; this is the other half of the same
# property and it must not be able to ship red either. See Makefile: test-go.
RUN go test ./...
RUN CGO_ENABLED=1 go build -o /ft ./cmd/ft
```

This is a two-line change and does not depend on CI item #22 landing. **Do not** substitute
`make test` here — the Makefile comment already explains why routing a gate through the Makefile
makes the gate load-bearing on a Makefile edit.

---

### F2 — [MEDIUM] `doc.go` cites a CI workflow as a live constraint. That workflow is not on this branch, and the r8 diff edited this file without correcting it.

- **Reachability:** LATENT (false assurance in a security-argument artefact)
- **Tag:** [MEASURED]
- **Location:** `internal/webguard/doc.go`, the `IT CANNOT SEE THE BYTES THE SERVER ACTUALLY SHIPS` paragraph.

**Description.** `doc.go` states: *"At cc92735 the CI workflow asserts web/dist is ABSENT on
checkout and produced by the run, which constrains that gap from a different direction without
closing it."*

Measured:

```
$ git cat-file -t cc92735
commit
$ git merge-base --is-ancestor cc92735 HEAD && echo YES || echo NO
NO
$ git ls-tree -r --name-only cc92735 | grep -i workflow
.github/workflows/ci.yml
```

So the workflow is real, and it is genuinely good — I read it (`git show
cc92735:.github/workflows/ci.yml`); it runs `go test ./... -v` directly, checks suite membership
rather than exit codes, and would fully resolve F1. **But `cc92735` is not an ancestor of
`901670e`,** and `.github/workflows/ci.yml` does not exist at HEAD (F1 measurement 1).

The sentence is *technically* scoped — it says "At cc92735" — but it sits in a paragraph whose job
is to bound what this package's guard does and does not constrain, and it reads as a live
mitigation. r8 **modified this exact file** (33 insertions) and left the sentence standing.

**Impact.** A reader auditing the webguard correctness argument on this branch is told a CI
constraint exists. It does not exist here. This is precisely the "fails toward the last thing
authority broadcast" failure the common brief names.

**Recommendation.** Amend to state the branch-relative truth:

```go
// At cc92735 -- WHICH IS NOT AN ANCESTOR OF THIS COMMIT -- a CI workflow asserts
// web/dist is ABSENT on checkout and produced by the run. THAT WORKFLOW IS NOT
// PRESENT ON THIS BRANCH: `.github/` here contains only issue and PR templates.
// Nothing constrains this gap on this branch today. Tracked as CI item #22.
```

---

### F3 — [MEDIUM] The round's only production fix has zero test coverage, and the round added no guard against the divergence it just repaired.

- **Reachability:** LATENT
- **Tag:** [MEASURED]
- **Location:** `web/src/components/ft-app.ts`, `isCollectionWritable`; `web/src/capabilities.ts`, `getCapabilities`.

**Description.** Commit `af9ea8c` is the entire behavioural content of this round: a three-line
early return in `isCollectionWritable`. It repairs a real divergence — two readers of the same
capability gate that disagreed on whether platform GITHUB was required.

There is no test for either function:

```
$ grep -rln -e 'getCapabilities' -e 'isCollectionWritable' --include='*.test.ts' web/src/
(no output; rc=1)
$ find web/src -name '*.test.ts' -print
web/src/util/assertions.test.ts
web/src/util/safe-url.test.ts
web/src/util/url-binding-scan.test.ts
web/src/utils/task-ready.test.ts
```

**ENUMERATED 4 = FLAGGED 0 + EXCLUDED 4.** Four test files exist under `web/src`; zero reference
the capability gate; four are unrelated (URL scheme, URL binding scan, assertion helpers, task
readiness).

**This is the same class of defect the round is fixing.** The r8 comment in `isCollectionWritable`
says the gap was invisible because *"the capability half would have stayed green while this half
flipped."* Nothing in this round changes that. The two predicates were re-aligned **by hand**, and
they can diverge again by hand tomorrow with nothing going red. The round found an instance and did
not install the guard — which is exactly the pattern the role brief warns has shipped before and
been called a fix.

Note also that `capabilities.ts` and `ft-app.ts` are **not** under `web/src/util/`, the directory
`CLAUDE.md` names as where "the URL-scheme security guard lives". They are on the seam the role
brief flagged as nobody's assigned territory. That prediction held.

**Recommendation.** Add `web/src/capabilities.test.ts` asserting the two predicates agree across
the whole platform enum — a table test, not two hand-written cases, so a new enum member cannot
slip through:

```ts
// The invariant: a collection is writable IFF getCapabilities grants the
// GitHub write set. Two readers, one rule. r8 fixed a divergence here by hand;
// this is what makes the next one go red.
for (const platform of Object.values(Platform)) {
  for (const rd of [undefined, {}, { writable: true }, { writable: false }, { writable: 'true' }]) {
    const coll = { platform, remoteData: rd } as Collection;
    const caps = getCapabilities(coll);
    const grantsGithubWrites = caps === GITHUB_CAPABILITIES;
    expect(exportedIsCollectionWritable(coll)).toBe(grantsGithubWrites);
  }
}
```

This requires exporting `isCollectionWritable` (or lifting it into `capabilities.ts`, which is
where it arguably belongs — it is the same rule, written twice, in two files). **Lifting it is the
better fix: it removes the seam rather than pinning it.** Note `{ writable: 'true' }` — the string
— is included deliberately as the near-miss arm; both implementations use `=== true`, so both must
reject it.

---

### F4 — [MEDIUM] PRE-EXISTING, NOT CAUSED BY THIS DIFF. Two live stored-XSS render sinks are protected by one unpinned line, and no guard covers it.

- **Reachability:** LATENT today; becomes LIVE on a one-line edit with no test to stop it
- **Tag:** [MEASURED]
- **Location:** `web/src/util/markdown.ts`, `renderMarkdown`; sinks in `web/src/components/inspector/ft-inspector-desc.ts` and `ft-inspector-comments.ts`.

**This is role brief item #4: live in the product today, not this branch's fault, separated from
the scorecard.** It is also the only thing I found that is squarely on the *stored-XSS render-sink*
axis this branch is nominally named for.

**Description.** The entire markdown sanitizer:

```ts
export function renderMarkdown(md: string): string {
  return DOMPurify.sanitize(marked.parse(md) as string);
}
```

Its two consumers are the only `unsafeHTML` call sites in the tree:

```
$ grep -rn -e 'unsafeHTML' --include='*.ts' web/src/ | grep -v test
web/src/components/inspector/ft-inspector-desc.ts:242:        ${unsafeHTML(renderMarkdown(this.description))}
web/src/components/inspector/ft-inspector-comments.ts:221:                        ${unsafeHTML(renderMarkdown(c.body))}
```

`c.body` is a GitHub issue-comment body — attacker-authored by anyone who can comment on a synced
issue. `this.description` likewise. **This is the canonical stored-XSS shape**, and DOMPurify is
the only thing standing in it.

**Nothing pins it.** Measured:
- No `markdown.test.ts` exists (`find web/src -name 'markdown*'` returns only `markdown.ts`).
- The tree-wide scanner **explicitly excludes this sink by design.** `url-binding-scan.test.ts`
  preamble, verbatim: *"WHAT IT STILL DOES NOT SEE … lit's `unsafeStatic` and `unsafeHTML` …
  Those are tracked separately, not closed here."*
- The `BANNED_SINKS` scanner that would cover it lives only on the unmerged `markdown-sanitize`
  branch — stated in that same preamble and confirmed: the only two `BANNED_SINKS` occurrences in
  the tree are those two comment lines.

**Proof of concept (for the regression, which is the exploitable part).** Deleting the
`DOMPurify.sanitize(...)` wrapper — leaving `return marked.parse(md) as string` — yields immediate
stored XSS from any synced GitHub comment containing `<img src=x onerror=alert(document.cookie)>`.
`make test`, `npm test`, and both container builds all stay **green**: no test imports
`renderMarkdown`, and the one scanner that inspects render sinks documents `unsafeHTML` as out of
scope. The dashboard is authenticated, so the payload runs with the victim's session.

**Mitigating, and I checked it because it acquits:** dependency versions are current, so there is
no *known* bypass today.
```
$ grep -A3 '"node_modules/dompurify"' web/package-lock.json
"version": "3.4.12",
$ grep -A3 '"node_modules/marked"' web/package-lock.json
"version": "15.0.12",
```
DOMPurify 3.4.12 is well past the 3.2.4 mXSS fixes. **[UNCHECKED]:** I did not run `npm audit` or
`govulncheck` — both are build-token-covered and I did not request the token for this. A live
advisory feed check is therefore not in this report.

**Recommendation.** Land a `web/src/util/markdown.test.ts` with a payload corpus, so the sanitizer
has a runner in the release path (`npm test` already executes in both Dockerfiles):

```ts
const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '[click](javascript:alert(1))',
  '<a href="javascript:alert(1)">x</a>',
  '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;">',
];
for (const p of PAYLOADS) {
  const out = renderMarkdown(p);
  assert(!/onerror|onbegin|<script|javascript:|srcdoc/i.test(out), `sanitizer let through: ${p}`);
}
// POSITIVE ARM -- proves the assertion is not passing on empty output.
assert(renderMarkdown('**bold**').includes('<strong>'), 'sanitizer stripped benign markup');
```

The positive arm is not optional: per the common brief, a control whose pass condition is an
absence cannot distinguish "sanitized" from "returned empty string".

---

### F5 — [LOW] PRE-EXISTING. The `graph_queries` capability sink is genuinely inert, but on a single early return that the round's two-conjunct model does not cover.

- **Reachability:** UNREACHABLE today (verified, not accepted)
- **Tag:** [MEASURED]
- **Location:** `internal/server/graph_support.go`, `collectionSupportsGraph`; `internal/server/graph_routing.go`, `resolveGraphRoute`.

**Description.** The r8 `convert.go` comment makes a falsifiable claim: that a planted
`graph_queries` key is *"inert today only because `collectionSupportsGraph`'s single caller takes a
farmtable early return before reaching it."* **I tried to falsify it and could not. The claim is
accurate.** Recording it because the role brief asks for capability sinks specifically, and because
verifying an in-diff claim is worth as much as finding a new defect.

Chain, all measured by reading:
- `collectionSupportsGraph` reads `c.RemoteData["graph_queries"]` and returns the planted bool
  directly, overriding `platformGraphDefaults`. It is a real, functional Go reader of a
  collection's untrusted map.
- Its single non-test caller is `resolveGraphRoute`, which returns at
  `if coll.Platform == collection.PlatformFarmtable` **before** reaching it.
- The only writer of collection `RemoteData` is `ImportCollection`, which hardcodes
  `Platform: collection.PlatformFarmtable`.
- **`CreateCollection` cannot plant it.** The census claims platform is caller-controlled there,
  which is true, but I checked whether `RemoteData` is also wired, and it is not — the
  `store.CreateCollectionParams` literal in `CreateCollection` sets exactly `Name`, `Description`,
  `Platform`, `RemoteID`. No `RemoteData` field. So the two halves cannot meet.

**So: planted `graph_queries` always lands on a farmtable collection, which never consults it.
UNREACHABLE.** The `convert.go` comment is correct, including its warning that this is *not*
covered by the two-conjunct model.

**Residual risk, which is why this is LOW and not INFO.** Inertness rests on one early return plus
one hardcoded field, in two files, with no test asserting the conjunction. Wiring a `remote_data`
field into `CreateCollection` — an ordinary-looking proto plumbing change — arms it alone, with no
import path involved. Impact if armed is bounded: `graph_queries: true` on an unsupported platform
forces `graphRouteEphemeral`, loading up to `maxEphemeralTasks = 10000` tasks into an in-memory
SQLite store per query. That is a resource-exhaustion lever, not a write-authorization bypass.

**Recommendation.** No change required this round. Keep it tracked (the comment calls it Finding 9).
If it is ever closed, the guard belongs on `CreateCollection`'s params literal, not on
`collectionSupportsGraph`.

---

### F6 — [INFO] Scope: the Go half of this round contains zero non-comment lines, and the branch name does not describe the content.

- **Tag:** [MEASURED]

```
$ git diff -U0 e4e3d13..HEAD -- internal/server/convert.go internal/server/export_import.go \
    internal/webguard/doc.go | grep -E '^\+' | grep -vE '^\+\+\+' \
    | grep -vE '^\+\s*(//|\*|/\*)' | grep -vE '^\+\s*$'
(no output)
```

**All 132 added lines across the three Go production files are comment or blank.** The complete
production behaviour change in a 476-insertion round is:

```
$ git diff -U0 e4e3d13..HEAD -- web/src/capabilities.ts web/src/components/ft-app.ts | ...
+    if (coll.platform !== Platform.GITHUB) {
+      return false;
+    }
```

Three lines of TypeScript, plus one new Go test and three test-allowlist entries.

This is not a criticism of the comments — several of them are load-bearing and at least three of
the claims I spot-checked were accurate (F5, and the two below). But it is worth stating plainly for
the scorecard: **the branch is called `url-scheme-validation-r8` and contains no URL-scheme
validation work at all.** Everything in it is on the capability/write-authorization axis. Per the
role brief's distinction, this round is entirely about a **capability sink**, and a render-sink
search would not have found any of it — which is also why F4, the one actual render-sink issue,
went untouched for eight rounds.

---

### F7 — [INFO] Two further in-diff claims spot-checked and found ACCURATE.

- **Tag:** [MEASURED]

Recording these because the common brief asks me to verify rather than accept, and a verified claim
is a result.

1. **The Beads-path claim in `isCollectionWritable`'s new comment** — *"The Beads import path …
   does not pass through the farmtable platform guard at all — that guard sits only in the farmtable
   arm of the format switch."* **TRUE.** In `ImportCollection` the switch has `case "beads":` and
   `case "farmtable":`; the guard
   `doc.Collection.Platform != string(collection.PlatformFarmtable)` sits inside the farmtable arm
   only. The beads arm converts and falls through to the shared `importParams` literal, and is held
   inert by the hardcoded `Platform: collection.PlatformFarmtable` there — exactly as the comment
   says, by the hardcode and not by the guard.

2. **The r8 fix is non-regressive.** I checked specifically whether the new
   `coll.platform !== Platform.GITHUB` early return breaks FARMTABLE collections, since
   `isReadOnly` negates this method. It does not: both callers (`isReadOnly`, `isExternalWritable`)
   already return early on `Platform.FARMTABLE` before calling it. **A farmtable collection never
   reaches the new line.** The comment's claim that this is "a tightening and nothing else" is
   correct. This was my best candidate for a functional regression and it did not hold up.

---

## POSITIVE OBSERVATIONS

- **`web/src/util/safe-url.ts` is genuinely excellent security code** — allow-list not denylist,
  with a correct and measured explanation of *why* (`'java\tscript:'` defeats a denylist), a
  documented no-base parse with the open-redirect caveat stated rather than glossed, and an honest
  retraction of an earlier over-claim about the host guard being fail-closed. The
  `javascript://evil.com/%0aalert(1)` analysis is right and is the kind of thing most reviews miss.
- **The release path runs the web guard.** `RUN npm test` in both Dockerfiles, placed before
  `npm run build`, with a comment explaining that devDependencies are present at that stage. This is
  the correct instinct and it is what makes F1's asymmetry visible rather than total.
- **`TestWebCensusAnchoringIsTopLevelOnly` is a well-built test** *(given something runs it)*. It
  uses a fixture rather than the real tree because the real tree cannot discriminate the two pruning
  policies; it carries a **positive control** (`if !seen[plain] { t.Fatalf }`) so the negative
  assertions cannot pass vacuously; it has both a regression arm and a prune arm, so "reach" cannot
  be bought by deleting the filter; and it is deliberately not driven off `skipDirs` itself. That is
  four separate control-design mistakes avoided.
- **The census allowlist entries are honest.** r8 added three entries recording that annotating the
  guard's subject tripped the guard, and explicitly declined to reword the prose to dodge it.
- **The counting discipline is real.** Removing the "two producers" count rather than correcting it
  to "three" is the right call and the reasoning given (a count is a population claim with nothing
  guarding it) is sound.

## RECOMMENDATIONS (beyond the findings)

1. **F1 first, and it is two lines.** Everything the last eight rounds built on the Go side is
   currently trusting a human to type `make test`.
2. **Prefer removing the F3 seam to pinning it.** `isCollectionWritable` and `getCapabilities`
   encode one rule in two files; the fix that cannot regress is one function.
3. **Non-security, surfaced not escalated (per composition rules):** `web/src/util/` and
   `web/src/utils/` both exist, each holding test files. That is a trip hazard for exactly the kind
   of path-anchored sweep this project keeps getting wrong. Manager's call whether that goes to
   code-reviewer.

---

## INSTRUMENT SECTION

Tool inventory, verified rather than assumed (common brief §5 claims — **all four confirmed**):

```
$ echo "shell=$0"; echo "multios=$options[multios]"; echo "bareglobqual=$options[bareglobqual]"
shell=/bin/zsh
multios=on
bareglobqual=off
$ grep --version | head -1
ugrep 7.5.0 x86_64-pc-linux-gnu +sse2; -P:pcre2jit; ...
$ awk -W version 2>&1 | head -1
mawk 1.3.4 20200120
```
I used `$options[multios]` rather than `setopt | grep -c multios` per §5. I used no `(N)` glob
qualifiers, no `awk` interval expressions, no `$PIPESTATUS`, and no `|| true` on a `grep -c`
anywhere in this audit.

| # | Purpose | Exact command | Controls |
|---|---|---|---|
| I1 | Confirm tree identity | `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`, `git status --porcelain` | Positive: HEAD printed and matched the dispatch SHA exactly. Working tree empty — **no near-miss arm**; I cannot distinguish "clean" from "porcelain silently failed", though rc=0 was printed. |
| I2 | Range shape vs brief | `git diff --stat e4e3d13..HEAD`; `git log --oneline e4e3d13..HEAD` | Cross-check against the brief's pasted stat. **Matched exactly** (7 files / 476 / 40, 10 commits). This is a control on the *brief*, and it passed. |
| I3 | **Isolate non-comment additions (F6)** | `git diff -U0 e4e3d13..HEAD -- <3 named go files> \| grep -E '^\+' \| grep -vE '^\+\+\+' \| grep -vE '^\+\s*(//\|\*\|/\*)' \| grep -vE '^\+\s*$'` | **Positive arm present and load-bearing:** the identical pipeline over the two named `.ts` files returned the 3-line `Platform.GITHUB` hunk. So an empty result for the Go files means "ran and found nothing", not "did not run". This is the one place I most needed that control and I armed it before reading the Go result. |
| I4 | Render-sink sweep (F4) | `grep -rn -e 'unsafeHTML' -e 'innerHTML' -e 'unsafeSVG' -e 'unsafeStatic' --include='*.ts' web/src/` | Positive: matched both real sinks **and** test-file noise, so the instrument was demonstrably live. Near-miss arm **ABSENT** — see limitations. |
| I5 | URL-navigation sink sweep | `grep -rn -e 'href=\${' -e 'src=\${' -e '.href' -e 'window.open' -e 'location.href' --include='*.ts' web/src/` | Positive: matched the three known `<a href=${...}>` bindings already allow-listed in `url-binding-scan.test.ts`, i.e. it found the things a prior round proved are there. |
| I6 | Capability-gate test coverage (F3) | `grep -rln -e 'getCapabilities' -e 'isCollectionWritable' --include='*.test.ts' web/src/` (rc=1, no output) paired with `find web/src -name '*.test.ts' -print` (4 files) | **Discrimination, not absence.** The `find` proves 4 test files exist and are visible to the selector's corpus; the `grep` proves none matches. A bare empty grep would have been uninterpretable. |
| I7 | CI existence (F1) | `git ls-files '.github'`; `find . -path ./node_modules -prune -o -name '*.yml' -path '*workflows*' -print ...` | Two independent selectors (git index vs filesystem) agreeing. **Weakness noted per common brief §6:** I asked whether they fail on the same members. They could both miss a workflow in an untracked-and-unusually-named location; I mitigated with I8, which found a workflow file by a *third* route and confirmed it is not at HEAD. |
| I8 | Ancestry of the cited CI commit (F2) | `git cat-file -t cc92735`; `git merge-base --is-ancestor cc92735 HEAD`; `git ls-tree -r --name-only cc92735 \| grep -i workflow`; `git show cc92735:.github/workflows/ci.yml` | `ls-tree` is the positive arm — it proves the selector *can* find `.github/workflows/ci.yml` when the file is present in a tree. That same selector returns nothing at HEAD. This is the strongest control in the audit. |
| I9 | Container build executors (F1) | `grep -n -e 'npm' -e 'test' -e 'RUN' Dockerfile` and `Dockerfile.server` | Positive: `RUN npm test` found, proving the selector matches a test invocation when one exists. Absence of `go test` is therefore discriminated, not assumed. **This control acquits part of my own headline** and I ran it for that reason. |
| I10 | `graph_queries` reachability (F5) | `grep -rn 'collectionSupportsGraph' --include='*.go' internal/`; `grep -rn 'graph_queries' --include='*.go' internal/`; then full reads of `graph_support.go`, `graph_routing.go`, and `CreateCollection` | Token search **backed by reading every call site**, because per role brief a token search cannot see an alias write. Both greps returned test-file hits as well as production ones, confirming liveness. |
| I11 | Dependency versions (F4) | `grep -n -A3 -e '"node_modules/dompurify"' -e '"node_modules/marked"' web/package-lock.json` | Read from the **lock file**, not `package.json`, because `package.json` carries `^` ranges (`^3.0.0`) which do not state the resolved version. No control against a live advisory DB — see limitations. |

### INSTRUMENT FAILURE I MUST REPORT

One of my sweeps returned a **false clean** and I nearly published it:

```
$ git log --all --oneline --diff-filter=A -- '.github/workflows'
(empty)
```

I initially read this as "a workflow file has never existed in this repository." **That is false** —
I8 subsequently proved `.github/workflows/ci.yml` exists in the tree at `cc92735`. The mechanism:
`git log --all` walks commits reachable **from refs**, and `cc92735` is reachable from none in my
clone:

```
$ git rev-list --all | grep -c "$(git rev-parse cc92735)"
0
$ git branch -a --contains cc92735   # empty
$ git tag --contains cc92735         # empty
```

The object is present in my clone's store but is not on any branch here. **A `git log --all`
pathspec sweep is not a sound instrument for "did this file ever exist" when unreferenced objects
are in play** — it fails silently toward clean, which is the failure direction the common brief
warns about. It was caught only because I checked the cited SHA directly instead of trusting my own
negative. I am reporting it because F1 would have been *overstated* had I used it — I would have
claimed CI never existed, when in fact it exists and is simply not on this branch.

### LIMITATIONS — WHAT MY INSTRUMENTS CANNOT SEE

- **No near-miss arm on the render-sink sweep (I4).** I proved my selector finds `unsafeHTML`; I did
  **not** prove it rejects a sink one character outside the token set. A sink reached via a
  re-exported alias, a computed directive, or `staticHtml` under a different import name is
  invisible to I4. **The render-sink population is OPEN. I did not prove it closed.**
- **ENUMERATED = FLAGGED + EXCLUDED for the render-sink population:** `ENUMERATED 2 = FLAGGED 2 +
  EXCLUDED 0` for `unsafeHTML` call sites in non-test code. Both flagged (F4). This is the count my
  selector can see, not the count that exists.
- ~~**[UNCHECKED] Nothing was built, compiled, typechecked or executed.**~~ **SUPERSEDED 12:40Z —
  SEE ADDENDUM A.** This bullet was true when written and is now **FALSE**. The rationing was lifted
  at 12:33Z and I executed `go test ./internal/webguard/`, which resolves precisely the item this
  bullet declared unmeasured. **The correction is not cosmetic: this bullet said the guard's colour
  was unknown, and it is now measured GREEN and measured RED-ON-REVERT.** What remains accurate:
  I never ran `npm test`, `tsc`, `npm audit`, `govulncheck`, or any whole-tree `go build`, so **the
  tree's compilability is still UNMEASURED by me** (common brief §4) — one stdlib-only package
  compiling is not a tree building, and I am not permitting that inference.
- **[UNCHECKED] Whether `.github/workflows/ci.yml` exists on any branch in the canonical repository.**
  `cc92735` is unreachable from refs *in my clone*. I did not fetch and did not inspect
  `/workspace/farmtable` (prohibited). **The load-bearing fact for F1 and F2 is narrower and is
  fully measured: the file is not present in the tree at `901670e`.** I state the scope in the same
  sentence as the claim, per common brief §7.
- **[UNCHECKED] Runtime behaviour of DOMPurify 3.4.12** against the F4 payload corpus. My assessment
  that it blocks them is [DERIVED] from the library's documented behaviour, not measured here.
- **No dependency advisory check.** F4's "versions are current" is [DERIVED] from version numbers
  against my own knowledge of the DOMPurify/marked advisory history, **not** from a tool run.
- **I did not review** `.design/project-log/2026-07-29-dev-xss-r8-fix.md` (103 of the round's 476
  insertions) during the cold pass. It is the fix leg's self-report and, per common brief §8, is a
  claim rather than evidence; I deliberately deferred it to reconciliation to keep the cold pass
  cold.

### PROHIBITIONS OBSERVED

No push. No production file modified (no file of any kind modified in the tree). No `git add`,
`commit`, `stash`, or any write to the index — I ran no mutating git command at all. No clone,
worktree or object store created. Nothing deleted or tidied. No `gc`/`prune`/`repack`. No
filesystem-level copy of any repo or `.git`. Never left `/workspace/farmtable-audit-r8`; never read
another leg's tree or `/workspace/farmtable`. No contact with the other two legs. Build token
neither requested nor used.

---

## WHAT WOULD CHANGE MY VERDICT

- **F1 withdrawn** (see pre-registration) **and F3 addressed** → APPROVE WITH CONDITIONS.
- **F1 withdrawn, F3 addressed, F4 pinned by a test** → APPROVE.
- Conversely, if `TestWebCensusAnchoringIsTopLevelOnly` turns out **not to compile or not to pass**
  when someone spends the build token, F1 escalates from HIGH toward CRITICAL-for-guard-integrity:
  the round would have shipped a guard that is both unrun and red.

**Round 6 and round 7 remain DO NOT MERGE. Nothing in my pass changes that, and this verdict is not
a merge decision.**

---

*Cold pass complete and written to disk at this point.*

# === END OF COLD PASS ===

---

# RECONCILIATION (written after opening `_r8-PHASE-TWO.md` and the r7 artefacts)

## R.0 — REVISED SEVERITY TABLE (supersedes the cold-pass table)

| Severity | Count | Findings |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | *(F1 downgraded)* |
| MEDIUM | ~~4~~ **3** | ~~F1,~~ F3, F4, **F8 (new)** |
| LOW | ~~2~~ **3** | F2 *(downgraded)*, F5, **F1 *(downgraded again 13:32Z — ADDENDUM C)*** |
| INFO | 3 | F6, F7, **F9 (new)** |

**Total 9.** F4 and F5 remain PRE-EXISTING and are not graded against this branch.

> **THIS TABLE WAS REVISED 13:32Z.** F1 went **MEDIUM → LOW** when I retracted its central claim as
> false: CI *does* run `go test ./...`. **Final counts: 0 / 0 / 3 / 3 / 3.** See ADDENDUM C.

**VERDICT UNCHANGED: REQUEST CHANGES.** The load-bearing support has shifted: my cold-pass headline
(F1) is materially weaker than I published it, and the strongest thing in this report is now **F8**,
which I did not have at cold-pass time and which challenges a routing decision rather than the diff.

---

## R.1 — WHERE PHASE TWO CORRECTED ME. F1 AND F2 REVISED.

Phase Two §4 states: *"Real `main` is `cc92735` and CI EXISTS (`.github/workflows/ci.yml`).
Anything in-tree claiming there is no CI is describing an older commit. Your clone's refs are from
canonical and canonical is STALE relative to real main."*

**That is consistent with everything I measured, and it explains my instrument failure.** It does
not contradict a single measurement in the cold pass — but it does change what two of them *mean*.

### F2 — DOWNGRADED MEDIUM → LOW, AND ITS CENTRAL ACCUSATION IS WITHDRAWN

I wrote that `doc.go`'s sentence *"At cc92735 the CI workflow asserts web/dist is ABSENT…"* was a
stale claim r8 should have corrected. **It is not stale. It is correct, and it is correctly
scoped** — `cc92735` really is real main, CI really does exist there, and the sentence says "At
cc92735" precisely so as not to over-claim. The author was being more careful than I gave credit
for, and my recommended rewrite would have made the comment *worse* by asserting "that workflow is
not present on this branch" as though that were the comment's subject.

**I over-read it, and the mechanism is worth recording because it is the one the brief warns
about:** I measured `cc92735` unreachable-from-refs *in my clone*, and let "unreachable in my
clone" drift into "not a real thing" over the course of writing the finding. My own I8 control was
sound; my *interpretation* of it was not. The measurement never said what I used it to say.

**What survives, at LOW:** the sentence is true of main and is read on a branch where it does not
yet apply. A one-clause rebase note would close it. That is a documentation nicety, not a defect,
and I would not block on it.

### F1 — DOWNGRADED HIGH → MEDIUM, AND SPLIT — ⚠ **DOWNGRADED AGAIN, MEDIUM → LOW, 13:32Z**

> **The refinement below is correct as far as it goes and I did not push it far enough.** "They have
> one on main; they do not have one on this branch" understates how much the `pull_request` path
> covers: a PR resolves the workflow from the merge ref, so this branch **would** be gated. The
> residual gap is **push-path only and self-heals on rebase.** **F1 is LOW.** See ADDENDUM C.

My claim was "the Go-side guards have no automated executor." **Refined: they have one on main;
they do not have one on this branch, and the gap is trigger-specific.** Newly measured:

```
$ git rev-list --left-right --count cc92735...HEAD
12	67
$ git merge-base cc92735 HEAD
7a0f220dbd9332cb8db62138c841777432b4eda4
$ git cat-file -e HEAD:.github/workflows/ci.yml
fatal: path '.github/workflows/ci.yml' does not exist in 'HEAD'
```

**[MEASURED]** This branch is **67 commits ahead of and 12 behind `cc92735`**, forked at `7a0f220`,
and does not contain the workflow file.

The workflow's triggers are `pull_request` and `push: branches: ['**']`. **[DERIVED, from GitHub
Actions semantics, not measured on this host — I cannot run Actions here]:**

- **`push` → NO RUN.** For a push event, Actions reads workflow files *from the pushed commit*.
  There is none at `901670e`. So pushing this branch triggers nothing.
- **`pull_request` → WOULD RUN**, since workflows resolve from the base/merge ref, and main has it.

**Why this still matters, and why it is not a nit.** The workflow's own comment states the push
trigger exists specifically because *"a gate that only watches the default branch silently ignores
every branch where work actually happens… This repository has a long-lived branch 39 commits ahead
of main that nothing has ever compiled."* **That description is of this lineage** — now 67 ahead,
not 39. So the branch the push trigger was written to catch is exactly the branch the push trigger
**cannot** catch, because catching it requires the branch to contain the file it does not contain.
The mitigation and the gap have the same root.

**Revised recommendation (replaces the Dockerfile edit I proposed at cold pass):** the Dockerfile
change is now optional defence-in-depth rather than the fix. **The actual fix is to rebase this
branch onto `cc92735` before it is evaluated**, which is a prerequisite the round does not state
anywhere. Until then, no `go test ./...` has run against these 67 commits by any route — which is
exactly what `_r8-COMMON.md` §4 already says, and my pass **confirms it rather than closing it**.

**Did I satisfy my own pre-registered withdrawal condition?** I pre-registered that F1 is withdrawn
if shown "an automated executor of `go test ./...` reachable from `901670e`." **Strictly: no.** The
CI at `cc92735` is *not* reachable from `901670e` — that is precisely what `--is-ancestor` returned
NO for. So the pre-registration does not fire, and I am not withdrawing F1. But it fires for
"reachable from main", which is the question anyone actually cares about, and my pre-registration
was written too narrowly to notice the difference. **I am recording that my own pre-registration
was badly specified, because a withdrawal condition that cannot be met by the true answer is not a
control, it is a ratchet.**

---

## R.2 — PER-FINDING RECONCILIATION AGAINST `audit-xss-r7.md` (F1–F10)

Per common brief §8: found-independently / missed / disagree.

| r7 finding | status at r8 | my cold pass |
|---|---|---|
| **F1** [MED] missing GITHUB conjunct in `isCollectionWritable` | **FIXED** by `af9ea8c` | **N/A as a finding** — it was already fixed. I independently *verified the fix* and specifically tried to break it (F7 item 2). It holds. |
| **F2** [MED] `canEditRelationships` declared, advertised, unenforced | **ROUTED OFF**, still open | **MISSED in cold pass.** Found on reconciliation — and **generalised: see F8. I DISAGREE WITH THE ROUTING.** |
| **F3** [MED] five stale line citations | partially fixed | **Found independently** as OP-2 work, and I **disagree on the number: see F9.** |
| **F4** [LOW] browser-only check labelled "SECURITY CONTROL" without the Go caveat | **FIXED** — both files now carry an explicit "nothing in Go enforces this" block | Noted independently in Positive Observations. |
| **F5a/5b** [LOW/INFO] `%q` hardening / logging channel | untouched | **MISSED.** I never opened the logging path. Recorded as a gap, not softened. |
| **F6** [LOW] intra-field masking in the sampler | untouched | **MISSED.** Same cause. |
| **F7** [LOW] census omits `EntStore.UpdateCollection` | **ROUTED OFF** | **MISSED.** I read the census but did not audit it for omissions. |
| **F8** [INFO] count reintroduced in the TS half | **FIXED** — count removed, not corrected | Noted independently (Positive Observations, counting discipline). |
| **F9** [LOW] third farmtable early return, `graph_support.go` | **ROUTED OFF**, documented in r8 | **FOUND INDEPENDENTLY** = my F5. I additionally verified it is genuinely UNREACHABLE and closed the `CreateCollection` sub-question the r7 note leaves open. |
| **F10** [INFO] `doc.go` says "TWO LIMITS", there are ≥3 | **FIXED** — count removed, third limit written down | Read in the diff; not raised as a finding. |

**Score: 3 found independently (F3, F9, and the two "fixed" items I noted positively), 5 missed
(F2, F5a, F5b, F6, F7), 2 disagreements (F2 routing, F3 count).** The five misses cluster on the
**logging/sampler path**, which I never opened — a coherent blind spot, not scattered bad luck. My
cold pass was strongest on reachability and executors and weakest on the diff's own prior findings.

**One near-miss I must confess.** Reading the adjudication, I briefly concluded the fix leg had
contradicted the EM: adjudication item 3 says *"There are **two** producers"*, while r8's
`capabilities.ts` comment says the census names **three**. **They are different populations** —
the EM's "two" is producers of the import `doc` (the beads arm and the farmtable arm of the format
switch), and r8's "three" is producers of a GITHUB-platform *collection object*. **I nearly
published a units error as a disagreement**, which is the exact failure `_r8-COMMON.md` §6 warns
about. Both statements are correct. Caught before publication, recorded because catching it was
luck as much as method.

---

## R.3 — NEW FINDINGS FROM RECONCILIATION

### F8 — [MEDIUM] **10 of the 15 declared capability flags have zero enforcement sites. r7's F2 was routed off as a population of one; it is a population of ten.**

- **Reachability:** LIVE (the dashboard offers operations its own capability model marks disabled)
- **Tag:** [MEASURED]
- **Location:** `web/src/capabilities.ts`, `interface CollectionCapabilities`; consumers across `web/src/components/`.

**This is the finding I would most want read, and I did not have it at cold pass.**

r7 F2 flagged `canEditRelationships` as "declared, advertised, and unenforced," and the adjudication
routed it away as *"latent, own track."* **That routing was decided against a population of one. I
measured the whole population:**

```
$ for f in canEditTitle ... canDragReorder; do
    n=$(grep -rl "$f" --include='*.ts' web/src/ | grep -v 'capabilities.ts' | wc -l)
    printf '%-24s consumers=%s\n' "$f" "$n"; done
```

**ENUMERATED 15 = FLAGGED 10 + EXCLUDED 5.** Population is ten or fewer on each side, so per
`_r8-COMMON.md` §6 here are the lists, not the integers:

- **FLAGGED — zero enforcement sites (10):** `canEditTitle`, `canEditDescription`,
  `canChangePriority`, `canAddComment`, `canCloseTask`, `canDeleteTask`, `canEditAcceptance`,
  `canEditRelationships`, `canEditCodeContext`, `canDragReorder`.
- **EXCLUDED — genuinely gate something (5):** `canChangeStage` (2 sites), `canCreateTask` (2),
  `canChangeAssignee` (1 file / 4 sites), `canEditDates` (1 file / 4 sites), `canChangeParent` (1).

**Impact.** `GITHUB_CAPABILITIES` sets `canEditRelationships: false` with the tooltip *"GitHub only
supports parent-child, not blocks/blocked-by."* Nothing consults it, so on a writable GitHub
collection the dashboard still offers blocks/blocked-by editing. The same holds for nine other
operations. **Two-thirds of the capability model is decorative.** Bounded — and the bound is r8's
own honest disclosure, that nothing in Go enforces any of this — so this is a client-side integrity
and correctness defect, not a privilege escalation. It is MEDIUM because the *shape* is the one
this whole workstream exists to stop: **a control that is declared, labelled, tooltipped, and
enforced nowhere.**

**Why I disagree with the routing.** "One unenforced flag, own track" and "ten of fifteen flags
unenforced" are different decisions. The first is a loose end; the second says the capability
model is not a control. **I am not asking for it in r8** — the round is correctly scoped small —
but the routing should be re-taken with the real number.

**Instrument and its controls.**
- **Positive arm, on the same corpus and same command shape:** five flags returned non-zero, and I
  printed their sites to confirm they are real gates (`this.capabilities?.canEditDates === false`
  guarding handlers and renders), not incidental mentions. The instrument demonstrably says YES.
- **Blind-spot arm:** a token search cannot see computed access. Measured absent —
  `grep -rnE 'capabilities\[|caps\[|CollectionCapabilities\[' --include='*.ts' web/src/` (excluding
  `capabilities.ts`) returns **rc=1, no matches**, so there is no dynamic indexing for the search to
  miss. Destructuring is not a blind spot here: it reproduces the literal token.
- **Population is CLOSED** for the fifteen declared flags, since the interface is the definition and
  there is no dynamic access. This is the one population in my report I am willing to call closed.

**Recommendation.** Do not fix this by deleting flags. Add a guard that fails when a declared
capability has no consumer — the same shape as the existing webguard census, which is the right
pattern and already exists in this repo:

```ts
// Every key of CollectionCapabilities must be READ somewhere outside this file.
// A flag that is declared, tooltipped and never consulted is not a control.
for (const key of Object.keys(ALL_ENABLED)) {
  assert(consumersOf(key).length > 0,
    `capability '${key}' is declared but enforced nowhere. Either gate an operation on it or delete it.`);
}
```

**Note this test would go red today for ten flags**, which is the point — and it is the answer to
the role brief's question about what goes red when someone adds a new sink tomorrow.

### F9 — [INFO] The "17 remaining line-number citations" figure is not reproducible. I measure 21 lines under my broadest selector, and the unit is ambiguous.

- **Tag:** [MEASURED]

Phase Two §3 OP-2 relays *"17 line-number citations remain"* and notes the EM has not verified it.
I could not reproduce 17 under any scoping:

| variant | corpus | figure |
|---|---|---|
| V1 | `filename.go:NNN` form, non-test, comment lines, `internal/`+`web/src/` | **16** |
| V2 | as V1 but **including** test files | **32** |
| V3 | as V1 but any line, not only comments | **16** |
| V4 | whole repo, comment lines, incl. tests | **32** |

Publishing all four rows per `_r8-COMMON.md` §6, and naming the variable that moved: V1→V2 is
*test-file inclusion* (doubles it); V1→V3 is *comment-only restriction* (no effect — every such
citation is in a comment).

**Then I found my own selector's blind spot,** which is the part worth keeping. V1 requires a
filename, so it cannot see the **bare `:NNN`** citation form that this codebase actually uses
(`"…entstore.go:408 and :898…"`, `"returned by :630, :638 and :642"`). Measured separately and
unioned, same units both sides (`file:line` strings, one member printed from each):

```
A (filename:NNN form) = 16
B (bare :NNN form)    = 7
A INTERSECT B         = 2
UNION (distinct LINES)= 21
```

**16 + 7 − 2 = 21. The arithmetic balances.**

**The disagreement is real but the unit is the story.** 21 is *lines carrying at least one
line-number citation*; the count of **citations** is higher still, since a single line such as
`"returned by :630, :638 and :642"` carries three. Neither 16 nor 21 nor any variant is 17, and
without the fix leg's selector I cannot say whether we disagree on the measurement or on the noun.
**I do not claim the leg is wrong. I claim the figure is not reproducible as stated**, and that a
bare-`:NNN` citation is *more* fragile than a `file:NNN` one, not less — it has no filename to
anchor a reader when the number rots.

---

## R.4 — ITEMS FROM PHASE TWO §4 I CAN SPEAK TO

- **`scopes.go` gofmt-dirty:** did not check, **did not touch.** Instruction observed.
- **`.gitignore:17` unanchored `dist/`:** **did not check.** Phase Two documents a polarity trap
  requiring the inside-path form plus negative controls; the item is routed out of scope and I had
  no finding depending on it, so running it would have been ceremony. **[UNCHECKED]**, deliberately.
- **`graph_support.go` "filed, routed off":** agreed, and I add positive evidence for the routing —
  my F5 verifies it is genuinely UNREACHABLE, closing the `CreateCollection` sub-question. **This is
  a routing I agree with**, in contrast to F2's.
- **The §2.1 `tsc` bound:** I did **not** re-measure it (build-token territory), but I verified its
  premise statically and it holds. `web/tsconfig.test.json` carries `"include": ["src/**/*.test.ts"]`
  — pasted from the file — and no test imports `ft-app.ts`, consistent with my F3 measurement that
  no test references `isCollectionWritable` at all. **So the EM's relayed correction is
  structurally confirmed from a second direction**, though the `--listFiles` counts themselves
  remain **[UNCHECKED]** by me. **This strengthens F3:** the F1 fix is not merely untested, it is
  outside the reach of the typecheck that `npm test` runs.

---

## R.5 — LEDGER: ERRORS IN THE BRIEF, ITEMISED AS REQUESTED

The EM has asked fourteen rounds running and says the count has never come back zero. It is not
zero.

1. **`_r8-COMMON.md` §7, the withdrawn marker rule — COST ME NOTHING, and I want that on the
   record rather than inflated.** The 10:35Z correction arrived while I was mid-pass. I had planted
   no markers, because none of my zeros were over a corpus that records my own commands — they were
   over the source tree and git objects. **The defective rule cost me zero minutes.** I am
   reporting it as zero rather than manufacturing a cost, since the standing instruction to check
   the numbers that damage me applies equally to numbers that flatter the brief.
2. **The 10:35Z three-state control rule was, however, materially useful and arrived late enough to
   require rework.** I had already published four zeros with positive arms drawn from *real* tree
   objects rather than *planted* ones. I re-armed all four with planted fixtures in `/tmp`
   (CTL-A…CTL-D below). ~10 minutes. **This is a cost of the correction being right, not of it
   being wrong, and I would pay it again** — CTL-A and CTL-C both surfaced near-miss behaviour I
   had assumed rather than tested.
3. **DELIVERABLE PATH CONFLICT — unresolved, and I need a ruling.** `_ADJUDICATION-xss-r7.md`
   ("THREE PROCESS ITEMS THIS ROUND FORCED") states: ***"r8 legs write to `reports/r8/`"***, on the
   grounds that flat `reports/` is a measured cross-leg contamination channel. **My dispatch and my
   role brief both name the flat path** `reports/audit-xss-r8.md`. These conflict. I followed the
   **dispatch**, because §9 says deliverables are "NAMED EXACTLY" and a path I invent is worse than
   a path that is wrong. **Flagging rather than silently picking**, per "IF A RULE IN MY BRIEF
   CANNOT BE SATISFIED, SAY SO." If `reports/r8/` was intended, say so and I will re-file; I have
   not created that directory, since creating unannounced things is itself prohibited.
   **RESOLVED 12:44Z BY EM RULING: THE FLAT PATH STANDS FOR THIS ROUND.** Explicitly: do not move,
   do not copy, do not create `reports/r8/` — *"a file that exists in two places is worse than a
   file in the less-preferred place."* The adjudication document is the artefact in error and its
   correction is the EM's. **No action taken; this report has not moved.** Item closed.
4. **My own pre-registration was badly specified** (see R.1). Not the brief's error — mine — but it
   belongs in the same ledger, since the brief asked me to pre-register and the failure mode is one
   the brief could warn about: **anchor a withdrawal condition to the question you care about, not
   to the artefact you happen to be holding.**

---

## R.6 — ADDITIONAL INSTRUMENTS (reconciliation phase)

All four planted-positive controls mandated by the 10:35Z §7 correction. **Planted by me, in
`/tmp` — I did not add files to the tree, since `_r8-COMMON.md` §4 permits that only to
`test-xss-r8`.** Marker literal typed by hand (`ZQXJ7A`), not assembled.

| # | Zero it controls | Command | Result — **both arms** |
|---|---|---|---|
| **CTL-A** | I3 / F6: zero non-comment Go additions | `printf '%s\n' '+++ b/fake.go' '+// a comment line' '+   // indented comment' '+' '+func RealCodeZQXJ7A() {' '+\tx := 1' '-removed' ' context' \| grep -E '^\+' \| grep -vE '^\+\+\+' \| grep -vE '^\+\s*(//\|\*\|/\*)' \| grep -vE '^\+\s*$'` | **PUBLISHABLE.** Positive: admitted the two planted code lines. Near-miss: rejected both comment forms, the blank `+`, and the `+++` header. |
| **CTL-B** | same | same pipeline over `git diff -U0 e4e3d13..HEAD -- internal/webguard/remotedata_consumers_test.go` | **106 lines.** Says YES on real Go in the same diff. So the zero over the three production Go files is "ran and found nothing". |
| **CTL-C** | I6 / F3: zero tests referencing the capability gate | planted `/tmp/ctlr8a/` with 2 matching `*.test.ts` (one nested), 1 decoy `*.test.ts` without the token, 1 `*.ts` **with** the token; then `grep -rln -e 'getCapabilities' -e 'isCollectionWritable' --include='*.test.ts' /tmp/ctlr8a/` | **PUBLISHABLE.** Positive: found both planted test files incl. the nested one (recursion proven). Near-miss: rejected the decoy **and** rejected `wrongext.ts` — proving the `--include` bound is real. **That near-miss also exposed a limitation I then stated: the selector is blind to `*.spec.ts`.** |
| **CTL-D** | I7 / F1: zero workflow files | planted `/tmp/ctlr8b/.github/workflows/ci.yml` **and** near-miss `/tmp/ctlr8b/notgithub/ci.yml`; then the identical `find . -path ./node_modules -prune -o -name '*.yml' -path '*workflows*' -print` | **PUBLISHABLE.** Positive: found the planted workflow. Near-miss: rejected `notgithub/ci.yml`. |

**Honest note on CTL-A/B and CTL-D:** these were **added after** the clean result they control, which
`_r8-COMMON.md` §7 correctly calls *a receipt*. I am labelling them as receipts rather than
pretending they were armed first. CTL-C's near-miss arm is the only one that changed a published
claim (it produced the `*.spec.ts` limitation). **The §7 correction arrived after my cold pass was
on disk, so arming-first was not available to me for those three; that is a sequencing fact, not an
excuse, and a receipt is weaker evidence than a control.**

Additional reconciliation-phase instruments:

| # | Purpose | Command | Controls |
|---|---|---|---|
| I12 | Branch/main divergence (R.1) | `git rev-list --left-right --count cc92735...HEAD`; `git merge-base cc92735 HEAD`; `git cat-file -e HEAD:.github/workflows/ci.yml` | `cat-file -e` is a discrimination: it **succeeds** for `cc92735:.github/workflows/ci.yml` and **fails** for `HEAD:` the same path. Same command, same path, opposite results — the instrument is proven live on the exact query. |
| I13 | OP-2 citation census (F9) | four predicate variants + union of two citation forms via `comm`/`sort -u` | Old and new predicates run over the **same corpus**, all four rows published, moved variable named. Units asserted (`file:line` strings) and one member printed from each side before differencing, per §6. |
| I14 | Capability enforcement census (F8) | per-flag `grep -rl … \| grep -v capabilities.ts \| wc -l` over all 15 flags | **Positive arm built in:** 5 of 15 returned non-zero and their sites were printed and read to confirm they are real gates. **Blind-spot arm:** dynamic-access grep returned rc=1. |
| I15 | `tsc` reach premise (R.4) | read `web/tsconfig.test.json` and `web/package.json` scripts | Static only. The `--listFiles` counts themselves are **[UNCHECKED]** — build-token territory, not requested. |

**CORRECTED 12:40Z.** This paragraph previously read *"Build token: never requested, never held,
never used. Nothing was built, compiled, typechecked or executed at any point in this audit."* That
was true at delivery and **became false at 12:38Z**, when I acted on the 12:33Z lifting of the
rationing. **See ADDENDUM A for instruments I16 and I17.** The tree's compilability
remains UNMEASURED by me, and I note the EM has since routed that measurement to
`/workspace/farmtable-build-r8` and `/workspace/farmtable-build-base` — **announced clones, which I
have classified as announced and have not visited.**

**VOIDED 12:45Z BY BULLETIN 19.1 §4.** That routing no longer resolves anything and I am striking
it rather than leaving it to look like a pending answer. The EM disclosed that it placed a 70-byte
`web/dist/index.html` stub in **both** build clones at 10:41:36 to satisfy the embed directive, and
did not disclose it when reporting those builds green. **Those greens are void as evidence about
fresh-clone buildability** — the stub satisfies `//go:embed all:web/dist`, so the builds never
exercised the asset pipeline. The arm-to-arm comparison survives (identical stub, common-mode), but
**nothing I routed there comes back.** I never visited either clone, so no measurement of mine
depended on them; the only casualty is the routing sentence itself.

---

## R.7 — WHAT WOULD CHANGE THE REVISED VERDICT

- **F3 addressed** (a test pinning the two predicates) **and F8's routing re-taken with n=10** →
  APPROVE WITH CONDITIONS.
- Additionally **F4 pinned** by a markdown sanitizer test → APPROVE.
- **F1 is no longer a blocker on its own**; it is a rebase prerequisite plus a real observation that
  the push-trigger gate cannot see this branch.
- ~~**What would make it worse:** if the authorised whole-tree build shows
  `TestWebCensusAnchoringIsTopLevelOnly` failing or not compiling…~~ **RESOLVED 12:40Z, FAVOURABLY
  TO THE ROUND. The pre-registered worsening condition DID NOT FIRE.** The guard compiles and
  passes. See ADDENDUM A. **I am recording this in the same register I would have used had it gone
  the other way**, per the standing rule that a number acquitting the fix leg gets checked as hard
  as one that damages it — which is why I did not stop at the green and went on to mutate.

**R6 and R7 remain DO NOT MERGE. This verdict is not a merge decision.**

---

## ADDENDUM A — POST-DELIVERY MEASUREMENT, 12:40Z

**Status: this addendum CHANGES NO SEVERITY AND CHANGES NO VERDICT.** It closes the largest
`[UNCHECKED]` in the delivered report and it **sharpens F1 against the round rather than for it.**
Recorded separately from the graded body because it was taken after delivery.

**Trigger.** The EM lifted build/test rationing at 12:33Z. My report carried a pre-registered
condition anchored to exactly this measurement, so the lifting obliged me to take it.

**Safety check performed BEFORE executing anything.** The EM's stated hazard for building in a live
review tree is that `make test` may run a web build and **materialise `web/dist` inside a tree a leg
is reading**, which would flip the polarity of the documented `check-ignore` trap in Phase Two §4.
I established that hazard does not apply to a narrow package test: `internal/webguard` is two files
importing only `fmt`, `os`, `path/filepath`, `sort`, `strings`, `testing` — no `embed`, no
dependency on `web/dist`. I confirmed `web/dist` ABSENT before and after. `git status --porcelain`
empty after; both webguard files still at their 10:23 clone mtime. **No tree write occurred.**
(`go: downloading go1.26.5` appeared — a toolchain fetch to GOCACHE, not a tree write.)

| # | Purpose | Command | Controls |
|---|---|---|---|
| I16 | Does the r8 guard actually pass? | `go test ./internal/webguard/ -v` in `/workspace/farmtable-audit-r8` | All 4 tests PASS, exit 0. **⚠ VOID on method (ran inside an audit tree, 19.1 §2).** **TREE STATE: PRISTINE** — `web/dist` ABSENT, porcelain 0. **3 of the 4 tests assert against the REAL `web/` tree, so this green is TREE-STATE-DEPENDENT and does NOT generalise to the built main copy or the CI runner.** |
| I17 | Does it actually go **RED** on revert? | two-arm mutation on a throwaway copy at `/tmp/mut-r8/webguard` (permitted explicitly by `_ADJUDICATION-xss-r7.md`: *"mutation against a throwaway copy outside /workspace needs no token"*) | **Both arms published.** Unmutated arm: PASS, exit 0 — proves the harness is live outside the tree, so the red below cannot be an artefact of the copy. Mutated arm (`skipDirs[rel]` → `skipDirs[d.Name()]`): **FAIL, exit 1, 6 assertions.** **TREE STATE: a fourth state — a two-file synthetic module in `/tmp`. TREE-STATE-INVARIANT BY CONSTRUCTION:** the test builds its own fixture via `t.TempDir()` and the census takes a root, so it reads no project tree at all. **This is why I17 survives the tree-state re-labelling intact while I16 does not.** |

**I17 detail.** The mutated arm failed on all three nested plants (`src/build`, `src/util/dist`,
`src/components/coverage`) on **both** the mentions arm and the descent arm. **The prune arm did not
fire** — top-level `dist`/`node_modules` stayed pruned. That discrimination matters: the red is
specifically the basename-anchoring defect and **not** a general collapse of the test, which is what
a test made red by breaking it would look like.

**RESULT: commit `6a0b8bd`'s claim — "a regression guard for basename pruning that actually goes
red" — is VERIFIED [MEASURED], by me, adversarially, not accepted from the leg's self-report.**
Phase Two §2 required exactly this posture. This is the round's strongest artefact and I say so
plainly. It also retires my own concern that the guard could be passed by a dead instrument: the
test carries an internal live-fixture control (`if !seen[plain] { t.Fatalf }`) and I have now
independently confirmed the guard discriminates.

### THIS SHARPENS F1, IT DOES NOT SOFTEN IT — ⚠ RETRACTED 13:32Z, SEE ADDENDUM C

> **THE WHOLE OF THE FOLLOWING SUBSECTION IS WITHDRAWN. Its premise — that nothing automatically
> runs the guard — is FALSE: CI runs `go test ./...` directly. F1 is downgraded MEDIUM → LOW.**
> It is preserved unedited rather than deleted, because the *shape* of the mistake is the useful
> part: a confident escalation resting on a population I never proved closed.

**F1 stays MEDIUM and its substance is untouched — F1 was never a claim about the guard's colour,
it is a claim about the absence of an executor.** But the measurement makes F1 *worse*, and I want
that on the record because the naive reading runs the other way:

> A guard that is demonstrably load-bearing — one I have just proven catches a real defect that
> really hid three real plants — and that **nothing automatically runs**, is a larger loss than a
> vacuous guard nothing runs. The r8 leg built a genuinely good instrument and wired it to nothing.
> `internal/webguard` is a Go test package; both Dockerfiles run `npm ci`, `npm test`, `npm run
> build`, `go build` — and **not `go test`**. I17 proves the thing that asymmetry is discarding has
> real value.

**What I still have NOT measured:** whether the *other three* webguard tests would go red on their
respective reverts (I17 covers the new one only), and whole-tree compilability, which is not mine.

---

## ADDENDUM B — EM-100 CHANGES F1's CEILING, 12:45Z

> # ⚠ SUPERSEDED IN FULL BY ADDENDUM C, 13:32Z. DO NOT RELY ON ANYTHING BELOW.
> Its central inference — that wiring `go test ./...` into CI yields a gate **red on arrival** — is
> **FALSE.** CI builds the frontend *before* the test step, so EM-100 never reaches it. Its
> conclusion **"F1 severity unchanged at MEDIUM"** is also superseded: **F1 is LOW.**
> Preserved unedited, not deleted, because the error is instructive.

Bulletin 19.1 §3 reclassifies EM-100 from "absent directory, cosmetic, pre-existing" to a
repo-wide toolchain blocker, measured at `901670e`: `go build ./...` → **exit 1**, `go vet ./...` →
exit 1, `go test ./...` → **4 packages cannot be built at all** (root `farmtable`,
`cmd/farmtable-server`, `cmd/ft`, `internal/cli`), all from
`assets.go:5:12: pattern all:web/dist: no matching files found`.

**Provenance discipline.** The exit codes are **[DERIVED, from the EM's measurement — not mine]**.
I did not re-run them and **cannot**: verifying them requires either building inside my audit tree
(prohibited by 19.1 §2) or a filesystem-level copy of a working tree (prohibited by common brief
§3.5). **That is a genuine rule conflict and I am reporting it rather than resolving it myself.**
What I *did* verify, statically and read-only: `assets.go` is `package farmtable` with
`//go:embed all:web/dist` at line 5, and `web/dist` is ABSENT in my tree. **Mechanism confirmed;
exit codes accepted as derived.** This also explains why I16 succeeded where `go test ./...` cannot
— `internal/webguard` imports only stdlib and pulls in no farmtable package, so it is upstream of
the broken embed. My green and the EM's exit 1 are consistent, not in tension.

**THE CONSEQUENCE FOR F1, WHICH IS NEW AND MAKES F1 WORSE AGAIN.** F1 says nothing runs the
webguard guards. EM-100 says that the obvious remedy *does not currently work either*:

> Wiring `go test ./...` into CI today would produce a gate that is **red on arrival**, for four
> packages, for reasons having nothing to do with webguard. A permanently-red gate is either
> ignored or reverted, and in both cases the r8 guard still has no effective executor. **So F1 is
> not one commit from being fixed — EM-100 has to fall first.** The guard proven by I17 is behind
> *two* doors, not one.

**F1 severity unchanged at MEDIUM** — this changes its remediation cost and its ceiling, not its
exploitability, and I am not inflating a severity on a dependency-ordering argument.

**Consequence B disclosure, since 19.1 asked directly:** I have **never** run `make test`, `npm
test`, `tsc`, `npm audit`, `govulncheck`, `go build ./...` or `go vet ./...`, in any tree, at any
point. I therefore report no `make test` green and never did. **I have never created `web/dist`
anywhere**, and it is ABSENT in my tree on every check I have taken (10:23 through 12:45).

> **⚠ ADDENDUM B IS SUPERSEDED BY ADDENDUM C, 13:32Z. Its central inference — "a gate red on
> arrival" — is FALSE. Read C.** The Consequence B disclosure immediately above is unaffected and
> still stands.

---

## ADDENDUM C — I WAS WRONG ABOUT THE EXECUTOR. RETRACTION AND DOWNGRADE, 13:32Z

**This addendum exists because the coordinator's tree-state re-labelling rule made me re-open a
figure I was holding, and the re-open falsified the claim I had built on it.** It corrects my own
headline against my own interest. It is the most important correction in this report.

### C.1 THE MEASUREMENT THAT DID IT

`cc92735:.github/workflows/ci.yml` — object present in my clone though unreachable from refs, read
with `git show`, **read-only, nothing executed**:

```yaml
      - name: Assert web/dist is absent before the build   # then: make build
      - name: Assert web/dist was produced by the build
      - name: Go tests (invoked directly)
        run: |
          set -o pipefail
          go test ./... -v 2>&1 | tee go-test.log
```

Triggers: `on: pull_request:` and `push: branches: ['**']`.

### C.2 WHAT THIS KILLS

**`go test ./...` HAS AN AUTOMATED EXECUTOR.** `internal/webguard` is inside `./...`. The r8 guard
that I17 proved goes red **is wired to CI**, via the `pull_request` path. **My sentence "the
instrument is good and it is wired to nothing" is RETRACTED as false.**

**And ADDENDUM B's "red on arrival" is false too.** I argued that wiring `go test ./...` into CI
would produce a permanently-red gate because of EM-100. **CI builds the frontend first** — assert
absent → `make build` → assert produced → *then* `go test ./...`. The embed resolves. EM-100 never
reaches the test step.

**EM-100 re-scoped.** The workflow diagnoses it in-band and better than we did: *"the canonical
working copy has carried a populated, untracked `web/dist` since Jul 27 — which is precisely why
`go build ./...` succeeded there for days while failing in every fresh clone."* EM-100 is not a
repo-wide toolchain blocker; it is **"a pristine tree cannot `go build ./...` until the frontend is
built,"** which CI treats as expected and gates deliberately. The claim that the whole-tree build
*cannot be discharged by anyone* is **too strong** — it is discharged by `make build` first.

### C.3 WHAT SURVIVES, AND WHY F1 IS NOW LOW NOT ZERO

**Still MEASURED and still true:** for a **push**, Actions reads the workflow **from the pushed
commit**, and `901670e` does not contain `ci.yml` (`git cat-file -e HEAD:.github/workflows/ci.yml`
→ fails; succeeds at `cc92735`). **Pushing this branch triggers nothing.** The workflow's own
comment says the push trigger exists to catch *"a long-lived branch 39 commits ahead of main that
nothing has ever compiled"* — this lineage, now 67 ahead — and it still cannot catch it.

**But the `pull_request` path covers the gap.** For `pull_request` the workflow resolves from the
merge ref; base contains `ci.yml` and this branch never deleted it, so a PR **would** run
`go test ./...`. **[Trigger resolution semantics: DERIVED. File presence/absence: MEASURED.]**

**Net: the residual gap is PUSH-PATH ONLY and SELF-HEALS ON REBASE.** That is a LOW, not a MEDIUM.
**F1: MEDIUM → LOW.**

### C.4 THE ERROR, NAMED

**A closed-population failure on my own headline finding.** I enumerated executors as
`{Dockerfile, Dockerfile.server}`, verified neither runs `go test`, and stopped. `ci.yml` was a
third member — **and I had already read it and quoted it in §R.6 of this report.** The falsifying
evidence was in my own document. My brief's rule is that a population is OPEN until proven closed;
**I applied it to the round's census claims and never once to my own.** The finding that felt
strongest got the least scrutiny, which is the exact direction the common brief §8 warns about.

**It also means my ADDENDUM A "sharpening" was reasoning built on an unclosed population.** The
logic ("a proven guard nothing runs is a bigger loss than a vacuous one") is sound in the abstract
and **its premise was false here.** A valid argument from a false premise is still a false
conclusion, and it read as more rigorous than the thing it replaced.

---

## ADDENDUM D — TREE COORDINATES, AND ONE NEW PRE-EXISTING FINDING (F10), 13:42Z

### D.1 COORDINATES, NOT LABELS (bulletin 20 §4)

Bulletin 20 is right that a taxonomy built by collecting examples can only ever be short. Declaring
axes for both my measurements:

| | `web/dist` | `node_modules` | Go module cache | verdict |
|---|---|---|---|---|
| **I16** (audit tree) | ABSENT | **ABSENT** | warm, 309M at `/home/scion/go/pkg/mod` | **VOID on method** anyway |
| **I17** (`/tmp` synthetic) | n/a | n/a | **irrelevant — `go.mod` declares zero requires** | **STANDS** |

**I17 is invariant on all three axes**, not just tree-state: it is a two-file stdlib-only module
with no dependencies, and the test constructs its own fixture with `t.TempDir()`. Bulletin 20 §3's
hazard — *"two legs holding byte-identical trees will report different package counts and nothing
either can print about the tree will explain the difference"* — **cannot reach I17**, because the
module cache cannot participate in a build that requires no modules. **That is now the strongest
property the result has**, and I did not claim it until I could state the mechanism.

**Bulletin 20 §2 also corroborates I16 independently:** `internal/webguard` is **not** among the
four `setup failed` packages, so it runs normally in a frontend-less tree. My green and the EM's
exit 1 were never in tension. **I am not treating that as re-confirmation of I16** — it stays void
on method.

### D.2 [MEDIUM] F10 — GO TEST MEMBERSHIP IS REPORTED BUT NEVER ASSERTED, WHILE THE JS SIDE ASSERTS

**PRE-EXISTING. LIVE ON `main` TODAY. NOT CAUSED BY THIS DIFF. NOT GRADED AGAINST r8 — the round's
counts remain 0/0/3/3/3.** Filed under role-brief item 4.

Retracting F1 left a real question standing that "no executor" had been masking: **the executor
exists — but what fails if the guard silently stops being executed?** In `cc92735:.github/
workflows/ci.yml`, all 13 steps enumerated:

- **JS side, step `Which JS suites will actually run (fails if any is unwired)`** → runs
  `scripts/ci-suite-manifest.mjs`. **This is an ASSERTION.** It fails the build.
- **Go side, step `Executed Go test membership`** → greps `=== RUN` out of `go-test.log`, writes a
  count and a list to the step summary, uploads an artefact. **`if: always()`, `|| true`, and
  `exit 0` when the log is missing. It ASSERTS NOTHING**, and its own comment states the position
  explicitly: *"An empty membership list is a legitimate result to report, not an error."*

**Consequence:** if `TestWebCensusAnchoringIsTopLevelOnly` — the artefact I17 proved is
load-bearing — ever stops being executed (package renamed, file dropped, build tag, `-run` filter,
a `t.Skip`), **CI stays GREEN.** The membership list simply gets one line shorter, in a step summary
nobody diffs. **The r8 guard runs today by good fortune of the pattern `./...`, not by any
mechanism that would notice its absence.**

> **PROVENANCE, per bulletin 20.1 §1's correction-to-the-correction.** The EM's distinction is
> exactly right and it binds me here: *commit-addressed evidence is immune for the CONTENT of a
> file and not for the BEHAVIOUR of a command that reads it.* So: the workflow's **content** at
> `cc92735` is **[MEASURED]** and tree-state-immune — I read it with `git show`. The **behavioural
> consequence** ("CI stays green") is **[DERIVED]** from that content. **I cannot execute GitHub
> Actions and did not.** F10 rests on a step that contains no failure path — `|| true`, `exit 0`,
> and no comparison — which is a strong content-level basis, but it is an inference and I am
> labelling it as one rather than letting the immunity of the content launder the behaviour claim.

**The asymmetry has a history, in the same repo's own words.** The `Makefile` comment records that
`test` *"used to be `go test ./...` alone, which meant the web guard … "* was never run. The project
hit the disappearing-suite failure **on the JS side**, built the manifest assertion in response,
and **applied it only to the side that had failed.** The Go side inherited no control — and the Go
side is now where r8 put its guard.

**POPULATION, CLOSED THIS TIME. `ENUMERATED 5 = FLAGGED 0 + EXCLUDED 5.`** Candidate mechanisms
that could fail a build on an absent Go test:

| # | candidate | result |
|---|---|---|
| 1 | `ci.yml` membership step | EXCLUDED — reports only; `\|\| true`; empty list declared legitimate |
| 2 | `ci.yml` JS manifest step | EXCLUDED — **zero** references to Go (`grep -c "go test\|_test.go\|golang"` on `cc92735:scripts/ci-suite-manifest.mjs` → **0**) |
| 3 | `Makefile` | EXCLUDED — `test-go: go test ./...`, no membership check |
| 4 | `scripts/` | EXCLUDED — only `remap-github-sub-issues.sh` at HEAD; the manifest exists at `cc92735` only and is JS-only |
| 5 | a Go meta-test | EXCLUDED — only grep hit is `TestAllScopes_IncludesNewScopes`, a domain test about scopes |

**WHAT MY SELECTOR CANNOT SEE, stated with the claim:** branch-protection rules, required-status-check
configuration, and any external service are **invisible from a clone.** I can read the repository; I
cannot read the repository's settings.

**PRE-REGISTERED WITHDRAWAL — anchored to the question, not to the artefact, having got this exactly
wrong once tonight:** *F10 falls if **any** automated mechanism, anywhere — repo, CI config, branch
protection, or external — fails a build when an expected Go test is absent from the executed set.*
The true answer can satisfy that phrasing from outside the repo, which is the property my F1
pre-registration lacked.

**RECOMMENDATION.** Extend the existing, already-working JS pattern to Go rather than inventing a
mechanism — a declared manifest of expected top-level Go tests, diffed against
`executed-go-tests.txt`, failing on absence. The step already **produces** the artefact; it just
never **compares** it:

```bash
# after: executed-go-tests.txt is generated
if ! comm -23 go-tests-expected.txt executed-go-tests.txt | grep -q '^$'; then
  echo "::error::expected Go tests did not run:"
  comm -23 go-tests-expected.txt executed-go-tests.txt
  exit 1
fi
```

### D.3 THE 32-vs-33 RECONCILIATION IS CORRECT. ITS ATTRIBUTION IS NOT. [MEASURED]

Bulletin 20.1 §2 closes the package-count disagreement with `33 − 32 = internal/webguard`, and
adds: *"WHICH THE r8 ROUND ADDED."* **The arithmetic is right and I can corroborate it. The
attribution is wrong.**

| check | command | result |
|---|---|---|
| is `webguard` on main? | `git cat-file -e cc92735:internal/webguard/remotedata_consumers_test.go` | **ABSENT** — so it genuinely is the +1 |
| what introduced it? | `git log --diff-filter=A -- internal/webguard/` | **`7cee4a6`** *"B11: pin the web tree's remote_data consumers as a named allowlist"* |
| is that on main? | `git merge-base --is-ancestor 7cee4a6 cc92735` | **NO** — lineage-only |
| **is it pre-r8?** | `git merge-base --is-ancestor 7cee4a6 e4e3d13` | **YES — ANCESTOR OF THE r8 BASE** |
| what r8 actually did | `git diff --stat e4e3d13..901670e -- internal/webguard/` | 2 files, +199/−7 |
| test functions | `grep -c '^func Test'` at each end | **3 at `e4e3d13` → 4 at `901670e`** |

**So the delta is real and the reconciliation stands untouched:** `webguard` distinguishes the
**branch lineage** from **main**. But it was added **pre-r8**, by `7cee4a6`, in one of the 67
commits this lineage is ahead. **r8 did not add a tested package; it took an existing 3-test
package to 4.**

**WHY THE DISTINCTION IS NOT PEDANTRY.** The `ok +1` column is safe either way. But read as *"r8
contributed a tested Go package,"* it materially overstates the round — and it points the opposite
way from **F6**, my own INFO finding that this round contains **zero non-comment Go additions**.
Both cannot be true. D.3 is the one that is measured.

**THE GENERALISABLE ERROR, and it is a new one for tonight's collection:**

> **A TWO-POINT COMPARISON ATTRIBUTES A DELTA TO THE WHOLE SPAN BETWEEN THE POINTS, NEVER TO THE
> LAST HOP.** The measurement compared `cc92735` against the lineage tip — **67 commits** — and the
> tip was labelled "r8", so the residual was attributed to r8's **10**. The label named the arm's
> *endpoint*; the delta belongs to its *length*.

The bulletin's own lesson was *"name the commit, not just the tree."* This is the field after that:
**name the RANGE.** A named endpoint is still ambiguous about which commits produced the difference,
and the ambiguity resolves toward whichever round is currently in hand — which will always be the
most recent one.
