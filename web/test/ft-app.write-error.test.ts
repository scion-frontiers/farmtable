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
 * that, and it is the behaviour under test here.
 */
function showWriteError(error: unknown): void {
  const app = document.createElement('ft-app') as HTMLElement & Record<string, unknown>;

  if (typeof app.showWriteError === 'function') {
    (app.showWriteError as (e: unknown) => void).call(app, error);
    return;
  }
  if (typeof app.onWriteError === 'function') {
    (app.onWriteError as (e: CustomEvent) => void).call(
      app,
      new CustomEvent('write-error', { detail: { error } }),
    );
    return;
  }
  throw new Error('ft-app exposes neither showWriteError nor onWriteError');
}

function toastText(): string {
  const alerts = Array.from(document.body.querySelectorAll('sl-alert'));
  if (alerts.length === 0) throw new Error('no <sl-alert> toast was shown');
  return alerts.map((alert) => (alert.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | ');
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

  it('surfaces the server reason for a Farm Table FailedPrecondition', () => {
    const reason = 'failed precondition: task must be accepted before it can be claimed';
    showWriteError(new GrpcError(grpc.Code.FailedPrecondition, reason));

    const text = toastText();
    expect(text).toContain(reason);
    expect(text).not.toMatch(/github/i);
  });

  it('does not blame the GitHub token for a Farm Table PermissionDenied', () => {
    showWriteError(new GrpcError(grpc.Code.PermissionDenied, FARMTABLE_REASON));

    const text = toastText();
    expect(text).not.toMatch(/github/i);
    expect(text).not.toMatch(/token/i);
  });

  it('does not blame the GitHub token for a Farm Table error whose text merely says "permission"', () => {
    const reason = 'permission denied: collection is archived';
    showWriteError(new Error(reason));

    const text = toastText();
    expect(text).toContain(reason);
    expect(text).not.toMatch(/github/i);
  });

  it('does not blame the GitHub token for a Farm Table error whose text merely says "forbidden"', () => {
    const reason = 'forbidden: assignment requires an accepted stage';
    showWriteError(new Error(reason));

    const text = toastText();
    expect(text).toContain(reason);
    expect(text).not.toMatch(/github/i);
  });
});

describe('ft-app — other write failures still map usefully', () => {
  it('mentions GitHub for a genuinely GitHub-sourced 403', () => {
    showWriteError(new Error('403 Forbidden from api.github.com/repos/acme/repo/issues/7'));

    expect(toastText()).toMatch(/github/i);
  });

  it('keeps the GitHub token hint for a GitHub PermissionDenied', () => {
    showWriteError(
      new GrpcError(grpc.Code.PermissionDenied, 'github: 403 Forbidden writing issue #7'),
    );

    expect(toastText()).toMatch(/github/i);
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
