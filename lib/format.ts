export function formatMoney(amount: number | null, currency = "INR"): string {
  if (amount === null || Number.isNaN(amount)) return "—";
  if (currency === "INR") return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  return `${currency} ${amount.toFixed(0)}`;
}

export function formatAvailability(value: string): string {
  return value.replaceAll("_", " ");
}
