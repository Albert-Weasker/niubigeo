import type { AuditMetrics, AuditRun, Citation } from "../core/types.js";
import type { AuditReportModel } from "./report-model.js";
import { csvEscape, mdEscape } from "./format.js";
import { renderDashboardHtml } from "./report-html.js";
import type { EvidenceStatement, HumanReport, SourceStory } from "./human-report.js";
import { buildHumanReport } from "./human-report.js";

function completedCitations(audit: AuditRun): Citation[] {
  return audit.runs
    .filter((run) => run.status === "completed")
    .flatMap((run) => run.analysis?.citations || run.result?.citations || []);
}

function answerLink(indexes: number[], locale: HumanReport["locale"]): string {
  if (indexes.length === 0) return "";
  const label = locale === "zh" ? "查看支持这一结论的AI回答" : "View the supporting AI answer";
  return `[${label}](#answer-${indexes[0]})`;
}

function sourceLink(urls: string[], locale: HumanReport["locale"]): string {
  if (urls.length === 0) return "";
  const label = locale === "zh" ? "查看支持这一结论的AI回答" : "View the supporting AI answer";
  return `[${label}](${urls[0]})`;
}

function renderEvidence(item: EvidenceStatement, locale: HumanReport["locale"]): string[] {
  const link = answerLink(item.answerIndexes, locale) || sourceLink(item.sourceUrls, locale);
  return link ? [`  - ${link}`] : [];
}

function renderStatementList(items: EvidenceStatement[], locale: HumanReport["locale"]): string[] {
  return items.flatMap((item) => [`- ${mdEscape(item.text)}`, ...renderEvidence(item, locale)]);
}

function renderTextList(items: string[]): string[] {
  return items.map((item) => `- ${mdEscape(item)}`);
}

function section(title: string, lines: string[]): string[] {
  return [`## ${title}`, "", ...lines, ""];
}

function noEvidence(locale: HumanReport["locale"], zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

function renderCompetitors(report: HumanReport): string[] {
  if (report.sections.competitors.length === 0) {
    return [noEvidence(report.locale, "当前回答不足以确定主要竞争对手。", "Current answers are not enough to identify main competitors.")];
  }
  const rows = report.sections.competitors.flatMap((competitor) => [
    `### ${mdEscape(competitor.name)}｜${mdEscape(competitor.threat)}`,
    "",
    `- ${report.locale === "zh" ? "为什么" : "Why"}：${mdEscape(competitor.why)}`,
    ...renderEvidence({ text: competitor.name, answerIndexes: competitor.answerIndexes, sourceUrls: competitor.sourceUrls }, report.locale),
    "",
  ]);
  if (report.sections.otherCompetitors.length) {
    rows.push(
      `<details>`,
      `<summary>${report.locale === "zh" ? "疑似相关品牌" : "Possibly related brands"}</summary>`,
      "",
      report.locale === "zh"
        ? "这些对象在回答中出现过，但证据不足以确认它们是同一个明确产品实体或主要竞争对手。"
        : "These appeared in answers, but current evidence is not enough to confirm each as a clear product entity or main competitor.",
      "",
      report.sections.otherCompetitors.map(mdEscape).join(", "),
      "",
      `</details>`,
      "",
    );
  }
  return rows;
}

function renderModelComparisons(report: HumanReport): string[] {
  if (report.sections.modelComparisons.length === 0) {
    return [noEvidence(report.locale, "当前没有足够回答用于比较不同 AI。", "Current answers are not enough to compare different AIs.")];
  }
  const header = report.locale === "zh" ? "| AI | 判断 | 证据 |" : "| AI | Judgment | Evidence |";
  return [
    header,
    "| --- | --- | --- |",
    ...report.sections.modelComparisons.map((item) => {
      const link = answerLink(item.answerIndexes, report.locale) || sourceLink(item.sourceUrls, report.locale);
      return `| ${mdEscape(item.displayName)} | ${mdEscape(item.summary)} | ${link} |`;
    }),
  ];
}

function sourceStatusLabel(source: SourceStory, report: HumanReport): string {
  if (source.relevance === "related") return report.locale === "zh" ? "相关" : "Related";
  if (source.relevance === "possible") return report.locale === "zh" ? "可能相关" : "Possibly related";
  return report.locale === "zh" ? "已排除" : "Excluded";
}

function renderSources(title: string, sources: SourceStory[], report: HumanReport): string[] {
  if (sources.length === 0) return [`### ${title}`, "", noEvidence(report.locale, "本次 AI 回答没有返回可用来源。", "This run did not return usable sources."), ""];
  return [
    `### ${title}`,
    "",
    ...sources.slice(0, 3).flatMap((source) => [
      `- ${mdEscape(source.title)} (${mdEscape(source.domain)})`,
      `  - [${report.locale === "zh" ? "打开来源" : "Open source"}](${source.url})`,
    ]),
    "",
  ];
}

function renderAllSources(report: HumanReport): string[] {
  const titles =
    report.locale === "zh"
      ? { root: "查看全部来源", related: "相关来源", possible: "可能相关来源", excluded: "已排除来源" }
      : { root: "View all sources", related: "Related sources", possible: "Possibly related sources", excluded: "Excluded sources" };
  const groups = [
    { title: titles.related, items: report.sections.allSources.filter((source) => source.relevance === "related") },
    { title: titles.possible, items: report.sections.allSources.filter((source) => source.relevance === "possible") },
    { title: titles.excluded, items: report.sections.allSources.filter((source) => source.relevance === "excluded") },
  ];
  return [
    `<details>`,
    `<summary>${titles.root}</summary>`,
    "",
    ...groups.flatMap((group) =>
      group.items.length
        ? [
            `#### ${group.title}`,
            "",
            ...group.items.map(
              (source) =>
                `- ${mdEscape(source.title)} (${mdEscape(source.domain)})：${mdEscape(sourceStatusLabel(source, report))}。${mdEscape(source.relevanceReason)} [${report.locale === "zh" ? "打开来源" : "Open source"}](${source.url})`,
            ),
            "",
          ]
        : [],
    ),
    `</details>`,
    "",
  ];
}

function renderAnswers(report: HumanReport): string[] {
  if (report.sections.answers.length === 0) return [noEvidence(report.locale, "本次没有可展示的 AI 回答。", "No AI answers are available for this run.")];
  return report.sections.answers.flatMap((answer) => [
    `<a id="answer-${answer.index}"></a>`,
    `### ${report.locale === "zh" ? "AI回答" : "AI Answer"}`,
    "",
    `- ${report.locale === "zh" ? "用户问题" : "User question"}：${mdEscape(answer.prompt)}`,
    `- ${report.locale === "zh" ? "结论" : "Result"}：${mdEscape(answer.summary)}`,
    `- ${report.locale === "zh" ? "AI来源" : "AI source"}：${mdEscape(answer.sourceName)}`,
    `- ${report.locale === "zh" ? "模型" : "Model"}：${mdEscape(answer.model)}`,
    `- ${report.locale === "zh" ? "提到的竞争对手" : "Competitors mentioned"}：${mdEscape(answer.competitorsMentioned.join(", ") || (report.locale === "zh" ? "无" : "None"))}`,
    "",
    report.locale === "zh" ? "AI实际回答：" : "Actual AI answer:",
    "",
    "```text",
    answer.answer,
    "```",
    "",
  ]);
}

function renderCompetition(report: HumanReport): string[] {
  const titles =
    report.locale === "zh"
      ? {
          better: "竞争对手更容易出现的场景",
          targetBetter: "你的品牌更容易出现的场景",
          occupied: "你的品牌没有出现的重要问题",
        }
      : {
          better: "Scenarios where competitors appear more easily",
          targetBetter: "Scenarios where your brand appears more easily",
          occupied: "Important questions where your brand is absent",
        };
  return [
    `### ${titles.better}`,
    "",
    ...renderStatementList(report.sections.competitorAdvantages, report.locale),
    "",
    `### ${titles.targetBetter}`,
    "",
    ...renderStatementList(report.sections.targetAdvantages, report.locale),
    "",
    `### ${titles.occupied}`,
    "",
    ...renderStatementList(report.sections.missingScenarios, report.locale),
  ];
}

export class ReportBuilder {
  renderMarkdown(model: AuditReportModel): string {
    const report = buildHumanReport(model.audit);
    const titles =
      report.locale === "zh"
        ? {
            summary: "总结",
            brand: "AI怎么看你",
            competitors: "谁在和你竞争",
            competition: "竞争差异",
            sources: "来源",
            targetSources: "你的主要来源",
            competitorSources: "竞争对手来源",
            thirdPartySources: "第三方来源",
            answers: "查看AI实际回答",
          }
        : {
            summary: "Summary",
            brand: "How AI Sees You",
            competitors: "Who Competes With You",
            competition: "Competitive Differences",
            sources: "Sources",
            targetSources: "Your Main Sources",
            competitorSources: "Competitor Sources",
            thirdPartySources: "Third-party Sources",
            answers: "View Actual AI Answers",
          };

    return [
      `# ${report.title}`,
      "",
      report.subtitle,
      "",
      report.caveat,
      "",
      ...section(titles.summary, [report.sections.headline, "", ...renderModelComparisons(report)]),
      ...section(titles.brand, renderStatementList(report.sections.brandDescriptions, report.locale)),
      ...section(titles.competitors, renderCompetitors(report)),
      ...section(titles.competition, renderCompetition(report)),
      ...section(titles.sources, [
        ...renderSources(titles.targetSources, report.sections.targetSources, report),
        ...renderSources(titles.competitorSources, report.sections.competitorSources, report),
        ...renderSources(titles.thirdPartySources, report.sections.thirdPartySources, report),
        ...renderAllSources(report),
        `<details>`,
        `<summary>${titles.answers}</summary>`,
        "",
        ...renderAnswers(report),
        `</details>`,
      ]),
    ].join("\n");
  }

  renderHtml(model: AuditReportModel, markdown: string): string {
    void markdown;
    return renderDashboardHtml(model);
  }

  renderPromptCsv(metrics: AuditMetrics): string {
    const header = [
      "question",
      "question_kind",
      "ai_source",
      "model",
      "status",
      "target_mentioned",
      "competitors_mentioned",
      "official_citation_count",
    ];
    const rows = metrics.promptOutcomes.map((row) =>
      [
        row.promptId,
        row.promptAuditCategory,
        row.sourceLabel,
        row.model,
        row.status,
        row.targetMentioned,
        row.competitorMentions.join(";"),
        row.officialCitationCount,
      ]
        .map(csvEscape)
        .join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }

  renderCitationCsv(audit: AuditRun): string {
    const header = ["question", "domain", "title", "url"];
    const rows = completedCitations(audit).map((citation) =>
      [citation.promptId || "", citation.domain, citation.title || "", citation.url].map(csvEscape).join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }

  renderKeywordCsv(metrics: AuditMetrics): string {
    const header = ["keyword", "source", "user_defined", "owned_relevance", "prompts", "top_competitors", "gap"];
    const rows = metrics.keywordMetrics.map((row) =>
      [
        row.phrase,
        row.source,
        row.userDefined,
        row.ownedRelevance,
        row.promptCount,
        row.topCompetitors.map((competitor) => competitor.name).join(";"),
        row.gapLabel,
      ]
        .map(csvEscape)
        .join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }
}
