import { SiteEvidenceCollector } from "../keywords/site-evidence.js";
import { normalizeDomain } from "../utils/domain.js";
import type { SitePreparationResult } from "./preparation-schema.js";

export interface SitePreparationCollector {
  collect(input: { submittedDomain: string; maxPages?: number | undefined; githubRepo?: string | undefined }): Promise<import("../core/types.js").SiteEvidence>;
}

export class SitePreparationService {
  constructor(private readonly collector: SitePreparationCollector = new SiteEvidenceCollector()) {}

  async prepare(input: { domain: string; maxPages?: number | undefined; githubRepo?: string | undefined }): Promise<SitePreparationResult> {
    const domain = normalizeDomain(input.domain);
    try {
      const evidence = await this.collector.collect({
        submittedDomain: domain,
        maxPages: input.maxPages,
        githubRepo: input.githubRepo,
      });
      if (evidence.pages.length === 0 && !evidence.github) {
        return { status: "unavailable", domain, evidence: null, failureCode: "no_evidence", message: "No public site evidence was collected." };
      }
      return { status: "available", domain, evidence, failureCode: null, message: null };
    } catch (error) {
      return {
        status: "unavailable",
        domain,
        evidence: null,
        failureCode: "unreachable",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

