import { renderProductPhase4AppHtml } from "./product-phase4-app.js";
import { renderNiubigeoLockup } from "./brand.js";

const phase5BrandLockup = renderNiubigeoLockup("p5-brandlockup");
const phase5Script = String.raw`<script>
(() => {
  const mount = document.getElementById("app");
  if (!mount) return;
  window.__niubigeoPhase5Active = true;
  const state = { projects: [], projectId: "", project: null, configuration: null, selections: [], catalog: [], watchSets: [], watchSet: null, runs: [], tasks: [], snapshot: null, detail: [], modal: "", error: "", loading: false, activeNav: "overview", discoveryMetric: "brand_name_mention", associationMetric: "keyword_association_coverage", objectId: "", keywordId: "", showHistoricalModels: false, timeRange: "all", sourceFilter: "all", searchFilter: "all", schedulePreview: [], scheduleTaskId: "", taskPreview: {}, deleteTaskId: "" };
  const colors = ["#4c8dff", "#20d68f", "#a873ff", "#f5b942", "#ff5c5c", "#8bc5ff"];
  const esc = (value) => String(value == null ? "" : value).split("").map((item) => item === "&" ? "&amp;" : item === "<" ? "&lt;" : item === ">" ? "&gt;" : item === '"' ? "&quot;" : item === "'" ? "&#39;" : item).join("");
  const encoded = (value) => encodeURIComponent(value);
  const api = async (path, options) => {
    const response = await fetch(path, { headers: { "content-type": "application/json" }, ...(options || {}) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.code === "string" ? body.code : "request_failed");
    return body;
  };
  const currentProject = () => state.projects.find((item) => item.id === state.projectId) || null;
  const activeWatchSet = () => state.watchSets.find((item) => item.status === "active" && item.baselineId === state.project?.activeBaselineId) || null;
  const targetObject = () => state.watchSet ? state.watchSet.objects.find((item) => item.id === state.watchSet.targetObjectId) || null : null;
  const selectedObject = () => state.watchSet ? state.watchSet.objects.find((item) => item.id === state.objectId) || targetObject() : null;
  const comparisonObject = () => state.watchSet ? (selectedObject()?.role === "competitor" && selectedObject()?.identityState === "confirmed" ? selectedObject() : state.watchSet.objects.find((item) => item.role === "competitor" && item.identityState === "confirmed")) || null : null;
  const selectedKeyword = () => state.watchSet ? state.watchSet.keywords.find((item) => item.id === state.keywordId && item.neutralEligible) || state.watchSet.keywords.find((item) => item.neutralEligible) || null : null;
  const metricDefinitions = () => {
    const discovery = state.discoveryMetric === "domain_body_mention"
      ? ["domain_body_mention", "未点名品牌时的域名提及", "中性关键词回答正文是否实际写出对象域名", "正文写出域名 / 可判定关键词回答", "discovery"]
      : ["brand_name_mention", "未点名品牌时的名称提及", "中性关键词回答是否实际写出该对象名称", "写出名称 / 可判定关键词回答", "discovery"];
    const association = state.associationMetric === "keyword_association_count"
      ? ["keyword_association_count", "关键词关联次数", "模型在对象的独立域名回答中将该关键词关联给对象的回答份数", "关联回答份数", "association"]
      : state.associationMetric === "keyword_relative_weight"
        ? ["keyword_relative_weight", "关键词相对权重", "固定监测词集合中该词关联回答所占份额", "关联回答份额 / 全部监测词关联回答", "association"]
        : ["keyword_association_coverage", "关键词关联覆盖率", "模型在对象的独立域名回答中是否将该关键词关联给对象", "关联回答 / 可判定域名回答", "association"];
    return [
      ["domain_recognition", "哪些模型明确识别了这个域名？", "模型收到对象域名后的本次识别结果，不代表自然推荐。", "明确识别 / 可判定域名回答", "domain"],
      discovery,
      association,
      ["positive_recommendation", "问当前关键词时，哪些模型推荐这个对象？", "模型在未点名品牌的关键词回答中明确建议考虑该对象。", "肯定推荐 / 可判定关键词回答", "recommendation"],
      ["first_mention", "问当前关键词时，这个对象有多少次首先被提到？", "按回答正文中的可核验位置统计，不代表模型内部思考顺序。", "唯一首提 / 可判定关键词回答", "first_mention"],
      ["first_recommendation", "问当前关键词时，这个对象有多少次首先被推荐？", "按明确推荐证据及顺序统计，不代表模型内部思考顺序。", "唯一首荐 / 可判定关键词回答", "first_recommendation"],
      ["recommendation_gap", "同一个关键词下，我与竞品的推荐差距如何变化？", "同一模型、同一关键词、同一批样本中，目标推荐占比减去竞品推荐占比。", "目标推荐占比 - 竞品推荐占比（百分点）", "gap"],
      ["provider_citation", "问当前关键词时，哪些联网模型引用了这个官网？", "仅统计 Provider 原生联网实际返回的官网 Citation；正文 URL 不计入本图。", "官网 Citation / 可判定联网回答", "citation"],
    ];
  };
  const requestButton = (label, action, primary) => '<button type="button" class="p5-button' + (primary ? " primary" : "") + '" data-action="' + esc(action) + '">' + esc(label) + "</button>";
  const navButton = (label, target) => '<button type="button" data-nav-target="' + esc(target) + '" class="' + (state.activeNav === target ? "active" : "") + '">' + esc(label) + "</button>";
  const modalShell = (content) => '<div class="p5-modalwrap" data-modal-backdrop>' + content + "</div>";
  const modalHeader = (title) => '<div class="p5-modal-head"><h2>' + esc(title) + '</h2>' + requestButton("关闭", "close") + "</div>";
  const searchLabel = (mode) => mode === "provider_native" ? "Provider 原生联网" : "不联网";
  const dateLabel = (value) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "尚未运行";
  const selectProject = (projectId) => {
    state.projectId = projectId;
    state.snapshot = null;
    state.detail = [];
    const next = new URL(window.location.href);
    next.searchParams.set("projectId", projectId);
    next.searchParams.delete("project");
    window.history.replaceState({}, "", next);
  };
  const css = () => '<style>' +
    '#app{min-height:100vh;background:#050505;color:#f5f5f5;font:14px Inter,ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums}.p5-shell{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh}.p5-side{position:sticky;top:0;height:100vh;box-sizing:border-box;background:#080808;border-right:1px solid #1c1c1c;padding:20px 16px}.p5-brand{display:flex;align-items:center;margin:4px 8px 24px}.p5-brandlockup{display:block;width:min(100%,190px);height:auto}.p5-brandlockup img{display:block;width:100%;height:auto}.p5-label{color:#666;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:18px 8px 8px}.p5-input,.p5-select{box-sizing:border-box;width:100%;border:1px solid #262626;border-radius:8px;background:#111;color:#f5f5f5;padding:10px}.p5-nav{display:grid;gap:3px;margin-top:12px}.p5-nav button{border:0;background:transparent;color:#a1a1aa;text-align:left;border-radius:8px;padding:10px 12px;cursor:pointer}.p5-nav button.active,.p5-nav button:hover,.p5-nav button:focus-visible{color:#f5f5f5;background:#171717}.p5-main{min-width:0}.p5-header{position:sticky;top:0;z-index:4;height:70px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 30px;border-bottom:1px solid #1c1c1c;background:#050505}.p5-content{max-width:1700px;padding:30px}.p5-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.p5-heading h1{font-size:28px;margin:0 0 7px}.p5-muted{margin:0;color:#a1a1aa;line-height:1.5}.p5-actions{display:flex;flex-wrap:wrap;gap:8px}.p5-button{min-height:38px;border:1px solid #262626;border-radius:8px;background:#111;color:#f5f5f5;padding:9px 12px;cursor:pointer;transition:transform 80ms ease,background-color 140ms ease,border-color 140ms ease}.p5-button:hover,.p5-button:focus-visible{background:#171717;border-color:#454545}.p5-button:active{transform:translateY(1px) scale(.98)}.p5-button.primary{background:#4c8dff;border-color:#4c8dff}.p5-button[disabled]{cursor:not-allowed;opacity:.55}.p5-button[data-state="loading"]:before{content:"◌ ";animation:p5spin 1s linear infinite}.p5-button[data-state="success"]{border-color:#20d68f;color:#20d68f}.p5-button[data-state="error"]{border-color:#ff5c5c;color:#ff9999}.p5-alert,.p5-card,.p5-chart,.p5-modal,.p5-drawer,.p5-empty{border:1px solid #262626;border-radius:8px;background:#111}.p5-alert{padding:15px 18px;border-left:3px solid #f5b942;margin:18px 0}.p5-alert strong{display:block;margin-bottom:4px}.p5-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.p5-card{padding:16px;min-height:102px}.p5-card:hover{border-color:#353535;transform:translateY(-2px)}.p5-card span{color:#a1a1aa}.p5-card strong{display:block;margin-top:10px;font-size:22px}.p5-section{margin-top:28px;scroll-margin-top:88px}.p5-section h2{font-size:18px;margin:0 0 6px}.p5-chart{padding:18px;margin-top:14px}.p5-charthead{display:flex;justify-content:space-between;gap:16px}.p5-chart h3{margin:0 0 6px;font-size:16px}.p5-formula{color:#a1a1aa;font-size:13px}.p5-chart svg{width:100%;height:230px;display:block;margin:10px 0 0}.p5-axis{stroke:#262626;stroke-width:1}.p5-axis-label{fill:#a1a1aa;font-size:11px}.p5-line{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.p5-line.draw{stroke-dasharray:var(--path-length);stroke-dashoffset:var(--path-length);animation:p5draw 650ms cubic-bezier(.22,1,.36,1) forwards}.p5-point{stroke-width:3;cursor:pointer;transition:transform 140ms ease}.p5-point.partial{stroke-dasharray:3 2}.p5-pointbutton:focus-visible .p5-point,.p5-pointbutton:hover .p5-point{transform:scale(1.65)}.p5-pointbutton .p5-latest{filter:drop-shadow(0 0 4px currentColor);animation:p5pulse 2.2s ease-in-out infinite}.p5-page-hidden .p5-latest{animation-play-state:paused}.p5-legend{display:flex;flex-wrap:wrap;gap:12px;color:#a1a1aa;margin-top:8px}.p5-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.p5-table{width:100%;border-collapse:collapse;margin-top:12px}.p5-table th,.p5-table td{text-align:left;vertical-align:top;padding:9px 8px;border-bottom:1px solid #1c1c1c}.p5-table th{color:#a1a1aa;font-weight:600}.p5-table-detail{margin-top:12px;color:#a1a1aa}.p5-table-detail summary{cursor:pointer}.p5-empty{margin-top:18px;padding:18px;color:#a1a1aa}.p5-modalwrap{position:fixed;inset:0;z-index:10;padding:18px;display:grid;place-items:center;background:#000a}.p5-modal{width:min(580px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:20px}.p5-modal-head{position:sticky;top:-20px;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-20px -20px 16px;padding:16px 20px 12px;background:#111;border-bottom:1px solid #262626}.p5-modal-head h2{margin:0}.p5-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.p5-check{display:flex;align-items:center;gap:8px;padding:8px 0}.p5-drawer{position:fixed;right:18px;top:88px;z-index:9;width:min(550px,calc(100vw - 36px));max-height:calc(100vh - 106px);overflow:auto;padding:18px;box-shadow:0 18px 50px #0008;animation:p5slide 200ms ease-out}.p5-drawer pre{white-space:pre-wrap;word-break:break-word;background:#080808;border:1px solid #1c1c1c;border-radius:6px;padding:12px}.p5-status{font-size:12px;color:#a1a1aa}.p5-ok{color:#20d68f}.p5-warn{color:#f5b942}.p5-bad{color:#ff8585}.p5-tag{display:inline-block;border:1px solid #353535;border-radius:999px;padding:3px 7px;margin:2px;color:#a1a1aa;font-size:12px}@keyframes p5draw{to{stroke-dashoffset:0}}@keyframes p5spin{to{transform:rotate(360deg)}}@keyframes p5slide{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes p5pulse{50%{opacity:.72}}@media(max-width:900px){.p5-shell{grid-template-columns:1fr}.p5-side{position:relative;height:auto;border-right:0;border-bottom:1px solid #1c1c1c}.p5-nav{grid-template-columns:repeat(3,minmax(0,1fr))}.p5-header{padding:0 18px}.p5-content{padding:18px}.p5-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}</style>';
  async function load() {
    state.loading = true;
    render();
    try {
      const listed = await api("/api/projects");
      state.projects = listed.projects || [];
      const params = new URL(window.location.href).searchParams;
      const requested = params.get("projectId") || params.get("project");
      const saved = window.localStorage.getItem("niubigeo-current-project");
      if (requested && state.projects.some((item) => item.id === requested)) state.projectId = requested;
      else if (!state.projectId || !state.projects.some((item) => item.id === state.projectId)) state.projectId = state.projects.some((item) => item.id === saved) ? saved : state.projects[0] ? state.projects[0].id : "";
      state.project = currentProject();
      if (state.project) {
        const base = "/api/projects/" + encoded(state.project.id);
        const values = await Promise.all([api(base + "/monitoring-configuration"), api(base + "/models"), api(base + "/watch-sets"), api(base + "/measurement-runs"), api(base + "/monitoring-tasks"), api("/api/provider-models")]);
        state.configuration = values[0].configuration;
        state.selections = values[1].selections || [];
        state.watchSets = values[2].watchSets || [];
        state.watchSet = activeWatchSet();
        state.runs = values[3].runs || [];
        state.tasks = values[4].tasks || [];
        state.catalog = values[5].models || [];
        if (state.watchSet) {
          try { state.snapshot = (await api(base + "/measurement-stats", { method: "POST", body: "{}" })).snapshot; } catch (_) { state.snapshot = null; }
        } else state.snapshot = null;
        window.localStorage.setItem("niubigeo-current-project", state.projectId);
      }
      state.error = "";
    } catch (_) { state.error = "无法读取项目数据。请检查本地服务与项目配置。"; }
    state.loading = false;
    render();
  }
  const pointList = (metric) => {
    const object = selectedObject();
    const keyword = selectedKeyword();
    const target = targetObject();
    const isDomain = metric === "domain_recognition";
    const competitor = comparisonObject();
    const rangeDays = state.timeRange === "7" ? 7 : state.timeRange === "30" ? 30 : state.timeRange === "90" ? 90 : null;
    const earliest = rangeDays === null ? null : Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return (state.snapshot ? state.snapshot.points : []).filter((point) => {
      const run = state.runs.find((item) => item.id === point.runId);
      const inRange = earliest === null || Date.parse(point.observedAt) >= earliest;
      const sourceMatches = state.sourceFilter === "all" || run?.source === state.sourceFilter;
      const searchMatches = state.searchFilter === "all" || point.webSearchMode === state.searchFilter;
      const activeModel = state.showHistoricalModels || state.selections.some((selection) => selection.modelId === point.modelId && selection.webSearchMode === point.webSearchMode);
      const objectMatches = metric === "recommendation_gap" ? !target || point.objectId === target.id : !object || point.objectId === object.id;
      return point.metric === metric && inRange && sourceMatches && searchMatches && activeModel && objectMatches && (!competitor || metric !== "recommendation_gap" || point.comparisonObjectId === competitor.id) && (isDomain || !keyword || point.keywordId === keyword.id);
    });
  };
  const colorFor = (modelId) => { let value = 0; for (const item of String(modelId)) value = (value * 31 + item.charCodeAt(0)) % colors.length; return colors[value]; };
  const formattedValue = (point) => point.value === null ? "暂无数据" : point.valueUnit === "count" ? String(point.value) + " 次" : point.valueUnit === "percentage_points" ? point.value.toFixed(1) + " 个百分点" : point.value.toFixed(1) + "%";
  const controlsFor = (definition) => definition[4] === "discovery"
    ? '<div class="p5-actions"><button class="p5-button" data-view-metric="brand_name_mention" ' + (state.discoveryMetric === "brand_name_mention" ? "disabled" : "") + '>品牌名称</button><button class="p5-button" data-view-metric="domain_body_mention" ' + (state.discoveryMetric === "domain_body_mention" ? "disabled" : "") + '>回答正文域名</button></div>'
    : definition[4] === "association"
      ? '<div class="p5-actions"><button class="p5-button" data-view-metric="keyword_association_count" ' + (state.associationMetric === "keyword_association_count" ? "disabled" : "") + '>关联次数</button><button class="p5-button" data-view-metric="keyword_association_coverage" ' + (state.associationMetric === "keyword_association_coverage" ? "disabled" : "") + '>关联覆盖率</button><button class="p5-button" data-view-metric="keyword_relative_weight" ' + (state.associationMetric === "keyword_relative_weight" ? "disabled" : "") + '>相对权重</button></div>'
      : "";
  const chart = (definition, index) => {
    const points = pointList(definition[0]);
    const valid = points.filter((item) => item.value !== null);
    const object = selectedObject();
    const keyword = selectedKeyword();
    const target = targetObject();
    const competitor = comparisonObject();
    const context = definition[4] === "domain"
      ? object ? object.name + " · " + (object.domain || "缺少域名") : "尚未选择对象"
      : definition[4] === "association"
        ? object && keyword ? object.name + " · " + keyword.keyword : "尚未选择对象或关键词"
        : definition[4] === "gap"
          ? target && competitor && keyword ? target.name + " 与 " + competitor.name + " · " + keyword.keyword : "尚未选择可对照对象或关键词"
          : object && keyword ? object.name + " · " + keyword.keyword : "尚未选择对象或关键词";
    if (!valid.length) return '<article class="p5-chart"><div class="p5-charthead"><div><h3>' + esc(definition[1]) + '</h3><p class="p5-formula">对象或关键词：' + esc(context) + '</p><p class="p5-formula">证明：' + esc(definition[2]) + '</p><p class="p5-formula">计算：' + esc(definition[3]) + '</p></div>' + controlsFor(definition) + '</div><div class="p5-empty">尚未形成可计算数据。先保存监测范围并完成对应探针运行。</div></article>';
    const times = [...new Set(points.map((item) => item.observedAt))].sort((left, right) => left.localeCompare(right));
    const byModel = new Map();
    for (const item of points) { const key = item.modelId + "|" + item.webSearchMode + "|" + item.fingerprint + "|" + (item.keywordId || ""); const rows = byModel.get(key) || []; rows.push(item); byModel.set(key, rows); }
    const width = 820; const height = 190; const left = 44; const right = 18; const top = 12; const bottom = 30;
    const x = (item) => times.length === 1 ? left + (width - left - right) / 2 : left + times.indexOf(item.observedAt) * (width - left - right) / (times.length - 1);
    const values = valid.map((item) => item.value);
    const min = definition[0] === "recommendation_gap" ? -100 : 0;
    const max = definition[0] === "keyword_association_count" ? Math.max(1, ...values) : 100;
    const y = (item) => top + (max - item.value) * (height - top - bottom) / (max - min || 1);
    const series = [...byModel.entries()].map(([seriesKey, rows]) => {
      const ordered = [...rows].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
      const color = colorFor(ordered[0]?.modelId || seriesKey);
      let connected = false;
      const pathData = ordered.map((item) => { if (item.value === null || !item.complete) { connected = false; return ""; } const command = connected ? "L" : "M"; connected = true; return command + x(item).toFixed(1) + " " + y(item).toFixed(1); }).filter(Boolean).join(" ");
      const latest = ordered[ordered.length - 1];
      const latestComplete = [...ordered].reverse().find((item) => item.complete && item.value !== null) || null;
      return { color, pathData, latestPointId: latestComplete ? latestComplete.id : "", legend: '<span><i style="background:' + color + '"></i>' + esc(latest.modelDisplayName) + ' · ' + esc(searchLabel(latest.webSearchMode)) + ' · ' + latest.numerator + ' / ' + latest.denominator + '（' + esc(formattedValue(latest)) + '）' + (latest.complete ? "" : " · 覆盖不完整") + '</span>' };
    });
    const labels = times.map((item) => '<text class="p5-axis-label" x="' + x({ observedAt: item }).toFixed(1) + '" y="' + (height - 8) + '" text-anchor="middle">' + esc(new Date(item).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })) + '</text>').join("");
    const lines = series.map((item) => item.pathData ? '<path class="p5-line draw" stroke="' + item.color + '" d="' + item.pathData + '"></path>' : "").join("");
    const latestPointIds = new Set(series.map((item) => item.latestPointId).filter(Boolean));
    const pointGroups = new Map();
    for (const item of valid) { const key = x(item).toFixed(1) + "|" + y(item).toFixed(1); const rows = pointGroups.get(key) || []; rows.push(item); pointGroups.set(key, rows); }
    const dots = [...pointGroups.values()].map((rows) => { const visible = rows.at(-1); const ids = rows.map((item) => item.id).join(","); const names = rows.map((item) => item.modelDisplayName).join("、"); const color = colorFor(visible.modelId); const tooltip = rows.map((item) => item.modelDisplayName + " · " + searchLabel(item.webSearchMode) + " · " + new Date(item.observedAt).toLocaleString("zh-CN", { hour12: false }) + " · " + formattedValue(item) + " · 命中 " + item.numerator + " / 可判定 " + item.denominator + " · 预定 " + item.planned + " · 失败或排除 " + item.failed + " · " + (item.complete ? "完整" : "覆盖不完整")).join("\n"); return '<g class="p5-pointbutton" data-point="' + esc(visible.id) + '" data-points="' + esc(ids) + '" role="button" tabindex="0" aria-label="查看' + esc(names + " · " + definition[1]) + '证据"><title>' + esc(tooltip) + '</title><circle class="p5-point' + (visible.complete ? "" : " partial") + (rows.some((item) => latestPointIds.has(item.id)) ? " p5-latest" : "") + '" cx="' + x(visible).toFixed(1) + '" cy="' + y(visible).toFixed(1) + '" r="' + (rows.length > 1 ? "7" : "5") + '" fill="' + (visible.complete ? color : "#050505") + '" stroke="' + color + '"></circle></g>'; }).join("");
    const rows = points.map((item) => '<tr><td>' + esc(new Date(item.observedAt).toLocaleString("zh-CN", { hour12: false })) + '</td><td>' + esc(item.modelDisplayName) + '</td><td>' + esc(searchLabel(item.webSearchMode)) + '</td><td>' + esc(formattedValue(item)) + '</td><td>' + item.numerator + ' / ' + item.denominator + '</td><td>' + item.planned + '</td><td>' + item.failed + '</td><td>' + (item.complete ? "完整" : "覆盖不完整") + '</td></tr>').join("");
    return '<article class="p5-chart"><div class="p5-charthead"><div><h3>' + esc(definition[1]) + '</h3><p class="p5-formula">对象或关键词：' + esc(context) + '</p><p class="p5-formula">证明：' + esc(definition[2]) + '</p><p class="p5-formula">计算：' + esc(definition[3]) + '</p><p class="p5-formula">每条线代表一个固定模型、实际联网方式与探针指纹；每个点代表一次真实运行。悬停或聚焦数据点可查看完整统计。</p></div>' + controlsFor(definition) + '</div><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(definition[1]) + '数据点"><line class="p5-axis" x1="' + left + '" x2="' + (width - right) + '" y1="' + (height - bottom) + '" y2="' + (height - bottom) + '"></line><line class="p5-axis" x1="' + left + '" x2="' + (width - right) + '" y1="' + ((height - bottom + top) / 2) + '" y2="' + ((height - bottom + top) / 2) + '"></line><line class="p5-axis" x1="' + left + '" x2="' + (width - right) + '" y1="' + top + '" y2="' + top + '"></line>' + lines + dots + labels + '</svg><div class="p5-legend">' + series.map((item) => item.legend).join("") + '<span>点击数据点查看组成数据和原始回答</span></div><details class="p5-table-detail"><summary>查看图表数据</summary><table class="p5-table"><thead><tr><th>时间</th><th>模型</th><th>执行方式</th><th>结果</th><th>命中 / 可判定</th><th>预定</th><th>失败或排除</th><th>覆盖</th></tr></thead><tbody>' + rows + '</tbody></table></details></article>';
  };
  const metricCards = () => metricDefinitions().slice(0, 4).map((definition) => {
    const values = pointList(definition[0]).filter((item) => item.value !== null);
    const latest = values[values.length - 1];
    return '<article class="p5-card"><span>' + esc(definition[1]) + '</span><strong>' + (latest ? latest.numerator + ' / ' + latest.denominator : "暂无数据") + '</strong><small class="p5-status">' + (latest ? esc(formattedValue(latest)) + " · " : "") + esc(definition[3]) + '</small></article>';
  }).join("");
  const runSummary = () => {
    const run = state.runs[0];
    if (!run) return '<div class="p5-empty">尚未创建测量运行。保存范围后可以开始多模型认知与中性关键词测试。</div>';
    const models = (run.modelRuns || []).map((item) => '<tr><td>' + esc(item.modelSnapshot.displayName) + '</td><td>' + esc(searchLabel(item.modelSnapshot.webSearchMode)) + '</td><td><span class="p5-status ' + (item.status === "completed" ? "p5-ok" : item.status === "running" ? "p5-warn" : "p5-bad") + '">' + esc(item.status) + '</span></td><td>' + (item.probeRunIds ? item.probeRunIds.length : 0) + '</td></tr>').join("");
    return '<table class="p5-table"><thead><tr><th>模型</th><th>联网方式</th><th>状态</th><th>探针</th></tr></thead><tbody>' + models + '</tbody></table>';
  };
  const watchSetSummary = () => {
    if (!state.watchSet) return '<div class="p5-empty">尚未保存监测范围。范围只使用已存认知档案中的候选对象和关键词；身份不明确的对象不会被独立域名测试。</div>';
    return '<div><p class="p5-muted">当前版本 v' + state.watchSet.version + ' · ' + state.watchSet.repetitions + ' 次重复 · 固定后不会改写历史运行。</p><div>' + state.watchSet.objects.map((item) => '<span class="p5-tag">' + esc(item.name) + (item.domain ? " · " + esc(item.domain) : " · 待确认身份") + '</span>').join("") + '</div><div>' + state.watchSet.keywords.map((item) => '<span class="p5-tag">' + esc(item.keyword) + (item.neutralEligible ? "" : " · 不用于中性测试") + '</span>').join("") + '</div></div>';
  };
  const scopeControls = () => state.watchSet ? '<section class="p5-section"><div class="p5-charthead"><div><h2>查看范围</h2><p class="p5-muted">筛选仅读取已保存证据，不会发起模型请求。管理模型会改变后续运行；这里仅控制图例。</p></div><label class="p5-check"><input type="checkbox" data-role="historical-models" ' + (state.showHistoricalModels ? "checked" : "") + '>显示历史停用模型</label></div><div class="p5-row"><label>对象<select class="p5-select" data-role="measurement-object">' + state.watchSet.objects.map((item) => '<option value="' + esc(item.id) + '" ' + (item.id === (selectedObject()?.id || "") ? "selected" : "") + '>' + esc(item.name) + (item.domain ? " · " + esc(item.domain) : " · 缺少域名") + '</option>').join("") + '</select></label><label>中性关键词<select class="p5-select" data-role="measurement-keyword">' + state.watchSet.keywords.filter((item) => item.neutralEligible).map((item) => '<option value="' + esc(item.id) + '" ' + (item.id === (selectedKeyword()?.id || "") ? "selected" : "") + '>' + esc(item.keyword) + '</option>').join("") + '</select></label><label>时间范围<select class="p5-select" data-role="measurement-range"><option value="all" ' + (state.timeRange === "all" ? "selected" : "") + '>全部时间</option><option value="7" ' + (state.timeRange === "7" ? "selected" : "") + '>过去 7 天</option><option value="30" ' + (state.timeRange === "30" ? "selected" : "") + '>过去 30 天</option><option value="90" ' + (state.timeRange === "90" ? "selected" : "") + '>过去 90 天</option></select></label><label>执行方式<select class="p5-select" data-role="measurement-search"><option value="all" ' + (state.searchFilter === "all" ? "selected" : "") + '>全部联网方式</option><option value="off" ' + (state.searchFilter === "off" ? "selected" : "") + '>不联网</option><option value="provider_native" ' + (state.searchFilter === "provider_native" ? "selected" : "") + '>Provider 原生联网</option></select></label><label>数据来源<select class="p5-select" data-role="measurement-source"><option value="all" ' + (state.sourceFilter === "all" ? "selected" : "") + '>手动与定时</option><option value="manual" ' + (state.sourceFilter === "manual" ? "selected" : "") + '>手动运行</option><option value="scheduled" ' + (state.sourceFilter === "scheduled" ? "selected" : "") + '>定时运行</option></select></label></div></section>' : "";
  const taskSummary = () => state.tasks.length ? state.tasks.filter((task) => task.status !== "deleted").map((task) => '<article class="p5-card"><span>' + esc(task.name) + ' · ' + esc(task.status === "active" ? "运行中" : task.status === "paused" ? "已暂停" : "配置不兼容") + '</span><strong>' + esc(task.rule.frequency === "daily" ? "每天" : task.rule.frequency === "weekly" ? "每周" : task.rule.frequency === "monthly" ? "每月" : "自定义") + '</strong><small class="p5-status">' + task.modelScope.length + ' 个模型 · ' + task.plannedRequestCount + ' 个请求 · 下次：' + esc(dateLabel(task.nextRunAt)) + '</small><div class="p5-actions">' + requestButton("预览", "task-preview:" + task.id) + (task.status === "active" ? requestButton("暂停", "task-pause:" + task.id) : task.status === "paused" ? requestButton("恢复", "task-resume:" + task.id) : "") + requestButton("编辑", "task-edit:" + task.id) + (state.deleteTaskId === task.id ? requestButton("确认删除", "task-confirm-delete:" + task.id) : requestButton("删除", "task-delete:" + task.id)) + '</div>' + ((state.taskPreview[task.id] || []).length ? '<div class="p5-status">下三次：' + state.taskPreview[task.id].map((value) => esc(dateLabel(value))).join(" · ") + '</div>' : "") + '</article>').join("") : '<div class="p5-empty">尚未设置定时监测。任务只在固定监测配置和范围下运行，不会混合历史配置。</div>';
  const configurationSummary = () => {
    if (!state.configuration) return "";
    const status = state.configuration.status;
    const label = status === "unchanged" ? "当前监测配置已保存" : status === "changed" ? "模型或联网方式已变更" : "尚未保存监测配置";
    const action = status === "unchanged" ? '<button class="p5-button" disabled>✓ 当前配置已保存</button>' : requestButton(status === "changed" ? "保存为新监测配置" : "保存监测配置", "save-configuration");
    return '<div class="p5-alert"><strong>' + esc(label) + '</strong><p class="p5-muted">' + (status === "unchanged" ? "当前模型、联网方式、域名和语言与已保存版本一致。" : "保存后会创建新版本；旧运行和历史证据不会被改写。") + '</p><div class="p5-actions">' + action + '</div></div>';
  };
  const overview = () => '<div class="p5-heading" id="p5-overview"><div><h1>持续测量</h1><p class="p5-muted">每条线只连接同一项目、监测配置、模型、联网方式和协议下的真实样本。刷新页面不会调用模型。</p></div><div class="p5-actions">' + requestButton("管理模型", "models") + requestButton("保存监测范围", "watchset") + requestButton("开始认知测试", "run", true) + '</div></div>' + configurationSummary() + (state.error ? '<div class="p5-alert"><strong>操作未完成</strong><p class="p5-muted">' + esc(state.error) + '</p></div>' : "") + scopeControls() + '<section class="p5-section"><h2>当前数据</h2><div class="p5-grid">' + metricCards() + '</div></section><section class="p5-section" id="p5-competition"><h2>AI 对你品牌的回答变化</h2><p class="p5-muted">每个点代表一次完整运行。每条线只代表一个模型；不同协议、联网方式或配置指纹不会被连成同一条线。</p>' + metricDefinitions().map(chart).join("") + '</section><section class="p5-section" id="p5-keywords"><h2>监测范围</h2>' + watchSetSummary() + '</section><section class="p5-section" id="p5-recognition"><div class="p5-charthead"><div><h2>本次运行</h2><p class="p5-muted">一个模型失败不会覆盖其他模型的证据。可在单个探针中查看和重试。</p></div>' + requestButton("只测试新增模型", "new-models") + '</div>' + runSummary() + '</section><section class="p5-section" id="p5-monitoring"><div class="p5-charthead"><div><h2>定时监测</h2><p class="p5-muted">计划任务复用相同的测量执行路径，并记录每次发生的运行。</p></div>' + requestButton("设置定时监测", "schedule") + '</div><div class="p5-grid">' + taskSummary() + '</div></section>';
  const createModal = () => modalShell('<form class="p5-modal" data-form="project" role="dialog" aria-modal="true">' + modalHeader("新建项目") + '<p class="p5-muted">每个项目只绑定自己的域名、模型、范围、运行和任务。</p><label>域名<input class="p5-input" name="domain" required placeholder="example.com"></label><label>项目名称<input class="p5-input" name="name" placeholder="可选"></label><div class="p5-actions" style="margin-top:16px">' + requestButton("取消", "close") + '<button class="p5-button primary" type="submit">创建草稿项目</button></div></form>');
  const watchsetModal = () => state.watchSet ? modalShell('<div class="p5-modal" role="dialog" aria-modal="true">' + modalHeader("当前监测范围") + '<p class="p5-muted">当前范围已保存。模型、关键词和对象的历史证据保留在原版本中；配置改变后需要新的范围版本。</p><div class="p5-actions">' + requestButton("关闭", "close") + "</div></div>") : modalShell('<div class="p5-modal" role="dialog" aria-modal="true">' + modalHeader("保存监测范围") + '<p class="p5-muted">系统会从该项目已保存的认知档案中提出对象和关键词候选，不会猜测竞争对象域名。</p><div class="p5-actions">' + requestButton("取消", "close") + requestButton("保存并确认范围", "create-watchset", true) + "</div></div>");
  const modelModal = () => modalShell('<div class="p5-modal" role="dialog" aria-modal="true">' + modalHeader("模型") + '<p class="p5-muted">选择一个或多个当前可用模型。新增模型只在“只测试新增模型”时创建自己的探针；移除不会删除历史证据。</p><div>' + state.catalog.map((model) => { const selected = state.selections.find((item) => item.modelId === model.modelId); return '<label class="p5-check"><input type="checkbox" data-model="' + esc(model.modelId) + '" ' + (selected ? "checked" : "") + '><span>' + esc(model.displayName || model.modelId) + '</span><select class="p5-select" data-mode="' + esc(model.modelId) + '"><option value="off" ' + (selected && selected.webSearchMode === "off" ? "selected" : "") + '>不联网</option><option value="provider_native" ' + (selected && selected.webSearchMode === "provider_native" ? "selected" : "") + (model.nativeWebSearchSupported ? "" : " disabled") + '>Provider 原生联网</option></select></label>'; }).join("") + '</div><div class="p5-actions" style="margin-top:16px">' + requestButton("保存模型选择", "save-models", true) + "</div></div>");
  const scheduleModal = () => {
    const task = state.tasks.find((item) => item.id === state.scheduleTaskId) || null;
    const rule = task ? task.rule : { frequency: "weekly", timezone: "Asia/Shanghai", hour: 9, minute: 0, weekday: 1, dayOfMonth: 1, cron: "0 9 * * 1" };
    const modelScope = new Set(task ? task.modelScope : state.selections.map((item) => item.modelId));
    const isWeekly = rule.frequency === "weekly";
    const isMonthly = rule.frequency === "monthly";
    const isCustom = rule.frequency === "custom";
    const preview = state.schedulePreview.length ? '<div class="p5-empty"><strong>下三次执行</strong><div>' + state.schedulePreview.map((value) => esc(dateLabel(value))).join("<br>") + '</div></div>' : "";
    return '<div class="p5-modalwrap"><form class="p5-modal" data-form="schedule" data-task-id="' + esc(task?.id || "") + '"><h2>' + (task ? "编辑定时监测" : "设置定时监测") + '</h2><p class="p5-muted">任务使用冻结的监测配置和范围。改动未来安排，不改写已经保存的运行和证据。</p><label>任务名称<input class="p5-input" name="name" value="' + esc(task?.name || "定期监测") + '"></label><div class="p5-row"><label>频率<select class="p5-select" name="frequency"><option value="daily" ' + (rule.frequency === "daily" ? "selected" : "") + '>每天</option><option value="weekly" ' + (isWeekly ? "selected" : "") + '>每周</option><option value="monthly" ' + (isMonthly ? "selected" : "") + '>每月</option><option value="custom" ' + (isCustom ? "selected" : "") + '>自定义 Cron</option></select></label><label>时区<input class="p5-input" name="timezone" value="' + esc(rule.timezone) + '"></label></div><div class="p5-row" data-simple-schedule ' + (isCustom ? "hidden" : "") + '><label>小时<input class="p5-input" name="hour" type="number" min="0" max="23" value="' + esc(rule.hour === undefined ? 9 : rule.hour) + '"></label><label>分钟<input class="p5-input" name="minute" type="number" min="0" max="59" value="' + esc(rule.minute === undefined ? 0 : rule.minute) + '"></label></div><div class="p5-row" data-weekly-schedule ' + (isWeekly ? "" : "hidden") + '><label>每周日期<select class="p5-select" name="weekday">' + [1, 2, 3, 4, 5, 6, 0].map((weekday) => '<option value="' + weekday + '" ' + (rule.weekday === weekday ? "selected" : "") + '>' + ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][weekday] + '</option>').join("") + '</select></label><div></div></div><div class="p5-row" data-monthly-schedule ' + (isMonthly ? "" : "hidden") + '><label>每月日期<input class="p5-input" name="dayOfMonth" type="number" min="1" max="31" value="' + esc(rule.dayOfMonth === undefined ? 1 : rule.dayOfMonth) + '"></label><div></div></div><label data-custom-schedule ' + (isCustom ? "" : "hidden") + '>Cron<input class="p5-input" name="cron" value="' + esc(rule.cron || "") + '"></label><h3>本任务执行的模型</h3><p class="p5-muted">模型范围固定在任务版本内。模型变更后，旧任务会在下一次执行前检查兼容性。</p><div>' + state.selections.map((selection) => '<label class="p5-check"><input type="checkbox" data-schedule-model="' + esc(selection.modelId) + '" ' + (modelScope.has(selection.modelId) ? "checked" : "") + '><span>' + esc(selection.displayName) + ' · ' + esc(searchLabel(selection.webSearchMode)) + '</span></label>').join("") + '</div>' + preview + '<div class="p5-actions" style="margin-top:16px">' + requestButton("预览下三次", "schedule-preview") + requestButton("取消", "close") + '<button class="p5-button primary" type="submit">' + (task ? "保存任务" : "创建监测任务") + '</button></div></form></div>';
  };
  const drawer = () => {
    if (!state.detail.length) return "";
    return '<aside class="p5-drawer" data-testid="measurement-evidence-drawer"><div class="p5-charthead"><strong>数据点证据</strong>' + requestButton("关闭", "close-drawer") + '</div>' + state.detail.map((detail) => { const samples = detail.samples || []; return '<section class="p5-section"><p class="p5-muted">模型：' + esc(detail.point.modelDisplayName) + ' · ' + esc(searchLabel(detail.point.webSearchMode)) + '</p><p class="p5-muted">分子 ' + detail.point.numerator + ' / 分母 ' + detail.point.denominator + ' · 预定 ' + detail.point.planned + ' · 失败或排除 ' + detail.point.failed + '</p>' + samples.map((sample) => { const attempt = sample.detail && sample.detail.attempts ? sample.detail.attempts.find((item) => item.id === sample.sample.attemptId) || null : null; return '<article class="p5-card" style="margin-top:10px"><span>' + esc(sample.sample.included ? sample.sample.numerator ? "计入分子" : "计入分母" : "已排除") + '</span><p class="p5-muted">' + esc(sample.sample.exclusionReason || "可判定") + '</p><p class="p5-status">Probe：' + esc(sample.sample.probeRunId) + ' · Attempt：' + esc(sample.sample.attemptId || "未创建") + '</p>' + (attempt && attempt.rawAnswer ? '<pre>' + esc(attempt.rawAnswer) + '</pre>' : '<p class="p5-muted">此样本没有可展示的原始回答。</p>') + '</article>'; }).join("") + '</section>'; }).join("") + '</aside>';
  };
  const render = () => {
    const project = currentProject();
    const headerAction = state.loading ? '<button type="button" class="p5-button primary" disabled>正在读取…</button>' : requestButton("新建项目", "create", true);
    const body = state.loading ? '<div class="p5-empty" data-testid="phase5-loading">正在读取项目数据，不会重新调用模型。</div>' : '<div data-testid="phase5-ready">' + (project ? overview() : '<div class="p5-empty"><h2>还没有项目</h2><p>新建一个域名项目后，模型、监测范围、运行、图表和任务都会严格归属到这个项目。</p>' + requestButton("新建项目", "create", true) + '</div>') + '</div>';
    mount.innerHTML = css() + '<div class="p5-shell" data-testid="phase5-workbench"><aside class="p5-side"><div class="p5-brand">${phase5BrandLockup}</div><div class="p5-label">项目</div><select class="p5-select" data-role="projects">' + (state.projects.length ? state.projects.map((item) => '<option value="' + esc(item.id) + '" ' + (item.id === state.projectId ? "selected" : "") + '>' + esc(item.name) + ' · ' + esc(item.normalizedDomain) + '</option>').join("") : '<option>还没有项目</option>') + '</select><nav class="p5-nav">' + navButton("总览", "p5-overview") + navButton("域名认知", "p5-recognition") + navButton("竞争对照", "p5-competition") + navButton("关键词", "p5-keywords") + navButton("来源", "p5-competition") + navButton("监测", "p5-monitoring") + '</nav><div class="p5-label">数据来源</div><p class="p5-muted" style="padding:0 8px">Provider API 观察<br>筛选与图表不会调用模型。</p></aside><main class="p5-main"><header class="p5-header"><strong>NiubiGEO / ' + esc(project ? project.name : "项目") + '</strong>' + headerAction + '</header><div class="p5-content">' + body + '</div></main></div>' + (state.modal === "create" ? createModal() : state.modal === "watchset" ? watchsetModal() : state.modal === "models" ? modelModal() : state.modal === "schedule" ? scheduleModal() : "") + drawer();
    requestAnimationFrame(() => document.querySelectorAll(".p5-line.draw").forEach((line) => { try { const length = line.getTotalLength(); line.style.setProperty("--path-length", String(length)); } catch (_) { line.classList.remove("draw"); } }));
  };
  const perform = async (button, label, job) => {
    if (button.dataset.state === "loading") return;
    button.dataset.state = "loading"; button.textContent = "◌ 正在" + label + "…"; button.disabled = true;
    try { await job(); button.dataset.state = "success"; button.textContent = "✓ 已完成"; window.setTimeout(load, 800); }
    catch (_) { state.error = "操作未完成。请检查当前项目的配置、范围、模型、预算或任务状态。"; button.dataset.state = "error"; button.textContent = "操作失败 · 重试"; button.disabled = false; render(); }
  };
  const ruleFromScheduleForm = (form) => {
    const data = new FormData(form);
    const frequency = String(data.get("frequency") || "daily");
    return { frequency, timezone: String(data.get("timezone") || "Asia/Shanghai"), hour: Number(data.get("hour")), minute: Number(data.get("minute")), ...(frequency === "weekly" ? { weekday: Number(data.get("weekday")) } : {}), ...(frequency === "monthly" ? { dayOfMonth: Number(data.get("dayOfMonth")) } : {}), ...(frequency === "custom" ? { cron: String(data.get("cron") || "") } : {}) };
  };
  const syncScheduleFields = (form) => {
    const frequency = form.querySelector("select[name='frequency']")?.value;
    const simple = form.querySelector("[data-simple-schedule]");
    const weekly = form.querySelector("[data-weekly-schedule]");
    const monthly = form.querySelector("[data-monthly-schedule]");
    const custom = form.querySelector("[data-custom-schedule]");
    if (simple) simple.hidden = frequency === "custom";
    if (weekly) weekly.hidden = frequency !== "weekly";
    if (monthly) monthly.hidden = frequency !== "monthly";
    if (custom) custom.hidden = frequency !== "custom";
  };
  document.addEventListener("change", async (event) => { const target = event.target; if (target instanceof HTMLSelectElement && target.dataset.role === "projects") { selectProject(target.value); await load(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-object") { state.objectId = target.value; render(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-keyword") { state.keywordId = target.value; render(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-range") { state.timeRange = target.value; render(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-search") { state.searchFilter = target.value; render(); return; } if (target instanceof HTMLInputElement && target.dataset.role === "historical-models") { state.showHistoricalModels = target.checked; render(); return; } if (target instanceof HTMLSelectElement && target.name === "frequency") { const form = target.closest("form[data-form='schedule']"); if (form) syncScheduleFields(form); } });
  document.addEventListener("click", async (event) => {
    const clicked = event.target;
    if (clicked instanceof Element && clicked.hasAttribute("data-modal-backdrop")) { state.modal = ""; render(); return; }
    const origin = event.target instanceof Element ? event.target.closest("button,[data-point]") : null;
    if (!origin) return;
    const navTarget = origin.getAttribute("data-nav-target");
    if (navTarget) { state.activeNav = navTarget; render(); window.requestAnimationFrame(() => document.getElementById(navTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
    const pointId = origin.getAttribute("data-point");
    const pointIds = origin.getAttribute("data-points") || pointId || "";
    if (pointId && state.project) { try { state.detail = await Promise.all(pointIds.split(",").filter(Boolean).map((id) => api("/api/projects/" + encoded(state.project.id) + "/measurement-stats/" + encoded(state.snapshot.id) + "/points/" + encoded(id) + "/samples"))); render(); } catch (_) { state.error = "无法读取这个数据点的证据。"; render(); } return; }
    const action = origin.getAttribute("data-action");
    const viewMetric = origin.getAttribute("data-view-metric");
    if (viewMetric === "brand_name_mention" || viewMetric === "domain_body_mention") { state.discoveryMetric = viewMetric; render(); return; }
    if (viewMetric === "keyword_association_count" || viewMetric === "keyword_association_coverage" || viewMetric === "keyword_relative_weight") { state.associationMetric = viewMetric; render(); return; }
    if (!action) return;
    if (action === "create" || action === "watchset" || action === "models" || action === "schedule") { state.modal = action === "create" ? "create" : action; render(); return; }
    if (action === "close") { state.modal = ""; render(); return; }
    if (action === "close-drawer") { state.detail = []; render(); return; }
    if (!state.project) return;
    const base = "/api/projects/" + encoded(state.project.id);
    if (action === "schedule-preview") {
      const form = document.querySelector("form[data-form='schedule']");
      if (!(form instanceof HTMLFormElement)) return;
      return perform(origin, "预览", async () => { state.schedulePreview = (await api(base + "/monitoring-tasks/preview", { method: "POST", body: JSON.stringify({ rule: ruleFromScheduleForm(form) }) })).occurrences || []; });
    }
    const divider = action.indexOf(":");
    const taskAction = divider < 0 ? "" : action.slice(0, divider);
    const taskId = divider < 0 ? "" : action.slice(divider + 1);
    if (taskAction === "task-preview") return perform(origin, "读取预览", async () => { state.taskPreview[taskId] = (await api(base + "/monitoring-tasks/" + encoded(taskId) + "/preview")).occurrences || []; });
    if (taskAction === "task-pause") return perform(origin, "暂停", async () => { await api(base + "/monitoring-tasks/" + encoded(taskId) + "/pause", { method: "POST", body: "{}" }); });
    if (taskAction === "task-resume") return perform(origin, "恢复", async () => { await api(base + "/monitoring-tasks/" + encoded(taskId) + "/resume", { method: "POST", body: "{}" }); });
    if (taskAction === "task-edit") { state.scheduleTaskId = taskId; state.schedulePreview = []; state.modal = "schedule"; render(); return; }
    if (taskAction === "task-delete") { state.deleteTaskId = taskId; render(); return; }
    if (taskAction === "task-confirm-delete") return perform(origin, "删除", async () => { await api(base + "/monitoring-tasks/" + encoded(taskId), { method: "DELETE" }); state.deleteTaskId = ""; });
    if (action === "create-watchset") return perform(origin, "保存", async () => { const row = await api(base + "/watch-sets", { method: "POST", body: "{}" }); await api(base + "/watch-sets/" + encoded(row.watchSet.id) + "/confirm", { method: "POST", body: "{}" }); state.modal = ""; });
    if (action === "save-configuration") return perform(origin, "保存", async () => { await api(base + "/baselines", { method: "POST", body: "{}" }); });
    if (action === "save-models") return perform(origin, "保存", async () => { const selections = []; document.querySelectorAll("input[data-model]").forEach((box) => { if (box.checked) { const modelId = box.getAttribute("data-model"); const select = document.querySelector("select[data-mode='" + modelId + "']"); selections.push({ modelId, webSearchMode: select ? select.value : "off" }); } }); await api(base + "/models", { method: "PUT", body: JSON.stringify({ selections }) }); state.modal = ""; });
    if (action === "run") return perform(origin, "创建运行", async () => { await api(base + "/measurement-runs", { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); });
    if (action === "new-models") return perform(origin, "创建新增模型运行", async () => { await api(base + "/measurement-runs/new-models", { method: "POST", body: "{}" }); });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modal) { state.modal = ""; render(); return; }
    const target = event.target;
    if (!(target instanceof Element) || !target.hasAttribute("data-point")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.form === "project") { event.preventDefault(); const button = form.querySelector("button[type='submit']"); return perform(button, "创建项目", async () => { const data = new FormData(form); const created = await api("/api/projects", { method: "POST", body: JSON.stringify({ domain: String(data.get("domain") || ""), name: String(data.get("name") || "") }) }); selectProject(created.project.id); state.modal = ""; }); }
    if (form.dataset.form === "schedule" && state.project) { event.preventDefault(); const button = form.querySelector("button[type='submit']"); return perform(button, form.dataset.taskId ? "保存任务" : "创建任务", async () => { const data = new FormData(form); const modelScope = []; form.querySelectorAll("input[data-schedule-model]").forEach((box) => { if (box.checked) { const modelId = box.getAttribute("data-schedule-model"); if (modelId) modelScope.push(modelId); } }); const body = JSON.stringify({ name: String(data.get("name") || ""), rule: ruleFromScheduleForm(form), modelScope }); const taskId = form.dataset.taskId || ""; await api("/api/projects/" + encoded(state.project.id) + "/monitoring-tasks" + (taskId ? "/" + encoded(taskId) : ""), { method: taskId ? "PATCH" : "POST", body }); state.modal = ""; state.scheduleTaskId = ""; state.schedulePreview = []; }); }
  });
  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("p5-page-hidden", document.hidden);
  });
  const begin = () => {
    if (!window.__niubigeoPhase2) { window.setTimeout(begin, 20); return; }
    load();
  };
  begin();
})();
</script>`;

export function renderProductPhase5AppHtml(): string {
  return renderProductPhase4AppHtml().replace("</body>", `${phase5Script}</body>`);
}
