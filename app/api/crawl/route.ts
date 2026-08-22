import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CrawlBudgetSchema,
  CrawlGoalSchema,
  CrawlGoalTypeSchema,
} from "@/lib/smart-crawl/crawl-schema";
import { runSmartCrawl } from "@/lib/smart-crawl/crawl-orchestrator";
import {
  listCrawlSessions,
  loadCrawlSession,
  loadLatestCrawlSession,
} from "@/lib/smart-crawl/crawl-storage";
import { publishCrawlToDiscord } from "@/lib/smart-crawl/discord-publisher";

export const maxDuration = 300;

const StartCrawlRequestSchema = z.object({
  competitor: z.string().min(1),
  startUrl: z.string().url(),
  goal: z.string().min(5),
  goalType: CrawlGoalTypeSchema.optional(),
  domain: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  priorityEntities: z.array(z.string()).optional(),
  budget: CrawlBudgetSchema.partial().optional(),
  publishDiscord: z.boolean().optional(),
  forceMock: z.boolean().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const competitor = searchParams.get("competitor");
  const sessionId = searchParams.get("sessionId");

  if (!competitor) {
    return NextResponse.json(
      { error: "Query parameter 'competitor' is required" },
      { status: 400 },
    );
  }

  if (sessionId) {
    const session = await loadCrawlSession(competitor, sessionId);
    if (!session) {
      return NextResponse.json({ error: "Crawl session not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  const sessionIds = await listCrawlSessions(competitor);
  const latest = await loadLatestCrawlSession(competitor);

  return NextResponse.json({
    competitor,
    sessionCount: sessionIds.length,
    sessions: sessionIds,
    latestSession: latest,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = StartCrawlRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid crawl request", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { data } = parsed;
    const domain = data.domain || new URL(data.startUrl).hostname;
    const allowedDomains = data.allowedDomains || [domain];

    const goal = CrawlGoalSchema.parse({
      competitor: data.competitor,
      goal: data.goal,
      domain,
      allowedDomains,
      goalType: data.goalType || "competitor_product_intelligence",
      keywords: data.keywords || [],
      priorityEntities: data.priorityEntities || [],
    });

    const session = await runSmartCrawl({
      goal,
      startUrl: data.startUrl,
      budget: data.budget,
      forceMock: data.forceMock,
    });

    if (data.publishDiscord) {
      try {
        const discRes = await publishCrawlToDiscord(session);
        session.discordEventPublished = discRes.ok;
      } catch {
        // Continue even if Discord notification fails
      }
    }

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to execute smart crawl" },
      { status: 500 },
    );
  }
}
