# `reports/` MANIFEST — WHO WROTE THE UNDERSCORE-PREFIXED FILES

**Why this exists.** `test-xss-r4` disclosed that it had written two run captures here as
`_r0-go-build-output.txt` and `_r0-web-suite-output.txt`, and then filed the hazard against itself:

> *"THE HAZARD IS THE NAME. I prefixed them with an underscore, which on this volume is the
> convention for SHARED, EM-AUTHORED artefacts. A LEG SCANNING `reports/` FOR SHARED INPUTS COULD
> TAKE MY PRIVATE RUN OUTPUT FOR A ROUND-LEVEL BASELINE."*
> **"THE NAME IS THE SPECIFICATION, AND I GAVE A PRIVATE ARTEFACT A SHARED ARTEFACT'S NAME."**

It offered to rename and asked me to decide. **DECIDED: DO NOT RENAME.** I measured first, and a
rename is the wrong move here:

    grep -rln "_r0-go-build-output\|_r0-web-suite-output" reports/ briefs/
    -> test-xss-r4.md, audit-xss-r4.md, _run-queue-log.md

**THREE LIVE POINTERS, INCLUDING A SECOND LEG'S REPORT.** Renaming would do to `audit-xss-r4` exactly
what my brief edit did to `audit-194-r11`'s citation an hour ago — break a pointer someone else is
mid-derivation against, to fix a problem that is not the pointer. **SUPERSEDE, NEVER ERASE APPLIES TO
FILENAMES, NOT JUST TO FILE CONTENTS.** The ambiguity is fixed by attribution, which costs no reader
anything.

## THE UNDERSCORE PREFIX NO LONGER MEANS "EM-AUTHORED". IT MEANS "NOT A LEG REPORT."

That is the honest reading of what is actually on disk, and the convention is hereby restated to
match reality rather than the other way round. Authorship is this table's job.

| file | author | status |
|---|---|---|
| `_run-queue-log.md` | **EM** | shared, authoritative — the run queue |
| `_MANIFEST.md` | **EM** | this file |
| `_xss-r4-baseline-measurement.md` | **EM** | shared, authoritative — the published round baseline |
| `_r0-go-build-output.txt` | **`test-xss-r4`** | **PRIVATE RUN CAPTURE.** G-6b. Lent to `audit-xss-r4` as an **OBSERVATION ONLY**, never as a control — see `_run-queue-log.md` §"WHAT A GREEN ARTEFACT MAY AND MAY NOT BE LENT FOR" |
| `_r0-web-suite-output.txt` | **`test-xss-r4`** | **PRIVATE RUN CAPTURE.** G-6a. Same licence |
| `_r13-nodemodules-output.txt` | **UNDETERMINED** | I cannot establish authorship from the filesystem and **I am not guessing.** Whoever owns it, claim it |
| `_clockprobe/` | **UNDETERMINED** | directory; same |

**Two entries in this table are UNDETERMINED and stay that way until someone claims them.** A
manifest that guessed would be worse than no manifest, because it would be an attribution artefact
that cannot be falsified by the party it names.

## THE CHANNEL THIS DISCLOSURE OPENED, WHICH IS THE ACTUAL FINDING

`test-xss-r4`, and it is the seventh channel of the night and the first one that is **structurally
outside every instrument we mandated**:

> **`git diff`, `porcelain -uall`, `porcelain --ignored`, `find -type d -empty` AND `git clean -nxd`
> ARE ALL SCOPED TO THE REPO. NONE OF THEM CAN SEE A LEG'S WRITES TO THE SHARED VOLUME, AND WE HAVE
> ALL BEEN CERTIFYING "0 CELLS DIRTY" WITH THEM.**

And the reason it is mine rather than any leg's: **I assigned the scratch paths, and I put the
reports directory on the shared volume.** A leg redirecting run output "somewhere convenient" lands
here by the design of the workspace, not by carelessness. `_r13-nodemodules-output.txt` and
`_clockprobe/` are unattributed for exactly that reason — they arrived through a channel nobody was
asked to report.

**MANDATE, EFFECTIVE NOW:** a restore proof must enumerate writes **OUTSIDE** `/workspace` as well as
inside it. Every leg's "0 cells dirty" tonight was certified by five repo-scoped instruments and is
silent on this volume.
