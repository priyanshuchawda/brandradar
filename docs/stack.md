# Tech stack

**TypeScript only in the product.** Collectors live in Bright Data Scraper Studio. The app is HTTP: trigger a collector, poll a dataset, validate with Zod.

The Collection API is documented in cURL, Node, and Python. Quality does not change with language. TypeScript is the app language because the CLI, the UI, and the API share one runtime.

## Layout

```
app/                 Next.js App Router
lib/brightdata.ts    Collection API (official Node starter, typed)
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
| Run | Collection API from server routes |
| Create / heal | `scripts/studio-create.sh` / `scripts/studio.sh` |
| Validation | Zod (`examples/sample-output.json`) |
| Insights | Deterministic rules; optional Gemini 3.1 Flash-Lite copy |
| Node | 20+ |

## Cost control

| Call | When | Cap |
| --- | --- | --- |
| Discover | Rival URLs empty | Fast mode, 5 hits, cache 6h |
| Studio `/dca/trigger` | Collector ids set and `USE_MOCK=false` | ≤8 PDPs |
| Gemini Flash-Lite | Copy rewrite / snippet extract | JSON mime, thinking minimal |
| Library scrapers | Never as the product extractor | — |

## Not in this codebase

- Python FastAPI / Streamlit as the app
- A separate scraper microservice
- Browser-side Bright Data calls
- Postgres on day one
