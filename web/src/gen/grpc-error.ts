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
