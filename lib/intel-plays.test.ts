import { describe, expect, it } from "vitest";
import { playsFromIntelDiff } from "./intel-plays";
import type { DiffChange } from "./intel-schema";

const change = (over: Partial<DiffChange> & Pick<DiffChange, "rival_id" | "rival_name">): DiffChange => ({
  rival_id: over.rival_id,
  rival_name: over.rival_name,
  added: over.added ?? [],
  removed: over.removed ?? [],
  modified: over.modified ?? [],
  unchanged_count: over.unchanged_count ?? 0,
});

describe("playsFromIntelDiff", () => {
  it("builds an attack play from new posts", () => {
    const plays = playsFromIntelDiff({
      label: "Points travel",
      diff: [
        change({
          rival_id: "roame",
          rival_name: "Roame",
          added: [
            {
              title: "EVA Air now searchable",
              url: "https://roame.travel/guides/eva",
              published_at: "2026-08-06",
              summary: null,
            },
          ],
        }),
      ],
    });
    expect(plays[0]?.kind).toBe("attack");
    expect(plays[0]?.title).toMatch(/Roame/);
  });

  it("returns a watch play when nothing changed", () => {
    const plays = playsFromIntelDiff({
      label: "Points travel",
      diff: [
        change({
          rival_id: "rove",
          rival_name: "Rove",
          unchanged_count: 3,
        }),
      ],
    });
    expect(plays.some((play) => play.kind === "watch")).toBe(true);
  });
});
