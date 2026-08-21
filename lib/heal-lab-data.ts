/** Shared fake-startup changelog for Heal Lab (public demo site we own). */
export type HealLabPost = {
  slug: string;
  title: string;
  published_at: string;
  summary: string;
};

export const HEAL_LAB_BRAND = {
  name: "Driftmark",
  tagline: "Award travel, without the spreadsheet",
  description:
    "Public demo changelog for BrandRadar Heal Lab — not a real product. We own this HTML so we can redesign it and prove Scraper Studio self-heal.",
};

export const HEAL_LAB_POSTS: HealLabPost[] = [
  {
    slug: "transfer-bonus-august",
    title: "August transfer bonuses live",
    published_at: "2026-08-18",
    summary: "Chase → Aeroplan 30% and Amex → Flying Blue 25% through month end.",
  },
  {
    slug: "lounge-map-v2",
    title: "Lounge map v2",
    published_at: "2026-08-12",
    summary: "Filter by alliance and day-pass eligibility on 40+ lounges.",
  },
  {
    slug: "alert-webhooks",
    title: "Alert webhooks",
    published_at: "2026-08-05",
    summary: "Push award openings to Discord or Slack with one endpoint.",
  },
  {
    slug: "partner-portal",
    title: "Partner portal (beta)",
    published_at: "2026-07-28",
    summary: "Hotels can publish soft-currency rates without a login wall on the public list.",
  },
  {
    slug: "search-latency",
    title: "Search latency cut 40%",
    published_at: "2026-07-20",
    summary: "Live search p95 under 800ms on US routes.",
  },
];

export function healLabPostUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/heal-lab/posts/${slug}`;
}
