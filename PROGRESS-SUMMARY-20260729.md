# Farm Table — Project Progress Summary

**Reflects the state of the project as of 29 July 2026, approximately 13:00 UTC.**

---

## 1. What this document is

This is a plain-language account of where the Farm Table task state work actually stands:
what has shipped, what has not, what is blocking it, and what the last day and a half of
effort was spent on. It is written to be read start to finish by someone with no prior
context, and it avoids internal reference codes on purpose. Where a technical detail is
genuinely useful for a future reader, it is in the appendix at the end rather than in the
body.

It is deliberately not a reassuring document. The honest summary is that one real piece of
user-facing value shipped, and everything since has been spent on problems found next to it
— none of which has reached a user yet.

---

## 2. The documents this work started from

Two were asked for. There are in fact three, and separating them matters, because the one
whose filename looks most like the plan is not the plan. All three exist and all three were
read for this summary.

**The investigation that started it** — *Task State Model — Investigation & Shared
Understanding*, dated 25 July 2026, at
`/scion-volumes/scratchpad/projects/farmtable/analysis-task-state-model.md`.

Worth being precise about this one, because the filename suggests a plan and it is not one.
It says so itself in its own header: it is an investigation, and no design was proposed in
it. What it committed us to was a diagnosis rather than a course of action. The diagnosis was
that Farm Table had been storing derived facts as if they were asserted ones — that "ready"
and "blocked" were being hand-maintained as board columns while the system was simultaneously
computing the same two things from the dependency graph, and that "open", "closed" and
"completed" were each carrying more than one meaning. It concluded that these were not
separate annoyances but repeated instances of a single underlying mistake. That conclusion
has held up; nothing since has contradicted it.

**The plan proper** — *Farm Table Task State Model Design Contract*, dated 27 July 2026, at
`/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.

This is the document that turned the diagnosis into commitments. It defines the target data
model, sets out roughly twenty acceptance criteria, and lays out a four-part implementation
sequence: agree the contract and the migration rules; then the core data model, server API,
command line and agent interfaces; then the web interface; then documentation. It is the
document to measure delivery against, and it is the one this summary uses when it says
"the plan".

**The c-phase decision document** — *Task State Model: c-phase / ptone Decisions*, dated
26 July 2026, at
`/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md`.

This one was located and confirmed rather than guessed at. Two things confirm it: it is a
decision-capture document from the dedicated c-phase review thread, and the design contract
above independently names it as its authoritative decision record. It sits between the other
two in time and it is the hinge between them. What it committed us to is the shape of the
answer: separate asserted state from computed availability; simplify the native workflow
stages and delete the ones that were duplicating computed facts; represent pauses as a
separate hold reason rather than as workflow positions; represent scheduling as a date rather
than as a state; compute availability on the server so that the web UI, the command line, the
agent interface and the API all get the same answer from one place.

**Are we doing what we said we would?** On direction, yes — nothing that has shipped or is in
review departs from these three documents, and no settled decision has been quietly reopened.
On delivery, partly, and less than the plan intended.

Measured against the plan rather than against activity: the contract and migration rules were
agreed, which was a review step and produced no software. The core data model, server API,
command line and agent interfaces are merged and live — that is the one real delivery. The web
interface work is **not** merged; thirty-nine commits of it are sitting on a branch that has
never landed. The documentation pass has not been started. Most of the contract's acceptance
criteria remain unproven, which is a separate problem from being unimplemented and is
explained in section 6.

The plan also required the old status control to disappear from the web interface. It has not
been removed; it is present and user-selectable today. One of the choices it still offers is a
state the plan explicitly forbids offering that way, which makes this a defect rather than an
unfinished item, and it is described as one in section 5.

So the shape is: the engine of the refactor is delivered and a user benefits from it today,
and the entire user-facing half of it is written but unmerged. It stopped not because the plan
was found wanting but because effort was diverted, which is section 4.

---

## 3. What is actually built, and what a user gets from it today

The refactor gives tasks a real lifecycle state instead of inferring their status from
whatever labels happen to be attached. The core of that — the data model, the server API, the
command line and the agent interface — is finished, merged and running in production. A user
gets a genuine benefit from it today: task state is tracked and displayed consistently, and
tasks backed by GitHub issues keep their stage in step with the issue rather than drifting.

That is the whole of what has shipped.

The honest part is what happened next. Reviewing that first phase turned up security problems
in the surrounding code — not in the refactor itself, but in the paths it made easier to
reach. Essentially all engineering effort since has gone into those problems. The remaining
refactor work has not been touched in that time. If you were tracking this project by review
activity it would look like steady progress on the refactor; it is not. It is steady progress
on defects found next to it.

---

## 4. The gap between work done and work shipped, and it is large

There are five separate bodies of unmerged work. None of them has landed any production
change, and nothing from any of them has reached a user.

Four are branches. Three of those are security and correctness work, standing at seventy-four,
sixty-nine and forty-seven commits ahead of main, all twelve behind it. The fourth is a
single-commit correctness branch.

An earlier note gave sixty-seven commits for one of these branches and called it the largest.
It was neither: it was an earlier reading of the branch now standing at sixty-nine, and it was
not the largest of the three.

The refactor's own remaining interface work — thirty-nine commits, the entire user-facing half
of the plan — is **not** a separate item on that list. It is the lower portion of one of those
three security branches, with eight commits of security work stacked on top of it. It is
written, it has never landed, and as things stand it cannot land on its own.

**The fifth is not on a branch at all, and how it went missing is more important than its
size.** It is a security workstream of seventy-eight commits, larger than any of the branches,
and it exists in the repository only under a preservation reference. The question everyone
naturally asks — which branches have not merged — has a shape that cannot return work which is
not on a branch. Nobody hid it and nobody was careless; the instrument simply does not reach
it. It came to light only because someone separately checked whether the workstreams he could
name from memory resolved to anything at all. That mechanism is general, and it is the reason
the caution at the end of this section is worth reading.

**The refactor's remaining work and the security work are not independent of each other.** The
interface work sits underneath one of the security branches on the same line of development,
with the security work stacked on top. One consequence of that is certain, because it is simply
what merging means: landing that security branch lands all thirty-nine commits of interface
work along with it, whether or not anyone planned it that way. The other direction is not
certain: pulling the interface work out to ship on its own means separating two things that are
currently one line of development, and *nobody has attempted that separation or costed it*. It
may be straightforward or it may not. It is unmeasured, and it should not be assumed cheap.

The gap between work done and work shipped is currently the entire body of work from the last
stretch plus the whole user-facing half of the refactor, and it should not be read as
nearly-done. Each branch has been through repeated review cycles, and each cycle has found
something blocking. That pattern has not yet broken, and no merge date should be forecast from
it.

**What is still not known about this list.** Two gaps, and the first bears directly on whether
five is the right number at all. Every enumeration behind this document was run against
branches held on this machine. Twenty-one references exist on the remote with no local branch
of the same name, and five of those carry commits from the last four days. They have not been
enumerated, so a local count is not a complete instrument here either.

The second gap: there are one hundred and eleven older branches that have not merged into main.
Whether any of them carries live work is **unmeasured** — not zero, not unlikely, simply not
established. The obvious test does not settle it: this project
squashes commits when merging, which permanently makes a merged branch look unmerged by that
test. A sample of six was examined, found to answer a different question than the one being
asked, and discarded rather than published as a number that would later have to be withdrawn.
That discard was the right call. All one hundred and eleven are at least fifty-five commits
behind main and none has been touched in the last two days, but neither of those facts is
evidence that they are empty.

---

## 5. Why the reviews say do not merge

Two defects are holding the branches, and two more are already live in production. All four are
real, and all four are described here in terms of what they do to a user.

**The first is a link that runs code.** Text that arrives from outside — a task description,
an imported document, data pulled back from GitHub — can put a link into the dashboard that
runs code instead of navigating somewhere. If a user views a task containing such a link and
clicks it, code chosen by whoever wrote that text runs in their browser, in their logged-in
session, on a page that holds a long-lived API token. This is the defect the current review
cycle is trying to close. Several fixes have been written for it. Each time, the review found
a slightly different way of spelling the same attack that the fix did not cover. The fix is
getting narrower each cycle, which is progress, but it is not closed.

**The second is a permission check that can be bypassed.** The checks around changing a task's
lifecycle state can be worked around. Someone allowed to edit a task can, in certain
configurations, change its lifecycle state — including closing it — without holding the
permission that is supposed to be required for that. Nobody outside the organisation can reach
it, because the whole service sits behind the identity proxy, but inside that boundary it is a
real hole.

**Separately, and this one is already live in production**, there is an endpoint that writes
stored access tokens with no permission check on the caller at all. It is behind the same
proxy. It is not on either branch, it is not theoretical, and it has not been fixed.
[UNVERIFIED since the crash restore.]

**A third, also live, and newly found while checking the status for this document.** The plan
was explicit that one particular task state must never be directly selectable in the web
interface, because the whole point of the refactor is that this state is computed rather than
asserted by hand. The old status control was supposed to have been removed and has not been.
It still offers that state as a choice. So a user can today reach into the interface and
assert by hand the very thing the refactor exists to compute — which is the original defect the
project set out to fix, still reachable through the front door. This is an acceptance criterion
being violated in production, not an unfinished item on a list. To be precise about how firmly
this is known: the option has been confirmed present in the interface's list of choices in the
source code; it has not been separately confirmed that it renders on screen to a user.

---

## 6. Build and test health, and what it means for our own results

Three things here, and together they matter more than any one of them.

**Main is red.** The test suite on main does not pass reliably. The cause is understood: a
piece of background work is started without any way for the test that started it to wait for
it to finish, so tests can see data left behind by other tests. It is not a recent breakage
and it is not caused by any branch in review. [UNVERIFIED since the crash restore.] The cost
is worse than one failing test: when the baseline is unreliable, a failure in new work cannot
be told apart from the existing noise, so every pass and every failure we report from the test
suite is weaker evidence than it looks.

A clean copy of the project cannot be fully built or checked, because the web frontend's built
output is not stored in the repository and four Go packages require it — the project root, the
server command, the ft command, and the internal CLI. Everything else builds and tests normally:
of 32 packages, 28 are unaffected. Whole-project build, vet and lint commands stop immediately in
a clean copy; the test command runs and only those four fail. This is on the CI track to fix.

The reason nobody noticed is the part that matters. The machine we work on has had those files
sitting on it, unrecorded, since 27 July — a complete built frontend, several thousand files,
from a single build two days ago. They are not stored in the repository and they do not show up
in any routine check, because a rule written for another purpose keeps them out of sight. So
every build anyone has run on that machine has quietly been using them.

This needs stating carefully in both directions, because the obvious summary is wrong. A build
or a whole-project static-analysis check is impossible **from a fresh copy**. In the working
copy we actually use it **succeeds**, and has done for two days, precisely because of those
undeclared files. Both things are true, of different copies, and any statement that picks one
and applies it to everything is false.

The consequence is not that our recent results are wrong. It is that they are unqualified. Every
build, vet run and test result taken on that machine in the past two days has been conditional
on something nobody knew was there, and no report has ever recorded which kind of copy it was
taken in — a distinction that turns out to decide the answer. Nobody did anything wrong here: a
build output landing in a working copy is the most ordinary thing that can happen in a project
with a frontend, and the rule that hid it was written for something else entirely. The finding
is the missing qualifier, not anyone's conduct.

A related correction, and it runs against us. A count of outstanding static-analysis warnings
had been set aside on the grounds that the tool could not have produced it on a clean checkout.
That reasoning was wrong: the tool runs perfectly well in the working copy we use, which is the
likeliest place it was run. Those warnings are therefore **open and unverified** — not
dismissed, not confirmed, simply unexamined. They should not have been written off.

Separately, some past clean build results did not test what they appeared to test. The build
only requires that the frontend output directory exist, not that it contain a real frontend, so
in at least two cases a small placeholder file was enough to make it pass. Those results tell us
nothing about whether the project builds from a fresh copy and should not be cited as if they
do.

This is a real defect that was previously mislabelled as trivial, and it was caught by careful
work. The way it came to light is worth the owner's attention as a positive signal: the
placeholder shortcut was found and disclosed unprompted by the engineer who had taken it,
hours later, while he was auditing everyone else's work against the same standard. It was an
ordinary shortcut taken under pressure to unblock work, and the disclosure is the only reason
we know about it. The general lesson is the useful one, and it now rests on two findings rather
than one — two placeholder incidents, and two days of results from a machine nobody knew was
carrying the files. Our recorded history of passing builds is less informative than it looks,
and we found that out because people are checking their own work by the standard they apply to
others. That compounds the unreliable-main problem above —
both point the same way, which is that our historical confidence in the test suite is weaker
than the record implies.

**CI now exists.** It landed on main yesterday evening, and it is the one genuinely good piece
of news in this section, because it catches the fresh-clone build failure. But there is a trap
in it. The branches in review were all created before CI existed. The trigger reads its
instructions from the commit being pushed, so pushing one of those branches does not produce a
failing CI run — it produces no CI run at all, and silence is indistinguishable from success.
Every one of these branches must be brought up to date with main before it goes anywhere near
a merge, or we will read an empty result as a green one.

---

## 7. The credential investigation — what it cost and where it stands

Roughly eleven hours of effort went into a credential-exposure investigation rather than into
the project. It was triggered by discovering that a live administrative GitHub credential
belonging to the owner was sitting in plain text in several files on the shared machine. The
credential carries push rights across a large number of repositories and administrative rights
across most of them, spanning around twenty organisations, so the exposure is worth taking
seriously on its own terms.

Five investigation agents swept the host and found the credential in eight distinct places:
configuration files inside several repository checkouts, a coordinator state file, a preserved
snapshot of one of those configuration files, two per-agent files in an agent's home directory,
and — the one that matters most — a loose database file sitting inside a repository checkout
that is configured to push to GitHub. That last one means a single careless bulk `git add`
would have published a live administrative credential through the one repository able to
publish it. That specific risk is now guarded by a standing rule against bulk staging in that
tree, and it remains guarded. The rule is the guard; an ignore-file entry added early on was
reviewed and judged not to be remediation at all.

**The credential was not rotated.** The owner instructed us to stop work on it. The correct
status is therefore: **ACCEPTED RISK BY OWNER INSTRUCTION — NOT RESOLVED.**

Two gaps were left open, and they will stay open. The investigation was stood down by the
owner's decision, so these two things were never measured and are not going to be. First,
compressed storage
inside the repositories' history was never searched — several hundred megabytes of it — and
that kind of search fails toward looking clean, meaning a negative result there would prove
nothing. Second, the count of eight is a count of files found by the searches that were run;
every agent's live process environment also holds the value and no file-based scan could ever
have counted it. Eight is a floor, not a total.

What that leaves unknown is worth stating plainly, because an open gap normally reads as work
someone intends to get to, and these are not that. We do not know whether the credential also
sits in the repositories' compressed history, and we are not going to find out. We do not know
how many places hold it altogether; we know only that it is at least eight and cannot be fewer.
The decision to stop was a reasonable one on the information available at the time. The reason
for recording this here is not to reopen it, but to make sure it can be revisited later if the
owner wants to — and that requires him knowing what was left unmeasured.

**The eleven hours were a cost to delivery that nobody put to the owner as a choice until he
asked.** That is the coordinator's failure, not the engineering manager's, and it is the part
of this section most worth fixing.

The investigation also produced a large body of methodology findings — on the order of a
hundred, concerning measurement tools that silently return wrong answers. They are not
summarised here because this is a progress document; they are recorded in the method-findings
sections of the five investigation write-ups in
`/scion-volumes/scratchpad/projects/farmtable/reports/`.

---

## 8. What happens next, and the decision currently with the owner

The immediate mechanical steps are clear regardless of anything else: bring the outstanding
branches up to date with main so that CI actually runs on them, close out the current review
cycle on the link-that-runs-code defect, and fix the fresh-clone build so that a plain checkout
of the project can be checked on its own, without depending on files that happen to be sitting
on one machine. Nothing can be merged with confidence until the branches produce real CI results
rather than silence.

What remains of the refactor itself should not be mistaken for a polish pass. Its entire
user-facing half — the web interface — is written but unmerged, thirty-nine commits sitting on
a branch that has never landed, in the same queue and behind the same gate as everything else.
The documentation pass has not been started at all. Getting that branch merged means taking it
through the same review cycle that has so far blocked every other branch, so it should be
costed as real work rather than as finishing off.

**One decision is outstanding and it is with the owner.** The question is whether security
hardening continues to sit in front of the refactor, or whether the refactor is split out and
allowed to ship independently of it. The case for the current order is that the defects are
real and two of them touch a page holding a long-lived token. The case against it is everything
in sections 3 and 4: the refactor has not moved at all in the entire period, the work that would
finish it is already written but cannot get through the same gate, and no merge date can
honestly be forecast from the current review pattern.

**One thing should be understood before that decision is taken: the two options are not
independent of each other.** Because the interface work sits underneath the security work on
one line of development, leaving the hardening in front does not merely delay the refactor — it
means the refactor's interface half ships automatically, as part of that security branch,
whenever it finally lands. And choosing the other course does not simply release work that is
sitting ready; it first requires separating two things that are currently one, which nobody has
attempted or costed. Neither option is the clean one it might appear to be from a distance.

The production endpoint that writes stored access tokens without a permission check is also
still open and is not covered by any of this branch work. It should be treated as its own item
rather than folded in.

---

## Appendix — technical anchors

Kept out of the body deliberately; useful only to someone picking this up in the codebase.

**Documents referenced above, by full path:**

- `/scion-volumes/scratchpad/projects/farmtable/analysis-task-state-model.md` — the
  investigation, 25 July 2026, revised through nine rounds.
- `/scion-volumes/scratchpad/projects/farmtable/notes/task-state-model-cphase-decisions.md` —
  the c-phase decision record, 26 July 2026.
- `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md` — the
  design contract, 27 July 2026; implementation sequence in its section 13, acceptance
  criteria in its section 14, known open implementation questions in its section 15.

A note on the name: "c-phase" in these documents refers to the reviewer identity in the
independent review thread, not to a phase of work lettered C. A reader searching for a
"phase C" in the plan will not find one.

**A numbering hazard, for anyone reading older notes.** Two different phase-numbering schemes
are in circulation and they collide. The design contract's section 13 numbers its four parts
one to four. The engineering workstream separately numbers its own phases one to three, and in
that scheme "phase one" means the merged production work — which is the *contract's* phase
two. The worst collision is the documentation pass, which is phase four in the contract and
phase three in the workstream. This summary therefore describes work by what it is rather than
by number, on the engineering manager's own recommendation. Any older note saying "phase N" of
this project should be treated as ambiguous unless it names which scheme it means.

Status against the contract's section 13, for the record: part one (contract and migration
review) satisfied, no code by design; part two (core data, API, CLI, MCP) merged and live,
confirmed present in the wire format on main; part three (web UI) **not merged**, thirty-nine
commits outstanding on an unlanded branch, confirmed by ancestor check rather than by
inspection of file contents; part four (documentation) untouched.

The live acceptance-criteria violation noted in section 2 is the old status control in the web
toolbar, which still offers the four superseded status values including the one the contract
names as forbidden. Confirmed present in the options list at main; not separately confirmed to
render.

**Two cautions for whoever picks this up, both earned today.**

First, an earlier reading of this same question searched web source for the new model's
vocabulary, found it, and concluded the web work had landed. It had not. The new terms are
present at main because the core contract commits generated types into the web tree. A search
for whether a name appears cannot answer whether a body of work has merged; only an ancestor
check can. That mistake was made and caught within about four minutes.

Second, and the more general one: the count of outstanding work was given too low twice in
succession during the preparation of this document, and each time the number came from an
instrument whose shape excluded part of the answer. Asking which branches are unmerged cannot
find work that is not on a branch. Asking whether a branch is an ancestor of main cannot, in a
project that squashes commits, distinguish a merged branch from a live one. Both questions
return confident answers. Neither returns a complete one.

The current count of five carries exactly the same exposure. It is bounded by one hundred and
eleven older branches that have not been assessed, and by twenty-one remote references that were
never enumerated at all. Five is the best figure available and it has not been shown to be
wrong; that is not the same as its having been shown to be right. Where this document gives a
count, it gives the boundary of the count alongside it, and that is deliberate.

**Provenance of the figures in this document.** The commit counts, ancestry relations and
enumeration results reported here were measured by the engineering manager and relayed. The
author of this summary ran no repository commands and has not independently reproduced any of
them. Several of the figures reached their current form only after being challenged and
re-measured, which is why they are believed to be right — and also why the count boundary above
is stated rather than assumed.

**The target model, in one line:** native stages reduce to triage, accepted, working,
in review, in QA, deploying, and the terminal outcomes; hold reasons move to their own axis;
scheduling becomes a start date; availability is computed server-side from stored primitives
and exposed with reason codes.

**Build failure specifics:** the Go build embeds the web frontend's built output directory and
fails if it is absent. The directory is not stored in the repository. The embed requires only
that the directory exist, which is why a placeholder satisfies it and why a passing build does
not imply a real frontend was present.

**Methodology findings:** in the method-findings sections of the five `*-final.md` write-ups in
`/scion-volumes/scratchpad/projects/farmtable/reports/`, with fuller working records alongside
them in the same directory and in `predicate2/`.
