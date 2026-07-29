# Scion note: agents cannot manage their own notification subscriptions

**From:** `phase-arch` (architect agent), Farm Table project
**Date:** 2026-07-25
**For:** general Scion Skill / Hub permissions review
**Task:** "explore using the Scion CLI to see if you can unsubscribe from the notifications for
c-phase."

**Result: no. An agent token cannot unsubscribe, and cannot even enumerate what it is
subscribed to.** Details below, including the probe that separates "missing ID" from "missing
permission".

---

## The surface exists and looks right

`scion notifications` has exactly the commands needed:

```
ack            Acknowledge notification(s)
subscribe      Create a notification subscription
subscriptions  List your notification subscriptions
unsubscribe    Remove a notification subscription
update         Update a subscription's trigger activities
```

`subscribe` and `update` both take `--triggers`, and the default set is documented in the flag
help:

```
--triggers string   Comma-separated trigger activities
                    (default: COMPLETED,WAITING_FOR_INPUT,LIMITS_EXCEEDED)
```

So the *precise* fix for the problem in the companion note — keep completion notices, drop the
"peer is blocked" echoes — is expressible: `--triggers COMPLETED,LIMITS_EXCEEDED`. The
capability is designed. It is just not reachable from an agent token.

## What an agent token actually gets (identity `phase-arch`)

| Command | Result |
|---|---|
| `notifications subscriptions` | `403 forbidden: Insufficient permissions` |
| `notifications subscriptions --json` | `403` |
| `notifications` (list notifications) | `403 failed to list notifications` |
| `notifications unsubscribe <uuid>` | `403 failed to delete subscription` |
| `notifications subscribe --agent <bogus>` | **not 403** — `agent '<name>' not found in project` |

## The useful probe

`unsubscribe` takes a subscription ID, and the only source of IDs is `subscriptions`, which is
403. That alone looks like a *dependency* problem — "I just need the ID from somewhere else."

Calling `unsubscribe` with a well-formed but nonexistent UUID distinguishes the two cases:

- `404 not found` → permission is fine, I only lack the ID.
- `403 forbidden` → the delete verb itself is denied.

It returned **403**. So this is a permission boundary, not a discoverability gap. Obtaining the
ID by some other route would not have helped.

**Generalisable technique:** when a CLI action needs an identifier you cannot obtain, probe
with a syntactically valid fake identifier. The error code tells you whether to go looking for
the ID or to stop and escalate. It costs one call and mutates nothing.

## The asymmetry, stated carefully

`subscribe` was the only verb that did **not** return 403 — it failed later, on agent-name
resolution. That is consistent with "agents may create subscriptions but not read, update or
delete them," which would make subscription a **one-way door**: `scion message --notify`
creates a subscription an agent can never inspect or revoke.

I am flagging this as *probable, not proven*. The probe failed at name resolution, which may
happen client-side before any subscription API call, so create permission is untested. The
circumstantial case is that `--notify` is documented agent-facing behaviour and would be
pointless if agents lacked create rights. **Worth confirming against the Hub's permission
table rather than taking this note's word for it.**

## Why I did not use the one escape hatch

`unsubscribe --all --project <p>` needs no ID. I did not run it:

1. It is far broader than the request — it removes *every* subscription in the project, not
   just the c-phase one.
2. **I cannot see what it would delete**, because `subscriptions` is 403. Deleting an
   unenumerable set is not a safe operation.
3. It is not cleanly reversible. Restoring would require re-creating subscriptions I was never
   able to list.

Note the shape of that trap: the only unsubscribe path available without an ID is also the only
one whose blast radius cannot be inspected. Even if `--all` were permitted, an agent should
probably decline it for the same reason.

## Recommendations

**Hub / permissions**

1. Grant agent tokens read access to their **own** subscriptions. Being unable to answer "what
   am I subscribed to?" makes notification volume undebuggable from inside the agent.
2. Grant `unsubscribe`/`update` for subscriptions **where the agent is the subscriber**. This
   is self-service on one's own inbox, not a privileged operation.
3. If (1) and (2) stay closed, then `scion message --notify` should be documented as
   irreversible-by-the-agent, and the default trigger set matters much more — see the companion
   note's recommendation to drop `WAITING_FOR_INPUT` from peer-agent defaults.

**Skill guidance**

> Agents generally **cannot** manage their own notification subscriptions: `subscriptions`,
> `unsubscribe`, `update` and notification listing all return 403 under an agent token. Treat
> `scion message --notify` as a one-way door and use it deliberately.
>
> If peer notifications are noisy, you cannot fix it yourself — **report it to the human**,
> naming the peer and the trigger type. Do not attempt `unsubscribe --all`: it is the only path
> that works without an ID, and its blast radius is exactly what you are forbidden to inspect.

## Environment

Hub `https://gteam.projects.scion-ai.dev`; auth "Agent token (source: scion-token file)";
agent mode auto-enables `--non-interactive` (which implies `--yes`, so destructive commands do
**not** prompt). Findings are for this token class; a human/owner token likely differs.
