import { describe, expect, it, vi } from 'vitest';
import '../src/components/inspector/ft-inspector-meta.js';
import type { FarmTableServiceClient } from '../src/gen/service.js';
import type { Task, User } from '../src/gen/types.js';
import { mount, queryAllDeep, queryDeep, settle, textDeep } from './helpers/dom.js';
import { RecordingClient, task, user } from './helpers/fixtures.js';

class UsersClient extends RecordingClient {
  constructor(private readonly users: User[]) {
    super();
  }

  override async listUsers(): Promise<User[]> {
    return this.users;
  }
}

async function mountMeta(
  users: User[],
  overrides: Partial<Task> = {},
): Promise<HTMLElement> {
  return mount<HTMLElement>('ft-inspector-meta', {
    task: task({ id: 'meta', name: 'Meta task', ...overrides }),
    client: new UsersClient(users) as FarmTableServiceClient,
  });
}

async function openPicker(meta: HTMLElement): Promise<void> {
  queryDeep<HTMLElement>(meta, 'sl-icon-button[label="Add assignee"]')?.click();
  await settle(meta);
}

async function typeAssigneeQuery(meta: HTMLElement, query: string): Promise<void> {
  const input = queryDeep<HTMLElement & { value: string }>(meta, 'sl-input.assignee-input');
  if (!input) throw new Error('assignee input was not rendered');
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle(meta);
}

function optionNames(meta: HTMLElement): string[] {
  return queryAllDeep<HTMLElement>(meta, '.assignee-option').map((option) =>
    (option.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

describe('ft-inspector-meta — assignee picker fuzzy matching', () => {
  it('renders a focused text input when the assignee picker opens', async () => {
    const meta = await mountMeta([user('u1', 'Ada Lovelace')]);
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');

    await openPicker(meta);

    const input = queryDeep<HTMLElement>(meta, 'sl-input.assignee-input');
    expect(input).not.toBeNull();
    expect(focusSpy).toHaveBeenCalledWith();
    expect(focusSpy.mock.contexts).toContain(input);
  });

  it('shows every unassigned user before a query is typed', async () => {
    const meta = await mountMeta(
      [user('u1', 'Ada Lovelace'), user('u2', 'Grace Hopper'), user('u3', 'Linus Torvalds')],
      { assignees: [user('u2', 'Grace Hopper')] },
    );

    await openPicker(meta);

    expect(optionNames(meta)).toEqual(['Ada Lovelace', 'Linus Torvalds']);
  });

  it('filters the picker options as the user types', async () => {
    const meta = await mountMeta([
      user('u1', 'Ada Lovelace'),
      user('u2', 'Grace Hopper'),
      user('u3', 'Linus Torvalds'),
    ]);

    await openPicker(meta);
    await typeAssigneeQuery(meta, 'gh');

    expect(optionNames(meta)).toEqual(['Grace Hopper']);
  });

  it('sorts fuzzy matches by their best score', async () => {
    const meta = await mountMeta([
      user('u1', 'Individual Rapport'),
      user('u2', 'Invoice Report'),
      user('u3', 'Inventory Reporter'),
    ]);

    await openPicker(meta);
    await typeAssigneeQuery(meta, 'inv rpt');

    expect(optionNames(meta)).toEqual(['Invoice Report', 'Inventory Reporter', 'Individual Rapport']);
  });

  it('shows a no-match empty state when the query matches no users', async () => {
    const meta = await mountMeta([user('u1', 'Ada Lovelace')]);

    await openPicker(meta);
    await typeAssigneeQuery(meta, 'zz');

    expect(optionNames(meta)).toEqual([]);
    expect(textDeep(meta)).toContain('No matching users');
  });

  it('clears the query back to the full unassigned list', async () => {
    const meta = await mountMeta([user('u1', 'Ada Lovelace'), user('u2', 'Grace Hopper')]);

    await openPicker(meta);
    await typeAssigneeQuery(meta, 'ada');
    await typeAssigneeQuery(meta, '');

    expect(optionNames(meta)).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });

  it('selects an assignee through the existing task-update event', async () => {
    const meta = await mountMeta([user('u1', 'Ada Lovelace'), user('u2', 'Grace Hopper')], {
      assignees: [user('u1', 'Ada Lovelace')],
    });
    const updates: unknown[] = [];
    meta.addEventListener('task-update', (event) => {
      updates.push((event as CustomEvent).detail);
    });

    await openPicker(meta);
    queryAllDeep<HTMLElement>(meta, '.assignee-option')[0].click();
    await settle(meta);

    expect(updates).toEqual([{ taskId: 'meta', fields: { assigneeIds: ['u1', 'u2'] } }]);
    expect(queryDeep(meta, '.assignee-picker')).toBeNull();
  });

  it('keeps Escape cancellation working', async () => {
    const meta = await mountMeta([user('u1', 'Ada Lovelace')]);

    await openPicker(meta);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(meta);

    expect(queryDeep(meta, '.assignee-picker')).toBeNull();
  });

  it('keeps outside-click cancellation working', async () => {
    const meta = await mountMeta([user('u1', 'Ada Lovelace')]);

    await openPicker(meta);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    await settle(meta);

    expect(queryDeep(meta, '.assignee-picker')).toBeNull();
  });
});
