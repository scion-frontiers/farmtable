# SEALED — EM MEASUREMENTS. DO NOT OPEN UNTIL PHASE 1 IS WRITTEN AND SAVED.

If you are reading this before you have written your own answer to disk, stop and go
back. The whole reason this file is separate is that reading it first destroys the only
independent measurement anybody is going to get.

These are MY measurements. They are unverified by anyone. They are claims, not facts.

## ROOT: /workspace/farmtable (canonical). Taken 2026-07-29 ~06:30Z.

1. `d5e35a4869475cd79c3a46e791909a610d1ea8f2` resolves as a COMMIT in canonical.
   `c8cb6993581fa202c44cf702f41680fa96442a78` resolves as a BLOB.
2. `git branch -a --contains d5e35a4` returns `url-scheme-validation-r5` and
   `url-scheme-validation-r6`.
3. `git merge-base --is-ancestor d5e35a4 b330096` exits 0. The pin IS an ancestor of the
   round-six tip.
4. Canonical's ref `url-scheme-validation-r6` resolves to `b330096`.
5. ZERO of 205 local branches and ZERO of 123 remote refs (328 total) contain any path
   under `.github/workflows/`. At `633f8f2` and at `7a0f220`, `.github/` contains only
   `ISSUE_TEMPLATE/bug_report.md` and `PULL_REQUEST_TEMPLATE.md`.
   BOUND: canonical's ref set at that moment. Not other clones. Not other hosts. Not
   uncommitted working trees. THIS BOUND IS THE GAP YOU WERE ASKED TO CLOSE.
6. `web/src/util/url-binding-scan.test.ts` exists at `b330096`.
7. Makefile at `b330096`: `test: test-go test-web`; `test-go: go test ./...`;
   `test-web: cd web && npm test`.
8. `web/package.json` at `7a0f220` (main): test script is
   `tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js`
   — ONE hardcoded compiled file. No discovery.
9. `web/package.json` at `b330096`: test script is
   `rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs`.
10. `web/scripts/run-tests.mjs` at `b330096` globs `src/**/*.test.ts`, cross-checks that
    every `*.test.ts` produced exactly one `*.test.js`, sweeps for test-shaped files the
    glob would miss, and requires each file to emit an assertion-count receipt.
11. Dockerfile:9 and Dockerfile.server:9 both `RUN npm test`. A separate leg measured that
    the developer container cannot run the web half at all because `web/node_modules` is
    absent, and that the image builds do not run `go test`.

## MY CONCLUSION, WHICH IS THE PART MOST LIKELY TO BE WRONG

The two guards have mirror-image invocation coverage: the web suite is reached by the
image builds and not by the developer container; the Go suite is reached by the developer
container and not by the image builds. Each is invisible to exactly the path that runs the
other.

DISAGREEING WITH ANY OF THIS IS A RESULT, NOT A PROBLEM. Say so plainly and show the
command. I have been wrong twice tonight on exactly this kind of claim, including once
about which clones hold a commit.
