export const WORKBENCH_CSS = String.raw`
:root {
  --bg: var(--canvas);
  --sidebar: var(--sidebar-surface);
  --panel: var(--surface);
  --panel-hover: var(--surface-hover);
  --panel-raised: color-mix(in srgb, var(--surface) 50%, var(--surface-hover));
  --border: var(--border-default);
  /* Workbench aliases retain this page's existing muted and line values. */
  --line: var(--border-subtle);
  --text: var(--text-primary);
  --secondary: var(--text-muted);
  --muted: var(--text-subtle);
  --blue: var(--accent-blue);
  --green: var(--accent-green);
  --red: var(--accent-red);
  --amber: var(--accent-amber);
  --purple: var(--accent-purple);
  --control-outline: var(--border-default);
  --sidebar-width: 248px;
  --radius: 8px;
}

* { box-sizing: border-box; }

html { background: var(--bg); }

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

button, input, select, textarea { font: inherit; letter-spacing: 0; }
button, a, select, summary { -webkit-tap-highlight-color: transparent; }
a { color: inherit; text-decoration: none; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .48; }
.button, .nav-button, .language-button, .segment, .wizard-step, .close-button, .metric-card, .task-card, .provider-row, .event-button, input, select, textarea {
  transition: transform 140ms ease, opacity 140ms ease, background-color 140ms ease, border-color 140ms ease;
}
button:active:not(:disabled), .button:active:not(:disabled), .metric-card:active:not(:disabled) {
  transform: translateY(1px) scale(.98);
  transition-duration: 80ms;
}
button:focus-visible, a:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, summary:focus-visible, [role="button"]:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.hidden { display: none !important; }

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px 12px;
  overflow-y: auto;
  border-right: 1px solid var(--line);
  background: var(--sidebar);
}

.brand {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 8px 14px;
  border-bottom: 1px solid var(--line);
}
.brand-lockup-image {
  display: block;
  width: min(100%, 190px);
  height: auto;
}
.brand-mark { width: 30px; height: 30px; flex: 0 0 auto; }
.brand-mark svg { display: block; width: 100%; height: 100%; }
.brand-copy strong { display: block; font-size: 14px; line-height: 1.2; }
.brand-copy span { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; }

.project-switcher { margin: 14px 0 12px; }
.project-switcher label, .field label {
  display: block;
  margin-bottom: 7px;
  color: var(--secondary);
  font-size: 11px;
  font-weight: 700;
}

input, select, textarea {
  width: 100%;
  border: 1px solid var(--control-outline);
  border-radius: 6px;
  outline: 0;
  background: var(--input-bg);
  color: var(--text);
}
input, select { height: 38px; padding: 0 10px; }
textarea { min-height: 88px; padding: 10px; resize: vertical; line-height: 1.5; }
input::placeholder, textarea::placeholder { color: color-mix(in srgb, var(--text-primary) 30%, var(--canvas)); }
input:focus, select:focus, textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue); }

.nav-group { display: grid; gap: 3px; }
.nav-separator { height: 1px; margin: 12px 8px; background: var(--line); }
.nav-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--secondary);
  text-align: left;
  font-size: 13px;
  font-weight: 650;
}
.nav-button:hover { border-color: var(--border); background: var(--panel); color: var(--text); }
.nav-button.active { border-color: var(--border); background: var(--panel-hover); color: var(--text); }
.nav-index { width: 24px; color: var(--muted); font-size: 10px; font-weight: 800; }
.sidebar-footer { margin-top: auto; padding: 14px 8px 4px; border-top: 1px solid var(--line); }
.health-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 11px; }

.workspace { min-width: 0; }
.topbar {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 64px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--canvas) 96%, transparent);
}
.breadcrumb { min-width: 0; color: var(--secondary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.breadcrumb strong { color: var(--text); }
.top-actions, .toolbar, .segmented, .actions, .inline-actions { display: flex; align-items: center; gap: 8px; }
.top-actions { justify-content: flex-end; }
.top-actions > select { width: auto; min-width: 180px; }

.button, button.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--control-outline);
  border-radius: 6px;
  background: var(--panel);
  color: var(--text);
  font-size: 12px;
  font-weight: 750;
  position: relative;
  white-space: nowrap;
}
.button:hover { border-color: color-mix(in srgb, var(--text-subtle) 31.25%, var(--border-default)); background: var(--panel-hover); }
.button.primary { border-color: var(--blue); background: var(--blue); color: var(--text-on-accent); }
.button.primary:hover { background: var(--accent-blue-hover); }
.button.danger { color: var(--red); }
.button.text { min-height: 30px; padding: 0 6px; border-color: transparent; background: transparent; color: var(--secondary); }
.button[data-ui-state="loading"]::before {
  content: "";
  width: 12px;
  height: 12px;
  margin-right: 7px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: motion-spin 700ms linear infinite;
}
.button[data-ui-state="success"] { border-color: var(--green); background: var(--success-bg); color: var(--green); }
.button[data-ui-state="success"]::before { content: "✓"; margin-right: 6px; }
.button[data-ui-state="error"] { border-color: var(--red); background: var(--error-bg); color: color-mix(in srgb, var(--error-text) 87.096774%, var(--accent-red)); }
.action-error { margin-top: 10px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--error-border) 63%, var(--error-bg)); border-radius: 6px; background: var(--error-bg); color: color-mix(in srgb, var(--error-text) 87.096774%, var(--accent-red)); font-size: 11px; line-height: 1.5; }

.language-switch, .segmented {
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface) 58.333333%, var(--canvas));
}
.language-button, .segment {
  height: 29px;
  min-width: 42px;
  padding: 0 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--secondary);
  font-size: 11px;
  font-weight: 750;
}
.language-button:hover, .segment:hover { background: color-mix(in srgb, var(--border-default) 13.333333%, var(--surface-hover)); color: var(--text); }
.language-button.active, .segment.active { background: color-mix(in srgb, var(--border-default) 86.666667%, var(--surface-hover)); color: var(--text); }

.content { padding: 24px 28px 56px; }
.view { display: none; }
.view.active { display: block; }
.view.view-entering { animation: view-enter 160ms ease both; }
.view.data-refreshing { position: relative; }
.view.data-refreshing::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background: color-mix(in srgb, var(--text-on-accent) 1.8%, transparent);
  opacity: .7;
  animation: refresh-pulse 900ms ease-in-out infinite;
}
.view.data-refreshing .chart-line { opacity: .4; }
.page-head { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
.page-title h1 { margin: 0; font-size: 26px; line-height: 1.2; }
.page-title p { margin: 7px 0 0; color: var(--secondary); font-size: 13px; line-height: 1.5; }
.eyebrow { margin: 0 0 7px; color: var(--muted); font-size: 10px; font-weight: 800; text-transform: uppercase; }

.toolbar {
  flex-wrap: wrap;
  justify-content: space-between;
  min-height: 52px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.toolbar select { width: auto; min-width: 150px; }
.filter-note { color: var(--muted); font-size: 11px; }

.section { margin-top: 28px; }
.section:first-child { margin-top: 0; }
.section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 12px; }
.section-head h2 { margin: 0; font-size: 17px; line-height: 1.3; }
.section-head p { margin: 5px 0 0; color: var(--secondary); font-size: 12px; line-height: 1.5; }

.event-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--panel);
}
.event-item { min-height: 62px; padding: 14px 16px; border-bottom: 1px solid var(--line); color: var(--secondary); font-size: 13px; line-height: 1.45; }
.event-item:nth-child(odd) { border-right: 1px solid var(--line); }
.event-item:nth-last-child(-n + 2) { border-bottom: 0; }
.event-item strong { color: var(--text); }
.event-item small { display: block; margin-top: 5px; color: var(--muted); font-size: 10px; }
.source-breakdown { display: grid; gap: 5px; margin: 10px 0 0; padding: 0; list-style: none; }
.source-breakdown li { display: flex; justify-content: space-between; gap: 14px; color: var(--secondary); font-size: 11px; }
.source-breakdown li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-breakdown li strong { color: var(--citation); font-variant-numeric: tabular-nums; }
.event-button { width: 100%; border: 0; background: transparent; text-align: left; }
.event-button:hover { background: var(--panel-hover); }
.event-marker { display: inline-block; width: 6px; height: 6px; margin: 0 9px 2px 0; border-radius: 50%; background: var(--blue); }
.event-marker.positive { background: var(--green); }
.event-marker.negative { background: var(--red); }
.event-marker.citation { background: var(--purple); }

.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.metric-card {
  position: relative;
  min-height: 158px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  text-align: left;
}
button.metric-card { color: inherit; }
.metric-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--border-strong) 78.947368%, var(--border-default)); background: var(--panel-hover); transition-duration: 160ms; }
.metric-label { color: var(--secondary); font-size: 12px; font-weight: 650; }
.metric-value { display: block; margin-top: 13px; color: var(--text); font-size: 27px; line-height: 1; font-weight: 720; }
.metric-denominator { color: var(--muted); font-size: 13px; font-weight: 600; }
.metric-change { position: absolute; top: 16px; right: 16px; color: var(--muted); font-size: 11px; }
.metric-change.up { color: var(--green); }
.metric-change.down { color: var(--red); }
.metric-change.muted { max-width: 48%; overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
.metric-basis { position: absolute; right: 14px; bottom: 10px; left: 14px; overflow: hidden; color: var(--muted); font-size: 9px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.sparkline { position: absolute; right: 14px; bottom: 34px; left: 14px; width: calc(100% - 28px); height: 30px; }
.sparkline-placeholder { display: block; height: 30px; }
.sparkline polyline { fill: none; stroke: var(--blue); stroke-width: 2; vector-effect: non-scaling-stroke; }

.split-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, .7fr);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--panel);
}
.chart-panel { min-width: 0; padding: 18px; }
.rank-panel { min-width: 0; padding: 18px; border-left: 1px solid var(--line); }
.chart-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.chart-header h3 { margin: 0; font-size: 14px; }
.chart-header p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.trend-chart-header p { max-width: 860px; color: var(--secondary); line-height: 1.55; }
.trend-context { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.trend-context span { min-height: 24px; padding: 4px 7px; border: 1px solid var(--border); border-radius: 5px; color: var(--secondary); background: color-mix(in srgb, var(--surface) 58.333333%, var(--canvas)); font-size: 10px; font-weight: 700; }
.trend-definitions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.trend-definition { position: relative; display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 9px; min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: 7px; background: var(--input-bg); cursor: pointer; }
.trend-definition::before { position: absolute; top: 0; right: 0; left: 0; height: 2px; content: ""; background: var(--blue); }
.trend-definition.discovery::before { background: var(--amber); }
.trend-definition.candidate::before { background: var(--blue); }
.trend-definition.recommendation::before { background: var(--green); }
.trend-definition.citation::before { background: var(--purple); }
.trend-definition input { width: 14px; height: 14px; margin: 2px 0 0; accent-color: var(--blue); }
.trend-definition-body { display: grid; gap: 6px; min-width: 0; }
.trend-definition-body strong { color: var(--text); font-size: 12px; }
.trend-definition-body small { color: var(--muted); font-size: 10px; line-height: 1.45; }
.trend-definition-body code { color: var(--secondary); font-family: inherit; font-size: 10px; line-height: 1.45; white-space: normal; }
.trend-definition-body b { color: var(--text); font-size: 11px; }
.chart-frame { position: relative; height: 280px; margin-top: 14px; }
.chart-frame svg { display: block; width: 100%; height: 100%; overflow: visible; }
.chart-grid, .chart-axis-label { opacity: 0; transition: opacity 120ms ease; }
.chart-grid { stroke: color-mix(in srgb, var(--border-default) 40%, var(--border-subtle)); stroke-width: 1; }
.chart-grid.chart-axis-ready, .chart-axis-label.chart-axis-ready { opacity: 1; }
.chart-line { fill: none; stroke: var(--blue); stroke-width: 2.5; vector-effect: non-scaling-stroke; opacity: 0; transition: opacity 300ms ease; }
.chart-line.discovery { stroke: var(--amber); }
.chart-line.candidate { stroke: var(--blue); }
.chart-line.recommendation { stroke: var(--green); }
.chart-line.citation { stroke: var(--purple); }
.chart-line.secondary { stroke: var(--green); }
.chart-line.tertiary { stroke: var(--purple); }
.chart-line.quaternary { stroke: var(--amber); }
.chart-line.quinary { stroke: var(--red); }
.chart-line.drawing { opacity: 1; stroke-dasharray: var(--chart-path-length); stroke-dashoffset: var(--chart-path-length); animation: draw-chart-line 650ms cubic-bezier(.22, 1, .36, 1) forwards; }
.chart-line.chart-line-ready { opacity: 1; }
.chart-line.chart-line-muted { opacity: .24; }
.chart-point-group { opacity: 0; transform: translateY(3px); transform-box: fill-box; transition: transform 160ms ease var(--point-delay), opacity 160ms ease var(--point-delay); }
.chart-point-group.chart-point-ready { opacity: 1; transform: translateY(0); }
.chart-point { fill: var(--blue); stroke: var(--panel); stroke-width: 2; pointer-events: none; transform-box: fill-box; transform-origin: center; transition: transform 140ms ease; }
.chart-point.discovery { fill: var(--amber); }
.chart-point.candidate { fill: var(--blue); }
.chart-point.recommendation { fill: var(--green); }
.chart-point.citation { fill: var(--purple); }
.chart-point.secondary { fill: var(--green); }
.chart-point.tertiary { fill: var(--purple); }
.chart-point.quaternary { fill: var(--amber); }
.chart-point.quinary { fill: var(--red); }
.chart-point-hit { fill: transparent; cursor: pointer; outline: none; }
.chart-reference { opacity: 0; stroke: color-mix(in srgb, var(--text-subtle) 37.777778%, var(--border-strong)); stroke-width: 1; stroke-dasharray: 3 4; pointer-events: none; transition: opacity 100ms ease; }
.chart-point-pulse { fill: none; stroke: currentColor; stroke-width: 1.5; opacity: 0; transform-box: fill-box; transform-origin: center; }
.chart-point-group.point-selected .chart-point-pulse { animation: point-pulse 420ms ease-out; }
.chart-point-group:hover .chart-point, .chart-point-group:focus-within .chart-point { transform: scale(1.75); }
.chart-point-group:hover .chart-reference, .chart-point-group:focus-within .chart-reference { opacity: 1; }
.chart-point-hit:focus-visible { stroke: var(--text); stroke-width: 1; }
.chart-tooltip { position: fixed; z-index: 90; max-width: 280px; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--border-strong) 78.947368%, var(--border-default)); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 11px; line-height: 1.4; pointer-events: none; opacity: 0; transition: opacity 100ms ease, transform 100ms ease; }
.chart-tooltip.visible { opacity: 1; }
.legend, .trend-proof, .trend-definitions { opacity: 0; transition: opacity 160ms ease 620ms; }
.legend.chart-detail-ready, .trend-proof.chart-detail-ready, .trend-definitions.chart-detail-ready { opacity: 1; }
.trend-proof { margin-top: 16px; padding: 14px; border: 1px solid var(--border); border-radius: 7px; background: var(--input-bg); }
.trend-proof h4 { margin: 0 0 9px; font-size: 12px; }
.trend-proof ul, .trend-limitations ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.trend-proof li { display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 8px; align-items: start; }
.trend-proof li > span { width: 6px; height: 6px; margin-top: 6px; border-radius: 50%; background: var(--muted); }
.trend-proof li.positive > span { background: var(--green); }
.trend-proof li.negative > span { background: var(--red); }
.trend-proof li p { margin: 0; color: var(--secondary); font-size: 11px; line-height: 1.5; }
.trend-limitations { margin-top: 10px; border-top: 1px solid var(--line); color: var(--muted); font-size: 10px; }
.trend-limitations summary { padding: 11px 0 0; cursor: pointer; }
.trend-limitations ul { margin-top: 9px; padding-left: 14px; list-style: disc; }
.trend-point-summary { display: grid; gap: 8px; padding: 14px; border: 1px solid var(--border); border-radius: 7px; background: var(--panel); }
.trend-point-summary strong { font-size: 24px; }
.trend-point-summary p { margin: 0; color: var(--secondary); font-size: 12px; }
.trend-point-summary b { font-size: 11px; }
.trend-point-summary b.positive { color: var(--green); }
.trend-point-summary b.negative { color: var(--red); }
.trend-point-summary b.neutral { color: var(--secondary); }
.trend-evidence-group { margin-top: 16px; }
.trend-evidence-group h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 8px; font-size: 13px; }
.trend-evidence-group h3 span { color: var(--muted); font-size: 11px; }
.trend-evidence-group > p { margin: 0; padding: 12px; border: 1px solid var(--line); color: var(--muted); font-size: 11px; }
.trend-evidence-group ul { margin: 0; padding: 0; border: 1px solid var(--border); border-radius: 7px; list-style: none; background: var(--panel); }
.trend-evidence-group li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 12px; border-bottom: 1px solid var(--line); }
.trend-evidence-group li:last-child { border-bottom: 0; }
.trend-evidence-group li > span:first-child { min-width: 0; }
.trend-evidence-group li strong, .trend-evidence-group li small { display: block; }
.trend-evidence-group li strong { overflow-wrap: anywhere; font-size: 11px; }
.trend-evidence-group li small { margin-top: 4px; color: var(--muted); font-size: 10px; }
.trend-answer-actions { display: flex; flex: 0 0 auto; gap: 4px; }

@keyframes draw-chart-line {
  to { stroke-dashoffset: 0; }
}
@keyframes motion-spin { to { transform: rotate(360deg); } }
@keyframes point-pulse { from { opacity: .8; transform: scale(1); } to { opacity: 0; transform: scale(3.2); } }
@keyframes view-enter { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes refresh-pulse { 50% { opacity: .22; } }
.chart-empty { display: grid; place-items: center; min-height: 220px; padding: 24px; color: var(--muted); text-align: center; font-size: 12px; }
.chart-empty strong { color: var(--text); font-size: 15px; }
.chart-empty p { max-width: 560px; margin: 8px auto 16px; line-height: 1.55; }
.inline-empty {
  min-height: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--muted);
  background: var(--panel);
  font-size: 12px;
}
.inline-empty strong { color: var(--text); font-size: 14px; }
.inline-empty p { margin: 6px 0 12px; line-height: 1.55; }
.overview-alert {
  min-height: 0;
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--amber) 46%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--amber) 7%, var(--panel));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.overview-alert strong { color: var(--text); font-size: 14px; }
.overview-alert p { margin: 5px 0; color: var(--secondary); font-size: 13px; }
.overview-alert small { color: var(--muted); }
.legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; color: var(--secondary); font-size: 11px; }
.legend span::before { content: ""; display: inline-block; width: 14px; height: 2px; margin: 0 7px 3px 0; background: var(--blue); }
.legend span:nth-child(2)::before { background: var(--green); }
.legend span:nth-child(3)::before { background: var(--purple); }
.legend span:nth-child(4)::before { background: var(--amber); }
.legend-toggle { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.legend-toggle input { width: 14px; height: 14px; margin: 0; accent-color: var(--blue); }
.legend-toggle span::before { display: none; }
.legend .brand-legend:nth-child(1)::before { background: var(--blue); }
.legend .brand-legend:nth-child(2)::before { background: var(--green); }
.legend .brand-legend:nth-child(3)::before { background: var(--purple); }
.legend .brand-legend:nth-child(4)::before { background: var(--amber); }
.legend .brand-legend:nth-child(5)::before { background: var(--red); }
.view-tabs { display: flex; gap: 4px; margin-bottom: 12px; padding: 3px; width: fit-content; border: 1px solid var(--border); border-radius: 7px; background: color-mix(in srgb, var(--surface) 58.333333%, var(--canvas)); }
.overview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.overview-grid > .section { min-width: 0; }
.empty-inline, .monitor-compact { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 74px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); color: var(--secondary); }
.monitor-compact p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.monitor-compact > div:last-child { text-align: right; }

.data-table-wrap { width: 100%; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { padding: 11px 13px; border-bottom: 1px solid var(--border); background: var(--input-bg); color: var(--muted); text-align: left; font-size: 10px; font-weight: 800; white-space: nowrap; }
td { padding: 12px 13px; border-bottom: 1px solid var(--line); color: var(--secondary); vertical-align: top; line-height: 1.45; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: var(--panel-hover); }
td strong { color: var(--text); }
.row-link { color: var(--blue); font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.status {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--secondary);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}
.status.ok { border-color: color-mix(in srgb, var(--success-border) 56%, var(--success-bg)); color: var(--green); background: var(--success-bg); }
.status.error { border-color: color-mix(in srgb, var(--error-border) 63%, var(--error-bg)); color: var(--red); background: var(--error-bg); }
.status.warn { border-color: color-mix(in srgb, var(--warning-border) 90%, var(--warning-bg)); color: var(--amber); background: var(--warning-bg); }
.status.info { border-color: color-mix(in srgb, var(--info-border) 55%, var(--info-bg)); color: color-mix(in srgb, var(--info-text) 80%, var(--accent-blue)); background: var(--info-bg); }
.status.citation { border-color: color-mix(in srgb, var(--accent-purple) 32%, var(--advisor-surface)); color: var(--purple); background: color-mix(in srgb, var(--advisor-surface) 80%, var(--error-bg)); }

.source-distribution { display: flex; height: 7px; overflow: hidden; border-radius: 4px; background: var(--line); }
.source-distribution span:nth-child(1) { background: var(--blue); }
.source-distribution span:nth-child(2) { background: var(--purple); }
.source-distribution span:nth-child(3) { background: var(--green); }
.source-distribution span:nth-child(4) { background: var(--amber); }
.domain-source-list { display: grid; gap: 8px; }
.domain-source { border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.domain-source summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 62px; padding: 13px 15px; cursor: pointer; }
.domain-source summary > span { min-width: 0; }
.domain-source summary strong, .domain-source summary small { display: block; }
.domain-source summary strong { color: var(--text); font-size: 13px; }
.domain-source summary small { margin-top: 5px; color: var(--citation); font-size: 10px; }
.domain-source summary::marker { color: var(--muted); }
.domain-source-toggle { flex: 0 0 auto; color: var(--blue); font-size: 10px; font-weight: 750; }
.domain-source-pages { padding: 14px 15px; border-top: 1px solid var(--line); }
.domain-source-pages > strong { color: var(--text); font-size: 12px; }
.domain-source-pages > p { margin: 5px 0 10px; color: var(--muted); font-size: 10px; }
.domain-source-pages .section-head { align-items: flex-start; margin-bottom: 10px; }
.domain-source-pages .section-head strong { color: var(--text); font-size: 12px; }
.domain-source-pages ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.domain-source-pages li { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--secondary); font-size: 11px; }
.domain-source-pages li .button { min-width: 0; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.domain-source-pages li span { flex: 0 0 auto; color: var(--citation); font-variant-numeric: tabular-nums; }

.empty-state { padding: 48px 24px; border: 1px dashed var(--border); border-radius: var(--radius); color: var(--secondary); text-align: center; }
.empty-state strong { display: block; margin-bottom: 7px; color: var(--text); font-size: 15px; }
.empty-state p { max-width: 520px; margin: 0 auto 16px; font-size: 12px; line-height: 1.55; }
.error-box { padding: 12px; border: 1px solid color-mix(in srgb, var(--error-border) 63%, var(--error-bg)); border-radius: 6px; background: var(--error-bg); color: color-mix(in srgb, var(--error-text) 87.096774%, var(--accent-red)); font-size: 12px; line-height: 1.5; white-space: pre-wrap; }

.provider-model-toolbar { display: grid; grid-template-columns: auto minmax(240px, 420px); align-items: center; gap: 12px; margin-bottom: 12px; color: var(--secondary); font-size: 11px; }
.provider-model-toolbar input { min-height: 38px; }
.provider-grid { display: grid; gap: 10px; }
.provider-row { min-height: 82px; padding: 15px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.provider-row:hover, .task-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--border-strong) 78.947368%, var(--border-default)); background: var(--panel-hover); }
.provider-head { display: flex; justify-content: space-between; gap: 16px; }
.provider-row strong { display: block; font-size: 13px; }
.provider-row p { margin: 6px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
.provider-models { margin-top: 13px; border-top: 1px solid var(--line); }
.provider-models summary { padding: 12px 0 0; color: var(--secondary); cursor: pointer; font-size: 11px; font-weight: 700; }
.provider-model-list { display: grid; margin-top: 11px; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.provider-model-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 9px 11px; background: var(--input-bg); }
.provider-model-row + .provider-model-row { border-top: 1px solid var(--line); }
.provider-model-row strong, .provider-model-row small { display: block; }
.provider-model-row small { margin-top: 3px; color: var(--muted); font-size: 9px; }
.selected-model-capabilities { display: flex; flex-wrap: wrap; gap: 7px; }
.model-capability-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--secondary); font-size: 10px; }
.model-capability-chip[data-supported="true"] { border-color: color-mix(in srgb, var(--success-border) 70%, var(--success-bg)); color: var(--green); }
.model-capability-chip[data-supported="false"] { border-color: color-mix(in srgb, var(--error-border) 63%, var(--error-bg)); color: color-mix(in srgb, var(--error-text) 87.096774%, var(--accent-red)); }
.task-list { display: grid; gap: 10px; }
.task-card { border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.task-card-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, .8fr); gap: 20px; padding: 17px; }
.task-title { display: flex; align-items: center; gap: 10px; }
.task-title strong { font-size: 14px; }
.task-card p { margin: 7px 0 0; color: var(--muted); font-size: 11px; }
.task-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; border: 1px solid var(--line); background: var(--line); }
.task-stats > div { padding: 10px; background: var(--input-bg); }
.task-stats span, .task-stats strong { display: block; }
.task-stats span { color: var(--muted); font-size: 9px; }
.task-stats strong { margin-top: 6px; color: var(--text); font-size: 15px; }
.task-actions { display: flex; flex-wrap: wrap; gap: 7px; padding: 11px 17px; border-top: 1px solid var(--line); }
.task-switch { display: inline-flex; min-height: 34px; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--secondary); font: inherit; font-size: 11px; font-weight: 700; transition: transform 80ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease, opacity 140ms ease; }
.task-switch:hover { border-color: color-mix(in srgb, var(--text-subtle) 31.25%, var(--border-default)); background: var(--panel-hover); color: var(--text); }
.task-switch:active:not(:disabled) { transform: translateY(1px) scale(.98); }
.task-switch:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.task-switch-track { position: relative; width: 30px; height: 16px; flex: 0 0 auto; border: 1px solid color-mix(in srgb, var(--text-subtle) 22.222222%, var(--border-strong)); border-radius: 8px; background: color-mix(in srgb, var(--border-default) 93.333333%, var(--surface-hover)); transition: background-color 140ms ease, border-color 140ms ease; }
.task-switch-track span { position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: var(--secondary); transform: translateX(0); transition: transform 140ms ease, background-color 140ms ease; }
.task-switch[aria-checked="true"] .task-switch-track { border-color: var(--blue); background: color-mix(in srgb, var(--info-border) 50%, var(--info-bg)); }
.task-switch[aria-checked="true"] .task-switch-track span { background: var(--text-on-accent); transform: translateX(14px); }
.task-switch[data-ui-state="loading"] { cursor: wait; opacity: .72; }
.task-switch[data-ui-state="success"] { border-color: var(--green); color: var(--green); }
.task-switch[data-ui-state="error"] { border-color: var(--red); color: color-mix(in srgb, var(--error-text) 87.096774%, var(--accent-red)); }
.drawer-section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line); }
.drawer-section h3 { margin: 0 0 12px; font-size: 13px; }
.check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.check-grid label { display: flex; align-items: center; gap: 7px; color: var(--secondary); font-size: 11px; }
.check-grid input { width: 15px; height: 15px; margin: 0; accent-color: var(--blue); }
.check-list { display: grid; gap: 6px; max-height: 210px; overflow: auto; padding: 8px; border: 1px solid var(--line); background: var(--panel-soft); }
.check-list label { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 8px; align-items: start; padding: 6px; color: var(--secondary); font-size: 11px; line-height: 1.45; }
.check-list label:hover { background: var(--hover); color: var(--text); }
.check-list input { width: 15px; height: 15px; margin: 1px 0 0; accent-color: var(--blue); }
.schedule-preview { display: grid; gap: 6px; color: var(--secondary); font-size: 12px; }
.schedule-preview div { padding: 8px 10px; border: 1px solid var(--line); background: var(--panel); }
.inline-loading { display: flex; align-items: center; gap: 7px; }
.inline-loading > span { width: 11px; height: 11px; border: 1.5px solid var(--secondary); border-right-color: transparent; border-radius: 50%; animation: motion-spin 700ms linear infinite; }
.notification-channel-list { display: grid; gap: 8px; }
.notification-channel-row { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 10px; align-items: center; }
.notification-channel-row label { display: flex; align-items: center; gap: 7px; color: var(--secondary); font-size: 11px; }
.notification-channel-row input[type="checkbox"] { width: 15px; height: 15px; margin: 0; accent-color: var(--blue); }
.drawer-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }

.drawer-backdrop, .detail-backdrop { position: fixed; inset: 0; z-index: 50; background: var(--shadow-color); opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 200ms ease; }
.drawer-backdrop.open, .detail-backdrop.open { opacity: 1; visibility: visible; pointer-events: auto; }
.detail-backdrop { z-index: 60; }
.wizard {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 55;
  display: flex;
  flex-direction: column;
  width: min(760px, 100vw);
  height: 100vh;
  border-left: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 33.333333%, var(--canvas));
  transform: translateX(100%);
  transition: transform 180ms ease;
}
.wizard.open { transform: translateX(0); }
#audit-form { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; }
.wizard-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; min-height: 76px; padding: 18px 22px; border-bottom: 1px solid var(--line); }
.wizard-head h2 { margin: 0; font-size: 18px; }
.wizard-head p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.close-button { width: 34px; height: 34px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--secondary); font-size: 18px; }
.wizard-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-bottom: 1px solid var(--line); }
.wizard-step { min-height: 48px; padding: 9px 10px; border: 0; border-right: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 50%, var(--canvas)); color: var(--muted); text-align: left; font-size: 10px; font-weight: 750; }
.wizard-step:last-child { border-right: 0; }
.wizard-step.active { color: var(--text); box-shadow: inset 0 -2px 0 var(--blue); }
.wizard-step.done { color: var(--green); }
.wizard-body { flex: 1 1 auto; min-height: 0; padding: 22px; overflow-y: auto; }
.wizard-panel { display: none; }
.wizard-panel.active { display: block; }
.wizard-panel > h3 { margin: 0 0 5px; font-size: 15px; }
.wizard-panel > p { margin: 0 0 18px; color: var(--secondary); font-size: 12px; line-height: 1.5; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.field.full { grid-column: 1 / -1; }
.field-help { margin: 6px 0 0; color: var(--muted); font-size: 10px; line-height: 1.45; }
.wizard-footer { display: flex; justify-content: space-between; gap: 12px; padding: 14px 22px; border-top: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 33.333333%, var(--canvas)); }
.request-estimate { color: var(--secondary); font-size: 11px; line-height: 1.45; }

.plan-layout { display: grid; grid-template-columns: minmax(0, 1fr) 250px; gap: 14px; align-items: start; }
.plan-target, .prompt-group, .plan-summary { border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.plan-target, .plan-summary { padding: 14px; }
.plan-summary { position: sticky; top: 0; }
.plan-summary h3, .plan-target h3, .prompt-group h3 { margin: 0; font-size: 13px; }
.summary-list { display: grid; gap: 8px; margin-top: 12px; }
.summary-list div { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 11px; }
.summary-list strong { color: var(--text); text-align: right; overflow-wrap: anywhere; }
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-height: 25px; padding: 3px 7px; border: 1px solid var(--border); border-radius: 5px; color: var(--secondary); font-size: 10px; }
.chip button { width: 16px; height: 16px; padding: 0; border: 0; background: transparent; color: var(--muted); }
.inline-add, .prompt-add { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: 10px; }
.prompt-groups { display: grid; gap: 10px; margin-top: 10px; }
.prompt-group { padding: 13px; }
.prompt-group > p { margin: 5px 0 10px; color: var(--muted); font-size: 10px; }
.prompt-row { display: grid; grid-template-columns: 18px minmax(0, 1fr) 150px auto; gap: 8px; align-items: start; padding: 9px 0; border-top: 1px solid var(--line); }
.prompt-row input[type="checkbox"] { width: 16px; height: 16px; margin-top: 10px; }
.prompt-row textarea { min-height: 50px; height: 50px; }
.prompt-row .button { min-height: 34px; }
.prompt-add { grid-template-columns: 150px minmax(0, 1fr) auto; }

.detail-sheet { position: fixed; right: 0; bottom: 0; z-index: 65; width: min(720px, 100vw); height: calc(100vh - 64px); overflow-y: auto; border: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 41.666667%, var(--canvas)); opacity: 0; visibility: hidden; pointer-events: none; transform: translateX(100%); transition: transform 200ms ease, opacity 200ms ease; }
.detail-sheet.open { opacity: 1; visibility: visible; pointer-events: auto; transform: translateX(0); }
.detail-head { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 41.666667%, var(--canvas)); }
.detail-body { padding: 18px; }
.answer-text { white-space: pre-wrap; color: var(--secondary); font-size: 12px; line-height: 1.7; }

.audit-progress {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 80;
  width: min(420px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 40px));
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--input-bg);
  animation: progress-enter 180ms ease both;
}
.audit-progress-head, .audit-progress-head > div { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
.audit-progress-head > div { justify-content: flex-start; }
.operation-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--blue); animation: status-pulse 900ms ease-in-out infinite; }
.audit-progress[data-job-status="completed"] .operation-dot { background: var(--green); animation: none; }
.audit-progress[data-job-status="failed"] .operation-dot { background: var(--red); animation: none; }
.audit-progress-bar { height: 4px; margin-top: 14px; overflow: hidden; border-radius: 2px; background: var(--line); }
.audit-progress-bar span { display: block; width: 100%; height: 100%; background: var(--blue); transform: scaleX(0); transform-origin: left; transition: transform 260ms ease; }
.audit-progress > p { margin: 10px 0; color: var(--secondary); font-size: 11px; }
.audit-progress ul { display: grid; gap: 1px; margin: 0; padding: 0; border: 1px solid var(--line); list-style: none; }
.audit-progress li { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 10px; background: var(--panel); font-size: 11px; }
.audit-progress li span:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.audit-progress li strong, .audit-progress li small { display: block; }
.audit-progress li small { margin-top: 3px; color: var(--muted); font-size: 9px; }
@keyframes progress-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes status-pulse { 50% { opacity: .35; transform: scale(.8); } }

@media (max-width: 1180px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .split-panel { grid-template-columns: 1fr; }
  .rank-panel { border-top: 1px solid var(--line); border-left: 0; }
  .task-card-main { grid-template-columns: 1fr; }
  .trend-definitions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 820px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { position: sticky; height: auto; min-height: 0; padding: 10px; border-right: 0; border-bottom: 1px solid var(--line); }
  .brand { padding-bottom: 10px; }
  .project-switcher { margin: 10px 0; }
  .nav-group { display: flex; overflow-x: auto; padding-bottom: 3px; }
  .nav-separator, .sidebar-footer { display: none; }
  .nav-button { flex: 0 0 auto; width: auto; padding: 0 11px; }
  .nav-index { display: none; }
  .topbar { position: static; padding: 10px 14px; }
  .content { padding: 18px 14px 40px; }
  .page-head, .toolbar { align-items: stretch; flex-direction: column; }
  .top-actions { flex-wrap: wrap; }
  .event-list { grid-template-columns: 1fr; }
  .event-item, .event-item:nth-child(odd), .event-item:nth-last-child(-n + 2) { border-right: 0; border-bottom: 1px solid var(--line); }
  .event-item:last-child { border-bottom: 0; }
  .provider-grid, .form-grid { grid-template-columns: 1fr; }
  .overview-grid { grid-template-columns: 1fr; }
  .overview-alert { align-items: flex-start; flex-direction: column; }
  .check-grid { grid-template-columns: 1fr; }
  .notification-channel-row { grid-template-columns: 1fr; }
  .field.full { grid-column: auto; }
  .plan-layout { grid-template-columns: 1fr; }
  .plan-summary { position: static; }
  .trend-chart-header { flex-direction: column; }
}

@media (max-width: 560px) {
  .breadcrumb { display: none; }
  .topbar { justify-content: flex-end; }
  .metric-grid { grid-template-columns: 1fr; }
  .page-title h1 { font-size: 22px; }
  .wizard-steps { grid-template-columns: repeat(5, 86px); overflow-x: auto; }
  .wizard-body { padding: 18px 14px; }
  .wizard-footer { padding: 12px 14px; }
  .wizard-footer { flex-wrap: wrap; }
  .request-estimate { order: 3; width: 100%; }
  .prompt-row, .prompt-add { grid-template-columns: 1fr; }
  .prompt-row input[type="checkbox"] { margin: 0; }
  .task-stats { grid-template-columns: 1fr; }
  .trend-definitions { grid-template-columns: 1fr; }
  .trend-evidence-group li { align-items: flex-start; flex-direction: column; }
  .monitor-compact, .empty-inline { align-items: flex-start; flex-direction: column; }
  .monitor-compact > div:last-child { text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}

:root[data-theme="light"] {
  --control-outline: var(--border-control);
}
:root[data-theme="light"] .button:hover { border-color: var(--border-control); }
:root[data-theme="light"] .status.ok { border-color: var(--success-border); }
:root[data-theme="light"] .status.error { border-color: var(--error-border); }
:root[data-theme="light"] .status.warn { border-color: var(--warning-border); }
:root[data-theme="light"] .status.info { border-color: var(--info-border); }
`;
