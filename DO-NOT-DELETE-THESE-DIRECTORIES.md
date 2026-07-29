# DO NOT DELETE THESE DIRECTORIES

**Generated 2026-07-29 ~08:17Z. This is not a report. It is an operational blocklist.**

If you are about to delete a finished agent, remove a working tree, or run any cleanup under
`/workspace`, read this file first. **35 git commits exist in exactly one place on this host
and nowhere else in the world.** No bundle holds them. No remote holds them. They are not on
the GitHub server. Deleting the directory deletes the only copy.

You do not need `git gc` for this and you do not need a disk failure. An ordinary `rm -rf` of
a finished agent's tree is sufficient.

**Deletion, tree removal and cleanup are FROZEN host-wide as of 08:15Z.** This file is the
list that freeze exists to protect.

---

## THE 14 DIRECTORIES

Delete none of these. Sorted by how much is lost if you do.

| # | directory | commits lost if deleted | **last modified (mtime of the DIRECTORY — LIVE, SEE NOTE)** | **created (birth `%W` of `<dir>/.git`, NOT of the directory)** |
|---|---|---|---|---|
| 1 | `/workspace/farmtable-terminal-predicate` | **15** | **2026-07-27 16:40Z** | **2026-07-27 16:40Z** |
| 2 | `/workspace/farmtable-audit-194` | **3** | **2026-07-28 01:02Z** | **2026-07-27 19:43Z** |
| 3 | `/workspace/farmtable-test-195` | **2** | **2026-07-28 00:26Z** | **2026-07-27 19:41Z** |
| 4 | `/workspace/farmtable-194-r7b` | **2** | **2026-07-28 05:18Z** | **2026-07-28 05:18Z** |
| 5 | `/workspace/farmtable-194-r6b` | **2** | **2026-07-28 03:27Z** | **2026-07-28 03:27Z** |
| 6 | `/workspace/farmtable-194-r7-test` | **2** | **2026-07-28 06:18Z** | **2026-07-28 06:18Z** |
| 7 | `/workspace/farmtable-audit-195` | **2** | **2026-07-28 00:26Z** | **2026-07-27 19:41Z** |
| 8 | `/workspace/farmtable-em-verify195` | **1** | **2026-07-28 02:29Z** | **2026-07-28 00:42Z** |
| 9 | `/workspace/farmtable-194-combine-r7` | **1** | **2026-07-28 05:54Z** | **2026-07-28 05:54Z** |
| 10 | `/scion-volumes/scratchpad` | **1** | **2026-07-27 18:23Z** | **2026-07-21 15:07Z** † |
| 11 | `/workspace/farmtable-194-r7-audit` | **1** | **2026-07-28 06:18Z** | **2026-07-28 06:18Z** |
| 12 | `/workspace/farmtable-p2-webui` | **1** | **2026-07-27 14:39Z** | **2026-07-27 14:39Z** |
| 13 | `/workspace/farmtable-review-195` | **1** | **2026-07-27 19:41Z** | **2026-07-27 19:41Z** |
| 14 | `/workspace/farmtable-test-194` | **1** | **2026-07-28 02:58Z** | **2026-07-27 19:43Z** |

> † **Row 10 is the only row where the two objects disagree.** `/scion-volumes/scratchpad` itself was
> born **2026-07-18 23:11Z**; its `.git` was born **2026-07-21 15:07Z**, three days later. It is the
> only entry that is not a `farmtable-*` clone — it is a directory that existed for three days before
> someone ran `git init` in it, and therefore the only row on which the birth column's error can show.
> The directory is **three days older than this table has been saying.**

> ⚠️ Several of these look finished and idle. **That is exactly what makes them dangerous** —
> an old mtime is what invites cleanup, and these are the trees where cleanup is unrecoverable.

> ### ⚠️ NOTE, AMENDED 2026-07-29 ~09:35Z — THE CONTAMINATION WAS REAL AND IT WAS IN THE OTHER OBJECT
>
> **The earlier version of this note struck out the whole "last modified" column as contaminated.
> That was wrong, and the mtime column is now restored above as a DIRECTORY mtime. It is clean and
> it is informative.** Measured across all 14 rows, comparisons made 14 == rows expected 14:
>
> | | 2026-07-29 mtimes |
> |---|---|
> | rows whose **`.git`** mtime is 2026-07-29 | **14 / 14** |
> | rows whose **DIRECTORY** mtime is 2026-07-29 | **0 / 14** |
>
> The sweeps touched `.git`. They did not touch the directories. The struck-out values were `.git`
> mtimes wearing a column header that said "directory", so the contamination diagnosis was correct
> about the object that was measured and wrong about the object that was named.
>
> **A CONTAMINATION MEASURED IN THE WRONG OBJECT CONDEMNS THE RIGHT ONE — AND STRUCK-THROUGH TEXT IS
> NEVER RE-EXAMINED, BECAUSE IT READS AS ALREADY HANDLED.**
>
> The recovered fact is not cosmetic. **`/workspace/farmtable-terminal-predicate` — the row holding
> 15 single-homed commits, more than any other — has not been touched since 2026-07-27 16:40Z.**
>
> The original observation that produced the strike-out was sound and is kept: the engineering
> manager read a tree's `.git` mtime of 08:33:08.335 as evidence the tree was live, then found
> canonical at 08:33:08.436 — 0.1 s apart and *not adjacent in its loop order*. The freshness was its
> own sweep. **The instrument was degraded by the act of measuring.** True — of `.git`.
>
> ### ⚠️ THE BIRTH COLUMN STATS `<dir>/.git`, NOT THE DIRECTORY. THE HEADER NOW SAYS SO.
>
> On 13 of 14 rows the two are identical, because `git clone` creates the directory and its `.git`
> within the same second. **THAT AGREEMENT IS ONE FACT REPORTED TWICE, NOT CORROBORATION. A COLUMN
> THAT AGREES WITH ITS HEADER ON 13 OF 14 ROWS IS NOT 93% RIGHT — IT IS MEASURING A DIFFERENT OBJECT
> AND GETTING AWAY WITH IT.** Row 10 is the only non-clone and the only row where they can differ,
> and they do; see the † footnote.
>
> `birth(.git) >= birth(dir)` on 14 of 14 rows. So the error can only ever make a directory look
> **younger** than it is — and younger reads as recently created, which reads as live, which reads as
> do-not-delete. **THE ERROR WAS IN THE SAFE DIRECTION, WHICH IS EXACTLY WHY NOBODY WOULD HAVE FOUND
> IT.**
>
> Birth time was available for all 14 entries; had it been missing for any, that entry would say so
> rather than fall back silently.
>
> ### ⚠️ THESE ARE FULL CLONES, NOT `git worktree add` WORKTREES. THIS IS WHY DELETION IS FATAL.
>
> Measured on all 14: `.git` is a **directory** in 14/14 (a real worktree's `.git` is a *file*), there
> is **no `commondir`/`gitdir` marker in any of them**, and **not one has
> `.git/objects/info/alternates`** — so not one of them borrows objects from a shared store. Each
> holds its own packs (1 to 8 each). **Deleting one of these directories destroys its object store
> outright; there is no parent repository holding a second copy.** If you have been told these are
> worktrees of `/workspace/farmtable`, they are not.
>
> This does not affect the commit-to-store mapping, which is what this file is for. **35 commits
> across 14 directories stands.**


---

## DIRECTION 1 — STORE → COMMITS

### `/workspace/farmtable-terminal-predicate`

| commit | committed | subject |
|---|---|---|
| `2648344f9b1a` | 2026-07-27 19:37 | index on terminal-predicate: 3bef89c Make the terminal-stage tests kee |
| `3a4d4c4551b1` | 2026-07-27 19:37 | WIP on terminal-predicate: 3bef89c Make the terminal-stage tests keep  |
| `4fbcdc089347` | 2026-07-27 19:38 | WIP on terminal-predicate: 3bef89c Make the terminal-stage tests keep  |
| `5fa4373adc34` | 2026-07-27 19:38 | untracked files on terminal-predicate: 3bef89c Make the terminal-stage |
| `6b66112e8a54` | 2026-07-27 19:37 | index on terminal-predicate: 3bef89c Make the terminal-stage tests kee |
| `6b82cde3af5c` | 2026-07-27 19:37 | untracked files on terminal-predicate: 3bef89c Make the terminal-stage |
| `6d284b0ab90a` | 2026-07-27 19:37 | untracked files on terminal-predicate: 3bef89c Make the terminal-stage |
| `6de835a08890` | 2026-07-27 19:37 | untracked files on terminal-predicate: 3bef89c Make the terminal-stage |
| `80492caed65f` | 2026-07-27 19:37 | WIP on terminal-predicate: 3bef89c Make the terminal-stage tests keep  |
| `83245c7fdf64` | 2026-07-27 19:39 | WIP on terminal-predicate: 3bef89c Make the terminal-stage tests keep  |
| `aa945beb5c78` | 2026-07-27 19:38 | index on terminal-predicate: 3bef89c Make the terminal-stage tests kee |
| `b21c8a0b1126` | 2026-07-27 19:39 | untracked files on terminal-predicate: 3bef89c Make the terminal-stage |
| `eb3a74b68daf` | 2026-07-27 19:37 | index on terminal-predicate: 3bef89c Make the terminal-stage tests kee |
| `eff476bd740e` | 2026-07-27 19:37 | WIP on terminal-predicate: 3bef89c Make the terminal-stage tests keep  |
| `f9fbd6523521` | 2026-07-27 19:39 | index on terminal-predicate: 3bef89c Make the terminal-stage tests kee |

### `/workspace/farmtable-audit-194`

| commit | committed | subject |
|---|---|---|
| `374a99e6ce11` | 2026-07-27 19:56 | Log the independent security audit of the close-label-swap change |
| `e46c3f753576` | 2026-07-28 00:20 | Log the #194 round-2 test review |
| `eb06e5ccbbc6` | 2026-07-28 00:20 | Log the #194 round-2 security audit |

### `/workspace/farmtable-test-195`

| commit | committed | subject |
|---|---|---|
| `04abbe7fd50b` | 2026-07-28 00:04 | docs: log #195 round-2 test review (REQUEST CHANGES on G1) |
| `1b721ce739a7` | 2026-07-27 19:49 | docs: independent test review of markdown sanitizer suite (#195) |

### `/workspace/farmtable-194-r7b`

| commit | committed | subject |
|---|---|---|
| `1244ea3ec25d` | 2026-07-28 05:33 | WIP on label-write-scope-r7b: 6ced24e Combine #194 round 6 leg A (labe |
| `e11b28cb9d32` | 2026-07-28 05:33 | index on label-write-scope-r7b: 6ced24e Combine #194 round 6 leg A (la |

### `/workspace/farmtable-194-r6b`

| commit | committed | subject |
|---|---|---|
| `76d56830ac4b` | 2026-07-28 03:46 | index on label-write-scope-r6b: ca39dff Stop identity_test.go silently |
| `b3dee42b9f29` | 2026-07-28 03:46 | WIP on label-write-scope-r6b: ca39dff Stop identity_test.go silently t |

### `/workspace/farmtable-194-r7-test`

| commit | committed | subject |
|---|---|---|
| `90cb2cc55b2c` | 2026-07-28 06:34 | index on label-write-scope-r7: 1d4442f Log the #194 round-7 combine: m |
| `f6d9da348ee8` | 2026-07-28 06:34 | On label-write-scope-r7: tmp-newtest |

### `/workspace/farmtable-audit-195`

| commit | committed | subject |
|---|---|---|
| `9db3e9d01039` | 2026-07-28 00:03 | docs: security audit round 2 of markdown-sanitize (#195) |
| `a4902d483ce2` | 2026-07-27 19:53 | docs: security audit of markdown sanitizer hardening (#195) |

### `/workspace/farmtable-em-verify195`

| commit | committed | subject |
|---|---|---|
| `46827eddd9e3` | 2026-07-28 23:20 | NEGATIVE CONTROL #2 for canonical-preserve checks, 2026-07-28 23:2xZ.  |

### `/workspace/farmtable-194-combine-r7`

| commit | committed | subject |
|---|---|---|
| `49fc2aa31c2a` | 2026-07-28 07:41 | Make TestUpdateTask_DoesNotDestroyAThirdPartyTerminalLabel able to fai |

### `/scion-volumes/scratchpad`

| commit | committed | subject |
|---|---|---|
| `c2fa5b2fc484` | 2026-07-25 15:03 | farmtable r6b: correct proto-reservation wording, add concrete ready r |

### `/workspace/farmtable-194-r7-audit`

| commit | committed | subject |
|---|---|---|
| `c8d805f8386a` | 2026-07-28 06:39 | Log the C-1 cross-list bypass addendum: the audit missed it, and why |

### `/workspace/farmtable-p2-webui`

| commit | committed | subject |
|---|---|---|
| `df3e96689565` | 2026-07-27 14:48 | fix(web): never write server-derived phase from the UI |

### `/workspace/farmtable-review-195`

| commit | committed | subject |
|---|---|---|
| `ee95b9fdbd1f` | 2026-07-27 19:53 | docs: independent code review of markdown sanitizer hardening (#195) |

### `/workspace/farmtable-test-194`

| commit | committed | subject |
|---|---|---|
| `f4a661ac58a9` | 2026-07-27 19:52 | Add independent test review log for #194 close-label-swap |

---

## DIRECTION 2 — COMMIT → STORE

| commit | the one directory holding it | in census 126? |
|---|---|---|
| `04abbe7fd50b24f29816430dae91f9e41d9f7953` | `/workspace/farmtable-test-195` | **new** |
| `1244ea3ec25d1acf4d831ec595b55bca721b5d9c` | `/workspace/farmtable-194-r7b` | **new** |
| `1b721ce739a7b89e8e016dccc69c90d4247ecd29` | `/workspace/farmtable-test-195` | **new** |
| `2648344f9b1a2653011e82dac81d7796424cb156` | `/workspace/farmtable-terminal-predicate` | **new** |
| `374a99e6ce11eb4de7659273521eaab638ffcddb` | `/workspace/farmtable-audit-194` | **new** |
| `3a4d4c4551b1fc04e6c059927097d4b17d58fd54` | `/workspace/farmtable-terminal-predicate` | **new** |
| `46827eddd9e31d950071cd04e046c2e2f9412012` | `/workspace/farmtable-em-verify195` | yes |
| `49fc2aa31c2a9920ca3cfbae32d00fa8edba4e52` | `/workspace/farmtable-194-combine-r7` | **new** |
| `4fbcdc089347f2979c6660fc9add83a5ef4b73fd` | `/workspace/farmtable-terminal-predicate` | **new** |
| `5fa4373adc343a10aeacafb894a4576ff9662e14` | `/workspace/farmtable-terminal-predicate` | **new** |
| `6b66112e8a54943a743fef1cff065be3e267f865` | `/workspace/farmtable-terminal-predicate` | **new** |
| `6b82cde3af5c24f6e4e5b6e0c1454693a7f6bef6` | `/workspace/farmtable-terminal-predicate` | **new** |
| `6d284b0ab90af17c0ab376af9a25757b20cdabc5` | `/workspace/farmtable-terminal-predicate` | **new** |
| `6de835a0889029c84b671c6e64a13d838f3220a4` | `/workspace/farmtable-terminal-predicate` | **new** |
| `76d56830ac4b95cadf5d31148744a94e6e1c80f7` | `/workspace/farmtable-194-r6b` | **new** |
| `80492caed65f4252a89a095e90575a0a967c2e84` | `/workspace/farmtable-terminal-predicate` | **new** |
| `83245c7fdf64684d5e8543d6af955cc546f7593f` | `/workspace/farmtable-terminal-predicate` | **new** |
| `90cb2cc55b2c0c5c2f9d4ae72dfbf9ecf9aab4f2` | `/workspace/farmtable-194-r7-test` | **new** |
| `9db3e9d01039ea85fd1c9370988370ff927af63c` | `/workspace/farmtable-audit-195` | **new** |
| `a4902d483ce25d4998274c96692b9099823786d9` | `/workspace/farmtable-audit-195` | **new** |
| `aa945beb5c781eef162dd04e91d75530d1e58451` | `/workspace/farmtable-terminal-predicate` | **new** |
| `b21c8a0b1126f42531b9c925cf8282280a2a6211` | `/workspace/farmtable-terminal-predicate` | **new** |
| `b3dee42b9f291af75aab40a0be0df3932fb10851` | `/workspace/farmtable-194-r6b` | **new** |
| `c2fa5b2fc4841fb483fd8a3f93cdc2c8500f41f0` | `/scion-volumes/scratchpad` | **new** |
| `c8d805f8386a73bfb4dec8a7a31399bdb4412e05` | `/workspace/farmtable-194-r7-audit` | **new** |
| `df3e96689565b1fbf7c43f6778d0124df26cc11a` | `/workspace/farmtable-p2-webui` | **new** |
| `e11b28cb9d328b9204087dff1b5de62eb50be525` | `/workspace/farmtable-194-r7b` | **new** |
| `e46c3f753576f16001282235c2f2b226cadc5a99` | `/workspace/farmtable-audit-194` | **new** |
| `eb06e5ccbbc6ea01dafbc5d8187bf5c6e9d3eb52` | `/workspace/farmtable-audit-194` | **new** |
| `eb3a74b68dafd4610e71abfa513a65a38a99ba71` | `/workspace/farmtable-terminal-predicate` | **new** |
| `ee95b9fdbd1f5111cdffad43759fd62a4e62c9fb` | `/workspace/farmtable-review-195` | **new** |
| `eff476bd740e9da6dbb476905bd21aad2d1d3b5f` | `/workspace/farmtable-terminal-predicate` | **new** |
| `f4a661ac58a92b2763c8a72f7a098b4fc295239c` | `/workspace/farmtable-test-194` | **new** |
| `f6d9da348ee862387ea44da79db471f966187fd3` | `/workspace/farmtable-194-r7-test` | **new** |
| `f9fbd652352129874941d2784747e67d58e5b798` | `/workspace/farmtable-terminal-predicate` | **new** |

---

## PROVENANCE, AND ONE CORRECTION

Derived from a host-wide sweep of 113 object stores
(`git fsck --unreachable --no-reflogs`), filtered to commits that are: unreachable from any
ref or HEAD anywhere on this host, absent from the live GitHub server, and absent from the
off-host push. Full method in `reports/relocate-offhost.md` §20.

**The figure circulating verbally is 34 across 29 stores. Both numbers are wrong and this
file supersedes them.**

- It is **35**, not 34. One further single-homed commit sits in `farmtable-em-verify195`, and
  it comes from the census's own 126 rather than from the 45 newly found. I reported 34
  because I had counted single-homing only within the new set.
- It is **14** directories, not 29. The 29 was the number of stores holding *any* of the 45;
  the stores holding a *single-homed* commit are 14.

Being wrong in the safe direction is still wrong: a blocklist built from the 34 would have
omitted `farmtable-em-verify195`.

## WHAT THIS LIST DOES NOT COVER

- The other **136** at-risk commits exist in more than one directory on this host, so no single
  deletion loses them — **but every copy is on the same disk (st_dev 2049).** They are not safe,
  they are merely not single-deletion-fragile.
- Commits held only by a **detached HEAD, an unregistered worktree, or an index** cannot appear
  here at all: an unreachable census cannot see an fsck root. This list is a **lower bound**,
  and it is blind in the direction that makes it look shorter.
- Snapshot at ~08:17Z. Agents were writing refs during the sweep.

**Nothing was written into any of these stores to produce this list.** No rescue refs were
created — a rescue ref would have made these commits reachable and quietly deleted them from
the very census that found them, without moving a single byte to safety.
