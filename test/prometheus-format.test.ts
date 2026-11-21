import assert from "node:assert/strict";
import test from "node:test";
import { formatPrometheus, type PrometheusMetric } from "../src/product/metrics/prometheus-format.js";

test("Prometheus text is ordered, escapes label values and HELP, and ends with a newline", () => {
  const metrics: PrometheusMetric[] = [
    { name: "example_z", help: "A count.", type: "gauge", samples: [{ value: 3 }] },
    {
      name: "example_a",
      help: "Path \\ and\nline.",
      type: "gauge",
      samples: [
        { labels: { z: "second", a: "z" }, value: 0 },
        { labels: { z: 'quote" slash\\ newline\n你好', a: "a" }, value: 0.5 },
      ],
    },
  ];
  const expected = [
    String.raw`# HELP example_a Path \\ and\nline.`,
    "# TYPE example_a gauge",
    String.raw`example_a{a="a",z="quote\" slash\\ newline\n你好"} 0.5`,
    'example_a{a="z",z="second"} 0',
    "# HELP example_z A count.",
    "# TYPE example_z gauge",
    "example_z 3",
    "",
  ].join("\n");
  assert.equal(formatPrometheus(metrics), expected);
  const reversed = [...metrics].reverse().map(metric => ({ ...metric, samples: [...metric.samples].reverse() }));
  assert.equal(formatPrometheus(reversed), expected);
});
