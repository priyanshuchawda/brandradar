import { formatIntelDiscordMessage } from "./intel-plays";
import type { IntelSnapshot } from "./intel-schema";

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

/** Discord hard limit is 2000; leave room for formatting. */
export function chunkDiscordContent(content: string, max = 1900): string[] {
  if (content.length <= max) return [content];
  const chunks: string[] = [];
  let rest = content;
  while (rest.length > 0) {
    if (rest.length <= max) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  return chunks;
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

  const body = formatIntelDiscordMessage(snapshot);
  const chunks = chunkDiscordContent(body);

  try {
    if (mode === "webhook") {
      const webhook = process.env.DISCORD_WEBHOOK_URL!.trim();
      for (const content of chunks) {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!response.ok) {
          return {
            ok: false,
            error: `Webhook ${response.status}: ${(await response.text()).slice(0, 200)}`,
          };
        }
      }
      return { ok: true, mode, messages: chunks.length };
    }

    const token = process.env.DISCORD_BOT_TOKEN!.trim();
    const channelId = process.env.DISCORD_CHANNEL_ID!.trim();
    for (const content of chunks) {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );
      if (!response.ok) {
        return {
          ok: false,
          error: `Bot API ${response.status}: ${(await response.text()).slice(0, 200)}`,
        };
      }
    }
    return { ok: true, mode, messages: chunks.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Discord post failed",
    };
  }
}
