/**
 * Live Discord bootstrap — skipped in normal `npm test`.
 * Run: npm run discord:bootstrap
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { bootstrapDiscordServer } from "./discord-server";
import { MONDAY_DIFF_COMMANDS, registerGuildCommands } from "./discord-api";

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
  process.env.npm_lifecycle_event === "discord:bootstrap" ||
  process.argv.some((a) => a.includes("discord-bootstrap"));

describe.skipIf(!LIVE)("discord bootstrap (live guild)", () => {
  it(
    "creates categories, channels, pins, guild branding",
    async () => {
      const guildId = process.env.DISCORD_GUILD_ID?.trim();
      const appId =
        process.env.DISCORD_APPLICATION_ID?.trim() ||
        process.env.DISCORD_CLIENT_ID?.trim();
      expect(process.env.DISCORD_BOT_TOKEN?.trim()).toBeTruthy();
      expect(guildId).toBeTruthy();
      expect(appId).toBeTruthy();

      const refresh = process.env.DISCORD_BOOTSTRAP_REFRESH !== "false";
      const layout = await bootstrapDiscordServer(guildId!, { refresh });
      if (!layout.ok) throw new Error(`Bootstrap failed: ${layout.error}`);

      const commands = await registerGuildCommands(appId!, guildId!, MONDAY_DIFF_COMMANDS);
      expect(commands.ok).toBe(true);

      console.log("\n✅ BrandRadar Discord server ready");
      console.log(`Channels: ${layout.channels.length} · Guild branded: ${layout.guild_branded}`);
      console.log("\nAdd to .env.local:\n");
      for (const line of layout.env_lines) console.log(line);
      console.log("\nPinned welcome embeds:");
      for (const ch of layout.channels.filter((c) => c.welcome_pinned)) {
        console.log(`  #${ch.name}`);
      }
    },
    120_000,
  );
});
