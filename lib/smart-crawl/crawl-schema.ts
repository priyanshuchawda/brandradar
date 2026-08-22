import { z } from "zod";

// ─── Goal & Budget Schemas ───────────────────────────────────────────────────

export const CrawlGoalTypeSchema = z.enum([
  "competitor_product_intelligence",
  "competitor_feature_intelligence",
  "competitor_pricing",
  "competitor_promotions",
  "competitor_content",
  "competitor_market_research",
  "custom",
]);
export type CrawlGoalType = z.infer<typeof CrawlGoalTypeSchema>;

export const CrawlGoalSchema = z.object({
  goal: z.string().min(5),
  competitor: z.string().min(1),
  domain: z.string().min(1),
  allowedDomains: z.array(z.string()).default([]),
  goalType: CrawlGoalTypeSchema.default("competitor_product_intelligence"),
  priorityEntities: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
});
export type CrawlGoal = z.infer<typeof CrawlGoalSchema>;

export const CrawlBudgetSchema = z.object({
  maxDepth: z.number().int().min(1).max(10).default(3),
  maxPages: z.number().int().min(1).max(100).default(25),
  maxGeminiCalls: z.number().int().min(1).max(50).default(20),
  maxLinksPerDecision: z.number().int().min(1).max(15).default(5),
  maxRuntimeMs: z.number().int().min(5000).default(180_000),
});
export type CrawlBudget = z.infer<typeof CrawlBudgetSchema>;

// ─── Discovered Hyperlink Schema ──────────────────────────────────────────────

export const DiscoveredLinkSchema = z.object({
  linkId: z.string(),
  href: z.string(),
  normalizedUrl: z.string().url(),
  anchorText: z.string().default(""),
  surroundingText: z.string().default(""),
  rel: z.string().optional(),
  isInternal: z.boolean().default(true),
  inferredTargetType: z.string().optional(),
});
export type DiscoveredLink = z.infer<typeof DiscoveredLinkSchema>;

// ─── Scraped Page Model ───────────────────────────────────────────────────────

export const PageTypeSchema = z.enum([
  "homepage",
  "category",
  "product",
  "pricing",
  "promotion",
  "feature",
  "documentation",
  "blog",
  "changelog",
  "about",
  "support",
  "unknown",
]);
export type PageType = z.infer<typeof PageTypeSchema>;

export const PageEntitiesSchema = z.object({
  products: z.array(z.record(z.string(), z.unknown())).default([]),
  prices: z.array(z.record(z.string(), z.unknown())).default([]),
  promotions: z.array(z.record(z.string(), z.unknown())).default([]),
  features: z.array(z.record(z.string(), z.unknown())).default([]),
  categories: z.array(z.string()).default([]),
  other: z.array(z.record(z.string(), z.unknown())).default([]),
});
export type PageEntities = z.infer<typeof PageEntitiesSchema>;

export const ScrapedPageSchema = z.object({
  pageId: z.string(),
  url: z.string().url(),
  canonicalUrl: z.string().url().optional(),
  title: z.string().default(""),
  description: z.string().default(""),
  pageType: PageTypeSchema.default("unknown"),
  headings: z.array(z.string()).default([]),
  contentSummary: z.string().default(""),
  entities: PageEntitiesSchema.default({
    products: [],
    prices: [],
    promotions: [],
    features: [],
    categories: [],
    other: [],
  }),
  links: z.array(DiscoveredLinkSchema).default([]),
  source: z.object({
    collectorId: z.string(),
    runId: z.string(),
    scrapedAt: z.string(),
  }),
  extractionQuality: z.number().min(0).max(100).default(100),
  status: z.enum(["verified", "unverified"]).default("verified"),
});
export type ScrapedPage = z.infer<typeof ScrapedPageSchema>;

// ─── Gemini Crawl Decision Schemas ────────────────────────────────────────────

export const SelectedLinkDecisionSchema = z.object({
  linkId: z.string(),
  url: z.string(),
  priority: z.number().min(0).max(1),
  reasonCode: z.string(),
  reason: z.string(),
});
export type SelectedLinkDecision = z.infer<typeof SelectedLinkDecisionSchema>;

export const SkippedLinkDecisionSchema = z.object({
  linkId: z.string(),
  reasonCode: z.string(),
  reason: z.string(),
});
export type SkippedLinkDecision = z.infer<typeof SkippedLinkDecisionSchema>;

export const CrawlDecisionActionSchema = z.enum(["FOLLOW", "SKIP", "STOP"]);
export type CrawlDecisionAction = z.infer<typeof CrawlDecisionActionSchema>;

export const CrawlDecisionSchema = z.object({
  decision: CrawlDecisionActionSchema,
  reasonCode: z.string(),
  selectedLinks: z.array(SelectedLinkDecisionSchema).default([]),
  skipLinks: z.array(SkippedLinkDecisionSchema).default([]),
  nextDepth: z.number().int().default(1),
  shouldContinue: z.boolean(),
  coverage: z
    .object({
      products: z.boolean().default(false),
      pricing: z.boolean().default(false),
      promotions: z.boolean().default(false),
      features: z.boolean().default(false),
      content: z.boolean().default(false),
    })
    .optional(),
});
export type CrawlDecision = z.infer<typeof CrawlDecisionSchema>;

// ─── Provenance Fact Schema ───────────────────────────────────────────────────

export const ProvenanceFactSchema = z.object({
  factId: z.string(),
  fact: z.string(),
  sourcePageId: z.string(),
  url: z.string().url(),
  collectorId: z.string(),
  runId: z.string(),
  observedAt: z.string(),
  category: z.string().optional(),
});
export type ProvenanceFact = z.infer<typeof ProvenanceFactSchema>;

// ─── Final Analysis Schemas ───────────────────────────────────────────────────

export const ObservedChangeItemSchema = z.object({
  type: z.string(), // e.g. "PRODUCT_EXPANSION", "PRICING_SHIFT", "PROMOTION_ADDED", "NEW_FEATURE"
  title: z.string(),
  description: z.string(),
  evidenceIds: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
});
export type ObservedChangeItem = z.infer<typeof ObservedChangeItemSchema>;

export const StrategicDirectionSchema = z.object({
  area: z.string(),
  direction: z.enum(["increasing", "decreasing", "stable", "pivoting", "launching"]),
  summary: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});
export type StrategicDirection = z.infer<typeof StrategicDirectionSchema>;

export const CompetitorOpportunitySchema = z.object({
  type: z.enum(["FILL", "DIFFERENTIATE", "MATCH", "COUNTER"]),
  title: z.string(),
  description: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});
export type CompetitorOpportunity = z.infer<typeof CompetitorOpportunitySchema>;

export const WatchItemSchema = z.object({
  item: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  rationale: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});
export type WatchItem = z.infer<typeof WatchItemSchema>;

export const FinalAnalysisSchema = z.object({
  summary: z.string().min(10),
  observedChanges: z.array(ObservedChangeItemSchema).default([]),
  directions: z.array(StrategicDirectionSchema).default([]),
  opportunities: z.array(CompetitorOpportunitySchema).default([]),
  watchItems: z.array(WatchItemSchema).default([]),
  provenanceFacts: z.array(ProvenanceFactSchema).default([]),
  pageCoverage: z.record(z.string(), z.number()).default({}),
  analyzedAt: z.string(),
});
export type FinalAnalysis = z.infer<typeof FinalAnalysisSchema>;

// ─── Crawl Session Schema ─────────────────────────────────────────────────────

export const CrawlQueueItemSchema = z.object({
  url: z.string().url(),
  linkId: z.string(),
  sourcePageId: z.string(),
  depth: z.number().int().min(0),
  priority: z.number().min(0).max(1),
  status: z.enum(["queued", "running", "completed", "skipped", "failed"]),
  reason: z.string().optional(),
});
export type CrawlQueueItem = z.infer<typeof CrawlQueueItemSchema>;

export const CrawlGraphEdgeSchema = z.object({
  sourcePageId: z.string(),
  targetPageId: z.string().optional(),
  linkId: z.string(),
  targetUrl: z.string().url(),
  decision: z.enum(["FOLLOW", "SKIP"]),
  reason: z.string().optional(),
});
export type CrawlGraphEdge = z.infer<typeof CrawlGraphEdgeSchema>;

export const CrawlSessionSchema = z.object({
  sessionId: z.string(),
  goal: CrawlGoalSchema,
  budget: CrawlBudgetSchema,
  status: z.enum(["running", "completed", "stopped", "failed"]),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  pagesCollected: z.number().int().default(0),
  geminiCallsCount: z.number().int().default(0),
  stopReason: z.string().optional(),
  pages: z.array(ScrapedPageSchema).default([]),
  decisions: z.array(CrawlDecisionSchema).default([]),
  graphEdges: z.array(CrawlGraphEdgeSchema).default([]),
  finalAnalysis: FinalAnalysisSchema.optional(),
  discordEventPublished: z.boolean().default(false),
});
export type CrawlSession = z.infer<typeof CrawlSessionSchema>;
