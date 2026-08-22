import { NextResponse } from "next/server";
import {
  discordApplicationId,
  discordGuildId,
  ensureMondayDiffChannel,
  bootstrapDiscordServer,
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
 * One-shot setup: create channels + register guild slash commands.
 * Body `{ "bootstrap": true }` — full server layout (categories, welcome embeds).
 * Default — legacy `#monday-diff` only.
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

  let bootstrap = false;
  let refresh = true;
  try {
    const body = await request.json();
    bootstrap = Boolean(body?.bootstrap);
    if (body?.refresh === false) refresh = false;
  } catch {
    bootstrap = false;
  }

  if (bootstrap) {
    const layout = await bootstrapDiscordServer(guildId, { refresh });
    if (!layout.ok) {
      return NextResponse.json({ error: layout.error }, { status: 502 });
    }

    const commands = await registerGuildCommands(appId, guildId, MONDAY_DIFF_COMMANDS);
    if (!commands.ok) {
      return NextResponse.json({ error: commands.error, layout }, { status: 502 });
    }

    const monday = layout.channels.find((c) => c.name === "monday-diff");

    return withRateHeaders(
      NextResponse.json({
        status: "ready",
        bootstrap: true,
        channels: layout.channels,
        env_lines: layout.env_lines,
        channel_id: monday?.channel_id,
        commands: commands.count,
        command_names: MONDAY_DIFF_COMMANDS.map((c) => c.name),
        interactions_url_hint:
          "Set Interactions Endpoint URL to https://<host>/api/discord/interactions and DISCORD_PUBLIC_KEY",
        guild_branded: layout.guild_branded,
        reordered: layout.reordered,
        refresh,
        env_hint: layout.env_lines.join("\n"),
      }),
      quota,
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
      bootstrap: false,
      channel_id: channel.channelId,
      channel_created: channel.created,
      channel_name: channel.name,
      commands: commands.count,
      command_names: MONDAY_DIFF_COMMANDS.map((c) => c.name),
      interactions_url_hint:
        "Set Interactions Endpoint URL to https://<host>/api/discord/interactions and DISCORD_PUBLIC_KEY",
      env_hint: `DISCORD_CHANNEL_ID=${channel.channelId}\nTip: POST {"bootstrap":true} for full server layout`,
    }),
    quota,
  );
}
