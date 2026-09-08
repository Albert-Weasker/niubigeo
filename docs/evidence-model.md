# 证据模型与来源规则

适用：当前产品实现，拟发布 **v0.2.0-rc.1，UNPUBLISHED**。本页定义如何阅读已保存记录，并指出尚未实现的保障。本轮 [R02 案例](../examples/cases/R02/README.md) 保留实际部分完成与原文；[R04 案例](../examples/cases/R04/README.md) 的联网 K 响应包含可追溯至结构化 Payload 路径的 Provider 引用。没有引用的其他回答仍显示空结果，不从普通链接补造。

我们公开的是本次回答及其证据，无法据此读出模型内部的思考过程，也不能保证再次运行得到完全相同的答案。

## 从结论返回原文

两类证据入口采用不同层次：

```text
认知报告 → sourceAttemptMap → RecognitionModelRunAttempt
         → RecognitionArchive → 字段/竞品/关键词/Provider 引用/普通链接

测量点 → samples → ProbeRun → firstAttemptId / ProbeAttempt
       → DomainProbeResult 或 KeywordDiscoveryResult / mentions / evidence
```

用户复核时需要原始回答、请求条件和具体字段关系，只有 Run ID 或网址列表不够。项目、Run、ModelRun、Attempt ID 将证据约束到一次执行；它们是引用标识，不是内容真实性的证明。

## 原始尝试记录

[认知 Schema](../src/product/recognition/recognition-schema.ts) 与 [测量 Schema](../src/product/measurements/measurement-schema.ts) 定义 Attempt 的核心字段：

| 字段 | 阅读方式 |
| --- | --- |
| id、projectId、runId、modelRunId、attemptNumber | 定位项目和执行顺序；测量另含 probeRunId |
| status、errorCode、errorMessage | 区分请求失败、能力不支持、解析失败与正常结果 |
| promptHash | 本次生成 Prompt 的 Hash；Attempt 本身不保存完整出站 HTTP 请求 |
| requestParameters | 模型、temperature、maxTokens、Schema 名/Hash、结构化输出传输、搜索配置 |
| rawProviderResponse | 适配器保留的响应对象，不是含请求头的网络抓包 |
| rawAnswer | 适配器抽取的回答文本；可能是 JSON 或工具参数文本，不保证是自然语言段落 |
| providerId、providerModel、providerModelVersion | 记录 OpenRouter 与返回模型信息；字段值不保证披露不可变模型权重版本 |
| providerSearch | Provider 适配器的实际搜索执行信息，读取时与请求模式分开 |
| tokenUsage、costUsd、latencyMs | 仅记录已获得的用量、费用与时延；缺失费用应为未知，不补 0 |
| createdAt、startedAt、completedAt | 生命周期时间，不能用导出或截图时间替代 |

请求失败可能没有原文或 Provider Payload；解析失败则可能已经收到完整或截断回答。当前初始认知先写 response_saved，再解析；测量服务写含原文 Attempt 的时间晚于派生结果/证据，因此进程中断时可能出现先有派生结果、原文尚未落盘的记录。

## 字段、空值与本地解析

认知档案中 `RecognitionResult` 保存域名识别声明、分析状态、品牌/业务/类别声明、unknowns、fieldIssues 与 mappingVersion。每个声明使用 `{ value, evidence }`；竞品关键词还通过 competitorRecognitionId 保留归属，不能汇总后误认为目标关键词。

| 记录状态 | 含义 |
| --- | --- |
| domainRecognition=unknown | 模型没有给出确定识别结论，不等于请求失败 |
| domainRecognition=not_recognized | 模型明确未识别，不等于缺少字段 |
| value=null / 字段 issue | 字段无法取得或无确定值；结合 issue 判断缺失、无效或冲突 |
| 合法空数组 | 这次没有列出该项，不等于现实不存在 |
| analysisStatus=analysis_failed | 本地解析未取得可用结构化结果，不代表 Provider 没返回原文 |
| localAnalysis=partial | 本地只恢复部分字段，不是给品牌的“部分认识”分数 |

解析器支持当前结构及有限兼容字段映射，记录 missing_field、invalid_field、conflicting_field。测量的 DomainProbeResult 是精简投影，没有完整保留认知档案中的 fieldIssues、逐竞品关键词或所有字段证据。检查缺失与空数组时可能仍需要原文；不能宣称两类 D 的派生字段完全相同。

`AnswerEvidenceLocation` 的 start/end 以 **UTF-16 code unit** 为单位，end 为不含末位的边界。核验条件是 `rawAnswer.slice(start, end) === quote`。它不是 UTF-8 字节偏移。定位失败时 evidence 为 null，不能虚构偏移；同样一段文字多次出现时通常取首次精确匹配。

报告将证据标为 valid/missing/invalid，但这是文本切片匹配，不是事实核查。K 的 quote/offset 同样尝试定位，然而推荐与先后指标尚未用证据完整性作强制门槛。

## 三类来源必须分开

| 面向用户的类别 | 原始字段与含义 | 可以证明什么 |
| --- | --- | --- |
| Provider 引用 | 结构化 annotation 或 citation array 等；保留 providerPayloadPath | Provider 在这次响应中返回了这个引用项 |
| 检索结果 | source=provider_search_result 等搜索工具结果列表 | 此 URL 出现在检索返回中，不自动证明被答案引用 |
| 回答中的链接 | source=answer_text_url；正文或模型生成 JSON 中的 URL | 回答文字出现了 URL，不证明 Provider 检索或引用了它 |

引用存在不等于网页已验证、内容一定正确、网页属于官方，也不证明它导致了模型推荐。无 Provider 引用时使用“**本次未返回 Provider 引用**”；离线正文出现链接仍属普通链接，不能倒推训练来源或实际联网。

[citation-extractors.ts](../src/providers/citation-extractors.ts) 使用结构化字段读取 Provider 来源，用 linkify-it 提取回答链接，用 URL API 解析网址。相同 source+URL 会去重并重编 citationIndex；原始数组位置应从 providerPayloadPath 或 rawProviderResponse 读取，不能把重编后的索引当原始位置。

典型路径来自适配器的真实字段约定，以下是路径说明，不是本轮已取得的响应：

- `choices[0].message.annotations[index].url` 或 `.url_citation.url`：Chat Completions 风格 annotation。
- `output[index].content[index].annotations[index]...`：Responses 风格 annotation。
- `citations[index]`：Provider 引用数组。
- `search_results[index].url`：检索结果，必须保留这一类别。
- `candidates[0].groundingMetadata.groundingChunks[index].web.uri`：grounding 来源；需结合原始响应判断与回答的关联。

后几类适配器存在于共享 Provider 层，不表示当前产品直接提供所有 Provider 的调用入口。当前产品走 OpenRouter，实际采用哪类字段以该 Attempt 响应与适配器为准。

### 当前分类边界

初始认知的 providerCitations() 要求 `answer.search.requested`，并要求标题和 Payload 路径；排除 answer_text_url，但没有单独排除 provider_search_result。测量路径不检查 search.requested，缺标题时回退域名，也只排除 answer_text_url/缺路径项。因此两个入口在来源保留上并不完全一致，检索结果可能仍出现在名为 providerCitations 的集合内。

**集合名不能替代 provenance 检查。**公开导出应按 providerCitationSource 和 Payload 路径区分引用与检索结果；没有独立分类时说明限制，不能声称当前 UI 已完整实现三个入口。测量引用率也没有强制核对实际搜索 used 状态，见 [方法](measurement-methodology.md)。

`ClaimCitationLink` 只在模型字段列出的 citationUrls 与本次已存 ProviderCitation 的 URL 匹配时建立；模型自己写一个 URL 不会凭空生成新的 ProviderCitation。链接表示模型声明与已返回来源的对应，不是语义支持或因果关系已经验证。报告会检查 providerPayloadPath 在原始响应中的值是否等于归档 URL；不一致可标为 evidence_integrity_error。

## 原生搜索与 SDK 路径

[openrouter-native-search.ts](../src/providers/openrouter-native-search.ts) 按模型能力选择 server_tool 或 built_in_grounding。server_tool 请求使用 `openrouter:web_search`、engine=native 与 tool_choice=required；实际路径从 `openrouter_metadata.pipeline` 中 server_tools 阶段的 mode 读取。请求 native 不能证明最终确实由模型原生执行。

| executionMode | 当前适配器的解释 |
| --- | --- |
| native | OpenRouter 元数据确认原生路径 |
| sdk | OpenRouter 元数据确认服务端工具的 SDK 路径，**不声称模型内建搜索** |
| unverified | 未得到对应路径确认，不得仅凭请求模式推定实际执行 |
| provider_always_on | 能力标为内建 grounding；还需检查原始证据与验证说明 |

当前 SDK 和 native 都可能在 SearchExecution 中归为 usedMode=provider_native，报告简短标签也可能都显示“Provider 原生联网”。应同时披露 executionMode、note 和原始元数据；不要将二者作为同一实际路径直接比较。built_in_grounding 用 annotation/search_results/citations 是否非空作为确认线索，但 alwaysOn 在共享搜索状态构建中可令 used=true，不能只看 used 布尔值。

适配器在返回空文本时会抛出 empty_answer，即使响应可能包含工具元数据；这类失败不保证完整 Payload 已进入产品 Attempt。严格 JSON Schema、required 工具、路由参数支持和搜索行为的组合仍需真实预检，目录能力或 HTTP 200 不能替代验证。已保存的三路真实结果见 [20 例索引](../examples/README.zh-CN.md)，不泛化到未测模型或路由。

## 版本与不可变性的实际范围

| 版本字段 | 当前值/含义 |
| --- | --- |
| D 协议 | domain-recognition/v1 |
| K 协议 | keyword-discovery/v1 |
| Baseline.analysisVersion | recognition-analysis/v1 |
| 本地重新分析 analyzerVersion | recognition-analysis/v2 |
| 字段 mappingVersion | recognition-current/v1 或 recognition-compatibility/v1 |
| 报告 Schema | recognition-report/v1 |
| 报告分组 | exact-name-host/v1 |
| 测量匹配 | measurement-matching/v1 |

这些字段的版本层次不同，不能因名称近似而合并成一个“已统一的分析版本”。协议快照中的 promptTemplateHash 也不全是当前 Prompt 函数全文 Hash；每次 Attempt 的 promptHash 更接近实际生成 Prompt，完整重建还需要同一源码版本和输入。

认知重试追加 Attempt 与同 Attempt 的 RecognitionArchive。重新分析追加 Revision，包含 sourceRawAnswerHash、analyzerVersion 和 archive，不改原始回答。报告选择 currentAttemptId 对应原始 archive；详情页优先取最新 Revision，可能出现展示差异。

报告保存 sourceFingerprint、sourceAttemptMap、sourceRecordHashes 与 reportRevision。record Hash 使用 `sha256(JSON.stringify(value))`，**不是含缩进和末尾换行的文件字节 Hash**；公开证据包应另外计算文件 SHA-256。报告创建时的稳定性检查比较 Run/ModelRun 状态和当前 Attempt ID，不是跨文件事务或持续防篡改检测。

测量 Probe Attempt 保留首次/最新 ID，但结果和 evidence 文件按 Probe 覆盖。统计快照只凭 Run/Probe/首次 Attempt ID 缓存，不能保证重试、完成状态或公式变化后自动更新。公开材料须明确实际采用的 Attempt 并校验关联，不能用“不可变证据”掩盖这一差异。

## 只读复核与导出

当前产品提供 JSON 读取 API，没有通用的 PDF/CSV/公开证据包导出端点。产品 API 清单见 [架构](ARCHITECTURE.md)。生成认知报告、生成测量统计和本地重新分析不发推理，但会写入派生文件；纯 GET 报告/Attempt/Probe 读取不应被标为新测量。

当前 [案例目录](../examples/README.zh-CN.md) 已有本地脱敏证据与索引，尚未公开发布。阅读时核对如下关联，缺失的发布信息仍为 pending：

- caseId、原始域名、study-plan 与 keyword manifest 的版本及文件 Hash。
- 产品源码/构建输入、候选镜像 Digest、文档版本，缺失时明确 pending。
- 全部 Run/ModelRun/Probe/Attempt ID、计划/实际时间、状态、请求参数、实际搜索信息。
- 逐文件相对路径、字节 Hash、原文与引用路径、组成指标的样本与排除原因。
- 全部尝试的费用、未知费用及重试说明，不能只累计最后成功尝试。
- 截图原始运行时间和截图时间、视口、证据 ID、文件 Hash、镜像 Digest。

原始 Payload 和 Trace 放隔离归档，公开脱敏副本有自己的 Hash 与变更说明；不能用本机绝对路径、localhost 或临时 URL 当永久公开证据。案例 Markdown 位于 examples/cases，直接提供原文、图片和证据，无需案例服务；导出不向用户数据根目录写入案例项目。7 项冲突和 18 条分析失败逐项链接见 [已知问题](known-issues.md)。

报告的 `safeProviderResponse()` 目前只是 JSON 序列化检查，并不执行秘密或个人信息脱敏。公开前仍要检查 API Key、认证头、内部账号、个人信息与 URL 敏感参数；记录脱敏字段及原件/副本区别。Hash 校验能帮助发现改动，但不是内容正确或来源可信的证明。

外部网页现在打不开，不会使原始回答消失；网页可访问检查和 Provider 当时返回 URL 是两件事。产品本身不保证来源网页的长期存续。后续重新请求模型应称“重新测量”，读取旧记录应称“归档回放”。
