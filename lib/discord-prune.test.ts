import { describe, expect, it } from "vitest";
import type { GuildChannelRow } from "./discord-api";
import { channelMarkedForPrune } from "./discord-prune";

describe("channelMarkedForPrune", () => {
  const protectedIds = new Set(["999"]);

  it("keeps layout channels and prunes junk", () => {
    const all: GuildChannelRow[] = [
      { id: "1", name: "START HERE", type: 4, parent_id: null },
      { id: "2", name: "start-here", type: 0, parent_id: "1" },
      { id: "3", name: "hehe", type: 0, parent_id: "9" },
      { id: "4", name: "━━ START HERE ━━", type: 4, parent_id: null },
      { id: "9", name: "Text Channels", type: 4, parent_id: null },
    ];
    expect(channelMarkedForPrune(all[1]!, all, protectedIds)).toBe(false);
    expect(channelMarkedForPrune(all[2]!, all, protectedIds)).toBe(true);
    expect(channelMarkedForPrune(all[3]!, all, protectedIds)).toBe(true);
  });

  it("never prunes env-protected ids", () => {
    const all: GuildChannelRow[] = [{ id: "999", name: "hehe", type: 0, parent_id: null }];
    expect(channelMarkedForPrune(all[0]!, all, protectedIds)).toBe(false);
  });
});
