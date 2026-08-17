import { describe, expect, it } from "vitest";
import { flattenStudioResults } from "./brightdata";

describe("flattenStudioResults", () => {
  it("merges row arrays from SDK run results", () => {
    const rows = flattenStudioResults([
      {
        data: [{ product_name: "A", price: 349 }],
        error: null,
      },
      {
        data: [{ product_name: "B", price: 199 }],
        error: null,
      },
    ]);
    expect(rows).toHaveLength(2);
  });

  it("throws the first error when every result is empty", () => {
    expect(() =>
      flattenStudioResults([{ data: null, error: "Collector not found" }]),
    ).toThrow(/Collector not found/);
  });
});
