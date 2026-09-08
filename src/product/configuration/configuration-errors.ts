export class ProductConfigurationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductConfigurationInputError";
  }
}

export class ProductModelCatalogUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductModelCatalogUnavailableError";
  }
}

export class ProductBaselineConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductBaselineConflictError";
  }
}

export class ProductBaselineNotFoundError extends Error {
  constructor(baselineId: string) {
    super(`Baseline not found: ${baselineId}`);
    this.name = "ProductBaselineNotFoundError";
  }
}
