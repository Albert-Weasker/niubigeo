import test from "node:test";
import assert from "node:assert/strict";
import { createPublicWebFetcher, isPublicWebAddress, validatePublicWebUrl } from "../src/utils/public-web-fetch.js";
import { SiteEvidenceCollector } from "../src/keywords/site-evidence.js";
import { fetchHomepageMetadata } from "../src/profile/domain-profiler.js";
import { createProductServer } from "../src/server.js";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

const publicAddress = { address: "93.184.216.34", family: 4 };
const page = { status: 200, contentType: "text/html", text: "<title>Public site</title>" };

test("rejects private, reserved, encoded and IPv6 local destinations", () => {
  for (const address of ["0.0.0.0", "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "224.0.0.1", "::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1"]) {
    assert.equal(isPublicWebAddress(address), false, address);
  }
  for (const host of ["localhost", "localhost.", "x.localhost", "x.local", "x.internal", "127.1", "2130706433", "0x7f000001", "[::1]", "[::ffff:127.0.0.1]"]) {
    assert.throws(() => validatePublicWebUrl(`http://${host}`), host);
  }
  for (const url of ["file:///etc/passwd", "ftp://example.com", "https://user:pass@example.com"]) assert.throws(() => validatePublicWebUrl(url));
  assert.equal(isPublicWebAddress(publicAddress.address), true);
  assert.equal(isPublicWebAddress("2606:4700:4700::1111"), true);
});

test("rejects private or mixed DNS answers before connecting, regardless of local provider override", async () => {
  const previous = process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS;
  process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS = "true";
  let connections = 0;
  try {
    for (const answers of [[], [{ address: "10.0.0.1", family: 4 }], [publicAddress, { address: "::1", family: 6 }]]) {
      const fetchPage = createPublicWebFetcher(async () => answers, async () => { connections++; return page; });
      await assert.rejects(fetchPage("https://example.com"));
    }
    assert.equal(connections, 0);
  } finally {
    if (previous === undefined) delete process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS;
    else process.env.NIUBIGEO_ALLOW_LOCAL_PROVIDERS = previous;
  }
});

test("checks each redirect and prevents DNS rebinding on a repeated hostname", async () => {
  for (const location of ["http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://internal.example/", "/next"]) {
    let resolutions = 0;
    let connections = 0;
    const fetchPage = createPublicWebFetcher(async () => ++resolutions === 1 ? [publicAddress] : [{ address: "127.0.0.1", family: 4 }], async (_url, addresses) => {
      connections++;
      assert.deepEqual(addresses, [publicAddress]);
      return { ...page, status: 302, location };
    });
    await assert.rejects(fetchPage("https://example.com"));
    assert.equal(connections, 1, location);
  }
});

test("preserves public relative and cross-host redirects and final evidence URL", async () => {
  const hosts: string[] = [];
  const urls: string[] = [];
  const fetchPage = createPublicWebFetcher(async host => { hosts.push(host); return [publicAddress]; }, async (url, addresses) => {
    assert.deepEqual(addresses, [publicAddress]);
    urls.push(url.href);
    return urls.length === 1 ? { ...page, status: 301, location: "/about" }
      : urls.length === 2 ? { ...page, status: 307, location: "https://www.example.com/about" } : page;
  });
  assert.deepEqual(await fetchPage("http://example.com"), { url: "https://www.example.com/about", text: page.text, contentType: page.contentType });
  assert.deepEqual(hosts, ["example.com", "example.com", "www.example.com"]);
});

test("bounds redirect chains and preserves unsuccessful response behavior", async () => {
  let count = 0;
  const looping = createPublicWebFetcher(async () => [publicAddress], async () => { count++; return { ...page, status: 302, location: "/loop" }; });
  await assert.rejects(looping("https://example.com"), { message: "Too many website redirects." });
  assert.equal(count, 6);
  assert.equal(await createPublicWebFetcher(async () => [publicAddress], async () => ({ ...page, status: 404 }))("https://example.com"), null);
});

test("collectors do not reflect local content and audit-plan rejects local domains", async () => {
  const evidence = await new SiteEvidenceCollector().collect({ submittedDomain: "localhost" });
  assert.deepEqual(evidence.pages, []);
  assert.deepEqual(evidence.sitemapUrls, []);
  assert.equal((await fetchHomepageMetadata("localhost")).title, undefined);
  const server = createProductServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const domain of ["localhost", "127.1", "169.254.169.254", "[::1]", "file:///etc/passwd"]) {
      const response = await fetch(`${origin}/audit-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
      assert.equal(response.status, 400, domain);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test("socket lookup is pinned without changing the HTTP/TLS hostname; response size is bounded", async () => {
  const https = (await import("node:https")).default;
  const { syncBuiltinESMExports } = await import("node:module");
  const { EventEmitter } = await import("node:events");
  const { PassThrough } = await import("node:stream");
  const original = https.request;
  let oversized = false;
  let resolutions = 0;
  try {
    https.request = ((url: URL, options: import("node:https").RequestOptions, callback: (response: unknown) => void) => {
      assert.equal(url.hostname, "example.com");
      assert.equal(options.agent, false);
      const lookup = options.lookup!;
      lookup("example.com", { all: true }, ((error: unknown, addresses: unknown) => {
        assert.equal(error, null);
        assert.deepEqual(addresses, [publicAddress]);
      }) as never);
      const request = new EventEmitter() as InstanceType<typeof EventEmitter> & { end: () => void };
      request.end = () => queueMicrotask(() => {
        const response = Object.assign(new PassThrough(), { statusCode: 200, headers: { "content-type": "text/html" } });
        callback(response);
        response.end(oversized ? Buffer.alloc(2 * 1024 * 1024 + 1) : page.text);
      });
      return request;
    }) as typeof https.request;
    syncBuiltinESMExports();
    const fetchPage = createPublicWebFetcher(async () => { resolutions++; return [publicAddress]; });
    assert.equal((await fetchPage("https://example.com"))?.text, page.text);
    assert.equal(resolutions, 1);
    oversized = true;
    await assert.rejects(fetchPage("https://example.com"), { message: "Website evidence response exceeds 2 MiB." });
  } finally {
    https.request = original;
    syncBuiltinESMExports();
  }
});
