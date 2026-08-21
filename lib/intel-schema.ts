import { z } from "zod";

/** One public update row from a rival guides/blog/changelog page. */
export const UpdateEntrySchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  published_at: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
});

export type UpdateEntry = z.infer<typeof UpdateEntrySchema>;

export const RivalUpdateBucketSchema = z.object({
  rival_id: z.string().min(1),
  rival_name: z.string().min(1),
  update_url: z.string().url(),
  surface: z.enum(["changelog", "releases", "blog", "guides", "news"]),
  entries: z.array(UpdateEntrySchema).max(40),
  collector_id: z.string().nullable().default(null),
  scraped_at: z.string(),
});

export type RivalUpdateBucket = z.infer<typeof RivalUpdateBucketSchema>;

export const IntelPlaySchema = z.object({
  title: z.string(),
  evidence: z.string(),
  action: z.string(),
  why_it_grows: z.string(),
  kind: z.enum(["attack", "watch", "fill"]),
  rival_id: z.string().nullable().default(null),
});

export type IntelPlay = z.infer<typeof IntelPlaySchema>;

export const DiffChangeSchema = z.object({
  rival_id: z.string(),
  rival_name: z.string(),
  added: z.array(UpdateEntrySchema),
  removed: z.array(UpdateEntrySchema),
  unchanged_count: z.number().int().nonnegative(),
});

export type DiffChange = z.infer<typeof DiffChangeSchema>;

/** One weekly cohort pull (current week). Diff fields filled in Phase 2+. */
export const IntelSnapshotSchema = z.object({
  cohort: z.string(),
  label: z.string(),
  week: z.string(),
  pulled_at: z.string(),
  rivals: z.array(RivalUpdateBucketSchema),
  diff: z.array(DiffChangeSchema).default([]),
  plays: z.array(IntelPlaySchema).default([]),
  health: z.object({
    null_rate: z.number(),
    last_heal: z.string().nullable().default(null),
    collector_ids: z.array(z.string()),
    broken_fields: z.array(z.string()).default([]),
    qa_flags: z.array(z.string()).default([]),
    heal_hint: z.string().nullable().default(null),
  }),
  mode: z.enum(["mock", "live"]),
  notes: z.array(z.string()).default([]),
});

export type IntelSnapshot = z.infer<typeof IntelSnapshotSchema>;

export const RivalConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  homepage: z.string().url(),
  update_url: z.string().url(),
  surface: z.enum(["changelog", "releases", "blog", "guides", "news"]),
  notes: z.string().optional(),
});

export const CohortConfigSchema = z.object({
  cohort: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  rivals: z.array(RivalConfigSchema).min(1).max(8),
});

export type CohortConfig = z.infer<typeof CohortConfigSchema>;
export type RivalConfig = z.infer<typeof RivalConfigSchema>;
