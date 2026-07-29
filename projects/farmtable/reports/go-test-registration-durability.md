# Durability, sweeps and bundle: leg `go-test-registration`

Companion to `go-test-registration.md`. Leg tree: `/workspace/farmtable-reg-goleg`.
Base SHA: `2982ffd8f3f6e231d8855b9cae7c448c2bd3144f` (main, resolved BY NAME — see §5).

## 1. The durability finding (the number that matters)

Predicate as corrected by the EM: **is this object absent from every store outside my
container?**, tested with `git cat-file -e` against `/workspace/farmtable`, stderr visible.

| Quantity | Value (as measured ~15:35Z) | Value (re-measured 16:05Z) |
|---|---|---|
| Commits reachable from all refs + HEAD in my leg | **739 commits** | **739 commits** |
| Present in `/workspace/farmtable` | **737 commits** | **739 commits** |
| **ABSENT — exist only in my container** | **2 commits** | **0 commits** |

The two:

```
32255b0  ci(manifest): register the 45 executed-but-unlisted Go tests
e374367  docs(project-log): record the both-directions Go test membership diff at 2982ffd
```

**Both are now PRESENT in canonical and ref-pinned** — the 2 → 0 change is the EM's
rescue fetch landing, not a re-measurement artefact. Attributed rather than assumed:

```
refs/em-net/preserve/rescued/32255b0-gotest-registration          -> carries 32255b0
refs/em-net/preserve/rescued/e374367ebfdc676f24f86e93346a60a9f232e2c6 -> carries e374367
refs/em-net/preserve/legfetch/reg-goleg/heads/go-test-registration    -> carries both
```

`e374367` — the one I flagged as absent from the rescue list, being the *child* of
`32255b0` and therefore not carried by pushing the parent — now has a rescued ref of its
own. The flag was acted on.

The two `fatal: Not a valid object name …` lines the original run produced on stderr
**are the finding**, not a malfunction. They were left visible deliberately; suppressing
them would have turned the measurement into a silent 739/739. ~~And they are the proof
that those 2 were absent~~ — **they are not.** See §9: those fatals were rc=**128**, which
under the peeled spelling is also what a *malformed question* returns. The original
instrument could not distinguish the two. Re-measured with the bare spelling, which
separates them: 739 rc=0, 0 rc=1, **0 rc=other** — so the original 2 were genuinely
absent and the number was right, but the evidence I offered for it could not have shown
that. Struck, not deleted.

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
mistaken. `git bundle list-heads` confirms `refs/preserve/` refs **are** in the bundle
(5 of them). What I had actually measured was `git clone`'s refspec, not bundle content.
Corrected below and struck rather than deleted.

But separating "bundle contains it" from "restore method returns it" exposes a real hole.
Purpose-built case: commit `U`, reachable from **no branch**, reflogs expired, promoted
to `refs/preserve/unreachable/<U>`, bundled with `--all HEAD`.

| Step | Result |
|---|---|
| `refs/preserve/` refs present in bundle (`bundle list-heads`) | **YES** — retraction confirmed |
| Restore via **`git clone <bundle>`** — refs restored | 3, **none of them `refs/preserve/` refs** |
| Restore via `git clone` — is object `U` present? | **YES** (a bundle is a packfile; clone takes all objects) |
| …but is `U` reachable from any ref there? | **NO — unreachable/dangling again** |
| …so `git gc --prune=now` in the restored repo | **DESTROYS `U`** |
| Restore via `git init --bare` + `git fetch <bundle> 'refs/*:refs/*'` | **2 refs, including `refs/preserve/` refs; `U` reachable and gc-proof** |

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

- 215 refs restored (216 minus HEAD, which is not a ref), including all 5 `refs/preserve/` refs
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

## 9. NEW: the `^{commit}` peel destroys the absent/malformed discriminator (defect 10)

Adopting the EM's defect 1 (the peel changes the exit code, so `[ $rc -eq 1 ]` silently
stops firing). Checked against my own work and it goes further than stated.

**My probes were safe from the stated form** — every one bound the branch to the command
itself (`if git … cat-file -e "${s}^{commit}"; then … else … fi`), never to `[ $rc -eq 1 ]`.
So no number in this note was produced by a control that failed to fire. But the peel
cost me something else.

Measured on canonical, rc captured directly, unpiped, stderr visible:

| Spelling | present 40-hex | absent 40-hex | malformed string |
|---|---|---|---|
| `cat-file -e <sha>` | **rc=0** | **rc=1** | **rc=128** |
| `cat-file -e <sha>^{commit}` | **rc=0** | **rc=128** | **rc=128** |

The bare spelling has **three** distinguishable outcomes. The peeled spelling has **two**:
it collapses *absent* into the same code as *I asked a malformed question*. That is
exactly the discriminator the standing rule depends on — "a suppressed exit 128 means
YOUR QUESTION was malformed". **Under the peel there is no exit code that means "your
question was malformed", because absence already claims it.** Anyone who adopted the peel
today lost the ability to tell a durability finding from a typo, a wrong path, or a
zsh-mangled argument, and the failure presents as a *finding* — an inflated ABSENT count,
which reads as important rather than broken.

Prefer the **bare** spelling for existence probes and classify on the rc *value*
(`0`/`1`/`other`), keeping `other` as a visible third bucket. Re-running my sweep that way
gave `rc=other: 0`, which is what retroactively licenses the original figure.

**And a zsh interaction nobody has reported yet.** With `extended_glob` set, `^` is the
glob-negation operator, so an **unquoted** peel is a pattern:

```
setopt extended_glob
git cat-file -e ${S}^{commit}     # S is a PRESENT commit
#   zsh: no matches found: 2982ffd…^{commit}
#   rc=1   <-- git never ran
```

The command aborts before git is invoked and zsh returns **rc=1** — which is the bare
spelling's code for **ABSENT**. So a present, durable object reports absent; an
`|| echo AT-RISK` branch takes the wrong arm; and `[ $rc -eq 1 ]`, the very control the
EM says stops firing under the peel, *fires* — on a shell error. Both directions of the
same construct, opposite failure modes, same day.

The clean rule, because it needs no judgement: **a peeled probe can only ever return 0 or
128. `rc=1` from a peeled probe is proof that git did not run.** Treat it as a shell
fault, never as an answer. (`extended_glob` is not set in my shell — verified with
`setopt` — so this did not touch my numbers. Quoting the argument, which I did
throughout, also defeats it.)

**Defect 2 (`rev-parse` echoing a bad pathspec to stdout) does not touch my work.** I
never used `rev-parse "<rev>:<path>"`; content lookups went through `git show` and
`git cat-file -e <sha>:<path>` with the result bound to the command, not to a
string-compare against a sentinel. Swept the transcript to confirm rather than recalling it.

**Path-coordinate table, my row, re-verified against the linked-worktree trap:** my clone
is a real clone, not a worktree — `--absolute-git-dir` is
`/workspace/farmtable-reg-goleg/.git`, `--git-common-dir` resolves to its own `.git`
(not canonical's), there is **no** `objects/info/alternates`, and `.git`, `.git/objects`
and `.git/objects/pack` are all st_dev **2049**. So the objects are where the directory
is; nothing of mine is reachable only by sweeping canonical, and nothing of mine sits on
an overlay.

## 10. The population control: store-level, not reachability-level

The durability figures in §1 were built from `rev-list --all HEAD` — a **reachability**
population. Per the EM (via `ts-diff-r8`, whose population was wrong by a factor of two
while its answer stayed bit-identical at 0), the population needs its own control,
because *a zero over 1 and a zero over 672 are the same string*.

Re-derived from the object store:

| Spelling | Result |
|---|---|
| `for-each-ref` | 215 refs |
| `rev-list --all HEAD` | **739 commits** |
| `cat-file --batch-all-objects` | **739 commits** (5,607 objects: 1,954 blob, 2,914 tree) |

Identical. My leg holds **zero unreachable commits**, so the factor-of-two does not apply
here. This corroborates something already published in §6 for an unrelated reason: the two
bundles were byte-identical *because* `--all` had no unreachable objects to drop. Same
fact, two instruments, agreeing.

**But 739 = 739 is itself a zero, so the spelling was canaried rather than trusted.**
Purpose-built repo, commit created → `reset --hard` → reflog expired:

| Spelling | Commits | Sees the doomed commit? |
|---|---|---|
| `rev-list --all HEAD` | 1 | **NO** — reachability spelling blind, as expected |
| `cat-file --batch-all-objects` | 2 | **YES** — store spelling lit |

The two demonstrably diverge when there is anything to diverge on. So the agreement is a
measurement, not two broken instruments returning the same string.

Probe re-run over the store-derived population, bare spelling, three visible rc buckets,
all three controls printing rc unconditionally:

```
POS canonical main    rc=0        NEG fabricated 40hex  rc=1
MALFORMED zzzznotasha rc=128      (fatal left visible)
population 739  ->  rc=0 PRESENT 739 | rc=1 ABSENT 0 | rc=other MALFORMED 0
```

### Stashes — 0, reported with their population

| Probe | rc | Result |
|---|---|---|
| `git stash list` | 0 | **0 entries** |
| `git log -g refs/stash` | **128** | fatal left visible: *ambiguous argument 'refs/stash'* — ref does not exist, 0 tips |
| `git rev-parse --verify refs/stash` | **128** | *Needed a single revision* |

The stronger form, which does not depend on `refs/stash` existing: **a stash is commit
objects.** The store holds 739 commits and reachability holds 739, so there is no room for
a stash commit to hide — not an orphaned one, not one whose ref was deleted. The
coordinator's 15-of-17 stash-type recoveries have no analogue here, and that is asserted
from the object store rather than from the absence of a ref.

## 11. Defect 12 (`for-each-ref` glob) — numbers clean, **recipe was not**

The EM's defect 12: `for-each-ref`'s `*` does not cross `/`, so a nested namespace returns
a clean, confident zero — rc=0, no stderr. Reproduced here, same namespace, four spellings:

| Spelling | Refs |
|---|---|
| `for-each-ref 'refs/preserve/*'` | **0** ← silent zero |
| `for-each-ref 'refs/preserve/**'` | 5 |
| `for-each-ref refs/preserve/` | 5 |
| `for-each-ref refs/preserve` | 5 |
| `rev-list --glob='refs/preserve/*'` | 469 commits (recursive — hence the disagreement) |

My refs are `refs/preserve/reflog/<sha>` — two levels deep, so the single star misses all
five.

**No number of mine is affected.** Swept the transcript rather than recalling it: all six
`for-each-ref` invocations I ran used `**` or a bare prefix, never a single star. The
load-bearing one was re-verified by restoring the bundle again: 215 refs total,
`refs/preserve/` bare-prefix = **5**, `**` = 5, and `'refs/preserve/*'` = **0** on the same
repo in the same breath. The 215 in §10's population control came from a bare
`for-each-ref` with *no pattern*, so it is not the silent zero the EM warned about.

**But the prose was the hazard.** This note and the main report both wrote the namespace as
`refs/preserve/*` in running text seven times. The measurements were right; the *recipe*
was wrong, and the recipe is the part that outlives the measurement. All occurrences now
read `refs/preserve/`. Recorded rather than quietly fixed, because "my numbers were fine"
is not the same as "what I published was safe to copy".

## 12. Defect 13 (NEW): the object-typed gate, written with `--batch-check`, is defect 10 again

Ran `test-xss-r8`'s object-typed gate over the whole store, with the controls **injected
into the same input stream** so they travel the identical code path rather than a parallel one:

```
2982ffd…    -> commit      POSITIVE
0000…0001   -> missing     NEGATIVE   (fabricated 40-hex)
zzzznotasha -> missing     MALFORMED  <-- SAME TOKEN
```

`--batch-check` has **two** outcomes where bare `cat-file -e` has three: it collapses
*absent* into the same `missing` as *your question was malformed*, with overall **rc=0 and
empty stderr**. That is precisely the §9 collapse in a different instrument — and it lands
inside the gate adopted to replace commit-typed enumeration. Two of the three arms returned
an identical token; by the EM's own rule that pair carried no information, and only the
positive arm did.

Bare `-e` keeps all three buckets *and* works on non-commit types, which is the entire
point of going object-typed: blob **rc=0**, tree **rc=0**, fabricated 40-hex **rc=1**,
malformed **rc=128**. Specify bare `-e` classified on rc `0`/`1`/`other`, or pre-validate
input as 40-hex so `missing` can only ever mean absent.

### The object-typed durability result

| Quantity | Value |
|---|---|
| Population (store objects, `--batch-all-objects`) | **5,607** — 739 commit, 2,914 tree, 1,954 blob |
| ABSENT from `/workspace/farmtable` (st_dev 2049, host-backed) | **0, in every type** |
| Lines in → lines out | 5,607 → 5,607, **checked not assumed** |
| 200-object random sample re-probed with bare `-e` | 200 rc=0 / 0 rc=1 / 0 rc=other |
| Stashes | **0**, with no room to hide: store commits 739 = reachable commits 739 |

The earlier commit-typed zero was not concealing trees or blobs. `test-xss-r8`'s yield of
11 trees and 7 blobs has no analogue here — and that is now asserted *from the object
store*, not from a commit-shaped enumerator.

Reproduce the whole measurement:

```
git clone --no-local --branch main /workspace/farmtable <leg>   # LOCAL path, not the network remote
git -C /workspace/farmtable rev-parse main                      # resolve main BY NAME
export LC_ALL=C
go test ./... -v > go-test.log 2>&1                             # stderr NOT suppressed
# then ci.yml's own RUN/SKIP awk -> ran/skipped -> executed-go-tests.txt
```
