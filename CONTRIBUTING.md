# Contributing to NiubiGEO

Thanks for helping improve NiubiGEO Community Edition.

The project goal is narrow: make AI visibility monitoring trustworthy, self-hosted, and understandable without hiding the method behind a black-box score.

## Development Setup

```bash
cp .env.example .env
npm install
npm run self-check
npm run server
```

Add at least one real provider key before running audits. Missing keys must not produce fake audit results.

## Contribution Areas

Good first contribution areas:

- Provider adapters.
- Prompt generation improvements.
- Competitor entity confirmation.
- Citation relevance classification.
- Report wording and evidence links.
- Bilingual UI and report copy.
- Docker and installation polish.
- Public sample reports based on non-sensitive real provider output.

## Product Rules

Contributions must follow these rules:

- Real provider data only for audit results.
- No mock provider in the core catalog.
- API results must stay labeled as API results.
- Provider keys cannot cross provider boundaries.
- Ordinary web search cannot be used as a substitute for provider citations.
- User-facing reports must answer business questions, not expose internal scorecards.
- Every main report conclusion must link to supporting AI answers or sources.
- Raw JSON, token cost, latency, prompt IDs, run IDs, SOV, and technical evidence sections must not appear in the main report.

## Before Opening A Pull Request

Run:

```bash
npm run self-check
```

Also check that your change does not commit secrets or generated private data:

```bash
rg -n "OPENROUTER|OPENAI|ANTHROPIC|GEMINI|PERPLEXITY|DEEPSEEK|api_key|secret|token" .
```

Do not include `.env`, customer reports, private prompts, private domains, or sensitive generated run data.

## Documentation

When changing report behavior, update:

- `docs/REPORT_STANDARD.md`
- `docs/CAPABILITY_MATRIX.md`
- `README.md`
- `README.zh-CN.md`

When changing provider behavior, document the source label and key boundary.
