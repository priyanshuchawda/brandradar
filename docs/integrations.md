# Integrations

BrandRadar uses one Bright Data account token (`BRIGHT_DATA_API_TOKEN`, also accepted as `BRIGHTDATA_API_KEY`). That token is the same credential Scraper Studio, Discover, and the official JavaScript SDK (`@brightdata/sdk`) use.

Gemini uses one Google AI Studio key. **Flash** (`GEMINI_MODEL_FLASH`, default `gemini-3.6-flash`) runs the heavier tools. **Flash-Lite** (`GEMINI_MODEL`, default `gemini-3.1-flash-lite`) runs cheap copy and ranking.

## What we use

| Vendor | Feature | Role |
| --- | --- | --- |
| Bright Data SDK | `client.scraperStudio.run(c_*, { input })` | Run custom collectors. Same `c_*` ids as the CLI |
| Bright Data REST | `POST /dca/trigger` + poll `/dca/dataset` | Fallback if the SDK run fails |
| Bright Data REST | `POST /discover/sync` (fast, 5 hits, no body, IN) | Rival homepages and listing snippets |
| Bright Data CLI | `scripts/studio.sh` create / heal / approve | AI Flow. Heal keeps the same collector id |
| Gemini 3.6 Flash | Structured JSON + URL context | Fallback catalog when Studio is down |
| Gemini 3.6 Flash | Function calling | Heal prompt from QA flags (concatenated prices, duplicated names) |
| Gemini 3.1 Flash-Lite | Structured JSON | Pick rivals from Discover hits, rewrite play copy |

## What we do not use (on purpose)

| Feature | Why not |
| --- | --- |
| SDK `scrape.amazon` / LinkedIn / Instagram | Library scrapers. Using them as the product extractor is ineligible |
| SDK `scrapeUrl` / Web Unlocker as the catalog source | Unstructured HTML. Studio collectors are the primary extractors |
| SDK `search.google` | Overlaps Discover. Costs a SERP zone we do not need |
| Browser API / Playwright CDP | Extra zones, extra moving parts, same public pages |
| Gemini Google Search grounding | Overlaps Bright Data Discover |
| Gemini Computer Use, video, speech, Deep Research | Wrong job, slow, not a founder brief |
| Batch / Flex / Priority inference | One scan at a time is enough |

Studio is the primary extractor. Gemini Flash URL context only runs on the Discover fallback path, and only on public HTTPS URLs the user or Discover already supplied. Gemini never invents prices.

## Extraction QA

After rows land, `lib/qa.ts` flags concatenated sale+list prices (e.g. `349499`) and duplicated titles. Flash turns those flags into a `heal_hint`. The health panel Heal button sends that prompt to Studio. That is the self-heal loop: extract → notice → plain-language repair → same `c_*`.
