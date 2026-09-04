import test from "node:test";
import assert from "node:assert/strict";
import { extractSiteEvidencePage } from "../src/keywords/site-evidence.js";

test("collects JSON-LD before stripping ordinary scripts from page text", () => {
  const page = extractSiteEvidencePage({
    url: "https://example.dev/",
    html: `
      <!doctype html>
      <html>
        <head>
          <title>ExampleDev</title>
          <script>
            window.__noise = "this should not appear in the text snippet";
          </script>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "ExampleDev",
              "description": "Evidence-backed AI agent auditing",
              "keywords": ["AI agent audit", "token usage evidence"]
            }
          </script>
        </head>
        <body>
          <h1>Verify AI agent work</h1>
        </body>
      </html>
    `,
  });

  assert.deepEqual(page.jsonLdNames, ["ExampleDev"]);
  assert.deepEqual(page.jsonLdDescriptions, ["Evidence-backed AI agent auditing"]);
  assert.deepEqual(page.jsonLdKeywords, ["AI agent audit", "token usage evidence"]);
  assert.equal(page.textSnippet?.includes("this should not appear in the text snippet"), false);
});
