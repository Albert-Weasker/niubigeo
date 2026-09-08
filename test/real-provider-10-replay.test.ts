import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

type SeedCase = { caseId: string; domain: string; language: "zh" | "en" };
type Seed = { cases: SeedCase[] };
type Result = {
  case: { caseId: string; domain: string; projectId: string; keyword: string | null; competitorDomain: string | null };
  recognition: Array<{ modelRuns: Array<{ modelId: string; webSearchMode: "off" | "provider_native"; status: string; attemptId: string | null; rawAnswer: string | null; recognition: { providerCitations: Array<{ providerPayloadPath: string }>; answerMentionedUrls: unknown[] } | null }> }>;
  measurement: { runs: Array<{ run: { source: "manual" | "scheduled"; status: string }; modelRuns: Array<{ probes: Array<{ kind: string; subjectDomain: string | null; keyword: string | null; attempts: unknown[] }> }> }>; statsSnapshot: { points: unknown[] } };
  providerLedger: Array<{ purpose: "discovery" | "manual_measurement" | "scheduled_measurement"; projectId: string }>;
  evidenceAudit: { offlineProviderCitationCount: number; providerCitationInvalid: number };
};

const root = process.cwd();
const seedPath = join(root, "examples", "real-provider-10", "seed-manifest.json");
const resultRoot = join(root, "examples", "real-provider-10", "results");
const seed = JSON.parse(readFileSync(seedPath, "utf8")) as Seed;

for (const value of seed.cases) {
  const resultPath = join(resultRoot, `${value.caseId}.public.json`);
  test(`archive replay ${value.caseId} keeps real discovery and two measurement routes distinct`, { skip: !existsSync(resultPath) }, () => {
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as Result;
    assert.equal(result.case.caseId, value.caseId);
    assert.equal(result.case.domain, value.domain);
    assert.ok(result.case.projectId);
    assert.ok(result.providerLedger.some((entry) => entry.purpose === "discovery"));
    assert.ok(result.providerLedger.some((entry) => entry.purpose === "manual_measurement"));
    assert.ok(result.providerLedger.some((entry) => entry.purpose === "scheduled_measurement"));
    assert.ok(result.measurement.runs.some((entry) => entry.run.source === "manual"));
    assert.ok(result.measurement.runs.some((entry) => entry.run.source === "scheduled"));
    assert.ok(result.recognition.flatMap((run) => run.modelRuns).some((model) => model.rawAnswer !== null && model.attemptId !== null));
    assert.equal(result.evidenceAudit.offlineProviderCitationCount, 0);
    assert.equal(result.evidenceAudit.providerCitationInvalid, 0);
    for (const run of result.measurement.runs) {
      for (const model of run.modelRuns) {
        for (const probe of model.probes) {
          if (probe.kind === "target_domain") assert.equal(probe.subjectDomain, value.domain);
          if (probe.kind === "keyword_discovery") assert.ok(probe.keyword && !probe.keyword.includes(value.domain));
        }
      }
    }
    assert.ok(result.measurement.statsSnapshot.points.length > 0);
  });
}
