# Architecture

```
Public brand URL + domain
        │
        ▼
┌──────────────────────────┐     Bright Data (server only)
│  BrandRadar              │     Discover  → rival homepages
│  Next.js App Router      │     Studio    → listing + PDP rows
│  TypeScript + Zod        │     Heal      → same collector id
│  Arena, plays, health    │
└────────────┬─────────────┘
             │ BrandSnapshot JSON
             ▼
     rules → 3 plays  (optional Gemini copy rewrite)
```

## Components

| Piece | Role |
| --- | --- |
| `components/scan-app.tsx` | Arena UI |
| `app/api/scan` | Status + scan. Validates URLs, rate-limits, runs the pipeline |
| `app/api/heal` | Break / heal / approve. Mock locally; Studio CLI when a real `c_*` is present |
| `lib/scan.ts` | Studio first (if ready), else Discover + Gemini extract, else fixture |
| `lib/bd.ts` | Official `@brightdata/sdk` client (same account token as Studio) |
| `lib/brightdata.ts` | `scraperStudio.run` first; REST `/dca/trigger` + `/dca/dataset` fallback |
| `lib/discover.ts` | Fast Discover, 5 hits, no page body, 6 hour cache |
| `lib/plays.ts` | Signals and plays. Deterministic |
| `lib/map-item.ts` | Studio row → `Item` |
| `lib/guard.ts` / `lib/rate-limit.ts` / `lib/urls.ts` | Auth, quotas, public HTTPS policy |

Tokens never leave the server. The browser only talks to `/api/*`.

## Live collection

1. Validate the brand URL (HTTPS, public host).
2. Discovery collector on listing URLs (Mamaearth homepage is mapped to `/shop`).
3. Take up to **eight** product URLs.
4. PDP collector for prices and ratings (listing mashups are not trusted).
5. `attachInsights` → at most three plays.
6. Optional Flash-Lite rewrite of play text. Flash may rewrite the heal prompt when QA flags a mashed price.

If Studio is not configured or fails, Discover snippets + Gemini extraction run next. If that fails, a labeled fixture is returned (development only unless `ALLOW_DEMO_FIXTURE=true`).

## Self-heal

Heal keeps the collector id stable:

```bash
npx -p @brightdata/cli bdata scraper heal "$COLLECTOR_ID" "<what broke>" --url "<public-url>" --pretty
npx -p @brightdata/cli bdata scraper approve "$COLLECTOR_ID" --url "<public-url>" --pretty
npx -p @brightdata/cli bdata scraper run "$COLLECTOR_ID" "<public-url>" --pretty
```

The health panel runs the same commands via `lib/studio.ts`. Mock snapshots never shell out to Studio.

## Persistence

Discover responses cache under `data/cache/` (gitignored, 6 hours). Raw Studio create dumps go to `data/raw/` (gitignored). There is no database in this revision.
