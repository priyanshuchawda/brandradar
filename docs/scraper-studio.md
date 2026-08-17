# How Bright Data Scraper Studio is used

This is the write-up judges asked for. BrandRadar is not a Discover-only demo. Discover finds rival **homepages**. Scraper Studio collectors (`c_*`) are the scored extractors. Gemini 3.1 Flash-Lite only structures copy and snippet rows — it does not replace the collector.

## Pipeline

1. User pastes a public brand URL and domain.
2. **Discover API** (`POST /discover/sync`, fast, no page body) finds rival homepages and listing snippets. Cached 6 hours.
3. **Scraper Studio** custom collectors extract structured catalog rows (`name`, `price`, `rating`, `availability`, …).
4. TypeScript rules compute gaps → three growth plays. Gemini Flash-Lite rewrites play text; numbers stay from the rows.
5. If a field comes back null after a layout change: `bdata scraper heal` on the **same** collector id → preview → approve → re-run.

## Collectors (custom, required)

Create with `scripts/studio-create.sh`. IDs go in `.env.local`, never in git.

| Env | Type | Seed page |
| --- | --- | --- |
| `COLLECTOR_ECOMMERCE_PDP` | PDP | Mamaearth vitamin C serum PDP |
| `COLLECTOR_ECOMMERCE_DISCOVERY` | Discovery | `https://mamaearth.in/shop` |

## Verified on Mamaearth (17 Aug 2026)

- **PDP collector** (`scripts/studio.sh run` on the vitamin C 30ml page): sale **₹349**, list **₹499**, rating **4.88**, 182 reviews. Sample row: [examples/studio-pdp-row.json](../examples/studio-pdp-row.json).
- **Discovery collector** (`https://mamaearth.in/shop`): product URLs, ratings, review counts. Listing `price` sometimes concatenates sale+list (e.g. `349499`). The app uses Discovery for URLs and **PDP for prices**, so the mashup does not reach the plays.
- A follow-up `heal` on Discovery hit **409** (another Studio refactor still in progress from create). Re-run heal after that job finishes. Collector id does not change.

Collection API in `lib/brightdata.ts` matches the official [Node starter](https://github.com/brightdata/bright-data-scraper-studio-nodejs-project): `POST /dca/trigger` → poll `GET /dca/dataset`.

## Self-heal

```bash
scripts/studio.sh heal "$COLLECTOR_ECOMMERCE_PDP" "<pdp-url>" \
  "The price field returns null since the redesign. Re-capture it."
scripts/studio.sh approve "$COLLECTOR_ECOMMERCE_PDP" "<pdp-url>"
scripts/studio.sh run "$COLLECTOR_ECOMMERCE_PDP" "<pdp-url>"
```

Collector id does not change. The dashboard health panel calls the same `scripts/studio.sh` loop when a real `c_*` is in the snapshot or `.env.local`.

## AI disclosure

Allowed by the rules. We used:

- Cursor to write the Next.js app, Zod schemas, and this repo
- Bright Data Scraper Studio AI Agent / CLI to generate collector code
- Gemini 3.1 Flash-Lite to (a) pick rival brand sites from Discover hits, (b) extract rows from public snippets when Studio ids are missing, (c) rewrite play copy

We can explain the architecture, the collector ids, and every Bright Data call. Generated collector JavaScript is reviewed in Scraper Studio before production use.

## Public data only

No login, paywall, personal, or restricted pages. India-public ecommerce / edtech / food listings.
