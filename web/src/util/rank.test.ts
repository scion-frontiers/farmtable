import { ranksForMove, RANK_STEP, type RankedItem, type RankWrite } from './rank.js';

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message}: expected ${b}, got ${a}`);
}

/** Build a band from `[id, rank?]` pairs, in display order. */
function band(...items: (string | [string, number])[]): RankedItem[] {
  return items.map((item) =>
    typeof item === 'string' ? { id: item } : { id: item[0], rank: item[1] },
  );
}

/**
 * Apply `writes` to `band` and re-sort the way the queue does
 * (`compareAcceptedQueueOrder`): rank ascending, unranked last, then a stable
 * fallback — here the original display order stands in for created_at/id.
 *
 * This is the property that actually matters: whatever the algorithm writes,
 * re-reading the band must reproduce the order the user dropped.
 */
function orderAfter(source: readonly RankedItem[], writes: readonly RankWrite[]): string[] {
  const byId = new Map(writes.map((write) => [write.id, write.rank]));
  return source
    .map((item, index) => ({
      id: item.id,
      rank: byId.has(item.id) ? byId.get(item.id)! : item.rank,
      index,
    }))
    .sort((a, b) => {
      const aRank = a.rank ?? Number.POSITIVE_INFINITY;
      const bRank = b.rank ?? Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
      return a.index - b.index;
    })
    .map((item) => item.id);
}

/** Move `movedId` to `targetIndex` and assert the resulting read-back order. */
function assertMove(
  source: readonly RankedItem[],
  movedId: string,
  targetIndex: number,
  expectedOrder: string[],
  message: string,
): RankWrite[] {
  const writes = ranksForMove(source, movedId, targetIndex);
  assertDeepEqual(orderAfter(source, writes), expectedOrder, `${message} (resulting order)`);

  const ranks = writes.map((write) => write.rank);
  assertEqual(
    new Set(ranks).size,
    ranks.length,
    `${message} (writes must not contain duplicate ranks)`,
  );
  for (const write of writes) {
    assertEqual(
      Number.isSafeInteger(write.rank) && write.rank >= 1,
      true,
      `${message} (rank ${write.rank} must be a positive safe integer)`,
    );
  }
  return writes;
}

function run(): void {
  // ── The primary case: production data has no ranks at all ─────────
  // Every task has `rank === undefined`, so no midpoint exists and the band
  // must be renumbered. This is the common case today, not an edge case.
  {
    const source = band('a', 'b', 'c');
    const writes = assertMove(source, 'c', 0, ['c', 'a', 'b'], 'unranked band, move last to first');
    assertDeepEqual(
      writes,
      [
        { id: 'c', rank: 1024 },
        { id: 'a', rank: 2048 },
        { id: 'b', rank: 3072 },
      ],
      'unranked band renumbers to even spacing',
    );
  }
  {
    const source = band('a', 'b', 'c');
    assertMove(source, 'a', 2, ['b', 'c', 'a'], 'unranked band, move first to last');
  }
  {
    const source = band('a', 'b', 'c', 'd');
    assertMove(source, 'b', 2, ['a', 'c', 'b', 'd'], 'unranked band, move into the middle');
  }
  {
    // A band that is only *partly* ranked cannot anchor a single write either:
    // the unranked tasks sort last regardless of what the moved task gets.
    const source = band(['a', 1024], 'b', 'c');
    assertMove(source, 'c', 1, ['a', 'c', 'b'], 'partly ranked band');
  }

  // ── The common case once ranks exist: exactly one write ───────────
  {
    const source = band(['a', 1024], ['b', 2048], ['c', 3072]);
    const writes = assertMove(source, 'c', 1, ['a', 'c', 'b'], 'ranked band, move into a gap');
    assertEqual(writes.length, 1, 'a move into an open gap writes exactly one task');
    assertDeepEqual(writes, [{ id: 'c', rank: 1536 }], 'moved task takes the midpoint');
  }
  {
    const source = band(['a', 1024], ['b', 2048], ['c', 3072]);
    const writes = assertMove(source, 'b', 0, ['b', 'a', 'c'], 'ranked band, move to first');
    assertEqual(writes.length, 1, 'move to first writes exactly one task');
    assertEqual(writes[0].rank < 1024, true, 'new first rank sorts above the old first');
  }
  {
    const source = band(['a', 1024], ['b', 2048], ['c', 3072]);
    const writes = assertMove(source, 'a', 2, ['b', 'c', 'a'], 'ranked band, move to last');
    assertEqual(writes.length, 1, 'move to last writes exactly one task');
    assertDeepEqual(writes, [{ id: 'a', rank: 3072 + RANK_STEP }], 'new last rank is one step past');
  }
  {
    // Two items only, both ranked: still a single write at either end.
    const source = band(['a', 1024], ['b', 2048]);
    const writes = assertMove(source, 'b', 0, ['b', 'a'], 'two-item ranked band, swap');
    assertEqual(writes.length, 1, 'swapping a ranked pair writes one task');
  }

  // ── Gap exhaustion: renumber, but only then ───────────────────────
  {
    // No integer strictly between 5 and 6, so this band must be renumbered.
    const source = band(['a', 5], ['b', 6], ['c', 9000]);
    const writes = assertMove(source, 'c', 1, ['a', 'c', 'b'], 'exhausted gap renumbers');
    assertEqual(writes.length > 1, true, 'an exhausted gap renumbers more than one task');
    assertDeepEqual(
      writes,
      [
        { id: 'a', rank: 1024 },
        { id: 'c', rank: 2048 },
        { id: 'b', rank: 3072 },
      ],
      'renumber re-spaces the band evenly',
    );
  }
  {
    // Head of the band with no room left below rank 1.
    const source = band(['a', 1], ['b', 4096]);
    const writes = assertMove(source, 'b', 0, ['b', 'a'], 'no room below the first rank');
    assertEqual(writes.length, 2, 'a squeezed head renumbers the band');
  }
  {
    // Renumbering writes only the tasks whose rank actually changes.
    const source = band(['a', 1024], ['b', 2048], ['c', 2049], ['d', 2050]);
    const writes = assertMove(source, 'd', 2, ['a', 'b', 'd', 'c'], 'partial renumber');
    assertEqual(
      writes.some((write) => write.id === 'a'),
      false,
      'a task already at its renumbered rank is not written',
    );
  }

  // ── No-ops return no writes ───────────────────────────────────────
  assertDeepEqual(
    ranksForMove(band(['a', 1024], ['b', 2048]), 'a', 0),
    [],
    'dropping a task at its own index is a no-op',
  );
  assertDeepEqual(
    ranksForMove(band('a', 'b', 'c'), 'b', 1),
    [],
    'a no-op on an unranked band does not renumber',
  );
  assertDeepEqual(
    ranksForMove(band(['a', 1024]), 'a', 0),
    [],
    'a single-item band cannot be reordered',
  );
  assertDeepEqual(
    ranksForMove(band(['a', 1024], ['b', 2048]), 'missing', 0),
    [],
    'an unknown task id writes nothing',
  );

  // ── Out-of-range target indices are clamped, not crashed ──────────
  assertMove(band(['a', 1024], ['b', 2048], ['c', 3072]), 'a', 99, ['b', 'c', 'a'], 'index past the end');
  assertMove(band(['a', 1024], ['b', 2048], ['c', 3072]), 'c', -5, ['c', 'a', 'b'], 'negative index');

  // ── Duplicate / non-monotonic existing ranks are repaired ─────────
  {
    // Duplicates mean the stored ranks do not express the visible order, so a
    // midpoint against them would be meaningless.
    const source = band(['a', 100], ['b', 100], ['c', 100]);
    const writes = assertMove(source, 'c', 0, ['c', 'a', 'b'], 'duplicate ranks renumber');
    assertEqual(writes.length, 3, 'a fully duplicated band is renumbered wholesale');
  }

  // ── Repeated moves stay stable (no drift into exhaustion) ─────────
  {
    let current: RankedItem[] = band('a', 'b', 'c', 'd');
    for (let i = 0; i < 25; i++) {
      const movedId = current[current.length - 1].id;
      const writes = ranksForMove(current, movedId, 0);
      const expected = [movedId, ...current.slice(0, -1).map((item) => item.id)];
      assertDeepEqual(orderAfter(current, writes), expected, `repeated move ${i} keeps the order`);
      const byId = new Map(writes.map((write) => [write.id, write.rank]));
      current = expected.map((id) => ({
        id,
        rank: byId.get(id) ?? current.find((item) => item.id === id)!.rank,
      }));
    }
    assertEqual(
      current.every((item) => Number.isSafeInteger(item.rank)),
      true,
      'ranks stay valid integers after repeated moves',
    );
  }
}

run();
console.log('rank tests passed');
