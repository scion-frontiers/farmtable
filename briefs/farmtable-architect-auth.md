# Brief: Architect — Review Current Auth, Plan Improvements (Open-Ended Discussion)

## Critical Constraints (read first)
- **This is an open-ended design discussion, not a scoped implementation task.**
  ptone@google.com wants to talk through the current auth setup and improvement ideas with
  you directly.
- **Contact ptone@google.com directly** via `scion message --non-interactive ptone@google.com
  --channel discord --thread-id 1529316156165329067 "<message>"` for the discussion itself —
  the coordinator is not a conduit for this conversation. Only message the coordinator for
  infra-level things you can't resolve yourself (agent/tooling issues) or to report a
  milestone (e.g. "design doc finalized, ready for implementation phase").
- Use a dedicated git worktree if you need to inspect the repo:
  `git worktree add /workspace/farmtable-auth-architect -b explore/auth-review origin/main`
  (standing policy — avoids branch collisions with other in-flight work).
- Do not implement anything yet — this is investigation + design discussion. If/when a
  concrete plan emerges, the coordinator will dispatch an EM to implement it (or you can
  recommend that directly to the user, who will loop the coordinator in).
- You are a long-lived agent for this workstream — stay alive across the discussion, don't
  self-terminate after one exchange. The coordinator will not delete you without the user's
  explicit confirmation once this workstream is inactive.

## Context

This is scion-frontiers/farmtable — Go backend (gRPC/Connect-RPC) + Lit/TypeScript web
frontend, deployed on Cloud Run (project `deploy-demo-test`). Known auth-related facts from
project history (verify/expand on these yourself, don't take them as complete):
- Cloud Run service `farmtable`, auth via a `farmtable-token` secret (API token) — the
  original handoff doc flagged "browser gRPC-Web client not getting auth token injected"
  as a known gap early in this project's life; unclear if/how that was resolved since (the
  dashboard has been working in Playwright checks throughout, so something evolved here —
  investigate current state, don't assume the old doc is still accurate).
- External platform credentials (GitHub, etc.) are handled via a separate `LinkedAccount`
  entity (added for the External Store Passthrough project, PRs #85-#104) — this is a
  different credential path from the main app's own user auth.
- No indication so far of multi-user auth, permissions/roles, or session management beyond
  a single API token model — investigate whether that's accurate.

## Task

1. **Investigate current auth end-to-end** before talking to the user: how does a browser
   client authenticate to the gRPC-Web API today? Is there a user/session concept, or is it
   a single shared API token? How does `ft` (the CLI) authenticate? How do LinkedAccounts
   (external platform credentials, e.g. GitHub PAT) fit alongside the app's own auth? Check
   `internal/`, `proto/`, `web/src/gen/grpc-client.ts`, and any auth-related middleware in
   `cmd/farmtable-server/main.go`.
2. **Open the discussion with ptone@google.com on the specified Discord thread** — share
   what you found (current state), and ask what specifically they want to improve (don't
   assume — multi-user support? proper session/login flow? scoped API tokens? OAuth for
   external platforms beyond PATs? something else entirely). This is their idea to shape;
   your job is to inform the conversation with accurate current-state facts and then help
   design whatever direction they want to go.
3. Iterate with them as needed. When/if a concrete direction solidifies, write it up as a
   design doc.

## Deliverables
1. A findings doc on current auth state:
   `/scion-volumes/scratchpad/projects/farmtable/auth-current-state.md`
2. (Once direction is clear) a design doc:
   `/scion-volumes/scratchpad/projects/farmtable/design-auth-improvements.md`
3. Ongoing direct communication with ptone@google.com on Discord thread
   `1529316156165329067`.
4. A message to the coordinator once a concrete implementation-ready plan exists (or if you
   hit an infra/tooling blocker only the coordinator can resolve).

## Direct Contact
- ptone@google.com: `scion message --non-interactive ptone@google.com --channel discord
  --thread-id 1529316156165329067 "<message>"` — this is your primary communication
  channel for this workstream.
- Coordinator: `scion message coordinator "<message>"` for infra blockers or milestone
  reports only.

## Termination
This is a long-lived discussion/design agent — do not signal task_completed after the
first exchange. Stay available for follow-up. Signal task_completed only if/when
ptone@google.com or the coordinator explicitly tells you this workstream is closed.
