/** Serverless vs local — tune Studio heal budget so Vercel routes don't time out. */
export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL?.trim());
}

export type HealRuntimeBudget = {
  maxHealAttempts: number;
  healTimeoutMs: number;
  healCliTimeoutSec: number;
  settleAttempts: number;
  settleDelayMs: number;
};

/**
 * Vercel maxDuration is 300s — one heal (~240s) + settle fits.
 * Local dev can run two heal passes with full BD poll window.
 */
export function healRuntimeBudget(override?: Partial<HealRuntimeBudget>): HealRuntimeBudget {
  const vercel = isVercelRuntime();
  const base: HealRuntimeBudget = vercel
    ? {
        maxHealAttempts: 1,
        healTimeoutMs: 240_000,
        healCliTimeoutSec: 240,
        settleAttempts: 3,
        settleDelayMs: 5_000,
      }
    : {
        maxHealAttempts: 2,
        healTimeoutMs: 620_000,
        healCliTimeoutSec: 600,
        settleAttempts: 4,
        settleDelayMs: 8_000,
      };
  return { ...base, ...override };
}
