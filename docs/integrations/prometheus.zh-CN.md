# Prometheus 与 Grafana

产品服务可通过 `GET /metrics` 导出已保存的关键词监控数据与 worker 状态。抓取只读取现有记录，并在内存中短暂缓存响应。

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `METRICS_ENABLED` | `false` | 设为 `true` 后开启端点。关闭时返回 404。 |
| `METRICS_TOKEN` | 未设置 | 设置后，抓取请求须提供 `Authorization: Bearer <token>`。 |
| `METRICS_INCLUDE_NAMES` | `false` | 设为 `true` 后导出项目域名、关键词文本和模型名称。 |
| `METRICS_CACHE_SECONDS` | `30` | 响应缓存秒数。设为 `0` 可在每次抓取时刷新。 |

修改环境变量后，重启产品服务或重新创建容器。在 Prometheus 中配置 `/metrics` 抓取目标，然后在 Grafana 中添加 Prometheus 数据源。默认使用项目和监控项的内部 ID、公开模型 ID，以及自定义模型 ID 的哈希。开启名称前，请确认抓取端和仪表盘的访问范围。

提及比例排除失败样本。没有有效样本或排名时，相应序列缺失。可通过 worker 状态计数和最近心跳时间查看调度状态。

[英文配置指南](prometheus.md)包含 Prometheus、Docker Compose 和 Grafana 查询示例，以及时间序列数量的计算方法。
