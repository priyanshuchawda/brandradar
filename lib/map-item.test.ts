import { describe, expect, it } from "vitest";
import {
  asNumber,
  collapseRepeatedName,
  discoverySeedUrl,
  rowToItem,
} from "./map-item";

describe("asNumber", () => {
  it("reads nested Studio price objects", () => {
    expect(asNumber({ value: 349, currency: "INR" })).toBe(349);
  });
});

describe("collapseRepeatedName", () => {
  it("dedupes concatenated PDP titles", () => {
    const title = "Vitamin C Daily Glow Face Serum - 30 ml";
    expect(collapseRepeatedName(`${title}${title}`)).toBe(title);
  });
});

describe("discoverySeedUrl", () => {
  it("points Mamaearth homepage at /shop", () => {
    expect(discoverySeedUrl("https://mamaearth.in")).toBe("https://mamaearth.in/shop");
  });
});

describe("rowToItem", () => {
  it("maps a live PDP row", () => {
    const item = rowToItem(
      {
        product_name:
          "Vitamin C Daily Glow Face Serum - 30 mlVitamin C Daily Glow Face Serum - 30 ml",
        price: { value: 349, currency: "INR", symbol: "₹" },
        rating: 4.88,
        review_count: 182,
        availability: "In stock",
        input: {
          url: "https://mamaearth.in/products/vitamin-c-daily-glow-face-serum-with-vitamin-c-turmeric-for-radiant-skin-30-ml",
        },
      },
      "brand",
      undefined,
      "c_pdp",
      null,
    );
    expect(item).toMatchObject({
      name: "Vitamin C Daily Glow Face Serum - 30 ml",
      price: 349,
      currency: "INR",
      rating: 4.88,
      availability: "in_stock",
      url: "https://mamaearth.in/products/vitamin-c-daily-glow-face-serum-with-vitamin-c-turmeric-for-radiant-skin-30-ml",
    });
  });

  it("prefers product_url over listing input url", () => {
    const item = rowToItem(
      {
        product_name: "Ubtan Face Wash",
        product_url: "https://mamaearth.in/products/ubtan-face-wash",
        input: { url: "https://mamaearth.in/shop" },
        price: 337,
        availability: "In stock In stock",
      },
      "brand",
      undefined,
      "c_disc",
      null,
    );
    expect(item?.url).toBe("https://mamaearth.in/products/ubtan-face-wash");
  });
});
