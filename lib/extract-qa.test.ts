import { describe, expect, it } from "vitest";
import { assessListingExtract, defaultListingHealPrompt } from "./extract-qa";

describe("assessListingExtract", () => {
  it("marks healthy rows with title+url", () => {
    const qa = assessListingExtract([
      {
        title: "Launch notes",
        url: "https://example.com/blog/1",
        published_at: "2026-01-01",
        summary: "Ship it",
      },
      {
        title: "Patch",
        url: "https://example.com/blog/2",
        published_at: null,
        summary: null,
      },
    ]);
    expect(qa.ok).toBe(true);
    expect(qa.status).toBe("healthy");
    expect(qa.valid_count).toBe(2);
    expect(qa.qa_flags).toEqual([]);
  });

  it("flags empty extract", () => {
    const qa = assessListingExtract([]);
    expect(qa.ok).toBe(false);
    expect(qa.status).toBe("empty");
    expect(qa.qa_flags).toContain("empty_extract");
    expect(qa.null_rate).toBe(1);
  });

  it("detects row collapse vs previous week", () => {
    const qa = assessListingExtract(
      [{ title: "Only one", url: "https://example.com/a" }],
      { previousCount: 12 },
    );
    expect(qa.qa_flags).toContain("row_collapse");
    expect(qa.status).toBe("degraded");
  });

  it("flags broken title/url fields", () => {
    const qa = assessListingExtract([
      { title: "", url: "not-a-url", published_at: null, summary: null },
    ]);
    expect(qa.broken_fields).toEqual(expect.arrayContaining(["title", "url"]));
    expect(qa.valid_count).toBe(0);
    expect(qa.status).toBe("empty");
  });

  it("builds a listing-only heal hint", () => {
    const qa = assessListingExtract([]);
    expect(defaultListingHealPrompt(qa)).toMatch(/listing/i);
    expect(defaultListingHealPrompt(qa)).toMatch(/Do not open detail/i);
  });
});
