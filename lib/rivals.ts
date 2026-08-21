import { readFileSync } from "node:fs";
import path from "node:path";
import { CohortConfigSchema, type CohortConfig, type RivalConfig } from "./intel-schema";

const CONFIG_PATH = path.join(process.cwd(), "config", "rivals.json");

export function loadCohortConfig(filePath: string = CONFIG_PATH): CohortConfig {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return CohortConfigSchema.parse(raw);
}

export function listRivalUpdateUrls(config: CohortConfig = loadCohortConfig()): string[] {
  return config.rivals.map((rival) => rival.update_url);
}

export function findRival(
  id: string,
  config: CohortConfig = loadCohortConfig(),
): RivalConfig | undefined {
  return config.rivals.find((rival) => rival.id === id);
}

/** ISO week key like 2026-W34 (UTC). */
export function isoWeekKey(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
