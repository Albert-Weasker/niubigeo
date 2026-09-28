export class ProviderConnectionInputError extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}
