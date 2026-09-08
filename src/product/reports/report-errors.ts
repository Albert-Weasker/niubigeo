export class RecognitionReportNotFoundError extends Error {
  constructor(reportId: string) {
    super(`Recognition report ${reportId} was not found.`);
  }
}

export class RecognitionReportInputError extends Error {}

export class RecognitionReportSnapshotChangedError extends Error {
  constructor() {
    super("Recognition evidence changed while the report snapshot was being prepared. Try again after the current retry finishes.");
  }
}

export class RecognitionReportEvidenceIntegrityError extends Error {
  constructor(message: string) {
    super(message);
  }
}
