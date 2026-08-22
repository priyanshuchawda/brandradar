import type { DiffChange, IntelSnapshot, VisibilityHealth } from "./intel-schema";
import { summarizeDiff } from "./intel-diff";

export type RivalVisibility = VisibilityHealth["per_rival"][number];

function rivalStatus(bucket: IntelSnapshot["rivals"][number]): "healthy" | "empty" | "degraded" {
  if (bucket.entries.length === 0) return "empty";
  const nullish = bucket.entries.filter(
    (e) => !e.title?.trim() || !e.url?.trim(),
  ).length;
  if (nullish > 0) return "degraded";
  return "healthy";
}

export function computeVisibilityHealth(snapshot: IntelSnapshot): VisibilityHealth {
  const diffById = new Map(snapshot.diff.map((d) => [d.rival_id, d]));
  const per_rival: RivalVisibility[] = snapshot.rivals.map((bucket) => {
    const change = diffById.get(bucket.rival_id);
    return {
      rival_id: bucket.rival_id,
      rival_name: bucket.rival_name,
      entry_count: bucket.entries.length,
      status: rivalStatus(bucket),
      new_this_week: change?.added.length ?? 0,
      modified_this_week: change?.modified?.length ?? 0,
      removed_this_week: change?.removed.length ?? 0,
    };
  });

  const rivals_tracked = per_rival.length;
  const rivals_healthy = per_rival.filter((r) => r.status === "healthy").length;
  const summaryDiff = summarizeDiff(snapshot.diff);
  const emptyRate =
    rivals_tracked === 0
      ? 1
      : per_rival.filter((r) => r.status === "empty").length / rivals_tracked;

  let score = 100;
  score -= Math.round(emptyRate * 50);
  score -= Math.min(30, snapshot.health.qa_flags.length * 8);
  score -= snapshot.health.null_rate > 0.45 ? 20 : 0;
  score = Math.max(0, Math.min(100, score));

  const heal_recommended =
    snapshot.health.qa_flags.length > 0 ||
    Boolean(snapshot.health.heal_hint) ||
    emptyRate >= 0.5;

  let status: VisibilityHealth["status"] = "healthy";
  if (emptyRate >= 0.5 || score < 40) status = "critical";
  else if (heal_recommended || score < 75) status = "degraded";

  const summary =
    status === "healthy"
      ? `${rivals_healthy}/${rivals_tracked} rivals tracked · ${summaryDiff.added} new · ${summaryDiff.modified} updated`
      : status === "critical"
        ? `Competitive visibility critical — ${per_rival.filter((r) => r.status === "empty").length} rival(s) returned no rows`
        : `Visibility degraded — check QA flags or heal the intel collector`;

  return {
    score,
    status,
    rivals_tracked,
    rivals_healthy,
    total_entries: per_rival.reduce((n, r) => n + r.entry_count, 0),
    new_this_week: summaryDiff.added,
    modified_this_week: summaryDiff.modified,
    removed_this_week: summaryDiff.removed,
    per_rival,
    heal_recommended,
    summary,
  };
}

export function diffChangeHasSignal(change: DiffChange): boolean {
  return (
    change.added.length > 0 ||
    change.removed.length > 0 ||
    change.modified.length > 0
  );
}
