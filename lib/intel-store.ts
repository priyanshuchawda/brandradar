import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  IntelSnapshotSchema,
  type IntelSnapshot,
  type RivalUpdateBucket,
} from "./intel-schema";
import { diffCohort } from "./intel-diff";
import { isoWeekKey, loadCohortConfig } from "./rivals";

const INTEL_ROOT = path.join(process.cwd(), "data", "intel");

function weekDir(week: string): string {
  return path.join(INTEL_ROOT, week);
}

function snapshotPath(week: string): string {
  return path.join(weekDir(week), "snapshot.json");
}

export async function saveIntelSnapshot(snapshot: IntelSnapshot): Promise<string> {
  const parsed = IntelSnapshotSchema.parse(snapshot);
  const dir = weekDir(parsed.week);
  await mkdir(dir, { recursive: true });
  const file = snapshotPath(parsed.week);
  await writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  return file;
}

export async function loadIntelSnapshot(week: string): Promise<IntelSnapshot | null> {
  try {
    const raw = await readFile(snapshotPath(week), "utf8");
    return IntelSnapshotSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function listIntelWeeks(): Promise<string[]> {
  try {
    const names = await readdir(INTEL_ROOT);
    return names
      .filter((name) => /^\d{4}-W\d{2}$/.test(name))
      .sort();
  } catch {
    return [];
  }
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
  return IntelSnapshotSchema.parse({
    ...current,
    diff,
    notes,
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
