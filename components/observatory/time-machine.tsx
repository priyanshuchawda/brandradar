"use client";

/**
 * TimeMachine — tactile timeline scrubber.
 *
 * Behavior:
 *   - Drag starts immediately, market responds every frame during drag
 *   - Spring-animated playhead (GSAP)
 *   - Moment dots animate on hover (scale up)
 *   - Date label cross-fades via Motion key prop
 *   - Touch support via pointer events
 *   - Playhead always leads slightly ahead of content label (spring lag)
 */

import React, { useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import gsap from "gsap";
import type { MarketSnapshotFrame } from "@/lib/market-world";

interface TimeMachineProps {
  frames: MarketSnapshotFrame[];
  progress: number;         // 0..frames.length-1, continuous float
  isPlaying: boolean;
  onProgressChange: (p: number) => void;
  onTogglePlay: () => void;
  onRewind: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
}

export function TimeMachine({
  frames,
  progress,
  isPlaying,
  onProgressChange,
  onTogglePlay,
  onRewind,
  onStepBackward,
  onStepForward,
}: TimeMachineProps) {
  const trackRef    = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const fillRef     = useRef<HTMLDivElement>(null);
  const isDragging  = useRef(false);
  const max = Math.max(0, frames.length - 1);

  // Map progress → percentage
  const pct = max === 0 ? 0 : (progress / max) * 100;

  // ── Spring-animate the playhead position via GSAP ─────────────────────────
  useEffect(() => {
    if (!playheadRef.current || !fillRef.current) return;
    gsap.to(playheadRef.current, {
      left: `${pct}%`,
      duration: 0.12,
      ease: "power2.out",
      overwrite: true,
    });
    gsap.to(fillRef.current, {
      width: `${pct}%`,
      duration: 0.12,
      ease: "power2.out",
      overwrite: true,
    });
  }, [pct]);

  // ── Drag handling ─────────────────────────────────────────────────────────
  function progressFromClientX(clientX: number) {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onProgressChange(ratio * max);
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    progressFromClientX(e.clientX);
  }, [max, onProgressChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    progressFromClientX(e.clientX);
  }, [max, onProgressChange]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const currentFrameLabel = frames[Math.min(Math.floor(progress), max)]?.dateLabel ?? "";

  // ── Hover state for moment dots ───────────────────────────────────────────
  const [hoveredTick, setHoveredTick] = React.useState<number | null>(null);

  return (
    <div className="relative border-t border-[#141414] bg-black select-none">
      {/* Moment markers row */}
      <div className="relative h-7 mx-6 mt-3">
        {frames.map((frame, i) => {
          const leftPct = max === 0 ? 50 : (i / max) * 100;
          const hasMoments = frame.moments.length > 0;
          const isActive = Math.round(progress) === i;

          return (
            <button
              key={frame.week}
              type="button"
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${leftPct}%` }}
              onMouseEnter={() => setHoveredTick(i)}
              onMouseLeave={() => setHoveredTick(null)}
              onClick={() => onProgressChange(i)}
            >
              {/* Moment cluster badge — only appears if changes exist */}
              {hasMoments && (
                <motion.div
                  className="mb-0.5 font-mono text-[8px] text-[#444] tracking-wider whitespace-nowrap"
                  animate={{
                    opacity: hoveredTick === i ? 1 : 0,
                    y: hoveredTick === i ? 0 : 2,
                  }}
                  transition={{ duration: 0.15 }}
                >
                  +{frame.moments.reduce((s, m) => s + m.count, 0)}
                </motion.div>
              )}

              {/* Tick */}
              <motion.div
                className="bg-[#2a2a2a]"
                animate={{
                  width: "1px",
                  height: isActive ? 14 : hasMoments ? 8 : 5,
                  backgroundColor: isActive ? "#ffffff" : hoveredTick === i ? "#666" : hasMoments ? "#444" : "#222",
                }}
                transition={{ duration: 0.2 }}
              />

              {/* Moment dot */}
              {hasMoments && (
                <motion.div
                  className="rounded-full mt-0.5"
                  animate={{
                    width: hoveredTick === i ? 5 : 3,
                    height: hoveredTick === i ? 5 : 3,
                    backgroundColor: isActive ? "#ffffff" : "#444",
                  }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Scrubber track */}
      <div className="mx-6 mb-2">
        <div
          ref={trackRef}
          className="relative h-px bg-[#1a1a1a] cursor-col-resize"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Progress fill */}
          <div
            ref={fillRef}
            className="absolute left-0 top-0 h-full bg-[#333]"
            style={{ width: `${pct}%` }}
          />

          {/* Spring playhead */}
          <div
            ref={playheadRef}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border border-black rounded-full cursor-grab active:cursor-grabbing"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      {/* Bottom row: date labels + controls */}
      <div className="flex items-center justify-between px-6 pb-3">
        {/* Date buttons */}
        <div className="flex items-center gap-5">
          {frames.map((frame, i) => (
            <button
              key={frame.week}
              type="button"
              onClick={() => onProgressChange(i)}
              className={`font-mono text-[9.5px] tracking-widest uppercase transition-all duration-200 ${
                Math.round(progress) === i
                  ? "text-white"
                  : "text-[#333] hover:text-[#666]"
              }`}
            >
              {frame.dateLabel}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-5 font-mono text-[9px] text-[#3a3a3a] tracking-widest">
          <button
            type="button"
            onClick={onRewind}
            className="hover:text-[#888] transition-colors duration-150 uppercase"
          >
            ⟨⟨
          </button>
          <button
            type="button"
            onClick={onStepBackward}
            className="hover:text-[#888] transition-colors duration-150 text-[12px]"
          >
            ‹
          </button>
          <motion.button
            type="button"
            onClick={onTogglePlay}
            className="font-mono text-[9px] tracking-widest uppercase min-w-[30px] text-[#888] hover:text-white transition-colors duration-150"
            whileTap={{ scale: 0.94 }}
          >
            {isPlaying ? "PAUSE" : "PLAY"}
          </motion.button>
          <button
            type="button"
            onClick={onStepForward}
            className="hover:text-[#888] transition-colors duration-150 text-[12px]"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
