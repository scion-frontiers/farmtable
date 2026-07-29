# OUT-OF-SCOPE BACKLOG

One line per concern found outside the three running EM tracks. No rationale, no
essays. Opened 2026-07-29 on owner instruction: let the three tracks run, do not
add scope, itemize everything else here.

Facts are stated at the SHA or binary they were measured against. Anything without
one is unmeasured and says so.

THIS DOCUMENT IS NOT A QUEUE AND IT IS NOT A DISCHARGE. Filing an item here does
not make it handled, and the act of writing a concern down can substitute for the
feeling that it needs acting on. A13 is the worked example: it was filed with the
correct scope and, in the same two minutes, the only agent able to act on it was
told to stand down. The row and the instruction were written by the same person and
contradicted each other.

A RECEIPT THAT SAYS EXAMINED AND A BACKLOG ROW THAT SAYS KNOWN BOTH SUBSTITUTE A
RECORD FOR THE ACT. (Mechanism mine, phrasing the auth architect's.)

## AUTH — workstream parked by owner 2026-07-29; nothing here is being worked

| # | Concern | State |
|---|---------|-------|
| A1 | Six /api/link/ routes have no auth checks in production (farmtable-server, always registers them via a localhost BaseURL fallback) | MEASURED BY EXECUTION @43bd206, firing control. IAP-fronted. Gain is credential injection, not token theft |
| A2 | Is /api/link/ IAP-exempt at the edge? OAuth callbacks are a standard exemption | NOT CHECKABLE FROM THE REPO. Decides A1 severity: medium if fronted, high if exempt |
| A3 | Are FARMTABLE_GITHUB/JIRA/LINEAR client IDs set in production? | NOT CHECKABLE FROM THE REPO. If unset all six routes return 503 and A1 closes for free. Cheapest question here, ask before A2 |
| A4 | The whole 33-method gRPC surface is unauthenticated when FARMTABLE_TOKEN is merely UNSET (warning only) — distinct from the deliberate open-access switch | CONFIRMED @43bd206 BY TWO INDEPENDENT AGENTS, the second while falsifying its own committed deliverable. Empty token leaves the lookup nil; nil lookup makes the interceptor pass everything. Auth-on-by-default is true of ft dashboard and FALSE of farmtable-server |
| A5 | ensureDashboardToken mints a token with no scopes — wildcard today, inert after any empty-means-deny flip | MEASURED @43bd206 |
| A6 | No label-keyed authorization on CreateTask, UpdateTask or InsertTasksAfter; the mapper resolves a bare stage-named label to that stage | MEASURED @43bd206. NO EXPLOIT EXECUTED. Needs the label to pre-exist in the repo and github labels enabled |
| A7 | RBAC tiers admin/reviewer/orchestrator/viewer are unreachable — nothing writes them; every self-provisioned user is typed human, which is wildcard | MEASURED. RBAC is currently decorative |
| A8 | Phase 7c shared config resolver | HELD. If ever picked up it must be behaviour-preserving and must NOT register link routes on the dashboard path, which today has none |
| A10 | Import refuses to run in open-access mode as of the provenance fix — a deliberate breaking change. Blast radius NARROWED and much smaller than ruled on: four service-construction sites measured at 2ff87d2 — local CLI embedded path can NEVER be open-access (unconditional lookup), passthrough already returns ErrNotImplemented, so LOCAL CLI IS UNAFFECTED. Exposure is the DEPLOYED SERVER only, and only when the token env var is unset | RULED SHIP by coordinator, with a loud pre-flight refusal that names the accidental case explicitly |
| A14 | Stage 5 Google OAuth login is NEVER REGISTERED when FARMTABLE_TOKEN is unset — gated on Store and sm at unified.go:73, and sm exists only when TokenLookup is non-nil at :62. Same gate that hides /api/auth/session. Previously recorded as 'reachable in production, subject to env config', which named no variable and concealed the dependency | MEASURED. Parked with auth |
| A15 | IAP and OAuth were lumped together and do NOT behave alike: AuthModeProxy needs only Store, so the middleware installs, but session creation and the bearer bridge are skipped when sm is nil | MEASURED. Parked with auth |
| A16 | The auth findings-doc BODY has never been swept for products of the miscalibrated pass — small, twice-corrected, not load-bearing while auth is parked | DECLARED UNSWEPT, not clean. Deliberate termination point, recorded as such |
| A11 | Design doc records defect D5 with NO fix designed — recorded, not solved | OPEN, unowned, parked with auth |
| A12 | Stage 7 goal is marked NOT MET by its own phases — the stage does not achieve what it was written to achieve | OPEN, unowned, parked with auth |
| A13 | The 29 Jul auth re-anchoring pass was aimed at the wrong binary. SWEPT 29 Jul, all eleven receipts re-read, and the pass was wrong far past the one row that triggered the check: rows 1,2,3,4,7,8,9,10 stated absolutely when they are conditional on a configured lookup; row 5 a SECOND CONFIRMED FALSE RETRACTION (session routes gated on the lookup at unified.go:62, so with the token unset the session endpoint is never registered and the struck claim was literally true); row 6 the only one standing unconditionally | CLOSED as an audit — the sweep is done and committed. The findings it produced are parked with auth. Both docs now carry a caveat that this one has been wrong in BOTH directions |
| A14 | Import provenance covers TASK rows only. MEASURED at 2ff87d2 by execution: a zero-task import document with two payload users was ACCEPTED — collection created, both users persisted (type=root and type=Admin), PROVENANCE ROWS = 0. The stamp loop is keyed to importParams.Tasks and nothing requires that array non-empty, so collections and users are written unstamped. With the unvalidated users.type defect live, the uncovered path is exactly the one that persists arbitrarily-typed accounts | OPEN, unowned. Claim corrected on the branch; CODE FIX DELIBERATELY NOT REQUIRED THERE — scope freeze |
| A15 | "Run the lesson as a search, not a retrospective." The unreachable-error-branch shape (json.Marshal over a struct of plain string fields cannot fail, so its codes.Internal arm is untestable) was found twice on one branch by looking, after being recorded once as a lesson. A repo-wide sweep for that shape would likely pay. NOT RUN — new work under the freeze | OPEN, unowned |
| A9 | Unify the two label parsers | WITHDRAWN as a recommendation — a refactor with no oracle that can only move transitions from permitted to denied. Architect's own call if ever wanted |

## CI AND INSTRUMENTS — outside the current CI-green scope

> **ID COLLISION — CITE BY PHRASE, NOT BY NUMBER.** Two agents numbered this
> table independently, so **C7, C9, C10 and C11 each appear twice with different
> content**. Deliberately NOT renumbered: other agents' reports already cite these
> IDs and renumbering would silently repoint them. When referencing a row, quote a
> distinguishing phrase alongside the number. New rows use C15+.


| # | Concern | State |
|---|---------|-------|
| C1 | Does CI build and exercise the SHIPPING binary? | ANSWERED: YES. Measured from the object store at 43bd206, re-confirmed aa08f1a: make build compiles every package, go test ./... runs, and 5 package-qualified entries for cmd/farmtable-server are ASSERTED by the membership gate. So the green does NOT certify only the non-shipping binary. CLOSED |
| C7 | FIVE asserted tests for the binary that actually ships, out of 501 across the module | OBSERVATION, NOT ACTIONED. Coverage question, deliberately left here rather than added to the CI track |
| C8 | Nobody has measured what either CONTAINER IMAGE runs. C1 is scoped to the Go build and test steps of the workflow only | UNMEASURED, artefact named per clause 3 |
| C6 | EM-97 is filed as "a web build break breaks the production container build, and Dockerfile.server runs it" — BOTH images run it, from identical lines. The finding is right and its scope is understated | SCOPE CORRECTION, needs an owner |
| C2 | Committed build output clears both web/dist arms — force-add real output and pre-build waves it through | ~~KNOWN, fix in flight this track~~ — **RESOLVED @`43bd206`, merged by EM-CI.** Struck rather than rewritten so the in-flight status leaves a receipt. TWO-SIDED ON THE RUNNER, and the pair is what carries the claim, not the red alone: `canary/g6b-tracked-dist-unfixed` `691e8af` run `30462190434` **SUCCESS** — same canary, pre-fix arm, build output force-added under `web/dist` and the gate waved it through, so the hole was genuinely open; `canary/g6-tracked-dist` `f513fb7` run `30462188275` **FAILURE** at `Assert web/dist holds no build output before the build` as its sole red, same canary with the fix. A control that is red under both hypotheses would not be a control. LIMITATION, stated: both canaries commit a single stub file rather than the real 4109-file build, which is forbidden here; same code path, smaller input. FOLLOW-ON, already in flight on `fix/ci-review-findings`: the arm was an allow-list, i.e. a SUBSET test, so it closed this direction and waved through the OPPOSITE one — the marker missing entirely, which is the empty set and passes a subset test trivially. Upgraded to equality; see C-1 |
| C3 | Nothing checks web/dist freshness; a stale dist fails only because two gates happen to compose | KNOWN |
| C4 | MIN_TEST_FILES failure text coaches contributors to LOWER the floor | KNOWN, cosmetic-looking and not — **RESOLVED @`aa08f1a`** by EM-CI's runner branch: the failure text now opens with "TEST FILES DO NOT USUALLY VANISH ON PURPOSE", gives two commands to find them, and frames lowering the floor as a separate deliberate act belonging to the commit that deletes a suite. Two-sided canary: the OLD text's remedy line read `lower MIN_TEST_FILES in the same commit`, the NEW one reads *find them*. |
| C5 | The WatchTasks flake is a disposition, not a closure — fixed on a discriminator, never on 19 consecutive greens; the identity arm is unrecoverable, logs expired | ON RECORD |
| C7 | "Hold this hunk" has no mechanism — a conflict-free merge silently took main's narrowed web `test` script (C-1's cause), and the one gate that would notice is held expected-red, so its signal is masked by its own known failure. Class-level remedy: make the claim executable — assert from the GREEN, unmasked Go suite (`internal/webguard` already walks `web/`) that every `web/src/util/*.test.ts` guard file is reachable from `web/package.json`'s test script | PROPOSAL ONLY, unowned, NOT STARTED. MEASURED: the merge had zero conflicted files @d7154a4. NOT MEASURED: that the proposed test would be cheap or stable. PRECONDITION: must not live in `ci-suite-manifest.mjs`, which is held red |
| C9 | CI runs NO TypeScript typecheck of the web app. A syntax error in `web/src/components/**` passes both `npm test` and the whole CI workflow; only `npm run build` (`tsc --noEmit && vite build`) catches it, and that runs solely inside the two container builds. Cause: `tsconfig.test.json` compiles only what tests reach, so app modules no test imports are never compiled. ~~includes only `src/**/*.test.ts`~~ — CAUSE CLAUSE CORRECTED, NOT DELETED: that wording was TRUE AT FILING (@6255508) and is FALSE AT aa08f1a, where the file carries FOUR patterns. Struck in place with its SHA so the withdrawal leaves a receipt. THE DEFECT IS UNAFFECTED AND STILL STANDS — the narrowing is what test-reachability does, not what one glob did | MEASURED @6255508: I shipped exactly this defect (a backtick inside a template literal) and the test compile returned EXIT=0 while `tsc -p tsconfig.json` returned EXIT=2; parent 7397b17 clean, so the arm is two-sided. NOT MEASURED: whether adding a typecheck step to CI is cheap or would surface pre-existing errors elsewhere. PRECONDITION: bites only for source files that no test file imports; `ft-app.ts` and `ft-inspector-desc.ts` are both in that set |
| C10 | Both container images run `RUN npm test` — ~~at Dockerfile line 9~~ **line figure corrected, not deleted: line 9 was TRUE @3006492, and the same command sits at Dockerfile:20 and Dockerfile.server:21 @439b309** — under the comment "the release path must not be able to ship a tree whose guard is red" — and that command does not execute either guard the gate exists to protect. Partially answers C8 for the npm-test step only | MEASURED @3006492 (xss-f4 branch), fresh clone `/tmp/f4-clean`, porcelain -uall 0: `RUN npm test` present in BOTH `Dockerfile` (`/ft dashboard`) and `Dockerfile.server` (`/farmtable-server`, the live one); the command executes 1 test file (`task-ready`); `url-binding-scan.test.ts` and `safe-url.test.ts` are tracked and score 0 matches in the run. NOT MEASURED: that an image was actually built, or what the OTHER container steps run (C8 stays open); not measured at `43bd206`, where the `RUN npm test` line does not exist. PRECONDITION: bites only on branches carrying both the container gate and main's single-file `test` script — same held `web/package.json` hunk as C-1, closes when EM-CI's runner lands. NOT STARTED, NOT FOLLOWED |
| C11 | The CI step named `Makefile self-check (make test reaches both suites)` cannot detect a Makefile that stops reaching a suite. It is literally `run: make test`, which catches a target that FAILS but not a `test:` rule with a prerequisite removed, because that still exits 0. A gate whose NAME OVERSTATES IT is worse than an absent one: an absent gate is a known gap, an overstated one is read as coverage and the reader stops looking. Remedy would be to assert that `make -n test` REACHES each suite, which is a change to the gate itself | MEASURED ON THE RUNNER, run `30462186962`, head `4e2281b`, branch `canary/g5b-suite-dropped` (throwaway canary, never merged), base `43bd206`. One line changed, `test: test-go test-web` → `test: test-go`, nothing else: overall conclusion SUCCESS, the self-check step RAN and PASSED, and its log contains ZERO occurrences of `npm` and zero of `vitest` — it reached the Go suite and stopped. Two-sided: `canary/g5-makefile` `7bb35cc` run `30462188131` reds that same step as its SOLE failure when the `test-web` recipe is made to fail, so the step does work, it just does not check what its name claims. NOT MEASURED: whether a `make -n` reachability assertion is stable across make versions. Found by the canary process rather than by reading. UNOWNED, NOT STARTED — filed here under the scope freeze rather than added to the CI-track defect list |
| C12 | The membership gate reconciles the runner's DISCOVERY against the tree, but not against what the runner will actually RUN. `web/scripts/run-node-tests.mjs` has THREE coupled pattern sites — (1) `include` in `tsconfig.test.json` decides what is COMPILED, (2) `TEST_SUFFIXES` decides what is COUNTED, (3) the walk over compiled output decides what is RUN. `--list` reports site 2, and discovery happens BEFORE compilation, so a narrowed site 3 is invisible to `ci-suite-manifest.mjs`: the gate stays GREEN and over-credits files it believes are executed. It fails CLOSED — the runner's own source-vs-compiled count assertion catches it and CI reds at "Web tests" — so **the defect is the ATTRIBUTION, not the colour**: the failure is reported by the artefact under test rather than by the gate, and the gate's `executed` is a claim about discovery wearing the name of execution. Main is currently safe because site 3 is DERIVED from site 2 (`TEST_SUFFIXES.map(s => s.replace(/\.tsx?$/, '.js'))`) so the two cannot drift — but nothing in the gate enforces that it stays derived, which makes this a guard whose correctness rests on a property of the code it guards | MEASURED @`aa08f1a` on branch `canary/runner-spec-executes` `43fb7cd`, clean tree, node 20.20.2. Two-sided. Site 3 intact: `npm test` exit 0, `# tests 2 # pass 2`, the spec's own stdout marker PRESENT. Site 3 alone narrowed to `['.test.js']` with sites 1+2 left at four patterns: manifest still reports **`enumerated=2 executed=2 missing=0` and exits 0**, while `npm test` exits 1 with `Expected 2 compiled test script(s), found 1` and the marker ABSENT — the spec compiled, was counted, and never ran. Restored byte-identical (`cmp`), porcelain empty. NOT MEASURED: whether the gate could observe site 3 at all without running the compile, which it is designed not to need. UNOWNED, NOT STARTED — filed under the scope freeze. |
| C13 | `web/tsconfig.json` sets no `jsx` option, so a `.tsx` test file containing REAL JSX does not compile. The four test patterns (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) are now wired coherently across the tsconfig and the runner, but **the `.tsx` patterns are wired FOR DISCOVERY ONLY** — the extension is accepted, the syntax is not. Population of `.tsx` test files is currently zero, so this costs nothing today and bites the first person to write a JSX-rendering test | MEASURED @`aa08f1a`: a one-line `.spec.tsx` containing `<div>hello</div>` compiled under `tsc -p tsconfig.test.json` returns EXIT=2 with `error TS17004: Cannot use JSX unless the '--jsx' flag is provided` (plus TS7026, no `JSX.IntrinsicElements`). Probe file removed, porcelain empty. Found while building the `.spec.tsx` positive control for the runner, which is deliberately JSX-FREE for this reason. NOT MEASURED: which `jsx` setting suits Lit, or whether enabling it surfaces errors elsewhere. UNOWNED, NOT STARTED. |
| C14 | **The floor is a minimum where the right artefact is a SET.** `MIN_TEST_FILES` in `scripts/ci-suite-manifest.mjs` is an integer, so it detects exactly one class — the population collapsing toward zero, the vacuous-pass class — and is blind to the deletion of one file out of N. That second class is currently caught downstream by the enumerated/executed/missing reconciliation, but only because every present file is required to be executed; the floor itself certifies nothing about WHICH files survived. The repository already has the correct shape for the other language: `.github/expected-go-tests.txt` is a committed expected-SET, and its asymmetry is the valuable part — a removal blocks, an addition merely notices, so nobody has to remember to raise a number when they add a suite and nobody can quietly drop one. The remedy is the JS/TS mirror of that file, checked the same way, after which `MIN_TEST_FILES` becomes redundant and should be deleted rather than left as a second weaker guard saying something subtly different. **The brief asks for a minimum, so a minimum is what shipped today** — this is the named upgrade, filed rather than built, per EM-CI ruling 2026-07-29T15:00:59Z | MEASURED @`aa08f1a`, fresh clone of the commit, porcelain empty: `present` (git scan, runner-blind) = {`web/src/utils/task-ready.test.ts`}; the runner's own `--list` = the same single path; `A−B` = ∅ and `B−A` = ∅, so the floor is set TO the population at 1, not below it. Failure text and the constant's comment now state what the floor does NOT detect (commit `e811abf`, branch `docs/floor-predicate`), fired against an emptied population: exit 1, new clause printed, counts line `enumerated=0 executed=0 missing=0` — the vacuous pass itself. NOT MEASURED: the cost of generating and checking a JS/TS expected-set, or whether it should key on file paths or on test names as the Go one does. UNOWNED, NOT STARTED. |

| C9 | THE RELEASE PATH RUNS ZERO TESTS OF ANY KIND — measured @aa08f1a from the object store, both Dockerfile and Dockerfile.server: no go test, no npm test. The shipped image is never tested at build time; merge gating is the only defence | MEASURED. Recorded as a fact about the product, not as a consequence of the parked F14 item |
| C10 | Five asserted tests for the shipping binary out of 501, and the release path adds none | OBSERVATION, NOT ACTIONED (was C7) |
| C11 | R-3, the missing manifest generator; pipefail at ci.yml:202; missing if:always at ci.yml:243 and :261; the asymmetry drift number | FILED BY em-ci WITH REASONING, not dismissed. Outside CI-green scope |

| C15 | `scripts/ci-suite-manifest.mjs` **crashes instead of reporting** on the one regression it exists to catch. Narrowing `web/package.json` back to a hardcoded single file gives EXIT=1 via `ReferenceError: tsconfigFiles is not defined` at :572 — symbol referenced once, defined nowhere, on the code path taken when the test script is not a discovery runner | INHERITED, NOT BRANCH-INTRODUCED — identical on main aa08f1a, `git diff aa08f1a 439b309` on that file is EMPTY. Its red is a stack trace, not "these files never execute", so it invites fixing the crash instead of the regression. EM-CI's domain; untouched — **RESOLVED @`85026a0`** (branch `fix/tsconfig-files-refbug`, based 439b309), appended rather than deleted so the row's history stays auditable. PROVENANCE CORRECTED, one word only: this row reads INHERITED, and it is correct that `git diff aa08f1a 439b309` on this file is empty — but it was not inherited from anywhere. `git log -S'tsconfigFiles'` puts it in **`f94dfa2`**, the shared-runner commit, which renamed `tsconfigFiles` → `tsconfigInfo`, changed its return from an array to `{files, outDir}`, updated the call inside `expandRunnerScript` and missed :572. That is MY commit; the finder was right that it predates 439b309 and right not to touch it. FAILURE OBSERVED BEFORE FIXING, at 439b309 in a leg tree with real `node_modules`, `"test"` set to `rm -rf .tmp-test && tsc -p tsconfig.test.json && node --test .tmp-test/utils/task-ready.test.js`: `ReferenceError: tsconfigFiles is not defined at :572:23`, EXIT=1. Fix takes `.files` only — the `outDir` half belongs to the other call site's double-count invariant, and folding it in here would have been a wrong fix that went green. WHY IT SURVIVED: main wires the DISCOVERY arm, so stock and fixed scripts both give main `enumerated=6 executed=6 missing=0` EXIT=0 — identical. No arm had ever entered the branch, so nothing went red, which is not the same as the property holding. Durable arm committed at `13eb480` (`canary/explicit-paths-arm`, THROWAWAY, never merge): same six files wired as explicit compiled paths, GREEN for the named reason that all six artefacts map to tracked sources and executed equals population — not green by skipping the arm and not green on an empty set. Two-sided at the identical package.json shape: stock → ReferenceError EXIT=1, fixed → OK 6/6/0 EXIT=0. |
| C16 | **The stored-markdown XSS sink is defended by exactly one test file, and that file is one commit old.** MEASURED @439b309 by breaking the property: delete the sanitiser (3 diff lines, not vacuous) → `render-sink-xss.test.js` reds ALONE; capabilities, assertions, safe-url, url-binding-scan and task-ready all stay GREEN while stored markdown renders `<script>` and `img[onerror]` into the DOM. Not an oversight by any of them — `url-binding-scan`'s own header states it does not see lit's `unsafeStatic`/`unsafeHTML`. **The exclusion was documented and the replacement never existed.** For contrast the URL-scheme property is two files deep on two axes | NOT A MERGE BLOCKER — the union strictly improves on main, which had zero. Filed as depth-of-defence. A guard-shaped review could not have surfaced it: every guard was behaving correctly. **DOC-EXPOSURE SUB-QUESTION CLOSED AS A NULL RESULT, MEASURED @`439b309`** — `dev-xss-r9` raised, unprompted, that it might have landed text asserting the INVERTED depth claim (markdown sink thick, URL-scheme thin), which would put a doc on main that is confidently wrong about which guard is load-bearing. Grepped read-only via `git show` from the commit object, no working tree: `reports/dev-xss-union.md` section-0 (all three headline claims) SILENT, its 5.1 conjunct discussion SILENT, `.design/project-log/2026-07-29-dev-xss-r6.md` SILENT, `.design/project-log/2026-07-29-dev-xss-r9-fix.md` SILENT. **ZERO INVERTED, and this is an absence of the claim, not an absence of looking.** The phrase "markdown sink" appears ZERO times across all three documents — the inversion is not in them because the COMPARISON is not in them; it existed only in what r9 said aloud, which is where it was caught. Nearest lexical hits declared and rejected rather than scored: "the depth-accounting divergence" (r6, a named out-of-scope item), "both known consumers now live in one file" (r9-fix, the webguard census re-keying), and section-0's use of the word "INVERTED" about the ruling's before/after columns. Independently corroborated in the same pass: `agents.md:112` names BOTH `url-binding-scan.test.ts` and `safe-url.test.ts` as "the client-side half of the URL-scheme security property" — the CORRECTED shape already on main. `ft-inspector-desc.ts:233-239` scores SILENT, not a hit: it claims what DOMPurify COVERS, not which property is thicker |
| C17 | **`node --check` cannot see a call to a function that does not exist, and this project has now shipped one.** C15 was a `ReferenceError` that sat on a load-bearing analysis path in a 700-line CI script for the lifetime of several cited greens, because the file PARSES — syntax checking proves nothing about identifier resolution, and the only other defence was executing the path, which nothing did. The class is wider than the one instance: any rename that misses a call site, in any script CI depends on, is invisible until the branch is entered. A ~40-line static sweep catches the whole class in one pass and needs no new dependency, because TypeScript's parser is already in `web/node_modules`. NOT WIRED, deliberately — a new CI check is new scope and scope is frozen (EM-CI ruling 2026-07-29T15:19:27Z). The knowledge is inlined below so it survives without a branch. Parse with `ts.createSourceFile(..., setParentNodes=true)`; collect DECLARED names by walking for `FunctionDeclaration`/`ClassDeclaration` (`.name.text`), `VariableDeclaration` and `Parameter` (binding the name, recursing into `ObjectBindingPattern`/`ArrayBindingPattern` elements), `ImportSpecifier`/`ImportClause`/`NamespaceImport`, `CatchClause.variableDeclaration`, and named function/class expressions; collect USED names as every `Identifier` whose parent is not a `PropertyAccessExpression` `.name`, not a `PropertyAssignment` key, not a `ShorthandPropertyAssignment`, and not one of the declaration forms above; difference the two against a small allowlist of globals (`console`, `process`, `JSON`, `Set`, `Map`, `Promise`, `Buffer`, `URL`, `Error`, `Math`, `Date`, `RegExp`, `globalThis`, …). Whole-file, no scope-chain modelling needed for this class. | MEASURED @`439b309`. **POSITIVE CONTROL, which is the part that makes this worth filing**: run against the STOCK 439b309 blob the sweep reports exactly `UNDEFINED: tsconfigFiles  (first use line 572)` — the defect it is claimed to catch, and it is a defect that was real and shipped, not a planted one. Against the fixed file: `CLEAN`. Swept every tracked `*.mjs`/`*.js` outside `node_modules` and `web/dist/`: no other true positive anywhere in the repo, so C15 was the only one. **KNOWN FALSE POSITIVE, stated rather than filtered**: `meta` is reported at `web/scripts/run-node-tests.mjs:35` and `web/scripts/run-tests.mjs:59`; both are `import.meta.url`, which is a MetaProperty whose `meta` the naive identifier walk mis-binds. Verified by grep that neither file contains a `meta` that is not `import.meta`. Anyone wiring this must special-case `MetaProperty` or the check is red on a clean tree from day one. NOT MEASURED: behaviour on `web/src/**` TypeScript (only the `.mjs`/`.js` scripts were swept), whether scope-chain modelling is needed to avoid false positives on shadowed names in larger files, or the runtime cost. UNOWNED, NOT STARTED. |

## SECURITY AND OPS

| # | Concern | State |
|---|---------|-------|
| S1 | The host PAT — 93 chars, 1820 repositories, push on 279, admin on 243, across 20 orgs, expires 2026-10-14 | UNROTATED. ACCEPTED RISK BY OWNER INSTRUCTION, NOT RESOLVED. Eight-plus carriers, source is per-agent not per-host |
| S2 | The PAT sits in a working-tree file that is neither tracked nor gitignored — one directory-pathspec stage from publication | KNOWN. Mitigated only by the never-stage-a-directory rule |
| S3 | Five application ft_ tokens in uncommitted files, exposure measured zero | KNOWN |
| S4 | The harness keeps a permanent copy of everything every agent prints — "do not print the value" was never a sufficient control | STRUCTURAL, no remedy available to us |

| S5 | Canonical's working tree carries 9 untracked porcelain lines, three of them project-log entries (two task-state-hotfix-179 code reviews and ts-diff-r8.md). Untracked AND uncommitted means NO object store holds them; a checkout or clean destroys them. No before-measurement exists, so no delta is claimed | REPORTED by dev-onhold-toolbar, unattributed. PRESERVATION ORDERED ahead of the phase-2 merge into canonical, explicit paths only |

## PRODUCT

| # | Concern | State |
|---|---------|-------|
| P1 | Prime on_hold is directly selectable in the web toolbar at main — acceptance-criteria violation, live | OPEN, unowned, NOT parked behind the 39-commit web UI branch |
| P2 | CSP plus the markdown sink is an unstarted security round; IAP does not cover it | OPEN, unowned |

## RECORD

| # | Concern | State |
|---|---------|-------|
| R1 | The 308-item legacy tracker is frozen and unswept — a decision, not an omission | FROZEN |
| R2 | The lessons corpus is frozen at 327 items | FROZEN |

---

## ADDENDUM 2026-07-29 15:20Z — CORRECTIONS AND NEW ITEMS

### CORRECTION TO S5, STRUCK IN PLACE

~~S5 above states NINE untracked porcelain lines with THREE project-log entries.~~
**BOTH FIGURES WERE MINE AND BOTH WERE WRONG.** Measured by em-task-state against
canonical: **THIRTEEN porcelain lines, TWENTY-FIVE with `-uall`, SEVEN project-log
entries.** The struck text stays because the struck text is the only audit trail a
withdrawal has.

The error mattered, and not in the safe direction. The row was paired with an
instruction to preserve by naming every path individually. **Followed literally, my
own loss-prevention order would have saved three of seven single-copy files and
destroyed four.** em-task-state disobeyed the enumeration, obeyed the intent, and
preserved 20 authored files (`cmp -s` verified, mismatches 0) to
`refs/preserve/canonical-untracked-2026-07-29 = bfecd8d1`, built through a temp index
so canonical's HEAD and index were untouched, then double-homed by fetching into
another tree.

**THE GENERAL FORM, AND IT IS NOT OBVIOUS:** *name every path* is a WRITE-SAFETY rule,
not a DISCOVERY rule. It exists to stop a glob staging something uninspected —
over-inclusion. Used to DEFINE scope it guarantees under-inclusion, because the list
can only contain what the author already knew. **Applied to a save operation the rule
inverts: it stops protecting and starts deleting.** DISCOVER WIDE (`-uall`, full
sweep); STAGE NARROW, BY NAME, FROM WHAT THE SWEEP RETURNED. Never let the staging
list be the discovery list.

### NEW ITEMS

| # | Concern | State |
|---|---------|-------|
| S6 | **Agent clones have no durable remote.** Every agent clone's `origin` is a LOCAL FILESYSTEM PATH; at least one points into another agent's clone, so the chain terminates in a working directory. Canonical holds the only real GitHub remote and none of the at-risk work can reach it. A host-wide sweep recovered 204 single-homed ref tips into `refs/salvage/*` on origin, but **a sweep is a snapshot of a moment, not a mechanism** — it is stale within minutes and does not repeat | NEW SCOPE. **THE ONLY ITEM ON THIS PAGE AWAITING ptone.** Reported to him 15:14Z; filed here rather than dispatched, per his standing "do not add scope" instruction |
| S7 | `refs/salvage/*` is DURABLE BUT NOT FETCHABLE. origin's fetch refspec is `+refs/heads/*:refs/remotes/origin/*`, so the 204 refs never come back; canonical holds zero of them locally and a fresh clone sees none. Preservation you cannot spend | FOUND BY architect-reviewer. Remedy ordered: add the salvage refspec to canonical's origin fetch config FIRST, then commit a note giving the sweep date, the predicate, and why `refs/salvage` over `refs/heads`. **Config first — a note telling you how to find lost work is not read by someone hunting lost work** |
| S8 | **zsh rewrites `"$rev:path"` before the command runs** — an unbraced parameter followed by `:` starts a history modifier. Login shell is zsh 5.9; the literal form works, so it survives casual testing. Cost three agents on one check in ten minutes | REMEDIED BY RULE, not by tooling: brace always; ECHO THE CONSTRUCTED ARGUMENT before use; never `2>/dev/null` a measurement. **NO SEMANTIC TRIAGE FILTER EXISTS** — `:h` and `:t` are valid and RETURN values, so `"$r:t"` yields a bare well-formed SHA and `git show` renders a commit at exit 0. The defect produces false ABSENCE *and* false PRESENCE, and `t`/`w` are the leading letters of `test/`, `tasks/`, `tsconfig`, `web/`. Only a mechanical transcript grep bounds it |
| C12 | **THE 30 TRAP — a diagnostic whose disconfirming value became its expected value.** The control "26 = 22+4 confirms the four non-test helpers are excluded; 30 would mean they leaked" was sound at aa08f1a. At 439b309 the union grew by four real test files, so **30 is now the CORRECT merged population.** Anyone re-running post-merge and applying the old reasoning concludes a leak where none exists, or reads a real leak as union growth. Nothing announced the inversion | CAUGHT BEFORE USE by architect-reviewer. Standing remedy: **PUBLISH THE PATH SET, NEVER THE INTEGER.** A count cannot be diffed by the next reader and cannot distinguish leak from growth. A set can |
| C13 | Conflicts between main and the phase-2 branch went **3 → 9 in thirteen minutes** as main moved aa08f1a → 439b309. Every figure quoted in the reconciliation briefing — the floor of 1, the 26, the 22+4 decomposition, the three-conflict count — was derived pre-move and is stale | LIVE, being re-derived set-wise at 439b309 before the merge commit, SHA in the same sentence as every integer |
| S9 | **`web/src/util/safe-url.ts` and its test are an ADD/ADD collision: two teams independently implemented URL scheme validation in a security-critical file.** Picking a side silently discards one team's hardening, and nothing goes red | **MERGE-BLOCKING. CARVED OUT of em-task-state's merge and assigned to em-hardening**, which is itself one of the two parties. Ruling: UNION THE TEST TABLES FIRST, then let the unioned table pick the implementation — each side's tests are the written record of what that side knew about the attack surface. A contradiction between the tables (one admits a scheme the other rejects) is a POLICY DISAGREEMENT, not a merge conflict, and escalates rather than resolving quietly |
| R3 | **A corruption that leaves the text readable is worse than one that breaks it.** A leg's message had a word eaten by zsh command substitution; the eaten word was the STAGE NAME in a sentence about which stage was denied, so the sentence still parsed and a reader could have reconstructed the wrong value. Broken text fails safe; readable text fails silent | FILED AS A CLASS (em-hardening's). Same family as guards certifying an empty set — the signal survives, the information does not |
| A10 | **`internal/store` has a FLAKY DATA RACE and it is PRE-EXISTING, not round 12's.** `go test -race ./internal/store/ -count=1` fails ~3/5 at base `2ffc22a` and ~4/5 at `0904a22` — a rate difference, on 5 runs each, that is not evidence of anything. Test `TestMultiStore_LazyRegistration_ConcurrentSafety`. The racing write is NOT ours: it is `entgo.io/ent@v0.14.6 dialect/sql/schema.(*Atlas).setupTables` (atlas.go:1089 and :1100) writing PACKAGE-LEVEL GLOBALS, reached because the test drives concurrent `migrate.Create()`. Ours only calls it | FILED, NOT FOLLOWED — scope frozen. Measured at both SHAs before filing, because I edited `multistore.go` and "pre-existing" was a claim I was not entitled to assume. NOTE THE HAZARD FOR WHOEVER TAKES IT: run the test ALONE and it is GREEN; it only reds under whole-package load, so a single-test reproduction attempt will wrongly clear it |

## ADDENDUM 2026-07-29 15:35Z — CHANNEL, GLOB, MERGE-TREE, AND THE RULE GOING SYMMETRIC

**S10. AN ERROR ON STDOUT IS NOT EVIDENCE OF NON-DELIVERY.** A group `scion message`
whose body exceeds 2000 characters with a user in the recipient set prints CLI usage
help and **still delivers to every agent recipient**, dropping only the user, silently.
I read the usage help as total failure, rewrote the message, and sent it again. Both
copies reached all four agents; ptone received one. Confirmed by a recipient, not by
me. **The failure text and the delivery outcome are on different channels and neither
implies the other.** Remedy: read the delivery count, never the error text; assert the
expected integer (5/5), never the presence of "Delivered" lines. Second failure mode on
the same command, unchanged: a body containing lines that begin with a dash is parsed
as flags.

**S11. THE STAR DOES NOT CROSS A SLASH.** `git for-each-ref 'refs/salvage/*'` returns
**0**; `refs/salvage/**` returns 442; the bare prefix `refs/salvage` returns 204. Two
parties hit the identical false zero independently within one hour, and one was a send
away from reporting the salvage refs as unfetchable. Uniformity across independent
observers is evidence about the instrument.

**C17. MERGE-TREE PROSE VERSUS STAGE ENTRIES.** `git merge-tree --write-tree` prints
`Auto-merging <path>` for files it merged **successfully**. Any predicate that harvests
paths from the whole output therefore **counts clean merges as conflicts**. The
machine-readable contract is the stage-numbered entries; the informational lines are
not. This produced a conflict set of eight where the measured set is seven, with
`web/src/components/ft-app.ts` the spurious member. Under adjudication by the branch
owner at time of writing.

**R4. THE CONTROL RULE IS NOW SYMMETRIC, SUPERSEDING THE ABSENCE-ONLY FORM.** Every
reported result, absence **or presence**, must name something the same invocation was
expected to catch and report whether it caught it. For an absence, a known-present
member of the same population. For a green, what the run flagged — **a green that
caught nothing at all is an unlit instrument, not a pass.** For anything counted,
assert the expected integer rather than the presence of results. `run-node-tests.mjs`
has enforced exactly this in code since before it was written down: zero test files is
a failure, not a quiet success. We wrote it for our code and exempted ourselves.

**R5. THE ALARM-DIRECTION TALLY MEASURES DETECTABILITY, NOT OUR INSTRUMENTS.** Six
instrument failures in one day all failed toward alarm. That cannot be evidence of a
bias toward alarm, because **a comfort-direction failure returns "nothing wrong",
nobody looks twice, and it never enters the tally.** The sample is censored at the
point of collection. Corollary, and the reason R4 went symmetric: every
alarm-direction failure that day was caught by its author before sending, six for six.
The ones we have never caught are the ones nothing surfaces. Withdrawn: my word "bias".
Replacement: **detection asymmetry.**

---

*Appended 2026-07-29 ~15:28Z by architect-reviewer (ptone's independent reviewer of
process). Written, not broadcast, per the channel rule. Nothing here needs a reply.*

**C17 — STATUS CLOSED: THE SET IS SEVEN.** No longer under adjudication. Three parties
measured it independently from the stage entries, each with a lit control
(`web/src/util/safe-url.ts`, which all parties agree is conflicted, returned in every
arm): architect-reviewer, em-task-state, em-ci. All three return seven.
`web/src/components/ft-app.ts` auto-merges and was never conflicted. The coordinator's
ratification of eight is withdrawn. Operative split: five to task-state, two
(`safe-url.ts`, `safe-url.test.ts`) carved to hardening. Merged suite unchanged at 30.

**R4a — THE SYMMETRIC RULE HAS A KNOWN EXCEPTION, AND R4 AS WRITTEN READS AS COMPLETE.**
Substitution defeats it. Delete one test and add another in the same commit: cardinality
is unchanged, the gate stays green, and coverage silently changes. R4 does not catch
this, and the reason is worth stating precisely — **the invocation genuinely did catch
something, so naming what it caught returns a true answer while the suite has changed
underneath.** R4's control question is satisfiable by a run that has already lost the
thing it was guarding. Only a **committed expected set** detects substitution. Filed by
em-ci, explicitly not being fixed today; recorded here so R4 is not later read as
covering a case it does not cover.

**C18 — ABSENCE OF A CONFLICT IS NOT EVIDENCE OF A GOOD MERGE.** The general form of
"auto-merged is not correct." A clean textual merge is reported as requiring no
attention, which is indistinguishable from having been reviewed. `ft-app.ts` is the live
instance: the dashboard root, two commits on main since the merge base, landing with
nobody having read it. Now assigned an eye during the merge rather than merely noted.
Same shape as R5, one level up — the reassuring result is the one nobody audits.

**POINTER, because preservation you cannot find is not preservation** (the salvage-refs
lesson, applied to this review's own output):
- `design-restructure-em-topology.md` — assessment of remaining work and the EM topology
  recommendation. §8 open questions updated: three of five now closed.
- `briefing-test-split-reconciliation.md` — the web test split. **Read the 15:17Z
  addendum first; the body's figures were taken at `aa08f1a` and are superseded.**

**Recommendation carried by both docs:** do not re-cut the EM topology. The 13:44
three-EM structure self-corrected three times in one hour without owner intervention.
Re-planning instead of landing is this project's dominant failure mode.

---

## EM-357 [em-task-state, 2026-07-29 ~15:26Z] MY EIGHTH CONFLICT WAS AN ARTEFACT — and the reason it survived is the transferable part

FILED, NOT SENT, under the write-do-not-broadcast rule. The arithmetic is settled
(seven, three parties, each with a lit control). This entry is the mechanism only.

**WHAT I DID WRONG.** I harvested conflicted paths from `git merge-tree --write-tree`'s
WHOLE OUTPUT rather than from its stage-numbered entries. merge-tree prints
`Auto-merging <path>` for files it merged SUCCESSFULLY. So my predicate counted clean
merges as conflicts. Credit for the correction: architect-reviewer, who also produced
the same phantom on their own first pass and said so.

**WHY IT SURVIVED, WHICH IS THE PART WORTH KEEPING.** Measured in one invocation, both
figures from the same output file at 439b309 x e64138c:

```
stage-entry paths (awk field 3 in {1,2,3})   7
Auto-merging lines                            8
naive harvest of any web/ token, whole output 8
set difference                                exactly web/src/components/ft-app.ts
```

The naive predicate agreed with the true set in **SEVEN OF EIGHT MEMBERS**. That is not
a random error. It is a **SUPERSET**: the files git had to content-merge are a superset
of the files it failed to merge. Three consequences:

1. It is wrong only in the direction of **ADDING WORK**, so it never trips a
   consequence that would reveal it.
2. It **CANNOT BE CAUGHT BY SAMPLING MEMBERS**. Every member you spot-check is probably
   genuine — 87.5% of them are. Verification effort spent inside the set returns clean.
3. It is visible **ONLY BY CHANGING INSTRUMENT**, which is what AR did.

**THE STING, AND AR SAID IT BEST:** this landed inside my own published set on the very
day PUBLISH THE PATH SET, NEVER THE INTEGER became binding. *Publishing a set is
NECESSARY, NOT SUFFICIENT — the rule is only as good as the predicate generating it.*
A wrong set published in full is more persuasive than a wrong integer, because it
supplies its own apparent evidence.

**CORRECTION-SCOPE CHECK, run unprompted** (a retraction is a claim and gets the same
controls): the one other set I published from this merge — the 30-path population — does
NOT share the defective predicate. It comes from `git ls-tree -r` on the merged tree
`e1fa2dc10bd295118459199f63dbcbd2ad5ea7b3` (522 paths), filtered by the gate's own
regex. Different instrument, different output, no prose anywhere in it. I re-derived it
rather than assert that from memory. Expected integer 30, got 30. Two arms in the SAME
invocation: known-present `safe-url.test.ts` returned 1 of 1; known-excluded
`setup.ts`, `helpers/dom.ts`, `helpers/feedback.ts`, `helpers/fixtures.ts` all
in_tree=1 in_population=0, 4 of 4.

**GENERAL RULE, for any tool with a human-readable and a machine-readable channel:**
harvest from the machine-readable contract. Informational prose names the same objects
in the same shape and is not a contract. `Auto-merging` is the worked example;
`git status` long-format and `git rebase` progress lines are the same hazard.

## EM-356 [em-task-state] ZSH SWEEP: zero contaminated figures, but safe by the FIRST LETTER OF THE PATH

Population: Bash tool inputs only. 3253 commands executed, 38 containing unbraced
`$var:path`, 23 distinct spellings, 51 matching lines. Net new contaminated figures:
ZERO.

First attempt was WRONG and self-corrected: grepping the whole 213MB transcript gave
138, but that population included inbound relays QUOTING the bug and my own EM-349
prose. **A sweep for a defect preferentially finds the documents ABOUT the defect** —
polarity trap, 5th instance.

NOT A CREDIT TO ME: every git-object command carrying the construct happened to resolve
a path beginning `internal/` or `.github/`. `i` and `.` are not zsh history modifiers.
A repo laid out with `src/`, `test/`, `pkg/`, `helpers/` or `e2e/` reproduces EM-349
immediately. The brace rule is unconditional; this zero does not license relaxing it.

## EM-358 [em-task-state] THE CARVE-OUT FILES HAVE NO MERGE BASE — add/add, stages 2 and 3 only

Both `web/src/util/safe-url.ts` and `web/src/util/safe-url.test.ts` carry stage 2 and
stage 3 entries and **NO STAGE 1**. Every other conflicted path has all three. Both
sides created these files independently, from nothing.

So for those two there is no ancestor to diff against and nothing to three-way merge.
Union-the-test-tables-first is not the *better* method for the carve-out, it is the
**ONLY** available one — any attempt to resolve them the usual way finds no base and
quietly degrades into a pick-a-side, which is exactly what the ruling forbids.

Same shape as the floor finding one level along: a gate that counts cannot see a
security test vanish, and a merge that assumes a common ancestor cannot see that two
sanitisers were written independently. SENT to the thread (only in-scope item);
recorded here for em-hardening.


## EM-359 [em-task-state, 2026-07-29 ~15:29Z] COUNTING DELIVERIES DOES NOT CHECK THE ADDRESSEE — I produced the comfort-direction failure minutes after the thread mandated the count

**THE EVENT.** I posted the add/add carve-out finding (EM-358) to the group thread,
addressed to **em-hardening by name**, with an explicit "before you touch those two"
instruction. The send reported **5 of 5 delivered**. I checked it, as the new rule
requires, and it was TRUE.

**em-hardening is not one of the five.** Thread recipients are ptone, em-ci, the
coordinator, architect-reviewer and me. `farmtable-em-hardening` is a separate running
agent and was never on the list. So an actionable instruction reached four parties who
did not need it and **zero** of the one party who did — while every check in place
reported complete success.

**WHY THE NEW RULE DID NOT CATCH IT.** The delivery count is a check on TRANSPORT. It
answers "did the bytes arrive at each configured recipient". It is structurally
incapable of answering "is the party this message is addressed to among the configured
recipients". Both AR's 3/4 drop and this are addressed by "check the count" — but only
AR's is. Mine passes the count with full marks.

Stated generally, and it is the same shape as #117 (delivery pinned, consumption not):
**A COUNT OVER A LIST CANNOT VALIDATE THE MEMBERSHIP OF THE LIST.** The instrument and
the population share a definition, so the instrument cannot see a defect in the
population's boundary. Compare #149: a gate that reads a count is blind to a
count-neutral corruption. Here the corruption is not even count-neutral — the count is
simply about a different question than the one I believed I was asking.

**THE REMEDY, symmetric per the amended rule:** when a message names a party in the
imperative, assert that party is in the recipient set — by name, before sending, not by
counting afterwards. If you address someone who is not a recipient, the send is a
failure at 5/5.

**CENSORED-SAMPLE NOTE.** This one only surfaced because I re-read my own sent text and
noticed the vocative. Nothing in the tooling would ever have raised it, and em-hardening
would have resolved the two safe-url files without the finding, with all parties
believing it had been delivered. That is AR's comfort-direction class exactly, produced
by me, about the very check the thread had just made mandatory, inside ten minutes.

**DISPOSITION:** finding re-sent DIRECT to `agent:farmtable-em-hardening`, delivered,
with the routing defect disclosed in the same message.

**C19 — em-task-state's baseless-path claim is INDEPENDENTLY CONFIRMED, and the way I
nearly falsified it is the more useful record.** Measured at `main=eca9239` (the floor
fix has landed) vs the operative rebased tip `e64138c`:

```
stages[123]  web/package-lock.json          stages[23]  web/src/util/safe-url.ts
stages[123]  web/package.json               stages[23]  web/src/util/safe-url.test.ts
stages[123]  web/src/components/inspector/ft-inspector-code.ts
stages[123]  web/src/components/inspector/ft-inspector-meta.ts
stages[123]  web/src/utils/task-ready.test.ts
```

Seven paths. Exactly two lack stage 1, and they are exactly the two carved out. No
merge base exists for either: both sides created them from nothing. em-task-state's
operational conclusion is therefore correct and stronger than a preference — **union the
test tables is not the better method for these two, it is the only available one.** A
conventional three-way resolution finds no ancestor and degrades into a pick-a-side
without announcing that it did so.

**The near-miss, which is the durable part.** My first run used branch tip `61ca67e` and
returned NINE paths with THREE lacking stage 1 — the extra being
`web/scripts/run-node-tests.mjs`. I was seconds from broadcasting "em-task-state's rule
has an exception." It does not. `61ca67e` is the **unrebased** tip; `dev-p2-rebase`
already resolved `run-node-tests.mjs` and `tsconfig.test.json`, so both vanish from the
conflict set at `e64138c`. **This is the second time in this review I measured against
the unrebased tip and drew a false conclusion from it** (the first produced the retracted
nine-conflict figure). Twice, same cause, no instrument caught either — I caught them by
re-deriving before sending.

**Standing hazard for anyone re-checking the carve-out:** measuring against `61ca67e`
yields three baseless paths and makes em-task-state look like it under-reported. It did
not. **State the tip SHA beside every conflict figure** — the addendum's rule about
publishing the SHA in the same sentence was written for stale *main*; it applies with
equal force to the *branch* tip, which is the case that actually bit, twice.

## SAFE-URL ADJUDICATION AND INSTRUMENTS — filed by em-hardening 2026-07-29 ~15:30Z

Written rather than messaged, per the volume rule. None of these needs anyone's
attention within the hour; all of them would have cost every recipient's context.

| # | Concern | State |
|---|---------|-------|
| C18 | **A test can satisfy membership AND execution while no longer measuring its subject.** MAIN's `web/src/util/safe-url.test.ts` asserts against `testdata/url-scheme-cases.json` (blob `4a54328`), the CLIENT half of a cross-language differential pin whose server half is `TestValidateURLFieldMatchesSharedFixtures` in `internal/server/urlvalidate_differential_test.go`. The fixture does NOT exist at 633f8f2 (verified, exit 128, stderr not suppressed). Discard MAIN's test blob and the **Go half goes on asserting against a fixture nothing on the client checks, staying GREEN** — the client/server agreement property evaporates with zero red anywhere | **PROMOTED OUT OF BACKLOG BY COORDINATOR RULING**: no longer a cost to pay later, it is a MERGE ACCEPTANCE CRITERION — whichever implementation wins, the fixture must remain asserted from both sides IN THE SAME COMMIT, plus a red arm (delete/rename the fixture and prove something reds; if nothing does, the pin was already decorative). The residual backlog item is the CLASS: the membership gate is structurally blind to this, because the test is still listed, still executes, still passes. Unowned, not a programme |
| C19 | **`web/src/util/` and `web/src/utils/` both exist as sibling directories.** Observed while verifying merge stages at 439b309 vs e64138c: `web/src/util/safe-url.ts` and `web/src/utils/task-ready.test.ts` are conflicted paths in the same merge. A one-character directory difference is a latent add/add generator and an import-path trap | UNMEASURED beyond the two paths named. Not investigated, not a merge blocker, filed only because it was visible from a measurement taken for another purpose |
| C20 | **No merge base exists for the safe-url pair — the resolution method was forced, not chosen.** VERIFIED INDEPENDENTLY by em-hardening at `git merge-tree --write-tree 439b309 e64138c`, harvesting the machine-readable STAGE ENTRIES rather than the informational "Auto-merging" prose: `web/src/util/safe-url.ts` and `web/src/util/safe-url.test.ts` show stages **2,3 only**. Control paths in the same invocation show **1,2,3**: `web/package.json`, `web/package-lock.json`, `ft-inspector-code.ts`, `ft-inspector-meta.ts`, `web/src/utils/task-ready.test.ts`. Seven conflicted paths total, matching the corrected count of seven | CLOSED AS MEASURED. Consequence: there is no ancestor to diff and nothing to three-way merge, so **a conventional resolution degrades silently into picking a side and inheriting its test table** — the exact outcome the union ruling forbids, and it would not announce itself. Union-the-tables went from "the better method" to "the only available method" |
| C21 | **COUNTING DELIVERIES DOES NOT CHECK THE ADDRESSEE.** A finding addressed to em-hardening BY NAME was posted to the group thread and reported **5 of 5 DELIVERED**. em-hardening is not a member of that thread; the five were ptone, em-ci, the coordinator, the advisor and the sender. So a message reached everyone EXCEPT the only agent who had to act on it, and the delivery count — the check this project had just made mandatory — **truthfully confirmed the success**. Found by the sender, disclosed unprompted | RECORDED. Same class as the day's dominant defect: right answer to a different question. The count answers "did the transport work", never "was the person who must act in the room". No fix proposed; scope frozen |
| C22 | **The unit error, and why only two blind counts could catch it.** The union leg reported "MAIN 49 ROWS". 49 is MAIN's DISTINCT-INPUT count; MAIN's ROW count is **78** (Tier A 36 rows / 35 distinct, Tier B 42 / 42), because MAIN asserts many inputs twice across two harnesses. Arithmetic `49 + 45 − 12 = 82` was never wrong — the NOUN was. Union resolves to **81 distinct inputs / 82 rows**, the contradictory pair deliberately NOT deduplicated so the conflict stays visible | CORRECTED IN PLACE, struck not deleted. **The generalisable part**: an after-the-fact auditor INHERITS THE LABEL ALONG WITH THE NUMBER, so no review of a finished table could have found this. The coordinator withdrew its own instruction (single reviewer checking the table) in favour of two independent blind counts, and the replacement paid out on its first run |
| C23 | **A routing test cannot detect a hollowed-out destination.** MEASURED via `reports/safehref-disarm.md` at 439b309: replacing `safeHref`'s 64-line body with a passthrough kills ONLY `util/safe-url.test.ts` (6 files: baseline 6/0 → disarmed 5 pass 1 fail). `url-binding-scan.test.ts` STAYS GREEN because it asserts that every href binding routes THROUGH `safeHref` — the disarm leaves every call site perfect and guts the destination. `render-sink-xss.test.ts` also stays green, which is C16 with a measurement under it | RECORDED AS A TEST-DESIGN CLASS. **Union-table rows of routing shape pass against any implementation, including none.** Also carries its own limits, stated by its author rather than discovered later: an implementation rejecting `javascript:` but accepting a backslash-obfuscated authority, or laundering protocol-relative `//evil.com/x` via `window.location.origin`, passes this disarm cleanly. It is a kill oracle for ONE property at its COARSEST failure. Instruction attached: **union the tables, then MUTATE THE SURVIVOR** |
| C24 | **Two diff numbers can both be right, and one of them is zero only if you have no mutant.** The safeHref disarm region is **64 lines**; `git diff --numstat` reports **1 63**, because the closing brace is common and git matches it. Anyone re-deriving and getting 63 has NOT erred | RECORDED so the discrepancy is not later read as a defect. Paired standing rule, third independent instance today: **`git diff --numstat` AFTER EVERY PATCH, BEFORE READING ANY RESULT.** A reviewer's M11 patch silently failed to apply on gofmt alignment and returned ALL-PASS — read carelessly, "M11 is a survivor". **A ZERO-DIFF MUTANT REPORTS ON YOUR PATCH, NOT ON THE TEST** |
| C25 | **Misattribution retracted, em-hardening's own.** I attributed the "PRESENT (0 lines)" zsh misfire to `review-import-hardening`. FALSE. Its round-1 check used a LITERAL SHA (`git show 6dbfc8c:internal/server/export_import_provenance_test.go`), no parameter, so no history modifier could apply; it returned 480 lines and verified all three retired tests. The misfire belonged to `review-xss-union`, which had disclosed it itself | CLOSED, name cleared. Pooling two agents into one attribution is the same error as pooling two trees into one integer, committed while writing about instrument discipline |
| C26 | **An arm battery only covers defects the author imagined.** `review-import-hardening` accepted 6-of-9 not-oracle-first on f487dc5 on the explicit ground that it had personally reddened all five arms — and attached the condition itself: "I would not want 9-of-9 next branch." N2-2 is the gap that shape leaves: the `missing_token` wording subcase PASSES under mutation M7, because the generic fallback text ALSO names `FARMTABLE_TOKEN`, so the subcase cannot distinguish its own branch from the fallback | ACCEPTANCE IS BRANCH-SCOPED, condition recorded with it. N2-2 filed as a nit by the reviewer and **treated as merge-gating by em-hardening** — it is round 1's finding recurring one level down at subcase level, i.e. a correction scoped to the instances in front of you is the original defect one level up. Fix asserts the unique phrase and must DEMONSTRATE the subcase reddening under M7; a reworded inert assertion nobody reddens is not a fix |

**R6 — A RULING THAT NAMES ONLY A LETTER IS NOT ADDRESSABLE, AND THE FAILURE IS SILENT.**
At 15:30Z a one-line ruling arrived — *"C is OK, but I would switch to allow by default"* —
with no document named. Six live docs carry a section or option **C**, owned by at least
four different agents: safe-url scheme policy, decomposer resume-mode, decomposer fan-out
limits, IAP token-in-query, EM release-manager, dependency-view viewport culling.

The hazard is not the ambiguity, it is that **every candidate is independently actionable**.
Any recipient can read the ruling as applying to their own C, apply it in good faith, and
report compliance. Nothing in the exchange would reveal the mismatch — the ruling looks
answered, and it may have been answered in the wrong document. This is the comfort-direction
shape again (R5, C18): the reassuring outcome is the unaudited one.

Sharpening the risk here: the readings are not equally consequential. On safe-url,
"allow by default" inverts an allow-list into a deny-list and admits `javascript:`,
`data:` and `vbscript:` unless separately named — the precise XSS sink both independent
implementations were written to close. On decomposer fan-out or IAP token-in-query the
same words are routine. **A default-posture instruction cannot be safely applied without
naming its artifact**, because the words are identical across a benign and a dangerous
target.

Rule proposed: **a ruling must name the file and the section, not a letter.** Where it does
not, the recipient asks rather than infers — and asks even when their own C is a plausible
fit, since plausibility is what makes the wrong application look correct. Held unapplied
pending ptone's disambiguation; not acted on in any document.

**R6 — RESOLVED 15:33Z, AND THE CAUSE IS MECHANICAL, NOT HUMAN.** ptone: the question was
the **coordinator's**, asked on this thread; it was re-answered to the coordinator directly.
Nothing was applied to safe-url or any other document. No forwarding needed.

The mechanism, which is the part to keep: **architect-reviewer is the default recipient for
bare replies on this thread.** A reply carrying no explicit recipient lands on me regardless
of who asked. So the misdelivery was not a slip in wording — it is the routing default, and
it will recur whenever a second agent asks a question on a thread whose default recipient is
someone else. Frequency scales with how many agents share a thread.

Why this was caught: the ruling did not match any question I had asked. That is the only
signal available, and it is **weak and asymmetric** — it fires just when the wrongly-routed
instruction happens to be irrelevant to the recipient. Had ptone's words applied plausibly to
a C of my own, I would have had no reason to doubt delivery, and R6's original hazard —
apply in good faith, report compliance, mismatch never surfaces — would have run to
completion. The near-miss is the finding; the incident is not.

R6's proposed rule stands and is now better motivated: **a ruling names its file and section,
and a recipient who cannot match a ruling to a question they asked stops and confirms** — the
latter is the only check that survives a routing default, since it does not depend on the
instruction looking wrong. Filed for the messaging layer: bare replies on a shared thread
should route to the asker, or name the addressee.

## ADDENDUM 2026-07-29 15:35Z — A RULING INVALIDATED BY A DECISION ELSEWHERE

### R6. A RULING CARRIES ITS PRECONDITION OR IT CANNOT BE REVISITED
C2 was escalated to the owner and answered: plaintext http links ALLOWED by default,
per-deployment switch to block. Option C mechanism, default inverted from what I
recommended.
I had ruled C1 (IPv6 loopback) HELD, as subsumed by C2. That ruling was correct when
made and rested on a measured precondition em-hardening had established at the code:
with the http gate FALSE, http://[::1]/x dies on SCHEME before any host reasoning runs,
so there was no production host-axis loopback check to decide.
THE OWNER FLIPPED THE DEFAULT TO TRUE. The loopback branch that C1 governs is now on
the default production path. C1 is UN-HELD and must be decided on its merits.
THE GENERAL FORM, WHICH IS THE REASON THIS IS FILED: a ruling can be correct at the
moment it is made and be invalidated later by a decision taken somewhere else, on a
different track, by a different party. Nothing about the ruling itself goes stale or
looks wrong. The ONLY thing that makes it recoverable is that the precondition it
rested on was written down explicitly. Had "C1 held, subsumed by C2" been recorded
without "because the scheme check fires first while the gate is false", the flip would
have sailed past and C1 would have shipped as settled while the branch it was dark
behind was live.
RULE: EVERY HELD, DEFERRED OR SUBSUMED RULING RECORDS THE PRECONDITION IT RESTS ON, IN
THE SAME LINE. A deferral without its precondition is not a deferral, it is a silent
decision with a delay on it.

### S12. CITE ONLY SHAS THAT REV-PARSE HAS RETURNED
em-hardening put commit 9f81b8f into the record as a repair commit. cat-file exit 128:
THE OBJECT DOES NOT EXIST. It was a forward-reference from a leg's draft — a SHA
written while the commit it named was still intended rather than made — that passed
through a reporting layer without resolution. Real SHAs were c623332, 1713ce8, cf54ad5,
2235ad8.
Same class as the zsh history-modifier defect and the 49-rows-vs-49-inputs label error:
RIGHT FORMAT, WRONG VALUE. A 7-hex string is self-authenticating to the eye and to no
one else. It never fails loudly; it fails as an unresolvable reference weeks later when
whoever reads the record has no way to reconstruct what was meant.
THE LEG'S HANDLING IS THE PART WORTH COPYING. It refused credit under an unresolvable
SHA, disclosed that it had reached for an unmade SHA THREE TIMES while writing up, and
filed THE RATE rather than the three instances. A rate is a property of the process and
can be designed against; instances are anecdotes and get patched individually.
RULE, STANDING ACROSS ALL THREE TRACKS: no SHA enters a report, a commit message, a
brief or this file unless rev-parse has returned it in the same session that cites it.

### D3. REJECT UX IS AN OPEN OWNER DECISION, NOT A MERGE ARTEFACT
The two safe-url implementations disagree on what a REFUSED url renders as. MAIN
degrades to an inert span still carrying the raw address in a title attribute, pinned
in tests. BRANCH renders the item unlinked and does not surface the rejected value at
all. Both are green. Both are safe against the XSS. Taking branch wholesale silently
drops "degrade, do not drop" and nobody would notice at merge time.
ESCALATED. Recommendation: branch behaviour (no trace) plus a server-side log, on the
reasoning that C2's allow-by-default means everything still refused is HOSTILE, so
main's diagnostic span is now a surface for rendering attacker-authored text to the
person being targeted. An operator log serves the diagnostic need without the audience.
Both rows held pending the answer. Not to be guessed.

### S13. ONE SURFACE, ESTABLISHED ON CONSUMERS RATHER THAN PROSE
"Is safeHref vs safeExternalUrl one policy surface or two" was settled by asking which
components CALL each, not by reading docblocks, which could be argued either way.
safeExternalUrl has ZERO consumers at main; safeHref has ZERO at the branch tip. Same
two components, same two fields, same sink, same threat, mutually exclusive across the
two commits. Two genuinely distinct surfaces would COEXIST SOMEWHERE with different
consumers. It is a rename. "Land both" withdrawn — it was my suggestion and it was
wrong. THE INSTRUMENT IS THE POINT: for "are these the same thing", call sites are
evidence and documentation is opinion.

---

## EM-360 — "ORIGIN" NAMES TWO DIFFERENT REMOTES, AND THE PUSH-FIRST GUARD WAS WRITTEN IN ONE VOCABULARY AND DISCHARGED IN THE OTHER

**Status: LIVE. Two tips were single-homed. I pushed them. The rule needs rewording before
any other EM runs it.** Filed by em-task-state; found independently by FOUR legs
(`dev-onhold-toolbar`, `dev-p2-assemble`, `ts-diff-r8`, `dev-p2-rebase`).

### The mechanism

Permanent rule 4 says *clone leg trees from the local path, not the network remote.* So in
every leg tree, the remote **named** `origin` is a filesystem path under `/workspace` —
canonical. The coordinator's new GC guard says *"push every ref in its tree to ORIGIN...
confirm it landed on origin, THEN delete."* A leg discharging that guard literally, against
the remote named `origin`, **pushes one container's disk into another container's disk and
reports complete success.** Durability achieved: zero. `dev-p2-rebase` stated it exactly:
*"I would have pushed into another container's disk and reported success while achieving
ZERO durability — the exact failure this rule exists to prevent."*

### It was not hypothetical — it had already happened, twice

Three legs reported ON-ORIGIN with lit instruments, honest arithmetic and correct commands.
I re-tested their tips from canonical, the only tree holding the network remote, with both
control arms in the same invocation (known-present `2982ffd` → TIP-OF-A-NETWORK-REF;
purpose-built local-only blob `6b5d09d` → NOT ON NETWORK ORIGIN, so the test discriminates):

```
645877b  dev-onhold-toolbar HEAD, the deliverable   >>> NOT ON NETWORK ORIGIN <<<
8fa5762  refs/preserve/phase2-r5/attention-view     >>> NOT ON NETWORK ORIGIN <<<
61ca67e / 633f8f2 / e4e3d13 / 901670e / e64138c     TIP-OF-A-NETWORK-REF
```

**Every leg answered truthfully and the aggregate answer was false.** Had I honoured the
"safe to delete me" that each report ended with, two objects would have been left reachable
only from canonical's disk — the precise 45-single-homed-HEADs shape of task #170, which is
the crash this guard was written after.

**REMEDIED:** both pushed to the network remote, named individually, no force —
`refs/salvage/dev-onhold-toolbar/onhold-toolbar` and `refs/salvage/phase2-r5/attention-view`.
Re-measured through the same instrument that had said NOT-ON: both now resolve, and the
negative control still reads absent in that same invocation.

### The class

**A WORD THAT RESOLVES DIFFERENTLY IN THE CHECKER'S TREE AND THE CHECKED TREE MAKES EVERY
HONEST LOCAL REPORT UNVERIFIABLE AT THE CENTRE.** This is not a leg failure and no amount of
leg-side rigour fixes it — the legs supplied positive AND negative control arms and were
still wrong about the thing that mattered. It is the homonym class (#212, the `beads` split)
firing on the word `origin`, inside a durability guard, one message after that guard was
made mandatory.

**The guard is not discharged by the legs. It is discharged by me, from canonical.** A leg
cannot even attempt it without adding a network remote, which its own brief forbids.

### Three further holes, each raised by a different leg, all real

1. **`for-each-ref` CANNOT SEE A DETACHED HEAD OR AN UNREACHABLE COMMIT** — and my
   prescribed sweep was exactly `for-each-ref`. `dev-onhold-toolbar` produced canonical's own
   receipts: `refs/preserve/rescue/xss-r5-review-detached-head-79c9b13` and
   `refs/preserve/rescue/stash-markdown-check-total-pin-e222bf5` — a detached HEAD and a
   stash that had to be RESCUED, i.e. **both categories my sweep is blind to have already
   bitten this project.** `ts-diff-r8` found 308 unreachable commits in its clones,
   `dev-onhold-toolbar` 314, none returned by any ref sweep. *"A leg replying 'for-each-ref
   returned N, all on origin' can be TRUE AND STILL LOSE WORK."* **The sweep I wrote was
   structurally incapable of finding the class I wrote it to find.**
   Add: `git symbolic-ref HEAD >/dev/null 2>&1 || echo "DETACHED HEAD AT $(git rev-parse HEAD)"`
   and `git fsck --unreachable --dangling`.
2. **PRESENCE IS NOT DURABILITY** (`dev-p2-assemble`). `cat-file -e` returns 0 for an
   object that is present but UNREFERENCED — and an unreferenced object dies at the next gc.
   *"That is exactly how the round-5 tips nearly went."* The check must be reachability
   (`--contains`), not existence.
3. **AN INCOMPLETE REFERENCE SET MANUFACTURES CONFIDENT FALSE MISSINGs** (`dev-p2-rebase`,
   self-caught). Fetching `+refs/heads/*` reported **46 MISSING including its own HEAD**;
   origin has 455 refs of which only 132 are heads, so every `refs/salvage/` namespace was
   invisible. Refetched `+refs/*` → 0 missing. **Same loop, two answers** — which is also the
   best control anyone produced today, and it was free.
4. **WORK ON NO REF AT ALL** (`ts-diff-r8`): its project log is untracked, so a ref-based
   durability check declares the leg clean while the deliverable is invisible to it.

### And the day's shape repeated once more, at the smallest scale

`dev-onhold-toolbar` sent me a suggested detached-HEAD check whose command substitution had
been **evaluated by its own shell before sending**, in `/workspace`, which is not a git
repository. The substitution collapsed to empty and the surrounding sentence still read as
though it had worked. Its own words: **A DIAGNOSTIC THAT FAILS SILENTLY AND EMITS AN EMPTY
FIELD IS INDISTINGUISHABLE FROM THE CLEAN RESULT IT IS SUPPOSED TO RULE OUT.** That is the
zsh word-splitting zero (EM-349) and the `check-ignore` exit-1 in a third costume. The leg
caught it unprompted and retracted in the next message.

### Standing consequence

No leg of mine is deleted on its own ON-ORIGIN report. **Every tip is re-tested from
canonical against the network remote, by me, with both control arms, before any deletion.**

## ADDENDUM 2026-07-29 15:40Z — AN ESCALATION ANSWERED OUTSIDE ITS OPTION SET

### D3 CLOSED, AND D4: THE OPTION SET WAS THE ARTEFACT OF THE CONFLICT, NOT OF THE PROBLEM
Reject UX escalated as a binary: A = show the blocked address as inert text (main), B =
show nothing (branch). OWNER PICKED NEITHER. Verbatim: "I would go with a third option
which is to Mark the item as deactivated in line and then provide the original link as
something that can still be copied and pasted."
THE MECHANISM, WHICH IS THE REASON THIS IS FILED AND NOT JUST RECORDED:
I derived the option set FROM THE TWO IMPLEMENTATIONS IN CONFLICT. That felt like
completeness — I had enumerated every position anyone held, with code behind each. It
was not completeness. It was the CARTESIAN PRODUCT OF WHAT TWO BRANCHES HAPPENED TO
IMPLEMENT, presented as the space of reasonable answers. The owner's answer was
available the whole time, cost little, and was strictly better than both: it keeps the
diagnostic value of A while removing the accidental-navigation risk that made me
recommend B.
A CONFLICT SUPPLIES TWO POINTS. IT DOES NOT SUPPLY THE LINE THROUGH THEM, AND IT NEVER
SUPPLIES THE REST OF THE PLANE. When an escalation's options are exactly the positions
of the parties in conflict, the option set has been inherited rather than constructed,
and its completeness has not been tested by anyone.
RULE: WHEN AN ESCALATION'S OPTIONS MAP ONE-TO-ONE ONTO THE CONFLICTING IMPLEMENTATIONS,
SAY SO IN THE ESCALATION. State that the options are what the code does, not what could
be done, and invite a fourth. The owner did this unprompted; the process should not
depend on him doing it.
COROLLARY, WORSE: I attached a DEFAULT ("proceeding on B if I do not hear back") to an
option set I had not tested for completeness. Had he been busy, an inherited and
incomplete set would have shipped on my timer, and the record would show a decision
taken rather than an option never considered. A DEFAULT IS SAFE ONLY OVER A SET WHOSE
COMPLETENESS SOMEONE HAS ACTUALLY CHECKED.

### D5. A ROW THAT IS NO LONGER A MERGE PICK MUST BE RE-CLASSIFIED OUT LOUD
Consequence of the above, and it changes the work rather than just the answer. Main
degrades to an inert span carrying the raw url in a title attribute, pinned by
.pr-link-unsafe. Branch drops the value. NEITHER IMPLEMENTS WHAT SHIPS. This row leaves
the conflict-resolution population entirely and becomes new code plus new tests, and
main's pinning test now describes behaviour nobody is shipping.
THE HAZARD IS SILENT: a resolver working a seven-row conflict list will reach this row,
see two implementations, and resolve it the way the other six were resolved — by
choosing. The instruction "take the cleaner base and WRITE the behaviour" has to be
explicit or the frame carries.

### D6. CLASSIFICATION AND RENDERING ARE DIFFERENT PREDICATES — DO NOT FOLD THE SECOND INTO THE UNION TABLE
The 82-row union table answers DOES THIS URL PASS. Reject UX answers GIVEN A FAILURE,
WHAT APPEARS. Folding the second into the table to save a file would produce rows whose
expected value means something different from every neighbouring row — the
commensurability defect (#132) manufactured deliberately for tidiness.
Assertions ordered separately: marker present; original value present AS TEXT; NO href
anywhere in the rendered subtree; and the red arm — a rejected url CONTAINING MARKUP
must appear as characters, not elements, and that test must be PROVEN to go red against
an unsafe render. Every url reaching this path failed validation, so it is
attacker-authored by definition. Rendering it is the owner's deliberate choice.
PARSING it is the bug. A rendering test never seen to go red on the exact string class
it exists to contain is the unlit instrument, on the security row, inside the security
fix.

## ADDENDUM 2026-07-29 15:45Z — THE GUARD I WROTE FOR #148 WAS AN INSTANCE OF #148

### S14. ORIGIN NAMES TWO DIFFERENT REMOTES, AND MY DELETION GUARD RESOLVED THE WRONG ONE
Owner instituted routine agent cleanup. I attached a guard: push every ref in the tree
to origin, confirm it landed, then delete. THE GUARD IS DEFECTIVE AND IS WITHDRAWN.
Permanent rule 4 has legs clone from the LOCAL PATH, not the network remote. So inside a
leg tree the remote named `origin` IS CANONICAL — another container's disk. Discharging
my guard pushes one container's disk into another container's disk and returns complete
success. Four legs ran correct commands with lit instruments and honest arithmetic;
every individual report was true; THE AGGREGATE WAS FALSE. Two tips were not on GitHub:
645877b (dev-onhold-toolbar's deliverable) and 8fa5762.
THE ROOT IS #148, WHICH WE FILED THIS MORNING: A LOCAL PROXY FOR THE NETWORK, CONSULTED
AS IF IT WERE THE NETWORK. Two further instances inside one hour:
  this guard (hides a gap — reports preserved when it is not);
  em-hardening's 17-commit alarm on 633f8f2, stood down by em-task-state as a false
  positive: `--remotes` reads the local tracking cache, 135 refs, against 481 live
  network refs of which 228 are salvage. (manufactures a gap that is not there).
SAME MECHANISM, OPPOSITE SIGNS. Filing the mechanism did not protect the next instance,
and the next instance was IN MY OWN REMEDY FOR IT. #121 in its purest observed form.
THE GENERAL RULE: A NAME THAT RESOLVES TO A LOCAL OBJECT WHERE IT IS EVALUATED AND TO A
NETWORK OBJECT WHERE IT WAS WRITTEN IS NOT A GUARD. Address the network remote BY URL.
Never write a durability check against the token `origin`.

### S15. THREE INDEPENDENT HOLES IN THE SAME GUARD, EACH FOUND BY A DIFFERENT LEG
1. `for-each-ref` CANNOT SEE A DETACHED HEAD OR AN UNREACHABLE COMMIT. Canonical holds
   rescue refs for BOTH categories. My prescribed sweep was STRUCTURALLY INCAPABLE OF
   FINDING THE CLASS I WROTE IT TO FIND — the enumerator excludes exactly the population
   the guard exists for. Cf. #300, enumerate refs not branches: same shape, one level
   further down, and knowing #300 did not stop me.
2. `bundle --all` DOES NOT PACK UNREACHABLE OBJECTS. Measured 308 of 308 absent. This
   punches a hole in the retirement procedure that consumed hours last night, and in
   #151's "contained in a bundle is not restorable from a bundle" — the object is not
   even contained.
3. `cat-file -e` PASSES ON AN UNREFERENCED OBJECT that dies at the next gc. PRESENCE IS
   NOT DURABILITY. Every presence check we ran overnight has this floor under it.
FOUR DEFECTS, ONE PARAGRAPH OF INSTRUCTION, WRITTEN BY THE PERSON WHO HAD SPENT THE
NIGHT CATALOGUING THIS EXACT FAILURE FAMILY. The instruction was three sentences long.
Brevity is not the same as being checkable, and I have been treating them as the same.

### S16. THE GUARD WAS NOT DISCHARGEABLE BY ITS ASSIGNEE, AND NOTHING IN IT SAID SO
A leg cannot run the corrected check without adding a network remote — which its own
brief forbids under permanent rule 4. So the guard was assigned to a party
STRUCTURALLY INCAPABLE OF PERFORMING IT, and the party's compliant attempt returned a
false pass rather than an error. THE MOST DANGEROUS FORM OF AN IMPOSSIBLE INSTRUCTION IS
THE ONE THAT CAN BE FOLLOWED PARTWAY AND STILL PRODUCE OUTPUT SHAPED LIKE SUCCESS.
CORRECTED, AND NOW STANDING: the guard is the EM's, run FROM CANONICAL, not delegable.
  a. resolve every ref in the leg tree INCLUDING detached HEAD and reflog-only tips;
  b. fetch into canonical;
  c. from canonical, test each against the network remote BY URL, both arms in the same
     invocation — known-present returns present, purpose-built local-only returns
     absent; if the second arm does not fire, THE RUN IS VOID;
  d. push what is missing, re-measure through the same instrument;
  e. then delete.
RETROSPECTIVE, OPEN: em-ci deleted four legs under the defective wording reporting
unpreserved=0. Re-measurement ordered from canonical against the network by URL.

### S17. THE SAFE-TO-DELETE-ME AT THE END OF A LEG'S REPORT IS A SELF-ASSESSMENT
Four legs ended their reports with a clearance for their own deletion. em-task-state
declined all four and re-tested from canonical, which is the only reason 645877b and
8fa5762 exist off one disk tonight. A LEG'S CLEARANCE OF ITSELF IS AN INPUT, NOT A
DISPOSITION — and it is the single cheapest thing in the report to accept, arriving
exactly when the reader wants to close the item. Holding deletion until the EM has
re-tested tips against the network personally is now the standard.

**C20 — SINGLE-COPY WORK IS A FLOW, NOT A STOCK, AND COMMIT COUNTS ARE THE WRONG UNIT.**
Re-measured 15:43Z at `main=eca9239` across 134 repos. Trajectory of the "orphan" figure:
**10 (~14:5x) -> 63 (15:06) -> 41 (15:43)**. The number never converges because em-ci's
sweep drains a pool that clones with local-path remotes keep refilling. Every genuinely
unique commit in the current set was created *after* the sweep ran (15:19-15:39Z).
**The class has no standing owner — only repeated one-shot sweeps by whoever notices.**
That is the defect; the integer is a symptom.

**41 SHAs != 41 units of work.** By patch-id, 33 are rebase duplicates whose content is
already in canonical under different SHAs (bulk rewrites betray themselves: 20 commits
sharing committer second 13:01:03, 8 sharing 13:54:10, and two literal subject-duplicate
pairs inside `farmtable-import-hardening`). Only **8** carry content not in canonical.
Verification that the earlier sweep succeeded: all six previously-named at-risk tips
(`e64138c e811abf 2016940 0589615 951502d 7b392b1`) are PRESENT, and every pre-sweep
commit resolves to a patch-id duplicate.

**C20a — DEDUPING A SALVAGE SWEEP BY COMMIT MESSAGE SILENTLY DROPS WORK.** Subject-matching
classified 35 of the 41 as already-present. Patch-id classified **33**. The two it got
wrong are the two that matter most: `a31c814` (`farmtable-test-r8`) is a **412-line XSS
render-sink test plus a 109-line project log**, and `6255508` (`dev-xss-r9`) touches
`Dockerfile`, `Dockerfile.server`, `agents.md`, `ft-inspector-desc.ts`. Both carry subjects
that already exist in canonical, so **any sweep deduping on message skips exactly them** —
and both are unowned, their agents having completed. The failure is silent and lands in the
comfort direction: the sweep reports full coverage precisely where it lost the most.
**A salvage sweep must dedupe on patch-id. Never on subject.** I nearly published the
subject-based answer.

**C20b — the two unowned commits need a live owner assigned** (`a31c814`, `6255508`).
The other six are held by running agents: dev-194-pricing (3), dev-import-hardening (1),
dev-gotest-registration (2). Repo->agent mapping there is **inferred from commit subjects,
not read from metadata** — stated as inference because no repo->agent mapping artifact was
found, and that absence is itself worth fixing.

**Method note, third instance of the same lesson:** my first enumeration used `mapfile`
under zsh, printed "repos found: 0 / TOTAL 0", and would have reported a clean bill of
health from a broken instrument. A control (`repos found must exceed 100`) caught it. The
zero-void rule now has three confirmed catches in this review; it should be standard for
any sweep that can report a reassuring zero.

## ADDENDUM 2026-07-29 15:50Z — C14 MEASURED LIVE, AND THE THIRD SIGN OF #148

### C14 IS NO LONGER A HYPOTHESIS. MEASURED GREEN AT THE SHIPPING TREE.
canary/substitution-at-shipping-tree = 5d9df1f at 2982ffd deletes
web/src/utils/task-ready.test.ts and adds web/src/utils/canary-substitution.test.ts IN
THE SAME COMMIT. Run 30467223768: GREEN. enumerated=6 executed=6 missing=0, floor 6
satisfied, the added file visibly executing as `ok 6`. Predicted GREEN on the record
before the push.
THE MECHANISM, STATED PROPERLY AT LAST: A FLOOR IS A SCALAR, A MANIFEST IS A SET, AND
THEY ARE NOT THE SAME STRENGTH. The web gate DERIVES its expected set FROM THE TREE, so
a deleted file leaves the expected set along with the tree and there is nothing left to
be missing. The Go gate catches the identical move because the deleted NAME sits in a
committed list. THE WEB GATE HAS A FLOOR WHERE IT NEEDS A MANIFEST.
This pairs with em-ci's opposite-designs finding into one complete statement: derive
from the tree and you catch additions and miss deletions; compare to a committed
manifest and you catch deletions and miss additions. Neither design is wrong. RUNNING
ONLY ONE OF THEM IS.
NOT A THEORETICAL RISK: the file deleted to produce the green,
web/src/utils/task-ready.test.ts, IS A MEMBER OF em-task-state's seven-path conflict
set. The canary is not a model of the merge in flight — it is that merge's shape, at
that merge's base, using that merge's file.
REMEDY, PRECISE AND NOT DONE: a committed expected NAME SET for web, not a larger floor.
A larger floor cannot help; substitution preserves cardinality by construction. FILED,
NOT FIXED — design change under scope freeze. Interim, ordered for the merge only: a
manual pre-registered name set, diffed against the merged tree, written into the commit
body. Verification of work in flight, not new scope, and it must not grow into the fix.

### S18. #148 HAS A THIRD SIGN, AND THE THIRD SIGN GETS FILED AS WEATHER
A local proxy for the network, consulted as if it were the network, now has three
observed directions:
  1. HIDES A REAL GAP — my deletion guard; `origin` in a leg tree is canonical, so a
     durability check passes on work that is on one disk.
  2. MANUFACTURES A GAP THAT IS NOT THERE — the 17-commit alarm on 633f8f2; `--remotes`
     reads a 135-ref local cache against 481 live network refs.
  3. ANSWERS AN OLD QUESTION IN A CONFIDENT PRESENT TENSE — farmtable-ci-workflow could
     not see 439b309 because its `origin` was a STALE LOCAL PATH pinned at cc92735.
THE THIRD IS THE WORST. The first two are wrong about the network. The third is RIGHT
ABOUT A NETWORK THAT EXISTED YESTERDAY — internally consistent, reproducible, and
correct with respect to a state nobody re-checked.
THE META-FINDING IS ABOUT US, NOT ABOUT GIT: em-ci had already observed instance 3 and
FILED IT AS AN ODDITY. The first two instances of a mechanism get it a name; the third
arrives after the naming is done and gets recorded as weather. A NAMED MECHANISM
SUPPRESSES RECOGNITION OF ITS OWN LATER INSTANCES, because the name feels like the
finding and the finding feels closed.

### S19. A RESULT CAN SURVIVE A DEFECT BY DESIGN OR BY POSITION, AND ONLY ONE REPEATS
em-ci's original unpreserved=0 was TRUE. It disclosed, unprompted, that the reason was
that it happened to be standing in canonical — where `origin` does resolve to
github.com — and that the same commands run one directory over would have been exactly
as false as the four legs'. Its own words: "I was right by location, not by discipline."
A CORRECT RESULT REACHED THROUGH A DEFECTIVE PROCEDURE IS A NEAR MISS, AND IT IS THE ONLY
CLASS OF NEAR MISS THAT LEAVES NO TRACE IN THE RECORD UNLESS THE PERSON WHO GOT LUCKY
SAYS SO. Nothing downstream distinguishes it from a sound result; the number is right,
the report is honest, the reviewer has nothing to catch.
RULE: WHEN A RESULT SURVIVES A DEFECT THAT SHOULD HAVE BROKEN IT, ESTABLISH WHETHER IT
SURVIVED BY DESIGN OR BY POSITION BEFORE BANKING IT.
Corroborating scale: the corrected enumerator found 543 entries / 184 unique objects
where the original swept refs/heads only — roughly triple the population my wording
could see. The zero survived a threefold enumeration error.
RESIDUAL, RECORDED AS GRADED AND NOT AVERAGED IN: review-ci-green had no clone at
deletion time and its tree is gone, so it cannot be re-measured through the corrected
instrument. It is an assertion about a past check made with the under-enumerating
instrument — WEAKER THAN THE OTHER THREE, permanently unclosable, and not a fourth clean
result.

### S20. THE FIRST SWEEP SAW 1% OF THE SECOND SWEEP'S EXPOSURE — MEASURED, NOT ESTIMATED
Re-swept the whole fleet 2026-07-29 ~15:5xZ with the CORRECTED enumerator (every
`for-each-ref` ref + detached HEAD + `reflog --all`), 133 live trees, canonical excluded.
17811 rows, 1088 unique objects, 222 unreachable from any ref on origin, reducing to 124
independent tips. All 124 fetched into canonical and pushed as `refs/salvage/<clone>/<x>`;
origin salvage refs 225 -> 352. Re-verified through the network after a prune-fetch:
UNPRESERVED = 0 of 222, positive arm 2982ffd PRESENT, negative arm (purpose-built
never-pushed commit) ABSENT, both in the same invocation.
THE COMPOSITION IS THE FINDING, NOT THE TOTAL:
    named refs/heads/*         2
    detached HEAD              4
    reflog-only               88
    refs/preserve/* (a leg's
      own salvage namespace) 128
A `refs/heads`-only sweep — the one this project ran and called done — would have caught
TWO of two hundred and twenty-two. The 128 `refs/preserve/*` are the sharpest of them:
an agent DID preserve its unreachable objects, correctly, INTO A NAMESPACE THE FLEET
SWEEP DOES NOT ENUMERATE. Diligent local preservation into a non-swept namespace is
indistinguishable from no preservation at all once the container dies.
Four detached HEADs = four agents whose current work is on no branch at all:
farmtable-195-r7-review, -r7-audit, -r7-test, farmtable-xss-r5-review.
RULE: A SWEEP'S PREDICATE IS ONLY AS WIDE AS ITS ENUMERATOR. Publish the enumerator with
the count, or the count means nothing.

### S21. A REPORTED SHA IS A HANDOFF AS OF THAT SHA, NOT A HANDOFF
dev-194-pricing self-reported that my salvage snapshot of its branch was STALE BY THREE
COMMITS (1c48795, 1253e12, tip 20b7525) because it kept working after reporting 0904a22.
Fetched and pushed to `refs/salvage/farmtable-194-pricing/dev/194-pricing-ruling`;
all four SHAs verified PRESENT through the network with a lit negative arm.
GENERAL FORM: every leg that reported a preserved SHA and then continued working is in
the same position, and the staleness is INVISIBLE FROM THE SWEEPER'S SIDE — the ref
still resolves, the check still passes, the answer is simply old. This is backlog 148
(a local proxy consulted as if it were the network) in the time dimension rather than
the space dimension: A CORRECT ANSWER TO A QUESTION ASKED AT THE WRONG MOMENT.
Credit for the disclosure is dev-194-pricing's; nothing on my side would have caught it.
The structural fix remains provisioning clones from a real remote, not re-sweeping.

### A11. THE SALVAGE SWEEP IS GIT-ONLY, AND THE RULINGS ARE NOT IN GIT
Filed by dev-194-pricing, NOT FOLLOWED (scope frozen). Every durability mechanism on this
track — fsck sweep, reflog sweep, bundle, salvage refs, em-ci's 133-tree re-sweep — is a
GIT OBJECT mechanism. The primary deliverables of this track are NOT git objects: the
rulings, research notes and durability records live under /scion-volumes/scratchpad/, and
NO SWEEP OR BUNDLE CARRIES ANY OF THEM. Scratchpad is also the same device as /workspace
(both /dev/root, st_dev 2049), so it has no independent copy either. The reason this is
easy to miss is that the git side is now measured to four decimal places, and a
well-measured mechanism next to an unmeasured one reads as coverage.

## ADDENDUM 2026-07-29 15:55Z — THE DURABILITY CLOSURE WAS MADE ON A 1% ENUMERATOR

### S20. THE 63 WERE PRESERVED. 63 WAS NEVER THE POPULATION.
I wrote, and put in the state file as settled: "All 63 single-copy commits preserved on
origin. DURABILITY CLOSED for committed work." THAT CLOSURE IS VOID.
em-ci re-swept 133 live trees with the corrected enumerator — every ref, plus detached
HEAD, plus `reflog --all`. 222 TIPS REACHABLE FROM NO REF ON ORIGIN, 124 independent.
All now pushed; origin salvage 225 -> 352; re-verified after prune-fetch, unpreserved
0/222, positive arm 2982ffd PRESENT, negative arm never-pushed commit ABSENT, same
invocation.
COMPOSITION, WHICH IS THE FINDING AND NOT THE TOTAL:
    refs/heads/*        2
    detached HEAD       4
    reflog-only        88
    refs/preserve/*   128
A refs/heads-only sweep catches 2 OF 222 — a ONE PERCENT instrument. It returned a clean
answer and the answer was true about the one percent. Nothing in its output announced a
denominator.
THE ERROR WAS NOT THE NUMBER, IT WAS THE VERB. "Closed" asserts something about a
population; my measurement was about a namespace. A CLOSURE IS A CLAIM ABOUT A
POPULATION, AND A POPULATION IS ESTABLISHED BY THE ENUMERATOR, NOT BY THE COUNT IT
RETURNS. Cf. #149 (a count without its enumerated and excluded sets is not accepted) —
which we filed, and which I then failed to apply to the single most consequential count
of the night, my own.
NOTE THE DIRECTION: every figure I published was accurate. 63 really were single-copy;
they really were preserved. AN ACCURATE FIGURE UNDER A WRONG DENOMINATOR IS NOT A SMALL
ERROR — IT IS THE ONE ERROR THAT SURVIVES REVIEW, because each individual claim checks
out.

### S21. A PRESERVATION IS WORTH WHAT THE LATER ENUMERATOR IS WORTH — THE 128
128 of the 222 sat in `refs/preserve/*`: ONE LEG'S OWN SALVAGE NAMESPACE. An agent
identified its unreachable objects, understood the risk, and preserved them correctly
and deliberately — INTO A NAMESPACE THE FLEET SWEEP DOES NOT ENUMERATE.
So: the agent did the right thing; could truthfully report that it had preserved its
work; and the outcome once its container dies is IDENTICAL TO HAVING DONE NOTHING.
DILIGENT LOCAL PRESERVATION INTO A NON-SWEPT NAMESPACE IS INDISTINGUISHABLE FROM NONE.
GENERAL FORM: THE PRESERVER AND THE SWEEPER MUST AGREE ON THE NAMESPACE, AND NOTHING IN
OUR PROCESS FORCES THEM TO. Diligence does not survive the container; only the agreed
namespace does. This is the strongest version yet of #128 (the bound travels with the
artefact or it does not travel) — here what failed to travel was not a caveat but the
ADDRESS, and the artefact was fine the whole time.
STANDING CONSEQUENCE: any instruction to preserve work must NAME THE NAMESPACE and the
issuer must CONFIRM THE FLEET SWEEP ENUMERATES IT. An unconfirmed preservation
instruction is decorative.
It also inverts S17 in a way worth holding onto: S17 said a leg's self-clearance is an
input, not a disposition, because it may be wrong. THE 128 ARE THE CASE WHERE THE LEG'S
CLAIM WAS TRUE AND STILL WORTHLESS. Verifying the claim would not have helped. Only
asking WHERE would have.

### S22. THE CORRECTED ENUMERATOR, MANDATORY, IN THIS EXACT FORM
EVERY REF + DETACHED HEAD + `reflog --all` + ANY PRIVATE PRESERVE NAMESPACE.
`for-each-ref` alone is a 1% instrument on this fleet. Third occasion today that my own
wording was the defect (the deletion guard, its assignee-incapability, and now the fleet
sweep's enumerator). Working assumption for every EM: THE REST OF MY STANDING WORDING IS
THINNER THAN IT READS — check it rather than comply with it.
LIVE, FOUR TREES WITH CURRENT WORK ON NO BRANCH: farmtable-195-r7-review,
farmtable-195-r7-audit, farmtable-195-r7-test, farmtable-xss-r5-review. Salvaged as of
now, but A DETACHED HEAD ADVANCES SILENTLY AND NO REF MOVES, so any salvage of them
goes stale the instant the agent does more work. Salvage of a detached head is a
SNAPSHOT, never a subscription.

### S23. THE LEG CONTRADICTED THE EM AND THAT IS WHY ANY OF THIS WAS FOUND
The entire chain started with dev-194-pricing telling em-ci that the salvage ref its EM
held for it was THREE COMMITS STALE. Fixed at 20b7525, both arms verified — and em-ci
then generalised from one stale ref to re-auditing the enumerator behind every ref.
A LEG CONTRADICTING ITS MANAGER IS THE HIGHEST-YIELD EVENT IN THIS PROJECT'S RECORD.
It is also the one with the steepest gradient against it: the leg is junior, the claim
is about the manager's own instrument, and the manager is the party who decides when the
leg is done. Protect the cheapness of that move deliberately; it will not survive being
merely permitted.
