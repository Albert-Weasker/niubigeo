# Provider-Native Web Search

NiubiGEO treats web access as a Provider execution concern, not as a report decoration.

The goal is to capture what the user receives from each selected AI Provider API. If a Provider has a native search or grounding feature, NiubiGEO sends that Provider's own tool configuration and records what was actually used.

## Flow

```text
User selects Provider, model, and web search setting
-> ProviderCatalog declares native web-search capability
-> Provider adapter builds the Provider-specific request
-> AnswerResult.search records the actual execution
-> PromptRun stores the same search metadata
-> Reports show simple source facts beside each AI answer
```

## Provider Paths

| Provider | Native path | Current behavior |
|---|---|---|
| OpenAI | Responses API + `web_search` | Sends `tools: [{ type: "web_search" }]` when enabled |
| OpenRouter | Chat Completions + web plugin | Sends `plugins: [{ id: "web" }]` when enabled |
| Anthropic Claude | Messages API + Claude web search server tool | Sends `tools: [{ type: "web_search_20250305", name: "web_search" }]` when enabled |
| Google Gemini | generateContent + Google Search grounding | Sends `tools: [{ google_search: {} }]` when enabled |
| Perplexity | Sonar web-grounded answers | Recorded as Provider web-grounded by design |
| DeepSeek | Responses-compatible `/responses` + `web_search` | Sends `tools: [{ type: "web_search" }]` when enabled |
| OpenAI-compatible | Custom Base URL + Responses-compatible `/responses` | Requires `OPENAI_COMPATIBLE_BASE_URL` and `OPENAI_COMPATIBLE_API_KEY` |

## Rules

- Web search off means no search, grounding, or web plugin tool is sent by NiubiGEO.
- Web search on means the Provider adapter must use the native Provider path.
- Ordinary web search results must not be counted as Provider citations.
- OpenRouter-routed models remain labeled as `Source: OpenRouter API`.
- Perplexity Sonar is marked as `provider_always_on`, because the Provider API is web-grounded by design.
- Custom OpenAI-compatible endpoints must fail clearly if their `/responses` endpoint does not support `web_search`; NiubiGEO must not silently fake the result.

## Stored Metadata

Each completed run can store:

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

`requested` means the provider-native search option was sent. `used` is true only when the response contains search evidence, except for providers that are always web-grounded such as Perplexity. If a provider accepts the option but returns no search evidence, the report shows `Search unconfirmed`.

This metadata is for source transparency. The user-facing report should explain the distinction in plain language such as `No web search`, `Search unconfirmed`, `Provider-native web search`, or `Provider web-grounded`.
