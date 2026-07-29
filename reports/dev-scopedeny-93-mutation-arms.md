# scopedeny-93 — mutation arms and expected RED targets

**Agent:** `dev-scopedeny-93`
**Written:** 2026-07-29, at wind-down, because these arms produced **no commits**
and would otherwise exist nowhere.
**Branch the arms were run against:** `hardening/deny-unrecognised-type`,
clone `/workspace/dev-scopedeny-93`, base `faf1c8c`, tip `951502d`.
**Bundle carrying that branch:**
`/scion-volumes/scratchpad/projects/farmtable/bundles/dev-scopedeny-93-complete.bundle`

Every arm below was **applied, observed, and reverted**. None was committed.
That is the whole reason this file exists: the observation is real, the artefact
is not, and without this page someone re-derives it from scratch.

---

## Arm 1 — pin-validation mutation (the only mutation arm actually run)

**Purpose.** Prove the named-arm pin in `22dbfaf` is non-vacuous. A pin that
cannot fail is worse than no pin, because it advertises protection it does not
provide.

**Target file.** `internal/server/scopes.go`, the `defaultScopesByUserType` map.

**Mutation applied:**

```
-	"human":           {ScopeWildcard},
+	"human":           {ScopeTaskRead},
```

**Expected RED target.** Both pins in
`internal/server/default_arms_pin_test.go`:

- `TestPinDefaultScopesForNamedUserTypes` — must fail naming the arm, with the
  before/after scope sets.
- `TestPinWildcardTierMembership` — must fail identifying `"human"` as having
  left the wildcard tier.

**Observed (ROOT=`/workspace/dev-scopedeny-93`, DIST=present):**

```
--- FAIL: TestPinDefaultScopesForNamedUserTypes
          was: [*]
          now: [task:read]
--- FAIL: TestPinWildcardTierMembership
    "human" no longer resolves to wildcard (got [task:read]).
```

**Revert.** `scopes.go` restored from a byte copy; `git diff` against HEAD
confirmed empty before continuing. The pin then passed again.

**Why it matters beyond this branch.** The pin exists so that whenever the
open SSO-privilege question is answered, the change surfaces as a RED naming the
arm that moved. This arm is the evidence that it will. Re-run it before trusting
the pin after any refactor of the scope table.

---

## Arm 2 — reachability probe on the two halves (behavioural, not a code mutation)

**Purpose.** Establish whether the two halves of the defect are independently
load-bearing, rather than asserting they are coupled.

**Method.** Apply only the `RequireScope` change (`79f442a`) and leave the
default arm at its `faf1c8c` behaviour, then drive the four escalation cases.

**Expected RED target.** The four escalation cases must flip from GRANTED to
denied with the default arm untouched.

**Observed.** They did. This is the measurement behind the finding that the
`RequireScope` half alone stops the escalation, and that the default arm's
distinct contribution is a loud refusal to mint rather than security. Recorded
in the findings report; the intermediate state was never committed.

---

## Expected RED targets for every oracle on the branch

These *did* produce commits, listed so the oracle and its target are legible
without reading the diff. Each was demonstrated RED before the change that
turned it GREEN.

| Oracle commit | RED measured at | What must fail, and how |
|---|---|---|
| `02e68f6` | `faf1c8c` | 4/4 escalation cases reach `collection:admin` GRANTED via types `reviewr`, `superuser`, `Admin`, `""` |
| `7c324cb` | `79f442a` | unrecognised type still resolves to a usable scope set instead of erroring |
| `99097de` | `faf1c8c` | `ft token create` mints for 4/4 unrecognised types; `ft user create` persists 4/4; `CreateSessionToken` mints for 3/3 |
| `bb34c5c` | `c8be951` (own branch) | 2/2 CLI-owned tokens still hold no scopes after re-running the CLI |
| `ff3542c` | `0b6d67e`'s parent (own branch) | 3/3 stale claims present in `ft token update` help text |
| `49b3542` | `ff3542c` (own branch) | scope-less token renders identically to a healthy one in `ft token list` |

**Positive controls** accompany each denial oracle — one passing case per shipped
user type on each of the three create paths. A gate that refuses `revieww` but
also refuses `reviewer` is not a gate, and the controls are what distinguish the
two.

---

## Two instrument defects found in my own arms

Recorded because both are the kind that make an arm report success falsely.

1. **Substring matcher defeated by line wrapping.** The first draft of the R7
   help-text oracle missed `"interpreted as wildcard (full access)"` because the
   phrase straddles a hand-wrapped line break. Two of three stale claims fired
   and the third did not, which would have read as a partial pass. Corrected by
   normalising whitespace (`strings.Join(strings.Fields(...), " ")`) before
   matching. Any text-scanning arm against hand-wrapped prose has this hazard.

2. **Oracle passing for the wrong reason.** The first CLI deny oracle used
   `--user <id>`, but `ft token create` takes a positional argument. Cobra
   returned "unknown flag", the command errored, and the deny assertion passed —
   on a usage error, not on a rejection. Corrected to positional args, which
   produced the genuine 4/4 RED. **An oracle that passes for the wrong reason is
   worse than no oracle**, and the only thing that caught it was reading the
   failure text rather than the exit status.

---

## Reproduction notes

- `internal/cli` requires the `//go:embed all:web/dist` tree to build;
  `internal/server` and `internal/serverapp` do not. Fresh worktrees need
  `web/dist` copied in from `/workspace/farmtable/web/dist`. Do not delete or
  move the canonical copy and do not build a frontend to obtain one.
- The branch's middle commits do not build on their own: `rbac_test.go` kept a
  one-value `DefaultScopesForUserType` signature after `c8be951` moved it to two
  values, with the repair uncommitted in the working tree. Arms run during the
  task therefore measured the working tree, not a commit. `1cbf643` records the
  repair; only the tip is independently reproducible.
