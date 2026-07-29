# Premise Audit — fix list at main faf1c8c

Auditor: dev-ci-release (CI-GREEN). Date: 2026-07-29.
Tree: private clone at `main` faf1c8c, working tree clean, pristine
(`web/dist` absent, `web/node_modules` absent). Read-only: nothing was fixed.
No container runtime and no network were required.

## Verdict summary

| # | Area | Verdict |
|---|---|---|
| 1 | `assets.go` embed / pristine-tree Go behaviour | **TRUE** (exact) |
| 2 | `scripts/ci-suite-manifest.mjs` | **TRUE** (all four) |
| 3 | `.github/workflows/ci.yml` | **TRUE** (all four; one broader than stated) |
| 4 | `Makefile` lint target unreferenced | **TRUE** |
| 5 | `.gitignore:17` | **TRUE** |

No FALSE. No MOVED. All five claims reproduce as written.

This contrasts with F14 (release-path Dockerfiles), whose premises did not hold
at faf1c8c. F14 is the outlier, not the pattern — these four legs were measured
by someone who actually ran the commands.

### Correction carried forward on F14 (per coordinator, 2026-07-29)

`internal/webguard` is **not imaginary**. It does not exist at main faf1c8c —
which is what was measured and reported — but it **does exist on the unmerged r8
lineage**. State it as *"absent at main, present unmerged on r8"*, never as
"does not exist" unqualified. That single package accounts for the entire
32-vs-33 package disagreement between probes on this project, so an unqualified
denial will keep re-opening that discrepancy.

The rest of the F14 premise (npm test at line 9, the quoted comment, the
Makefile audit, the npm-vs-go asymmetry) does not hold at faf1c8c and was
verified absent by name.

### Track rule born from F14

**A positive control validates the tool, never the referent.** F14 shipped *with*
a positive control and still named a file whose grep returns zero. The control
proved the instrument was alive — not that it was pointed at the thing the claim
named. Verify the referent separately, by name, in the tree, and state the
lineage it was verified against. Every verdict in this report is scoped to
main faf1c8c for exactly that reason.

---

## Claim 1 — assets.go embed — TRUE (exact)

`assets.go:5`:

```go
//go:embed all:web/dist
```

Measured in the pristine tree:

| Command | Exit | Packages on stdout |
|---|---|---|
| `go list ./...` | 1 | 0 |
| `go vet ./...` | 1 | 0 |
| `go build ./...` | 1 | 0 |

All three abort with the same single diagnostic:

```
assets.go:5:12: pattern all:web/dist: no matching files found
```

`go list -e ./...` (error-tolerant) expands to **32** packages, confirming the
claimed expansion. `go test ./...` exits 1 and emits 33 result lines
(32 packages + trailing `FAIL`), with **exactly 4** setup failures:

```
FAIL	github.com/farmtable-io/farmtable [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/farmtable-server [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/ft [setup failed]
FAIL	github.com/farmtable-io/farmtable/internal/cli [setup failed]
```

`internal/server` is unaffected: `ok github.com/farmtable-io/farmtable/internal/server 1.106s`.

Every element of this claim — file, line, exit codes, zero-package abort, the
count 32, the count 4, the specific package names, and the `internal/server`
carve-out — matches. Note the asymmetry the claim implies: `go test` is the only
one of the four that still reaches 28 packages of real coverage, because the
per-package setup failure is contained. `list`/`vet`/`build` return nothing at all.

## Claim 2 — ci-suite-manifest.mjs — TRUE (all four)

**`:71` quote-unaware command split** — TRUE:

```js
    .split(/&&|\|\||;/)
```

Splits on `&&`, `||`, `;` with no quote awareness, so those operators inside a
quoted argument split the command into fragments.

**`:122` unanchored vitest match** — TRUE:

```js
  if (/\bvitest\b/.test(t)) {
```

Word-boundary, not anchored: matches `vitest` anywhere in the command string.

**`:132` substring path filter** — TRUE:

```js
        const hits = present.filter((p) => p.includes(a));
```

Plain substring containment, not a path or glob match.

**`:149-187` no floor on the test-file population** — TRUE. `present.length` occurs
only at `:155` (reporting) and `:156`, which *tolerates* the empty case:

```js
if (present.length === 0) console.log('  (none)');
```

The only failing exit in the range is `:187`, guarded at `:180` by
`if (missing.length || unanalysable.length)`. With zero test files in the tree,
`missing` is empty and the script can reach `:190`, `OK: every tracked JS/TS test
file is executed by \`npm test\``, and exit 0. There is no assertion that the
population is non-empty. This is notable because `:182-185` states the script
exists to catch "the exact condition under which a suite disappears and the build
still reports success" — total disappearance is the one case it can wave through.

## Claim 3 — ci.yml — TRUE (all four; `:169` is broader than stated)

**`:179` `if-no-files-found: warn`** — TRUE, verbatim, on the
`Upload test membership evidence` step.

**`:104` and `:120` assert existence, not content** — TRUE:

```sh
104:  if [ -e web/dist ]; then      # pre-build: assert ABSENT
120:  if [ ! -d web/dist ]; then    # post-build: assert PRESENT
```

Both are existence tests. An empty `web/dist/` directory satisfies `:120`.

**`on:` block claims push to `'**'`** — TRUE, `:17` is `branches: ['**']`,
with `:3-13` documenting the choice deliberately.

**`:169` failure summary misses real failures** — TRUE, and reproduced:

```sh
grep -E '^(--- FAIL|FAIL|ok ) ' go-test.log | grep -E '^(--- FAIL|FAIL)' || echo "none"
```

Run against the real `go test ./...` log from this tree — which contains 5 lines
matching `^FAIL` — the expression prints `none`. Confirmed against a synthetic
log too.

The stated cause (space vs tab) is correct but **narrower than the actual bug**.
The trailing space in the character group breaks matching in two distinct ways:

- `FAIL\tgithub.com/...` — go emits a TAB, pattern demands a space. Miss.
- `--- FAIL: TestThing` — go emits a COLON, pattern demands a space. Miss.
- bare `FAIL` (trailing summary line) — nothing follows, pattern demands a space. Miss.

So all three failure forms are missed, not just the tab form. The `ok  ` case is
the only one that matches, because go emits two spaces after `ok`. Net effect:
the failure summary reports "none" on a genuinely failing run. Worth handing to
the ci.yml leg as a slightly larger fix than filed.

## Claim 4 — Makefile lint never invoked — TRUE

`Makefile:65-67`, verbatim:

```make
lint:
	buf lint proto
	go vet ./...
```

`.github/workflows/ci.yml` contains **zero** matches for `lint` and **zero** for
`go vet`. The workflow invokes `make build` (`:116`) and `make test` (`:185`)
only. The lint target is unreachable from CI, so `buf lint proto` and
`go vet ./...` gate nothing.

## Claim 5 — .gitignore:17 — TRUE

Line 17 is exactly `dist/` (confirmed with `cat -A`: `dist/$`), under the
`# Binaries` heading. The trailing slash makes it directory-only. It is also
unanchored, so it matches a `dist` directory at any depth — which is what keeps
`web/dist` untracked.

## Method note

Verdicts rest on executed commands and verbatim file content, not on reading the
claims back. Where a claim asserted a count (32 packages, 4 setup failures) the
count was measured, not estimated. Where it asserted runtime behaviour
(`:169`) the expression was executed against real output rather than reasoned about.
