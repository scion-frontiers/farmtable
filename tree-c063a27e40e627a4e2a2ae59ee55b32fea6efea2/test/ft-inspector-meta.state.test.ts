import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-meta.js';
import { AvailabilityReason, TaskHoldReason, type Task } from '../src/gen/types.js';
import {
  AVAILABILITY_REASON_LABEL,
  availabilityLabel,
  holdReasonLabel,
} from '../src/util/task-state-utils.js';
import { mount, queryAllDeep } from './helpers/dom.js';
import { task, user } from './helpers/fixtures.js';

/**
 * Rendered coverage of the task-state contract in the inspector meta panel:
 * the Hold, Availability and Rank rows (finding H-2).
 *
 * Every row is queried *by its own label cell*, and every assertion reads that
 * row's `span.value`. `textDeep(meta)` is never used for a value claim: the
 * word "None" is produced by four different rows (Hold, Rank, Labels, and the
 * date cells' own empty state), so a whole-subtree text assertion would let any
 * one of them answer for any other.
 */

/** The `span.value` of the `.row` whose `.label` cell reads exactly `label`. */
function rowValue(meta: Element, label: string): HTMLElement | null {
  for (const row of queryAllDeep<HTMLElement>(meta, '.row')) {
    const cell = row.querySelector('.label');
    if ((cell?.textContent ?? '').trim() === label) {
      return row.querySelector<HTMLElement>('.value');
    }
  }
  return null;
}

/** Whitespace-collapsed text of one row's value cell. Throws if the row is gone. */
function rowText(meta: Element, label: string): string {
  const value = rowValue(meta, label);
  if (!value) throw new Error(`no "${label}" row is rendered`);
  return (value.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The row's own italic empty placeholder, or null when the row has a value. */
function rowEmpty(meta: Element, label: string): HTMLElement | null {
  return rowValue(meta, label)?.querySelector<HTMLElement>('.empty') ?? null;
}

async function mountMeta(overrides: Partial<Task> = {}): Promise<HTMLElement> {
  return mount<HTMLElement>('ft-inspector-meta', {
    task: task({ id: 'meta', name: 'Meta task', ...overrides }),
  });
}

describe('ft-inspector-meta — Hold row', () => {
  for (const reason of [TaskHoldReason.WAITING_FOR_INPUT, TaskHoldReason.DEFERRED]) {
    it(`shows the holdReasonLabel text in the Hold row for ${TaskHoldReason[reason]}`, async () => {
      const expected = holdReasonLabel(reason);
      expect(expected, 'guard: the reason under test has a real label').not.toBe('');

      const meta = await mountMeta({ holdReason: reason });

      expect(rowText(meta, 'Hold')).toBe(expected);
      // Positive counterpart to the empty-state tests: a populated Hold row
      // renders no placeholder at all.
      expect(rowEmpty(meta, 'Hold')).toBeNull();
    });
  }

  it('shows an italic "None" placeholder in the Hold row when no hold reason is set', async () => {
    const meta = await mountMeta({});

    const empty = rowEmpty(meta, 'Hold');
    expect(empty).not.toBeNull();
    expect((empty!.textContent ?? '').trim()).toBe('None');
    expect(rowText(meta, 'Hold')).toBe('None');
  });

  /**
   * `undefined` and the explicit `UNSPECIFIED` zero must render identically —
   * the whole reason `hasHoldReason()` checks both. A `reason !== undefined`
   * guard passes the test above and fails this one.
   */
  it('shows the same "None" placeholder for the explicit UNSPECIFIED zero value', async () => {
    const meta = await mountMeta({ holdReason: TaskHoldReason.UNSPECIFIED });

    const empty = rowEmpty(meta, 'Hold');
    expect(empty).not.toBeNull();
    expect((empty!.textContent ?? '').trim()).toBe('None');
  });
});

describe('ft-inspector-meta — Availability row', () => {
  /**
   * Pins *which* placeholder belongs to *which* field. Hold and Availability
   * use different empty wordings ("None" vs "Not reported"), and asserting them
   * in the same render is what stops the two from being swapped.
   */
  it('shows "Not reported" for Availability and "None" for Hold when the server sent neither', async () => {
    const meta = await mountMeta({});

    expect(rowText(meta, 'Availability')).toBe('Not reported');
    expect((rowEmpty(meta, 'Availability')?.textContent ?? '').trim()).toBe('Not reported');
    expect(rowText(meta, 'Hold')).toBe('None');
  });

  it('shows the availabilityLabel text when the server reports the task available', async () => {
    const available = task({
      id: 'meta',
      name: 'Meta task',
      availability: { available: true, reasons: [] },
    });
    const meta = await mount<HTMLElement>('ft-inspector-meta', { task: available });

    expect(rowText(meta, 'Availability')).toBe(availabilityLabel(available));
    // Positive counterpart: a reported availability renders no placeholder.
    expect(rowEmpty(meta, 'Availability')).toBeNull();
  });

  it('shows the joined reason labels when the server reports the task unavailable', async () => {
    const blocked = task({
      id: 'meta',
      name: 'Meta task',
      availability: {
        available: false,
        reasons: [AvailabilityReason.HELD, AvailabilityReason.BLOCKED_BY_DEPENDENCY],
      },
    });
    const meta = await mount<HTMLElement>('ft-inspector-meta', { task: blocked });

    const text = rowText(meta, 'Availability');
    expect(text).toBe(availabilityLabel(blocked));
    expect(rowEmpty(meta, 'Availability')).toBeNull();
    // Independent anchor on the wording, from the real label map: a label
    // function collapsed to a constant cannot satisfy this.
    for (const reason of blocked.availability!.reasons) {
      expect(text).toContain(AVAILABILITY_REASON_LABEL[reason]);
    }
  });

  /**
   * Relational, on purpose: `toBe(availabilityLabel(t))` moves in lockstep with
   * the function under test, so available and unavailable are compared to each
   * other. One constant cannot serve both.
   */
  it('does not show an available and an unavailable task the same Availability text', async () => {
    const availableMeta = await mountMeta({ availability: { available: true, reasons: [] } });
    const unavailableMeta = await mountMeta({
      availability: { available: false, reasons: [AvailabilityReason.FUTURE_START_DATE] },
    });

    expect(rowText(availableMeta, 'Availability')).not.toBe(
      rowText(unavailableMeta, 'Availability'),
    );
  });

  /**
   * `AvailabilityReason.UNSPECIFIED` (0) is filtered out before the join.
   * Asserted as an equality between two renders — padding the wire payload with
   * a zero must not change what the user reads. Drop the filter and the padded
   * render gains a stray "0".
   */
  it('renders an UNSPECIFIED reason identically to it not being sent at all', async () => {
    const cleanTask = task({
      id: 'clean',
      name: 'Meta task',
      availability: { available: false, reasons: [AvailabilityReason.TERMINAL] },
    });
    const padded = await mountMeta({
      id: 'padded',
      availability: {
        available: false,
        reasons: [AvailabilityReason.UNSPECIFIED, AvailabilityReason.TERMINAL],
      },
    });
    const clean = await mount<HTMLElement>('ft-inspector-meta', { task: cleanTask });

    expect(rowText(clean, 'Availability')).toBe(availabilityLabel(cleanTask));
    expect(rowText(padded, 'Availability')).toBe(rowText(clean, 'Availability'));
  });

  /**
   * Degenerate case of the same filter: a list of nothing but UNSPECIFIED must
   * read like an empty list, not leak the enum number 0 into the panel.
   */
  it('renders a reasons list of only UNSPECIFIED identically to an empty reasons list', async () => {
    const onlyUnspecified = await mountMeta({
      id: 'only-unspecified',
      availability: { available: false, reasons: [AvailabilityReason.UNSPECIFIED] },
    });
    const noReasons = await mountMeta({
      id: 'no-reasons',
      availability: { available: false, reasons: [] },
    });

    expect(rowText(onlyUnspecified, 'Availability')).toBe(rowText(noReasons, 'Availability'));
    expect(rowText(onlyUnspecified, 'Availability')).not.toContain('0');
  });
});

describe('ft-inspector-meta — Rank row', () => {
  it('shows the rank value in the Rank row when the task is ranked', async () => {
    const meta = await mountMeta({ rank: 7 });

    expect(rowText(meta, 'Rank')).toBe('7');
    expect(rowEmpty(meta, 'Rank')).toBeNull();
  });

  it('shows an italic "None" placeholder in the Rank row when the task is unranked', async () => {
    const meta = await mountMeta({});

    const empty = rowEmpty(meta, 'Rank');
    expect(empty).not.toBeNull();
    expect((empty!.textContent ?? '').trim()).toBe('None');
  });

  /**
   * Rank 0 is a falsy-but-valid value: it is the *top* of a priority band, not
   * "unranked". The template guards with `t.rank ?? …` (nullish), which renders
   * it; a `t.rank && …` guard would silently swallow it and show "None"
   * instead — the classic falsy-zero bug. This test pins the correct behaviour
   * so the guard cannot be "simplified" back into the bug.
   */
  it('shows rank 0 as a real value rather than treating it as unranked', async () => {
    const meta = await mountMeta({ rank: 0 });

    expect(rowText(meta, 'Rank')).toBe('0');
    expect(rowEmpty(meta, 'Rank')).toBeNull();
  });
});

describe('ft-inspector-meta — state rows do not borrow text from one another', () => {
  /**
   * Three rows can each read "None"/"Not reported". This asserts all three
   * state rows in one fully-populated render, so a template that pointed two
   * rows at the same expression — or dropped one row entirely and let a
   * neighbour satisfy a loose text search — cannot pass.
   */
  it('renders Hold, Availability and Rank as three independently-populated rows', async () => {
    const populated = task({
      id: 'meta',
      name: 'Meta task',
      assignees: [user('u1', 'Ada')],
      labels: ['infra'],
      holdReason: TaskHoldReason.DEFERRED,
      rank: 3,
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const meta = await mount<HTMLElement>('ft-inspector-meta', { task: populated });

    expect(rowText(meta, 'Hold')).toBe(holdReasonLabel(TaskHoldReason.DEFERRED));
    expect(rowText(meta, 'Availability')).toBe(availabilityLabel(populated));
    expect(rowText(meta, 'Rank')).toBe('3');
    // No state row falls back to a placeholder when every field is populated.
    expect(rowEmpty(meta, 'Hold')).toBeNull();
    expect(rowEmpty(meta, 'Availability')).toBeNull();
    expect(rowEmpty(meta, 'Rank')).toBeNull();
    // The Labels row is populated too, so its own "None" cannot be mistaken
    // for the Hold or Rank placeholder in any later refactor.
    expect(rowEmpty(meta, 'Labels')).toBeNull();
  });

  /**
   * The all-empty mirror image: each state row shows its *own* placeholder, and
   * the Labels/Assignees rows show theirs. Together with the test above this
   * fixes which wording belongs to which field in both directions.
   */
  it('renders the placeholder belonging to each individual row when nothing is populated', async () => {
    const meta = await mountMeta({});

    expect(rowText(meta, 'Hold')).toBe('None');
    expect(rowText(meta, 'Availability')).toBe('Not reported');
    expect(rowText(meta, 'Rank')).toBe('None');
    expect(rowText(meta, 'Labels')).toContain('None');
    expect(rowText(meta, 'Assignees')).toContain('Unassigned');
  });
});
