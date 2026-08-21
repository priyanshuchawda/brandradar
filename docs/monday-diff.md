# Monday Diff

Competitive intel pipeline: scrape **three to five** rivals’ **own** public update pages every week, diff against last week, and deliver a Monday brief to Discord (`#monday-diff`).

We do **not** scrape YC.com or directories. Rivals are a seed list of competitor *companies*; each `update_url` is that company’s guides, blog, or changelog.

## Cohort

Config: [`config/rivals.json`](../config/rivals.json)

| Rival | Update surface |
| --- | --- |
| Roame | `https://roame.travel/guides` |
| Stardrift | `https://stardrift.ai/blog` |
| Pointhound | `https://www.pointhound.com/blog` |
| Rove | `https://rove.travel/blog` |

## Studio collector

One Discovery-style custom collector (listing rows only — not Discovery+PDP):

```bash
npx -p @brightdata/cli bdata scraper create "https://roame.travel/guides" \
  "Extract up to 15 public guide or post rows: title, absolute url, published date if shown, short summary. Listing page only." \
  --name brandradar-intel-updates --pretty
```

Pin in `.env.local` only:

```bash
COLLECTOR_INTEL_UPDATES=c_...
USE_MOCK=false
```

Heal keeps the **same** id: `POST /api/intel/heal` or `bdata scraper heal`.

## Cost controls

| Action | Studio spend |
| --- | --- |
| Pull cohort (default) | **None** if this ISO week already has a live snapshot |
| Refresh Studio (`refresh: true`) | 4 listing URLs max |
| Post to Discord (default) | Reuses week cache — no re-scrape |
| Load / post example | Fixture only |
| Monday cron | One pull; retries hit cache |
| Gemini on intel path | **Off** — plays are deterministic rules |

## API

```bash
curl -s http://localhost:3000/api/intel
curl -s -X POST http://localhost:3000/api/intel \
  -H 'content-type: application/json' \
  -d '{"forceMock":false,"refresh":false}'

# Spend credits only when you mean it:
curl -s -X POST http://localhost:3000/api/intel \
  -H 'content-type: application/json' \
  -d '{"forceMock":false,"refresh":true}'

curl -s -X POST http://localhost:3000/api/discord \
  -H 'content-type: application/json' \
  -d '{"forceMock":false}'

curl -s -X POST http://localhost:3000/api/intel/heal \
  -H 'content-type: application/json' \
  -d '{"action":"heal"}'

# Cron (set CRON_SECRET)
curl -s -X POST "http://localhost:3000/api/cron/monday-diff" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel schedule: Monday 13:00 UTC (`vercel.json`).

## UI

- **Pull cohort** — week cache first
- **Refresh Studio** — live `c_*` run
- **Post to Discord** — from cache
- **Heal collector** — same `COLLECTOR_INTEL_UPDATES` id

Catalog arena remains a second tab for D2C heal demos.
