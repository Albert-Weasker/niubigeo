# 升级、备份与回滚

[Markdown 案例](../examples/README.zh-CN.md) 可直接阅读，不需要第二个服务。停用案例专用预览不改变正常产品数据、运行 API、报告或图表，也不意味着删除任何旧案例归档。

适用目标：当前产品候选 **v0.2.0-rc.1，UNPUBLISHED（未发布）**。rc4 候选已构建并验证备份读取，同时验证在上一个本地候选中重新打开备份副本；没有公开发布镜像。最终映射见本地 `release-manifest.json`（本地私有记录，未公开：`../validation/release-v0.2.0-rc.1/release-manifest.json`），该私有路径不是公开下载地址。镜像准备见 [Docker 部署](deployment/docker.md)。

## 已执行的副本恢复

最新 rc4 的创建、重启、归档/恢复、删除刷新、arm64 备份读取与旧候选回滚读取，记录于 `补充验收 B08`（本地私有记录，未公开：`../validation/release-v0.2.0-rc.1/additional-1788852792205/report.json`）。所有操作使用独立目录，无 Provider 推理。以下旧记录保留原身份，不覆盖本轮失败历史。

`rollback-check.json`（本地私有记录，未公开：`../validation/release-v0.2.0-rc.1/rollback-check.json`） 记录了一次真实的 copy + reopen：从 `container-lifecycle-1788847664760/backup` 复制隔离备份，在容器中重新打开，读到原来的两个项目。记录为 `passed: true`、`providerCalls: 0`，`beforeHash` 与 `afterHash` 均为 `d4f18ca5944704415b574f0616941bd5ef1b5305c2f987c3dce7263efacaa69c`。

配套 `amd64 生命周期记录`（本地私有记录，未公开：`../validation/release-v0.2.0-rc.1/container-lifecycle-1788847664760/report.json`） 在 Docker Desktop 仿真环境中记录了创建项目、重启持久化、归档/恢复、删除后刷新不复活和 query/资源读取，7 项通过。之前的`异步状态断言失败周期`（本地私有记录，未公开：`../validation/release-v0.2.0-rc.1/container-lifecycle-1788846686256/report.json`）仍保留；后续通过不覆盖原失败记录。

上述旧证据针对当时的 candidate 和隔离数据副本。新旧验收均没有操作真实用户的唯一副本，不证明任意版本间的 Schema 升降级、所有历史数据或原生 amd64 硬件。下面是以后升级时的操作步骤，不能将本轮两个本地候选的读取结果泛化为通用迁移保证。

## 先确认数据属于哪一代产品

当前产品入口是 `src/product/product-server.ts`，默认数据为 `data/product-v2`。旧 `runs/` 和旧 `data/projects/` 不会被自动导入，也没有经过验收的 Legacy 到 product-v2 自动迁移命令。

升级旧 Alpha 时保留旧镜像/源码、旧目录和运行配置，为新产品使用独立 product-v2 目录。不要改名旧 audit.json 为新 Run，不要为补齐新字段生成未发生的 D/K 观察。旧 CLI 的 import-runs/monitor-worker 不能据名称推断为新产品迁移/调度工具。

已有 product-v2 数据需要整体保留项目、配置、原文与派生结果的关系。存储目录详见 [架构](ARCHITECTURE.md)。当前文件读取主要是 JSON 解析和父级 ID 校验，不包含一个对所有历史 Schema 做自动迁移的框架。

## 升级前记录

- 正在运行的镜像 ID/Digest、产品源码与工作树变更清单、实际 server/worker 命令。
- PRODUCT_DATA_DIR 的解析结果、卷路径、权限、PORT、Secret 文件路径；不要记录 Key 值。
- 项目列表及 archived/deleted 状态、各项目 activeBaselineId、当前模型选择和 WatchSet。
- 所有运行中/排队中的认知与测量 Run、任务 status/nextRunAt、Occurrence 与 Ledger。
- 能打开的旧报告 ID、sourceAttemptMap、几份代表性原文与文件 Hash。

当前未提交文件属于需要核对的候选来源，只记录 HEAD 不足以说明镜像内容；产品 source commit 尚不能称为已冻结。最终清单须记录 dirty 来源、构建上下文 Hash、依赖锁文件、tsconfig、Dockerfile/忽略规则、品牌资源和对应 OCI。不要在共享工作树中重置、清理或自动提交其他人的修改。

## 停写并备份

1. 通过产品任务 pause 接口暂停计划恢复前不应执行的任务，记录原任务状态和时间。暂停不取消在途请求。
2. 等待认知/测量 Run 进入终态，确认 worker 不再派发新增请求，再停止 worker 和 server。进程退出前尚未归档的响应可能无法恢复。
3. 备份整个产品数据根目录及部署配置；Key 单独按现有秘密管理方式备份。若保留 Legacy，同步保存其目录，但不要混入公开证据包。
4. 对备份记录 SHA-256，并在独立路径解包检查；不要在唯一生产副本上试迁移。

以下命令只演示默认 `./data/product-v2` 的已停写 bind mount，需先完成上面的停写步骤。BACKUP_STAMP 是本次备份标识，不是候选版本号：

```sh
BACKUP_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p ./backups
tar -czf "./backups/product-v2-${BACKUP_STAMP}.tar.gz" -C ./data product-v2
shasum -a 256 "./backups/product-v2-${BACKUP_STAMP}.tar.gz"
mkdir -p "./restore-check/${BACKUP_STAMP}"
tar -xzf "./backups/product-v2-${BACKUP_STAMP}.tar.gz" -C "./restore-check/${BACKUP_STAMP}"
```

备份输出中的 Hash 是该压缩文件字节 Hash，另需保存项目 JSON/原始响应的证据索引。Linux 环境可用 sha256sum 计算相同算法。配置使用其他根目录或 Docker named volume 时，备份真实挂载来源，不能机械备份一个空的默认目录。

文件写入是单文件原子替换，不是跨文件事务，在线 tar 不能保证 Run/Attempt/结果处于同一时刻。临时文件或残留 lock 也可能被备份；不要直接删锁，先确认无进程仍持有相关操作，并记录人工处理。

## 在副本上验收候选

候选 server 指向解包后的独立 product-v2 目录，使用另一主机端口，**不启动 worker、不注入 Provider Key**。这样可以检查既有数据读取和本地报告/统计操作，又不会让备份里的 active 任务自行发请求。产品仍可能请求模型目录，这不是模型推理。

按以下顺序检查并记录实际结果：

1. 项目数和归档/删除状态与备份一致，未出现自动导入的公开案例或默认项目。
2. 原配置版本、WatchSet、报告及历史模型仍存在，旧报告打开不需要重新执行模型。
3. 原始 Attempt、响应、引用路径、字段证据和 Hash 与备份一致；不能因本地解析变化覆盖原文。
4. 检查 no_data、partial、Provider 失败、unknown 的实际显示；旧数据缺字段要保留未知。
5. 查看任务下一次时间及 Occurrence，确认恢复 worker 后不会意外补跑或卡住旧到期时间。
6. 在第二份副本中验证创建/归档/软删除/恢复/永久清理与容器重建，不对唯一备份做破坏性检查。

这些是验收要求，没有执行记录时应标为“未验证”。当前图表缓存只基于 ID，不能因候选代码能读旧快照便断言公式已重新计算。已有 `recognition-archive.json` 等旧布局的兼容性也应按实际读取代码和隔离副本检查，不能推定所有历史格式可迁移。

## 切换与恢复任务

final 副本验收通过且发布清单确认镜像内容后，用清单中已经验收的镜像替换产品进程，仍指向原生产 product-v2 数据。先仅启动 server，确认 `/health`、页面、SVG、项目和证据，再处理任务。registry 部署使用清单的 index Digest；不要用 workflow 重建得到的另一个镜像冒充旧候选的同一二进制。

模型选择变化需要新 Baseline；新 Baseline 需要对应的新 WatchSet。任务与旧 Baseline 不兼容时应重新核对范围与预算，不要只把 JSON status 改回 active。当前任务 watchSetId 与执行时范围的一致性存在缺口，恢复前应逐任务核对。

记录哪些任务应继续，然后逐项恢复；不要默认启动整个备份里的全部任务。worker 当前对错过时间和残留 Occurrence 没有完整自动恢复能力，不能承诺“升级停机期间全部正确跳过”或“恰好补跑一次”。详见 [限制](limitations.md)。

## 回滚

1. 暂停新增执行，等待已发请求结束并停止产品进程。
2. 为升级后数据另做一份备份，保留期间新增 Attempt、费用和错误；不要用旧备份直接覆盖它。
3. 启动清单记录的回滚镜像，并指向升级前备份的独立恢复目录。确认旧版本可读后再切换服务入口；final 的安装 Digest 与本次回滚目标必须分别记录，不能只填写同一个可变标签。
4. 先只恢复 server，检查项目/原文/引用，再按核对结果恢复任务。不能把升级后新 Schema 数据未经验证地交给旧版本写入。
5. 记录恢复时间、回滚镜像、数据副本路径及需要后续人工合并的记录。回滚不撤销已经发生的 Provider 费用。

如果旧版本是 Legacy，引擎和数据目录也必须成对恢复；新 product-v2 不能自动降级为旧 runs。不要移动已发布不可变标签为其他镜像，也不要通过覆盖原始回答使旧报告看起来一致。纯文档修正不需要重新请求模型；产品构建输入变化则要重新验证受影响行为。

本轮发布状态仍为未发布。已执行的旧候选 copy + reopen 以上述 rollback-check 为证，final/跨版本回滚仍按实际结果另记。具体产品来源、文档版本、安装/回滚镜像 Digest 与验收范围由发布清单关联；清单未齐备前，不将 dirty HEAD 写成已冻结产品提交。其他统计、证据与调度限制见 [已知限制](limitations.md)。
