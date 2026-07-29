# I17 mutation arms — preserved from `audit-xss-r8`'s container

Preserved at wind-down, 2026-07-29. **These were never committed to any branch**, so no
`git bundle --all` would have captured them. They existed only as plain files in `/tmp/mut-r8/`
inside one container.

## Why they were worth keeping

Content-hash test against the canonical object store at preservation time:

| file | blob | in canonical? |
|---|---|---|
| `arm-fixed/remotedata_consumers_test.go` | `175f10fd7` | yes |
| `arm-reverted/remotedata_consumers_test.go` | `2c79d9528` | **no — existed nowhere else** |
| `webguard/remotedata_consumers_test.go` | `2c79d9528` | **no — existed nowhere else** |

The reverted arm is the *mutant*. It is the artefact the r8 round's headline rested on, and it
is precisely the thing somebody re-derives from scratch because nobody could prove it had
already been run.

## What they are

A two-arm mutation differential on `internal/webguard`'s census walker, run in `/tmp` (never in
a leg tree) because the package is stdlib-only, builds its own `t.TempDir()` fixture, and needs
neither modules nor `web/dist` — so it is invariant on all three tree-state axes.

The mutation point is the walker's directory pruning:

- **fixed arm** — `if rel != "." && skipDirs[rel]`, anchored to the path relative to `web/`, so
  `"dist"` prunes `web/dist` and leaves `web/src/util/dist` alone.
- **reverted arm** — `skipDirs[d.Name()]`, which prunes *any* directory anywhere with a matching
  basename. Three planted `remote_data` consumers in such directories went undetected while this
  guard was green.

Green on the fixed arm = agreement; red on the reverted arm = discrimination. The guard detects
what it claims to detect.

## ARM DEFINITIONS AND EXPECTED RED TARGETS — the table to re-derive from

This is the prose that no ref sweep and no bundle would have carried. It is the part someone
re-derives from scratch in three weeks.

| arm | the one line that differs | run | EXPECTED RESULT | what the result means |
|---|---|---|---|---|
| `arm-fixed` | `if rel != "." && skipDirs[rel]` | `go test ./...` in `arm-fixed/` | **GREEN** | guard agrees with a correct tree — no false alarm |
| `arm-reverted` | `if rel != "." && skipDirs[d.Name()]` | `go test ./...` in `arm-reverted/` | **RED**, and it must name the planted consumers | guard discriminates — it detects the defect it claims to detect |

**The red target specifically:** the reverted arm must fail by *finding the three planted
`remote_data` consumers* that live in directories whose basename collides with a skip entry
(e.g. a path like `web/src/util/dist/...`). A red that fails for any other reason is not the
target and does not establish discrimination.

**Green on both arms would falsify the guard**, not confirm it — that is the outcome to watch for.
A guard that is green whether or not the defect is present is measuring nothing, which was the
entire point of running the differential rather than trusting the green.

**Run protocol (from bulletin 19.1):** fix the number of runs per arm in advance, interleave the
arms, re-run BOTH arms or NEITHER, report every individual run, and if the arms split, the split
is the result. Do not re-run one arm to agreement.

**Why this runs anywhere:** the package is stdlib-only (`fmt, os, path/filepath, sort, strings,
testing`), has no `//go:embed`, and builds its own `t.TempDir()` fixture. It needs no modules,
no `node_modules`, and no `web/dist`, so it is invariant on all three tree-state axes and must
be run OUTSIDE any leg tree (contamination rule, bulletin 19.1 §2).

## Provenance caveat, recorded rather than tidied away

`webguard/` is byte-identical to `arm-reverted/`, not to `arm-fixed/`. Both carry blob
`2c79d9528`. Treat `webguard/` as a second copy of the reverted state, not as a pristine
baseline — the pristine baseline is `arm-fixed/`, which is the version that reached canonical.

A related process note from the same round: an unanchored
`perl -pi -e 's/skipDirs\[rel\]/skipDirs[d.Name()]/'` once corrupted a comment 231 lines from the
target, making the arms differ in two lines rather than one. It was caught by diffing the arms
before running them. A substitution is a selector, and an unanchored selector over a file that
discusses its own code will match the discussion. The arms preserved here are the corrected ones.
