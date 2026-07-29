# Re-derivation recipe — review-import-hardening-r3

Written out because prose is exactly what someone re-derives in three weeks, and because
none of this was in a git object until now.

**Artefact reviewed:** `f487dc566dc9f6b89255d15501a8c4111338c4ec` (`f487dc5`), base
`43bd20627e0b07c50f113fda266117d419a9b4ad` (`43bd206`).
**Review:** `../review-import-hardening-r3.md` — verdict REQUEST CHANGES.
**Date measured:** 2026-07-29.

## FIRST: I RAN NO MUTATION ARMS, AND THEY PRODUCED NO COMMITS

Stated explicitly rather than left as an absence. I am the review leg, not the test leg.
**I authored zero commits.** I mutated no source. There are no arm definitions to preserve
because there were no arms — the twelve arms M1–M11 belong to `dev-import-hardening` and
their definitions live in that leg's report, not here.

What I ran instead was a **measurement battery**, and its definitions are below. They are
the analogue: each is a command, a named reference point, and the value I expect it to
return. If any of them returns something different later, either the artefact moved or my
review was wrong.

## Where the branch actually lives

There is **no `refs/heads/import-hardening`** in `/workspace/farmtable`. A bare
`git rev-parse import-hardening` there exits **128**. The branch is at:

```
refs/salvage/farmtable-import-hardening/import-hardening   = f487dc5
refs/preserve/em-hardening/import                          = 2ff87d2
```

A plain `git clone` does **not** fetch `refs/salvage/*` or `refs/preserve/*`. To reproduce
my instrument:

```bash
git clone --no-checkout --local /workspace/farmtable /some/where
cd /some/where
git fetch --no-tags /workspace/farmtable \
  '+refs/salvage/*:refs/salvage/*' '+refs/preserve/*:refs/preserve/*'
```

## The measurement battery, with expected values

Every row names its unit and its reference point in the same line, per the standing rule.

| # | Command | Reference point | Expected |
|---|---|---|---|
| M-1 | `git diff --numstat 43bd206 f487dc5 -- .github/expected-go-tests.txt` | base → head | `9	0` — nine rows added, **zero deleted** |
| M-2 | same, `2ff87d2^ 2ff87d2` | that commit alone | `6	0` |
| M-3 | same, `2ff87d2 f487dc5` | that commit alone | `3	0` |
| M-4 | `git show <SHA>:.github/expected-go-tests.txt \| wc -l` | per SHA | **501 rows** at `43bd206`, **507** at `2ff87d2`, **510** at `f487dc5` |
| M-5 | `comm -23 <(base rows sorted) <(head rows sorted)` | base vs head | **empty** — every base row survives, set-wise |
| M-6 | `diff <(base file) <(head file) \| grep -c '^<'` | base vs head | **0** — base file is a strict *subsequence* of head file; nothing moved or reordered |
| M-7 | `git diff 43bd206 f487dc5 -- '*_test.go' \| grep -cE '^\+func Test'` | base → head | **9** new test functions |
| M-8 | same with `'^-func Test'` | base → head | **0** removed. Nine new functions, nine new rows, nothing displaced |
| M-9 | `go list ./...` at `f487dc5` | head | **32 packages** |
| M-10 | `go build ./...` / `go vet ./...` / `go test -count=1 ./...` at `f487dc5` | head | all **exit 0** |
| M-11 | `grep -cP '^(ok  \|FAIL\|\?   )\t' go-test.log` | head | **32 package result lines** (the CI parser's own self-check) |
| M-12 | `grep -cP '^(--- FAIL:\|FAIL\t\|FAIL$)' go-test.log` | head | **0 failure lines** |
| M-13 | CI `awk` extractor (ci.yml:310-318) over `go test ./... -v` | head | **510 rows** in `executed-go-tests.txt`, **0** `(unterminated)` |
| M-14 | `comm -23`/`comm -13` of manifest vs executed | head | **0 MISSING, 0 UNEXPECTED** |
| M-15 | `gofmt -l` on the 7 Go files changed across `43bd206..f487dc5` | branch-cumulative | **0 unformatted** |
| M-16 | `gofmt -l` repo-wide at `f487dc5` | head | **7 files, none on this branch** |

### The single strongest check, and the cheapest to re-run

```bash
sha256sum executed-go-tests.f487dc5.txt manifest-rows.f487dc5.sorted.txt
```

Both are **`0321268aab72f7c675a7e5d8ba74832463e9d3624bc2f4fc288c0fadafb0a970`**.

The 510-row executed set and the 510-row manifest set are **byte-identical**, not merely
equal in count. That is a stronger statement of "0 MISSING, 0 UNEXPECTED" than the `comm`
pair, and it is one hash comparison rather than a pipeline. Both files are in this
directory.

## The cross-track number that must not be pooled

The other track's **45 executed-but-unlisted tests** are measured against a **503-row**
manifest. That manifest is `b54c573`.

- `b54c573`'s manifest blob = the **same 501-row blob** as base `43bd206`
  (blob `e102430df5ec851fef27ca4d9aff61ea1c76e866`) **plus exactly two** `TestConjunctA_*` rows.
- `comm -12` of this branch's 9 added rows against `b54c573`'s 503 rows: **empty**.
- `b54c573`'s tree does **not contain** `internal/server/export_import_provenance_test.go`,
  so eight of the nine cannot execute there at all.

**501 + 2 on that track, 501 + 9 on this one, from a shared ancestor. Do not add them.**
`manifest-rows.b54c573.sorted.txt` is preserved here so this is checkable without
resolving that SHA.

## Instrument rules that mattered

- Every revision spec written **braced** — `"${rev}:${path}"` — and echoed as `arg …=[…]`
  before use. zsh rewrites an unbraced `$var:` as a history modifier and returns the right
  *format* with the wrong *value* at exit zero.
- **No measurement was `2>/dev/null`'d.** The one exit-128 encountered
  (`git rev-parse import-hardening`) was the informative one; suppressing it would have
  left me measuring a working tree instead of a commit.
- All content reads via `git show "<SHA>:<path>"` / `git ls-tree` against a named SHA. The
  single `git checkout --detach f487dc5` was for the Go toolchain only.
- Nothing staged, committed, stashed, or pushed. No `git add -A/./-u`, no `git commit -a`,
  no `git stash -u`. `/workspace/farmtable/web/dist` untouched.
