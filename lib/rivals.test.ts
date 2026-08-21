import { describe, expect, it } from "vitest";
import { CohortConfigSchema, IntelSnapshotSchema } from "./intel-schema";
import { isoWeekKey, loadCohortConfig, listRivalUpdateUrls } from "./rivals";

describe("cohort rivals config", () => {
  it("parses committed rivals.json from disk", () => {
    const config = loadCohortConfig();
    expect(CohortConfigSchema.parse(config).cohort).toBe("points-travel");
    expect(config.rivals.length).toBeGreaterThanOrEqual(4);
    expect(config.rivals.every((r) => r.update_url.startsWith("https://"))).toBe(true);
  });

  it("lists update URLs", () => {
    const config = loadCohortConfig();
    expect(listRivalUpdateUrls(config)).toContain("https://roame.travel/guides");
    expect(listRivalUpdateUrls(config)).toContain("https://stardrift.ai/blog");
  });
});

describe("isoWeekKey", () => {
  it("returns a YYYY-Www key", () => {
    expect(isoWeekKey(new Date("2026-08-22T00:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("IntelSnapshotSchema", () => {
  it("accepts an empty live-shaped snapshot", () => {
    const parsed = IntelSnapshotSchema.parse({
      cohort: "points-travel",
      label: "Points & AI travel",
      week: "2026-W34",
      pulled_at: "2026-08-22T00:00:00Z",
      rivals: [],
      health: {
        null_rate: 0,
        last_heal: null,
        collector_ids: [],
      },
      mode: "mock",
    });
    expect(parsed.diff).toEqual([]);
    expect(parsed.plays).toEqual([]);
  });
});
