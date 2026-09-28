import { MODEL_PLATFORMS } from "../product/connections/model-directory.js";

const logos: Record<string, string> = {
  openai: "openai", anthropic: "claude-color", google: "gemini-color", deepseek: "deepseek-color",
  moonshotai: "kimi-color", qwen: "qwen-color", "bytedance-seed": "doubao-color", tencent: "hunyuan-color",
  baidu: "wenxin-color", "z-ai": "zai", iflytek: "spark-color", perplexity: "perplexity-color",
  "x-ai": "grok", "meta-llama": "meta-color", mistralai: "mistral-color",
};

export function renderProviderLogoPicker(): string {
  const platforms = [{ name: "OpenRouter", baseUrl: "", logo: "openrouter" }, ...MODEL_PLATFORMS
    .filter(platform => platform.vendors.length > 0)
    .map(platform => ({ name: platform.name, baseUrl: platform.baseUrl, logo: logos[platform.vendors[0]!]! }))];
  return '<div class="provider-logo-picker"><p data-product-i18n>点击平台 Logo，输入 API Key</p><div class="provider-logo-grid">' + platforms.map(platform =>
    `<button type="button" class="provider-logo-card" data-provider-logo="${platform.logo}" data-provider-name="${platform.name}" data-provider-url="${platform.baseUrl}"><span class="provider-logo-image"><img src="/assets/providers/${platform.logo}.svg" alt="" width="28" height="28"></span><span>${platform.name}</span><small data-product-i18n>${platform.baseUrl ? "厂商 API Key" : "OpenRouter API Key"}</small></button>`
  ).join("") + '</div><p class="provider-logo-hint" data-product-i18n>请使用卡片标注的接口 Key。标注 OpenRouter 的平台通过 OpenRouter 连接。</p></div>';
}
