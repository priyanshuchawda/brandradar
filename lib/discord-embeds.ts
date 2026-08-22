import type {
  DiffChange,
  IntelPlay,
  IntelSnapshot,
  RivalConfig,
  RivalUpdateBucket,
  UpdateEntry,
  VisibilityHealth,
} from "./intel-schema";
import { summarizeDiff } from "./intel-diff";
import { loadCohortConfig } from "./rivals";
import { discordTimestamp, truncate } from "./discord-format";
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
      { name: "/company", value: "Deep-dive intel & plays for a specific rival", inline: true },
      { name: "/rivals", value: "Cohort + URLs + channels", inline: true },
      { name: "/schema", value: "JSON contract", inline: true },
      { name: "/help", value: "This message", inline: true },
      {
        name: "Channels",
        value: "#start-here · #monday-diff · #heal-alerts · Dedicated company channels (#roame, #stardrift, etc.)",
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

export type StrategicAnalysis = {
  direction: string;
  velocity: string;
  themes: string[];
  keySignals: string[];
};

/** Analyzes topics, themes, velocity and shifts from a rival's updates. */
export function analyzeStrategicDirection(
  entries: UpdateEntry[],
  diff?: DiffChange,
  notes?: string,
): StrategicAnalysis {
  const addedCount = diff?.added.length ?? 0;
  const modifiedCount = diff?.modified.length ?? 0;
  const totalEntries = entries.length;

  let velocity = "🧘 Steady Baseline";
  if (addedCount >= 3) {
    velocity = `🔥 High Shipping Velocity (+${addedCount} new releases this week)`;
  } else if (addedCount > 0) {
    velocity = `🚀 Active Expansion (+${addedCount} new release${addedCount > 1 ? "s" : ""})`;
  } else if (modifiedCount > 0) {
    velocity = `🔄 Messaging & Copy Iteration (${modifiedCount} live post${modifiedCount > 1 ? "s" : ""} updated)`;
  } else if (totalEntries === 0) {
    velocity = `⚠️ Inactive / Surface Disrupted (0 entries collected)`;
  }

  const textCorpus = [
    ...entries.map((e) => `${e.title} ${e.summary ?? ""}`),
    ...(diff?.added.map((e) => `${e.title} ${e.summary ?? ""}`) ?? []),
    ...(diff?.modified.map((m) => `${m.after.title} ${m.after.summary ?? ""}`) ?? []),
    notes ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const detectedThemes: string[] = [];

  if (
    /airline|flight|business class|first class|eva air|star alliance|skyteam|oneworld|qatar|emirates|singapore|delta|united|american|ana|jal|cathay/i.test(
      textCorpus,
    )
  ) {
    detectedThemes.push("✈️ Flight & Airline Coverage");
  }
  if (
    /points|miles|loyalty|rewards|transfer|redemption|amex|chase|citi|capital one|sweet spot|award|credit card/i.test(
      textCorpus,
    )
  ) {
    detectedThemes.push("💳 Points & Loyalty Sweet Spots");
  }
  if (
    /ai|agent|automation|smart|search engine|algorithm|bot|gpt|assistant|copilot|model/i.test(
      textCorpus,
    )
  ) {
    detectedThemes.push("🤖 AI Search & Automation");
  }
  if (/hotel|hyatt|marriott|hilton|resort|suite|stay|booking/i.test(textCorpus)) {
    detectedThemes.push("🏨 Hotel & Stay Redemptions");
  }
  if (/deal|pricing|free|discount|sale|tier|membership|subscription|pass/i.test(textCorpus)) {
    detectedThemes.push("🏷️ Deals, Tiers & Monetization");
  }
  if (/guide|tutorial|how to|strategy|playbook|tips|tricks|breakdown/i.test(textCorpus)) {
    detectedThemes.push("📚 Educational Content & Guides");
  }
  if (/changelog|release|v2|feature|update|redesign|patch|api/i.test(textCorpus)) {
    detectedThemes.push("🛠️ Product & Feature Launches");
  }

  if (detectedThemes.length === 0) {
    detectedThemes.push("🌐 General Travel & Product Updates");
  }

  const keySignals: string[] = [];
  if (diff && diff.added.length > 0) {
    keySignals.push(`Published ${diff.added.length} new asset(s) targeting ${truncate(diff.added[0].title, 50)}`);
  }
  if (diff && diff.modified.length > 0) {
    keySignals.push(`Refined copy & messaging on ${truncate(diff.modified[0].after.title, 50)}`);
  }
  if (diff && diff.removed.length > 0) {
    keySignals.push(`Pruned or deprecated ${diff.removed.length} older guide(s)`);
  }

  let direction = "";
  if (addedCount > 0 && detectedThemes.includes("✈️ Flight & Airline Coverage")) {
    direction = "Aggressively expanding flight redemption routes and inventory guides to capture high-intent search traffic.";
  } else if (addedCount > 0 && detectedThemes.includes("🤖 AI Search & Automation")) {
    direction = "Pushing AI-driven automated search capabilities to differentiate from legacy award-booking tools.";
  } else if (modifiedCount > 0) {
    direction = "Actively updating existing live guides with fresh valuation math and messaging, signaling soft feature adjustments.";
  } else if (totalEntries > 0) {
    direction = "Maintaining steady coverage across core product offerings without radical shifts this week.";
  } else {
    direction = "No current updates detected; recommend verifying scraper health or monitoring for unannounced private launches.";
  }

  return {
    direction,
    velocity,
    themes: detectedThemes.slice(0, 4),
    keySignals: keySignals.length > 0 ? keySignals : ["No major structural moves detected this cycle."],
  };
}

/** Pinned master dossier for a company's dedicated channel. */
export function buildCompanyDossierEmbed(rival: RivalConfig): DiscordEmbed {
  return {
    author: embedAuthor(),
    title: `🏢 ${rival.name} · Master Intelligence Dossier`,
    description: [
      `Dedicated competitive intelligence channel for **${rival.name}**.`,
      "",
      `▸ **Homepage:** [${rival.homepage}](${rival.homepage})`,
      `▸ **Scraped Surface:** [${rival.update_url}](${rival.update_url}) _(${rival.surface})_`,
      "",
      `📌 **Core Focus & Background:**`,
      `> ${rival.notes ?? "Monitored rival in cohort."}`,
    ].join("\n"),
    color: C.intel,
    fields: [
      {
        name: "Channel Purpose & Capabilities",
        value:
          "• Archives chronological update & changelog history\n• Detects strategic direction shifts & velocity\n• Recommends targeted counter-plays for this competitor",
        inline: false,
      },
      {
        name: "Collector Configuration",
        value: "`COLLECTOR_INTEL_UPDATES` (Scraper Studio)",
        inline: true,
      },
      {
        name: "Surface Type",
        value: `\`${rival.surface.toUpperCase()}\``,
        inline: true,
      },
    ],
    footer: { text: "BrandRadar Dossier · Pinned Master Record" },
  };
}

/** Deep-dive briefing embeds for a company's dedicated channel. */
export function buildCompanyIntelEmbeds(
  rival: RivalConfig,
  options: {
    bucket?: RivalUpdateBucket;
    diff?: DiffChange;
    plays?: IntelPlay[];
    week: string;
    visibility?: VisibilityHealth;
    collectorId?: string | null;
  },
): DiscordEmbed[] {
  const entries = options.bucket?.entries ?? [];
  const diff = options.diff;
  const analysis = analyzeStrategicDirection(entries, diff, rival.notes);
  const perRivalVis = options.visibility?.per_rival.find((r) => r.rival_id === rival.id);
  const status = perRivalVis?.status ?? (entries.length > 0 ? "healthy" : "empty");

  const embeds: DiscordEmbed[] = [];

  const headerLines = [
    `> Week \`${options.week}\` · Dedicated Intel Report for **${rival.name}**`,
    "",
    `▸ **Status:** ${visibilityEmoji(status)} \`${status.toUpperCase()}\``,
    `▸ **Update Surface:** [${rival.update_url}](${rival.update_url})`,
    options.collectorId ? `▸ **Collector:** \`${options.collectorId}\`` : null,
  ].filter(Boolean) as string[];

  embeds.push({
    author: embedAuthor(),
    title: `🏢 ${rival.name} · Week ${options.week} Brief`,
    description: headerLines.join("\n"),
    url: rival.homepage,
    color: visibilityColor(status),
    fields: [
      { name: "Active Entries", value: String(entries.length), inline: true },
      { name: "✨ New This Week", value: String(diff?.added.length ?? 0), inline: true },
      { name: "📝 Modified", value: String(diff?.modified.length ?? 0), inline: true },
    ],
    footer: { text: `${BRAND.name} · ${rival.name} Intel` },
  });

  embeds.push({
    title: `🧭 Strategic Direction & Trajectory`,
    description: analysis.direction,
    color: C.intel,
    fields: [
      { name: "Shipping Velocity", value: analysis.velocity, inline: false },
      { name: "Detected Focus Themes", value: analysis.themes.join(" · "), inline: false },
      {
        name: "Key Tactical Signals",
        value: analysis.keySignals.map((s) => `• ${s}`).join("\n"),
        inline: false,
      },
    ],
  });

  const rivalPlays = (options.plays ?? []).filter(
    (p) =>
      p.rival_id === rival.id ||
      p.title.toLowerCase().includes(rival.name.toLowerCase()) ||
      p.evidence.toLowerCase().includes(rival.name.toLowerCase()),
  );

  const playFields: Array<{ name: string; value: string }> = [];
  const playEmoji = { attack: "⚔️", watch: "👀", fill: "📝" };

  if (rivalPlays.length > 0) {
    for (const play of rivalPlays) {
      playFields.push({
        name: truncate(`${playEmoji[play.kind] ?? "•"} ${play.kind.toUpperCase()} · ${play.title}`, 256),
        value: truncate(`_${play.evidence}_\n**Action:** ${play.action}\n**Why:** ${play.why_it_grows}`, 1024),
      });
    }
  } else {
    if (diff && diff.added.length > 0) {
      playFields.push({
        name: `⚔️ ATTACK · Counter ${rival.name}'s New Releases`,
        value: `_${rival.name} shipped ${diff.added.length} new asset(s) this week._\n**Action:** Review [${truncate(diff.added[0].title, 50)}](${diff.added[0].url}) and evaluate catalog/guide gaps.\n**Why:** Addressing rival launches immediately preserves search intent share.`,
      });
    } else if (diff && diff.modified.length > 0) {
      playFields.push({
        name: `👀 WATCH · Track ${rival.name}'s Messaging Shifts`,
        value: `_${rival.name} updated live guide copy (${diff.modified[0].fields.join(", ")})._\n**Action:** Audit [${truncate(diff.modified[0].after.title, 50)}](${diff.modified[0].after.url}) for feature teasers or policy changes.\n**Why:** Live revisions often signal upcoming product iterations.`,
      });
    } else {
      playFields.push({
        name: `🛡️ DEFEND / ADVANCE · Exploit Competitive Window`,
        value: `_${rival.name} published no updates this cycle._\n**Action:** Accelerate our own guide releases in ${analysis.themes[0] ?? "core categories"}.\n**Why:** Publishing during rival quiet periods captures search ranking momentum.`,
      });
    }
  }

  embeds.push({
    title: `🎯 Targeted Counter-Strategies vs ${rival.name}`,
    color: C.primary,
    fields: playFields.slice(0, 4),
  });

  const historyLines: string[] = [];

  if (diff && (diff.added.length > 0 || diff.modified.length > 0 || diff.removed.length > 0)) {
    historyLines.push("**⚡ Week-over-Week Changes**");
    for (const add of diff.added.slice(0, 4)) {
      const ts = discordTimestamp(add.published_at, "D");
      const tsStr = ts ? ` _(${ts})_` : "";
      historyLines.push(`✨ **NEW:** [${truncate(add.title, 60)}](${add.url})${tsStr}`);
      if (add.summary) historyLines.push(`   ↳ ${truncate(add.summary, 90)}`);
    }
    for (const mod of diff.modified.slice(0, 3)) {
      historyLines.push(`📝 **UPDATED:** [${truncate(mod.after.title, 60)}](${mod.after.url}) _(${mod.fields.join(", ")})_`);
    }
    for (const rem of diff.removed.slice(0, 2)) {
      historyLines.push(`🗑️ **REMOVED:** ~~${truncate(rem.title, 60)}~~`);
    }
    historyLines.push("");
  }

  historyLines.push("**📚 Active Historical Catalog (Latest)**");
  if (entries.length === 0) {
    historyLines.push("_No entries currently indexed for this competitor._");
  } else {
    for (const entry of entries.slice(0, 6)) {
      const ts = discordTimestamp(entry.published_at, "D");
      const tsStr = ts ? ` — ${ts}` : "";
      historyLines.push(`• [${truncate(entry.title, 65)}](${entry.url})${tsStr}`);
    }
    if (entries.length > 6) {
      historyLines.push(`_… and ${entries.length - 6} more historical entries archived_`);
    }
  }

  embeds.push({
    title: `📋 History & Scraped Updates Feed`,
    description: historyLines.join("\n").slice(0, 4000),
    color: C.muted,
    footer: { text: `Total archived entries: ${entries.length}` },
  });

  return embeds.slice(0, 10);
}
