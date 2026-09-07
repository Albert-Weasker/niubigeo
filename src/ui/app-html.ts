import { PRODUCT_NAME, PRODUCT_TITLE, renderNiubigeoMarkSvg } from "./brand.js";

export function renderAppHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${PRODUCT_TITLE}</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --panel: #ffffff;
      --panel-soft: #f9fafb;
      --border: #d9dee7;
      --text: #111827;
      --muted: #5b6472;
      --blue: #1d4ed8;
      --green: #047857;
      --green-soft: #d1fae5;
      --amber: #a16207;
      --amber-soft: #fef3c7;
      --red: #b91c1c;
      --red-soft: #fee2e2;
      --shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 30px rgba(15, 23, 42, 0.06);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .shell { display: grid; grid-template-columns: 260px minmax(0, 1fr); min-height: 100vh; }
    aside {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 22px 18px;
      border-right: 1px solid var(--border);
      background: var(--panel);
    }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .brand-mark { width: 36px; height: 36px; flex: 0 0 auto; }
    .brand-mark svg { display: block; width: 100%; height: 100%; }
    .brand strong { display: block; font-size: 14px; }
    .brand span { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; }
    nav { display: grid; gap: 4px; }
    nav a { padding: 9px 10px; border-radius: 7px; color: #273142; font-size: 14px; }
    nav a:hover { background: var(--panel-soft); text-decoration: none; }
    .source-note {
      margin-top: 24px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-soft);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    main { padding: 28px 28px 56px; min-width: 0; }
    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 22px;
    }
    .top-actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      flex: 0 0 auto;
    }
    .language-switch, .language-control {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
    }
    .language-switch span {
      padding: 0 8px 0 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
    }
    .language-button {
      height: 30px;
      min-width: 48px;
      padding: 0 10px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #334155;
      font-size: 13px;
      font-weight: 800;
    }
    .language-button.active {
      background: #111827;
      color: #fff;
    }
    .language-control {
      width: 100%;
      justify-content: stretch;
    }
    .language-control .language-button {
      flex: 1 1 0;
      height: 34px;
    }
    .field-help {
      margin-top: 7px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    h1 { margin: 0; font-size: 28px; line-height: 1.15; }
    h2 { margin: 0; font-size: 19px; line-height: 1.25; }
    p { margin: 0; }
    .eyebrow {
      margin: 0 0 6px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .subtle { margin-top: 7px; color: var(--muted); font-size: 13px; line-height: 1.5; }
    .panel {
      margin-top: 18px;
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .hidden { display: none !important; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr); gap: 18px; align-items: start; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .field.full { grid-column: 1 / -1; }
    label { display: block; margin-bottom: 7px; color: #334155; font-size: 12px; font-weight: 750; }
    input, select, textarea {
      width: 100%;
      min-height: 40px;
      padding: 0 11px;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: #fff;
      color: var(--text);
      font: inherit;
      font-size: 14px;
    }
    input, select { height: 40px; }
    textarea {
      height: 92px;
      padding: 10px 11px;
      resize: vertical;
      line-height: 1.45;
    }
    input:focus, select:focus, textarea:focus { outline: 2px solid #bfdbfe; border-color: #93c5fd; }
    .actions { display: flex; gap: 10px; align-items: center; margin-top: 16px; }
    button {
      height: 40px;
      padding: 0 14px;
      border: 1px solid #111827;
      border-radius: 7px;
      background: #111827;
      color: #fff;
      font: inherit;
      font-size: 14px;
      font-weight: 750;
      cursor: pointer;
    }
    button.secondary { border-color: var(--border); background: #fff; color: #111827; }
    button:disabled { border-color: var(--border); background: #e5e7eb; color: var(--muted); cursor: not-allowed; }
    .provider-list { display: grid; gap: 8px; margin-top: 14px; }
    .provider-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-soft);
    }
    .provider-row strong { display: block; font-size: 13px; }
    .provider-row span { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 3px 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: #fff;
      color: #334155;
      font-size: 12px;
      white-space: nowrap;
    }
    .pill.ok { color: var(--green); border-color: #a7f3d0; background: var(--green-soft); }
    .pill.missing { color: var(--red); border-color: #fecaca; background: var(--red-soft); }
    .pill.running { color: var(--amber); border-color: #fde68a; background: var(--amber-soft); }
    .metric-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .metric {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-soft);
    }
    .metric span { color: var(--muted); font-size: 12px; font-weight: 800; }
    .metric strong { display: block; margin-top: 8px; font-size: 22px; }
    .plan-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; margin-top: 14px; }
    .target-summary, .plan-summary, .prompt-group {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-soft);
    }
    .summary-list { display: grid; gap: 8px; margin-top: 10px; }
    .summary-list div { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 13px; }
    .summary-list strong { color: var(--text); }
    .chip-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 4px 9px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: #fff;
      color: #334155;
      font-size: 12px;
      font-weight: 750;
    }
    .chip button {
      width: 18px;
      height: 18px;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: #e5e7eb;
      color: #111827;
      font-size: 12px;
      line-height: 1;
    }
    .inline-add { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: 10px; }
    .prompt-groups { display: grid; gap: 14px; }
    .prompt-group h3 { margin: 0; font-size: 15px; }
    .prompt-group > p { margin: 6px 0 12px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .prompt-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) 180px auto;
      gap: 10px;
      align-items: start;
      padding: 10px 0;
      border-top: 1px solid #e5e7eb;
    }
    .prompt-row:first-of-type { border-top: 0; }
    .prompt-row input[type="checkbox"] { width: 18px; height: 18px; min-height: 18px; margin-top: 11px; }
    .prompt-row textarea { min-height: 54px; height: 54px; resize: vertical; }
    .prompt-row button { height: 34px; margin-top: 3px; }
    .prompt-add { display: grid; grid-template-columns: 190px minmax(0, 1fr) auto; gap: 8px; margin-top: 14px; }
    .table-wrap { width: 100%; overflow-x: auto; margin-top: 14px; border: 1px solid var(--border); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { padding: 10px 12px; border-bottom: 1px solid var(--border); background: #f3f5f8; text-align: left; white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid #edf0f4; vertical-align: top; overflow-wrap: anywhere; }
    tr:last-child td { border-bottom: 0; }
    .result-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .result-actions a { display: inline-flex; align-items: center; height: 36px; padding: 0 11px; border: 1px solid var(--border); border-radius: 7px; background: #fff; font-size: 13px; font-weight: 750; }
    .error { margin-top: 12px; padding: 12px; border: 1px solid #fecaca; border-radius: 8px; background: var(--red-soft); color: var(--red); font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
    .empty { color: var(--muted); font-size: 13px; line-height: 1.5; }
    @media (max-width: 1080px) {
      .shell { grid-template-columns: 1fr; }
      aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--border); }
      nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .grid, .form-grid { grid-template-columns: 1fr; }
      .plan-grid, .prompt-row, .prompt-add { grid-template-columns: 1fr; }
      .field.full { grid-column: auto; }
      .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 680px) {
      main { padding: 20px 14px 40px; }
      .topbar, .actions, .top-actions { flex-direction: column; align-items: stretch; }
      nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand">
        <div class="brand-mark">${renderNiubigeoMarkSvg("brand-mark-svg")}</div>
        <div>
          <strong>${PRODUCT_NAME}</strong>
          <span data-i18n="singleDomainAudit">Single-domain audit</span>
        </div>
      </div>
      <nav>
        <a href="#new-audit" data-i18n="navNewAudit">New Audit</a>
        <a href="#confirm-plan" data-i18n="navConfirmPlan">Confirm Questions</a>
        <a href="#providers" data-i18n="navProviders">Providers</a>
        <a href="#result" data-i18n="navLatestResult">Latest Result</a>
        <a href="#runs" data-i18n="navRecentRuns">Recent Runs</a>
      </nav>
      <div class="source-note">
        <strong data-i18n="sourceRule">Source rule</strong>
        <p data-i18n="sourceRuleBody">API results stay labeled as API results. Browser UI and human-verified regional data are not part of this open-source layer.</p>
      </div>
    </aside>
    <main>
      <header class="topbar">
        <div>
          <p class="eyebrow" data-i18n="appEyebrow">Open-source AI visibility monitor</p>
          <h1 data-i18n="appTitle">Run a real provider audit</h1>
          <p class="subtle" data-i18n="appSubtitle">No API key means no AI visibility result. Configure a provider key, enter one domain, then inspect the generated evidence-backed report.</p>
        </div>
        <div class="top-actions">
          <div class="language-switch" role="group" aria-label="Language">
            <span data-i18n="languageSwitch">Language</span>
            <button class="language-button" type="button" data-language-choice="zh" aria-pressed="false">中文</button>
            <button class="language-button" type="button" data-language-choice="en" aria-pressed="false">EN</button>
          </div>
          <span id="health" class="pill" data-i18n="checking">checking</span>
        </div>
      </header>

      <div class="grid">
        <section class="panel" id="new-audit">
          <p class="eyebrow" data-i18n="newAudit">New Audit</p>
          <h2 data-i18n="domainProvider">Domain and provider</h2>
          <form id="audit-form">
            <div class="form-grid">
              <div class="field full">
                <label for="domain" data-i18n="domainUrl">Domain or URL</label>
                <input id="domain" name="domain" value="www.niubistar.com" autocomplete="off" required>
              </div>
              <div class="field full">
                <label for="keywords" data-i18n="keywords">Keywords</label>
                <textarea id="keywords" name="keywords" autocomplete="off" data-i18n-placeholder="keywordsPlaceholder" placeholder="GitHub project promotion&#10;GitHub star growth"></textarea>
                <p class="field-help" data-i18n="keywordsHelp">Optional. User keywords are always audited first; site SEO keywords fill the remaining slots.</p>
              </div>
              <div class="field full">
                <label for="competitors" data-i18n="competitorsInput">Competitor domains</label>
                <textarea id="competitors" name="competitors" autocomplete="off" data-i18n-placeholder="competitorsPlaceholder" placeholder="github.com&#10;ossinsight.io"></textarea>
                <p class="field-help" data-i18n="competitorsHelp">Optional. If empty, auto-discovery may propose competitors from the domain profile.</p>
              </div>
              <div class="field full">
                <label for="githubRepo" data-i18n="githubRepo">GitHub repository</label>
                <input id="githubRepo" name="githubRepo" autocomplete="off" data-i18n-placeholder="githubRepoPlaceholder" placeholder="org/repo or https://github.com/org/repo">
                <p class="field-help" data-i18n="githubRepoHelp">Optional. README and topics become keyword evidence; they do not count as AI visibility until provider prompts run.</p>
              </div>
              <div class="field">
                <label for="provider" data-i18n="provider">Provider</label>
                <select id="provider" name="provider"></select>
              </div>
              <div class="field">
                <label for="models" data-i18n="models">Models</label>
                <input id="models" name="models" value="openai/gpt-4o-mini,perplexity/sonar" autocomplete="off" required>
              </div>
              <div class="field">
                <label for="promptCount" data-i18n="promptCount">Prompt count</label>
                <input id="promptCount" name="promptCount" type="number" min="1" max="30" value="8" required>
                <p class="field-help" data-i18n="promptCountHelp">Used for fallback/domain-profile prompts. Keyword runs use keyword limit x prompts per keyword.</p>
              </div>
              <div class="field">
                <label for="keywordMode" data-i18n="keywordMode">Keyword mode</label>
                <select id="keywordMode" name="keywordMode">
                  <option value="site_plus_user" data-i18n="sitePlusUser">Site + user keywords</option>
                  <option value="user_only" data-i18n="userOnlyKeywords">User keywords only</option>
                  <option value="site_only" data-i18n="siteOnlyKeywords">Site keywords only</option>
                </select>
              </div>
              <div class="field">
                <label for="keywordLimit" data-i18n="keywordLimit">Keyword limit</label>
                <input id="keywordLimit" name="keywordLimit" type="number" min="1" max="30" value="6" required>
              </div>
              <div class="field">
                <label for="promptsPerKeyword" data-i18n="promptsPerKeyword">Prompts per keyword</label>
                <input id="promptsPerKeyword" name="promptsPerKeyword" type="number" min="1" max="6" value="2" required>
              </div>
              <div class="field">
                <label for="maxTokens" data-i18n="maxTokens">Max tokens</label>
                <input id="maxTokens" name="maxTokens" type="number" min="200" max="4000" value="700" required>
              </div>
              <div class="field">
                <label for="webSearchEnabled" data-i18n="webSearch">Web search</label>
                <select id="webSearchEnabled" name="webSearchEnabled">
                  <option value="false" data-i18n="webSearchOff">Off</option>
                  <option value="true" data-i18n="webSearchOn">On</option>
                </select>
                <p class="field-help" data-i18n="webSearchHelp">Off sends no web-search tool. On uses the provider's native search path.</p>
              </div>
              <div class="field">
                <label for="webSearchMode" data-i18n="searchMode">Search mode</label>
                <select id="webSearchMode" name="webSearchMode">
                  <option value="auto" data-i18n="searchModeAuto">Auto</option>
                  <option value="provider_native" data-i18n="searchModeNative">Provider native only</option>
                </select>
              </div>
              <div class="field">
                <label id="language-label" data-i18n="languageLabel">Audit language</label>
                <div class="language-control" role="group" aria-labelledby="language-label">
                  <button class="language-button" type="button" data-language-choice="zh" aria-pressed="false">中文</button>
                  <button class="language-button" type="button" data-language-choice="en" aria-pressed="false">EN</button>
                </div>
                <p class="field-help" data-i18n="languageHelp">Controls UI copy and provider answer language.</p>
              </div>
              <div class="field">
                <label for="autoDiscover" data-i18n="discovery">Discovery</label>
                <select id="autoDiscover" name="autoDiscover">
                  <option value="true" data-i18n="autoDiscover">Auto-discover brand, competitors, prompts</option>
                  <option value="false" data-i18n="domainOnly">Use domain only</option>
                </select>
              </div>
            </div>
            <div class="actions">
              <button id="run-button" type="submit" data-i18n="buildAuditPlan">Identify and confirm questions</button>
              <button class="secondary" id="reload-runs" type="button" data-i18n="refreshRuns">Refresh runs</button>
              <span id="run-status" class="pill" data-i18n="idle">idle</span>
            </div>
          </form>
        </section>

        <section class="panel" id="providers">
          <p class="eyebrow" data-i18n="providerCatalog">Provider Catalog</p>
          <h2 data-i18n="configuredKeys">Configured keys</h2>
          <div id="provider-list" class="provider-list"></div>
        </section>
      </div>

      <section class="panel hidden" id="confirm-plan">
        <p class="eyebrow" data-i18n="confirmStep">Confirm before running</p>
        <h2 data-i18n="confirmQuestions">Review audit target, competitors, and questions</h2>
        <p class="subtle" data-i18n="confirmHelp">The provider will not be called until these questions are confirmed.</p>
        <div id="plan-body" class="empty" data-i18n="noPlanYet">Enter a domain and identify questions first.</div>
      </section>

      <section class="panel" id="result">
        <p class="eyebrow" data-i18n="latestResult">Latest Result</p>
        <h2 data-i18n="auditOutput">Audit output</h2>
        <div id="result-body" class="empty" data-i18n="noAuditSession">No audit has been run in this browser session.</div>
      </section>

      <section class="panel" id="runs">
        <p class="eyebrow" data-i18n="recentRuns">Recent Runs</p>
        <h2 data-i18n="savedReports">Saved reports</h2>
        <div id="runs-body" class="empty" data-i18n="loadingRuns">Loading saved runs...</div>
      </section>
    </main>
  </div>

  <script>
    const state = { providers: [], latestResult: null, latestRuns: null, auditPlan: null, locale: "zh" };
    const $ = (id) => document.getElementById(id);
    const translations = {
      en: {
        singleDomainAudit: "Single-domain audit",
        navNewAudit: "New Audit",
        navConfirmPlan: "Confirm Questions",
        navProviders: "Providers",
        navLatestResult: "Latest Result",
        navRecentRuns: "Recent Runs",
        sourceRule: "Source rule",
        sourceRuleBody: "API results stay labeled as API results. Browser UI and human-verified regional data are not part of this open-source layer.",
        languageSwitch: "Language",
        appEyebrow: "Open-source AI visibility monitor",
        appTitle: "Run a real provider audit",
        appSubtitle: "No API key means no AI visibility result. Configure a provider key, enter one domain, then inspect the generated evidence-backed report.",
        checking: "checking",
        serverOnline: "server online",
        serverError: "server error",
        newAudit: "New Audit",
        domainProvider: "Domain and provider",
        domainUrl: "Domain or URL",
        keywords: "Keywords",
        keywordsPlaceholder: "GitHub project promotion\\nGitHub star growth\\nopen-source launch platforms",
        keywordsHelp: "Optional. User keywords are always audited first; site SEO keywords fill the remaining slots.",
        competitorsInput: "Competitor domains",
        competitorsPlaceholder: "github.com\\nossinsight.io",
        competitorsHelp: "Optional. If empty, auto-discovery may propose competitors from the domain profile.",
        githubRepo: "GitHub repository",
        githubRepoPlaceholder: "org/repo or https://github.com/org/repo",
        githubRepoHelp: "Optional. README and topics become keyword evidence; they do not count as AI visibility until provider prompts run.",
        provider: "Provider",
        models: "Models",
        promptCount: "Prompt count",
        promptCountHelp: "Used for fallback/domain-profile prompts. Keyword runs use keyword limit x prompts per keyword.",
        keywordMode: "Keyword mode",
        sitePlusUser: "Site + user keywords",
        userOnlyKeywords: "User keywords only",
        siteOnlyKeywords: "Site keywords only",
        keywordLimit: "Keyword limit",
        promptsPerKeyword: "Prompts per keyword",
        maxTokens: "Max tokens",
        languageLabel: "Audit language",
        languageHelp: "Controls UI copy and provider answer language.",
        discovery: "Discovery",
        autoDiscover: "Auto-discover brand, competitors, prompts",
        domainOnly: "Use domain only",
        runRealAudit: "Run real audit",
        buildAuditPlan: "Identify and confirm questions",
        confirmStep: "Confirm before running",
        confirmQuestions: "Review audit target, competitors, and questions",
        confirmHelp: "The provider will not be called until these questions are confirmed.",
        noPlanYet: "Enter a domain and identify questions first.",
        identifyingQuestions: "Identifying target, competitors, keywords, and questions.",
        planReady: "Questions ready for review",
        auditTarget: "Audit target",
        brand: "Brand",
        aliases: "Aliases",
        officialSite: "Official site",
        identifiedCompetitors: "Identified competitors",
        addCompetitor: "Add competitor",
        competitorDomain: "Competitor domain",
        brandAwarenessQuestions: "Brand awareness questions",
        brandAwarenessHelp: "Used to test whether the AI recognizes and describes the named brand.",
        organicDiscoveryQuestions: "Unbranded discovery questions",
        organicDiscoveryHelp: "Used to test whether the AI recommends the brand without being given its name.",
        comparisonQuestions: "Comparison questions",
        comparisonHelp: "Used to test how the target appears against alternatives and competitors.",
        otherQuestions: "Other questions",
        promptText: "Question",
        promptCategory: "Category",
        enabled: "Enabled",
        delete: "Delete",
        addPrompt: "Add question",
        newPromptPlaceholder: "Type a new monitoring question",
        plannedRunSummary: "Planned run summary",
        enabledPrompts: "Enabled questions",
        disabledPrompts: "Disabled questions",
        providerRuns: "Provider requests",
        webSearch: "Web search",
        webSearchOff: "Off",
        webSearchOn: "On",
        webSearchHelp: "Off sends no web-search tool. On uses the provider's native search path.",
        searchMode: "Search mode",
        searchModeAuto: "Auto",
        searchModeNative: "Provider native only",
        nativeSearch: "Native search",
        promptSet: "Prompt Set",
        analysisRules: "Analysis rules",
        confirmAndRun: "Confirm and run API audit",
        noCompetitors: "No competitors configured.",
        yes: "Yes",
        no: "No",
        brandAwareness: "Brand awareness",
        organicDiscovery: "Organic discovery",
        comparison: "Comparison",
        other: "Other",
        naturalDiscoveryRate: "Natural Discovery Rate",
        brandAwarenessRate: "Brand Awareness Rate",
        organicRecommendationRate: "Organic Recommendation Rate",
        officialCitationRate: "Official Citation Rate",
        conditionsChanged: "Conditions changed; do not compare directly",
        comparableRun: "Comparable with previous run",
        firstRun: "First run",
        refreshRuns: "Refresh runs",
        idle: "idle",
        providerCatalog: "Provider Catalog",
        configuredKeys: "Configured keys",
        latestResult: "Latest Result",
        auditOutput: "Audit output",
        noAuditSession: "No audit has been run in this browser session.",
        recentRuns: "Recent Runs",
        savedReports: "Saved reports",
        loadingRuns: "Loading saved runs...",
        configured: "configured",
        missing: "missing",
        keyConfigured: "key configured",
        missingKey: "missing key",
        runningProviderCalls: "running real provider calls",
        runningAuditMessage: "Running audit. This can take a few minutes because each prompt is sent to real AI providers.",
        completed: "completed",
        failed: "failed",
        auditFailed: "Audit failed",
        noSavedReports: "No saved report found.",
        mentionRate: "Mention Rate",
        citationRate: "Citation Rate",
        recommendationRate: "Recommendation Rate",
        shareOfVoice: "Share of Voice",
        keywordAudit: "Keyword Audit",
        ownedRelevance: "Owned Relevance",
        aiKeywordAssociation: "AI Keyword Association",
        competitorOnly: "Competitor-only",
        keywordHeader: "Keyword",
        sourceHeader: "Source",
        gapHeader: "Gap",
        openHtmlReport: "Open HTML report",
        openReportJson: "Open report JSON",
        providerModel: "Provider / Model",
        completedHeader: "Completed",
        mentionHeader: "Mention",
        citationHeader: "Citation",
        recommendationHeader: "Recommendation",
        sovHeader: "SOV",
        severity: "Severity",
        area: "Area",
        gap: "Gap",
        run: "Run",
        target: "Target",
        report: "Report",
        open: "open"
      },
      zh: {
        singleDomainAudit: "单域名审计",
        navNewAudit: "新建审计",
        navConfirmPlan: "确认问题",
        navProviders: "Provider",
        navLatestResult: "最新结果",
        navRecentRuns: "历史报告",
        sourceRule: "来源规则",
        sourceRuleBody: "API 结果必须标注为 API 结果。网页端 UI 和真人地区验证不属于开源层。",
        languageSwitch: "语言",
        appEyebrow: "开源 AI 可见度监测",
        appTitle: "运行真实 Provider 审计",
        appSubtitle: "没有 API Key 就没有 AI 可见度结果。配置 Provider Key，输入一个域名，然后查看带证据的报告。",
        checking: "检查中",
        serverOnline: "服务在线",
        serverError: "服务错误",
        newAudit: "新建审计",
        domainProvider: "域名和 Provider",
        domainUrl: "域名或 URL",
        keywords: "关键词",
        keywordsPlaceholder: "GitHub 项目推广\\nGitHub star 增长\\n开源项目冷启动",
        keywordsHelp: "可选。用户关键词一定优先进入审计，剩余名额由站点 SEO/内容关键词补齐。",
        competitorsInput: "竞品域名",
        competitorsPlaceholder: "github.com\\nossinsight.io",
        competitorsHelp: "可选。不填时，自动识别会尝试从域名画像里提出竞品。",
        githubRepo: "GitHub 仓库",
        githubRepoPlaceholder: "org/repo 或 https://github.com/org/repo",
        githubRepoHelp: "可选。README 和 topics 会作为关键词证据；必须跑真实 Provider 后才算 AI 可见度。",
        provider: "Provider",
        models: "模型",
        promptCount: "问题数量",
        promptCountHelp: "用于兜底/域名画像建议问题。关键词审计的请求数由关键词数量 x 每关键词问题数决定。",
        keywordMode: "关键词模式",
        sitePlusUser: "站点 + 用户关键词",
        userOnlyKeywords: "只用用户关键词",
        siteOnlyKeywords: "只用站点关键词",
        keywordLimit: "关键词数量",
        promptsPerKeyword: "每个关键词的问题数",
        maxTokens: "最大 Token",
        languageLabel: "审计语言",
        languageHelp: "同时控制页面文案和 Provider 回答语言。",
        discovery: "自动识别",
        autoDiscover: "自动识别品牌、竞品和问题",
        domainOnly: "只使用域名",
        runRealAudit: "运行真实审计",
        buildAuditPlan: "识别并确认问题",
        confirmStep: "运行前确认",
        confirmQuestions: "确认审计对象、竞品和问题",
        confirmHelp: "确认这些问题之前，不会调用 Provider。",
        noPlanYet: "先输入域名并识别问题。",
        identifyingQuestions: "正在识别目标、竞品、关键词和问题。",
        planReady: "问题已生成，等待确认",
        auditTarget: "审计对象",
        brand: "品牌",
        aliases: "别名",
        officialSite: "官网",
        identifiedCompetitors: "识别的竞品",
        addCompetitor: "添加竞品",
        competitorDomain: "竞品域名",
        brandAwarenessQuestions: "品牌认知问题",
        brandAwarenessHelp: "用于判断 AI 是否认识并正确描述明确给出的品牌。",
        organicDiscoveryQuestions: "非品牌发现问题",
        organicDiscoveryHelp: "用于判断用户没有提到品牌时，AI 是否主动推荐它。",
        comparisonQuestions: "对比问题",
        comparisonHelp: "用于判断目标在替代品和竞品比较中如何出现。",
        otherQuestions: "其他问题",
        promptText: "问题",
        promptCategory: "分类",
        enabled: "启用",
        delete: "删除",
        addPrompt: "新增问题",
        newPromptPlaceholder: "输入新的监测问题",
        plannedRunSummary: "本次运行汇总",
        enabledPrompts: "启用问题",
        disabledPrompts: "暂停问题",
        providerRuns: "预计请求",
        webSearch: "联网搜索",
        webSearchOff: "关闭",
        webSearchOn: "开启",
        webSearchHelp: "关闭时不发送联网搜索工具。开启时使用当前 Provider 的原生搜索路径。",
        searchMode: "搜索方式",
        searchModeAuto: "自动",
        searchModeNative: "只用 Provider 原生",
        nativeSearch: "原生联网",
        promptSet: "Prompt Set",
        analysisRules: "分析规则",
        confirmAndRun: "确认并运行 API 审计",
        noCompetitors: "未配置竞品。",
        yes: "是",
        no: "否",
        brandAwareness: "品牌认知",
        organicDiscovery: "非品牌发现",
        comparison: "对比问题",
        other: "其他",
        naturalDiscoveryRate: "自然发现率",
        brandAwarenessRate: "品牌认知率",
        organicRecommendationRate: "自然推荐率",
        officialCitationRate: "官方引用率",
        conditionsChanged: "本次审计与上一次测试条件不同，不建议直接比较",
        comparableRun: "可与上一次直接比较",
        firstRun: "首次报告",
        refreshRuns: "刷新报告",
        idle: "空闲",
        providerCatalog: "Provider 目录",
        configuredKeys: "Key 配置状态",
        latestResult: "最新结果",
        auditOutput: "审计输出",
        noAuditSession: "当前浏览器会话还没有运行审计。",
        recentRuns: "历史报告",
        savedReports: "已保存报告",
        loadingRuns: "正在加载历史报告...",
        configured: "已配置",
        missing: "缺失",
        keyConfigured: "Key 已配置",
        missingKey: "缺少 Key",
        runningProviderCalls: "正在调用真实 Provider",
        runningAuditMessage: "正在运行审计。每个问题都会发送给真实 AI Provider，可能需要几分钟。",
        completed: "已完成",
        failed: "失败",
        auditFailed: "审计失败",
        noSavedReports: "没有找到已保存报告。",
        mentionRate: "提及率",
        citationRate: "引用率",
        recommendationRate: "推荐率",
        shareOfVoice: "声量占比",
        keywordAudit: "关键词审计",
        ownedRelevance: "站点相关度",
        aiKeywordAssociation: "AI 关键词关联度",
        competitorOnly: "竞品独占",
        keywordHeader: "关键词",
        sourceHeader: "来源",
        gapHeader: "差距",
        openHtmlReport: "打开 HTML 报告",
        openReportJson: "打开报告 JSON",
        providerModel: "Provider / 模型",
        completedHeader: "完成",
        mentionHeader: "提及",
        citationHeader: "引用",
        recommendationHeader: "推荐",
        sovHeader: "SOV",
        severity: "严重级别",
        area: "区域",
        gap: "差距",
        run: "运行",
        target: "目标",
        report: "报告",
        open: "打开"
      }
    };

    function locale() {
      return state.locale === "en" ? "en" : "zh";
    }

    function t(key) {
      return translations[locale()][key] || translations.en[key] || key;
    }

    function syncLanguageButtons() {
      document.querySelectorAll("[data-language-choice]").forEach((button) => {
        const active = button.getAttribute("data-language-choice") === locale();
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setLocale(nextLocale) {
      state.locale = nextLocale === "en" ? "en" : "zh";
      try {
        window.localStorage.setItem("niubigeo.locale", locale());
      } catch {}
      applyLocale();
    }

    function restoreLocale() {
      let saved = "zh";
      try {
        const value = window.localStorage.getItem("niubigeo.locale");
        if (value === "en" || value === "zh") saved = value;
      } catch {}
      state.locale = saved;
    }

    function applyLocale() {
      document.documentElement.lang = locale() === "zh" ? "zh-CN" : "en";
      document.title = locale() === "zh" ? "niubigeo OSS - 真实审计" : "niubigeo OSS";
      document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.getAttribute("data-i18n");
        if (key) node.textContent = t(key);
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
        const key = node.getAttribute("data-i18n-placeholder");
        if (key) node.setAttribute("placeholder", t(key));
      });
      if ($("health").textContent === translations.en.serverOnline || $("health").textContent === translations.zh.serverOnline) {
        $("health").textContent = t("serverOnline");
      }
      if ($("run-status").textContent === translations.en.idle || $("run-status").textContent === translations.zh.idle) {
        $("run-status").textContent = t("idle");
      }
      renderProviders();
      if (state.auditPlan) renderPlan(state.auditPlan, false);
      if (state.latestResult) renderResult(state.latestResult);
      renderRuns();
      syncLanguageButtons();
    }

    function pct(metric) {
      if (!metric) return "n/a";
      if (metric.value === null) return "n/a (" + metric.numerator + "/" + metric.denominator + ")";
      const value = Math.round(metric.value * 1000) / 10;
      return String(value).replace(/\\.0$/, "") + "% (" + metric.numerator + "/" + metric.denominator + ")";
    }

    function html(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function money(value) {
      return typeof value === "number" ? "$" + value.toFixed(6) : "n/a";
    }

    function relevance(value) {
      return typeof value === "number" ? Math.round(value * 100) + "%" : "n/a";
    }

    function providerOptionLabel(provider) {
      return provider.label + " (" + (provider.keyConfigured ? t("keyConfigured") : t("missingKey")) + ")";
    }

    function selectedProvider() {
      return state.providers.find((provider) => provider.id === $("provider").value);
    }

    function syncRunButton() {
      const provider = selectedProvider();
      $("run-button").disabled = !provider || !provider.keyConfigured;
      const confirmButton = $("confirm-run-button");
      if (confirmButton) {
        confirmButton.disabled = !state.auditPlan || state.auditPlan.prompts.filter((prompt) => prompt.enabled).length === 0;
      }
    }

    function renderProviders() {
      const currentProvider = $("provider").value;
      $("provider").innerHTML = state.providers.map((provider) =>
        '<option value="' + html(provider.id) + '">' + html(providerOptionLabel(provider)) + '</option>'
      ).join("");
      const openrouter = state.providers.find((provider) => provider.id === "openrouter");
      if (state.providers.some((provider) => provider.id === currentProvider)) {
        $("provider").value = currentProvider;
      } else if (openrouter) {
        $("provider").value = "openrouter";
      }
      $("provider-list").innerHTML = state.providers.map((provider) =>
        '<div class="provider-row">' +
          '<div><strong>' + html(provider.label) + '</strong><span>' + html(provider.envKeys.join(", ")) + ' · ' + html(provider.defaultModels.join(", ")) + ' · ' + html(provider.supportsWebSearch ? t("nativeSearch") : t("webSearchOff")) + '</span></div>' +
          '<span class="pill ' + (provider.keyConfigured ? 'ok' : 'missing') + '">' + (provider.keyConfigured ? t('configured') : t('missing')) + '</span>' +
        '</div>'
      ).join("");
      syncRunButton();
    }

    function domainFromInput(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      try {
        const parsed = new URL(raw.includes("://") ? raw : "https://" + raw);
        return parsed.hostname.replace(/^www\\./, "").toLowerCase();
      } catch {
        return raw.replace(/^https?:\\/\\//, "").replace(/^www\\./, "").split("/")[0].toLowerCase();
      }
    }

    function nameFromDomain(domain) {
      const base = String(domain || "").split(".")[0] || "";
      return base ? base.charAt(0).toUpperCase() + base.slice(1) : domain;
    }

    function categoryLabel(category) {
      if (category === "brand_awareness") return t("brandAwareness");
      if (category === "organic_discovery") return t("organicDiscovery");
      if (category === "comparison") return t("comparison");
      return t("other");
    }

    function categoryToType(category) {
      if (category === "brand_awareness") return "brand";
      if (category === "comparison") return "comparison";
      if (category === "organic_discovery") return "recommendation";
      return "scenario";
    }

    function promptContainsTarget(text, target) {
      const value = String(text || "");
      const terms = [target?.name, target?.domain].concat(target?.aliases || [])
        .map((term) => String(term || "").trim())
        .filter(Boolean);
      return terms.some((term) => {
        if (!/^[\\x00-\\x7F]+$/.test(term) || !/[A-Za-z0-9]/.test(term)) {
          return value.toLowerCase().includes(term.toLowerCase());
        }
        const escaped = term.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
        return new RegExp("(?<![A-Za-z0-9])" + escaped + "(?![A-Za-z0-9])", "i").test(value);
      });
    }

    function planCounts(plan) {
      const enabled = plan.prompts.filter((prompt) => prompt.enabled);
      const countFor = (category) => enabled.filter((prompt) => (prompt.auditCategory || "other") === category).length;
      return {
        enabled: enabled.length,
        disabled: plan.prompts.length - enabled.length,
        brand: countFor("brand_awareness"),
        organic: countFor("organic_discovery"),
        comparison: countFor("comparison"),
        other: countFor("other"),
        requests: enabled.length * plan.providerTargets.length
      };
    }

    function refreshPlanEstimate() {
      if (!state.auditPlan) return;
      const counts = planCounts(state.auditPlan);
      state.auditPlan.estimate = {
        enabledPromptCount: counts.enabled,
        disabledPromptCount: counts.disabled,
        providerTargetCount: state.auditPlan.providerTargets.length,
        providerRunCount: counts.requests
      };
    }

    function renderCategoryOptions(selected) {
      return ["brand_awareness", "organic_discovery", "comparison", "other"].map((category) =>
        '<option value="' + category + '"' + (category === selected ? ' selected' : '') + '>' + html(categoryLabel(category)) + '</option>'
      ).join("");
    }

    function renderPromptRows(plan, category) {
      const rows = plan.prompts
        .map((prompt, index) => ({ prompt, index }))
        .filter((row) => (row.prompt.auditCategory || "other") === category);
      if (!rows.length) return '<p class="empty">' + html(t("noPlanYet")) + '</p>';
      return rows.map((row) =>
        '<div class="prompt-row">' +
          '<input type="checkbox" data-prompt-enabled="' + row.index + '"' + (row.prompt.enabled ? ' checked' : '') + ' aria-label="' + html(t("enabled")) + '">' +
          '<textarea data-prompt-text="' + row.index + '">' + html(row.prompt.text) + '</textarea>' +
          '<select data-prompt-category="' + row.index + '">' + renderCategoryOptions(row.prompt.auditCategory || "other") + '</select>' +
          '<button class="secondary" type="button" data-delete-prompt="' + row.index + '">' + html(t("delete")) + '</button>' +
        '</div>'
      ).join("");
    }

    function renderPromptGroup(plan, category, titleKey, helpKey) {
      return '<section class="prompt-group">' +
        '<h3>' + html(t(titleKey)) + '</h3>' +
        '<p>' + html(t(helpKey)) + '</p>' +
        renderPromptRows(plan, category) +
      '</section>';
    }

    function renderCompetitors(plan) {
      if (!plan.competitors.length) return '<p class="empty">' + html(t("noCompetitors")) + '</p>';
      return '<div class="chip-list">' + plan.competitors.map((competitor, index) =>
        '<span class="chip">' + html(competitor.name || competitor.domain) + '<small>' + html(competitor.domain) + '</small><button type="button" data-remove-competitor="' + index + '">&times;</button></span>'
      ).join("") + '</div>';
    }

    function renderPlanSummary(plan) {
      const counts = planCounts(plan);
      const providerModels = plan.providerTargets.map((target) => target.providerId + " / " + target.model).join(", ");
      const webSearchValues = Array.from(new Set(plan.providerTargets.map((target) => Boolean(target.webSearchEnabled))));
      const webSearch = webSearchValues.length > 1 ? "mixed" : (webSearchValues[0] ? t("yes") : t("no"));
      return '<aside class="plan-summary">' +
        '<h3>' + html(t("plannedRunSummary")) + '</h3>' +
        '<div class="summary-list">' +
          '<div><span>' + html(t("enabledPrompts")) + '</span><strong>' + counts.enabled + '</strong></div>' +
          '<div><span>' + html(t("brandAwareness")) + '</span><strong>' + counts.brand + '</strong></div>' +
          '<div><span>' + html(t("organicDiscovery")) + '</span><strong>' + counts.organic + '</strong></div>' +
          '<div><span>' + html(t("comparison")) + '</span><strong>' + counts.comparison + '</strong></div>' +
          '<div><span>' + html(t("disabledPrompts")) + '</span><strong>' + counts.disabled + '</strong></div>' +
          '<div><span>' + html(t("providerRuns")) + '</span><strong>' + counts.requests + '</strong></div>' +
          '<div><span>Provider / Model</span><strong>' + html(providerModels) + '</strong></div>' +
          '<div><span>' + html(t("webSearch")) + '</span><strong>' + html(webSearch) + '</strong></div>' +
          '<div><span>' + html(t("promptSet")) + '</span><strong>' + html(plan.promptSetId || "n/a") + '</strong></div>' +
          '<div><span>' + html(t("analysisRules")) + '</span><strong>' + html(plan.analysisRulesVersion || "n/a") + '</strong></div>' +
        '</div>' +
        '<button id="confirm-run-button" type="button">' + html(t("confirmAndRun")) + '</button>' +
      '</aside>';
    }

    function renderPlan(plan, scrollToPlan = false) {
      state.auditPlan = plan;
      refreshPlanEstimate();
      $("confirm-plan").classList.remove("hidden");
      const aliases = plan.target.aliases?.length ? plan.target.aliases.join(", ") : "n/a";
      $("plan-body").className = "";
      $("plan-body").innerHTML =
        '<div class="plan-grid">' +
          '<div>' +
            '<section class="target-summary">' +
              '<h3>' + html(t("auditTarget")) + '</h3>' +
              '<div class="summary-list">' +
                '<div><span>' + html(t("brand")) + '</span><strong>' + html(plan.target.name) + '</strong></div>' +
                '<div><span>' + html(t("aliases")) + '</span><strong>' + html(aliases) + '</strong></div>' +
                '<div><span>' + html(t("officialSite")) + '</span><strong>' + html(plan.target.domain) + '</strong></div>' +
              '</div>' +
              '<h3 style="margin-top:16px">' + html(t("identifiedCompetitors")) + '</h3>' +
              renderCompetitors(plan) +
              '<div class="inline-add"><input id="new-competitor" placeholder="' + html(t("competitorDomain")) + '"><button type="button" class="secondary" id="add-competitor">' + html(t("addCompetitor")) + '</button></div>' +
            '</section>' +
            '<div class="prompt-groups">' +
              renderPromptGroup(plan, "brand_awareness", "brandAwarenessQuestions", "brandAwarenessHelp") +
              renderPromptGroup(plan, "organic_discovery", "organicDiscoveryQuestions", "organicDiscoveryHelp") +
              renderPromptGroup(plan, "comparison", "comparisonQuestions", "comparisonHelp") +
              renderPromptGroup(plan, "other", "otherQuestions", "comparisonHelp") +
            '</div>' +
            '<div class="prompt-add">' +
              '<select id="new-prompt-category">' + renderCategoryOptions("organic_discovery") + '</select>' +
              '<input id="new-prompt-text" placeholder="' + html(t("newPromptPlaceholder")) + '">' +
              '<button type="button" class="secondary" id="add-prompt">' + html(t("addPrompt")) + '</button>' +
            '</div>' +
          '</div>' +
          renderPlanSummary(plan) +
        '</div>';
      syncRunButton();
      if (scrollToPlan) window.location.hash = "confirm-plan";
    }

    function markPlanEdited() {
      if (!state.auditPlan) return;
      state.auditPlan.promptSetId = "client-edited";
      state.auditPlan.promptSetHash = "client-edited";
      refreshPlanEstimate();
    }

    function planPayloadForRun() {
      refreshPlanEstimate();
      return state.auditPlan;
    }

    function renderResult(payload) {
      state.latestResult = payload;
      const m = payload.metrics;
      const providerRows = (m.slices || []).filter((slice) => slice.sliceType === "provider_model").map((slice) =>
        '<tr>' +
          '<td><strong>' + html(slice.label) + '</strong></td>' +
          '<td>' + slice.validResponses + '</td>' +
          '<td>' + pct(slice.mentionRate) + '</td>' +
          '<td>' + pct(slice.citationRate) + '</td>' +
          '<td>' + pct(slice.recommendationRate) + '</td>' +
          '<td>' + pct(slice.shareOfVoice) + '</td>' +
        '</tr>'
      ).join("");
      const gaps = (payload.gaps?.findings || []).slice(0, 5).map((gap) =>
        '<tr><td><span class="pill ' + (gap.severity === 'critical' ? 'missing' : 'running') + '">' + html(gap.severity) + '</span></td><td>' + html(gap.area) + '</td><td><strong>' + html(gap.title) + '</strong><div class="subtle">' + html(gap.evidence) + '</div></td></tr>'
      ).join("");
      const keywordRows = (m.keywordMetrics || []).map((metric) =>
        '<tr>' +
          '<td><strong>' + html(metric.phrase) + '</strong><div class="subtle">' + html(metric.keywordId) + '</div></td>' +
          '<td>' + html(metric.source) + '</td>' +
          '<td>' + relevance(metric.ownedRelevance) + '</td>' +
          '<td>' + metric.promptCount + '</td>' +
          '<td>' + pct(metric.mentionRate) + '</td>' +
          '<td>' + pct(metric.citationRate) + '</td>' +
          '<td>' + pct(metric.competitorOnlyRate) + '</td>' +
          '<td>' + html(metric.gapLabel) + '</td>' +
        '</tr>'
      ).join("");
      const keywordSection = keywordRows
        ? '<div class="table-wrap"><table><thead><tr><th>' + t('keywordHeader') + '</th><th>' + t('sourceHeader') + '</th><th>' + t('ownedRelevance') + '</th><th>' + t('promptCount') + '</th><th>' + t('mentionHeader') + '</th><th>' + t('citationHeader') + '</th><th>' + t('competitorOnly') + '</th><th>' + t('gapHeader') + '</th></tr></thead><tbody>' + keywordRows + '</tbody></table></div>'
        : '';
      $("result-body").className = "";
      $("result-body").innerHTML =
        '<div class="metric-grid">' +
          '<div class="metric"><span>' + t('naturalDiscoveryRate') + '</span><strong>' + pct(m.naturalDiscoveryRate) + '</strong></div>' +
          '<div class="metric"><span>' + t('brandAwarenessRate') + '</span><strong>' + pct(m.brandAwarenessRate) + '</strong></div>' +
          '<div class="metric"><span>' + t('organicRecommendationRate') + '</span><strong>' + pct(m.organicRecommendationRate) + '</strong></div>' +
          '<div class="metric"><span>' + t('officialCitationRate') + '</span><strong>' + pct(m.officialCitationRate) + '</strong></div>' +
          '<div class="metric"><span>' + t('shareOfVoice') + '</span><strong>' + pct(m.shareOfVoice) + '</strong></div>' +
        '</div>' +
        (m.promptCategoryMetrics?.length ? '<div class="table-wrap"><table><thead><tr><th>' + t('promptCategory') + '</th><th>' + t('completedHeader') + '</th><th>' + t('mentionHeader') + '</th><th>' + t('citationHeader') + '</th><th>' + t('recommendationHeader') + '</th><th>' + t('sovHeader') + '</th></tr></thead><tbody>' + m.promptCategoryMetrics.map((row) => '<tr><td><strong>' + html(categoryLabel(row.category)) + '</strong></td><td>' + row.validResponses + '</td><td>' + pct(row.mentionRate) + '</td><td>' + pct(row.citationRate) + '</td><td>' + pct(row.recommendationRate) + '</td><td>' + pct(row.shareOfVoice) + '</td></tr>').join("") + '</tbody></table></div>' : '') +
        (m.keywordMetrics?.length ? '<div class="metric-grid"><div class="metric"><span>' + t('keywordAudit') + '</span><strong>' + html(m.keywordSummary.totalKeywords) + '</strong></div><div class="metric"><span>' + t('ownedRelevance') + '</span><strong>' + relevance(m.keywordSummary.averageOwnedRelevance) + '</strong></div><div class="metric"><span>' + t('aiKeywordAssociation') + '</span><strong>' + pct(m.keywordSummary.aiMentionRate) + '</strong></div><div class="metric"><span>' + t('competitorOnly') + '</span><strong>' + pct(m.keywordSummary.competitorOnlyRate) + '</strong></div></div>' : '') +
        '<div class="result-actions">' +
          '<a href="/reports/' + encodeURIComponent(payload.auditId) + '" target="_blank">' + t('openHtmlReport') + '</a>' +
          '<a href="/audits/' + encodeURIComponent(payload.auditId) + '" target="_blank">' + t('openReportJson') + '</a>' +
        '</div>' +
        keywordSection +
        '<div class="table-wrap"><table><thead><tr><th>' + t('providerModel') + '</th><th>' + t('completedHeader') + '</th><th>' + t('mentionHeader') + '</th><th>' + t('citationHeader') + '</th><th>' + t('recommendationHeader') + '</th><th>' + t('sovHeader') + '</th></tr></thead><tbody>' + providerRows + '</tbody></table></div>' +
        '<div class="table-wrap"><table><thead><tr><th>' + t('severity') + '</th><th>' + t('area') + '</th><th>' + t('gap') + '</th></tr></thead><tbody>' + gaps + '</tbody></table></div>';
    }

    async function loadProviders() {
      const response = await fetch("/providers");
      state.providers = await response.json();
      renderProviders();
      $("health").className = "pill ok";
      $("health").textContent = t("serverOnline");
    }

    function renderRuns() {
      if (!state.latestRuns) {
        $("runs-body").className = "empty";
        $("runs-body").textContent = t("loadingRuns");
        return;
      }
      const runs = state.latestRuns;
      if (!runs.length) {
        $("runs-body").className = "empty";
        $("runs-body").textContent = t("noSavedReports");
        return;
      }
      $("runs-body").className = "";
      const noteFor = (note) => {
        if (note === "conditions changed; do not compare directly") return t("conditionsChanged");
        if (note === "comparable with previous run") return t("comparableRun");
        return t("firstRun");
      };
      $("runs-body").innerHTML =
        '<div class="table-wrap"><table><thead><tr><th>' + t('run') + '</th><th>' + t('target') + '</th><th>' + t('providerModel') + '</th><th>' + t('promptSet') + '</th><th>' + t('keywordAudit') + '</th><th>' + t('naturalDiscoveryRate') + '</th><th>' + t('officialCitationRate') + '</th><th>' + t('organicRecommendationRate') + '</th><th>' + t('sovHeader') + '</th><th>' + t('comparison') + '</th><th>' + t('report') + '</th></tr></thead><tbody>' +
        runs.map((run) =>
          '<tr>' +
            '<td><strong>' + html(run.auditId) + '</strong><div class="subtle">' + html(run.generatedAt || "") + '</div></td>' +
            '<td>' + html(run.targetName) + '<div class="subtle">' + html(run.domain) + '</div></td>' +
            '<td>' + html((run.providerModels || []).join(", ")) + '<div class="subtle">' + html(run.language || "") + ' · ' + html(run.webSearchEnabled ? t("yes") : t("no")) + '</div></td>' +
            '<td>' + html(run.promptSetId || "n/a") + '<div class="subtle">' + html(run.analysisRulesVersion || "") + '</div></td>' +
            '<td>' + html(run.keywordSummary?.totalKeywords || 0) + '<div class="subtle">' + pct(run.keywordSummary?.aiMentionRate) + '</div></td>' +
            '<td>' + pct(run.naturalDiscoveryRate) + '</td>' +
            '<td>' + pct(run.officialCitationRate || run.citationRate) + '</td>' +
            '<td>' + pct(run.organicRecommendationRate || run.recommendationRate) + '</td>' +
            '<td>' + pct(run.shareOfVoice) + '</td>' +
            '<td>' + html(noteFor(run.comparisonNote)) + '</td>' +
            '<td><a href="/reports/' + encodeURIComponent(run.auditId) + '" target="_blank">' + t('open') + '</a></td>' +
          '</tr>'
        ).join("") +
        '</tbody></table></div>';
    }

    async function loadRuns() {
      const response = await fetch("/runs");
      state.latestRuns = await response.json();
      renderRuns();
    }

    function invalidatePlan() {
      if (!state.auditPlan) return;
      state.auditPlan = null;
      $("confirm-plan").classList.add("hidden");
      $("plan-body").className = "empty";
      $("plan-body").textContent = t("noPlanYet");
      syncRunButton();
    }

    $("provider").addEventListener("change", () => {
      invalidatePlan();
      const provider = selectedProvider();
      if (provider && provider.id !== "openrouter") $("models").value = provider.defaultModels.slice(0, 2).join(",");
      if (provider && provider.id === "openrouter") $("models").value = "openai/gpt-4o-mini,perplexity/sonar";
      syncRunButton();
    });

    ["domain", "keywords", "competitors", "githubRepo", "models", "promptCount", "keywordMode", "keywordLimit", "promptsPerKeyword", "webSearchEnabled", "webSearchMode", "autoDiscover"].forEach((id) => {
      const node = $(id);
      if (node) node.addEventListener("change", invalidatePlan);
    });

    document.querySelectorAll("[data-language-choice]").forEach((button) => {
      button.addEventListener("click", () => setLocale(button.getAttribute("data-language-choice")));
    });

    $("reload-runs").addEventListener("click", () => loadRuns().catch((error) => {
      $("runs-body").innerHTML = '<div class="error">' + html(error.message || error) + '</div>';
    }));

    function formPayload() {
      return {
        domain: $("domain").value.trim(),
        keywords: $("keywords").value.split(/[\\n,，;；|]+/).map((item) => item.trim()).filter(Boolean),
        competitors: $("competitors").value.split(/[\\n,，;；|]+/).map((item) => item.trim()).filter(Boolean),
        githubRepo: $("githubRepo").value.trim(),
        provider: $("provider").value,
        models: $("models").value.split(",").map((item) => item.trim()).filter(Boolean),
        promptCount: Number($("promptCount").value),
        keywordMode: $("keywordMode").value,
        keywordLimit: Number($("keywordLimit").value),
        promptsPerKeyword: Number($("promptsPerKeyword").value),
        webSearchEnabled: $("webSearchEnabled").value === "true",
        webSearchMode: $("webSearchMode").value,
        maxTokens: Number($("maxTokens").value),
        language: locale(),
        autoDiscover: $("autoDiscover").value === "true"
      };
    }

    $("audit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const provider = selectedProvider();
      if (!provider || !provider.keyConfigured) return;
      $("run-button").disabled = true;
      $("run-status").className = "pill running";
      $("run-status").textContent = t("identifyingQuestions");
      $("confirm-plan").classList.remove("hidden");
      $("plan-body").className = "empty";
      $("plan-body").textContent = t("identifyingQuestions");
      try {
        const response = await fetch("/audit-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formPayload())
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || t("auditFailed"));
        renderPlan(body.plan, true);
        $("run-status").className = "pill ok";
        $("run-status").textContent = t("planReady");
      } catch (error) {
        $("plan-body").className = "";
        $("plan-body").innerHTML = '<div class="error">' + html(error.message || error) + '</div>';
        $("run-status").className = "pill missing";
        $("run-status").textContent = t("failed");
      } finally {
        syncRunButton();
      }
    });

    $("plan-body").addEventListener("input", (event) => {
      if (!state.auditPlan) return;
      const target = event.target;
      if (target && target.getAttribute && target.getAttribute("data-prompt-text") !== null) {
        const index = Number(target.getAttribute("data-prompt-text"));
        const prompt = state.auditPlan.prompts[index];
        if (!prompt) return;
        prompt.text = target.value;
        prompt.targetIncluded = promptContainsTarget(prompt.text, state.auditPlan.target);
        markPlanEdited();
      }
    });

    $("plan-body").addEventListener("change", (event) => {
      if (!state.auditPlan) return;
      const target = event.target;
      if (!target || !target.getAttribute) return;
      if (target.getAttribute("data-prompt-enabled") !== null) {
        const index = Number(target.getAttribute("data-prompt-enabled"));
        const prompt = state.auditPlan.prompts[index];
        if (!prompt) return;
        prompt.enabled = Boolean(target.checked);
        markPlanEdited();
        renderPlan(state.auditPlan, false);
      }
      if (target.getAttribute("data-prompt-category") !== null) {
        const index = Number(target.getAttribute("data-prompt-category"));
        const prompt = state.auditPlan.prompts[index];
        if (!prompt) return;
        prompt.auditCategory = target.value;
        prompt.type = categoryToType(target.value);
        markPlanEdited();
        renderPlan(state.auditPlan, false);
      }
    });

    $("plan-body").addEventListener("click", async (event) => {
      if (!state.auditPlan) return;
      const target = event.target;
      if (!target || !target.getAttribute) return;
      if (target.getAttribute("data-delete-prompt") !== null) {
        const index = Number(target.getAttribute("data-delete-prompt"));
        state.auditPlan.prompts.splice(index, 1);
        markPlanEdited();
        renderPlan(state.auditPlan, false);
        return;
      }
      if (target.getAttribute("data-remove-competitor") !== null) {
        const index = Number(target.getAttribute("data-remove-competitor"));
        state.auditPlan.competitors.splice(index, 1);
        markPlanEdited();
        renderPlan(state.auditPlan, false);
        return;
      }
      if (target.id === "add-competitor") {
        const input = $("new-competitor");
        const domain = domainFromInput(input.value);
        if (!domain) return;
        state.auditPlan.competitors.push({
          id: "competitor-" + domain.replace(/[^a-z0-9]+/g, "-"),
          type: "competitor",
          name: nameFromDomain(domain),
          domain,
          aliases: []
        });
        input.value = "";
        markPlanEdited();
        renderPlan(state.auditPlan, false);
        return;
      }
      if (target.id === "add-prompt") {
        const input = $("new-prompt-text");
        const category = $("new-prompt-category").value;
        const text = input.value.trim();
        if (!text) return;
        state.auditPlan.prompts.push({
          id: "manual-" + Date.now(),
          type: categoryToType(category),
          topic: "custom",
          language: state.auditPlan.language || locale(),
          text,
          enabled: true,
          auditCategory: category,
          targetIncluded: promptContainsTarget(text, state.auditPlan.target)
        });
        input.value = "";
        markPlanEdited();
        renderPlan(state.auditPlan, false);
        return;
      }
      if (target.id === "confirm-run-button") {
        target.disabled = true;
        $("run-button").disabled = true;
        $("run-status").className = "pill running";
        $("run-status").textContent = t("runningProviderCalls");
        $("result-body").className = "empty";
        $("result-body").textContent = t("runningAuditMessage");
        try {
          const response = await fetch("/audits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              confirmedPlan: planPayloadForRun(),
              maxTokens: Number($("maxTokens").value),
              temperature: 0
            })
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || t("auditFailed"));
          renderResult(body);
          await loadRuns();
          $("run-status").className = "pill ok";
          $("run-status").textContent = t("completed");
        } catch (error) {
          $("result-body").className = "";
          $("result-body").innerHTML = '<div class="error">' + html(error.message || error) + '</div>';
          $("run-status").className = "pill missing";
          $("run-status").textContent = t("failed");
        } finally {
          syncRunButton();
        }
      }
    });

    restoreLocale();
    applyLocale();

    loadProviders().catch((error) => {
      $("health").className = "pill missing";
      $("health").textContent = t("serverError");
      $("provider-list").innerHTML = '<div class="error">' + html(error.message || error) + '</div>';
    });
    loadRuns().catch((error) => {
      $("runs-body").innerHTML = '<div class="error">' + html(error.message || error) + '</div>';
    });
  </script>
</body>
</html>`;
}
