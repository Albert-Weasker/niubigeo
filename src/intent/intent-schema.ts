export const INTENT_SCHEMA_VERSION = "intent-v1" as const;

export const INTENT_NAMES = [
  "recommendation",
  "comparison",
  "alternative",
  "brand_evaluation",
  "fact",
  "pricing",
  "tutorial",
  "troubleshooting",
  "source_finding",
  "industry_research",
  "risk_assessment",
  "open_exploration",
  "mixed",
  "unclear",
  "other",
] as const;

export const TARGET_BRAND_ROLES = ["subject", "candidate_to_evaluate", "comparison_party", "not_mentioned", "unclear"] as const;

export const UNCERTAINTY_LEVELS = ["low", "medium", "high"] as const;

export const EXPECTED_ANSWER_TYPES = [
  "list_of_options",
  "recommendation_reasons",
  "brand_judgment",
  "brand_judgment_reason",
  "comparison_dimensions",
  "comparison_conclusion",
  "alternative_options",
  "factual_summary",
  "price",
  "plan_limits",
  "source_list",
  "steps",
  "prerequisites",
  "cause",
  "fix",
  "risk",
  "open_analysis",
  "other",
] as const;

export const TASK_STATUSES = ["completed", "partial", "missing", "unknown"] as const;

export const ANSWER_QUALITY = ["complete", "partial", "poor", "uncertain"] as const;

export const ENTITY_TYPES = [
  "brand",
  "product",
  "company",
  "platform",
  "source",
  "person",
  "organization",
  "concept",
  "place",
  "other",
  "unknown",
] as const;

export const ENTITY_RELATIONSHIPS = [
  "recommended_option",
  "compared_option",
  "direct_alternative",
  "indirect_alternative",
  "channel",
  "source",
  "integration",
  "example",
  "customer",
  "partner",
  "evaluated_candidate",
  "target",
  "competitor",
  "unrelated",
  "unclear",
] as const;

export const DISPLAY_MODES = [
  "recommendation",
  "comparison",
  "alternative",
  "brand_evaluation",
  "fact",
  "pricing",
  "tutorial",
  "troubleshooting",
  "source_finding",
  "industry_research",
  "risk_assessment",
  "open_exploration",
  "task_completion",
] as const;

export type IntentName = (typeof INTENT_NAMES)[number];
export type TargetBrandRole = (typeof TARGET_BRAND_ROLES)[number];
export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number];
export type ExpectedAnswerType = (typeof EXPECTED_ANSWER_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type OverallAnswerQuality = (typeof ANSWER_QUALITY)[number];
export type IntentEntityType = (typeof ENTITY_TYPES)[number];
export type EntityRelationshipType = (typeof ENTITY_RELATIONSHIPS)[number];
export type IntentDisplayMode = (typeof DISPLAY_MODES)[number];

export interface IntentAnalysis {
  primaryIntent: IntentName;
  secondaryIntents: IntentName[];
  requestedOutputs: string[];
  targetBrandRole: TargetBrandRole;
  requiresSources: boolean;
  requiresComparison: boolean;
  requiresRecommendation: boolean;
  uncertainty: UncertaintyLevel;
}

export interface AnswerTask {
  id: string;
  requirement: string;
  expectedAnswerType: ExpectedAnswerType;
}

export interface TaskAssessment {
  taskId: string;
  status: TaskStatus;
  evidenceQuote?: string | undefined;
  explanation: string;
  sourceUrls: string[];
}

export interface AnswerAssessment {
  taskResults: TaskAssessment[];
  overallAnswerQuality: OverallAnswerQuality;
  missingRequirements: string[];
}

export interface EntityRelationship {
  name: string;
  entityType: IntentEntityType;
  relationshipToQuestion: EntityRelationshipType;
  relationshipToTarget: EntityRelationshipType;
  confidence: UncertaintyLevel;
  evidenceQuote?: string | undefined;
  explanation: string;
  sourceUrls: string[];
}

export interface IntentReportCard {
  displayMode: IntentDisplayMode;
  oneSentence: string;
  userQuestion: string;
  answered: string[];
  missing: string[];
  uncertain: string[];
  entityInsights: string[];
}

export interface IntentRunAnalysis {
  schemaVersion: typeof INTENT_SCHEMA_VERSION;
  promptIntent: IntentAnalysis;
  tasks: AnswerTask[];
  taskResults: TaskAssessment[];
  entities: EntityRelationship[];
  adaptedResult: IntentReportCard;
  analyzer: {
    providerId: string;
    model: string;
    sourceLabel: string;
  };
  status: "completed" | "failed";
  error?: string | undefined;
}

export interface IntentValidationContext {
  userQuestion: string;
  language?: string | undefined;
  answerText: string;
  citationUrls: string[];
  analyzer: {
    providerId: string;
    model: string;
    sourceLabel: string;
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function stringList(value: unknown, limit: number): string[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const text = stringValue(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  const text = stringValue(value);
  return (allowed as readonly string[]).includes(text) ? (text as T[number]) : fallback;
}

function intentList(value: unknown): IntentName[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<IntentName>();
  const out: IntentName[] = [];
  for (const item of raw) {
    const intent = enumValue(item, INTENT_NAMES, "other");
    if (seen.has(intent)) continue;
    seen.add(intent);
    out.push(intent);
    if (out.length >= 5) break;
  }
  return out;
}

function canonicalUrl(value: string): string | undefined {
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function allowedSourceUrls(value: unknown, citationUrls: string[]): string[] {
  const allowed = new Set(citationUrls.map((url) => canonicalUrl(url)).filter((url): url is string => Boolean(url)));
  const raw = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (const item of raw) {
    const url = canonicalUrl(stringValue(item));
    if (!url || !allowed.has(url) || out.includes(url)) continue;
    out.push(url);
    if (out.length >= 5) break;
  }
  return out;
}

function validEvidenceQuote(value: unknown, answerText: string): string | undefined {
  const quote = stringValue(value);
  if (!quote) return undefined;
  return answerText.includes(quote) ? quote : undefined;
}

function looksChinese(value: string): boolean {
  if (value.trim().toLowerCase().startsWith("zh")) return true;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 19968 && code <= 40959) return true;
  }
  return false;
}

function localized(context: IntentValidationContext, zh: string, en: string): string {
  return looksChinese(context.language || context.userQuestion) ? zh : en;
}

export function validateIntentAnalysis(value: unknown): IntentAnalysis {
  const row = asObject(value) || {};
  return {
    primaryIntent: enumValue(row.primaryIntent, INTENT_NAMES, "unclear"),
    secondaryIntents: intentList(row.secondaryIntents),
    requestedOutputs: stringList(row.requestedOutputs, 12),
    targetBrandRole: enumValue(row.targetBrandRole, TARGET_BRAND_ROLES, "unclear"),
    requiresSources: booleanValue(row.requiresSources),
    requiresComparison: booleanValue(row.requiresComparison),
    requiresRecommendation: booleanValue(row.requiresRecommendation),
    uncertainty: enumValue(row.uncertainty, UNCERTAINTY_LEVELS, "high"),
  };
}

export function validateAnswerTasks(value: unknown): AnswerTask[] {
  const raw = Array.isArray(value) ? value : [];
  const out: AnswerTask[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const row = asObject(item);
    if (!row) continue;
    const requirement = stringValue(row.requirement);
    if (!requirement) continue;
    const id = stringValue(row.id) || `task_${out.length + 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      requirement,
      expectedAnswerType: enumValue(row.expectedAnswerType, EXPECTED_ANSWER_TYPES, "other"),
    });
    if (out.length >= 12) break;
  }
  return out;
}

function taskIds(tasks: AnswerTask[]): Set<string> {
  return new Set(tasks.map((task) => task.id));
}

export function validateTaskAssessments(value: unknown, tasks: AnswerTask[], context: IntentValidationContext): TaskAssessment[] {
  const raw = Array.isArray(value) ? value : [];
  const allowedTasks = taskIds(tasks);
  const out: TaskAssessment[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    const row = asObject(item);
    if (!row) continue;
    const taskId = stringValue(row.taskId);
    if (!taskId || !allowedTasks.has(taskId) || seen.has(taskId)) continue;
    seen.add(taskId);
    const sourceUrls = allowedSourceUrls(row.sourceUrls, context.citationUrls);
    const evidenceQuote = validEvidenceQuote(row.evidenceQuote, context.answerText);
    const requestedStatus = enumValue(row.status, TASK_STATUSES, "unknown");
    const status = requestedStatus === "completed" || requestedStatus === "partial" ? (evidenceQuote ? requestedStatus : "unknown") : requestedStatus;
    const explanation = requestedStatus !== status
      ? localized(context, "分析给出的证据片段无法在原始回答中核验。", "The provided evidence quote could not be verified in the original answer.")
      : stringValue(row.explanation) || (status === "unknown" ? localized(context, "证据不足，无法判断这项任务是否完成。", "Evidence was not clear enough to assess this task.") : localized(context, "没有提供说明。", "No explanation provided."));
    const assessment: TaskAssessment = {
      taskId,
      status,
      explanation,
      sourceUrls,
    };
    if (evidenceQuote) assessment.evidenceQuote = evidenceQuote;
    out.push(assessment);
  }

  for (const task of tasks) {
    if (seen.has(task.id)) continue;
    out.push({
      taskId: task.id,
      status: "unknown",
      explanation: localized(context, "分析没有为这项任务提供可用判断。", "The analysis did not provide a usable assessment for this task."),
      sourceUrls: [],
    });
  }

  return out;
}

export function validateAnswerAssessment(value: unknown, tasks: AnswerTask[], context: IntentValidationContext): AnswerAssessment {
  const row = asObject(value) || {};
  const taskResults = validateTaskAssessments(row.taskResults, tasks, context);
  return {
    taskResults,
    overallAnswerQuality: enumValue(row.overallAnswerQuality, ANSWER_QUALITY, "uncertain"),
    missingRequirements: stringList(row.missingRequirements, 8),
  };
}

export function validateEntityRelationships(value: unknown, context: IntentValidationContext): EntityRelationship[] {
  const raw = Array.isArray(value) ? value : [];
  const out: EntityRelationship[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const row = asObject(item);
    if (!row) continue;
    const name = stringValue(row.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const evidenceQuote = validEvidenceQuote(row.evidenceQuote, context.answerText);
    const entity: EntityRelationship = {
      name,
      entityType: enumValue(row.entityType, ENTITY_TYPES, "unknown"),
      relationshipToQuestion: enumValue(row.relationshipToQuestion, ENTITY_RELATIONSHIPS, "unclear"),
      relationshipToTarget: enumValue(row.relationshipToTarget, ENTITY_RELATIONSHIPS, "unclear"),
      confidence: enumValue(row.confidence, UNCERTAINTY_LEVELS, "high"),
      explanation: stringValue(row.explanation) || "No clear relationship explanation was provided.",
      sourceUrls: allowedSourceUrls(row.sourceUrls, context.citationUrls),
    };
    if (evidenceQuote) entity.evidenceQuote = evidenceQuote;
    out.push(entity);
    if (out.length >= 20) break;
  }
  return out;
}

export function displayModeForIntent(intent: IntentName): IntentDisplayMode {
  if (intent === "recommendation") return "recommendation";
  if (intent === "comparison") return "comparison";
  if (intent === "alternative") return "alternative";
  if (intent === "brand_evaluation") return "brand_evaluation";
  if (intent === "fact") return "fact";
  if (intent === "pricing") return "pricing";
  if (intent === "tutorial") return "tutorial";
  if (intent === "troubleshooting") return "troubleshooting";
  if (intent === "source_finding") return "source_finding";
  if (intent === "industry_research") return "industry_research";
  if (intent === "risk_assessment") return "risk_assessment";
  if (intent === "open_exploration") return "open_exploration";
  return "task_completion";
}

export function validateIntentReportCard(value: unknown, intent: IntentAnalysis, context: IntentValidationContext): IntentReportCard {
  const row = asObject(value) || {};
  const oneSentence = stringValue(row.oneSentence) || "The answer needs review against the user's requested tasks.";
  const userQuestion = stringValue(row.userQuestion) || context.userQuestion;
  return {
    displayMode: enumValue(row.displayMode, DISPLAY_MODES, displayModeForIntent(intent.primaryIntent)),
    oneSentence,
    userQuestion,
    answered: stringList(row.answered, 6),
    missing: stringList(row.missing, 6),
    uncertain: stringList(row.uncertain, 6),
    entityInsights: stringList(row.entityInsights, 10),
  };
}

export function validateIntentRunAnalysis(value: unknown, context: IntentValidationContext): IntentRunAnalysis {
  const row = asObject(value) || {};
  const promptIntent = validateIntentAnalysis(row.promptIntent);
  const tasks = validateAnswerTasks(row.tasks);
  const answerAssessment = validateAnswerAssessment(row.answerAssessment, tasks, context);
  return {
    schemaVersion: INTENT_SCHEMA_VERSION,
    promptIntent,
    tasks,
    taskResults: answerAssessment.taskResults,
    entities: validateEntityRelationships(row.entities, context),
    adaptedResult: validateIntentReportCard(row.adaptedResult, promptIntent, context),
    analyzer: context.analyzer,
    status: "completed",
  };
}

export function failedIntentRunAnalysis(context: IntentValidationContext, error: string): IntentRunAnalysis {
  const promptIntent: IntentAnalysis = {
    primaryIntent: "unclear",
    secondaryIntents: [],
    requestedOutputs: [],
    targetBrandRole: "unclear",
    requiresSources: false,
    requiresComparison: false,
    requiresRecommendation: false,
    uncertainty: "high",
  };
  return {
    schemaVersion: INTENT_SCHEMA_VERSION,
    promptIntent,
    tasks: [],
    taskResults: [],
    entities: [],
    adaptedResult: {
      displayMode: "task_completion",
      oneSentence: "The answer could not be assessed by the intent layer.",
      userQuestion: context.userQuestion,
      answered: [],
      missing: [],
      uncertain: ["Intent analysis failed."],
      entityInsights: [],
    },
    analyzer: context.analyzer,
    status: "failed",
    error,
  };
}
