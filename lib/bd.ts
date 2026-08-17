import { bdclient } from "@brightdata/sdk";

let cached: bdclient | null = null;

export function brightDataClient(): bdclient {
  const apiKey =
    process.env.BRIGHT_DATA_API_TOKEN?.trim() ||
    process.env.BRIGHTDATA_API_KEY?.trim() ||
    process.env.BRIGHTDATA_API_TOKEN?.trim();
  if (!apiKey) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }
  if (!cached) {
    cached = new bdclient({
      apiKey,
      autoCreateZones: false,
      structuredLogging: false,
      verbose: false,
    });
  }
  return cached;
}
