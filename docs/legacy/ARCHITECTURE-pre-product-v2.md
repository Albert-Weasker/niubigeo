# Architecture

NiubiGEO Community Edition is a single-domain, real-provider AI visibility audit tool.

The architecture is intentionally small: collect enough evidence, let the user confirm the audit plan, run real provider requests, then produce a concise report that links every conclusion back to AI answers or sources.

## Core Flow

```text
Domain input
-> Discovery
-> Audit plan confirmation
-> Provider execution
-> Evidence analysis
-> Human-readable report
```

## Layers

### 1. Domain Intake

Accepts:

- Domain or URL.
- Optional brand name and aliases.
- Optional GitHub repository.
- Optional competitors.
- Optional user keywords.
- Provider and model targets.
- Report language.

The first public version is single-domain. Multi-brand workspaces, teams, and paid regional monitoring are outside this layer.

### 2. Discovery

Discovery builds an editable starting point for the user.

Inputs:

- Submitted domain.
- Same-domain public page evidence.
- GitHub README and topics when provided.
- Optional real-provider profile output when a key is available.

Outputs:

- Target brand.
- Aliases.
- Category.
- Candidate competitors.
- Candidate keywords.
- Suggested monitoring questions.

Discovery is setup evidence. It is not an AI visibility result until the generated questions are run against real providers.

### 3. Audit Plan Confirmation

Before provider calls happen, the user must be able to review and change:

- Target brand and aliases.
- Competitors.
- Keywords.
- Questions.
- Question categories.
- Provider/model selection.
- Language.

The system must separate:

- Brand awareness questions.
- Natural discovery questions.
- Comparison questions.
- Other questions.

Natural discovery questions should not contain the target brand. They test whether AI can think of the product when the user describes the need instead of naming the brand.

### 4. Provider Execution

The runner executes:

```text
confirmed question x provider x model
```

Provider rules:

- BYOK only.
- Missing keys block real audit execution.
- Direct provider keys cannot call other providers.
- OpenRouter-routed models must still be labeled as OpenRouter API output.
- Web search is Provider-native: OpenAI uses Responses `web_search`, OpenRouter uses its web plugin, Claude uses the Anthropic web search server tool, Gemini uses Google Search grounding, Perplexity uses Sonar web-grounded output, and DeepSeek uses Responses-compatible `web_search`.
- If web search is off, NiubiGEO must not send a search, grounding, or web plugin tool.
- Ordinary web search must not be used as a substitute for Provider-returned citations.
- API output must never be described as consumer web UI output.

Every run records:

- Provider.
- Model.
- Source label.
- Requested and actual web-search behavior.
- Execution prompt.
- Completion status.
- AI answer text when completed.
- Provider-returned citations.
- Error when failed.
- Timestamp.

### 5. Evidence Store

The file store writes local audit outputs:

- `audit.json`
- `report.json`
- `report.md`
- `report.html`
- `prompts.csv`
- `citations.csv`
- `keywords.csv` when keyword audit is used.

Generated reports are local user data and should not be committed unless deliberately sanitized as public examples.

### 6. Response Analyzer

The analyzer reads one AI answer at a time and extracts:

- Target mention.
- Competitor mentions.
- Recommendation signals.
- First visible position when available.
- Citation links.
- Source ownership.
- Brief evidence snippets.

The analyzer does not decide product strategy or write report prose.

### 7. Internal Metrics

Metrics are used internally to support analysis:

- Mention coverage.
- Citation coverage.
- Recommendation coverage.
- Competitor-only coverage.
- Provider/model differences.
- Prompt-category differences.
- Keyword association.

Internal metrics are not the user-facing story. They must be translated into concise conclusions before appearing in the main report.

### 8. Human Report Synthesis

The report layer converts structured evidence into five user-facing sections:

```text
Summary
How AI sees you
Who competes with you
Competitive differences
Sources
```

It must:

- Keep the main report short.
- Link every conclusion to AI answers or sources.
- Separate confirmed competitors from possible related brands.
- Show only related sources by default.
- Keep AI answers collapsed by default.
- Refuse conclusions when evidence is insufficient.

It must not show raw technical fields, prompt IDs, run IDs, token cost, latency, raw JSON, SOV, or black-box scores in the main report.

### 9. Delivery

Supported delivery surfaces:

- Local web UI.
- CLI.
- Local REST API.
- Docker Compose.
- Scheduled audits.

## Boundaries

Provider code calls providers. It does not write business conclusions.

Analyzer code extracts evidence from one answer. It does not aggregate the market.

Metrics code aggregates internal signals. It does not become the report.

Report code writes plain-language conclusions. It does not call providers.

UI code displays and confirms. It does not silently change the audit plan.
