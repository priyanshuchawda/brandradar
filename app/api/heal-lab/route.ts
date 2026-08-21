import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SCAN_BODY_LIMIT,
  authorize,
  clientKey,
  enforceOrigin,
  limited,
  readJsonBody,
  withRateHeaders,
} from "@/lib/guard";
import { postEmbedBrief } from "@/lib/discord-api";
import { discordConfigured, discordMode } from "@/lib/discord";
import {
  brokenExtract,
  fixtureExtract,
  healHealLabCollector,
  healLabCollectorId,
  healLabDiscordEmbed,
  healLabUrl,
  runHealLabCollector,
  type HealLabLayout,
} from "@/lib/heal-lab";
import { HEAL_LAB_BRAND } from "@/lib/heal-lab-data";
import { healLimiter } from "@/lib/rate-limit";
import { isStudioCollectorId, runStudioCli } from "@/lib/studio";

export const maxDuration = 300;

const BodySchema = z.object({
  action: z.enum([
    "status",
    "fixture_ok",
    "fixture_broken",
    "run",
    "heal",
    "approve",
    "discord",
  ]),
  layout: z.enum(["before", "after"]).optional(),
  /** Skip Studio — zero credits (local demos). */
  forceMock: z.boolean().optional(),
  rowCountBefore: z.number().int().min(0).optional(),
  rowCountAfter: z.number().int().min(0).optional(),
  prompt: z.string().max(500).optional(),
});

export async function GET() {
  const id = healLabCollectorId() ?? null;
  return NextResponse.json({
    brand: HEAL_LAB_BRAND.name,
    before: healLabUrl("before"),
    after: healLabUrl("after"),
    collector: id,
    ready: Boolean(id && isStudioCollectorId(id)),
    discord: discordConfigured(),
    costHint:
      "Use forceMock/fixture locally. Live Studio run only against the small Heal Lab page (≤5 posts).",
  });
}

export async function POST(request: Request) {
  const originBlock = enforceOrigin(request);
  if (originBlock) return originBlock;
  const authBlock = authorize(request);
  if (authBlock) return authBlock;

  const quota = healLimiter.check(clientKey(request));
  const limitedResponse = limited(quota, "Heal Lab rate limit reached");
  if (limitedResponse) return limitedResponse;

  const body = await readJsonBody(request, SCAN_BODY_LIMIT);
  if (body instanceof NextResponse) return body;
  const parsed = BodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const layout = (parsed.data.layout ?? "before") as HealLabLayout;
  const forceMock = parsed.data.forceMock !== false; // default cheap

  if (parsed.data.action === "fixture_ok") {
    const rows = fixtureExtract();
    return withRateHeaders(
      NextResponse.json({
        status: "ok",
        mode: "fixture",
        layout: "before",
        rows,
        count: rows.length,
        note: "Healthy extract simulation — zero Studio credits.",
      }),
      quota,
    );
  }

  if (parsed.data.action === "fixture_broken") {
    const rows = brokenExtract();
    return withRateHeaders(
      NextResponse.json({
        status: "broken",
        mode: "fixture",
        layout: "after",
        rows,
        count: 0,
        note: "Simulated redesign: old selectors return empty. Heal next.",
      }),
      quota,
    );
  }

  if (parsed.data.action === "run") {
    if (forceMock) {
      const rows = layout === "after" ? brokenExtract() : fixtureExtract();
      return withRateHeaders(
        NextResponse.json({
          status: rows.length ? "ok" : "empty",
          mode: "fixture",
          layout,
          rows,
          count: rows.length,
          url: healLabUrl(layout),
          note:
            layout === "after"
              ? "Fixture: after redesign extract is empty until heal."
              : "Fixture: before redesign extract is healthy.",
        }),
        quota,
      );
    }
    const result = await runHealLabCollector(layout);
    if (!result.ok) {
      return withRateHeaders(
        NextResponse.json({ error: result.error }, { status: 502 }),
        quota,
      );
    }
    return withRateHeaders(
      NextResponse.json({
        status: result.rows.length ? "ok" : "empty",
        mode: "live",
        layout,
        rows: result.rows,
        count: result.rows.length,
        url: healLabUrl(layout),
        collector_id: healLabCollectorId(),
      }),
      quota,
    );
  }

  if (parsed.data.action === "heal") {
    if (forceMock) {
      const rows = fixtureExtract();
      return withRateHeaders(
        NextResponse.json({
          status: "healed",
          mode: "fixture",
          collector_id: healLabCollectorId() ?? "c_fixture_heal_lab",
          same_id: true,
          rows,
          count: rows.length,
          note: "Fixture heal — same Collector ID story, zero credits. Set forceMock:false + COLLECTOR_HEAL_LAB for live bdata heal.",
        }),
        quota,
      );
    }
    const healed = await healHealLabCollector(parsed.data.prompt);
    return withRateHeaders(
      NextResponse.json({
        status: healed.ok ? "healed" : "failed",
        mode: "live",
        collector_id: healed.collector_id,
        same_id: true,
        output: healed.output.slice(0, 2000),
        note: healed.ok
          ? "Approve if required, then run layout=after again."
          : "Heal did not finish — check CLI output.",
      }),
      quota,
    );
  }

  if (parsed.data.action === "approve") {
    const id = healLabCollectorId();
    if (!id) {
      return NextResponse.json({ error: "COLLECTOR_HEAL_LAB missing" }, { status: 503 });
    }
    if (forceMock) {
      return withRateHeaders(
        NextResponse.json({ status: "approved", mode: "fixture", collector_id: id }),
        quota,
      );
    }
    const result = await runStudioCli("approve", [id, healLabUrl("after")]);
    return withRateHeaders(
      NextResponse.json({
        status: result.ok ? "approved" : "failed",
        mode: "live",
        collector_id: id,
        output: result.output.slice(0, 1500),
      }),
      quota,
    );
  }

  if (parsed.data.action === "discord") {
    if (!discordConfigured() || discordMode() !== "bot") {
      return NextResponse.json(
        { error: "Bot Discord required (DISCORD_BOT_TOKEN + CHANNEL_ID)" },
        { status: 503 },
      );
    }
    const channelId = process.env.DISCORD_CHANNEL_ID!.trim();
    const payload = healLabDiscordEmbed({
      stage: "recovery",
      collectorId: healLabCollectorId() ?? "fixture",
      beforeCount: parsed.data.rowCountBefore ?? 0,
      afterCount: parsed.data.rowCountAfter ?? fixtureExtract().length,
      layout: layout,
    });
    const posted = await postEmbedBrief(channelId, payload);
    if (!posted.ok) {
      return NextResponse.json({ error: posted.error }, { status: 502 });
    }
    return withRateHeaders(
      NextResponse.json({ status: "posted", mode: "bot" }),
      quota,
    );
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
