import { describe, expect, it } from 'vitest';
import '../src/components/kanban/ft-task-card.js';
import {
  AvailabilityReason,
  RelationshipType,
  TaskHoldReason,
  TaskStage,
  type Task,
} from '../src/gen/types.js';
import {
  ATTENTION,
  AVAILABILITY_REASON_LABEL,
  HOLD_REASON_LABEL,
  NATIVE_STAGE_OPTIONS,
  availabilityLabel,
  isUnsuccessfulTerminalStage,
} from '../src/util/task-state-utils.js';
import { mount, queryAllDeep, textDeep } from './helpers/dom.js';
import { storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

/**
 * Was a local literal. The same words now reach the user from four places, so
 * they live in the vocabulary anchor and every test reads them from there —
 * otherwise a reword makes the badge and the filter disagree with this file
 * still green.
 */
const ATTENTION_BADGE = ATTENTION.label;

function badges(card: Element): string[] {
  return queryAllDeep<HTMLElement>(card, '.state-badges sl-tag').map((tag) =>
    (tag.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** A dependent task that the server reports as dependency-blocked. */
function dependent(blockerId: string, overrides: Partial<Task> = {}): Task {
  return task({
    id: 'dependent',
    stage: TaskStage.ACCEPTED,
    availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: blockerId }],
    ...overrides,
  });
}

async function mountCard(subject: Task, store: TaskStore) {
  return mount<HTMLElement>('ft-task-card', { task: subject, store });
}

describe('ft-task-card — needs-attention badge', () => {
  // Derived from the real predicate the component's `attentionBlockers` uses,
  // not a transcription of it: widen `isUnsuccessfulTerminalStage` and this
  // loop covers the new stage automatically instead of going quiet.
  const attentionStages = NATIVE_STAGE_OPTIONS.filter(isUnsuccessfulTerminalStage);

  it('derives its blocker-stage list from isUnsuccessfulTerminalStage', () => {
    expect(attentionStages.length, 'no stage triggers attention, so the loop tests nothing')
      .toBeGreaterThan(0);
    expect(isUnsuccessfulTerminalStage(TaskStage.COMPLETED), 'the positive counterpart').toBe(false);
  });

  /**
   * The derived loop above protects against WIDENING and is blind to
   * NARROWING: drop a stage from the predicate and the case for that stage
   * does not fail, it ceases to exist, and the runner reports green on a
   * smaller number. Contract §11 names all three outcomes, so the cardinality
   * is required rather than incidental — pin it explicitly.
   */
  it('treats exactly the three contract §11 outcomes as unsuccessful terminal', () => {
    expect([...attentionStages].sort()).toEqual(
      [TaskStage.WONT_FIX, TaskStage.DUPLICATE, TaskStage.CANCELLED].sort(),
    );
  });

  for (const blockerStage of attentionStages) {
    it(`shows "${ATTENTION_BADGE}" when blocked by a ${TaskStage[blockerStage]} prerequisite`, async () => {
      const blocker = task({ id: 'blocker', stage: blockerStage });
      const subject = dependent(blocker.id);
      const card = await mountCard(subject, storeWith(blocker, subject));

      expect(badges(card)).toContain(ATTENTION_BADGE);
    });
  }

  it('shows the badge when any one of several blockers is unsuccessfully terminal', async () => {
    const done = task({ id: 'done', stage: TaskStage.COMPLETED });
    const dead = task({ id: 'dead', stage: TaskStage.WONT_FIX });
    const subject = task({
      id: 'dependent',
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
      relationships: [
        { type: RelationshipType.BLOCKED_BY, targetTaskId: done.id },
        { type: RelationshipType.BLOCKED_BY, targetTaskId: dead.id },
      ],
    });
    const card = await mountCard(subject, storeWith(done, dead, subject));

    expect(badges(card)).toContain(ATTENTION_BADGE);
  });
});

describe('ft-task-card — needs-attention negative cases', () => {
  it('does not show the badge when the blocker completed successfully', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.COMPLETED });
    const subject = dependent(blocker.id);
    const card = await mountCard(subject, storeWith(blocker, subject));

    // L-1 positive guard: without it this passes on a card that renders no
    // badges at all — including one whose whole badge block was deleted.
    expect(badges(card).length, 'the card rendered no badges, so the negative proves nothing')
      .toBeGreaterThan(0);
    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the blocker is still in a non-terminal stage', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.WORKING });
    const subject = dependent(blocker.id);
    const card = await mountCard(subject, storeWith(blocker, subject));

    // L-1 positive guard: without it this passes on a card that renders no
    // badges at all — including one whose whole badge block was deleted.
    expect(badges(card).length, 'the card rendered no badges, so the negative proves nothing')
      .toBeGreaterThan(0);
    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the blocker task is missing from the store', async () => {
    const subject = dependent('not-loaded');
    const card = await mountCard(subject, storeWith(subject));

    // L-1 positive guard: without it this passes on a card that renders no
    // badges at all — including one whose whole badge block was deleted.
    expect(badges(card).length, 'the card rendered no badges, so the negative proves nothing')
      .toBeGreaterThan(0);
    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge without a BLOCKED_BY_DEPENDENCY availability reason', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, {
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const card = await mountCard(subject, storeWith(blocker, subject));

    // L-1 positive guard: without it this passes on a card that renders no
    // badges at all — including one whose whole badge block was deleted.
    expect(badges(card).length, 'the card rendered no badges, so the negative proves nothing')
      .toBeGreaterThan(0);
    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  /**
   * L-2. Retitled. `attentionBlockers` never reads `availability.available` —
   * it keys off the presence of `BLOCKED_BY_DEPENDENCY` in `reasons`. So this
   * is not "the server says available" at all; it is the same
   * missing-reason path as the test above, reached through a different
   * fixture. Kept because the fixture is a realistic server payload, but the
   * name now states what is actually being pinned.
   */
  it('does not show the badge when reasons are empty, whatever available says', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, { availability: { available: true, reasons: [] } });
    const card = await mountCard(subject, storeWith(blocker, subject));

    // L-1 positive guard: without it this passes on a card that renders no
    // badges at all — including one whose whole badge block was deleted.
    expect(badges(card).length, 'the card rendered no badges, so the negative proves nothing')
      .toBeGreaterThan(0);
    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the relationship is not BLOCKED_BY', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, {
      relationships: [{ type: RelationshipType.RELATED, targetTaskId: blocker.id }],
    });
    const card = await mountCard(subject, storeWith(blocker, subject));

    // L-1 positive guard: without it this passes on a card that renders no
    // badges at all — including one whose whole badge block was deleted.
    expect(badges(card).length, 'the card rendered no badges, so the negative proves nothing')
      .toBeGreaterThan(0);
    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('renders no state badges at all for a plain task with no hold or availability', async () => {
    const subject = task({ id: 'plain' });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toEqual([]);
  });
});

describe('ft-task-card — hold and availability badges', () => {
  it('renders the hold reason label as a badge', async () => {
    const subject = task({ id: 'held', holdReason: TaskHoldReason.WAITING_FOR_INPUT });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toContain(HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT]);
  });

  it('renders Available for server-available tasks', async () => {
    const subject = task({ id: 'ok', availability: { available: true, reasons: [] } });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toContain(availabilityLabel(subject));
  });

  it('renders the server availability reasons for unavailable tasks', async () => {
    const subject = task({
      id: 'held',
      holdReason: TaskHoldReason.DEFERRED,
      availability: {
        available: false,
        reasons: [AvailabilityReason.HELD, AvailabilityReason.FUTURE_START_DATE],
      },
    });
    const card = await mountCard(subject, storeWith(subject));

    // Was `'Held, Future start date'` — a literal that duplicated not just the
    // two labels but `availabilityLabel`'s ', ' join. Both now come from
    // production, with an independent anchor on the label map so a mutated
    // `availabilityLabel` cannot move expectation and actual in lockstep.
    expect(badges(card)).toContain(availabilityLabel(subject));
    expect(badges(card)).toContain(HOLD_REASON_LABEL[TaskHoldReason.DEFERRED]);
    expect(availabilityLabel(subject)).toContain(AVAILABILITY_REASON_LABEL[AvailabilityReason.HELD]);
    expect(availabilityLabel(subject)).toContain(
      AVAILABILITY_REASON_LABEL[AvailabilityReason.FUTURE_START_DATE],
    );
  });

  /**
   * L-3. As written this was three negatives against a component that has no
   * stage vocabulary in any branch — it would pass on a card that rendered
   * nothing whatsoever. The route by which deleted vocabulary could actually
   * reappear here is a label map: the card renders `HOLD_REASON_LABEL` and
   * `AVAILABILITY_REASON_LABEL` values verbatim. So the fixture is now one that
   * renders badges from BOTH maps, and the positive assertions below prove the
   * card really is rendering label text before the negatives are believed.
   */
  it('renders no deleted stage vocabulary on the card', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, { holdReason: TaskHoldReason.WAITING_FOR_INPUT });
    const card = await mountCard(subject, storeWith(blocker, subject));

    const text = textDeep(card);
    expect(badges(card).length, 'no badges rendered, so the negatives prove nothing')
      .toBeGreaterThan(0);
    expect(text).toContain(HOLD_REASON_LABEL[TaskHoldReason.WAITING_FOR_INPUT]);
    expect(text).toContain(AVAILABILITY_REASON_LABEL[AvailabilityReason.BLOCKED_BY_DEPENDENCY]);
    expect(text).not.toMatch(/\bReady\b/);
    expect(text).not.toMatch(/\bBacklog\b/);
    expect(text).not.toMatch(/\bScheduled\b/);
  });
});
