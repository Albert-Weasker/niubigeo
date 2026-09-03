import type { AuditMetrics, AuditRun, Citation, FractionMetric, GapArea, GapFinding, GapSeverity, GeoGapAnalysis } from "../core/types.js";

function fractionText(metric: FractionMetric): string {
  if (metric.value === null) return `n/a (${metric.numerator}/${metric.denominator})`;
  const rounded = Math.round(metric.value * 1000) / 10;
  return `${rounded.toFixed(1).replace(/\.0$/, "")}% (${metric.numerator}/${metric.denominator})`;
}

function severityForZero(metric: FractionMetric, denominatorThreshold = 1): GapSeverity {
  if (metric.denominator >= denominatorThreshold && metric.numerator === 0) return "critical";
  return "warning";
}

function completedCitations(audit: AuditRun): Citation[] {
  return audit.runs.filter((run) => run.status === "completed").flatMap((run) => run.analysis?.citations || []);
}

function shortList(values: string[], limit = 5): string {
  const unique = [...new Set(values.filter(Boolean))];
  const visible = unique.slice(0, limit);
  const suffix = unique.length > limit ? `, +${unique.length - limit} more` : "";
  return visible.length ? `${visible.join(", ")}${suffix}` : "none";
}

function lowerThanBaseline(metric: FractionMetric, baseline: FractionMetric, drop = 0.2): boolean {
  if (metric.value === null || baseline.value === null) return false;
  return baseline.value - metric.value >= drop;
}

function gapKey(finding: GapFinding): string {
  return `${finding.area}:${finding.severity}:${finding.title}`;
}

export class GeoGapAnalyzer {
  analyze(audit: AuditRun, metrics: AuditMetrics): GeoGapAnalysis {
    const findings: GapFinding[] = [];
    const seen = new Set<string>();

    const push = (finding: GapFinding) => {
      const key = gapKey(finding);
      if (seen.has(key)) return;
      seen.add(key);
      findings.push(finding);
    };

    for (const slice of metrics.slices.filter((item) => item.sliceType === "provider_model")) {
      if (slice.validResponses === 0) {
        push({
          area: "provider",
          severity: "critical",
          title: `${slice.label} returned no completed answers`,
          evidence: `${slice.failedResponses} failed response(s), 0 completed response(s).`,
          recommendation: "Fix the provider/model configuration or API access before reading visibility metrics from this slice.",
        });
        continue;
      }

      if (slice.mentionRate.numerator === 0 || lowerThanBaseline(slice.mentionRate, metrics.mentionRate)) {
        push({
          area: "provider",
          severity: severityForZero(slice.mentionRate),
          title: `${slice.label} has weak target mentions`,
          evidence: `Slice Mention Rate is ${fractionText(slice.mentionRate)}; overall Mention Rate is ${fractionText(metrics.mentionRate)}.`,
          recommendation: "Inspect this model's raw answers, then improve the pages and third-party sources that answer the weak prompt categories for this model.",
        });
      }

      if (slice.citationRate.numerator === 0 || lowerThanBaseline(slice.citationRate, metrics.citationRate)) {
        push({
          area: "citation",
          severity: severityForZero(slice.citationRate),
          title: `${slice.label} rarely cites official target sources`,
          evidence: `Slice Citation Rate is ${fractionText(slice.citationRate)}; overall Citation Rate is ${fractionText(metrics.citationRate)}.`,
          recommendation: "Strengthen crawlable official docs, GitHub README, comparison pages, and pages that directly answer the monitored prompts.",
        });
      }
    }

    const competitorOnlyOutcomes = metrics.promptOutcomes.filter(
      (outcome) => outcome.status === "completed" && !outcome.targetMentioned && outcome.competitorMentions.length > 0,
    );
    if (competitorOnlyOutcomes.length > 0) {
      push({
        area: "prompt",
        severity: "critical",
        title: "Some prompts mention competitors but not the target",
        evidence: `${competitorOnlyOutcomes.length} completed prompt result(s): ${shortList(
          competitorOnlyOutcomes.map((item) => `${item.providerId}/${item.model}/${item.promptId}`),
        )}. Competitors seen: ${shortList(competitorOnlyOutcomes.flatMap((item) => item.competitorMentions))}.`,
        recommendation: "Treat these prompts as priority GEO work: create or improve authoritative content that answers the exact query intent.",
      });
    }

    const lostWinnerOutcomes = metrics.promptOutcomes.filter(
      (outcome) => outcome.status === "completed" && outcome.winner && outcome.winner !== audit.target.name,
    );
    if (lostWinnerOutcomes.length > 0) {
      push({
        area: "position",
        severity: "warning",
        title: "The target is not first in some recommendation or comparison answers",
        evidence: `${lostWinnerOutcomes.length} completed prompt result(s) had another winner. Winners: ${shortList(
          lostWinnerOutcomes.map((item) => item.winner || ""),
        )}.`,
        recommendation: "Build stronger comparison, alternative, and best-tools pages with clear positioning against the named competitors.",
      });
    }

    if (metrics.mentionedWithoutOfficialCitation > 0) {
      push({
        area: "citation",
        severity: "warning",
        title: "The target is mentioned without official citations",
        evidence: `${metrics.mentionedWithoutOfficialCitation} completed answer(s) named ${audit.target.name} but did not cite ${audit.target.domain}.`,
        recommendation: "Make official pages easier to cite: stable URLs, clear titles, concise factual descriptions, docs, README, changelog, and comparison pages.",
      });
    }

    if (metrics.citedWithoutProseMention > 0) {
      push({
        area: "citation",
        severity: "info",
        title: "Official sources appear without prose brand mention",
        evidence: `${metrics.citedWithoutProseMention} completed answer(s) cited an official URL but did not name ${audit.target.name} in prose.`,
        recommendation: "Align official page titles and metadata so provider summaries connect the source domain back to the brand name.",
      });
    }

    for (const keyword of metrics.keywordMetrics.filter((item) => item.validResponses > 0).slice(0, 12)) {
      if (keyword.mentionRate.numerator === 0 && keyword.competitorOnlyRate.numerator > 0) {
        push({
          area: "keyword",
          severity: "critical",
          title: `${keyword.phrase} is competitor-owned in AI answers`,
          evidence: `Target Mention Rate is ${fractionText(keyword.mentionRate)}, while competitor-only answers are ${fractionText(keyword.competitorOnlyRate)}. Top competitors: ${shortList(keyword.topCompetitors.map((item) => item.name))}.`,
          recommendation: "Prioritize this keyword: publish authoritative pages that answer this exact intent and make official sources easy for AI providers to cite.",
        });
        continue;
      }

      if (keyword.ownedRelevance >= 0.6 && (keyword.mentionRate.value ?? 0) < 0.5) {
        push({
          area: "keyword",
          severity: "warning",
          title: `${keyword.phrase} has owned-site relevance but weak AI association`,
          evidence: `Owned Keyword Relevance is ${Math.round(keyword.ownedRelevance * 100)}%, but AI Mention Rate is ${fractionText(keyword.mentionRate)}.`,
          recommendation: "The site appears to target this keyword, but provider answers do not reliably connect it to the brand. Improve exact-intent pages and third-party corroborating sources.",
        });
      }

      if (keyword.mentionRate.numerator > 0 && keyword.citationRate.numerator === 0) {
        push({
          area: "keyword",
          severity: "warning",
          title: `${keyword.phrase} is mentioned without official citations`,
          evidence: `AI Mention Rate is ${fractionText(keyword.mentionRate)}, but Citation Rate is ${fractionText(keyword.citationRate)}.`,
          recommendation: "Create or improve official pages for this keyword and ensure page titles, metadata, and content make the source cite-worthy.",
        });
      }
    }

    for (const competitor of metrics.competitors) {
      if (competitor.shareOfVoice.numerator > metrics.shareOfVoice.numerator) {
        push({
          area: "competitor",
          severity: "warning",
          title: `${competitor.name} has higher Share of Voice occurrences`,
          evidence: `${competitor.name} occurrences: ${competitor.shareOfVoice.numerator}; ${audit.target.name} occurrences: ${metrics.shareOfVoice.numerator}.`,
          recommendation: "Compare the target's public content footprint against this competitor for the same prompt categories and source domains.",
        });
      }

      if (competitor.wins > 0) {
        push({
          area: "competitor",
          severity: "warning",
          title: `${competitor.name} wins some prompt results`,
          evidence: `${competitor.name} was first in ${competitor.wins} completed prompt result(s).`,
          recommendation: "Open the raw answers for those prompt IDs and build content that directly explains why the target is a better fit.",
        });
      }

      if (competitor.citationCount > metrics.citationCount) {
        push({
          area: "source",
          severity: "warning",
          title: `${competitor.name} receives more official citations`,
          evidence: `${competitor.name} citation URLs: ${competitor.citationCount}; target citation response count: ${metrics.citationCount}.`,
          recommendation: "Identify competitor pages being cited, then create stronger official equivalent pages for those same query intents.",
        });
      }
    }

    const citations = completedCitations(audit);
    const targetCitationCount = citations.filter(
      (citation) => citation.citationType === "target_official" || citation.citationType === "target_github",
    ).length;
    const competitorCitationCount = citations.filter((citation) => citation.citationType === "competitor_official").length;
    if (competitorCitationCount > targetCitationCount) {
      push({
        area: "source",
        severity: "warning",
        title: "Competitor official sources are cited more than target sources",
        evidence: `Target official/GitHub citation URLs: ${targetCitationCount}; competitor official citation URLs: ${competitorCitationCount}.`,
        recommendation: "Use citation evidence to find where AI providers trust competitor-owned sources more, then fill those source gaps on the target domain.",
      });
    }

    const topThirdParty = metrics.citationDomains.filter((group) => group.type === "third_party").slice(0, 5);
    if (topThirdParty.length > 0 && metrics.citationRate.numerator === 0) {
      push({
        area: "source",
        severity: "warning",
        title: "Providers cite third-party sources but not official target sources",
        evidence: `Top third-party citation domains: ${shortList(topThirdParty.map((group) => `${group.domain} (${group.citationCount})`))}.`,
        recommendation: "Earn or update third-party references that clearly mention the target and link to official pages.",
      });
    }

    findings.sort((a, b) => {
      const order: Record<GapSeverity, number> = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity] || a.area.localeCompare(b.area) || a.title.localeCompare(b.title);
    });

    const critical = findings.filter((finding) => finding.severity === "critical").length;
    const warning = findings.filter((finding) => finding.severity === "warning").length;
    const info = findings.filter((finding) => finding.severity === "info").length;
    return {
      summary:
        findings.length === 0
          ? "No visibility gap was detected from the completed provider responses. This is not a GEO score; it only reflects the audited prompts and providers."
          : `Detected ${findings.length} gap finding(s): ${critical} critical, ${warning} warning, ${info} info. Findings are derived only from completed provider responses and saved evidence.`,
      findings,
    };
  }
}
