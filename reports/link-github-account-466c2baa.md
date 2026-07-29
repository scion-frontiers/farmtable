# Report: LinkedAccount Created for Collection 466c2baa

## Summary

Successfully created a LinkedAccount linking collection `466c2baa-334e-439c-b9f9-abbe89eb8aae` (platform: github, remote_id: `scion-frontiers/farmtable`) to the GitHub API using the environment's `$GITHUB_TOKEN` PAT (authenticated as `ptone`). The dashboard now shows 47 real GitHub issues in board view with polling mode.

## Prerequisites: Redeployment

Per coordinator instruction, the backend fix (PR #107, commit `ab2071e` — PlatformResolver wiring) had not yet been deployed. A redeployment was performed before linking.

### Build

- Cloud Build config: `/tmp/farmtable-cloudbuild-server-deploy-8.yaml` (standard `gcr.io/cloud-builders/docker` step with `-f Dockerfile.server`)
- Build ID: `c2e1934d-4c57-402c-bce7-83ec48192e24`
- Status: `SUCCESS`
- Source commit: `6aeed20` (HEAD of main, includes PR #107 `ab2071e` plus two later commits)

### Deploy

Initial deploy created revision `farmtable-00013-drn`. A second deploy was needed (see Troubleshooting below), producing **revision `farmtable-00014-jfd`** as the final live revision.

```
gcloud run deploy farmtable \
  --image=us-central1-docker.pkg.dev/deploy-demo-test/farmtable/farmtable-server:latest \
  --region=us-central1 \
  --platform=managed \
  --use-http2 \
  --add-cloudsql-instances=deploy-demo-test:us-central1:scion-postgres-test \
  --service-account=scion-my-grove@deploy-demo-test.iam.gserviceaccount.com \
  --project=deploy-demo-test
```

Confirmed:
- Revision: `farmtable-00014-jfd`
- Traffic: 100% to `farmtable-00014-jfd`
- HTTP 200 on `https://farmtable-qo7k5fvpda-uc.a.run.app/`

## Linking

### CLI Rebuilt

The `ft` binary at `/scion-volumes/scratchpad/web-test/ft` was an older build missing the `collection link` subcommand (PR #97). Rebuilt from current HEAD (`6aeed20`):

```bash
go build -o /scion-volumes/scratchpad/web-test/ft ./cmd/ft
```

### Link Command

```bash
export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443
export FARMTABLE_TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)
export FARMTABLE_LINK_TOKEN="$GITHUB_TOKEN"

ft collection link github \
  --collection 466c2baa-334e-439c-b9f9-abbe89eb8aae \
  --repo scion-frontiers/farmtable \
  --server "$FARMTABLE_SERVER"
```

Output:

```json
{
  "auth_method": "pat",
  "collection_id": "466c2baa-334e-439c-b9f9-abbe89eb8aae",
  "created_at": "2026-07-21T16:14:56Z",
  "expires_at": null,
  "id": "e6b593ac-da9a-4e78-b9bc-93f9ea36787f",
  "platform": "github",
  "remote_user_id": "scion-frontiers/farmtable",
  "scopes": ["repo", "read:org"],
  "status": "ACTIVE",
  "updated_at": "2026-07-21T16:14:56Z"
}
```

### Verification

**Linked accounts:**

```bash
ft collection links --collection 466c2baa-334e-439c-b9f9-abbe89eb8aae
```

Returns 1 ACTIVE linked account (`e6b593ac-da9a-4e78-b9bc-93f9ea36787f`).

**Task list:**

```bash
ft task list -c 466c2baa-334e-439c-b9f9-abbe89eb8aae
```

Returns 47 GitHub issues with `remote_id` references like `scion-frontiers/farmtable#77`, `remote_url` links to GitHub, and correct phase/stage mappings.

**Dashboard screenshot:**

Saved to: `link-github-dashboard-466c2baa.png` (in this reports directory).

The board view shows all 47 issues across TRIAGE/BACKLOG/READY/WORKING/IN REVIEW columns. Collection picker shows "github: scion-frontiers/farmtable". Status indicator shows "Polling" mode (expected — passthrough/streaming is not supported for external collections, so polling is the correct fallback per PR #107 fix).

## Troubleshooting Notes

### Token flag collision in `ft collection link`

The `ft collection link` subcommand has a local `--token` flag for the GitHub PAT, which shadows the global `--token` flag used for Farmtable API authentication. The first link attempt incorrectly passed `--token "$FARMTABLE_API_TOKEN"` which was stored as the GitHub credential, resulting in 401 from GitHub.

**Fix:** Use `FARMTABLE_TOKEN` env var for API auth and `FARMTABLE_LINK_TOKEN` env var for the GitHub PAT (avoiding the `--token` flag ambiguity).

### In-memory cache poisoning

After the first bad link attempt, the server's `MultiStore` cached a `PassThroughStore` with the wrong token. Even after unlinking and re-linking with the correct token, the cached store persisted in the running Cloud Run instance. A second deploy (`farmtable-00014-jfd`) was needed to force a fresh container instance and clear the in-memory cache.

## Final State

| Item | Value |
|------|-------|
| Collection | `466c2baa-334e-439c-b9f9-abbe89eb8aae` |
| LinkedAccount ID | `e6b593ac-da9a-4e78-b9bc-93f9ea36787f` |
| Platform | github |
| Auth method | PAT (ptone) |
| Status | ACTIVE |
| Tasks visible | 47 GitHub issues |
| Cloud Run revision | `farmtable-00014-jfd` |
| Source commit | `6aeed20` |
| Dashboard mode | Polling (correct for external collections) |

**Result: SUCCESS** — Collection 466c2baa now shows real GitHub data from `scion-frontiers/farmtable`.
