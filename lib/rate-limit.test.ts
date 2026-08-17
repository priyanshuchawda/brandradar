import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows up to max requests then blocks until the window resets", () => {
    const limiter = new RateLimiter(1_000, 2);
    const first = limiter.check("ip", 0);
    const second = limiter.check("ip", 10);
    const third = limiter.check("ip", 20);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);

    const after = limiter.check("ip", 1_001);
    expect(after.ok).toBe(true);
  });
});
