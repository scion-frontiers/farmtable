# ci-22-setup — Stand up CI. Directly commissioned by the product owner, 2026-07-29 03:12Z.

## 0. READ THIS FIRST — CONSTRAINTS, DATED 2026-07-29 03:2xZ BY THE COORDINATOR

1. **THERE IS A LIVE CREDENTIAL IN THIS TASK. HANDLE IT FIRST AND HANDLE IT ONCE.**
   A GitHub Personal Access Token with **workflow** permission is at:
       /scion-volumes/scratchpad/projects/farmtable/.secrets/ci-pat.txt
   - **NEVER echo, cat, print, log, or paste it.** Read it into a shell variable or an
     environment variable and use it from there.
   - **NEVER commit it.** Not to a workflow file, not to a Makefile, not to a report.
   - **NEVER run bare `git remote -v` and paste the output.** The canonical repo's remote
     URL **already contains a different PAT in cleartext** — a known, separately tracked
     exposure. If you must show a remote, pipe it through
     `sed -E 's#//[^@]*@#//REDACTED@#g'` — as this brief's author did to write this line.
   - In your report, refer to it as "the CI PAT". No prefix, no suffix, no length, no
     first four characters. **A partial credential in a report is still a credential in a
     report.**
   - It will be revoked once CI is green. Do not build anything that depends on it living
     past that. The workflow you write must authenticate as GitHub Actions' own
     `GITHUB_TOKEN`, **not** as this PAT. The PAT is for pushing the setup, nothing else.

2. **NO LOCAL BUILDS WITHOUT THE TOKEN, AND YOU DO NOT HAVE IT.**
   This host locked up on 2026-07-28 at ~18:15Z because several agents ran Go builds
   concurrently. Exactly one build token exists fleet-wide and another leg holds it.
   **NO `go build`, NO `go test`, NO `npm ci`, NO `npm run build`, NO `make`.**
   **THIS IS NOT THE OBSTACLE IT LOOKS LIKE, AND THE REASON IS THE WHOLE POINT OF THIS
   TASK: GITHUB ACTIONS RUNS ON GITHUB'S RUNNERS, NOT ON THIS BOX.** Your verification
   path is to push a branch and read the run's result on GitHub. That costs this host
   nothing. You are not working around the fence; you are building the thing that ends it.
   If you believe a deliverable needs a local build, **STOP AND MESSAGE THE COORDINATOR.**

3. **DO NOT TOUCH `/workspace/farmtable`** (canonical) or `/workspace/farmtable-em-verify195`
   (standing coordinator ruling — do not read, move, or GC it). Make your own clone.
4. **NO `git gc`, NO `git prune`,** anywhere. Measured blast radius in canonical: 57
   commits / 256 objects.
5. **THIS IS zsh, NOT bash.** An unquoted glob matching nothing is a fatal expansion error
   that kills the whole command line — quote every one: `--include='*.go'`.
   `${PIPESTATUS[0]}` is **empty**; the array is `$pipestatus` and it is **1-indexed**, and
   it is **clobbered by any command that runs between the pipeline and the read — which
   substitutes that command's zero rather than leaving the value absent.** So the rule is a
   sentence, not a form: **CAPTURE IMMEDIATELY AFTER THE PIPELINE, NOTHING IN BETWEEN THAT
   RUNS, PRINT FREELY AFTERWARDS.** Pure assignment does not clobber.
6. **NEVER `2>/dev/null` on an exploratory command.** A leg tonight silenced a diagnostic,
   read its own silence as data, and filed it. An unread diagnostic is recoverable; a
   silenced one is destroyed at capture.
7. **PUSH AUTHORITY IS GRANTED TO YOU, NARROWLY, AND THIS IS AN EXCEPTION.** Standing fleet
   policy is that only the coordinator pushes. For this task you may push **one branch**
   containing **only** the Makefile, the workflow file, and any config they require, and
   open a PR. **DO NOT PUSH TO `main`. DO NOT MERGE. DO NOT PUSH ANY OTHER BRANCH, AND DO
   NOT PUSH ANYONE ELSE'S COMMITS** — several legs have unmerged security work in flight
   and it is not yours to move.

## 1. WHAT THE PRODUCT OWNER ASKED FOR, VERBATIM

> "we should be running selective local tests for changed code. For setting up the CI on
> github ... 1) a Makefile with build and test targets 2) a GH workflow to run CI"

Three things, and the third is easy to lose: **build targets, test targets, and a way to
run tests selectively against changed code locally.** That third one is a first-class
deliverable, not a nicety — see D3.

## 2. THE FINDING YOU ARE INHERITING — VERIFY IT, DO NOT ADOPT IT

Measured by the coordinator at 03:2xZ on canonical `633f8f2`. **Re-measure it yourself; line
content drifts and a relayed measurement is not a measurement.**

**A Makefile already exists** (380 bytes, repo root). So "create a Makefile with build and
test targets" is partly done already — and **the existing one is the problem, not the gap.**
Two defects, each one line:

- **`build: generate` then `go build ./...` — `build` DOES NOT DEPEND ON `web`.**
  `assets.go:5` is `//go:embed all:web/dist`, `web/dist` is gitignored (`.gitignore:17`)
  and `git ls-files web/dist` returns **zero** tracked files. So `go build` embeds a
  directory that nothing in the `build` path ever produces. **On a fresh clone, `go build`,
  `go vet` and `go test` all fail.** That is the open defect #100, and it is not a missing
  file — **it is a missing dependency edge in this Makefile.** `make web` exists and builds
  the assets. `build` simply never calls it.

- **`test:` runs `go test ./...` and NOTHING ELSE.** `web/package.json` defines
  `test` → `test:node` + `test:components` (a node script and a vitest run). **No Makefile
  target reaches them.** So the entire JavaScript suite is unreachable from `make test`.

**WHY THAT SECOND ONE MATTERS MORE THAN IT LOOKS.** There is a separate open defect (#103)
in which two branches carry mutually exclusive `npm test` lists, so an ordinary merge
resolution deletes a whole suite and still exits 0. The reason nobody would catch it is that
**no runner in this project ever executes those suites.** Compose the two and you get the
finding: **a test suite can be deleted, the deletion reports success, and there is no second
observer anywhere in this project that would notice.**

**AND THE SHARPEST INSTANCE, WHICH IS WHY THIS TASK IS URGENT RATHER THAN TIDY:** tonight a
leg found a privilege-escalation bug in scope handling that had survived four separate
audits. The reason it survived is that a **green, passing test asserted the vulnerable
behaviour was intended.** A test like that is only load-bearing if something runs it on every
change. **THE ONE THING THAT WOULD HAVE MADE THAT TEST LOAD-BEARING IS THE THING YOU ARE
BUILDING, AND ITS ABSENCE IS WHY THE BUG LIVED.**

There is **no CI of any kind** in this repository: no `.github/workflows`, no
`.gitlab-ci.yml`, no `.circleci`, no `Jenkinsfile`. `.github/` holds two markdown templates.

## 3. DELIVERABLES — EACH STATED IN FULL

*(No deliverable here is referred to by number alone. If you find yourself inferring what one
means, STOP AND MESSAGE THE COORDINATOR. Inferring a deliverable is how a leg ships the wrong
thing with confidence.)*

**D1. RE-MEASURE AND STATE THE STARTING CONDITION.** The Makefile's current targets verbatim;
whether `build` reaches `web`; whether any target reaches the web tests; whether `web/dist`
is tracked. Report the **SHA you measured at** — a branch name is not an identifier. If you
find my §2 is wrong in any respect, **say so plainly and go with your measurement**; I would
rather be corrected than agreed with.

**D2. A CORRECTED Makefile.** At minimum:
- `build` must produce the embedded assets before compiling Go, so that a **fresh clone with
  no prior state can build.** That is the acceptance condition — not "it builds here."
- `test` must run **both** the Go suites and the web suites, and must **fail if either
  fails.** Beware: a recipe line that pipes or chains carelessly will report the last
  command's status and swallow the first failure. This is the single most likely way for
  this deliverable to ship broken while looking correct.
- Keep `generate`/`lint`/`web-dev`/`dashboard`/`decomposer` working. Do not gratuitously
  restructure; the smallest correct diff is the best one here.

**D3. A SELECTIVE-TEST PATH FOR CHANGED CODE — THE OWNER ASKED FOR THIS EXPLICITLY.**
A documented way to run only the tests affected by the current change, so a developer is not
forced to choose between a full multi-minute suite and running nothing. `go test ./internal/foo/`
and a vitest path filter are both fine primitives; the deliverable is that **the invocation is
named, documented, and works from a dirty tree.** State clearly in your report what it does
**not** cover — a selective run is by construction incomplete, and **the risk is that its
green is read as the full suite's green.**

**D4. A GITHUB ACTIONS WORKFLOW** at `.github/workflows/`, triggering on pull requests and on
push to the default branch, that installs the Go and Node toolchains, builds, and runs the
tests. Pin the toolchain versions — `go.mod` says **go 1.26.5**; there is **no `.nvmrc`**, so
choose a Node version, **pin it explicitly, and say in your report that you chose it and on
what basis.** Use the lockfile (`web/package-lock.json` exists). Authenticate as the
workflow's own `GITHUB_TOKEN`. **Do not reference the CI PAT anywhere in the workflow.**

**D4b. ADDED 03:2xZ, AFTER YOU STARTED. CI MUST NOT REACH THE TESTS THROUGH `make test`.**
*(Amendment, not a clarification. If you have already wired the workflow to `make test`, change
it. The original D4 said "runs the tests" and that was not sufficient — this is the author
correcting himself, not you misreading.)*

I told you in §2 that `make test` reaches no JavaScript suite. Here is the consequence I
missed, raised by the engineering manager at 03:22Z, and it inverts the risk of this whole
task:

> **"CI IS THE EXIT FROM THE BUILD FENCE" IS TRUE ABOUT CAPACITY AND FALSE ABOUT TRUST, AND
> CAPACITY IS THE LESS IMPORTANT HALF. IF YOU WIRE GITHUB ACTIONS TO `make test`, WE WILL HAVE
> BOUGHT A FRESH CLONE AND POINTED IT AT THE SAME BLIND TARGET — AND A GREEN BADGE ON A FRESH
> RUNNER IS THE MOST CREDIBLE GREEN THIS PROJECT HAS EVER PRODUCED.**

Read that twice. **THE FAILURE MODE OF THIS TASK IS NOT THAT CI DOESN'T WORK. IT IS THAT CI
WORKS PERFECTLY AND CERTIFIES A BLIND SPOT, WITH MORE AUTHORITY THAN ANYTHING THIS PROJECT HAS
EVER HAD.** You would be manufacturing the strongest false receipt in the repository.

So, as requirements:
- **The workflow must invoke the JavaScript suites by a path that does not depend on `make test`
  having been fixed correctly.** Call them directly. Fix `make test` as well, per D2 — but the
  gate must not be load-bearing on your own Makefile edit being right.
- **CHECK WHICH SUITES ACTUALLY EXECUTED IN THE FIRST RUN. NOT THE EXIT CODE — THE MEMBERSHIP.**
  A separate leg established today that on this tree the JS wiring **loses whole suites and
  still exits 0.** So `exit 0` and "the suites ran" are **different facts here**, and only one
  of them is the one you were asked to establish. Paste the list of suite names the run
  actually executed into your report. **A COUNT IS A FLOOR AND FLOORS GET ABSORBED; NAMES
  RESIST.**
- Two suite names to look for specifically, because another fix in flight is pinned by them:
  **`safe-url` and `url-binding-scan`.** If they are not in the executed list, say so loudly —
  that is a merge-blocking fact for someone else, not a detail of yours.

**D5. PROVE THE GATE CAN FAIL — THIS IS THE DELIVERABLE, NOT THE WORKFLOW.**
Push your branch, open the PR, and let the run execute **on GitHub's runners**. Then make
something fail on purpose — a deliberately broken test on a scratch commit — and **show the
run going red, with the run URL and the failing job's status.** Then remove it and show green.
**A GATE THAT HAS ONLY EVER BEEN OBSERVED PASSING HAS BEEN OBSERVED AGREEING, NOT GATING.**
If you cannot make it go red, **you have not got a gate, and reporting exactly that is a
complete and acceptable answer to this deliverable.** Do not report a green run as proof.

**D6. EXPECT THE FIRST RUN TO FAIL, AND TREAT THAT AS DATA.** Per §2 this repo does not
build from a fresh clone. **A GitHub runner is the only truly fresh clone this project has
ever been compiled from** — everything green ever reported here was contingent on local
state. Whatever the runner surfaces is a real defect in the repository, not noise in your
setup. Report each one. **You are not required to fix defects beyond the Makefile's
dependency ordering** — if the runner exposes something deeper, write it down, tell the
coordinator, and do not silently patch around it. Disabling, skipping, or `continue-on-error`
-ing a failing check to get a green badge is the one outcome that would make this task
actively harmful: **it would manufacture exactly the false assurance this task exists to
remove.** If a check must be excluded to land anything at all, it must be **named, loudly,
in the workflow and in your report.**

**D7. STATE WHAT YOU DID NOT DO,** one line each, so the next reader does not read your
silence as coverage.

**D8. REPORT** at `/scion-volumes/scratchpad/projects/farmtable/reports/ci-22-setup.md`,
plus a project-log entry under `.design/project-log/`. Mark every claim **MEASURED**,
**DERIVED**, or **UNCHECKED**, in the sentence itself. Most of tonight's errors fleet-wide
were a derivation wearing a measurement's clothes.

## 4. KEY LOCATIONS
- Canonical, **READ-ONLY, do not work in it**: `/workspace/farmtable` (HEAD `633f8f2`)
- Your clone: make your own under `/workspace/`, a path no other leg is using
- Repo: `github.com/scion-frontiers/farmtable`
- Makefile: repo root. Web: `web/package.json`. Embed: `assets.go:5`. Ignore: `.gitignore:17`
- Shared scratchpad: `/scion-volumes/scratchpad/projects/farmtable/`

## 5. DIRECT CONTACT
Coordinator, agent name **`coordinator`**, via `scion message`. Send **logistics, blockers and
credential questions straight to the coordinator** — do not wait, and do not route through
another leg. **Do not contact the product owner directly. Do not contact other legs**; several
are mid-round on live security work and a cross-message will cost them their context.
If you think any instruction in this brief is wrong, **say so** rather than quietly doing
something else. A disagreement voiced is useful; a substitution made silently is the exact
failure mode this project has been fighting all night.

## 6. TERMINATION
You MUST produce the corrected Makefile, the selective-test path, the workflow, the PR, the
red-then-green evidence (or an explicit statement that you could not make it go red), and the
report at the path in D8 — and then mark the task complete.
