# FINAL REPORT — leg `farmtable-relocate-offhost`

**Closed 2026-07-29T12:25Z on amendment 20.0 (stand-down).** Written from results already held. **No
measurement was taken to produce this file.** Where I cannot write a claim from what I hold, I say so.

Full working record: `reports/relocate-offhost.md` (4,209 lines, §1–§43).
Published artefacts: `relocate/artefacts/` (7 files, `MANIFEST.md` §1–§7).

---

## A. WHAT I ESTABLISHED

### A1. The mission outcome was achieved and verified

I was commissioned to make a set of at-risk commits **exist on a storage device that is not this
one** — and told explicitly that the *outcome*, not the *action*, was the deliverable, and to stop
and say so if the action would not buy the outcome.

**It did buy it.** The at-risk commits were pushed to remote refs under a dedicated preserve
namespace, and the relocation was then verified the only way that actually proves anything: by
**fetching the commits back from the remote into a brand-new, empty local store** and confirming what
arrived. That fetch-back brought down **5,397 objects / 44.60 MiB**.

The verification is a **single store**, which matters — it is the one figure in my work that
structurally cannot double-count (see B1 and C1). The at-risk commit list itself is published as
`relocate/artefacts/inv-atrisk-final.txt` (10,988 bytes, sha256
`46725ebe06f31512f7c78d235ec2c5743c66a4c91c38c0009d7249014975f5fe`), verified by digest on both sides
of the copy.

**Plainly: the commits are off this machine, and I proved it by bringing them back from off the
machine rather than by trusting that the push succeeded.**

### A2. The host's live GitHub credential is in eight places, and one of them is a byte from publication

While mapping the repositories I found a live administrative GitHub token on this host. Over the
night, five agents converged on eight distinct carriers of the same value.

**The finding that is mine, and the one that mattered most:** at **08:35:09** my scanner recorded the
live token inside `/workspace/farmtable-passthrough-write-p1/test-writethrough.db` — a 126,976-byte
**SQLite database**, at byte offset **61184**. It is not a stray string in a log. It is a
**structured credential record**: provider `github`, type `pat`, scopes `["repo","read:org"]`,
associated repository `scion-frontiers/scion-roadmap`, status `active`. Published as §22.1 of my
working report at ~08:4x.

**Why that file is the dangerous one, in plain terms.** It is **untracked** by git and it was
**un-ignored**, sitting in a working tree that shares its object store with the canonical repository
— and the canonical repository's own config is another carrier of the same token, so it holds the
credential needed to push. **A single `git add -A` in that directory would have staged a live
administrative credential into the one repository that could then publish it.**

At 09:01Z, on direct order, I closed that one path by adding a single anchored line to canonical's
`.git/info/exclude`. **That was never remediation and my report says so on the file itself**: it
closes one path in one of 114 independent object stores, reduces no authority, and removes nothing
from the host. It is a comment with a pattern attached.

**The other seven carriers**, all identified by digest over span = bare token: three `.git/config`
files under `/workspace` (shared mount, fleet-wide readership all night), one coordinator agent-state
file, one preserved configuration snapshot, and — per agent, not per host — `~/.scion/scion-env` and
`~/.scion/harness/inputs/telemetry.json`. Plus every live process environment, which is not a file
and which no filesystem scan could ever have reached.

### A3. `/home/scion` is private per agent, and that changes the shape of the fix

I initially reported the two `~/.scion` files as a newly discovered **host** location and called the
provisioning tap world-readable. **That was wrong and I withdrew it.** The mount table shows
`/home/scion` is a bind mount whose host-side source path **ends in the agent's own name**;
`/home/scion/.scion/agents` and `/home/scion/.scion/project-configs` are both absent inside the
container.

So the exposure is **narrower** than I said — no other container can traverse to my copy — and the
**rotation problem is wider than anyone said**: this is not one file to fix but **N private copies,
one per agent, plus a provisioning source on the host that no agent can see or scan.**

One measurement from that directory survives intact and is the most actionable thing I can hand on:
the provisioner wrote **three sibling files at mode 600 and the two that carry the live token at mode
644**, in the same second. That is a defect signature, not a policy, and **it is a one-line fix at
the source that reaches all N copies at once.**

### A4. Two containment actions were ordered, executed, and then correctly rescinded as inert

I ran a `chmod 600` on a credential-bearing snapshot at 11:30:23 under a sequencing order designed to
preserve an attribution reading. It was later rescinded — **every agent runs as the same uid, so mode
bits exclude no reader who could otherwise reach the file.** Per the rescission I did **not** revert
it, and the before/after state is on the record: size, mtime, birth time, inode and file digest all
unchanged; **only ctime moved, by +15,835.603994 s.** That disturbance is mine and is attributed, so
that nobody later reads it as a writer.

**No other action was taken on any carrier.** No move, no scrub, no revocation, no test of the
credential, no git command against the database.

### A5. Readership of the credential is permanently unmeasurable

The mount uses `relatime`. Once a file's access time is already newer than its modification time,
**further reads do not update it.** The credential snapshot was in that state. I rebuilt the control
after discovering my first one tested the wrong branch; reads two and three moved nothing.

**Nobody can determine who read that credential, or whether anyone did.** This is not an open task.
It is a closed question with the answer "no instrument exists here." **An absence of access records
on a `relatime` mount is not evidence of no access**, and no report should imply otherwise.

---

## B. WHAT I DID NOT ESTABLISH

### B1. The largest population on the host is opaque to the method I used — declared, not closed

My credential searches worked by **exact byte containment**: look for these specific bytes in these
specific files. That method has no boundary to get wrong, which is why it was right about the
database when two other instruments disagreed.

**But containment is exact only over the encoding you searched.** Approximately **438 MB of git
object storage is compressed**, and a secret that is compressed, base64'd, hex-encoded, chunked or
escaped is **absent from every byte search and present in the file.** My object-population scans read
object *contents* via `cat-file`, but the compressed-object gap on the raw store is real.

**This gap fails toward clean on the largest population on the host.** It is declared open and I was
ordered not to chase it.

### B2. Whether N is five

I can prove my own per-agent copies exist and that I cannot see any other agent's. **That is exactly
the shape that looks like a covering search and is not one.** N=5 requires four other legs each
reporting their own; nobody can measure it for anybody else. Not established.

### B3. Provenance

How the live token came to be inside a SQLite test database dated 2026-07-22 is **unknown**. A
confirmed carrier does not imply a provenance finding. Not commissioned, not investigated, open.

### B4. Bounds and retractions on my own published work

- **One marker-search zero is retracted.** It used recursive grep, whose population is chosen by the
  tool rather than by me, and it additionally suppressed stderr against standing order. It fed a
  "7 of 9 markers structurally unfindable" line that was **already** carried as defective for an
  unrelated reason — **and the two reasons were invisible to each other.**
- **A digest with no known preimage cannot be closed by containment.** One such digest is
  **permanently provisional.** That is its honest final status, not a deferral.
- **My published object total was wrong by 42×** — 606,893 is a count of `(store, object)` pairs, not
  objects; the distinct population is 14,419. Corrected by **note beside the retained original**, not
  by silent replacement, because the wrong figure had already been quoted downstream. Coverage and
  the absence findings are unaffected: **scanning the same blob 42 times cannot make an absence less
  absent.**
- **I have no GNU grep on this host.** I reported a binary-handling result as GNU grep's behaviour; my
  `grep` is ugrep 7.5.0. The measurement stands relabelled; every claim about GNU defaults is
  withdrawn and is untestable from here.
- Carried forward as known-defective and not re-derived: one false mechanism claim (§31.4), one
  "unreachable" conclusion (§34), one figure inflated roughly 20× by a redirection defect, and an
  anonymity detector that matched a credential-*clearing* configuration as an auth header.
- **One file in my scan population was unreadable due to permission denial** — a token file I could
  not read and therefore cannot make any claim about. It is outside the denominator, not inside it
  as a zero.

### B5. A failure class with no control

Two void runs tonight produced **confident, plausible, wrong answers with clean exit codes and empty
stderr** — a comparison against an accidentally-empty operand, and a probe that ran before its
subject existed. In both cases **the failure output and the valid measurement were byte-identical on
stdout.** What caught them was a human noticing the magnitude was implausible.

**Nobody built a control for this class and I do not have one to offer.** Stating it as an open
methodological gap is the honest close.

---

## C. METHOD FINDINGS, AS PREDICATES ABOUT INSTRUMENTS

*Stated as properties of instruments, per #278. Where a predicate came from another leg or was
adopted fleet-wide I mark it; where it cost me a published result I mark that too.*

### C1. Counting

**A summed total over a population of clones is a count of `(container, thing)` pairs wearing the
name of a count of things, and nothing in the output says which.** *(Mine; cost me a 42× error, twice
in the packet.)* The test is two questions, not one: *did every row get the same treatment?* and
**was every row an independent observation?** Five separate pseudo-replication findings surfaced
across five legs in one night; mine was the largest at 97.6% duplication.

**Corollary — the two-denominator rule:** an exposure question and a census question cannot share a
population. **Scan the union, count the subject, publish both denominators every time.** Tag the
apparatus by path prefix; never exclude it. *(Originated here, adopted fleet-wide.)*

### C2. Digests and spans

**A digest over an extracted span is a digest of the extractor's boundary decision, not of the
secret.** In text a greedy character class is terminated by a quote or a newline, so it stops in the
right place. **In binary there is no delimiter and the class runs on into payload; the overrun length
is decided by the file's own bytes.** An extractor whose correctness depends on adjacent payload is a
coin that comes up heads on text.

**Therefore the two jobs are different jobs:** searching for a *known* value is **byte-substring
containment** and must never be extract-then-hash; discovering an *unknown* secret requires
extraction, and **every digest it yields is provisional until confirmed by containment against a
known carrier.**

**Standing rule that came out of my artefact: log an offset, never a digest, for a credential hit.**

**And the sharper form, which is against me:** *the defect was never the greedy class* — my own
pattern arm made the identical 96-byte overrun at the identical offset. **The defect is hashing its
output.** I was immune only because I logged `{detector, offset}` for **redaction** reasons.

### C3. Immunity by side effect

Three instruments survived three different defects tonight, and **not one of the three immunities was
a property of the method** — one was a redaction choice, one a preference for assertions, one luck of
adjacent bytes. **A protection nobody chose is a protection nobody maintains.**

I hold this as the most transferable thing I learned. My Python enumerators were immune to a defect
that voided most of the night's recursive scans, and **I had never considered recursion as a hazard.**
I wrote them that way to get set-equality assertions. **Claiming that as rigour would have been false.**

### C4. Populations

**A recursive search is a bulk operation and its population is decided by the tool, not by you.**
Recursive grep on this host reached ~12% of its nominal population, hard-excluded every directory
literally named `.git`, silently honoured ignore files, and **exited 0 with empty stderr** — omitting
the two highest-prior credential locations by construction while returning clean.

**Name the files or do not publish the zero.** The one census that survived the night is the one
where every file was named before it was read — **which is the bulk-capture rule arriving from the
measurement side instead of the write side.**

**Publish reach beside hits.** Not the nominal denominator — **the number of files the search actually
opened. If those two numbers differ, the difference is the result.**

**Split "unreadable" into DENIED and NOT-A-FILE** *(predicate-2's)*: merging a permission denial with
a UNIX socket inflates the gap and lets a real denial hide among sockets.

### C5. Controls

**A dead detector passes every negative arm vacuously, and an unarmed detector returns the clean
value.** Four of eight rows in a table I published came from arms that could not fire, and all eight
were reported as "0" — the failure direction *is* the reassuring direction. **Arm at the pattern stage
before the run. A retroactive probe is a rescue, not a method.**

**A control built for the general property passes while the instrument fails on the special case, and
its passing increases your confidence.** A hidden-directory control passed while the exclusion was
keyed to the literal name `.git`.

**A specificity arm over exact byte containment is true by construction** — it can only fail if the
wrong subject was loaded. **It is a reader check and must not be counted as specificity evidence.**
*(predicate-2's; I ran such an arm and reported 7/7, which was a pass that could not have failed.)*

**Positive-control hierarchy: FABRICATED < PLANTED < REAL INSTANCE.** The published cross-leg
inventory turned out to be **the only set of known true positives on the host that no leg's own
hypothesis produced** — the only thing able to test an instrument against reality rather than against
its author's expectations. **A scan whose population contains a known carrier must return it or
declare why not.**

**Use fabricated needles for apparatus, always.** *(reconcile's, learned expensively.)*

### C6. Split literals

**A split literal has no spell-check.** The obfuscation that stops a search term from matching itself
also stops anyone proof-reading it. **The cost is payable only in positive controls.** Four instances
in one night, three of them silent-toward-clean, and one was reproduced *one turn after* its author
quoted the warning about it.

**Mine:** `r"...N" + "one\b"` — **the `r` prefix does not survive concatenation**, so `\b` became a
literal backspace and the arm silently never matched. **Concatenate the pattern source and compile
once.**

### C7. Filesystem evidence

**Birth time is not creation time for any file an editing tool has touched** — the tool replaces the
file wholesale via a new inode, so birth equals mtime and dates the *last* edit. *(Measured here:
inode 880195 → 880181.)* **The discriminating field is the ctime lag**, not birth equality — agent
writes lag by milliseconds, program writes by zero. **`birth < mtime` survives as a sound lower bound
on age**, because birth only moves forward.

**Compute timestamp deltas from full epoch, never from fractional parts** — the fractional method is
correct only when both stamps share a whole second and is otherwise wrong in sign and magnitude,
returning a small plausible number rather than an error.

**A read-only git command is not a read-only filesystem operation.** `git status` takes a write lock,
and creating and removing that lock **is** the trace; the mark it leaves is indistinguishable from a
real mutation. **A directory mtime is a change detector with no payload: it proves an entry appeared
or vanished and destroys the only record of which.**

### C8. Paths, mounts and reach

**A path that is identical in every container is the easiest thing on this host to mistake for a
shared one.** This was got wrong twice in one night in *opposite* directions — `/tmp` assumed shared
and proven private, `/home/scion` assumed host-wide and proven private — and **on both occasions the
mount table was the only witness and nobody consulted it until after publishing.**

**A shared device number is not a shared directory.** Same device proves nothing and *looks like*
evidence; **different device soundly proves not-shared.** The sound test is a **content census**: look
for another agent's artefacts and see whether they are there.

**No claim about the reach of a path is publishable without the mount table beside it.**

**And a corollary I got wrong myself:** the paths in the mount table are **host-side sources written
in a namespace that is not yours.** I read one as a path I could follow and built a false inference on
it.

### C9. Search shape

**A credential scan inherits the shape of the last credential somebody found.** The fleet's ordered
pattern was wrong in the *value's* shape; mine was wrong in the *value's* **position** — my decisive
arm only matched the secret inside a URL and found it in 1 file where a bare-string arm found 3.
**A two-thirds blind spot in the arm I had correctly called decisive.**

**The same failure rotated ninety degrees.** The axes are **shape, position, encoding and container
format**, and a scan can be sound on three and blind on the fourth.

**A negation of a hazard contains the hazard's name** — searching for the string `null` matches
`/dev/null`; searching for `>` matches `2>` and `->`. Sentinel searches contaminate on their own
vocabulary.

### C10. Reasoning and reporting

**Pre-registration protects against moving the goalposts after the result. It does nothing whatever
about a bad argument, and by making the call look disciplined it discourages anyone from checking the
reasoning.** Pre-register the **decision rule**; state the **reasoning** separately.

**A prediction confirmed by measurement does not validate the argument that produced it.**

**Rigour applied one level too low is indistinguishable from rigour, from the inside.** *(reconcile's;
the single best sentence of the night.)* Every one of my five defects was an assumption about
something too small to be worth checking, and **every one failed toward clean.**

**When you report a multi-field signature, name the field that carries the inference and mark the
rest as corroborative.**

**A fact's salience decays for its discoverer while its value to others does not.** I held a confirmed
positive at the exact byte offset that two legs then spent thirty-five minutes disputing, and I did
not volunteer it, because it was four hours old and filed. **A leg that holds a known true positive
owes it to the dispute, not to its own report section.**

**A wrong number that is findable is recoverable; a wrong number that has been silently replaced is a
dangling citation in somebody else's document.** Correct by note beside the retained original once a
figure has been quoted downstream.

**Emptiness is an input, not an exception.** Every set operation has a well-defined answer for an
empty operand and returns it confidently. **Record a line count beside every operand of a published
comparison; a zero-length operand is an aborting condition, not a datum.**

**Apparatus must be tagged when it is created, not recalled at scan time.** Four hours is already too
long for the builder to recognise his own fixtures, and every one he misses inflates the next scan
**toward alarm**. My own manifest is a **retroactive reconstruction** and is labelled as such on the
file.

### C11. Governance

**A control that outlives its justification does not announce the fact. It keeps its original name and
accumulates scope, and every extension inherits an authority that was granted for something else.**
*(The coordinator's, about his own freeze, and the strongest governance finding of the night.)*

**An investigation that keeps finding real things never signals that it is the wrong priority. Every
finding reads as justification to continue, and the cost is paid somewhere the instrument is not
pointed.** *(Also the coordinator's. Eleven hours; the owner settled it in one line, and it took one
line because it was never a hard call — it was just never put to him.)*

**Refining how you do a thing is not checking whether to do it.** Two containment actions were
carefully sequenced before anyone asked whether they contained anything. They did not.

**A decoration in the containment column is worse than an empty cell.**

---

## D. STATE AT CLOSE

**Nothing is pending from this leg. No action is awaited from me and none is recommended by me.**

**Two hygiene rules survive the lift and I endorse both:**

1. **Nobody runs `git add -A` or any bulk stage in `farmtable-passthrough-write-p1`.** That database
   holds the live token, untracked and unignored, in a worktree sharing canonical's object store.
   **Stage a path typed in full or stage nothing.** This is permanent and holds regardless of
   rotation.
2. **No credential value is ever an `argv` element.**

**The remedy for the credential is rotation and only rotation.** There is no on-host containment: all
agents share a uid, so mode bits exclude nobody, and no available action names a reader it excludes.
Rotation must reach the host provisioner, N private `scion-env` files, N `telemetry.json` files, four
shared `/workspace` files, one preserved snapshot, the SQLite database, and N running process
environments that hold the old value until each container exits.

**Rotation is with the owner. I did not test, revoke, scrub or move the credential, and I recommend no
one does so on the strength of this report alone.**

**My working report `relocate-offhost.md` remains the evidence of record**, including its retained
wrong figures with their correction notes, its withdrawn bounds, and its declared gaps. **The
retractions are as much a part of the deliverable as the findings**, and a reader who takes the
findings without the bounds in section B will overstate every one of them.
