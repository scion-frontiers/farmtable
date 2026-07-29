# PROJECT LOG — `test-xss-r8`

**Leg:** `test-xss-r8` (test/QA axis, one of three independent legs)
**Commit under review:** `901670e3f09ad57386cafb8359017d8d61a75070`
**Range:** `e4e3d13..901670e`
**Tree:** `/workspace/farmtable-test-r8` (never left it)
**Report:** `reports/test-xss-r8.md`
**Verdict:** REQUEST CHANGES — on one ground (F1), not on the test artefact.
**Findings:** ~~HIGH 2, MEDIUM 5, LOW 2, POSITIVE 1~~ → **HIGH 2, MEDIUM 7, LOW 2, POSITIVE 1**
(F12 added §18.2, F13 added §19.3, both post-cold-pass and both MEASURED).
**F1's mutation half (M8) is no longer DERIVED** — executed 12:47Z in an authorised throwaway clone;
the two arms' logs are byte-identical.

---

## 1. What I did, in order

1. Read `_r8-COMMON.md` in full before running anything.
2. Verified tree identity and cleanliness; verified the brief's §5 environment claims using
   `$options[...]` rather than the `setopt | grep -c` form the brief correctly calls broken.
3. Read the role brief.
4. **Cold pass**, static inspection only. Wrote §1–§14 of the report to disk.
5. *Then* opened the 10:35Z §7 correction, then `_r8-PHASE-TWO.md`, then reconciled into §15.

The ordering held. Nothing in §1–§14 was informed by phase two, and the findings table carries
strike-through where reconciliation moved a severity, so the movement is auditable.

## 2. The decision that produced the report's main finding

**I measured the size of the change before I reviewed the tests for it.** The dispatch and the role
brief both aimed me at `remotedata_consumers_test.go` — 171 new lines, "the round's main test
artefact". The diffstat says 476 insertions across 7 files.

I ran a filter for **non-comment, non-blank** added lines per file, with a positive control on a
file I knew contained real code. Result: `convert.go` 0, `export_import.go` 0, `capabilities.ts` 0,
`doc.go` 0, `ft-app.ts` **3**.

The entire behavioural content of round 8 is three lines. Everything else is prose and tests.

That reframed the whole review. The question stopped being "is the new test good" — it is — and
became "what pins the three lines?" Nothing does. Had I audited the file I was pointed at and
stopped, I would have returned a broadly clean report.

**The transferable bit:** *measure the size of the change before you review the tests for it.* A
large diffstat next to a security fix creates an impression of coverage that a two-command
measurement dissolves. I have written this up as an error in the EM's targeting, at his request,
though it cost me nothing because I happened to do the measurement first.

## 3. Reasoning behind the verdict

REQUEST CHANGES rests on **F1 alone**: the round's only behavioural change
(`FtApp.isCollectionWritable`, commit `af9ea8c`) is pinned by no executed artefact.

I considered APPROVE WITH CONDITIONS. I did not choose it because the condition would have been the
whole of the round's remaining work, and because the round's own stated lesson — a capability sink
that sat unnoticed through five review rounds — is exactly what deferring this reproduces.

**What I deliberately did NOT block on:**

- The new test itself. It is the best-constructed artefact I saw: paired positive and near-miss
  arms, a fixture-liveness `Fatalf` placed before the negative assertions, and a deliberate refusal
  to iterate `skipDirs` (which would have made the mutation self-cancelling). I said so explicitly
  and separately from the criticisms, because a report that only lists defects trains authors to
  read it as noise.
- F4, F5, F6, F9, F10, F11. All real, none merge-blocking, all recorded.
- F3, which I got substantially wrong (below).

## 4. The mistake I made, recorded because it is the useful part

**F3 was a HIGH finding built on a misreading of evidence I had already collected.**

I measured that `.github/workflows/ci.yml` is absent at HEAD, that `cc92735` is reachable from 0 of
208 refs after a fetch, and that it is an ancestor of neither HEAD nor `origin/main`. All true. I
concluded that `doc.go`'s claim *"this package IS now gated, on every push"* was false and that the
round's test artefact was "executed by NO automated path whatsoever."

Phase two: real main **is** `cc92735`, CI **does** exist, my clone's refs are stale relative to it.

The part worth keeping is that **I had the disconfirming evidence in my own report already.** I had
measured that `cc92735` contains the workflow and that `doc.go` describes it accurately in every
particular — and I wrote that down *as a point in the commit's favour*. A commit that exists,
carries the file, and is described correctly is far better explained by stale refs than by a false
claim. I took the reading that produced a HIGH finding.

**That is fails-toward-alarm, and I was not watching for it** — I had spent the entire pass guarding
against fails-toward-clean, which the brief emphasises heavily. The brief names a third direction
(fails-toward-authority); this is a fourth, and it is the one a review leg is structurally most
prone to, because finding something is what the role rewards.

Downgraded HIGH → LOW, framing withdrawn, wire facts retained, and I withdrew the overstatement in
§14 that the test file "may never have been compiled by anything, ever."

## 5. Response to the two mid-round corrections

**10:35Z, §7 rewritten (marker rule, reporting-command exclusion, negative-control class).**
The first two cost me nothing: I planted no marker and ran no transcript self-audit, so I have no
result in the INSTRUMENT BROKEN state and no `n=8`-style figure anywhere.

The third bit. Four of my published zeros (I-4, I-7, I-13, I-17) had no positive arm; I had already
self-declared two of them as gaps. I planted a literal fixture and re-ran the identical patterns:
all fired. **I recorded these as receipts, not as pre-armed controls**, and said in the report that
they should be weighted below the three I armed before use. Retro-arming and then presenting the
result as though it were pre-armed is precisely the move §7 is trying to stop, and confessing it in
a sentence does not make it a pre-armed control.

**10:41Z, two new clones.** Classified as announced. I hold no `/workspace` census, so I offered
**UNCHECKED** rather than a confirmation — a leg with no baseline cannot corroborate a delta, and
saying "consistent with what you announced" when you never counted is how false agreement enters a
record. I did independently verify the *mechanism* behind the EM's reason for not building in review
trees (a build materialises `web/dist`, which flips `check-ignore`'s answer on the bare path), and I
had measured that trap before being told about it.

## 6. Near-miss worth recording

I ran `git check-ignore -v web/dist`, got **rc=1**, and nearly published "web/dist is not gitignored"
against both `ci.yml` and the EM's bulletin. It would have been a confident, wrong disagreement.

The rescue was mechanical, not clever: the rule says publish the scope with the zero, so I went to
enumerate what the pattern actually matches — and found `.gitignore:17` is `dist/`, a
directory-only pattern, while `check-ignore` decides directory-ness from **disk**, and my fresh
clone has never built `web/dist`. Bare path → rc=1. Inside path → rc=0.

Phase two documents this trap explicitly. I hit it before reading that, which is the only reason I
can say I caught it rather than was warned off it. It then turned into a real finding (F9) when I
asked the same question of the *new test's own fixture directories* and found that one of the three,
`src/util/dist/`, is gitignored while the other two are not.

**The lesson I would keep:** rc=1 from `check-ignore` is indistinguishable from "correct command,
genuinely not ignored", and the scripted form is the dangerous one because it looks rigorous. Ask
about a path *inside* the directory, and carry near-miss arms (`notdist`, `distant`) in the same
invocation.

## 7. What I could not do, and why

- **No suite was executed** *during the review proper*. I did not request the build token. Every
  mutation in the report's matrix was DERIVED by static reading, and I labelled **every
  predicted-GREEN row UNRESOLVED, not SURVIVED**, per the role brief's rule that a survived row must
  carry execution evidence. I did not upgrade one. A pre-registered token request with committed
  predictions went into the report's §14.
  **RESOLVED IN PART, 12:4xZ.** The bulletin announcing the r9 tree also said *"the build and test
  rationing is lifted."* I ran the four pre-registered runs that need no production edit. All four
  matched prediction, M1 to the exact error count and arm split. Rows M1/M6/M7 are now MEASURED;
  §5.1 and §13.2 hold the results and the apparatus. **Six rows remain DERIVED.**
- **I refused one experiment on my own initiative.** Measuring mutation M8 — deleting the F1 guard
  and observing that nothing goes red — requires editing `web/src/components/ft-app.ts`, a
  production file. §3.2 forbids it. I would rather report M8 UNRESOLVED than modify production code
  to prove a point about it, so I asked for explicit permission instead of taking the latitude the
  role brief grants for test files. The latitude is for adding test files, not for mutating
  production ones, and reading it the other way would have been convenient.
  **RESOLVED 12:45Z.** The EM ruled in words: authorised, but in a throwaway `git clone` in `/tmp`,
  never in my tree, §3.2 explicitly NOT amended. Executed under a fixed interleaved 3-per-arm
  schedule. **M8 SURVIVED — the two arms' logs are byte-identical, 380 assertions unmoved.** F1's
  mutation half is now MEASURED. Report §17 (pre-registration) and §18 (result).
  **Refusing and asking cost me two hours and bought the strongest result in the report.** Had I
  taken the latitude at 10:30 I would have edited a production file in the tree under review, which
  is the one thing that would have made the measurement worthless to a third party.
- **No flake observation.** I ran nothing, so I have no rate. The 4.5% figure is UNCHECKED by me. I
  did establish that the flaky test lives in `internal/server/watch_test.go`, outside the package my
  matrix targets.
- **UNCHECKED and load-bearing:** the Beads-import reachability argument that makes F1 *live* rather
  than theoretical. It is the audit leg's axis. I flagged that the EM should get that answer before
  ruling on OP-1 rather than assume a leg covered it, and stated what it would do to my severity if
  refuted (HIGH → MEDIUM).
- **Missed entirely:** `scopes.go` gofmt-dirt; the `graph_support.go` second Go reader (I read it
  only as an allowlist citation and never verified the function exists); conditions 5 and 6b, on
  which I offered no opinion rather than guessing.

## 7b. The rationing lift, and the thing I did not let it authorise

The 12:33Z bulletin said *"No action required from you."* True of the r9 tree, which is another leg's.
But the same message lifted build rationing, and that removed the one blocker standing between my
report's largest weakness — ten mutation rows, none executed — and closing it. My predictions were
already on disk. **A pre-registration is worth nothing until someone runs the experiment**, and the
window to run it had just opened, so I ran it rather than leaving the rows DERIVED because the
covering message said no action was required.

**What I would not let the lift authorise.** It lifted a *throughput* limit. §3.2's prohibition on
editing production code is a *scope* limit, and the two are unrelated. M8 — deleting the
`Platform.GITHUB` guard to show that nothing goes red — is the only row that speaks to F1 and the
verdict, which makes it the row I most wanted and therefore the one where the convenient misreading
was most available. It stays UNRESOLVED. I asked again, in words, rather than construing.

Worth noting the asymmetry: the three rows I *could* run all made the commit look **better** (M1
killed, the new test vindicated), and the row I could not run is the one that would have made it look
worse. I have said so in §5.1 explicitly, because a partial upgrade that happens to be flattering is
exactly the shape a reader should be warned about.

**One thing I got for free and did not predict.** Under M1, `TestWebRemoteDataConsumersAreDeclared`
passed — the guard stays green while its own security control is reverted. I had derived that
statically by enumerating the real tree's 15 directories; seeing it execute is a different quality of
evidence, and it is the strongest single argument for the new test existing at all.

**Discipline held under the lift:** every edit was to a `_test.go` file, reverted by single named
path, `git status --porcelain` checked empty after each, HEAD confirmed unmoved. `-count=1` on every
run, because a cached `ok` is indistinguishable from a run that never happened — the dead-instrument
failure the 10:37Z correction is about, in its most ordinary form.

## 7c. Bulletin 19.1, and the finding that arrived by obeying a rule I found tedious

Three things landed on me and one of them paid for itself immediately.

**The differential-schedule correction was aimed at me and it landed.** My §5.1 matrix ran baseline
×1, M1 ×2, M6 ×1, M7 ×1 — unequal, un-interleaved, one arm re-run. The outcome did not turn on it
(both M1 runs were RED, so I halted on *disagreement*, which is away from the hazard). **The worse
item is one I found only because the EM published the rule:** my own pre-registration said *"if a RED
appears that is not the 6 predicted errors, I will re-run."* That is a stopping rule conditioned on
matching my own forecast — agreement-chasing pointed sideways, written in advance, wearing
pre-registration's clothing. It never fired. It was defective anyway. **Pre-registering a biased
stopping rule does not debias it; it just gets the bias on the record early enough to catch.**

**I called an impossibility that was not one.** In §16.6 I reported that §3.5 (no filesystem copies)
and the throwaway-copy remedy left me *"no legal place to run"* M8. The EM's answer was `git clone`
from a local path — not a filesystem copy, not covered by §3.5, and a route I simply failed to
enumerate. Stopping to ask was right; **declaring the space empty was an over-strong claim in the
alarmed direction, which is F3's direction again.** Report an impossibility only after enumerating
harder than I did.

**The payoff came from the negative-control rule.** M8 returned GREEN — the answer I predicted and
wanted. The §7 obligation says prove the instrument can say yes before publishing a zero, and I found
it tedious given six clean runs. Doing it anyway produced **F12**: I planted a type error in a *test*
file (RED, exit 2), a false assertion (RED, exit 1), and the same class of type error inside
`isCollectionWritable` — **GREEN, exit 0**. `tsconfig.test.json` includes `src/**/*.test.ts` only, so
`npm test` never compiles the application source at all.

**That is a finding I was not looking for, on a question I had not asked, reached only by trying to
falsify a result I already believed.** It also makes F1 literal rather than rhetorical: the file
holding the round's only security change is not executed, not asserted against, and not type-checked
by the command CLAUDE.md tells agents to run. **The rule I resented is the rule that found it.**

**On the selection-bias flag.** The EM made it standing policy. Worth recording that when I wrote it
I was disclaiming a *flattering* partial upgrade; the adverse row I was flagging as missing has now
been run, and it came out adverse. The disclaimer was right for the right reason, not luck — but I
should note the flag is only worth something because someone eventually ran the expensive row.

## 7d. The 13:29Z constraint set, and a finding that only exists in one tree

The bulletin's thesis is that whole-project figures are tree-dependent and nobody has been labelling
them. My report's central artefact is a guard that walks `web/`, so this was a question *about my own
primary object* that I had not asked. I held two tree states and had never compared them.

**Doing so produced F13.** `doc.go` documents the `.tmp-test` prune as precautionary and latent. Its
literal claim checks out — no `*.test.ts` mentions the field. Its conclusion does not: `tsc` emits the
transitive import closure to `outDir`, so `.tmp-test` already carries 7 real mentions from compiled
application source. Delete the `skipDirs` entry and the guard fails immediately. **The entry is
load-bearing today and documented as precautionary**, which is worse than undocumented, because the
natural reading invites removal.

**Two things worth keeping.**

First, it is *the same error class the round just fixed*, one level up: `skipDirs[d.Name()]` reasoned
about a path property narrower than the mechanism; the comment reasons about test *files* when the
mechanism runs over the import *closure*. A team can fix the instance and leave the reasoning style
intact in the prose beside it. That is a more useful thing to hand the EM than the bug itself.

Second, **I could only see it because I happened to hold a post-`npm test` tree.** In a pristine tree
it does not exist. I did not construct that tree to find this — it was left over from M8. The finding
is a by-product of apparatus built for something else, which is an argument for the do-not-tidy rule
that I had previously read as pure caution.

**On the retroactive re-labelling.** I re-labelled and did not re-run, as instructed. Applying it
surfaced that the one figure I cite but did not measure — the EM's own EM-100 build result — has no
tree named at source, and that its tree is load-bearing: `web/dist` is exactly what the failing embed
pattern reads, so "the whole-tree build cannot be discharged by anyone" may hold only for pristine
trees. **The rule caught an unqualified figure on its first application, and it was the EM's.**

I also flagged that the bulletin counts three tree states where the evidence shows at least four. The
extra one — the 70-byte stub `web/dist/index.html` — is the hazardous one, because it satisfies the
embed pattern without exercising the pipeline. A tree that looks built and is not will produce a
confident wrong green, and no check distinguishes it.

## 8. Compliance

No push. No production file modified. No bulk git capture — the only git writes were one
`git fetch --all`, explicitly permitted, which changed nothing (208 refs before and after, both
published), and three `git checkout -- internal/webguard/remotedata_consumers_test.go` reverts, each
a single named path, no glob, no directory pathspec. No clone, worktree or object store created.
Nothing deleted or tidied anywhere, including my own scratch files and the `/tmp` clone. No
`gc`/`prune`/`repack`/`reflog expire`. **No filesystem copy of a `.git` or working tree at any point**
— the M8 clone was made with `git clone --no-hardlinks` from a local path, never `cp -a`/`rsync`/
`tar`/`mv`, and never from the network remote. No credential in the new clone's config (verified
before use); its origin is a local path, so it has no network-reachable push target.

**In the review tree:** `go test ./internal/webguard/` ×4 after the 12:33Z lift, that package only —
no `go build ./...`, no `make`, no `npm`, no full suite, and **no production file edited, ever**.
Verified after everything: porcelain empty, HEAD `901670e`, `web/dist` absent, `web/node_modules`
absent, `web/.tmp-test` absent, and `git check-ignore -v -- web/dist` still **rc=1** — the polarity
trap the EM was protecting is measurably unflipped.

**Tree states named for every figure**, per the 13:29Z rule: the four `go test ./internal/webguard/`
runs were taken in a PRISTINE tree (67 files under `web/`); the M8 differential, the 380-assertion
count and the 102-package count were taken in a NON-pristine one (9,961 files under `web/`). Item 10
observed: I have created no built frontend anywhere and deleted nothing.

**In `/tmp/m8-r8-clone` (throwaway, EM-authorised 12:45Z):** `npm install`, `npm test` ×9 (6
scheduled + 3 controls), all production edits confined there and reverted by single named path;
clone left clean at `901670e`. Tagged as apparatus in report §18.4 at creation rather than after. No contact with the other two legs, whose
identities I do not know. Stayed in `/workspace/farmtable-test-r8` throughout; did not read, enter
or measure any other tree, including the two announced at 10:41Z. Scratch confined to `/tmp`.

## 9. Ledger

Itemised in report §15.9. Four entries, one of which is that the brief's §5 environment claims were
all correct — recorded because a ledger listing only failures is not a ledger. The largest error of
the round is mine (F3), not the brief's, and I found it by reading phase two, which is the weakest
way to find your own mistake.

## 7e. Handover to farmtable-em-hardening (13:47Z)

Reassigned mid-measurement from `farmtable-em-task-state-model-v2` to `farmtable-em-hardening`.
Instruction: open items travel as-is, no re-runs on account of the handover, no reply to the outgoing
EM. Complied — nothing re-run, no reply sent. Two rulings I was owed are now moot by the outgoing EM's
own statement; I am not waiting on them and have closed §16.6 on Bulletin 20 §7, which had already
landed.

## 7f. Work completed after the last bulletin, before/through handover

- **§20** — figures re-stated as coordinates per Bulletin 20 §4; cache axis shown inert by
  `go list` imports (stdlib only) rather than asserted; state-invariant `check-ignore` form measured,
  narrowing Bulletin 20.1's "THE CLASS"; fifth-route 32-vs-33 corroboration with `(cached)` disclosed.
- **§21** — planted positive control run against all reported sweeps (all fire); **F14 [MEDIUM, NEW]**
  Go suite has no automated executor; **F12 MEDIUM→LOW** after measuring `npm run build`.

## 7g. Self-assessment carried into the new reporting line

Two downward corrections this round (F3 HIGH→LOW, F12 MEDIUM→LOW), **both fails-toward-alarm**. Logged
as a measured lean in my output, not a pair of accidents. Countermeasure adopted: before filing any
severity, identify what *else* in the repo would catch the same defect. That check is what produced
§21.3, and it is the check that would have prevented F12's original grade.
