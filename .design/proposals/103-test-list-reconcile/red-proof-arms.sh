#!/bin/zsh
# Red-proof harness for check-test-membership.mjs.
# Runs ONLY the guard. Compiles nothing, runs no test suite, needs no build token.
GUARD=/workspace/farmtable-dev-103-testlist/.design/proposals/103-test-list-reconcile/check-test-membership.mjs
PIN=/workspace/farmtable-dev-103-testlist/.design/proposals/103-test-list-reconcile/test-suites.pin
W=/tmp/d103/fixture/web

XSS_SCRIPT='rm -rf .tmp-test && tsc -p tsconfig.test.json && node scripts/run-tests.mjs'
M195_SCRIPT='tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js'
GLOB_INC='["src/**/*.test.ts"]'
M195_INC='["src/utils/task-ready.test.ts","src/util/markdown.test.ts"]'

wire() {  # wire <test-script> <include-json>
  jq --arg s "$1" '.scripts.test = $s' "$W/package.json" > "$W/.pkg" && mv "$W/.pkg" "$W/package.json"
  jq -n --argjson i "$2" '{compilerOptions:{outDir:".tmp-test"},include:$i}' > "$W/tsconfig.test.json"
}

arm() {  # arm <label> <expected-exit>
  echo "\n############ $1 ############"
  node "$GUARD" "$W" --pin "$PIN"
  rc=$?
  if [[ $rc == $2 ]]; then echo "EXIT=$rc  (expected $2)  OK"; else echo "EXIT=$rc  (expected $2)  *** MISMATCH ***"; fi
}

rm -f "$W/src/util/decoy.test.ts"

wire "$XSS_SCRIPT" "$GLOB_INC"
arm "ARM A: reconciled/XSS wiring, all five union suites discovered. GREEN CONTROL." 0

wire "$M195_SCRIPT" "$M195_INC"
arm "ARM B: take-195 resolution on a merged tree. Three suites stop running." 1

wire "$M195_SCRIPT" "$GLOB_INC"
arm "ARM C: 195 package.json + XSS glob tsconfig. Compiled, never executed." 1

wire "$XSS_SCRIPT" "$M195_INC"
arm "ARM D: XSS package.json + 195 hand include. Runner aborts; NOT a membership answer." 2

# Count-neutral: five executed, five pinned, one identity swapped.
echo 'export {};' > "$W/src/util/decoy.test.ts"
FIVE_SUB='tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js && node .tmp-test/util/markdown.test.js && node .tmp-test/util/assertions.test.js && node .tmp-test/util/safe-url.test.js && node .tmp-test/util/decoy.test.js'
wire "$FIVE_SUB" '["src/utils/task-ready.test.ts","src/util/markdown.test.ts","src/util/assertions.test.ts","src/util/safe-url.test.ts","src/util/decoy.test.ts"]'
arm "ARM E: COUNT-NEUTRAL SUBSTITUTION. 5 executed, 5 pinned. A FLOOR AND AN EXACT COUNT BOTH PASS HERE." 1
rm -f "$W/src/util/decoy.test.ts"

wire 'tsc -p tsconfig.test.json && node --test .tmp-test/' "$GLOB_INC"
arm "ARM F: unrecognised invocation form. Open form space, bounded from the other end." 2

# Regression arm for the canonicalisation bug found at 03:10Z on the real tree.
wire "$XSS_SCRIPT" "$GLOB_INC"
printf 'src/util/assertions.test.ts\nutil/markdown.test\nutil/safe-url\nsrc/util/url-binding-scan.test.ts\nutils/task-ready.test\n' > /tmp/d103/pin-spellings.txt
echo "\n############ ARM G: hand-written pin, all four spellings mixed. REGRESSION ARM. ############"
node "$GUARD" "$W" --pin /tmp/d103/pin-spellings.txt
rc=$?
if [[ $rc == 0 ]]; then echo "EXIT=$rc  (expected 0)  OK"; else echo "EXIT=$rc  (expected 0)  *** MISMATCH ***"; fi
