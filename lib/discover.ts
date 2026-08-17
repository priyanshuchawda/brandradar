import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Domain } from "./schema";
import { hostnameLabel } from "./plays";

export type DiscoveredRival = {
  name: string;
  url: string;
  title: string;
};

const BLOCKED = [
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "amazon.",
  "flipkart.com",
  "wikipedia.org",
  "reddit.com",
  "nytimes.com",
  "forbes.com",
  "inc42.com",
  "yourstory.com",
  "economictimes",
  "business-standard",
  "mordorintelligence",
  "statista.com",
  "crunchbase.com",
  "grandviewresearch",
  "researchandmarkets",
  "medium.com",
  "quora.com",
  "irecwire.com",
  "adlibrary.com",
  "similarweb.com",
  "semrush.com",
  "zoominfo.com",
  "zomato.com",
  "swiggy.com",
];

function token(): string | undefined {
  return process.env.BRIGHT_DATA_API_TOKEN?.trim() || undefined;
}

export function discoverEnabled(): boolean {
  return Boolean(token()) && process.env.USE_DISCOVER !== "false";
}

function cachePath(key: string): string {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return path.join(process.cwd(), "data", "cache", `discover-${hash}.json`);
}

async function readCache(key: string): Promise<DiscoveredRival[] | null> {
  try {
    const raw = await readFile(cachePath(key), "utf8");
    const parsed = JSON.parse(raw) as { at: number; rivals: DiscoveredRival[] };
    if (Date.now() - parsed.at > 6 * 60 * 60 * 1000) return null;
    return parsed.rivals;
  } catch {
    return null;
  }
}

async function writeCache(key: string, rivals: DiscoveredRival[]): Promise<void> {
  const file = cachePath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ at: Date.now(), rivals }, null, 2));
}

function origin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function blocked(url: string): boolean {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  return BLOCKED.some((part) => host.includes(part));
}

function queryFor(domain: Domain, brand: string): { query: string; intent: string } {
  if (domain === "edtech") {
    return {
      query: `"Physics Wallah" OR Unacademy OR Coursera official website India courses`,
      intent: `Official course-platform homepages that compete with ${brand}. Exclude news, rankings, and app-store pages.`,
    };
  }
  if (domain === "food") {
    return {
      query: `"Wow Momo" OR Faasos OR "Behrouz Biryani" official website India`,
      intent: `Official restaurant or cloud-kitchen brand sites that compete with ${brand}. Exclude aggregators like Zomato/Swiggy and news.`,
    };
  }
  return {
    query: `"Plum Goodness" OR "The Derma Co" OR Minimalist OR "Dot & Key" official website India skincare`,
    intent: `Official D2C skincare brand shops that compete with ${brand}. Exclude news, market research, ad libraries, and marketplaces.`,
  };
}

export async function discoverRivals(input: {
  brandUrl: string;
  brandName?: string;
  domain: Domain;
}): Promise<{ rivals: DiscoveredRival[]; cached: boolean; note: string }> {
  const apiToken = token();
  if (!apiToken) {
    return { rivals: [], cached: false, note: "No Bright Data token — skipped Discover." };
  }

  const brand = input.brandName?.trim() || hostnameLabel(input.brandUrl, "brand");
  const brandHost = (() => {
    try {
      return new URL(input.brandUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const cacheKey = `${input.domain}|${brand}|${brandHost}`;
  const cached = await readCache(cacheKey);
  if (cached) {
    return {
      rivals: cached,
      cached: true,
      note: `Discover cache hit (${cached.length} rival homepages).`,
    };
  }

  const { query, intent } = queryFor(input.domain, brand);
  const response = await fetch("https://api.brightdata.com/discover/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      intent,
      mode: "fast",
      language: "en",
      country: "IN",
      format: "json",
      remove_duplicates: true,
      include_content: false,
      include_images: false,
      num_results: 5,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discover ${response.status}: ${text.slice(0, 240)}`);
  }
  const payload = JSON.parse(text) as {
    results?: Array<{ link?: string; title?: string }>;
  };
  const seen = new Set<string>();
  const rivals: DiscoveredRival[] = [];
  for (const row of payload.results ?? []) {
    if (!row.link || blocked(row.link)) continue;
    const href = origin(row.link);
    if (!href) continue;
    let host = "";
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (brandHost && host.includes(brandHost)) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    rivals.push({
      name: hostnameLabel(href, host),
      url: href,
      title: row.title ?? host,
    });
    if (rivals.length >= 3) break;
  }

  await writeCache(cacheKey, rivals);
  return {
    rivals,
    cached: false,
    note: `Bright Data Discover (fast, 5 results, no page body) found ${rivals.length} rival homepages.`,
  };
}
