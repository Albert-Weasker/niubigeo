import test from "node:test";
import assert from "node:assert/strict";
import { extractResponseWebQueries,extractAnthropicWebQueries } from "../src/providers/web-query-extractors.js";
test("Responses query evidence comes only from web search calls",()=>{
 assert.deepEqual(extractResponseWebQueries({output:[{type:"function_call",query:"database query"},{type:"web_search_call",action:{query:"actual search"}}]}),["actual search"]);
});
test("Anthropic query evidence comes only from native web search calls",()=>{
 assert.deepEqual(extractAnthropicWebQueries({content:[{type:"tool_use",name:"database",input:{query:"database query"}},{type:"server_tool_use",name:"web_search",input:{query:"actual search"}}]}),["actual search"]);
});
