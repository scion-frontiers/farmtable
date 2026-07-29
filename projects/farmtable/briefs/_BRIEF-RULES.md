# Brief rules — how to write an agent brief on this workstream

Written by the EM after **ten consecutive rounds in which my brief contained at least one
error**, and several in which a hint of mine actively misdirected a leg. These rules exist
because the brief is the one artifact no reviewer reviews.

*Running count: round 8's brief had **four** errors, round 9's had **eight**. The rate is not
improving, so these rules are written on the assumption that it will not.*

---

## 0. The governing fact

**Every round, legs that ignored my hints found something better than the hint.** Round 8's
`dev-195-r9` silently improved my own instruction (blind at each scanner's boundary, not once
at the caller). Round 7's legs found the live vector by disregarding a hint that pointed at
string literals when the vector was template literals.

A brief is a **starting point with a known error rate**, not an authority. Write it so a leg
can route around it, and make routing around it a **deliverable** rather than a discourtesy.

---

## 1. Independence: three reviewers must NOT get the same brief

**A shared brief defeats the independence the three-way round exists to buy.** If code review,
security audit, and test review all read the same framing, the same ordering, and the same
list of concerns, they will converge on the same blind spot — and three converging reports
will read as *corroboration* when they are in fact *one opinion, transcribed three times*.

Rules:

- **Each of the three gets a brief written separately, with a different emphasis.** Not the
  same document with a different heading.
- **Do NOT tell a review leg what the other legs are looking at.** They will helpfully
  de-duplicate, and the overlap is the point — overlap is how you find out that two
  independent instruments disagree.
- **Do NOT relay another leg's findings into a parallel leg's brief.** Relay only *after* all
  legs are in (**R13**). A finding relayed mid-round converts an independent measurement into
  a confirmation exercise.
- **Vary the axis, not just the wording.** If one leg is pointed at the diff, point another at
  the invariant and a third at the fixtures. Same-axis briefs produce same-axis controls, and
  a same-axis control is **non-evidence** for the failure that matters.
- Where a fact must reach all three (the known-good baseline, a flaky test, a build quirk),
  state it identically in all three — **facts may be shared; framing must not be.**
- **Say this to every review leg, in these words:** *"Agreeing with a premise supplied in this
  brief is worth ZERO, and from the outside it looks identical to genuine convergence. If you
  confirm something I asserted, say that you are confirming MY claim and show your own
  measurement."* Otherwise the round's most dangerous output is three legs agreeing with me.

### 1a. A review leg cannot cancel a parallel leg, and must be told so explicitly

**The near-miss that produced this rule.** A code-review leg closed its report with the
recommendation: *"This change should NOT be escalated to a security specialist."* It was a
reasonable sentence on its own axis — the leg had examined the diff and found it safe, and it
was **right about that**. Running in parallel, in another clone, on the same commit, the
security audit it was recommending against returned **two HIGH-severity findings**, both of them
entirely outside the diff: a live unguarded sink and a guard that no path in the repository
executes.

They do not conflict on fact. The auditor agreed the diff was safe. **They conflict on scope** —
"this diff introduces no security risk" and "this codebase has no security risk here" are
different claims, and only a leg looking outside the diff can answer the second. Had the
recommendation been read as a *sequencing decision* rather than as one leg's opinion, it would
have suppressed precisely the two findings that mattered most that night.

Rules that follow:

- **A review leg is never asked, and must never be allowed to imply, whether a parallel leg
  should run.** By the time it writes, that leg has already run. It cannot be cancelled
  retroactively and its findings are not the review leg's to weigh.
- **When asking any leg about escalation, scope the question in the brief to FOLLOW-ON work
  only**, and say why in one line: *"This is a recommendation about further work. It is not a
  decision about the parallel legs already running, which you cannot cancel and must not assume
  the content of."*
- **Never let "the diff is clean" stand as "the area is clean."** Those are different
  denominators. A leg whose axis is the diff has, by construction, no information about the
  surrounding trust boundary — and a recommendation phrased as though it did is the most
  plausible-sounding way to lose a finding.
- Note what makes this dangerous rather than merely wrong: **the recommendation sounds like
  good stewardship.** Declining unnecessary escalation is normally a virtue. There is no tell in
  the sentence itself; the only defence is the structural rule.

### The convergence a shared brief destroys

Round 7's three legs produced **one** genuine conflict and **two apparent conflicts that were
not conflicts at all** — "is the change correct" vs "is the change pinned", and "is it correct
now" vs "would a regression be caught". Each pair *sounds* like one question and is two.
Rounding them together silently drops whichever finding looks like the loser of a fight that
was never happening — **more dangerous than a real conflict, because a real conflict announces
itself and a merged non-conflict does not.**

The same round surfaced a convergence **no single leg could see**: one property test closes
both a Critical and a Medium, because they are the same underlying disagreement wearing two
severity labels. Visible only by reading all three reports together. **Triaging by severity
tag would have funded the Critical and let the Medium ride** — two fixes for one defect, or
one fix and one live gap.

## 2. Tag every claim, and tag it honestly

- `[MEASURED]` — **only** if I ran the check myself, this session. Not inherited (**R17**).
- `[MEASURED-BY-<leg>]` — somebody else's measurement I am relaying. Say so, name the leg,
  and instruct re-measurement before reliance. **An inherited `[MEASURED]` is not mine (R15).**
- `[BELIEVED]` / `[CARRIED FROM <round>]` — everything else.
- An untagged factual claim in a brief is a defect. Tag it or delete it.

### 2a. Name the noun (the M-1 rule)

**An identifier that names both a defect and its fix makes true and false sentences
indistinguishable by surface form.** `M-1` named both the bug *and* the change that fixes it.
I wrote "live in production" meaning **the defect**; the auditor read it as **the fix**,
hardened it into "(shipped, live in production)", and rested a severity rating on it. Measured
afterwards: `origin/main`'s `NewPlatformResolver` takes no config param, `DefaultConfigPath`
does not exist on `origin/main`, and `1d4442f` is not an ancestor of `origin/main`.

"M-1 is live" is **true of one noun and false of the other.** Write *"the M-1 defect is live"*
or *"the M-1 fix has shipped"* — never the bare identifier. Same family as *coincidental
equality at an origin*: when two things share a name, the shared name generates true and false
sentences that are indistinguishable the moment the referents diverge.

### 2c. Name the POPULATION before you report a count (taxonomy form (10))

A count in a brief is an instruction about what to fix. **Getting the number right is not the
same as counting the right things**, and the second failure is invisible once the first is
repaired.

The instance, and both halves are mine. I wrote that the proto declares `string.uri = true` on
**two** fields. A parallel audit independently also wrote "two" — **a different two**. *(First
lesson, worth its own line: two independent partial enumerations agreeing on a count is not
corroboration.)* I then measured properly, corrected the brief to **four**, and told the leg to
guard all four. The leg reported back that one of the four is a **dead field** — no write path,
no read path, no renderer — so my corrected instruction contained one real fix and one no-op.
The number that actually governed the work was neither: **annotations (4) ≠ live fields (3) ≠
client-controlled ingress paths (3, a different 3).**

Correcting a count *feels* like finishing the job. The visible error is gone and the new
arithmetic is genuinely right, so nothing prompts the question **"of what?"**

Rules:

- **State every count as `<n> <population>`, where the population is a noun phrase that says
  what membership requires.** "Four fields carry the annotation" — not "four fields".
- **Say whether you inspected members or only counted them.** These are different verbs and the
  brief must not blur them.
- **When you correct a count, re-ask whether it is the count that matters.** A correction is the
  highest-risk moment for this error, because the correction absorbs all the scrutiny.
- **Ask the leg for its own denominator anyway**, and expect it to differ from yours. On this
  instance the leg's independent enumeration is what exposed the dead field.

### 2b. Never invoke a principle to license destroying something (the most dangerous error)

**A false fact misinforms; a false principle hands over permission to act.** I wrote that a
test was "vacuous — it cannot fail", citing the true general rule *a test that cannot fail is
worse than no test*. The application was false: the test caught its defect. The developer
checked anyway and told me so; had they complied, real coverage would have been deleted **on
the authority of a principle that was itself sound**.

This is worse than an ordinary factual error because of where the reader's skepticism goes.
Faced with a fact, a competent reader checks the world. Faced with a principle they already
believe, they check the *principle* — find it true — and never test whether it **applies to
this instance**. The error rides in on the agreement.

Rules:

- **Never tell a leg to delete, weaken, or skip anything on the strength of a principle.**
  State the measurement that shows the principle applies here, or ask the leg to measure first.
- Phrase it as a question, not a verdict: *"I believe X is vacuous — measure it, and if it is
  not, say so."*
- If you cannot produce the measurement yourself, **say that you have not measured it**, and
  tag it `[BELIEVED]`. An untagged principle-plus-instruction is the highest-risk sentence a
  brief can contain.

## 3. Never put a HOST path in a brief (R14)

`scion start -w <subdir>` bind-mounts that subdir **at `/workspace`**. The leg's clone is at
`/workspace`. A host path in a brief sends the leg somewhere that does not exist, or worse,
somewhere that does.

**Required opening sentence of every brief:**

> Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
> the branch and commit match `<SHA>`. **Do NOT create any directory named in this brief.**

Always give the **SHA**. *The branch name is not an identifier.*

### 3a. The host path git writes for you (R14 was too narrow)

R14 said "not in a **brief**". That scoping was wrong, and it cost three legs their first
twenty minutes. **`git clone --shared` writes a host path into `.git/objects/info/alternates`**,
which does not resolve inside the leg's mount namespace — every object-touching git command
fails with `bad object HEAD`, and the leg cannot commit its project-log entry.

My pre-launch verification passed because **I ran it from the host, where the path resolves.**
A check run on the host cannot falsify a defect that exists only in the guest.

**Launch checklist for every clone handed to a leg:**

- [ ] cloned **without** `--shared`
- [ ] `test ! -f <clone>/.git/objects/info/alternates`
- [ ] `git -C <clone> fsck --connectivity-only` exits 0
- [ ] HEAD SHA matches the brief; tree clean; build assets / `node_modules` present

## 4. Structure: MUST / SHOULD, severity, and the reason for the severity

- **MUST** items block the round. **SHOULD** items are done if MUST lands cleanly.
- Give each blocking item a severity **and the reasoning**, so the leg does not relitigate it.
- **State when a severity depends on a load-bearing fact**, and require that fact to be pinned.
  If a rating rests on "the second layer still catches it", that second layer must be pinned in
  the same round, with a comment saying the rating depends on it. *Severity is not a scheduling
  lever — the instrument for "must not merge without this" is a **merge gate**, stated as one.*

## 5. Verification bars — restate them every time, they are not boilerplate

- A **negative claim** needs a positive control **drawn from a different axis than the one
  searched**. Same-axis controls are non-evidence.
- **If a check mirrors a function F, the oracle must BE F, never a reimplementation of F.**
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts BEFORE measuring**, and report the prediction alongside the result.
- **Exit codes come from the child process, never through a pipe.**
- **Compare SHAs, never counts.**
- **The harness must ABORT on a failed prerequisite**, not continue and report zero.
- State the **known-good baseline** (which failures are pre-existing, and their *messages* —
  same count with different messages is a new bug) and any **known flakes** with their rate.

### 5a. THE BASELINE IN THE BRIEF IS AN UNVERIFIED CLAIM LIKE ANY OTHER — a recorded near-miss

**This nearly cost us a Critical, and the only thing that stopped it was a leg refusing to
trust my table.** Recorded as a near-miss rather than softened into a correction, because it
nearly worked.

I gave three parallel review legs a baseline table containing `cd web && npm test` → **exit 0**,
tagged `[MEASURED by me at this commit in this exact clone]`. It was true. I had run it. The
command really did exit 0.

It exited 0 because that clone's `node_modules` was **polluted by an unsaved `npm install
jsdom`**. `jsdom`, `@types/jsdom` and `@types/node` are in neither `package.json` nor
`package-lock.json`. `tsconfig.json` includes `src`, so `tsc --noEmit` — the first half of
`npm run build` — compiles the test files and fails. Paired control in fresh clones, real
`npm ci`, exit codes from the child process:

| arm | `npm ci` | `tsc --noEmit` | `npm test` | `npm run build` |
|---|---|---|---|---|
| base | 0 | 0 | 0 | 0 |
| branch | 0 | **2** | **2** | not reached |

The branch broke `make web` and `make dashboard` on any clean checkout. **I measured
`npm test` and never ran `npm ci` or `npm run build`.**

**The second half is worse than the first.** The same brief said: *the Makefile is untouched, so
`npm test` is invoked by nothing.* That sentence is **true**. The inference I attached to it —
that the branch's frontend surface therefore had no blast radius on the build — is false, and
the code-review leg reported it **nearly made them scope the Critical out**. A correct fact
carrying a wrong inference, handed to three legs at once, is more dangerous than a wrong fact,
because the fact survives verification and the inference rides in behind it.

**Three rules follow.**

1. **A baseline is a claim, not a given. Re-measure the gates you are about to depend on**,
   even when the brief tags them `[MEASURED by me]`. The tag means the coordinator ran it in
   *their* tree, in *their* environment state, at some earlier time. It does not mean it is
   true in yours. Legs that re-measured the baseline this workstream have found it wrong
   repeatedly; legs that inherited it have inherited the error.
2. **Run the command the release path runs, not the command that is convenient.** `npm test`
   is not a proxy for `npm run build`. `make test` is not a proxy for `make web`. If a gate is
   cheap to widen — `npm ci` in a fresh clone rather than a warm tree — widen it, because the
   whole class of defects here lives in what the warm tree is hiding.
3. **Separate the observation from the inference, and tag them differently.** `[MEASURED]`
   currently launders both: it certifies that I ran something *and* smuggles in my reading of
   what it means. Write the observed exit code and the interpretation as two sentences, so a
   leg can accept the first and reject the second. Rules 15 and 17 govern relaying *other
   people's* measurements; nothing governed relaying **my own inference from a measurement I
   did make**, and that is exactly where every material brief error this round came from.

**Companion instance, same round, same shape.** Two decisions each correct on their own axis
composed into a hazard: a `web-test` Make target deliberately omitted `npm ci` so that `make
test` stays runnable without network — well reasoned, and *precisely* what would have hidden
the Critical above after a merge. **Green `make test` does not imply green `make web`.** When
two branches merge, say so in the merged branch's brief and require the verifier to run the
release target separately rather than treating the cheap target as a proxy for it.

## 6. Deliverables — name the artifact, always

Agents complete the cognitive work and then fail to write it down when the deliverable is
implicit. Every brief ends with an explicit, numbered list naming exact paths:

1. **Commits on `<branch>`.** Clear messages. **Never push.**
2. **A report at `<exact path>`** — with the required per-item structure spelled out.
3. **A project log entry** in `.design/project-log/`, **committed**. *(Always state this.
   Developers skip it unless told.)*
4. **An explicit list of every place this brief was wrong.** If nothing, say so and say what
   was checked.

Then the termination line, verbatim:

> **You MUST produce all four deliverables and then mark the task complete.**

Agents without explicit termination criteria stall after finishing their analysis.

## 7. Ordering hazards must be stated, not discovered

If a test contaminates global state with no clean undo (`DOMPurify.setConfig`, `addHook`),
say **which test must run last and why**. If a fix changes a signature that a supplied test
file depends on, say so. If one item's fix disarms another item's tripwire, say that too.

## 8. Scope batch operations with an explicit inclusion list

Never say "regenerate all modules". Name them. Some are hand-written and must be excluded.

## 9. Ask what the oracle can discriminate BEFORE asking what the search varies

**R16, demoted to second position** for exactly this reason. "What does this attempt list vary
and hold constant?" is the *second* question. The first is: **"what could this oracle possibly
report, and is the failure I care about inside that range?"** An oracle is a hypothesis about
what could go wrong; exhausting inputs against a narrow oracle stress-tests the hypothesis and
can never test whether the hypothesis is complete.

## 10. Record clean sweeps in the brief's expectations (rule 18)

When asking a leg to check something you expect to be clean, **say that you expect it to be
clean and that a clean result is a required reported outcome.** Otherwise only hits get
written down, the denominator evaporates, and every ledger built from the reports implies a
100% failure rate forever.

## 11. Resolve every citation against the tree before you write it

**Charged three consecutive rounds. It is here because knowing it did not stop it.**

Round 20's instance: I cited `passthrough_url_test.go:265-268` and `github/testing.go:39-41`.
Those files are **215** and **36** lines long. The statements I was pointing at were real —
at `:78` and `:30-32` — but the line ranges pointed past end-of-file. Earlier rounds: I
propagated `labels.go:393` (which is `StageLabelSwap`) where `labels.go:249`
(`MapLabelsToStage`) was meant, into **two briefs and a task**, and it was caught
independently by two legs.

- **Open the file. Read the line. Then write the citation.** A line number carried from a
  leg's report is a claim about a tree that may have moved under it.
- Same for **paths**. `web/src/components/ft-dependency-view.ts` does not exist; it is under
  `components/dependency/`.
- State in the brief: **"every path and line number here is unverified — resolve it yourself,
  and if it is wrong, that is item 1 on your numbered list."** This costs nothing and converts
  a silent misdirection into a reported error.

## 12. Never hand a leg a RED gate baseline without the failing test NAME

New in round 20, and it is the `web/dist` shape wearing different clothes.

I told legs `go test ./...` = **1**. It is **0** — the fix leg measured 0 three times plus
`-count=5`, and I then measured 0 myself. Nobody was harmed this time. The hazard is the
permission structure: **an expected-red gate invites a leg to file a real defect as
"pre-existing, matches baseline" and never read the message.**

- If a gate is red, give the **failing test name** and require a **name match**, never an
  exit-code match.
- If a gate is green, **say a red result is not expected** so a leg cannot silently reconcile
  one.
- If a flake is known, give its **rate and its sample size**, and say what re-run count is
  required before filing.

### 12a. Same exit code, different reason — the quiet failure

The loud failure self-announces. The quiet one does not. Measured, in-tree:

```
provisioned:  go build 0                     go vet 1, copylocks=4, web/dist msgs=0
rm web/dist:  go build 1 (embed error)       go vet 1, copylocks=0, web/dist msgs=1
```

A leg checking `go vet`'s **exit code** against a table saying "exit 1" records the row as
reproduced in both arms. A reviewer had to correct me on this after my *first* correction
described only the loud half.

**Prefer removing the trap to warning about it.** Provision the leg tree, write a prediction
file **before** provisioning, and include a **positive control** proving the provisioning is
load-bearing rather than decorative.

## 13. Ask an open question, or require the leg to say whether the answer is in your list

A brief item that names the answer gets the answer. Measured cost, recorded: a leading
question steered a round away from a Critical, and the leg that followed it correctly would
have approved.

- Prefer **"enumerate every path by which X reaches Y"** over **"check paths A, B and C."**
- If you must supply a list, require: **"state whether the answer is in this list, and what is
  outside it."**
- **Enumerate what survived; do not grep for what you expected.** A round here surfaced three
  URL carriers nobody had thought of by enumerating every attribute on rendered output rather
  than grepping for the expected ones.

## 14. Verification bars added since section 5

- **Non-vacuity requires a POSITIVE outcome** (rule 22′). A check that reddens when you break
  the code proves **the oracle can fire**. It says **nothing** about whether the input space
  reaches the defect. Require the leg to say which one it has.
- **The count-neutral corruption bar.** A pin that reddens when a count changes is not
  evidence of non-vacuity unless a corruption that holds that count **exactly fixed** and
  changes only identity is *also* red. This has now found real defects in **two consecutive
  rounds, inside fixes written to satisfy the brief that imposed it.**
- **An instrument cannot be checked through itself.** The strongest instance so far: a gate
  that reads an assertion **count** was structurally blind to a mutant that counted correctly
  and never threw. The receipt is downstream of the harness, so the receipt cannot falsify the
  harness. The fix is a checker **deliberately excluded from the instrument** — anything else
  hides the mutant inside the instrument. Cheap sibling instance the same round: a rule
  matching the substring `"base-dependent"` matched a note reading `"Not base-dependent."`
- **Overlapping oracle arms mask each other.** If you build a differential, **assert which arm
  fired.**
- **Say what a property sweep held FIXED**, not only how many cells it varied. A superset
  property confirms the **direction** of a widening and says nothing about whether the widening
  is **desirable**.
- **A confirmed lower bound is not a count.** Require the leg to say which it produced.
- **The `curl` / NUL hazard**: a shell pipeline carrying NUL bytes silently truncates, so a
  probe can report a clean short response for a dirty long one. Read the byte count.

## 15. Mark apparatus rows distinctly in any evidence table

A count is only as good as the population boundary of the table it came from.

An audit table here had six rows, four marked base-dependent — and **two of those four were
the auditor's own invented probes, not fixtures in the tree at all.** The table was internally
honest. The defect appeared at the **reading** boundary, when a downstream consumer (me) drew
a cardinality from it and relayed "four of the nine divergences." The fix leg could not
reproduce four under **any** definition it could construct.

- Any table mixing **the artefact under test** with **the investigator's own constructions**
  must mark which is which, in the row.
- Extends 2c: name the population **and** state whether every row is drawn from it.

## 16. Writing to my own state and tooling is governed by R14 too

Self-caught, in the same session I charged three legs with path errors: I appended a session
log to the **wrong workstream's state file** via a relative path. Two files named
`.eng-manager-state.md` exist; one is ~8900 lines, the other 66. It was caught only because
`wc -l` returned a number of the wrong magnitude.

- **Absolute path on every state-file write.**
- **Predict the resulting line count** and check it after.
- **Confirm the sibling file is unchanged** — line count *and* a `grep -c` for a token unique
  to what you just wrote.

## 17. A preferred remedy is a claim like any other

Do not write "the fix is to do X" unless X is measured. Recorded failures:

- I proposed a remedy that would have shipped an **inert control**.
- I proposed a fixture asserting the **opposite of measured truth**.
- I proposed "walk back accumulating brace depth" as *the* fix; it was **a third of the fix** —
  incomplete even for the half it addressed (a backward walk alone runs the block to EOF, so
  the defect returns through a *later* sibling), and bundled with a separate, more serious
  defect that brace depth does not touch.

Write remedies as **"one candidate, unmeasured"**, and require the leg to state whether it is
right *before* implementing it.

### 17a. This rule was written and then violated four times in the next brief

`dev-194-r11` charged nine errors. **Four of the nine were my remedies, not my facts** — and
this section already existed when I wrote that brief, so an admonition is demonstrably not
enough. The four, by sub-kind:

**Invented structure — I specified a shape the codebase does not have.**

- *"Assert `scopeRank(post) >= scopeRank(pre)` pointwise."* There is no total order on the
  scope vocabulary. `task:claim`, `task:accept`, `task:close` are independent grants with no
  implication table anywhere in the tree. Implementing this literally required **inventing a
  rank and then pinning the fix against my own invention**. Shipped instead as set
  containment, which needs no ordering and is strictly stronger — it forbids *swapping*
  `task:close` for `task:accept`, not merely dropping a charge.
- *"Floor the BEFORE endpoint, or charge `max(read, write)` — either is monotone by
  construction."* The first is **not**, measured: a wider AFTER predicate is fail-closed for
  *entering* a stage and **fail-open for leaving one**, because the price is a DIFFERENCE.
  The leg's verdict: *"the same premise-true / conclusion-false step it correctly diagnoses
  in B7.1."* I committed the exact non-sequitur I was asking the leg to hunt.

**True sentences that steer wrong — mode 3, and the more dangerous kind.**

- I named a single locus for a behaviour that lives in two places. *"Narrowing to that one
  function would have produced a fix that broke the superset invariant on 40 of 80 cells.
  This is the item where the brief's targeting could still have steered a leg wrong even
  though every sentence in it is true."*
- My table listed one row among "denials that should dissolve" which the governing ruling
  **requires charged**. *"A leg treating the table as a set of regressions to clear would
  have freed the one label the ruling most clearly says to charge, and the table would have
  gone green while doing it."*

**Therefore the rule is now mechanical, not attentional.** Before sending, extract every
imperative in the brief into a list and mark each one:

| kind | required treatment |
|---|---|
| a FACT I measured this session | `[MEASURED]`, with the command |
| a FACT I did not measure | `[UNVERIFIED]` **and state what would refute it**, not how sure I am |
| a REMEDY | `[ONE CANDIDATE, UNMEASURED]` + *"say whether this is right before implementing it"* |
| a STRUCTURE the remedy presumes (an ordering, a single locus, a closed set, a total order) | **name the presumption explicitly and ask the leg to falsify it first** |
| a TABLE of rows to clear | **state which rows must NOT clear, and why** — a table of regressions with no counter-row is an invitation to go green by deleting the property |

The last two rows are the new ones and they are where all four r11 errors landed. An
enumeration offered as a work list is read as a work list; if some member of it is a control
rather than a target, **saying so is not optional**.

## 18. Check the seam — standing, not incidental

Whenever two branches touch adjacent policy surfaces, **the seam between them is nobody's
assigned territory by construction** and no single leg can see it. Name it in both briefs.
Live instance: after two branches merge this codebase will hold **three** URL scheme policies
and the only in-tree statement of policy describes two.

Corollary: **a comment that is correct today and goes false on a scheduled event** is the worst
kind of false comment, because nothing fails when it turns.

## 19. The fenced-approval note travels WITH the adjudication

If a leg approves a diff while holding an open concern out of the diff's scope, that pairing
must be carried into the adjudication verbatim. It is not enough for the brief to have invited
it. An approval with a fence around it is not an approval of the fenced thing.

## 20. The dispatch message is part of the apparatus

**Two legs, two workstreams, one root cause, on the same day.**

- `audit-xss-r3` §0.0: my dispatch **named an item in prose**. The leg read it before the
  baseline block, because it was the message body. It disclosed the contamination and scored
  that finding as *steered* even though it argued it would have found it anyway.
- `dev-194-r11` error 8: my dispatch said *"read the brief in full before anything else"*
  while the brief said *"do not consult my item list until you have written the open pass
  down."* *"Those cannot both be obeyed. This is a defect in the INSTRUCTIONS, not in either
  document alone, and it degrades exactly the control the brief says it most wants."*

The second is worse: not contamination but a **direct contradiction**, where obeying me
required disobeying the brief and the leg had to choose which of my instructions to break.

**The principle.** An open pass measures what a leg finds *before* being steered. Its
apparatus is therefore **every byte the leg reads before §0** — not the document I happen to
think of as "the brief." I designed the blind and then, in a different file I did not think
of as part of the experiment, undid it. This is the actor/judge pattern again: nothing
structurally prevented me from editorialising in the envelope, so I did.

**The fix is a fixed template, because "remember not to editorialise" is the thing that
already failed.** A dispatch carries exactly four lines and nothing else:

```
Brief: <absolute path to the leg's brief file>
Read <baseline block filename> in that directory FIRST, in full, and do its §0 before
anything else. Your brief's item list comes after §0, and the brief says so.
Tree: <SHA>            (the SHA is the identifier; the branch name is not)
Report: <absolute path to write the report to>
```

Forbidden in a dispatch, without exception:

- naming any item, by letter or in prose
- saying which item I care most about, or that any item is "the one I most want answered"
- previewing a finding, a premise, or a number
- any instruction about reading order that is not the one line above — **the dispatch must
  never issue a reading instruction the brief can contradict**

If I want to tell a leg that an item matters most, that sentence goes **inside the item**,
below the §0 fence, where it is read only after the open pass is written down.

**Corollary for any two documents a leg must obey.** Before sending, read the dispatch and
the brief *together* and ask whether a leg could satisfy both. Two documents that are each
correct alone can be jointly unsatisfiable, and the leg pays for it — silently, if it does
not think to tell me which one it broke.

## 21. A worktree check cannot detect a probe cell that landed in a COMMIT

Standing deliverable on every leg: *"dirty cells at the end, with `git status --porcelain`
shown empty."* **That receipt is structurally blind to the failure it exists to catch.**

Measured instance, `dev-194-r11`. A differential was run by reverting production files
**in place**; `git commit` during that window picked the reverted files up along with the
test work. The leg then restored, checked `git status --porcelain`, and got **empty** — the
restore had already happened. *"The check looked at the worktree and the dirty cell was in
the commit. A restore that happens after the commit leaves no trace a status check can
find."* The commit was live-broken with the previous round's Critical, and only the new pin
written that same round caught it.

This is **an instrument cannot be checked through itself** in a new dress: `git status`
reads the WORKTREE, and a committed probe cell is a worktree-neutral corruption of the thing
it checks — exactly the shape of the count-pin and the assertion-receipt failures.

**Required in every brief that asks for a differential:**

1. Run differentials in a **separate worktree or clone**. The same leg's arm-table
   differential had no such problem *because that is what it did there*.
2. If a differential must run in place, **do not commit for its whole window.**
3. The dirty-cell deliverable is no longer `git status --porcelain` alone. It is that
   **plus** a per-file `git diff <last-known-good-commit> HEAD -- <every file the probe
   touched>`, with the output shown. Reviewers get the same instruction, and may verify it
   independently — I did, on r11: `bc93200` reverted three files at -41/-402/-242 and
   `93ae124` restored exactly +41/+402/+242, each byte-identical to `e993b4a`.

**And the merge-time consequence, which is mine and not the leg's:** a repaired branch still
has a live-broken commit *in its history*. Anything that bisects, cherry-picks, or builds an
intermediate commit hits it. Decide at merge whether that history is squashed, and say so —
do not discover it later.

---

# Part II — the ones that are not checklist items

**Do not read this section as a checklist.** These are failures of judgement, not of
procedure, and every one of them survived a correctly-followed checklist. They are here
separately so they do not get skimmed as items.

## The brief's three failure modes

**Mode 1 — a real input with a wrong expected result.** I have shipped a suggested fixture
asserting the opposite of measured truth, and asked for an end-to-end pin on a path where the
observable is **structurally absent** — so the assertion would have passed for the wrong
reason, on a branch whose signature failure is passing for the wrong reason.

**Mode 2 — stating the shape, count, or locus of a causal set I have not measured.** "The gate
is at `server.go:840-860`" would have scoped a whole round to one of **three** gates. "Four of
the nine divergences" was unreproducible under every definition. **Make measuring the set
deliverable 1**, and say the count is a hypothesis with a number attached.

**Mode 3 — my targeting steers the round away from the defect, and a leg that checks only what
I asked APPROVES.** The worst of the three, because it is invisible from inside a leg doing its
job well. Two independent legs charged me with it in the same round; one wrote: *"If I had
predicted only what the brief asked me to check, I would have gone 3-for-3 and approved the
change."*

Mitigation currently **under test, not adopted**: frame every checklist as **second**, after an
open unscoped "what does this diff put at risk" pass, and require each finding to be attributed
OPEN PASS / ITEM LIST / BOTH. Pre-registered null result: everything lands on ITEM LIST or BOTH,
and the practice is retired rather than explained away. Known weakness: attribution is
self-reported and can drift toward whichever answer is more interesting.

## Interpretation bias: the answer gets selected before anything is stated

The hardest failure recorded here. I read a ruling, concluded the implementation had overreached
and the bound was intact, and was **wrong** — on re-reading, the implementation was faithful and
the *ruling* produced the denial. The verdict on it:

> *"That's not 'I forgot to verify' — it's 'I verified, and the verification was quietly steered
> by wanting a particular answer.'"*

There is no mechanical fix, because the failure is not in what gets stated but in **which of
several true-seeming interpretations gets selected before anything is stated**. Naming it
precisely when it happens is most of the available value.

Partial structural defence: **a narrowing that blinkers one leg is unlikely to blinker all three
the same way.** Independence is the instrument here, which is why shared briefs are forbidden
(§1) and why self-review is forbidden absolutely.

## Route the judgement elsewhere wherever you are both actor and judge

Coordinator, verbatim, and it generalises past capacity planning:

> *"anywhere you're both the actor and the judge of whether the actor did the right thing is a
> place to route the judgment elsewhere on principle, not just when you happen to remember to."*

Concretely, on this workstream: "am I still reading carefully enough to keep launching legs" is
a question where the convenient answer and the correct answer diverge, and it must be asked
outward — with the arithmetic stated, not the conclusion.

## A correction is a claim, and it can install a bias in the opposite direction

- **Verify the charge; do not just patch the cited instance.** A correction inherits no
  privilege from being a correction.
- **My correction of my own `web/dist` error was itself wrong** — it described the loud failure
  and missed the quiet one, and a leg had to correct the correction.
- A correction can install a **new systematic bias, wrong in the opposite direction**, and its
  cost is a **false negative** — which is the expensive direction, because nothing announces it.

## Silent coverage loss is a third axis

Alongside false positive and false negative: **a correctly-declined non-answer never collides
with anything.** A guard that stops being run, a test file that stops being discovered, a
migration that drops assertions — none of these turn anything red. Ask for **before-and-after
counts across a refactor**, not just a green suite.

## Delivery is not consumption

A check can pin **delivery** without pinning **consumption**. A leg can build a perfect guard
on a branch where nothing invokes it and have done everything right and shipped nothing. This
project has a live instance: an XSS chokepoint scanner that was itself a guard nothing ran.
**"What command, that someone or something actually executes, causes this to be evaluated?"** is
a coordinator-level question — see the report-back checklist.

---

## Checklist before sending any brief

- [ ] Every factual claim tagged `[MEASURED]` / `[MEASURED-BY-x]` / `[BELIEVED]` / `[CARRIED]`
- [ ] No host paths; the leg's clone is `/workspace`
- [ ] Base SHA and branch name stated — **and the SHA is the identifier, not the branch**
- [ ] Known-good baseline stated, including failure *messages* and known flake *rates*
- [ ] Each blocking item: severity **+ reasoning**; merge gates stated as merge gates
- [ ] Ordering hazards named
- [ ] Verification bars restated
- [ ] Deliverables enumerated with exact paths, incl. the **project log entry**
- [ ] Termination line present, verbatim
- [ ] "Report every place this brief was wrong" present as a **deliverable**
- [ ] **For review rounds: is this brief materially different from the other two?**
- [ ] **Every count states its POPULATION as a noun phrase** (2c), and says whether members were
      inspected or merely counted
- [ ] **For review rounds: escalation questions scoped to FOLLOW-ON work only** (1a) — no leg is
      positioned to cancel a parallel leg
- [ ] **Every path and line number opened and read in the tree** (11), and the brief says they
      are unverified anyway
- [ ] **No red gate without a failing test NAME**; green gates say "a red result is not
      expected" (12)
- [ ] **Leg tree provisioned**, with a prediction file written *before* provisioning and a
      positive control proving the provisioning is load-bearing (12a)
- [ ] **Items phrased as open questions**, or requiring the leg to say what is outside my list (13)
- [ ] **Count-neutral bar and the positive-outcome non-vacuity bar restated** (14)
- [ ] **Any relayed count checked against its source table's population boundary** (15)
- [ ] **Remedies marked "one candidate, unmeasured"** and gated on the leg confirming them (17)
- [ ] **Seam named** if any adjacent branch touches the same policy surface (18)

## Checklist when a leg REPORTS BACK (not when briefing)

These are the coordinator's own checks, and they exist because **no leg can perform them.**

- [ ] **Every new test artifact: name the invoked path that actually runs it** (rule 25). Not
      "is there a test" and not "does it pass" — *what command, that someone or something
      actually executes, causes this file to be evaluated?* Answering needs the state of build
      tooling **across branches**, which only the coordinator has. A leg that builds a perfect
      guard on a branch where nothing invokes it has done everything right and shipped nothing.
- [ ] **Any count in the report: is it the count that matters, or a correct count of the wrong
      population?** (form (10))
- [ ] **Cross-tree properties have no owner unless assigned.** When work is split across trees,
      list what spans them — build tooling, shared test entry points, generated code,
      lockfiles — and assign each explicitly.

---

## §22 — Identity, not count, is what makes a result RE-AUDITABLE

Adopted 2026-07-28, from a null result that would have been an archaeology
project without it.

The count-neutral rule (§?) says a gate reading a COUNT is blind to a
count-neutral corruption. This is the same shape one level out, applied to the
**audit trail** instead of to a gate:

> **A record that stores a COUNT cannot be re-examined when you later learn
> something new about the population it summarised. A record that stores
> IDENTITIES can.**

### Why it resolves this way every time — identity is LOSSLESS with respect to count

The coordinator's formulation, which is sharper than the one above and is the
version that should travel outside this project:

> **Identity is lossless with respect to count.** You can always recover "how
> many" from a set of names. You can *never* recover the names from a bare
> number, and a summary that has already thrown the names away cannot un-throw
> them no matter what you learn afterward.
>
> So: when you do not know in advance whether a record will need to survive a
> change in assumptions — **which is always, since you cannot know what you will
> learn later** — record the identity. Identity produces a count on demand;
> a count can never produce an identity back.

That asymmetry is why this principle keeps arriving from different directions
and always resolves the same way. A mutation-kill record, a fixture-table
anti-vacuity floor, and a historical audit trail are three different objects,
but in every case **the count was a lossy compression of exactly the thing that
would have let you re-ask the question**, and the name was not.

### The worked example

`TestWatchTasks` was characterised late as a *family of five* tests flaking at
4.5%, not one test at 8%. That retroactively put every mutation matrix in the
project under suspicion: a spurious RED reads as "mutant killed", so the bias is
toward **over-crediting** the suite — failure disguised as success.

The question "was a flaky test ever the expected killer in an accepted probe?"
was answerable in ten minutes, and the answer was a clean no. **The only reason
it was answerable at all is that an unrelated rule — "read failing test NAMES,
never counts" — was already in force.** That rule had been adopted because a
`grep -c` reported 3 when the truth was 1. It paid a second time, years-of-
process later in miniature, for a purpose nobody designed it for.

Where the legs recorded `RED 10 (+1 flake)` **and named the flake**, the row
survives re-audit. Where a row records only `RED 10`, it does not — and that is
precisely the boundary at which the retroactive answer had to become a
judgement instead of a measurement.

### The rule

- **Record what failed, not how many things failed.** A mutation table's killer
  column takes names. A gate's output takes the identity of what tripped it.
- **When you summarise, keep the identities somewhere.** A count in the table
  and names in the prose is acceptable; a count alone is a result with a
  shelf-life.
- **Ask of any record you write: if I later learn this population had a
  contaminant in it, can I tell whether this row was affected?** If the answer
  is no, you have written a number that will have to be re-measured rather than
  re-read.

### Corollary — a rule can pay out for a reason it was not written for

Do not judge a discipline only against the failure that prompted it. Two of this
project's rules have now caught something outside their original purpose. That
is an argument for keeping rules mechanical and cheap rather than narrowly
targeted at the incident that produced them.

---

## §23 — A tool's self-report is a leg's self-approval, one layer down

Coordinator's framing, adopted verbatim because it is sharper than mine:

> "trust the tool's own success message" and "trust a leg's own approval" are
> the same failure at different layers, and the fix is identical — **an
> independently predicted number that the tool's self-report has to agree
> with**, not just report against itself.

### The worked example, which is mine and was nearly expensive

A loop preserving 22 git refs printed `preserved: <clone> :: <branch>` twenty-two
times and **fetched nothing.** Two independent defects in one line:

1. zsh applied its `:r` history modifier to `"refs/heads/$b:refs/preserve/..."`,
   silently mangling every refspec. (Use `${b}:` — braces.)
2. **The status line printed unconditionally, outside any exit-code test.**

The next step re-ran the orphan scan and the preserve count was still 63 when it
should have been 85. **A number predicted in advance is the only thing that
caught it.** Had the preserve step been trusted on its own output, the deletion
that followed would have destroyed 19 project-log commits including the current
round's 451-line log and the exact commit the next round was about to be briefed
against.

### The rule

- **A success message must be downstream of the exit code.** If it can print
  when the command failed, it is decoration.
- **Verify a step by re-running the CHECK, not by reading the step's own
  output.** Preserve, then re-scan. Fix, then re-measure.
- **Predict the number before you look.** "It should be 85" is worth more than
  any amount of reading the log afterwards, because it is falsifiable in one
  glance and it does not depend on you being alert.
- This applies to **my own tooling at the same bar I impose on legs.** The
  incident above happened in the same session in which I charged three separate
  legs with unverified citations.

### And the operational corollary

When a tool's measured behaviour diverges from its own documentation, you do not
need to understand *why* to know that your prior model of it is no longer a safe
basis for skipping a safety step. `scion delete` claims to remove "associated
files and worktrees"; 26 deletions later the clone count had not moved. That is
uncharacterised, it is not filed as a defect yet — **an uncharacterised surprise
is not a bug report** — and the conclusion is simply: preserve first regardless.

---

## §24 — Referencing an external policy you do not own

Adopted 2026-07-28, from the #18 rescoping. Applies whenever a deliverable's
correctness is defined by conformance to something outside the repository —
another product's sanitizer, a spec, an upstream default, a vendor's hardening
guide.

### The trap

"Our allow-list matches GitHub's comment-rendering policy" is **true when
written and silently false the moment the other party ships a change**, with
nothing in our tree positioned to notice. Nobody introduces the defect; it
arrives on a schedule we do not control.

The coordinator's classification, which is the right one: this is **form (7) —
a comment documenting a measurement as a property — waiting to happen.** The
measurement was real on the day. The sentence asserts a standing property. The
gap between them opens by itself.

It is also the **mirror of form (11)**. Form 11 is *our* artefact moving after
*our* check looked at it. This is the reference standard moving while our copy
stands still. Same failure, opposite side of the boundary.

### The rule

- **Pin a dated, versioned SNAPSHOT with provenance.** What the external policy
  *was*, when it was measured, and how it was determined.
- **State it as a snapshot in the artefact itself.** "Derived from GitHub's
  comment sanitizer as observed on <date>, via <method>" — not "matches
  GitHub's policy."
- **Never write a sentence claiming ongoing equivalence.** That is the one
  formulation guaranteed to become false without anyone touching the file.
- Cheap at authoring time; **genuinely impossible to retrofit** once the wrong
  kind of comment has existed and been believed for a while, because by then
  nobody knows which parts were ever checked.

### The second half — a posture is not separable into copyable components

"Vendor X proved this safe at scale" is a claim about **X's whole posture**, not
about the one component you intend to copy.

> If any part of what their sanitizer lets through is only safe because their
> CSP catches what leaks past it, copying the allow-list alone does not copy the
> safety — **it copies the exposure and leaves the backstop with them.**

So before adopting an external policy component, **establish what that component
was leaning on**, and check whether you have those things. In the #18 case the
answer is measurably no: Farm Table has no CSP at all on an origin holding a
long-lived API token (#85), which is precisely the condition under which a
*widened* allow-list is riskiest rather than safest.

**Do not assert the dependency as fact before measuring it** — that is the
single-cause error (#127) in a new costume. **Do refuse to scope the round as
though separability were a given.** If the research shows the tolerance does not
depend on the missing control, proceed independently. If it does, the missing
control becomes a prerequisite and the sequencing changes — and that is worth
knowing *before* implementation, not after.

## §25 — A control that shares a dependency with its subject is a MIRROR, not a control

Coordinator's framing, adopted verbatim as the statement of the root:

> A pre-registered number only tests anything if it is derived **independently**
> of the thing it checks — otherwise it is a mirror, not a control.

This is the PARENT PRINCIPLE (*nothing downstream of X can falsify X*) applied to
the **apparatus** rather than to the artefact. An expectation and an observation
that descend from the same upstream mistake will **agree**, and their agreement
carries **no information**. Note carefully what this is *not*: it is not a false
green. Every individual number is TRUE. The failure is that the comparison
between them was never capable of coming out any other way.

Two worked examples, both mine, both from the crash-recovery night of 2026-07-28,
**ten minutes apart**. Filed as ONE finding with two instances, on the
coordinator's ruling, because the root is identical.

### Worked example A — the laundered number (nearly the expensive one)

I surveyed the interrupted `dev-xss-r4` tree and reported *"641 insertions / 103
deletions across 7 files."* That conflated two measurements: 641/103 is the
`git diff --stat` of the **six tracked-modified files**; the **581-line untracked
`remotedata_depth_test.go` was not in it at all.**

The coordinator quoted 641 back to me. It then went to ptone in that form. **By
the time I ran the preservation, the wrong number had been laundered through two
independent-looking sources and would have read as corroborated.**

Had I pre-registered 641 and observed 641, I would have preserved the snapshot
**minus the single most valuable artefact in it** — a 581-line, 9-test-function
file that exists nowhere else — and reported PASS with a straight face.

**What actually saved it** is worth stating precisely, because it is the
transferable part: when writing the pre-registration I **re-measured from the
artefact** instead of copying my own reported figure. Re-measuring produced 641
tracked **plus** 581 untracked, and the act of composing them is what surfaced
the conflation. The correct expectation, 7 files / 1222 / 103, was registered
*before* the run — so a result of 641 would have read as *"the untracked file did
not make it in"* rather than as a pass.

### Worked example B — the negative control that was not disjoint

Ten minutes later, verifying that `git cat-file -t` could still return ABSENT, I
predicted `158c8ae` would be absent from canonical. It returned `commit`.

Not a preservation failure. `158c8ae` is an **ancestor of `label-write-scope-r11`,
17 commits back**, and fetching a branch fetches its ancestry. My control was
drawn from a *different agent* and I had silently read that as *different
history*. In this repo, where every workstream branch descends from one `main`,
**"different agent" almost never means "different lineage" — it usually means the
opposite.**

The valid control was `0b52dcd` (`markdown-sanitize-r10`), confirmed a
non-ancestor, which correctly returned ABSENT.

### The rule

1. **A pre-registered expectation must be RE-DERIVED from the artefact, never
   copied from a prior report — including my own, and especially one that has
   already been relayed and echoed back.** An echoed number is the *most*
   dangerous input available, because circulation looks like corroboration.
2. **Prefer a different measurement ROUTE for the expectation than the one the
   check will use.** In example A the expectation was a *composition of two
   measurements* (tracked diff + untracked line count) while the observation was
   a *single diff against a snapshot tree*. Different routes is why they could
   disagree.
3. **Select a negative control by proving disjointness, not by assuming it.**
   For git, run `git merge-base --is-ancestor` **when choosing the control**, not
   when explaining the surprise afterwards.
4. **State the residual shared dependency.** Independence is almost never total —
   say how far it goes.

### The honest bound on example A (do not overclaim the save)

My expectation and my observation still shared **one** dependency: both used
git's own diff machinery against the same working tree. Had the *working tree*
been corrupted, both would have agreed and I would have learned nothing. What I
achieved was independence **from my own reporting error** — which is precisely
the error that was live — and **not** independence from the tree. That is a real
result with a real limit, and the limit belongs in the record next to it (§17a).

### §25, third surface — THE ARCHIVE. Circulation launders through the WRITTEN RECORD too.

Coordinator's extension, adopted. §25 above treats laundering as something that
happens to a number moving between agents *in a conversation*. The same mechanism
runs through the **durable record**, on a much longer delay, and it produced a
live failure on 2026-07-28 independent of the 641 one.

The coordinator's state log said #194 r11 was **"queued."** That was their summary
of my status, written ambiguously between the r11 FIX leg and the r11 REVIEW
round. Four hours later a coordinator session with **zero memory of writing it**
read it and triaged off it as fact. Six landed commits said otherwise. The log had
manufactured **apparent corroboration for a false claim, and the "second source"
was the writer's own earlier self.**

**The rule (coordinator's, adopted):** when a number or a state claim goes into a
durable record, **record its PROVENANCE alongside it** — who measured it, by what
route, and whether the writer *observed* it or *was told* it.

> `dev-194-r11 queued`
> `dev-194-r11 reported queued by EM at 11:29, not independently checked`

Same claim. Completely different re-auditability. This is the identity-versus-count
principle (§22) one level up: **a bare value cannot regenerate its own provenance
any more than a count can regenerate its names**, and a record that discarded
provenance cannot recover it no matter what is learned later.

#### Sharpening 1 — the failure is not "cannot re-derive", it is "cannot tell you to"

The coordinator wrote that a recorded number *cannot* be re-derived later because
the measurement context is gone. Slightly too strong, and the correction matters
for the remedy: tonight it **was** re-derived — I checked the worktree and found
six commits. The reader *can* re-derive when the referent survives.

The actual defect is that **a bare claim gives the reader no signal that
re-derivation is needed.** Provenance does not only *enable* re-audit; it **prices**
it. "Not independently checked" tells you what trusting it costs. "queued" tells
you nothing, so a reader under time pressure defaults to trust.

So the remedy is *not* "make every record re-derivable" — impossible. It is
**make every record self-declaring about its own epistemic status.**

#### Sharpening 2 — two classes, and the dangerous one is not the one that bit us

- **Class A — a surviving referent.** Branch state, file contents, commit
  presence. Re-derivable; provenance's job is to tell you to bother. Tonight's
  failure was Class A, which is why the filesystem could rescue it.
- **Class B — no surviving referent.** A flake rate, a mutation-table row, a gate
  baseline, a timing. The measurement context is **genuinely gone** and no later
  session can reconstruct it. Provenance is the *only* thing that makes the claim
  assessable at all.

**This project is saturated with Class B claims** — flake rates, mutation tables,
gate baselines — and they are exactly the ones propagated from brief to brief.
Class B is where this rule is load-bearing, and it had no rescue available.

#### My own record, measured rather than asserted

`.eng-manager-state.md`, 10362 lines: **175 section headings, 30 carrying any
provenance word. 128 bare state claims** (QUEUED / RUNNING / LANDED / STALLED /
complete). And the diagnostic result:

> **`not independently checked` — ZERO occurrences. Ever.**

My provenance discipline is **bimodal**. I mark what I measured (`[MEASURED]`, 15)
and I mark what I know is unsupported (`UNVERIFIED`, 16). I have **no marker at
all** for the largest and most dangerous class in between: *relayed to me, plausible,
never checked.* That class currently reads as observation, which is precisely the
condition that produced the coordinator's failure.

#### Corollary — STRUCTURE is provenance's delivery mechanism (form 12 again)

Provenance recorded where nobody reads it is DELIVERY without CONSUMPTION.

Measured on my own file: a fresh session following my own standing instruction —
*"read the LAST section first, never whole"* — sees **61 of 10362 lines, 0.6%**.
Every operational trap sits buried chronologically: the zsh `:r` refspec hazard at
line 1668 (and eight other scattered spellings), the `web/dist` quiet trap at 58
and a dozen more, and tonight's *"launch is two commands and a look, never one"* at
10114 — already unreachable.

**The instruction written to manage context size is the instruction that guarantees
trap repetition.** The coordinator hit exactly this, repeating a documented `scion`
failure from 03:1x at 22:4x.

**Therefore:** an append-only chronological log needs a **durable non-chronological
head** — standing gotchas and invariants, edited in place, read first, never
appended past. Chronology is for the narrative; traps must not live in it.

#### Addition 1 (coordinator) — the missing middle marker was STRUCTURALLY GUARANTEED

I found `[MEASURED]` 15, `UNVERIFIED` 16, `not independently checked` **zero**, and
called it my weakest area. The coordinator's diagnosis is better and I am adopting
it over my own:

> That gap was guaranteed by the **trigger** you are marking on. You reach for
> UNVERIFIED when you **feel doubt**. The relayed-but-unchecked class is
> definitionally the class where you feel **no** doubt — because you trust the
> source, which is *why* you did not check it.

So a **doubt-triggered marker will always have exactly this hole**, and adding a
third label without changing the trigger will not close it. Bimodality is not a
discipline failure; it is **what happens when the marking rule samples the wrong
variable.**

**The trigger must be SOURCE-BASED, not confidence-based:**

> *"Did I run a command that produced this, or was I told it?"*

Mechanical, always answerable, available at write time. `"How sure am I?"` is a
judgement that **fails precisely when the source is credible** — i.e. exactly when
the stakes of being wrong are highest.

#### Addition 2 (coordinator) — Class A is only safe for IMMUTABLE referents

Class A assumes the referent survives. It **also silently assumes the referent does
not MOVE.** A commit SHA is immutable. A branch name, `HEAD`, "the worktree",
"current main" are **not**.

Had the coordinator's log said *"r11 is at HEAD"* instead of naming `2cbbd92`,
tonight's re-derivation would have returned **a different true answer**, with no
way to tell whether the record was wrong or the world had moved. That is **form
(11)** — the reference moving while our copy stands still — now on the archive's
**re-derivation path**.

> **Durable records name IMMUTABLE referents. SHA not branch. Exact path not "the
> tree". A count together with the names that produced it.**

**A mutable referent silently converts Class A into Class B**, without announcing
it — and Class B is the class with no rescue. This is identity-versus-count (§22)
for the third time.

#### Addition 3 (coordinator) — the durable head has an EVICTION problem

The 0.6%-readership fix is itself vulnerable to the thing it fixes. A head edited
in place **accretes**: every trap that costs once earns a line, nothing ever
leaves, and in a month it is 400 lines and gets skimmed — **rebuilding the
unread-archive problem one level up, inside the fix for it.**

A head needs an **eviction rule, not just an admission rule**:

- **ENTERS** when a hazard has cost us at least once.
- **LEAVES** when the hazard is **structurally eliminated** — tooling fixed,
  command wrapped, check automated — **not** when it is merely well known.
- **An entry that can only be honoured by remembering to be careful is a PERMANENT
  RESIDENT, and a permanent resident is a STANDING BUG, not a standing note.**

This gives the head a natural pressure toward shrinking, because **the only way to
evict an entry is to fix the thing.** Set the review trigger while the head is
small and the discipline is free.

**Measured on first application (2026-07-28) — and note how this number arrived:**

I first wrote *"of 16 head entries, 14 are permanent residents"* **before counting
them.** Then I counted. The real figures:

- **19** entries.
- **3** are true permanent residents — `EVICT-WHEN: never`, pure judgement, no
  mechanical enforcement possible (re-derive-don't-copy; name immutable referents;
  provenance tagging).
- **15** have a **defined structural fix that does not yet exist** — a wrapper, a
  runner, a script, a hook, a hoisted ref.
- **1** is orientation rather than a hazard.

So **18 of 19 are, today, honoured only by remembering** — but only 3 must stay
that way. **The head is a deferred-work list wearing a notes file's clothing: 15
items of unbuilt tooling.** Reading it that way is the whole value of the eviction
rule.

**And the provenance of the wrong number matters more than the number.** Writing
"16/14" before counting is **rule 1 of this very section, violated inside the
paragraph documenting it**, ten minutes after violating it with 641. That is not
irony, it is evidence: **§25 rule 1 is a permanent resident.** A rule against
asserting-before-measuring cannot be enforced by a rule against
asserting-before-measuring. Until something mechanical checks it, expect this
error at roughly the rate observed — twice in one hour, by the person who wrote
the rule.

## §26 — A MEASURED FIELD IS PASTED FROM THE OUTPUT OF A COMMAND, WITH THE COMMAND SHOWN. IF THERE IS NO COMMAND THERE IS NO RECEIPT.

**Coordinator's rule, 2026-07-29 07:57Z. Binding. It replaces my proposal, which he
shot down three times and was right to.**

### The class it closes

**A RECEIPT COMPOSED BEFORE THE EVENT IS A PREDICTION WEARING A MEASUREMENT'S
FORMAT.** Self-reported at full strength by `dev-xss-r6`: a compile-receipt whose
mtime field was written *from expectation* — twice in one round. Once is a slip.
Twice is a changed order of operations.

This is the fourth time in one night that **the correctness of a practice carried
the defect**. The receipt format is good. Filling it in advance is what the format
invites, because a template with a blank is a question, and a question gets
answered from whatever is nearest — and what is nearest is what you expect.

### The rule, operationally

For every field in every artefact that claims to be a measurement:

1. **Run the command.**
2. **Paste its output.**
3. **Show the command that produced it, verbatim, in the same block.**

A field with no command beside it is **not a measurement**. Do not read it as one,
do not cite it, do not let it into a table. It is a prediction, and it may be right,
and that is not the same thing.

### Why the three obvious fixes are worse — recorded so nobody re-proposes them

My proposal was: write the receipt in two edits, leave measured fields *absent*
rather than blank until measured, and require a judgement that the second edit
follow the event. Each clause failed:

- **It is a judgement rule with no trigger.** Nothing goes red. It joins the 18-of-19
  honoured only by remembering.
- **Two edits are indistinguishable from one unless the separation is observable.**
  *"THE PROPERTY YOU WANT IS NOT TWO EDITS, IT IS AN ORDERING SOMEONE ELSE CAN
  VERIFY."* A discipline nobody can check is a discipline nobody has.
- **Absent-vs-blank is a trade, not an improvement**, and I made the weakest half the
  mechanism. *"You have swapped a field that can be filled wrongly for a field whose
  absence nobody notices."*

The command clause beats all three because **it removes the occasion instead of
fighting the inclination**. You cannot paste output you do not have. The ordering
becomes observable *in the artefact itself*, by anyone, later, without trusting the
author — which was the property I actually wanted and had mis-specified as "two
edits."

**Retain the two-write ordering as rationale. Ship the command clause as the rule.**

### Corollary, from the same exchange — FOUR integers for any re-verification sweep

When re-checking claimed measurements against reality, three integers are not
enough, because **a rebuild overwrites the evidence and a deleted artefact produces
nothing**:

**CHECKED = MATCHED + MISMATCHED + UNCHECKABLE**

and **say what put each row in the third bucket**. An UNCHECKABLE row is a result.
Folding it into either of the other two is a lie in a known direction.

## §27 — ASK WHICH NOUN BEFORE ASKING WHO ERRED; AND A MECHANISM SHIPS WITH ITS POPULATION

Two rules from the same exchange, 2026-07-29 08:13Z. Both are coordinator-issued, both
have measured base rates, and both correct a reflex rather than a gap.

### 27a. WHEN TWO MEASUREMENTS OF ONE HOST DISAGREE, THE PRIOR IS NOT THAT ONE IS WRONG

**IT IS THAT THEY ARE COUNTING DIFFERENT THINGS. ASK WHICH NOUN BEFORE ASKING WHO ERRED.**

**Four apparent numeric disagreements tonight. Four dissolved into two nouns. Not one was
somebody being wrong.** 11 vs 12; 103 vs 108; 348 vs its own denominator; and 229 vs 112
vs 109 — which resolved as `229 working trees = 112 own-store + 117 linked worktrees`, and
`109 independent object stores = 112 − 3 alternates-borrowers`, matching two other legs
exactly.

**The default reflex is to treat a delta as a defect and go hunting for the error.** That
reflex has now fired several times tonight, including from the coordinator three times,
and **it has been wrong every time.** Hunting for an error in a noun mismatch also costs
you the reconciliation, which is the actually useful artefact.

**Corollary — A NUMBER IS MOST DANGEROUS WHEN IT IS RIGHT.** Being correct for its own
question is the precondition for being borrowed into a question where it is wrong. `229`
was the right noun for *"has the unanchored ignore rule eaten anything"* — a working-tree
question — which is exactly why it was liable to be cited near a durability number. Put
the do-not-cite warning **at the head of the section, not in a footnote.**

### 27b. A MECHANISM WITHOUT ITS POPULATION IS FILED AS SOMEBODY ELSE'S PROBLEM

**THE COUNT IS WHAT MOVES A CAUTION FROM THE GENERAL CASE INTO THE READER'S OWN.**

This strictly strengthens the rule that a finding travels with its verification recipe. It
now travels with **the recipe AND the count of who is currently in its blast radius**, or
it does not travel.

Measured instance: I received a correct, well-argued mechanism about an instrument that
lies in fresh clones. I was about to file it as a morning-verifier problem. I only did not
because I went and counted the population — **90 of 229 trees in the lying state, and all
three of my own live legs among them.** The mechanism alone would have been shelved. The
count made it mine.

**Every rule shipped in a packet gets a population attached before it goes out.** Rules
already broadcast as bare mechanisms need revisiting.

### 27c. The unflattering propagation fact, recorded because it is true

**THE WILLINGNESS TO SPEND EFFORT ON A WARNING IS A FUNCTION OF THE WARNER'S LAST RESULT,
NOT OF THE WARNING.**

I ran the population count above only because the sender had just been right about
something adjacent. The warning's own merit did not determine whether it was acted on.
This is how the apparatus actually propagates, it is not how anyone would design it, and
pretending otherwise would make every "we notified them" claim in our record softer than
it looks.

---

## §28 — A BRIEF MAY NOT CONTAIN A NUMBER WITHOUT THE COMMAND THAT PRODUCED IT

§26 says a measured field is pasted from the output of a command, with the command shown.
**I then violated §26 inside the brief that promulgated it**, and the leg I violated it
against found it. This section is the enforcement point §26 lacked.

### THE INSTANCE, WITH ALL THREE MEASUREMENTS, BECAUSE THE SPREAD IS THE FINDING

`briefs/hedge-sweep.md:101-113` offered a leg a "starting point": a closure-vocabulary
population and a per-file density list. Numbers as published, versus two independent
re-runs of the vocabulary **exactly as printed in the same brief**:

| field | I published | hedge-sweep measured | I re-measured |
|---|---|---|---|
| closure-vocabulary lines | **1049** | 615 | 505 |
| files | **201** | 176 | 161 |
| "the sharpest cell" (closure ∩ conservative-bound) | **12** | 1 (its own report) | **0** |
| `reports/preserve-bundle.md` density | 29 | 39 | 30 |
| `reports/test-xss-r4.md` density | 19 | 12 | 12 |

Command, pasted, which is the thing that was missing the first time:

```
V='ruled out|no carrier|cannot be reached|unreachable|zero hits|no readers|no consumers|refuted|falsified|nothing reads|nothing writes'
grep -rEn --include='*.md' "$V" reports/ briefs/
```

**MY 1049 IS UNREPRODUCIBLE BY TWO INDEPENDENT INSTRUMENTS AND I CANNOT NOW SAY WHAT
PRODUCED IT.** That is the whole indictment and it does not depend on resolving 615 vs 505.

### DO NOT RESOLVE 615 vs 505 BY DECIDING WHO ERRED

Per §27a. The two runs cannot both be measuring the same set — a static file cannot
shrink, and mine is the *smaller* number taken *later*, so drift cannot explain it either.
That is a population difference wearing an accuracy difference's clothing. It is logged
open. **It is not evidence that hedge-sweep was wrong, and I am recording that explicitly
because the tempting reading is the one that exonerates me.**

### WHY THIS IS WORSE THAN AN ORDINARY WRONG NUMBER

The 12-line cell was not decoration. It was labelled **"which I believe is the sharpest
cell"** and offered as where to begin. The cell is empty. A leg that accepted the offer
would have spent its run reconstructing a population that does not exist, and would have
reported thin results as a property of the corpus rather than of my arithmetic.

> **SCAFFOLDING IS NOT NEUTRAL. A FALSE NUMBER IN A BRIEF DOES NOT MERELY FAIL TO HELP —
> IT SPENDS THE LEG'S RUN, AND IT SPENDS IT ON THE ONE PATH THE LEG WAS TOLD WAS BEST.**

This is the twin of the class filed in my name at 08:09Z. There, an invitation to refute
plus a false obvious-refutation manufactured a confident wrong correction. Here, an
invitation to *begin* plus a false starting cell manufactures a confident wrong absence.
**Both defects live in the helpful part of the brief.**

### THE RULE

1. **No numeric field in any brief I write unless the command that produced it appears
   adjacent to it.** Not in a report it cites — adjacent, in the brief, runnable.
2. **A number offered as a starting point carries a re-run instruction**: "re-run this
   before you rely on it; if your figure differs from mine, mine is the suspect one."
3. **Prose framing and numeric framing get different trust.** The leg's own calibration,
   which I am adopting verbatim because it is better evidence about me than my own view:
   *"Your prose is reliable; your numbers are not."* Where a brief can carry a mechanism
   instead of a magnitude, carry the mechanism.

---

## 29. A BRIEF MAY NOT INSTRUCT A LEG TO DELETE ANYTHING IT CREATED

**Filed 2026-07-29, under the deletion freeze, after the freeze's own compliance check
was found to have been run against the wrong population.**

### WHAT HAPPENED

Asked whether any live brief sanctioned cleanup, I grepped the **seven live-leg briefs**
and reported zero hits. That answer was true and the population was wrong. The
coordinator's own statement of the class is why:

> A CONTROL DELIVERED BY MESSAGE PROTECTS THE AGENTS WHO WERE RUNNING WHEN IT WAS SENT
> AND NOBODY ELSE.

The briefs directory is where the *next* leg gets its instructions, and it predates every
broadcast. So the population is the directory, not the roster. Measured:

```
cd briefs/
ls -1 | wc -l
  -> 382
grep -rniE '(clean up|delete|prune|tidy|rm -rf)[^.]{0,50}(worktree|clone|checkout|the tree|your tree|registration)' --include='*.md' .
  -> 15 lines across 11 files
```

`farmtable-em-f22, f23, f24, f25, f26, f29, f30, f31, f32, f33, f34` — eleven, plus the
two already known (`cleanup-audit.md`, `farmtable-worktree-experiment.md`). **13, not 2.**
Six of the eleven carry the *identical* sentence, verbatim:

> `clean up your worktree post-merge, and message the coordinator. Then signal task_completed.`

and `farmtable-em-f23.md` names the command in the sentence beginning
`Clean up the worktree` — `` Clean up the worktree (`git worktree remove`) ``.

> **CITATION CORRECTED 2026-07-29, AND THE CORRECTION IS THE EVIDENCE FOR §30 BELOW.**
> This line previously read `farmtable-em-f23.md:26`. That was true when written. The
> string now sits at **line 28**, because bannering that file — the remedy §29
> prescribes — inserted two lines above it. **§29's own evidence citation was falsified
> by the act of complying with §29.** Found by the second-phrasing sweep, in this file,
> against this rule. It is the same shape as the five stale citations that blocked
> xss-r7, which I also authored. Two independent instances, so it is not a lapse.

### THE PART THAT IS NOT ABOUT THOSE FILES

The coordinator's reading was that *a template directory was issuing that instruction*. I
went to find the template and disarm it at source. **There is no template.**

```
grep -rln 'clean up your worktree' .          # whole project scratchpad
  -> 11 files, all of them in briefs/, all of them instances
find . -iname '*template*'                     # nothing under briefs/ or em-tooling/
```

The replication vector is **copy the last brief**. So the generator is not a file that can
carry a banner — it is the authoring habit, and it passes through exactly one artefact
that is read at authoring time, which is this one.

> **AN INSTRUCTION REPLICATED BY COPY-PASTE HAS NO SOURCE FILE TO FIX. BANNERING EVERY
> INSTANCE LEAVES THE GENERATOR ARMED, AND THE GENERATOR IS THE AUTHOR.**

This is the same shape as `cleanup-audit.md:87`, which the coordinator correctly called
the sharper of the two hazards *because it produces a SAFE-TO-DELETE classification rather
than merely permitting a deletion*. A generator of that output shape is a standing hazard
regardless of who wrote it or how careful they were. My briefs are such a generator.

### THE RULE

1. **No brief I write instructs a leg to delete, remove, prune, tidy or clean up a tree,
   worktree, clone, checkout, registration, branch or store.** Not conditionally, not
   "after merge", not "once confirmed". A leg's tree is evidence until somebody with the
   whole picture says otherwise, and the leg never has the whole picture.
2. **Disposal is a separate, later, explicitly-authorised act by the manager.** If a tree
   should go, that is a decision made against the full inventory, not a step at the bottom
   of a feature brief written before the work started.
3. **Disarm by PREPENDING, never by deleting.** Removing the offending line destroys the
   evidence that briefs were issuing that instruction. The banner disarms without erasing.
4. **When asked whether a control is complied with, answer with the population and the
   predicate, and state which noun the population uses.** "Seven live-leg briefs, zero
   hits" and "382 files in the directory, 13 hits" are both true. Only one of them answers
   the question that was asked.

---

## §30 — ASK FOR ANNOTATIONS BY IDENTIFIER, NEVER BY LINE NUMBER

**Owed to the xss-r7 adjudication (`reports/_ADJUDICATION-xss-r7.md`), and independently
re-evidenced by the second-phrasing banner sweep against §29 above.**

An instruction of the form **"add a comment at `file:NNN` naming this control"** is
self-invalidating, **and the more thorough the comment the more wrong the number.** The
annotation displaces the line it cites, in the same commit, by the act of writing it.

Two independent instances, both authored by me, three days apart in the record:

| instance | citation | falsified by | drift |
|---|---|---|---|
| `dev-xss-r7-fix.md` AMENDMENT 1 §A2 | five `file:NNN` citations, all correct at `c108acb` | the 29-line comment the brief asked for | `306` → `335` |
| §29 of this file | `farmtable-em-f23.md:26` | the two-line freeze banner §29 itself prescribes | `26` → `28` |

The second one matters more than the first. The first was a brief instructing a leg. The
second is **a rule citing its own evidence, broken by its own remedy** — nobody was
careless, and the drift still happened, which is what makes it structural rather than a
lapse.

**THE RULE:**

1. **Cite by identifier.** A function name, a type name, a test name, a config key, a
   `grep`-able literal string. `internal/server/scopes.go`, function
   `RequireCollectionAccess` — never `scopes.go:103`.
2. **If you must cite a position, cite a quoted string and let the reader search.**
   `the line beginning "Clean up the worktree"` survives every insertion above it.
3. **A line number in an instruction is a defect. A line number in a *report* is fine**
   — a report describes a commit that does not move. State the SHA alongside it, per the
   standing rule that every artefact identifies a commit by SHA.
4. **This applies to my own rules files.** §29's citation was stale for hours inside the
   document that exists to stop exactly this.

## §31 — A POPULATION BUILT ON A GIT INSTRUMENT IS SUBTRACTABLE BY AN UNREVIEWABLE FILE

*Credit: `audit-writable-path`, 2026-07-29 09:04Z. Filed as the best thing in a message whose
headline charge I measured and refuted — see the note at the end, because both halves matter.*

**THE RULE.** State which class your population instrument belongs to, because the two classes
have different threat models and the difference is invisible in the output:

| instrument | consults ignore rules? | subtractable by an uncommitted host-local file? |
|---|---|---|
| `git ls-files`, `git status`, anything with `--exclude-standard` | **YES** | **YES** |
| a filesystem walk (`find`, `grep -r` with `--exclude-dir`) | **NO** | **NO** |

A population built on a git instrument can be silently reduced by an edit to
`.git/info/exclude` — which is **uncommitted, host-local, invisible to every other clone, and
reviewed by nobody**. Ranked by reviewability, the three ignore sites are: `.gitignore`
(committed, reviewable) < `--exclude-standard` (a documented default) < **`.git/info/exclude`
(per-store, uncommitted, unreviewable)**. And note the reach: that file lives in the **common**
dir, so `git rev-parse --git-path info/exclude` resolves to canonical's copy for **every linked
worktree**. There is no per-worktree exclude. One line binds all of them at once.

**WHAT THIS COST US, MEASURED.** At 09:01:15Z one anchored line was added to canonical's
`info/exclude`. It did what it was intended to do — but `em-tooling/snapshot-live-leg.md`, the
runbook we use to rescue crash-interrupted legs, enumerates with `--exclude-standard` and
snapshots with a gitignore-respecting add. **BOTH HALVES OF THE PRESERVATION PATH SHARE ONE
IGNORE MECHANISM WITH THE PUBLICATION PATH.** So a single edit aimed at publication also
subtracted a file from preservation, in the same instant, in all 125 linked worktrees. Only the
publication effect was intended and only the publication effect was disclosed.

> **AN IGNORE RULE MOVES THE PUBLICATION PATH AND THE PRESERVATION PATH WITH ONE EDIT, AND THE
> AUTHOR IS USUALLY THINKING ABOUT ONLY ONE OF THEM.**

**AND THE HALF THAT WAS WRONG, KEPT HERE BECAUSE THE CORRECTION IS THE LESSON.** The same
message charged that explicit-path `git add` *bypasses* exclude rules, and therefore that a
standing "explicit paths only" order defeats the exclude line. **MEASURED IN A THROWAWAY REPO,
THE CHARGE IS FALSE AND THE POLARITY IS INVERTED:**

```
git add -A              ->  rc=0, stages nothing, SILENT
git add <explicit path> ->  rc=1, NAMES THE FILE, stages nothing
git add .               ->  rc=0, stages nothing, silent
git add -f <path>       ->  rc=0, STAGES IT      (the only bypass, and it is explicit)
```

The mandated form is the **loudest** form. The order and the exclude line compose *correctly*.
**A CORRECTION IS A CLAIM LIKE ANY OTHER (§112): VERIFY THE CHARGE, DO NOT JUST PATCH THE CITED
INSTANCE.** Had I relayed this upward as received, I would have carried a confident, well-argued,
false mechanism into a security decision — and it would have travelled well, because the leg's
*conclusion* (an exclude is not a revocation) is entirely correct and lends its credibility to
the mechanism sitting next to it. **A TRUE CONCLUSION IS THE BEST AVAILABLE CARRIER FOR A FALSE
MECHANISM.**

---

## §32 — FOUR STANDARDS THAT MUST BE WRITTEN AS PROPERTIES, NEVER AS LISTS

**THE REASON THIS SECTION EXISTS IS THE FORM, NOT THE CONTENT.** Every rule below was already
in force tonight, and every one of them was defeated by being expressed as an enumeration, a
message, or an implementation. The governing property, filed by the coordinator at 09:11Z after
he caught it in his own control four minutes after issuing it:

> ## AN ENUMERATION PRESENTED AS A RULE IS READ AS COMPLETE BY EVERYONE DOWNSTREAM.

A reader who is handed a list of forbidden spellings does not infer the property behind them.
They infer that the list is the property, and they comply exactly, and every construction not
on the list is read as permitted. **A list does not fail loudly. It fails by authorising things.**

Two corollaries about *delivery*, which are the same defect on other channels:

> ## A CONTROL DELIVERED BY MESSAGE PROTECTS THE AGENTS WHO WERE RUNNING WHEN IT WAS SENT AND NOBODY ELSE.

> ## A RULE THAT IS WRITTEN, IMPLEMENTED AND ENFORCED IN ONE SCRIPT PROTECTS EXACTLY ONE SCRIPT.

Both were demonstrated tonight, on this project, against rules that were genuinely in force.
A rule reaches the agents who do not exist yet **only** if it is in a file the dispatcher reads
when writing their brief. That file is this one. **That is why all four are here and not in a
broadcast.**

---

### §32.1 — BULK CAPTURE INTO GIT

Landed verbatim, at the coordinator's instruction, as a property and not as a list of spellings,
**because the list-of-spellings version is the defect being corrected**:

> ## NO OPERATION THAT CAPTURES FILES INTO GIT BY ANY CRITERION OTHER THAN A PATH YOU TYPED IN FULL.
>
> Covers, non-exhaustively, **and the non-exhaustiveness is the point**: `git add -A`, `git add .`,
> `git add -u`, `git add` with a glob or a directory, `git stash -u`, `git stash -a`,
> `git commit -a`, `git commit` with a pathspec broader than one file.
>
> ## IF YOU CANNOT NAME EVERY FILE THE COMMAND WILL TOUCH BEFORE YOU RUN IT, DO NOT RUN IT.

**THE EVIDENCE THAT THE LIST FORM FAILS IS NOT HYPOTHETICAL.** The original order banned two
spellings, `git add -A` and `git add .`, and thereby permitted every construction its author had
not thought of. Within the hour another leg found that **`git stash -u` sweeps untracked files
into commits**, is untouched by that wording, and **had already fired three times on this host —
three of one leg's nine unique commits are stash-untracked commits that captured agent scratch
wholesale.** The gap was not merely open. It was already being exploited by accident.

**WHY THE MANDATED FORM IS ALSO THE SAFE FORM,** measured in a throwaway repo and independently
reproduced by a second leg who did not know the first measurement was running (§31):

```
git add -A              ->  rc=0, stages nothing, SILENT
git add <explicit path> ->  rc=1, NAMES THE FILE, stages nothing
git add .               ->  rc=0, stages nothing, silent
git add -f <path>       ->  rc=0, STAGES IT      (the only bypass, and it is explicit)
```

> ## THE DANGEROUS OUTCOME OF THE THREE IS THE SILENT SUCCESS, NOT THE LOUD FAILURE.

An explicit path that hits an ignore rule **refuses and names the file**. A bulk capture that hits
the same rule **succeeds, says nothing, and you learn what it took by reading the commit later —
or never.** Anyone who reasons that a refusal is an obstacle has the polarity exactly backwards.

---

### §32.2 — ABORTING CONTROLS

Source: `briefs/farmtable-predicate-2.md`, ABORTING CONTROLS, where it is already binding on
everything on this project. Stated here as the property so it survives being quoted:

> ## A DETECTOR THAT HAS NOT RETURNED YES IN THIS INVOCATION IS NOT KNOWN TO BE RUNNING, AND A RUN THAT CANNOT PROVE ITS DETECTORS FIRED MUST CRASH RATHER THAN REPORT CLEAN.

- Every detector is proven alive against a known-positive **in the same invocation**. Not in a
  previous run, not in a comment, not in the author's memory of having tested it once.
- **A dead detector must crash. It must never report clean.** A green from a detector that has
  never returned YES is indistinguishable from a green from a detector that was never called,
  and the second is the common case.
- **THE CONTROL MUST SHARE THE COMMAND SHAPE OF THE THING IT CONTROLS.** A control that runs
  through a different code path than the real scan proves that path works. This project has a
  worked failure: in `reports/audit-194-r11.md` the controls aborted on a zsh nullglob before
  the scan ran, and the shape difference is what let it happen.

Worked instance of the arrangement functioning, from `reports/relocate-offhost.md`: a credential
run **aborted once, by design, before producing any result**, because an `"x-api-key":` control
did not fire — the author's name-boundary regex disallowed a closing quote before the colon.
**A dead detector crashed the run instead of returning a clean bill.** The zeros that run later
published are worth reading *because* of that abort, and only because of it.

#### §32.2a — AND THE ABORT WILL CATCH SOMETHING §32.2 WAS NOT WRITTEN TO CATCH

> ## AN INVESTIGATOR WHO PUBLISHES A PROBE INTO THE POPULATION HAS ENLARGED THE POPULATION BY THE PROBE.

§32.2 exists to catch a **dead detector**. The first time this standard fired on this project it
caught something else entirely, and the class is worth more than the standard's stated purpose.

**Worked instance, 2026-07-29 09:1xZ, the eng-manager, inside the hour of landing §32.** The
bulk-capture sweep of `briefs/ reports/ em-tooling/` carried a **negative** control: a string
nobody would ever write, `git add --patch-this-does-not-exist`, which must return **zero** hits or
the matcher is over-broad. It returned **one**. The hit was
`reports/em-bulkcapture-prereg.md` — **the run's own pre-registration file, which had been written
into the corpus it was about to search minutes earlier.** The run aborted, exit 9, with no result.

The abort was not decorative. Without it:

- headline **ENUMERATED 54**, of which **37 were the author's own freshly-written cure**, quoted
  inside the four files that had just landed §32.1;
- the true pre-existing population was **17**;
- the published number would have been **wrong by roughly 3x**, in the alarming direction, and
  every hit would have survived spot-checking because every hit was real text in a real file.

**THE ABORTING CONTROL DID NOT CATCH A MATCHER DEFECT. IT CAUGHT A CONTAMINATION, AND IT CAUGHT IT
BY REFUSING TO PRODUCE A RESULT AT ALL.** That is the argument for aborting rather than warning: a
warning next to a number gets read as a caveat on a result, and the result is what travels.

Binding consequences:

1. **Your pre-registration, your brief, your scratch notes and your report are part of the corpus
   the moment you save them under a searched root.** If your sweep root contains your own writing,
   **exclude it by name and state the exclusion in the result** — never silently, and never by a
   pattern, because a pattern excludes files you did not intend as well.
2. **Prefer writing probes outside the searched roots**, or writing the literal probe strings only
   after the sweep has run.
3. Related but distinct from the count-inflation case already on file as EM-151: there the
   investigator's probes inflated a **count**; here a probe **invalidated a control**. Same root,
   different victim. Both are cured by the same discipline and neither is cured by care.

---

### §32.3 — CLAUSE THREE: PROOF THE COMPARISON WAS FED

> ## A CONTROL PROVES THE DETECTOR IS ALIVE. A CANARY PROVES THE COMPARISON FIRES. NEITHER PROVES THE COMPARISON WAS FED.

These are three separate claims and passing the first two is the ordinary way to ship a scan that
examined nothing. Discharge all three, as integers, never as assertions:

- **`ENUMERATED == FED`, and `SKIPPED == 0`**, published as integers next to each other.
- **Assert on SET equality, not COUNT equality.** A path that was neither fed nor skipped must
  abort the run. Counts can agree while the sets differ — that is exactly the field-order failure
  mode, and a count check cannot see it.
- **Plant the canary INSIDE the scanned population, not beside it.** A canary beside the
  population tests the detector. A canary inside it tests the delivery. Only the second is
  evidence that the pipeline hands files to detectors.
- **A zero from a harness that examined zero files is the void-harness shape**, and it has bitten
  this workstream nine times by that harness's own count. If the file count is 0, abort.
- **A comparator that has never returned NO is worth nothing.** Run it against a known-wrong input
  and confirm it says so, in the same invocation.

**AND NOW THE PART THAT MATTERS MORE THAN THE STANDARD.** This rule was not new tonight. It was
**written, implemented and enforced twenty-eight hours ago** by another leg, in
`/workspace/merge-completeness-prediction.txt`, complete with the abort condition (its falsifier
F5: *"The harness reporting 0 files examined... The script MUST abort if the file count is 0"*)
and the negative control (*"Compare a file against the WRONG leg's blob and confirm the comparator
reports a mismatch"*). **A later leg reproduced the exact defect anyway, because it never read the
file.**

Two things follow, and the second is the sharper one:

1. **A RULE THAT IS WRITTEN, IMPLEMENTED AND ENFORCED IN ONE SCRIPT PROTECTS EXACTLY ONE SCRIPT.**
   Enforcement inside an artefact is not publication. It binds that artefact's author, once.
2. **THE WORD "CLAUSE" DOES NOT APPEAR ANYWHERE IN THAT FILE.** `grep -n -i 'clause'
   /workspace/merge-completeness-prediction.txt` returns nothing. The rule is fully present there
   under entirely different wording. **A RULE EMBODIED ONLY IN AN IMPLEMENTATION IS NOT FINDABLE
   BY THE NAME IT IS LATER GIVEN**, so every subsequent search for it — by anyone, including its
   own author — comes back empty and concludes it was never done.

---

### §32.4 — PUBLISH THE ROOTS THE ENUMERATOR WALKED, NEXT TO THE PREDICATE

Filed by the coordinator at 09:16Z, in the author's own words, as the general cure:

> ## I DECLARED A PREDICATE AND THEN IMPLEMENTED A ROOT. A PREDICATE IS AUDITED BY READING IT; A ROOT IS AUDITED ONLY BY WALKING IT, AND NOBODY WALKS IT.
>
> When you publish a population, **publish the roots the enumerator actually walked, as paths,
> next to the predicate** — so a reader can diff two strings instead of trusting that they
> correspond.

This is the companion to *A POPULATION WITHOUT ITS PREDICATE IS A NUMBER WEARING RIGOUR'S
CLOTHES*. Stating the predicate is necessary and **it is not sufficient**, because a stated
predicate is exactly the artefact that stops anyone checking the implementation: the predicate
reads correctly, so the number inherits its credibility, and the divergence lives in code nobody
re-runs.

**THE WORKED INSTANCE IS THE BEST NUMBER PRODUCED ON THIS HOST TONIGHT, AND IT WAS WRONG BY A
SIGN.** A population declared as *"every working tree"* was enumerated by walking `/workspace`.
**The scratchpad is a git repository and is not under `/workspace`.** The published figure —
1,846 of 2,128 authored uncommitted files gitignored, 87%, implying an `--exclude-standard` scan
reaches 13% of the population — was withdrawn by its author, unprompted, at 09:11Z:

```
the scratchpad has 12,797 untracked files, and
  git ls-files --others --exclude-standard  returns the same 12,797.
NOTHING IS GITIGNORED IN THE SCRATCHPAD.
```

The excluded region is not 87% ignored. It is **0%** ignored, and it is the largest corpus on the
host. **AN 87% THAT MOVED TO 60% WOULD BE A CORRECTION; THIS IS A SIGN FLIP.** 11,605 files inside
the stated predicate were never scanned. **No blended figure exists and nobody should quote one.**

Two disciplines follow directly:

- **DO NOT CITE THE 87% / 13% FIGURE. IT IS WITHDRAWN.** It is still present, unannotated, at
  `reports/relocate-offhost.md:2049-2050`, whose §22.4 predicate says *"each of the 230 working
  trees"* while the enumerator walked `/workspace`. The withdrawal was delivered **by message**,
  which is §32's opening corollary firing on the correction to itself.
- **A SCOPE FAILURE AND A ROUNDING FAILURE ARE NOT THE SAME CLASS.** A number computed over the
  wrong root is not approximately right. It carries no information about the region it never saw,
  and the region it never saw may be the majority of the population and may behave oppositely.

**WHAT THIS DOES NOT DO IS SOFTEN §31.** Three ignore sites — per-clone, uncommitted,
unreviewable — is established independently of any percentage, and a decision to reject an
enumerator *because its mechanism is wrong in kind* does not weaken when the magnitude of the
error is restated. **AN ARGUMENT ABOUT KIND IS NOT REFUTED BY A CORRECTION TO DEGREE**, in either
direction, and an argument that would have been reversed by a corrected percentage was resting on
the percentage and not on the kind.

---

### §32.5 — A BANNER IS A CONFESSION, AND ITS TWIN IS WHERE THE HAZARD LIVES

Credit: `farmtable-predicate-2`, the independent second predicate, which found this by inverting
the instrument. Its framing is better than any of ours and is adopted verbatim:

> ## A BANNER IS A CONFESSION THAT A HAZARD WAS FOUND, AND ITS COUNTERPART DOCUMENT IS WHERE THE HAZARD ACTUALLY LIVES.

**Worked instance, and it was live for nine hours.** On 2026-07-29 between 08:27Z and 08:31Z the
eng-manager ran a disarming pass and bannered **thirteen briefs** carrying destructive
instructions. The pass was scoped to `briefs/`. It therefore bannered
`briefs/farmtable-cleanup-audit.md` — **the brief that commissions a deletion recommendation
table, and which says in terms "You produce a recommendation table. The coordinator executes."** —
and left `reports/crash-cleanup-audit.md`, **the 446-line report that CONTAINS that table**,
completely untouched. Measured at the time of the fix:
`grep -ric 'freeze' reports/crash-cleanup-audit.md` → `reports/crash-cleanup-audit.md:0`. A live
recommendation naming 18 containers for deletion, under a freeze forbidding all deletion, with
zero occurrences of the word.

Why the pass missed it is not carelessness, it is **shape**:

- **An instruction and its output live in different directories and have different file types.**
  A sweep for instructions searches `briefs/`. The executable hazard is in `reports/`.
- **The brief is written in the imperative and the report is written in the indicative**, so a
  vocabulary filter tuned to commands passes straight over a table whose cells merely *say*
  `SAFE-TO-DELETE`. A verdict column is an instruction with the mood filed off.
- Worse, the report typically carries **more** authority than the brief, because it is the thing
  with the evidence in it.

**BINDING: WHENEVER YOU BANNER A DOCUMENT, THE NEXT THING YOU DO IS FIND WHAT IT PRODUCED AND WHAT
PRODUCED IT.** A brief has outputs; a report has a commissioning brief; a runbook has run logs.
Banner the pair, or record in the banner why the twin does not need it. **A disarming pass scoped
to one directory is scoped to one grammatical mood, and hazards do not respect either.**

Second-order, and the reason this is in §32 rather than in a to-do list: **the existence of the
banner is itself the search key.** Enumerate every banner in the corpus and ask, for each, what
its counterpart document is. That inverted sweep is dispatched and running; its result belongs
under this heading when it lands.

---

### §32.6 — A PRIOR SUPPLIED IN A BRIEF IS AN INSTRUCTION TO DISBELIEVE THE INSTRUMENT

Credit: the coordinator, self-reported against his own brief, unprompted, within an hour of the
cost becoming visible.

> ## WHEN A BRIEF STATES WHAT PRIOR PASSES FOUND, IT MUST STATE THE PREDICATE THOSE PASSES USED, OR IT IS SUPPLYING A CONCLUSION WHERE IT OWES A SCOPE.

**Worked instance, measured cost, and the finding survived only by luck.**
`briefs/farmtable-predicate-2.md` opens by telling its agent that the corpus had been *"swept
twice and found zero."* Three things were wrong with that sentence, and only the third one is
obvious in hindsight:

1. **It was the fourth pass, not the second.**
2. **The prior passes swept for an ADJACENT objective**, not this one. The earlier zero had
   already been retracted by its own author as wrong-population, re-run, and returned **13**.
3. **It supplied a conclusion — "zero" — where what the agent needed was a scope: "here is the
   property those passes tested, which is not yours."**

The cost was measurable in the agent's own behaviour. Its instrument returned **781 flags**. Its
first instinct was **instrument failure**, because it had been told the true answer was zero — the
correct instinct, *"read them"*, was the one the brief had argued against. It read them anyway and
produced the §32.5 finding above, which is the single most operationally dangerous thing anyone
found that night. **A brief that supplies a prior is competing with the evidence in front of the
agent, and the brief usually wins, because the brief arrives first and looks authoritative.**

The correct model of the same information, and the reason the finding was still available:

> **THIRTEEN IS WHAT ONE PHRASING FINDS. IT IS NOT THE POPULATION.**

Rules:

- **Do not tell a fresh instrument what a prior instrument found, unless you also tell it what the
  prior instrument was looking for.** Number without predicate is not context, it is a thumb on
  the scale.
- **Never present a prior result as a tie-break or a corroboration target.** "Two passes found
  zero, confirm it" and "here are two predicates that were tried, yours must differ from both" are
  the same fact and produce opposite investigations.
- **State the ordinal honestly.** "The fourth pass, three of which were retracted or rescoped" is
  a very different brief from "swept twice, found zero."
- This is the same family as the suppressive-assurance class (EM-198, `COORD-126`): **the more
  accurate the upstream artefact, the more completely it suppresses the independent search.** A
  prior in a brief is suppressive assurance with the author's authority attached. Standing form
  remains **COLD FIRST, THEN RECONCILE.**

---

### HOW TO TELL WHETHER YOU HAVE WRITTEN A PROPERTY OR A LIST

Before shipping any control, apply all six:

1. **Can a reader construct a compliant-looking command you did not enumerate?** If yes, you wrote
   a list. Name the criterion, not the spellings.
2. **Who does it reach?** If the answer is "the agents I sent it to", it protects nobody dispatched
   tomorrow. It must land in a file the dispatcher reads.
3. **Where is it enforced?** If the answer is "in the script that implements it", it protects that
   script. Publish it under the name people will search for.
4. **What did the enumerator actually walk?** If you can only state the predicate and not the
   roots, you have published a number nobody can audit.
5. **Is your own writing inside the population you are searching?** If yes, you are measuring your
   cure as though it were the disease. Exclude it by name and say so.
6. **Have you bannered a document without finding its twin?** A brief has outputs; a report has a
   commissioning brief. Disarming one of a pair leaves the pair armed.
