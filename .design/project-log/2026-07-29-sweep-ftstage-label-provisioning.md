# Sweep: is `ft:stage/*` label provisioning present anywhere in the repo?

**Date:** 2026-07-29
**Agent:** sweep-ftstage (security auditor)
**Requested by:** farmtable-em-task-state-model-v2
**Tree read:** `633f8f269bcf9225b62d3c7c119f8166eda9ae64` (633f8f2, canonical, 39 ahead of origin/main)
**Full report:** `/scion-volumes/scratchpad/projects/farmtable/reports/sweep-ftstage.md`
**Build fence:** §OP-1 honoured — no build/vet/test/npm/make executed. Reads and greps only.
**Repo modifications:** none. Worked in a detached worktree at `/workspace/.sweep-ftstage-wt`;
`git status --porcelain` returned 0 lines at start and end. This log lives in the scratchpad rather
than in the repo's `.design/project-log/` deliberately, so the "not one line" guarantee holds.

## Question

Review round 11 of #194 found that `labelNamesToIDs` silently discards stage-label names the repo has
no label for — so a task created as `triage` in a repo without `ft:stage/*` labels lands with no
stage label and reads back as `accepted` (privilege escalation, finding 1B, HIGH). The fix — erroring
on unresolvable labels — is a breaking change for every deployment lacking those labels. **How large
is that population?** Measured from source so a human is not asked a question a grep can answer.

## Answer

**MEASURED ABSENT.** Nothing in the repository creates the `ft:stage/*` labels, and nothing tells an
operator to. The unprovisioned population is the **default**, not the corner case.

## Key measurements

- **Zero label-creation calls in non-test Go.** `grep -E '(Issues\.CreateLabel|CreateLabelInput|
  createLabel\(|"createLabel"|mutation.*[Cc]reateLabel)' | grep -v '_test\.go'` → `EXIT=1`.
  Positive control, same shape/corpus: `createcomment` → `EXIT=0`, hits `github.go:148`.
- **Three GitHub clients, not two.** githubv4 GraphQL (15 methods, no `createLabel`), go-github REST
  (4 calls, no `CreateLabel`), and a previously unenumerated raw `net/http` caller at
  `internal/serverapp/credmonitor.go:163` (`GET /user`, read-only). The "two clients" framing was one
  client short — the same error mode as round 11's "fifteen methods".
- **`AutoCreateLabels` is a dead flag.** Declared `config.go:43`, defaults `true` `config.go:82`,
  and has **0** non-test readers. Control: all five sibling fields of the same `LabelConfig` struct
  (`PushPrefix` 3, `Stages` 13, `Priorities` 1, `Types` 1, `Enabled` 1) have readers outside
  `config.go`. Only this one is zero.
- **The design doc promises auto-creation 3×** (`github-graphql-integration.md:428`, `:677`, `:793`)
  and **5 test functions pin the flag's default** — all asserting its *value*, none its *effect*.
- **The specified test was never written.** `:793` reads *"Label auto-creation: Push to a repo where
  `ft:stage/working` doesn't exist yet. Verify `createLabel` mutation is called first."* No such test
  exists. This is the mechanism by which an unimplemented default-true flag survived to production.
- **No provisioning surface exists.** No CI workflows at all (`.github/` holds only templates); 8
  Makefile targets, none provisioning; one shell script, doing sub-issue remapping only; no
  terraform/helm/k8s files in the repo; ent migrations are SQL-only; Dockerfiles clean; 50 CLI
  subcommands with no bootstrap/init/setup; `ft link`/`connect` never uses the word "label" (control:
  42 hits for repo/issue/token/owner in the same two files).
- **Blast radius: 10 labels.** The stage enum has 10 values (`ent/task/task.go:250`).

## Recommendation (for the eng-manager to decide)

Land the 1B fix **together with** an actual `AutoCreateLabels` implementation. With the flag
defaulting `true` as it has always claimed, a repo missing labels self-heals on first push, and the
hard error lands only on deployments that explicitly set `auto_create_labels: false` — who have
declared they manage labels themselves and for whom erroring is correct. The implementation already
exists in test code (`integration_test.go:292` uses `Issues.CreateLabel` on an existing dependency),
so this is not new integration work.

## Corrections logged

1. **`160e211` is not a live tree of this lineage.** It does not resolve in the canonical clone; it
   exists only in `/workspace/farmtable-scopedeny-93` as a scopedeny-93 test commit, and is not an
   ancestor of origin/main. Briefs citing it as one of "three live trees" are wrong.
2. **A query of mine returned a false zero mid-sweep.** I grepped `refreshLabelIndex` (0 hits); the
   real name is `ensureLabelIndex` (8 sites). Caught before it reached a finding. Also worth noting:
   `ensureLabelIndex` only ensures the *local in-memory index* is populated — it returns `nil`
   happily against a repo with zero matching labels. The name invites exactly the wrong conclusion.

## Unmeasured

- **Live repos' actual label state** — unmeasurable from source; needs an authenticated
  `gh api repos/{owner}/{repo}/labels` per deployment, outside the read-and-grep fence. Not
  attempted; flagged to the eng-manager as a scope decision.
- **origin/main `7a0f220` not swept independently.** 633f8f2 is 39 commits ahead, so provisioning
  deleted in those 39 commits would be invisible to me. Considered the most credible gap; re-running
  the two decisive greps against `7a0f220` is ~5 minutes and needs no build.

---

## Addendum (2026-07-29T03:5x) — follow-up (b), authorised: re-measured at origin/main `7a0f220`

Follow-up (a) (live repos' label state) was **declined by the eng-manager** and routed to the
coordinator as a product-owner question. Not attempted.

**Result: MEASURED ABSENT at `7a0f220` — and the gap closes harder than expected.**

- Both decisive greps reproduce byte-for-byte at origin/main: label-creation call → `EXIT=1`
  (control `createcomment` → `EXIT=0`); `AutoCreateLabels` → 3 non-test hits, 0 readers, with all
  five sibling `LabelConfig` fields non-zero.
- **The 39 commits changed no Go at all** — `55 .ts, 13 .md, 3 .json, 1 .mjs, 1 .css`. The Go tree at
  `7a0f220` and `633f8f2` is **byte-identical**: 208 files, matching path+blob set-SHA
  `9ab26795…ce55fa`. So §3–§9's findings transfer to main as an **identity**, not a re-measurement.
  Nothing was deleted in those 39 commits because nothing Go was touched.
- **Full-history pickaxe:** `git log --all -S'CreateLabel'` → 7 commits, all of which are design-doc
  prose (`37ffb59`, `6d2feb0`), test code (`2169406`), the dead config flag (`9a46ce7`, `e226340`),
  or prior audit logs (`547de0a`, `bae8abc`). **No commit in reachable history has ever added a
  label-creation call to non-test Go.**

The defensible sentence is now: **"No version of this software has ever created the `ft:stage/*`
labels."** The only remaining bound is the world's state, which is with the coordinator.

**Second near-miss, logged for the same reason as the first.** My initial 39-commit diff check
returned the clean `EXIT=1`, but its control reported 0 removed Go lines across 39 commits — not
credible on its face, so I refused the exit code and spent four commands (three pathspec forms plus a
non-empty-diff control) proving the zero was real rather than a broken pathspec. It was real. **An
exit code that agrees with your hypothesis is the one you are least entitled to accept**, and
reaching the right answer via an argument that does not survive inspection is precisely how "absent
at 633f8f2" would have become "absent in production."
