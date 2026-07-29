# audit-xss-r3 — security audit, `url-scheme-validation-r2` @ `6805daa`

Read `_xss-r3-baseline-block.md` in this directory **first, in full**, and do its
§0 open pass before you read the item list below.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r3.md`.

Verdict: findings with severity (Critical / High / Medium / Low / Info) and an
overall **APPROVE** or **REQUEST CHANGES** on the diff `0bc9b72..6805daa`. If you
approve the diff while holding an open concern outside its scope, say both,
clearly and separately — an auditor did exactly that on an earlier round here and
it was the right call.

## Your axis

Threat modelling and exploitability. Mutation adequacy is the test leg's axis;
correctness and architecture the review leg's. Label anything outside your lane
an impression, and still say it.

## The vulnerability this branch exists to close

Stored `javascript:` XSS: an attacker-controlled URL arriving from GitHub
passthrough data reaches an `href` in the Lit dashboard and executes on click.
The branch adds a scheme guard (`safeHref`), a static scanner that requires URL
bindings to go through it, and server-side scrubbing of URL carriers.

Round 2 sent it back with a HIGH from you-the-role: the typed field was scrubbed
but a **second carrier** (`html_url` inside `remote_data`) was not. Round 3 is
the fix.

---

## The items

### A1 — reachability of the carrier that was fixed

The fix leg reports a discovery in none of the r2 reports:

> `remote_data` is silently `nil` on the entire GitHub passthrough path.
> `issueBuildRemoteData` writes `"labels": []string{...}`; `structpb.NewStruct`
> rejects `[]string`; and `convert.go` discards the error with `_`. So the whole
> map vanishes.

**Confirm or refute this independently.** Then answer what it implies:

- **Was the r2 HIGH live, or latent?** If the map never serialises on that path,
  the `html_url` carrier could not reach a client through it. That does not make
  the finding wrong — a latent leak that becomes live the moment someone fixes a
  `[]string` is a real finding — but it changes the severity story, and the
  severity story is yours to set.
- **Which paths DO populate `remote_data` on the wire?** Enumerate them. Do not
  grep for the ones named here. A round on this branch surfaced three carriers
  nobody had thought to look for by enumerating every attribute on rendered
  output rather than grepping for expected ones; the analogue is enumerating
  every path by which server-held data reaches a rendered URL context.
- The `[]string` bug is *not fixed* — the leg pinned the `nil` instead, so a
  future fix is met by a red test. Is that pin actually load-bearing, and does
  the branch merge in a state where fixing the data-loss bug **re-opens** the
  leak if the pin is deleted along with it?

### A2 — DELIVERY versus CONSUMPTION: does anything run this guard?

This project has a named failure form: **a check can pin delivery without pinning
consumption.** It has already bitten this exact branch — the XSS chokepoint
scanner was found to be a guard that nothing ran.

Commit `d92ae5e` is about making the runner *find* and *honour* test files.
**But nothing in this repository runs `npm test`.** There is no CI. That is a
known, tracked, escalated item and you should not re-derive it.

What is **in scope**, and what I want from you:

- Trace, concretely, the path from "a contributor makes a change that defeats
  `safeHref`" to "somebody is told." Name every link. Where does the chain break
  today?
- Is `d92ae5e` a real improvement to that chain, or an improvement to a link in
  a chain that is already severed upstream? Both answers are legitimate; I want
  the measured one.
- The production container build runs `npm run build`. Does it run anything
  else? Does `npm run build` transitively invoke any part of this guard? If a
  guard runs anywhere in the release path, that is the most valuable single fact
  you can return this round.

### A3 — the scheme policy itself, probed rather than reasoned about

`b06121f` claims `javascript://evil.com/%0aalert(1)` and `data://evil.com/x` are
now rejection fixtures, and that all five named schemes yield a non-empty
hostname in the authority form.

Confirm those against the **shipped** `safeHref`, then probe the neighbourhood.
Shapes worth trying — this list is a starting point and is certainly incomplete:

- Case and whitespace: `JavaScript:`, ` javascript:`, `\tjava\tscript:`,
  leading/embedded C0 controls, `\r\n` inside the scheme.
- `javascript` reached by encoding: `&#x6a;avascript:`, `%6a`-style, and any form
  that survives whatever parse happens between the value and the DOM.
- `data:` variants: `data:text/html;base64,…`, `data:image/svg+xml,…` — SVG is a
  script context.
- `blob:`, `filesystem:`, `about:`, `vbscript:`, `view-source:`, `intent:`,
  `file:`.
- Protocol-relative `//evil.com` and the backslash confusions
  (`\\evil.com`, `/\evil.com`).
- Whatever the URL parser in the *browser* does that JSDOM does not.

**The last one matters most.** The guard is measured with JSDOM. The exploit runs
in a browser. State plainly where your evidence comes from and where JSDOM's
parse could diverge from a real one. Do not claim browser behaviour you have not
observed.

### A4 — is the scrub fail-closed, and is a key-name predicate the right guard?

`sanitizeRemoteData` drops URL-bearing keys failing validation, and URL-bearing
keys whose value is not a string. The predicate matches key **segments** against
a word set (`url`, `uri`, `href`, `link`, `permalink`, plurals) plus an all-caps
fallback.

- The guard keys off the **name**. The threat is in the **value**. Construct the
  gap: a key whose name does not match the word set but whose value is an
  attacker-controlled URL that reaches a rendered URL context. GitHub's own API
  vocabulary is a good source of candidates.
- Conversely: a key that matches the predicate but whose value is not a URL —
  what gets destroyed? Is there a data-integrity or availability consequence to
  over-matching?
- Does it fail **closed** on the paths that matter: unknown key, nested map,
  array of strings, `nil` value, a value that is a valid URL of a scheme the
  dashboard renders differently?
- The server-side scrub and the client-side `safeHref` are two guards on one
  threat. **Do they agree on what is safe?** If the server drops something the
  client would have rendered safely, that is a bug; if the server passes
  something the client rejects, the client is load-bearing alone. Characterise
  the disagreement rather than assuming it is empty.

### A5 — the scanner as a security control

The static scanner is now the mechanism by which "all URL bindings go through
`safeHref`" is enforced. Treat it as a control and attack it.

- The two confirmed fail-opens (defeated RHS guard, laundering sibling) are
  fixed. **Find the third.** Assume one exists.
- The `blankNonCode` pre-pass rewrites the source before scanning. Anything that
  makes the blanker mis-identify a region makes the scanner mis-identify code.
  Template literals in a Lit codebase are the obvious pressure point; regex
  literals and nested backticks are the next.
- The witness-path + file-count anti-vacuity check replaces a check the leg
  measured as satisfiable by a walk that reads only the three files it had
  already decided were fine. Is the *new* check attackable — a walk that hits
  the witnesses and the count while missing the code that matters?
- **Who can change the allow-list?** A scanner with an allow-list is a control
  whose bypass is a one-line diff. Is that visible in review?

### A6 — the seam

After this branch and the markdown-sanitize branch both merge, this codebase
will hold **three** URL scheme policies, and the only in-tree statement of policy
describes two. That merge seam is tracked and is **not yours to fix**.

What is yours: **does this diff make the seam better or worse?** `b06121f`
rewrites the README and the `safe-url.ts` docblock — do the new sentences
describe a policy that will still be true after the merge, or has this round
written a confident, correct-today statement that becomes a false comment at
merge time? On this project a false comment is treated as the raw material for
the next round's defect, and a comment that goes false *on a scheduled event* is
the worst kind.

---

## Deliverables

1. §0 open pass, written first.
2. Findings with severity, attributed **OPEN PASS / ITEM LIST / BOTH**, with
   file:line resolved against your own tree.
3. An explicit verdict on each of A1–A6, **including where you agree, stated at
   equal weight.** A confirmed green control is a result, not an absence of one.
4. Your determination on A1: was the r2 HIGH live or latent, and what is the
   severity now?
5. Your answer to A2: the concrete chain from "guard defeated" to "somebody is
   told," with the break named.
6. A numbered list of everywhere this brief is wrong (§5 of the baseline block).
7. Overall APPROVE / REQUEST CHANGES on the diff.
8. Dirty cells at the end, with `git status --porcelain` shown empty.

Do not push. Do not modify production code. You MUST write the report file and
then mark the task complete.
