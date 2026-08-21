# Tech stack

**TypeScript only in the product.** Collectors live in Bright Data Scraper Studio. The app runs them through the official SDK (`client.scraperStudio.run`) with the Collection API as fallback.

The Collection API is documented in cURL, Node, and Python. Quality does not change with language. TypeScript is the app language because the CLI, the UI, and the API share one runtime.

## Layout

```
app/                 Next.js App Router
lib/bd.ts            @brightdata/sdk client (same token as Studio)
lib/brightdata.ts    scraperStudio.run + Collection API fallback
lib/schema.ts        Zod snapshot
lib/plays.ts         Gaps → three plays
lib/guard.ts         Rate limits, payload caps, optional API key
components/          Arena, plays, collector health
```

| Layer | Choice |
| --- | --- |
| App | Next.js App Router + TypeScript |
| UI | Tailwind |
| Discover | `POST /discover/sync`, fast, 5 results, no body, 6h cache |
| Run | `@brightdata/sdk` Scraper Studio, REST fallback |
| Create / heal | Bright Data CLI (`bdata scraper …`) |
| Validation | Zod (`examples/sample-output.json`) |
| Insights | Deterministic rules; Flash-Lite copy; Flash heal prompts |
| Node | 20+ |

## Cost control

| Call | When | Cap |
| --- | --- | --- |
| Discover | Rival URLs empty (arena) | Fast mode, 5 hits, cache 6h |
| Studio intel Discovery | Monday Diff live pull / refresh | ≤5 listing URLs; **week snapshot cache** skips re-run |
| Studio `scraperStudio.run` (arena) | Collector ids set and `USE_MOCK=false` | ≤8 PDPs |
| Studio `/dca/trigger` | SDK run failed | Same collectors |
| Gemini Flash-Lite | Arena rival pick + play copy | JSON mime; **not** on Monday Diff hot path |
| Gemini Flash | Fallback extract + heal prompts | ≤5 public URLs; heal only when requested |
| Library scrapers | Never as the product extractor | — |
| Discord post | After intel | Reuses week cache by default |

## Not in this codebase

- Python FastAPI / Streamlit as the app
- A separate scraper microservice
- Browser-side Bright Data calls
- Postgres on day one
