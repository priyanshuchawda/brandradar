import { createChannel, manageGuildChannel, postEmbedBrief } from "./discord-api";
import { buildIntelContent, buildIntelEmbeds } from "./discord-embeds";
import { healAlertChannelId } from "./discord-server";
import type { IntelSnapshot } from "./intel-schema";

export { chunkDiscordContent } from "./discord-format";
export {
  buildIntelEmbeds,
  buildIntelContent,
  buildRivalsEmbed,
  buildHelpEmbed,
  buildSchemaEmbed,
  buildStartHereEmbed,
  buildHealLabWelcomeEmbed,
} from "./discord-embeds";
export { bootstrapDiscordServer, BRANDRADAR_SERVER_LAYOUT } from "./discord-server";

export function discordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_WEBHOOK_URL?.trim() ||
      (process.env.DISCORD_BOT_TOKEN?.trim() &&
        process.env.DISCORD_CHANNEL_ID?.trim()),
  );
}

export function discordMode(): "webhook" | "bot" | null {
  if (process.env.DISCORD_WEBHOOK_URL?.trim()) return "webhook";
  if (
    process.env.DISCORD_BOT_TOKEN?.trim() &&
    process.env.DISCORD_CHANNEL_ID?.trim()
  ) {
    return "bot";
  }
  return null;
}

export function discordGuildId(): string | undefined {
  return process.env.DISCORD_GUILD_ID?.trim() || undefined;
}

export function discordApplicationId(): string | undefined {
  return (
    process.env.DISCORD_APPLICATION_ID?.trim() ||
    process.env.DISCORD_CLIENT_ID?.trim() ||
    undefined
  );
}

export async function postIntelToDiscord(
  snapshot: IntelSnapshot,
): Promise<{ ok: true; mode: "webhook" | "bot"; messages: number } | { ok: false; error: string }> {
  const mode = discordMode();
  if (!mode) {
    return {
      ok: false,
      error:
        "Set DISCORD_WEBHOOK_URL, or DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID",
    };
  }

  const embeds = buildIntelEmbeds(snapshot);
  // Discord allows max 10 embeds per message; we send one message with up to 10.
  const payload = {
    content: buildIntelContent(snapshot),
    embeds: embeds.slice(0, 10),
  };

  try {
    if (mode === "webhook") {
      const webhook = process.env.DISCORD_WEBHOOK_URL!.trim();
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        return {
          ok: false,
          error: `Webhook ${response.status}: ${(await response.text()).slice(0, 200)}`,
        };
      }
      return { ok: true, mode, messages: 1 };
    }

    const result = await postEmbedBrief(
      process.env.DISCORD_CHANNEL_ID!.trim(),
      payload,
    );
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, mode, messages: 1 };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Discord post failed",
    };
  }
}

export async function ensureMondayDiffChannel(guildId: string): Promise<
  | { ok: true; channelId: string; created: boolean; name: string }
  | { ok: false; error: string }
> {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };

  const listed = await manageGuildChannel(guildId, "monday-diff");
  if (listed.ok && listed.channelId) {
    return {
      ok: true,
      channelId: listed.channelId,
      created: false,
      name: listed.name ?? "monday-diff",
    };
  }

  const created = await createChannel(guildId, {
    name: "monday-diff",
    topic:
      "BrandRadar Monday Diff — weekly rival update briefs (guides/blogs/changelogs). Use /intel",
    type: 0,
  });
  if (!created.ok) return created;
  return {
    ok: true,
    channelId: created.channelId,
    created: true,
    name: "monday-diff",
  };
}

/** Post heal broken/recovered alerts to #heal-alerts (falls back to #monday-diff). */
export async function postHealAlertToDiscord(payload: {
  content: string;
  embeds: unknown[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const channelId = healAlertChannelId();
  if (!channelId || !process.env.DISCORD_BOT_TOKEN?.trim()) {
    return { ok: false, error: "DISCORD_BOT_TOKEN + heal channel not configured" };
  }
  return postEmbedBrief(channelId, payload);
}
