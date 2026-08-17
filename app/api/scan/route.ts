import { NextResponse } from "next/server";
import { liveCollectorsReady } from "@/lib/brightdata";
import { discoverEnabled } from "@/lib/discover";
import { geminiConfigured, geminiModel } from "@/lib/gemini";
import { ScanRequestSchema } from "@/lib/schema";
import { runScan } from "@/lib/scan";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ScanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const snapshot = await runScan(parsed.data);
  return NextResponse.json(snapshot);
}

export async function GET() {
  return NextResponse.json({
    brightDataToken: Boolean(process.env.BRIGHT_DATA_API_TOKEN?.trim()),
    discover: discoverEnabled(),
    gemini: geminiConfigured(),
    geminiModel: geminiModel(),
    live: {
      ecommerce: liveCollectorsReady("ecommerce"),
      edtech: liveCollectorsReady("edtech"),
      food: liveCollectorsReady("food"),
    },
  });
}
