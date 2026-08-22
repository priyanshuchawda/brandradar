/**
 * BrandRadar Market Fixtures — Points & Travel Intelligence
 *
 * Real tracked competitors:
 *   roame        → https://roame.travel/guides (Airline & Hotel Award Guides)
 *   stardrift    → https://stardrift.ai/blog (AI Graph Search & Platform)
 *   pointhound   → https://www.pointhound.com/blog (Credit Cards & Sweetspots)
 *   rove         → https://rove.travel/blog (Hotel Points & Concierge Automation)
 *
 * Controlled organic layout (non-symmetrical, force-positioned).
 */

import type {
  MarketSnapshotFrame,
  CompetitorFrame,
  MarketMoment,
  ObservedItem,
  RivalDelta,
  CategoryBranch,
} from "./market-world";

// ─── Organic Non-Symmetrical Spatial Coordinates ─────────────────────────────

export const POSITIONS: Record<string, { x: number; y: number }> = {
  roame:      { x: -0.22, y: -0.32 }, // Upper Center-Left (Commanding / Guides Lead)
  stardrift:  { x:  0.34, y: -0.18 }, // Upper-Mid Right (AI Search Graph)
  pointhound: { x: -0.36, y:  0.22 }, // Lower-Mid Left (Cards & Sweetspots)
  rove:       { x:  0.24, y:  0.32 }, // Lower-Center Right (Hotel Concierge)
};

// ─── Shared Intelligence Category Links ──────────────────────────────────────

export interface SharedIntelLink {
  fromId: string;
  toId: string;
  category: string;
  label: string;
}

export const SHARED_INTEL_LINKS: SharedIntelLink[] = [
  {
    fromId: "roame",
    toId: "stardrift",
    category: "Award Search & Routing",
    label: "CROSS-ENGINE ROUTING",
  },
  {
    fromId: "roame",
    toId: "pointhound",
    category: "Airline Sweet Spots",
    label: "AVIOS & FLYING BLUE OVERLAP",
  },
  {
    fromId: "stardrift",
    toId: "rove",
    category: "Automation Pipeline",
    label: "CONCIERGE & SEARCH AUTOMATION",
  },
  {
    fromId: "pointhound",
    toId: "rove",
    category: "Transfer Partners",
    label: "CHASE & LUXURY REDEMPTIONS",
  },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function item(
  id: string,
  title: string,
  url: string,
  category: string,
  publishedAt: string | null,
  summary: string | null,
  status: ObservedItem["status"],
  collectorId: string,
  scrapedAt: string,
): ObservedItem {
  return { id, title, url, category, publishedAt, summary, status, collectorId, scrapedAt };
}

const C_ROAME      = "c_mt3dbbi22j5z5voslc";
const C_STARDRIFT  = "c_mt3ekwjs2lzsn3dwl7";
const C_POINTHOUND = "c_mt3dbbi22j5z5voslc";
const C_ROVE       = "c_mt3ekwjs2lzsn3dwl7";

// ─── Extract Category Branches from Items ─────────────────────────────────────

function buildBranches(items: ObservedItem[], rivalId: string): CategoryBranch[] {
  const map = new Map<string, ObservedItem[]>();
  for (const it of items) {
    if (!map.has(it.category)) map.set(it.category, []);
    map.get(it.category)!.push(it);
  }

  // Pre-assigned distinct branch angles per competitor for clear visual separation
  const angleMap: Record<string, Record<string, number>> = {
    roame: {
      "Airline Awards": -0.6 * Math.PI,    // Upper left
      "Hotel Awards": -0.15 * Math.PI,     // Upper right
      "Program Guides": 0.8 * Math.PI,     // Lower left
    },
    stardrift: {
      "Conversational Search": -0.7 * Math.PI,
      "Graph Architecture": 0.05 * Math.PI,
      "Platform & API": 0.65 * Math.PI,
    },
    pointhound: {
      "Sweet Spots": -0.85 * Math.PI,
      "Credit Cards": -0.25 * Math.PI,
      "Availability Windows": 0.6 * Math.PI,
    },
    rove: {
      "Hotel Point Value": -0.4 * Math.PI,
      "Concierge Tech": 0.3 * Math.PI,
      "Partner Transfers": 0.85 * Math.PI,
    },
  };

  const branches: CategoryBranch[] = [];
  for (const [catName, catItems] of map) {
    const angle = angleMap[rivalId]?.[catName] ?? (branches.length * 1.8);
    const newCount = catItems.filter((i) => i.status === "new").length;
    branches.push({
      name: catName,
      itemCount: catItems.length,
      newCount,
      items: catItems,
      angle,
    });
  }

  return branches;
}

// ─── Frame W31 — AUG 01 — Baseline State ──────────────────────────────────────

const roame_w31: ObservedItem[] = [
  item("r-g01", "How to Book Qatar Airways Qsuite with Avios", "https://roame.travel/guides/qatar-qsuite-avios", "Airline Awards", "2026-07-20", "Qatar Qsuite award seats finding.", "existing", C_ROAME, "2026-08-01T12:00:00Z"),
  item("r-g02", "Alaska Miles Sweet Spots Guide", "https://roame.travel/guides/alaska-miles-sweet-spots", "Program Guides", "2026-07-10", "Redemptions on Alaska Mileage Plan.", "existing", C_ROAME, "2026-08-01T12:00:00Z"),
  item("r-g03", "Hyatt Free Night Award Search Guide", "https://roame.travel/guides/hyatt-free-night-award", "Hotel Awards", "2026-06-28", "Hyatt free night award efficiency.", "existing", C_ROAME, "2026-08-01T12:00:00Z"),
];

const stardrift_w31: ObservedItem[] = [
  item("s-b01", "Introducing Conversational Award Search", "https://stardrift.ai/blog/conversational-search", "Conversational Search", "2026-07-25", "Natural language award search reasoning.", "existing", C_STARDRIFT, "2026-08-01T12:00:00Z"),
  item("s-b02", "How Our Alert Engine Works", "https://stardrift.ai/blog/alert-engine", "Graph Architecture", "2026-07-15", "Real-time award monitoring pipeline.", "existing", C_STARDRIFT, "2026-08-01T12:00:00Z"),
];

const pointhound_w31: ObservedItem[] = [
  item("p-b01", "Best First-Class Redemptions Under 100k Points", "https://www.pointhound.com/blog/first-class-under-100k", "Sweet Spots", "2026-07-18", "Premium cabin redemption sweet spots.", "existing", C_POINTHOUND, "2026-08-01T12:00:00Z"),
  item("p-b02", "Flying Blue Sweet Spots 2026", "https://www.pointhound.com/blog/flying-blue-sweet-spots-2026", "Sweet Spots", "2026-07-08", "Air France/KLM Flying Blue awards.", "existing", C_POINTHOUND, "2026-08-01T12:00:00Z"),
];

const rove_w31: ObservedItem[] = [
  item("v-b01", "Why Hotel Points Beat Cash for Luxury Properties", "https://rove.travel/blog/hotel-points-luxury", "Hotel Point Value", "2026-07-22", "Comparison of cash vs point value.", "existing", C_ROVE, "2026-08-01T12:00:00Z"),
  item("v-b02", "Marriott Bonvoy Automated Booking Guide", "https://rove.travel/blog/marriott-bonvoy-automated-booking", "Concierge Tech", "2026-07-12", "Auto-booking Marriott award nights.", "existing", C_ROVE, "2026-08-01T12:00:00Z"),
];

// ─── Frame W32 — AUG 06 — Ingestion Wave 1 ────────────────────────────────────

const roame_w32_new: ObservedItem[] = [
  item("r-g04", "Eva Air Hello Kitty Award Search Strategy", "https://roame.travel/guides/eva-air-hello-kitty", "Airline Awards", "2026-08-04", "Eva Air Business Class with miles.", "new", C_ROAME, "2026-08-06T12:00:00Z"),
  item("r-g05", "Air Canada Aeroplan Partner Award Guide", "https://roame.travel/guides/aeroplan-partner-awards", "Program Guides", "2026-08-02", "Partner airlines with Aeroplan.", "new", C_ROAME, "2026-08-06T12:00:00Z"),
];

const stardrift_w32_new: ObservedItem[] = [
  item("s-b03", "Multi-City Complex Award Routing — How It Works", "https://stardrift.ai/blog/multi-city-routing", "Graph Architecture", "2026-08-05", "Complex itinerary graph search.", "new", C_STARDRIFT, "2026-08-06T12:00:00Z"),
];

const rove_w32_new: ObservedItem[] = [
  item("v-b03", "Hilton Honors: Best Properties Under 50k Points", "https://rove.travel/blog/hilton-honors-under-50k", "Hotel Point Value", "2026-08-05", "Top value hotel awards in Hilton.", "new", C_ROVE, "2026-08-06T12:00:00Z"),
];

// ─── Frame W33 — AUG 11 — Ingestion Wave 2 ────────────────────────────────────

const roame_w33_new: ObservedItem[] = [
  item("r-g06", "United MileagePlus Saver Award Strategy", "https://roame.travel/guides/united-mileageplus-saver", "Program Guides", "2026-08-10", "Saver vs Everyday in United dynamic pricing.", "new", C_ROAME, "2026-08-11T12:00:00Z"),
];

const stardrift_w33_new: ObservedItem[] = [
  item("s-b04", "Stardrift v2.0: Neural Graph Award Search", "https://stardrift.ai/blog/v2-neural-graph-search", "Graph Architecture", "2026-08-09", "Neural graph itinerary construction.", "new", C_STARDRIFT, "2026-08-11T12:00:00Z"),
  item("s-b05", "API Access Now Available for Teams", "https://stardrift.ai/blog/api-access", "Platform & API", "2026-08-08", "Programmatic search API for developers.", "new", C_STARDRIFT, "2026-08-11T12:00:00Z"),
];

const pointhound_w33_new: ObservedItem[] = [
  item("p-b03", "Chase Sapphire vs Amex Platinum — Best for Award Travel", "https://www.pointhound.com/blog/chase-vs-amex-award-travel", "Credit Cards", "2026-08-10", "Transfer partners and redemption rates.", "new", C_POINTHOUND, "2026-08-11T12:00:00Z"),
];

// ─── Frame W34 — AUG 16 — Ingestion Wave 3 ────────────────────────────────────

const roame_w34_new: ObservedItem[] = [
  item("r-g07", "Japan Airlines JAL First Class Award Booking", "https://roame.travel/guides/jal-first-class-award", "Airline Awards", "2026-08-15", "Booking JAL First Class with partner miles.", "new", C_ROAME, "2026-08-16T12:00:00Z"),
  item("r-g08", "Singapore Airlines KrisFlyer Saver Awards 2026", "https://roame.travel/guides/singapore-krisflyer-saver", "Airline Awards", "2026-08-14", "Finding saver availability on SQ.", "new", C_ROAME, "2026-08-16T12:00:00Z"),
];

const pointhound_w34_new: ObservedItem[] = [
  item("p-b04", "Bilt Rewards: The Credit Card Built for Points Earners", "https://www.pointhound.com/blog/bilt-rewards-guide", "Credit Cards", "2026-08-15", "Bilt Mastercard transfer partners comparison.", "new", C_POINTHOUND, "2026-08-16T12:00:00Z"),
  item("p-b05", "Air France Business Class Award: When to Book", "https://www.pointhound.com/blog/air-france-business-when-to-book", "Availability Windows", "2026-08-13", "Availability windows for Flying Blue.", "new", C_POINTHOUND, "2026-08-16T12:00:00Z"),
];

const rove_w34_new: ObservedItem[] = [
  item("v-b04", "Rove Concierge: How Automated Hotel Booking Works", "https://rove.travel/blog/concierge-how-it-works", "Concierge Tech", "2026-08-14", "Booking automation backend pipeline.", "new", C_ROVE, "2026-08-16T12:00:00Z"),
];

// ─── Frame W35 — AUG 22 — Ingestion Wave 4 ────────────────────────────────────

const roame_w35_new: ObservedItem[] = [
  item("r-g09", "Cathay Pacific Business Class: Best Transfer Partners", "https://roame.travel/guides/cathay-pacific-business-class", "Airline Awards", "2026-08-21", "Asia Miles vs partner programs for CX.", "new", C_ROAME, "2026-08-22T12:00:00Z"),
];

const stardrift_w35_new: ObservedItem[] = [
  item("s-b06", "Stardrift Teams — Shared Award Alerts & Collaboration", "https://stardrift.ai/blog/stardrift-teams", "Platform & API", "2026-08-20", "Multi-user alert boards for travel desks.", "new", C_STARDRIFT, "2026-08-22T12:00:00Z"),
];

const rove_w35_new: ObservedItem[] = [
  item("v-b05", "IHG One Rewards: Best Premium Properties Under 70k", "https://rove.travel/blog/ihg-one-under-70k", "Hotel Point Value", "2026-08-21", "Intercontinental & Kimpton high point value.", "new", C_ROVE, "2026-08-22T12:00:00Z"),
  item("v-b06", "Rove x Chase — Seamless Points Transfer Integration", "https://rove.travel/blog/chase-integration", "Partner Transfers", "2026-08-19", "Chase Ultimate Rewards direct integration.", "new", C_ROVE, "2026-08-22T12:00:00Z"),
];

// ─── Frame Builder ────────────────────────────────────────────────────────────

function buildFrame(
  week: string,
  dateLabel: string,
  pulledAt: string,
  roameItems: ObservedItem[],
  stardriftItems: ObservedItem[],
  pointhoundItems: ObservedItem[],
  roveItems: ObservedItem[],
  roameDelta: RivalDelta,
  stardriftDelta: RivalDelta,
  pointhoundDelta: RivalDelta,
  roveDelta: RivalDelta,
  moments: MarketMoment[],
  signalScore: number,
): MarketSnapshotFrame {
  const competitors: CompetitorFrame[] = [
    {
      id: "roame",
      name: "Roame",
      surface: "guides",
      updateUrl: "https://roame.travel/guides",
      collectorId: C_ROAME,
      scrapedAt: pulledAt,
      totalItems: roameItems.length,
      delta: roameDelta,
      items: roameItems,
      categories: buildBranches(roameItems, "roame"),
      health: "healthy",
      healthDetail: null,
      ...POSITIONS.roame,
    },
    {
      id: "stardrift",
      name: "Stardrift",
      surface: "blog",
      updateUrl: "https://stardrift.ai/blog",
      collectorId: C_STARDRIFT,
      scrapedAt: pulledAt,
      totalItems: stardriftItems.length,
      delta: stardriftDelta,
      items: stardriftItems,
      categories: buildBranches(stardriftItems, "stardrift"),
      health: "healthy",
      healthDetail: null,
      ...POSITIONS.stardrift,
    },
    {
      id: "pointhound",
      name: "Pointhound",
      surface: "blog",
      updateUrl: "https://www.pointhound.com/blog",
      collectorId: C_POINTHOUND,
      scrapedAt: pulledAt,
      totalItems: pointhoundItems.length,
      delta: pointhoundDelta,
      items: pointhoundItems,
      categories: buildBranches(pointhoundItems, "pointhound"),
      health: "healthy",
      healthDetail: null,
      ...POSITIONS.pointhound,
    },
    {
      id: "rove",
      name: "Rove",
      surface: "blog",
      updateUrl: "https://rove.travel/blog",
      collectorId: C_ROVE,
      scrapedAt: pulledAt,
      totalItems: roveItems.length,
      delta: roveDelta,
      items: roveItems,
      categories: buildBranches(roveItems, "rove"),
      health: "healthy",
      healthDetail: null,
      ...POSITIONS.rove,
    },
  ];

  return {
    week,
    dateLabel,
    pulledAt,
    competitors,
    moments,
    signalHealth: {
      score: signalScore,
      scrapersTotal: 4,
      scrapersHealthy: 4,
      collectorIds: [C_ROAME, C_STARDRIFT],
    },
  };
}

// ─── Assembled 5 Historical Snapshot Frames ───────────────────────────────────

export function getHistoricalFrames(): MarketSnapshotFrame[] {
  // Frame 1: AUG 01 — Baseline
  const w31 = buildFrame(
    "2026-W31", "AUG 01", "2026-08-01T12:00:00Z",
    roame_w31, stardrift_w31, pointhound_w31, rove_w31,
    { added: [], removed: [], modified: [], unchangedCount: 3 },
    { added: [], removed: [], modified: [], unchangedCount: 2 },
    { added: [], removed: [], modified: [], unchangedCount: 2 },
    { added: [], removed: [], modified: [], unchangedCount: 2 },
    [],
    98,
  );

  // Frame 2: AUG 06 — Ingestion Wave 1
  const roame_w32 = [...roame_w31.map((i) => ({ ...i, status: "existing" as const })), ...roame_w32_new];
  const stardrift_w32 = [...stardrift_w31.map((i) => ({ ...i, status: "existing" as const })), ...stardrift_w32_new];
  const pointhound_w32 = pointhound_w31.map((i) => ({ ...i, status: "existing" as const }));
  const rove_w32 = [...rove_w31.map((i) => ({ ...i, status: "existing" as const })), ...rove_w32_new];

  const w32_moments: MarketMoment[] = [
    {
      id: "m-w32-r",
      rivalId: "roame",
      rivalName: "Roame",
      date: "AUG 04",
      type: "items_added",
      category: "Airline Awards",
      description: "+2 guides added: Eva Air & Aeroplan",
      count: 2,
      items: roame_w32_new,
    },
    {
      id: "m-w32-s",
      rivalId: "stardrift",
      rivalName: "Stardrift",
      date: "AUG 05",
      type: "items_added",
      category: "Graph Architecture",
      description: "+1 post added: Multi-City Graph Routing",
      count: 1,
      items: stardrift_w32_new,
    },
    {
      id: "m-w32-v",
      rivalId: "rove",
      rivalName: "Rove",
      date: "AUG 05",
      type: "items_added",
      category: "Hotel Point Value",
      description: "+1 post added: Hilton Honors Sweet Spots",
      count: 1,
      items: rove_w32_new,
    },
  ];

  const w32 = buildFrame(
    "2026-W32", "AUG 06", "2026-08-06T12:00:00Z",
    roame_w32, stardrift_w32, pointhound_w32, rove_w32,
    { added: roame_w32_new, removed: [], modified: [], unchangedCount: 3 },
    { added: stardrift_w32_new, removed: [], modified: [], unchangedCount: 2 },
    { added: [], removed: [], modified: [], unchangedCount: 2 },
    { added: rove_w32_new, removed: [], modified: [], unchangedCount: 2 },
    w32_moments,
    98,
  );

  // Frame 3: AUG 11 — Ingestion Wave 2 (v2.0 Search & APIs)
  const roame_w33 = [...roame_w32.map((i) => ({ ...i, status: "existing" as const })), ...roame_w33_new];
  const stardrift_w33 = [...stardrift_w32.map((i) => ({ ...i, status: "existing" as const })), ...stardrift_w33_new];
  const pointhound_w33 = [...pointhound_w32.map((i) => ({ ...i, status: "existing" as const })), ...pointhound_w33_new];
  const rove_w33 = rove_w32.map((i) => ({ ...i, status: "existing" as const }));

  const w33_moments: MarketMoment[] = [
    {
      id: "m-w33-s",
      rivalId: "stardrift",
      rivalName: "Stardrift",
      date: "AUG 09",
      type: "items_added",
      category: "Graph Architecture",
      description: "+2 posts: v2.0 Neural Search & Public API",
      count: 2,
      items: stardrift_w33_new,
    },
    {
      id: "m-w33-p",
      rivalId: "pointhound",
      rivalName: "Pointhound",
      date: "AUG 10",
      type: "items_added",
      category: "Credit Cards",
      description: "+1 post: Chase vs Amex comparison",
      count: 1,
      items: pointhound_w33_new,
    },
    {
      id: "m-w33-r",
      rivalId: "roame",
      rivalName: "Roame",
      date: "AUG 10",
      type: "items_added",
      category: "Program Guides",
      description: "+1 guide: United Saver Award Strategy",
      count: 1,
      items: roame_w33_new,
    },
  ];

  const w33 = buildFrame(
    "2026-W33", "AUG 11", "2026-08-11T12:00:00Z",
    roame_w33, stardrift_w33, pointhound_w33, rove_w33,
    { added: roame_w33_new, removed: [], modified: [], unchangedCount: 5 },
    { added: stardrift_w33_new, removed: [], modified: [], unchangedCount: 3 },
    { added: pointhound_w33_new, removed: [], modified: [], unchangedCount: 2 },
    { added: [], removed: [], modified: [], unchangedCount: 3 },
    w33_moments,
    96,
  );

  // Frame 4: AUG 16 — Ingestion Wave 3 (JAL & Bilt Sprout)
  const roame_w34 = [...roame_w33.map((i) => ({ ...i, status: "existing" as const })), ...roame_w34_new];
  const stardrift_w34 = stardrift_w33.map((i) => ({ ...i, status: "existing" as const }));
  const pointhound_w34 = [...pointhound_w33.map((i) => ({ ...i, status: "existing" as const })), ...pointhound_w34_new];
  const rove_w34 = [...rove_w33.map((i) => ({ ...i, status: "existing" as const })), ...rove_w34_new];

  const w34_moments: MarketMoment[] = [
    {
      id: "m-w34-r",
      rivalId: "roame",
      rivalName: "Roame",
      date: "AUG 15",
      type: "items_added",
      category: "Airline Awards",
      description: "+2 guides: JAL 1st Class & Singapore KrisFlyer",
      count: 2,
      items: roame_w34_new,
    },
    {
      id: "m-w34-p",
      rivalId: "pointhound",
      rivalName: "Pointhound",
      date: "AUG 15",
      type: "items_added",
      category: "Credit Cards",
      description: "+2 posts: Bilt Mastercard & Flying Blue Windows",
      count: 2,
      items: pointhound_w34_new,
    },
    {
      id: "m-w34-v",
      rivalId: "rove",
      rivalName: "Rove",
      date: "AUG 14",
      type: "items_added",
      category: "Concierge Tech",
      description: "+1 post: Concierge Pipeline Architecture",
      count: 1,
      items: rove_w34_new,
    },
  ];

  const w34 = buildFrame(
    "2026-W34", "AUG 16", "2026-08-16T12:00:00Z",
    roame_w34, stardrift_w34, pointhound_w34, rove_w34,
    { added: roame_w34_new, removed: [], modified: [], unchangedCount: 6 },
    { added: [], removed: [], modified: [], unchangedCount: 5 },
    { added: pointhound_w34_new, removed: [], modified: [], unchangedCount: 3 },
    { added: rove_w34_new, removed: [], modified: [], unchangedCount: 3 },
    w34_moments,
    97,
  );

  // Frame 5: AUG 22 — Ingestion Wave 4 (Cathay Pacific & Chase Direct)
  const roame_w35 = [...roame_w34.map((i) => ({ ...i, status: "existing" as const })), ...roame_w35_new];
  const stardrift_w35 = [...stardrift_w34.map((i) => ({ ...i, status: "existing" as const })), ...stardrift_w35_new];
  const pointhound_w35 = pointhound_w34.map((i) => ({ ...i, status: "existing" as const }));
  const rove_w35 = [...rove_w34.map((i) => ({ ...i, status: "existing" as const })), ...rove_w35_new];

  const w35_moments: MarketMoment[] = [
    {
      id: "m-w35-s",
      rivalId: "stardrift",
      rivalName: "Stardrift",
      date: "AUG 20",
      type: "items_added",
      category: "Platform & API",
      description: "+1 post: Stardrift Teams Collaboration",
      count: 1,
      items: stardrift_w35_new,
    },
    {
      id: "m-w35-v",
      rivalId: "rove",
      rivalName: "Rove",
      date: "AUG 21",
      type: "items_added",
      category: "Partner Transfers",
      description: "+2 posts: Direct Chase Integration & IHG",
      count: 2,
      items: rove_w35_new,
    },
    {
      id: "m-w35-r",
      rivalId: "roame",
      rivalName: "Roame",
      date: "AUG 21",
      type: "items_added",
      category: "Airline Awards",
      description: "+1 guide: Cathay Pacific Transfer Partners",
      count: 1,
      items: roame_w35_new,
    },
  ];

  const w35 = buildFrame(
    "2026-W35", "AUG 22", "2026-08-22T12:00:00Z",
    roame_w35, stardrift_w35, pointhound_w35, rove_w35,
    { added: roame_w35_new, removed: [], modified: [], unchangedCount: 8 },
    { added: stardrift_w35_new, removed: [], modified: [], unchangedCount: 5 },
    { added: [], removed: [], modified: [], unchangedCount: 5 },
    { added: rove_w35_new, removed: [], modified: [], unchangedCount: 4 },
    w35_moments,
    99,
  );

  return [w31, w32, w33, w34, w35];
}

/** Build growth path for competitor inspection */
export function buildGrowthPath(frames: MarketSnapshotFrame[], rivalId: string) {
  type StepType = {
    week: string;
    dateLabel: string;
    totalItems: number;
    delta: { added: number; removed: number; modified: number };
    moments: MarketMoment[];
  };

  const steps = frames
    .map((frame): StepType | null => {
      const comp = frame.competitors.find((c) => c.id === rivalId);
      if (!comp) return null;
      return {
        week: frame.week,
        dateLabel: frame.dateLabel,
        totalItems: comp.totalItems,
        delta: {
          added: comp.delta.added.length,
          removed: comp.delta.removed.length,
          modified: comp.delta.modified.length,
        },
        moments: frame.moments.filter((m) => m.rivalId === rivalId),
      };
    })
    .filter((s): s is StepType => s !== null);

  const first = steps[0]?.totalItems ?? 0;
  const last = steps[steps.length - 1]?.totalItems ?? 0;
  const net = last - first;

  return {
    rivalId,
    rivalName: frames[0]?.competitors.find((c) => c.id === rivalId)?.name ?? rivalId,
    steps,
    netDelta: net,
    direction: (net > 0 ? "growing" : net < 0 ? "shrinking" : "stable") as "growing" | "shrinking" | "stable",
  };
}
