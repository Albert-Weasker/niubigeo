# Validate explicit provider http retry limits

Both explicit and scoped HTTP retry limits must be integers from 1 through 8; invalid limits fail before any provider request. API source labels and provider-specific key routing remain unchanged.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
