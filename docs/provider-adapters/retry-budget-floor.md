# Keep empty-answer retries from reducing caller token budgets

Empty-answer recovery never decreases a caller-provided output budget, even when it exceeds the configured recovery ceiling. Provider API source labels and provider-specific key routing are preserved.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
