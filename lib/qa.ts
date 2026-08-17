import type { Domain, Item } from "./schema";

export type QaIssue = {
  field: string;
  sku: string;
  symptom: string;
  heal_prompt: string;
};

function splitConcatPrice(value: number): [number, number] | null {
  const digits = String(Math.round(value));
  if (digits.length < 5 || digits.length > 7) return null;
  for (let split = 2; split <= digits.length - 2; split += 1) {
    const sale = Number(digits.slice(0, split));
    const list = Number(digits.slice(split));
    if (sale >= 49 && list > sale && list < sale * 5 && list <= 9999) {
      return [sale, list];
    }
  }
  return null;
}

export function auditItems(items: Item[], domain: Domain): QaIssue[] {
  const issues: QaIssue[] = [];
  for (const item of items) {
    if (
      domain === "ecommerce" &&
      item.price !== null &&
      item.list_price === null
    ) {
      const split = splitConcatPrice(item.price);
      if (split) {
        issues.push({
          field: "price",
          sku: item.name,
          symptom: `price ${item.price} looks like concatenated sale ${split[0]} and list ${split[1]}`,
          heal_prompt: `Price concatenates sale and list into one number (e.g. ${item.price} instead of sale ${split[0]} and list_price ${split[1]}). Extract numeric sale price and list_price separately. Keep product_url. Listing page only.`,
        });
      }
    }

    const collapsed = item.name.trim();
    const mid = Math.floor(collapsed.length / 2);
    const left = collapsed.slice(0, mid).trim();
    const right = collapsed.slice(mid).trim();
    if (left && left === right) {
      issues.push({
        field: "name",
        sku: item.name,
        symptom: "product name is duplicated end to end",
        heal_prompt:
          "product_name is concatenated twice. Return the title once. Keep product_url.",
      });
    }
  }
  return issues;
}

export function healHint(issues: QaIssue[]): string | null {
  return issues[0]?.heal_prompt ?? null;
}
