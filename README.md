# BrandRadar

Open-source competitive intelligence for brands that do not have a research team.

Paste a public storefront. BrandRadar finds rivals, collects catalog / price / rating / availability from public pages, and returns **three growth plays** with evidence. When a competitor redesigns a page, the same scraper repairs in place so the arena does not go blank.

See the market. Heal the scraper. Grow the brand.

## What it does

1. **Discover** rival brand sites in the same category (ecommerce, edtech, or food).
2. **Collect** structured rows with custom Bright Data Scraper Studio collectors (listing + product detail).
3. **Compare** brand vs rivals on a shared schema.
4. **Recommend** three plays: **attack** a leak, **defend** a win, or **fill** a hole — with why it grows the brand.
5. **Repair** extractors when a field comes back null — same collector id, preview, then approve.

Numbers come from extracted rows. Gemini Flash may structure a fallback catalog and write heal prompts. Flash-Lite only rewrites play copy. Neither invents prices.

## Stack

Next.js App Router, TypeScript, Tailwind, Zod. Bright Data Collection API and Discover run **only on the server**. Gemini Flash and Flash-Lite are optional.

Details: [docs/stack.md](docs/stack.md) · [docs/architecture.md](docs/architecture.md) · [docs/security.md](docs/security.md) · [docs/integrations.md](docs/integrations.md)

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Action | What happens |
| --- | --- |
| **Load demo snapshot** | Instant fixture. Disabled when `ALLOW_DEMO_FIXTURE=false` (production default). |
| **Scan arena** | Live collection. Needs Bright Data token + collector ids. Typically 30–90s. |

```bash
npm test
npm run test:coverage
npm run lint
```

## Configuration

Put secrets in `.env.local`. Never commit them.

| Variable | Purpose |
| --- | --- |
| `BRIGHT_DATA_API_TOKEN` | Same account token as Scraper Studio / `@brightdata/sdk` |
| `COLLECTOR_*_DISCOVERY` / `COLLECTOR_*_PDP` | Scraper Studio collector ids (`c_*`) |
| `USE_MOCK=false` | Prefer Studio collectors when ids exist |
| `GEMINI_API_KEY` | Optional. Flash + Flash-Lite |
| `GEMINI_MODEL` | Flash-Lite id (rival pick, play copy) |
| `GEMINI_MODEL_FLASH` | Flash id (URL context, extract, heal) |
| `BRANDRADAR_API_KEY` | Optional bearer/API key on mutating routes |
| `ALLOW_DEMO_FIXTURE` | `true`/`false`. Unset = allowed outside production |

Create collectors with `scripts/studio-create.sh`. Run / heal / approve with `scripts/studio.sh`. See [docs/collectors.md](docs/collectors.md).

## HTTP API

| Method | Path | Limits |
| --- | --- | --- |
| `GET` | `/api/scan` | Status only. 60 req / min / IP |
| `POST` | `/api/scan` | Live scan. 8 req / 15 min / IP. HTTPS public URLs only |
| `POST` | `/api/heal` | Break / heal / approve. 20 req / 15 min / IP |

Scan body: `{ brandUrl, brandName?, domain, rivalUrls?, forceMock? }`. `domain` is `ecommerce` \| `edtech` \| `food`. At most five rival URLs. Example output: [examples/sample-output.json](examples/sample-output.json).

## Repository

| Path | Contents |
| --- | --- |
| [docs/product.md](docs/product.md) | Problem, users, plays |
| [docs/architecture.md](docs/architecture.md) | Pipeline and components |
| [docs/collectors.md](docs/collectors.md) | Scraper Studio collectors and self-heal |
| [docs/integrations.md](docs/integrations.md) | Bright Data SDK + Gemini: what we use and skip |
| [docs/security.md](docs/security.md) | Auth, rate limits, URL policy, headers |
| [docs/stack.md](docs/stack.md) | Language and vendor choices |
| [examples/](examples/) | Canonical snapshot + a live PDP row |
| [scripts/](scripts/) | Git helpers and Studio CLI wrappers |

## Data policy

Public HTTPS pages only. No logins, paywalls, personal data, or private networks. Marketplace library scrapers (Amazon, LinkedIn, and similar) are not the product extractor.

## Maintainers

Priyanshu Chawda, Aditya Gayal, Vaishnavi Repal, Sneha Barge.
