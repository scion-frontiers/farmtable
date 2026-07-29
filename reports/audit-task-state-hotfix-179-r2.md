## Security Audit Report

### Summary
- Verdict: REQUEST CHANGES
- Critical: 0
- High: 1
- Medium: 0
- Low: 0

Scope reviewed: `web/src/utils/task-ready.ts`, `web/src/utils/task-ready.test.ts`, `web/package.json`, `web/tsconfig.test.json`, `.gitignore`, and `.design/project-log/task-state-hotfix-179-r2.md` for branch `task-state-hotfix-179-r2`, commit under review `6eaae26`, base `582793ea1d7e8fcf9c0be28390a553abf2c7916f`.

### Findings

#### [HIGH] Fixable high-severity PostCSS advisory remains in web dev dependency tree
- **Location:** `web/package-lock.json:1341`, `web/package.json:24`
- **Description:** Full `npm audit` reports `postcss@8.5.14` via `vite@6.4.3` as affected by GHSA-r28c-9q8g-f849, a path traversal issue in previous source map auto-loading that can disclose arbitrary `.map` files when PostCSS processes attacker-influenced CSS/source map references. `npm audit --omit=dev` is clean, so this is build/dev tooling exposure rather than production runtime dependency exposure.
- **Impact:** If CI, a local build, or another automated build path processes untrusted CSS or a malicious dependency asset, the vulnerable PostCSS version can read unintended source map files from the build environment. That can expose source maps or other local `.map` artifacts available to the build process.
- **Proof of concept:** `cd web && npm audit` returns one high vulnerability:

```text
postcss <=8.5.17
PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure
fix available via npm audit fix
```

Dependency path:

```text
farmtable-web@0.0.1
└─┬ vite@6.4.3
  └── postcss@8.5.14
```

- **Recommendation:** Update the lockfile so `postcss` resolves to a patched release while keeping the existing Vite major line unless broader upgrade testing is intended. Example:

```bash
cd web
npm audit fix
npm test
npm run build
npm audit
```

If `npm audit fix` changes more than the lockfile, inspect the package diff before merging and rerun the focused task-ready tests.

### Positive Observations
- The fallback predicate change is local deterministic business logic only. It does not introduce network calls, filesystem access, dynamic code execution, HTML rendering, URL handling, or credential handling.
- The explicit `task.availability` branch remains authoritative; the fallback rejects assigned tasks, held tasks, future-start tasks, non-accepted tasks, and tasks blocked by incomplete blockers.
- The new test harness script compiles TypeScript into `web/.tmp-test` and runs a fixed local test file. It does not interpolate user-controlled input into shell commands.
- `.gitignore` excludes `web/.tmp-test/`; the local `npm run build` output in `web/dist/` and Shoelace copied assets appear to be generated build output rather than source changes or secret-bearing artifacts.
- Focused source scan of scoped web files found no `innerHTML`, `eval`, `Function`, `sourceMappingURL`, or PostCSS configuration introduced by this hotfix.
- `npm audit --omit=dev` found 0 vulnerabilities.

### Verification
- `cd web && npm test` - pass
- `cd web && npm run build` - pass; Vite emitted the existing large chunk warning and copied Shoelace assets
- `cd web && npm audit --omit=dev` - pass, 0 vulnerabilities
- `cd web && npm audit` - fail, 1 high vulnerability in dev dependency tree (`postcss <=8.5.17`)
- `git diff --check` - attempted, but Git metadata is unavailable in this execution worktree: `fatal: not a git repository: (null)`. The checked-out `/workspace/.git` file points to `/workspace/farmtable/.git/worktrees/farmtable-task-state-hotfix-179-r2`, which is absent.

### Recommendations
- Resolve the PostCSS audit finding before merge, then rerun `npm audit`, `npm test`, and `npm run build`.
- Re-run `git diff --check` from a worktree with valid Git metadata before final merge, since this audit environment could not complete that check.
