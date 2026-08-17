import type { Play } from "./schema";

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

export async function polishPlays(plays: Play[]): Promise<Play[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || plays.length === 0) return plays;

  const model = geminiModel();
  const prompt = `Rewrite these growth plays. Keep every number, SKU, and rival name unchanged.
Return a JSON array of {title, evidence, action, signal_type} with the same length and signal_type values.
Titles: max 6 words. Evidence: cite the numbers. Action: one thing a founder can do this week.

Input:
${JSON.stringify(plays)}`;

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
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Gemini did not return a JSON array");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Play[];
  if (!Array.isArray(parsed) || parsed.length === 0) return plays;
  return parsed.map((play, index) => ({
    title: play.title || plays[index].title,
    evidence: play.evidence || plays[index].evidence,
    action: play.action || plays[index].action,
    signal_type: plays[index].signal_type,
  }));
}
