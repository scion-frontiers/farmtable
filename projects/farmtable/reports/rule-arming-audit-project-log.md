# PROJECT LOG — audit-rule-arming

**Leg:** audit-rule-arming · **Dispatched:** 2026-07-29T06:42:25Z by `agent:farmtable-em-task-state-model-v2`
**Brief:** `briefs/audit-rule-arming.md` · **Report:** `reports/rule-arming-audit.md`
**Mode:** READ-ONLY. No code tree. **No build token requested and none used.** No commits. No push.
**Object:** `em-tooling/_STANDING-RULES-2026-07-29.md`, 1751 lines, ~124 KB, **not in a git tree so no SHA
exists.** All line references are pointers into mutable state, keyed to the file as read at ~06:45Z.

---

## THE RESULT

**(a) executable checks named in the rules file: 0. Denominator: 153.**

```
grep -o -E '[a-zA-Z0-9_-]+\.(sh|py)' em-tooling/_STANDING-RULES-2026-07-29.md | sort -u   → empty
```

(b) prose applicability clauses: **147 / 153** — not arming, per the discriminator.
Neither: **6 / 153**. Human-run observers that ever returned a result: **6 / 153**, reported separately
and disclosed as a floor on disclosure rather than a count.

**Not summed. (a) and (b) are different objects.**

## THE FINDING THAT IS NOT THE ZERO

The project holds **two purpose-built, red-capable, control-carrying rule-enforcement instruments**, and
**the rules file names neither**:

- `em-tooling/scope-check.py` — built **05:48Z today**, one hour before this audit. Converts §7.0's
  judgment rule into a procedure. `exit 2` = red, `exit 3` = instrument broken, carries `--self-test`.
  **Zero references anywhere in the project by literal filename** (positive control: the same query shape
  finds 68 `.py` filenames across `*.md`).
- `em-tooling/orphan-scan.sh` — carries an **injected-fault positive control**. **Was run**, 2026-07-28,
  and found a real defect (the #191 r2 review record was orphaned). Its binding occasion — *"runs before
  any agent GC, every round"* — **exists only in the EM state file and 44 backup snapshots of it, not in
  the standing-rules file.** Its documented path `/workspace/orphan-scan.sh` **resolves to a stale
  3180-byte copy**; the maintained copy is 4626 bytes in `em-tooling/`. A leg following the documented
  path runs the wrong instrument and gets a clean-looking result.

**The axis is not uncovered for want of capability. It is uncovered with two working instruments beside
it, one unwired and one pointed at a stale copy of itself.** §10.16: *the fix is not unknown here, it is
unreachable.*

## MEASURED COMPLIANCE (3 rules, not 153 — do not let these lend authority to the judged rows)

| rule | population | compliant |
|---|---|---|
| §8.3 — brief §0 carries the "no brief path → stop" clause | 10 post-adoption briefs | **0** |
| §10.24 — brief pre-registers hypothesis/falsifier/action | 8 post-adoption briefs | **1**, and it is the rule's own seed instance. Beyond seed: **0 of 7** |
| §10.5 — brief states its unit | this brief | 1 |

Positive control on the §8.3 zero: `stop and say so` returns 7 hits across 4 files, all SHA clauses, none
§8.3's. The query can find text of that kind; the clause is absent. **The dispatch commissioning this
audit complies with 1 of the 3 brief-scoped rules in the file it audits.**

## MID-FLIGHT INSTRUCTIONS RECEIVED AND HOW THEY WERE HANDLED

- **06:52Z — the (a)/(b) discriminator.** Applied by **rescoring**, not annotating. It caught a real
  defect: my original CHECK=6 had 5 rows scored from the file's author narrating that the author's own
  instruments ran. Pre-addition scoring preserved in report §2.3 with the reason it was wrong (§3.5).
- **07:00Z — armed rule, exit-status observation.** Answered in report §5.0. **I reported no builds or
  tests, so no harness green of mine is in question.** One real exposure disclosed: I claimed
  `scope-check.py` "can go red" **from its docstring, having never run it** — a status line read out of a
  comment. Now labelled `[UNCHECKED]`. It does not move (a), which is a filesystem fact about the rules
  file. It does bound the claim that two *working* instruments exist: one is verified working by its
  output, one is verified only to exist.

## ERRORS I MADE AND CAUGHT (recorded per §7.14 — report that you checked, not only what you found)

1. **Homonym false positive, inside the audit looking for homonyms.** Searched `scope-check` unanchored,
   got 4 files, nearly filed them as invocation evidence. All 4 are "scope-checked" about gRPC RPC scope.
   §10.20's `D4.5`, §9.4's notation hazard. Literal `scope-check\.py` → 0.
2. **Unstated bound on my own search.** `orphan-scan` under `reports/ briefs/` → 0; unbounded → **359**.
   §7.0. The correction **reversed the finding** — the script had been built and run and had caught a real
   defect. 359 hits collapse to 46 files, 44 of them backups of one document (§10.8, the corpus votes).
3. **Nearly filed a §8.3 zero from my own paraphrase** before running a positive control (§8.4). The zero
   survived; it would not have been trustworthy without the control.
4. **Truncated first read.** Initial read returned 597 of 1752 lines. Completed in two further passes
   before scoring anything.

**All four errors ran toward a cleaner-looking result.** That is the direction to expect.

## WHAT I DECLINED TO DO, AND WHY

**Did not run `python3 em-tooling/scope-check.py --self-test`** — the single command that would have
tested the audit's most load-bearing "can go red" claim. My brief said NO BUILD TOKEN without stating
which of OP-1(a)/(b) it meant, and **OP-1(d) resolves ambiguity to (a)**. Raising it as the **OP-1(f)**
condition it is: *a brief silent on (a)/(b) must be flagged in the first message*, and mine was silent.

## RECOMMENDATIONS, IN COST ORDER

**0. Name the two existing instruments in the rules file, by path, and fix the stale `orphan-scan.sh`
citation.** Two lines. Moves (a) from 0 to 2 today. Requires no new work.
1. Deliverable template with EM-refused blank fields — arms ~40 rules at one stroke.
2. One grep suite over `reports/`+`briefs/`, **run by a non-author** — arms ~25. The non-author clause is
   the whole rule; without it it is trap 2.
3. Reconcile `_run-queue-log.md` against transcripts — arms the fence. The log is live (1611 lines) and
   contains **0** occurrences of the staleness question it exists to count.
4. A brief lint — arms §8.3, §10.24, §10.5, §9.1, all measured at ~0.

**Then strike what they cannot reach: 13 named STRIKEs** — §2.1, §3.3, §4.2, §6.4, §6.8a, §6.12, §7.0-5,
§7.4, §8.5, §10.6a, §10.10b, §10.12, OP-1d.

## DISAGREEMENTS WITH THE BRIEF, SUMMARISED

- **The risk ordering is backwards.** The 6 rules with neither trigger nor check are honest prose and
  mislead nobody. **The 141 with a prose trigger and no check are the liability**, because the trigger is
  what makes them read as controls. §8.1's hedge with the sign flipped.
- **Better counting cannot rescue the denominator.** 147 rules have no instrument capable of producing a
  failure observation, so they are not in the sample frame; and **neither of tonight's two failures was
  caught by any armed rule.** There is no rate at any N. Two is a **floor**. §10.10b already forbids the
  move and sits unarmed in Part 10.
- **Replace TRIGGER with OWNER.** Among the 6 human-observed rules the predictor of arming was a named
  owner plus a named file, never the presence of a trigger. §7.6b already says this.
- **The disclosed-expectation device did not work as intended.** Being told the expected answer *and*
  that a contrary answer would read as stronger did not make me neutral — both halves pushed, in opposite
  directions. What held the number was that the command had one readable output.

## STATUS

Both deliverables written. Nothing written to any code repository. No commits, no push, no build.
