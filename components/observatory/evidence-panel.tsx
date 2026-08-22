"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";

interface EvidencePanelProps {
  item: {
    title: string;
    url: string;
    collectorId: string | null;
  } | null;
  onClose: () => void;
}

export function EvidencePanel({ item, onClose }: EvidencePanelProps) {
  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Evidence card */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[480px] bg-black border border-[#333] p-8 font-mono"
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <div className="flex justify-between items-start mb-6">
              <p className="text-[9px] text-[#444] uppercase tracking-widest">EVIDENCE</p>
              <button type="button" onClick={onClose} className="text-[#444] hover:text-white text-[11px]">✕</button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5">TITLE</p>
                <p className="text-white text-sm leading-snug">{item.title}</p>
              </div>

              <div>
                <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5">SOURCE</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#666] text-[11px] hover:text-white transition-colors break-all"
                >
                  {item.url}
                </a>
              </div>

              <div className="flex gap-8">
                <div>
                  <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5">COLLECTOR</p>
                  <p className="text-[#666] text-[11px]">{item.collectorId ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#444] uppercase tracking-widest mb-1.5">VERIFIED</p>
                  <p className="text-white text-[11px]">YES</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
