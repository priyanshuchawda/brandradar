import { collectorIdFor, hasBrightDataToken, liveCollectorsReady, triggerWithUrls } from "./brightdata";
import { discoverEnabled, discoverListings, discoverRivals } from "./discover";
import {
  extractCatalog,
  geminiConfigured,
  pickBrandRivals,
  polishPlays,
  proposeHealPrompt,
} from "./gemini";
import { buildMockSnapshot } from "./mock";
import { attachInsights, ensureUrl, hostnameLabel } from "./plays";
import { asString, discoverySeedUrl, nestedUrl, rowToItem } from "./map-item";
import type { Domain, Item, ScanRequest, Snapshot } from "./schema";

async function scrapeLive(request: ScanRequest): Promise<Snapshot> {
  const brandUrl = ensureUrl(request.brandUrl);
  const rivalUrls = request.rivalUrls.map(ensureUrl).filter(Boolean);
  const discoveryId = collectorIdFor(request.domain, "discovery");
  const pdpId = collectorIdFor(request.domain, "pdp");
  if (!discoveryId || !pdpId) {
    throw new Error("Collector IDs are not configured for this domain");
  }

  const listingUrls = [
    discoverySeedUrl(brandUrl),
    ...rivalUrls.map(discoverySeedUrl),
  ];
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
    .filter(
      (url): url is string =>
        typeof url === "string" && url.length > 0 && !url.endsWith("/shop"),
    )
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 8);

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
      qa_flags: [],
      heal_hint: null,
    },
    mode: "live",
    notes: [
      `Studio collectors: discovery ${discoveryId}, pdp ${pdpId}. PDP prices overwrite listing mashups.`,
    ],
  };

  return withFlashHeal(attachInsights(snapshot));
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
      pageUrl: discoverySeedUrl(brandUrl),
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
        pageUrl: discoverySeedUrl(rival.url),
        domain: request.domain,
        hits,
      })),
    );
  }

  if (items.length === 0) {
    throw new Error("Gemini Flash extracted no catalog rows from Discover + URL context");
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
      qa_flags: [],
      heal_hint: null,
    },
    mode: "live",
    notes: [
      ...notes,
      "Live path: Bright Data Discover + Gemini Flash (URL context + structured JSON) when Studio is down. Flash-Lite only rewrites play copy.",
    ],
  };
  return withFlashHeal(attachInsights(snapshot));
}

async function withFlashHeal(snapshot: Snapshot): Promise<Snapshot> {
  if (!geminiConfigured() || snapshot.health.qa_flags.length === 0) {
    return snapshot;
  }
  try {
    const hint = await proposeHealPrompt(
      snapshot.health.qa_flags,
      snapshot.health.heal_hint,
    );
    if (hint && hint !== snapshot.health.heal_hint) {
      snapshot.health.heal_hint = hint;
      snapshot.notes.push("Gemini Flash wrote the Studio heal prompt from QA flags.");
    }
  } catch (error) {
    snapshot.notes.push(
      `Gemini Flash heal prompt skipped: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  return snapshot;
}

export async function runScan(request: ScanRequest): Promise<Snapshot> {
  const brandUrl = ensureUrl(request.brandUrl);
  let rivalUrls = request.rivalUrls.map(ensureUrl).filter(Boolean);
  const notes: string[] = [];

  if (request.forceMock) {
    return buildMockSnapshot({
      brandUrl,
      brandName: request.brandName,
      domain: request.domain,
      rivalUrls,
      notes: ["Demo fixture — skip Studio and Discover."],
    });
  }

  const liveDiscover = hasBrightDataToken() && geminiConfigured();

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
