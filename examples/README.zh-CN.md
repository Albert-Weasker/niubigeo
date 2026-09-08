# 查看案例

[English](./README.md)

这里是定向选取的 20 个软件产品域名，不是随机市场样本，也不是品牌排行榜。`cases/` 每个目录包含冻结输入、双语案例页、结果摘要和证据索引。请以案例状态为准：有文档不等于已经执行，也不等于测试成功。

## 零推理费用读取

```bash
npm ci
npm run examples:validate
npm run examples:plan -- --case R02
npm run examples:replay -- --case R02 --evidence examples/cases/R02/public-evidence.json
```

计划、回放、导出和 Markdown 渲染均不向模型发出新问题。回放保留原运行时间，并明确标注为已归档证据。

## 重新测量会收费

仓库内的计划记录本次发布的条件和预算，不代表持续授权使用别人的 Key。新测试需要明确的预算、独立输出目录、冻结输入和成功预检。下面命令只适用于已配置自己的 Key、并为该轮测试批准 2 美元的操作者。

```bash
# 通过独立本地服务，调用现有产品 HTTP API。
npm run examples:preflight -- --execution live --budget-usd 2
npm run examples:run -- --case R02 --execution live --budget-usd 2
# 省略 --case 才执行冻结计划中所有尚未执行的案例。
```

live 入口要求私有目录 `validation/release-v0.2.0-rc.1/` 中存在初始化后的计划及累计账本。未冻结、模型未定价、预检失败或重复执行已结束案例时，不会重新花费。该私有目录不进入 Git。先阅读[计划](./study-plan.json)和[测量方法](../docs/measurement-methodology.md)，再用 `npm run examples:init -- --budget-usd 2` 初始化新研究。初始化拒绝覆盖已有计划；结束后的计划应归档，新研究通过 `--root` 使用独立目录。

## 20 个案例

每页直接展示实际观察、图片、完整回答和来源链接，无需启动案例服务。

<!-- CASE_INDEX -->

20 个域名都有可分析的 D 回答；其中 11 例实际执行 K，10 例部分完成，18 条回答分析失败。5 例的 7 项第一名字段存在冲突，不用于排名。这些是不同统计口径，不是“全部成功率”。

[冲突与失败索引](../docs/known-issues.md)

| ID | 域名 | 实际测试范围 | 一句话观察或限制 | 详情 |
|---|---|---|---|---|
| R01 | niubistar.com | 仅域名认知；关键词未执行 | 一个模型描述为游戏娱乐，另一个描述为 GitHub 增长，第三个未识别。 | [阅读](cases/R01/README.zh-CN.md) |
| R02 | vercel.com | D + K (6/9 条 K 可分析) | 均描述前端部署；三轮关键词观察中保留三条解析失败。 | [阅读](cases/R02/README.zh-CN.md) |
| R03 | supabase.com | 仅域名认知；关键词未执行 | 模型提到 Firebase 替代关系；未产生合格的中性关键词测试。 | [阅读](cases/R03/README.zh-CN.md) |
| R04 | posthog.com | D + K (15/18 条 K 可分析) | Feature Flags 回答返回真实引用；三轮都保留部分失败。 | [阅读](cases/R04/README.zh-CN.md) |
| R05 | sentry.io | 仅域名认知；关键词未执行 | 模型强调错误追踪；Datadog、New Relic 等名单随模型不同。 | [阅读](cases/R05/README.zh-CN.md) |
| R06 | linear.app | D + K (4/6 条 K 可分析) | 问题追踪与产品开发描述不同；一项第一名判断冲突。 | [阅读](cases/R06/README.zh-CN.md) |
| R07 | canva.com | D + K (2/3 条 K 可分析) | 在线设计描述相近；关键词回答有两项第一名冲突。 | [阅读](cases/R07/README.zh-CN.md) |
| R08 | notion.so | 仅域名认知；关键词未执行 | 模型分别强调笔记、工作空间与协作，竞争对象不一致。 | [阅读](cases/R08/README.zh-CN.md) |
| R09 | cloudflare.com | 仅域名认知；关键词未执行 | 模型强调 CDN 与安全；AWS 相关名称未统一为同一实体。 | [阅读](cases/R09/README.zh-CN.md) |
| R10 | replit.com | D + K (2/3 条 K 可分析) | 模型描述浏览器 IDE；关键词结果含两项第一名冲突。 | [阅读](cases/R10/README.zh-CN.md) |
| R11 | github.com | D + K (3/3 条 K 可分析) | 域名回答描述代码托管；“协作”回答的第一名字段冲突。 | [阅读](cases/R11/README.zh-CN.md) |
| R12 | gitlab.com | D + K (2/3 条 K 可分析) | 模型均提到 DevOps；关键词解析失败并非品牌未出现。 | [阅读](cases/R12/README.zh-CN.md) |
| R13 | docker.com | D + K (4/6 条 K 可分析) | 模型列出 Kubernetes 等对象，但这种关联不等于替代关系已核实。 | [阅读](cases/R13/README.zh-CN.md) |
| R14 | figma.com | D + K (5/6 条 K 可分析) | Prototyping 联网回答明确推荐 Figma，另一关键词解析失败。 | [阅读](cases/R14/README.zh-CN.md) |
| R15 | framer.com | 仅域名认知；关键词未执行 | 无代码建站描述相近；Wix、Webflow 等名单不一致。 | [阅读](cases/R15/README.zh-CN.md) |
| R16 | webflow.com | 仅域名认知；关键词未执行 | 模型描述可视化建站，一次回答还明确写了 CMS 与托管。 | [阅读](cases/R16/README.zh-CN.md) |
| R17 | airtable.com | 仅域名认知；关键词未执行 | 模型分别强调数据库、电子表格和协作；未执行关键词测试。 | [阅读](cases/R17/README.zh-CN.md) |
| R18 | zapier.com | D + K (4/6 条 K 可分析) | 回答混用 Make 与 Integromat 等名称，不能直接视为不同公司。 | [阅读](cases/R18/README.zh-CN.md) |
| R19 | n8n.io | D + K (4/6 条 K 可分析) | 一个联网回答没列竞争对象；“开源软件”关键词存在第一名冲突。 | [阅读](cases/R19/README.zh-CN.md) |
| R20 | plausible.io | 仅域名认知；关键词未执行 | 模型强调隐私分析；共同列出 Google Analytics 和 Matomo。 | [阅读](cases/R20/README.zh-CN.md) |

<!-- CASE_INDEX -->

## 证据规则

- Provider 引用必须回到响应中的结构化字段。
- 搜索检索结果与答案引用分别标记。
- 回答里的普通 URL 保留原类别，不联网时也不能升级成 Provider 引用。
- unknown、缺失字段、解析不完整和请求失败保持区分。
- 原始回答保留原语言，页面说明提供中英文。
- 冻结计划和关键词选择与结果分开；产品代码没有案例专属执行规则。

现有测量接口还会为每个模型发送目标域名问题，这部分请求已计入费用计划。关键词来自可定位到原文的独立模型关联，并排除目标和已观察竞争对象身份。这项规则不能证明关键词的市场热度。

NiubiStar 赞助 NiubiGEO；案例执行相同规则并保留失败。其他产品收录仅为观察，不代表客户关系或背书。
