import { describe, expect, it } from "vitest";
import {
  extractJsonBlob,
  healPreviewLooksHealthy,
  isRefactorJobConflict,
  isStudioCollectorId,
  resolveStudioCollector,
} from "./studio";
import type { Snapshot } from "./schema";

const base: Snapshot = {
  brand: {
    name: "Mamaearth",
    domain: "ecommerce",
    url: "https://mamaearth.in",
    snapshot_at: "2026-08-17T18:00:00Z",
  },
  rivals: [],
  items: [],
  signals: [],
  plays: [],
  health: {
    null_rate: 0,
    last_heal: null,
    collector_ids: ["c_mock_brandradar"],
    broken_fields: [],
    qa_flags: [],
    heal_hint: null,
  },
  mode: "mock",
  notes: [],
};

describe("isRefactorJobConflict", () => {
  it("detects 409 and open refactor messages", () => {
    expect(isRefactorJobConflict("HTTP 409 Another refactor job is still in progress")).toBe(true);
    expect(isRefactorJobConflict("refactor job is still in progress")).toBe(true);
    expect(isRefactorJobConflict('{"status":"done"}')).toBe(false);
  });
});

describe("isStudioCollectorId", () => {
  it("accepts real c_* ids and rejects mocks", () => {
    expect(isStudioCollectorId("c_msxk3e171mgnnw2hkr")).toBe(true);
    expect(isStudioCollectorId("c_mock_brandradar")).toBe(false);
    expect(isStudioCollectorId("discover_sync")).toBe(false);
  });
});

describe("resolveStudioCollector", () => {
  it("does not fall back to env collectors on a mock snapshot", () => {
    expect(resolveStudioCollector(base)).toBeUndefined();
  });

  it("uses the snapshot id when it is a real collector", () => {
    const live: Snapshot = {
      ...base,
      mode: "live",
      health: { ...base.health, collector_ids: ["c_msxk3e171mgnnw2hkr"] },
    };
    expect(resolveStudioCollector(live)).toBe("c_msxk3e171mgnnw2hkr");
  });
});

describe("extractJsonBlob", () => {
  it("parses heal envelope with nested arrays", () => {
    const raw = JSON.stringify({
      status: "done",
      preview_result: [{ posts: [{ title: "A", url: "https://x.com/a" }] }],
    });
    const blob = extractJsonBlob(`npm notice\n${raw}\n`);
    expect(blob).toMatchObject({ status: "done" });
  });
});

describe("healPreviewLooksHealthy", () => {
  it("counts nested preview titles", () => {
    const previewOk = JSON.stringify({
      status: "done",
      preview_result: [{ posts: [{ title: "A", url: "https://x.com/a" }] }],
    });
    const preview = healPreviewLooksHealthy(previewOk);
    expect(preview.ok).toBe(true);
    expect(preview.title_count).toBe(1);
  });
});
