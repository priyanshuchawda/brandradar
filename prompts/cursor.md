# Copy-paste prompts for Cursor / Claude Code / Codex

From [Bright Data coding-agent prompts](https://docs.brightdata.com/datasets/scraper-studio/coding-agent-prompts). Run CLI via npx so nothing is installed globally.

Replace `<TARGET_URL>` and `<FIELDS TO EXTRACT>`. Stop if a step fails.

## 0. Auth once

```
Run every Bright Data CLI command through `npx -p @brightdata/cli` so nothing is installed globally. Authenticate by running `npx -p @brightdata/cli bdata login`, then confirm the version with `npx -p @brightdata/cli bdata --version` before continuing.
```

## 1. Fast build-and-run

```
Build and run a Bright Data scraper. Run every Bright Data CLI command through `npx -p @brightdata/cli` so nothing is installed globally. Replace <TARGET_URL> and <FIELDS TO EXTRACT>, then do each step in order and stop if a step fails:

1. Authenticate by running `npx -p @brightdata/cli bdata login`. npx fetches the CLI on demand, so there is nothing to install.
2. Create a Bright Data scraper for <TARGET_URL> that extracts: <FIELDS TO EXTRACT>. Report the Collector ID.
3. Run that scraper on the same URL and pretty-print the result.
```

BrandRadar ecommerce discovery fill-in:

```
2. Create a Bright Data scraper for <CATEGORY_URL> that extracts: product name, product url, price, rating, listing position, and any visible discount flag. Report the Collector ID. Do not open individual product pages.
```

PDP fill-in:

```
2. Create a Bright Data scraper for <PRODUCT_URL> that extracts: product name, price, list price if shown, availability, brand, rating, review count, short description, and image url. Report the Collector ID.
```

Expected: Collector ID like `c_mpohus372o5tmid1jk`, then a JSON array. Save the id in `.env`.

## 2. Full build → heal → approve → re-run (demo this)

Official example uses Bright Data's shop. Use it first to prove the loop, then repeat on our seed brand.

```
Build, run, heal and verify a Bright Data scraper end to end. Run every Bright Data CLI command through `npx -p @brightdata/cli` so nothing is installed globally. Do every step in order and stop if a step fails:

1. Authenticate by running `npx -p @brightdata/cli bdata login`. npx fetches the CLI on demand, so there is nothing to install.
2. Create a Bright Data scraper for https://shopalto.xyz/product/aurora-wireless-headphones that extracts two fields: product name and price. Report the Collector ID.
3. Run that scraper on the same URL and pretty-print the result. Expect one row with name and price.
4. Heal the scraper in place to also capture description, image url and rating alongside the existing name and price. Keep the same Collector ID, anchor the heal on the same URL and show the approval envelope.
5. When the preview shows all five fields, approve the fix anchored on the same URL.
6. Run the scraper on the same URL again and confirm all five fields come back: name, price, description, image_url and rating.
```

Expected: same `c_*` throughout; final row has five fields.

Unattended heal: ask the agent to add `--auto-approve`. Only when we trust the preview.

## 3. Step-by-step (inspect each envelope)

Create:

```
Create a Bright Data scraper for https://shopalto.xyz/product/aurora-wireless-headphones that extracts just two fields: product name and price. Show me the Collector ID when it is done.
```

Run:

```
Run that scraper on https://shopalto.xyz/product/aurora-wireless-headphones and pretty-print the result.
```

Heal:

```
Extend the scraper in place. Heal it to also capture description, image url and rating alongside the existing name and price. Keep the same Collector ID. Anchor the heal on https://shopalto.xyz/product/aurora-wireless-headphones and show me the approval envelope when it is ready.
```

Approve:

```
The preview looks good. Approve the fix, anchored on https://shopalto.xyz/product/aurora-wireless-headphones.
```

Verify:

```
Run the scraper on https://shopalto.xyz/product/aurora-wireless-headphones again and confirm all five fields now come back: name, price, description, image_url and rating.
```

## 4. BrandRadar-specific heal (use in the product demo)

```
The price and rating fields on collector $COLLECTOR_ID now return null after the category page redesign. Heal in place. Keep the same Collector ID. Anchor on <CATEGORY_OR_PDP_URL>. Show the approval envelope. Do not create a new scraper.
```
