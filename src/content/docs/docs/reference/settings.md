---
title: Settings and files
description: Environment variables and the local files Laika Orbit reads and writes.
---

## Environment

Set these in `.env.local` at the repo root (copy `.env.example`), or in the shell that starts the app.
All are optional.

| Variable | Default | What it does |
|---|---|---|
| `BRAIN_ROOT` | the repo | The folder whose `brain/` config and index the app uses |
| `PORT` | `5200` | The app's port (loopback only) |
| `DEV_ROOTS` | `~/dev` | Where the Claude panel looks for repos, colon-separated |
| `CALENDAR_ICS_URLS` |  | Secret iCal addresses for the calendar widget, comma-separated |
| `CALENDAR_REFRESH_MINS` | `5` | Calendar refresh interval |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |  | Your Google OAuth client, for the inbox widget |
| `GMAIL_FEED` | on | `0` turns the inbox feed off |
| `EMAIL_REFRESH_SECS` | `60` | Inbox refresh interval |
| `LAIKA_BRIEFS` | on | `0` stops the per-turn chat summaries |
| `LAIKA_BRIEF_MODEL` | `haiku` | The model that writes them |
| `MISSION_URL` |  | A Mission Control panel to show in the rail |

## Files

All of these are gitignored, so `git pull` never touches them.

| File | Holds |
|---|---|
| `.env.local` | The variables above |
| `brain/index.config.json` | What gets indexed ([reference](/docs/recall/configuration/)) |
| `brain/agents.local.json` | Claude accounts added in the app: a label and a Claude Code config folder each, no credentials |
| `brain/connectors.local.json` | Claude connectors to list in settings and on the map: `[{ "id", "name", "via", "live" }]` |
| `brain/widgets/_settings.json` | Widget layout |
| `brain/widgets/*.json` | Your widgets ([reference](/docs/widgets/)) |

Browser profiles and extensions live in `~/Library/Application Support/`. Chat state lives in
`~/.laika/`.
