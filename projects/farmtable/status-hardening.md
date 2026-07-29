# STATUS — HARDENING TRACK

Updated 2026-07-29 16:32Z. Main **439b309**, pushed, CI run **30464490913 SUCCESS**.
Detail, evidence and retractions: `hardening-track-detail.md`. This page is the answer.

## THE THREE ITEMS

| # | Item | Done? | One line |
|---|---|---|---|
| 1 | Unrecognised user type | **TRANSFERRED** | Real defect, **MEDIUM not critical** — measured privilege delta ZERO. Auth is out of scope by owner declaration; full package handed to `farmtable-architect-auth`. Fix branch exists (`89973f8`) and is stale, not broken. |
| 2 | XSS / URL scheme | **DONE** | Unioned per your ruling, never took a side. Merged at **439b309**, reviewed, CI green. |
| 3 | Unauthenticated token-write | **CLOSED** | The reported one is **FALSE**. Verifying it turned up a *different* unauthenticated write path, **confirmed by execution**, and that one is auth-architecture — out of scope, on the architect's pile. |

**Item 2 carried the finding that mattered and it was not the XSS.** `npm test` was
running **1 of 5** web test files. The XSS guard tests compiled and never executed.
Proof: delete `DOMPurify.sanitize`, suite stays **GREEN 1/1** — sanitiser gone, both
stored-XSS sinks live, CI green. Merging on that basis would have converted an *absent*
guard into a *believed* one, which is worse, because a believed guard stops anyone
looking. Fixed and on main; the runner now fails when the mutation is planted.

## WHAT IS STILL OPEN ON THIS TRACK (not part of your three)

| Item | State |
|---|---|
| safe-url add/add adjudication | Base **e64138c** (633f8f2 retracted — ancestor of nothing, forks at 7a0f220). Policy set is **NINE**, not five: the extra weight is `url-binding-scan.test.ts`, a 68 KB tree-wide invariant asserting every href binding routes through `safeHref`. **I withdrew the `safeHref`→`safeExternalUrl` rename** — the scanner is keyed to the literal identifier, and the rename's only cheap fix disarms it. Held on one open question: where the off switch lives. |
| Pushed to branch refs | `chore/go-test-registration` (32255b0, reviewed APPROVE) and `feat/194-pricing-oracles` (47b3bc6). Confirmed against the remote URL. **Main deliberately not moved** — a pre-registered name-set was fixed against it. 32255b0 carries `ci.yml` so its push fires CI; 47b3bc6 does not, so **silence from CI on that branch is not a pass**. |
| import-hardening | Reviewed **REQUEST CHANGES** on one real finding: a shipped comment claims the embedded CLI always authenticates locally, and `ft dashboard` with `FARMTABLE_OPEN_ACCESS=1` — the **Dockerfile CMD** — makes that false. A test pins the falsehood. Fix in flight. |
| Go test registration | 45 executed-but-unlisted tests registered, numstat `45 0`, in review. |

## THINGS YOU OWN THAT I CANNOT CLOSE

- **Credential in cleartext.** A GitHub PAT sits in the `origin` URL of
  `/workspace/farmtable`. KNOWN EXPOSURE, **ACCEPTED RISK BY YOUR INSTRUCTION, NOT
  RESOLVED.** It is not written up anywhere as handled.
- **Auth architecture** is out of scope project-wide, by your declaration. Items 1 and 3
  both terminate there. Nothing on this track fixes them; the architect has both packages.

## ONE PROCESS NUMBER, BECAUSE IT NEARLY COST WORK

Sweeping for unpreserved work from my side **cannot cross into an agent's container** and
a miss looks identical to "nothing to preserve". Asked all 15 legs to measure their own
filesystem instead: 4 were container-local, and one held **3 commits that existed in
exactly one place on earth**, including a binary test fixture. All rescued and pushed.
46 refs under `refs/preserve/rescued/`, each re-verified against the remote.

## AND ONE NUMBER THAT WAS ABOUT TO BE WRONG BY 16×

The per-leg reports summed to **299** rescued objects. Measured: **271** distinct, and
only **18** actually absent from canonical. Three legs had packed *the same 14 objects
from the same clone*, byte-identical, each file named after the leg that looked at it —
**our own naming convention manufactured three findings out of one**. A fourth leg's 253
turned out to be canonical's own loose objects, never at risk. The real yield is 18
(11 trees, 7 blobs, no commits), now unpacked into canonical and pinned.

Two caveats I am not burying: the fifteen-leg "zero absent" rests on **self-reported
locators** — the same absolute path is a different directory in a different container,
so device equality proves host backing, not visibility. And every gate we built reads the
object store, so none of them reaches **files that were never hashed**; one leg had 7 such
files and they were rescued by hand at the last minute.
