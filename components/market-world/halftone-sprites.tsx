"use client";

import React from "react";
import { motion } from "motion/react";
import type { ScraperStatus } from "@/lib/market-world";

/** Motion-Powered Halftone Dither Planet Territory */
export function HalftoneGlobeSprite({
  name,
  radius = 48,
  density = 80,
  isSelected = false,
  health = "healthy",
  discordChannel = "#roame",
}: {
  name: string;
  radius?: number;
  density?: number;
  isSelected?: boolean;
  health?: ScraperStatus;
  discordChannel?: string;
}) {
  const size = radius * 2;

  return (
    <motion.div
      layout
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: size, height: size }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        scale: isSelected ? 1.15 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Outer Inked Rough Outline Ring with Continuous Breathing Motion */}
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 pointer-events-none"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          repeat: Infinity,
          duration: 40,
          ease: "linear",
        }}
      >
        <circle
          cx={radius}
          cy={radius}
          r={radius - 2}
          fill="none"
          stroke="#ffffff"
          strokeWidth={isSelected ? "2" : "1"}
          strokeDasharray={health === "broken" ? "4 4" : isSelected ? "none" : "2 3"}
        />
        <circle
          cx={radius}
          cy={radius}
          r={radius - 8}
          fill="none"
          stroke="#555555"
          strokeWidth="1"
          strokeDasharray="1 3"
        />
      </motion.svg>

      {/* Halftone Core Dither Texture with Subtle Pulsing */}
      <motion.div
        className="rounded-full transition-colors"
        style={{
          width: radius * 1.5,
          height: radius * 1.5,
          backgroundImage: "radial-gradient(#ffffff 1.2px, transparent 1.2px)",
          backgroundSize: isSelected ? "3px 3px" : "5px 5px",
        }}
        animate={{
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{
          repeat: Infinity,
          duration: 3.5,
          ease: "easeInOut",
        }}
      />

      {/* Center Graphic Badge */}
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          className={`border px-2.5 py-0.5 font-sans font-black italic tracking-widest text-xs uppercase shadow-[2px_2px_0px_#ffffff] ${
            isSelected
              ? "border-white bg-white text-black font-extrabold"
              : "border-white bg-black text-white"
          }`}
          layoutId={`badge-${name}`}
        >
          {name}
        </motion.div>
        <span className="mt-1 font-mono text-[8px] tracking-wider text-neutral-400">
          {discordChannel}
        </span>
      </div>
    </motion.div>
  );
}

/** Animated Constellation Laser Beam between entities */
export function ConstellationBeam({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <motion.line
      x1={`${x1}%`}
      y1={`${y1}%`}
      x2={`${x2}%`}
      y2={`${y2}%`}
      stroke="#333333"
      strokeWidth="1"
      strokeDasharray="3 3"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.6 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    />
  );
}

/** Comic Speech Burst Badge with Entrance Motion */
export function ComicSpeechBurst({
  text = "MARKET NEVER STOPS.",
}: {
  text?: string;
}) {
  return (
    <motion.div
      className="relative inline-flex items-center justify-center select-none"
      initial={{ scale: 0, rotate: -15, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.1, rotate: 3 }}
    >
      <svg
        viewBox="0 0 160 80"
        className="h-16 w-36 text-black fill-black stroke-white stroke-2 drop-shadow-[3px_3px_0px_#ffffff]"
      >
        <polygon points="10,25 35,5 80,12 125,5 150,25 155,50 135,70 95,65 75,78 65,65 25,72 5,50" />
      </svg>
      <span className="absolute font-sans font-black italic text-[10px] tracking-wider text-white text-center uppercase leading-tight max-w-[90px]">
        {text}
      </span>
    </motion.div>
  );
}
