# Shared baseline block — xss-r3 review round

Read this in full before your own brief. Three legs share it: `review-xss-r3`,
`test-xss-r3`, `audit-xss-r3`. You are independent of each other. Do not read
each other's reports.

---

## §0 — THE OPEN PASS COMES FIRST. THIS IS NOT DECORATION.

**Before you read the numbered item list in your own brief, do an open,
unscoped pass: "what does this diff put at risk?"** Write what you find as §0
of your report, and write it before you write anything else.

Then read your item list and do the scoped work.

**In your report, attribute every finding to one of: OPEN PASS, ITEM LIST, or
BOTH.** I am measuring whether the open pass finds anything the item list would
have missed. If it finds nothing new, say so plainly — a null result here is
the useful result and I will drop the practice.

Why this exists, stated so you can judge it rather than comply with it: on the
previous round of a sibling branch, two independent legs told me that **my
targeting steered the round away from the defect**, and that a leg checking only
what I asked would have approved a tree carrying a Critical. One of them wrote:
*"If I had predicted only what the brief asked me to check, I would have gone
3-for-3 and approved the change."* My item lists are a hypothesis about where
the risk is. They have been wrong. Treat them as a supplement to your own
judgement, not a substitute for it.

If you read ahead before doing the open pass, **say so in §0.** An honest
contaminated result is worth more to me than a clean-looking one.

---

## §1 — The tree

Branch `url-scheme-validation-r2`, HEAD `6805daa32aa67992bb26a4e66bd9d102bbf6fa53`.
Review range: **`0bc9b72..6805daa`** — 6 commits, 14 files, +2098 / −173.

```
6805daa docs: log the r3 fix round for the URL scheme change
b06121f Replace the false claims around the URL guards with measurements
457886d Widen the URL-binding scanner's recall and fix its anti-vacuity check
42d62a4 Stop the viaSafeHref check from approving defeated guards
d92ae5e Close the web runner's naming and consumption gaps
54c46cc Scrub every URL carrier out of remote_data, not just the typed field
```

`0bc9b72` is the tree the previous round (r2) reviewed and sent back with
REQUEST CHANGES from all three legs.

**The branch name is not an identifier; the SHA is.** Confirm
`git rev-parse HEAD` before you measure anything, and put the result in your
report. If it is not `6805daa`, stop and tell me.

**I do not give you a filesystem path.** Your tree is where your session opens.
Do not take a path from any brief — including this one, including line numbers.
See §5.

---

## §2 — Gates [MEASURED by me, this session, in a tree provisioned identically to yours]

| gate | exit | detail |
|---|---|---|
| `go build ./...` | **0** | zero output |
| `go vet ./...` | **1** | exactly **4** `copies lock value`, at `internal/server/server.go:1509,1619,1827,2004`. Literal string `copylock` appears **0** times. Pre-existing, unrelated to this diff. |
| `go test ./...` | **0** | zero `FAIL` lines |
| `npm run build` (in `web/`) | **0** | |
| `npm test` (in `web/`) | **0** | `PASS: 4 test file(s), 315 assertions.` |

### The quiet trap, and why your tree is provisioned

`assets.go` has `//go:embed all:web/dist`. `web/dist` is **untracked**, so a
plain clone does not have it. I provisioned yours; I have measured that it is
there.

On a previous round I created three leg trees *without* it and then wrote a gate
table telling the legs to attribute the resulting message to the diff. That
brief manufactured a false finding in any leg that followed it correctly. I
corrected it mid-flight, and **my correction was also wrong** — I described the
risk as a leg being *alarmed* by missing copylocks. A reviewer corrected me:

> *"That is the loud failure and it self-announces. The quiet one is worse —
> `go vet` still exits 1 with `web/dist` absent, just for the embed error, so a
> leg checking the exit code your table hands it records the row as REPRODUCED
> and never reads the message text."*

I have measured the quiet half in a provisioned tree this session, by removing
`web/dist` and putting it back:

```
control build exit=1   assets.go:5:12: pattern all:web/dist: no matching files found
control vet   exit=1   copies lock value: 0     web/dist messages: 1
```

Same exit code. Different reason. **Read the message text, not the exit code.**
If you see a `web/dist` message, my provisioning failed — tell me; it is not
something the diff did.

### Two more gate rules, both bought with real errors

- **Never pipe a gate command whose exit code you intend to read.**
  `go build ./... | tail` reports `$?` from `tail`. Two separate legs on this
  project recorded a false exit 0 that way.
- **Run Go gates from the repository root.** An auditor once got `exit 0` on a
  build that compiled nothing, issued from a subdirectory; only the
  `matched no packages` warning distinguished it. It discarded the run and said
  so, and that was among the most valuable paragraphs in the report. **A control
  that catches your own error is a result worth reporting.**

### `go test ./...` is GREEN, and this is a correction to earlier briefs

Earlier briefs on this branch relayed a **red** `go test` baseline. That was
wrong, and the fix leg charged me with it. I measured **exit 0** this session;
the fix leg measured 0 on three separate full-suite runs plus
`go test ./internal/server/ -run TestWatchTasks -count=5`.

`TestWatchTasks` has a recorded history of flaking at roughly **8% per
sequential full-suite run**, i.e. about 1-in-12 odds of a spurious RED on any
single-run matrix. So:

- If you see a RED, **re-run before filing**, and match the failing test **name**,
  not the exit code.
- **Do not record a red gate as "matches baseline."** The baseline I am handing
  you is green. A red gate here is either the flake or something real; it is not
  expected.

---

## §3 — Evidence discipline

**Tags.** `[MEASURED]` = you ran it, this session, in this tree. `[REPORTED — who]`
= relayed from a named source. `[INFERENCE]` = reasoned, not run. I read these
tags as load-bearing. An untagged assertion I will treat as `[INFERENCE]`.

**Non-vacuity requires a POSITIVE outcome.** A check that goes red when you break
the code proves the oracle can fire. It proves **nothing** about whether the
input space reaches the defect. Say which one you have.

**The count-neutral bar.** A pin that goes red when you change a count is not
evidence of non-vacuity unless a **count-neutral corruption** — one that holds
the count the pin might be reacting to exactly fixed, and corrupts only
identity — is *also* red. This rule has now found real defects in two
consecutive fix rounds, including one in a fix written to satisfy the brief that
imposed the rule.

**Overlapping oracle arms mask each other.** If you build a differential, assert
**which arm fired.**

**Say what a property sweep held FIXED**, not just how many cells it varied.

**State whether your enumeration is a bound or a count.** A confirmed lower bound
reported as a count is a recurring failure mode here.

**Report green controls at equal weight.** "I checked X and X is fine" is a
result. Several rounds on this project produced their most useful paragraph that
way.

**Enumerate what survived; do not grep for what you expected.** A round on this
branch surfaced three URL carriers nobody had thought to look for by enumerating
every attribute on rendered output instead of grepping for the expected ones.

---

## §4 — Working rules

- **Do not push.** Ever, on any branch, for any reason. Commit locally if you
  must commit; pushing is the manager's job alone.
- **Do not modify production code.** Your independence depends on it. Probe files
  and mutants are fine — revert them by snapshot restore (`cp` from a `/tmp`
  copy), **not** `git checkout`, and report **dirty cells at the end**.
  `git status --porcelain` must be empty when you finish; show that it is.
- Write your report to the path named in your own brief. **The report file is
  the deliverable.** Work you did that is not in the file did not happen.
- Write a project log entry under `.design/project-log/` if you commit anything.
- End with: verdict, then `sciontool status task_completed "<title>"`.

---

## §5 — The three ways my briefs go wrong

Required deliverable, every leg: **a numbered list of everywhere this brief is
wrong.** Not a courtesy — legs have found 5 to 11 errors per brief for nineteen
consecutive rounds, and the most consequential ones have twice been the
difference between finding a defect and approving it.

**Mode 1 — I supply a real input with a wrong expected result.** I have shipped
a suggested fixture asserting the opposite of measured truth. On this very
branch I asked for an end-to-end pin on a path where the observable is
structurally absent, so the assertion would have passed for the wrong reason —
on a branch whose signature failure is passing for the wrong reason.

**Mode 2 — I state the shape, count, or location of a causal set I have not
measured.** Last round on this branch I said "four of the nine divergences";
the fix leg could not reproduce four under **any** definition it could
construct, and found that two of the four rows in the source table were probes
the auditor had invented, not fixtures in the tree. **If I give you a count, a
line number, or a single locus, treat it as a hypothesis with a number attached.**

**Mode 3 — my targeting steers the round away from the defect, and a leg that
checks only what I asked APPROVES.** This is the worst of the three because it
is invisible from inside a leg that is doing its job well. It is why §0 exists.

**Corollary, charged against me three rounds running:** *when quoting an
artefact, resolve the citation against the tree first.* Two of three line
citations in the last fix brief pointed past end-of-file. **Every path and line
number in your brief is unverified. Resolve it yourself; if it is wrong, that is
item 1 on your numbered list.**

---

## §6 — Out of scope, do not re-derive

- The four `go vet` copylocks (§2).
- The clean-checkout `web/dist` build defect (§2) — tracked as its own item.
- CSP absence on the dashboard origin — tracked, own track.
- The `#195` markdown-sanitize branch and its DOMPurify work.
- The `#194` label-write-scope branch.
- Absence of CI — tracked, escalated, known. **But see the audit brief: whether
  *this diff's own guard* is run by anything is very much in scope.**
- `gofmt -l` reporting `internal/server/scopes.go` — pre-existing, untouched by
  this branch.

**Short fence, deliberately. If you find something outside it, surface it — do
not assume it is someone else's.** The fence exists so you do not spend your
round re-deriving known items, not so findings die at its edge.

---

## §7 — What the fix leg says it did

Its report is `/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r3.md`.
**You may read it. You are not required to, and you should do §0 before you do.**

Its own summary of the six commits:

- `54c46cc` — replaced the one-element list `urlBearingRemoteDataKeys` with a
  segment-based predicate `urlBearingRemoteDataKey(key)` plus
  `sanitizeRemoteData(map)`; `convert.go` now serialises the sanitised copy.
- `d92ae5e` — the web test runner now walks all of `src/`, hard-fails on
  test-shaped files the discovery glob missed, and requires every test file to
  emit a machine-readable `#assertions <n>` receipt from a shared counting
  harness.
- `42d62a4` — `viaSafeHref` now requires a whole-initialiser match, blanks
  comments and strings before scanning, and scopes to the enclosing brace block.
- `457886d` — scanner recall widened; the anti-vacuity check
  `findings.length >= ALLOWED.length` replaced with a file-count floor plus
  named witness paths.
- `b06121f` — false comments and fixture notes replaced with measurements;
  `base_dependent` markers made measured rather than annotated.

It reports **0 dirty cells**, nothing pushed, and 8 errors in my brief. I have
independently confirmed: tree clean, no remote-tracking ref for this branch,
6 commits, and every gate row in §2.

**Its claims are claims.** Two of them are load-bearing for your round and I have
*not* verified either:

1. That `remote_data` is **always nil** on the entire GitHub passthrough path,
   because `issueBuildRemoteData` writes a `[]string`, `structpb.NewStruct`
   rejects it, and `convert.go` discards the error with `_`.
2. That the scanner fixes are complete for the two fail-open shapes it confirmed.

Both are in your item lists.
