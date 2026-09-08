# NiubiGEO Long-Term Monitoring Architecture

NiubiGEO is moving from isolated audit reports to a long-running monitoring platform.

The existing audit flow stays intact:

```text
domain -> confirmed audit plan -> provider calls -> AI answers -> citations -> single-run report
```

The new layer sits around that flow:

```text
Project -> Baseline -> Monitoring Task -> Run -> Observation -> Insight
```

## Core Objects

### Project

A persistent brand or product being monitored.

It owns the target entity, aliases, domain, GitHub repo, competitors, default language, baselines, runs, and observations.

### Baseline

A repeatable monitoring configuration.

It includes:

- prompt set;
- Provider and model list;
- web-search settings;
- language;
- prompt-set version;
- analysis-rules version;
- run count per prompt.

Only runs with the same comparable baseline key can be trended together.

### Run

One execution of a baseline.

It records success and failure counts and links back to the generated single-run report.

Provider completeness and analysis completeness are separate contracts:

```text
Provider complete -> every planned request returned a usable answer
Analysis complete -> every usable answer passed the current observation analysis contract
Current data run  -> both contracts are complete under the active baseline
```

A legacy run can remain a valid execution snapshot without qualifying as current dashboard data.

### Observation

The smallest evidence unit:

```text
one prompt x one Provider x one model x one run
```

Every metric, trend, citation insight, competitor insight, and readable conclusion must be recomputable from observations.

### Report

Reports still exist, but their role changes.

They are now run snapshots or export artifacts, not the primary product object.

## Comparability Rules

Trend comparison is allowed only when all of these match:

- project;
- prompt set;
- Provider and model set;
- web-search settings;
- language;
- prompt-set version;
- analysis-rules version;
- run count per prompt.

If any condition differs, the run remains a historical snapshot and must not be connected to a trend line.

Every enabled question must also have a completed pre-run `PromptIntentProfile`. That profile fixes candidate and recommendation applicability before the first answer is requested and is included in the baseline comparable key.

## Analysis Qualification

Each completed answer records:

- `analysisVersion`;
- `analysisStatus`;
- question intents from the immutable prompt profile;
- brand mention result;
- candidate result;
- recommendation result;
- entity-analysis completion;
- citation-analysis completion.

Candidate and recommendation results are tri-state:

```text
true or false   -> applicable question with a completed judgment
not_applicable  -> question is outside that metric's fixed denominator
null            -> missing or incomplete analysis
```

`null` is never converted to `false`. A run qualifies as current data only when every answered observation uses the current analysis version, every required judgment is accounted for, and the critical-null count is zero. Old runs can be reanalyzed from saved answers only when their baseline already contains the stable question intent profile; otherwise the user first derives a new classified baseline.

## File Storage Layout

The Community Edition can stay file-based while keeping clean database boundaries:

```text
data/
  projects/
    project-id/
      project.json
      baselines/
        baseline-id.json
      tasks/
        task-id.json
      events/
        event-id.json
      runs/
        run-id/
          run.json
          observations.jsonl
```

The store API should isolate the rest of the code from this layout so a PostgreSQL store can replace it later.

## Project Isolation

One project binds exactly one primary domain. Its baselines, tasks, runs, observations, events, dashboard data, competitors, and citations all carry the same `projectId`.

Isolation is enforced at three boundaries:

1. `ProjectFileStore` validates ownership before every write and after every read.
2. Project dashboard, insight, run snapshot, metric, and time-series builders scope their inputs by `projectId` even when a caller accidentally supplies mixed arrays.
3. HTTP project routes load every resource through a project-scoped store method.

Changing a project's primary domain in place is rejected. A different domain must be created as a different project.

Regression fixtures are not product projects. Automated and real-Provider suites use temporary project storage and `validation/.../runs` output. Their data must never be imported into `data/projects`, included in a project dashboard, or used in trends.

## Implementation Boundary

`AuditRunner` remains the real Provider execution engine.

The monitoring layer calls `AuditRunner`, materializes its `AuditRun` into project records, then builds dashboard and trend models from observations.

UI migration comes later.

## Backend Modules

The first backend implementation is split by ownership:

```text
src/projects/       project identity, file store, legacy import
src/baselines/      repeatable conditions and comparability
src/monitoring/     schedules, tasks, due execution, run orchestration
src/observations/   one persisted record per provider answer
src/insights/       trend, competitor, citation, and intent aggregation
src/dashboard/      project, run-snapshot, and export models
```

`ProjectFileStore` implements the `ProjectStore`, `BaselineStore`, `MonitoringTaskStore`, `RunStore`, and `ObservationStore` contracts. Business services depend on those contracts rather than on file paths.

## Run Lifecycle

The orchestrator persists a run before calling the audit engine:

```text
running -> completed
running -> partial
running -> failed
```

An engine-level failure therefore remains visible in project history. Provider-level failures remain individual failed observations inside a completed or partial run.

If `runCountPerPrompt` is greater than one, the execution engine creates independent samples. Each sample becomes its own observation and keeps its sample index.

## Scheduling

Monitoring tasks support:

- manual execution;
- daily schedules;
- weekly schedules;
- cron expressions;
- monthly schedules;
- IANA timezones;
- due-task execution;
- persisted last run, last attempt, next run, and last error.

The application can run due tasks from an external process scheduler:

```bash
npm run monitor:due
npm run monitor:worker -- --poll-seconds 60
```

This keeps the Community Edition process model simple. Docker, systemd, GitHub Actions, or another scheduler can invoke the command at a suitable interval.

The Docker Compose configuration runs the web process and monitoring worker separately. Both share the same project data volume. A persisted task lease prevents the two processes from executing the same task at the same time.

Task content is immutable through its baseline. Changing questions, models, search policy, language, execution count, target, or competitor scope derives a new baseline. Changing only schedule, timezone, enabled state, or notification policy keeps the existing baseline.

Monitoring events are persisted even when no external channel is configured. Email uses `SMTP_URL` and `SMTP_FROM`; Webhook, Slack, Discord, WeCom, and Lark use their HTTP endpoints. Event IDs are deterministic per task, run, and condition so a retry does not redeliver a channel that already succeeded.

## CLI Entry Points

```bash
npm run import-runs
npm run projects
npm run monitor:create -- --project PROJECT_ID --baseline BASELINE_ID --schedule daily --timezone Asia/Shanghai --hour 9
npm run monitor:run -- --project PROJECT_ID --task TASK_ID
npm run monitor:due
```

Normal CLI audits are also materialized into the project store after the real Provider run succeeds.

## HTTP API

The backend exposes project data without changing the current UI:

```text
GET  /projects
POST /projects
POST /projects/import-runs
GET  /projects/:projectId
GET  /projects/:projectId/baselines
GET  /projects/:projectId/tasks
GET  /projects/:projectId/runs
GET  /projects/:projectId/observations
POST /projects/:projectId/tasks
POST /projects/:projectId/baselines/:baselineId/run
POST /projects/:projectId/tasks/:taskId/run
POST /monitoring/run-due
```

`POST /audits` now enters the monitored Project/Baseline/Run path when it receives a confirmed plan. The existing single-run report remains available at `/reports/:runId`.

## Current Verification Boundary

Unit and integration tests cover storage, migration, scheduling, failed-run persistence, repeat samples, comparability, trend isolation, competitor entity boundaries, citation aggregation, intent outcomes, snapshots, exports, and dashboard persistence.

Real OpenRouter validation is a separate gate because it requires account credit. It must be run after the key has available balance; local passing tests do not claim that an external Provider request succeeded.

## Trend Evidence Contract

A trend line is an evidence comparison, not a decorative visibility score. A point belongs to one complete run, and adjacent points can be connected only when they share the same project, immutable baseline, metric, and eligible observation identities.

Observation identity is the structured tuple:

```text
promptId + providerId + model + sampleIndex
```

Matching denominator counts alone are insufficient. If the identity sets differ, the point remains visible as a run result but the system does not claim a comparable change.

For every comparable point after the first, `MetricEvidenceDiff` records:

- answers that newly satisfy the metric in the current run;
- answers that satisfy it in both runs, paired across current and previous observations;
- answers that satisfied it previously but no longer do.

The four lines have separate meanings and denominators:

- brand discovery: whether unbranded discovery answers mention the target;
- candidate inclusion: whether eligible decision answers list the target as an option;
- explicit recommendation: whether eligible recommendation answers explicitly recommend the target;
- official citation: whether successful search-enabled answers cite the target domain.

The UI derives plain-language change statements from numerator changes and opens the exact added, persistent, and removed answers from each point. It must not describe run-to-run differences as market share, consumer-product behavior, a long-term trend, or proof that an optimization caused the change.

The same gate applies to every rendered line, including target metric charts, competitor comparison lines, and metric-card sparklines. No chart component may infer drawability from point count or `state` alone. Every adjacent point after the first must carry both a comparable numeric change and a comparable evidence diff; otherwise the component renders an empty state instead of a line.
