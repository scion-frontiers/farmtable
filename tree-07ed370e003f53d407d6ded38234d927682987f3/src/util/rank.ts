/**
 * Sparse integer rank arithmetic for intra-band queue reordering.
 *
 * Design contract §4.6: rank scope is (collection, priority band), the server
 * stores an absolute integer per task and does no re-ranking of its own, and
 * "the design must not depend on dense ranks". So ranks are spaced widely
 * (`RANK_STEP`) and a move normally writes a single task: the midpoint between
 * its two new neighbours. The whole band is renumbered only when that midpoint
 * does not exist — either the gap is exhausted or the band is not fully ranked
 * yet.
 *
 * Pure module on purpose: no DOM, no network, no store. All the ordering maths
 * is unit-tested in `rank.test.ts` without mounting a component.
 */

/** Spacing between ranks after a renumber, and the gap claimed at either end. */
export const RANK_STEP = 1024;

/** The minimum rank this module will hand out. Ranks stay positive integers. */
export const MIN_RANK = 1;

/**
 * Whether a rank read back from the server can anchor arithmetic.
 *
 * `Number.isSafeInteger` alone is not enough: zero and negatives are safe
 * integers, so a hostile band like `[-5, 0, 5]` used to sail past the guard in
 * `singleWrite` and the interior-midpoint branch then handed out `-3` — below
 * the floor this module documents. Anything outside the range is treated the
 * same way as a float or a NaN: not an anchor, so the band falls through to
 * `renumber()` and comes back inside the invariant.
 */
function isUsableRank(rank: number | undefined): rank is number {
  return Number.isSafeInteger(rank) && (rank as number) >= MIN_RANK;
}

/** A task as this module needs to see it: an identity and maybe a rank. */
export interface RankedItem {
  id: string;
  rank?: number;
}

/** A rank that must be written back to the server for one task. */
export interface RankWrite {
  id: string;
  rank: number;
}

/**
 * Ranks to write so that `movedId` sits at `targetIndex` within `band`.
 *
 * `band` must be a single priority band of a single collection, already in the
 * order the user currently sees (`compareAcceptedQueueOrder`). `targetIndex` is
 * the index the moved item should occupy in the resulting order.
 *
 * Returns the minimum set of writes: one entry for the common case, `[]` when
 * the move changes nothing, and one entry per *changed* task when the band has
 * to be renumbered.
 */
export function ranksForMove(
  band: readonly RankedItem[],
  movedId: string,
  targetIndex: number,
): RankWrite[] {
  const fromIndex = band.findIndex((item) => item.id === movedId);
  if (fromIndex === -1) return [];

  const toIndex = clamp(targetIndex, 0, band.length - 1);
  if (toIndex === fromIndex) return [];

  const order = band.filter((_, index) => index !== fromIndex);
  order.splice(toIndex, 0, band[fromIndex]);

  // Defensive: a reordering that reproduces the current order is still a no-op.
  if (order.every((item, index) => item.id === band[index].id)) return [];

  const single = singleWrite(order, toIndex);
  return single ? [single] : renumber(order);
}

/**
 * The one write that expresses this move, or `null` when no such write exists.
 *
 * A single write is only sound when every *other* item in the band already
 * carries an in-range rank and those ranks are strictly increasing in display
 * order — otherwise the untouched items would not hold the order the user just
 * dropped (unranked tasks sort last by `created_at`, so they cannot anchor
 * anything), or the midpoint between them would itself be out of range.
 */
function singleWrite(order: readonly RankedItem[], index: number): RankWrite | null {
  const others = order.filter((_, i) => i !== index);
  for (let i = 0; i < others.length; i++) {
    const rank = others[i].rank;
    if (!isUsableRank(rank)) return null;
    if (i > 0 && !(others[i - 1].rank! < rank)) return null;
  }

  const before = order[index - 1]?.rank;
  const after = order[index + 1]?.rank;

  const rank = midpoint(before, after);
  if (rank === null) return null;
  return { id: order[index].id, rank };
}

/**
 * An integer strictly between `before` and `after`, or `null` when the gap is
 * exhausted. Either bound may be absent, meaning "this is an end of the band".
 *
 * Callers guarantee that any bound present satisfies `isUsableRank`, which is
 * what keeps the result at or above `MIN_RANK`: the interior branch returns
 * something strictly greater than `before >= MIN_RANK`, and the tail branch
 * only ever counts upwards. The head branch has no lower bound to lean on and
 * so checks the floor itself.
 */
function midpoint(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined && after === undefined) return null;

  if (before === undefined) {
    // Head of the band: claim a full step below the current first rank, or
    // halve it when there is less than a step of room left above zero.
    const candidate = after! > RANK_STEP ? after! - RANK_STEP : Math.floor(after! / 2);
    return candidate >= MIN_RANK ? candidate : null;
  }

  if (after === undefined) {
    // Tail of the band: a full step past the current last rank.
    const candidate = before + RANK_STEP;
    return Number.isSafeInteger(candidate) ? candidate : null;
  }

  const candidate = Math.floor((before + after) / 2);
  return candidate > before && candidate < after ? candidate : null;
}

/**
 * Re-space the whole band evenly and return only the tasks whose rank actually
 * changes, so an already-correct neighbour is never written for nothing.
 */
function renumber(order: readonly RankedItem[]): RankWrite[] {
  const writes: RankWrite[] = [];
  for (let i = 0; i < order.length; i++) {
    const rank = (i + 1) * RANK_STEP;
    if (order[i].rank !== rank) writes.push({ id: order[i].id, rank });
  }
  return writes;
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.max(low, Math.min(high, Math.trunc(value)));
}
