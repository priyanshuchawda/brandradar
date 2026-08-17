# Product

BrandRadar is competitive intelligence for a founder, growth lead, or category manager who already knows their own numbers and does not have a five-person research team.

They need three answers:

1. Who are we competing with this week?
2. Where are we expensive, thin, or poorly rated?
3. What should change on Monday?

## Why spreadsheets and one-off scrapers fail

| Approach | Failure |
| --- | --- |
| Manual spreadsheet | Stale before it is finished |
| Homegrown browser automation | Breaks on the first class-name change |
| Generic price tables | Data without a decision |
| Pre-built marketplace scrapers | Wrong competitive set for most regional D2C / edtech / food brands |

The wedge is **self-healing collectors plus growth plays**. Extraction is infrastructure. The product is the action.

## Flow

A brand pastes a public URL and a domain (`ecommerce`, `edtech`, `food`).

1. Discover 2–5 public competitors in the same category.
2. Collect catalog, price, availability, rating, and promo flags.
3. Normalize onto one snapshot schema.
4. Emit three plays with evidence.
5. If a field returns null after a layout change, heal the same collector id, preview, approve, re-run.

Each collector has one shape (listing or product detail). Do not pass a homepage and ask for the entire site.

## Verticals

| Domain | Why it works | Skip if |
| --- | --- | --- |
| Ecommerce (D2C) | Price, rating, stock, PDP heal story | Login-only catalog |
| Edtech | Course fee vs hours vs rating | Pricing behind auth |
| Food | Menu item + price + rating | App-only or personal data |

Fintech pricing pages are a poor default: too much sits behind login.

## Plays

Every signal maps to an action. The model may rewrite wording; it does not invent numbers.

| Signal | Example play |
| --- | --- |
| Brand 12–18% above rival on the same SKU | Match the hero SKU, or bundle to defend margin |
| Rival added SKUs the brand lacks | Fill the missing size / flavor / module |
| Rating 3.9 vs category 4.4 | Fix PDP copy around public complaints; ask for reviews |
| Rival discounting the overlap; brand is full price | Limited promo on that SKU only |
| Rival out of stock on a hero item | Merchandize that SKU until stock returns |

## Out of scope (for now)

- User accounts, billing, multi-tenant tenancy
- A long-term warehouse (short-lived snapshot cache is enough)
- Social DMs, private reviews, anything behind login
- An agent that crawls the open web without a schema
