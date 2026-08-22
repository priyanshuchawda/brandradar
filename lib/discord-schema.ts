/** Human-readable schema docs for Discord #schema and /schema command. */

export const LISTING_ROW_SCHEMA = {
  name: "ListingRow / UpdateEntry",
  fields: [
    { key: "title", type: "string", required: true, note: "Post or product title" },
    { key: "url", type: "string (absolute HTTPS)", required: true, note: "Public page URL" },
    { key: "published_at", type: "string | null", required: false, note: "ISO date if shown on page" },
    { key: "summary", type: "string | null", required: false, note: "Short blurb from listing" },
  ],
};

export const INTEL_SNAPSHOT_SCHEMA = {
  name: "IntelSnapshot (Monday Diff week file)",
  sections: [
    "cohort, label, week (ISO e.g. 2026-W34)",
    "rivals[] — buckets per company with entries[]",
    "diff[] — added / removed / modified vs prior week",
    "plays[] — attack | watch | fill recommendations",
    "visibility — score 0–100 + per-rival health",
    "health — null_rate, qa_flags, collector_ids (c_*)",
  ],
};

export function schemaMarkdownBrief(): string {
  return [
    "**Listing row** (what Studio extracts)",
    "```",
    "{ title, url, published_at, summary }",
    "```",
    "**Monday Diff snapshot** — `data/intel/<week>/snapshot.json`",
    "rivals → entries · diff → added/removed/modified · plays · visibility",
    "**Collectors** — same `c_*` id before & after heal",
  ].join("\n");
}
