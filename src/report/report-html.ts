import type { AuditReportModel } from "./report-model.js";
import { htmlEscape } from "./format.js";
import { PRODUCT_NAME, renderNiubigeoMarkSvg } from "../ui/brand.js";
import type { AnswerStory, EvidenceStatement, HumanReport, SourceStory } from "./human-report.js";
import { buildHumanReport } from "./human-report.js";

type Copy = {
  lang: string;
  nav: string[];
  sections: {
    summary: string;
    brand: string;
    competitors: string;
    competition: string;
    sources: string;
  };
  labels: {
    ai: string;
    judgment: string;
    why: string;
    threat: string;
    otherCompetitors: string;
    betterQuestion: string;
    targetBetterQuestion: string;
    occupiedQuestion: string;
    evidenceAnswers: string;
    evidenceSources: string;
    viewEvidence: string;
    viewSourceEvidence: string;
    openSource: string;
    targetSources: string;
    competitorSources: string;
    thirdPartySources: string;
    allSources: string;
    relatedSources: string;
    possibleSources: string;
    excludedSources: string;
    sourceStatus: string;
    allAnswers: string;
    noSources: string;
    question: string;
    aiSource: string;
    model: string;
    webSearch: string;
    mentionsBrand: string;
    competitorsMentioned: string;
    citedSources: string;
    actualAnswer: string;
    questionResult: string;
    userAskedFor: string;
    aiAnswered: string;
    aiMissed: string;
    uncertain: string;
    taskCompletion: string;
    entityRelationships: string;
    evidenceQuote: string;
    yes: string;
    no: string;
    none: string;
    mentionedCompetitors: string;
  };
};

const COPY: Record<HumanReport["locale"], Copy> = {
  zh: {
    lang: "zh-CN",
    nav: ["总结", "AI怎么看你", "谁在竞争", "竞争结论", "来源"],
    sections: {
      summary: "总结",
      brand: "AI怎么看你",
      competitors: "谁在和你竞争",
      competition: "竞争差异",
      sources: "来源",
    },
    labels: {
      ai: "AI",
      judgment: "判断",
      why: "为什么它和你竞争",
      threat: "威胁程度",
      otherCompetitors: "疑似相关品牌",
      betterQuestion: "竞争对手更容易出现的场景",
      targetBetterQuestion: "你的品牌更容易出现的场景",
      occupiedQuestion: "你的品牌没有出现的重要问题",
      evidenceAnswers: "相关AI回答",
      evidenceSources: "支持来源",
      viewEvidence: "查看支持这一结论的AI回答",
      viewSourceEvidence: "查看支持这一来源的AI回答",
      openSource: "打开来源",
      targetSources: "你的主要来源",
      competitorSources: "竞争对手来源",
      thirdPartySources: "第三方来源",
      allSources: "查看全部来源",
      relatedSources: "相关来源",
      possibleSources: "可能相关来源",
      excludedSources: "已排除来源",
      sourceStatus: "状态",
      allAnswers: "查看AI实际回答",
      noSources: "本次 AI 回答没有返回可用来源。",
      question: "用户问题",
      aiSource: "AI来源",
      model: "模型",
      webSearch: "联网状态",
      mentionsBrand: "是否提到你的品牌",
      competitorsMentioned: "提到的竞争对手",
      citedSources: "引用来源",
      actualAnswer: "AI实际回答",
      questionResult: "这条问题的结果",
      userAskedFor: "用户想知道",
      aiAnswered: "AI回答了什么",
      aiMissed: "AI漏了什么",
      uncertain: "不确定",
      taskCompletion: "任务完成情况",
      entityRelationships: "实体关系",
      evidenceQuote: "证据片段",
      yes: "是",
      no: "否",
      none: "无",
      mentionedCompetitors: "提到的竞争对手",
    },
  },
  en: {
    lang: "en",
    nav: ["Summary", "How AI Sees You", "Competitors", "Competition", "Sources"],
    sections: {
      summary: "Summary",
      brand: "How AI Sees You",
      competitors: "Who Competes With You",
      competition: "Competitive Differences",
      sources: "Sources",
    },
    labels: {
      ai: "AI",
      judgment: "Judgment",
      why: "Why it competes with you",
      threat: "Threat level",
      otherCompetitors: "Possibly related brands",
      betterQuestion: "Scenarios where competitors appear more easily",
      targetBetterQuestion: "Scenarios where your brand appears more easily",
      occupiedQuestion: "Important questions where your brand is absent",
      evidenceAnswers: "Relevant AI answers",
      evidenceSources: "Supporting sources",
      viewEvidence: "View the supporting AI answer",
      viewSourceEvidence: "View the AI answer behind this source",
      openSource: "Open source",
      targetSources: "Your main sources",
      competitorSources: "Competitor sources",
      thirdPartySources: "Third-party sources",
      allSources: "View all sources",
      relatedSources: "Related sources",
      possibleSources: "Possibly related sources",
      excludedSources: "Excluded sources",
      sourceStatus: "Status",
      allAnswers: "View actual AI answers",
      noSources: "This run did not return usable sources.",
      question: "User question",
      aiSource: "AI source",
      model: "Model",
      webSearch: "Web access",
      mentionsBrand: "Mentions your brand",
      competitorsMentioned: "Competitors mentioned",
      citedSources: "Cited sources",
      actualAnswer: "Actual AI answer",
      questionResult: "Question result",
      userAskedFor: "User asked for",
      aiAnswered: "What AI answered",
      aiMissed: "What AI missed",
      uncertain: "Uncertain",
      taskCompletion: "Task completion",
      entityRelationships: "Entity relationships",
      evidenceQuote: "Evidence quote",
      yes: "Yes",
      no: "No",
      none: "None",
      mentionedCompetitors: "Competitors mentioned",
    },
  },
};

function answerHref(index: number): string {
  return `#answer-${index}`;
}

function sourceHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    return "#";
  }
  return "#";
}

function evidenceLinks(item: EvidenceStatement, copy: Copy): string {
  const answerIndex = item.answerIndexes[0];
  if (typeof answerIndex === "number") {
    return `<div class="evidence-row"><a class="evidence-link" href="${answerHref(answerIndex)}">${htmlEscape(copy.labels.viewEvidence)}</a></div>`;
  }
  const sourceUrl = item.sourceUrls[0];
  if (sourceUrl) {
    return `<div class="evidence-row"><a class="evidence-link" href="${htmlEscape(sourceHref(sourceUrl))}" rel="noreferrer">${htmlEscape(copy.labels.viewEvidence)}</a></div>`;
  }
  return "";
}

function renderStatementList(items: EvidenceStatement[], copy: Copy): string {
  return `<ul class="statement-list">${items
    .map(
      (item) => `<li>
        <p>${htmlEscape(item.text)}</p>
        ${evidenceLinks(item, copy)}
      </li>`,
    )
    .join("")}</ul>`;
}

function renderTextList(items: string[]): string {
  return `<ul class="statement-list">${items.map((item) => `<li><p>${htmlEscape(item)}</p></li>`).join("")}</ul>`;
}

function renderCompetitors(report: HumanReport, copy: Copy): string {
  const main = report.sections.competitors.length === 0
    ? `<p class="empty">${htmlEscape(report.locale === "zh" ? "当前回答不足以确定主要竞争对手。" : "Current answers are not enough to identify main competitors.")}</p>`
    : `<div class="competitor-grid">${report.sections.competitors
    .map(
      (competitor) => `<article class="competitor-card">
        <div class="card-head">
          <h3>${htmlEscape(competitor.name)}</h3>
          <span>${htmlEscape(competitor.threat)}</span>
        </div>
        <div class="why-block">
          <strong>${htmlEscape(copy.labels.why)}</strong>
          <p>${htmlEscape(competitor.why)}</p>
        </div>
        ${evidenceLinks({ text: competitor.name, answerIndexes: competitor.answerIndexes, sourceUrls: competitor.sourceUrls }, copy)}
      </article>`,
    )
    .join("")}</div>`;
  const other = report.sections.otherCompetitors.length
    ? `<details class="compact-details">
        <summary>${htmlEscape(copy.labels.otherCompetitors)}</summary>
        <p>${htmlEscape(report.locale === "zh" ? "这些对象在回答中出现过，但证据不足以确认它们是同一个明确产品实体或主要竞争对手。" : "These appeared in answers, but current evidence is not enough to confirm each as a clear product entity or main competitor.")}</p>
        <p>${htmlEscape(report.sections.otherCompetitors.join(", "))}</p>
      </details>`
    : "";
  return `${main}${other}`;
}

function renderModelTable(report: HumanReport, copy: Copy): string {
  if (report.sections.modelComparisons.length === 0) {
    return `<p class="empty">${htmlEscape(report.locale === "zh" ? "当前没有足够回答用于比较不同 AI。" : "Current answers are not enough to compare different AIs.")}</p>`;
  }
  return `<div class="model-table-wrap"><table class="model-table">
    <thead><tr><th>${htmlEscape(copy.labels.ai)}</th><th>${htmlEscape(copy.labels.judgment)}</th><th></th></tr></thead>
    <tbody>${report.sections.modelComparisons
    .map(
      (item) => `<tr>
        <td><strong>${htmlEscape(item.displayName)}</strong></td>
        <td>${htmlEscape(item.summary)}</td>
        <td>${evidenceLinks({ text: item.sourceName, answerIndexes: item.answerIndexes, sourceUrls: item.sourceUrls }, copy)}</td>
      </tr>`,
    )
    .join("")}</tbody>
  </table></div>`;
}

function sourceStatusLabel(source: SourceStory, copy: Copy): string {
  if (source.relevance === "related") return copy.labels.relatedSources;
  if (source.relevance === "possible") return copy.labels.possibleSources;
  return copy.labels.excludedSources;
}

function renderSourceCard(source: SourceStory, copy: Copy, showStatus = false): string {
  const answerIndex = source.answerIndexes[0];
  const answerLink = typeof answerIndex === "number"
    ? `<a href="${answerHref(answerIndex)}">${htmlEscape(copy.labels.viewSourceEvidence)}</a>`
    : "";
  const status = showStatus
    ? `<span class="source-status ${htmlEscape(source.relevance)}">${htmlEscape(sourceStatusLabel(source, copy))}</span>`
    : "";
  return `<article class="source-card">
    <div class="source-title-line"><h4>${htmlEscape(source.title)}</h4>${status}</div>
    <p>${htmlEscape(source.domain)}</p>
    <p>${htmlEscape(source.supports)}</p>
    ${showStatus ? `<p>${htmlEscape(source.relevanceReason)}</p>` : ""}
    <div class="source-actions">
      <a href="${htmlEscape(sourceHref(source.url))}" rel="noreferrer">${htmlEscape(copy.labels.openSource)}</a>
      ${answerLink}
    </div>
  </article>`;
}

function renderSourceGroup(title: string, sources: SourceStory[], copy: Copy): string {
  if (sources.length === 0) {
    return `<section class="source-group"><h3>${htmlEscape(title)}</h3><p class="empty">${htmlEscape(copy.labels.noSources)}</p></section>`;
  }
  return `<section class="source-group">
    <h3>${htmlEscape(title)}</h3>
    <div class="source-grid">${sources.slice(0, 3).map((source) => renderSourceCard(source, copy)).join("")}</div>
  </section>`;
}

function renderAllSourceGroup(title: string, sources: SourceStory[], copy: Copy): string {
  if (sources.length === 0) return "";
  return `<section class="source-group"><h3>${htmlEscape(title)}</h3><div class="source-grid">${sources
    .map((source) => renderSourceCard(source, copy, true))
    .join("")}</div></section>`;
}

function renderSources(report: HumanReport, copy: Copy): string {
  const all = report.sections.allSources;
  const related = all.filter((source) => source.relevance === "related");
  const possible = all.filter((source) => source.relevance === "possible");
  const excluded = all.filter((source) => source.relevance === "excluded");
  return `<div class="source-stack">
    ${renderSourceGroup(copy.labels.targetSources, report.sections.targetSources, copy)}
    ${renderSourceGroup(copy.labels.competitorSources, report.sections.competitorSources, copy)}
    ${renderSourceGroup(copy.labels.thirdPartySources, report.sections.thirdPartySources, copy)}
    <details class="all-sources">
      <summary>${htmlEscape(copy.labels.allSources)}</summary>
      ${renderAllSourceGroup(copy.labels.relatedSources, related, copy)}
      ${renderAllSourceGroup(copy.labels.possibleSources, possible, copy)}
      ${renderAllSourceGroup(copy.labels.excludedSources, excluded, copy)}
    </details>
    <details class="all-sources">
      <summary>${htmlEscape(copy.labels.allAnswers)}</summary>
      ${renderAnswers(report, copy)}
    </details>
  </div>`;
}

function renderCompetitionSection(report: HumanReport, copy: Copy): string {
  return `<div class="competition-stack">
    <article>
      <h3>${htmlEscape(copy.labels.betterQuestion)}</h3>
      ${renderStatementList(report.sections.competitorAdvantages, copy)}
    </article>
    <article>
      <h3>${htmlEscape(copy.labels.targetBetterQuestion)}</h3>
      ${renderStatementList(report.sections.targetAdvantages, copy)}
    </article>
    <article>
      <h3>${htmlEscape(copy.labels.occupiedQuestion)}</h3>
      ${renderStatementList(report.sections.missingScenarios, copy)}
    </article>
  </div>`;
}

function renderMiniList(title: string, items: string[], copy: Copy): string {
  if (items.length === 0) return "";
  return `<div class="intent-block">
    <h4>${htmlEscape(title)}</h4>
    <ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </div>`;
}

function taskStatusLabel(status: string, copy: Copy): string {
  if (status === "completed") return copy.lang === "zh-CN" ? "已完成" : "Completed";
  if (status === "partial") return copy.lang === "zh-CN" ? "部分完成" : "Partial";
  if (status === "missing") return copy.lang === "zh-CN" ? "未完成" : "Missing";
  return copy.lang === "zh-CN" ? "无法判断" : "Unknown";
}

function renderIntentDetails(answer: AnswerStory, copy: Copy): string {
  const intent = answer.intentAnalysis;
  if (!intent || intent.status !== "completed") return "";
  const result = intent.adaptedResult;
  const requested = intent.promptIntent.requestedOutputs.length ? intent.promptIntent.requestedOutputs : [result.userQuestion];
  const taskItems = intent.tasks.map((task) => {
    const assessment = intent.taskResults.find((item) => item.taskId === task.id);
    const quote = assessment?.evidenceQuote
      ? `<blockquote><strong>${htmlEscape(copy.labels.evidenceQuote)}：</strong>${htmlEscape(assessment.evidenceQuote)}</blockquote>`
      : "";
    const explanation = assessment?.explanation ? `<p>${htmlEscape(assessment.explanation)}</p>` : "";
    return `<li>
      <strong>${htmlEscape(task.requirement)}</strong>
      <span>${htmlEscape(taskStatusLabel(assessment?.status || "unknown", copy))}</span>
      ${explanation}
      ${quote}
    </li>`;
  });
  const entityItems = intent.entities.slice(0, 8).map((entity) => {
    const detail = entity.explanation || `${entity.name}: ${entity.relationshipToQuestion}`;
    return `<li>
      <strong>${htmlEscape(entity.name)}</strong>
      <span>${htmlEscape(detail)}</span>
    </li>`;
  });
  return `<div class="intent-result">
    <h4>${htmlEscape(copy.labels.questionResult)}</h4>
    <p class="intent-one">${htmlEscape(result.oneSentence)}</p>
    ${renderMiniList(copy.labels.userAskedFor, requested, copy)}
    ${renderMiniList(copy.labels.aiAnswered, result.answered, copy)}
    ${renderMiniList(copy.labels.aiMissed, result.missing, copy)}
    ${renderMiniList(copy.labels.uncertain, result.uncertain, copy)}
    ${
      taskItems.length
        ? `<div class="intent-block task-block"><h4>${htmlEscape(copy.labels.taskCompletion)}</h4><ul>${taskItems.join("")}</ul></div>`
        : ""
    }
    ${
      entityItems.length
        ? `<div class="intent-block entity-block"><h4>${htmlEscape(copy.labels.entityRelationships)}</h4><ul>${entityItems.join("")}</ul></div>`
        : ""
    }
  </div>`;
}

function renderAnswers(report: HumanReport, copy: Copy): string {
  if (report.sections.answers.length === 0) {
    return `<p class="empty">${htmlEscape(report.locale === "zh" ? "本次没有可展示的 AI 回答。" : "No AI answers are available for this run.")}</p>`;
  }
  return `<div class="answer-list">${report.sections.answers
    .map(
      (answer) => `<details class="answer-card" id="answer-${answer.index}">
        <summary>
          <span>${htmlEscape(answer.prompt)}</span>
          <strong>${htmlEscape(answer.summary)}</strong>
        </summary>
        <div class="answer-body">
          <dl>
            <div><dt>${htmlEscape(copy.labels.question)}</dt><dd>${htmlEscape(answer.prompt)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.aiSource)}</dt><dd>${htmlEscape(answer.sourceName)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.model)}</dt><dd>${htmlEscape(answer.model)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.webSearch)}</dt><dd>${htmlEscape(answer.webSearch)}</dd></div>
            ${
              answer.intentAnalysis?.status === "completed"
                ? ""
                : `<div><dt>${htmlEscape(copy.labels.mentionsBrand)}</dt><dd>${htmlEscape(answer.targetMentioned ? copy.labels.yes : copy.labels.no)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.competitorsMentioned)}</dt><dd>${htmlEscape(answer.competitorsMentioned.join(", ") || copy.labels.none)}</dd></div>`
            }
          </dl>
          ${renderIntentDetails(answer, copy)}
          <div class="answer-sources">
            <h4>${htmlEscape(copy.labels.citedSources)}</h4>
            ${
              answer.citations.length
                ? `<ul>${answer.citations
                    .slice(0, 10)
                    .map((citation) => `<li><a href="${htmlEscape(sourceHref(citation.url))}" rel="noreferrer">${htmlEscape(citation.title || citation.url)}</a></li>`)
                    .join("")}</ul>`
                : `<p>${htmlEscape(copy.labels.none)}</p>`
            }
          </div>
          <div class="actual-answer">
            <h4>${htmlEscape(copy.labels.actualAnswer)}</h4>
            <p>${htmlEscape(answer.answer)}</p>
          </div>
        </div>
      </details>`,
    )
    .join("")}</div>`;
}

function renderSection(id: string, title: string, body: string): string {
  return `<section class="report-section" id="${id}">
    <div class="section-title"><h2>${htmlEscape(title)}</h2></div>
    ${body}
  </section>`;
}

function renderBrandSection(report: HumanReport, copy: Copy): string {
  const fallbackItem = {
    text: report.locale === "zh" ? "当前回答不足以判断 AI 怎样理解你的品牌。" : "Current answers are not enough to judge how AI understands your brand.",
    answerIndexes: [],
    sourceUrls: [],
  };
  return renderStatementList(report.sections.brandDescriptions.length ? report.sections.brandDescriptions : [fallbackItem], copy);
}

function renderStyle(): string {
  return `<style>
    :root {
      color-scheme: light;
      --bg: #f6f4ee;
      --panel: #fffdfa;
      --ink: #171717;
      --muted: #696760;
      --line: #ded9ce;
      --strong: #0f5b4c;
      --accent: #bf3f2f;
      --soft: #eef4ef;
      --shadow: 0 18px 55px rgba(28, 24, 18, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.55;
    }
    a { color: var(--strong); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      min-height: 100vh;
    }
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 28px 22px;
      border-right: 1px solid var(--line);
      background: #ebe7dc;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
      font-weight: 800;
      letter-spacing: 0;
    }
    .brand svg { width: 34px; height: 34px; }
    nav {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    nav a {
      border-radius: 8px;
      color: #34322e;
      padding: 9px 10px;
      font-size: 14px;
    }
    nav a:hover { background: rgba(15, 91, 76, 0.1); text-decoration: none; }
    main {
      width: min(1120px, 100%);
      padding: 38px 34px 80px;
    }
    .hero {
      margin-bottom: 24px;
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: clamp(32px, 4vw, 54px);
      line-height: 1;
      letter-spacing: 0;
    }
    .hero p {
      max-width: 820px;
      margin: 0;
      color: var(--muted);
      font-size: 16px;
    }
    .source-note {
      margin-top: 18px;
      border: 1px solid #d6cbb9;
      background: #fff8ea;
      border-radius: 8px;
      padding: 13px 15px;
      color: #4a3820;
      font-size: 14px;
    }
    .report-section {
      margin-top: 18px;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .section-title h2 {
      margin: 0 0 18px;
      font-size: 24px;
      letter-spacing: 0;
    }
    .conclusion {
      font-size: 24px;
      line-height: 1.35;
      margin: 0;
      font-weight: 760;
      max-width: 900px;
    }
    .model-table-wrap {
      margin-top: 18px;
      overflow-x: auto;
    }
    .model-table {
      width: 100%;
      border-collapse: collapse;
      background: #fffefa;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .model-table th,
    .model-table td {
      border-bottom: 1px solid var(--line);
      padding: 12px;
      text-align: left;
      vertical-align: top;
    }
    .model-table th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }
    .model-table tr:last-child td { border-bottom: 0; }
    .model-table .evidence-row { margin-top: 0; justify-content: flex-end; }
    .brand-read {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .brand-read article,
    .competitor-card,
    .model-card,
    .source-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffefa;
      padding: 16px;
    }
    .brand-read article:first-child {
      grid-column: 1 / -1;
      background: var(--soft);
    }
    h3, h4 {
      margin: 0 0 8px;
      letter-spacing: 0;
    }
    p { margin: 0; }
    .statement-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 10px;
    }
    .statement-list li {
      padding-left: 14px;
      border-left: 3px solid var(--strong);
    }
    .evidence-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .evidence-link,
    .source-actions a {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 4px 9px;
      background: #ffffff;
      color: var(--strong);
      font-size: 13px;
      font-weight: 650;
    }
    .competitor-grid,
    .model-grid,
    .source-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 12px;
    }
    .card-head {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .card-head span {
      flex: 0 0 auto;
      border-radius: 999px;
      background: #e9f2ed;
      color: #164f43;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: 700;
    }
    .why-block {
      margin-top: 0;
    }
    .competition-stack {
      display: grid;
      gap: 14px;
    }
    .competition-stack article {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffefa;
      padding: 16px;
    }
    .compact-details {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #fffefa;
    }
    .compact-details summary {
      cursor: pointer;
      font-weight: 750;
    }
    .compact-details p {
      margin-top: 8px;
      color: var(--muted);
    }
    .source-stack {
      display: grid;
      gap: 18px;
    }
    .source-group h3 {
      margin-bottom: 10px;
    }
    .source-card p {
      color: var(--muted);
      font-size: 14px;
      margin-top: 4px;
    }
    .source-title-line {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      justify-content: space-between;
    }
    .source-status {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 750;
      background: #ece8dd;
      color: #4d473e;
    }
    .source-status.related {
      background: #e4f0ea;
      color: #145444;
    }
    .source-status.possible {
      background: #fff1d6;
      color: #795214;
    }
    .source-status.excluded {
      background: #f0ece8;
      color: #766b62;
    }
    .source-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .all-sources {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fffefa;
    }
    .all-sources summary {
      cursor: pointer;
      font-weight: 750;
    }
    .all-sources .source-grid {
      margin-top: 12px;
    }
    .answer-list {
      display: grid;
      gap: 10px;
    }
    .answer-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fffefa;
      overflow: hidden;
    }
    .answer-card summary {
      cursor: pointer;
      display: grid;
      gap: 5px;
      padding: 16px;
    }
    .answer-card summary span {
      font-weight: 750;
    }
    .answer-card summary strong {
      color: var(--muted);
      font-size: 14px;
    }
    .answer-body {
      border-top: 1px solid var(--line);
      padding: 16px;
      display: grid;
      gap: 16px;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 10px;
      margin: 0;
    }
    dt {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
    }
    dd {
      margin: 2px 0 0;
      font-weight: 650;
      overflow-wrap: anywhere;
    }
    .intent-result {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fbfaf5;
      display: grid;
      gap: 12px;
    }
    .intent-result h4,
    .intent-block h4 {
      margin: 0;
      font-size: 13px;
      letter-spacing: 0;
    }
    .intent-one {
      margin: 0;
      font-weight: 760;
    }
    .intent-block {
      display: grid;
      gap: 6px;
    }
    .intent-block ul {
      margin: 0;
      padding-left: 18px;
    }
    .intent-block li {
      margin: 5px 0;
    }
    .task-block li,
    .entity-block li {
      display: grid;
      gap: 4px;
      padding: 8px 0;
      border-top: 1px solid #ece6d9;
    }
    .task-block li:first-child,
    .entity-block li:first-child {
      border-top: 0;
    }
    .task-block span,
    .entity-block span {
      color: var(--muted);
      font-size: 13px;
    }
    .task-block p {
      margin: 0;
      color: #282622;
    }
    blockquote {
      margin: 0;
      padding: 9px 10px;
      border-left: 3px solid var(--strong);
      background: #fffefa;
      color: #38342f;
    }
    .answer-sources ul {
      margin: 0;
      padding-left: 18px;
    }
    .actual-answer p {
      white-space: pre-wrap;
      color: #282622;
    }
    .empty {
      color: var(--muted);
      background: #fbfaf5;
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    @media (max-width: 840px) {
      .layout { display: block; }
      .sidebar {
        position: relative;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      nav {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      main { padding: 28px 16px 60px; }
      .brand-read { grid-template-columns: 1fr; }
      .report-section { padding: 18px; }
    }
  </style>`;
}

export function renderDashboardHtml(model: AuditReportModel): string {
  const report = buildHumanReport(model.audit);
  const copy = COPY[report.locale];
  const navIds = ["summary", "brand", "competitors", "competition", "sources"];
  return `<!doctype html>
<html lang="${htmlEscape(copy.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(report.title)} - ${htmlEscape(PRODUCT_NAME)}</title>
  ${renderStyle()}
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">${renderNiubigeoMarkSvg()}<span>${htmlEscape(PRODUCT_NAME)}</span></div>
      <nav>
        ${copy.nav.map((label, index) => `<a href="#${navIds[index]}">${htmlEscape(label)}</a>`).join("")}
      </nav>
    </aside>
    <main>
      <header class="hero">
        <h1>${htmlEscape(report.title)}</h1>
        <p>${htmlEscape(report.subtitle)}</p>
        <div class="source-note">${htmlEscape(report.caveat)}</div>
      </header>
      ${renderSection("summary", copy.sections.summary, `<p class="conclusion">${htmlEscape(report.sections.headline)}</p>${renderModelTable(report, copy)}`)}
      ${renderSection("brand", copy.sections.brand, renderBrandSection(report, copy))}
      ${renderSection("competitors", copy.sections.competitors, renderCompetitors(report, copy))}
      ${renderSection("competition", copy.sections.competition, renderCompetitionSection(report, copy))}
      ${renderSection("sources", copy.sections.sources, renderSources(report, copy))}
    </main>
  </div>
  <script>
    function openHashTarget() {
      var id = window.location.hash ? window.location.hash.slice(1) : "";
      if (!id) return;
      var target = document.getElementById(id);
      if (target && target.tagName && target.tagName.toLowerCase() === "details") target.open = true;
      var parent = target ? target.parentElement : null;
      while (parent) {
        if (parent.tagName && parent.tagName.toLowerCase() === "details") parent.open = true;
        parent = parent.parentElement;
      }
    }
    window.addEventListener("hashchange", openHashTarget);
    openHashTarget();
  </script>
</body>
</html>`;
}
