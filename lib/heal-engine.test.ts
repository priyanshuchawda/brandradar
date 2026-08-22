import { describe, expect, it, vi } from "vitest";
import { runHealAndVerify, healStatusDiscordEmbed } from "./heal-engine";

let runCall = 0;

const previewOk = JSON.stringify({
  status: "done",
  preview_result: [{ posts: [{ title: "A", url: "https://x.com/a" }] }],
});

vi.mock("./studio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./studio")>();
  return {
    ...actual,
    runStudioCli: vi.fn(async () => {
      runCall += 1;
      return { ok: true, output: previewOk };
    }),
  };
});

vi.mock("./gemini", () => ({
  geminiConfigured: () => false,
  proposeHealPrompt: vi.fn(),
}));

vi.mock("./heal-history", () => ({
  appendHealHistory: vi.fn(async () => "/tmp/heal.jsonl"),
}));

vi.mock("./runtime-env", () => ({
  healRuntimeBudget: () => ({
    maxHealAttempts: 2,
    healTimeoutMs: 60_000,
    healCliTimeoutSec: 60,
    settleAttempts: 2,
    settleDelayMs: 1,
  }),
  isVercelRuntime: () => false,
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
    expect(result.stages).toContain("fixture_heal");
  });

  it("retries heal when first settle is empty", async () => {
    runCall = 0;
    let polls = 0;
    const result = await runHealAndVerify({
      collectorId: "c_mt3ekwjs2lzsn3dwl7",
      url: "https://brandradar-beta.vercel.app/heal-lab/live",
      surface: "heal-lab",
      brokenRows: [],
      mode: "live",
      maxHealAttempts: 2,
      budget: {
        maxHealAttempts: 2,
        healTimeoutMs: 60_000,
        healCliTimeoutSec: 60,
        settleAttempts: 2,
        settleDelayMs: 1,
      },
      rerun: async () => {
        polls += 1;
        if (polls <= 2) return [];
        return [
          {
            title: "Recovered",
            url: "https://brandradar-beta.vercel.app/heal-lab/posts/x",
            published_at: "2026-08-01",
            summary: "ok",
          },
        ];
      },
    });
    expect(result.heal_attempts).toBe(2);
    expect(result.stages.some((s) => s.includes("retighten:run_empty"))).toBe(true);
    expect(result.healed).toBe(true);
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
      stages: ["assess:empty"],
    });
    expect(payload.embeds[0]?.color).toBe(0x5cffb1);
  });
});
