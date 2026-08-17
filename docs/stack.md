# Tech stack — locked

**Full TypeScript. No Python in the product.**

Bright Data’s docs ship the same Collection API in three languages (cURL, Node, Python). The two official starters are twins (~150 LOC, retry/backoff, `triggerWithUrls` / `trigger_with_urls`):

- [Node.js starter](https://github.com/brightdata/bright-data-scraper-studio-nodejs-project) — Node 18+, ES modules
- [Python starter](https://github.com/brightdata/bright-data-scraper-studio-python-project) — Python 3.8+, `requests`

Language does **not** change scraping quality. Collectors live in Scraper Studio. Our app only `POST /dca/trigger` and poll `GET /dca/dataset`.

We still pick **TypeScript-only** because of everything around that HTTP call.

## Why not Python (or a split stack)

| Factor | TypeScript | Python |
| --- | --- | --- |
| Official Collection API starter | Yes | Yes (same endpoints) |
| Bright Data CLI (`npx @brightdata/cli`) | Native (Node) | You shell out anyway |
| Self-heal demo Bright Data points at | [Node](https://github.com/anil-bd/scraper-studio-self-healing-demo) | None official |
| Coding-agent skills / Cursor | JS/TS first | Works, more friction |
| Suit-Up (Best UI) | Next.js is the fastest path to a finished-looking app | Streamlit/Gradio looks like a notebook; FastAPI+React is two codebases |
| One-week team | One language, one deploy | Python API + TS UI = two runtimes, two `.env`s, two deploys |

Split (FastAPI + Next) only pays off if someone on the team cannot write TypeScript. Nobody has said that. Do not pay the glue tax.

Python is fine for a **one-off notebook** to inspect a collector dump. That is not the scored app.

## What we ship

```
brandradar/
  app/                  Next.js App Router (TypeScript)
  lib/brightdata.ts     Port of the official Node starter (server-only)
  lib/schema.ts         Zod: BrandSnapshot
  lib/plays.ts          Deterministic gap → 3 plays
  components/           Arena, plays, scraper health
```

| Layer | Choice | Notes |
| --- | --- | --- |
| App | **Next.js** (App Router) + **TypeScript** | UI + API in one repo. Deploy on Vercel for the demo. |
| UI | Tailwind + shadcn/ui | Fast, looks finished. Suit-Up track. |
| Bright Data **Discover** | `POST /discover/sync` | Rival homepages only. `mode=fast`, `num_results=5`, no page body, 6h cache. |
| Bright Data **run** | Collection API from **server** route handlers | Port `runScraper` / `triggerWithUrls`. Token never in the browser. |
| Bright Data **create / heal** | `scripts/studio-create.sh` / `scripts/studio.sh` | CLI is Node. Health panel shells heal/approve on the same `c_*`. |
| Validation | Zod | Same shape as `examples/sample-output.json` |
| Store | JSON files under `data/` (SQLite only if we have time) | Week-sized. Two snapshots = “this run vs last”. |
| Insights | TypeScript rules first, **Gemini 3.1 Flash-Lite** rewrite of play copy | Flash-Lite only. JSON mime type. Thinking minimal. Numbers stay deterministic. |
| Node | 20+ | Matches `fetch` in the official starter |

## How the official Node starter maps onto us

Their script:

1. `POST /dca/trigger?collector=$ID&queue_next=1` with `[{ url }]`
2. Poll `GET /dca/dataset?id=$collection_id` every 5s (max ~5 min)
3. Retry 5xx with backoff 1s/2s/4s; **fail fast on 4xx**
4. Helpers: `runScraper`, `triggerWithUrl`, `triggerWithUrls`, `saveResults`

We copy that behavior into `lib/brightdata.ts` (TypeScript, typed inputs). We do **not** vendor their whole repo as the app.

Docs: [API quickstart](https://docs.brightdata.com/api-reference/scraper-studio-api/Getting_started_with_the_API) (cURL / Node / Python side by side).

## Cheap usage (hackathon week)

**Gemini:** `gemini-3.1-flash-lite` only. It rewrites the 3 play titles. It does not pick rivals, invent prices, or scrape. `responseMimeType=application/json` + `thinkingLevel=minimal`.

**Bright Data — two products, one token:**

| Call | When | Cost control |
| --- | --- | --- |
| Discover `/discover/sync` | User left rival URLs empty | Fast mode, 5 results, no `include_content`, cache 6h |
| Scraper Studio `/dca/trigger` | Collector IDs exist and `USE_MOCK=false` | Shortlist ≤12 PDPs |
| Library scrapers (Amazon, LinkedIn, …) | Never as the scored scraper | Hackathon DQ |

Until both Discovery + PDP ids exist: Discover + Gemini extract live snippets; heal is simulated. With ids and `USE_MOCK=false`, `/dca/trigger` is first and the health panel shells `scripts/studio.sh heal|approve` on the same `c_*`.

## What we explicitly will not add

- Python FastAPI / Flask / Streamlit as the product
- A separate scraper microservice
- Client-side Bright Data calls
- Prisma + Postgres on day one
