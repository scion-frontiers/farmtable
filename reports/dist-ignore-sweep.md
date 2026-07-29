# EM-289 — `.gitignore:17` unanchored `dist/`: DETECTION SWEEP + VERIFICATION RECIPE

**Read-only. No deletions, no adds, no changes. Ordered by coordinator 07:57Z.**
Question asked: under a freeze premised on committed work being safe, **has this
already eaten anything?**

---

## 1. RESULT — THREE INTEGERS, AND THE ARITHMETIC CLOSES

Command, pasted, run once per tree:

```
git -C <tree> --no-optional-locks status --porcelain --ignored
  | awk '$1=="!!"{print $2}'
  | awk '/(^|\/)dist(\/|$)/{print}'
```

| | |
|---|---|
| ENUMERATED — ignored paths with a `dist` component, all trees | **139** |
| EXCLUDED — exactly `web/dist` (the intended, legitimate target) | **139** |
| EXCLUDED — `node_modules`-internal | **0** |
| **FLAGGED — `dist`-component, neither of the above** | **0** |

`0 + 0 + 139 = 139 = ENUMERATED`. Closes.

**THE ANSWER IS ZERO. NOTHING HAS BEEN EATEN, IN THE TREES NAMED BELOW.**

## 2. THE POPULATION, BECAUSE THE ZERO IS BOUNDED BY EXACTLY THIS

**229 repositories**: every immediate child directory of `/workspace` containing a
`.git` entry (file or directory), which covers canonical, all linked worktrees that
live as siblings, and all independent clones. 0 timed out; 0 failed. All 229 checked.

Cross-check by a **second, independent instrument** — `[ -d <tree>/web/dist ]`,
which shares no code path with `git status`:

- 139 trees have `web/dist` on disk
- 90 do not
- 139 + 90 = 229, and the 139 is the same 139 that produced the enumerated rows

**WHAT THIS SWEEP CANNOT SEE, STATED BECAUSE IT BOUNDS THE ZERO:**

- Paths that **do not exist right now**. `status --ignored` enumerates the working
  tree. A file that was ignored and has since been deleted leaves no trace here.
  Per the standing rule, a file never added cannot be missed — but it also cannot
  be counted, and this instrument is on the wrong side of that.
- Anything under an **already-ignored collapsed directory**. Traditional
  `--ignored` prints `web/dist/` as one row, not its contents.
- **Nested repositories** below the first level. The enumeration is immediate
  children of `/workspace` only.
- Read-only was **measured, not assumed**: `.git/index` mtime and size identical
  before and after (`1785183822 51441` → `1785183822 51441`). `/workspace/farmtable-em-verify195`
  is inside the enumerated population; it was read and not written.

### 2a. LABEL THE NOUN — **229 IS A WORKING-TREE COUNT AND IS NOT A STORE COUNT**

**DO NOT CITE 229 NEAR A DURABILITY NUMBER.** Four numbers are in circulation tonight
wearing one label, and they are not four estimates of one quantity. Decomposed:

```
per immediate child of /workspace with a .git:
  test -d .git   vs   test -f .git   vs   test -f .git/objects/info/alternates
```

| noun | count | |
|---|---|---|
| **WORKING TREES** with a `.git` entry | **229** | ← my sweep's noun, and the right one for *"has this eaten anything"* |
| of those, `.git` is a **DIRECTORY** | **112** | ← matches the census's re-measurement of **112** |
| of those, `.git` is a **FILE** (linked worktree, shares canonical's store) | **117** | |
| **INDEPENDENT OBJECT STORES** = 112 − 3 borrowing via alternates | **109** | ← matches the sweep leg's **108 + em = 109** |

`112 + 117 = 229`. `3 + 109 = 112`. Both close.

The three trees borrowing objects via `objects/info/alternates`, all pointing at
`/workspace/farmtable/.git/objects` — enumerated, not counted, per the ten-or-fewer rule:
`farmtable-audit-xss-r6`, `farmtable-review-xss-r6`, `farmtable-test-xss-r6`. **These are
exactly the three r6 trees the coordinator predicted from the mechanism.** A summed union
over stores would count their objects up to four times.

**THE REMAINING GAP IS 9 (103 published vs 112) AND I HAVE NOT MEASURED WHAT ACCOUNTS
FOR IT.** Store growth is the obvious candidate and it is *true* — 18 of the 112 were
born 07:00–08:59Z, 11 in the 06:00 hour, 83 earlier. **But 18 > 9, so growth
over-explains the gap, which means timing alone cannot be the answer** without the
census's publication timestamp, and the noun may differ as well. Recorded as an open
number rather than a closed one, precisely because the partial cause is true and that is
what would stop the search.

---

## 3. THE VERIFICATION RECIPE — THIS TRAVELS WITH THE FINDING OR THE FINDING DIES

**THE OBVIOUS COMMAND RETURNS THE WRONG ANSWER.**

**CORRECTION, 2026-07-29 — AN EARLIER VERSION OF THIS LINE READ "WITH EXIT CODE 0 AND
NO WARNING". THAT WAS FALSE AND I ASSERTED IT RATHER THAN PASTING IT (§26).** Two legs
caught it. The exit code is **not** a constant: it tracks the same disk dependence the
output does. Measured, both forms, both tree states, below.

**AND THE CORRECTION CUTS THE OTHER WAY FROM THE REASSURING READING.** The correction
offered to me was that the status is trustworthy and only the human-readable output
misleads. That is wrong and it is the dangerous direction: **rc=1 is indistinguishable
from "correct command, path genuinely not ignored"**, so anyone who scripts the directory
form and branches on the exit code gets a clean-looking rc=1 and concludes the rule does
not apply. **THE SCRIPTED FORM IS THE MORE DANGEROUS ONE, NOT THE SAFER ONE.**

A trailing-slash pattern matches **directories only**, and `git check-ignore`
decides whether a path is a directory **by looking at disk**. In a clone where
`web/dist` has never been built, the path does not exist, git treats it as a file,
`dist/` does not match, and you are told the rule does not apply.

Measured on two of our own trees, same invocation, same commit:

| tree | `web/dist` on disk | `check-ignore -v web/dist` | `check-ignore -v web/dist/index.html` |
|---|---|---|---|
| `/workspace/farmtable` | YES | rc=**0**, prints the rule | rc=0, prints the rule |
| `/workspace/farmtable-xss-r7-review` | NO | rc=**1**, empty ← wrong | rc=0, prints the rule ← true |

Negative controls `notdist/x` and `distant/x`: rc=1, empty, in **both** trees — which is
the point. In the clean clone the hazard case and the control case are byte-identical in
both output and exit status.

**THE POLARITY IS THE FINDING: THE INSTRUMENT GIVES THE REASSURING ANSWER PRECISELY IN THE
CLEAN CLONE WHERE NOBODY HAS BUILT YET** — that is, in exactly the tree a reviewer or a CI
job uses to check it. Of 229 repositories on this host, 139 have `web/dist` on disk and 90
do not; the 90 are the ones that lie.

**RECIPE: ask about a path INSIDE the directory, never the directory itself, and keep the
negative controls in the same invocation.** If you refute this item, refute it with the
inside-path form and show the controls — otherwise you have measured your clone's build
state, not the ignore rule.

Negative control in both, correctly NOT ignored: `notdist/x`.

**RECIPE:**
1. Ask about a path **inside** the directory — `web/dist/index.html` — never the
   directory itself.
2. Keep decoys in the same invocation: `notdist/x`, `distant/x` must come back NOT
   ignored, or the filter is matching more than you think.
3. State that the directory-path form returns the wrong answer in a fresh clone.

**WHY THE POLARITY IS THE WHOLE PROBLEM:** the instrument gives the reassuring
answer precisely in the clean clone where nobody has built yet, and the true answer
only where the hazard is already present. **90 of our 229 trees are in the
reassuring state, including all three live r7 review trees.** Anyone verifying this
in the morning, in a fresh checkout, gets "already safe" from a correct command with
a zero exit code. They will be careful, and they will be wrong.

*(Trap identified by another leg under coordinator dispatch; reproduced here on our
own trees rather than accepted on report.)*

---

## 4. DISPOSITION

**DO NOT CHANGE `.gitignore` TONIGHT** (coordinator ruling, 07:57Z). Anchoring
`dist/` to `/dist/` un-ignores `web/dist`, which is reached by a `go:embed` and is
unmeasured; main is red; two gate steps have never executed on main. An obvious
one-line fix, landed at this hour, on a dependency nobody has measured, is how the
next defect gets in.

Routed to **build/packaging**; leads the operational half of the morning packet.
Sections 1–3 of this file go into the packet **as one block** — the claim and its
recipe do not travel separately.
