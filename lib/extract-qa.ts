/** Listing-row contract used by Monday Diff + Heal Lab. */
export type ListingRow = {
  title: string;
  url: string;
  published_at?: string | null;
  summary?: string | null;
};

export type ExtractAssessment = {
  ok: boolean;
  status: "healthy" | "empty" | "degraded";
  row_count: number;
  valid_count: number;
  null_rate: number;
  broken_fields: string[];
  qa_flags: string[];
  heal_hint: string;
  previous_count: number | null;
};

const LISTING_HEAL_BASE =
  "Public listing page only (blog/guides/changelog). Extract up to 15 posts: title, absolute url, published_at if shown, short summary. Do not open detail/PDP pages. Prefer semantic headings and anchors; use data-test attributes when present.";

/**
 * Validate listing extract against the contract.
 * optional previousCount enables collapse detection (e.g. 12 → 0).
 */
export function assessListingExtract(
  rows: ListingRow[],
  options?: { previousCount?: number | null; minRows?: number },
): ExtractAssessment {
  const minRows = options?.minRows ?? 1;
  const previousCount =
    typeof options?.previousCount === "number" ? options.previousCount : null;

  const broken = new Set<string>();
  let nullish = 0;
  let checks = 0;
  let valid = 0;

  for (const row of rows) {
    checks += 4;
    const titleOk = Boolean(row.title?.trim());
    const urlOk = Boolean(row.url?.trim() && /^https?:\/\//i.test(row.url));
    if (!titleOk) {
      broken.add("title");
      nullish += 1;
    }
    if (!urlOk) {
      broken.add("url");
      nullish += 1;
    }
    if (row.published_at == null || String(row.published_at).trim() === "") {
      nullish += 1;
    }
    if (row.summary == null || String(row.summary).trim() === "") {
      nullish += 1;
    }
    if (titleOk && urlOk) valid += 1;
  }

  const null_rate = checks === 0 ? 1 : nullish / checks;
  const qa_flags: string[] = [];

  if (rows.length === 0) qa_flags.push("empty_extract");
  if (valid < minRows) qa_flags.push("below_min_rows");
  if (null_rate > 0.45) qa_flags.push("high_null_rate");
  if (
    previousCount !== null &&
    previousCount >= 3 &&
    valid <= Math.max(0, Math.floor(previousCount * 0.25))
  ) {
    qa_flags.push("row_collapse");
  }

  let status: ExtractAssessment["status"] = "healthy";
  if (rows.length === 0 || valid === 0) status = "empty";
  else if (qa_flags.length > 0 || broken.size > 0) status = "degraded";

  const ok = status === "healthy";

  const heal_hint = [
    LISTING_HEAL_BASE,
    broken.size > 0 ? `Broken fields: ${[...broken].join(", ")}.` : null,
    qa_flags.includes("empty_extract")
      ? "Extraction returned nothing after a likely markup change."
      : null,
    qa_flags.includes("row_collapse")
      ? `Row count collapsed (was ${previousCount}, now ${valid}).`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok,
    status,
    row_count: rows.length,
    valid_count: valid,
    null_rate: Number(null_rate.toFixed(3)),
    broken_fields: [...broken],
    qa_flags,
    heal_hint,
    previous_count: previousCount,
  };
}

export function defaultListingHealPrompt(assessment?: ExtractAssessment): string {
  return assessment?.heal_hint || LISTING_HEAL_BASE;
}
