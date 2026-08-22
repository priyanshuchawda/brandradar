import type { IntelSnapshot } from "./intel-schema";
import { summarizeDiff } from "./intel-diff";
import { loadCohortConfig } from "./rivals";
import { truncate } from "./discord-format";
import {
  INTEL_SNAPSHOT_SCHEMA,
  LISTING_ROW_SCHEMA,
  schemaMarkdownBrief,
} from "./discord-schema";
import { BRAND, embedAuthor } from "./discord-brand";

export type DiscordEmbed = {
  author?: { name: string; url?: string; icon_url?: string };
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
};

const C = BRAND.colors;

function visibilityColor(status: string | undefined): number {
  if (status === "critical") return C.danger;
  if (status === "degraded") return C.warn;
  return C.primary;
}

function visibilityEmoji(status: string | undefined): string {
  if (status === "critical") return "🔴";
  if (status === "degraded") return "🟡";
  return "🟢";
}

function formatModified(change: IntelSnapshot["diff"][number]): string[] {
  const lines: string[] = [];
  for (const mod of (change.modified ?? []).slice(0, 3)) {
    const fields = mod.fields.join(", ");
    lines.push(
      `📝 **${truncate(mod.after.title, 60)}** _(${fields})_`,
      `↳ ${truncate(mod.before.summary ?? mod.before.title, 80)} → ${truncate(mod.after.summary ?? mod.after.title, 80)}`,
    );
  }
  if ((change.modified ?? []).length > 3) {
    lines.push(`_…+${change.modified!.length - 3} more modified_`);
  }
  return lines;
}

export function buildIntelEmbeds(snapshot: IntelSnapshot): DiscordEmbed[] {
  const summary = summarizeDiff(snapshot.diff);
  const vis = snapshot.visibility;
  const collector =
    snapshot.health.collector_ids[0] ??
    snapshot.rivals.find((r) => r.collector_id)?.collector_id ??
    null;

  const summaryLines = [
    `> Week \`${snapshot.week}\` · **${snapshot.mode}** pull`,
    "",
    `▸ **${summary.added}** new · **${summary.removed}** removed · **${summary.modified}** modified`,
    `▸ **${summary.rivals_with_changes}** rivals with changes`,
  ];
  if (vis) {
    summaryLines.push(
      "",
      `${visibilityEmoji(vis.status)} **Visibility ${vis.score}/100** — _${vis.status}_`,
      truncate(vis.summary, 220),
    );
  }
  if (collector) {
    summaryLines.push("", `🔧 Collector \`${collector}\` _(unchanged after heal)_`);
  }

  const embeds: DiscordEmbed[] = [
    {
      author: embedAuthor(),
      title: `📅 Monday Diff · ${snapshot.label}`,
      description: summaryLines.join("\n"),
      url: BRAND.appUrl,
      color: visibilityColor(vis?.status),
      timestamp: snapshot.pulled_at,
      footer: { text: BRAND.tagline },
      fields: vis
        ? [
            { name: "Rivals OK", value: `${vis.rivals_healthy}/${vis.rivals_tracked}`, inline: true },
            { name: "Entries", value: String(vis.total_entries), inline: true },
            { name: "Heal", value: vis.heal_recommended ? "⚠️ Yes" : "✅ No", inline: true },
          ]
        : undefined,
    },
  ];

  for (const change of snapshot.diff) {
    const lines: string[] = [];
    const modifiedLines = formatModified(change);
    const hasChanges =
      change.added.length > 0 || change.removed.length > 0 || modifiedLines.length > 0;

    if (!hasChanges) lines.push("_No public updates this week_");
    for (const entry of change.added.slice(0, 5)) {
      lines.push(`✨ [${truncate(entry.title, 80)}](${entry.url})`);
    }
    if (change.added.length > 5) lines.push(`_…+${change.added.length - 5} more new_`);
    lines.push(...modifiedLines);
    for (const entry of change.removed.slice(0, 3)) {
      lines.push(`🗑️ ~~${truncate(entry.title, 80)}~~`);
    }

    const perRival = vis?.per_rival.find((r) => r.rival_id === change.rival_id);
    const rivalStatus = perRival?.status ?? "healthy";
    const prefix =
      rivalStatus === "degraded" ? "⚠️ " : rivalStatus === "empty" ? "⬜ " : "▸ ";

    embeds.push({
      title: `${prefix}${change.rival_name}`,
      description: lines.join("\n").slice(0, 4000),
      color: rivalStatus === "degraded" ? C.warn : C.muted,
      fields: [
        { name: "Unchanged", value: String(change.unchanged_count), inline: true },
        { name: "New", value: String(change.added.length), inline: true },
        { name: "Modified", value: String((change.modified ?? []).length), inline: true },
      ],
    });
  }

  if (snapshot.plays.length > 0) {
    const playEmoji = { attack: "⚔️", watch: "👀", fill: "📝" };
    embeds.push({
      title: "🎯 Recommended plays",
      color: C.primary,
      fields: snapshot.plays.map((play) => ({
        name: truncate(
          `${playEmoji[play.kind] ?? "•"} ${play.kind.toUpperCase()} · ${play.title}`,
          256,
        ),
        value: truncate(`_${play.evidence}_\n**Action:** ${play.action}`, 1024),
      })),
    });
  }

  if (snapshot.health.qa_flags.length > 0 || snapshot.health.null_rate > 0.2) {
    embeds.push({
      title: "🩹 QA · heal recommended",
      color: C.warn,
      description: [
        snapshot.health.heal_hint ? `> ${snapshot.health.heal_hint}` : null,
        snapshot.health.qa_flags.length
          ? `**Flags:** \`${snapshot.health.qa_flags.join("`, `")}\``
          : null,
        `**Null rate:** ${Math.round(snapshot.health.null_rate * 100)}%`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return embeds.slice(0, 10);
}

export function buildIntelContent(snapshot: IntelSnapshot): string {
  const vis = snapshot.visibility;
  const visLine = vis
    ? ` · ${visibilityEmoji(vis.status)} **${vis.score}/100**`
    : "";
  return `📅 **Monday Diff** · \`${snapshot.week}\` · ${snapshot.label}${visLine}`;
}

export function buildRulesEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "📜 Server rules",
    description: [
      "Welcome to the **BrandRadar** hackathon demo server.",
      "",
      "**Please**",
      "1. Read `#start-here` for the 2-minute judge path",
      "2. Use slash commands — don't paste API keys or tokens",
      "3. `#monday-diff` and `#heal-alerts` are bot feeds (read + react)",
      "4. Questions → DM the project owner or use `#start-here`",
    ].join("\n"),
    color: C.intel,
    footer: { text: BRAND.hackathon },
  };
}

export function buildStartHereEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "👋 Start here — judge path",
    description: [
      "**BrandRadar** tracks rival visibility from public blogs, guides & changelogs.",
      "When sites change, scrapers break — we **self-heal** the same Bright Data collector (`c_*`).",
      "",
      "━━ **2-minute demo** ━━",
      "",
      "**① Monday Diff** → run `/intel mode:example` in `#monday-diff`",
      "**② Heal Lab** → [before](https://brandradar-beta.vercel.app/heal-lab/before) (broken) → heal → [after](https://brandradar-beta.vercel.app/heal-lab/after)",
      "**③ Schema** → read `#schema` or `/schema` for JSON contract",
      "",
      "**Live app:** " + BRAND.appUrl,
    ].join("\n"),
    color: C.welcome,
    fields: [
      {
        name: "Slash commands",
        value: "`/intel` · `/rivals` · `/schema` · `/help`",
        inline: false,
      },
      {
        name: "Channels",
        value: [
          "`#monday-diff` — weekly briefs",
          "`#heal-alerts` — broken → recovered",
          "`#schema` — data contract",
          "`#demo-links` — URLs for video",
        ].join("\n"),
        inline: false,
      },
    ],
    footer: { text: "Pin this channel · BrandRadar hackathon demo" },
  };
}

export function buildCommandsEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "⌨️ Slash commands",
    color: C.intel,
    fields: [
      {
        name: "/intel",
        value: "**mode:example** — fixture week (fast, no Studio cost)\n**mode:live** — real Bright Data pull",
        inline: false,
      },
      {
        name: "/rivals",
        value: "Cohort list — Roame, Stardrift, Pointhound, Rove + update URLs",
        inline: false,
      },
      {
        name: "/schema",
        value: "ListingRow + IntelSnapshot JSON contract + collector env vars",
        inline: false,
      },
      { name: "/help", value: "Summary + links", inline: false },
    ],
    footer: { text: "Guild commands · appear after setup PUT /commands" },
  };
}

export function buildSchemaEmbed(): DiscordEmbed {
  const rowFields = LISTING_ROW_SCHEMA.fields
    .map((f) => `\`${f.key}\` · ${f.type}${f.required ? "" : " _(opt)_"} — ${f.note}`)
    .join("\n");

  return {
    author: embedAuthor(),
    title: "📐 Data contract",
    description: schemaMarkdownBrief(),
    color: C.schema,
    fields: [
      { name: "ListingRow", value: rowFields.slice(0, 1024) },
      {
        name: "IntelSnapshot",
        value: INTEL_SNAPSHOT_SCHEMA.sections.map((s) => `• ${s}`).join("\n").slice(0, 1024),
      },
      {
        name: "Collectors (Studio)",
        value: [
          "`COLLECTOR_INTEL_UPDATES` → Monday Diff rivals",
          "`COLLECTOR_HEAL_LAB` → Heal Lab before/after",
          "Same `c_*` id before & after heal",
        ].join("\n"),
      },
    ],
    footer: { text: BRAND.hackathon },
  };
}

export function buildDemoLinksEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "🔗 Demo links",
    description: "Use these in your hackathon video and README.",
    color: C.muted,
    fields: [
      {
        name: "Production",
        value: [
          `[App home](${BRAND.appUrl})`,
          `[Monday Diff](${BRAND.appUrl}/monday-diff)`,
          `[Heal Lab](${BRAND.appUrl}/heal-lab/before)`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Heal Lab proof",
        value: [
          `[Before — broken layout](${BRAND.appUrl}/heal-lab/before)`,
          `[After — healed layout](${BRAND.appUrl}/heal-lab/after)`,
          `[Live Studio](${BRAND.appUrl}/heal-lab/live)`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Recording tip",
        value: "Run `npm run dev` locally for full Studio + heal control in the video.",
        inline: false,
      },
    ],
    footer: { text: "Mask API keys on screen" },
  };
}

export function buildMondayDiffWelcomeEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "📅 Monday Diff feed",
    description: [
      "Weekly **competitive intel** lands here automatically (cron) or via slash command.",
      "",
      "**Try now:** `/intel mode:example`",
      "**Live Studio:** `/intel mode:live` _(requires COLLECTOR_INTEL_UPDATES)_",
      "",
      "Each post includes visibility score, per-rival diffs, and recommended plays.",
    ].join("\n"),
    color: C.primary,
    footer: { text: "Guides · blogs · changelogs — never YC directories" },
  };
}

export function buildHealLabWelcomeEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "🩹 Heal Lab alerts",
    description: [
      "When QA fails or rows drop to zero, a **broken** alert appears here.",
      "After self-heal you see **recovered** — same collector `c_*`, rows restored.",
      "",
      "**Pipeline:** QA → heal (≤2 tries) → settle verify",
    ].join("\n"),
    color: C.warn,
    fields: [
      {
        name: "Demo URLs",
        value: [
          `[Before](${BRAND.appUrl}/heal-lab/before)`,
          `[After](${BRAND.appUrl}/heal-lab/after)`,
        ].join(" · "),
        inline: false,
      },
    ],
    footer: { text: "Bright Data Scraper Studio · self-healing collectors" },
  };
}

export function buildSubmissionEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "🏆 Hackathon · Into the Scrape-Verse",
    description: [
      "**Track:** Bright Data Scraper Studio",
      "**Product:** BrandRadar — competitive visibility + resilient scraping",
      "",
      "**What we built**",
      "• Custom Studio collectors (`c_*`) for rival update pages",
      "• Monday Diff — week-over-week diff + visibility score",
      "• Heal Lab — prove empty → heal → data back, same collector id",
      "• This Discord server — live briefs for judges",
    ].join("\n"),
    color: C.submission,
    fields: [
      {
        name: "Stack",
        value: "Next.js · Bright Data CLI/SDK · Gemini (optional) · Vercel",
        inline: true,
      },
      {
        name: "Repo / app",
        value: BRAND.appUrl,
        inline: true,
      },
    ],
    footer: { text: "WeMakeDevs submission · AI disclosure in README" },
  };
}

export function buildRivalsEmbed(): DiscordEmbed {
  const config = loadCohortConfig();
  return {
    author: embedAuthor(),
    title: `🗺️ ${config.label}`,
    description: config.description ?? "Public update surfaces scraped each week.",
    color: C.muted,
    fields: config.rivals.map((rival) => ({
      name: rival.name,
      value: `**${rival.surface}** · [updates ↗](${rival.update_url})\n[homepage](${rival.homepage})`,
      inline: true,
    })),
    footer: { text: "Each rival's own site — not third-party directories" },
  };
}

export function buildHelpEmbed(): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: "BrandRadar help",
    description:
      "Competitive intel from public update pages, with self-healing Bright Data collectors.",
    color: C.intel,
    fields: [
      { name: "/intel", value: "`mode:example` · `mode:live`", inline: true },
      { name: "/rivals", value: "Cohort + URLs", inline: true },
      { name: "/schema", value: "JSON contract", inline: true },
      { name: "/help", value: "This message", inline: true },
      {
        name: "Channels",
        value: "#start-here · #monday-diff · #heal-alerts · #schema",
        inline: false,
      },
      {
        name: "Web",
        value: `[App](${BRAND.appUrl}) · [Heal Lab](${BRAND.appUrl}/heal-lab/before)`,
        inline: false,
      },
    ],
    footer: { text: BRAND.hackathon },
  };
}
