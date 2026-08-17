import { NextResponse } from "next/server";
import {
  type RateLimitResult,
  clientKey,
  rateLimitHeaders,
} from "./rate-limit";

export const SCAN_BODY_LIMIT = 16 * 1024;
export const HEAL_BODY_LIMIT = 256 * 1024;
export const MAX_HEAL_PROMPT = 1000;
export const MAX_HEAL_ITEMS = 40;

export function demoFixtureAllowed(): boolean {
  if (process.env.ALLOW_DEMO_FIXTURE === "true") return true;
  if (process.env.ALLOW_DEMO_FIXTURE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function authorize(request: Request): NextResponse | null {
  const expected = process.env.BRANDRADAR_API_KEY?.trim();
  if (!expected) return null;
  const header =
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (header === expected) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function enforceOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).origin === new URL(request.url).origin) return null;
  } catch {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
}

export function limited(
  result: RateLimitResult,
  message: string,
): NextResponse | null {
  if (result.ok) return null;
  return NextResponse.json(
    { error: message },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}

export function withRateHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  const headers = rateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export { clientKey };

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown | NextResponse> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > maxBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
