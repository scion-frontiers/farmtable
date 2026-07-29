# Durability, sweeps and bundle: leg `go-test-registration`

Companion to `go-test-registration.md`. Leg tree: `/workspace/farmtable-reg-goleg`.
Base SHA: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` (main, resolved BY NAME — see §5).

## 1. The durability finding (the number that matters)

Predicate as corrected by the EM: **is this object absent from every store outside my
container?**, tested with `git cat-file -e` against `/workspace/farmtable`, stderr visible.

| Quantity | Value |
|---|---|
| Commits reachable from all refs + HEAD in my leg | **739 commits** |
| Present in `/workspace/farmtable` | **737 commits** |
| **ABSENT — exist only in my container** | **2 commits** |

The two:

```
32255b0  ci(manifest): register the 45 executed-but-unlisted Go tests
e374367  docs(project-log): record the both-directions Go test membership diff at 2982ffd
```

The two `fatal: Not a valid object name …` lines this produced on stderr **are the
finding**, not a malfunction. They were left visible deliberately; suppressing them
would have turned the measurement into a silent 739/739.

I did **not** run the withdrawn ancestry-against-`origin/main` test as a durability
claim, so there is no 127-style false-positive figure to report here.

## 2. Sweeps: what each caught in MY leg

| Sweep | Refs created | Caught |
|---|---|---|
| (a) `git fsck --unreachable --dangling` | **0** | nothing |
| (b) reflog sweep | **5** | 5 commits, **all already reachable** |

Honest reading: **my leg had nothing hidden.** All 5 reflog commits (`2982ffd`,
`32255b0`, `633f8f2`, `e374367`, `eca9239`) were already reachable from existing refs,
so the preserve refs are redundant insurance, not a rescue. I ran both sweeps anyway.

## 3. NEW: sweep (a) is near-useless in a live container — and (b) is doing all the work

The recipe attributes "reset/abandoned-rebase tips" to sweep (a). **Measured on a
purpose-built repo, that is false while reflogs are intact**, which is every leg's state
at bundling time.

Two canaries: `C1` created then `git reset --hard`ed away; `C2` created then
`git commit --amend`ed away.

| Reflog state | (a) fsck sees C1 | (a) fsck sees C2 | (b) reflog sweep |
|---|---|---|---|
| **intact** (normal live container) | **NO** | **NO** | **both** |
| after `reflog expire --expire=now --all` | YES | YES | **neither** (reflog emptied) |

Both objects existed throughout; only their discoverability changed. The mechanism is
the one the EM already named — **fsck treats reflogs as reachability roots** — but the
recipe does not follow that premise to its conclusion. A reset-away tip is *not*
unreachable to fsck while its reflog entry survives.

So (a) and (b) are complementary **across the reflog-expiry boundary, not across commit
type**. In a live container (a) returns empty, exit 0, and reads as "nothing to
preserve". A leg that ran only (a) — believing the recipe's attribution — would preserve
nothing and report clean. That is the seventh defect's shape again: zero-with-exit-zero.

Practical consequence: **(b) is the load-bearing sweep; (a) only earns its place after a
gc/reflog expiry has already happened.** Keep both — (a) costs nothing and covers the
post-expiry case — but do not read (a)'s zero as evidence of anything.

## 4. NEW: the prescribed verification passes on a repo that is one `gc` from losing the commit

**The EM's retraction of defect 3 is correct and my initial alarm was wrong.** I first
reported "preserve refs did not survive the restore: count 0" — ~~that reading~~ was
mistaken. `git bundle list-heads` confirms `refs/preserve/*` **are** in the bundle
(5 of them). What I had actually measured was `git clone`'s refspec, not bundle content.
Corrected below and struck rather than deleted.

But separating "bundle contains it" from "restore method returns it" exposes a real hole.
Purpose-built case: commit `U`, reachable from **no branch**, reflogs expired, promoted
to `refs/preserve/unreachable/<U>`, bundled with `--all HEAD`.

| Step | Result |
|---|---|
| `refs/preserve/*` present in bundle (`bundle list-heads`) | **YES** — retraction confirmed |
| Restore via **`git clone <bundle>`** — refs restored | 3, **none of them `refs/preserve/*`** |
| Restore via `git clone` — is object `U` present? | **YES** (a bundle is a packfile; clone takes all objects) |
| …but is `U` reachable from any ref there? | **NO — unreachable/dangling again** |
| …so `git gc --prune=now` in the restored repo | **DESTROYS `U`** |
| Restore via `git init --bare` + `git fetch <bundle> 'refs/*:refs/*'` | **2 refs, including `refs/preserve/*`; `U` reachable and gc-proof** |

**The prescribed check passes on the deficient restore.** `cat-file -e` answers YES after
a `git clone` restore, so a leg follows the recipe exactly, sees its commit, reports
clean — and hands over a repo where the preserved orphan is once again a dangling object
that routine maintenance deletes. That is precisely the exposure the EM identified in
canonical ("not container deletion — a routine maintenance command"), reproduced *inside
the verification step written to rule it out*.

**Corrected instruction:** restore with

```
git init --bare <tmp>
git -C <tmp> fetch <bundle> 'refs/*:refs/*'
```

then assert the **ref**, not just the object — and ideally run `gc --prune=now` and
re-assert, which is the only check that distinguishes "object is here" from "object is
anchored".

## 5. Traps (a) and (b) from the EM, checked against my own work

**Trap (a) — resolving main.** I resolved main **by name** throughout:
`git -C /workspace/farmtable rev-parse main` → `2982ffd8…`. I never used `FETCH_HEAD`
or `origin/HEAD` for the base. Confirming the trap is live in this repo:
`refs/remotes/origin/HEAD` in my leg points at **`task-state-web-ui-v2`**, and
`633f8f2` — canonical's HEAD-side feature-branch tip — surfaced in my own reflog sweep
from the clone entry. A leg testing ancestry against fetched HEAD here would have
measured that branch and exited clean against the wrong thing.

**Trap (b) — `cmd | tail -N; echo $?` reports tail's status.** ~~I used this form and
reported `clone exit=[0]`~~ — **that value was `tail`'s exit status, not `git clone`'s,
and should not have been reported as a clone result.** Struck, not deleted. Every exit
status in this note and in the re-verification was subsequently captured **directly**
from the command, unpiped. The clone did in fact succeed, but the evidence I first
offered for it did not show that.

I also used `| tail -N` on several `git commit`/`git clone` invocations earlier in the
task. Those commits are independently confirmed by `git log`, `git show --numstat` and
the restore test, so no conclusion rests on a piped exit status.

**Reference set.** I did not claim "on origin". The durability predicate was run against
`/workspace/farmtable` **by path**, which is the canonical store, and I make no claim
about GitHub. Note that both my leg and canonical live under `/workspace`; the bundle in
`/scion-volumes/scratchpad` is the copy that is genuinely outside the working tree.

## 6. Bundles on disk — both left in place, delta auditable

`/scion-volumes/scratchpad/projects/farmtable/bundles/`

| File | Bytes | Refs |
|---|---|---|
| `go-test-registration.all-only.bundle` (`--all`) | **3,076,269** | **216** |
| `go-test-registration.bundle` (`--all HEAD`) | **3,076,269** | **216** |

**Byte-identical, and the reason is measured, not assumed:** my HEAD is *attached* to
`refs/heads/go-test-registration`, so `--all` already covers it, and my leg has **0**
unreachable objects for `--all` to drop. The EM's 2,867,963 → 3,853,025 delta came from a
leg that had 308 unreachable commits; the variable was reachability, exactly as the
retraction states. With nothing unreachable, there is no delta to find. I report the
absence of a delta as a measurement, not as a null result.

Verified **by restore**, using the corrected method (§4):

- 215 refs restored (216 minus HEAD, which is not a ref), including all 5 `refs/preserve/*`
- both container-only commits present
- both **survive `reflog expire --all` + `gc --prune=now`** in the restored repo
- payload intact: manifest reads **548 rows** at `32255b0`, and
  `git show --numstat` in the restored copy still reads `45  0`

## 7. Non-ref artefacts — what no bundle carries

| Artefact | Location | In a ref? | Durable? |
|---|---|---|---|
| Project log entry | committed at `e374367` | **yes** | yes — in the bundle |
| `go-test-registration.md` | `/scion-volumes/scratchpad/.../reports/` | no | yes — shared volume |
| This note | `/scion-volumes/scratchpad/.../reports/` | no | yes — shared volume |
| Both bundles | `/scion-volumes/scratchpad/.../bundles/` | n/a | yes — shared volume |
| `go-test.log`, `executed-go-tests.txt`, `A-*.txt`, `class-raw.tsv` | leg working tree, untracked | **no** | **NO — dies with the container** |

The measurement scratch files are **not** preserved and are reproducible from §8.

**My arms did produce commits** (2 of them), so this is not a nothing-to-bundle report.

## 8. Arm definitions and expected red targets

Written out because prose is what gets re-derived in three weeks. Each was run; each
result is in `go-test-registration.md`.

| Arm | Definition | Expected red target | Observed |
|---|---|---|---|
| MISSING | `comm -23 manifest executed` | a registered test that stopped running | 0 — **canaried live** with `TestCanaryDeletedTest`, which it reported |
| UNEXPECTED | `comm -13 manifest executed` | a test running outside the manifest | **45 caught** before commit; 0 after |
| B-direction cross-check | `grep -F -x -v -f` and awk set membership | collation artefact in `comm` | both agree on 0 |
| Parser self-check | `grep -cP '^(ok  \|FAIL\|\?   )\t'` | truncated log / changed `go test` format | 33 lines; aborts at 0 |
| Failure scan | `grep -P '^(--- FAIL:\|FAIL\t\|FAIL$)'` | failing Go tests, all four FAIL forms | 0 |
| `(unterminated)` | package that never printed a result | panic/timeout/truncation | 0 |
| Skip subtraction | `comm -23 ran skipped` | `t.Skip` masquerading as executed | 0 skipped |
| Non-regeneration | `git diff --numstat` | any deletion in the manifest diff | `45  0` |
| Sweep (a) canary | reset-away + amend-away commits | fsck blind while reflogs intact | **both missed** (§3) |
| Sweep (b) | reflog → refs | amended-away tip | 5 refs, all already reachable |
| Restore canary | orphan-only-in-`refs/preserve` | clone-restore losing the ref anchor | **reproduced** (§4) |

Reproduce the whole measurement:

```
git clone --no-local --branch main /workspace/farmtable <leg>   # LOCAL path, not the network remote
git -C /workspace/farmtable rev-parse main                      # resolve main BY NAME
export LC_ALL=C
go test ./... -v > go-test.log 2>&1                             # stderr NOT suppressed
# then ci.yml's own RUN/SKIP awk -> ran/skipped -> executed-go-tests.txt
```
