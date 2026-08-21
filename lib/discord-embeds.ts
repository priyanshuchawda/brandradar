import type { IntelSnapshot } from "./intel-schema";
import { summarizeDiff } from "./intel-diff";
import { loadCohortConfig } from "./rivals";
import { truncate } from "./discord-format";

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
};

const COLOR_BRIEF = 0x5cffb1;
const COLOR_MUTED = 0x7aa2ff;
const COLOR_HELP = 0x5865f2;

export function buildIntelEmbeds(snapshot: IntelSnapshot): DiscordEmbed[] {
  const summary = summarizeDiff(snapshot.diff);
  const embeds: DiscordEmbed[] = [
    {
      title: `Monday Diff — ${snapshot.label}`,
      description: [
        `Week \`${snapshot.week}\` · mode **${snapshot.mode}**`,
        `${summary.added} new · ${summary.removed} removed · ${summary.rivals_with_changes} rivals changed`,
      ].join("\n"),
      color: COLOR_BRIEF,
      timestamp: snapshot.pulled_at,
      footer: { text: "BrandRadar · self-healing competitive intel" },
    },
  ];

  for (const change of snapshot.diff) {
    const lines: string[] = [];
    if (change.added.length === 0 && change.removed.length === 0) {
      lines.push("_No public updates this week_");
    }
    for (const entry of change.added.slice(0, 5)) {
      lines.push(`✨ [${truncate(entry.title, 80)}](${entry.url})`);
    }
    if (change.added.length > 5) {
      lines.push(`_…+${change.added.length - 5} more_`);
    }
    for (const entry of change.removed.slice(0, 3)) {
      lines.push(`🗑️ ${truncate(entry.title, 80)}`);
    }
    embeds.push({
      title: change.rival_name,
      description: lines.join("\n").slice(0, 4000),
      color: COLOR_MUTED,
      fields: [
        {
          name: "Unchanged",
          value: String(change.unchanged_count),
          inline: true,
        },
        {
          name: "New",
          value: String(change.added.length),
          inline: true,
        },
      ],
    });
  }

  if (snapshot.plays.length > 0) {
    embeds.push({
      title: "Plays",
      color: COLOR_BRIEF,
      fields: snapshot.plays.map((play) => ({
        name: truncate(`${play.kind.toUpperCase()} · ${play.title}`, 256),
        value: truncate(`${play.evidence}\n**Do:** ${play.action}`, 1024),
      })),
    });
  }

  return embeds.slice(0, 10);
}

export function buildRivalsEmbed(): DiscordEmbed {
  const config = loadCohortConfig();
  return {
    title: `${config.label} cohort`,
    description: config.description ?? "Public update surfaces we scrape each week.",
    color: COLOR_MUTED,
    fields: config.rivals.map((rival) => ({
      name: rival.name,
      value: `[${rival.surface}](${rival.update_url})`,
      inline: false,
    })),
    footer: { text: "We scrape each company's own site — never YC directories." },
  };
}

export function buildHelpEmbed(): DiscordEmbed {
  return {
    title: "BrandRadar Monday Diff",
    description:
      "Weekly competitive intel from public blogs, guides, and changelogs — with self-healing Scraper Studio collectors.",
    color: COLOR_HELP,
    fields: [
      {
        name: "/intel",
        value: "Pull the cohort (or example week) and post a Monday Diff brief here.",
      },
      {
        name: "/rivals",
        value: "Show the fixed rival list and update URLs.",
      },
      {
        name: "/help",
        value: "This message.",
      },
      {
        name: "Web app",
        value: "Arena + heal UI: https://brandradar-beta.vercel.app",
      },
    ],
  };
}
