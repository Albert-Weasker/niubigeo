# Reject non-web schemes in provider citation urls

Provider citation URLs must use HTTP or HTTPS before becoming report evidence. This validation neither fetches those links nor substitutes web search for provider citations; API source labels and provider key boundaries are unchanged.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
