# Security

BrandRadar spends third-party scrape and model credits on every live scan. Mutating routes are treated as costly APIs, not a public sandbox.

## What is in place

| Control | Behavior |
| --- | --- |
| Secrets | `.env` / `.env.local` gitignored. Tokens used only in server routes and CLI scripts |
| No client keys | Browser never sees Bright Data or Gemini credentials |
| Input validation | Zod on scan and heal. URL length, ≤5 rivals, ≤40 snapshot rows, heal prompt ≤1000 chars |
| Public HTTPS only | `lib/urls.ts` rejects `http`, credentials, localhost, RFC1918, link-local, `.internal` |
| Payload caps | Scan 16 KB, heal 256 KB |
| Rate limits | Per IP, in memory: scan **8 / 15 min**, heal **20 / 15 min**, status **60 / min**. `429` + `Retry-After` |
| Origin check | If `Origin` is present, it must match this app |
| Optional API key | `BRANDRADAR_API_KEY` — `Authorization: Bearer` or `x-api-key` on POST |
| Demo fixture | Allowed outside production unless `ALLOW_DEMO_FIXTURE=false`. Production must set `ALLOW_DEMO_FIXTURE=true` to keep the button |
| Collector spawn | CLI only runs if the id matches `c_[a-z0-9]+` and is not `c_mock*` |
| Output redaction | Studio CLI logs strip bearer tokens, Gemini keys, and UUID-shaped secrets |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `X-Powered-By` off |
| Data policy | Public pages only. No login, paywall, or personal data |

Rate-limit keys use `X-Forwarded-For` when present (set by the reverse proxy). On a single Node process the limiter is an in-memory map.

## What is not in this revision

- User accounts, sessions, or multi-tenant isolation
- Distributed rate limits (Redis). Multiple instances do not share counters
- Bot management / WAF (put one in front in production)
- Encrypted snapshot store
- Audit log of who triggered a live scrape

## Production checklist

1. HTTPS at the edge.
2. Set `BRANDRADAR_API_KEY` if the API is reachable beyond the first-party UI.
3. Set `ALLOW_DEMO_FIXTURE=false`.
4. Set `USE_MOCK=false` only after collector ids are configured.
5. Restrict who can hit `/api/scan` and `/api/heal` (IP allowlist or the API key).
6. Rotate Bright Data and Gemini keys if they were ever pasted into chat or a ticket.
