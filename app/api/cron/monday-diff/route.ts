import { NextResponse } from "next/server";
import { postIntelToDiscord, discordConfigured, discordMode } from "@/lib/discord";
import { postEmbedBrief } from "@/lib/discord-api";
import { runIntelPull } from "@/lib/intel-pull";
import {
  healStatusDiscordEmbed,
  runIntelAutoHeal,
  snapshotLooksBroken,
  intelCollectorId,
  intelHealAnchor,
} from "@/lib/intel-auto-heal";
import { intelUpdatesCollectorId } from "@/lib/brightdata";
import { healRuntimeBudget } from "@/lib/runtime-env";

export const maxDuration = 300;

/**
 * Monday Diff cron: one Studio pull (or week cache) → Discord.
 * Auth: Authorization: Bearer $CRON_SECRET or ?secret=
 * ?auto_heal=1 — opt-in one heal loop when QA fails (cost gate; Vercel-safe budget).
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
  const autoHealParam = url.searchParams.get("auto_heal");
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
  let autoHealResult: unknown = null;
  const broken = snapshotLooksBroken(snapshot);
  const autoHealEnabled = process.env.INTEL_AUTO_HEAL_ON_CRON?.trim() !== "false";
  const autoHeal =
    autoHealParam === "1" ||
    (autoHealParam !== "0" && autoHealEnabled && broken && snapshot.mode === "live");

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

  if (autoHeal && snapshot.mode === "live") {
    try {
      const loop = await runIntelAutoHeal({ snapshot, useGemini: false });
      autoHealResult = {
        status: loop.healed ? "recovered" : "still_broken",
        heal_attempts: loop.heal_attempts,
        after_count: loop.after?.valid_count ?? 0,
        stages: loop.stages,
        budget: healRuntimeBudget(),
      };
      if (discordMode() === "bot" && process.env.DISCORD_CHANNEL_ID) {
        const payload = healStatusDiscordEmbed({
          stage: loop.healed ? "recovered" : "still_broken",
          collectorId: intelCollectorId(snapshot),
          url: intelHealAnchor(snapshot),
          beforeCount: loop.before.valid_count,
          afterCount: loop.after?.valid_count ?? 0,
          stages: loop.stages,
        });
        await postEmbedBrief(process.env.DISCORD_CHANNEL_ID.trim(), payload);
      }
    } catch (error) {
      autoHealResult = {
        status: "error",
        error: error instanceof Error ? error.message : "auto_heal failed",
      };
    }
  }

  return NextResponse.json({
    status: "ok",
    week: snapshot.week,
    intel_mode: snapshot.mode,
    discord_mode: posted.mode,
    plays: snapshot.plays.length,
    cached: snapshot.notes.some((n) => n.includes("Week cache hit")),
    refresh,
    auto_heal: autoHeal,
    health: {
      null_rate: snapshot.health.null_rate,
      qa_flags: snapshot.health.qa_flags,
      broken_fields: snapshot.health.broken_fields,
      broken,
    },
    healthAlert,
    autoHealResult,
  });
}
