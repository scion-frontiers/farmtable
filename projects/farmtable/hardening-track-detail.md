# HARDENING TRACK — WORKING DETAIL

**This is NOT the status report.** The owner asked for one page and got this instead;
the one-pager is `status-hardening.md` and it is authoritative for done/not-done.
Everything here is evidence, retractions and method. Read it only to check a claim
made there.

---


Updated 2026-07-29 15:33Z. Main = **439b309**, PUSHED (`aa08f1a..439b309`, 95 commits,
fast-forward). CI run **30464490913 SUCCESS**.

**THE BRIEF'S THREE ITEMS ARE RESOLVED (1 transferred, 2 merged, 3 closed).** Three
later assignments landed on this track after them and are tracked in §4–§6 below; they
are NOT part of the brief and none is finished. Kept in one file so the track has one
status, not two.

| # | Item | Verdict | Done? |
|---|---|---|---|
| 1 | Unrecognised user type | Real. **MEDIUM** (I rated it CRITICAL and withdrew) | **TRANSFERRED** — auth is out of scope by owner declaration; package delivered to `farmtable-architect-auth` |
| 2 | XSS / URL scheme, r8+r9 forked | Premise TRUE. Union **439b309** | **DONE — reviewed, merged, pushed, CI green** |
| 3 | Unauthenticated token-write | Reported one **FALSE**. A different one **CONFIRMED by execution** | **CLOSED** |

## 1 — UNRECOGNISED USER TYPE — real, transferred, not abandoned

`DefaultScopesForUserType`'s default arm returns `nil`; `RequireScope` reads empty
as **wildcard**. Unrecognised type → everything. The code comment names its own
exploit and mitigates it with a `log.Printf`. A warning is not an access control.

I rated it CRITICAL, then measured the **privilege delta: ZERO.** `ImportCollection`
— ~~the one~~ **an** external write path into `users.type` (corrected, not deleted:
`provisioning.go:92` is a second, hardcoded to `"human"` and not attacker-choosable,
so the conclusion is unaffected) — requires `collection:admin`, and
only wildcard types hold it. Everyone who can reach the escalation already has the
ceiling. Latent defect, not live escalation. **MEDIUM.** The real residue is
**persistence, not privilege**: a planted row with an attacker-chosen email is a
durable credential outliving the attacker's own account.

Branch `scopedeny-93-deny-unrecognised-type`, 47 ahead, tip **89973f8**, merge-base
7a0f220. It is **stale, not broken** — measured clean-tree: build EXIT=1 (`pattern
all:web/dist: no matching files`); with `web/dist/.gitkeep` from 43bd206, EXIT=0 /
32 packages. Needs a rebase before any green from it counts.

Auth architecture is out of scope project-wide by owner declaration. Full package
(including the **19-of-19 NULL-scope tokens**, carried with its `n=1, strong
argument / weak census` caveat) delivered direct to `farmtable-architect-auth`.

## 2 — URL SCHEME XSS

Premise confirmed: `safe-url.ts` and `urlvalidate.go` absent, `safeHref` zero
occurrences, both `unsafeHTML` sinks live. Union landed per the owner's ruling —
log content unioned, never a side taken. At d7154a4: `go vet` EXIT=0, 33/33
packages (branch has `internal/webguard`; main is 32/32 — both right for their own
tree); membership gate MISSING=0, 548 executed.

**The most important finding on the track, now FIXED AND ON MAIN.** `npm test` ran
**1 of 5** web test files (~~1 of 6~~ — six was r8's tree, which adds a sixth file;
two trees pooled into one number, retracted with its SHA); the XSS guard tests **compiled and never executed**. Measured
mutation arm: **delete `DOMPurify.sanitize` → suite GREEN, 1/1 pass** — sanitiser
gone, both stored-XSS sinks live, CI green. Merging then would have converted an
*absent* guard into a *believed* one, which is worse than not merging: a believed
guard stops anyone from looking.

**Block cleared.** EM-CI's shared runner is on main at **aa08f1a** (run 30462696017
SUCCESS). CI-measured at that commit: `canary/runner-mutation-deleted` **FAILURE** —
our mutation is killed; `canary/runner-spec-divergence` FAILURE for a *named* reason
(compiled-but-not-listed, enumerated=2 executed=0 missing=2). Off-runner, both node
binaries: sanitiser deleted + OLD wiring = GREEN (**mutation survives**), + NEW
wiring = RED, and in every old-wiring arm the sanitiser test's stdout marker is
**absent**.

**Union merged at 439b309** = main `aa08f1a` + XSS union + r8's render-sink pins
(`3006492`). `web/package.json` took main's `test` script wholesale while **keeping
the union's `jsdom` devDeps** — same file, opposite directions, one hunk each; the
merge produced *zero* conflicts, so the take was verified by **parsing the merged
JSON**, not by the merge exiting 0. Measured at 439b309 from a fresh clone,
`npm ci --offline` off that commit's lockfile: **enumerated=6 executed=6 missing=0**,
manifest EXIT=0, `npm test` EXIT=0, `go vet` EXIT=0 33/33, `go build` EXIT=0,
`tsc --noEmit` EXIT=0. **Pre-registered 6/6/0 before running; exact match — so it was
killed rather than banked:** disarming `safeHref` (64 diff lines, *not* vacuous)
fails `safe-url.test.js` 5 pass / 1 fail; restore returns green. The guard is live,
not merely listed. Reported to EM-CI the same hour, as committed.

The merge **inverted r9's own C-1 wording** (text saying npm test does *not* run the
guard became false once it did); re-trued at all four sites, and deliberately
*without* restating a file count — hardcoding a cardinality is what went stale
within the hour.

**C10 — CLOSED, VERIFIED NOT INFERRED.** `RUN npm test` in **both** Dockerfiles sat
under the comment "the release path must not be able to ship a tree whose guard is
red" — and executed one file: a release gate whose red was unreachable for exactly the
guards it names. At the merged tip it goes **6/1/5 → 6/6/0**, `url-binding-scan` and
`safe-url` each **0 → 1 ok**. Standing caveat retained: **neither image was built**, so
that the `RUN` line behaves in a build as in a shell remains inferred.

## 3 — TOKEN-WRITE ENDPOINT — CLOSED

**Reported defect FALSE, closed** — and **re-measured at the shipping commit** after
the coordinator's challenge, because a wrong retraction closes a question and leaves
a receipt saying it was examined. Artefact: `git show aa08f1a:<path>`, which reads
the *commit* and is **incapable** of seeing the working tree. `connect.go:24` imports
`bufconn`; `:162` and `:301` both `bufconn.Listen(1 << 20)`; `:166/:167` install
`TokenAuthInterceptor` / `TokenAuthStreamInterceptor`. `Dockerfile` → `CMD ["/ft",
"dashboard","--port","8080"]`, `Dockerfile.server` → `CMD ["/farmtable-server"]`,
`grep -c connect` = **0** in both. The closure rests on the load-bearing leg, not the
convenient one: **bufconn binds no address**, true regardless of which binary ships.
The Dockerfile reading was corroboration and never the support.

**A different one CONFIRMED BY EXECUTION.** The six `/api/link/*` routes are
unauthenticated: `iapMiddleware` and `SessionToBearerMiddleware` wrap only
`grpcWebHandler`, while `LinkFlowManager.RegisterRoutes` registers on the bare mux.
No-credential probe → 307 to the GitHub authorize URL. **Control fired** (same
middleware, malformed assertion, gRPC path → 401). **Medium**: no Farm Table token
is minted or stolen; the gain is credential *injection*. Enumerated **18 token-write
entry points** with a denominator; the decisive negative (*no gRPC method mints a
Farm Table token*) cross-checked with two independent instruments.

**Severity is conditional and we refused to guess:** Medium if IAP fronts every
path · **High** if `/api/link/*` is IAP-exempt · **no finding at all** if the
platform OAuth client IDs are unset in prod (all six routes 503). Two out-of-repo
facts decide it; both routed upward, neither paged to the owner.

## THE LARGER FINDING — outranks all three, now the architect's

**Every user the system creates by itself is wildcard.** `provisioning.go:92`
hardcodes `Type: "human"` for every OAuth/IAP user; `human` → wildcard. `admin`,
`reviewer`, `orchestrator`, `viewer` appear **nowhere** in non-test, non-generated
Go except as arms of that one switch — three of four restricted tiers are dead
code. Open question for the owner: **is wildcard-for-every-SSO-user intended?** If
yes, the RBAC tier system is decorative and we should say so.

## OPEN ITEMS

| Item | Severity | Owner |
|---|---|---|
| Forged/backdated audit rows via import | **HIGH** | `dev-import-hardening` |
| Import writes `users.type` unvalidated | Low (delta zero) | `dev-import-hardening` |
| Default-open: unset `FARMTABLE_TOKEN` nils the lookup → all 33 RPCs open | High | **routed** to architect-auth |
| Label path ungated: `TransitionScope` called only with `req.Stage` (2 sites; 8 label expressions unguarded; 29 `RequireScope` sites as positive control) | Structural claim **measured**, exploit **inferred** | **routed** to architect-auth |
| `ensureDashboardToken` mints with no scopes — wildcard today, inert after a deny-flip | Low | routed |
| No CSP anywhere | Medium | queued as **script-src only**, its own change |
| #194 price-function *shape* (fail-closed entering, fail-open leaving, on one endpoint doing both jobs) | High | `dev-194-pricing`, oracle-first |
| 45 branch-only tests unregistered at merge | Medium | me, one named commit at merge time |

## RULES THIS TRACK ENFORCES

1. **MEASURE THE COMMIT, NOT THE TREE.** Anything reported, cited or merged on
   comes from a *fresh checkout*, or from a separate module that can only **read**
   the target. Don't make the instrument trustworthy — make it **incapable** of
   seeing what the commit does not contain. Declaring tree state is a fallback, and
   then it is a confession, not a certificate. Four false greens today shared one
   cause — **the tree had something the commit did not** — and **not one of the four
   legs was careless**. Every one measured accurately; the instrument answered a
   question about a *tree* and every reader took it as being about a *commit*.
   A rule that blames diligence cannot fix a systems property.
1a. **Ask what question the flag actually answered.** `git status --porcelain -uno`
   suppresses untracked files — "clean" was true as phrased and misleading in
   substance. Report gitignored artefacts present on disk.
2. **A positive control validates the instrument, never the substrate.**
2a. **Canary the PROPERTY, then ask which guard went red. If none did, the property
   is unguarded — and that is the finding.** Supersedes "canary the guard", which is
   guard-shaped and so has no hook for a property nobody owns: you can canary every
   guard, watch them all behave, and never learn the thing you care about is
   defended by no one. Break it, then read the whole board — *which files went red,
   by name.* A property defended solely by the test written this afternoon is a
   finding about all the others. (From EM-CI's reviewer, adopted project-wide.)
3. **A measurement does not age into a different claim** — including my own rules.
   Two died today: *"go vet is unusable"* (dead at 43bd206) and *"update the
   manifest in the same commit"* (false, and false in the dangerous direction —
   the gate is asymmetric, and my version taught reflexive regeneration).
4. **Never regenerate the manifest.** Add your own tests by name. A missing entry
   is a question, not a chore.
5. **Two-sided acceptance**: still denies what must be denied, still permits what a
   legitimate user may do. 4 of 9 earlier items were over-denial. Corollary added
   today: **a stop rule must not halt on the intended effect** — name the one
   transition your fix is *meant* to deny, and stop on any *other* newly-denied one.
5a. **Decision vs facts** (replaces "does it alter what they may do", which was too
   coarse). The **decision** — scope vocabulary, transition table, who holds what,
   authentication — is the architect's. The **facts** the decision is applied to —
   what operation an edit is *recognised as performing* — are ours. #194's departure
   pricing is facts: the procedure would always have denied it, shown the truth.
5b. **A guard whose red is indistinguishable from an existing red is not a guard**,
   and a positive control that is red under both hypotheses is not a control.
5d. **A retraction is a claim and gets a claim's controls** — state the SHA and
   artefact you withdrew it at. A wrong claim leaves a question open; a wrong
   retraction *closes* it and leaves a receipt saying it was examined. Two of mine
   died under this rule today: *"npm test runs 1 of 6"* (it was **1 of 5 @
   d7154a4**; six is r8's tree — two trees pooled into one number, the day's failure
   wearing my own face) and *"ImportCollection is **the one** external write path
   into `users.type`"* (`provisioning.go:92` is a second one; hardcoded `"human"`, so
   the zero-delta conclusion and MEDIUM stand, but "the one" was false).
   Corollary: **strike text through in place, don't delete it** — the struck text is
   the only audit trail a withdrawal has. And **a shrinking document is not evidence
   of an improving one**; shrinkage is equally consistent with deleting things
   that were true.
5e. **A correction scoped to the instances in front of you is the original defect
   one level up.** Ask what *produced* the claim and what else that same thing
   produced. A miscalibrated pass does not make one error.
5c. **Pre-register the honest repair before the failure exists.** If a provenance
   assertion flakes, **widen the window, never delete the assertion.** Guards are
   removed at speed by people who need green and have no agreed alternative in front
   of them; committing to the repair in advance removes that moment.
6. **A vacuous mutant is not a surviving mutant.** Zero diff lines = no mutant.
7. Work commit-addressed; never stage with a directory or glob pathspec.

**MERGED AND PUSHED.** Reviewer: **MERGEABLE**, no blocking items; C-1 resolved across
**five** sites (the fifth minted by the R-2 fix itself); `expected-go-tests.txt` 501→503,
**+2/−0, zero removals**, MISSING=0. `test-xss-r8`: all seven mutation arms matched a table
frozen before the runner existed, **no arm red-on-tree came back green**, C10 CLOSED and
verified (6/1/5 → 6/6/0). Its one caveat — *node 20, not CI; ci.yml pins 22* — is now
**discharged**: CI on node 22 reports the identical **enumerated=6 executed=6 missing=0**.

**Deviation, recorded not hidden:** the three-way quality gate ran as code review +
test engineer. No separate security auditor on the union — the change *is* the security
fix and r8's adversarial mutation work covered that ground. My call.

**Next:** union takes main's runner (aa08f1a) + r8's pins → three integers to EM-CI →
frozen predictions diffed (r8's per-arm table, reviewer's P1–P6) → register the 45
branch-only tests as ONE named commit reviewed as a set diff → merge and push.

---

# ASSIGNMENTS AFTER THE BRIEF — open, not part of the three items

## 4 — safe-url ADD/ADD adjudication — **BLOCKED ON THE OWNER**

Carved out of em-task-state's phase-2 merge by coordinator ruling and given to this
track. Two files: `web/src/util/safe-url.ts`, `web/src/util/safe-url.test.ts`.

| | MAIN `439b309` | BRANCH `633f8f2` |
|---|---|---|
| impl blob | `659ef58` | `d85bb5b` |
| test blob | `c3e1b5c` | `a9e49ff` |
| symbol | `safeHref` | `safeExternalUrl` |
| reject sentinel | `undefined` | `null` |
| accept contract | returns input **unchanged** | returns **normalised** value |

**NO MERGE BASE EXISTS.** Verified independently at `git merge-tree --write-tree
439b309 e64138c`, harvesting machine-readable STAGE ENTRIES (never the "Auto-merging"
prose): both safe-url paths show stages **2,3 only**; all five other conflicted paths
show **1,2,3**. So a conventional resolution finds no ancestor and **degrades silently
into picking a side and inheriting its test table** — the one outcome the ruling
forbids, and it would not announce itself. Union-the-tables is the only available
method, not merely the better one.

**ONE SURFACE, RENAMED — "land both" is off the table.** Decided on CONSUMERS, not
docblocks: `ft-inspector-code.ts` and `ft-inspector-meta.ts` call `safeHref` at
439b309 and `safeExternalUrl` at 633f8f2, on the same two fields (`PullRequest.url`,
`Task.remote_url`); each symbol has **ZERO consumers** at the other commit. Two
genuinely distinct surfaces would coexist somewhere with different consumers.

**Counts — two independent blind legs, agreeing:** MAIN **49 distinct inputs / 78
rows**, BRANCH **45 / 45**, UNION **81 distinct inputs / 82 rows**. Pre-registered
alarm (union == MAIN ⇒ finding) **did not fire**: BRANCH contributes 32 inputs MAIN
never asserts. Had the implementation been chosen first, that attack surface would
have been discarded **with nothing going red**.

| Contradiction | MAIN | BRANCH | State |
|---|---|---|---|
| Embedded credentials (userinfo) | accept | reject | **RULED — reject, BRANCH wins.** Server alignment filed as follow-up |
| Plaintext `http:` to a public host | accept | reject | **WITH THE OWNER** — product decision |
| `http://[::1]/x` IPv6 loopback | accept | reject | **HELD — subsumed by the `http:` ruling.** Confirmed at code: `d85bb5b` consults `LOCAL_HOSTNAMES` only inside the `LOCAL_HTTP_LINKS_ENABLED && protocol==='http:'` branch, so with the flag false the input dies on scheme at `:65` before any host reasoning |
| Reject **UX** | inert span **carrying the raw URL** in `title`, pinned by `.pr-link-unsafe` | id rendered unlinked, value not surfaced | **WITH THE OWNER** — taking BRANCH wholesale silently drops "degrade, do not drop" |

**MERGE ACCEPTANCE CRITERION (coordinator, not negotiable):** MAIN's test asserts
against `testdata/url-scheme-cases.json` (blob `4a54328`), the client half of a
cross-language differential pin whose server half is
`TestValidateURLFieldMatchesSharedFixtures`. The fixture does not exist at 633f8f2.
Discard MAIN's test blob and **the Go half keeps asserting against a fixture nothing
on the client checks, green throughout**. Whichever side wins, the fixture must remain
asserted from both sides **in the same commit**, plus a red arm proving the pin is not
already decorative.

Legs: `dev-safeurl-union` (holding; Arm A/Arm B authorised on C2-independent rows
only), `test-safeurl-tables` (blind control, complete). Commits `c623332`, `1713ce8`,
`cf54ad5`, `2235ad8` exist **only in the leg clone** — verified unreachable from
canonical, exit 128. Not pushed. Nothing landed.

## 5 — import-hardening — **APPROVED, one fix outstanding**

`f487dc5` (base 43bd206, 5 commits). Review verdict **APPROVE**, 0 Critical, 0
Required, 2 Nits. Residual predicate retired by a measured equivalence, not by reading:
**196 env combinations** (14 × 14), permit arm and both deny arms asserted explicitly
so "all agree" is not vacuous; scratch deleted and tree restored, `write-tree` ==
`HEAD^{tree}` == `a579ea92`. Manifest numstat **3 / 0** — additions with zero
deletions, the mechanical proof of non-regeneration; 507→510 rows, prior lines
byte-for-byte in order.

**Held for N2-2**, reclassified from nit to merge-gating: the `missing_token` wording
subcase **passes under mutation M7**, because the generic fallback text also names
`FARMTABLE_TOKEN` — the subcase cannot distinguish its own branch from the fallback.
Present, executing, measuring nothing. Fix must assert the unique phrase **and
demonstrate the subcase reddening under M7**; a reworded inert assertion nobody
reddens is not a fix.

## 6 — Go test registration — **RUNNING**

Membership is asserted in **one direction only**: main's green run executed **548 Go
test functions** while the manifest knows **503**, so 45 run that the gate cannot see.
MISSING errors and exits 1; UNEXPECTED is a notice labelled "(not a failure)". Largest
unasserted quantity in the project. `dev-gotest-registration` is producing the
**both-directions** set diff, to land as ONE named registration commit with **zero
deletions**. Explicitly NOT pooled with import-hardening's 510 — different artefact,
different base; if they merge, the numbers get re-derived, not added.

## GC / preservation — **CLOSED 15:52Z. 32 OBJECTS RESCUED AND PUSHED.**

~~Leg objects live **only** in their containers: legs cannot push and canonical cannot
reach them (verified, exit 128). Before any leg is retired it must report refs
unreachable from `origin/main` or bundle them to `bundles/`.~~ **Struck: the premise and
the predicate were both wrong.** Some legs are linked *worktrees* of `/workspace/farmtable`,
not clones, so `cat-file -e` against canonical interrogates their own store and returns
`0 absent` **by construction**. And `reachable from origin/main` false-positives on every
unmerged branch — one leg got 127 hits, all of them normal active work.

**The predicate that bears: ABSENT FROM EVERY STORE OUTSIDE THIS CONTAINER**, and for the
network, tested **against the remote URL, never against the name `origin`** — in a leg tree
`origin` *is* canonical, and canonical's fetch refspec is heads-only, so `--remotes=origin`
sees 135 refs against 481 live ones.

**YIELD: 32 objects existed in exactly one place on earth. All 32 are now on the network**
as `refs/preserve/rescued/<full-sha>`, re-fetched by URL and re-measured at 0 off-network
with the negative arm still firing at 1.

| Source | Objects | What they were |
|---|---|---|
| `dev-xss-r9` | 21 | pre-squash URL-scheme rounds + `6255508`, its pre-amend C-1 commit |
| `dev-scopedeny-93` | 8 | abandoned scratch/validate arm, `scopes.go`/`token.go` |
| `test-xss-r8` | 1 | `a31c814`, pre-amend `render-sink-xss.test.ts` with the real NUL/0x1F bytes |
| `dev-gotest-registration` | 2 | `32255b0` registration commit + `e374367` project log |
| `dev-194-pricing` | 3 | `1c48795`, `1253e12`, `20b7525` — created *after* it reported its tip |

Also pinned in canonical, prune-proof: four detached worktree HEADs (`4fb7f43`, `91aa668`,
`ef4bbf8`, `045a0c2`) — **the gc/prune freeze lifted at 13:29Z and the real exposure was a
routine maintenance command in canonical, not container teardown.** A plain `--all` bundle
was independently measured dropping `045a0c2`, so the pinning was load-bearing.

**STILL OPEN: `dev-safeurl-union`'s 7 commits are single-copy and I cannot find its clone.**
Do not retire it. `/workspace` and `/scion-volumes/scratchpad` are both `st_dev 2049` — the
same device — so a bundle on the scratchpad is not an off-device copy and only the push is.

### What the exercise actually taught, which is not about bundles

**MY INSTRUCTION WAS THE LEAST RELIABLE ARTEFACT IN THE OPERATION.** It was wrong in nine
ways. Every single correction came from a leg **re-deriving it instead of running it**.
I diagnosed a real symptom (`--all` dropping objects), invented a mechanism (namespace
coverage), and shipped the mechanism to nine legs; the fix masked the symptom, so nothing
would ever have gone red. Four legs disproved it by experiment. **A fix that works is not
evidence that its explanation is right, and an instruction is the one artefact nothing tests.**

- **`git bundle verify` is dead in both directions** — false-PASS on bundles missing 169 and
  308 commits; false-FAIL on sound bundles when run outside a repo. Restore into an empty
  repo, assert the **ref** (not just the object), and re-assert after `gc --prune=now` —
  a bundle restored by `clone` yields the object but not the ref, and gc then destroys it.
- **The expensive sweep bought nothing; the cheap skippable one carried the yield.** `fsck`
  roots on reflogs, so it *structurally cannot* see an amend-away tip. Per leg: 308/315/169
  fsck commits, ~1 MB of bundle each, **zero at risk**; the reflog sweep found every rescued
  object. *Corrected by `review-xss-union`:* this is **not** intrinsic — it is clone topology.
  Objects reflog-only in one tree arrive in a clone *of* that tree as ref-less objects, i.e.
  fsck's territory, where the split ran 20/1 the other way. **Neither sweep is complete; which
  one catches an object depends on where you stand. Run both, in every clone.**
- **Six shell failures in one hour, three of them mine**, all producing uniform, plausible,
  entirely wrong tables in the direction of alarm. zsh does not word-split unquoted vars and
  aborts a command on a non-matching glob; separately, `git` dropping out of `PATH` in a
  process substitution sent every row into the `else` branch. **The only defence that worked,
  every time, was a control with two different outcomes in the same invocation, with its
  direction pre-registered, and visible stderr.** `cmd | tail; echo $?` reports `tail`'s status.
- **`git update-ref --stdin` is transactional** — a second sweep aborts entirely on the first
  already-existing ref, losing precisely the new ref it was run to capture. Punishes compliance.
- **Names are a measurement too.** I misattributed work twice, the second time *inside the
  retraction of the first*. `review-import-hardening` and `review-import-hardening-r3` are
  different legs with different evidence. The fix is structural, not vigilance: carry the
  coordinate — the commit, the round, the SHA — not the label.


---

# ADDENDUM 16:05Z — THE FILESYSTEM FINDING, AND WHY THE GC SECTION ABOVE UNDERSTATED IT

The §GC section above closed preservation at 32 objects on the strength of a sweep I ran
from canonical outward. **That sweep could not read four of my fifteen legs at all**, and
its output on them was `NOT FOUND` — the same string it prints for a leg with nothing to
preserve. Two indistinguishable meanings, one of them a silent loss.

`dev-safeurl-union` found it: its clone was on `/tmp`, `st_dev 1048612`, a container
overlay. `/workspace` and `/scion-volumes/scratchpad` are both `st_dev 2049`, `/dev/root`.
**Reachability between a container and a host mount is one-way** — the leg can read
`/workspace`, I cannot read its overlay. So *"the EM's sweep cannot see this leg"* and
*"this leg's objects are all in canonical"* are both true at once, and only the first is
a hole. It also warned me off the obvious repair: fetching `/tmp/leg-safeurl` **from my
container would have hit my own `/tmp`, succeeded against the wrong repository, and
exited clean.**

## THE REPAIR IS NOT A BETTER SWEEP. IT IS A DIFFERENT DIRECTION.

Only the leg can answer *"do you hold objects that are container-local?"*, and it must
show a **firing negative arm**, because its zero and my blindness produce the same string.
I asked all fifteen for their absolute path and its `st_dev`.

| Result | Legs |
|---|---|
| `st_dev 2049`, host-backed, covered | 11 |
| Overlay, already self-bundled to `/dev/root` | 3 (`review-import-hardening`, `review-xss-union`, `ts-diff-r8`) |
| **Overlay, holding single-copy objects** | **1 (`test-xss-r8`)** |

`test-xss-r8` **rejected the question as posed and that is why the yield exists.** I asked
*"is your clone container-local"*; its clone was on 2049 and could truthfully have answered
COVERED in one line. It answered the question that matters — *"do you hold objects that
are"* — swept **15 retained repos** under its `/tmp`, and found **3 of 816 commits absent
from any host-backed store**. My instruction was one word narrow.

    61ac644  blob 0ee21e5  19,911 B  NUL=1   <- unique binary fixture, nowhere else
    aacbec0  blob a37f35d  19,917 B  NUL=0   <- rebase intermediate
    d8de780  blob a37f35d  19,917 B  NUL=0   <- rebase intermediate
    negative arm, same invocation, fabricated SHA -> rc=1

Fetched from its bundle on `st_dev 2049` (never by `/tmp` path), pinned, **pushed**, then
re-fetched the whole namespace **by URL** and re-measured: all three `offnet=0`, negative
arm `offnet=1`. The unique blob's byte count and its single NUL both read back after
transit — I did not take the content claim on trust. **Total: 46 refs under
`refs/preserve/rescued/*`, all confirmed present on origin.**

## THE TAXONOMY CORRECTION, WHICH SUPERSEDES THIS DOC'S OWN fsck/reflog SECTION

Those three commits are **neither fsck-unreachable nor reflog-only**. They are ordinary
`HEAD` and branch commits — the most reachable objects a repo can hold — at risk purely
by **which filesystem they sit on**. The coordinator has made a four-arm enumerator
mandatory (every ref + detached HEAD + `reflog --all` + private preserve namespaces).
**All four arms enumerate inside one filesystem, so all four miss these.** Per
`test-xss-r8`, the fix is ordering, not a fifth arm:

1. Enumerate **filesystems** first — `stat -c '%d'` over every candidate root, with a
   known host-backed and a known container-local path in the *same* invocation.
2. *Then* run the four arms per filesystem.

Otherwise the mandate is a more thorough search of the visible set.

**And a stronger form of the coordinator's rule than the one it issued.** It said: name
the preserve namespace and confirm the fleet sweep enumerates it, or the instruction is
decorative — which leaves the preservation hostage to somebody else's instrument, the
exact dependency that produced its 128 orphaned `refs/preserve/*`. **Pushing removes the
enumerator from the predicate entirely.** A pushed object is durable whether or not
anyone ever sweeps the namespace it sits in.

## FOUR MORE INSTRUMENT DEFECTS, ALL SILENT-CLEAN, ALL FOUND BY LEGS

1. **The peel changes the exit code.** `cat-file -e <absent>` → `rc=1`;
   `cat-file -e <absent>^{commit}` → **`rc=128`** (a parse fatal). Most of the fleet
   adopted the peel today. Any control written `[ $rc -eq 1 ]` **fires on the bare
   spelling and silently does not fire on the peeled one.** Use `-ne 0`, or bind to the
   command. `ts-diff-r8` had a live instance in its own transcript, published `128` as if
   it were a property of *absence*, and caught it only when three other legs reported the
   pair.
2. **`rev-parse` echoes a bad pathspec to STDOUT** (mine). `b=$(git rev-parse "$c:guessed/path" 2>/dev/null || echo MISSING)`
   → `b` becomes a two-line string *ending in* `MISSING`, the `!= MISSING` guard passes,
   and `cat-file` reports an empty size for every row. Caught by a blank field, not by the
   guard. Root error: **I guessed a path when the leg had already given me the blob SHAs.**
3. **`--git-common-dir` returns a RELATIVE path on a standalone clone** (`dev-scopedeny-93`).
   So the natural spelling of the linked-worktree check calls **every standalone clone a
   linked worktree** → *"its objects are in canonical"* → *"do not bundle it."* **A false
   positive that reads as coverage and skips preservation.** Fix: always
   `rev-parse --path-format=absolute --git-common-dir`.
4. **`find /tmp -type d -name .git` misses bare repos** (`test-xss-r8`) — and the bare repos
   it missed were that leg's **restore targets**, the repositories created by the
   *verification step*. The instrument that finds repositories was blind to the repositories
   built to verify the finds.

Defect 4 is the one to keep. **Every control built today guards a MEASUREMENT** — negative
arm, two outcomes per invocation, visible stderr. **None of them can see a wrong
POPULATION**, because a search over the wrong set returns a clean, correctly-measured
answer about the wrong thing. The defence is the same shape one level up: **derive the
population twice by different means and diff the lists.**

`dev-scopedeny-93`'s generalisation of defects 1–3 is the other keeper: a git plumbing
command's **output shape depends on context you did not specify, and the unspecified
default reads as the safe answer**. So: **pin the output format, do not inherit it.**

## THE PATH-COORDINATE TABLE — TWO ENTRIES NO CONTENT CHECK CAN SEPARATE

| Trap | Detail |
|---|---|
| Agent name ≠ clone path | `dev-gotest-registration` → `/workspace/farmtable-reg-goleg`; all three derivable names **do not exist**. `review-xss-r8` → `/workspace/farmtable-review-r8`, no `xss` in it. |
| **Wrong tree, right content** | `/workspace/farmtable-audit-r8` sits at `review-xss-r8`'s **exact HEAD `901670e` on its exact branch name**. A fetch there returns `rc=0`, carries objects, and HEAD/branch/`cat-file -e` **all match**. The audit leg's own unique objects would be the ones silently skipped. |
| Wrong tree, plausible content | `/workspace/farmtable-scopedeny-93` is a *real* scopedeny repo with the real candidate branch — and carries **0 of 8** of `dev-scopedeny-93`'s commits. *"Did it succeed, and is this scopedeny material?"* **passes on the wrong tree.** |
| Overlay `/tmp` ids are per-container | Measured: `65, 184, 204, 1048590, 1048612, 1048634, 1048645, 1048660, 1048678, 1048722`. **Nothing to grep for**; `st_dev != 2049` compared in the same invocation is the only portable test. |
| Linked worktree | `dev-xss-r8`'s objects live in `/workspace/farmtable/.git`, not in its own clone dir. And per `dev-194-pricing`, a worktree on 2049 can still keep objects on the overlay via a gitfile or `objects/info/alternates` — check all three, not the directory you were handed. |

`ts-diff-r8` closed it: **`901670e` has no discriminating power left anywhere on this
project** — canonical, both its throwaway clones, `review-xss-r8`'s tree and the audit tree
all answer to it. The purest example today of a label four objects share.

`dev-xss-r9`'s caveat belongs beside the table: **some names *do* derive** — its own path is
`/workspace/farmtable-dev-xss-r9`. That is luck, not a property, and *"a rule that works
four times out of six is more dangerous than one that never works."*

## RETRACTIONS TAKEN THIS ROUND

- **Mine, to `dev-scopedeny-93`:** I fetched `/workspace/farmtable-scopedeny-93` instead of
  `/workspace/dev-scopedeny-93`. The fetch returned `rc=0` and carried none of its 8. Its
  15:52Z reading of "absent" and my later reading of "present" are **both correct as of
  their own clocks** — superseded by an action, not aged into falsehood.
- **`test-xss-r8`'s, against itself:** it had twice told me `a31c814` carried the real NUL
  bytes. Its blob is **byte-identical to the delivered commit**; its value was only ever the
  commit object. I had already rescued and pushed `a31c814` on that claim. **The rescue was
  right and my stated reason for it was wrong** — the mirror image of my defect-3 fix, which
  worked for a cause I had invented.
- **`dev-safeurl-union`'s, against its own interest:** every element of its harness-column
  error flattered `439b309`, the requester's own track. It did not defer — it **under-searched**,
  and under-searching landed on the answer the interested party wanted. Those two are
  indistinguishable from outside. Root cause, and the reusable part: *the assignment named
  two paths and it treated that as the population.* **A brief names a starting point, never
  a denominator.**
- **Mine, on the device split:** I said a scratchpad bundle is not a real copy because it
  shares `st_dev 2049` with `/workspace`. True against **host** loss; the live risk is
  **container** loss, and against that the split runs the other way — **the bundle is on
  `/dev/root` and outlives the container; the clone is on the overlay and does not.** Same
  two numbers, opposite conclusions. **Name the loss event before comparing devices.**
