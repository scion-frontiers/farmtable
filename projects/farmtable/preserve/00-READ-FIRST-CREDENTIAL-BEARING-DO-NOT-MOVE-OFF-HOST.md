> # ⚠ ADDED 2026-07-29T10:28Z — READ THESE FIVE LINES BEFORE ANYTHING ELSE IN THIS DIRECTORY
>
> **1. NOTHING IN THIS DIRECTORY IS OFF-HOST.** Measured: `/workspace/farmtable` and this
> scratchpad are both on **st_dev 2049**, and there is exactly **one persistent block device on
> this machine** (`sda1`, 200 GB). `/tmp` and `/var/tmp` have a different device *number* and are
> the **same physical disk** — a different device number is not a different device. The only other
> writable storage is 64 MB of RAM.
>
> **2. CORRECTED 10:36Z — THE PREVIOUS TEXT HERE WAS FALSE AND IT WAS MINE.** It read: *"the
> filename `OFFHOST-MANIFEST.md` names a property it does not have … **No move has occurred.**"*
> **A MOVE DID OCCUR.** At 07:32Z, 66 refspecs covering 268 at-risk commits were pushed to a
> private third-party remote. It is written down in `OFFHOST-MANIFEST.md` **PART 4, line 263,
> marked COMPLETE**, and that file announces the supersession *at line 26*. I flagged the file by
> its **name** and never opened it. Status of the move: **DOCUMENTED, NOT RE-VERIFIED** — confirming
> the refs are still on that server requires contacting it, which tests the credential, which is
> prohibited. Do not upgrade it past DOCUMENTED.
>
> **THE DISTINCTION THAT MATTERS, AND IT IS THE WHOLE POINT OF THIS BANNER:** *commits* are
> off-host; **this directory is not.** The bundles, the reports and the 63 authored prose files
> here are not commits, were never candidates for that push, and remain on one disk. Point 1 above
> is unaffected and still measured. Likewise "DO-NOT-MOVE-OFF-HOST" in *this* file's own name is
> still a prohibition, not an accomplished state.
>
> **THE ERROR TO LEARN FROM IS NOT THE FALSE SENTENCE, IT IS HOW I GOT IT.** I applied my own rule
> — *a noun in a filename is not a measurement* — as though the name **disproved** the property.
> It does neither. **A HEURISTIC THAT VOIDS A PIECE OF EVIDENCE FEELS LIKE SKEPTICISM AND IS ITSELF
> AN UNSOURCED CLAIM.** Reading the file cost eleven seconds.
>
> **3. THE BUNDLES ARE VERIFIED AND THEY ARE INSURANCE AGAINST THE WRONG THING.** They protect
> against *logical* loss — a bad rewrite, a deleted ref, a `gc`, an `rm -rf`. They do **not**
> protect against loss of the disk, because they are on it.
>
> **4. TO ACTUALLY RECOVER THE AT-RISK TEST FILE, YOU MUST CHECK OUT A SPECIFIC BRANCH.** A plain
> `git clone` of the bundle lands on `task-state-web-ui-v2`, **which does not contain the file.**
> Full executed transcript: `RESTORE-VERIFICATION-20260729T1027Z.log` in this directory.
>
>     git clone <bundle> restored && cd restored
>     git checkout -b recovered origin/url-scheme-validation-r6
>     git hash-object web/src/util/url-binding-scan.test.ts
>     # must print c8cb6993581fa202c44cf702f41680fa96442a78   (68066 bytes)
>
> **5. THE CREDENTIAL WARNINGS BELOW ARE UNCHANGED AND STILL BINDING.**

---

# 00 — READ FIRST. THIS DIRECTORY IS CREDENTIAL-BEARING. NOTHING IN IT MAY LEAVE THIS HOST.

Written 2026-07-29 by agent `farmtable-preserve-bundle`, who owns this directory.
Written as a **file** and not as a message on purpose:

> **A CONTROL DELIVERED BY MESSAGE PROTECTS ONLY THE AGENTS WHO WERE RUNNING WHEN IT WAS SENT.**
> The reader who matters here is a human who was running nowhere.

---

## 1. THE RULE, BEFORE THE EVIDENCE

**NO COPY OF THIS DIRECTORY, WHOLE OR PARTIAL, MAY LEAVE THIS HOST UNTIL `ptone` HAS RULED.**

An off-host move of this set is permitted only in one of two forms:

- **REFS ONLY** — a git bundle / ref transfer. Bundles carry git objects. They do not carry the
  working files listed in §2, and none of the credential-bearing files in §2 is a tracked git
  object. This is the safe channel.
- **DIRECTORY COPY WITH AN EXPLICIT EXCLUSION OF EVERY PATH IN §2, EACH TYPED IN FULL.**
  Not a glob. Not a directory. Not `--exclude '*.config*'`. **If you cannot name every file the
  command will touch before you run it, do not run it.**

**PRE-REGISTERED TRIGGER, ADOPTED FROM THE COORDINATOR 2026-07-29T09:29Z:**
if any off-host move is proposed or attempted before `ptone` rules, **it stops** — whoever proposes
it, however partial, **including the coordinator, including me.**

**DO NOT DELETE, EDIT, MOVE, SCRUB OR REDACT ANY FILE NAMED BELOW.** They are evidence and the
freeze covers them. **DO NOT PRINT THEIR VALUES.** Everything below is stated as paths, line
numbers, byte offsets and `sha256[:16]` digests — no secret value appears in this file and none
should be added to it.

---

## 2. THE FILES. MEASURED 2026-07-29T09:3xZ, NOT PREDICTED.

Population screened: **all 285 files under `preserve/`**, selector `find … -type f -print0` — no
name filter, no extension filter, no depth bound, NUL-delimited.
**Files matching a credential shape: 9. Of those, 8 confirmed real and 1 is a false positive.**
(Corrected from 284: the 285th is **this file**, which I created between the two counts. It is also
why the userinfo branch returns 4 hits and not 3 — **the warning trips the detector it warns about**.)

**SELECTOR COVERAGE, STATED NEXT TO THE CLEAN RESULT AND NOT IN A LATER MESSAGE.** `-type f` drops
two things, both verified by controls planted where the selector could reject them: **a symlink to a
file**, and **a file reachable only through a symlinked directory**. Measured against this tree:
**0 symlinks of any kind, 0 symlinks to directories, 0 non-regular entries**, and `find -L` returns
the same 285. **The holes are real and they are empty.** If anyone adds a symlink to this directory
later, this screen no longer covers it.

### 2.1 THE LIVE HOST GITHUB PAT — the serious one

```
preserve/gc-config-before-20260729T070627Z/farmtable.config.before
```
| property | value |
|---|---|
| size | 11,584 bytes, 416 lines |
| mtime | 2026-07-29 07:06:27Z |
| sha256[:16] of the FILE | `8a7265b2ff66155f` |
| credential | **`github_pat_` fine-grained PAT, embedded in a remote URL as userinfo** |
| location | **LINE 7 — the `url` key of the `[remote "origin"]` section. ONE LINE.** |
| byte offsets on that line | `//`-userinfo begins at byte **123**; `github_pat_` literal begins at byte **140** |

This is the host's **live** PAT. Previously measured on this host as: provider github, type pat,
scopes `[repo, read:org]`, status **active**, **push rights on 279 repositories, admin on 243**.
Its value has deliberately **never been tested** by any agent — testing it is an authentication
attempt. That decision is `ptone`'s to revisit, not ours.

**HOW IT GOT HERE, AND WHY THAT IS THE ACTUAL FINDING:** this file was written at **07:06:27Z by
gc-safety work**, not by the 08:45Z uncommitted-file copy. So the credential reached this directory
by **two independent routes on the same night, neither coordinated with the other, both while doing
safety work.**

> **WE ALL CLASSIFIED THIS DIRECTORY AS PROTECTION RATHER THAN AS CONTENT, AND NOTHING THAT IS
> CLASSIFIED AS PROTECTION EVER GETS SCREENED FOR WHAT IT CONTAINS.**

Had the off-host move gone as a directory copy rather than as refs, it would have carried the PAT as
payload through the one channel nobody was guarding.

### 2.2 THREE APPLICATION AUTH TOKENS, IN SIX FILES

Format `ft_` + 64 hex. Referenced only by `sha256[:16]` of the token value. All three were already
indexed in `MANIFEST.md`; **this screen found no fourth token.**

| token sha256[:16] | count | files |
|---|---|---|
| `7652751c6db25788` | 4 | `uncommitted-…-0845Z/farmtable-f61-v2/test-all-features.cjs`, `…/test-edge-colors.cjs`, `…/test-solo-bug.cjs`, `…/test-solo-scenarios.cjs` |
| `18844ad6326024e0` | 1 | `uncommitted-…-0845Z/farmtable-f62-task-urls/verify-f62-deep-links.mjs` |
| `4b2cbad8ec9ab3cb` | 1 | `uncommitted-…-0845Z/farmtable-f61-isolate/verify-fixes.mjs` |

(`uncommitted-…-0845Z` = `uncommitted-SAME-DISK-NOT-A-BACKUP-20260729T0845Z`.)

### 2.3 ~~ONE FILE NOT CLEARED~~ — **NOW CLEARED, 2026-07-29T09:5xZ. SUPERSEDED, NOT DELETED.**

```
preserve/uncommitted-SAME-DISK-NOT-A-BACKUP-20260729T0845Z/farmtable/.eng-manager-state.md
```

**ORIGINAL RESERVATION (kept verbatim, because the reason it was cleared matters more than a tidy
list):** three `//…@` userinfo-shaped matches at **lines 77, 11533, 11683**; zero hits for
`github_pat_`, `ghp_`, `gho_`, `ghs_`, `ft_[0-9a-f]{64}`. I declined to call it clean because
*"matches no prefix I thought to test" is a statement about my pattern list, not about the file.*

**WHAT THE THREE HITS ARE.** Reproduced to the exact line by agent `farmtable-relocate-offhost`
with an independent pattern. All three are the project's own **redaction rule**, quotable because
there is no secret in them:

```
line 77      sed 's#//[^@]*@#//REDACTED@#g'
line 11533   sed -E 's#//[^@]*@#//REDACTED@#g'
line 11683   - Redact PATs from every echo: sed -E 's#//[^@]*@#//REDACTED@#g'
```

> **THE CREDENTIAL DETECTOR FIRED ON THE INSTRUCTION FOR REDACTING CREDENTIALS.** The rule
> `//[^@]*@` is a literal userinfo shape — it is the exact thing it exists to destroy. **14 files on
> this host contain it**, including the briefs that commissioned this work.

**WHY THAT ALONE WAS NOT ENOUGH TO CLEAR IT.** Explaining three specific hits answers a different
objection than the one I raised. Mine was about *coverage*. So it was answered separately, with a
**prefix-free** instrument: every opaque run of ≥20 characters from `[A-Za-z0-9_+/=-]`, no vendor
prefixes at all, so that a token from a vendor nobody here has heard of cannot slip through.
Controls all seen, including a deliberately fictional `xyzzy_UNKNOWNVENDOR_…` — that is the control
that actually tests the objection. 756,039 bytes, 12,521 lines, **531 distinct opaque runs, residue
read rather than counted: every one is a filesystem path, a `refs/preserve/…` name, a Go test name,
an env-var name, or a git SHA. No opaque high-entropy token of any shape.**

**RULING: NOT CREDENTIAL-BEARING.** It remains inside the §1 directory rule, because that rule is
about this directory and not about this file.

> **A CAUTION FOR WHOEVER VERIFIES A REDACTION HERE LATER:** the replacement text `//REDACTED@` is
> **itself userinfo-shaped**, so redacting a URL does not lower the hit count. An already-redacted
> file scores exactly as dirty as an un-redacted one. **Never confirm a redaction by counting
> detector hits before and after — compare the specific bytes at the specific offsets.**

### 2.4 ONE FALSE POSITIVE, RECORDED SO NOBODY RE-DISCOVERS IT

```
preserve/uncommitted-…-0845Z/farmtable-passthrough-write-p2/screenshots/p2-01-farmtable-all-enabled.png
```
Magic `89504e47` — a real PNG. The `//…@` match is a byte coincidence in compressed image data.
Zero matches for every token prefix. **Not credential-bearing.** It is still inside the directory
that must not leave, so the rule in §1 covers it anyway.

---

## 3. A DISAGREEMENT WITH THE ORDER THAT COMMISSIONED THIS FILE

The coordinator's 09:29Z order described the PAT as *"url-userinfo @117, PAT literal @140,
fine-grained @140."* Read as line numbers — which is how a reader will read them, because every
other position cited in this project has been a line number — that is three findings in two places.

**It is one credential, on one line, matched by overlapping patterns. 117 and 140 are BYTE OFFSETS,
not line numbers. Line 117 of this file is `[branch "feat/passthrough-…"]` and line 140 is a
`merge =` line; neither contains anything.** There is no `ghp_` literal anywhere in the file — the
"PAT literal" and the "fine-grained" hit are the *same match* reported under two labels, which is
why they share an offset.

**The security conclusion is unchanged and just as serious.** The count matters only for the one
purpose this file exists to serve: **anyone redacting or excluding needs to know it is exactly one
line, so they can tell whether they got it all.** Three vague locations invite three partial fixes.

> **A POSITION CITED WITHOUT ITS UNIT IS READ IN WHATEVER UNIT THE READER HAS BEEN USING.**

## 4. AND THE APPARATUS FAILURE THAT NEARLY MADE ME MISS THE PAT ENTIRELY

My first screen of this file reported **URL-userinfo only, and no PAT literal.** That was wrong and
it was my tooling, not the file.

**`awk` on this host is mawk, and mawk does not support ERE interval expressions.** `/ghp_[A-Za-z0-9]{20,}/`
does not error — **it silently never matches.** Verified directly: `echo aaaa…(25 a's) | awk '/a{20,}/{print}'`
prints nothing, while `grep -cE 'a{20,}'` on the same input returns 1.

> **AN UNSUPPORTED REGEX FEATURE FAILS AS "NO MATCH", NOT AS AN ERROR. A CREDENTIAL SCANNER WRITTEN
> IN mawk WITH A `{n,}` QUANTIFIER REPORTS A CLEAN HOST.**

Anyone writing another credential sweep here: **use `grep -E`, not `awk`, for any pattern containing
`{n,}` — and prove the scanner can say YES by feeding it a known positive before you believe a NO.**

---

## 5. WHAT THIS DIRECTORY ACTUALLY IS

Stated plainly, because the name `preserve/` implies a safety it does not have:

- **285 files, all UNTRACKED**, in a git repository (`/scion-volumes/scratchpad`) that **has no
  remote**. Zero of them have ever left this disk.
- The bundle in here was produced to prove six commits are recoverable. **The bundle is itself an
  uncommitted file on the same spindle as the commits it protects.** There are 18 untracked
  `.bundle` files on this host and **zero tracked ones**.
- The brief that commissioned this work opens with **"A BACKUP FILE IS A RECEIPT."** That thesis
  applies to this directory. See `MANIFEST.md` §5.6.

**A restore HAS been performed and verified** — see `MANIFEST.md`. That part is real. The durability
of this directory is not.

---

## 6. IF YOU ARE THE HUMAN READING THIS IN THE MORNING

1. Nothing here has been sent anywhere. No off-host move has occurred.
2. Nothing here has been deleted, edited or scrubbed. The freeze held.
3. The live PAT in §2.1 has **not** been tested, rotated, or revoked. That is your call and it is
   the first one to make.
4. The `.db` file holding the same PAT elsewhere on this host
   (`/workspace/farmtable-passthrough-write-p1/test-writethrough.db`, sha256[:16] `d72bb520918e7a28`)
   is **deliberately excluded** from this preserve set on security grounds. That exclusion is
   load-bearing: it means the file will not appear in ordinary enumerations of what has been
   captured. `MANIFEST.md` §5.1.1 is the only index of it.
