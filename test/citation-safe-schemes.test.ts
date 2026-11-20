import test from "node:test";
import assert from "node:assert/strict";
import { citationFromUrl, extractAnnotationCitations } from "../src/providers/citation-extractors.js";
test("citation evidence accepts only HTTP and HTTPS URLs", () => {
 for(const url of ["javascript:alert(1)","data:text/html,fixture","file:///tmp/fixture","mailto:fixture@example.com"]) assert.equal(citationFromUrl(url,undefined,0,"provider_annotation"),null);
 assert.ok(citationFromUrl("https://example.com/evidence",undefined,0,"provider_annotation"));
 assert.ok(citationFromUrl("http://example.com/evidence",undefined,0,"provider_annotation"));
 assert.deepEqual(extractAnnotationCitations({choices:[{message:{annotations:[{url:"javascript:alert(1)"}]}}]}),[]);
});
