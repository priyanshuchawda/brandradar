import { NextResponse } from "next/server";
import {
  SCAN_BODY_LIMIT,
  authorize,
  clientKey,
  enforceOrigin,
  limited,
  readJsonBody,
  withRateHeaders,
} from "@/lib/guard";
import { runIntelPull } from "@/lib/intel-pull";
import { loadCohortConfig } from "@/lib/rivals";
import { intelCollectorsReady, intelUpdatesCollectorId } from "@/lib/brightdata";
import { scanLimiter, statusLimiter } from "@/lib/rate-limit";
import { z } from "zod";

export const maxDuration = 300;

const PullBodySchema = z.object({
  forceMock: z.boolean().optional(),
  persist: z.boolean().optional(),
});

export async function GET(request: Request) {
  const quota = statusLimiter.check(clientKey(request));
  const limitedResponse = limited(quota, "Status rate limit reached");
  if (limitedResponse) return limitedResponse;

  const config = loadCohortConfig();
  return withRateHeaders(
    NextResponse.json({
      cohort: config.cohort,
      label: config.label,
      rivals: config.rivals.map((r) => ({
        id: r.id,
        name: r.name,
        update_url: r.update_url,
        surface: r.surface,
      })),
      intelCollector: intelUpdatesCollectorId() ?? null,
      intelReady: intelCollectorsReady(),
    }),
    quota,
  );
}

export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = scanLimiter.check(clientKey(request));
  const limitedResponse = limited(
    quota,
    "Intel pull rate limit reached. Wait before another cohort scrape.",
  );
  if (limitedResponse) return limitedResponse;

  const body = await readJsonBody(request, SCAN_BODY_LIMIT);
  if (body instanceof NextResponse) return body;
  const parsed = PullBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const snapshot = await runIntelPull({
      forceMock: parsed.data.forceMock,
      persist: parsed.data.persist,
    });
    return withRateHeaders(NextResponse.json(snapshot), quota);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intel pull failed" },
      { status: 400 },
    );
  }
}
