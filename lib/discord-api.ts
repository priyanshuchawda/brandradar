const API = "https://discord.com/api/v10";

export const PERM = {
  VIEW_CHANNEL: BigInt(1) << BigInt(10),
  SEND_MESSAGES: BigInt(1) << BigInt(11),
  EMBED_LINKS: BigInt(1) << BigInt(14),
  READ_MESSAGE_HISTORY: BigInt(1) << BigInt(16),
  MANAGE_MESSAGES: BigInt(1) << BigInt(13),
  MANAGE_CHANNELS: BigInt(1) << BigInt(4),
} as const;

function permString(bits: bigint): string {
  return bits.toString();
}

export const READ_ONLY_EVERYONE = {
  allow: permString(PERM.VIEW_CHANNEL | PERM.READ_MESSAGE_HISTORY),
  deny: permString(PERM.SEND_MESSAGES),
};

function botToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return token;
}

async function botFetch(
  path: string,
  init?: RequestInit,
  attempt = 0,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (response.status === 429 && attempt < 4) {
    const retry =
      json &&
      typeof json === "object" &&
      "retry_after" in json &&
      typeof (json as { retry_after: unknown }).retry_after === "number"
        ? (json as { retry_after: number }).retry_after
        : 1;
    await new Promise((r) => setTimeout(r, Math.ceil(retry * 1000) + 100));
    return botFetch(path, init, attempt + 1);
  }
  return { ok: response.ok, status: response.status, json, text };
}

export async function postEmbedBrief(
  channelId: string,
  payload: { content?: string; embeds: unknown[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await postChannelMessage(channelId, payload);
  if (!result.ok) return result;
  return { ok: true };
}

export async function postChannelMessage(
  channelId: string,
  payload: { content?: string; embeds: unknown[] },
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const result = await botFetch(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    return { ok: false, error: `Bot API ${result.status}: ${result.text.slice(0, 200)}` };
  }
  const id =
    result.json && typeof result.json === "object" && "id" in result.json
      ? String((result.json as { id: unknown }).id)
      : null;
  if (!id) return { ok: false, error: "Message post returned no id" };
  return { ok: true, messageId: id };
}

export async function pinChannelMessage(
  channelId: string,
  messageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await botFetch(
    `/channels/${encodeURIComponent(channelId)}/pins/${encodeURIComponent(messageId)}`,
    { method: "PUT" },
  );
  if (!result.ok) {
    return { ok: false, error: `Pin ${result.status}: ${result.text.slice(0, 200)}` };
  }
  return { ok: true };
}

export type GuildChannelRow = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
};

export async function listGuildChannels(
  guildId: string,
): Promise<{ ok: true; channels: GuildChannelRow[] } | { ok: false; error: string }> {
  const result = await botFetch(`/guilds/${encodeURIComponent(guildId)}/channels`);
  if (!result.ok) {
    return { ok: false, error: `List channels ${result.status}: ${result.text.slice(0, 200)}` };
  }
  const raw = Array.isArray(result.json) ? result.json : [];
  const channels: GuildChannelRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || !("id" in row) || !("name" in row)) continue;
    const r = row as {
      id: unknown;
      name: unknown;
      type?: unknown;
      parent_id?: unknown;
      position?: unknown;
      topic?: unknown;
    };
    channels.push({
      id: String(r.id),
      name: String(r.name),
      type: typeof r.type === "number" ? r.type : 0,
      parent_id: r.parent_id != null ? String(r.parent_id) : null,
      position: typeof r.position === "number" ? r.position : 0,
      topic: r.topic != null ? String(r.topic) : null,
    });
  }
  return { ok: true, channels };
}

export async function manageGuildChannel(
  guildId: string,
  name: string,
): Promise<{ ok: true; channelId?: string; name?: string } | { ok: false; error: string }> {
  const listed = await listGuildChannels(guildId);
  if (!listed.ok) return listed;
  const match = listed.channels.find((row) => row.name === name && row.type === 0);
  if (match) return { ok: true, channelId: match.id, name: match.name };
  return { ok: true };
}

export type PermissionOverwrite = {
  id: string;
  type: 0 | 1;
  allow?: string;
  deny?: string;
};

export async function patchChannel(
  channelId: string,
  patch: {
    name?: string;
    topic?: string;
    position?: number;
    parent_id?: string | null;
    permission_overwrites?: PermissionOverwrite[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await botFetch(`/channels/${encodeURIComponent(channelId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!result.ok) {
    return { ok: false, error: `Patch channel ${result.status}: ${result.text.slice(0, 240)}` };
  }
  return { ok: true };
}

export async function createChannel(
  guildId: string,
  input: {
    name: string;
    topic?: string;
    type?: number;
    parent_id?: string;
    permission_overwrites?: PermissionOverwrite[];
  },
): Promise<{ ok: true; channelId: string } | { ok: false; error: string }> {
  const result = await botFetch(`/guilds/${encodeURIComponent(guildId)}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? 0,
      topic: input.topic,
      parent_id: input.parent_id,
      permission_overwrites: input.permission_overwrites,
    }),
  });
  if (!result.ok) {
    return { ok: false, error: `Create channel ${result.status}: ${result.text.slice(0, 240)}` };
  }
  const id =
    result.json && typeof result.json === "object" && "id" in result.json
      ? String((result.json as { id: unknown }).id)
      : null;
  if (!id) return { ok: false, error: "Create channel returned no id" };
  return { ok: true, channelId: id };
}

export async function deleteChannel(
  channelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await botFetch(`/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
  });
  if (!result.ok) {
    return { ok: false, error: `Delete channel ${result.status}: ${result.text.slice(0, 240)}` };
  }
  return { ok: true };
}

export async function patchGuild(
  guildId: string,
  patch: {
    description?: string;
    system_channel_id?: string;
    rules_channel_id?: string;
    default_message_notifications?: number;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await botFetch(`/guilds/${encodeURIComponent(guildId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!result.ok) {
    return { ok: false, error: `Patch guild ${result.status}: ${result.text.slice(0, 240)}` };
  }
  return { ok: true };
}

export async function reorderGuildChannels(
  orderedChannelIds: string[],
): Promise<{ ok: true; patched: number } | { ok: false; error: string }> {
  let patched = 0;
  for (let i = 0; i < orderedChannelIds.length; i++) {
    const result = await patchChannel(orderedChannelIds[i]!, { position: i });
    if (!result.ok) return result;
    patched++;
  }
  return { ok: true, patched };
}

export type SlashCommandDef = {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: number;
    required?: boolean;
    choices?: Array<{ name: string; value: string }>;
  }>;
};

export const MONDAY_DIFF_COMMANDS: SlashCommandDef[] = [
  {
    name: "intel",
    description: "Pull Monday Diff competitive intel and post the brief",
    options: [
      {
        name: "mode",
        description: "live Studio pull or example fixture",
        type: 3,
        required: false,
        choices: [
          { name: "example", value: "example" },
          { name: "live", value: "live" },
        ],
      },
    ],
  },
  {
    name: "company",
    description: "Get deep-dive intel, strategic direction & counter-plays for a specific rival",
    options: [
      {
        name: "name",
        description: "Company / rival identifier",
        type: 3,
        required: true,
        choices: [
          { name: "roame", value: "roame" },
          { name: "stardrift", value: "stardrift" },
          { name: "pointhound", value: "pointhound" },
          { name: "rove", value: "rove" },
        ],
      },
      {
        name: "mode",
        description: "live Studio pull or example fixture",
        type: 3,
        required: false,
        choices: [
          { name: "example", value: "example" },
          { name: "live", value: "live" },
        ],
      },
    ],
  },
  {
    name: "rivals",
    description: "Show the Monday Diff rival cohort, update URLs, and dedicated channels",
  },
  {
    name: "schema",
    description: "Show the ListingRow + IntelSnapshot JSON contract",
  },
  {
    name: "help",
    description: "What BrandRadar Monday Diff can do in Discord",
  },
];

export async function registerGuildCommands(
  applicationId: string,
  guildId: string,
  commands: SlashCommandDef[] = MONDAY_DIFF_COMMANDS,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const result = await botFetch(
    `/applications/${encodeURIComponent(applicationId)}/guilds/${encodeURIComponent(guildId)}/commands`,
    {
      method: "PUT",
      body: JSON.stringify(commands),
    },
  );
  if (!result.ok) {
    return { ok: false, error: `Register commands ${result.status}: ${result.text.slice(0, 300)}` };
  }
  const count = Array.isArray(result.json) ? result.json.length : commands.length;
  return { ok: true, count };
}
