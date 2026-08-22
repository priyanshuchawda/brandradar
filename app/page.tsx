"use client";

/**
 * Observatory Shell — master layout.
 *
 * Single source of truth: `progress` (0..N-1, continuous float).
 * Everything — canvas, territories, timeline — derives from it.
 *
 * Playback loop: raw RAF, ~60fps, progress ticks at 0.25 frames/s → ~12s full sweep.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { getHistoricalFrames, buildGrowthPath } from "@/lib/market-fixtures";
import { resolvePlaybackState } from "@/lib/market-playback";
import { MarketCanvas } from "@/components/observatory/canvas";
import { TimeMachine } from "@/components/observatory/time-machine";
import { InspectorDrawer } from "@/components/observatory/inspector-drawer";
import { EvidencePanel } from "@/components/observatory/evidence-panel";

// frames per second the timeline advances during playback
const PLAY_SPEED = 0.22;  // ~18s for full 5-week sweep

export default function Home() {
  const frames = React.useMemo(() => getHistoricalFrames(), []);

  // ── Single playback progress (the one true clock) ─────────────────────────
  const [progress, setProgress]   = useState(0);           // start at oldest frame
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Selection / interaction ───────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [evidenceItem, setEvidenceItem] = useState<{
    title: string; url: string; collectorId: string | null;
  } | null>(null);

  // ── Derived market state (every progress change → new interpolation) ───────
  const marketState = React.useMemo(
    () => resolvePlaybackState(frames, progress),
    [frames, progress],
  );

  const growthPath = React.useMemo(
    () => (selectedId ? buildGrowthPath(frames, selectedId) : null),
    [frames, selectedId],
  );

  // ── RAF playback loop ──────────────────────────────────────────────────────
  const rafRef     = useRef<number | null>(null);
  const lastRef    = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
      return;
    }

    function tick(now: number) {
      if (lastRef.current !== null) {
        const dt = (now - lastRef.current) / 1000;
        setProgress((p) => {
          const next = p + PLAY_SPEED * dt;
          if (next >= frames.length - 1) {
            setIsPlaying(false);
            return frames.length - 1;
          }
          return next;
        });
      }
      lastRef.current = now;
      rafRef.current  = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, frames.length]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTogglePlay    = useCallback(() => setIsPlaying((p) => !p), []);
  const handleRewind        = useCallback(() => { setIsPlaying(false); setProgress(0); }, []);
  const handleStepBackward  = useCallback(() => {
    setIsPlaying(false);
    setProgress((p) => Math.max(0, Math.floor(p) - 1));
  }, []);
  const handleStepForward   = useCallback(() => {
    setIsPlaying(false);
    setProgress((p) => Math.min(frames.length - 1, Math.floor(p) + 1));
  }, [frames.length]);

  const handleSelectRival   = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleHoverRival    = useCallback((id: string | null) => setHoveredId(id), []);
  const handleCloseInspector = useCallback(() => setSelectedId(null), []);
  const handleOpenEvidence  = useCallback((item: { title: string; url: string; collectorId: string | null }) => {
    setEvidenceItem(item);
  }, []);
  const handleCloseEvidence = useCallback(() => setEvidenceItem(null), []);

  const currentFrameIndex = Math.min(Math.floor(progress), frames.length - 1);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black flex flex-col">
      {/* Canvas zone — fills all available space */}
      <div className="relative flex-1 overflow-hidden min-h-0">
        <MarketCanvas
          state={marketState}
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelectRival={handleSelectRival}
          onHoverRival={handleHoverRival}
        />

        {/* Inspector — spring-slides in from right */}
        <InspectorDrawer
          rivalId={selectedId}
          frames={frames}
          growthPath={growthPath}
          onClose={handleCloseInspector}
          onOpenEvidence={handleOpenEvidence}
        />

        {/* Evidence — centered modal */}
        <EvidencePanel
          item={evidenceItem}
          onClose={handleCloseEvidence}
        />
      </div>

      {/* Timeline — fixed height at bottom */}
      <TimeMachine
        frames={frames}
        progress={progress}
        isPlaying={isPlaying}
        onProgressChange={setProgress}
        onTogglePlay={handleTogglePlay}
        onRewind={handleRewind}
        onStepBackward={handleStepBackward}
        onStepForward={handleStepForward}
      />
    </div>
  );
}
