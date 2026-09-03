import type { FractionMetric } from "../core/types.js";

export function percent(metric: FractionMetric): string {
  if (metric.value === null) return `n/a (${metric.numerator}/${metric.denominator})`;
  const value = Math.round(metric.value * 1000) / 10;
  const fixed = value.toFixed(1);
  const clean = fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
  return `${clean}% (${metric.numerator}/${metric.denominator})`;
}

export function money(value: number | undefined): string {
  return typeof value === "number" ? `$${value.toFixed(6)}` : "n/a";
}

export function mdEscape(value: string): string {
  return value.split("|").join("\\|").split("\n").join(" ");
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const needsQuotes = text.includes('"') || text.includes(",") || text.includes("\n");
  return needsQuotes ? `"${text.split('"').join('""')}"` : text;
}

export function htmlEscape(value: string): string {
  let output = "";
  for (const char of value) {
    if (char === "&") output += "&amp;";
    else if (char === "<") output += "&lt;";
    else if (char === ">") output += "&gt;";
    else if (char === '"') output += "&quot;";
    else output += char;
  }
  return output;
}
