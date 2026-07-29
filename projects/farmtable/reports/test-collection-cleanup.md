# Report: Test Collection Cleanup

**Date:** 2026-07-22
**Service:** `farmtable-qo7k5fvpda-uc.a.run.app:443` (live Cloud Run)
**Method:** Direct Postgres deletion (no `DeleteCollection` RPC exists in the API)

---

## Summary

Deleted **11 collections** whose name contained "test" (case-insensitive) from the live Farmtable service. All associated tasks, relationships, comments, and changes were cascade-deleted first.

---

## Before: Collections with "test" in name (11 found)

| # | Name | ID | Platform | Created | Tasks |
|---|------|----|----------|---------|-------|
| 1 | `smoke-test-1784479392` | `b638f6c0-1a56-4c00-9061-bd94f2731b49` | farmtable | 2026-07-19 | 0 |
| 2 | `test-integration-20260720131734-6733-task` | `e66e9179-fa14-42d5-9293-e2637b7cfd71` | farmtable | 2026-07-20 | 1 |
| 3 | `test-integration-20260720131735-6799-collection` | `2a68677e-0a5c-4399-b847-bcdd34a2dd78` | farmtable | 2026-07-20 | 0 |
| 4 | `test-integration-20260720131735-6717-export` | `3a3c0e1f-ce84-4196-9045-8b35679156d4` | farmtable | 2026-07-20 | 2 |
| 5 | `test-integration-20260720131735-6717-reimported` | `709ae760-8c5b-498d-8ef1-848f8f359841` | farmtable | 2026-07-20 | 2 |
| 6 | `test-integration-20260720131756-7440-task` | `60fb37bf-ad46-4e80-8db7-d39c1dd4b36c` | farmtable | 2026-07-20 | 2 |
| 7 | `test-integration-20260720131758-7667-collection` | `9a568ad7-f0c2-49ab-8e6c-435fb9d11d5b` | farmtable | 2026-07-20 | 1 |
| 8 | `test-integration-20260720131759-7424-export` | `e2528733-7322-4eeb-a30e-458fe812fc41` | farmtable | 2026-07-20 | 2 |
| 9 | `test-integration-20260720131759-7424-reimported` | `e615511a-61b5-46be-b180-1e137d3b9aea` | farmtable | 2026-07-20 | 2 |
| 10 | `decomposer-test-1784662856` | `f7351b20-3c44-41b1-a253-e8dd6128b250` | farmtable | 2026-07-21 | 95 |
| 11 | `deploy-15-test-scion-roadmap` | `db0a50c1-54f8-4c1a-802d-5daf590ae608` | github | 2026-07-22 | 0 |

### Cascade-deleted data

- **110 tasks** total across all collections
- **174 relationships** (173 from decomposer-test, 1 from test-integration)
- **1 comment**
- **15 changes** (8 + 7)

---

## Coordination

- `deploy-15-test-scion-roadmap` (the GitHub-backed collection for `scion-frontiers/scion-roadmap`) was flagged as potentially tied to `farmtable-em-passthrough-write`'s active Phase 2 work.
- Messaged `farmtable-em-passthrough-write` before deleting; received confirmation: *"That collection is NOT needed for Phase 2 work. Phase 2 is UI gating only (no backend changes, no test collections needed). Safe to delete."*
- Deleted after confirmation.

---

## After: Remaining collections (7)

| Name | ID | Platform |
|------|----|----------|
| `default` | `1e0f02d1-99cd-46bc-a739-bac0fde60710` | farmtable |
| `farmtable-deploy4-web-202607200557` | `2c78db91-d17f-4d8b-9d62-29a7b1d409fd` | farmtable |
| `farmtable-deploy4-cli-20260720055552` | `b05c411c-283a-4c7e-a3a6-01673676a317` | farmtable |
| `github-experiment-scion-frontiers-farmtable` | `6a0a49f9-9c61-46cf-af5a-46f98f90ff20` | farmtable |
| `github-mirror-scion-frontiers-farmtable-20260720` | `466c2baa-334e-439c-b9f9-abbe89eb8aae` | github |
| `External Store Passthrough` | `5d1e4eea-3dc7-4958-99ac-01e3372c5a0d` | farmtable |
| `ext-store-passthrough-design` | `11f2f0ec-6cf2-4a1e-86f8-333d08d031d5` | farmtable |

None of the remaining 7 collections contain "test" in their name.

---

## Notes

- The Farmtable API has no `DeleteCollection` RPC. Deletion was performed via direct SQL against the Cloud SQL Postgres database (`scion-postgres-test` / `farmtable` database).
- All foreign-key-dependent rows (relationships, comments, changes, tasks, linked accounts) were deleted before the collection rows to avoid constraint violations.
