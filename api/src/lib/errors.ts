// Domain errors thrown by routes; index.ts's error handler maps `code` to HTTP.

export const ERROR_STATUS = {
  VALIDATION: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TRANSITION_CONFLICT: 409,
  CONFLICT: 409,
  UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = code;
  }
  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export const notFound = (m = "not_found") => new DomainError("NOT_FOUND", m);
export const forbidden = (m = "forbidden") => new DomainError("FORBIDDEN", m);
export const invalid = (m: string) => new DomainError("VALIDATION", m);
export const conflict = (m: string) => new DomainError("CONFLICT", m);
export const unavailable = (m: string) => new DomainError("UNAVAILABLE", m);

export function isErrorCode(x: unknown): x is ErrorCode {
  return typeof x === "string" && x in ERROR_STATUS;
}
