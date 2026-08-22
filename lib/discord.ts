import {
  createChannel,
  listGuildChannels,
  manageGuildChannel,
  postEmbedBrief,
} from "./discord-api";
import {
  buildCompanyDossierEmbed,
  buildCompanyIntelEmbeds,
  buildIntelContent,
  buildIntelEmbeds,
  analyzeStrategicDirection,
} from "./discord-embeds";
import { healAlertChannelId } from "./discord-server";
import type { IntelSnapshot } from "./intel-schema";
import { loadCohortConfig } from "./rivals";

export { chunkDiscordContent } from "./discord-format";
export {
  buildIntelEmbeds,
  buildIntelContent,
  buildRivalsEmbed,
  buildHelpEmbed,
  buildSchemaEmbed,
  buildStartHereEmbed,
  buildHealLabWelcomeEmbed,
  buildCompanyDossierEmbed,
  buildCompanyIntelEmbeds,
  analyzeStrategicDirection,
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

/** Post intel to #monday-diff and dispatch dedicated briefs to each company channel. */
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

    let messagesSent = 1;
    const guildId = discordGuildId();
    if (guildId) {
      try {
        const config = loadCohortConfig();
        const listed = await listGuildChannels(guildId);
        if (listed.ok) {
          for (const rival of config.rivals) {
            const channel = listed.channels.find(
              (c) => c.name.toLowerCase() === rival.id.toLowerCase() && c.type === 0,
            );
            if (channel) {
              const bucket = snapshot.rivals.find((r) => r.rival_id === rival.id);
              const diff = snapshot.diff.find((d) => d.rival_id === rival.id);
              const companyEmbeds = buildCompanyIntelEmbeds(rival, {
                bucket,
                diff,
                plays: snapshot.plays,
                week: snapshot.week,
                visibility: snapshot.visibility,
                collectorId: bucket?.collector_id ?? snapshot.health.collector_ids[0],
              });
              const postRes = await postEmbedBrief(channel.id, {
                content: `🏢 **Intel Brief:** \`${rival.name}\` · Week \`${snapshot.week}\``,
                embeds: companyEmbeds.slice(0, 10),
              });
              if (postRes.ok) messagesSent++;
            }
          }
        }
      } catch {
        // Non-fatal: if company channels fail, main brief was already delivered
      }
    }

    return { ok: true, mode, messages: messagesSent };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Discord post failed",
    };
  }
}

/** Post deep-dive intel to a specific company's dedicated channel. */
export async function postCompanyIntelToDiscord(
  rivalId: string,
  snapshot: IntelSnapshot,
  guildId?: string,
): Promise<{ ok: true; channelId: string } | { ok: false; error: string }> {
  const gId = guildId || discordGuildId();
  if (!gId || !process.env.DISCORD_BOT_TOKEN?.trim()) {
    return { ok: false, error: "DISCORD_BOT_TOKEN and DISCORD_GUILD_ID required" };
  }

  const config = loadCohortConfig();
  const rival = config.rivals.find(
    (r) => r.id === rivalId || r.name.toLowerCase() === rivalId.toLowerCase(),
  );
  if (!rival) return { ok: false, error: `Rival ${rivalId} not found in cohort config` };

  const listed = await listGuildChannels(gId);
  if (!listed.ok) return { ok: false, error: listed.error };

  let targetChannel = listed.channels.find(
    (c) => c.name.toLowerCase() === rival.id.toLowerCase() && c.type === 0,
  );
  if (!targetChannel) {
    const created = await createChannel(gId, {
      name: rival.id.toLowerCase(),
      topic: `${rival.name} (${rival.homepage}) · Updates: ${rival.update_url} · ${rival.surface} intel & strategy`,
      type: 0,
    });
    if (!created.ok) return { ok: false, error: created.error };
    targetChannel = { id: created.channelId, name: rival.id, type: 0 };
  }

  const bucket = snapshot.rivals.find((r) => r.rival_id === rival.id);
  const diff = snapshot.diff.find((d) => d.rival_id === rival.id);
  const embeds = buildCompanyIntelEmbeds(rival, {
    bucket,
    diff,
    plays: snapshot.plays,
    week: snapshot.week,
    visibility: snapshot.visibility,
    collectorId: bucket?.collector_id ?? snapshot.health.collector_ids[0],
  });

  const posted = await postEmbedBrief(targetChannel.id, {
    content: `🏢 **Deep-Dive Intel Brief:** \`${rival.name}\` · Week \`${snapshot.week}\``,
    embeds: embeds.slice(0, 10),
  });
  if (!posted.ok) return posted;
  return { ok: true, channelId: targetChannel.id };
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
