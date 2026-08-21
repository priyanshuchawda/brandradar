# Discord + Monday Diff

BrandRadar posts **rich embeds** into Discord and supports guild slash commands. Official docs: [Intro](https://docs.discord.com/developers/intro) · [API Reference](https://docs.discord.com/developers/reference) · [Application Commands](https://docs.discord.com/developers/interactions/application-commands) · [Receiving Interactions](https://docs.discord.com/developers/interactions/receiving-and-responding)

## What we use (on purpose)

| Discord feature | BrandRadar use |
| --- | --- |
| Bot token + REST | Create `#monday-diff`, post embed briefs |
| Message embeds | Cohort summary, per-rival diffs, plays |
| Guild slash commands | `/intel`, `/rivals`, `/help` |
| Interactions HTTP | Verify Ed25519 signatures → run intel pull |
| Channel topic | Points people at `/intel` |

## What we skip (for now)

| Feature | Why not yet |
| --- | --- |
| Gateway websocket / discord.js long-running client | Next.js is HTTP; Interactions URL is enough |
| Moderation / tickets / welcome | Wrong product |
| Message Content Intent | Slash commands don’t need it |
| Components (buttons) v1 | Embeds + slash first; buttons can deep-link later |

## Env

```bash
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=                 # server id
DISCORD_APPLICATION_ID=           # same as Client ID from the portal
DISCORD_CLIENT_ID=                # alias accepted
DISCORD_CHANNEL_ID=               # set to #monday-diff after setup
DISCORD_PUBLIC_KEY=               # General Information → Public Key (for slash interactions)
# Optional fallback:
# DISCORD_WEBHOOK_URL=
```

## One-time setup

1. Bot invited with scopes **`bot`** + **`applications.commands`**, permission **Send Messages** (+ Manage Channels if you want the app to create `#monday-diff`).
2. Put token + guild + application id in `.env.local`.
3. Run setup (creates channel + registers commands):

```bash
curl -s -X POST http://localhost:3000/api/discord/setup
```

4. Copy returned `channel_id` into `DISCORD_CHANNEL_ID`.
5. Developer Portal → General Information → **Public Key** → `DISCORD_PUBLIC_KEY`.
6. Interactions Endpoint URL (must be public HTTPS):

```text
https://brandradar-beta.vercel.app/api/discord/interactions
```

Discord sends a PING; our route replies `{ type: 1 }` after signature verify.

Local note: Ed25519 verify uses SPKI-wrapped keys (Node 20+/24 rejects `format: "raw"`). Slash *handlers* are covered by unit tests; Discord can only hit `/api/discord/interactions` over public HTTPS (tunnel or deploy) when you set the Interactions Endpoint URL.

## Slash commands

| Command | Effect |
| --- | --- |
| `/intel mode:example` | Fixture week → embed brief in the channel |
| `/intel mode:live` | Studio pull when `COLLECTOR_INTEL_UPDATES` is set |
| `/rivals` | Cohort list + update URLs |
| `/help` | Product help + web app link |

Guild commands appear in a minute or two after `PUT …/commands`.

## HTTP API (app)

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/discord` | Config status |
| `POST` | `/api/discord` | Pull intel + post embeds |
| `POST` | `/api/discord/setup` | Create `#monday-diff` + register slash commands |
| `POST` | `/api/discord/interactions` | Discord → us (slash / PING) |

## Security

- Never commit tokens or the public key is fine to commit? **Public key is public** — still keep tokens in `.env.local` only.
- Interactions reject bad Ed25519 signatures with `401`.
- Optional `BRANDRADAR_API_KEY` still guards mutating app routes.

## Rotate a leaked bot token

Developer Portal → Bot → Reset Token → update `.env.local` → redeploy.
