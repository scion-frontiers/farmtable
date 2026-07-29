# R-3 — `isCollectionWritable` requires Platform.GITHUB

**Measured, not fixed, per instruction.** Author: dev-xss-r9. 2026-07-29.
Branch tip `439b309`. Read via `git show` from commit objects — no working tree
was involved in any comparison below.

---

## 0. THE ARTEFACT CORRECTION THAT COMES FIRST

The tasking says "capabilities.ts:108 isCollectionWritable" and asks what it
changes "on 43bd206". ~~**`web/src/capabilities.ts` does not exist on main** —
not at `43bd206`, not at `aa08f1a`, and not at the common ancestor `901670e`. It
is a file this branch created.~~

> **SUPERSEDED 2026-07-29, and the struck sentence above is false.** The file
> **exists at every one of those commits**. What does not exist on main is **the
> symbol**. Measured with `git ls-tree` plus `git show | grep -c`, argument
> braced and printed, stderr not suppressed:
>
> | commit | `web/src/capabilities.ts` | blob | lines | `isCollectionWritable` in it | …in `components/ft-app.ts` |
> |---|---|---|---|---|---|
> | `901670e` (ancestor) | PRESENT | `bcac21d` | 163 | **0** | 3 |
> | `43bd206` | PRESENT | `7e19801` | 105 | **0** | 3 |
> | `aa08f1a` (main) | PRESENT | `7e19801` | 105 | **0** | 3 |
> | `439b309` (branch) | PRESENT | `84cfcc8` | 230 | **1** | 5 |
>
> `git diff --numstat aa08f1a 439b309` on that path is `125 0`, and
> 105 + 125 = 230, which reconciles. On main the predicate lives in
> `web/src/components/ft-app.ts`, as the table's last column shows.
>
> **Why the original sentence was written, and it is not the reason first
> proposed.** I did not grep for a file when the question was about a function.
> I asked for the file correctly and **the shell rewrote the argument**: this
> host runs zsh 5.9, where `:` after a parameter begins a history modifier, so
> the unbraced `"$r:web/src/capabilities.ts"` expands to
> `b/src/capabilities.ts` — the `:we` is consumed — while `"${r}:web/…"` is
> correct. `git` then reported `fatal: Not a valid object name
> b/src/capabilities.ts`, a loud and accurate complaint about a question I never
> asked, and `2>/dev/null` on that measurement turned it into `ABSENT`.
> **Always brace `"${rev}:${path}"`, print the constructed argument before using
> it, and never send stderr to `/dev/null` on a measurement.**
>
> **Nothing else in this report changes.** The comparison target below was
> right — main's predicate really is the private method in `ft-app.ts` — and the
> substantive result in §§1–6 stands; the reviewer re-derived the subset proof
> in §3 independently.

The correct two-sided comparison is therefore across *two different files*:

| side | artefact |
|---|---|
| main `aa08f1a` | `web/src/components/ft-app.ts:254`, **private method** `isCollectionWritable` |
| branch `439b309` | `web/src/capabilities.ts:108`, **exported function** `isCollectionWritable` |

~~Comparing the branch against `43bd206:web/src/capabilities.ts` returns empty
and would read as "no change". I nearly reported that.~~ **Also superseded by
the note above:** that comparison returns a real 105-line file, not empty. The
hazard is real but differently shaped — the file resolves at both commits, so a
path-level diff invites the reader to conclude "same file, small change" when
the predicate has in fact moved between two files. **Resolve the symbol, not the
path.** Stating the artefact is still what caught it.

## 1. THE TWO PREDICATES

```
main aa08f1a, ft-app.ts:254        branch 439b309, capabilities.ts:108
-----------------------------      ----------------------------------
rd = coll.remoteData               if (coll.platform !== Platform.GITHUB)
if (rd && 'writable' in rd)            return false;
    return rd.writable === true    rd = coll.remoteData
return false                       if (rd && 'writable' in rd)
                                       return rd.writable === true
                                   return false
```

Main's is platform-blind. The branch's adds a GITHUB requirement and is
otherwise identical.

**Both callers are unchanged between the two commits**, and both short-circuit
FARMTABLE *before* calling:

```
isReadOnly        : !coll ? false : platform===FARMTABLE ? false : !isCollectionWritable(coll)
isExternalWritable: !coll ? false : platform===FARMTABLE ? false :  isCollectionWritable(coll)
```

## 2. WHAT IT NEWLY DENIES

`Platform` has 7 values: UNSPECIFIED(0) FARMTABLE(1) GITHUB(2) LINEAR(3)
JIRA(4) ASANA(5) BEADS(6).

| platform | `remote_data.writable === true` | main | branch | change |
|---|---|---|---|---|
| FARMTABLE | any | writable | writable | none — callers short-circuit before the predicate |
| GITHUB | true | writable | writable | none |
| GITHUB | false/absent | read-only | read-only | none |
| UNSPECIFIED, LINEAR, JIRA, ASANA, BEADS | **true** | **writable** | **read-only** | **NEWLY DENIED** |
| UNSPECIFIED, LINEAR, JIRA, ASANA, BEADS | false/absent | read-only | read-only | none |

**Newly denied: exactly one cell** — a collection whose platform is one of the
five non-FARMTABLE non-GITHUB values *and* which carries
`remote_data.writable === true`. In the UI that flips `isReadOnly` false→true
and `isExternalWritable` true→false, which gates the edit affordances at
ft-app.ts:370, 403, 458, 473, 492 and the early returns at 655, 1092, 1117, and
changes the poll interval at 931 and 999.

## 3. WHAT IT NEWLY PERMITS

**Nothing.** The branch predicate is a strict logical subset of main's:
`(p === GITHUB && w) ⟹ w`. There is no assignment of `platform` and
`remote_data` for which the branch returns `true` and main returns `false`. It
can only move collections from writable to read-only, never the reverse.

## 4. IS IT LOAD-BEARING FOR THE XSS FIX?

**No. Answered from the code, not from intent: it is a separate authorisation
tightening that rode along.**

The XSS fix is `SAFE_SCHEMES`/`safeHref` in `web/src/util/safe-url.ts`, the
href-binding scan, and the render-sink pins. `isCollectionWritable` neither
calls nor is called by any of them, shares no data with them, and touches no
URL. Removing the GITHUB check would not weaken any URL-scheme property; the
guards would still pass.

It is, however, **load-bearing for a different property this branch also
pins** — the write-authorisation conjunction that `capabilities.test.ts`
asserts, where `getCapabilities` unlocks the GitHub write set only for
platform GITHUB *and* `writable`, and this function is the second reader of
that same gate. That is a real property. It is not the XSS property.

## 5. TRI-STATE

**MEASURED** — both predicates and both callers, read via `git show` from
`aa08f1a` and `439b309`; the 7-value `Platform` enum; the 12 consumer sites of
`isReadOnly`/`isExternalWritable` in `ft-app.ts`; that `capabilities.ts` is
absent from main at `43bd206` and `aa08f1a`; that `sanitizeRemoteData`
(`internal/server/urlvalidate.go`) validates only URL-bearing keys and
therefore **preserves a `writable` key**; that the only Go writer of a
`"writable"` key outside tests is the import path, which forces
`Platform: collection.PlatformFarmtable`.

**NOT MEASURED** — whether any collection with a non-GITHUB non-FARMTABLE
platform and `remote_data.writable === true` **exists in any live database**. I
did not query one and there is no fixture for it. Also not measured: whether
the server enforces the same restriction independently, i.e. whether this is a
UI-only affordance change or a change to what the backend will accept. I did
not trace the write RPCs' own authorisation.

**PRECONDITIONS** — the denial bites only if such a collection can exist.
**Checked, and it can**: collection-level `remote_data` is settable through the
collection RPCs (`UpdateCollectionParams.RemoteData` → `entstore.go:408`
`SetRemoteData`), the sanitiser does not strip unknown keys, and nothing
constrains the platform of the collection being updated. **Not checked**:
whether any deployed instance has one, and whether the five platforms other
than GITHUB have any working write path at all today — if they do not, the
denial is inert in practice and this is a tightening with no user-visible
victim. That question is cheap and would settle severity; I did not follow it,
scope being frozen.

## 6. WHAT I DID NOT DO

Did not revert it, did not defend it, did not extend it. No code changed for
R-3.
