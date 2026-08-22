/**
 * Prune junk channels + post demo intel. Run: npm run discord:tidy
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { bootstrapDiscordServer } from "./discord-server";
import { pruneDiscordServer } from "./discord-prune";
import { MONDAY_DIFF_COMMANDS, registerGuildCommands } from "./discord-api";
import { runIntelPull } from "./intel-pull";
import { postIntelToDiscord } from "./discord";

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

const LIVE =
  process.env.RUN_DISCORD_BOOTSTRAP === "1" ||
  process.argv.some((a) => a.includes("discord-tidy.live.test.ts"));

describe.skipIf(!LIVE)("discord tidy (live guild)", () => {
  it(
    "prunes junk, refreshes layout, posts example intel",
    async () => {
      const guildId = process.env.DISCORD_GUILD_ID!.trim();
      const appId =
        process.env.DISCORD_APPLICATION_ID?.trim() ||
        process.env.DISCORD_CLIENT_ID?.trim();

      const pruned = await pruneDiscordServer(guildId);
      if (!pruned.ok) throw new Error(`Prune failed: ${pruned.error}`);

      const layout = await bootstrapDiscordServer(guildId, { refresh: false });
      if (!layout.ok) throw new Error(`Bootstrap failed: ${layout.error}`);

      const commands = await registerGuildCommands(appId!, guildId!, MONDAY_DIFF_COMMANDS);
      expect(commands.ok).toBe(true);

      const snapshot = await runIntelPull({
        forceMock: true,
        persist: false,
        refresh: false,
      });
      const posted = await postIntelToDiscord(snapshot);
      if (!posted.ok) throw new Error(`Intel post failed: ${posted.error}`);

      console.log("\n✅ Discord server tidied + live content posted");
      console.log(`Deleted ${pruned.deleted.length} channel(s):`);
      for (const d of pruned.deleted) {
        const kind = d.type === 4 ? "category" : "channel";
        console.log(`  - ${kind} #${d.name}`);
      }
      console.log(`\nPosted Monday Diff to #monday-diff · week ${snapshot.week} · ${snapshot.plays.length} plays`);
    },
    120_000,
  );
});
