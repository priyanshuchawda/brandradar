import { spawn } from "node:child_process";
import { collectorIdFor } from "./brightdata";
import type { Snapshot } from "./schema";

/** Collection runs are usually quick; heal AI Flow needs CLI's full poll window. */
const STUDIO_RUN_TIMEOUT_MS = 180_000;
const STUDIO_HEAL_TIMEOUT_MS = 620_000;

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
  timeoutMs?: number;
};

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
      "600",
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
  if (options?.autoSave !== false) approve.push("--auto-save");
  return approve;
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
    (action === "heal" ? STUDIO_HEAL_TIMEOUT_MS : STUDIO_RUN_TIMEOUT_MS);

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

/** Pull the last JSON object/array from CLI pretty output (ignores npm notices). */
export function extractJsonBlob(text: string): unknown | null {
  const objStart = text.lastIndexOf("{");
  const arrStart = text.lastIndexOf("[");
  const start = Math.max(objStart, arrStart);
  if (start < 0) return null;
  const closer = text[start] === "[" ? "]" : "}";
  const end = text.lastIndexOf(closer);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
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
