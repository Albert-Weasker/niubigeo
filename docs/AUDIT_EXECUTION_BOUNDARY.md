# NiubiGEO 审计执行边界设计

## 1. 目标

NiubiGEO 的正式审计只承担三件事：

1. 把用户确认的问题原样提交给目标 Provider。
2. 保存 Provider 的实际回答、原生搜索状态和引用。
3. 在回答已经安全保存后，生成可以降级但不能销毁原始结果的分析与报告。

网站预分析、问题建议和品牌画像属于准备阶段。它们可以帮助用户准备审计，但不能决定正式审计是否可以执行，也不能向被测试模型提供目标网站内容。

## 2. 不可破坏的系统约束

- 不使用任何正则表达式，也不使用 `RegExp` 构造器。
- 不为品牌、域名、语言、模型、行业或测试案例增加专用分支。
- 不通过错误消息文本判断错误类型，所有错误必须来自结构化错误码。
- 已确认的域名、品牌、问题、模型、语言和联网状态由确定性代码生成运行计划。
- 网站抓取失败不能阻止正式 Provider 请求。
- 网站正文、SEO 字段、README 和画像结果不能进入正式 Provider 问题。
- Provider 返回的非空回答必须先持久化，再运行任何分析。
- 后置分析失败不能把 Provider 成功改写成 Provider 失败。
- AI 不认识品牌、回答错误、没有引用或没有搜索结果都是有效观察。
- 测试预期值只属于验证器，不得进入 Provider 请求或业务分析上下文。

## 3. 三条互相隔离的链路

### 3.1 准备链路

```text
域名
-> 尝试抓取公开站点
-> 可选的结构化品牌画像
-> 生成品牌、别名、关键词和问题建议
-> 用户确认
```

输出是 `PreparationResult`。准备失败只能产生 `unavailable`，不能抛出阻断正式审计的业务异常。

### 3.2 正式审计链路

```text
ConfirmedAuditSpec
-> QuestionAdmission
-> DeterministicPlanBuilder
-> 创建 Run 与 Observation 占位记录
-> 调用目标 Provider
-> 立即保存原始回答
```

这条链路不能导入网站证据模块、品牌画像模块、Prompt 生成器或 LLM 分类器。

### 3.3 后置分析链路

```text
已保存的 ProviderAnswer
-> 意图与任务分析
-> 品牌、候选、推荐和实体分析
-> 引用归类
-> 报告模型
-> HTML / Markdown / JSON
```

后置分析可以失败或部分完成，但必须保留正式回答并生成降级报告。

## 4. 核心对象

### 4.1 用户确认后的输入

```ts
interface ConfirmedAuditSpec {
  projectId: string;
  domain: string;
  target: {
    name: string;
    aliases: string[];
  };
  questions: ConfirmedQuestion[];
  providerTargets: ProviderTarget[];
  language: string;
  runCountPerQuestion: number;
  scopeConfirmed: true;
}

interface ConfirmedQuestion {
  id: string;
  text: string;
  enabled: boolean;
  declaredIntents: BrandQuestionIntent[] | null;
}
```

`declaredIntents` 是用户明确选择或已确认问题自带的元数据。没有时保存为 `null`，不得为了填满它而在正式审计前调用 LLM。

### 4.2 网站准备结果

```ts
interface PreparationResult {
  status: "available" | "unavailable";
  domain: string;
  profile: SuggestedBrandProfile | null;
  evidence: SitePreparationEvidence[];
  failure: PreparationFailure | null;
  providerCalls: string[];
}
```

`PreparationResult` 不属于 `ConfirmedAuditPlan` 的执行上下文。项目可以保存它供用户回看，但 `AuditExecutor` 不接受这个类型作为参数。

### 4.3 确定性运行计划

```ts
interface ConfirmedAuditPlan {
  id: string;
  projectId: string;
  target: Entity;
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  language: string;
  runCountPerPrompt: number;
  promptSetHash: string;
  plannedObservationCount: number;
  createdAt: string;
}
```

`DeterministicPlanBuilder.build(spec)` 是纯函数。相同输入必须得到相同的提示集合、Provider 目标和可比性哈希。计划 ID 和创建时间由外层工厂提供，避免纯函数内部依赖当前时间。

### 4.4 网站状态与 AI 结果分离

```ts
interface ObservationExecution {
  sitePreparationStatus: "available" | "unavailable" | "not_requested";
  providerAnswerStatus: "pending" | "completed" | "empty" | "failed";
  providerSearchUsed: boolean;
  providerSearchMode: "none" | "provider_native" | "provider_always_on" | "unverified";
  brandRecognition: "recognized" | "not_recognized" | "unclear" | null;
  providerCitations: Citation[];
  rawAnswer: AnswerResult | null;
  analysisStatus: "pending" | "completed" | "partial" | "failed";
  reportStatus: "pending" | "completed" | "degraded" | "failed";
}
```

`null` 只表示尚未执行或没有生成。`false`、`not_recognized` 和空引用数组都是完成后的真实结果。

## 5. 确定性准入

### 5.1 身份检查

身份检查只做确定性文本包含判断：

1. 对问题和已确认身份锚点执行 Unicode `NFKC` 规范化。
2. 使用语言无关的大小写折叠。
3. 使用普通字符串 `includes` 检查品牌名、规范化域名或用户确认别名。
4. 不使用分词规则、关键词表、正则或语言专用处理。

### 5.2 产品相关性

代码不能靠行业关键词确定语义相关性。相关性由用户确认行为表达：

- UI 中，用户在问题确认步骤完成确认后设置 `scopeConfirmed: true`。
- API 和 CLI 中，调用方必须明确提交确认标记。
- 冻结回归 Manifest 由套件声明其问题已经人工确认。
- 未确认的问题返回 `scope_confirmation_required`，不调用 Provider。

这样既保持“问题必须和目标品牌直接相关”的产品边界，又不引入语言词表、品牌规则或脆弱的前置 LLM JSON。

## 6. 执行状态机

```text
spec_received
-> admission_passed
-> plan_created
-> run_created
-> provider_request_started
-> provider_answer_persisted
-> analysis_started
-> analysis_completed | analysis_partial | analysis_failed
-> report_completed | report_degraded
```

每个状态只能向前推进。后置步骤失败不能回退或删除前面已经持久化的数据。

### 写入顺序

1. 创建 `Run`。
2. 为每个问题和模型创建 `Observation` 占位记录。
3. Provider 返回后立即写入原始请求、原始响应、回答文本、引用、搜索状态、Token、成本和时间。
4. 标记 `providerAnswerStatus`。
5. 单独运行分析，并增量写入分析结果。
6. 根据当前可用字段生成完整或降级报告。

报告质量门不能包围原始回答保存。质量门只能决定报告是 `completed` 还是 `degraded`。

## 7. 结构化 AI 输出网关

需要结构化输出的后置任务统一走 `StructuredAnalysisGateway`：

```ts
interface StructuredAnalysisGateway {
  run<T>(request: {
    purpose: AnalysisPurpose;
    schemaName: string;
    schema: JsonSchema;
    input: unknown;
    validate: (value: unknown) => ValidationResult<T>;
  }): Promise<StructuredAnalysisResult<T>>;
}
```

规则：

1. 首次请求必须携带 JSON Schema。
2. Provider 不支持 Schema 时，该能力标记为 `unsupported`，不能静默退回自由文本 JSON。
3. Schema 响应解析或校验失败时，只允许一次结构化修复请求。
4. 修复请求仍携带同一 Schema，并只接收上一轮原始输出和校验错误结构。
5. 第二次失败后返回 `analysis_failed`，不得抛出导致回答丢失的异常。
6. 字段缺失使用 `null`、`unknown` 或空数组，不得把未知伪装成否定结论。

修复逻辑不使用字符串截取猜测 JSON，也不使用错误消息包含判断。

## 8. Provider 边界

拆分 Provider 接口：

```ts
interface AnswerProvider {
  answer(input: AuditAnswerRequest): Promise<ProviderAnswerOutcome>;
}

interface StructuredProvider {
  structured<T>(input: StructuredRequest<T>): Promise<StructuredOutcome<T>>;
}
```

正式问题只通过 `answer()`。站点准备和后置分析只能通过各自明确的调用用途进入 Provider 网关。

`AuditAnswerRequest` 只允许包含：

- 用户确认的问题；
- 回答语言；
- 模型；
- 最大输出长度；
- 是否开启 Provider 原生搜索。

类型中不提供站点正文、SEO、README、竞品画像或推荐问题字段，从编译边界上禁止注入。

## 9. 错误模型与重试

所有 Provider 适配器返回结构化失败：

```ts
type ProviderFailureCode =
  | "authentication"
  | "billing"
  | "rate_limited"
  | "timeout"
  | "upstream_unavailable"
  | "unsupported_capability"
  | "empty_answer"
  | "invalid_response"
  | "unknown";
```

重试策略按错误码决定，不读取错误消息文本：

- `rate_limited`、`timeout`、`upstream_unavailable` 可以按统一策略重试。
- `empty_answer` 可以增加输出上限后重试。
- `authentication`、`billing`、`unsupported_capability` 不重试。
- 每次重试作为独立调用写入调用账本。

网站抓取也返回结构化 `PreparationFailureCode`，但无论失败类型是什么都不会阻断已确认审计。

## 10. 调用与费用账本

所有模型调用必须经由 `MeteredProviderGateway`：

```ts
type ProviderCallPurpose =
  | "site_preparation"
  | "prompt_generation"
  | "question_classification"
  | "audit_answer"
  | "answer_analysis"
  | "report_analysis"
  | "structured_repair";

interface ProviderCallLedgerEntry {
  id: string;
  parentCallId: string | null;
  projectId: string | null;
  runId: string | null;
  observationId: string | null;
  purpose: ProviderCallPurpose;
  providerId: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  outcome: "completed" | "empty" | "failed";
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  failureCode: ProviderFailureCode | null;
}
```

测试报告分别统计每个 `purpose` 的调用次数、成功数、重试数、Token 和费用。`auditCalls` 只统计 `purpose === "audit_answer"`，不再通过是否存在报告或字符串日志反推。

## 11. 三种入口共用一个执行核心

### 交互式项目

```text
可选 SitePreparationService
-> 用户确认 ConfirmedAuditSpec
-> DeterministicPlanBuilder
-> AuditExecutor
```

### 定时监测

```text
ActiveBaseline
-> ConfirmedAuditSpecAdapter
-> DeterministicPlanBuilder
-> AuditExecutor
```

### 冻结回归测试

```text
FrozenManifestCase
-> ValidationCaseAdapter
-> ConfirmedAuditSpec
-> DeterministicPlanBuilder
-> AuditExecutor
```

三种入口只能在 Spec 适配阶段不同。正式计划和执行器完全共用，不能在 `src` 中判断 case ID、域名或品牌。

`expectedIntents` 保留在验证器的 `oracle` 中，不传给 Provider，也不写入后置分析输入。验证器用它检查独立产生的分析结果，避免测试答案提前泄漏给系统。

## 12. 模块布局

```text
src/preparation/
  preparation-schema.ts
  site-preparation-service.ts

src/admission/
  question-admission.ts
  admission-schema.ts

src/planning/
  confirmed-audit-spec.ts
  deterministic-plan-builder.ts

src/execution/
  audit-executor.ts
  observation-recorder.ts
  execution-state.ts

src/structured/
  structured-analysis-gateway.ts
  schema-validation.ts

src/telemetry/
  provider-call-ledger.ts
  metered-provider-gateway.ts

src/validation/
  validation-case-adapter.ts
  validation-oracle.ts
```

现有模块迁移职责：

- `DomainProfiler` 和 `SiteEvidenceCollector` 只归入 `preparation`。
- `AuditPlanner` 拆出确定性计划构建，LLM Prompt 生成保留为确认前建议能力。
- `AuditRunner` 只保留执行编排，不再隐式调用规划器。
- `IntentResultPipeline` 迁入后置分析，失败返回状态而不是破坏运行。
- `FileStore` 增加增量写入，不再等整份报告完成后一次保存。

## 13. 实施任务

### 阶段 A：建立边界

1. 新增 `ConfirmedAuditSpec`、`PreparationResult`、`ProviderAnswerOutcome` 和调用账本类型。
2. 实现确定性 `QuestionAdmission` 和 `DeterministicPlanBuilder`。
3. 让 `AuditRunner` 必须接收已确认计划，删除隐式递归规划。
4. 将站点准备移出正式执行依赖图。

### 阶段 B：先保存回答

5. 创建 Run 和 Observation 占位记录。
6. Provider 返回后立即增量保存原始结果。
7. 将响应分析、竞品发现、意图分析和报告构建改成后置步骤。
8. 增加降级报告，保证非空回答必有报告。

### 阶段 C：结构化输出与费用

9. 增加统一 JSON Schema 网关和一次结构化修复。
10. 删除自由文本 JSON 回退和 JSON 容器猜测。
11. 将错误消息匹配改为 Provider 适配器返回的错误码。
12. 所有 Provider 调用接入阶段账本。

### 阶段 D：验证入口

13. 重写真实套件入口，用 Manifest 直接构建 `ConfirmedAuditSpec`。
14. 将 `expectedIntents` 移到验证 Oracle，避免影响被测流程。
15. 保存代码哈希、Manifest 哈希、逐阶段调用记录和每例状态机。
16. 确认验证输出目录与用户项目目录完全隔离。

### 阶段 E：禁止偷懒的静态约束

17. 使用 TypeScript AST 检查生产代码中不存在正则字面量和 `RegExp` 构造。
18. 使用 AST 和 Manifest 数据检查 `src` 中不存在测试品牌、域名或 case ID 字面量。
19. 检查执行模块的 import graph，禁止依赖 preparation、关键词采集或 Prompt 生成模块。
20. 检查正式 Provider 请求快照，确保不包含网站正文、SEO、README 或准备结果。

## 14. 测试顺序与收口规则

修改代码期间不执行冻结真实套件。代码达到静态测试和单元测试要求后冻结代码，再按以下顺序执行：

1. `case-31` 单例 Smoke。
2. `case-31`、`case-34`、`case-41` 三例 Smoke。
3. 未修改的 20 例 Manifest 完整运行。

每一轮都记录代码哈希和 Manifest 哈希。真实测试开始后不得修改代码、Manifest、问题、模型或期望值。即使前几个案例失败，也必须让该轮全部结束并保存完整 JSON 报告。只有一轮结束后才能根据报告修改代码，然后开始全新轮次。

每个案例必须输出：

```json
{
  "admission": {},
  "plan": {},
  "project": {},
  "run": {},
  "providerAnswer": {},
  "analysis": {},
  "report": {},
  "providerCallsByPurpose": {},
  "artifacts": {},
  "checks": {}
}
```

## 15. 完成标准

- 20 个案例都生成确定性计划和项目隔离记录。
- 20 个案例都实际产生 `audit_answer` 调用。
- 不存在前置计划 JSON 解析失败。
- 站点准备失败不会阻止正式回答。
- 正式请求中不存在站点准备内容。
- Provider 非空回答在后置分析前已经持久化。
- 分析失败时仍生成包含原始回答的降级报告。
- 不认识、无引用、回答错误都能作为真实结果呈现。
- 调用次数和费用可以按阶段逐项核对。
- 代码和测试脚本不存在正则表达式。
- 生产代码不存在品牌、域名、语言或案例专用逻辑。

