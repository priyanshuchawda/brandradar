import { describe, expect, it } from "vitest";
import { diffCohort, diffRivalBuckets, summarizeDiff } from "./intel-diff";
import type { RivalUpdateBucket, UpdateEntry } from "./intel-schema";

const entry = (over: Partial<UpdateEntry> & Pick<UpdateEntry, "title" | "url">): UpdateEntry => ({
  published_at: null,
  summary: null,
  ...over,
});

const bucket = (
  id: string,
  entries: UpdateEntry[],
): RivalUpdateBucket => ({
  rival_id: id,
  rival_name: id,
  update_url: `https://example.com/${id}`,
  surface: "blog",
  entries,
  collector_id: null,
  scraped_at: "2026-08-22T00:00:00Z",
});

describe("diffRivalBuckets", () => {
  it("detects added and removed posts by URL", () => {
    const prev = bucket("roame", [
      entry({ title: "Old", url: "https://roame.travel/guides/old" }),
      entry({ title: "Keep", url: "https://roame.travel/guides/keep" }),
    ]);
    const next = bucket("roame", [
      entry({ title: "Keep", url: "https://roame.travel/guides/keep/" }),
      entry({ title: "New", url: "https://roame.travel/guides/new" }),
    ]);
    const diff = diffRivalBuckets(prev, next);
    expect(diff.added.map((e) => e.title)).toEqual(["New"]);
    expect(diff.removed.map((e) => e.title)).toEqual(["Old"]);
    expect(diff.unchanged_count).toBe(1);
  });

  it("treats missing previous week as all added", () => {
    const next = bucket("stardrift", [
      entry({ title: "Launch", url: "https://stardrift.ai/blog/launch" }),
    ]);
    const diff = diffRivalBuckets(undefined, next);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(0);
  });
});

describe("diffCohort", () => {
  it("diffs each rival independently", () => {
    const prev = [bucket("a", [entry({ title: "A1", url: "https://a.example/1" })])];
    const curr = [
      bucket("a", [
        entry({ title: "A1", url: "https://a.example/1" }),
        entry({ title: "A2", url: "https://a.example/2" }),
      ]),
      bucket("b", [entry({ title: "B1", url: "https://b.example/1" })]),
    ];
    const diff = diffCohort(prev, curr);
    const summary = summarizeDiff(diff);
    expect(summary.added).toBe(2);
    expect(summary.removed).toBe(0);
    expect(summary.rivals_with_changes).toBe(2);
  });
});
