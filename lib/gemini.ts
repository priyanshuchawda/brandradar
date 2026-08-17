import type { Play } from "./schema";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function polishPlays(plays: Play[]): Promise<Play[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || plays.length === 0) return plays;

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const prompt = `You rewrite growth plays for a competitive-intelligence product.
Keep every number, SKU name, and rival name exactly as given.
Return JSON only: an array of {title, evidence, action, signal_type} with the same length and signal_type values.
Make titles short. Evidence cites the numbers. Action is something a founder can do this week.

Input:
${JSON.stringify(plays)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
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
  const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(jsonText) as Play[];
  if (!Array.isArray(parsed) || parsed.length === 0) return plays;
  return parsed.map((play, index) => ({
    title: play.title || plays[index].title,
    evidence: play.evidence || plays[index].evidence,
    action: play.action || plays[index].action,
    signal_type: plays[index].signal_type,
  }));
}
