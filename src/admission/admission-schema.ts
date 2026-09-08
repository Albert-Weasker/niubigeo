export type QuestionAdmissionFailureCode =
  | "scope_confirmation_required"
  | "empty_question"
  | "target_identity_missing";

export interface QuestionAdmissionResult {
  accepted: boolean;
  matchedIdentity: string | null;
  failureCode: QuestionAdmissionFailureCode | null;
}

