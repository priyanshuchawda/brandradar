/**
 * Link Extractor for Smart Sublink Crawling.
 *
 * Extracts hyperlinks from Bright Data extraction rows, HTML snippets,
 * navigational lists, and maps them to normalized DiscoveredLink entities.
 */

import type { DiscoveredLink } from "./crawl-schema";
import { inferPageTypeFromUrl, isAllowedDomain, normalizeUrl } from "./link-normalizer";

function extractHrefFromHtml(html: string): Array<{ href: string; text: string }> {
  const matches: Array<{ href: string; text: string }> = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    const href = match[2]?.trim();
    const text = match[3]?.replace(/<[^>]+>/g, "").trim() ?? "";
    if (href) {
      matches.push({ href, text });
    }
  }

  return matches;
}

export function extractDiscoveredLinks(input: {
  baseUrl: string;
  allowedDomains: string[];
  rawRows: Array<Record<string, unknown>>;
  htmlContent?: string;
}): DiscoveredLink[] {
  const { baseUrl, allowedDomains, rawRows, htmlContent } = input;
  const seenUrls = new Set<string>();
  const discovered: DiscoveredLink[] = [];

  let linkIndex = 1;

  function addCandidate(href: string, anchorText?: string, surroundingText?: string) {
    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) return;
    if (seenUrls.has(normalized)) return;
    if (!isAllowedDomain(normalized, allowedDomains)) return;

    seenUrls.add(normalized);

    const isInternal = isAllowedDomain(normalized, allowedDomains);
    const inferredTargetType = inferPageTypeFromUrl(normalized);

    discovered.push({
      linkId: `link_${linkIndex++}`,
      href,
      normalizedUrl: normalized,
      anchorText: (anchorText ?? "").slice(0, 120).trim(),
      surroundingText: (surroundingText ?? "").slice(0, 200).trim(),
      isInternal,
      inferredTargetType,
    });
  }

  // 1. Scan raw Bright Data extracted rows
  for (const row of rawRows) {
    const candidateUrls = [
      row.url,
      row.link,
      row.permalink,
      row.product_url,
      row.target_url,
      row.href,
      row.page_url,
    ];

    const title =
      typeof row.title === "string"
        ? row.title
        : typeof row.name === "string"
          ? row.name
          : typeof row.heading === "string"
            ? row.heading
            : "";

    const summary =
      typeof row.summary === "string"
        ? row.summary
        : typeof row.description === "string"
          ? row.description
          : "";

    for (const cand of candidateUrls) {
      if (typeof cand === "string" && cand.trim().length > 0) {
        addCandidate(cand, title, summary);
      }
    }

    // Check nested links and content arrays
    const nestKeys = [
      "guides",
      "posts",
      "articles",
      "items",
      "entries",
      "blogs",
      "updates",
      "results",
      "links",
      "sublinks",
      "categories",
      "data",
    ];

    for (const key of nestKeys) {
      const nested = row[key];
      if (Array.isArray(nested)) {
        for (const item of nested) {
          if (typeof item === "string") {
            addCandidate(item, title);
          } else if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            const objUrl =
              obj.url ||
              obj.link ||
              obj.href ||
              obj.permalink ||
              obj.guide_url ||
              obj.post_url ||
              obj.product_url;
            const objText = obj.text || obj.title || obj.name || obj.heading;
            const objSummary = obj.summary || obj.description || obj.excerpt;
            if (typeof objUrl === "string") {
              addCandidate(
                objUrl,
                typeof objText === "string" ? objText : title,
                typeof objSummary === "string" ? objSummary : summary,
              );
            }
          }
        }
      }
    }
  }

  // 2. Scan raw HTML if available
  if (htmlContent && typeof htmlContent === "string") {
    const htmlLinks = extractHrefFromHtml(htmlContent);
    for (const hl of htmlLinks) {
      addCandidate(hl.href, hl.text);
    }
  }

  return discovered;
}
