import { describe, expect, it } from 'vitest';
import '../src/components/kanban/ft-kanban-view.js';
import '../src/components/kanban/ft-kanban-column.js';
import '../src/components/kanban/ft-task-card.js';
import { TaskStage } from '../src/gen/types.js';
import { ALL_ENABLED } from '../src/capabilities.js';
import { STAGE_LABEL } from '../src/util/task-state-utils.js';
import {
  dragOverOn,
  dragTaskOnto,
  dropTaskOn,
  flush,
  mount,
  queryAllDeep,
  settle,
} from './helpers/dom.js';
import { collectFeedback } from './helpers/feedback.js';
import { NATIVE_STAGES, RecordingClient, storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

interface BoardColumn {
  stage: TaskStage;
  label: string;
}

/**
 * `BOARD_COLUMNS` is loaded dynamically so that a missing export fails exactly
 * the tests that depend on it, instead of aborting the whole module.
 */
async function loadBoardColumns(): Promise<BoardColumn[]> {
  const module = (await import('../src/components/kanban/ft-kanban-view.js')) as Record<string, unknown>;
  const columns = module.BOARD_COLUMNS;
  expect(
    columns,
    'ft-kanban-view.ts must export BOARD_COLUMNS (interface contract with dev-p2-fixes)',
  ).toBeDefined();
  return columns as BoardColumn[];
}

async function mountBoard(store: TaskStore, props: Record<string, unknown> = {}) {
  // The client answers from the same store, so the view's reconcile-from-response
  // step sees a whole task rather than a stage-only stub.
  const client = new RecordingClient(store);
  const view = await mount<HTMLElement>('ft-kanban-view', {
    store,
    client,
    capabilities: ALL_ENABLED,
    ...props,
  });
  return { view, client };
}

function columnFor(view: Element, stage: TaskStage): Element {
  const column = queryAllDeep<Element & { stage: TaskStage }>(view, 'ft-kanban-column').find(
    (candidate) => candidate.stage === stage,
  );
  if (!column) throw new Error(`no ft-kanban-column rendered for stage ${TaskStage[stage]}`);
  return column;
}

function dropZoneFor(view: Element, stage: TaskStage): Element {
  const column = columnFor(view, stage);
  const zone = column.shadowRoot?.querySelector('.cards');
  if (!zone) throw new Error(`column for ${TaskStage[stage]} rendered no drop zone`);
  return zone;
}

/** Task ids rendered as cards in each lane, keyed by stage. */
function laneContents(view: Element): Map<TaskStage, string[]> {
  const lanes = new Map<TaskStage, string[]>();
  for (const column of queryAllDeep<Element & { stage: TaskStage }>(view, 'ft-kanban-column')) {
    const ids = Array.from(column.shadowRoot?.querySelectorAll('ft-task-card') ?? []).map(
      (card) => (card as Element & { task: { id: string } }).task.id,
    );
    lanes.set(column.stage, ids);
  }
  return lanes;
}

describe('ft-kanban-view — stage mutation payload', () => {
  it('sends only { stage } to updateTask and never a phase key', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store);

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();

    expect(client.updateTaskCalls).toHaveLength(1);
    expect(client.updateTaskCalls[0].id).toBe('t1');
    expect(client.updateTaskCalls[0].fields).not.toHaveProperty('phase');
    expect(Object.keys(client.updateTaskCalls[0].fields)).toEqual(['stage']);
    expect(client.updateTaskCalls[0].fields.stage).toBe(TaskStage.WORKING);
  });

  it('moves the card into the drop-target lane on success', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view } = await mountBoard(store);

    dropTaskOn(dropZoneFor(view, TaskStage.IN_REVIEW), 't1');
    await flush();
    await settle(view);

    expect(store.getTask('t1')?.stage).toBe(TaskStage.IN_REVIEW);
    expect(laneContents(view).get(TaskStage.IN_REVIEW)).toEqual(['t1']);
    expect(laneContents(view).get(TaskStage.ACCEPTED)).toEqual([]);
  });
});

describe('ft-kanban-view — board lanes', () => {
  it('exports a BOARD_COLUMNS lane for every native TaskStage', async () => {
    const columns = await loadBoardColumns();
    const enumStages = Object.values(TaskStage).filter(
      (value): value is TaskStage => typeof value === 'number' && value !== TaskStage.UNSPECIFIED,
    );

    expect(columns.map((column) => column.stage).sort()).toEqual([...enumStages].sort());
    expect(columns).toHaveLength(10);
  });

  it('renders one lane per BOARD_COLUMNS entry, in order, with its stage label', async () => {
    const columns = await loadBoardColumns();
    const { view } = await mountBoard(storeWith());

    const rendered = queryAllDeep<Element & { stage: TaskStage; label: string }>(view, 'ft-kanban-column');

    expect(rendered.map((column) => column.stage)).toEqual(columns.map((column) => column.stage));
    expect(rendered.map((column) => column.label)).toEqual(columns.map((column) => column.label));
  });

  it('renders the three unsuccessful terminal lanes', async () => {
    const { view } = await mountBoard(storeWith());
    const stages = queryAllDeep<Element & { stage: TaskStage }>(view, 'ft-kanban-column').map((c) => c.stage);

    expect(stages).toContain(TaskStage.WONT_FIX);
    expect(stages).toContain(TaskStage.DUPLICATE);
    expect(stages).toContain(TaskStage.CANCELLED);
  });

  it('renders every native stage lane and no others', async () => {
    const { view } = await mountBoard(storeWith());
    const stages = queryAllDeep<Element & { stage: TaskStage }>(view, 'ft-kanban-column').map((c) => c.stage);

    expect([...stages].sort()).toEqual([...NATIVE_STAGES].sort());
  });

  it('shows tasks in their own lane, including terminal stages', async () => {
    const store = storeWith(
      task({ id: 'done', stage: TaskStage.COMPLETED }),
      task({ id: 'nope', stage: TaskStage.WONT_FIX }),
      task({ id: 'dupe', stage: TaskStage.DUPLICATE }),
      task({ id: 'gone', stage: TaskStage.CANCELLED }),
    );
    const { view } = await mountBoard(store);
    const lanes = laneContents(view);

    expect(lanes.get(TaskStage.COMPLETED)).toEqual(['done']);
    expect(lanes.get(TaskStage.WONT_FIX)).toEqual(['nope']);
    expect(lanes.get(TaskStage.DUPLICATE)).toEqual(['dupe']);
    expect(lanes.get(TaskStage.CANCELLED)).toEqual(['gone']);
  });

  it('labels every lane with its canonical stage label', async () => {
    const { view } = await mountBoard(storeWith());

    for (const column of queryAllDeep<Element & { stage: TaskStage; label: string }>(view, 'ft-kanban-column')) {
      expect(column.label).toBe(STAGE_LABEL[column.stage]);
    }
  });
});

describe('ft-kanban-view — server-rejected stage transitions', () => {
  it('rolls the stage back in the store when updateTask rejects', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store);
    client.rejectUpdateWith = new Error('PermissionDenied: missing task:accept scope');

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();

    expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);
  });

  it('dispatches a composed, bubbling write-error carrying the rejection', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store);
    const rejection = new Error('PermissionDenied: missing task:accept scope');
    client.rejectUpdateWith = rejection;

    const events: CustomEvent[] = [];
    document.body.addEventListener('write-error', (e) => events.push(e as CustomEvent));

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();

    expect(events).toHaveLength(1);
    expect(events[0].bubbles).toBe(true);
    expect(events[0].composed).toBe(true);
    expect(events[0].detail.error).toBe(rejection);
  });

  it('tags the server failure with reason "stage-change-failed"', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store);
    client.rejectUpdateWith = new Error('PermissionDenied: missing task:accept scope');
    const feedback = collectFeedback(document.body);

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();

    expect(feedback.reasons(), feedback.describe()).toEqual(['stage-change-failed']);
  });

  it('snaps the card back to its ORIGINAL lane when the server rejects the move', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store);
    client.rejectUpdateWith = new Error('PermissionDenied: missing task:accept scope');

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();
    await settle(view);

    const lanes = laneContents(view);
    expect(lanes.get(TaskStage.ACCEPTED)).toEqual(['t1']);
    expect(lanes.get(TaskStage.WORKING)).toEqual([]);
  });
});

describe('ft-kanban-view — refusals must be visible', () => {
  for (const stage of [TaskStage.WONT_FIX, TaskStage.DUPLICATE, TaskStage.CANCELLED]) {
    it(`gives visible feedback when a card is dropped on the ${TaskStage[stage]} lane`, async () => {
      const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
      const { view, client } = await mountBoard(store);
      const feedback = collectFeedback(document.body);

      dropTaskOn(dropZoneFor(view, stage), 't1');
      await flush();
      await settle(view);

      expect(client.updateTaskCalls).toEqual([]);
      expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);
      expect(laneContents(view).get(TaskStage.ACCEPTED)).toEqual(['t1']);
      expect(feedback.sawFeedback(), `drop was a silent no-op — ${feedback.describe()}`).toBe(true);
    });
  }

  it('tags a terminal-lane refusal with reason "stage-change-refused"', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view } = await mountBoard(store);
    const feedback = collectFeedback(document.body);

    dropTaskOn(dropZoneFor(view, TaskStage.WONT_FIX), 't1');
    await flush();

    expect(feedback.reasons(), feedback.describe()).toEqual(['stage-change-refused']);
    expect(feedback.writeErrors[0]?.detail.message, feedback.describe()).toBeTruthy();
  });

  it('gives visible feedback instead of silently ignoring a drop when readOnly', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store, { readOnly: true });
    const feedback = collectFeedback(document.body);

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toEqual([]);
    expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);
    expect(feedback.sawFeedback(), `read-only drop was a silent no-op — ${feedback.describe()}`).toBe(true);
  });

  it('tags a read-only refusal with reason "stage-change-refused"', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view } = await mountBoard(store, { readOnly: true });
    const feedback = collectFeedback(document.body);

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();

    expect(feedback.reasons(), feedback.describe()).toEqual(['stage-change-refused']);
  });

  it('gives visible feedback instead of silently ignoring a drop when canChangeStage is false', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store, {
      capabilities: { ...ALL_ENABLED, canChangeStage: false },
    });
    const feedback = collectFeedback(document.body);

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();
    await settle(view);

    expect(client.updateTaskCalls).toEqual([]);
    expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);
    expect(feedback.sawFeedback(), `capability-blocked drop was a silent no-op — ${feedback.describe()}`).toBe(true);
  });

  it('tags a capability refusal with reason "stage-change-refused"', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view } = await mountBoard(store, {
      capabilities: { ...ALL_ENABLED, canChangeStage: false },
    });
    const feedback = collectFeedback(document.body);

    dropTaskOn(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();

    expect(feedback.reasons(), feedback.describe()).toEqual(['stage-change-refused']);
  });
});

/**
 * A `drop` event only fires on an element whose `dragover` handler called
 * `preventDefault()`. A lane that means to *refuse* a drop must therefore still
 * cancel `dragover`: bailing out early makes the browser drop the gesture on the
 * floor, and the refusal becomes a silent no-op — the lane just looks broken.
 *
 * The refusal tests above use `dropTaskOn`, which synthesises a `drop` directly
 * and so cannot observe this. These tests exercise `dragover` itself, and are the
 * regression guard for the early return removed from `onDragOver`.
 */
describe('ft-kanban-view — refusing lanes must still accept the drop gesture', () => {
  const REFUSING_LANES: [name: string, stage: TaskStage][] = [
    ['WONT_FIX', TaskStage.WONT_FIX],
    ['DUPLICATE', TaskStage.DUPLICATE],
    ['CANCELLED', TaskStage.CANCELLED],
  ];

  for (const [name, stage] of REFUSING_LANES) {
    it(`cancels dragover on the ${name} lane so the browser still fires drop`, async () => {
      const { view } = await mountBoard(storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED })));

      const event = dragOverOn(dropZoneFor(view, stage));

      expect(
        event.defaultPrevented,
        `dragover was not cancelled on the ${name} lane, so no drop event can ever fire there`,
      ).toBe(true);
    });
  }

  it('cancels dragover on every lane of a read-only board', async () => {
    const { view } = await mountBoard(storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED })), {
      readOnly: true,
    });

    const event = dragOverOn(dropZoneFor(view, TaskStage.WORKING));

    expect(event.defaultPrevented, 'read-only lanes swallowed the drag gesture').toBe(true);
  });

  it('cancels dragover when canChangeStage is false', async () => {
    const { view } = await mountBoard(storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED })), {
      capabilities: { ...ALL_ENABLED, canChangeStage: false },
    });

    const event = dragOverOn(dropZoneFor(view, TaskStage.WORKING));

    expect(event.defaultPrevented, 'capability-blocked lanes swallowed the drag gesture').toBe(true);
  });

  it('cancels dragover on an accepting lane', async () => {
    const { view } = await mountBoard(storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED })));

    expect(dragOverOn(dropZoneFor(view, TaskStage.WORKING)).defaultPrevented).toBe(true);
  });

  it('sets dropEffect to move rather than leaving it none', async () => {
    // `dropEffect = 'none'` cancels the drop in a real browser, which would be
    // the same silent no-op by another route.
    const { view } = await mountBoard(storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED })));

    const event = dragOverOn(dropZoneFor(view, TaskStage.WONT_FIX)) as Event & {
      dataTransfer: DataTransfer;
    };

    expect(event.dataTransfer.dropEffect).toBe('move');
  });

  for (const [name, stage] of REFUSING_LANES) {
    it(`reports a refusal for a full drag gesture onto the ${name} lane`, async () => {
      // End-to-end via `dragTaskOnto`, which enforces the browser's rule: if
      // `dragover` is not cancelled the drop never happens and no feedback can
      // possibly appear, however good the drop handler is.
      const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
      const { view, client } = await mountBoard(store);
      const feedback = collectFeedback(document.body);

      const dropped = dragTaskOnto(dropZoneFor(view, stage), 't1');
      await flush();
      await settle(view);

      expect(dropped, `dragover on the ${name} lane refused the gesture, so drop never fired`).toBe(
        true,
      );
      expect(client.updateTaskCalls).toEqual([]);
      expect(store.getTask('t1')?.stage).toBe(TaskStage.ACCEPTED);
      expect(feedback.reasons(), feedback.describe()).toEqual(['stage-change-refused']);
    });
  }

  it('reports a refusal for a full drag gesture when canChangeStage is false', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view } = await mountBoard(store, {
      capabilities: { ...ALL_ENABLED, canChangeStage: false },
    });
    const feedback = collectFeedback(document.body);

    const dropped = dragTaskOnto(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();
    await settle(view);

    expect(dropped, 'dragover refused the gesture, so drop never fired').toBe(true);
    expect(feedback.reasons(), feedback.describe()).toEqual(['stage-change-refused']);
  });

  it('completes a real drag gesture onto an accepting lane', async () => {
    const store = storeWith(task({ id: 't1', stage: TaskStage.ACCEPTED }));
    const { view, client } = await mountBoard(store);

    const dropped = dragTaskOnto(dropZoneFor(view, TaskStage.WORKING), 't1');
    await flush();
    await settle(view);

    expect(dropped).toBe(true);
    expect(client.updateTaskCalls).toHaveLength(1);
    expect(store.getTask('t1')?.stage).toBe(TaskStage.WORKING);
  });
});
