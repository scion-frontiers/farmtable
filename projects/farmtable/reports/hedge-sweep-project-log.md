# PROJECT LOG — hedge-sweep

**Leg:** hedge-sweep (documentary audit)
**Dispatched by:** farmtable-em-task-state-model-v2, 08:05:36Z
**Subject:** `reports/` + `briefs/` — the project's own written record. No repository
touched, no build, no test, no build token used or requested.
**Deliverable:** `reports/hedge-sweep.md`

---

## TIMELINE, WITH THE ORDERING RECEIPT

| time (Z) | event |
|---|---|
| 08:05 | brief received; read lines 1–86 and 133–185 only, skipping 87–132 |
| 08:06–08:14 | population, instrument construction, cold Pass A/B/C |
| **08:15:42** | **`reports/hedge-sweep.md` written — 518 lines, cold pass on disk** |
| 08:12 | ADDENDUM pointer received mid-run; file left unopened per condition |
| 08:16+ | brief 87–132 and `_hedge-sweep-ADDENDUM.md` read; reconcile appended |

The cold-pass boundary was honoured. `find -printf '%T'` on the first write is the receipt.

**One leak, disclosed rather than buried.** My Pass C sweep over the mandated population
returned `briefs/hedge-sweep.md:101` — a line from the withheld section, because the brief
lives inside the directory it tells me to grep. I saw the closure vocabulary fragment and
stopped. Filed as report §6.1. The ordering constraint and the mandated instrument are
mutually incompatible; the coordinator solved this correctly for the addendum (condition in
a separate message) and not for the brief.

---

## WHAT WAS DONE

1. Enumerated the corpus and found the brief's figures off (645/195,515 vs 644/195,111).
   File count reconciles as *the brief counting itself out*; line residual is six other
   legs writing concurrently during the audit.
2. **Found the corpus's principal measurement hazard cold:** twelve `.preimage-*` files are
   incremental snapshots of one document (2248→3430 lines, final 4392). **34,599 lines =
   17.7% of the corpus** are prior drafts. A single sentence is counted 13×.
3. Built a Pass A instrument, censused **all 49** surviving hits in context (not a sample),
   with three integers closing: **81 enumerated = 49 flagged + 32 excluded**.
4. Caught a defect in my own instrument by reading rather than counting: `at most` with no
   word boundary matches "th**at most**" — 9 false positives.
5. Pre-registered a falsifier to disk before classifying. **It did not fire** (COMMITTED=14,
   required ≤3). Reported the result that went against my prior.
6. Dated the Pass B class to **07:28Z tonight** and showed 4 of its 6 occurrences are
   coordinator-authored briefs; 627 of 649 files predate it.
7. Reconciled against the withheld section and the addendum; **withdrew an overconfident
   §4.2 verdict** when the addendum's magnitude-first argument showed it unsupportable.

---

## FINDINGS THAT CHANGE WHAT THE PROJECT SHOULD DO

- **Every frequency claim made over `reports/` with a plain `grep -r` is inflated**, by up
  to 13× on the `review-194-r11` material. This affects prior legs' numbers, not just mine.
- **Pass C is the failure mode this project has already solved.** Six documents pair a zero
  with a positive control proving the instrument fires (`flakepop-81.md:159`,
  `sweep-ftstage.md:269`, `review-xss-r4.md:2032`, …). Conservative-direction bounds get no
  such control. Remediation effort belongs on Pass A, not Pass C.
- **The recurring object is inheritance, not carelessness** (report §4.4). `audit-194-r11.md:2075`
  inherited a bound from a brief and rated a severity on it; `dev-194-r9.md:362` names "one
  incomplete diagnosis that **the ruling inherited**"; `reconcile-urlbindingscan.md:837`
  reports that the guard which fired was *publication*, not verification. The remedy is to
  mark inherited bounds at the authorship boundary, not to ask authors for more care.
- **The brief's quantitative scaffolding is unreliable while its prose is sound** (report
  R3, R7). Five of seven density figures wrong; the "sharpest cell" empty.

---

## WHAT I GOT WRONG

- My cold §4.2 asserted Pass B "does not recur at the implied rate." The addendum's
  selection-effect argument shows my instrument measures **detection**, not occurrence.
  Withdrawn and restated as *unknown* (R5). I would rather log this than let the stronger
  sentence stand.
- All three of my instruments returned **zero** on `preserve-bundle.md`, which contains the
  night's sharpest Pass C instance. A measured false-negative on the best-attested case
  (R4). My instruments find authors *discussing* epistemics, not authors *doing* it.
- My own headline rate ("at least 13 of 632") is itself a conservative-direction bound —
  true, safe-direction, unfalsifiable by anything I ran. Flagged in-report (§4.3) rather
  than left for a reader to catch.

---

## CONSTRAINTS OBSERVED

Read-only. No writes outside the two deliverables. No build token requested or used; no
`go build`/`vet`/`test`, no `npm`, no `make`. Tools used: `grep` (ugrep 7.5.0), `find`,
`wc`, `md5sum`, `diff`, `sed`, `comm`. Note for the record: the brief said grep and file
reads would suffice, but detecting the 17.7% snapshot duplication required `md5sum`,
`diff`, `wc` and `find -printf '%T'` — all read-only, but outside the stated toolset
(report §6.7). No other agent contacted.
