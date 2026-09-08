# Model Web Search Capabilities

NiubiGEO exposes native web-search capability per model, never as a provider-wide promise.

## Contract

Every listed model has one explicit boolean:

```ts
type ProviderModelCapability = {
  providerId: string;
  model: string;
  name: string;
  nativeWebSearchSupported: boolean;
  source: "provider_catalog" | "provider_definition";
};
```

- `true` means NiubiGEO can request and verify the model or provider's native search path.
- `false` means native search is unavailable through the configured endpoint.
- A gateway-managed external search fallback is never relabeled as native search.
- A catalog network failure is reported as catalog unavailable. It is not converted to either support or non-support.

## Sources

OpenRouter models are loaded from its public model catalog. NiubiGEO requires both a native web-search price field and a compatible invocation protocol before marking a model as supported. This keeps models that only accept OpenRouter-managed search fallback in the unsupported group.

Direct providers expose the complete model set currently accepted by NiubiGEO's provider definition. Each model has a declarative capability value next to the model declaration.

The UI reads the unified `/provider-models` endpoint. It lists all models, shows the support state on every row, and repeats the state beside models selected in the audit wizard.

## Extension Rule

New providers add either:

1. a remote `ProviderModelCapabilitySource`, or
2. declarative capability entries for every accepted model.

Business logic does not inspect model names, vendors, languages, brands, domains, or prompts to infer support.
