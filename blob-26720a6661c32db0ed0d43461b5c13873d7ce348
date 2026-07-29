import { grpc } from '@improbable-eng/grpc-web';

/**
 * A gRPC error that carries the numeric grpc.Code so callers can inspect
 * the status code without fragile string-matching on the message.
 */
export class GrpcError extends Error {
<<<<<<< HEAD
  readonly code: grpc.Code;

  constructor(code: grpc.Code, message?: string) {
=======
  readonly code: number;

  constructor(code: number, message?: string) {
>>>>>>> 203271e (fix: use typed gRPC errors for reliable Unimplemented detection)
    super(message || `gRPC error code ${code}`);
    this.name = 'GrpcError';
    this.code = code;
  }
}
<<<<<<< HEAD
=======

/**
 * Returns true when a gRPC error carries the Unimplemented status code (12).
 */
export function isUnimplementedError(err: unknown): boolean {
  return err instanceof GrpcError && err.code === grpc.Code.Unimplemented;
}
>>>>>>> 203271e (fix: use typed gRPC errors for reliable Unimplemented detection)
