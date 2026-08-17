import { collectorIdFor, liveCollectorsReady, triggerWithUrls } from "./brightdata";
import { discoverEnabled, discoverRivals } from "./discover";
import { polishPlays } from "./gemini";
import { buildMockSnapshot } from "./mock";
import { attachInsights, ensureUrl, hostnameLabel } from "./plays";
import type { Item, ScanRequest, Snapshot } from "./schema";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
  const name =
    asString(row.name) ||
    asString(row.title) ||
    asString(row.product_name) ||
    asString(row.course_name);
  const url = asString(row.url) || asString(row.product_url) || asString(row.link);
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
    price: asNumber(row.price) ?? asNumber(row.sale_price),
    currency: asString(row.currency) || "INR",
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
    .map((row) => asString(row.url) || asString(row.product_url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 12);

  const details =
    pdpUrls.length > 0 ? await triggerWithUrls(pdpId, pdpUrls) : discovered;
  const detailRows = details.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object",
  );

  const items: Item[] = [];
  for (const row of detailRows) {
    const url = asString(row.url) || asString(row.product_url) || "";
    const source: Item["source"] = url.startsWith(brandUrl) ? "brand" : "rival";
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
    notes: [],
  };

  return attachInsights(snapshot);
}

export async function runScan(request: ScanRequest): Promise<Snapshot> {
  const brandUrl = ensureUrl(request.brandUrl);
  let rivalUrls = request.rivalUrls.map(ensureUrl).filter(Boolean);
  const notes: string[] = [];

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

  const useMock =
    request.forceMock ||
    process.env.USE_MOCK !== "false" ||
    !liveCollectorsReady(request.domain);

  if (useMock) {
    if (process.env.USE_MOCK !== "false") {
      notes.push("Catalog is a demo fixture until Scraper Studio collector IDs exist.");
    }
    if (!liveCollectorsReady(request.domain)) {
      notes.push("No discovery/PDP collector IDs yet — not calling /dca/trigger.");
    }
    const snapshot = buildMockSnapshot({
      brandUrl,
      brandName: request.brandName,
      domain: request.domain,
      rivalUrls,
      notes,
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

  try {
    const snapshot = await scrapeLive({ ...request, rivalUrls });
    snapshot.notes = [...notes, ...snapshot.notes];
    try {
      snapshot.plays = await polishPlays(snapshot.plays);
    } catch (error) {
      snapshot.notes.push(
        `Gemini polish skipped: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    return snapshot;
  } catch (error) {
    return buildMockSnapshot({
      brandUrl,
      brandName: request.brandName,
      domain: request.domain,
      rivalUrls,
      notes: [
        ...notes,
        `Live scrape failed (${error instanceof Error ? error.message : "unknown"}). Fell back to mock so the arena still renders.`,
      ],
    });
  }
}
