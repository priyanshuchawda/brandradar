# Discord delivery (Monday Diff)

Post the Monday Diff brief into a Discord channel. Prefer a **channel webhook** for demos; use a **bot token** when you want the BrandRadar app identity.

Official intro: [Discord Developer Platform](https://docs.discord.com/developers/intro)

## Option A — Webhook (fastest)

1. Discord channel → Edit channel → Integrations → Webhooks → New Webhook  
2. Copy the URL into `.env.local`:

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

3. Post a brief:

```bash
curl -s -X POST http://localhost:3000/api/discord \
  -H 'content-type: application/json' \
  -d '{"forceMock":true}'
```

## Option B — Bot token + channel

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application  
2. Bot → Add Bot → Reset Token → copy token  
3. OAuth2 → URL Generator → scopes: `bot` → permissions: `Send Messages`, `View Channel`  
4. Invite the bot to your server  
5. Enable Developer Mode in Discord → copy channel ID  

```bash
DISCORD_BOT_TOKEN=...
DISCORD_CHANNEL_ID=...
```

## API

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/discord` | Configured? webhook vs bot |
| `POST` | `/api/discord` | Run intel pull + post message(s) |

Body: `{ forceMock?, persist? }` — same as `/api/intel`.

Slash command `/intel` can call the same formatter later; webhook/bot post is enough for Monday delivery and demos.

## Security

Never commit tokens. Mask them in demo videos. Optional `BRANDRADAR_API_KEY` still guards mutating routes when set.
