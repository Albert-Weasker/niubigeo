import { PRODUCT_NAME, PRODUCT_TITLE, renderNiubigeoLockup } from "./brand.js";
import { WORKBENCH_CSS } from "./workbench-style.js";
import { renderWorkbenchScript } from "./workbench-script.js";

function navButton(index: string, view: string, key: string, active = false): string {
  return `<button class="nav-button${active ? " active" : ""}" type="button" data-view="${view}"><span class="nav-index">${index}</span><span data-i18n="${key}">${key}</span></button>`;
}

function wizardStep(step: number, key: string): string {
  return `<button class="wizard-step${step === 1 ? " active" : ""}" type="button" data-step="${step}"><span>0${step}</span><br><span data-i18n="${key}">${key}</span></button>`;
}

export function renderAppHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${PRODUCT_TITLE}</title>
  <style>${WORKBENCH_CSS}</style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        ${renderNiubigeoLockup("brand-lockup-image")}
      </div>

      <div class="project-switcher">
        <label for="project-select" data-i18n="project">项目</label>
        <select id="project-select" aria-label="Project"></select>
      </div>

      <nav class="nav-group" aria-label="Workspace">
        ${navButton("01", "overview", "overview", true)}
        ${navButton("02", "prompts", "prompts")}
        ${navButton("03", "visibility", "visibility")}
        ${navButton("04", "competitors", "competitorsNav")}
        ${navButton("05", "citations", "citations")}
        ${navButton("06", "monitoring", "monitoring")}
        ${navButton("07", "runs", "runRecords")}
      </nav>
      <div class="nav-separator"></div>
      <nav class="nav-group" aria-label="Configuration">
        ${navButton("08", "providers", "providersNav")}
        ${navButton("09", "settings", "settings")}
      </nav>

      <div class="sidebar-footer"><div class="health-line"><span>NiubiGEO OSS</span><span id="health" class="status info">...</span></div></div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb"><strong>${PRODUCT_NAME}</strong> &nbsp;/&nbsp; <span id="breadcrumb-project">项目</span></div>
        <div class="top-actions">
          <select id="model-filter" aria-label="Model filter"><option value="all">全部模型</option></select>
          <div class="language-switch" role="group" aria-label="Language">
            <button class="language-button" type="button" data-language-choice="zh" aria-pressed="true">中文</button>
            <button class="language-button" type="button" data-language-choice="en" aria-pressed="false">EN</button>
          </div>
          <button class="button primary" type="button" data-open-wizard="true" data-i18n="newProject">新建项目</button>
        </div>
      </header>

      <main class="content">
        <div id="global-error" class="error-box hidden"></div>
        <aside id="audit-progress" class="audit-progress hidden" aria-live="polite" aria-label="Audit progress"></aside>
        <header class="page-head">
          <div class="page-title"><p class="eyebrow" data-i18n="workspaceSubtitle">来自真实 Provider 观察的证据</p><h1 id="page-title">总览</h1></div>
          <div class="inline-actions"><button class="button" type="button" data-create-monitoring="true" data-i18n="setMonitoring">设置定时监测</button><button id="import-runs" class="button" type="button" data-i18n="importRuns">导入已有运行</button></div>
        </header>

        <div class="toolbar">
          <div class="segmented" role="group" aria-label="Time range">
            <button class="segment" type="button" data-period="1d" data-i18n="last24Hours">24 小时</button>
            <button class="segment" type="button" data-period="7d" data-i18n="last7Days">7 天</button>
            <button class="segment" type="button" data-period="30d" data-i18n="last30Days">30 天</button>
            <button class="segment" type="button" data-period="90d">90 天</button>
            <button class="segment active" type="button" data-period="all" data-i18n="allTime">全部时间</button>
          </div>
          <div class="inline-actions"><select id="search-filter" aria-label="Search filter"><option value="all" data-i18n="allSearch">全部联网方式</option><option value="true" data-i18n="webSearchOn">开启</option><option value="false" data-i18n="webSearchOff">关闭</option></select><span class="status info" data-i18n="dataSourceShort" title="Provider API">Provider API</span></div>
        </div>

        <section class="view active" data-view-panel="overview"><div id="overview-body"></div><div id="result" class="section hidden"><div id="result-body"></div></div></section>
        <section class="view" data-view-panel="prompts"><div id="prompts-body"></div></section>
        <section class="view" data-view-panel="visibility"><div id="visibility-body"></div></section>
        <section class="view" data-view-panel="competitors"><div id="competitors-body"></div></section>
        <section class="view" data-view-panel="citations"><div id="citations-body"></div></section>
        <section class="view" data-view-panel="monitoring"><div id="monitoring-body"></div></section>
        <section class="view" data-view-panel="runs"><div class="section-head"><div><h2 data-i18n="runRecords">运行记录</h2></div><button id="reload-runs" class="button" type="button" data-i18n="runRecords">运行记录</button></div><div id="runs-body"></div></section>
        <section class="view" data-view-panel="providers">
          <div class="section-head"><div><h2 data-i18n="providerCatalog">Provider 目录</h2><p data-i18n="providerCatalogHelp">各家 Key 独立使用；OpenRouter 可以用一个 Key 路由其支持的多个模型。</p></div></div>
          <div class="provider-model-toolbar"><label for="provider-model-search" data-i18n="searchModels">搜索模型</label><input id="provider-model-search" type="search" data-i18n-placeholder="searchModelsPlaceholder" placeholder="输入模型名称或 ID"></div>
          <div id="providers"><div id="provider-list" class="provider-grid"></div></div>
        </section>
        <section class="view" data-view-panel="settings"><div id="settings-body"></div></section>
      </main>
    </div>
  </div>

  <div id="drawer-backdrop" class="drawer-backdrop"></div>
  <aside id="wizard" class="wizard" aria-label="Create monitoring project">
    <div class="wizard-head">
      <div><h2 data-i18n="wizardTitle">新建监测项目</h2><p data-i18n="wizardSubtitle">任何真实 Provider 请求执行前，都可以检查并编辑全部问题。</p></div>
      <button id="wizard-close" class="close-button" type="button" aria-label="Close">×</button>
    </div>
    <div class="wizard-steps">
      ${wizardStep(1, "stepDomain")}${wizardStep(2, "stepIdentity")}${wizardStep(3, "stepQuestions")}${wizardStep(4, "stepModels")}${wizardStep(5, "stepSchedule")}
    </div>

    <form id="audit-form" autocomplete="off">
      <div class="wizard-body" id="new-audit">
        <section class="wizard-panel active" data-step-panel="1">
          <h3 data-i18n="stepDomain">域名</h3><p data-i18n="domainHelp">站点只用于识别品牌并生成问题，不会被算作 AI 可见度证据。</p>
          <div class="form-grid">
            <div class="field full"><label for="domain" data-i18n="domainUrl">域名或 URL</label><input id="domain" name="domain" placeholder="example.com" required></div>
            <div class="field full"><label for="githubRepo" data-i18n="githubRepo">GitHub 仓库</label><input id="githubRepo" name="githubRepo" placeholder="org/repo"><p class="field-help" data-i18n="githubRepoHelp">可选。README 和 Topics 可以帮助形成监测问题。</p></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="2">
          <h3 data-i18n="stepIdentity">品牌</h3><p data-i18n="competitorsHelp">可选，每行一个。自动识别结果仍需用户确认。</p>
          <div class="form-grid">
            <div class="field full"><label for="competitors" data-i18n="competitorsInput">竞争对手域名</label><textarea id="competitors" name="competitors" placeholder="competitor-a.com&#10;competitor-b.com"></textarea></div>
            <div class="field full"><label for="autoDiscover" data-i18n="discovery">识别方式</label><select id="autoDiscover" name="autoDiscover"><option value="true" data-i18n="autoDiscover">识别品牌、实体和问题</option><option value="false" data-i18n="domainOnly">只使用用户输入</option></select></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="3">
          <h3 data-i18n="stepQuestions">问题</h3><p data-i18n="promptCountHelp">生成的问题在运行前仍然可以编辑。</p>
          <div class="form-grid">
            <div class="field full"><label for="keywords" data-i18n="keywords">关键词</label><textarea id="keywords" name="keywords" placeholder="AI visibility&#10;brand monitoring"></textarea><p class="field-help" data-i18n="keywordsHelp">用户输入的关键词会优先用于生成监测问题。</p></div>
            <div class="field"><label for="promptCount" data-i18n="promptCount">问题数量</label><input id="promptCount" name="promptCount" type="number" min="1" max="30" value="8"></div>
            <div class="field"><label for="keywordMode" data-i18n="keywordMode">关键词模式</label><select id="keywordMode" name="keywordMode"><option value="site_plus_user" data-i18n="sitePlusUser">站点 + 用户关键词</option><option value="user_only" data-i18n="userOnlyKeywords">仅用户关键词</option><option value="site_only" data-i18n="siteOnlyKeywords">仅站点关键词</option></select></div>
            <div class="field"><label for="keywordLimit" data-i18n="keywordLimit">关键词数量</label><input id="keywordLimit" name="keywordLimit" type="number" min="1" max="30" value="6"></div>
            <div class="field"><label for="promptsPerKeyword" data-i18n="promptsPerKeyword">每个关键词的问题数</label><input id="promptsPerKeyword" name="promptsPerKeyword" type="number" min="1" max="6" value="2"></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="4">
          <h3 data-i18n="stepModels">模型</h3><p data-i18n="providerCatalogHelp">各家 Key 独立使用；OpenRouter 可以用一个 Key 路由其支持的多个模型。</p>
          <div class="form-grid">
            <div class="field"><label for="provider" data-i18n="provider">Provider</label><select id="provider" name="provider"></select></div>
            <div class="field"><label for="models" data-i18n="models">模型</label><input id="models" name="models" value="openai/gpt-4o-mini,perplexity/sonar" required></div>
            <div class="field full"><div id="selected-model-capabilities" class="selected-model-capabilities" aria-live="polite"></div></div>
            <div class="field"><label for="maxTokens" data-i18n="maxTokens">回答最大 Token</label><input id="maxTokens" name="maxTokens" type="number" min="200" max="4000" value="700"></div>
            <div class="field"><label for="repeatCount" data-i18n="repeatCount">每个问题重复次数</label><input id="repeatCount" name="repeatCount" type="number" min="1" max="10" value="1"><p class="field-help" data-i18n="repeatCountHelp">重复请求会形成独立观察，用于降低单次随机性的影响。</p></div>
            <div class="field"><label for="webSearchEnabled" data-i18n="webSearch">联网搜索</label><select id="webSearchEnabled" name="webSearchEnabled"><option value="false" data-i18n="webSearchOff">关闭</option><option value="true" data-i18n="webSearchOn">开启</option></select></div>
            <div class="field"><label id="language-label" data-i18n="auditLanguage">页面与回答语言</label><div class="language-switch"><button class="language-button" type="button" data-language-choice="zh">中文</button><button class="language-button" type="button" data-language-choice="en">EN</button></div></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="5">
          <h3 data-i18n="stepSchedule">频率</h3><p data-i18n="whatChangedHelp">只有两次运行条件完全一致时才显示变化。</p>
          <div class="form-grid">
            <div class="field full"><label for="scheduleKind" data-i18n="schedule">执行频率</label><select id="scheduleKind" name="scheduleKind"><option value="manual" data-i18n="manual">仅运行一次</option><option value="weekly" data-i18n="weekly">每周</option><option value="daily" data-i18n="daily">每天</option><option value="monthly" data-i18n="monthly">每月</option><option value="cron" data-i18n="customSchedule">自定义</option></select></div>
            <div class="field project-schedule-field hidden"><label for="projectScheduleTimezone" data-i18n="timezone">时区</label><input id="projectScheduleTimezone" name="projectScheduleTimezone" value="Asia/Shanghai"></div>
            <div class="field project-schedule-field project-schedule-simple hidden"><label for="projectScheduleTime" data-i18n="time">运行时间</label><input id="projectScheduleTime" name="projectScheduleTime" type="time" value="09:00"></div>
            <div class="field project-schedule-field project-schedule-weekly hidden"><label for="projectScheduleDayOfWeek" data-i18n="dayOfWeek">运行日期</label><select id="projectScheduleDayOfWeek" name="projectScheduleDayOfWeek"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="0">0</option></select></div>
            <div class="field project-schedule-field project-schedule-monthly hidden"><label for="projectScheduleDayOfMonth" data-i18n="dayOfMonth">每月日期</label><input id="projectScheduleDayOfMonth" name="projectScheduleDayOfMonth" type="number" min="1" max="31" value="1"></div>
            <div class="field full project-schedule-field project-schedule-cron hidden"><label for="projectScheduleCron">Cron</label><input id="projectScheduleCron" name="projectScheduleCron" value="0 9 * * 1"></div>
          </div>
        </section>

        <section id="confirm-plan" class="hidden">
          <div class="section-head"><div><h2 data-i18n="confirmQuestions">确认问题</h2><p data-i18n="wizardSubtitle">任何真实 Provider 请求执行前，都可以检查并编辑全部问题。</p></div></div>
          <div id="plan-error" class="error-box hidden"></div><div id="plan-body"></div>
        </section>
      </div>

      <div class="wizard-footer">
        <div><button id="wizard-back" class="button" type="button" data-i18n="back">上一步</button></div>
        <div class="request-estimate" id="request-estimate"></div>
        <div class="actions"><span id="run-status" class="status">—</span><button id="run-button" class="button primary hidden" type="submit">Run</button><button id="wizard-next" class="button primary" type="button" data-i18n="next">下一步</button></div>
      </div>
    </form>
  </aside>

  <div id="detail-backdrop" class="detail-backdrop"></div>
  <aside id="detail-sheet" class="detail-sheet" aria-label="Evidence" aria-hidden="true">
    <div class="detail-head"><strong id="detail-title">证据</strong><button id="detail-close" class="close-button" type="button" aria-label="Close">×</button></div>
    <div id="detail-body" class="detail-body"></div>
  </aside>

  ${renderWorkbenchScript()}
</body>
</html>`;
}
