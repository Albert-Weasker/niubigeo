# Local Ollama / 本地 Ollama

## English

The existing custom OpenAI-compatible connection can use a local Ollama server in an operator-controlled deployment. No paid OpenRouter key is required for this path.

1. Install Ollama and download a model supported by your hardware. Use its exact installed ID from `ollama list`; start the local server.
2. Start NiubiGEO on the same host with `NIUBIGEO_ALLOW_LOCAL_PROVIDERS=true npm run server` (PowerShell: `$env:NIUBIGEO_ALLOW_LOCAL_PROVIDERS='true'; npm run server`). This opt-in relaxes the custom-provider network boundary; use it only for a trusted private deployment, not an untrusted public instance.
3. Open custom model connections. Enter `http://localhost:11434/v1` as Base URL, `ollama` as the placeholder key, and the installed model ID. Ollama ignores the key for local inference.
4. Save the model baseline and run a small test. Local model quality and structured-output support vary. Search remains disabled; these are local model answers, not consumer-app or web-grounded results.

Inside Docker, `localhost` refers to that container. Configure a reachable host/service address for your environment; do not assume it points to the host's Ollama server. Browser-scoped custom connections are not passed to the independent scheduler worker. This guide does not claim unattended Ollama scheduling support.

## 中文

已有的自定义 OpenAI 兼容连接可以在管理员控制的部署中使用本地 Ollama，不需要付费 OpenRouter Key。

1. 安装 Ollama，下载适合机器资源的模型并启动本地服务。用 `ollama list` 查看实际安装的完整型号。
2. 在同一宿主机启动 NiubiGEO：`NIUBIGEO_ALLOW_LOCAL_PROVIDERS=true npm run server`。PowerShell 使用 `$env:NIUBIGEO_ALLOW_LOCAL_PROVIDERS='true'; npm run server`。此开关放宽自定义接口的网络边界，仅用于可信私有部署，不用于不可信用户可访问的公网实例。
3. 自定义连接的 Base URL 填 `http://localhost:11434/v1`，Key 填占位值 `ollama`，型号填实际安装的 ID。本地推理时 Ollama 忽略该 Key。
4. 保存模型基线后先做小规模测试。模型质量和结构化输出能力因型号而异；此路径不启用联网，也不代表消费端 AI 应用结果。

Docker 内的 `localhost` 指向容器本身，需要使用实际可达的宿主机或服务地址。浏览器会话中的自定义连接不会传给独立 worker，本指南不宣称支持无人值守的 Ollama 定时任务。

Reference / 依据：[Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility). The connection steps were checked against NiubiGEO code and Ollama documentation; no real local model was downloaded or benchmarked for this release.
