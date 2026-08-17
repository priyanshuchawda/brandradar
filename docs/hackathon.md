# Into the Scrape-Verse — extracted brief

Source: [wemakedevs.org/hackathons/scrape-verse](https://www.wemakedevs.org/hackathons/scrape-verse) and subpages. Extracted 17 Aug 2026. Not affiliated with Marvel/Sony; theme is creative only.

## Snapshot

| | |
| --- | --- |
| Event | Into the Scrape-Verse · WeMakeDevs × Bright Data |
| When | **17–23 August 2026** |
| Where | Online anywhere, or live SF (Zero Downtime Hackathon, 22 Aug) |
| Team | Solo or **up to 4**. One team per person. |
| Theme | Build **self-healing** web scrapers, run them from a coding agent, turn the data into something real |
| Required tech | **Bright Data Scraper Studio** custom scraper. Library-only = ineligible. |
| Contact | [contact@wemakedevs.org](mailto:contact@wemakedevs.org) |
| Discord | [discord.gg/wemakedevs](https://discord.gg/wemakedevs) |
| Register | [Google Form](https://forms.gle/sDXYyuaDTPwhWtca7) |
| Bright Data signup | [brdta.com/wemakedevs](https://brdta.com/wemakedevs) |
| Credits | Promo code `wemakedevs` (lowercase) in billing. $50 + 5,000/month free tier. |

Not open to participants in **Pakistan** and **Iran** (Bright Data platform restriction).

## Schedule

| When | What |
| --- | --- |
| Open now | Registration |
| **17 Aug** | Week starts. Brief live. Build from here. |
| **18 Aug, 15:00 UTC** | Kickoff stream: "Build Web Scrapers That Fix Themselves" |
| **23 Aug** | Submissions close (repo, README, structured output, demo video) |
| Early September | Winners on Discord + socials |

## The challenge (about)

Scrapers work in testing, then break when a site changes a class name. This week is about fixing that.

Flow they want us to internalize:

1. The page shifts (class renamed, field moved, layout redesigned).
2. The scraper notices (extraction empty where it used to have a value).
3. The logic repairs (Scraper Studio rewrites extraction from a **plain-language description** of the field).
4. The data keeps flowing (collector `c_*` continues; nothing downstream sees a gap).

You describe the field once in plain language. When the page moves, Scraper Studio rewrites extraction against that description.

## What to build

Open-ended. Application, automation, research platform, developer tool, data pipeline, or AI product — as long as a **Scraper Studio scraper feeds it**.

Must:

1. Extract data from public website(s) of choice.
2. Ship a **functional** app (web, mobile, or desktop) that uses the data.
3. Solve a problem, provide insights, or offer a unique service.

AI coding tools are allowed if we understand, verify, and can explain the project.

## Official idea tracks (we are in 1 + 2)

1. **Price and inventory intelligence** — prices, availability, discounts, product changes across stores/marketplaces.
2. Documentation to RAG.
3. **Competitive intelligence** — product pages, changelogs, release notes, directories, public announcements.
4. Market research — listings, reviews, public company info.
5. Developer trend tracker.
6. Scraper health monitor — validate output, missing fields, failures, repair workflow.

BrandRadar = competitive intelligence + price/inventory + a health monitor in-product.

## Judging (six criteria, equal weight)

Demo is scored as hard as the code.

1. Potential impact — clear useful problem
2. Creativity and innovation — original approach to web-data collection
3. Technical excellence — complete, reliable, structured
4. **Use of Scraper Studio** — must be central
5. **Reliability and self-healing** — site changes, missing data, extraction failures
6. Presentation — problem, scraper workflow, structured output, final product

## Prizes (~$15,000)

| Track | Prize | Notes |
| --- | --- | --- |
| Web-Slinger (grand) · Best Use of Bright Data | NVIDIA DGX Spark (~$5,000) | One machine to the team, or $5,000 cash instead |
| Suit-Up · Best UI | Apple iPad | **Every** winning team member |
| Spider-Sense · Best Clean Code | Keychron keyboard | **Every** winning team member |
| Daily Bugle · Best LinkedIn post | Samsung Galaxy Watch | One post; tag WeMakeDevs; LinkedIn only |
| Raffle | Iron Man MK5 helmet (Black Edition, voice control) | All valid registrations; no project required |
| Top teams | $2,500 Bright Data credits (split) | Keep collectors running after the week |
| Every signup | $50 Bright Data credits | Not a prize; use code `wemakedevs` |

Every project submission is auto-entered for grand + Suit-Up + Spider-Sense. Daily Bugle is opt-in by posting.

## Rules that matter

Full page: [rules](https://www.wemakedevs.org/hackathons/scrape-verse/rules). Also bound by WeMakeDevs Code of Conduct.

- Custom Scraper Studio scraper required. **Using only** the Scrapers Library does not qualify.
- Publicly available web data only. No private, login-protected, paywalled, personal, or restricted information.
- Main coding/design after the hackathon starts. Ideas, notes, architecture, diagrams beforehand are OK.
- Frameworks, OSS, public APIs, templates, third-party tools OK. Original work during the week is judged.
- AI assistants allowed; **must disclose**. Entirely generated projects with no understanding may be rejected.
- IP belongs to the team. Agree internally before submit.
- Harassment, discrimination, plagiarism, judging manipulation → DQ.

### Every submission must include

1. A **public** source-code repository
2. A clear README
3. Example structured output
4. A demo video of the working project
5. A clear explanation of how Bright Data Scraper Studio is used

## FAQ (compressed)

- Online or SF. Register on the Google Form (no site account required).
- Scraper Studio is **mandatory**.
- Credits: signup ≠ credits. Enter `wemakedevs` in billing.
- Run out of credits: email contact@wemakedevs.org for top-up.
- LinkedIn posts can be as often as we like during the week.
- Sites: public data only.

## Resources page (canonical links)

Page: [wemakedevs.org/hackathons/scrape-verse/resources](https://www.wemakedevs.org/hackathons/scrape-verse/resources)

### Start here

- [Copy-pasteable prompts for Claude Code, Cursor, and Codex](https://docs.brightdata.com/datasets/scraper-studio/coding-agent-prompts)
- [Build with the Bright Data CLI: the canonical tutorial](https://docs.brightdata.com/datasets/scraper-studio/build-with-the-cli)
- [Bright Data CLI overview](https://docs.brightdata.com/cli/overview)
- [Bright Data CLI on GitHub](https://github.com/brightdata/cli)
- [Bright Data skills for coding agents](https://github.com/brightdata/skills)

### Product docs

- [Scraper Studio overview](https://docs.brightdata.com/datasets/scraper-studio/overview)
- [AI Agent walkthrough: the five scraper types](https://docs.brightdata.com/datasets/scraper-studio/ai-agent)
- [The self-healing tool](https://docs.brightdata.com/datasets/scraper-studio/self-healing-tool)
- [API quickstart: trigger a scraper from any language](https://docs.brightdata.com/api-reference/scraper-studio-api/Getting_started_with_the_API)

### Plans and pricing

- [Scraper Studio product](https://brdta.com/wemakedevs)
- [Scraper Studio pricing](https://brightdata.com/pricing/web-scraper/studio)
- [Free tier: 5,000 credits/month](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier)

How-to notes live in [brightdata.md](brightdata.md). Copy-paste prompts live in [../prompts/cursor.md](../prompts/cursor.md).
