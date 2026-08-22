# Discord + Monday Diff

BrandRadar posts **rich embeds** into Discord and supports guild slash commands. Official docs: [Intro](https://docs.discord.com/developers/intro) · [Message Embed Object](https://docs.discord.com/developers/resources/channel#embed-object) · [Application Commands](https://docs.discord.com/developers/interactions/application-commands)

## Professional server layout

Run once (creates categories, channels, pins welcome embeds, sets guild description):

```bash
npm run discord:bootstrap
```

Or via API while `npm run dev` is running:

```bash
curl -s -X POST http://localhost:3000/api/discord/setup \
  -H "Content-Type: application/json" \
  -d '{"bootstrap":true,"refresh":true}'
```

Copy printed `env_lines` into `.env.local`.

### Channel map

| Category | Channel | Purpose |
| --- | --- | --- |
| **START HERE** | `#rules` | Server rules (read-only, pinned) |
| **START HERE** | `#start-here` | 2-min judge path (system channel) |
| **START HERE** | `#slash-commands` | `/intel` `/rivals` `/schema` reference |
| **START HERE** | `#schema` | JSON contract (read-only, pinned) |
| **MONDAY DIFF** | `#monday-diff` | Weekly briefs · `/intel` |
| **MONDAY DIFF** | `#cohort-rivals` | Roame, Stardrift, … (read-only) |
| **HEAL LAB** | `#heal-alerts` | broken → recovered alerts |
| **HEAL LAB** | `#demo-links` | Video URLs (read-only) |
| **HACKATHON** | `#hackathon-track` | Submission story (read-only) |

Bot needs **Manage Channels**, **Send Messages**, **Manage Messages** (for pins).

## Env

```bash
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_APPLICATION_ID=
DISCORD_CHANNEL_ID=              # #monday-diff
DISCORD_HEAL_CHANNEL_ID=         # #heal-alerts
DISCORD_START_CHANNEL_ID=        # optional — from bootstrap
DISCORD_SCHEMA_CHANNEL_ID=
DISCORD_PUBLIC_KEY=
```

## Slash commands

| Command | Effect |
| --- | --- |
| `/intel mode:example` | Fixture week → rich embed brief |
| `/intel mode:live` | Studio pull |
| `/rivals` | Cohort + URLs |
| `/schema` | Data contract |
| `/help` | Channel map + links |

## Embed design

- **Author** line: BrandRadar (links to app)
- **Colors**: green = healthy, yellow = degraded, red = critical
- **Monday Diff**: visibility score, modified entries, collector `c_*`, plays
- **Heal alerts**: separate channel, not mixed with intel feed

See `lib/discord-embeds.ts` and `lib/discord-brand.ts`.

## HTTP API

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/discord/setup` | Bootstrap or legacy single channel |
| `POST` | `/api/discord/interactions` | Slash commands |

## Security

- Never commit `DISCORD_BOT_TOKEN`
- Interactions verify Ed25519 signatures (`DISCORD_PUBLIC_KEY`)
