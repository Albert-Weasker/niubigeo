# NiubiGEO Workbench V2 Product and Technical Architecture

## 1. Objective

NiubiGEO is not a collection of database tables and charts. It is a monitoring product that must let a user understand, within ten seconds:

1. what changed;
2. why it matters;
3. which questions, models, answers, and sources support the conclusion;
4. whether the current run can be compared with an earlier run;
5. what will run next.

The core product path is:

```text
Project
-> Monitoring baseline
-> Monitoring task
-> Real Provider execution
-> Observation
-> Comparable period
-> Evidence-backed change
-> Product insight
-> Evidence drill-down
```

The existing `AuditRunner` remains the single-run Provider execution engine. Workbench V2 adds stable monitoring, comparison, semantic entity resolution, insight selection, and user-facing read models around it.

## 2. Non-negotiable constraints

### 2.1 No regular expressions

The repository target is zero regular-expression syntax in `src/` and `test/`. Existing use must be removed before Workbench V2 feature implementation continues; the rule is not limited to newly written files.

This includes:

- no regular-expression literals;
- no `RegExp` construction;
- no text classification through pattern matching;
- no regular-expression use in string replacement, matching, or search;
- no regular-expression-based URL, domain, model, locale, brand, or schedule parsing.

Use structured mechanisms instead:

- `URL` and `URLSearchParams` for URLs;
- JSON parsing plus schema validation for model output;
- `cron-parser` for custom schedules;
- `Intl` and timezone-aware date libraries for time presentation and bucketing;
- typed Provider capability declarations for protocol selection;
- AI-produced structured intent and entity analysis for semantic decisions.

An AST-based repository check must reject prohibited regular-expression syntax before merge. The check must inspect syntax, not search source text using another regular expression.

The repository now enforces this boundary with a TypeScript AST test over `src/`, `test/`, and the generated browser script. The current scan returns zero regular-expression syntax nodes. Any later literal or `RegExp` construction fails `npm run self-check`.

### 2.2 No scenario-specific configuration

The product must not contain branches or dictionaries dedicated to:

- NiubiStar, NiubiGEO, or another test brand;
- a specific industry;
- a specific user question;
- Chinese, English, or another language;
- recommendation, pricing, tutorial, or another individual scenario;
- an individual Provider outside its protocol adapter.

Semantic behavior comes from typed AI analysis. Business code consumes structured facts and evidence references. It must not infer intent, competitors, channels, or recommendations from words in free text.

Provider adapters are protocol boundaries, not scenario rules. A Provider is selected through declared capabilities such as Responses, Messages, generateContent, native search, and citation support. Product services do not branch on a brand or prompt.

### 2.3 Evidence before presentation

Every visible conclusion must reference one or more persisted observations. A conclusion about a new source must also reference a citation URL returned by the Provider. A competitor conclusion must reference a resolved entity and the observations that established its relationship.

If evidence is incomplete, the UI displays an explicit insufficient-data state. It does not manufacture a chart, change value, competitor, or recommendation.

## 3. Product information architecture

```text
Projects
└── Project
    ├── Overview
    ├── Questions
    ├── Visibility
    ├── Competitors
    ├── Citations
    ├── Monitoring
    ├── Runs
    ├── Providers
    └── Settings
```

The single-run report remains available from Runs as a snapshot and export. It is not the primary workspace.

### 3.1 Overview

Overview answers only five questions:

1. What are the three most important changes?
2. What happened to brand discovery, candidate inclusion, explicit recommendation, and official citation?
3. Which monitored questions changed?
4. Which confirmed competitor replaced the target most often?
5. When will the next monitoring task run, and did the last run finish?

The first module is `本期最值得关注的 3 件事`. Each item contains:

```text
Conclusion
Why it matters
Scope and comparison status
One action that opens the supporting evidence
```

Examples are presentation shapes, not fixed copy or rules:

```text
The brand disappeared from three previously visible questions.
The changes occurred in two models.
[View changed questions]
```

Overview must not contain a full competitor ranking or a duplicate trend page. It may show one confirmed replacement insight with a link to Competitors.

### 3.2 Core result cards

Cards show counts first:

```text
Brand discovery       6 / 16
Candidate inclusion   5 / 16
Explicit recommendation 2 / 16
Official citation     4 / 20
```

Each card also contains:

- the observation scope;
- comparison eligibility;
- the previous comparable value only when one exists;
- a small sparkline only when a valid time series exists;
- a link to the observations that form the numerator and denominator.

If the latest run is partial, the card says that change is unavailable. It must not show a misleading positive or negative delta.

### 3.3 Visibility

Visibility is the detailed time-analysis page. It must not repeat Overview.

It provides two mutually exclusive modes:

```text
Metric trend
Brand comparison
```

Metric trend compares up to four target-brand metrics. Brand comparison selects one metric and compares the target with confirmed competitors.

Available time ranges:

```text
24 hours
7 days
30 days
90 days
All
```

Filters include model and actual search execution mode. Every chart point opens an evidence drawer.

When valid time-series conditions are not met, the chart is replaced by a specific empty state. A chart container is never filled for decoration.

### 3.4 Competitors

Entities are separated into five product groups:

```text
Confirmed competitors
Suspected brands
Alternative methods
Promotion channels
Unresolved entities
```

Only confirmed competitors enter rankings and brand-comparison charts. A confirmed competitor requires an identified product, a canonical reachable domain, a semantic substitute or competition relationship, and evidence references.

Names that co-occur in an answer are not competitors by default. Concepts such as social promotion, paid promotion, and community groups are classified by their relationship, not displayed as brands.

The competitor detail view answers:

- why this is a competitor;
- where it appears while the target does not;
- where the target appears while it does not;
- how AI describes their relationship;
- which sources support the claims;
- which raw answers contain the evidence.

### 3.5 Citations

Citations are grouped by semantic role:

```text
Owned website
Competitor website
Community
Media
Product directory
Social platform
Other
```

Classification is produced as structured analysis and verified against Provider citations. The UI shows citation count, covered questions, time scope, change when comparable, and evidence links.

### 3.6 Monitoring task center

Monitoring is a task center, not a Cron form.

It supports multiple tasks per project. Each task card shows:

- user-facing task name and status;
- selected prompt count and model count;
- actual search policy;
- schedule and timezone;
- next run;
- latest run result;
- expected request count;
- actions for run, results, edit, pause, resume, duplicate, rebuild baseline, and delete.

Task creation uses a right-side drawer with four steps:

1. select prompts and models;
2. select daily, weekly, monthly, or custom frequency;
3. select search behavior and review request estimate;
4. configure notification rules and channels.

Cron appears only for custom frequency. The server returns the next three calculated executions for preview.

Changes to schedule, timezone, notifications, and enabled state do not create a baseline. Changes to prompts, models, search policy, language, region, brand scope, or competitor scope create a new immutable baseline.

## 4. Server-side read-model architecture

The browser must not calculate business metrics, trend eligibility, competitors, or change values. It renders server-produced read models.

```text
Write models
Project / Baseline / MonitoringTask / Run / Observation
                         |
                         v
Domain analysis services
Metric / Period / Change / Entity / Insight / Evidence
                         |
                         v
Product read models
Overview / Visibility / Competitors / Citations / Tasks / Run snapshot
                         |
                         v
Localized presenter
                         |
                         v
UI
```

This avoids calculating the same concept differently in the overview, chart, report, and export.

### 4.1 Proposed module ownership

```text
src/metrics/
  metric-schema.ts
  metric-catalog.ts
  metric-calculator.ts

src/timeseries/
  period-schema.ts
  comparable-period-selector.ts
  time-bucket-service.ts
  series-builder.ts
  trend-eligibility.ts

src/changes/
  change-schema.ts
  observation-diff.ts
  change-builder.ts
  evidence-linker.ts

src/entities/
  entity-schema.ts
  entity-resolution-service.ts
  identity-verifier.ts
  entity-registry.ts
  entity-review-service.ts

src/attention/
  attention-schema.ts
  attention-candidate-builder.ts
  attention-ranker.ts
  attention-presenter.ts

src/notifications/
  notification-schema.ts
  notification-event-builder.ts
  notification-rule-engine.ts
  notification-dispatcher.ts
  adapters/

src/read-models/
  overview-read-model.ts
  visibility-read-model.ts
  competitor-read-model.ts
  citation-read-model.ts
  monitoring-read-model.ts
  evidence-read-model.ts

src/presentation/
  product-labels.ts
  model-name-presenter.ts
  schedule-presenter.ts
  localized-copy.ts
```

Existing modules remain responsible for their current boundaries:

```text
AuditRunner             real Provider execution
IntentResultLayer       structured intent, tasks, assessment, relationships
ObservationBuilder      immutable evidence unit
BaselineComparator      configuration comparability
ProjectFileStore        persistence boundary
```

The new modules replace UI-side aggregation and enrich the current string-only change and competitor summaries.

## 5. Core contracts

### 5.1 Metric result

```ts
interface MetricResult {
  metricId: MetricId;
  numerator: number;
  denominator: number;
  value: number | null;
  observationIds: string[];
  excludedObservationIds: string[];
  scope: ObservationScope;
}
```

`value` is `null` when no valid denominator exists. It is `0` only when a valid denominator exists and the numerator is zero.

### 5.2 Comparable period

```ts
interface ComparablePeriod {
  projectId: string;
  baselineId: string;
  timezone: string;
  range: TimeRange;
  selectedRunIds: string[];
  excludedRuns: ExcludedRun[];
  complete: boolean;
}
```

Excluded runs retain a machine-readable reason such as partial execution, baseline mismatch, missing completion time, or duplicate same-day run.

### 5.3 Time-series point

```ts
interface TimeSeriesPoint {
  runId: string;
  bucketStart: string;
  observedAt: string;
  result: MetricResult;
  previousComparableRunId?: string;
}
```

### 5.4 Evidence-backed change

```ts
interface ObservationChange {
  id: string;
  kind: ChangeKind;
  currentRunId: string;
  previousRunId: string;
  currentObservationIds: string[];
  previousObservationIds: string[];
  promptIds: string[];
  modelIds: string[];
  entityIds: string[];
  citationUrls: string[];
  confidence: Confidence;
}
```

Change objects store evidence references, not only prompt strings. This enables current and previous answers to be opened side by side.

### 5.5 Attention item

```ts
interface AttentionItem {
  id: string;
  priority: "critical" | "high" | "normal";
  title: string;
  whyItMatters: string;
  scopeLabel: string;
  changeId: string;
  evidenceCount: number;
  action: EvidenceAction;
}
```

Attention candidates are built only from structured changes. A language model may compress wording, but it receives immutable claim IDs and may not add a fact, entity, source, or reason that is absent from those claims.

### 5.6 Entity resolution

```ts
interface EntityResolution {
  id: string;
  canonicalName: string;
  canonicalDomain?: string;
  entityType: EntityType;
  relationshipToTarget: EntityRelationshipType;
  identityStatus: "confirmed" | "suspected" | "unresolved";
  confidence: Confidence;
  observationIds: string[];
  sourceUrls: string[];
  explanation: string;
}
```

The AI proposes the identity and relationship. Local code verifies:

- referenced observation IDs exist;
- quoted evidence belongs to those observations;
- source URLs exist in Provider citations or verified owned-site evidence;
- the canonical URL is valid through the platform URL parser;
- the domain can be fetched when confirmation requires a reachable product site;
- target and competitor identities do not resolve to the same canonical entity.

Local code does not promote an entity based on word frequency, capitalization, name similarity, or co-occurrence.

## 6. Metric definitions

Metrics consume typed observation fields and structured intent analysis. They do not inspect free text.

### Brand discovery

```text
Numerator: successful organic-discovery observations where the target appears
Denominator: successful organic-discovery observations
```

### Candidate inclusion

```text
Numerator: successful decision observations where the target is a recommended,
compared, or alternative option
Denominator: successful decision observations
```

The decision scope comes from stored Intent Result Layer output, not from keyword matching.

### Explicit recommendation

```text
Numerator: successful decision observations with an evidence-backed target recommendation
Denominator: successful decision observations
```

### Official citation

```text
Numerator: successful observations using actual web search that cite the owned domain
Denominator: successful observations using actual web search
```

Every result stores its observation IDs so the UI can show both matching and non-matching answers.

## 7. Trend eligibility and bucketing

A series may be drawn only when all points share:

- project;
- comparable baseline;
- metric definition version;
- observation scope;
- filter set;
- complete execution status.

Additional rules:

1. A line requires at least two valid time points.
2. The 24-hour view uses run timestamps.
3. Longer views use the last complete run for each baseline and local calendar day.
4. Earlier same-day runs remain in Runs but do not enter the long-range series.
5. Partial and failed runs never enter a series.
6. A baseline transition creates a visible break and does not connect the lines.
7. Missing denominator produces a missing point, not zero.

The trend eligibility response includes a user-facing state:

```text
first_observation
same_day_only
partial_run
baseline_changed
ready
```

These are presentation states, not text-search scenarios. They are derived from typed run and baseline records.

## 8. Change and attention pipeline

```text
ComparablePeriodSelector
-> ObservationDiff
-> ChangeBuilder
-> EvidenceLinker
-> AttentionCandidateBuilder
-> AttentionRanker
-> LocalizedPresenter
```

The ranker uses structured impact features:

- number of affected prompts;
- number of affected models;
- discovery, recommendation, or citation consequence;
- persistence across valid periods;
- confidence and evidence completeness.

It does not use a brand-specific rule. The top three non-duplicate changes appear on Overview. Duplicates are detected by shared change IDs and evidence sets, not by comparing prose.

## 9. Monitoring task architecture

The current task schema must be extended instead of pushing more fields into the UI.

```ts
interface MonitoringTaskDefinition {
  id: string;
  projectId: string;
  name: string;
  baselineId: string;
  schedule: MonitoringSchedule;
  searchPolicy: SearchPolicy;
  notificationPolicy: NotificationPolicy;
  status: "active" | "paused";
  lastRunId?: string;
  nextRunAt?: string;
}
```

Schedule kinds become:

```text
manual
daily
weekly
monthly
custom
```

`custom` stores a Cron expression and is parsed only by `cron-parser`. Daily, weekly, and monthly schedules use typed fields and timezone-aware calculation.

Search policy records the requested mode and the actual Provider execution separately. The system never silently changes native search to another method. A general-search fallback can only be enabled when a real `SearchProvider` is configured, and its output is labeled as general search rather than Provider-native citations.

Notifications require persisted events and idempotent deliveries:

```text
Run completed
Run failed
Brand disappeared
New confirmed competitor
New official citation
Recommendation changed
```

Adapters deliver the same typed event to email, webhook, Slack or Discord, and enterprise messaging integrations. Channel-specific code cannot redefine the event meaning.

## 10. API design

Read APIs return product models, not raw storage records:

```text
GET /projects/:projectId/overview
GET /projects/:projectId/visibility/series
GET /projects/:projectId/changes/:changeId
GET /projects/:projectId/evidence
GET /projects/:projectId/entities
GET /projects/:projectId/citations

GET    /projects/:projectId/tasks
POST   /projects/:projectId/tasks
GET    /projects/:projectId/tasks/:taskId
PATCH  /projects/:projectId/tasks/:taskId
DELETE /projects/:projectId/tasks/:taskId
POST   /projects/:projectId/tasks/:taskId/run
POST   /projects/:projectId/tasks/:taskId/pause
POST   /projects/:projectId/tasks/:taskId/resume
POST   /projects/:projectId/tasks/:taskId/duplicate
GET    /projects/:projectId/tasks/:taskId/runs
POST   /projects/:projectId/schedules/preview
```

Mutation services decide whether an edit keeps the baseline or creates a new one. The browser cannot choose this itself.

## 11. Presentation boundary

Raw values such as baseline IDs, internal enums, and full routed model paths stay out of normal workspace pages.

The presenter converts them into product language:

```text
active                         -> Running
organic_discovery              -> Natural discovery
low                            -> Low confidence
anthropic/claude-haiku-4.5     -> Claude Haiku 4.5 via OpenRouter
```

Labels come from localization resources keyed by typed values. They are not generated through language-specific text parsing.

The source boundary appears once as a compact `Provider API` label with an explanation available on demand. It is not repeated on every page.

## 12. Evidence drill-down

Every high-level path ends at observations:

```text
Attention item
-> changed prompts
-> current and previous observations
-> model and actual search method
-> citations
-> full AI answers
```

The evidence drawer supports:

- current and previous answer side by side;
- prompt and model filters;
- target and competitor relationships;
- Provider-returned sources;
- missing and failed observations;
- link to the run snapshot.

The drawer does not recalculate the conclusion. It displays the exact evidence IDs attached by the server.

## 13. Current implementation state

The implementation now includes:

- repository-wide AST enforcement for zero regular expressions and production-source checks for retired semantic classifiers and test-target branches;
- Provider-produced keyword relevance, Prompt semantics, intent, answer-task assessment, entity identity, entity relationship, and adapted question results;
- metric-specific denominators, null values for missing samples, complete-run selection, same-day long-range deduplication, baseline breaks, and evidence-backed change records;
- confirmed competitor, suspected brand, alternative method, promotion channel, source, and unresolved entity groups;
- a server-produced Workbench read model with one filtered scope shared by metrics, questions, entities, citations, changes, and evidence;
- a multi-task monitoring center with daily, weekly, monthly, and custom schedules, timezone preview, run-now, pause, resume, edit, duplicate, and delete;
- immutable baseline derivation when questions, models, search settings, language, run count, target, or competitor scope changes;
- persisted monitoring events and idempotent email, generic Webhook, Slack, Discord, WeCom, and Lark delivery adapters;
- a restrained dark Overview, Questions, Visibility, Competitors, Citations, Monitoring, Runs, Providers, and Settings workspace.

Remaining verification work is external rather than a license to invent data:

- run a fresh real multi-model Provider monitoring cycle when the configured account has credit;
- complete desktop and mobile visual QA when a controllable browser session is available;
- verify notification delivery against user-owned SMTP and Webhook endpoints before describing those external channels as operational in a deployment.

## 14. Implementation tasks

### Phase 0: architecture enforcement

1. Add an AST-based no-regular-expression check.
2. Inventory all existing findings by module and replace every one with structured parsing or AI-produced semantics.
3. Make zero findings mandatory for `src/` and `test/` before merge.
4. Add an architecture test that rejects brand, industry, locale, and test-question branches in semantic modules.
5. Document allowed structured parsers and Provider adapter boundaries.

### Phase 1: metric and period truth

1. Add metric contracts and a versioned metric catalog.
2. Implement metric-specific scopes and denominators from typed observations.
3. Implement `null` versus real zero.
4. Implement complete-run and comparable-period selection.
5. Implement 24-hour timestamps and last-complete-run-per-day bucketing.
6. Add trend eligibility states and baseline breaks.

### Phase 2: evidence-backed changes

1. Replace string-only change summaries with observation-level diffs.
2. Link current and previous observations by prompt, model, and sample.
3. Record changed competitors, citations, recommendations, and model outcomes.
4. Build evidence endpoints and the side-by-side evidence read model.

### Phase 3: entity truth

1. Add AI-driven entity identity and relationship analysis schemas.
2. Add canonical entity registry and review states.
3. Verify source membership, URL validity, and site reachability.
4. Separate confirmed competitors, suspected brands, methods, channels, and unresolved entities.
5. Prevent unresolved entities from entering rankings and comparison charts.

### Phase 4: attention engine

1. Generate attention candidates only from structured changes.
2. Rank impact and evidence completeness.
3. Select at most three non-duplicate Overview items.
4. Produce localized, concise copy without adding facts.

### Phase 5: monitoring task center backend

1. Extend task, schedule, search, and notification schemas.
2. Add monthly and custom schedule preview.
3. Add task CRUD, pause, resume, duplicate, run-now, and task-run APIs.
4. Implement baseline transition rules for edits.
5. Add notification events, rules, delivery adapters, retries, and idempotency.

### Phase 6: product read models

1. Add Overview, Visibility, Competitor, Citation, Monitoring, and Evidence read models.
2. Move all metric and trend calculations out of browser code.
3. Add localized presenters for model, schedule, enum, confidence, and status labels.
4. Keep internal IDs in run details only.

### Phase 7: UI closed loop

1. Rebuild Overview around the top three changes and five required modules.
2. Make Visibility a real time-series and comparison workspace.
3. Rebuild Competitors around resolved entity groups.
4. Rebuild Citations around role, scope, and evidence.
5. Rebuild Monitoring as a multi-task center and creation drawer.
6. Add evidence drill-down from every conclusion and data point.
7. Preserve the dark enterprise design system without using decorative charts.

### Phase 8: migration and verification

1. Import historical runs without inventing missing semantic fields.
2. Mark incomplete legacy records as snapshot-only.
3. Add invariant tests across varied brands, industries, languages, and question intents without product branches for those samples.
4. Test partial runs, same-day runs, baseline changes, missing denominators, entity ambiguity, and notification retries.
5. Run real multi-model OpenRouter monitoring after account credit is available.
6. Verify desktop and mobile layouts with browser screenshots and interaction checks.

## 15. Acceptance criteria

Workbench V2 is complete only when all of the following are true:

1. A user can identify the most important current change within ten seconds.
2. Every change opens the exact current and previous observations that support it.
3. Partial or non-comparable runs never produce a delta.
4. A chart is not rendered without a valid time series.
5. Each metric has its own typed scope and denominator.
6. Missing data is not displayed as zero.
7. Same-day long-range runs are deduplicated according to the documented rule.
8. Baseline changes create a break rather than a connected trend.
9. Only confirmed competitor entities enter rankings.
10. Brands, methods, channels, and unresolved entities remain separate.
11. Monitoring supports multiple understandable tasks without exposing Cron by default.
12. Task edits create or preserve baselines according to the server-side policy.
13. Overview and Visibility have distinct jobs and do not duplicate each other.
14. Normal pages do not expose raw IDs, internal enums, or full routed model paths.
15. No semantic decision depends on free-text pattern matching.
16. No implementation contains regular expressions or target-specific scenario configuration.
17. Real Provider execution remains the only source of AI visibility observations.
