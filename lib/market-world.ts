/**
 * BrandRadar Market World — Core Data Model
 *
 * Direct data-causal pipeline:
 * Scraped Items -> Category Branches -> Core Density -> Event Choreography
 */

// ─── Scraper Health ──────────────────────────────────────────────────────────

export type ScraperStatus = "healthy" | "degraded" | "broken" | "healing" | "recovered";

// ─── Surface type ─────────────────────────────────────────────────────────────

export type SurfaceKind = "guides" | "blog" | "changelog" | "releases" | "news";

// ─── A single scraped item from a competitor's public surface ────────────────

export interface ObservedItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string | null;
  category: string; // Specific semantic category
  status: "existing" | "new" | "modified" | "removed";
  collectorId: string | null;
  scrapedAt: string;
}

// ─── A single week-over-week delta for one rival ─────────────────────────────

export interface RivalDelta {
  added: ObservedItem[];
  removed: ObservedItem[];
  modified: ObservedItem[];
  unchangedCount: number;
}

// ─── Category Branch Structure (Visual Dendrite) ──────────────────────────────

export interface CategoryBranch {
  name: string;
  itemCount: number;
  newCount: number;
  items: ObservedItem[];
  angle: number; // Radian direction from cluster center
}

// ─── One competitor's state at a point in time ───────────────────────────────

export interface CompetitorFrame {
  id: string;
  name: string;
  surface: SurfaceKind;
  updateUrl: string;
  collectorId: string | null;
  scrapedAt: string;

  totalItems: number;
  delta: RivalDelta;
  items: ObservedItem[];
  categories: CategoryBranch[];

  health: ScraperStatus;
  healthDetail: string | null;

  // Spatial position on canvas (normalized -1..1)
  x: number;
  y: number;
}

// ─── One historical market snapshot (one frame on the timeline) ───────────────

export interface MarketSnapshotFrame {
  week: string;
  dateLabel: string;
  pulledAt: string;

  competitors: CompetitorFrame[];
  moments: MarketMoment[];

  signalHealth: {
    score: number;
    scrapersTotal: number;
    scrapersHealthy: number;
    collectorIds: string[];
  };
}

// ─── A market moment — a cluster of related observed changes ─────────────────

export interface MarketMoment {
  id: string;
  rivalId: string;
  rivalName: string;
  date: string;
  type: "items_added" | "items_removed" | "items_modified" | "surface_appeared" | "heal_recovered";
  category: string;
  description: string;
  count: number;
  items: ObservedItem[];
}

// ─── Growth path ─────────────────────────────────────────────────────────────

export interface GrowthStep {
  week: string;
  dateLabel: string;
  totalItems: number;
  delta: {
    added: number;
    removed: number;
    modified: number;
  };
  moments: MarketMoment[];
}

export interface GrowthPath {
  rivalId: string;
  rivalName: string;
  steps: GrowthStep[];
  netDelta: number;
  direction: "growing" | "shrinking" | "stable";
}

// ─── Evidence record ─────────────────────────────────────────────────────────

export interface EvidenceRecord {
  rivalId: string;
  rivalName: string;
  sourceUrl: string;
  collectorId: string;
  runId: string;
  scrapedAt: string;
  httpStatus: number;
  item: ObservedItem;
  qaScore: number;
}

// ─── Playback interpolation state ────────────────────────────────────────────

export interface InterpolatedMarketState {
  fromFrameIndex: number;
  toFrameIndex: number;
  progress: number; // 0..1 between frames or continuous
  isEventActive: boolean; // True when close to an exact snapshot transition
  activeMoment: MarketMoment | null;

  competitors: InterpolatedCompetitor[];
  signalScore: number;
}

export interface InterpolatedCompetitor {
  id: string;
  name: string;
  surface: SurfaceKind;
  x: number;
  y: number;
  totalItems: number;
  hasNewItems: boolean;
  newItemsCount: number;
  activeCategories: CategoryBranch[];
  health: ScraperStatus;
  collectorId: string | null;
}

// ─── World state ─────────────────────────────────────────────────────────────

export interface BrandWorldState {
  frames: MarketSnapshotFrame[];
  currentFrameIndex: number;
  selectedRivalId: string | null;
  hoveredRivalId: string | null;
  selectedMomentId: string | null;
  selectedEvidence: EvidenceRecord | null;
  playback: {
    isPlaying: boolean;
    speed: 1 | 2 | 4;
    progress: number;
  };
}
