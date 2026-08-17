import { describe, expect, it } from "vitest";
import { auditItems } from "./qa";
import type { Item } from "./schema";

const row = (over: Partial<Item>): Item => ({
  source: "brand",
  name: "Vitamin C Serum 30ml",
  url: "https://mamaearth.in/products/vit-c",
  price: 349,
  list_price: null,
  currency: "INR",
  availability: "in_stock",
  rating: 4.8,
  review_count: 182,
  promo: false,
  collector_id: "c_pdp",
  run_id: null,
  ...over,
});

describe("auditItems", () => {
  it("flags concatenated ecommerce sale+list prices", () => {
    const issues = auditItems([row({ price: 349499 })], "ecommerce");
    expect(issues.some((issue) => issue.field === "price")).toBe(true);
    expect(issues[0]?.heal_prompt).toMatch(/349/);
  });

  it("does not flag a real edtech fee", () => {
    const issues = auditItems([row({ price: 49999 })], "edtech");
    expect(issues.filter((issue) => issue.field === "price")).toHaveLength(0);
  });
});
