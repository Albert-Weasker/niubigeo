# Keyword Monitoring (NEW / BETA)

Keyword Monitoring is a separate module in the same workbench as domain recognition. Users can define keywords without adding them to a domain watch set.

## Current scope

- Add one keyword or import a newline-separated batch.
- Start from AI Coding, SaaS / Product, GEO and brand-comparison templates.
- Classify prompts as Discovery, Alternative, Comparison, Brand or Use case.
- Run hourly, daily or weekly.
- Optionally set a monitored brand and aliases, such as `牛逼GEO` and `NiubiGEO`.
- Keep each run's answer, model, brand mentions, positions and citations in independent history.

The page is labeled **Keyword Monitoring NEW / BETA**. APIs and metrics may change during beta. The competitor detection dashboard is intentionally deferred.

Temporary browser keys are not available to the separate scheduler worker; self-hosted scheduled runs require server-side model keys. Runs use the models saved in the workbench.
