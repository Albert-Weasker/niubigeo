# Inspect the cases

[简体中文](./README.zh-CN.md)

These are twenty deliberately selected software-product domains, not a random market sample or a brand ranking. Each folder under `cases/` contains the frozen input, a bilingual observation page, a machine-readable summary and an evidence index. Read the state on the case page: a documented case is not necessarily an executed or successful test.

## Read without paying for inference

```bash
npm ci
npm run examples:validate
npm run examples:plan -- --case R02
npm run examples:replay -- --case R02 --evidence examples/cases/R02/public-evidence.json
```

Planning, replay, export and Markdown rendering never ask a model for a new answer. Replay retains the original run dates and is labelled as archived evidence.

## Remeasurement incurs charges

The checked-in study plan records this release's conditions and budget; it is not continuing authorization to spend someone else's key. A new study requires an explicitly authorized budget, new isolated output directory, frozen inputs and a successful preflight. The commands below are for an operator who has supplied their own key and approved USD 2 for that new study.

```bash
# Uses the existing product HTTP API in a separate, local product service.
npm run examples:preflight -- --execution live --budget-usd 2
npm run examples:run -- --case R02 --execution live --budget-usd 2
# Omit --case to execute every still-unrun case in the frozen study.
```

The live runner requires `validation/release-v0.2.0-rc.1/study-plan.json` and its initialized cumulative ledger. It refuses an unfrozen study, duplicate completed cases, unpriced models and a failed preflight. This release's private validation directory is intentionally not in Git. See [the study plan](./study-plan.json) and [measurement method](../docs/measurement-methodology.md) before creating a new study with `npm run examples:init -- --budget-usd 2`. Initialization does not overwrite an existing plan; archive a completed study and give the new study a separate `--root` directory.

## Cases

The current observations and source links are in each case's README. Markdown is the reading interface; no case service is needed.

<!-- CASE_INDEX -->

All 20 domains have analyzable D answers; 11 cases actually ran K, 10 cases are partial, and 18 answers failed analysis. 7 first-place fields across 5 cases conflict and are excluded from rankings. These are different scopes, not an overall success rate.

[Conflict and failure index](../docs/known-issues.md)

| ID | Domain | Actual scope | Observation or limitation | Details |
|---|---|---|---|---|
| R01 | niubistar.com | Domain only; keyword tests not run | One model described gaming, another GitHub growth, and a third did not recognize the domain. | [Read](cases/R01/README.md) |
| R02 | vercel.com | D + K (6/9 K answers analyzable) | All described frontend deployment; three keyword answers failed analysis across three repeats. | [Read](cases/R02/README.md) |
| R03 | supabase.com | Domain only; keyword tests not run | Models described a Firebase alternative; no eligible neutral keyword test was established. | [Read](cases/R03/README.md) |
| R04 | posthog.com | D + K (15/18 K answers analyzable) | Feature Flags answers returned actual citations; all three repeats remain partial. | [Read](cases/R04/README.md) |
| R05 | sentry.io | Domain only; keyword tests not run | Models emphasized error tracking, naming different lists including Datadog and New Relic. | [Read](cases/R05/README.md) |
| R06 | linear.app | D + K (4/6 K answers analyzable) | Descriptions ranged from issue tracking to product development; one first-place field conflicts. | [Read](cases/R06/README.md) |
| R07 | canva.com | D + K (2/3 K answers analyzable) | Online-design descriptions were similar; the keyword answer has two first-place conflicts. | [Read](cases/R07/README.md) |
| R08 | notion.so | Domain only; keyword tests not run | Models emphasized notes, workspace and collaboration, naming different competitors. | [Read](cases/R08/README.md) |
| R09 | cloudflare.com | Domain only; keyword tests not run | Models emphasized CDN and security; AWS-related names are not resolved to one entity. | [Read](cases/R09/README.md) |
| R10 | replit.com | D + K (2/3 K answers analyzable) | Models described a browser IDE; keyword results contain two first-place conflicts. | [Read](cases/R10/README.md) |
| R11 | github.com | D + K (3/3 K answers analyzable) | Domain answers described code hosting; the collaboration answer has a conflicting first-place field. | [Read](cases/R11/README.md) |
| R12 | gitlab.com | D + K (2/3 K answers analyzable) | Models described DevOps; a keyword analysis failure is not a brand absence. | [Read](cases/R12/README.md) |
| R13 | docker.com | D + K (4/6 K answers analyzable) | Models named Kubernetes and other objects; that does not verify a substitution relationship. | [Read](cases/R13/README.md) |
| R14 | figma.com | D + K (5/6 K answers analyzable) | An online Prototyping answer explicitly recommended Figma; another keyword failed analysis. | [Read](cases/R14/README.md) |
| R15 | framer.com | Domain only; keyword tests not run | No-code building descriptions were similar; lists including Wix and Webflow differed. | [Read](cases/R15/README.md) |
| R16 | webflow.com | Domain only; keyword tests not run | Models described visual website building; one also explicitly described CMS and hosting. | [Read](cases/R16/README.md) |
| R17 | airtable.com | Domain only; keyword tests not run | Models emphasized databases, spreadsheets and collaboration; keyword tests were not run. | [Read](cases/R17/README.md) |
| R18 | zapier.com | D + K (4/6 K answers analyzable) | Answers used names such as Make and Integromat; they cannot simply be counted as different companies. | [Read](cases/R18/README.md) |
| R19 | n8n.io | D + K (4/6 K answers analyzable) | One online answer named no competitors; the open-source-software keyword has a first-place conflict. | [Read](cases/R19/README.md) |
| R20 | plausible.io | Domain only; keyword tests not run | Models emphasized privacy-focused analytics and all named Google Analytics and Matomo. | [Read](cases/R20/README.md) |

<!-- CASE_INDEX -->

## Evidence conventions

- Provider citations resolve to a structured field in a saved Provider response.
- Search retrieval results are labelled separately from answer citations.
- Ordinary answer URLs remain ordinary answer URLs, including in offline answers.
- Unknown, missing fields, incomplete analysis and failed calls remain different states.
- Raw answers retain their original language; the surrounding explanation is bilingual.
- Frozen plans and keyword selections are separate from results. No case-specific execution rules exist in product code.

The product's combined measurement endpoint also sends a target-domain probe per selected model. Those requests are included in the cost plan. Keywords are selected from exact, independently observed associations, excluding target and observed competitor identities. This rule does not establish market demand.

NiubiStar sponsors NiubiGEO. Its case follows the same rules and retains failures. Other case inclusions are observations, not endorsements or customer claims.
