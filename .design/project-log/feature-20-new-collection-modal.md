# Feature 20 — New Collection Button + Modal

Built a New Collection action beside the collection picker in the dashboard toolbar. The action opens a creation dialog, creates the collection through the service client, closes on success, and navigates directly to the new collection board.

Files changed:

- `web/src/gen/service.ts`
- `web/src/gen/grpc-client.ts`
- `web/src/components/ft-new-collection-dialog.ts`
- `web/src/components/ft-toolbar.ts`
- `web/src/index.ts`

The modal is intentionally minimal: it collects only a required name. Platform and description fields will be added in a later expansion.

Suggested next UI/UX feature: add collection settings so users can edit the collection name, description, and platform after creation.
