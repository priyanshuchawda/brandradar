# How to use Bright Data Scraper Studio (hackathon notes)

Official docs, compressed for the team. Prefer the live docs if something conflicts.

Signup: [brdta.com/wemakedevs](https://brdta.com/wemakedevs)
Credits: Bright Data profile → billing → code `wemakedevs` (lowercase)
Free tier: 5,000 credits/month on top of the $50 promo

**Do not commit API tokens.** Use `.env`.

## What Scraper Studio is

Build a **custom** scraper for any public site. Proxies, retries, unblocking are Bright Data's problem. Three ways to build, same output:

| Path | When |
| --- | --- |
| **CLI** (`bdata`) | Fastest. Works inside Cursor / Claude Code / Codex. Our default. |
| **AI Agent** (control panel) | No-code. Same five scraper types. |
| **IDE** (JavaScript) | Full control, `set_session_cookie()` if ever needed — we should not need login. |

A published scraper is a **Collector** with id `c_...`. That id is the API handle. Self-heal **keeps the same id**.

Hackathon rule: we must create our own collector. Pre-built library scrapers (Amazon, LinkedIn, …) alone do not qualify. Those sites are also a poor fit because the skills repo routes them to data-feeds.

## Five scraper types (pick one shape)

Not a crawler. Do not pass a homepage and ask for everything.

| Type | You provide | You get | Cost shape |
| --- | --- | --- | --- |
| **PDP** | Product/course/item URLs | One full row per URL | 1 visit / input |
| **Discovery** | Category / listing URL | Listing rows (title, price, rank) | 1 visit / input |
| **Discovery + PDP** | Category URL | Full detail for every item | 1 + N (expensive) |
| **Search** | Keyword (+ optional country) | Discovery or Discovery+PDP shape | 1 + M |
| **Sitemap** | Domain or `sitemap.xml` | Per-page detail for sitemap URLs | 1 + N |

BrandRadar default: **Discovery** (or Search) to find items, then **PDP** on a shortlist. Avoid Discovery+PDP on huge categories during the week.

## CLI — install nothing, run via npx

```bash
npx -p @brightdata/cli bdata --version

# session alias
alias bdata="npx -p @brightdata/cli bdata"

# or global
npm install -g @brightdata/cli
```

`bdata` and `brightdata` are the same binary.

### Login

```bash
bdata login
```

Opens a browser, stores the key locally, creates zones `cli_unlocker` and `cli_browser`.

Headless / CI:

```bash
export BRIGHTDATA_API_KEY="your_api_key_here"   # from Account Settings
```

App runtime (Collection API) uses a **bearer token** — different name in docs: `BRIGHT_DATA_API_TOKEN`. Copy from Account Settings → API Tokens. Put it in `.env`, never in git.

### Create → run

```bash
bdata scraper create https://news.ycombinator.com \
  "Extract top stories: title, url, points, author, comment count"

# save the c_* id
bdata scraper run c_YOUR_ID https://news.ycombinator.com --pretty
```

Create takes **5–15 minutes** (up to ~25 on hard pages). Stages: `user_intent_analyzer` → `planner` → `collector_maintainer` → `output_schema_generator` → `code_generator` → `input_schema_generator` → `preview_runner` → `preview_picker`.

Run tries realtime first, then silently falls back to batch (`POST /dca/trigger` + poll dataset).

### Self-heal (keep the same collector)

```bash
bdata scraper heal c_YOUR_ID \
  "The points and comment_count fields return null since the site redesign. Re-capture them from the new markup." \
  --url https://news.ycombinator.com

# review preview_result, then:
bdata scraper approve c_YOUR_ID --url https://news.ycombinator.com
# or
bdata scraper approve c_YOUR_ID --reject

bdata scraper run c_YOUR_ID https://news.ycombinator.com --pretty
```

Heal prompt max ~1,000 characters. Default stops at `awaiting_approval`. Unattended: `--auto-approve` (only if we trust the preview).

Control-panel equivalent: Self-Healing tool in the IDE — plain language → diff → Accept to draft → preview → Save to Production. Emails when the diff is ready (can take up to 15 min). Rollback via Versions.

### Pin collector IDs in the agent

In `.cursor/rules` or this repo:

```
SCRAPER_STUDIO_COLLECTOR_ID=c_...
USAGE=npx -p @brightdata/cli bdata scraper run $SCRAPER_STUDIO_COLLECTOR_ID <url> --pretty
```

Optional MCP (separate from Scraper Studio, extra scrape/search tools):

```bash
brightdata add mcp    # pick Cursor
```

Skills: [github.com/brightdata/skills](https://github.com/brightdata/skills) (`scraper-studio` skill).

## Collection API (product integration)

Once we have `c_*`:

1. `POST https://api.brightdata.com/dca/trigger?collector=$ID&queue_next=1`  
   Body: JSON array of inputs, default `[{"url":"..."}]`  
   Returns `{ "collection_id": "j_..." }`  ← this is the snapshot id
2. Poll `GET https://api.brightdata.com/dca/dataset?id=j_...` every 5s  
   Building: `{ "status": "building" }`  
   Ready: a JSON **array**

Header: `Authorization: Bearer $BRIGHT_DATA_API_TOKEN`

IDs:

| Looks like | Meaning |
| --- | --- |
| `c_...` | Collector (scraper definition). Stable. Heal does not change it. |
| `j_...` | One run. Trigger returns it as `collection_id`; dataset query uses it as `id`. |

Timing (typical PDP): 1–10 URLs in 30–90s; 11–100 in 2–5 min.

Errors: 401 token; 404 bad collector; 422 input schema mismatch; 5xx retry; `[]` empty or expired (batch kept 16 days, realtime 7).

AI Flow API (`/dca/collectors/{c_*}/automate_template`, `refactor_template`) **creates/heals**. Collection API **gets data**. The app should use Collection API. Create/heal via CLI during the week.

### Minimal Node trigger

```js
const triggerUrl =
  `https://api.brightdata.com/dca/trigger?collector=${process.env.BRIGHT_DATA_COLLECTOR_ID}&queue_next=1`;

const response = await fetch(triggerUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.BRIGHT_DATA_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify([{ url: "https://example.com/product/1" }]),
});
const { collection_id: snapshotId } = await response.json();
```

Then poll `/dca/dataset?id=${snapshotId}` until `Array.isArray(body)`.

## AI Agent (control panel) — if someone prefers GUI

Scrapers → Scraper Studio → paste URL + fields / where on the page / actions ("click Show more") / selectors if known → approve schema → wait for code → Try it out / API / schedule.

Resume unfinished chats under **My AI Chats**. After create, further edits are Self-Healing, not the same chat.

Example prompts from docs:

```
Build a Discovery scraper for the category page <URL>.
Return one row per item: title, price, rating, listing position, product URL.
Do not open individual product pages.
```

```
Build a PDP scraper. For each product URL I provide, extract
title, price, availability, brand, rating, review count, image URLs.
Return one row per input URL.
```

## Self-Healing tool (IDE) example prompts

```
Add 'price' and 'image' fields to the output
The 'price' value is returning 'undefined', please fix
```

Vague prompts fail. Name the field and the symptom. After accept: preview, then Update Schema if fields changed, then Save to Production.

## CLI vs product (cheat sheet)

| You ran | API behind it |
| --- | --- |
| `bdata login` | Local key store |
| `bdata scraper create` | `POST /dca/collector` + `automate_template` |
| `bdata scraper run` (small) | `POST /dca/trigger_immediate` + `GET /dca/get_result` |
| `bdata scraper run` (large) | `POST /dca/trigger` + poll `GET /dca/dataset?id=j_*` |
| `bdata scraper heal` | `POST .../refactor_template` |
| `bdata scraper approve` | `POST .../resume_automation_job` |

## Other CLI (not the hackathon requirement)

`brightdata scrape`, `search`, `discover`, `pipelines`, `browser` wrap the wider platform. Useful for exploration. **The scored artifact is still a Scraper Studio collector.**

## Legal / ToS for us

- Public pages only.
- Treat missing fields as `null`; do not invent values.
- Prefer regional / niche sites the library does not already cover — that is where Scraper Studio is meant to shine, and it photographs better for "Best Use of Bright Data".
