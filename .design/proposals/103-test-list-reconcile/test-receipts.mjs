/**
 * Assertion-receipt protocol handling for scripts/run-tests.mjs. Lands at
 * web/scripts/test-receipts.mjs.
 *
 * WHY THIS IS A SEPARATE MODULE AND NOT PART OF run-tests.mjs. run-tests.mjs
 * does its work at import time -- it discovers, spawns and exits -- so nothing
 * can import it to check its logic without running the whole suite. That put
 * the single most delicate rule in this change ("a report that was not
 * understood is not a report of zero") in a place where the only way to test it
 * was a full build, which is exactly the position that makes people ship it
 * untested. Split out, it is ordinary code that ordinary code can exercise:
 * see check-receipts.mjs, which drives every branch below with synthetic
 * stdout and needs no compiler, no suite and no build token.
 *
 * Neither function calls process.exit. They return errors as values, so the
 * caller decides what is fatal and a test can see the difference.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Must match RECEIPT_PREFIX in src/util/assertions.ts. */
export const RECEIPT_PREFIX = '#assertions ';

export const PROTOCOL_RECEIPT = 'receipt';
export const PROTOCOL_PRIVATE_TOTAL = 'private-total';
export const KNOWN_PROTOCOLS = [PROTOCOL_RECEIPT, PROTOCOL_PRIVATE_TOTAL];

/**
 * Read and validate test-receipts.manifest.json.
 * Returns { manifest } or { error }. Fails closed: a missing or malformed
 * manifest is an error, never "assume the default for everything", because that
 * would silently restore the single-protocol behaviour this replaced.
 */
export function loadManifest(webRoot) {
  const path = join(webRoot, 'test-receipts.manifest.json');
  if (!existsSync(path)) {
    return {
      error:
        'test-receipts.manifest.json is missing. It declares which assertion-receipt\n' +
        '  protocol each suite uses. Without it this runner cannot tell a suite that\n' +
        '  reported nothing from a suite whose report it does not understand, and those\n' +
        '  two must never collapse together.',
    };
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { error: `test-receipts.manifest.json is not parseable: ${e.message}` };
  }

  const suites = cfg.suites ?? {};
  for (const [name, decl] of Object.entries(suites)) {
    if (!KNOWN_PROTOCOLS.includes(decl?.protocol)) {
      return {
        error:
          `test-receipts.manifest.json declares suite "${name}" with protocol ` +
          `${JSON.stringify(decl?.protocol)}, which this runner does not implement.\n` +
          `  Known protocols: ${KNOWN_PROTOCOLS.join(', ')}.\n` +
          '  Teach this runner the protocol, or fix the declaration. An unknown protocol is\n' +
          '  refused rather than skipped, so a third convention cannot arrive silently.',
      };
    }
    if (decl.protocol === PROTOCOL_PRIVATE_TOTAL) {
      if (typeof decl.pattern !== 'string' || !Number.isInteger(decl.captureGroup)) {
        return {
          error:
            `suite "${name}" declares protocol "${PROTOCOL_PRIVATE_TOTAL}" but is missing a ` +
            'string "pattern" or an integer "captureGroup".',
        };
      }
      try {
        decl.compiled = new RegExp(decl.pattern);
      } catch (e) {
        return { error: `suite "${name}" has an invalid "pattern": ${e.message}` };
      }
    }
  }

  const pin = cfg.aggregateAssertionPin ?? null;
  if (pin !== null && !Number.isInteger(pin)) {
    return {
      error: `"aggregateAssertionPin" must be an integer or null, got ${JSON.stringify(pin)}`,
    };
  }
  return { manifest: { suites, aggregatePin: pin } };
}

/**
 * Assertion total for one suite, per its DECLARED protocol.
 * Returns { count } or { error }. Never returns a silent zero: "did not report"
 * and "reported zero" are both errors, and they carry different messages
 * because they have different causes.
 */
export function readAssertionTotal(suiteStem, stdout, manifest) {
  const decl = manifest.suites[suiteStem];
  const lines = stdout.split('\n');
  const receipts = lines
    .filter((l) => l.startsWith(RECEIPT_PREFIX))
    .map((l) => Number.parseInt(l.slice(RECEIPT_PREFIX.length), 10));

  if (!decl || decl.protocol === PROTOCOL_RECEIPT) {
    if (receipts.length === 0) {
      return {
        error:
          `exited 0 but emitted no "${RECEIPT_PREFIX.trim()}" receipt and is not declared in ` +
          'test-receipts.manifest.json, so nothing can tell whether it checked anything. ' +
          'Either import src/util/assertions.ts, or declare its reporting format in the ' +
          'manifest. THIS IS NOT READ AS ZERO ASSERTIONS; it is read as no answer.',
      };
    }
    if (receipts.some((n) => !Number.isInteger(n))) {
      return { error: 'emitted an unparseable assertion receipt' };
    }
    const n = Math.max(...receipts);
    if (n === 0) {
      return { error: 'exited 0 having evaluated 0 assertions: it ran, and it checked nothing' };
    }
    return { count: n };
  }

  // PROTOCOL_PRIVATE_TOTAL
  if (receipts.length > 0) {
    return {
      error:
        `is declared "${PROTOCOL_PRIVATE_TOTAL}" in test-receipts.manifest.json but also emitted ` +
        `a "${RECEIPT_PREFIX.trim()}" receipt. A suite must report its count exactly one way; ` +
        'two conventions in one suite means one of them is being ignored, and which one is ' +
        'ignored is not something this runner should be choosing.',
    };
  }
  const hits = lines.map((l) => decl.compiled.exec(l)).filter(Boolean);
  if (hits.length === 0) {
    return {
      error:
        `is declared "${PROTOCOL_PRIVATE_TOTAL}" in test-receipts.manifest.json but printed no ` +
        `line matching ${decl.pattern}. Its reporting line has changed, or it stopped ` +
        'reporting. Update the pattern in the manifest in the same commit that changes the ' +
        'suite. THIS IS NOT READ AS ZERO ASSERTIONS; it is read as no answer.',
    };
  }
  if (hits.length > 1) {
    return { error: `printed ${hits.length} lines matching its declared pattern; expected one` };
  }
  const n = Number.parseInt(hits[0][decl.captureGroup], 10);
  if (!Number.isInteger(n)) {
    return { error: 'declared pattern matched but its capture group is not an integer' };
  }
  if (n === 0) {
    return { error: 'reported a private total of 0 assertions: it ran, and it checked nothing' };
  }
  return { count: n };
}
