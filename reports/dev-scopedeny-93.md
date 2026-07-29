# scopedeny-93 — see the findings report

This file previously held a land/redo recommendation. That framing was
superseded mid-task by an owner directive: the auth architecture of this
project is incomplete by design and stays as it is, with
`farmtable-architect-auth` owning identity, authentication, authorization, the
permission model, scopes, user types and token gating.

A recommendation is therefore not this branch's to make, and an obsolete one
left here would misrepresent the disposition.

**Status:** LIVE FINDING. Measured and transmitted to the auth design owner.
Not landed, not merged, not pushed.

**Full measurements:**
`/scion-volumes/scratchpad/projects/farmtable/reports/dev-scopedeny-93-findings.md`

**Project log:** `.design/project-log/2026-07-29-scopedeny-93.md`

The branch itself is the evidence artefact: every oracle was committed and shown
RED before the change that turned it GREEN. Base `faf1c8c`, tip `1cbf643`.

One caveat that matters when reading the history: the middle commits do not
build on their own. `internal/server/rbac_test.go` kept a one-value
`DefaultScopesForUserType` call after `c8be951` moved it to two values, with the
repair sitting uncommitted in the working tree. Test runs reported during the
task measured that working tree rather than any commit. `1cbf643` records the
repair; only the tip is independently reproducible.
