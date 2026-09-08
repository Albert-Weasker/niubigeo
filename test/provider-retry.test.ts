import test from "node:test";
import assert from "node:assert/strict";
import type { AnswerProvider, AnswerResult, ProviderDefinition, ProviderRunInput } from "../src/core/types.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";
import { isRetryableProviderError, runProviderWithRetry } from "../src/providers/provider-retry.js";

class FlakyProvider implements AnswerProvider {
  readonly definition: ProviderDefinition = {
    id: "flaky",
    label: "Flaky",
    sourceType: "api",
    envKeys: ["FLAKY_API_KEY"],
    defaultModels: ["model"],
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: "Test",
  };
  calls = 0;

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.calls += 1;
    if (this.calls < 3) throw new ProviderRequestError({ code: "rate_limited", message: "Request capacity reached." });
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
      text: "ok",
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

class EmptyUntilBudgetProvider extends FlakyProvider {
  readonly maxTokenAttempts: number[] = [];

  override async run(input: ProviderRunInput): Promise<AnswerResult> {
    this.maxTokenAttempts.push(input.maxTokens);
    if (input.maxTokens < 40) throw new ProviderRequestError({ code: "empty_answer", message: "Provider returned an empty answer." });
    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: "api",
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
      text: "ok",
      citations: [],
      webQueries: [],
      latencyMs: 1,
      createdAt: new Date().toISOString(),
    };
  }
}

test("provider retry handles transient in-flight limits", async () => {
  const previousBase = process.env.PROVIDER_RETRY_BASE_MS;
  const previousAttempts = process.env.PROVIDER_RUN_ATTEMPTS;
  process.env.PROVIDER_RETRY_BASE_MS = "1";
  process.env.PROVIDER_RUN_ATTEMPTS = "4";
  try {
    const provider = new FlakyProvider();
    const result = await runProviderWithRetry(provider, {
      prompt: "hello",
      model: "model",
      apiKey: "key",
      maxTokens: 10,
      temperature: 0,
      webSearchEnabled: false,
    });

    assert.equal(result.text, "ok");
    assert.equal(provider.calls, 3);
  } finally {
    if (previousBase === undefined) delete process.env.PROVIDER_RETRY_BASE_MS;
    else process.env.PROVIDER_RETRY_BASE_MS = previousBase;
    if (previousAttempts === undefined) delete process.env.PROVIDER_RUN_ATTEMPTS;
    else process.env.PROVIDER_RUN_ATTEMPTS = previousAttempts;
  }
});

test("provider retry does not retry authorization failures", () => {
  assert.equal(isRetryableProviderError(new ProviderRequestError({ code: "authentication", message: "Authentication failed." })), false);
  assert.equal(isRetryableProviderError(new ProviderRequestError({ code: "rate_limited", message: "Request capacity reached." })), true);
  assert.equal(isRetryableProviderError(new ProviderRequestError({ code: "timeout", message: "Request timed out." })), true);
  assert.equal(isRetryableProviderError(new ProviderRequestError({ code: "empty_answer", message: "Provider returned an empty answer." })), true);
  assert.equal(isRetryableProviderError(new Error("HTTP 429 rate limit")), false);
});

test("provider retry expands only an exhausted empty-answer output budget", async () => {
  const previousBase = process.env.PROVIDER_RETRY_BASE_MS;
  const previousAttempts = process.env.PROVIDER_RUN_ATTEMPTS;
  process.env.PROVIDER_RETRY_BASE_MS = "1";
  process.env.PROVIDER_RUN_ATTEMPTS = "4";
  try {
    const provider = new EmptyUntilBudgetProvider();
    const result = await runProviderWithRetry(provider, {
      prompt: "hello",
      model: "model",
      apiKey: "key",
      maxTokens: 10,
      temperature: 0,
      webSearchEnabled: false,
    });

    assert.equal(result.text, "ok");
    assert.deepEqual(provider.maxTokenAttempts, [10, 20, 40]);
  } finally {
    if (previousBase === undefined) delete process.env.PROVIDER_RETRY_BASE_MS;
    else process.env.PROVIDER_RETRY_BASE_MS = previousBase;
    if (previousAttempts === undefined) delete process.env.PROVIDER_RUN_ATTEMPTS;
    else process.env.PROVIDER_RUN_ATTEMPTS = previousAttempts;
  }
});
