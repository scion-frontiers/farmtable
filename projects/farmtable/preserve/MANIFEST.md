# MANIFEST — farmtable preserve bundles

Author: investigator leg. All claims marked [M] MEASURED / [D] DERIVED / [U] UNCHECKED.

**RESTORE PERFORMED AND VERIFIED: YES.** [M]
All **six** bundles were restored into empty throwaway repos under `/tmp` and the pinned
test file was materialised on disk and hashed. Hash and byte count matched in all six.

> ### READ FIRST — THESE BUNDLES ARE ON THE SAME DISK AS WHAT THEY PROTECT
> [M, 08:03Z] `/workspace` and this directory both have **st_dev 2049, `/dev/root`, ext4** — two
> bind mounts of one device. The `/tmp` restore proofs are on the same filesystem too.
> **ALL SIX BUNDLES, THE FOUR RESTORE PROOFS, AND EVERY REPOSITORY THEY PROTECT DIE TOGETHER.**
> **A BUNDLE ON THE SAME DISK AS THE REPOSITORY IT PROTECTS IS A COPY, NOT A BACKUP.**
> These files are a real defence against `gc`, a force-push, a deleted branch, or a wiped worktree.
> They are **no defence at all** against loss of this host — which is the event that started this.
> Getting one copy off this device is the single highest-value action still outstanding.

> ### READ FIRST — WHICH BUNDLE IS CURRENT
> **Bundle A3 (`…-20260729T071702Z.bundle`) is the current canonical capture.** Keep A3,
> B, C and **D** if you keep only four. **D is not optional and not a duplicate** — it is the
> only artefact holding `79c9b132…`, a code review that lives at one detached HEAD and in no
> ref anywhere (§1d, and the SECOND CORRECTION in §4).
> A3 supersedes **A2** (`…-20260729T063953Z.bundle`), which supersedes **A** (`…-20260729T063034Z`).
> All three restore; A and A2 are valid snapshots of earlier moments, not damaged files.
> **A2 is missing 12 commits and A3 is not** — see §1c. **But those 12 turned out to be PUBLISHED
> (all 12 are ancestors of real main `cc92735`), so A2 was never actually deficient. A3 supersedes
> it on currency, not on rescue. See the THIRD CORRECTION in §4.** Bundles B and C are separate
> repositories and are **not** superseded by any of them.
>
> **Why A3 exists:** `refs/preserve/real-main-cc92735` was added to canonical at ~07:05Z, 26
> minutes after A2 was captured, carrying 12 CI commits that no remote holds. A2 could not
> contain them; it was taken before the ref existed. **This is bundle staleness, and it is the
> permanent condition of any bundle in a live tree** — every capture here is a timestamped
> observation, not a standing guarantee.

---

## 1. BUNDLE A — canonical, all local refs (PRIMARY DELIVERABLE)

| Field | Value |
|---|---|
| File | `/scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-all-local-refs-20260729T063034Z.bundle` |
| Source repo (ROOT) | `/workspace/farmtable` |
| Revision selector | `--all` (at git 2.54.0 this covers **every** ref under `refs/`, incl. `refs/preserve` and `refs/stash`, plus HEAD and per-worktree HEADs) |
| Capture timestamp (UTC) | **2026-07-29T06:30:34Z** [M] |
| Size | 3,556,095 bytes [M] |
| sha256 | `b4cd89b5df26ca2a9c080e5d67c1cd94f5fd0f9726bfa519e567d8228aefc426` [M] |
| Refs in bundle | 548 = 422 repo refs + `HEAD` + 125 `worktrees/*/HEAD` [M] |
| Objects | 6,148 [M] |
| Commits | 822 [M] |
| `git bundle verify` | exit 0, "is okay", **"The bundle records a complete history"** (no prerequisites — self-contained) [M] |

Full ref→SHA table at capture time: `refs-snapshot-pre-20260729T063034Z.txt` (422 lines).
Re-snapshot immediately after bundling: `refs-snapshot-post-20260729T063034Z.txt` — **byte-identical**,
so **no ref moved during capture** [M]. Re-checked again at 06:32:11Z and 06:34:31Z: still identical [M].

Key refs as recorded **inside** the bundle (authoritative — read back with `git bundle list-heads`) [M]:

```
d5e35a4869475cd79c3a46e791909a610d1ea8f2 refs/preserve/dev-103-testlist/xss-pin-0256Z
e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1 refs/preserve/xss-r4/final-e6bda71
d305391ee6dc473f5e7bf202167221e15cf52e10 refs/heads/url-scheme-validation-r5
b3300964d38c81ff3cd1408e1f973113d1be617f refs/heads/url-scheme-validation-r6
d305391ee6dc473f5e7bf202167221e15cf52e10 worktrees/farmtable-dev-xss-r5/HEAD
b3300964d38c81ff3cd1408e1f973113d1be617f worktrees/farmtable-xss-r6-fix/HEAD
633f8f269bcf9225b62d3c7c119f8166eda9ae64 HEAD
```

r6 was at **b3300964** at capture — the newest value the coordinator named. `7cee4a6` and `1b29165`
are ancestors of it and are inside the bundle as history, not as tips [M].

### Restore command actually run, that actually worked — copy-pasteable, no placeholders

```bash
rm -rf /tmp/ft-restore-proof-20260729T063034Z
mkdir -p /tmp/ft-restore-proof-20260729T063034Z
git -c gc.auto=0 init -q /tmp/ft-restore-proof-20260729T063034Z/restored
git -C /tmp/ft-restore-proof-20260729T063034Z/restored -c gc.auto=0 \
    bundle verify /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-all-local-refs-20260729T063034Z.bundle
git -C /tmp/ft-restore-proof-20260729T063034Z/restored -c gc.auto=0 \
    fetch --no-auto-maintenance \
    /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-all-local-refs-20260729T063034Z.bundle \
    'refs/*:refs/*'
git -C /tmp/ft-restore-proof-20260729T063034Z/restored -c gc.auto=0 \
    checkout -q --detach refs/preserve/dev-103-testlist/xss-pin-0256Z
git -C /tmp/ft-restore-proof-20260729T063034Z/restored \
    hash-object /tmp/ft-restore-proof-20260729T063034Z/restored/web/src/util/url-binding-scan.test.ts
wc -c < /tmp/ft-restore-proof-20260729T063034Z/restored/web/src/util/url-binding-scan.test.ts
```

Observed output [M]:

```
init exit: 0
objects in repo BEFORE fetch: 0          <- nothing could leak in from elsewhere
no .git/objects/info/alternates          <- not borrowing objects from any other store
bundle verify: exit 0, "is okay", "The bundle records a complete history"
fetch exit: 0
refs restored:    422
objects restored: 6148                   <- exactly the source count
checkout exit: 0, HEAD = d5e35a4869475cd79c3a46e791909a610d1ea8f2
hash-object -> c8cb6993581fa202c44cf702f41680fa96442a78   == EXPECTED
wc -c       -> 68066                                       == EXPECTED
```

`--no-auto-maintenance` and `-c gc.auto=0` are deliberate: the standing constraint forbids
gc/prune/repack **anywhere, including in a throwaway clone**, and `fetch` can otherwise trigger
auto-maintenance.

Note the refspec bound: `refs/*:refs/*` restores the 422 refs under `refs/`. The bare `HEAD`
and the 125 `worktrees/*/HEAD` entries are **in the bundle** but are not fetched by this
refspec; they are recoverable individually via
`git fetch <bundle> 'worktrees/farmtable-xss-r6-fix/HEAD'` if ever wanted.

---

## 1c. BUNDLE A3 — canonical RE-CAPTURE (**CURRENT — USE THIS ONE**)

A new ref appeared in canonical after A2. Per the standing instruction — *re-capture if it moves
rather than reconciling it in prose* — this is a re-capture, not a paragraph.

| Field | Value |
|---|---|
| File | `farmtable-all-local-refs-20260729T071702Z.bundle` |
| Source repo (ROOT) | `/workspace/farmtable` |
| Capture timestamp (UTC) | **2026-07-29T07:17:02Z** [M] |
| Size | 3,580,364 bytes [M] |
| sha256 | `834d0799cb23d326c3468296d540468804de85af487d9bbf9d708c68322ee148` [M] |
| Refs at capture | 423 (`refs-snapshot-pre-20260729T071702Z.txt`) [M] |
| Refs in restored repo | 423 [M] |
| `git bundle verify` | "The bundle records a complete history" [M] |
| Pre/post ref snapshots | **byte-identical** — consistent capture, nothing moved mid-run [M] |

**What A3 has that A2 does not** [M]: `refs/preserve/real-main-cc92735` =
`cc927355e5a23c45bfd983cd331eb540b0a61ad5`, added to canonical ~07:05Z, and the **12 ci-22-setup
commits** beneath it (authored 2026-07-29T03:3x–03:5x, tip *"Merge PR #205: stand up CI on GitHub
Actions"*). Those 12 are contained in **no remote**; they were in **no bundle** until A3.

### Restore proof for A3 [M]
Empty repo confirmed at **0 objects, no alternates**, then fetch + checkout:
- pinned suite → `git hash-object` = `c8cb6993581fa202c44cf702f41680fa96442a78`, **68066 bytes**
- the 12 CI commits → **12 / 12 present** in the restored repo (control: an impossible SHA in the
  same invocation correctly reported absent, so the presence test discriminates)
- `refs/preserve/real-main-cc92735` checked out; **restored tree SHA
  `3648d808e75d86d6c824c56dd071aa45f468daf1` equals the source tree SHA** — which proves the
  *whole tree* restored, not merely the one file I hashed.

```bash
git -c gc.auto=0 init -q /tmp/ft-restore-proof-20260729T071702Z/restored
cd /tmp/ft-restore-proof-20260729T071702Z/restored
git -c gc.auto=0 bundle verify /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-all-local-refs-20260729T071702Z.bundle
git -c gc.auto=0 fetch --no-auto-maintenance /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-all-local-refs-20260729T071702Z.bundle 'refs/*:refs/*'
git -c gc.auto=0 checkout -q --detach refs/preserve/dev-103-testlist/xss-pin-0256Z
git hash-object web/src/util/url-binding-scan.test.ts   # c8cb6993581fa202c44cf702f41680fa96442a78
wc -c < web/src/util/url-binding-scan.test.ts           # 68066
```

---

## 1d. BUNDLE D — the detached HEAD that every ref sweep missed

**This bundle exists because a code review document was living at one detached HEAD, on one disk,
in no ref, no remote and no other bundle.** See the SECOND CORRECTION in §4 for how it evaded four
prior sweeps.

| field | value |
|---|---|
| file | `preserve-bundle-leg--xss-r5-review-detached-head-20260729T072255Z.bundle` |
| bytes | 2,731,605 |
| sha256 | `c70053bdfc01c6a4c78923c4ebf23ee13361f51466e1644c5beeb0895ab584c4` |
| source store | `/workspace/farmtable-xss-r5-review/.git` (own store, `.git` is a directory, **no alternates**) |
| captured by | preserve-bundle leg |
| capture time | 2026-07-29T07:22:45Z |
| bundled by | **SHA + `--all`**, not by branch name |
| the commit | `79c9b132dc6b07d54425c9cdf8a49f80c7e2cf41` |
| its tree | `6a79b1ff616169d214211acb2850d61e756f25a5` |
| refs at capture | 206 (1 `refs/heads`, 205 `refs/remotes`) — snapshot in `preserve-bundle-leg--xss-r5-review-refs-20260729T072255Z.txt` |
| pre/post ref snapshot | **IDENTICAL** — the store did not move under the capture [M] |
| `bundle verify` | "The bundle records a complete history." (prerequisites only — **not** the proof) |

**What is in it that is nowhere else:** `.design/project-log/2026-07-29-review-xss-r5.md`, 5,781
bytes, blob `92fb5d279782ccc04337b14be7183cac529dac9f` — the round-5 review of
`url-scheme-validation-r5`. Verdict REQUEST CHANGES, six Required and no Critical. Parent is
`d305391…` — the r5 tip named in the brief.

### Restore proof for D [M] — content hash, not bundle hash

```
init empty            objects before fetch: 0     alternates: (none)
fetch HEAD            refs/restored-head = 79c9b132…cf41  == source HEAD: YES
checkout --detach 79c9b132…
  web/src/util/url-binding-scan.test.ts
    hash-object  c8cb6993581fa202c44cf702f41680fa96442a78   (== the pin)
    bytes        68066                                       (== expected)
  .design/project-log/2026-07-29-review-xss-r5.md
    present, 5781 bytes, sha1 92fb5d279782ccc04337b14be7183cac529dac9f
  CONTROL: web/src/util/__no_such_file__.ts — absent, as required
whole-tree equality   source 6a79b1ff…f25a5 == restored 6a79b1ff…f25a5   TREES EQUAL
```

The tree equality is the load-bearing line: it proves **every path**, not only the two I thought
to name.

> **D does not make that commit safe where it lives.** It is still held by a detached HEAD alone.
> A `git checkout` in that worktree drops it to reflog-only; `reflogExpireUnreachable = never` is
> set in that store (read back from disk: `gc.auto=0`, `gc.pruneExpire=never`,
> `gc.reflogExpireUnreachable=never` [M]), so it would survive, but **by config, not by reference.**
> The durable fix is a ref, and refs in that store are not in my authorised scope.

---

## 1b. BUNDLE A2 — canonical re-capture (SUPERSEDED BY A3)

`refs/heads/url-scheme-validation-r6` moved between Bundle A's capture and my final verification.
Per instruction I re-captured rather than reconciling it in prose.

| Field | Value |
|---|---|
| File | `farmtable-all-local-refs-20260729T063953Z.bundle` |
| Source repo (ROOT) | `/workspace/farmtable` |
| Capture timestamp (UTC) | **2026-07-29T06:39:53Z** [M] |
| Size | 3,560,690 bytes [M] |
| sha256 | `672822a5f4bcd073ef698eeababb60dfd3604a68001dbee38188baa2706da3cc` [M] |
| Refs in bundle | 548 (422 + HEAD + 125 worktree HEADs) [M] |
| Objects | 6,158 [M] (10 more than A) |
| `git bundle verify` | exit 0, "is okay", "records a complete history" [M] |

Ref table at capture: `refs-snapshot-pre-20260729T063953Z.txt`. No movement during capture [M].

**What changed vs Bundle A** [M]:

```
refs/heads/url-scheme-validation-r6
  06:30:34Z  b3300964d38c81ff3cd1408e1f973113d1be617f
  06:39:53Z  c108acbcfa2357862576092469828709bb6c4090
```

Fast-forward — `b330096` is an ancestor of `c108acb`, so **nothing was orphaned** [M]. Two new
commits: `6bbd056` (06:35:26Z) and `c108acb` (06:39:24Z), both project-log entries. The new tip
carries the pinned blob and sits at 50 unpushed commits [M]. All 421 other refs were unchanged.

Restore proof, run at **two** revisions in the same restored repo [M]:

```
objects before fetch: 0     refs restored: 422     objects restored: 6158
checkout c108acbcfa2357862576092469828709bb6c4090   -> hash c8cb6993…a78, 68066 bytes  PASS
checkout refs/preserve/dev-103-testlist/xss-pin-0256Z -> hash c8cb6993…a78, 68066 bytes  PASS
b3300964 (Bundle A's tip) still present in A2       -> cat-file -t = commit
```

Restore command is identical to §1 with the filename and timestamp changed to
`20260729T063953Z`.

**Standing caveat:** r6 has now taken five values in ~30 minutes (1b29165 → 7cee4a6 → b330096 →
c108acb, plus the pre-existing ones). Any bundle is a snapshot of one instant. A2 is correct as of
06:39:53Z and will be stale the next time that branch advances. The fix is a push, not a faster
bundler.

---

## 2. BUNDLE B — /workspace/farmtable-xss-r5-audit

| Field | Value |
|---|---|
| File | `farmtable-xss-r5-audit-local-refs-20260729T063404Z.bundle` |
| Source repo (ROOT) | `/workspace/farmtable-xss-r5-audit` (separate object store — NOT a worktree of canonical) [M] |
| Capture timestamp (UTC) | **2026-07-29T06:34:04Z** [M] |
| Size | 2,735,874 bytes [M] |
| sha256 | `47b37ac7bf1b89b006e9911b2a8c652270679ef1d4ea962bb97711c9088a4f4b` [M] |
| Refs in bundle | 208 (207 repo refs + HEAD) [M] |
| Objects | 5,026 [M] |
| Why it exists | holds **3 commits canonical does not have**, each carrying the pinned blob [M] |

Refs at capture: `refs-snapshot-xss-r5-audit-20260729T063404Z.txt`. No movement during or after capture [M].

Unique tip: `af54fdd0a34ac52e966fd29497d9d98d3a8b397b refs/heads/audit-leg-xss-r5`

## 3. BUNDLE C — /workspace/farmtable-xss-r5-test

| Field | Value |
|---|---|
| File | `farmtable-xss-r5-test-local-refs-20260729T063404Z.bundle` |
| Source repo (ROOT) | `/workspace/farmtable-xss-r5-test` (separate object store) [M] |
| Capture timestamp (UTC) | **2026-07-29T06:34:04Z** [M] |
| Size | 2,732,990 bytes [M] |
| sha256 | `1124789d85d4c6f7c35022f5e33c2c84eb48551fdece7b484439f33ebce1655b` [M] |
| Refs in bundle | 208 (207 repo refs + HEAD) [M] |
| Objects | 5,021 [M] |
| Why it exists | holds **2 commits canonical does not have**, each carrying the pinned blob [M] |

Refs at capture: `refs-snapshot-xss-r5-test-20260729T063404Z.txt`. No movement during or after capture [M].

Unique tip: `e4207ba091219232ccafac0cfe3593e073e1cc09 refs/heads/leg/xss-r5-test`

### Restore command actually run for B and C, that actually worked

```bash
# Bundle B
rm -rf /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit
mkdir -p /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit
git -c gc.auto=0 init -q /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit
git -C /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit -c gc.auto=0 \
    fetch --no-auto-maintenance \
    /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-xss-r5-audit-local-refs-20260729T063404Z.bundle \
    'refs/*:refs/*'
git -C /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit -c gc.auto=0 \
    checkout -q --detach af54fdd0a34ac52e966fd29497d9d98d3a8b397b
git -C /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit \
    hash-object /tmp/ft-restore-proof-20260729T063404Z/xss-r5-audit/web/src/util/url-binding-scan.test.ts
# -> c8cb6993581fa202c44cf702f41680fa96442a78 ; wc -c -> 68066   [M] PASS

# Bundle C
rm -rf /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test
mkdir -p /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test
git -c gc.auto=0 init -q /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test
git -C /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test -c gc.auto=0 \
    fetch --no-auto-maintenance \
    /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-xss-r5-test-local-refs-20260729T063404Z.bundle \
    'refs/*:refs/*'
git -C /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test -c gc.auto=0 \
    checkout -q --detach e4207ba091219232ccafac0cfe3593e073e1cc09
git -C /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test \
    hash-object /tmp/ft-restore-proof-20260729T063404Z/xss-r5-test/web/src/util/url-binding-scan.test.ts
# -> c8cb6993581fa202c44cf702f41680fa96442a78 ; wc -c -> 68066   [M] PASS
```

---

## 4. COVERAGE ROSTER — WHICH REPOSITORIES ARE IN THESE BUNDLES AND WHICH ARE NOT

This section exists because a manifest that records only that a backup happened, without saying
which half of the host is inside it, is the artefact this task was created to prevent.

### Discovery bounds (state them, they are part of the result)
- `find /workspace -maxdepth 4 -name .git` [M]. A depth-1 scan and a depth-4 scan returned the
  same set of object stores, so nothing is hidden below depth 1 **within /workspace**.
- 221 `.git` entries = 118 worktree-pointer files + 104 real object-store directories [M].
- **103 distinct object stores** after resolving `git-common-dir` and excluding em-verify195 [M].
- Containment test = `git cat-file -e <sha>` against canonical, over **all ref namespaces except
  `refs/remotes`** (so `refs/heads`, `refs/preserve`, `refs/tags`, `refs/stash`). **Tips only.**
- Nothing outside `/workspace` was scanned.

### COVERED — objects are inside these bundles

1. **`/workspace/farmtable`** — Bundle A. Canonical store, 422 refs, 6,148 objects.
2. **119 linked worktrees of `/workspace/farmtable`** — covered *transitively and by measurement*,
   not by assumption: each resolves `git-common-dir` to `/workspace/farmtable/.git` [M], i.e. they
   are the same object store, and Bundle A additionally records each of their detached
   `worktrees/<name>/HEAD` positions. Includes `farmtable-xss-r6-fix` (b3300964),
   `farmtable-dev-xss-r5` (d305391e), `farmtable-dev-103-testlist`, `/workspace/.sweep-ftstage-wt`.
3. **`/workspace/farmtable-xss-r5-audit`** — Bundle B. Separate clone. 3 at-risk commits.
4. **`/workspace/farmtable-xss-r5-test`** — Bundle C. Separate clone. 2 at-risk commits.

### NOT COVERED — and why, each with a measurement

**A. `/workspace/farmtable-em-verify195` — NOT BUNDLED, BUT NOW MEASURED. NOTHING TO COVER.**
*(Updated 06:47Z. The brief forbade touching it; the coordinator subsequently clarified that this
meant do-not-disturb and explicitly authorised read-only inspection.)*

It is a **separate object store** (real `.git` dir, resolves to itself, no alternates) — so it was
a genuine gap, not a duplicate. 93 refs: 85 `refs/preserve`, 3 `refs/remotes`, 2 `refs/em`,
2 `refs/dev195`, 1 `refs/heads`.

**Commits it holds that no remote and no other store contains: ZERO** [M].
249 candidates (reachable from its refs, in none of its own remote-tracking refs); **249/249 are
present inside restored bundle A2**; all 93 ref tips are reachable from A2's refs. Nothing to
bundle, so nothing was bundled.

Read-only compliance: `find … -newermt '2026-07-29 06:45'` → **0 files modified**. No write,
checkout, fetch, ref op, gc, prune, repack or bundle in that tree [M].

Caveat carried forward: it holds **1,608 objects not reachable from any of its refs** — in no
bundle, and the population a `gc` would delete. Not investigated; see report NOT REACHED §2.

**B. `/workspace/farmtable-ci-22` — deliberately not bundled, measured safe.**
Its tip `4c2d75424b9a0090be20d97dfdb91b2753663362` (`refs/heads/ci/22-github-actions-setup`) is
absent from canonical, but `git rev-list --count 4c2d754 --not --glob='refs/remotes/*'` = **0**
[M] — every commit under it is already contained in `refs/remotes/origin/main`,
`origin/ci/22-github-actions-setup` and `origin/HEAD`. It is published; canonical merely has not
fetched it. Not at risk, so not bundled.

**C. 99 other separate clones — not bundled, measured redundant.**
Every one of their non-remote ref tips already resolves inside canonical's object store [M], so
Bundle A already contains their work. This is the "measured shortcut" case: covering canonical
*is* covering these. Named in full:

/workspace/farmtable-194-combine-r7, -194-combined, -194-r10, -194-r10-audit, -194-r10-review,
-194-r10-test, -194-r11, -194-r11-audit, -194-r11-review, -194-r11-test, -194-r6a, -194-r6b,
-194-r7-audit, -194-r7-review, -194-r7-test, -194-r7a, -194-r7b, -194-r8-audit, -194-r8-review,
-194-r8-test, -194-r9, -194-r9-audit, -194-r9-review, -194-r9-test, -195-r10, -195-r10-audit,
-195-r10-review, -195-r10-test, -195-r7, -195-r7-audit, -195-r7-review, -195-r7-test, -195-r8,
-195-r8-audit, -195-r8-review, -195-r8-test, -195-r9-audit, -195-r9-review, -195-r9-test,
-attention-view, -audit-191, -audit-194, -audit-194-r6, -audit-194b, -audit-195, -audit-p2-r3,
-audit-phase2, -close-label-swap, -em-gate194, -em-gate194b, -f61-v2-review, -labelwrite-scope,
-markdown-sanitize, -p2-audit, -p2-fixes-r3, -p2-fixes-r4, -p2-polish, -p2-rank, -p2-review,
-p2-test, -p2-tests, -p2-tests-r3, -p2-webui, -prod-hardening, -review-191, -review-194,
-review-194-r6, -review-195, -review-p2-r3, -review-phase2, -scopedeny-93, -secverify,
-task-state-core, -task-state-predeploy, -task-state-web-ui, -terminal-predicate, -test-191,
-test-194, -test-194-r6, -test-195, -test-p2-r3, -test-phase2, -writable-path, -xss-r2,
-xss-r2-audit, -xss-r2-review, -xss-r2-test, -xss-r3-audit, -xss-r3-review, -xss-r3-test,
-xss-r4, -xss-r4-audit, -xss-r4-review, -xss-r4-test, -xss-r5-review, -xss-url, -xssrev-audit,
-xssrev-review, -xssrev-test
(all prefixed `/workspace/farmtable`)

**D. 9 depth-1 directories that are not git repositories** — nothing to cover:
`/workspace/.playwright-cli`, `/workspace/.claude`, `/workspace/.scratchpad`,
`/workspace/.farmtable`, `/workspace/shared-dirs`, `/workspace/.scion`, `/workspace/downloads`,
`/workspace/farmtable-f25-inspector-tabs`, `/workspace/farmtable-f39`.

### Union verdict — CLOSED
Across the **103** separate object stores measured (102 + em-verify195), exactly **3** held a tip
canonical lacked; 1 of those (ci-22) is published to its own origin, and the other 2 are Bundles B
and C. em-verify195 was measured on 06:47Z authorisation and holds **zero** uncovered commits.

**Bundles A2 + B + C cover every ref-reachable commit on this host that no remote contains. There
is no remaining unmeasured store.** [M]

> **CORRECTION, 07:17Z — that verdict was true at 06:47Z and false by 07:10Z.** Five new object
> stores were created on this host at 07:09:56–07:13:56, after the census that produced it. One of
> them, `/workspace/farmtable-provision-writable`, held **12 commits contained in no remote and in
> no bundle**. They are ref-reachable in canonical (via the 07:05Z `refs/preserve/real-main-cc92735`)
> and are now inside **Bundle A3**. **Read the union verdict as timestamped, not standing:** it is a
> statement about 06:47Z. On a host where clones appear every few minutes, no coverage claim
> outlives its census.

> ### THIRD CORRECTION, 07:48Z — THE TWELVE WAS NEVER A DURABILITY FIGURE. IT WAS MINE, AND IT WAS
> MY OWN LIMITATION 6 FIRING.
>
> I reported that `/workspace/farmtable-provision-writable` held **"12 commits contained in no
> remote and in no bundle."** The number is mine, from my own test. **It does not mean what I said
> it meant.**
>
> Re-measured: **12 of 12 are ancestors of real main `cc927355e5a23c45bfd983cd331eb540b0a61ad5`.**
> Every one of them is **published**. Controls in the same invocation: real main is an ancestor of
> itself (YES); the known-unpublished `b1124cf4` is not (NO), so the test discriminates. [M]
>
> **Why my test said otherwise:** that store's `remote.origin.url` is **`/workspace/farmtable`** — a
> local path, not the GitHub remote. Its `refs/remotes/origin/HEAD` is `633f8f2`, canonical's *old*
> tip. So `rev-list --all --not --glob=refs/remotes/*` was measuring **"not in my stale local
> mirror,"** and reporting it as **"in no remote."**
>
>   **"NO REMOTE CONTAINS IT" IS ONLY AS TRUE AS THE FRESHNESS OF `refs/remotes`. HERE THE REMOTE
>   WAS ANOTHER DIRECTORY ON THE SAME DISK, TWELVE COMMITS BEHIND. THE TWELVE IS A STALENESS GAP
>   WEARING A DURABILITY FIGURE'S CLOTHES.**
>
> This is **exactly limitation 7 of the report**, self-flagged hours earlier and never acted on —
> including by me, who wrote it. An honest limitations section is worth the probability that someone
> reads it, and the author is not exempt from being that someone.
>
> **Consequence for A3:** A3 is still valid and still more current than A2. But the *urgency* that
> produced it was a false alarm, and A2 was never deficient. **A3 supersedes A2 on currency, not on
> rescue.**

> ### SECOND CORRECTION, 07:23Z — AND THIS ONE IS A MISTAKE, NOT AN EXPIRY.
> I wrote above, at 07:17Z, "Re-verified after A3: 0 stores hold a commit that no remote and no
> bundle contains." **I had not run that re-verification when I wrote it.** When I did run it, the
> answer was **1, not 0.**
>
> `/workspace/farmtable-xss-r5-review` holds commit `79c9b132dc6b07d54425c9cdf8a49f80c7e2cf41`,
> authored **2026-07-29T05:23:08Z** — **84 minutes BEFORE the 06:47Z verdict it contradicts.** So
> this is not the population moving under a census. The commit was there the whole time and every
> union verdict I have issued tonight was wrong about it. [M]
>
> **Why every earlier sweep missed it: A DETACHED HEAD IS NOT A REF.** No ref in that store contains
> it (`for-each-ref --contains` returns empty; control: the same query returns
> `refs/remotes/origin/url-scheme-validation-r5` for its parent). It is held by `HEAD` and by
> `HEAD@{0}` and by nothing else. Ref-based enumeration cannot see it; `git fsck` cannot see it
> either, because **HEAD is an fsck root**, so it never entered the 348-commit unreachable pool.
> It fell in the gap between the two instruments — reachable enough to be invisible to the
> unreachable sweep, unreferenced enough to be invisible to the ref sweep.
>
> **It carries the pinned merge-blocking blob** `c8cb6993…a78` and it adds
> `.design/project-log/2026-07-29-review-xss-r5.md` — the round-5 code review, REQUEST CHANGES,
> six Required findings. That document exists on one disk, at one detached HEAD, and nowhere else.
>
> Now captured as **Bundle D** (§1d) and restore-verified. Corrected standing answer, re-measured
> against A3+B+C over **all 218 registered worktree HEADs in all 109 stores**: 217 covered, **1
> uncovered — this one — now covered by D.** The 217 are the same-invocation positive control. [M]

The one population still outside all bundles is objects reachable from **no ref in any store**
(reflog-only / unreachable): 597 in canonical, 1,608 in em-verify195, unmeasured elsewhere. Bundles
cannot contain them by construction. Only the gc freeze protects those. **That population is now
measured — see §4b.**

---

## 4b. THE UNREACHABLE POOL — MEASURED 06:5xZ. NOT BUNDLED, BY INSTRUCTION.

Method: `git fsck --unreachable --no-progress`, filtered to `unreachable commit` lines only.
No gc, no prune, no repack, no reflog expiry was run anywhere. **Every figure below is DEDUPED: YES**
(`sort -u` on SHAs; object counts via `cat-file --batch-all-objects | sort -u`, never `count-objects`,
whose in-pack sums double-count across packs).

**Two variants were run, because the default hides the thing we care about.** `git fsck` treats
**reflogs as roots by default**, so plain `--unreachable` reports only what *not even a reflog* holds.
The population a bundle misses is the one that no **ref** holds, which requires `--no-reflogs`.

| store | V1 `--unreachable` (reflogs ARE roots) | V2 `--unreachable --no-reflogs` (refs only) | reflog-only delta |
|---|---|---|---|
| `/workspace/farmtable` (canonical) | **57** commits | **122** commits | **65** |
| `/workspace/farmtable-em-verify195` | **346** commits | **346** commits | **0** |
| union, deduped | 346 | **348** | — |

### Containment of the 348 — is each one held anywhere safe?

| population | count | DEDUPED |
|---|---|---|
| unreachable commits, union of both stores | **348** | YES |
| …contained in ≥1 of the four bundles | 222 | YES |
| …in **no** bundle | 126 | YES |
| …of those, ref-reachable in any **other** store (103 stores + em scanned) | **0** | YES |
| …of those, contained in any **remote** (`refs/remotes/*`, every store) | **0** | YES |
| **CONTAINED NOWHERE — THE LIVE EXPOSURE** | **126** | YES |

Of the 126: **80 carry a tree that exists in no bundle and matches no ref-reachable commit**
(unique content); **44 have a tree identical to something already preserved** (amend / stash-index
debris — the commit object is lost, the content is not); 2 more are unique-tree but reflog-held.
**124 of the 126 are held by nothing at all** — not a ref, not a reflog, not an index. Full
per-commit detail with subject and author date: **`UNREACHABLE-EXPOSURE.tsv`** in this directory.

**Not bundled and no refs created to rescue them, per explicit instruction.** Only the gc freeze
protects this pool.

### The pinned suite itself is NOT at risk here
Two of the 126 (`b1124cf4fd…`, `cc6d6239b5…`, both 2026-07-29 ~02:4xZ) contain the pinned blob
`c8cb6993581fa202c44cf702f41680fa96442a78`. **The blob is independently present and restored-verified
inside Bundles A2 and B** [M]. What is exposed is those two commits' surrounding tree state, not the
merge-blocking test file.

### WHAT "BACKED UP" MEANS IN EVERY ARTEFACT WE PRODUCE

A push transfers ref-reachable objects. The relocation now running off-host will therefore NOT carry
the unreachable pool either. So OFF-HOST and BACKED UP will both, in every artefact we produce, mean
REF-REACHABLE AND OFF-HOST.

---

## 4c. GC CONTROL — CONFIG SET 07:06Z (authorised explicitly; the freeze's wording forbade it, its reason required it)

**Before, in both repositories: all three keys UNSET at every scope — local, global and system**
[M]. So git's defaults were live the entire time: `gc.auto=6700`, `gc.pruneExpire=2.weeks.ago`,
`gc.reflogExpireUnreachable=30.days`. **The freeze was procedural in fact, not merely in theory.**

After, written to `.git/config` and read back off disk in both repos [M]:

```
[gc]
	auto = 0
	pruneExpire = never
	reflogExpireUnreachable = never
```

Diff against the pre-change backup shows **those four lines added and nothing else**; originals are
preserved in `gc-config-before-20260729T070627Z/`. em-verify195: `.git/config` is the **only** file
modified, object count still 6,482 and ref count still 93 [M].

**Reach: 2 config writes protect 120 of 222 work dirs**, because linked worktrees share the common
config (verified: `farmtable-xss-r6-fix` reports `gc.auto=0` without its own config) [M].
**102 of 104 stores remain on git defaults**, and **55 of them physically hold at least one of the
126 exposed commits**. All 102 configs are writable; closing them costs 306 local config writes,
no network and no object access.

**WHAT THIS DOES AND DOES NOT STOP** — `gc.auto=0` stops automatic maintenance, which is the real
threat because it fires on ordinary writes with nobody typing `gc`. `pruneExpire=never` and
`reflogExpireUnreachable=never` mean a **bare `git gc` is now harmless to the 126**. Still **not**
blocked: `git gc --prune=now`, `git prune` (which does not consult `gc.pruneExpire`), `git repack`
with unreachable-dropping options, and `git reflog expire --expire-unreachable=now`. Those remain
procedural.

**THE CONTROL IS [M], NOT [D] — IT WAS PROVEN BY A CANARY THAT MADE IT FIRE.** git 2.54.0, in a
`/tmp` repo `init`-ed from nothing and confirmed to hold no farmtable object. Bare `git gc`, no
`--prune` flag in either arm, unreachable object backdated past the two-week horizon:

| config | canary commit + blob | reachable control commit |
|---|---|---|
| default (`pruneExpire` unset) | **GONE** | PRESENT |
| `pruneExpire = never` | **PRESENT**, content read back verbatim | PRESENT |

Logs: `gc-canary-20260729T071059Z.log`, `gc-canary-strict-20260729T071122Z.log`.

### Rolled to every store, 07:11Z
**All 104 stores now carry all three keys**, verified by reading the values back, with an
unconfigured `/tmp` repo planted in the same census as a negative control — it was the **only**
entry reported unprotected, which is what proves the census could report a failure at all.
306 writes across 102 stores, **zero failures, zero stderr**. 222 of 222 work dirs covered.
No object or ref was touched by this: canonical refs 422 → 423 (one `refs/preserve/*` **added** by
another leg), **no ref deleted, no ref moved**, and **all 126 exposed commits still present** [M].

## 5. WHERE THESE FILES LIVE — read before treating them as a backup

Measured with `findmnt -T` and `stat -c %d` [M]:

- `/scion-volumes/scratchpad` → ext4, `/dev/root`, device **2049** — host disk, **survives
  container teardown**.
- `/workspace` (the repositories) → ext4, `/dev/root`, device **2049** — *the same device*.
- `/tmp` and `/` → overlay, device 120 — container-local and ephemeral.

**These bundles protect against:** container destruction, `git gc`/`prune`, deletion of
`refs/preserve/*`, repository corruption, and a branch tip moving.

**These bundles DO NOT protect against:** loss of `/dev/root`, or deletion of
`/home/scion/.scion`. The work is now stored four times **on one disk**, and on no remote.
Copying these 8.8 MB to another device, or pushing the refs, is the only thing that closes that
gap — and neither was authorised for this leg.

## 5b. RESCUE REFS CREATED IN CANONICAL — 07:24Z, authorised, scoped to an allowlist of 3

The coordinator's patch-id leg classified the 126 tombstones and reduced the rescue scope from
"126 minus 2 controls" to **three named SHAs**. Two were created; **one could not be**.

| intended SHA | ref created | result |
|---|---|---|
| `b1124cf4fd8e67f05905df9c44b6ec8447888b08` | `refs/preserve/rescue/remotedata-depth-test-b1124cf` | **CREATED**, read back from disk [M] |
| `ba93de89684e18a6c5d075dd035e14cd3ea10541` | `refs/preserve/rescue/decomposer-llm-openai-superseded-ba93de8` | **CREATED**, read back from disk [M] |
| `e222bf59b01934fa92792e07b5f86acef4c756b1` | `refs/preserve/rescue/stash-markdown-check-total-pin-e222bf5` | **CREATED 07:33Z after an authorised object copy** — see §5c |

`refs/preserve` count 94 → 96, delta 2 as expected. Both now report as contained by their new ref
(`for-each-ref --contains`), which is the point: **a ref is what makes an object relocatable.**
Control: `refs/preserve/rescue/__no_such_ref__` does not resolve.

### The two disagreements in this pass — findings, not inconveniences

1. **`e222bf59` is not in canonical at all.** `cat-file -e` fails there. Swept all 109 stores: it
   exists in **24**, none of them canonical, including `farmtable-markdown-sanitize` and the r2/r3/r4
   xss line. Control: the same loop finds `7a0f220` in 105 stores, so the loop can find things. **I
   did not fetch it into canonical** — that is an object-copying write into canonical and it is
   outside what was authorised. It needs a decision, not an improvisation.
2. **`ba93de89`'s description understates it substantially.** It was described as "`llm_openai.go`,
   abandoned alternative backend" — one file. It actually adds **eleven**: a whole `cmd/decomposer`
   binary plus `internal/decomposer/{engine,llm,llm_openai,parser,prompt,writer}.go`, two test files
   and a prompt asset. Preserving it is still right; **the one-line description would have led a
   later reader to think a single superseded file was being kept.** The ref name says `decomposer`
   for that reason.

### The TSV hazard was real and I did not have to mitigate it

I was warned that `IFS=$'\t' read` collapses consecutive tabs and shifts columns left, silently
turning protected into unprotected. **The warning stopped being load-bearing when the scope became
an allowlist of three literal SHAs.** I did not read `UNREACHABLE-EXPOSURE.tsv` in this pass at all.
Removing the parse beats parsing it correctly.

---

## 5c. OBJECT COPIES INTO CANONICAL — 07:33Z, separately authorised

**A ref and an object copy are different writes.** The 07:24Z pass could only ref objects canonical
already had. These two it did not have, so they were fetched in under explicit authorisation.

Canonical pre-state: **6,800 objects, 96 `refs/preserve`**. Post: **98 `refs/preserve`** (delta 2).

| object | source store (named, as required) | how fetched | ref in canonical |
|---|---|---|---|
| `e222bf59…4c756b1` | `/workspace/farmtable-markdown-sanitize` | raw-SHA want — **unreachable from every ref in all 24 stores that hold it**, so no refspec existed | `refs/preserve/rescue/stash-markdown-check-total-pin-e222bf5` |
| `79c9b132…c7e2cf41` | `/workspace/farmtable-xss-r5-review` | its detached `HEAD` | `refs/preserve/rescue/xss-r5-review-detached-head-79c9b13` |

Fetch form used, under the freeze: `-c gc.auto=0 -c uploadpack.allowAnySHA1InWant=true fetch
--no-auto-maintenance --no-tags`. **`--no-auto-maintenance` was accepted by `git fetch` on this
host** — a rejected flag aborts the fetch, and both fetches ran. [M]

### The third ref — in the source store, not only in canonical

`refs/preserve/rescue/review-head-79c9b13` → `79c9b132…` in
`/workspace/farmtable-xss-r5-review/.git`. Read back from disk; the commit now reports as contained
by a ref there for the first time. **`HEAD` is unchanged — nothing was moved or checked out.** [M]

  **A CONFIG IS A PROMISE THAT NOBODY TYPED THE WRONG THING. A REF IS A FACT ABOUT THE GRAPH.**
  That store's gc keys read `never/never/0`, so the review survived by promise. It now survives by
  fact, in two places.

### Content verified in canonical after the copy [M]

```
79c9b132 : web/src/util/url-binding-scan.test.ts        -> c8cb6993581fa202c44cf702f41680fa96442a78, 68066 bytes
79c9b132 : .design/project-log/2026-07-29-review-xss-r5.md -> 92fb5d279782ccc04337b14be7183cac529dac9f
e222bf59 : web/src/util/markdown.test.ts               -> 1fcbf3e912cba8e39bb3388afe3e09a0e3057876
           line 598: const EXPECTED_CHECKS = 49;
CONTROL  : refs/preserve/rescue/__nope__ does not resolve
```

### `e222bf59` IS A STASH COMMIT, and it was rescued anyway — deliberately

Three parents (`eb190c16` HEAD, `7de04f21` index, `e5d8b48f` untracked), subject
`WIP on markdown-sanitize: eb190c1 …`. That is the autogenerated `git stash` shape, and
stash-shaped entries were ruled **out** of the rescue scope. This one was named explicitly and its
content justifies the exception: it adds an **`EXPECTED_CHECKS = 49`** pin plus the failure branch
that fires when the count drifts —

> *"A check that is deleted — or that stops being reached, or whose case list is built by filtering
> through the very predicate under test — does not fail. It ceases to exist, and the suite still
> prints a green count one lower than before."*

**That is this project's own thesis, written as a test, sitting in an unreferenced stash.** The ref
name says `stash-` so no later reader mistakes it for a normal commit.

### Two measurement failures of mine inside this pass, both caught before they were reported

1. **`diff-tree` on a merge prints nothing by default.** My first file list for `e222bf59` came back
   **empty**, which I nearly reported as "the commit changes no files." A stash is a merge commit;
   the list only appears with `-m --first-parent`. **An empty diff on a merge is not an empty
   commit.**
2. **I nearly filed a false disagreement.** I measured the named file as "3 lines / not present" and
   was about to report that the "15 lines" description was wrong. The tree walk says otherwise:
   blob `1fcbf3e9` at **625 lines** vs parent `de82df3f` at **610** — **exactly the 15 claimed.**
   The description was right and my reading was broken. **A disagreement is a finding only after
   the instrument has been checked; before that it is just a second opinion.**

---

## 6. Integrity re-check command (run this before ever trusting these files again)

```bash
cd /scion-volumes/scratchpad/projects/farmtable/preserve
sha256sum -c <<'EOF'
672822a5f4bcd073ef698eeababb60dfd3604a68001dbee38188baa2706da3cc  farmtable-all-local-refs-20260729T063953Z.bundle
b4cd89b5df26ca2a9c080e5d67c1cd94f5fd0f9726bfa519e567d8228aefc426  farmtable-all-local-refs-20260729T063034Z.bundle
47b37ac7bf1b89b006e9911b2a8c652270679ef1d4ea962bb97711c9088a4f4b  farmtable-xss-r5-audit-local-refs-20260729T063404Z.bundle
1124789d85d4c6f7c35022f5e33c2c84eb48551fdece7b484439f33ebce1655b  farmtable-xss-r5-test-local-refs-20260729T063404Z.bundle
834d0799cb23d326c3468296d540468804de85af487d9bbf9d708c68322ee148  farmtable-all-local-refs-20260729T071702Z.bundle
c70053bdfc01c6a4c78923c4ebf23ee13361f51466e1644c5beeb0895ab584c4  preserve-bundle-leg--xss-r5-review-detached-head-20260729T072255Z.bundle
2b727a704c1386e812a5985c30f97433bdd672bb482ea54e239e4a22af84c6e2  UNREACHABLE-EXPOSURE.tsv
EOF
```

A matching sha256 proves the file is unchanged. It does **not** prove it restores. The restore
proof is section 1–3 above, and it was performed against these exact bytes.

---

## 7. RESTORABILITY VERIFIED — NOT MERELY CONTAINMENT (08:00Z)

Every earlier figure tested **presence**. Presence is the weaker claim: an object can sit in a pack,
be reachable from no ref, and be deleted by the first `gc` in the restored repo.
**CONTAINED IN A BUNDLE IS NOT THE SAME CLAIM AS RESTORABLE FROM THAT BUNDLE.**

Tested against the four **restored repos**, never against the bundle files. [M]

| figure | value | note |
|---|---|---|
| unreachable pool (union of 2 stores) | **347** | was 348 |
| **ref-reachable** in ≥1 restored bundle | **222** | |
| **present but NOT ref-reachable** | **0** | the gap — empty in fact |
| in no bundle at all | **125** | was 126 — see 7.2 |

- **fsck --full --strict** on A3/B/C/D: all exit 0, zero output lines. Canary proven to fire. [M]
- **closure**: A3 6203/0 missing, B 5026/0, C 5021/0, D 5016/0. [M]
- **reachability**: per-repo `rev-list --all` sets (836/634/633/632); membership and `cat-file -e`
  tested *separately* so they could disagree. They never did. Controls in the same invocation:
  `cc927355` reachable in A3 = YES; all-zeros SHA absent everywhere. [M]

**BOUND:** the earlier 222 was against A2/B/C, this one against A3/B/C/D. Same integer, different
population; set identity **unverified**. Do not read the coincidence as stability.

### 7.1 Restore commands actually used (copy-pasteable, no placeholders)

**CORRECTION, made before publication.** I first wrote `git init --bare` in this block. **It is wrong
and I did not run it.** Checked against the artefact: `core.bare=false`, and the repo has a populated
working tree — which is the *only* reason the pinned file could be checked out and hashed at all.
A bare restore would have made the central proof of this whole task impossible.

> **I TYPED THAT COMMAND FROM MEMORY OF WHAT I MEANT TO DO, NOT FROM THE DIRECTORY I DID IT IN.**
> Fourth time tonight, same mechanism, and this field is the one the brief singles out: *"the exact
> restore command you actually ran and that actually worked."* A manifest whose restore command does
> not run is a receipt. **CITE FROM THE DISK, NEVER FROM THE COMMAND YOU REMEMBER TYPING.**

The real sequence, non-bare, verified against the restored repo on disk:

```
mkdir -p /tmp/ft-restore-proof-20260729T071702Z/restored
git init /tmp/ft-restore-proof-20260729T071702Z/restored
# confirm virgin: 0 objects, and NO objects/info/alternates - else the proof borrows from the host
git -C /tmp/ft-restore-proof-20260729T071702Z/restored fetch \
  /scion-volumes/scratchpad/projects/farmtable/preserve/farmtable-all-local-refs-20260729T071702Z.bundle \
  'refs/*:refs/*'
git -C /tmp/ft-restore-proof-20260729T071702Z/restored checkout --detach d5e35a4869475cd79c3a46e791909a610d1ea8f2
git -C /tmp/ft-restore-proof-20260729T071702Z/restored hash-object web/src/util/url-binding-scan.test.ts
#   -> c8cb6993581fa202c44cf702f41680fa96442a78 , 68066 bytes
git -C /tmp/ft-restore-proof-20260729T071702Z/restored fsck --full --strict --no-progress
```

Verified on disk at 08:05Z: `core.bare=false`, working tree populated, no `objects/info/alternates`.

### 7.2 THE EXPOSURE COUNT FELL AND NOTHING GOT SAFER

`b1124cf4` left the pool because **I** created `refs/preserve/rescue/remotedata-depth-test-b1124cf`
in canonical at ~07:22Z. Measured after: it is **a head of no bundle** and **not ref-reachable in any
of the four restored repos**. [M] Identically durable to an hour ago.

> **AN UNREACHABLE-OBJECT CENSUS IS A POPULATION THAT REF-CREATION SILENTLY SHRINKS.**
> A number improved; no byte moved. This is the receipt failure mode, committed by the leg sent to
> prevent it, and it is recorded here rather than quietly absorbed into a smaller total.

Canonical's unreachable count moved 122 → 120 for the same reason (four rescue refs). A later leg
re-deriving the pool will see my footprint — **that is not decay, it is me.**
**Report 125 in-no-bundle and 126 at-risk, or re-derive with `refs/preserve/rescue/*` excluded.**

### 7.3 Discovery denominator

The pool was **discovered** on **two** stores (canonical, em-verify195). This host has **112 distinct
object stores** [M, re-measured — my earlier 103 was wrong], so **110 are unswept**. Three of them
share canonical's objects via *alternates* (`audit-/review-/test-xss-r6`) and will multiply-count on a
naive union — dedupe by SHA, not by (store, SHA). Store list:
`STORE-ENUMERATION-preserve-bundle-leg-20260729T0803Z.txt`,
sha256 `e1a2fd4e78c84f9ec380c8634291f6303deb04a9df4a1a940b32da8a58764b9f`.
**The pool is a floor, not a total.**

### 7.4 THE TWO 222s ARE THE SAME 222 — AND THE METRIC IS BLIND TO THE BEST RESCUE (08:10Z)

Set diff, both re-derived against the **same** current 347 pool so the bundle set is the only variable.
The A2 restore was rebuilt from the bundle for this, not remembered. [M]

| | |
|---|---|
| OLD contained (A2 ∪ B ∪ C) | 222 |
| NEW contained (A3 ∪ B ∪ C ∪ D) | 222 |
| **in both** | **222** |
| **old only** | **0** |
| **new only** | **0** |

**Identical sets. Genuine corroboration, not a coincidence.** Controls in the same invocation:
`pool ∩ {}` = 0, and single-bundle intersections differ from the union, so the test discriminates.

Why they had to match: A3 differs from A2 by exactly **12** commits, and **0** of those 12 are in the
pool — they are the published CI commits, reachable in canonical and therefore never unreachable.

**PER-BUNDLE ATTRIBUTION, and this is the part worth keeping:** [M]

| bundle | pool commits covered | uniquely covered | coverage if dropped |
|---|---|---|---|
| **A3** | 222 | **35** | 187 |
| B | 187 | 0 | 222 |
| C | 187 | 0 | 222 |
| D | 187 | **0** | 222 |

> **BY THIS METRIC, BUNDLE D IS WORTHLESS. THE METRIC IS WRONG.**
> D is the only artefact holding `79c9b132` — the round-5 code review at a detached HEAD, the single
> most valuable thing recovered tonight. It scores zero because **it is not in the pool at all**:
> a detached HEAD is an fsck root, so it is never *unreachable*, so the unreachable census cannot see
> it. Confirmed: `79c9b132` reachable in D, in none of A3/B/C, and absent from the 347. [M]

**THE 222/126 FUNNEL MEASURES COVERAGE OF ONE FAILURE MODE — ORPHANED OBJECTS — AND SILENTLY SCORES
ZERO FOR EVERY OTHER KIND OF LOSS.** Anyone pruning bundles on the strength of the table above would
delete D and lose the review. Keep D.

**METHOD DEFECT, disclosed:** my first attempt at that table returned "uniquely covers 222/187/187/187",
which I nearly wrote down. **zsh does not word-split unquoted variables**, so a newline-joined list of
filenames became one filename, `sort` failed, the comparison file was empty, and `comm -23 X ∅`
returned all of X. The numbers looked plausible and were the *alone* column relabelled.
Caught only because stderr was unmuted. Redone with a real array plus a canary asserting the
comparison file is non-empty.

> **A DEAD COMMAND THAT RETURNS A PLAUSIBLE NUMBER IS WORSE THAN ONE THAT RETURNS ZERO.**
> Fifth shell-induced false result tonight; the zsh no-word-splitting rule is a *different* mechanism
> from the unquoted-glob one that produced the false 654 twenty minutes earlier.

---

## 8. THE UNCOMMITTED EXPOSURE — A CLASS NO CENSUS TONIGHT COULD SEE (08:14Z)

Chasing a 1-unit disagreement in store counts, I widened the `find` bound and then looked at working
trees instead of object stores. Both moves found things.

### 8.1 My own depth bound was wrong — 234, not 230

`find /workspace -name .git` unbounded returns **234**; my published `maxdepth 2` returned 230. [M]
The four it missed, all `.git` **files** at depth 5:

```
/workspace/farmtable/.claude/worktrees/agent-a2c3f443e6e14aef4/.git
/workspace/farmtable/.claude/worktrees/agent-a9a8ff1994a656cac/.git
/workspace/farmtable/.claude/worktrees/anthropic-vertex/.git
/workspace/farmtable/.claude/worktrees/prompt-variants/.git
```

**All four checked: on a branch (not detached), HEAD ref-reachable in canonical, present in all four
bundles, zero tracked modifications.** [M] No exposure. But they are **four working trees under
`/workspace/farmtable`, below `maxdepth 2`** — so the sweep leg's statement that every deeper entry is
scratchpad-internal is true of *stores* (these dedupe to canonical's `.git` by realpath) and false of
*trees*. **THE NOUN DECIDES THE ANSWER; THE SAME FOUR PATHS ARE 0 STORES AND 4 TREES.**

Also: 239 top-level dirs, 9 with no `.git`. Two are farmtable-named —
`farmtable-f25-inspector-tabs`, `farmtable-f39` — and contain **only `web/.vite/deps/` build cache,
2 files each**. Not repositories, not losses. [M]

### 8.2 THE FINDING: 63 AUTHORED FILES IN NO OBJECT STORE ANYWHERE

Every figure tonight — 348, 347, 222, 126, 125, 663, 171 — counts **commits**. A commit is work that
someone already committed. **NOTHING WE MEASURED TONIGHT COULD SEE WORK THAT WAS NEVER COMMITTED.**

Host-wide `git status --porcelain` across all 230 trees: **65 trees dirty, 249 entries.** [M]

| class | count | assessment |
|---|---|---|
| tracked modifications | 25 | 21 `package-lock.json`, 2 `package.json`, 1 `buf.lock`, **1 source file** |
| untracked | 224 | logs, `.db`, build cache — **and 63 authored `.mjs` scripts** |

The single tracked source modification host-wide is `internal/server/scopes.go` in
`/workspace/farmtable-xss-r4`: 6 insertions, 6 deletions, **gofmt alignment whitespace only**. Not work.

**The 63 `.mjs` files are.** Verification and test harnesses written by agents for specific features —
`verify-f48.mjs` 23,320 bytes, `verify-autoscroll.mjs` 26,161, `deploy-10-verify-v2.mjs` 20,037,
seven `dnd-*` scripts in one tree, and so on.

  **63 files, 546,499 bytes, across 27 working trees. [M]**

Verified rather than assumed — hashed a sample and looked the blob up:

```
dnd-test.mjs -> ee7ec4f61113d5740db4f170e62081ad07369a5b
  ABSENT from canonical's object store
  ABSENT from bundles A3, B, C, D
POSITIVE CONTROL, same invocation: c8cb6993... (the pinned test blob) PRESENT in canonical
  -> the lookup is alive, so the absences are real absences
```

> **A BUNDLE CAN ONLY PRESERVE WHAT A COMMIT ALREADY CAPTURED.**
> These files are in no commit, therefore no object store, therefore no bundle, therefore no census,
> therefore no number in this report or any other tonight. They are protected by nothing at all — not
> by A3, not by the rescue refs, not by the off-host push. **`rm -rf` on any of those 27 trees, or the
> VM lockup that started this night, takes them with no git operation involved.**

This is the same shape as the Bundle D result one level further out. D scored zero because the census
excluded fsck roots. **These score zero because the census counts commits.** Both times the metric
read zero and the truth was "outside the frame."

**RECOMMENDED, and it is cheap:** `git stash create` or a plain `tar` of the 63 paths, off-host. I have
not done it — it is outside my authorisation and it would be a write. **Naming it is my job; doing it
is not.**

**BOUND:** `.mjs` only. I did not classify the other 161 untracked entries beyond extension, and I did
not inspect the 9 non-git top-level directories past the two farmtable-named ones.

