# _r8-PHASE-TWO — DO NOT OPEN UNTIL YOUR COLD PASS IS WRITTEN TO DISK

If your own findings are not yet on disk, close this file. The cold pass cannot be recovered once
this content is in your head, and the cold pass is the most valuable thing you produce.

## 1. PRIOR ARTEFACTS — READ AFTER YOUR COLD PASS, THEN RECONCILE

Round 7 was reviewed three ways at `e4e3d13`. Reports, all under
`/scion-volumes/scratchpad/projects/farmtable/reports/`:

- `review-xss-r7.md`
- `audit-xss-r7.md`
- `test-xss-r7.md`
- `_ADJUDICATION-xss-r7.md` — my ruling on those three, and the instruction set the r8 fix leg worked from.

**Per finding, state whether you found it independently, MISSED it, or DISAGREE with it.** Missing
one is a normal result and I want it recorded, not softened. Disagreeing is the most valuable of the
three.

## 2. WHAT THE FIX LEG SAYS IT DID — VERIFY, DO NOT ACCEPT

`dev-xss-r8` reports the round CLOSED at `901670e`, ten commits, not pushed. Its own summary of the
ten, in its words, which I am relaying as CLAIMS:

| commit | claim |
|---|---|
| `d739c06` | Item 1: re-anchor citations by identifier, never by line number |
| `253ab14` | Item 3: drop the producer count from `capabilities.ts` |
| `3961f30` | Item 4: `doc.go` states no limit count, and the third limit is written down |
| `6a0b8bd` | Item 2: a regression guard for basename pruning **that actually goes red** |
| `af9ea8c` | audit F1: require GITHUB platform in `isCollectionWritable` |
| `5e8b826` | audit condition 6a: distinguish the planted key from `writable` |
| `4026dca` | re-anchor two producer-census citations by identifier |
| `6e2c4aa`, `1cba5b5`, `901670e` | project log, then two rounds of self-correction to it |

**A SELF-REPORT IS A CLAIM AND INHERITS EVERY DUTY OF ONE.** Note that the last two commits are the
leg correcting its own log — read what it corrected and decide whether the correction is right. **A
CORRECTION IS A CLAIM LIKE ANY OTHER, AND IT ARRIVES IN THE POSTURE OF HAVING JUST BEEN CAREFUL.**

### 2.1 THE ONE VERIFICATION I HAVE SEEN EVIDENCE FOR, AND ITS BOUND

The leg reports **F1 VERIFIED with both control arms**: a near-miss planted on the F1 line went RED
at `ft-app.ts(278,36)`, and the guard admits the positive case. I have seen that in its message; I
have not re-run it. **[DERIVED, from the leg's report — not my measurement.]**

**AND THE BOUND MATTERS MORE THAN THE RESULT.** The leg measured, and I am relaying because it
corrects me:

```
tsc -p tsconfig.test.json --listFiles | grep -c ft-app.ts   ->  0
tsc --noEmit             --listFiles | grep -c ft-app.ts   ->  1
```

`tsconfig.test.json` has `include: src/**/*.test.ts`, and **no test imports `ft-app.ts`**. So the
typecheck that `npm test` runs **DOES NOT REACH THE FILE THE F1 FIX IS IN.** The full-project
`tsc --noEmit` does.

**I TOLD THAT LEG SOMETHING FALSE ABOUT THIS AND IT CORRECTED ME.** I said `npm test` runs Vitest and
does not typecheck. There is no Vitest in the package and `npm test` DOES chain `tsc`. My ruling was
right for a reason I had not given. **TREAT MY VERSION AS RETRACTED AND THE LEG'S AS THE MEASUREMENT
— and re-measure it yourself if it is load-bearing for you.**

## 3. FOUR ITEMS THE FIX LEG HANDED BACK OPEN. THESE ARE NOT SETTLED.

**OP-1.** Zero test coverage on `getCapabilities` and `isCollectionWritable`. The leg reports it did
not add any. Open question I have NOT ruled on: route to a follow-up, or widen here.

**OP-2.** **17 line-number citations remain** in the tree, against the §30 rule (cite by identifier,
never by line number). The leg re-anchored some and left 17. I have not verified the 17.

**Conditions 5 and 6b (F2 and F9)** were routed away from this round by my own instruction. The leg
notes: *"those instructions conflict and I obeyed the routing."* **IF YOU FIND THAT THE ROUTING WAS
WRONG, SAY SO** — a defect deferred by my instruction is still a defect, and my instruction is a claim.

**No whole-tree Go build.** Covered in `_r8-COMMON.md` §4. It is UNMEASURED.

## 4. KNOWN — DO NOT SPEND TIME RE-DISCOVERING. DO CORRECT ME IF ANY OF IT IS WRONG.

- **`internal/server/scopes.go` is gofmt-dirty at HEAD and is untouched by this branch.** Not this
  round's defect. Two legs have now independently sighted it. **DO NOT FIX IT** — the second
  independent sighting is corroborating evidence and fixing it destroys the corroboration.
- **`scripts/ci-suite-manifest.mjs`** has an outstanding fix routed to a leg working on real `main`.
  Not this round's.
- **A second Go-side consumer of collection `remote_data` exists at `graph_support.go`, function
  `collectionSupportsGraph`.** Filed, routed off this round.
- **Real `main` is `cc92735` and CI EXISTS** (`.github/workflows/ci.yml`). Anything in-tree claiming
  there is no CI is describing an older commit. **Your clone's refs are from canonical and canonical
  is STALE relative to real main.** Do not derive anything about main from this tree without saying so.
- **`.gitignore` line 17 is `dist/`, UNANCHORED**, so it matches at any depth and anything under any
  `*/dist/` is invisible to `git status`. Routed as shared infrastructure, out of scope here.
  This is a POINTER, not an authorisation: **`git add -A` and every other bulk capture remains
  PROHIBITED**, and the spelling is quoted as evidence, deliberately not rewritten.

  **IF YOU GO TO CHECK THAT — AND YOU MAY — THE OBVIOUS COMMAND RETURNS THE WRONG ANSWER IN YOUR
  TREE, AND IT RETURNS IT REASSURINGLY.** A trailing-slash pattern matches directories only, and
  `check-ignore` decides directory-ness **by looking at disk**. Your tree is a fresh clone where
  `web/dist` has never been built, so git treats the path as a file and the rule does not match:

  | tree | `web/dist` on disk | `check-ignore web/dist` | `check-ignore web/dist/index.html` |
  |---|---|---|---|
  | a tree that has built | YES | rc=0, prints the rule | rc=0, prints the rule |
  | **your tree** | **NO** | **rc=1, empty** | rc=0, prints the rule |

  **rc=1 IS INDISTINGUISHABLE FROM "correct command, path genuinely not ignored"**, so the SCRIPTED
  form is the more dangerous one, not the safer one. **Ask about a path INSIDE the directory, never
  the directory itself**, and keep negative controls (`notdist/x`, `distant/x` must come back NOT
  ignored) in the same invocation. If you refute this item, refute it with the inside-path form and
  show the controls — otherwise you have measured your clone's build state, not the ignore rule.

## 5. TONIGHT'S APPARATUS FAILURES, BECAUSE THEY WILL BITE YOU TOO

Every one of these was found tonight, on this host, by a leg like you. They are not hypotheticals.

- A leg's mtime differential was **blind to `.git/worktrees/<name>/`** and it published a clean
  differential that was missing half the writes. **That leg was me.**
- A leg published **41 commands / 91 occurrences** and the true figure was **2 / 16**. Another
  published 98 where the truth was 3. Another counted its own canaries. **All four were
  self-incriminating over-counts, and NOT ONE was found by its author.**
- A "boundary control" was mandated three times in forty minutes and was **wrong all three times** —
  once unsound, once unexecuted, once resting on a mechanism that measurement falsified.
- **A units error in a set-difference presented as TOTAL DISAGREEMENT with both sides populated**, and
  the mandated non-emptiness precondition could not see it. `find -printf %d` counts depth **from the
  start point**, so two different start points are not commensurable.
- An **exclusion mandated for safety silently became a selector** on every count derived from the same
  pass, and the number was published without the qualifier.

**THE COMMON SHAPE: THE INSTRUMENT WAS NEVER CONTROLLED BEFORE USE, AND A CLEAN RESULT IS THE ONE
OUTCOME THAT NEVER PROMPTS ANYONE TO GO AND CHECK THE INSTRUMENT.**

So: **arm your controls BEFORE you run the sweep, in pairs, and publish them whether they pass or
fail.** If your control cannot be constructed, say so and stop.
