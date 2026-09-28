import { renderProviderLogoPicker } from "./provider-logo-picker.js";
import { MODEL_PLATFORMS } from "../product/connections/model-directory.js";
export const BYOK_STYLE = String.raw`
.provider-logo-picker{margin:20px 0}.provider-logo-picker>p{font-size:14px;color:#c0c0c0;margin:0 0 12px}.provider-logo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.provider-logo-card{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;min-height:115px;padding:14px;border:1px solid #303030;border-radius:10px;background:#111;color:#eee;font:13px/1.4 -apple-system,sans-serif;cursor:pointer}.provider-logo-card:hover{background:#1a1a1a;border-color:#888}.provider-logo-card:focus-visible{outline:2px solid #4c8dff;outline-offset:3px}.provider-logo-image{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:#fff}.provider-logo-image img{display:block}.provider-logo-card[data-provider-logo="kimi-color"] .provider-logo-image{background:#111}.provider-logo-card small{color:#999;font-size:11px}.provider-logo-picker>p.provider-logo-hint{font-size:12px;color:#999;margin-top:12px}.key-dialog .provider-logo-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.key-dialog .provider-logo-card{padding:10px;font-size:12px;min-height:108px}.key-dialog .provider-logo-picker{max-height:260px;overflow:auto}@media(max-width:480px){.key-dialog .provider-logo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

.key-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:1px solid #ffffff24;border-radius:7px;background:#ffffff06;color:#c0c0c0;min-height:36px;padding:7px 12px;cursor:pointer;font:inherit;font-size:13px;line-height:1.4;transition:background .2s,border-color .2s}.key-button:before{content:"";width:6px;height:6px;border-radius:100%;background:#707070;box-shadow:0 0 0 3px #ffffff04}.key-button[data-connected=true]:before{background:#b0b0b0;box-shadow:0 0 10px #a0a0a080}.key-button:hover{border-color:#ffffff66;background:#ffffff0d}.key-dialog{color-scheme:dark;width:min(490px,calc(100% - 32px));padding:30px;border:1px solid #ffffff25;border-radius:16px;background:#0c0c0c;color:#f0f0f0;box-shadow:0 50px 150px #000c,0 0 90px #70707014;max-height:88dvh;overflow:auto;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.key-dialog::backdrop{background:#000b;backdrop-filter:blur(12px)}.key-dialog h2{font-size:27px;letter-spacing:-.6px;margin:0 0 12px;line-height:1.35;font-weight:550}.key-dialog p{margin:0 0 20px;color:#909090;font-size:14px}.key-dialog label{display:block;font-size:14px;color:#c0c0c0}.key-input-wrap{display:flex;gap:8px;margin:8px 0 12px}.key-input-wrap select,.key-input-wrap input{width:100%;min-width:0;box-sizing:border-box;padding:13px;border:1px solid #404040;border-radius:7px;background:#060606;color:#f0f0f0;font:15px ui-monospace,monospace}.key-dialog button{cursor:pointer;font:inherit;font-size:14px}.key-dialog .key-reveal{white-space:nowrap;flex-shrink:0;background:#181818;color:#c0c0c0;border:1px solid #383838;border-radius:7px;padding:8px 12px}.key-dialog .key-close{position:absolute;right:20px;top:16px;color:#a0a0a0;background:none;border:0;font-size:25px;padding:5px}.key-dialog a{color:#c0c0c0;text-decoration:underline;text-underline-offset:4px}.key-dialog .key-actions{display:flex;gap:10px;margin:22px 0 16px}.key-dialog .key-submit{flex:1;background:#f0f0f0;color:#141414;border:0;border-radius:7px;padding:12px 18px;font-weight:600}.key-dialog .key-clear{color:#a8a8a8;background:none;border:1px solid #404040;border-radius:7px;padding:12px 14px}.key-dialog button:disabled{opacity:.5;cursor:wait}.key-dialog .key-message{margin:0;color:#c0c0c0;overflow-wrap:anywhere;min-height:24px}.key-dialog .key-note{font-size:12px;line-height:1.8;margin:0}.key-workbench-bar{position:relative;z-index:8;display:flex;align-items:center;justify-content:flex-end;gap:15px;flex-wrap:wrap;padding:9px 22px;background:#0c0c0c;border-bottom:1px solid #262626;color:#a0a0a0;font:13px/1.6 -apple-system,sans-serif}.key-workbench-bar a{color:#c0c0c0}.key-workbench-bar .key-button{margin-left:3px}.key-dialog :focus-visible,.key-button:focus-visible{outline:2px solid #b8b8b8;outline-offset:4px}
`;

export const BYOK_SCRIPT = String.raw`
(() => {
  const t = value => window.__niubigeoProductText?.(value) ?? value;
  const locale = window.niubigeoI18n?.locale || 'zh-CN';
  if (window.niubigeoConnection) return;
  let key = '';
  let baseUrl = '';
  let manualModels = [];
  let connectedModels = [];
  const connections = new Map();
  let revision = 0;
  let checking = false;
  const $ = id => document.getElementById(id);
  function paint() {
    document.querySelectorAll('[data-connect-key]').forEach(button => { button.textContent = connections.size ? t('管理模型连接') + ' (' + connections.size + ')' : t('连接模型接口'); button.dataset.connected = String(connections.size > 0); });
    $('clear-openrouter-key').hidden = !connections.size;
    const list = $('provider-connections'); list.replaceChildren();
    connections.forEach((connection, id) => { const row = document.createElement('p'); row.textContent = connection.baseUrl ? new URL(connection.baseUrl).hostname : 'OpenRouter'; const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = t('断开'); remove.addEventListener('click', () => { connections.delete(id); paint(); }); row.append(' ', remove); list.append(row); });
    window.dispatchEvent(new Event('niubigeo:keychange'));
  }
  function open() {
    $('openrouter-key-input').value = ''; $('openrouter-key-input').type = 'password'; $('toggle-openrouter-key').textContent = t('显示');
    $('openrouter-key-message').textContent = key ? t('可以添加多个接口。同一地址的新 Key 会替换旧 Key。') : '';
    if (!$('openrouter-key-dialog').open) $('openrouter-key-dialog').showModal();
    $('openrouter-key-input').focus();
  }
  function clear() { revision++; key = ''; baseUrl = ''; manualModels = []; connectedModels = []; connections.clear(); $('openrouter-key-input').value = ''; paint(); }
  const needsKey = (method, path) => {
    if (method !== 'POST') return false;
    if (path === '/api/ask-runs' || path === '/api/openrouter/key') return true;
    const route = path.split('/').slice(1);
    if (!path.startsWith('/') || route.some(part => !part) || route[0] !== 'api' || route[1] !== 'projects') return false;
    if (route[3] === 'recognition-runs') return route.length === 4 || (route.length === 8 && route[5] === 'model-runs' && route[7] === 'retry');
    if (route[3] === 'measurement-runs') return route.length === 4 || (route.length === 5 && route[4] === 'new-models') || (route.length === 10 && route[5] === 'model-runs' && route[7] === 'probes' && route[9] === 'retry');
    return false;
  };
  async function authenticatedFetch(path, options = {}) {
    const url = new URL(path, location.href);
    const method = String(options.method || 'GET').toUpperCase();
    if (url.origin !== location.origin) throw new Error(t('模型凭据只能用于本站请求。'));
    const providerRequest = url.pathname === '/api/provider-models' || url.pathname === '/api/home/status' || (url.pathname.startsWith('/api/projects/') && (url.pathname.endsWith('/models') || needsKey(method, url.pathname)));
    const paid = needsKey(method, decodeURIComponent(url.pathname));
    if (!paid && !providerRequest) return fetch(path, options);
    if (!connections.size) return fetch(path, options);
    const headers = new Headers(options.headers);
    if (connections.size) headers.set('X-Niubigeo-Connections', JSON.stringify(Array.from(connections.values()).map(item => ({ baseUrl:item.baseUrl || null, apiKey:item.key, models:item.manualModels }))));
    return fetch(path, { ...options, headers, redirect: 'error' });
  }
  window.niubigeoConnection = Object.freeze({ connected: () => connections.size > 0, open, clear, fetch: authenticatedFetch, hostedByok: false, baseUrl: () => baseUrl, models: () => Array.from(connections.values()).flatMap(item => item.models), connections: () => Array.from(connections.values()).map(item => ({ baseUrl:item.baseUrl || null })) });
  document.addEventListener('click', event => {
    const platform = event.target.closest?.('[data-provider-logo]');
    if (platform) {
      if (checking) return;
      revision++;
      const endpoint = platform.dataset.providerUrl;
      $('provider-kind').value = endpoint ? 'custom' : 'openrouter';
      $('provider-kind').dispatchEvent(new Event('change'));
      $('provider-preset').value = endpoint;
      $('provider-base-url').value = endpoint;
      $('provider-model-ids').value = '';
      open();
      $('provider-key-label').textContent = (endpoint ? platform.dataset.providerName : 'OpenRouter') + ' API Key';
      $('openrouter-key-message').textContent = endpoint ? platform.dataset.providerName : platform.dataset.providerName + ' · OpenRouter API Key';
      $('openrouter-key-input').scrollIntoView({ block: 'center' });
      return;
    }
    if (event.target.closest?.('[data-connect-key]')) open();
  });
  $('close-openrouter-key').addEventListener('click', () => $('openrouter-key-dialog').close());
  $('openrouter-key-dialog').addEventListener('close', () => { revision++; $('openrouter-key-input').value = ''; });
  $('clear-openrouter-key').addEventListener('click', () => { clear(); $('openrouter-key-message').textContent = t('已断开。已经发出的请求会使用提交时的 Key 完成。'); });
  $('toggle-openrouter-key').addEventListener('click', () => { const input = $('openrouter-key-input'); input.type = input.type === 'password' ? 'text' : 'password'; $('toggle-openrouter-key').textContent = input.type === 'password' ? t('显示') : t('隐藏'); });
  $('openrouter-key-form').addEventListener('submit', async event => {
    event.preventDefault(); if (checking) return;
    const candidate = $('openrouter-key-input').value.trim();
    const custom = $('provider-kind').value === 'custom';
    const endpoint = custom ? $('provider-base-url').value.trim() : '';
    const models = custom ? $('provider-model-ids').value.split(',').map(value => value.trim()).filter(Boolean) : [];
    if (candidate.length < (custom ? 1 : 16) || candidate.length > 512 || !Array.from(candidate).every(character => character >= '!' && character <= '~')) { $('openrouter-key-message').textContent = t('请输入有效的 API Key。'); return; }
    const current = ++revision; checking = true; $('save-openrouter-key').disabled = true; $('openrouter-key-message').textContent = t('正在验证连接…');
    try {
      const response = await fetch(custom ? '/api/custom-provider/connect' : '/api/openrouter/key', { method: 'POST', headers: { Authorization: 'Bearer ' + candidate, 'Content-Type': 'application/json', ...(custom ? { 'X-Niubigeo-Base-Url': endpoint, 'X-Niubigeo-Models': JSON.stringify(models) } : {}) }, body: '{}', signal: AbortSignal.timeout(15000), redirect: 'error' });
      const result = await response.json();
      if (!response.ok || !result.connected) throw new Error(t(result.error) || t('连接未完成，请检查 Key。'));
      if (current !== revision) return;
      key = candidate; baseUrl = result.baseUrl || ''; manualModels = models; connectedModels = result.models || []; connections.set(baseUrl || 'openrouter', { key, baseUrl, manualModels, models: connectedModels }); $('openrouter-key-input').value = ''; paint(); $('openrouter-key-dialog').close();
    } catch (error) { if (current === revision) $('openrouter-key-message').textContent = t(error.message) || t('连接未完成，请稍后重试。'); }
    finally { checking = false; $('save-openrouter-key').disabled = false; }
  });
  $('provider-preset').addEventListener('change', () => { $('provider-base-url').value = $('provider-preset').value; $('provider-model-ids').value = ''; });
  $('provider-kind').addEventListener('change', () => { const custom = $('provider-kind').value === 'custom'; $('custom-provider-fields').hidden = !custom; $('provider-key-link').hidden = custom; $('provider-key-label').textContent = custom ? 'API Key' : 'OpenRouter API Key'; $('openrouter-key-input').minLength = custom ? 1 : 16; $('openrouter-key-input').placeholder = custom ? 'API Key' : 'sk-or-v1-…'; });
  addEventListener('pagehide', clear);
  paint();
})();
`;

export function renderProviderConnectionsUi(workbench = true): string {
  return `<style>${BYOK_STYLE}</style>${workbench ? '<div class="key-workbench-bar"><span data-product-i18n>模型连接 · 浏览器 Key 仅用于当前会话；服务端环境变量仍可用于后台监测</span><button type="button" class="key-button" data-connect-key data-product-i18n>连接 OpenRouter</button></div>' : ""}<dialog id="openrouter-key-dialog" class="key-dialog" aria-labelledby="openrouter-key-title"><button type="button" class="key-close" id="close-openrouter-key" aria-label="关闭">×</button><form id="openrouter-key-form"><p data-product-i18n style="font-size:12px;letter-spacing:2px;color:#b8b8b8">BRING YOUR OWN KEY</p><h2 data-product-i18n id="openrouter-key-title">连接你的模型接口。</h2><p data-product-i18n>选择 OpenRouter 或 OpenAI 兼容接口，费用由你的模型账户承担。读取模型目录不会生成回答。</p>${renderProviderLogoPicker()}<label data-product-i18n for="provider-kind">接口类型</label><div class="key-input-wrap"><select id="provider-kind"><option data-product-i18n value="openrouter">OpenRouter</option><option data-product-i18n value="custom">OpenAI 兼容接口</option></select></div><div id="custom-provider-fields" hidden><label data-product-i18n for="provider-preset">厂商快捷配置</label><div class="key-input-wrap"><select id="provider-preset"><option data-product-i18n value="">自定义接口</option>${MODEL_PLATFORMS.filter(platform => platform.baseUrl).map(platform => `<option data-product-i18n value="${platform.baseUrl}">${platform.name}</option>`).join("")}</select></div><label data-product-i18n for="provider-base-url">Base URL</label><div class="key-input-wrap"><input id="provider-base-url" type="url" placeholder="https://api.example.com/v1" autocomplete="off"></div><label data-product-i18n for="provider-model-ids">模型 ID（选填，用英文逗号分隔）</label><div class="key-input-wrap"><input id="provider-model-ids" placeholder="model-a, model-b" autocomplete="off"></div><p data-product-i18n class="key-note">留空时读取 /models；手动填写可跳过目录读取，Key 和模型可用性将在首次调用时验证。自定义接口暂不提供联网搜索。域名检测要求支持 JSON Schema 结构化输出。</p></div><label id="provider-key-label" for="openrouter-key-input">OpenRouter API Key</label><div class="key-input-wrap"><input id="openrouter-key-input" type="password" required minlength="16" maxlength="512" placeholder="sk-or-v1-…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="openrouter-key-note"><button type="button" class="key-reveal" id="toggle-openrouter-key">显示</button></div><p data-product-i18n class="key-note" id="openrouter-key-note">Key 仅用于本次连接与模型请求，不写入行为日志。刷新后需要重新连接。</p><div id="provider-connections" aria-label="已连接的模型接口"></div><div class="key-actions"><button type="submit" class="key-submit" id="save-openrouter-key">连接 ↗</button><button type="button" class="key-clear" id="clear-openrouter-key" hidden>全部断开</button></div><p data-product-i18n class="key-message" id="openrouter-key-message" role="status"></p><a id="provider-key-link" href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" style="font-size:13px">前往 OpenRouter 创建 Key ↗</a></form></dialog><script>${BYOK_SCRIPT}</script>`;
}
