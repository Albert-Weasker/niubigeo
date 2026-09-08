import { randomUUID } from 'node:crypto';
import { hash, readJson, writeJson } from './io.mjs';

export function costReservation(model, input) {
  const online = input.requestParameters.webSearchEnabled;
  const pricing = model.pricing;
  for (const value of [pricing.prompt, pricing.completion, ...(online ? [pricing.web_search] : [])]) if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Cannot reserve an unpriced request.');
  // Online grounding can add context. Reserve the full catalog context window.
  const inputBound = online ? model.context_length : Buffer.byteLength(input.prompt + JSON.stringify(input.structuredOutput || {}), 'utf8') + 8192;
  return inputBound * Number(pricing.prompt) + input.requestParameters.maxTokens * Number(pricing.completion) + (online ? Number(pricing.web_search) : 0);
}

export function spentOrReserved(entries) {
  return entries.reduce((sum, item) => sum + (item.costUsd === null ? item.reservedUsd : Math.max(item.costUsd, 0)), 0);
}

export class StudyBudgetExecutor {
  constructor(path, catalog, budget, delegate) {
    this.path = path; this.catalog = catalog; this.budget = budget; this.delegate = delegate;
    this.queue = Promise.resolve();
  }
  async execute(input) {
    const previous = this.queue;
    let release;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await this.perform(input); } finally { release(); }
  }
  async perform(input) {
    const ledger = await readJson(this.path);
    const model = this.catalog.find(x => x.id === input.modelSnapshot.modelId);
    if (!model) throw new Error('Budget blocked: model is not in frozen catalog.');
    const reservedUsd = costReservation(model, input);
    if (ledger.entries.some(x => x.status === 'unknown_cost')) throw new Error('Budget blocked: an earlier request has unknown cost.');
    if (ledger.entries.length >= this.budget.requestLimit || spentOrReserved(ledger.entries) + reservedUsd > this.budget.costLimitUsd) throw new Error('Budget blocked: cumulative request or cost reservation limit.');
    const entry = { id: randomUUID(), ...input.executionContext, protocol: input.requestParameters.responseSchemaName, modelId: model.id, webSearchMode: input.modelSnapshot.webSearchMode, startedAt: new Date().toISOString(), completedAt: null, promptHash: hash(input.prompt), requestParameters: input.requestParameters, reservedUsd, costUsd: null, tokens: null, status: 'reserved', search: null, error: null };
    ledger.entries.push(entry);
    await writeJson(this.path, ledger);
    try {
      const answer = await this.delegate.execute(input);
      Object.assign(entry, { status: Number.isFinite(answer.costUsd) ? 'completed' : 'unknown_cost', completedAt: new Date().toISOString(), costUsd: answer.costUsd ?? null, tokens: answer.tokenUsage ?? null, rawAnswerHash: hash(answer.text), search: answer.search ?? null });
      await writeJson(this.path, ledger);
      return answer;
    } catch (error) {
      Object.assign(entry, { status: 'unknown_cost', completedAt: new Date().toISOString(), error: error.message });
      await writeJson(this.path, ledger);
      throw error;
    }
  }
}
