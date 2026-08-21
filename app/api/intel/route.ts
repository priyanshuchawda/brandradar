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
import { loadCohortConfig, isoWeekKey } from "@/lib/rivals";
import { loadIntelSnapshot } from "@/lib/intel-store";
import { intelCollectorsReady, intelUpdatesCollectorId } from "@/lib/brightdata";
import { scanLimiter, statusLimiter } from "@/lib/rate-limit";
import { z } from "zod";

export const maxDuration = 300;

const PullBodySchema = z.object({
  forceMock: z.boolean().optional(),
  persist: z.boolean().optional(),
  /** Re-trigger Studio even if this ISO week is cached. Costs Bright Data credits. */
  refresh: z.boolean().optional(),
});

export async function GET(request: Request) {
  const quota = statusLimiter.check(clientKey(request));
  const limitedResponse = limited(quota, "Status rate limit reached");
  if (limitedResponse) return limitedResponse;

  const config = loadCohortConfig();
  const week = isoWeekKey();
  const cached = await loadIntelSnapshot(week);
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
      week,
      weekCached: Boolean(cached && cached.mode === "live"),
      costHint:
        "Default pull reuses this week's live snapshot. Pass refresh=true to spend Studio credits again.",
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
      refresh: parsed.data.refresh,
    });
    return withRateHeaders(NextResponse.json(snapshot), quota);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Intel pull failed" },
      { status: 400 },
    );
  }
}
