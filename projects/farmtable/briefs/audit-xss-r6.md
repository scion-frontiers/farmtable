# BRIEF — audit-xss-r6 (SECURITY AUDIT)

**READ `_r6-COMMON.md` FIRST. It is binding and it contains the build fence, the tree
provenance, the cold-first ordering and the shell facts.**

- **YOUR ROOT: `/workspace/farmtable-audit-xss-r6`** — yours alone.
- **SHA: `c108acbcfa2357862576092469828709bb6c4090`**, detached.
- `web/dist` in your tree was **COPIED**, not built here. `web/node_modules` was installed from
  the lockfile (79 entries).

## YOUR QUESTION

**`remote_data` is an attacker-authored map. Six rounds have been spent on it. Is the harm
closed, and is the boundary where this round thinks it is?**

The ruling this round is executing: *remote_data IS a security boundary, and the deliverable is
not the label — it is the answer to "what goes red when someone adds a sink".* Your job is to
test whether that is the right question and whether the answer is the one claimed.

Things this axis has already got wrong, offered so you do not re-derive them, **not** as a
boundary:

- **A CAPABILITY SINK IS NOT A RENDER SINK.** A search for places the value is *printed* cannot
  find the place it is *branched on*. The dashboard consumes this map as a write-authorization
  gate.
- **THE POPULATION IS OPEN.** An identifier search cannot match a computed access, a reference
  alias, or a setter whose name embeds the token. The guard added by this round is measured
  **GREEN against a computed access** — see COMMON section 7 for the bound.
- **PRESENCE IS NOT MODIFICATION AND REACHABILITY IS NOT PRESENCE.** Objects in a repository and
  files in the tree a gate checks out are two different populations.

**And one thing measured tonight by another leg at `7a0f220`, which you should treat as a lead
and not as a result, because I have not had it independently confirmed at YOUR SHA:** the key
`writable` inside this map is read in the web tree and appears in **zero** Go files, so there is
no server-side notion of a read-only collection; and `ImportCollection` copies an uploaded
document's collection map verbatim into storage with no key validation, held inert today only by
an unannotated conjunction of two unrelated facts in two files. **Re-measure it at your SHA
before you rely on a word of it.** If it holds, the interesting question is not the key — it is
what else that verbatim copy carries, and whether anything server-side reads any of it.

## SEVERITY DISCIPLINE

- **Classify with severity AND with measurement status.** *Live and demonstrated*, *live and
  derived*, *latent*, and *refuted* are four different things and only the first two are
  findings. A derived HIGH must say it is derived.
- **A LIMIT IS A SCOPE, NOT A DISCLAIMER, AND A SCOPE HAS TWO EDGES.** An unqualified RED
  misdirects as reliably as an unqualified green and is believed harder, because it sounds like
  candour. Bound your reds.
- **Do not accept an intent explanation as a control.** UI-only-by-oversight and
  UI-only-by-design look identical from the code.
- **Pre-register your response to every outcome, including the one that withdraws your own
  headline.** That instruction produced the best process artefact of the previous round.

## DELIVERABLES — NAMED EXACTLY

1. `/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r6.md`
2. `/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r6-project-log.md`
3. `/scion-volumes/scratchpad/projects/farmtable/reports/_prereg-audit-xss-r6.md`

Report order: **PHASE ONE (cold)** / **PHASE TWO, attributed** / **FINDINGS, each with severity
AND measurement status** / **WHAT I DID NOT CHECK** / **WHERE THE BRIEF WAS WRONG**.

**You MUST write all three files, message `eng-manager` your verdict and top findings, and then
mark the task complete.**
