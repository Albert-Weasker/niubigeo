# Changelog

## NiubiGEO v0.2.0 - 2026-09-08

- Published the current project-based workbench: independent projects, model selection, monitoring configuration, domain recognition, cross-model evidence, keyword measurements and the scheduling worker.
- Added synchronized English/Chinese READMEs, updated vector logos and 20 real-domain Markdown cases with original answers and screenshots. Ten cases are partial; failures remain visible.
- The Docker image builds from the release tag's commit for Linux amd64 and arm64. Version, source labels, assets, project creation and persistence are checked before version tags and `latest` are written. Prereleases never update `latest`.
- Published directly by maintainer authorization with the [known issues and acceptance gaps](docs/releases/v0.2.0.md) disclosed. Earlier blocked candidate records remain unchanged.

## v0.2.0-rc.1 candidate - Unpublished

- Added a frozen twenty-domain study, isolated API-based example commands, cumulative cost reservation, and evidence exports. All twenty domains were attempted; eleven produced eligible neutral keywords. Ten cases retain partial analysis failures. The original failed preflight is preserved separately.
- Added bilingual candidate READMEs, case pages, a static brand website, and current architecture, methodology, evidence, deployment, and upgrade documentation.
- Updated the candidate image to launch the current product server and include the new vector brand assets. The optional Compose worker uses the same product data root.
- Added candidate/stable image policy checks. Manual and prerelease builds do not move `latest`; stable promotion requires an explicitly accepted existing digest.
- Fixed model catalog recovery after a failed request, project selection URL synchronization, and keyword chart grouping and missing-value breaks. Preserved the preceding failed cycles; no frozen domain or model inputs changed.
- Existing product limitations remain recorded in `docs/limitations.md`. This is not a published release, a migration guarantee, or twenty successful business validations.

## v0.1.0-alpha - 2026-09-04

Initial open-source alpha for NiubiGEO.

Highlights:

- Self-hosted AI brand visibility audits.
- BYOK provider catalog for OpenRouter, OpenAI, Anthropic, Google Gemini, Perplexity, and DeepSeek.
- Audit plan confirmation before provider calls.
- Branded, discovery, comparison, and keyword-driven questions.
- Multi-model comparison through OpenRouter or direct provider keys.
- Human-readable brand competition reports with source and answer evidence.
- Confirmed competitors separated from possibly related brands.
- English and Simplified Chinese UI/report support.
- Docker and Node.js local startup paths.
- GitHub Container Registry image: `ghcr.io/albert-weasker/niubigeo:v0.1.0-alpha`.
