# NiubiGEO Chart Meaning System

## Goal

Every chart must answer one user question before it displays data.

The reader should understand, without reading a methodology document:

1. What is being measured?
2. Under which questions, models, search settings, and time range?
3. What does each line represent?
4. What changed in actual answer counts?
5. What does an upward or downward movement mean?
6. Which answers prove the movement?

A chart that cannot answer these questions must not be rendered.

## Universal Chart Contract

Every chart receives one structured meaning model:

```ts
type ChartMeaning = {
  title: string;
  questionAnswered: string;
  plainLanguageConclusion: string | null;
  scope: {
    baselineName: string;
    promptCount: number;
    modelCount: number;
    providerLabel: string;
    searchLabel: string;
    timeRangeLabel: string;
  };
  series: Array<{
    id: string;
    label: string;
    plainMeaning: string;
    numeratorMeaning: string;
    denominatorMeaning: string;
    riseMeaning: string;
    fallMeaning: string;
    currentNumerator: number;
    currentDenominator: number;
    previousNumerator: number | null;
    previousDenominator: number | null;
    evidenceAvailable: boolean;
  }>;
  limitations: string[];
};
```

This model is generated from metric definitions and verified run data. It does not inspect question text, infer meaning with regular expressions, or branch by brand, industry, language, or test object.

## Required Visual Order

Every chart uses the same reading order:

```text
Plain-language conclusion
Question answered by this chart
Scope and comparison conditions
Metric meaning controls
Chart with direct series labels
Evidence-backed change summary
Collapsed limitations
```

The graph is never the first unexplained element.

## Example: Brand Answer Changes

The current generic title `Visibility Trend` is replaced by a conclusion derived from the latest comparable pair:

```text
AI is thinking of your brand more often, while official-site citations decreased.
```

Supporting question:

```text
Under the same questions and models, how did AI answers about your brand change?
```

Scope:

```text
Same baseline · 8 questions · 4 models · Provider API · Native search
```

Each metric is written in user language:

| User-facing label | What it means | Upward movement means |
| --- | --- | --- |
| AI thought of you | The question did not name the brand, but the answer mentioned it | More equivalent answers spontaneously included the brand |
| Listed as an option | AI put the brand in a set the user could consider | More decision answers included the brand as a candidate |
| Explicitly recommended | AI advised the user to consider or choose the brand | More decision answers actively recommended the brand |
| Your website was used | A successful connected answer cited the official domain | More connected answers used the official website as a source |

The denominator is shown beside every value because the four metrics do not share one denominator.

## Choose The Correct Chart For The Number Of Periods

### Zero Valid Periods

Do not render a chart. Explain which requirement is missing.

### One Valid Period

Show a baseline summary, not a line:

```text
First comparable observation established
AI thought of you in 6 of 20 natural answers.
Run the same baseline again to measure change.
```

### Exactly Two Valid Periods

Use a before-and-after slope chart, not a time-series chart.

```text
Previous run                         Current run
AI thought of you       6 / 20  ->   8 / 20   +2 answers
Listed as an option     3 / 24  ->   4 / 24   +1 answer
Explicitly recommended  3 / 12  ->   2 / 12   -1 answer
Your website was used  21 / 32  ->  20 / 32   -1 answer
```

The line exists only to connect the two labeled values. The count change is the primary message; percentage is secondary.

### Three Or More Valid Periods

Use a time-series line chart. Every point represents one complete, comparable run. Long-range views retain only the final complete run for each natural day.

## Direct Labels, Not Color-Only Legends

Every visible line is labeled at its latest endpoint:

```text
AI thought of you · 8 / 20 · +2
Listed as an option · 4 / 24 · +1
Explicitly recommended · 2 / 12 · -1
Your website was used · 20 / 32 · -1
```

Rules:

- Do not require the user to match a color at the bottom of the chart.
- Keep color as a secondary recognition aid.
- Reserve a fixed right-side label rail and use short leader lines when labels would overlap.
- On mobile, place the same labels directly below the chart in visual line order.
- Selecting a label emphasizes its line and dims the other series.
- Labels always include numerator and denominator.

## Metric Meaning Controls

Above the plot, each series has a compact selectable definition:

```text
AI thought of you
The brand appeared even though the question did not name it.
6 / 20 -> 8 / 20
```

These controls replace bare checkboxes. They act as both explanation and line visibility controls.

The full formula remains available in a nearby information disclosure, but a user does not need the formula to understand the chart.

## Evidence Interaction

Hover or keyboard focus on any point shows:

```text
September 11 · AI thought of you
8 of 20 natural answers
2 more answers than the previous comparable run
```

Selecting the point opens evidence grouped as:

```text
Newly appeared
Still appeared
Disappeared this time
```

Each row shows the question, model, search state, and an action to open the complete answer. A line without point-level evidence is not drawable.

## Automatic Plain-Language Conclusion

The sentence above a chart is produced deterministically from structured changes:

- Identify the largest absolute change in answer count.
- Mention at most two material changes.
- Use actual counts, not a black-box score.
- Say `unchanged` when the numerator is unchanged under the same denominator.
- Say `not comparable` when the evidence sets differ.
- Never claim market share, causality, long-term improvement, or consumer web results.

Example:

```text
AI thought of your brand in 2 more answers, while one fewer answer cited your website.
```

## Per-Chart Product Rules

### Metric History

Question answered: how did one brand outcome change under the same baseline?

Default: show one selected metric. Users can add up to three more metrics. Every visible line keeps its direct endpoint label and its own denominator.

### Brand Comparison

Question answered: for one selected metric, how did the target and confirmed competitors compare over time?

Only one metric is allowed. The target line is visually emphasized. Competitors have direct endpoint labels. Pending entities, channels, methods, and sources are excluded.

### Metric Card Sparkline

A sparkline is allowed only with at least three comparable periods. With two periods, show a count delta such as `+2 answers`; with one period, show `First observation`. A sparkline must have an accessible label describing its metric and period.

### Citation Distribution

Question answered: which source categories support the observed answers?

Each segment carries its category name and answer count. Color alone is insufficient. Selecting a segment opens the source and answer breakdown.

### Source Ranking

Question answered: which domains or pages were actually cited most often in the selected scope?

Use bars only when length supports comparison. Show the exact answer count at the bar end and disclose that one answer can cite multiple pages.

## Empty And Invalid States

Charts are replaced by compact explanations when:

- fewer than two comparable periods exist;
- all completed runs occur on one day in a long-range view;
- the latest run is partial or analysis-incomplete;
- baseline, model, language, search mode, or Observation identity changed;
- a metric has no eligible denominator;
- evidence differences are unavailable.

Missing data is not zero. Partial runs do not create downward lines.

## Acceptance Test

For every chart, a person unfamiliar with GEO must answer these questions within five seconds:

1. What question does this chart answer?
2. What does each visible line mean?
3. What changed in real answer counts?
4. Is the comparison valid?
5. Where can the supporting answers be opened?

Failure of any answer means the chart design is incomplete.

Additional hard requirements:

- no generic line named only `visibility`;
- no unexplained color legend;
- no percentage without its numerator and denominator;
- no line without direct labeling and evidence;
- no two-point time-series chart when a slope comparison is clearer;
- no chart rendered only to fill space;
- no product-specific, brand-specific, language-keyword, or scenario-specific branch;
- no regular expressions.

