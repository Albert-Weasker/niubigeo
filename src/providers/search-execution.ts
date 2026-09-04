import type {
  ProviderDefinition,
  ProviderEndpointKind,
  ProviderEndpointProtocol,
  ProviderRunInput,
  SearchExecution,
  WebSearchUsedMode,
} from "../core/types.js";

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function makeSearchExecution(input: {
  definition: ProviderDefinition;
  runInput: ProviderRunInput;
  endpointKind: ProviderEndpointKind;
  endpointProtocol: ProviderEndpointProtocol;
  endpointUrl: string;
  toolName?: string | undefined;
  webQueries?: string[] | undefined;
  citationCount?: number | undefined;
  alwaysOn?: boolean | undefined;
  note?: string | undefined;
}): SearchExecution {
  const requested = Boolean(input.runInput.webSearchEnabled);
  const requestMode = input.runInput.webSearchMode || "auto";
  const alwaysOn = Boolean(input.alwaysOn);
  const webQueries = uniqueStrings(input.webQueries || []);
  const hasExecutionEvidence = webQueries.length > 0 || (input.citationCount || 0) > 0;
  const used = alwaysOn || (requested && hasExecutionEvidence);
  const usedMode: WebSearchUsedMode = alwaysOn && !requested
    ? "provider_always_on"
    : used
      ? "provider_native"
      : requested
        ? "requested_not_confirmed"
        : "none";
  return {
    requested,
    requestMode,
    used,
    usedMode,
    endpointKind: input.endpointKind,
    endpointProtocol: input.endpointProtocol,
    endpointUrl: input.endpointUrl,
    toolName: requested || alwaysOn ? input.toolName : undefined,
    webQueries,
    citationCount: input.citationCount || 0,
    note: input.note,
  };
}
