const WHITESPACE = new Set([" ", "\n", "\r", "\t", "\f", "\v"]);

export function isWhitespace(character: string): boolean {
  return WHITESPACE.has(character);
}

export function compactWhitespace(value: string): string {
  const output: string[] = [];
  let pendingSpace = false;
  for (const character of value) {
    if (isWhitespace(character)) {
      pendingSpace = output.length > 0;
      continue;
    }
    if (pendingSpace) output.push(" ");
    output.push(character);
    pendingSpace = false;
  }
  return output.join("").trim();
}

export function splitLines(value: string): string[] {
  return value.split("\n").map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
}

export function splitByCharacters(value: string, separators: ReadonlySet<string>): string[] {
  const rows: string[] = [];
  let current = "";
  for (const character of value) {
    if (separators.has(character)) {
      const item = compactWhitespace(current);
      if (item) rows.push(item);
      current = "";
    } else {
      current += character;
    }
  }
  const item = compactWhitespace(current);
  if (item) rows.push(item);
  return rows;
}

export function trimTrailingCharacters(value: string, characters: ReadonlySet<string>): string {
  let end = value.length;
  while (end > 0 && characters.has(value[end - 1] || "")) end -= 1;
  return value.slice(0, end);
}

export function stripMatchingQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) return value.slice(1, -1);
  return value;
}

export function jsonContainer(text: string, opening: "{" | "[", closing: "}" | "]"): string {
  const trimmed = text.trim();
  if (trimmed.startsWith(opening) && trimmed.endsWith(closing)) return trimmed;
  const firstFence = trimmed.indexOf("```");
  if (firstFence >= 0) {
    const contentStart = trimmed.indexOf("\n", firstFence + 3);
    const lastFence = trimmed.lastIndexOf("```");
    if (contentStart >= 0 && lastFence > contentStart) {
      const fenced = trimmed.slice(contentStart + 1, lastFence).trim();
      if (fenced.startsWith(opening) && fenced.endsWith(closing)) return fenced;
    }
  }
  const start = trimmed.indexOf(opening);
  const end = trimmed.lastIndexOf(closing);
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("Structured JSON container was not found.");
}

export function asciiSlug(value: string): string {
  let output = "";
  let separatorPending = false;
  for (const original of value.toLowerCase()) {
    const code = original.charCodeAt(0);
    const allowed =
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      original === "." ||
      original === "_" ||
      original === "-";
    if (allowed) {
      if (separatorPending && output && !output.endsWith("-")) output += "-";
      output += original;
      separatorPending = false;
    } else {
      separatorPending = output.length > 0;
    }
  }
  while (output.startsWith("-")) output = output.slice(1);
  while (output.endsWith("-")) output = output.slice(0, -1);
  return output;
}

export function occurrences(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const rows: number[] = [];
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, offset);
    if (found < 0) break;
    rows.push(found);
    offset = found + Math.max(1, needle.length);
  }
  return rows;
}

export function lastPathExtension(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).at(-1) || "";
  const dot = segment.lastIndexOf(".");
  return dot >= 0 ? segment.slice(dot + 1).toLowerCase() : "";
}
