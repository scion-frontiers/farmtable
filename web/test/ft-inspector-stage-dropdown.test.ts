import { describe, expect, it } from 'vitest';
import '../src/components/inspector/ft-inspector-header.js';
import '../src/components/inspector/ft-inspector.js';
import { TaskStage, type Task } from '../src/gen/types.js';
import { ALL_ENABLED } from '../src/capabilities.js';
import { STAGE_LABEL } from '../src/util/task-state-utils.js';
import { flush, mount, queryAllDeep, queryDeep, selectValue, settle } from './helpers/dom.js';
import { RecordingClient, storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

async function mountHeader(overrides: Partial<Task> = {}): Promise<HTMLElement> {
  return mount<HTMLElement>('ft-inspector-header', {
    task: task({ id: 'stage-hdr', name: 'Stage task', stage: TaskStage.ACCEPTED, ...overrides }),
    capabilities: ALL_ENABLED,
  });
}

async function openStageSelect(header: HTMLElement): Promise<Element> {
  const button = queryDeep<HTMLButtonElement>(header, 'button.stage-button');
  if (!button) throw new Error('no stage edit button rendered');
  button.click();
  await settle(header);

  const select = queryDeep<Element>(header, 'sl-select.stage-select');
  if (!select) throw new Error('no stage select rendered');
  return select;
}

async function mountInspector(store: TaskStore, taskId = 't1') {
  const client = new RecordingClient(store);
  const inspector = await mount<HTMLElement>('ft-inspector', {
    taskId,
    store,
    client,
    capabilities: ALL_ENABLED,
  });
  return { inspector, client };
}

function closeReasonDialog(root: Element): HTMLElement {
  const dialog = queryDeep<HTMLElement>(root, 'ft-close-reason-dialog');
  if (!dialog) throw new Error('no ft-close-reason-dialog rendered');
  return dialog;
}

function dialogOpen(root: Element): boolean {
  return closeReasonDialog(root).shadowRoot?.querySelector('sl-dialog')?.hasAttribute('open') ?? false;
}

function reasonInput(root: Element): HTMLElement & { value: string } {
  const input = closeReasonDialog(root).shadowRoot?.querySelector('sl-textarea[name="reason"]') as
    | (HTMLElement & { value: string })
    | null;
  if (!input) throw new Error('no reason textarea rendered');
  return input;
}

function submitReason(root: Element, reason: string) {
  reasonInput(root).value = reason;
  const form = closeReasonDialog(root).shadowRoot?.querySelector('form');
  if (!form) throw new Error('no close reason form rendered');
  form.dispatchEvent(new Event('submit', { bubbles: true, composed: true, cancelable: true }));
}

describe('ft-inspector-header — stage dropdown', () => {
  it('swaps the stage badge for a select when clicked', async () => {
    const header = await mountHeader({ stage: TaskStage.TRIAGE });

    const select = await openStageSelect(header);

    expect(select.getAttribute('value')).toBe(String(TaskStage.TRIAGE));
    expect(queryDeep(header, 'button.stage-button')).toBeNull();
  });

  it('dispatches a task-update with stage for non-terminal selections', async () => {
    const header = await mountHeader({ id: 'direct', stage: TaskStage.ACCEPTED });
    const events: CustomEvent[] = [];
    header.addEventListener('task-update', (e) => events.push(e as CustomEvent));

    await selectValue(await openStageSelect(header), String(TaskStage.WORKING));
    await settle(header);

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ taskId: 'direct', fields: { stage: TaskStage.WORKING } });
  });

  it("requests the close reason dialog instead of updating directly for Won't Fix", async () => {
    const header = await mountHeader({ id: 'reasoned', stage: TaskStage.ACCEPTED });
    const updates: CustomEvent[] = [];
    const closeRequests: CustomEvent[] = [];
    header.addEventListener('task-update', (e) => updates.push(e as CustomEvent));
    header.addEventListener('stage-close-request', (e) => closeRequests.push(e as CustomEvent));

    await selectValue(await openStageSelect(header), String(TaskStage.WONT_FIX));
    await settle(header);

    expect(updates).toEqual([]);
    expect(closeRequests).toHaveLength(1);
    expect(closeRequests[0].detail).toEqual({
      taskId: 'reasoned',
      stage: TaskStage.WONT_FIX,
      stageLabel: STAGE_LABEL[TaskStage.WONT_FIX],
    });
  });

  it('requests the close reason dialog for Cancelled', async () => {
    const header = await mountHeader({ id: 'cancelled', stage: TaskStage.ACCEPTED });
    const closeRequests: CustomEvent[] = [];
    header.addEventListener('stage-close-request', (e) => closeRequests.push(e as CustomEvent));

    await selectValue(await openStageSelect(header), String(TaskStage.CANCELLED));
    await settle(header);

    expect(closeRequests.map((event) => event.detail.stage)).toEqual([TaskStage.CANCELLED]);
  });

  it('reverts to the task actual stage after a reason-required selection is not confirmed', async () => {
    const header = await mountHeader({ stage: TaskStage.ACCEPTED });

    await selectValue(await openStageSelect(header), String(TaskStage.WONT_FIX));
    await settle(header);

    expect(queryDeep(header, 'sl-select.stage-select')).toBeNull();
    expect(queryDeep<HTMLElement>(header, '.stage-badge')?.textContent?.trim()).toBe(STAGE_LABEL[TaskStage.ACCEPTED]);
  });

  it('does not offer Duplicate as a selectable stage', async () => {
    const header = await mountHeader({ stage: TaskStage.ACCEPTED });

    await openStageSelect(header);
    const optionValues = queryAllDeep<HTMLElement>(header, 'sl-option').map((option) => option.getAttribute('value'));

    expect(optionValues).not.toContain(String(TaskStage.DUPLICATE));
  });
});

describe('ft-inspector — reason-gated stage close', () => {
  it("opens the shared close reason dialog for Won't Fix and commits through CloseTask", async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { inspector, client } = await mountInspector(store);

    await selectValue(await openStageSelect(inspector), String(TaskStage.WONT_FIX));
    await flush();
    await settle(inspector);

    expect(dialogOpen(inspector)).toBe(true);
    expect(client.updateTaskCalls).toEqual([]);
    expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);

    submitReason(inspector, 'No longer planned');
    await flush();
    await settle(inspector);

    expect(client.closeTaskCalls).toEqual([
      { id: 't1', fields: { stage: TaskStage.WONT_FIX, reason: 'No longer planned' } },
    ]);
    expect(store.getTask('t1')?.stage).toBe(TaskStage.WONT_FIX);
  });

  it('keeps the actual stage when the reason dialog is cancelled', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { inspector, client } = await mountInspector(store);

    await selectValue(await openStageSelect(inspector), String(TaskStage.CANCELLED));
    await flush();
    await settle(inspector);

    const cancel = closeReasonDialog(inspector).shadowRoot?.querySelector('sl-button');
    cancel?.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    await flush();
    await settle(inspector);

    expect(dialogOpen(inspector)).toBe(false);
    expect(client.updateTaskCalls).toEqual([]);
    expect(client.closeTaskCalls).toEqual([]);
    expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);
    expect(queryDeep<HTMLElement>(inspector, '.stage-badge')?.textContent?.trim()).toBe(STAGE_LABEL[TaskStage.ACCEPTED]);
  });
});
