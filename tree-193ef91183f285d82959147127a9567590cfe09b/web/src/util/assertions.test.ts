/**
 * Pins for the shared assertion harness.
 *
 * WHY THIS EXISTS. Mutation testing of the run-tests.mjs consumption gate found
 * a survivor: replace the body of `assert` with `count += 1; void condition;`
 * -- so it counts but never throws -- and the whole suite still reported
 * "PASS: 3 test file(s), 200 assertions." The count is held exactly fixed while
 * every check underneath it is disabled. That is the count-neutral corruption
 * the consumption gate is supposed to be immune to, and it was not.
 *
 * The gate cannot catch it, because the gate reads the count. Something has to
 * check the harness itself, and it cannot do that through the harness, or the
 * mutant hides inside the instrument measuring it. So the checks below use
 * `must`, which throws directly and is deliberately NOT counted.
 *
 * The harness is still used for the receipt (see the tail of run()), because a
 * file that emitted none would fail the gate -- correctly, since a file that
 * cannot be shown to check anything must not be green.
 */
import { assert, assertEqual, assertionCount, RECEIPT_PREFIX } from './assertions.js';

/** Throws on its own, without touching the harness under test. */
function must(condition: boolean, message: string): void {
  if (!condition) throw new Error(`assertions harness: ${message}`);
}

function threw(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function testAssertThrowsOnFalse(): void {
  must(threw(() => assert(false, 'boom')), 'assert(false) must throw');
  must(!threw(() => assert(true, 'fine')), 'assert(true) must not throw');
}

function testAssertCarriesItsMessage(): void {
  let message = '';
  try {
    assert(false, 'the message');
  } catch (e) {
    message = (e as Error).message;
  }
  must(message === 'the message', `assert must surface its message, got ${JSON.stringify(message)}`);
}

function testAssertEqualComparesIdentity(): void {
  must(threw(() => assertEqual(1, 2, 'differs')), 'assertEqual(1, 2) must throw');
  must(!threw(() => assertEqual('a', 'a', 'same')), 'assertEqual("a", "a") must not throw');
  // Count-neutral in the other direction: a stub that always throws would pass
  // the line above and fail this one.
  must(!threw(() => assertEqual(true, true, 'same')), 'assertEqual(true, true) must not throw');
}

function testCountTracksEvaluations(): void {
  const before = assertionCount();
  assert(true, 'one');
  assert(true, 'two');
  must(
    assertionCount() === before + 2,
    `assertionCount must advance by one per assertion; went ${before} -> ${assertionCount()}`,
  );

  // A failing assertion still counts: it was evaluated.
  const beforeFail = assertionCount();
  threw(() => assert(false, 'three'));
  must(
    assertionCount() === beforeFail + 1,
    'a failing assertion must still be counted, or a file could hide checks by failing them',
  );
}

function testReceiptPrefixIsStable(): void {
  // scripts/run-tests.mjs hard-codes this string. If it changes on one side
  // only, every file starts looking like it emitted no receipt -- which fails
  // loudly rather than silently, but the message would be misleading.
  must(
    RECEIPT_PREFIX === '#assertions ',
    `RECEIPT_PREFIX is ${JSON.stringify(RECEIPT_PREFIX)}; scripts/run-tests.mjs expects "#assertions "`,
  );
}

function run(): void {
  testAssertThrowsOnFalse();
  testAssertCarriesItsMessage();
  testAssertEqualComparesIdentity();
  testCountTracksEvaluations();
  testReceiptPrefixIsStable();
  console.log('assertions: ok');
}

run();
