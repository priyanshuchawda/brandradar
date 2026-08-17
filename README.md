# BrandRadar

**Competitive intelligence that tells a brand what to do next.**

BrandRadar is our project for [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) (WeMakeDevs × Bright Data, 17–23 Aug 2026). A brand drops in its public site. We discover rivals in the same domain, collect public catalog / price / rating / promo data with **custom Bright Data Scraper Studio collectors**, and turn gaps into growth plays. When a competitor redesigns their site, the collector **self-heals** and the dashboard keeps moving.

> Any brand, any domain. Prototype ships with **ecommerce**, **edtech**, and **food**. Fintech stays a stretch domain (too much is login-walled).
>
> **Stack (locked):** full TypeScript — Next.js App Router, Tailwind, server-side Bright Data Collection API. No Python in the product. Details in [docs/stack.md](docs/stack.md).

## Problem

Growing brands lose share to competitors they cannot see in real time. Prices, SKUs, course fees, menu items, and public reviews change daily. Most teams still check this by hand, or with scrapers that silently die after a class-name change. BrandRadar is the always-on arena: **see the market, heal the scraper, grow the brand.**

## AI disclosure

Cursor, Bright Data Scraper Studio (AI Agent / CLI), and Gemini 3.1 Flash-Lite were used. We can explain the scraper, architecture, and every API call. Details: [docs/scraper-studio.md](docs/scraper-studio.md).

## What judges should see

| Criterion | How we hit it |
| --- | --- |
| Impact | A founder/marketer gets 3 concrete growth plays, not a CSV |
| Creativity | Domain-agnostic CI + action engine, not a price table |
| Technical excellence | App + pipeline + structured output, not a notebook |
| Scraper Studio | Custom collectors (`c_*`), not library scrapers |
| Self-healing | Heal when a field goes null; same collector ID; data continues |
| Presentation | 90-second demo: brand in → rivals → plays → heal |

## Team

| Person | Role (working) |
| --- | --- |
| Priyanshu Chawda | Repo, product, scraper pipeline |
| Aditya Gayal | Scope / domains |
| Vaishnavi Repal | Domain-agnostic CI framing |
| Sneha Barge | Prototype: 2–3 domains |

## Run the app

```bash
cd brandradar
cp .env.example .env.local   # keys optional for now
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With Bright Data + Gemini keys, Discover + Flash-Lite return a **live** catalog. Custom Scraper Studio collectors (`c_*` in `.env.local`) are the scored path: create with `scripts/studio-create.sh`, then set `USE_MOCK=false`. Heal/approve from the dashboard or `scripts/studio.sh`.

GitHub (scripts only — do not `git push` / `gh pr` / `gh issue` by hand):

```bash
chmod +x scripts/*.sh
scripts/push.sh "Commit message here."
scripts/issue.sh "Issue title" <<'EOF'
Body
EOF
scripts/pr.sh "PR title" <<'EOF'
## Summary
- ...
EOF
```

Identity stays the existing local git user (`priyanshuchawda`). The scripts never run `git config`.

Keys (paste into `.env.local` when asked):

- `BRIGHT_DATA_API_TOKEN` + collector ids `c_*` — live scrape
- `GEMINI_API_KEY` — optional rewrite of play copy (numbers stay rule-based)

Do not commit `.env.local`.

## Repo map

| Path | What it is |
| --- | --- |
| [docs/problem-and-idea.md](docs/problem-and-idea.md) | Problem statement, product, why this wins |
| [docs/stack.md](docs/stack.md) | Why full TypeScript, not Python |
| [docs/architecture.md](docs/architecture.md) | App + collectors + self-heal loop |
| [docs/hackathon.md](docs/hackathon.md) | Extracted hackathon brief, rules, prizes, judging |
| [docs/scraper-studio.md](docs/scraper-studio.md) | How Scraper Studio is used (judges) |
| [prompts/cursor.md](prompts/cursor.md) | Copy-paste prompts for Cursor / Claude Code / Codex |
| [scripts/](scripts/) | `push.sh` / `pr.sh` / `issue.sh` / `studio.sh` / `studio-create.sh` |

## Hard rules we will not break

- Custom **Scraper Studio** scraper. Library scrapers alone = disqualified.
- **Public** web data only. No login, paywall, personal, or restricted data.
- Main coding starts this week (kickoff is 17 Aug 2026). Planning in this repo is allowed.
- Submission (later) needs a **public** repo, README, sample structured output, demo video, and a Scraper Studio write-up.
- Disclose AI tool use. We must be able to explain the scraper, architecture, and decisions.

## Credits

Sign up at [brdta.com/wemakedevs](https://brdta.com/wemakedevs). In Bright Data billing, enter promo code `wemakedevs` (lowercase). $50 credits + 5,000/month free tier.

Stuck: [WeMakeDevs Discord](https://discord.gg/wemakedevs) · [contact@wemakedevs.org](mailto:contact@wemakedevs.org)
