import { verify } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildHelpEmbed,
  buildIntelEmbeds,
  buildRivalsEmbed,
} from "@/lib/discord-embeds";
import { runIntelPull } from "@/lib/intel-pull";

export const maxDuration = 300;

type InteractionOption = { name: string; type: number; value?: string | number | boolean };
type InteractionData = { name?: string; options?: InteractionOption[] };

function publicKey(): string | null {
  return process.env.DISCORD_PUBLIC_KEY?.trim() || null;
}

function verifyDiscordRequest(
  publicKeyHex: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    return verify(
      null,
      Buffer.from(timestamp + body),
      {
        key: Buffer.from(publicKeyHex, "hex"),
        format: "raw",
        type: "ed25519",
      },
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

function optionValue(data: InteractionData | undefined, name: string): string | undefined {
  const hit = data?.options?.find((opt) => opt.name === name);
  return hit && typeof hit.value === "string" ? hit.value : undefined;
}

async function handleCommand(data: InteractionData | undefined): Promise<unknown> {
  const name = data?.name ?? "";
  if (name === "help") {
    return {
      type: 4,
      data: { embeds: [buildHelpEmbed()] },
    };
  }
  if (name === "rivals") {
    return {
      type: 4,
      data: { embeds: [buildRivalsEmbed()] },
    };
  }
  if (name === "intel") {
    const mode = optionValue(data, "mode") ?? "example";
    const forceMock = mode !== "live";
    const snapshot = await runIntelPull({ forceMock, persist: !forceMock });
    return {
      type: 4,
      data: {
        content: `📅 **Monday Diff** · \`${snapshot.week}\` · ${snapshot.label}`,
        embeds: buildIntelEmbeds(snapshot).slice(0, 10),
      },
    };
  }
  return {
    type: 4,
    data: { content: "Unknown command. Try `/help`." },
  };
}

export async function POST(request: Request) {
  const key = publicKey();
  if (!key) {
    return NextResponse.json(
      { error: "DISCORD_PUBLIC_KEY is not set" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";
  const body = await request.text();

  if (!verifyDiscordRequest(key, signature, timestamp, body)) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body) as {
    type: number;
    data?: InteractionData;
  };

  // PING
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // APPLICATION_COMMAND
  if (interaction.type === 2) {
    try {
      const response = await handleCommand(interaction.data);
      return NextResponse.json(response);
    } catch (error) {
      return NextResponse.json({
        type: 4,
        data: {
          content: `Intel failed: ${error instanceof Error ? error.message : "unknown"}`,
          flags: 64,
        },
      });
    }
  }

  return NextResponse.json({
    type: 4,
    data: { content: "Unsupported interaction type.", flags: 64 },
  });
}
