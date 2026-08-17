import { describe, expect, it } from "vitest";
import { attachInsights, computeHealth, computeKpis, ensureUrl } from "./plays";
import type { Snapshot } from "./schema";

function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    brand: {
      name: "Mamaearth",
      domain: "ecommerce",
      url: "https://mamaearth.in",
      snapshot_at: "2026-08-17T18:00:00Z",
    },
    rivals: [{ name: "Plum", url: "https://plumgoodness.com" }],
    items: [
      {
        source: "brand",
        name: "Vitamin C Serum 30ml",
        url: "https://mamaearth.in/products/vit-c",
        price: 899,
        currency: "INR",
        availability: "in_stock",
        rating: 4.2,
        review_count: 128,
        promo: false,
        collector_id: "c_test",
        run_id: null,
      },
      {
        source: "rival",
        rival_name: "Plum",
        name: "Vitamin C Serum 30ml",
        url: "https://plumgoodness.com/products/vit-c",
        price: 749,
        currency: "INR",
        availability: "in_stock",
        rating: 4.5,
        review_count: 410,
        promo: true,
        collector_id: "c_test",
        run_id: null,
      },
    ],
    signals: [],
    plays: [],
    health: {
      null_rate: 0,
      last_heal: null,
      collector_ids: ["c_test"],
      broken_fields: [],
    },
    mode: "mock",
    notes: [],
    ...over,
  };
}

describe("ensureUrl", () => {
  it("adds https when missing", () => {
    expect(ensureUrl("mamaearth.in")).toBe("https://mamaearth.in");
  });
});

describe("computeHealth", () => {
  it("flags a null price", () => {
    const health = computeHealth([
      { ...snapshot().items[0], price: null, rating: null },
    ]);
    expect(health.broken_fields).toEqual(expect.arrayContaining(["price", "rating"]));
    expect(health.null_rate).toBeGreaterThan(0);
  });
});

describe("attachInsights", () => {
  it("emits a price-gap play and three-or-fewer plays", () => {
    const next = attachInsights(snapshot());
    expect(next.signals.some((signal) => signal.type === "price_gap")).toBe(true);
    expect(next.plays.length).toBeGreaterThan(0);
    expect(next.plays.length).toBeLessThanOrEqual(3);
    expect(next.plays[0]?.signal_type).toBeTruthy();
  });
});

describe("computeKpis", () => {
  it("computes a price index above 1 when the brand is costlier", () => {
    const kpis = computeKpis(snapshot());
    expect(kpis.priceIndex).toBe(1.2);
    expect(kpis.itemCount).toBe(2);
  });
});
