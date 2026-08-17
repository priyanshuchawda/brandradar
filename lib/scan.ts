import { collectorIdFor, hasBrightDataToken, liveCollectorsReady, triggerWithUrls } from "./brightdata";
import { discoverEnabled, discoverListings, discoverRivals } from "./discover";
import {
  extractCatalog,
  geminiConfigured,
  pickBrandRivals,
  polishPlays,
} from "./gemini";
import { buildMockSnapshot } from "./mock";
import { attachInsights, ensureUrl, hostnameLabel } from "./plays";
import type { Domain, Item, ScanRequest, Snapshot } from "./schema";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "value" in value) {
    return asNumber((value as { value: unknown }).value);
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedUrl(row: Record<string, unknown>): string | null {
  const input = row.input;
  if (input && typeof input === "object" && "url" in input) {
    return asString((input as { url: unknown }).url);
  }
  return null;
}

function collapseRepeatedName(name: string): string {
  const trimmed = name.trim();
  const mid = Math.floor(trimmed.length / 2);
  const left = trimmed.slice(0, mid).trim();
  const right = trimmed.slice(mid).trim();
  if (left && left === right) return left;
  return trimmed;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return /sale|promo|deal|off/i.test(value);
  }
  return false;
}

function rowToItem(
  row: Record<string, unknown>,
  source: Item["source"],
  rivalName: string | undefined,
  collectorId: string,
  runId: string | null,
): Item | null {
  const name = collapseRepeatedName(
    asString(row.name) ||
      asString(row.title) ||
      asString(row.product_name) ||
      asString(row.course_name) ||
      "",
  );
  const url =
    asString(row.url) ||
    asString(row.product_url) ||
    asString(row.product_page_url) ||
    asString(row.link) ||
    nestedUrl(row);
  if (!name || !url) return null;

  const availabilityRaw =
    asString(row.availability) || asString(row.stock) || asString(row.in_stock);
  let availability: Item["availability"] = "unknown";
  if (availabilityRaw) {
    if (/out/i.test(availabilityRaw) || availabilityRaw === "false") {
      availability = "out_of_stock";
    } else if (/in.?stock|available|true/i.test(availabilityRaw)) {
      availability = "in_stock";
    }
  }

  return {
    source,
    rival_name: rivalName,
    name,
    url,
    price: asNumber(row.price) ?? asNumber(row.sale_price) ?? asNumber(row.list_price),
    currency:
      asString(row.currency) ||
      (row.price && typeof row.price === "object" && "currency" in row.price
        ? asString((row.price as { currency: unknown }).currency)
        : null) ||
      "INR",
    availability,
    rating: asNumber(row.rating) ?? asNumber(row.stars),
    review_count: asNumber(row.review_count) ?? asNumber(row.reviews),
    promo: asBool(row.promo) || asBool(row.discount) || asBool(row.badge),
    collector_id: collectorId,
    run_id: runId,
  };
}

async function scrapeLive(request: ScanRequest): Promise<Snapshot> {
  const brandUrl = ensureUrl(request.brandUrl);
  const rivalUrls = request.rivalUrls.map(ensureUrl).filter(Boolean);
  const discoveryId = collectorIdFor(request.domain, "discovery");
  const pdpId = collectorIdFor(request.domain, "pdp");
  if (!discoveryId || !pdpId) {
    throw new Error("Collector IDs are not configured for this domain");
  }

  const listingUrls = [brandUrl, ...rivalUrls];
  const discovered = await triggerWithUrls(discoveryId, listingUrls);
  const listingRows = discovered.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object",
  );

  const pdpUrls = listingRows
    .map(
      (row) =>
        asString(row.product_url) ||
        asString(row.product_page_url) ||
        asString(row.url) ||
        nestedUrl(row),
    )
    .filter((url): url is string => Boolean(url) && !url.endsWith("/shop"))
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 12);

  const details =
    pdpUrls.length > 0 ? await triggerWithUrls(pdpId, pdpUrls) : discovered;
  const detailRows = details.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object",
  );

  const items: Item[] = [];
  for (const row of detailRows) {
    const url =
      asString(row.url) ||
      asString(row.product_url) ||
      asString(row.product_page_url) ||
      nestedUrl(row) ||
      "";
    const source: Item["source"] =
      hostnameLabel(url, "") === hostnameLabel(brandUrl, "") ? "brand" : "rival";
    const rivalName =
      source === "rival"
        ? hostnameLabel(url, "Rival")
        : undefined;
    const mapped = rowToItem(row, source, rivalName, pdpId, null);
    if (mapped) items.push(mapped);
  }

  const rivals = rivalUrls.map((url) => ({
    name: hostnameLabel(url, "Rival"),
    url,
  }));

  const snapshot: Snapshot = {
    brand: {
      name: request.brandName?.trim() || hostnameLabel(brandUrl, "Brand"),
      domain: request.domain,
      url: brandUrl,
      snapshot_at: new Date().toISOString(),
    },
    rivals,
    items,
    signals: [],
    plays: [],
    health: {
      null_rate: 0,
      last_heal: null,
      collector_ids: [discoveryId, pdpId],
      broken_fields: [],
    },
    mode: "live",
    notes: [
      `Studio collectors: discovery ${discoveryId}, pdp ${pdpId}. PDP prices overwrite listing mashups.`,
    ],
  };

  return attachInsights(snapshot);
}

function listingQuery(name: string, domain: Domain, host?: string): { query: string; intent: string } {
  const noun =
    domain === "edtech" ? "course fee rating" : domain === "food" ? "menu price rating" : "product price rating";
  const site = host ? `site:${host}` : "official website";
  return {
    query: `${name} ${noun} ${site}`,
    intent: `Public ${noun} listings for ${name}. Prefer the official site. Exclude news, Amazon, Flipkart, price-history blogs.`,
  };
}

async function scrapeViaDiscover(request: ScanRequest, rivalUrls: string[]): Promise<Snapshot> {
  const brandUrl = ensureUrl(request.brandUrl);
  const brandName = request.brandName?.trim() || hostnameLabel(brandUrl, "Brand");
  const notes: string[] = [];
  let rivals = rivalUrls.map((url) => ({
    name: hostnameLabel(url, "Rival"),
    url,
  }));

  if (rivals.length === 0 && discoverEnabled()) {
    const found = await discoverRivals({
      brandUrl,
      brandName,
      domain: request.domain,
    });
    notes.push(found.note);
    if (geminiConfigured() && found.rivals.length > 0) {
      try {
        const picked = await pickBrandRivals(found.rivals);
        rivals = picked.length ? picked : found.rivals.slice(0, 2);
        notes.push(`Gemini Flash-Lite picked ${rivals.length} rival brand sites.`);
      } catch (error) {
        rivals = found.rivals.slice(0, 2);
        notes.push(
          `Rival pick fell back to Discover order: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    } else {
      rivals = found.rivals.slice(0, 2);
    }
  }

  const brandHost = (() => {
    try {
      return new URL(brandUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  const items: Item[] = [];
  const brandSearch = listingQuery(brandName, request.domain, brandHost);
  const brandHits = await discoverListings(brandSearch);
  notes.push(`Discover listings for ${brandName}: ${brandHits.length} public snippets.`);
  items.push(
    ...(await extractCatalog({
      source: "brand",
      pageUrl: brandUrl,
      domain: request.domain,
      hits: brandHits,
    })),
  );

  for (const rival of rivals.slice(0, 2)) {
    let host = "";
    try {
      host = new URL(rival.url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    const search = listingQuery(rival.name, request.domain, host);
    const hits = await discoverListings(search);
    notes.push(`Discover listings for ${rival.name}: ${hits.length} public snippets.`);
    items.push(
      ...(await extractCatalog({
        source: "rival",
        rivalName: rival.name,
        pageUrl: rival.url,
        domain: request.domain,
        hits,
      })),
    );
  }

  if (items.length === 0) {
    throw new Error("Gemini extracted no catalog rows from Discover snippets");
  }

  const snapshot: Snapshot = {
    brand: {
      name: brandName,
      domain: request.domain,
      url: brandUrl,
      snapshot_at: new Date().toISOString(),
    },
    rivals,
    items,
    signals: [],
    plays: [],
    health: {
      null_rate: 0,
      last_heal: null,
      collector_ids: ["discover_sync"],
      broken_fields: [],
    },
    mode: "live",
    notes: [
      ...notes,
      "Live path: Bright Data Discover (snippets only) + Gemini 3.1 Flash-Lite extraction. No page bodies downloaded.",
    ],
  };
  return attachInsights(snapshot);
}

export async function runScan(request: ScanRequest): Promise<Snapshot> {
  const brandUrl = ensureUrl(request.brandUrl);
  let rivalUrls = request.rivalUrls.map(ensureUrl).filter(Boolean);
  const notes: string[] = [];
  const liveDiscover = hasBrightDataToken() && geminiConfigured() && !request.forceMock;

  if (liveCollectorsReady(request.domain) && process.env.USE_MOCK === "false") {
    try {
      const snapshot = await scrapeLive({ ...request, rivalUrls });
      snapshot.plays = await polishPlays(snapshot.plays);
      return snapshot;
    } catch (error) {
      notes.push(
        `Studio scrape failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  if (liveDiscover) {
    try {
      const snapshot = await scrapeViaDiscover({ ...request, rivalUrls }, rivalUrls);
      snapshot.notes = [...notes, ...snapshot.notes];
      snapshot.plays = await polishPlays(snapshot.plays);
      return snapshot;
    } catch (error) {
      notes.push(
        `Live Discover+Gemini failed (${error instanceof Error ? error.message : "unknown"}). Using fixture catalog.`,
      );
    }
  }

  if (rivalUrls.length === 0 && discoverEnabled()) {
    try {
      const found = await discoverRivals({
        brandUrl,
        brandName: request.brandName,
        domain: request.domain,
      });
      rivalUrls = found.rivals.map((rival) => rival.url);
      notes.push(found.note);
    } catch (error) {
      notes.push(
        `Discover skipped: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  const snapshot = buildMockSnapshot({
    brandUrl,
    brandName: request.brandName,
    domain: request.domain,
    rivalUrls,
    notes: [
      ...notes,
      "Catalog is a demo fixture until live extraction or Scraper Studio collectors succeed.",
    ],
  });
  try {
    snapshot.plays = await polishPlays(snapshot.plays);
  } catch (error) {
    snapshot.notes.push(
      `Gemini polish skipped: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
  return snapshot;
}
