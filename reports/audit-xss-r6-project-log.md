# PROJECT LOG — audit-xss-r6 (security leg, round six)

- **SHA:** `c108acbcfa2357862576092469828709bb6c4090`
- **ROOT:** `/workspace/farmtable-audit-xss-r6` — DIST present (copied), node_modules 79 (own lockfile)
- **Tree at close:** clean. `git status --short` empty, `git diff HEAD` empty.
- **Verdict:** APPROVE WITH CONDITIONS.
- **Full report:** `audit-xss-r6.md`. **Pre-registration:** `_prereg-audit-xss-r6.md`.

---

## What this leg was for

Security question: *`remote_data` is an attacker-authored map. Six rounds have been spent on it.
Is the harm closed, and is the boundary where this round thinks it is?*

Answer: **the harm is closed for today's sinks — partly by design, partly by coincidence — and the
boundary is one tree short of where the round claims it is.**

---

## Process note that should outlive this round: the cold pass was contaminated by the brief itself

The dispatch ordered both brief files read in full, first. COMMON §5 ordered Phase One onto disk
*before* §7. **§7 is inside the file dispatch ordered read first.** Unsatisfiable. I read §7 early.

Mitigation used, and I recommend it become standing form when contamination is unavoidable:
**enumerate the contaminant explicitly, in the pre-registration, before touching any code, and
bind every finding to a `SEEDABLE-BY-S7: yes/no` tag** with the rule that anything possibly seeded
is reported as Phase Two regardless of when it was found. This under-credits the cold pass, which
is the correct direction for the error to run.

**Structural fix for round seven: §7 must be a separate file.** A heading inside a document is not
an access control against an instruction to read the document.

---

## Findings, one line each

| # | Sev | Status | Finding |
|---|---|---|---|
| F1 | MEDIUM | latent | Import plants arbitrary keys (incl. `writable`) into collection `remote_data`; inert only via forced-`farmtable` + web early-return, two files, neither annotated |
| F2 | MEDIUM | live, derived | The round's replacement reachability comment names three collection writers and accounts for two — omitting `ImportCollection`, the only live one |
| F3 | MEDIUM | live, **demonstrated** | B11's population is `web/` only; Go-side consumers exist today (`convert.go:411`) and a planted Go consumer is GREEN |
| F4 | LOW | latent | New log line formats attacker-authored map keys with `%s`; log injection once a dynamic key meets an unrepresentable value |
| F5 | MEDIUM (non-sec) | live, **demonstrated** | Merge blocker vs real `main` **confirmed**, and its output falsely reports all four web test files as never executed |
| F6 | INFO | live, derived | Import errors on bad task-`remote_data` URLs but silently drops collection ones, with no warning to the caller |
| R1 | — | **refuted** | No import→relink escalation: collection platform is immutable after creation (`SetPlatform` only at CreateCollection and ImportCollection) |

---

## The measurement this leg contributed

Section 7 shipped three measured arms. I ran **a fourth it did not**: a Go-side consumer.

| arm | result |
|---|---|
| Go-side literal consumer `t.RemoteData["writable"]` planted in `internal/server/convert.go` | **GREEN / OUT-OF-POPULATION** |
| baseline after revert (`git status` empty, `git diff HEAD` empty) | **GREEN / BASELINE RESTORED** |

Every cell carries its arm, not just its colour. Both rows have execution evidence in
`_run-queue-log.md` with ROOT and DIST. **Bound: this is one plant in one file that I made. It is
not a claim about the Go tree at large.**

Plant presence was verified by `grep` on the file and the revert by working-tree emptiness —
**never by a reported exit code.**

### The bound this adds to B11's shipped bound

Shipped: *"catches the accidental addition; never observed catching a deliberate one."* That is
correct **and it is scoped to `web/`.** The full statement should read:

> Catches the accidental addition of a **literally-spelled consumer in the web tree**; blind to a
> computed spelling, and blind by construction to any consumer outside `web/` — including the
> Go-side consumers that exist today.

The guard's own limits block says this. The round's claim does not.

---

## Errors found in the briefs

1. **Reading order self-contradictory** (§5 vs dispatch vs §7's location). Cost: the cold pass.
2. **"`git ls-remote` cannot be stale" is false here.** Every tree's `origin` is
   `/workspace/farmtable`, a local clone pinned at `7a0f220`. `ls-remote origin main` returns
   `7a0f220`, contradicting §7's `cc9273`. A leg obeying the brief gets a confidently wrong
   answer. Same error class as your own §2 correction: instrument-scope evidence, question-scope
   conclusion.
3. **The merge blocker was verifiable all along.** `git cat-file -t cc9273` → `commit`. The
   objects were present with no ref pointing at them; absence of a ref was read as absence of the
   objects. The role brief's own *"reachability is not presence"* applies to the brief.
4. **The `writable` lead was stale at my SHA** — "zero Go files" measured at `7a0f220`; two at
   `c108acb`, both comments added by this round. Conclusion survives; the count did not. The
   instruction to re-measure was right.
5. **§2 node_modules inference** — self-corrected by the EM mid-run, before reliance. Noted only.

---

## What I did not do

No token requested and none needed. **No full suite, no `go vet`, no `go build`, no `npm test`, no
`dist` rebuild — therefore no claim from this leg about whether the branch is green.** Section 7's
`TestListUsers` red and the ~4.5% flake population are neither confirmed nor refuted here. I also
did not audit auth/scope grants generally, transport security, or dependency CVEs; my question was
`remote_data`.

---

## Recommendations, in the order I would do them

1. **F2** — amend the convert.go comment to name `ImportCollection` and its real (type-based)
   protection. The comment *is* this round's deliverable; it should not carry the error class the
   round was convened to eliminate. Cheapest fix with the highest symbolic value.
2. **F5** — teach `ci-suite-manifest.mjs` the discovery runner before merging. Its current output
   would tell a reader the branch deleted four test files, which is false and invites reverting
   the better mechanism.
3. **F3** — either qualify the round's claim with "in the web tree" everywhere it appears, or add
   a Go-side read census. `remoteDataWriteSites` (B4/B6) already does the AST walk for writes; the
   no-sixth-scanner ruling does not bite an AST walk.
4. **F4** — `%s` → `%q`. One character.
5. **F1** — fix-round item. Allowlist keys at the import deserialize boundary. At minimum,
   cross-annotate the two conjuncts so that whoever moves one finds the other.

---

## One observation for the axis, not for this round

Five rounds hunted render sinks and correctly found none. This round found the capability sink by
**changing the question from "where is it printed" to "where is it mentioned at all"**. That was
the right move and it worked.

The residue is that the *new* question also carries an implicit scope — "mentioned at all **in the
web tree**" — and that scope is not in the question as stated anywhere except the guard's own
limits block. The pattern to watch on round seven: **each time this axis has broadened the
question, the new question has arrived with a fresh unstated boundary, and the boundary has been
where the next miss lived.** Render→mention was the last one. Web→Go is this one.
