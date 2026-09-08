<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/niubigeo-lockup.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/niubigeo-lockup-light.svg">
    <img src="assets/brand/niubigeo-lockup-light.svg" width="336" alt="NiubiGEO">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/Albert-Weasker/niubigeo/releases/tag/v0.2.0"><img src="assets/readme/version.svg" alt="NiubiGEO v0.2.0" width="172" height="28"></a>
  <a href="LICENSE"><img src="assets/readme/license.svg" alt="Apache-2.0" width="172" height="28"></a>
  <a href="docs/deployment/docker.md"><img src="assets/readme/self-hosted.svg" alt="Self-hosted" width="132" height="28"></a>
</p>

# AI 会推荐你的产品吗？谁出现在答案里？

**输入域名，对照不同模型的产品描述、推荐对象和引用来源。**

<p align="center">
  <strong><a href="https://github.com/Albert-Weasker/niubigeo">项目仓库</a> · <a href="README.md">English</a> · <a href="#quick-start">快速开始</a> · <a href="#cases">20 组真实案例</a> · <a href="https://github.com/Albert-Weasker/niubigeo/releases">发布版本</a> · <a href="https://github.com/Albert-Weasker/niubigeo/pkgs/container/niubigeo">容器镜像</a> · <a href="#docs">文档</a></strong>
  <br>
  <a href="#features">功能一览</a> · <a href="#how-to">使用流程</a> · <a href="#monitoring">持续监测</a> · <a href="#niubigeo-vs-commercial-ai-visibility-tools">工具对比</a> · <a href="#why">为什么做</a> · <a href="#sponsors">赞助商</a>
</p>

你做了产品、写了文档，也投入了推广。你想知道：当用户向 AI 寻找工具时，你的产品有没有机会出现在答案里？

**NiubiGEO 是一个开源的 AI 品牌可见度与竞争观察工具。** 从一个域名开始，查看不同模型如何描述你、提到哪些竞争对象，再通过关键词测试观察回答里出现了谁。点开结果，就能查看原始回答和返回的来源。

> **打破 GEO 报告黑盒，把证据交还给用户。**

---

## 用它看清什么？

- **AI 怎样理解你。** 它认为你的品牌叫什么、做什么业务？不同模型的描述是否一致？
- **回答里还有谁。** 模型把谁与你联系在一起？在关键词测试中，你和竞争对象有没有被提到？
- **哪些词与你有关。** 查看模型关联给你和各个竞争对象的关键词，找到值得进一步检查的差异。
- **结果从哪里来。** 查看原始回答、模型返回的引用，以及多次测试之间的变化。

<details>
<summary><strong>打开真实工作台截图：PostHog 的模型回答与证据入口</strong></summary>

[![PostHog：各模型的原始域名认知结果，含业务描述、竞争对象及证据入口](assets/screenshots/v0.2.0-rc.1/R04-models.png)](examples/cases/R04/README.zh-CN.md)

*查看模型实际说了什么，再打开来源核对。来自 2026-09-08 的真实归档截图。[查看 PostHog 案例](examples/cases/R04/README.zh-CN.md)。*

</details>

<a id="quick-start"></a>
<a id="3-minute-audit"></a>

## 开始使用

**想先看看效果？[直接打开 20 组真实案例](examples/README.zh-CN.md)。** 不需要安装，也不需要 API Key。

想测试自己的产品，准备 Node.js 22+ 和自己的 OpenRouter API Key：

```bash
git clone --branch v0.2.0 --depth 1 https://github.com/Albert-Weasker/niubigeo.git
cd niubigeo
npm ci
cp .env.example .env
```

在 `.env` 中填写 `OPENROUTER_API_KEY`，然后启动：

```bash
npm run server
```

打开 [**http://localhost:8787**](http://localhost:8787)，开始创建项目。

也可以按 [Docker 部署说明](docs/deployment/docker.md) 运行，已有用户请查看 [备份与升级](docs/upgrade.md)。

<a id="how-to"></a>

## 怎么使用

1. **输入域名。** 创建你的产品项目，项目会先保存下来。
2. **选择模型。** 搜索并选择一个或多个模型，分别设置是否联网。
3. **保存配置，开始测试。** 每个模型独立回答；一个模型失败，其他结果仍可查看。
4. **打开结果。** 查看品牌描述、竞争对象、关键词和来源。想核对某条结论，就打开原始回答。
5. **继续观察。** 确认待测关键词后进行关键词测试；重复运行或设置定时监测，积累可以比较的记录。

第一次可以只选一个模型，了解结果后再增加。阅读案例免费；测试自己的项目会消耗所选模型及搜索服务的 API 额度。

<a id="features"></a>

## 从一次回答，到持续观察

| 你想做什么 | NiubiGEO 提供什么 |
| :--- | :--- |
| **管理多个产品** | 每个域名有独立项目、配置、运行记录和证据。切换项目查看，不把不同产品混在一份报告里。 |
| **对照多个模型** | 搜索、筛选并选择 OpenRouter 模型；分别查看回答、结果和错误，失败模型可以单独重试。 |
| **自己决定是否联网** | 每个模型单独选择不联网或其支持的 Provider 原生联网方式，结果保留实际执行条件。 |
| **看清品牌与竞争对象** | 并排查看模型描述的业务、类别、竞争对象，以及分别关联给它们的关键词。 |
| **测试没点名品牌时出现了谁** | 确认关键词后执行不包含目标品牌名的关键词测试，查看实际提及、推荐及原文。 |
| **检查每条结果的证据** | 原始回答、原文位置、Provider Citation、正文普通 URL 分别展示，失败与无法确认的记录保留。 |
| **积累后续观察** | 保存待测范围，重复测量或设置定时任务；从历史记录与数据点回到组成结果的回答。 |

<a id="monitoring"></a>

### 持续测量与定时监测

第一次域名认知让你看到模型本次怎样描述产品；确认竞争对象与关键词后，可以继续测量同一范围，或创建定时任务。模型选择改变后保留旧记录，新模型不会凭空拥有历史数据。

定时执行需要同时启动 [监测 worker](docs/deployment/docker.md#显式启用-worker)。[PostHog 的三轮真实记录](examples/cases/R04/README.zh-CN.md) 包含定时触发，可逐轮查看回答与失败；几分钟的复测不代表长期增长。

**[完整工作原理](docs/how-it-works.md)** · [指标与可比条件](docs/measurement-methodology.md) · [已知问题](docs/known-issues.md)

<a id="cases"></a>

## 先看三个真实例子

| Notion | Figma | PostHog |
| :--- | :--- | :--- |
| [模型怎样理解产品](#case-notion) | [不点名品牌时出现了谁](#case-figma) | [来源与复测记录](#case-posthog) |

<a id="case-notion"></a>

### Notion · 同一个产品，模型理解的重点不同

对 `notion.so` 的测试中，模型分别强调了笔记、工作空间和协作，列出的竞争对象也不完全相同。

把回答并排放在一起，就能看到产品的哪些能力被提到、哪些没有出现，以及模型把它与谁放在一起比较。

这些是本次回答中的描述，点名域名后的识别不等于主动推荐。

**[查看 Notion 的品牌描述与竞争对象](examples/cases/R08/README.zh-CN.md)**

<details>
<summary>查看 Notion 的真实模型结果截图</summary>

![Notion：三个模型分别返回的业务、竞争对象和关键词](assets/screenshots/v0.2.0-rc.1/R08-models.png)

</details>

<a id="case-figma"></a>

### Figma · 没有点名品牌，回答里会出现谁？

在未点名 Figma 的 **Prototyping** 关键词测试中，两条离线回答主要解释原型设计的概念；一条请求联网的回答出现了 Figma，并描述了它的原型能力。

这里能看到的是：哪些回答出现了具体产品，哪些只解释了概念。出现品牌、正面描述和明确推荐，需要分别判断。

> Figma’s prototyping tools make it easy to build and share high-fidelity, no-code, interactive prototypes.

*模型原文节选：[GPT-4.1 mini · 请求原生联网](examples/cases/R14/README.zh-CN.md#attempt-2afd57bb-3566-40f2-b339-995bd17b3687)。*

**[查看 Figma 的关键词测试](examples/cases/R14/README.zh-CN.md)**

<a id="case-posthog"></a>

### PostHog · 一个来源链接，可以查到哪里？

在 PostHog 案例的 **Feature Flags** 测试中，模型响应返回了指向 Splunk 博客等页面的引用。NiubiGEO 将这些引用与回答正文里普通出现的网址分开保存。

你可以从来源打开对应回答，核对它出现在哪里。引用能帮助检查这次回答，但不能单凭一个链接断定它导致了模型推荐。

这个案例还包含三次短间隔复测与一次定时触发，可查看每轮结果和失败记录；这些记录用于演示复测，不代表长期增长趋势。

**[查看 PostHog 的来源与复测记录](examples/cases/R04/README.zh-CN.md)**

### 还有 17 个产品

本批案例覆盖 **20 个真实域名**，每个域名至少取得一条可分析的域名回答，其中 **11 例还执行了关键词测试**。每个案例都有具体测试条件、结果、原始回答和截图，也保留失败与无法确认的记录。

**[浏览完整案例库](examples/README.zh-CN.md)** · [查看已知问题](docs/known-issues.md)

---

<a id="niubigeo-vs-commercial-ai-visibility-tools"></a>

## NiubiGEO 与商业 AI 可见度工具，怎么选？

**选择 NiubiGEO：** 你希望免费获取源码、自行部署、使用自己的 Key 选择模型，并从域名认知和关键词测试回到原始证据。模型、搜索和部署费用由你承担。

**考虑商业平台：** 如果你更需要托管服务、营销工作流或现成的搜索数据，可以按下面的侧重点了解各产品。

| 工具与官网 | 值得了解它的情况 |
| :--- | :--- |
| [Profound](https://www.tryprofound.com/) | AI 品牌监测、提问需求数据与内容营销工作流。 |
| [Peec AI](https://peec.ai/) | 面向营销团队的 AI 搜索分析与品牌表现追踪。 |
| [Otterly.AI](https://otterly.ai/) | AI 搜索监测、内容审计与优化建议。 |
| [Semrush AI Visibility](https://www.semrush.com/pricing/ai/) | 在 Semrush 产品体系中查看 AI 可见度与品牌表现。 |
| [Ahrefs Brand Radar](https://ahrefs.com/brand-radar) | 品牌可见度索引、自定义问题追踪和搜索数据。 |
| [AthenaHQ](https://athenahq.ai/) | AI 搜索来源分析、内容缺口识别与行动建议。 |
| [Scrunch](https://scrunch.com/) | 品牌监测、引用分析，以及面向 AI 代理的内容交付。 |

*这是基于各产品官网的选型建议，不是同条件性能测试或排名；资料核对于 2026-09-08，当前套餐与能力以链接中的官网为准。*

<a id="why"></a>

## 为什么做 NiubiGEO？

做产品的人，关心的不只是一个分数。我们想知道：自己的产品有没有被看见，哪里被理解错了，竞争对象为什么出现在这份回答里，以及下一步该检查什么。

如果一份报告没有原文、来源和测试条件，就很难判断这些结论是否值得相信，更难决定把时间和预算花在哪里。

NiubiGEO 想让这件事变得具体：看到不同模型的回答，找到描述与关键词上的差异，打开来源核查，再继续观察。没有证据的地方，留下“无法确认”；失败的运行，也留下记录。

### 我们希望走向哪里

让开发者、小团队和品牌都能自己检查 AI 如何描述自己的产品。

发现描述不准确，可以回头检查官网和文档；看到竞争对象关联了不同关键词，可以研究这些差异是否与你的业务有关；修改内容后，可以继续测试，观察后续回答。

我们希望 NiubiGEO 帮你找到值得行动的问题，并留下之后可以复查的记录。它不会承诺发一篇文章就能被 AI 推荐，也不会把一次回答当成永久排名。

<a id="community"></a>

## 开源、费用与社区

Community Edition 使用 **[Apache-2.0](LICENSE)** 许可证，免费开源、支持自托管。你使用自己的 API Key，自行承担模型、搜索服务和部署成本。

想贡献代码、反馈问题，或加入讨论，直接提交 [Issue](https://github.com/Albert-Weasker/niubigeo/issues) 或 [Pull Request](https://github.com/Albert-Weasker/niubigeo/pulls) 即可。

<a id="sponsors"></a>

## 赞助商

感谢以下赞助商对 NiubiGEO 开源开发的支持。

<p align="center">
  <a href="https://www.niubistar.com/"><strong>NiubiStar</strong></a>
</p>

<a id="docs"></a>

## 文档与项目入口

[项目仓库](https://github.com/Albert-Weasker/niubigeo) · [发布版本](https://github.com/Albert-Weasker/niubigeo/releases) · [容器镜像](https://github.com/Albert-Weasker/niubigeo/pkgs/container/niubigeo) · [问题反馈](https://github.com/Albert-Weasker/niubigeo/issues) · [参与开发](https://github.com/Albert-Weasker/niubigeo/pulls)

- [工作原理](docs/how-it-works.md) · [架构说明](docs/ARCHITECTURE.md)
- [测量方法](docs/measurement-methodology.md) · [来源与证据](docs/evidence-model.md)
- [部署](docs/deployment/docker.md) · [备份与升级](docs/upgrade.md)
- [已知问题](docs/known-issues.md) · [能力边界](docs/limitations.md) · [发布说明](https://github.com/Albert-Weasker/niubigeo/releases/tag/v0.2.0)
- [贡献指南](CONTRIBUTING.md) · [安全政策](SECURITY.md) · [许可证](LICENSE)

---

NiubiGEO 观察的是 Provider API 回答，不代表消费端聊天页面的结果；不联网与联网测试分开理解。目前不提供传统搜索引擎排名监测。
