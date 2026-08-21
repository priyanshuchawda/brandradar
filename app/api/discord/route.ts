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
import { discordConfigured, discordMode, postIntelToDiscord } from "@/lib/discord";
import { runIntelPull } from "@/lib/intel-pull";
import { healLimiter } from "@/lib/rate-limit";
import { z } from "zod";

export const maxDuration = 300;

const BodySchema = z.object({
  forceMock: z.boolean().optional(),
  persist: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json({
    configured: discordConfigured(),
    mode: discordMode(),
    hint: discordConfigured()
      ? "POST /api/discord with optional { forceMock, persist } to pull intel and post."
      : "Set DISCORD_WEBHOOK_URL or DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID in .env.local",
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
