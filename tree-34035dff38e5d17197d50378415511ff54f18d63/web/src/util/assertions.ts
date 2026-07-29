/**
 * Shared assertion helpers for the web test files, plus the consumption receipt
 * that scripts/run-tests.mjs requires from every test file it runs.
 *
 * WHY THIS EXISTS. The runner already proves that every `*.test.ts` under src/
 * is compiled and executed. It could not prove that any of them CHECKED
 * anything. A file whose `run()` body had been commented out, or whose helpers
 * were all defined and never called, exits 0 and is counted as a passing file.
 * Three test files each rolled their own local `assert`, so there was also no
 * single place that could have counted.
 *
 * So: assertions go through here, here counts them, and the count is written to
 * stdout on exit as a machine-readable receipt. The runner refuses a file that
 * emits no receipt (it did not import this module) and a file whose receipt is
 * zero (it imported this module and never used it).
 *
 * WHAT THIS DOES NOT PROVE, stated plainly because a count is a weak signal:
 * `assert(true, 'ok')` a hundred times satisfies it. This is a floor on
 * vacuity, not a measure of coverage. It catches the failure mode that actually
 * happened elsewhere in this branch -- a declared check that nothing invoked --
 * and nothing subtler.
 */
import { writeSync } from 'node:fs';

/** Line the runner greps for. Changing it means changing run-tests.mjs. */
export const RECEIPT_PREFIX = '#assertions ';

let count = 0;
let emitted = false;

/**
 * Written with fs.writeSync rather than console.log because this runs from an
 * 'exit' handler. Node's process.stdout is asynchronous when it is a pipe --
 * which it is under the runner -- so a console.log here is silently dropped.
 * Measured: the receipt vanished from captured output until this changed.
 */
function emitReceipt(): void {
  if (emitted) return;
  emitted = true;
  writeSync(1, `${RECEIPT_PREFIX}${count}\n`);
}

process.on('exit', emitReceipt);

/** Number of assertions evaluated so far. Exported for the harness's own tests. */
export function assertionCount(): number {
  return count;
}

export function assert(condition: boolean, message: string): void {
  count += 1;
  if (!condition) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  count += 1;
  if (actual !== expected) {
    throw new Error(`${message} (got ${String(actual)}, want ${String(expected)})`);
  }
}
