# Heal Lab

Controlled **self-healing** demo (#04) that pairs with [Monday Diff](monday-diff.md) (#07).

We do **not** wait for a random third-party redesign. We own a tiny public “startup” changelog and break it on purpose.

## Story (what judges want)

| Step | What happens |
| --- | --- |
| 01 Page shifts | `/heal-lab/before` → `/heal-lab/after` (class names / layout change) |
| 02 Scraper notices | Extract on **after** returns empty with the old collector |
| 03 Logic repairs | `bdata scraper heal <same c_*> "<fields in plain language>"` |
| 04 Data keeps flowing | Re-run on **after**; Discord recovery embed; Collector ID unchanged |

Fake brand: **Driftmark** (public demo only).

## URLs

- Before: `https://brandradar-beta.vercel.app/heal-lab/before`
- After: `https://brandradar-beta.vercel.app/heal-lab/after`

## Cheap local testing (default)

Heal Lab UI defaults to **fixtures** (`forceMock: true`):

1. Run before → 5 rows  
2. Run after → 0 rows  
3. **Strong heal loop** → assess → heal → verify (same `c_*`)  
4. Optional Discord broken/recovered embed  

No Bright Data credits spent. Gemini heal prompts are **opt-in**.

## Strong heal loop

Shared engine: `lib/heal-engine.ts` + listing QA in `lib/extract-qa.ts`.

1. Contract gate — empty / null_rate / row_collapse  
2. At most **one** Studio heal + approve (same collector id)  
3. Mandatory re-run verify  
4. History JSONL under `data/heal-history/` (gitignored)  
5. Discord embeds for broken / recovered / still_broken  

API: `POST /api/heal-lab` with `"action":"auto_loop"`. Monday Diff: `POST /api/intel/heal` with `"action":"auto_loop"`.

## Live Studio (after deploy)

```bash
# once pages are public
npx -p @brightdata/cli bdata scraper create \
  "https://brandradar-beta.vercel.app/heal-lab/before" \
  "Extract up to 15 changelog posts: title, absolute url, published_at, short summary. Listing only." \
  --name brandradar-heal-lab --pretty

# pin in .env.local only
COLLECTOR_HEAL_LAB=c_...

# break
bdata scraper run c_... https://brandradar-beta.vercel.app/heal-lab/after --pretty
# heal
bdata scraper heal c_... "Extract each post: title, url, published_at, summary. Prefer data-test attributes." \
  --url https://brandradar-beta.vercel.app/heal-lab/after --pretty
bdata scraper approve c_... --url https://brandradar-beta.vercel.app/heal-lab/after --pretty
bdata scraper run c_... https://brandradar-beta.vercel.app/heal-lab/after --pretty
```

Toggle **Live Studio** in the Heal Lab tab only when you intend to spend credits.

## API

`GET/POST /api/heal-lab` — actions: `run`, `heal`, `approve`, `discord`, `auto_loop`, fixtures.

## Same-URL stress (`/heal-lab/live`)

Stable link for real break→heal tests (classes, CTA positions, nested titles):

1. Deploy with `HEAL_LAB_LIVE_VARIANT = "classic"` in `lib/heal-lab-live.ts`
2. `bdata scraper run $COLLECTOR_HEAL_LAB https://brandradar-beta.vercel.app/heal-lab/live`
3. Flip to `"redesign-v2"`, merge, redeploy (URL unchanged)
4. Re-run same collector on the same URL → expect empty/broken
5. Heal + approve + re-run → expect rows back

Before/after pages stay as the static judge demo.

| Surface | Role |
| --- | --- |
| Monday Diff | Weekly competitor **own** blogs/guides → Discord |
| Heal Lab | Proof that **self-heal** works on a site we redesign |
| Catalog arena | Extra D2C heal path |

One repo, one `main`, terminal-first (`bdata` + app APIs).
