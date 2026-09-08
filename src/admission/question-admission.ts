import type { Entity } from "../core/types.js";
import { normalizeDomain } from "../utils/domain.js";
import { compactWhitespace } from "../utils/text.js";
import type { QuestionAdmissionResult } from "./admission-schema.js";

function comparable(value: string): string {
  return compactWhitespace(value.normalize("NFKC")).toLocaleLowerCase();
}

function identityAnchors(target: Entity): string[] {
  const values = [target.name, target.domain, normalizeDomain(target.domain), ...target.aliases];
  const seen = new Set<string>();
  const anchors: string[] = [];
  for (const value of values) {
    const anchor = comparable(value);
    if (!anchor || seen.has(anchor)) continue;
    seen.add(anchor);
    anchors.push(anchor);
  }
  return anchors;
}

export function admitConfirmedQuestion(input: {
  question: string;
  target: Entity;
  scopeConfirmed: boolean;
}): QuestionAdmissionResult {
  if (!input.scopeConfirmed) {
    return { accepted: false, matchedIdentity: null, failureCode: "scope_confirmation_required" };
  }
  const question = comparable(input.question);
  if (!question) return { accepted: false, matchedIdentity: null, failureCode: "empty_question" };
  const matchedIdentity = identityAnchors(input.target).find((anchor) => question.includes(anchor)) || null;
  if (!matchedIdentity) return { accepted: false, matchedIdentity: null, failureCode: "target_identity_missing" };
  return { accepted: true, matchedIdentity, failureCode: null };
}

export function assertConfirmedQuestions(input: {
  questions: string[];
  target: Entity;
  scopeConfirmed: boolean;
}): QuestionAdmissionResult[] {
  const results = input.questions.map((question) => admitConfirmedQuestion({
    question,
    target: input.target,
    scopeConfirmed: input.scopeConfirmed,
  }));
  const rejected = results.find((result) => !result.accepted);
  if (rejected) {
    const error = new Error(rejected.failureCode || "question_rejected");
    error.name = "QuestionAdmissionError";
    throw error;
  }
  return results;
}

