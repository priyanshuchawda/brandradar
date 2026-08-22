import { describe, expect, it } from "vitest";
import { computeVisibilityHealth } from "./visibility-health";
import type { IntelSnapshot } from "./intel-schema";

const base: IntelSnapshot = {
  cohort: "test",
  label: "Test",
  week: "2026-W34",
  pulled_at: "2026-08-22T00:00:00Z",
  rivals: [
    {
      rival_id: "a",
      rival_name: "A",
      update_url: "https://a.example/blog",
      surface: "blog",
      entries: [
        {
          title: "Post",
          url: "https://a.example/blog/post",
          published_at: null,
          summary: null,
        },
      ],
      collector_id: "c_x",
      scraped_at: "2026-08-22T00:00:00Z",
    },
    {
      rival_id: "b",
      rival_name: "B",
      update_url: "https://b.example/blog",
      surface: "blog",
      entries: [],
      collector_id: "c_x",
      scraped_at: "2026-08-22T00:00:00Z",
    },
  ],
  diff: [
    {
      rival_id: "a",
      rival_name: "A",
      added: [],
      removed: [],
      modified: [],
      unchanged_count: 1,
    },
    {
      rival_id: "b",
      rival_name: "B",
      added: [],
      removed: [],
      modified: [],
      unchanged_count: 0,
    },
  ],
  plays: [],
  health: {
    null_rate: 0,
    last_heal: null,
    collector_ids: ["c_x"],
    broken_fields: [],
    qa_flags: [],
    heal_hint: null,
  },
  mode: "live",
  notes: [],
};

describe("computeVisibilityHealth", () => {
  it("scores lower when rivals return empty", () => {
    const vis = computeVisibilityHealth(base);
    expect(vis.score).toBeLessThan(100);
    expect(vis.heal_recommended).toBe(true);
    expect(vis.per_rival.find((r) => r.rival_id === "b")?.status).toBe("empty");
  });

  it("includes modified counts in summary inputs", () => {
    const snap: IntelSnapshot = {
      ...base,
      diff: [
        {
          rival_id: "a",
          rival_name: "A",
          added: [{ title: "New", url: "https://a.example/n", published_at: null, summary: null }],
          removed: [],
          modified: [],
          unchanged_count: 0,
        },
      ],
    };
    const vis = computeVisibilityHealth(snap);
    expect(vis.new_this_week).toBe(1);
  });
});
