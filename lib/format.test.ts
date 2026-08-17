import { describe, expect, it } from "vitest";
import { formatAvailability, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatMoney(349, "INR")).toBe("₹349");
    expect(formatMoney(49999, "INR")).toBe("₹49,999");
  });

  it("renders a dash for missing prices", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(Number.NaN)).toBe("—");
  });
});

describe("formatAvailability", () => {
  it("replaces every underscore", () => {
    expect(formatAvailability("out_of_stock")).toBe("out of stock");
  });
});
