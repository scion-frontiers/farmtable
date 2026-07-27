import { describe, expect, it } from 'vitest';
import '../src/components/ft-toolbar.js';
import { AvailabilityReason, TaskHoldReason, TaskStage } from '../src/gen/types.js';
import {
  ATTENTION,
  AVAILABILITY_REASON_LABEL,
  HOLD_REASON_LABEL,
  NATIVE_STAGE_OPTIONS,
  STAGE_LABEL,
} from '../src/util/task-state-utils.js';
import type { TaskFilterChangeDetail } from '../src/components/task-filters.js';
import { htmlDeep, mount, queryAllDeep, queryDeep, selectValue } from './helpers/dom.js';
import { DELETED_STAGE_LABELS } from './helpers/fixtures.js';

/**
 * Phase-only vocabulary. `Closed` is deliberately absent: it is a legitimate
 * label for the active/closed *group* filter, which the contract requires.
 */
const PHASE_ONLY_LABELS = ['Open', 'In Progress', 'On Hold'];

function selectByPlaceholder(root: Element, placeholder: string): HTMLElement {
  const select = queryDeep<HTMLElement>(root, `sl-select[placeholder="${placeholder}"]`);
  if (!select) throw new Error(`no <sl-select placeholder="${placeholder}"> rendered`);
  return select;
}

function optionsOf(select: Element): { value: string; label: string }[] {
  return queryAllDeep<HTMLElement>(select, 'sl-option').map((option) => ({
    value: option.getAttribute('value') ?? '',
    label: (option.textContent ?? '').trim(),
  }));
}

async function mountToolbar() {
  return mount<HTMLElement>('ft-toolbar', {});
}

describe('ft-toolbar — native phase control contract', () => {
  it('renders no phase-valued control anywhere in its shadow DOM', async () => {
    const toolbar = await mountToolbar();

    expect(htmlDeep(toolbar).toLowerCase()).not.toContain('phase');
  });

  it('offers no user-selectable option carrying raw TaskPhase vocabulary', async () => {
    const toolbar = await mountToolbar();

    const labels = queryAllDeep<HTMLElement>(toolbar, 'sl-option').map((o) => (o.textContent ?? '').trim());

    for (const phaseLabel of PHASE_ONLY_LABELS) {
      expect(labels).not.toContain(phaseLabel);
    }
  });

  it('emits filter-change payloads that carry no phase key', async () => {
    const toolbar = await mountToolbar();
    const payloads: TaskFilterChangeDetail[] = [];
    toolbar.addEventListener('filter-change', (e) => payloads.push((e as CustomEvent).detail));

    for (const placeholder of ['Group', 'Stage', 'Hold', 'Availability', 'Assignee']) {
      const select = selectByPlaceholder(toolbar, placeholder);
      const firstOption = queryDeep<HTMLElement>(select, 'sl-option');
      await selectValue(select, firstOption?.getAttribute('value') ?? '');
    }

    expect(payloads).toHaveLength(5);
    for (const payload of payloads) {
      expect(Object.keys(payload).sort()).toEqual([
        'assigneeId',
        'availability',
        'group',
        'holdReason',
        'stage',
      ]);
      expect(payload).not.toHaveProperty('phase');
    }
  });
});

describe('ft-toolbar — group filter', () => {
  it('renders the active/closed group filter that replaced the phase filter', async () => {
    const toolbar = await mountToolbar();

    expect(optionsOf(selectByPlaceholder(toolbar, 'Group'))).toEqual([
      { value: 'active', label: 'Active' },
      { value: 'closed', label: 'Closed' },
    ]);
  });

  it('emits the selected group in the filter-change payload', async () => {
    const toolbar = await mountToolbar();
    const payloads: TaskFilterChangeDetail[] = [];
    toolbar.addEventListener('filter-change', (e) => payloads.push((e as CustomEvent).detail));

    await selectValue(selectByPlaceholder(toolbar, 'Group'), 'closed');

    expect(payloads).toEqual([
      { group: 'closed', stage: null, holdReason: null, availability: null, assigneeId: null },
    ]);
  });
});

describe('ft-toolbar — stage filter', () => {
  it('renders exactly the ten native stages as options', async () => {
    const toolbar = await mountToolbar();

    expect(optionsOf(selectByPlaceholder(toolbar, 'Stage'))).toEqual(
      NATIVE_STAGE_OPTIONS.map((stage) => ({ value: String(stage), label: STAGE_LABEL[stage] })),
    );
    expect(NATIVE_STAGE_OPTIONS).toHaveLength(10);
  });

  it('offers no deleted stage vocabulary as a selectable option', async () => {
    const toolbar = await mountToolbar();

    const labels = optionsOf(selectByPlaceholder(toolbar, 'Stage')).map((o) => o.label);
    for (const deleted of DELETED_STAGE_LABELS) {
      expect(labels).not.toContain(deleted);
    }
  });

  it('emits the selected stage as a numeric TaskStage', async () => {
    const toolbar = await mountToolbar();
    const payloads: TaskFilterChangeDetail[] = [];
    toolbar.addEventListener('filter-change', (e) => payloads.push((e as CustomEvent).detail));

    await selectValue(selectByPlaceholder(toolbar, 'Stage'), String(TaskStage.IN_QA));

    expect(payloads[0].stage).toBe(TaskStage.IN_QA);
  });
});

describe('ft-toolbar — hold reason filter', () => {
  it('renders exactly the two valid hold reasons', async () => {
    const toolbar = await mountToolbar();

    expect(optionsOf(selectByPlaceholder(toolbar, 'Hold'))).toEqual([
      { value: String(TaskHoldReason.WAITING_FOR_INPUT), label: HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT] },
      { value: String(TaskHoldReason.DEFERRED), label: HOLD_REASON_LABEL[TaskHoldReason.DEFERRED] },
    ]);
  });

  it('emits the selected hold reason as a numeric TaskHoldReason', async () => {
    const toolbar = await mountToolbar();
    const payloads: TaskFilterChangeDetail[] = [];
    toolbar.addEventListener('filter-change', (e) => payloads.push((e as CustomEvent).detail));

    await selectValue(selectByPlaceholder(toolbar, 'Hold'), String(TaskHoldReason.DEFERRED));

    expect(payloads[0].holdReason).toBe(TaskHoldReason.DEFERRED);
  });

  it('shows the current hold filter as the select value', async () => {
    const toolbar = await mount<HTMLElement>('ft-toolbar', {
      holdReasonFilter: TaskHoldReason.WAITING_FOR_INPUT,
    });

    expect(selectByPlaceholder(toolbar, 'Hold').getAttribute('value')).toBe(
      String(TaskHoldReason.WAITING_FOR_INPUT),
    );
  });
});

describe('ft-toolbar — availability filter', () => {
  it('renders available/unavailable plus one option per availability reason', async () => {
    const toolbar = await mountToolbar();

    // The values and their ORDER are the toolbar's own spec and stay literal.
    // The labels belong to production's `AVAILABILITY_REASON_LABEL`, so they
    // are read from it rather than transcribed; the words are anchored once,
    // in `vocabulary.contract.test.ts`.
    const label = (reason: AvailabilityReason) => AVAILABILITY_REASON_LABEL[reason];
    expect(optionsOf(selectByPlaceholder(toolbar, 'Availability'))).toEqual([
      { value: 'available', label: 'Available' },
      { value: 'unavailable', label: 'Unavailable' },
      { value: '1', label: label(AvailabilityReason.TRIAGE) },
      { value: '3', label: label(AvailabilityReason.HELD) },
      { value: '4', label: label(AvailabilityReason.BLOCKED_BY_DEPENDENCY) },
      // Directly under the reason it narrows — attention tasks are the subset
      // of dependency-blocked tasks whose blocker will never close well. The
      // words come from production; they are anchored in the vocabulary file.
      { value: 'attention', label: ATTENTION.label },
      { value: '5', label: label(AvailabilityReason.FUTURE_START_DATE) },
      { value: '2', label: label(AvailabilityReason.TERMINAL) },
    ]);
  });

  /**
   * Contract §10's attention view has to be REACHABLE, and the Availability
   * dropdown is where a user looking for blocked work already goes. Asserting
   * on the option list above proves it is rendered; this proves selecting it
   * produces the filter value the rest of the app understands, rather than
   * `NaN` — which is what `parseAvailabilityFilter` returns for any string it
   * does not know about, and which would silently match nothing.
   */
  it('emits the attention refinement as a string, not as a parsed number', async () => {
    const toolbar = await mountToolbar();
    const payloads: TaskFilterChangeDetail[] = [];
    toolbar.addEventListener('filter-change', (e) => payloads.push((e as CustomEvent).detail));

    await selectValue(selectByPlaceholder(toolbar, 'Availability'), 'attention');

    expect(payloads[0].availability).toBe('attention');
  });

  it('emits string availability filters unchanged and reason filters as numbers', async () => {
    const toolbar = await mountToolbar();
    const payloads: TaskFilterChangeDetail[] = [];
    toolbar.addEventListener('filter-change', (e) => payloads.push((e as CustomEvent).detail));

    const select = selectByPlaceholder(toolbar, 'Availability');
    await selectValue(select, 'available');
    await selectValue(select, '4');
    await selectValue(select, '');

    expect(payloads.map((p) => p.availability)).toEqual(['available', 4, null]);
  });
});
