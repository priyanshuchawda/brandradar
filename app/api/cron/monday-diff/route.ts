import { NextResponse } from "next/server";
import { postIntelToDiscord, discordConfigured } from "@/lib/discord";
import { runIntelPull } from "@/lib/intel-pull";

export const maxDuration = 300;

/**
 * Monday Diff cron: one Studio pull (or week cache) → Discord.
 * Auth: Authorization: Bearer $CRON_SECRET or ?secret=
 * Retries are cheap: same ISO week hits cache unless refresh=1.
 */
export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}

async function runCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  const ok =
    auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!discordConfigured()) {
    return NextResponse.json({ error: "Discord not configured" }, { status: 503 });
  }

  const refresh = url.searchParams.get("refresh") === "1";
  const snapshot = await runIntelPull({
    forceMock: false,
    persist: true,
    refresh,
  });
  const posted = await postIntelToDiscord(snapshot);
  if (!posted.ok) {
    return NextResponse.json(
      { error: posted.error, week: snapshot.week, mode: snapshot.mode },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: "ok",
    week: snapshot.week,
    intel_mode: snapshot.mode,
    discord_mode: posted.mode,
    plays: snapshot.plays.length,
    cached: snapshot.notes.some((n) => n.includes("Week cache hit")),
    refresh,
  });
}
