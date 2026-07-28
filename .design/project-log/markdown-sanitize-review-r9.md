# markdown-sanitize round 9 — independent code review of #195

Branch `markdown-sanitize-r9` @ `13680c2`. Reviewer leg, independent of the developer and
of the audit legs. Verdict: **REQUEST CHANGES** (two Required, four non-blocking).

Full report with every mutation table:
`/scion-volumes/scratchpad/projects/farmtable/reports/review-195-r9.md`.

Gates reproduced from the child process: `npm test` 0 at **79 checks / 127 assertions**,
`tsc --noEmit` 0, `npm run build` 0, tree clean before and after every experiment.
`markdown.ts` verified **comment-only at line granularity**. No fixture table shrank
(13 → 17 guarded, no pinned size reduced). No CI exists on this project.

## The fix is real

Seven adversarial declaration shapes of the reviewer's own — an interpolated string-literal
type, a nested template type, an escaped backtick, `` `${string})` ``, `` Uppercase<`)`> ``,
a comment carrying a paren — are all caught by `renderMarkdownArityViolation`. All five
shared call sites of `literalBlindView` are individually load-bearing at HEAD, each with
distinct attribution. The `${…}`-preserving design does not leak a structural paren, because
a paren reachable inside a type-position interpolation must arrive through a string-literal
type, which `strings: true` blanks.

## Required 1 — the round's own structural decision has no coverage at any of its five sites

"Decide over the blinded view, report from the raw view" is pinned by nothing. Five
mutations, all **GREEN at 79/127**:

- `markdown.test.ts:2045` `balancedDeclarationParameterLists` pushing `scan.slice(…)`
- `:1969` `splitTopLevelParameters` accumulating `scan[i]`
- `:2285` `callArguments` slicing from `scan`
- `:2379`, `:2380` `sinkArgumentIsSanitized`'s two arms reading `scan`

The first is the finding. `balancedDeclarationParameterLists` handing RAW text downward is
the only thing that makes `splitTopLevelParameters`' and `hasTopLevelDefault`'s own blinding
observable — and combining that one-word change with either of them is GREEN, silently
restoring the exact caller-masking `e3002b9` was written to remove. **The class fix acquired
a new single masking point in the same commit that removed the old one.**

Two of the five carry rationales measured false with the file's own helper: quote delimiters
and backticks *survive* blinding, so neither `renderMarkdown(x, 'y')` nor a trailing
`` `junk` `` reads as empty on the blinded view. The only construct that blinds to pure
whitespace is a comment.

## Required 2 — the retracted ordering rationale is still in the file, twice over

`c331abf` added, at `run()`, "either one running earlier would contaminate every rendering
check after it." `4341965` measured that false and corrected the *section header* only.
Measured this session: moving `privateDOMPurifyInstance()` to the top of `run()` is GREEN
79/127 (confirming the developer), and moving `sharedMarkedSingleton()` to the top is **also
GREEN 79/127** (new — the marked half was never re-measured by anyone).

An instance fix of a two-instance class, shipped in the round whose thesis is "fix the
class," one commit after the class was identified.

## Non-blocking

- The commit that fixed a self-counting fixture-table recipe added a second occurrence of
  the grepped string while describing the first: the naive recipe was off by one at
  `469694a` and is off by **two** at HEAD, where the comment still says "off by one."
- `code` names the strings-BLANKED view in `sinkBindingViolations` and the strings-KEPT view
  in the `scanned` map; the new T-8 comment compares them by that name.
- The "three of five call sites had no unique coverage" finding undercounts itself. Measured
  at `affa615`: **five of five**. The two sink-side sites were covered later, by `6103b9a`'s
  `SINK_CALL_LEGITIMATE`, not by removing the caller pre-blinding.
- C7-p is recorded as fixture-only because it fails `tsc` when planted in `markdown.ts`.
  Measured: **C7-m fails identically** and is not so recorded.

## The reviewer's own errors, recorded

Two of nine predictions were wrong, both in the same direction: believing a docblock's
account of what a line is for. M4 was predicted GREEN and is RED (`SINK_CALL_LEGITIMATE`
covers it). M12 was predicted RED and is GREEN (`callArguments` slicing from the original is
load-bearing for the failure *message*, not for classification, contrary to its docblock).

## Standing lesson for round 10

A shared helper does not make a fix a class fix. What makes it one is that **each consumer's
use of it is separately falsifiable**, and that is a property of the data handed *between*
consumers, not of the helper. Round 9 fixed one caller that was doing its callees' work and
created another in the same function. The general form: after removing a masking ancestor,
mutate the *return value* of every function in the chain, not just the parameters.
