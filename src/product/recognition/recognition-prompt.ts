import { sha256 } from "../../utils/hash.js";
import type { RecognitionProtocolSnapshot } from "../configuration/recognition-protocol.js";

export const DOMAIN_RECOGNITION_SCHEMA_NAME = "domain_recognition_result";
export const DOMAIN_RECOGNITION_TOOL_DESCRIPTION = "Record this domain-recognition observation using the required schema.";

type Schema = Record<string, unknown>;

const nullableString: Schema = { type: ["string", "null"] };
const stringArray: Schema = { type: "array", items: { type: "string" } };
const citedValue: Schema = {
  type: "object",
  description: "A model observation with only provider-native citation URLs from this response.",
  additionalProperties: false,
  required: ["value", "citationUrls"],
  properties: {
    value: nullableString,
    citationUrls: stringArray,
  },
};
const keyword: Schema = {
  type: "object",
  description: "A keyword the model associates with the domain or a named competitor.",
  additionalProperties: false,
  required: ["keyword", "citationUrls"],
  properties: {
    keyword: { type: "string" },
    citationUrls: stringArray,
  },
};
const competitor: Schema = {
  type: "object",
  description: "A competitor identified by this model. Use an empty array when none can be established.",
  additionalProperties: false,
  required: ["name", "domain", "businessDescription", "productCategory", "keywords", "citationUrls"],
  properties: {
    name: { type: "string" },
    domain: nullableString,
    businessDescription: nullableString,
    productCategory: nullableString,
    keywords: { type: "array", items: keyword },
    citationUrls: stringArray,
  },
};

export const domainRecognitionResponseSchema: Schema = {
  type: "object",
  description: "A domain-recognition observation. This records what the model identifies in this request, not external market facts.",
  additionalProperties: false,
  required: [
    "domainRecognition",
    "analysisStatus",
    "recognizedBrand",
    "businessDescription",
    "productCategory",
    "competitors",
    "brandKeywords",
    "unknowns",
  ],
  properties: {
    domainRecognition: {
      type: "string",
      enum: ["recognized", "not_recognized", "unknown"],
      description: "recognized when the model can identify the domain, not_recognized when it cannot, unknown when it cannot determine the result.",
    },
    analysisStatus: {
      type: "string",
      enum: ["recognized", "partially_recognized", "unknown", "ambiguous"],
      description: "The completeness and certainty of this model observation. Use unknown when nothing is established and ambiguous when multiple plausible identities remain.",
    },
    recognizedBrand: citedValue,
    businessDescription: citedValue,
    productCategory: citedValue,
    competitors: { type: "array", items: competitor },
    brandKeywords: { type: "array", items: keyword },
    unknowns: stringArray,
  },
};

export const DOMAIN_RECOGNITION_SCHEMA_HASH = sha256(JSON.stringify(domainRecognitionResponseSchema));

function languageInstruction(language: "zh" | "en"): string {
  return language === "zh"
    ? "所有字符串值使用简体中文。"
    : "Use English for all string values.";
}

export function domainRecognitionPrompt(input: {
  normalizedDomain: string;
  language: "zh" | "en";
  protocol: RecognitionProtocolSnapshot;
}): string {
  return [
    "Analyze only the supplied domain.",
    `Domain: ${input.normalizedDomain}`,
    `Protocol: ${input.protocol.protocolId}/${input.protocol.protocolVersion}`,
    "Do not use website content supplied by the caller. No website content has been supplied.",
    "Do not infer market facts. Describe only this model response or provider-native citations from this request.",
    "If the domain, brand, business, category, competitor, or keyword cannot be established, use null, an empty array, or unknown.",
    "Only list a citation URL when it is returned as a provider-native citation in this same response. Do not turn ordinary URLs in the answer into citations.",
    "Return exactly the requested JSON schema and no prose outside it.",
    languageInstruction(input.language),
  ].join("\n");
}
