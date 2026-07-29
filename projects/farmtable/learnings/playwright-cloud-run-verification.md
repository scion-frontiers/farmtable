# Playwright Cloud Run Verification Learnings

## Summary

PASS: Playwright can load and render the Farm Table Cloud Run dashboard at
`https://farmtable-qo7k5fvpda-uc.a.run.app`.

The verified page returned HTTP 200, rendered the expected Farm Table dashboard
shell, and displayed live data including the real task card `Test task from real
client`. The page also completed the dashboard gRPC-Web reads successfully:

- `POST /farmtable.v1.FarmTableService/ListCollections` returned 200
- `POST /farmtable.v1.FarmTableService/WatchTasks` returned 200

The only console noise observed was a harmless `/favicon.ico` 404. There were no
page errors or failed Playwright requests.

## Gotchas / setup

Playwright's default managed-browser download path was not available in this
sandboxed environment. Use the system Chromium already present at
`/usr/bin/chromium` instead.

Set:

```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

Then pass that value as Playwright's `executablePath` option:

```js
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
```

Playwright is already installed under
`/scion-volumes/scratchpad/web-test/node_modules`. Reuse that package location;
there is no need to run `npm install` from scratch for this verification path.

## Open question

The deployment handoff says the browser-side gRPC-Web client needs an API token
injected at runtime and may otherwise show empty results or auth errors.

The verification contradicted that limitation: the dashboard rendered live data,
and `ListCollections` / `WatchTasks` returned 200 without an auth token. Re-check
whether read calls are intentionally unauthenticated or whether the handoff's
limitation has already been fixed. Do not assume either answer from this
verification alone.

## Source detail

- Full verification report:
  `/scion-volumes/scratchpad/projects/farmtable/reports/playwright-verify.md`
- Raw structured result:
  `/scion-volumes/scratchpad/projects/farmtable/reports/dashboard-verification-result.json`
- Working verification script:
  `/scion-volumes/scratchpad/projects/farmtable/reports/verify-dashboard.mjs`
- Reused Playwright dependencies and prior artifacts:
  `/scion-volumes/scratchpad/web-test/`
- Deployment handoff with service URL and known limitations:
  `/workspace/downloads/tg_1784417200_cloud-run-handoff.md`
