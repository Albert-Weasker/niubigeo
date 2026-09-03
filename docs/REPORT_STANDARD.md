# NiubiGEO Report Standard

This document defines the user-facing report contract for NiubiGEO Community Edition.

The report is not a data warehouse view. It is a concise AI brand competition report that a founder can understand in a few minutes.

## Required Questions

Every report must help the user answer:

1. Does AI know my brand?
2. How does AI understand and describe my brand?
3. Who are my confirmed competitors?
4. Why are those brands competitors?
5. Where are competitors more visible?
6. Where is my brand more visible?
7. Which user questions surface my brand?
8. Which user questions surface competitors but not my brand?
9. Which websites and pages shaped the answers?

## Required Sections

The main report must use this structure:

```text
Summary
How AI sees you
Who competes with you
Competitive differences
Sources
Collapsed AI answer evidence
```

For Simplified Chinese reports:

```text
总结
AI怎么看你
谁在和你竞争
竞争差异
来源
默认收起的AI实际回答
```

## Main Report Rules

- The summary must be one plain-language conclusion.
- The summary must not exceed 80 Chinese characters or 45 English words.
- "How AI sees you" must contain at most 3 conclusions.
- Confirmed competitors must be limited to 3.
- Each competitor explanation must be short and evidence-backed.
- Competitive differences must use neutral wording.
- The report must not use headings such as "who is better" or "who is winning."
- The main body before the answer drawer must stay under 800 Chinese characters or 450 English words.
- Every main conclusion must have at most one evidence link.
- The same prompt or conclusion must not be repeated across multiple sections.
- The main report must not copy long passages from raw AI answers.
- If evidence is insufficient, the report must say so directly.

## Competitor Confirmation

Only a competitor with all of the following evidence can be shown as confirmed:

- Clear brand or product name.
- Official homepage or clearly official domain.
- Clear product description.
- Appears in more than one meaningful natural discovery context or model result.

Everything else must be placed under "Possible related brands" or "疑似相关品牌".

The report must not merge these into a single competitor entity without evidence:

- A brand website.
- A GitHub repository with a similar name.
- A generic tool name mentioned in an article.
- A different company or product with a similar name.

## Source Relevance

Provider-returned citations are not automatically valid evidence.

Every source must be classified as:

- Related: directly supports the target brand, confirmed competitor, or a report conclusion.
- Possible: may relate to the topic or a mentioned brand, but may point to a same-name or unclear entity.
- Excluded: cannot be tied to the target, confirmed competitors, or the audited user question.

The main report must show only related sources.

"View all sources" must be collapsed by default and grouped into:

```text
Related sources
Possible sources
Excluded sources
```

Names that are merely similar to the target brand must not enter the main report unless supported by the answer or citation context.

## Evidence Links

Main report evidence links must use user-friendly labels:

- "View the supporting AI answer"
- "查看支持这一结论的AI回答"
- "View the supporting source answer"
- "查看支持这一来源的AI回答"

The main report must not expose internal answer labels such as "answer 3", "answer 14", or "related AI answers: 9, 14, 24".

The collapsed answer evidence must include:

- The actual question sent to the provider.
- The complete AI answer when available.
- Whether the target brand appeared.
- Which competitors appeared.
- Which sources were cited.
- Provider and model name.
- A clear API source label.

## Forbidden Main Report Content

The main report must not show:

- Mention rate.
- Citation rate.
- Recommendation rate.
- SOV or Share of Voice.
- Average rank.
- Prompt wins.
- Numerator and denominator metric tables.
- Token usage.
- API cost.
- Latency.
- Prompt ID.
- Run ID.
- Internal category fields.
- Provider annotation.
- Citation slice.
- Raw JSON.
- A "technical evidence" section.
- A black-box GEO score.

Internal metrics may still exist for analysis and quality checks, but they must be translated into clear business conclusions before entering the report.

## API Boundary

Every report must clearly state that:

- API provider results are API provider results.
- API results are not the same as consumer web UI results.
- Browser collection and human-verified regional monitoring are outside the Community Edition.
- Ordinary web search is not used as a substitute for AI provider citations.

## Quality Gate

A generated report fails if:

- It misses any required section.
- It cannot answer the required user questions.
- It exposes forbidden technical terms in the main report.
- It includes unsupported competitor claims.
- It treats possible or excluded sources as main evidence.
- It repeats the same conclusion across sections.
- It copies raw AI output into the main body.
- It lacks an API-vs-browser caveat.
- It lacks links to supporting AI answers or sources.
