# Extract web queries only from native search tool calls

Query evidence is extracted only from Responses `web_search_call` items and Anthropic `server_tool_use` blocks named `web_search`. Unrelated query fields cannot confirm search execution. Source labels remain provider API labels and keys remain provider-specific. See [Responses web search](https://developers.openai.com/api/docs/guides/tools-web-search) and [Claude web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
