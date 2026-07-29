# audit-xss-r2 — security audit, url-scheme-validation-r2 @ 0bc9b72

Read `_xss-r2-baseline-block.md` in this directory first, in full. It is your tree, gates and rules.

Write your report to
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-xss-r2.md`.

## What this branch is for

It closes a stored `javascript:` XSS: attacker-controlled `pull_requests[].url` rendered into an
`href` in the Lit dashboard. Round 1 reviewed the first attempt; `dev-xss-r2` is the fix round, 10
commits, `d4c4e6b..0bc9b72`. Read `reports/dev-xss-r2.md` and the three round-1 reports — as claims
to check, not as a record of what is true.

Verdict: findings with severity (Critical / High / Medium / Low / Info), and an overall
APPROVE or REQUEST CHANGES **on the diff**. If you approve a diff while holding an open concern that
is out of the diff's scope, say both clearly and separately — a previous auditor did exactly that
and it was the right call.

## Your axis

Threat modelling and exploitability. **The mutation work is the test leg's axis; correctness and
architecture are the review leg's.** Stay in your lane and label anything outside it as an
impression rather than a finding.

## The specific claims I want independently checked

These are the fix leg's own security conclusions. It reasoned carefully and I have no reason to
doubt it — which is exactly why they should be checked by someone who did not write them.

**1. "None of the 9 divergences is a scheme escalation."** The leg built a shared fixture file
(`web/testdata/url-scheme-cases.json`) driving both the Go validator (`validateURLField`) and the TS
validator (`safeHref`) off one table, and measured 42 inputs: **33 agree, 9 diverge.** Its security
reading, which it correctly stated separately from the measurement:

> Where the client is the more permissive of the two, the input resolves to an http(s) URL — an
> attacker-chosen **host**, which is already reachable through a plainly-accepted
> `https://evil.com/`, not an attacker-chosen **scheme**. Broken-link and inconsistency bugs, not XSS.

The divergences include `http:/\/\evil.com`, `http:/example.com`, `http:example.com`,
`https:///x` (WHATWG promotes the first path segment to `hostname === "x"`), and one where the
**server** is the more permissive of the two: `https://example.com:99999/x` (accepted server-side;
`net/url` does not range-check the port).

Is the "attacker-chosen host, not scheme" reading correct for **all nine**? The one that most
interests me is the direction where the *server* accepts and the client rejects, because the leg's
framing is built around the opposite direction, and a policy that is written down as symmetric but
measured asymmetric is where I would expect a surprise to live.

**2. "Not attacker-reachable today"** — the `remote_url` read-path validation in
`convert.go::taskToProto`. The leg says `issue.URL` is GitHub-generated, there is no webhook
receiver and no configurable API base URL, so this is a missing control rather than an open hole,
and it declined to write it up as exploitable. Check the three legs of that: no webhook receiver, no
configurable API base URL, `issue.URL` genuinely GitHub-generated on every path that reaches
`taskToProto`.

**3. `pr["url"]` at `convert.go:358-363` was deliberately NOT given the same treatment.** Stated
reason: it has a real guarded write boundary and no passthrough synthesis, so its only bad values
are legacy rows, and a silent server-side drop would make those rows *vanish* from the UI instead of
degrading to visible inert text. Is `safeHref` genuinely a sufficient control for legacy rows, on
every path a legacy `pr["url"]` can reach the DOM?

**4. The chokepoint scanner's recall.** The scanner exists to stop this defect class returning. The
leg measured that three shapes reached an `href` without it firing — `html\`<a href="${raw}">\``
(quoted binding), `el.setAttribute('href', raw)`, and `use.setAttributeNS(XLINK, 'xlink:href', raw)`
— and added two rules plus 7 positive and 4 negative fixtures. It also re-scoped `viaSafeHref` from
**file**-scoped (satisfied by a file that guards one binding and leaves the next bare) to
**binding**-scoped.

This is an **open set** and the fix is a checklist over it, so I expect it to be incomplete —
finding the fourth and fifth shapes is a genuinely useful result. More useful still: is there a
formulation that makes the bad state unrepresentable rather than detected? That is the question I
would most like answered on this branch.

## Scope fence

**In scope:** everything in `d4c4e6b..0bc9b72`, plus the security properties of the code it touches.

**Out of scope, do not file:** the `#195` markdown-sanitize branch and `unsafeHTML(renderMarkdown(...))`
(tracked separately, and a round-1 auditor's finding there has already been routed); CSP (#85/#91);
`web/dist` missing on a clean checkout (#100); the 4 `go vet` copylocks; the five auth/CORS/scope
findings from other tracks.

I am giving you a short fence rather than a long one deliberately. A leg correctly pointed out that
a long out-of-scope list and the instruction "do not scope around what you assume others cover" pull
against each other. **If you find something outside that fence, surface it — do not assume it is
someone else's.** The fence exists so you do not spend your round re-deriving known items, not so
that findings die at its edge.

## Method notes

- **A control catching your own error is a result worth reporting.** Last round an auditor's first
  Chromium run reported all six payloads NOT_EXECUTED — *and so did its positive control*, because a
  literal `</script>` in the payload terminated the page's inline script. It discarded the run and
  said so. That is the single most valuable paragraph in that report.
- **Enumerate what survived, do not grep for what you expected.** The same round re-parsed rendered
  output and enumerated every attribute rather than grepping for pre-chosen ones, which surfaced
  three carriers nobody had thought to look for.
- If you build a differential, **assert which arm fired.** Overlapping oracle arms mask each other.

## Deliverables

1. Findings with severity, and an overall verdict on the diff.
2. An explicit verdict on each of the four claims above — including where you agree, stated at equal
   weight. A confirmed green control is a result, not an absence of one.
3. A numbered list of everywhere this brief is wrong (see the shared block — required, and note the
   two failure modes listed there; one of them is a fixture on *this very branch* where I supplied
   both the input and a wrong expected result).

Do not push. Do not modify production code. You MUST write the report file and then mark the task
complete.
