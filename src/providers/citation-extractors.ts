import type { Citation, CitationSource } from "../core/types.js";
import { extractDomainFromUrl } from "../utils/domain.js";
import { linkifyit } from "linkify-it";
import { trimTrailingCharacters } from "../utils/text.js";

const linkify = linkifyit();
const URL_TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?"]);

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function citationFromUrl(
  url: string,
  title: string | undefined,
  citationIndex: number,
  source: CitationSource,
  providerPayloadPath?: string,
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
      providerPayloadPath,
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
  for (const match of linkify.match(text) || []) {
    if (!match.url.startsWith("http://") && !match.url.startsWith("https://")) continue;
    const raw = trimTrailingCharacters(match.url, URL_TRAILING_PUNCTUATION);
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

  for (let annotationIndex = 0; annotationIndex < annotations.length; annotationIndex += 1) {
    const annotation = annotations[annotationIndex];
    const obj = asObject(annotation);
    if (!obj) continue;
    const directUrl = typeof obj.url === "string" ? obj.url : undefined;
    const directTitle = typeof obj.title === "string" ? obj.title : undefined;
    if (directUrl) {
      const citation = citationFromUrl(directUrl, directTitle, citations.length, "provider_annotation", `choices[0].message.annotations[${annotationIndex}].url`);
      if (citation) citations.push(citation);
      continue;
    }
    const nested = asObject(obj.url_citation);
    const nestedUrl = typeof nested?.url === "string" ? nested.url : undefined;
    const nestedTitle = typeof nested?.title === "string" ? nested.title : undefined;
    if (nestedUrl) {
      const citation = citationFromUrl(nestedUrl, nestedTitle, citations.length, "provider_annotation", `choices[0].message.annotations[${annotationIndex}].url_citation.url`);
      if (citation) citations.push(citation);
    }
  }

  return dedupeCitations(citations);
}

function collectAnnotationCitations(annotations: unknown[], citations: Citation[], prefix: string): void {
  for (let annotationIndex = 0; annotationIndex < annotations.length; annotationIndex += 1) {
    const annotation = annotations[annotationIndex];
    const obj = asObject(annotation);
    if (!obj) continue;
    const directUrl = typeof obj.url === "string" ? obj.url : undefined;
    const directTitle = typeof obj.title === "string" ? obj.title : undefined;
    if (directUrl) {
      const citation = citationFromUrl(directUrl, directTitle, citations.length, "provider_annotation", `${prefix}[${annotationIndex}].url`);
      if (citation) citations.push(citation);
      continue;
    }
    const nested = asObject(obj.url_citation);
    const nestedUrl = typeof nested?.url === "string" ? nested.url : undefined;
    const nestedTitle = typeof nested?.title === "string" ? nested.title : undefined;
    if (nestedUrl) {
      const citation = citationFromUrl(nestedUrl, nestedTitle, citations.length, "provider_annotation", `${prefix}[${annotationIndex}].url_citation.url`);
      if (citation) citations.push(citation);
    }
  }
}

export function extractResponseCitations(raw: unknown): Citation[] {
  const root = asObject(raw);
  const output = Array.isArray(root?.output) ? root.output : [];
  const citations: Citation[] = [];

  for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
    const item = output[outputIndex];
    const itemObject = asObject(item);
    const content = Array.isArray(itemObject?.content) ? itemObject.content : [];
    for (let contentIndex = 0; contentIndex < content.length; contentIndex += 1) {
      const part = content[contentIndex];
      const partObject = asObject(part);
      const annotations = Array.isArray(partObject?.annotations) ? partObject.annotations : [];
      collectAnnotationCitations(annotations, citations, `output[${outputIndex}].content[${contentIndex}].annotations`);
    }
  }

  return dedupeCitations(citations);
}

export function extractAnthropicCitations(raw: unknown): Citation[] {
  const root = asObject(raw);
  const content = Array.isArray(root?.content) ? root.content : [];
  const citations: Citation[] = [];

  for (let contentIndex = 0; contentIndex < content.length; contentIndex += 1) {
    const part = content[contentIndex];
    const block = asObject(part);
    const blockCitations = Array.isArray(block?.citations) ? block.citations : [];
    for (let citationIndex = 0; citationIndex < blockCitations.length; citationIndex += 1) {
      const citationValue = blockCitations[citationIndex];
      const citationObject = asObject(citationValue);
      const url = typeof citationObject?.url === "string" ? citationObject.url : undefined;
      const title = typeof citationObject?.title === "string" ? citationObject.title : undefined;
      if (!url) continue;
      const citation = citationFromUrl(url, title, citations.length, "provider_annotation", `content[${contentIndex}].citations[${citationIndex}].url`);
      if (citation) citations.push(citation);
    }
  }

  return dedupeCitations(citations);
}

export function extractPerplexityCitations(raw: unknown): Citation[] {
  const root = asObject(raw);
  const citations: Citation[] = [];
  const citationArray = Array.isArray(root?.citations) ? root.citations : [];
  for (let itemIndex = 0; itemIndex < citationArray.length; itemIndex += 1) {
    const item = citationArray[itemIndex];
    const url = typeof item === "string" ? item : typeof asObject(item)?.url === "string" ? String(asObject(item)?.url) : "";
    const title = typeof asObject(item)?.title === "string" ? String(asObject(item)?.title) : undefined;
    const citation = citationFromUrl(url, title, citations.length, "provider_citation_array", `citations[${itemIndex}]`);
    if (citation) citations.push(citation);
  }

  const searchResults = Array.isArray(root?.search_results) ? root.search_results : [];
  for (let resultIndex = 0; resultIndex < searchResults.length; resultIndex += 1) {
    const result = searchResults[resultIndex];
    const obj = asObject(result);
    const url = typeof obj?.url === "string" ? obj.url : undefined;
    const title = typeof obj?.title === "string" ? obj.title : undefined;
    if (!url) continue;
    const citation = citationFromUrl(url, title, citations.length, "provider_search_result", `search_results[${resultIndex}].url`);
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

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const web = asObject(asObject(chunk)?.web);
    const url = typeof web?.uri === "string" ? web.uri : undefined;
    const title = typeof web?.title === "string" ? web.title : undefined;
    if (!url) continue;
    const citation = citationFromUrl(url, title, citations.length, "provider_grounding_chunk", `candidates[0].groundingMetadata.groundingChunks[${chunkIndex}].web.uri`);
    if (citation) citations.push(citation);
  }

  return dedupeCitations(citations);
}
