# audit-195-r9 — independent security audit, #195 round 9

Your working tree is `/workspace`. Confirm with `git rev-parse --show-toplevel`, and verify
branch `markdown-sanitize-r9` and commit **`13680c2b7d7fd64841573894e5bb1224924eefdd`**.
**Do NOT create any directory named in this brief.** `web/node_modules` and `web/dist` are
present — do not reinstall or rebuild them.

## How to treat this brief

Claims are tagged `[MEASURED]` (I ran it this session), `[MEASURED-BY-<x>]` (relayed, not mine),
`[BELIEVED]`, `[CARRIED]`.

**My briefs have contained at least one error in ten consecutive rounds.** The round-9
implementation report lists **eight** errors in the brief I gave the developer. One of them
matters to you directly: **a probe I told the developer to run as an evasion test turned out to
be a false positive in the opposite direction** — the guard was rejecting legal code, not
missing an attack. My threat model was wrong about the direction of the bug. **Agreeing with a
premise supplied in this brief is worth ZERO, and from the outside it looks identical to genuine
convergence. If you confirm something I asserted, say that you are confirming MY claim and show
your own measurement.**

Reporting every place this brief is wrong is a **required deliverable**, not a courtesy.

## Known-good baseline `[MEASURED by me at 13680c2 this session]`

- `npm test` → exit 0, **79 checks passed (127 assertions)**
- `npx tsc --noEmit` → exit 0; `npm run build` → exit 0; tree clean
- Files changed `3f6a695..13680c2`: `markdown.test.ts`, `markdown.ts` (**comment-only** — I
  verified at line granularity `[MEASURED]`), and a project-log entry.
- **There is no CI on this project** — nothing in this suite runs automatically on push.

## What to read

`/scion-volumes/scratchpad/projects/farmtable/reports/dev-195-r9.md` and
`reports/dev-195-r9-evidence/`. Both are **part of what you are auditing** — check their claims,
do not inherit them.

---

# Your axis: what does this actually PREVENT, in production?

Everyone else on this workstream is arguing about whether the *guard* is correct. Your job is
one level up: **the guard is a test.** `markdown.test.ts` is a static scanner that reads the
source tree and throws. It is not a runtime control, not a CSP, not a sanitizer configuration.

**And there is no CI** `[MEASURED]`. So state plainly, as your first finding, what the actual
enforcement story is: what has to happen, and who has to do it, for this control to stop a
hostile change from reaching production? Is the residual risk being carried by a test that only
runs when a human remembers to run it? **Do not soften this because it is inconvenient or
because it is somebody else's decision — rate it and say who owns it.**

## 1. The runtime question the test-shaped framing hides

Behind all nine rounds sits one concrete hazard: **markdown rendered into the Lit dashboard can
execute script.** The round-9 pin `privateDOMPurifyInstance()` demonstrates it vividly — with
`createDOMPurify(window)` reverted to the process-global singleton, output is
`<p><img src="x" onerror="alert(1)"><script>alert(2)</script></p>` and **the reverted tree still
type-checks and builds** `[MEASURED-BY-dev-195-r9]`.

So audit the **runtime** path, not just the scanner:

- Is `renderMarkdown`'s DOMPurify instance genuinely private, and can anything else in the
  process reach it or reconfigure it? `setConfig` and `addHook` are process-global by nature.
- What is the actual sanitizer policy — allow-list or deny-list? **There is a standing finding
  on this workstream that `markdown.ts` should be inverted to an allow-list and it has not been
  done.** Re-rate it with fresh eyes; you are not bound by the earlier rating.
- Where does rendered output go, and is there any other sink that bypasses `renderMarkdown`
  entirely? **The scanner enumerates sinks it knows about.** Enumerating sinks is exactly the
  kind of closed list that has been incomplete before on this workstream.
- `marked` and `DOMPurify` versions and configuration — any known-vulnerable configuration.

## 2. The trust boundary: who writes the markdown?

Task titles, descriptions, comments, labels — trace where markdown content originates. Is any of
it attacker-controlled in a realistic deployment, and what is the blast radius of execution in
the dashboard's origin? **A finding's severity here depends on that answer, so establish it
before you rate anything, and state it explicitly.**

## 3. Round 9's own new surface

Round 9 changed only test code plus two comments — **so your default hypothesis should be that
round 9 introduced no runtime risk, and your job is to try to falsify that.** The interesting
question is not "what did round 9 break" but **"what does round 9's green suite now assert that
is not true?"** A scanner that passes creates confidence; if the scanner's new blinding
(`templateText: true`) makes it blind to a real hostile construct in production source, the
green result is worse than no scanner. Specifically: the helper blanks template **text** but
preserves `${…}`. Is there a hostile construct that lives in the blanked region?

## 4. Deliberately unlisted

The list above is my hypothesis about where the risk is. **My hypotheses on this workstream have
been wrong every round**, including about the direction of the bug. Spend real budget outside
this list.

---

# Verification bars

- **A negative claim needs a positive control drawn from a DIFFERENT axis than the one you
  searched.** A same-axis positive control is **non-evidence** for the failure that matters. The
  developer's own report contains a model example: the audit in a prior round varied template
  placement *within the declaration* while holding the **call shape** constant, so its negative
  only ever licensed a claim about declaration-side spellings. Thirteen call-shape probes then
  found two live false positives. **Ask what your probes are holding constant.**
- **Ask what your oracle can discriminate BEFORE asking what your inputs vary.**
- **A green control is a finding, not a pass.** Write it down.
- **Predict counts BEFORE measuring**, and report the prediction next to the result.
- **Exit codes come from the child process, never through a pipe.**
- **Commit or stash before any mutation experiment**, and revert every mutation.

# Deliverables — you are not done until all four exist

1. **A report at `/scion-volumes/scratchpad/projects/farmtable/reports/audit-195-r9.md`**, with
   findings classified **Critical / High / Medium / Low / Informational**, each with `file:line`,
   an exploit path or a statement of why it is not exploitable, and a clear
   **APPROVE / REQUEST CHANGES** verdict. Say plainly whether anything blocks merge.
2. **A project log entry** in `.design/project-log/`, **committed** to `markdown-sanitize-r9`.
3. **An explicit list of every place this brief was wrong.** If nothing, say so and say what you
   checked.
4. **Do NOT push. Do NOT modify production code — your independence depends on it.** Probes and
   mutations for measurement are fine; revert them and assert `git diff --quiet` afterwards.

**You MUST produce all four deliverables and then mark the task complete.**
