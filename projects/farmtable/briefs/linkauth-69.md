# linkauth-69 — IS F-1 LIVE, OR DID WE CATCH IT BEFORE IT SHIPPED? MEASURE, DO NOT ASSESS.

## 0. CONSTRAINTS — READ BEFORE ANYTHING ELSE

1. **THIS IS A MEASUREMENT TASK WITH A SHORT FUSE. SPEED MATTERS AND ACCURACY MATTERS MORE.**
   A person may be woken up on the strength of your answer. **AN OVERSTATED FINDING AND AN
   UNDERSTATED ONE ARE BOTH EXPENSIVE HERE, AND IN OPPOSITE DIRECTIONS.**
2. **YOU HAVE NO BUILD TOKEN AND MAY NOT REQUEST ONE.** No `go build`, `go test`, `go vet`,
   `make`, `npm`. **DO NOT START A SERVER. DO NOT CURL ANYTHING. DO NOT SEND A REQUEST TO ANY
   DEPLOYED HOST.** This is a source-and-git audit only. Probing a live system is out of scope
   and is not authorised.
3. **DO NOT MODIFY ANY FILE IN ANY REPOSITORY.** No commits, no branches, no patches. One
   artefact: your report.
4. **REPORT TO THE COORDINATOR ONLY** (`scion message coordinator`). **NOT the eng-manager, NOT
   the user, NOT any other leg.**
5. **DO NOT TOUCH `/workspace/farmtable-em-verify195`.** No `git gc`, no `git prune`, anywhere.
6. **`/workspace/farmtable` IS READ-ONLY TO YOU.** Do not check out, switch branches, or stash —
   other legs depend on it sitting still on `task-state-web-ui-v2`. Read history with
   `git show <sha>:<path>`, `git log`, `git cat-file`. If you need a tree of your own, clone
   elsewhere.
7. **zsh. QUOTE EVERY GLOB** (`--include='*.go'`) — an unquoted glob matching nothing is a fatal
   expansion error that kills the whole line.
8. **IF A COMMAND'S SUCCESS IS READ THROUGH A PIPE, WHAT YOU READ IS THE LAST STAGE.**
   `$pipestatus` in zsh is 1-indexed and is clobbered by any intervening command that runs — and
   the clobber does not make it absent, **IT REPLACES IT WITH THE NEXT COMMAND'S ZERO.** Capture
   immediately after the pipeline with nothing in between; print afterwards.
9. **NEVER `2>/dev/null`.** `git show <sha>:<path>` exits 128 and prints nothing when the path is
   absent at that SHA — **AND ABSENCE IS EXACTLY WHAT YOU ARE MEASURING, SO A SILENCED ERROR AND
   A TRUE ABSENCE WILL LOOK IDENTICAL TO YOU.** Read the exit code deliberately, every time.
10. **CITE A SHA ON EVERY CLAIM.** Three trees are live and a bare line number is ambiguous
    across all three. This is not a style note — it is the exact defect that wasted an audit
    tonight.
11. **MARK EVERY CLAIM MEASURED / DERIVED / UNCHECKED IN THE SENTENCE ITSELF.**

## 1. THE THREE TREES. MEMORISE THIS BEFORE YOU READ ANY CODE.

- **`7a0f220` = `origin/main`.** THE PUBLISHED TREE. **THIS IS THE ONE THAT MATTERS FOR THIS
  TASK.**
- **`633f8f2` = canonical, branch `task-state-web-ui-v2`.** **39 COMMITS AHEAD OF origin/main AND
  NEVER PUSHED.** Everything the fleet audited tonight was measured here.
- **`160e211` = branch `scopedeny-93-deny-unrecognised-type`.** An unmerged fix, descends from
  `633f8f2`.

## 2. THE FINDING YOU ARE PRICING (measured by another leg at 633f8f2, do not re-derive it)

**CORRECTED 03:50Z BY ME, THE AUTHOR, AFTER linkauth-69 CAUGHT IT. THE ORIGINAL TEXT OF THIS
SECTION SAID `serverapp/linkflows.go`. THAT PATH EXISTS IN NEITHER TREE. THE REAL PATH IS
`internal/serverapp/linkflows.go`. I AM LEAVING THIS NOTE RATHER THAN QUIETLY REPLACING THE
STRING, BECAUSE THE FAILURE MODE IS THE POINT: THE COMMAND THIS BRIEF ORDERED
(`git show 7a0f220:internal/serverapp/linkflows.go`) EXITS 128 AND PRINTS NOTHING — AND ABSENCE WAS
THE THING BEING MEASURED, SO A WRONG PATH AND A TRUE ABSENCE ARE INDISTINGUISHABLE BY EXIT
CODE. THE WRONG READING WOULD HAVE BEEN "PRE-MERGE CATCH, NOBODY GETS WOKEN."**

`internal/serverapp/linkflows.go:96-107` registers HTTP routes `/api/link/{github,jira,linear}/*`. Those
handlers call `lm.store.CreateLinkedAccount` at `:220`, `:337` and `:449`, writing linked accounts
**carrying live OAuth tokens**, with **no scope check, no identity check and no session check**,
and with `collection_id` taken **straight from a query parameter at `:135`**. The equivalent
operation over gRPC costs `collection:admin` (`server.go:1107`).

**THAT LEG DID ITS JOB AND YOU ARE NOT RE-CHECKING ITS READING OF THOSE LINES.** You are answering
a different question that it explicitly could not: **DOES THIS EXIST IN THE PUBLISHED TREE, AND IS
THE ROUTE ACTUALLY SERVED?**

**WHY YOU AND NOT THAT LEG: IT FOUND F-1, SO IT NOW HAS A STAKE IN F-1 BEING REAL. ASKING A
FINDER TO MEASURE WHETHER ITS OWN FINDING IS REACHABLE IS ASKING FOR A MOTIVATED MEASUREMENT.**
You have no stake. Keep it that way — **A NEGATIVE RESULT HERE IS AN EXCELLENT OUTCOME AND YOU
SHOULD BE VISIBLY WILLING TO RETURN ONE.**

## 3. THE FOUR QUESTIONS, IN PRIORITY ORDER. ANSWER Q1 FIRST AND MESSAGE ME THE MOMENT YOU HAVE
## IT — DO NOT WAIT FOR THE OTHERS.

**Q1 — IS `internal/serverapp/linkflows.go` PRESENT AT `7a0f220`, THE PUBLISHED TREE?**
`git show 7a0f220:internal/serverapp/linkflows.go` and **read the exit status deliberately.** If present:
does it still register those routes, still call `CreateLinkedAccount`, and still take
`collection_id` from a query param — **at that SHA**, quoting that SHA's line numbers, which will
NOT match the ones above. If absent, say so and prove it (`git log --oneline 7a0f220..633f8f2 --
internal/serverapp/linkflows.go` to show when it arrived).
**THIS SINGLE ANSWER DECIDES WHETHER TONIGHT CONTAINS AN INCIDENT OR A PRE-MERGE CATCH.**
**MESSAGE ME Q1 ALONE, IMMEDIATELY, BEFORE STARTING Q2.**

**Q2 — IS THE ROUTE ACTUALLY MOUNTED AND SERVED?** A registered handler on a router that nothing
listens on is not an exposure. Trace: which mux/router are these registered on, is that router
attached to an `http.Server`, what address and port does it bind, and **is that the same listener
that serves the public surface or a separate internal one?** Look for any middleware wrapping the
mux that might authenticate ahead of the handler — **A HANDLER WITH NO AUTH CODE INSIDE IT IS NOT
THE SAME AS AN UNAUTHENTICATED ROUTE**, and if a middleware saves us, that is the answer and it is
good news. Answer for **both** `7a0f220` and `633f8f2`, marked separately.

**Q3 — IS `TokenAuthInterceptor` INSTALLED ON EVERY `grpc.NewServer`?** Recommended by the
previous leg as the highest-value unmeasured bound, and it is: if any server omits it,
`lookup == nil` short-circuits at `auth.go:113`, `authEnforcedKey` is never set, and
`scopes.go:76` allows everything **on all 33 RPCs at once**. **ONE OMISSION INVALIDATES THIRTY
ROWS OF THAT REPORT SIMULTANEOUSLY.** Enumerate every `grpc.NewServer` call site in non-test code
and state, per site, whether the interceptor is attached. **`internal/cli/connect.go:169` runs an
in-process server in embedded mode and was left UNCHECKED — do that one explicitly.**

**Q4 — WHAT ELSE IS ON THAT HTTP SURFACE?** The previous leg enumerated the gRPC manifest and
found the wall complete there. **THE HTTP SURFACE HAS NEVER BEEN ENUMERATED BY ANYONE.** List
every route registered in `serverapp/` and anywhere else HTTP handlers are registered, and for
each say whether it performs any authentication or authorization. **DO NOT CLASSIFY DEEPLY — A
ROUTE LIST WITH A YES/NO/UNCHECKED COLUMN IS THE DELIVERABLE.** If the list is long, that fact is
itself the finding and you should say so rather than finishing it.

## 4. THE TRAP THAT WILL COST YOU THIS TASK

**DO NOT CONFLATE "I FOUND NO AUTH CODE" WITH "THERE IS NO AUTH."** Authentication can live in
middleware, in a reverse proxy config, in an ingress rule, in a load-balancer policy, or in an
IAP/OAuth layer in front of the binary — **NONE OF WHICH ARE IN THIS REPOSITORY.** This project
has an identity-aware-proxy question that was explicitly deferred by the product owner, so an
external auth layer is a live possibility here, not a theoretical one.
**SO: REPORT WHAT THE CODE DOES AND WHAT IT DOES NOT DO, AND MARK "IS THERE AN EXTERNAL AUTH
LAYER IN FRONT OF THIS?" AS UNCHECKED AND UNKNOWABLE FROM THE REPOSITORY.** Do not resolve it by
assumption in either direction. **AN OVERSTATED SEVERITY THAT TURNS OUT TO BE FRONTED BY A PROXY
DESTROYS THE CREDIBILITY OF EVERY REAL FINDING THIS FLEET PRODUCED TONIGHT.**

## 5. DELIVERABLES

**D1.** Q1 answer, messaged to me alone and immediately, before you continue.
**D2–D4.** Q2, Q3, Q4 as specified, each with SHAs and evidence marks.
**D5. NOT REACHED**, each bound with a falsifier — including the external-auth-layer bound from
section 4, which you must list whether or not you found anything.
**D6.** Report at `/scion-volumes/scratchpad/projects/farmtable/reports/linkauth-69.md`, opening
with **a four-line summary that a tired reader at four in the morning cannot misread.** State the
severity you believe is justified **and state plainly what would lower it.**

## 6. TERMINATION

You MUST message me the Q1 answer as soon as you have it, then write the report at the D6 path,
then message me the four-line summary, then mark the task complete.


**PATH REPAIR 03:53Z (eng-manager).** The executable command in section 3 said `--
serverapp/linkflows.go`; corrected in place to `internal/serverapp/linkflows.go`. **THE OCCURRENCE
IN SECTION 2 IS LEFT UNTOUCHED ON PURPOSE — IT IS A QUOTATION OF THE WRONG PATH INSIDE ITS OWN
CORRECTION, AND REPAIRING A QUOTATION DESTROYS THE RECORD.** Occurrences of the bad path in this
file before repair: 2. Deliberate (quoted): 1. Executable (repaired): 1.
