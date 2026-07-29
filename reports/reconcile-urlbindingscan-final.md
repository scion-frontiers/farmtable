# reconcile-urlbindingscan — FINAL

**Leg:** reconcile-urlbindingscan · **Project:** farmtable · **Closed:** 2026-07-29, on Amend 20.0 stand-down.

Written from results already in hand. No measurement was run to produce this file. Where I could not
write a claim from what I already held, I have said so rather than gone and looked.

---

## 1. WHAT I ESTABLISHED

### 1.1 The question I was actually sent to answer

I was asked to reconcile a contradiction about whether a URL-binding scan test file existed in the
farmtable repository. Two prior reports disagreed: one said the file did not exist anywhere, the other
implied it did.

**The file exists.** It is in the canonical repository, blob `c8cb6993581fa202c44cf702f41680fa96442a78`,
68,066 bytes. The report that said it did not exist was wrong, and it was wrong for a specific and
repeatable reason: **its search was correctly written but pointed at a set of repositories that could
not have contained the answer.** The query was fine. The population was wrong. That distinction turned
out to be the theme of the entire night.

### 1.2 The repository census

There are **109 independent git object stores** on this host. A census of references across them
produced **231 rows, every one of them produced by the same check, with zero failed invocations** —
the only uniformity claim I made all night that is a measurement rather than an absence of evidence.

The substantive finding: **123 of those 231 rows are not independent.** They are the canonical
repository plus 122 linked worktrees, all sharing one object store and therefore one set of references.
A naive count returns 60,464 references; the true figure is 8,126. The gap reconciles exactly:
8,126 + (122 × 429) = 60,464. **Anyone counting references per directory inflates the total 7.4×**, and
the inflated number looks entirely plausible.

A separate, cleaner result is preserved in the packet: a 6,914-object measurement restricted to the
canonical store only, which is immune to this inflation because it counts objects once.

### 1.3 The credential exposure

A live administrative GitHub token is present in **eight files** on this host. I established this by
searching for the token's exact bytes across every readable file on the three mounted filesystems:

| population | files enumerated | files opened | bytes read | carriers |
|---|---|---|---|---|
| `/scion-volumes` | 18,442 | 18,423 | 517,122,909 | 1 |
| `/home/scion` | 169 | 169 | 12,048,018 | 2 |
| `/workspace` | 1,810,804 | 1,809,234 | 15,539,557,203 | 5 |
| **total** | **1,829,415** | **1,827,826** | **16.07 GB** | **8** |

Zero files were unreadable and the run produced no error output. The population was 1,791,346 text
files and 36,480 binary files; **binaries were included**, which matters because one of the eight
carriers is a binary database file that every text-oriented scan on this host had missed.

Before reading any of those files the detector was proved live against three files already known to
contain the token, and proved silent against two files that could not.

**No ninth carrier exists in any byte-addressable file on those three mounts.** That statement is
bounded — see §2.1, which is the most important limitation in this document.

### 1.4 The eighth carrier, and a dispute that was never a disagreement

One file was contested: a 126,976-byte database in a working tree. I reported the token present; another
leg reported it absent. Both were correct measurements of the same bytes.

The token is at **byte offset 61184** and is **93 bytes** long. The three bytes immediately following it
are ordinary alphanumeric database payload. A search that *extracts* a token-shaped string using a
greedy character class does not stop at the end of the token — in a binary file there is no delimiter to
stop it — so it captured **96 bytes**, and the fingerprint of those 96 bytes matches nothing. I
reproduced that exact 96-byte span and its exact fingerprint from my side, which is what closed the
dispute.

**The two contradictory results were one measurement seen through two predicates.** A third leg had
in fact confirmed the same carrier three and a half hours earlier, by the same method later ruled
correct; that result had been published and then lost track of.

### 1.5 Where the credential is not, and how it spreads

- `/tmp` is **per-container**, not shared between agents. The load-bearing evidence is that `/tmp` has
  no entry in the process mount table at all, so it is part of the container's own root filesystem.
- `/home/scion` is **per-agent** — the host path underneath it ends in the agent's own name. Files that
  appear at an identical path in every container are not one shared file; they are N private copies.
- The token is present in **every agent's process environment**, inherited by every subprocess. It was
  outside every file-based population by construction, not by oversight.

The practical consequence: **the spread is by replication, not by sharing.** Any remediation must reach
the provisioner, N private copies per agent, several shared files, and N running process environments
that retain the old value until each container exits.

### 1.6 The search tooling on this host is not what it appears to be

`grep` is not the grep binary. It is a **shell function** injected by the harness, which runs ugrep with
five flags nobody types:

```
-G  --ignore-files  --hidden  -I  --exclude-dir=.git  (plus .svn .hg .bzr .jj .sl)
```

`find` is likewise shadowed and runs `bfs`, not GNU findutils.

Each flag has a consequence, and they are inverted for the job of searching for secrets:

- `--exclude-dir=.git` — **hard-excludes every `.git` directory by literal name.** A git credential
  lives in `.git/config` by construction.
- `--ignore-files` — **silently honours `.gitignore`**, which is very nearly a list of the places a
  developer decided must not be committed.
- `-I` — **skips binary files.** This is why the eighth carrier went unfound for eleven hours.
- `-G` — **forces basic regular expressions**, so `{36}` and `|` are literal characters unless `-E` is
  given. A pattern written in the modern style silently cannot match.
- `--hidden` — hidden files *are* searched, which is why a control built to test hidden-directory
  handling passed while the instrument was broken elsewhere.

Every one of these returns exit status 0 and writes nothing to standard error.

**`-I` and `-G` are not recursion faults.** They corrupt a search of a single named file. Any remedy
framed around "do not recurse" does not reach them. Running the real binary via `command grep` bypasses
the wrapper entirely.

---

## 2. WHAT I DID NOT ESTABLISH

### 2.1 History is not cleared — this is the largest open gap

My credential sweep searched raw file bytes. **Every byte of git object storage is zlib-compressed**, so
a token inside a committed object is invisible to it. In `/workspace` that is **308 packfiles
(327.8 MB) and 33,736 loose objects (110.0 MB)** — roughly **438 MB opaque to the instrument**.

I proved this is real rather than theoretical using a fabricated 93-byte string framed exactly as git
frames an object: byte search finds it 0 times compressed, 1 time after decompression.

> **"No ninth carrier" is a statement about working trees and configuration files. It is not a statement
> about repository history.** A credential committed at any point and later removed from the working tree
> would sit in the object store and my sweep would report clean.

The direction matters: **this fails toward a clean result**, on the largest population on the host.

The correct instrument is object enumeration, which decompresses as it reads. That is another leg's
population, not mine. **Declared gap, not closed, by instruction.**

### 2.2 My own earlier object-level scan was never re-derived

I ran a scan over canonical's objects earlier in the night that found 59 token-shaped strings and judged
them all test fixtures. **That scan matched patterns; it did not compare against the known token's
bytes.** Under the rule adopted later that night it is provisional. I did not re-derive it, and I am
naming it rather than letting it pass as settled.

### 2.3 Provenance of the eighth carrier

I established that the token's exact bytes are in that database file at a specific offset. I established
nothing about **how they got there, when, or by what process.** A confirmed carrier row must not be read
as implying a provenance finding it does not contain.

### 2.4 Container isolation is bounded, not universal

I proved **my** container is not one specific other leg's container. I did **not** prove that no two legs
share a container. A negative result from one pair is not a property of the population.

### 2.5 An unattributed write into the canonical repository

**Five loose objects were created in canonical's object store at 10:00:22Z**, and a fetch ran there at
07:50:15Z. Neither was mine — my command history contains no object-writing git command against
canonical. **I could not attribute either and did not guess.**

### 2.6 The extent of my own write to the canonical repository

I ran `git status` inside canonical at 06:26:46Z, which is a write: it can take a lock and rewrite the
index. The index is **unchanged** — its timestamp is 34 hours older than my run, which is the
load-bearing fact. But the `.git` directory's own timestamp has since moved twice for unrelated reasons,
so **whether my command bumped it is now unrecoverable.** I can prove the index is untouched. I cannot
prove nothing else was.

### 2.7 A fingerprint with no known preimage

One fingerprint recorded during the night matches no value anyone has found. A fingerprint with no known
preimage **can never be resolved by searching for bytes**, because there are no bytes to search for. Its
honest status is permanently provisional — that is a classification, not a deferral.

---

## 3. METHOD FINDINGS — PREDICATES ABOUT INSTRUMENTS

Stated as properties of instruments, so they transfer. Each is a way an instrument returns a confident
answer that is wrong, and in almost every case **the wrong answer is the calm one**.

### 3.1 On populations

**A correctly-keyed search over a set that cannot contain the answer returns a clean, well-formed
negative.** The query is not the instrument. The population is part of the instrument, and it is the part
nobody inspects.

**A recursive search is a bulk operation whose population is chosen by the tool, not by the operator.**
If you cannot name the files a search will open, you cannot interpret its zero.

**Report the number of files the search actually opened beside the number it matched.** Where the reach
and the population differ, the difference *is* the result.

**Re-deriving a result changes the population you are re-deriving over**, because investigation creates
artefacts. Population drift must be declared, not assumed negligible.

### 3.2 On result sets

**A null in a scope field does not mean "no scope" — it means a weaker check ran, and its row looks
identical to the strong one.** Zero nulls does not close the check. The question is whether every row in
a result set was produced by the same check.

**Pseudo-replication is that failure with the strengths all equal:** every row got identical treatment
and the aggregate is still wrong, because the rows were never independent. Ask both — *same treatment?*
and *independent observations?*

**At fleet scale the same predicate applies to agreement between investigators.** Where several
investigators share a toolchain, their concordance is one instrument reporting several times. Agreement
between bounded instruments is not evidence that any of them was unbounded — and where the instrument is
literally the same one, the sample size is one.

### 3.3 On absences, and the failures that look like measurements

**A probe that runs before its subject exists returns the correct answer for the wrong reason, and its
output is byte-identical to the valid measurement.** Any negative probe needs the subject's existence
confirmed with a timestamp before the read.

**A measurement whose operand was empty, absent, or never executed returns a confident extreme value and
no error.** Two live instances, both silent, both with exit status 0:

- `timeout` cannot execute a shell builtin, so a command wrapping one fails instantly and yields zero
  results for every population it was pointed at.
- `find -xdev` on a plain directory whose *subdirectory* is the mount point returns zero files, with a
  correct flag, a correct exit status, and empty error output.

> **On standard output, the failure and the measurement are indistinguishable.** What caught both was
> noticing that twenty gigabytes cannot contain zero files — a sanity check on magnitude, not a control.
> **No control for this class currently exists, in anyone's practice on this host.** That is worth saying
> plainly rather than leaving as an implied gap.

**Suppressing error output on an exploratory command converts every failure into a clean negative.**

### 3.4 On identifying a known value

**Searching for a known value and discovering an unknown one are different jobs and need different
instruments.**

- Known value → **byte-substring containment.** There is no boundary to get wrong.
- Unknown secret → extraction is unavoidable, and every fingerprint it yields is provisional until
  confirmed by containment against a known carrier.

**If a matcher chose your span, you did not declare it — it declared itself, and it rounds outward. A
fingerprint over an extracted span is a fingerprint of the extractor's boundary decision, not of the
secret.** In text a token is terminated by a quote or a newline and the boundary lands correctly; in
binary there is no delimiter and the overrun length is decided by the file's own payload. **A detector
whose correctness depends on the bytes next door is a coin that comes up heads on text.**

**Log an offset, never a fingerprint, for a credential hit.** An offset cannot be wrong about its span,
and it is not sensitive.

**Containment is exact only over the encoding you searched. A secret that is compressed, base64'd,
hex'd, chunked or escaped is absent from every byte search and present in the file.** Containment has no
boundary to get wrong, but it has an encoding to get wrong.

**A negative result over a structured text format is only sound if the value's own alphabet survives that
format's escaping.** State the reason, or the zero is luck.

### 3.5 On controls

**Positive controls rank: fabricated < planted < a real instance of the hazard.** Where the top tier is
unreachable, say which of the two opposite reasons applies — the hazard is genuinely absent, or arming it
would create it — because those produce identical-looking zeros with opposite meanings.

**A published cross-investigator inventory of known true positives is the only control set that tests an
instrument against reality rather than against its author's hypothesis.** Any scan whose population
contains a known carrier must return it or explain why not. That check is free, because the answers are
already known.

**A control built for the general property passes while the instrument fails on the special case, and its
passing increases confidence.** A control for hidden-directory handling does not test an exclusion keyed
to a literal directory name.

**A control that cannot fail is not evidence.** For exact byte containment, a specificity arm is true by
construction — it can only fail if the wrong subject was loaded. It is a reader check, and counting it as
specificity evidence puts a column of guaranteed passes into the control table. *(This corrects a control
I proposed and that was briefly mandated; the correction is right.)*

**A decoration in the containment column is worse than an empty cell.** A protective action that excludes
no actual reader records as mitigation and reads later as safety. Before any containment action, name the
reader it excludes — not the permission it sets. Where every process shares one user id, file permission
bits exclude nobody.

**Use fabricated needles for apparatus, always.** Real secret material proves nothing that a synthetic
string of the same shape does not, and creating it turns the thing under protection into test equipment.

**A protection nobody chose is a protection nobody maintains.** Several results survived defective
instruments by side effect — a logging choice, a lucky adjacent byte, a reach bug that happened to point
the right way. None was a property of the method, so none can be relied on again.

### 3.6 On obfuscated search terms

**A split literal has no spell-check.** Assembling a search term from fragments so it does not match
itself also defeats proof-reading; the defect is invisible on the page and returns a clean zero. **The
cost is payable only in positive controls.** This produced four separate silent failures in one night
across three investigators, and in at least one case the defect was reproduced within a single turn *by
someone who had just documented it*. Knowing the hazard in detail is not a defence.

### 3.7 On attention

**Rigour applied one level too low is indistinguishable from rigour, from the inside.** Refining how you
do a thing is not checking whether to do it, and the closer the attention paid to the procedure, the
safer the premise looks.

**A retraction scoped to an example is applied only to the example.** Withdrawing an instrument by
naming the incident lets the incident travel while the class stays in use. Name the predicate.

**A claim about the reach of a path is not publishable without the mount table beside it.** A path
identical in every container is the easiest thing here to mistake for a shared one — and that mistake was
made twice in one night in opposite directions.

**A fact's salience decays for the person who found it while its value to everyone else does not.** A
holder of a known true positive owes it to the open dispute, not to their own report section.

**Where a new result and an older one disagree, recency wins the adjudication unless someone insists on
method.** The older result had been produced by the better instrument.

### 3.8 On investigations

**A control that outlives its justification does not announce the fact.** It keeps its original name and
accumulates scope, and each extension inherits authority granted for something else.

**An investigation that keeps finding real things never signals that it is the wrong priority.** Every
finding reads as justification to continue, and the cost accrues somewhere the instrument is not
pointed. Someone must ask the question from outside; it will not arrive from within the work.

---

## 4. HYGIENE THAT OUTLIVES THIS INVESTIGATION

Two items are permanent and are not part of any lifted freeze:

1. **No bulk staging in the working tree containing the database carrier.** That file holds a live
   credential, is untracked and not ignored, and sits in a worktree sharing the canonical object store —
   whose configuration holds the token needed to publish. A single bulk add stages a live credential into
   the repository that can push it. **Stage paths typed in full, or stage nothing.** This holds regardless
   of whether the credential is rotated.
2. **No credential value is ever a command-line argument.**

The remedy for the exposure itself is rotation, and rotation must reach the provisioner, the per-agent
copies, the shared files, and every running process environment.

---

## 5. NOTE ON THIS DOCUMENT

No credential-bearing scan was run to produce this file; scans are stood down. The file was composed
without the credential value ever being handled, printed, or written, so no value can be present in it.
Every figure quoted here was measured earlier and is reproduced from record.

Two of my own conduct failures are recorded in the working report rather than here, because §3 was asked
for as predicates rather than incidents: a false negative answer given to a direct question (a search for
the literal name of a command that my own invocation form could not match), and writing the live
credential to disk as test material and then deleting it. Both are disclosed in full at
`reconcile-urlbindingscan.md` §5.2.34 and §5.2.36. The predicates they produced are in §3.6, §3.1 and
§3.5 above, which is the part that transfers.
