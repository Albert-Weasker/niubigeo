# Tolerate out-of-range model release timestamps

Out-of-range OpenRouter catalog timestamps are retained as unknown release dates instead of making the complete model directory unavailable. Catalog discovery uses no provider key; paid request key routing and API source labels remain unchanged.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
