import { describe, expect, it } from "vitest";
import { resolveDiscordCommand } from "./discord-commands";

describe("resolveDiscordCommand", () => {
  it("handles /help", async () => {
    const res = (await resolveDiscordCommand({ name: "help" })) as {
      type: number;
      data: { embeds: Array<{ title?: string; fields?: Array<{ name: string }> }> };
    };
    expect(res.type).toBe(4);
    expect(res.data.embeds[0]?.title).toMatch(/BrandRadar/);
    expect(res.data.embeds[0]?.fields?.some((f) => f.name === "/intel")).toBe(true);
  });

  it("handles /rivals", async () => {
    const res = (await resolveDiscordCommand({ name: "rivals" })) as {
      data: { embeds: Array<{ fields?: unknown[] }> };
    };
    expect((res.data.embeds[0]?.fields?.length ?? 0) >= 4).toBe(true);
  });

  it("handles /schema", async () => {
    const res = (await resolveDiscordCommand({ name: "schema" })) as {
      data: { embeds: Array<{ title?: string }> };
    };
    expect(res.data.embeds[0]?.title).toMatch(/contract/i);
  });

  it("handles /intel example", async () => {
    const res = (await resolveDiscordCommand({
      name: "intel",
      options: [{ name: "mode", type: 3, value: "example" }],
    })) as {
      data: { content: string; embeds: Array<{ title?: string }> };
    };
    expect(res.data.content).toMatch(/Monday Diff/);
    expect(res.data.embeds.length).toBeGreaterThan(1);
    expect(res.data.embeds.some((e) => e.title?.includes("Recommended plays"))).toBe(true);
  });
});
