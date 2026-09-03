import type { Citation, CitationSource } from "../core/types.js";
import { extractDomainFromUrl } from "../utils/domain.js";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function citationFromUrl(
  url: string,
  title: string | undefined,
  citationIndex: number,
  source: CitationSource,
): Citation | null {
  try {
    const parsed = new URL(url);
    return {
      id: `${source}-${citationIndex}-${parsed.toString()}`,
      url: parsed.toString(),
      domain: extractDomainFromUrl(parsed.toString()),
      title,
      citationIndex,
      source,
      citationType: "unknown",
    };
  } catch {
    return null;
  }
}

export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const citation of citations) {
    const key = `${citation.source}:${citation.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...citation, citationIndex: out.length });
  }
  return out;
}

export function extractTextUrlCitations(text: string, offset = 0): Citation[] {
  const citations: Citation[] = [];
  const regex = /\bhttps?:\/\/[^\s<>)\]}"]+/gi;
  for (const match of text.matchAll(regex)) {
    const raw = match[0].replace(/[.,;:!?]+$/, "");
    const citation = citationFromUrl(raw, undefined, offset + citations.length, "answer_text_url");
    if (citation) citations.push(citation);
  }
  return dedupeCitations(citations);
}

export function extractAnnotationCitations(raw: unknown): Citation[] {
  const root = asObject(raw);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const firstChoice = asObject(choices[0]);
  const message = asObject(firstChoice?.message);
  const annotations = Array.isArray(message?.annotations) ? message.annotations : [];
  const citations: Citation[] = [];

  for (const annotation of annotations) {
    const obj = asObject(annotation);
    if (!obj) continue;
    const directUrl = typeof obj.url === "string" ? obj.url : undefined;
    const directTitle = typeof obj.title === "string" ? obj.title : undefined;
    if (directUrl) {
      const citation = citationFromUrl(directUrl, directTitle, citations.length, "provider_annotation");
      if (citation) citations.push(citation);
      continue;
    }
    const nested = asObject(obj.url_citation);
    const nestedUrl = typeof nested?.url === "string" ? nested.url : undefined;
    const nestedTitle = typeof nested?.title === "string" ? nested.title : undefined;
    if (nestedUrl) {
      const citation = citationFromUrl(nestedUrl, nestedTitle, citations.length, "provider_annotation");
      if (citation) citations.push(citation);
    }
  }

  return dedupeCitations(citations);
}

export function extractPerplexityCitations(raw: unknown): Citation[] {
  const root = asObject(raw);
  const citations: Citation[] = [];
  const citationArray = Array.isArray(root?.citations) ? root.citations : [];
  for (const item of citationArray) {
    const url = typeof item === "string" ? item : typeof asObject(item)?.url === "string" ? String(asObject(item)?.url) : "";
    const title = typeof asObject(item)?.title === "string" ? String(asObject(item)?.title) : undefined;
    const citation = citationFromUrl(url, title, citations.length, "provider_citation_array");
    if (citation) citations.push(citation);
  }

  const searchResults = Array.isArray(root?.search_results) ? root.search_results : [];
  for (const result of searchResults) {
    const obj = asObject(result);
    const url = typeof obj?.url === "string" ? obj.url : undefined;
    const title = typeof obj?.title === "string" ? obj.title : undefined;
    if (!url) continue;
    const citation = citationFromUrl(url, title, citations.length, "provider_search_result");
    if (citation) citations.push(citation);
  }

  return dedupeCitations(citations);
}

export function extractGeminiGroundingCitations(raw: unknown): Citation[] {
  const root = asObject(raw);
  const candidates = Array.isArray(root?.candidates) ? root.candidates : [];
  const first = asObject(candidates[0]);
  const metadata = asObject(first?.groundingMetadata);
  const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const citations: Citation[] = [];

  for (const chunk of chunks) {
    const web = asObject(asObject(chunk)?.web);
    const url = typeof web?.uri === "string" ? web.uri : undefined;
    const title = typeof web?.title === "string" ? web.title : undefined;
    if (!url) continue;
    const citation = citationFromUrl(url, title, citations.length, "provider_grounding_chunk");
    if (citation) citations.push(citation);
  }

  return dedupeCitations(citations);
}
