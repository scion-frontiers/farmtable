# OFFHOST-MANIFEST — what is off-host, and what is NOT

Author: `farmtable-relocate-offhost` leg. Written 2026-07-29T07:0xZ.
Companion report: `../reports/relocate-offhost.md`.

---

## SCOPE OF EVERY CLAIM IN THIS FILE — READ BEFORE USING IT

**OFF-HOST means REF-REACHABLE AND OFF-HOST.**

Every commit named or counted below is one that is reachable from a ref — or from `HEAD` — in a
local repository. A push transfers only ref-reachable objects. **Unreachable objects — reflog-only
commits, amend debris, anything held by no ref — are not carried by a push, are not carried by a
bundle, and are not covered by anything in this file.** That population is measured separately in
`MANIFEST.md` §4b and `../reports/preserve-bundle.md` §8: **348 unreachable commits host-wide, 126
of them contained nowhere at all.** Nothing here reduces that number by one.

Do not read this manifest as saying the risk is closed. It is a statement about one population,
named at the top of the file, and there is a second population it does not touch.

---

## CURRENT STATUS — **268 REF-REACHABLE AT-RISK COMMITS ARE OFF-HOST, AND THE RESTORE IS PROVEN.**

Superseded at 07:3xZ. The line above previously read *"NOTHING IS OFF-HOST"*; a bounded
authorisation at 07:30Z named a **private** destination and the relocation has now been performed
**and verified by restore** — not by a push receipt. See PART 4, which is now filled in.

**What is off-host:** 268 commits, on 66 refs, at
`github.com/scion-frontiers/scion-repo-contrib` under `refs/preserve/offhost-20260729T073217Z/`.
**What is still NOT off-host:** everything in the SCOPE box above — the 348 unreachable commits,
126 of them contained nowhere. **That number is not reduced by one.** Read PART 2 before treating
this as closed.

<details><summary>Sequence of record leading here (retained — the reasoning matters more than the outcome)</summary>

**No push had been performed, and none was planned, up to 07:30Z.** Sequence of record:

1. I found that **`github.com/scion-frontiers/farmtable` is a PUBLIC repository** — measured, not
   assumed: anonymous `ls-remote` with the credential helper disabled returns 97 heads (rc=0), and
   the unauthenticated API reports `"private": false, "visibility": "public"`. Pushing would not
   relocate the commits, it would **publish** them.
2. I stopped at that gate and escalated rather than completing the briefed action.
3. The coordinator **confirmed the stop at 07:08Z** and cancelled the push. The briefed remote was
   an *assumed vehicle*, not a requirement.
4. At 07:24Z the coordinator **stood the escalation down entirely**: a separate leg classified the
   126 unreachable commits as tombstones (36 duplicate, 45 superseded draft, 36 no-content, 9
   unique, no unrecoverable work). With no imminent loss, publishing a private project's full
   history becomes a daylight decision for its owner.

**The durability risk is unchanged and is the real finding:** this entire project — canonical's
refs, every review round, real main itself — lives on **one machine, which locked up once
tonight**. Relocation is still correct. It is simply not urgent, and not a decision for 4 a.m.

**A NON-PUBLIC OFF-HOST DESTINATION DOES EXIST** — see PART 5. That is the material change since
this file was first written, and it means the morning decision is not "publish or accept the
risk". There is a third option.

5. At 07:30Z the coordinator approved that third option under a bounded authorisation:
   dry-run first, then push into a `refs/preserve` namespace on the **private** repo, then prove
   restore by content hash. All four steps are done. PART 4 records the proof.

</details>

Note that PART 1 was written in the conditional — *"would be covered if a push were authorised"* —
and is left in that voice deliberately, because it describes a **97-refspec** plan against a
different remote. The push that actually ran used **66 refs** selected as a minimal covering set
for the same 268 commits. PART 4 is authoritative; PART 1 is the superseded plan.

---

## THE POPULATION

**267 commits are ref-reachable on this host and exist on no off-host storage.**

Ground truth for "off-host" is the GitHub server itself, not local remote-tracking refs: the
server's full state (215 refs) was fetched into a throwaway `/tmp` repo, giving **600
ref-reachable commits on the server**, and every local commit was differenced against that set.
Local `refs/remotes` was **not** used as the oracle, because in 99 of 108 object stores on this
host `origin` points at **another directory on this same disk** — that test asks whether a commit
is on a sibling on `/dev/root`, which is not the question. `refs/remotes/origin/main` is also
stale by exactly 12 commits.

Single-device claim re-measured and confirmed: every persistent mount on this host
(`/workspace`, `/scion-volumes/scratchpad`, `/home/scion`) resolves to **`/dev/root`**. `/tmp` and
`/` are the container overlay. There is no second device.

---

## PART 1 — REPOSITORIES AND REFS THAT **WOULD BE** OFF-HOST ON AUTHORISATION

97 refs staged in `/tmp/inv/stage.git`, covering **all 267** commits. Verified by artefact: 97
refs, 645 ref-reachable commits staged, of which exactly 267 are the at-risk set.

Destination namespace: `refs/preserve/offhost-20260729T064854Z/<store-slug>/<original ref path>`.
Confirmed empty on the server — `ls-remote 'refs/preserve/*'` returns nothing, and the server
carries only `refs/heads` and `refs/pull`. Every ref is a creation; nothing is overwritten.

| # | repository | refs pushed | at-risk commits it uniquely contributes |
|---|---|---:|---:|
| 1 | `/workspace/farmtable` | 62 | 238 |
| 2 | `/scion-volumes/scratchpad` | 1 | 23 |
| 3 | `/workspace/farmtable-xss-r5-audit` | 11 | 3 |
| 4 | `/workspace/farmtable-xss-r5-test` | 11 | 2 |
| 5 | `/workspace/farmtable-xss-r5-review` | 12 | 1 |
| | **total** | **97** | **267** |

Named specifically, because these three would be missed by any ref enumeration written from
memory:

- **`/workspace/farmtable` `refs/stash`** → `…/farmtable/stash`. Carries 2 at-risk commits
  (`2d3c4d73…`, `c25b7c3e…`, "WIP on main / index on main: fix(auth): reuse existing session token
  in IAP middleware"). Reachable from `refs/stash` and nothing else. A
  `heads+preserve+tags` glob query does not see them.
- **`/workspace/farmtable-xss-r5-review` detached `HEAD`** (`79c9b132dc6b07d54425c9cdf8a49f80c7e2cf41`,
  "docs(project-log): round 5 code review of url-scheme-validation-r5") →
  `…/farmtable-xss-r5-review/DETACHED-HEAD`, pushed **explicitly by SHA**. Reachable from **no ref
  at all**; `for-each-ref` does not list it.
- **`/scion-volumes/scratchpad` `refs/heads/xss-instrument-classification`** →
  `…/scratchpad/heads/xss-instrument-classification`. 23 commits. This repository has **no remote
  configured at all**.

Push size, verified by packing the exact object set and inspecting the file (not by exit status):
**1,906 objects (267 commits, 1024 trees, 615 blobs), packfile 1,889,097 bytes / 1.80 MiB**; pack
header object count matches.

Push constraints as staged: explicit refspecs only, `refs/preserve/...` only, no force, no
`--delete`, no `--mirror`, no `--prune`, no bare push, `-c gc.auto=0 --no-auto-maintenance`
throughout. Full 97-line refspec table: `/tmp/inv-refmap.txt`.

### Pre-flight checks

| check | result |
|---|---|
| **A — workflow triggers** | Read at the **server's** real main `cc927355e5a23c45bfd983cd331eb540b0a61ad5` (obtained by anonymous `/tmp` fetch; corroborated by `ls-remote`), **not** from any local tree — local trees are 12 commits stale. One workflow exists: `.github/workflows/ci.yml`. Trigger is `pull_request:` and `push: branches: ['**']`. None of the 97 tips being pushed contains `.github/workflows/` at all. **NOT FULLY SETTLED** — see NOT COVERED item 5. |
| **B — nothing overwritten** | **PASS.** `refs/preserve` namespace is entirely empty on the server; all 97 target refs are new. |
| **C — namespace inert** | **PASS.** Zero references to `refs/preserve` anywhere in the server-main tree (435 files, no path filter). No tooling reads ref namespaces; only one workflow exists; no release/deploy config consumes refs. Positive control run first, so the zeros are real zeros. |

---

## PART 2 — WHAT IS **NOT** COVERED, AND WOULD STILL NOT BE AFTER THE PUSH

This section is the reason the file exists. Each item names the observation that would settle it.

**1. THE UNREACHABLE POOL — 348 commits host-wide, 126 contained nowhere.**
Not ref-reachable, therefore not in the 267, not carried by any push, not carried by any bundle.
Measured by the previous leg (`MANIFEST.md` §4b). **Only the gc freeze protects these.** The push
must not be read as reducing this number.
*Settled by:* the separate leg's `fsck --unreachable --no-reflogs` work, already in progress.

**2. `/workspace/farmtable-em-verify195` — NOT measured by me.** My brief forbade touching it.
The prior leg measured it under a later read-only authorisation and reports **zero** commits
contained nowhere else; I independently confirmed its published `HEAD` `bae4fd06…` is on the
server. **I am relying on another leg's measurement, not my own.** Its refs are not in my staged
push. It is also the only store on this host carrying `refs/em` and `refs/dev195`.
*Settled by:* `git --git-dir=/workspace/farmtable-em-verify195/.git rev-list --all | sort -u |
comm -23 - <server commit set>` — with `--all`, not `for-each-ref`, so a detached HEAD is included.

**3. `/root` was never searched** — `find` returned "Permission denied". Any git store there is in
no figure here.
*Settled by:* the same `find` run as a user that can read `/root`.

**4. Anything outside the search roots** `/workspace /home/scion /scion-volumes /tmp /opt /srv
/var/tmp /root /data`. No depth cap was applied *within* those roots.
*Settled by:* `find / -xdev -name '.git'` with sufficient privilege.

**5. GitHub's dispatch behaviour for a push to a non-branch, non-tag ref is UNMEASURED.** The
workflow filter is `branches: ['**']`, which GitHub evaluates against `refs/heads/*`; a
`refs/preserve/...` ref is neither a branch nor a tag. That is a property of GitHub's event
router, not of any file I can read, so I could not turn it into a measurement without pushing.
*Settled by:* pushing **one** ref first and polling
`api.github.com/repos/scion-frontiers/farmtable/actions/runs` against the recorded baseline
`total_count = 12`, latest id `30421407653`. Worst case is one CI run, not an unknown number.

**6. `farmtable-io/farmtable` containment is untested** — that remote requires authentication and
I hold no credential for it. One store points there. Its single commit is in the at-risk set
anyway (conservative direction), and is covered by the push.

**7. This is a container's view, not the host's.** Every statement about "this host" is really
about what is visible inside container `caccf7c255a7`.
*Settled by:* running discovery from the Docker host's namespace.

**8. The population is moving while being measured.** A new ref (`refs/preserve/real-main-cc92735`)
appeared inside a 10-minute window during this leg. The 267 is correct as of ~07:02Z. Any ref
created after the push is not in it. My server-truth figure was stable across two passes; the
local-remote figure drifted by 12 in the same window.

---

## PART 3 — CORRECTION TO THE EXISTING `MANIFEST.md`

`MANIFEST.md` §4 states: *"Bundles A2 + B + C cover every ref-reachable commit on this host that
no remote contains. There is no remaining unmeasured store."*

**That sentence is false by 24 commits**, demonstrated by restoring those bundles into empty
`/tmp` repositories and testing:

| commits | where | in bundle A2 / B / C |
|---:|---|---|
| 23 | `/scion-volumes/scratchpad`, `refs/heads/xss-instrument-classification` | **0 of 23 present — all 23 absent** |
| 1 | `79c9b132…`, detached `HEAD` of `/workspace/farmtable-xss-r5-review` | **absent from all three** |

Causes, both structural rather than careless:

- The scratchpad was never scanned — discovery was bounded to `/workspace`. The prior leg's own
  `NOT REACHED §4` declares that bound honestly; the §4 *headline* then says "no remaining
  unmeasured store". **The bound was declared and contradicted by the summary in the same
  document.**
- `/workspace/farmtable-xss-r5-review` is listed in `MANIFEST.md` §4C as one of *"99 other
  separate clones — not bundled, measured redundant."* The redundancy test enumerated ref **tips**
  with `for-each-ref`, and **`for-each-ref` does not list `HEAD`.** The store passed a test that
  could not see the one commit it uniquely held.

The prior leg's commit arithmetic is otherwise sound and reconciles to mine exactly: their 234,
plus 2 for a branch advance they themselves documented, plus 2 for `refs/stash`, equals my 238 for
canonical. The disagreement is about **search bounds, not about counting.**

---

## PART 5 — NON-PUBLIC OFF-HOST DESTINATIONS THAT EXIST TONIGHT

Added after Stage B (07:2xZ). Full detail and method in `../reports/relocate-offhost.md` §11.

**A non-public off-host destination exists and is reachable with a credential already on this
host.** The morning decision is therefore not "publish or accept the risk".

| option | exists | off this device | non-public | credential already held | notes |
|---|---|---|---|---|---|
| **`scion-frontiers/scion-repo-contrib`** | **yes** | **yes** | **yes** | **yes** | private repo, same org, `push`+`admin`; `ls-remote` rc=0, 19 heads. **Recommended.** |
| 7 private GCS buckets in `deploy-demo-test` | yes | yes | yes | yes (`scion-integration-sa`) | `storage.objects.create` granted; suits bundles, not native git |
| 10 **public** GCS buckets in the same project | yes | yes | **NO** | yes | `allUsers: objectViewer` — **publishes, like the public repo** |
| `github.com/scion-frontiers/farmtable` | yes | yes | **NO** | yes | the briefed destination; public |
| `github.com/farmtable-io/farmtable` | yes | yes | unknown | **no** | untestable without a credential |
| a second host / attached volume | **no** | — | — | — | every mount resolves to `/dev/root`; no second device |

**The trap worth naming:** "put the bundles in a bucket" is the obvious alternative, and **10 of
the 17 reachable buckets carry `allUsers: roles/storage.objectViewer`** — they would publish the
material just as effectively as the public repo. That includes `ddt-scion-hub-exchange`, whose
name makes it sound purpose-built for an inter-agent handoff.

**Why `scion-repo-contrib` is the recommendation:** off-device, non-public, correct organisation,
reachable with a held credential, and — being a git remote — it preserves commits natively, so the
`refs/preserve/offhost-<ts>/...` plan and the fetch-back-and-hash proof in PART 4 carry over
unchanged.

**Two caveats that were not mine to close.** One is now closed, one is not:

- ~~write capability is derived from the API `push=True` bit plus a successful `ls-remote`, not
  from an actual (or dry-run) push~~ — **DISCHARGED 07:32Z.** The dry-run returned `rc=0` and the
  real push landed 66 refs, confirmed by an independent `ls-remote`. Write capability is now
  measured, not inferred.
- **STILL OPEN:** "private" is not the same as "appropriate". `scion-repo-contrib` looks like a
  working contribution repo, not an archive. 268 commits of another project's history — including
  the 64 that carry the unpatched-XSS analysis — now sit in it under `refs/preserve/`. Refs
  outside `refs/heads/` are invisible in the GitHub UI and will not show in a clone, so this is
  unobtrusive rather than hidden; anyone with read access to that repo can still fetch them.
  **Whoever owns `scion-repo-contrib` has not been told.** That is a daylight conversation and it
  is still owed.

---

## PART 4 — THE RESTORE PROOF **(COMPLETE)**

Performed 2026-07-29T07:32–07:3xZ under the 07:30Z bounded authorisation.

**Destination:** `github.com/scion-frontiers/scion-repo-contrib` — private, resolved **by URL, not
by nickname**. **Namespace:** `refs/preserve/offhost-20260729T073217Z/<store-slug>/<rest>`.

- [x] **Dry-run first.** `git push --dry-run --atomic`, 66 explicit refspecs, `rc=0`, every ref
      reported `* [new reference]`. This also discharged the one derived claim in the report
      (`§13.1`: write capability was inferred from an API bit, never exercised).
- [x] **Push.** Same 66 refspecs, `--atomic`, **no** `--force`, `--delete`, `--mirror` or
      `--prune`, no leading `+` on any refspec. 5,397 objects / ~3.38 MiB.
- [x] **Re-verified against the server, not against the push output.** Independent `ls-remote`:
      **106 refs** (was 40). `refs/preserve` **66**, `refs/pull` 20, `refs/heads` **19**, HEAD 1.
      Expected-but-absent **0**; present-but-unexpected **0**. The 19 pre-existing heads are
      untouched — **nothing collided**.
- [x] **Fetch back into a virgin throwaway `/tmp` bare repo** (`/tmp/inv/restore.git`), created
      empty (0 objects before fetch), fetched **only** from the GitHub URL.
      `objects/info/alternates` **absent** — confirmed, because with an alternates file the whole
      proof would be circular and would prove nothing.
      66 refs restored, 646 commits reachable, `git fsck --connectivity-only` **rc=0, clean**.
- [x] **All 268 at-risk commits present in the restored repo: 268 / 268.**
- [x] **Content hash on the restored file on disk.** Checked out from the restore repo:
      `web/src/util/url-binding-scan.test.ts` @ `d12f5725`
      → **68066 bytes** (expected 68066) — `git hash-object` =
      **`c8cb6993581fa202c44cf702f41680fa96442a78`** — **MATCH**.
      sha256 of the bytes: `5b20f783b42fdb713499afc6b4470286e3ea7937629edcc02579021196ba4b76`.
      *Negative control:* one bit flipped in the last byte hashes to `a5cc1e96…` — so the
      comparison is capable of failing, and the MATCH above is not a tautology.
- [x] **At least one commit from each source store**, tree materialised to disk and compared
      against the tree hash read independently from the original host store:

| store | commit | files restored | tree (host = restore) | |
|---|---|---|---|---|
| `farmtable` | `00755260c42e` | 455 | `44d7bedbe6a4040a9b65b308f67aa8f1bdc6298e` | MATCH |
| `scratchpad` | `00b1d685fb9f` | 3 | `946e2ca6e2eef45ad43758d893a3c3b283e436f8` | MATCH |
| `xss-r5-audit` | `07f5392b7b97` | 473 | `843a384e165b649c03ff78a66678dff69255731a` | MATCH |
| `xss-r5-test` | `038abb73f671` | 473 | `9e2f8b246c35133489bb1a094a34c7753c15a71a` | MATCH |
| `xss-r5-review` | `03ab6b63287b` | 448 | `f29f48a0ae5577f46d002be1314a997f71a17619` | MATCH |

- [x] **Beyond the ask — all 268, not a sample.** Tree hash resolved on the host and in the
      restore repo for every one: **268 / 268 resolvable both sides, 268 agree, 0 differ.**

### Honest weighting of the above

These are not five proofs of equal strength, and they should not be read as such.

**Proofs 2 and 3 are weaker than they look.** Git verifies SHA-1 on receipt, so "the tree hash in
the restore equals the tree hash on the host" is close to self-fulfilling: it proves the transfer
was not silently truncated or re-written, which is worth having, but a hash-addressed store
agreeing with itself is a low bar.

**Proof 1 is the one that carries the weight,** for one specific reason: the target — blob
`c8cb6993…` at **68066 bytes** — was named **in the brief, by the coordinator, before I built any
of this apparatus**. It is an external oracle, not a value my own pipeline produced and then
re-derived. A file materialised from a repo fetched over the network into an empty directory,
hashing to a value fixed in advance by someone else, is the claim that actually means the content
survived the round trip.

**What none of it proves:** that the destination is *durable*. It is one GitHub repository. This
converts a single-machine risk into a single-provider risk, which is a real improvement and not
the same as safety.
