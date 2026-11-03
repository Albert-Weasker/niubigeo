# Keyword Monitoring (NEW / BETA)

Keyword Monitoring is a separate module in the same workbench as domain recognition. Users can define keywords without adding them to a domain watch set.

## Current scope

- Add one keyword or import a newline-separated batch.
- Start from AI Coding, SaaS / Product, GEO and brand-comparison templates.
- Classify prompts as Discovery, Alternative, Comparison, Brand or Use case.
- Run hourly, daily or weekly.
- Optionally set a monitored brand and aliases, such as `牛逼GEO` and `NiubiGEO`.
- Keep each run's answer, model, brand mentions, positions and citations in independent history.

The page includes a **Diff View** after two runs: it compares recommendations, mention positions and added or removed source links between the previous and latest snapshots.

The page is labeled **Keyword Monitoring NEW / BETA**. APIs and metrics may change during beta. The competitor detection dashboard is intentionally deferred.

Temporary browser keys are not available to the separate scheduler worker; self-hosted scheduled runs require server-side model keys. Runs use the models saved in the workbench.

## Monitoring controls and evidence

- The worker panel shows heartbeat, last cycle and last execution. An expired heartbeat is not proof that a task ran. Start `npm run schedule:worker` with the same data directory and server-side keys as the web server. Next-run times are shown per keyword; setup failures remain in history.
- Use **Settings** to assign up to 20 tags and filter the list by tag. Tags do not change measurement scores.
- Set **1–10 samples per model** (default 1, maximum 100 model requests per observation). The form estimates model calls per keyword; provider retries and search may cost extra. Monetary prices are unknown. History shows mentions among successful samples, failed samples separately, and recommendation/source frequencies. Samples are observations, not a statistical guarantee.
- Retry failed samples for one model from the latest history entry. Successful samples and the original failure remain stored; the retry is a new linked record. Legacy records without saved conditions cannot be retried this way.
- Diff checks the saved prompt, language, brand/aliases, sample count, model/provider, returned model version and search settings. Changed, failed or missing samples are excluded. Legacy conditions and retry snapshots carry warnings; absence of a detected change does not prove stable visibility.
- **Export CSV** exports the exact two displayed records, including dates, model/sample, mentions, positions, recommendations, source URLs, failures and comparability warnings. Position changes in the CSV require the accompanying warnings to be interpreted correctly.

These controls ship in v0.3.3. Existing history remains readable; back up your data before upgrading.

History supports UTC date and model filters, per-observation mention bars, and CSV/JSON exports. See [reading evidence and CLI repeats](monitoring-guide.md) or [local Ollama setup](ollama.md). New observations use matching protocol v2; older records stay readable, but must not be retried with the new matcher.
