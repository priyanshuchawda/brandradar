import {
  deleteChannel,
  listGuildChannels,
  type GuildChannelRow,
} from "./discord-api";
import { BRANDRADAR_SERVER_LAYOUT, LEGACY_CATEGORIES } from "./discord-server";

const CATEGORY_TYPE = 4;

/** Default Discord template categories — removed when empty. */
const DEFAULT_TEMPLATE_CATEGORIES = new Set(["Text Channels", "Voice Channels"]);

/** Obvious junk / test channels from manual cleanup. */
const JUNK_CHANNEL_NAMES = new Set(["o", "hehe", "general"]);

/** Unicode-box legacy categories from first bootstrap attempt. */
const LEGACY_UNICODE_CATEGORIES = [
  "━━ START HERE ━━",
  "━━ MONDAY DIFF ━━",
  "━━ HEAL LAB ━━",
];

function keepChannelNames(): Set<string> {
  return new Set(BRANDRADAR_SERVER_LAYOUT.map((s) => s.name));
}

function keepCategoryNames(): Set<string> {
  return new Set(BRANDRADAR_SERVER_LAYOUT.map((s) => s.category));
}

function envProtectedIds(): Set<string> {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("DISCORD_") && key.endsWith("_CHANNEL_ID") && value?.trim()) {
      ids.add(value.trim());
    }
    if (key === "DISCORD_CHANNEL_ID" && value?.trim()) ids.add(value.trim());
  }
  return ids;
}

export function channelMarkedForPrune(
  channel: GuildChannelRow,
  all: GuildChannelRow[],
  protectedIds: Set<string>,
): boolean {
  if (protectedIds.has(channel.id)) return false;

  const keepNames = keepChannelNames();
  const keepCats = keepCategoryNames();

  if (channel.type === CATEGORY_TYPE) {
    if (keepCats.has(channel.name)) return false;
    const legacy =
      LEGACY_CATEGORIES.includes(channel.name) ||
      LEGACY_UNICODE_CATEGORIES.includes(channel.name);
    const template = DEFAULT_TEMPLATE_CATEGORIES.has(channel.name);
    if (!legacy && !template) return false;
    const children = all.filter((c) => c.parent_id === channel.id);
    if (children.length === 0) return true;
    return children.every((child) => channelMarkedForPrune(child, all, protectedIds));
  }

  if (keepNames.has(channel.name)) return false;
  if (JUNK_CHANNEL_NAMES.has(channel.name.toLowerCase())) return true;
  // Default voice lounge
  if (channel.type === 2 && channel.name === "General") return true;

  return false;
}

export async function pruneDiscordServer(guildId: string): Promise<
  | { ok: true; deleted: Array<{ id: string; name: string; type: number }> }
  | { ok: false; error: string }
> {
  const deleted: Array<{ id: string; name: string; type: number }> = [];
  const protectedIds = envProtectedIds();

  for (let round = 0; round < 8; round++) {
    const listed = await listGuildChannels(guildId);
    if (!listed.ok) return { ok: false, error: listed.error };

    const targets = listed.channels.filter((c) =>
      channelMarkedForPrune(c, listed.channels, protectedIds),
    );
    if (targets.length === 0) break;

    // Delete leaves first (non-categories before categories)
    targets.sort((a, b) => {
      if (a.type === CATEGORY_TYPE && b.type !== CATEGORY_TYPE) return 1;
      if (b.type === CATEGORY_TYPE && a.type !== CATEGORY_TYPE) return -1;
      return 0;
    });

    let progress = false;
    for (const ch of targets) {
      const fresh = await listGuildChannels(guildId);
      if (!fresh.ok) return { ok: false, error: fresh.error };
      if (!channelMarkedForPrune(ch, fresh.channels, protectedIds)) continue;

      const result = await deleteChannel(ch.id);
      if (result.ok) {
        deleted.push({ id: ch.id, name: ch.name, type: ch.type });
        progress = true;
      }
    }
    if (!progress) break;
  }

  return { ok: true, deleted };
}
