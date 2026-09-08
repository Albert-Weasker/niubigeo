# 已知限制与待验证项

适用：2026-09-08 核对的当前 `src/product` 工作树，计划版本 **v0.2.0-rc.1，UNPUBLISHED**。以下是源码行为与缺口，不代表已执行回归测试或容器验收。后续修复应附相应验证，再更新适用范围。

## 发布与真实数据

Phase 6 的 [20 个案例](../examples/README.zh-CN.md) 已执行到终态，实际原文、失败和截图独立归档。预算上限为 USD 2，涵盖预检、失败、重试和搜索。R02/R04 的 K 中存在 JSON 解析失败，不能把运行器结束写成所有观察均成功。具体数字由账本和案例摘要生成，见[本版本说明](releases/v0.2.0-rc.1.md)。

实测模型为两路离线 `openai/gpt-4o-mini`、`google/gemini-2.5-flash-lite`，一路联网 `openai/gpt-4.1-mini`。本轮有实际 native 元数据、K 引用及到期调度记录，但不代表所有模型、所有路由都经过验证。

历史 Phase 5 acceptance-report 记录了 blocked、未完成真实 K/定时调用及当时缺少新预算。这是历史状态，不能延伸成当前仍未授权，也不能因已有旧测试 passed 就宣布本轮 rc_ready。当前需要实际终态、有效演示、容器/截图与最终冻结验证后才能判断发布门禁。

## 测量解释的边界

我们公开的是本次回答及其证据，无法据此读出模型内部的思考过程，也不能保证再次运行得到完全相同的答案。

- D 已点名域名，不能据复述域名称自然发现率；K 才是在中性词下观察未提示对象的回答。
- 描述、竞品和关联词是模型本次输出，不是事实核查、商业合作或全市场名单。无词/无竞品不等于现实不存在。
- Provider 引用、检索结果与回答链接不等价；引用不证明来源正确或因果影响。
- 当前 20 个域名是定向软件产品集合，案例语言也不同，不能据此做随机市场统计或跨语言排行榜。
- 三次短期观察不保证统计显著、长期稳定或优化有效；temperature=0 不保证完全相同输出。
- API 结果不是 ChatGPT、Gemini 等消费级网页客户端结果。OpenRouter 路由、联网方式和服务端配置应公开标记。

## 统计与证据缺口

**L01：首次 Attempt 与重试结果可能混用。** [measurement-stats.ts](../src/product/measurements/measurement-stats.ts) 选择 firstAttemptId，但 [measurement-store.ts](../src/product/measurements/measurement-store.ts) 的 results/evidence 按 Probe 保存并可被重试覆盖。统计可能使用第一次的 rawAnswer/ID 与后来一次的判断/引用。重试不增加 Probe 数，但当前不能保证统计始终只用首次尝试结果。

**L02：统计缓存不跟随结果状态或公式变化。** 快照 ID 只包含 Run/Probe/首次 Attempt ID，未纳入完成状态、派生结果、引用 Hash 或统计版本。在途时构建快照或重试后再次构建可能复用旧内容。代码也不要求整个 Run 已终态；尚未写出的 Probe 不计入该点 planned。公开数字应等待终态并核对所有样本。

**L03：图表缺失点和关键词分组修订。** 本轮复核发现关联图会混合多个关键词，R04 等案例受到影响。现已将关联图限定到当前 keywordId、把 keywordId 纳入序列身份，并保留 null 点作为断点；图表明细也保留缺失行。此修订不改任何原始回答或指标点数值。新增独立合成浏览器回归覆盖“有效－null－有效”和混词，最终验收状态见发布清单；旧候选截图不代表新版本。

**L04：指纹未覆盖所有比较条件。** D 指纹的 keywordSetHash 为 null，相对权重分母变化可能不改变指纹；对象别名/匹配范围、实际搜索路径、上游模型版本、实际 Prompt/Schema Hash 也未完整纳入指纹。不能把同 fingerprint 当作所有条件完全一致。图表横轴按观察时间点等间隔显示，不按真实时间跨度比例显示。

**L05：D 分母允许 unknown 与部分字段恢复。** 只排除不存在结果或 analysis_failed；domainRecognition=unknown/null、关键词字段缺失而回退空数组仍可能计入分母。关联次数在零分母时显示 value=0，但 pointState=no_data。必须同时披露分母和字段缺失，不能将其解读为已充分观察的零值。完整公式见 [测量方法](measurement-methodology.md)。

**L06：K 推荐与首位尚未强制验证文字证据。** 判断直接采用模型的 recommendation 与 unique/tied 等结构化标签；null/无效 evidence 不会自动排除该样本，first offset 也未用于独立重排。整体 completed 会使四个 judgment 都可判定，包括 mentions=[] 或首位 unresolved 的回答。用户仍需核对原文。

本轮只读审计实际发现 R06、R07、R10、R11、R19 共 7 项多个 unique 标签冲突，相关统计点仍为 0/1；这些点不能证明目标不是首先提及或首先推荐。8 条正面推荐的引用片段均能逐字回到原文，但片段存在不能解除首位判断冲突。机器记录位于本地 `validation/release-v0.2.0-rc.1/semantic-evidence-audit.json`。

**L07：对象提及与域名字面检测有局限。** brand_name_mention 可仅由精确域名匹配命中；domain_body_mention 是区分大小写的 includes，可命中 JSON 字段或更长字串，未验证独立名称/域名边界。身份匹配允许名称或域名其一相同，没有外部身份验证。

**L08：Provider 来源分类和资格不完全统一。** 认知路径要求 search.requested、标题和 Payload 路径；测量路径要求 Payload 路径但可缺标题。两者都未单独排除 provider_search_result。测量引用率以请求配置 provider_native 为联网分母资格，不强制核对实际 used 状态，也不执行报告同等的引用 Payload 路径检查。因此检索结果或未确认搜索行为可能被误读为已验证答案引用。

**L09：认知详情和固定报告的修订选择不同。** 详情可优先显示最新 AnalysisRevision；报告构建仅取 currentAttemptId 原始归档。最新修订甚至可能来自另一个旧 Attempt，所以须查看 sourceAttemptMap，不能假定“重新分析”已经同步到报告和 WatchSet 建议。

**L10：测量原文落盘顺序和数据完整性。** [measurement-service.ts](../src/product/measurements/measurement-service.ts) 先保存结果/证据，再保存含 rawAnswer/rawProviderResponse 的终态 Attempt。中断可能留下派生结果而没有原文。DomainProbeResult 没有完整保存 fieldIssues 和逐竞品关键词，精细复核仍需要原始 Payload。报告的 safeProviderResponse 只验证 JSON 可序列化，不执行脱敏。

**L20：原生搜索的 SDK 路径不能等同模型内建搜索。** [OpenRouter 搜索适配器](../src/providers/openrouter-native-search.ts) 虽请求 engine=native，但实际元数据可能为 native、sdk 或 unverified；SDK 和 native 都可能映射成 usedMode=provider_native，界面短标签不足以区分。必须披露 executionMode 与原始 server_tools 元数据。内建 grounding 的 alwaysOn 还可能令 used=true，即使执行确认标为 unverified。空文本会在适配器阶段报 empty_answer，工具/搜索元数据不保证随失败归档。JSON Schema 与 required 搜索工具的组合需要真实预检；目前不能声称三路模型的搜索/引用兼容性已经验证。详见 [证据模型](evidence-model.md)。

## 调度、预算与运行恢复

**L11：核心预算与案例预算不同。** 核心测量服务主要检查初始计划数不超过 requestLimit；dailyRequestLimit 在任务到期时按任务账本检查，tokenLimit/costLimitUsd 在核心执行中未形成逐请求强制闸门。手工测量、初始认知、额外重试不能据此保证累计账户费用不超限。调度对账只累加每个 Probe 最新一次费用，可能遗漏之前重试的费用。

Phase 6 案例路径另有 [StudyBudgetExecutor](../examples/lib/budget.mjs)，经 [隔离产品会话](../examples/lib/product-session.ts) 包装同一真实执行器：串行预约费用，持久化本阶段账本，遇到 unknown_cost 或累计预约超限停止新增调用，并将 Provider HTTP attempts 设为 1。本轮付费调用已使用该路径；它不代表默认部署的核心 server/worker 已具有相同累计预算保证。

**L12：任务绑定范围可能漂移。** [schedule-service.ts](../src/product/scheduling/schedule-service.ts) 创建任务保存 watchSetId；到期检查 activeBaselineId，但派发时调用测量服务的 current WatchSet。若同 Baseline 下更换范围，可能执行与任务保存范围不同的 Probe，plannedRequestCount/预约费用也可能过时。

**L13：skip/错过时间策略未完整兑现。** overlap、预算阻塞或归档等提前返回分支不 advanceTask，重复扫描发现旧 Occurrence 已存在后可卡在原 nextRunAt。正常派发从原 scheduledFor 推算下一次，长时间停机后可能逐次追赶旧时间，而不是完整跳过 missed occurrences。不能宣称现在完全实现“不补跑、不重叠、自动恢复”。

**L14：运行不是持久队列，防重不是全局事务。** server 为每个请求创建服务实例，手工运行的内存锁不能跨请求/进程统一串行；调度文件锁按任务隔离，不能消除不同任务之间项目级并发竞争。crash 可留下 running Attempt、planned/started Occurrence 或无租约的 lock。没有可保证恰好一次调用与自动回收的恢复器。

**L15：归档/删除不等于取消在途请求。** 项目归档不全面禁止手工认知/测量启动；软删除不立即停止已经开始的异步执行。清理项目应先暂停任务、结束在途请求，否则后续写入仍可能留下或重建项目子目录。恢复 archived/deleted 的项目时还应核对遗留任务和预算。

## 界面与部署

**L16：产品 UI 尚非完整双语。** 当前认知/测量页面包含简体中文硬编码，测量日期固定使用 zh-CN，模型回答语言 zh/en 并不代表界面已完整切换。双语 README/官网也不能作为产品全英文验收结果。旧 Playwright 配置还写死 macOS Chrome 路径，跨平台测试不能假定直接可运行。

**L17：模型与范围编辑有限。** 同一模型 ID 不能在同一选择集合里同时配置 off/provider_native。“只测试新增模型”按是否曾出现在历史 modelScope 判断，不要求历史执行成功，所以此前失败过的模型也不算新增。已有 active WatchSet 的新草稿复制原范围，不会自动吸收新报告关键词；核心中性词筛选只是身份子串排除，不能保证所有词都适合中性选型。

**L18：本地文件服务边界。** 当前没有登录、访问控制、TLS、多租户授权或完整路径安全审计；项目 ID/父级检查是组织数据的校验，不是公开部署的租户隔离。没有任意 SPA 路径回退，页面入口为根路径和 query。单文件原子写入不提供数据库级事务、跨进程快照或加密/防篡改存储。

**L19：候选尚未公开发布。** rc4 已使用当前产品 server、包含新 SVG、挂载完整 product-v2，并完成两架构运行、独立备份读取和前一本地候选回滚读取；53 张产品截图对应同一候选 Digest。公开 registry 拉取、官网部署和独立发布提交仍未验证。具体记录见[版本说明](releases/v0.2.0-rc.1.md)。没有自动 Legacy 迁移，不应运行旧 CLI 将旧数据当新协议结果。

## 处理与报告方式

保留问题涉及的原始 Attempt、任务、费用和旧快照，避免以替换数据掩盖缺口。公开数字附实际样本与来源，无法复核的指标标为待复核；未执行的验证明确未验证。修复后应针对受影响边界补验证，并同步 [架构](ARCHITECTURE.md)、[方法](measurement-methodology.md)、[证据](evidence-model.md) 与发布记录。
