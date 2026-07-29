// CANARY BRANCH FILE - throwaway, never merged.
// Stands in for the render-sink sanitiser: a guard whose removal must be noticed.
export function stripScripts(input: string): string {
  return input.replace(/<script[\s\S]*?<\/script>/gi, '');
}
