import { describe, expect, it } from 'vitest';
import { AvailabilityReason, TaskHoldReason, TaskStage } from '../src/gen/types.js';
import {
  AVAILABILITY_REASON_LABEL,
  HOLD_REASON_LABEL,
  NATIVE_STAGE_OPTIONS,
  STAGE_LABEL,
} from '../src/util/task-state-utils.js';

/**
 * THE single anchor for user-visible task-state vocabulary.
 *
 * Everywhere else in the suite, expectations are DERIVED from these exported
 * maps rather than transcribed — that is deliberate, because a transcription
 * drifts silently (one had already: see the `terminalLaneToast` literal in
 * `ft-app.write-error-seam.test.ts`, which used a curly apostrophe and dropped
 * a whole clause, and passed anyway because it matched loosely).
 *
 * But derivation has a cost: mutate a label and expectation and actual move in
 * lockstep, so nothing fails. This file pays that cost back. It is the ONLY
 * place these strings appear as literals, so renaming user-visible vocabulary
 * fails here and nowhere else — a decision point rather than an accident.
 *
 * If you are here because a test failed: the words a user reads changed. That
 * may well be correct. Update the literal deliberately, and check the contract
 * in `.design/` agrees.
 */

describe('STAGE_LABEL — the ten native stages read as the contract says', () => {
  const expected: [TaskStage, string][] = [
    [TaskStage.TRIAGE, 'Triage'],
    [TaskStage.ACCEPTED, 'Accepted'],
    [TaskStage.WORKING, 'Working'],
    [TaskStage.IN_REVIEW, 'In Review'],
    [TaskStage.IN_QA, 'In QA'],
    [TaskStage.DEPLOYING, 'Deploying'],
    [TaskStage.COMPLETED, 'Completed'],
    // Straight apostrophe, matching production. The drifted literal that
    // prompted this file used a curly one.
    [TaskStage.WONT_FIX, "Won't Fix"],
    [TaskStage.DUPLICATE, 'Duplicate'],
    [TaskStage.CANCELLED, 'Cancelled'],
  ];

  for (const [stage, label] of expected) {
    it(`labels stage ${stage} as "${label}"`, () => {
      expect(STAGE_LABEL[stage]).toBe(label);
    });
  }

  it('labels every native stage and no more', () => {
    expect(NATIVE_STAGE_OPTIONS).toHaveLength(expected.length);
    expect([...NATIVE_STAGE_OPTIONS].sort()).toEqual(expected.map(([stage]) => stage).sort());
    for (const stage of NATIVE_STAGE_OPTIONS) {
      expect(STAGE_LABEL[stage], `stage ${stage} has no label`).toBeTruthy();
    }
  });

  /**
   * The vocabulary the task-state contract DELETED. These words must not come
   * back as labels for anything.
   */
  it('uses none of the deleted stage vocabulary', () => {
    const labels = NATIVE_STAGE_OPTIONS.map((stage) => STAGE_LABEL[stage]);

    expect(labels).toHaveLength(expected.length);
    for (const deleted of ['Ready', 'Blocked', 'Backlog', 'Scheduled']) {
      expect(labels, `"${deleted}" is deleted contract vocabulary`).not.toContain(deleted);
    }
  });
});

describe('HOLD_REASON_LABEL — hold vocabulary', () => {
  const expected: [TaskHoldReason, string][] = [
    [TaskHoldReason.WAITING_FOR_INPUT, 'Waiting for input'],
    [TaskHoldReason.DEFERRED, 'Deferred'],
  ];

  for (const [reason, label] of expected) {
    it(`labels hold reason ${reason} as "${label}"`, () => {
      expect(HOLD_REASON_LABEL[reason]).toBe(label);
    });
  }

  it('gives the UNSPECIFIED zero value no label, so it can never be shown as one', () => {
    expect(HOLD_REASON_LABEL[TaskHoldReason.UNSPECIFIED]).toBeUndefined();
    expect(Object.keys(HOLD_REASON_LABEL)).toHaveLength(expected.length);
  });
});

describe('AVAILABILITY_REASON_LABEL — unavailability vocabulary', () => {
  const expected: [AvailabilityReason, string][] = [
    [AvailabilityReason.TRIAGE, 'Triage'],
    [AvailabilityReason.TERMINAL, 'Terminal'],
    [AvailabilityReason.HELD, 'Held'],
    [AvailabilityReason.BLOCKED_BY_DEPENDENCY, 'Blocked by dependency'],
    [AvailabilityReason.FUTURE_START_DATE, 'Future start date'],
  ];

  for (const [reason, label] of expected) {
    it(`labels availability reason ${reason} as "${label}"`, () => {
      expect(AVAILABILITY_REASON_LABEL[reason]).toBe(label);
    });
  }

  it('gives the UNSPECIFIED zero value no label, so it can never be shown as one', () => {
    expect(AVAILABILITY_REASON_LABEL[AvailabilityReason.UNSPECIFIED]).toBeUndefined();
    expect(Object.keys(AVAILABILITY_REASON_LABEL)).toHaveLength(expected.length);
  });
});
