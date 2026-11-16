# Prometheus and Grafana

[简体中文](prometheus.zh-CN.md)

The product server can expose stored keyword monitoring results and scheduler health at `GET /metrics` in Prometheus text format 0.0.4. A scrape reads existing records and caches the response in memory. It makes no model requests and writes no data files.

## Enable the endpoint

Set these variables in the product server's environment or local `.env` and restart the server.

| Variable | Default | Behavior |
| --- | --- | --- |
| `METRICS_ENABLED` | `false` | Set to `true` to enable the endpoint. While disabled, `/metrics` returns 404. |
| `METRICS_TOKEN` | Unset | When set, scrapes must send `Authorization: Bearer <token>`. Missing or incorrect credentials return 401. |
| `METRICS_INCLUDE_NAMES` | `false` | Set to `true` to include project domains, keyword text, and model display names. |
| `METRICS_CACHE_SECONDS` | `30` | Lifetime of a cached scrape in seconds. Set to `0` to refresh on each scrape. Concurrent scrapes can share one collection. |

With the default labels, projects and monitors use generated IDs and catalog models use their public IDs. Custom model IDs appear as `custom-` followed by the first 12 hexadecimal characters of the SHA-256 digest of the stored ID. The three opt-in info metrics expose domains, keywords, and model names to anyone who can scrape or query the metrics. Custom model info uses the upstream model name with the endpoint URL removed. Keep names disabled for shared dashboards if those details are private. Scrapes exclude provider keys, prompts, answers, and citations.

## Configure Prometheus

Save this as `prometheus.yml` alongside the repository's Compose file. For a Prometheus process on the same host as a directly started product server, change the target to `127.0.0.1:8787` and use the local path to your credential file.

```yaml
scrape_configs:
  - job_name: niubigeo
    scrape_interval: 30s
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /run/secrets/niubigeo_metrics_token
    static_configs:
      - targets: ["niubistar-geo:8787"]
```

For the repository's Docker deployment, save this as `docker-compose.metrics.yml`. Export `METRICS_TOKEN` in the shell that starts Compose so the server environment and the Prometheus credential file get the same value. The Prometheus port is bound to localhost for a Grafana process running on the host.

```yaml
services:
  niubistar-geo:
    environment:
      METRICS_ENABLED: "true"
      METRICS_TOKEN: "${METRICS_TOKEN:?Set METRICS_TOKEN}"
  prometheus:
    image: prom/prometheus
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    secrets:
      - niubigeo_metrics_token

secrets:
  niubigeo_metrics_token:
    environment: METRICS_TOKEN

volumes:
  prometheus-data:
```

```sh
docker compose -f docker-compose.yml -f docker-compose.metrics.yml up -d --build
```

For an unauthenticated scrape on a trusted network, omit the `authorization` block, the Compose secret entries, and the `METRICS_TOKEN` setting. A scrape across a shared network can use HTTPS through a reverse proxy. See [Prometheus scrape configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/) and [Docker Compose secrets](https://docs.docker.com/reference/compose-file/secrets/).

## Grafana panels

Use Prometheus as the Grafana data source. Use time-series panels to track changes between scrapes. For the first three queries, use `{{model_id}}` in the legend and filter `project_id` and `monitor_id` as needed.

**Mention ratio per model** uses a 0–1 percentage unit. Errored samples are excluded, and the series is absent when the latest finished run has no valid samples for the model.

```promql
niubigeo_keyword_mention_ratio{job="niubigeo"}
```

**Best ranking position per model** uses rank 1 for the top result in the latest finished run. An unranked model has no series.

```promql
niubigeo_keyword_best_position{job="niubigeo"}
```

**Errored samples per model** counts failed samples in each monitor's latest finished run, including errors carried forward in retry snapshots.

```promql
niubigeo_keyword_model_errors{job="niubigeo"}
```

**Failure rate among stored finished runs** is the fraction of completed or failed runs that failed. The query omits monitors without finished runs. These are stored-count gauges, so use the fraction directly. [PromQL rate function](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate)

```promql
niubigeo_keyword_runs{job="niubigeo",status="failed"}
/ on (instance, project_id, monitor_id)
  (sum by (instance, project_id, monitor_id)
    (niubigeo_keyword_runs{job="niubigeo",status!="queued"}) > 0)
```

**Worker heartbeat age** is the number of seconds since the newest recorded heartbeat. Pair it with `niubigeo_workers{state="running"}` to check for live workers. The heartbeat time is absent until a worker has reported.

```promql
time() - niubigeo_worker_last_heartbeat_timestamp_seconds{job="niubigeo"}
```

## Metrics and cardinality

The collector includes non-deleted projects and their stored monitors, including archived projects and disabled monitors. Run counts include every stored run for a monitor. The timestamp and model metrics use the same latest finished run, with either `completed` or `failed` status. A finished run's timestamp uses its completion time, falling back to its start time for older records. When a run fails before recording any model samples, the scrape reports its timestamp and run count and omits that monitor's model metrics. Product-wide provider call and token metrics are a follow-up.

For each project, let **M** be its number of monitors and **K** the number of model–monitor pairs in their latest finished runs. It contributes up to **2 + 4M + 3K** series per scrape. That covers two monitor-state counts per project, three run-status counts and up to one timestamp per monitor, and up to three gauges per model–monitor pair. Enabling names adds **1 + M** project and monitor info series per project and up to **U** global model info series, where **U** is the number of distinct exported model IDs across all projects. Each model ID uses the most recently observed name.

The instance emits **6** additional series globally, one each for build info and project count and four for worker counts, plus up to **1** for the newest heartbeat. Run history length and worker restarts do not add series to a scrape. State and name changes can create new historical series in Prometheus.
