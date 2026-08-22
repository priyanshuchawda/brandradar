"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import type { MarketSnapshotFrame, CompetitorFrame } from "@/lib/market-world";
import type { GrowthPath } from "@/lib/market-world";

interface InspectorDrawerProps {
  rivalId: string | null;
  frames: MarketSnapshotFrame[];
  growthPath: GrowthPath | null;
  onClose: () => void;
  onOpenEvidence: (item: { title: string; url: string; collectorId: string | null }) => void;
}

export function InspectorDrawer({
  rivalId,
  frames,
  growthPath,
  onClose,
  onOpenEvidence,
}: InspectorDrawerProps) {
  if (!rivalId || !growthPath) return null;

  const latestFrame = frames[frames.length - 1];
  const comp: CompetitorFrame | undefined = latestFrame?.competitors.find((c) => c.id === rivalId);
  const firstComp = frames[0]?.competitors.find((c) => c.id === rivalId);

  const netDelta = (comp?.totalItems ?? 0) - (firstComp?.totalItems ?? 0);

  // Direction as observed across time
  const dirSymbol = growthPath.direction === "growing" ? "↑" : growthPath.direction === "shrinking" ? "↓" : "→";

  return (
    <AnimatePresence>
      {rivalId && (
        <motion.aside
          key="inspector"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-[340px] bg-black border-l border-[#222] z-20 flex flex-col overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#1a1a1a]">
            <div>
              <motion.h2
                layoutId={`rival-name-${rivalId}`}
                className="font-sans text-2xl font-bold tracking-widest uppercase text-white"
              >
                {comp?.name ?? rivalId}
              </motion.h2>
              <p className="font-mono text-[10px] text-[#444] mt-1 tracking-widest uppercase">
                {comp?.surface} · {comp?.updateUrl.replace("https://", "")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[11px] text-[#444] hover:text-white transition-colors mt-1"
            >
              ✕
            </button>
          </div>

          {/* Primary metrics */}
          <div className="px-6 py-5 border-b border-[#1a1a1a]">
            <div className="flex items-baseline gap-4">
              <span className="font-sans text-4xl font-bold text-white tabular-nums">
                {comp?.totalItems ?? 0}
              </span>
              <span className={`font-mono text-sm ${netDelta > 0 ? "text-white" : netDelta < 0 ? "text-[#666]" : "text-[#444]"}`}>
                {netDelta > 0 ? "+" : ""}{netDelta} {dirSymbol}
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#444] mt-1 tracking-widest">
              ITEMS ON {comp?.surface?.toUpperCase()} SURFACE
            </p>
          </div>

          {/* Observed direction across time */}
          <div className="px-6 py-4 border-b border-[#1a1a1a]">
            <p className="font-mono text-[9px] text-[#444] uppercase tracking-widest mb-3">
              OBSERVED DIRECTION
            </p>
            <div className="space-y-2">
              {growthPath.steps.map((step, i) => {
                const prev = growthPath.steps[i - 1];
                const delta = prev ? step.totalItems - prev.totalItems : 0;
                return (
                  <div key={step.week} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-[#555]">{step.dateLabel}</span>
                    <span className="text-white tabular-nums">{step.totalItems}</span>
                    <span className={`w-8 text-right ${delta > 0 ? "text-white" : delta < 0 ? "text-[#555]" : "text-[#333]"}`}>
                      {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent moments / events */}
          <div className="px-6 py-4 border-b border-[#1a1a1a]">
            <p className="font-mono text-[9px] text-[#444] uppercase tracking-widest mb-3">
              OBSERVED CHANGES
            </p>
            <div className="space-y-3">
              {growthPath.steps
                .flatMap((step) => step.moments)
                .filter(Boolean)
                .slice()
                .reverse()
                .slice(0, 6)
                .map((moment) => (
                  <div key={moment.id} className="flex gap-3">
                    <span className="font-mono text-[10px] text-[#444] shrink-0 w-14">{moment.date}</span>
                    <span className="font-mono text-[10px] text-[#888]">{moment.description}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Latest items — scraped evidence */}
          <div className="px-6 py-4 border-b border-[#1a1a1a]">
            <p className="font-mono text-[9px] text-[#444] uppercase tracking-widest mb-3">
              LATEST OBSERVED ITEMS
            </p>
            <div className="space-y-2">
              {(comp?.items ?? []).slice(-5).reverse().map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenEvidence({ title: item.title, url: item.url, collectorId: item.collectorId })}
                  className="w-full text-left group"
                >
                  <div className="flex items-start gap-2">
                    <span className={`font-mono text-[8px] mt-0.5 shrink-0 ${
                      item.status === "new" ? "text-white" : "text-[#333]"
                    }`}>
                      {item.status === "new" ? "+" : "·"}
                    </span>
                    <span className="font-mono text-[10px] text-[#666] group-hover:text-white transition-colors leading-snug">
                      {item.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Collector info */}
          <div className="px-6 py-4">
            <div className="space-y-1.5 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-[#444] uppercase tracking-widest">COLLECTOR</span>
                <span className="text-[#666]">{comp?.collectorId ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#444] uppercase tracking-widest">QA</span>
                <span className="text-[#666]">{latestFrame?.signalHealth.score}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#444] uppercase tracking-widest">STATUS</span>
                <span className={`${comp?.health === "healthy" ? "text-white" : "text-[#666]"} uppercase`}>
                  {comp?.health ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
