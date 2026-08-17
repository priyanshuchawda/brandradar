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
  ]),
  sku: z.string(),
  summary: z.string(),
  brand_price: z.number().nullable().optional(),
  best_rival_price: z.number().nullable().optional(),
  gap_pct: z.number().nullable().optional(),
  brand_rating: z.number().nullable().optional(),
  rival_rating: z.number().nullable().optional(),
});

export const PlaySchema = z.object({
  title: z.string(),
  evidence: z.string(),
  action: z.string(),
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
