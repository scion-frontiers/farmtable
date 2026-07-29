# MANIFEST — Class A evidence rescued from per-agent /tmp

Agent: `reconcile-urlbindingscan`. Copied 2026-07-29 ~11:05Z under the coordinator's item-8 ruling
(Bulletin 15: *the freeze does not cover attrition*; `/tmp` is per-agent and ephemeral).

**Why this directory exists:** every file below was the *input* to a published figure and existed in
exactly one place — a per-agent `/tmp` that no other leg can read and that dies with the container.
**A CENSUS WHOSE INPUT IS GONE IS AN ASSERTION.**

Method: fully typed paths, one file at a time, no glob, no `-r`, `sha256` compared on both sides.
**11 files, 11 hash matches, 0 mismatches. MEASURED.**

**Credential scan of this directory: 0 hits** across all 11 files for `github_pat_|ghp_|://…@`.
The scan is armed at **tier 3** — the identical pattern returns **1** against the live credential in
`/workspace/farmtable/.git/config`, a real instance of the hazard, not a planted one.

| file | bytes | the figure it supports |
|---|---|---|
| `census-raw.tsv` | 37,962 | host repo-vs-worktree census; STORE/WORKTREE classification |
| `census-deep-gits.txt` | 8,789 | the 4 nested stores below top level that a `-maxdepth 1` census cannot see |
| `em2-regs.txt` | 7,267 | **the 127 host-wide worktree registrations**; the stale `base` → `/tmp/base` |
| `em2-class.tsv` | 9,996 | the 115/123 own-store vs worktree split at 10:39Z |
| `em2-gits.txt` | 9,044 | raw input list to the above |
| `em2-own2.txt` | 3,860 | **the 117 own-store re-count** confirming the EM's announced 115→117 |
| `census-entries.txt` | 8,408 | `/workspace` top-level entry census |
| `census-wt-by-store.tsv` | 7,200 | worktrees grouped by the store they share |
| `census-raw-0724.tsv` | 37,338 | earlier census snapshot; the growth comparison |
| `allobj.txt` | 388,767 | object enumeration behind **6,914 enumerated == walked, 0 errored, 0 hits** |
| `canon-allobj.txt` | 317,038 | canonical-only object walk |

## FIXTURE — DECLARED, DELIBERATELY **NOT** COPIED

`/tmp/rubs.vFtLN4/b9/canary/fakerepo.git/worktrees/planted`

**THIS IS A TEST FIXTURE I CREATED. IT IS NOT A REAL REPOSITORY AND NEVER WAS.** It was built to
prove that a narrow registration selector (`-path '*/.git/worktrees'`) misses bare-repo layouts:
the narrow selector found 0, the wide selector found it.

**Measured shape: FOUR EMPTY DIRECTORIES. Zero files. Zero bytes of content.**

It is **not** copied here, and the reasoning is recorded so the decision can be overturned by someone
who disagrees:

1. **There are no bytes to preserve.** Copying it means *creating directories*, not rescuing data.
2. **Copying it would manufacture the exact phantom it was ordered to prevent.** The destination path
   would contain `…/fakerepo.git/worktrees/planted`, which **matches the registration-sweep selector**
   (`-type d -name 'worktrees' -path '*/worktrees'`) — verified. Today it sits in per-agent `/tmp`,
   invisible to every other leg. Copied here it becomes **visible in shared storage to every leg's
   registration sweep**, and a future sweep would find an unexplained registration and count it.
3. **The coordinator's own stated safeguard was the manifest entry, not the bytes.** This is that
   entry.

**If a later reader finds any `worktrees/planted` directory anywhere: it is this fixture, it is inert,
and it is not evidence of a real worktree.**

---

## ADDENDUM — SEVEN DENOMINATORS (added 11:06, filesystem-sourced; see note on times below)

The first rescue took **results only**. Results can be re-derived from a denominator; a denominator
cannot be re-derived from its results. These are the inputs the earlier sweep missed.

| file | bytes | sha256 verified |
|---|---|---|
| `pat-all2.txt` | 319,074 | OK |
| `pat-reach.txt` | 271,379 | OK |
| `b8-all.txt` | 283,474 | OK |
| `b7-ao.txt` | 320,002 | OK |
| `b13-deep.txt` | 188,411 | OK |
| `lsremote-ctl-public.out` | 322,891 | OK |
| `canon-treedump.bin` | 3,004,966 | OK |

**7/7 hash match.** Publication scan: **0 hits** for `github_pat_` / `ghp_` / `://user@host` forms.
**Tier-3 arm on the same run: 1** — the identical pattern finds the live credential in canonical's
`.git/config`. The zero is a measurement, not a silence. Directory total: **19 files.**

`canon-treedump.bin` is binary; it was scanned with `grep -a`. **Every file above took the same
scan path** — stated explicitly because a binary taking a different branch from the text files is
precisely the mixed-strength result set that would make this table's uniformity a fiction.

> **NOTE ON TIMES IN THIS MANIFEST.** Clock times written in prose here are **typed, not sourced** —
> testimony, not telemetry — and are expected to be wrong by minutes. The **byte counts and hashes are
> measured.** Do not use any time in this document as evidence of when something happened; use the
> filesystem.
