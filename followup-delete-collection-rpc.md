# Follow-Up: Add DeleteCollection RPC

**Status:** Candidate follow-up (not urgent)  
**Date:** 2026-07-23  
**Source:** Decomposer testing workflow — old test collections cannot be cleaned up

## Observation

When running the decomposer against the live Farmtable instance, test
collections accumulate with no way to remove them via the API. The service
has `CreateCollection` and `ListCollections` RPCs but no `DeleteCollection`.

During the terminal-criteria fix testing, collection
`32e81d89-80dd-4eab-b73d-8924608fc574` was created as a first test run.
The user asked to delete it before re-running, but there is no API to do so.

## Impact

- Test collections accumulate on the live instance with no cleanup path.
- Users cannot remove accidentally created or obsolete collections.
- Automated tooling (like the decomposer) cannot clean up after itself.

## Recommendation

Add a `DeleteCollection` RPC to the Farmtable gRPC service. Considerations:

1. **Cascade behavior**: Should deleting a collection delete all its tasks,
   or require the collection to be empty first? Empty-first is safer but
   less convenient for cleanup scenarios.
2. **Soft delete**: Consider a soft-delete with a grace period, allowing
   recovery of accidentally deleted collections.
3. **Access control**: Collection deletion should require owner-level access
   (once scoped tokens / RBAC from the auth stage-4 work lands).

This is low priority — it's a convenience/hygiene gap, not a blocker.
