import { NextResponse } from "next/server";
import { geminiConfigured } from "@/lib/gemini";
import { ScanRequestSchema } from "@/lib/schema";
import { runScan } from "@/lib/scan";
import { liveCollectorsReady } from "@/lib/brightdata";

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
    mockForced: process.env.USE_MOCK === "true",
    brightDataToken: Boolean(process.env.BRIGHT_DATA_API_TOKEN?.trim()),
    gemini: geminiConfigured(),
    live: {
      ecommerce: liveCollectorsReady("ecommerce"),
      edtech: liveCollectorsReady("edtech"),
      food: liveCollectorsReady("food"),
    },
  });
}
