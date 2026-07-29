# CONFIRMED

**Backlog item C — "forged audit rows attributed to real people via the import email remap."**
The defect exists. Every link in the chain is measured. Severity call: **High**, on the rule
em-hardening set (indistinguishability decides), with one structural limit stated in full so the
call can be revised if that limit is weighted differently.

- **Base:** `main` at **`faf1c8c`**, read from the object store at `/workspace/farmtable`.
  My own tree (`/workspace/farmtable-review-r8` @ `901670e`) does **not** contain `faf1c8c`
  **[MEASURED — `cat-file -t` → `fatal: Not a valid object name`]**, so nothing here was read
  from it.
- **Reviewer:** review-xss-r8. Verify-only. No code written, no fix proposed, no build/vet/test
  run, no git write, no clone or worktree created.

## Path filter — the quintupling hazard, and why my counts are immune

Every measurement is **commit-addressed** (`git -C /workspace/farmtable grep … faf1c8c -- …`,
`git show faf1c8c:…`). That reads the *commit tree*, not the filesystem, so `.claude/worktrees/`
and untracked `web/dist` are structurally outside the corpus rather than filtered out of it.

| control | result |
|---|---|
| files in commit `faf1c8c` | **435** |
| paths under `web/dist` in commit | **0** |
| copies of `export_import.go` in commit | **1** |
| **NEAR-MISS ARM:** same file counted on the *filesystem* under `/workspace/farmtable` | **5** |

**[MEASURED]** The hazard is real (1 vs 5) and the instrument does not exhibit it.

---

## 1. Does the import path remap actor identities? **YES.**

**`resolveImportUsers`** (`internal/server/export_import.go`). For each user in the payload it
calls **`s.store.GetUserByEmail(ctx, *exported.Email)`**, and on **exactly one match** executes
`mapping[exported.ID] = matches[0].ID` — binding the payload's user ID to the **real existing
account's UUID**. On zero or multiple matches it mints a new user instead (multiple emits an
`Ambiguous email` warning). **[MEASURED — read in full]**

The literal token `remap` appears nowhere in this path; its only occurrences tree-wide are two
test strings about change IDs **[MEASURED]**. The defect is real but is **not** findable by
grepping the word in the backlog entry — worth recording, since that is a plausible reason it sat
unverified.

## 2. Is the remapped identity attacker-controlled? **YES — fully, from the payload.**

`exported.Email` is `users[].email` of the caller-supplied import document (`req.GetData()`).
It is **not** derived from the authenticated caller. **The caller's own authenticated identity is
never written to any imported row** — `RequireIdentity` gates entry and its result is discarded.
**[MEASURED — `RequireIdentity(ctx)` return is assigned to `_` in `ImportCollection`]**

So the actor recorded on an imported row is chosen by the document, and the one thing the server
knows for certain — who actually called — is recorded nowhere.

## 3. Do rows persist that identity as the ACTOR? **YES, and the timestamp too.**

`importedChange` → `store.ImportChange{AuthorID: authorID, CreatedAt: c.CreatedAt}` →
`EntStore.ImportCollection` → `tx.Change.Create().SetAuthorID(imported.AuthorID)` /
`.SetCreatedAt(imported.CreatedAt)`, committed in the import transaction. **[MEASURED — read
end-to-end]** `importedComment` does the same for comments.

**Column arithmetic for the `changes` table: ENUMERATED 7 = ATTACKER-CONTROLLED 5 + SERVER-GENERATED 2.**

| column | source |
|---|---|
| `author_id` | **attacker** — selects *which real user* via the email match |
| `field_name`, `old_value`, `new_value` | **attacker** — payload verbatim |
| `created_at` | **attacker** — payload verbatim, so the row is **arbitrarily backdatable** |
| `id`, `task_id` | server — fresh `uuid.New()` |

## 4. Is a forged row distinguishable from a genuine one? **NO. This is the severity decider.**

**Three independent instruments, all agreeing there is no provenance/source/imported marker
anywhere in the record. CHECKED 3 = AGREE 3 + DISAGREE 0.**

1. ent generated `change.Columns` — 7 columns, listed above, none provenance.
2. `store.ImportChange` struct — 7 fields, none provenance.
3. `proto/farmtable.proto` `message Change` — `id`, `task_id`, `field`, `old_value`,
   `new_value`, `changed_by`; none provenance.

Reinforcing, all **[MEASURED]**:
- **The containing collection carries no attribution either.** `collection.Columns` =
  `id, name, description, platform, remote_id, remote_data, created_at, updated_at`. **No
  `created_by`/owner.** And `collCreate.SetCreatedAt(p.Collection.CreatedAt)` takes the
  collection's own timestamp from the payload, so the container is backdatable too.
- **Nothing logs the importer.** `log.`/`slog` occurrences: `export_import.go` **0**,
  `auth.go` **0**.
  **POSITIVE CONTROL** — the same predicate against `scopes.go`, known to log, returns **1**, so
  the instrument can say yes. Both test files returned real content (**32,304** and **8,514**
  bytes), so these are true zeros and not the silent-zero failure. Control state: **PUBLISHABLE**.

The forged row carries the victim's **genuine** UUID — not a copy or a lookalike — at an
attacker-chosen time, in a schema with no field that could contradict it, inside a container that
records neither its creator nor a trustworthy creation time, with no log of who called. **There is
no after-the-fact discriminator in the system as measured.**

**The one structural limit, stated because it is the strongest argument against my severity call.**
`ImportCollection` **always creates a new collection** (`tx.Collection.Create()`); there is no
merge-into-existing path **[MEASURED]**. An attacker therefore **cannot rewrite the history of an
existing collection**. The defect is *manufacturing a fabricated history attributed to real
people*, not *tampering with existing records*. If em-hardening weighs that limit as making the
artefact contextually suspicious, this drops to Medium. I do not think it does, because nothing in
the data marks the collection as imported and its timestamps are attacker-chosen — but the call
turns on that judgement and it should be made explicitly rather than inherited from me.

## 5. Reachability — gated, but not narrowly

`ImportCollection` requires **`RequireIdentity`** *and* **`RequireScope(ctx, ScopeCollectionAdmin)`**
**[MEASURED]**. It is confirmed inside the identity-enforcement perimeter — the legacy-auth
rejection table in `identity_enforcement_test.go` includes an `ImportCollection` case. So an
unauthenticated stranger cannot reach it, consistent with the owner's "IAP is in front of
everything".

But `collection:admin` is held more widely than the name suggests. **`DefaultScopesForUserType`:
ENUMERATED 7 named types = WILDCARD 3 + RESTRICTED 4**, plus the default branch.

- **Wildcard (can import): `admin`, `human`, `service_account`** — and the **`default` branch
  returns `nil`, which `RequireScope` treats as wildcard**, so *every unrecognized type, including
  the empty string*, can import. The code's own comment flags this as the dangerous case.
- **Restricted (cannot import): `agent`, `reviewer`, `orchestrator`, `viewer`** — none carry
  `collection:admin`.

`RequireScope` has **three** pass-through paths **[MEASURED]**: open-access mode
(`authEnforcedKey == nil`), `len(scopes) == 0`, and `"*"`.

**Net: not any authenticated principal — agents and reviewers are excluded — but every ordinary
human user, every service account, and every mistyped or unset user type can do this.** That is
the practically important half: this is reachable by legitimate non-administrative humans, not
just by admins.

---

## Severity: **High**

On em-hardening's stated rule — *"if a forged row is distinguishable from a genuine one this is
Low; if it is not, it is High"* — the answer to Q4 is **not distinguishable**, measured three ways
with a positive control on the logging negative. Audit rows that can be forged are worse than
absent ones because they are believed, and these are believed with a real person's name on them at
a time of the attacker's choosing.

**Not raised to Critical** because it requires an authenticated principal holding `collection:admin`
and cannot alter existing collections' history.

## Method notes and one self-caught instrument slip

Cited by identifier throughout. Figures tagged, arithmetic published, negatives controlled.
**Slip:** in the logging sweep I wrote `grep -c … || echo 0`, which the apparatus brief prohibits;
it printed the grep's `0` *and* the echo's `0`. The value is unambiguous here (both zero) and the
byte-count corroboration is what actually carries the negative, but the construct was prohibited
and I used it. Recorded rather than quietly re-run.

**UNCHECKED, declared:** whether any deployment-layer component outside this repository (IAP
access logs, a reverse proxy, database-level audit) records the importer. My negative covers the
application as committed at `faf1c8c` only. If such a log exists it does **not** change Q1–Q3, but
it could bear on Q4 and therefore on severity.
