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
import { healLimiter } from "@/lib/rate-limit";
import { IntelSnapshotSchema } from "@/lib/intel-schema";
import { isStudioCollectorId, runStudioCli } from "@/lib/studio";
import { loadCohortConfig } from "@/lib/rivals";
import { assertPublicHttpsUrl } from "@/lib/urls";
import { intelUpdatesCollectorId } from "@/lib/brightdata";
import { runIntelAutoHeal, healStatusDiscordEmbed } from "@/lib/intel-auto-heal";
import { postEmbedBrief } from "@/lib/discord-api";
import { discordConfigured, discordMode } from "@/lib/discord";
import { healRuntimeBudget } from "@/lib/runtime-env";

export const maxDuration = 300;

const BodySchema = z.object({
  action: z.enum(["heal", "approve", "auto_loop"]),
  snapshot: IntelSnapshotSchema.optional(),
  prompt: z.string().max(MAX_HEAL_PROMPT).optional(),
  useGemini: z.boolean().optional(),
  notifyDiscord: z.boolean().optional(),
  forceMock: z.boolean().optional(),
  maxHealAttempts: z.number().int().min(1).max(2).optional(),
});

const DEFAULT_PROMPT =
  "Update listing extract for public blog/guides rows: title, absolute url, published_at if shown, short summary. Keep the same collector id. Listing pages only — do not open PDPs.";

export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = healLimiter.check(clientKey(request));
  const limitedResponse = limited(
    quota,
    "Intel heal rate limit reached. Wait before another repair.",
  );
  if (limitedResponse) return limitedResponse;

  const body = await readJsonBody(request, HEAL_BODY_LIMIT);
  if (body instanceof NextResponse) return body;
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const collectorId =
    parsed.data.snapshot?.health.collector_ids.find(isStudioCollectorId) ||
    intelUpdatesCollectorId();
  if (!collectorId || !isStudioCollectorId(collectorId)) {
    return NextResponse.json(
      { error: "No live COLLECTOR_INTEL_UPDATES id to heal" },
      { status: 503 },
    );
  }

  const config = loadCohortConfig();
  const anchor =
    parsed.data.snapshot?.rivals.find((r) => r.update_url)?.update_url ||
    config.rivals[0]?.update_url;
  if (!anchor) {
    return NextResponse.json({ error: "No update_url for heal anchor" }, { status: 400 });
  }
  let url: string;
  try {
    url = assertPublicHttpsUrl(anchor, "heal url");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid heal url" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "auto_loop") {
    const forceMock = parsed.data.forceMock === true;
    const loop = await runIntelAutoHeal({
      snapshot: parsed.data.snapshot,
      forceMock,
      userPrompt: parsed.data.prompt,
      useGemini: parsed.data.useGemini === true,
      budget: parsed.data.maxHealAttempts
        ? { maxHealAttempts: parsed.data.maxHealAttempts }
        : undefined,
    });

    let discord: unknown = null;
    if (
      parsed.data.notifyDiscord !== false &&
      discordConfigured() &&
      discordMode() === "bot"
    ) {
      const channelId = process.env.DISCORD_CHANNEL_ID!.trim();
      const payload = healStatusDiscordEmbed({
        stage: loop.healed ? "recovered" : "still_broken",
        collectorId: loop.collector_id,
        url: loop.anchor,
        beforeCount: loop.before.valid_count,
        afterCount: loop.after?.valid_count ?? 0,
        stages: loop.stages,
      });
      const posted = await postEmbedBrief(channelId, payload);
      discord = posted.ok ? { status: "posted" } : { error: posted.error };
    }

    return withRateHeaders(
      NextResponse.json({
        status: loop.healed ? "recovered" : "still_broken",
        action: "auto_loop",
        ...loop,
        discord,
        budget: healRuntimeBudget(),
        costHint:
          "Heal uses Vercel-safe budget on prod (1 try). Local/CLI can run 2 tries. Gemini only if useGemini:true.",
      }),
      quota,
    );
  }

  const prompt =
    parsed.data.prompt ||
    parsed.data.snapshot?.health.heal_hint ||
    DEFAULT_PROMPT;

  const result = await runStudioCli(
    parsed.data.action === "approve" ? "approve" : "heal",
    [collectorId, url, prompt],
  );

  return withRateHeaders(
    NextResponse.json({
      status: result.ok ? "ok" : "failed",
      action: parsed.data.action,
      collector_id: collectorId,
      same_id: true,
      url,
      note: result.ok
        ? "Studio heal/approve finished — Collector ID unchanged. Re-pull with refresh=true."
        : `Studio ${parsed.data.action} did not finish: ${result.output.slice(0, 280) || "timeout"}`,
      output: result.output.slice(0, 2000),
      costHint: "Heal spends Studio AI credits once. Weekly pulls stay on the same c_*.",
    }),
    quota,
  );
}
