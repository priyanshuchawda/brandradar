import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  intelCollectorsReady,
  intelUpdatesCollectorId,
  triggerWithUrls,
} from "./brightdata";
import { asString } from "./map-item";
import {
  IntelSnapshotSchema,
  UpdateEntrySchema,
  type IntelSnapshot,
  type RivalUpdateBucket,
  type UpdateEntry,
} from "./intel-schema";
import { attachDiff, loadPreviousIntelSnapshot, saveIntelSnapshot } from "./intel-store";
import { playsFromIntelDiff } from "./intel-plays";
import { isoWeekKey, loadCohortConfig } from "./rivals";

function mapStudioRow(row: Record<string, unknown>, fallbackOrigin: string): UpdateEntry | null {
  const title =
    asString(row.title) ||
    asString(row.name) ||
    asString(row.heading) ||
    asString(row.post_title);
  let url =
    asString(row.url) ||
    asString(row.link) ||
    asString(row.permalink) ||
    asString(row.product_url);
  if (!title) return null;
  if (url && url.startsWith("/")) {
    try {
      url = new URL(url, fallbackOrigin).toString();
    } catch {
      url = null;
    }
  }
  if (!url) return null;
  const published =
    asString(row.published_at) ||
    asString(row.date) ||
    asString(row.published) ||
    asString(row.created_at);
  const summary =
    asString(row.summary) ||
    asString(row.description) ||
    asString(row.excerpt);
  const parsed = UpdateEntrySchema.safeParse({
    title,
    url,
    published_at: published,
    summary,
  });
  return parsed.success ? parsed.data : null;
}

async function loadExampleSnapshot(): Promise<IntelSnapshot> {
  const file = path.join(process.cwd(), "examples", "intel-snapshot.json");
  const raw = JSON.parse(await readFile(file, "utf8"));
  return IntelSnapshotSchema.parse(raw);
}

async function pullLiveBuckets(): Promise<{
  rivals: RivalUpdateBucket[];
  collectorId: string;
  notes: string[];
}> {
  const collectorId = intelUpdatesCollectorId();
  if (!collectorId) throw new Error("COLLECTOR_INTEL_UPDATES is not set");

  const config = loadCohortConfig();
  const notes: string[] = [];
  const scrapedAt = new Date().toISOString();
  const rows = await triggerWithUrls(
    collectorId,
    config.rivals.map((rival) => rival.update_url),
  );
  const byInput = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const inputUrl =
      asString(record.input_url) ||
      (record.input && typeof record.input === "object"
        ? asString((record.input as Record<string, unknown>).url)
        : null) ||
      "";
    const key = inputUrl || "__unknown__";
    const list = byInput.get(key) ?? [];
    list.push(record);
    byInput.set(key, list);
  }

  const rivals: RivalUpdateBucket[] = config.rivals.map((rival) => {
    const matched =
      byInput.get(rival.update_url) ||
      byInput.get(rival.update_url.replace(/\/$/, "")) ||
      [];
    const entries: UpdateEntry[] = [];
    const sourceRows = matched.length > 0 ? matched : (rows as Record<string, unknown>[]);
    for (const row of sourceRows) {
      if (!row || typeof row !== "object") continue;
      const entry = mapStudioRow(row as Record<string, unknown>, rival.homepage);
      if (!entry) continue;
      try {
        const host = new URL(entry.url).hostname.replace(/^www\./, "");
        const rivalHost = new URL(rival.homepage).hostname.replace(/^www\./, "");
        if (matched.length === 0 && !host.includes(rivalHost.split(".")[0] ?? "")) {
          continue;
        }
      } catch {
        continue;
      }
      if (entries.some((e) => e.url === entry.url)) continue;
      entries.push(entry);
      if (entries.length >= 15) break;
    }
    notes.push(`${rival.name}: ${entries.length} update rows.`);
    return {
      rival_id: rival.id,
      rival_name: rival.name,
      update_url: rival.update_url,
      surface: rival.surface,
      entries,
      collector_id: collectorId,
      scraped_at: scrapedAt,
    };
  });

  return { rivals, collectorId, notes };
}

export async function runIntelPull(input?: {
  forceMock?: boolean;
  persist?: boolean;
}): Promise<IntelSnapshot> {
  const config = loadCohortConfig();
  const week = isoWeekKey();
  const forceMock = input?.forceMock === true || process.env.USE_MOCK !== "false";
  const persist = input?.persist !== false;
  let snapshot: IntelSnapshot;

  if (!forceMock && intelCollectorsReady()) {
    try {
      const live = await pullLiveBuckets();
      snapshot = IntelSnapshotSchema.parse({
        cohort: config.cohort,
        label: config.label,
        week,
        pulled_at: new Date().toISOString(),
        rivals: live.rivals,
        diff: [],
        plays: [],
        health: {
          null_rate: 0,
          last_heal: null,
          collector_ids: [live.collectorId],
          broken_fields: [],
          qa_flags: [],
          heal_hint: null,
        },
        mode: "live",
        notes: [
          `Studio collector ${live.collectorId} on ${config.rivals.length} update URLs.`,
          ...live.notes,
        ],
      });
    } catch (error) {
      const example = await loadExampleSnapshot();
      snapshot = {
        ...example,
        week,
        pulled_at: new Date().toISOString(),
        mode: "mock",
        notes: [
          `Live intel pull failed: ${error instanceof Error ? error.message : "unknown"}. Using example fixture.`,
          ...example.notes,
        ],
      };
    }
  } else {
    const example = await loadExampleSnapshot();
    snapshot = {
      ...example,
      week,
      pulled_at: new Date().toISOString(),
      mode: "mock",
      notes: [
        forceMock || process.env.USE_MOCK !== "false"
          ? "Mock intel pull — example snapshot (set USE_MOCK=false and COLLECTOR_INTEL_UPDATES for Studio)."
          : "Studio not ready — example snapshot.",
        ...example.notes,
      ],
    };
  }

  const previous = await loadPreviousIntelSnapshot(week);
  snapshot = attachDiff(snapshot, previous);
  snapshot = {
    ...snapshot,
    plays: playsFromIntelDiff(snapshot),
  };

  if (persist) {
    const file = await saveIntelSnapshot(snapshot);
    snapshot.notes.push(`Saved ${file.replace(`${process.cwd()}/`, "")}`);
  }

  return snapshot;
}
