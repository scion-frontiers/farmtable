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
