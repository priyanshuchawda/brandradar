import type { DiffChange, IntelPlay, IntelSnapshot } from "./intel-schema";
import { summarizeDiff } from "./intel-diff";

function topAdds(diff: DiffChange[], limit = 6): Array<{ rival: string; title: string; url: string }> {
  const rows: Array<{ rival: string; title: string; url: string; rival_id: string }> = [];
  for (const change of diff) {
    for (const entry of change.added) {
      rows.push({
        rival: change.rival_name,
        rival_id: change.rival_id,
        title: entry.title,
        url: entry.url,
      });
    }
  }
  return rows.slice(0, limit);
}

function topModified(diff: DiffChange[], limit = 3) {
  const rows: Array<{ rival: string; title: string; url: string; fields: string; rival_id: string }> = [];
  for (const change of diff) {
    for (const mod of change.modified) {
      rows.push({
        rival: change.rival_name,
        rival_id: change.rival_id,
        title: mod.after.title,
        url: mod.after.url,
        fields: mod.fields.join(", "),
      });
    }
  }
  return rows.slice(0, limit);
}

export function playsFromIntelDiff(snapshot: Pick<IntelSnapshot, "diff" | "label">): IntelPlay[] {
  const summary = summarizeDiff(snapshot.diff);
  const adds = topAdds(snapshot.diff);
  const mods = topModified(snapshot.diff);
  const plays: IntelPlay[] = [];

  if (adds.length > 0) {
    const lead = adds[0];
    plays.push({
      title: `Attack: respond to ${lead.rival}`,
      evidence: `${lead.rival} published “${lead.title}”${adds.length > 1 ? ` (+${adds.length - 1} more new posts this week)` : ""}.`,
      action: `Read ${lead.url} and decide whether to match the feature, publish a counter-guide, or ignore.`,
      why_it_grows:
        "A rival’s public update is free signal about what customers will search for next week.",
      kind: "attack",
      rival_id: snapshot.diff.find((d) => d.rival_name === lead.rival)?.rival_id ?? null,
    });
  }

  if (mods.length > 0 && plays.length < 3) {
    const lead = mods[0];
    plays.push({
      title: `Watch: ${lead.rival} rewrote a live post`,
      evidence: `“${lead.title}” changed (${lead.fields})${mods.length > 1 ? ` (+${mods.length - 1} more updates)` : ""}.`,
      action: `Compare ${lead.url} to your last snapshot — messaging shifts often precede launches.`,
      why_it_grows: "Same URL with new copy is a soft launch signal competitors miss if they only track new pages.",
      kind: "watch",
      rival_id: lead.rival_id,
    });
  }

  const quiet = snapshot.diff.filter(
    (row) =>
      row.added.length === 0 &&
      row.removed.length === 0 &&
      row.modified.length === 0 &&
      row.unchanged_count > 0,
  );
  if (quiet.length > 0) {
    plays.push({
      title: `Watch: ${quiet[0].rival_name} went quiet`,
      evidence: `${quiet.map((q) => q.rival_name).slice(0, 3).join(", ")} shipped no new public posts this week.`,
      action: "Keep a light watch — silence can mean a private beta or a pause before a launch.",
      why_it_grows:
        "Not every gap needs a reaction. Watching quiet rivals saves focus for real ships.",
      kind: "watch",
      rival_id: quiet[0].rival_id,
    });
  }

  const empty = snapshot.diff.filter(
    (row) =>
      row.added.length === 0 &&
      row.removed.length === 0 &&
      row.modified.length === 0 &&
      row.unchanged_count === 0,
  );
  if (empty.length > 0) {
    plays.push({
      title: `Fill: thin update surface on ${empty[0].rival_name}`,
      evidence: `${empty[0].rival_name} returned no indexed posts — collector miss or they barely publish.`,
      action: "Confirm the update URL, or heal the Studio collector if the layout moved.",
      why_it_grows:
        "A blank rival feed is either an intel gap (fix the scraper) or an opening to own the narrative.",
      kind: "fill",
      rival_id: empty[0].rival_id,
    });
  }

  if (plays.length === 0) {
    plays.push({
      title: `Watch: ${snapshot.label} steady`,
      evidence:
        summary.added === 0 && summary.removed === 0 && summary.modified === 0
          ? "No week-over-week changes in the cohort."
          : `${summary.added} added, ${summary.modified} updated, ${summary.removed} removed across the cohort.`,
      action: "Re-run next Monday. If null rates rise, heal the shared intel collector.",
      why_it_grows: "A calm week is still a signal — consistency beats noise.",
      kind: "watch",
      rival_id: null,
    });
  }

  return plays.slice(0, 3);
}

export function formatIntelDiscordMessage(snapshot: IntelSnapshot): string {
  const vis = snapshot.visibility;
  const lines: string[] = [
    `📅 **Monday Diff — ${snapshot.label}** (\`${snapshot.week}\`)`,
    vis ? `Visibility **${vis.score}/100** · ${vis.summary}` : "",
    "",
  ].filter(Boolean);
  for (const change of snapshot.diff) {
    lines.push(`**${change.rival_name}**`);
    if (
      change.added.length === 0 &&
      change.removed.length === 0 &&
      change.modified.length === 0
    ) {
      lines.push("• no public updates this week");
    }
    for (const entry of change.added.slice(0, 4)) {
      lines.push(`• NEW: ${entry.title}`);
    }
    for (const mod of change.modified.slice(0, 3)) {
      lines.push(`• UPDATED (${mod.fields.join(", ")}): ${mod.after.title}`);
    }
    for (const entry of change.removed.slice(0, 2)) {
      lines.push(`• gone: ${entry.title}`);
    }
    lines.push("");
  }
  if (snapshot.plays.length > 0) {
    lines.push("**Plays**");
    snapshot.plays.forEach((play, index) => {
      lines.push(`${index + 1}. **${play.title}** — ${play.action}`);
    });
  }
  return lines.join("\n").trim();
}
