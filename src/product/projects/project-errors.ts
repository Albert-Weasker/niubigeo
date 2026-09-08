export class ProductProjectInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductProjectInputError";
  }
}

export class ProductProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = "ProductProjectNotFoundError";
  }
}

export class ProductProjectConflictError extends Error {
  constructor(domain: string) {
    super(`A non-deleted project already uses ${domain}.`);
    this.name = "ProductProjectConflictError";
  }
}

export class ProductProjectStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductProjectStateError";
  }
}
