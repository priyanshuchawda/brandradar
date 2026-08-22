import { describe, expect, it } from "vitest";
import { BRANDRADAR_SERVER_LAYOUT } from "./discord-server";

describe("BRANDRADAR_SERVER_LAYOUT", () => {
  it("defines professional categories and env keys", () => {
    const names = BRANDRADAR_SERVER_LAYOUT.map((c) => c.name);
    expect(names).toContain("rules");
    expect(names).toContain("start-here");
    expect(names).toContain("monday-diff");
    expect(names).toContain("heal-alerts");
    expect(names).toContain("schema");
    expect(names).toContain("slash-commands");
    expect(names).toContain("hackathon-track");
    expect(names).toContain("roame");
    expect(names).toContain("stardrift");
    expect(names).toContain("pointhound");
    expect(names).toContain("rove");
    const roame = BRANDRADAR_SERVER_LAYOUT.find((c) => c.name === "roame");
    expect(roame?.category).toBe("COMPANIES");
    expect(roame?.envKey).toBe("DISCORD_RIVAL_ROAME_CHANNEL_ID");
    const monday = BRANDRADAR_SERVER_LAYOUT.find((c) => c.name === "monday-diff");
    expect(monday?.envKey).toBe("DISCORD_CHANNEL_ID");
    expect(monday?.category).toMatch(/MONDAY DIFF/);
  });
});
