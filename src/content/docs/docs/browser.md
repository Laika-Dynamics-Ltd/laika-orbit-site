---
title: Browser
description: Chromium tabs with a profile per account, and Chrome extensions.
---

Press <kbd>b</kbd> to open the browser. Links clicked anywhere in Laika Orbit open here.

:::note
Real tabs need the desktop app (`pnpm shell`). A web page can't embed other sites, so in a plain
browser tab the dock explains how to launch the app instead.
:::

## Profiles

Every tab belongs to a **profile** with its own cookies, logins and storage, so a work account and
several client accounts can be signed in at once, side by side. Create profiles by name, or pick names
and colours from your existing Chrome profiles (you sign in once in each). Star a profile to make it
where links open.

Profile data is kept in `~/Library/Application Support/`, outside the repo.

## Extensions

Install extensions from the Chrome Web Store into a profile; their toolbar buttons appear beside the
address bar. Extension support uses the GPL-3.0 licensed
[electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell), so a built app
that includes it is distributed under GPL-3.0.
