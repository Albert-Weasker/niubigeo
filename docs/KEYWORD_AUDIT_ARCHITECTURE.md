# Keyword Audit Architecture

Keyword audit is the layer that prevents NiubiGEO from only asking about a raw domain.

The goal is to turn the target's SEO signals, GitHub context, and user-defined keywords into realistic customer questions, run those questions through real AI providers, and explain where the target brand appears or disappears.

## Core Principle

Keyword features count as AI visibility only after they produce real provider runs.

Allowed setup evidence:

- User-entered keywords.
- Site title and meta description.
- Meta keywords when present.
- Headings and important page copy.
- OpenGraph and Twitter metadata.
- JSON-LD name, description, sameAs, about, and keywords when present.
- Same-domain pages.
- GitHub README, description, topics, releases, and docs when provided.

Not allowed as AI visibility result:

- Ordinary web search results.
- SEO keyword suggestions that were never sent to AI providers.
- Mock keyword reports.
- Search volume as a substitute for AI answers.
- Site evidence treated as proof that AI knows the brand.

## Data Flow

```text
Domain input
-> Site and GitHub evidence collection
-> Keyword candidate generation
-> User keyword merge
-> Owned-site relevance scoring
-> Keyword prompt planning
-> User confirmation
-> Real provider audit
-> AI keyword association analysis
-> Human-readable report
```

## Module Responsibilities

### Site Evidence Collector

Collects public evidence from the submitted domain and optional GitHub repository.

Responsibilities:

- Preserve the submitted host first, including `www` when supplied.
- Extract owned-site SEO and product language.
- Keep source URL and evidence text for every extracted phrase.
- Treat site evidence as setup context, not AI visibility.

### Keyword Universe Builder

Creates the candidate keyword list.

Inputs:

- User keywords.
- Site evidence.
- GitHub evidence.
- Domain profile category.

Rules:

- User keywords come first.
- User keywords must never be silently dropped.
- Duplicate phrases should be merged without hiding source lineage.
- Broad generic words should not become standalone audit keywords.
- Every candidate keeps its source and language.

### Owned Relevance Scorer

Scores how strongly the target's own site supports each keyword.

This answers:

```text
Does the target site itself talk about this keyword?
```

It does not answer:

```text
Does AI associate this keyword with the target?
```

The report should not present owned relevance as AI visibility.

### Keyword Prompt Planner

Turns keywords into realistic monitoring questions.

Rules:

- Every enabled keyword should generate at least one natural discovery question.
- Most keyword questions should not include the target brand.
- Brand awareness questions may exist, but cannot dominate the plan.
- Prompt metadata must preserve keyword IDs and intent.

Example:

```text
Keyword: AI agent audit
Question: What are the best tools for auditing AI agent work?
Question: Which open-source tools help verify what an AI coding agent did?
Question: Compare tools for AI agent observability and audit trails.
```

### Audit Runner

The runner does not know keyword extraction internals.

It receives confirmed prompts and executes:

```text
keyword-backed question x provider x model
```

Every run stores provider, model, source label, execution prompt, answer text, citations, status, and error if failed.

### Keyword Association Analyzer

This layer answers:

```text
When the user asks about this keyword, does AI mention the target, competitors, both, or neither?
```

It should identify:

- Target appears.
- Competitors appear instead.
- Target appears with official source.
- Competitors appear with official source.
- Third-party sources influence the answer.
- Provider/model differences.

### Report Layer

Keyword results must become plain-language scenarios.

Good:

```text
When users ask about GitHub project promotion tools, AI mentions GitStar but does not mention NiubiStar.
```

Bad:

```text
keyword_category hit rate is 0%.
```

The main report should use keyword evidence to support:

- Where competitors appear more often.
- Where the target appears more often.
- Which important user questions do not surface the target.
- Which sources shaped those answers.

## User Controls

The audit confirmation screen must let the user:

- Add keywords.
- Disable keywords.
- Edit generated questions.
- Disable generated questions.
- Reclassify question type.
- Add or remove competitors.
- Select provider and model targets.
- Select report language.

## Required Outputs

Keyword audits should write:

- `keywords.csv`
- `prompts.csv`
- `citations.csv`
- `audit.json`
- `report.json`
- `report.md`
- `report.html`

These files are local user data. They should not be committed unless deliberately sanitized for a public sample.

## Acceptance Criteria

Keyword audit is valid only when:

1. User keywords appear in the confirmed audit plan.
2. Generated keyword questions are sent to real providers.
3. The report distinguishes owned-site relevance from AI association.
4. Competitor-only keyword scenarios are visible in plain language.
5. Every scenario links to supporting AI answers or sources.
6. No ordinary web search result is treated as provider citation evidence.
