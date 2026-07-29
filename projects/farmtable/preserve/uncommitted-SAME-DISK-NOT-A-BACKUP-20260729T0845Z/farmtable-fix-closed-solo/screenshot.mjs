#!/usr/bin/env node
/**
 * Playwright screenshot script for the closed-solo dependency view bug.
 *
 * Usage:
 *   node screenshot.mjs <baseUrl> <prefix>
 *
 * E.g.:
 *   node screenshot.mjs http://localhost:8080 before
 *   node screenshot.mjs http://localhost:5173 after
 */
import { chromium } from 'playwright';

const BASE_URL = process.argv[2] || 'http://localhost:8080';
const PREFIX = process.argv[3] || 'screenshot';
const EVIDENCE_DIR = '/scion-volumes/scratchpad/projects/farmtable/reports/closed-solo-fix-evidence';

const COLLECTION = '7d366242-ccc5-4720-8c5b-37e8e5c14683';
const TASK_A = '9714f10b-acaf-47fc-9a08-f41887491bd8';  // CLOSED task with 3 BLOCKS

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Wait a bit for the page to settle after navigation
  const settle = () => page.waitForTimeout(3000);

  if (PREFIX === 'before' || PREFIX === 'after') {
    // Screenshot 1: Solo mode on CLOSED task (the bug / the fix)
    const soloUrl = `${BASE_URL}/?collection=${COLLECTION}&view=dependencies&task=${TASK_A}&layoutdir=LR&solo=1`;
    console.log(`Navigating to solo view: ${soloUrl}`);
    await page.goto(soloUrl, { waitUntil: 'load' });
    await settle();
    await page.screenshot({
      path: `${EVIDENCE_DIR}/${PREFIX}-solo-closed-task.png`,
      fullPage: false,
    });
    console.log(`Saved: ${PREFIX}-solo-closed-task.png`);
  }

  if (PREFIX === 'after' || PREFIX === 'normal') {
    // Screenshot 2: Normal (non-solo) dependency view — CLOSED tasks should still be hidden
    const normalUrl = `${BASE_URL}/?collection=${COLLECTION}&view=dependencies&task=${TASK_A}&layoutdir=LR`;
    console.log(`Navigating to normal view: ${normalUrl}`);
    await page.goto(normalUrl, { waitUntil: 'load' });
    await settle();
    await page.screenshot({
      path: `${EVIDENCE_DIR}/${PREFIX}-normal-no-closed.png`,
      fullPage: false,
    });
    console.log(`Saved: ${PREFIX}-normal-no-closed.png`);
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
