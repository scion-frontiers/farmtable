import { grpc } from '@improbable-eng/grpc-web';

/**
 * A gRPC error that carries the numeric grpc.Code so callers can inspect
 * the status code without fragile string-matching on the message.
 */
export class GrpcError extends Error {
  readonly code: number;

  constructor(code: number, message?: string) {
    super(message || `gRPC error code ${code}`);
    this.name = 'GrpcError';
    this.code = code;
  }
}

/**
 * Returns true when a gRPC error carries the Unimplemented status code (12).
 */
export function isUnimplementedError(err: unknown): boolean {
  return err instanceof GrpcError && err.code === grpc.Code.Unimplemented;
}
