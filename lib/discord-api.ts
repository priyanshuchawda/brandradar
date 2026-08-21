const API = "https://discord.com/api/v10";

function botToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return token;
}

async function botFetch(
  path: string,
  init?: RequestInit,
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
  return { ok: response.ok, status: response.status, json, text };
}

export async function postEmbedBrief(
  channelId: string,
  payload: { content?: string; embeds: unknown[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await botFetch(`/channels/${encodeURIComponent(channelId)}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    return { ok: false, error: `Bot API ${result.status}: ${result.text.slice(0, 200)}` };
  }
  return { ok: true };
}

export async function manageGuildChannel(
  guildId: string,
  name: string,
): Promise<{ ok: true; channelId?: string; name?: string } | { ok: false; error: string }> {
  const result = await botFetch(`/guilds/${encodeURIComponent(guildId)}/channels`);
  if (!result.ok) {
    return { ok: false, error: `List channels ${result.status}: ${result.text.slice(0, 200)}` };
  }
  const channels = Array.isArray(result.json) ? result.json : [];
  const match = channels.find(
    (row) =>
      row &&
      typeof row === "object" &&
      "name" in row &&
      String((row as { name: unknown }).name) === name &&
      "id" in row,
  ) as { id: string; name: string } | undefined;
  if (match) return { ok: true, channelId: match.id, name: match.name };
  return { ok: true };
}

export async function createChannel(
  guildId: string,
  input: { name: string; topic?: string; type?: number },
): Promise<{ ok: true; channelId: string } | { ok: false; error: string }> {
  const result = await botFetch(`/guilds/${encodeURIComponent(guildId)}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? 0,
      topic: input.topic,
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
    name: "rivals",
    description: "Show the Monday Diff rival cohort and update URLs",
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
