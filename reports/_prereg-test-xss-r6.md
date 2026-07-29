# PRE-REGISTRATION — test-xss-r6

- Agent: `test-xss-r6`
- ROOT: `/workspace/farmtable-test-xss-r6`
- SHA: `c108acbcfa2357862576092469828709bb6c4090` (detached, tree clean at time of writing)
- DIST: present (copied, not built here)
- Written BEFORE any test execution or any planted mutation.

---

## 0. CONTAMINATION DISCLOSURE — READ FIRST

**My cold pass is not clean, and the cause is an instruction conflict, not a lapse.**

The dispatch message said, in capitals: *"READ THESE TWO FILES, IN THIS ORDER, BEFORE YOU DO
ANYTHING ELSE"*, naming `_r6-COMMON.md` and `test-xss-r6.md`. COMMON §5/§7 says the opposite:
§7 is fenced with *"DO NOT READ UNTIL PHASE ONE IS ON DISK"*.

I obeyed the dispatch message and read `_r6-COMMON.md` end to end in one `Read` call. **I
therefore read §7 before writing any Phase One output.** There is no way to unread it.

Consequences I am accepting and reporting rather than papering over:

- Everything I label PHASE ONE below is **warm, not cold**. It was formed with §7 in memory.
- The falsifiability §5 was trying to buy — "is the cold pass worth anything?" — **cannot be
  measured on this leg.** If the other two legs read the same dispatch text, it cannot be
  measured on them either, and the round has lost that measurement for all three.
- I am flagging findings as **INDEPENDENT** only where I can point at a concrete artefact I
  reached by my own route and which §7 does not mention at all. That is a weaker warrant than
  a genuine cold pass and I am not going to dress it up as one.

This is filed as the first entry in the brief-errors section of my report.

---

## 1. WHAT I PREDICT, BEFORE RUNNING — OUTCOME AND MECHANISM SEPARATELY

Standing form: the outcome and the arm are two predictions. A red from the wrong arm is a
different result from a red.

### P1 — baseline guard run

- **Outcome:** `TestWebRemoteDataConsumersAreDeclared` GREEN, `TestWebRemoteDataCensusIsNonVacuous`
  GREEN.
- **Mechanism/arm:** BASELINE. My own hand census of `web/src` returned exactly 12 mention lines
  and they reconcile one-for-one with the 8 allowlist entries once the `count: 2` entries are
  expanded. I predict no undeclared and no stale.
- Confidence: high.

### P2 — plant a consumer under a directory whose basename is in `skipDirs`

- Plant: `web/src/build/telemetry.ts` containing `const rd = coll.remoteData;`
- **Outcome predicted:** GREEN (the guard MISSES it).
- **Mechanism/arm predicted:** `DIRECTORY-NAME SKIP AT ARBITRARY DEPTH`. `skipDirs` is keyed on
  `d.Name()` inside `filepath.WalkDir`, so it matches a basename at ANY depth, not just the four
  known build-output roots directly under `web/`. `filepath.SkipDir` then prunes the subtree.
- **Why this matters and why it is a separate prediction from the known hole:** §7's shipped bound
  is "CATCHES THE ACCIDENTAL ADDITION; never observed catching a deliberate one", and its stated
  miss mechanism is *computed access emits no census entry*. This is a **different mechanism** —
  a literal, unambiguous, byte-obvious `.remoteData` spelling that the census never reads because
  the walk never descends. If P2 comes back GREEN, the shipped bound is **false as written**: this
  is an accidental addition (a developer putting a helper in `src/build/`) that is not caught.
- Confidence: high on outcome, high on mechanism.

### P3 — plant compiled web-test output in `web/.tmp-test/`

- Plant: `web/.tmp-test/util/x.test.js` containing `remoteData`.
- **Outcome predicted:** RED.
- **Mechanism/arm predicted:** `UNDECLARED` (not `MULTIPLICITY`) — the path differs from every
  declared `file`, so it lands in the undeclared bucket, not the count bucket.
- **Why it matters:** `npm test` is `rm -rf .tmp-test && tsc -p tsconfig.test.json && node
  scripts/run-tests.mjs`. It creates `.tmp-test` and **never removes it on the way out**.
  `.tmp-test` is **not** in `skipDirs`. So the Go guard's population depends on whether the web
  suite has been run in this working tree. Predicted consequence: `make test` is **not
  idempotent** the moment any `web/src/**/*.test.ts` mentions the field — first run green, second
  run red, with the red naming a build artefact. Today no web test mentions it (I checked: zero
  files), so this is **latent, not live**. I predict I can arm it with one file.
- Confidence: high.

### P4 — the sampler is global, not per-field

- Probe: fire a `task.remote_data` drop, then a `collection.remote_data` drop, inside one
  `remoteDataLogInterval`, on a pinned clock.
- **Outcome predicted:** the `collection.remote_data` line is **ABSENT** from the log.
- **Mechanism/arm predicted:** `SHARED SAMPLER STATE ACROSS FIELDS`. `remoteDataLogMu`,
  `remoteDataLogLast` and `remoteDataLogSuppressed` are three package-level singletons;
  `field` is a formatting parameter only and never keys the sampler.
- **Why it matters:** the round's own comment argues the collection line is the canary for a
  silent write-authorization revocation ("IF ANYTHING EVER SETS IT, THIS LINE SILENTLY REVOKES
  IT"). The same round documents that the *task* path fails conversion for **every** passthrough
  task, unconditionally. So in any deployment where someone is browsing a passthrough collection,
  the task path holds the sampler window open continuously and the canary line is suppressed —
  surviving only as an anonymous `+N further drop(s) suppressed` integer that does not name the
  field. This is the exact shape my brief names: **an aggregate where an absolute per-axis
  assertion was needed.**
- **Second prediction, on coverage:** **no existing test in the tree exercises two different
  `field` values against the sampler.** All three tests in `remotedata_log_test.go` pass
  `"task.remote_data"` only. I predict a grep confirms this.
- Confidence: high on both.

### P5 — `unrepresentableKeys` "should not happen" branch is REACHABLE, and its message is wrong

- **Outcome predicted:** a map whose only defect is an **invalid-UTF-8 key** makes
  `structpb.NewStruct` return an error while `structpb.NewValue` accepts every value, driving
  `unrepresentableKeys` into its `len(out)==0` branch.
- **Mechanism/arm predicted:** `NewStruct VALIDATES KEYS, NewValue NEVER SEES THEM`. NewStruct
  checks `utf8.ValidString(k)` per key before delegating values to NewValue; NewValue has no key
  to check.
- **Consequence predicted:** the branch's text — *"this should not happen"*, "a real finding about
  structpb and not a boring empty case" — misdirects an operator toward a protobuf bug when the
  actual cause is a bad key in attacker-adjacent data. **No test covers this branch.**
- **I am explicitly NOT guessing this.** I will verify against the real `structpb`, per the
  standing rule to check the reference rather than assert from memory. If NewStruct turns out
  not to validate keys, P5 is REFUTED and the branch is genuinely dead code, which is a
  different (smaller) finding.
- Confidence: medium-high on outcome, high that it is untested either way.

### P6 — `EXPECTED_ASSERTIONS = 380` is an outcome pin, not a cause pin

- **Outcome predicted (by reading, not running):** `web/scripts/run-tests.mjs` computes a
  **per-file** `#assertions N` receipt for every test file, and then asserts only on the
  **suite-wide sum**. No per-file expectation is ever compared.
- **Mechanism/arm predicted:** `CROSS-FILE COMPENSATION`. Deleting 3 assertions from file A while
  adding 3 to file B leaves the sum at 380 and the suite green. The file's own comment enumerates
  what the pin misses and names only *count-neutral in-place corruption* — it does **not** state
  this compensating-deletion hole, even though the per-file data needed to close it is already
  computed and printed one screen above.
- Confidence: high on the reading. I do not currently plan to spend the build token proving it by
  execution; I will mark the row UNRESOLVED-BY-EXECUTION rather than SURVIVED if I do not run it.

### P7 — the merge-blocker prediction in §7 cannot be confirmed from this tree

- **Outcome predicted:** I will be unable to confirm or refute it, for a reason §7 did not
  anticipate.
- **Mechanism/arm predicted:** `origin IS NOT THE REMOTE`. In my tree `origin` is
  `/workspace/farmtable` — another clone on this host — so `git ls-remote origin` reads
  canonical's refs, not GitHub's. §7 asserts "git ls-remote is the only cheap read in git that
  cannot be stale"; that is true of a real remote and **false of a local-clone origin**, which is
  the topology actually present. I predict `ls-remote` returns `refs/heads/main = 7a0f220`,
  directly contradicting §7's `cc927355…`, and that `cc927355…` is not a resolvable object here.
- Confidence: high (partly already observed before writing this file — noted for honesty).

---

## 2. ARMS I WILL ACCEPT AS DISTINCT RESULTS

Every matrix cell in my report carries one of these in the cell itself:

- `GREEN / BASELINE` — ran, passed, nothing planted.
- `GREEN / MISS` — planted a real consumer, guard did not fire. **This is a defect result.**
- `RED / UNDECLARED` — census saw a mention with no allowlist entry for that file+text.
- `RED / MULTIPLICITY` — declared file+text matched more times than `count`.
- `RED / DISAPPEARANCE` — declared file+text matched fewer times than `count` (includes deletion).
- `RED / INFRASTRUCTURE` — failed for a reason unrelated to the planted change (missing dist,
  compile error). **Not** evidence about the guard.
- `UNRESOLVED` — not executed. Never to be written as SURVIVED.

## 3. REVERT DISCIPLINE

Every plant is in my own tree only. After each, I revert and **re-run the baseline and report the
re-confirmed green**. `git status --porcelain` must be empty at the end and I will show it.

## 4. THINGS THAT WOULD FALSIFY MY OWN TOP FINDING

P4 is my headline. It is wrong if any of these hold, and I will check each:

1. `field` keys the sampler somewhere I missed.
2. The collection path is genuinely unreachable in a way that makes suppression moot — but §7 and
   the code comment both say a review leg already fired it, so I expect this to fail.
3. Some other test already asserts cross-field behaviour.
4. The suppressed-count line names the field, making the canary recoverable from the log after
   all. (It does not, by inspection: the format string interpolates only the *current* `field`.)
