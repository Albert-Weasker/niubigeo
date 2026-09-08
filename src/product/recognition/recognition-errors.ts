export class RecognitionRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Recognition run ${runId} was not found.`);
  }
}

export class RecognitionModelRunNotFoundError extends Error {
  constructor(modelRunId: string) {
    super(`Recognition model run ${modelRunId} was not found.`);
  }
}

export class RecognitionAttemptNotFoundError extends Error {
  constructor(attemptId: string) {
    super(`Recognition attempt ${attemptId} was not found.`);
  }
}

export class RecognitionInputError extends Error {}

export class RecognitionAnalysisError extends Error {}
