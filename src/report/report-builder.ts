import type { AuditMetrics, AuditRun, Citation } from "../core/types.js";
import type { AuditReportModel } from "./report-model.js";
import { csvEscape, mdEscape } from "./format.js";
import { renderDashboardHtml } from "./report-html.js";
import type { AnswerStory, EvidenceStatement, HumanReport, SourceStory } from "./human-report.js";
import { buildHumanReport } from "./human-report.js";

function localized(locale: HumanReport["locale"], zh: string, en: string, ptBR: string): string {
  return locale === "zh" ? zh : locale === "pt-BR" ? ptBR : en;
}

function completedCitations(audit: AuditRun): Citation[] {
  return audit.runs
    .filter((run) => run.status === "completed")
    .flatMap((run) => run.analysis?.citations || run.result?.citations || []);
}

function answerLink(indexes: number[], locale: HumanReport["locale"]): string {
  if (indexes.length === 0) return "";
  const label = localized(locale, "查看支持这一结论的AI回答", "View the supporting AI answer", "Ver a resposta de IA que sustenta esta conclusão");
  return `[${label}](#answer-${indexes[0]})`;
}

function sourceLink(urls: string[], locale: HumanReport["locale"]): string {
  if (urls.length === 0) return "";
  const label = localized(locale, "查看支持这一结论的AI回答", "View the supporting AI answer", "Ver a resposta de IA que sustenta esta conclusão");
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

function noEvidence(locale: HumanReport["locale"], zh: string, en: string, ptBR = en): string {
  return localized(locale, zh, en, ptBR);
}

function renderCompetitors(report: HumanReport): string[] {
  if (report.sections.competitors.length === 0) {
    return [noEvidence(report.locale, "当前回答不足以确定主要竞争对手。", "Current answers are not enough to identify main competitors.", "As respostas atuais não são suficientes para identificar os principais concorrentes.")];
  }
  const rows = report.sections.competitors.flatMap((competitor) => [
    `### ${mdEscape(competitor.name)}｜${mdEscape(competitor.threat)}`,
    "",
    `- ${localized(report.locale, "为什么", "Why", "Por quê")}：${mdEscape(competitor.why)}`,
    ...renderEvidence({ text: competitor.name, answerIndexes: competitor.answerIndexes, sourceUrls: competitor.sourceUrls }, report.locale),
    "",
  ]);
  if (report.sections.otherCompetitors.length) {
    rows.push(
      `<details>`,
      `<summary>${localized(report.locale, "疑似相关品牌", "Possibly related brands", "Marcas possivelmente relacionadas")}</summary>`,
      "",
      localized(report.locale, "这些对象在回答中出现过，但证据不足以确认它们是同一个明确产品实体或主要竞争对手。", "These appeared in answers, but current evidence is not enough to confirm each as a clear product entity or main competitor.", "Essas marcas apareceram nas respostas, mas as evidências atuais não são suficientes para confirmar cada uma como uma entidade de produto clara ou concorrente principal."),
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
    return [noEvidence(report.locale, "当前没有足够回答用于比较不同 AI。", "Current answers are not enough to compare different AIs.", "As respostas atuais não são suficientes para comparar diferentes IAs.")];
  }
  const header = localized(report.locale, "| AI | 判断 | 证据 |", "| AI | Judgment | Evidence |", "| IA | Avaliação | Evidência |");
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
  if (source.relevance === "related") return localized(report.locale, "相关", "Related", "Relacionada");
  if (source.relevance === "possible") return localized(report.locale, "可能相关", "Possibly related", "Possivelmente relacionada");
  return localized(report.locale, "已排除", "Excluded", "Excluída");
}

function renderSources(title: string, sources: SourceStory[], report: HumanReport): string[] {
  if (sources.length === 0) return [`### ${title}`, "", noEvidence(report.locale, "本次 AI 回答没有返回可用来源。", "This run did not return usable sources.", "Esta execução não retornou fontes utilizáveis."), ""];
  return [
    `### ${title}`,
    "",
    ...sources.slice(0, 3).flatMap((source) => [
      `- ${mdEscape(source.title)} (${mdEscape(source.domain)})`,
      `  - [${localized(report.locale, "打开来源", "Open source", "Abrir fonte")}](${source.url})`,
    ]),
    "",
  ];
}

function renderAllSources(report: HumanReport): string[] {
  const titles =
    report.locale === "zh"
      ? { root: "查看全部来源", related: "相关来源", possible: "可能相关来源", excluded: "已排除来源" }
      : report.locale === "pt-BR"
        ? { root: "Ver todas as fontes", related: "Fontes relacionadas", possible: "Fontes possivelmente relacionadas", excluded: "Fontes excluídas" }
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
                `- ${mdEscape(source.title)} (${mdEscape(source.domain)})：${mdEscape(sourceStatusLabel(source, report))}。${mdEscape(source.relevanceReason)} [${localized(report.locale, "打开来源", "Open source", "Abrir fonte")}](${source.url})`,
            ),
            "",
          ]
        : [],
    ),
    `</details>`,
    "",
  ];
}

function statusLabel(status: string, report: HumanReport): string {
  if (status === "completed") return localized(report.locale, "已完成", "Completed", "Concluída");
  if (status === "partial") return localized(report.locale, "部分完成", "Partial", "Parcial");
  if (status === "missing") return localized(report.locale, "未完成", "Missing", "Não concluída");
  return localized(report.locale, "无法判断", "Unknown", "Desconhecido");
}

function renderIntentAnswerDetails(answer: AnswerStory, report: HumanReport): string[] {
  const intent = answer.intentAnalysis;
  if (!intent || intent.status !== "completed") {
    return [
      `- ${localized(report.locale, "提到的竞争对手", "Competitors mentioned", "Concorrentes mencionados")}：${mdEscape(answer.competitorsMentioned.join(", ") || localized(report.locale, "无", "None", "Nenhum"))}`,
    ];
  }
  const labels =
    report.locale === "zh"
      ? { asked: "用户想知道", answered: "AI回答了什么", missed: "AI漏了什么", uncertain: "不确定", tasks: "任务完成情况", entities: "实体关系", quote: "证据片段" }
      : report.locale === "pt-BR"
        ? { asked: "O usuário pediu", answered: "O que a IA respondeu", missed: "O que a IA não respondeu", uncertain: "Incerto", tasks: "Conclusão das tarefas", entities: "Relações entre entidades", quote: "Trecho da evidência" }
      : { asked: "User asked for", answered: "What AI answered", missed: "What AI missed", uncertain: "Uncertain", tasks: "Task completion", entities: "Entity relationships", quote: "Evidence quote" };
  const requested = intent.promptIntent.requestedOutputs.length ? intent.promptIntent.requestedOutputs : [answer.prompt];
  const taskLines = intent.tasks.flatMap((task) => {
    const assessment = intent.taskResults.find((item) => item.taskId === task.id);
    const lines = [`  - ${mdEscape(task.requirement)}：${mdEscape(statusLabel(assessment?.status || "unknown", report))}`];
    if (assessment?.explanation) lines.push(`    - ${mdEscape(assessment.explanation)}`);
    if (assessment?.evidenceQuote) lines.push(`    - ${labels.quote}：${mdEscape(assessment.evidenceQuote)}`);
    return lines;
  });
  return [
    `- ${localized(report.locale, "这条问题的结果", "Question result", "Resultado da pergunta")}：${mdEscape(intent.adaptedResult.oneSentence)}`,
    `- ${labels.asked}：${mdEscape(requested.join(report.locale === "zh" ? "；" : "; "))}`,
    ...(intent.adaptedResult.answered.length ? [`- ${labels.answered}：${mdEscape(intent.adaptedResult.answered.join(report.locale === "zh" ? "；" : "; "))}`] : []),
    ...(intent.adaptedResult.missing.length ? [`- ${labels.missed}：${mdEscape(intent.adaptedResult.missing.join(report.locale === "zh" ? "；" : "; "))}`] : []),
    ...(intent.adaptedResult.uncertain.length ? [`- ${labels.uncertain}：${mdEscape(intent.adaptedResult.uncertain.join(report.locale === "zh" ? "；" : "; "))}`] : []),
    ...(taskLines.length ? [`- ${labels.tasks}：`, ...taskLines] : []),
    ...(intent.entities.length
      ? [
          `- ${labels.entities}：${mdEscape(
            intent.entities
              .slice(0, 8)
              .map((entity) => `${entity.name}: ${entity.explanation || entity.relationshipToQuestion}`)
              .join(report.locale === "zh" ? "；" : "; "),
          )}`,
        ]
      : []),
  ];
}

function renderAnswers(report: HumanReport): string[] {
  if (report.sections.answers.length === 0) return [noEvidence(report.locale, "本次没有可展示的 AI 回答。", "No AI answers are available for this run.", "Nenhuma resposta de IA está disponível nesta execução.")];
  return report.sections.answers.flatMap((answer) => [
    `<a id="answer-${answer.index}"></a>`,
    `### ${localized(report.locale, "AI回答", "AI Answer", "Resposta da IA")}`,
    "",
    `- ${localized(report.locale, "用户问题", "User question", "Pergunta do usuário")}：${mdEscape(answer.prompt)}`,
    `- ${localized(report.locale, "结论", "Result", "Resultado")}：${mdEscape(answer.summary)}`,
    `- ${localized(report.locale, "AI来源", "AI source", "Fonte de IA")}：${mdEscape(answer.sourceName)}`,
    `- ${localized(report.locale, "模型", "Model", "Modelo")}：${mdEscape(answer.model)}`,
    `- ${localized(report.locale, "联网状态", "Web access", "Acesso à web")}：${mdEscape(answer.webSearch)}`,
    ...renderIntentAnswerDetails(answer, report),
    "",
    localized(report.locale, "AI实际回答：", "Actual AI answer:", "Resposta real da IA:"),
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
      : report.locale === "pt-BR"
        ? {
            better: "Cenários em que concorrentes aparecem com mais facilidade",
            targetBetter: "Cenários em que sua marca aparece com mais facilidade",
            occupied: "Perguntas importantes em que sua marca não aparece",
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
        : report.locale === "pt-BR"
          ? {
              summary: "Resumo",
              brand: "Como a IA vê sua marca",
              competitors: "Quem concorre com você",
              competition: "Diferenças competitivas",
              sources: "Fontes",
              targetSources: "Principais fontes da sua marca",
              competitorSources: "Fontes dos concorrentes",
              thirdPartySources: "Fontes de terceiros",
              answers: "Ver respostas reais da IA",
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
