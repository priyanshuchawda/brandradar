# Monday Diff

Competitive intel pipeline: scrape **four** rivals' **own** public update pages every week, diff against last week, score visibility, and deliver a Monday brief to Discord.

We do **not** scrape YC.com or directories. Rivals are a seed list in `config/rivals.json`; each `update_url` is that company's guides, blog, or changelog.

## Cohort

| Rival | Update surface |
| --- | --- |
| Roame | `https://roame.travel/guides` |
| Stardrift | `https://stardrift.ai/blog` |
| Pointhound | `https://www.pointhound.com/blog` |
| Rove | `https://rove.travel/blog` |

## Studio collector

One Discovery-style custom collector (listing rows only):

```bash
npx -p @brightdata/cli bdata scraper create "https://roame.travel/guides" \
  "Extract up to 15 public guide or post rows: title, absolute url, published date if shown, short summary. Listing page only." \
  --name brandradar-intel-updates --pretty
```

Pin in `.env.local`:

```bash
COLLECTOR_INTEL_UPDATES=c_...
USE_MOCK=false
BRIGHTDATA_API_KEY=...   # same as BRIGHT_DATA_API_TOKEN (CLI auth)
```

Week snapshots persist under `data/intel/<ISO-week>/snapshot.json` locally. On Vercel, set `BLOB_READ_WRITE_TOKEN` for week-over-week memory (optional for demo — local disk is fine).

## Snapshot schema

See `lib/intel-schema.ts` and `/schema` in Discord.

| Field | Meaning |
| --- | --- |
| `rivals[].entries[]` | `{ title, url, published_at, summary }` |
| `diff[]` | `added`, `removed`, `modified[]` per rival |
| `visibility` | Score 0–100, status, per-rival health |
| `plays[]` | attack / watch / fill recommendations |
| `health.collector_ids[]` | Same `c_*` before & after heal |

Example: [examples/intel-snapshot.json](../examples/intel-snapshot.json)

## Visibility score

Computed in `lib/visibility-health.ts`:

- Rivals with zero rows → degraded
- QA flags (captcha, null rate) → lower score
- Week-over-week activity (new/modified/removed) → plays input

Shown in Monday Diff UI and Discord embeds (🟢 / 🟡 / 🔴).

## Cost controls

| Action | Studio spend |
| --- | --- |
| Pull cohort (default) | **None** if this ISO week already has a live snapshot |
| Refresh Studio (`refresh: true`) | Up to 4 listing URLs |
| Post to Discord (default) | Reuses week cache |
| Load / post example | Fixture only |
| Monday cron | One pull; cache on repeat |
| Gemini on intel path | **Off** — plays are deterministic |
| Cron auto-heal when broken | Default on (`INTEL_AUTO_HEAL_ON_CRON=false` to disable) |

## API

```bash
curl -s http://localhost:3000/api/intel

curl -s -X POST http://localhost:3000/api/intel \
  -H 'content-type: application/json' \
  -d '{"forceMock":false,"refresh":false}'

curl -s -X POST http://localhost:3000/api/intel \
  -H 'content-type: application/json' \
  -d '{"forceMock":false,"refresh":true}'

curl -s -X POST http://localhost:3000/api/discord \
  -H 'content-type: application/json' \
  -d '{"forceMock":false}'

curl -s -X POST http://localhost:3000/api/intel/heal \
  -H 'content-type: application/json' \
  -d '{"action":"auto_loop","useGemini":false}'

curl -s -X POST "http://localhost:3000/api/cron/monday-diff" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel schedule: Monday 13:00 UTC (`vercel.json`).

## UI actions

| Button | Effect |
| --- | --- |
| **Load example week** | Fixture snapshot (free) |
| **Pull cohort** | Week cache first, then Studio if needed |
| **Refresh Studio** | Force live `c_*` run |
| **Post to Discord** | Embed brief to `#monday-diff` |
| **Heal collector** | `auto_loop` on same `COLLECTOR_INTEL_UPDATES` |

## Discord

Rich embeds with visibility, modified entries, plays, collector id.

```bash
npm run discord:bootstrap
npm run discord:tidy
/intel mode:example
/intel mode:live
```

Details: [discord.md](discord.md)

## Heal

Same collector id — `POST /api/intel/heal` with `heal`, `approve`, or `auto_loop`.

Alerts post to `#heal-alerts` when configured.

See also: [heal-lab.md](heal-lab.md) for the controlled before/after proof.
