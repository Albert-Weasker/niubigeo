import { sha256 } from "../../utils/hash.js";

export interface RecognitionProtocolSnapshot {
  protocolId: "domain-recognition";
  protocolVersion: string;
  inputType: "domain_only";
  requestedFields: [
    "domainRecognition",
    "brandIdentity",
    "businessDescription",
    "productCategory",
    "competitors",
    "brandKeywords",
    "competitorKeywords",
    "citations",
    "unknowns",
  ];
  promptTemplateHash: string;
}

const RECOGNITION_PROTOCOL_TEMPLATE = [
  "You receive one domain and no website content.",
  "State only what you can establish from the model response and provider-native citations.",
  "Return unknown when the domain or brand cannot be recognized.",
  "Do not invent URLs, competitors, keywords, or sources.",
  "Keep provider citations separate from ordinary URLs in answer text.",
].join("\n");

const REQUESTED_FIELDS: RecognitionProtocolSnapshot["requestedFields"] = [
  "domainRecognition",
  "brandIdentity",
  "businessDescription",
  "productCategory",
  "competitors",
  "brandKeywords",
  "competitorKeywords",
  "citations",
  "unknowns",
];

export const DOMAIN_RECOGNITION_PROTOCOL_VERSION = "v1";
export const DOMAIN_RECOGNITION_ANALYSIS_VERSION = "recognition-analysis/v1";

export function recognitionProtocolLanguage(value: string): "zh" | "en" {
  const language = value.trim().toLocaleLowerCase().split("-")[0];
  return language === "zh" ? "zh" : "en";
}

export function recognitionProtocolSnapshot(): RecognitionProtocolSnapshot {
  return {
    protocolId: "domain-recognition",
    protocolVersion: DOMAIN_RECOGNITION_PROTOCOL_VERSION,
    inputType: "domain_only",
    requestedFields: [...REQUESTED_FIELDS],
    promptTemplateHash: sha256(RECOGNITION_PROTOCOL_TEMPLATE),
  };
}
