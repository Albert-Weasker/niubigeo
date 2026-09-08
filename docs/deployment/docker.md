# Docker 部署

## NiubiGEO v0.2.0

正式镜像为 `ghcr.io/albert-weasker/niubigeo:v0.2.0`，支持 Linux amd64 和 arm64。先在宿主环境中设置 `OPENROUTER_API_KEY`，再执行：

```bash
docker pull ghcr.io/albert-weasker/niubigeo:v0.2.0
docker run -d --name niubigeo \
  -p 127.0.0.1:8787:8787 \
  -e OPENROUTER_API_KEY \
  -v niubigeo-data:/app/data/product-v2 \
  ghcr.io/albert-weasker/niubigeo:v0.2.0
```

打开 <http://localhost:8787>。命名卷 `niubigeo-data` 会在重新创建容器后保留；升级前请先[备份](../upgrade.md)。不要直接对公网开放工作台，远程访问需要另外配置认证和 TLS。

定时监测需要额外启动 Worker，必须使用同一数据卷；此操作会执行到期任务并产生 API 费用：

```bash
docker run -d --name niubigeo-worker --no-healthcheck \
  -e OPENROUTER_API_KEY \
  -v niubigeo-data:/app/data/product-v2 \
  ghcr.io/albert-weasker/niubigeo:v0.2.0 \
  node dist/src/product/scheduling/schedule-worker.js 60
```

公开镜像从 `v0.2.0` Tag 对应的 commit 构建。版本、源码标记、SVG、项目创建和重新创建容器后的持久化检查通过后，工作流才写入 `:v0.2.0` 与 `:latest`；候选版本不能更新 `latest`。实际 Digest 和来源记录见[正式发布附件](https://github.com/Albert-Weasker/niubigeo/releases/tag/v0.2.0)。本版的统计及验收缺口仍见[发布说明](../releases/v0.2.0.md)，不将历史 blocked 记录改成 passed。

<details>
<summary>历史候选构建记录与部署参数说明（非正式镜像身份）</summary>

阅读 [20 个 Markdown 案例](../../examples/README.zh-CN.md) 不需要启动容器或案例站。以下命令只用于正常产品工作台，历史静态预览不是部署依赖。

以下是正式发布前的 **v0.2.0-rc.1 历史候选记录**，保留当时的状态、命令与验收边界，不用于标识 v0.2.0 镜像。安装当前版本请使用上面的命令。

最终 OCI、index/各架构 Digest、构建输入、源码对应及 registry 状态记录在本地 `release-manifest.json`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/release-manifest.json`）。清单已经生成，但该 validation 路径不是永久公开下载入口。当前构建和运行映射见 `rc4-image-provenance.json`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/rc4-image-provenance.json`），仍有未通过门禁，见[版本说明](../releases/v0.2.0-rc.1.md)。

当前产品入口是 [product-server.ts](../../src/product/product-server.ts)，编译后为 `dist/src/product/product-server.js`。worker 入口为 [schedule-worker.ts](../../src/product/scheduling/schedule-worker.ts)，编译后为 `dist/src/product/scheduling/schedule-worker.js`。旧 `dist/src/server.js`、旧 CLI monitor-worker 不是当前产品入口。

## 构建前确认

使用完整的当前候选工作树，而不是只 checkout 旧 HEAD；本阶段产品包含尚未提交的文件。Node 版本要求为 22 或以上，镜像构建依赖仓库的 package-lock.json。Dockerfile 使用多阶段构建，运行时只安装生产依赖。

发布前必须确认仓库 [Dockerfile](../../Dockerfile) 与 [Compose](../../docker-compose.yml) 已完成当前入口调整：

- 默认命令为 `node dist/src/product/product-server.js`。
- runtime stage 含编译结果、生产依赖与 `assets/brand/` 下的新徽标和字标；当前 Dockerfile 明确只复制这两份品牌文件。
- 数据根目录设置为 `/app/data/product-v2`，挂载整个产品数据目录。
- worker 使用当前 scheduling 入口，Compose worker 由显式 profile 启用。
- `.dockerignore` 排除 Key、`.env`、真实用户数据、validation、截图验收包与临时输出，不将本机业务数据烘焙进镜像。

旧 candidate OCI 中，当前 server、两份新 SVG、PRODUCT_DATA_DIR 和 `/health` 已有本地运行证据，amd64/arm64 的已加载 config 均与多架构归档对应。记录见 `旧镜像映射`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/image-provenance.json`） 与 `构建元数据`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/image-build-metadata.json`）。这两份文件保留旧候选身份，不能替代 final 清单。

源码仍来自包含未提交修改的工作树，不能称为“产品 source commit 已冻结”。旧 BuildKit provenance 中的 HEAD 只是基础提交；最终清单须列出 dirty 文件与实际构建输入 Hash，包含 `tsconfig.json`、两份 SVG、依赖锁文件和 Dockerfile。若后续形成产品提交，也须核对其内容与已验收 OCI 的关系，不能只以当前 HEAD 推断。

## 本地候选启动

在项目根目录执行。先由发布清单选择对应架构的已加载镜像 ID，设置 `LOCAL_IMAGE`。本轮已按相同 server、端口和数据挂载方式启动当前候选，并完成创建、重启、删除和备份读取验收。这里不推送或创建 Git Tag/Release：

```sh
: "${LOCAL_IMAGE:?从发布清单设置对应架构的已加载镜像ID}"
mkdir -p ./data/product-v2
docker run --detach --name niubigeo-rc \
  --publish 127.0.0.1:8787:8787 \
  --env PORT=8787 \
  --env PRODUCT_DATA_DIR=/app/data/product-v2 \
  --mount type=bind,source="$(pwd)/data/product-v2",target=/app/data/product-v2 \
  "$LOCAL_IMAGE" \
  node dist/src/product/product-server.js
```

这个无 Key 启动方式用于页面、既有数据读取及非推理操作。模型目录可能访问 OpenRouter 外网，但没有 Key 的模型执行不能获得真实回答。

页面地址为 [认知工作台](http://127.0.0.1:8787/) 和 [持续测量](http://127.0.0.1:8787/?view=measurements)。服务目前只对根路径返回页面，深链不能随意改为 `/projects/...`。端口占用时替换冒号前的主机端口；容器内仍为 8787。

## BYOK 与费用

NiubiGEO 当前产品使用 OpenRouter BYOK。Key 由服务器环境读取，不是在浏览器页面中上传给公开演示站点。用户承担模型、搜索与服务器费用；赞助不改变测量规则或结果。

[env.ts](../../src/config/env.ts) 的 Key 查找顺序为：

1. OPENROUTER_API_KEY 的非空直接值，或 OPENROUTER_API_KEY_FILE 指向的文件内容。
2. OPENROUTER_KEY 的非空直接值，或 OPENROUTER_KEY_FILE 指向的文件内容。

项目根目录 `.env` 在进程启动时载入，不覆盖已有非空环境值。容器不会自动包含宿主 `.env`；使用环境注入或只读 Secret 文件。Key 文件不存在、不可读或为空时仍视为缺少 Key。

如需允许已获预算授权的真实执行，可以在上面的 docker run 中添加：

```sh
--env OPENROUTER_API_KEY_FILE=/run/secrets/openrouter_api_key \
--mount type=bind,source="$(pwd)/secrets/openrouter_api_key",target=/run/secrets/openrouter_api_key,readonly
```

该片段是 docker run 的附加参数，不是单独命令。文件须事先由部署者在本机准备，限制可读权限，不提交仓库。不要把真实 Key 写入 README、截图、日志或镜像构建参数。

配置 Key 不自动执行认知，但点击运行、重试、启用到期任务或调用 `/api/scheduler/due` 可产生费用。初始认知截断时可能自动追加一次请求；测量的 costLimitUsd/tokenLimit 目前不是完整的强制预算闸门。详见 [限制](../limitations.md)，不能把 UI 请求计数当账户总预算保障。

## 数据卷

| 环境变量 | 当前用途 |
| --- | --- |
| PRODUCT_DATA_DIR | 当前产品完整数据根目录，优先级最高 |
| MONITORING_DATA_DIR | 未设置 PRODUCT_DATA_DIR 时，在其下使用 product-v2；默认 data |
| RUNS_DIR | Legacy 输出路径，不能替代当前产品数据卷 |
| PORT | HTTP 监听端口，默认 8787 |

推荐映射 `./data/product-v2` 到 `/app/data/product-v2` 并显式设置 PRODUCT_DATA_DIR。若既有部署挂载整个 `./data:/app/data`，仍可保留该挂载并确保 PRODUCT_DATA_DIR 指向 `/app/data/product-v2`。不要挂载两个不一致的数据副本给 server 和 worker。

必须保存 projects 下的 project.json、模型选择、Baselines、认知运行及其报告、测量范围/运行/统计、任务/Occurrence/Ledger。只备份旧 runs 或只备份 Attempt 文件不足以恢复关系。相对路径根据容器工作目录解析，本镜像工作目录为 `/app`。

宿主卷需要允许运行用户读写；JSON 文件不是只读数据库。`docker rm` 不会删除 bind mount 中的数据，产品 purge 则会永久删除项目子树。备份与恢复步骤见 [升级](../upgrade.md)。

## 显式启用 worker

HTTP server 本身不会定时扫描。worker 默认 60 秒轮询，位置参数可设定秒数且至少为 10；它不接受旧 CLI 的 `--poll-seconds` 参数。

单独启动一个 worker 的命令如下。执行前先核对全部 active 任务与预算；它会扫描同一数据根目录的到期任务并真实请求模型：

```sh
docker run --detach --name niubigeo-rc-worker \
  --no-healthcheck \
  --env PRODUCT_DATA_DIR=/app/data/product-v2 \
  --env OPENROUTER_API_KEY_FILE=/run/secrets/openrouter_api_key \
  --mount type=bind,source="$(pwd)/data/product-v2",target=/app/data/product-v2 \
  --mount type=bind,source="$(pwd)/secrets/openrouter_api_key",target=/run/secrets/openrouter_api_key,readonly \
  "$LOCAL_IMAGE" \
  node dist/src/product/scheduling/schedule-worker.js 60
```

worker 没有额外 HTTP 端口，因此单独启动时禁用镜像自带的 HTTP healthcheck。暂停任务只阻止后续到期执行，不取消已经在途的模型请求。用产品 pause 接口暂停需要停止的任务，并确认 Run 终态后再停止容器：

```sh
docker stop niubigeo-rc-worker
```

当前 Compose 的 server 服务保留名称 niubistar-geo，worker 为 niubigeo-worker，profile 为 monitoring。Compose 将宿主环境或 `.env` 中的 OPENROUTER_API_KEY/OPENROUTER_KEY 传给容器，两者均允许空值；这与上文显式 Secret 文件挂载方式不同。默认端口绑定 `127.0.0.1:8787`，宿主 PORT 可覆盖主机端口。默认启动不启用 worker。

以下 Compose 命令仅用于以后有意从源码部署的场景，会构建新镜像，**不保证与清单中已验收 OCI 相同**；固定镜像验收与发布使用上文镜像 ID 或下文 registry Digest：

```sh
docker compose up --build -d niubistar-geo
```

确认任务和预算后，才显式启动 worker：

```sh
docker compose --profile monitoring up --build -d niubigeo-worker
```

两个服务挂载整个 `./data:/app/data`，当前产品在其 product-v2 子目录。worker 禁用 HTTP healthcheck，不能通过 server 存活推断调度已工作。

## 已有验证与 final 边界

- 旧 OCI 的两个平台 manifest/config 与已加载镜像对应；28 个 OCI blob 的 Digest/大小已有只读核对。应用层只含编译产品、package.json、生产依赖与两份新 SVG，未烘焙仓库测试、validation、真实数据、网站、文档或截图。
- arm64 容器在本地 8795 读取复制的预检归档，`4 张预检截图及索引`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/container-browser-1788846299778/report.json`） 已有记录。它们是预检回放，不能计成 20 案例的新推理。
- amd64 已在 Docker Desktop 仿真下运行；8796 使用独立空数据，后续 8797 的`生命周期记录`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/container-lifecycle-1788847664760/report.json`）包含创建、重启持久化、归档/恢复、删除刷新和深层 query/资源，7 项通过。此前立即读取状态造成的`失败周期`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/container-lifecycle-1788846686256/report.json`）保留，不删除或改写为成功。
- 备份真实复制并重新打开已经执行，见 `rollback-check`（本地私有记录，未公开：`../../validation/release-v0.2.0-rc.1/rollback-check.json`）。这证明旧候选读取该隔离副本，不能据此声明任意跨版本 Schema 迁移或 final 回滚已通过。

这些结论只属于已记录的旧 candidate。小修会重建 final，并由发布清单关联受影响验收；不默认重新调用模型来修正文档或截图。产品 UI 不是全链路双语，统计/来源证据也有现有限制，见 [发布说明](../releases/v0.2.0-rc.1.md) 与 [L01—L20](../limitations.md)。

## 保留 Digest 转发到 registry

本节是**未执行的发布操作规程**，不是当前授权。付费推理授权、本地构建和文档编辑授权均不等于 GHCR 上传、Git push、GitHub Tag/Release 或移动 latest 的授权。

执行前必须全部满足：

1. final 小修/重建和受影响验收已完成，发布负责人确认清单中的 final OCI 是要公开的同一份归档；清单缺失、仍指向旧 candidate 或验收未完成时停止。
2. 已明确授权向目标 GHCR 仓库上传该 Digest。产品来源与 dirty 变更已在清单交代；若要创建 `sha-<commit>` 标签，该 commit 必须经过内容对应核对，不能填旧 HEAD 冒充已冻结来源。
3. 已审核镜像、证据与文档中的公开内容。registry 凭证只用于登录，不能写入镜像、清单、命令记录或公开附件。
4. 已协调暂停同一仓库的其他标签写入。版本/commit 标签必须未占用；认证、网络、服务错误或无法列出标签一律停止。检查与写入之间不具备 registry 原子锁，不能同时由其他发布者写入。

需要 Node 22+ 和支持下列选项的 Skopeo。发布负责人从 `release-manifest.json` 设置并 `export` 这些变量；本文不假定尚未定稿的清单字段结构，也不提供占位 Digest：

| 变量 | 来源与要求 |
| --- | --- |
| OCI_ARCHIVE | 清单中已验收 final OCI archive 的本地路径；包含唯一一个多架构镜像 index |
| EXPECTED_DIGEST | 同一 final 的 `sha256:` index Digest，不是单架构 config/image ID 或 tar 文件 Hash |
| SOURCE_SHA | 清单中已确认内容对应的产品 commit，完整 40 位；dirty 来源尚未解决则不得进入此上传流程 |
| TRANSFER_RECORDS | 本次上传记录的新目录，不能复用失败周期目录 |
| GHCR_USER | 拥有目标仓库写入权限的账户；登录时交互输入 token |

以下整段只在上述授权门禁通过后，于仓库根目录执行。两次标签写入均复制完整已验收 OCI，没有 build 步骤；不会写入 latest：

```sh
set -eu
export IMAGE=ghcr.io/albert-weasker/niubigeo
export CANDIDATE_TAG=v0.2.0-rc.1
export RELEASE_MANIFEST=validation/release-v0.2.0-rc.1/release-manifest.json
: "${OCI_ARCHIVE:?从清单设置final OCI路径}"
: "${EXPECTED_DIGEST:?从清单设置已验收index Digest}"
: "${SOURCE_SHA:?从清单设置已核对产品commit}"
: "${TRANSFER_RECORDS:?设置新的上传记录目录}"
: "${GHCR_USER:?设置有权限的registry账户}"
test -s "$RELEASE_MANIFEST"
test -s "$OCI_ARCHIVE"
test ! -e "$TRANSFER_RECORDS"
mkdir -p "$TRANSFER_RECORDS"
cp "$RELEASE_MANIFEST" "$TRANSFER_RECORDS/release-manifest.input.json"

node --input-type=module <<'NODE'
import { createReleasePlan, validateDigest } from './scripts/release-image-policy.mjs';
const plan = createReleasePlan({ eventName: 'workflow_dispatch', action: 'candidate', tag: process.env.CANDIDATE_TAG, sourceSha: process.env.SOURCE_SHA });
validateDigest(process.env.EXPECTED_DIGEST);
if (plan.image !== process.env.IMAGE) throw new Error('Registry differs from release policy');
NODE

skopeo inspect --raw "oci-archive:${OCI_ARCHIVE}" > "$TRANSFER_RECORDS/local-index.json"
test "$(skopeo manifest-digest "$TRANSFER_RECORDS/local-index.json")" = "$EXPECTED_DIGEST"
skopeo login --username "$GHCR_USER" ghcr.io
skopeo list-tags "docker://${IMAGE}" > "$TRANSFER_RECORDS/tags.before.json"
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const { Tags } = JSON.parse(readFileSync(process.env.TRANSFER_RECORDS + '/tags.before.json', 'utf8'));
if (!Array.isArray(Tags)) throw new Error('Registry tag inventory unavailable');
for (const tag of [process.env.CANDIDATE_TAG, 'sha-' + process.env.SOURCE_SHA]) {
  if (Tags.includes(tag)) throw new Error('Immutable tag already exists: ' + tag);
}
NODE

for TARGET_TAG in "$CANDIDATE_TAG" "sha-${SOURCE_SHA}"; do
  export TARGET_TAG
  skopeo list-tags "docker://${IMAGE}" > "$TRANSFER_RECORDS/tags.current.json"
  node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const { Tags } = JSON.parse(readFileSync(process.env.TRANSFER_RECORDS + '/tags.current.json', 'utf8'));
if (!Array.isArray(Tags) || Tags.includes(process.env.TARGET_TAG)) throw new Error('Cannot create immutable tag');
NODE
  skopeo copy --all --preserve-digests \
    --digestfile "$TRANSFER_RECORDS/${TARGET_TAG}.digest" \
    "oci-archive:${OCI_ARCHIVE}" "docker://${IMAGE}:${TARGET_TAG}"
  test "$(cat "$TRANSFER_RECORDS/${TARGET_TAG}.digest")" = "$EXPECTED_DIGEST"
  skopeo inspect --raw "docker://${IMAGE}:${TARGET_TAG}" > "$TRANSFER_RECORDS/${TARGET_TAG}.index.json"
  test "$(skopeo manifest-digest "$TRANSFER_RECORDS/${TARGET_TAG}.index.json")" = "$EXPECTED_DIGEST"
done
```

`--all` 复制 index 及其所有平台/证明条目；`--preserve-digests` 要求保留内容 Digest，不能保留时失败。不要删除该选项、强制转换格式、重压缩，或用 `docker load` 后单架构 `docker push` 替代整份归档转发。选项依据 [Skopeo copy](https://github.com/podman-container-tools/skopeo/blob/main/docs/skopeo-copy.1.md)、[OCI archive transport](https://github.com/containers/image/blob/main/docs/containers-transports.5.md)；index 的计算方式见 [manifest-digest](https://github.com/podman-container-tools/skopeo/blob/main/docs/skopeo-manifest-digest.1.md)。

失败可能发生在部分 blob/标签已经写入之后。保留全部记录，先检查目标状态再决定后续操作；不要删除已公开标签、覆盖已有不可变标签或关闭 Digest 校验来重试。新仓库无法列出标签时也会停止，需由发布负责人单独处理仓库初始化，不将错误解释成“标签不存在”。

上传完成后仍须按清单逐架构核对并完成公开拉取/访问验收，记录远端 index 与平台 Digest；本地 image ID 等于 config Digest，不是多架构 index 身份。部署时从清单设置 `EXPECTED_DIGEST`，固定使用 `ghcr.io/albert-weasker/niubigeo@${EXPECTED_DIGEST}`，不能仅凭标签名字宣称内容一致。

## 工作流与稳定提升

[docker-publish.yml](../../.github/workflows/docker-publish.yml) 的 candidate 路径会重新构建，并添加 revision/version 等 label。即使来自相同源码，也不能称为已验收本地 OCI 的同一二进制或同一 Digest；上面的 preserve-digest 转发是独立规程，本页没有改写工作流。

preview/rc、普通 release 事件及默认手动 candidate 路径不得移动 latest。只有另行明确授权的稳定提升，才能在默认分支手动选择 `promote-stable`，提供稳定版本、同版本 prerelease 标签、已验收 Digest、核对过的产品 commit、验收证据 URL，并确认 `confirm_tested`。策略会检查 candidate/commit 标签指向该 Digest、拒绝已存在的稳定版本标签，先验证稳定标签再移动 latest，不重新构建。验收 URL 与确认项是人工责任记录，不是自动完成全部验收的证明。

上传 RC 不授权创建 Git Tag/Release、官网部署或稳定提升。当前仍为未发布；准确门禁与未完成项见 [发布说明](../releases/v0.2.0-rc.1.md)。

当前产品未内置认证、TLS 或多用户访问控制。本地命令将端口绑定至 127.0.0.1；对外部署需在受控网络/认证代理后运行，原文与 Key 留在自有环境。

</details>
