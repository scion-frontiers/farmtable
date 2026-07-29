# ARTEFACT MANIFEST - relocate-offhost leg - 2026-07-29

Published on the coordinator's 10:53:32Z authorisation. **Every file here is text this leg authored
or captured. No credential value appears in any of them** - the receipt was leak-checked for
`ghp_`/`ft_`/userinfo-URL/AWS-key/private-key patterns and returned zero on all of them; the only
long-hex strings it contains are git object IDs.

Purpose: before this directory existed, finding **#244 ("no credential went off-host") rested
entirely on one leg's transcript.** These artefacts let another leg re-run it.

---

## THE ARTEFACTS, AND THE FIGURE EACH ONE SUPPORTS

### 1. `inv-userinfo-rerun.py`  - THE SCANNER
The instrument behind **#244**. Run it and it re-derives every number in the receipt.

It supports, and is the only re-runnable evidence for:
* **"No credential went off-host."** Four by-value needles + eight format detectors, all zero.
* **The #209 correction.** It runs the OLD colon-requiring userinfo pattern and the NEW admitting
  `://[^/\s]*@` pattern **side by side on the same bytes**, so the 0-vs-19 discrepancy is reproduced
  rather than described. The old pattern's blindness is encoded as a CONTROL that *requires* it to
  miss a token-only URL.
* **The control discipline.** 19 controls run BEFORE the population; `assert not bad` means a dead
  detector ABORTS rather than reporting clean. `assert fed==len(objs)` is the enumerated-equals-fed
  set-equality check.

**Secrets are recovered by hash and never printed** (`recover_secrets` matches candidate values
against `sha256[:16]` constants and keeps them in memory only). The script requires
`/tmp/inv/restore.git`; see LIMITATION below.

### 2. `inv-userinfo-rerun.out` - THE RECEIPT
Captured stdout of a **second, independent execution** of the scanner. The figures reproduced
exactly: **5397 objects, 46766499 bytes, 19 userinfo hits, all twelve other detectors zero.** Two runs,
identical numbers.

Per bulletin 15 item 7 - *an empty artefact cannot distinguish "ran and found nothing" from "never
ran"* - this receipt carries **the companion positive arm from the same run**. The control block at
the top proves each detector said YES to something before the population block reports zeros. **The
zeros are witnessed, not merely stored.**

### 3. `inv-exclude.before.20260729T0904Z` - THE REVERT SOURCE
The pre-write state of `/workspace/farmtable/.git/info/exclude`, 240 B, 6 lines,
sha256 `6671fe83b7a07c8932ee89164d1f2793b2318058eb8b98dc5c06ee0a5a3b0ec1`.

**Byte-identical to the pre-existing scratchpad copy** `EXCLUDE-REVERT-canonical-info-exclude.before`;
this is a redundant second copy, published because the durability of the original was questioned.

**BEFORE USING IT TO REVERT, RUN THIS CHECK:**
```
python3 -c "b=open('inv-exclude.before.20260729T0904Z','rb').read(); \
l=open('/workspace/farmtable/.git/info/exclude','rb').read(); print(l.startswith(b))"
```
* **True** -> the live file is the before-state plus a pure append. The revert removes only appended
  lines and is safe.
* **False** -> **someone has written to that file since 09:01Z. DO NOT USE THIS ARTEFACT.**

Measured 10:55Z: **True.** The 09:01Z write added 49 lines - **47 comment, 2 blank, and exactly ONE
non-comment rule.** Zero lines removed, zero modified. A 49-line diff carrying a 1-line behaviour
change; diff size is not blast radius.

---

## LIMITATION - READ BEFORE TRUSTING A RE-RUN

The scanner reads `/tmp/inv/restore.git`, a **virgin fetch-back from the remote** - it measures what
the server holds, not what this leg believed it sent. **That directory is on per-agent ephemeral
storage and dies with this leg. It was NOT copied here: it is a `.git` directory and the
filesystem-copy prohibition is absolute.**

So a future re-run must **create its own fresh fetch-back first**. That is strictly better than
inheriting this one - it re-verifies the remote rather than trusting a snapshot of it.

## SCOPE OF WHAT THESE ARTEFACTS ESTABLISH

Per the standing rule that **a clean result reports its scope, never its gaps** - and note the
control hierarchy runs *backwards* through this result:

* **STRONG:** the four credentials that actually exist on this host. Controlled with the real values
  (tier 3, real instance of the hazard). Zero hits.
* **WEAK BUT UNCONTRADICTED:** `ghp_`, `github_pat_`, AWS, private-key, `ft_`-app-token formats.
  Controlled with fabricated probes only (tier 1) - never shown to fire on anything not typed by
  hand. Zero hits.
* **NOT ESTABLISHED:** a high-entropy secret with no recognisable shape; a fifth credential never
  recovered from this host; and **who can read the destination** - see
  `reports/CLOSURE-2026-07-29-offhost-push-audit.md` section 4, which is OPEN and owed to a person.

---

## CHECKSUMS

| file | bytes | sha256 |
|---|---:|---|
| `inv-exclude.before.20260729T0904Z` | 240 | `6671fe83b7a07c8932ee89164d1f2793b2318058eb8b98dc5c06ee0a5a3b0ec1` |
| `inv-userinfo-rerun.py` | 6194 | `edcd6acdb311b18c219990abd74fffbd3d2a711bd3a3d96d4a542b4077ea55e5` |
| `inv-userinfo-rerun.out` | 2502 | `8f2a20541cdb8a45f30a0833dc97064d478061601c28fcff4f23f50a0a937f54` |

Verified on both sides at publication; source and destination hashes matched for every file.

---

## Addendum, authorised 2026-07-29T11:23:31Z — the two ephemeral INPUTS

Bulletin 16 item 9 asked all legs to re-check `/tmp` for **inputs**, not just results. Twenty-two of
this leg's scripts read from `/tmp`; seven distinct input files were found. Two were judged
load-bearing and authorised for publication. **The outcome survives off-host; the yardstick for it
did not.**

| artefact | bytes | sha256 (verified both sides) | the figure it supports |
|---|---|---|---|
| `inv-atrisk-final.txt` | 10,988 | `46725ebe06f31512f7c78d235ec2c5743c66a4c91c38c0009d7249014975f5fe` | **The at-risk commit list.** The definition of this project's subject, and the intent from which the 66 pushed refspecs were built. Without it the remote cannot be audited against what we meant to send. |
| `inv-ts2.txt` | 17 | `f5f3461fdf682e665570e4919aba1c205e7b16456d1cb047567352fde2c57f1f` | The preserve-namespace stamp those 66 refspecs were named with. Required to map a remote ref back to this run. |

Both were published under a **pre-armed** scan, not a retroactive one: a tier-3 REAL-INSTANCE control
(the live host PAT recovered from the 3 `.git/config` locations where it is known to live, proving the
recovery path could fire) plus six tier-2 pattern arms, **all armed before the file was read**. Six
detectors, zero hits on each file. Copy verified by sha256 on both sides.

The remaining five inputs (`inv-stores.txt`, `inv-scanset.txt`, `inv-sweep-shas.tsv`,
`inv-sweep-results.tsv`, `inv-mjs-authored.json`) are left on `/tmp` and will not survive this
container. They are denominators and enumeration sets, not the mission's subject.

### Declared limits on the store denominators in this report

Bulletin 18 item 3(b) asks whether every row of a result set was an *independent* observation.
Measured against my own figures:

- **The "114 independent git stores" figure is sound for the question it answered** (which stores
  lack canonical's `info/exclude` rule) — it was derived as `.git`-as-**directory**, which already
  excludes the 123 linked worktrees that share a common dir.
- **It is not sound for any claim about object populations.** Three stores
  (`farmtable-audit-xss-r6`, `farmtable-review-xss-r6`, `farmtable-test-xss-r6`) borrow canonical's
  objects via `objects/info/alternates`. Their object counts are not independent observations.
- **Self-contamination of the denominator:** 21 of the 142 `.git` directories now on this host are
  *my own instrument scratch repos on `/tmp`*, and the gap scan's enumerator walked `/tmp`. Any tree
  count of mine that included `/tmp` counted the investigator's own apparatus as part of the subject.
  This is bulletin 18 item 2's class — *the tool that hunts the leak runs in a directory that is
  never in the population* — generalised from the credential scan to the denominator.

---

## 7. `APPARATUS-MANIFEST.md` — added 11:52Z under amendment 18.6 Order B

| | |
|---|---|
| bytes | 16,029 |
| lines | 223 |
| sha256 | `429f6625b376c86fe8a60df32364aa7aae9f66302d4c1b485c7efec0cb4937aa` |
| contents | **197 fixture NAMES**, sizes and kinds. No file content. |
| of which | **9 declared CANARY fixtures** holding deliberately fabricated values |

**Why it exists:** amendment 18.6 Order B — *"apparatus must be tagged when it is created, not
recalled at scan time… every one he misses inflates the next scan toward alarm."* Under the freeze
fixtures cannot be deleted, so **naming them is the only remedy left.**

**HONEST LABEL, AND IT IS ON THE FILE ITSELF:** the `inv-` prefix has been in use since 08:0x, so the
*naming* half of Order B was satisfied **by habit, not by design**. The manifest is a **reconstruction
at 11:52Z from the filename prefix** — the same class of retroactive rescue this leg was corrected for
at 11:23, and recorded as such rather than presented as compliance.

**Reach note:** `/tmp` is per-container on this host (no `/proc/self/mountinfo` entry; dev **173**,
distinct from reconcile's **109** and preserve-bundle's **120**). **Every unpublished fixture named in
that manifest dies with this container.** The manifest itself is on the shared scratchpad and survives.
