# grpcauth-71 — IS THE AUTH INTERCEPTOR ACTUALLY INSTALLED? (SOURCE-ONLY, NO TOKEN)

## 0. BUILD FENCE — YOU HAVE NO TOKEN AND YOU ARE NOT GETTING ONE
You may NOT run: go build ./..., go vet ./..., go test ./..., npm test, make build, make test.
You may NOT run ANY go test, not even single-package. **THIS IS A READ-ONLY LEG.** git, grep, sed,
and reading files. That is the whole instrument. If you believe you need to execute Go code, STOP
and say so in the report as UNMEASURED — do not ask for a slot.

## 1. ROOT AND SHA — STATE THEM ON EVERY CITATION
Work in YOUR OWN clone. Canonical is /workspace/farmtable @ **633f8f2** — DO NOT WORK IN IT, it is
shared by ~15 agents. There are **TWO** live trees and they disagree:
  origin/main **7a0f220** | canonical **633f8f2** (39 ahead, unpushed)
**EVERY LINE NUMBER YOU REPORT IS AMBIGUOUS UNLESS YOU NAME WHICH.**
**CORRECTION 03:55Z, BY ME, THE AUTHOR.** This brief originally said THREE trees and named a third,
**160e211**. That was **FALSE AND I HAD ALREADY MEASURED IT FALSE BEFORE I DISPATCHED YOU**:
`git cat-file -t 160e211` in canonical returns *fatal: Not a valid object name*. It resolves in
exactly one clone on the fleet, it is one leg's local test commit, and it is not an ancestor of
origin/main. **I CARRIED A DEAD SHA IN MY HEAD FOR HOURS AND PASTED IT INTO A BRIEF AS A PREMISE.**
I am annotating rather than silently deleting because the failure mode is the lesson:
**A SHA THAT RESOLVES IN EXACTLY ONE CLONE IS NOT A SHA, IT IS A LOCAL FILENAME THAT LOOKS LIKE
EVIDENCE — AND `git cat-file` FAILS ON IT WITH exit 128 AND NO OUTPUT, WHICH READS AS "NOTHING
THERE" RATHER THAN "YOUR QUESTION WAS MALFORMED."** If any instruction below leans on 160e211,
**IGNORE THAT INSTRUCTION AND TELL ME.** And note: /workspace/farmtable
contains OTHER AGENTS' worktrees under .claude/worktrees/. **A grep from the repo root hits five
copies of the codebase and quintuples every count.** State your path filter. This bit me tonight.

## 2. THE QUESTION — IT DOMINATES THIRTY OTHER ROWS
A prior leg certified 30 of 33 gRPC RPCs as scope-checked, per-handler. That table has an unstated
precondition: **the checks only bind if TokenAuthInterceptor is installed on the server that serves
them.** One omission and all thirty rows are vacuous at once.

## 3. WHAT I HAVE ALREADY MEASURED — VERIFY IT, DO NOT ASSUME IT
Root /workspace/farmtable, SHA 633f8f2, canonical tree only, .claude/worktrees/ EXCLUDED, full
option lists read (not grep adjacency). Non-test grpc.NewServer sites, 5:
  cmd/farmtable-server/main.go:92    -> UnaryInterceptor :95            PRESENT
  internal/cli/connect.go:163        -> UnaryInterceptor :166           PRESENT
  **internal/cli/connect.go:302      -> ONLY MaxRecv/MaxSend :303-304.  ABSENT**
  internal/cli/dashboard.go:87       -> UnaryInterceptor :90            PRESENT
  internal/testutil/testserver.go    -> 7 constructors, see below
testutil constructors: :24 ABSENT, :65 ABSENT, :105 ABSENT, :142 ABSENT, :183 ABSENT,
:218 PRESENT (unary AND stream), :259 PRESENT. **FIVE OF SEVEN INSTALL NO AUTH AT ALL.**
**RE-RUN MY QUERY BEFORE YOU BUILD ON IT. If your numbers differ from mine, re-run MINE, not yours,
and tell me which bound differed.** My per-site breakdown above is a positive control I am handing
you for free -- use it as one.

## 4. THE TWO RELAYED PREMISES — THESE ARE THE JOB, AND THEY ARE UNVERIFIED
I am relaying these from another agent. **I HAVE NOT MEASURED EITHER. DO NOT ADOPT THEM AS FRAMING.
IF YOU FIND THEM FALSE, THAT IS A BETTER RESULT THAN CONFIRMING THEM.**
- **P1**: internal/server/auth.go:113 — if lookup == nil the interceptor short-circuits and
  authEnforcedKey is never set on the context.
- **P2**: internal/server/scopes.go:76 — when authEnforcedKey is unset, the scope check ALLOWS.
If P1 and P2 both hold, then a server built with no interceptor does not merely skip the
interceptor: **every per-handler scope check inside it silently passes.** Read both functions in
full. Quote the branch. Name the SHA.

## 5. THE FOUR DELIVERABLE QUESTIONS
- **Q1 (PRODUCTION).** internal/cli/connect.go:302 — what serves this? It is constructed right
  after github.NewPassThroughStore(:299), so it appears to be the GitHub-passthrough embedded
  server. **Is it reachable by a caller who is not the local operator?** Trace the exported command
  path to it. If it is strictly a local in-process bufconn with no listening socket, SAY SO -- that
  materially lowers it and I would rather have the true low than a loud high.
- **Q2 (THE HARNESS).** For each of the 5 no-interceptor testutil constructors: how many test
  functions call it, and **do any of those tests assert that something is DENIED?** A denial
  assertion inside a server with auth off is the inverted case of a vacuous pass -- report the count
  and name the files. **THIS IS THE ONE I MOST WANT.**
- **Q3 (POLARITY).** Do any of the 30 certified handler checks execute ONLY inside a testutil
  constructor that lacks the interceptor? If P1+P2 hold, those rows were never exercised.
- **Q4 (HISTORY).** git log -S on the interceptor argument for each of the 5 absent sites: was it
  removed, or never present? **"NEVER PRESENT" AND "REMOVED" ARE DIFFERENT FINDINGS.**

## 6. MEASUREMENT RULES — NON-NEGOTIABLE
1. Every citation carries **SHA + path + line**. No bare line numbers.
2. **Positive control on every negative result.** An empty grep and a broken grep are the same
   bytes. Prove your query can find the thing by finding a known instance with it first.
3. Report **command + observed output**, never a verdict standing alone.
4. Three outcomes only: **FOUND / MEASURED-ABSENT / UNMEASURED.** "Probably fine" is UNMEASURED.
   **UNMEASURED IS A FULLY RESPECTABLE ANSWER AND I WILL NOT PENALISE IT. A CONFIDENT WRONG ANSWER
   COSTS THIS PROJECT FAR MORE THAN A HONEST GAP.**
5. A check whose success condition is *no match* exits 1 when clean. **NEVER WRAP IT IN || true.**
6. Shell is **zsh 5.9, not bash**. Unquoted globs are a fatal expansion error. $PIPESTATUS is empty;
   the array is $pipestatus and it is **1-INDEXED**. grep is ugrep 7.5.0.

## 7. THE TRAP, DISCLOSED
**I EXPECT YOU TO CONFIRM THAT THE FIVE CONSTRUCTORS MAKE SCOPE ASSERTIONS VACUOUS. THAT EXPECTATION
IS A BIAS AND I AM HANDING IT TO YOU DELIBERATELY SO YOU CAN SEE IT COMING.** Before your results
section, write the sentence: **"THE FINDING WOULD HAVE BEEN FALSIFIED IF ____"** and fill it in with
something you actually checked. If you cannot fill it in, you did not test the prediction, you
decorated it.

## 8. DELIVERABLE — THE ANALYSIS IS NOT THE DELIVERABLE, THE FILE IS
1. Write **/scion-volumes/scratchpad/projects/farmtable/reports/grpcauth-71.md** — Q1-Q4 each with
   FOUND/MEASURED-ABSENT/UNMEASURED, commands, outputs, SHAs, the falsification sentence.
2. Write a **project log entry** in .design/project-log/.
3. **DO NOT PUSH. DO NOT MODIFY PRODUCTION CODE — YOUR INDEPENDENCE DEPENDS ON IT.** No commits to
   any Go file. Report files and the log entry only.
4. Message eng-manager when the file exists.
**YOU MUST WRITE reports/grpcauth-71.md AND THEN MARK THE TASK COMPLETE.**
