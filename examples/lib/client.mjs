export class ProductClient {
  constructor(baseUrl) {
    this.baseUrl = new URL(baseUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(this.baseUrl.hostname)) throw new Error('Case validation requires an isolated local product service.');
  }
  async request(path, method = 'GET', body, key) {
    const response = await fetch(new URL(path, this.baseUrl), { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(`${response.status}: ${result.code || result.error || 'Product request failed'}`);
    return result;
  }
  async wait(path) {
    for (let i = 0; i < 600; i++) {
      const result = await this.request(path);
      if (!['queued', 'running'].includes(result.run.status)) return result;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Product run did not reach a terminal state within ten minutes.');
  }
}
