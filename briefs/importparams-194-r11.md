# Brief: Does the collection-import path require a NEW collection, or can it target an EXISTING one?

## READ THIS FIRST - CONSTRAINTS

1. **NO BUILDS. NONE.** No go build, no go test, no go vet, no make, no test suite,
   for any reason, in any directory. The host locked up on 2026-07-28 from concurrent
   Go builds and the recovery is still in progress. You are not exempt. This is a
   SOURCE-READING task and the answer is obtainable by reading source. If your
   approach seems to require executing code, it does not - report the residual
   instead and say what a build would have told you.
2. **READ ONLY.** Do not modify, create, move or delete any file under /workspace
   other than your own report at the deliverable path below.
3. **Do not run git gc, git prune, or any destructive git command anywhere.** In the
   canonical repo these have a measured blast radius of 57 commits / 256 objects.
4. **Do not touch /workspace/farmtable-em-verify195.** Skip it entirely.
5. **Do not contact the eng-manager and do not contact the user.** Contact the
   coordinator only, agent name "coordinator". See Direct Contact below.

## Why you exist, stated without the thing that would bias you

Another agent produced a finding whose grade depends on a premise about this import
path. It recorded, to its credit, that it never actually read the store side, and
handed over the gap rather than letting the grade rest on it.

**You are NOT being told what the finding is, what the grade is, or which answer
would support which outcome.** That is deliberate and it is not withheld out of
caution - a previous leg on this project was given a neutrally framed question and
returned an exhaustive answer that survived scrutiny precisely because it could not
tell which result was convenient. If you find yourself able to infer what answer is
wanted, say so in your report and treat the inference as a contaminant.

Report what the code does. Do not soften, do not hedge toward safety, and do not
report an answer you did not measure.

## The question

In the collection import path, when a collection is imported:

**Q1. Can the import target a collection that ALREADY EXISTS, or does it always
create a new one?**

Specifically, walk `ImportCollectionParams` on the STORE side (not the server/RPC
side - the store side is the part that was never read) and establish:

  a. Every field of `ImportCollectionParams`, and which of them can name or select a
     pre-existing collection (an ID, a name that is looked up, an upsert flag, a
     merge mode, anything of that shape).
  b. What the store implementation actually does with those fields: insert-only,
     upsert, merge-into-existing, or replace.
  c. Whether any caller anywhere passes a value that would select an existing
     collection. Enumerate the callers - do not sample. State how you established
     the caller list was complete.
  d. Whether the answer differs between store backends. If there is more than one
     store implementation, answer per-implementation and say so; do not generalise
     from one to the others. Two adapters on this project have already been found
     to behave OPPOSITELY while sharing an interface, so treat divergence as the
     expected case rather than the surprising one.

**Q2. If an existing collection CAN be targeted: what happens to the tasks already
in it?** Preserved, replaced, merged, duplicated? Cite the code that decides.

**Q3. Is the path reachable from caller-supplied input** - i.e. from an actual RPC
handler with data from the wire - or is it test-only / internal-only wiring at this
commit? Reachable and test-only are different answers and the difference matters.

## Method requirements

- **Pin a commit SHA.** State the SHA you measured at, at the top of the report, and
  cite every claim as path:line. A file:line with no SHA is not a citation.
- **Argue completeness, do not assert it.** When you claim you found all callers, show
  the tree-wide grep that establishes it, including the exact pattern. Sampling is not
  enumeration.
- **A file is not a direction.** If a symbol appears on both an import and an export
  route, they are different answers and must be reported separately.
- **Distinguish "the code does not say X" from "the code does not depend on X."** Only
  the first is greppable. If your answer rests on an absence, say which kind it is.
- **Declare what you did not reach.** Any bound you did not personally measure gets an
  explicit NOT REACHED line naming what would falsify it. A report that declares its
  holes is worth more here than one that reads complete. The leg before you was
  credited specifically for doing this.

## Key locations

- Canonical repo, READ ONLY: /workspace/farmtable
- The store layer and the server layer are separate; the store side is the unread part.
- Prior exhaustive-walk report to use as a FORMAT model only, not as a source of
  conclusions: /scion-volumes/scratchpad/projects/farmtable/reports/persistence-walk-194-r11.md

## Deliverables

A single markdown file at
  /scion-volumes/scratchpad/projects/farmtable/reports/importparams-194-r11.md

It must contain, in this order:
  1. The commit SHA measured at.
  2. A direct one-line answer to Q1: CREATE-ONLY, or CAN-TARGET-EXISTING, or
     DIFFERS-BY-BACKEND. No preamble before this line.
  3. Q2 and Q3 answered, each with citations.
  4. The complete caller enumeration with the grep that proves it complete.
  5. A NOT REACHED section listing every bound you did not measure and what would
     falsify each.

A stub or a summary that restates the question is not a deliverable. Cite or omit.

## Direct contact

Questions you cannot resolve by reading source go to the coordinator, agent name
"coordinator", via scion message. Do NOT contact the eng-manager - it is mid-round on
live work - and do NOT contact the user. If you believe the question itself is
malformed, say so to the coordinator rather than answering a question you invented.

## Termination

You MUST write the completed report at the path above, verify it is non-empty and
contains all five required sections including an explicit NOT REACHED section, and
then mark the task complete.
