# Discord + Monday Diff

BrandRadar posts **rich embeds** into Discord and supports guild slash commands.

Official refs: [Discord Intro](https://docs.discord.com/developers/intro) · [Embed object](https://docs.discord.com/developers/resources/channel#embed-object) · [Application commands](https://docs.discord.com/developers/interactions/application-commands)

## Setup (one command)

```bash
npm run discord:bootstrap
```

Creates categories, channels, pinned welcome embeds, guild description, and registers slash commands. Copy printed env lines into `.env.local`.

**Prune junk + post demo intel:**

```bash
npm run discord:tidy
```

Or via HTTP while `npm run dev`:

```bash
curl -s -X POST http://localhost:3000/api/discord/setup \
  -H "Content-Type: application/json" \
  -d '{"bootstrap":true,"refresh":true}'
```

### Bot permissions

Invite with scopes **`bot`** + **`applications.commands`**:

- Manage Channels (bootstrap)
- Send Messages + Embed Links
- Manage Messages (pin welcome embeds)

### Interactions endpoint

Set in [Discord Developer Portal](https://discord.com/developers/applications):

```text
https://brandradar-beta.vercel.app/api/discord/interactions
```

Add `DISCORD_PUBLIC_KEY` from General Information → Public Key.

## Channel map

| Category | Channel | Purpose |
| --- | --- | --- |
| **START HERE** | `#rules` | Server rules (read-only, pinned) |
| **START HERE** | `#start-here` | 2-min judge path (system channel) |
| **START HERE** | `#slash-commands` | Command reference (read-only) |
| **START HERE** | `#schema` | JSON contract (read-only, pinned) |
| **MONDAY DIFF** | `#monday-diff` | Weekly cohort briefs · `/intel` |
| **MONDAY DIFF** | `#cohort-rivals` | Cohort directory (read-only) |
| **COMPANIES** | `#roame` | Roame history, guides, direction & counter-plays |
| **COMPANIES** | `#stardrift` | Stardrift engineering/blog feed & strategy |
| **COMPANIES** | `#pointhound` | Pointhound posts, sweet spots & tactical plays |
| **COMPANIES** | `#rove` | Rove updates, release notes & counter-plays |
| **HEAL LAB** | `#heal-alerts` | broken → recovered |
| **HEAL LAB** | `#demo-links` | Video URLs (read-only) |
| **HACKATHON** | `#hackathon-track` | Submission story (read-only) |

## Dedicated Company Channels Architecture

Every scraped competitor has a **dedicated, persistent channel** in Discord under the `COMPANIES` category:

1. **Pinned Master Dossier**: Pinned profile on channel creation with homepage, update surface, collector ID, and strategic background.
2. **Update History & Timestamped Feed**: Chronological log of all scraped guides, blogs, and changelogs formatted with Discord native timestamps (`<t:UNIX:D>` and `<t:UNIX:R>`).
3. **Strategic Direction & Momentum Analysis**: Automated extraction of focus themes (Flight Coverage, AI Automation, Points Sweet Spots, etc.) and shipping velocity.
4. **Targeted Counter-Strategies**: Specific `Attack`, `Defend`, `Fill`, and `Watch` tactical plays synthesized directly against that company.

## Env

```bash
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_APPLICATION_ID=       # or DISCORD_CLIENT_ID
DISCORD_CHANNEL_ID=           # #monday-diff
DISCORD_HEAL_CHANNEL_ID=      # #heal-alerts
DISCORD_PUBLIC_KEY=
# From bootstrap (optional but recommended):
DISCORD_RULES_CHANNEL_ID=
DISCORD_START_CHANNEL_ID=
DISCORD_COMMANDS_CHANNEL_ID=
DISCORD_SCHEMA_CHANNEL_ID=
DISCORD_RIVALS_CHANNEL_ID=
DISCORD_DEMO_CHANNEL_ID=
DISCORD_SUBMISSION_CHANNEL_ID=
DISCORD_RIVAL_ROAME_CHANNEL_ID=
DISCORD_RIVAL_STARDRIFT_CHANNEL_ID=
DISCORD_RIVAL_POINTHOUND_CHANNEL_ID=
DISCORD_RIVAL_ROVE_CHANNEL_ID=
```

## Slash commands

| Command | Effect |
| --- | --- |
| `/intel mode:example` | Fixture week → rich cohort brief in `#monday-diff` |
| `/intel mode:live` | Real Bright Data pull (`COLLECTOR_INTEL_UPDATES`) |
| `/company name:roame` | Deep-dive intel dossier, trajectory & plays for a specific rival |
| `/rivals` | Cohort directory + update URLs + channel links |
| `/schema` | ListingRow + IntelSnapshot contract |
| `/help` | Channel map + app links |

Guild commands appear within ~1–2 minutes after bootstrap.

## Embed design

Implemented in `lib/discord-embeds.ts` and `lib/discord-brand.ts`:

| Element | Convention |
| --- | --- |
| Author | BrandRadar → app URL |
| Colors | Green healthy · yellow degraded · red critical |
| Monday Diff | Visibility score, modified rows, plays, `c_*` |
| Heal alerts | Separate `#heal-alerts` channel |

Discord limits: max **10 embeds** per message; we batch rival diffs accordingly.

## HTTP API

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/api/discord` | Config status |
| `POST` | `/api/discord` | Pull intel + post embeds |
| `POST` | `/api/discord/setup` | Bootstrap or legacy single channel |
| `POST` | `/api/discord/interactions` | Slash commands + PING |

## Security

- Never commit `DISCORD_BOT_TOKEN`
- Interactions reject invalid Ed25519 signatures (401)
- Read-only channels deny `@everyone` Send Messages
- Optional `BRANDRADAR_API_KEY` on mutating app routes

## Rotate a leaked token

Developer Portal → Bot → Reset Token → update `.env.local` → redeploy.
