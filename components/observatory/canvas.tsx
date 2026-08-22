"use client";

/**
 * MarketCanvas — Living cosmic observatory layout.
 *
 * Coordinates:
 *   - OBS_SCALE_X = 0.68, OBS_SCALE_Y = 0.64 for spacious quadrant layout.
 *   - SVG labels and Canvas particles share identical 1:1 mapping.
 *   - SVG camera animates viewBox on competitor selection.
 */

import React, { useRef, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import gsap from "gsap";
import type { InterpolatedMarketState, MarketSnapshotFrame } from "@/lib/market-world";
import { ParticleField, OBS_SCALE_X, OBS_SCALE_Y } from "./particle-field";
import { CompetitorTerritory } from "./territory";

// SVG viewBox dimensions
const VB_W = 1000;
const VB_H = 620;

// Convert normalized coordinates to SVG viewBox space
function toSvg(nx: number, ny: number): { cx: number; cy: number } {
  return {
    cx: VB_W / 2 + nx * OBS_SCALE_X * VB_W,
    cy: VB_H / 2 + ny * OBS_SCALE_Y * VB_H,
  };
}

interface MarketCanvasProps {
  state: InterpolatedMarketState;
  frames: MarketSnapshotFrame[];
  currentFrameIndex: number;
  selectedId: string | null;
  hoveredId: string | null;
  onSelectRival: (id: string) => void;
  onHoverRival: (id: string | null) => void;
}

export function MarketCanvas({
  state,
  frames,
  currentFrameIndex,
  selectedId,
  hoveredId,
  onSelectRival,
  onHoverRival,
}: MarketCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 1000, h: 620 });

  const currentFrame = frames[currentFrameIndex] ?? frames[0];
  const baselineFrame = frames[0];

  // ── Resize Observer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const el = entries[0];
      if (!el) return;
      setDims({
        w: Math.round(el.contentRect.width),
        h: Math.round(el.contentRect.height),
      });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── SVG Camera Zoom (viewBox GSAP animation) ────────────────────────────────
  const vb = useRef({ x: 0, y: 0, w: VB_W, h: VB_H });
  useEffect(() => {
    if (!svgRef.current) return;
    let tx = 0, ty = 0, tw = VB_W, th = VB_H;

    if (selectedId) {
      const comp = state.competitors.find((c) => c.id === selectedId);
      if (comp) {
        const { cx, cy } = toSvg(comp.x, comp.y);
        tw = VB_W * 0.65;
        th = VB_H * 0.65;
        tx = Math.max(0, Math.min(VB_W - tw, cx - tw / 2));
        ty = Math.max(0, Math.min(VB_H - th, cy - th / 2));
      }
    }

    gsap.to(vb.current, {
      x: tx,
      y: ty,
      w: tw,
      h: th,
      duration: 0.75,
      ease: "power3.inOut",
      onUpdate: () => {
        svgRef.current?.setAttribute(
          "viewBox",
          `${vb.current.x} ${vb.current.y} ${vb.current.w} ${vb.current.h}`,
        );
      },
    });
  }, [selectedId, state.competitors]);

  // ── Competitor Screen Positions ─────────────────────────────────────────────
  const positions = useMemo(
    () =>
      state.competitors.map((comp) => ({
        id: comp.id,
        normX: comp.x,
        normY: comp.y,
        ...toSvg(comp.x, comp.y),
      })),
    [state.competitors],
  );

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-black">

      {/* ── LAYER 1: Particle Field Canvas ── */}
      <ParticleField
        state={state}
        width={dims.w}
        height={dims.h}
        selectedId={selectedId}
      />

      {/* ── LAYER 2: SVG Floating Data Labels & Hit Targets ── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        className="absolute inset-0"
      >
        {state.competitors.map((comp) => {
          const pos = positions.find((p) => p.id === comp.id)!;
          const frameComp = currentFrame?.competitors.find((c) => c.id === comp.id);
          const baseComp = baselineFrame?.competitors.find((c) => c.id === comp.id);

          return (
            <CompetitorTerritory
              key={comp.id}
              comp={comp}
              frame={currentFrame}
              cx={pos.cx}
              cy={pos.cy}
              normX={pos.normX}
              normY={pos.normY}
              isSelected={comp.id === selectedId}
              isHovered={comp.id === hoveredId}
              onClick={() => onSelectRival(comp.id)}
              onHover={onHoverRival}
              addedCount={frameComp?.delta.added.length ?? 0}
              baselineCount={baseComp?.totalItems ?? 2}
            />
          );
        })}
      </svg>

      {/* ── Top Observatory Telemetry Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3.5 border-b border-[#141414] bg-black/80 backdrop-blur-sm">
        <span className="font-mono text-[11px] font-semibold tracking-[0.22em] text-white uppercase">
          BRANDRADAR
        </span>
        <div className="flex items-center gap-6 font-mono text-[9.5px] text-[#555] tracking-widest uppercase">
          <motion.span
            key={currentFrame?.dateLabel}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-white font-medium"
          >
            {currentFrame?.dateLabel}
          </motion.span>
          <span className="text-[#222]">·</span>
          <span>
            {currentFrame?.signalHealth.scrapersHealthy}/{currentFrame?.signalHealth.scrapersTotal} COLLECTORS
          </span>
          <span className="text-[#222]">·</span>
          <span>QA {currentFrame?.signalHealth.score}%</span>
        </div>
      </div>

      {/* ── Selection Hint ── */}
      {!selectedId && (
        <motion.p
          className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[9px] text-[#333] tracking-[0.28em] uppercase pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1.5 }}
        >
          SELECT A COMPETITOR TO INSPECT
        </motion.p>
      )}
    </div>
  );
}
