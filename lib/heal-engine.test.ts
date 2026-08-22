import { describe, expect, it, vi } from "vitest";
import { runHealAndVerify, healStatusDiscordEmbed } from "./heal-engine";

vi.mock("./studio", () => ({
  isStudioCollectorId: (id: string) => /^c_/.test(id),
  runStudioCli: vi.fn(async () => ({ ok: true, output: "healed" })),
}));

vi.mock("./gemini", () => ({
  geminiConfigured: () => false,
  proposeHealPrompt: vi.fn(),
}));

vi.mock("./heal-history", () => ({
  appendHealHistory: vi.fn(async () => "/tmp/heal.jsonl"),
}));

describe("runHealAndVerify", () => {
  it("fixture loop recovers from empty → rows", async () => {
    const result = await runHealAndVerify({
      collectorId: "c_fixture",
      url: "https://example.com/after",
      surface: "heal-lab",
      brokenRows: [],
      previousCount: 5,
      skipStudio: true,
      mode: "fixture",
      rerun: async () => [
        {
          title: "Back online",
          url: "https://example.com/p/1",
          published_at: "2026-08-01",
          summary: "ok",
        },
      ],
    });
    expect(result.healed).toBe(true);
    expect(result.same_id).toBe(true);
    expect(result.prompt_source).toBe("template");
    expect(result.stages).toContain("fixture_heal");
    expect(result.stages.some((s) => s.startsWith("verify:"))).toBe(true);
    expect(result.rows_after).toHaveLength(1);
  });

  it("skips heal when extract already healthy", async () => {
    const rows = [
      {
        title: "Fine",
        url: "https://example.com/ok",
        published_at: "2026-01-01",
        summary: "y",
      },
    ];
    const result = await runHealAndVerify({
      collectorId: "c_fixture",
      url: "https://example.com/ok",
      surface: "intel",
      brokenRows: rows,
      skipStudio: true,
      rerun: async () => rows,
    });
    expect(result.healed).toBe(false);
    expect(result.stages).toContain("skip:already_healthy");
  });
});

describe("healStatusDiscordEmbed", () => {
  it("colors recovered green-ish", () => {
    const payload = healStatusDiscordEmbed({
      stage: "recovered",
      collectorId: "c_x",
      url: "https://example.com",
      beforeCount: 0,
      afterCount: 5,
      stages: ["assess:empty", "verify:healthy"],
    });
    expect(payload.content).toMatch(/recovered/);
    expect(payload.embeds[0]?.color).toBe(0x5cffb1);
  });
});
