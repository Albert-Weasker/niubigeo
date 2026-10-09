# Exclude gemini thought parts from answer evidence

Gemini `thought: true` parts are excluded from answer text and answer-text citations; final answer parts remain API evidence. The request uses only the Gemini key and remains labeled `Source: Gemini API`. See [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking).

Existing provider-scoped credentials remain in use: direct-provider keys are sent only to their provider, and routed output keeps its gateway API source label.
