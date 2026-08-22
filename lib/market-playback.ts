/**
 * BrandRadar Market Playback Controller
 *
 * Centralized interpolation engine.
 * Synchronizes category branches, ingestion streams, event moments,
 * and competitor positions across the timeline.
 */

import type {
  MarketSnapshotFrame,
  InterpolatedMarketState,
  InterpolatedCompetitor,
} from "./market-world";

// ─── Easing ───────────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Main Interpolation ───────────────────────────────────────────────────────

export function interpolateFrames(
  fromFrame: MarketSnapshotFrame,
  toFrame: MarketSnapshotFrame,
  rawProgress: number,
): InterpolatedMarketState {
  const t = easeInOutCubic(Math.max(0, Math.min(1, rawProgress)));

  // Detect if an event is currently active (e.g. within 0.25 of a frame transition)
  const isEventActive = rawProgress > 0.35 && rawProgress < 0.85 && toFrame.moments.length > 0;
  const activeMoment = isEventActive ? toFrame.moments[0] ?? null : null;

  const competitors: InterpolatedCompetitor[] = fromFrame.competitors.map((from) => {
    const to = toFrame.competitors.find((c) => c.id === from.id);
    if (!to) {
      return {
        id: from.id,
        name: from.name,
        surface: from.surface,
        x: from.x,
        y: from.y,
        totalItems: from.totalItems,
        hasNewItems: false,
        newItemsCount: 0,
        activeCategories: from.categories,
        health: from.health,
        collectorId: from.collectorId,
      };
    }

    const hasNew = to.delta.added.length > 0 && t > 0.35;
    const newItemsCount = to.delta.added.length;

    // Active categories interpolated to current state
    const activeCategories = t > 0.4 ? to.categories : from.categories;

    return {
      id: from.id,
      name: from.name,
      surface: from.surface,
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      totalItems: lerp(from.totalItems, to.totalItems, t),
      hasNewItems: hasNew,
      newItemsCount: hasNew ? newItemsCount : 0,
      activeCategories,
      health: t > 0.5 ? to.health : from.health,
      collectorId: to.collectorId ?? from.collectorId,
    };
  });

  const signalScore = Math.round(
    lerp(fromFrame.signalHealth.score, toFrame.signalHealth.score, t),
  );

  return {
    fromFrameIndex: 0,
    toFrameIndex: 1,
    progress: rawProgress,
    isEventActive,
    activeMoment,
    competitors,
    signalScore,
  };
}

export function resolvePlaybackState(
  frames: MarketSnapshotFrame[],
  continuousProgress: number,
): InterpolatedMarketState {
  if (frames.length === 0) {
    return {
      fromFrameIndex: 0,
      toFrameIndex: 0,
      progress: 0,
      isEventActive: false,
      activeMoment: null,
      competitors: [],
      signalScore: 0,
    };
  }

  const clamped = Math.max(0, Math.min(frames.length - 1, continuousProgress));
  const fromIdx = Math.floor(clamped);
  const toIdx = Math.min(frames.length - 1, fromIdx + 1);
  const rawProgress = clamped - fromIdx;

  const state = interpolateFrames(frames[fromIdx], frames[toIdx], rawProgress);
  return { ...state, fromFrameIndex: fromIdx, toFrameIndex: toIdx };
}
