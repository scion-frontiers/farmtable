# RESULT — widened bulk-capture sweep (EM-303)

Scored against `reports/em-bulkcapture-prereg.md`, sha256
`41b6a17f3ddf3f5f1872f3c38997cb497551bbd8ff6a3bc7825cbb0d2343f8e2`, written before the
command ran.

## CONTROLS — §32.2, same invocation

- **Positive control FIRED.** Known-positive `em-tooling/snapshot-live-leg.md` returned.
  Detector proven alive.
- **Negative control FAILED ON FIRST RUN AND THE RUN ABORTED, BY DESIGN, PRODUCING NO
  RESULT.** See §"the abort" below. It passed on re-run after a stated exclusion.

## PROOF THE COMPARISON WAS FED — §32.3

`FILES SEARCHED = 661`, `*.md` under the three roots. Non-zero, so this is not the
void-harness shape.

## ROOTS ACTUALLY WALKED — §32.4

```
/scion-volumes/scratchpad/projects/farmtable/briefs
/scion-volumes/scratchpad/projects/farmtable/reports
/scion-volumes/scratchpad/projects/farmtable/em-tooling
```
Excluded, by name, both stated: `em-tooling/audit-195-r7-artifacts/` (built assets),
`reports/em-bulkcapture-prereg.md` (my own probe — see the abort).

## THE NUMBERS

| spelling | hits |
|---|---|
| `git add -A` | 21 |
| `git add .` | 8 |
| `git add -u` | 4 |
| `git stash` | 16 |
| `git commit -a` | 5 |
| **ENUMERATED** | **54** |

Decomposed, because the aggregate is misleading and the decomposition is the finding:

```
ENUMERATED 54 = MINE 37 + PRE-EXISTING 17
```

**37 of the 54 are §32 text I authored in the last hour** across `_BRIEF-RULES.md`,
`farmtable-predicate-2.md`, `dev-xss-r8-fix.md`, `snapshot-live-leg.md`. The sweep for the
hazard counted the cure as the disease.

## SCORING — INCLUDING THE ONE THAT FAILED

| | prediction | outcome |
|---|---|---|
| **P1** | FLAGGED = 0 live bulk-capture instructions besides the suspended runbook | **HOLDS** |
| **P2** | ENUMERATED between 5 and 25 | **❌ FALSIFIED — 54** |
| **P3** | `git stash` appears in ≥1 file | **HOLDS** — 16 hits |
| **P4** | widened set finds ≥1 spelling the narrow set missed | **HOLDS** |

**P2 IS SCORED AS FALSIFIED AND I AM NOT RESCUING IT.** The predicate I *intended* — the
corpus as it stood before tonight — returns **17**, inside the predicted range. Scoring
that instead would be scoring what I meant rather than what I wrote, which is the exact
move §32 exists to stop. **I PREDICTED OVER A CORPUS I HAD ALREADY EDITED**, four files
deep, and did not subtract my own edits from the predicate. The number is not wrong by
accident; the predicate was stale by my own hand between writing and running.

## FALSIFIERS — none triggered

- **F1 (any live bulk-capture instruction): NOT TRIGGERED.** All 17 pre-existing hits are
  read-only enumerations (`git stash list`), descriptions of the hazard, or warnings
  against it. `reports/review-xss-r4.md:1038` warns that dirty gofmt "gets swept into
  someone's `git commit -a`" — a warning, not an instruction. **The four-file landing of
  §32.1 is sufficient; no second pass is required before r8 dispatches.**
- **F2 (ENUMERATED = 0):** not triggered. **F3 (>200):** not triggered.

## THE ABORT — the standard caught me inside the hour I wrote it

The negative control was `git add --patch-this-does-not-exist`, chosen because nothing
could plausibly contain it. **It returned 1 hit and the run aborted before reporting
anything.** The hit was the pre-registration file itself: I wrote my control string into
the corpus, then searched the corpus for the control string.

**AN INVESTIGATOR WHO PUBLISHES A PROBE INTO THE POPULATION HAS ENLARGED THE POPULATION BY
THE PROBE.** This is the same class as the evidence table that silently unions the artefact
under test with the investigator's own probes, arriving from a new direction: not a count
inflated by probes, but a *control* invalidated by its own publication.

**AND THE FAILURE MODE IT PREVENTED IS THE SILENT ONE.** Had the negative control been
absent — the ordinary case — the run would have returned 54, I would have reported it, and
the 37 self-authored hits would have travelled as evidence of a corpus-wide hazard. The
control did not merely catch a matcher defect. **IT CAUGHT THE CONTAMINATION THAT WOULD
HAVE MADE THE HEADLINE NUMBER WRONG BY 3x, AND IT CAUGHT IT BY REFUSING TO PRODUCE A
RESULT AT ALL.** An aborting control is worth more than a reported one precisely here.

## STANDING

§32.1 is landed in four files, listed above. **F1 clean, so r8 is unblocked on this axis.**
