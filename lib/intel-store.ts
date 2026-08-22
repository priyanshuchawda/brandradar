import { diffCohort } from "./intel-diff";
import { IntelSnapshotSchema, type IntelSnapshot, type RivalUpdateBucket } from "./intel-schema";
import { isoWeekKey, loadCohortConfig } from "./rivals";
import { computeVisibilityHealth } from "./visibility-health";
import { jsonStoreBackend, listJsonKeys, readJson, storeWarning, writeJson } from "./json-store";

const INTEL_PREFIX = "intel";

function snapshotKey(week: string): string {
  return `${INTEL_PREFIX}/${week}/snapshot.json`;
}

export async function saveIntelSnapshot(snapshot: IntelSnapshot): Promise<string> {
  const parsed = IntelSnapshotSchema.parse(snapshot);
  const key = snapshotKey(parsed.week);
  const saved = await writeJson(key, parsed);
  const warn = storeWarning();
  return warn ? `${saved.backend}:${key} (${warn})` : `${saved.backend}:${key}`;
}

export async function loadIntelSnapshot(week: string): Promise<IntelSnapshot | null> {
  const raw = await readJson(snapshotKey(week));
  if (raw == null) return null;
  try {
    return IntelSnapshotSchema.parse(raw);
  } catch {
    return null;
  }
}

export async function listIntelWeeks(): Promise<string[]> {
  const keys = await listJsonKeys(`${INTEL_PREFIX}/`);
  const weeks = keys
    .map((key) => {
      const match = key.match(/intel\/(\d{4}-W\d{2})\/snapshot\.json$/);
      return match?.[1] ?? null;
    })
    .filter((w): w is string => Boolean(w));
  return [...new Set(weeks)].sort();
}

export function intelStorageInfo(): { backend: string; warning: string | null } {
  return { backend: jsonStoreBackend(), warning: storeWarning() };
}

export async function loadPreviousIntelSnapshot(
  week: string = isoWeekKey(),
): Promise<IntelSnapshot | null> {
  const weeks = await listIntelWeeks();
  const earlier = weeks.filter((w) => w < week);
  if (earlier.length === 0) return null;
  return loadIntelSnapshot(earlier[earlier.length - 1]);
}

export function attachDiff(
  current: IntelSnapshot,
  previous: IntelSnapshot | null,
): IntelSnapshot {
  const diff = diffCohort(previous?.rivals ?? [], current.rivals);
  const notes = [...current.notes];
  if (!previous) {
    notes.push("No prior week snapshot — diff is empty (baseline).");
  } else {
    notes.push(`Diff against ${previous.week}.`);
  }
  const withDiff = IntelSnapshotSchema.parse({
    ...current,
    diff,
    notes,
  });
  return IntelSnapshotSchema.parse({
    ...withDiff,
    visibility: computeVisibilityHealth(withDiff),
  });
}

export function emptyBucketsFromConfig(
  scrapedAt: string = new Date().toISOString(),
): RivalUpdateBucket[] {
  const config = loadCohortConfig();
  return config.rivals.map((rival) => ({
    rival_id: rival.id,
    rival_name: rival.name,
    update_url: rival.update_url,
    surface: rival.surface,
    entries: [],
    collector_id: null,
    scraped_at: scrapedAt,
  }));
}
