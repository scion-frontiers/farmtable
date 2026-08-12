import { fuzzyScore } from './fuzzy-match.js';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTrue(actual: boolean, message: string): void {
  if (!actual) throw new Error(message);
}

assertEqual(fuzzyScore('inv rpt', 'Invoice Report'), 3, 'scores ordered word-boundary matches');
assertEqual(
  fuzzyScore('inv rpt', 'Individual Rapport'),
  7,
  'penalizes gaps after otherwise valid matches',
);
assertTrue(
  fuzzyScore('inv rpt', 'Invoice Report') < fuzzyScore('inv rpt', 'Individual Rapport'),
  'word-boundary matches beat looser matches',
);
assertEqual(fuzzyScore('zz', 'Invoice Report'), Infinity, 'returns Infinity when not every pattern character matches');
assertEqual(fuzzyScore('', 'Invoice Report'), 0, 'empty patterns match with neutral score');
