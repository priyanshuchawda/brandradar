# Hackathon guide · Into the Scrape-Verse

Submission for **WeMakeDevs × Bright Data Scraper Studio**.

| | |
|---|---|
| **Project** | BrandRadar |
| **Live app** | https://brandradar-beta.vercel.app |
| **Tracks hit** | #04 Self-healing scraper · #07 Changelog → Monday delivery |

---

## What we built (one paragraph)

BrandRadar monitors a fixed cohort of travel/points rivals on their **own** public update pages, diffs changes week-over-week, scores **competitive visibility**, and delivers a **Monday Diff** brief to Discord. When scrapers break after a layout change, the same Bright Data collector id is **healed in place** — proven in Heal Lab with a before/after demo on our own site.

---

## Judge repro (no secrets)

### A. Heal Lab — self-healing (#04)

1. Open https://brandradar-beta.vercel.app/heal-lab/before and `/heal-lab/after` — same content, different DOM.
2. In the app **Heal Lab** tab → **Run full demo proof** (uses fixtures — no Studio cost).
3. Proof card should show row counts **`5 → 0 → 5`** and the **same collector id** throughout.

Optional live Studio (needs `COLLECTOR_HEAL_LAB` in `.env.local`):

```bash
npx -p @brightdata/cli bdata scraper run "$COLLECTOR_HEAL_LAB" \
  "https://brandradar-beta.vercel.app/heal-lab/after" --pretty
# empty → heal → run again → rows back
```

### B. Monday Diff — changelog CI (#07)

1. Open https://brandradar-beta.vercel.app/monday-diff
2. Click **Load example week** — see rivals, diff (added/removed/modified), visibility score, plays.
3. Optional: **Refresh Studio** with `COLLECTOR_INTEL_UPDATES` set (live pull).

### C. Discord delivery

1. Join the demo server → read pinned **`#start-here`**
2. In **`#monday-diff`**: `/intel mode:example`
3. **`/schema`** — JSON contract + collector env vars
4. **`#heal-alerts`** — broken/recovered embeds when heal runs

Bootstrap your own server:

```bash
npm run discord:bootstrap   # create layout + pins
npm run discord:tidy        # delete junk + post example intel
```

---

## Local repro (with Studio)

```bash
git clone https://github.com/priyanshuchawda/brandradar.git
cd brandradar
cp .env.example .env.local
```

Minimum `.env.local` for live demo:

```bash
BRIGHT_DATA_API_TOKEN=...
BRIGHTDATA_API_KEY=...          # same value — CLI needs this alias
COLLECTOR_INTEL_UPDATES=c_...
COLLECTOR_HEAL_LAB=c_...
USE_MOCK=false
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_CHANNEL_ID=...
DISCORD_HEAL_CHANNEL_ID=...
DISCORD_APPLICATION_ID=...
DISCORD_PUBLIC_KEY=...
```

```bash
npm install && npm run dev
npm test
```

---

## Custom collectors (Studio)

### Intel updates (Monday Diff)

```bash
npx -p @brightdata/cli bdata scraper create "https://roame.travel/guides" \
  "Extract up to 15 public guide or post rows: title, absolute url, published date if shown, short summary. Listing page only." \
  --name brandradar-intel-updates --pretty
```

Pin → `COLLECTOR_INTEL_UPDATES=c_...`

### Heal Lab

```bash
npx -p @brightdata/cli bdata scraper create \
  "https://brandradar-beta.vercel.app/heal-lab/before" \
  "Extract up to 15 changelog posts: title, absolute url, published_at, short summary. Listing only." \
  --name brandradar-heal-lab --pretty
```

Pin → `COLLECTOR_HEAL_LAB=c_...`

---

## Demo video script (~3 min)

| Time | Scene |
|------|-------|
| 0:00 | Problem: rival visibility breaks when sites change |
| 0:30 | Heal Lab: before/after pages → Run full demo proof → 5→0→5, same `c_*` |
| 1:30 | Monday Diff: example week → visibility + diff + plays |
| 2:00 | Discord: `#monday-diff` `/intel mode:example` + `#schema` |
| 2:30 | Stack: Next.js + Bright Data CLI/SDK + optional Gemini |

**Mask** all API keys on screen.

---

## AI disclosure

| Layer | AI? | Notes |
|-------|-----|-------|
| Scraper Studio create/heal | **Yes** | Bright Data AI Flow |
| Monday Diff plays | **No** | Rule-based from diff |
| Visibility score | **No** | Heuristic from row counts + QA |
| Gemini | **Optional** | Heal prompt text; arena copy only |
| Discord embeds | **No** | Template from snapshot JSON |

---

## Submission checklist

- [ ] Demo video uploaded (YouTube/unlisted OK)
- [ ] README judge path + AI disclosure (this file + root README)
- [ ] Live app URL in submission form
- [ ] Collector ids verifiable in Bright Data Studio dashboard
- [ ] Secrets rotated if exposed in chat or video
- [ ] Optional: LinkedIn post (Daily Bugle track)

---

## Cohort (Monday Diff)

Config: [`config/rivals.json`](../config/rivals.json)

| Rival | Surface |
|-------|---------|
| Roame | guides |
| Stardrift | blog |
| Pointhound | blog |
| Rove | blog |

We scrape each company's **own** domain — never YC or directory sites.
