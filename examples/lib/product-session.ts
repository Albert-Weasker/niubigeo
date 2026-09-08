import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { createProductServer } from '../../src/product/product-server.ts';
import { OpenRouterRecognitionAnswerExecutor } from '../../src/product/recognition/recognition-service.ts';
import { loadDotEnv } from '../../src/config/env.ts';
import { StudyBudgetExecutor } from './budget.mjs';
import { readJson } from './io.mjs';

export async function productSession(root: string, plan: any) {
  loadDotEnv();
  process.env.PRODUCT_DATA_DIR = resolve(root, 'product-data');
  process.env.PROVIDER_HTTP_ATTEMPTS = '1';
  process.env.PROVIDER_TIMEOUT_MS = '120000';
  const executor = new StudyBudgetExecutor(join(root, 'provider-ledger.json'), plan.pricing, plan.budget, new OpenRouterRecognitionAnswerExecutor());
  const server = createProductServer({ recognitionExecutor: executor, measurementExecutor: executor });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Isolated product service did not bind.');
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, dataRoot: process.env.PRODUCT_DATA_DIR };
}
