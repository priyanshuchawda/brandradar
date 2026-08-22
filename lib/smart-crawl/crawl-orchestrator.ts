/**
 * Smart Sublink Crawl Orchestrator.
 *
 * Coordinates the full loop:
 * Bright Data Scrape -> Extraction QA -> Link Normalization -> Gemini Decision -> Frontier Queue -> Final Analysis -> Storage -> Discord.
 */

import {
  intelUpdatesCollectorId,
  triggerWithUrl,
} from "../brightdata";
import { expandStudioRows } from "../intel-pull";
import { assessListingExtract } from "../extract-qa";
import {
  CrawlBudgetSchema,
  CrawlGoalSchema,
  type CrawlBudget,
  type CrawlGoal,
  type CrawlSession,
  type ScrapedPage,
} from "./crawl-schema";
import { CrawlFrontier } from "./crawl-frontier";
import { decideSublinksWithGemini } from "./gemini-crawl-decider";
import { runFinalStructuredAnalysis } from "./final-analysis";
import { extractDiscoveredLinks } from "./link-extractor";
import { inferPageTypeFromUrl, normalizeUrl } from "./link-normalizer";
import { saveCrawlSession } from "./crawl-storage";

export function generateSessionId(): string {
  const dateStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `crawl_${dateStr}_${rand}`;
}

export function mockScrapeForUrl(url: string, competitor: string): Array<Record<string, unknown>> {
  const norm = normalizeUrl(url) || url;
  const path = new URL(norm).pathname.toLowerCase();

  if (path === "" || path === "/") {
    return [
      {
        title: `${competitor} Official Store — New Releases & Collections`,
        summary: `Explore ${competitor}'s latest sports apparel, running shoes, and seasonal promotions.`,
        links: [
          { url: `${norm}/running`, text: "Running Shoes & Gear" },
          { url: `${norm}/sale`, text: "Seasonal Sale & Promotions" },
          { url: `${norm}/new-arrivals`, text: "New Season Arrivals" },
          { url: `${norm}/about`, text: "About Us" },
          { url: `${norm}/privacy`, text: "Privacy Policy" },
        ],
      },
    ];
  }

  if (path.includes("running")) {
    return [
      {
        title: `${competitor} Ultralight Pro Running Shoe`,
        product_name: `${competitor} Ultralight Pro`,
        price: 180,
        category: "Running",
        summary: "High-performance marathon shoe with energy return foam.",
        url: `${norm}/ultralight-pro`,
      },
      {
        title: `${competitor} Daily Runner v3`,
        product_name: `${competitor} Daily Runner v3`,
        price: 140,
        category: "Running",
        summary: "Cushioned daily training sneaker for road running.",
        url: `${norm}/daily-runner-v3`,
      },
      {
        title: `${competitor} Marathon Racing Gear Collection`,
        url: `${norm}/marathon-gear`,
      },
    ];
  }

  if (path.includes("sale") || path.includes("promo")) {
    return [
      {
        title: `Summer Flash Sale: Up to 40% Off`,
        banner: "Get 40% off selected summer performance gear this week only.",
        discount: "40%",
        url: `${norm}/flash-deals`,
      },
      {
        title: "Member Exclusive 20% Discount",
        banner: "Sign in to unlock an extra 20% at checkout.",
        discount: "20%",
        url: `${norm}/member-deals`,
      },
    ];
  }

  if (path.includes("new-arrivals")) {
    return [
      {
        title: `${competitor} Autumn/Winter Performance Lineup`,
        summary: "Newly released thermal tights, weather-resistant jackets, and shoes.",
        product_name: "Thermal Windbreaker Pro",
        price: 210,
        url: `${norm}/thermal-windbreaker`,
      },
    ];
  }

  return [
    {
      title: `${competitor} Observed Page: ${path}`,
      summary: `Standard catalog surface on ${competitor} domain.`,
      url: norm,
    },
  ];
}

export async function runSmartCrawl(input: {
  goal: CrawlGoal;
  startUrl: string;
  budget?: Partial<CrawlBudget>;
  forceMock?: boolean;
  onProgress?: (event: { stage: string; url?: string; pagesCount: number }) => void;
}): Promise<CrawlSession> {
  const goal = CrawlGoalSchema.parse(input.goal);
  const budget = CrawlBudgetSchema.parse(input.budget ?? {});
  const forceMock = input.forceMock ?? (process.env.USE_MOCK !== "false");

  const sessionId = generateSessionId();
  const frontier = new CrawlFrontier(budget);

  if (!frontier.enqueueStartUrl(input.startUrl)) {
    throw new Error(`Invalid start URL: ${input.startUrl}`);
  }

  const session: CrawlSession = {
    sessionId,
    goal,
    budget,
    status: "running",
    startedAt: new Date().toISOString(),
    pagesCollected: 0,
    geminiCallsCount: 0,
    pages: [],
    decisions: [],
    graphEdges: [],
    discordEventPublished: false,
  };

  input.onProgress?.({ stage: "START", url: input.startUrl, pagesCount: 0 });

  const collectorId = intelUpdatesCollectorId() || "c_smart_sublink_default";

  while (frontier.hasNext()) {
    const queueItem = frontier.dequeue();
    if (!queueItem) break;

    input.onProgress?.({ stage: "SCRAPING", url: queueItem.url, pagesCount: session.pages.length });

    let rawRows: Array<Record<string, unknown>> = [];
    let extractionQuality = 100;
    let pageStatus: "verified" | "unverified" = "verified";

    // 1. Scrape Page via Bright Data (or mock in test mode)
    if (!forceMock && process.env.BRIGHT_DATA_API_TOKEN) {
      try {
        const fetched = await triggerWithUrl(collectorId, queueItem.url);
        const rawList = Array.isArray(fetched) ? (fetched as Array<Record<string, unknown>>) : [];
        rawRows = expandStudioRows(rawList);
        if (rawRows.length === 0 && rawList.length > 0) rawRows = rawList;

        const listingRows = rawRows.map((r) => ({
          title: String(r.title || r.name || r.heading || "Untitled"),
          url: String(r.url || r.link || r.permalink || queueItem.url),
          published_at: typeof r.published_at === "string" ? r.published_at : undefined,
          summary: typeof r.summary === "string" ? r.summary : undefined,
        }));
        const qa = assessListingExtract(listingRows, { minRows: 1 });
        extractionQuality = Math.max(0, 100 - qa.null_rate * 100);
        if (qa.status === "empty") pageStatus = "unverified";
      } catch {
        pageStatus = "unverified";
        rawRows = mockScrapeForUrl(queueItem.url, goal.competitor);
      }
    } else {
      rawRows = mockScrapeForUrl(queueItem.url, goal.competitor);
    }

    // 2. Build Structured Page Model
    const pageId = `page_${session.pages.length + 1}`;
    const pageType = inferPageTypeFromUrl(queueItem.url) as ScrapedPage["pageType"];

    const firstRow = rawRows[0] || {};
    const title = String(firstRow.title || firstRow.name || firstRow.heading || queueItem.url);
    const description = String(firstRow.summary || firstRow.description || "");

    const products: Array<Record<string, unknown>> = [];
    const promotions: Array<Record<string, unknown>> = [];
    const features: Array<Record<string, unknown>> = [];

    for (const r of rawRows) {
      if (r.price || r.product_name) products.push(r);
      if (r.discount || r.banner) promotions.push(r);
      if (r.feature) features.push(r);
    }

    // 3. Extract and Normalize Hyperlinks
    const discoveredLinks = extractDiscoveredLinks({
      baseUrl: queueItem.url,
      allowedDomains: goal.allowedDomains.length > 0 ? goal.allowedDomains : [goal.domain],
      rawRows,
    });

    const scrapedPage: ScrapedPage = {
      pageId,
      url: queueItem.url,
      title,
      description,
      pageType,
      headings: [title],
      contentSummary: description,
      entities: {
        products,
        prices: products.filter((p) => p.price != null),
        promotions,
        features,
        categories: [pageType],
        other: [],
      },
      links: discoveredLinks,
      source: {
        collectorId,
        runId: `run_${sessionId}_${pageId}`,
        scrapedAt: new Date().toISOString(),
      },
      extractionQuality,
      status: pageStatus,
    };

    session.pages.push(scrapedPage);
    frontier.markCompleted();
    session.pagesCollected = session.pages.length;

    // 4. Gemini Smart Sublink Decision
    input.onProgress?.({ stage: "DECIDING", url: queueItem.url, pagesCount: session.pages.length });

    const decision = await decideSublinksWithGemini({
      goal,
      currentPage: scrapedPage,
      discoveredLinks,
      visitedUrls: frontier.getVisitedUrls(),
      budget,
      budgetStatus: frontier.getBudgetStatus(),
      forceMock,
    });

    frontier.markGeminiCall();
    session.geminiCallsCount = frontier.getGeminiCallsCount();
    session.decisions.push(decision);

    // 5. Update Frontier Queue
    frontier.enqueueSelected({
      sourcePageId: pageId,
      currentDepth: queueItem.depth,
      selected: decision.selectedLinks,
    });

    frontier.recordSkipped({
      sourcePageId: pageId,
      skipped: decision.skipLinks,
      discoveredLinks,
    });

    // 6. Check for Smart Stopping
    if (decision.decision === "STOP" || !decision.shouldContinue) {
      session.stopReason = decision.reasonCode;
      break;
    }
  }

  // 7. Final Structured Analysis
  input.onProgress?.({ stage: "ANALYZING", pagesCount: session.pages.length });

  const finalAnalysis = await runFinalStructuredAnalysis({
    goal,
    pages: session.pages,
    forceMock,
  });

  session.finalAnalysis = finalAnalysis;
  session.graphEdges = frontier.getGraphEdges();
  session.finishedAt = new Date().toISOString();
  session.status = "completed";

  // 8. Persist Session
  await saveCrawlSession(session);

  input.onProgress?.({ stage: "COMPLETED", pagesCount: session.pages.length });

  return session;
}
