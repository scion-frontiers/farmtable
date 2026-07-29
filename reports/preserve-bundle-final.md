# preserve-bundle — FINAL

Written 2026-07-29 after stand-down. **No measurement was performed to produce this file.**
Every figure below was already held. Where I could not write a claim from what I held, I say so.

Full working record: `reports/preserve-bundle.md` (3,335 lines, §§1–31).

---

## (a) WHAT I ESTABLISHED

### The assigned task, which was the original point

**A restore was performed and verified. Yes.**

Six commits touching a merge-blocking test suite existed on one disk and on no remote. The brief
asked not for a bundle but for a bundle that had been restored from and verified by content hash.
That was done: blob `c8cb6993581fa202c44cf702f41680fa96442a78`, 68,066 bytes,
`web/src/util/url-binding-scan.test.ts`, restored into a scratch directory, confirmed by content
hash, with an executed recovery instruction. Nothing in eleven hours of subsequent amendment
disturbed it.

The brief's own thesis — that a backup file is a receipt, and an artefact recording that a backup
happened is indistinguishable to every later reader from the data being safe — turned out to
generalise well beyond backups. It is restated as a predicate in section (c).

### The credential picture

Eight files on this host carry a live GitHub personal access token with push rights on 279
repositories and admin on 243, across 20 organisations. Seven were confirmed by my own byte-substring
containment scan across 1,835,375 files. The eighth is a database file I was denied and did not read;
three other legs confirmed it independently.

The eight are: three `.git/config` files under `/workspace`; a coordinator agent-state JSON, also
under `/workspace`; a preserved config snapshot in the scratchpad; a per-agent `scion-env`; a
per-agent harness `telemetry.json`; and the passthrough-write database. `/workspace` is shared
across every agent by design, so the four files there have had fleet-wide readership throughout.

Two structural facts about the spread matter more than the count:

**The credential's source is per-agent, not per-host.** `/home/scion` inside each container is a bind
mount whose host-side path ends in that agent's own name. Each agent has its own `scion-env` and its
own `telemetry.json`, each carrying the same secret, plus a provisioning source outside every
container. Rotation is therefore not a matter of fixing one file: it must reach the host provisioner,
N private copies of two files each, four shared files under `/workspace`, one preserved snapshot, and
N running process environments that hold the old value until each container exits.

**The widest copy is not in a file at all.** Every credential population anyone assembled was a
population of files. The token is in every agent's process environment, inherited by every subprocess,
and no filesystem scan could ever have found it. It was outside every denominator by construction.

The passthrough-write database is untracked and unignored, mode 644, inside a linked worktree that
shares the canonical repository's object store — and the canonical repository's config is itself one
of the eight, so it holds the token needed to push. One bulk `git add` in that tree stages a live
administrative credential into the repository that can publish it.

### The repository-state question I was asked to resolve

The mid-freeze mutation at `/workspace/farmtable-em-verify195` was **not a freeze violation and not a
content change**. Every object, ref, index, log and HEAD in that repository dates from the previous
day. The only thing carrying the 08:48:12 timestamp is the `.git` directory itself, mtime and ctime
identical to the nanosecond. A worktree-prune explanation was eliminated by a covering search of 127
gitdir registrations host-wide, none of which name it.

The signature is that of `git status`: a five-command near-miss panel (`log -1`, `rev-parse`,
`for-each-ref`, `count-objects -v`, `fsck`) left the directory mtime unmoved, while `git status` on
an already-fresh index moved the directory mtime and left the index mtime untouched. The load-bearing
observation is that pairing — directory moved, index did not.

Honest bound: `git status` is **sufficient** to produce the signature. I did not show it necessary.
Any operation that creates and removes a top-level entry in `.git` fits equally.

This carried an operational consequence that was acted on fleet-wide: reading a frozen tree with
`git status` bumps the very timestamps that constitute the freeze evidence, and the mark it leaves
cannot be distinguished from a real mutation.

---

## (b) WHAT I DID NOT ESTABLISH, AND WHAT BOUNDS IT

**Encoding.** My containment scan is exact only over the encoding I searched: raw bytes. A secret
that is compressed, base64'd, hex-encoded, chunked or escaped is absent from every byte search and
present in the file. Approximately 438 MB of git object storage on this host is zlib-compressed and
therefore opaque to the method I used. This is the largest population on the host and the gap **fails
toward clean**. Declared, not closed.

**The denied file class.** `.db`, `.db-wal`, `.db-shm`, `.sqlite` and `.sqlite3` were excluded from
every scan I ran, under a standing rule. The eighth carrier is precisely a `.db`. My scan could not
have found it and did not.

**An unidentified 40-character token.** `/tmp/tok-url.txt` contains a classic-format token that is
not the canonical secret. It is not attributed and not provably a placeholder. Identifying it needs
either a registry of known dummy values or a validity test, and no validity test was performed.

**An unreproducible digest.** `d56bcdd3619eb762` was published as a digest of a file whose bytes
provably never changed and which no span of those bytes reproduces. It is either a digest of
something nobody found or it is fabricated. A digest with no known preimage cannot be closed by
containment, so this is **permanently provisional** — that is its honest status, not a deferral.

**A remediation claim I cannot verify.** My own working record states that a non-emptiness
precondition was added to a set-comparison after it produced a void result. No preserved artefact
verifies that the control was installed.

**Whether any two legs share a container.** I proved my container is not reconcile's, by content:
my `/tmp` contains none of its artefacts, my home holds exactly one transcript where a shared home
would hold five, and my process namespace shows only my own processes. Two legs proven separate is
not five legs proven separate.

**Provenance of anything.** I established where the credential rests. I established nothing about how
any copy got there.

**A correction to my own headline, which is the sharpest bound here.** I published "seven of seven,
no eighth found anywhere" two paragraphs after declaring that I had excluded the `.db` class and that
the disputed file was unadjudicated. The eighth carrier was in exactly that class. The correct claim
was always "no eighth found outside the class I declared I could not read."

**One disclosure.** In the corrected containment scan I passed the token as an `argv` element,
reasoning that it was already in the process environment and that the alternative — a pattern file —
would have created a durable on-disk carrier. That trade has since been ruled against: no credential
value is ever an argv element. The reasoning was not unreasonable and the ruling is correct; a
transient exposure is still an exposure, and the choice was between two options when a third existed.

---

## (c) METHOD FINDINGS, AS PREDICATES ABOUT INSTRUMENTS

**A recursive search is a bulk operation whose population is chosen by the tool, not by the caller.**
On this host `grep -r` opened 2,135 of 17,631 readable files in a git working tree — 12% — while
exiting 0 with empty stderr. It hard-excludes every directory named `.git` and silently honours
`.gitignore`. These defaults are correct for searching source code and exactly inverted for searching
for secrets: `.gitignore` is very nearly a definition of where credentials live, and `.git/config` is
where a git credential lives by construction. *Name the files or do not publish the zero.*

**A denominator and a numerator produced by different instruments are not a rate.** Publishing a
`find(1)` population beside a `grep -r` hit count states a coverage that was never measured. Publish
the number of files the search actually opened; where that differs from the population, the
difference is the result.

**A control built for the general property passes while the instrument fails on the special case, and
its passing increases confidence.** A hidden-directory control passed throughout while the exclusion
was keyed to the literal name `.git`, not to the leading dot.

**A calibration set proves an instrument is not dead and says nothing about coverage.** An instrument
reaching 12% that happens to contain every known carrier within that 12% passes calibration
perfectly. Only the reach count says where it looked.

**A published inventory is a tier-3 positive control over a real population; held privately it is
only a receipt.** Every control a single investigator can build is something they planted. A
cross-party list of known true positives is the only material that can test an instrument against
reality rather than against its author's hypothesis. The 12%-reach defect was caught by an inventory
published fifteen minutes earlier, and by nothing else.

**Fixing a coverage bug can activate a correctness bug that the coverage bug was masking.** My extract-
then-hash arm never saw a binary file, because a separate defect prevented the instrument from reading
one. Roughly 1,383 binaries sat in the populations. Had only the coverage bug been fixed, those files
would have entered a false-negative class at scale, failing toward clean, in a freshly repaired
instrument trusted more than before. Three such immunities were found across the fleet in one night,
and not one was a property of the method that enjoyed it. *A protection nobody chose is a protection
nobody maintains.*

**An obfuscation that stops a search term matching itself also stops anyone proof-reading it.**
Assembling `"gh" + "ithub_pat_"` yields `ghithub_pat_`, which reads as correct at every glance and
matches nothing. This occurred four times across the fleet, twice within one hour, including once by
a leg that had quoted the warning one turn earlier. *Knowing the hazard in detail does not prevent
reproducing it. A split literal has no spell-check and is payable only in positive controls.*

**A measurement whose operand was empty or absent returns a confident extreme value and no error.**
Emptiness is an input, not an exception; every set operation has a well-defined answer for it. One
comparison returned maximally-different and, re-run 28 seconds later, maximally-same. Record a line
count for every operand beside every published result, and treat a zero-length operand as aborting.

**The artefact that proves a computation was void is usually empty, and every preservation policy
ordered by size or by interest discards it first.** The zero-byte operand appeared in neither the
authorised nor the declined preservation list, because nothing about an empty file looks like
evidence. Enumerate preservation by role — was this an input to a published number — never by
interest.

**A one-directional difference test applied to a canary that perturbs in the other direction returns
the dead-instrument signature exactly.** The symmetric difference is the only sound test and costs
the same.

**A false retraction is as expensive as a false claim and arrives dressed as rigour.** After a long
sequence of withdrawals, the cheapest way to appear careful is to withdraw one more — which is
precisely when a retraction stops being checked. Nothing in this process subjected a withdrawal to
the scrutiny it applied to a claim.

**A digest of a small credential-only file is a confirmation oracle for that credential.** Anyone
holding a guess can test it offline, forever, with no network and no log entry. Prove the invariant,
publish the verdict, withhold the witness. Relatedly, and now standing: log an offset, never a digest,
for a credential hit.

**A digest travelling without the span it was taken over is not an identifier.** Two parties hashing
one secret over different spans report two credentials and escalate a spread that does not exist —
and the redaction that protects the value is exactly what removes the ability to notice. Where a
matcher chose the span, it was not declared: it declared itself, and it rounds outward. In text the
token is delimited; in binary the character class runs on into payload and the overrun length is
decided by the file's own bytes.

**Searching for a known value and discovering an unknown one are different jobs.** The first is byte
containment and has no boundary to get wrong. The second requires extraction, and every digest
extraction yields is provisional until confirmed by containment against a known carrier.

**Containment is exact only over the encoding you searched.** It has no boundary to get wrong, but it
has an encoding to get wrong, and that failure is silent.

**A path identical in every container is the easiest thing to mistake for a shared one, and a shared
device number is not a shared directory.** This host produced that error twice in one hour in
opposite directions — `/tmp` assumed shared and proven private, `/home/scion` assumed host-wide and
proven private. The mount table was the only witness in both cases and was consulted only afterwards.
The sound test is a content census: look for another party's artefacts and see whether they are there.

**A read-only git command is not a read-only filesystem operation.** `git status` takes a write lock,
and creating and removing that lock is the entire trace. Auditing a freeze by timestamps while
inspecting it with the one command everybody believes is safe manufactures the finding it was sent to
look for.

**A directory mtime is a change detector with no payload.** It proves an entry appeared or vanished
and destroys the only record of which — so the freeze-relevant case is precisely the unreadable one.

**Apparatus must be tagged when it is created, not recalled at scan time.** Four hours was already too
long for me to recognise eleven of my own fixtures; I tagged them as subject on first pass. Every
missed fixture inflates the next scan toward alarm.

**A near-miss control that contains the positive is a superstring, not a near-miss.** It tests nothing
and accuses a healthy instrument.

**A specificity arm is required on extraction and vacuous on containment.** For exact byte
containment it is true by construction and can only fail if the wrong subject was loaded; counted as
specificity evidence it is a column of passes that cannot discriminate.

**Declare the instrument by name and version.** `grep` on this host is ugrep 7.5.0, not GNU grep, with
materially different defaults. Nobody declared this for eleven hours, so cross-party agreement may
have been agreement between different instruments over different populations — and a matching pair of
zeros may be one party that looked and one that did not, with the concordance making both credible.

**No control exists yet for the class where a failed invocation and a valid measurement are
byte-identical on stdout.** `timeout` cannot exec a shell builtin and returns confident zeros;
`find -xdev` on a plain directory returns zero files with clean stderr and a correct exit status.
Both were caught by a magnitude sanity check, not by any control anyone had built. Saying so is the
honest state of the art here.

**Split "unreadable" into denied and not-a-file.** Merging a permission denial with a socket inflates
the gap and lets a real denial hide among artefacts that were never files.

**Declare population drift when re-deriving.** Fixture-building is a measurable contaminant of one's
own denominators.

**Being on an inventory is not a mitigation.** An inventory entry is a receipt: recording that a
credential is exposed is indistinguishable, to every later reader, from the credential being handled
— and it is worse than no entry, because the absence of one invites action and the presence of one
forecloses it. I contained the instance I discovered while the instance with the widest readership sat
untouched in my own preserve directory, because it was already on a list. The same predicate applies
to a published reconciliation, which reads as a mitigation of the item it closed only half of, and to
a remediation described as "added".

**Rigour applied one level too low is indistinguishable from rigour, from the inside.** Refining how
an action is performed is not checking whether to perform it, and the closer attention paid to the
procedure, the safer the premise looks.

**A prediction confirmed by measurement does not validate the argument that produced it.**
Pre-registration protects against moving the goalposts after a result. It does nothing about a bad
argument, and by making a call look disciplined it discourages anyone from checking the reasoning.
Pre-register the decision rule; state the reasoning separately.

**A retraction scoped to an example is applied only to the example.** Illustrating a class with an
instance means the instance is what travels. Name the predicate, not the incident.

**A control that outlives its justification does not announce the fact.** It keeps its original name
and accumulates scope, and every extension inherits authority granted for something else.

**An investigation that keeps finding real things never signals that it is the wrong priority.**
Every finding reads as justification to continue, and the cost is paid somewhere the instrument is
not pointed. This one ran for eleven hours while the project it belonged to did not move, and the
question was never put to the person who could answer it in one line.

---

## (d) STATE AT CLOSE

No measurement was run to produce this file.

Nothing was deleted, moved, renamed, built, tested, pushed, garbage-collected or pruned at any point.
No write was made into the canonical repository's `.git`. The two hygiene rules that survive the lift
were observed throughout and remain permanent: no bulk stage in the passthrough-write tree, and no
credential value as an argv element — the latter breached once by me, disclosed at the time, and
recorded above.

Artefacts left in place: the working record at `reports/preserve-bundle.md`; the preserved operand
set at `preserve/tmp-denominators-20260729/` (20 files, all content-hash verified both sides,
including the two zero-byte operands that proved a published comparison void); the apparatus manifest
at `/tmp/APPARATUS-MANIFEST-preserve-bundle.txt`; and the cross-container probe file
`/tmp/pb-shared-probe-20260729.txt`, which is now spent and may be removed by anyone.

The declared gaps — compressed object storage, the denied file class, the unattributed 40-character
token, the permanently provisional digest, and the unverifiable remediation claim — stay open, in
writing, as gaps. That was the instruction and it is the right one: a gap written down is worth more
than a gap closed badly.
