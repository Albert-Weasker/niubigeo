# Prevent telemetry errors from repeating successful provider calls

Retry classification applies only to provider execution errors. A telemetry callback failure after success propagates without repeating the paid call. Provider-specific API key routing and source labels remain unchanged.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
