<div align="center">

<img src="./assets/brand/niubigeo-readme-hero.svg" width="100%" alt="NiubiGEO - AI 域名认知监测" />

# NiubiGEO Next

### 输入一个域名，看清哪些 AI 认识你、如何理解你，以及它们还认识谁。

**这是下一版本预告，不是当前稳定版本说明。**

![Preview](https://img.shields.io/badge/NEXT-PREVIEW-51FFB7?style=flat-square&labelColor=07110F)
![Open Source](https://img.shields.io/badge/OPEN_SOURCE-YES-31D7FF?style=flat-square&labelColor=07110F)
![Self-hosted](https://img.shields.io/badge/SELF_HOSTED-YES-B5FF3D?style=flat-square&labelColor=07110F)
![BYOK](https://img.shields.io/badge/BYOK-OPENROUTER-51FFB7?style=flat-square&labelColor=07110F)
![中文](https://img.shields.io/badge/简体中文-支持-31D7FF?style=flat-square&labelColor=07110F)

[English](./NEXT_PREVIEW.md) · [当前版本](./README.zh-CN.md) · [GitHub Issues](https://github.com/Albert-Weasker/niubigeo/issues)

</div>

---

> [!IMPORTANT]
> 本文介绍正在开发的 NiubiGEO 下一版本。界面、数据结构和部分功能尚未正式发布，请勿将本文描述视为当前版本已经具备的能力。

## 为什么要重构？

NiubiGEO 的第一个 Alpha 版本证明了一件事：我们可以调用真实 Provider API，检查品牌提及、竞争对象和引用来源，并把结论追溯到原始回答。

但它仍然太像一套“需要用户先理解 Prompt 和指标的审计工具”：

- 用户需要先理解应该问什么；
- 问题、模型和报告之间的关系不够清楚；
- 多个模型的结果容易被合并成一份复杂报告；
- 项目、运行和监测的生命周期不够独立；
- 页面展示了很多数据，却没有第一时间回答“哪些 AI 认识我”；
- 静态表格和图表缺少过程反馈，产品显得沉重而被动。

我们决定重新回到用户真正关心的问题：

> **当一个 AI 看到我的域名时，它知道我是谁吗？它认为我做什么？它还会想到哪些竞争对手？**

## 下一版本的产品定义

NiubiGEO Next 是一个开源、可自托管的 **AI 域名认知监测工具**。

用户只需要：

1. 输入一个域名；
2. 选择一个或多个 OpenRouter 模型；
3. 为每个模型选择联网或不联网；
4. 创建监测基线；
5. 运行并查看各模型的独立结果。

NiubiGEO 使用固定、版本化的域名认知协议，让每个模型独立判断：

- 是否认识这个域名；
- 域名对应什么品牌；
- 品牌提供什么产品或服务；
- 品牌属于什么产品类别；
- 主要竞争对手可能是谁；
- 哪些关键词与目标品牌相关；
- 哪些关键词与各个竞争对手相关；
- 联网模型为这些判断返回了哪些可核验来源；
- 哪些内容无法确认。

模型不知道，就显示不知道；不同模型描述不一致，就并列保留差异；模型没有提供来源，就明确显示没有来源。只有经过用户确认或外部证据核验后，系统才会把某项描述标记为错误。

NiubiGEO 不会替模型补全答案，也不会为了让报告更完整而编造品牌、竞品、关键词或 URL。

## 它是怎样工作的？

```mermaid
flowchart TD
    A[输入域名] --> B[选择多个模型]
    B --> C[创建不可变监测基线]
    C --> D[各模型独立执行认知协议]
    D --> E[保存原始回答与真实来源]
    E --> F[比较品牌、竞品与关键词认知]
    F --> G[后续重复运行并观察变化]
```

每个模型拥有自己的执行状态、原始回答和结果。一个模型失败，不会抹掉其他模型已经完成的数据。

```text
Project
├── Domain
├── Selected Models
├── Baselines
└── Runs
    ├── GPT Model Run
    ├── Claude Model Run
    ├── Gemini Model Run
    ├── Sonar Model Run
    └── Cross-model Comparison
```

## 从一个域名得到什么？

### 1. 哪些 AI 认识你

第一屏直接展示每个模型的判断：

| 模型 | 域名认知 | 识别的品牌 | 识别的业务 | 来源 |
|---|---|---|---|---|
| Model A | 认识 | 已识别 | 已识别 | 查看来源 |
| Model B | 部分认识 | 已识别 | 不完整 | 查看证据 |
| Model C | 不认识 | - | - | 无来源 |
| Model D | 执行失败 | - | - | 查看错误 |

`执行失败`不会被统计成`不认识`，`不确定`也不会被强行转换成否定结果。

### 2. AI 如何理解你的业务

NiubiGEO 并列展示不同模型的描述，而不是把它们强行合成为一个“标准答案”。

你可以直接看到：

- 哪些模型对产品给出了相近的理解；
- 哪些模型只理解了一部分；
- 哪些模型给出了互相冲突、疑似错误或可能过时的描述；
- 哪些业务能力只被部分模型识别。

### 3. AI 认为谁是你的竞争对手

竞争对象按模型分别保存：

| 竞争对象 | Model A | Model B | Model C | Model D |
|---|:---:|:---:|:---:|:---:|
| Competitor A | 识别 | 识别 | - | 识别 |
| Competitor B | - | 识别 | - | 识别 |
| Competitor C | 识别 | - | - | - |

这里表达的是“哪些模型把它识别为竞争对象”，不是 NiubiGEO 对市场地位作出的主观裁决。

### 4. 哪些关键词与品牌和竞品关联

目标品牌拥有自己的关键词认知图；每个竞争对手也拥有相同结构的独立视图。

| 关键词 | Model A | Model B | Model C | Model D |
|---|:---:|:---:|:---:|:---:|
| Keyword A | 关联 | - | 关联 | 关联 |
| Keyword B | - | 关联 | - | 关联 |
| Keyword C | 关联 | 关联 | - | - |

这让用户能够看见：

- 哪些关键词已经与目标品牌建立认知；
- 哪些关键词只与竞争对手关联；
- 哪些模型对同一关键词存在分歧；
- 这些关系在后续运行中是否发生变化。

### 5. 判断来自哪里

来源按照模型和判断对象分别保存：

- URL；
- 页面标题；
- 提供来源的模型；
- 来源支持的品牌、竞品或关键词判断；
- 对应的原始回答；
- 首次发现和最近发现时间。

Provider 返回的 Citation 与模型正文中普通出现的 URL 会明确区分。普通搜索结果不能冒充 AI 引用，没有来源时不会生成替代来源。不联网模型只能展示其回答，不能声称知道模型训练数据具体来自哪些页面。

## 新版报告会更少，但更清楚

下一版本不再追求生成一份很长的“AI 分析报告”。主报告只回答五个问题：

```text
1. 哪些 AI 认识你？
2. 它们认为你做什么？
3. 它们认为谁与你竞争？
4. 它们把哪些关键词与你和竞品关联？
5. 这些判断来自哪些 URL？
```

每项结论都可以回到对应模型的原始回答。工程字段、内部 ID 和原始 JSON 默认不进入主阅读路径。

## 持续监测，而不是一次性审计

一次回答只能说明一次观察。NiubiGEO Next 将在相同条件下重复运行，帮助用户判断：

- 在多次相同条件运行中，某个模型是否持续从“不认识”转为“认识”；
- 模型对品牌业务的描述是否发生变化；
- 是否出现新的竞争对象；
- 品牌新增或失去了哪些关键词关联；
- 哪些来源开始或停止影响模型回答。

只有相同域名、相同协议版本、相同模型和相同联网方式的运行才会进入同一条趋势。单次变化只是一条新观察，不直接证明模型已经形成稳定认知。

## 每条线代表一个模型

趋势图一次只展示一个指标：

- 目标品牌认知；
- 某个竞争对手的认知；
- 目标品牌的某个关键词认知；
- 某个竞争对手的某个关键词认知。

每条线代表一个模型，每个点代表该模型的一次有效运行。

```text
失败或不支持  -> 不画成 0
没有来源      -> 显示无来源
模型不认识    -> 明确记录不认识
模型不确定    -> 保留不确定
```

点击数据点可以查看当次模型结果、原始回答和来源。不同监测基线默认不会被连接成一条线。

## 全新的工作台

新版 UI 仍采用全黑科技风，但不再只是给静态数据套一层深色皮肤。

### 信息结构

```text
项目
├── 总览
├── AI 认知
├── 竞争对手
├── 关键词
├── 引用来源
└── 运行记录
```

### 动态反馈

- 所有按钮具备悬停、按下、加载、成功、失败和禁用状态；
- 点击后 100ms 内必须看到反馈；
- 页面和抽屉使用克制的淡入与位移动画；
- 趋势线在真实数据加载后从左向右绘制；
- 最新有效数据点使用轻微呼吸光；
- 失败数据不会为了保持曲线完整而被伪造成 0；
- 系统遵循 `prefers-reduced-motion`，允许用户关闭非必要动画。

动画负责表达状态和数据形成过程，不负责掩盖等待、错误或空数据。

## 与 v0.1.0-alpha 有什么不同？

| v0.1.0-alpha | NiubiGEO Next Preview |
|---|---|
| 偏向一次性域名审计 | 面向长期项目监测 |
| 用户确认或修改测试问题 | 系统使用固定、版本化的域名认知协议 |
| 可输入自定义关键词和竞品 | 模型从域名认知中独立返回竞品与关键词 |
| 多模型结果主要进入合并报告 | 每个模型拥有独立运行与证据 |
| 报告覆盖多个审计指标 | 主报告收敛为认知、业务、竞品、关键词、来源 |
| 历史报告作为主要单位 | Project、Baseline、Run 和 Model Run 成为独立实体 |
| 静态结果展示为主 | 可比较趋势、绘制动画和即时交互反馈 |
| 多 Provider 分别配置 | 第一阶段通过 OpenRouter 统一选择多个模型 |

旧版文档、文章和截图记录的是当时可用的 `v0.1.0-alpha`，并不代表作者或社区描述错误。Next Preview 展示的是正在开发的新方向。

## 数据可信边界

NiubiGEO Next 坚持以下规则：

1. 被测试模型只接收目标域名、输出语言、固定协议和联网配置；
2. 不把官网抓取内容注入模型并再声称模型“认识”该品牌；
3. 不把一个模型的回答提供给另一个模型；
4. 不编造竞争对手、关键词或 URL；
5. 没有 Provider Citation 就明确显示没有 Citation；
6. API 回答不冒充 ChatGPT、Claude、Gemini 或 Perplexity 消费端网页结果；
7. 单次回答不代表永久认知或市场排名；
8. 模型失败、模型不认识和模型不确定是三种不同状态；
9. 原始回答和历史监测基线不可被后续结果覆盖；
10. 每个项目的数据通过独立 `projectId` 隔离。

## 开源范围

本预告中描述的以下产品能力计划进入 Community Edition：

- 多项目管理；
- OpenRouter 模型搜索和多选；
- 每个模型独立联网配置；
- 版本化域名认知协议；
- 不可变监测基线；
- 每模型独立运行和结果；
- 跨模型认知对比；
- 品牌、竞品、关键词和来源视图；
- 历史运行与趋势；
- 定时监测；
- 原始回答和证据回溯；
- 自托管与 BYOK；
- English 与简体中文。

用户自行承担所选模型产生的 Provider API 费用以及自托管基础设施成本。NiubiGEO 不会把 Mock 数据当成真实 Provider 结果。

## 开发路线

- [x] 多项目 Project CRUD 与隔离
- [x] Draft 项目持久化、归档、删除和恢复
- [ ] OpenRouter 模型目录与多选
- [ ] 每模型独立联网方式
- [ ] Domain Recognition Protocol v1
- [ ] 不可变 Baseline
- [ ] Run 与独立 Model Run
- [ ] 品牌、业务、竞品、关键词和来源提取
- [ ] 每模型结果页
- [ ] 跨模型对比
- [ ] 可追溯趋势图
- [ ] 定时监测
- [ ] 旧版数据迁移与 Legacy 标记

路线图勾选状态表示已经通过对应版本验收，而不是仅存在代码、接口或设计稿。

## 为什么继续开源？

AI 对品牌的认知不应该只是商业后台里的一个黑盒分数。

我们希望任何团队都能：

- 在自己的基础设施中运行；
- 使用自己的模型 Key；
- 查看不同模型的真实差异；
- 检查原始回答和来源；
- 理解每一条趋势是怎样产生的；
- 在证据不足时得到“无法确认”，而不是得到一个漂亮但无法解释的分数。

## 鸣谢

NiubiGEO 的开源开发由以下赞助方提供支持：

<table>
  <tr>
    <td align="center" width="33%">
      <a href="https://www.niubistar.com/">
        <img src="./assets/sponsors/niubistar.png" width="96" alt="NiubiStar logo" />
      </a>
      <br />
      <strong>NiubiStar</strong>
    </td>
    <td align="center" width="33%">
      <a href="https://waer.ltd/">
        <img src="./assets/sponsors/welight.png" width="96" alt="Welight logo" />
      </a>
      <br />
      <strong>Welight</strong>
    </td>
    <td align="center" width="33%">
      <a href="https://hoolo.cc/">
        <img src="./assets/sponsors/hoolo.png" width="96" alt="Hoolo logo" />
      </a>
      <br />
      <strong>Hoolo</strong>
    </td>
  </tr>
</table>

赞助方为本项目提供了测试资源和资金支持，使 NiubiGEO 能够继续作为独立、可自托管的开源项目迭代。

感谢所有提交代码、Issue、Pull Request、测试结果、文章和真实反馈的社区成员。

- [NiubiStar](https://www.niubistar.com/)
- [Contributors](https://github.com/Albert-Weasker/niubigeo/graphs/contributors)
- [Issues](https://github.com/Albert-Weasker/niubigeo/issues)
- [Discussions](https://github.com/Albert-Weasker/niubigeo/discussions)

赞助关系不改变 Community Edition 的开源许可证、证据边界或报告结果。项目不会因为赞助关系隐藏不利结果或生成有利结论。

## 当前版本与预告版本

- 当前公开版本：`v0.1.0-alpha`
- 本文对应：`NiubiGEO Next Preview`
- 发布状态：开发中，尚未发布
- License：[Apache-2.0](./LICENSE)

---

<div align="center">

### 一个域名，多个模型，一张可以追溯的 AI 认知地图。

**NiubiGEO Next is under active development.**

[查看当前版本](./README.zh-CN.md) · [English](./NEXT_PREVIEW.md) · [关注进展](https://github.com/Albert-Weasker/niubigeo) · [提交建议](https://github.com/Albert-Weasker/niubigeo/issues)

Open-source development sponsored by [NiubiStar](https://www.niubistar.com/), [Welight](https://waer.ltd/), and [Hoolo](https://hoolo.cc/)

</div>
