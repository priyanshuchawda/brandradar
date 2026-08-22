# Architecture

BrandRadar is a **Next.js App Router** app. All Bright Data and Gemini calls run **server-side only**. The browser talks to `/api/*`.

## System overview

```
┌─────────────────────────────────────────────────────────────────┐
│  BrandRadar (Next.js + TypeScript + Zod)                        │
├─────────────────────────────────────────────────────────────────┤
│  Monday Diff          Heal Lab              Catalog arena       │
│  rival update pages   own before/after      D2C / edtech / food │
│  week diff + plays    self-heal proof       discover + PDP      │
└──────────┬──────────────────┬────────────────────┬────────────┘
           │                  │                    │
           ▼                  ▼                    ▼
   Bright Data Studio   Bright Data Studio    Studio + Discover
   COLLECTOR_INTEL_*    COLLECTOR_HEAL_LAB     COLLECTOR_*_*
           │                  │                    │
           ▼                  ▼                    ▼
   IntelSnapshot JSON    heal-engine loop      BrandSnapshot JSON
           │                  │                    │
           ├──► json-store (disk / Blob)         │
           ├──► Discord embeds                   ├──► 3 plays
           └──► Monday Diff UI                   └──► Arena UI
```

## Monday Diff pipeline

| Step | Module | Output |
|------|--------|--------|
| Pull | `lib/intel-pull.ts` | `IntelSnapshot` |
| Diff | `lib/intel-diff.ts` | added / removed / modified |
| Visibility | `lib/visibility-health.ts` | score 0–100, per-rival status |
| Plays | `lib/plays.ts` | attack / watch / fill |
| Persist | `lib/json-store.ts` | `data/intel/<week>/snapshot.json` |
| Discord | `lib/discord-embeds.ts` | rich embeds → `#monday-diff` |
| Heal | `lib/intel-auto-heal.ts` | same `c_*` via `lib/heal-engine.ts` |

Cron: `app/api/cron/monday-diff/route.ts` — pull → Discord → optional auto-heal.

## Heal Lab pipeline

| Step | Module |
|------|--------|
| Extract | `lib/heal-lab.ts` → Studio run or fixture |
| QA | `lib/extract-qa.ts` |
| Heal loop | `lib/heal-engine.ts` — ≤2 heals, settle verify |
| History | `lib/heal-history.ts` (gitignored on Vercel) |
| Discord | `#heal-alerts` via `postHealAlertToDiscord` |

## Catalog arena pipeline

```
Public brand URL + domain
        │
        ▼
Discover (optional) → rival homepages
        │
        ▼
Studio listing + PDP collectors
        │
        ▼
lib/plays.ts → 3 plays (deterministic)
```

## Key modules

| Piece | Role |
|-------|------|
| `lib/bd.ts` | `@brightdata/sdk` client |
| `lib/brightdata.ts` | `scraperStudio.run` + REST fallback |
| `lib/studio.ts` | CLI heal/approve/run wrapper |
| `lib/guard.ts` | Rate limits, optional API key, origin |
| `lib/discord-server.ts` | Guild bootstrap + channel layout |
| `lib/discord-prune.ts` | Remove junk/legacy channels |

## Self-heal contract

Heal **never** mints a new collector id:

```bash
bdata scraper heal "$COLLECTOR_ID" "<plain language fields>" --url "<page>" --pretty
bdata scraper approve "$COLLECTOR_ID" --url "<page>" --pretty
bdata scraper run "$COLLECTOR_ID" "<page>" --pretty
```

## Persistence

| Store | Path | TTL |
|-------|------|-----|
| Intel weeks | `data/intel/<ISO-week>/` | Until replaced |
| Discover cache | `data/cache/` | 6 hours |
| Heal history | `data/heal-history/` | Append-only JSONL |
| Vercel Blob | optional `BLOB_READ_WRITE_TOKEN` | Production week memory |

No Postgres in this revision.

## Discord integration

HTTP Interactions (not Gateway websocket):

- `POST /api/discord/interactions` — Ed25519 verify → slash handlers
- `lib/discord-commands.ts` — `/intel`, `/rivals`, `/schema`, `/help`
- Bootstrap: `npm run discord:bootstrap` — categories, pins, guild description

See [discord.md](discord.md).
