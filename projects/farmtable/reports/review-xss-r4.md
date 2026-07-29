# review-xss-r4 — code review of `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`

Range: `6805daa..e6bda71` (6 commits). Axis: correctness, architecture, readability,
and whether the code says true things about itself.

**STATUS: OPEN PASS ONLY. NO VERDICT YET.** Checklist not yet received; Part II not yet
read. Every finding below is tagged `[OPEN]` and was formed from the diff and the tree
alone, before reading `_xss-r4-method-block.md` or any targeting.

---

## 0. Identity and environment, confirmed from content not label

| check | value |
|---|---|
| `git rev-parse --show-toplevel` | `/workspace` |
| `git rev-parse HEAD` | `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1` ✓ matches the SHA in Part I |
| `git status --porcelain` | 0 lines |
| commits in `6805daa..e6bda71` | 6 ✓ |
| `internal/server/scopes.go` | clean, as Part I said it would be |
| probe cells left dirty | **0** (no probes run yet; nothing executed) |
| scratch path | `/var/tmp/scratch-review-xss-r4/` (per 00:12Z addendum), created, empty |

**Runs executed by me so far: NONE.** Everything below is reading, grepping and AST
reasoning by eye. I consume the EM-measured gate table and the twice-run baseline at
`reports/_xss-r4-baseline-measurement.md`; per Part I §Gates I have not reproduced them,
and I do not cite the green as evidence the gate *works* — only that it is green at
`e6bda71`.

**MISSING INPUT, reported rather than substituted:** `reports/dev-xss-r4.md` **does not
exist.** `ls` on the reports directory returns only `_xss-r4-baseline-measurement.md` for
this round. Part I flagged this as possible. I have used the in-tree
`.design/project-log/url-scheme-validation-r4-fix-round.md` instead, and I treat every
sentence in it as a claim, not a description. One consequence I want on the record: the
dev leg's mutation-matrix numbers exist only inside the artefact under review, so nothing
I have can falsify them, and I have not tried to.

---

## 1. What the diff actually is

Six commits, 2430 insertions. Read by intent rather than by file:

- **`2f6500f`** — `make test` becomes `test-go` + `test-web`; both Dockerfiles gain
  `RUN npm test`; `web/scripts/run-tests.mjs` gains an exact-equality assertion-count pin;
  `agents.md` updated to match.
- **`d12f572`** — the web guard tracer: template-literal-aware blanking, a brace-balance
  refusal, a universal (whole-file) negative arm on `viaSafeHref`, a directory census
  replacing a file-count floor, and fixture tables driving the previously-vacuous helpers.
- **`4e58242`** — the adapter-key scanner moves from line-scanning Go source to
  `go/parser` + `ast.Inspect`; `noteDeclaresBaseDependence` gains real negation handling.
- **`6551712`** — **the only production behaviour change.** `sanitizeRemoteData` recurses;
  a mirror `validateRemoteDataURLs` recurses on the import side; four call sites gain the
  sanitizer.
- **`e4316ae`, `e6bda71`** — documentation.

The unusual shape Part I flagged is real: most of this is instrumentation, so "is it
correct" mostly means "does the instrument measure what its name says." That is where most
of my findings landed.

Verified as claimed: **`ft-inspector-desc.ts` is comment-only.** The diff replaces a
one-line HTML comment with a nine-line one; `${unsafeHTML(renderMarkdown(this.description))}`
is byte-identical. Leaving it, per the fence.

---

## 2. `[OPEN]` findings — production behaviour (`6551712`)

### O1 · Required · The sanitizer and the import check both walk past `map[string]string`, while claiming they walk everything

`sanitizeRemoteValue` and `validateRemoteDataValue` each enumerate container types by hand:
`map[string]any`, `[]any`, `[]string`, `[]map[string]any`. Anything else hits
`default: return v, true` (sanitize) or falls out of the switch returning `nil` (validate)
— **unwalked and unvalidated**.

`map[string]string` is the obvious omission, and its omission is inconsistent with the code's
own choices. Two of the four handled types — `[]string` and `[]map[string]any` — *cannot*
arise from a JSON decode; `encoding/json` produces only `map[string]any` and `[]any`. So
the author deliberately covered Go-native shapes an adapter might construct in memory,
and then skipped the third obvious one:

```go
map[string]any{"parent": map[string]string{"html_url": "javascript:alert(1)"}}
```

passes `validateRemoteDataURLs` without error and survives `sanitizeRemoteData` **verbatim**.

**Why this is Required and not FYI.** Not because it is exploitable today — it is not. The
value dies at `structpb.NewStruct`, which has no `map[string]string` case and returns an
error that `convert.go:358` discards with `_`, nulling the whole `remote_data` field. So the
only thing standing between this shape and a client is *an unchecked error two layers away
in a different file*. It is Required because the code makes a universal claim about itself
that is false — `urlvalidate.go:121`, "that is why the predicate above fails closed and why
`sanitizeRemoteData` recurses over values it has never seen." It does not recurse over this
one. This round exists to remove true-measurement-false-sentence pairs; this is one.

**Fix — pick one, do not leave it half-enumerated:**
(a) Delete the `[]string` and `[]map[string]any` cases as unreachable, and state that
`remote_data` is `map[string]any`/`[]any` by construction because it is JSON-sourced; or
(b) add a `reflect`-based fallback in the `default` arm for any `reflect.Map` with string
keys and any `reflect.Slice`, so "recurses over values it has never seen" becomes true.
(a) is the smaller change and I would take it.

### O2 · Required · There are two sanitizer/importer asymmetries, not one — and the pin written to catch a second one cannot see it

`urlvalidate.go:415-424` says the `default` arm is "the one place the sanitizer drops
something the import check does not reject," and `TestSanitizeAndImportAgreeAtEveryDepth`'s
`asym` field says it is "**the one** documented disagreement … pinned here so it cannot
silently become two disagreements."

It already is two. Under a **URL-bearing key holding a `[]any`**:

- sanitizer (`urlvalidate.go:262-271`): `s, ok := e.(string); if !ok … continue` — every
  non-string element is **dropped**.
- importer (`urlvalidate.go:396-405`): `s, ok := e.(string); if !ok { continue }` — every
  non-string element is **skipped without error**.

So `{"urls": [{"html_url": "javascript:alert(1)"}]}` imports cleanly and is silently
truncated on the way out. Same direction as the documented asymmetry (safe), but it is a
second one, and the comment and the test both assert there is only one.

**The pin cannot catch it by construction.** The sweep's two list wrappers are
`{"sub_issues": []any{…}}` and `{"sub_issues": []map[string]any{…}}` — `sub_issues` is not
URL-bearing, so no generated row ever puts a `[]any` **under a URL-bearing key**. The
`asym` guard was written specifically to stop a second disagreement appearing, and the
shape it needs to see is outside its own generator.

There is also an inconsistency *inside* the sanitizer that this exposes: a container under
a URL-bearing key is **walked** when it is a map (`case map[string]any, []map[string]any:`
falls through to the generic walk, with a comment explaining exactly why dropping a subtree
on the strength of its parent's name is wrong) but **dropped** when it is a map inside a
list. Same argument, opposite handling, four lines apart.

**Fix:** in the URL-bearing `[]any` arm of `sanitizeRemoteValue`, recurse non-string
elements via `sanitizeRemoteValue("", e, depth+1)` instead of dropping them, mirroring the
map fall-through; mirror it in `validateRemoteDataValue`. Then add a wrapper to the sweep
whose list sits under a URL-bearing key (`{"urls": []any{…}}`) so the row exists.

### O3 · Required · `validateRemoteDataURLs`'s doc comment credits a fix to a code path that has never existed

The comment reads:

> They diverged before: the import check walked the top level only, so a collection
> carrying a `javascript:` URL under `remote_data.parent.html_url` imported cleanly.

Collection `remote_data` has **never** been run through the import validator, and still is
not. `validateImportedTaskURLs` takes an `exportTask`; grep for its callers returns exactly
one, `export_import.go:722`, inside `importedTask`. `ImportCollection` only calls
`sanitizeRemoteData` (`export_import.go:332`). So the sentence explains the top-level-only
walk as the cause of a collection defect it was not the cause of, and the stated outcome —
"imported cleanly" — is **still what happens today**: the value is silently dropped and the
import succeeds, whereas the identical payload on a *task* is rejected with an error.

**Fix — pick one:** (a) call `validateRemoteDataURLs` on `doc.Collection.RemoteData` in
`ImportCollection`, which makes the comment true and makes tasks and collections behave
the same way; or (b) rewrite the comment to say the collection case is covered by
sanitization only, and record the task/collection asymmetry as a deliberate decision. I
prefer (a) — the current split means the same malformed document is a hard error or a
silent truncation depending on which object carries it, and callers cannot predict which.

### O4 · Required · `TestEveryRemoteDataWriteSiteSanitizes` scans one directory, non-recursively, and its floor admits the loss of a third of the sites it guards

Two separate problems in one test, both on the "says true things about itself" axis.

**(a) "Every" means `internal/server/*.go`.** The doc says it "reads the non-test sources."
It reads `filepath.Join("..","..","internal","server")` with `os.ReadDir`, skipping
`e.IsDir()`. Invisible to it: `internal/store/entstore.go` (six `RemoteData` writes,
lines 407, 890-898, 1365, 1384-1399, 2116, 2189), all of `internal/platform/**`, and any
package added later. Those are DB writes rather than client writes and are legitimately out
of scope — but the test's *name* and *comment* claim the general property, and the whole
point of the test is to replace a false sentence ("we patched four sites") with a
measurement. Rename to `TestEveryRemoteDataWriteSiteInServerSanitizes` and say the root in
the doc, or widen the walk.

**(b) The anti-vacuity floor is set below the number the same commit measured.** The floor
is `sanitized < 4`, annotated "expected at least 4 (convert.go x2, export_import.go x2)".
`export_import.go` has **four** sanitized sites (139, 332, 438, 743), not two — the
parenthetical is wrong and the real count is **6**.

This is worse than an off-by-two, because **the dev leg measured 6 and wrote it down.**
`.design/project-log/url-scheme-validation-r4-fix-round.md` says, in bold: *"The brief said
four write sites. There are six."* and closes the table with *"Both now sanitize; six sites
total."* So the log and the test disagree about the output of the same scanner, in the same
commit. The test is the artefact that will still be here in six months; it is the one
carrying the wrong number.

The floor exists to catch a scanner that has stopped matching. At 4 it tolerates a scanner
that has stopped matching **two of the six sites** while reporting zero violations — which
is exactly the failure mode it was written to detect, and exactly the "a pin whose reach is
overstated is worse than no pin" standard the same round applies to `EXPECTED_ASSERTIONS`.
Raise it to 6 and fix the parenthetical.

### O5 · Optional · Export is now lossy, and nothing in the diff says so

`taskExport` (`export_import.go:438`) and `ExportCollection` (`:139`) now sanitize on the
way **out**. That is defensible — an export is a client-facing artefact — but it is a
behaviour change nobody has named: `Export → Import` is no longer value-preserving. A
stored `remote_data` containing `{"url": null}` exports as `{}`, even though the importer
goes out of its way to *tolerate* `{"url": null}` (`urlvalidate.go:416-424`, with an
explicit "rejecting a whole import over `\"url\": null` would be a denial of service"
rationale). So the two halves of the same round argue opposite ways about the same value:
the importer keeps it deliberately, the exporter drops it silently.

No fix demanded — but decide which one is right and write it down. If export should
preserve, sanitize only on the proto path and validate on the export path.

### O6 · Nit · The `exempt` reason for `server.go:661` is inaccurate for one of its two keys

`"p.RemoteData = map[string]any{}"` is exempted because "the two keys written into it on
the following lines come from validated request fields." `remote_url` is validated
(`server.go:665`). `remote_id` is **not validated at all** — it is exempt because it is not
URL-bearing, which is a different and weaker reason. Reword to say so; a reason that is
true of one key and false of the other is the shape of thing this round is removing.

---

## 3. `[OPEN]` findings — instrumentation (`2f6500f`, `d12f572`, `4e58242`)

### O7 · Optional · The assertion pin's count is a function of the allow-list, and its comment does not say so

`EXPECTED_ASSERTIONS = 380` is exact-equality, and `2f6500f` wires it into **both release
image builds**. The comment is unusually honest about what the pin kills and misses, and I
credit that. What it omits is the case a future author hits first: the count is **not** a
function of the test code alone. `testNoUnapprovedBindings` runs `checkViaSafeHref` once per
`ALLOWED` entry with `viaSafeHref`, and that function contains four assertions — so
**adding one legitimately-guarded `href` binding anywhere in `web/src` shifts the count by
four and fails the production image build**, with a message about assertions appearing.
That is the designed behaviour; it is just not what the comment prepares you for. Add a
sentence.

### O8 · Optional · `enclosingBlock` re-blanks and re-validates text its only callers have already blanked

`traceGuard` does `blankToCode(src).split('\n')` and passes the result to `enclosingBlock`,
which immediately does `blankToCode(lines.join('\n'))` and `assertBraceBalanced` again.
Blanking is idempotent (quote characters and backticks survive a pass, so a second pass is a
no-op), so this is *correct* — but it is O(file) work repeated once per allow-listed binding,
and it leaves the parameter contract ambiguous: nothing in the signature says whether
`lines` is raw or blanked, and both callers pass blanked. **Fix:** have `traceGuard` blank
and validate once and pass the code string down; make `enclosingBlock` take pre-blanked
input by type or by name (`blankedLines`).

### O9 · FYI · `blankNonCode`'s backslash handling in template text leaves an unblanked character behind

In the template-text branch, `c === '\\'` does `i += 2` **without blanking either
character**. In `blankToCode` mode that means an escaped character in template text survives
into what is supposed to be code-only output. If the escaped character is a brace —
`` html`\{` ``, legal JS — the surviving `{` is counted by `assertBraceBalanced`, which
throws and refuses to scan the file.

This fails **closed and loudly**, which is the right direction, so it is FYI rather than
Required. I raise it because it is the same class of defect as the apostrophe bug this
commit exists to fix, in the branch added to fix it. One-line fix: `if (blankTemplateText)
{ out[i] = ' '; out[i+1] = ' '; }` before the `i += 2`, guarding the newline as elsewhere.

### O10 · Nit · Dangling identifier in a doc comment

`urlvalidate_differential_test.go:806`: "Functions NOT in this list are still scanned if
they assign to a `.RemoteData` selector — **see `remoteDataFuncs`**." No such identifier
exists in the tree (`grep -rn remoteDataFuncs` returns only this comment). The function is
`buildsRemoteData`.

### O11 · Nit · The new `Makefile` `test` target is parallel-unsafe, on a project that lost a VM to parallelism tonight

`test: test-go test-web` — under `make -j` these run concurrently, which is a Go build and
a Node type-check at the same time. One line (`.NOTPARALLEL:`) removes it. Cheap insurance
given the week this project is having.

### O12 · Nit · Comment-block run-on in `urlvalidate.go`

The long doc comment for `urlBearingRemoteDataKey` now ends at line 121 and line 122 begins
`// urlBearingKeyWords are the word-segments…` with no blank line between them, so godoc
attaches the whole `TestRemoteDataKeysWrittenByAdaptersAreClassified` paragraph to the
`urlBearingKeyWords` var rather than to the function. Pre-existing, but this commit rewrites
those exact lines and could have separated them.

---

## 3b. `[OPEN]` findings from cross-checking the in-tree log against the tree

`.design/project-log/url-scheme-validation-r4-fix-round.md` is inside the artefact under
review, so nothing in it can falsify the diff. I read it as claims and checked the ones that
are cheaply checkable. Findings and **nulls** both recorded.

### O14 · FYI · The log's own type list corroborates O1

"Both traversals now recurse over `map[string]any`, `[]any` and `[]map[string]any`."
Two omissions. `[]string` **is** handled, but only in the URL-bearing arm — the generic walk
has no `[]string` case, which is harmless (strings hide no keys). `map[string]string` is
handled **nowhere**, which is O1. The leg's own summary of what it covers does not mention
the type it missed, which is the expected shape of this defect rather than a separate one.

### O15 · FYI · X8 sharpens O1's fix: two of the four enumerated container types are inert on the proto path

The log's "What I could not verify" section measures that `structpb.NewStruct` **rejects**
`[]string`, `[]map[string]any` and `json.RawMessage`, and that because `convert.go:358`
discards the error, *"one unrepresentable value nulls the entire `remote_data` silently."*

Follow that through to the sanitizer. `sanitizeRemoteValue` spends two `case` arms carefully
filtering `[]string` and `[]map[string]any` element-by-element — and on the proto path the
result of that filtering is that the **whole** `remote_data` field is nulled anyway, because
the type it so carefully cleaned cannot be serialised. Those arms do real work only on the
export-JSON path.

So the enumeration is not merely incomplete (O1); of the four container types it lists, two
are no-ops where it matters most and the obvious third (`map[string]string`) is absent. That
is a strong argument for O1 fix **(a)**: `remote_data` is JSON-sourced, so state that it is
`map[string]any`/`[]any` by construction and delete the two arms, rather than adding a fifth.
This is not a request to change X8's disposition — the leg's decision not to make those types
serialise is sound and out of my scope. It is a request to stop the sanitizer implying it
supports shapes the layer above it discards.

### O16 · FYI · The log's "read by nothing in `web/src`" reassurance is scoped to the field this round did not change

The log states: *"`Task.remoteData` is read by nothing in `web/src` (test O-9)."* Literally
true, and I confirmed it. But the newest production change in the round is
`collectionToProto` — **`Collection.remoteData`, which `web/src` reads in two places**:

- `web/src/capabilities.ts:98` — `getCapabilities()`
- `web/src/components/ft-app.ts:256` — `isCollectionWritable()`

**I checked both and there is no regression, and I want that stated as plainly as the
finding.** Each reads exactly one key — `rd.writable === true` — a boolean under a
non-URL-bearing key, which `sanitizeRemoteData` passes through the `default` arm unchanged.
Nothing is rendered, no href is constructed, and the capability flag survives sanitization.

The finding is the framing, not a bug: the round's safety note reassures the reader about the
`remote_data` the client ignores, immediately after adding a filter to the `remote_data` the
client actually consumes to decide **whether a collection is writable**. Say something about
the field you changed. One sentence recording that `writable` survives the sanitizer would
also pin it — today nothing does, and a future widening of the sanitizer that dropped
non-string scalars would silently make every GitHub collection read-only.

### O17 · FYI · The verification narrative spans three trees, and the missing dev report is where that would be disambiguated

The log's deliverable-0 evidence reads: *"reproduced end-to-end through `make test` with both
controls: drop the defeat → GREEN 337."* Elsewhere the suite is described as green at **358**
(`checkViaSafeHref`'s doc comment) and the pin now demands exactly **380**.

Those three numbers are reconcilable, but only via a commit-ordering argument the log never
states: `2f6500f` wired `make test` to the web suite, `d12f572` added the pin, so there is a
window — after `2f6500f`, before `d12f572` — in which `make test` ran `npm test` with no
count pin and 337 was a legitimate green. Before `2f6500f`, `make test` was `go test ./...`
and could not have exercised the web guard at all; the test file's own comment says
deliverable 0 was *"planted at 6805daa and measured green"*, which under that reading cannot
have been a `make test` measurement.

Consequence worth naming: **the deliverable-0 measurement is not reproducible at `e6bda71`**
without also editing `EXPECTED_ASSERTIONS`, because the pin hard-fails any count but 380. It
is the round's headline evidence that arm 2 fires for its own reason, and it now lives on a
tree that no longer exists. Not a defect in the code — a gap in the evidence chain, and
exactly the thing `reports/dev-xss-r4.md` would have resolved. **That report is absent.** I
am recording this as the concrete cost of the missing input rather than as a formality.

### Nulls I went and measured (recorded because a null nobody checks is not a null)

- **`P2cn` "equivalent mutant" — claim HOLDS.** The log argues that passing the parent key
  instead of `""` into the generic slice arm is equivalent because that arm is reachable only
  under a non-URL-bearing key. I traced every route in. The generic `[]any` arm is indeed
  unreachable with a URL-bearing key (the URL-bearing switch handles `[]any` and returns).
  The generic `[]map[string]any` arm *is* reachable with a URL-bearing key via the
  `case map[string]any, []map[string]any:` fall-through — the log does not mention this — but
  the elements are `map[string]any`, which fall through to the generic map walk under either
  spelling. Equivalent by a slightly wider argument than the one given. **No finding.**
- **`P11` "redundant guard" — claim HOLDS.** `validateRemoteDataURLs` and
  `validateRemoteDataValue` genuinely alternate at the same depth before incrementing, so
  either bound alone enforces the property. **One thing the log does not note:** the
  belt-and-braces is *asymmetric* — `sanitizeRemoteValue` has a single bound, so the mutant's
  counterpart on the sanitizer side would not be redundant. Worth a sentence in the code, not
  a finding.
- **`ft-inspector-desc.ts` comment-only — claim HOLDS.** Verified byte-identical sink.
- **`scopes.go` clean in this clone — claim HOLDS.** `git status --porcelain` is 0 lines.

---

## 4. `[OPEN]` architecture finding

### O13 · Optional (but this is the one I actually care about) · Two hand-maintained mirror traversals, kept in step by a test instead of by structure

`sanitizeRemoteValue` and `validateRemoteDataValue` are now ~60 lines each, with the type
switch written out **four times** (URL-bearing × generic, sanitize × validate). Their
agreement is asserted by `TestSanitizeAndImportAgreeAtEveryDepth` rather than guaranteed by
construction — and O2 above is exactly the bug that arrangement produces: two arms of the
same switch drift, in a shape the agreement sweep does not generate.

**The move:** one traversal, parameterised by a visitor.

```go
type remoteDataVisitor func(path, key string, v any) (replacement any, keep bool, err error)
func walkRemoteData(path string, rd map[string]any, depth int, visit remoteDataVisitor) (map[string]any, error)
```

The sanitizer supplies a visitor that drops and never errors; the importer supplies one that
errors and never drops. Traversal, depth accounting, sorted-key ordering and container
handling exist **once**. The asymmetries then become a single explicit list of visitor
behaviours rather than a diff between two switches, and O2 becomes unwriteable rather than
untested.

I am not blocking on this — the current code works and is unusually well commented, and the
"prefer the restructuring that makes branches disappear" argument does not by itself justify
rewriting a security-sensitive function late in a fix round. But it is the change that stops
this class of finding recurring, and I think it should be a filed follow-up rather than
dropped.

---

## 5. Where the briefs are wrong (required deliverable — open-pass instalment)

1. **Part I §"Your inputs" lists `reports/dev-xss-r4.md`.** It does not exist. Part I
   anticipated this; recording the measurement: the reports directory contains exactly one
   r4 artefact, `_xss-r4-baseline-measurement.md`.
2. **Part I §"What this round was" says `2f6500f` changes "instrumentation rather than
   production behaviour."** It also adds `RUN npm test` to `Dockerfile` **and**
   `Dockerfile.server` — the two release images. That is not runtime behaviour, but it is a
   change to the production build pipeline: the image now fails on a red guard (intended)
   and every image build now pays a full type-check plus jsdom run (not mentioned anywhere).
   Classifying the commit as purely instrumentation understates its blast radius, and it is
   the one commit in the round that can break a deploy without breaking a test.
3. **Part I's commit table paraphrases subjects rather than quoting them** — e.g. `2f6500f`
   is listed as "X1: make test runs this branch's own URL guard; both Dockerfiles npm test
   before build"; the actual subject is "Make \`make test\` run this branch's own URL guard".
   Harmless here, but Part I's own rule is "name the SHA, not the branch" for exactly this
   reason, and a paraphrased subject is the same category of soft identifier.
4. **`SCION_WORKSPACE_MODE=shared-plain` is a false label** — already self-reported by the
   EM in the 00:12Z addendum. Confirming independently from my side: the variable reads
   `shared-plain`, `SCION_WORKSPACE_GIT` is **unset** despite `/workspace` being a git
   repository at a leg-specific branch (`url-scheme-validation-r2-review`). So *both*
   workspace variables are wrong in this container, not just the mode. Recording the second
   one because the addendum only names the first.
5. **No contradiction found between the 00:05Z dispatch and the brief this round.** The
   dispatch ordering (Part I → leg brief STEP 1 → open pass → message) matches
   `review-xss-r4.md` lines 69-76 exactly. Recording the null: the countermeasure held here.

---

## 6. Measurements (R1, R2 — granted, serialized, executed)

### R1 — targeted Go oracles at `e6bda71`

```
target: go test ./internal/server/ -run 'RemoteData|Sanitize|Import|NoteDeclares|URLBearing' -count=2
sha:    e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1
occupy: 2026-07-29T00:17:02Z
start:  2026-07-29T00:17:02Z
end:    2026-07-29T00:18:32Z
exit:   0        ok  internal/server  0.133s
```

**The 90-second wall time is NOT a box signal, and I am saying so explicitly so it is not
read as one.** The artefact (`/var/tmp/scratch-review-xss-r4/r1.txt`) shows 29 of its 30
lines are `go: downloading` — including `go: downloading go1.26.5`, i.e. the **toolchain
itself**. Test execution was **0.133s**, inside your stated 0.603s reference for
`internal/server`. This container started with a cold module cache *and* no toolchain, so
the window is dominated by network fetch, not by CPU contention. R2 three minutes later
compiled and ran in **3 seconds** wall, which confirms it: the cost was one-time.

Useful for the queue: the first Go run in any fresh leg container will cost ~90s of
mostly-network occupancy regardless of what it runs. That is real occupancy — it hits the
disk and the module cache — but it is not evidence of load, and a leg reporting it without
the breakdown would look exactly like a box signal.

### R2 — review-leg probe for O1 and O2

```
target: go test ./internal/server/ -run 'REVIEWXSSR4' -v -count=2
sha:    e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1
occupy: 2026-07-29T00:19:23Z   (cp of the probe file into internal/server)
start:  2026-07-29T00:19:23Z
end:    2026-07-29T00:19:26Z
exit:   0        ok  internal/server  0.007s
```

Probe file `zz_reviewxssr4_probe_test.go`, every invented identifier prefixed
`REVIEWXSSR4_`. Five tests, each asserting the behaviour the open pass **predicted**, so a
PASS confirms the reading and a FAIL would have withdrawn the finding. All five passed, on
both runs.

**O1 — CONFIRMED, measured:**

```
map[string]interface{}{"parent":map[string]string{"html_url":"javascript:alert(1)"}}
  sanitizeRemoteData    -> returned VERBATIM, javascript: URL intact
  validateRemoteDataURLs -> nil (accepted, no error)
```

**O2 — CONFIRMED, measured:**

```
{"urls": []any{ {"html_url":"javascript:alert(1)"} }}
  dropped=true  errored=false   sanitized={"urls":[]interface{}{}}
```

`dropped != errored` is by definition a disagreement between the two traversals, and it is
the **second** one — the `asym` field pins only the unvalidatable-scalar case.

**And the reason the sweep cannot see it, measured rather than asserted:**
`urlBearingRemoteDataKey("sub_issues")` is **false**; `urlBearingRemoteDataKey("urls")` is
**true**. Both list wrappers in `TestSanitizeAndImportAgreeAtEveryDepth` key on
`sub_issues`, so no generated row in the 63-row sweep ever places a list under a
URL-bearing key. The pin written to stop a second asymmetry appearing is structurally
incapable of generating the shape that produces one.

**Positive controls both fired**, so none of the above is vacuous: a top-level bad URL is
dropped *and* rejected; and the same payload under a URL-bearing key holding a **map**
(`{"links": {"html_url": …}}`) is walked correctly, erroring with
`invalid REVIEWXSSR4_rd.links.html_url: URL scheme "javascript" is not allowed`. That
contrast is what makes O2 an asymmetry rather than a general failure to walk — the
sanitizer walks a map under a URL-bearing key and drops a map inside a list under the same
key, four lines apart.

### Restore, verified by `git diff` and not by a green suite

```
git diff e6bda71 --name-status   -> empty
git diff e6bda71 --stat          -> empty
git status --porcelain           -> 0 lines
git rev-parse HEAD               -> e6bda71… (unchanged, no commits)
grep -rl REVIEWXSSR4 /workspace  -> 0 files
```

**Probe cells left dirty: 0.** The probe survives only at
`/var/tmp/scratch-review-xss-r4/zz_reviewxssr4_probe_test.go`, outside the repo. I verified
by diff against the SHA rather than by re-running the suite, per Part I — and the O1 result
is a live illustration of why that rule exists: O1 is a defect that a fully green suite does
not see, so a green suite could not have told me the tree was clean either.

---

## 6b. Runs originally requested (superseded by section 6)

Serialized, in priority order. Nothing below re-measures the shared baseline.

- **R1** (~20s) `go test ./internal/server/ -run 'RemoteData|Sanitize|Import|NoteDeclares|URLBearing' -count=2`
  — targeted, twice for the flake. Establishes that the Go-side oracles pass at `e6bda71`
  under *my* invocation, which is what O2's and O4's "the pin does not fire" claims rest on.
- **R2** (~20s) One probe run for **O1 and O2**. I would place a single
  `zz_review_probe_test.go` in `internal/server/`, containing only two table rows —
  `map[string]string{"html_url": badURL}` under `parent`, and `{"urls": []any{map…}}` —
  asserting the current behaviour, then delete it. **This adds no production code and no
  permanent test;** the file is created from `/var/tmp/scratch-review-xss-r4/`, and I will
  verify the restore with `git diff e6bda71 --stat` and `git status --porcelain`, not by
  running tests, and report the dirty-cell count either way. If you would rather I not touch
  the tree at all, say so — O1 and O2 both stand on reading alone and I will mark them
  "unmeasured, derived from source" instead.

I do **not** need a `make test` or an `npm test` run. The EM-measured rows plus the baseline
artefact cover everything I would have used them for, and nothing in my open pass depends on
reproducing a green.

---

## 7. Impressions outside my axis (labelled, not corroboration)

- **Test-leg axis (mutation adequacy).** The `asym` guard in
  `TestSanitizeAndImportAgreeAtEveryDepth` and the `sanitized < 4` floor in
  `TestEveryRemoteDataWriteSiteSanitizes` both look to me like pins that cannot fire for the
  shapes they were written to catch (O2, O4b). I have not built a matrix and I am not
  claiming a mutation result — flagging the two locations for the leg that owns it.
- **Audit-leg axis (exploitability).** O1's `map[string]string` path is blocked only by a
  discarded `structpb.NewStruct` error at `convert.go:358` and `:534`. Whether any other
  reader of `remote_data` — the web client reading the export JSON, in particular — would
  see it is an exploitability question I am not qualified to close on this axis.
- I have not read the other legs' reports and have not coordinated with them.

---

## 8. `[CHECKLIST]` C1 — X1: does `make test` really run the web guard?

**Exit-code chain: clean. This is a measured null and C1's suspicion does not land.**

I traced every hop and looked specifically for the failure modes the checklist named —
`-` prefixes, `|| true`, swallowing subshells, and `cmd | tail`:

| Hop | Text | Verdict |
|---|---|---|
| `Makefile:22` | `test: test-go test-web` | sequential prerequisites, no `-k` |
| `Makefile:27-28` | `test-web:` / `cd web && npm test` | one recipe line, `&&`, no `-`, no pipe |
| `web/package.json` | `rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs` | `&&` chain |
| `run-tests.mjs` | `process.exit(1)` at nine distinct failure branches, incl. the assertion pin (`:319`) | propagates |

There is **no pipe anywhere in the chain**, so the `cmd | tail` hazard the project has
shipped before is not present here. A red web test fails `make test`.

**Both Dockerfiles: correct, and correct for the right reason.** `Dockerfile` and
`Dockerfile.server` have byte-identical frontend stages: `npm ci` (`:4`) → `COPY web/ .`
(`:5`) → `RUN npm test` (`:9`) → `RUN npm run build` (`:10`). The test runs **before** the
artefact is produced, in the same stage, and a failing `RUN` aborts the image. This is not
an `npm test` after `COPY --from=`. Null.

**Clean checkout: the gate is fail-closed, but illegibly, and the Makefile documents the
escape hatch.**

### C1-a · Optional · `make test` on a clean checkout fails with `tsc: not found`, and the comment above it sanctions running half

`test-web` has no `node_modules` bootstrap. `make web` runs `npm ci`; `test-web` does not
depend on it. So on a clean checkout `make test` **does** fail — fail-closed, which is the
right direction — but the message is a missing-binary error, not "run `npm ci`". The
comment at `Makefile:19-21` then says:

> Keep `test-go` and `test-web` separately invocable: the Go suite is fast and the web suite
> needs node_modules, so a contributor without them can still run half.

That is an honest note, and it is also a documented instruction to do the exact thing that
caused X1. A contributor who hits `tsc: not found` has been pre-authorised to run
`make test-go` and move on.

**Fix:** make the failure legible and the bootstrap automatic —
`test-web: cd web && npm ci --prefer-offline --no-audit && npm test`, or a guard that exits
with "web guard not run: `cd web && npm ci` first". Keep `test-go` invocable; stop
advertising it as a substitute.

### C1-b · Optional · Three places know the web suite exists, and nothing makes them agree

`Makefile:28`, `Dockerfile:9`, `Dockerfile.server:9` — plus prose in `CLAUDE.md`. The two
Dockerfile stages are identical **including a four-line comment**, which is duplication that
will drift. They agree today; nothing enforces it tomorrow.

**Fix:** have both Dockerfiles `RUN make test-web`, or extract the frontend stage to a single
shared file. One place, then three consumers of it.

*(`make -j` remains parallel-unsafe — that is O11, unchanged.)*

---

## 9. `[CHECKLIST]` C2 — the guard tracer's four fail-opens

### C2-a — Four independent bugs, or four symptoms of one choice? **One choice. And four patches shipped, not convergence.**

All four are downstream of a single structural decision: *reason about scope and identity
over blanked source text, with rules invented per call site.*

- **Scope direction inverting** is what happens when there is no scope *model* — each arm
  invented its own, and they landed on opposite quantifiers.
- **`.ts`-only `sourceFiles()`** is what happens when there is no single file-set source.
- **No identity check on the walk** is not really a missing assertion; it is that there are
  no *nodes* to have identities. There are offsets into blanked text.
- **Two assertions passing for the wrong reason** is the consequence of the first three, not
  a fifth thing.

**What shipped is four patches, each individually correct.** The evidence that convergence
did not ship is that arm 1 and arm 2 *still* have different scope models — block-scoped
existential and file-scoped universal — and the diff **documents the overlap rather than
removing it**. The remedy the checklist asks about (one scope model, one file-set source, one
identity check) is the right one and it is not what happened. This class will keep producing.
See §16.

### C2-b · Optional · `EXPECTED_ASSERTIONS` is hand-maintained, and the failure message coaches the defeat

`const EXPECTED_ASSERTIONS = 380;` — an integer literal, derived from nothing. It is checked
for **exact equality in both directions**, which is better than a floor: it catches deletion
*and* unreviewed addition. There is a substantial comment (`:40-50`) explaining what the pin
kills and misses.

Two problems:

1. **The comment is the only mechanism, and the error message actively teaches the bypass:**
   *"You added assertions. Update `EXPECTED_ASSERTIONS` in `web/scripts/run-tests.mjs`."* The
   pin tells the developer how to make it stop.
2. **More seriously: it is an aggregate, so it is blind by construction to exactly the
   corruption it exists to catch.** A single global total means **a deletion in file A is
   masked by an addition in file B**. Count-neutral corruption across files is invisible. The
   pin catches only *net* change.

**Fix:** pin per file. Each test file already emits an `#assertions N` receipt — assert each
file's count against a per-file expected map. That kills cross-file masking, makes the diff
that bumps it reviewable (you can see *which* file changed), and costs nothing extra to
maintain.

### C2-c — Identity check is on the consumed node. **Null, confirmed.**

`testNoUnapprovedBindings` computes `const files = sourceFiles(SRC)` once, builds `findings`
by iterating **that same array**, and runs the anti-vacuity `compareWalk(census, …)` over
**that same array**. The check is on the node the assertion consumes, not on a node the walk
merely visited. This is the half-way version's failure mode and it was avoided.

---

## 10. `[CHECKLIST]` C3 — X6: adapter keys by AST

### C3-a — The defeating shape is fixtured, and the parse-error control exists. **Null, and this one is well done.**

`TestRemoteDataLiteralKeysIn` carries seven shapes including the literal
`map[string]interface{}{` spelling that defeated the regex. And the parse-error case is a
genuine positive control: `remoteDataLiteralKeysIn` returns an error, and the test
(`:1122-1127`) fails if unparseable source returns no error. **A scanner that distinguishes
"broken" from "clean" is the whole point of the commit, and for the parse path it does.**

### C3-b · Optional · Non-literal keys collapse into the same empty the commit exists to eliminate

The checklist asks which zeros are distinguishable. Answer:

| Input | Output | Distinguishable? |
|---|---|---|
| File that does not parse | error | **Yes** — controlled |
| File with zero adapter keys | `[]` | — (correct) |
| Key built by concatenation | `[]` | **No** |
| Key that is a constant, not a literal | `[]` | **No** |

`stringLit` returns `ok=false` for anything that is not a basic string literal, and the
caller **skips it silently, with no diagnostic**. So `rd["html_"+suffix] = v` and a file with
no adapter keys produce byte-identical output. That is the same "empty is indistinguishable
from clean" defect the commit was written to fix, surviving in a narrower input set.

Impact chain, stated honestly so it can be rated down: a missed key is not itself an
unsanitized URL — the runtime sanitizer is key-**predicate**-based, not scanner-based. The
loss is that a URL-bearing key nobody added to `urlBearingKeyWords` stops being surfaced for
review. Two steps removed, which is why this is Optional and not Required.

**Fix (~5 lines):** return a second value — the count of skipped non-literal keys — and fail
the scan if it is non-zero. "I found keys I could not read" is a different result from "I
found no keys," and the scanner currently cannot say it.

### C3-c — X7b negation boundary, stated

`noteDeclaresBaseDependence` requires a negator from `baseDependenceNegation` within a
64-char window, **not crossing sentence punctuation** `[.;:!?]`, positioned before the term.

- **Handles:** `not` / `isn't` / `no` / `never` immediately or nearly-immediately before the
  term; correctly *refuses* to let a negation in a previous sentence leak forward.
- **Silently accepts (reads as a positive declaration when it is negated):** negation further
  than ~24 characters before the term — *"this is not, in any of the cases we tested,
  base-dependent"*; negation placed **after** the term — *"base-dependent it is not"*; and
  double negation — *"not un-base-dependent"* — which it reads as negated, wrongly.
- The direction of these failures is toward *rejecting a note that was fine* (the predicate
  gates note quality), so the boundary is uncomfortable rather than dangerous.

### C3-d — "Second hand-written scanner"? There are four, and see §16.

---

## 11. `[CHECKLIST]` C4 — X3, and the `server.go:661` exemption
### *(Required deliverable 3)*

### C4-1 — **The checklist's characterisation of the exemption is wrong, and I am refuting rather than confirming the finding it most expected.**

The exemption is **keyed by exact source *text*, not by line number**:

```go
exempt := map[string]string{
    "p.RemoteData = map[string]any{}": "constructs an empty map; …",
}
…
if _, ok := exempt[strings.TrimSuffix(trimmed, ",")]; ok { continue }
```

Consequences, directly answering the checklist's three questions:

- **"What is the failure mode when the file shifts by one line?" — There is none.** The
  exemption is immune to line movement. Nothing above `server.go:661` can shift it.
- **"Is there any content check binding the exemption to what it exempts?"** — The key *is*
  the content. When the exempted statement changes, the exemption **stops matching** and the
  site reappears as a violation. That is **fail-closed**, the opposite of the "silent in the
  permissive direction" the checklist asserts.
- The in-tree log at `e6bda71` describes this correctly ("keyed by the exact source line, so
  if that line changes the exemption stops applying"). **The checklist contradicts both the
  log and the code.**

Two real weaknesses remain, in a different direction from the predicted one:

1. **Text keys are file- and function-agnostic.** Any file in `internal/server` containing
   that exact statement is exempt. A new constructor that writes
   `p.RemoteData = map[string]any{}` and then fills it with attacker-controlled values is
   silently exempt, in a file nobody reviewed for this. Fix: key on `(file, statement)`.
2. **The exemption is close to decorative anyway**, because of C4-2.

### C4-2 · Required · The write-site scanner cannot see the write form used three lines below the site it exempts

This is O4, sharpened by measurement. The regex is

```
(?m)^.*\bRemoteData(?:,\s*_)?\s*[:=]=?\s*(.+)$
```

I ran it against the four real write forms. Measured, not reasoned:

| Line | Matches? |
|---|---|
| `p.RemoteData["remote_id"] = req.GetRemoteId()` | **NO** |
| `p.RemoteData = map[string]any{}` | yes |
| `pc.RemoteData, _ = structpb.NewStruct(x)` | yes |
| `RemoteData: m,` | yes |

**Index writes are invisible to the scanner.** After `RemoteData` comes `[`, which is not
`[:=]`. So `server.go:663` and `:669` — the two statements that actually put values into the
map, and the two the exemption's stated reason is *about* — were never in the scanner's field
of view at all. The exemption suppresses a harmless empty-map construction; the dangerous
neighbours were never candidates.

### C4-3 — Derived or listed? **Derived — over a directory, not over a property.**

It is a scanner, and writing one instead of trusting the brief's number was the right move; I
want to say that plainly. But the derivation's scope is `filepath.Join("..","..","internal","server")`,
read non-recursively. What it cannot see:

| Blind spot | Present in tree today? |
|---|---|
| Index/element writes | **Yes** — `server.go:663,669` |
| Other packages | **Yes — exactly 5**, enumerated in §21.2: `internal/platform/github/github.go:169,200`, `internal/platform/github/passthrough.go:147`, `internal/platform/beads/beads.go:199,238` |
| Ent setter calls — `create.SetRemoteData(...)` — a fourth syntactic form | **Yes** — `internal/store/entstore.go:408,898,1366`; not field assignments, so outside the 12 counted above, and invisible to the regex regardless |
| Subdirectories of `internal/server` | non-recursive `os.ReadDir` |
| Writes via a helper, aliases (`m := p.RemoteData`), struct copies | no |
| Multi-line assignment | **fails closed** — RHS doesn't contain `sanitizeRemoteData(`, so it is flagged. Correct. |

**CORRECTED — see §21.2.** My first pass here said "6 of at least 14," from a `grep … | head -40`.
That instrument was truncated and the figure was wrong in both terms. Measured without
truncation: there are **12** `RemoteData` field-assignment sites repo-wide, and the scanner
sees **7 of them** — the 6 sanitized plus `server.go:661` exempt. All 7 are in
`internal/server`, so **within its scope the scanner's reach is complete**; the 5 it misses
are all in the platform adapters. Now — most of those 5 are legitimately out of scope,
because they are **inbound** (adapter → store) and
sanitization belongs on the **outbound** edge. That intent is defensible. But the test is
named `TestEveryRemoteDataWriteSiteSanitizes` and its failure message says *"Either sanitize
the site or add its exact source line to the `exempt` map"* — **the name and the message
claim a universality the scan does not have**, and the scoping to one directory is a
coincidence of today's layout, not a checked property. Add an outbound conversion in
`internal/mcp` or a REST handler and the test stays green.

### C4-4 · Required · The anti-vacuity floor is stale, and the stale value creates a specific blind spot

```go
if sanitized < 4 {
    t.Errorf("… expected at least 4 (convert.go x2, export_import.go x2) …")
}
```

Measured: there are **six** sanitized sites — `convert.go:358,534` and
`export_import.go:139,332,438,743`. The parenthetical is wrong: `export_import.go` has
**four**, not two.

Why the stale number matters, concretely. Suppose the file loop stops reaching `convert.go`
(a `strings.HasSuffix` typo, a rename, a `continue`): `sanitized` falls 6 → 4, `4 < 4` is
false, **no error** — and `unsanitized` is empty because the four survivors all sanitize. The
scan silently loses **the two sites with actual client-facing stakes** and reports green. A
floor of 6 would catch it. A floor that is a comment-maintained integer will go stale again.

**Fix:** derive it. Assert `sites == sanitized + len(exemptHits)` and pin `sites` — or drop
the floor and assert per-file that each expected file contributed ≥1 site, which is what the
floor is actually trying to say.

### C4-5 — The recursion and the bound: **correct, and it drops.**

`maxRemoteDataDepth = 32`. At the bound `sanitizeRemoteValue` returns `(nil, false)` — the
value is **dropped**, not truncated and not passed through. `validateRemoteDataValue` returns
an error. Both fail closed. The checklist's worry ("passing through at the bound is a
fail-open") does not apply. The doc comment explains why the bound exists and that it is a
pathological-input bound rather than a cycle guard. Good.

### C4-6 — Generator shape (test leg's to size; structural note only)

The 7×9 basis excludes, structurally: **a list under a URL-bearing key** (both list wrappers
key on `sub_issues`, which is not URL-bearing — measured in R2, and this is why the sweep
cannot see O2), maps-in-arrays-in-maps beyond one level, and non-UTF8 keys. Nulls *are*
covered.

### C4-7 — **The unrepresentable fix, as the checklist asks**

Every problem above — the exemption, the text key, the directory scope, the stale floor, the
regex's blindness to index writes — exists because **the scanner conflates inbound and
outbound writes and then tries to tell them apart by source text.** Delete that conflation
and the whole apparatus becomes unnecessary:

```go
// internal/server/urlvalidate.go
type SanitizedRemoteData map[string]any                       // no other constructor
func sanitizeRemoteData(rd map[string]any) SanitizedRemoteData
```

Then change the **outbound** consumers to accept only that type — `structpb.NewStruct` call
sites in `convert.go`, and the `RemoteData` fields of the export DTOs in `export_import.go`.
An unsanitized outbound write **does not compile**, in any package, through any helper, alias,
index write, or reflection-free path the scanner cannot see.

And note what happens to `server.go:661` under this design: it writes to `ent`'s
`map[string]any` on the **inbound** path, which is not an outbound edge, so **it needs no
exemption at all.** The exempt map, its text key, and the argument about whether its stated
reason is accurate all disappear. That is the difference between making the bad state
unrepresentable and detecting it.

Sizing: ~1 type, ~6 call-site signatures, and the deletion of
`TestEveryRemoteDataWriteSiteSanitizes`. Comfortably inside one round.

---

## 12. `[CHECKLIST]` C5 — the docs commits as claims

I checked each sentence `e6bda71` adds. Four are checkable; three hold.

| Claim | Verdict |
|---|---|
| "`refs/preserve/xss-r4/branch` (`d12f572`) is clean by construction — those lines do not exist in it yet" | **TRUE.** `urlvalidate.go` at `d12f572` is 247 lines with zero occurrences of `sanitizeRemoteValue`; the mutant was at `:430`. Line 430 does not exist there. (445 lines at `e6bda71`.) |
| "`P5cn` … killed by `TestRemoteDataTraversalsTerminateOnACycle`, which did not exist when `P5cn` first survived" | **TRUE.** Test present at `remotedata_depth_test.go:254`. |
| "`Task.remoteData` is read by nothing in `web/src` (test O-9)" | **TRUE, and correctly scoped** — see O16 and C6-2 below. The only `web/src` consumers are `collection.remoteData`. |
| "the only two keys … are `remote_id` and `remote_url`, assigned on the following lines **from request fields that are already validated upstream**" | **FALSE, twice.** |

### C5-1 · Required · The exemption's stated rationale is false, in the commit written to state it accurately

`server.go:660-670`:

- `remote_url` **is** validated — but **inline, on the very next line**, by
  `validateURLField`. Not "upstream."
- `remote_id` **is not validated at all**, anywhere, inline or upstream.

So the sentence is wrong about *where* one key is validated and wrong about *whether* the
other is. The checklist asks: "Is the exemption's stated rationale the actual reason it is
safe?" **No.** The actual reason it is safe is that this is an **inbound** write and the
outbound edge (`convert.go:358`) sanitizes on the way out — which is C4-7's point, and which
is a far more robust reason than the one recorded.

Mitigation, stated so this can be rated fairly: `remote_id` is **not** URL-bearing
(`keySegments("remote_id")` → `["remote","id"]`, neither in `urlBearingKeyWords`), so nothing
turns on it today. It is Required because it is a false security rationale in the exact
artefact the round produced to make rationales true, and because a future rename to
`remote_link` makes it load-bearing silently.

### C5-2 · FYI · A measurement recorded as a property

"The scanner is a **lower bound** — a write through reflection or an aliased struct is
invisible to it — and the test says so." The disclosure is real and I credit it. But it names
the *exotic* misses and omits the mundane one that is **already in the tree, three lines below
the site the same paragraph exempts**: index writes (C4-2), and other packages (C4-3). A
limitation section that lists reflection but not `m["k"] = v` reads as more complete than it
is.

### C5-3 · FYI · Wrong line numbers, propagated

"The discarded errors at `convert.go:358,530,555,558` remain." Measured: the `structpb` calls
are at **358, 534, 559, 562**. See C6-1 — two of those four are provably inert. The checklist
inherited these numbers verbatim (deliverable 8, item 7).

---

## 13. `[CHECKLIST]` C6 — X8 and `scopes.go`
### *(Required deliverable 4)*

### C6-1 — X8: correctness impact, independent judgement

**Is a silent whole-field null a correctness defect regardless of security? Yes, and I can
name the user-visible behaviour, which changes the sizing conversation.**

The log frames X8 as an exposure question. On my axis it is a **functional** defect, and the
consumer is in this repository:

```
convert.go:534   pc.RemoteData, _ = structpb.NewStruct(sanitizeRemoteData(c.RemoteData))
        ↓ error discarded → pc.RemoteData == nil
web/src/capabilities.ts:98    const rd = collection.remoteData;
                              if (rd && … 'writable' in rd && rd.writable === true)
                                  return GITHUB_CAPABILITIES;
                              return ALL_DISABLED;
web/src/components/ft-app.ts:256   isCollectionWritable() → false
```

**A single unrepresentable value anywhere in a collection's `remote_data` silently converts a
writable GitHub collection into a read-only one in the UI.** No error, no toast, no log line —
the controls are simply absent. That is a support ticket that is very hard to diagnose from
the client, because the client's view is indistinguishable from a legitimately read-only
collection.

> ### ~~SUPERSEDED — the paragraph above must not be read forward. See §25.~~
>
> **The chain is exact at `e6bda71` and it cannot be entered.** `Collection.remote_data` has
> one live producer — `entstore.go:2117` ← `export_import.go:332` — whose source type is
> `RemoteData map[string]any` with a `json:` tag (`export_import.go:39`). It is **JSON-decoded**,
> so its value set is `{map[string]any, []any, string, float64, bool, nil}`, **all of which
> `structpb.NewStruct` accepts**. It is closed under the representable set by construction.
> And **no platform adapter ever populates a collection's `remote_data`** — all 20 adapter
> `RemoteData` sites build *tasks* via `buildRemoteData(issue, …)`.
>
> **Therefore the error at `:534` cannot fire, and the two consumers read the field that cannot
> fail.** I verified all three links myself rather than accepting the correction. The "latent,
> not currently firing" rating in point 2 below was right; **the reason I gave for it was
> weaker than the truth**, and the user-visible-failure narrative above is void.

**Is "discard the error" load-bearing, or inertia? Inertia.** Nothing reads the discarded
value; there is no code path that depends on `pc.RemoteData` being nil-on-failure. The
signature `structpb.NewStruct` returns `(*Struct, error)` and the `_` is the path of least
resistance at a site that pre-dates this round.

**Two corrections to the recorded scope of X8**, both of which shrink it:

1. Of the four cited sites, `:559` and `:562` are `structpb.NewValue(c.OldValue)` and
   `structpb.NewValue(c.NewValue)`, where both operands are **`string`**. `NewValue` on a
   string cannot fail. Those two discards are **provably inert**. The real surface is
   `convert.go:358` and `:534` — **two lines, not four.**
2. In practice `remote_data` loaded from ent is JSON-decoded, so its values are always
   representable and `NewStruct` cannot fail. The live risk is the in-process adapter path
   (`buildRemoteData`, `issueBuildRemoteData`) and anything that reaches O1's
   `map[string]string` shape. So this is **latent, not currently firing** — I want that on the
   record rather than overstated.

**Sizing (the scheduling input you asked for): bounded, small. Roughly half a day; not a
round.** Two lines change from `_` to a logged error; the better version drops the offending
key and keeps the rest of the map rather than nulling the field:

```go
s, err := structpb.NewStruct(sanitizeRemoteData(c.RemoteData))
if err != nil {
    slog.Warn("collection remote_data not representable; field omitted",
        "collection_id", c.ID, "err", err)
}
pc.RemoteData = s   // nil on error, but now it is not silent
```

Plus one test per site driving the error branch. Two lines of production code, ~40 lines of
test. **This does not need a round of its own; fold it into the fix pass for O1.**

**Severity: ~~Optional~~ → FYI, reduced to one site. See §25.** The discard pre-dates this diff,
the diff does not claim to fix it, and O1's fix does not depend on it. I am explicitly *not*
using "the line was touched" as licence to require a pre-existing fix. ~~**However** — if the
Required findings are addressed and X8 is deferred again, I would raise it to Required in the
next round, because the third deferral of a known silent-failure path is how it becomes
permanent.~~

> **Amended.** `:534` cannot fire, so the Optional as filed does not survive. What remains is
> **`convert.go:358` only** — `Task.remote_data`, which *can* fail, because the adapters emit
> `[]string` (X8) and O1's `map[string]string` reaches it. But that field has **no consumer in
> `web/src`**, so a silent null there is currently unobservable in the UI; the residual concern
> is data loss on the wire for gRPC clients (`ft`, MCP), which I have not traced. **FYI, one
> line, no escalation clause** — the escalation threat above was priced on a user-visible
> permissions failure that does not exist. I am withdrawing the threat along with its premise.

### C6-2 · FYI · The round's own log does not cover the field the round newly sanitized

"`Task.remoteData` is read by nothing in `web/src`" is true. But this diff added sanitization
to **`Collection.remoteData`** (`convert.go:534`), and *that* field is read by two client call
sites that gate write permissions. The reassurance in the log is correctly scoped and the
conclusion it draws is still right (the client scrubs nothing either way) — but the only
statement the round makes about client consumption covers the field it did **not** change.
Worth one sentence in the log.

### C6-3 — `scopes.go`: I agree with the decision, and disagree with leaving it open-ended

The disposition is right for *this* round: adopting a fenced change means committing outside
the baseline; reverting it means destroying pre-existing state that is not the leg's to
discard. Declaring it and leaving it is the correct third option, and doing so in writing is
better than the alternative.

**But "indefinitely" is not a disposition, it is a deferral, and it decays.** Six lines of
gofmt alignment sitting dirty in a dev tree gets swept into someone's `git commit -a` — which
is *precisely* the failure mode the same log documents two sections earlier as "the third
instance of a probe's state escaping into a durable artefact." The branch has already been
bitten by this exact channel twice tonight.

**Recommendation: close it in the very next round, before any further work on this file, as
a standalone commit of its own** — `gofmt -w internal/server/scopes.go`, one commit,
message "gofmt: scopes.go const block alignment (no semantic change)", reviewed as a
formatting-only diff. That takes it out of the fence by making it a deliberate act rather
than a fenced omission. It is a two-minute job and it removes a live contamination channel.
Do not carry it into a third round.

---

## 14. `[CHECKLIST]` C7 — the two equivalence arguments, read as code
### *(Required deliverable 5)*

### C7-P2cn — **The mutant is genuinely equivalent. The argument recorded for it is not sound as written.**

The mutant: in the generic `[]any` arm of `sanitizeRemoteValue`, walk elements with `key`
instead of `""`.

**The conclusion holds.** I traced it:

- The generic `[]any` arm is reachable only when `key` is **not** URL-bearing. Under a
  URL-bearing key, a `[]any` is consumed by the *first* switch (`case []any:`) which
  `return`s — it never falls through.
- `urlBearingRemoteDataKey("")` is `false`: `""` matches no word, and the all-caps fallback
  is guarded by `seg != strings.ToLower(seg)`, false for `""`.
- Within `sanitizeRemoteValue`, `key` is used **only** in `urlBearingRemoteDataKey(key)` and
  in `validateURLField(key, …)`, and the latter is reachable only inside the URL-bearing
  branch. So a `key` that is non-URL-bearing is behaviourally identical to `""`.
- `key` is not propagated further down: the `map[string]any` arm recurses on the map's *own*
  keys.

**So: equivalent. Recorded correctly as equivalent, not hidden. That was the right call.**

**The argument, though, is stated more broadly than the code supports.** It says:

> The generic slice arm is reachable only when the key is *not* URL-bearing.

There are **two** generic slice arms. The `[]map[string]any` arm (also passing `""`) **is**
reachable with a URL-bearing key, via the `case map[string]any, []map[string]any:`
fall-through in the first switch. The stated reason is therefore false for the sibling arm.

The conclusion survives there too — but by a *different* argument (a map re-entered under a
URL-bearing key falls through to the same generic walk and is processed by its own keys), not
the one recorded. **The finding is: anyone who reuses this equivalence argument on the
sibling arm — which is what an argument is for — will be reasoning from a false premise.**
Fix the sentence: name the arm, and say the fall-through case is covered separately.

### C7-P11 — **The equivalence argument is correct. The mitigation is recorded in the wrong place.**

The checklist's demand: *"'redundant guard' is a claim that the other guard is total. Name
the other guard and say what it covers."*

**The other guard is `validateRemoteDataValue`'s bound at `urlvalidate.go:386.** It is total
for termination, and here is the trace:

- `validateRemoteDataURLs(path, rd, depth)` — bound at `:374` — loops keys calling
  `validateRemoteDataValue(…, depth)` at `:378`, **same depth**.
- `validateRemoteDataValue` — bound at `:386` — calls `validateRemoteDataURLs(…, depth+1)` at
  `:411`, `:414`, `:430`. **Depth increments only on map entry.**
- The mutual recursion can therefore descend **only** through `validateRemoteDataValue`.
  Every descent passes its bound. The single unbounded entry under P11 is the root call at
  depth 0.

With P11 applied, a map at depth 33 entered from `Value(32)`: `Value` passes, calls
`URLs(33)` (now unbounded), which loops keys calling `Value(…, 33)`, which errors. **Terminates,
and still emits `levels deep`** — one level later, with a path one segment longer. The leg's
stated exception is also exactly right: they differ only for an **empty** map past the bound,
where the surviving guard loops zero times and returns nil. An empty map has nothing to
validate. **Not a security-relevant difference. Argument sound.**

### C7-P11-a · Optional · The defence-in-depth decision lives in a project log, not at the code site

Two things make this fragile in the way the checklist anticipates:

1. **The mirrors are asymmetric.** The import walk has **two** bounds; `sanitizeRemoteValue`
   has **one**. A future contributor tidying the two traversals toward symmetry would
   naturally delete the "extra" bound at `:374` — the one P11 proves is currently removable.
2. **Line 374 carries no comment saying it is deliberately redundant.** The decision — *"the
   belt-and-braces is deliberate and is kept"* — exists only in
   `.design/project-log/url-scheme-validation-r4-fix-round.md`. Nobody simplifying
   `urlvalidate.go` reads that file.

This is the checklist's own scenario: *a redundant guard that becomes load-bearing after
someone simplifies its partner.* The partner here is one line away and looks like duplication.

**Fix, one line, at `:374`:** `// Deliberately redundant with the bound in
validateRemoteDataValue; the walk alternates and either alone terminates it. Mutation P11
removes this and survives. Keep both.` A decision recorded where the deletion will happen.

---

## 15. `[CHECKLIST]` C8 — is the instrument stack sound?
### *(Required deliverable 6 — labelled an opinion throughout)*

**This section is my opinion. It is a judgement about direction, not a measured result, and
it should be weighed as such.**

### Where the stack terminates, and whether the right thing is unguarded

Counting what actually exists — and it is **four** hand-written source scanners, not two:

| # | Instrument | Guarded by | Fail-open found this round? |
|---|---|---|---|
| 1 | URL-binding source scanner (TS) | census/`compareWalk`, `EXPECTED_ASSERTIONS` | yes (X2/X5) |
| 2 | Guard tracer, two arms (TS) | arm-vs-arm cross-check | yes (X4/X7a) |
| 3 | Adapter-key AST scanner (Go) | parse-error control, 7 fixtures | recovered this round (X6) |
| 4 | **Write-site regex scanner (Go)** | `sanitized < 4` floor | **found by me, this round (C4-2/C4-4)** |
| — | `EXPECTED_ASSERTIONS` | *nothing* | X4 |
| — | Go anti-vacuity floors | *nothing* (P10, self-reported) | P10 |

**It terminates in two places, not one, and neither terminator is the right one.**

- On the web side it terminates at `EXPECTED_ASSERTIONS` — a hand-maintained integer whose
  error message tells you how to change it, and which is blind to cross-file count-neutral
  corruption (C2-b).
- On the Go side it terminates at `sanitized < 4` and its siblings — which P10 correctly
  identifies as unkilled, and which I have shown is **stale and admits the loss of the two
  most important sites** (C4-4).

So: the outermost instruments are **integer literals maintained by hand**, and both of them
have a measured defect right now. Something must be unguarded — that is unavoidable and the
log is right about it. My opinion is that **an aggregate hand-maintained count is close to
the worst available choice for the thing you leave unguarded**, because its failure is
silent, permissive, and indistinguishable from a legitimate edit. If a count must terminate
the stack, it should be **per-file** (C2-b) so that the diff which defeats it is legible in
review.

### Is the stack load-bearing beyond its reliability? **Yes, in my opinion.**

The decisive evidence is not that instruments had bugs. It is *how they were found*:
**every fail-open this round was found by a human reading source — none by any level above
it.** Six defects across four instruments (X2, X4, X5, X6, X7a, plus C4-2/C4-4 from me), and
the meta-instruments caught zero of them. A stack whose upper levels have never once caught
a lower-level defect is not providing assurance; it is providing the *appearance* of
assurance plus maintenance cost. That is worse than fewer, simpler checks, because it
displaces the reading that is actually doing the work.

There is a second signal. **Within this single round, the project learned "regex is
insufficient, use an AST" (X6, `4e58242`) and then did not apply it to the scanner it wrote
two commits later** (`6551712`'s `remoteDataWriteSite`) — the one guarding the **production
write path**, and the one I proved is blind to the write form used three lines from the site
it exempts. The lesson did not propagate across two commits by the same author in the same
night. That is what "no shared substrate" costs, concretely.

### Should the next round be a convergence round? **Yes. That is my recommendation.**

Not another fix round. Specifically:

1. **Do C4-7 first** — `SanitizedRemoteData` as a type. This is not a refactor for elegance;
   it **deletes instrument #4 entirely**, along with the exempt map, the text key, the
   directory scope, the stale floor, and the entire class of "did we find every write site."
   The compiler does it, in every package, for every write form. One less scanner, and the
   strongest one.
2. **Converge #1 and #2** onto one scope model, one file-set source, one identity check —
   the remedy C2-a asks about and that this round did not take.
3. **Make the terminators per-file** rather than aggregate.

### Is the instrumentation replaceable by making the bad state unrepresentable?

**Substantially, yes — and the checklist asks whether I would rather hear that this diff
should have converged than that it correctly patched. I would, and I do.**

- Instrument #4 → **fully replaceable** by a type (C4-7). Delete it.
- Instrument #3 (adapter keys) → **partly**. A typed key enum for `remote_data` keys would
  make the scanner unnecessary, but that is a larger change to the adapter contract and I
  would not ask for it now.
- Instruments #1/#2 (client-side URL binding) → **not replaceable this way.** Lit templates
  bind strings to attributes; there is no type boundary to hang this on short of a branded
  `SafeUrl` type threaded through the components. That is a real project, and it is where
  scanning genuinely earns its place. Which means: converge these two and keep them, and
  spend the saved effort there rather than on #4.

The honest summary of my opinion: **this diff is a competent set of patches to a structure
that should not need them.** The patches are individually correct and the round found real
defects. But three of the six commits are instruments fixing instruments, and the one
production-behaviour commit shipped a fifth instrument with the same class of defect the
round was convened to eliminate. That is the signal for convergence.

---

## 16. Prediction accuracy
### *(Required deliverable 7)*

**On predictions I filed before targeting: 6 / 6 confirmed, 0 refuted.**

| # | Open-pass prediction | How adjudicated | Result |
|---|---|---|---|
| 1 | O1 — both traversals walk past `map[string]string` | **measured**, R2 | confirmed |
| 2 | O2 — a second sanitizer/importer asymmetry exists | **measured**, R2 | confirmed |
| 3 | O2-corollary — the sweep's wrappers key on `sub_issues`, so it cannot generate the shape | **measured**, R2 | confirmed |
| 4 | O3 — the doc comment credits a fix to a path that never existed | git archaeology | confirmed |
| 5 | O4 — the write-site scan is one directory, non-recursive, floor admits loss | code + C4 | confirmed, and worse than I said |
| 6 | O6 — the exempt rationale is inaccurate for one of its two keys | code | confirmed (C5-1) |

**This fraction is weak evidence and I want to say so, per Part II.** I chose which
predictions to file, and I measured only the two I was most confident in. A reviewer who
files only safe predictions scores 6/6 and has learned nothing. **The misses are the
informative part:**

- **M1 — I did not find that the write-site regex is blind to index writes.** I had the
  directory scope and the floor; I missed the sharper and more damaging fact that
  `p.RemoteData["k"] = v` does not match at all — which is the form used at the very site
  the exemption is about. I reasoned about the scanner's *reach* and never ran its regex
  against the *forms*. That is the miss I am least happy with; it was one command.
- **M2 — I flagged `EXPECTED_ASSERTIONS` as undocumented-and-hand-maintained (O7) but missed
  that it is an aggregate**, and therefore blind to cross-file count-neutral corruption. I
  identified the weaker half of the finding.
- **M3 — I did not examine what the adapter-key AST scanner does with non-literal keys** at
  all (C3-b). I checked that it found what the regex missed and stopped there — I verified
  the fix and not the residue.
- **M4 — I filed O15 (X8) and O16 (the `Task`/`Collection` scoping) as two separate FYIs and
  did not join them.** Joined, they are the strongest correctness argument in this review:
  a discarded error silently makes a writable collection read-only in the UI (C6-1). Both
  halves were on my page; I did not connect them until the checklist made me look at X8
  independently. **Against the union of findings my recall was roughly 6/10, not 6/6.**

The pattern in M1–M4 is consistent and worth naming: **I was reliable at identifying that a
control was weak, and unreliable at pushing one step further to what it lets through.**

---

## 17. Where the checklist is wrong
### *(Required deliverable 8 — continuing the numbering from §5)*

**6. C4's central premise is wrong, and it is the finding you said you most expected me to
confirm.** "The exemption is keyed by exact source line. A line-number-keyed exemption is a
decaying control: it silently moves to a different statement the next time anyone edits above
it, and the failure is silent in the permissive direction." It is keyed by exact source
**text** — `exempt[strings.TrimSuffix(trimmed, ",")]`. Edits above it have no effect; when
the exempted statement itself changes, the exemption **stops applying and the site reappears
as a violation**, which is fail-**closed**. The in-tree log describes this correctly; the
checklist contradicts both the log and the code. (Deliverable 3 then restates the error as
established fact — "your verdict on the `server.go:661` line-number-keyed exemption" — so the
premise is baked into the deliverable list too.) There *is* a real defect at this site, but
it is C4-2, and it is a different defect in the opposite direction.

**7. C6's line numbers are wrong, inherited from the log without checking.**
"`convert.go:530,555,558`" — the `structpb` calls are at **358, 534, 559, 562**. And the
error is not only clerical: **`:559` and `:562` are `structpb.NewValue` on `string` operands,
which cannot fail**, so two of the four "discarded errors" are provably inert. The X8 surface
you are scheduling against is two lines, not four.

**8. C3's negation examples are a category error.** "Negation-awareness in a source-text
predicate is a slope: `!x`, `x == false`, `!(x)`, a negation two lines up."
`noteDeclaresBaseDependence` reads an **English prose `note` field**, not Go source. `!x` and
`x == false` are not shapes it can encounter. The real boundary is prose distance,
sentence punctuation, and double negation — stated in C3-c.

**9. C3 undercounts the scanners, and the undercount hides the finding.** "This is now the
**second** hand-written source scanner in the branch (guard tracer, adapter keys)." There are
**four**: the URL-binding scanner and the guard tracer (`url-binding-scan.test.ts`), the
adapter-key AST scanner (`urlvalidate_differential_test.go`), and the write-site regex
scanner (`remotedata_depth_test.go`). The fourth is the one guarding the production write
path, is the least rigorous of the four, and was written in the same round that replaced a
regex with an AST for the third. Asking "is there a shared substrate, or two?" frames it as a
tidiness question; at four, with the newest one repeating the defect the round just fixed,
it is the architectural finding (§15).

**10. C6 asserts the leg "decided this was out of scope / acceptable."** The log does not say
acceptable — it says the recursion fix is orthogonal, gives a specific reason for not making
the types serialise (widening exposure), and states the discards remain. That is a narrower
and better-reasoned position than the checklist attributes to it, and the difference matters
because I was being asked to adjudicate a disposition the leg did not take.

**11. A null, recorded because you asked for these.** I checked the claim in C1 that you
hand-copied `node_modules` into my clone. **It is true** — `web/node_modules` is present,
120M. I went looking for an error and did not find one.

---

## 18. Did Part I alone leave me under-equipped for the open pass?
### *(Part II asks this directly)*

**No — and I think the split worked, with one qualification I would not have predicted.**

Part I gave me the tree, the fences, the safety procedure and the run policy. That was
sufficient to produce thirteen findings, including the two that turned out to be the most
substantive (O1, O2), and to design falsifiable probes for them. Nothing in Part II would
have made those findings *possible*; the open pass was not starved.

The qualification, which is the answer you actually want: **Part II would have changed my
misses, not my hits.** Three of my four misses (M1, M2, M3 in §16) are direct applications of
Part II's "every zero needs a positive control" and "count pins" material. Had I read Part II
first I would very likely have caught the index-write blindness (M1) and the non-literal-key
hole (M3), because both are that heuristic applied mechanically.

So the split has a real, measurable cost, and it is not zero: **it trades a modest number of
method-driven findings for an uncontaminated control on your targeting.** On this round the
trade paid — my open pass independently reached O1/O2 and independently contradicted C4's
central premise, which is exactly the control you built it for, and neither would have been
credible if I had read your targeting first. I would keep the split. I would also consider
moving the *generic* heuristics ("a zero needs a positive control", "count pins aggregate")
into Part I, since they are method without being targeting — they point at no specific
commit, so they cannot steer me the way the checklist can. That would recover most of M1–M3
at no cost to the control.

---

## 19. Final verdict

# REQUEST CHANGES

on `6805daa..e6bda71`.

**Risk level: MEDIUM.** No live exploitable path is established on my axis — O1's escape is
currently blocked by `structpb` refusing to serialise the shape, which is luck rather than
design, and exploitability is the audit leg's call, not mine. The changes here are net
positive: the recursion fix is real and correctly measured, the write-site scanner was the
right instinct, and `make test` genuinely runs the web guard now. But four findings describe
code that **does not do what it says about itself**, which is precisely my axis, and two of
them are confirmed by measurement rather than by reading.

### Required — these block merge

| # | Finding | Where | Evidence |
|---|---|---|---|
| **O1** | Both traversals walk past `map[string]string`, while their comments claim they walk everything nested | `urlvalidate.go` generic `default: return v, true` | **Measured**, R2 — `javascript:` URL survives both sanitizer and import check |
| **O2** | A **second** sanitizer/importer asymmetry exists; the pin written to guarantee there is only one cannot see it | `urlvalidate.go:394-403` vs `:261-270` | **Measured**, R2 — `dropped=true errored=false` |
| **O3** | `validateRemoteDataURLs`'s doc comment credits a fix to a code path that has never existed | `urlvalidate.go` | git archaeology |
| **O4 / C4-2 / C4-4** | The write-site scanner is blind to index writes, scoped to one non-recursive directory, and its anti-vacuity floor is stale at 4 against 6 real sites — admitting the silent loss of both `convert.go` sites | `remotedata_depth_test.go:454,523,576` | **Measured** — regex run against all four write forms |
| **C5-1** | The exemption's stated security rationale is false: `remote_id` is not validated anywhere, and `remote_url` is validated inline rather than "upstream" | `server.go:660-670`, log `e6bda71` | code |

For O4/C4-2/C4-4 I recommend **C4-7 (the `SanitizedRemoteData` type) instead of patching the
scanner.** It deletes the finding rather than fixing it, and it is comparable work.

### Suggested — do not block merge

C1-a (clean-checkout legibility), C1-b (three places know about the web suite), C2-b
(per-file assertion pins), C3-b (non-literal adapter keys), ~~C6-1 (**X8 — log the two real
discards; ~half a day, fold into the O1 fix**)~~ **[AMENDED — see §25: `:534` cannot fire; C6-1
is now FYI at `convert.go:358` only and is not forwarded as work]**, C6-3 (**`scopes.go` — gofmt it as a
standalone commit next round, do not carry it to a third**), C7-P2cn (widen the equivalence
argument to name the arm), C7-P11-a (**move the defence-in-depth decision to a comment at
`urlvalidate.go:374`**), O5, O7–O12, O13.

### Equivalence arguments adjudicated

**P2cn — equivalent; argument unsound as written** (true for `[]any`, false for the sibling
`[]map[string]any` arm). **P11 — equivalent; argument sound**; the other guard is
`validateRemoteDataValue:386` and it is total for termination. Neither should be treated as
a kill. Neither is a hole.

### Recommendation to the dispatcher

**The next round should be a convergence round, not a fix round** (§15). And a **deeper
specialist pass is warranted on one point I am not qualified to close**: whether O1's
`map[string]string` shape can reach any consumer that does not go through
`structpb.NewStruct` — the export JSON path (`export_import.go`) does not, and that is an
exploitability question for the audit leg.

### Process

- Probe cells left dirty: **0.** Verified by `git diff e6bda71 --name-status` (empty),
  `git status --porcelain` (0 lines), HEAD unchanged, and `grep -rl REVIEWXSSR4 /workspace`
  (0 hits) — not by a green suite.
- Runs executed: **2** (R1, R2), both granted and serialized, reported in §6.
- Both runs used `-count=2`, which bypasses the result cache (`-count` is not a cacheable
  flag) and gives two independent samples; neither output carried a `(cached)` marker. This
  satisfies Part II's "`-count=1` or it is not a sample" and is stronger, not weaker.
- Container/shared-volume clock skew: **+0.001113 s**. My timestamps are comparable to the
  volume's.
- I have not read the other legs' reports, have not coordinated with them, and offer this
  verdict as my own — not as corroboration of anyone else's.
- Required input `reports/dev-xss-r4.md` was **absent** throughout (§0). I substituted the
  in-tree project log and said so; that gap is unclosed.

---

## 20. Retroactive: mutator-landing broadcast (00:56Z)

**Required response: I reported ZERO mutation rows and ZERO survivors. There is nothing to
withdraw.** My brief assigned mutation adequacy to the test leg; where I suspected a test
could not fail I labelled it an impression and moved on (§7). My verdict does not rest on any
mutation result, mine or anyone's.

Three things in this report are nevertheless in the blast radius. Taking each:

### 20.1 — My own R2 had this exact hazard, and here is the landing evidence

`go test ./internal/server/ -run 'REVIEWXSSR4'` against a tree where the probe file **failed
to copy** prints `testing: warning: no tests to run`, reports `ok`, and **exits 0**. Same exit
code, same green, no signal — the textbook shape the broadcast describes. I did not design
around this; I got the control for free and should say which one it is:

**Edit verified applied — by `-v` enumeration.** The R2 output names all five tests
(`=== RUN TestREVIEWXSSR4_…`) and carries their `t.Logf` payloads, including production error
text the probe could not have fabricated (`invalid REVIEWXSSR4_rd.links.html_url: URL scheme
"javascript" is not allowed`). A no-op copy produces none of that. Landing established for
both iterations.

Had I run without `-v`, my two measured findings — O1 and O2, the strongest results in this
review — would have been indistinguishable from a probe that never arrived.

### 20.2 — C7 is unaffected, and it can serve as a positive control on the rebuilt mutator

My P2cn and P11 verdicts are **code reading**, not harness output (§14). They do not depend on
the dev leg's edits having landed, so they stand unchanged.

But the asymmetry is worth naming, because it cuts in a useful direction. From a harness,
**"equivalent mutant" and "edit never applied" are the same observation** — both are green.
From the source they are not: my claim is *if you apply this edit, the program is the same
program*, which is strictly stronger and independently established.

**So a falsifiable prediction, offered as a control on the rebuilt harness: a
landing-verified re-run of P2cn and P11 should still show both surviving.** If either comes
back RED once the edit is verified to have landed, my C7 analysis is wrong and I want to be
told. That is a cheap check on their mutator that does not route through their mutator.

Corollary for the log: `e6bda71` records P2cn and P11 as "mutants that survived." Until the
re-run, the defensible sentence is "argued equivalent by code reading; harness corroboration
pending re-verification." The *conclusion* is sound; its stated *evidence* is currently the
weaker half.

### 20.3 · FYI · The idiom is present in committed code — and it fails closed. Checked, not assumed.

`urlvalidate_differential_test.go:428` builds a negative control by exactly the silently-
no-opping idiom the broadcast warns about:

```go
mutateNote(good, strings.Replace(good.Note, "Client is MORE", "Server is MORE", 1))
```

Nothing verifies the substitution landed. `good.Note` does begin with `"Client is MORE"`
today, so **it lands today**. And when it stops landing, the row inverts safely:

- no-op ⇒ `neg.tc.Note == good.Note`
- `good` is asserted **accepted** eleven lines above (`:404`)
- the negatives loop (`:459`) asserts every row is **rejected**
- ⇒ `len(problems) == 0` ⇒ `t.Errorf` ⇒ **RED**

Per the broadcast's own asymmetry — *a failed edit cannot produce a failure* — this row is
safe. I am reporting it as present-and-benign rather than as a defect, and the one-line
hardening is worth taking anyway since the file is being touched:
`if !strings.Contains(good.Note, "Client is MORE") { t.Fatal("fixture drifted; the wrong-direction negative no longer mutates anything") }`.

### 20.4 · Required · The commit that added the assertion pin also invalidated the control it records as proof

This is a new finding, and it is the broadcast's shape rather than its letter — an apparatus
change that silently disabled an apparatus check, in the same commit, unnoticed because
neither is the artefact.

`d12f572`'s log entry records the deliverable-0 negative control as:

> drop the defeat → **GREEN 337**; drop the guard → arm 1 fires with a *different* message.
> That is what proves arm 2 fired for its own reason rather than riding arm 1.

Measured: **`EXPECTED_ASSERTIONS = 380` was introduced by `d12f572` — the same commit** — and
it is an **exact-equality** check in both directions. A run producing 337 assertions therefore
exits **1**, not GREEN. The recorded control and the gate that would block it shipped together.

So one of the following holds, and the log distinguishes none of them:

1. the control was run before the pin existed, and is recorded as if reproducible on the
   shipped tree;
2. "GREEN" means the tracer arm passed while the overall run was red — a much weaker claim
   than the sentence makes;
3. 337 counts something other than the pinned total.

**The measurement may well have been correct when taken. The defect is that it cannot be
re-run as written** — anyone reproducing it today hits the pin and exits before the tracer's
verdict is the thing being read. That is a control preserved as a sentence rather than as a
procedure, which is the failure mode Part II names, and it is the reason the broadcast's own
remedy is *per-row evidence* rather than a narrative.

**Fix:** either make the deliverable-0 control a committed, runnable negative test with the
pin scoped or waived for that run, or record it with the tree state it was taken against and
mark it non-reproducible on `HEAD`. Do not leave a proof-of-fire that the shipped gate blocks.

*(`renderProbeLink` is absent from `web/` — correct: it was a temporary probe and was cleaned
up. That is the leg doing the right thing, not a gap.)*

---

## 21. Retroactive: positive controls on every load-bearing null (broadcast 2, 01:00Z)

**Verdict unchanged: REQUEST CHANGES.** Every null my report rests on now has a positive
control showing the instrument can produce a non-null. All read-only, no grant, ~ms each.
One null was **wrong** and is corrected in §21.2.

### 21.1 — R1 had the live `-run` defect. I did not use `-v` on it. Control run; it holds.

I flagged the `-v` luck on R2 and **missed that R1 is the row actually exposed**:

```
go test ./internal/server/ -run 'RemoteData|Sanitize|Import|NoteDeclares|URLBearing' -count=2
→ ok  github.com/farmtable-io/farmtable/internal/server  0.133s
```

No `-v`, so that output is byte-identical to a filter matching zero tests. **Control, on the
filter rather than the suite:**

| | |
|---|---|
| Tests in `internal/server` | **223** |
| Matched by R1's regex | **36** |
| Negative control (`TestZZZNoSuchNameReviewXssR4`) | **0** — the instrument discriminates; it is not stuck-on |

**R1's filter was aimed at 36 real tests. The null-filter defect is excluded and R1 stands.**

**Residual, stated rather than glossed:** this proves the filter *aimed* at 36 tests. It does
not prove all 36 *executed* — a skip would be invisible. Only `-v` with a counted PASS tally
would close that, and I did not run it. R1 was a baseline sanity run and **no finding in this
report depends on it**; O1–O4 rest on reading plus R2, and R2 was `-v`. So the residual is
real but not load-bearing. Had R1 been carrying a finding, I would be asking for a re-run.

### 21.2 — A null that was WRONG: my C4-3 enumeration was truncated

This is the broadcast's B4 lesson landing on me. My C4-3 site enumeration came from
`grep -rn "RemoteData" … | head -40` — **I truncated the instrument and then presented the
result as coverage.** "6 of at least 14" is wrong in both terms.

Measured without truncation, with a negative control (`RemoteDataZZZReviewXssR4` → 0 matches,
so the pattern discriminates). **12** field-assignment sites repo-wide:

| Package | Sites | In scanner scope? |
|---|---|---|
| `internal/server` | **7** — `convert.go:358,534`; `export_import.go:139,332,438,743`; `server.go:661` | yes, all 7 |
| `internal/platform/github` | 3 — `github.go:169,200`; `passthrough.go:147` | **no** |
| `internal/platform/beads` | 2 — `beads.go:199,238` | **no** |

**The scanner sees 7 of 12 — and within `internal/server` its reach is complete (7/7).** That
is better than I reported, and I am correcting it against my own finding's interest.

Two things this sharpens rather than softens:

- The 5 misses are **all** in platform adapters, i.e. all **inbound**. So the directory scope
  happens to align with the inbound/outbound split *today* — which is exactly C4-3's point:
  it is an unchecked coincidence of layout, not a property, and nothing fails when it stops
  holding.
- I also mis-classified `internal/store/entstore.go:408,898,1366`. Those are
  `create.SetRemoteData(...)` **setter calls**, not field assignments — a **fourth syntactic
  write form**, alongside index writes, that the regex cannot see at all. They are not among
  the 12. Listing them as "assignments" was sloppy; the corrected table in §11 says so.

**C4-2 and C4-4 are unaffected.** Index-write blindness and the stale floor were measured
directly, and the floor arithmetic (4 vs 6 sanitized sites) does not move.

### 21.3 — The restore verification: three instruments, and the git-based two had the EM's own defect

My "0 dirty cells" rested on `git diff e6bda71 --name-status` (empty), `git status --porcelain`
(0 lines), and `grep -rl REVIEWXSSR4 /workspace` (0). Taking the broadcast's first two shapes
seriously:

- **`git diff` does not report untracked files.** My probe was untracked. So that instrument
  would have returned empty with the probe still sitting in the tree. **On its own it proves
  nothing**, and it is the one the EM's own restore check was blind through.
- **`git status --porcelain` does report untracked files as `??` — unless ignored.** Control:
  `git check-ignore -v internal/server/zz_reviewxssr4_probe_test.go` → **not ignored**, and
  `.gitignore` contains no `zz`/`probe`/`*.go` pattern. So the ignored-file layer beneath the
  EM's defect **does not apply here**; status would have shown it.
- **`grep -rl REVIEWXSSR4 /workspace`** is content-based and git-independent — the strongest
  of the three. Two controls: the pattern matches the real artefact in scratch (**2 files**),
  and the identical recursive walk into `/workspace` returns non-null on a known string
  (`sanitizeRemoteData` → **7 files**). **Pattern proven matchable, scope proven searchable.**

**Restore verification holds, but on the third instrument, not the first.** The correct
sentence is *"0 dirty cells, established by content grep with a verified pattern; the git-diff
check is corroborating and would not have caught an untracked probe on its own."*

### 21.4 — Remaining nulls, each with its control

| Null | Positive control | Held? |
|---|---|---|
| `renderProbeLink` absent from `web/` (§20.4) | identical command, `renderExternalSourceLink` → **8 hits** | yes |
| No pipe / `-` prefix / `\|\| true` in the `make test` chain (C1) | `Makefile` read in **full**, not grepped; `run-tests.mjs` grep returned **9** `process.exit` hits | yes |
| `Task.remoteData` unread in `web/src` (C5) | same grep returned **non-null** — the two `collection.remoteData` sites | self-attesting |
| Index writes don't match the write-site regex (C4-2) | **same invocation** matched the other 3 forms | self-attesting — the model case |
| `EXPECTED_ASSERTIONS` introduced by `d12f572` (§20.4) | `git log -S` returned a commit, not silence | self-attesting |
| `node_modules` present (§17 item 11) | `du -sh` → **120M** | non-null |

### 21.5 — On the idiom the three legs converged on

I agree with adopting **self-attesting results over separate assertions**, and I want to add
the qualification my own two failures point at. The strongest controls in this review were the
ones where **the same invocation produced both the null and a non-null**: the write-site regex
run against all four write forms at once, and R2's `-v` enumeration. Those cannot drift,
cannot be skipped, and cannot be reported without their control.

The two places I got it wrong were both places where the control was **a separate command I
did not run** (R1's filter) or **an instrument I silently narrowed** (`head -40`). Neither
would have been fixed by remembering to assert harder afterwards. So the operational form of
the rule, for me: **build the non-null into the same command as the null, and never truncate
an instrument whose output is an enumeration.** A `head` on a counting instrument converts a
measurement into a summary, and a summary reads as coverage — which is precisely
review-194-r11's B4.

---

## 22. Retroactive: hazards A and B (broadcast 3, 01:04Z)

**Verdict unchanged: REQUEST CHANGES.** Both hazards audited against my own tool calls,
parsed out of my session transcript — not reasoned about from memory.

### 22.1 — HAZARD B: zero partial reads. Measured, not asserted.

I parsed every `tool_use` block in my transcript. **89 tool calls; exactly 4 `Read`s:**

| File | offset | limit |
|---|---|---|
| `briefs/_xss-r4-baseline-block.md` (Part I) | none | none |
| `briefs/review-xss-r4.md` (my brief) | none | none |
| `briefs/_xss-r4-method-block.md` (Part II) | none | none |
| `briefs/review-xss-r4-checklist.md` | none | none |

**Partial reads: 0. Reads of any sibling leg's report: 0** (`test-xss-r4`, `audit-xss-r4`,
`review-194-r11`, `audit-194-r11` — zero occurrences in any tool input).

So the deferred-full-exposure mechanism has **no instance in my session**. Not because I
avoided `limit` deliberately — I did not know the hazard existed — but because I never had
reason to peek. Luck again, and I would rather log it as luck than as discipline.

### 22.2 — Ordering integrity, proven from chronology rather than from my say-so

The `[OPEN]`/`[CHECKLIST]` attribution in this report is the thing Hazard B would most damage.
Tool-call indices, in order:

```
  #29  WRITE report            <- the open pass
  #30  MESSAGE "OPEN PASS FILED"
  #44  READ Part II
  #45  READ checklist
```

**Part II and the checklist entered my context at calls 44–45, fifteen calls after the open
pass was on disk and fourteen after it was filed.** The `[OPEN]` findings O1–O17 are
uncontaminated, and this is now a measurement rather than a claim.

### 22.3 — The heading-grep corollary: two hits, both benign, and one instrument that matched itself

My first pass at this returned an apparent hit for
`grep '^#|STOP|do not read|open pass|checklist'`. **That is not my command** — it is the text
of broadcast 3 quoting `audit-194-r11`, sitting in my context. My search space had been
contaminated by the message describing the hazard, and a careless read of that output would
have had me confessing to another leg's tool call.

Re-scoped to my own `tool_use` inputs only, `^#` appears in exactly two of my commands:

1. `grep -n "^#" $R` where `$R` is **my own report file** — reading my own section headers to
   decide where to append. Not a gated document.
2. My own audit command from this turn, which searches *for* heading-greps and therefore
   **matched itself**.

**No heading grep against any gated document.** But note the general lesson, which cost me two
false positives in five minutes: *an instrument that searches for a hazard will match the
description of the hazard, and it will match its own source text.* Both are null-inflating,
i.e. they manufacture findings rather than hide them — the safe direction, but only if you
look at what matched instead of counting.

### 22.4 · Disclosure · I did list the reports directory, twice

`ls /scion-volumes/scratchpad/projects/farmtable/reports/` and
`ls -la … | grep -i "xss-r4"`. This exposed sibling report **filenames, sizes and
timestamps** — metadata, not content, and metadata cannot carry a conclusion the way a
heading can. I did not open any of them. Recording it because "subject-matter-blind by intent
can be subject-matter-revealing in effect" is the right test and a directory listing does tell
me which legs had filed by then.

One place it was load-bearing: the `dev-xss-r4.md` absence in §0. That null has a built-in
positive control — I ran `ls -la <path>/dev-xss-r4.md 2>&1`, which returns
`No such file or directory` **naming the path**, so a misaimed path is self-revealing rather
than silently empty.

### 22.5 — HAZARD A: my pending queue is empty, but it did contain a defect, and I did not catch it

**Current pending runs: none.** R1 and R2 both executed; §6b states explicitly that I need no
`make test` or `npm test`, and nothing since has changed that. So there is no unaimed
instrument waiting in my queue.

**But the hazard was live in my queue earlier and the EM caught it, not me.** §6b as filed
proposed the probe file as `zz_review_probe_test.go`. The EM's 00:15Z correction required a
leg prefix — `zz_reviewxssr4_probe_test.go` — precisely so a stray artefact would convict its
author. Had it been granted as written, the probe would have carried a name that identified no
leg, in a shared-history repo, on the night a stranded mutant had already been found in a
preserve ref. **A queued command with a real defect sat in my queue and I re-read it twice
without seeing it.** That is one more data point for the new rule, from the leg that filed it.

### 22.6 — And a plan/delivery drift nobody audits: R1's stated purpose did not survive contact

§6b justified R1 as *"what O2's and O4's 'the pin does not fire' claims rest on."* **In the
delivered report they rest on nothing of the kind:**

- **O2** rests on R2's measurement (`dropped=true errored=false`) and on R2's separate
  measurement that `urlBearingRemoteDataKey("sub_issues")` is false — which establishes the
  sweep *structurally cannot generate* the shape, a stronger claim than "the pin did not fire
  in one run."
- **O4** rests on reading, the untruncated enumeration (§21.2), and the empirical regex test
  against all four write forms.

So §21.1's "no finding depends on R1" is correct, and §6b's anticipated dependency **never
materialised**. I am flagging the drift itself: a run requested as load-bearing that turned out
not to be, where the justification text stayed on the page unamended. Nobody audits the gap
between why a run was requested and what it ended up supporting, and that gap is where a
grant gets spent on nothing — or worse, where a finding keeps citing a run that no longer
carries it.

---

## 23. Retroactive: broadcasts 4–7

**Verdict unchanged: REQUEST CHANGES.** Method note: my transcript audit parses each JSONL
record with `json.loads` and walks `tool_use` blocks. Control: **95 tool_use records, of which
21 Bash commands are multi-line** — so the `grep -o`-over-raw-JSONL defect broadcast 6 describes
would have blinded me to roughly a quarter of my own commands.

### 23.1 — The unquoted glob: one real instance of five detector hits, and it is already spent

The hazard is live here: `SHELL=/bin/zsh`, `ZSH_VERSION=5.9`, **no bash**. Empirically, in this
container:

```
grep -rn --include=*.go   "sanitizeRemoteData(" internal/server/   ->  (eval):1: no matches found
grep -rn --include='*.go' "sanitizeRemoteData(" internal/server/   ->  works
```

> **~~SUPERSEDED — see §24.1.~~** The block above is left intact deliberately. **Its second
> line never executed in that run.** The abort killed every `;`-separated check behind it,
> including the quoted-form control I had written into the same command, and I read the
> truncated output as though it were the whole result. The proposition is true — the quoted
> form returns **19 lines**, measured separately in §24.1 — but **the evidence as I stated it
> was fabricated by truncation.** Conclusion right, stated reason wrong.

My detector found five occurrences. **Per broadcast 6, hand-adjudicated rather than counted:**

| # | Match | Adjudication |
|---|---|---|
| **#8** | `grep -rn "RemoteData" --include=*.go internal/ cmd/` | **REAL.** Aborted. Output was one line: `(eval):1: no matches found: --include=*.go` |
| #93 | my empirical hazard test, this turn | Deliberate. **Sound under broadcast 7(b)** — the abort *is* the proposition |
| #94 ×2 | `pat.search("grep -rn --include=*.go x .")` | **Fabricated** — the detector matching its own positive-control string inside a heredoc |
| #95 | `pat2.search("find . -name *.go")` | **Fabricated** — same, its own control literal |

**One real of five.** Reporting "5 contaminated commands" would have been a fictional finding of
exactly the kind that cost audit-xss-r4 seven fabricated tests and test-194-r11 nine Go pointer
types. The count was not the finding.

**Does anything rest on #8? No, and this is checkable rather than asserted.** #8 produced
**1 line** of output — an error. I evidently saw it, because **#10 is the same query, quoted**,
and produced **102 lines**. Every enumeration in this report descends from #10 or from #80
(`--include="*.go"`, quoted, the untruncated C4-3 redo). **The abort was loud, it was answered
two calls later, and no null of mine was ever generated by it.**

That is luck in the same shape the EM has now seen three times: I was saved because zsh is not
bash. Under bash, #8 returns a *silently smaller* result set — a partial enumeration of
`RemoteData` sites, which is precisely the measurement C4-3 turns on. **My most-corrected
finding would have been corrected to another wrong number.**

### 23.2 — Route 6: no recursive search of `reports/`

Zero `grep -r` / `rg` / `find` over `reports/` or `briefs/`. I enumerated **all 16 commands** in
my session that mention either path: two `ls` (disclosed in §22.4), one sanctioned `clockprobe`,
four operations on briefs I was entitled to read, and the rest reads/appends to **my own** report
plus two transcript greps. The one `grep -rl` I ran was scoped to `/workspace`, which contains no
reports.

### 23.3 — The write arm, and **a hole in it that applies to me and not to test-194-r11**

Write/Edit tool calls: **8, across exactly 2 distinct paths** — my own report (7) and
`/var/tmp/scratch-review-xss-r4/zz_reviewxssr4_probe_test.go` (1). **Zero Write/Edit anywhere in
`/workspace`.** Zero to any sibling's report.

**But broadcast 6's causal restore proof does not work as stated, for me:**

> "29 Write/Edit calls, THREE distinct paths … ZERO elsewhere … the probe is provably gone AND
> provably the only candidate."

**The Write/Edit arm is blind to the shell.** My probe reached `/workspace` by `cp`, not by
`Write`:

```
#40  cp /var/tmp/scratch-review-xss-r4/zz_reviewxssr4_probe_test.go /workspace/internal/server/…
#42  rm -f /workspace/internal/server/zz_reviewxssr4_probe_test.go
```

Had I taken the write arm at face value it would have reported **zero writes to `/workspace`**
while the tree had in fact been mutated. **For any leg that placed a file with `cp`, `mv`, `tee`
or a redirect, the enumeration is not causal — it is empty for the wrong reason.** Flagging this
because the technique is now mandated and it under-reports precisely for the legs that ran probes.

**Corrected causal restore proof, enumerating Bash writes as well:**

- Artefacts that ever entered `/workspace`: **exactly one**, `internal/server/zz_reviewxssr4_probe_test.go`, placed at #40, removed at #42.
- Every other file I created went to `/var/tmp/scratch-review-xss-r4/` (probe source, `r1.txt`, `r2.txt`, `allnames.txt`, `sites.txt`, and the audit scripts).
- Removal verified **by content, not by git state**: `grep -rl REVIEWXSSR4 /workspace` = **0**, which is the instrument that survives `.gitignore`. (§21.3 established the two-positive-control version of this.)
- `git status --porcelain` = 0 lines, HEAD = `e6bda71`.

**Probe cells left dirty: 0** — now established by enumeration of every write channel I used,
not only by inspection of the tree.

### 23.4 · First-party corroboration of broadcast 5, from a different container

Broadcast 5's central claim is that the harness's "files you read" set **contains writes**.
**I am an independent instance of it.** The system reminder in my current turn states:

> `/scion-volumes/scratchpad/projects/farmtable/reports/review-xss-r4.md was read before the last conversation was summarized`

**I have never called `Read` on that file.** My complete Read set is four paths, all in `briefs/`:

```
call  #1  briefs/_xss-r4-baseline-block.md   offset=None limit=None
call  #3  briefs/review-xss-r4.md            offset=None limit=None
call #44  briefs/_xss-r4-method-block.md     offset=None limit=None
call #45  briefs/review-xss-r4-checklist.md  offset=None limit=None
```

My report appears **only** in the Write/Edit set. So the label is wrong here too, in a second
container, for a write-only file — matching the coordinator's 17-of-21. **The re-hydration set is
"touched," not "read," and this is now measured twice independently.**

**And my first attempt at this check was broken.** I tested `"review-xss-r4.md" in path`, which
**matches `briefs/review-xss-r4.md`** and returned "True" for the Read set — the opposite of the
truth. An exact-path comparison gives False. A substring test against a set of paths that share a
stem is not a membership test; it cost me one wrong answer on the single question broadcast 5
asked me to re-check.

### 23.5 — Ordering table, from `tool_use` records only, including the row that cuts against me

Per broadcast 6, built from tool_use records — never from string matches. Per broadcast 5,
**first read, not first mention.**

| Call | Event |
|---|---|
| #1 | **Read** Part I (`_xss-r4-baseline-block.md`) |
| #3 | **Read** my brief |
| #8 | the aborted unquoted-glob grep — **the incriminating row** |
| #29 | **Write** report — the open pass |
| #30 | Message `OPEN PASS FILED` |
| #40/#42 | probe copied into `/workspace`, then removed |
| **#44** | **Read Part II** |
| **#45** | **Read the checklist** |

**Part II and the checklist entered my context fifteen calls after the open pass was on disk.**
`[OPEN]` attributions stand as a measurement.

Two self-inflicted errors already retired in reaching this: my line-number ordering instrument was
void because the transcript is post-compaction (§22.2) — and per broadcast 6 it was void for a
**second, independent reason I had not found**, namely that `grep` over raw JSONL truncates at
escaped newlines and would have missed 21 of my commands. **I found one of the two defects in an
instrument I had already declared broken.**

### 23.6 · Broadcast 7 · Citations: no rotting pointers, and the one claim I inherited from prose

**Line-pointers into `briefs/` or `reports/` in my report: zero** (measured, and the query is
non-vacuous — it is the same pattern that matches my `.design/` citations). **Pointers into
`.design/`: zero.** My references to the dev leg's project log are **verbatim quotes**
throughout — "keyed by the exact source line, so if that line changes the exemption stops
applying", "drop the defeat → GREEN 337" — so the arguments survive the pointer rotting.

Recording the authority per broadcast 7, since `/workspace` has fifteen writers:

```
.design/project-log/url-scheme-validation-r4-fix-round.md
mtime  2026-07-28 23:43:01Z    sha256 53f92791e6297a72…
identical to the git blob at e6bda71: YES
```

**AND THE INHERITED CLAIM, WHICH IS THE HALF THAT MATTERS.** Broadcast 7 asks for the one thing
that is neither a derivation from source nor a run. **I have exactly one, and it is in C5.**

C5 has two parts. The first — *the 380 pin is an exact-equality check, so a contributor who adds
a legitimate assertion goes red and is coached by the failure message to bump the constant rather
than to look* — is **derived from source** (`run-tests.mjs:306-307,315`) and stands on its own.

The second is the observation that the log's *"drop the defeat → GREEN 337"* is inconsistent with
a 380 pin added by the same commit. **That rests entirely on the number 337, and 337 exists
nowhere but the dev leg's sentence:**

```
337 in the project log        : 1 hit  (line 158, prose)
337 in run-tests.mjs / package.json / Makefile : absent
```

I have never run the web suite — correctly, it needs a grant — so **I have never seen 337 and 380
produced by the same instrument, or 337 produced by any instrument at all.** If the dev leg
mistyped or quoted a stale run, my inconsistency evaporates and nothing else in the report moves.
**Demoting that sub-finding from a measured inconsistency to an unverified discrepancy in another
party's prose, flagged for the fix leg to resolve by running the suite once.** The blocking half
of C5 does not depend on it.

### 23.7 — Broadcast 5's standing rule is my axis, so I am consolidating: **three names that lie**

*"THE NAME IS THE SPECIFICATION … If you find a name that lies, it is a finding even when the
code is correct."* My axis is "whether the code says true things about itself," so per
test-194-r11's reasoning — **at three it is a pattern in how this code names things** — I am
filing one consolidated finding rather than three nits. All three are derivations from source.

**Required — the diff's three universal names each assert a totality the thing lacks:**

1. **`sanitizeRemoteData`** — "sanitize" names a total property. It walks `map[string]any`,
   `[]any` and `[]map[string]any`; **`map[string]string` falls to `default: return v, true`** and
   passes through verbatim with a `javascript:` URL intact (O1, measured). Six call sites trust
   this name. This is the consequential one.
2. **`TestEveryRemoteDataWriteSiteSanitizes`** — "Every" is false three ways: the scan is
   **non-recursive** over one directory, blind to **index writes** (`p.RemoteData["k"] = v`), and
   blind to **setter calls** (`SetRemoteData(...)`). Its floor is also stale at `< 4` against 6
   sanitized sites (O4).
3. **`maxRemoteDataDepth`** — names a bound on remote-data depth. **It counts map nestings only;
   list nesting does not increment it**, and `validateRemoteDataURLs` passes the *same* depth to
   `validateRemoteDataValue`. A payload can be far deeper than 32 in any ordinary sense and never
   reach the cap.

**Suggested fix:** rename to what each actually does — `sanitizeKnownRemoteDataShapes`,
`TestRemoteDataWriteSitesInServerPackageSanitize`, `maxRemoteDataMapNesting` — **or** widen the
implementations to earn the existing names. Renaming is cheaper and is the honest move for (2)
and (3); for (1) the name should be earned, because a caller reading `sanitizeRemoteData(x)` has
no reason to suspect a type-dependent hole.

### 23.8 — Re-filing O1 and O2 the right way round (broadcast 4 item 4)

> "WHEN A RUN AND A DERIVATION AGREE, THE DERIVATION IS THE FINDING AND THE RUN IS A CONTROL ON
> THE DERIVATION — not the other way round."

I filed these backwards. Corrected:

- **O1 is a derivation.** Reading `sanitizeRemoteValue`'s second type switch, `map[string]string`
  matches no case and hits `default: return v, true`. The mirror validator has no
  `map[string]string` case either. **This follows from the source and consumed no instrument.**
  R2 is a *control on the derivation*, and it agreed.
- **O2 is a derivation.** The sanitizer's `[]any` arm under a URL-bearing key `continue`s on a
  non-string element; the validator's `[]any` arm also `continue`s **but returns no error**.
  Divergence follows from reading the two arms side by side. R2 controlled it and agreed
  (`dropped=true errored=false`).
- **O2's corollary is also a derivation**: the sweep's list wrappers key on `sub_issues`, and
  `urlBearingKeyWords` does not contain it, so the generator **cannot** emit the shape. The probe
  confirmed `urlBearingRemoteDataKey("sub_issues") == false`.

**Consequence: O1 and O2 survive intact even if my probe were misbuilt, mis-copied or never
executed.** They never depended on the run. I have no queued run request to withdraw — my queue
has been empty since R2 — but had I filed one to "upgrade O1 from suspected to measured," it
would have been the backwards request the EM is now closing.

---

## 24. Retroactive: broadcast 8

**Verdict unchanged: REQUEST CHANGES.** One correction to my own §23.1, and one correction
to a mitigation the EM has mandated project-wide.

### 24.1 — **The mandated `;`-not-`&&` mitigation does not work for this bug in this harness**

Broadcast 8 item 3: *"SEPARATE YOUR CHECKS WITH `;` NOT `&&`, AND TERMINATE EVERY BATCH WITH A
SENTINEL YOU ACTUALLY READ."* **The first half is false here. The second half is what caught it.**

I found this because item 3 indicted my own #93 — the command I ran to *demonstrate* the glob
hazard. It used `;` throughout and still lost every check behind the abort, including the
quoted-form control. So I tested the mitigation rather than adopting it. Four experiments:

| # | Context | Result |
|---|---|---|
| A | `zsh -c 'echo BEFORE; <bad glob>; echo AFTER'` | **AFTER printed.** `;` survives |
| B | `zsh -c 'eval "echo BEFORE; <bad glob>; echo AFTER"'` | **AFTER printed.** My eval hypothesis **refuted** |
| C | harness top level: `echo P1; false; echo P2; SENTINEL` | all printed — **no `errexit`**, so a mere non-zero exit does not truncate |
| **D** | harness top level: `echo Q1; <bad glob>; echo Q2; SENTINEL` | **Q1 only. Q2 and the sentinel gone. rc=1** |

**D is the environment every leg actually runs in, and `;` does not protect it.** C rules out
the obvious explanation: this is not `errexit`, because a plain `false` mid-batch is harmless.
A zsh nomatch is a **fatal expansion error that terminates the whole command line**, not a
command that fails — which is why `;` is the wrong tool. `;` guards against non-zero exits, and
this is not one.

I note that I reached the right answer only after B **refuted my own stated hypothesis** (that
the harness's `eval` wrapper was responsible). I had a plausible mechanism, it was wrong, and
the measurement said so. Tonight's pattern, again: conclusion right, first reason wrong.

**Mitigations that do work:** quote the glob (removes the cause); isolate any risky command in
`zsh -c '…'` (contains the abort, per A/B); and **terminate every batch with a sentinel you
actually read** — which is the only reason this is in the report rather than in my blind spot.

**Correction to §23.1, which I have superseded in place rather than erased.** That section
displayed a two-line before/after block ending `--include='*.go' … -> works`. **That line never
ran.** It was in the same truncated batch. The claim is nonetheless true, measured separately
and in isolation: the quoted form returns **19 lines** for `sanitizeRemoteData(` under
`internal/server/`. **The finding stands; the evidence I printed for it was manufactured by the
very bug it described.** That is the echo-header effect operating one level up — not a caption
over an error, but a caption over an *absence*.

### 24.2 · Backticks in `scion message` · clean, 6 for 6

Seven detector hits, **hand-adjudicated**: six are real `scion message` calls (#30, #50, #68,
#76, #85, #99) and **every one contains zero backticks**; the seventh (#105) is **this turn's
audit script matching the phrase "scion message" inside its own heredoc** — the same
self-match that inflated my glob count. Nothing I sent tonight was executed by the reporting
channel, and every message I sent arrived.

That is habit, not discipline — I quote code with `'…'` and `"…"` out of long practice, and I
had no idea the channel would run backticks. **This message and every one after it uses the
quoted-heredoc idiom**, which is now the rule rather than my luck.

### 24.3 — Channel 6, the abandoned `mkdir`: measured null with a positive control

- **`mkdir` calls in my session: one** — `mkdir -p /var/tmp/scratch-review-xss-r4`, outside the repo. (Three further hits were my audit script matching its own regex source.)
- **Empty directories under `/workspace`: 0.**
- **Positive control on that null**, because a `find` that is silently misaimed also prints nothing: I created `zz_reviewxssr4_emptydir_control`, the instrument reported **1**, I removed it, the instrument returned to **0**. **The zero is measured, not assumed.**
- `git -C /workspace clean -nxd internal/server/` — **no output, rc=0.**

**And I committed broadcast 8's cwd hazard while checking for broadcast 8's cwd hazard.** My
first `git clean -nxd` ran with a relative invocation after a `cd /var/tmp/...` earlier in the
same batch, and returned `fatal: not a git repository` — **an error where I had asked for a
restore verification.** Under an echo header captioned "nothing to clean," that reads as a pass.
Re-run with `git -C /workspace`, it is genuinely clean. *A restore check that runs in the wrong
directory reports the wrong tree, and it reports it as good news.*

- **Relative-path mutating commands: zero.** My only two writes into `/workspace` (`cp` at #40, `rm -f` at #42) both used absolute paths.

### 24.4 — Final restore state, all four channels, absolute paths throughout

```
HEAD                                e6bda71
git status --porcelain -uall        0 lines
git clean -nxd internal/server/     0 lines
empty dirs under /workspace         0        (instrument positive-controlled)
grep -rl REVIEWXSSR4 /workspace     0 files
artefacts that ever entered the tree 1       (named; placed #40, removed #42)
```

**Probe cells left dirty: 0.** `--ignored` reports 14012 lines; that is `node_modules` and build
output, none of it mine, which is exactly why the **content** grep rather than the ignore-aware
git check is the load-bearing instrument here (§21.3).

### 24.5 · Broadcast 8 item 9 · the SHA every pointer in this report resolves against

> **All source citations in this report — every `file:line` — resolve against
> `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1`, the commit under review.** They do not resolve
> against `/workspace`'s current checkout for any other branch, and several would land on
> unrelated code if they did.

I also re-verified the one non-source authority I quote: the in-tree project log is byte-identical
to its blob at `e6bda71` (`sha256 53f92791e6297a72…`, mtime 23:43:01Z), and I quote it verbatim
rather than by pointer.

### 24.6 — My own report is mutable and I could not have told by looking

While editing §23.1 the harness warned the file *"had been modified on disk since you last read
it."* The benign explanation is correct — my own `cat >>` appends are invisible to the Edit
tool's state tracker — and I verified it rather than assuming: **24 sections, correct order, no
duplicates, no foreign content, no other leg named as author, owner `scion:scion`.**

But the warning is indistinguishable from the one broadcast 7(a) describes, where **another
party's edit to my report would arrive rendered as my own text.** I had no instrument that could
tell those two apart until I ran the section census. Worth noting that this is the same
Bash-blindness as the write arm (§23.3), one layer up: **the Write/Edit tool's model of the file
is wrong for exactly the same reason its census of my writes was wrong** — I mutated a file
through a channel the tool does not observe.

---

## 25. Amendment: C6-1's premise is false. Verdict unchanged.

**REQUEST CHANGES stands.** None of the six Required findings (O1, O2, O3, O4/C4-2/C4-4, C5-1,
§20.4) depended on C6-1, and none moves.

### 25.1 — What I got wrong, and what I verified before conceding it

The EM measured the collection path at `e6bda71` and reported that my C6-1 consumer chain,
though exact, **cannot be entered**. I verified all three links myself rather than accepting a
correction to my own filed record:

| Link | Verified |
|---|---|
| Sole producer of `Collection.remote_data` | `entstore.go:2117` ← `export_import.go:332`, both routed through `sanitizeRemoteData`. `collCreate` is the only collection-typed setter call site |
| Source type is JSON-decoded | `export_import.go:39` — `RemoteData map[string]any` with `json:"remote_data,omitempty"`. Value set is `{map[string]any, []any, string, float64, bool, nil}` — **all accepted by `structpb.NewStruct`** |
| No adapter populates a collection's `remote_data` | Confirmed. **Query is non-vacuous: 20 adapter `RemoteData` sites exist**, and every one builds a *task* via `buildRemoteData(issue, …)` |

**The field is closed under the representable set by construction, so `:534` cannot fail, so
the two consumers I traced read a field that cannot fail.** My "latent, not currently firing"
rating was correct — but I reached it by the weak route ("in practice it's JSON-decoded"), and
the strong route is that **it is structurally impossible**, which is a different claim and a
better one. I filed the right conclusion with a reason that did not establish it. That is the
night's pattern, and this time it was not caught by my own instrument.

### 25.2 — The complement is the actual finding, and the round crossed its own wires

> **The field that CAN fail has no consumer. The field with two consumers CANNOT fail.**

- `Task.remote_data` — **can** fail (adapters emit `[]string`; O1's `map[string]string` also reaches it) — is read by **nothing** in `web/src`.
- `Collection.remote_data` — read by `capabilities.ts:98` and `ft-app.ts:256`, both gating write permissions — **cannot** fail.

The round found one of each and joined them. **I joined them**, in C6-1, and produced a
plausible user-visible failure that does not exist. Filing the crossing itself as the useful
residue: an exposure analysis and a consumer analysis were each correct about their own field
and were combined without checking that they were about the same field.

**Severity: FYI.** No action for the fix leg beyond the reduced `convert.go:358` note in C6-1.
This is a lesson about how the round reasoned, not a defect in the diff.

### 25.3 · The discipline, restated where it costs me something

C6-1 carried this: *"I am explicitly not using 'the line was touched' as licence to require a
pre-existing fix."* The finding it was attached to has now fallen. **The discipline is
unaffected, and I am restating it here rather than letting it disappear with the finding** — a
rule that only gets cited when it is free is not a rule. Had I applied it less strictly, X8
would have been filed Required on a pre-existing line, and the premise underneath it was wrong
the whole time. **The scope discipline protected the round from my own error, not just from an
over-eager fix request.**

### 25.4 — What this does not change

The `structpb` error discards remain undocumented and unlogged, and `sanitizeRemoteData` still
has the `map[string]string` hole (O1) that reaches `Task.remote_data`. **O1 is untouched by this
amendment**: it is a derivation from the type switch (§23.8), it was measured on the sanitizer
and the importer directly, and it never depended on any consumer existing. A sanitizer that
passes `javascript:` through verbatim is a defect whether or not today's clients read the field.

---

## 26. Delta opinion on the CHANGED remedy (broadcast 9 item 8) — source only, no run

**The new remedy as described would introduce a security regression. Do not ship it in the
stated order.** My verdict on the diff is unchanged (REQUEST CHANGES); this section reviews the
*fix*, not the diff.

Remedy as stated: **representability normalisation at the sanitizer's exit**, plus logging the
discarded `structpb` error at `convert.go:358` and `:534`.

### 26.1 — **Required (fix leg): normalise at ENTRY, not at exit. At exit it weaponises O1.**

`structpb.NewValue` (v1.36.11, read from source) accepts `nil, bool, int*, uint*, float*,
json.Number, string, []byte, map[string]any, []any`. **There is no case for `map[string]string`
or `[]string`; both fall to `default: invalid type: %T`.** `NewStruct` returns on the first
failing key, so one bad value nulls the *entire* field.

That gives today's actual behaviour on O1's payload:

```
{"parent": map[string]string{"html_url": "javascript:alert(1)"}}
  -> sanitizeRemoteData: passes through VERBATIM      (O1 — the walk has no map[string]string case)
  -> structpb.NewStruct: ERROR, invalid type          (map[string]string is unrepresentable)
  -> convert.go:358: error discarded, field = nil
  ==> THE javascript: URL NEVER REACHES THE CLIENT.
```

**O1 is currently non-exploitable through this path precisely because of the X8 discard the
remedy exists to remove.** The unrepresentability is doing security work by accident.

Now apply exit-normalisation without fixing the walk:

```
  -> sanitizeRemoteData: passes through verbatim      (O1 still unfixed)
  -> exit normalisation:  map[string]string -> map[string]any   (now representable)
  -> structpb.NewStruct:  SUCCEEDS
  ==> THE javascript: URL IS DELIVERED TO THE CLIENT, UNVALIDATED.
```

**Fail-closed becomes fail-open, and the change that does it is the security fix.** This is the
load-bearing-coincidence class from broadcast 9 item 5(c), inverted: a *safety* property resting
on a *defect*, where removing the defect removes the safety and nothing in the round's record
says so.

**The fix is ordering, and it is cheap.** Normalise **on entry**, before the URL walk:
`map[string]string → map[string]any` and `[]string → []any` first, then walk. The walk then
descends into `parent`, recognises `html_url` as URL-bearing, and drops the `javascript:` value.
**Entry-normalisation fixes O1 and achieves representability in one move. Exit-normalisation
achieves representability and arms O1.** Same code, same cost, opposite security outcome.

**Apply the identical change to `validateRemoteDataURLs`**, or the sanitize/import asymmetry (O2)
widens: the importer would keep rejecting nothing while the sanitizer's coverage grows.

### 26.2 · Required (fix leg) · The sanitizer's output is **persisted**, not just serialized

A normaliser designed for the wire is about to be applied to the database. All four
`export_import.go` call sites feed **store** params, not proto:

```
export_import.go:332  RemoteData: sanitizeRemoteData(doc.Collection.RemoteData)
        -> store.ImportCollectionParams -> entstore.go:2117 collCreate.SetRemoteData(…)
```

So exit-normalisation changes **what is written to Ent**, not merely what crosses the wire. For
`map[string]string → map[string]any` that is JSON-invisible and harmless. **For numerics it is
not:** if the normaliser mirrors `NewValue`'s coercions, `int64 → float64` loses integer
precision above 2^53, and it does so *in storage*, irreversibly, where today the value round-trips
intact because Ent stores it as JSON and `NewValue` coerces only the outbound copy.

**Recommendation: normalise a copy on the proto path only, or restrict the normaliser to the
container types (`map[string]string`, `[]string`) and leave scalars alone.** The container cases
are the ones that actually fail; the numeric coercions are `NewValue`'s job and should stay there.

### 26.3 — FYI: the logging half is sound, with two caveats

No objection to logging the discarded error. Two notes:

1. **`:534` cannot fire** (§25 — collection `remote_data` is closed under the representable set by construction). That log line will never emit. Harmless, but someone will later exercise the logging, see nothing at `:534`, and draw a conclusion. Worth a comment saying so.
2. **If normalisation is total, `NewStruct` can no longer fail at all**, so both logged branches become provably dead. Then the message must not read like a data problem — reaching it would mean the *normaliser* has a hole. Word it as an invariant violation (`"remote_data failed representability after normalisation — normaliser gap"`), not as `"remote_data not representable"`. Per the standing naming rule (§23.7), a log line that misdescribes its own trigger sends the next reader after the wrong bug.

### 26.4 · Blast radius of the postcondition change · six callers, one real risk

`sanitizeRemoteData` has six call sites (`convert.go:358`, `:534`; `export_import.go:139`, `:332`,
`:438`, `:743`). Widening its postcondition from "URL-safe" to "URL-safe **and** representable"
is safe for all six *as consumers* — nobody relies on the function returning unrepresentable
values. **The risk is not the callers; it is the second concern in a function whose name already
overstates the first** (§23.7). `sanitizeRemoteData` would then perform URL-scheme validation
*and* type normalisation, two orthogonal properties, behind one verb.

**Optional, and I would take it:** make normalisation a separate exported step
(`normalizeForStructpb`) called at the two proto sites, and keep `sanitizeRemoteData` doing one
thing. That also makes §26.2 fall out for free — the store paths simply do not call it. It does
*not* satisfy §26.1 on its own: the `map[string]string → map[string]any` widening must **still**
happen before the URL walk, inside the sanitizer, because that is what fixes O1.

### 26.5 — What I could not assess without a run

Whether the normaliser preserves the existing agreement sweep's invariants
(`TestSanitizeAndImportAgreeAtEveryDepth`). It pins sanitizer/importer agreement, and §26.1
changes what the sanitizer walks — **so that pin should move first and be seen to go red**, or it
will silently keep passing on a generator that (per O2) cannot produce the divergent shapes
anyway. Source-only, I can say the pin is *insensitive* to this change; I cannot say what it does
when run.

---

## 27. The falsification test (broadcast 9 items 6 and 7)

### 27.1 — Every error I attributed to apparatus, tested. **I retract 2.**

The rule: produce the record where the instrument gave the **wrong answer**. If I cannot, the
error was mine.

| Error | Did the instrument answer wrongly? | Verdict |
|---|---|---|
| **`head -40` truncated the C4-3 enumeration** | **No.** `head -40` returned the first 40 lines, correctly and completely. I asked for 40 lines and read the answer as "all sites." | **RETRACTED — mine** |
| **The line-number ordering instrument was "void"** | **No.** `grep -n` returned correct line numbers. The transcript being post-compaction means line order ≠ chronology, but the tool never misreported a line number; **the chronological inference was mine.** | **RETRACTED — mine** |
| #93's batch truncation by the glob abort | **Yes.** The shell silently discarded commands I had written and returned a partial output **indistinguishable from a complete one**. Record: the #93 result ends at `(eval):1: no matches found` with `rc=1`, the quoted-form control absent; reproduced deterministically later (`Q1` printed, `Q2` and the sentinel gone, `rc=1`). | **Stands — apparatus** |
| Substring test matching `briefs/review-xss-r4.md` | No — I wrote the wrong predicate | Already filed as mine |
| Self-matching detectors | No — they reported real string occurrences | Already filed as mine |
| `git clean` returning `fatal` after a cwd reset | **No.** It errored loudly and correctly; I passed a relative path | Already filed as mine |

**Retraction count: 2.** Both were cases where I built or read an instrument badly and described
the result as an instrument defect. Broadcast 9 item 6 is right about the pull: after an hour of
finding broken apparatus, "the instrument was broken" is the cheapest available explanation, and
it happens to be the one that does not cost the reader anything.

**One survives**, and the distinguishing feature is worth stating: **the shell did not answer
wrongly, it answered partially and formatted the partial answer exactly like a complete one.**
That is the only entry here where no amount of care in reading the output would have revealed
the problem — which is why a sentinel, not attention, is the fix.

### 27.2 · Self-tooling excluded from my own census, by record number

Stated explicitly as required. Every count I reported was hand-adjudicated, and these records are
**my own audit scripts matching their own source text**, excluded:

- **Unquoted-glob census:** hits at **#94** (×2) and **#95** were the detector's own positive-control literals (`'--include=*.go'`, `'find . -name *.go'`) inside its heredoc. Real count **1** (#8), not 5.
- **Backtick census:** hit at **#105** was the audit script containing the phrase `scion message` in its own body. Real count **0 of 6** sent messages.
- **`mkdir` census:** three of four hits at **#105** were the script's own regex source. Real count **1** (`/var/tmp`, outside the repo).
- **Relative-path census:** hits at **#50** (my *prose* describing a queued run, never executed) and **#105** (the script's own control string `cp foo.go bar/`). Real count **0**.

**Every one of these would have inflated a compliance count in my favour** — more apparent
contamination found, more apparent diligence — except the backtick one, which would have had me
confessing to a send that never happened. The direction is not consistent, which is itself the
argument for adjudicating rather than counting: **a self-matching detector does not have a bias,
it has no signal at all.**

---

## 28. Broadcast 10: the BROKEN/MISAIMED split, and the ruling

### 28.1 — My tally split. **BROKEN 2, MISAIMED 9.**

| # | Event | Class |
|---|---|---|
| 1 | #93 batch truncation — shell discarded commands I wrote, returned a partial output **formatted identically to a complete one** | **BROKEN** (deceptive) |
| 2 | #8 glob abort — shell refused to answer | **BROKEN** (loud; produced no filed result, corrected two calls later) |
| 3 | `head -40` on the C4-3 enumeration | MISAIMED — correct first 40 lines |
| 4 | Line-number chronology | MISAIMED — correct line numbers, wrong inference |
| 5 | Substring predicate matching `briefs/review-xss-r4.md` | MISAIMED — correct about substrings |
| 6–9 | Four censuses matching their own source (glob, backtick, `mkdir`, relative-path) | MISAIMED — correct about string occurrence, wrong corpus |
| 10 | `git clean` after a cwd reset | MISAIMED — correct answer about `/var/tmp` |
| 11 | **This turn:** `find … -name 'struct.go'` returned nothing; the file is `struct.pb.go` | MISAIMED — caught by a 12139-file control |

**Only #1 and #2 are tooling problems, and only #1 ever deceived me.** Everything else was the
shell answering exactly what I asked.

### 28.2 · **My control design assumed misaiming, and I never said so**

Broadcast 10 item 4 is correct about me specifically. Every control I built has the form *"does
the detector fire on a known-positive literal?"* — `pat.search("grep -rn --include=*.go x .")`.
**That varies the query and keeps the idiom.** So by construction it detects misaiming and is
structurally blind to breakage.

The record matches exactly: **my controls caught misaiming repeatedly and never once caught an
abort.** #8 was caught by the error being loud; #93 was caught by a missing sentinel and the EM's
broadcast. **No control I built has ever detected a broken instrument, and I did not notice
because 9 of my 11 problems were misaiming.** My controls worked because I happened to have the
disease they were designed for. That is not a control regime; it is a coincidence with good
coverage.

### 28.3 — Item 5 verified against my own censuses. **They were clean by timing, not by design.**

I re-ran my glob census unchanged, thirty minutes later:

```
hits when I ran it (calls <= 95):   [8, 93, 94]
hits now:                           [8, 93, 94, 98, 99, 101, 102, 104, 125]
new hits from my own write-up:      #98, #99, #125  <- report appends and a sent message
```

**And the sharper form:** records whose *command* contains the literal string
`no matches found` — with **no glob in them at all** — are `#98` and `#125`, **both report
appends.** The detector finds the document it is auditing, exactly as test-194-r11 described.

**My census tripled purely because I documented the failure mode well**, and it was clean when I
ran it only because §23.1 did not exist yet. Had I run the identical census now and counted, I
would have filed 9. Adopting the standing rule: **censuses exclude `reports/` by path**, and I
would add — exclude report-append commands from transcript censuses too, since the report text
travels inside the Bash record.

### 28.4 · The ruling · agreed, with one caveat moot and one promoted

**LOGGING ONLY is the right call**, and the synthesis is right that entry-normalisation does not
answer audit-xss-r4's objection — `urlBearingRemoteDataKey` is a **key-name** predicate, so
`design`, `notes` and `metadata` are never inspected under either scheme. My O1 and their finding
are different holes: mine is *a walk that skips a type*, theirs is *a predicate that skips a name*.
Neither normaliser touches theirs.

Consequences for my §26:

- **§26.3 caveat 2 (word the log as an invariant violation) is MOOT.** It was conditional on normalisation shipping. Withdrawn.
- **§26.3 caveat 1 is PROMOTED.** `:534` cannot fire (§25). If the entire shipped remedy is "log at `:358` and `:534`," then **half of it is at a site that cannot execute**, and "we log both sites" will read as coverage in the next round's summary. Ship the `:534` log with a comment saying it is unreachable by construction, or do not ship it.

### 28.5 — **Required (next round's gate): the masking is now load-bearing and has a scheduled removal date**

This is the part the ruling creates and nothing currently records.

With normalisation deferred, **O1's non-exploitability through the proto path depends entirely on
the unrepresentability accident continuing to hold** — `map[string]string` fails `NewValue`, the
field nulls, the `javascript:` URL never ships. That is a load-bearing coincidence (broadcast 9
item 5c) which is now **scheduled to be removed by a named future round**, by a leg whose task
will be described as "make `remote_data` representable."

**A comment is not enough. Recommend a pinned regression test**, specifiable now, no token
needed:

```go
// Pins the CURRENT fail-closed behaviour, not a desired one.
// If this goes red, representability normalisation has been added WITHOUT fixing O1's
// map[string]string walk, and a javascript: URL now reaches the client.
func TestMapStringStringRemainsUnrepresentable_GuardsO1(t *testing.T) { … }
```

**That converts the coincidence into a guarded invariant with an alarm on it.** It is the only
artefact that survives the handoff to a leg that will not have read this report. Without it, the
entry-normalisation round removes the masking silently and correctly-by-its-own-lights, and O1
ships armed — which is precisely the failure mode this round exists to prevent.

---

## 29. Broadcast 11: the four-way split, and a phantom event I filed twice

### 29.0 — ID qualification: done by MAPPING, not by rewrite (broadcast 11 item 1)

**I have not run, and will not run, an automated ID rewrite over this file.** Item 1 is right that
a compliance script edits the evidence to match the corrected world, and this report is unusually
exposed to that: it quotes governing broadcast text verbatim throughout, under `>` blocks and inside
quote marks, precisely because broadcast 7 told me to.

Non-destructive equivalent, authoritative from here on — **every bare ID in the body of this report
is to be read with the prefix `XSS-R4-`**: `O1`…`O13` → `XSS-R4-O1`…`XSS-R4-O13`; `C1`…`C8` and
their sub-IDs (`C4-2`, `C4-4`, `C5-1`, `C6-1`) → `XSS-R4-C…`. **This mapping does not apply inside
quoted spans**, which reproduce someone else's utterance and are excluded from every sweep.

A declared mapping is strictly safer than a rewrite: it qualifies every ID including ones a regex
would miss, and it cannot corrupt a quotation. **Recommend the fleet prefer it to scripting.**

### 29.1 · **My four-way split: BROKEN 1 / MISAIMED 9 / REFUSED 1 / UNREAD DIAGNOSTIC 1.**

Previously filed as 2/9/0/–. Both changed numbers are corrections, and one is a new event found
while answering this broadcast.

| Class | N | Events |
|---|---|---|
| **BROKEN** | **1** | `#93` batch truncation. Accepting your ruling that this is genuine and one of the fleet's few: partial output formatted identically to a complete one, **and it produced a filed result.** |
| **REFUSED** | **1** | `#8` glob abort. Reclassified from BROKEN on your definition — loud, in writing, produced no filed result. |
| **MISAIMED** | **9** | chronology; substring predicate; four self-matching censuses; relative-path `git clean`; `find struct.go`; **and one new, below.** |
| **UNREAD DIAGNOSTIC** | **1** | `head -40`. **Newly measured this turn, and it is the interesting one.** |

### 29.2 — **The `head -40` was a phantom. I filed it as an error twice, under two different captions, and it never happened.**

Under broadcast 9 I retracted `head -40` from apparatus to my own misreading: *"head answered
correctly; I asked for 40 lines and read it as 'all sites'."* **That retraction was also wrong.**
Reading the full command back out of the transcript at record 12:

```
grep -rn "validateImported…|validateRemoteData…|sanitizeRemoteData" --include="*.go" internal \
  | grep -v "_test.go";                      <-- the ENUMERATION. no head. UNBOUNDED.
echo "=== call context ===";
grep -n "validateImportedTaskURLs" -A4 -B10 internal/server/export_import.go | head -40
                                             <-- the head was on THIS. 15 lines out. cap 40.
```

**The `head -40` was never attached to the enumeration.** It capped a 15-line context display at 40.
The enumeration was a separate, unbounded grep that returned 22 complete lines. Nothing was lost,
nothing was truncated, and **all of that was visible in the record at the moment I filed the claim.**

That is your class 4 exactly: the evidence of the non-failure was already in the record, and I wrote
an error report over the top of it — **twice, and the second time while running a protocol explicitly
designed to catch the first.** Broadcast 9 asked me to produce the record number where the instrument
gave the wrong answer. I produced a record number. **I never checked whether the event in it had
occurred.** A retraction protocol that demands a record number gets one; it does not force anyone to
read it.

**This is broadcast 11 item 2 with a worked example.** I set evidence aside under an apparatus
caption, then re-set it aside under a misaiming caption, and both were unreliable for the same
reason: no one, including me, went back to the record.

### 29.3 · The new MISAIMED, which is the same disease one level up

My first attempt to test §29.2 asked *"was record 12's output exactly 40 lines?"*, got **38**, and
concluded "no truncation." **Right conclusion, wrong population** — I had counted the whole tool
result, and had also filtered blank lines, which is invalid in a test for a line cap. The correct
question was never *how many lines came out* but ***which command the head was attached to***.

Counted as MISAIMED. It is broadcast 4's warning holding at the meta-level: **my conclusions were
right and my stated reasons were wrong, in the very instrument I built to audit my reasons.**

### 29.4 — Item 4 v3 confirmed first-party, by a second, independent detector

A shape census over `SENTINEL` tokens in my own Bash records reports **8 occurrences flagged as
reuse**. Source classification collapses it to **zero**:

- records 116, 138 — **my own message text and this very detector's source**, quoting the word;
- record 108 — **three prose lines from my own report table** describing the sentinel experiment, plus one genuine live `SENTINEL-8-END`.

**All 32 of my numbered sentinels are distinct and each was used exactly once.** No reuse ever
occurred. The apparent 8 are 100% prose and self-match.

This is the glob-census result reproduced on unrelated tooling, and it supports your v3 over v2:
**anchoring would not have helped here at all**, because a quotation of a sentinel *is* a sentinel,
character for character. Only "did the COMMAND read the transcript" separates them. And per your
note, my `/var/tmp/scratch-review-xss-r4/` is now a second contamination corpus that no `reports/`
exclusion names — **records 138 and 116 are exactly that corpus contaminating exactly that census.**

Adopting: **session-unique random suffixes** from `SENTINEL-31-a7f3-END` onward.

### 29.5 · Item 6: I verified the relay from source and found the root cause underneath it

Sent separately and urgently for `dev-xss-r5`'s dispatch; recorded here for the file. Measured against
`e6bda71` by transcribing the regex at `remotedata_depth_test.go:454` and re-running the scanner offline:

- **Relay confirmed.** Clean 6/6 → after the obvious `, err =` edit, 4/4. The two `convert.go` sites **stop matching the regex entirely** — they vanish from the numerator *and the denominator*, so they are never reported unsanitized. `4 < 4` is false. Green.
- **Root cause, which Form E does not touch.** Line 578 says *"expected at least 4 (convert.go x2, export_import.go x2)."* Measured distribution is **convert.go 2, export_import.go FOUR** (`:139`, `:332`, `:438`, `:743`). **The parenthetical is false about the tree**, and the floor was never raised though its own comment says to. **Slack = 2, exactly the number of sites that vanish.** Had the floor been maintained, the obvious edit would have gone red unaided. **The stale floor is the defect; the regex is only the mechanism.** On my axis this is a comment that says a false thing about itself, and it is the reason the failure is silent.
- **A measured remedy strictly better than Form E.** Widen `(?:,\s*_)?` — a hard-coded *blank identifier* — to `(?:,\s*\w+)?`. Measured: clean 6/6, after-log **6/6, sites retained**, and all five rows of the unit table at `:474` still correct, including the `sanitizeRemoteDataKeys` near-miss and an unsanitized `, err =` line correctly reported rather than vanishing. **Form E is a discipline remedy: it requires every future author to keep `sanitizeRemoteData(` lexically on the RHS and never use a named error, with nothing enforcing it — the trap is re-armed at the next site.** Widening re-aims the instrument instead of routing humans around it, and it also disposes of the "remediation advice leads the developer into the other finding" problem without anyone remembering a rule.
- **Caution on the floor bump.** `6` hard-codes today's count and will rot the same way, silently, in the exonerating direction. The durable form separates the two questions one number is doing badly: assert **`sanitized == sites`** ("is the tree clean", count-free) and keep a small floor purely as **"is the scanner matching at all"**.

### 29.6 — Standing rule 7(a), as adopted

Recorded so the wording travels: **when a finding is downgraded because of an accident, the deferral
must ship a test that goes red when the accident is removed. A deferral without an alarm is the
no-action label with a longer fuse.** For this round that is
`TestMapStringStringRemainsUnrepresentable_GuardsO1`, gating XSS-R4-O1.

**Verdict unchanged: REQUEST CHANGES.** Nothing in broadcasts 10 or 11 resolves any of the six
blocking findings; item 6 adds a seventh defect in the instrument that makes two of them visible.

---

## 30. Correction to §29.5's §4 caution — my proposed guard passes the defect I found

> ### ~~SUPERSEDED — §29.5's final bullet ("the durable form … assert `sanitized == sites`") must not be read forward as a sufficient guard. See below.~~

The EM flagged that my proposed replacement is necessary and **not** sufficient. I tested it rather
than accepting the relay — the same standard I applied to the relay that produced §29.5 — and **the
EM is right. My guard as written ships GREEN on the exact scenario I discovered.**

| scenario | sites/san | floor ≥1 | `san==sites` | membership | overall |
|---|---|---|---|---|---|
| 1 clean tree, old regex | 6/6 | PASS | PASS | PASS | GREEN ✓ |
| **2 obvious-log edit, old regex** | **4/4** | **PASS** | **PASS** | **FAIL** | **RED — membership only** |
| 3 obvious-log edit, widened regex | 6/6 | PASS | PASS | PASS | GREEN ✓ |
| 4 one site desanitized | 6/5 | PASS | FAIL | FAIL | RED |
| 5 coordinator's disjoint six | 12/12 | PASS | PASS | FAIL | RED |
| 6 unsanitized site added to an existing file | 7/6 | PASS | **FAIL** | **PASS** | RED — `san==sites` only |

**Row 2 is the finding against me.** When a site vanishes it leaves *both* sides of the equation, so
`sanitized == sites` reads 4 == 4 and passes, and the anti-vacuity floor passes on 4 ≥ 1. **Both of
my layers are satisfied by the disappearance.** Only naming the expected files catches it —
`convert.go` drops out of the per-file map entirely.

This is worth stating plainly rather than burying: **I diagnosed the defect correctly, identified
the true root cause, and then proposed a remedy that does not detect it.** The count-free formulation
felt more durable because it removes a magic number, and I did not test it against the very scenario
that motivated it. A remedy is a claim, and I filed it without a measurement while the whole round
was about exactly that.

**Rows 2 and 6 together show neither layer subsumes the other:** membership catches 2, 4, 5;
`sanitized == sites` catches 4 and 6 — an *unsanitized new site in an already-expected file* leaves
per-file sanitized counts untouched. I checked this specifically because my next instinct was to
propose dropping a layer, and that would also have been wrong. **All three ship.**

### 30.1 — The one thing I would still add: the layers differ in *failure direction*

The floor (`san ≥ 1`) is in fact **subsumed by membership** — total vacuity gives `per == {}`, which
fails membership already. Keep it anyway for the error message, but **label it a diagnostic, not a
guard**, because the way the current floor rotted is precisely that it was maintained as though it
were load-bearing when it never was.

That generalises into the design rule I would actually bank from this commit, and it is the reason
membership is the right layer to lean on:

> **Prefer a guard whose staleness fails CLOSED.** A count floor goes stale *silently and in the
> exonerating direction* — add a site, forget the number, and the margin quietly absorbs a real
> regression. A membership set goes stale *loudly and in the blocking direction* — add a site in a
> new file and the test goes red until a human updates the expectation. **Both require maintenance.
> Only one punishes you for skipping it.**

The current defect is that rule violated: a floor of 4 against 6 real sites, with a comment three
lines above instructing the maintainer to raise it, in a file where a site was added twice and it
was not raised. A floor of 5 would have failed loudly. **The margin absorbed the loss to the unit;
we were missed by one.**

**No change to the verdict or to any finding.** This corrects a design recommendation I made, not a
defect I reported.

---

## 31. Broadcast 12: re-presented tally, a beads re-rating, and my widening is dead

### 31.0 — My widening recommendation is withdrawn. The coordinator is right.

> **~~SUPERSEDED — §29.5's third bullet and §30's premise both recommend widening `(?:,\s*_)?` to `(?:,\s*\w+)?`. That remedy is dead. See below.~~**

`,\s*\w+` matches an **identifier** and not a selector (`m.err`), an index (`errs[0]`), or a blank.
**I moved the blind spot; I did not close it.** The correct form is to anchor on the RHS and not
constrain the LHS at all — split at the assignment operator, LHS mentioning `RemoteData` means SITE,
RHS containing `sanitizeRemoteData(` means SANITIZED, **no LHS shape enumerated, so no LHS shape can
hide.**

And I want the defeat recorded precisely, because it is my own argument turned on me one level up.
I argued Form E was a *discipline remedy* — "it keeps the query aimed where the instrument happens to
look" — and that widening *re-aims the instrument*. **Widening is still an LHS enumeration, and
therefore still discipline about shape.** The prospective taxonomy test that selected widening over
Form E is the same test that kills widening on the second pass.

That is the strongest available evidence *for* the criterion, not against it. The coordinator's
framing is better than my original claim and I am adopting it verbatim: **"a test that only ratifies
the choice you already made proves nothing. This one overturned its own first verdict on the second
pass."**

### 31.1 · Item 1 re-presented: **5 distinct incidents**, class-pairs, non-exclusive tags

Under the corrected format. Definition used, stated so the number is checkable: **an INCIDENT is a
wrong statement that reached a durable artefact** — this report or a message to the EM. Events I
caught before filing are listed separately and are *not* added in.

| # | Incident | instrument axis | investigator axis |
|---|---|---|---|
| 1 | `#93` batch truncation → fabricated evidence block in §23.1 | **BROKEN** | — |
| 2 | `head -40` phantom → filed twice, under two different captions | — | **UNREAD DIAGNOSTIC** |
| 3 | Line-number chronology inference | — | **MISAIMED** |
| 4 | §29.5's guard recommendation — passes the defect it was written for | — | **MISAIMED** |
| 5 | §29.5's widening recommendation — moves the blind spot (§31.0) | — | **MISAIMED** |

**Distinct incidents: 5.** Instrument axis: BROKEN 1, REFUSED **0**, none 4. Investigator axis:
UNREAD DIAGNOSTIC 1, MISAIMED 3, none 1.

**Caught before filing, therefore not incidents (~7):** the substring predicate; four self-matching
censuses; the relative-path `git clean`; `find struct.go`; `audit14`'s wrong-population line count.

**Two things fall out, and both confirm the retraction from the opposite direction:**

1. **My REFUSED column goes to zero.** I filed REFUSED 1 (`#8`'s glob abort). Both of my refusals — `#8` and the `git clean` fatal — were **read and corrected, and produced no filed result.** A refusal that is read causes no error, exactly as two legs derived. A REFUSED column populated with read refusals was counting *events*, not *errors*, and I summed the two ledgers together.
2. **My earlier 12 was not a count of anything.** 1+9+1+1 summed a table whose columns measure different subjects. The honest numbers are **5 incidents** and **~7 near-misses**, and neither is 12.

Incidents 4 and 5 are both new tonight and both the same shape: **a remedy filed without being tested
against the class it was written for.** That is the count-pin defect in my own recommendations —
I prescribed alarms for other people's coincidences and shipped two fixes without an alarm of my own.

### 31.2 — **Item 8: my report DOES cite `beads`, and a code-span mask nearly hid it from me**

Re-rating as instructed. Two citations, both in coverage tables:

- **line 1560** — ``| `internal/platform/beads` | 2 — `beads.go:199,238` | **no** |``, inside the table concluding **"the scanner sees 7 of 12."**
- **line 797** — the enumeration of the 5 out-of-package write sites.

**What survives:** the *coverage* claim. "The scanner sees 7 of 12, and 7/7 within `internal/server`"
is a statement about instrument reach and is unaffected by whether the code is reachable.

**What must be re-rated:** the *risk* reading of the 5 unscanned sites. It is **3 reachable**
(`internal/platform/github`) **+ 2 dormant** (`beads`), not 5 live. Anything that treated 5 as a
live exposure count was wrong and is corrected here.

> ### ⚠ **PROVISIONAL — the "2 dormant" half of this re-rate is NOT established. Broadcast 13.**
> Item 8's premise (`beads` unreachable from production) is **downgraded to provisional**: it rests
> on one leg's measurement of *zero non-test importers*, and **zero importers is not zero
> reachability** — blank-identifier init, registry registration, a string-keyed factory, or a
> build-tagged file all produce zero apparent importers and a live adapter. Two legs are measuring
> those four mechanisms now. **Not reverted, per instruction; not to be relied on until confirmed.**
>
> **What does NOT depend on the answer, and this is the reviewer's point:** the scanner is blind to
> those two sites in *both* branches. If `beads` is dead they are latent mirrors; if `beads` is live
> they are **live unsanitized write sites invisible to the guard**, which is strictly worse than
> what I filed. **The reachability question moves the SEVERITY and does not touch the FINDING**, so
> nothing in this report blocks on it. The coverage claim (7 of 12) never depended on it either.
>
> Noting for the record that my re-rate ran in the **deflating** direction — the direction the
> coordinator correctly identifies as the one nobody audits, because a deflation arrives as relief
> and reduces everyone's work. I adopted it inside ninety seconds and did not challenge it. **The
> asymmetry is real and I am a data point for it.**

**And it strengthens rather than weakens, on your own alternative:** two unsanitized `RemoteData`
write sites in a package with zero non-test importers is **a latent mirror in the exact sense
test-194-r11 defined.** They are inert only while nothing imports `beads`. The day someone wires the
adapter up, two unsanitized sites go live *and the scanner still does not see them* — and nothing in
the tree records that dependency. **That is XSS-R4-O1's shape again**: a safety property resting on
an accident with no alarm on it, and it takes the same remedy — §29.6's rule, applied to `beads`.

### 31.3 · Item 6 adopted, and it earned its keep inside this section

I used the failing-control form for both scripts in this section. **It caught a false clean
immediately**, which is item 4's unverified null with the repair still pending:

My ID census masks code spans. The same mask reported **"occurrences of `beads` outside code spans:
**0**"** — and every real citation is inside backticks, because they are file paths. **The naive
reading of that null is "no beads dependency, item 8 does not touch this report," and it is false.**
Only the unmasked count (4) forced the review that found the two table citations above.

**I excluded by shape what I should have excluded by source** — item 5's cause, arriving in a census
I wrote *after* reading item 5, in a different context than the one it warned about. The mask was
correct for counting IDs and wrong for detecting dependencies, and it is the same mask.

### 31.4 — Item 5: my residual bare-ID count, as asked

I did not run the rewrite, so my exposure is under-application by construction. Measured, code spans
excluded: **186 bare IDs, 1 qualified** (`XSS-R4-O1`, line 2488, in §29.6).

**That single qualified instance is the failure mode you describe**, in miniature: one qualified ID
among 186 bare ones reads as a deliberate distinction, and it sits in the newest section where a
reader is likeliest to take it as intentional. §29.0's declared mapping is what makes the bare IDs
safe, **and it is safe only because it is uniform** — which is the property I should have named as
the mapping's advantage and did not. Leaving the instance in place per *supersede, never erase*;
recording the count here so the asymmetry is on the record rather than inferred.

**No verdict change. No findings re-opened.**

---

## §32 · The grade turned on myself; the beads population; the corrected declaration

### 32.0 · Provenance, because the canonical text moved under me

Broadcast 14 names `em-tooling/_STANDING-RULES-2026-07-29.md` canonical and forbids
implementing from any summary, "including mine." Recording that the file **changed between my
two reads**: 265 lines / md5 `867b1be9e82dfa5923d21e9577c09d41` when I first read it in full,
**379 lines / md5 `8a10738a280b5d9725a34355598a3ea8`** now. Everything in §32 derives from the
`8a10738a` text read in full, not from my own §31-era notes on the earlier one. Anyone deriving
against my earlier citations should re-pin: the new material is §6.1–§6.5 and the beads split.

This is §3.2 (an amendment chain is a stale floor) landing on the rules file itself. I do not
propose a remedy; I note that a canonical pointer without a version is a pointer to whatever the
file says when you happen to open it.

### 32.1 · §4: can my severity grade fail for the reason it claims?

§4.1 says the grade is the one artefact nobody else inspects. I enumerated every non-blocking
grade in this report — **three** — and put §4's question to each. Two fail.

**(a) L1006 — C6-1, `~~Optional~~ → FYI`. THE GRADE FAILS, AND IT FAILS BY MY OWN RULE.**

The FYI itself is defensible: §25 showed my exposure analysis and my consumer analysis were about
different fields, so the user-visible failure I predicted does not exist. Downgrading on a refuted
premise is correct.

What is not defensible is what I struck out **in the same edit**:

> ~~**However** — if the Required findings are addressed and X8 is deferred again, I would raise
> it to Required in the next round, because the third deferral of a known silent-failure path is
> how it becomes permanent.~~

The refuted premise justified lowering the severity. **It did not justify deleting the escalation
trigger**, which rested on deferral count, not on the exposure claim. Two edits travelled under one
justification and only one of them was covered. The result is a silent-discard path sitting at FYI
with no condition under which anything ever raises it again — **§2.4, the deferral alarm, which is
my own filed rule, violated inside the act of applying a correction to my own report.** §5.3,
measured on me.

*Fix:* the grade stays FYI; **restore the trigger**. Keyed to the outcome per §2.4: if `X8` is
deferred a third time, C6-1 returns as Required.

**(b) L2122 — §25.2, FYI. THE GRADE HOLDS AS A MERGE-GATE AND FAILS §0.2.**

Correct that it gates nothing: §25.2 is a description of how the round reasoned, not a defect in
the diff. But under the crossing criterion it is **investigator-axis by construction** — prose
instructing a future reader to be more careful about combining two correct analyses. That is
discipline, and §0.2 records that discipline has scored zero tonight. I am not going to dress it
up: **§25.2 is not a finding, it is a note**, and it should be counted as zero review output
unless someone turns it into a mechanism. Grade unchanged, claim reduced.

**(c) L2233 — §26.3, "Optional, and I would take it." THE GRADE IS CONDITIONAL ON A FACT I NEVER
MEASURED.**

I recommended splitting `normalizeForStructpb` out of `sanitizeRemoteData`, then wrote that it
"does *not* satisfy §26.1 on its own" because the `map[string]string → map[string]any` widening
must still happen inside the sanitizer, before the URL walk, since that is what fixes **O1**.

So the Optional is safe **only if the fix leg reads that caveat and lands O1 inside the
sanitizer**. If it implements the split and reads the split as the remedy — which two functions
sharing a normalisation vocabulary actively invites — then my non-blocking suggestion becomes the
vehicle for missing a Required. My grade's correctness depends on a downstream reader's
comprehension, which is precisely the thing §5.1 says we fail at, and I did not measure it.

*Fix:* **bind the Optional to the Required in the text.** "Do not take §26.3 until O1's fix is in
`sanitizeRemoteData` and its test is green." An Optional that can be mistaken for a Required's
remedy is not non-blocking; it is a trap with a friendly label.

**Score: three non-blocking grades, two defective. Neither defect was a measurement error.** Both
were compressions applied at grading time, which is §4.1's exact claim, now with a fourth instance
and a second leg.

### 32.2 · Broadcast 15 and §6.5: my beads answer was the hop-short one

Broadcast 15 required legs that downgraded on "beads is dead" to check which beads, and §6.1
forbids answering a dependency question with a mention search. My filed answer was:
`beads_import.go` contains zero `RemoteData` references; it is not among the 13 changed files;
and `doc = converted` puts the beads branch on the same sanitisation path as `farmtable`.

**The first clause is the measurement §6.5 names as a hop short, and it is mine.** "This file does
not write `RemoteData`" is not "this path does not reach a write of `RemoteData`." My third clause
gestured at the right hop but stopped at "same path as farmtable" instead of naming which writes
that path performs. Measured now, at `e6bda71`:

| site | enclosing function | reachable from `case "beads":`? |
|---|---|---|
| `convert.go:358` | `taskToProto` (outbound) | no |
| `convert.go:534` | `collectionToProto` (outbound) | no |
| `export_import.go:139` | `ExportCollection` | no |
| **`export_import.go:332`** | **`ImportCollection`** | **YES — same function as the dispatch** |
| `export_import.go:438` | `taskExport` (export side) | no |
| **`export_import.go:743`** | **`importedTask`** | **YES — via `doc = converted`** |

**My downgrade holds** — no finding of mine rested on the beads *package* being live, and the
sanitisation the import path performs is the same sanitisation the farmtable branch gets. But the
population answer is materially different from the mention answer, and §6.1 is right that only the
mention answer is greppable.

### 32.3 · The composition that follows, and it sharpens the round's central finding

Putting §6.5 together with the stale floor I filed:

- Sanitised write sites at `e6bda71`: **six**, measured.
- The shipped diagnostic's floor: **`if sanitized < 4`**, with the parenthetical
  `(convert.go x2, export_import.go x2)` — **false about the tree**, which is export_import.go ×4.
- Slack: **two**.
- Sites reachable from **caller-supplied bytes on the ImportCollection RPC**: **exactly two** —
  `:332` and `:743`.
- The four that remain and satisfy the floor — `convert.go` ×2, `:139`, `:438` — are **exactly the
  four the wire path cannot reach.**

So the floor of 4 is satisfiable by precisely the outbound/export-side sites while **both** sites
that process untrusted inbound beads JSONL lose their sanitiser, silently, in the exonerating
direction. That is §2.3 with the worst possible operand: the count that goes stale quietly is
calibrated exactly to the size of the attacker-reachable write set.

I am **not re-opening** the floor — the EM demoted it to a labelled diagnostic and I accept that,
and my own guard proposal was defective (§30). This is evidence for the remedy already adopted:
**the membership assertion must name `export_import.go:332` and `export_import.go:743`
explicitly.** If membership is filed by name, this entire paragraph becomes unreachable. If it is
filed as any count, it does not.

Neither leg could have composed this. I had the floor arithmetic and stopped at "zero RemoteData
references"; the other leg had the reachability and not the registry. §3.10's post-filing channel
is the mechanism that would have produced it without the EM in the path.

### 32.4 · §4.3: my declaration was incomplete, and my measurement of its incompleteness was also incomplete

§4.3 requires declaration **plus an enumeration of every scheme present**. I filed "68 unmapped
(R-series 39, X-series 29)." Re-measured over the report with fenced and inline code spans masked
(the correct mask for counting IDs — §6.3 notes it is the wrong one for detecting dependencies):

| scheme | count | adjudication |
|---|---|---|
| O-series | 112 | mapped |
| C-series | 104 | mapped |
| R-series | 41 | **unmapped** — run IDs (`R2` = measurement run 2) |
| X-series | 29 | **unmapped** — the diff's own commit findings |
| P-series | 14 | **unmapped — omitted entirely from my declaration** (mutant IDs) |
| M-series | 13 | **unmapped — omitted entirely** (my own miss IDs, §16) |
| B / Q | 4 | borderline; `Q1`/`Q2` are shell probe markers, not report IDs |
| UTF8 | 1 | noise (regex false positive on "UTF-8") |

**Corrected unmapped: ~97 real identifiers across four unmapped schemes**, against the 68 I
declared. I undercounted my own incompleteness by roughly a third, and I did it by **omitting two
entire schemes** — the same failure mode as the declaration it was auditing, committed in the audit
of that declaration. The canonical file's figure of **98** is corroborated to within adjudication
noise; my 68 was the error.

**§3.9 applies to me here in the other direction:** my arrival at 68 was not independent
corroboration of anything. It was a worse re-measurement of a number the file already had right.

### 32.5 · §3.9: my membership "arrival" was rediscovery

Recorded plainly, since §3.9 says the only way to tell redundant from robust arrival is to check
whether the first one was acted on: **the membership assertion is test-xss-r4's, filed first.** My
independent arrival at it added no information. Where I did add something was declining the
scanner relay and finding the stale floor beneath it — and §6.2, my own rule, records that I
declined exactly the relay whose acceptance would have cost me work. I do not get to bank both.

### 32.6 · Restore proof, corrected, all nine channels

Two of my earlier restore claims were wrong; both are corrected here, and §1.5's channel is run
for the first time.

| channel | result |
|---|---|
| HEAD | `e6bda7160b95da96dad3f1b8cddc0e2cc9ac8ab1` |
| `git status --porcelain -uall` | 0 |
| `git diff e6bda71 --stat` | 0 |
| worktrees | 1 |
| `grep -rl REVIEWXSSR4 /workspace` | 0 |
| probe file present | no — removed |
| **`git clean -nxd` (§1.5, ninth channel)** | **3: `web/.tmp-test/`, `web/dist/`, `web/node_modules/`** |
| **empty dirs, no exclusions (§1.4)** | **2** — `web/node_modules/.vite-temp`, `.git/refs/tags` |

**Correction 1:** I twice certified "empty dirs = 0" from a command that excluded `node_modules` —
the §1.4 corollary, committed by me as well. I then corrected it to 1, which was **also wrong**,
because that command excluded `.git`. The true figure with no exclusions is **2**.

**Correction 2:** the ninth channel surfaced `web/.tmp-test/`, a directory I had never seen in any
prior sweep, containing compiled TS output. §1.5 is correct that these are invisible everywhere
else.

**Ownership, by mtime against my earliest artefact (`r1.txt`, 2026-07-29 00:18:32Z):**
`web/.tmp-test` 07-28 23:56:27 (22 min before me), `web/dist` 12:35:33, `web/node_modules` 09:37:40,
`.vite-temp` 12:35:31, `.git/refs/tags` 23:43:01. **All five predate my first write. None are mine.**

**Probe cells left dirty: 0.** No build, suite, container or slot consumed at any point in this
review. Noting for the EM's slot ledger only, without inference: `web/.tmp-test/` is evidence that
*something* produced web build output at 23:56:27Z. It was not this leg.

### 32.7 · Verdict

**Unchanged: REQUEST CHANGES on `6805daa..e6bda71`.** Six Required — O1, O2, O3, O4/C4-2/C4-4,
C5-1, §20.4 — none addressed by anything in §32. §32 adds no new blocking finding; it sharpens the
membership remedy with the site names `:332` and `:743`, restores one deferral alarm I wrongly
deleted, binds §26.3 to O1, and corrects three of my own measurements in the direction that makes
my report weaker.

### 32.8 · One measured data point for §3.8 (remedy-induced incidents, OPEN)

> **!! DIAGNOSIS SUPERSEDED BY §34 — the incident is real, my stated CAUSE was wrong. I attribute
> the empty `rc=` below to `head` truncation; the actual cause is that `${PIPESTATUS[0]}` DOES NOT
> EXIST IN zsh. Text preserved unedited per §3.5. !!**

§3.8 records that the rate at which compliance work generates new incidents is not zero and is not
tracked anywhere. A fresh instance, generated by me, in the act of filing §32:

I sent the §32 summary to the EM through `scion message ... | head -5`, violating the binding rule
that you never pipe a command whose exit code you intend to read. `head` truncated the delivery
confirmation and `rc=` came back empty, so the send was **unconfirmed**. Re-running it correctly
(`> file 2>&1; rc=$?`) returned `rc=0` and `Message delivered` — **and almost certainly delivered
a second copy of a 60-line message.**

The incident is not the pipe. The incident is that **the correct remedy for an unconfirmed side
effect is a re-run, and a re-run of a non-idempotent command is a new side effect.** Reading the
exit code (§6.4) tells you whether the command succeeded; it does not tell you whether an
unconfirmed command already succeeded. For non-idempotent operations those are different
questions, and the rule as written only answers the first.

Cost here: trivial, one duplicate message, self-evidently a duplicate. Logged because §3.8 says
every measurement we have is of errors made *before* the remedies started, and this is one made
*by* a remedy, with the shell transcript to prove it.

---

## §33 · The partition verifies; its keying does not

Filed against the **proposed remedy**, not against the diff. The EM upgraded my "name `:332` and
`:743`" ruling to a directional **partition** — two membership sets, one per direction, each
fail-closed — on the premise that "every one of those six functions is wholly one direction," and
dispatched it into the dev leg's build. That premise is a claim about the **caller graph**, and
nobody had measured it. Measured now, at `e6bda71`.

### 33.1 · The premise holds

| function | non-test callers | direction |
|---|---|---|
| `taskExport` | **one** — `export_import.go:151`, inside `ExportCollection` | outbound |
| `importedTask` | **one** — `export_import.go:365`, inside `ImportCollection` | inbound |
| `taskToProto` (free) | via the `server.go` wrapper, all read-RPC responses | outbound |
| `collectionToProto` | `server.go:952/1016/1068/1101/1107`, all read-RPC responses | outbound |

The decisive check: **`ImportCollection` returns only `{CollectionId, Stats, Warnings}`** — no proto
converter is reachable from the import response, so no outbound function sits on the inbound path.
**The partition is sound. It should be adopted.**

### 33.2 · But `taskToProto` is not a unique key — and the collision is pre-installed in the worst place

The registry is **function-name-keyed**. There are **two** functions named `taskToProto` in package
`server`:

```
convert.go:256   func taskToProto(t *ent.Task) *pb.Task           <- HOLDS the sanitised write :358
server.go:2193   func (s *FarmTableService) taskToProto(ctx, t)   <- wrapper; RemoteData ABSENT
```

Name-keying was chosen to defeat **within-file compensating substitution**. A duplicate name
reintroduces that exact failure one level up, at the name.

And this collision is the worst one available, because **the wrapper is the enrichment seam**:

```go
proto := taskToProto(t)
if computer, ok := s.store.(availabilityComputer); ok {
    ... proto.Availability = availabilityToProto(availability)
}
return proto
```

It takes `ctx` and `s.store`, and **it already mutates the proto after conversion**. That is, by
convention, where context- and store-dependent field population lands. The day someone sets
`proto.RemoteData` there, the write leaves the audited function, reappears in an unaudited one
**under the same registry key**, and a name-keyed membership set stays green through the move. All
twelve production call sites go through the wrapper, not the free function.

**That is a latent mirror, pre-installed, in the outbound half of a partition built to prevent
exactly this.**

*Fix, cheap:* key on **`file:function`**, not `function`. `convert.go:taskToProto` and
`server.go:(*FarmTableService).taskToProto` are distinct; bare `taskToProto` is not. I checked all
four declarations, not only the two I suspected: the other three names are unique tree-wide, so no
other entry is affected. This costs a key format, not a redesign.

### 33.3 · The EM's "it was never a floor" reading, re-derived

It holds, and it is stronger than what I filed. The parenthetical enumerates `convert.go x2 +
export_import.go x2 = 4` — **the author's own accounting of the total population**. The margin is
therefore zero by their own arithmetic, so the slack of two is an **artefact of a miscount, not a
chosen margin**. The word "floor" is what let a wrong exact count survive contact and what made it
unfalsifiable. My §32.3 framing understated this; the EM's is correct.

### 33.4 · A note on the near-miss in my own measurement

> **!! MECHANISM SUPERSEDED BY §34. The `rc=1` was the trailing `grep -v` reporting no matches, not
> `git grep` failing — `$?` after a pipeline is the LAST stage's status. Conclusion unchanged; the
> stated mechanism was imprecise. Preserved per §3.5. !!**

My first caller enumeration used a malformed filter — `grep -v "^internal/server/$(echo)"`, which
excludes every line in the package — and returned `rc=1` for all four functions. Read naively that
is "no callers," which would have *confirmed* the partition premise by finding nothing. **The
refusal-as-zero shape of §6.4, pointing at the answer I was already expecting.** Caught only because
rc-reading is habitual and four identical empty results were implausible. Logged because §6.4 says
every other refusal tonight was found in a transcript afterwards; this one was found in the second
before it became a finding.

---

## §34 · The exit-code guard was unarmed in this shell, and it never fired once tonight

Broadcast 16 Item 1. Measured directly rather than reasoned about, with **positive controls**,
because the Broadcast's own point is that this fleet has been treating installation as proof.

```
shell: /bin/zsh   ZSH_VERSION=5.9   BASH_VERSION=(empty)

true      | cat  ->  PIPESTATUS[0]=[]   pipestatus[1]=[0]    $?=[0]
false     | cat  ->  PIPESTATUS[0]=[]   pipestatus[1]=[1]    $?=[0]
(exit 42) | cat  ->  PIPESTATUS[0]=[]   pipestatus[1]=[42]   $?=[0]
```

**The digit: 42.** `$pipestatus[1]` is correct, 1-indexed, and fires. `${PIPESTATUS[0]}` is empty in
**all three** cases — including when the left-hand command exits 42.

### 34.1 · My §32.8 diagnosis was wrong, and wrong in the flattering direction

§32.8 says `head` truncated the delivery confirmation and *therefore* `rc=` came back empty. Two
facts, one causal claim, and the causal claim is false. `head` did truncate the output, but the
empty `rc=` had **an entirely independent cause**: the variable does not exist in zsh. **Had `head`
printed the full confirmation, the guard would still have rendered `rc=`.**

That matters because of which error each explanation implies. My version was a *reading* failure —
I piped away information I needed. The truth is an *instrument* failure — the control I installed
to prevent exactly this class was never armed. **I filed the incident under the axis that made it
my carelessness rather than my broken tool, and §0.1 says only one of those two axes has ever
produced a remedy that works.** I got the axis backwards on the single datum §3.8 has.

### 34.2 · The failure renders as a self-certifying artefact — measured on myself

Broadcast 16 names the class and my transcript is the specimen. The guard emitted:

```
rc=
```

Not a blank line. Not an error. **A string whose shape announces that an exit code was reported.**
`rc=` and `rc=0` differ by one character in the position a reader's eye is least drawn to — the end
of a line that has already delivered its signal by existing. I read `rc=` and concluded "unconfirmed
because `head` ate it," which is a *reasonable* reading of a string that should never have been
produced. This is the same family as the self-certifying comment: prose carrying the evidence for
its own correctness, and thereby the reason nobody checks underneath it.

### 34.3 · The broader form, which is not about `PIPESTATUS` at all

`$?` after a pipeline is **the last stage's status**, measured at 0 above while the left side exited
42. So every idiom of the shape

```
cmd | filter ;  rc=$?          # rc is filter's status. Reads 0 essentially always.
```

is a guard that reads success unconditionally. This is wider than the `PIPESTATUS`/`pipestatus`
spelling: a leg that avoided `PIPESTATUS` entirely and wrote `| head; rc=$?` has the same unarmed
control, and its output contains a **digit**, so it survives the "confirm it prints a digit" check
that catches my version. **The check Broadcast 16 mandates does not detect the more common variant.**

*Recommended addition to the Item 1 check, since a digit is not sufficient:* run the positive
control — `(exit 42) | cat` — and require the guard to print **42**. A guard that prints `0` there
is unarmed and looks perfect.

### 34.4 · Corrected accounting for §33.4

The four `rc=1` results from my malformed caller enumeration were the trailing `grep -v` reporting
no matches, not `git grep` failing. Conclusion in §33.4 stands unchanged — it was not "no callers" —
but the mechanism I named was wrong for the same reason as §32.8: I read `$?` after a pipeline as
the status of the command I cared about.

**Net for §3.8's ledger: one incident, not two, and its axis flips from investigator to
instrument.** My remedy-induced duplicate was caused by a control that had never once been observed
firing, in a report that had already quoted the rule about controls that decorate rather than fail.

---

## §35 · Broadcast 17: the reconciliation instrument under-reports, and I proved it on myself twice

### 35.1 · Item 1 amended — the nonzero digit

**42**, from `(exit 42) | cat` via `$pipestatus[1]`; also `1` from `false | cat`. Matrix in §34.

The EM's amendment — a guard that has only printed `0` has been *observed agreeing*, not observed
firing — is correct, and it leaves one hole. In all three rows of §34's matrix, **`$?` reads 0**. A
leg that never touched `PIPESTATUS` and simply wrote `cmd | filter; rc=$?` holds a guard that
prints a digit, prints `0` unconditionally, and therefore satisfies both the original check and the
amended one unless that leg independently thought to fail the left-hand side. **The spelling of the
array is not the defect. Reading `$?` after a pipeline is.**

### 35.2 · Item 3 amended — three columns

| column | value |
|---|---|
| **HELD** | **2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 — sixteen, contiguous** |
| **ABSENT** | none |
| **UNKNOWN** | **B1 only, and it is an identity question, not a delivery one** |

I hold an *unnumbered* `=== BROADCAST TO ALL LIVE LEGS` at 00:56:20Z; numbering in my stream begins
at B2, 01:00:03Z. Either that is B1 and it predates numbering, or a distinct B1 exists that never
arrived. Those are not distinguishable from inside my transcript and I am not guessing between them.

**I hold B13** — `"BROADCAST 13 — CORRECTION TO BROADCAST 12 ITEM 8. ACT ON THIS IMMEDIATELY"`,
02:05:49Z — which is consistent with the EM's retraction in B17.

### 35.3 · The finding: two of my three scans were confidently wrong, in the deflation direction

| scan | method | result |
|---|---|---|
| 1 | JSON walk that silently dropped 200 of 218 messages | HELD = `[12, 14, 16]` |
| 2 | filtered on line `type == "user"` | HELD = `[2, 6, 12, 14, 16]` |
| 3 | **all line types** | **HELD = 2..17** |

**Cause: mid-turn-injected messages are not stored as `type=="user"`.** Mine were carried in
`queue-operation`, `attachment` and `last-prompt` records — and **B11, B13 and B15 all arrived that
way**, so the naive scan omits exactly the three broadcasts whose delivery was in question.

Two failure modes stacked, and both are ones this report has already named in someone else's work:

- Scan 1 was a **silent partial read** — the extractor returned empty text for tool-result blocks
  and my loop `continue`d past them. No error, no warning, a plausible-looking answer. §1.1: it
  decorated the command instead of failing it.
- Scan 2 was **§1.4 exactly** — I searched one path (`type=="user"`) and reported a property of the
  whole transcript. I wrote the §1.4 correction into my own restore proof forty minutes earlier.

**The consequence is fleet-wide, not local.** Any leg answering Item 3 by grepping its transcript
with an obvious filter will under-report, and will under-report *precisely the mid-turn broadcasts*.
Every `ABSENT` returned tonight should be treated as `UNKNOWN` unless the leg states which line
types it scanned. This is the EM's own deflation asymmetry with a mechanism attached: **the wrong
answer is the one that arrives first, looks clean, and reduces everyone's work.**

### 35.4 · What this costs my earlier self-assessment

§34.4 settled §3.8's ledger at "one incident, axis flipped to instrument." That stands, but §35.3
adds two more of mine tonight — both instrument-class, both caught before filing, both in
measurements I built to audit somebody else's completeness. **~~Three of my last four measurement
errors have been incomplete population scans that returned confident, low answers.~~** That is a
pattern in me, not four coincidences, and it is the same shape as the stale floor I filed as this
round's central finding: a count taken over a population smaller than the one the claim ranges over.

> **!! THE STRUCK COUNT IS UNMEASURED AND WRONG — SEE §38. The pattern claim is correct and was
> measured; the numbers "three" and "four" were never derived, and the true figure is FIVE, not
> three, over an undefined window. Preserved per §3.5. !!**

---

## §36 · B18 close-out: my §34 matrix verified, and the clobbering has a worse rendering

Broadcast 18 requests no reply and retires Items 1 and 3. Recorded here rather than sent, because
the EM's closing finding is that it manufactured an hour of fleet work and I am not going to add to
it over a channel it just asked to quiet.

**One thing in B18 could have invalidated evidence I already filed**, so I checked it: audit-xss-r4's
finding that `$pipestatus` is clobbered by the command that reports it. My §34 matrix is built on
that array.

```
A. TWO-COMMAND READ
   (exit 42) | cat
   echo elem1        -> 42
   echo elem2, elem1 -> elem2=[]   elem1-again=[0]

B. MY §34 IDIOM — one command, all reads in a single expansion
   (exit 42) | cat; echo "...$pipestatus[1] ... $pipestatus[2] ... $?"
                     -> pipestatus[1]=42   pipestatus[2]=0   $?=0

C. SNAPSHOT IDIOM (B18's recommendation)
   (exit 42) | cat; ps=("${pipestatus[@]}")
                     -> ps[1]=42  ps[2]=0  count=2
```

**§34's matrix stands.** It read every element inside one command, so the array had not yet been
reset. The idiom was safe by luck of construction rather than by design, and I record that
distinction rather than claiming foresight.

### 36.1 · The clobbering has two renderings and the fleet has the safer one on file

audit-xss-r4 reported the failure as *element 2 prints empty*. Row A shows a second rendering:
**re-reading element 1 after the array is clobbered returns `0`.**

That is the more dangerous of the two, and by exactly the mechanism §34.2 already named:

- `elem2=[]` renders as `rc=` — **a self-certifying artefact**, visibly odd, and the shape that made
  me investigate in the first place.
- `elem1-again=[0]` renders as `rc=0` — **indistinguishable from a passing guard.** Nothing about it
  invites a second look. It is the "guard wired to a constant zero" B18 describes, produced
  accidentally, by a correct guard read one command too late.

So the guidance "snapshot the array" is right, and the reason is stronger than the reported one: the
failure does not merely lose the second element, **it fabricates a success value for the first.**
A leg that adopted the two-command read after B16 now has a guard that reports `0` on a pipeline
that exited 42.

### 36.2 · Where this leaves my own record

No correction is owed to §34 or §35; both measurements verify. §34.2's analysis of `rc=` as a
self-certifying artefact turns out to describe the *less* harmful half of the defect, and §36.1
supplies the other half. This is the fourth time tonight my axis — whether the code and the record
say true things about themselves — has resolved to the same finding: **the dangerous artefact is not
the one that looks wrong, it is the one that looks ordinary.** The stale floor said `at least 4` and
looked like a margin. `rc=0` looks like a pass. `sanitizeRemoteData` looks like it sanitises
`map[string]string`. None of them announced anything.

**Verdict unchanged and final: REQUEST CHANGES on `6805daa..e6bda71`.** Six Required — O1, O2, O3,
O4/C4-2/C4-4, C5-1, §20.4 — plus §33's registry-keying defect against the proposed remedy.

---

## §37 · B19: the fail-closed guard fails open on the defect it ships beside

Broadcast 19 retracts B18's "there was no loss" and closes by instructing legs to read *"no reply is
requested"* from the EM with suspicion. Taking that literally, I examined the one thing in B19 that
is a **control** rather than a finding — the guard form recommended fleet-wide in §4 — because this
round's signature failure is controls that have never been observed firing.

### 37.1 · Measured, with a positive control

```
1. CLEAN USE
   (exit 42)|cat ; rc=${pipestatus[1]:-${PIPESTATUS[0]}} ; echo "EXIT=${rc:-MISSING}"
   -> EXIT=42                              CORRECT

2. WITH A COMMAND INTERLEAVED — the clobber §4 is about
   (exit 42)|cat ; echo "...output..." ; rc=${pipestatus[1]:-...} ; echo "EXIT=${rc:-MISSING}"
   -> EXIT=0        A CLEAN, PLAUSIBLE PASS ON A PIPELINE THAT EXITED 42

3. Can :-MISSING fire after a pipeline?  NO. pipestatus[1] is always set, and after a
   clobber it is set to 0, not empty. rc is never null; the branch is unreachable.

4. Assignment does not clobber, independently confirmed:  a=7  b=7
```

### 37.2 · The reason it fails, and it is §36.1 one level up

`${rc:-MISSING}` detects the variable being **absent**. The clobber does not make it absent — **it
makes it `0`**. The detector is therefore aimed at the one rendering that *cannot occur* in the case
that matters.

This is exactly the asymmetry §36.1 established: `rc=` is visibly broken and invites a second look;
`EXIT=0` is invisibly broken and invites none. **The guard catches only the harmless rendering.**

So the form is correctly labelled fail-closed for the **portability** failure (wrong array name for
the shell) and is **not** fail-closed for the **clobber** failure. Placed in §4 directly beneath the
clobber discussion, it will be read as covering both.

**A form that is safe only when accompanied by a discipline is not a control; it is a discipline
with a helper.** That is the investigator axis, and §0.2 records that the investigator axis has
scored zero all night. B19's *prose* rule — "capture before you print, never interleave a command" —
is the sound part, and it does not need the form. If a genuinely fail-closed artefact is wanted:
snapshot on the pipeline's own line, `ps=("${pipestatus[@]}")`, and treat a count of zero as
`MISSING`, which is a condition that can actually arise.

### 37.3 · UNKNOWN = {1}: I hold a candidate, not a void

Three legs converge on `UNKNOWN = {1}`. My residue is not an absence: I hold an **unnumbered**
`=== BROADCAST TO ALL LIVE LEGS — A MUTATION THAT FAILED TO APPLY IS INDISTINGUISHABLE FROM A MUTANT
THAT SURVIVED` at **00:56:20Z**, immediately preceding B2 at 01:00:03Z. A broadcast in form, in
position and in address, lacking only a number. The economical reading is that numbering began at
B2 and **there is no B1 to lose**. Filed as evidence, not as a resolution.

### 37.4 · Closing note on my own axis

Four times tonight this review has resolved to one sentence, and §37 is the fourth: **the dangerous
artefact is the one that looks ordinary.** `expected at least 4` looked like a chosen margin and was
a miscount. `rc=0` looks like a pass and is a clobbered array. `EXIT=0` looks like a fail-closed
guard reporting success and is a fail-closed guard failing open. `sanitizeRemoteData` looks like it
sanitises `map[string]string` and does not — which is O1, this round's blocking finding, and the
same shape as all three.

**Verdict unchanged and final: REQUEST CHANGES on `6805daa..e6bda71`.** Six Required — O1, O2, O3,
O4/C4-2/C4-4, C5-1, §20.4 — plus §33's registry name-collision filed against the proposed remedy.

---

## §38 · B20 §6 applied to my own self-corrections — one of them was not measured

Broadcast 20 §6: *"whatever the reward points at, the cheap imitation of it appears within the hour,
and it is always the version that skips the measurement,"* and its corollary, *"mark the clause, not
the sentence,"* because an evidence mark on a compound claim **launders one measured clause into
cover for an unmeasured one.**

I have filed a great deal of self-correction tonight, and the EM has been quoting my generalisations
into the standing-rules file. So the correct final act of this review is to audit my
self-corrections the way §4 made me audit my grades. **One fails.**

### 38.1 · The audit

| self-correction | measured? |
|---|---|
| §32.1(a) C6-1's struck escalation trigger | yes — quoted from the file at L1006 |
| §32.1(c) §26.3 conditional on an unmeasured reader | yes — read L2233 in context |
| §32.4 "68 → ~97 unmapped identifiers" | yes — re-ran the census, adjudicated each series |
| §34.1 my §32.8 causal diagnosis was wrong | yes — ran the zsh matrix with positive controls |
| §35.3 two of three transcript scans wrong | yes — ran all three, reported all three outputs |
| §36 my §34 idiom verified against the clobber | yes — ran A/B/C |
| **§35.4 "three of my last four measurement errors…"** | **NO. NEVER DERIVED.** |

### 38.2 · The failure, and it is B20 §6's corollary exactly

§35.4 is a compound claim:

- **Clause 1 — the pattern:** *my recent measurement errors are incomplete population scans
  returning confident, low answers.* **True, and measured.** Every instance is in this report.
- **Clause 2 — the count:** *"three of my last four."* **Never derived.** I did not enumerate the
  population, and "last four" names no window I ever defined.

Clause 1's evidence carried clause 2 across without clause 2 being checked. The measured clause
laundered the unmeasured one, in a self-critical passage — **which is the most credible place in any
report to hide an underived number, because self-criticism is the one claim a reader does not
adversarially test.**

### 38.3 · The derived figure, and it runs against me

Enumerating incomplete-population-scan errors I made tonight:

1. empty dirs **"= 0"** — command excluded `node_modules`
2. empty dirs **"= 1"** — corrected command excluded `.git`
3. **"68 unmapped identifiers"** — omitted the P- and M-series entirely
4. transcript **scan 1** — extractor silently dropped 200 of 218 messages
5. transcript **scan 2** — filtered on `type=="user"`, dropped every mid-turn record
6. *(arguably)* the ID census masking code spans, which read `beads outside code spans: 0`

**Five, firmly; six on a generous reading. Not three.** And the window "last four" excluded items 1
and 2, which are the same error committed twice in succession.

So my unmeasured self-criticism was **too lenient by roughly half**. That is the non-obvious part
and the reason it is worth filing: the cheap imitation of rigour does not only overstate a virtue,
**it can understate a fault, because a number invented to sound rigorous is optimised for sounding
rigorous and not for being large.** A reader auditing me for self-flattery would have checked
whether the confession was too soft in tone. It was not. It was too soft in arithmetic.

### 38.4 · What I am asking be corrected downstream

If §35.4 has been quoted anywhere, the count is wrong and the pattern is right. The generalisation
the EM adopted from §37 — *a form that is safe only when accompanied by a discipline is not a
control; it is a discipline with a helper* — was measured and stands. **§35.4's number was not, and
should not travel.**

**Verdict unchanged and final: REQUEST CHANGES on `6805daa..e6bda71`.** Six Required — O1, O2, O3,
O4/C4-2/C4-4, C5-1, §20.4 — plus §33's registry name-collision against the proposed remedy.
