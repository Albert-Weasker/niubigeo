# Reject malformed successful json without repeating provider requests

Malformed JSON in a successful HTTP response is an `invalid_response` and is not retried as an empty answer. Non-JSON error responses retain HTTP status handling. Provider keys and API source labels remain unchanged.

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
