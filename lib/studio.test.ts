import { describe, expect, it } from "vitest";
import { isStudioCollectorId, resolveStudioCollector } from "./studio";
import type { Snapshot } from "./schema";

const base: Snapshot = {
  brand: {
    name: "Mamaearth",
    domain: "ecommerce",
    url: "https://mamaearth.in",
    snapshot_at: "2026-08-17T18:00:00Z",
  },
  rivals: [],
  items: [],
  signals: [],
  plays: [],
  health: {
    null_rate: 0,
    last_heal: null,
    collector_ids: ["c_mock_brandradar"],
    broken_fields: [],
    qa_flags: [],
    heal_hint: null,
  },
  mode: "mock",
  notes: [],
};

describe("isStudioCollectorId", () => {
  it("accepts real c_* ids and rejects mocks", () => {
    expect(isStudioCollectorId("c_msxk3e171mgnnw2hkr")).toBe(true);
    expect(isStudioCollectorId("c_mock_brandradar")).toBe(false);
    expect(isStudioCollectorId("discover_sync")).toBe(false);
  });
});

describe("resolveStudioCollector", () => {
  it("does not fall back to env collectors on a mock snapshot", () => {
    expect(resolveStudioCollector(base)).toBeUndefined();
  });

  it("uses the snapshot id when it is a real collector", () => {
    const live: Snapshot = {
      ...base,
      mode: "live",
      health: { ...base.health, collector_ids: ["c_msxk3e171mgnnw2hkr"] },
    };
    expect(resolveStudioCollector(live)).toBe("c_msxk3e171mgnnw2hkr");
  });
});
