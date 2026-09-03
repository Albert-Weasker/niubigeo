# Capability Matrix

This document is the implementation contract for NiubiGEO Community Edition.

A capability counts as complete only when real-provider code exists, self-checks exist, and user-facing reports expose evidence in plain language.

## Reference Capability Mapping

| Source project | Core idea to reuse | NiubiGEO Community Edition requirement | Code owner |
|---|---|---|---|
| Elmo | Brand, competitor, prompt, prompt run, citation, snapshot, report data loop | Store target entity, competitors, prompts, runs, citations, audit bundle, and report bundle | `src/core/types.ts`, `src/store/file-store.ts` |
| Elmo | Prompt fan-out by model and time | Run confirmed prompts across selected real providers and models | `src/runner/audit-runner.ts` |
| Elmo | Metrics can be recomputed from stored evidence | Keep internal mention, citation, recommendation, and competitor coverage metrics recomputable from completed runs | `src/metrics/metrics-engine.ts` |
| Elmo | REST API and self-hosting | Local HTTP API plus Docker Compose for self-hosting | `src/server.ts`, `Dockerfile`, `docker-compose.yml` |
| Aperture | BYOK provider setup | Load provider-specific keys from environment; missing keys block real audits | `src/config/env.ts` |
| Aperture | Provider catalog as source of truth | One catalog drives UI, CLI, and API validation | `src/providers/catalog.ts` |
| Aperture | Audit lifecycle | Every run records completed or failed state, provider, model, answer text, citations, and error if any | `src/runner/audit-runner.ts` |
| OneGlanse | Source transparency | Every result labels API source clearly and never implies browser UI or human-verified output | `src/providers/*`, `src/report/*` |
| OneGlanse | User-facing answer evidence | Reports link conclusions to actual AI answers without exposing internal IDs in the main copy | `src/report/report-builder.ts`, `src/report/report-html.ts` |
| AiCMO | Generated monitoring prompts | Generate brand awareness, natural discovery, comparison, alternative, and scenario prompts; generated prompts must be confirmed and run against real providers | `src/prompts/*` |
| AiCMO | Marketer-readable reporting | Convert metrics into concise answers to founder questions instead of showing technical scorecards | `src/report/human-report.ts` |
| Citatra | Citation and source intelligence | Classify provider citations into related, possible, and excluded sources | `src/analyzer/citation-intelligence.ts`, `src/report/human-report.ts` |
| Citatra | Competitor source discipline | Confirm competitors only when name, official domain, and product description are supported | `src/report/human-report.ts` |
| Elmo / AiCMO | Branded vs unbranded prompts | Separate direct brand awareness from natural discovery; do not mix them into one visible score | `src/prompts/domain-prompt-planner.ts`, `src/metrics/metrics-engine.ts` |
| OneGlanse / AiCMO / Citatra | Diagnostic explanation | Show where the target appears, where competitors appear instead, and which sources shaped the answer | `src/insights/gap-analyzer.ts`, `src/report/human-report.ts` |
| GitHub-first onboarding | Domain and repository evidence | Use site evidence, SEO metadata, GitHub README/topics, and user keywords to build prompt plans, without treating site evidence as AI visibility | `src/profile/*`, `src/keywords/*` |

## Non-Negotiable Checks

- No mock provider can be registered in the core catalog.
- Missing provider keys must fail before real audit execution.
- Direct provider keys cannot cross provider boundaries.
- OpenRouter-routed output must be labeled as OpenRouter API output.
- API output must never be described as ChatGPT, Gemini, Claude, Perplexity, or other consumer web UI output.
- Ordinary web search must never be used as a substitute for provider citations.
- Generated prompts must be shown for user confirmation before running.
- Brand awareness, natural discovery, and comparison prompts must remain separate.
- Every user-facing conclusion must link to an AI answer, a provider citation, or site evidence.
- Main reports must not expose SOV, prompt IDs, run IDs, token cost, latency, raw JSON, or technical evidence sections.
- Confirmed competitors must have entity evidence; unclear same-name entities must remain possible related brands.
- Main source sections must show only related sources; possible and excluded sources must be collapsed.
- Generated reports must be understandable without knowing GEO, SOV, prompt matrices, or provider internals.
