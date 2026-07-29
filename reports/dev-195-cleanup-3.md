# dev-195-cleanup-3 — closing the G1 sink-binding gap on `markdown-sanitize`

**Branch:** `markdown-sanitize` · **Base:** `5daace4` (verified, clean) · **Head:** `bae4fd0`
**Scope delivered:** all five brief items, plus two bypasses I found in my own fix.
**Production code changed: none.** `git diff 5daace4..HEAD --name-only` returns
exactly two files: `web/src/util/markdown.test.ts` and the new project-log entry.

**Gate:** `npm ci && npm test` on jsdom **26.1.0** — the locked version — plus
`tsc --noEmit`, `npm run build`, `npm audit --audit-level=low`. All exit 0.

`EXPECTED_CHECKS` 49 → **54**.

---

## 0. Pre-flight — the HEAD check, and one correction to the brief

The brief and the EM message both say to run `git rev-parse --short HEAD` in
`/workspace`. **`/workspace` is not a git repository.** It is the parent
directory of ~35 sibling clones:

```
$ git -C /workspace rev-parse --short HEAD
fatal: not a git repository (or any parent up to mount point /)
```

Given the warning that one branch name resolved to four different commits
tonight, I did not guess. I enumerated every clone:

```
farmtable-markdown-sanitize/    5daace4    markdown-sanitize   <-- dev clone
farmtable-review-195/           5daace4    markdown-sanitize
farmtable-audit-195/            9db3e9d    markdown-sanitize
farmtable-test-195/             04abbe7    markdown-sanitize
```

The branch name resolves to **three** distinct commits across four clones. I
worked in `/workspace/farmtable-markdown-sanitize`, the dev clone, which is the
one at the required `5daace4`:

```
HEAD: 5daace4
--- status --porcelain ---
[end status]          <- clean
```

Flagging rather than silently proceeding: if the intended clone was
`farmtable-review-195` (also at `5daace4`), say so and I will move the commits.
Everything below is from the dev clone.

**jsdom in this clone before I touched anything: `26.1.0`** — correct, matching
the lockfile, confirming the EM's finding that the drift is per-clone and this
one was not affected. It is still `26.1.0` after `npm ci`.

---

## 1. Method — how the mutation evidence was produced

Three process rules were called out as live hazards for me specifically. Each is
enforced mechanically rather than by intention.

**Mutations addressed by content, never by line number.** Every substitution is
a literal-string replacement, and the harness **aborts with exit 98 if a
substitution matches nothing**. I verified this rather than assuming it, because
a non-applying mutation otherwise produces a false SURVIVED that looks exactly
like a real finding:

```
=== TEST A: substitution that cannot match must ABORT, not report SURVIVED ===
!!!! SUBST DID NOT APPLY: this string does not exist at line 302
subshell exit=98
```

This mattered in practice: the `D-1` mutation's target text changed shape when
the T4 fix landed, and the harness is content-addressed to both shapes.

**Restore is `cp` from `/tmp/mut-backup`, outside the repo. Never `git
checkout`.** Every restore asserts the tree is clean and aborts the whole run
otherwise:

```
restore() {
  cp "$BACKUP/markdown.test.ts" "$TEST_SRC"   # ... and the two sink files
  dirty=$(git -C "$REPO" status --porcelain)
  if [ -n "$dirty" ]; then echo "!!!! RESTORE FAILED"; exit 99; fi
}
```

Verified live — a stray edit is detected, and `cp` clears it:

```
=== TEST B: restore assertion catches a dirty tree ===
 M web/src/util/markdown.test.ts
after cp restore, status:
(clean)
```

**Each fix was committed before mutations were run against it**, so no mutation
could ever collide with an uncommitted fix.

**`npm ci`, not `npm install`.** Used for the baseline and the final gate.

Harnesses: `/tmp/mut.sh`, `/tmp/battery.sh`, `/tmp/battery-indep.sh`.

---

## 2. PRE-FIX baseline — I reproduced every reported finding at `5daace4`

Before changing anything. Control run: `markdown sanitizer: 49 checks passed`,
`grep -c "  check("` → 49.

```
################ M-G1-1: drop wrapper, no alias  [MUST BE CAUGHT]
Error: 1 of 49 markdown sanitizer checks failed:
  - every unsafeHTML sink routes through renderMarkdown: unsanitized unsafeHTML sink(s): src/components/inspector/ft-inspector-comments.ts -> unsafeHTML(c.body
EXIT=1

################ M-G1-2: alias import in comments.ts (count drops 2->1)  [MUST BE CAUGHT]
Error: 1 of 49 markdown sanitizer checks failed:
  - unsafeHTML call sites are still found: expected at least 2 unsafeHTML call sites, found 1
EXIT=1

################ M-G1-10: NAMED sink comments.ts fully unbound, count still 2
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-3: NEW aliased raw sink, both real sinks intact
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-4: el.innerHTML += body
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-5: el["innerHTML"] = body
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-6: unsafeSVG(body)  [Lit directive]
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-7: el.setHTMLUnsafe(body)
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-8: unsafeStatic(body)  [Lit static-html]
markdown sanitizer: 49 checks passed
EXIT=0

################ M-G1-9: range.createContextualFragment(body)
markdown sanitizer: 49 checks passed
EXIT=0

################ D-1: delete the table payload from the container case list
markdown sanitizer: 49 checks passed
EXIT=0
```

**`test-195-r2` is confirmed in full.** Nine mutations green at exit 0,
including `M-G1-10` — the real named sink rendering attacker-controlled `c.body`
completely raw. The two controls are caught. Tree clean at `5daace4` afterwards.

---

## 3. The five items

### Item 1 — T1 (BLOCKER): G1 now binds the named sinks per file · `849a9da`

Took the supplied shape, verified rather than pasted on trust. Each required
sink is read by explicit path, so a sink that is renamed or rewritten into an
unmatched form throws on `readFileSync` instead of vanishing from a filtered
case list.

I had to add one thing the brief's snippet does not contain. **The snippet alone
does not catch `M-G1-3`** — a *new* file with an aliased raw sink leaves both
real sinks intact, so every per-file assertion passes. Catching it needs the
audit's LOW-1 recommendation (flag files that import the directive but do not
call it by its own name), which the brief also requires via its `M-G1-3`
acceptance criterion. This is a case where the two reports had to be combined:
neither one's fix is sufficient alone.

### Item 2 — T2 (BLOCKER): banned-sink list widened to the union · `fa41008`

**Took the union, not the audit's shorter list.** All eight forms, including
`unsafeSVG(` and `unsafeStatic(`, which the auditor missed entirely.

Replaced the single regex with a named list, so a failure reports *which* sink
matched which file rather than just naming the file — visible in the output in
§4. Added the docblock stating plainly that this is an allowlist of known sinks
and not a proof of absence, since its strength was over-read once already.

Widened `collectSourceFiles` to `.tsx/.js/.mjs/.cjs`. No such files exist today,
so the scanned count is unchanged at 50.

### Item 3 — T3: both counts pinned exactly · `849a9da`

`files.length` was a floor of 10 against an actual 50; `sinks.length` was a
floor of 2 against an actual 2, catching `M-G1-2` only by coincidence. Both now
pinned exactly, `sinks.length` to `REQUIRED_SINKS.length`, each with a failure
message telling the reader to update it deliberately.

### Item 4 — T4: three payloads, three checks · `951ee89`

**Chose hoisting to three `check()` calls over pinning the array length.**
Reason: hoisting puts each payload under the `EXPECTED_CHECKS` pin that already
exists and is already proven to fire. Pinning the array length introduces a
second, parallel counting mechanism that would itself be unguarded — the same
one-level-down problem, one level further down. `EXPECTED_CHECKS` 52 → 54.

### Item 5 — T6: honest name · `64187a0`

Renamed to `formaction cannot survive because its host tag is stripped`, with a
comment stating that both `FORBID_ATTR` entries are deliberate defence in depth,
are not testable in isolation through `renderMarkdown`, and must not be read as
covered. **Config unchanged**, as directed.

### T5 — the one-line recognition note

Added to the section-6 header comment (not at a line number, since those shift):
the regex is a hand-rolled stand-in for the module graph and disagrees with real
language semantics on aliasing, re-export and indirection. Nothing more.

---

## 4. POST-FIX — every mutation green → red

Same harness, same mutations, captured at **`64187a0`** — after the five brief
items landed and before the §5 residual fix. (The check name
`no file aliases or re-exports the unsafeHTML directive` in the output below is
the pre-§5 name, which is how you can tell which commit this transcript is
from.) The whole battery was re-run at `96d26a5` after the residual fix; all 11
are still red, confirmed at the end of §5.

```
################ M-G1-1: drop wrapper, no alias  [MUST BE CAUGHT]
Error: 2 of 54 markdown sanitizer checks failed:
  - src/components/inspector/ft-inspector-comments.ts routes its markdown through renderMarkdown: src/components/inspector/ft-inspector-comments.ts no longer contains unsafeHTML(renderMarkdown(
  - every unsafeHTML sink routes through renderMarkdown: unsanitized unsafeHTML sink(s): src/components/inspector/ft-inspector-comments.ts -> unsafeHTML(c.body
EXIT=1

################ M-G1-2: alias import in comments.ts (count drops 2->1)  [MUST BE CAUGHT]
Error: 3 of 54 markdown sanitizer checks failed:
  - src/components/inspector/ft-inspector-comments.ts routes its markdown through renderMarkdown: src/components/inspector/ft-inspector-comments.ts no longer contains unsafeHTML(renderMarkdown(
  - unsafeHTML call sites are still found: expected exactly 2 unsafeHTML call sites, found 1 — update REQUIRED_SINKS deliberately if a sink was added or removed
  - no file aliases or re-exports the unsafeHTML directive: unsafeHTML imported under an alias or re-exported in: src/components/inspector/ft-inspector-comments.ts
EXIT=1

################ M-G1-10: NAMED sink comments.ts fully unbound, count still 2
Error: 2 of 54 markdown sanitizer checks failed:
  - src/components/inspector/ft-inspector-comments.ts routes its markdown through renderMarkdown: src/components/inspector/ft-inspector-comments.ts no longer contains unsafeHTML(renderMarkdown(
  - no file aliases or re-exports the unsafeHTML directive: unsafeHTML imported under an alias or re-exported in: src/components/inspector/ft-inspector-comments.ts
EXIT=1

################ M-G1-3: NEW aliased raw sink, both real sinks intact
Error: 2 of 54 markdown sanitizer checks failed:
  - sink scan actually reads the source tree: expected to scan exactly 50 source files, found 51 — update EXPECTED_SOURCE_FILES deliberately if a source file was added or removed
  - no file aliases or re-exports the unsafeHTML directive: unsafeHTML imported under an alias or re-exported in: src/components/ft-mutant-sink.ts
EXIT=1

################ M-G1-4: el.innerHTML += body
Error: 2 of 54 markdown sanitizer checks failed:
  - sink scan actually reads the source tree: expected to scan exactly 50 source files, found 51 — ...
  - no raw-HTML sink other than unsafeHTML exists: raw-HTML sink outside renderMarkdown in: src/components/ft-mutant-sink.ts (innerHTML/outerHTML assignment)
EXIT=1

################ M-G1-5: el["innerHTML"] = body
  - no raw-HTML sink other than unsafeHTML exists: ... src/components/ft-mutant-sink.ts (innerHTML/outerHTML indexed assignment)
EXIT=1

################ M-G1-6: unsafeSVG(body)  [Lit directive]
  - no raw-HTML sink other than unsafeHTML exists: ... src/components/ft-mutant-sink.ts (lit unsafeSVG directive)
EXIT=1

################ M-G1-7: el.setHTMLUnsafe(body)
  - no raw-HTML sink other than unsafeHTML exists: ... src/components/ft-mutant-sink.ts (setHTMLUnsafe)
EXIT=1

################ M-G1-8: unsafeStatic(body)  [Lit static-html]
  - no raw-HTML sink other than unsafeHTML exists: ... src/components/ft-mutant-sink.ts (lit unsafeStatic directive)
EXIT=1

################ M-G1-9: range.createContextualFragment(body)
  - no raw-HTML sink other than unsafeHTML exists: ... src/components/ft-mutant-sink.ts (createContextualFragment)
EXIT=1

################ D-1: delete the table container payload (post-fix: payload == check)
Error: 1 of 53 markdown sanitizer checks failed:
  - check total pinned: expected 54 checks to run, 53 did — a check was added or silently removed
EXIT=1
```

Note on `D-1`: after the T4 fix the payload and its `check()` are the same
object, so the equivalent deletion removes the whole check and `EXPECTED_CHECKS`
catches it. The harness detects which shape is present and mutates accordingly.

### 4b. Independence check — the sink guards work without the file-count pin

The T2 vectors above each trip *two* checks, because adding a file also trips
`EXPECTED_SOURCE_FILES`. That would let someone argue the sink guard itself was
never exercised. So I re-ran all seven **injected into an existing file**
(`src/util/format.ts`), keeping the count at 50:

```
################ M-G1-4-INPLACE: el.innerHTML += body
Error: 1 of 54 markdown sanitizer checks failed:
  - no raw-HTML sink other than unsafeHTML exists: raw-HTML sink outside renderMarkdown in: src/util/format.ts (innerHTML/outerHTML assignment)
EXIT=1

################ M-G1-5-INPLACE: el["innerHTML"] = body
  - ... src/util/format.ts (innerHTML/outerHTML indexed assignment)                     EXIT=1
################ M-G1-6-INPLACE: unsafeSVG(body)
  - ... src/util/format.ts (lit unsafeSVG directive)                                    EXIT=1
################ M-G1-7-INPLACE: el.setHTMLUnsafe(body)
  - ... src/util/format.ts (setHTMLUnsafe)                                              EXIT=1
################ M-G1-8-INPLACE: unsafeStatic(body)
  - ... src/util/format.ts (lit unsafeStatic directive)                                 EXIT=1
################ M-G1-9-INPLACE: range.createContextualFragment(body)
  - ... src/util/format.ts (createContextualFragment)                                   EXIT=1
################ M-G1-3-INPLACE: aliased unsafeHTML import + raw call
  - no file aliases or re-exports the unsafeHTML directive: ... src/util/format.ts      EXIT=1
```

Exactly one check fails in each case, and it is the right one.

---

## 5. Two bypasses I found in my own fix — reported and closed · `96d26a5`

After the five items were green I attacked my own alias guard. It fell twice.

```
################ RESIDUAL-1: alias via the lit-html/ import path instead of lit/
markdown sanitizer: 54 checks passed
EXIT=0

################ RESIDUAL-2: aliased unsafeSVG evades the banned-call scan
markdown sanitizer: 54 checks passed
EXIT=0
```

- **`lit-html/directives/unsafe-html.js`** — my guard anchored on the `lit/`
  prefix. `lit-html@3.3.2` is installed (`node_modules/lit-html`, confirmed) and
  directly importable, and re-exports the same directive. The prefix was a
  one-word bypass.
- **Aliased `unsafeSVG` / `unsafeStatic`** — these were in the banned *call*
  list, but aliasing renames the call, so the alias defeated that list too. Only
  `unsafeHTML` had alias protection.

I judged these in scope rather than deferring them: they are the same defect
class the round exists to close, inside the guard I had just written, and the
round's whole premise is that a guard trusted and wrong is worse than no guard.
Shipping a guard with a known one-line hole would have reproduced the exact
situation being fixed. Neither is Critical or High — no such sink exists in the
tree, same as the originals — so I fixed rather than stopping.

The fix generalises over all three directives and bans the three renaming forms
(`X as Y`, `import * as ns`, re-export), matching module paths by suffix.
Verified:

```
################ RESIDUAL-1 (re-test): alias via lit-html/ import path
  - ... src/util/format.ts: unsafeHTML renamed with 'as'                    EXIT=1
################ RESIDUAL-2 (re-test): aliased unsafeSVG
  - ... src/util/format.ts: unsafeSVG renamed with 'as'                     EXIT=1
################ RESIDUAL-3: aliased unsafeStatic
  - ... src/util/format.ts: unsafeStatic renamed with 'as'                  EXIT=1
################ RESIDUAL-4: namespace import indirection
  - ... src/util/format.ts: directives/unsafe-html.js imported as a namespace  EXIT=1
################ RESIDUAL-5: re-export barrel
  - ... src/util/format.ts: directives/unsafe-html.js re-exported           EXIT=1
################ CONTROL: legitimate non-sink import from static-html.js (MUST STAY GREEN)
markdown sanitizer: 54 checks passed                                        EXIT=0
```

The control matters: `static-html.js` exports `html` as well as `unsafeStatic`,
so the naive "module imported but not by own name" rule would have falsely
flagged a legitimate import. Detecting the alias form directly avoids that.

The full battery in §4 was re-run after this change, at `96d26a5`. All 11 still
red — no regression from generalising the guard:

```
MUTATION BATTERY - PHASE: FINAL (at 96d26a5, all fixes + residual closures)
repo HEAD: 96d26a5      jsdom: 26.1.0
M-G1-1   Error: 2 of 54 checks failed   EXIT=1     M-G1-6   Error: 2 of 54   EXIT=1
M-G1-2   Error: 3 of 54 checks failed   EXIT=1     M-G1-7   Error: 2 of 54   EXIT=1
M-G1-10  Error: 2 of 54 checks failed   EXIT=1     M-G1-8   Error: 2 of 54   EXIT=1
M-G1-3   Error: 2 of 54 checks failed   EXIT=1     M-G1-9   Error: 2 of 54   EXIT=1
M-G1-4   Error: 2 of 54 checks failed   EXIT=1     D-1      Error: 1 of 53   EXIT=1
M-G1-5   Error: 2 of 54 checks failed   EXIT=1
BATTERY COMPLETE - final tree state: (clean)   HEAD: 96d26a5
```

---

## 6. One correction to my own work · `9932eff`

The note I added in `849a9da` warned that `grep -c "  check("` no longer equals
`EXPECTED_CHECKS` — but the pattern it quoted **matched its own comment line**,
inflating the grep count to exactly 54 and making the warned-about discrepancy
look like an agreement. I caught this while assembling this report, checked, and
corrected it.

```
grep -c '  check('                 : 54   <- includes the comment line itself
literal call sites (^\s+check\()   : 53
runtime                            : 54
```

The real arithmetic is `53 + (REQUIRED_SINKS.length - 1) = 54`. The comment now
states both numbers so the next reviewer can verify the pin rather than
re-derive it. Recording this because it is precisely the failure mode of this
workstream: a comment that makes a guarantee look stronger than it is.

---

## 7. Full gate

Run against the committed tree, output redirected to files with `$?` read from
each command directly, not off a pipeline:

```
HEAD: 96d26a5
status: (clean)

npm ci                      EXIT=0
npm test                    EXIT=0
npx tsc --noEmit            EXIT=0
npm run build               EXIT=0
npm audit --audit-level=low EXIT=0

jsdom under test: 26.1.0
markdown sanitizer: 54 checks passed
found 0 vulnerabilities
✓ built in 3.00s
```

`go build ./...` also exits 0 (no Go touched; run because `CLAUDE.md` names it).

**jsdom actually run against: 26.1.0**, matching `package.json` and the
lockfile, before and after `npm ci`.

---

## 8. Commits — local only, not pushed

```
bae4fd0 docs: log #195 round-3 cleanup (G1 sink-binding gap closed)
9932eff docs: state the static/runtime check-count arithmetic precisely (#195)
96d26a5 test: close two alias bypasses I found in my own T1 guard (#195)
64187a0 test: name the formaction check for what it actually asserts (#195 T6)
951ee89 test: split the svg-style container payloads into one check each (#195 T4)
fa41008 test: widen the banned raw-HTML sink list to eight forms (#195 T2)
849a9da test: bind the named markdown sinks per file (#195 T1/T3)
```

Diffstat vs base: `web/src/util/markdown.test.ts` only, plus the project-log
entry. No production code changed.

---

## 9. Found but not fixed / not done

- **T7 — `EXPECTED_CHECKS` pins count, not content.** A check can still be
  gutted while staying registered. Inherent to a count pin, explicitly not
  requested. Manual mutation testing is the compensating control.
- **The exact-count pins are deliberately brittle.** Adding any file under
  `src/` now fails the suite until `EXPECTED_SOURCE_FILES` is bumped. That is the
  intent, but it is a real maintenance cost — the failure message says exactly
  what to do. Flagging so it is a known trade-off rather than a surprise.
- **`.innerHTML ==` would match the banned pattern**, since `\+?=` also admits a
  comparison. Accepted: a false positive fails loudly and is trivial to fix; a
  false negative is the defect this round exists to close.
- **The static scan is still a proxy for the module graph.** Computed property
  access (`el['inner' + 'HTML']`), a sink reached through a runtime-resolved
  reference, or one in a dependency remain invisible. The section-6 comment now
  says so. The component-rendering harness is the real answer — Phase 2.
- **T5 beyond the one-line note, CSP, the component harness, `optgroup`, audit
  INFO-1/INFO-2, #199/#193/#196** — all explicitly out of scope; not touched, not
  re-litigated.

---

## 10. Open question for the EM

**Which clone is authoritative?** I used `/workspace/farmtable-markdown-sanitize`
(the dev clone, at the required `5daace4`), because `/workspace` itself is not a
repository. `farmtable-review-195` is also at `5daace4`. If the commits belong
elsewhere, tell me and I will move them — they are local and unpushed.
