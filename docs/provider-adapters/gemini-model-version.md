# Preserve the model version reported by gemini

Gemini evidence stores a non-empty response `modelVersion` when supplied, while keeping the requested alias as `model`. The adapter retains Gemini-only key routing and its API source label. See [GenerateContentResponse](https://ai.google.dev/api/generate-content#v1beta.GenerateContentResponse).

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
