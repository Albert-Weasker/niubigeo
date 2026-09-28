# 多来源模型测试

适用于开源工作台。在一次域名认知或关键词监测中，可同时选择 OpenRouter、厂商直连和自定义 OpenAI 兼容接口的模型。每个模型独立保存接口来源、型号、联网方式、回答、引用、状态与费用；单个失败不覆盖其他结果。

## 使用步骤

1. 启动 `npm run server`，打开工作台，点击顶部的“连接模型接口”。
2. 连接 OpenRouter，或选择 OpenAI 兼容接口，填写 Base URL 和自己的 API Key。快捷配置提供 OpenAI、Gemini、DeepSeek、Kimi、Qwen、Grok 和 Mistral 的接口地址，地区不同的地址可以手动修改。
3. 模型 ID 留空时读取服务商的 `/models`；服务商没有目录或使用自定义部署 ID 时，可以手动填写，用英文逗号分隔。手动连接不会验证 Key 或调用模型，首次运行时验证。
4. 可以继续添加多个接口。在项目的“AI 模型”页面跨来源多选，对每个模型分别设置联网方式，再保存模型配置和监测配置。
5. 运行域名认知或关键词监测。模型配置中的来源和型号是独立的：即使两个接口都提供 `same-model`，它们也是两条不同记录。

## 型号与联网能力

- OpenRouter 目录读取当前所有文本输出模型，缓存最多 15 分钟；工作台支持按官网主流平台、厂商、来源、联网能力和上架时间筛选，不再截断到前 80 个型号。
- “支持原生联网”表示 OpenRouter 当前目录提供了本应用可调用的搜索路径。实际是否搜索仍以返回证据为准；SDK 搜索增强不会标成模型内建搜索。
- 自定义接口只声明 Chat Completions 兼容性，无法据此确认搜索协议，所以显示“联网能力未验证”，暂不开放联网开关。不能把 OpenRouter 的联网能力复制到厂商直连接口。
- Copilot、Poe、纳米 AI 等消费端产品与 API 模型不同。目录没有对应型号时，列表为空，不用其他型号冒充。
- 支持 `/chat/completions` 的文本模型可以接入。当前域名/关键词结构化分析还要求服务商支持 `response_format: json_schema`；不兼容会如实保留失败状态。连接成功不等于所有高级能力均已验证。

官网平台名单参考：[NiubiGEO 真人测试](https://niubigeo.ai/human-testing)。联网实现参考：[OpenRouter 搜索文档](https://openrouter.ai/docs/guides/features/plugins/web-search)。型号以当前 API 目录为准，不把文档里的示例 ID 当作长期可用列表。

## Key 与自托管

浏览器连接只保存在内存里，不写入 localStorage、sessionStorage、监测配置或结果文件。刷新后需要重新连接；已提交任务继续使用提交时的连接。每个接口的 Key 只发往该接口。连接后的浏览器请求不会回退到服务器的其他 Key。

未配置浏览器连接时，现有服务端环境变量和 OpenRouter 后台定时监测照常使用。**浏览器中的临时自定义连接不能交给独立 scheduler worker 使用**；刷新后重试自定义模型需要重新连接相同 Base URL。

默认仅允许公网 HTTPS 地址（443），禁止凭据 URL、查询参数和重定向，并把 DNS 解析结果固定到实际连接。自托管管理员若需要 Ollama、vLLM 或内网网关，可在启动前显式设置：

```sh
NIUBIGEO_ALLOW_LOCAL_PROVIDERS=true npm run server
```

随后可以填写例如 `http://127.0.0.1:11434/v1`。这是 **NiubiGEO 服务端** 访问的地址；Docker 中的 `127.0.0.1` 指容器自身。无鉴权的本地服务可填写非空占位 Key（例如 `local-development-key`）。只在受信任的自托管环境开启本地地址访问。
