import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ScanRequestSchema, SnapshotSchema } from "./schema";

describe("SnapshotSchema", () => {
  it("accepts the canonical sample output", () => {
    const raw = JSON.parse(
      readFileSync(new URL("../examples/sample-output.json", import.meta.url), "utf8"),
    );
    const parsed = SnapshotSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("accepts the live Studio PDP row shape after mapping", () => {
    const parsed = SnapshotSchema.safeParse({
      brand: {
        name: "Mamaearth",
        domain: "ecommerce",
        url: "https://mamaearth.in",
        snapshot_at: "2026-08-17T18:19:28Z",
      },
      rivals: [],
      items: [
        {
          source: "brand",
          name: "Vitamin C Daily Glow Face Serum",
          url: "https://mamaearth.in/products/vitamin-c-daily-glow-face-serum-with-vitamin-c-turmeric-for-radiant-skin-30-ml",
          price: 349,
          currency: "INR",
          availability: "in_stock",
          rating: 4.88,
          review_count: 182,
          promo: false,
          collector_id: "c_pdp",
          run_id: null,
        },
      ],
      signals: [],
      plays: [],
      health: {
        null_rate: 0,
        last_heal: null,
        collector_ids: ["c_pdp"],
        broken_fields: [],
      },
      mode: "live",
      notes: [],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("ScanRequestSchema", () => {
  it("defaults rivalUrls and allows forceMock", () => {
    const parsed = ScanRequestSchema.parse({
      brandUrl: "https://mamaearth.in",
      domain: "ecommerce",
      forceMock: true,
    });
    expect(parsed.rivalUrls).toEqual([]);
    expect(parsed.forceMock).toBe(true);
  });
});
