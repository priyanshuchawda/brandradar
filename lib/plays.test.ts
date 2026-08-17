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
        list_price: null,
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
        list_price: 899,
      },
    ],
    signals: [],
    plays: [],
    health: {
      null_rate: 0,
      last_heal: null,
      collector_ids: ["c_test"],
      broken_fields: [],
      qa_flags: [],
      heal_hint: null,
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
    expect(next.plays[0]?.kind).toBeTruthy();
    expect(next.plays[0]?.why_it_grows.length).toBeGreaterThan(10);
  });

  it("defends a SKU the brand already wins on price and rating", () => {
    const next = attachInsights(
      snapshot({
        items: [
          {
            source: "brand",
            name: "Ubtan Face Wash 150ml",
            url: "https://mamaearth.in/products/ubtan",
            price: 349,
            list_price: 449,
            currency: "INR",
            availability: "in_stock",
            rating: 4.85,
            review_count: 531,
            promo: true,
            collector_id: "c_test",
            run_id: null,
          },
          {
            source: "rival",
            rival_name: "Plum",
            name: "Ubtan Face Wash 150ml",
            url: "https://plumgoodness.com/products/ubtan",
            price: 399,
            list_price: null,
            currency: "INR",
            availability: "in_stock",
            rating: 4.4,
            review_count: 90,
            promo: false,
            collector_id: "c_test",
            run_id: null,
          },
        ],
      }),
    );
    expect(next.plays.some((play) => play.kind === "defend")).toBe(true);
    expect(next.plays.some((play) => /do not cut price/i.test(play.action))).toBe(
      true,
    );
  });
});

describe("computeKpis", () => {
  it("computes a price index above 1 when the brand is costlier", () => {
    const kpis = computeKpis(snapshot());
    expect(kpis.priceIndex).toBe(1.2);
    expect(kpis.itemCount).toBe(2);
  });
});
