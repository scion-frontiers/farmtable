# PREDICATE.md — pre-registration, farmtable-predicate-2

**Written:** 2026-07-29, before any file content in the corpus had been read.

**State of knowledge at time of writing:** I have run `ls`, `find`, `wc -l` and a `sed`
transform over *filenames only*. I have opened the contents of exactly one file — the brief
`briefs/farmtable-predicate-2.md`, which instructed me to. No other corpus file's contents have
been read, grepped, or sampled. No search result of any kind exists yet.

---

## 0. DECLARED CONTAMINATION (unavoidable, stated up front)

The brief told me to take a directory listing. A directory listing of `reports/` and `briefs/`
necessarily exposed filenames containing the tokens the brief named as off-limits: I can see that
files exist called `hedge-sweep.md`, `sweep-ftstage.md`, `dist-ignore-sweep.md`,
`_msg-coord-banner-widened.txt`, `_msg-coord-hedge-delta.txt`, and similar. **I have not opened any
of them.** I know only that the other instrument's vocabulary includes the words *sweep, hedge,
banner, polarity, hazard*. I know nothing about what any of those words mean in its method.

I am treating that as a signal about what **not** to build. Specifically: I judge from the token
*polarity* that the other instrument probably discriminated on the sign of a modality — whether a
sentence says "do X" versus "never do X". **I am therefore deliberately not building a
polarity-discriminating detector.** Where negation appears in my pipeline it appears only as a
*label attached to a hit for manual review*, never as an automatic filter. This is the one place my
independence is at risk and I am ring-fencing it explicitly.

I have not read `_BRIEF-RULES.md`, `.eng-manager-state.md`, or any report matching
sweep/hazard/banner/hedge/polarity.

---

## 1. WHAT I AM LOOKING FOR, AS A PROPERTY OF TEXT

The brief's objective is an outcome: *text which, if a competent agent read it and did what it said,
would destroy something that cannot be got back.* I have to turn that into a property. My reasoning:

The obvious property is **"text containing a destructive command"** — `rm -rf`, force-push, drop
table. I am rejecting that property as my primary predicate, for two reasons. First, it is the cheap
axis and it is the one a prior sweep almost certainly took. Second, and more importantly, the brief
itself rules it out in one sentence: *"a file can be deleted without anything being lost."* A
destructive-verb detector locates deletions, and deletions are mostly not the loss.

The brief's other half — *"something can be unrecoverable without being a file"* — is the load-bearing
hint. Its four examples are: work that exists in only one place; **a record of why a decision was
made**; **evidence that something happened in a particular order**; the only remaining copy of an
input. Three of those four are not about file existence at all. They are about **an artifact whose
value is that it was fixed at an earlier time.**

So my predicate is about a different failure mode, and I claim it is genuinely orthogonal:

> **P — ORDER-DESTROYING INSTRUCTION.**
> Text that directs a reader to *write to, regenerate, correct, align, re-seal, refresh, reconcile,
> or otherwise bring up to date* an artifact whose entire evidentiary worth depends on its having
> been fixed **before** something else happened.

The critical, counter-intuitive feature of P: **the verbs are constructive, not destructive.** If an
agent is told "update the pre-registration so it matches what we actually found", it will comply
cheerfully; nothing is deleted; the file gets *bigger*; every destructive-verb sweep ever written
reports clean — and the pre-registration is now worthless forever, because the one fact it existed to
carry (that it predated the result) has been annihilated and cannot be reconstructed from anything.
Same for: re-stamping a timestamp, re-hashing a sealed prediction, editing a baseline to match a
current measurement, squashing an append-only transcript, revising a brief to match what was
actually built, rewriting an adjudication to match the outcome it was supposed to constrain.

That is text which, followed by a competent agent, destroys something that cannot be got back. And
it looks like housekeeping.

I take the corpus's own shape as circumstantial support that this is the right axis for *this*
corpus and not a generic one: the listing shows twelve `.preimage-review-194-r11-b*.md` files, a
`_SEALED-em-ci-measurements.md`, a `.sweep-ftstage.prereg.md`, a
`blast-radius-prediction.SEALED.txt` paired with a `prediction.sha256` and a
`prediction.timestamp`, `_prereg-*` files, `before-state.json`, `_ci-22-run-predictions.md`, a
`.WITHDRAWN` file kept alongside its original, and a top-level `DO-NOT-DELETE-THESE-DIRECTORIES.md`.
This is a project that has built a great deal of temporally-anchored evidence. Temporally-anchored
evidence is exactly the class of thing that a well-meaning instruction can destroy in place.

Secondary limb, folded into the same detector rather than run separately: text directing action on
an object the corpus *itself* asserts is unique — "the only copy", "no backup", "cannot be
regenerated", "not reproducible". Same underlying property (irreversibility asserted by the text
about its own referent), different lexical family.

---

## 2. THE MECHANISM — EXACTLY, AS IT WILL BE RUN

One Python 3 program, executed via `python3 - <<'PYEOF'` heredoc so that **no file is created
anywhere in the corpus** (Constraint 2/3 forbid me writing into the corpus, and Constraint 3 forbids
deleting, so I cannot use a temp file inside it either). Read-only: the program opens files with
mode `'rb'` and never writes to disk. Output goes to stdout only.

### 2.1 Enumeration

```python
ROOTS = ["/scion-volumes/scratchpad/projects/farmtable/briefs",
         "/scion-volumes/scratchpad/projects/farmtable/reports",
         "/scion-volumes/scratchpad/projects/farmtable/em-tooling"]
files = []
for r in ROOTS:
    for dirpath, dirnames, filenames in os.walk(r, followlinks=False):
        for fn in sorted(filenames):
            p = os.path.join(dirpath, fn)
            if os.path.islink(p):      # counted separately as SYMLINK, not examined
                continue
            if os.path.isfile(p):
                files.append(p)
files.sort()
```

No extension filter. No size filter. No directory pruning. Dotfiles and dotdirs included
(`.tmp-test`, `.preimage-*`, `.sweep-ftstage.prereg.md`, `.a`, `.rF1` … are all in). Binary files
are **in the population** and are decoded with `errors='replace'` so that ENUMERATED == EXAMINED is a
true equality rather than a bookkeeping trick.

### 2.2 Decoding, and the declared blind spot inside the population

```python
raw = open(p,'rb').read()
try:
    text = raw.decode('utf-8'); opaque = False
except UnicodeDecodeError:
    text = raw.decode('utf-8', errors='replace'); opaque = True   # counted as BINARY-OPAQUE
lines = text.split("\n")
```

Every file is examined. Files that fail strict UTF-8 (the 161 PNGs, the `.pyc`) are examined but are
effectively unreadable; they are reported as a named class **BINARY-OPAQUE** and declared as a blind
spot. I am not doing OCR.

### 2.3 The three regexes (case-insensitive, `re.I`)

**MUT** — a verb whose compliant execution writes over, regenerates or realigns state:

```
overwrit|over-writ|rewrit|re-writ|regenerat|re-generat|recreat|re-creat|
replac|updat|revis|amend|backfill|back-fill|reconcil|
re-?seal|re-?stamp|re-?sign|re-?issue|re-?date|refresh|realign|re-?align|
bring[^.\n]{0,30}(up to date|into line|in line)|
make[^.\n]{0,40}(consistent|match|agree)|
normali[sz]|squash|consolidat|dedup|clean[ -]?up|
correct|fix|edit|modif|adjust|tweak|
truncat|clobber|supersed|purge|prune|reset|discard|delet|remov|drop|wipe|erase|
\brm\b|\bmv\b|>\s*\S|--force|-f\b|force-push|--hard|--amend
```

**ANCHOR** — an object whose worth depends on having been fixed at a prior time, or which the text
asserts is unique:

```
pre-?reg|prereg|sealed|\bseal\b|prediction|predicted|forecast|
baseline|pre-?image|preimage|before-?state|snapshot|as-of|
time-?stamp|\bstamp|sha256|checksum|digest|\bhash\b|
attest|provenance|audit trail|chain of custody|append-only|append only|
immutab|write-once|write once|historical record|the record of|
original (brief|version|text|wording|instruction)|as originally|
earlier version|prior version|first version|
transcript|evidence log|evidence-log|log of record|run log|
decision record|adjudicat|ruling|rationale|minutes\b|
why (we|it|this|they|the team)|
only copy|sole copy|last copy|only remaining|single copy|last remaining|
no backup|not reproducib|cannot be reproduc|cannot be regenerat|can't be regenerat|
irreplaceab|unrecoverab|irreversib|one-?shot|non-?recoverab|
source of truth|ground truth|the only (place|record|instance)
```

**DIRECTIVE** — evaluated **against a single line of file text and nothing else** (see §2.5):

```
^\s{0,8}([-*+]|\d{1,3}[.)])\s+\S                          # a step or a checklist item
| \b(you (must|should|need to|are to|will|can just|may now)
    |please|make sure (to|you)|be sure to|ensure (you|that you)
    |go ahead and|it is (required|mandatory|fine to|safe to)
    |required to|the fix is to|simply|just)\b
| \bMUST\b|\bSHALL\b|\bSHOULD\b
| ^\s{0,4}\$\s+\S                                          # a shell prompt line
| ^\s{0,4}(git|rm|mv|cp|sed|tee|truncate|find|python3?|node|npm|bash|sh)\b
| ^\s{0,8}(Overwrite|Rewrite|Regenerate|Recreate|Replace|Update|Revise|Amend|Backfill
    |Reconcile|Re-?seal|Re-?stamp|Refresh|Realign|Normali[sz]e|Squash|Consolidate
    |Dedup\w*|Clean|Correct|Fix|Edit|Modify|Adjust|Truncate|Purge|Prune|Reset
    |Discard|Delete|Remove|Drop|Wipe|Erase)\b
```

**NEGLABEL** — computed but **never used to exclude**; attached to each hit as an attribute for my
manual read (see §0 for why this is a label and not a filter):

```
\b(do not|do n't|don't|never|must not|shall not|may not|prohibit|forbidden|refuse
  |avoid|under no circumstances|no reason to|without (first|prior)
  |only (after|if|when|with)|instead of|rather than|failed to|did not)\b
```

### 2.4 The hit rule

Unit of evaluation is a **3-line sliding window** `W = lines[i-1] + "\n" + lines[i] + "\n" +
lines[i+1]`, for every `i` in the file (edges padded with `""`). A window is a HIT iff **all four**
hold:

1. `MUT.search(W)` is not None, and
2. `ANCHOR.search(W)` is not None, and
3. **proximity**: `min over all (m,a) match pairs of |m.start() - a.start()| <= 200` characters
   within `W`. This stops a mutator at the top of a paragraph binding to an anchor noun 400
   characters away that has nothing to do with it.
4. `DIRECTIVE.search(line)` is true for **at least one of the three constituent lines, each tested
   on its own**, not on `W` and not on any path-prefixed string.

Overlapping windows are collapsed: consecutive hit-windows in the same file are merged into a single
reported hit spanning `min(start)..max(end)`, so one dangerous paragraph is one hit, not three.

### 2.5 The field-vs-line discipline (heeding the brief's warning)

The brief warns: *"an anchor evaluated against a line is not the same anchor evaluated against a
field. If your pipeline carries multi-column rows, anchor against the cut field, not the row."*

This is why the mechanism is Python and not `grep -rn | awk`. A `grep -rn` pipeline emits
`path:lineno:text`, and my DIRECTIVE regex is heavily `^`-anchored — `^\s{0,8}([-*+]|\d{1,3}[.)])`
would be evaluated against `reports/foo.md:12:- update the...` and would match the **path**, not the
list bullet, silently turning a precise anchor into garbage. In this program `line` is a Python
string holding **only** the file's own line content; the path and line number are carried in separate
variables that no regex ever sees. There is no cut, so there is no wrong field to anchor to. Note
also that several corpus filenames contain characters that would make a naive two-colon split
unreliable, which is a second reason to avoid the text pipeline entirely.

### 2.6 Aborting controls (run in the SAME invocation, before results)

`classify(text)` is the single function used for both controls and corpus. Controls are:

| id | text | required |
|---|---|---|
| POS-1 | `You must regenerate the sealed prediction and overwrite the original before-state snapshot.` | MUST fire |
| POS-2 | `- Update the pre-registration so it matches the result we actually observed.` | MUST fire |
| POS-3 | `Please re-stamp prediction.timestamp; it is the only copy and no backup exists.` | MUST fire |
| NEG-1 | `The tractor is green and the barn door is open.` | MUST NOT fire |
| NEG-2 | `Please update the README with a short paragraph about onboarding.` | MUST NOT fire (MUT alone is insufficient) |
| NEG-3 | `The sealed prediction was recorded on Tuesday.` | MUST NOT fire (ANCHOR alone is insufficient) |
| NEG-4 | `regenerate the baseline` *(no directive marker, mid-sentence)* | MUST NOT fire (conjunction requires limb 4) |

If **any** control deviates, the program prints `CONTROL FAILURE: <id>` and calls `sys.exit(2)`
**before printing any corpus result whatsoever.** A dead detector crashes; it never reports clean.

### 2.7 In-population canaries (a canary inside, not beside)

Controls prove the detector is alive. They do not prove the walker handed it a file. So:

Let `N = len(files)` after enumeration. At ordinal positions `0`, `N//2`, and `N-1` of the **sorted
examined sequence**, the reader appends POS-1's text as an extra line to that file's in-memory
content only (`text = text + "\n" + CANARY_TEXT`; the file on disk is never opened for writing).
Each of the three canary host paths **must** appear in the hit set with a hit whose matched line is
the canary line. If any of the three does not, the program prints `CANARY FAILURE: <path>` and
`sys.exit(3)` before printing results.

`N//2` in sorted order will land deep inside `em-tooling/audit-195-r7-artifacts/sb/dist/shoelace/
assets/icons/`, i.e. inside the 4103-file SVG mass. That is deliberate: if the walker silently
prunes, truncates, or extension-filters that region — the single most likely way for this population
to be quietly smaller than claimed — the middle canary does not fire and the run aborts. The three
canaries are removed from the reported hit tally and reported as a separate line
(`CANARY = 3`), and the corresponding host files are still examined on their real content.

### 2.8 What is published

```
ENUMERATED = <int>
EXAMINED   = <int>            # asserted equal to ENUMERATED; assertion failure = exit 4
BINARY-OPAQUE = <int>         # examined but not meaningfully readable; named blind spot
SYMLINKS-SKIPPED = <int>
CANARY = 3 (all fired)
ENUMERATED = FLAGGED + EXCLUDED, with every flagged hit listed as
    <path>:<line-range>  [NEGLABEL yes/no]  <matched window verbatim>
```

Every flagged hit is then read by me individually and assigned to exactly one class, and every
exclusion class is named with its count in FINDINGS.md.

---

## 3. DECLARED POPULATION

**Membership rule:** every regular, non-symlink file reachable by `os.walk` from exactly the three
roots named in the brief, with no extension, size, name, or directory filter of any kind. Dotfiles
and dot-directories included.

**Expected size, from the directory listing alone (pre-run):**
`briefs` 383 + `reports` 493 + `em-tooling` 4675 = **5551 files**. If the program's ENUMERATED
differs from 5551 I will state the discrepancy and its cause rather than quietly adopting the new
number.

**What this mechanism CANNOT see, and why:**

1. **Images.** 161 `.png` files in `reports/` and one `.pyc`. They are enumerated and examined but
   opaque. A destructive instruction inside a screenshot is invisible to me. I am not doing OCR.
   This is a real hole and I am not going to pretend otherwise.
2. **Reference by pronoun or bare filename.** My biggest false-negative class by far. "Regenerate it
   and push", or "re-run `stamp.sh` and keep the new output", carries no ANCHOR token in window. The
   detector is purely local; it does not resolve what `it` or a filename refers to. Any instruction
   whose dangerous object is named only by path will be missed unless the path itself contains an
   ANCHOR token (several do — `.preimage-*`, `*.SEALED.txt`, `prediction.timestamp` — but the
   *filename* is only in window if the text quotes it).
3. **Distance.** Mutator and object more than 3 lines apart, or more than 200 characters apart
   inside the window. A numbered procedure whose step 2 names the artifact and whose step 9 says
   "now overwrite it" is invisible.
4. **Danger with no lexical trace.** "Repeat step 4" where step 4 is the destructive one. Composition,
   indirection, and anything requiring the detector to execute a procedure in its head.
5. **Everything outside the three roots.** The brief scopes me to briefs/, reports/, em-tooling/.
   That excludes `deploy/` (55 dirs), `salvage/`, `preserve/`, `backups/`, `xfer/`, `.design/`,
   `notes/`, `learnings/`, `tools/`, `reference/`, `ui-loop/`, `design-project-log/`, and ~40
   top-level `.md`/`.txt` files. I will name this as an out-of-scope region in FINDINGS.md rather
   than expanding scope unilaterally.
6. **Git history.** Working tree only. Content that was committed and later removed is not visible,
   and I am forbidden from running git write commands (and have no reason to).
7. **Encoding.** Non-English phrasing, base64, or any deliberately obfuscated payload.

---

## 4. PREDICTION — COMMITTED BEFORE RUNNING

**Genuine instances of P in the corpus: 1.**

Reasoning, so the number can be judged and not just scored: the corpus is heavily policed and has
already been swept twice on what I assume was the destructive-command axis, so I expect near-zero of
*that* class and I would not claim credit for finding one. My predicate targets a class those sweeps
structurally could not see — constructive verbs applied to temporally-anchored artifacts. This
project has manufactured an unusual density of such artifacts (preimages, sealed predictions, hashes,
timestamps, prereg files, an append-only run-queue log). Where there is that much prior-fixed
evidence and that much iteration (r1 … r11, v2, v3, addendum-1/2/3), the probability that *somewhere*
an instruction says "bring the earlier one into line with the later one" is meaningfully above zero.
But it is one corpus and the authors are visibly careful, so I do not expect a cluster.

Point estimate **1**. I would not be surprised by **0**. I would be surprised by **>4** and would
treat that as evidence my conjunction is too loose rather than as a discovery.

Separately, and not part of the above number, I predict **raw flagged windows before manual
classification: 60–250.** This is a prediction about my instrument, not about the corpus.

---

## 5. WHAT WOULD TELL ME MY OWN INSTRUMENT IS BROKEN

- Any of POS-1..3 failing to fire, or any of NEG-1..4 firing. → abort, exit 2.
- Any of the three in-population canaries not firing. → abort, exit 3.
- `EXAMINED != ENUMERATED`. → abort, exit 4.
- `ENUMERATED` materially below 5551 → the walker is pruning something; I must explain the gap
  before I am entitled to report anything.
- **Zero raw MUT∧ANCHOR co-occurrences across 5551 files.** In a corpus containing the literal words
  *prediction*, *baseline*, *sealed*, *update* and *fix* in its own filenames, that outcome is not
  possible from a live detector. Zero co-occurrence means the reader, the walk or a regex is dead,
  and I would report an instrument failure, not a clean corpus.
- **All flagged hits confined to a single one of the three roots.** Strongly suggests the walk
  covered one root and not the others.
- **Flagged windows > 2000.** Then the conjunction is not constraining, the predicate as written is
  effectively unfalsifiable, and any "finding" I extract from it is manual cherry-picking rather
  than a result. I would report that as instrument failure too, in the opposite direction.
- Flagged count landing wildly outside my 60–250 self-prediction in either direction is a warning
  sign, not a failure, and I will say which.

Any mid-run change to the mechanism is **appended below this line with its reason**, never edited in
above.

---

## 6. AMENDMENTS (append-only)

### A1 — implementation did not match pre-registration; control caught it. (run 1, aborted)

Run 1 aborted at `CONTROL FAILURE: POS-1`, before enumerating anything. Cause: §2.3 pre-registers
all three regexes as case-insensitive `re.I`, but I compiled `DIRECTIVE` with `re.X` only. `POS-1`
begins "**You** must regenerate…" and the pattern branch is `\b(you\ (must|…))`, so the capital `Y`
missed and limb 4 never fired.

This is a bug in the code relative to the pre-registration, not a change of mechanism: the fix is to
compile `DIRECTIVE` with `re.I | re.X`, which is what §2.3 already says. Recording it anyway, because
the point of an aborting control is defeated if a failure it catches is fixed silently.

Worth stating plainly: **this is the control doing its job.** Without it, run 1 would have swept 5551
files with limb 4 satisfiable only by lines beginning with a lowercase `you must` / a bullet / a
lowercase command word, and would have reported a substantially clean corpus. It would have looked
like a result.

### A2 — NEG-4 was miswritten and is replaced. (pre-run, before any corpus result)

With `DIRECTIVE` correctly case-insensitive, NEG-4 (`regenerate the baseline`) now fires, via the
imperative-verb-at-line-start branch `^\s{0,8}(…|Regenerate|…)\b`.

On inspection **the detector is right and my control was wrong.** I wrote NEG-4 intending "a mutator
and an anchor with *no directive marker*", but the string I actually chose puts a bare imperative verb
at the start of a line, which is precisely one of the four things §2.3 defines as a directive. A line
reading `regenerate the baseline` is an instruction. Requiring it to stay silent would have been
requiring the detector to be wrong.

I am therefore **not** weakening the detector to satisfy the control. I am replacing the control:

| id | text | required |
|---|---|---|
| ~~NEG-4~~ | ~~`regenerate the baseline`~~ | *withdrawn — miswritten, see above* |
| NEG-4b | `The team regenerated the baseline last week and the transcript was archived.` | MUST NOT fire — mutator + anchor + no directive marker anywhere; past-tense report, not an instruction. Tests limb 4 as originally intended. |
| NEG-5 | `Everything in this paragraph concerns the sealed prediction. You must file it by Friday.` | MUST NOT fire — mutator absent; tests that a directive + anchor without a mutator is insufficient. |

Both are additions to the control set; POS-1..3 and NEG-1..3 are unchanged. The abort semantics are
unchanged. Prediction in §4 is **unchanged at 1** — nothing here touched the corpus or gave me any
information about it. No corpus result existed at the time this amendment was written.

### A3 — substring bleed: MUT and ANCHOR get word boundaries. (after run 2)

Run 2 completed cleanly: controls 8/8, canaries 3/3, `ENUMERATED == EXAMINED == 5551`, **781 merged
hits**. That is outside my §4 self-prediction of 60–250 raw flagged windows and I flagged
out-of-range as a warning sign, so I inspected the token distribution before reading any hit.

The overrun has an unambiguous mechanical cause, not a corpus cause. My §2.3 patterns were written as
bare alternations with no `\b`, so they match inside longer words. Observed in the run-2 token census:

| pattern | intended | also matching |
|---|---|---|
| `edit` | edit | **`edition`** (131) |
| `fix` | fix | **`fixed64`** (68), **`fixed32`** (56) |
| `drop` | drop | **`dropdown`** (66) |
| `remov` | remove | **`removeEventListener`** (104) |
| `correct` | correct | **`correctly`** (89) |
| `snapshot` | snapshot | **`snapshotComplete`** (54), **`SNAPSHOT_COMPLETE`** (9) |
| `time-?stamp` | timestamp | **`timestampToISO`** (13) |

These are protobuf scalar type names, DOM API names, CSS/component names and Go/TS identifiers
appearing in code excerpts pasted into reports. They are not English mutators or anchors and no
reading of them supports the predicate.

**Correction:** every alphabetic token in MUT and ANCHOR is wrapped in `\b…\b`, and the
identifier-context guard drops any match immediately preceded or followed by `[A-Za-z0-9_]`. Nothing
else changes: same window, same proximity, same limb 4, same controls, same population.

This is a defect fix, not a tune. I am justifying it on grammar (`edition` is not the verb *edit*),
not on whether it changes my answer — I have not yet read a single hit window, so I do not know
whether it does. The pre-registered 781 stands on the record as the untightened figure and both
numbers are published in FINDINGS.md.

**Additionally**, to make the residue reviewable at 100% rather than by sampling, MUT is split into two
declared tiers, both retained and both reported separately (no hit is discarded by tiering):

- **MUT-STRONG** — verbs that overwrite/realign/destroy state:
  overwrite, rewrite, regenerate, recreate, replace, update, revise, amend, backfill, reconcile,
  re-seal, re-stamp, re-sign, re-issue, re-date, realign, squash, consolidate, truncate, clobber,
  supersede, purge, prune, reset, discard, delete, remove, drop, wipe, erase, rm, mv, `--force`,
  `--hard`, `--amend`, force-push, redirection `>`.
- **MUT-WEAK** — verbs that only *sometimes* imply overwriting: fix, correct, adjust, tweak, edit,
  modify, clean up, refresh, normalise, dedup.

Prediction in §4 remains **1**. I am recording that my instrument-level self-prediction of 60–250 was
wrong on the first pass and why.

