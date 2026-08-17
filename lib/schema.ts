import { z } from "zod";

export const domains = ["ecommerce", "edtech", "food"] as const;
export const DomainSchema = z.enum(domains);
export type Domain = z.infer<typeof DomainSchema>;

export const AvailabilitySchema = z.enum([
  "in_stock",
  "out_of_stock",
  "unknown",
]);

export const ItemSchema = z.object({
  source: z.enum(["brand", "rival"]),
  rival_name: z.string().optional(),
  name: z.string(),
  url: z.string(),
  price: z.number().nullable(),
  list_price: z.number().nullable().default(null),
  currency: z.string().default("INR"),
  availability: AvailabilitySchema.default("unknown"),
  rating: z.number().nullable(),
  review_count: z.number().nullable(),
  promo: z.boolean().default(false),
  collector_id: z.string().nullable().default(null),
  run_id: z.string().nullable().default(null),
});

export const SignalSchema = z.object({
  type: z.enum([
    "price_gap",
    "rating_gap",
    "promo_gap",
    "catalog_hole",
    "stock_window",
    "defend_win",
  ]),
  sku: z.string(),
  summary: z.string(),
  kind: z.enum(["attack", "defend", "fill"]).optional(),
  score: z.number().optional(),
  brand_price: z.number().nullable().optional(),
  best_rival_price: z.number().nullable().optional(),
  gap_pct: z.number().nullable().optional(),
  brand_rating: z.number().nullable().optional(),
  rival_rating: z.number().nullable().optional(),
  brand_reviews: z.number().nullable().optional(),
  rival_reviews: z.number().nullable().optional(),
});

export const PlaySchema = z.object({
  title: z.string(),
  evidence: z.string(),
  action: z.string(),
  why_it_grows: z.string(),
  kind: z.enum(["attack", "defend", "fill"]),
  impact: z.enum(["revenue", "trust", "share", "margin"]),
  signal_type: SignalSchema.shape.type,
});

export const SnapshotSchema = z.object({
  brand: z.object({
    name: z.string(),
    domain: DomainSchema,
    url: z.string(),
    snapshot_at: z.string(),
  }),
  rivals: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
    }),
  ),
  items: z.array(ItemSchema).max(40),
  signals: z.array(SignalSchema),
  plays: z.array(PlaySchema),
  health: z.object({
    null_rate: z.number(),
    last_heal: z.string().nullable(),
    collector_ids: z.array(z.string()),
    broken_fields: z.array(z.string()).default([]),
    qa_flags: z.array(z.string()).default([]),
    heal_hint: z.string().nullable().default(null),
  }),
  mode: z.enum(["mock", "live"]),
  notes: z.array(z.string()).default([]),
});

export type Item = z.infer<typeof ItemSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Play = z.infer<typeof PlaySchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const ScanRequestSchema = z.object({
  brandUrl: z.string().min(1).max(2048),
  brandName: z.string().max(80).optional(),
  domain: DomainSchema,
  rivalUrls: z.array(z.string().max(2048)).max(5).default([]),
  forceMock: z.boolean().optional(),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;
