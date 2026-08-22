/** Same-URL stress target — flip variant, redeploy, scrape the same path again. */
export type HealLabLiveVariant = "classic" | "redesign-v2";

/**
 * Flip this, merge, redeploy — URL stays https://…/heal-lab/live
 * classic     → .post-title / .post-card (matches original before layout)
 * redesign-v2 → nested cards, CTA buttons, no .post-* classes, data-dm attrs
 */
export const HEAL_LAB_LIVE_VARIANT: HealLabLiveVariant = "classic";
