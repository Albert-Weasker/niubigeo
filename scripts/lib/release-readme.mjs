const repository = 'https://github.com/Albert-Weasker/niubigeo';
const version = 'v0.2.0';

function headerNavigation(zh, caseCount) {
  const primary = [
    [repository, '项目仓库', 'GitHub'],
    [zh ? 'README.md' : 'README.zh-CN.md', 'English', '简体中文'],
    ['#quick-start', '快速开始', 'Quick start'],
    ['#cases', `${caseCount} 组真实案例`, `${caseCount} real cases`],
    [`${repository}/releases`, '发布版本', 'Releases'],
    [`${repository}/pkgs/container/niubigeo`, '容器镜像', 'Packages'],
    ['#docs', '文档', 'Docs'],
  ];
  const secondary = [
    ['#features', '功能一览', 'Features'],
    ['#how-to', '使用流程', 'How to use it'],
    ['#monitoring', '持续监测', 'Monitoring'],
    ['#niubigeo-vs-commercial-ai-visibility-tools', '工具对比', 'Compare tools'],
    ['#why', '为什么做', 'Why NiubiGEO'],
    ['#sponsors', '赞助商', 'Sponsors'],
  ];
  const render = links => links.map(([href, chinese, english]) => `<a href="${href}">${zh ? chinese : english}</a>`).join(' · ');
  return `<p align="center">\n  <strong>${render(primary)}</strong>\n  <br>\n  ${render(secondary)}\n</p>`;
}

// Release copy only. Case evidence and product behavior are not generated here.
export function releaseReadme(zh, coverage) {
  const filename = zh ? 'README.zh-CN.md' : 'README.md';
  const cases = `examples/${filename}`;
  const caseLink = id => `examples/cases/${id}/${filename}`;
  const release = `${repository}/releases/tag/${version}`;
  return [
    '<p align="center">',
    '  <picture>',
    '    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/niubigeo-lockup.svg">',
    '    <source media="(prefers-color-scheme: light)" srcset="assets/brand/niubigeo-lockup-light.svg">',
    '    <img src="assets/brand/niubigeo-lockup-light.svg" width="336" alt="NiubiGEO">',
    '  </picture>',
    '</p>',
    '',
    '<p align="center">',
    `  <a href="${release}"><img src="assets/readme/version.svg" alt="NiubiGEO ${version}" width="172" height="28"></a>`,
    '  <a href="LICENSE"><img src="assets/readme/license.svg" alt="Apache-2.0" width="172" height="28"></a>',
    '  <a href="docs/deployment/docker.md"><img src="assets/readme/self-hosted.svg" alt="Self-hosted" width="132" height="28"></a>',
    '</p>',
    '',
    `# ${zh ? 'AI 会推荐你的产品吗？谁出现在答案里？' : 'Does AI recommend your product? Who shows up instead?'}`,
    '',
    zh
      ? '**输入域名，对照不同模型的产品描述、推荐对象和引用来源。**'
      : '**Enter a domain. Compare how models describe your product, who they recommend, and which sources they cite.**',
    '',
    headerNavigation(zh, coverage.cases),
    '',
    zh
      ? '你做了产品、写了文档，也投入了推广。你想知道：当用户向 AI 寻找工具时，你的产品有没有机会出现在答案里？'
      : 'You have built a product, written the docs and worked to get the word out. When people ask AI for tools, does your product make it into the answer?',
    '',
    zh
      ? '**NiubiGEO 是一个开源的 AI 品牌可见度与竞争观察工具。** 从一个域名开始，查看不同模型如何描述你、提到哪些竞争对象，再通过关键词测试观察回答里出现了谁。点开结果，就能查看原始回答和返回的来源。'
      : '**NiubiGEO is an open-source tool for tracking brand visibility and competitors in AI answers.** Start with a domain to see how different models describe your product and which competitors they name. Then test keywords to find out who appears in the answers. Open any result to inspect the original response and returned sources.',
    '',
    zh ? '> **打破 GEO 报告黑盒，把证据交还给用户。**' : '> **Open the GEO reporting black box. Put evidence in your hands.**',
    '',
    `---`,
    '',
    `## ${zh ? '用它看清什么？' : 'What can you find out?'}`,
    '',
    zh
      ? '- **AI 怎样理解你。** 它认为你的品牌叫什么、做什么业务？不同模型的描述是否一致？\n- **回答里还有谁。** 模型把谁与你联系在一起？在关键词测试中，你和竞争对象有没有被提到？\n- **哪些词与你有关。** 查看模型关联给你和各个竞争对象的关键词，找到值得进一步检查的差异。\n- **结果从哪里来。** 查看原始回答、模型返回的引用，以及多次测试之间的变化。'
      : '- **How AI sees your product.** What does it call your brand, and what does it think you do? Do different models agree?\n- **Who else appears.** Which products does each model associate with yours? Do you or your competitors appear in keyword tests?\n- **Which words it associates with you.** Compare the keywords models connect to your brand and other products to find differences worth investigating.\n- **Where the results come from.** Inspect original answers, returned citations and changes across repeated tests.',
    '',
    `<details>\n<summary><strong>${zh ? '打开真实工作台截图：PostHog 的模型回答与证据入口' : 'See the workbench: PostHog model answers and evidence links'}</strong></summary>`,
    '',
    `[![${zh ? 'PostHog：各模型的原始域名认知结果，含业务描述、竞争对象及证据入口' : 'PostHog: individual domain recognition results, descriptions, competing products and evidence links'}](assets/screenshots/v0.2.0-rc.1/R04-models.png)](${caseLink('R04')})`,
    '',
    zh
      ? `*查看模型实际说了什么，再打开来源核对。来自 2026-09-08 的真实归档截图。[查看 PostHog 案例](${caseLink('R04')})。*`
      : `*Read what each model actually said, then open the sources to check. An original screenshot from the September 8, 2026 study. [Read the PostHog case](${caseLink('R04')}).*`,
    '',
    '</details>',
    '',
    '<a id="quick-start"></a>',
    '<a id="3-minute-audit"></a>',
    '',
    `## ${zh ? '开始使用' : 'Get started'}`,
    '',
    zh
      ? `**想先看看效果？[直接打开 ${coverage.cases} 组真实案例](${cases})。** 不需要安装，也不需要 API Key。`
      : `**Want to see it in action first? [Explore ${coverage.cases} real cases](${cases}).** No installation or API key needed.`,
    '',
    zh ? '想测试自己的产品，准备 Node.js 22+ 和自己的 OpenRouter API Key：' : 'To test your own product, you will need Node.js 22+ and your own OpenRouter API key:',
    '',
    '```bash',
    `git clone --branch ${version} --depth 1 ${repository}.git`,
    'cd niubigeo',
    'npm ci',
    'cp .env.example .env',
    '```',
    '',
    zh ? '在 `.env` 中填写 `OPENROUTER_API_KEY`，然后启动：' : 'Set `OPENROUTER_API_KEY` in `.env`, then start the app:',
    '',
    '```bash',
    'npm run server',
    '```',
    '',
    zh
      ? '打开 [**http://localhost:8787**](http://localhost:8787)，开始创建项目。'
      : 'Open [**http://localhost:8787**](http://localhost:8787) to create your first project.',
    '',
    zh
      ? '也可以按 [Docker 部署说明](docs/deployment/docker.md) 运行，已有用户请查看 [备份与升级](docs/upgrade.md)。'
      : 'Prefer a container? Follow the [Docker guide](docs/deployment/docker.md). Existing users should read [Backups and upgrades](docs/upgrade.md).',
    '',
    '<a id="how-to"></a>',
    '',
    `## ${zh ? '怎么使用' : 'How to use it'}`,
    '',
    zh
      ? '1. **输入域名。** 创建你的产品项目，项目会先保存下来。\n2. **选择模型。** 搜索并选择一个或多个模型，分别设置是否联网。\n3. **保存配置，开始测试。** 每个模型独立回答；一个模型失败，其他结果仍可查看。\n4. **打开结果。** 查看品牌描述、竞争对象、关键词和来源。想核对某条结论，就打开原始回答。\n5. **继续观察。** 确认待测关键词后进行关键词测试；重复运行或设置定时监测，积累可以比较的记录。'
      : '1. **Enter a domain.** Create a project for your product. It is saved before you start testing.\n2. **Choose your models.** Search for and select one or more models, then set web search separately for each.\n3. **Save your configuration and start a test.** Models answer independently. If one fails, the other results remain available.\n4. **Open the results.** Review descriptions, competitors, keywords and sources. Open the original answer to check a finding.\n5. **Keep observing.** Confirm the keywords you want to test, then run keyword tests. Repeat measurements or set up scheduled monitoring to collect comparable records.',
    '',
    zh
      ? '第一次可以只选一个模型，了解结果后再增加。阅读案例免费；测试自己的项目会消耗所选模型及搜索服务的 API 额度。'
      : 'Start with one model, then add more once you know what to look for. Reading the cases is free; testing your own project incurs model and search API charges.',
    '',
    '<a id="features"></a>',
    '',
    `## ${zh ? '从一次回答，到持续观察' : 'From one answer to ongoing observation'}`,
    '',
    zh ? '| 你想做什么 | NiubiGEO 提供什么 |' : '| What you want to do | What NiubiGEO provides |',
    '| :--- | :--- |',
    zh
      ? '| **管理多个产品** | 每个域名有独立项目、配置、运行记录和证据。切换项目查看，不把不同产品混在一份报告里。 |\n| **对照多个模型** | 搜索、筛选并选择 OpenRouter 模型；分别查看回答、结果和错误，失败模型可以单独重试。 |\n| **自己决定是否联网** | 每个模型单独选择不联网或其支持的 Provider 原生联网方式，结果保留实际执行条件。 |\n| **看清品牌与竞争对象** | 并排查看模型描述的业务、类别、竞争对象，以及分别关联给它们的关键词。 |\n| **测试没点名品牌时出现了谁** | 确认关键词后执行不包含目标品牌名的关键词测试，查看实际提及、推荐及原文。 |\n| **检查每条结果的证据** | 原始回答、原文位置、Provider Citation、正文普通 URL 分别展示，失败与无法确认的记录保留。 |\n| **积累后续观察** | 保存待测范围，重复测量或设置定时任务；从历史记录与数据点回到组成结果的回答。 |'
      : '| **Manage several products** | Each domain has its own project, configuration, runs and evidence. Switch projects without mixing products into one report. |\n| **Compare models** | Search, filter and select OpenRouter models. Inspect each model’s answer, result and errors, and retry a failed model separately. |\n| **Choose whether to use web search** | Set each model to offline or its supported native search mode. Results retain the actual execution conditions. |\n| **Understand brand and competitor descriptions** | Read business descriptions, categories, competing products and their associated keywords side by side. |\n| **See who appears without naming your brand** | Confirm keywords, then test them without including your target brand’s name. Inspect actual mentions, recommendations and original wording. |\n| **Check the evidence** | Original answers, text locations, Provider citations and ordinary answer URLs are shown separately. Failures and uncertainty remain on record. |\n| **Build a history** | Save what you want to measure, repeat tests or schedule them. Follow historical records and data points back to the answers behind them. |',
    '',
    '<a id="monitoring"></a>',
    '',
    `### ${zh ? '持续测量与定时监测' : 'Repeated measurements and scheduled monitoring'}`,
    '',
    zh
      ? '第一次域名认知让你看到模型本次怎样描述产品；确认竞争对象与关键词后，可以继续测量同一范围，或创建定时任务。模型选择改变后保留旧记录，新模型不会凭空拥有历史数据。'
      : 'The first domain test shows how models describe your product now. Confirm the competing products and keywords to measure that scope again or create a schedule. Previous records remain when your model selection changes; new models do not acquire invented history.',
    '',
    zh
      ? '定时执行需要同时启动 [监测 worker](docs/deployment/docker.md#显式启用-worker)。[PostHog 的三轮真实记录](examples/cases/R04/README.zh-CN.md) 包含定时触发，可逐轮查看回答与失败；几分钟的复测不代表长期增长。'
      : 'Scheduled execution requires the [monitoring worker](docs/deployment/docker.md#显式启用-worker) to be running. [PostHog’s three recorded measurements](examples/cases/R04/README.md) include a scheduled run, with answers and failures available for each. A few minutes of repeated tests do not establish long-term growth.',
    '',
    `**[${zh ? '完整工作原理' : 'How it works in detail'}](docs/how-it-works.md)** · [${zh ? '指标与可比条件' : 'Metrics and comparison conditions'}](docs/measurement-methodology.md) · [${zh ? '已知问题' : 'Known issues'}](docs/known-issues.md)`,
    '',
    '<a id="cases"></a>',
    '',
    `## ${zh ? '先看三个真实例子' : 'Three real examples'}`,
    '',
    '| Notion | Figma | PostHog |',
    '| :--- | :--- | :--- |',
    zh
      ? '| [模型怎样理解产品](#case-notion) | [不点名品牌时出现了谁](#case-figma) | [来源与复测记录](#case-posthog) |'
      : '| [How models describe a product](#case-notion) | [Who appears without naming a brand](#case-figma) | [Sources and repeated tests](#case-posthog) |',
    '',
    '<a id="case-notion"></a>',
    '',
    `### ${zh ? 'Notion · 同一个产品，模型理解的重点不同' : 'Notion · One product, different descriptions'}`,
    '',
    zh
      ? '对 `notion.so` 的测试中，模型分别强调了笔记、工作空间和协作，列出的竞争对象也不完全相同。'
      : 'In the `notion.so` test, models emphasized different aspects of the product: notes, a workspace and collaboration. They also named different competing products.',
    '',
    zh
      ? '把回答并排放在一起，就能看到产品的哪些能力被提到、哪些没有出现，以及模型把它与谁放在一起比较。'
      : 'Reading the answers side by side shows which capabilities each model mentioned, which it left out and which products it associated with Notion.',
    '',
    zh
      ? '这些是本次回答中的描述，点名域名后的识别不等于主动推荐。'
      : 'These are descriptions from this test. Recognizing a domain after being asked about it is not the same as recommending it unprompted.',
    '',
    `**[${zh ? '查看 Notion 的品牌描述与竞争对象' : 'Read Notion’s descriptions and competing products'}](${caseLink('R08')})**`,
    '',
    `<details>\n<summary>${zh ? '查看 Notion 的真实模型结果截图' : 'View Notion’s original model-results screenshot'}</summary>`,
    '',
    `![${zh ? 'Notion：三个模型分别返回的业务、竞争对象和关键词' : 'Notion: descriptions, competing products and keywords returned by three models'}](assets/screenshots/v0.2.0-rc.1/R08-models.png)`,
    '',
    '</details>',
    '',
    '<a id="case-figma"></a>',
    '',
    `### ${zh ? 'Figma · 没有点名品牌，回答里会出现谁？' : 'Figma · Who appears when the brand is not named?'}`,
    '',
    zh
      ? '在未点名 Figma 的 **Prototyping** 关键词测试中，两条离线回答主要解释原型设计的概念；一条请求联网的回答出现了 Figma，并描述了它的原型能力。'
      : 'In a **Prototyping** keyword test that did not name Figma, two offline answers mainly explained the concept of prototyping. An answer with web search requested named Figma and described its prototyping features.',
    '',
    zh
      ? '这里能看到的是：哪些回答出现了具体产品，哪些只解释了概念。出现品牌、正面描述和明确推荐，需要分别判断。'
      : 'This reveals which answers named an actual product and which only explained a concept. A brand mention, a positive description and an explicit recommendation are different things.',
    '',
    '> Figma’s prototyping tools make it easy to build and share high-fidelity, no-code, interactive prototypes.',
    '',
    zh
      ? `*模型原文节选：[GPT-4.1 mini · 请求原生联网](${caseLink('R14')}#attempt-2afd57bb-3566-40f2-b339-995bd17b3687)。*`
      : `*Excerpt from the original answer: [GPT-4.1 mini · native search requested](${caseLink('R14')}#attempt-2afd57bb-3566-40f2-b339-995bd17b3687).*`,
    '',
    `**[${zh ? '查看 Figma 的关键词测试' : 'Explore the Figma keyword test'}](${caseLink('R14')})**`,
    '',
    '<a id="case-posthog"></a>',
    '',
    `### ${zh ? 'PostHog · 一个来源链接，可以查到哪里？' : 'PostHog · Follow a source back to the answer'}`,
    '',
    zh
      ? '在 PostHog 案例的 **Feature Flags** 测试中，模型响应返回了指向 Splunk 博客等页面的引用。NiubiGEO 将这些引用与回答正文里普通出现的网址分开保存。'
      : 'In the **Feature Flags** test for PostHog, model responses returned citations to pages including a Splunk blog post. NiubiGEO stores these separately from ordinary URLs in the answer text.',
    '',
    zh
      ? '你可以从来源打开对应回答，核对它出现在哪里。引用能帮助检查这次回答，但不能单凭一个链接断定它导致了模型推荐。'
      : 'Follow a source to the corresponding answer and check where it appeared. A citation helps you inspect the response; it does not, by itself, explain why a model recommended something.',
    '',
    zh
      ? '这个案例还包含三次短间隔复测与一次定时触发，可查看每轮结果和失败记录；这些记录用于演示复测，不代表长期增长趋势。'
      : 'The case also includes three closely spaced measurements, one triggered by a schedule. Each run includes its results and failures. These records demonstrate repeated testing, not long-term growth.',
    '',
    `**[${zh ? '查看 PostHog 的来源与复测记录' : 'Explore PostHog’s sources and repeated measurements'}](${caseLink('R04')})**`,
    '',
    `### ${zh ? `还有 ${coverage.cases - 3} 个产品` : `${coverage.cases - 3} more products`}`,
    '',
    zh
      ? `本批案例覆盖 **${coverage.cases} 个真实域名**，每个域名至少取得一条可分析的域名回答，其中 **${coverage.k} 例还执行了关键词测试**。每个案例都有具体测试条件、结果、原始回答和截图，也保留失败与无法确认的记录。`
      : `The collection covers **${coverage.cases} real domains**, each with at least one analyzable domain answer. **${coverage.k} cases also ran keyword tests.** Every case includes its test conditions, results, original answers and screenshots, along with failures and unresolved findings.`,
    '',
    `**[${zh ? '浏览完整案例库' : 'Browse all cases'}](${cases})** · [${zh ? '查看已知问题' : 'Known issues'}](docs/known-issues.md)`,
    '',
    '---',
    '',
    '<a id="niubigeo-vs-commercial-ai-visibility-tools"></a>',
    '',
    `## ${zh ? 'NiubiGEO 与商业 AI 可见度工具，怎么选？' : 'Which AI visibility tool fits your team?'}`,
    '',
    zh
      ? '**选择 NiubiGEO：** 你希望免费获取源码、自行部署、使用自己的 Key 选择模型，并从域名认知和关键词测试回到原始证据。模型、搜索和部署费用由你承担。'
      : '**Choose NiubiGEO** when you want free access to the source, self-hosting, model choice with your own API key, and domain and keyword tests that you can trace back to the original evidence. You cover model, search and hosting costs.',
    '',
    zh
      ? '**考虑商业平台：** 如果你更需要托管服务、营销工作流或现成的搜索数据，可以按下面的侧重点了解各产品。'
      : '**Consider a commercial platform** when hosted services, marketing workflows or an existing search dataset matter more to you. The priorities below offer a starting point.',
    '',
    zh ? '| 工具与官网 | 值得了解它的情况 |' : '| Tool and official site | Consider it when you need |',
    '| :--- | :--- |',
    zh
      ? '| [Profound](https://www.tryprofound.com/) | AI 品牌监测、提问需求数据与内容营销工作流。 |\n| [Peec AI](https://peec.ai/) | 面向营销团队的 AI 搜索分析与品牌表现追踪。 |\n| [Otterly.AI](https://otterly.ai/) | AI 搜索监测、内容审计与优化建议。 |\n| [Semrush AI Visibility](https://www.semrush.com/pricing/ai/) | 在 Semrush 产品体系中查看 AI 可见度与品牌表现。 |\n| [Ahrefs Brand Radar](https://ahrefs.com/brand-radar) | 品牌可见度索引、自定义问题追踪和搜索数据。 |\n| [AthenaHQ](https://athenahq.ai/) | AI 搜索来源分析、内容缺口识别与行动建议。 |\n| [Scrunch](https://scrunch.com/) | 品牌监测、引用分析，以及面向 AI 代理的内容交付。 |'
      : '| [Profound](https://www.tryprofound.com/) | AI brand monitoring, prompt-demand data and content marketing workflows. |\n| [Peec AI](https://peec.ai/) | AI search analytics and brand-performance tracking for marketing teams. |\n| [Otterly.AI](https://otterly.ai/) | AI search monitoring, content audits and optimization guidance. |\n| [Semrush AI Visibility](https://www.semrush.com/pricing/ai/) | AI visibility and brand-performance tracking within the Semrush product suite. |\n| [Ahrefs Brand Radar](https://ahrefs.com/brand-radar) | A brand visibility index, custom prompt tracking and search data. |\n| [AthenaHQ](https://athenahq.ai/) | AI search citation analysis, content-gap discovery and action guidance. |\n| [Scrunch](https://scrunch.com/) | Brand monitoring, citation analysis and content delivery for AI agents. |',
    '',
    zh
      ? '*这是基于各产品官网的选型建议，不是同条件性能测试或排名；资料核对于 2026-09-08，当前套餐与能力以链接中的官网为准。*'
      : '*These are selection suggestions based on the linked official sites, checked on September 8, 2026, not a controlled benchmark or ranking. Check each vendor’s site for current plans and capabilities.*',
    '',
    '<a id="why"></a>',
    '',
    `## ${zh ? '为什么做 NiubiGEO？' : 'Why we built NiubiGEO'}`,
    '',
    zh
      ? '做产品的人，关心的不只是一个分数。我们想知道：自己的产品有没有被看见，哪里被理解错了，竞争对象为什么出现在这份回答里，以及下一步该检查什么。'
      : 'Product teams need more than a score. We want to know whether our product is being seen, where it is misunderstood, why a competitor appears in an answer and what to investigate next.',
    '',
    zh
      ? '如果一份报告没有原文、来源和测试条件，就很难判断这些结论是否值得相信，更难决定把时间和预算花在哪里。'
      : 'Without the original answers, sources and test conditions, it is hard to know which findings to trust or where to spend your time and budget.',
    '',
    zh
      ? 'NiubiGEO 想让这件事变得具体：看到不同模型的回答，找到描述与关键词上的差异，打开来源核查，再继续观察。没有证据的地方，留下“无法确认”；失败的运行，也留下记录。'
      : 'NiubiGEO makes those questions easier to investigate: read different models’ answers, spot differences in descriptions and keywords, check the sources and keep observing. Where the evidence is missing, the result stays uncertain. Failed runs stay on record, too.',
    '',
    `### ${zh ? '我们希望走向哪里' : 'Where we want to go'}`,
    '',
    zh
      ? '让开发者、小团队和品牌都能自己检查 AI 如何描述自己的产品。'
      : 'Give developers, small teams and brands a way to check for themselves how AI describes their products.',
    '',
    zh
      ? '发现描述不准确，可以回头检查官网和文档；看到竞争对象关联了不同关键词，可以研究这些差异是否与你的业务有关；修改内容后，可以继续测试，观察后续回答。'
      : 'An inaccurate description can point you back to your website or docs. Different keywords associated with competitors may reveal something worth investigating. After changing your content, you can test again and observe subsequent answers.',
    '',
    zh
      ? '我们希望 NiubiGEO 帮你找到值得行动的问题，并留下之后可以复查的记录。它不会承诺发一篇文章就能被 AI 推荐，也不会把一次回答当成永久排名。'
      : 'We want NiubiGEO to help you find questions worth acting on and keep a record you can revisit. Publishing an article does not guarantee an AI recommendation, and one answer is not a permanent ranking.',
    '',
    '<a id="community"></a>',
    '',
    `## ${zh ? '开源、费用与社区' : 'Open source, costs and community'}`,
    '',
    zh
      ? 'Community Edition 使用 **[Apache-2.0](LICENSE)** 许可证，免费开源、支持自托管。你使用自己的 API Key，自行承担模型、搜索服务和部署成本。'
      : 'Community Edition is free, open source and self-hosted under **[Apache-2.0](LICENSE)**. Bring your own API key and pay for the models, search services and hosting you use.',
    '',
    zh
      ? `想贡献代码、反馈问题，或加入讨论，直接提交 [Issue](${repository}/issues) 或 [Pull Request](${repository}/pulls) 即可。`
      : `To contribute code, report an issue or join the discussion, open an [Issue](${repository}/issues) or a [Pull Request](${repository}/pulls).`,
    '',
    '<a id="sponsors"></a>',
    '',
    `## ${zh ? '赞助商' : 'Sponsors'}`,
    '',
    zh ? '感谢以下赞助商对 NiubiGEO 开源开发的支持。' : 'Thank you to the sponsors supporting NiubiGEO’s open-source development.',
    '',
    '<p align="center">',
    '  <a href="https://www.niubistar.com/"><strong>NiubiStar</strong></a>',
    '</p>',
    '',
    '<a id="docs"></a>',
    '',
    `## ${zh ? '文档与项目入口' : 'Documentation and project links'}`,
    '',
    zh
      ? `[项目仓库](${repository}) · [发布版本](${repository}/releases) · [容器镜像](${repository}/pkgs/container/niubigeo) · [问题反馈](${repository}/issues) · [参与开发](${repository}/pulls)`
      : `[GitHub repository](${repository}) · [Releases](${repository}/releases) · [Container packages](${repository}/pkgs/container/niubigeo) · [Report an issue](${repository}/issues) · [Contribute code](${repository}/pulls)`,
    '',
    zh
      ? `- [工作原理](docs/how-it-works.md) · [架构说明](docs/ARCHITECTURE.md)\n- [测量方法](docs/measurement-methodology.md) · [来源与证据](docs/evidence-model.md)\n- [部署](docs/deployment/docker.md) · [备份与升级](docs/upgrade.md)\n- [已知问题](docs/known-issues.md) · [能力边界](docs/limitations.md) · [发布说明](${release})\n- [贡献指南](CONTRIBUTING.md) · [安全政策](SECURITY.md) · [许可证](LICENSE)`
      : `- [How it works](docs/how-it-works.md) · [Architecture](docs/ARCHITECTURE.md)\n- [Measurement methodology](docs/measurement-methodology.md) · [Sources and evidence](docs/evidence-model.md)\n- [Deployment](docs/deployment/docker.md) · [Backups and upgrades](docs/upgrade.md)\n- [Known issues](docs/known-issues.md) · [Limitations](docs/limitations.md) · [Release notes](${release})\n- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [License](LICENSE)`,
    '',
    '---',
    '',
    zh
      ? 'NiubiGEO 观察的是 Provider API 回答，不代表消费端聊天页面的结果；不联网与联网测试分开理解。目前不提供传统搜索引擎排名监测。'
      : 'NiubiGEO observes Provider API responses, not results from consumer chat interfaces. Offline and web-enabled tests should be interpreted separately. Traditional search-engine rank tracking is not included.',
    '',
  ].join('\n');
}
