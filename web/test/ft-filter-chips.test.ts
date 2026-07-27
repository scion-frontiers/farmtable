import { describe, expect, it } from 'vitest';
import '../src/components/ft-filter-chips.js';
import { AvailabilityReason, TaskHoldReason, TaskStage } from '../src/gen/types.js';
import { UNASSIGNED_FILTER_VALUE } from '../src/components/task-filters.js';
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

    expect(chipLabels(chips)).toEqual([
      'Group: Active',
      'Stage: In QA',
      'Hold: Waiting for input',
      'Availability: Blocked by dependency',
      'Assignee: Alice',
    ]);
  });

  it('labels the deferred hold reason', async () => {
    const chips = await mount<HTMLElement>('ft-filter-chips', {
      holdReasonFilter: TaskHoldReason.DEFERRED,
    });

    expect(chipLabels(chips)).toEqual(['Hold: Deferred']);
  });

  it('labels string availability filters', async () => {
    const available = await mount<HTMLElement>('ft-filter-chips', { availabilityFilter: 'available' });
    expect(chipLabels(available)).toEqual(['Availability: Available']);

    const unavailable = await mount<HTMLElement>('ft-filter-chips', { availabilityFilter: 'unavailable' });
    expect(chipLabels(unavailable)).toEqual(['Availability: Unavailable']);
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
