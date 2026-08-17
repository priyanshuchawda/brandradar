import type { Domain } from "./schema";

const API_BASE = "https://api.brightdata.com";
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;
const MAX_RETRIES = 3;

export type CollectorKind = "discovery" | "pdp";

export type ScraperInput = Record<string, string>;

function token(): string | undefined {
  return process.env.BRIGHT_DATA_API_TOKEN?.trim() || undefined;
}

export function hasBrightDataToken(): boolean {
  return Boolean(token());
}

function dedicatedCollector(domain: Domain, kind: CollectorKind): string | undefined {
  const key = {
    ecommerce: {
      discovery: process.env.COLLECTOR_ECOMMERCE_DISCOVERY,
      pdp: process.env.COLLECTOR_ECOMMERCE_PDP,
    },
    edtech: {
      discovery: process.env.COLLECTOR_EDTECH_DISCOVERY,
      pdp: process.env.COLLECTOR_EDTECH_PDP,
    },
    food: {
      discovery: process.env.COLLECTOR_FOOD_DISCOVERY,
      pdp: process.env.COLLECTOR_FOOD_PDP,
    },
  }[domain][kind];
  return key?.trim() || undefined;
}

export function collectorIdFor(
  domain: Domain,
  kind: CollectorKind,
): string | undefined {
  return dedicatedCollector(domain, kind) || process.env.BRIGHT_DATA_COLLECTOR_ID?.trim() || undefined;
}

export function liveCollectorsReady(domain: Domain): boolean {
  return (
    hasBrightDataToken() &&
    Boolean(dedicatedCollector(domain, "discovery")) &&
    Boolean(dedicatedCollector(domain, "pdp"))
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const apiToken = token();
  if (!apiToken) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }

      if (response.status >= 500) {
        throw new Error(`Bright Data ${response.status}: ${text.slice(0, 200)}`);
      }
      if (!response.ok) {
        throw new Error(
          `Bright Data ${response.status}: ${text.slice(0, 400)}`,
        );
      }
      return parsed;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const is4xx = /Bright Data 4\d\d/.test(message);
      if (is4xx || attempt === MAX_RETRIES) {
        throw error;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Bright Data request failed");
}

function isReady(payload: unknown): payload is unknown[] {
  return Array.isArray(payload) && payload.length > 0;
}

export async function runScraper(
  collectorId: string,
  inputs: ScraperInput[],
): Promise<unknown[]> {
  const triggerPath = `/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`;
  const trigger = await apiRequest("POST", triggerPath, inputs);
  const snapshotId =
    trigger &&
    typeof trigger === "object" &&
    "collection_id" in trigger &&
    typeof trigger.collection_id === "string"
      ? trigger.collection_id
      : null;

  if (!snapshotId) {
    throw new Error(`Trigger returned no collection_id: ${JSON.stringify(trigger)}`);
  }

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const dataset = await apiRequest(
      "GET",
      `/dca/dataset?id=${encodeURIComponent(snapshotId)}`,
    );
    if (isReady(dataset)) {
      return dataset;
    }
  }

  throw new Error(`Timed out waiting for collector ${collectorId} (${snapshotId})`);
}

export async function triggerWithUrl(
  collectorId: string,
  url: string,
): Promise<unknown[]> {
  return runScraper(collectorId, [{ url }]);
}

export async function triggerWithUrls(
  collectorId: string,
  urls: string[],
): Promise<unknown[]> {
  return runScraper(
    collectorId,
    urls.map((url) => ({ url })),
  );
}
