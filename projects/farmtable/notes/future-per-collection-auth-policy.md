# Future Feature: Per-Collection Auth Policy

**Date:** 2026-07-26
**Priority:** HIGH (per ptone)
**Status:** Tracking — out of scope for current auth stages, but should be
planned for and accommodated in the design.
**Source:** Discussion on triage→accepted authority in Discord thread 1529316156165329067

---

## Concept

Authorization policy can be attached at two levels:

1. **Global scope** — default policy that applies to all collections unless
   overridden.
2. **Collection scope** — policy bound to one or more specific collections
   via a many:many bind pattern.

A collection can have multiple policies bound to it, and a policy can be bound
to multiple collections.

## What This Enables

- Different collections with different ceremony levels (e.g., "Production
  Incidents" requires `task:accept` for all inbound work; "Scratch" allows
  any authenticated user to accept freely).
- External intake collections (tasks from external platforms via LinkedAccounts)
  can enforce mandatory review before work starts.
- Teams or projects can define their own authorization rules without affecting
  other collections on the same instance.

## Relationship to Current Auth Design

This builds on Stage 4 (Scoped Tokens & RBAC) but is larger in scope:

- **Stage 4 gives us token-level scopes** — "this token CAN do task:accept"
  (capability on the token).
- **Per-collection policy adds requirement-level rules** — "this collection
  REQUIRES task:accept for triage transitions" (requirement on the collection).
- A transition is allowed when the token's capability meets the collection's
  requirement.

The two layers compose: same agent token behaves differently in different
collections based on the collection's policy, without needing different tokens
per collection.

## Design Considerations

- **Bind pattern:** Many:many between Policy and Collection. A Policy entity
  would contain a set of transition rules (or more generally, authorization
  rules). Collections without explicit policy bindings fall back to the global
  default policy.

- **Scope:** This is bigger than just transition roles. Per-collection policy
  could govern:
  - Which scopes are required for which operations
  - Who can create tasks in a collection
  - Who can modify collection settings
  - Whether external platform sync requires review
  - Read access restrictions (if ever needed)

- **Stage 4 accommodation:** The Stage 4 scope vocabulary and enforcement
  helpers should be designed so that per-collection policy can be layered on
  top later without rearchitecting. Specifically:
  - `RequireScope()` should accept a collection context parameter
  - The scope check should be pluggable (today: check token scopes; future:
    check token scopes AND collection policy)
  - The transition scope mapping should be configurable, not hardcoded

## Not Needed Now

This does NOT need to be implemented in Stages 1-6. But the Stage 4
implementation should avoid design choices that make this hard to add later.
Specifically:
- Don't hardcode transition rules in the RPC handlers
- Keep the scope check centralized in `RequireScope()` so it can be extended
- Make the scope vocabulary extensible (it already is — adding scopes is
  backward-compatible)
