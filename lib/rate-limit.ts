export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
};

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    const current = this.buckets.get(key);
    if (!current || now >= current.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      this.prune(now);
      return { ok: true, remaining: this.max - 1, resetMs: resetAt, limit: this.max };
    }
    if (current.count >= this.max) {
      return {
        ok: false,
        remaining: 0,
        resetMs: current.resetAt,
        limit: this.max,
      };
    }
    current.count += 1;
    return {
      ok: true,
      remaining: this.max - current.count,
      resetMs: current.resetAt,
      limit: this.max,
    };
  }

  private prune(now: number): void {
    if (this.buckets.size < 2_000) return;
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}

export const scanLimiter = new RateLimiter(15 * 60 * 1000, 8);
export const healLimiter = new RateLimiter(15 * 60 * 1000, 20);
export const statusLimiter = new RateLimiter(60 * 1000, 60);

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local";
  return ip;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const retryAfter = Math.max(1, Math.ceil((result.resetMs - Date.now()) / 1000));
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
    ...(result.ok ? {} : { "Retry-After": String(retryAfter) }),
  };
}
