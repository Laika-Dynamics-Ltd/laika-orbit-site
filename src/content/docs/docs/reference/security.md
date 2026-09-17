---
title: Privacy and security
description: What stays on your machine, what leaves it, and how the app protects itself.
---

## What leaves your machine

- **Chats** go to Anthropic through Claude Code, under your account, exactly as they would from the
  terminal. After each turn a short summary is written by a small model on the same account
  (`LAIKA_BRIEFS=0` turns that off).
- **Inbox and calendar** are fetched from Google with the credentials you configure.
- **Laika Orbit recall** makes no network calls. Indexing and recall are local.

Nothing is sent to Laika Dynamics. There's no telemetry.

## How the app protects itself

- The server listens on `127.0.0.1` only and refuses requests whose `Host` isn't a loopback name, which
  stops DNS rebinding.
- Requests that change something must come from the app's own page: a cross-site form post or image
  tag is refused.
- The chat host listens on a random loopback port with a per-launch token in a file only you can read.
- Chats start only in folders the app knows, and ask before acting unless you choose another mode.
- Web pages in the browser run sandboxed, with no access to the app.

There's no login, so don't forward the port or run the app on a shared machine.

## Reporting a vulnerability

Email **laika@laikadynamics.com** with details and steps to reproduce, rather than opening a public
issue.
