"use client";

/**
 * ParticleField — Living Monochrome Cosmic Data Field with 3D Warp Speed Tunnel.
 *
 * Visual System:
 *   1. 3D Perspective Warp Field — Light beams streaming straight forward towards the viewer.
 *   2. Dense Luminous Gaussian Clusters — Rich star clusters with crystalline mesh links.
 *   3. Rotating Multi-Ring Orbital Radar Reticles.
 *   4. Deep-Space Background Satellites & Nexus Data Transit Packets.
 *   5. Inward Product Ingestion Streams on live discoveries.
 */

import { useEffect, useRef, useCallback } from "react";
import type { InterpolatedMarketState } from "@/lib/market-world";

// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────

function mkRng(seed: number) {
  let s = (seed >>> 0) || 1;
  return (): number => {
    s = (Math.imul(s ^ (s >>> 15), s | 1) + Math.imul(s ^ (s >>> 7), s | 61) ^ s) >>> 0;
    return s / 4294967296;
  };
}

function idSeed(id: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 2654435761);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

// ─── Gaussian Distribution (Box-Muller) ───────────────────────────────────────

function gauss(rng: () => number, std: number): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * std;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WarpBeam {
  x: number; // 3D world space coordinate (-1200..1200)
  y: number;
  z: number; // 10..1000 (depth from camera)
  prevZ: number;
  speed: number;
  baseOp: number;
  lengthFactor: number;
}

interface StarPoint {
  x: number;
  y: number;
  sz: number;
  baseOp: number;
  speed: number;
  phase: number;
}

interface ClusterDot {
  dx: number;
  dy: number;
  sz: number;
  baseOp: number;
  isChip: boolean;
  isGlitter: boolean;
  driftR: number;
  driftSpeed: number;
  driftPhase: number;
}

interface MeshLink {
  i: number;
  j: number;
  op: number;
}

interface SatelliteGalaxy {
  x: number;
  y: number;
  dots: Array<{ dx: number; dy: number; sz: number; op: number }>;
  links: Array<{ i: number; j: number }>;
}

interface ClusterEntity {
  id: string;
  dots: ClusterDot[];
  meshLinks: MeshLink[];
  arcs: Array<{
    radius: number;
    start: number;
    len: number;
    op: number;
    speed: number;
    phase: number;
  }>;
}

interface IngestionStream {
  id: string;
  sourceAngle: number;
  progress: number;
  speed: number;
  sz: number;
}

// ─── 3D Warp-Speed Light Beams Pool (Straight Forward at Viewer) ───────────────

const WARP_BEAM_COUNT = 180;

function createWarpBeams(): WarpBeam[] {
  const rng = mkRng(0xabcdef01);
  const beams: WarpBeam[] = [];

  for (let i = 0; i < WARP_BEAM_COUNT; i++) {
    const angle = rng() * Math.PI * 2;
    // Radial distribution in 3D world plane
    const dist = 60 + Math.pow(rng(), 1.5) * 1100;
    const z = 40 + rng() * 960;

    beams.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      z,
      prevZ: z + 15,
      speed: 60 + rng() * 80, // Smooth, slow ambient velocity
      baseOp: 0.10 + rng() * 0.22,
      lengthFactor: 3.5 + rng() * 4.0,
    });
  }

  return beams;
}

// ─── Ambient Stars ────────────────────────────────────────────────────────────

function buildBackgroundStars(): StarPoint[] {
  const rng = mkRng(0x456789ab);
  const stars: StarPoint[] = [];
  for (let i = 0; i < 280; i++) {
    stars.push({
      x: rng(),
      y: rng(),
      sz: rng() < 0.06 ? 1.5 + rng() * 1.2 : 0.4 + rng() * 0.8,
      baseOp: 0.03 + rng() * 0.14,
      speed: 0.4 + rng() * 1.8,
      phase: rng() * Math.PI * 2,
    });
  }
  return stars;
}

// ─── Deep-Space Satellites ─────────────────────────────────────────────────────

function buildSatelliteGalaxies(): SatelliteGalaxy[] {
  const rng = mkRng(0x13579bdf);
  const satellites: SatelliteGalaxy[] = [];
  const coords = [
    { x: 0.12, y: 0.18 },
    { x: 0.88, y: 0.16 },
    { x: 0.08, y: 0.50 },
    { x: 0.92, y: 0.56 },
    { x: 0.14, y: 0.82 },
    { x: 0.88, y: 0.84 },
    { x: 0.50, y: 0.50 },
  ];

  for (const pos of coords) {
    const isCenter = pos.x === 0.5 && pos.y === 0.5;
    const dotCount = isCenter ? 48 : 20 + Math.floor(rng() * 12);
    const sigma = isCenter ? 30 : 16;
    const dots: SatelliteGalaxy["dots"] = [];

    for (let i = 0; i < dotCount; i++) {
      const dx = gauss(rng, sigma);
      const dy = gauss(rng, sigma);
      dots.push({
        dx,
        dy,
        sz: 0.5 + rng() * 1.0,
        op: isCenter ? 0.12 + rng() * 0.28 : 0.07 + rng() * 0.20,
      });
    }

    const links: SatelliteGalaxy["links"] = [];
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const d = Math.hypot(dots[i].dx - dots[j].dx, dots[i].dy - dots[j].dy);
        if (d < (isCenter ? 20 : 14) && links.length < 50) {
          links.push({ i, j });
        }
      }
    }

    satellites.push({ x: pos.x, y: pos.y, dots, links });
  }

  return satellites;
}

const BG_STARS = buildBackgroundStars();
const SATELLITES = buildSatelliteGalaxies();

// ─── Competitor Cluster Builder ───────────────────────────────────────────────

function buildCompetitorCluster(id: string, itemCount: number): ClusterEntity {
  const rng = mkRng(idSeed(id));

  const coreCount = Math.round(32 + itemCount * 12);
  const midCount  = Math.round(70 + itemCount * 18);
  const haloCount = Math.round(50 + itemCount * 14);

  const dots: ClusterDot[] = [];

  const coreSigma = 11 + itemCount * 1.3;
  const midSigma  = 30 + itemCount * 3.0;
  const haloSigma = 54 + itemCount * 4.8;

  // 1. Dense Core (Bright white, square chips, glitter)
  for (let i = 0; i < coreCount; i++) {
    const dx = gauss(rng, coreSigma);
    const dy = gauss(rng, coreSigma);
    const isChip = rng() < 0.24;
    dots.push({
      dx,
      dy,
      sz: isChip ? 1.8 + rng() * 1.4 : 0.8 + rng() * 1.7,
      baseOp: 0.72 + rng() * 0.28,
      isChip,
      isGlitter: rng() < 0.38,
      driftR: 0,
      driftSpeed: 0,
      driftPhase: 0,
    });
  }

  // 2. Mid Field
  for (let i = 0; i < midCount; i++) {
    const r = Math.abs(gauss(rng, midSigma));
    const theta = rng() * Math.PI * 2;
    const hasDrift = rng() < 0.22;
    dots.push({
      dx: Math.cos(theta) * r,
      dy: Math.sin(theta) * r,
      sz: 0.6 + rng() * 1.3,
      baseOp: 0.28 + rng() * 0.40,
      isChip: rng() < 0.10,
      isGlitter: rng() < 0.18,
      driftR: hasDrift ? 2 + rng() * 5 : 0,
      driftSpeed: hasDrift ? 0.04 + rng() * 0.08 : 0,
      driftPhase: rng() * Math.PI * 2,
    });
  }

  // 3. Outer Nebula Halo
  for (let i = 0; i < haloCount; i++) {
    const r = Math.abs(gauss(rng, haloSigma));
    const theta = rng() * Math.PI * 2;
    dots.push({
      dx: Math.cos(theta) * r,
      dy: Math.sin(theta) * r,
      sz: 0.4 + rng() * 0.8,
      baseOp: 0.05 + rng() * 0.16,
      isChip: false,
      isGlitter: false,
      driftR: 0,
      driftSpeed: 0,
      driftPhase: 0,
    });
  }

  // Crystalline Intra-Cluster Mesh
  const meshLinks: MeshLink[] = [];
  const maxDist = 20 + itemCount * 1.0;
  const maxSearch = Math.min(dots.length, 120);
  for (let i = 0; i < maxSearch; i++) {
    for (let j = i + 1; j < maxSearch; j++) {
      const d = Math.hypot(dots[i].dx - dots[j].dx, dots[i].dy - dots[j].dy);
      if (d < maxDist && meshLinks.length < 170) {
        meshLinks.push({
          i,
          j,
          op: Math.max(0.04, (1 - d / maxDist) * 0.22),
        });
      }
    }
  }

  // Orbital Radar Arcs
  const baseR = 46 + itemCount * 4.5;
  const arcs = [
    {
      radius: baseR,
      start: rng() * Math.PI * 2,
      len: Math.PI * (0.45 + rng() * 0.75),
      op: 0.16,
      speed: 0.010 + rng() * 0.014,
      phase: rng() * Math.PI * 2,
    },
    {
      radius: baseR * 1.50,
      start: rng() * Math.PI * 2,
      len: Math.PI * (0.30 + rng() * 0.55),
      op: 0.09,
      speed: -(0.007 + rng() * 0.010),
      phase: rng() * Math.PI * 2,
    },
  ];

  return { id, dots, meshLinks, arcs };
}

// ─── Drawing Helpers ──────────────────────────────────────────────────────────

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sz: number,
  op: number,
  isChip: boolean,
) {
  ctx.globalAlpha = Math.min(1, Math.max(0, op));
  if (isChip) {
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, sz / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  op: number,
  lw: number,
) {
  ctx.globalAlpha = Math.min(1, Math.max(0, op));
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, op: number) {
  ctx.globalAlpha = op;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ParticleFieldProps {
  state: InterpolatedMarketState;
  width: number;
  height: number;
  selectedId: string | null;
}

export const OBS_SCALE_X = 0.68;
export const OBS_SCALE_Y = 0.64;

export function ParticleField({ state, width, height, selectedId }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const lastTRef = useRef<number | null>(null);

  // 3D Warp Beams Pool
  const warpBeams = useRef<WarpBeam[]>(createWarpBeams());

  // Cached clusters per competitor
  const clusterCache = useRef<Map<string, ClusterEntity>>(new Map());

  // Ingestion streams pool
  const streamPool = useRef<IngestionStream[]>([]);

  const getCluster = useCallback((id: string, itemCount: number): ClusterEntity => {
    const key = `${id}:${Math.round(itemCount * 2) / 2}`;
    if (!clusterCache.current.has(key)) {
      clusterCache.current.set(key, buildCompetitorCluster(id, itemCount));
    }
    return clusterCache.current.get(key)!;
  }, []);

  // ─── 60 FPS Render Pass ─────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = width * dpr;
    const ch = height * dpr;
    const cx = cw / 2;
    const cy = ch / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";

    const t = timeRef.current;
    const dt = Math.min(0.05, lastTRef.current ? (performance.now() - lastTRef.current) / 1000 : 0.016);

    // ── 1. 3D Warp Speed Tunnel Beams (Coming Straight At Viewer) ────────────
    const fov = Math.min(cw, ch) * 0.65;
    const beams = warpBeams.current;

    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];

      b.prevZ = b.z;
      b.z -= b.speed * dt;

      // Project current 3D position to 2D screen
      if (b.z <= 12) {
        // Reset beam when passing camera plane
        b.z = 980 + Math.random() * 40;
        b.prevZ = b.z + 30;
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.pow(Math.random(), 1.5) * 1100;
        b.x = Math.cos(angle) * dist;
        b.y = Math.sin(angle) * dist;
        continue;
      }

      const currSx = cx + (b.x / b.z) * fov;
      const currSy = cy + (b.y / b.z) * fov;

      // Graceful trail elongation at slow pace
      const trailZ = Math.min(1000, b.z + (b.speed * dt * b.lengthFactor * 5.5));
      const prevSx = cx + (b.x / trailZ) * fov;
      const prevSy = cy + (b.y / trailZ) * fov;

      // Check if off-screen
      if (
        currSx < -100 ||
        currSx > cw + 100 ||
        currSy < -100 ||
        currSy > ch + 100
      ) {
        b.z = 980 + Math.random() * 40;
        b.prevZ = b.z + 30;
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.pow(Math.random(), 1.5) * 1100;
        b.x = Math.cos(angle) * dist;
        b.y = Math.sin(angle) * dist;
        continue;
      }

      // Smooth depth-fading: subtle near center (high z), radiant as it passes viewer
      const depthRatio = 1.0 - b.z / 1000;
      const op = Math.min(0.24, depthRatio * depthRatio * b.baseOp);
      const lw = (0.5 + depthRatio * 0.8) * dpr;

      drawLine(ctx, prevSx, prevSy, currSx, currSy, op, lw);
    }

    // ── 2. Ambient Deep Space Stars ───────────────────────────────────────────
    for (const star of BG_STARS) {
      const pulse = Math.sin(t * star.speed + star.phase) * 0.04;
      const op = Math.max(0.016, star.baseOp + pulse);
      drawDot(ctx, star.x * cw, star.y * ch, star.sz * dpr, op, false);
    }

    // ── 3. Deep Space Satellite Galaxies ──────────────────────────────────────
    for (const sat of SATELLITES) {
      const sx = sat.x * cw;
      const sy = sat.y * ch;

      for (const link of sat.links) {
        const a = sat.dots[link.i];
        const b = sat.dots[link.j];
        drawLine(
          ctx,
          sx + a.dx * dpr,
          sy + a.dy * dpr,
          sx + b.dx * dpr,
          sy + b.dy * dpr,
          0.035,
          0.4 * dpr,
        );
      }

      for (const d of sat.dots) {
        drawDot(ctx, sx + d.dx * dpr, sy + d.dy * dpr, d.sz * dpr, d.op, false);
      }

      drawCrosshair(ctx, sx, sy, 4.5 * dpr, 0.18);
    }

    // Competitors in Screen Space
    const comps = state.competitors.map((comp) => ({
      id: comp.id,
      normX: comp.x,
      normY: comp.y,
      px: cx + comp.x * OBS_SCALE_X * cw,
      py: cy + comp.y * OBS_SCALE_Y * ch,
      items: comp.totalItems,
      hasNew: comp.hasNewItems,
      isSelected: comp.id === selectedId,
    }));

    // ── 4. Telemetry Grid Bus Lines & Live Packets ────────────────────────────
    ctx.setLineDash([3, 12]);
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const a = comps[i];
        const b = comps[j];
        const dim = selectedId && selectedId !== a.id && selectedId !== b.id;
        const lineOp = dim ? 0.02 : 0.08;

        drawLine(ctx, a.px, a.py, b.px, b.py, lineOp, 0.55 * dpr);

        if (!dim) {
          const packetPhase = (t * 0.28 + (i + j) * 0.25) % 1.0;
          const pkx = a.px + (b.px - a.px) * packetPhase;
          const pky = a.py + (b.py - a.py) * packetPhase;
          drawDot(ctx, pkx, pky, 2.6 * dpr, 0.65, true);
        }
      }
    }
    ctx.setLineDash([]);

    // ── 5. Competitor Galaxy Clusters ─────────────────────────────────────────
    for (const comp of comps) {
      const cluster = getCluster(comp.id, comp.items);
      const dim = selectedId && !comp.isSelected ? 0.28 : 1.0;
      const scale = comp.isSelected ? 1.15 : 1.0;
      const { px, py } = comp;

      // A. Multi-Ring Orbital Radar Reticles
      for (const arc of cluster.arcs) {
        const rot = arc.phase + t * arc.speed;
        ctx.globalAlpha = arc.op * dim;
        ctx.lineWidth = 0.55 * dpr;
        ctx.beginPath();
        ctx.arc(px, py, arc.radius * scale * dpr, rot + arc.start, rot + arc.start + arc.len);
        ctx.stroke();

        const tx = px + Math.cos(rot + arc.start) * arc.radius * scale * dpr;
        const ty = py + Math.sin(rot + arc.start) * arc.radius * scale * dpr;
        drawDot(ctx, tx, ty, 2 * dpr, arc.op * 1.5 * dim, true);
      }

      // B. Crystalline Intra-Cluster Mesh Web
      for (const link of cluster.meshLinks) {
        const a = cluster.dots[link.i];
        const b = cluster.dots[link.j];
        drawLine(
          ctx,
          px + a.dx * scale * dpr,
          py + a.dy * scale * dpr,
          px + b.dx * scale * dpr,
          py + b.dy * scale * dpr,
          link.op * dim,
          0.4 * dpr,
        );
      }

      // C. Cluster Particles (Dense Core, Mid, Halo)
      for (let i = 0; i < cluster.dots.length; i++) {
        const d = cluster.dots[i];
        let x = px + d.dx * scale * dpr;
        let y = py + d.dy * scale * dpr;

        if (d.driftR > 0) {
          const phi = d.driftPhase + t * d.driftSpeed;
          x += Math.cos(phi) * d.driftR * dpr;
          y += Math.sin(phi) * d.driftR * dpr;
        }

        let op = d.baseOp * dim;
        if (d.isGlitter) {
          op *= 0.8 + Math.sin(t * 3.5 + i) * 0.25;
        }

        drawDot(ctx, x, y, d.sz * scale * dpr, op, d.isChip);
      }

      // D. Radiant Nucleus & Crosshair Star
      if (dim > 0.5) {
        drawDot(ctx, px, py, 3.2 * dpr, 1.0, false);
        drawDot(ctx, px, py, 6.5 * dpr, 0.32, false);
        drawDot(ctx, px, py, 12.0 * dpr, 0.10, false);

        drawCrosshair(ctx, px, py, 16 * scale * dpr, 0.35 * dim);
      }
    }

    // ── 6. Inward Product Ingestion Streams ────────────────────────────────────
    if (state.competitors.some((c) => c.hasNewItems)) {
      if (Math.random() < 0.28 && streamPool.current.length < 24) {
        const activeComp = comps.find((c) => c.hasNew) || comps[0];
        streamPool.current.push({
          id: `${activeComp.id}-${Math.random()}`,
          sourceAngle: Math.random() * Math.PI * 2,
          progress: 0,
          speed: 0.03 + Math.random() * 0.03,
          sz: 1.6 + Math.random() * 1.2,
        });
      }
    }

    streamPool.current = streamPool.current.filter((p) => {
      p.progress += p.speed;
      if (p.progress >= 1.0) return false;

      const activeComp = comps.find((c) => p.id.startsWith(c.id)) || comps[0];
      const startDist = 160 * dpr;
      const endDist = 14 * dpr;
      const currentDist = startDist * (1.0 - p.progress) + endDist * p.progress;

      const sx = activeComp.px + Math.cos(p.sourceAngle) * currentDist;
      const sy = activeComp.py + Math.sin(p.sourceAngle) * currentDist;

      const trailDist = 10 * dpr;
      const tx = sx + Math.cos(p.sourceAngle) * trailDist;
      const ty = sy + Math.sin(p.sourceAngle) * trailDist;

      drawLine(ctx, sx, sy, tx, ty, (1.0 - p.progress) * 0.65, 0.6 * dpr);
      drawDot(ctx, sx, sy, p.sz * dpr, (1.0 - p.progress) * 0.9, true);

      return true;
    });

    ctx.globalAlpha = 1;
  }, [state, width, height, selectedId, getCluster]);

  // ─── 60 FPS Animation Loop ──────────────────────────────────────────────────
  useEffect(() => {
    function loop(now: number) {
      if (lastTRef.current !== null) {
        timeRef.current += (now - lastTRef.current) / 1000;
      }
      render();
      lastTRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTRef.current = null;
    };
  }, [render]);

  // ─── Resize & DPR Support ───────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
