import { RecognitionAnalysisError } from "./recognition-errors.js";
import type { DomainRecognitionClaim, RecognitionAnalysisStatus, RecognitionFieldIssue } from "./recognition-schema.js";

export const RECOGNITION_ANALYZER_VERSION = "recognition-analysis/v2";
export const RECOGNITION_CURRENT_MAPPING_VERSION = "recognition-current/v1";
export const RECOGNITION_COMPATIBILITY_MAPPING_VERSION = "recognition-compatibility/v1";

export interface StructuredRecognitionValue {
  value: string | null;
  citationUrls: string[];
}

export interface StructuredRecognitionKeyword {
  keyword: string;
  citationUrls: string[];
}

export interface StructuredRecognitionCompetitor {
  name: string;
  domain: string | null;
  businessDescription: string | null;
  productCategory: string | null;
  keywords: StructuredRecognitionKeyword[];
  citationUrls: string[];
}

export interface StructuredRecognitionOutput {
  analysisStatus: Exclude<RecognitionAnalysisStatus, "analysis_failed">;
  domainRecognition: DomainRecognitionClaim | null;
  recognizedBrand: StructuredRecognitionValue;
  businessDescription: StructuredRecognitionValue;
  productCategory: StructuredRecognitionValue;
  detailedDescription: StructuredRecognitionValue;
  competitors: StructuredRecognitionCompetitor[];
  brandKeywords: StructuredRecognitionKeyword[];
  unknowns: string[];
  fieldIssues: RecognitionFieldIssue[];
  mappingVersion: string;
}

type ObjectValue = Record<string, unknown>;

function asObject(value: unknown): ObjectValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null;
}

function addIssue(issues: RecognitionFieldIssue[], field: string, kind: RecognitionFieldIssue["kind"], detail: string, sourcePath?: string): void {
  issues.push({ field, kind, detail, ...(sourcePath ? { sourcePath } : {}) });
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function stringList(value: unknown, field: string, issues: RecognitionFieldIssue[], sourcePath: string): string[] {
  if (!Array.isArray(value)) {
    addIssue(issues, field, value === undefined ? "missing_field" : "invalid_field", `${field} must be an array of strings.`, sourcePath);
    return [];
  }
  const values: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = text(value[index]);
    if (!item) {
      addIssue(issues, `${field}[${index}]`, "invalid_field", `${field}[${index}] must be a non-empty string.`, `${sourcePath}[${index}]`);
      continue;
    }
    values.push(item);
  }
  return values;
}

function currentValue(root: ObjectValue, field: string, issues: RecognitionFieldIssue[]): StructuredRecognitionValue | null {
  const raw = root[field];
  const row = asObject(raw);
  if (!row) {
    if (raw !== undefined) addIssue(issues, field, "invalid_field", `${field} must be an object.`, `$.${field}`);
    return null;
  }
  const value = row.value === null ? null : text(row.value);
  if (row.value !== null && value === null) addIssue(issues, field, "invalid_field", `${field}.value must be a string or null.`, `$.${field}.value`);
  const citationUrls = stringList(row.citationUrls, `${field}.citationUrls`, issues, `$.${field}.citationUrls`);
  return { value, citationUrls };
}

function compatibilityValue(root: ObjectValue, field: string, issues: RecognitionFieldIssue[]): StructuredRecognitionValue {
  const value = text(root[field]);
  if (root[field] === undefined) addIssue(issues, field, "missing_field", `The response did not provide ${field}.`, `$.${field}`);
  else if (value === null) addIssue(issues, field, "invalid_field", `${field} must be a string.`, `$.${field}`);
  return { value, citationUrls: [] };
}

function chooseValue(input: {
  root: ObjectValue;
  canonicalField: string;
  compatibilityField: string;
  issues: RecognitionFieldIssue[];
}): StructuredRecognitionValue {
  const current = currentValue(input.root, input.canonicalField, input.issues);
  const legacy = input.root[input.compatibilityField] === undefined
    ? null
    : compatibilityValue(input.root, input.compatibilityField, input.issues);
  if (current && legacy && current.value !== legacy.value) {
    addIssue(input.issues, input.canonicalField, "conflicting_field", `Both ${input.canonicalField} and ${input.compatibilityField} were supplied with different values.`, `$.${input.canonicalField}`);
  }
  if (current) return current;
  if (legacy) return legacy;
  addIssue(input.issues, input.canonicalField, "missing_field", `The response did not provide ${input.canonicalField}.`, `$.${input.canonicalField}`);
  return { value: null, citationUrls: [] };
}

function domainRecognition(root: ObjectValue, issues: RecognitionFieldIssue[]): DomainRecognitionClaim | null {
  const value = root.domainRecognition;
  if (value === undefined) {
    addIssue(issues, "domainRecognition", "missing_field", "The response did not explicitly provide a domain-recognition status.", "$.domainRecognition");
    return null;
  }
  if (value === "recognized" || value === "not_recognized" || value === "unknown") return value;
  addIssue(issues, "domainRecognition", "invalid_field", "domainRecognition must be recognized, not_recognized, or unknown.", "$.domainRecognition");
  return null;
}

function analysisStatus(root: ObjectValue, issues: RecognitionFieldIssue[]): Exclude<RecognitionAnalysisStatus, "analysis_failed"> {
  const value = root.analysisStatus;
  if (value === "recognized" || value === "partially_recognized" || value === "unknown" || value === "ambiguous") return value;
  addIssue(issues, "analysisStatus", value === undefined ? "missing_field" : "invalid_field", "analysisStatus must be recognized, partially_recognized, unknown, or ambiguous.", "$.analysisStatus");
  return "partially_recognized";
}

function keyword(value: unknown, field: string, issues: RecognitionFieldIssue[], sourcePath: string): StructuredRecognitionKeyword | null {
  const row = asObject(value);
  if (!row) {
    addIssue(issues, field, "invalid_field", `${field} must be an object.`, sourcePath);
    return null;
  }
  const entry = text(row.keyword);
  if (!entry) {
    addIssue(issues, `${field}.keyword`, "invalid_field", `${field}.keyword must be non-empty.`, `${sourcePath}.keyword`);
    return null;
  }
  return { keyword: entry, citationUrls: stringList(row.citationUrls, `${field}.citationUrls`, issues, `${sourcePath}.citationUrls`) };
}

function compatibilityKeywords(root: ObjectValue, issues: RecognitionFieldIssue[]): StructuredRecognitionKeyword[] | null {
  const value = root.keywords;
  if (value === undefined) return null;
  const values = stringList(value, "keywords", issues, "$.keywords");
  return values.map((item) => ({ keyword: item, citationUrls: [] }));
}

function brandKeywords(root: ObjectValue, issues: RecognitionFieldIssue[]): StructuredRecognitionKeyword[] {
  const current = root.brandKeywords;
  const legacy = compatibilityKeywords(root, issues);
  if (current === undefined && legacy !== null) return legacy;
  if (!Array.isArray(current)) {
    addIssue(issues, "brandKeywords", current === undefined ? "missing_field" : "invalid_field", "brandKeywords must be an array.", "$.brandKeywords");
    return legacy || [];
  }
  const values: StructuredRecognitionKeyword[] = [];
  for (let index = 0; index < current.length; index += 1) {
    const item = keyword(current[index], `brandKeywords[${index}]`, issues, `$.brandKeywords[${index}]`);
    if (item) values.push(item);
  }
  if (legacy !== null && values.map((item) => item.keyword).join("\u0000") !== legacy.map((item) => item.keyword).join("\u0000")) {
    addIssue(issues, "brandKeywords", "conflicting_field", "Both brandKeywords and keywords were supplied with different values.", "$.brandKeywords");
  }
  return values;
}

function competitor(value: unknown, field: string, issues: RecognitionFieldIssue[], sourcePath: string): StructuredRecognitionCompetitor | null {
  const row = asObject(value);
  if (!row) {
    addIssue(issues, field, "invalid_field", `${field} must be an object.`, sourcePath);
    return null;
  }
  const name = text(row.name);
  if (!name) {
    addIssue(issues, `${field}.name`, "invalid_field", `${field}.name must be non-empty.`, `${sourcePath}.name`);
    return null;
  }
  const domain = row.domain === null ? null : text(row.domain);
  if (row.domain !== null && row.domain !== undefined && domain === null) addIssue(issues, `${field}.domain`, "invalid_field", `${field}.domain must be a string or null.`, `${sourcePath}.domain`);
  const businessDescription = row.businessDescription === null ? null : text(row.businessDescription);
  if (row.businessDescription !== null && row.businessDescription !== undefined && businessDescription === null) addIssue(issues, `${field}.businessDescription`, "invalid_field", `${field}.businessDescription must be a string or null.`, `${sourcePath}.businessDescription`);
  const productCategory = row.productCategory === null ? null : text(row.productCategory);
  if (row.productCategory !== null && row.productCategory !== undefined && productCategory === null) addIssue(issues, `${field}.productCategory`, "invalid_field", `${field}.productCategory must be a string or null.`, `${sourcePath}.productCategory`);
  const keywords: StructuredRecognitionKeyword[] = [];
  if (!Array.isArray(row.keywords)) addIssue(issues, `${field}.keywords`, row.keywords === undefined ? "missing_field" : "invalid_field", `${field}.keywords must be an array.`, `${sourcePath}.keywords`);
  else for (let index = 0; index < row.keywords.length; index += 1) {
    const item = keyword(row.keywords[index], `${field}.keywords[${index}]`, issues, `${sourcePath}.keywords[${index}]`);
    if (item) keywords.push(item);
  }
  return { name, domain, businessDescription, productCategory, keywords, citationUrls: stringList(row.citationUrls, `${field}.citationUrls`, issues, `${sourcePath}.citationUrls`) };
}

function competitors(root: ObjectValue, issues: RecognitionFieldIssue[]): StructuredRecognitionCompetitor[] {
  const value = root.competitors;
  if (!Array.isArray(value)) {
    addIssue(issues, "competitors", value === undefined ? "missing_field" : "invalid_field", "competitors must be an array.", "$.competitors");
    return [];
  }
  const values: StructuredRecognitionCompetitor[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = competitor(value[index], `competitors[${index}]`, issues, `$.competitors[${index}]`);
    if (item) values.push(item);
  }
  return values;
}

function unknowns(root: ObjectValue, issues: RecognitionFieldIssue[]): string[] {
  return stringList(root.unknowns, "unknowns", issues, "$.unknowns");
}

function removeCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const firstLineEnd = trimmed.indexOf("\n");
  const closingFence = trimmed.lastIndexOf("```");
  if (firstLineEnd === -1 || closingFence <= firstLineEnd || closingFence + 3 !== trimmed.length) {
    throw new RecognitionAnalysisError("Structured output code fence is incomplete.");
  }
  const header = trimmed.slice(3, firstLineEnd).trim().toLocaleLowerCase();
  if (header && header !== "json") throw new RecognitionAnalysisError("Structured output code fence must contain JSON only.");
  return trimmed.slice(firstLineEnd + 1, closingFence).trim();
}

function structuredJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(removeCodeFence(value));
  } catch {
    throw new RecognitionAnalysisError("The provider returned structured output that could not be parsed.");
  }
}

function mappingVersion(root: ObjectValue): string {
  return root.domainRecognition !== undefined || root.recognizedBrand !== undefined || root.brandKeywords !== undefined
    ? RECOGNITION_CURRENT_MAPPING_VERSION
    : RECOGNITION_COMPATIBILITY_MAPPING_VERSION;
}

export function parseStructuredRecognitionOutput(value: unknown): StructuredRecognitionOutput {
  const parsed = structuredJson(value);
  const root = asObject(parsed);
  if (!root) throw new RecognitionAnalysisError("Structured recognition output must be an object.");
  const issues: RecognitionFieldIssue[] = [];
  const description = root.description === undefined ? { value: null, citationUrls: [] } : compatibilityValue(root, "description", issues);
  return {
    analysisStatus: analysisStatus(root, issues),
    domainRecognition: domainRecognition(root, issues),
    recognizedBrand: chooseValue({ root, canonicalField: "recognizedBrand", compatibilityField: "brand", issues }),
    businessDescription: chooseValue({ root, canonicalField: "businessDescription", compatibilityField: "business", issues }),
    productCategory: chooseValue({ root, canonicalField: "productCategory", compatibilityField: "category", issues }),
    detailedDescription: description,
    competitors: competitors(root, issues),
    brandKeywords: brandKeywords(root, issues),
    unknowns: unknowns(root, issues),
    fieldIssues: issues,
    mappingVersion: mappingVersion(root),
  };
}
