import test from "node:test";
import assert from "node:assert/strict";
import { domainMatches } from "../src/utils/domain.js";
test("invalid empty hosts never match",()=>{for(const [a,b] of [["",""],["not a host","bad host"],["https://","https://"]])assert.equal(domainMatches(a!,b!),false);assert.equal(domainMatches("docs.acme.test","acme.test"),true);assert.equal(domainMatches("fakeacme.test","acme.test"),false);});
