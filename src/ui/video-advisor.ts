// A fixed public link keeps the hosted advisor compatible with any self-hosted origin.
// No third-party script, iframe, credential or project data is loaded by this card.
export function renderVideoAdvisor(): string {
  const setting = process.env.NIUBIGEO_VIDEO_ADVISOR_ENABLED?.trim().toLowerCase();
  if (setting === "false" || setting === "0" || setting === "off") return "";
  return `<style>
    .niubigeo-advisor-card { position:fixed; z-index:3; right:18px; bottom:18px; display:flex; align-items:center; gap:10px; width:218px; max-width:calc(100vw - 32px); min-height:52px; padding:8px 10px; border:1px solid #2d3f57; border-radius:12px; background:#101722; color:#f5f7fb; text-decoration:none; box-shadow:0 6px 8px #0006; transition:border-color 160ms,background-color 160ms; }
    .niubigeo-advisor-card:hover { background:#151f2d; border-color:#5e8dcc; }
    .niubigeo-advisor-card:focus-visible { outline:2px solid #8bb7ff; outline-offset:4px; }
    .niubigeo-advisor-icon { display:grid; flex:none; place-items:center; width:36px; height:36px; border:1px solid #395675; border-radius:9px; background:#17283d; color:#a6ceff; }
    .niubigeo-advisor-copy { display:grid; gap:1px; min-width:0; }
    .niubigeo-advisor-copy strong { font-size:13px; font-weight:600; line-height:1.3; }
    .niubigeo-advisor-copy span { color:#b3c1d3; font-size:11px; line-height:1.3; }
    .niubigeo-advisor-arrow { margin-left:auto; color:#a6ceff; font-size:16px; }
    .workspace,.p5-content { padding-bottom:128px; }
    @media(max-width:640px) { .niubigeo-advisor-card { right:12px; bottom:max(12px,env(safe-area-inset-bottom)); width:52px; padding:7px; } .niubigeo-advisor-copy,.niubigeo-advisor-arrow { display:none; } }
    @media(prefers-reduced-motion:reduce) { .niubigeo-advisor-card { transition:none; } .niubigeo-advisor-card:hover { transform:none; } }
  </style>
  <a class="niubigeo-advisor-card" data-niubigeo-advisor href="https://niubigeo.ai/advisor" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" data-product-i18n-aria-label aria-label="NiubiGEO AI 顾问：前往官网咨询（新标签页）">
    <span class="niubigeo-advisor-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H9l-5 3v-7a7.5 7.5 0 0 1 7.5-11h1A7.5 7.5 0 0 1 20 11.5Z"/><path d="M8 10h8M8 14h5"/></svg></span>
    <span class="niubigeo-advisor-copy"><strong data-product-i18n>AI 顾问</strong><span data-product-i18n>与 NiubiGEO 对话</span></span>
    <span class="niubigeo-advisor-arrow" aria-hidden="true">↗</span>
  </a>`;
}
