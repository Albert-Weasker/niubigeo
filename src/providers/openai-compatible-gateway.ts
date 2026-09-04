import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../core/types.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import { ResponsesCompatibleProvider } from "./responses-compatible.js";

function joinEndpoint(baseUrl: string, path: string): string {
  const base = baseUrl.trim();
  const baseWithoutSlash = base.endsWith("/") ? base.slice(0, -1) : base;
  const pathWithSlash = path.startsWith("/") ? path : `/${path}`;
  return `${baseWithoutSlash}${pathWithSlash}`;
}

export class OpenAICompatibleGatewayProvider implements AnswerProvider {
  readonly definition: ProviderDefinition;
  private readonly chatProvider: OpenAICompatibleProvider;
  private readonly responsesProvider: ResponsesCompatibleProvider;

  constructor(definition: ProviderDefinition, baseUrl: string) {
    this.definition = definition;
    this.chatProvider = new OpenAICompatibleProvider({
      definition,
      endpoint: joinEndpoint(baseUrl, "/chat/completions"),
      endpointKind: "custom_gateway",
    });
    this.responsesProvider = new ResponsesCompatibleProvider({
      definition,
      endpoint: joinEndpoint(baseUrl, "/responses"),
      endpointKind: "custom_gateway",
    });
  }

  run(input: ProviderRunInput): Promise<AnswerResult> {
    return input.webSearchEnabled ? this.responsesProvider.run(input) : this.chatProvider.run(input);
  }
}
