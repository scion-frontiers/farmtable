# tmp-evidence-20260729 — WORKING EVIDENCE RESCUED FROM PER-AGENT /tmp

Copied 2026-07-29T11:0xZ by `farmtable-preserve-bundle` under an explicit authorisation, because
per-agent `/tmp` is ephemeral and "leave it where it is" is destruction on a timer executed by
nobody. Every path was typed in full; no glob, no `-r`, one file at a time; every copy verified by
sha256 on both sides; the verifier was itself proven able to report a mismatch on a deliberately
tampered copy before the result was accepted.

**32 files copied, 32 verified identical, 0 failures.** 30 at 11:0xZ; the final 2 at 11:04Z after
a ruling — see *Resolution* at the bottom. The verification negative-control was re-armed on the
second pass rather than inherited from the first, because a control proves the run it traverses.

**THIS DIRECTORY IS ON THE SAME BLOCK DEVICE AS EVERYTHING ELSE.** It buys survival of a `/tmp`
reap and readability by other agents. It buys **no** durability against loss of the disk. Do not
let the word "preserve" in the parent path be read as more than that.

| file | sha256[:16] | bytes | the figure it supports |
|---|---|---|---|
| `00rf.orig` | `593cabc58ac49933` | 11563 | **Only copy of a superseded document** — the read-first credential marker as it stood *before* the five-point banner of 10:28Z. Point 2 of that banner was later found false and corrected; this is the sole record of the text it replaced. |
| `dirs2.txt` | `9d9193bc75085389` | 7702 | The 233-tree sweep input. Basis for every "233" in the report and for the three set comparisons. |
| `e17-wt.txt` | `94449aaa637225d3` | 4028 | 122 worktree entries from `worktree list --porcelain`. |
| `e17-reg.tsv` | `784a1985b1b90179` | 11358 | Worktree registration table; basis for the host-wide figure of 127 registrations. |
| `mine233.txt` | `9d05e374b5f26b74` | 7702 | My side of the 233∩233 set comparison, retained so the comparison can be re-run against the other side. |
| `clones-1026.txt` | `1966fd556d91dee1` | 3798 | Own-store clone census, 115 under /workspace. **Supersedes my published 111**, which was wrong because a safety exclusion silently became a census predicate. |
| `devenum.tsv` | `cf3c975a0b364702` | 1509 | The device enumeration: 29 mount entries, 18 included / 11 excluded. Basis for **one persistent block device, 200 GB**, since corroborated causally by another leg's write-intervention test. |
| `ft-objpaths-1040.txt` | `098e08e3111e3e6e` | 372763 | Canonical's 6,325 object+path lines from `rev-list --objects --all` over 429 refs. Basis for **zero database-shaped tracked paths**, i.e. the credential file never entered git. |
| `msg-c-1006.txt` | `a5befaed9b7f7632` | 7508 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1008.txt` | `7d1594285e1bcef2` | 3851 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1019.txt` | `d0c53b72f2d1b72a` | 6847 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1021.txt` | `d44c26fa3991b237` | 3583 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1024.txt` | `947312ddc65ed3ec` | 4074 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1026.txt` | `c7531b6ee014dcdd` | 3317 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1027.txt` | `14aa0258600ceac4` | 1802 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1029.txt` | `09800c110cb6ffa4` | 3392 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-c-1042.txt` | `19e7d09df55207b2` | 9678 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-coord-0910.txt` | `f8a49b1874bed334` | 11981 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-coord-0930.txt` | `38f44511c6c74b2b` | 10480 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-coord-0945.txt` | `3a21be02da6ff61a` | 9554 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-coord-0955.txt` | `c220ab291ad53b2f` | 9463 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-coord.txt` | `14a0a31fb93ff686` | 6651 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-em-1044.txt` | `35099008540d5272` | 6188 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-em.txt` | `34aca759d0e2dd6a` | 2764 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-r-1029.txt` | `7c1560dfb17b1017` | 3700 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-relo.txt` | `f6cd37506e6e2147` | 3424 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-reloc-0910.txt` | `d57d06e726b28ff0` | 4301 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-reloc-0946.txt` | `5cfff811bef7d88e` | 6142 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-reloc-0956.txt` | `807a08e3aa1fc884` | 4926 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |
| `msg-relocate.txt` | `8cba7bca69721019` | 4723 | Sent text of a report to another leg. The transcript stores what was *typed*; these are the payloads as delivered. |

---

## TWO FILES INITIALLY HELD — SINCE COPIED. THE ORIGINAL REASONING IS KEPT BELOW.

`msg-c-1058.txt` (4 occurrences) and `msg-em-1059.txt` (3) contain the identifier that was
**reclassified as a secret-derived value in the same message that authorised this copy.** The
authorisation and the reclassification were issued together and neither anticipated the other. The
ruling says that value is *"never introduced into a new document"* — and a copy at a new path in
shared storage is arguably a new document. I did not resolve that on my own authority in either
direction.

**RELEVANT TO THE RULING, AND IT CUTS AGAINST MY CAUTION:** that identifier is **already present in
5 files under this project's scratchpad**, including the published report (3 occurrences) and the
credential read-first marker (1). Containment is already lost; the live question is only whether to
*widen* it by two files. I state this because a conservative-looking hold can misrepresent the
actual exposure, and the person ruling should not infer from my caution that the value is otherwise
contained.

## CLASS (iii) NOT COPIED — CORRECTLY, AND NOT AS A JUDGEMENT CALL

Six restore-proof directories remain on `/tmp`. **They are git object stores, and a
filesystem-level copy of a `.git` is prohibited outright rather than gated.** That prohibition does
not bend for my own scratch. They are reproducible from the bundle on shared storage, so what is
lost when `/tmp` is reaped is compute, not evidence.

## A COUNT I PUBLISHED WRONG, TWICE, IN THE SAME WAY

I reported "22 message drafts". The enumeration found **24**. I then reported "7 drafts carry the
identifier"; it is **7 occurrences across 2 files**. Both errors are the same shape — a figure
published from memory or from an occurrence count rather than re-derived from the artefact — and
both were caught only because the copy authorisation forced a full enumeration.
**AN AUTHORISATION THAT REQUIRES YOU TO NAME EVERY FILE IS ALSO AN AUDIT OF EVERY FIGURE YOU EVER
PUBLISHED ABOUT THEM.**

## RESOLUTION (11:04Z)

Both files were copied. The ruling: **the prohibition is on *authoring* the value into new text, not
on preserving text that already carries it.** The document is not new; only its path is.

  **A RULE AGAINST SPREADING A VALUE MUST NOT ALSO FORBID KEEPING THE EVIDENCE OF HOW IT SPREAD —
  THAT WOULD DESTROY EXACTLY THE RECORD THAT LETS ANYONE COUNT THE CARRIERS.**

The hold was still correct to raise: the wording as issued covered this case on its face, and the
distinction between authoring and preserving had not been written down anywhere. What made the
ruling possible was not the hold but the baseline shipped with it — five files already carried the
value. A refusal sent without that number would have been ruled on a clean-state premise that does
not exist.

`msg-c-1058.txt` → `70cf104d1f4867b0` · `msg-em-1059.txt` → `76eebd1a5d498350`. Both digests match
the values recorded during the pre-copy enumeration, so the files are unchanged since they were
first inventoried — a cross-check the manifest can make on itself.
