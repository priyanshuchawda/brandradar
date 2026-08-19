# Contributing

Thanks for your interest in BrandRadar. This project is maintained by a small team and welcomes clear, focused contributions.

## Development setup

```bash
git clone https://github.com/priyanshuchawda/brandradar.git
cd brandradar
cp .env.example .env.local
npm install
npm run dev
```

Put API keys in `.env.local` only. Never commit secrets.

## Before you open a pull request

```bash
npm test
npm run lint
```

Keep changes scoped. Match existing TypeScript, Tailwind, and Zod patterns in the files you touch.

## Pull requests

1. Describe the problem and the approach in plain language.
2. Link related issues when they exist.
3. Update docs if behavior, env vars, or API contracts change.
4. Do not include `.env.local`, tokens, or scraped personal data.

## Collectors and live data

Custom Bright Data Scraper Studio collectors (`c_*`) are documented in [docs/collectors.md](docs/collectors.md). Use public HTTPS pages only. Do not wire pre-built marketplace library scrapers as the primary product extractor.

## AI-assisted work

Coding agents and AI tools are fine. If you used them materially, say so in the PR description and verify the result yourself. Contributors should be able to explain what changed and why.

## Questions

Open a GitHub issue for bugs, docs gaps, or design questions. For security concerns, see [docs/security.md](docs/security.md).
