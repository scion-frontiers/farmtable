# scopepath-61 — IS THE DOOR ON EVERY PATH, OR CAN YOU WALK AROUND THE BUILDING?

## 0. CONSTRAINTS — READ BEFORE ANYTHING ELSE

1. **YOU HAVE NO BUILD TOKEN AND YOU MAY NOT REQUEST ONE.** No `go build`, no `go test`, no
   `go vet`, no `make`, no `npm`. The host locked up on 2026-07-28 from concurrent Go builds.
   **THIS ENTIRE TASK IS ACHIEVABLE BY READING SOURCE.** If you come to believe a deliverable
   needs a build, STOP AND MESSAGE THE COORDINATOR — do not proceed on that inference.
2. **REPORT TO THE COORDINATOR ONLY.** Agent name `coordinator`, via `scion message`.
   **DO NOT CONTACT THE ENG-MANAGER. DO NOT CONTACT THE USER. DO NOT CONTACT ANY OTHER LEG.**
   Two review rounds are live and their adjudication queue is full; your findings must not
   enter them. You are deliberately decoupled.
3. **DO NOT MODIFY ANY FILE IN ANY REPOSITORY.** You are read-only on code. You write exactly
   one artefact, your report, at the path in section 4. No commits. No branches. No patches.
4. **DO NOT TOUCH `/workspace/farmtable-em-verify195`.** Not even a read. Standing ruling.
5. **NO `git gc`, NO `git prune`,** anywhere. Measured blast radius 57 commits / 256 objects.
6. **Read `/workspace/farmtable` (canonical) READ-ONLY.** Do not check out, do not switch
   branches, do not stash. It is on branch `task-state-web-ui-v2` at `633f8f2` and another
   leg's work depends on that being undisturbed. If you need a clean tree, make your own
   clone elsewhere.
7. **THIS IS zsh, NOT bash.** An unquoted glob matching nothing is a FATAL EXPANSION ERROR
   that kills the whole command line. **QUOTE EVERY GLOB:** `--include='*.go'`.
8. **`${PIPESTATUS[0]}` IS EMPTY IN zsh.** The array is `$pipestatus` and it is **1-INDEXED**.
   It is clobbered by ANY intervening command that runs — and the clobber does not make the
   value absent, it **REPLACES IT WITH THE NEXT COMMAND'S ZERO**, so a broken guard prints
   `EXIT=0` rather than looking broken. **THE RULE IS A SENTENCE, NOT A FORM: CAPTURE
   IMMEDIATELY AFTER THE PIPELINE, WITH NOTHING IN BETWEEN THAT RUNS. PRINT AFTERWARDS.**
   Pure assignment does not clobber.
9. **NEVER `2>/dev/null` ON AN EXPLORATORY COMMAND.** A leg tonight silenced `git show`, which
   had exited 128 because the path did not exist at that SHA, and reported the resulting
   silence as a measurement. **AN UNREAD DIAGNOSTIC IS RECOVERABLE; A SILENCED ONE IS NOT,
   BECAUSE YOU DESTROYED IT AT CAPTURE.**
10. **ABSOLUTE PATHS ALWAYS.** The harness resets cwd to `/workspace` between calls.
11. **MARK EVERY CLAIM MEASURED / DERIVED / UNCHECKED, IN THE SENTENCE ITSELF.** Most of
    tonight's errors across this fleet were a derivation wearing a measurement's clothes.

## 1. THE QUESTION, AND WHY IT IS BEING ASKED SEPARATELY

Another leg has just proved, rigorously, that in `internal/server/scopes.go` an empty scope set
can no longer be read as permission-for-everything. Its proof is a chokepoint argument: every
scope set must pass `RequireScope` (`scopes.go:99`), whose sole read of the context value is
`ScopesFromContext` (`scopes.go:57`), and `scopesKey` is an unexported const of an unexported
type — so **nothing outside `internal/server` can install a scope set at all.**

That proof establishes exactly this: **EVERY EMPTY SCOPE SET THAT IS CONSULTED IS DENIED.**

It does **not** establish this: **THAT THE DOOR IS ON EVERY PATH.**

**AN RPC HANDLER THAT NEVER CALLS `RequireScope` AT ALL PERFORMS NO SCOPE CHECK, IS ENTIRELY
UNAFFECTED BY THAT FIX, IS INVISIBLE TO EVERY SWEEP RUN TONIGHT — AND WOULD LOOK EXACTLY LIKE
A PASS IN ALL OF THEM.** Every measurement so far has asked "what happens at the door." Nobody
has asked whether there is a wall.

**THIS MAY BE LARGER THAN THE DEFECT IT SITS BESIDE, AND IT MAY BE NOTHING.** Both outcomes are
good deliverables. Do not arrive wanting a finding.

## 2. THE METHOD, AND THE ONE THING THAT MAKES IT TRACTABLE

The fleet has spent tonight learning, expensively and three times over, that enumerating an
open set is a false structural argument. **YOU ARE BEING GIVEN THE CLOSED SET UP FRONT — USE IT
AND DO NOT BUILD YOUR OWN.**

**THE HANDLER SET IS CLOSED, AND IT IS CLOSED BY THE PROTO, NOT BY YOUR GREP.** The generated
`...ServiceServer` interface in the protobuf-generated Go is a **COMPILER-ENFORCED MANIFEST** of
every RPC that exists. A method missing from your list is a method the server could not have
registered.

**SO: ENUMERATE FROM THE GENERATED INTERFACE. DO NOT ENUMERATE FROM `grep "func (s \*Server)"`.**
A grep over receivers is a vocabulary sweep — it finds helpers, misses embedded or
differently-named receivers, and its population is unbounded. The interface is a manifest.
Say in your report which you used, and quote the interface's declaration site with its file
and line.

Then, for each method on that manifest, establish whether a scope check is reached.

**THREE TRAPS, AND EACH ONE WILL PRODUCE A CONFIDENT WRONG ANSWER:**

- **T1 — INDIRECTION. "Does not literally contain the string `RequireScope`" IS NOT "performs
  no check."** A handler may call a helper that checks, or the check may sit in an interceptor.
  **YOU MUST TRACE TRANSITIVELY, AND YOU MUST STATE THE DEPTH YOU TRACED TO.** If you stopped
  at depth 2, say depth 2 — a bounded trace honestly reported is a finding; an unbounded one
  claimed is a fabrication.
- **T2 — THE INTERCEPTOR MAY ALREADY BE THE WALL.** `internal/server/auth.go:155` (unary) and
  `:204` (stream) are interceptors that install scopes. **CHECK WHETHER ANYTHING IN THAT
  INTERCEPTOR PATH ALSO ENFORCES**, and whether there is a per-method allowlist/skiplist near
  it. If enforcement is centralised there, the answer to this whole brief may be "the door is
  structural, here it is" — which would be the best possible outcome and you should say so
  loudly and early.
- **T3 — NOT EVERY HANDLER SHOULD CHECK.** Health checks, login/token-exchange, and any
  explicitly public RPC legitimately require no scope. **YOUR DELIVERABLE IS A CLASSIFICATION,
  NOT A VULNERABILITY COUNT.** Every method lands in exactly one of: CHECKS (cite the call
  site), CHECKED-UPSTREAM (cite the interceptor/helper), LEGITIMATELY-PUBLIC (say why, and say
  whether the code says why or you inferred it), or **NO CHECK FOUND**.
  **A METHOD IN "NO CHECK FOUND" IS A QUESTION, NOT AN ACCUSATION.** Write it that way.

**POSITIVE CONTROL, AND IT IS A DELIVERABLE, NOT A NICETY.** Before you trust your detection
method on the whole manifest, prove it has two reachable arms. Pick one method you have read
by hand and know DOES check, and one you have read by hand and know does NOT. Run your method
at both. **REPORT BOTH RESULTS.** If your method flags the first and not the second, it
discriminates. **A METHOD THAT HAS ONLY EVER AGREED WITH YOU HAS BEEN OBSERVED AGREEING, NOT
DISCRIMINATING** — and a classifier with one reachable arm is not a classifier.

## 3. THE FAILURE MODE OF THIS TASK, STATED PLAINLY

The leg whose work prompted this brief spent two hours cataloguing a single pattern:

> **AN ARTEFACT THAT RECORDS THAT A CONCERN WAS HANDLED IS INDISTINGUISHABLE, TO EVERY LATER
> READER, FROM THE CONCERN HAVING BEEN HANDLED — AND IT IS STRICTLY WORSE THAN NO ARTEFACT,
> BECAUSE ABSENCE INVITES INVESTIGATION AND A RECEIPT FORECLOSES IT.**

**YOUR REPORT IS THE NEXT CANDIDATE.** A table of RPC methods with ticks against them, filed in
a reports directory, will be read by everyone who comes after as *authorization is audited*.
So:

- **DO NOT LET YOUR REPORT SAY, OR IMPLY BY ADJACENCY, THAT AUTHORIZATION IS SOUND.** Scope
  presence is not scope correctness. A handler that calls `RequireScope` with the *wrong* scope
  passes your audit completely. **SAY THAT, IN THE REPORT, NEAR THE TOP.**
- **gRPC MAY NOT BE THE ONLY DOOR.** If there is an HTTP/REST surface, a gateway, a webhook, or
  a CLI path that reaches the same operations, **YOUR MANIFEST DOES NOT COVER IT.** Check
  whether one exists. If it does and you do not audit it, that belongs in NOT REACHED as a
  first-class gap, not a footnote.
- Every unmeasured bound gets a **FALSIFIER**: the specific observation that would prove your
  claim wrong. A bound without a falsifier is an opinion.

## 4. DELIVERABLES

**D1. THE MANIFEST.** The generated service interface(s) you enumerated from, with file:line,
and the total method count. State it as MEASURED.

**D2. THE CLASSIFICATION TABLE.** Every method from D1, in exactly one of the four categories
in T3, each with a citation. The four category counts must sum to D1's total **and you must
state that sum explicitly and confirm it matches.** If it does not match, that mismatch is your
most important finding — report it rather than reconciling it quietly.

**D3. THE POSITIVE CONTROL.** Both arms, both results, named methods.

**D4. THE INTERCEPTOR ANSWER (T2).** Is enforcement centralised in the auth interceptor path,
yes or no, with citations. If yes: is there a skiplist, and what is on it? **A SKIPLIST IS THE
MOST INTERESTING ARTEFACT YOU COULD FIND TONIGHT** — it is an explicit, reviewed list of
things that bypass the wall, which is either exactly right or exactly the bug.

**D5. THE TRACE DEPTH.** One line. How deep did you follow indirection, and what did you stop
at.

**D6. NOT REACHED.** Every bound you did not measure, each with its falsifier. Include the
non-gRPC surfaces question from section 3 whether or not you found any.

**D7. THE REPORT FILE** at
`/scion-volumes/scratchpad/projects/farmtable/reports/scopepath-61.md`,
containing D1–D6 and opening with a **three-line summary a tired reader will not misread.**
Record the SHA of the tree you measured — **the branch name is not an identifier, the SHA is.**

## 5. SHARDING

If the manifest exceeds 25 methods, do the classification in batches of 15 and **write each
batch into the report file before starting the next**, so that a context exhaustion leaves
completed work on disk rather than a summary of it. **A TRUNCATED READ THAT LANDS MID-LIST DOES
NOT LOOK TRUNCATED — IT LOOKS LIKE A SHORTER LIST.** If you pipe any listing to `head`, `tail`
or any limiter, the limit is part of the result and must be stated.

## 6. KEY LOCATIONS

- Canonical repo, READ ONLY: `/workspace/farmtable` (branch `task-state-web-ui-v2`, `633f8f2`)
- `internal/server/scopes.go` — `ContextWithScopes:49`, `ScopesFromContext:57`,
  `RequireScope:99`, and the sole authorization decision at `:106`
- `internal/server/auth.go` — unary interceptor `:155`, stream interceptor `:204`
- `proto/farmtable.proto` — the service definition
- Report directory: `/scion-volumes/scratchpad/projects/farmtable/reports/`

## 7. DIRECT CONTACT

Coordinator, agent name `coordinator`, via `scion message`. **Nobody else.** If you think this
brief asks the wrong question, **SAY SO TO THE COORDINATOR** rather than quietly answering a
better one — a disagreement voiced is useful; a substitution made silently is the exact failure
mode this project has been fighting all night.

## 8. TERMINATION

You MUST write the report at the path in D7, verify it is non-empty and contains D1 through D6,
message the coordinator with your three-line summary, and then mark the task complete.
