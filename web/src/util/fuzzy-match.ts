const WORD_BOUNDARY_RE = /[\s\-_]/;

/**
 * Simple fuzzy match: every character in the pattern must appear in order
 * within the target string (case-insensitive). Returns a score (lower is
 * better) or Infinity for no match. Consecutive-character runs and matches at
 * word boundaries score higher so "inv rpt" finds "Invoice Report" before
 * "Individual Rapport".
 */
export function fuzzyScore(pattern: string, target: string): number {
  const p = pattern.toLowerCase();
  const t = target.toLowerCase();

  let pi = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && pi < p.length; ti++) {
    if (t[ti] === p[pi]) {
      // Bonus for consecutive matches (gap penalty otherwise).
      const gap = lastMatchIndex === -1 ? 0 : ti - lastMatchIndex - 1;
      score += gap;

      // Bonus for matching at word boundaries (after space, dash, underscore, or start).
      if (ti === 0 || WORD_BOUNDARY_RE.test(t[ti - 1])) {
        score -= 2;
      }

      lastMatchIndex = ti;
      pi++;
    }
  }

  // All pattern characters consumed?
  return pi === p.length ? score : Infinity;
}
