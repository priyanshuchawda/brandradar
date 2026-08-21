import { describe, expect, it } from "vitest";
import { runIntelPull } from "./intel-pull";
import { IntelSnapshotSchema } from "./intel-schema";

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
});
