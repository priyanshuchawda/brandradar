import { ensureUrl } from "./plays";

const MAX_URL_LENGTH = 2048;

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^255\./,
];

export function assertPublicHttpsUrl(value: string, label = "url"): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new Error(`${label} is too long`);
  }

  let parsed: URL;
  try {
    parsed = new URL(ensureUrl(trimmed));
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not include credentials`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error(`${label} must be a public hostname`);
  }

  if (PRIVATE_V4.some((pattern) => pattern.test(host))) {
    throw new Error(`${label} must be a public hostname`);
  }

  if (host.includes(":")) {
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      throw new Error(`${label} must be a public hostname`);
    }
  }

  return parsed.toString();
}

export function assertPublicHttpsUrls(values: string[], label: string): string[] {
  return values.map((value, index) => assertPublicHttpsUrl(value, `${label}[${index}]`));
}
