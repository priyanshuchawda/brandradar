import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type HealHistoryEvent = {
  at: string;
  collector_id: string;
  url: string;
  surface: "heal-lab" | "intel" | "arena";
  stage: "broken" | "heal_started" | "heal_failed" | "approved" | "recovered" | "still_broken";
  before_count: number;
  after_count: number;
  null_rate?: number;
  qa_flags?: string[];
  prompt_source?: "template" | "gemini" | "user";
  note?: string;
};

const ROOT = path.join(process.cwd(), "data", "heal-history");

export async function appendHealHistory(event: HealHistoryEvent): Promise<string | null> {
  try {
    await mkdir(ROOT, { recursive: true });
    const day = event.at.slice(0, 10);
    const file = path.join(ROOT, `${day}.jsonl`);
    await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
    return file;
  } catch {
    // Vercel/serverless — project dir is not writable; never fail the heal loop.
    return null;
  }
}
