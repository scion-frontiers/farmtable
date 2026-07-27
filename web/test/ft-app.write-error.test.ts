import { describe, expect, it } from 'vitest';
import { grpc } from '@improbable-eng/grpc-web';
import '../src/components/ft-app.js';
import { GrpcError } from '../src/util/grpc-error.js';
import './helpers/dom.js'; // registers the afterEach that clears document.body

/**
 * `ft-app` surfaces write failures as an `<sl-alert>` toast appended to
 * `document.body` (see `showWriteError`, reached from both the optimistic-save
 * catch block and the `write-error` event listener).
 *
 * The element is created but deliberately NOT connected: `connectedCallback()`
 * builds a gRPC client and performs a session `fetch()`, neither of which is
 * meaningful in jsdom. The error-to-message mapping is reachable without any of
 * that, and it is the behaviour under test here. The *wiring* — that a child
 * view's `write-error` event reaches this mapping at all — is pinned separately
 * against a fully mounted `ft-app` in `ft-app.write-error-seam.test.ts`.
 *
 * The call deliberately goes through `onWriteError`, not straight to
 * `showWriteError`. Both are reachable (TypeScript `private` is compile-time
 * only), and the round-2 review found that preferring `showWriteError` here
 * meant no test in the suite ever executed `onWriteError` — so the handler
 * could be deleted wholesale with everything still green. Entering through the
 * event handler costs nothing and keeps one more layer under test.
 */
function showWriteError(error: unknown): void {
  const app = document.createElement('ft-app') as HTMLElement & Record<string, unknown>;

  if (typeof app.onWriteError !== 'function') {
    throw new Error('ft-app no longer exposes onWriteError');
  }
  (app.onWriteError as (e: CustomEvent) => void).call(
    app,
    new CustomEvent('write-error', { detail: { error } }),
  );
}

interface StubAlert extends HTMLElement {
  open?: boolean;
  variant?: string;
  closable?: boolean;
}

function alerts(): StubAlert[] {
  return Array.from(document.body.querySelectorAll<StubAlert>('sl-alert'));
}

function toastText(): string {
  const shown = alerts();
  if (shown.length === 0) throw new Error('no <sl-alert> toast was shown');
  // A toast that was appended but never shown is invisible to the user, so it
  // must not count as feedback. The Shoelace stub mirrors `toast()` -> `open`.
  const hidden = shown.filter((alert) => !alert.open);
  if (hidden.length > 0) {
    throw new Error(
      `an <sl-alert> was appended but never shown (toast() not called): ` +
        `${JSON.stringify(hidden.map((alert) => alert.textContent?.trim()))}`,
    );
  }
  return shown.map((alert) => (alert.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
}

/**
 * A real Farm Table PermissionDenied reason. It contains the word "permission",
 * which is exactly what the current `/permission|403|forbidden/i` mapping keys
 * off — so the user is told to check a GitHub token for an error GitHub never
 * produced, and the actionable server reason is discarded.
 */
const FARMTABLE_REASON =
  'permission denied: stage transition working -> completed requires an approved review';

describe('ft-app — Farm Table permission failures', () => {
  it('surfaces the server reason for a Farm Table PermissionDenied', () => {
    showWriteError(new GrpcError(grpc.Code.PermissionDenied, FARMTABLE_REASON));

    expect(toastText()).toContain(FARMTABLE_REASON);
  });

  /**
   * `isServerRejection` fires for any PermissionDenied/FailedPrecondition whose
   * text lacks "github", which includes a real GitHub 403 relayed by the adapter
   * as `PermissionDenied("403 Forbidden writing issue")`. Blaming Farm Table here
   * would be the round-1 misattribution bug pointed the other way, so the message
   * names no culprit at all — it reports the reason the server gave.
   */
  it('reports a server rejection without attributing it to a specific system', () => {
    showWriteError(new GrpcError(grpc.Code.PermissionDenied, FARMTABLE_REASON));

    const text = toastText();
    expect(text).toMatch(/the change was rejected/i);
    expect(text).not.toMatch(/farm ?table rejected/i);
    // The neutral wording must not cost the user the actionable server reason.
    expect(text).toContain(FARMTABLE_REASON);
  });

  it('does not blame Farm Table for a platform 403 relayed as PermissionDenied', () => {
    // No literal "github" in the text, so this reaches the isServerRejection
    // branch — the exact input that made the mirrored misattribution visible.
    const reason = '403 Forbidden writing issue #7';
    showWriteError(new GrpcError(grpc.Code.PermissionDenied, reason));

    const text = toastText();
    expect(text).not.toMatch(/farm ?table rejected/i);
    expect(text).toContain(reason);
  });

  /**
   * `FailedPrecondition` must be attributed the same way `PermissionDenied` is.
   * Asserting only `toContain(reason)` + `not.toMatch(/github/i)` does not pin
   * that: the generic `Failed to save changes: ${raw}` fallback satisfies both,
   * so dropping `FailedPrecondition` from `isServerRejection` survived the
   * round-2 mutation run. The rejection wording is the discriminating claim.
   */
  it('attributes a Farm Table FailedPrecondition as a rejection, not a generic save failure', () => {
    const reason = 'failed precondition: task must be accepted before it can be claimed';
    showWriteError(new GrpcError(grpc.Code.FailedPrecondition, reason));

    const text = toastText();
    expect(text).toMatch(/the change was rejected/i);
    expect(text).not.toMatch(/failed to save changes/i);
    expect(text).toContain(reason);
    expect(text).not.toMatch(/github/i);
  });

  /**
   * The same discrimination for a plain `Error`, which must NOT be treated as a
   * server rejection however precondition-shaped its text is. Without this the
   * test above could pass on a mapping that says "rejected" for everything.
   */
  it('does not claim a rejection for a non-gRPC error with precondition-shaped text', () => {
    const reason = 'failed precondition: task must be accepted before it can be claimed';
    showWriteError(new Error(reason));

    const text = toastText();
    expect(text).not.toMatch(/the change was rejected/i);
    expect(text).toMatch(/failed to save changes/i);
    expect(text).toContain(reason);
  });

  it('does not blame the GitHub token for a Farm Table PermissionDenied', () => {
    showWriteError(new GrpcError(grpc.Code.PermissionDenied, FARMTABLE_REASON));

    const text = toastText();
    expect(text).not.toMatch(/github/i);
    expect(text).not.toMatch(/token/i);
  });

  /**
   * `toContain(reason)` alone is echo-weak — the generic fallback repeats the
   * input verbatim, so it cannot tell "took the generic branch" from "took the
   * GitHub branch and happened to include the raw text". Naming the branch
   * makes the assertion discriminating.
   */
  it('does not blame the GitHub token for a Farm Table error whose text merely says "permission"', () => {
    const reason = 'permission denied: collection is archived';
    showWriteError(new Error(reason));

    const text = toastText();
    expect(text).toMatch(/failed to save changes/i);
    expect(text).toContain(reason);
    expect(text).not.toMatch(/github/i);
    expect(text).not.toMatch(/token/i);
  });

  it('does not blame the GitHub token for a Farm Table error whose text merely says "forbidden"', () => {
    const reason = 'forbidden: assignment requires an accepted stage';
    showWriteError(new Error(reason));

    const text = toastText();
    expect(text).toMatch(/failed to save changes/i);
    expect(text).toContain(reason);
    expect(text).not.toMatch(/github/i);
    expect(text).not.toMatch(/token/i);
  });
});

describe('ft-app — other write failures still map usefully', () => {
  /**
   * `toMatch(/github/i)` is worthless on these two: the input already contains
   * "github" and the generic fallback echoes the raw message, so the assertion
   * passes under at least three mutually exclusive behaviours — including the
   * one where the GitHub branch was never taken. The actionable *hint* is the
   * only thing that distinguishes them.
   */
  it('gives the GitHub token hint for a genuinely GitHub-sourced 403', () => {
    showWriteError(new Error('403 Forbidden from api.github.com/repos/acme/repo/issues/7'));

    const text = toastText();
    expect(text).toMatch(/token/i);
    expect(text).toMatch(/write access/i);
    expect(text).not.toMatch(/failed to save changes/i);
  });

  /**
   * This pins the `!/github/i` exclusion in `isServerRejection`
   * (`grpc-error.ts`), which the round-2 run found pinned by no test at all.
   * A `PermissionDenied` whose text names GitHub must fall THROUGH the
   * server-rejection branch to the GitHub branch — so the neutral "the change
   * was rejected" wording must NOT appear, and the token hint must.
   */
  it('keeps the GitHub token hint for a GitHub PermissionDenied rather than calling it a server rejection', () => {
    showWriteError(
      new GrpcError(grpc.Code.PermissionDenied, 'github: 403 Forbidden writing issue #7'),
    );

    const text = toastText();
    expect(text).toMatch(/token/i);
    expect(text).toMatch(/write access/i);
    expect(text).not.toMatch(/the change was rejected/i);
  });

  it('explains a rate limit', () => {
    showWriteError(new Error('rate limit exceeded (429)'));

    expect(toastText()).toMatch(/rate limit/i);
  });

  it('explains an unreachable server', () => {
    showWriteError(new Error('fetch failed: ECONNREFUSED'));

    expect(toastText()).toMatch(/could not reach the server/i);
  });

  it('falls back to the raw message for an unclassified failure', () => {
    showWriteError(new Error('boom'));

    expect(toastText()).toContain('boom');
  });

  it('shows a danger-variant, closable toast', () => {
    showWriteError(new Error('boom'));

    const alert = document.body.querySelector('sl-alert') as HTMLElement & {
      variant?: string;
      closable?: boolean;
    };
    expect(alert.variant).toBe('danger');
    expect(alert.closable).toBe(true);
  });
});
