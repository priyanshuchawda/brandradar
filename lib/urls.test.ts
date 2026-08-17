import { describe, expect, it } from "vitest";
import { assertPublicHttpsUrl } from "./urls";

describe("assertPublicHttpsUrl", () => {
  it("accepts a public HTTPS origin", () => {
    expect(assertPublicHttpsUrl("mamaearth.in")).toBe("https://mamaearth.in/");
  });

  it("rejects http, localhost, and private hosts", () => {
    expect(() => assertPublicHttpsUrl("http://example.com")).toThrow(/HTTPS/);
    expect(() => assertPublicHttpsUrl("https://localhost/shop")).toThrow(/public/);
    expect(() => assertPublicHttpsUrl("https://127.0.0.1")).toThrow(/public/);
    expect(() => assertPublicHttpsUrl("https://192.168.1.9")).toThrow(/public/);
    expect(() => assertPublicHttpsUrl("https://user:pass@example.com")).toThrow(
      /credentials/,
    );
  });
});
