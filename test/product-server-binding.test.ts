import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

for (const host of ['127.0.0.1', '0.0.0.0']) {
  test(`product entrypoint binds to ${host}`, async () => {
    const env = {...process.env, PORT: '0', HOST: host === '127.0.0.1' ? '' : host};
    const child = spawn(process.execPath, [resolve('dist/src/product/product-server.js')], {env, stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    const timer = setTimeout(() => child.kill(), 10000);
    try {
      await new Promise<void>((done, reject) => {
        child.on('error', reject);
        child.on('exit', () => reject(new Error('Server exited before startup: ' + output)));
        child.stdout.on('data', data => {output += String(data); if (output.includes('listening on')) done();});
      });
      assert.ok(output.includes(`http://${host}:0`), output);
    } finally {
      clearTimeout(timer);
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
  });
}
