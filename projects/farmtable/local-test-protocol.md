# Farm Table — Local Verification Protocol

Quick reference for dev/reviewer agents. Copy-paste commands for building,
running, and screenshotting the web dashboard locally against seed data.

**Last updated:** 2026-07-21

---

## TL;DR

```bash
# From a clean worktree checkout of the farmtable repo:
cd web && npm ci && npm run build && cd ..
go build -o ft ./cmd/ft
cp /scion-volumes/scratchpad/web-test/farmtable.db ./localtest.db
FARMTABLE_DB_PATH=./localtest.db ./ft dashboard --port 9090 &
sleep 2
# Dashboard is now at http://localhost:9090 with real task data.
```

Total time: **~60 seconds** from a cold build, **~10 seconds** if Go modules
and npm packages are already cached.

---

## Prerequisites

These are available in the standard scion agent environment:

| Tool | Location | Notes |
|------|----------|-------|
| Go | `go version` | ≥ 1.22 |
| Node.js | `node --version` | ≥ 18 |
| Chromium | `/usr/bin/chromium` | System-installed, headless-capable |
| Playwright | `/scion-volumes/scratchpad/web-test/node_modules` | Pre-installed; or `npm install playwright` |
| Seed DB | `/scion-volumes/scratchpad/web-test/farmtable.db` | 7 tasks, multiple stages, users, relationships |

---

## Step-by-Step

### 1. Build the web frontend

```bash
cd web && npm ci --prefer-offline && npm run build && cd ..
```

This populates `web/dist/` which is embedded into the Go binary at build time
via `//go:embed all:web/dist` in `assets.go`. **You must build web assets
before the Go binary.**

Time: ~7 seconds.

### 2. Build the Go binary

```bash
go build -o ft ./cmd/ft
```

Time: ~51 seconds cold, ~3 seconds warm (cached modules).

### 3. Set up the seed database

Copy the pre-seeded test database to your working directory:

```bash
cp /scion-volumes/scratchpad/web-test/farmtable.db ./localtest.db
```

This DB contains:
- 1 collection ("default", platform: farmtable)
- 1 user + 1 API token
- 7 tasks across stages: ready, working, blocked, backlog, in_qa
- Labels: feature, bug, design, docs
- Parent-child task relationships

**Always copy, never use in-place** — the original is a shared artifact.

### 4. Start the local dashboard

```bash
FARMTABLE_DB_PATH=./localtest.db ./ft dashboard --port 9090 > dashboard.log 2>&1 &
sleep 2
```

Verify it's up:

```bash
curl -s http://localhost:9090/ | head -3
# Should show: <!DOCTYPE html> ... <title>Farm Table</title>
```

Port notes:
- Use `9090` to avoid conflicts with other services on 8080.
- If 9090 is taken, try any free port: `--port 8081`, `--port 8082`, etc.

### 5. Take Playwright verification screenshots

```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

Create a screenshot script (or reuse from `/scion-volumes/scratchpad/web-test/screenshot.mjs`):

```javascript
// verify-local.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/local-kanban.png', fullPage: false });

// Click Tree toggle
const treeButton = page.locator('text=Tree');
if (await treeButton.isVisible()) {
  await treeButton.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/local-tree.png', fullPage: false });
}

// Click a task card to open inspector
const taskCard = page.locator('ft-task-card').first();
if (await taskCard.isVisible()) {
  await taskCard.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/local-inspector.png', fullPage: false });
}

await browser.close();
console.log('Screenshots captured.');
```

Run it:

```bash
mkdir -p screenshots
cd /scion-volumes/scratchpad/web-test && node /path/to/verify-local.mjs
# Or if playwright is installed locally:
# node verify-local.mjs
```

### 6. Clean up

```bash
pkill -f "ft dashboard" 2>/dev/null || true
rm -f ./localtest.db ./localtest.db-wal ./localtest.db-shm
```

---

## Alternative: `farmtable-server` Mode

If you need the standalone server (e.g. to test gRPC-Web behavior closer to
production):

```bash
cd web && npm ci --prefer-offline && npm run build && cd ..
go build -o farmtable-server ./cmd/farmtable-server

# SQLite mode — no Postgres needed:
FARMTABLE_DB_DIALECT=sqlite3 \
FARMTABLE_DB_URL="file:./localtest.db?_fk=1" \
./farmtable-server > server.log 2>&1 &
sleep 2
```

Notes for this mode:
- Runs on port 8080 by default (set `PORT=9090` to override).
- Without `FARMTABLE_TOKEN`, runs in **open access mode** (no auth).
- Does NOT auto-create a "local" user or default collection — you get an empty
  DB unless you copied the seed DB first.
- The dashboard command is preferred for testing because it handles user/token
  bootstrap automatically.

---

## Seeding a Fresh Database

If the pre-seeded DB is unavailable or you need custom test data:

```bash
export FARMTABLE_DB_PATH=./localtest.db
export PATH=$(pwd):$PATH

# Create collection (done automatically by `ft dashboard`, but manual for server mode)
# Then seed tasks:
./ft task create "Epic: User authentication" --stage working --label feature --priority high --type epic
./ft task create "Login form UI" --stage ready --label feature --priority normal
./ft task create "Fix validation bug" --stage backlog --label bug --priority normal
./ft task create "Update documentation" --stage in_qa --label docs
./ft task create "Design system review" --stage blocked --label design
./ft task create "Performance audit" --stage working --label feature --priority low
./ft task create "API rate limiting" --stage triage --label feature
```

---

## What to Verify Locally vs. on the Live Site

### Fully covered by local verification

- All UI layout, styling, and responsiveness
- Kanban board rendering — column layout, card display, count badges
- Tree/DAG view — node rendering, edge drawing, filters
- Inspector panel — metadata display, expandable sections
- View toggling (Kanban ↔ Tree)
- Task card content — title, priority, assignee, labels
- Dark theme rendering
- Drag-and-drop mechanics (Kanban)
- Empty-state displays
- Component interactions (dropdowns, modals, dialogs)
- Frontend JavaScript errors / console noise

### Still needs live-site verification

- **Auth flows**: real API token validation, token refresh
- **GitHub passthrough**: actual external GitHub data via linked accounts
- **Cloud Run–specific behavior**: response headers, CORS, HTTPS
- **gRPC-Web over TLS**: the local server uses plain HTTP
- **Deployed CSS/asset caching**: CDN behavior, cache headers
- **Live data volume**: production may have more data than 7 seed tasks
- **SSE/streaming reconnection**: over real network conditions

### Recommendation

Use **local-first** for all UI feature development and review rounds. Only
escalate to live-site verification when the feature touches auth, external
integrations, or deployment-specific infrastructure — and document which
aspect needs live verification in the feature brief.

---

## Troubleshooting

### "Port already in use"

```bash
lsof -i :9090 2>/dev/null | grep LISTEN
pkill -f "ft dashboard" 2>/dev/null || true
```

### "invalid token" errors in the web UI

The copied seed DB may have a token that doesn't match `~/.config/farmtable/config.toml`.
Fix: set the token env var to match the DB, or use a fresh DB (the dashboard
command auto-creates a matching token).

```bash
# Option A: Use a fresh DB instead of the seed
FARMTABLE_DB_PATH=./fresh.db ./ft dashboard --port 9090 &
# The dashboard creates its own user + token automatically.

# Option B: Use the dogfood DB (has matching token for this environment)
FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db ./ft dashboard --port 9090 &
```

### "web/dist: no such file or directory" when building Go binary

You forgot to build the web frontend first:

```bash
cd web && npm ci && npm run build && cd ..
go build -o ft ./cmd/ft
```

### Playwright can't find Chromium

```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

Always pass this as `executablePath` in the Playwright launch options. Do not
rely on Playwright's managed browser download — it's not available in the
sandboxed scion environment.

### Screenshot shows empty app shell (no task data)

The DB has no data. Either:
- Copy the seed DB: `cp /scion-volumes/scratchpad/web-test/farmtable.db ./localtest.db`
- Or seed manually with `ft task create` commands (see Seeding section above)

### Dashboard starts but no tasks are visible

Wait for `networkidle` in Playwright (gRPC-Web calls need to complete):

```javascript
await page.goto('http://localhost:9090', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000); // Extra buffer for web component rendering
```

---

## Quick-Reference Cheat Sheet

| What | Command |
|------|---------|
| Build web | `cd web && npm ci && npm run build && cd ..` |
| Build CLI | `go build -o ft ./cmd/ft` |
| Copy seed DB | `cp /scion-volumes/scratchpad/web-test/farmtable.db ./localtest.db` |
| Start dashboard | `FARMTABLE_DB_PATH=./localtest.db ./ft dashboard --port 9090 &` |
| Verify running | `curl -s http://localhost:9090/ \| head -3` |
| Set Chromium | `export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` |
| Take screenshot | `node verify-local.mjs` |
| Stop dashboard | `pkill -f "ft dashboard"` |
| Clean up | `rm -f ./localtest.db ./localtest.db-wal ./localtest.db-shm` |
