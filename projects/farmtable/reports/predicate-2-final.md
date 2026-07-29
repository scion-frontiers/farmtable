# predicate-2 — FINAL

**Leg:** farmtable-predicate-2
**Written:** 2026-07-29, under AMEND 20.0 (stand down)
**Status:** closed. No measurement was taken to produce this file. Every figure below
was already held before AMEND 20.0 was read.

A note on what this file is. AMEND 20.0 asked for plain sentences a reader with no
context can follow, and for the method findings to be stated as predicates about
instruments rather than as stories about me. I have tried to do both. Where a claim is
bounded, the bound is stated next to the claim and not in a footnote, because a bound
that is separated from its claim gets quoted without the bound.

---

## (a) WHAT I ESTABLISHED

### A live administrative credential exists on this host in eight files

A GitHub personal access token, 93 bytes, beginning with the literal prefix
`github_pat_`, is present as an exact byte substring in **eight** files. I never printed,
echoed, logged or transmitted the value; I identified it throughout by the first sixteen
characters of its SHA-256, `d72bb520918e7a28`. I never tested whether it authenticates,
because a validity test is an authentication attempt.

Seven are text files, found in the original battery:

1. `/workspace/farmtable-task-state-predeploy/.git/config`
2. `/workspace/farmtable-task-state-core/.git/config`
3. `/workspace/farmtable/.git/config` — this is *canonical's* config
4. `/workspace/.scion/agents/coordinator/scion-agent.json`
5. `/scion-volumes/scratchpad/projects/farmtable/preserve/gc-config-before-20260729T070627Z/farmtable.config.before`
6. `/home/scion/.scion/harness/inputs/telemetry.json`
7. `/home/scion/.scion/scion-env`

The eighth is a binary:

8. `/workspace/farmtable-passthrough-write-p1/test-writethrough.db` — at offset 61184.

**I published the eighth as a non-carrier and that was wrong.** The correction is in
(c) under the extract-then-hash predicate; the retraction is preserved struck through
rather than deleted in `predicate2/FINDINGS-INVERTED.md` §2.11. Per AMEND 20.0 §3, the
`relocate` leg had already confirmed this file by containment at 08:35:09, three and a
half hours before I disputed it. Three legs found it, not two, and the earliest used the
method that was later mandated. My contribution to carrier eight was to break it and
then repair it; the finding itself was already on the coordinator's inventory.

All eight were confirmed by **byte containment** — reading the whole file as bytes and
asking whether the subject's bytes occur in it. Containment chooses no span, so the span
cannot be wrong.

### The eighth carrier is one bulk-stage away from publication

This is the operationally significant fact and it does not depend on any disputed method.

- `test-writethrough.db` sits in a **linked worktree**. Its `.git` is a file, not a
  directory, holding `gitdir: /workspace/farmtable/.git/worktrees/farmtable-passthrough-write-p1`.
  That worktree's `commondir` is `../..`, meaning **it shares canonical's object store**.
- The file is **untracked** — it does not appear in the 37,652-byte DIRC index.
- The file is **not ignored** — I read the applicable ignore patterns (about forty) and
  none of them matches it.
- It is mode 644 on a **shared** mount. Every agent on this host runs `uid=1002(scion)`,
  so mode bits isolate nothing between agents.
- Carrier #1 in the list above is canonical's own `.git/config`, which means **the
  repository that would publish the secret is itself holding the token that authorises
  the push.**

Untracked plus unignored plus shared object store means a single `git add -A`, `git add .`,
`git commit -a` or `git stash -u` run anywhere in that worktree stages the live
credential into canonical's object store. AMEND 20.0 has made the no-bulk-stage rule
permanent there and independent of rotation. That is the right call: rotation removes the
value of the secret, it does not remove the *file*, and the next secret that lands in
that database inherits the same path.

**I took no action on that file.** No chmod, no move, no add, no git command of any kind.
Under AMEND 18.4 there is no on-host containment available for a credential readable by
every agent under the same uid — remediation is rotation and only rotation — and a
permission change would have been a containment gesture that excludes no reader while
also destroying evidence and moving a timestamp.

### Reach facts, established from `/proc/self/mountinfo`

- `/home/scion` is **per-agent** — it maps to a host path under
  `.../agents/farmtable-predicate-2/home`. Carriers 6 and 7 are therefore *my* copies;
  each agent on this host will have its own, and my count of two is a per-agent count,
  not a host count.
- `/workspace` is **shared** across agents, ext4.
- `/scion-volumes/scratchpad` is **shared**.
- `/opt/scion/bin` is a read-only bind mount.
- `/tmp` has **no mountinfo entry at all** — it is the overlay root, device `0:314`.

The last one matters more than it looks. A path with no mountinfo entry is not a path
with no reach question; it is a path whose reach question has no local answer.

### My own output is clean

Every file I wrote during this investigation — 46 of them — was checked by containment
for the subject value. **Zero carry it.** The apparatus I built used the value only as a
needle read from my own process environment, never as an argv element, never written to
disk. AMEND 20.0 §3 records that another leg wrote the live token to disk to demonstrate
a compression property and then deleted it; the standing lesson adopted there —
**use fabricated needles for apparatus, always** — is right, and it is worth stating that
a fabricated needle would have served every apparatus purpose I had as well.

---

## (b) WHAT I DID **NOT** ESTABLISH, AND WHAT BOUNDS IT

### I did not establish that eight is the total

Eight is a floor, not a ceiling. Three specific things bound it:

**1. Encoding. This is the largest gap and it is not closeable by the method I used.**
Adopting `reconcile`'s rule: *containment is exact only over the encoding you searched.*
A secret that is compressed, base64'd, hex-encoded, chunked across a buffer boundary, or
backslash-escaped is **absent from every byte search and present in the file**.
Approximately 438 MB of git object storage on this host is zlib-compressed and therefore
opaque to byte containment. Byte containment has no span boundary to get wrong — that is
its virtue — but it has an **encoding** to get wrong, and it fails *toward clean* on the
largest population on the host. **Declared gap. Not closed. Not chased**, per AMEND 20.0 §1.

**2. The compressed-object gap and the canonical blob re-derivation are open.** I was
ordered not to start them and I did not. They are real and they remain real.

**3. Population, not host.** My scans covered enumerated populations — the transcript,
file history, `/tmp`, `predicate2/`, and a 1,846,184-file corrected battery. A clean
result over a population is a statement about that population. It becomes a statement
about the host only if the population was the host, and mine was not.

### One digest can never be closed, and that is its permanent status

Earlier in the night I retracted a claim keyed to digest `d56bcdd3619eb762`. It was
established by extracting ten candidate spans and matching none of them. Containment
requires the *value*, and for that digest **no preimage is known to anyone**. There is
therefore no operation that converts it to a containment result.

**A digest with no known preimage can never be closed by containment.** It can only be
closed by someone producing a candidate value to test against. `d56bcdd3619eb762` is
**permanently provisional**. That is its honest status, not a deferral and not a task
someone should pick up — there is nothing to pick up.

### I did not establish the provenance of the credential in the database

How a `github_pat_` token came to be at offset 61184 of a write-through test database is
unknown to me. It was explicitly not commissioned. It is the question I would ask first
if this reopened, because it is the only one that tells you whether there are more files
like it.

### I did not establish a control for the void-run class

Adopting the corpus from `reconcile`'s two catches and my own: a command can fail
completely and emit a success. `timeout` cannot exec a shell builtin and returned three
confident zeros from three failed invocations. `find -xdev` on a plain directory returns
zero files with clean stderr and a correct exit code. My own `nohup ... &` background scan
reported **exit 0** with a **zero-byte log** because the child died with the shell — it
would have published a clean host-wide zero from a process that never opened a file.

In all of these **the failure and the measurement were byte-identical on stdout.** What
caught every one of them was a human noticing the magnitude was implausible. **Nobody has
a built control for this class.** I am saying so rather than implying our controls covered it.

### Ambiguity I resolved only partially

- Raw `st_dev` here is 1048634, which decodes to major:minor `0:314`. Other legs reported
  device identifiers as `109` and `120` — minor-style. Different encodings of the same
  kind of fact, compared as if they were the same number, break the *sound* direction of a
  device-identity test. I flagged it; I did not reconcile the fleet's encoding.
- The birth-vs-mtime discriminator I built (`birth == mtime` → a later ctime is a real
  metadata change; `birth > mtime` → mtime was backdated and a large c−m is an artefact)
  works, but the ctime instrument it corrects has three limits I could not remove:
  fractional-only arithmetic; a large c−m that is genuinely ambiguous between
  chmod-later and mtime-backdated; and the fact that it was validated on a population in
  which its defect cannot appear.

---

## (c) METHOD FINDINGS, AS PREDICATES ABOUT INSTRUMENTS

Stated as predicates rather than incidents, per #278. Each is a property some instrument
has, testable by a reader who was never here.

### P1 — An interposed wrapper makes the version string come from a different program than the measurement

`grep`, typed bare, resolved to a **shell function** injected by the harness snapshot at
`/home/scion/.claude/shell-snapshots/snapshot-zsh-1785315648160-1lqh1o.sh`. It rewrote
every invocation as:

```
ugrep -G --ignore-files --hidden -I --exclude-dir=.git --exclude-dir=.svn \
      --exclude-dir=.hg --exclude-dir=.bzr --exclude-dir=.jj --exclude-dir=.sl "$@"
```

Prefixing anything at all — `timeout`, `xargs`, `find -exec`, `command`, an absolute path
— bypasses the function and reaches **GNU grep 3.8 with none of those exclusions**.

- `grep --version` → `ugrep 7.5.0`
- `timeout 5 grep --version` → `grep (GNU grep) 3.8`

**THERE ARE TWO DIFFERENT GREPS IN THIS CONTAINER AND WHICH ONE RUNS IS DECIDED BY HOW THE
COMMAND WAS TYPED, NOT BY WHAT WAS INSTALLED.**

The corollary is the dangerous half: **the declaration is taken from the wrapper and the
measurement from the binary, and both are called `grep`.** A leg that documents its tool
by running `<tool> --version` and then measures via `xargs` has documented an instrument
it did not use, and every step in that sequence is correct practice.

This is not a bug report about one host. The predicate is: *an instrument whose identity
is resolved by name at each invocation can be a different instrument in the declaration
and in the measurement.* Test it by prefixing `command` and comparing.

### P2 — A control passes by construction when the wrapper injects both the control's condition and its negation

18.7 item 5 asked whether hidden files were being skipped. The injected line contains
`--hidden` (on) **and** `--exclude-dir=.git` (on) in the same command. The hidden-file
control therefore passed regardless of the truth of what it was testing. A control whose
outcome is fixed by the harness is a **false control**: it consumes the budget for
checking and returns a pass that carries no information. This is the same shape the
coordinator identified in its own 18.4 finding, and — as AMEND 20.0 concedes — the same
shape that Order B took on containment arms.

### P3 — Extract-then-hash has a defect class that only fires on binaries. The defect is the hashing, not the greedy class

This produced my largest error and it is worth stating precisely, because the obvious
diagnosis is the wrong one.

A detector that (i) matches a token with a greedy character class, (ii) extracts the span,
(iii) hashes the span, and (iv) compares digests, works correctly in text and fails
silently in binary. In text the token is terminated by a newline or a quote, so the class
stops where the token stops. In binary **there is no delimiter**, so the class runs on
into adjacent payload. My span was 96 bytes for a 93-byte token: a three-byte trailing
overrun, all of them word-class.

**THE OVERRUN LENGTH IS DECIDED BY THE FILE'S BYTES, NOT BY THE TOKEN.** A detector whose
correctness depends on the adjacent payload is a coin that comes up heads on text.

The digest of the 96-byte span was `6d6cd33cff3750c5`, which is not the canonical digest,
so the file was reported as *credential-shaped but not this credential* — a clean,
specific, confident false negative. Sliding a 93-byte window across the region afterwards
showed window 0 matching `d72bb520918e7a28` exactly.

AMEND 20.0 §3 supplies the part I could not see from inside my own leg: **every leg's
class overran.** `relocate` made the identical 96-byte overrun and was harmless only
because it logged an **offset** instead of a digest. So:

- **The defect is not the greedy class. The defect is hashing its output.** A digest
  destroys the evidence of its own overrun; an offset does not.
- Standing rule, adopted: **log an offset, never a digest, for a credential hit.**
- And the immunity was a **redaction choice**, not a correctness property. Together with
  two other legs' accidental immunities: **not one of the three immunities was a property
  of the method. A protection nobody chose is a protection nobody maintains.**

The safe form for a **known** value is byte containment, which selects no span. For an
**unknown** secret, extraction is unavoidable and every digest it produces is
**provisional** until confirmed by containment — which, per (b), is impossible when no
preimage is known.

### P4 — Silent-zero: a matcher can return "nothing found" and "I refused to look" on the same channel

`grep -c` against a matching **binary** file returns **empty stdout with exit 1** — not
even the "Binary file matches" line. A pipeline that counts lines of output reads that as
zero. `os.walk`-based scanners and `find -type f` disagree about UNIX sockets. A `nohup`
background job returns exit 0 with a zero-byte log.

In each case **absence of evidence and absence of looking are byte-identical downstream.**
The only defence I found that actually worked was a magnitude sanity check — asking whether
the number of files opened is plausible — and that is a human judgement, not a control.

### P5 — Split "unreadable" into DENIED and NOT-A-FILE

My unreadable bucket held two entries and they were not the same kind of thing.
`/tmp/tmux-1002/default` is a **UNIX socket**, which `os.walk` lists and `find -type f`
excludes. `/tmp/scion-metadata-shutdown-18380.token` is mode 600 owned by **root** — the
only genuine access denial I encountered all night.

Merging them inflates the apparent gap and, worse, **lets a real denial hide among
sockets**. Report them as separate counts.

### P6 — Declare population drift when you re-derive

My Order A re-derivation covered 214 files where the original covered 180. All 34
additional files were **my own apparatus**, built between the two runs. The zeros hold
over a superset, which is fine, but it is not the same population and saying "re-derived,
unchanged" without the drift figure implies it was.

**Our own fixture-building is a measurable contaminant of our own denominators.**

### P7 — The specificity axis is informative in proportion to the matcher's freedom

Order B required a one-byte-flipped needle, same length and alphabet, to return zero. On
my eight carriers the true value returned 1 and the mutant returned 0, eight for eight.

I reported that pass as **near-vacuous and it should not be counted as specificity
evidence.** For exact byte containment, `bytes.count` *cannot* fire on a different string;
the arm can only fail if the wrong subject was loaded or the reader is broken. It is a
useful **reader check**. It is not the failure the axis was built to catch.

The general predicate: **a specificity control discriminates only to the extent the
matcher had freedom to choose wrongly.** On a regex-plus-digest arm it is a real test. On
exact containment it approaches asserting that equality is equality. Require it on
extraction arms; label it a reader check on containment arms. AMEND 20.0 §3 has adopted
this and named the failure mode in its own mandate, which is the correct disposition.

### P8 — Select the subject by digest, not by variable name

My apparatus iterated `os.environ` and kept the value whose `sha256[0:16]` equalled the
canonical digest, rather than reading a named variable. Selecting by name assumes the
answer to the question the scan is asking. Selecting by digest also means the apparatus
still works if the variable is renamed, and fails loudly if the value is absent.

### P9 — Count nothing you can list; set-difference anything you are comparing

Three times I reported a count where a list was needed, and each time the count was
consistent with a conclusion the list contradicted. A reach census reported "6/6, 100%"
where listing showed three. A 117-path result meant nothing until the 117 were listed. A
control comparison needed `comm -23`, not two totals that happened to be equal.

**Two equal counts are not a demonstration that two sets are equal**, and the failure mode
is silent, because equal counts look exactly like agreement.

### P10 — A self-audit by textual search indicts you in your accuser's own words

Auditing whether I had run a forbidden command by searching the transcript for the command
name yields three wildly different answers depending on the denominator: whole-file grep,
commands I issued, or actual invocations. The prohibition *text* outnumbers the *act* by
307 to 0 for `git gc`. **A naive self-audit indicts you 307 to 0 in your accuser's own
words**, because the order forbidding the command contains the command.

Pick the denominator before running the search, and state it beside the number.

### P11 — A reach bug and a wrong population are different failures and only one is a bug

My battery's population was correctly chosen — for a different question — and then reused
without re-asking whether it was still the right population. Notably, the 18,220-path
"ROOT A" denominator contained **zero** `/workspace` paths, and `/workspace` is where
the carriers live.

**A reach bug truncates a population you chose. This was the wrong population, chosen
correctly for a different question and reused without re-asking.** No instrument reports
the second one, because nothing is malfunctioning.

### P12 — Count the directory, not the list you meant to copy

Twice my artefact manifest declared a count that the directory contradicted — declared 16
where there were 17, and, at the moment AMEND 20.0 arrived, declaring 25 where the
directory held 26. I recorded the first as a finding and then reproduced it in the same
file.

**A count written from the list you intended to copy is not a count of the directory.**
I am leaving the live discrepancy in place rather than fixing it, because AMEND 20.0
forbids new measurement and because a manifest that demonstrates its own finding is more
useful to the next reader than a manifest that is quietly correct. The 26th entry is
`p2ap.sweep.py`.

### P13 — On the governance finding

AMEND 20.0 §2 states that the freeze kept the crash's name and the crash's authority long
after its purpose had changed to protecting credential evidence, and that every extension
inherited an authority granted for something else. I record it here because it explains
something about my own leg that I could not explain from inside it: **I re-read the freeze
text many times and never once asked what it was for.** The text was stable, so it read as
settled. A control that outlives its justification does not announce the fact — and it is
*re-read*, not re-examined, by everyone downstream of it.

The companion finding in §4 is the one I would put first if I could only keep one:
**an investigation that keeps finding real things never signals that it is the wrong
priority. Every finding reads as justification to continue.** My leg produced twelve
method findings and a live credential, and every one of them made continuing feel more
obviously correct. Eleven hours of project time is the cost, and nothing in my instrument
was pointed at it. I did not raise the question either.

---

## (d) HOUSEKEEPING — NOTHING BELOW REQUIRES MEASUREMENT

- **Deliverables:** `predicate2/FINDINGS-INVERTED.md` (§2.10 the instrument was never
  mine; §2.11 the verdict was wrong, with the original claim struck through and retained);
  `predicate2/artefacts/` (26 entries, `MANIFEST.md` declaring 25 — see P12);
  `predicate2/check/` — **unwired**, as required: no hook, no CI file, no Makefile, no
  installation, no cron, and it was never `git add`ed.
- **No action was taken on** `/workspace/farmtable-passthrough-write-p1/test-writethrough.db`.
  I did not chmod it, move it, stage it, or run any git command against it or its worktree.
- **Rotation is `ptone`'s decision.** I did not anticipate it and I make no recommendation
  about timing here.
- **The credential value** was never printed, echoed, logged, written to disk, or passed
  as an argv element, by me, at any point.
- **Open and explicitly not commissioned:** provenance of the token in the database;
  the compressed-object / encoding gap (~438 MB, fails toward clean); the canonical blob
  re-derivation; `d56bcdd3619eb762`, permanently provisional.

Standing down.
