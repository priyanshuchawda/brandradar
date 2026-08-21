import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveIntelForceMock, runIntelPull } from "./intel-pull";
import { IntelSnapshotSchema } from "./intel-schema";
import * as store from "./intel-store";
import * as brightdata from "./brightdata";

describe("resolveIntelForceMock", () => {
  const prev = process.env.USE_MOCK;
  afterEach(() => {
    if (prev === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = prev;
  });

  it("lets explicit false win over USE_MOCK=true", () => {
    process.env.USE_MOCK = "true";
    expect(resolveIntelForceMock(false)).toBe(false);
  });

  it("lets explicit true win", () => {
    process.env.USE_MOCK = "false";
    expect(resolveIntelForceMock(true)).toBe(true);
  });
});

describe("runIntelPull", () => {
  it("returns a mock cohort snapshot with diff attached", async () => {
    const snapshot = await runIntelPull({ forceMock: true, persist: false });
    const parsed = IntelSnapshotSchema.parse(snapshot);
    expect(parsed.cohort).toBe("points-travel");
    expect(parsed.rivals.length).toBeGreaterThanOrEqual(4);
    expect(parsed.mode).toBe("mock");
    expect(parsed.diff.length).toBe(parsed.rivals.length);
    expect(parsed.plays.length).toBeGreaterThan(0);
    expect(parsed.plays.length).toBeLessThanOrEqual(3);
  });

  it("serves week cache and skips Studio when live snapshot exists", async () => {
    const base = await runIntelPull({ forceMock: true, persist: false });
    const liveCached = IntelSnapshotSchema.parse({
      ...base,
      mode: "live",
      notes: ["seed cache"],
      health: {
        ...base.health,
        collector_ids: ["c_testintelcache01"],
      },
    });

    const loadSpy = vi
      .spyOn(store, "loadIntelSnapshot")
      .mockResolvedValue(liveCached);
    const readySpy = vi.spyOn(brightdata, "intelCollectorsReady").mockReturnValue(true);
    const triggerSpy = vi.spyOn(brightdata, "triggerWithUrls");

    const snapshot = await runIntelPull({
      forceMock: false,
      persist: false,
      refresh: false,
    });

    expect(snapshot.notes.some((n) => n.includes("Week cache hit"))).toBe(true);
    expect(triggerSpy).not.toHaveBeenCalled();

    loadSpy.mockRestore();
    readySpy.mockRestore();
    triggerSpy.mockRestore();
  });
});
