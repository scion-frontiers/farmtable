import { describe, expect, it } from 'vitest';
import '../src/components/ft-filter-chips.js';
import { AvailabilityReason, TaskHoldReason, TaskStage } from '../src/gen/types.js';
import { UNASSIGNED_FILTER_VALUE } from '../src/components/task-filters.js';
import {
  ATTENTION,
  AVAILABILITY_REASON_LABEL,
  HOLD_REASON_LABEL,
  STAGE_LABEL,
} from '../src/util/task-state-utils.js';
import type { TaskFilterChangeDetail } from '../src/components/task-filters.js';
import { mount, queryAllDeep, removeTag, textDeep } from './helpers/dom.js';
import { user } from './helpers/fixtures.js';

const ALL_FILTERS = {
  groupFilter: 'active',
  stageFilter: TaskStage.IN_QA,
  holdReasonFilter: TaskHoldReason.WAITING_FOR_INPUT,
  availabilityFilter: AvailabilityReason.BLOCKED_BY_DEPENDENCY,
  assigneeFilter: 'u1',
  users: [user('u1', 'Alice')],
  filteredCount: 3,
  totalCount: 12,
};

function chipLabels(element: Element): string[] {
  return queryAllDeep<HTMLElement>(element, 'sl-tag').map((tag) =>
    (tag.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

function chipByPrefix(element: Element, prefix: string): Element {
  const tag = queryAllDeep<HTMLElement>(element, 'sl-tag').find((candidate) =>
    (candidate.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(prefix),
  );
  if (!tag) throw new Error(`no chip starting with "${prefix}" (rendered: ${chipLabels(element).join(' | ')})`);
  return tag;
}

describe('ft-filter-chips — rendered chips', () => {
  it('renders nothing and hides itself when no filter is active', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', { filteredCount: 5, totalCount: 5 });

    expect(queryAllDeep(chips, 'sl-tag')).toHaveLength(0);
    expect(chips.hidden).toBe(true);
  });

  it('renders one labelled chip per active filter', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);

    // Prefixes are this component's own spec; the vocabulary after the colon
    // is production's, so it is read from the real maps. The words themselves
    // are anchored once, in `vocabulary.contract.test.ts`.
    expect(chipLabels(chips)).toEqual([
      'Group: Active',
      `Stage: ${STAGE_LABEL[TaskStage.IN_QA]}`,
      `Hold: ${HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT]}`,
      `Availability: ${AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY]}`,
      'Assignee: Alice',
    ]);
  });

  it('labels the deferred hold reason', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', {
      holdReasonFilter: TaskHoldReason.DEFERRED,
    });

    expect(chipLabels(chips)).toEqual([
      `Hold: ${HOLD_REASON_LABEL[TaskHoldReason.DEFERRED]}`,
    ]);
  });

  it('labels string availability filters', async () => {
    const available = await mount<HTMLElement>('ft-filter-chips', { availabilityFilter: 'available' });
    expect(chipLabels(available)).toEqual(['Availability: Available']);

    const unavailable = await mount<HTMLElement>('ft-filter-chips', { availabilityFilter: 'unavailable' });
    expect(chipLabels(unavailable)).toEqual(['Availability: Unavailable']);
  });

  /**
   * `'attention'` is the third string-valued availability filter, and the one
   * most likely to be forgotten: the reason map is keyed by number, so a string
   * that has no explicit branch falls through to `String(filter)` and the user
   * is shown the raw value `attention` instead of words. The words come from
   * production and are anchored in `vocabulary.contract.test.ts`.
   */
  it('labels the attention refinement in the same words as the badge and the filter option', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', { availabilityFilter: 'attention' });

    expect(chipLabels(chips)).toEqual([`Availability: ${ATTENTION.label}`]);
  });

  it('labels the unassigned sentinel as Unassigned', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', {
      assigneeFilter: UNASSIGNED_FILTER_VALUE,
    });

    expect(chipLabels(chips)).toEqual(['Assignee: Unassigned']);
  });

  it('renders the filtered/total task count', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);

    expect(textDeep(chips)).toContain('3 of 12 tasks');
  });
});

describe('ft-filter-chips — clearing', () => {
  /**
   * M-4. Every clearing test below fires `sl-remove` through `removeTag()`,
   * which dispatches the event on any element whatsoever. A real `<sl-tag>`
   * only renders the remove button — and therefore only ever emits
   * `sl-remove` — when `removable` is set, so dropping the attribute from all
   * five chips left every clearing test green while making the chips
   * unclearable for an actual user. This is the assertion that closes that gap;
   * `removable` is in the stub's `BOOLEAN_PROPS`, so it reflects the attribute.
   */
  it('renders every chip removable, so the remove button a user clicks exists', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);
    const tags = queryAllDeep<HTMLElement & { removable?: boolean }>(chips, 'sl-tag');

    // Pin the count: a component rendering zero chips would otherwise satisfy
    // the loop below without asserting anything.
    expect(tags).toHaveLength(5);
    for (const tag of tags) {
      expect(tag.removable, `chip "${(tag.textContent ?? '').trim()}" is not removable`).toBe(true);
    }
  });

  it('clears only the removed filter and preserves the rest', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);
    const cleared: TaskFilterChangeDetail[] = [];
    chips.addEventListener('filter-clear', (e) => cleared.push((e as CustomEvent).detail));

    await removeTag(chipByPrefix(chips, 'Hold:'));

    expect(cleared).toEqual([
      {
        group: 'active',
        stage: TaskStage.IN_QA,
        holdReason: null,
        availability: AvailabilityReason.BLOCKED_BY_DEPENDENCY,
        assigneeId: 'u1',
      },
    ]);
  });

  it('clears the availability filter from its chip', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);
    const cleared: TaskFilterChangeDetail[] = [];
    chips.addEventListener('filter-clear', (e) => cleared.push((e as CustomEvent).detail));

    await removeTag(chipByPrefix(chips, 'Availability:'));

    expect(cleared[0].availability).toBeNull();
    expect(cleared[0].holdReason).toBe(TaskHoldReason.WAITING_FOR_INPUT);
  });

  it('offers Clear all only once two or more filters are active', async () => {
    const single = await mount<HTMLElement>('ft-filter-chips', { groupFilter: 'active' });
    expect(queryAllDeep<HTMLElement>(single, 'sl-button')).toHaveLength(0);

    const many = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);
    const clearAll = queryAllDeep<HTMLElement>(many, 'sl-button');
    expect(clearAll).toHaveLength(1);
    expect((clearAll[0].textContent ?? '').trim()).toBe('Clear all');
  });

  it('clears every filter from the Clear all button', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);
    const cleared: TaskFilterChangeDetail[] = [];
    chips.addEventListener('filter-clear', (e) => cleared.push((e as CustomEvent).detail));

    queryAllDeep<HTMLElement>(chips, 'sl-button')[0].click();

    expect(cleared).toEqual([
      { group: null, stage: null, holdReason: null, availability: null, assigneeId: null },
    ]);
  });

  it('emits filter-clear payloads that carry no phase key', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', ALL_FILTERS);
    const cleared: TaskFilterChangeDetail[] = [];
    chips.addEventListener('filter-clear', (e) => cleared.push((e as CustomEvent).detail));

    await removeTag(chipByPrefix(chips, 'Group:'));

    expect(cleared[0]).not.toHaveProperty('phase');
    expect(Object.keys(cleared[0]).sort()).toEqual([
      'assigneeId',
      'availability',
      'group',
      'holdReason',
      'stage',
    ]);
  });
});
