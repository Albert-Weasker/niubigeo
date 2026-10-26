# Classify exhausted provider http timeouts

HTTP deadline failures are recorded as `timeout` after the bounded transport attempts, making them visible to provider retry policy and telemetry. The error omits endpoint and credential details; API source labels and key routing remain unchanged.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
