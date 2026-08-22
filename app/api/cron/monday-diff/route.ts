import { NextResponse } from "next/server";
import { postIntelToDiscord, discordConfigured, discordMode } from "@/lib/discord";
import { postEmbedBrief } from "@/lib/discord-api";
import { runIntelPull } from "@/lib/intel-pull";
import { healStatusDiscordEmbed } from "@/lib/heal-engine";
import { intelUpdatesCollectorId } from "@/lib/brightdata";

export const maxDuration = 300;

/**
 * Monday Diff cron: one Studio pull (or week cache) → Discord.
 * Auth: Authorization: Bearer $CRON_SECRET or ?secret=
 * Retries are cheap: same ISO week hits cache unless refresh=1.
 * If extract QA fails, posts a broken alert (no auto-heal — cost gate).
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

  let healthAlert: unknown = null;
  const broken =
    snapshot.health.qa_flags.length > 0 ||
    snapshot.health.broken_fields.length > 0 ||
    Boolean(snapshot.health.heal_hint);
  if (broken && discordMode() === "bot" && process.env.DISCORD_CHANNEL_ID) {
    const collectorId =
      snapshot.health.collector_ids[0] || intelUpdatesCollectorId() || "unknown";
    const anchor =
      snapshot.rivals.find((r) => r.update_url)?.update_url || "n/a";
    const rowCount = snapshot.rivals.reduce((n, r) => n + r.entries.length, 0);
    const payload = healStatusDiscordEmbed({
      stage: "broken",
      collectorId,
      url: anchor,
      beforeCount: rowCount,
      afterCount: rowCount,
      stages: [
        `qa_flags:${snapshot.health.qa_flags.join(",") || "none"}`,
        `null_rate:${snapshot.health.null_rate}`,
      ],
    });
    const alert = await postEmbedBrief(
      process.env.DISCORD_CHANNEL_ID.trim(),
      payload,
    );
    healthAlert = alert.ok
      ? { status: "broken_alert_posted" }
      : { error: alert.error };
  }

  return NextResponse.json({
    status: "ok",
    week: snapshot.week,
    intel_mode: snapshot.mode,
    discord_mode: posted.mode,
    plays: snapshot.plays.length,
    cached: snapshot.notes.some((n) => n.includes("Week cache hit")),
    refresh,
    health: {
      null_rate: snapshot.health.null_rate,
      qa_flags: snapshot.health.qa_flags,
      broken_fields: snapshot.health.broken_fields,
    },
    healthAlert,
  });
}
