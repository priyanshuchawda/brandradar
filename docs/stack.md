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
| Discover | Rival URLs empty | Fast mode, 5 hits, cache 6h |
| Studio `scraperStudio.run` | Collector ids set and `USE_MOCK=false` | ≤8 PDPs |
| Studio `/dca/trigger` | SDK run failed | Same collectors |
| Gemini Flash-Lite | Rival pick + play copy | JSON mime, thinking minimal |
| Gemini Flash | Fallback extract (URL context) + heal prompt | ≤5 public URLs; function calling |
| Library scrapers | Never as the product extractor | — |

## Not in this codebase

- Python FastAPI / Streamlit as the app
- A separate scraper microservice
- Browser-side Bright Data calls
- Postgres on day one
