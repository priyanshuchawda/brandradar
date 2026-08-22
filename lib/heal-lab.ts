import { HEAL_LAB_BRAND, HEAL_LAB_POSTS, healLabPostUrl } from "./heal-lab-data";
import { hasBrightDataToken, triggerWithUrl } from "./brightdata";
import { isVercelRuntime } from "./runtime-env";
import { extractJsonBlob, isStudioCollectorId, runStudioCli, runStudioHealCli, unlockStuckRefactorJob } from "./studio";

export type HealLabLayout = "before" | "after" | "live";

export type HealLabExtract = {
  title: string;
  url: string;
  published_at: string | null;
  summary: string | null;
};

export function healLabPublicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    return (vercel.startsWith("http") ? vercel : `https://${vercel}`).replace(
      /\/$/,
      "",
    );
  }
  return "https://brandradar-beta.vercel.app";
}

export function healLabUrl(layout: HealLabLayout): string {
  return `${healLabPublicOrigin()}/heal-lab/${layout}`;
}

export function healLabCollectorId(): string | undefined {
  return process.env.COLLECTOR_HEAL_LAB?.trim() || undefined;
}

/** Local / CI fixture — simulates a healthy extract without Studio credits. */
export function fixtureExtract(origin = healLabPublicOrigin()): HealLabExtract[] {
  return HEAL_LAB_POSTS.map((post) => ({
    title: post.title,
    url: healLabPostUrl(origin, post.slug),
    published_at: post.published_at,
    summary: post.summary,
  }));
}

/** Simulate a broken extract after redesign (old selectors miss). */
export function brokenExtract(): HealLabExtract[] {
  return [];
}

export function mapHealLabRows(rows: unknown[]): HealLabExtract[] {
  const out: HealLabExtract[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    // Nested posts/guides arrays
    for (const key of ["posts", "guides", "items", "entries", "updates"]) {
      const nest = r[key];
      if (!Array.isArray(nest)) continue;
      for (const item of nest) {
        if (!item || typeof item !== "object") continue;
        const mapped = mapOne(item as Record<string, unknown>);
        if (mapped) out.push(mapped);
      }
    }
    const flat = mapOne(r);
    if (flat) out.push(flat);
  }
  // Dedupe by url
  const seen = new Set<string>();
  return out.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  }).slice(0, 15);
}

function mapOne(r: Record<string, unknown>): HealLabExtract | null {
  const title =
    str(r.title) || str(r.post_title) || str(r.name) || str(r.heading);
  const url = str(r.url) || str(r.link) || str(r.permalink);
  if (!title || !url) return null;
  return {
    title,
    url,
    published_at: str(r.published_at) || str(r.date),
    summary: str(r.summary) || str(r.description),
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function runHealLabCollector(
  layout: HealLabLayout,
): Promise<{ ok: true; rows: HealLabExtract[]; raw: string } | { ok: false; error: string }> {
  const id = healLabCollectorId();
  if (!id || !isStudioCollectorId(id)) {
    return { ok: false, error: "COLLECTOR_HEAL_LAB is not set" };
  }
  const url = healLabUrl(layout);

  if (isVercelRuntime() && hasBrightDataToken()) {
    try {
      const parsed = await triggerWithUrl(id, url);
      const rows = mapHealLabRows(Array.isArray(parsed) ? parsed : [parsed]);
      return { ok: true, rows, raw: JSON.stringify(parsed).slice(0, 2000) };
    } catch {
      // fall through to bundled bdata CLI
    }
  }

  const result = await runStudioCli("run", [id, url]);
  if (!result.ok) {
    return { ok: false, error: result.output.slice(0, 400) || "Studio run failed" };
  }
  const parsed = extractJsonBlob(result.output);
  if (parsed == null) {
    return { ok: false, error: "Studio run returned non-JSON" };
  }
  const rows = Array.isArray(parsed)
    ? mapHealLabRows(parsed)
    : mapHealLabRows(
        parsed && typeof parsed === "object" && "data" in (parsed as object)
          ? ((parsed as { data: unknown }).data as unknown[])
          : [parsed],
      );
  return { ok: true, rows, raw: result.output.slice(0, 2000) };
}

export const HEAL_LAB_AFTER_HEAL_PROMPT =
  "Driftmark changelog listing broke after redesign (.post-title removed). Extract up to 15 public posts: title, absolute url, published_at, short summary. Prefer [data-test=\"post-title\"], [data-test=\"post-card\"], and link hrefs inside the feed. Listing page only — do not open detail pages.";

export async function unlockHealLabCollector(): Promise<{
  ok: boolean;
  output: string;
  collector_id: string | null;
}> {
  const id = healLabCollectorId();
  if (!id || !isStudioCollectorId(id)) {
    return { ok: false, output: "COLLECTOR_HEAL_LAB is not set", collector_id: null };
  }
  const result = await unlockStuckRefactorJob(id, healLabUrl("after"));
  return { ok: result.ok, output: result.output, collector_id: id };
}

export async function healHealLabCollector(prompt?: string): Promise<{
  ok: boolean;
  output: string;
  collector_id: string | null;
}> {
  const id = healLabCollectorId();
  if (!id || !isStudioCollectorId(id)) {
    return { ok: false, output: "COLLECTOR_HEAL_LAB is not set", collector_id: null };
  }
  const url = healLabUrl("after");
  const text = prompt || HEAL_LAB_AFTER_HEAL_PROMPT;
  const result = await runStudioHealCli([id, url, text], {
    autoApprove: true,
    autoSave: true,
  });
  return { ok: result.ok, output: result.output, collector_id: id };
}

export function healLabDiscordEmbed(input: {
  stage: string;
  collectorId: string | null;
  beforeCount: number;
  afterCount: number;
  layout: string;
}): {
  content: string;
  embeds: Array<Record<string, unknown>>;
} {
  return {
    content: `🩹 **Heal Lab** · ${HEAL_LAB_BRAND.name} · \`${input.stage}\``,
    embeds: [
      {
        title: "Self-heal demo (same Collector ID)",
        description: [
          `Layout: **${input.layout}**`,
          `Collector: \`${input.collectorId ?? "fixture"}\``,
          `Rows before: **${input.beforeCount}** → after: **${input.afterCount}**`,
          "",
          "Page shifted → extract emptied → Studio healed from a plain-language field description → downstream Discord unchanged.",
        ].join("\n"),
        color: input.afterCount > 0 ? 0x5cffb1 : 0xff5d6a,
        fields: [
          {
            name: "Before URL",
            value: healLabUrl("before"),
            inline: false,
          },
          {
            name: "After URL",
            value: healLabUrl("after"),
            inline: false,
          },
        ],
        footer: { text: "BrandRadar · own site · public pages only" },
      },
    ],
  };
}
