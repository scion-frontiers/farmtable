# review-xss-r8 planted-control fixture — rescued from container overlay 16:20Z

Original location `/tmp/r8-ctl-a1` in the review-xss-r8 container, st_dev **1048656 (overlay)**.
These 7 files were **never hashed into any git object store**, so no reachability, fsck,
reflog, store-level or object-typed sweep could reach them. Copied here (st_dev **2049**,
ext4 `/dev/root`) because retiring the leg destroys the overlay.

Verified: 7 files, 433 bytes, sha256 matched 7/7 source-to-destination.

## What it is
The planted-positive control fixture for §I-13 of `reports/review-xss-r8.md`. It exists
*outside the repository tree* so that no review finding could be an artefact of the fixture.

## Two things that are load-bearing and are NOT files

1. **`dist/`, `src/`, `src/util/dist/` are EMPTY DIRECTORIES.** Arm C's predicate is a
   `find` over *directories* — `find -mindepth 2 -type d ( -name dist ... )`. The positive is
   `src/util/dist` (depth ≥ 2, must be FOUND); the near-miss is top-level `dist/` (depth 1,
   must be REJECTED). **Reconstructing only the files yields a fixture that cannot pass arm C,
   and the instrument would read as dead.**
2. **`capabilities.js` is deliberately ABSENT.** `tests/planted.test.ts` imports
   `'../capabilities.js'`; the import target is meant not to resolve. Its absence is part of
   the fixture, not an omission from this copy. It doubles as the honest negative arm for any
   check of this directory: a listing instrument that reports it present is broken.

## Arm map (full detail in §I-13 of the review)
| arm | positive (must say YES) | near-miss (must say NO) |
|---|---|---|
| A | `planted_reader.go` — functional `c.RemoteData["writable"].(bool)` | `planted_thing_test.go` — same token in a `_test.go` |
| B | `planted_citation.go` — `export_import.go:306`, `ft-inspector-meta.ts:628` | `planted_nearmiss.go` — identifiers with no `:NNN` |
| C | `src/util/dist` (empty dir, depth 2) | `dist/` (empty dir, depth 1) |
| D | `tests/planted.test.ts` | `tests/planted_notatest.ts` |
| E | `tests/planted_consumer.ts` | *(not armed — declared positive-only)* |
