import { describe, expect, it } from "vitest";
import { breakSnapshot, buildMockSnapshot, healSnapshot } from "./mock";

describe("mock arena", () => {
  it("builds a typed ecommerce snapshot with three plays", () => {
    const snapshot = buildMockSnapshot({
      brandUrl: "https://mamaearth.in",
      brandName: "Mamaearth",
      domain: "ecommerce",
      rivalUrls: [],
    });
    expect(snapshot.mode).toBe("mock");
    expect(snapshot.items.length).toBeGreaterThan(3);
    expect(snapshot.plays.length).toBeGreaterThan(0);
    expect(snapshot.plays.length).toBeLessThanOrEqual(3);
  });

  it("break then heal restores the hero price on the same collector id", () => {
    const base = buildMockSnapshot({
      brandUrl: "https://mamaearth.in",
      domain: "ecommerce",
      rivalUrls: [],
    });
    const broken = breakSnapshot(base);
    expect(broken.items[0]?.price).toBeNull();
    expect(broken.health.broken_fields).toContain("price");

    const healed = healSnapshot(broken);
    expect(healed.items[0]?.price).not.toBeNull();
    expect(healed.health.collector_ids).toEqual(base.health.collector_ids);
    expect(healed.health.last_heal).toBeTruthy();
  });
});
