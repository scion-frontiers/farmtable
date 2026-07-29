## Summary

Under an **agent token**, every read and mutate operation on notification subscriptions returns
`403 forbidden: Insufficient permissions`. An agent can (apparently) create subscriptions — via
`scion message --notify` — but cannot list, update, delete, or even view the resulting
notifications. Subscription is effectively a **one-way door** for agents.

This surfaced while an agent was trying to stop receiving a peer's `WAITING_FOR_INPUT`
notifications, and found there was no way to do so from inside the container.

## Reproduction

Agent identity `phase-arch` (`scion whoami`), Hub `https://gteam.projects.scion-ai.dev`,
auth reported as `Agent token (source: scion-token file)`.

| Command | Result |
|---|---|
| `scion notifications subscriptions` | `403 failed to list subscriptions: forbidden: Insufficient permissions` |
| `scion notifications subscriptions --json` | `403` |
| `scion notifications` (list notifications) | `403 failed to list notifications` |
| `scion notifications unsubscribe <uuid>` | `403 failed to delete subscription` |
| `scion notifications subscribe --agent <bogus>` | **not 403** — fails later at `agent '<name>' not found in project` |

## This is a permission boundary, not a missing ID

`unsubscribe` requires a subscription ID, and the only source of IDs (`subscriptions`) is 403 —
so at first glance this looks like a mere dependency problem, solvable by obtaining the ID
elsewhere.

Calling `unsubscribe` with a **well-formed but nonexistent UUID** distinguishes the two cases:

- `404 not found` → permission is fine, the caller only lacks the ID
- `403 forbidden` → the delete verb itself is denied

It returns **403**. Obtaining the ID by another route would not help.

## Why this matters

1. **Notification volume is undebuggable from inside an agent.** An agent cannot answer "what
   am I subscribed to?", so it cannot diagnose or explain why it is receiving traffic.
2. **`scion message --notify` is irreversible by the agent that used it.** Nothing in the
   flag's surface communicates that.
3. **The only escape hatch is unsafe.** `unsubscribe --all --project <p>` needs no ID, but it
   removes *every* subscription in the project and the caller is forbidden from enumerating
   what that includes. Note the shape: the one unsubscribe path reachable without an ID is also
   the only one whose blast radius cannot be inspected. Also relevant — agent mode
   auto-enables `--non-interactive`, which implies `--yes`, so it would not prompt.

## Concrete trigger for this report

Default subscription triggers are `COMPLETED,WAITING_FOR_INPUT,LIMITS_EXCEEDED`
(`scion notifications subscribe --triggers` help text). Because `WAITING_FOR_INPUT` is on by
default, a subscribed peer agent receives every one of that agent's "I am blocked awaiting
input" signals, rendered as `"<agent> is WAITING_FOR_INPUT: <question text>"`.

That reads like a direct question, so peer agents answer it — wasting turns, because the
sender's block is usually on a human and a peer's reply cannot clear it. The correct fix
(`--triggers COMPLETED,LIMITS_EXCEEDED`) is expressible in the CLI but **not reachable from an
agent token**.

## Suggested changes

1. Allow agent tokens to **read their own** subscriptions (`subscriptions`) and their own
   notifications.
2. Allow `unsubscribe` / `update` for subscriptions **where the caller is the subscriber**.
   This is self-service on one's own inbox, not a privileged operation.
3. Consider excluding `WAITING_FOR_INPUT` from the default trigger set when the **subscriber is
   an agent** (humans want it; peer agents generally cannot act on it).
4. If 1 and 2 remain closed, document `--notify` as agent-irreversible, and make the error
   message actionable — `403 Insufficient permissions` gives the caller nothing to act on.
   Something like "agent tokens cannot manage subscriptions; ask a project owner" would.

## Relation to #38

Complementary, not a duplicate. #38 proposes reorganising where these commands live in the
command tree. This issue is that, for agent tokens, the commands return 403 wherever they
live — improving the discoverability of commands an agent cannot call does not help the agent.
Worth resolving the permission question alongside any restructure so the ergonomics work is
not aimed at an unusable surface.

---

*Filed by the `phase-arch` agent at ptone's request, from findings during a Farm Table design
session. Caveat on the create path: the `subscribe` probe failed at agent-name resolution
rather than returning 403, which is consistent with create being permitted, but that may be a
client-side check before any API call — so create permission is **inferred, not proven**.*
