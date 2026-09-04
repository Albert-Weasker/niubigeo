# Provider 原生联网搜索

NiubiGEO 把联网能力放在 Provider 执行层，而不是报告展示层。

目标是尽量记录用户在不同 AI Provider API 中实际得到的结果。如果某个 Provider 有自己的原生搜索或 grounding 能力，NiubiGEO 就发送该 Provider 官方支持的工具参数，并记录实际使用方式。

## 流程

```text
用户选择 Provider、模型和是否联网
-> ProviderCatalog 声明该 Provider 的原生联网能力
-> Provider adapter 构造该厂商专用请求
-> AnswerResult.search 记录真实执行方式
-> PromptRun 保存同一份 search metadata
-> 报告用普通语言展示每条回答的来源状态
```

## Provider 路径

| Provider | 原生路径 | 当前行为 |
|---|---|---|
| OpenAI | Responses API + `web_search` | 开启联网时发送 `tools: [{ type: "web_search" }]` |
| OpenRouter | Chat Completions + web plugin | 开启联网时发送 `plugins: [{ id: "web" }]` |
| Anthropic Claude | Messages API + Claude web search server tool | 开启联网时发送 `tools: [{ type: "web_search_20250305", name: "web_search" }]` |
| Google Gemini | generateContent + Google Search grounding | 开启联网时发送 `tools: [{ google_search: {} }]` |
| Perplexity | Sonar 天然联网回答 | 按 Provider 天然联网记录 |
| DeepSeek | Responses 兼容 `/responses` + `web_search` | 开启联网时发送 `tools: [{ type: "web_search" }]` |
| OpenAI-compatible | 自定义 Base URL + Responses 兼容 `/responses` | 需要 `OPENAI_COMPATIBLE_BASE_URL` 和 `OPENAI_COMPATIBLE_API_KEY` |

## 规则

- 关闭联网时，NiubiGEO 不发送搜索、grounding 或 web plugin 工具。
- 开启联网时，Provider adapter 必须使用该 Provider 的原生路径。
- 普通网页搜索结果不能被当作 Provider citation。
- 通过 OpenRouter 路由的模型，来源仍然标记为 `Source: OpenRouter API`。
- Perplexity Sonar 标记为 `provider_always_on`，因为它的 API 设计就是联网回答。
- 自定义 OpenAI-compatible 端点如果不支持 `/responses` 或 `web_search`，必须清晰失败，不能伪造结果。

## 保存字段

每条完成的回答可以保存：

```json
{
  "requested": true,
  "requestMode": "auto",
  "used": false,
  "usedMode": "requested_not_confirmed",
  "endpointKind": "official_api",
  "endpointProtocol": "responses",
  "endpointUrl": "https://api.openai.com/v1/responses",
  "toolName": "web_search",
  "webQueries": [],
  "citationCount": 0
}
```

`requested` 表示请求中发送了 Provider 原生搜索选项；`used` 只有在响应中出现搜索证据时才为 `true`。Perplexity 这类天然联网的 Provider 例外处理。如果 Provider 接受了搜索选项，但响应中没有搜索查询或原生引用，报告会显示“联网未确认”。

这些字段用于来源透明。用户报告里会区分“未联网”“联网未确认”“Provider 原生联网”和“Provider 天然联网”。
