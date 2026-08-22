# BrandRadar

**Competitive visibility + self-healing scrapers** — built for [WeMakeDevs · Into the Scrape-Verse](https://wemakedevs.org) × **Bright Data Scraper Studio**.

| | |
|---|---|
| **Live app** | https://brandradar-beta.vercel.app |
| **Repo** | https://github.com/priyanshuchawda/brandradar |
| **License** | [MIT](LICENSE) |

When rival sites change layout, scrapers go empty. BrandRadar tracks **public update pages** (blogs, guides, changelogs), diffs them week-over-week, and **heals the same Studio collector id** (`c_*`) so intel keeps flowing — with a Monday brief in Discord.

---

## Three product faces

| Face | URL | Hackathon track | What it proves |
|------|-----|-----------------|----------------|
| **Monday Diff** | [/monday-diff](https://brandradar-beta.vercel.app/monday-diff) | #07 Changelog → Monday delivery | Real rival intel, visibility score, Discord embeds |
| **Heal Lab** | [/heal-lab/before](https://brandradar-beta.vercel.app/heal-lab/before) | #04 Self-healing scraper | `5 → 0 → 5` rows, **same** `c_*` after heal |
| **Catalog arena** | [/](https://brandradar-beta.vercel.app) | D2C / edtech / food | Discover → PDP extract → 3 growth plays |

---

## Judge path (~2 minutes)

No API keys required for the fixture demo.

1. **Heal Lab proof** — open [before](https://brandradar-beta.vercel.app/heal-lab/before) vs [after](https://brandradar-beta.vercel.app/heal-lab/after), then in the app click **Run full demo proof** (fixture: empty → heal → rows back, same collector id).
2. **Monday Diff** — open [/monday-diff](https://brandradar-beta.vercel.app/monday-diff) → **Load example week** → see diff, visibility score, plays.
3. **Discord** (optional) — join the demo server `#start-here` → `/intel mode:example` in `#monday-diff`.

Full repro with Studio collectors: [docs/hackathon.md](docs/hackathon.md).

---

## Quick start

```bash
git clone https://github.com/priyanshuchawda/brandradar.git
cd brandradar
cp .env.example .env.local   # add BRIGHT_DATA_API_TOKEN when running live Studio
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm test              # 80+ unit tests
npm run lint
npm run discord:bootstrap   # professional Discord server (needs bot token)
npm run discord:tidy        # prune junk channels + post example intel
```

---

## Configuration

Secrets in `.env.local` only — never commit.

### Bright Data (required for live scrapes)

| Variable | Purpose |
|----------|---------|
| `BRIGHT_DATA_API_TOKEN` | Scraper Studio + SDK (alias: `BRIGHTDATA_API_KEY`) |
| `COLLECTOR_INTEL_UPDATES` | Monday Diff — rival guides/blogs/changelogs |
| `COLLECTOR_HEAL_LAB` | Heal Lab before/after demo pages |
| `COLLECTOR_*_DISCOVERY` / `COLLECTOR_*_PDP` | Catalog arena (optional) |
| `USE_MOCK=false` | Prefer Studio when collector ids are set |

Create collectors with the CLI — see [docs/collectors.md](docs/collectors.md).

### Discord (Monday brief + heal alerts)

| Variable | Purpose |
|----------|---------|
| `DISCORD_BOT_TOKEN` | Bot token |
| `DISCORD_GUILD_ID` | Server id |
| `DISCORD_APPLICATION_ID` | App / client id |
| `DISCORD_CHANNEL_ID` | `#monday-diff` |
| `DISCORD_HEAL_CHANNEL_ID` | `#heal-alerts` |
| `DISCORD_PUBLIC_KEY` | Slash command signature verify |

Setup: [docs/discord.md](docs/discord.md) · `npm run discord:bootstrap`

### Optional

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Flash heal prompts + play copy (not on Monday hot path) |
| `CRON_SECRET` | Auth for `/api/cron/monday-diff` |
| `BLOB_READ_WRITE_TOKEN` | Week snapshots on Vercel (local disk works for demo) |
| `BRANDRADAR_API_KEY` | Lock mutating routes in production |

---

## AI disclosure (hackathon)

| Component | AI used? | Where |
|-----------|----------|-------|
| **Bright Data Scraper Studio** | Yes — AI Flow for collector create/heal | CLI `bdata scraper create/heal`, SDK run |
| **Monday Diff plays** | **No** — deterministic rules from diff + visibility | `lib/plays.ts`, `lib/visibility-health.ts` |
| **Gemini Flash** | Optional — heal prompt text when QA flags break | Opt-in `useGemini:true` on heal routes |
| **Gemini Flash-Lite** | Optional — arena rival pick + play copy rewrite | Arena scan path only |
| **Discord embeds** | No — templated from JSON snapshot | `lib/discord-embeds.ts` |

We do **not** invent prices, URLs, or rival posts. Numbers come from extracted rows or fixtures labeled `mode: mock`.

---

## HTTP API (summary)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/intel` | Pull cohort (week cache; `refresh` for Studio) |
| `POST` | `/api/intel/heal` | Heal `COLLECTOR_INTEL_UPDATES` |
| `GET/POST` | `/api/heal-lab` | Fixture or live heal demo |
| `POST` | `/api/discord/setup` | Bootstrap Discord server + slash commands |
| `POST` | `/api/discord/interactions` | `/intel`, `/rivals`, `/schema`, `/help` |
| `POST` | `/api/cron/monday-diff` | Weekly pull → Discord (`CRON_SECRET`) |
| `POST` | `/api/scan` | Catalog arena scan |

Intel body: `{ forceMock?, persist?, refresh? }` · Example: [examples/intel-snapshot.json](examples/intel-snapshot.json)

---

## Data schema

**Listing row** (Studio extract):

```json
{ "title": "…", "url": "https://…", "published_at": "2026-08-01", "summary": "…" }
```

**Intel snapshot** (Monday Diff week file — `data/intel/<week>/snapshot.json`):

- `rivals[]` — per-company entry buckets  
- `diff[]` — `added`, `removed`, `modified` vs prior week  
- `visibility` — score 0–100 + per-rival health  
- `plays[]` — attack / watch / fill  
- `health.collector_ids[]` — same `c_*` before & after heal  

Details: [docs/monday-diff.md](docs/monday-diff.md) · `lib/intel-schema.ts`

---

## Architecture

```
Rival update URLs (own sites)
        │
        ▼
Bright Data Scraper Studio (c_*)
        │
        ▼
Intel snapshot → diff + visibility + plays
        │
        ├──► Monday Diff UI
        ├──► Discord (#monday-diff, #heal-alerts)
        └──► Week cache (disk / optional Vercel Blob)

Heal path: QA → heal (≤2 tries) → settle verify → same c_*
```

Full diagram: [docs/architecture.md](docs/architecture.md)

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/hackathon.md](docs/hackathon.md) | **Judge repro**, submission checklist, demo video script |
| [docs/heal-lab.md](docs/heal-lab.md) | Self-heal demo (before → after → heal) |
| [docs/monday-diff.md](docs/monday-diff.md) | Cohort intel, visibility, cron, heal |
| [docs/discord.md](docs/discord.md) | Server bootstrap, embeds, slash commands |
| [docs/collectors.md](docs/collectors.md) | Studio CLI create/heal/run |
| [docs/product.md](docs/product.md) | Problem, users, plays |
| [docs/architecture.md](docs/architecture.md) | Components and pipelines |
| [docs/integrations.md](docs/integrations.md) | Bright Data SDK + Gemini boundaries |
| [docs/security.md](docs/security.md) | Auth, rate limits, URL policy |
| [docs/stack.md](docs/stack.md) | TypeScript / Next.js choices |
| [examples/](examples/) | Sample snapshot JSON |

---

## Data policy

- **Public HTTPS pages only** — no logins, paywalls, or personal data  
- **Each rival's own site** — not YC directories or third-party aggregators  
- **Library scrapers** (Amazon, LinkedIn, …) are not the product extractor  
- **Mask secrets** in demo videos and rotate any leaked tokens  

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.
