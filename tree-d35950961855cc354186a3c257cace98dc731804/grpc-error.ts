import { grpc } from '@improbable-eng/grpc-web';

/**
 * A gRPC error that carries the numeric grpc.Code so callers can inspect
 * the status code without fragile string-matching on the message.
 */
export class GrpcError extends Error {
  readonly code: grpc.Code;

  constructor(code: grpc.Code, message?: string) {
    super(message || `gRPC error code ${code}`);
    this.name = 'GrpcError';
    this.code = code;
  }
}

/**
 * Whether an error is the Farm Table server refusing a write.
 *
 * Server-side authorization (`task:accept` / `task:claim` / close scopes) and
 * the hold/availability gates reject transitions with `PermissionDenied` or
 * `FailedPrecondition`. Those must not be reported as platform (GitHub)
 * failures — the user needs the server's own reason, not advice about their
 * GitHub token. Errors the platform adapter passes through name the platform
 * in their message, so they are excluded here and fall through to the
 * platform-specific branches.
 */
export function isServerRejection(error: unknown): error is GrpcError {
  return (
    error instanceof GrpcError &&
    (error.code === grpc.Code.PermissionDenied || error.code === grpc.Code.FailedPrecondition) &&
    !/github/i.test(error.message)
  );
}
