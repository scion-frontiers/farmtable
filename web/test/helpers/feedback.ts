/**
 * Collector for "the UI told the user something went wrong" signals.
 *
 * Farm Table surfaces write failures two ways:
 *   - a bubbling, composed `write-error` CustomEvent that `ft-app` turns into
 *     a toast, and
 *   - a directly-appended `<sl-alert>` toast element on `document.body`.
 *
 * Tests assert that *some* user-visible refusal happened without pinning the
 * fix agent to one specific mechanism.
 */
export interface FeedbackCollector {
  /** `write-error` events observed on the mounted element. */
  writeErrors: CustomEvent[];
  /** Text of every `<sl-alert>` toast appended to the document. */
  toasts(): string[];
  /**
   * The `detail.reason` discriminator of each `write-error`:
   * `'stage-change-refused'` for client-side refusals,
   * `'stage-change-failed'` for server failures.
   */
  reasons(): unknown[];
  /** True when the user got any visible refusal signal. */
  sawFeedback(): boolean;
  describe(): string;
}

export function collectFeedback(target: EventTarget): FeedbackCollector {
  const writeErrors: CustomEvent[] = [];
  target.addEventListener('write-error', (e) => writeErrors.push(e as CustomEvent));

  const toasts = () =>
    Array.from(document.querySelectorAll('sl-alert')).map((alert) => (alert.textContent ?? '').trim());

  return {
    writeErrors,
    toasts,
    reasons: () => writeErrors.map((event) => event.detail?.reason),
    sawFeedback: () => writeErrors.length > 0 || toasts().length > 0,
    describe: () =>
      `write-error events: ${JSON.stringify(writeErrors.map((e) => e.detail))}; ` +
      `toasts: ${JSON.stringify(toasts())}`,
  };
}
