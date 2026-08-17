import { NextResponse } from "next/server";
import { z } from "zod";
import {
  HEAL_BODY_LIMIT,
  MAX_HEAL_PROMPT,
  authorize,
  clientKey,
  enforceOrigin,
  limited,
  readJsonBody,
  withRateHeaders,
} from "@/lib/guard";
import { breakSnapshot, healSnapshot } from "@/lib/mock";
import { healLimiter } from "@/lib/rate-limit";
import { SnapshotSchema } from "@/lib/schema";
import {
  healAnchorUrl,
  isStudioCollectorId,
  resolveStudioCollector,
  runStudioCli,
} from "@/lib/studio";
import { assertPublicHttpsUrl } from "@/lib/urls";

export const maxDuration = 300;

const HealRequestSchema = z.object({
  action: z.enum(["break", "heal", "approve"]),
  snapshot: SnapshotSchema,
  prompt: z.string().max(MAX_HEAL_PROMPT).optional(),
});

const DEFAULT_HEAL_PROMPT =
  "The price and rating fields return null since the site redesign. Re-capture them from the public page. Keep the same collector.";

export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = healLimiter.check(clientKey(request));
  const limitedResponse = limited(
    quota,
    "Heal rate limit reached. Wait before triggering another collector repair.",
  );
  if (limitedResponse) return limitedResponse;

  const body = await readJsonBody(request, HEAL_BODY_LIMIT);
  if (body instanceof NextResponse) return body;

  const parsed = HealRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const studioId = resolveStudioCollector(parsed.data.snapshot);
  if (studioId && !isStudioCollectorId(studioId)) {
    return NextResponse.json({ error: "Invalid collector id" }, { status: 400 });
  }
  const collectorId =
    studioId ?? parsed.data.snapshot.health.collector_ids[0] ?? "c_mock_brandradar";

  let url: string;
  try {
    url = assertPublicHttpsUrl(healAnchorUrl(parsed.data.snapshot), "heal url");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid heal url" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "break") {
    const snapshot = breakSnapshot(parsed.data.snapshot);
    return withRateHeaders(
      NextResponse.json({
        status: "broken",
        collector_id: collectorId,
        snapshot,
        next_step: "heal",
      }),
      quota,
    );
  }

  if (parsed.data.action === "heal") {
    const prompt =
      parsed.data.prompt ||
      parsed.data.snapshot.health.heal_hint ||
      DEFAULT_HEAL_PROMPT;
    let studioNote: string | undefined;
    let preview: unknown = healSnapshot(parsed.data.snapshot).items[0] ?? null;

    if (studioId) {
      const result = await runStudioCli("heal", [studioId, url, prompt]);
      studioNote = result.ok
        ? "Scraper Studio heal ran on the same collector id."
        : `Studio heal did not finish (${result.output.slice(0, 280) || "timeout"}). UI preview still restored locally.`;
      if (result.output.trim()) {
        preview = { studio: result.ok, output: result.output };
      }
    }

    return withRateHeaders(
      NextResponse.json({
        status: "awaiting_approval",
        collector_id: collectorId,
        prompt,
        preview_result: preview,
        snapshot: parsed.data.snapshot,
        note: studioNote,
        next_step: "approve",
      }),
      quota,
    );
  }

  let note =
    "Collector ID unchanged. Downstream BrandRadar still points at the same c_*.";
  if (studioId) {
    const result = await runStudioCli("approve", [studioId, url]);
    note = result.ok
      ? "Scraper Studio approved. Same collector id. Data continues."
      : `Studio approve skipped (${result.output.slice(0, 280) || "timeout"}). Local rows still restored. Collector id unchanged.`;
  }

  const snapshot = healSnapshot(parsed.data.snapshot);
  return withRateHeaders(
    NextResponse.json({
      status: "done",
      collector_id: collectorId,
      snapshot,
      note,
    }),
    quota,
  );
}
