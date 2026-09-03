# NiubiGEO Open Source Alpha Plan

This document tracks what must be true before publishing NiubiGEO Community Edition as a public alpha repository.

## Current Status

NiubiGEO is ready for public alpha positioning at the product-logic level.

The current build can:

- Identify a target brand from a domain.
- Generate and confirm audit questions.
- Run real API provider audits.
- Compare how different AI models understand the brand.
- Discover competitors from provider answers.
- Separate confirmed competitors from possible related brands.
- Find user questions where competitors appear but the target brand does not.
- Classify sources as related, possible, or excluded.
- Link conclusions to supporting AI answers and sources.
- State clearly that API results are not consumer web UI results.

This does not mean the repository is ready for public release without the checks below.

## Release Name

```text
NiubiGEO Community Edition
v0.1.0-alpha
```

GitHub description:

```text
Open-source AI visibility and competitor intelligence. See how AI describes your product, who appears instead, and which sources shape the answers. 中文支持。
```

Recommended GitHub topics:

```text
geo
ai-visibility
generative-engine-optimization
answer-engine-optimization
llm
seo
brand-monitoring
competitor-analysis
self-hosted
open-source
chatgpt
perplexity
gemini
deepseek
```

## Public Alpha Checklist

Required before publishing:

- [x] English README.
- [x] Simplified Chinese README.
- [x] `.env.example`.
- [x] Dockerfile.
- [x] Docker Compose entry.
- [x] Security policy draft.
- [x] Contributing guide draft.
- [x] Report standard aligned with the human-readable report.
- [x] Capability matrix aligned with the current product boundary.
- [x] Choose and add a public license, preferably MIT or Apache-2.0.
- [ ] Remove `private: true` from `package.json` if npm publication is planned.
- [ ] Confirm no provider keys are committed.
- [ ] Confirm generated customer reports are not committed.
- [ ] Add one high-quality README screenshot after public samples are ready.
- [ ] Add one 10-20 second demo GIF after public samples are ready.
- [ ] Add at least one public non-NiubiStar sample report.
- [ ] Test Docker Quick Start on a clean machine.
- [ ] Test Node.js Quick Start on a clean machine.
- [ ] Confirm README commands match the current CLI.
- [ ] Confirm all links in README work after repository publication.

## Secret And Data Hygiene

Before opening the repository:

```bash
rg -n "OPENROUTER|OPENAI|ANTHROPIC|GEMINI|PERPLEXITY|DEEPSEEK|api_key|secret|token" .
REPORT_URL_PATTERN="localhost:8787/""reports/"
rg -n "$HOME|$REPORT_URL_PATTERN" README.md README.zh-CN.md docs examples
```

Expected policy:

- `.env` must never be committed.
- `runs/` should stay ignored unless a deliberately sanitized sample is added.
- Customer domains, private prompts, private reports, and generated evidence files must not be committed.
- A sample report must contain only public, non-sensitive data.

## Future Demo Assets

Demo assets should not be embedded in README until a non-sensitive public sample report is ready.

The demo should show only:

```text
Enter domain
-> Confirm generated questions
-> Select provider/model
-> Run audit
-> Read the brand competition report
```

Do not show provider keys, private prompts, local absolute paths, or customer data in screenshots.

Keep the non-NiubiStar sample report task open before broad public launch.

## Public Sample Report Standard

At least one sample should use a public non-NiubiStar target before launch.

Recommended sample types:

- One well-known open-source project.
- One developer tool.
- One ordinary SaaS product.

The sample report must:

- Come from real API provider responses.
- Include the API source caveat.
- Avoid local absolute paths.
- Avoid raw JSON and technical evidence sections.
- Show confirmed vs possible competitors.
- Show related, possible, and excluded source handling.
- Keep AI answers collapsed by default.

## Claims To Avoid

Do not claim:

- It replaces every commercial AI visibility platform.
- API results equal consumer web UI results.
- It provides human-verified regional monitoring.
- It includes NiubiStar's paid node network.
- It produces a definitive market-share ranking.
- It can prove stable AI behavior from a tiny sample.
- A black-box GEO score is enough to understand visibility.

## Public Positioning

Use this positioning:

```text
NiubiGEO opens the foundational AI visibility monitoring layer:
real provider audits, user-confirmed questions, competitor discovery,
source inspection, and evidence-backed reports.
```

Use this boundary:

```text
Community Edition is API-based and self-hosted. Browser UI collection,
human-verified regional monitoring, proprietary prompt databases, and
managed enterprise workflows are outside the open-source layer.
```

## Final Alpha Gate

Public alpha is allowed only when:

1. A new user can run the project from README alone.
2. Missing API keys never produce fake visibility results.
3. A generated report can be understood without knowing GEO metrics.
4. Every main conclusion links to an AI answer or source.
5. No committed file contains provider keys, local machine paths, or sensitive report data.
6. License, security, contributing, and bilingual README files are present.
7. Initial GitHub Release and GHCR Docker package are published for the alpha.
