import type { DiffChange, ModifiedEntry, RivalUpdateBucket, UpdateEntry } from "./intel-schema";

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

function normText(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function detectModified(before: UpdateEntry, after: UpdateEntry): ModifiedEntry | null {
  const fields: ModifiedEntry["fields"] = [];
  if (normText(before.title) !== normText(after.title)) fields.push("title");
  if (normText(before.summary) !== normText(after.summary)) fields.push("summary");
  if (normText(before.published_at) !== normText(after.published_at)) {
    fields.push("published_at");
  }
  if (fields.length === 0) return null;
  return { before, after, fields };
}

export function diffRivalBuckets(
  previous: RivalUpdateBucket | undefined,
  current: RivalUpdateBucket,
): DiffChange {
  const before = indexEntries(previous?.entries ?? []);
  const after = indexEntries(current.entries);
  const added: UpdateEntry[] = [];
  const removed: UpdateEntry[] = [];
  const modified: ModifiedEntry[] = [];
  let unchanged = 0;

  for (const [key, entry] of after) {
    const prev = before.get(key);
    if (!prev) {
      added.push(entry);
      continue;
    }
    const change = detectModified(prev, entry);
    if (change) modified.push(change);
    else unchanged += 1;
  }
  for (const [key, entry] of before) {
    if (!after.has(key)) removed.push(entry);
  }

  return {
    rival_id: current.rival_id,
    rival_name: current.rival_name,
    added,
    removed,
    modified,
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
  modified: number;
  rivals_with_changes: number;
} {
  let added = 0;
  let removed = 0;
  let modified = 0;
  let rivals_with_changes = 0;
  for (const row of diff) {
    added += row.added.length;
    removed += row.removed.length;
    modified += (row.modified ?? []).length;
    if (
      row.added.length > 0 ||
      row.removed.length > 0 ||
      (row.modified ?? []).length > 0
    ) {
      rivals_with_changes += 1;
    }
  }
  return { added, removed, modified, rivals_with_changes };
}
