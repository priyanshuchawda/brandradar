import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";
import { isVercelRuntime } from "./runtime-env";

/** Durable JSON on disk (local) or Vercel Blob (production). */
export function jsonStoreBackend(): "blob" | "disk" {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  return "disk";
}

function diskPath(key: string): string {
  return path.join(process.cwd(), "data", key);
}

export async function readJson(key: string): Promise<unknown | null> {
  if (jsonStoreBackend() === "blob") {
    try {
      const { blobs } = await list({ prefix: key, limit: 1 });
      const hit = blobs.find((b) => b.pathname === key) ?? blobs[0];
      if (!hit?.url) return null;
      const response = await fetch(hit.url);
      if (!response.ok) return null;
      return JSON.parse(await response.text()) as unknown;
    } catch {
      return null;
    }
  }
  try {
    const raw = await readFile(diskPath(key), "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function writeJson(
  key: string,
  data: unknown,
): Promise<{ backend: "blob" | "disk"; key: string; detail?: string }> {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  if (jsonStoreBackend() === "blob") {
    const result = await put(key, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return { backend: "blob", key, detail: result.url };
  }
  const file = diskPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body, "utf8");
  return { backend: "disk", key, detail: file };
}

/** List child keys under prefix, e.g. intel/ → ["intel/2026-W34/snapshot.json", ...] */
export async function listJsonKeys(prefix: string): Promise<string[]> {
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
  if (jsonStoreBackend() === "blob") {
    try {
      const keys = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: normalized, cursor, limit: 1000 });
        for (const blob of page.blobs) keys.add(blob.pathname);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return [...keys].sort();
    } catch {
      return [];
    }
  }
  try {
    const root = diskPath(normalized);
    const names = await readdir(root, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of names) {
      if (!entry.isDirectory()) continue;
      const snap = `${normalized}${entry.name}/snapshot.json`;
      try {
        await readFile(diskPath(snap));
        out.push(snap);
      } catch {
        // skip incomplete weeks
      }
    }
    return out.sort();
  } catch {
    return [];
  }
}

export function storeWarning(): string | null {
  if (isVercelRuntime() && jsonStoreBackend() !== "blob") {
    return "Set BLOB_READ_WRITE_TOKEN on Vercel — week snapshots are ephemeral without Blob storage.";
  }
  return null;
}
