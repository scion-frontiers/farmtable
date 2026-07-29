# XSS / Phase 2 — ROUND 5 THREE-WAY INDEPENDENT REVIEW

**Dispatched by the eng-manager, 2026-07-29 ~04:55Z.** Three legs, genuinely independent.
**You are one of three. You will not see the other two reports and you must not seek them.**

---

## 0. THE TREE. THIS IS THE ONLY SHA THAT MATTERS.

| | |
|---|---|
| Branch | `url-scheme-validation-r5` |
| **HEAD under review** | **`d305391`** |
| Base | `e6bda71` |
| Commits in range | **13** — `git rev-list --count e6bda71..HEAD` = 13 |
| Working tree at handoff | clean, `origin` untouched, **nothing pushed** |

**GET YOUR OWN WORKTREE OR CLONE. NO TWO LEGS MAY EVER SHARE A SCRATCH PATH.** Your scratch path
is given in your dispatch message. If you find another agent's files in it, **STOP AND MESSAGE ME**
— do not clean it and continue.

**OPEN YOUR REPORT WITH A SENTENCE NAMING YOUR WORKING TREE AND THE SHA YOU MEASURED.** If your
`git rev-parse HEAD` is not `d305391`, everything you write is about a different artefact.

---

## 1. HOW TO WORK. READ THIS BEFORE THE FINDINGS LIST — THE ORDER IS THE POINT.

**PASS 1 — OPEN AND UNSCOPED. DO NOT READ SECTION 4 UNTIL YOU HAVE FINISHED IT.**
Review the diff on its merits. Whatever you find, find it your own way.

**PASS 2 — ONLY THEN, read section 4 and check the known items.**

**EVERY FINDING CARRIES AN ATTRIBUTION TAG: `[PASS-1]` or `[PASS-2]`.** This is not bookkeeping.

> I have been front-loading defect classes into briefs all night, and legs have been coming back
> reporting instances of those classes. **THAT IS NOT CONFIRMATION, IT IS RETRIEVAL. A LEG PRIMED
> WITH A CLASS WILL FIND THE CLASS — HONESTLY, WITH CORRECT MEASUREMENTS — WHICH IS EXACTLY WHAT
> MAKES IT INVISIBLE.** The tags are the only way this round can tell me anything about the
> codebase rather than about my own brief. **A REPORT THAT IS ALL `[PASS-2]` IS A MEASUREMENT OF
> ME.**

**MARK EVERY CLAIM** `[MEASURED]`, `[DERIVED]`, `[REASONED, NOT MEASURED]`, or `[UNCHECKED]`.
`[UNCHECKED]` is a perfectly good deliverable and I would rather have ten of them than one
confident sentence that turns out to rest on nothing. **DO NOT LAUNDER A HEDGE INTO A CLAIM.**

**CITE BY CONTENT, NEVER BY LINE NUMBER.** The tree moved three times tonight; `:358`/`:534`
became `:420`/`:617`, and a census keyed on `:613`/`:617`/`:620` silently returned `0/0/0` after an
edit. **A LINE NUMBER IS A POINTER INTO MUTABLE STATE.** Quote the identifier or the code.

**CONTROLS.** If you assert an absence, say what your search space was — not just your predicate.
**A POSITIVE CONTROL PROVES YOUR INSTRUMENT FIRES; IT DOES NOT PROVE YOU POINTED IT EVERYWHERE.**
Where you can, use a control you could actually have failed.

**PRE-COMMIT TO YOUR FALSIFIER. THIS IS THE MOST IMPORTANT INSTRUCTION IN THE BRIEF.**

When you form a hypothesis, **write down what would refute it, and what you will do under each
outcome, BEFORE you go and look.** Put both in the report. Then report the result **whichever way
it came out.**

> The reason is not tidiness. **ONCE YOU KNOW A RESULT, WHETHER YOU KEEP IT DEPENDS ON WHETHER IT
> MAKES A STORY** — and a result that says "the thing I suspected is not happening" has no story
> in it, so it quietly does not get written down. Pre-committing removes the selection step
> entirely instead of asking you to resist it.
>
> **A NEGATIVE RESULT IS THE HIGHEST-VALUE THING THIS ROUND CAN PRODUCE, BECAUSE IT IS WHAT STOPS
> US BUILDING ONE FIX FOR TWO CAUSES.** Tonight a leg proposed that two failing tests shared a
> root cause, wrote the falsifier first, and the falsifier fired — the two were unrelated, and
> the "obvious fix" would have been wrong for both. **THAT IS THE SINGLE MOST USEFUL RESULT
> ANYONE PRODUCED, AND IT WOULD HAVE BEEN DISCARDED AS BORING IF IT HAD NOT BEEN PRE-REGISTERED.**

**"I SUSPECTED X, HERE IS WHAT WOULD HAVE SHOWN IT, I LOOKED, X IS NOT THERE" IS A FINDING. WRITE
IT UP AS ONE.**

---

## 2. HARD CONSTRAINTS

- **DO NOT PUSH. EVER.** Not your branch, not anything. The eng-manager is the only agent
  permitted to `git push`.
- **DO NOT MODIFY PRODUCTION CODE.** Your independence is the entire value you add. If you want to
  prove a mutant, mutate, measure, restore, and **verify the restore by checksum**.
- **THE BUILD FENCE IS LIVE AND IT IS PROJECT-WIDE.**
  - **TOKEN REQUIRED** for `go build ./...`, `go vet ./...`, `go test ./...`, `npm test`,
    `make build`, `make test`. **EXACTLY ONE TOKEN EXISTS AND I HOLD IT. ASK ME AND WAIT.**
    Three of you are running; I grant it **serially**. Expect to queue.
  - **NO TOKEN NEEDED** for a single-package run: `go test ./internal/<pkg>/ -run '^TestName' -count=1`.
    **But you MUST append a line to `reports/_run-queue-log.md` BEFORE you run it**, including the
    **ROOT and DIST columns — mandatory even on lines that pass.**
- **Shell is zsh 5.9, not bash.** Unquoted globs are a fatal expansion error. `${PIPESTATUS[0]}` is
  empty — the array is `$pipestatus` and it is **1-indexed**. `grep` is ugrep. A check whose
  success condition is *no match* exits 1 when clean; **never wrap it in `|| true`.**
- **DO NOT PUT BACKTICKS IN A `scion message`.** They execute. Use plain quotes.
- Report to **`eng-manager`** only. Do not contact the coordinator, do not contact ptone.

---

## 3. WHAT THE 13 COMMITS DO

An XSS hardening round on `remote_data`. The load-bearing claim, **C-1**, is that values on the
GitHub passthrough path carry Go types that are **not structpb-representable** — so a
representability check is a real guard rather than a formality. Two carriers are pinned:
`rd["labels"]` (`[]string`, set unconditionally, never nil) and `rd["sub_issues"]`
(`[]map[string]any`). Sanitization was extended to every write site and every depth.

---

## 4. **DO NOT READ THIS UNTIL PASS 1 IS DONE.** KNOWN WEAKNESSES, DISCLOSED BY ME.

I am giving you the soft spots **before** you look, because a reviewer who discovers them
independently and a reviewer who was told will write different reports, and I want the difference
visible in your tags.

1. **THE PERSISTENCE PREMISE DOES NOT REST ON THIS ROUND'S OWN WALK.** The author's D1 walk
   returned NOT PERSISTED with a green positive control — and then found it had **missed an entire
   path**. `graph_routing.go` pulls passthrough tasks and writes them into an in-memory SQLite
   store, a genuine encode/decode round trip. The verdict survives only because
   `taskToCreateParams` copies fourteen fields and **never assigns `RemoteData`**.
   **THE VERDICT IS LOAD-BEARING ON AN INDEPENDENT EARLIER WALK (`reports/persistence-walk-194-r11.md`,
   pinned to `e6bda71`), NOT ON THIS ROUND'S ENUMERATION.** The author's search space was bounded
   **by file** when its criterion was written over **path nodes**. **ASSUME THERE IS ANOTHER PATH
   AND GO LOOK FOR IT.**
2. **A SHIPPED REASON STRING WAS FOUND FALSE MID-ROUND AND REPAIRED.** The `metadata` exemption
   claimed `json.RawMessage` "never reaches the wire at all" — true on the passthrough path, false
   on the beads path, which **is** the persisted one. Behaviour was correct; only the reason
   changed. **THERE MAY BE MORE REASON STRINGS OF THIS SHAPE. A CORRECT-SOUNDING JUSTIFICATION IS
   WHAT STOPS A CAREFUL READER LOOKING FURTHER.** One step in the new reason is marked
   `[REASONED, NOT MEASURED]` in the comment itself — go and measure it if you can.
3. **THE WRITE-SITE SCANNER DOES NOT READ `_test.go` FILES AT ALL.** So a green from it means
   **"not scanned"**, not "scanned and cleared". The author found this by expecting the opposite.
   **DO NOT TREAT THAT SCANNER'S SILENCE AS COVERAGE OF ANYTHING IN A TEST FILE.**
4. **A CARRIER WAS NAMED IN AN EARLIER REPORT AND WENT UNPINNED FOR A WHOLE ROUND.** `sub_issues`
   was written down at r11 and only enforced in this round. **KNOWLEDGE THAT EXISTS IN AN ARTEFACT
   AND IS NOT ENFORCED BY AN INSTRUMENT READS AS COVERAGE** — the search for "did anyone know about
   this" succeeds. **ASK OF EVERY PROPERTY THIS ROUND ASSERTS: WHAT GOES RED IF IT CHANGES?**
5. **THIS PROJECT'S HOUSE STYLE IS AGGREGATE COUNT PINS, AND THEY ARE BLIND TO COUNT-NEUTRAL
   CORRUPTION.** A guard fixed at "5 suites" is green when one of the five is swapped for
   something else. Prefer membership and absolute per-axis assertions; flag any count-shaped pin.
6. **THE SUITE IS NOT TRUSTWORTHY AS AN ORACLE RIGHT NOW.** `main` is RED. 165 tests can observe
   another test's rows; 40 assert counts over shared state; **five assertions are floors (`len < 1`)
   and are structurally incapable of ever reporting contamination.** A green you obtain may be a
   property of test ordering. **Say so if it might be.**

---

## 5. YOUR DELIVERABLE

Write it to the **exact path in your dispatch message**, under `reports/`. Also:

- **A verdict: `APPROVE` or `REQUEST CHANGES`.** Blocking items listed separately from opinions.
- **A section titled "WHERE MY BRIEF WAS WRONG."** Every leg tonight has found errors in my briefs
  — the running count is in the dozens, and several were instructions that would have made the
  artefact **worse** if obeyed. **IF YOU FOLLOWED AN INSTRUCTION OF MINE THAT WAS WRONG, SAY SO.
  IF YOU DISOBEYED ONE BECAUSE IT WAS WRONG, SAY THAT TOO — THAT IS THE OUTCOME I WANT.**
- **A section titled "WHAT I DID NOT CHECK."** Bound your own coverage. An unstated gap is worse
  than a stated one.
- **A project-log entry** at `.design/project-log/2026-07-29-<your-leg-name>.md`. **Write it. Do
  not skip it. It is not optional and it is the step legs skip.**

**TERMINATION: YOU MUST WRITE YOUR REPORT FILE AND YOUR PROJECT-LOG ENTRY TO DISK, MESSAGE
`eng-manager` WITH YOUR VERDICT AND THE REPORT'S BYTE SIZE AND FIRST LINE, AND THEN MARK THE TASK
COMPLETE.** A finding that exists only in your context is a finding that does not exist.
