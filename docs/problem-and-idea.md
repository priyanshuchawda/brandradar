# Problem statement and product idea

Working name: **BrandRadar**
Tagline: See the market. Heal the scraper. Grow the brand.

This is the idea we should pitch. It is domain-agnostic (Vaishnavi's point) and scoped to 2–3 demo domains (Sneha + Aditya). It maps onto two official hackathon idea tracks: **Competitive intelligence** and **Price and inventory intelligence**.

## One-sentence problem

Growing brands cannot see competitors in real time, so they price wrong, miss SKUs, and react to reviews weeks late — and the scrapers they try to build die the first time a site redesigns.

## Who it is for

A founder, growth lead, or category manager at a D2C / marketplace / edtech / food brand. They already know their own numbers. They do **not** have a 5-person CI team. They need:

1. Who am I actually competing with this week?
2. Where am I expensive, thin, or poorly rated?
3. What should I change on Monday?

## Why existing tools fail

| Approach | Failure |
| --- | --- |
| Manual spreadsheet | Stale by the time it is filled |
| "Just scrape Amazon" | Library scrapers are banned for this hackathon; also not how most Indian/regional brands compete |
| Homegrown Puppeteer | Breaks when `.product-grid > .card .price` becomes `[data-test="price"]` |
| Generic price comparison | Data without a decision. Judges already listed this as the boring example. |

BrandRadar's wedge is **self-healing collectors + growth plays**. The scraper is infrastructure. The product is the action.

## Product

A brand pastes a public URL (or a brand name) and picks a domain. BrandRadar:

1. **Discovers** 3–5 public competitors in the same category (search / listing pages).
2. **Collects** catalog, price, availability, rating, promo flags via custom Scraper Studio collectors.
3. **Compares** the brand vs rivals on a shared schema.
4. **Recommends** 3 growth plays with evidence (price gap, catalog hole, rating gap, promo intensity).
5. **Heals** when a field comes back null after a layout change — same `c_*` collector ID, dashboard never goes blank.

Not a crawler. Each collector is one data shape (Discovery, PDP, Search). Official Bright Data rule: do not pass a homepage and ask for "everything".

## Prototype domains (this week)

Pick **two locked, one stretch**. Recommended:

| Domain | Why it is demoable | Public sources (examples, not locked) | Skip if |
| --- | --- | --- | --- |
| **Ecommerce (D2C beauty / home)** | Discovery + PDP scrapers, price + rating + stock. Best self-heal story. | Public category + product pages of 2–3 D2C brands | Site is login-only |
| **Edtech** | Course cards: title, price, duration, rating, instructor. Clear "you are ₹X more expensive for the same hours" play. | Public course listing / course detail pages | Pricing behind login |
| **Food** | Menu item + price + rating. Visual, judges get it in 10 seconds. | Public restaurant / cloud-kitchen menu pages | Heavily geo-gated or app-only |
| Fintech (stretch) | Feature/fee comparison | Public pricing pages | Almost always login / personal data — high DQ risk |

Do **not** scrape: Amazon/LinkedIn/TikTok via Bright Data's prebuilt library as the *only* scraper (disqualified). Do **not** scrape login-protected dashboards, paywalled reports, or personal data.

Seed brands for the live demo (swap if a site is hostile):

- Ecommerce: a mid-size D2C brand vs 2 category rivals on public product pages
- Edtech: a course platform vs 2 others on public course listings
- Food: one restaurant brand vs 2 nearby/public menu pages

Keep a fallback: Bright Data's own demo shop (`ecommerce-shop-brd.vercel.app`) if a live site blocks us during the demo.

## What "help the brand grow" means in the UI

Do not ship a table and call it a product. Every insight has a **play**:

| Signal | Example play |
| --- | --- |
| Brand is 12–18% above rival on the same SKU | Match the hero SKU, or bundle to defend margin |
| Rival launched 6 new SKUs this week; brand catalog is static | Fill the missing flavor / size / course module |
| Rating 3.9 vs category 4.4 on the same product type | Surface the top public complaint themes and fix the PDP copy |
| Rival is discounting 30% of catalog; brand is 0% | Limited-time promo on the overlapping SKU, not a sitewide sale |
| Rival out of stock on a hero item | Capture demand: boost ads / merchandising on that SKU |

The LLM (or a rules engine for the prototype) only **summarizes public structured fields**. It does not invent numbers.

## What we will not build this week

- User accounts, billing, multi-tenant SaaS
- Historical 12-month warehouse (keep 1–2 snapshots so "this week vs last run" works)
- Scraping social DMs, private reviews, or anything behind login
- "AI agent that browses the whole internet"

## Pitch (30 seconds)

> Brands don't lose because they lack data. They lose because the market moves and their scrapers die. BrandRadar is competitive intelligence for any brand: drop in a URL, we find rivals, collect public catalog and ratings with self-healing Bright Data scrapers, and hand the founder three growth plays. When the competitor redesigns the PDP, the collector repairs itself and the arena stays live.

## Why this can win a track

- **Web-Slinger / Best Use of Bright Data:** custom Scraper Studio collectors, CLI/agent-driven, self-heal on a real layout change, API into a product.
- **Suit-Up / Best UI:** one arena screen, not a settings dump. Brand vs rivals, plays on the right.
- **Spider-Sense / Clean code:** typed schemas, collector IDs in env, heal loop isolated, README a stranger can run.

## Open decisions for the team (today)

1. Lock two domains: **ecommerce + edtech** (recommended) or ecommerce + food.
2. Lock 2–3 seed brands per domain that have public listing + detail pages.
3. Who owns UI vs collectors vs insight engine.
4. Demo script: 90 seconds, including one heal.
