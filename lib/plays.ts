import type { Domain, Item, Play, Signal, Snapshot } from "./schema";

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function overlapKey(name: string): string {
  return normalizeName(name)
    .split(" ")
    .filter((part) => part.length > 2 && !/^\d+$/.test(part))
    .slice(0, 4)
    .join(" ");
}

function money(amount: number | null | undefined, currency: string): string {
  if (amount === null || amount === undefined) return "n/a";
  if (currency === "INR") return `₹${Math.round(amount)}`;
  return `${currency} ${amount}`;
}

export function computeHealth(items: Item[]): {
  null_rate: number;
  broken_fields: string[];
} {
  if (items.length === 0) {
    return { null_rate: 1, broken_fields: ["items"] };
  }
  const fields: Array<keyof Item> = ["price", "rating", "name"];
  let missing = 0;
  const broken = new Set<string>();
  for (const item of items) {
    for (const field of fields) {
      if (item[field] === null || item[field] === undefined || item[field] === "") {
        missing += 1;
        broken.add(String(field));
      }
    }
  }
  return {
    null_rate: Number((missing / (items.length * fields.length)).toFixed(3)),
    broken_fields: [...broken],
  };
}

export function computeSignals(snapshot: Pick<Snapshot, "items">): Signal[] {
  const brandItems = snapshot.items.filter((item) => item.source === "brand");
  const rivalItems = snapshot.items.filter((item) => item.source === "rival");
  const signals: Signal[] = [];

  for (const brand of brandItems) {
    const key = overlapKey(brand.name);
    const matches = rivalItems.filter(
      (rival) =>
        overlapKey(rival.name) === key ||
        normalizeName(rival.name).includes(key) ||
        normalizeName(brand.name).includes(overlapKey(rival.name)),
    );
    if (matches.length === 0) continue;

    const priced = matches.filter((item) => item.price !== null);
    if (brand.price !== null && priced.length > 0) {
      const best = priced.reduce((a, b) =>
        (a.price ?? Infinity) <= (b.price ?? Infinity) ? a : b,
      );
      const gap = ((brand.price - (best.price ?? brand.price)) / brand.price) * 100;
      if (gap >= 8) {
        signals.push({
          type: "price_gap",
          sku: brand.name,
          brand_price: brand.price,
          best_rival_price: best.price,
          gap_pct: Number(gap.toFixed(1)),
          summary: `${brand.name} is ${gap.toFixed(0)}% above ${best.rival_name ?? "a rival"} (${money(best.price, brand.currency)} vs ${money(brand.price, brand.currency)}).`,
        });
      }
    }

    const rated = matches.filter((item) => item.rating !== null);
    if (brand.rating !== null && rated.length > 0) {
      const bestRated = rated.reduce((a, b) =>
        (a.rating ?? 0) >= (b.rating ?? 0) ? a : b,
      );
      const delta = (bestRated.rating ?? 0) - brand.rating;
      if (delta >= 0.2) {
        signals.push({
          type: "rating_gap",
          sku: brand.name,
          brand_rating: brand.rating,
          rival_rating: bestRated.rating,
          summary: `${brand.name} sits at ${brand.rating} vs ${bestRated.rival_name ?? "rival"} at ${bestRated.rating}.`,
        });
      }
    }

    if (!brand.promo && matches.some((item) => item.promo)) {
      signals.push({
        type: "promo_gap",
        sku: brand.name,
        summary: `Rivals are discounting ${brand.name}; the brand page is full price.`,
      });
    }

    if (
      brand.availability === "in_stock" &&
      matches.some((item) => item.availability === "out_of_stock")
    ) {
      const oos = matches.find((item) => item.availability === "out_of_stock");
      signals.push({
        type: "stock_window",
        sku: brand.name,
        summary: `${oos?.rival_name ?? "A rival"} is out of stock on ${brand.name} while the brand can still sell.`,
      });
    }
  }

  const brandKeys = new Set(brandItems.map((item) => overlapKey(item.name)));
  for (const rival of rivalItems) {
    const key = overlapKey(rival.name);
    if (key && !brandKeys.has(key)) {
      const already = signals.some(
        (signal) => signal.type === "catalog_hole" && signal.sku === rival.name,
      );
      if (!already) {
        signals.push({
          type: "catalog_hole",
          sku: rival.name,
          summary: `${rival.rival_name ?? "A rival"} sells ${rival.name} and the brand catalog has no overlap.`,
        });
      }
    }
  }

  return signals.slice(0, 8);
}

export function playsFromSignals(signals: Signal[], currency: string): Play[] {
  const plays: Play[] = [];
  for (const signal of signals) {
    if (plays.length >= 3) break;
    if (signal.type === "price_gap") {
      plays.push({
        signal_type: signal.type,
        title: `Close the gap on ${signal.sku}`,
        evidence: signal.summary,
        action: `Match ${money(signal.best_rival_price, currency)} on the hero SKU, or bundle so the effective price lands there without a sitewide sale.`,
      });
    } else if (signal.type === "rating_gap") {
      plays.push({
        signal_type: signal.type,
        title: `Fix public proof on ${signal.sku}`,
        evidence: signal.summary,
        action:
          "Rewrite the PDP around the top public complaints and ask recent buyers for reviews this week — the gap is already visible on the listing.",
      });
    } else if (signal.type === "promo_gap") {
      plays.push({
        signal_type: signal.type,
        title: `Answer the promo on ${signal.sku}`,
        evidence: signal.summary,
        action:
          "Run a limited promo on the overlapping SKU only. Do not discount the whole catalog.",
      });
    } else if (signal.type === "catalog_hole") {
      plays.push({
        signal_type: signal.type,
        title: `Fill the hole: ${signal.sku}`,
        evidence: signal.summary,
        action:
          "Add a public listing in this shape, or merchandize the closest existing SKU into that slot.",
      });
    } else if (signal.type === "stock_window") {
      plays.push({
        signal_type: signal.type,
        title: `Capture demand while rivals are dry`,
        evidence: signal.summary,
        action:
          "Boost this SKU on the homepage and ads until rival stock returns.",
      });
    }
  }
  return plays;
}

export function attachInsights(snapshot: Snapshot): Snapshot {
  const currency = snapshot.items[0]?.currency ?? "INR";
  const signals = computeSignals(snapshot);
  const plays = playsFromSignals(signals, currency);
  const health = computeHealth(snapshot.items);
  return {
    ...snapshot,
    signals,
    plays,
    health: {
      ...snapshot.health,
      null_rate: health.null_rate,
      broken_fields: health.broken_fields,
    },
  };
}

export function hostnameLabel(url: string, fallback: string): string {
  try {
    const host = new URL(ensureUrl(url)).hostname.replace(/^www\./, "");
    const stem = host.split(".")[0] ?? fallback;
    return stem.charAt(0).toUpperCase() + stem.slice(1);
  } catch {
    return fallback;
  }
}

export function ensureUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function domainNoun(domain: Domain): string {
  if (domain === "edtech") return "course";
  if (domain === "food") return "menu item";
  return "SKU";
}

export function computeKpis(snapshot: Snapshot) {
  const brand = snapshot.items.filter((item) => item.source === "brand" && item.price !== null);
  const rivals = snapshot.items.filter((item) => item.source === "rival" && item.price !== null);
  const avg = (rows: typeof brand) =>
    rows.length ? rows.reduce((sum, item) => sum + (item.price ?? 0), 0) / rows.length : null;
  const avgRating = (rows: Snapshot["items"]) => {
    const rated = rows.filter((item) => item.rating !== null);
    return rated.length
      ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length
      : null;
  };
  const brandAvg = avg(brand);
  const rivalAvg = avg(rivals);
  return {
    itemCount: snapshot.items.length,
    brandAvgPrice: brandAvg,
    rivalAvgPrice: rivalAvg,
    priceIndex:
      brandAvg !== null && rivalAvg && rivalAvg > 0
        ? Number((brandAvg / rivalAvg).toFixed(2))
        : null,
    brandAvgRating: avgRating(snapshot.items.filter((item) => item.source === "brand")),
    rivalAvgRating: avgRating(snapshot.items.filter((item) => item.source === "rival")),
    promoShare:
      snapshot.items.length === 0
        ? 0
        : snapshot.items.filter((item) => item.promo).length / snapshot.items.length,
  };
}
