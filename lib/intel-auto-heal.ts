import { intelUpdatesCollectorId } from "./brightdata";
import { runHealAndVerify, healStatusDiscordEmbed, type HealLoopResult } from "./heal-engine";
import type { ListingRow } from "./extract-qa";
import type { IntelSnapshot } from "./intel-schema";
import { runIntelPull } from "./intel-pull";
import { loadCohortConfig } from "./rivals";
import { isStudioCollectorId } from "./studio";
import { assertPublicHttpsUrl } from "./urls";
import type { HealRuntimeBudget } from "./runtime-env";

const DEFAULT_INTEL_HEAL_PROMPT =
  "Update listing extract for public blog/guides rows: title, absolute url, published_at if shown, short summary. Keep the same collector id. Listing pages only — do not open PDPs.";

export function intelHealAnchor(snapshot?: IntelSnapshot): string {
  const config = loadCohortConfig();
  const anchor =
    snapshot?.rivals.find((r) => r.update_url)?.update_url ||
    config.rivals[0]?.update_url;
  if (!anchor) throw new Error("No update_url for intel heal anchor");
  return assertPublicHttpsUrl(anchor, "heal url");
}

export function intelCollectorId(snapshot?: IntelSnapshot): string {
  const id =
    snapshot?.health.collector_ids.find(isStudioCollectorId) ||
    intelUpdatesCollectorId();
  if (!id || !isStudioCollectorId(id)) {
    throw new Error("No live COLLECTOR_INTEL_UPDATES id to heal");
  }
  return id;
}

export function intelRowsFromSnapshot(snapshot: IntelSnapshot): ListingRow[] {
  return snapshot.rivals.flatMap((r) =>
    r.entries.map((e) => ({
      title: e.title,
      url: e.url,
      published_at: e.published_at,
      summary: e.summary,
    })),
  );
}

export function snapshotLooksBroken(snapshot: IntelSnapshot): boolean {
  return (
    snapshot.health.qa_flags.length > 0 ||
    snapshot.health.broken_fields.length > 0 ||
    Boolean(snapshot.health.heal_hint) ||
    snapshot.health.null_rate > 0.45
  );
}

/** Shared Monday Diff auto-heal (cron opt-in + /api/intel/heal auto_loop). */
export async function runIntelAutoHeal(input: {
  snapshot?: IntelSnapshot;
  forceMock?: boolean;
  userPrompt?: string;
  useGemini?: boolean;
  budget?: Partial<HealRuntimeBudget>;
}): Promise<HealLoopResult & { anchor: string }> {
  const forceMock = input.forceMock === true;
  const prior =
    input.snapshot ??
    (await runIntelPull({
      forceMock,
      persist: false,
      refresh: !forceMock,
    }));
  const collectorId = intelCollectorId(prior);
  const url = intelHealAnchor(prior);
  const brokenRows = intelRowsFromSnapshot(prior);
  const previousCount = prior.rivals.reduce((n, r) => n + r.entries.length, 0);

  const loop = await runHealAndVerify({
    collectorId,
    url,
    surface: "intel",
    brokenRows,
    previousCount: previousCount || null,
    skipStudio: forceMock,
    mode: forceMock ? "fixture" : "live",
    userPrompt: input.userPrompt || prior.health.heal_hint || DEFAULT_INTEL_HEAL_PROMPT,
    useGemini: input.useGemini === true,
    budget: input.budget,
    rerun: async () => {
      const next = await runIntelPull({
        forceMock,
        persist: !forceMock,
        refresh: !forceMock,
      });
      return intelRowsFromSnapshot(next);
    },
  });

  return { ...loop, anchor: url };
}

export { healStatusDiscordEmbed };
