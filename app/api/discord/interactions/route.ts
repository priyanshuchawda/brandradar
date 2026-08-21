import { NextResponse } from "next/server";
import { resolveDiscordCommand } from "@/lib/discord-commands";
import { verifyDiscordRequest } from "@/lib/discord-verify";

export const maxDuration = 300;

function publicKey(): string | null {
  return process.env.DISCORD_PUBLIC_KEY?.trim() || null;
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
    data?: { name?: string; options?: Array<{ name: string; type: number; value?: string }> };
  };

  // PING
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // APPLICATION_COMMAND
  if (interaction.type === 2) {
    try {
      const response = await resolveDiscordCommand(interaction.data);
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
