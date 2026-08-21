import type { DiffChange, RivalUpdateBucket, UpdateEntry } from "./intel-schema";

function entryKey(entry: UpdateEntry): string {
  try {
    const url = new URL(entry.url);
    return `${url.origin}${url.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return entry.url.trim().toLowerCase();
  }
}

function indexEntries(entries: UpdateEntry[]): Map<string, UpdateEntry> {
  const map = new Map<string, UpdateEntry>();
  for (const entry of entries) {
    map.set(entryKey(entry), entry);
  }
  return map;
}

export function diffRivalBuckets(
  previous: RivalUpdateBucket | undefined,
  current: RivalUpdateBucket,
): DiffChange {
  const before = indexEntries(previous?.entries ?? []);
  const after = indexEntries(current.entries);
  const added: UpdateEntry[] = [];
  const removed: UpdateEntry[] = [];
  let unchanged = 0;

  for (const [key, entry] of after) {
    if (before.has(key)) unchanged += 1;
    else added.push(entry);
  }
  for (const [key, entry] of before) {
    if (!after.has(key)) removed.push(entry);
  }

  return {
    rival_id: current.rival_id,
    rival_name: current.rival_name,
    added,
    removed,
    unchanged_count: unchanged,
  };
}

export function diffCohort(
  previousRivals: RivalUpdateBucket[],
  currentRivals: RivalUpdateBucket[],
): DiffChange[] {
  const prevById = new Map(previousRivals.map((bucket) => [bucket.rival_id, bucket]));
  return currentRivals.map((current) =>
    diffRivalBuckets(prevById.get(current.rival_id), current),
  );
}

export function summarizeDiff(diff: DiffChange[]): {
  added: number;
  removed: number;
  rivals_with_changes: number;
} {
  let added = 0;
  let removed = 0;
  let rivals_with_changes = 0;
  for (const row of diff) {
    added += row.added.length;
    removed += row.removed.length;
    if (row.added.length > 0 || row.removed.length > 0) rivals_with_changes += 1;
  }
  return { added, removed, rivals_with_changes };
}
