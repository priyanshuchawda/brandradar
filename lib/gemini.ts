import type { Domain, Item, Play } from "./schema";

const FLASH_LITE = "gemini-3.1-flash-lite";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModel(): string {
  const requested = process.env.GEMINI_MODEL?.trim() || FLASH_LITE;
  if (requested.includes("flash-lite") || requested.includes("flash_lite")) {
    return requested;
  }
  return FLASH_LITE;
}

async function generateJson(prompt: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const model = geminiModel();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const startArr = raw.indexOf("[");
  const startObj = raw.indexOf("{");
  const start =
    startArr === -1 ? startObj : startObj === -1 ? startArr : Math.min(startArr, startObj);
  if (start === -1) throw new Error("Gemini did not return JSON");
  const closer = raw[start] === "[" ? "]" : "}";
  const end = raw.lastIndexOf(closer);
  return JSON.parse(raw.slice(start, end + 1));
}

export async function pickBrandRivals(
  hits: Array<{ name: string; url: string; title: string }>,
): Promise<Array<{ name: string; url: string }>> {
  if (hits.length === 0) return [];
  const parsed = await generateJson(`Pick up to 2 official consumer-brand homepages from these search hits.
Exclude news, research firms, ad libraries, marketplaces, aggregators.
Return JSON: {"rivals":[{"name":"","url":""}]}

Hits:
${JSON.stringify(hits.slice(0, 8))}`);
  const rivals =
    parsed && typeof parsed === "object" && "rivals" in parsed
      ? (parsed as { rivals: Array<{ name?: string; url?: string }> }).rivals
      : [];
  return (rivals ?? [])
    .filter((row) => row.url && row.name)
    .slice(0, 2)
    .map((row) => ({ name: row.name as string, url: row.url as string }));
}

export async function extractCatalog(input: {
  source: Item["source"];
  rivalName?: string;
  pageUrl: string;
  domain: Domain;
  hits: Array<{ title: string; link: string; description: string }>;
}): Promise<Item[]> {
  if (input.hits.length === 0) return [];
  const kind =
    input.domain === "edtech"
      ? "courses"
      : input.domain === "food"
        ? "menu items"
        : "products";
  const parsed = await generateJson(`Extract up to 5 public ${kind} from these search snippets.
Use only numbers present in the text. If a price or rating is missing, use null.
Return JSON: {"items":[{"name":"","url":"","price":0,"currency":"INR","rating":0,"review_count":0,"promo":false,"availability":"in_stock"}]}
availability must be in_stock, out_of_stock, or unknown.

Snippets:
${JSON.stringify(input.hits.slice(0, 8))}`);
  const rows =
    parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items: Array<Record<string, unknown>> }).items
      : [];
  return (rows ?? [])
    .filter((row) => typeof row.name === "string" && row.name.trim())
    .slice(0, 5)
    .map((row) => {
      const price =
        typeof row.price === "number"
          ? row.price
          : typeof row.price === "string"
            ? Number(String(row.price).replace(/[^0-9.]/g, "")) || null
            : null;
      const rating =
        typeof row.rating === "number"
          ? row.rating
          : typeof row.rating === "string"
            ? Number(row.rating) || null
            : null;
      const availability =
        row.availability === "in_stock" || row.availability === "out_of_stock"
          ? row.availability
          : "unknown";
      return {
        source: input.source,
        rival_name: input.rivalName,
        name: String(row.name),
        url: typeof row.url === "string" && row.url ? row.url : input.pageUrl,
        price,
        list_price: null,
        currency: typeof row.currency === "string" ? row.currency : "INR",
        availability,
        rating,
        review_count:
          typeof row.review_count === "number" ? row.review_count : null,
        promo: Boolean(row.promo),
        collector_id: "discover_sync",
        run_id: null,
      } satisfies Item;
    });
}

export async function polishPlays(plays: Play[]): Promise<Play[]> {
  if (!geminiConfigured() || plays.length === 0) return plays;
  const parsed = await generateJson(`Rewrite these growth plays. Keep every number, SKU, rival name, kind, and impact unchanged.
Return JSON: {"plays":[{"title":"","evidence":"","action":"","why_it_grows":"","kind":"","impact":"","signal_type":""}]} with the same length.
Titles: max 8 words. Evidence: cite the numbers. Action: one thing a founder can do this week. why_it_grows: one sentence on revenue, trust, or share.

Input:
${JSON.stringify(plays)}`);
  const next =
    parsed && typeof parsed === "object" && "plays" in parsed
      ? (parsed as { plays: Play[] }).plays
      : null;
  if (!Array.isArray(next) || next.length === 0) return plays;
  return next.map((play, index) => ({
    ...plays[index],
    title: play.title || plays[index].title,
    evidence: play.evidence || plays[index].evidence,
    action: play.action || plays[index].action,
    why_it_grows: play.why_it_grows || plays[index].why_it_grows,
  }));
}
