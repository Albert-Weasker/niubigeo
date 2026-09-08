# Provider-Native Web Search

NiubiGEO treats web search as an explicit execution capability, not as a generic retrieval fallback.

## User contract

- Search is enabled manually for an audit or monitoring baseline.
- Disabled means NiubiGEO does not add any search tool or search option.
- Enabled means NiubiGEO requests the selected routed model's native search path.
- NiubiGEO does not run its own web search and does not silently substitute a generic search engine.
- A citation alone is not sufficient proof that OpenRouter used provider-native search.

## OpenRouter execution

OpenRouter models expose two native-search transports:

1. Models with verified first-party native-search routes receive `openrouter:web_search` with `engine: native`. Providers whose native transport accepts forced invocation also receive `tool_choice: required`. Routing is restricted to that provider's first-party endpoint family. When a provider exposes multiple first-party transports, such as Google Vertex and Google AI Studio, those transports may fail over within the same provider family.
2. Models whose API is already web-grounded receive their native search options without a generic `tools` payload.

Tool invocation follows the selected provider's native transport contract. Providers that accept required tool choice receive it. Providers that reject forced native tools receive an explicit search instruction and control invocation through their own protocol. In both cases, NiubiGEO accepts the run only when router metadata confirms native execution; a model choosing not to search is not silently reported as an online result.

NiubiGEO requests OpenRouter router metadata for every routed request. A server-tool response counts as provider-native only when the metadata reports `mode: native`. A reported `mode: sdk` is retained as evidence but is not labeled provider-native.

NiubiGEO does not require every optional request parameter to be supported by the selected endpoint. Native execution is proven from response metadata instead. This prevents an unrelated optional parameter from removing an otherwise valid native-search route.

If the routed model has no verifiable first-party native-search route, NiubiGEO rejects the online run before the answer request. It does not substitute OpenRouter SDK search, Exa, or another generic engine. The same model remains available for offline audits.

This distinction prevents OpenRouter's gateway search path from being presented as search performed by the routed model provider.

## Result states

```text
provider_native        Provider-native execution was confirmed.
provider_always_on     The selected Provider model is inherently web-grounded.
requested_not_confirmed Search was requested but native execution was not verified.
none                   Search was not requested and the Provider is not always online.
```

The stored search record includes the endpoint, request mode, actual execution mode, mechanism name, queries when returned, and citation count. Provider raw JSON is not persisted.
