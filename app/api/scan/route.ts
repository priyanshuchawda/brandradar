import { NextResponse } from "next/server";
import { liveCollectorsReady } from "@/lib/brightdata";
import { discoverEnabled } from "@/lib/discover";
import { geminiConfigured, geminiFlashModel, geminiLiteModel } from "@/lib/gemini";
import {
  SCAN_BODY_LIMIT,
  authorize,
  clientKey,
  demoFixtureAllowed,
  enforceOrigin,
  limited,
  readJsonBody,
  withRateHeaders,
} from "@/lib/guard";
import { scanLimiter, statusLimiter } from "@/lib/rate-limit";
import { ScanRequestSchema } from "@/lib/schema";
import { runScan } from "@/lib/scan";
import { assertPublicHttpsUrl, assertPublicHttpsUrls } from "@/lib/urls";

export const maxDuration = 300;

export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = scanLimiter.check(clientKey(request));
  const limitedResponse = limited(
    quota,
    "Scan rate limit reached. Wait a few minutes before running another live collection.",
  );
  if (limitedResponse) return limitedResponse;

  const body = await readJsonBody(request, SCAN_BODY_LIMIT);
  if (body instanceof NextResponse) return body;

  const parsed = ScanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const brandUrl = assertPublicHttpsUrl(parsed.data.brandUrl, "brandUrl");
    const rivalUrls = assertPublicHttpsUrls(parsed.data.rivalUrls, "rivalUrls");
    if (parsed.data.forceMock && !demoFixtureAllowed()) {
      return NextResponse.json(
        { error: "Demo fixtures are disabled in this environment" },
        { status: 403 },
      );
    }
    const snapshot = await runScan({ ...parsed.data, brandUrl, rivalUrls });
    return withRateHeaders(NextResponse.json(snapshot), quota);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed" },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const quota = statusLimiter.check(clientKey(request));
  const limitedResponse = limited(quota, "Status rate limit reached");
  if (limitedResponse) return limitedResponse;

  return withRateHeaders(
    NextResponse.json({
      brightDataToken: Boolean(process.env.BRIGHT_DATA_API_TOKEN?.trim()),
      discover: discoverEnabled(),
      gemini: geminiConfigured(),
      geminiModel: geminiLiteModel(),
      geminiFlashModel: geminiFlashModel(),
      live: {
        ecommerce: liveCollectorsReady("ecommerce"),
        edtech: liveCollectorsReady("edtech"),
        food: liveCollectorsReady("food"),
      },
      demoFixture: demoFixtureAllowed(),
    }),
    quota,
  );
}
