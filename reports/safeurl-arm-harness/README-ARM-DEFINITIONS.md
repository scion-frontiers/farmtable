# safe-url Arm A / Arm B — arm definitions and expected red targets

Written out in prose because **these are non-ref artefacts**: nothing in this
directory is pointed at by a git ref, so no `fsck` sweep and no `git bundle` will
carry it. If this container dies, this directory is the only copy of how the
measurement was constructed.

Companion report (the findings): `../safeurl-union-table.md`.

## Did the arms produce commits?

**The arms themselves produced NO commits.** The harness lives only in
`/tmp/arm` (now mirrored here). The *write-ups* of the arm results are committed
in the leg clone `/tmp/leg-safeurl`, branch `adjudicate/safeurl-union-table`.
Stated explicitly rather than reported as "nothing to bundle".

## Subjects under test

| Label | Source | Provenance check |
|---|---|---|
| `MAIN.pristine` | `main.pristine.ts` | `git hash-object` → `659ef5823260037833b0cdfa141e3005f2c785cb` — matches the named MAIN impl blob |
| `BRANCH.blocking` | `branch.pristine.ts`, flag `false` | `git hash-object` → `d85bb5bdc37d4c1a197f3ccec0def6a0cb0fb6cf` — matches the named BRANCH impl blob |
| `BRANCH.carveout` | `branch.flagon.ts`, flag `true` | config selection, `numstat 1 2` — **not a mutant** |
| `MAIN.disarmed` | `main.disarmed.ts` | mutant, `numstat 1 63` |
| `BRANCH.disarmed` | `branch.disarmed.ts` | mutant, `numstat 1 25` |

Both pristine files were re-hashed **before** any run. A pristine subject that
does not hash back to its named blob invalidates every number downstream, so the
check is the first thing the harness does, not the last.

## Arm A — CONFORMANCE. Definition and expected reds.

**Definition.** Run each of the three *non-mutant* subjects against all 81 union
rows. A row is a pass iff the subject's verdict (and, where the row asserts a
returned value, that value) equals the row's assertion.

**Expected red targets — stated before the run:**

1. Each subject **must** pass 100% of its own side's rows. This is the control.
   If `MAIN.pristine` fails any of MAIN's 49, or `BRANCH.blocking` fails any of
   BRANCH's 45, the union table was mis-transcribed from the blobs and every
   other number in the report is void. *Both passed 49/49 and 45/45.*
2. Each subject **must** go red on the other side's contradicted rows — that is
   the whole reason the tables were declared contradictory in Phase 1. A green
   run here would mean the Phase 1 stop was wrong.
3. `BRANCH.carveout` is expected to go red on **BRANCH's own loopback rows**,
   because those rows were written under the flag-`false` assumption. Rows that
   change verdict between BRANCH configs are the config-dependent set.

## Arm B — KILL POWER. Definition and expected reds.

**Definition.** Replace each implementation's decision body with a passthrough,
keeping the signature, the export, the docblock and the companion export:

- `MAIN.disarmed`: body → `return raw ?? undefined;`
- `BRANCH.disarmed`: body → `return raw ?? null;`

Run each side's own rows against its own disarmed build. A row **KILLS** if it
now fails; it is **VACUOUS** if it still passes.

**Expected red targets — stated before the run:**

1. `numstat` must be **non-zero** for both. `0` means the edit did not land and
   the arm has gone vacuous silently — the specific failure mode the coordinator
   named. *MAIN `1 63`, BRANCH `1 25`.*
2. Every **rejection** row must KILL, on both sides. A rejection row that
   survives a passthrough is asserting nothing.
3. `MAIN.disarmed` is expected to leave **all 16 identity-accept rows vacuous**,
   because MAIN asserts `safeHref(input) === input` and a passthrough returns
   `input`. This is structural, not incidental.
4. `BRANCH.disarmed` is expected to be **killed by the normalising accepts**
   (case-folded, trimmed, trailing-slash) and to leave vacuous only accepts whose
   input is already in normal form.

Predictions 2–4 all held. Prediction 1 held.

## The vacuity floor — rows that pass against ANY implementation

`null` (row 30) and `undefined` (row 31) are vacuous on both sides under
passthrough, because `raw ?? X` reproduces the asserted result. They are the
floor: **2 rows that cannot kill anything.** Any per-side vacuous count should be
read against that floor, not against zero.

## C2-dependence — computed, never assumed

A row is C2-dependent iff it parses, resolves to `http:`, and carries **no**
userinfo (userinfo rows are already decided by the C3 ruling regardless of C2):

```js
function c2dep(r){
  const a = arg(r);
  if (typeof a !== 'string') return false;
  let u; try { u = new URL(a); } catch { return false; }
  if (u.username || u.password) return false;
  return u.protocol === 'http:';
}
```

**21 of 81 rows**: 43, 49, 50, 51, 52, 53, 54, 56, 58, 59, 60, 62, 63, 64, 65,
66, 67, 68, 69, 70, 71. These must be reported per-configuration.

This predicate is what exposed the row-62 mislabel: a row named "backslash
userinfo trick" that the predicate classified as C2-dependent, i.e. containing no
userinfo at all.

## Reproducing

```
node transpile.mjs   # pristine + disarmed
node transpile2.mjs  # flagon
node run.mjs         # -> results.json
node analyse.mjs ; node detail.mjs ; node mktable.mjs   # -> armtable.md
```

Requires `/workspace/farmtable/web/node_modules/typescript` (the repo's own
compiler; nothing was installed for this).

## What is NOT here, deliberately

No merged implementation, and no merged test file. C1 and the reject-UX question
are open, and C2's ruled default (**plaintext http allowed to any host**) is
implemented by **neither** subject above — MAIN has no switch, and BRANCH's
switch is loopback-scoped and inverted. Building against any of those now would
make one of them the default by being the one that exists.
