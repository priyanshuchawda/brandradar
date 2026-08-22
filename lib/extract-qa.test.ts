import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assessListingExtract,
  isJunkListingTitle,
  retightenHealPrompt,
} from "./extract-qa";
import { healRuntimeBudget } from "./runtime-env";

describe("isJunkListingTitle", () => {
  it("flags nav CTAs", () => {
    expect(isJunkListingTitle("Share")).toBe(true);
    expect(isJunkListingTitle("August transfer bonuses live")).toBe(false);
  });
});

describe("assessListingExtract junk + duplicates", () => {
  it("flags junk titles and duplicates", () => {
    const qa = assessListingExtract([
      { title: "Share", url: "https://rival.com/p/1" },
      { title: "Real post", url: "https://rival.com/p/1" },
      { title: "Real post", url: "https://rival.com/p/2" },
    ]);
    expect(qa.qa_flags).toContain("junk_titles");
    expect(qa.qa_flags).toContain("duplicate_titles");
    expect(qa.valid_count).toBe(2);
  });

  it("flags off-host urls when allowedHosts set", () => {
    const qa = assessListingExtract(
      [{ title: "Post", url: "https://evil.com/x" }],
      { allowedHosts: ["rival.com"] },
    );
    expect(qa.qa_flags).toContain("off_host_urls");
  });
});

describe("retightenHealPrompt", () => {
  it("appends run_empty hint", () => {
    const p = retightenHealPrompt("Fix listing.", "run_empty");
    expect(p).toMatch(/Collection run was empty/i);
  });
});

describe("healRuntimeBudget", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses tighter budget on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    const b = healRuntimeBudget();
    expect(b.maxHealAttempts).toBe(1);
    expect(b.healTimeoutMs).toBeLessThanOrEqual(240_000);
  });

  it("allows two heal attempts locally", () => {
    vi.stubEnv("VERCEL", "");
    const b = healRuntimeBudget();
    expect(b.maxHealAttempts).toBe(2);
  });
});
