function isAsciiWordTerm(value: string): boolean {
  return /^[\x00-\x7F]+$/.test(value) && /[A-Za-z0-9]/.test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match Latin brand names as terms, while keeping CJK matching substring-based. */
export function containsTextTerm(text: string, term: string): boolean {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return false;
  if (!isAsciiWordTerm(normalizedTerm)) {
    return text.toLowerCase().includes(normalizedTerm.toLowerCase());
  }
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(normalizedTerm)}(?![A-Za-z0-9])`, "i");
  return pattern.test(text);
}
