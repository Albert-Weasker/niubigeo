import type { IntentRunAnalysis } from "../intent/intent-schema.js";

export type SourceType = "api" | "browser" | "human_verified";

export type EntityType = "target" | "competitor";

export type PromptType =
  | "brand"
  | "category"
  | "recommendation"
  | "comparison"
  | "alternative"
  | "scenario"
  | "keyword_category"
  | "keyword_recommendation"
  | "keyword_comparison"
  | "keyword_alternative"
  | "keyword_scenario"
  | "keyword_source";

export type KeywordSource =
  | "user"
  | "meta_keywords"
  | "title"
  | "description"
  | "heading"
  | "body"
  | "json_ld"
  | "sitemap"
  | "github_topic"
  | "github_readme"
  | "provider_profile";

export type KeywordIntent = "category" | "recommendation" | "comparison" | "alternative" | "scenario" | "source";

export type KeywordSeedSource = "user_keyword" | "site_keyword" | "github_keyword" | "provider_generated";

export type KeywordMode = "site_plus_user" | "user_only" | "site_only";

export type PromptAuditCategory = "brand_awareness" | "organic_discovery" | "comparison" | "other";

export type CitationSource =
  | "provider_annotation"
  | "provider_citation_array"
  | "provider_search_result"
  | "provider_grounding_chunk"
  | "answer_text_url";

export type WebSearchRequestMode = "auto" | "provider_native";

export type WebSearchUsedMode = "none" | "requested_not_confirmed" | "provider_native" | "provider_always_on";

export type ProviderEndpointKind = "official_api" | "custom_gateway";

export type ProviderEndpointProtocol =
  | "chat_completions"
  | "responses"
  | "messages"
  | "gemini_generate_content"
  | "perplexity_sonar";

export interface NativeWebSearchCapability {
  endpointProtocol: ProviderEndpointProtocol;
  toolName: string;
  alwaysOn?: boolean | undefined;
}

export type CitationType =
  | "target_official"
  | "target_github"
  | "competitor_official"
  | "third_party"
  | "unknown";

export type MentionType =
  | "not_mentioned"
  | "ordinary"
  | "recommendation"
  | "list_appearance"
  | "comparison"
  | "citation_source"
  | "negative"
  | "rejection"
  | "incorrect";

export type Sentiment = "positive" | "neutral" | "negative";

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  domain: string;
  aliases: string[];
  githubRepo?: string | undefined;
}

export interface MonitoringPrompt {
  id: string;
  type: PromptType;
  topic: string;
  language: string;
  text: string;
  enabled: boolean;
  auditCategory?: PromptAuditCategory | undefined;
  targetIncluded?: boolean | undefined;
  keywordIds?: string[] | undefined;
  keywordClusterId?: string | undefined;
  keywordIntent?: KeywordIntent | undefined;
  seedSource?: KeywordSeedSource | undefined;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface Citation {
  id: string;
  url: string;
  domain: string;
  title?: string | undefined;
  citationIndex: number;
  source: CitationSource;
  citationType: CitationType;
  entityId?: string | undefined;
  entityName?: string | undefined;
  promptId?: string | undefined;
  runId?: string | undefined;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  sourceType: SourceType;
  envKeys: string[];
  defaultModels: string[];
  supportsAnyModel?: boolean | undefined;
  supportsNativeCitations: boolean;
  supportsWebSearch: boolean;
  nativeWebSearch?: NativeWebSearchCapability | undefined;
  resultCaveat: string;
}

export interface ProviderRunInput {
  prompt: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  webSearchEnabled: boolean;
  webSearchMode?: WebSearchRequestMode | undefined;
  responseFormat?: "json_object" | undefined;
}

export interface SearchExecution {
  requested: boolean;
  requestMode: WebSearchRequestMode;
  used: boolean;
  usedMode: WebSearchUsedMode;
  endpointKind: ProviderEndpointKind;
  endpointProtocol: ProviderEndpointProtocol;
  endpointUrl: string;
  toolName?: string | undefined;
  webQueries: string[];
  citationCount: number;
  note?: string | undefined;
}

export interface AnswerResult {
  providerId: string;
  providerName: string;
  sourceType: SourceType;
  sourceLabel: string;
  resultCaveat: string;
  model: string;
  modelVersion: string;
  text: string;
  rawJson: unknown;
  citations: Citation[];
  webQueries: string[];
  search?: SearchExecution | undefined;
  tokenUsage?: TokenUsage | undefined;
  costUsd?: number | undefined;
  latencyMs: number;
  createdAt: string;
}

export interface AnswerProvider {
  definition: ProviderDefinition;
  run(input: ProviderRunInput): Promise<AnswerResult>;
}

export interface Mention {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  count: number;
  firstPosition: number | null;
  rankPosition: number | null;
  mentionType: MentionType;
  sentiment: Sentiment;
  isMentioned: boolean;
  isRecommendation: boolean;
  isFirstPosition: boolean;
  hasCitation: boolean;
  hasOfficialLink: boolean;
  context: string | null;
  paragraph: string | null;
}

export interface PromptRunAnalysis {
  mentions: Mention[];
  citations: Citation[];
}

export interface ProviderTarget {
  providerId: string;
  model: string;
  webSearchEnabled?: boolean | undefined;
  webSearchMode?: WebSearchRequestMode | undefined;
}

export interface PromptGenerationEvidence {
  providerId: string;
  model: string;
  sourceLabel: string;
  prompt: string;
  rawJsonPath?: string | undefined;
  text: string;
}

export interface DiscoveredCompetitor {
  name: string;
  domain: string;
  reason: string;
  relationship?: "direct_competitor" | "adjacent" | "category" | "infrastructure" | "unknown" | undefined;
  confidence?: number | undefined;
}

export interface DomainProfile {
  domain: string;
  brandName: string;
  aliases: string[];
  category: string;
  description: string;
  competitors: DiscoveredCompetitor[];
  promptSuggestions: Array<{
    type: PromptType;
    topic: string;
    prompt: string;
  }>;
}

export interface DiscoveryEvidence {
  providerId: string;
  model: string;
  sourceLabel: string;
  submittedDomain?: string | undefined;
  homepageUrl: string;
  homepageTitle?: string | undefined;
  homepageDescription?: string | undefined;
  homepageTextSnippet?: string | undefined;
  evidencePages?: Array<{
    url: string;
    title?: string | undefined;
  }> | undefined;
  prompt: string;
  rawJsonPath?: string | undefined;
  text: string;
}

export interface SiteEvidencePage {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
  metaKeywords: string[];
  headings: string[];
  ogTitle?: string | undefined;
  ogDescription?: string | undefined;
  twitterTitle?: string | undefined;
  twitterDescription?: string | undefined;
  jsonLdKeywords: string[];
  jsonLdNames: string[];
  jsonLdDescriptions: string[];
  textSnippet?: string | undefined;
}

export interface GitHubEvidence {
  repo: string;
  description?: string | undefined;
  topics: string[];
  readmeSnippet?: string | undefined;
  license?: string | undefined;
  stars?: number | undefined;
  forks?: number | undefined;
}

export interface SiteEvidence {
  submittedDomain: string;
  canonicalDomain: string;
  pages: SiteEvidencePage[];
  sitemapUrls: string[];
  github?: GitHubEvidence | undefined;
  collectedAt: string;
  rawJsonPath?: string | undefined;
}

export interface KeywordCandidate {
  id: string;
  phrase: string;
  normalized: string;
  language: string;
  source: KeywordSource;
  evidenceUrl?: string | undefined;
  evidenceText?: string | undefined;
  confidence: number;
  enabled: boolean;
  userDefined: boolean;
}

export interface KeywordCluster {
  id: string;
  label: string;
  primaryKeywordId: string;
  keywordIds: string[];
}

export interface KeywordRelevance {
  keywordId: string;
  score: number;
  evidenceCount: number;
  sourceBreakdown: Record<string, number>;
  evidence: Array<{
    source: KeywordSource;
    url?: string | undefined;
    text: string;
  }>;
}

export interface PromptRun {
  id: string;
  prompt: MonitoringPrompt;
  executionPrompt?: string | undefined;
  target: Entity;
  competitors: Entity[];
  providerId: string;
  model: string;
  webSearchEnabled: boolean;
  search?: SearchExecution | undefined;
  sourceType: SourceType;
  sourceLabel: string;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  result?: AnswerResult | undefined;
  rawJsonPath?: string | undefined;
  analysis?: PromptRunAnalysis | undefined;
  intentAnalysis?: IntentRunAnalysis | undefined;
  error?: string | undefined;
}

export interface AuditRun {
  id: string;
  auditPlanId?: string | undefined;
  promptSetId?: string | undefined;
  promptSetHash?: string | undefined;
  promptSetVersion?: string | undefined;
  analysisRulesVersion?: string | undefined;
  runCountPerPrompt?: number | undefined;
  submittedDomain?: string | undefined;
  target: Entity;
  competitors: Entity[];
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  domainProfile?: DomainProfile | undefined;
  discoveryEvidence?: DiscoveryEvidence | undefined;
  siteEvidence?: SiteEvidence | undefined;
  keywords?: KeywordCandidate[] | undefined;
  keywordClusters?: KeywordCluster[] | undefined;
  keywordRelevance?: KeywordRelevance[] | undefined;
  promptGeneration?: PromptGenerationEvidence | undefined;
  runs: PromptRun[];
  startedAt: string;
  finishedAt: string;
}

export interface AuditPlanEstimate {
  enabledPromptCount: number;
  disabledPromptCount: number;
  providerTargetCount: number;
  providerRunCount: number;
}

export interface AuditPlan {
  id: string;
  submittedDomain: string;
  target: Entity;
  competitors: Entity[];
  prompts: MonitoringPrompt[];
  providerTargets: ProviderTarget[];
  language: string;
  autoDiscover: boolean;
  keywordMode?: KeywordMode | undefined;
  promptSetId: string;
  promptSetHash: string;
  promptSetVersion: string;
  analysisRulesVersion: string;
  runCountPerPrompt: number;
  plannedAt: string;
  domainProfile?: DomainProfile | undefined;
  discoveryEvidence?: DiscoveryEvidence | undefined;
  siteEvidence?: SiteEvidence | undefined;
  keywords?: KeywordCandidate[] | undefined;
  keywordClusters?: KeywordCluster[] | undefined;
  keywordRelevance?: KeywordRelevance[] | undefined;
  promptGeneration?: PromptGenerationEvidence | undefined;
  estimate: AuditPlanEstimate;
}

export interface FractionMetric {
  value: number | null;
  numerator: number;
  denominator: number;
}

export interface CompetitorMetric {
  entityId: string;
  name: string;
  domain: string;
  mentionCount: number;
  mentionRate: FractionMetric;
  recommendationCount: number;
  citationCount: number;
  shareOfVoice: FractionMetric;
  averageRank: number | null;
  wins: number;
}

export interface CitationDomainGroup {
  domain: string;
  type: CitationType;
  citationCount: number;
  urlCount: number;
  promptCount: number;
  providerCount: number;
  urls: string[];
}

export interface PromptOutcome {
  promptId: string;
  promptType: PromptType;
  promptAuditCategory: PromptAuditCategory;
  providerId: string;
  model: string;
  sourceLabel: string;
  webSearchEnabled: boolean;
  search?: SearchExecution | undefined;
  status: "completed" | "failed";
  startedAt: string;
  finishedAt: string;
  targetMentioned: boolean;
  targetMentionCount: number;
  targetRank: number | null;
  mentionType: MentionType;
  sentiment: Sentiment;
  officialCitationCount: number;
  competitorMentions: string[];
  keywordIds: string[];
  keywordIntent?: KeywordIntent | undefined;
  winner: string | null;
  rawJsonPath: string | null;
  costUsd?: number | undefined;
}

export type MetricSliceType = "provider" | "model" | "provider_model" | "prompt_type" | "prompt_targeting";

export interface MetricSlice {
  sliceType: MetricSliceType;
  key: string;
  label: string;
  validResponses: number;
  failedResponses: number;
  mentionRate: FractionMetric;
  citationRate: FractionMetric;
  recommendationRate: FractionMetric;
  firstPositionRate: FractionMetric;
  shareOfVoice: FractionMetric;
  averageRank: number | null;
  targetMentionOccurrences: number;
  allEntityMentionOccurrences: number;
}

export type GapArea = "provider" | "prompt" | "keyword" | "citation" | "competitor" | "source" | "position";
export type GapSeverity = "critical" | "warning" | "info";

export interface GapFinding {
  area: GapArea;
  severity: GapSeverity;
  title: string;
  evidence: string;
  recommendation: string;
}

export interface GeoGapAnalysis {
  summary: string;
  findings: GapFinding[];
}

export interface AuditMetrics {
  validResponses: number;
  failedResponses: number;
  brandAwarenessRate: FractionMetric;
  naturalDiscoveryRate: FractionMetric;
  organicRecommendationRate: FractionMetric;
  officialCitationRate: FractionMetric;
  comparison: ComparisonMetric;
  promptCategoryMetrics: PromptCategoryMetric[];
  mentionCount: number;
  mentionRate: FractionMetric;
  recommendationRate: FractionMetric;
  firstPositionRate: FractionMetric;
  citationCount: number;
  citationRate: FractionMetric;
  shareOfVoice: FractionMetric;
  averageRank: number | null;
  targetMentionOccurrences: number;
  allEntityMentionOccurrences: number;
  mentionedWithoutOfficialCitation: number;
  citedWithoutProseMention: number;
  competitors: CompetitorMetric[];
  promptOutcomes: PromptOutcome[];
  keywordSummary: KeywordMetricSummary;
  keywordMetrics: KeywordMetric[];
  citationDomains: CitationDomainGroup[];
  slices: MetricSlice[];
}

export interface PromptCategoryMetric {
  category: PromptAuditCategory;
  label: string;
  validResponses: number;
  failedResponses: number;
  mentionRate: FractionMetric;
  citationRate: FractionMetric;
  recommendationRate: FractionMetric;
  firstPositionRate: FractionMetric;
  shareOfVoice: FractionMetric;
  suspectedIncorrectCount: number;
}

export interface ComparisonMetric {
  validResponses: number;
  failedResponses: number;
  targetMentionCount: number;
  recommendationCount: number;
  firstPositionCount: number;
  officialCitationCount: number;
  shareOfVoice: FractionMetric;
}

export interface KeywordMetricSummary {
  totalKeywords: number;
  userDefinedKeywords: number;
  discoveredKeywords: number;
  averageOwnedRelevance: number | null;
  aiMentionRate: FractionMetric;
  competitorOnlyRate: FractionMetric;
}

export interface KeywordMetric {
  keywordId: string;
  phrase: string;
  source: KeywordSource;
  userDefined: boolean;
  ownedRelevance: number;
  validResponses: number;
  failedResponses: number;
  promptCount: number;
  mentionRate: FractionMetric;
  citationRate: FractionMetric;
  recommendationRate: FractionMetric;
  firstPositionRate: FractionMetric;
  shareOfVoice: FractionMetric;
  competitorOnlyRate: FractionMetric;
  averageRank: number | null;
  topCompetitors: CompetitorMetric[];
  gapLabel: string;
}

export interface ReportBundle {
  runDir: string;
  auditJson: string;
  reportJson: string;
  reportMd: string;
  reportHtml: string;
  promptCsv: string;
  citationCsv: string;
  keywordCsv: string;
}
