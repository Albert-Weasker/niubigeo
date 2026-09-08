# 测量方法与指标定义

实测发现 R06、R07、R10、R11、R19 共 7 项唯一第一名冲突。相关排名及依赖该字段的汇总暂不用于比较，见 [逐项证据](known-issues.md)。本轮只披露、不修改原值或算法；算术能重算不等于语义判断正确。

适用：当前 `src/product` 工作树，拟发布 **v0.2.0-rc.1，UNPUBLISHED**。以下描述已读源码的实际计算，不代表真实 D/K 样本、调度或图表验收已完成。权威计算入口是 [measurement-stats.ts](../src/product/measurements/measurement-stats.ts)，字段定义见 [measurement-schema.ts](../src/product/measurements/measurement-schema.ts)。

## 本轮冻结计划与实际执行

以 [examples/study-plan.json](../examples/study-plan.json) 为计划来源，20 个输入位于 examples/cases。固定三路配置：`openai/gpt-4o-mini` 与 `google/gemini-2.5-flash-lite` 不联网，`openai/gpt-4.1-mini` 使用 provider_native；D 和持续测量均使用这三路。模型实际搜索 executionMode 仍须由响应确认，尤其 SDK 路径不能写成模型内建搜索。

初始 D 计划最多 20×3=60 次。每例持续测量只选目标对象，不选竞品独立域名 D，保留至多两个合格 K 词；每个 MeasurementRun 的 WatchSet.repetitions=1。R02/R04 各做三次 MeasurementRun，第三次由真实到期调度派发，完成后暂停任务。因此最多 24 个 MeasurementRun×3 路×(1 个目标 D+2 个 K)=216 次，基础最多 276 次。另预留最多 60 次应用层截断重试与 6 次预检尝试，总计划上界 342 次；这不是已执行数量，也不保证预算足以运行到上界。

当时用户授权为实测阶段**累计 USD 2**，包含预检、失败、重试与搜索，费用未知停止新增调用。研究执行器串行预约费用，Provider HTTP 重试设为一次尝试；核心产品预算限制与该执行器保障应分开解释，见 [限制 L11](limitations.md)。已归档实际调用 204 次、744529 Token、USD 1.00476325，见 [版本记录](releases/v0.2.0-rc.1.md)。本次文档整理没有追加推理，也不使用历史剩余预算。

关键词按 observed-consensus/v1：从归档目标关键词中保留可精确定位的原文证据，至少两个不同模型同词关联，排除观察到的目标/竞品身份子串，再按独立模型数降序、规范化词升序取最多两个；候选与排除原因均保留。代码位于 [study.mjs](../examples/lib/study.mjs)，无语义改写。它是机械筛选规则，不保证解决所有歧义或反映搜索需求。K 前另冻结每例 keyword manifest。

## 观察单位与条件

一个 `ProbeRun` 是一个模型、一个协议、一个域名或关键词、一个 sampleNumber 的计划观察。`ProbeAttempt` 是执行尝试；重试不是额外独立样本。每个指标点属于一个项目、一次 MeasurementRun、一个模型、对象和可选关键词/对照对象。

需要保存和披露：原始输入、规范化输入、Provider 与完整模型路由、已返回的模型版本、请求搜索配置与实际搜索执行、语言、D/K 协议版本、Prompt/Schema Hash、temperature、输出上限、匹配规则、范围版本、repetitions、实际时间和尝试选择规则。模型路由相同不能证明上游权重或搜索索引未变。

当前默认生成参数为 temperature=0、maxTokens=900、结构化传输 `response_json_schema`。初始认知服务的截断重试上限为 2000；测量服务没有相同的自动扩容分支。条件不同的 Attempt 不能作为完全相同参数的重复。

测量计划的 Probe 数由以下公式确定：

```text
选中模型数 × repetitions ×（有域名且身份 confirmed 的对象数 + neutralEligible 的关键词数）
```

对象可以包含目标与多个竞品。一个 K 回答可同时用于多个对象指标，各对象仍共享这一个回答样本。初始 recognition-runs 与持续 measurement-runs 分开保存；本页图表公式仅计算后者，不将初始认知或历史 Legacy 自动拼入。

## 通用分子、分母与缺失

除特别注明的计数、相对权重和差值外：

```text
planned = 此指标拿到的 Probe 样本数
denominator = included=true 的样本数
numerator = included=true 且 numerator=true 的样本数
failed = included=false 的样本数
value = denominator > 0 ? 100 × numerator / denominator : null
complete = planned > 0 且 failed=0
pointState = denominator=0 时 no_data，否则 complete 或 partial
```

`failed` 是“失败或排除”，可能包括不适用的离线引用样本、未知或缺失，不仅是 Provider 请求错误。`planned` 来自已经落盘并读到的 Probe，不一定等于整个 Run 的 plannedProbeCount；执行中尚未写出的 Probe 不会自动出现在这里。运行未结束时构建统计存在不完整性风险。

失败和缺失不作品牌未出现。有效分母下的 0% 是真实未命中；null 表示不能计算。认知类别不转换成任意 100/50/0 分数。D 和 K 的 unknown 处理不同，具体如下。

## D：域名认知与关键词关联

共同样本集合为当前模型、当前对象的独立域名 D 探针。**只要存在 DomainProbeResult 且 analysisStatus 不等于 analysis_failed，就进入分母。**当前代码没有再要求 domainRecognition 非 null、品牌字段存在或关键词字段完整，因此 recognized、not_recognized、unknown、ambiguous、partially_recognized 以及部分字段恢复出的结果都可能进入分母。

| 用户问题 / 指标 | 分子与值 | 分母、排除与解释 |
| --- | --- | --- |
| 模型是否识别该域名？ `domain_recognition` | domainRecognition 恰为 recognized 的样本数；按百分比计算 | 上述全部可解析 D；unknown/not_recognized/null 不命中但保留分母，不是自然发现率 |
| 该词被关联了多少次？ `keyword_association_count` | associatedKeywords 包含该词的回答份数；value 为该份数，单位 count | 表中仍保留可解析 D 的 denominator；不是词在一份回答中重复出现的字面次数 |
| 多少回答关联了该词？ `keyword_association_coverage` | 关联回答份数 / 可解析 D × 100% | 同一份回答里的重复同词只计一次；关键词缺失解析成空列表也可能算未命中 |
| 在监测词集合里该词占多大份额？ `keyword_relative_weight` | 该词关联回答份数 / 全部监测词关联回答份数之和 × 100% | 分母为关联事件总数，不是回答数；总数为 0 则 null |

词匹配只做 trim 与小写规范化后的精确相等，不合并同义词、翻译词或词形。每个回答先转为 Set。相对权重仅在当前 WatchSet 的全部监测词内计算，包含不适合 K 的词；一份回答关联两个监测词会在总分母贡献两次。

相对权重的实现细节：分子取有效 D 命中数，但总分母循环所有已读 D 的 associatedKeywords，没有再次显式检查 analysisStatus；正常解析失败输出列表为空，异常或被修改的归档则需额外核查。权重点继承关联计数点的 samples、planned、failed、complete，只把 denominator 改成关联总数，因此不能用 included 样本数直接重算这个分母。

关联计数是一个特殊情况：分母为 0 时当前仍给 value=0，同时 pointState=no_data；不能把这个计数 0 报告成“已观察到零关联”。相对权重不是搜索热度、模型注意力、商业价值或整个市场的份额。

## K：中性选型、提及与推荐

共同样本来自当前模型、当前关键词的 K 探针。结构化输出 analysisStatus=completed 时，服务将四个 judgment 都设为 adjudicable；为 unknown 时四者都为 unknown。解析失败也为 unknown。因此现有四项判断虽然字段分开，正常构建路径目前共享“整体 completed”这一个资格条件。

| 用户问题 / 指标 | 分子 | 分母与特例 |
| --- | --- | --- |
| 是否提到这个对象？ `brand_name_mention` | 任意 mention 的 matchedObjectId 等于该对象 | mentionJudgment=adjudicable 的 K；可仅通过域名匹配，所以内部名称不等于严格的品牌名字面检测 |
| 回答是否含该域名？ `domain_body_mention` | 首次 Attempt 的 rawAnswer 使用 includes 命中对象域名 | 同上；区分大小写的子串检查，不是独立词边界或 URL host 检查，JSON/URL 字段也可能命中 |
| 是否正面推荐？ `positive_recommendation` | 匹配对象且 recommendation=positive | recommendationJudgment=adjudicable；negative、mentioned、uncertain 均不命中 |
| 是否唯一首先提到？ `first_mention` | 全部 mentions 恰有一个 firstMentionState=unique，且属于该对象 | firstMentionJudgment=adjudicable；tied、none、unresolved 不命中，但只要 judgment 可判定仍进分母 |
| 是否唯一首先推荐？ `first_recommendation` | 全部 mentions 恰有一个 firstRecommendationState=unique，且匹配对象并为 positive | firstRecommendationJudgment=adjudicable；并列/无法确定不计命中 |
| 联网回答是否返回该官网的 Provider 来源？ `provider_citation` | providerCitations 存在 domain 与对象 domain 完全相等的项 | 配置 webSearchMode=provider_native 且 mentionJudgment=adjudicable；离线排除为 offline_not_applicable |

completed 且 mentions=[] 是有效的零提及/零推荐回答；unknown 或解析失败没有这些比例的有效分母。对象域名为 null 时，正文域名与引用不会命中，但当前代码仍可保留其合格 K 分母。

身份匹配在响应之后按规范化名称/别名或规范化域名精确查找，只有一个匹配对象时成功；多个匹配为 unresolved。匹配不要求名称和域名同时一致，也不是外部身份事实核查。

证据限制：正面推荐和先后指标直接采用模型给出的结构化标签；虽然保存片段与 UTF-16 偏移并尝试定位，统计没有强制要求片段非空/有效，没有通过偏移重新求最先位置。因此应称“本次结构化回答报告的正面推荐/唯一首位”，并检查原文，不能声称全部先后关系已独立验证。

引用资格使用配置模式，不检查 Attempt 中实际 used/usedMode 是否确认联网；来源集合也未排除 provider_search_result。因此当前图表名称里的“官网 Citation”并不自动证明是答案引用，更不能证明该网页导致推荐。真实来源分类须回到 [证据模型](evidence-model.md)。

## 同回答的推荐差值

`recommendation_gap` 以目标为 objectId、确认身份的竞品为 comparisonObjectId：

```text
value = 目标 positive_recommendation 百分比 - 竞品 positive_recommendation 百分比
单位 = percentage_points（百分点）
```

`pairedRecommendationGap()` 要求两个输入都是正面推荐指标，runId、modelId、搜索配置、keywordId 相同，分母相等且大于 0，samples 长度相同，并按数组位置逐个核对 probeRunId 相同。不符合则 null。输出保留目标分子/分母和 comparisonNumerator/comparisonDenominator。

这是同一批回答上的配对差值，不是两个独立百分比的相对增长率，也不代表市场份额。当前函数没有额外逐项比较 included 掩码/Attempt ID，复核仍应核对组成样本；不能拿不同关键词、不同模型或联网与离线的结果直接相减。

## 首次尝试策略及当前缺口

统计的 `firstAttempt()` 只选择 `probe.firstAttemptId`，sample.attemptId 和正文域名检测读取该尝试。重试追加 Attempt，不增加 Probe，所以不会简单地增加样本总数。

**但是当前结果和引用按 Probe 存一份，而非按 Attempt 存一份。**`probeDetail()` 返回该 Probe 最新写入的 domainResult/keywordResult/mentions/evidence，统计同时采用它们。若首次失败、重试成功，可能出现 sample.attemptId 指向首次失败，分子/分母或引用却来自重试成功的情况。这是实现缺口，不能写成首次失败始终不会被修复结果替代。

统计快照 ID 只使用 Run、Probe 和首次 Attempt ID 列表，不包含结果内容、Attempt 状态、公式版本或引用 Hash。提前构建的快照或重试前构建的快照可能持续被复用。公开计算前应等全部计划 Probe 终态，并核对引用/result.attemptId 与 sample.attemptId；出现不一致时标为待复核，保留原始记录，不选择更有利的一次。

初始认知报告另用 currentAttemptId，且可能存在截断重试，不适用图表的首次样本政策。报告中的识别状态和测量点不同，不能直接混合计算一个 D 成功率。

## 一个点、一条线与时间窗口

所有上表指标都按一次 Run、模型、对象和相应关键词生成点，observedAt 为 Run.startedAt 或回退 createdAt。不是单次回答的完成时间，也不是生成统计、导出或截图时间。不同模型点各自保留分母，不平均成未经定义的综合分数。

探针 fingerprint 包含 Provider/model、请求搜索模式、协议 ID/version、语言、scenario、subject、repetitions、temperature/maxTokens、matchingRuleVersion。K 还包含所有合格 K 词排序后的 keywordSetHash；D 的 keywordSetHash 当前为 null。指纹不包含基线 ID、WatchSet ID、对象别名、实际搜索执行、上游模型版本或实际 Prompt/Schema Hash。

由此产生的边界：增加无关模型不要求给旧模型补测；新模型从自己的真实 Probe 开始。D 关键词相对权重在词集合改变后仍可能有相同指纹；K 的身份别名变化也未必改变指纹。比较时应另外检查范围和语义版本，不能仅依赖 fingerprint。

当前 [测量界面](../src/ui/product-phase5-app.ts) 提供全部时间及滚动 7/30/90 天，按手工/定时、搜索配置和历史停用模型筛选，没有按日选最后完整运行、没有置信区间或自动统计显著性计算。横轴按不同时间点等间隔排列，不按真实间隔比例排布；应从 Tooltip 阅读实际时间跨度。

绘图按 modelId + webSearchMode + fingerprint 分组。非 null 的 partial 点显示但会打断路径；单点只形成一个可见点，没有可用趋势线段。但 null 点先被过滤，前后有效点可能跨过缺失连接。关联图又没有按选中 keywordId 过滤或分组，多个监测词可能混入同一条序列。当前标题“每点完整运行”比实际按指标 complete 的门槛更强，应以样本明细为准。

## 复核步骤与结论范围

1. 固定项目、Run、模型、D/K、对象/关键词、请求与实际搜索条件和版本。
2. 用 measurement-stats 的 point samples 接口读取全部样本，包括未命中与排除项。
3. 核对 firstAttemptId、sample.attemptId、结果 attemptId、引用 attemptId 与原文一致。
4. 按对应指标重算分子/分母；相对权重另算关联总数，推荐差值核对相同 Probe 集合。
5. 同时报告有效样本、计划数、失败/排除、unknown、费用未知和具体时间。
6. 只有范围一致且证据完整的至少两次观察才描述变化；三次观察也不自动产生统计显著性。

本轮 [R02](../examples/cases/R02/README.md) 数据待补，没有可供本文复算的实测数字。Phase 6 的 20 域名是定向的软件/互联网产品集合，不是随机市场样本，不支持全行业结论。未列出竞品/词不等于现实中不存在；离线与联网差异不是模型优劣的独立实验；变化不证明 GEO 操作的因果效果。当前执行与费用缺口见 [限制](limitations.md)。
