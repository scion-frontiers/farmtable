# review-xss-r4 — CHECKLIST (STEP 2) + DELIVERABLES

**Released to you because your open pass is on disk. Findings from here are
`[CHECKLIST]`, not `[OPEN]`.** Read Part II (`_xss-r4-method-block.md`) first if
you have not.

---

## STEP 2 — the six commits as claims

### C1 — X1: `make test` now runs the web guard

`2f6500f`. The defect: the branch shipped a URL guard test suite that **no documented
workflow executed**. `make test` ran Go only; both Dockerfiles built the web assets
without running `npm test`.

- Verify the wiring actually runs the suite **in the path a developer and CI would take**,
  and that a **failing** web test fails `make test`. A target that runs a command whose
  exit code is discarded is the same defect wearing a fix's clothes. Check for `-` prefixes,
  `|| true`, subshells, and pipes — **`cmd | tail` reports `tail`'s exit code**, and this
  project has shipped that.
- Both Dockerfiles: does `npm test` run **before** the build artefact is produced, and does
  its failure abort the image? An `npm test` after `COPY --from=` proves nothing.
- **Does it require `node_modules`?** I hand-copied 120M of it into your clone. A gate that
  only runs when someone has already run `npm ci` is a gate that is off in exactly the
  environment that most needs it. Say what happens on a clean checkout.
- Architectural: is there **one** place that knows the web suite exists, or three that
  agree today?

### C2 — X2/X4/X5/X7a: the guard tracer's own holes

`d12f572`. Four separate fail-opens in the meta-oracle, all measured by the leg:

- **scope direction inverts with the predicate** — arm 1 is block-scoped existential, arm 2
  is file-scoped universal, and **they overlap by construction**;
- **`sourceFiles()` was `.ts`-only**, so any guarded surface in another extension was
  invisible;
- **the walk was not identity-checked** — it could report success for a node that was not
  the node under test;
- **two assertions were passing for the wrong reason.**

- The interesting review question is not whether each patch is right. It is: **were these
  four independent bugs, or four symptoms of one structural choice?** A tracer that reasons
  over syntax with hand-rolled scoping will keep producing this class. Say whether the
  remedy here is convergence (one scope model, one file-set source, one identity check) or
  four patches, and say which one shipped.
- **`EXPECTED_ASSERTIONS = 380` is a count pin.** X4. Read Part II on count pins. Your axis question: is the constant **derived** from anything, or hand-maintained?
  A hand-maintained total that a developer bumps when it fails is an anti-regression device
  that trains people to defeat it. Is there a comment telling them not to? Is the comment
  the only mechanism?
- **Identity-checking a walk is the right fix and it is easy to do half-way.** Confirm the
  identity check is on the node the assertion consumes, not on a node the walk merely
  visited.

### C3 — X6: adapter keys by AST, not by regex

`4e58242`. The old scanner returned **`nested=[]`** under `map[string]interface{}{` and
returned **`top=[] nested=[]`** for `server.go` — i.e. it reported *no adapter keys at all*
for a file that has them. **A scanner that returns empty is indistinguishable from a clean
result, and that is why this one survived.**

- Verify the AST scanner **finds the keys the regex missed**, by construction and not by
  assertion: is there a fixture containing the exact `map[string]interface{}{` shape that
  defeated the old one?
- **Every zero this scanner can emit needs a positive control.** Ask what the scanner does
  for: a file that does not parse; a file with zero adapter keys legitimately; a key built
  by concatenation or a constant rather than a literal. Which of those are distinguishable
  in its output, and which collapse to the same empty?
- **X7b** — `noteDeclaresBaseDependence` is now negation-aware. Negation-awareness in a
  source-text predicate is a slope: `!x`, `x == false`, `!(x)`, a negation two lines up.
  Ask what it handles and what it silently accepts. State the boundary.
- Architectural: this is now the **second** hand-written source scanner in the branch
  (guard tracer, adapter keys). Is there a shared substrate, or two? Say whether that
  matters yet.

### C4 — X3: sanitize `remote_data` at every depth and every write site

`6551712`. The production-behaviour commit, and the one with real user-visible stakes.

The leg measured that `structpb.NewStruct` **does** preserve nested maps, so
`remote_data.parent.html_url` reached the client unsanitized — the recursion gap was live,
not theoretical. Good measurement. Then:

- **My brief said four write sites. The leg found SIX** — adding `export_import.go:139` and
  `export_import.go:332` — and it found them by writing
  `TestEveryRemoteDataWriteSiteSanitizes` rather than by auditing my four. **That is the
  right move and I want you to check the move, not just the result:** is the write-site
  enumeration now **derived** (something that fails when a seventh site appears) or is it a
  list of six? If derived, what is the derivation over, and can a write site exist that the
  derivation cannot see — a write through a helper, an alias, a struct assignment?
> **[CORRECTED 00:48Z — THIS ITEM WAS FALSE AS WRITTEN. THE ORIGINAL TEXT IS PRESERVED BELOW
> THE CORRECTION SO THE ERROR IS NOT ERASED, ONLY SUPERSEDED.]**
>
> **MEASURED, by three legs, by three DIFFERENT methods, none having read the others:**
> review-xss-r4 ran the regex against the real write forms; test-xss-r4 located the scan root;
> audit-xss-r4 read the key construction. All three agree:
>
> **The exemption is keyed by exact source TEXT, not by line number:**
> `exempt[strings.TrimSuffix(strings.TrimSpace(line), ",")]`.
> **Edits above it have NO effect.** When the exempted STATEMENT ITSELF changes, the key stops
> matching and the site REAPPEARS as a violation — it fails **CLOSED**, the opposite direction
> from what this item claimed. `test-xss-r4` measured this directly under grant G-7/R10:
> renaming the receiver `p` -> `proj` produced exit 2 and named the site.
>
> **THE REAL DEFECTS AT THIS SITE, all measured, none of them the one I described:**
> 1. **The scanner regex does not match INDEX writes.** `p.RemoteData["remote_id"] = ...` does
>    NOT match; only `p.RemoteData = map[string]any{}` does. So `server.go:663` and `:669` — the
>    two statements that actually put values in the map, and the two the exemption's stated
>    reason is ABOUT — were never candidates. **The exemption suppresses a harmless empty-map
>    construction, and its stated rationale is false.**
> 2. **The exemption is PACKAGE-GLOBAL, not site-specific.** The scan root is every non-test
>    `.go` file under `internal/server`, so a byte-identical line ANYWHERE in the package is
>    silently exempted too. `test-xss-r4` measured this (G-7/R7, GREEN). **That is the fail-open
>    direction, and it is by DUPLICATION, not by drift.**
> 3. Scope is DERIVED over a DIRECTORY, not a property: non-recursive, `internal/server` only,
>    seeing 6 of 14+ `RemoteData` assignments — while the test is named
>    `EveryRemoteDataWriteSite` and claims a universality it does not have.
> 4. The floor `sanitized < 4` is STALE (six sites exist), so if the loop stops reaching
>    `convert.go` the count falls 6->4, `4<4` is false, and **the scan silently loses the two
>    client-facing sites and reports green.**
>
> **THE FIX IS NOT TO PATCH THE KEYING IN EITHER DIRECTION.** Both directions and the scanner's
> blindness all disappear under `type SanitizedRemoteData map[string]any`, produced only by
> `sanitizeRemoteData` and required by the outbound consumers: unsanitized outbound writes stop
> COMPILING, in every package, through every write form. `server.go:661` is an INBOUND write, so
> under that design **it needs no exemption at all** — the exempt map, the text key, the directory
> scope and the stale floor all disappear together.
>
> **WHY THIS CORRECTION IS IN THE FILE AND NOT ONLY IN A MESSAGE:** a false premise that survives
> only in a superseding message will be read as TRUE by whoever opens the brief next, and briefs
> outlive rounds.

**[ORIGINAL TEXT, FALSE, RETAINED FOR THE RECORD:]**
- ~~**`server.go:661` is exempt, and the exemption is keyed by exact source line.** A
  line-number-keyed exemption is a **decaying control**: it silently moves to a different
  statement the next time anyone edits above it, and the failure is silent in the
  permissive direction. This is the finding I most expect you to confirm. Is there any
  content check binding the exemption to what it exempts? What is the failure mode when
  the file shifts by one line? **Propose the fix in terms of making the bad state
  unrepresentable, not detected.**~~
  **^ FALSE. "This is the finding I most expect you to confirm" is exactly the sentence that
  makes a false premise dangerous — it converts my error into a target. `review-xss-r4`
  contradicted it from its OPEN pass, before reading this file, which is the only reason the
  control worked.**
- The recursion itself: is the depth parameter's role clear, is there a bound, and what
  happens at the bound — does it **drop**, **truncate**, or **pass through**? Passing
  through at the bound is a fail-open and the whole round is about fail-opens.
- `TestSanitizeAndImportAgreeAtEveryDepth` over 63 generated maps: 63 is a product of a
  small basis. That is the test leg's to size, but say if the *shape* of the generator
  excludes anything structurally — arrays of maps, maps in arrays in maps, nulls, non-UTF8.

### C5 — the docs commits, as claims

`e4316ae` and `e6bda71` are documentation. **They are inside the artefact you are
reviewing; nothing downstream of the diff can falsify the diff.**

This branch has a documented history of **comments stating a measurement as a property**,
and a sibling round where **six of ten findings were a false sentence sitting on a correct
measurement.** Corrections are claims too, and a correction can install a new bias wrong in
the opposite direction — a recorded lesson whose cost is a **false negative**.

- `e6bda71` names three things: the `server.go:661` exemption, the contaminated preserve
  ref, and the `scopes.go` decision. **Check each sentence against the code**, in that
  commit's diff. Is the exemption's stated rationale the actual reason it is safe?
- Is anything in the log stated as a **property** that was measured as a **point-in-time
  fact**? That class bit us three times in ninety minutes tonight (see Part II).

### C6 — THREE SELF-REPORTED GAPS, CARRIED AS CLAIMS TO BE TESTED

The leg disclosed these itself, honestly and in detail. **Disclosure is not
adjudication — a self-reported gap that a reviewer treats as already-settled is how a leg
reviews itself.** Two are yours:

- **X8 IS PARTIAL, AND THAT IS A JUDGEMENT CALL, NOT A MEASUREMENT.** The leg reports
  `convert.go:358` **discards the error**, so **one unrepresentable value nulls the ENTIRE
  `remote_data` silently.** Also `convert.go:530,555,558`. The leg decided this was
  out of scope / acceptable. **Give it an independent look on your axis:** is a silent
  whole-field null a correctness defect regardless of security? What is the user-visible
  behaviour? Is "discard the error" load-bearing anywhere, or is it inertia? And is
  finishing X8 a bounded piece of work or a new round? I want your sizing, because it is an
  input to my scheduling.
- **`scopes.go` LEFT DIRTY ON PURPOSE.** Six lines of pure gofmt alignment in a `const`
  block, pre-existing, explicitly fenced out of the round baseline. **This is a declared
  decision, not an incomplete handoff** — I checked the diff and the account is accurate,
  and it is not present in your clone. I am telling you so you do not read it as an
  unfinished handoff. **But say whether you agree with the disposition:** leaving a fenced
  formatting drift in a dev tree indefinitely has its own cost, and someone eventually
  commits it by accident. What should happen to it, and in which round?

(The third gap, **P10 genuinely unkilled**, is the test leg's. If your open pass forms a
view on it, label it an impression and name the axis.)

### C7 — the two claimed-equivalent mutants, as ARGUMENTS

The leg reports three survivors and says two are fine:

- **P2cn — claimed equivalent.**
- **P11 — claimed to be a redundant guard.**

**An equivalence argument is exactly the kind of claim that should not be self-certified.**
The test leg will attack these as mutants. **Your job is the code-reading half:** read the
two mutated forms against the original and say whether the *program* is genuinely the same
program — not whether the suite happens not to distinguish them. Those are different
questions, and "the suite cannot tell" is evidence for the mutant being equivalent only if
the suite is adequate, which is the thing under review.

For P11 specifically: **"redundant guard" is a claim that the other guard is total.** Name
the other guard and say what it covers. A redundant guard that becomes load-bearing after
someone simplifies its partner is how defence in depth is deleted.

### C8 — architecture: is the instrument stack sound?

The opinion I most want, labelled as an opinion.

This branch now defends its property with: a URL-binding source scanner, an adapter-key AST
scanner, a guard tracer with two overlapping arms, an assertion-count pin, and a runner
gate that makes the whole thing execute. **Two of those had measured fail-opens this round,
found by inspection rather than by any level above them.**

**Nothing downstream of X can falsify X**, so the stack terminates somewhere, and wherever
it terminates the top instrument is unguarded by construction. Say plainly:

- Where does it terminate, and is the outermost instrument the right one to be unguarded?
- Is this stack now **load-bearing beyond its reliability** — i.e. should the next round be
  a convergence/simplification round rather than another fix round?
- Is any of this instrumentation replaceable by making the bad state **unrepresentable** (a
  type that cannot hold unsanitized remote data, a single chokepoint write) rather than by
  scanning source text for its absence? That is the durable remedy and I would rather hear
  that this diff should have converged than that it correctly patched.

---

## Method notes

- **Impact before severity.** Establish whether a defect is covered indirectly before you
  rate it.
- Prefer a **chokepoint** over a checklist when the hazard is an open set — **but name the
  mechanism that makes it bite.** A control that looks structural and is inert is worse than
  none, and we have shipped one.
- Separate **Required** from **Suggested**. Required means I hold the merge.
- Do not treat another leg's approval as corroboration, and do not offer yours as one.

---

## Deliverables — all required

1. **Verdict**, Required separated from Suggested.
2. Your **open pass**, written before the checklist, findings attributed
   `[OPEN]`/`[CHECKLIST]`.
3. **C4**: your verdict on the `server.go:661` exemption **[AMENDED 00:49Z: "line-number-keyed"
   was my error; it is TEXT-keyed and file-agnostic — see the correction at C4 above]** and
   whether the six-write-site enumeration is derived or listed.
4. **C6**: your independent judgement on **X8 / `convert.go:358`** — correctness impact and
   your **sizing** of finishing it. And your disposition recommendation for `scopes.go`.
5. **C7**: your code-reading verdict on **P2cn** and **P11** as equivalence *arguments*.
6. **C8**: your architectural opinion — patch or converge, and should the next round be a
   convergence round. Label it an opinion.
7. Your **prediction accuracy** as a fraction, with the misses.
8. **A numbered list of everywhere this brief is wrong.** Required. There is something.

Do not push. Do not modify production code. **You MUST write the report file at the
absolute path above and then mark the task complete.**
