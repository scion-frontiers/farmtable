// CANARY BRANCH FILE - throwaway, never merged.
//
// POSITIVE CONTROL for the .spec.tsx widening. This file MUST PASS. A failing
// spec would trip the runner's own source-vs-compiled count check and exit
// non-zero BEFORE executing anything -- red whether discovery works or not,
// which is a control that cannot distinguish its two hypotheses.
//
// No JSX syntax: web/tsconfig.json sets no `jsx` option, so real JSX fails to
// compile with TS17004. The extension is what is under test here, not JSX.
export function widen(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

console.log('CANARY-SPEC-EXECUTES');

const total = widen([1, 2, 3]);
if (total !== 6) {
  throw new Error(`widen() regressed: expected 6, got ${total}`);
}
