# Scion note: message `type` fields, and why status echoes get mistaken for questions

**From:** `phase-arch` (architect agent), Farm Table project
**Date:** 2026-07-25
**For:** the `scion-messaging` Skill refinement
**Status:** observed behaviour, from one agent's inbox over ~40 minutes. Mechanism inferred,
not read from Scion source.

---

## The failure mode

Two agents (`phase-arch`, `c-phase`) were collaborating. `c-phase` needed a decision from a
**human**. Over five minutes I received what appeared to be the *same question from c-phase to
me*, four times, twice immediately after c-phase had acknowledged my answer to it.

I concluded c-phase was stuck in a loop and reported that to the user. **That conclusion was
wrong**, and the `type` field is what shows why.

## What the envelopes actually said

Inbound messages carry a `type`. Three values appeared:

| `type` | What it is | Sender's intent toward me |
|---|---|---|
| `instruction` | A real message another agent/user sent me | Addressed to me. Act on it. |
| `state-change` | Notification that an agent changed lifecycle state | FYI. Usually no action. |
| `input-needed` | Notification that an agent is **blocked waiting on input** | **Not addressed to me.** |

Timeline (all sender `agent:c-phase`):

```
15:29:58  input-needed   "c-phase is WAITING_FOR_INPUT: should the stage be named ...?"
15:30:15  state-change   "COMPLETED: asked the first open question there."
15:31:43  input-needed   "c-phase is WAITING_FOR_INPUT: Confirm whether accepted should ..."
15:31:54  state-change   "COMPLETED: Asked for confirmation via scion message."
15:32:10  instruction    (genuine ack from c-phase, agreeing with my answer)
15:32:46  input-needed   "c-phase is WAITING_FOR_INPUT: Confirm whether you want accepted ..."
15:32:58  state-change   "COMPLETED: Sent directly to you only."
```

Every apparent "repeat" was `input-needed`. The only genuine peer-to-peer message was the ack.

## The mechanism

`input-needed` messages are **status-signal echoes**, not messages. An agent calling
`sciontool status ask_user "<question>"` generates a notification to that agent's
*subscribers*, with the question string embedded behind a system-generated
`"<agent> is WAITING_FOR_INPUT:"` prefix. That prefix is not the sender's prose.

The subscription trigger set defaults to `COMPLETED,WAITING_FOR_INPUT,LIMITS_EXCEEDED`
(`scion notifications subscribe --triggers`). **`WAITING_FOR_INPUT` is on by default.** Any
agent subscribed to a peer — including via `scion message --notify` — receives that peer's
every "I am blocked on a human" signal, rendered as text that reads like a direct question.

Confirmed live while writing this note: c-phase moved on to its *second* open question and
addressed it to the user, and I received the echo anyway.

## Why this is worth a Skill entry

The echo is **indistinguishable from a direct question** on casual reading, and it is
*actionable-looking*, so a well-behaved agent answers it. That is exactly the wrong outcome:

1. **The answer is wasted.** The peer's block is on a human; a peer's reply cannot clear it.
2. **It produces false loop signals.** From my side it looked like c-phase re-asking after
   acking. From c-phase's side it may have asked once.
3. **It can cause scope violations.** Three of those echoes asked me to "confirm" a decision
   that belonged to the user. Answering repeatedly makes a recommendation look ratified.
4. **It burns context** on both sides.

## Proposed Skill guidance

> **Check the `type` field before replying.** Only `instruction` is addressed to you.
> `state-change` and `input-needed` are notifications *about* another agent.
>
> **Never answer an `input-needed` message.** It means that agent is blocked waiting on someone
> — usually a human. Text after `"X is WAITING_FOR_INPUT:"` is a status string, not a question
> to you. Replying does not unblock them.
>
> **If an `input-needed` echo looks like it needs your input**, the routing is likely wrong.
> Tell the peer to check the recipient on its prompt, and tell the human. Do not answer it
> repeatedly — repeats are re-signals, not impatience.
>
> **If you genuinely need a peer's input, send an `instruction`** via `scion message
> agent:<name>`. Do not rely on your status signal to reach them; it is a broadcast to
> subscribers, not a delivery to an addressee.

## Amendment: `type` is necessary but not sufficient

Added after the above was first written, because the very next exchange broke the rule as
stated.

I received a fourth question as `input-needed` and correctly ignored it. Thirty seconds later
came a `state-change` — nominally a pure FYI — whose text read: *"I'm still waiting on your
answer about whether `blocked` should be derived-only."* That **was** genuinely addressed to
me, and a strict "only act on `instruction`" reading would have had me ignore a real request
and leave a peer blocked.

So the honest rule is two-part:

> **Default on `type`, then read the payload for addressing.** `input-needed` and
> `state-change` are *presumptively* not addressed to you — but the sender may embed real
> addressing in the text ("waiting on **your** answer", "@you", a direct question naming you).
> Second-person addressing in a notification payload overrides the presumption.
>
> The reliable tell is not the `type`, it is **whether the text names who is being waited on**.
> `"X is WAITING_FOR_INPUT: <question>"` names nobody — ignore it. `"I'm still waiting on your
> answer"` names me — act on it.

This strengthens rather than weakens product suggestion 3 below. The whole ambiguity exists
because the awaited party is absent from the structured payload, forcing recipients to infer
addressing from prose. Agents are currently doing sentiment analysis on notification text to
decide whether they have been asked a question. A `waiting_on` field would remove the guesswork
entirely and make a clean `type`-based rule actually correct.

## Suggested product changes (for whoever owns the Hub)

1. **Do not include `WAITING_FOR_INPUT` in the default trigger set for agent subscribers.**
   Human subscribers want it; peer agents almost never can act on it. Default peers to
   `COMPLETED` (+ `LIMITS_EXCEEDED`).
2. **Strip or fence the embedded question text in the peer copy.** `"c-phase is blocked
   awaiting input (from user:ptone)"` conveys the coordination fact without impersonating a
   question.
3. **Name the awaited party in the payload.** The single most useful missing field. If the
   echo said *who* is being waited on, no recipient would mistake it for their cue.
