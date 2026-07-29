# sweep-ftstage — DOES ANYTHING PROVISION THE `ft:stage/*` LABELS?

**Agent:** sweep-ftstage (security auditor)
**Date:** 2026-07-29
**Brief:** `/scion-volumes/scratchpad/projects/farmtable/briefs/sweep-ftstage.md`
**Build fence:** §OP-1 honoured. **No build, vet, test, npm, or make target was executed.** This was
reads and greps only. I did not need to execute anything and did not ask for a token.

---

## 1. PRE-REGISTERED FALSIFICATION SENTENCE (written before I looked)

Committed to disk at `reports/.sweep-ftstage.prereg.md`, machine-timestamped
**2026-07-29T03:46:23Z**, before my first grep of the corpus. Reproduced verbatim:

> The prediction is FALSIFIED if I find ANY ONE of the following:
> - **(F1)** Any reachable code path that calls a GitHub label-creation API — GraphQL `createLabel`
>   mutation, REST `POST /repos/{owner}/{repo}/labels` (go-github `Issues.CreateLabel`), or a
>   shelled-out `gh label create` — whose label-name input can be an `ft:stage/*` value, whether by
>   literal, constant, template, or loop over a stage enum.
> - **(F2)** Any non-test provisioning artifact that creates those labels: migration, seed, fixture,
>   terraform, helm, k8s manifest, CI workflow, Makefile target, shell script, CLI subcommand under
>   bootstrap/provision/init/setup.
> - **(F3)** Any operator-facing instruction (README, install/setup/getting-started doc, runbook)
>   that tells a human to create the `ft:stage/*` labels by hand or by command.
> - **(F4)** Evidence that `AutoCreateLabels` IS implemented — i.e. the flag is READ by non-test code
>   and that read reaches a label-creation call.

**Decision rule, also pre-registered:** any of F1–F4 satisfied → PROVISIONING EXISTS and the
escalation of finding 1B dies. None satisfied, with same-shape same-corpus controls → MEASURED
ABSENT. Any surface I cannot reach → UNMEASURED, named, and addressed to the eng-manager by name.

**Outcome: none of F1–F4 was satisfied. I did not find the result I was hoping to find.**

---

## 2. THE TREE I READ

| | |
|---|---|
| **Tree read** | `633f8f269bcf9225b62d3c7c119f8166eda9ae64` (**633f8f2**, canonical, 39 ahead of origin/main, unpushed) |
| **Working location** | `/workspace/.sweep-ftstage-wt`, a **detached worktree** I created with `git -C /workspace/farmtable worktree add --detach` |
| **Shared checkout** | `/workspace/farmtable` — **read for metadata only, never checked out, never modified** |
| **Verification** | `git -C /workspace/.sweep-ftstage-wt status --porcelain` → **0 lines** at start and at end |
| **Production code changed** | **none. Zero lines.** |
| **`/workspace/farmtable-em-verify195`** | not touched |

**Every citation below is at 633f8f2 unless explicitly labelled otherwise.**

### 2a. [MEASURED] CORRECTION TO THE BRIEF — the third tree does not exist where the brief says

The brief §3.1 names three live trees: `7a0f220`, `633f8f2`, and **`160e211`**. **`160e211` does not
resolve in the canonical clone at all.**

```
$ git -C /workspace/farmtable rev-parse --verify '160e211^{commit}'
fatal: Needed a single revision
```

I then swept all 208 `farmtable*` clones under `/workspace`. `160e211` exists in **exactly one**:

```
$ git -C /workspace/farmtable-scopedeny-93 log -1 --format='%H%n%an%n%ad%n%s' 160e211
160e211581a686d988df5fbdf2e89af64e75fb2d
scopedeny-93
Wed Jul 29 03:16:00 2026 +0000
test(server): invert the tests that certified empty-scopes-as-wildcard

$ git -C /workspace/farmtable-scopedeny-93 merge-base --is-ancestor 160e211 7a0f220
→ NO-not-ancestor
$ git -C /workspace/farmtable-scopedeny-93 branch -a --contains 160e211
* scopedeny-93-deny-unrecognised-type
```

**`160e211` is a scopedeny-93 test commit on an unrelated branch in a separate clone, and is not an
ancestor of origin/main.** It is not a "live tree" of the #194 label lineage and has no bearing on
the `ft:stage` question. **The brief is wrong on this point.** I flag it because a future reader
told to disambiguate line numbers across "three trees" will waste time looking for a tree that is
not in the repository they were pointed at — and because the brief's own §3.1 is the rule about
citations being ambiguous across trees.

### 2b. [MEASURED] Corpus baseline (so every negative below has a denominator)

```
$ git ls-files | wc -l
477
```
208 `.go`, 152 `.md`, 85 `.ts`, 7 `.json`, 6 `.sh`, 2 `.yaml`, 1 Makefile.

---

## 3. THE ANSWER

> ## **MEASURED ABSENT.**
> **Nothing in this repository, at 633f8f2, creates the `ft:stage/*` GitHub labels, and nothing
> instructs an operator to create them.** There is **zero** label-creation call in non-test Go, in
> any of the three GitHub clients, in the only shell script, in the Makefile, in the Dockerfiles, or
> in any CLI subcommand. There are **no CI workflows at all**. No README or setup doc mentions the
> labels. The one place auto-creation is promised is a **design document**, and what it promises is
> that *the software* does it — which it does not.

**The prediction in brief §4 is CONFIRMED, and I want to be explicit that I was shown it in advance
and that this weakens the result** (brief §4's own caveat). Mitigations I applied: I pre-registered
falsification criteria before looking; I enumerated at the chokepoint rather than searching for the
token; and I ran a same-shape positive control against every negative. The confirmation rests on
`EXIT=1` from a query whose control form returns hits, not on my agreement with the coordinator.

---

## 4. EVIDENCE — COMMANDS AND OBSERVED VALUES

All commands run from `/workspace/.sweep-ftstage-wt` @ **633f8f2**. Observed values are reported;
verdicts are drawn only in §5.

### 4.1 [MEASURED] There are THREE GitHub clients, not two — the brief asked and the answer is yes

The brief §4 asked me to check whether a third client exists beyond the githubv4 GraphQL client and
the go-github REST client. **There is one.**

```
$ grep -rn --include='*.go' -E 'go-github|githubv4|shurcooL/graphql|machinebox/graphql|api\.github\.com' .
```
Observed, three distinct GitHub-reaching mechanisms:

| # | Client | Site @633f8f2 | Label-creation capability |
|---|---|---|---|
| 1 | `shurcooL/githubv4` GraphQL | `internal/platform/github/graphql.go:26` | none — see 4.2 |
| 2 | `google/go-github/v62` REST | `internal/platform/github/github.go:10` | none in non-test — see 4.3 |
| 3 | **raw `net/http` to `api.github.com`** | **`internal/serverapp/credmonitor.go:163`** | `GET /user` only |

Client 3 is a hand-rolled `http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)`
credential-monitor probe. It is a **read-only GET**, so it cannot create a label — but it is a real
third GitHub caller that neither round 11 nor the brief had enumerated. **The "two clients" framing
was one client too narrow, in the same way the "fifteen methods" framing was.**

### 4.2 [MEASURED] GraphQL client: 15 methods, no `createLabel` — round 11's count reproduces

```
$ grep -rn --include='*.go' -E '^func \(c \*graphqlClient\)' . | wc -l
15
```
The 15, all in `internal/platform/github/graphql_queries.go` @633f8f2:
`listIssues:86`, `getIssue:144`, `listIssueComments:163`, `listSubIssues:210`, `getRepositoryID:220`,
`createIssue:240`, `updateIssue:268`, `closeIssue:293`, `addComment:311`, `addSubIssue:331`,
`removeSubIssue:350`, **`addLabels:369`**, **`removeLabels:388`**, **`listRepoLabels:414`**,
`updateIssueAssignees:449`.

Three touch labels. All three **attach, detach, or list** labels. **None creates one.**

### 4.3 [MEASURED] REST client: 4 calls, none is `CreateLabel`

```
$ grep -rn --include='*.go' -E '\b(gh|client|c)\.(Issues|Repositories|Search|Git|Users)\.[A-Z][A-Za-z]*\(' .
internal/platform/github/github.go:79:   a.client.Issues.ListByRepo(...)
internal/platform/github/github.go:128:  a.client.Issues.Edit(...)
internal/platform/github/github.go:135:  a.client.Issues.Create(...)
internal/platform/github/github.go:148:  a.client.Issues.CreateComment(...)
```
Four, matching the brief's count. **No `Issues.CreateLabel`.**

### 4.4 [MEASURED] ★ THE DECISIVE NEGATIVE, WITH ITS CONTROL

```
$ grep -rn --include='*.go' -E '(Issues\.CreateLabel|CreateLabelInput|createLabel\(|"createLabel"|mutation.*[Cc]reateLabel)' . | grep -v '_test\.go'
EXIT=1        ← zero matches. No label-creation call anywhere in non-test Go.
```
Per brief §3.5 this check is **not** wrapped in `|| true`; exit 1 is the clean result and is reported
as the observed value.

**POSITIVE CONTROL — same query shape, same corpus, same exclusion, a sibling creation call that
does exist:**
```
$ grep -rn --include='*.go' -iE 'createcomment' . | grep -v '_test\.go'
internal/platform/github/github.go:148: comment, _, err := a.client.Issues.CreateComment(...)
EXIT=0        ← instrument fires on real data. The negative above is a real absence, not a dead query.
```

**Where `CreateLabel` *does* appear — test files only:**
`internal/platform/github/integration_test.go:292` and `:916`, both
`restClient.Issues.CreateLabel(...)`, inside `TestIntegration_LabelCreateAndCleanup` and a
permissions smoke-check. **The repository's only knowledge of how to create a label lives in tests
that create a throwaway label and delete it again.** Notably `:922` records
`"Token lacks label write permission"` as a **SKIP**, not a failure — so even the test surface treats
label-write as optional.

### 4.5 [MEASURED] ★ `AutoCreateLabels` IS DECLARED, DEFAULTS TRUE, AND IS NEVER READ

Verified independently of the brief, as instructed.

```
$ grep -rn --include='*.go' 'AutoCreateLabels' . | grep -v '_test\.go'
internal/platform/github/config.go:41:  // AutoCreateLabels controls whether missing labels are created on GitHub
internal/platform/github/config.go:43:  AutoCreateLabels bool `yaml:"auto_create_labels"`
internal/platform/github/config.go:82:          AutoCreateLabels: true,
--- non-test hit count: 3
```
All three are the **doc comment, the field declaration, and the default assignment.** There is no
fourth. **The flag is written once and read never.** Confirmed: declared ✓, defaults `true` ✓
(`config.go:82`, in `DefaultConfig()`), never implemented ✓.

**POSITIVE CONTROL — same shape (a field of the *same* `LabelConfig` struct), same corpus, same
exclusions, counting reads outside its own declaration file:**
```
$ for f in PushPrefix Stages Priorities Types Enabled AutoCreateLabels; do
    grep -rn --include='*.go' "\b$f\b" . | grep -v '_test\.go' | grep -v '/config\.go:' | wc -l
  done
  PushPrefix         non-test hits OUTSIDE config.go = 3
  Stages             non-test hits OUTSIDE config.go = 13
  Priorities         non-test hits OUTSIDE config.go = 1
  Types              non-test hits OUTSIDE config.go = 1
  Enabled            non-test hits OUTSIDE config.go = 1
  AutoCreateLabels   non-test hits OUTSIDE config.go = 0     ←
```
**Every sibling field of the same struct is read by non-test code. `AutoCreateLabels` alone is zero.**
The instrument demonstrably finds config-field reads; it found none for this field. Sample control
hits, verbatim: `labels.go:86`, `labels.go:223`, `labels.go:406` (`cfg.PushPrefix` / `m.config.PushPrefix`).

### 4.6 [MEASURED] The design doc promises auto-creation three times — count verified

```
$ grep -n -B1 -A2 'auto_create_labels\|createLabel' .design/github-graphql-integration.md
```
Five mentions in `.design/github-graphql-integration.md` @633f8f2. Two are inert (`:345` a YAML
sample, `:367` a struct field). **Three are substantive specifications of the behaviour** — the
brief's "three times" is **correct**:

- **`:428`** — *"On first sync (or when `auto_create_labels: true` and a needed label doesn't exist),
  the adapter creates `ft:stage/*` and `priority:*` labels on the GitHub repo via `createLabel`
  mutation. Labels are created with consistent colors:"* — followed by a colour table.
- **`:677`** — *"Auto-creation of `ft:stage/*` / `priority:*` labels on first push
  (if `auto_create_labels: true`)"* — in the shipped-feature list.
- **`:793`** — *"**Label auto-creation:** Push to a repo where `ft:stage/working` doesn't exist yet.
  Verify `createLabel` mutation is called first."* — **in the test plan.**

**`:793` is the finding I did not expect and it is the mechanism of the whole failure.** The design
document specified a test whose sole purpose was to catch this exact gap. **That test was never
written.** Cross-check: the string `createLabel` appears in no test file; the only label-creation in
tests is the unrelated throwaway-label integration check of §4.4. So the feature was specified,
flagged as true by default, pinned by five config tests that assert *the flag's value* — and the one
test that would have asserted *the flag's effect* was dropped. **Five tests guard the default of a
switch wired to nothing.**

### 4.7 [MEASURED] Exactly five test functions pin the flag — count verified

```
$ awk '/^func Test/{fn=$2} /AutoCreateLabels|auto_create_labels/{print fn" @line "NR}' <files>
config_test.go:       TestLoadConfig_ValidYAML (19,47,48)
                      TestLoadConfig_MissingFile (130,131)
                      TestDefaultConfig (169,170)
integration_test.go:  TestIntegration_ConfigDefaultLoad (554,555)
                      TestIntegration_ConfigCustomFile (569,594,595)
```
**Five distinct test functions.** The brief's count is **correct**. All five assert the flag's
*value*; none asserts its *effect*.

### 4.8 [MEASURED] Provisioning surfaces — the full inventory, and what is in each

The brief called its surface list a floor. **I extended it** with: Dockerfiles, ent DB migrations,
the cobra CLI subcommand surface, `exec.Command` shell-outs, and the `ft link`/`connect` repo-attach
path. All are reported.

| Surface | Command | Observed | Label creation? |
|---|---|---|---|
| **CI workflows** | `find .github -type f` | only `ISSUE_TEMPLATE/bug_report.md`, `PULL_REQUEST_TEMPLATE.md` — **no `workflows/` dir exists** | **none — there is no CI** |
| **Makefile** | `grep -nE '^[a-zA-Z0-9_.-]+:' Makefile` | 8 targets: `generate build test lint web web-dev dashboard decomposer` | none |
| **Shell scripts** | `find scripts -type f` | exactly **one**: `remap-github-sub-issues.sh` | none — its 3 `gh api` calls are `.node_id` lookup + two `addSubIssue`/`removeSubIssue` mutations (`:19,:26,:55,:59`) |
| **terraform / helm / k8s** | `find` over `*.tf`, `Chart.yaml`, `values.yaml`, `*helm*`, `*k8s*`, `*kube*` | **no such files exist in the repo** | n/a |
| **Migrations** | `grep -rniE 'label' internal/store/ent/migrate/` | 2 hits, both DB columns (`schema.go:211` `native_label`, `:223` `labels`) | none — ent migrations are SQL schema, never GitHub |
| **Dockerfiles** | `grep -niE 'label\|gh api\|curl.*github' Dockerfile Dockerfile.server` | `EXIT=1`, zero hits (control: `wc -l` → 21 + 21 lines, files real and readable) | none |
| **CLI subcommands** | `grep -rn -E 'Use:\s*"' internal/cli cmd \| wc -l` | **50** subcommands; none named bootstrap/provision/init/setup/seed | none |
| **`bootstrap`/`provision` funcs** | `grep -rniE 'func .*(Bootstrap\|Provision\|InitRepo\|SetupRepo\|SeedLabels\|EnsureLabels)'` | all hits are **`UserProvisioner`** (OAuth user creation, `internal/serverapp/provisioning.go`) | none — unrelated to GitHub labels |
| **`ft link` / `connect`** | `grep -niE 'label' internal/cli/link.go internal/cli/connect.go` | `EXIT=1`, **zero mentions of "label"** | none |
| **`exec.Command` shell-outs** | `grep -rn 'exec\.Command'` | `gcloud auth`, `git credential fill` ×2, `open`/`xdg-open`/`rundll32` | none — **no `gh` binary is ever shelled out to from Go** |

**POSITIVE CONTROL for the `ft link`/`connect` negative** (same files, same shape — a GitHub noun
that *is* present):
```
$ grep -ncE 'repo|issue|token|owner' internal/cli/link.go internal/cli/connect.go
internal/cli/connect.go:24
internal/cli/link.go:18
```
42 hits for other GitHub nouns in the same two files that return 0 for "label". **The repo-attach
path talks about repos, issues, tokens and owners at length and never once mentions a label.** This
is the strongest single piece of evidence: `ft link` is exactly where provisioning would live if it
existed anywhere, and the word does not occur.

### 4.9 [MEASURED] `ft:stage` vocabulary spread — and why I did not rely on it

Per brief §3.7 I did **not** treat the literal as the search. Reported for completeness only:
```
$ grep -rn 'ft:stage' . --exclude-dir=.git | wc -l
43
$ grep -rln 'ft:stage' . --exclude-dir=.git | sort
.design/github-graphql-integration.md
.design/project-log/2026-05-10-github-config-labels.md
internal/platform/github/integration_test.go
internal/platform/github/labels.go
internal/platform/github/labels_test.go
internal/platform/github/passthrough_test.go
```
**Exactly one non-test production file** (`labels.go`) and **two design docs**. No README, no
`docs/`, no script, no CI, no manifest.

**The enum loop the brief warned about exists — and it is a name *generator*, not a creator.**
`internal/platform/github/labels.go:97` and `:107` @633f8f2:
```go
m.stageToLabel[s] = prefix + "stage/" + s.String()
```
This is the templated construction (`prefix` + `"stage/"` + enum) that would have hidden a literal
search. I followed it to its consumers: `StageToLabel:215`, `MapLabelsToStage:149`,
`StageLabelSwap:246`, `stripForMatch:402`. **Every consumer matches, maps, or swaps existing labels.
None creates one.** This is precisely the "loop over a stage enum" case, and it resolves negative.

### 4.10 [MEASURED] The 1B mechanism reproduces exactly as the brief states

`internal/platform/github/passthrough.go:111-119` @633f8f2 — verbatim:
```go
func (s *GitHubPassThroughStore) labelNamesToIDs(names []string) []githubv4.ID {
	var ids []githubv4.ID
	for _, name := range names {
		if id, ok := s.labelNameToID(name); ok {
			ids = append(ids, id)
		}
	}
	return ids
}
```
**Confirmed: no error, no log, no return value, no counter.** An unresolvable name is dropped by an
`if ok` with no `else`. The brief is accurate here.

**A naming hazard the brief does not mention, which I recommend the eng-manager note:** the loader is
called **`ensureLabelIndex`** (`passthrough.go:91`), called from 7 sites (`:258,:344,:361,:378,:395,
:404,:544`). The name reads as "ensure the labels exist." **It does not.** It ensures the *local
in-memory index* is populated from `listRepoLabels`, and returns `nil` happily when the repo has zero
matching labels. A reader auditing for provisioning could plausibly stop at that name and conclude
the guarantee exists. I nearly did.

**Blast radius of the proposed fix** — the stage enum has **10** values
(`internal/store/ent/task/task.go:250`): `StageTriage, StageAccepted, StageWorking, StageInReview,
StageInQa, StageDeploying, StageCompleted, StageWontFix, StageDuplicate, StageCancelled`. So a
correct deployment requires **10 `ft:stage/*` labels** to pre-exist, created by a mechanism that does
not exist in this repository.

---

## 5. WHAT THIS MEANS FOR THE #194 DECISION

[DERIVED — this is inference from the measurements above, not itself measured]

1. **The unprovisioned population is the default, not the corner case.** The labels can only exist if
   an operator created all 10 by hand, off-book, with no doc telling them to and no tooling to do it.
   The software promises three times to do it itself. **The only deployments that work correctly are
   ones where someone solved a problem they were never told they had.**
2. **The fix is therefore breaking for essentially the whole population**, which is the outcome the
   brief feared. It should not ship as a bare error.
3. **[MEASURED] The repository already contains the missing implementation, in test code.**
   `integration_test.go:292` is a working `Issues.CreateLabel` call on the REST client that is already
   a dependency. Implementing `AutoCreateLabels` is not new integration work.

**Recommendation (the manager decides; I am not escalating past this report):** land the 1B fix and
the `AutoCreateLabels` implementation **together**. With the flag defaulting to `true` — as it has
falsely claimed to for its whole life — a repo missing its labels gets them created on first push and
the "breaking change" affects only deployments that explicitly set `auto_create_labels: false`, who
have declared they want to manage labels themselves and for whom a hard error is the correct
behaviour. **This converts the breaking change into the behaviour the documentation already
promised.** Failing that, a `ft` subcommand to provision the 10 labels would give operators the
migration path that currently does not exist.

---

## 6. TAGGED CLAIM LEDGER

| # | Claim | Tag |
|---|---|---|
| 1 | No label-creation call in non-test Go (`EXIT=1`, controlled) | **[MEASURED]** |
| 2 | GraphQL client has 15 methods, none creates a label | **[MEASURED]** |
| 3 | REST client has 4 calls, none is `CreateLabel` | **[MEASURED]** |
| 4 | A **third** GitHub caller exists (`credmonitor.go:163`), read-only `GET /user` | **[MEASURED]** |
| 5 | `AutoCreateLabels` declared, defaults `true`, **0** non-test reads (controlled vs 5 sibling fields) | **[MEASURED]** |
| 6 | Design doc specifies auto-creation exactly 3 times (`:428`, `:677`, `:793`) | **[MEASURED]** |
| 7 | Exactly 5 test functions pin the flag; none tests its effect | **[MEASURED]** |
| 8 | The specified auto-creation test (`:793`) was never written | **[MEASURED]** |
| 9 | No CI workflows exist at all | **[MEASURED]** |
| 10 | No terraform/helm/k8s files exist in the repo | **[MEASURED]** |
| 11 | `ft link`/`connect` never mentions "label" (controlled: 42 other GH-noun hits) | **[MEASURED]** |
| 12 | No markdown instructs an operator to create the labels | **[MEASURED]** |
| 13 | `labelNamesToIDs` silently discards unresolvable names | **[MEASURED]** |
| 14 | 10 stage values → 10 required labels | **[MEASURED]** |
| 15 | `160e211` is not in the canonical clone and is not an ancestor of origin/main | **[MEASURED]** |
| 16 | Unprovisioned population is the default → fix is broadly breaking | **[DERIVED]** |
| 17 | Ship 1B fix together with `AutoCreateLabels` implementation | **[DERIVED — recommendation]** |
| 18 | Behaviour of **already-deployed live instances** | **[UNMEASURED] — see §7** |

---

## 7. UNMEASURED — ADDRESSED BY NAME TO `farmtable-em-task-state-model-v2`

Per brief §3.6, declined measurements get an owner rather than a silent `[UNCHECKED]`.

**@farmtable-em-task-state-model-v2 — there is exactly one surface I could not reach, and one
inference you should not let me make:**

1. **The actual label state of live GitHub repositories is UNMEASURED and unmeasurable from source.**
   I proved the *repository* provisions nothing. I did **not** prove that no deployed repo *has* the
   labels — an operator could have created them by hand, or inherited them from a template repo, or
   copied them from the colour table at `github-graphql-integration.md:428`. **My finding bounds the
   software's behaviour, not the world's state.** Answering the world-state question requires one
   authenticated `gh api repos/{owner}/{repo}/labels` call per deployment, which is (a) a network
   call and (b) outside my read-and-grep fence. **I did not make it and I did not ask to. Tell me if
   you want it and I will treat that as a scope change, not a decision I get to take.**

2. **Phase 1 (merged/deployed/live) was excluded per brief §6 and I honoured that.** If any label
   provisioning shipped in Phase 1 code paths that are no longer in the 633f8f2 tree, I would not
   have seen it. I judge this unlikely — `git ls-files` covers the whole tree and Phase 1 is an
   ancestor — but I am flagging it rather than assuming.

3. **I read 633f8f2 only.** I did not sweep `7a0f220` (origin/main) independently. Since 633f8f2 is
   39 commits *ahead* of origin/main, a provisioning feature could in principle have been **deleted**
   in those 39 commits and still exist on main. **I consider this the most credible gap in my
   sweep.** Say the word and I will re-run §4.4 and §4.5 against `7a0f220` in a second worktree; it
   is about five minutes of greps and no build.

---

## 8. CORRECTIONS TO THE BRIEF

Per brief §5.7 — "I would rather be corrected than agreed with."

1. **[MEASURED] §3.1 is wrong about `160e211`.** It is not a live tree of this lineage; it is a
   scopedeny-93 test commit living only in `/workspace/farmtable-scopedeny-93`, not an ancestor of
   origin/main, absent from the canonical clone. Details in §2a.
2. **[MEASURED] §4's "two clients" is one client short — the brief's own warning applied to itself.**
   The brief correctly told me to check for a third client, and there is one:
   `internal/serverapp/credmonitor.go:163`. It is read-only and does not change the conclusion, but
   the "GraphQL + go-github" enumeration was incomplete for the second time tonight.
3. **[MEASURED] Everything else in the brief that I could check, checked out.** The 15-method count,
   the 4 REST calls, the `github.go:23` REST client location, the three doc specifications, the five
   pinning tests, and the `labelNamesToIDs` silent-discard mechanism are all **accurate as stated.**
4. **Process note, offered not as a correction but as a caution:** in §4.8/K2 I ran a query for a
   function I called `refreshLabelIndex` and got **0 hits**. The real name is **`ensureLabelIndex`**,
   with **8** sites. Had I reported that zero, it would have been a false negative of exactly the
   shape brief §3.2 warns about — an empty result and a broken query being the same bytes. I caught
   it only because a zero for a function I had just read on screen was implausible. **The control
   discipline in this brief is not ceremony; it caught a real error in my own instrument tonight.**

---

## 9. ONE-LINE RESULT

**MEASURED ABSENT — nothing in farmtable @633f8f2 creates the `ft:stage/*` labels or tells an
operator to; `AutoCreateLabels` defaults `true` and has zero non-test readers (controlled against 5
sibling fields that all have readers); the escalation stands, and the design doc's own §793
auto-creation test was specified and never written.**

---

# 10. ADDENDUM — FOLLOW-UP (b): RE-MEASURED AT origin/main `7a0f220`

**Authorised by:** farmtable-em-task-state-model-v2, 2026-07-29T03:55:16Z
**Scope:** the two decisive greps re-run at origin/main, same positive controls.
**Follow-up (a) (live repos' label state) was DECLINED by the eng-manager and routed to the
coordinator. I did not attempt it and did not treat it as a scope change.**
**Build fence:** still honoured. No build, no vet, no test, no token. Greps and `git` reads only.

**Why this addendum exists, in the eng-manager's words:** *"absent at 633f8f2" is exactly the kind of
true-of-a-bounded-corpus sentence that gets restated as "absent in production."* §3–§9 above bounded
the canonical tree. This section bounds origin/main, and then bounds the entire history.

**Method:** second detached worktree `/workspace/.sweep-ftstage-wt-main` @ `7a0f220dbd9332cb...`,
verified equal to `git rev-parse origin/main`. Clean (`status --porcelain` → 0). Corpus: **431**
tracked files (vs 477 at 633f8f2).

## 10.1 [MEASURED] Decisive grep #1 at 7a0f220 — reproduces exactly

```
$ grep -rn --include='*.go' -E '(Issues\.CreateLabel|CreateLabelInput|createLabel\(|"createLabel"|mutation.*[Cc]reateLabel)' . | grep -v '_test\.go'
EXIT=1        ← zero matches

CONTROL, same shape/corpus:
$ grep -rn --include='*.go' -iE 'createcomment' . | grep -v '_test\.go'
internal/platform/github/github.go:148: comment, _, err := a.client.Issues.CreateComment(...)
EXIT=0        ← instrument fires
```

## 10.2 [MEASURED] Decisive grep #2 at 7a0f220 — reproduces exactly

```
$ grep -rn --include='*.go' 'AutoCreateLabels' . | grep -v '_test\.go'
internal/platform/github/config.go:41   (doc comment)
internal/platform/github/config.go:43   (field declaration)
internal/platform/github/config.go:82   (default = true)
--- non-test hit count: 3

CONTROL — sibling LabelConfig fields, reads outside config.go, at 7a0f220:
  PushPrefix 3 | Stages 13 | Priorities 1 | Types 1 | Enabled 1 | AutoCreateLabels 0
```
Byte-for-byte the same numbers as §4.5. **Zero readers at origin/main too.**

## 10.3 [MEASURED] ★ THE GAP IS CLOSED BY CONSTRUCTION, NOT BY COINCIDENCE

The hypothesis was: *provisioning could have been **deleted** in the 39 commits, so it would be
absent at 633f8f2 while still present on main.* I tested it directly and the answer is stronger than
two independent negatives.

**A near-miss first, reported because it is the point.** My first attempt asked whether the 39
commits removed any label-creation line:
```
$ git diff 7a0f220..633f8f2 -- '*.go' | grep -E '^-' | grep -iE 'createlabel|...'
EXIT=1
```
Exit 1 — the "clean" answer. **But my control on that same query returned `0` total removed Go lines
across 39 commits, which is implausible on its face, so I refused to report the exit 1 and went
looking for the broken query instead.** It turned out not to be broken — but I could only know that
by checking:
```
$ git diff --name-only 7a0f220..633f8f2 -- '*.go'            → 0 files
$ git diff --name-only 7a0f220..633f8f2 -- ':(glob)**/*.go'  → 0 files
$ git diff --name-only 7a0f220..633f8f2 | grep -c '\.go$'    → 0 files
$ git diff --stat 7a0f220..633f8f2                           → 73 files, 14063 ins, 378 del
```
Three independent pathspec forms agree, against a demonstrably non-empty diff. **The zero is real.**

**What the 39 commits actually changed:** `55 .ts, 13 .md, 3 .json, 1 .mjs, 1 .css`. **No `.go` at all.**

**Definitive check — the whole Go tree, path+blob, both sides:**
```
$ git ls-tree -r <SHA> | grep '\.go$' | awk '{print $3, $4}' | sort | sha256sum
  7a0f220 → 9ab267951b0958c3dbe3218365019a357686d037ccad6f4c226635e577ce55fa
  633f8f2 → 9ab267951b0958c3dbe3218365019a357686d037ccad6f4c226635e577ce55fa
  ==> IDENTICAL
```
208 `.go` files on each side, every path and every blob hash matching.

> **The Go corpus at 633f8f2 IS the Go corpus at 7a0f220 — the same 208 blobs.** The 39 commits are
> web-UI and documentation only. Therefore **every Go-level finding in §3–§9 transfers to origin/main
> as an identity, not as a repeated measurement.** Nothing was deleted in those 39 commits because
> nothing Go was touched in those 39 commits.

## 10.4 [MEASURED] ★ AND IT WAS NEVER THERE — FULL-HISTORY PICKAXE

Two endpoints can both be negative if the code lived only in between. So I asked whether the string
has **ever** existed anywhere in reachable history:
```
$ git log --all --oneline -S'CreateLabel'
547de0a Log the #194 round-9 security audit: authorization axis, REQUEST CHANGES on MUST 5(a)
bae8abc docs(project-log): independent security audit of #194 round 8
6d2feb0 chore: capture mounted task-state-core baseline
2169406 Add integration tests for GitHub GraphQL integration
37ffb59 Add GitHub GraphQL integration technical design document
e226340 Add comprehensive tests for config parser and label mapper
9a46ce7 Add GitHub config parser with YAML loading and defaults
--- 7 commits total
```
I inspected every added line in all seven. **Every single introduction of the string falls into
exactly three buckets:**

| Bucket | Commits | What was added |
|---|---|---|
| **Design-doc prose** | `37ffb59`, re-captured by `6d2feb0` | *"…the adapter creates `ft:stage/*` and `priority:*` labels on the GitHub repo via `createLabel` mutation…"* — **a promise, not code** |
| **Test code** | `2169406` | `restClient.Issues.CreateLabel(ctx, testOwner, testRepo, &gh.Label{` — in `integration_test.go` |
| **The dead config field** | `9a46ce7`, `e226340` | `AutoCreateLabels` declaration + default + its five pinning assertions |
| *(audit logs)* | `547de0a`, `bae8abc` | prior agents' reports **about** this same gap |

**No commit in the entire reachable history of this repository has ever added a label-creation call
to non-test Go.** The "deleted in the 39 commits" hypothesis is not merely false — the code it
postulates has never existed at any point on any branch.

## 10.5 ANSWER AT `7a0f220`

> ## **MEASURED ABSENT at origin/main `7a0f220`** — and, by §10.3, absent there for the *same 208
> Go blobs* measured in §3–§9; and, by §10.4, **never present at any commit in reachable history.**

[MEASURED] The finding no longer depends on a bounded corpus. The correct sentence is now:
*"No version of this software has ever created the `ft:stage/*` labels."*

**[STILL UNMEASURED — and this bound is now the only one left, per the eng-manager's framing which I
am carrying rather than resolving]:** the **actual label state of live GitHub repositories.** I have
bounded the software's behaviour across its entire history. **I have not bounded the world's state.**
An operator may have hand-created the 10 labels off-book — perhaps from the colour table at
`github-graphql-integration.md:428`, which is the only place in the repo that says what they should
look like. Establishing that requires an authenticated `gh api repos/{owner}/{repo}/labels` per
deployment. **That is outside my fence and outside the eng-manager's; it is with the coordinator as a
product-owner decision. I did not attempt it.**

## 10.6 Addendum claim ledger

| # | Claim | Tag |
|---|---|---|
| 19 | Decisive grep #1 reproduces at 7a0f220 (`EXIT=1`, control `EXIT=0`) | **[MEASURED]** |
| 20 | Decisive grep #2 reproduces at 7a0f220 (0 readers; 5 sibling controls all non-zero) | **[MEASURED]** |
| 21 | The 39 commits changed **no** `.go` file (3 pathspec forms + non-empty-diff control) | **[MEASURED]** |
| 22 | Go trees at 7a0f220 and 633f8f2 are byte-identical (208 blobs, matching set-SHA) | **[MEASURED]** |
| 23 | `CreateLabel` appears in 7 commits ever; all are doc prose, test code, or the dead flag | **[MEASURED]** |
| 24 | No commit in reachable history ever added a label-creation call to non-test Go | **[MEASURED]** |
| 25 | Live repos' actual label state | **[UNMEASURED — routed to coordinator, not mine]** |

## 10.7 Process note

Twice in this sweep a query returned a plausible-looking zero that I could not immediately justify —
`refreshLabelIndex` in §8.4, and the 39-commit diff here. **Both times the thing that caught it was a
control whose expected value I had predicted before running it.** The second one turned out to be a
*true* zero, and I still spent four commands proving it, because an exit code that agrees with your
hypothesis is the one you are least entitled to accept. Had I reported §10.3's `EXIT=1` on first
sight, I would have reached the right answer by an argument that does not survive inspection — and
the right answer by a broken argument is what "absent at 633f8f2" becoming "absent in production"
looks like from the inside.
