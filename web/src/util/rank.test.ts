import { ranksForMove, RANK_STEP, type RankedItem, type RankWrite } from './rank.js';
import { compareAcceptedQueueOrder } from './task-state-utils.js';
import { Platform, TaskPhase, TaskStage, type Task } from '../gen/types.js';

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

function assertTrue(actual: boolean, message: string): void {
  if (!actual) throw new Error(message);
}

/**
 * A band item as the *test* models it: the identity and rank `rank.ts` needs,
 * plus the `createdAt` that the real queue comparator falls back on.
 */
interface BandItem extends RankedItem {
  createdAt: string;
}

/** Build a band from `[id, rank?]` pairs, in display order. */
function band(...items: (string | [string, number])[]): BandItem[] {
  return items.map((item, index) =>
    typeof item === 'string'
      ? { id: item, createdAt: createdAtFor(index) }
      : { id: item[0], rank: item[1], createdAt: createdAtFor(index) },
  );
}

/**
 * Distinct, increasing `created_at` values in display order.
 *
 * The queue comparator breaks rank ties on `created_at`, so a band whose ranks
 * tie is only "already in display order" if `created_at` agrees with it. Giving
 * every fixture a timestamp derived from its display index makes that true by
 * construction — and `assertSourceIsInDisplayOrder` below then *checks* it,
 * rather than assuming it.
 */
function createdAtFor(index: number): string {
  return new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString();
}

/**
 * Promote a band item to the real `Task` shape `compareAcceptedQueueOrder`
 * consumes. Only `rank`, `createdAt` and `id` participate in the comparison
 * for a single priority band; the rest is inert scaffolding the type requires.
 */
function toTask(item: BandItem): Task {
  return {
    id: item.id,
    name: item.id,
    phase: TaskPhase.OPEN,
    stage: TaskStage.ACCEPTED,
    assignees: [],
    collectionId: 'collection-1',
    relationships: [],
    labels: [],
    customFields: [],
    platform: Platform.FARMTABLE,
    createdAt: item.createdAt,
    version: '1',
    ...(item.rank === undefined ? {} : { rank: item.rank }),
  };
}

/**
 * Apply `writes` to `source` and re-sort with the REAL queue comparator.
 *
 * This deliberately imports `compareAcceptedQueueOrder` rather than
 * re-implementing it. The previous version of this helper was a hand-written
 * copy of the comparator that broke rank ties on the item's current source
 * *index*; the real comparator breaks them on `created_at`, then `id`. Those
 * agree only when the input band was already sorted by the real comparator, so
 * the old oracle was conditionally correct with the condition unenforced — and
 * the interesting cases for `ranksForMove` (duplicate ranks, wholly unranked
 * bands) are exactly the cases where ranks tie and the tiebreak decides. Any
 * future change to the comparator now breaks these tests, which is the point:
 * `ranksForMove` exists to produce ranks that comparator will read back.
 */
function orderAfter(source: readonly BandItem[], writes: readonly RankWrite[]): string[] {
  const byId = new Map(writes.map((write) => [write.id, write.rank]));
  return source
    .map((item) => toTask(byId.has(item.id) ? { ...item, rank: byId.get(item.id)! } : item))
    .sort(compareAcceptedQueueOrder)
    .map((task) => task.id);
}

/**
 * Enforce `ranksForMove`'s documented precondition: `band` is "already in the
 * order the user currently sees (`compareAcceptedQueueOrder`)".
 *
 * Without this, a fixture could quietly violate the contract and the resulting
 * assertion would be testing undefined behaviour. It is also the guard that was
 * missing from the old self-built oracle.
 */
function assertSourceIsInDisplayOrder(source: readonly BandItem[], message: string): void {
  const sorted = source.map(toTask).sort(compareAcceptedQueueOrder).map((task) => task.id);
  assertDeepEqual(
    sorted,
    source.map((item) => item.id),
    `${message} (fixture violates the precondition: band must already be in comparator order)`,
  );
}

/** Move `movedId` to `targetIndex` and assert the resulting read-back order. */
function assertMove(
  source: readonly BandItem[],
  movedId: string,
  targetIndex: number,
  expectedOrder: string[],
  message: string,
): RankWrite[] {
  assertSourceIsInDisplayOrder(source, message);

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

/** Apply `writes` to `source`, returning the band as it would be re-read. */
function applyWrites(source: readonly BandItem[], writes: readonly RankWrite[]): BandItem[] {
  const byId = new Map(writes.map((write) => [write.id, write.rank]));
  const next = source.map((item) => (byId.has(item.id) ? { ...item, rank: byId.get(item.id)! } : item));
  const order = orderAfter(source, writes);
  return order.map((id) => next.find((item) => item.id === id)!);
}

/**
 * Deterministic PRNG (mulberry32) for the property-based section.
 *
 * `Math.random()` would make a failure unreproducible, which is worse than no
 * property test at all — the seed is printed with any failure so a counter-
 * example can be replayed exactly.
 */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

  {
    // `ranksForMove` has a second no-op guard — "a reordering that reproduces
    // the current order is still a no-op" — which the index arithmetic alone
    // can never trigger, because splicing an item to a different index always
    // changes the sequence. The one way in is a band carrying the same id
    // twice: swapping two identical ids leaves the id sequence unchanged, and
    // without the guard the module would issue a pointless write (and, worse,
    // one keyed to an ambiguous id). Deleting the guard survived the mutation
    // run until this case existed.
    const duplicated: BandItem[] = [
      { id: 'a', rank: 1024, createdAt: createdAtFor(0) },
      { id: 'a', rank: 2048, createdAt: createdAtFor(1) },
      { id: 'b', rank: 3072, createdAt: createdAtFor(2) },
    ];
    assertDeepEqual(
      ranksForMove(duplicated, 'a', 1),
      [],
      'swapping two identically-named tasks writes nothing',
    );
  }

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
    let current = band('a', 'b', 'c', 'd');
    for (let i = 0; i < 25; i++) {
      const movedId = current[current.length - 1].id;
      const writes = ranksForMove(current, movedId, 0);
      const expected = [movedId, ...current.slice(0, -1).map((item) => item.id)];
      assertDeepEqual(orderAfter(current, writes), expected, `repeated move ${i} keeps the order`);
      current = applyWrites(current, writes);
    }
    assertEqual(
      current.every((item) => Number.isSafeInteger(item.rank)),
      true,
      'ranks stay valid integers after repeated moves',
    );
  }

  // ── The tiebreak the old self-built oracle could not express ──────
  //
  // When ranks tie, `compareAcceptedQueueOrder` decides on `created_at` and
  // then `id` — never on the item's position in the array it was handed. These
  // three fixtures put `created_at` order and array order in conflict, which
  // the previous index-based oracle was structurally unable to represent.
  {
    // A wholly unranked band displayed newest-first is NOT in comparator order,
    // so it violates the documented precondition. Asserting that the guard
    // fires proves the guard is load-bearing rather than decorative.
    const outOfOrder: BandItem[] = [
      { id: 'newer', createdAt: createdAtFor(5) },
      { id: 'older', createdAt: createdAtFor(1) },
    ];
    let threw = false;
    try {
      assertSourceIsInDisplayOrder(outOfOrder, 'precondition guard');
    } catch {
      threw = true;
    }
    assertTrue(threw, 'the precondition guard must reject a band that is not in comparator order');
  }
  {
    // Unranked band: the renumber must beat `created_at`, not tie with it. If
    // `ranksForMove` returned no writes here the band would read back in
    // created_at order (a, b, c) rather than the dropped order (c, a, b).
    const source = band('a', 'b', 'c');
    const writes = assertMove(source, 'c', 0, ['c', 'a', 'b'], 'unranked band beats created_at');
    assertTrue(
      writes.find((write) => write.id === 'c')!.rank < writes.find((write) => write.id === 'a')!.rank,
      'the dropped-to-front task must receive the lowest rank',
    );
  }
  {
    // Duplicate ranks: reading back through the real comparator, a tie is
    // resolved by created_at, so leaving `c` tied with `a` at 100 would place
    // it *after* `a`. The renumber has to break the tie for the drop to hold.
    const source = band(['a', 100], ['b', 100], ['c', 100]);
    const writes = assertMove(source, 'c', 0, ['c', 'a', 'b'], 'duplicate ranks beat created_at');
    const after = applyWrites(source, writes);
    assertEqual(new Set(after.map((item) => item.rank)).size, 3, 'the tie is fully broken');
  }
  {
    // Same rank, and `created_at` identical too — the comparator's last resort
    // is `id`. `zz` sorts after `aa` by id, so dropping `zz` first must produce
    // a strictly lower rank; nothing else could hold the order.
    const identical = createdAtFor(0);
    const source: BandItem[] = [
      { id: 'aa', rank: 100, createdAt: identical },
      { id: 'zz', rank: 100, createdAt: identical },
    ];
    assertMove(source, 'zz', 0, ['zz', 'aa'], 'id tiebreak');
  }

  // ── Organic gap exhaustion ────────────────────────────────────────
  //
  // The enumerated cases above force the renumber path with a hand-built band
  // (`[5, 6]`). This instead narrows one gap the way a user would: repeatedly
  // drop the last task into the same slot, halving the gap each time, until the
  // 1024-wide step is genuinely consumed and `renumber` fires on its own.
  {
    let current = band(['a', 1024], ['b', 2048], ['c', 3072], ['d', 4096]);
    let renumbered = 0;
    const gaps: number[] = [];

    for (let i = 0; i < 40; i++) {
      const movedId = current[current.length - 1].id;
      const expected = [
        ...current.slice(0, 1).map((item) => item.id),
        movedId,
        ...current.slice(1, -1).map((item) => item.id),
      ];
      const writes = ranksForMove(current, movedId, 1);
      assertDeepEqual(orderAfter(current, writes), expected, `organic narrowing ${i}`);
      if (writes.length > 1) renumbered++;
      current = applyWrites(current, writes);

      const ranks = current.map((item) => item.rank!);
      assertEqual(new Set(ranks).size, ranks.length, `organic narrowing ${i}: ranks stay distinct`);
      assertTrue(
        ranks.every((rank, index) => index === 0 || ranks[index - 1] < rank),
        `organic narrowing ${i}: ranks stay strictly increasing in display order`,
      );
      gaps.push(ranks[1] - ranks[0]);
    }

    assertTrue(
      renumbered > 0,
      `repeatedly narrowing one gap must eventually renumber (gaps seen: ${gaps.join(',')})`,
    );
    assertTrue(
      gaps.some((gap) => gap === 1),
      `the gap must actually reach exhaustion, not merely shrink (gaps seen: ${gaps.join(',')})`,
    );
  }

  // ── Property-based: random bands, random targets ──────────────────
  //
  // The enumerated cases cover the shapes the author thought of. These cover
  // the ones they did not: for any band and any target index, the invariants
  // are that the band reads back in the dropped order, the writes contain no
  // duplicate ranks, every written rank is a positive safe integer, and only
  // ids from the band are ever written.
  {
    const random = makeRandom(0x5eed_1234);
    const seen = { singleWrite: 0, renumber: 0, noop: 0 };

    for (let trial = 0; trial < 500; trial++) {
      const size = 1 + Math.floor(random() * 7);
      // A mix of fully ranked, partly ranked and wholly unranked bands, with
      // gaps from comfortable to exhausted — but always ascending, because a
      // descending band would violate the documented precondition.
      const density = random();
      let cursor = 1 + Math.floor(random() * 4);
      const items: BandItem[] = [];
      for (let i = 0; i < size; i++) {
        const ranked = random() < density;
        if (ranked) cursor += 1 + Math.floor(random() * (random() < 0.5 ? 2 : 4096));
        items.push({
          id: `t${i}`,
          createdAt: createdAtFor(i),
          ...(ranked ? { rank: cursor } : {}),
        });
      }
      // Unranked tasks sort last, so a band with an unranked task before a
      // ranked one is not in comparator order. Re-sort into the order the user
      // would actually see, which is what `ranksForMove` is handed.
      const source = items.map(toTask).sort(compareAcceptedQueueOrder).map(
        (task) => items.find((item) => item.id === task.id)!,
      );

      const movedIndex = Math.floor(random() * size);
      const targetIndex = Math.floor(random() * size);
      const movedId = source[movedIndex].id;
      const context = `property trial ${trial} (seed 0x5eed1234) band=${JSON.stringify(
        source.map((item) => [item.id, item.rank]),
      )} move=${movedId}->${targetIndex}`;

      assertSourceIsInDisplayOrder(source, context);

      const expected = source.filter((item) => item.id !== movedId).map((item) => item.id);
      expected.splice(targetIndex, 0, movedId);

      const writes = ranksForMove(source, movedId, targetIndex);

      assertDeepEqual(orderAfter(source, writes), expected, `${context}: reads back in dropped order`);

      const ranks = writes.map((write) => write.rank);
      assertEqual(new Set(ranks).size, ranks.length, `${context}: no duplicate ranks written`);
      for (const write of writes) {
        assertTrue(
          Number.isSafeInteger(write.rank) && write.rank >= 1,
          `${context}: wrote rank ${write.rank}, which is not a positive safe integer`,
        );
        assertTrue(
          source.some((item) => item.id === write.id),
          `${context}: wrote unknown id ${write.id}`,
        );
      }

      // The whole band must remain unambiguous after the write, or the next
      // drop starts from a band that cannot express any order at all.
      const after = applyWrites(source, writes);
      const settled = after.filter((item) => item.rank !== undefined).map((item) => item.rank!);
      assertEqual(new Set(settled).size, settled.length, `${context}: band has duplicate ranks after the write`);

      if (writes.length === 0) seen.noop++;
      else if (writes.length === 1) seen.singleWrite++;
      else seen.renumber++;
    }

    // A property test that only ever exercised one branch would be a green
    // no-op, so assert the generator actually reached all three outcomes.
    assertTrue(seen.noop > 0, `property generator never produced a no-op: ${JSON.stringify(seen)}`);
    assertTrue(
      seen.singleWrite > 0,
      `property generator never produced a single write: ${JSON.stringify(seen)}`,
    );
    assertTrue(
      seen.renumber > 0,
      `property generator never produced a renumber: ${JSON.stringify(seen)}`,
    );
  }

  // ── Hostile server ranks ──────────────────────────────────────────
  //
  // `rank` arrives from the server and nothing validates it client-side. The
  // guard in `singleWrite` is `Number.isSafeInteger`, so floats, NaN and
  // unsafe magnitudes fall through to `renumber` — but negatives and zero pass
  // `Number.isSafeInteger` and do NOT, which is finding F-1 below.
  {
    const hostile: { label: string; rank: number }[] = [
      { label: 'float', rank: 1536.5 },
      { label: 'NaN', rank: Number.NaN },
      { label: 'Infinity', rank: Number.POSITIVE_INFINITY },
      { label: 'beyond MAX_SAFE_INTEGER', rank: Number.MAX_SAFE_INTEGER + 2 },
    ];
    for (const testCase of hostile) {
      const source: BandItem[] = [
        { id: 'a', rank: 1024, createdAt: createdAtFor(0) },
        { id: 'b', rank: testCase.rank, createdAt: createdAtFor(1) },
        { id: 'c', rank: 9_000_000, createdAt: createdAtFor(2) },
      ];
      const writes = ranksForMove(source, 'c', 0);
      for (const write of writes) {
        assertTrue(
          Number.isSafeInteger(write.rank) && write.rank >= 1,
          `hostile ${testCase.label} rank produced an invalid write: ${JSON.stringify(write)}`,
        );
      }
      assertTrue(
        writes.length > 1,
        `hostile ${testCase.label} rank must force a renumber, got ${JSON.stringify(writes)}`,
      );
      // The renumber must also *repair* the band: no hostile value survives.
      const after = applyWrites(source, writes);
      assertTrue(
        after.every((item) => Number.isSafeInteger(item.rank) && item.rank! >= 1),
        `hostile ${testCase.label} rank survived the renumber: ${JSON.stringify(after)}`,
      );
    }
  }

  // ── FINDING F-1 (characterisation, not endorsement) ───────────────
  //
  // `MIN_RANK = 1` is documented as "the minimum rank this module will hand
  // out. Ranks stay positive integers", and `midpoint()` enforces it — but only
  // in the head-of-band branch. Negative and zero ranks are safe integers, so
  // they pass `singleWrite`'s guard instead of falling through to `renumber`,
  // and the two-bounds branch then hands out a rank below MIN_RANK.
  //
  // This asserts the CURRENT behaviour so the defect is recorded and cannot
  // regress silently. When it is fixed this test fails, which is the intended
  // signal to replace it with the invariant assertion. Reported to the manager
  // as F-1; deliberately NOT fixed here, because this is a test pass.
  {
    const source: BandItem[] = [
      { id: 'a', rank: -5, createdAt: createdAtFor(0) },
      { id: 'b', rank: 0, createdAt: createdAtFor(1) },
      { id: 'c', rank: 5, createdAt: createdAtFor(2) },
    ];
    assertSourceIsInDisplayOrder(source, 'F-1 fixture');

    const writes = ranksForMove(source, 'c', 1);
    assertDeepEqual(
      writes,
      [{ id: 'c', rank: -3 }],
      'F-1: a negative-ranked band yields a rank below the documented MIN_RANK of 1',
    );
    // The resulting order is still correct — the defect is the value, not the
    // ordering — which is precisely why no ordering-only test would catch it.
    assertDeepEqual(orderAfter(source, writes), ['a', 'c', 'b'], 'F-1: order is still honoured');
  }
}

run();
console.log('rank tests passed');
