/**
 * CANARY, THROWAWAY, NEVER MERGE.
 *
 * Added in the same commit that deletes web/src/utils/task-ready.test.ts, so
 * the cardinality of the web test population is unchanged: 6 before, 6 after.
 * This file is a compilable, discoverable, passing replacement -- exactly what
 * a merge produces when one test file leaves and another arrives together.
 */
import { assertEqual } from '../util/assertions.js';

function run(): void {
  assertEqual(1 + 1, 2, 'canary substitution file executes');
  assertEqual('a' + 'b', 'ab', 'canary substitution file executes twice');
}

run();
