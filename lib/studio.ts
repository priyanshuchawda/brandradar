import { spawn } from "node:child_process";
import { collectorIdFor } from "./brightdata";
import type { Snapshot } from "./schema";

import { healRuntimeBudget, type HealRuntimeBudget } from "./runtime-env";

/** Collection runs are usually quick; heal AI Flow needs CLI poll window (capped on Vercel). */
const STUDIO_RUN_TIMEOUT_MS = 180_000;

export function studioHealTimeoutMs(overrideMs?: number): number {
  if (overrideMs) return overrideMs;
  return healRuntimeBudget().healTimeoutMs;
}

export function studioHealCliTimeoutSec(overrideSec?: number): number {
  if (overrideSec) return overrideSec;
  return healRuntimeBudget().healCliTimeoutSec;
}

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

function studioEnv(): NodeJS.ProcessEnv {
  const token =
    process.env.BRIGHTDATA_API_KEY?.trim() ||
    process.env.BRIGHT_DATA_API_TOKEN?.trim();
  return {
    ...process.env,
    ...(token ? { BRIGHTDATA_API_KEY: token } : {}),
  };
}

export type StudioCliOptions = {
  /** Heal: approve at gate and poll through to done (BD CLI). Default true for heal. */
  autoApprove?: boolean;
  /** Heal/approve: persist template after success (BD `auto_save`). Default true with autoApprove. */
  autoSave?: boolean;
  /** Approve: discard pending refactor and unlock collector for a new heal. */
  reject?: boolean;
  timeoutMs?: number;
  /** Heal CLI poll cap in seconds (BD `--timeout`). */
  healCliTimeoutSec?: number;
};

/** BD returns 409 when a prior refactor/heal job is still open. */
export function isRefactorJobConflict(output: string): boolean {
  const text = output.toLowerCase();
  return (
    text.includes("409") ||
    text.includes("another refactor") ||
    text.includes("refactor job is still in progress") ||
    text.includes("job is still in progress")
  );
}

/** Drop a stuck Studio refactor so heal can start again. */
export async function unlockStuckRefactorJob(
  collectorId: string,
  url: string,
  options?: Pick<StudioCliOptions, "timeoutMs">,
): Promise<{ ok: boolean; output: string }> {
  return runStudioCli("approve", [collectorId, url], {
    reject: true,
    autoSave: false,
    timeoutMs: options?.timeoutMs ?? STUDIO_RUN_TIMEOUT_MS,
  });
}

function bdataArgs(
  action: "run" | "heal" | "approve",
  args: string[],
  options?: StudioCliOptions,
): string[] {
  const [collectorId, url, prompt] = args;
  if (action === "run") {
    return ["-p", "@brightdata/cli", "bdata", "scraper", "run", collectorId, url, "--pretty"];
  }
  if (action === "heal") {
    const timeoutSec = options?.healCliTimeoutSec ?? studioHealCliTimeoutSec();
    const out = [
      "-p",
      "@brightdata/cli",
      "bdata",
      "scraper",
      "heal",
      collectorId,
      prompt ?? "",
      "--url",
      url,
      "--pretty",
      "--timeout",
      String(timeoutSec),
    ];
    // BD Workflow 2: preview≠published unless we approve+save through to done.
    if (options?.autoApprove !== false) {
      out.push("--auto-approve");
      if (options?.autoSave !== false) out.push("--auto-save");
    }
    return out;
  }
  const approve = [
    "-p",
    "@brightdata/cli",
    "bdata",
    "scraper",
    "approve",
    collectorId,
    "--url",
    url,
    "--pretty",
  ];
  if (options?.reject) approve.push("--reject");
  else if (options?.autoSave !== false) approve.push("--auto-save");
  return approve;
}

/** Heal with one automatic unlock+retry when BD reports an open refactor job. */
export async function runStudioHealCli(
  args: string[],
  options?: StudioCliOptions,
): Promise<{ ok: boolean; output: string; unlocked: boolean }> {
  let result = await runStudioCli("heal", args, options);
  if (!isRefactorJobConflict(result.output)) {
    return { ...result, unlocked: false };
  }
  const [collectorId, url] = args;
  if (!collectorId || !url) return { ...result, unlocked: false };
  const unlocked = await unlockStuckRefactorJob(collectorId, url, options);
  if (!unlocked.ok) {
    return {
      ok: false,
      output: `${result.output}\n--- unlock failed ---\n${unlocked.output}`,
      unlocked: false,
    };
  }
  result = await runStudioCli("heal", args, options);
  return { ...result, unlocked: true };
}

export async function runStudioCli(
  action: "run" | "heal" | "approve",
  args: string[],
  options?: StudioCliOptions,
): Promise<{ ok: boolean; output: string }> {
  const collectorId = args[0];
  if (!collectorId || !isStudioCollectorId(collectorId)) {
    return { ok: false, output: "Invalid collector id" };
  }
  const timeoutMs =
    options?.timeoutMs ??
    (action === "heal" ? studioHealTimeoutMs() : STUDIO_RUN_TIMEOUT_MS);

  return new Promise((resolve) => {
    const child = spawn("npx", bdataArgs(action, args, options), {
      cwd: process.cwd(),
      env: studioEnv(),
      timeout: timeoutMs,
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

/** Pull JSON object or array from CLI output (ignores npm notices). */
export function extractJsonBlob(text: string): unknown | null {
  const objStart = text.indexOf("{");
  if (objStart >= 0) {
    const end = text.lastIndexOf("}");
    if (end > objStart) {
      try {
        return JSON.parse(text.slice(objStart, end + 1));
      } catch {
        // fall through
      }
    }
  }
  const arrStart = text.indexOf("[");
  if (arrStart >= 0) {
    const end = text.lastIndexOf("]");
    if (end > arrStart) {
      try {
        return JSON.parse(text.slice(arrStart, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Heal envelope preview gate (BD demo + CLI).
 * Preview healthy ⇒ AI found rows; still must verify with Collection run.
 */
export function healPreviewLooksHealthy(output: string): {
  ok: boolean;
  title_count: number;
  status: string | null;
} {
  const blob = extractJsonBlob(output);
  if (!blob || typeof blob !== "object" || Array.isArray(blob)) {
    return { ok: false, title_count: 0, status: null };
  }
  const envelope = blob as Record<string, unknown>;
  const status = typeof envelope.status === "string" ? envelope.status : null;
  const preview = envelope.preview_result;
  let title_count = 0;

  const countTitles = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) countTitles(item);
      return;
    }
    if (typeof node !== "object") return;
    const row = node as Record<string, unknown>;
    if (typeof row.title === "string" && row.title.trim()) title_count += 1;
    for (const key of ["posts", "guides", "items", "entries", "updates"]) {
      if (Array.isArray(row[key])) countTitles(row[key]);
    }
  };
  countTitles(preview);

  const terminalOk =
    status === "done" ||
    status === "awaiting_approval" ||
    status === "ready" ||
    status === "completed" ||
    status === "success";

  return {
    ok: terminalOk && title_count >= 1,
    title_count,
    status,
  };
}
