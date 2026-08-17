# Architecture (plan)

Planning is allowed before/during kickoff. Implementation starts this week.

```
[Brand URL + domain]
        │
        ▼
┌───────────────────┐     Bright Data Scraper Studio
│  BrandRadar app   │     custom collectors (c_*)
│  Next.js + TS     │◄──── Discovery / Search / PDP
│  (full stack)     │     + self-heal on null fields
│  Arena + plays    │
└─────────┬─────────┘
          │ structured JSON
          ▼
   snapshots/ (example output)
```

## Collectors (custom, required)

Each collector is one shape. Do not ask one scraper for "the whole site".

| Collector | Type | Input | Output fields (target) |
| --- | --- | --- | --- |
| `discovery` | Discovery or Search | category URL or keyword | name, url, price, rating, position, promo_flag |
| `pdp` | PDP | product/course/menu-item URL | name, brand, price, list_price, availability, rating, review_count, description, image_url |
| `heal` | same `c_*` | plain-language fix | schema extended or selectors rewritten |

Pin IDs in `.env` once created:

```
COLLECTOR_ECOMMERCE_DISCOVERY=c_...
COLLECTOR_ECOMMERCE_PDP=c_...
```

Reuse them. Do not create a new scraper every session.

## Data flow

1. User submits brand URL + domain.
2. App (or CLI) runs discovery on the brand category page and 2–4 rival category pages.
3. App takes top N item URLs, runs PDP collector.
4. Normalize into `BrandSnapshot` (see `examples/sample-output.json`).
5. Diff brand vs rivals → signals → 3 plays.
6. Health: if key fields are null, trigger `bdata scraper heal`, show preview, approve, re-run. Collector ID does not change.

## Self-heal (must be in the demo)

Happy path from Bright Data:

```bash
npx -p @brightdata/cli bdata scraper heal $COLLECTOR_ID \
  "The price field returns null since the redesign. Re-capture it." \
  --url https://example.com/product/...

npx -p @brightdata/cli bdata scraper approve $COLLECTOR_ID \
  --url https://example.com/product/...

npx -p @brightdata/cli bdata scraper run $COLLECTOR_ID \
  https://example.com/product/... --pretty
```

In the product: a **Scraper health** panel — last run, null-rate, Heal button, preview JSON, Approve. This is the Spider-Sense / Best Use of Bright Data moment.

## App sketch (week-sized)

- **Web app:** Next.js App Router, TypeScript only. See [stack.md](stack.md).
- Screens: onboarding (URL + domain) → arena (comparison) → plays → health.
- Server routes call Collection API (`POST /dca/trigger` + poll `/dca/dataset`). Port of the [official Node starter](https://github.com/brightdata/bright-data-scraper-studio-nodejs-project).
- Snapshots as JSON under `data/`. Token stays on the server.

## Stack (locked)

Full TypeScript. Bright Data’s Python starter is the same HTTP calls; we are not using it. CLI + self-heal demo + Best UI all point at one Node/TS app.

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind + shadcn/ui |
| Run collectors | Collection API in `lib/brightdata.ts` (server-only) |
| Create / heal | `npx @brightdata/cli` (`bdata scraper create \| heal \| approve`) |
| Schema | Zod (`BrandSnapshot`) |
| Store | JSON files (`data/`) |
| Insights | Deterministic rules, optional LLM copy rewrite |

## Week plan

| Day | Outcome |
| --- | --- |
| 17 Mon | Repo, idea lock, Bright Data signup + credits, first collector created |
| 18 Tue | Kickoff 15:00 UTC. Discovery + PDP collectors for ecommerce seed |
| 19 Wed | Second domain collector. Snapshot schema + sample output committed |
| 20 Thu | Arena UI with real JSON. Health panel wired to heal/approve |
| 21 Fri | Growth plays. Polish. LinkedIn post (Daily Bugle) |
| 22 Sat | Demo video, README, Scraper Studio write-up. SF in-person optional |
| 23 Sun | Submit: public repo (flip visibility), video, structured output |

## Submission checklist (from rules)

- [ ] Public source-code repository (this repo is private until submit)
- [ ] Clear README
- [ ] Example structured output
- [ ] Demo video of the working project
- [ ] Explanation of how Scraper Studio is used
- [ ] Disclose AI coding tools
