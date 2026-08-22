/**
 * Discord Structured Publisher for Smart Sublink Crawls.
 *
 * Formats structured competitive findings and provenance telemetry into rich Discord embeds
 * and publishes to the competitor's assigned Discord channel.
 */

import { postChannelMessage } from "../discord-api";
import { BRAND, embedAuthor } from "../discord-brand";
import type { DiscordEmbed } from "../discord-embeds";
import type { CrawlSession } from "./crawl-schema";

function resolveChannelForCompetitor(competitor: string): string | null {
  const slug = competitor.toLowerCase().trim();

  if (slug.includes("roame")) return process.env.DISCORD_RIVAL_ROAME_CHANNEL_ID || null;
  if (slug.includes("stardrift")) return process.env.DISCORD_RIVAL_STARDRIFT_CHANNEL_ID || null;
  if (slug.includes("pointhound")) return process.env.DISCORD_RIVAL_POINTHOUND_CHANNEL_ID || null;
  if (slug.includes("rove")) return process.env.DISCORD_RIVAL_ROVE_CHANNEL_ID || null;

  return process.env.DISCORD_CHANNEL_ID || process.env.DISCORD_RIVALS_CHANNEL_ID || null;
}

export function buildCrawlDiscordEmbed(session: CrawlSession): DiscordEmbed {
  const analysis = session.finalAnalysis;
  const goal = session.goal;

  const changesList = (analysis?.observedChanges ?? [])
    .slice(0, 3)
    .map((c) => `▸ **${c.title}** (${Math.round(c.confidence * 100)}% conf)\n  _${c.description}_`)
    .join("\n\n");

  const directionsList = (analysis?.directions ?? [])
    .slice(0, 2)
    .map((d) => `▸ **${d.area}**: \`${d.direction.toUpperCase()}\` — ${d.summary}`)
    .join("\n");

  const opportunitiesList = (analysis?.opportunities ?? [])
    .slice(0, 2)
    .map((o) => `▸ [${o.type}] **${o.title}**: ${o.description}`)
    .join("\n");

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    {
      name: "🎯 Monitoring Goal",
      value: `_${goal.goal}_`,
      inline: false,
    },
    {
      name: "📑 Crawl Provenance",
      value: `**${session.pagesCollected}** pages verified · **${session.decisions.length}** Gemini decisions · Stop: \`${session.stopReason || "COMPLETE"}\``,
      inline: false,
    },
  ];

  if (changesList) {
    fields.push({
      name: "⚡ Observed Changes",
      value: changesList,
      inline: false,
    });
  }

  if (directionsList) {
    fields.push({
      name: "🧭 Strategic Direction",
      value: directionsList,
      inline: false,
    });
  }

  if (opportunitiesList) {
    fields.push({
      name: "💡 Recommended Moves",
      value: opportunitiesList,
      inline: false,
    });
  }

  return {
    author: embedAuthor(),
    title: `📡 Smart Crawl Intelligence · ${goal.competitor.toUpperCase()}`,
    description: analysis?.summary || `Autonomous sublink crawl completed for ${goal.competitor}.`,
    url: BRAND.appUrl,
    color: BRAND.colors.primary,
    timestamp: session.finishedAt || new Date().toISOString(),
    fields,
    footer: {
      text: `BrandRadar Smart Crawl · Session ${session.sessionId}`,
    },
  };
}

export async function publishCrawlToDiscord(
  session: CrawlSession,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, error: "DISCORD_BOT_TOKEN is not configured" };
  }

  const channelId = resolveChannelForCompetitor(session.goal.competitor);
  if (!channelId) {
    return { ok: false, error: `No Discord channel configured for competitor: ${session.goal.competitor}` };
  }

  const embed = buildCrawlDiscordEmbed(session);
  const result = await postChannelMessage(channelId, {
    embeds: [embed],
  });

  return result;
}
