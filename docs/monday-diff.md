# Monday Diff

Competitive intel pipeline: scrape **three to five** rivals’ public update pages every week, diff against last week, and deliver a Monday brief (Discord in Phase 4).

This is BrandRadar’s cohort mode. We do **not** scrape YC or other directories. Rivals are seeded from a niche list; each `update_url` is that company’s own guides, blog, or changelog.

## Cohort

Config: [`config/rivals.json`](../config/rivals.json)

| Rival | Update surface |
| --- | --- |
| Roame | `https://roame.travel/guides` |
| Stardrift | `https://stardrift.ai/blog` |
| Pointhound | `https://www.pointhound.com/blog` |
| Rove | `https://rove.travel/blog` |

## Studio collector

Create one Discovery-style custom collector that extracts listing rows from an update index page:

- `title`
- `url` (absolute)
- `published_at` (nullable)
- `summary` (nullable)

```bash
npx -p @brightdata/cli bdata scraper create "https://roame.travel/guides" \
  "Extract up to 15 public guide or post rows: title, absolute url, published date if shown, short summary. Listing page only."
```

Pin the id:

```bash
COLLECTOR_INTEL_UPDATES=c_...
```

Heal keeps the **same** id when a blog layout moves.

## Schema

See `lib/intel-schema.ts`. Example snapshot: [`examples/intel-snapshot.json`](../examples/intel-snapshot.json).

## Roadmap

1. Rivals + schema — issue #1
2. Weekly snapshots + diff — issue #2
3. Plays + arena UI — issue #3
4. Discord delivery — issue #4 · setup in [discord.md](discord.md)

## UI

Home ships two faces:

- **Monday Diff** (default) — cohort pull, week diff, plays, Discord message preview + post button
- **Catalog arena** — existing D2C / edtech / food scan + heal loop

## API

```bash
curl -s http://localhost:3000/api/intel
curl -s -X POST http://localhost:3000/api/intel \
  -H 'content-type: application/json' \
  -d '{"forceMock":true,"persist":false}'

curl -s http://localhost:3000/api/discord
curl -s -X POST http://localhost:3000/api/discord \
  -H 'content-type: application/json' \
  -d '{"forceMock":true}'
```

`POST /api/intel` runs the cohort pull, diffs against the previous saved week (if any), and optionally writes `data/intel/<YYYY-Www>/snapshot.json`.

`POST /api/discord` runs the same pull and posts the brief via webhook or bot token.