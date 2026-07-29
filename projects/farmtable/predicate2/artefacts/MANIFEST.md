# ARTEFACT MANIFEST — predicate2 / INVERTED INSTRUMENT

Copied from per-agent `/tmp` to this persistent, readable location at 10:38Z under an explicit
narrow extension of my write permission. `/tmp` was **per-agent AND on a different device
(`dev=1048634` vs `2049`) AND ephemeral** — three independent reasons a `/tmp` receipt is not one.

**COUNT: 24 artefacts + this MANIFEST.md = 25 entries** — the 25th is `p2ap.substr.py`, the span-free
containment test that overturned the seven-carrier count (§2.11). Verified by listing the directory,
not by adding one to the previous figure. All verified by sha256 on both sides after
copying: **7 OK, 0 mismatch** for the latest batch.

> **COUNT CORRECTION, AND IT IS THE THIRD TIME THIS CHECK HAS PAID.** Before the 11:5xZ batch this
> directory held **17** entries, not the 16 declared above it. The declared figure was one short — found
> only by listing the directory after writing the count, the same move that surfaced the 15th artefact
> and the two-byte `rec.filterA.json`. **A COUNT WRITTEN FROM THE LIST YOU INTENDED TO COPY IS NOT A
> COUNT OF THE DIRECTORY.**

> **The earlier count of 14 is SUPERSEDED BY EXTENSION, not corrected as an error. IT WAS TRUE WHEN
> MADE.** 14 was the full set I was authorised to copy at 10:36Z; `stage4.py` was added at 10:46Z
> under a separate narrow extension. A superseded-but-true figure and a wrong figure are different
> things, and collapsing them would be the same filename-level confusion this manifest exists to
> prevent.

**How the 15th was found, recorded because the method outperformed the plan:** by listing the
directory *after* reporting the copy complete. That is the same move that surfaced the two-byte
`rec.filterA.json`. **VERIFICATION AFTER THE DECLARATION OF COMPLETENESS IS THE HIGHEST-YIELD CHECK
IN THIS INVESTIGATION, AND IT IS THE ONE EVERY WORKFLOW OMITS — BECAUSE THE DECLARATION IS WHAT
NORMALLY ENDS THE WORK.**

**Every artefact below is mapped to the figure it supports.** An artefact nobody can tie to a
published number is not a receipt either — it is a file.

> **SPAN DECLARATION (amendment 18.3, mandatory).** Every `sha256[0:16]` in this manifest is taken
> over **THE ENTIRE FILE, BYTE FOR BYTE, NO NORMALISATION.** Stated because a digest whose span is
> undeclared is not an identifier: my own credential key `d56bcdd3619eb762` was published without
> its span, proved reproducible by none of ten spans, and came within one message of being read as a
> second credential loose on the host. **The canonical credential key is `d72bb520918e7a28`, SPAN =
> BARE TOKEN.** A DIGEST TRAVELLING WITHOUT THE THING IT IS A DIGEST OF IS A FALSE ALARM WAITING
> FOR A SECOND READER.

| artefact | shape | supports (see `../FINDINGS-INVERTED.md`) |
|---|---|---|
| **`rm.A.files`** | **18,220 paths**, sha256 `4f5af9a52536c455` | **THE DENOMINATOR. Every published integer in this investigation is a filter over this file.** |
| `rec.bannersA.json` | dict, **116** keys | §2.1 BANNERED FILES = 116 |
| `rec.blobsA.json` | dict, **2417** keys | §2.1 multi-path blobs = 2,417 |
| `rec.filterB.json` | dict, **240** keys | §2.1 excluded ROOT B holds 240 bannered — the exclusion is not vacuous |
| `rec.hazard.json` | dict, **94** keys | §2.2 B′ polarity reading |
| `rec.pairs2.json` | list, **108** | §2.1 twin edges resolved = 108 |
| `rec.classB.json` | list, **35** | §2.1 distinct live class-B pairs = 35 |
| `rec.ranked.json` | list, **35** | §1.3 pairs ranked by shared condemned text |
| `rec.broadcast.json` | dict, 2 keys, **5 edges** | §1.1 — **SUPERSEDED, HEADLINE-ONLY. IT DOES NOT CONTAIN THE PUBLISHED 7.** See below. |
| `../check/reversal_check.result.json` | **7** edges, 7 naked | §1.1 the current, complete edge set — including both body edges |
| `rec.sample3.json` | list, **3** | §4 open-question-1 pre-registered sample |
| `inv3.py` `stage4b.py` `audit.py` | source | §3.1 the run of record |
| `stage4.py` | source, **superseded** | the *broken* v1 — see "must not be read at face value" below; produces `rec.pairs.json` |

## THE DENOMINATOR, AND WHY IT WAS ALMOST LOST

`rm.A.files` is the ROOT A enumeration: **18,220 paths, 18,220 distinct, no duplicates**, verified
`4f5af9a52536c455` on both sides at 11:02Z. It reconciles exactly to the published
`18,220 = 17,093 TEXT + 1,127 OPAQUE`.

It was **not** among the 14 artefacts I first listed, and the reason is the point:

> **I WAS THINKING ABOUT RESULTS, AND IT IS AN INPUT.**

Every preservation sweep I ran enumerated *outputs*. But **results can be re-derived from the
denominator, and the denominator cannot be re-derived from the results** — and under the freeze it
cannot be re-walked either, because the host has changed since I walked it: two clones appeared at
10:39:59 that were not present when this file was written. Had `/tmp` been reclaimed, every integer
in `FINDINGS-INVERTED.md` would have become permanently unverifiable while every *result* artefact
sat safely copied.

## THE SUPERSEDED EDGE ARTEFACT — `rec.broadcast.json` HOLDS 5, NOT 7

This manifest previously mapped `rec.broadcast.json` to "the 7 reversal edges." **It contains 5.**
It is the headline-only artefact, produced before the headline-only limitation was fixed; the two
edges found by the later full-file pass — **B10→B9** (item 2, body) and **B17→B13** (body) — were
never written to any artefact at all. **I published a 7 that no receipt held.**

> **A MANIFEST THAT TIES AN ARTEFACT TO A NUMBER THE ARTEFACT DOES NOT CONTAIN IS WORSE THAN NO
> MANIFEST, BECAUSE IT SPENDS THE READER'S TRUST TO CERTIFY THE GAP.**

**The gap is closed by evidence, not by relabelling.** `../check/reversal_check.py` was executed and
emits all 7 edges including both body edges, with 7/7 naked and five control arms recorded, to
`../check/reversal_check.result.json`. That file, not `rec.broadcast.json`, is the current record.
`rec.broadcast.json` is retained — superseded, not deleted, same doctrine as `rec.pairs.json`.

## TWO ARTEFACTS THAT MUST NOT BE READ AT FACE VALUE

**`rec.pairs.json` — list of 7,421. THIS IS A BROKEN RUN, KEPT DELIBERATELY.** It is stage4 v1,
before amendment A6. 7,421 edges was my own broken-instrument threshold, caused by stems like
`update` and `circuit` — ordinary English words that are also filenames — matching as bare
substrings in prose. **It is not a result. It is retained as the negative it is**, because the
superseded artefact and the corrected one (`rec.pairs2.json`, 108) are indistinguishable by
filename alone, and deleting it is forbidden by the freeze in any case.

**AND THE CODE THAT PRODUCED IT IS NOW HERE — THE DEFECT IS INSPECTABLE.** `stage4.py`
(sha256[0:16] **`334bb1fa7befd953`**, 3,118 bytes) was copied in at 10:46Z under an explicit narrow
extension, one fully typed path, verified both sides. Until that moment this row was **testimony,
not evidence**: a reader could see the broken output but not the broken instrument, so the label
"broken run, cause = bare-substring stem matching" rested on my word. Compare the two directly:

| | `stage4.py` (v1, broken) | `stage4b.py` (A6, corrected) |
|---|---|---|
| stem length floor | `len(s) >= 6` (L17) | `len(s) >= 8` **and** must contain `[\d-]` (L51) |
| word boundary | **none** — `"|".join(...)` bare alternation (L28) | `(?<![A-Za-z0-9])(...)(?![A-Za-z0-9])` (L60) |
| fan-out cap | none | `len(v) <= 8` paths per stem (L53) |
| scope | all 18,220 files | documentary corpus only, `is_doc()` (L20–26) |
| control | **none** | `ctl()` L84–96, two arms that must differ |
| edges emitted | **7,421** | **108** |

**The remedy is `stage4b.py` lines 51–60.** The bare alternation at `stage4.py:28` is the whole
defect: `update` and `circuit` are ordinary English words that are also filenames, so every
occurrence in prose resolved to a path. Note also that **v1 had no control function at all** — it
could not have told me it was broken; I caught 7,421 only because the magnitude was absurd.

> **A LABEL ON A BROKEN INSTRUMENT, WITH THE INSTRUMENT ABSENT, IS INDISTINGUISHABLE FROM THE
> CONCERN HAVING BEEN HANDLED.** The copy was authorised on that ground, not on instructiveness.

**`rec.filterA.json` — `[]`, two bytes. ITS EMPTINESS IS THE FINDING, AND THAT IS EXACTLY THE
PROBLEM.**

**`rec.filterA.json` — `[]`, two bytes. ITS EMPTINESS IS THE FINDING, AND THAT IS EXACTLY THE
PROBLEM.** It records the detector run over the 1,127 OPAQUE files in ROOT A, which returned
**0 bannered**. The zero is real. But:

> **AN EMPTY ARTEFACT CANNOT DISTINGUISH "RAN AND FOUND NOTHING" FROM "NEVER RAN". THE SILENT ZERO
> I SPENT THE NIGHT AUDITING IN COMMANDS IS ALSO A PROPERTY OF FILES, AND IT IS IN MY OWN RECEIPT.**

The file carries the numerator and not the denominator, so on its own it is unfalsifiable. **The
missing denominator, recorded here so the artefact becomes checkable:**

```
ROOT A ENUMERATED  18,220  = TEXT 17,093 + OPAQUE 1,127     (17,093 + 1,127 = 18,220, balances)
detector applied to all 1,127 OPAQUE files -> 0 bannered     <- rec.filterA.json == []
same detector applied to ROOT B's excluded population -> 240 bannered   <- rec.filterB.json
```

The `filterB` = 240 result is what makes the `filterA` = 0 result meaningful: **the same detector,
pointed at a different population in the same run, returned a large positive.** That is the
companion arm an empty artefact needs, and it is why the FILTER control was worth building. Without
it, `[]` would be indistinguishable from a detector that never fired.

## THE TIMESTAMP-SIGNATURE FIXTURES — 13 FILES IN `../check/`, RETAINED

`../check/tsprobe.*` are **13 control fixtures** built at 11:13Z for the bulletin 17 re-ask (see
`../FINDINGS-INVERTED.md` §2.6). They are not results and not part of the reversal check — **nothing
is wired to anything.** They exist because the question "did the Edit tool write this file?" needed a
signature table measured on `dev=2049`, the same filesystem as `/workspace`; a fixture built on
`/tmp` would have been on overlayfs and would not transfer.

| fixture | arm |
|---|---|
| `tsprobe.A.create.txt` | program create+write |
| `tsprobe.B.rename.txt` | lock+rename **with a 20 ms sleep — the confounded arm, kept as the negative it is** |
| `tsprobe.B0…B4.rename.txt` | lock+rename ×5, no sleep — the corrected arm |
| `tsprobe.C.copied.txt` / `tsprobe.D.copied-p.txt` | `cp` / `cp -p` |
| `tsprobe.F.edit.txt` | Write-tool create, then Edit-tool modify (new inode both times) |
| `tsprobe.G1…G3.txt` | three Write calls in one block — the agent-tool **spacing floor** |

`tsprobe.B.rename.txt` is retained deliberately, same doctrine as `rec.pairs.json` and `stage4.py`:

> **IT IS THE ARM THAT PRODUCED A FALSE POSITIVE BECAUSE OF MY OWN `sleep(0.02)`, AND I WAS ONE
> PARAGRAPH FROM PUBLISHING THE CONCLUSION IT SUPPORTED. THE CONFOUND WAS IN THE MEASURING CODE, NOT
> IN THE SUBJECT — WHICH IS THE ONLY PLACE I WAS NOT LOOKING.**

These fixtures are **not deleted**: the freeze forbids deletion anywhere, and a control fixture is
not an exception (same ruling as `/tmp/selftest-selector`).

## THE `p2ap.*` BATCH — THE CORRECTED BATTERY AND THE INSTRUMENT THAT WAS NEVER MINE

Seven artefacts copied at 11:5xZ, every path typed in full, no glob, verified both sides. Prefix
`p2ap.` is the **declared apparatus prefix** required by amendment 18.6 Order B, assigned **at creation**
rather than recalled at scan time. They support `../FINDINGS-INVERTED.md` §2.10.

| artefact | shape | supports |
|---|---|---|
| `p2ap.manifest.txt` | 10 lines | the apparatus register itself — every fixture tagged when built |
| `p2ap.credscan.py` | 52 lines, `2ed197e4f74346ae` | the digest scanner: binary-inclusive, span = BARE TOKEN, positive arm at tier **REAL INSTANCE** and aborts if it does not fire |
| `p2ap.cand.txt` | **9 paths** | stage-1 candidates host-wide → **7 canonical + 2 non-canonical** |
| `p2ap.rescan.err` | **11 lines** | the error channel my original battery sent to `/dev/null`. All 11 are `/etc` permission denials |
| `p2ap.117.txt` | **117 paths** | every `.git/config` reached on `/workspace` — proof the battery's `.git` zeros were not reach-limited |
| `p2ap.reach.find` / `p2ap.reach.grep` | **7** / **4** lines | the reach set-difference. `comm -23` names the three excluded files: `.git/config`, `binary.bin`, `ignored.log` |

**The reach pair is the load-bearing one, and it is a pair on purpose.** A count of 4 against a count of
7 says only that something was missed; the *set difference* names which three and therefore which three
exclusions were in force. Both operands carry their line count per amendment 18.5 item 5.

> **THE SCANNER'S POSITIVE ARM IS A REAL INSTANCE, NOT A PLANT.** It is pointed at a file already known
> to carry the live secret, so arming it created no new copy of the credential. A fabricated or planted
> control would have tested the regex; this tests the regex, the reader, the binary handling and the
> digest span against a known true positive — and it is the calibration amendment 18.7 item 6 requires.

**And the instrument these artefacts indict is not one I chose.** `grep` in this shell is a function
injected by the agent harness that silently appends `--exclude-dir=.git --ignore-files -I` and three more
VCS exclusions; `timeout`, `xargs`, `command` and absolute paths bypass it and get GNU grep 3.8. The
version string is read through the wrapper and the scan may not be. See §2.10.

## LIMITS OF THIS MANIFEST

- Figures here are transcribed from the run of record; they are **DERIVED** in the sense that the
  mapping between artefact and published number was written by hand. Re-parse the JSON to check.
- `inv3.py` writes several of these; `stage4b.py` writes `rec.pairs2.json` and reads
  `rec.bannersA.json`. Regenerating in the wrong order will not reproduce the published integers.
- These artefacts are a snapshot. The corpus is live and grew during the run — Q3 moved 45→49 sites
  and Q5 73→80 mid-investigation from corpus growth alone, with a byte-identical predicate.
