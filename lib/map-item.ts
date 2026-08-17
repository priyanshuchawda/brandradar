import { ensureUrl } from "./plays";
import type { Item } from "./schema";

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "value" in value) {
    return asNumber((value as { value: unknown }).value);
  }
  return null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function nestedUrl(row: Record<string, unknown>): string | null {
  const input = row.input;
  if (input && typeof input === "object" && "url" in input) {
    return asString((input as { url: unknown }).url);
  }
  return null;
}

export function collapseRepeatedName(name: string): string {
  const trimmed = name.trim();
  const mid = Math.floor(trimmed.length / 2);
  const left = trimmed.slice(0, mid).trim();
  const right = trimmed.slice(mid).trim();
  if (left && left === right) return left;
  return trimmed;
}

export function discoverySeedUrl(url: string): string {
  try {
    const parsed = new URL(ensureUrl(url));
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "mamaearth.in" && (parsed.pathname === "/" || parsed.pathname === "")) {
      parsed.pathname = "/shop";
      return parsed.toString();
    }
  } catch {
    // keep the original url
  }
  return url;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return /sale|promo|deal|off/i.test(value);
  }
  return false;
}

export function rowToItem(
  row: Record<string, unknown>,
  source: Item["source"],
  rivalName: string | undefined,
  collectorId: string,
  runId: string | null,
): Item | null {
  const name = collapseRepeatedName(
    asString(row.name) ||
      asString(row.title) ||
      asString(row.product_name) ||
      asString(row.course_name) ||
      "",
  );
  const url =
    asString(row.url) ||
    asString(row.product_url) ||
    asString(row.product_page_url) ||
    asString(row.link) ||
    nestedUrl(row);
  if (!name || !url) return null;

  const availabilityRaw =
    asString(row.availability) || asString(row.stock) || asString(row.in_stock);
  let availability: Item["availability"] = "unknown";
  if (availabilityRaw) {
    if (/out/i.test(availabilityRaw) || availabilityRaw === "false") {
      availability = "out_of_stock";
    } else if (/in.?stock|available|true/i.test(availabilityRaw)) {
      availability = "in_stock";
    }
  }

  return {
    source,
    rival_name: rivalName,
    name,
    url,
    price: asNumber(row.price) ?? asNumber(row.sale_price) ?? asNumber(row.list_price),
    currency:
      asString(row.currency) ||
      (row.price && typeof row.price === "object" && "currency" in row.price
        ? asString((row.price as { currency: unknown }).currency)
        : null) ||
      "INR",
    availability,
    rating: asNumber(row.rating) ?? asNumber(row.stars),
    review_count: asNumber(row.review_count) ?? asNumber(row.reviews),
    promo: asBool(row.promo) || asBool(row.discount) || asBool(row.badge),
    collector_id: collectorId,
    run_id: runId,
  };
}
