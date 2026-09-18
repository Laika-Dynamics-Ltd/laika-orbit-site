---
title: Away mode
description: Leave your chats running for hours, and come back to one summary card.
---

Away mode is one switch for leaving your chats running while you're gone. Choose **Away** from
the autopilot control, say for how many hours (1 to 24) and, if you like, give a goal such as "keep
every open chat moving on its current task". Press return to start.

## While you're away

- **The conductor leads your chats.** It sends each chat its next step, the same way it does when
  autopilot is on.
- **Plainly safe steps are approved for you.** Reading and editing files inside each chat's own
  folder (outside `.git`), running its tests, type checks, lint and builds, and looking at git.
  Every other permission prompt waits for you as usual. Questions a chat asks you always wait.
- **Stuck chats are brought back.** A chat whose Claude Code stopped, whose turn failed, or that has
  shown no sign of life for a long time is restarted and told to continue, a few times at most. A
  chat that hits a usage limit moves to another of your own signed-in accounts if your policy
  allows it, or waits for the reset and carries on.
- **A budget, if you set one.** The away dialog shows the spending limit and how many new chats the
  conductor may open. Change both in **Policy**.

## What it never does on its own

No setting switches these on while you're away:

- pushing, deploying or deleting
- anything on the web, or on another machine
- MCP tools
- chained or redirected shell commands (the one exception: `cd` into the chat's own folder,
  followed by commands that are each allowed on their own)

## Coming back

When the time is up, or you say you're back, everything switches off together, and the summary
card shows the time away: what needs you first, most urgent at the top, then what is still running
with its ETA, what finished, and what was approved or recovered for you, grouped by project. Each row
opens its chat.

The card is also written every hour while you work. It's put together from each chat's existing
brief, so writing it calls no model.

## The policy and the log

The rules live in `~/.laika/away-policy.json`, written the first time away mode starts. Its lists add
to the safe defaults, and `removed` takes defaults out. Every decision the policy makes is appended to
`~/.laika/away-log.jsonl`, so you can read exactly what was approved and why.

To stop the conductor at once, press <kbd>Shift</kbd><kbd>⌥</kbd><kbd>⌘</kbd><kbd>A</kbd>. It doesn't ask
for confirmation.
