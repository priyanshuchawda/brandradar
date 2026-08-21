import { NextResponse } from "next/server";
import {
  discordApplicationId,
  discordGuildId,
  ensureMondayDiffChannel,
} from "@/lib/discord";
import { MONDAY_DIFF_COMMANDS, registerGuildCommands } from "@/lib/discord-api";
import {
  authorize,
  clientKey,
  enforceOrigin,
  limited,
  withRateHeaders,
} from "@/lib/guard";
import { healLimiter } from "@/lib/rate-limit";

export const maxDuration = 60;

/**
 * One-shot setup: create #monday-diff if missing, register guild slash commands.
 * Requires DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_APPLICATION_ID (or CLIENT_ID).
 */
export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = healLimiter.check(clientKey(request));
  const limitedResponse = limited(quota, "Discord setup rate limit reached");
  if (limitedResponse) return limitedResponse;

  const guildId = discordGuildId();
  const appId = discordApplicationId();
  if (!process.env.DISCORD_BOT_TOKEN?.trim()) {
    return NextResponse.json({ error: "DISCORD_BOT_TOKEN is not set" }, { status: 503 });
  }
  if (!guildId) {
    return NextResponse.json({ error: "DISCORD_GUILD_ID is not set" }, { status: 503 });
  }
  if (!appId) {
    return NextResponse.json(
      { error: "DISCORD_APPLICATION_ID or DISCORD_CLIENT_ID is not set" },
      { status: 503 },
    );
  }

  const channel = await ensureMondayDiffChannel(guildId);
  if (!channel.ok) {
    return NextResponse.json({ error: channel.error }, { status: 502 });
  }

  const commands = await registerGuildCommands(appId, guildId, MONDAY_DIFF_COMMANDS);
  if (!commands.ok) {
    return NextResponse.json(
      {
        error: commands.error,
        channel,
      },
      { status: 502 },
    );
  }

  return withRateHeaders(
    NextResponse.json({
      status: "ready",
      channel_id: channel.channelId,
      channel_created: channel.created,
      channel_name: channel.name,
      commands: commands.count,
      command_names: MONDAY_DIFF_COMMANDS.map((c) => c.name),
      interactions_url_hint:
        "Set Interactions Endpoint URL to https://<host>/api/discord/interactions and DISCORD_PUBLIC_KEY",
      env_hint: `DISCORD_CHANNEL_ID=${channel.channelId}`,
    }),
    quota,
  );
}
