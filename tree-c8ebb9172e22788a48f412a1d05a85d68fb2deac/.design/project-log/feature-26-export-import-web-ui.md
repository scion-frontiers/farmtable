# Feature 26: Collection Export/Import Web UI

## Summary

Implemented the web UI surface for collection export and import in the Farm Table dashboard.

## Changes

- Added hand-maintained protobuf JSON descriptor entries for `ExportCollection`, `ImportCollection`, and related request/response messages.
- Added gRPC web client methods for exporting collection bytes and importing uploaded collection data.
- Added `ImportStats` to generated TypeScript types and service interfaces, including mock client implementations.
- Added a FARMTABLE-only export toolbar button that downloads the exported collection JSON.
- Added an always-visible import toolbar button and import dialog with JSON file selection, format validation, preview counts, editable collection name, loading/error states, and success event dispatch.

## Verification

- Passed: `cd /workspace/farmtable/web && npm run build`
