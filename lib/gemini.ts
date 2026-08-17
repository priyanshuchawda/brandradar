import type { Domain, Item, Play } from "./schema";
import { assertPublicHttpsUrl } from "./urls";

const FLASH_LITE = "gemini-3.1-flash-lite";
const FLASH = "gemini-3.6-flash";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiLiteModel(): string {
  const requested = process.env.GEMINI_MODEL?.trim() || FLASH_LITE;
  if (requested.includes("flash-lite") || requested.includes("flash_lite")) {
    return requested;
  }
  return FLASH_LITE;
}

export function geminiFlashModel(): string {
  const requested = process.env.GEMINI_MODEL_FLASH?.trim() || FLASH;
  if (requested.includes("flash-lite") || requested.includes("flash_lite")) {
    return FLASH;
  }
  if (requested.includes("flash")) return requested;
  return FLASH;
}

/** Status pill: Flash-Lite is the default / cheap model. */
export function geminiModel(): string {
  return geminiLiteModel();
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

function publicHttps(url: string): string | null {
  try {
    return assertPublicHttpsUrl(url, "url");
  } catch {
    return null;
  }
}

function extractJson(text: string): unknown {
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

type GeminiPart = {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
};

async function generateContent(input: {
  model: string;
  prompt: string;
  tools?: unknown[];
  json?: boolean;
}): Promise<{ text: string; functionCall: GeminiPart["functionCall"] | null }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey(),
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: {
          temperature: 0.2,
          ...(input.json ? { responseMimeType: "application/json" } : {}),
          thinkingConfig: { thinkingLevel: "minimal" },
        },
        ...(input.tools?.length ? { tools: input.tools } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  };
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const functionCall = parts.find((part) => part.functionCall)?.functionCall ?? null;
  const text = parts.map((part) => part.text ?? "").join("\n").trim();
  return { text, functionCall };
}

async function generateJson(
  prompt: string,
  options: { model: string; tools?: unknown[] } = { model: geminiLiteModel() },
): Promise<unknown> {
  const { text } = await generateContent({
    model: options.model,
    prompt,
    tools: options.tools,
    json: true,
  });
  return extractJson(text);
}

function catalogItemsFromParsed(
  parsed: unknown,
  input: {
    source: Item["source"];
    rivalName?: string;
    pageUrl: string;
  },
): Item[] {
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
      const listPrice =
        typeof row.list_price === "number"
          ? row.list_price
          : typeof row.list_price === "string"
            ? Number(String(row.list_price).replace(/[^0-9.]/g, "")) || null
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
        list_price: listPrice,
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

export async function pickBrandRivals(
  hits: Array<{ name: string; url: string; title: string }>,
): Promise<Array<{ name: string; url: string }>> {
  if (hits.length === 0) return [];
  const parsed = await generateJson(
    `Pick up to 2 official consumer-brand homepages from these search hits.
Exclude news, research firms, ad libraries, marketplaces, aggregators.
Return JSON: {"rivals":[{"name":"","url":""}]}

Hits:
${JSON.stringify(hits.slice(0, 8))}`,
    { model: geminiLiteModel() },
  );
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
  const urls = [
    input.pageUrl,
    ...input.hits.map((hit) => hit.link),
  ]
    .map((url) => publicHttps(url))
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 5);

  if (urls.length === 0 && input.hits.length === 0) return [];

  const kind =
    input.domain === "edtech"
      ? "courses"
      : input.domain === "food"
        ? "menu items"
        : "products";
  const prompt = `Extract up to 5 public ${kind} from these official listing URLs and search snippets.
Use only numbers present on the page or in the snippet. If a price or rating is missing, use null.
Do not invent prices. Sale price and list_price must be separate numbers, never concatenated.
Return JSON: {"items":[{"name":"","url":"","price":0,"list_price":0,"currency":"INR","rating":0,"review_count":0,"promo":false,"availability":"in_stock"}]}
availability must be in_stock, out_of_stock, or unknown.

URLs:
${urls.join("\n")}

Snippets:
${JSON.stringify(input.hits.slice(0, 8))}`;

  try {
    const parsed = await generateJson(prompt, {
      model: geminiFlashModel(),
      tools: urls.length > 0 ? [{ url_context: {} }] : undefined,
    });
    const items = catalogItemsFromParsed(parsed, input);
    if (items.length > 0) return items;
  } catch {
    // Fall through to snippets-only Flash JSON (no URL fetch).
  }

  if (input.hits.length === 0) return [];
  const parsed = await generateJson(prompt, { model: geminiFlashModel() });
  return catalogItemsFromParsed(parsed, input);
}

export async function proposeHealPrompt(
  flags: string[],
  fallback: string | null,
): Promise<string | null> {
  if (flags.length === 0) return fallback;
  const { text, functionCall } = await generateContent({
    model: geminiFlashModel(),
    prompt: `A custom Scraper Studio collector returned messy catalog rows.
Write one heal instruction the Studio AI Flow can apply to the same collector id.
Do not invent prices. Keep it under 400 characters. Listing vs PDP: prices belong on the product page.

QA flags:
${flags.slice(0, 8).join("\n")}

Fallback hint:
${fallback ?? ""}`,
    tools: [
      {
        functionDeclarations: [
          {
            name: "propose_heal",
            description:
              "Propose a Scraper Studio heal prompt from extraction QA flags.",
            parameters: {
              type: "OBJECT",
              properties: {
                field: { type: "STRING" },
                heal_prompt: { type: "STRING" },
              },
              required: ["heal_prompt"],
            },
          },
        ],
      },
    ],
  });
  const fromCall =
    typeof functionCall?.args?.heal_prompt === "string"
      ? functionCall.args.heal_prompt.trim()
      : "";
  if (fromCall) return fromCall.slice(0, 1000);
  try {
    const parsed = extractJson(text) as { heal_prompt?: string };
    if (typeof parsed.heal_prompt === "string" && parsed.heal_prompt.trim()) {
      return parsed.heal_prompt.trim().slice(0, 1000);
    }
  } catch {
    if (text.trim()) return text.trim().slice(0, 1000);
  }
  return fallback;
}

export async function polishPlays(plays: Play[]): Promise<Play[]> {
  if (!geminiConfigured() || plays.length === 0) return plays;
  const parsed = await generateJson(
    `Rewrite these growth plays. Keep every number, SKU, rival name, kind, and impact unchanged.
Return JSON: {"plays":[{"title":"","evidence":"","action":"","why_it_grows":"","kind":"","impact":"","signal_type":""}]} with the same length.
Titles: max 8 words. Evidence: cite the numbers. Action: one thing a founder can do this week. why_it_grows: one sentence on revenue, trust, or share.

Input:
${JSON.stringify(plays)}`,
    { model: geminiLiteModel() },
  );
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
