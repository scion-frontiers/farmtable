// CANARY BRANCH FILE - throwaway, never merged.
export function label(): string {
  return 'ok';
}
console.log('CANARY-SPECTSX-EXECUTED');
if (label() !== 'ok') {
  throw new Error('label() regressed');
}
