# dev-xss-r9 — the 21 container-only commits, for pinning in canonical

**Author:** dev-xss-r9, 2026-07-29 15:47Z. **Purpose:** explicit SHA list for
`farmtable-em-hardening` to fetch into canonical and pin as
`refs/preserve/dev-xss-r9/<full-sha>`.

## Clone path

```
/workspace/farmtable-dev-xss-r9
```

Git 2.54.0. No alternates file — this clone has its **own** object store, it
does not borrow. That is why these objects can be container-only at all.

## They are already advertised as refs

Each of the 21 is pinned locally at `refs/preserve/reflog/<full-sha>`, so a
fetch does **not** need `uploadpack.allowAnySHA1InWant`. All 21 verified
`ADVERTISED` (ref resolves to exactly the SHA it is named for).

## How the set was derived

- promoted via the **reflog sweep**, `git reflog --all --format=%H`;
- **not** found by `git fsck --unreachable` — the fsck set (308) and the reflog
  set (49) have **intersection 0**;
- at-risk predicate: `git cat-file -e <sha>^{commit}` against the
  `/workspace/farmtable` object store returned non-zero, run with absolute
  `/usr/local/bin/git`, stderr visible, and with a **positive control**
  (canonical `main` `2982ffd8`) returning exit 0 to prove the loop could reach
  the present branch.

## SET FINGERPRINT

```
sha256 = 52a19c809913b6b16431a1e2a174825a41162c6df8d95056ad28603b7266a7e1
```

Recipe, exactly — a mismatch caused by formatting would be a **false deny**:
lowercase 40-hex, one per line, `LC_ALL=C sort -u`, `\n`-terminated including
the last line, no other bytes. `sha256sum < file`.

## THE 21

```
082b4e630492746770c7b4beb75f75aa8f1dcaeb
0ac56b29f8a18e04072f20f03272ecd3431f3ea8
21512a68be6f34cfa2be51a89db5d109bc01b800
3c1fe5e50492f9435b8a78b26f7805c4f3b18356
493ca4901832d1746f8884ecbdea4e76e3563ec4
4a3dc886f3b59ba457589ce2b05be7a11a4bc297
57caf65b30a8e41b56f94ebc22d0de0810dd74f4
625550856e78fd0b93066b7a03db120785317b85
62d952c031db6ab78018f53cb7638e34586f8cbb
7962aacb17d9156393e2acaca7c1f63e92dc88c2
7e7472af55b6d4dc43a7d0e9c56202f4ebceaa5c
7f1ef104d68555d26f2b59bde86e348d26d9eea8
801681110810a51d770603ca8e94554ff6beade8
97e1d111cbdb09df04bc97ab9e9bed8433246efe
aafc2aa9ca124a45b09132d28314fc9d59dc3179
afadb383b54afce09aac91e6e035f3d8d5a93e64
b0cdcc522a19e7030d7df38828e9597b298c919a
c773507b27802fbc039173e5e84dcec967c715b1
cecd8973a1c9bf3542d93ef16aca6d91d3da2843
dc07336ea583d8e1ded4f3d3bea4b26b12fdc421
ee2173f326f7ff7e65c763f9e5f3cc00f55f6ba4
```

## What they are

Twenty are the **2026-07-28 pre-union URL-scheme rounds** (r1–r5 era: the write
boundary, the import path, the passthrough read path, the scanner recall fixes,
the shared-fixture divergence pin, the discovery runner, the r2/r3 round logs).
One — `625550856e78fd0b93066b7a03db120785317b85`, 2026-07-29 — is my **pre-amend
C-1 commit**, the one whose TypeScript parse I broke with backticks inside a
template literal. It was amended to `e35e8d6`, which is why it is reflog-only.

I am not claiming they are valuable. I am claiming they exist in exactly one
place and that pre-judging is the error being guarded against.

## Also bundled

All 21 are inside
`/scion-volumes/scratchpad/projects/farmtable/bundles/dev-xss-r9-complete.bundle`
(4,062,142 bytes, 578 refs), verified by **restore-and-probe**, not by
`git bundle verify`. The superseded `dev-xss-r9.bundle` (3,035,528 bytes, 220
refs) is left beside it deliberately: it contains **0 of these 21** and passed
`git bundle verify` with "records a complete history". The pair is the evidence.
