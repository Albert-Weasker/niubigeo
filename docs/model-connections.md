# Mixed model sources

In the open-source workbench, use **Connect model APIs** to add OpenRouter and one or more OpenAI-compatible APIs. Click a platform logo on the model page or connection dialog to prefill its endpoint and focus the key field. Cards identify whether a provider key or an OpenRouter key is required. You can also enter the Base URL and your key manually. Leave model IDs blank to read `/models`, or enter comma-separated deployment/model IDs when discovery is unavailable. Manual entries are checked on their first inference request, not when saved.

Select models across sources in the project's model page. Save each model's search setting, then save the monitoring configuration. Domain recognition and keyword measurements preserve each endpoint/model pair as a separate record, including answers, citations and failures. Same-name models on different endpoints never share an identity.

The OpenRouter catalog includes current text-output models with a 15-minute cache. Filter by mainstream family, vendor, source, search support or release date. The former 80-model display limit is removed. Consumer applications without matching API models are not replaced with unrelated models.

Search labels describe the selected API route, not the consumer app. OpenRouter search execution is confirmed from response evidence. Custom APIs have **unverified search support** and search stays disabled. Structured domain/keyword analysis additionally requires JSON Schema output support; unsupported calls remain visible as failures.

Keys stay in browser memory and are excluded from settings, evidence and browser storage. Reconnect after a reload. In-flight jobs retain their submitted connections. A browser-supplied connection never falls back to another server key. Without browser credentials, existing server environment keys and scheduled OpenRouter runs continue working. Temporary browser connections cannot be used by the separate scheduler worker.

Public HTTPS endpoints on port 443 are accepted by default, with DNS address pinning and no redirects. An operator can opt into local HTTP/HTTPS model endpoints with `NIUBIGEO_ALLOW_LOCAL_PROVIDERS=true npm run server`. The URL is reached from the server/container, not from the browser. A local service without authentication can use a nonempty placeholder key.

See the [detailed Chinese guide](model-connections.zh-CN.md), [NiubiGEO platform list](https://niubigeo.ai/human-testing) and [OpenRouter search documentation](https://openrouter.ai/docs/guides/features/plugins/web-search).
