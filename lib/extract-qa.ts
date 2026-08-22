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
  "Public listing page only (blog/guides/changelog). Extract up to 15 posts: title, absolute url, published_at if shown, short summary. Prefer JSON-LD BlogPosting/Article if present, then data-* / data-test / data-dm attrs, then headings+anchors; avoid brittle class names. Titles may sit inside buttons/CTAs — take the link text + href. Do not open detail/PDP pages.";

const JUNK_TITLE_EXACT =
  /^(subscribe|share|sign up|signup|load more|next|previous|read more|menu|home|start free|open app|jump to updates)$/i;

/** Nav/CTA noise that looks like a row but isn't a post title. */
export function isJunkListingTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 4) return true;
  if (JUNK_TITLE_EXACT.test(t)) return true;
  if (/^click here$/i.test(t)) return true;
  return false;
}

export type RetightenReason = "preview_weak" | "run_empty" | "heal_failed";

/** Second-pass heal prompt when first attempt didn't verify (OSS + BD pattern). */
export function retightenHealPrompt(base: string, reason: RetightenReason): string {
  const hints: Record<RetightenReason, string> = {
    preview_weak:
      "First pass had no preview titles. Target listing cards only: one row per post with title+absolute url. Prefer data-dm/data-test attrs and link text inside CTAs.",
    run_empty:
      "Preview looked OK but Collection run was empty — ensure template is saved and reads visible listing DOM without navigation. Extract title from headline span and href from post link.",
    heal_failed:
      "Heal did not finish. Narrow to section/article cards on the listing page; skip nav buttons (Share, Subscribe).",
  };
  return `${base.trim()} ${hints[reason]}`.trim().slice(0, 500);
}

/**
 * Validate listing extract against the contract.
 * optional previousCount enables collapse detection (e.g. 12 → 0).
 */
export function assessListingExtract(
  rows: ListingRow[],
  options?: {
    previousCount?: number | null;
    minRows?: number;
    /** If set, flag urls whose host doesn't match any allowed host substring. */
    allowedHosts?: string[];
  },
): ExtractAssessment {
  const minRows = options?.minRows ?? 1;
  const previousCount =
    typeof options?.previousCount === "number" ? options.previousCount : null;
  const allowedHosts = options?.allowedHosts?.map((h) => h.replace(/^www\./, "")) ?? [];

  const broken = new Set<string>();
  let nullish = 0;
  let checks = 0;
  let valid = 0;
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  let junkTitles = 0;
  let offHostUrls = 0;
  let duplicateUrls = 0;
  let duplicateTitles = 0;

  for (const row of rows) {
    checks += 4;
    const titleRaw = row.title?.trim() ?? "";
    const titleOk = Boolean(titleRaw) && !isJunkListingTitle(titleRaw);
    const urlRaw = row.url?.trim() ?? "";
    const urlOk = Boolean(urlRaw && /^https?:\/\//i.test(urlRaw));

    if (!titleRaw) {
      broken.add("title");
      nullish += 1;
    } else if (!titleOk) {
      broken.add("title");
      junkTitles += 1;
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

    if (urlOk && allowedHosts.length > 0) {
      try {
        const host = new URL(urlRaw).hostname.replace(/^www\./, "");
        const okHost = allowedHosts.some(
          (h) => host === h || host.endsWith(`.${h}`) || host.includes(h.split(".")[0] ?? ""),
        );
        if (!okHost) {
          offHostUrls += 1;
          broken.add("url");
        }
      } catch {
        offHostUrls += 1;
      }
    }

    if (titleOk && urlOk) {
      valid += 1;
      if (seenUrls.has(urlRaw)) duplicateUrls += 1;
      else seenUrls.add(urlRaw);
      const titleKey = titleRaw.toLowerCase();
      if (seenTitles.has(titleKey)) duplicateTitles += 1;
      else seenTitles.add(titleKey);
    }
  }

  const null_rate = checks === 0 ? 1 : nullish / checks;
  const qa_flags: string[] = [];

  if (rows.length === 0) qa_flags.push("empty_extract");
  if (valid < minRows) qa_flags.push("below_min_rows");
  if (null_rate > 0.45) qa_flags.push("high_null_rate");
  if (junkTitles > 0) qa_flags.push("junk_titles");
  if (duplicateUrls > 0) qa_flags.push("duplicate_urls");
  if (duplicateTitles > 0) qa_flags.push("duplicate_titles");
  if (offHostUrls > 0) qa_flags.push("off_host_urls");
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
    qa_flags.includes("junk_titles")
      ? "Rows include nav/CTA text (Share, Subscribe) — extract post titles only."
      : null,
    qa_flags.includes("duplicate_urls")
      ? "Duplicate URLs — one row per unique post link on the listing page."
      : null,
    qa_flags.includes("off_host_urls")
      ? "URLs leave the rival domain — stay on the public listing page."
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
