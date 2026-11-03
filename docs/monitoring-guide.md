# Reading monitoring evidence

[中文](monitoring-guide.zh-CN.md) · [Keyword controls](keyword-monitoring.md) · [Methodology](measurement-methodology.md)

## First observation

1. Create a project and connect your chosen model providers. Save the model baseline.
2. Open **Keyword Monitoring**, add a real question such as `best analytics tools for startups`, and optionally enter your brand and explicit aliases. An unconfigured abbreviation is not guessed.
3. Choose a frequency, tags and 1–10 samples per model. Run once before enabling the separate scheduler worker. Browser-only keys cannot be used by that worker.
4. Open **History** to inspect answers, failures, matched names, recommendation/source frequencies and saved conditions. Filter dates in UTC and optionally select one model. Export CSV or JSON using these same filters.
5. After a second observation, review Diff warnings before interpreting changes. Inspect the underlying answers and sources. A visible citation does not prove that the source caused a recommendation.

## Interpreting a sample

This table is illustrative, not a model experiment:

| Result | Meaning |
|---|---|
| 3 mentions / 5 successful samples | The configured brand or alias appeared in three of five usable answers; 60% in this observation. |
| 3 mentions / 4 successful, 1 failed | The failed call is not an absent mention. Report both 3/4 and the one failure. |
| No brand configured | Answers, recommendations and sources are preserved; a brand visibility percentage has no business meaning until a brand is configured. |
| No comparable results | Conditions changed or matching samples are missing/failed; this is not a visibility drop. |
| Retry snapshot | Some samples are carried from an earlier run; do not count this as an independent repeated observation. |

Charts show each observation separately, without a weighted score or cross-condition trend line. Check the saved baseline, prompt, model, search settings and sampling protocol. Even repeated samples are not a guarantee of future visibility or a statistical confidence interval. API results are not identical to consumer AI applications.

Recommendation labels come from the structured model response. NiubiGEO does not infer sentiment from a list of English or Chinese trigger words. Chinese answers and configured aliases use the same evidence path. The legacy Alpha heuristic sentiment request remains distinct from the current product's measured recommendations.

## Costs and CLI repeats

After creating a keyword monitor in the workbench, use its project and monitor IDs:

```sh
npx tsx src/cli.ts keyword-run --project PROJECT_ID --monitor MONITOR_ID --repeats 5 --dry-run
npx tsx src/cli.ts keyword-run --project PROJECT_ID --monitor MONITOR_ID --repeats 5
```

Dry-run reads saved configuration only. It reports model count × samples, maximum requested output tokens and unknown monetary cost; provider retries/search can add charges. The second command performs calls with server-side keys, records a new observation and prints per-model mention/recommendation/source frequencies. The override does not change the saved monitoring frequency or repeat setting. Partial failures produce a nonzero exit status while preserving evidence. Use `schedule:worker` for the current workbench; `monitor-worker` belongs to the legacy engine.

## Troubleshooting and offline examples

- Worker unavailable/stale: verify `npm run schedule:worker`, its data directory and server-side credentials. Inspect the recorded failure instead of repeatedly running every model.
- A model fails: retry only its failed samples from the latest compatible observation. Old protocols remain readable but require a fresh observation before retrying with the new matcher.
- No live API access: read the [real research archive](../examples/README.md). For an installation check without inference, run `npm ci`, `npm test`, and `npm run test:examples`. These tests use explicit fixtures; they are not research results and do not populate your workbench.
- Need raw information: CSV includes per-sample answer, error, conditions and source URLs. JSON preserves the selected run evidence. No secret keys are added to exports.
- Webhook alerts, geographic proxy simulation, PDF reports and aggregate tag scores are not added by this release. Follow the [triage ledger](issue-triage-v0.3.3.md) for their separate scope.
