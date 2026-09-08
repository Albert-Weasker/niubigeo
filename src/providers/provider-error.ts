export type ProviderFailureCode =
  | "authentication"
  | "billing"
  | "rate_limited"
  | "timeout"
  | "upstream_unavailable"
  | "unsupported_capability"
  | "empty_answer"
  | "invalid_response"
  | "unknown";

export class ProviderRequestError extends Error {
  readonly code: ProviderFailureCode;
  readonly status: number | null;

  constructor(input: { code: ProviderFailureCode; message: string; status?: number | null | undefined; cause?: unknown }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "ProviderRequestError";
    this.code = input.code;
    this.status = input.status ?? null;
  }
}

export function failureCodeForStatus(status: number): ProviderFailureCode {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "billing";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  if (status >= 400) return "invalid_response";
  return "unknown";
}

export function providerFailureCode(error: unknown): ProviderFailureCode {
  return error instanceof ProviderRequestError ? error.code : "unknown";
}

