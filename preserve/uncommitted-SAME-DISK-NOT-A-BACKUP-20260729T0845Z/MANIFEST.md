# MANIFEST — UNCOMMITTED AUTHORED WORK, DUPLICATED ON THE SAME SPINDLE

> **CORRECTION, 08:31Z.** This file was titled "RESCUED COPY" for 46 minutes. It is not a rescue.
> Nothing downstream may call this directory *rescued* or *backed up*; the only accurate phrase is
> **duplicated on the same spindle**. The old title is recorded here rather than silently replaced,
> because the retraction of a label is read by fewer people than the label was.

## READ THIS BEFORE YOU TRUST THIS DIRECTORY

> **THIS DESTINATION IS st_dev 2049 — THE SAME DISK AS EVERY TREE THESE FILES CAME FROM.** [M]
>
> **THIS COPY PROTECTS AGAINST TREE DELETION AND AGENT CLEANUP.**
> **IT DOES NOT PROTECT AGAINST LOSS OF THIS HOST.**
>
> `/workspace` and `/scion-volumes/scratchpad` are two bind mounts of one ext4 filesystem on one
> device. If this host dies, this copy dies with the originals, simultaneously, and the existence of
> this directory must not be read by anyone as "the uncommitted work is backed up."
> **A BACKUP FILE IS A RECEIPT.** This one is a real mitigation against a real and live threat —
> agent-tree deletion — and against nothing else. Getting it off this device is still outstanding.

> ## ⚠ THIS DIRECTORY CONTAINS UNREVIEWED APPLICATION CREDENTIALS
>
> **THREE LIVE-SHAPED APPLICATION AUTH TOKENS (`ft_` + 64 hex) SIT IN SIX OF THESE FILES, ACROSS
> THREE SOURCE TREES.** [M] Referenced by sha256[:16] only — the values are not written anywhere in
> this directory's documentation, and must not be:
>
> `4b2cbad8ec9ab3cb`   `18844ad6326024e0`   `7652751c6db25788`
>
> | file | tree |
> |---|---|
> | `farmtable-f61-isolate/verify-fixes.mjs` | farmtable-f61-isolate |
> | `farmtable-f61-v2/test-all-features.cjs` | farmtable-f61-v2 |
> | `farmtable-f61-v2/test-edge-colors.cjs` | farmtable-f61-v2 |
> | `farmtable-f61-v2/test-solo-bug.cjs` | farmtable-f61-v2 |
> | `farmtable-f61-v2/test-solo-scenarios.cjs` | farmtable-f61-v2 |
> | `farmtable-f62-task-urls/verify-f62-deep-links.mjs` | farmtable-f62-task-urls |
>
> **Measured exposure is zero** — none of the three appears in canonical's history, none in any
> off-host push (measured by the relocation leg, not by me). **Validity was deliberately NOT tested**
> by either leg: that would be an authentication attempt and neither of us is authorised to make one.
> Copying them here is authorised and correct — they are already on this disk in these files, and a
> same-disk copy does not increase what anyone can reach.
>
> **BUT A PRESERVE DIRECTORY IS PRECISELY THE KIND OF ARTEFACT THAT LATER GETS BUNDLED, PUBLISHED OR
> HANDED TO SOMEONE.** That is the receipt class aimed straight at our own remedy: we built a
> directory whose entire purpose is to be trusted and durable, and we have put credentials in it.
> **Any off-host relocation of this directory must treat it as credential-bearing, not as inert text.**

## WHY THESE FILES

Every durability figure produced on this host tonight — 348, 347, 222, 126, 125, 663, 683, 171 —
counts **commits**. A commit is work somebody already committed.

> **NOTHING MEASURED TONIGHT COULD SEE WORK THAT WAS NEVER COMMITTED, AND THE EVENT THAT STARTED
> THIS NIGHT WAS A VM LOCKUP, WHICH TAKES UNCOMMITTED TREES FIRST.**

These 63 files are untracked in their source trees. They are therefore in no index, no tree object,
no commit, no object store, no bundle, and no census. They were invisible to `fsck`, to the four
bundles, to the live-server oracle and to the off-host push alike.

Verified rather than assumed, with a live-instrument control in the same invocation:

```
dnd-test.mjs -> blob ee7ec4f61113d5740db4f170e62081ad07369a5b
  ABSENT from /workspace/farmtable/.git   ABSENT from bundles A3, B, C, D
POSITIVE CONTROL: c8cb6993... (the pinned merge-blocking test blob) PRESENT in canonical
  -> the lookup was alive, so the absences are real absences and not a dead command
```

## CONTENTS

> **SUPERSEDED — THE FIGURES IN THIS TABLE DESCRIBE PASS 1 ONLY. SEE "PASS 2" BELOW FOR THE
> DIRECTORY AS IT NOW STANDS: 232 files / 8,540,456 bytes (+ this manifest).** The 63 and the
> 546,499 are left in place because they are what the pass-1 proof actually verified, and
> overwriting a verified figure with a later one destroys the evidence for both. **Do not quote
> 546,499 as the size of this directory — it was never the size of the population, only of the
> first pass, which was short by seven gitignored files.**

| | |
|---|---|
| files | **63** *(pass 1 only; 232 now — see Pass 2)* |
| bytes | **546,499** *(pass 1 only; 8,540,456 now — see Pass 2)* |
| source trees | **27** *(pass 1 only)* |
| distinct content hashes | **63** (no two files identical, including same-named ones in different trees) |
| captured | 2026-07-29T08:45Z |
| layout | `<source-tree-basename>/<path-relative-to-tree>` — the tree of origin is recoverable from the layout alone |

## GENERATING COMMAND — what actually selected these files

```
find /workspace -maxdepth 2 -mindepth 2 -name '.git' | sort | while read -r g; do
  d=$(dirname "$g"); tree=$(basename "$d")
  git -C "$d" status --porcelain | grep '^??' | awk '{$1="";print}' | sed 's/^ //' \
    | grep -E '\.mjs$' | while read -r f; do
        printf '%s\t%s\t%s\n' "$d/$f" "$tree/$f" "$tree"
      done
done
```

**BOUNDS, part of the result:** `maxdepth 2` under `/workspace` only; untracked (`??`) only, so
*modified tracked* files are NOT here; `.mjs` only, so other authored extensions are NOT here.
The four working trees at depth 5 under `/workspace/farmtable/.claude/worktrees/` were checked
separately and have zero tracked modifications, but were **not** scanned for untracked `.mjs`.

## PROOF OF COPY

| check | result |
|---|---|
| dest existed before | **no** — verified absent |
| files copied | **63**, failures **0** |
| sha256+size+path triples compared source-before vs dest-after | **mismatches: 0** |
| dest total bytes | **546,499** (source 546,499) |
| **source drift during the operation** | **0** — all 63 sources re-hashed after; no tree was altered |

**CANARY — the comparison was proven to fire before the clean result was accepted.** One byte written
at offset 10 of `farmtable-deploy-10/deploy-10-create-tasks.mjs` at the destination produced
**2 mismatch rows**. The file was then restored and re-verified bit-exact against its source hash
`c052aee6b005c672113b6652a44cdd5f07b9fb4504c8fdf734f652baf6721bfb`, and the full 63-file comparison
re-run clean. **A GUARD MUST BE PROVEN BY A CANARY THAT MAKES IT FIRE.**

## RESTORE

Each file goes back to `/workspace/<tree>/<relative-path>` — the layout is the instruction.
These are untracked working-tree files; restoring them means copying them back, not a git operation.

## PER-FILE INVENTORY

sha256, bytes, path-relative-to-dest:

```
c052aee6b005c672113b6652a44cdd5f07b9fb4504c8fdf734f652baf6721bfb      6695  farmtable-deploy-10/deploy-10-create-tasks.mjs
a21c356014b4eec1b644dc8a66b4eb13e318d1ee33badff348e654be9a2fd6d4      2417  farmtable-deploy-10/deploy-10-debug.mjs
2698c841450caa34a3a8eb9d1003129160b8717eae46d454f6d387b38602a2da     16605  farmtable-deploy-10/deploy-10-final.mjs
b8c56cbe3b38dbaf2982cf6a0b04b2d7e78380a0e2c94f96b4d8dee274fbc8ec     15140  farmtable-deploy-10/deploy-10-final2.mjs
29317098bc4642ac972fa31e55ebff816fc53364c6d969c84af996f11b08fa39     19545  farmtable-deploy-10/deploy-10-full.mjs
b55eae29aafb69aa3a01f673bb77fb49e9af5c0b8afde9db0eaffb2fcb9dc27f      5268  farmtable-deploy-10/deploy-10-inspector-test.mjs
0bfe90367f1935ac8697a7dba9c41379a7e6f3abe86d1d42a8cfb1b1537cd236     20037  farmtable-deploy-10/deploy-10-verify-v2.mjs
6591b8d64684c643d1b9287004e34789c944ab4a489a94d56f4786c59f799b18      6918  farmtable-deploy-19/web/verify-f47-v2.mjs
f7db1b1b2e411aed86199be1250e2f78de0749d31c7accfd944865935984aa8a      4624  farmtable-deploy-19/web/verify-f47-v3.mjs
84911119f6bf5f24da9e94366649d9ae532838f0e713f82df427e163877c3c2b      5453  farmtable-deploy-19/web/verify-feature47.mjs
7c9af5fc00b9af85ab4b12bd24cdf3d45cc6436295a119a11293a67cc1ac31bb      3627  farmtable-deploy-21/verify-f45-spotcheck.mjs
5b38e195949faff9670abb843de896df1890804821436a470b3f72038e401dd9     13104  farmtable-deploy-21/verify-f46.mjs
bbdf0be1222f5b170c415117ad5b5eda9e00a1a3527998ac637282d521d36364      8974  farmtable-deploy-22/cleanup-and-f46.mjs
58d359e833c89d427942fe02463e077ea1e832ad7a4b4cde8007e35e637fba0e      6755  farmtable-deploy-22/f46-final.mjs
d34acd8f104bfaa1007e321bbcafbd09d724198d2534b2de479d88cc7f4df691      7613  farmtable-deploy-22/f46-final2.mjs
531806c6cc14ace93575b3b251767bfbe77648444bc615b3eb69721395d3c5c3      5013  farmtable-deploy-22/f46-final3.mjs
63d74e2731b06322d30f0e11ba05556377b3575c241c062559ecb61ea9bcc841     10201  farmtable-deploy-22/f46-spotcheck.mjs
65d27305a9c305905b7ae3237e215b674ea8c81be665e715e8633508a75dc075     18129  farmtable-deploy-22/verify-f48-v2.mjs
294263b538740aa8fa2614483c7752119d3a151363aba38fdf7677cde2b43ca9     23320  farmtable-deploy-22/verify-f48.mjs
3f53d724fb361e98addd69ed9d8fc15352e5e8486baa665410e6e2034db7f082     18753  farmtable-deploy-23/verify-f49.mjs
7bd0c34675e7585a6fae5d70e3f8aa1661a698f24dad82d1540b991ba5be103d      1891  farmtable-deploy-25/verify-f51-scenario1.mjs
74c298ae04d1d6395a1f3f45e7860e345c48aa97b9ebdf2b4dd84bee71e0bba3      9235  farmtable-deploy-25/verify-f51-v2.mjs
6458aad333f8ed77b0334396e858621edfdf168226817be9c6e11ee9a8f3ec89      8749  farmtable-deploy-25/verify-f51.mjs
c29155a031ca30d42634a187d509e3e3c0932fca6288847c7456142730b50662     11624  farmtable-deploy-29/verify-f55-deploy-29.mjs
d6572934adf74cae13fcdc9ab9d863b6f4cf41b35f46718cf9c4086755f8b760     10289  farmtable-f40/verify-inspector-scroll.mjs
ca5073d92c14d88a332631be9f5fae904552359c9f4d199c552e380968c8b9e3      5673  farmtable-f41/verify-animation.mjs
2f3b2da660d74b86ddd0f32909f24c20a2032326b7a7a3a6031fc806600a59c1      1119  farmtable-f43/screenshot-before-after.mjs
b2afb1caf21751ef5810e97eb0c3096034f6583c19e0a91e7b30bb1a867cccba      2286  farmtable-f43/screenshot-f43.mjs
9f233619a0ae864029d22b2f33f1f62fc1e385e952ffeae41db1bd92776743a9      1474  farmtable-f44/capture-screenshots.mjs
fb53ec273d5f3d331ec704a118364d634f0596283d96f5138e6b1e48bea9673b      2351  farmtable-f44/verify-screenshots.mjs
813cabc9be6587184dcb2d3e7ce15c5774c6040500629a1e531439a9cdbb239a      4486  farmtable-f46/test-f46.mjs
f118973a7165d17fb7abfc92814b17e09ab897dcfe93e961472e4896252d5927      6483  farmtable-f50/verify-f50.mjs
7d146eb50a19ebc4d8878a8f536d8a8fee25043e1845676ae3797ec45df980b5      6693  farmtable-f56/verify-f56.mjs
abeb8ab926cfc103bb9f11361c3e06e3fe5233e3df890010462f6ac3135b6924      6451  farmtable-f58/verify-animation.mjs
1aa1d6517e3cc0bb49a5d47fd4c85853465ece5d3f527edc58a4a3abfd8fd92f      5370  farmtable-f60/verify-f60-evidence.mjs
6294a0db576dac12a53ee4868d4c3d9f75fc13148c62f85f659969f432b8e8c3      9041  farmtable-f60/verify-f60.mjs
599d150fcc0d76201526ffc3261c850ad369bf2366e32e23610e66303a1abfd7     10832  farmtable-f61-isolate/verify-fixes.mjs
75f7a29a2b6ea37fa688f19bd48f839e2d4abc10613419640a75b05c5d9e6512      8648  farmtable-f61-isolate/verify-isolate.mjs
cbad6f45f302bd66b33ad8039ba437a545833b54bc650eed59fc9c7231f02e0b      4676  farmtable-f61-v2/test-solo-bug.mjs
050496d486da6adae2fdad5c25058bd9eef0f1e78b4d2af7f1040db4c27412e3     18063  farmtable-f62-task-urls/verify-f62-deep-links.mjs
045fb3b214d0f9bea7add03c987e71de69693e8c659d7510b8fdb5eed1b9a4c8      4947  farmtable-f65-dashboard-ready-count/verify-f65.mjs
8359045cc411e8ae68745f578323bb8a068495d59f8764830470f6ca8f5c5a2c     26161  farmtable-f68-dev/web/verify-autoscroll.mjs
27a5b1794e572423c343f9778139c863f92c386d971e711c140906be6b4369f1      2292  farmtable-fix-closed-solo/screenshot.mjs
fdbb7b961f6b641e5fc9edfd9d2ff4eb3e0627d5d67c7daaabbbb6c3f7903b44      8499  farmtable-fix-solo-crossedge/screenshot-after.mjs
50555bdd67540fbf20918499001ee3840707c8214e12781b38ecbe9fa7fbaa31      5900  farmtable-fix-solo-crossedge/screenshot-before.mjs
7b1615882fdf01b8e156d5a22eeb4504698757b369609f94aaa939c5f7157197      6218  farmtable-fix-solo-crossedge/screenshot-evidence.mjs
deca4f3917cc9c63d6605217d63f73a4c1e0d38a6d8ae53b157235d79bdc8dd0      2480  farmtable-inv-dnd/dnd-debug.mjs
80ea2f6ced8d9564bf7e377548fb4b8c718d979b9cb663f83707113674039383      7300  farmtable-inv-dnd/dnd-final-verify.mjs
80dd9b7ec9e3b324308f25e46236b5b843b162fe4e8a442f4d00ff531ca00544      2195  farmtable-inv-dnd/dnd-list-collections.mjs
5d5620cb54df59636c03ad88d6c58705f51db5f386f8b933a7d36fe9f27a5f73     18764  farmtable-inv-dnd/dnd-test.mjs
95c039ce420e13717370d4981e8cbb1b1586e6c94ef5f6c422516f6f213bb700     15815  farmtable-inv-dnd/dnd-test2.mjs
2c63dafdf5040c45c5060118049139d4c40596912954e5500621f3f0928c0fa1     13695  farmtable-inv-dnd/dnd-test3.mjs
aac82700545b03d96b6bcbc59436298c898eff691390cc73a2b094283a71076b     12609  farmtable-inv-dnd/dnd-test4.mjs
a0ec04314b9068be1c3582cc4d99d75bdcb80fcaed61bf4372f758543d32c40d      7378  farmtable-inv-dnd/dnd-verify-fix.mjs
902fb326bc2f4b00295e3ad71587b160cf384403f578e51d9a103d6337372193      5336  farmtable-inv-sync-flicker/test-flicker.mjs
184ee85d6543a93d43789985873ca0d0c3bc228fbf1dab6563eb3b49cee8468d      8282  farmtable-inv-triage/test-dnd-triage.mjs
844f6916c2ef61f20ff515c7984b731d33f4a8d405783d41a00f9663a341ac00      7667  farmtable-inv-triage/test-dnd-v2.mjs
921712531c89141a25566c132e6794bb18e96c6d36e79c53bf42af3269d11a74     12408  farmtable-perf2-dev/web/interaction-test.mjs
ebb691324482251c7fb860b001e059b44a7b6fe8bdfe351394718288eed4469e      4846  farmtable-perf2-dev/web/perf-breakdown.mjs
c87764df3ddf08bd1e26cbf3d0ee0b5360a5affe28a7de90aef7484ee565322a      3828  farmtable-perf2-dev/web/perf-debug.mjs
fbce1ef703c82f46be97c412f186f4002b534417b6d98537c42507b5775ac8ae      8655  farmtable-perf2-dev/web/perf-large.mjs
296321d33b0366f19406f0a6119548d8c4667f8db8dc922586c72277de94be0a      3895  farmtable-perf2-dev/web/perf-nominimap.mjs
3894525627e5bb04fb8be2ee8ad8ef157ca056c561b0456926867e100442c28e      3704  farmtable-perf2-dev/web/perf-structurekey.mjs
```

---

# PASS 2 — THE WIDENED COPY (coordinator 08:24Z, relocate-offhost 08:27Z)

Captured 2026-07-29T08:32:09Z. Pass 1 copied 63 `.mjs` (546,499 B). Pass 2 adds **169**
files (**7,993,957 B**). Destination total now **233 files / 8552402 bytes** including this manifest.

## 0. THE PATH WAS RENAMED, AND THE OLD PATH IS DEAD

```
mv -n .../preserve/uncommitted-20260729T0845Z \
      .../preserve/uncommitted-SAME-DISK-NOT-A-BACKUP-20260729T0845Z
```

Re-verified after the rename, from the pass-1 triples: **63 checked, 63 absent at the old path,
63 present at the new path, 0 sha256/size mismatches, 546,499 bytes.** [M]

> **AND A DEFECT IN MY OWN VERIFIER, DISCLOSED BECAUSE THE FIRST RUN LOOKED PERFECT.** [M]
> My first post-rename check read the triples file as `rel|sha|size` when it is `sha|size|rel`.
> Every path lookup therefore used a *hash* as a filename. It printed **63 absent at OLD** (true,
> but for the wrong reason) and **0 mismatches** (computed over **zero** comparisons, because the
> mismatch test sat inside an `if [ -f ]` that never matched). Both numbers were the numbers I
> wanted. It was caught only by `PRESENT AT NEW = 0` sitting next to `files at NEW = 64`.
>
> **A FIELD-ORDER ERROR SCORES PERFECTLY ON BOTH SIDES OF A COMPARISON.** The absence check passes
> because nothing is found, and the equality check passes because nothing is tested. My canary
> guarded `checked == 0`, which was 63 and looked fine. Every comparison in this pass now asserts
> **comparisons-actually-made == files-written**, which is the quantity that was lying.

## 1. WHAT WAS COPIED

| Class | Files | Bytes | Authority |
|---|---:|---:|---|
| `.log` | 58 | 2679662 | coordinator 08:24Z — the _gate build/vet/race/test logs; THE LOGS ARE THE MEASUREMENTS |
| `.md` | 52 | 2124452 | 46 untracked + 5 gitignored (my finding, §3) + 1 coordinator continuity file |
| `.png` | 46 | 2843946 | coordinator 08:24Z — overriding my "regenerable" judgement |
| `.cjs` | 5 | 39402 | coordinator 08:24Z — same class as the .mjs, missed by one character of regex |
| `.html` | 1 | 3785 | coordinator 08:24Z |
| `.mjs` | 7 | 302710 | relocate-offhost 08:27Z — gitignored, invisible to both prior instruments (§3) |
| **TOTAL PASS 2** | **169** | **7993957** | |
| *(pass 1, `.mjs`)* | *63* | *546,499* | *coordinator 08:18Z* |

## 2. PROOF

```
# per file: absence asserted at destination BEFORE the write (coordinator finding #80 —
# the directory was NOT empty this time, so a single directory-level check would have been wrong)
[ -e "$NEW/$rel" ] && skip;  mkdir -p "$NEW/$(dirname $rel)";  cp --no-clobber --preserve=timestamps "$src" "$NEW/$rel"
sha256sum + stat -c %s at BOTH ends; compare; then re-hash all 169 sources again for drift
```

| Assertion | Value |
|---|---:|
| rows in set | 169 |
| source missing | 0 |
| **destination absent before write** | **169** |
| destination already present (skipped) | 0 |
| files copied | 169 |
| **comparisons actually made** | **169** |
| **sha256/size mismatches** | **0** |
| source bytes / destination bytes | 7,993,957 / 7,993,957 |
| **source drift, all 169 re-hashed after the copy** | **0** |

**CANARY, RUN BEFORE THE ZERO WAS ACCEPTED.** [M] One byte overwritten at offset 10 of
`.coordinator-state.md` → **1 mismatch**. Restored bit-exact (sha256 equal to source) →
**0 mismatches**. A comparison that has never returned non-zero has not been shown to work.

## 3. THE FINDING OF THIS PASS — GITIGNORED IS THE WORSE HALF, NOT THE SAFER HALF

relocate-offhost reported 7 authored `.mjs` hidden from `ls-files --others --exclude-standard`.
**I verified all seven exist and are ignored, and their bytes sum to 302,710; 546,499 + 302,710 =
849,209, exactly their figure, from a different instrument.** [M] All 7 return
`in-untracked-sweep=0`: **my instrument (`status --porcelain --untracked-files=all`) and the
engineering manager's were blind to every one of them**, for the same reason and by different flags.

I then swept for more rather than accepting seven. Root: 233 of 234 trees (immediate children of
`/workspace` + the 4 depth-5 worktrees; `farmtable-em-verify195` skipped by brief constraint 4).
Predicate `git ls-files --others --ignored --exclude-standard`, extensions mjs|cjs|md|html|ts|tsx|js,
`node_modules` excluded. **1,373 ignored authored-extension files.** 1,189 under a build-output
directory; **184 not**. Against that residue plus the `.tmp-test` harnesses (191 files) I asked the
only question that matters — *does a blob with this content exist in any object store?*

| Result | Files |
|---|---:|
| blob exists in canonical | 179 |
| blob exists only in own tree | 0 |
| **blob exists in NEITHER — content at risk** | **12** |

Probe canary: blob `c8cb6993…` → EXISTS; all-zeros sha → ABSENT. The probe can say no. [M]

**Seven of the twelve are relocate-offhost's. FIVE ARE NEW AND NOBODY HAD NAMED THEM** — human-authored
code reviews from 2026-07-23, ignored by `.gitignore:3:.scratch`, **three of them inside canonical**:

| Bytes | Path | mtime |
|---:|---|---|
| 10601 | `farmtable/.scratch/pr-reviews/stage5-review.md` | 2026-07-23 04:37:45 |
| 9123 | `farmtable/.scratch/pr-reviews/stage6-review.md` | 2026-07-23 04:09:13 |
| 3638 | `farmtable/.scratch/pr-reviews/wiring-review.md` | 2026-07-23 05:12:36 |
| 11793 | `farmtable-auth-stage4/.scratch/pr-reviews/pr-stage4-rbac-round3-review.md` | 2026-07-23 03:12:57 |
| 8299 | `farmtable-auth-stage4/.scratch/pr-reviews/stage4-round4-review.md` | 2026-07-23 03:34:46 |

All 12 are in this directory. **A `.gitignore` ENTRY IS A PRESERVATION DECISION MADE BY SOMEBODY
WHO WAS THINKING ABOUT REPOSITORY HYGIENE, NOT ABOUT DATA LOSS** — and a gitignored file will never
be committed by accident either, so nothing will ever rescue it incidentally.

## 4. WHAT WAS *NOT* COPIED — ENUMERATED BY NAME SO THE EXCLUSION IS AUDITABLE

### COMPILED-BINARY — 6 files, 216589133 bytes
```
farmtable-decomposer-rerun/decomposer
farmtable-f65-dashboard-ready-count/ft-test
farmtable-passthrough-write-p1/farmtable-server-p1
farmtable-passthrough-write-p1/ft-p1
farmtable/.claude/worktrees/prompt-variants/decomposer
farmtable/decomposer
```
### DB/WAL/SHM — 19 files, 2808224 bytes
```
farmtable-f40/localtest.db
farmtable-f41/localtest.db
farmtable-f44/localtest.db
farmtable-f44/web/localtest.db
farmtable-f45/beads-test.db
farmtable-f46/localtest.db
farmtable-f46/localtest.db-shm
farmtable-f46/localtest.db-wal
farmtable-f50/localtest.db
farmtable-f52/localtest.db
farmtable-f56/localtest.db
farmtable-f58/localtest.db
farmtable-f61-isolate/fresh.db
farmtable-f61-v2/fresh.db
farmtable-f61-v2/fresh.db-shm
farmtable-f61-v2/fresh.db-wal
farmtable-f65-dashboard-ready-count/localtest.db
farmtable-inv-sync-flicker/localtest.db
farmtable-passthrough-write-p1/test-writethrough.db
```
### GENERATED-JSON — 37 files, 60428 bytes
```
farmtable-deploy-10/package-lock.json
farmtable-deploy-10/package.json
farmtable-deploy-20/package-lock.json
farmtable-deploy-21/package-lock.json
farmtable-deploy-21/package.json
farmtable-deploy-22/package-lock.json
farmtable-deploy-22/package.json
farmtable-deploy-23/package-lock.json
farmtable-deploy-23/package.json
farmtable-deploy-25/package-lock.json
farmtable-deploy-25/package.json
farmtable-deploy-26/package-lock.json
farmtable-deploy-26/package.json
farmtable-deploy-29/package-lock.json
farmtable-deploy-29/package.json
farmtable-deploy-31/package-lock.json
farmtable-deploy-31/package.json
farmtable-deploy-34/package-lock.json
farmtable-deploy-34/package.json
farmtable-deploy-37/package-lock.json
farmtable-deploy-37/package.json
farmtable-f40/package-lock.json
farmtable-f40/package.json
farmtable-f44/package-lock.json
farmtable-f44/package.json
farmtable-f61-isolate/package-lock.json
farmtable-f61-isolate/package.json
farmtable-f61-v2/package-lock.json
farmtable-f61-v2/package.json
farmtable-f64-dnd-animation/web/test-results/.last-run.json
farmtable-f69-dev/package-lock.json
farmtable-f69-dev/package.json
farmtable-fix-closed-solo/package-lock.json
farmtable-fix-closed-solo/package.json
farmtable-inv-triage/package-lock.json
farmtable-inv-triage/package.json
farmtable-inv-triage/test-results/.last-run.json
```
### SALVAGE-BUNDLE — 2 files, 2285799 bytes
```
farmtable/salvage/canonical-tswuv2-633f8f2-FULL.bundle
farmtable/salvage/canonical-tswuv2-633f8f2-THIN-39.bundle
```
**COORDINATOR SAID 5 COMPILED BINARIES / 191,267,604 B. I COUNT 6 / 216,589,133 B.** [M] The extra is
`farmtable/.claude/worktrees/prompt-variants/decomposer` (25,321,529 B) at depth 5 — the same bound
that produced tonight's other depth-5 misses. It changes no bytes copied, only the published figure.

## 5. THE SALVAGE BUNDLES ARE NOT HERE, AND THE REASON IS A MEASUREMENT

`farmtable/salvage/canonical-tswuv2-633f8f2-FULL.bundle` (2,030,942 B) and `-THIN-39.bundle`
(254,857 B). The coordinator's 08:22Z instruction said to copy them; **I restored the FULL bundle into
a virgin /tmp repo and measured 322 commits, ZERO outside A3/B/C/D and zero outside canonical**, with a
322-shared control proving the comparison had inputs. No unique content, so the copy buys nothing, and
the coordinator withdrew the instruction at 08:24Z on that evidence.

> **THE CLASS SURVIVES EVEN THOUGH THE ALARM IS CLOSED, AND IT IS THE THIRD INSTANCE TONIGHT:**
> **A PRIOR LEG'S PRESERVATION ARTEFACT SAT UNTRACKED IN CANONICAL FOR FOUR HOURS AND NO CENSUS SAW IT** —
> because it is untracked, and because it is a *bundle* rather than a *commit*, and every census tonight
> counted commits. They remain untracked and uncopied, by decision, with zero unique content. [M]

## 6. THIS COPY CONTAINS UNREVIEWED APPLICATION CREDENTIALS

> **SCANNED AFTER THE COPY, IN THE DESTINATION.** Pattern `ft_[0-9a-f]{64}`. **6 files contain a match;
> 3 distinct token values.** Referenced by sha256[:16] so they are not restated anywhere:
> `4b2cbad8ec9ab3cb`, `18844ad6326024e0`, `7652751c6db25788`. Scanner canary on a planted match: 1. [M]
>
> Files: `farmtable-f61-isolate/verify-fixes.mjs`farmtable-f61-v2/test-all-features.cjs,farmtable-f61-v2/test-edge-colors.cjs farmtable-f61-v2/test-solo-bug.cjs`farmtable-f61-v2/test-solo-scenarios.cjs`farmtable-f62-task-urls/verify-f62-deep-links.mjs`
>
> Independently found by relocate-offhost's authorised scan, same 3 values, same 6 files, same 3 trees.
> One is introduced by a comment reading *"Set localStorage token before navigating to bypass login"*.
> **MEASURED by that leg: 0 of the 3 appear in canonical's history and 0 in the off-host push, so nothing
> is exposed yet.** Neither of us has tested whether they are still valid — that would be an
> authentication attempt and neither leg is authorised to make one.
>
> **CONSEQUENCE FOR ANY LATER READER: IF THIS DIRECTORY IS EVER BUNDLED, PUBLISHED, PUSHED OR COPIED
> OFF-HOST, THREE LIVE-SHAPED CREDENTIALS TRAVEL WITH IT.** The off-host relocation that is still
> outstanding must treat this directory as credential-bearing, not as inert text.

---

# PASS 3 — THE 22 FILES IN NO REPOSITORY (coordinator 08:43Z)

Captured 2026-07-29T08:46:05Z. **22 files sitting directly in `/workspace`, which is not a
git repository at all.** Re-derived independently with `find /workspace -maxdepth 1 -type f`:
**22 found, 22 in the coordinator's list, zero disagreement in either direction.** [M]

```
fatal: not a git repository (or any parent up to mount point /)
```

> **NOT-IN-ANY-REPO IS THE TERMINAL RUNG, BELOW GITIGNORED.** Every rescue mechanism built tonight —
> bundles, clones, the census, the off-host push, tree copies — **takes a repository as its unit.**
> These 22 were invisible to all of them, not because a filter excluded them but because no
> instrument was ever pointed at a directory that has no `.git`.

| Assertion | Value |
|---|---:|
| rows | 22 |
| **destination absent before write, per file** | **22** |
| already present | 0 |
| copied | 22 |
| **comparisons actually made** | **22** |
| **files written** | **22** |
| **mismatches** | **0** |

**Clause three asserted and published: comparisons-made 22 == files-written 22.** Canary: one byte
flipped → 1 mismatch; restored → 0. [M]

## 3.1 THE FOUR PRE-REGISTRATIONS — mtimes PRESERVED, AND THE ORDERING TESTED

`cp --preserve=timestamps`; verified equal at both ends for all four. **But a preserved mtime is
only worth what it proves, so I tested the property itself** — does each prediction pre-date its
result? [M]

| Prediction | mtime | Result | mtime | Δ | Verdict |
|---|---|---|---|---:|---|
| `merge-completeness-prediction.txt` | 2026-07-28 04:46:12 | `merge-verify.out` | 2026-07-28 04:46:42 | +30s | **stands** |
| `orphan-scan-prediction.txt` | 2026-07-28 05:27:44 | `orphan-scan.control.out` | 2026-07-28 05:27:46 | +2s | **stands** |
| `orphan-scan-prediction.txt` | 2026-07-28 05:27:44 | `orphan-scan.out` | 2026-07-28 05:27:54 | +10s | **stands** |
| `combined-prediction.txt` | 2026-07-28 04:21:40 | `em-gate-194c.out` | 2026-07-28 04:22:49 | +69s | **stands** |

All four pre-date their results. **The pre-registrations are genuine and are now preserved with the
evidence intact.** `prediction-195-r7.txt` (2026-07-28 04:27:04) has no result file I could pair to
it in this set — recorded as unpaired rather than assumed matched.

> **ANOMALY IN THE SAME SET, FOUND BY LOOKING AT THE TIMESTAMPS RATHER THAN JUST SAVING THEM:**
> `orphan-scan.sh` has mtime **2026-07-29 07:06:27** — **26 hours NEWER than its own output**
> `orphan-scan.out` (2026-07-28 05:27:54). The `.out` files were produced by a version of the script
> that no longer exists on disk. The prediction/result pair is still evidence; **the script is not a
> reproduction recipe for it**, and anyone who re-runs it and gets a different answer has learned
> nothing about the original run.

## 3.2 TWO FILES NAMED `.eng-manager-state.md`, A FACTOR OF 231 APART

**Never refer to either by basename.** [M]

| Full path | Bytes | mtime | sha256[:16] |
|---|---:|---|---|
| `/workspace/.eng-manager-state.md` | 3,275 | 2026-07-28 11:24:39 | `f44b81cc760894fd` |
| `/workspace/farmtable/.eng-manager-state.md` | 756,039 | 2026-07-29 08:06:34 | `0b2ff90603eba6bc` |

**Both are copied**, at their full relative paths, pending the engineering manager's confirmation of
which is its actual continuity file.

## 3.3 A LIVE CONTINUITY FILE CANNOT BE PRESERVED BY A COPY

`/workspace/.coordinator-state.md` was measured at **three different sizes in thirteen minutes**: [M]

| When | Bytes | sha256[:16] | Where it is |
|---|---:|---|---|
| pass 2, ~08:32Z | 1,111,751 | `2fa65db48ddac18e` | `.coordinator-state.md` |
| 08:39:30Z | 1,130,090 | `9b7d979d85bcbc44` | `.coordinator-state.md.snapshot-20260729T083930Z` |
| 08:45:07Z (live) | 1,138,728 | — | not copied; still growing |

> **"SOURCE DRIFT 0" IS A STATEMENT ABOUT AN INTERVAL, NOT ABOUT A FILE.** My pass-2 drift check was
> honest and correct — the file did not change between the copy and the re-hash. It then grew twice
> more. **For an append-growing file, every copy is stale on arrival and the only true statement is
> the timestamp of the snapshot.** Both snapshots are kept: overwriting the earlier one would have
> destroyed the artefact that the pass-2 proof actually verified.

## 3.4 FULL INVENTORY OF THE 22

```
     bytes  mtime                source path
   1130090  2026-07-29T08:39:30  /workspace/.coordinator-state.md
      3275  2026-07-28T11:24:39  /workspace/.eng-manager-state.md
      3300  2026-07-29T01:21:15  /workspace/.route5-probe.md
       119  2026-07-29T00:23:46  /workspace/_em-shared-mount-probe.txt
      5752  2026-07-23T00:45:10  /workspace/agents.md
      1040  2026-07-28T04:21:40  /workspace/combined-prediction.txt
      1783  2026-07-28T03:44:54  /workspace/em-gate-194.out
      4641  2026-07-28T03:45:35  /workspace/em-gate-194.sh
      3996  2026-07-28T03:46:22  /workspace/em-gate-194.v2.out
      3996  2026-07-28T04:15:00  /workspace/em-gate-194b.out
      4642  2026-07-28T04:13:51  /workspace/em-gate-194b.sh
      3997  2026-07-28T04:22:49  /workspace/em-gate-194c.out
      4643  2026-07-28T04:21:40  /workspace/em-gate-194c.sh
      2745  2026-07-28T04:46:12  /workspace/merge-completeness-prediction.txt
      1103  2026-07-28T04:46:42  /workspace/merge-verify.out
      4434  2026-07-28T04:46:38  /workspace/merge-verify.sh
      1326  2026-07-28T05:27:44  /workspace/orphan-scan-prediction.txt
      4094  2026-07-28T05:27:46  /workspace/orphan-scan.control.out
       899  2026-07-28T05:27:54  /workspace/orphan-scan.out
       858  2026-07-29T07:06:27  /workspace/orphan-scan.sh
       390  2026-07-28T04:27:04  /workspace/prediction-195-r7.txt
     52277  2026-07-23T04:53:04  /workspace/projects.md
```

---

# PASS 4 — THE MODIFIED-TRACKED POPULATION (NOT REACHED 23, now closed)

Every earlier pass covered *untracked* or *ignored* files. Tracked files with uncommitted
modifications had been measured once, early, and reported as "a single source change". **That was a
sample of one presented as a class.** Measured as a population across 233 trees: [M]

| Quantity | Value |
|---|---:|
| modified/staged/deleted entries | **25** (all ` M`) |
| trees containing any | **23** |
| worktree content that exists in some object store | **20** |
| **worktree content that exists NOWHERE — at risk** | **5** |

The five, all copied (comparisons-made 5 == files-written 5, mismatches 0, canary fired then restored):
```
   54757  farmtable-deploy-19/web/package-lock.json
     626  farmtable-deploy-19/web/package.json
   95565  farmtable-perf2-dev/web/package-lock.json
     626  farmtable-perf2-dev/web/package.json
     283  farmtable-deploy-17/proto/buf.lock
```

> The one file everyone remembered — `farmtable-xss-r4/internal/server/scopes.go` — is **not** at
> risk; its modified content already exists in an object store. **The spot check found the
> memorable file and missed all five of the exposed ones**, because a lockfile edit is boring and a
> `.go` edit is interesting. THE SAMPLE WAS DRAWN BY SALIENCE, AND SALIENCE IS ANTI-CORRELATED WITH
> WHAT GETS LOST.

# NOT REACHED 19, 20, 21 — ALL THREE CLOSED, ALL THREE CLEAN NEGATIVES

**20 — ignored sweep with NO extension filter at all.** 233 trees, **1,646,788 ignored files**.
1,110,830 under `node_modules`; 534,127 under `web/dist`; **1,830 residue**. Content-tested all
1,830 against canonical and each file's own store: **1,416 in neither**, which decompose entirely
into 1,377 `tsc` outputs under `web/.tmp-test/` (`.js`/`.d.ts`/`.map` triples), 27 compiled `ft`
binaries (1.26 GB), and the 12 already copied. **All 208 ignored `.go` files are present in an
object store. Of 148 ignored `.md`, only the 5 already-known `.scratch` reviews are at risk.**
**Removing the extension filter surfaced zero new authored content.** [M]

**19 — content-test of the build-output directories.** 534,128 files. hashes==paths asserted;
batch-check control fired both ways in the same invocation. **534,034 missing from canonical — but
only 2,227 DISTINCT CONTENTS**, of which **2,050 are Shoelace icon assets** (`web/dist/shoelace/`)
and **177 are Vite bundle outputs** (`index-<contenthash>.js/.map/.css`, `index.html`). Zero
authored files. My path-shape exclusion was correct — **and it is now measured rather than judged.**

> **533,000 FILES AND 2,050 FACTS.** A file count over 233 near-identical trees is a multiplier on
> the tree count, not a measure of content. Every large number tonight that frightened somebody has
> deflated the same way once it was counted by distinct content instead of by path.

**21 — `farmtable-em-verify195`, read-only** (authorised 08:37Z; status and ls-files only, no write,
no fetch, no ref change, nothing touched under its worktrees). **Untracked-not-ignored 0, modified
0, ignored non-node_modules 18** — and all 18 are `.tmp-test` `tsc` output (`.d.ts`/`.js`/`.map`),
the same regenerable class excluded everywhere else in this manifest. **Not copied, named here:**
```
farmtable-em-verify195/web/.tmp-test/gen/types.d.ts
farmtable-em-verify195/web/.tmp-test/gen/types.js
farmtable-em-verify195/web/.tmp-test/gen/types.js.map
farmtable-em-verify195/web/.tmp-test/store/task-store.d.ts
farmtable-em-verify195/web/.tmp-test/store/task-store.js
farmtable-em-verify195/web/.tmp-test/store/task-store.js.map
farmtable-em-verify195/web/.tmp-test/util/markdown.d.ts
farmtable-em-verify195/web/.tmp-test/util/markdown.js
farmtable-em-verify195/web/.tmp-test/util/markdown.js.map
farmtable-em-verify195/web/.tmp-test/util/markdown.test.d.ts
farmtable-em-verify195/web/.tmp-test/util/markdown.test.js
farmtable-em-verify195/web/.tmp-test/util/markdown.test.js.map
farmtable-em-verify195/web/.tmp-test/utils/task-ready.d.ts
farmtable-em-verify195/web/.tmp-test/utils/task-ready.js
farmtable-em-verify195/web/.tmp-test/utils/task-ready.js.map
farmtable-em-verify195/web/.tmp-test/utils/task-ready.test.d.ts
farmtable-em-verify195/web/.tmp-test/utils/task-ready.test.js
farmtable-em-verify195/web/.tmp-test/utils/task-ready.test.js.map
```

**THE LAST UNMEASURED PATH-SHAPE EXCLUSION I HOLD IS `node_modules`: 1,110,830 files, never
content-tested, excluded because they are installed dependency trees reproducible from lockfiles.
That is a judgement. It stays filed as a bound, not closed.**

---

# PASS 5 — SECURITY EXCLUSIONS, POINTERS, AND TWO WARNINGS ABOUT READING THIS DIRECTORY

## 5.1 ⚠ SECURITY EXCLUSION — LOAD-BEARING, NOT DESCRIPTIVE

The copy set denies these extensions outright: **`.db` `.db-wal` `.db-shm` `.sqlite` `.sqlite3`**.

**Reason, stated so a later reader cannot mistake it for tidiness:**
`/workspace/farmtable-passthrough-write-p1/test-writethrough.db` (126,976 B,
sha256[:16] `d72bb520918e7a28`) contains **the host's live GitHub Personal Access Token** — provider
github, type pat, scopes [repo, read:org], status active, with push rights on 279 repositories and
admin on 243. It was **not** scrubbed, tested, opened for writing, or read into any log by this leg.

The deny was in place at **08:33Z**, before either warning about the file arrived.

> **THIS DENY IS NOT DEFENCE IN DEPTH. IT BECOMES LOAD-BEARING THE MOMENT THIS POPULATION WIDENS FROM
> `ignored` TO `untracked ∪ ignored`, AND THE POPULATION HAS BEEN WIDENED REPEATEDLY.**
> Any future instruction to widen an enumeration is a **security change** and requires this deny to be
> re-verified, never inherited.

> **THE COPY SET IS AN ALLOW-LIST OF CLASSES, NOT A DENY-LIST, SO WIDENING AN ENUMERATION CANNOT WIDEN
> THE COPY.** The deny exists anyway, because **a later reader may build a copy from the enumeration
> rather than from the allow-list.** The enumeration is the artefact that travels. The allow-list is a
> property of the agent who wrote it, and that agent will not be here.

### 5.1.1 The file is now invisible as well as unpublished

At **2026-07-29T09:01:15Z** `/test-writethrough.db` was added to
`/workspace/farmtable/.git/info/exclude` (the common dir; it binds canonical and all linked worktrees).

> **THE MITIGATION MOVED A LIVE CREDENTIAL INTO THE WORSE HALF OF UNCOMMITTED.** It is protected from
> bulk capture and simultaneously invisible to `git status`, to `--exclude-standard`, and to every
> default sweep any future agent runs.
>
> **THIS MANIFEST ENTRY IS NOW THE ONLY INDEX OF A FILE THAT NO ORDINARY ENUMERATION WILL SURFACE
> AGAIN.** Do not delete this section. A sweep that comes back clean after this date is clean for the
> wrong reason.

## 5.2 POINTER — THE COORDINATOR CONTINUITY FILE IS **NOT** COPIED HERE ANY FURTHER

`/workspace/.coordinator-state.md` is an **append-growing** file. A copy of it is stale on arrival and
the race is unwinnable. Two snapshots taken by this leg are retained (the earlier one is the artefact
the pass-2 drift proof verified; replacing it would destroy the evidence).

The correct mechanism already exists and is **pointed at, not duplicated**:

| | |
|---|---|
| directory | `/scion-volumes/scratchpad/projects/farmtable/backups/coordinator-state/` |
| snapshots | **49**, each hash-verified equal to the live file when taken |
| newest | `coordinator-state-20260729T084507Z.md`, 1,138,728 B, 2026-07-29 08:45:07Z |
| newest sha256 | `be4e0349c6ee800057755117db6b7f30e61f7853121554514c441f6ffc459733` |
| newest == live at time of writing | **yes** |

> **THAT SERIES AND THIS DIRECTORY ARE ON THE SAME SPINDLE.** Both `st_dev` **2049**. The continuity
> file exists as 49 copies in one directory on one disk, plus a live one, and **every one of them dies
> together.** Flagged for the relocation leg. Not acted on here.

## 5.3 ⚠ A NAMING CONVENTION IN THIS DIRECTORY MANUFACTURES PHANTOM DELETIONS

`em-gate-194.out`, `em-gate-194.v2.out`, `em-gate-194b.out`, `em-gate-194c.out` are preserved here.
**They are named for the script version. The script version stopped tracking the root at `c`:**

| script | root it actually ran against | tree exists? |
|---|---|---|
| `em-gate-194.sh` | `/workspace/farmtable-em-gate194` | yes |
| `em-gate-194b.sh` | `/workspace/farmtable-em-gate194b` | yes |
| `em-gate-194c.sh` | **`/workspace/farmtable-194-combined`** | yes |
| *(what a reader assumes)* | `farmtable-em-gate194c` | **NEVER EXISTED** |

> **A READER OF `em-gate-194c.out` LOOKS FOR A TREE CALLED 194c, FINDS NOTHING, AND CONCLUDES A TREE
> WAS DELETED. UNDER A FREEZE PREMISED ON NOTHING BEING DELETED, THIS NAMING MANUFACTURES A PHANTOM
> DELETION.** Nothing was deleted. The output was never about a tree of that name.

Also, for anyone comparing these files: **`em-gate-194.v2.out` and `em-gate-194b.out` are both 3,996
bytes and differ on 20 lines.** Size equality is not content equality anywhere in this directory.

## 5.4 ⚠ THREE FILES HERE ARE ORPHANED RECEIPTS

Their producing script no longer exists in the version that produced them:

| output | producing script | gap |
|---|---|---|
| `orphan-scan.out` | `orphan-scan.sh` edited 25.6 h later | +92,313 s |
| `orphan-scan.control.out` | same | +92,321 s |
| `em-gate-194.out` | `em-gate-194.sh` overwritten **41 s** later | +41 s |

> **THE CONTROL IS ORPHANED TOO.** The artefact whose entire job is to prove the detector was alive
> cannot itself be reproduced by any script on this host.
>
> Re-running these teaches nothing: a different answer says nothing about the original run, and **the
> same answer says nothing either, because you cannot tell which version produced it.**

## 5.5 THE MOST VALUABLE FILE IN THIS DIRECTORY, AND WHY IT IS HERE BY ACCIDENT

`merge-completeness-prediction.txt` — 2,745 B, mtime 2026-07-28 04:46:12Z, **in no repository, in zero
of the 233 object stores on this host.** Its falsifier F5 states the void-harness rule
(*"a zero-length comparison that prints 0 mismatches … has bitten this workstream nine times"*), and
`merge-verify.sh` — also preserved here — enforces it with three `die` guards at lines 40, 41 and 96.

That rule was rediscovered from scratch, at full price, by this leg 28 hours later.

> **A RULE THAT IS WRITTEN, IMPLEMENTED, AND ENFORCED IN ONE SCRIPT PROTECTS EXACTLY ONE SCRIPT.**
> **THE DEFECT IS NOT UNARMED RULES. IT IS UNROUTED ONES.**
>
> This file was not preserved because anyone valued it. **It was preserved because it was in a
> directory listing.** Salience missed the most valuable file in the set and a blanket sweep caught it.
> **That is an argument for the blanket, not for better judgement.**

## 5.6 WHERE THIS DIRECTORY ITSELF LIVES

`/scion-volumes/scratchpad` is a **git working tree** with **10 tracked files and 12,799 untracked**,
**nothing gitignored**, **no remote**, last commit 2026-07-28 01:50:20Z.

> **THIS DIRECTORY IS 284 UNTRACKED FILES IN A REPOSITORY WITH NOWHERE TO PUSH.** There are 18
> untracked `.bundle` files on this host and **zero tracked ones.** The artefacts produced to prove
> that work is recoverable are themselves uncommitted, unpushed, and on the same spindle as the
> originals.
