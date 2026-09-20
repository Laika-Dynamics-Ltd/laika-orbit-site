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
- **Anonymous usage counts** are sent only if you turn them on. The app ships with reporting off; a
  card asks once, and declining creates nothing. If you say yes, what leaves is a random install id
  made at that moment, the app version, your platform, and daily counts of a fixed list of coarse
  actions (that recall ran, that a chat opened). Never a file name, path, query, prompt, URL, IP
  address — or where you are. Turning it off destroys the id and the queue.
- **Licence checks** (Orbit Pro only) send your licence key to laikaorbit.com at most once an hour
  while the app is open. The date of the check is recorded against your own Stripe subscription;
  nothing about what you did is sent.

Nothing else is sent to Laika Dynamics. The full detail is in the
[privacy policy](https://laikaorbit.com/legal/privacy).

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
