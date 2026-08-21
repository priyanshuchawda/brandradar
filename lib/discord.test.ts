import { describe, expect, it } from "vitest";
import { chunkDiscordContent } from "./discord-format";
import { buildHelpEmbed, buildIntelEmbeds, buildRivalsEmbed } from "./discord-embeds";
import type { IntelSnapshot } from "./intel-schema";

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

describe("buildIntelEmbeds", () => {
  it("builds a brief + rival + plays embeds", () => {
    const snapshot: IntelSnapshot = {
      cohort: "points-travel",
      label: "Points & AI travel",
      week: "2026-W34",
      pulled_at: "2026-08-22T00:00:00Z",
      rivals: [],
      diff: [
        {
          rival_id: "roame",
          rival_name: "Roame",
          added: [
            {
              title: "EVA Air",
              url: "https://roame.travel/guides/eva",
              published_at: null,
              summary: null,
            },
          ],
          removed: [],
          unchanged_count: 2,
        },
      ],
      plays: [
        {
          title: "Attack: respond to Roame",
          evidence: "new post",
          action: "read it",
          why_it_grows: "signal",
          kind: "attack",
          rival_id: "roame",
        },
      ],
      health: {
        null_rate: 0,
        last_heal: null,
        collector_ids: [],
        broken_fields: [],
        qa_flags: [],
        heal_hint: null,
      },
      mode: "mock",
      notes: [],
    };
    const embeds = buildIntelEmbeds(snapshot);
    expect(embeds[0]?.title).toMatch(/Monday Diff/);
    expect(embeds.some((e) => e.title === "Roame")).toBe(true);
    expect(embeds.some((e) => e.title === "Plays")).toBe(true);
  });
});

describe("static embeds", () => {
  it("builds rivals and help", () => {
    expect(buildRivalsEmbed().fields?.length).toBeGreaterThanOrEqual(4);
    expect(buildHelpEmbed().fields?.some((f) => f.name === "/intel")).toBe(true);
  });
});
