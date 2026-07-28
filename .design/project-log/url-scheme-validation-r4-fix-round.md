# URL Scheme Validation — R4 Fix Round

Date: 2026-07-28
Branch: `url-scheme-validation-r2`
Base: `6805daa`
Commits: `2f6500f`, `d12f572`, `4e58242`, `6551712`
Verdict: `FIXED` for X1–X7. X8 partially addressed; see "What I could not verify".

Follow-up to `url-scheme-validation-r3-fix-round.md`. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-xss-r4.md`.

## What this round was

R3 was "the measurements are right and the sentences above them are wrong."
R4 is narrower and more uncomfortable:

> The diff ships three new meta-oracles — a URL-binding scanner, an adapter-key
> source scanner, and a test-runner consumption gate — which are now the only
> thing standing behind large parts of the property, and **two of the three had
> measured fail-opens of exactly the class this round was convened to
> eliminate.**

None of the three was a live vulnerability. All three were *the instruments this
diff exists to install, failing open*. The round's job was to fix the
instruments, not the product.

## What changed

### X1 — `make test` runs the web guard (`2f6500f`)

`make test` was `go test ./...`. The client-side half of the URL-scheme property
lives in `web/src/util/*.test.ts` and had no executor in the default workflow, so
an agent following the documented Go-only loop never ran it. `make test` is now
`test-go` + `test-web`, both Dockerfiles `RUN npm test` before `npm run build`,
and `agents.md` says so in the two places an agent actually reads.

### X2, X5, X7a — the guard tracer (`d12f572`)

The URL-binding scanner decided "is this href binding guarded?" with an
existential search for a `safeHref(...)` assignment. Three holes, all measured:

- **Scope direction inverts with the predicate.** Once the question becomes
  "is this binding guarded *on every path*", the negative arm must be
  **file-scoped**, not block-scoped: a defeat in the enclosing function beats a
  guard in the loop body. Arm 1 stayed block-scoped existential; arm 2 is
  file-scoped universal. The two arms overlap, so every fixture asserts *which
  arm fired* by message, not merely that something failed.
- **`sourceFiles()` matched `.ts` only**, silently skipping `.tsx/.js/.mjs/.cts`.
  Widened, with an extension table as a fixture.
- **The walk was not identity-checked.** A directory-skip mutant was invisible.
  An independent `directoryCensus()` traversal now cross-checks the scanner's
  walk (`missed`/`extra`/`skewed`), including a count-neutral redistribution
  fixture.

Also fixed two assertions that passed *for the wrong reason*: a docblock-guard
rejection that was actually rejected by a stray backtick, and
`assignsFromSafeHref('$el')` where the `$` was consumed as a RegExp anchor and
matched nothing — passing vacuously.

### X4 — assertion-count pin (`d12f572`)

`web/scripts/run-tests.mjs` checked `totalAssertions === 0`. It now pins the
exact total (`EXPECTED_ASSERTIONS = 380`). This is the outermost level of the
regress: it kills *deletion* of any assertion below it and misses every
count-neutral corruption. The comment says exactly that, and says that updating
the constant is expected rather than suspicious.

### X6 — adapter-key scanner, regex → AST (`4e58242`)

Measured against the old scanner on five source shapes. Under
`map[string]interface{}{` and under a one-line literal, the old scanner **lost
nested keys entirely** (`nested=[]`), so the rule "nested keys may not be
URL-bearing at all" never fired on them — the arm was not wrong, it was
*absent*. That is worse than the misattribution the review reported. And
`internal/server/server.go`, which writes remote_data by index assignment with
no builder-function name, returned `top=[] nested=[]`: invisible, and not even
in the adapter list.

Replaced with a `go/ast` walk; keys via `strconv.Unquote`. `server.go` added to
the scanned set. `TestRemoteDataLiteralKeysIn` fixtures the scanner's own
behaviour on 7 shapes plus a parse-error case.

X7b: `noteDeclaresBaseDependence` read any occurrence of `"base-dependent"` as a
declaration, so a note saying it is **not** base-dependent read as saying it is.
Now negation-aware over a 64-char preceding window, 13 rows, anti-vacuity on
both outcomes.

### X3 — recursion, and the write-site count (`6551712`)

`sanitizeRemoteData` walked the top level only. The comment justifying that said
nested carriers do not serialise. **Measured, false:**

```
structpb.NewStruct(map[string]any{"parent": map[string]any{"html_url": "javascript:alert(1)"}})
  -> *structpb.Struct, nil error, URL intact
```

Nested maps are exactly what structpb *does* support. So a `javascript:` URL at
`remote_data.parent.html_url` reached the client, and the GitHub adapter writes
`parent` and `sub_issues_summary` as nested maps today.

Both traversals now recurse over `map[string]any`, `[]any` and
`[]map[string]any`. The import-side check had the same top-level-only bug, so an
import carrying a nested `javascript:` URL was **accepted on the way in and
silently dropped on the way out** — accepted by one half of the property and
rejected by the other.

`TestSanitizeAndImportAgreeAtEveryDepth` drives both over 63 generated maps
(7 carrier shapes × 9 leaves) and requires that one errors exactly when the
other drops. The single documented disagreement — a URL-bearing key holding an
unvalidatable scalar, which the sanitizer drops and the import accepts — is
pinned *as* the asymmetry, so it cannot quietly become two.

**The brief said four write sites. There are six.** Instead of trusting the
number I wrote `TestEveryRemoteDataWriteSiteSanitizes`, which scans the non-test
sources for `RemoteData` field assignments. It found two more shipping the map
raw: `export_import.go:139` (collection export) and `:332` (collection import).
`server.go:661` is exempt with a stated reason. A seventh site added later fails
that test rather than becoming the next silent hole.

## How I verified it

- `go build ./...` — exit 0, no output.
- `go vet ./...` — 4 findings, all pre-existing and fenced (copylocks at
  `server.go:1509,1619,1827,2004`). `server.go` untouched by this round.
- `make test` — exit 0, `PASS: 4 test file(s), 380 assertions`.
- `gofmt -l internal/server/` — clean.
- **Mutation testing, every row re-run before being called killed.** The suite
  has a measured 4.50% flake (Wilson CI [2.39%, 8.33%]) concentrated in
  `TestWatchTasks_*`; a single-run matrix is ~71% likely to contain a spurious
  RED, and a spurious RED reads as "mutant killed", so the bias is toward
  flattering the suite. Every row below was run twice.
- Deliverable 0 (`renderProbeLink`) reproduced end-to-end through `make test`
  with **both controls**: drop the defeat → GREEN 337; drop the guard → arm 1
  fires with a *different* message. That is what proves arm 2 fired for its own
  reason rather than riding arm 1.

### Mutants that survived, and why they are recorded rather than hidden

- **`P2cn`** — walking `[]any` elements under the parent key instead of `""`.
  **Equivalent mutant.** The generic slice arm is reachable only when the key is
  *not* URL-bearing, and both spellings are then non-URL-bearing, so every
  downstream branch behaves identically. Recorded as equivalent, with the
  argument, not as a kill.
- **`P11`** — removing the depth bound from `validateRemoteDataURLs`.
  **Redundant guard, not a hole.** There are two bounds on the import walk, one
  in `validateRemoteDataURLs` and one in `validateRemoteDataValue`, and the walk
  alternates between them. Removing either leaves the other enforcing the
  property: with `P11` applied the cycle test still terminates *and* still
  reports the `levels deep` message, which is what the GREEN measures. They
  differ only for an empty map already past the bound, where the surviving guard
  returns nil — an empty map has nothing to validate, so that is not a
  security-relevant difference. Mutation testing is correct to flag each bound as
  individually removable; the belt-and-braces is deliberate and is kept.

- **`P10`** — deleting the agreement sweep's dirty-row anti-vacuity floor.
  **Genuinely unkilled.** It is the outermost anti-vacuity assertion in the Go
  suite, and there is no level above it to notice its deletion. The web suite
  terminates this same regress with `EXPECTED_ASSERTIONS`; **the Go suite has no
  analogue on this branch.** That is a real, named gap, not an oversight.

## Incident: the crash stranded a live mutant

The container crashed mid-run with the mutation harness active. The harness
mutates tracked source in place and restores only at the end; `/tmp` was wiped
by the restore, taking both its snapshot directory and its output log.

I inspected every mutation site before touching anything. **One was live:**
`validateRemoteDataValue`'s generic map branch held
`validateRemoteDataURLs(path, tv, 0)` — mutant `P5cn`, the depth-counter reset.

Two things matter about this:

1. `refs/preserve/xss-r4/wip-snapshot` (`27e0ee0`), taken by the coordinator
   during recovery, **contains that mutant.** It is not a clean copy.
2. **`P5cn` was a mutant that had survived the suite**, so a green test run would
   not have caught it. Inspection did. A recovery procedure that verifies by
   running tests would have adopted it silently.

Lesson for the harness: restore before mutating the *next* row is not enough;
it needs an idempotent on-start restore, and its snapshot must live somewhere
`/tmp` cleanup cannot reach.

After the revert, `P5cn` is RED — killed by
`TestRemoteDataTraversalsTerminateOnACycle`, which did not exist when `P5cn`
first survived.

## What I could not verify

- **X8 is only partly addressed.** `structpb.NewStruct` rejects `[]string`,
  `[]map[string]any` and `json.RawMessage` (measured; each returns a nil result).
  Because `convert.go:358` discards the error, **one unrepresentable value nulls
  the entire `remote_data` silently.** I deliberately did **not** make those
  types serialise: doing so would start shipping data to the client that does not
  reach it today, which is a widening of exposure and not this round's call.
  The recursion fix is orthogonal and stands on its own. The discarded errors at
  `convert.go:358,530,555,558` remain.
- **The client-side scrub is not a compensating control.** `Task.remoteData` is
  read by nothing in `web/src` (test O-9). Any comment implying otherwise was
  corrected, but the underlying point is that the server-side sanitizer is the
  only control here.
- **`internal/server/scopes.go` is left dirty on purpose.** It is pre-existing
  gofmt-alignment noise in a file the round baseline explicitly fences. I neither
  adopted nor destroyed it.
- The four `go vet` copylocks, the `web/dist` clean-checkout defect (#100), CSP
  absence (#85), the `#195` markdown/DOMPurify branch and its two
  `unsafeHTML(renderMarkdown(...))` sinks (#163), the `#194` branch, absence of
  CI (#22) and the merge seam (#115) are all fenced out of scope and untouched.
  The `ft-inspector-desc.ts` change is a **comment only** — the sink is
  unchanged.
