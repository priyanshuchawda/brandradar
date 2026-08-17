import { spawn } from "node:child_process";
import path from "node:path";
import { collectorIdFor } from "./brightdata";
import type { Snapshot } from "./schema";

const STUDIO_TIMEOUT_MS = 180_000;

export function isStudioCollectorId(id: string): boolean {
  return /^c_[a-z0-9]+$/i.test(id) && !id.toLowerCase().startsWith("c_mock");
}

export function resolveStudioCollector(snapshot: Snapshot): string | undefined {
  const fromSnap = snapshot.health.collector_ids.find(isStudioCollectorId);
  if (fromSnap) return fromSnap;
  if (snapshot.mode === "mock") return undefined;
  return (
    collectorIdFor(snapshot.brand.domain, "pdp") ||
    collectorIdFor(snapshot.brand.domain, "discovery")
  );
}

export function healAnchorUrl(snapshot: Snapshot): string {
  const itemUrl = snapshot.items.find((item) => item.url)?.url;
  return itemUrl || snapshot.brand.url;
}

function redact(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "[redacted]",
    )
    .slice(0, 4000);
}

export async function runStudioCli(
  action: "run" | "heal" | "approve",
  args: string[],
): Promise<{ ok: boolean; output: string }> {
  const collectorId = args[0];
  if (!collectorId || !isStudioCollectorId(collectorId)) {
    return { ok: false, output: "Invalid collector id" };
  }
  const script = path.join(process.cwd(), "scripts", "studio.sh");
  return new Promise((resolve) => {
    const child = spawn(script, [action, ...args], {
      cwd: process.cwd(),
      env: process.env,
      timeout: STUDIO_TIMEOUT_MS,
    });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: redact(output) });
    });
    child.on("error", (error) => {
      resolve({ ok: false, output: redact(error.message) });
    });
  });
}
