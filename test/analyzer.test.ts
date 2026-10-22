import test from "node:test";
import assert from "node:assert/strict";
import { ResponseAnalyzer } from "../src/analyzer/response-analyzer.js";
import { entityFromInput } from "../src/utils/domain.js";

test("counts prose mentions separately from URL-only citations", () => {
  const target = entityFromInput({ type: "target", domain: "vercel.com", name: "Vercel" });
  const competitor = entityFromInput({ type: "competitor", domain: "netlify.com", name: "Netlify" });
  const analysis = new ResponseAnalyzer().analyze({
    target,
    competitors: [competitor],
    text: "Vercel is a top frontend deployment platform. Official URL: https://vercel.com/docs",
    citations: [
      {
        id: "c1",
        url: "https://vercel.com/docs",
        domain: "vercel.com",
        citationIndex: 0,
        source: "answer_text_url",
        citationType: "unknown",
      },
    ],
  });

  const targetMention = analysis.mentions.find((mention) => mention.entityId === target.id);
  assert.equal(targetMention?.count, 1);
  assert.equal(targetMention?.isMentioned, true);
  assert.equal(targetMention?.hasOfficialLink, true);
  assert.equal(analysis.citations[0]?.citationType, "target_official");
});

test("citation without prose mention is not inflated into a mention", () => {
  const target = entityFromInput({ type: "target", domain: "vercel.com", name: "Vercel" });
  const analysis = new ResponseAnalyzer().analyze({
    target,
    competitors: [],
    text: "Official URL: https://vercel.com/docs",
    citations: [
      {
        id: "c1",
        url: "https://vercel.com/docs",
        domain: "vercel.com",
        citationIndex: 0,
        source: "answer_text_url",
        citationType: "unknown",
      },
    ],
  });
  const targetMention = analysis.mentions.find((mention) => mention.entityId === target.id);
  assert.equal(targetMention?.count, 0);
  assert.equal(targetMention?.mentionType, "citation_source");
  assert.equal(targetMention?.hasOfficialLink, true);
});

test("does not mark neutral problem-solving context as negative", () => {
  const target = entityFromInput({ type: "target", domain: "niubistar.com", name: "NiubiStar" });
  const analysis = new ResponseAnalyzer().analyze({
    target,
    competitors: [],
    text: "NiubiStar can publish technical guides that solve common problems developers face when launching open-source projects.",
    citations: [],
  });
  const targetMention = analysis.mentions.find((mention) => mention.entityId === target.id);
  assert.equal(targetMention?.sentiment, "neutral");
  assert.notEqual(targetMention?.mentionType, "negative");
});

test("does not treat words like badges as the negative word bad", () => {
  const target = entityFromInput({ type: "target", domain: "niubistar.com", name: "NiubiStar" });
  const analysis = new ResponseAnalyzer().analyze({
    target,
    competitors: [],
    text: "NiubiStar can improve engagement with rewards, badges, and clear onboarding milestones.",
    citations: [],
  });
  const targetMention = analysis.mentions.find((mention) => mention.entityId === target.id);
  assert.equal(targetMention?.sentiment, "neutral");
  assert.notEqual(targetMention?.mentionType, "negative");
});

test("classifies sentiment from the entity sentence instead of a broad paragraph", () => {
  const target = entityFromInput({ type: "target", domain: "niubistar.com", name: "NiubiStar" });
  const competitor = entityFromInput({ type: "competitor", domain: "githubstar.com", name: "GITHUBSTAR" });
  const analysis = new ResponseAnalyzer().analyze({
    target,
    competitors: [competitor],
    text:
      "NiubiStar and GITHUBSTAR are both mentioned as star exchange tools. NiubiStar emphasizes verification to reduce the risk of spam.",
    citations: [],
  });
  const competitorMention = analysis.mentions.find((mention) => mention.entityId === competitor.id);
  assert.equal(competitorMention?.sentiment, "neutral");
  assert.notEqual(competitorMention?.mentionType, "negative");
});

test("matches only the exact target GitHub repository path", () => {
  const target = entityFromInput({ type: "target", domain: "example.com", name: "Demo", githubRepo: "foo/bar" });
  const exact = new ResponseAnalyzer().analyze({
    target,
    competitors: [],
    text: "See the project.",
    citations: [
      {
        id: "exact",
        url: "https://github.com/foo/bar/",
        domain: "github.com",
        citationIndex: 0,
        source: "answer_text_url",
        citationType: "unknown",
      },
    ],
  });
  assert.equal(exact.citations[0]?.citationType, "target_github");

  const unrelated = new ResponseAnalyzer().analyze({
    target,
    competitors: [],
    text: "See another project.",
    citations: [
      {
        id: "unrelated",
        url: "https://github.com/foo/barista",
        domain: "github.com",
        citationIndex: 0,
        source: "answer_text_url",
        citationType: "unknown",
      },
    ],
  });
  assert.equal(unrelated.citations[0]?.citationType, "third_party");
});
