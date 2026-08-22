/**
 * List guild channels — run: RUN_DISCORD_BOOTSTRAP=1 npx vitest run lib/discord-list.live.test.ts --disable-console-intercept
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { listGuildChannels } from "./discord-api";
import { BRANDRADAR_SERVER_LAYOUT, LEGACY_CATEGORIES } from "./discord-server";

const root = resolve(import.meta.dirname, "..");
for (const file of [".env.local", ".env"]) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const LIVE = process.env.RUN_DISCORD_BOOTSTRAP === "1";

describe.skipIf(!LIVE)("discord list channels", () => {
  it("prints channel tree", async () => {
    const guildId = process.env.DISCORD_GUILD_ID!.trim();
    const listed = await listGuildChannels(guildId);
    if (!listed.ok) throw new Error(listed.error);
    const keepNames = new Set([
      ...BRANDRADAR_SERVER_LAYOUT.map((s) => s.name),
      ...BRANDRADAR_SERVER_LAYOUT.map((s) => s.category),
    ]);
    console.log("\n--- All channels ---");
    for (const c of listed.channels.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      const type = c.type === 4 ? "CAT" : "CH";
      const keep = keepNames.has(c.name) ? "KEEP" : "PRUNE?";
      console.log(`${type} ${keep} #${c.name} (${c.id}) parent=${c.parent_id ?? "-"}`);
    }
    console.log("\nLegacy categories:", LEGACY_CATEGORIES.join(", "));
  }, 30_000);
});
