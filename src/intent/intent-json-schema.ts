import {
  ANSWER_QUALITY,
  DISPLAY_MODES,
  ENTITY_IDENTITY_STATUSES,
  ENTITY_RELATIONSHIPS,
  ENTITY_ROLES,
  ENTITY_TYPES,
  EXPECTED_ANSWER_TYPES,
  INTENT_NAMES,
  TARGET_BRAND_ROLES,
  TASK_STATUSES,
  UNCERTAINTY_LEVELS,
} from "./intent-schema.js";

function stringArray(maxItems: number): Record<string, unknown> {
  return { type: "array", maxItems, items: { type: "string" } };
}

export function intentRunJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["promptIntent", "tasks", "answerAssessment", "entities", "adaptedResult"],
    properties: {
      promptIntent: {
        type: "object",
        additionalProperties: false,
        required: [
          "primaryIntent",
          "secondaryIntents",
          "requestedOutputs",
          "targetBrandRole",
          "requiresSources",
          "requiresComparison",
          "requiresRecommendation",
          "candidateApplicable",
          "recommendationApplicable",
          "uncertainty",
        ],
        properties: {
          primaryIntent: { type: "string", enum: [...INTENT_NAMES] },
          secondaryIntents: { type: "array", maxItems: 5, items: { type: "string", enum: [...INTENT_NAMES] } },
          requestedOutputs: stringArray(12),
          targetBrandRole: { type: "string", enum: [...TARGET_BRAND_ROLES] },
          requiresSources: { type: "boolean" },
          requiresComparison: { type: "boolean" },
          requiresRecommendation: { type: "boolean" },
          candidateApplicable: { type: "boolean" },
          recommendationApplicable: { type: "boolean" },
          uncertainty: { type: "string", enum: [...UNCERTAINTY_LEVELS] },
        },
      },
      tasks: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "requirement", "expectedAnswerType"],
          properties: {
            id: { type: "string" },
            requirement: { type: "string" },
            expectedAnswerType: { type: "string", enum: [...EXPECTED_ANSWER_TYPES] },
          },
        },
      },
      answerAssessment: {
        type: "object",
        additionalProperties: false,
        required: ["taskResults", "overallAnswerQuality", "missingRequirements"],
        properties: {
          taskResults: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["taskId", "status", "evidenceQuote", "explanation", "sourceUrls"],
              properties: {
                taskId: { type: "string" },
                status: { type: "string", enum: [...TASK_STATUSES] },
                evidenceQuote: { type: "string" },
                explanation: { type: "string" },
                sourceUrls: stringArray(5),
              },
            },
          },
          overallAnswerQuality: { type: "string", enum: [...ANSWER_QUALITY] },
          missingRequirements: stringArray(8),
        },
      },
      entities: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "name",
            "canonicalName",
            "canonicalUrl",
            "entityType",
            "identityStatus",
            "entityRole",
            "relationshipToQuestion",
            "relationshipToTarget",
            "confidence",
            "evidenceQuote",
            "explanation",
            "sourceUrls",
          ],
          properties: {
            name: { type: "string" },
            canonicalName: { type: "string" },
            canonicalUrl: { type: "string" },
            entityType: { type: "string", enum: [...ENTITY_TYPES] },
            identityStatus: { type: "string", enum: [...ENTITY_IDENTITY_STATUSES] },
            entityRole: { type: "string", enum: [...ENTITY_ROLES] },
            relationshipToQuestion: { type: "string", enum: [...ENTITY_RELATIONSHIPS] },
            relationshipToTarget: { type: "string", enum: [...ENTITY_RELATIONSHIPS] },
            confidence: { type: "string", enum: [...UNCERTAINTY_LEVELS] },
            evidenceQuote: { type: "string" },
            explanation: { type: "string" },
            sourceUrls: stringArray(5),
          },
        },
      },
      adaptedResult: {
        type: "object",
        additionalProperties: false,
        required: ["displayMode", "oneSentence", "userQuestion", "answered", "missing", "uncertain", "entityInsights"],
        properties: {
          displayMode: { type: "string", enum: [...DISPLAY_MODES] },
          oneSentence: { type: "string" },
          userQuestion: { type: "string" },
          answered: stringArray(6),
          missing: stringArray(6),
          uncertain: stringArray(6),
          entityInsights: stringArray(10),
        },
      },
    },
  };
}
