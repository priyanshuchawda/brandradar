import { describe, expect, it } from "vitest";
import {
  brokenExtract,
  fixtureExtract,
  healLabDiscordEmbed,
  healLabUrl,
  mapHealLabRows,
} from "./heal-lab";

describe("heal-lab fixtures", () => {
  it("fixture has posts; broken is empty", () => {
    expect(fixtureExtract().length).toBeGreaterThanOrEqual(5);
    expect(brokenExtract()).toEqual([]);
  });

  it("maps nested posts arrays", () => {
    const rows = mapHealLabRows([
      {
        posts: [
          {
            title: "Hello",
            url: "https://brandradar-beta.vercel.app/heal-lab/posts/x",
            published_at: "2026-08-01",
            summary: "s",
          },
        ],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Hello");
  });

  it("builds discord embed for recovery", () => {
    const payload = healLabDiscordEmbed({
      stage: "recovery",
      collectorId: "c_testheal01",
      beforeCount: 0,
      afterCount: 5,
      layout: "after",
    });
    expect(payload.embeds[0]?.title).toMatch(/Self-heal/);
    expect(healLabUrl("before")).toContain("/heal-lab/before");
  });
});
