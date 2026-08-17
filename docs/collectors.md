# Collectors (Scraper Studio)

BrandRadar does not use Bright Data library scrapers as the product extractor. Listing and product-detail collectors are custom Scraper Studio templates (`c_*`).

Discover (`POST /discover/sync`) only finds rival **homepages** and listing snippets. Gemini Flash may structure those pages (URL context) when Studio ids are missing. It does not replace the collector.

## Pipeline

1. Public brand URL + domain.
2. Discover rivals (fast, five results, no page body, six-hour cache).
3. Studio discovery collector → product URLs.
4. Studio PDP collector → name, price, list price, availability, rating, reviews.
5. Rules → three plays. Flash-Lite may rewrite copy; numbers stay on the rows.
6. Null fields → `bdata scraper heal` on the **same** id → preview → approve → re-run.

## Environment

Ids live in `.env.local`, never in git.

| Variable | Type | Seed |
| --- | --- | --- |
| `COLLECTOR_ECOMMERCE_PDP` | PDP | Mamaearth vitamin C 30 ml product page |
| `COLLECTOR_ECOMMERCE_DISCOVERY` | Discovery | `https://mamaearth.in/shop` |

```bash
scripts/studio-create.sh <name> <https-url> "<fields to extract>"
scripts/studio.sh run <collector_id> <https-url>
scripts/studio.sh heal <collector_id> <https-url> "<what broke>"
scripts/studio.sh approve <collector_id> <https-url>
```

## Verified extraction

Mamaearth vitamin C 30 ml PDP: sale ₹349, list ₹499, rating 4.88, 182 reviews. Canonical row: [examples/studio-pdp-row.json](../examples/studio-pdp-row.json).

Discovery returns product URLs and ratings. Listing `price` can concatenate sale + list (e.g. `349499`). The app uses Discovery for URLs and **PDP for prices**.

Collection API in `lib/brightdata.ts` follows the official [Node starter](https://github.com/brightdata/bright-data-scraper-studio-nodejs-project): `POST /dca/trigger` → poll `GET /dca/dataset`.

## Self-heal

Collector id does not change. The health panel calls the same `scripts/studio.sh` path when the snapshot (or env) has a real `c_*`. Mock snapshots stay in-process.

## Models and codegen

Studio's AI Flow generates collector JavaScript; review it in the Studio UI before relying on it in production. Gemini Flash is used for fallback extract (URL context) and heal prompts. Flash-Lite is used for rival picking from Discover hits and play wording.
