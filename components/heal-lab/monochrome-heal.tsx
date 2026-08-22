"use client";

import React, { useState } from "react";
import { StatusGlyph } from "@/components/market-world/pixel-primitives";
import type { ScraperStatus } from "@/lib/market-world";

export function MonochromeHealTerminal() {
  const [stage, setStage] = useState<ScraperStatus>("healthy");
  const [collectorId, setCollectorId] = useState("c_mt3ekwjs2lzsn3dwl7");
  const [beforeCount, setBeforeCount] = useState(6);
  const [afterCount, setAfterCount] = useState(0);
  const [recoveredCount, setRecoveredCount] = useState(6);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "Collector c_mt3ekwjs2lzsn3dwl7 initialized in Bright Data Scraper Studio.",
    "Baseline layout /before: 6 items extracted cleanly (100% QA pass).",
  ]);

  function triggerHeal() {
    setIsRunning(true);
    setStage("broken");
    setLogs((prev) => [
      ...prev,
      "⚡ DOM redesign detected on target URL — selectors broken.",
      "◌ Scraper returned 0 rows (Extraction disruption flagged).",
    ]);

    setTimeout(() => {
      setStage("healing");
      setLogs((prev) => [
        ...prev,
        "◌ AI Self-Healing loop triggered on collector c_mt3ekwjs2lzsn3dwl7...",
        "◌ Reconciling selectors & validating schema fields...",
      ]);

      setTimeout(() => {
        setStage("recovered");
        setIsRunning(false);
        setLogs((prev) => [
          ...prev,
          "● Self-Healing verified: 6/6 items recovered.",
          "● Collector ID preserved: c_mt3ekwjs2lzsn3dwl7 (Zero pipeline disruption).",
          "● Recovery alert dispatched to Discord #heal-alerts.",
        ]);
      }, 2400);
    }, 1800);
  }

  function reset() {
    setStage("healthy");
    setLogs([
      "Collector c_mt3ekwjs2lzsn3dwl7 initialized in Bright Data Scraper Studio.",
      "Baseline layout /before: 6 items extracted cleanly (100% QA pass).",
    ]);
  }

  return (
    <div className="flex flex-col gap-6 border border-neutral-900 bg-black p-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white">■</span>
            <h2 className="text-base font-bold tracking-widest text-white uppercase">
              HEAL LAB // SCRAPER SELF-HEALING ENGINE
            </h2>
            <StatusGlyph status={stage} />
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Automated selector reconciliation preserving the same Bright Data Collector ID ({collectorId})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRunning}
            onClick={triggerHeal}
            className="border border-white bg-white px-4 py-2 text-black font-bold hover:bg-neutral-200 disabled:opacity-50"
          >
            {isRunning ? "[HEALING IN PROGRESS...]" : "[SIMULATE DOM BREAK & TRIGGER SELF-HEAL]"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="border border-neutral-800 px-3 py-2 text-neutral-400 hover:border-white hover:text-white"
          >
            [RESET]
          </button>
        </div>
      </div>

      {/* 3-Stage Progression Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`border p-4 transition-all ${
            stage === "healthy" ? "border-white bg-neutral-950" : "border-neutral-900 bg-black opacity-50"
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-2 text-[10px]">
            <span className="text-white font-bold">1. HEALTHY BASELINE</span>
            <span className="text-neutral-500">/before</span>
          </div>
          <p className="text-[11px] text-neutral-300">
            Collector extracts <strong className="text-white">{beforeCount} items</strong> with 100% QA pass rate.
          </p>
        </div>

        <div
          className={`border p-4 transition-all ${
            stage === "broken" ? "border-neutral-400 bg-neutral-950" : "border-neutral-900 bg-black opacity-50"
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-2 text-[10px]">
            <span className="text-white font-bold">2. DOM DISRUPTION</span>
            <span className="text-neutral-500">/after</span>
          </div>
          <p className="text-[11px] text-neutral-300">
            Selectors break; scraper drops to <strong className="text-white">{afterCount} items</strong>.
          </p>
        </div>

        <div
          className={`border p-4 transition-all ${
            stage === "healing" || stage === "recovered" ? "border-white bg-neutral-950" : "border-neutral-900 bg-black opacity-50"
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-2 text-[10px]">
            <span className="text-white font-bold">3. SELF-HEALING RECOVERY</span>
            <span className="text-neutral-500">{collectorId}</span>
          </div>
          <p className="text-[11px] text-neutral-300">
            {stage === "healing" ? (
              <span>Reconstructing selectors via Scraper Studio AI...</span>
            ) : stage === "recovered" ? (
              <span>Recovered <strong className="text-white">{recoveredCount}/{beforeCount} items</strong> on same Collector ID.</span>
            ) : (
              "Standby."
            )}
          </p>
        </div>
      </div>

      {/* Real-time Telemetry Terminal Log */}
      <div className="border border-neutral-900 bg-neutral-950 p-4">
        <div className="flex items-center justify-between border-b border-neutral-900 pb-2 mb-2 text-[10px] text-neutral-500">
          <span className="uppercase">SCRAPER STUDIO TELEMETRY LOG:</span>
          <span>CONSOLE OUTPUT</span>
        </div>
        <div className="flex flex-col gap-1 text-[11px] max-h-40 overflow-y-auto">
          {logs.map((msg, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-neutral-600">[{new Date().toLocaleTimeString()}]</span>
              <span className={msg.includes("Disruption") || msg.includes("broken") ? "text-neutral-400 font-bold" : "text-neutral-200"}>
                {msg}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
