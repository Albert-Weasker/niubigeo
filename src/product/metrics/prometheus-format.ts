export const PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

export interface PrometheusSample {
  labels?: Readonly<Record<string, string>>;
  value: number;
}

export interface PrometheusMetric {
  name: string;
  help: string;
  type: "gauge" | "counter";
  samples: readonly PrometheusSample[];
}

function escapeText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
}

function formatSample(name: string, sample: PrometheusSample): string {
  const labels = sample.labels ?? {};
  const pairs = Object.keys(labels).sort().map(key => `${key}="${escapeText(labels[key]!).replaceAll('"', '\\"')}"`);
  const suffix = pairs.length ? `{${pairs.join(",")}}` : "";
  const value = sample.value === Infinity ? "+Inf" : sample.value === -Infinity ? "-Inf" : String(sample.value);
  return `${name}${suffix} ${value}`;
}

export function formatPrometheus(metrics: readonly PrometheusMetric[]): string {
  const sorted = [...metrics].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const lines = sorted.flatMap(metric => [
    `# HELP ${metric.name} ${escapeText(metric.help)}`,
    `# TYPE ${metric.name} ${metric.type}`,
    ...metric.samples.map(sample => formatSample(metric.name, sample)).sort(),
  ]);
  return lines.length ? lines.join("\n") + "\n" : "";
}
