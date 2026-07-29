# CLI Integration Test Scripts

These scripts exercise the `ft` CLI against a real running Farmtable server. They are higher-level user-journey checks for task lifecycle, collection lifecycle, and collection export/import behavior.

## Prerequisites

- `ft` available on `PATH`
- `jq` available on `PATH`
- `FARMTABLE_SERVER` set to the target server address
- `FARMTABLE_TOKEN` set to a valid API token

For the shared live service:

```bash
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443
export FARMTABLE_TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)
ft status --token "$FARMTABLE_TOKEN"
```

For a local or alternate deployment, set `FARMTABLE_SERVER` and `FARMTABLE_TOKEN` for that server before running the scripts.

## Running

Run all journeys:

```bash
test/integration/run-all.sh
```

Run one journey:

```bash
test/integration/test-task-lifecycle.sh
test/integration/test-collection-lifecycle.sh
test/integration/test-export-import.sh
```

Each script creates its own disposable collection named `test-integration-<timestamp>-<purpose>` and scopes all task operations to that collection. The scripts do not touch the `default` collection or any pre-existing collection.

## Coverage

- `test-task-lifecycle.sh`: creates, lists, gets, updates, comments on, relates, and closes tasks.
- `test-collection-lifecycle.sh`: creates, lists, gets, and uses a collection as task scope.
- `test-export-import.sh`: exports a collection, validates the JSON file, imports it under a new name, compares task counts, and spot-checks task fields.
- `run-all.sh`: validates required environment, runs every journey, and lists disposable collections left behind.

## Known Limitations

- `DeleteCollection` does not exist in the API, so scripts cannot clean up test collections programmatically.
- `UpdateCollection` exists as an RPC but has no CLI command, so collection update behavior is not covered here.
- These scripts intentionally do not wire into CI. They require a real reachable server and valid token, so they are reusable manual or future CI tooling rather than an active workflow.
- Coverage is not exhaustive across every CLI command. The focus is high-value user journeys that prove core lifecycle behavior end to end.
