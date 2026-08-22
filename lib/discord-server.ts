import {
  createChannel,
  listGuildChannels,
  patchChannel,
  patchGuild,
  pinChannelMessage,
  postChannelMessage,
  READ_ONLY_EVERYONE,
  reorderGuildChannels,
  type GuildChannelRow,
  type PermissionOverwrite,
} from "./discord-api";
import {
  buildCommandsEmbed,
  buildDemoLinksEmbed,
  buildHealLabWelcomeEmbed,
  buildMondayDiffWelcomeEmbed,
  buildRivalsEmbed,
  buildRulesEmbed,
  buildSchemaEmbed,
  buildStartHereEmbed,
  buildSubmissionEmbed,
} from "./discord-embeds";
import { BRAND } from "./discord-brand";

const CATEGORY_TYPE = 4;
const TEXT_TYPE = 0;

export type ServerChannelSpec = {
  name: string;
  topic: string;
  category: string;
  order: number;
  readOnly?: boolean;
  pinWelcome?: boolean;
  welcome?: () => { content?: string; embeds: unknown[] };
  envKey?: string;
};

export const BRANDRADAR_SERVER_LAYOUT: ServerChannelSpec[] = [
  {
    name: "rules",
    category: "START HERE",
    order: 0,
    topic: "Server rules · read first · no secrets in chat",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildRulesEmbed()] }),
    envKey: "DISCORD_RULES_CHANNEL_ID",
  },
  {
    name: "start-here",
    category: "START HERE",
    order: 1,
    topic: "Judge path · 2-min demo · Into the Scrape-Verse",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildStartHereEmbed()] }),
    envKey: "DISCORD_START_CHANNEL_ID",
  },
  {
    name: "slash-commands",
    category: "START HERE",
    order: 2,
    topic: "/intel · /rivals · /schema · /help",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildCommandsEmbed()] }),
    envKey: "DISCORD_COMMANDS_CHANNEL_ID",
  },
  {
    name: "schema",
    category: "START HERE",
    order: 3,
    topic: "ListingRow · IntelSnapshot · collector c_*",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildSchemaEmbed()] }),
    envKey: "DISCORD_SCHEMA_CHANNEL_ID",
  },
  {
    name: "monday-diff",
    category: "MONDAY DIFF",
    order: 10,
    topic: "Weekly rival briefs · /intel mode:live",
    pinWelcome: true,
    welcome: () => ({ embeds: [buildMondayDiffWelcomeEmbed()] }),
    envKey: "DISCORD_CHANNEL_ID",
  },
  {
    name: "cohort-rivals",
    category: "MONDAY DIFF",
    order: 11,
    topic: "Roame · Stardrift · Pointhound · Rove",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildRivalsEmbed()] }),
    envKey: "DISCORD_RIVALS_CHANNEL_ID",
  },
  {
    name: "heal-alerts",
    category: "HEAL LAB",
    order: 20,
    topic: "broken → self-heal → recovered · same c_* id",
    pinWelcome: true,
    welcome: () => ({ embeds: [buildHealLabWelcomeEmbed()] }),
    envKey: "DISCORD_HEAL_CHANNEL_ID",
  },
  {
    name: "demo-links",
    category: "HEAL LAB",
    order: 21,
    topic: "App + before/after URLs for video",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildDemoLinksEmbed()] }),
    envKey: "DISCORD_DEMO_CHANNEL_ID",
  },
  {
    name: "hackathon-track",
    category: "HACKATHON",
    order: 30,
    topic: "WeMakeDevs × Bright Data · submission notes",
    readOnly: true,
    pinWelcome: true,
    welcome: () => ({ embeds: [buildSubmissionEmbed()] }),
    envKey: "DISCORD_SUBMISSION_CHANNEL_ID",
  },
];

const LEGACY_CATEGORIES = ["BrandRadar", "Monday Diff", "Heal Lab", "━━ START HERE ━━"];

type ChannelCache = {
  channels: GuildChannelRow[];
  categories: Map<string, string>;
};

function everyoneOverwrite(guildId: string): PermissionOverwrite {
  return {
    id: guildId,
    type: 0,
    allow: READ_ONLY_EVERYONE.allow,
    deny: READ_ONLY_EVERYONE.deny,
  };
}

async function refreshChannelList(guildId: string, cache: ChannelCache): Promise<void> {
  const listed = await listGuildChannels(guildId);
  if (listed.ok) cache.channels = listed.channels;
}

async function ensureCategoryCached(
  guildId: string,
  name: string,
  order: number,
  cache: ChannelCache,
): Promise<string | null> {
  if (cache.categories.has(name)) return cache.categories.get(name)!;

  const existing = cache.channels.find(
    (c) => c.type === CATEGORY_TYPE && c.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    await patchChannel(existing.id, { position: order });
    cache.categories.set(name, existing.id);
    return existing.id;
  }

  const created = await createChannel(guildId, { name, type: CATEGORY_TYPE });
  if (!created.ok) return null;
  await patchChannel(created.channelId, { position: order });
  cache.categories.set(name, created.channelId);
  cache.channels.push({
    id: created.channelId,
    name,
    type: CATEGORY_TYPE,
    parent_id: null,
    position: order,
  });
  return created.channelId;
}

export async function ensureBrandRadarChannel(
  guildId: string,
  spec: ServerChannelSpec,
  cache: ChannelCache,
): Promise<
  { ok: true; channelId: string; created: boolean; name: string } | { ok: false; error: string }
> {
  const parentId = await ensureCategoryCached(guildId, spec.category, spec.order, cache);

  let match = cache.channels.find(
    (c) =>
      c.type === TEXT_TYPE &&
      c.name === spec.name &&
      (!parentId || c.parent_id === parentId),
  );
  if (!match) {
    match = cache.channels.find((c) => c.type === TEXT_TYPE && c.name === spec.name);
  }

  const overwrites = spec.readOnly ? [everyoneOverwrite(guildId)] : undefined;

  if (match) {
    const patched = await patchChannel(match.id, {
      topic: spec.topic,
      parent_id: parentId ?? null,
      position: spec.order,
      ...(overwrites ? { permission_overwrites: overwrites } : {}),
    });
    if (!patched.ok) return patched;
    return { ok: true, channelId: match.id, created: false, name: spec.name };
  }

  const created = await createChannel(guildId, {
    name: spec.name,
    topic: spec.topic,
    type: TEXT_TYPE,
    parent_id: parentId ?? undefined,
    permission_overwrites: overwrites,
  });
  if (!created.ok) return created;
  await patchChannel(created.channelId, { position: spec.order });
  cache.channels.push({
    id: created.channelId,
    name: spec.name,
    type: TEXT_TYPE,
    parent_id: parentId ?? null,
    position: spec.order,
    topic: spec.topic,
  });
  return { ok: true, channelId: created.channelId, created: true, name: spec.name };
}

async function postWelcome(
  channelId: string,
  spec: ServerChannelSpec,
  refresh: boolean,
  created: boolean,
): Promise<{ posted: boolean; pinned: boolean }> {
  if (!spec.welcome) return { posted: false, pinned: false };
  if (!refresh && !created) return { posted: false, pinned: false };

  const payload = spec.welcome();
  const posted = await postChannelMessage(channelId, payload);
  if (!posted.ok) return { posted: false, pinned: false };

  let pinned = false;
  if (spec.pinWelcome) {
    const pin = await pinChannelMessage(channelId, posted.messageId);
    pinned = pin.ok;
  }
  return { posted: true, pinned };
}

async function applyGuildBranding(
  guildId: string,
  channelIds: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const description = [BRAND.tagline, BRAND.hackathon, BRAND.appUrl].join(" · ").slice(0, 300);
  return patchGuild(guildId, {
    description,
    system_channel_id: channelIds["start-here"],
    rules_channel_id: channelIds["rules"],
    default_message_notifications: 1,
  });
}

async function reorderServer(guildId: string, cache: ChannelCache): Promise<void> {
  await refreshChannelList(guildId, cache);
  const layoutOrder = new Map<string, number>();
  for (const spec of BRANDRADAR_SERVER_LAYOUT) {
    layoutOrder.set(spec.name, spec.order);
    layoutOrder.set(spec.category, spec.order);
  }
  const sorted = [...cache.channels].sort((a, b) => {
    const ao = layoutOrder.get(a.name) ?? a.position ?? 99;
    const bo = layoutOrder.get(b.name) ?? b.position ?? 99;
    if (ao !== bo) return ao - bo;
    return (a.position ?? 0) - (b.position ?? 0);
  });
  await reorderGuildChannels(sorted.map((c) => c.id));
}

export type BootstrapOptions = {
  refresh?: boolean;
};

export async function bootstrapDiscordServer(
  guildId: string,
  options: BootstrapOptions = {},
): Promise<
  | {
      ok: true;
      channels: Array<{
        name: string;
        channel_id: string;
        created: boolean;
        env_key?: string;
        welcome_posted?: boolean;
        welcome_pinned?: boolean;
      }>;
      env_lines: string[];
      guild_branded: boolean;
      reordered: boolean;
    }
  | { ok: false; error: string }
> {
  const refresh = options.refresh !== false;
  const listed = await listGuildChannels(guildId);
  if (!listed.ok) return { ok: false, error: listed.error };

  const cache: ChannelCache = { channels: listed.channels, categories: new Map() };
  const channels: Array<{
    name: string;
    channel_id: string;
    created: boolean;
    env_key?: string;
    welcome_posted?: boolean;
    welcome_pinned?: boolean;
  }> = [];
  const env_lines: string[] = [];
  const channelIds: Record<string, string> = {};

  for (const spec of BRANDRADAR_SERVER_LAYOUT) {
    const ensured = await ensureBrandRadarChannel(guildId, spec, cache);
    if (!ensured.ok) return { ok: false, error: ensured.error };

    channelIds[spec.name] = ensured.channelId;
    const welcome = await postWelcome(ensured.channelId, spec, refresh, ensured.created);

    channels.push({
      name: spec.name,
      channel_id: ensured.channelId,
      created: ensured.created,
      env_key: spec.envKey,
      welcome_posted: welcome.posted,
      welcome_pinned: welcome.pinned,
    });
    if (spec.envKey) env_lines.push(`${spec.envKey}=${ensured.channelId}`);
  }

  const branded = await applyGuildBranding(guildId, channelIds);
  await reorderServer(guildId, cache);

  return {
    ok: true,
    channels,
    env_lines,
    guild_branded: branded.ok,
    reordered: true,
  };
}

export function healAlertChannelId(): string | undefined {
  return (
    process.env.DISCORD_HEAL_CHANNEL_ID?.trim() ||
    process.env.DISCORD_CHANNEL_ID?.trim() ||
    undefined
  );
}

export { LEGACY_CATEGORIES };
