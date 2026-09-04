export function parseJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Intent analyzer returned an empty response.");

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Continue with object extraction below.
  }

  const start = trimmed.indexOf("{");
  if (start < 0) throw new Error("Intent analyzer response did not contain a JSON object.");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed.charAt(index);
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return JSON.parse(trimmed.slice(start, index + 1)) as unknown;
    }
  }

  throw new Error("Intent analyzer response contained incomplete JSON.");
}
