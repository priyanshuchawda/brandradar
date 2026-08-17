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

function alreadyDiscounted(item: Item): boolean {
  if (item.promo) return true;
  if (item.list_price && item.price && item.list_price > item.price * 1.08) {
    return true;
  }
  return false;
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
    const best =
      priced.length > 0
        ? priced.reduce((a, b) =>
            (a.price ?? Infinity) <= (b.price ?? Infinity) ? a : b,
          )
        : null;
    const rated = matches.filter((item) => item.rating !== null);
    const bestRated =
      rated.length > 0
        ? rated.reduce((a, b) => ((a.rating ?? 0) >= (b.rating ?? 0) ? a : b))
        : null;

    const brandWinsPrice =
      brand.price !== null && best?.price != null && brand.price <= best.price;
    const brandWinsRating =
      brand.rating !== null &&
      bestRated?.rating != null &&
      brand.rating >= bestRated.rating;

    if (brandWinsPrice && brandWinsRating) {
      signals.push({
        type: "defend_win",
        kind: "defend",
        sku: brand.name,
        brand_price: brand.price,
        best_rival_price: best?.price,
        brand_rating: brand.rating,
        rival_rating: bestRated?.rating,
        brand_reviews: brand.review_count,
        rival_reviews: bestRated?.review_count,
        score: 75 + Math.min(brand.review_count ?? 0, 400) / 40,
        summary: `${brand.name} already beats ${best?.rival_name ?? "rivals"} on price (${money(brand.price, brand.currency)} vs ${money(best?.price, brand.currency)}) and rating (${brand.rating} vs ${bestRated?.rating}).`,
      });
    } else if (brand.price !== null && best?.price != null) {
      const gap = ((brand.price - best.price) / brand.price) * 100;
      if (gap >= 8) {
        signals.push({
          type: "price_gap",
          kind: "attack",
          sku: brand.name,
          brand_price: brand.price,
          best_rival_price: best.price,
          gap_pct: Number(gap.toFixed(1)),
          score: gap + Math.min(brand.review_count ?? 0, 200) / 20,
          summary: `${brand.name} is ${gap.toFixed(0)}% above ${best.rival_name ?? "a rival"} (${money(best.price, brand.currency)} vs ${money(brand.price, brand.currency)}).`,
        });
      }
    }

    if (
      brand.rating !== null &&
      bestRated?.rating != null &&
      !brandWinsRating
    ) {
      const delta = bestRated.rating - brand.rating;
      const reviewLag =
        (bestRated.review_count ?? 0) - (brand.review_count ?? 0);
      if (delta >= 0.2 || reviewLag >= 80) {
        signals.push({
          type: "rating_gap",
          kind: "attack",
          sku: brand.name,
          brand_rating: brand.rating,
          rival_rating: bestRated.rating,
          brand_reviews: brand.review_count,
          rival_reviews: bestRated.review_count,
          score: 45 + delta * 20 + Math.min(Math.max(reviewLag, 0), 400) / 40,
          summary: `${brand.name} sits at ${brand.rating} (${brand.review_count ?? 0} reviews) vs ${bestRated.rival_name ?? "rival"} at ${bestRated.rating} (${bestRated.review_count ?? 0} reviews).`,
        });
      }
    }

    if (!alreadyDiscounted(brand) && matches.some((item) => item.promo)) {
      signals.push({
        type: "promo_gap",
        kind: "attack",
        sku: brand.name,
        score: 28,
        summary: `Rivals are discounting ${brand.name}; the brand page is full price with no visible list-price cut.`,
      });
    }

    if (
      brand.availability === "in_stock" &&
      matches.some((item) => item.availability === "out_of_stock")
    ) {
      const oos = matches.find((item) => item.availability === "out_of_stock");
      signals.push({
        type: "stock_window",
        kind: "attack",
        sku: brand.name,
        score: 92 + Math.min(brand.review_count ?? 0, 200) / 25,
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
          kind: "fill",
          sku: rival.name,
          score: 40 + Math.min(rival.review_count ?? 0, 400) / 20,
          summary: `${rival.rival_name ?? "A rival"} sells ${rival.name} (${money(rival.price, rival.currency)}, ${rival.review_count ?? 0} reviews) and the brand catalog has no overlap.`,
        });
      }
    }
  }

  return signals.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
}

function pickSignals(signals: Signal[]): Signal[] {
  const picked: Signal[] = [];
  const usedKind = new Set<string>();
  const usedType = new Set<string>();
  for (const signal of signals) {
    if (picked.length >= 3) break;
    const kind = signal.kind ?? "attack";
    if (usedKind.has(kind) && usedType.has(signal.type)) continue;
    if (usedKind.has(kind) && picked.length < 2) continue;
    picked.push(signal);
    usedKind.add(kind);
    usedType.add(signal.type);
  }
  for (const signal of signals) {
    if (picked.length >= 3) break;
    if (picked.includes(signal)) continue;
    picked.push(signal);
  }
  return picked.slice(0, 3);
}

export function playsFromSignals(signals: Signal[], currency: string): Play[] {
  return pickSignals(signals).map((signal) => {
    if (signal.type === "defend_win") {
      return {
        signal_type: signal.type,
        kind: "defend" as const,
        impact: "share" as const,
        title: `Double down on ${signal.sku}`,
        evidence: signal.summary,
        action: `Do not cut price. Put ${signal.sku} on the homepage, ads, and email this week — you already win on price and proof.`,
        why_it_grows:
          "Growth comes from pushing the SKU you already win, not copying a rival discount.",
      };
    }
    if (signal.type === "price_gap") {
      return {
        signal_type: signal.type,
        kind: "attack" as const,
        impact: "margin" as const,
        title: `Close the gap on ${signal.sku}`,
        evidence: signal.summary,
        action: `Match ${money(signal.best_rival_price, currency)} on this SKU only, or bundle so the effective price lands there without a sitewide sale.`,
        why_it_grows:
          "Shoppers compare this SKU in-tab. A 8%+ gap on a hero item leaks conversion you already paid to acquire.",
      };
    }
    if (signal.type === "rating_gap") {
      return {
        signal_type: signal.type,
        kind: "attack" as const,
        impact: "trust" as const,
        title: `Fix public proof on ${signal.sku}`,
        evidence: signal.summary,
        action:
          "Ask last-30-day buyers for a review, and rewrite the first PDP screen around the gap the rating already shows.",
        why_it_grows:
          "Rating and review volume are the public trust score. Price cuts will not fix a listing that looks unproven.",
      };
    }
    if (signal.type === "promo_gap") {
      return {
        signal_type: signal.type,
        kind: "attack" as const,
        impact: "revenue" as const,
        title: `Answer the promo on ${signal.sku}`,
        evidence: signal.summary,
        action:
          "Run a limited promo on the overlapping SKU only. Do not discount the whole catalog.",
        why_it_grows:
          "A rival sale on the same SKU steals the comparison click this week. A sitewide sale trains customers to wait.",
      };
    }
    if (signal.type === "catalog_hole") {
      return {
        signal_type: signal.type,
        kind: "fill" as const,
        impact: "share" as const,
        title: `Fill the hole: ${signal.sku}`,
        evidence: signal.summary,
        action:
          "List this shape publicly, or merchandize the closest existing SKU into that slot this week.",
        why_it_grows:
          "If rivals own a concern (retinol, kit, size) you do not list, you are invisible in that search — not just 'more expensive'.",
      };
    }
    return {
      signal_type: signal.type,
      kind: "attack" as const,
      impact: "revenue" as const,
      title: `Capture demand while rivals are dry`,
      evidence: signal.summary,
      action:
        "Boost this SKU on the homepage and paid this week. The window closes when rival stock returns.",
      why_it_grows:
        "Out-of-stock rivals send ready-to-buy traffic to whoever can still ship. That is the cheapest acquisition you will get.",
    };
  });
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
