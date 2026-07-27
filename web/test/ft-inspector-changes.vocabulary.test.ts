import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-changes.js';
import { MockFarmTableClient } from '../src/gen/service.js';
import type { FarmTableServiceClient } from '../src/gen/service.js';
import type { Change } from '../src/gen/types.js';
import { IdentityStatus, UserType } from '../src/gen/types.js';
import { STAGE_LABEL } from '../src/util/task-state-utils.js';
import { mount, queryAllDeep, queryDeep, settle, textDeep } from './helpers/dom.js';
import { DELETED_STAGE_LABELS } from './helpers/fixtures.js';

const VALID_STAGE_LABELS = Object.values(STAGE_LABEL);

/** Mount the change-history section and expand it so changes are fetched. */
async function mountChanges(taskId: string, client: FarmTableServiceClient) {
  const element = await mount<HTMLElement>('ft-inspector-changes', { taskId, client });
  const details = queryDeep<HTMLElement>(element, 'sl-details');
  if (!details) throw new Error('ft-inspector-changes rendered no sl-details section');
  details.dispatchEvent(new CustomEvent('sl-show', { bubbles: true, composed: true }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  await settle(element);
  return element;
}

interface RenderedEntry {
  field: string;
  values: string;
}

function renderedEntries(element: Element): RenderedEntry[] {
  return queryAllDeep<HTMLElement>(element, '.entry').map((entry) => ({
    field: (entry.querySelector('.field-name')?.textContent ?? '').trim(),
    values: (entry.querySelector('.entry-values')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

function stageWords(values: string): string[] {
  return values
    .split('→')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '—');
}

describe('ft-inspector-changes — deleted stage vocabulary', () => {
  it('renders no deleted stage vocabulary for any mock task change history', async () => {
    const client = new MockFarmTableClient();
    const tasks = await client.listTasks();

    for (const task of tasks) {
      const element = await mountChanges(task.id, client);
      const stageEntries = renderedEntries(element).filter((entry) => entry.field === 'stage');

      for (const entry of stageEntries) {
        for (const deleted of DELETED_STAGE_LABELS) {
          expect(
            stageWords(entry.values),
            `task ${task.id} change history renders deleted stage "${deleted}"`,
          ).not.toContain(deleted);
        }
      }
      element.remove();
    }
  });

  it('renders only valid native stage labels as stage change values', async () => {
    const client = new MockFarmTableClient();
    const tasks = await client.listTasks();

    for (const task of tasks) {
      const element = await mountChanges(task.id, client);
      const stageEntries = renderedEntries(element).filter((entry) => entry.field === 'stage');

      for (const entry of stageEntries) {
        for (const word of stageWords(entry.values)) {
          expect(VALID_STAGE_LABELS, `task ${task.id} stage change value "${word}"`).toContain(word);
        }
      }
      element.remove();
    }
  });

  it('still renders hold-reason vocabulary, which remains valid', async () => {
    const holdChange: Change = {
      id: 'ch-hold',
      taskId: 'task-hold',
      field: 'hold_reason',
      oldValue: 'Deferred',
      newValue: 'Waiting for input',
      changedBy: { id: 'u1', name: 'Alice', type: UserType.HUMAN, status: IdentityStatus.ACTIVE },
      changedAt: '2026-01-01T00:00:00.000Z',
    };
    const client = {
      ...new MockFarmTableClient(),
      listChanges: async () => [holdChange],
    } as unknown as FarmTableServiceClient;

    const element = await mountChanges('task-hold', client);

    expect(textDeep(element)).toContain('Waiting for input');
    expect(textDeep(element)).toContain('Deferred');
  });
});
