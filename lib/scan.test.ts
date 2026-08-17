import { describe, expect, it } from "vitest";
import { runScan } from "./scan";

describe("runScan", () => {
  it("returns an instant fixture when forceMock is set", async () => {
    const snapshot = await runScan({
      brandUrl: "https://mamaearth.in",
      brandName: "Mamaearth",
      domain: "ecommerce",
      rivalUrls: [],
      forceMock: true,
    });
    expect(snapshot.mode).toBe("mock");
    expect(snapshot.plays.length).toBeGreaterThan(0);
    expect(snapshot.notes.some((note) => /demo fixture/i.test(note))).toBe(true);
  });
});
