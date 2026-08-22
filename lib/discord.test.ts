import { describe, expect, it } from "vitest";
import { chunkDiscordContent } from "./discord-format";
import {
  analyzeStrategicDirection,
  buildCompanyDossierEmbed,
  buildCompanyIntelEmbeds,
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
    expect(buildHelpEmbed().fields?.some((f) => f.name === "/company")).toBe(true);
    expect(buildHelpEmbed().fields?.some((f) => f.name === "/schema")).toBe(true);
    expect(buildSchemaEmbed().title).toMatch(/contract/i);
  });
});

describe("company dedicated channel embeds & analysis", () => {
  const sampleRival = {
    id: "roame",
    name: "Roame",
    homepage: "https://roame.travel",
    update_url: "https://roame.travel/guides",
    surface: "guides" as const,
    notes: "Product guides double as release notes (airline/hotel coverage).",
  };

  it("builds a pinned master dossier embed for a company", () => {
    const dossier = buildCompanyDossierEmbed(sampleRival);
    expect(dossier.title).toMatch(/Roame/);
    expect(dossier.title).toMatch(/Master Intelligence Dossier/);
    expect(dossier.description).toContain("https://roame.travel/guides");
    expect(dossier.fields?.some((f) => f.name === "Channel Purpose & Capabilities")).toBe(true);
  });

  it("analyzes strategic direction and velocity from entries and diffs", () => {
    const entries = [
      {
        title: "EVA Air Sweet Spots and Mileage Transfer",
        url: "https://roame.travel/guides/eva-air",
        published_at: "2026-08-15T00:00:00Z",
        summary: "Comprehensive guide to redeeming EVA Air business class flights using transfer partners.",
      },
      {
        title: "AI Booking Assistant Launch v2",
        url: "https://roame.travel/guides/ai-assistant",
        published_at: "2026-08-18T00:00:00Z",
        summary: "Automated alert engine that books award flights using AI.",
      },
    ];
    const diff = {
      rival_id: "roame",
      rival_name: "Roame",
      added: [entries[1]],
      removed: [],
      modified: [],
      unchanged_count: 1,
    };

    const analysis = analyzeStrategicDirection(entries, diff, sampleRival.notes);
    expect(analysis.velocity).toMatch(/Active Expansion/);
    expect(analysis.themes.some((t) => t.includes("Flight") || t.includes("AI"))).toBe(true);
    expect(analysis.direction.length).toBeGreaterThan(15);
  });

  it("builds company deep-dive intel embeds for dedicated channels", () => {
    const entries = [
      {
        title: "Qatar Airways Avios Transfer Matrix",
        url: "https://roame.travel/guides/qatar-avios",
        published_at: "2026-08-20T00:00:00Z",
        summary: "How to transfer Citi and Amex points to Qatar Airways Avios.",
      },
    ];
    const embeds = buildCompanyIntelEmbeds(sampleRival, {
      bucket: {
        rival_id: "roame",
        rival_name: "Roame",
        update_url: "https://roame.travel/guides",
        surface: "guides",
        entries,
        collector_id: "c_test123",
        scraped_at: "2026-08-22T00:00:00Z",
      },
      diff: {
        rival_id: "roame",
        rival_name: "Roame",
        added: entries,
        removed: [],
        modified: [],
        unchanged_count: 0,
      },
      week: "2026-W34",
      collectorId: "c_test123",
    });

    expect(embeds.length).toBeGreaterThanOrEqual(3);
    expect(embeds[0]?.title).toMatch(/Roame · Week 2026-W34/);
    expect(embeds.some((e) => e.title?.includes("Strategic Direction & Trajectory"))).toBe(true);
    expect(embeds.some((e) => e.title?.includes("Targeted Counter-Strategies"))).toBe(true);
    expect(embeds.some((e) => e.title?.includes("History & Scraped Updates Feed"))).toBe(true);
  });
});
