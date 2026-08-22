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
import {
  attachDiff,
  loadIntelSnapshot,
  loadPreviousIntelSnapshot,
  saveIntelSnapshot,
} from "./intel-store";
import { assessListingExtract } from "./extract-qa";
import { playsFromIntelDiff } from "./intel-plays";
import { isoWeekKey, loadCohortConfig } from "./rivals";

/** Cap Studio inputs — cohort size from config, hard max 5. */
const MAX_INTEL_URLS = 5;

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

export function resolveIntelForceMock(forceMock?: boolean): boolean {
  if (forceMock === true) return true;
  if (forceMock === false) return false;
  return process.env.USE_MOCK !== "false";
}

function expandStudioRows(rows: unknown[]): Record<string, unknown>[] {
  const nestKeys = [
    "guides",
    "posts",
    "articles",
    "items",
    "entries",
    "blogs",
    "updates",
    "results",
  ];
  const byInput = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const inputUrl =
      asString(record.input_url) ||
      (record.input && typeof record.input === "object"
        ? asString((record.input as Record<string, unknown>).url)
        : null) ||
      "__unknown__";
    const list = byInput.get(inputUrl) ?? [];
    list.push(record);
    byInput.set(inputUrl, list);
  }

  const out: Record<string, unknown>[] = [];
  for (const [inputUrl, group] of byInput) {
    let usedNest = false;
    for (const record of group) {
      for (const key of nestKeys) {
        const value = record[key];
        if (!Array.isArray(value) || value.length === 0) continue;
        // One nest per input URL — collectors sometimes repeat the full index on every PDP.
        for (const item of value) {
          if (!item || typeof item !== "object") continue;
          const entry = { ...(item as Record<string, unknown>) };
          if (inputUrl !== "__unknown__") entry.input_url = inputUrl;
          out.push(entry);
        }
        usedNest = true;
        break;
      }
      if (usedNest) break;
    }
    if (usedNest) continue;

    // Flat listing or PDP-only rows: keep unique product/page URLs.
    const seen = new Set<string>();
    for (const record of group) {
      const page =
        asString(record.product_page_url) ||
        asString(record.url) ||
        asString(record.link);
      if (page) {
        if (seen.has(page)) continue;
        seen.add(page);
      }
      const entry = { ...record };
      if (inputUrl !== "__unknown__") entry.input_url = inputUrl;
      if (page && !entry.url) entry.url = page;
      if (!entry.title && page) {
        entry.title = page.split("/").filter(Boolean).pop() ?? page;
      }
      out.push(entry);
      if (out.length >= 200) break;
    }
  }
  return out;
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
  const urls = config.rivals.map((rival) => rival.update_url).slice(0, MAX_INTEL_URLS);
  if (config.rivals.length > MAX_INTEL_URLS) {
    notes.push(`Cost cap: only first ${MAX_INTEL_URLS} rival URLs sent to Studio.`);
  }
  const rawRows = await triggerWithUrls(collectorId, urls);
  const rows = expandStudioRows(rawRows);
  notes.push(`Studio returned ${rawRows.length} payload row(s), ${rows.length} listing entr(y/ies).`);
  const byInput = new Map<string, Record<string, unknown>[]>();

  for (const record of rows) {
    const inputUrl = asString(record.input_url) || "";
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
    const sourceRows = matched.length > 0 ? matched : rows;
    for (const row of sourceRows) {
      const entry = mapStudioRow(row, rival.homepage);
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

function finalizeSnapshot(
  snapshot: IntelSnapshot,
  previous: IntelSnapshot | null,
): IntelSnapshot {
  let next = attachDiff(snapshot, previous);
  next = {
    ...next,
    plays: playsFromIntelDiff(next),
  };
  return next;
}

export async function runIntelPull(input?: {
  forceMock?: boolean;
  persist?: boolean;
  /** When false and a same-week live snapshot exists, skip Studio (cost save). */
  refresh?: boolean;
}): Promise<IntelSnapshot> {
  const config = loadCohortConfig();
  const week = isoWeekKey();
  const forceMock = resolveIntelForceMock(input?.forceMock);
  const persist = input?.persist !== false;
  const refresh = input?.refresh === true;
  let snapshot: IntelSnapshot;
  let fromCache = false;

  if (!forceMock && intelCollectorsReady() && !refresh) {
    const cached = await loadIntelSnapshot(week);
    if (cached && cached.mode === "live") {
      snapshot = {
        ...cached,
        notes: [
          ...cached.notes.filter((n) => !n.startsWith("Week cache hit")),
          `Week cache hit — skipped Studio (set refresh=true to re-scrape).`,
        ],
      };
      fromCache = true;
    }
  }

  if (!fromCache) {
    if (!forceMock && intelCollectorsReady()) {
      try {
        const live = await pullLiveBuckets();
        const flatRows = live.rivals.flatMap((r) => r.entries);
        const allowedHosts = config.rivals.flatMap((rival) => {
          try {
            return [new URL(rival.homepage).hostname.replace(/^www\./, "")];
          } catch {
            return [];
          }
        });
        const assessment = assessListingExtract(flatRows, {
          minRows: 1,
          allowedHosts,
        });
        const emptyRivals = live.rivals.filter((r) => r.entries.length === 0).length;
        const emptyRate = emptyRivals / Math.max(live.rivals.length, 1);
        snapshot = IntelSnapshotSchema.parse({
          cohort: config.cohort,
          label: config.label,
          week,
          pulled_at: new Date().toISOString(),
          rivals: live.rivals,
          diff: [],
          plays: [],
          health: {
            null_rate: assessment.null_rate,
            last_heal: null,
            collector_ids: [live.collectorId],
            broken_fields:
              emptyRate > 0.5
                ? ["entries", ...assessment.broken_fields]
                : assessment.broken_fields,
            qa_flags: [
              ...(emptyRate > 0.5 ? ["empty_cohort"] : []),
              ...assessment.qa_flags,
            ],
            heal_hint:
              emptyRate > 0.5 || !assessment.ok
                ? assessment.heal_hint
                : null,
          },
          mode: "live",
          notes: [
            `Studio collector ${live.collectorId} on ${Math.min(config.rivals.length, MAX_INTEL_URLS)} update URLs.`,
            `QA: ${assessment.status} · valid ${assessment.valid_count}/${assessment.row_count} · null_rate ${assessment.null_rate}`,
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
          forceMock
            ? "Mock intel pull — example snapshot (zero Studio cost)."
            : "Studio not ready — example snapshot. Set COLLECTOR_INTEL_UPDATES.",
          ...example.notes,
        ],
      };
    }
  }

  const previous = await loadPreviousIntelSnapshot(week);
  // Cached snapshots already have diff/plays; recompute cheaply so prior week updates apply.
  snapshot = finalizeSnapshot(snapshot!, previous);

  if (persist && !fromCache) {
    const file = await saveIntelSnapshot(snapshot);
    snapshot.notes.push(`Saved ${file.replace(`${process.cwd()}/`, "")}`);
  } else if (fromCache) {
    snapshot.notes.push("Served from week cache — not re-saved.");
  }

  return snapshot;
}
