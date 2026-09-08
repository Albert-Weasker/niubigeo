# 已知问题 / Known Issues

**状态：未修复，发布仍为 blocked / Unresolved; release remains blocked.**

以下索引来自已经保存的回答及语义复核，不修改任何原始名次、结果或统计点。链接指向仓库 Markdown 原文和脱敏响应；本地文件不冒充公开下载地址。

This index references archived answers and the read-only semantic audit. No rankings, responses or metric points were changed. Repository files are prepared locally, not yet a published evidence release.

## 唯一第一名冲突 / Conflicting unique-first fields

同一回答将多个对象标记为 unique，而归档仍记录 adjudicable 的 0/1。该指标存在一致性冲突，暂不用于排名比较。不是已证明目标不在第一位，也不解释为并列第一。

Multiple objects are marked unique in one answer while the archive records an adjudicable 0/1. These fields are excluded from ranking comparisons, not interpreted as a verified loss or a tie.

| 案例 / Case | 字段 / Field | 模型 / Model · Run | 冲突对象 / Records | 证据 / Evidence |
|---|---|---|---|---|
| R06 | firstMentionState | google/gemini-2.5-flash-lite<br>0d98ccde-b6eb-4a7f-954f-56f1c6d88da5 | Jira, Asana, Trello | [3 unique](#conflict-287f13f8-d88d-4573-96b5-680db90273b8-firstmentionstate) |
| R07 | firstMentionState | google/gemini-2.5-flash-lite<br>247309c7-aaba-4b3b-a9ae-e457cbd10c0b | Canva, Figma, Adobe Express | [3 unique](#conflict-af4cdbc6-c4c5-48fe-b261-60da44cf2dc9-firstmentionstate) |
| R07 | firstRecommendationState | google/gemini-2.5-flash-lite<br>247309c7-aaba-4b3b-a9ae-e457cbd10c0b | Canva, Figma, Adobe Express | [3 unique](#conflict-af4cdbc6-c4c5-48fe-b261-60da44cf2dc9-firstrecommendationstate) |
| R10 | firstMentionState | openai/gpt-4o-mini<br>6a903d55-4c70-4e36-85c0-7742811d3f39 | Replit, CodeSandbox, Glitch, Gitpod | [4 unique](#conflict-177f67e8-6b8a-4a18-93df-23f4e591c93f-firstmentionstate) |
| R10 | firstRecommendationState | openai/gpt-4o-mini<br>6a903d55-4c70-4e36-85c0-7742811d3f39 | Replit, CodeSandbox | [2 unique](#conflict-177f67e8-6b8a-4a18-93df-23f4e591c93f-firstrecommendationstate) |
| R11 | firstMentionState | openai/gpt-4.1-mini<br>86ca2562-66e4-41c6-aa14-7d9f8fa82838 | 彩漩PPT, WPS协作, Atlassian, Boardmix博思白板, Zoom Workplace, CoDesign设计协作平台, WorkCraft, AceTeamwork, FlowUs息流, BeeWorks | [10 unique](#conflict-3d3f3f2c-c458-4b4c-85d1-048ecd2bafdb-firstmentionstate) |
| R19 | firstMentionState | openai/gpt-4o-mini<br>63f6121d-fe18-42e0-8d0e-390cc64d3abf | 开源软件, Linux, Apache, Git | [4 unique](#conflict-4da15ebb-7308-4388-bde7-c8f7cf3dbcc6-firstmentionstate) |

<a id="conflict-287f13f8-d88d-4573-96b5-680db90273b8-firstmentionstate"></a>
### R06 · firstMentionState

Probe: `287f13f8-d88d-4573-96b5-680db90273b8` · Attempt: `d9643825-5216-4e70-8c96-a1223c00d06f`

[中文原文](../examples/cases/R06/README.zh-CN.md#attempt-d9643825-5216-4e70-8c96-a1223c00d06f) · [Original answer](../examples/cases/R06/README.md#attempt-d9643825-5216-4e70-8c96-a1223c00d06f) · [Payload](../examples/cases/R06/public-evidence.json)

Raw answer SHA-256: `b58b70abf5cfcae028be7e4ea8916349c781b3389defcc75500630c65e986690`

影响 / Impact: point-7aeffc0e022ea35e14fced96: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

<a id="conflict-af4cdbc6-c4c5-48fe-b261-60da44cf2dc9-firstmentionstate"></a>
### R07 · firstMentionState

Probe: `af4cdbc6-c4c5-48fe-b261-60da44cf2dc9` · Attempt: `b67aafe4-23d2-4365-b8a0-29ac43acb8b2`

[中文原文](../examples/cases/R07/README.zh-CN.md#attempt-b67aafe4-23d2-4365-b8a0-29ac43acb8b2) · [Original answer](../examples/cases/R07/README.md#attempt-b67aafe4-23d2-4365-b8a0-29ac43acb8b2) · [Payload](../examples/cases/R07/public-evidence.json)

Raw answer SHA-256: `f57c4d4de28d261df8bac8d57b6444d2bc0bb1fa273d6810a30bf1fd30933fe2`

影响 / Impact: point-e8456d27aee7ebee68604ce9: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

<a id="conflict-af4cdbc6-c4c5-48fe-b261-60da44cf2dc9-firstrecommendationstate"></a>
### R07 · firstRecommendationState

Probe: `af4cdbc6-c4c5-48fe-b261-60da44cf2dc9` · Attempt: `b67aafe4-23d2-4365-b8a0-29ac43acb8b2`

[中文原文](../examples/cases/R07/README.zh-CN.md#attempt-b67aafe4-23d2-4365-b8a0-29ac43acb8b2) · [Original answer](../examples/cases/R07/README.md#attempt-b67aafe4-23d2-4365-b8a0-29ac43acb8b2) · [Payload](../examples/cases/R07/public-evidence.json)

Raw answer SHA-256: `f57c4d4de28d261df8bac8d57b6444d2bc0bb1fa273d6810a30bf1fd30933fe2`

影响 / Impact: point-d0b38855ab3679f5327e5863: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

<a id="conflict-177f67e8-6b8a-4a18-93df-23f4e591c93f-firstmentionstate"></a>
### R10 · firstMentionState

Probe: `177f67e8-6b8a-4a18-93df-23f4e591c93f` · Attempt: `20f79db0-dfa8-4a4b-8044-3bbfe6447545`

[中文原文](../examples/cases/R10/README.zh-CN.md#attempt-20f79db0-dfa8-4a4b-8044-3bbfe6447545) · [Original answer](../examples/cases/R10/README.md#attempt-20f79db0-dfa8-4a4b-8044-3bbfe6447545) · [Payload](../examples/cases/R10/public-evidence.json)

Raw answer SHA-256: `277db6c41e6c3678239ab5ac84281507ecc43d8ad28444a9399364b564dd7e49`

影响 / Impact: point-7982d28e42af6b407bedc4be: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

<a id="conflict-177f67e8-6b8a-4a18-93df-23f4e591c93f-firstrecommendationstate"></a>
### R10 · firstRecommendationState

Probe: `177f67e8-6b8a-4a18-93df-23f4e591c93f` · Attempt: `20f79db0-dfa8-4a4b-8044-3bbfe6447545`

[中文原文](../examples/cases/R10/README.zh-CN.md#attempt-20f79db0-dfa8-4a4b-8044-3bbfe6447545) · [Original answer](../examples/cases/R10/README.md#attempt-20f79db0-dfa8-4a4b-8044-3bbfe6447545) · [Payload](../examples/cases/R10/public-evidence.json)

Raw answer SHA-256: `277db6c41e6c3678239ab5ac84281507ecc43d8ad28444a9399364b564dd7e49`

影响 / Impact: point-2123fc06bf192d249cd0557d: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

<a id="conflict-3d3f3f2c-c458-4b4c-85d1-048ecd2bafdb-firstmentionstate"></a>
### R11 · firstMentionState

Probe: `3d3f3f2c-c458-4b4c-85d1-048ecd2bafdb` · Attempt: `8ed46717-df44-46cb-a4a8-c0fd326720fb`

[中文原文](../examples/cases/R11/README.zh-CN.md#attempt-8ed46717-df44-46cb-a4a8-c0fd326720fb) · [Original answer](../examples/cases/R11/README.md#attempt-8ed46717-df44-46cb-a4a8-c0fd326720fb) · [Payload](../examples/cases/R11/public-evidence.json)

Raw answer SHA-256: `1e6976a2f9638897e1d470a21f1bf8ae353a1a289afecd78f68ab43b41cb9dc3`

影响 / Impact: point-1ca0713e16d9718b43247add: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

<a id="conflict-4da15ebb-7308-4388-bde7-c8f7cf3dbcc6-firstmentionstate"></a>
### R19 · firstMentionState

Probe: `4da15ebb-7308-4388-bde7-c8f7cf3dbcc6` · Attempt: `f2133ea2-36b5-45a4-b524-32c8c3cc6983`

[中文原文](../examples/cases/R19/README.zh-CN.md#attempt-f2133ea2-36b5-45a4-b524-32c8c3cc6983) · [Original answer](../examples/cases/R19/README.md#attempt-f2133ea2-36b5-45a4-b524-32c8c3cc6983) · [Payload](../examples/cases/R19/public-evidence.json)

Raw answer SHA-256: `ef8141fbcaa4f54a2ef699ce694d2facb397366c7290469443be00f9b58db033`

影响 / Impact: point-2831ec8504315b6d31154284: 0/1, value=0. 同字段汇总和排名不可据此断言正确；未受影响的描述、引用与提及原文仍可查看。Aggregates relying on this field are not validated; unrelated descriptions, citations and mention excerpts remain readable.

**当前状态：未修复 / Unresolved.** 当时页面展示，排名未通过核验。历史截图原样保留在案例页折叠区，不用作排名证明。

## 分析失败 / Analysis failures

模型已返回内容但本地分析失败，不等于模型不认识。原文和原错误均保留。These models returned content but analysis failed; this is not non-recognition. Original answers and errors remain intact.

| 案例 / Case | 模型 / Model | 时间 UTC / Time | 原始回答 / Attempt | 错误 / Error |
|---|---|---|---|---|
| R02 | openai/gpt-4.1-mini | 2026-09-08T06:01:57.968Z | [027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3](../examples/cases/R02/README.md#attempt-027a9e28-7bba-4b7a-a0d1-1dc9acda3fc3) | analysis_failed |
| R02 | openai/gpt-4.1-mini | 2026-09-08T06:02:22.580Z | [e847731b-ed41-455c-801a-03f4e75598ae](../examples/cases/R02/README.md#attempt-e847731b-ed41-455c-801a-03f4e75598ae) | analysis_failed |
| R02 | openai/gpt-4.1-mini | 2026-09-08T06:04:51.042Z | [edad1b8e-c9aa-47e9-8d1c-930f4aac72f3](../examples/cases/R02/README.md#attempt-edad1b8e-c9aa-47e9-8d1c-930f4aac72f3) | analysis_failed |
| R04 | openai/gpt-4.1-mini | 2026-09-08T06:05:50.138Z | [829eb19d-0fb0-4d0d-9055-1a7e62188ffd](../examples/cases/R04/README.md#attempt-829eb19d-0fb0-4d0d-9055-1a7e62188ffd) | analysis_failed |
| R04 | openai/gpt-4.1-mini | 2026-09-08T06:06:14.198Z | [8371777c-b23e-4b35-b46d-1e02a0d6b58b](../examples/cases/R04/README.md#attempt-8371777c-b23e-4b35-b46d-1e02a0d6b58b) | analysis_failed |
| R04 | openai/gpt-4.1-mini | 2026-09-08T06:07:12.056Z | [e2716c84-de3a-491a-83cb-6f63765dd862](../examples/cases/R04/README.md#attempt-e2716c84-de3a-491a-83cb-6f63765dd862) | analysis_failed |
| R06 | openai/gpt-4.1-mini | 2026-09-08T06:07:56.141Z | [07fc78c7-84b0-4c05-bdea-bf2d6aece1bc](../examples/cases/R06/README.md#attempt-07fc78c7-84b0-4c05-bdea-bf2d6aece1bc) | analysis_failed |
| R06 | openai/gpt-4.1-mini | 2026-09-08T06:08:07.525Z | [d22fbf31-dfdd-414b-9841-480f56f184c9](../examples/cases/R06/README.md#attempt-d22fbf31-dfdd-414b-9841-480f56f184c9) | analysis_failed |
| R07 | openai/gpt-4.1-mini | 2026-09-08T06:08:37.254Z | [69cbfbaf-e1c5-4e8d-9718-c8943fdda515](../examples/cases/R07/README.md#attempt-69cbfbaf-e1c5-4e8d-9718-c8943fdda515) | analysis_failed |
| R10 | openai/gpt-4.1-mini | 2026-09-08T06:09:47.861Z | [53e4c750-3425-47aa-87c1-a07b110ab764](../examples/cases/R10/README.md#attempt-53e4c750-3425-47aa-87c1-a07b110ab764) | analysis_failed |
| R12 | openai/gpt-4.1-mini | 2026-09-08T06:10:46.039Z | [eb5559f5-a715-4e52-910e-73ef3c9b2262](../examples/cases/R12/README.md#attempt-eb5559f5-a715-4e52-910e-73ef3c9b2262) | analysis_failed |
| R13 | openai/gpt-4.1-mini | 2026-09-08T06:11:18.002Z | [a5cc719d-76c2-4851-9fe0-11a97a3fb16e](../examples/cases/R13/README.md#attempt-a5cc719d-76c2-4851-9fe0-11a97a3fb16e) | analysis_failed |
| R13 | openai/gpt-4.1-mini | 2026-09-08T06:11:28.287Z | [6e08ea84-67fe-450d-ad37-2870f0871d54](../examples/cases/R13/README.md#attempt-6e08ea84-67fe-450d-ad37-2870f0871d54) | analysis_failed |
| R14 | openai/gpt-4.1-mini | 2026-09-08T06:11:55.821Z | [0a83ebaf-4f6e-43d3-814b-39802bd145e4](../examples/cases/R14/README.md#attempt-0a83ebaf-4f6e-43d3-814b-39802bd145e4) | analysis_failed |
| R18 | openai/gpt-4.1-mini | 2026-09-08T06:13:30.936Z | [d445de12-8685-46c7-9950-6b46af322259](../examples/cases/R18/README.md#attempt-d445de12-8685-46c7-9950-6b46af322259) | analysis_failed |
| R18 | openai/gpt-4.1-mini | 2026-09-08T06:13:44.200Z | [4d2a2ad2-facf-491b-8a2a-c9a43185cb0b](../examples/cases/R18/README.md#attempt-4d2a2ad2-facf-491b-8a2a-c9a43185cb0b) | analysis_failed |
| R19 | openai/gpt-4.1-mini | 2026-09-08T06:14:13.565Z | [1198351c-76a2-4261-8e96-493d1796f12b](../examples/cases/R19/README.md#attempt-1198351c-76a2-4261-8e96-493d1796f12b) | analysis_failed |
| R19 | openai/gpt-4.1-mini | 2026-09-08T06:14:24.167Z | [02ee613a-5e8d-461e-a3e4-eedf5c4662d2](../examples/cases/R19/README.md#attempt-02ee613a-5e8d-461e-a3e4-eedf5c4662d2) | analysis_failed |

## 其他门禁 / Other gates

此前 npm test：212 通过、0 失败、10 跳过，来源为发布记录中的既有周期，未在本次文档整理中重跑。十项跳过是缺少旧归档，不是十次成功。完整失败案例的真实验收仍未证明，Fixture 不能替代。

The earlier npm test cycle recorded 212 passes, zero failures and ten skipped legacy archives. It was not rerun for this documentation update. Real full-failure-case acceptance remains unproven; fixtures are not a substitute.

发布提交、永久公开证据和实际 GitHub 主题验收仍缺失；本地预览不代表 GitHub 验收。本轮不新增推理、不消耗历史剩余预算。Release commits, permanent public evidence and actual GitHub theme acceptance remain pending. Local rendering is not GitHub acceptance. This update adds no inference and does not spend remaining historical budget.

[完整限制 / Full limitations](limitations.md) · [发布记录 / Release record](releases/v0.2.0-rc.1.md)
