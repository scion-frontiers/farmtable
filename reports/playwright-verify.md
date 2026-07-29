# Playwright Dashboard Verification

Checked at: 2026-07-18T23:53:14.064Z

## Result

PASS: Playwright can load and render the Farm Table Cloud Run dashboard.

Target URL: `https://farmtable-qo7k5fvpda-uc.a.run.app`

HTTP response: `200`

Browser executable: `/usr/bin/chromium` from `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`

Screenshot: `/scion-volumes/scratchpad/projects/farmtable/reports/dashboard-screenshot.png`

Raw JSON result: `/scion-volumes/scratchpad/projects/farmtable/reports/dashboard-verification-result.json`

## Render Evidence

The page title was `Farm Table`.

The DOM contained the expected dashboard shell:

- `ft-app` custom element present
- `ft-toolbar` custom element registered
- Rendered shadow DOM text included `Farm Table`, `Kanban`, `Tree`, `Live`, `Triage`, `Backlog`, `Ready`, `Working`, `In Review`, `In QA`, `Deploying`, `Completed`
- A task card was visible in the screenshot: `Test task from real client`

## Console Errors / Warnings

Observed one console error:

```text
Failed to load resource: the server responded with a status of 404 ()
URL: https://farmtable-qo7k5fvpda-uc.a.run.app/favicon.ico
```

No page errors or failed Playwright requests were observed.

Notable service responses during page load:

- `POST /farmtable.v1.FarmTableService/ListCollections` returned `200`
- `POST /farmtable.v1.FarmTableService/WatchTasks` returned `200`

## Script / Commands Used

Verification script:

```text
/scion-volumes/scratchpad/projects/farmtable/reports/verify-dashboard.mjs
```

Final verification command:

```bash
node /scion-volumes/scratchpad/projects/farmtable/reports/verify-dashboard.mjs
```

Environment check:

```bash
env | sort | rg 'PLAYWRIGHT|CHROM|CHROME|BROWSER|PUPPETEER|PW' || true
ls -l /usr/bin/chromium && /usr/bin/chromium --version
```

The existing `/scion-volumes/scratchpad/web-test/node_modules` Playwright package was reused. I initially tried Playwright's managed-browser path, which was missing, then confirmed and used the existing `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` environment variable in the script.
