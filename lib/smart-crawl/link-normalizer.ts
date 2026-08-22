/**
 * Link Normalizer for Smart Sublink Crawling.
 *
 * Deterministically strips tracking params, fragments, resolves relative URLs,
 * and canonicalizes query parameters to guarantee zero duplicate fetches.
 */

const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_eid",
  "yclid",
  "_ga",
  "_gl",
  "ref",
  "ref_src",
  "source",
  "campaign_id",
  "ad_id",
]);

/**
 * Normalizes a raw URL against a base URL.
 * Returns null if invalid or unsupported protocol.
 */
export function normalizeUrl(rawUrl: string, baseUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }

  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);

    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Always prefer https
    parsed.protocol = "https:";
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip default port
    if (parsed.port === "443" || parsed.port === "80") {
      parsed.port = "";
    }

    // Strip fragment/hash
    parsed.hash = "";

    // Filter out tracking query parameters
    const cleanParams = new URLSearchParams();
    const sortedKeys = Array.from(parsed.searchParams.keys()).sort();

    for (const key of sortedKeys) {
      if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) continue;
      const values = parsed.searchParams.getAll(key);
      for (const val of values) {
        cleanParams.append(key, val);
      }
    }

    const searchStr = cleanParams.toString();
    parsed.search = searchStr ? `?${searchStr}` : "";

    let path = parsed.pathname.replace(/\/+/g, "/");
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const cleanPath = path === "/" ? "" : path;
    return `${parsed.origin}${cleanPath}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * Checks if a normalized URL matches the target domain or allowed subdomains.
 */
export function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (allowedDomains.length === 0) return true;

    return allowedDomains.some((domain) => {
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      return host === cleanDomain || host.endsWith(`.${cleanDomain}`);
    });
  } catch {
    return false;
  }
}

/**
 * Infers likely page type from URL path structure.
 */
export function inferPageTypeFromUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase();

  if (path === "" || path === "/") return "homepage";
  if (/(pricing|plans|subscription|tiers)/.test(path)) return "pricing";
  if (/(product|item|shoe|apparel|flight|hotel|pdp)/.test(path)) return "product";
  if (/(category|collection|shop|browse|men|women|guides|catalog)/.test(path)) return "category";
  if (/(promo|sale|discount|deal|offer)/.test(path)) return "promotion";
  if (/(feature|tech|architecture|engine|integrations|api)/.test(path)) return "feature";
  if (/(blog|posts|news|articles|insights)/.test(path)) return "blog";
  if (/(changelog|releases|updates|whats-new)/.test(path)) return "changelog";
  if (/(about|team|company|press)/.test(path)) return "about";
  if (/(help|support|faq|contact)/.test(path)) return "support";

  return "unknown";
}
