# Brief: Is the collection-import path field-enumerated or invariant-based?

## READ THIS FIRST - CONSTRAINTS

1. **NO BUILDS. NONE.** No go build, no go test, no go vet, no make, no binary, in any
   directory, for any reason. The host locked up on 2026-07-28 from concurrent Go
   builds. This is a SOURCE-READING and DESIGN task. If your approach seems to need
   execution, it does not - report the residual and say what a run would have told you.
2. **DO NOT IMPLEMENT ANYTHING.** No code changes, no patches, no diffs applied. You
   produce a measurement and a remedy DESIGN. A different agent implements. If you find
   yourself editing a .go file you have exceeded scope.
3. **READ ONLY under /workspace**, except your own report at the deliverable path.
4. **No git gc, no git prune,** anywhere. Measured blast radius 57 commits / 256 objects.
5. **Do not touch /workspace/farmtable-em-verify195.**
6. **Do not contact the eng-manager** - it is mid-round on live work. **Do not contact
   the user.** Coordinator only. See Direct Contact.
7. **zsh apparatus, both verified in this environment tonight:** `${PIPESTATUS[0]}` is
   EMPTY here - the array is `$pipestatus` and it is 1-INDEXED. A guard written with
   PIPESTATUS renders as `EXIT=` and is UNARMED while looking armed. And UNQUOTED GLOBS
   ABORT THE COMMAND - quote every `--include=*.go`.

## Background: a real finding that was parked, and why you are not just fixing it

An earlier verification leg confirmed a live privilege escalation on the collection
import path, referred to here as F7d. Confirmed, not suspected:

  `ImportCollection` requires only the `collection:admin` scope, writes `users.type`
  VERBATIM from opaque caller-supplied bytes, and `convert.go:211` renders any
  unrecognised type as `AGENT` - so the escalated user is invisible to the CLI, the
  dashboard and MCP alike.

It was graded a real keeper needing a real fix rather than documentation, and then
deferred behind the precondition "once F7 gets prioritized." That precondition had no
owner and never fired. **You are the owner now.**

**The reason you are measuring rather than patching.** A point-fix on `users.type` is
the cheap remedy, and the cheap remedy is exactly what an escalated, aged finding
selects for. A separate measurement has since found a SECOND caller-supplied value on
the same path: `EntStore.ImportCollection` accepts caller-supplied PRIMARY KEYS via
`SetID` on tasks, comments, relationships and changes
(`internal/store/entstore.go:2132,2199,2216,2228`), and their safety rests entirely on
the SERVER remapping to fresh UUIDs at `internal/server/export_import.go:318` - a
server-side invariant protecting a store-side API.

So the import path demonstrably sanitises SOME caller-supplied values and not others.

## The question

**Q1 - THE ROOT. Is the import path's handling of caller-supplied document content
FIELD-ENUMERATED or INVARIANT-BASED?**

That is: does the handler protect a hand-listed set of fields it knew to worry about
(IDs at `:318`, remote data at `:332`, whatever else you find), or does it establish a
property that holds for every field of the document including ones added later?

Answer by enumerating, at a pinned SHA:
  a. Every field of the parsed import document that reaches a store write.
  b. For each, what if anything transforms, validates, remaps or rejects it, cited.
  c. Which fields reach a write UNTOUCHED. `users.type` is one - find the others. Do
     not assume the list is short and do not stop at the first few.
  d. Whether both parse arms (the native document and the Beads conversion) converge
     before that handling, or whether either bypasses it. If they converge, say at
     which line, and confirm the handling is downstream of the join.

**Q2. What is the blast radius of each untouched field?** For each, state what a
malicious import document can cause. `users.type` gives an invisible AGENT-rendered
escalation. Others may be inert. Say which, and cite - do not grade a field dangerous
because it is untouched, or safe because you cannot immediately exploit it.

**Q3. THE REMEDY DESIGN.** Given the answer to Q1, design the fix.
  - If FIELD-ENUMERATED, a point-fix on `users.type` closes one instance and leaves the
    class. Say so plainly and design the invariant-based alternative: what property,
    established where, would hold for fields nobody has thought of yet.
  - State the remedy's COST honestly - files touched, call sites affected, and what it
    would break. A remedy whose cost you have not stated cannot be chosen against a
    cheaper one.
  - Name what the remedy does NOT cover.
  - Explicitly address the layering defect: an invariant enforced in the server that
    protects a store API is not inherited by a second caller of that store API. Say
    whether your remedy fixes that or leaves it.

## Method requirements

- **Pin a commit SHA** at the top; every claim cited as path:line. A file:line with no
  SHA is not a citation.
- **Argue completeness, do not assert it.** Show the tree-wide greps, with patterns.
  Sampling is not enumeration.
- **A file is not a direction.** `export_import.go` serves BOTH import and export.
  Import takes no collection ID and creates one; export takes an ID and enforces access.
  Do not attribute an export-route property to the import route. This has already
  produced one wrong conclusion on this project.
- **Distinguish "the code does not say X" from "the code does not depend on X."** Only
  the first is greppable. If a claim rests on an absence, say which kind it is.
- **Declare a NOT REACHED section** with a falsifier for each bound you did not
  personally measure. The previous leg was credited specifically for doing this. A
  report that declares its holes is worth more here than one that reads complete.
- **Do not soften toward reassurance and do not inflate toward alarm.** If F7d turns out
  narrower than described above, say so - the description is a prior, not a fact you
  must confirm.

## Key locations

- Canonical repo, READ ONLY: /workspace/farmtable
- Import RPC handler: `internal/server/export_import.go`, handler at `:264`
- The two parse arms and their join sit around `:271`-`:299`; ID remap at `:318`;
  store call at `:412`. VERIFY these line numbers at your SHA rather than trusting them.
- Store side: `internal/store/entstore.go`, `ImportCollection` around `:2091-2246`
- Renderer: `convert.go:211`
- There is a SECOND, independent Beads implementation at
  `internal/server/beads_import.go` (~460 lines). Whether it reaches a store write with
  caller-supplied values is IN SCOPE for Q1(d).
- Format model only, NOT a source of conclusions:
  /scion-volumes/scratchpad/projects/farmtable/reports/importparams-194-r11.md

## Deliverables

A single markdown file at
  /scion-volumes/scratchpad/projects/farmtable/reports/importtrust-f7d.md

In this order:
  1. Commit SHA measured at.
  2. Q1 one-line answer: FIELD-ENUMERATED or INVARIANT-BASED. No preamble before it.
  3. The full field table for Q1(a)-(c), with the greps proving it complete.
  4. Q1(d): the two arms and the join.
  5. Q2 blast radius per untouched field.
  6. Q3 the remedy design, with stated cost and stated non-coverage.
  7. NOT REACHED, with a falsifier for each bound.

A summary that restates the question is not a deliverable. Cite or omit.

## Direct contact

Questions you cannot resolve from source go to the coordinator, agent name
"coordinator", via scion message. NOT the eng-manager, NOT the user. If you think the
question is malformed, say so rather than answering one you invented.

## Termination

You MUST write the completed report at the path above, verify it is non-empty and
contains all seven sections including NOT REACHED, and then mark the task complete.
