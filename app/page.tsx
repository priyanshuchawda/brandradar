"use client";

import { useState } from "react";
import { HealLabApp } from "@/components/heal-lab-app";
import { MondayDiffApp } from "@/components/monday-diff-app";
import { ScanApp } from "@/components/scan-app";

type Face = "monday" | "heal" | "arena";

export default function Home() {
  const [face, setFace] = useState<Face>("monday");

  return (
    <div className="flex min-h-full flex-col">
      <nav className="border-b border-line bg-[#0b0e14]/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-tight">BrandRadar</p>
          <div className="flex gap-1 rounded-lg border border-line p-1">
            <FaceButton
              active={face === "monday"}
              onClick={() => setFace("monday")}
              label="Monday Diff"
            />
            <FaceButton
              active={face === "heal"}
              onClick={() => setFace("heal")}
              label="Heal Lab"
            />
            <FaceButton
              active={face === "arena"}
              onClick={() => setFace("arena")}
              label="Catalog arena"
            />
          </div>
        </div>
      </nav>
      {face === "monday" ? (
        <MondayDiffApp />
      ) : face === "heal" ? (
        <HealLabApp />
      ) : (
        <ScanApp />
      )}
    </div>
  );
}

function FaceButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-md px-3 text-xs ${
        active ? "bg-ping/15 text-ping" : "text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
