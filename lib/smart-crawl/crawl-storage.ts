/**
 * Crawl Session Storage & Provenance Persistence.
 *
 * Persists complete crawl sessions, collected pages, Gemini decisions,
 * graph edges, and final analysis to JSON storage.
 */

import { listJsonKeys, readJson, writeJson } from "../json-store";
import { CrawlSessionSchema, type CrawlSession } from "./crawl-schema";

const CRAWL_PREFIX = "crawls";

function sessionKey(competitor: string, sessionId: string): string {
  const compSlug = competitor.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `${CRAWL_PREFIX}/${compSlug}/${sessionId}.json`;
}

export async function saveCrawlSession(session: CrawlSession): Promise<string> {
  const parsed = CrawlSessionSchema.parse(session);
  const key = sessionKey(parsed.goal.competitor, parsed.sessionId);
  await writeJson(key, parsed);
  return key;
}

export async function loadCrawlSession(
  competitor: string,
  sessionId: string,
): Promise<CrawlSession | null> {
  const key = sessionKey(competitor, sessionId);
  const raw = await readJson(key);
  if (!raw) return null;
  try {
    return CrawlSessionSchema.parse(raw);
  } catch {
    return null;
  }
}

export async function listCrawlSessions(competitor: string): Promise<string[]> {
  const compSlug = competitor.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const prefix = `${CRAWL_PREFIX}/${compSlug}/`;
  const keys = await listJsonKeys(prefix);
  return keys
    .map((k) => {
      const match = k.match(/([^/]+)\.json$/);
      return match?.[1] ?? null;
    })
    .filter((id): id is string => Boolean(id));
}

export async function loadLatestCrawlSession(competitor: string): Promise<CrawlSession | null> {
  const sessionIds = await listCrawlSessions(competitor);
  if (sessionIds.length === 0) return null;
  const latestId = sessionIds[sessionIds.length - 1];
  return loadCrawlSession(competitor, latestId);
}
