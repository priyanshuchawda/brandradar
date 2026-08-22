import { describe, expect, it } from "vitest";
import { chunkDiscordContent } from "./discord-format";
import {
  buildHelpEmbed,
  buildIntelContent,
  buildIntelEmbeds,
  buildRivalsEmbed,
  buildSchemaEmbed,
} from "./discord-embeds";
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
          modified: [],
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
        collector_ids: ["c_test123"],
        broken_fields: [],
        qa_flags: [],
        heal_hint: null,
      },
      visibility: {
        score: 92,
        status: "degraded",
        rivals_tracked: 4,
        rivals_healthy: 3,
        total_entries: 18,
        new_this_week: 1,
        modified_this_week: 0,
        removed_this_week: 0,
        per_rival: [],
        heal_recommended: false,
        summary: "Rove captcha; one rival sparse.",
      },
      mode: "mock",
      notes: [],
    };
    const embeds = buildIntelEmbeds(snapshot);
    expect(embeds[0]?.title).toMatch(/Monday Diff/);
    expect(embeds[0]?.description).toMatch(/92\/100/);
    expect(embeds[0]?.description).toMatch(/c_test123/);
    expect(embeds.some((e) => e.title?.includes("Roame"))).toBe(true);
    expect(embeds.some((e) => e.title?.includes("Recommended plays"))).toBe(true);
    expect(buildIntelContent(snapshot)).toMatch(/92\/100/);
  });
});

describe("static embeds", () => {
  it("builds rivals, help, and schema", () => {
    expect(buildRivalsEmbed().fields?.length).toBeGreaterThanOrEqual(4);
    expect(buildHelpEmbed().fields?.some((f) => f.name === "/intel")).toBe(true);
    expect(buildHelpEmbed().fields?.some((f) => f.name === "/schema")).toBe(true);
    expect(buildSchemaEmbed().title).toMatch(/contract/i);
  });
});
