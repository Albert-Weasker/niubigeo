import test from "node:test";
import assert from "node:assert/strict";
import { githubRepoSlug } from "../src/utils/domain.js";
test("repository inputs reject malformed slugs and nonweb schemes",()=>{for(const value of ["file://github.com/owner/repo","owner/repo?x=1","owner/repo#readme","owner!/repo"])assert.equal(githubRepoSlug(value),null,value);assert.equal(githubRepoSlug("owner/repo"),"owner/repo");assert.equal(githubRepoSlug("github.com/owner/repo"),"owner/repo");assert.equal(githubRepoSlug("https://github.com/owner/repo?tab=readme"),"owner/repo");});
