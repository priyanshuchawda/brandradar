import { describe, expect, it } from "vitest";
import { chunkDiscordContent } from "./discord";

describe("chunkDiscordContent", () => {
  it("keeps short messages whole", () => {
    expect(chunkDiscordContent("hello")).toEqual(["hello"]);
  });

  it("splits on newlines near the limit", () => {
    const line = "x".repeat(100);
    const content = Array.from({ length: 25 }, () => line).join("\n");
    const chunks = chunkDiscordContent(content, 500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true);
  });
});
