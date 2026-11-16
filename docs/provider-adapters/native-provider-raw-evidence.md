# Preserve native gemini and anthropic response evidence

Gemini and Anthropic retain the already-redacted native response as technical evidence alongside final answer text and provider citation payload paths. Native provider output remains labeled as that provider API and uses only its own key. Raw payloads remain technical evidence rather than main report conclusions.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
