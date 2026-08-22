"use client";

/**
 * CompetitorTerritory — Hit target & floating data label.
 *
 * Placed in the outer quadrant of each competitor so labels never
 * collide with clusters, streaks, or connecting lines.
 */

import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import type { InterpolatedCompetitor, MarketSnapshotFrame } from "@/lib/market-world";

interface TerritoryProps {
  comp: InterpolatedCompetitor;
  frame: MarketSnapshotFrame;
  cx: number;
  cy: number;
  normX: number;
  normY: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
  addedCount: number;
  baselineCount: number;
}

export const CompetitorTerritory = React.memo(function CompetitorTerritory({
  comp,
  frame,
  cx,
  cy,
  normX,
  normY,
  isSelected,
  isHovered,
  onClick,
  onHover,
  addedCount,
  baselineCount,
}: TerritoryProps) {
  const gRef = useRef<SVGGElement>(null);

  // Smooth position
  useEffect(() => {
    if (!gRef.current) return;
    gsap.to(gRef.current, {
      attr: { transform: `translate(${cx},${cy})` },
      duration: 0.8,
      ease: "power2.out",
    });
  }, [cx, cy]);

  // Selection scale
  useEffect(() => {
    if (!gRef.current) return;
    gsap.to(gRef.current, {
      scale: isSelected ? 1.1 : isHovered ? 1.04 : 1,
      transformOrigin: "50% 50%",
      duration: 0.35,
      ease: "power2.out",
    });
  }, [isSelected, isHovered]);

  const itemCount = Math.round(comp.totalItems);
  const clusterRadius = 40 + itemCount * 5.0;
  const hitRadius = clusterRadius + 18;

  // Calculate actual percentage growth from baseline
  const netGrowth = itemCount - baselineCount;
  const growthPct = baselineCount > 0 ? Math.round((netGrowth / baselineCount) * 100) : 0;

  // Position label cleanly above or below based on quadrant
  const isTop = normY < 0;
  const labelY = isTop ? -(clusterRadius + 28) : clusterRadius + 22;

  return (
    <g
      ref={gRef}
      transform={`translate(${cx},${cy})`}
      style={{ cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={() => onHover(comp.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Invisible hit target circle matching cluster dimension */}
      <circle
        cx={0}
        cy={0}
        r={hitRadius}
        fill="transparent"
        stroke="none"
      />

      {/* Competitor Name */}
      <text
        x={0}
        y={labelY}
        textAnchor="middle"
        fill={isSelected ? "#ffffff" : isHovered ? "#ffffff" : "#c0c0c0"}
        fontSize={isSelected ? 11.5 : 10.5}
        fontFamily="var(--font-mono), monospace"
        fontWeight="600"
        letterSpacing="0.20em"
        style={{ transition: "fill 0.25s, font-size 0.25s" }}
        pointerEvents="none"
      >
        {comp.name.toUpperCase()}
      </text>

      {/* Item Count Metric */}
      <text
        x={0}
        y={labelY + 14}
        textAnchor="middle"
        fill={isSelected ? "#ffffff" : "#888888"}
        fontSize={9.5}
        fontFamily="var(--font-mono), monospace"
        fontWeight="400"
        letterSpacing="0.10em"
        style={{ transition: "fill 0.25s" }}
        pointerEvents="none"
      >
        {itemCount} {comp.surface}
      </text>

      {/* Growth Metric Badge */}
      {growthPct > 0 && (
        <text
          x={0}
          y={labelY + 26}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={8.5}
          fontFamily="var(--font-mono), monospace"
          letterSpacing="0.08em"
          opacity={0.85}
          pointerEvents="none"
        >
          +{growthPct}%
        </text>
      )}
    </g>
  );
});

export function radiusForCount(count: number): number {
  return 40 + count * 5.0;
}
