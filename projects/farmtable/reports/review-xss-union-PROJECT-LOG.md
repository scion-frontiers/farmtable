# Merge-gate review: `xss-url-scheme-union` at `d7154a4`

Date: 2026-07-29. Reviewer leg: `review-xss-union`. Dispatcher:
`farmtable-em-hardening`. Verdict: **REQUEST CHANGES** (two blockers, both text).

Full report, with every measurement and the command that produced it:
`/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-union.md`
(scratch volume, not in this repository).

This file is written into `/workspace/farmtable` and is **not committed** — this
clone sits on `task-state-web-ui-v2`, which is not this work's branch, and only
the EM commits and pushes on this track.

---

## Tree coordinates behind every figure

A figure without its tree is not a measurement.

```
node v20.20.2 everywhere.  ci.yml:46 pins NODE 22.  No node 22 binary exists in
this environment.  EVERY web figure below is "green on node 20", NOT "CI passes".
```

Gate results, re-measured under the 14:38Z clean-tree rule in a fresh clone,
**porcelain sampled after each individual check**. ROOT=`/tmp/xclean`,
SHA=`d7154a4`:

| # | gate | result | porcelain after |
|---|---|---|---|
| 1 | `go list ./...` | 33 of 33 (main is 32 of 32; extra is `internal/webguard`) | 0 |
| 2 | `go vet ./...` | EXIT=0, **0 findings** | 0 |
| 3 | `go test ./... -v` | 1160 RUN lines, **0 failure lines** under CI's own matcher | 0 |
| 4 | `scripts/ci-suite-manifest.mjs` | EXIT=1, 5 enumerated / 1 executed / 4 missing — **expected-red, held by EM instruction** | 0 |
| 5 | Go membership | manifest=503, executed=548, **MISSING=0 — PASSES**, UNEXPECTED=45 | 0 |

### Disclosure: where this leg's trees were dirty

Recorded because the first pass satisfied the old wording and would have misled
under the new one.

- **Over-denial probe.** I created a scratch Go file
  `internal/server/zz_review_legit_test.go` **inside the clone**, ran it, deleted
  it. Clean before, clean after, **dirty at the moment of measurement** — the
  exact hole the CI leg disclosed. The separate-module/`replace` technique was
  unavailable: `validateURLField` is unexported, so no external module can reach
  it. The choice was a scratch file or no measurement; I took the scratch file
  and did not say so at the time. No gate figure above depends on it.
- **Web mutation runs.** `node_modules` symlinked into the clone and `tsc` writing
  `.tmp-test/`. **Both gitignored, so porcelain read empty while the tree was
  materially altered** — and the symlink is what produced three `internal/webguard`
  failures I briefly mistook for a branch defect. *Porcelain-empty is not
  tree-unchanged.*
- **Mutation arms.** Dirt by definition; the dirt is the point. Restored and
  re-verified green between every mutant. Differential results only — not
  quotable as a green for `d7154a4`, and not quoted as one.
- **Trial merge.** Measured with an uncommitted `git merge --no-commit` in the
  worktree, deliberately, because the merge result was the object.

Two distinct mechanisms surfaced in this leg's own evidence. Per the 14:38Z
instruction this log quotes **mechanisms, not a total**, and makes no claim about
how many exist.

---

## What this leg was asked to decide, and what it found

### The owner's ruling was honoured, and the earlier count of eight was wrong

**Exactly one file is genuinely two-sided.** Measured, not inherited: the r8∪r9
merge `a276a51` has parents `74d9db2` (r9) and `07f12a3` (r8); it changes 1 file
against the r9 parent and 8 against the r8 parent, and the *intersection* — the
only file changed against **both** — is
`.design/project-log/2026-07-29-dev-xss-r8-fix.md`. The other seven are r9's
one-sided commits. That is the tip-diff/disagreement conflation the EM flagged
in his own earlier claim, and the corrected count is right.

Both sides survive in that file. There are exactly two deletions across both
parent-diffs and **each is preserved verbatim** inside a dated `UNION NOTE`:
r8's *"F1 VERIFIED"* verdict sentence (superseded by r9, because r9 ran the
behavioural revert and r8 ran only `tsc`), and r9's *"cells R8-01 … R8-15"*
ledger range (superseded by r8, because r9's text is the older `901670e`
reading). Two contradictions, two dated notes, both sides present in each. No
side was silently preferred.

### A general lesson this leg would put on the record

**A merge that does not conflict is not a merge that agreed with you.**

`43bd206` merged into `34ce4da` **cleanly, with zero conflicted files** — and in
doing so silently replaced the web `"test"` script with main's narrowed
single-file form, taking the branch's four web test files out of execution. Our
side had not touched that line since the merge base, so git had no reason to
stop. An instruction to "hold that hunk" has **no mechanism behind it**: nothing
in git will present it, and the one gate that notices
(`ci-suite-manifest.mjs`) is currently expected-red for this very reason, so its
signal is masked by its own known failure.

**Proposed class-level remedy (proposal only, not written).** Not merging until
the shared runner is on main removes *this window*, but not the class: the next
clean merge that takes main's side on a line we care about and have not touched
since the merge base is unguarded again. The class-level fix is to make the
assertion executable — a test that reads `web/package.json`'s `test` script and
asserts every `web/src/util/*.test.ts` guard file is reachable from it, so the
documented claim and the fact cannot drift. The load-bearing detail is *where it
lives*: not in `ci-suite-manifest.mjs`, which is held expected-red and therefore
masks its own signal — that masking is half of why C-1 survived — but in the Go
suite, which is green and unmasked, and where `internal/webguard` already walks
`web/`. It remains a file someone can edit; the difference is that it then fails
loudly rather than silently.

This is the same family as the three failures this track has already recorded —
r9's symlinked `node_modules` turning a broken manifest green, the go-vet rule
that outlived its truth, and the containment checker's fifth mutant whose diff
was zero lines. In each case a **null result meaning "nothing happened" was
read as "nothing is wrong."** A conflict-free merge is a null result.

### Naming the artefact changed the severity of my own finding

Late in the review the EM added: *state what artefact the measurement is about, in
the same sentence as the result.* Applied to my own C-1, it corrected me twice.

There are **two Dockerfiles** and they are not interchangeable. `Dockerfile`
builds `/ft` and runs `ft dashboard`; `Dockerfile.server` builds
`/farmtable-server` and is what production deploys. Their guard comments are
**byte-identical** — both at lines 6-8, both with `RUN npm test` at line 9 — which
is exactly why "the release path" felt like a sufficient description and was not.

- I had written that the four false-assertion sites were **"four equivalent text
  defects." They are not equivalent.** One is a false assurance *in the shipping
  image*; three are false assurances in developer-facing text. Same one-line fix,
  materially different severity, and I had flattened it.
- **The node-20 caveat that weakens my other web figures makes this finding
  stronger.** Both Dockerfiles are `node:22-bookworm`, matching `ci.yml:46`. There
  is no node-version escape hatch by which that layer might have failed anyway: it
  goes green on the same node CI uses, having tested nothing the comment is about.

Generalising: a caveat is not uniformly conservative. Carrying "node 20, not CI"
onto every web figure felt like the safe default, but on this one it was the wrong
direction, and only naming the artefact surfaced that.

### The same trap caught my headline number

The EM's standing check — *what question did this flag actually answer?* — is
worth applying to figures you are already confident in, because that is where it
pays. My membership figure came from my own restatement of the gate. CI keys
membership on **package + test name**; `ci.yml` records that bare-name keying once
collapsed 501 real tests into 499 rows, because `internal/server` and
`internal/store` each define `TestListUsers` and `TestGetUser`. Re-derived with
`ci.yml`'s verbatim `awk` and `comm` pair, scratch written outside the clone:
503 / 548 / MISSING=0 / UNEXPECTED=45 / unterminated=0 — identical, but CI's
answer rather than mine. The value did not change; its standing did.

### The blockers are text, not code

1. **The branch adds four sites asserting that the URL-scheme guard runs**
   (`agents.md:37-40` and `:101-105`, both surfacing twice because `CLAUDE.md`
   is a symlink to `agents.md`; `Dockerfile:6-9`; `Dockerfile.server:6-9`). At
   `d7154a4` all four are false. Two of them make `RUN npm test` a **no-op guard
   in the release path** while a comment three lines above promises it will fail
   the image. The held `package.json` hunk is legitimately parked; the false
   claims about it are not, and are fixable without touching it.
2. **`docs/url-policy.md` does not exist** (`ft-inspector-desc.ts:240`, one
   occurrence in source). Deferred once already in the r6 log as
   "trivial-and-allowed". A citation that resolves to nothing should not pass a
   third gate on a branch whose stated discipline is that citations must point at
   something that goes red.

### What the branch actually adds, security-wise

Real, not structural. The href census is **4 bindings in `web/src`, 4 accounted
for, 0 unguarded** — two newly guarded via `safeHref`, two exempt with declared
and correct reasons (`ft-toolbar.ts:465`, a literal `https://github.com/` prefix
over a regex-validated `remoteId`; `ft-toolbar.ts:496`, a locally minted `blob:`
download URL). For `PullRequest.url` the client guard is **the only control** —
verified at `convert.go:587-588`, which copies it verbatim with no read-path
validation, exactly as `safe-url.ts:8-12` claims. The pre-existing DOMPurify
chain does not touch `href` bindings at all, and the branch's added comment at
`ft-inspector-desc.ts:231-237` refuses to let it be read as a compensating
control — which is the correct and non-obvious call.

Six mutants, five killed. The survivor is named: `testHostGuardIsAFailClosedBackstop()`
(`safe-url.test.ts:166`) survives deletion of the line it pins, because that line
is unreachable while `SAFE_SCHEMES` holds only WHATWG special schemes. The code
says so at `safe-url.ts:109-115` and scopes the test's promise at `:139-141`, and
the compound mutant confirms the scoped promise is true. Deliberately-retained
dead code with a conditional guard whose condition is currently false — recorded,
not charged against the branch.

### Two-sided acceptance: one genuine over-denial in sixteen probes

`https://example.com/a b` — a URL with an unencoded space — is rejected by the
pre-parse control-character loop (`urlvalidate.go:56-61`, `r <= ' '`). Browsers
percent-encode a space silently, so a copy-pasted Confluence or Jira URL looks
fine to the user. On the read path it is **silently dropped**; on import it fails
the whole document. The check's security reason is correct and should stay, but
narrowing it to tab/LF/CR/C0 and letting `0x20` reach `url.Parse` would preserve
the property exactly and stop rejecting a merely-untidy URL. Everything else
rejected (`mailto:`, protocol-relative, scheme-less, relative) is deliberate and
documented.

---

## Corrections this leg made to instructions it was given

Both were invited, and both are recorded because the invitation only works if the
corrections are visible.

- **The go-test membership gate does not fail on added tests.** It is
  deliberately asymmetric (`ci.yml`: MISSING fails, UNEXPECTED is a `::notice::`
  only). Measured at `d7154a4`: MISSING=0, gate passes, 47 unexpected. dev-xss-r9
  reached this first and against a direct instruction; this leg confirms it
  independently. The EM has withdrawn the rule.
- **The `34ce4da..d7154a4` delta is not "main's commits plus documentation."**
  Twelve of sixteen files are byte-identical to `43bd206`; four are not. Two are
  documentation, but `.github/expected-go-tests.txt` (+2/−0, a CI gate input) and
  `internal/server/server.go` are neither. The `server.go` difference was verified
  byte-wise to be **exactly** main's own five hunks — one import plus four
  `proto.Clone` copylock fixes — with nothing the merge invented, and both our
  `validateURLField` call sites intact at `server.go:645` and `:667`.

---

## Reproduction shortcut for the next leg

`internal/webguard`'s census walker hard-errors — `reading .../web/node_modules:
is a directory` — if `web/node_modules` is a **symlink**. It prunes a real
directory correctly by basename (`remotedata_consumers_test.go:120-121`) and CI
creates a real one via `npm ci` before `go test`, so this is not a CI problem.
But a symlinked `node_modules` is precisely the shortcut that produced r9's false
green, so the next agent to reach for it will hit this. It fails loudly, which is
the right failure. Recorded so nobody spends twenty minutes rediscovering it.
