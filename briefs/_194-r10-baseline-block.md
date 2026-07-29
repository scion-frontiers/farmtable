# Shared baseline block — #194 round 10 review

Read this in full before your leg brief. It is your tree, your gates, and your rules.

## Your tree

Branch `label-write-scope-r10`. Base `06f01d7d6555a311fcd0728eac40335e654c1de6`.
Head `6d8f19e11f4ddbfdc313301199006d3f7c76eb1c`. Four commits.

**This brief deliberately does not tell you a filesystem path.** Confirm where you
are with `git rev-parse --show-toplevel`, and confirm what you are looking at with
`git rev-parse HEAD`. If HEAD is not `6d8f19e…`, stop and say so. The branch name
is not an identifier; the SHA is.

Your report path IS given absolutely, in your leg brief. Use it exactly as written.
A relative report path in a covering message cost a leg time last round — it is only
valid in the sender's container.

## Gates — `[REPORTED — dev-194-r10]`, not measured by me

Re-measure before you attribute anything to this diff. Every row below reproduced
for the dev leg; if a row does not reproduce for you, that disagreement is a finding
and I want it in your report.

| gate | reported exit |
|---|---|
| `go build ./...` | 0 |
| `go vet ./...` | **1** |
| `go test ./... -count=1 -skip TestWatchTasks` | 0 |

`go vet` exits 1 on **pre-existing** copylocks, not on anything this diff did. Match
them by MESSAGE, not by count: the text is `assignment copies lock value to ephReq`,
at `internal/server/server.go:{1782, 1892, 2100, 2277}`. The literal string
`copylock` does **not** appear in the output — if you grep for it you will get zero
and conclude the vet is clean. Four request types, four sites. Anything else vet
says is attributable to this diff.

`go test`: `TestWatchTasks` is a known ~8% flake per sequential full-suite run, which
means a single-run mutation matrix carries roughly 1-in-12 odds of a spurious RED.
The dev leg skipped it. If you run the full suite, read failing test **NAMES**, never
counts — a leg last round caught an error in my own gate table by applying that rule
to the table itself.

Go gates in this repo have historically been contingent on an untracked `web/dist`.
If a Go gate fails in a way that looks like a missing web asset, that is pre-existing
(task #100) and out of scope.

## The rules that keep producing findings

**Every zero needs a positive control.** This is now the most productive rule we have
and it has caught four separate instances in this workstream, including two of mine.
A grep that returns 0 because the glob was eaten by the shell, and a `go build ./...`
that returns **exit 0** with `matched no packages` because it was issued from a
subdirectory, are indistinguishable from clean results. Before you record any zero,
establish that the same command returns non-zero for a case you know is present.

**Predict before you measure, and report every miss.** Across recent rounds the misses
have consistently been more informative than the hits. One leg went perfect on
predictions and correctly flagged that as *weak* evidence, because its two real
findings came from exploration rather than prediction. Report your accuracy as a
fraction and do not treat a good score as a result.

**Assert which arm fired.** Overlapping oracle arms mask each other. A differential
that goes RED tells you something reacted; it does not tell you what.

**A count-pin is not evidence of non-vacuity unless a COUNT-NEUTRAL corruption is
also RED.** Holding a count fixed and corrupting identity must go red. A pin that only
reacts to counts is decoration, and we have measured that exact case: 8 of 14 entries
replaced with junk, count held, GREEN.

**If a mutation looks RED, check it is not a build failure.** A build failure counted
as a kill is a false positive in the direction that flatters the code under review.

**Report the number of mutation cells you left dirty after restore.** It is a real
number and I want it.

## Two failure modes of MY briefs, both measured, both recent

1. **I supply an input together with a wrong expected result.** This has now happened
   twice in two branches. In both cases the input was real and the stated consequence
   was wrong, and in one case I had warned the legs about this exact failure mode in
   the same document where I then committed it. Do not take an expected result from me
   as given — take the input and measure the result.

2. **I state the shape of a causal set I have not measured.** I have named one gate
   where there were three necessary contributors, named one decisive verification cell
   where two fail, and warned a leg to expect multiplicity where there was genuinely
   one site. The direction of the error is not predictable, so a correction in either
   direction is unsafe. **Where this brief states a count or names a single locus,
   treat it as unmeasured unless it carries a measurement.** I have tried to mark
   these; assume I missed some.

A numbered list of everywhere this brief is wrong is a **required deliverable** for
every leg. Two of the three legs on the sibling branch found errors that changed what
they measured.

## Independence

Do not read the other legs' reports and do not coordinate with the other legs. Where
you form an impression outside your own axis, label it as an impression rather than a
finding, and say which axis it belongs to.

**I will not treat your approval of something outside your axis as corroboration**, and
you should not offer it as one. This has bitten twice: a leg approved a mechanism
another leg measured broken, and both were right, because the first was fenced out of
the lane where the defect lived.

## Do not

Do not push. Do not modify production code — your independence depends on it. Restore
every mutation cell and report the count you left dirty.
