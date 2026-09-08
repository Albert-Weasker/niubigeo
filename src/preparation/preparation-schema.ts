import type { SiteEvidence } from "../core/types.js";

export type SitePreparationFailureCode = "unreachable" | "no_evidence" | "unknown";

export interface SitePreparationResult {
  status: "available" | "unavailable";
  domain: string;
  evidence: SiteEvidence | null;
  failureCode: SitePreparationFailureCode | null;
  message: string | null;
}

