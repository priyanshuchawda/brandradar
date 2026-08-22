/** BrandRadar Discord embed palette — readable on dark theme. */
export const BRAND = {
  name: "BrandRadar",
  tagline: "Competitive visibility · Self-healing scrapers",
  appUrl: "https://brandradar-beta.vercel.app",
  hackathon: "WeMakeDevs · Into the Scrape-Verse × Bright Data",
  colors: {
    primary: 0x5cffb1,
    intel: 0x5865f2,
    schema: 0x9b59b6,
    welcome: 0x2ecc71,
    warn: 0xffb020,
    danger: 0xff5d6a,
    muted: 0x7aa2ff,
    submission: 0xe67e22,
  },
} as const;

export function embedAuthor(): { name: string; url: string } {
  return { name: BRAND.name, url: BRAND.appUrl };
}
