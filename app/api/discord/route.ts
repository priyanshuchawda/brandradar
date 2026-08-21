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
import {
  discordApplicationId,
  discordConfigured,
  discordGuildId,
  discordMode,
  postIntelToDiscord,
} from "@/lib/discord";
import { runIntelPull } from "@/lib/intel-pull";
import { healLimiter } from "@/lib/rate-limit";
import { z } from "zod";

export const maxDuration = 300;

const BodySchema = z.object({
  forceMock: z.boolean().optional(),
  persist: z.boolean().optional(),
  /** Default false — reuse week cache so Discord post does not re-scrape. */
  refresh: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({
    configured: discordConfigured(),
    mode: discordMode(),
    guild_id: discordGuildId() ?? null,
    application_id: discordApplicationId() ?? null,
    channel_id: process.env.DISCORD_CHANNEL_ID?.trim() || null,
    public_key_set: Boolean(process.env.DISCORD_PUBLIC_KEY?.trim()),
    slash_commands: ["/intel", "/rivals", "/help"],
    endpoints: {
      post_brief: "POST /api/discord",
      setup_channel_and_commands: "POST /api/discord/setup",
      interactions: "POST /api/discord/interactions",
      monday_cron: "POST /api/cron/monday-diff",
    },
    hint: discordConfigured()
      ? "POST /api/discord posts embeds. Default refresh=false reuses the week snapshot (no Studio spend)."
      : "Set DISCORD_WEBHOOK_URL, or DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID in .env.local",
  });
}

export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = healLimiter.check(clientKey(request));
  const limitedResponse = limited(
    quota,
    "Discord post rate limit reached. Wait before posting again.",
  );
  if (limitedResponse) return limitedResponse;

  if (!discordConfigured()) {
    return NextResponse.json(
      {
        error:
          "Discord is not configured. Add DISCORD_WEBHOOK_URL or DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID.",
      },
      { status: 503 },
    );
  }

  const body = await readJsonBody(request, SCAN_BODY_LIMIT);
  if (body instanceof NextResponse) return body;
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const snapshot = await runIntelPull({
      forceMock: parsed.data.forceMock,
      persist: parsed.data.persist,
      refresh: parsed.data.refresh === true,
    });
    const posted = await postIntelToDiscord(snapshot);
    if (!posted.ok) {
      return withRateHeaders(
        NextResponse.json({ error: posted.error, snapshot }, { status: 502 }),
        quota,
      );
    }
    return withRateHeaders(
      NextResponse.json({
        status: "posted",
        mode: posted.mode,
        messages: posted.messages,
        week: snapshot.week,
        plays: snapshot.plays.length,
        embeds: true,
        intel_mode: snapshot.mode,
        cached: snapshot.notes.some((n) => n.includes("Week cache hit")),
      }),
      quota,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discord post failed" },
      { status: 400 },
    );
  }
}
